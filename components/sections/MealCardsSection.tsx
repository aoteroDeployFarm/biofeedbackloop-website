import { DollarSign, Zap, Clock } from "lucide-react";

type Meal = {
  name: string;
  tagline: string;
  ingredients: string[];
  cost: string;
  protein: string;
  proteinPerDollar: string;
  satietyWindow: string;
  category: string;
};

const meals: Meal[] = [
  {
    name: "Tuna Bridge",
    tagline: "Fast protein, long satiety window.",
    ingredients: ["Canned tuna (5oz)", "Olive oil", "Lemon juice", "Capers", "Dark rye bread"],
    cost: "$2.40",
    protein: "34g",
    proteinPerDollar: "14g/$",
    satietyWindow: "3.5–4 hrs",
    category: "Bridge Meal",
  },
  {
    name: "Egg & Bean Stack",
    tagline: "Affordable, slow-burning, complete.",
    ingredients: ["2 eggs (fried)", "Black beans (½ cup)", "Avocado", "Corn tortilla", "Salsa"],
    cost: "$1.80",
    protein: "22g",
    proteinPerDollar: "12g/$",
    satietyWindow: "3–4 hrs",
    category: "Bridge Meal",
  },
  {
    name: "Sardine Salad",
    tagline: "Omega-3 dense, no cooking required.",
    ingredients: ["Sardines in olive oil", "Arugula", "Cherry tomatoes", "Shaved parmesan", "Balsamic"],
    cost: "$3.20",
    protein: "28g",
    proteinPerDollar: "8.75g/$",
    satietyWindow: "4+ hrs",
    category: "Bridge Meal",
  },
  {
    name: "Greek Yogurt Base",
    tagline: "High protein, high versatility.",
    ingredients: ["Full-fat Greek yogurt (1 cup)", "Walnuts", "Honey (light)", "Blueberries", "Chia seeds"],
    cost: "$2.10",
    protein: "18g",
    proteinPerDollar: "8.5g/$",
    satietyWindow: "2.5–3 hrs",
    category: "Morning Bridge",
  },
];

function MealCard({ meal }: { meal: Meal }) {
  return (
    <article className="card-base flex flex-col gap-5">
      {/* Header */}
      <div>
        <p className="label-caps text-accent-amber mb-1">{meal.category}</p>
        <h3 className="font-serif text-heading-2 text-ink leading-snug">{meal.name}</h3>
        <p className="font-sans text-body-sm text-ink-light mt-1">{meal.tagline}</p>
      </div>

      {/* Ingredients */}
      <ul className="space-y-1">
        {meal.ingredients.map((ing) => (
          <li key={ing} className="flex items-center gap-2 font-sans text-body-sm text-ink-light">
            <span className="w-1 h-1 rounded-full bg-accent-azure shrink-0" />
            {ing}
          </li>
        ))}
      </ul>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3 pt-4 border-t border-surface-muted">
        <div className="flex flex-col items-center gap-1">
          <DollarSign size={14} className="text-accent-amber" />
          <p className="font-sans text-body-sm font-semibold text-ink">{meal.cost}</p>
          <p className="label-caps text-ink-faint">cost</p>
        </div>
        <div className="flex flex-col items-center gap-1">
          <Zap size={14} className="text-accent-azure" />
          <p className="font-sans text-body-sm font-semibold text-ink">{meal.protein}</p>
          <p className="label-caps text-ink-faint">protein</p>
        </div>
        <div className="flex flex-col items-center gap-1">
          <Clock size={14} className="text-ink-faint" />
          <p className="font-sans text-body-sm font-semibold text-ink">{meal.satietyWindow}</p>
          <p className="label-caps text-ink-faint">satiety</p>
        </div>
      </div>

      {/* Protein/dollar badge */}
      <div className="rounded-lg bg-surface-warm px-3 py-2 text-center">
        <p className="font-sans text-body-sm text-ink-light">
          <span className="font-semibold text-ink">{meal.proteinPerDollar}</span>{" "}
          protein per dollar
        </p>
      </div>
    </article>
  );
}

export default function MealCardsSection() {
  return (
    <section id="meals" className="section-spacer">
      <div className="container-site">
        <div className="max-w-prose mx-auto text-center mb-16">
          <p className="label-caps mb-4">Bridge Meals</p>
          <h2 className="font-serif text-display-2 text-ink mb-5 leading-tight">
            Practical Meals That Bridge the Gap
          </h2>
          <p className="font-sans text-body-lg text-ink-light leading-relaxed">
            &ldquo;Bridge meals&rdquo; are the ones you reach for when time
            is short but you still want a 3–4 hour satiety window. Protein and
            fat density are the key variables. Cost is worth tracking too.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {meals.map((meal) => (
            <MealCard key={meal.name} meal={meal} />
          ))}
        </div>

        {/* Economics note */}
        <div className="mt-12 max-w-prose mx-auto p-6 rounded-2xl bg-surface-warm border border-surface-muted text-center">
          <p className="font-sans text-body-sm text-ink-light leading-relaxed">
            These aren&rsquo;t ideal meals from a culinary standpoint.
            They&rsquo;re reliable meals from a metabolic standpoint.
            Track your own patterns — your body&rsquo;s response to protein
            timing may differ. That&rsquo;s exactly the kind of thing
            worth documenting.
          </p>
        </div>
      </div>
    </section>
  );
}
