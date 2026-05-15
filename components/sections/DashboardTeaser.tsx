import Link from "next/link";
import { ArrowRight, Utensils, Zap, Clock, Dumbbell, Moon } from "lucide-react";

const cycle = [
  { icon: Utensils, label: "Meal", color: "accent-amber" },
  { icon: Zap, label: "Energy", color: "accent-azure" },
  { icon: Clock, label: "Hunger", color: "accent-amber" },
  { icon: Dumbbell, label: "Workout", color: "accent-azure" },
  { icon: Moon, label: "Sleep", color: "accent-amber" },
];

export default function DashboardTeaser() {
  return (
    <section className="section-spacer">
      <div className="container-site">
        <div className="max-w-3xl mx-auto text-center">
          <p className="label-caps mb-4">The Signal Logger</p>
          <h2 className="font-serif text-display-2 text-ink mb-5 leading-tight">
            Five Signals. One Continuous Cycle.
          </h2>
          <p className="font-sans text-body-lg text-ink-light leading-relaxed mb-12">
            Log what you eat, how you feel afterward, and when hunger returns.
            Patterns surface in days, not months.
          </p>

          {/* Mini cycle visualization */}
          <div className="flex items-center justify-center gap-2 sm:gap-4 mb-12 flex-wrap">
            {cycle.map((step, i) => (
              <div key={i} className="flex items-center gap-2 sm:gap-4">
                <div className="flex flex-col items-center gap-2">
                  <div
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                      step.color === "accent-azure" ? "bg-accent-azure/15" : "bg-accent-amber/15"
                    }`}
                  >
                    <step.icon
                      size={20}
                      className={step.color === "accent-azure" ? "text-accent-azure" : "text-accent-amber"}
                    />
                  </div>
                  <p className="font-sans text-body-sm font-medium text-ink">{step.label}</p>
                </div>
                {i < cycle.length - 1 && (
                  <ArrowRight size={14} className="text-ink-faint mb-5" />
                )}
              </div>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/dashboard" className="btn-primary justify-center">
              Start Logging
              <ArrowRight size={15} />
            </Link>
            <Link href="/philosophy" className="btn-ghost justify-center">
              Learn the system first
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
