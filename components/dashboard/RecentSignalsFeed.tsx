"use client";

import { useSignalStore } from "@/store/signalStore";
import { Clock, Zap, Utensils, Dumbbell } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Signal } from "@/lib/firebase/firestore";

const satietyLabels: Record<number, string> = {
  1: "Light",
  2: "Satisfied",
  3: "Full",
  4: "Stuffed",
};

const energyLabels: Record<number, string> = {
  1: "Low", 2: "Low", 3: "Low",
  4: "Moderate", 5: "Moderate", 6: "Moderate",
  7: "Steady", 8: "Steady",
  9: "High", 10: "High",
};

function SignalCard({ signal }: { signal: Signal }) {
  const isOptimistic = signal._optimistic;
  const time = signal.timestamp
    ? signal.timestamp.toDate().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    : "Saving…";

  return (
    <div
      className={cn(
        "card-base flex gap-4 transition-opacity",
        isOptimistic && "opacity-60"
      )}
    >
      <div className="w-9 h-9 rounded-xl bg-accent-amber/10 flex items-center justify-center shrink-0">
        <Utensils size={16} className="text-accent-amber" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-1">
          <p className="font-sans text-body-sm font-medium text-ink truncate">
            {signal.payload.foods || "Meal logged"}
          </p>
          <span className="label-caps text-ink-faint whitespace-nowrap flex items-center gap-1">
            <Clock size={10} />
            {time}
          </span>
        </div>

        <div className="flex flex-wrap gap-3">
          {signal.payload.satiety != null && (
            <span className="label-caps text-accent-azure">
              Satiety: {satietyLabels[signal.payload.satiety]}
            </span>
          )}
          {signal.payload.energy_level != null && (
            <span className="label-caps text-accent-amber flex items-center gap-1">
              <Zap size={9} />
              Energy: {energyLabels[signal.payload.energy_level] ?? signal.payload.energy_level}
            </span>
          )}
          {signal.payload.protein_est != null && (
            <span className="label-caps text-ink-faint flex items-center gap-1">
              <Dumbbell size={9} />
              {signal.payload.protein_est}g protein
            </span>
          )}
          {signal.payload.hunger_return_hrs != null && (
            <span className="label-caps text-ink-faint">
              Satiety: {signal.payload.hunger_return_hrs}h
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function RecentSignalsFeed() {
  const { signals, loading } = useSignalStore();
  const meals = signals.filter((s) => s.type === "meal").slice(0, 20);

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 rounded-2xl bg-surface-muted animate-pulse" />
        ))}
      </div>
    );
  }

  if (!meals.length) {
    return (
      <div className="card-base text-center py-12">
        <p className="label-caps mb-2">No signals yet</p>
        <p className="font-sans text-body-sm text-ink-light">
          Log your first meal above. Patterns take a few days to surface.
        </p>
      </div>
    );
  }

  return (
    <div>
      <p className="label-caps mb-4">Recent Observations</p>
      <div className="space-y-3">
        {meals.map((s) => (
          <SignalCard key={s.id} signal={s} />
        ))}
      </div>
    </div>
  );
}
