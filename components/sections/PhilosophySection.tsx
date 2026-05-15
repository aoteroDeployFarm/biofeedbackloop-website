"use client";

import {
  Eye,
  GitBranch,
  Clock,
  Heart,
  BarChart2,
  Layers,
  Sun,
  MessageSquare,
  Compass,
} from "lucide-react";

const principles = [
  {
    icon: Eye,
    title: "Observation Over Judgment",
    body: "A meal is an event with measurable downstream effects. It is not a moral act. Record what happened. Let patterns form before drawing conclusions.",
    color: "accent-azure",
  },
  {
    icon: Clock,
    title: "Timing Is the Variable",
    body: "When you eat matters as much as what you eat. The two-hour vs. four-hour satiety window is not about willpower — it's about macronutrient composition. Document the intervals.",
    color: "accent-amber",
  },
  {
    icon: GitBranch,
    title: "Feedback Loops, Not Rules",
    body: "Rules require compliance. Feedback loops require curiosity. One produces shame when broken; the other produces data. We build systems that generate data.",
    color: "accent-azure",
  },
  {
    icon: BarChart2,
    title: "Patterns Over Compliance",
    body: "A missed log is not a failure. An inconsistent week is still a week of data. Trends emerge from honesty, not from perfect adherence to a tracking protocol.",
    color: "accent-amber",
  },
  {
    icon: Layers,
    title: "The Body as a System",
    body: "Inputs (food, sleep, stress, movement) produce outputs (energy, hunger, recovery) on a delay. Understanding the delay — not eliminating the variation — is the work.",
    color: "accent-azure",
  },
  {
    icon: Heart,
    title: "No Shame, Only Signals",
    body: "Hunger at 10pm is a signal, not a character flaw. Fatigue after lunch is information about macronutrient timing. Reframe the language, and the experience shifts.",
    color: "accent-amber",
  },
  {
    icon: Sun,
    title: "Sustainable By Design",
    body: "A log you abandon is not useful. The interface must be frictionless enough to use every day, plain enough to be honest in, and calm enough not to add cognitive load.",
    color: "accent-azure",
  },
  {
    icon: MessageSquare,
    title: "Language Shapes Experience",
    body: "\"Cheat day\" creates shame. \"High-carbohydrate day\" creates data. Every word in this system is chosen to keep the user in observer mode, not judge mode.",
    color: "accent-amber",
  },
  {
    icon: Compass,
    title: "Self-Knowledge Is the Goal",
    body: "The point is not to eat perfectly. The point is to understand how your body works well enough that your choices become informed rather than reactive.",
    color: "accent-azure",
  },
];

export default function PhilosophySection() {
  return (
    <section id="philosophy" className="section-spacer">
      <div className="container-site">
        {/* Header */}
        <div className="max-w-prose mx-auto text-center mb-16">
          <p className="label-caps mb-4">Core Principles</p>
          <h2 className="font-serif text-display-2 text-ink mb-5 leading-tight">
            Nine Ways of Paying Attention
          </h2>
          <p className="font-sans text-body-lg text-ink-light leading-relaxed">
            These aren&rsquo;t rules. They&rsquo;re the conceptual frame that
            makes the rest of the system coherent. Read one slowly, then continue.
          </p>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {principles.map((p, i) => (
            <div
              key={i}
              className="group relative card-base overflow-hidden cursor-default"
            >
              {/* Subtle background accent on hover */}
              <div
                className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 ${
                  p.color === "accent-azure"
                    ? "bg-gradient-to-br from-accent-azure/5 to-transparent"
                    : "bg-gradient-to-br from-accent-amber/5 to-transparent"
                }`}
              />

              <div className="relative z-10">
                {/* Icon + number */}
                <div className="flex items-center justify-between mb-4">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      p.color === "accent-azure"
                        ? "bg-accent-azure/10"
                        : "bg-accent-amber/10"
                    }`}
                  >
                    <p.icon
                      size={20}
                      className={
                        p.color === "accent-azure"
                          ? "text-accent-azure"
                          : "text-accent-amber"
                      }
                    />
                  </div>
                  <span className="font-sans text-label text-ink-faint tabular-nums">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                </div>

                <h3 className="font-serif text-heading-2 text-ink mb-3 leading-snug">
                  {p.title}
                </h3>
                <p className="font-sans text-body-sm text-ink-light leading-relaxed">
                  {p.body}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
