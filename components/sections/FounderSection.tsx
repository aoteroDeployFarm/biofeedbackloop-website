"use client";

import { BookOpen, Layers, Clock, BarChart2 } from "lucide-react";

const milestones = [
  {
    age: "Late 50s",
    title: "Noticing the drift",
    body: "Energy that used to be reliable started shifting. Not dramatically — just a persistent sense that something in the feedback loop had changed. The old heuristics weren't holding.",
    icon: Clock,
  },
  {
    age: "Turning 60",
    title: "Choosing documentation over discipline",
    body: "Rather than a new protocol or a stricter plan, I started writing things down. When I ate, what I ate, how I felt two hours later. No judgment — just timestamped observations.",
    icon: BookOpen,
  },
  {
    age: "Month 3",
    title: "Patterns emerged without forcing them",
    body: "The data started speaking. Certain protein combinations sustained satiety for four hours. Carbohydrates alone produced a predictable two-hour window. Sleep quality tracked against dinner timing, not dinner content.",
    icon: BarChart2,
  },
  {
    age: "Ongoing",
    title: "Systems thinking applied to a body",
    body: "A body is a feedback system. Inputs produce outputs on a delay. The gap between eating and energy return is a measurement, not a moral statement. This is what BioFeedbackLoop documents.",
    icon: Layers,
  },
];

export default function FounderSection() {
  return (
    <section id="founder" className="section-spacer bg-surface-warm">
      <div className="container-site">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start">
          {/* Left: identity block */}
          <div className="lg:col-span-4 lg:sticky lg:top-28">
            <p className="label-caps mb-4">The Journey</p>
            <h2 className="font-serif text-heading-1 text-ink mb-5 leading-tight">
              Turning 60 with a Spreadsheet and a Systems Lens
            </h2>
            <p className="prose-narrative text-ink-light text-body-md mb-6">
              This project started as a personal documentation practice.
              Not because the data was interesting in itself, but because
              watching patterns emerge — without forcing conclusions — turned
              out to be a surprisingly effective way to work with a body
              instead of against it.
            </p>
            <div className="p-5 rounded-2xl border border-accent-azure/20 bg-accent-azure/5">
              <p className="font-serif text-lg text-accent-azure leading-snug">
                &ldquo;I wasn&rsquo;t optimizing. I was listening.
                There&rsquo;s a real difference.&rdquo;
              </p>
            </div>
          </div>

          {/* Right: timeline */}
          <div className="lg:col-span-8">
            <div className="relative">
              {/* Vertical line */}
              <div className="absolute left-5 top-6 bottom-6 w-px bg-gradient-to-b from-accent-azure/30 via-accent-amber/20 to-transparent hidden sm:block" />

              <div className="space-y-8">
                {milestones.map((m, i) => (
                  <div key={i} className="sm:pl-16 relative">
                    {/* Icon on timeline */}
                    <div className="hidden sm:flex absolute left-0 top-1 w-10 h-10 rounded-full bg-canvas border border-surface-muted shadow-card items-center justify-center">
                      <m.icon size={18} className="text-accent-azure" />
                    </div>

                    <div className="card-base">
                      <p className="label-caps text-accent-amber mb-2">{m.age}</p>
                      <h3 className="font-serif text-heading-2 text-ink mb-3">
                        {m.title}
                      </h3>
                      <p className="font-sans text-body-md text-ink-light leading-relaxed">
                        {m.body}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Closing reflection */}
            <div className="sm:pl-16 mt-10">
              <div className="p-6 rounded-2xl bg-ink text-canvas">
                <p className="font-serif text-body-lg leading-relaxed">
                  BioFeedbackLoop is the tool I wished I had when I started.
                  Simple enough to use every day. Structured enough to surface
                  patterns. Quiet enough that it doesn&rsquo;t become another
                  thing to perform wellness at.
                </p>
                <p className="label-caps text-canvas/50 mt-4">
                  — Built from a personal practice, not a product brief
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
