import Link from "next/link";
import { ArrowRight, BookOpen } from "lucide-react";

export default function JourneyTeaser() {
  return (
    <section className="section-spacer bg-surface-warm">
      <div className="container-site">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left: story hook */}
          <div>
            <p className="label-caps mb-4">The Journey</p>
            <h2 className="font-serif text-display-2 text-ink mb-6 leading-tight">
              Turning 60 with a<br />Spreadsheet and a<br />Systems Lens
            </h2>
            <p className="font-sans text-body-lg text-ink-light leading-relaxed mb-8 max-w-prose-narrow">
              This project started as a personal documentation practice.
              Not because the data was interesting in itself, but because
              watching patterns emerge — without forcing conclusions — turned
              out to be a surprisingly effective way to work with a body
              instead of against it.
            </p>
            <Link href="/journey" className="btn-primary">
              Read the full story
              <ArrowRight size={15} />
            </Link>
          </div>

          {/* Right: pull quote */}
          <div className="space-y-5">
            <div className="card-base border-l-4 border-accent-azure rounded-l-none">
              <div className="flex items-start gap-3 mb-3">
                <BookOpen size={18} className="text-accent-azure mt-1 shrink-0" />
                <p className="label-caps text-accent-azure">Month 3 — Pattern noticed</p>
              </div>
              <p className="font-serif text-body-lg text-ink leading-relaxed">
                &ldquo;The data started speaking. Certain protein combinations
                sustained satiety for four hours. Carbohydrates alone produced
                a predictable two-hour window.&rdquo;
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-ink text-canvas">
              <p className="font-serif text-body-lg leading-relaxed">
                &ldquo;I wasn&rsquo;t optimizing. I was listening.
                There&rsquo;s a real difference.&rdquo;
              </p>
              <p className="label-caps text-canvas/50 mt-3">— Built from a personal practice</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
