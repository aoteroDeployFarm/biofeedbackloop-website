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
| Functions | Firebase Functions v2 (`onCall`, `us-central1`) |
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
  index.ts             parseMeal, generateInsight (Cloud Functions v2)
lib/
  firebase/            config, auth, firestore, functions
  firestore-helpers.ts toFirestore() — undefined→null sanitizer
store/
  signalStore.ts       Zustand store + buildChartData aggregation
firestore.rules        User-siloed rules + validSignal validator
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

- **Voice**: Non-judgmental, systems-thinker perspective. Banned words: "great", "optimize", "should", "cheat"

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

Signals are **append-only** — `update` and `delete` are denied at the rules layer. The `validSignal` function validates type, required keys, and numeric ranges for optional fields (all of which also accept `null`).

---

## Deployment

```bash
# Full deploy (hosting + functions + rules)
npm run build
firebase deploy --only hosting:biofeedbackloop,functions:biofeedbackloop,firestore:rules --project botridge

# Rules only (instant, no build needed)
firebase deploy --only firestore:rules --project botridge
```

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
