import { motion } from "framer-motion";

const reviews = [
  { q: "It's the only cab app that feels considered.", a: "Marissa L.", r: "Creative Director" },
  { q: "The driver knew my name and the exact playlist I needed.", a: "Kenji T.", r: "Founder" },
  { q: "Cabify made a 2am airport run feel like a hotel check-in.", a: "Sofia R.", r: "Editor" },
  { q: "Every ride, exactly when they said, exactly what they promised.", a: "Daniel M.", r: "Investor" },
  { q: "It's transportation as hospitality.", a: "Amara O.", r: "Architect" },
  { q: "Bought the SUV tier for a dinner. Made the night.", a: "Julien P.", r: "Chef" },
];

export function Reviews() {
  return (
    <section id="riders" className="relative mx-auto max-w-7xl px-6 py-32">
      <div className="mb-20">
        <p className="font-mono text-xs uppercase tracking-[0.4em] text-primary">— The riders</p>
        <h2 className="mt-4 max-w-3xl font-display text-5xl leading-[1] md:text-7xl">
          Trusted by the <span className="text-gold italic">tastemakers</span>.
        </h2>
      </div>

      <div className="columns-1 gap-6 md:columns-2 lg:columns-3">
        {reviews.map((r, i) => (
          <motion.figure
            key={i}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ delay: (i % 3) * 0.08, duration: 0.7 }}
            className="mb-6 break-inside-avoid rounded-3xl border border-border/50 bg-card/60 p-8 backdrop-blur"
          >
            <div className="mb-4 flex gap-0.5 text-primary" aria-hidden>
              {Array.from({ length: 5 }).map((_, s) => (
                <span key={s}>★</span>
              ))}
            </div>
            <blockquote className="font-display text-xl leading-snug">"{r.q}"</blockquote>
            <figcaption className="mt-6 text-xs text-muted-foreground">
              <span className="text-foreground">{r.a}</span> · {r.r}
            </figcaption>
          </motion.figure>
        ))}
      </div>
    </section>
  );
}
