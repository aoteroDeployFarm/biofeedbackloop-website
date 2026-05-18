# BioFeedbackLoop

A personal signal-tracking app for observing how food affects satiety, energy, and metabolic patterns — without judgment. Log meals, get AI-estimated protein/calorie data, and surface patterns over time.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router, `output: 'export'`) |
| Hosting | Firebase Hosting (`biofeedbackloop` target, project `botridge`) |
| Auth | Firebase Auth — Google SSO |
| Database | Cloud Firestore — real-time, user-siloed (`users/${uid}/signals`) |
| Functions | Firebase Functions v2 (`onRequest` + `onCall`, `us-central1`) |
| AI | Google Generative AI SDK (`@google/genai`) — `gemini-2.5-flash` |
| State | Zustand with optimistic UI + Firestore `onSnapshot` |
| Charts | Recharts (lazy-loaded, `ssr: false`) |
| Styling | Tailwind CSS with custom design tokens |
| CI/CD | GitHub Actions + Workload Identity Federation |

---

## Local Development

```bash
npm install
npm run dev        # http://localhost:3000
```

To use the Firebase emulator suite:

```bash
firebase emulators:start
# set NEXT_PUBLIC_USE_EMULATOR=true in .env.local
```

---

## Project Structure

```
app/                   Next.js App Router pages
components/
  auth/                AuthProvider, AuthGuard
  dashboard/           LogDashboard, SignalInput, TrendChart,
                       InsightsGraph, RecentSignalsFeed,
                       CalmObservation, AISuggestionPill,
                       DashboardErrorBoundary
  journey/             ExperimentsTimeline, ReflectionCard
  meals/               ProteinCalculator
functions/src/
  index.ts             parseMeal (onCall), generateInsight, transcribeMeal (onRequest)
lib/
  firebase/            config, auth, firestore, functions (fetch wrappers)
  firestore-helpers.ts toFirestore() — undefined→null sanitizer
store/
  signalStore.ts       Zustand store, addSignal, updateSignal, buildChartData
firestore.rules        User-siloed rules, validSignal validator, payload-update rule
```

---

## Cloud Functions

### `parseMeal`
Accepts a free-text meal description, returns structured nutrition estimates.

- **Model**: `gemini-2.5-flash` (Gemini API, not Vertex AI)
- **Secret**: `GEMINI_API_KEY` (set via `firebase functions:secrets:set GEMINI_API_KEY`)
- **Output**: `protein_grams`, `calorie_range_low`, `calorie_range_high`, `satiety_potential` (1–4), `confidence`
- **Key detail**: `thinkingConfig: { thinkingBudget: 0 }` is required — without it, `gemini-2.5-flash` uses its thinking token budget before emitting JSON, causing truncated output

### `generateInsight`
Reads the user's last 5 signals from Firestore, returns a 2-sentence observational pattern insight.

- **Trigger**: `onRequest` (HTTP POST) — auth via Bearer token, `admin.auth().verifyIdToken()`
- **Voice**: Non-judgmental, systems-thinker perspective. Banned words: "great", "optimize", "should", "cheat"
- **Client**: `fetch("/api/generateInsight")` — same-origin via Firebase Hosting rewrite

### `transcribeMeal`
Accepts a base64-encoded audio blob, transcribes it via Gemini 2.5 Flash multimodal, returns plain text.

- **Trigger**: `onRequest` (HTTP POST) — auth via Bearer token
- **Input**: `{ audio: string (base64), mimeType: string }`
- **Output**: `{ text: string }`
- **Client**: `fetch("/api/transcribeMeal")` — same-origin via Firebase Hosting rewrite

---

## API Layer Architecture

The client communicates with all backend functions via **same-origin reverse-proxy routes** (`/api/*`) rather than cross-origin SDK calls. Firebase Hosting rewrites forward these requests to the appropriate Cloud Function at request time, completely eliminating CORS preflight checks in production.

```
Browser → /api/transcribeMeal  ─┐
Browser → /api/generateInsight ─┤─ Firebase Hosting rewrites ──► Cloud Run (onRequest)
Browser → Firestore SDK         ┘  (same origin, no preflight)
```

`parseMeal` remains `onCall` (Firebase SDK) as it is invoked in the background and does not require the same-origin proxy.

---

## Data Model

```
users/{uid}/
  signals/{signalId}
    type: "meal" | "movement" | "sensation"
    timestamp: Timestamp
    payload:
      foods: string | null
      satiety: 1|2|3|4 | null   (1=light, 4=stuffed)
      portion: string | null
      hunger_return_hrs: number | null
      energy_level: number | null  (mapped: low=3, moderate=5, steady=7, high=9)
      bloating: string | null
      protein_est: number | null   (grams)
      cost_est: number | null      (USD)
      notes: string | null

founder_experiments/{docId}   — public CMS, /journey page
price_index/{docId}           — public CMS, /meals calculator
```

All payload fields are written as `null` (never `undefined`) via `toFirestore()` in `lib/firestore-helpers.ts`.

---

## Firestore Rules

Signals support **payload-only updates** for delayed telemetry (energy, hunger return, bloating logged after the meal). The `update` rule allows patching sub-fields as long as `type` and `timestamp` are unchanged. `delete` remains denied. The `validSignal` function validates type, required keys, and numeric ranges on create.

---

## Deployment

```bash
# Frontend only
firebase deploy --only hosting --project botridge

# Single function (always compile first)
cd functions && npm run build && cd .. && firebase deploy --only functions:transcribeMeal --project botridge
cd functions && npm run build && cd .. && firebase deploy --only functions:generateInsight --project botridge

# Rules only (no build needed)
firebase deploy --only firestore:rules --project botridge

# Full deploy
cd functions && npm run build && cd ..
firebase deploy --only hosting,functions,firestore:rules --project botridge
```

> See `CLAUDE.md` for the full deployment SOP, trigger-migration procedure, and incremental build notes.

---

## Design Tokens

Custom Tailwind tokens defined in `tailwind.config.ts`:

| Token | Use |
|---|---|
| `ink` / `ink-light` / `ink-faint` | Text hierarchy |
| `canvas` | Page background (off-white) |
| `surface-warm` / `surface-muted` | Card backgrounds, borders |
| `accent-azure` | Primary interactive / AI indicators |
| `accent-amber` | Energy / secondary signals |
