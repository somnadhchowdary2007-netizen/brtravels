import { motion } from "framer-motion";
import sedan from "@/assets/fleet-sedan.jpg";
import suv from "@/assets/fleet-suv.jpg";
import electric from "@/assets/fleet-electric.jpg";

const tiers = [
  {
    name: "Cabify Noir",
    tag: "Signature sedan",
    price: "from $18",
    img: sedan,
    features: ["Executive sedan", "1–3 passengers", "Bottled water", "Silent mode"],
  },
  {
    name: "Cabify Grand",
    tag: "Full-size SUV",
    price: "from $32",
    img: suv,
    features: ["Luxury SUV", "1–6 passengers", "Extra luggage", "Champagne on request"],
  },
  {
    name: "Cabify Volt",
    tag: "All-electric",
    price: "from $22",
    img: electric,
    features: ["Zero emissions", "Panoramic roof", "Premium audio", "Carbon negative fleet"],
  },
];

export function Fleet() {
  return (
    <section id="fleet" className="relative mx-auto max-w-7xl px-6 py-32">
      <div className="mb-20">
        <p className="font-mono text-xs uppercase tracking-[0.4em] text-primary">— The fleet</p>
        <h2 className="mt-4 max-w-3xl font-display text-5xl leading-[1] md:text-7xl">
          A vehicle for every <span className="text-gold italic">mood</span>.
        </h2>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {tiers.map((t, i) => (
          <motion.article
            key={t.name}
            initial={{ opacity: 0, y: 60 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ delay: i * 0.1, duration: 0.9, ease: [0.2, 0.8, 0.2, 1] }}
            whileHover={{ y: -6 }}
            className="group relative overflow-hidden rounded-3xl border border-border/50 bg-card"
            style={{ boxShadow: "var(--shadow-elevated)" }}
          >
            <div className="relative aspect-[4/3] overflow-hidden">
              <img
                src={t.img}
                alt={t.name}
                className="h-full w-full object-cover transition-transform duration-[1200ms] ease-out group-hover:scale-110"
                loading="lazy"
                width={1024}
                height={768}
              />
              <div
                className="pointer-events-none absolute inset-0"
                style={{
                  background:
                    "linear-gradient(180deg, transparent 40%, oklch(0.13 0.015 260 / 0.9) 100%)",
                }}
              />
              <div className="absolute left-5 top-5 rounded-full bg-background/70 px-3 py-1 font-mono text-[10px] uppercase tracking-widest backdrop-blur">
                {t.tag}
              </div>
              <div className="absolute bottom-5 left-5 right-5 flex items-end justify-between">
                <h3 className="font-display text-3xl">{t.name}</h3>
                <div className="text-sm text-primary">{t.price}</div>
              </div>
            </div>
            <ul className="grid grid-cols-2 gap-x-4 gap-y-2 p-6 text-xs text-muted-foreground">
              {t.features.map((f) => (
                <li key={f} className="flex items-center gap-2 before:h-1 before:w-1 before:rounded-full before:bg-primary">
                  {f}
                </li>
              ))}
            </ul>
          </motion.article>
        ))}
      </div>
    </section>
  );
}
