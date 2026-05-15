# Changelog

All notable changes to BioFeedbackLoop are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [0.6.0] — 2026-05-14 · Phase 6: AI Estimation & Dashboard Stabilization

### Added
- **AI meal estimation** via `parseMeal` Cloud Function (Firebase Functions v2, `us-central1`)
  - Model: `gemini-2.5-flash` via Google Generative AI SDK (`@google/genai`)
  - Returns: `protein_grams`, `calorie_range_low/high`, `satiety_potential`, `confidence`
  - `thinkingConfig: { thinkingBudget: 0 }` prevents token budget exhaustion before JSON output
  - Response parts concatenated from `candidates[0].content.parts` (not `response.text` which returns only the first chunk)
- **`extractJSON` utility** in Cloud Function — strips markdown fences before `JSON.parse`
- **`AISuggestionPill`** component — accepts/dismisses AI estimates inline in the log form
- **`generateInsight` Cloud Function** — reads last 5 signals, returns a 2-sentence observational insight via Gemini
- **`CalmObservation`** dashboard component — surfaces AI insight with non-judgmental voice
- **`InsightsGraph`** dashboard component (Recharts)
  - Daily protein bar chart (last 7 days) with adjustable target reference line
  - Protein vs satiety scatter plot (last 7 days, per-meal granularity)
- **`DashboardErrorBoundary`** — React class Error Boundary wrapping each dashboard section independently
- **`toFirestore` utility** (`lib/firestore-helpers.ts`) — JSON round-trip sanitizer converting all `undefined` values to `null` before any `addDoc` call
- **`coercePayload`** in signal store — applies same sanitization to optimistic entries
- Meal time defaults to current local time on form mount; clock button highlights when time has been changed
- `portion` defaults to `"Medium"` pre-selected on mount
- `protein_est` surfaced in `RecentSignalsFeed` signal cards
- `payload` null-guard in `subscribeToSignals` — old documents with missing payload field no longer crash the render
- `!sig.payload` guard in `buildChartData`, `buildDailyProtein`, `buildScatterData`

### Fixed
- **Firestore `undefined` field rejection** — `Unsupported field value: undefined` on `payload.portion`, `payload.bloating`, etc. Root cause: all optional fields now explicitly written as `null` via `toFirestore`
- **`validSignal` Firestore rule** — added `|| data.payload.satiety == null` and `|| data.payload.energy_level == null` branches; previously rejected every write where the user skipped satiety/energy selection because `null is int` evaluates `false`
- **`ReferenceError: _ before initialization`** — `currentTime()` helper was declared with `const` inside `SignalInput` *after* two `useState` lazy initializers that called it. Moved to module-level `function` declaration (hoists fully, no TDZ)
- **Recharts TDZ crash** (`D before initialization`) — `BarChart`, `ScatterChart`, and `Cell` co-imported in one chunk created circular evaluation order in minified bundle. Fixed by lazy-loading `TrendChart` and `InsightsGraph` via `next/dynamic` with `ssr: false`
- **`mapEnergyLevel("")` edge case** — empty string no longer passed to the mapper when energy field is unset

### Changed
- **AI backend migrated from Vertex AI → Gemini API key** — Vertex AI requires publisher model provisioning per project; Gemini API (`generativelanguage.googleapis.com`) works with a standard API key stored as a Firebase Secret. Model names are Gemini API format (`gemini-2.5-flash`, not `gemini-2.5-flash-002`)
- `SignalPayload` interface widened — all optional fields now typed as `T | null` (not `T | undefined`) for consistency with Firestore storage
- `TrendChart` and `InsightsGraph` both lazy-loaded with `ssr: false`
- `RecentSignalsFeed` label: `hunger_return_hrs` now displays as "Satiety" (was "Hunger")

### Architecture
- Signal write path: `SignalInput` → `addSignal` (store, optimistic) → `writeSignal` → `toFirestore(payload)` → `addDoc`
- All signals scoped to `users/${uid}/signals` — uid sourced from `request.auth` context, never from client payload
- Firestore `onSnapshot` listener started/torn down in `AuthProvider` via `onAuthStateChanged`

---

## [0.5.0] — Phase 5: CMS, Journey, and Protein Calculator

### Added
- `founder_experiments` Firestore collection with seed data (8 experiment docs)
- `price_index` Firestore collection (ingredient protein-per-dollar data)
- `ExperimentsTimeline` and `ReflectionCard` components — live Firestore feed on `/journey`
- `ProteinCalculator` on `/meals` — live price index with cost-range slider filter
- Firestore rules: public read for `founder_experiments` (published only) and `price_index`
- GitHub Actions CI/CD (`.github/workflows/deploy.yml`) — Workload Identity Federation, deploys `hosting:biofeedbackloop` and `functions:biofeedbackloop`
- Dashboard sticky header restored with full site nav (Home, Philosophy, Journey, Meals)

---

## [0.1.0] — Project Bootstrap

- Next.js 15 App Router, static export (`output: 'export'`)
- Firebase Auth (Google SSO), Firestore, Functions v2
- Zustand signal store with optimistic UI and real-time `onSnapshot`
- Tailwind CSS design system (custom tokens: `ink`, `canvas`, `surface-*`, `accent-azure`, `accent-amber`)
- `buildChartData` aggregation (weekday averages: satiety hours, energy score, protein grams)
- `TrendChart` — Recharts line chart, falls back to sample data until first signal logged
