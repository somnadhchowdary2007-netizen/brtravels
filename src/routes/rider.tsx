import { createFileRoute, Link } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Car, MapPin, Navigation, Search, Sparkles, Loader2, Phone, Star } from "lucide-react";
import { toast } from "sonner";

const RideMap = lazy(() =>
  import("@/components/RideMap").then((m) => ({ default: m.RideMap })),
);

export const Route = createFileRoute("/rider")({
  head: () => ({
    meta: [
      { title: "BR Travels — Live Demo" },
      { name: "description", content: "Try the BR Travels ride-hailing flow instantly — no signup required." },
    ],
  }),
  component: DemoApp,
});

const TIERS = [
  { id: "mini", name: "BR MINI", eta: "3 min", mult: 1, seats: 3 },
  { id: "grand", name: "BR Grand", eta: "5 min", mult: 1.7, seats: 6 },
  { id: "premium", name: "BR Premium", eta: "4 min", mult: 1.2, seats: 4 },
];

type LatLng = [number, number];
const DEFAULT_CENTER: LatLng = [40.7128, -74.006];

type Phase = "idle" | "searching" | "found";

function haversineKm(a: LatLng, b: LatLng) {
  const R = 6371;
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLon = ((b[1] - a[1]) * Math.PI) / 180;
  const s1 =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a[0] * Math.PI) / 180) *
      Math.cos((b[0] * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s1));
}

function DemoApp() {
  const [center, setCenter] = useState<LatLng>(DEFAULT_CENTER);
  const [pickup, setPickup] = useState<LatLng | null>(null);
  const [dropoff, setDropoff] = useState<LatLng | null>(null);
  const [pickupText, setPickupText] = useState("Current location");
  const [dropoffText, setDropoffText] = useState("");
  const [tier, setTier] = useState("mini");
  const [phase, setPhase] = useState<Phase>("idle");
  const [driverPos, setDriverPos] = useState<LatLng | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      setPickup(DEFAULT_CENTER);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const c: LatLng = [p.coords.latitude, p.coords.longitude];
        setCenter(c);
        setPickup(c);
      },
      () => setPickup(DEFAULT_CENTER),
      { timeout: 5000 },
    );
  }, []);

  const { distanceKm, baseFare } = useMemo(() => {
    if (!pickup || !dropoff) return { distanceKm: 0, baseFare: 0 };
    const d = haversineKm(pickup, dropoff);
    return { distanceKm: d, baseFare: Math.max(99, 49 + d * 24) };
  }, [pickup, dropoff]);

  const activeTier = TIERS.find((x) => x.id === tier)!;
  const fare = baseFare * activeTier.mult;

  async function searchDropoff() {
    if (!dropoffText.trim()) return;
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(dropoffText)}`,
      );
      const data = (await res.json()) as Array<{ lat: string; lon: string; display_name: string }>;
      if (data[0]) {
        const p: LatLng = [parseFloat(data[0].lat), parseFloat(data[0].lon)];
        setDropoff(p);
        setDropoffText(data[0].display_name);
        setCenter(p);
      } else {
        toast.error("Address not found");
      }
    } catch {
      toast.error("Search failed");
    }
  }

  function bookRide() {
    if (!pickup || !dropoff) {
      toast.error("Set a destination first");
      return;
    }
    setPhase("searching");
    setTimeout(() => {
      // Place mock driver near pickup, offset slightly
      const offset: LatLng = [pickup[0] + 0.003, pickup[1] + 0.004];
      setDriverPos(offset);
      setPhase("found");
      toast.success("Driver found — John is on the way");
    }, 3000);
  }

  function reset() {
    setPhase("idle");
    setDriverPos(null);
    setDropoff(null);
    setDropoffText("");
  }

  return (
    <div className="relative h-[100svh] w-full overflow-hidden bg-background">
      <div className="absolute inset-0">
        <Suspense fallback={<div className="h-full w-full bg-card" />}>
          <RideMap
            center={center}
            pickup={pickup}
            dropoff={dropoff}
            driver={driverPos}
            className="h-full w-full"
          />
        </Suspense>
      </div>

      {/* Top bar */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[1000] p-4">
        <div className="pointer-events-auto mx-auto flex max-w-3xl items-center justify-between rounded-full glass px-4 py-2.5">
          <Link to="/" className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> Home
          </Link>
          <span className="font-display text-sm">
            BR Travels<span className="text-primary">.</span>
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary">Demo</span>
        </div>
      </div>

      {/* Bottom sheet */}
      <motion.div
        initial={{ y: 400 }}
        animate={{ y: 0 }}
        transition={{ delay: 0.2, duration: 0.8, ease: [0.2, 0.8, 0.2, 1] }}
        className="absolute inset-x-0 bottom-0 z-[1000]"
      >
        <div className="mx-auto max-w-2xl">
          <div className="glass mx-3 mb-3 rounded-t-3xl border border-b-0 border-border/60 p-6 pb-8">
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border" />

            <AnimatePresence mode="wait">
              {phase === "idle" && (
                <motion.div key="book" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary">— Where to?</p>

                  <div className="mt-4 space-y-2">
                    <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-secondary/40 px-4 py-3">
                      <MapPin className="h-4 w-4 text-primary" />
                      <input
                        value={pickupText}
                        onChange={(e) => setPickupText(e.target.value)}
                        className="flex-1 bg-transparent text-sm outline-none"
                        placeholder="Pickup"
                      />
                    </div>
                    <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-secondary/40 px-4 py-3">
                      <Navigation className="h-4 w-4 text-foreground" />
                      <input
                        value={dropoffText}
                        onChange={(e) => setDropoffText(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && searchDropoff()}
                        className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                        placeholder="Where to?"
                      />
                      <button
                        onClick={searchDropoff}
                        className="rounded-full bg-primary p-2 text-primary-foreground"
                        aria-label="Search"
                      >
                        <Search className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-6 grid grid-cols-3 gap-2">
                    {TIERS.map((t) => {
                      const active = tier === t.id;
                      const tFare = baseFare * t.mult;
                      return (
                        <button
                          key={t.id}
                          onClick={() => setTier(t.id)}
                          className={`rounded-2xl border p-3 text-left transition ${
                            active ? "border-primary bg-primary/10" : "border-border/60 bg-secondary/30 hover:border-border"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <Car className="h-4 w-4 text-primary" />
                            <span className="font-mono text-[10px] text-muted-foreground">{t.eta}</span>
                          </div>
                          <div className="mt-3 text-xs font-medium">{t.name.split(" ")[1]}</div>
                          <div className="mt-1 font-display text-lg">{dropoff ? `₹${tFare.toFixed(0)}` : "—"}</div>
                        </button>
                      );
                    })}
                  </div>

                  <button
                    onClick={bookRide}
                    disabled={!dropoff}
                    className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-primary py-4 text-sm font-medium text-primary-foreground btn-magnetic disabled:opacity-40"
                  >
                    <Sparkles className="h-4 w-4" />
                    {dropoff ? `Book ${activeTier.name}` : "Enter destination"}
                  </button>
                </motion.div>
              )}

              {phase === "searching" && (
                <motion.div
                  key="searching"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="py-6 text-center"
                >
                  <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary">— Searching</p>
                  <div className="mt-6 flex justify-center">
                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
                  </div>
                  <h3 className="mt-6 font-display text-2xl">Finding you a driver…</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Broadcasting your ride to nearby {activeTier.name} drivers
                  </p>
                  <div className="mt-6 flex justify-center gap-1.5">
                    {[0, 1, 2].map((i) => (
                      <motion.span
                        key={i}
                        className="h-1.5 w-1.5 rounded-full bg-primary"
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                      />
                    ))}
                  </div>
                </motion.div>
              )}

              {phase === "found" && (
                <motion.div key="found" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary">— Driver found</p>
                      <h3 className="mt-2 font-display text-2xl">On the way</h3>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-muted-foreground">Fare</div>
                      <div className="font-display text-2xl">₹{fare.toFixed(0)}</div>
                    </div>
                  </div>

                  <div className="mt-5 flex items-center gap-4 rounded-2xl border border-border/60 bg-secondary/40 p-4">
                    <div className="grid h-14 w-14 place-items-center rounded-full bg-primary/20 font-display text-xl text-primary">
                      J
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">John</span>
                        <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                          <Star className="h-3 w-3 fill-primary text-primary" /> 4.96
                        </span>
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">Toyota Camry · Silver</div>
                      <div className="mt-1 font-mono text-xs tracking-widest text-foreground">ABC-123</div>
                    </div>
                    <button
                      className="grid h-11 w-11 place-items-center rounded-full bg-primary text-primary-foreground"
                      aria-label="Call driver"
                    >
                      <Phone className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="mt-4 rounded-2xl border border-border/60 bg-secondary/40 p-4">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Distance</span>
                      <span>ETA</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between font-display text-lg">
                      <span>{distanceKm.toFixed(1)} km</span>
                      <span>~{activeTier.eta}</span>
                    </div>
                  </div>

                  <button
                    onClick={reset}
                    className="mt-5 w-full rounded-full border border-border py-3 text-sm hover:bg-secondary"
                  >
                    New ride
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
