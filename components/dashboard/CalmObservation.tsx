"use client";

import { useEffect, useState, useCallback } from "react";
import { Eye, RefreshCw, Loader2 } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useSignalStore } from "@/store/signalStore";
import { generateInsightFn } from "@/lib/firebase/functions";

export default function CalmObservation() {
  const { user } = useAuth();
  const { signals } = useSignalStore();
  const [insight, setInsight] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generated, setGenerated] = useState(false);

  const mealCount = signals.filter((s) => s.type === "meal" && !s._optimistic).length;

  const fetchInsight = useCallback(async () => {
    if (!user || mealCount < 3) return;
    setLoading(true);
    setError(null);
    try {
      const { data } = await generateInsightFn({});
      setInsight(data.insight);
      setGenerated(true);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not generate observation."
      );
    } finally {
      setLoading(false);
    }
  }, [user, mealCount]);

  // Auto-fetch once when the user has >= 3 meals and hasn't generated yet
  useEffect(() => {
    if (!generated && mealCount >= 3) {
      fetchInsight();
    }
  }, [generated, mealCount, fetchInsight]);

  // Don't render if there aren't enough signals to say anything meaningful
  if (mealCount < 3 && !generated && !loading) return null;

  return (
    <div className="card-base border-l-4 border-accent-azure rounded-l-none">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Eye size={16} className="text-accent-azure" />
          <p className="label-caps text-accent-azure">Calm Observation</p>
        </div>
        <button
          onClick={fetchInsight}
          disabled={loading}
          className="flex items-center gap-1.5 text-ink-faint hover:text-ink transition-colors disabled:opacity-40"
          title="Refresh observation"
        >
          <RefreshCw
            size={13}
            className={loading ? "animate-spin" : ""}
          />
          <span className="font-sans text-label">refresh</span>
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center gap-3 py-2">
          <Loader2 size={15} className="text-accent-azure animate-spin shrink-0" />
          <p className="font-sans text-body-sm text-ink-light italic">
            Reading recent patterns…
          </p>
        </div>
      )}

      {/* Insight text */}
      {!loading && insight && (
        <p className="font-serif text-body-lg text-ink leading-relaxed">
          {insight}
        </p>
      )}

      {/* No insight returned */}
      {!loading && generated && !insight && !error && (
        <p className="font-sans text-body-sm text-ink-light italic">
          Not enough variation in recent signals to surface a pattern yet.
          Keep logging.
        </p>
      )}

      {/* Error */}
      {!loading && error && (
        <p className="font-sans text-body-sm text-red-500">{error}</p>
      )}

      <p className="label-caps text-ink-faint mt-4">
        Based on your last {Math.min(mealCount, 5)} logged signals
      </p>
    </div>
  );
}
