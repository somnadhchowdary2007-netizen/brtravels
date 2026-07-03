import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { Link } from "@tanstack/react-router";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const plans = [
  {
    name: "Rider",
    price: "Free",
    sub: "Pay per ride. Zero commitment.",
    features: ["All fleet tiers", "Real-time tracking", "24/7 concierge", "Card & wallet pay"],
    cta: { href: "/auth", label: "Create account" },
  },
  {
    name: "Cabify Gold",
    price: "$19/mo",
    sub: "For the ones who ride often.",
    features: [
      "15% off every ride",
      "Priority driver matching",
      "Free upgrades on Noir",
      "Airport meet & greet",
      "Guest passes ×3 / mo",
    ],
    cta: { href: "/auth", label: "Join Gold" },
    featured: true,
  },
  {
    name: "Fleet",
    price: "Custom",
    sub: "Teams, hotels, agencies.",
    features: ["Consolidated billing", "Ride analytics", "API access", "Dedicated account lead"],
    cta: { href: "/auth", label: "Talk to us" },
  },
];

const faqs = [
  { q: "How fast is a typical pickup?", a: "Under 4 minutes in most metros. Live ETA is shown before you confirm the ride." },
  { q: "Can I book in advance?", a: "Yes. Schedule up to 30 days ahead and we guarantee a driver ten minutes early." },
  { q: "Do you surge price?", a: "Never. Fares are transparent up-front and rain, weekends, or events don't change that." },
  { q: "How do I become a driver?", a: "Tap Drive with Us, complete the vetting flow, and you'll onboard within 72 hours." },
  { q: "Is Cabify available where I live?", a: "We're live in 32 cities and expanding weekly. Sign in to see local availability." },
];

export function Pricing() {
  return (
    <section id="pricing" className="relative mx-auto max-w-7xl px-6 py-32">
      <div className="mb-20">
        <p className="font-mono text-xs uppercase tracking-[0.4em] text-primary">— Pricing</p>
        <h2 className="mt-4 max-w-3xl font-display text-5xl leading-[1] md:text-7xl">
          Straightforward. <span className="text-gold italic">Always.</span>
        </h2>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {plans.map((p, i) => (
          <motion.div
            key={p.name}
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ delay: i * 0.1, duration: 0.8 }}
            className={`relative rounded-3xl border p-8 ${
              p.featured
                ? "border-primary/60 bg-gradient-to-b from-primary/10 to-transparent"
                : "border-border/50 bg-card/60"
            }`}
          >
            {p.featured && (
              <span className="absolute -top-3 left-8 rounded-full bg-primary px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-primary-foreground">
                Most loved
              </span>
            )}
            <h3 className="font-display text-2xl">{p.name}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{p.sub}</p>
            <div className="mt-8 font-display text-5xl">{p.price}</div>
            <ul className="mt-8 space-y-3 text-sm">
              {p.features.map((f) => (
                <li key={f} className="flex items-start gap-3">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span className="text-muted-foreground">{f}</span>
                </li>
              ))}
            </ul>
            <Link
              to={p.cta.href}
              className={`mt-10 block rounded-full py-3 text-center text-sm font-medium ${
                p.featured
                  ? "bg-primary text-primary-foreground btn-magnetic"
                  : "border border-border hover:bg-secondary"
              }`}
            >
              {p.cta.label}
            </Link>
          </motion.div>
        ))}
      </div>

      <div id="faq" className="mt-32 grid gap-16 md:grid-cols-[1fr_1.4fr]">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.4em] text-primary">— FAQ</p>
          <h3 className="mt-4 font-display text-4xl leading-[1] md:text-5xl">
            Answers, <span className="text-gold italic">refined</span>.
          </h3>
        </div>
        <Accordion type="single" collapsible className="w-full">
          {faqs.map((f, i) => (
            <AccordionItem key={i} value={`i${i}`} className="border-border/40">
              <AccordionTrigger className="py-6 text-left font-display text-lg hover:text-primary hover:no-underline">
                {f.q}
              </AccordionTrigger>
              <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
                {f.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
