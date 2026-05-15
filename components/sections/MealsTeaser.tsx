import Link from "next/link";
import { ArrowRight, DollarSign, Zap, Clock } from "lucide-react";

const featured = [
  {
    name: "Tuna Bridge",
    tagline: "Fast protein, long satiety window.",
    cost: "$2.40",
    protein: "34g",
    satiety: "3.5–4 hrs",
    proteinPerDollar: "14g/$",
    category: "Bridge Meal",
  },
  {
    name: "Egg & Bean Stack",
    tagline: "Affordable, slow-burning, complete.",
    cost: "$1.80",
    protein: "22g",
    satiety: "3–4 hrs",
    proteinPerDollar: "12g/$",
    category: "Bridge Meal",
  },
];

export default function MealsTeaser() {
  return (
    <section className="section-spacer bg-surface-warm">
      <div className="container-site">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-12">
          <div>
            <p className="label-caps mb-3">Bridge Meals</p>
            <h2 className="font-serif text-display-2 text-ink leading-tight">
              Practical. Affordable.<br />Long Satiety Windows.
            </h2>
          </div>
          <Link href="/meals" className="btn-ghost shrink-0 self-start sm:self-auto">
            See all meals
            <ArrowRight size={15} />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl">
          {featured.map((meal) => (
            <article key={meal.name} className="card-base flex flex-col gap-4">
              <div>
                <p className="label-caps text-accent-amber mb-1">{meal.category}</p>
                <h3 className="font-serif text-heading-2 text-ink">{meal.name}</h3>
                <p className="font-sans text-body-sm text-ink-light mt-1">{meal.tagline}</p>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-3 border-t border-surface-muted">
                <div className="flex flex-col items-center gap-1">
                  <DollarSign size={13} className="text-accent-amber" />
                  <p className="font-sans text-body-sm font-semibold text-ink">{meal.cost}</p>
                  <p className="label-caps text-ink-faint">cost</p>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <Zap size={13} className="text-accent-azure" />
                  <p className="font-sans text-body-sm font-semibold text-ink">{meal.protein}</p>
                  <p className="label-caps text-ink-faint">protein</p>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <Clock size={13} className="text-ink-faint" />
                  <p className="font-sans text-body-sm font-semibold text-ink">{meal.satiety}</p>
                  <p className="label-caps text-ink-faint">satiety</p>
                </div>
              </div>

              <div className="rounded-lg bg-surface-warm px-3 py-1.5 text-center">
                <p className="font-sans text-body-sm text-ink-light">
                  <span className="font-semibold text-ink">{meal.proteinPerDollar}</span> protein per dollar
                </p>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-8">
          <p className="font-sans text-body-sm text-ink-faint">
            Two more bridge meals documented.{" "}
            <Link href="/meals" className="text-accent-azure hover:underline">
              See the full meal library →
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}
