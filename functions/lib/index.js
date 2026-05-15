"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateInsight = exports.parseMeal = void 0;
const https_1 = require("firebase-functions/v2/https");
const params_1 = require("firebase-functions/params");
const admin = __importStar(require("firebase-admin"));
const genai_1 = require("@google/genai");
admin.initializeApp();
// ── Secret — set once with: firebase functions:secrets:set GEMINI_API_KEY ─────
const GEMINI_API_KEY = (0, params_1.defineSecret)("GEMINI_API_KEY");
const safetySettings = [
    { category: genai_1.HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: genai_1.HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: genai_1.HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: genai_1.HarmBlockThreshold.BLOCK_ONLY_HIGH },
];
// ── JSON extractor — strips markdown fences and prose preamble ────────────────
function extractJSON(raw) {
    // 1. Pull content from ```json ... ``` or ``` ... ``` fences
    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenced)
        return fenced[1].trim();
    // 2. Find the first { ... } object in the string
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start !== -1 && end !== -1 && end > start) {
        return raw.slice(start, end + 1).trim();
    }
    return raw.trim();
}
// ── parseMeal ─────────────────────────────────────────────────────────────────
exports.parseMeal = (0, https_1.onCall)({ region: "us-central1", timeoutSeconds: 20, memory: "256MiB", secrets: [GEMINI_API_KEY] }, async (request) => {
    console.log("[parseMeal] invoked — auth present:", !!request.auth);
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "Sign in to use the AI observer.");
    }
    const { description } = request.data;
    if (!description?.trim() || description.trim().length < 3) {
        throw new https_1.HttpsError("invalid-argument", "Provide a meal description of at least 3 characters.");
    }
    console.log("[parseMeal] description length:", description.trim().length);
    const ai = new genai_1.GoogleGenAI({ apiKey: GEMINI_API_KEY.value() });
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
    let raw;
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
            ? parts.map((p) => p.text ?? "").join("")
            : (response.text ?? "{}");
        console.log("[parseMeal] RAW_AI_OUTPUT:", raw);
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const stack = err instanceof Error ? err.stack : undefined;
        console.error("[parseMeal] GenAI error:", msg);
        console.error("[parseMeal] Full stack:", stack ?? "(no stack)");
        if (msg.includes("403") || msg.includes("PERMISSION_DENIED")) {
            console.error("[parseMeal] → Service account lacks aiplatform.user role");
            throw new https_1.HttpsError("permission-denied", "AI service not authorized. Check IAM roles.");
        }
        if (msg.includes("404") || msg.includes("NOT_FOUND")) {
            console.error("[parseMeal] → Model not found — check model ID and region");
            throw new https_1.HttpsError("not-found", "AI model unavailable. Contact support.");
        }
        if (msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED")) {
            throw new https_1.HttpsError("resource-exhausted", "AI quota exceeded. Try again shortly.");
        }
        console.error("[parseMeal] → Unclassified error:", msg);
        throw new https_1.HttpsError("internal", "AI service unavailable. Please try again.");
    }
    let parsed;
    const cleaned = extractJSON(raw);
    console.log("[parseMeal] CLEANED_FOR_PARSE:", cleaned);
    try {
        parsed = JSON.parse(cleaned);
    }
    catch {
        console.error("[parseMeal] JSON parse failed — cleaned was:", cleaned);
        // Return debug info to the client so failures are visible in the browser
        throw new https_1.HttpsError("internal", `Parse failed. Raw AI output: ${raw.slice(0, 300)}`);
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
});
// ── generateInsight ───────────────────────────────────────────────────────────
exports.generateInsight = (0, https_1.onCall)({ region: "us-central1", timeoutSeconds: 30, memory: "256MiB", secrets: [GEMINI_API_KEY] }, async (request) => {
    console.log("[generateInsight] invoked — auth present:", !!request.auth);
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "Sign in to use the AI observer.");
    }
    const uid = request.auth.uid;
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
        return { insight: null };
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
    const ai = new genai_1.GoogleGenAI({ apiKey: GEMINI_API_KEY.value() });
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
    let insight;
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
        insight = response.text?.trim() ?? null;
        console.log("[generateInsight] insight length:", insight?.length ?? 0);
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const stack = err instanceof Error ? err.stack : undefined;
        console.error("[generateInsight] GenAI error:", msg);
        console.error("[generateInsight] Full stack:", stack ?? "(no stack)");
        throw new https_1.HttpsError("internal", "AI service unavailable.");
    }
    return { insight };
});
// ── Helpers ───────────────────────────────────────────────────────────────────
function clampInt(value, min, max) {
    const n = typeof value === "number" ? Math.round(value) : parseInt(String(value), 10);
    if (isNaN(n))
        return min;
    return Math.max(min, Math.min(max, n));
}
//# sourceMappingURL=index.js.map