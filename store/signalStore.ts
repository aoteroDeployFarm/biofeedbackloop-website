import { create } from "zustand";
import { Timestamp, type Unsubscribe } from "firebase/firestore";
import {
  type Signal,
  type SignalType,
  type SignalPayload,
  writeSignal,
  enrichSignal,
  subscribeToSignals,
} from "@/lib/firebase/firestore";
import { toFirestore } from "@/lib/firestore-helpers";

interface SignalState {
  signals: Signal[];
  loading: boolean;
  error: string | null;
  _unsubscribe: Unsubscribe | null;

  // Optimistically add a signal, then persist to Firestore.
  // On failure, the temporary entry is removed and error is set.
  addSignal: (uid: string, type: SignalType, payload: SignalPayload) => Promise<void>;

  // Optimistically patch specific payload fields, then persist via updateDoc.
  // On failure, the in-memory change is rolled back and error is set.
  updateSignal: (uid: string, signalId: string, fields: Partial<SignalPayload>) => Promise<void>;

  // Subscribe to the Firestore real-time stream for the last `days` days.
  subscribe: (uid: string, days?: number) => void;

  // Tear down the Firestore listener (call on auth sign-out or unmount).
  unsubscribe: () => void;

  setError: (msg: string | null) => void;
}

export const useSignalStore = create<SignalState>((set, get) => ({
  signals: [],
  loading: false,
  error: null,
  _unsubscribe: null,

  addSignal: async (uid, type, payload) => {
    const safe = toFirestore(payload) as SignalPayload;
    // 1. Optimistic insert — visible immediately with a null timestamp
    const tempId = `optimistic_${Date.now()}`;
    const optimistic: Signal = {
      id: tempId,
      type,
      timestamp: null,
      payload: safe,
      _optimistic: true,
    };
    set((s) => ({ signals: [optimistic, ...s.signals] }));

    try {
      // 2. Persist to Firestore — the onSnapshot listener will replace this
      //    optimistic entry with the confirmed document automatically.
      await writeSignal(uid, type, safe);
      // Remove the temp entry; the real-time listener delivers the real doc.
      set((s) => ({
        signals: s.signals.filter((sig) => sig.id !== tempId),
      }));
    } catch (err) {
      // 3. Rollback on failure
      set((s) => ({
        signals: s.signals.filter((sig) => sig.id !== tempId),
        error: err instanceof Error ? err.message : "Signal could not be saved.",
      }));
    }
  },

  updateSignal: async (uid, signalId, fields) => {
    const safe = JSON.parse(
      JSON.stringify(fields, (_k, v) => (v === undefined ? null : v))
    ) as Partial<SignalPayload>;

    // Snapshot the previous payload for rollback
    const prev = get().signals.find((s) => s.id === signalId)?.payload;

    // Optimistic in-memory patch
    set((s) => ({
      signals: s.signals.map((sig) =>
        sig.id === signalId
          ? { ...sig, payload: { ...sig.payload, ...safe } }
          : sig
      ),
    }));

    try {
      await enrichSignal(uid, signalId, safe);
    } catch (err) {
      // Rollback to previous payload if Firestore write fails
      if (prev !== undefined) {
        set((s) => ({
          signals: s.signals.map((sig) =>
            sig.id === signalId ? { ...sig, payload: prev } : sig
          ),
          error: err instanceof Error ? err.message : "Signal could not be updated.",
        }));
      } else {
        set({ error: err instanceof Error ? err.message : "Signal could not be updated." });
      }
    }
  },

  subscribe: (uid, days = 14) => {
    // Tear down any existing listener first
    get()._unsubscribe?.();

    set({ loading: true, error: null });

    const unsub = subscribeToSignals(
      uid,
      days,
      (incoming) => {
        set((s) => {
          // Merge: keep optimistic entries, replace everything else
          const optimistic = s.signals.filter((sig) => sig._optimistic);
          return { signals: [...optimistic, ...incoming], loading: false };
        });
      },
      (err) => set({ error: err.message, loading: false })
    );

    set({ _unsubscribe: unsub });
  },

  unsubscribe: () => {
    get()._unsubscribe?.();
    set({ _unsubscribe: null, signals: [] });
  },

  setError: (msg) => set({ error: msg }),
}));

// ── Analytics: Weekday Pattern Aggregation ────────────────────────────────────
//
// buildChartData powers the TrendChart "Satiety Duration vs. Protein" view.
//
// Approach: group meal signals by weekday abbreviation (Mon/Tue/…), then
// average each metric across all meals on that day within the subscription
// window (default 14 days). Days with no data return null for each metric
// so Recharts can connect across gaps with `connectNulls`.
//
// Metrics:
//   satietyHours  — hunger_return_hrs (1–4.5h, from SelectPill or AI)
//   energyScore   — energy_level (mapped: low=3, moderate=5, steady=7, high=9)
//   proteinG      — protein_est in grams (user-entered or AI-estimated)
//
// Scalability note: this runs client-side on the already-fetched signal array.
// For larger datasets (>500 signals), move aggregation to a Firestore
// aggregation query or a scheduled Cloud Function that writes daily summaries
// to users/${uid}/summaries/{YYYY-MM-DD}.
export function buildChartData(signals: Signal[]) {
  const dayMap = new Map<string, { satietyHours: number[]; energyScore: number[]; proteinG: number[] }>();

  for (const sig of signals) {
    if (sig.type !== "meal" || !sig.timestamp || !sig.payload) continue;
    const date = sig.timestamp.toDate();
    const key = date.toLocaleDateString("en-US", { weekday: "short" });

    if (!dayMap.has(key)) dayMap.set(key, { satietyHours: [], energyScore: [], proteinG: [] });
    const bucket = dayMap.get(key)!;

    if (sig.payload.hunger_return_hrs != null) bucket.satietyHours.push(sig.payload.hunger_return_hrs);
    if (sig.payload.energy_level != null) bucket.energyScore.push(sig.payload.energy_level);
    if (sig.payload.protein_est != null) bucket.proteinG.push(sig.payload.protein_est);
  }

  return Array.from(dayMap.entries()).map(([day, d]) => ({
    day,
    satietyHours: d.satietyHours.length ? avg(d.satietyHours) : null,
    energyScore: d.energyScore.length ? avg(d.energyScore) : null,
    proteinG: d.proteinG.length ? avg(d.proteinG) : null,
  }));
}

// ── Analytics: Satiety ROI ─────────────────────────────────────────────────────
//
// Satiety ROI is not yet a computed field but is derivable from signal data:
//
//   satiety_roi = hunger_return_hrs / protein_est
//
// A higher ratio means more satiety hours per gram of protein — a proxy for
// meal efficiency. This is visible as a trend in InsightsGraph's scatter plot
// (x = protein_est, y = hunger_return_hrs): meals in the upper-left quadrant
// have high satiety ROI (low protein, long satiety window — e.g. high-fiber
// meals); upper-right quadrant = high protein AND long satiety.
//
// To surface this as an explicit metric, add to buildChartData:
//   satietyROI: proteinG > 0 && satietyHours > 0
//     ? Math.round((satietyHours / proteinG) * 100) / 100
//     : null
// and render as a second Y-axis line in TrendChart.
function avg(arr: number[]): number {
  return Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10;
}
