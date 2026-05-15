import {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  type Unsubscribe,
  type DocumentData,
} from "firebase/firestore";
import { db } from "./config";

export type SignalType = "meal" | "movement" | "sensation";

export type SatietyScore = 1 | 2 | 3 | 4; // 1=light, 2=satisfied, 3=full, 4=stuffed

export interface SignalPayload {
  foods?: string | null;
  satiety?: SatietyScore | null;
  portion?: string | null;
  hunger_return_hrs?: number | null;
  energy_level?: number | null; // 1–10
  bloating?: string | null;
  protein_est?: number | null; // grams
  cost_est?: number | null; // USD
  notes?: string | null;
}

export interface Signal {
  id: string;
  type: SignalType;
  timestamp: Timestamp | null; // null while pending (optimistic)
  payload: SignalPayload;
  _optimistic?: boolean;
}

function signalsRef(uid: string) {
  return collection(db, "users", uid, "signals");
}

export async function writeSignal(
  uid: string,
  type: SignalType,
  payload: SignalPayload
): Promise<string> {
  // ── Diagnostic: log raw payload before sanitization ──────────────────────
  console.log("[DEBUG] writeSignal raw payload keys:", Object.keys(payload));
  console.log("[DEBUG] payload.portion →", payload.portion, "| type:", typeof payload.portion);
  console.log("[DEBUG] payload.bloating →", payload.bloating, "| type:", typeof payload.bloating);

  // ── Nuclear sanitizer: JSON round-trip eliminates every undefined ─────────
  const clean: Record<string, unknown> = JSON.parse(
    JSON.stringify(payload, (_key, value) => (value === undefined ? null : value))
  );

  console.log("[DEBUG] clean payload:", JSON.stringify(clean));

  const doc = await addDoc(signalsRef(uid), {
    type,
    timestamp: serverTimestamp(),
    payload: clean,
  });
  return doc.id;
}

export function subscribeToSignals(
  uid: string,
  days: number,
  onData: (signals: Signal[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const cutoff = Timestamp.fromDate(
    new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  );

  const q = query(
    signalsRef(uid),
    where("timestamp", ">=", cutoff),
    orderBy("timestamp", "desc"),
    limit(200)
  );

  return onSnapshot(
    q,
    (snap) => {
      const signals: Signal[] = snap.docs.map((doc) => {
        const d = doc.data() as DocumentData;
        // Guard: old documents may have no `payload` key or a differently
        // structured doc. Fall back to an empty object so property access
        // never throws "Cannot read properties of undefined".
        const rawPayload = (d.payload ?? {}) as SignalPayload;
        return {
          id: doc.id,
          type: (d.type ?? "meal") as SignalType,
          timestamp: (d.timestamp ?? null) as Timestamp | null,
          payload: rawPayload,
        };
      });
      onData(signals);
    },
    (err) => onError?.(err as Error)
  );
}

// Map label strings from the UI back to typed values
export function mapSatietyLabel(label: string): SatietyScore {
  const map: Record<string, SatietyScore> = {
    light: 1,
    satisfied: 2,
    full: 3,
    stuffed: 4,
  };
  return map[label.toLowerCase()] ?? 2;
}

export function mapHungerReturn(label: string): number | null {
  const map: Record<string, number> = {
    "1 hr": 1,
    "2 hrs": 2,
    "3 hrs": 3,
    "4 hrs": 4,
    "4+ hrs": 4.5,
  };
  return map[label] ?? null;
}

export function mapEnergyLevel(label: string): number | null {
  const map: Record<string, number> = {
    low: 3,
    moderate: 5,
    steady: 7,
    high: 9,
  };
  return map[label.toLowerCase()] ?? null;
}
