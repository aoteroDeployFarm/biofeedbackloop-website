"use client";

import Link from "next/link";
import { ArrowRight, TrendingUp, Clock, Zap } from "lucide-react";

const signals = [
  { icon: Clock, label: "12:34 PM", value: "Lunch logged", note: "Mixed greens, lentils, olive oil" },
  { icon: TrendingUp, label: "3 hrs later", value: "Energy: steady", note: "No afternoon crash today" },
  { icon: Zap, label: "Pattern noticed", value: "Protein + fat = 4hr satiety", note: "Third week confirming this" },
];

export default function HeroSection() {
  return (
    <section className="relative min-h-screen flex flex-col justify-center overflow-hidden pt-16">
      {/* Background gradient */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 70% 50% at 60% 40%, rgba(122,145,141,0.08) 0%, transparent 70%), radial-gradient(ellipse 50% 40% at 20% 70%, rgba(212,163,115,0.06) 0%, transparent 60%)",
        }}
      />

      <div className="container-site relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center min-h-[calc(100vh-4rem)] py-20">
          {/* Left: narrative copy */}
          <div className="space-y-8 animate-fade-in">
            <div>
              <p className="label-caps mb-5">A Calm Health Operating System</p>
              <h1 className="font-serif text-display-1 text-ink leading-[1.05] tracking-tight">
                Turn Daily{" "}
                <span className="text-accent-azure">Signals</span>
                <br />
                Into Long-Term{" "}
                <span className="text-accent-amber">Health</span>
              </h1>
            </div>

            <p className="prose-narrative text-ink-light max-w-prose-narrow">
              Your body is already communicating—hunger timing, energy
              patterns, sleep quality. BioFeedbackLoop gives you a quiet place
              to listen, document, and recognize what works.{" "}
              <em>No optimization required.</em>
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
              <Link href="/log" className="btn-primary">
                Begin Observing
                <ArrowRight size={16} />
              </Link>
              <a href="#how-it-works" className="btn-ghost">
                See how it works
              </a>
            </div>

            {/* Trust signal */}
            <div className="pt-4 border-t border-surface-muted">
              <p className="text-body-sm text-ink-faint">
                No calorie counting &nbsp;&bull;&nbsp; No shame spirals &nbsp;&bull;&nbsp; No optimization theater
              </p>
            </div>
          </div>

          {/* Right: live signal preview */}
          <div className="flex flex-col gap-4 lg:pl-8 animate-slide-up">
            <p className="label-caps text-center lg:text-left mb-2">
              What a log entry looks like
            </p>
            {signals.map((s, i) => (
              <div
                key={i}
                className="card-base flex items-start gap-4"
                style={{ animationDelay: `${i * 120}ms` }}
              >
                <div className="w-9 h-9 rounded-xl bg-surface-warm flex items-center justify-center shrink-0">
                  <s.icon size={18} className="text-accent-azure" />
                </div>
                <div>
                  <p className="label-caps text-ink-faint">{s.label}</p>
                  <p className="font-sans text-body-sm font-medium text-ink mt-0.5">
                    {s.value}
                  </p>
                  <p className="font-sans text-body-sm text-ink-light">{s.note}</p>
                </div>
              </div>
            ))}

            {/* Closing note */}
            <div className="px-4 py-3 rounded-xl bg-accent-azure/10 border border-accent-azure/20">
              <p className="text-body-sm text-accent-azure font-medium">
                Pattern recognized after 3 weeks of consistent logging.
                No app told you what to eat.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Scroll cue */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-ink-faint">
        <p className="label-caps">Scroll to explore</p>
        <div className="w-px h-8 bg-gradient-to-b from-ink-faint to-transparent" />
      </div>
    </section>
  );
}
