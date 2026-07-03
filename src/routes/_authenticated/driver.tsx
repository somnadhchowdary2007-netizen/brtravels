import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Car, LogOut, Power } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { signOut } from "@/hooks/use-auth";
import { toast } from "sonner";

const RideMap = lazy(() =>
  import("@/components/RideMap").then((m) => ({ default: m.RideMap })),
);

export const Route = createFileRoute("/_authenticated/driver")({
  component: DriverApp,
});

type LatLng = [number, number];
const DEFAULT_CENTER: LatLng = [40.7128, -74.006];

interface Ride {
  id: string;
  rider_id: string;
  driver_id: string | null;
  pickup_address: string;
  dropoff_address: string;
  pickup_lat: number;
  pickup_lng: number;
  dropoff_lat: number;
  dropoff_lng: number;
  fare_estimate: number;
  status: string;
  tier: string;
}

function DriverApp() {
  const navigate = useNavigate();
  const [pos, setPos] = useState<LatLng>(DEFAULT_CENTER);
  const [online, setOnline] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [pending, setPending] = useState<Ride | null>(null);
  const [active, setActive] = useState<Ride | null>(null);
  const [role, setRole] = useState<"driver" | "rider" | null>(null);

  // Init user & role
  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      setUserId(u.user.id);
      const { data: r } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", u.user.id);
      const roles = (r ?? []).map((x) => x.role);
      setRole(roles.includes("driver") ? "driver" : "rider");
    })();
  }, []);

  // Grant driver role on demand
  async function becomeDriver() {
    if (!userId) return;
    const { error } = await supabase
      .from("user_roles")
      .insert({ user_id: userId, role: "driver" });
    if (error && !error.message.includes("duplicate")) {
      toast.error(error.message);
      return;
    }
    setRole("driver");
    toast.success("You're onboarded. Welcome, driver.");
  }

  // Track geolocation while online
  useEffect(() => {
    if (!online || !userId || typeof window === "undefined" || !navigator.geolocation) return;
    const watch = navigator.geolocation.watchPosition(
      async (p) => {
        const next: LatLng = [p.coords.latitude, p.coords.longitude];
        setPos(next);
        await supabase.from("driver_locations").upsert({
          driver_id: userId,
          lat: next[0],
          lng: next[1],
          is_online: true,
          updated_at: new Date().toISOString(),
        });
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000 },
    );
    return () => navigator.geolocation.clearWatch(watch);
  }, [online, userId]);

  const goOffline = useCallback(async () => {
    if (userId) {
      await supabase
        .from("driver_locations")
        .update({ is_online: false })
        .eq("driver_id", userId);
    }
    setOnline(false);
  }, [userId]);

  // Listen for pending rides
  useEffect(() => {
    if (!online || active) return;
    // initial fetch
    supabase
      .from("rides")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .then(({ data }) => {
        if (data?.[0]) setPending(data[0] as Ride);
      });
    const ch = supabase
      .channel("pending-rides")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "rides", filter: "status=eq.pending" },
        (payload) => {
          setPending(payload.new as Ride);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [online, active]);

  async function acceptRide() {
    if (!pending || !userId) return;
    const { data, error } = await supabase
      .from("rides")
      .update({ driver_id: userId, status: "accepted" })
      .eq("id", pending.id)
      .eq("status", "pending")
      .select()
      .single();
    if (error || !data) {
      toast.error("Another driver got there first.");
      setPending(null);
      return;
    }
    setActive(data as Ride);
    setPending(null);
    toast.success("Ride accepted. Head to pickup.");
  }

  async function updateStatus(next: Ride["status"]) {
    if (!active) return;
    const { data, error } = await supabase
      .from("rides")
      .update({ status: next })
      .eq("id", active.id)
      .select()
      .single();
    if (error) {
      toast.error(error.message);
      return;
    }
    setActive(data as Ride);
    if (next === "completed") {
      toast.success("Trip completed");
      setTimeout(() => setActive(null), 1500);
    }
  }

  return (
    <div className="relative h-[100svh] w-full overflow-hidden bg-background">
      <div className="absolute inset-0">
        <Suspense fallback={<div className="h-full w-full bg-card" />}>
          <RideMap
            center={pos}
            driver={online ? pos : null}
            pickup={active ? [active.pickup_lat, active.pickup_lng] : null}
            dropoff={active ? [active.dropoff_lat, active.dropoff_lng] : null}
            className="h-full w-full"
          />
        </Suspense>
      </div>

      {/* Top bar */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 p-4">
        <div className="pointer-events-auto mx-auto flex max-w-3xl items-center justify-between rounded-full glass px-4 py-2.5">
          <Link to="/" className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> Home
          </Link>
          <span className="font-display text-sm">
            Cabify<span className="text-primary">.</span> <span className="text-muted-foreground">Driver</span>
          </span>
          <button
            onClick={async () => {
              await goOffline();
              await signOut();
              navigate({ to: "/" });
            }}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Online toggle */}
      <div className="absolute left-1/2 top-24 z-20 -translate-x-1/2">
        {role !== "driver" ? (
          <button
            onClick={becomeDriver}
            className="rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground btn-magnetic"
          >
            Become a driver
          </button>
        ) : (
          <motion.button
            layout
            onClick={() => (online ? goOffline() : setOnline(true))}
            className={`flex items-center gap-3 rounded-full px-6 py-3 text-sm font-medium ${
              online
                ? "bg-primary text-primary-foreground animate-pulse-gold"
                : "border border-border bg-card"
            }`}
          >
            <Power className="h-4 w-4" />
            {online ? "You're online" : "Go online"}
          </motion.button>
        )}
      </div>

      {/* Incoming ride modal */}
      <AnimatePresence>
        {pending && online && !active && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-30 grid place-items-center bg-background/60 backdrop-blur-sm p-6"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="glass w-full max-w-md rounded-3xl border border-primary/40 p-8"
            >
              <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary">
                — Incoming ride
              </p>
              <div className="mt-4 flex items-center justify-between">
                <h3 className="font-display text-3xl">${pending.fare_estimate}</h3>
                <span className="rounded-full bg-primary/20 px-3 py-1 text-xs text-primary">
                  {pending.tier}
                </span>
              </div>
              <div className="mt-6 space-y-3 text-sm">
                <div className="flex gap-3">
                  <span className="mt-1 h-2 w-2 rounded-full bg-primary" />
                  <div>
                    <div className="text-xs text-muted-foreground">Pickup</div>
                    <div>{pending.pickup_address}</div>
                  </div>
                </div>
                <div className="flex gap-3">
                  <span className="mt-1 h-2 w-2 rounded-full bg-foreground" />
                  <div>
                    <div className="text-xs text-muted-foreground">Dropoff</div>
                    <div>{pending.dropoff_address}</div>
                  </div>
                </div>
              </div>
              <div className="mt-8 grid grid-cols-2 gap-3">
                <button
                  onClick={() => setPending(null)}
                  className="rounded-full border border-border py-3 text-sm hover:bg-secondary"
                >
                  Decline
                </button>
                <button
                  onClick={acceptRide}
                  className="rounded-full bg-primary py-3 text-sm font-medium text-primary-foreground btn-magnetic"
                >
                  Accept ride
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Active ride bottom sheet */}
      <AnimatePresence>
        {active && (
          <motion.div
            initial={{ y: 300 }}
            animate={{ y: 0 }}
            exit={{ y: 300 }}
            className="absolute inset-x-0 bottom-0 z-20 mx-auto max-w-2xl"
          >
            <div className="glass mx-3 mb-3 rounded-t-3xl border border-b-0 border-border/60 p-6 pb-8">
              <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border" />
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary">
                    — {active.status.replace("_", " ")}
                  </p>
                  <h3 className="mt-3 font-display text-2xl">
                    {active.status === "accepted" && "Driving to pickup"}
                    {active.status === "arrived" && "At pickup point"}
                    {active.status === "in_progress" && "Trip in progress"}
                    {active.status === "completed" && "Trip complete"}
                  </h3>
                </div>
                <Car className="h-8 w-8 text-primary" />
              </div>

              <div className="mt-6 space-y-3 text-sm">
                <div className="rounded-xl border border-border/60 bg-secondary/30 p-3">
                  <div className="text-xs text-muted-foreground">Pickup</div>
                  <div>{active.pickup_address}</div>
                </div>
                <div className="rounded-xl border border-border/60 bg-secondary/30 p-3">
                  <div className="text-xs text-muted-foreground">Dropoff</div>
                  <div>{active.dropoff_address}</div>
                </div>
              </div>

              <div className="mt-6 grid gap-2">
                {active.status === "accepted" && (
                  <button
                    onClick={() => updateStatus("arrived")}
                    className="rounded-full bg-primary py-3 text-sm font-medium text-primary-foreground btn-magnetic"
                  >
                    Arrived at pickup
                  </button>
                )}
                {active.status === "arrived" && (
                  <button
                    onClick={() => updateStatus("in_progress")}
                    className="rounded-full bg-primary py-3 text-sm font-medium text-primary-foreground btn-magnetic"
                  >
                    Start ride
                  </button>
                )}
                {active.status === "in_progress" && (
                  <button
                    onClick={() => updateStatus("completed")}
                    className="rounded-full bg-primary py-3 text-sm font-medium text-primary-foreground btn-magnetic"
                  >
                    Complete ride
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
