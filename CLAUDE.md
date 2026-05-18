@AGENTS.md

---

## Optimized Deployment Commands

- **Deploy frontend only:**
  `firebase deploy --only hosting --project botridge`

- **Deploy transcription backend only:**
  `cd functions && npm run build && cd .. && firebase deploy --only functions:transcribeMeal --project botridge`

- **Deploy insights backend only:**
  `cd functions && npm run build && cd .. && firebase deploy --only functions:generateInsight --project botridge`

- **Deploy parseMeal only:**
  `cd functions && npm run build && cd .. && firebase deploy --only functions:parseMeal --project botridge`

- **Debug / verbose deploy (live Cloud Build logs):**
  Append `--debug` to any command above.

---

## Critical Anti-Patterns & Guardrails

### 1 — The TypeScript Compilation Trap (Stale Artifacts)

**Problem:** The Firebase CLI deploys from `functions/lib/` (set by `"main": "lib/index.js"` in `functions/package.json`). Editing `functions/src/` does not automatically rebuild `lib/` when running `firebase deploy` from the project root. The CLI compares hashes against the stale compiled output and silently reports `Skipped (No changes detected)` — even when significant source changes exist.

**Guardrail:** Always compile explicitly before deploying. Incremental compilation is enabled (`tsconfig.json` → `incremental: true`, `tsBuildInfoFile: "./.tsbuildinfo"`) so subsequent builds only reprocess changed files.

```bash
# Always use this one-liner for any functions/src/ change:
cd functions && npm run build && cd .. && firebase deploy --only functions:<name> --project botridge
```

**Detection:** If `lib/index.js` timestamp is older than `src/index.ts`, the build is stale. Run `ls -la functions/lib/` vs `functions/src/index.ts` to confirm.

---

### 2 — The Signature Mutation Boundary (onCall → onRequest)

**Problem:** Google Cloud does not allow an existing live function instance to change its trigger topology in place. Migrating from `onCall` (Firebase SDK callable envelope) to `onRequest` (raw HTTP) while the old instance is live causes a deployment-blocking infrastructure conflict — the CLI cannot overwrite the Cloud Run trigger binding.

**Guardrail:** Explicitly delete the legacy instance first so the new HTTPS signature can occupy the namespace cleanly.

```bash
firebase functions:delete <functionName> --project botridge --force
cd functions && npm run build && cd .. && firebase deploy --only functions:<functionName> --project botridge
firebase functions:list --project botridge   # verify: should show "https", not "callable"
```

**Detection:** `firebase functions:list` shows `callable` after a deploy that was supposed to produce `https`. The delete-then-redeploy sequence is the only resolution.

---

### 3 — Eager vs. Lazy Edge Routing (firebase.json rewrites)

**Problem:** Using the nested `"run": { "serviceId": "..." }` block in `firebase.json` rewrites triggers eager validation during the hosting deploy pass. The CLI resolves the Cloud Run service name at deploy time — if the name is wrong, off-cased, or hasn't been deployed yet, the build throws `Unable to find a valid endpoint`. Firebase Functions v2 also normalise camelCase export names to lowercase for Cloud Run service IDs (`transcribeMeal` → `transcribemeal`), making the exact name hard to predict without `functions:list`.

**Guardrail:** Use the flat string `"function": "exactExportName"` syntax. This evaluates lazily at request time, bypasses deploy-time name resolution, and correctly proxies same-origin traffic to the container.

```json
{
  "source": "/api/transcribeMeal",
  "function": "transcribeMeal"
}
```

The export name must match the identifier used in `export const <name> = onRequest(...)` in `functions/src/index.ts` exactly — camelCase preserved.

---

## Same-Origin Architecture Blueprint

Reusable infrastructure matrix for AI-native web applications on Firebase + Cloud Run.

```
┌─────────────────────────────────────────────────────────────────┐
│                        BROWSER CLIENT                           │
│   Next.js (output: 'export') — fully static, no SSR runtime    │
│   All data: Firebase SDK (Auth, Firestore) + fetch(/api/*)      │
└────────────────────────┬────────────────────────────────────────┘
                         │ HTTPS (same origin)
┌────────────────────────▼────────────────────────────────────────┐
│                  FIREBASE HOSTING (CDN)                         │
│   Serves static export from /out                                │
│   Rewrite rules — lazy, request-time resolution:               │
│     /api/transcribeMeal  → function: "transcribeMeal"           │
│     /api/generateInsight → function: "generateInsight"          │
│     **                   → /index.html  (SPA catch-all, LAST)   │
│                                                                 │
│   ⚠ Rewrite order is evaluated top-to-bottom.                  │
│     Function rules must always precede the ** catch-all.        │
└────────────────────────┬────────────────────────────────────────┘
                         │ Proxied — no CORS preflight
┌────────────────────────▼────────────────────────────────────────┐
│            CLOUD RUN BACKEND (Firebase Gen 2 onRequest)         │
│                                                                 │
│   Each function is an independent onRequest handler:            │
│   export const transcribeMeal = onRequest({ cors: true }, ...)  │
│   export const generateInsight = onRequest({ cors: true }, ...) │
│                                                                 │
│   Polymorphic path guard (handles both invocation modes):       │
│     if (req.path !== '/' && req.path !== '/api/<name>') 404     │
│                                                                 │
│   Auth: manual Bearer token → admin.auth().verifyIdToken()      │
│   Secrets: firebase-functions defineSecret() → Secret Manager  │
│   AI: GoogleGenAI({ apiKey: GEMINI_API_KEY.value() })           │
└─────────────────────────────────────────────────────────────────┘
```

### Why each layer exists

| Decision | Reason |
|---|---|
| `output: 'export'` | Zero server runtime cost; Firebase Hosting serves pure static files from a global CDN |
| Hosting rewrites as reverse proxy | Eliminates CORS preflight entirely — browser sees all traffic as same-origin |
| `"function": "name"` (flat string) | Lazy resolution avoids deploy-time validation failures; survives cold caches |
| `onRequest` over `onCall` | Works with hosting rewrites + plain `fetch`; `onCall` requires the Firebase SDK's proprietary envelope and routes to `cloudfunctions.net` directly, bypassing the proxy |
| `cors: true` on `onRequest` | Allows direct invocation from `localhost:3000` during development without modifying production endpoints |
| Polymorphic path guard | Same handler resolves correctly whether hit via the hosting proxy (`/api/name`) or directly via its Cloud Functions URL (`/`) |
| Bearer token auth | `onRequest` has no built-in auth injection; Admin SDK `verifyIdToken()` provides equivalent security with explicit `uid` extraction |

### Client-side fetch wrapper pattern

All `onRequest` functions use this wrapper shape in `lib/firebase/functions.ts` — preserves the `{ data }` destructuring convention used throughout the app:

```typescript
export async function exampleFn(input: Input): Promise<{ data: Result }> {
  const idToken = await auth.currentUser!.getIdToken();
  const response = await fetch("/api/exampleEndpoint", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${idToken}`,
    },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? `Request failed (${response.status})`);
  }
  return { data: await response.json() };
}
```

### Development loop

```bash
# Frontend
npm run dev                          # Next.js on localhost:3000

# Functions (watch mode)
cd functions && npm run build:watch  # recompiles on save

# Targeted deploy after any backend change
cd functions && npm run build && cd .. && firebase deploy --only functions:<name> --project botridge

# Verify trigger types after migration
firebase functions:list --project botridge
# callable = onCall (Firebase SDK)   https = onRequest (plain HTTP)
```

---

## Verify Live Triggers

```bash
firebase functions:list --project botridge
```

`callable` = onCall · `https` = onRequest. If a migrated function still shows `callable` after a redeploy, the old footprint was not cleared — run the delete sequence from Anti-Pattern #2.
