"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { DollarSign, Zap, Clock, TrendingUp } from "lucide-react";

interface PriceIndexDoc {
  id: string;
  name: string;
  category: string;
  protein_g: number;
  cost_usd: number;
  serving_desc: string;
  satiety_hrs_est: number;
}

interface RankedItem extends PriceIndexDoc {
  protein_per_dollar: number;
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 p-4 rounded-xl bg-surface-warm animate-pulse">
      <div className="w-6 h-6 rounded-full bg-surface-muted shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-40 rounded bg-surface-muted" />
        <div className="h-3 w-24 rounded bg-surface-muted" />
      </div>
      <div className="text-right space-y-1">
        <div className="h-5 w-16 rounded bg-surface-muted ml-auto" />
        <div className="h-3 w-12 rounded bg-surface-muted ml-auto" />
      </div>
    </div>
  );
}

function RankBadge({ rank }: { rank: number }) {
  const colors: Record<number, string> = {
    1: "bg-accent-azure text-canvas",
    2: "bg-accent-azure/70 text-canvas",
    3: "bg-accent-azure/40 text-ink",
  };
  const cls = colors[rank] ?? "bg-surface-muted text-ink-faint";
  return (
    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${cls}`}>
      {rank}
    </div>
  );
}

export default function ProteinCalculator() {
  const [items, setItems] = useState<RankedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [maxCost, setMaxCost] = useState(3.00);

  useEffect(() => {
    const q = query(collection(db, "price_index"), orderBy("cost_usd", "asc"));
    getDocs(q)
      .then((snap) => {
        const raw: PriceIndexDoc[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<PriceIndexDoc, "id">),
        }));
        const ranked: RankedItem[] = raw
          .map((item) => ({
            ...item,
            protein_per_dollar: item.protein_g / item.cost_usd,
          }))
          .sort((a, b) => b.protein_per_dollar - a.protein_per_dollar);
        setItems(ranked);
      })
      .catch((err) => {
        console.error("ProteinCalculator:", err);
        setError("Could not load price index.");
      })
      .finally(() => setLoading(false));
  }, []);

  const filtered = items.filter((item) => item.cost_usd <= maxCost);

  return (
    <section className="section-spacer bg-surface-warm">
      <div className="container-site">
        <div className="max-w-prose mx-auto text-center mb-14">
          <p className="label-caps mb-4">Protein Economics</p>
          <h2 className="font-serif text-heading-1 text-ink mb-4 leading-tight">
            Protein Per Dollar
          </h2>
          <p className="font-sans text-body-md text-ink-light leading-relaxed">
            Ranked by grams of protein per dollar spent. A useful signal for
            building satiety windows without excess cost. Filter by what you
            want to spend per serving.
          </p>
        </div>

        {/* Cost filter */}
        <div className="max-w-sm mx-auto mb-10 space-y-3">
          <div className="flex items-center justify-between">
            <label className="label-caps">Max cost per serving</label>
            <span className="font-serif text-body-lg font-semibold text-ink">
              ${maxCost.toFixed(2)}
            </span>
          </div>
          <input
            type="range"
            min="0.50"
            max="5.00"
            step="0.10"
            value={maxCost}
            onChange={(e) => setMaxCost(parseFloat(e.target.value))}
            className="w-full accent-[#3B82F6]"
          />
          <div className="flex justify-between">
            <span className="label-caps text-ink-faint">$0.50</span>
            <span className="label-caps text-ink-faint">$5.00</span>
          </div>
        </div>

        {error && (
          <div className="max-w-prose mx-auto p-4 rounded-xl bg-red-50 border border-red-100 text-center mb-8">
            <p className="font-sans text-body-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Ranked list */}
        <div className="max-w-2xl mx-auto space-y-3">
          {loading
            ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
            : filtered.length === 0
            ? (
              <p className="text-center font-sans text-body-sm text-ink-faint py-8">
                No items under ${maxCost.toFixed(2)} per serving.
              </p>
            )
            : filtered.map((item, i) => (
              <div
                key={item.id}
                className="flex items-center gap-4 p-4 rounded-xl bg-white border border-surface-muted shadow-card hover:shadow-card-hover transition-shadow"
              >
                <RankBadge rank={i + 1} />

                <div className="flex-1 min-w-0">
                  <p className="font-sans text-body-sm font-semibold text-ink truncate">{item.name}</p>
                  <p className="font-sans text-label text-ink-faint">{item.serving_desc} · {item.category}</p>
                </div>

                {/* Stats */}
                <div className="hidden sm:flex items-center gap-5 text-right">
                  <div className="flex flex-col items-center gap-0.5">
                    <Zap size={12} className="text-accent-azure" />
                    <p className="font-sans text-body-sm font-semibold text-ink">{item.protein_g}g</p>
                    <p className="label-caps text-ink-faint" style={{ fontSize: "9px" }}>protein</p>
                  </div>
                  <div className="flex flex-col items-center gap-0.5">
                    <DollarSign size={12} className="text-accent-amber" />
                    <p className="font-sans text-body-sm font-semibold text-ink">${item.cost_usd.toFixed(2)}</p>
                    <p className="label-caps text-ink-faint" style={{ fontSize: "9px" }}>cost</p>
                  </div>
                  <div className="flex flex-col items-center gap-0.5">
                    <Clock size={12} className="text-ink-faint" />
                    <p className="font-sans text-body-sm font-semibold text-ink">{item.satiety_hrs_est}h</p>
                    <p className="label-caps text-ink-faint" style={{ fontSize: "9px" }}>satiety</p>
                  </div>
                </div>

                {/* Protein/$ highlight */}
                <div className="text-right shrink-0">
                  <div className="flex items-center gap-1 justify-end mb-0.5">
                    <TrendingUp size={12} className="text-accent-azure" />
                    <p className="font-sans text-body-sm font-bold text-ink">
                      {item.protein_per_dollar.toFixed(1)}g/$
                    </p>
                  </div>
                  <p className="label-caps text-ink-faint" style={{ fontSize: "9px" }}>per dollar</p>
                </div>
              </div>
            ))}
        </div>

        {/* Context note */}
        {!loading && filtered.length > 0 && (
          <div className="max-w-prose mx-auto mt-12 p-6 rounded-2xl border border-surface-muted bg-white text-center">
            <p className="font-sans text-body-sm text-ink-light leading-relaxed">
              Rankings are based on protein density and cost per serving, not overall
              nutritional completeness. Use this as one signal among many — your body&rsquo;s
              response to specific foods is always more relevant than the index.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
