import { Link } from "@tanstack/react-router";
import { Instagram, Twitter, Linkedin } from "lucide-react";

export function Footer() {
  return (
    <footer className="relative border-t border-border/40 bg-card/40">
      <div className="mx-auto max-w-7xl px-6 pb-14 pt-24">
        <div className="grid gap-16 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-2">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-primary text-primary-foreground font-display text-lg">
                C
              </span>
              <span className="font-display text-xl">Cabify<span className="text-primary">.</span></span>
            </div>
            <p className="mt-6 max-w-sm text-sm text-muted-foreground">
              Premium ride-hailing. Curated fleet. Cinematic every mile.
            </p>
            <form
              onSubmit={(e) => e.preventDefault()}
              className="mt-8 flex max-w-sm items-center gap-2 rounded-full border border-border/60 p-1.5"
            >
              <input
                type="email"
                placeholder="Get city launch updates"
                className="flex-1 bg-transparent px-4 text-sm outline-none placeholder:text-muted-foreground"
              />
              <button className="rounded-full bg-primary px-4 py-2 text-xs font-medium text-primary-foreground btn-magnetic">
                Notify me
              </button>
            </form>
          </div>

          {[
            { h: "Product", items: [["Fleet","#fleet"],["Pricing","#pricing"],["Cities","#"],["BR Gold","#pricing"]] },
            { h: "Company", items: [["About","#"],["Careers","#"],["Press","#"],["Contact","#"]] },
            { h: "Drivers", items: [["Drive with us","/driver"],["Requirements","#"],["Earnings","#"],["Support","#"]] },
          ].map((c) => (
            <div key={c.h}>
              <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                {c.h}
              </div>
              <ul className="mt-6 space-y-3 text-sm">
                {c.items.map(([l, h]) => (
                  <li key={l}>
                    <Link to={h} className="text-foreground/80 hover:text-primary">
                      {l}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-20 flex flex-col items-start justify-between gap-6 border-t border-border/40 pt-8 md:flex-row md:items-center">
          <div className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} BR Travels All rides reserved.
          </div>
          <div className="flex items-center gap-4 text-muted-foreground">
            <a href="#" aria-label="Instagram"><Instagram className="h-4 w-4 hover:text-primary" /></a>
            <a href="#" aria-label="Twitter"><Twitter className="h-4 w-4 hover:text-primary" /></a>
            <a href="#" aria-label="LinkedIn"><Linkedin className="h-4 w-4 hover:text-primary" /></a>
          </div>
        </div>

        <div
          aria-hidden
          className="pointer-events-none select-none pb-4 pt-12 font-display text-[22vw] leading-none tracking-tighter opacity-[0.06]"
        >
          BR Travels.
        </div>
      </div>
    </footer>
  );
}
