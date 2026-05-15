/**
 * Seed script — populates founder_experiments and price_index collections.
 *
 * Prerequisites:
 *   - Application Default Credentials configured:
 *       gcloud auth application-default login
 *   - Or: GOOGLE_APPLICATION_CREDENTIALS env var pointing to a service account key
 *
 * Usage:
 *   node scripts/seed.mjs
 *   node scripts/seed.mjs --dry-run   (print docs without writing)
 */

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

const DRY_RUN = process.argv.includes("--dry-run");

if (!getApps().length) {
  initializeApp({ projectId: "botridge" });
}

const db = getFirestore();

// ── founder_experiments ───────────────────────────────────────────────────────

const experiments = [
  {
    order: 1,
    period: "Late 50s",
    topic: "Energy & Drift",
    title: "Noticing the drift",
    signal: "Energy that used to be reliable started shifting. Not dramatically — just a persistent sense that something in the feedback loop had changed. The old heuristics weren't holding.",
    insight: "The drift wasn't motivation or willpower. It was a measurement problem. I had no data — only a vague sense that something was different. You can't course-correct what you haven't measured.",
    published: true,
  },
  {
    order: 2,
    period: "Turning 60",
    topic: "Documentation Practice",
    title: "Choosing documentation over discipline",
    signal: "Rather than a new protocol or a stricter plan, I started writing things down. When I ate, what I ate, how I felt two hours later. No judgment — just timestamped observations.",
    insight: "Documentation without judgment turned out to be harder than it sounds. Every entry wanted to become an evaluation. Keeping it purely observational — 'this happened, then this happened' — was the actual practice.",
    published: true,
  },
  {
    order: 3,
    period: "Month 3",
    topic: "Pattern Recognition",
    title: "Patterns emerged without forcing them",
    signal: "Certain protein combinations sustained satiety for four hours. Carbohydrates alone produced a predictable two-hour window. Sleep quality tracked against dinner timing, not dinner content.",
    insight: "The patterns only became visible because I stopped trying to find them. When you're looking for confirmation of a hypothesis, you find it. When you're just recording, you find what's actually there.",
    published: true,
  },
  {
    order: 4,
    period: "Ongoing",
    topic: "Systems Thinking",
    title: "Systems thinking applied to a body",
    signal: "A body is a feedback system. Inputs produce outputs on a delay. The gap between eating and energy return is a measurement, not a moral statement.",
    insight: "The most useful reframe was treating the delay itself as information. A two-hour hunger return after a meal isn't a failure — it's a data point. The question becomes: is this the window I want for this time of day?",
    published: true,
  },
];

// ── price_index ───────────────────────────────────────────────────────────────
// protein_g: grams of protein per typical serving
// cost_usd: cost per typical serving in USD
// serving_desc: human-readable serving size

const priceIndex = [
  {
    name: "Canned Tuna (5oz)",
    category: "Protein",
    protein_g: 34,
    cost_usd: 1.80,
    serving_desc: "1 can (142g)",
    satiety_hrs_est: 3.5,
  },
  {
    name: "Eggs (2 large)",
    category: "Protein",
    protein_g: 12,
    cost_usd: 0.60,
    serving_desc: "2 eggs",
    satiety_hrs_est: 2.5,
  },
  {
    name: "Sardines in olive oil",
    category: "Protein",
    protein_g: 23,
    cost_usd: 2.20,
    serving_desc: "1 can (106g)",
    satiety_hrs_est: 4.0,
  },
  {
    name: "Full-fat Greek yogurt",
    category: "Dairy",
    protein_g: 18,
    cost_usd: 1.50,
    serving_desc: "1 cup (245g)",
    satiety_hrs_est: 2.5,
  },
  {
    name: "Black beans (½ cup cooked)",
    category: "Legume",
    protein_g: 8,
    cost_usd: 0.40,
    serving_desc: "½ cup (86g)",
    satiety_hrs_est: 2.0,
  },
  {
    name: "Chicken breast (4oz)",
    category: "Protein",
    protein_g: 35,
    cost_usd: 2.00,
    serving_desc: "4oz (113g) cooked",
    satiety_hrs_est: 4.0,
  },
  {
    name: "Cottage cheese",
    category: "Dairy",
    protein_g: 14,
    cost_usd: 0.90,
    serving_desc: "½ cup (113g)",
    satiety_hrs_est: 2.5,
  },
  {
    name: "Lentils (½ cup cooked)",
    category: "Legume",
    protein_g: 9,
    cost_usd: 0.35,
    serving_desc: "½ cup (99g)",
    satiety_hrs_est: 3.0,
  },
];

// ── helpers ───────────────────────────────────────────────────────────────────

function log(collection, id, data) {
  console.log(`  [${collection}] ${id}`);
  if (DRY_RUN) {
    console.log("   ", JSON.stringify(data, null, 2).split("\n").join("\n    "));
  }
}

async function seedCollection(collectionName, docs, idFn) {
  console.log(`\nSeeding /${collectionName} (${docs.length} docs)…`);
  const col = db.collection(collectionName);

  for (const doc of docs) {
    const id = idFn(doc);
    const payload = { ...doc, updated_at: Timestamp.now() };
    log(collectionName, id, payload);
    if (!DRY_RUN) {
      await col.doc(id).set(payload, { merge: true });
    }
  }
}

// ── run ───────────────────────────────────────────────────────────────────────

async function run() {
  console.log("\n──────────────────────────────────────────────────");
  console.log("  BioFeedbackLoop · Firestore Seed Script");
  if (DRY_RUN) console.log("  DRY RUN — no writes will occur");
  console.log("──────────────────────────────────────────────────");

  await seedCollection(
    "founder_experiments",
    experiments,
    (doc) => `exp-${String(doc.order).padStart(2, "0")}`
  );

  await seedCollection(
    "price_index",
    priceIndex,
    (doc) => doc.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")
  );

  console.log("\n──────────────────────────────────────────────────");
  console.log(DRY_RUN ? "  Dry run complete." : "  ✅  Seed complete.");
  console.log("──────────────────────────────────────────────────\n");
}

run().catch((err) => {
  console.error("❌  Seed failed:", err);
  process.exit(1);
});
