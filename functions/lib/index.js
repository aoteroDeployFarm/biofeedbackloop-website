"use strict";
/**
 * BioFeedbackLoop — Firebase Functions entry point
 *
 * ── Spec-discovery strategy ───────────────────────────────────────────────────
 * `firebase-functions/v2/https` imports firebase-admin/auth which pulls in
 * jose, jsonwebtoken, and jwks-rsa — heavy JWT/crypto libs that take 10-20 s
 * to initialize on a slow external disk (this project lives on /Volumes/DevData).
 * The Firebase CLI spec-discovery subprocess times out after 10 s.
 *
 * Fix: guard ALL v2 provider imports behind K_SERVICE (set only in Cloud Run).
 * During spec-discovery (no K_SERVICE), export lightweight stub functions that
 * carry the correct __endpoint metadata — the CLI reads only that field.
 * Stubs never execute; real handlers run inside Cloud Run where disk is fast.
 *
 * Only firebase-functions/params is loaded at spec-discovery time (~0.7 s total).
 * ─────────────────────────────────────────────────────────────────────────────
 */
Object.defineProperty(exports, "__esModule", { value: true });
const params_1 = require("firebase-functions/params");
// ── Secrets (always declared — params module registers them in declaredParams) ─
const GEMINI_API_KEY = (0, params_1.defineSecret)("GEMINI_API_KEY");
const OPENBRAIN_DATABASE_URL = (0, params_1.defineSecret)("OPENBRAIN_DATABASE_URL");
// ── Helpers ───────────────────────────────────────────────────────────────────
function clampInt(value, min, max) {
    const n = typeof value === "number" ? Math.round(value) : parseInt(String(value), 10);
    if (isNaN(n))
        return min;
    return Math.max(min, Math.min(max, n));
}
function extractJSON(raw) {
    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenced)
        return fenced[1].trim();
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start !== -1 && end !== -1 && end > start) {
        return raw.slice(start, end + 1).trim();
    }
    return raw.trim();
}
function getAI(apiKey) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { GoogleGenAI } = require("@google/genai");
    return new GoogleGenAI({ apiKey });
}
function getSafetySettings() {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { HarmCategory, HarmBlockThreshold } = require("@google/genai");
    return [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    ];
}
// ── K_SERVICE branch ──────────────────────────────────────────────────────────
//
// K_SERVICE is set by Cloud Run on every deployed instance. It is NEVER set by
// the Firebase CLI spec-discovery subprocess. This gate ensures the heavy
// firebase-admin/auth, jose, jsonwebtoken, and jwks-rsa modules are never read
// from disk during deployment analysis.
if (process.env.K_SERVICE) {
    // ── Cloud Run: load all providers now (metadata server makes them fast) ────
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { onDocumentCreated } = require("firebase-functions/v2/firestore");
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const admin = require("firebase-admin");
    admin.initializeApp();
    const SUPPORTED_AUDIO_TYPES = [
        "audio/webm", "audio/mp4", "audio/mpeg", "audio/mp3",
        "audio/ogg", "audio/wav", "audio/flac", "audio/aac",
    ];
    // ── parseMeal ───────────────────────────────────────────────────────────────
    exports.parseMeal = onCall({
        region: "us-central1",
        timeoutSeconds: 20,
        memory: "256MiB",
        secrets: [GEMINI_API_KEY, OPENBRAIN_DATABASE_URL],
    }, async (request) => {
        console.log("[parseMeal] invoked — auth present:", !!request.auth);
        if (!request.auth) {
            throw new HttpsError("unauthenticated", "Sign in to use the AI observer.");
        }
        const { description } = request.data;
        if (!description?.trim() || description.trim().length < 3) {
            throw new HttpsError("invalid-argument", "Provide a meal description of at least 3 characters.");
        }
        console.log("[parseMeal] description length:", description.trim().length);
        const ai = getAI(GEMINI_API_KEY.value());
        const safetySettings = getSafetySettings();
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
                throw new HttpsError("permission-denied", "AI service not authorized. Check IAM roles.");
            }
            if (msg.includes("404") || msg.includes("NOT_FOUND")) {
                throw new HttpsError("not-found", "AI model unavailable. Contact support.");
            }
            if (msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED")) {
                throw new HttpsError("resource-exhausted", "AI quota exceeded. Try again shortly.");
            }
            throw new HttpsError("internal", "AI service unavailable. Please try again.");
        }
        let parsed;
        const cleaned = extractJSON(raw);
        console.log("[parseMeal] CLEANED_FOR_PARSE:", cleaned);
        try {
            parsed = JSON.parse(cleaned);
        }
        catch {
            throw new HttpsError("internal", `Parse failed. Raw AI output: ${raw.slice(0, 300)}`);
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
    // ── generateInsight ─────────────────────────────────────────────────────────
    exports.generateInsight = onRequest({
        region: "us-central1",
        timeoutSeconds: 30,
        memory: "256MiB",
        secrets: [GEMINI_API_KEY],
        cors: true,
    }, async (req, res) => {
        const validPath = req.path === "/" || req.path === "/api/generateInsight";
        if (!validPath) {
            res.status(404).json({ error: "Not found" });
            return;
        }
        if (req.method !== "POST") {
            res.status(405).json({ error: "Method not allowed" });
            return;
        }
        const authHeader = req.headers["authorization"];
        const idToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
        if (!idToken) {
            res.status(401).json({ error: "Unauthenticated" });
            return;
        }
        let uid;
        try {
            const decoded = await admin.auth().verifyIdToken(idToken);
            uid = decoded.uid;
        }
        catch {
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
        const ai = getAI(GEMINI_API_KEY.value());
        const safetySettings = getSafetySettings();
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
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            const stack = err instanceof Error ? err.stack : undefined;
            console.error("[generateInsight] GenAI error:", msg);
            console.error("[generateInsight] Full stack:", stack ?? "(no stack)");
            res.status(500).json({ error: "AI service unavailable." });
        }
    });
    // ── transcribeMeal ──────────────────────────────────────────────────────────
    exports.transcribeMeal = onRequest({
        region: "us-central1",
        timeoutSeconds: 30,
        memory: "512MiB",
        secrets: [GEMINI_API_KEY],
        cors: true,
    }, async (req, res) => {
        const validPath = req.path === "/" || req.path === "/api/transcribeMeal";
        if (!validPath) {
            res.status(404).json({ error: "Not found" });
            return;
        }
        if (req.method !== "POST") {
            res.status(405).json({ error: "Method not allowed" });
            return;
        }
        const authHeader = req.headers["authorization"];
        const idToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
        if (!idToken) {
            res.status(401).json({ error: "Unauthenticated" });
            return;
        }
        try {
            await admin.auth().verifyIdToken(idToken);
        }
        catch {
            res.status(403).json({ error: "Invalid or expired token" });
            return;
        }
        const { audio, mimeType } = req.body;
        if (!audio?.trim()) {
            res.status(400).json({ error: "No audio data received" });
            return;
        }
        const SUPPORTED = [
            "audio/webm", "audio/mp4", "audio/mpeg", "audio/mp3",
            "audio/ogg", "audio/wav", "audio/flac", "audio/aac",
        ];
        const resolvedMime = SUPPORTED.includes(mimeType ?? "") ? mimeType : "audio/webm";
        const ai = getAI(GEMINI_API_KEY.value());
        const safetySettings = getSafetySettings();
        try {
            const response = await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: [
                    {
                        role: "user",
                        parts: [
                            { inlineData: { mimeType: resolvedMime, data: audio } },
                            {
                                text: `Analyze this audio recording of a user logging meals or biometric observations.
Return a JSON object that strictly follows this schema — no markdown fences, no explanation:
{
  "rawTranscript": "<exact literal transcription of the spoken words>",
  "isDone": <boolean>
}

CRITICAL RULE FOR "isDone":
Set "isDone" to true ONLY if the user utters an explicit sign-off keyword at the very end of their speech: "done", "log it", or "sync". If none of these exact words appear, set "isDone" to false.`,
                            },
                        ],
                    },
                ],
                config: {
                    maxOutputTokens: 512,
                    temperature: 0.0,
                    responseMimeType: "application/json",
                    thinkingConfig: { thinkingBudget: 0 },
                    safetySettings,
                },
            });
            const parts = response.candidates?.[0]?.content?.parts ?? [];
            const raw = parts.length > 0
                ? parts.map((p) => p.text ?? "").join("").trim()
                : (response.text?.trim() ?? "");
            if (!raw) {
                res.status(404).json({ error: "No speech detected in the recording" });
                return;
            }
            let parsed;
            try {
                parsed = JSON.parse(extractJSON(raw));
            }
            catch {
                console.error("[transcribeMeal] JSON parse failed — raw:", raw.slice(0, 200));
                parsed = { rawTranscript: raw, isDone: false };
            }
            let text = (parsed.rawTranscript ?? "").trim();
            if (!text) {
                res.status(404).json({ error: "No speech detected in the recording" });
                return;
            }
            if (parsed.isDone) {
                text = text.replace(/[\s.,!?]*(done|log\s+it|sync)[\s.,!?]*$/i, "").trim();
            }
            res.json({ text });
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error("[transcribeMeal] GenAI error:", msg);
            res.status(500).json({ error: "Transcription unavailable. Try typing instead." });
        }
    });
    // ── mirrorSignalOnCreate ────────────────────────────────────────────────────
    exports.mirrorSignalOnCreate = onDocumentCreated({
        document: "users/{uid}/signals/{signalId}",
        region: "us-central1",
        secrets: ["OPENBRAIN_DATABASE_URL"],
        memory: "256MiB",
        timeoutSeconds: 15,
        cloudSqlInstances: ["botridge:us-central1:openbrain"],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }, async (event) => {
        const { uid, signalId } = event.params;
        const data = event.data?.data();
        if (!data)
            return;
        const dbUrl = process.env.OPENBRAIN_DATABASE_URL;
        if (!dbUrl) {
            console.error("[mirrorSignal] OPENBRAIN_DATABASE_URL not set — skipping mirror.");
            return;
        }
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { Pool } = require("pg");
        const pool = new Pool({ connectionString: dbUrl, max: 1 });
        try {
            // Map Firestore signal type to live DB CHECK constraint values:
            // live: meal | symptom | energy | activity
            const firestoreType = data["type"] ?? "meal";
            const SIGNAL_TYPE_MAP = {
                meal: "meal",
                movement: "activity",
                sensation: "symptom",
                energy: "energy",
                activity: "activity",
                symptom: "symptom",
            };
            const signalType = SIGNAL_TYPE_MAP[firestoreType] ?? "meal";
            // Live column is "timestamp", not "recorded_at"
            const signalTimestamp = data["timestamp"]?.toDate?.() ?? new Date();
            const rawPayload = data["payload"] ?? {};
            const aiEnrichment = {
                protein_grams: rawPayload.protein_est ?? null,
                calorie_range_low: rawPayload.calorie_low ?? null,
                calorie_range_high: rawPayload.calorie_high ?? null,
                satiety_potential: rawPayload.satiety_potential ?? null,
                confidence: rawPayload.ai_confidence ?? null,
            };
            // Upsert account — ON CONFLICT (firebase_uid) is safe: unique constraint exists
            const accountRes = await pool.query(`INSERT INTO accounts (firebase_uid)
         VALUES ($1)
         ON CONFLICT (firebase_uid) DO UPDATE SET updated_at = NOW()
         RETURNING id`, [uid]);
            const accountId = accountRes.rows[0].id;
            // Upsert default subject — live schema requires name (TEXT NOT NULL) and
            // type (TEXT NOT NULL, CHECK: human|canine|feline).
            // ON CONFLICT (account_id, label) now has the unique constraint added by migration.
            const subjectRes = await pool.query(`INSERT INTO subjects (account_id, label, name, type)
         VALUES ($1, 'self', 'Self', 'human')
         ON CONFLICT (account_id, label) DO NOTHING
         RETURNING id`, [accountId]);
            let subjectId = subjectRes.rows[0]?.id;
            if (!subjectId) {
                // DO NOTHING fired (row already existed) — fetch the existing id
                const existing = await pool.query(`SELECT id FROM subjects WHERE account_id = $1 AND label = 'self'`, [accountId]);
                subjectId = existing.rows[0].id;
            }
            // Mirror signal — firestore_id column + unique constraint added by migration.
            // Live timestamp column is named "timestamp". signal_type mapped above.
            await pool.query(`INSERT INTO biometric_signals
           (firestore_id, subject_id, signal_type, "timestamp", raw_payload, ai_enrichment)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (subject_id, firestore_id) DO NOTHING`, [
                signalId,
                subjectId,
                signalType,
                signalTimestamp,
                JSON.stringify(rawPayload),
                JSON.stringify(aiEnrichment),
            ]);
            console.log("[mirrorSignalOnCreate] mirrored signal:", signalId, "uid:", uid);
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.warn("[mirrorSignal] silent shadow-write failure:", msg);
        }
        finally {
            await pool.end();
        }
    });
}
else {
    // ── Spec-discovery stubs ──────────────────────────────────────────────────
    //
    // The Firebase CLI reads val.__endpoint from each exported function to build
    // its deployment manifest. These stubs carry the exact __endpoint shape that
    // onCall/onRequest/onDocumentCreated would produce, without loading any heavy
    // modules (jose, jsonwebtoken, jwks-rsa, firebase-admin/auth).
    //
    // Shapes verified by inspecting actual __endpoint output from each wrapper.
    function stub(endpoint) {
        const fn = async (..._args) => { };
        fn.__endpoint = endpoint;
        return fn;
    }
    const BASE = {
        minInstances: null,
        maxInstances: null,
        ingressSettings: null,
        concurrency: null,
        serviceAccountEmail: null,
        vpc: null,
        platform: "gcfv2",
        labels: {},
    };
    exports.parseMeal = stub({
        ...BASE,
        availableMemoryMb: 256,
        timeoutSeconds: 20,
        region: ["us-central1"],
        secretEnvironmentVariables: [{ key: "GEMINI_API_KEY" }, { key: "OPENBRAIN_DATABASE_URL" }],
        callableTrigger: {},
    });
    exports.generateInsight = stub({
        ...BASE,
        availableMemoryMb: 256,
        timeoutSeconds: 30,
        region: ["us-central1"],
        secretEnvironmentVariables: [{ key: "GEMINI_API_KEY" }],
        httpsTrigger: {},
    });
    exports.transcribeMeal = stub({
        ...BASE,
        availableMemoryMb: 512,
        timeoutSeconds: 30,
        region: ["us-central1"],
        secretEnvironmentVariables: [{ key: "GEMINI_API_KEY" }],
        httpsTrigger: {},
    });
    exports.mirrorSignalOnCreate = stub({
        ...BASE,
        availableMemoryMb: 256,
        timeoutSeconds: 15,
        region: ["us-central1"],
        secretEnvironmentVariables: [{ key: "OPENBRAIN_DATABASE_URL" }],
        eventTrigger: {
            eventType: "google.cloud.firestore.document.v1.created",
            eventFilters: { database: "(default)", namespace: "(default)" },
            eventFilterPathPatterns: { document: "users/{uid}/signals/{signalId}" },
            retry: false,
        },
    });
}
//# sourceMappingURL=index.js.map