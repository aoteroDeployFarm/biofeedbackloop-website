"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, query, where, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import ReflectionCard, { type ExperimentDoc } from "./ReflectionCard";

function SkeletonCard() {
  return (
    <div className="card-base flex flex-col gap-5 animate-pulse">
      <div className="flex items-start justify-between gap-4">
        <div className="h-6 w-28 rounded-full bg-surface-muted" />
        <div className="h-4 w-16 rounded bg-surface-muted" />
      </div>
      <div className="h-6 w-3/4 rounded bg-surface-muted" />
      <div className="space-y-2">
        <div className="h-3 w-16 rounded bg-surface-muted" />
        <div className="h-4 w-full rounded bg-surface-muted" />
        <div className="h-4 w-5/6 rounded bg-surface-muted" />
      </div>
      <div className="border-t border-surface-muted" />
      <div className="space-y-2">
        <div className="h-3 w-20 rounded bg-surface-muted" />
        <div className="h-4 w-full rounded bg-surface-muted" />
        <div className="h-4 w-4/5 rounded bg-surface-muted" />
        <div className="h-4 w-3/5 rounded bg-surface-muted" />
      </div>
    </div>
  );
}

export default function ExperimentsTimeline() {
  const [docs, setDocs] = useState<ExperimentDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = query(
      collection(db, "founder_experiments"),
      where("published", "==", true),
      orderBy("order", "asc")
    );

    getDocs(q)
      .then((snap) => {
        const results: ExperimentDoc[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<ExperimentDoc, "id">),
        }));
        setDocs(results);
      })
      .catch((err) => {
        console.error("ExperimentsTimeline:", err);
        setError("Could not load experiments. Please try again later.");
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <section className="section-spacer">
      <div className="container-site">
        <div className="max-w-prose mx-auto text-center mb-14">
          <p className="label-caps mb-4">Documented Experiments</p>
          <h2 className="font-serif text-heading-1 text-ink mb-4 leading-tight">
            What the data actually showed
          </h2>
          <p className="font-sans text-body-md text-ink-light leading-relaxed">
            Each card is a timestamped experiment — a specific observation and the
            pattern it revealed. Not conclusions. Starting points.
          </p>
        </div>

        {error && (
          <div className="max-w-prose mx-auto p-4 rounded-xl bg-red-50 border border-red-100 text-center">
            <p className="font-sans text-body-sm text-red-600">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {loading
            ? Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
            : docs.map((doc) => <ReflectionCard key={doc.id} doc={doc} />)}
        </div>

        {!loading && docs.length === 0 && !error && (
          <p className="text-center font-sans text-body-sm text-ink-faint mt-8">
            No experiments published yet.
          </p>
        )}
      </div>
    </section>
  );
}
