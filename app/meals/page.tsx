import type { Metadata } from "next";
import Nav from "@/components/layout/Nav";
import Footer from "@/components/layout/Footer";
import MealCardsSection from "@/components/sections/MealCardsSection";
import ProteinCalculator from "@/components/meals/ProteinCalculator";

export const metadata: Metadata = {
  title: "Bridge Meals — BioFeedbackLoop",
  description:
    "Practical meals engineered for long satiety windows. Cost-per-meal, protein-per-dollar, and pattern notes.",
};

export default function MealsPage() {
  return (
    <>
      <Nav />
      <main className="flex-1 pt-16">
        {/* Page header */}
        <div className="container-site pt-16 pb-4">
          <p className="label-caps mb-3">Reference</p>
          <h1 className="font-serif text-display-1 text-ink leading-tight max-w-prose-narrow">
            Bridge Meals
          </h1>
          <p className="font-sans text-body-lg text-ink-light mt-5 max-w-prose leading-relaxed">
            These aren&rsquo;t ideal meals from a culinary standpoint. They&rsquo;re
            reliable meals from a metabolic standpoint — documented, repeatable,
            and worth tracking against your own patterns.
          </p>
        </div>
        <MealCardsSection />
        <ProteinCalculator />
      </main>
      <Footer />
    </>
  );
}
