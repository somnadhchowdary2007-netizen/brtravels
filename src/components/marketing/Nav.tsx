import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth, signOut } from "@/hooks/use-auth";

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <motion.header
      initial={{ y: -40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.8, ease: [0.2, 0.8, 0.2, 1] }}
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-500 ${
        scrolled ? "py-3" : "py-6"
      }`}
    >
      <div
        className={`mx-auto flex max-w-7xl items-center justify-between px-6 transition-all duration-500 ${
          scrolled ? "glass rounded-full" : ""
        } ${scrolled ? "py-2.5" : ""}`}
        style={scrolled ? { paddingLeft: "1.25rem", paddingRight: "1.25rem" } : {}}
      >
        <Link to="/" className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-primary text-primary-foreground font-display text-lg font-semibold">
            C
          </span>
          <span className="font-display text-xl tracking-tight">
            Cabify<span className="text-primary">.</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-9 md:flex">
          {[
            ["Fleet", "#fleet"],
            ["Process", "#process"],
            ["Riders", "#riders"],
            ["Pricing", "#pricing"],
            ["FAQ", "#faq"],
          ].map(([l, h]) => (
            <a
              key={h}
              href={h}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {l}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          {user ? (
            <>
              <Link
                to="/app"
                className="hidden text-sm text-muted-foreground hover:text-foreground md:inline"
              >
                Open app
              </Link>
              <button
                onClick={() => signOut()}
                className="rounded-full border border-border/70 px-4 py-2 text-sm hover:bg-secondary"
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link
                to="/auth"
                className="hidden text-sm text-muted-foreground hover:text-foreground md:inline"
              >
                Sign in
              </Link>
              <Link
                to="/auth"
                className="rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground btn-magnetic"
              >
                Book a ride
              </Link>
            </>
          )}
          <button
            className="ml-1 grid h-9 w-9 place-items-center rounded-full border border-border/70 md:hidden"
            onClick={() => setOpen((o) => !o)}
            aria-label="Open menu"
          >
            <span className="block h-px w-4 bg-foreground" />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="mx-6 mt-3 glass rounded-2xl p-4 md:hidden"
          >
            {[
              ["Fleet", "#fleet"],
              ["Process", "#process"],
              ["Riders", "#riders"],
              ["Pricing", "#pricing"],
              ["FAQ", "#faq"],
            ].map(([l, h]) => (
              <a
                key={h}
                href={h}
                onClick={() => setOpen(false)}
                className="block rounded-lg px-3 py-2.5 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                {l}
              </a>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}
