"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, User, ShieldCheck } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { signOut } from "@/lib/firebase/auth";
import { useSignalStore } from "@/store/signalStore";
import SignalInput from "./SignalInput";
import RecentSignalsFeed from "./RecentSignalsFeed";
import CalmObservation from "./CalmObservation";
import InsightsCard from "./InsightsCard";
import DashboardErrorBoundary from "./DashboardErrorBoundary";
import dynamic from "next/dynamic";

// Both chart components use Recharts which accesses `window` and has internal
// circular module references that trigger TDZ crashes in the minified bundle.
// ssr:false ensures they only evaluate in the browser, after hydration.
const TrendChart = dynamic(() => import("./TrendChart"), {
  ssr: false,
  loading: () => <div className="h-64 rounded-3xl bg-surface-muted animate-pulse" />,
});

const InsightsGraph = dynamic(() => import("./InsightsGraph"), {
  ssr: false,
  loading: () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="h-64 rounded-3xl bg-surface-muted animate-pulse" />
      <div className="h-64 rounded-3xl bg-surface-muted animate-pulse" />
    </div>
  ),
});

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/philosophy", label: "Philosophy" },
  { href: "/journey", label: "Journey" },
  { href: "/meals", label: "Meals" },
];

export default function LogDashboard() {
  const { user, isAdmin } = useAuth();
  const { signals, error } = useSignalStore();
  const pathname = usePathname();

  const mealCount = signals.filter((s) => s.type === "meal").length;

  async function handleSignOut() {
    await signOut();
  }

  return (
    <div className="min-h-screen bg-surface-warm">
      {/* Dashboard header */}
      <header className="bg-canvas border-b border-surface-muted sticky top-0 z-40">
        <div className="container-site flex items-center justify-between h-14">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2 group shrink-0">
              <span className="w-5 h-5 rounded-full bg-accent-azure/20 flex items-center justify-center">
                <span className="w-2 h-2 rounded-full bg-accent-azure block" />
              </span>
              <span className="font-serif text-sm font-semibold text-ink">BioFeedbackLoop</span>
            </Link>

            {isAdmin && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent-azure/10 border border-accent-azure/20 shrink-0">
                <ShieldCheck size={11} className="text-accent-azure" />
                <span className="label-caps text-accent-azure" style={{ fontSize: "10px" }}>Admin</span>
              </span>
            )}

            {/* Site nav — hidden on small screens */}
            <nav className="hidden lg:flex items-center gap-1 ml-2">
              {navLinks.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className={`px-3 py-1.5 rounded-lg font-sans text-body-sm transition-colors ${
                    pathname === l.href
                      ? "text-ink font-medium bg-surface-warm"
                      : "text-ink-faint hover:text-ink hover:bg-surface-warm"
                  }`}
                >
                  {l.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 text-ink-faint">
              <User size={13} />
              <span className="font-sans text-body-sm">{user?.displayName || user?.email}</span>
            </div>
            <button
              onClick={handleSignOut}
              className="btn-ghost text-body-sm py-1.5 px-3"
            >
              <LogOut size={14} />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="container-site py-8 space-y-8">
        {/* Summary bar */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="label-caps mb-1">Your Signal Log</p>
            <h1 className="font-serif text-heading-1 text-ink">
              {mealCount === 0
                ? "Start your first observation."
                : `${mealCount} meal ${mealCount === 1 ? "signal" : "signals"} logged.`}
            </h1>
          </div>
          <p className="font-sans text-body-sm text-ink-light">
            Last 14 days · Observation over judgment
          </p>
        </div>

        {/* Error banner */}
        {error && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-100">
            <p className="font-sans text-body-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Input + chart row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <DashboardErrorBoundary><SignalInput /></DashboardErrorBoundary>
          <DashboardErrorBoundary><TrendChart /></DashboardErrorBoundary>
        </div>

        {/* Programmatic pattern observations */}
        <DashboardErrorBoundary><InsightsCard /></DashboardErrorBoundary>

        {/* AI Calm Observation */}
        <DashboardErrorBoundary><CalmObservation /></DashboardErrorBoundary>

        {/* Chart view */}
        <DashboardErrorBoundary><InsightsGraph /></DashboardErrorBoundary>

        {/* Recent feed */}
        <DashboardErrorBoundary><RecentSignalsFeed /></DashboardErrorBoundary>
      </main>
    </div>
  );
}
