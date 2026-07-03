import { Link } from "@tanstack/react-router";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { ArrowRight, MapPin } from "lucide-react";
import heroCab from "@/assets/hero-cab.jpg";

export function Hero() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], ["0%", "30%"]);
  const scale = useTransform(scrollYProgress, [0, 1], [1, 1.15]);
  const opacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  const eyebrow = "Ride-hailing, reimagined";
  const line1 = "Arrive";
  const line2 = "in gold.";

  return (
    <section ref={ref} className="relative h-[100svh] w-full overflow-hidden grain">
      <motion.div style={{ y, scale }} className="absolute inset-0">
        <img
          src={heroCab}
          alt="Luxury black cab in a cinematic city at night"
          className="h-full w-full object-cover"
          width={1920}
          height={1280}
        />
      </motion.div>

      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, oklch(0.13 0.015 260 / 0.55) 0%, oklch(0.13 0.015 260 / 0.35) 40%, oklch(0.13 0.015 260 / 0.95) 100%)",
        }}
      />
      <div aria-hidden className="absolute inset-0" style={{ background: "var(--gradient-radial-gold)" }} />

      <motion.div
        style={{ opacity }}
        className="relative z-10 mx-auto flex h-full max-w-7xl flex-col justify-end px-6 pb-24 pt-40 md:pb-32"
      >
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.8 }}
          className="font-mono text-xs uppercase tracking-[0.4em] text-primary"
        >
          — {eyebrow}
        </motion.p>

        <h1 className="mt-6 font-display text-[15vw] leading-[0.9] tracking-tight md:text-[9rem]">
          {[line1, line2].map((l, li) => (
            <span key={li} className="block overflow-hidden">
              <motion.span
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                transition={{ delay: 0.5 + li * 0.15, duration: 1, ease: [0.2, 0.8, 0.2, 1] }}
                className={`inline-block ${li === 1 ? "text-gold italic" : ""}`}
              >
                {l}
              </motion.span>
            </span>
          ))}
        </h1>

        <div className="mt-10 grid gap-8 md:grid-cols-[1fr_auto] md:items-end">
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9, duration: 0.8 }}
            className="max-w-lg text-base text-muted-foreground md:text-lg"
          >
            A ride-hailing experience built for the ones who notice the details.
            Real-time tracking. Curated drivers. Cinematic every mile.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.05, duration: 0.8 }}
            className="flex flex-wrap items-center gap-3"
          >
            <Link
              to="/app"
              className="group inline-flex items-center gap-3 rounded-full bg-primary px-7 py-4 text-sm font-medium text-primary-foreground btn-magnetic"
            >
              <MapPin className="h-4 w-4" />
              Book a ride
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link
              to="/driver"
              className="inline-flex items-center gap-3 rounded-full border border-border/60 bg-background/40 px-7 py-4 text-sm font-medium backdrop-blur hover:bg-secondary"
            >
              Drive with us
            </Link>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.4, duration: 1 }}
          className="mt-16 grid grid-cols-3 gap-6 border-t border-border/40 pt-8 md:max-w-2xl"
        >
          {[
            ["4.98", "Avg rating"],
            ["12k+", "Rides / week"],
            ["< 4m", "Pickup time"],
          ].map(([n, l]) => (
            <div key={l}>
              <div className="font-display text-3xl">{n}</div>
              <div className="mt-1 text-xs uppercase tracking-widest text-muted-foreground">{l}</div>
            </div>
          ))}
        </motion.div>
      </motion.div>

      <div className="absolute bottom-8 left-1/2 z-10 -translate-x-1/2 text-[10px] uppercase tracking-[0.5em] text-muted-foreground">
        Scroll
      </div>
    </section>
  );
}
