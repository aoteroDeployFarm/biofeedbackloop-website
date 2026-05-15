import { getFunctions, httpsCallable, connectFunctionsEmulator } from "firebase/functions";
import app from "./config";

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

export const generateInsightFn = httpsCallable<Record<string, never>, GenerateInsightResult>(
  functions,
  "generateInsight"
);

// Satiety potential → label used in SignalInput
export const SATIETY_LABELS: Record<number, string> = {
  1: "light",
  2: "satisfied",
  3: "full",
  4: "stuffed",
};
