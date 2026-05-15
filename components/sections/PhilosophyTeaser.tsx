import Link from "next/link";
import { Eye, Clock, GitBranch, ArrowRight } from "lucide-react";

const featured = [
  {
    icon: Eye,
    title: "Observation Over Judgment",
    body: "A meal is an event with measurable downstream effects. It is not a moral act.",
    color: "accent-azure",
  },
  {
    icon: Clock,
    title: "Timing Is the Variable",
    body: "When you eat matters as much as what you eat. The satiety window is a measurement, not a moral statement.",
    color: "accent-amber",
  },
  {
    icon: GitBranch,
    title: "Feedback Loops, Not Rules",
    body: "Rules require compliance. Feedback loops require curiosity. We build systems that generate data.",
    color: "accent-azure",
  },
];

export default function PhilosophyTeaser() {
  return (
    <section className="section-spacer">
      <div className="container-site">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-12">
          <div>
            <p className="label-caps mb-3">Core Principles</p>
            <h2 className="font-serif text-display-2 text-ink leading-tight">
              Nine Ways of<br />Paying Attention
            </h2>
          </div>
          <Link
            href="/philosophy"
            className="btn-ghost shrink-0 self-start sm:self-auto"
          >
            See all 9 principles
            <ArrowRight size={15} />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {featured.map((p, i) => (
            <div key={i} className="card-base group">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${
                  p.color === "accent-azure" ? "bg-accent-azure/10" : "bg-accent-amber/10"
                }`}
              >
                <p.icon
                  size={20}
                  className={p.color === "accent-azure" ? "text-accent-azure" : "text-accent-amber"}
                />
              </div>
              <h3 className="font-serif text-heading-2 text-ink mb-3 leading-snug">{p.title}</h3>
              <p className="font-sans text-body-sm text-ink-light leading-relaxed">{p.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 text-center">
          <p className="font-sans text-body-sm text-ink-faint">
            Six more principles waiting.{" "}
            <Link href="/philosophy" className="text-accent-azure hover:underline">
              Read the full framework →
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}
