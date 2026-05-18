"use client";

import { useState } from "react";
import { Dumbbell } from "lucide-react";
import { cn } from "@/lib/utils";
import { type Timestamp } from "firebase/firestore";
import type { Signal } from "@/lib/firebase/firestore";
import { useSignalStore } from "@/store/signalStore";
import { useAuth } from "@/components/auth/AuthProvider";

// ── Helpers ───────────────────────────────────────────────────────────────────

function relativeTimestamp(ts: Timestamp): string {
  const date = ts.toDate();
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  const timeStr = date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  if (date.toDateString() === now.toDateString()) return `Today at ${timeStr}`;
  if (date.toDateString() === yesterday.toDateString())
    return `Yesterday at ${timeStr}`;
  return (
    date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    }) + ` · ${timeStr}`
  );
}

// ── Label maps ────────────────────────────────────────────────────────────────

const satietyLabels: Record<number, string> = {
  1: "Light",
  2: "Satisfied",
  3: "Full",
  4: "Stuffed",
};

const energyLabels: Record<number, string> = {
  1: "Low",   2: "Low",   3: "Low",
  4: "Moderate", 5: "Moderate", 6: "Moderate",
  7: "Steady", 8: "Steady",
  9: "High",  10: "High",
};

// ── Inline enrichment options (compact labels) ────────────────────────────────

const HUNGER_OPTS = [
  { label: "1h",  value: 1   },
  { label: "2h",  value: 2   },
  { label: "3h",  value: 3   },
  { label: "4h",  value: 4   },
  { label: "4+h", value: 4.5 },
] as const;

const ENERGY_OPTS = [
  { label: "Low",      value: 3 },
  { label: "Moderate", value: 5 },
  { label: "Steady",   value: 7 },
  { label: "High",     value: 9 },
] as const;

const BLOATING_OPTS = ["None", "Mild", "Moderate", "Notable"] as const;

// ── Reusable pill components ──────────────────────────────────────────────────

function MetricPill({
  children,
  muted,
}: {
  children: React.ReactNode;
  muted?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-1 rounded-lg font-sans text-label",
        muted ? "bg-surface-warm text-ink-faint" : "bg-surface-warm text-ink-light"
      )}
    >
      {children}
    </span>
  );
}

function EnrichPill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-2.5 py-1 rounded-lg font-sans text-label border transition-all duration-150",
        active
          ? "bg-ink text-canvas border-ink"
          : "bg-white text-ink-light border-surface-muted hover:border-ink/30 hover:text-ink"
      )}
    >
      {label}
    </button>
  );
}

// ── Signal Card ───────────────────────────────────────────────────────────────

function SignalCard({ signal }: { signal: Signal }) {
  const { user } = useAuth();
  const { updateSignal } = useSignalStore();
  const { payload, timestamp, _optimistic } = signal;

  // Local selection state — gives immediate visual feedback before the
  // optimistic store update re-renders. Stored as display labels (not raw values)
  // so the pill can show "active" state right away.
  const [isEnriching, setIsEnriching] = useState(false);
  const [localHunger, setLocalHunger] = useState<string | null>(null);
  const [localEnergy, setLocalEnergy] = useState<string | null>(null);
  const [localBloating, setLocalBloating] = useState<string | null>(null);

  const timeLabel = timestamp ? relativeTimestamp(timestamp) : "Saving…";
  const satietyLabel =
    payload.satiety != null ? satietyLabels[payload.satiety] : null;

  // A card is an "open loop" when confirmed (not optimistic) AND at least one
  // post-meal delayed signal is still unlogged.
  const isOpenLoop =
    !_optimistic &&
    timestamp != null &&
    (payload.hunger_return_hrs == null ||
      payload.energy_level == null ||
      payload.bloating == null);

  // Per-field "needs input" — considers both stored value and local selection
  const needsHunger  = payload.hunger_return_hrs == null && localHunger  == null;
  const needsEnergy  = payload.energy_level      == null && localEnergy  == null;
  const needsBloating = payload.bloating         == null && localBloating == null;

  // After each selection, auto-close when every missing field is now covered
  function checkAutoClose(
    h: string | null,
    e: string | null,
    b: string | null
  ) {
    const hungerDone  = payload.hunger_return_hrs != null || h != null;
    const energyDone  = payload.energy_level      != null || e != null;
    const bloatingDone = payload.bloating         != null || b != null;
    if (hungerDone && energyDone && bloatingDone) {
      setTimeout(() => setIsEnriching(false), 500);
    }
  }

  async function handleHunger(label: string, value: number) {
    if (!user || _optimistic) return;
    setLocalHunger(label);
    await updateSignal(user.uid, signal.id, { hunger_return_hrs: value });
    checkAutoClose(label, localEnergy, localBloating);
  }

  async function handleEnergy(label: string, value: number) {
    if (!user || _optimistic) return;
    setLocalEnergy(label);
    await updateSignal(user.uid, signal.id, { energy_level: value });
    checkAutoClose(localHunger, label, localBloating);
  }

  async function handleBloating(value: string) {
    if (!user || _optimistic) return;
    setLocalBloating(value);
    await updateSignal(user.uid, signal.id, { bloating: value });
    checkAutoClose(localHunger, localEnergy, value);
  }

  return (
    <article
      className={cn(
        "bg-white rounded-2xl border border-surface-muted px-5 py-4 space-y-3 transition-opacity",
        _optimistic && "opacity-50"
      )}
    >
      {/* Header — meal description + timestamp */}
      <div className="flex items-start justify-between gap-3">
        <p className="font-serif text-body-lg font-medium text-ink leading-snug flex-1">
          {payload.foods || "Meal logged"}
        </p>
        <span className="font-sans text-label text-ink-faint whitespace-nowrap pt-0.5 shrink-0">
          {timeLabel}
        </span>
      </div>

      {/* Metric pills row */}
      {(payload.protein_est != null ||
        payload.hunger_return_hrs != null ||
        satietyLabel ||
        payload.energy_level != null ||
        payload.meal_type ||
        (payload.context_tags && payload.context_tags.length > 0) ||
        payload.bloating != null) && (
        <div className="flex flex-wrap gap-2">
          {payload.meal_type && (
            <MetricPill>{payload.meal_type}</MetricPill>
          )}
          {satietyLabel && <MetricPill>{satietyLabel}</MetricPill>}

          {/* Protein + satiety duration grouped */}
          {(payload.protein_est != null || payload.hunger_return_hrs != null) && (
            <MetricPill>
              <span className="flex items-center gap-1">
                {payload.protein_est != null && (
                  <>
                    <Dumbbell size={9} className="shrink-0" />
                    <span>{payload.protein_est}g protein</span>
                  </>
                )}
                {payload.protein_est != null &&
                  payload.hunger_return_hrs != null && (
                    <span className="text-ink-faint mx-0.5">·</span>
                  )}
                {payload.hunger_return_hrs != null && (
                  <span>{payload.hunger_return_hrs}h satiety</span>
                )}
              </span>
            </MetricPill>
          )}

          {payload.energy_level != null && (
            <MetricPill>
              {energyLabels[payload.energy_level] ?? payload.energy_level} energy
            </MetricPill>
          )}

          {payload.bloating != null && payload.bloating !== "None" && (
            <MetricPill muted>{payload.bloating} bloating</MetricPill>
          )}

          {payload.context_tags?.map((tag) => (
            <MetricPill key={tag} muted>
              {tag}
            </MetricPill>
          ))}

          {/* Open-loop trigger — dashed quiet pill */}
          {isOpenLoop && !isEnriching && (
            <button
              type="button"
              onClick={() => setIsEnriching(true)}
              className="inline-flex items-center px-2.5 py-1 rounded-lg font-sans text-label bg-transparent hover:bg-surface-warm text-ink-faint border border-dashed border-surface-muted transition-colors duration-150"
            >
              + Listen for later signals
            </button>
          )}
        </div>
      )}

      {/* Progressive enrichment panel — smooth height transition */}
      <div
        className={cn(
          "overflow-hidden transition-all duration-200 ease-in-out",
          isEnriching ? "max-h-[220px] opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <div className="pt-3 border-t border-surface-muted space-y-3">

          {/* Hunger return row */}
          {needsHunger && (
            <div>
              <p className="font-sans text-label text-ink-faint mb-2">
                Hunger return
              </p>
              <div className="flex flex-wrap gap-1.5">
                {HUNGER_OPTS.map((opt) => (
                  <EnrichPill
                    key={opt.label}
                    label={opt.label}
                    active={localHunger === opt.label}
                    onClick={() => handleHunger(opt.label, opt.value)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Energy row */}
          {needsEnergy && (
            <div>
              <p className="font-sans text-label text-ink-faint mb-2">
                Energy 90 min later
              </p>
              <div className="flex flex-wrap gap-1.5">
                {ENERGY_OPTS.map((opt) => (
                  <EnrichPill
                    key={opt.label}
                    label={opt.label}
                    active={localEnergy === opt.label}
                    onClick={() => handleEnergy(opt.label, opt.value)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Bloating row */}
          {needsBloating && (
            <div>
              <p className="font-sans text-label text-ink-faint mb-2">
                Bloating / discomfort
              </p>
              <div className="flex flex-wrap gap-1.5">
                {BLOATING_OPTS.map((opt) => (
                  <EnrichPill
                    key={opt}
                    label={opt}
                    active={localBloating === opt}
                    onClick={() => handleBloating(opt)}
                  />
                ))}
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => setIsEnriching(false)}
            className="font-sans text-label text-ink-faint hover:text-ink transition-colors"
          >
            Dismiss
          </button>
        </div>
      </div>
    </article>
  );
}

// ── Feed ──────────────────────────────────────────────────────────────────────

export default function RecentSignalsFeed() {
  const { signals, loading } = useSignalStore();
  const meals = signals.filter((s) => s.type === "meal").slice(0, 20);

  if (loading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-24 rounded-2xl bg-surface-muted animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (!meals.length) {
    return (
      <div className="bg-white rounded-2xl border border-surface-muted px-6 py-12 text-center">
        <p className="font-serif text-body-lg text-ink mb-1">
          No observations yet
        </p>
        <p className="font-sans text-body-sm text-ink-faint">
          Log your first meal. Patterns take a few days to surface.
        </p>
      </div>
    );
  }

  return (
    <section>
      <p className="label-caps mb-4">Recent Observations</p>
      <div className="space-y-2.5">
        {meals.map((s) => (
          <SignalCard key={s.id} signal={s} />
        ))}
      </div>
    </section>
  );
}
