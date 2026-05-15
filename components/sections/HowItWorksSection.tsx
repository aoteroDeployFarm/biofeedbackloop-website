import { Utensils, Zap, Clock, Dumbbell, Moon, ArrowRight } from "lucide-react";

const cycle = [
  {
    icon: Utensils,
    label: "Meal",
    description: "Log what you ate, when, and your estimated portion size.",
    color: "accent-amber",
  },
  {
    icon: Zap,
    label: "Energy",
    description: "Note energy level 60–90 minutes after eating.",
    color: "accent-azure",
  },
  {
    icon: Clock,
    label: "Hunger Return",
    description: "When does genuine hunger return? That gap is the data.",
    color: "accent-amber",
  },
  {
    icon: Dumbbell,
    label: "Workout",
    description: "Log movement: type, intensity, timing relative to meals.",
    color: "accent-azure",
  },
  {
    icon: Moon,
    label: "Sleep",
    description: "Rate sleep quality and note what preceded it.",
    color: "accent-amber",
  },
];

export default function HowItWorksSection() {
  return (
    <section id="how-it-works" className="section-spacer bg-surface-warm">
      <div className="container-site">
        <div className="max-w-prose mx-auto text-center mb-16">
          <p className="label-caps mb-4">The Feedback Loop</p>
          <h2 className="font-serif text-display-2 text-ink mb-5 leading-tight">
            Five Signals. One Continuous Cycle.
          </h2>
          <p className="font-sans text-body-lg text-ink-light leading-relaxed">
            Each data point connects to the next. Over weeks, the cycle
            reveals what your body already knows.
          </p>
        </div>

        {/* Cycle visualization */}
        <div className="flex flex-col md:flex-row items-center justify-center gap-0 max-w-4xl mx-auto">
          {cycle.map((step, i) => (
            <div key={i} className="flex flex-col md:flex-row items-center">
              {/* Step card */}
              <div className="flex flex-col items-center text-center w-36">
                <div
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-3 ${
                    step.color === "accent-azure"
                      ? "bg-accent-azure/15"
                      : "bg-accent-amber/15"
                  }`}
                >
                  <step.icon
                    size={24}
                    className={
                      step.color === "accent-azure"
                        ? "text-accent-azure"
                        : "text-accent-amber"
                    }
                  />
                </div>
                <p className="font-serif text-body-md font-semibold text-ink mb-1">
                  {step.label}
                </p>
                <p className="font-sans text-body-sm text-ink-light leading-snug text-center">
                  {step.description}
                </p>
              </div>

              {/* Arrow connector */}
              {i < cycle.length - 1 && (
                <div className="flex md:items-center justify-center my-4 md:my-0 md:mx-3">
                  <ArrowRight
                    size={18}
                    className="text-ink-faint rotate-90 md:rotate-0"
                  />
                </div>
              )}
            </div>
          ))}

          {/* Loop back arrow */}
          <div className="mt-4 md:mt-0 md:ml-3 text-ink-faint">
            <p className="label-caps text-center">↩ repeats daily</p>
          </div>
        </div>

        {/* Insight section */}
        <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {[
            {
              week: "Week 1",
              insight: "You establish a baseline. The goal is honest data, not perfect data.",
            },
            {
              week: "Week 3",
              insight: "First patterns surface. Certain meals extend satiety. Others don't.",
            },
            {
              week: "Week 6",
              insight: "You stop guessing. You have evidence about how your body works.",
            },
          ].map((item) => (
            <div key={item.week} className="card-base text-center">
              <p className="label-caps text-accent-azure mb-2">{item.week}</p>
              <p className="font-sans text-body-sm text-ink-light leading-relaxed">
                {item.insight}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
