import { getFunctions, httpsCallable, connectFunctionsEmulator } from "firebase/functions";
import app, { auth } from "./config";

const functions = getFunctions(app, "us-central1");

// Wire emulator in development — runs once, guarded by the module singleton
if (
  typeof window !== "undefined" &&
  process.env.NEXT_PUBLIC_USE_EMULATOR === "true"
) {
  try {
    connectFunctionsEmulator(functions, "127.0.0.1", 5001);
  } catch {
    // Already connected on HMR re-import
  }
}

// ── parseMeal ─────────────────────────────────────────────────────────────────

export interface ParseMealInput {
  description: string;
}

export interface ParseMealResult {
  protein_grams: number;
  calorie_range_low: number;
  calorie_range_high: number;
  satiety_potential: 1 | 2 | 3 | 4;
  confidence: "low" | "medium" | "high";
}

export const parseMealFn = httpsCallable<ParseMealInput, ParseMealResult>(
  functions,
  "parseMeal"
);

// ── generateInsight ───────────────────────────────────────────────────────────

export interface GenerateInsightResult {
  insight: string | null;
}

export async function generateInsightFn(
  _input: Record<string, never>
): Promise<{ data: GenerateInsightResult }> {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");

  const idToken = await user.getIdToken();

  const response = await fetch("/api/generateInsight", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${idToken}`,
    },
    body: JSON.stringify({}),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? `Insight unavailable (${response.status})`);
  }

  const data = await response.json() as GenerateInsightResult;
  return { data };
}

// ── transcribeMeal ────────────────────────────────────────────────────────────
//
// Uses a plain fetch to /api/transcribeMeal — a same-origin path that Firebase
// Hosting rewrites to the transcribeMeal Cloud Function. This completely
// bypasses cross-origin preflight checks. Auth is sent as a Bearer token in
// the Authorization header and verified server-side by the Admin SDK.

export interface TranscribeMealInput {
  /** Raw audio encoded as base64 (no data-URI prefix). */
  audio: string;
  /** MIME type reported by MediaRecorder (e.g. "audio/webm", "audio/mp4"). */
  mimeType: string;
}

export interface TranscribeMealResult {
  text: string;
}

export async function transcribeMealFn(
  input: TranscribeMealInput
): Promise<{ data: TranscribeMealResult }> {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");

  const idToken = await user.getIdToken();

  const response = await fetch("/api/transcribeMeal", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${idToken}`,
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? `Transcription failed (${response.status})`);
  }

  const data = await response.json() as TranscribeMealResult;
  return { data };
}

// Satiety potential → label used in SignalInput
export const SATIETY_LABELS: Record<number, string> = {
  1: "light",
  2: "satisfied",
  3: "full",
  4: "stuffed",
};
