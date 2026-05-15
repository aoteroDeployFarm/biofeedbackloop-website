import { BookOpen } from "lucide-react";

export interface ExperimentDoc {
  id: string;
  order: number;
  period: string;
  topic: string;
  title: string;
  signal: string;
  insight: string;
  published: boolean;
}

export default function ReflectionCard({ doc }: { doc: ExperimentDoc }) {
  return (
    <article className="card-base flex flex-col gap-5">
      {/* Topic badge + period */}
      <div className="flex items-start justify-between gap-4">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-accent-azure/10 border border-accent-azure/20">
          <BookOpen size={11} className="text-accent-azure" />
          <span className="label-caps text-accent-azure" style={{ fontSize: "10px" }}>{doc.topic}</span>
        </span>
        <p className="label-caps text-accent-amber whitespace-nowrap">{doc.period}</p>
      </div>

      {/* Title */}
      <h3 className="font-serif text-heading-2 text-ink leading-snug">{doc.title}</h3>

      {/* Signal block */}
      <div className="space-y-1.5">
        <p className="label-caps text-ink-faint">The Signal</p>
        <p className="font-sans text-body-sm text-ink-light leading-relaxed">{doc.signal}</p>
      </div>

      {/* Divider */}
      <div className="border-t border-surface-muted" />

      {/* Insight block */}
      <div className="space-y-1.5">
        <p className="label-caps text-accent-azure">The Insight</p>
        <p className="font-serif text-body-md text-ink leading-relaxed">{doc.insight}</p>
      </div>
    </article>
  );
}
