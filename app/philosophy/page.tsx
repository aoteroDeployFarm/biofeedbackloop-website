import type { Metadata } from "next";
import Nav from "@/components/layout/Nav";
import Footer from "@/components/layout/Footer";
import PhilosophySection from "@/components/sections/PhilosophySection";
import HowItWorksSection from "@/components/sections/HowItWorksSection";

export const metadata: Metadata = {
  title: "Philosophy — BioFeedbackLoop",
  description:
    "Nine principles for observing your body without judgment. Feedback loops over rules. Pattern recognition over compliance.",
};

export default function PhilosophyPage() {
  return (
    <>
      <Nav />
      <main className="flex-1 pt-16">
        {/* Page header */}
        <div className="container-site pt-16 pb-4">
          <p className="label-caps mb-3">Framework</p>
          <h1 className="font-serif text-display-1 text-ink leading-tight max-w-prose-narrow">
            Nine Ways of Paying Attention
          </h1>
          <p className="font-sans text-body-lg text-ink-light mt-5 max-w-prose leading-relaxed">
            These aren&rsquo;t rules. They&rsquo;re the conceptual frame that makes
            the rest of the system coherent. Read one slowly, then continue.
          </p>
        </div>
        <PhilosophySection />
        <HowItWorksSection />
      </main>
      <Footer />
    </>
  );
}
