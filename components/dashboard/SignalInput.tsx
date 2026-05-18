"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Clock, ChevronDown, Mic, Loader2 } from "lucide-react";
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
  transcribeMealFn,
  SATIETY_LABELS,
  type ParseMealResult,
} from "@/lib/firebase/functions";

// ── Module-level helpers (defined before any useState that calls them) ────────

type SatietyLevel = "light" | "satisfied" | "full" | "stuffed";

function currentTime(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const PROCESSING_STEPS = [
  "Encoding audio signatures…",
  "Analyzing voice tokens with Gemini…",
  "Extracting meal metrics & structure…",
  "Polishing timeline alignment…",
] as const;

const MEAL_TYPES = ["Breakfast", "Lunch", "Dinner", "Snack"] as const;

const CONTEXT_TAGS = [
  "Ate fast", "Ate out", "Social meal", "Stress eating", "Post-workout",
] as const;

const SATIETY_OPTIONS: { value: SatietyLevel; label: string; sub: string }[] = [
  { value: "light",     label: "Light",     sub: "Could eat more" },
  { value: "satisfied", label: "Satisfied", sub: "Comfortable, done" },
  { value: "full",      label: "Full",      sub: "Noticeably full" },
  { value: "stuffed",   label: "Stuffed",   sub: "Uncomfortable" },
];

const PORTION_OPTIONS = ["Small", "Medium", "Large", "Extra Large"];
const ENERGY_OPTIONS  = ["Low", "Moderate", "Steady", "High"];
const HUNGER_OPTIONS  = ["1 hr", "2 hrs", "3 hrs", "4 hrs", "4+ hrs", "Not tracked"];
const BLOATING_OPTIONS = ["None", "Mild", "Moderate", "Notable"];

// ── Form state ────────────────────────────────────────────────────────────────

interface FormState {
  foods: string;
  satiety: SatietyLevel | "";
  // drawer fields
  time: string;
  mealType: string;
  contextTags: string[];
  portion: string;
  proteinEst: string;
  costEst: string;
  hungerReturn: string;
  energyLevel: string;
  bloating: string;
}

const defaultForm: Omit<FormState, "time"> = {
  foods: "",
  satiety: "",
  mealType: "",
  contextTags: [],
  portion: "Medium",
  proteinEst: "",
  costEst: "",
  hungerReturn: "",
  energyLevel: "",
  bloating: "",
};

// ── Sub-components ────────────────────────────────────────────────────────────

function Pill({
  label, active, onClick,
}: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-3 py-1.5 rounded-lg font-sans text-body-sm border transition-all duration-150 shrink-0",
        active
          ? "bg-ink text-canvas border-ink"
          : "bg-white text-ink-light border-surface-muted hover:border-ink/30 hover:text-ink"
      )}
    >
      {label}
    </button>
  );
}

function FieldLabel({ label, hint }: { label: string; hint?: string }) {
  return (
    <div className="space-y-0.5 mb-2">
      <p className="label-caps">{label}</p>
      {hint && <p className="font-sans text-label text-ink-faint">{hint}</p>}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function SignalInput() {
  const { user } = useAuth();
  const { addSignal } = useSignalStore();

  const [form, setForm]       = useState<FormState>(() => ({ ...defaultForm, time: currentTime() }));
  const [saving, setSaving]   = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // AI state — silent background analysis
  const [aiLoading, setAiLoading]   = useState(false);
  const [aiApplied, setAiApplied]   = useState(false); // shows "Signals estimated" hint
  const aiTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Voice recording state ────────────────────────────────────────────────
  type VoiceState = "idle" | "recording" | "processing";
  const [voiceState, setVoiceState]     = useState<VoiceState>("idle");
  const [voiceError, setVoiceError]     = useState<string | null>(null);
  const [micSupported, setMicSupported] = useState(false);
  const [processingStep, setProcessingStep] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef   = useRef<Blob[]>([]);
  const streamRef        = useRef<MediaStream | null>(null);
  const capTimerRef      = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Detect browser support after mount (avoids SSR mismatch)
  useEffect(() => {
    setMicSupported(
      typeof navigator !== "undefined" &&
      !!navigator.mediaDevices?.getUserMedia &&
      typeof MediaRecorder !== "undefined"
    );
  }, []);

  // Advance processing step label every 2.5 s while transcription is in flight
  useEffect(() => {
    if (voiceState !== "processing") {
      setProcessingStep(0);
      return;
    }
    const id = setInterval(() => {
      setProcessingStep((s) => Math.min(s + 1, PROCESSING_STEPS.length - 1));
    }, 2500);
    return () => clearInterval(id);
  }, [voiceState]);

  function showVoiceError(msg: string) {
    setVoiceError(msg);
    setTimeout(() => setVoiceError(null), 4500);
  }

  function stopStream() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  /** Convert a Blob to a raw base64 string (no data-URI prefix). */
  function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUri = reader.result as string;
        resolve(dataUri.split(",")[1] ?? "");
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  /** Best MIME type the current browser can record. */
  function getAudioMimeType(): string {
    const candidates = ["audio/webm", "audio/mp4", "audio/mpeg", "audio/ogg"];
    return candidates.find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
  }

  async function processAudio(mimeType: string) {
    setVoiceState("processing");
    try {
      const blob    = new Blob(audioChunksRef.current, { type: mimeType });
      const base64  = await blobToBase64(blob);
      const { data } = await transcribeMealFn({ audio: base64, mimeType });
      if (data.text?.trim()) {
        setForm((prev) => ({ ...prev, foods: data.text.trim() }));
        setAiApplied(false); // reset so the new text re-triggers AI analysis
      } else {
        showVoiceError("Voice signal unreadable. Try typing instead.");
      }
    } catch {
      showVoiceError("Voice signal unreadable. Try typing instead.");
    } finally {
      audioChunksRef.current = [];
      setVoiceState("idle");
    }
  }

  async function startRecording() {
    if (!user) return;
    try {
      const stream   = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = getAudioMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current   = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stopStream();
        processAudio(mimeType || "audio/webm");
      };

      recorder.start(250); // collect in 250 ms chunks for smooth stop
      setVoiceState("recording");

      // Hard 30-second cap
      capTimerRef.current = setTimeout(() => stopRecording(), 30_000);
    } catch {
      showVoiceError("Mic access denied. Try typing instead.");
      setVoiceState("idle");
    }
  }

  function stopRecording() {
    if (capTimerRef.current) clearTimeout(capTimerRef.current);
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
  }

  function handleMicClick() {
    if (voiceState === "idle")      return startRecording();
    if (voiceState === "recording") return stopRecording();
    // "processing" — tap is ignored; spinner shows progress
  }

  // Fire-and-forget OPTIONS ping to wake the Cloud Run instance before the
  // user finishes speaking — eliminates cold-start latency on the actual POST.
  const preWarmContainer = useCallback(() => {
    fetch("/api/transcribeMeal", { method: "OPTIONS" }).catch(() => {});
  }, []);

  // Track mount time for the clock-reset button
  const [mountTime] = useState<string>(() => currentTime());

  // ── Debounced auto-AI ────────────────────────────────────────────────────

  const triggerAI = useCallback(async (description: string) => {
    if (!user) return;
    setAiLoading(true);
    setAiApplied(false);
    try {
      const { data }: { data: ParseMealResult } = await parseMealFn({ description });
      setForm((prev) => ({
        ...prev,
        // Only backfill if field is still empty — never clobber a manual entry
        proteinEst: prev.proteinEst || String(data.protein_grams),
        satiety: prev.satiety || (SATIETY_LABELS[data.satiety_potential] as SatietyLevel) || prev.satiety,
      }));
      setAiApplied(true);
    } catch {
      // Silent fail — user never sees an error for background analysis
    } finally {
      setAiLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (aiTimerRef.current) clearTimeout(aiTimerRef.current);
    const trimmed = form.foods.trim();
    if (trimmed.length >= 5 && user) {
      aiTimerRef.current = setTimeout(() => triggerAI(trimmed), 1500);
    }
    return () => {
      if (aiTimerRef.current) clearTimeout(aiTimerRef.current);
    };
  }, [form.foods, user, triggerAI]);

  // ── Context tag toggle ───────────────────────────────────────────────────

  function toggleTag(tag: string) {
    setForm((prev) => ({
      ...prev,
      contextTags: prev.contextTags.includes(tag)
        ? prev.contextTags.filter((t) => t !== tag)
        : [...prev.contextTags, tag],
    }));
  }

  // ── Submit ───────────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !form.foods.trim()) return;
    setSaving(true);
    await addSignal(user.uid, "meal", {
      foods: form.foods.trim(),
      satiety: form.satiety ? (mapSatietyLabel(form.satiety) as SatietyScore) : null,
      portion: form.portion || null,
      hunger_return_hrs: form.hungerReturn && form.hungerReturn !== "Not tracked"
        ? mapHungerReturn(form.hungerReturn)
        : null,
      energy_level: form.energyLevel ? mapEnergyLevel(form.energyLevel) : null,
      bloating: form.bloating || null,
      protein_est: form.proteinEst ? parseFloat(form.proteinEst) : null,
      cost_est: form.costEst ? parseFloat(form.costEst) : null,
      meal_type: form.mealType || null,
      context_tags: form.contextTags.length ? form.contextTags : null,
      notes: null,
    });
    setSaving(false);
    setSubmitted(true);
    setForm({ ...defaultForm, time: currentTime() });
    setAiApplied(false);
    setDrawerOpen(false);
    setTimeout(() => setSubmitted(false), 3000);
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="bg-white rounded-3xl shadow-card border border-surface-muted overflow-hidden">

      {/* ── Always-visible baseline ── */}
      <form onSubmit={handleSubmit} className="p-6 space-y-5">

        {/* Foods */}
        <div className="space-y-2">
          <p className="label-caps">What did you eat?</p>
          <div className="relative">
            <textarea
              rows={2}
              value={form.foods}
              onChange={(e) => setForm({ ...form, foods: e.target.value })}
              placeholder="Turkey sandwich, Greek yogurt, sparkling water…"
              className="w-full rounded-xl border border-surface-muted bg-surface-warm px-4 py-3 font-sans text-body-sm text-ink placeholder:text-ink-faint focus:outline-none focus:border-accent-azure resize-none pr-12"
            />

            {/* Bottom-right overlay: status text + mic/spinner icon */}
            <div className="absolute bottom-0 right-0 flex items-center pointer-events-none">

              {/* Status text — sits to the left of the icon */}
              <span className="font-sans text-label pr-1">
                {voiceState === "recording" && (
                  <span className="text-xs font-medium text-red-600">
                    🔴 Tap mic again to finish &amp; log
                  </span>
                )}
                {voiceState === "processing" && (
                  <span className="text-ink-faint animate-pulse">
                    {PROCESSING_STEPS[processingStep]}
                  </span>
                )}
                {voiceState === "idle" && aiLoading && (
                  <span className="text-ink-faint animate-pulse">
                    Reading signals…
                  </span>
                )}
                {voiceState === "idle" && !aiLoading && aiApplied && (
                  <span className="text-accent-azure/70">✦ Estimated</span>
                )}
              </span>

              {/* Mic button / spinner — 44×44 touch target */}
              {micSupported && (
                <button
                  type="button"
                  onClick={handleMicClick}
                  disabled={voiceState === "processing"}
                  onMouseEnter={preWarmContainer}
                  onTouchStart={preWarmContainer}
                  aria-label={
                    voiceState === "recording" ? "Stop recording" : "Start voice input"
                  }
                  style={{ minWidth: 44, minHeight: 44 }}
                  className={cn(
                    "pointer-events-auto flex items-center justify-center transition-all duration-200",
                    voiceState === "recording"
                      ? "animate-pulse text-red-500 bg-red-50 rounded-full p-1"
                      : voiceState === "processing"
                      ? "text-ink-faint cursor-default rounded-xl"
                      : "text-ink-faint hover:text-ink rounded-xl"
                  )}
                >
                  {voiceState === "processing"
                    ? <Loader2 size={14} className="animate-spin" />
                    : <Mic size={14} />
                  }
                </button>
              )}
            </div>
          </div>

          {/* Voice error — soft, auto-dismissing */}
          {voiceError && (
            <p className="font-sans text-label text-ink-faint mt-1">
              {voiceError}
            </p>
          )}

          {/* Processing timeline anchor — sets expectation during transcription */}
          {voiceState === "processing" && (
            <p className="font-sans text-label text-ink-faint/50 mt-1">
              AI generation typically takes 6–10 seconds.
            </p>
          )}
        </div>

        {/* Satiety — always visible */}
        <div>
          <p className="label-caps mb-2">How did it land?</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {SATIETY_OPTIONS.map((s) => (
              <button
                key={s.value}
                type="button"
                onClick={() => setForm({ ...form, satiety: form.satiety === s.value ? "" : s.value })}
                className={cn(
                  "text-left px-3 py-2.5 rounded-xl border transition-all duration-150",
                  form.satiety === s.value
                    ? "bg-ink text-canvas border-ink"
                    : "bg-white border-surface-muted text-ink-light hover:border-ink/30 hover:text-ink"
                )}
              >
                <p className="font-sans text-body-sm font-medium leading-tight">{s.label}</p>
                <p className="font-sans text-label text-current opacity-60 mt-0.5">{s.sub}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Submit row */}
        <div className="flex items-center justify-between gap-3">
          <button
            type="submit"
            disabled={!form.foods.trim() || saving || !user}
            className={cn(
              "btn-primary",
              (!form.foods.trim() || saving || !user) && "opacity-40 cursor-not-allowed"
            )}
          >
            {saving ? "Saving…" : submitted ? "Observation recorded." : "Save Signal"}
          </button>

          {submitted && (
            <p className="font-sans text-body-sm text-ink-faint">
              No judgment attached.
            </p>
          )}

          {/* Optional detail toggle */}
          {!submitted && (
            <button
              type="button"
              onClick={() => setDrawerOpen(!drawerOpen)}
              className="flex items-center gap-1.5 font-sans text-body-sm text-ink-faint hover:text-ink transition-colors ml-auto"
            >
              <span>{drawerOpen ? "Less detail" : "Add detail"}</span>
              <ChevronDown
                size={14}
                className={cn("transition-transform duration-200", drawerOpen ? "rotate-180" : "")}
              />
            </button>
          )}
        </div>

        {/* ── Optional drawer ── */}
        {drawerOpen && (
          <div className="space-y-5 pt-4 border-t border-surface-muted">

            {/* Meal type — segmented control */}
            <div>
              <FieldLabel label="Meal type" />
              <div className="flex gap-2 flex-wrap">
                {MEAL_TYPES.map((t) => (
                  <Pill
                    key={t}
                    label={t}
                    active={form.mealType === t}
                    onClick={() => setForm({ ...form, mealType: form.mealType === t ? "" : t })}
                  />
                ))}
              </div>
            </div>

            {/* Context tags */}
            <div>
              <FieldLabel label="Context" hint="Select all that apply" />
              <div className="flex flex-wrap gap-2">
                {CONTEXT_TAGS.map((tag) => (
                  <Pill
                    key={tag}
                    label={tag}
                    active={form.contextTags.includes(tag)}
                    onClick={() => toggleTag(tag)}
                  />
                ))}
              </div>
            </div>

            {/* Protein + Cost */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <FieldLabel
                  label="Protein est."
                  hint={aiApplied ? "AI estimated · override freely" : "grams"}
                />
                <input
                  type="number"
                  min="0"
                  max="300"
                  step="1"
                  value={form.proteinEst}
                  onChange={(e) => setForm({ ...form, proteinEst: e.target.value })}
                  placeholder="34"
                  className={cn(
                    "w-full rounded-xl border bg-surface-warm px-4 py-3 font-sans text-body-sm text-ink placeholder:text-ink-faint focus:outline-none focus:border-accent-azure",
                    aiApplied && !form.proteinEst ? "border-accent-azure/30" : "border-surface-muted"
                  )}
                />
              </div>
              <div>
                <FieldLabel label="Cost est." hint="USD" />
                <input
                  type="number"
                  min="0"
                  max="999"
                  step="0.01"
                  value={form.costEst}
                  onChange={(e) => setForm({ ...form, costEst: e.target.value })}
                  placeholder="2.40"
                  className="w-full rounded-xl border border-surface-muted bg-surface-warm px-4 py-3 font-sans text-body-sm text-ink placeholder:text-ink-faint focus:outline-none focus:border-accent-azure"
                />
              </div>
            </div>

            {/* Portion */}
            <div>
              <FieldLabel label="Portion size" />
              <div className="flex flex-wrap gap-2">
                {PORTION_OPTIONS.map((opt) => (
                  <Pill
                    key={opt}
                    label={opt}
                    active={form.portion === opt}
                    onClick={() => setForm({ ...form, portion: form.portion === opt ? "" : opt })}
                  />
                ))}
              </div>
            </div>

            {/* Post-meal signals */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              <div>
                <FieldLabel label="Hunger return" />
                <div className="flex flex-wrap gap-2">
                  {HUNGER_OPTIONS.map((opt) => (
                    <Pill
                      key={opt}
                      label={opt}
                      active={form.hungerReturn === opt}
                      onClick={() => setForm({ ...form, hungerReturn: form.hungerReturn === opt ? "" : opt })}
                    />
                  ))}
                </div>
              </div>
              <div>
                <FieldLabel label="Energy 90 min later" />
                <div className="flex flex-wrap gap-2">
                  {ENERGY_OPTIONS.map((opt) => (
                    <Pill
                      key={opt}
                      label={opt}
                      active={form.energyLevel === opt}
                      onClick={() => setForm({ ...form, energyLevel: form.energyLevel === opt ? "" : opt })}
                    />
                  ))}
                </div>
              </div>
              <div>
                <FieldLabel label="Bloating / discomfort" />
                <div className="flex flex-wrap gap-2">
                  {BLOATING_OPTIONS.map((opt) => (
                    <Pill
                      key={opt}
                      label={opt}
                      active={form.bloating === opt}
                      onClick={() => setForm({ ...form, bloating: form.bloating === opt ? "" : opt })}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Time — lowest priority, end of drawer */}
            <div>
              <FieldLabel label="Time" hint="Defaults to now · update if logging later" />
              <div className="flex gap-2 max-w-[200px]">
                <input
                  type="time"
                  value={form.time}
                  onChange={(e) => setForm({ ...form, time: e.target.value })}
                  className="flex-1 rounded-xl border border-surface-muted bg-surface-warm px-4 py-2.5 font-sans text-body-sm text-ink focus:outline-none focus:border-accent-azure"
                />
                <button
                  type="button"
                  onClick={() => setForm({ ...form, time: currentTime() })}
                  className={cn(
                    "p-2.5 rounded-xl border transition-colors",
                    form.time !== mountTime
                      ? "border-accent-azure/40 bg-accent-azure/8 text-accent-azure"
                      : "border-surface-muted bg-surface-warm text-ink-faint hover:text-accent-azure"
                  )}
                  title="Reset to current time"
                >
                  <Clock size={15} />
                </button>
              </div>
            </div>

          </div>
        )}
      </form>
    </div>
  );
}
