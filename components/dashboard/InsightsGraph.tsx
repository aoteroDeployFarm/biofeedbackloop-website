"use client";

import { useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { useSignalStore } from "@/store/signalStore";
import type { Signal } from "@/lib/firebase/firestore";

const PROTEIN_TARGET_DEFAULT = 120;
const ACCENT = "#4A90D9";
const ACCENT_LOW = "#93C5FD";
const MUTED = "#E5E7EB";

// ── Helpers ───────────────────────────────────────────────────────────────────

function last7Days(): string[] {
  const days: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toLocaleDateString("en-US", { weekday: "short", month: "numeric", day: "numeric" }));
  }
  return days;
}

function dayKey(date: Date): string {
  return date.toLocaleDateString("en-US", { weekday: "short", month: "numeric", day: "numeric" });
}

interface DailyProtein {
  day: string;
  shortDay: string;
  protein: number;
}

interface ProteinSatiety {
  protein: number;
  satiety: number;
}

function buildDailyProtein(signals: Signal[]): DailyProtein[] {
  const keys = last7Days();
  const buckets = new Map<string, number[]>();
  keys.forEach((k) => buckets.set(k, []));

  for (const sig of signals) {
    if (sig.type !== "meal" || !sig.timestamp || !sig.payload || sig.payload.protein_est == null) continue;
    const k = dayKey(sig.timestamp.toDate());
    if (buckets.has(k)) buckets.get(k)!.push(sig.payload.protein_est);
  }

  return keys.map((k) => {
    const vals = buckets.get(k)!;
    const total = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0)) : 0;
    const [weekday] = k.split(",");
    return { day: k, shortDay: weekday, protein: total };
  });
}

function buildScatterData(signals: Signal[]): ProteinSatiety[] {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);

  return signals
    .filter(
      (sig) =>
        sig.type === "meal" &&
        sig.timestamp &&
        sig.payload &&
        sig.timestamp.toDate() >= cutoff &&
        sig.payload.protein_est != null &&
        sig.payload.hunger_return_hrs != null
    )
    .map((sig) => ({
      protein: sig.payload.protein_est as number,
      satiety: sig.payload.hunger_return_hrs as number,
    }));
}

// ── Custom tooltip for scatter ────────────────────────────────────────────────

function ScatterTip({ active, payload }: { active?: boolean; payload?: { value: number }[] }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-surface-muted rounded-xl px-3 py-2 shadow-card">
      <p className="font-sans text-label text-ink-faint">Protein</p>
      <p className="font-sans text-body-sm text-ink font-medium">{payload[0]?.value}g</p>
      <p className="font-sans text-label text-ink-faint mt-1">Satiety</p>
      <p className="font-sans text-body-sm text-ink font-medium">{payload[1]?.value}h</p>
    </div>
  );
}

function BarTip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-surface-muted rounded-xl px-3 py-2 shadow-card">
      <p className="font-sans text-label text-ink-faint">{label}</p>
      <p className="font-sans text-body-sm text-ink font-medium">{payload[0]?.value}g protein</p>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function InsightsGraph() {
  const { signals } = useSignalStore();
  const [target, setTarget] = useState(PROTEIN_TARGET_DEFAULT);

  const dailyProtein = useMemo(() => buildDailyProtein(signals), [signals]);
  const scatterData = useMemo(() => buildScatterData(signals), [signals]);

  const hasProteinData = dailyProtein.some((d) => d.protein > 0);
  const hasScatterData = scatterData.length >= 2;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* ── Daily Protein vs Target ── */}
      <div className="bg-white rounded-3xl shadow-card border border-surface-muted p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="label-caps mb-0.5">Daily Protein</p>
            <p className="font-serif text-body-lg font-semibold text-ink">Last 7 Days</p>
          </div>
          <label className="flex flex-col items-end gap-1 shrink-0">
            <span className="label-caps text-ink-faint">Target</span>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min={40}
                max={300}
                step={5}
                value={target}
                onChange={(e) => setTarget(Number(e.target.value))}
                className="w-16 rounded-lg border border-surface-muted bg-surface-warm px-2 py-1 font-sans text-body-sm text-ink text-right focus:outline-none focus:border-accent-azure"
              />
              <span className="font-sans text-body-sm text-ink-faint">g</span>
            </div>
          </label>
        </div>

        {hasProteinData ? (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={dailyProtein} barSize={28} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke={MUTED} strokeDasharray="3 3" />
              <XAxis
                dataKey="shortDay"
                tick={{ fontFamily: "var(--font-sans)", fontSize: 11, fill: "#9CA3AF" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontFamily: "var(--font-sans)", fontSize: 11, fill: "#9CA3AF" }}
                axisLine={false}
                tickLine={false}
                unit="g"
              />
              <Tooltip content={<BarTip />} cursor={{ fill: "#F9FAFB" }} />
              <ReferenceLine
                y={target}
                stroke={ACCENT}
                strokeDasharray="4 3"
                strokeWidth={1.5}
                label={{
                  value: `${target}g goal`,
                  position: "insideTopRight",
                  fontFamily: "var(--font-sans)",
                  fontSize: 10,
                  fill: ACCENT,
                }}
              />
              <Bar dataKey="protein" radius={[6, 6, 0, 0]}>
                {dailyProtein.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={entry.protein >= target ? ACCENT : ACCENT_LOW}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <EmptyState text="Log a few meals with protein estimates to see your daily trend." />
        )}

        <p className="font-sans text-label text-ink-faint">
          Bars in blue = at or above target · Light blue = below target
        </p>
      </div>

      {/* ── Protein vs Satiety Scatter ── */}
      <div className="bg-white rounded-3xl shadow-card border border-surface-muted p-6 space-y-4">
        <div>
          <p className="label-caps mb-0.5">Protein · Satiety Correlation</p>
          <p className="font-serif text-body-lg font-semibold text-ink">Last 7 Days</p>
        </div>

        {hasScatterData ? (
          <ResponsiveContainer width="100%" height={200}>
            <ScatterChart margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid stroke={MUTED} strokeDasharray="3 3" />
              <XAxis
                dataKey="protein"
                type="number"
                name="Protein"
                unit="g"
                tick={{ fontFamily: "var(--font-sans)", fontSize: 11, fill: "#9CA3AF" }}
                axisLine={false}
                tickLine={false}
                label={{
                  value: "Protein (g)",
                  position: "insideBottom",
                  offset: -2,
                  fontFamily: "var(--font-sans)",
                  fontSize: 10,
                  fill: "#9CA3AF",
                }}
              />
              <YAxis
                dataKey="satiety"
                type="number"
                name="Satiety"
                unit="h"
                tick={{ fontFamily: "var(--font-sans)", fontSize: 11, fill: "#9CA3AF" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<ScatterTip />} cursor={{ strokeDasharray: "3 3" }} />
              <Scatter data={scatterData} fill={ACCENT} fillOpacity={0.75} />
            </ScatterChart>
          </ResponsiveContainer>
        ) : (
          <EmptyState text="Log at least 2 meals with both protein estimates and hunger return times to see this pattern." />
        )}

        <p className="font-sans text-label text-ink-faint">
          Each dot = one meal · Higher right = more protein, longer satiety
        </p>
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="h-[200px] flex items-center justify-center rounded-2xl bg-surface-warm border border-dashed border-surface-muted">
      <p className="font-sans text-body-sm text-ink-faint text-center max-w-[220px]">{text}</p>
    </div>
  );
}
