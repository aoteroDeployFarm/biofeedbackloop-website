"use client";

import { useState } from "react";
import { Clock, Plus, ChevronDown, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth/AuthProvider";
import { useSignalStore } from "@/store/signalStore";
import {
  mapSatietyLabel,
  mapHungerReturn,
  mapEnergyLevel,
  type SatietyScore,
} from "@/lib/firebase/firestore";
import {
  parseMealFn,
  SATIETY_LABELS,
  type ParseMealResult,
} from "@/lib/firebase/functions";
import AISuggestionPill from "./AISuggestionPill";

type SatietyLevel = "light" | "satisfied" | "full" | "stuffed";

// Module-level — no component state dependency.
// Must be defined BEFORE any useState call that uses it as an initializer,
// otherwise the lazy initializer hits the TDZ and throws in production.
function currentTime(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

interface FormState {
  foods: string;
  time: string;
  portion: string;
  satiety: SatietyLevel | "";
  hungerReturn: string;
  energyLevel: string;
  bloating: string;
  proteinEst: string;
  costEst: string;
}

const satietyOptions: { value: SatietyLevel; label: string; description: string }[] = [
  { value: "light", label: "Light", description: "Could eat more" },
  { value: "satisfied", label: "Satisfied", description: "Comfortable, done" },
  { value: "full", label: "Full", description: "Stomach noticeably full" },
  { value: "stuffed", label: "Stuffed", description: "Uncomfortable fullness" },
];

const portionOptions = ["Small", "Medium", "Large", "Extra Large"];
const energyOptions = ["Low", "Moderate", "Steady", "High"];
const hungerOptions = ["1 hr", "2 hrs", "3 hrs", "4 hrs", "4+ hrs", "Not tracked"];
const bloatingOptions = ["None", "Mild", "Moderate", "Notable"];

// time is seeded at runtime — see useState initializer in the component
const defaultForm: Omit<FormState, "time"> = {
  foods: "",
  portion: "Medium",   // pre-selected; user can override
  satiety: "",
  hungerReturn: "",
  energyLevel: "",
  bloating: "",
  proteinEst: "",
  costEst: "",
};

function SelectPill({ options, value, onChange }: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt === value ? "" : opt)}
          className={cn(
            "px-3 py-1.5 rounded-lg text-body-sm font-sans border transition-all duration-150",
            value === opt
              ? "bg-ink text-canvas border-ink"
              : "bg-white text-ink-light border-surface-muted hover:border-accent-azure hover:text-accent-azure"
          )}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <label className="label-caps block">{label}</label>
      {children}
    </div>
  );
}

export default function SignalInput() {
  const { user } = useAuth();
  const { addSignal } = useSignalStore();
  const [form, setForm] = useState<FormState>(() => ({ ...defaultForm, time: currentTime() }));
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(true);

  // AI analysis state
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<ParseMealResult | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  // Snapshot of the time when this form instance was mounted — used as the default
  const [mountTime] = useState<string>(() => currentTime());

  async function analyzeWithAI() {
    if (!form.foods.trim() || form.foods.trim().length < 5 || !user) return;
    setAiLoading(true);
    setAiResult(null);
    setAiError(null);
    try {
      const { data } = await parseMealFn({ description: form.foods.trim() });
      setAiResult(data);
    } catch (e) {
      const raw = e instanceof Error ? e.message : "";
      // Firebase callable errors surface as "FirebaseError: ... (functions/code)" or with a message property
      const friendly =
        raw.includes("failed-precondition") || raw.includes("Vertex AI")
          ? "AI estimation is being configured — it will be available shortly. Continue logging manually."
          : raw.includes("unauthenticated")
          ? "Sign in to use AI estimation."
          : raw.includes("internal") || raw === ""
          ? "AI analysis unavailable right now. Continue logging manually."
          : raw;
      setAiError(friendly);
    } finally {
      setAiLoading(false);
    }
  }

  function handleAcceptAI(result: ParseMealResult) {
    setForm((prev) => ({
      ...prev,
      proteinEst: String(result.protein_grams),
      satiety: (SATIETY_LABELS[result.satiety_potential] as SatietyLevel) || prev.satiety,
    }));
    setAiResult(null);
  }

  function handleDismissAI() {
    setAiResult(null);
    setAiError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !form.foods) return;
    setSaving(true);
    await addSignal(user.uid, "meal", {
      foods: form.foods,
      satiety: form.satiety ? (mapSatietyLabel(form.satiety) as SatietyScore) : null,
      portion: form.portion || null,
      hunger_return_hrs: form.hungerReturn && form.hungerReturn !== "Not tracked"
        ? mapHungerReturn(form.hungerReturn)
        : null,
      energy_level: form.energyLevel ? mapEnergyLevel(form.energyLevel) : null,
      bloating: form.bloating || null,
      protein_est: form.proteinEst ? parseFloat(form.proteinEst) : null,
      cost_est: form.costEst ? parseFloat(form.costEst) : null,
      notes: null,
    });
    setSaving(false);
    setSubmitted(true);
    setForm({ ...defaultForm, time: currentTime() });
    setAiResult(null);
    setAiError(null);
    setTimeout(() => setSubmitted(false), 3000);
  }

  return (
    <div className="bg-white rounded-3xl shadow-card border border-surface-muted overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-6 text-left hover:bg-surface-warm transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-accent-azure/10 flex items-center justify-center">
            <Plus size={16} className="text-accent-azure" />
          </div>
          <div>
            <p className="font-serif text-body-lg font-semibold text-ink">Log a Meal Signal</p>
            <p className="font-sans text-body-sm text-ink-light">Capture what happened, not what should have.</p>
          </div>
        </div>
        <ChevronDown
          size={18}
          className={cn("text-ink-faint transition-transform duration-200", expanded ? "rotate-180" : "rotate-0")}
        />
      </button>

      {expanded && (
        <form onSubmit={handleSubmit} className="p-6 pt-0 space-y-6 border-t border-surface-muted">
          {/* Foods + time */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
            <div className="sm:col-span-2">
              <Field label="Foods eaten">
                <textarea
                  rows={2}
                  value={form.foods}
                  onChange={(e) => setForm({ ...form, foods: e.target.value })}
                  placeholder="Turkey sandwich, Greek yogurt, sparkling water…"
                  className="w-full rounded-xl border border-surface-muted bg-surface-warm px-4 py-3 font-sans text-body-sm text-ink placeholder:text-ink-faint focus:outline-none focus:border-accent-azure resize-none"
                />
              </Field>
            </div>
            <div className="space-y-2">
              <div className="space-y-0.5">
                <label className="label-caps block">Time</label>
                <p className="font-sans text-label text-ink-faint">
                  Defaults to now · update if logging later
                </p>
              </div>
              <div className="flex gap-2">
                <input
                  type="time"
                  value={form.time}
                  onChange={(e) => setForm({ ...form, time: e.target.value })}
                  className="flex-1 rounded-xl border border-surface-muted bg-surface-warm px-4 py-3 font-sans text-body-sm text-ink focus:outline-none focus:border-accent-azure"
                />
                <button
                  type="button"
                  onClick={() => setForm({ ...form, time: currentTime() })}
                  className={cn(
                    "p-3 rounded-xl border transition-colors",
                    form.time !== mountTime
                      ? "border-accent-azure/40 bg-accent-azure/8 text-accent-azure hover:border-accent-azure"
                      : "border-surface-muted bg-surface-warm text-ink-faint hover:text-accent-azure hover:border-accent-azure"
                  )}
                  title="Reset to current time"
                >
                  <Clock size={16} />
                </button>
              </div>
            </div>
          </div>

          {/* AI analysis button */}
          <button
            type="button"
            onClick={analyzeWithAI}
            disabled={!form.foods.trim() || form.foods.trim().length < 5 || aiLoading || !user}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 rounded-xl border font-sans text-body-sm transition-all duration-150",
              form.foods.trim().length >= 5 && !aiLoading && user
                ? "border-accent-azure/30 text-accent-azure hover:bg-accent-azure/8 hover:border-accent-azure/60"
                : "border-surface-muted text-ink-faint cursor-not-allowed opacity-50"
            )}
          >
            <Sparkles size={14} />
            {aiLoading ? "Analyzing…" : "Estimate with AI"}
          </button>

          {/* AI suggestion pill */}
          <AISuggestionPill
            result={aiResult}
            loading={aiLoading}
            error={aiError}
            onAccept={handleAcceptAI}
            onDismiss={handleDismissAI}
          />

          <Field label="Portion size (estimate)">
            <SelectPill options={portionOptions} value={form.portion} onChange={(v) => setForm({ ...form, portion: v })} />
          </Field>

          {/* Protein + cost */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Protein est. (g)">
              <input
                type="number"
                min="0"
                max="200"
                step="1"
                value={form.proteinEst}
                onChange={(e) => setForm({ ...form, proteinEst: e.target.value })}
                placeholder="e.g. 34"
                className="w-full rounded-xl border border-surface-muted bg-surface-warm px-4 py-3 font-sans text-body-sm text-ink placeholder:text-ink-faint focus:outline-none focus:border-accent-azure"
              />
            </Field>
            <Field label="Cost est. ($)">
              <input
                type="number"
                min="0"
                max="999"
                step="0.01"
                value={form.costEst}
                onChange={(e) => setForm({ ...form, costEst: e.target.value })}
                placeholder="e.g. 2.40"
                className="w-full rounded-xl border border-surface-muted bg-surface-warm px-4 py-3 font-sans text-body-sm text-ink placeholder:text-ink-faint focus:outline-none focus:border-accent-azure"
              />
            </Field>
          </div>

          {/* Satiety */}
          <Field label="Satiety at end of meal">
            <div className="grid grid-cols-2 gap-2">
              {satietyOptions.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setForm({ ...form, satiety: form.satiety === s.value ? "" : s.value })}
                  className={cn(
                    "text-left p-3 rounded-xl border transition-all duration-150",
                    form.satiety === s.value
                      ? "bg-accent-azure/10 border-accent-azure text-ink"
                      : "bg-white border-surface-muted text-ink-light hover:border-accent-azure/50"
                  )}
                >
                  <p className="font-sans text-body-sm font-medium">{s.label}</p>
                  <p className="font-sans text-label text-ink-faint mt-0.5">{s.description}</p>
                </button>
              ))}
            </div>
          </Field>

          {/* Feedback row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 pt-2 border-t border-surface-muted">
            <Field label="Hunger return">
              <SelectPill options={hungerOptions} value={form.hungerReturn} onChange={(v) => setForm({ ...form, hungerReturn: v })} />
            </Field>
            <Field label="Energy 90 min later">
              <SelectPill options={energyOptions} value={form.energyLevel} onChange={(v) => setForm({ ...form, energyLevel: v })} />
            </Field>
            <Field label="Bloating / discomfort">
              <SelectPill options={bloatingOptions} value={form.bloating} onChange={(v) => setForm({ ...form, bloating: v })} />
            </Field>
          </div>

          {/* Submit */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={!form.foods || saving || !user}
              className={cn("btn-primary", (!form.foods || saving || !user) && "opacity-40 cursor-not-allowed")}
            >
              {saving ? "Saving…" : submitted ? "Signal logged." : "Save Signal"}
            </button>
            {submitted && (
              <p className="font-sans text-body-sm text-accent-azure animate-fade-in">
                Observation recorded. No judgment attached.
              </p>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
