import Link from "next/link";

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-surface-muted bg-surface-warm">
      <div className="container-site py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          <div>
            <Link href="/" className="font-serif text-lg font-semibold text-ink mb-2 inline-block hover:text-accent-azure transition-colors">
              BioFeedbackLoop
            </Link>
            <p className="text-body-sm text-ink-light max-w-xs leading-relaxed mt-1">
              A calm health operating system. Observation over judgment.
              Pattern recognition over perfection.
            </p>
          </div>

          <div>
            <p className="label-caps mb-4">Explore</p>
            <ul className="space-y-2">
              {[
                ["Philosophy", "/philosophy"],
                ["The Journey", "/journey"],
                ["Bridge Meals", "/meals"],
                ["Signal Dashboard", "/dashboard"],
              ].map(([label, href]) => (
                <li key={href}>
                  <Link
                    href={href}
                    className="text-body-sm text-ink-light hover:text-ink transition-colors"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="label-caps mb-4">Principles</p>
            <ul className="space-y-2">
              {[
                "Observation over judgment",
                "Patterns over compliance",
                "Data as self-knowledge",
                "No shame, only signals",
              ].map((p) => (
                <li key={p} className="text-body-sm text-ink-light">
                  {p}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-surface-muted flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <p className="text-body-sm text-ink-faint">
            &copy; {year} BioFeedbackLoop. Built for curious humans.
          </p>
          <p className="text-body-sm text-ink-faint">
            No calorie counting. No shame spirals.
          </p>
        </div>
      </div>
    </footer>
  );
}
