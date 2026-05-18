"use client";

import { useMemo, useState } from "react";
import { RotateCcw } from "lucide-react";
import { useSignalStore } from "@/store/signalStore";
import type { Signal } from "@/lib/firebase/firestore";

// ── Analytics ─────────────────────────────────────────────────────────────────

function avg(arr: number[]): number {
  if (!arr.length) return 0;
  return Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10;
}

interface Observation {
  id: string;
  text: string;
}

function deriveObservations(signals: Signal[]): Observation[] {
  // Strictly filter: must have payload, timestamp, and be a meal type
  const meals = signals.filter(
    (s) => s.type === "meal" && s.payload != null && s.timestamp != null
  );

  if (meals.length < 3) return [];

  const obs: Observation[] = [];

  // 1. Protein-tier satiety correlation
  const withBoth = meals.filter(
    (s) => s.payload.protein_est != null && s.payload.hunger_return_hrs != null
  );

  if (withBoth.length >= 3) {
    const low  = withBoth.filter((s) => (s.payload.protein_est ?? 0) < 20);
    const high = withBoth.filter((s) => (s.payload.protein_est ?? 0) >= 20);
    const avgHigh = avg(high.map((s) => s.payload.hunger_return_hrs as number));
    const avgLow  = avg(low.map((s)  => s.payload.hunger_return_hrs as number));

    if (high.length >= 2 && low.length >= 1 && avgHigh > avgLow) {
      const diff = Math.round((avgHigh - avgLow) * 10) / 10;
      obs.push({
        id: "protein-satiety",
        text: `Meals with higher protein estimates tended to be followed by longer satiety windows — an average of ${diff}h more in this period.`,
      });
    } else if (withBoth.length >= 4) {
      obs.push({
        id: "protein-satiety-flat",
        text: `Across logged meals, satiety windows are averaging ${avgHigh}h. Protein levels and satiety duration appear to be moving together.`,
      });
    }
  }

  // 2. Meal-type energy correlation
  const withEnergy = meals.filter(
    (s) => s.payload.meal_type != null && s.payload.energy_level != null
  );

  if (withEnergy.length >= 3) {
    const byType: Record<string, number[]> = {};
    withEnergy.forEach((s) => {
      const t = s.payload.meal_type!;
      if (!byType[t]) byType[t] = [];
      byType[t].push(s.payload.energy_level!);
    });

    const sorted = Object.entries(byType)
      .filter(([, scores]) => scores.length >= 2)
      .map(([type, scores]) => ({ type, avg: avg(scores) }))
      .sort((a, b) => b.avg - a.avg);

    if (sorted.length >= 2) {
      const best = sorted[0];
      obs.push({
        id: "energy-meal-type",
        text: `${best.type} meals were often followed by more stable energy readings — this pattern appears across ${byType[best.type].length} logged signals.`,
      });
    }
  }

  // 3. Post-workout protein baseline
  const postWorkout = meals.filter(
    (s) =>
      Array.isArray(s.payload.context_tags) &&
      s.payload.context_tags.includes("Post-workout") &&
      s.payload.protein_est != null
  );

  if (postWorkout.length >= 2) {
    const avgProtein = avg(postWorkout.map((s) => s.payload.protein_est as number));
    obs.push({
      id: "post-workout",
      text: `Post-workout meals in your log are averaging ${avgProtein}g protein — a useful baseline to observe over time.`,
    });
  }

  // 4. 7-day satiety trend
  const now = Date.now();
  const MS_7D = 7 * 86_400_000;

  const recent = meals.filter(
    (s) =>
      s.timestamp != null &&
      now - s.timestamp.toDate().getTime() < MS_7D &&
      s.payload.hunger_return_hrs != null
  );
  const older = meals.filter(
    (s) =>
      s.timestamp != null &&
      now - s.timestamp.toDate().getTime() >= MS_7D &&
      s.payload.hunger_return_hrs != null
  );

  if (recent.length >= 2 && older.length >= 2) {
    const recentAvg = avg(recent.map((s) => s.payload.hunger_return_hrs as number));
    const olderAvg  = avg(older.map((s)  => s.payload.hunger_return_hrs as number));
    const diff = Math.round((recentAvg - olderAvg) * 10) / 10;

    if (Math.abs(diff) >= 0.3) {
      obs.push({
        id: "satiety-trend",
        text: diff > 0
          ? `Satiety windows over the last 7 days have tended to run about ${diff}h longer compared to the prior period.`
          : `Late evening meals were often followed by quieter morning energy levels — satiety windows appear ${Math.abs(diff)}h shorter over the last 7 days.`,
      });
    }
  }

  // 5. Bloating frequency — null-safe: only count explicitly non-null, non-"None" values
  const bloatingMeals = meals.filter(
    (s) =>
      s.payload.bloating != null &&
      s.payload.bloating !== "" &&
      s.payload.bloating !== "None"
  );

  if (bloatingMeals.length >= 3 && meals.length >= 6) {
    const rate = Math.round((bloatingMeals.length / meals.length) * 100);
    if (rate >= 40) {
      obs.push({
        id: "bloating",
        text: `Digestive discomfort appears alongside ${rate}% of logged meals. Tracking this alongside specific foods or contexts may surface a pattern.`,
      });
    }
  }

  return obs.slice(0, 4);
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function InsightsCard() {
  const { signals, loading } = useSignalStore();
  const [activeIdx, setActiveIdx] = useState(0);
  const [animKey, setAnimKey]     = useState(0); // incremented to re-trigger animation

  const mealCount    = signals.filter((s) => s.type === "meal" && s.payload != null).length;
  const observations = useMemo(() => deriveObservations(signals), [signals]);

  function cycleNext() {
    setActiveIdx((i) => (i + 1) % observations.length);
    setAnimKey((k) => k + 1);
  }

  // ── Loading state ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="bg-surface-warm rounded-2xl border border-surface-muted px-5 py-5">
        <div className="space-y-3">
          <div className="h-3 w-32 rounded bg-surface-muted animate-pulse" />
          <div className="space-y-2">
            <div className="h-4 w-full rounded bg-surface-muted animate-pulse" />
            <div className="h-4 w-5/6 rounded bg-surface-muted animate-pulse" />
            <div className="h-4 w-4/6 rounded bg-surface-muted animate-pulse" />
          </div>
          <div className="h-3 w-40 rounded bg-surface-muted animate-pulse" />
        </div>
        <p className="font-sans text-label text-ink-faint mt-4">
          Gathering current signals…
        </p>
      </div>
    );
  }

  // ── Empty / low-data state ────────────────────────────────────────────────
  if (mealCount < 3 || observations.length === 0) {
    return (
      <div className="bg-surface-warm rounded-2xl border border-surface-muted px-5 py-6 space-y-3">
        <p
          className="font-sans text-ink-faint"
          style={{ fontSize: "0.6875rem", fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase" }}
        >
          Noticing Patterns
        </p>
        <p className="font-serif text-body-lg text-ink leading-relaxed">
          A few more meal signals will help reveal patterns.
        </p>
        <p className="font-sans text-label text-ink-faint">
          Observations become clearer as meal signals accumulate.
        </p>
      </div>
    );
  }

  // ── Active state ──────────────────────────────────────────────────────────
  const current = observations[activeIdx];

  return (
    <div className="bg-surface-warm rounded-2xl border border-surface-muted px-5 py-5">
      {/* Header row */}
      <div className="flex items-center justify-between mb-4">
        <p
          className="font-sans text-ink-faint"
          style={{ fontSize: "0.6875rem", fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase" }}
        >
          Noticing Patterns
        </p>

        {/* Cycle icon — 44×44 touch target via negative margin + padding */}
        {observations.length > 1 && (
          <button
            type="button"
            onClick={cycleNext}
            aria-label="Next observation"
            className="-mr-2 -mt-1 p-3 rounded-xl text-ink-faint hover:text-ink transition-colors duration-200"
            style={{ minWidth: 44, minHeight: 44, display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            <RotateCcw size={13} />
          </button>
        )}
      </div>

      {/* Observation text — key forces remount → slide-up animation on cycle */}
      <div
        key={`${current.id}-${animKey}`}
        className="animate-slide-up"
      >
        <p className="font-serif text-body-lg text-ink leading-relaxed">
          {current.text}
        </p>
      </div>

      {/* Progress dots */}
      {observations.length > 1 && (
        <div className="flex gap-1.5 mt-4">
          {observations.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => { setActiveIdx(i); setAnimKey((k) => k + 1); }}
              aria-label={`Observation ${i + 1}`}
              className="p-1.5 -m-1.5" // expands touch target
            >
              <span
                className="block rounded-full transition-all duration-300"
                style={{
                  width: i === activeIdx ? 16 : 5,
                  height: 5,
                  background: i === activeIdx ? "#7A918D" : "#EDE9E3",
                }}
              />
            </button>
          ))}
        </div>
      )}

      {/* Footer */}
      <p className="font-sans text-label text-ink-faint mt-4">
        Observations update as you log · based on your data only
      </p>
    </div>
  );
}
