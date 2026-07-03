import { motion } from "framer-motion";

const words = ["Concierge care", "Verified drivers", "Zero surge", "Silent rides", "In-car wifi", "24 / 7 support"];

export function Marquee() {
  return (
    <div className="relative border-y border-border/40 bg-card/30 py-6 overflow-hidden">
      <div className="flex whitespace-nowrap animate-marquee gap-16">
        {[...words, ...words, ...words].map((w, i) => (
          <div key={i} className="flex items-center gap-16">
            <span className="font-display text-2xl text-muted-foreground">{w}</span>
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function Process() {
  const steps = [
    { n: "01", t: "Open the app", d: "Sign in with one tap. Set your pickup, choose the moment." },
    { n: "02", t: "Match in seconds", d: "The nearest curated driver rolls to you. Live ETA, always." },
    { n: "03", t: "Ride, refined", d: "Climate set. Route optimized. Payment silent. You arrive." },
  ];

  return (
    <section id="process" className="relative mx-auto max-w-7xl px-6 py-32">
      <div className="mb-20 flex items-end justify-between gap-10">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.4em] text-primary">— The ride</p>
          <h2 className="mt-4 max-w-2xl font-display text-5xl leading-[1] md:text-7xl">
            Three motions. <span className="text-gold italic">One arrival.</span>
          </h2>
        </div>
        <p className="hidden max-w-sm text-sm text-muted-foreground md:block">
          Every touchpoint is engineered to feel effortless — because luxury is what disappears.
        </p>
      </div>

      <div className="relative grid gap-px md:grid-cols-3">
        {steps.map((s, i) => (
          <motion.div
            key={s.n}
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ delay: i * 0.15, duration: 0.8, ease: [0.2, 0.8, 0.2, 1] }}
            className="group relative p-10 md:p-12"
            style={{
              borderRight: i < 2 ? "1px solid oklch(0.28 0.02 260 / 0.5)" : undefined,
            }}
          >
            <div className="font-mono text-xs text-muted-foreground">{s.n}</div>
            <h3 className="mt-6 font-display text-3xl">{s.t}</h3>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{s.d}</p>
            <div className="mt-10 h-px w-16 bg-primary transition-all duration-500 group-hover:w-32" />
          </motion.div>
        ))}
      </div>
    </section>
  );
}
