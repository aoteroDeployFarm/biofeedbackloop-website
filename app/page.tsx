import Nav from "@/components/layout/Nav";
import Footer from "@/components/layout/Footer";
import HeroSection from "@/components/sections/HeroSection";
import PhilosophyTeaser from "@/components/sections/PhilosophyTeaser";
import JourneyTeaser from "@/components/sections/JourneyTeaser";
import DashboardTeaser from "@/components/sections/DashboardTeaser";
import MealsTeaser from "@/components/sections/MealsTeaser";

export default function HomePage() {
  return (
    <>
      <Nav />
      <main className="flex-1">
        <HeroSection />
        <PhilosophyTeaser />
        <JourneyTeaser />
        <DashboardTeaser />
        <MealsTeaser />
      </main>
      <Footer />
    </>
  );
}
