"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { useSignalStore, buildChartData } from "@/store/signalStore";

// Sample data shown when the user has no logs yet
const SAMPLE_DATA = [
  { day: "Mon", satietyHours: 3.2, energyScore: 6, proteinG: 28 },
  { day: "Tue", satietyHours: 4.1, energyScore: 8, proteinG: 42 },
  { day: "Wed", satietyHours: 2.8, energyScore: 5, proteinG: 18 },
  { day: "Thu", satietyHours: 4.4, energyScore: 9, proteinG: 48 },
  { day: "Fri", satietyHours: 3.9, energyScore: 7, proteinG: 36 },
  { day: "Sat", satietyHours: 4.2, energyScore: 8, proteinG: 44 },
  { day: "Sun", satietyHours: 3.6, energyScore: 7, proteinG: 32 },
];

const CustomTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-surface-muted rounded-xl shadow-card p-3 text-body-sm">
      <p className="font-sans font-medium text-ink mb-2">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full inline-block" style={{ background: p.color }} />
          <span className="text-ink-light font-sans">{p.name}:</span>
          <span className="font-semibold text-ink font-sans">{p.value}</span>
        </div>
      ))}
    </div>
  );
};

export default function TrendChart() {
  const { signals, loading } = useSignalStore();

  const liveData = buildChartData(signals);
  const isSample = liveData.length === 0;
  const chartData = isSample ? SAMPLE_DATA : liveData;

  return (
    <div className="card-base h-full">
      <div className="mb-5">
        <div className="flex items-center justify-between gap-2 mb-1">
          <p className="label-caps text-ink-faint">
            {isSample ? "Sample Data" : "Your 14-Day Pattern"}
          </p>
          {loading && (
            <div className="w-4 h-4 rounded-full border border-accent-azure border-t-transparent animate-spin" />
          )}
        </div>
        <h3 className="font-serif text-heading-2 text-ink">
          Satiety Duration vs. Protein
        </h3>
        <p className="font-sans text-body-sm text-ink-light mt-1">
          {isSample
            ? "Log meals to see your actual patterns here."
            : "Averaged by day · hover for details."}
        </p>
      </div>

      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -24 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#EDE9E3" />
          <XAxis
            dataKey="day"
            tick={{ fontSize: 11, fill: "#999", fontFamily: "var(--font-inter)" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#999", fontFamily: "var(--font-inter)" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: "11px", fontFamily: "var(--font-inter)", color: "#666" }}
          />
          <Line
            type="monotone"
            dataKey="satietyHours"
            name="Satiety (hrs)"
            stroke="#7A918D"
            strokeWidth={2.5}
            connectNulls
            dot={{ r: 4, fill: "#7A918D", strokeWidth: 0 }}
            activeDot={{ r: 6 }}
          />
          <Line
            type="monotone"
            dataKey="energyScore"
            name="Energy (1–10)"
            stroke="#D4A373"
            strokeWidth={2.5}
            connectNulls
            strokeDasharray="5 3"
            dot={{ r: 4, fill: "#D4A373", strokeWidth: 0 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>

      {/* Pattern callout */}
      <div className="mt-4 p-3 rounded-xl bg-accent-azure/8 border border-accent-azure/15">
        <p className="font-sans text-body-sm text-accent-azure">
          {isSample ? (
            <>
              <span className="font-semibold">Sample pattern:</span> Days with protein above 40g
              show satiety windows 35% longer. Your data will appear here as you log.
            </>
          ) : (
            <>
              <span className="font-semibold">Live data:</span> Patterns shown are averages from
              your last 14 days of logged signals.
            </>
          )}
        </p>
      </div>
    </div>
  );
}
