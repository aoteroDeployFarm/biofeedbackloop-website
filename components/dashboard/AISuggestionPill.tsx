"use client";

import { Zap, Check, X, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ParseMealResult } from "@/lib/firebase/functions";

interface AISuggestionPillProps {
  result: ParseMealResult | null;
  loading: boolean;
  error: string | null;
  onAccept: (result: ParseMealResult) => void;
  onDismiss: () => void;
}

const confidenceColor: Record<string, string> = {
  high: "text-accent-azure",
  medium: "text-ink-light",
  low: "text-ink-faint",
};

const satietyLabel: Record<number, string> = {
  1: "~1–1.5 hrs",
  2: "~1.5–2.5 hrs",
  3: "~2.5–3.5 hrs",
  4: "~3.5+ hrs",
};

export default function AISuggestionPill({
  result,
  loading,
  error,
  onAccept,
  onDismiss,
}: AISuggestionPillProps) {
  if (!loading && !result && !error) return null;

  return (
    <div
      className={cn(
        "rounded-2xl border p-4 transition-all duration-200",
        loading && "bg-surface-warm border-surface-muted",
        result && "bg-accent-azure/5 border-accent-azure/25",
        error && "bg-red-50 border-red-100"
      )}
    >
      {/* Loading state */}
      {loading && (
        <div className="flex items-center gap-3">
          <Loader2 size={16} className="text-accent-azure animate-spin shrink-0" />
          <p className="font-sans text-body-sm text-ink-light">
            Estimating nutritional profile…
          </p>
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div className="flex items-start gap-2">
          <AlertCircle size={15} className="text-red-400 mt-0.5 shrink-0" />
          <p className="font-sans text-body-sm text-red-600 flex-1">{error}</p>
          <button onClick={onDismiss} className="text-ink-faint hover:text-ink ml-2">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Result state */}
      {!loading && result && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Zap size={14} className="text-accent-azure" />
              <p className="label-caps text-accent-azure">AI Estimate</p>
              <span
                className={cn(
                  "label-caps",
                  confidenceColor[result.confidence] ?? "text-ink-faint"
                )}
              >
                · {result.confidence} confidence
              </span>
            </div>
            <button
              onClick={onDismiss}
              className="text-ink-faint hover:text-ink transition-colors"
              aria-label="Dismiss"
            >
              <X size={14} />
            </button>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="text-center">
              <p className="font-sans text-base font-semibold text-ink">
                ~{result.protein_grams}g
              </p>
              <p className="label-caps text-ink-faint">protein</p>
            </div>
            <div className="text-center">
              <p className="font-sans text-base font-semibold text-ink">
                {result.calorie_range_low}–{result.calorie_range_high}
              </p>
              <p className="label-caps text-ink-faint">kcal range</p>
            </div>
            <div className="text-center">
              <p className="font-sans text-base font-semibold text-ink">
                {satietyLabel[result.satiety_potential]}
              </p>
              <p className="label-caps text-ink-faint">satiety est.</p>
            </div>
          </div>

          <p className="font-sans text-body-sm text-ink-faint mb-3">
            These are estimates. Accept to pre-fill the protein field — adjust anytime.
          </p>

          <button
            onClick={() => onAccept(result)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-accent-azure/10 border border-accent-azure/25 text-accent-azure font-sans text-body-sm hover:bg-accent-azure/20 transition-colors"
          >
            <Check size={14} />
            Accept estimate
          </button>
        </div>
      )}
    </div>
  );
}
