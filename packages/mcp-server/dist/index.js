/**
 * Open Brain — MCP Server
 *
 * Exposes three analytical tools over the Cloud SQL biometric signal store:
 *   1. get_subject_timeline    — ordered signal history with AI enrichment
 *   2. analyze_biometric_correlations — protein/satiety/energy pattern analysis
 *   3. register_new_subject    — create account + subject rows for a Firebase user
 *
 * Transport: stdio (compatible with Claude Desktop, cline, continue.dev, etc.)
 * Connection: Cloud SQL Auth Proxy socket (local) or DATABASE_URL env var
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, McpError, ErrorCode, } from "@modelcontextprotocol/sdk/types.js";
import pg from "pg";
import { z } from "zod";
const { Pool } = pg;
// ── Database connection ───────────────────────────────────────────────────────
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
    console.error("[mcp-server] DATABASE_URL is not set. Exiting.");
    process.exit(1);
}
const pool = new Pool({
    connectionString: DATABASE_URL,
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
});
// Verify connectivity on startup
pool.connect().then((client) => {
    client.query("SELECT 1").then(() => {
        client.release();
        console.error("[mcp-server] Database connection verified.");
    });
}).catch((err) => {
    console.error("[mcp-server] Database connection failed:", err.message);
    process.exit(1);
});
// ── Zod schemas ───────────────────────────────────────────────────────────────
const GetSubjectTimelineSchema = z.object({
    firebase_uid: z.string().min(1).describe("Firebase Auth UID of the account owner"),
    subject_label: z.string().default("self").describe("Subject label (default: 'self')"),
    limit: z.number().int().min(1).max(200).default(50).describe("Maximum rows to return"),
    signal_type: z
        .enum(["meal", "movement", "sensation", "all"])
        .default("all")
        .describe("Filter by signal type, or 'all' for every type"),
    before_iso: z
        .string()
        .optional()
        .describe("Return signals recorded before this ISO-8601 timestamp (pagination cursor)"),
});
const AnalyzeBiometricCorrelationsSchema = z.object({
    firebase_uid: z.string().min(1).describe("Firebase Auth UID"),
    subject_label: z.string().default("self"),
    days: z
        .number()
        .int()
        .min(1)
        .max(365)
        .default(30)
        .describe("Look-back window in days"),
});
const RegisterNewSubjectSchema = z.object({
    firebase_uid: z.string().min(1).describe("Firebase Auth UID — creates account row if absent"),
    subject_label: z
        .string()
        .min(1)
        .default("self")
        .describe("Human-readable label for the new subject"),
    metadata: z
        .record(z.unknown())
        .default({})
        .describe("Arbitrary JSON metadata stored on the subject row"),
});
// ── Tool implementations ──────────────────────────────────────────────────────
async function getSubjectTimeline(args) {
    const { firebase_uid, subject_label, limit, signal_type, before_iso } = args;
    const params = [firebase_uid, subject_label, limit];
    const conditions = [];
    if (signal_type !== "all") {
        params.push(signal_type);
        conditions.push(`bs.signal_type = $${params.length}`);
    }
    if (before_iso) {
        params.push(before_iso);
        conditions.push(`bs.recorded_at < $${params.length}::timestamptz`);
    }
    const whereClause = conditions.length > 0 ? `AND ${conditions.join(" AND ")}` : "";
    const { rows } = await pool.query(`
    SELECT
      bs.id,
      bs.firestore_id,
      bs.signal_type,
      bs.recorded_at,
      bs.raw_payload,
      bs.ai_enrichment,
      bs.created_at
    FROM biometric_signals bs
    JOIN subjects sub ON sub.id = bs.subject_id
    JOIN accounts  acc ON acc.id = sub.account_id
    WHERE acc.firebase_uid = $1
      AND sub.label        = $2
      ${whereClause}
    ORDER BY bs.recorded_at DESC
    LIMIT $3
    `, params);
    return {
        count: rows.length,
        signals: rows,
    };
}
async function analyzeBiometricCorrelations(args) {
    const { firebase_uid, subject_label, days } = args;
    const { rows } = await pool.query(`
    SELECT
      COUNT(*)                                                   AS total_meals,
      ROUND(AVG((bs.ai_enrichment->>'protein_grams')::NUMERIC), 1)
                                                                 AS avg_protein_grams,
      ROUND(AVG((bs.raw_payload->>'satiety')::NUMERIC), 2)       AS avg_satiety,
      ROUND(AVG((bs.raw_payload->>'energy_level')::NUMERIC), 2)  AS avg_energy_level,
      ROUND(AVG((bs.raw_payload->>'hunger_return_hrs')::NUMERIC), 2)
                                                                 AS avg_hunger_return_hrs,
      -- High-protein cohort (>= 30g) vs low-protein cohort
      ROUND(AVG(
        CASE WHEN (bs.ai_enrichment->>'protein_grams')::INT >= 30
          THEN (bs.raw_payload->>'satiety')::NUMERIC
        END
      ), 2)                                                      AS avg_satiety_high_protein,
      ROUND(AVG(
        CASE WHEN (bs.ai_enrichment->>'protein_grams')::INT < 30
          THEN (bs.raw_payload->>'satiety')::NUMERIC
        END
      ), 2)                                                      AS avg_satiety_low_protein,
      -- Bloating breakdown
      COUNT(*) FILTER (WHERE bs.raw_payload->>'bloating' = 'none')  AS bloating_none,
      COUNT(*) FILTER (WHERE bs.raw_payload->>'bloating' = 'mild')  AS bloating_mild,
      COUNT(*) FILTER (WHERE bs.raw_payload->>'bloating' = 'moderate') AS bloating_moderate,
      COUNT(*) FILTER (WHERE bs.raw_payload->>'bloating' = 'severe') AS bloating_severe,
      -- Meal-type breakdown
      COUNT(*) FILTER (WHERE bs.raw_payload->>'meal_type' = 'breakfast') AS meal_type_breakfast,
      COUNT(*) FILTER (WHERE bs.raw_payload->>'meal_type' = 'lunch')     AS meal_type_lunch,
      COUNT(*) FILTER (WHERE bs.raw_payload->>'meal_type' = 'dinner')    AS meal_type_dinner,
      COUNT(*) FILTER (WHERE bs.raw_payload->>'meal_type' = 'snack')     AS meal_type_snack,
      -- Date range
      MIN(bs.recorded_at)                                        AS earliest_signal,
      MAX(bs.recorded_at)                                        AS latest_signal
    FROM biometric_signals bs
    JOIN subjects sub ON sub.id = bs.subject_id
    JOIN accounts  acc ON acc.id = sub.account_id
    WHERE acc.firebase_uid = $1
      AND sub.label        = $2
      AND bs.signal_type   = 'meal'
      AND bs.recorded_at  >= NOW() - ($3 || ' days')::INTERVAL
    `, [firebase_uid, subject_label, days]);
    const summary = rows[0];
    // Derive a plain-language pattern observation
    const observations = [];
    const hiProt = parseFloat(summary.avg_satiety_high_protein ?? "0");
    const loProt = parseFloat(summary.avg_satiety_low_protein ?? "0");
    if (hiProt && loProt && hiProt - loProt >= 0.5) {
        observations.push(`Meals with ≥30g protein show a satiety score ${(hiProt - loProt).toFixed(1)} points higher on average.`);
    }
    const bloatTotal = parseInt(summary.total_meals ?? "0", 10);
    const bloatSevere = parseInt(summary.bloating_severe ?? "0", 10);
    const bloatMod = parseInt(summary.bloating_moderate ?? "0", 10);
    if (bloatTotal > 0 && (bloatSevere + bloatMod) / bloatTotal > 0.2) {
        observations.push(`${Math.round(((bloatSevere + bloatMod) / bloatTotal) * 100)}% of meals in this window showed moderate or severe bloating.`);
    }
    return {
        window_days: days,
        subject_label,
        summary,
        observations,
    };
}
async function registerNewSubject(args) {
    const { firebase_uid, subject_label, metadata } = args;
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        // Upsert account
        const accountResult = await client.query(`
      INSERT INTO accounts (firebase_uid)
      VALUES ($1)
      ON CONFLICT (firebase_uid) DO UPDATE SET updated_at = NOW()
      RETURNING id, created_at
      `, [firebase_uid]);
        const accountId = accountResult.rows[0].id;
        // Upsert subject
        const subjectResult = await client.query(`
      INSERT INTO subjects (account_id, label, metadata)
      VALUES ($1, $2, $3)
      ON CONFLICT (account_id, label) DO UPDATE
        SET metadata = EXCLUDED.metadata
      RETURNING id, label, created_at
      `, [accountId, subject_label, JSON.stringify(metadata)]);
        await client.query("COMMIT");
        return {
            account_id: accountId,
            subject: subjectResult.rows[0],
            firebase_uid,
        };
    }
    catch (err) {
        await client.query("ROLLBACK");
        throw err;
    }
    finally {
        client.release();
    }
}
// ── MCP server setup ──────────────────────────────────────────────────────────
const server = new Server({ name: "biofeedback-openbrain", version: "0.1.0" }, { capabilities: { tools: {} } });
server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
        {
            name: "get_subject_timeline",
            description: "Retrieve an ordered history of biometric signals for a subject. Returns raw payload and AI enrichment fields. Supports pagination via before_iso cursor and filtering by signal type.",
            inputSchema: {
                type: "object",
                properties: {
                    firebase_uid: { type: "string", description: "Firebase Auth UID of the account owner" },
                    subject_label: { type: "string", description: "Subject label (default: 'self')", default: "self" },
                    limit: { type: "number", description: "Max rows (1–200, default 50)", default: 50 },
                    signal_type: {
                        type: "string",
                        enum: ["meal", "movement", "sensation", "all"],
                        description: "Filter by type, or 'all'",
                        default: "all",
                    },
                    before_iso: {
                        type: "string",
                        description: "ISO-8601 timestamp — return signals recorded before this (pagination cursor)",
                    },
                },
                required: ["firebase_uid"],
            },
        },
        {
            name: "analyze_biometric_correlations",
            description: "Aggregate statistics and pattern observations for a subject's meal signals over a configurable look-back window. Returns protein/satiety cohort comparison, bloating frequency, meal-type breakdown, and plain-language observations.",
            inputSchema: {
                type: "object",
                properties: {
                    firebase_uid: { type: "string", description: "Firebase Auth UID" },
                    subject_label: { type: "string", description: "Subject label (default: 'self')", default: "self" },
                    days: { type: "number", description: "Look-back window in days (1–365, default 30)", default: 30 },
                },
                required: ["firebase_uid"],
            },
        },
        {
            name: "register_new_subject",
            description: "Idempotently create an account row (keyed by Firebase UID) and a subject row. Safe to call multiple times — uses ON CONFLICT upsert. Returns the account and subject IDs.",
            inputSchema: {
                type: "object",
                properties: {
                    firebase_uid: { type: "string", description: "Firebase Auth UID" },
                    subject_label: { type: "string", description: "Subject label (default: 'self')", default: "self" },
                    metadata: { type: "object", description: "Arbitrary JSON metadata", default: {} },
                },
                required: ["firebase_uid"],
            },
        },
    ],
}));
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    try {
        let result;
        switch (name) {
            case "get_subject_timeline": {
                const parsed = GetSubjectTimelineSchema.parse(args);
                result = await getSubjectTimeline(parsed);
                break;
            }
            case "analyze_biometric_correlations": {
                const parsed = AnalyzeBiometricCorrelationsSchema.parse(args);
                result = await analyzeBiometricCorrelations(parsed);
                break;
            }
            case "register_new_subject": {
                const parsed = RegisterNewSubjectSchema.parse(args);
                result = await registerNewSubject(parsed);
                break;
            }
            default:
                throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
        }
        return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
    }
    catch (err) {
        if (err instanceof McpError)
            throw err;
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[mcp-server] Tool "${name}" error:`, message);
        throw new McpError(ErrorCode.InternalError, `Tool execution failed: ${message}`);
    }
});
// ── Start ─────────────────────────────────────────────────────────────────────
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("[mcp-server] Open Brain MCP server running on stdio.");
//# sourceMappingURL=index.js.map