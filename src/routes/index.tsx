import { createFileRoute } from "@tanstack/react-router";
import { Nav } from "@/components/marketing/Nav";
import { Hero } from "@/components/marketing/Hero";
import { Marquee, Process } from "@/components/marketing/Process";
import { Fleet } from "@/components/marketing/Fleet";
import { Reviews } from "@/components/marketing/Reviews";
import { Pricing } from "@/components/marketing/Pricing";
import { Footer } from "@/components/marketing/Footer";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  return (
    <main className="relative">
      <Nav />
      <Hero />
      <Marquee />
      <Process />
      <Fleet />
      <Reviews />
      <Pricing />
      <Footer />
    </main>
  );
}
