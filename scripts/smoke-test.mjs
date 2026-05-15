/**
 * Smoke test for parseMeal + generateInsight Cloud Functions.
 *
 * Prerequisites:
 *   1. Vertex AI API enabled in botridge project
 *      → https://console.cloud.google.com/apis/library/aiplatform.googleapis.com?project=botridge
 *   2. botridge@appspot.gserviceaccount.com has roles/aiplatform.user
 *      → run once:
 *        gcloud projects add-iam-policy-binding botridge \
 *          --member="serviceAccount:botridge@appspot.gserviceaccount.com" \
 *          --role="roles/aiplatform.user"
 *   3. A real user account exists (email + password) in Firebase Auth.
 *      Set TEST_EMAIL and TEST_PASSWORD below.
 *
 * Usage:
 *   TEST_EMAIL=you@example.com TEST_PASSWORD=yourpass node scripts/smoke-test.mjs
 */

import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { getFunctions, httpsCallable, connectFunctionsEmulator } from "firebase/functions";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "AIzaSyDuZc1yyLVc-LGwO1ycB3Nf04erCKJyw1o",
  authDomain: "botridge.firebaseapp.com",
  projectId: "botridge",
  storageBucket: "botridge.firebasestorage.app",
  messagingSenderId: "851146868663",
  appId: "1:851146868663:web:1af510d07f1ea540380a32",
};

const TEST_EMAIL = process.env.TEST_EMAIL;
const TEST_PASSWORD = process.env.TEST_PASSWORD;
const USE_EMULATOR = process.env.USE_EMULATOR === "true";

if (!TEST_EMAIL || !TEST_PASSWORD) {
  console.error("❌  Set TEST_EMAIL and TEST_PASSWORD environment variables.");
  process.exit(1);
}

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const functions = getFunctions(app, "us-central1");

if (USE_EMULATOR) {
  connectFunctionsEmulator(functions, "127.0.0.1", 5001);
  console.log("🔧  Using Functions emulator on port 5001");
}

async function run() {
  console.log("\n──────────────────────────────────────────");
  console.log("  BioFeedbackLoop · AI Functions Smoke Test");
  console.log("──────────────────────────────────────────\n");

  // 1. Auth
  process.stdout.write("1/3  Signing in… ");
  let user;
  try {
    const cred = await signInWithEmailAndPassword(auth, TEST_EMAIL, TEST_PASSWORD);
    user = cred.user;
    console.log(`✅  ${user.email}`);
  } catch (e) {
    console.error(`❌  Auth failed: ${e.message}`);
    process.exit(1);
  }

  // 2. parseMeal
  process.stdout.write("2/3  Calling parseMeal(\"Grilled chicken and black beans\")… ");
  try {
    const parseMeal = httpsCallable(functions, "parseMeal");
    const { data } = await parseMeal({ description: "Grilled chicken and black beans" });
    console.log("✅");
    console.log("\n     Returned payload:");
    console.log(`     protein_grams      : ${data.protein_grams}g`);
    console.log(`     calorie_range      : ${data.calorie_range_low}–${data.calorie_range_high} kcal`);
    console.log(`     satiety_potential  : ${data.satiety_potential} / 4`);
    console.log(`     confidence         : ${data.confidence}`);

    const ok =
      typeof data.protein_grams === "number" &&
      data.protein_grams > 0 &&
      data.satiety_potential >= 1 &&
      data.satiety_potential <= 4;

    if (!ok) {
      console.error("\n❌  Response shape looks wrong — check Vertex AI IAM / API enablement.");
      process.exit(1);
    }
  } catch (e) {
    console.error(`\n❌  parseMeal failed: ${e.message}`);
    console.error("     → Is Vertex AI API enabled? Does the service account have aiplatform.user?");
    process.exit(1);
  }

  // 3. generateInsight (no-signal path is fine — returns null insight)
  process.stdout.write("3/3  Calling generateInsight()… ");
  try {
    const generateInsight = httpsCallable(functions, "generateInsight");
    const { data } = await generateInsight({});
    const insight = data.insight;
    console.log("✅");
    if (insight) {
      console.log(`\n     Calm observation:\n     "${insight}"`);
    } else {
      console.log("\n     No signals logged yet — insight returned null (expected).");
    }
  } catch (e) {
    console.error(`\n❌  generateInsight failed: ${e.message}`);
    process.exit(1);
  }

  console.log("\n──────────────────────────────────────────");
  console.log("  ✅  All smoke tests passed.");
  console.log("──────────────────────────────────────────\n");
  process.exit(0);
}

run();
