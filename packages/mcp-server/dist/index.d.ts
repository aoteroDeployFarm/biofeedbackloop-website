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
export {};
//# sourceMappingURL=index.d.ts.map