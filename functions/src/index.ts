import { onCall, onRequest, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import * as admin from "firebase-admin";
import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";

admin.initializeApp();

// ── Secret — set once with: firebase functions:secrets:set GEMINI_API_KEY ─────
const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");

const safetySettings = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
];

// ── JSON extractor — strips markdown fences and prose preamble ────────────────
function extractJSON(raw: string): string {
  // 1. Pull content from ```json ... ``` or ``` ... ``` fences
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();

  // 2. Find the first { ... } object in the string
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    return raw.slice(start, end + 1).trim();
  }

  return raw.trim();
}

// ── parseMeal ─────────────────────────────────────────────────────────────────

export const parseMeal = onCall(
  { region: "us-central1", timeoutSeconds: 20, memory: "256MiB", secrets: [GEMINI_API_KEY] },
  async (request) => {
    console.log("[parseMeal] invoked — auth present:", !!request.auth);

    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Sign in to use the AI observer.");
    }

    const { description } = request.data as { description?: string };
    if (!description?.trim() || description.trim().length < 3) {
      throw new HttpsError("invalid-argument", "Provide a meal description of at least 3 characters.");
    }

    console.log("[parseMeal] description length:", description.trim().length);

    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY.value() });

    const prompt = `You are a nutrition estimator. Output RAW JSON only — no markdown fences, no explanation, no preamble.

Required keys (no others):
- "protein_grams": integer
- "calorie_range_low": integer
- "calorie_range_high": integer
- "satiety_potential": integer 1-4 (1=<1.5h, 2=1.5-2.5h, 3=2.5-3.5h, 4=>3.5h)
- "confidence": "low" | "medium" | "high"

Be conservative. Do not comment on food choices.

Meal: "${description.trim()}"

JSON:`;

    let raw: string;
    try {
      console.log("[parseMeal] calling ai.models.generateContent — model: gemini-2.5-flash, auth: API key");
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          maxOutputTokens: 1024,
          temperature: 0.1,
          thinkingConfig: { thinkingBudget: 0 },
          safetySettings,
        },
      });
      // Concatenate all parts — response.text only returns the first chunk
      const parts = response.candidates?.[0]?.content?.parts ?? [];
      raw = parts.length > 0
        ? parts.map((p: { text?: string }) => p.text ?? "").join("")
        : (response.text ?? "{}");
      console.log("[parseMeal] RAW_AI_OUTPUT:", raw);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : undefined;
      console.error("[parseMeal] GenAI error:", msg);
      console.error("[parseMeal] Full stack:", stack ?? "(no stack)");

      if (msg.includes("403") || msg.includes("PERMISSION_DENIED")) {
        console.error("[parseMeal] → Service account lacks aiplatform.user role");
        throw new HttpsError("permission-denied", "AI service not authorized. Check IAM roles.");
      }
      if (msg.includes("404") || msg.includes("NOT_FOUND")) {
        console.error("[parseMeal] → Model not found — check model ID and region");
        throw new HttpsError("not-found", "AI model unavailable. Contact support.");
      }
      if (msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED")) {
        throw new HttpsError("resource-exhausted", "AI quota exceeded. Try again shortly.");
      }
      console.error("[parseMeal] → Unclassified error:", msg);
      throw new HttpsError("internal", "AI service unavailable. Please try again.");
    }

    let parsed: Record<string, unknown>;
    const cleaned = extractJSON(raw);
    console.log("[parseMeal] CLEANED_FOR_PARSE:", cleaned);
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      console.error("[parseMeal] JSON parse failed — cleaned was:", cleaned);
      // Return debug info to the client so failures are visible in the browser
      throw new HttpsError(
        "internal",
        `Parse failed. Raw AI output: ${raw.slice(0, 300)}`
      );
    }

    const result = {
      protein_grams: clampInt(parsed.protein_grams, 0, 300),
      calorie_range_low: clampInt(parsed.calorie_range_low, 0, 5000),
      calorie_range_high: clampInt(parsed.calorie_range_high, 0, 5000),
      satiety_potential: clampInt(parsed.satiety_potential, 1, 4),
      confidence: ["low", "medium", "high"].includes(String(parsed.confidence))
        ? String(parsed.confidence)
        : "medium",
    };

    console.log("[parseMeal] success:", JSON.stringify(result));
    return result;
  }
);

// ── generateInsight ───────────────────────────────────────────────────────────

export const generateInsight = onRequest(
  {
    region: "us-central1",
    timeoutSeconds: 30,
    memory: "256MiB",
    secrets: [GEMINI_API_KEY],
    cors: true,
  },
  async (req, res) => {
    const validPath = req.path === "/" || req.path === "/api/generateInsight";
    if (!validPath) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    // Verify Firebase ID token from Authorization header
    const authHeader = req.headers["authorization"] as string | undefined;
    const idToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!idToken) {
      res.status(401).json({ error: "Unauthenticated" });
      return;
    }

    let uid: string;
    try {
      const decoded = await admin.auth().verifyIdToken(idToken);
      uid = decoded.uid;
    } catch {
      res.status(403).json({ error: "Invalid or expired token" });
      return;
    }

    console.log("[generateInsight] invoked — uid:", uid);

    const snap = await admin
      .firestore()
      .collection("users")
      .doc(uid)
      .collection("signals")
      .orderBy("timestamp", "desc")
      .limit(5)
      .get();

    if (snap.empty) {
      console.log("[generateInsight] no signals — returning null");
      res.json({ insight: null });
      return;
    }

    const signals = snap.docs.map((doc) => {
      const d = doc.data();
      return {
        type: d.type,
        timestamp: d.timestamp?.toDate?.()?.toISOString() ?? null,
        payload: d.payload,
      };
    });

    console.log("[generateInsight] signals count:", signals.length);

    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY.value() });

    const prompt = `You are a calm, observational health tracking assistant. Your voice is that of a thoughtful systems thinker — precise, curious, and non-judgmental.

Language rules:
- NEVER use: "great", "excellent", "good job", "bad", "cheat", "optimize", "should", "must", "need to", "try to"
- USE phrases like: "worth noting", "the pattern suggests", "you may notice", "the data shows", "an observation:"
- Maximum 2 sentences
- Be specific to the data — reference actual numbers when present
- Focus on patterns, timing relationships, or trends across the entries
- Do not start with "I" or "You"

Recent meal signals (newest first):
${JSON.stringify(signals, null, 2)}

Return only the observation text — no labels, no JSON, no markdown.`;

    try {
      console.log("[generateInsight] calling ai.models.generateContent");
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          maxOutputTokens: 160,
          temperature: 0.4,
          safetySettings,
        },
      });
      const insight = response.text?.trim() ?? null;
      console.log("[generateInsight] insight length:", insight?.length ?? 0);
      res.json({ insight });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : undefined;
      console.error("[generateInsight] GenAI error:", msg);
      console.error("[generateInsight] Full stack:", stack ?? "(no stack)");
      res.status(500).json({ error: "AI service unavailable." });
    }
  }
);

// ── transcribeMeal ────────────────────────────────────────────────────────────
//
// Accepts a base64-encoded audio blob (webm / mp4 / ogg / wav) from the client,
// passes it to Gemini's multimodal endpoint as inline data, and returns the
// raw transcription string. No files are written to disk or Cloud Storage —
// the buffer lives only in the Function's memory for the duration of the call.

const SUPPORTED_AUDIO_TYPES = [
  "audio/webm", "audio/mp4", "audio/mpeg", "audio/mp3",
  "audio/ogg",  "audio/wav", "audio/flac", "audio/aac",
];

// Exposed as an onRequest function so the Firebase Hosting rewrite at
// /api/transcribeMeal can proxy it same-origin, eliminating CORS entirely.
// Auth is verified manually via the Firebase Admin SDK ID-token check.
export const transcribeMeal = onRequest(
  {
    region: "us-central1",
    timeoutSeconds: 30,
    memory: "512MiB",
    secrets: [GEMINI_API_KEY],
    cors: true,
  },
  async (req, res) => {
    // Accept requests arriving directly at the function root ("/") and via
    // the Cloud Run proxy path ("/api/transcribeMeal") so both routing
    // layers resolve to the same handler without a 404.
    const validPath = req.path === "/" || req.path === "/api/transcribeMeal";
    if (!validPath) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    // Verify Firebase ID token from Authorization header
    const authHeader = req.headers["authorization"] as string | undefined;
    const idToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!idToken) {
      res.status(401).json({ error: "Unauthenticated" });
      return;
    }
    try {
      await admin.auth().verifyIdToken(idToken);
    } catch {
      res.status(403).json({ error: "Invalid or expired token" });
      return;
    }

    const { audio, mimeType } = req.body as { audio?: string; mimeType?: string };

    if (!audio?.trim()) {
      res.status(400).json({ error: "No audio data received" });
      return;
    }

    const resolvedMime = SUPPORTED_AUDIO_TYPES.includes(mimeType ?? "")
      ? mimeType!
      : "audio/webm";

    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY.value() });

    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          {
            role: "user",
            parts: [
              { inlineData: { mimeType: resolvedMime, data: audio } },
              {
                text: "Transcribe exactly what is spoken in this audio. Return only the spoken words as plain text — no commentary, no labels, no punctuation changes.",
              },
            ],
          },
        ],
        config: {
          maxOutputTokens: 256,
          temperature: 0.0,
          thinkingConfig: { thinkingBudget: 0 },
          safetySettings,
        },
      });

      const parts = response.candidates?.[0]?.content?.parts ?? [];
      const text =
        parts.length > 0
          ? parts.map((p: { text?: string }) => p.text ?? "").join("").trim()
          : (response.text?.trim() ?? "");

      if (!text) {
        res.status(404).json({ error: "No speech detected in the recording" });
        return;
      }

      res.json({ text });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[transcribeMeal] GenAI error:", msg);
      res.status(500).json({ error: "Transcription unavailable. Try typing instead." });
    }
  }
);

// ── Helpers ───────────────────────────────────────────────────────────────────

function clampInt(value: unknown, min: number, max: number): number {
  const n = typeof value === "number" ? Math.round(value) : parseInt(String(value), 10);
  if (isNaN(n)) return min;
  return Math.max(min, Math.min(max, n));
}
