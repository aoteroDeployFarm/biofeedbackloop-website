import SignalInput from "@/components/dashboard/SignalInput";
import TrendChart from "@/components/dashboard/TrendChart";

export default function DashboardPreviewSection() {
  return (
    <section id="dashboard" className="section-spacer bg-surface-warm">
      <div className="container-site">
        <div className="max-w-prose mx-auto text-center mb-14">
          <p className="label-caps mb-4">The Dashboard</p>
          <h2 className="font-serif text-display-2 text-ink mb-5 leading-tight">
            Try the Signal Logger
          </h2>
          <p className="font-sans text-body-lg text-ink-light leading-relaxed">
            Log a meal. Note how you felt afterward. See what patterns look
            like across a week. This is the whole system — deliberately simple.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-5xl mx-auto">
          <div className="space-y-6">
            <SignalInput />
          </div>
          <div>
            <TrendChart />
          </div>
        </div>

        {/* Privacy note */}
        <div className="mt-10 text-center">
          <p className="font-sans text-body-sm text-ink-faint max-w-md mx-auto">
            Data is stored locally in your browser in this demo. Full version
            uses Firebase with per-user encryption. No data is sold or shared.
          </p>
        </div>
      </div>
    </section>
  );
}
