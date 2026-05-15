"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Mail, Lock, ArrowRight, AlertCircle } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  signInWithGoogle,
  signInWithEmail,
  registerWithEmail,
  resetPassword,
} from "@/lib/firebase/auth";
import { cn } from "@/lib/utils";

type Mode = "signin" | "register" | "reset";

const modeLabels: Record<Mode, string> = {
  signin: "Continue",
  register: "Create account",
  reset: "Send reset link",
};

export default function LoginPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [resetSent, setResetSent] = useState(false);

  // Redirect already-authenticated users
  useEffect(() => {
    if (!loading && user) router.replace("/log");
  }, [user, loading, router]);

  async function handleGoogle() {
    setError("");
    setBusy(true);
    try {
      await signInWithGoogle();
      router.replace("/log");
    } catch (e) {
      setError(humanizeError(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (mode === "reset") {
        await resetPassword(email);
        setResetSent(true);
      } else if (mode === "register") {
        await registerWithEmail(email, password);
        router.replace("/log");
      } else {
        await signInWithEmail(email, password);
        router.replace("/log");
      }
    } catch (e) {
      setError(humanizeError(e));
    } finally {
      setBusy(false);
    }
  }

  if (loading || user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-canvas">
        <div className="w-7 h-7 rounded-full border-2 border-accent-azure border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-canvas flex flex-col">
      {/* Quiet header */}
      <header className="container-site py-5">
        <Link href="/" className="flex items-center gap-2 w-fit group">
          <span className="w-6 h-6 rounded-full bg-accent-azure/20 flex items-center justify-center">
            <span className="w-2.5 h-2.5 rounded-full bg-accent-azure block group-hover:scale-110 transition-transform" />
          </span>
          <span className="font-serif text-base font-semibold text-ink tracking-tight">
            BioFeedbackLoop
          </span>
        </Link>
      </header>

      {/* Form card */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm space-y-8">
          {/* Heading */}
          <div>
            <p className="label-caps mb-3">
              {mode === "signin" ? "Welcome back" : mode === "register" ? "Getting started" : "Password reset"}
            </p>
            <h1 className="font-serif text-heading-1 text-ink leading-snug">
              {mode === "signin"
                ? "Resume your observation."
                : mode === "register"
                ? "Start documenting your signals."
                : "We'll send you a link."}
            </h1>
            {mode === "signin" && (
              <p className="font-sans text-body-sm text-ink-light mt-3 leading-relaxed">
                Your data is private, per-user, and never shared.
              </p>
            )}
          </div>

          {/* Google OAuth */}
          {mode !== "reset" && (
            <button
              type="button"
              onClick={handleGoogle}
              disabled={busy}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl border border-surface-muted bg-white hover:bg-surface-warm transition-colors font-sans text-body-sm text-ink disabled:opacity-50"
            >
              {/* Google "G" icon */}
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
                <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4"/>
                <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853"/>
                <path d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332Z" fill="#FBBC05"/>
                <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.163 6.656 3.58 9 3.58Z" fill="#EA4335"/>
              </svg>
              Continue with Google
            </button>
          )}

          {/* Divider */}
          {mode !== "reset" && (
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-surface-muted" />
              <p className="label-caps text-ink-faint">or</p>
              <div className="flex-1 h-px bg-surface-muted" />
            </div>
          )}

          {/* Email form */}
          <form onSubmit={handleEmail} className="space-y-4">
            {/* Email */}
            <div className="space-y-1.5">
              <label className="label-caps block">Email address</label>
              <div className="relative">
                <Mail
                  size={15}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint"
                />
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-surface-muted bg-surface-warm font-sans text-body-sm text-ink placeholder:text-ink-faint focus:outline-none focus:border-accent-azure"
                />
              </div>
            </div>

            {/* Password (not shown for reset) */}
            {mode !== "reset" && (
              <div className="space-y-1.5">
                <label className="label-caps block">Password</label>
                <div className="relative">
                  <Lock
                    size={15}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint"
                  />
                  <input
                    type="password"
                    required
                    autoComplete={mode === "register" ? "new-password" : "current-password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={mode === "register" ? "Create a password" : "Your password"}
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-surface-muted bg-surface-warm font-sans text-body-sm text-ink placeholder:text-ink-faint focus:outline-none focus:border-accent-azure"
                  />
                </div>
              </div>
            )}

            {/* Reset success */}
            {resetSent && (
              <div className="p-3 rounded-xl bg-accent-azure/10 border border-accent-azure/20">
                <p className="font-sans text-body-sm text-accent-azure">
                  Check your inbox — a reset link is on its way.
                </p>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-100">
                <AlertCircle size={15} className="text-red-400 mt-0.5 shrink-0" />
                <p className="font-sans text-body-sm text-red-600">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={busy || resetSent}
              className={cn(
                "w-full btn-primary justify-center",
                (busy || resetSent) && "opacity-50 cursor-not-allowed"
              )}
            >
              {busy ? "One moment…" : modeLabels[mode]}
              {!busy && <ArrowRight size={15} />}
            </button>
          </form>

          {/* Mode switchers */}
          <div className="flex flex-col items-center gap-2 text-body-sm font-sans">
            {mode === "signin" && (
              <>
                <button
                  type="button"
                  onClick={() => { setMode("register"); setError(""); }}
                  className="text-ink-light hover:text-ink transition-colors"
                >
                  No account yet? Create one.
                </button>
                <button
                  type="button"
                  onClick={() => { setMode("reset"); setError(""); setResetSent(false); }}
                  className="text-ink-faint hover:text-ink-light transition-colors"
                >
                  Forgot password
                </button>
              </>
            )}
            {(mode === "register" || mode === "reset") && (
              <button
                type="button"
                onClick={() => { setMode("signin"); setError(""); setResetSent(false); }}
                className="text-ink-light hover:text-ink transition-colors"
              >
                Back to sign in
              </button>
            )}
          </div>
        </div>
      </main>

      <footer className="container-site py-5 text-center">
        <p className="font-sans text-label text-ink-faint">
          No calorie counting. No shame spirals. Just signals.
        </p>
      </footer>
    </div>
  );
}

function humanizeError(e: unknown): string {
  const code = (e as { code?: string })?.code ?? "";
  const map: Record<string, string> = {
    "auth/user-not-found": "No account found with that email.",
    "auth/wrong-password": "That password isn't right.",
    "auth/email-already-in-use": "An account with that email already exists.",
    "auth/weak-password": "Password must be at least 6 characters.",
    "auth/invalid-email": "That doesn't look like a valid email address.",
    "auth/too-many-requests": "Too many attempts — please wait a moment.",
    "auth/popup-closed-by-user": "Sign-in window was closed.",
    "auth/cancelled-popup-request": "",
  };
  return map[code] || (e instanceof Error ? e.message : "Something went wrong. Try again.");
}
