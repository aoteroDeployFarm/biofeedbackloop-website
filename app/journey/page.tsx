import type { Metadata } from "next";
import Nav from "@/components/layout/Nav";
import Footer from "@/components/layout/Footer";
import FounderSection from "@/components/sections/FounderSection";
import ExperimentsTimeline from "@/components/journey/ExperimentsTimeline";

export const metadata: Metadata = {
  title: "The Journey — BioFeedbackLoop",
  description:
    "Turning 60 with a spreadsheet and a systems lens. How a personal documentation practice became a calm health operating system.",
};

export default function JourneyPage() {
  return (
    <>
      <Nav />
      <main className="flex-1 pt-16">
        {/* Page header */}
        <div className="container-site pt-16 pb-4">
          <p className="label-caps mb-3">Origin</p>
          <h1 className="font-serif text-display-1 text-ink leading-tight max-w-prose-narrow">
            How This Started
          </h1>
          <p className="font-sans text-body-lg text-ink-light mt-5 max-w-prose leading-relaxed">
            Not a product brief. A personal practice that turned into a tool
            worth sharing.
          </p>
        </div>
        <FounderSection />
        <ExperimentsTimeline />
      </main>
      <Footer />
    </>
  );
}
