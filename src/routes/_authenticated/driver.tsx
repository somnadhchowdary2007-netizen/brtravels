import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Car, Loader2, LogOut, Phone, Power, ShieldCheck } from "lucide-react";
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

interface Profile {
  display_name: string | null;
  phone: string | null;
  phone_verified: boolean;
}

const ACTIVE_RIDE_STATUSES = ["accepted", "arrived", "in_progress"];

function maskPhone(phone?: string | null) {
  if (!phone) return "Number hidden";
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return "••••";
  return `${phone.trim().startsWith("+") ? "+" : ""}••••••${digits.slice(-4)}`;
}

function normalizePhone(value: string) {
  const compact = value.trim().replace(/[^\d+]/g, "");
  if (compact.startsWith("+")) return `+${compact.slice(1).replace(/\D/g, "")}`;
  const digits = compact.replace(/\D/g, "");
  return digits.length === 10 ? `+91${digits}` : `+${digits}`;
}

function isValidPhone(value: string) {
  return /^\+[1-9]\d{7,14}$/.test(normalizePhone(value));
}

function DriverApp() {
  const navigate = useNavigate();
  const [pos, setPos] = useState<LatLng>(DEFAULT_CENTER);
  const [online, setOnline] = useState(false);
  const [goingOnline, setGoingOnline] = useState(false);
  const [confirmOnline, setConfirmOnline] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [pending, setPending] = useState<Ride | null>(null);
  const [active, setActive] = useState<Ride | null>(null);
  const [pendingRiderProfile, setPendingRiderProfile] = useState<Profile | null>(null);
  const [riderProfile, setRiderProfile] = useState<Profile | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [phoneDraft, setPhoneDraft] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [verifyingPhone, setVerifyingPhone] = useState(false);
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
      const { data: p } = await supabase
        .from("profiles")
        .select("display_name, phone, phone_verified")
        .eq("id", u.user.id)
        .maybeSingle();
      if (p) {
        setProfile(p);
        setPhoneDraft(p.phone ?? "");
      }
    })();
  }, []);

  // Grant driver role on demand
  async function becomeDriver() {
    if (!userId) return;
    if (!profile?.phone_verified) {
      toast.error("Verify your phone number before driving");
      return;
    }
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

  // Go online with retry: attempts geolocation permission + initial upsert
  const goOnline = useCallback(async () => {
    if (!userId) return;
    if (!profile?.phone_verified) {
      toast.error("Verify your phone number before going online");
      return;
    }
    setGoingOnline(true);
    const attempt = async (n: number): Promise<boolean> => {
      try {
        const coords = await new Promise<GeolocationPosition>((resolve, reject) => {
          if (!navigator.geolocation) return reject(new Error("Geolocation unavailable"));
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 6000,
          });
        });
        const next: LatLng = [coords.coords.latitude, coords.coords.longitude];
        setPos(next);
        const { error } = await supabase.from("driver_locations").upsert({
          driver_id: userId,
          lat: next[0],
          lng: next[1],
          is_online: true,
          updated_at: new Date().toISOString(),
        });
        if (error) throw error;
        return true;
      } catch (err) {
        if (n < 2) {
          toast.message(`Retrying… (${n + 1}/3)`);
          await new Promise((r) => setTimeout(r, 1200));
          return attempt(n + 1);
        }
        toast.error(err instanceof Error ? err.message : "Couldn't go online");
        return false;
      }
    };
    const ok = await attempt(0);
    setGoingOnline(false);
    if (ok) {
      setOnline(true);
      toast.success("You're live. Waiting for rides.");
    }
  }, [userId, profile?.phone_verified]);

  async function sendPhoneOtp() {
    if (!isValidPhone(phoneDraft)) {
      toast.error("Enter a valid phone number with country code");
      return;
    }
    const normalizedPhone = normalizePhone(phoneDraft);
    setVerifyingPhone(true);
    try {
      if (!userId) throw new Error("Not signed in");
      const { error } = await supabase.auth.updateUser({ phone: normalizedPhone });
      if (error) throw error;
      await supabase
        .from("profiles")
        .update({ phone: normalizedPhone, phone_verified: false, phone_verified_at: null })
        .eq("id", userId);
      setProfile({ display_name: profile?.display_name ?? null, phone: normalizedPhone, phone_verified: false });
      setPhoneDraft(normalizedPhone);
      toast.success("SMS OTP sent");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't send OTP");
    } finally {
      setVerifyingPhone(false);
    }
  }

  async function verifyPhoneOtp() {
    if (!isValidPhone(phoneDraft) || !userId) return;
    const normalizedPhone = normalizePhone(phoneDraft);
    setVerifyingPhone(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        phone: normalizedPhone,
        token: otpCode.trim(),
        type: "phone_change",
      });
      if (error) throw error;
      await supabase
        .from("profiles")
        .update({ phone_verified: true, phone_verified_at: new Date().toISOString() })
        .eq("id", userId);
      setProfile({ display_name: profile?.display_name ?? null, phone: normalizedPhone, phone_verified: true });
      setOtpCode("");
      toast.success("Phone verified");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "OTP verification failed");
    } finally {
      setVerifyingPhone(false);
    }
  }

  // Fetch rider profile when active ride is set
  useEffect(() => {
    if (!active?.rider_id) {
      setRiderProfile(null);
      return;
    }
    supabase
      .from("profiles")
        .select("display_name, phone, phone_verified")
      .eq("id", active.rider_id)
      .maybeSingle()
      .then(({ data }) => data && setRiderProfile(data));
  }, [active?.rider_id]);

  // Fetch masked rider contact for pending ride preview
  useEffect(() => {
    if (!pending?.rider_id) {
      setPendingRiderProfile(null);
      return;
    }
    supabase
      .from("profiles")
      .select("display_name, phone, phone_verified")
      .eq("id", pending.rider_id)
      .maybeSingle()
      .then(({ data }) => data && setPendingRiderProfile(data));
  }, [pending?.rider_id]);

  // Listen for pending rides
  useEffect(() => {
    if (!online || active || !profile?.phone_verified) return;
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
  }, [online, active, profile?.phone_verified]);

  async function acceptRide() {
    if (!pending || !userId) return;
    if (!profile?.phone_verified) {
      toast.error("Verify your phone number before accepting rides");
      return;
    }
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

  async function updateStatus(next: "arrived" | "in_progress" | "completed") {
    if (!active) return;
    if (!profile?.phone_verified) {
      toast.error("Verify your phone number before updating rides");
      return;
    }
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
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[1000] p-4">
        <div className="pointer-events-auto mx-auto flex max-w-3xl items-center justify-between rounded-full glass px-4 py-2.5">
          <Link to="/" className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> Home
          </Link>
          <span className="font-display text-sm">
            BR Travels<span className="text-primary">.</span> <span className="text-muted-foreground">Driver</span>
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
      <div className="absolute left-1/2 top-24 z-[1000] -translate-x-1/2">
        {!profile?.phone_verified ? (
          <div className="glass w-[min(92vw,28rem)] rounded-3xl border border-primary/40 p-4">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 text-primary" />
              <div className="flex-1">
                <div className="text-sm font-medium">Verify your phone to drive</div>
                <div className="mt-1 text-xs text-muted-foreground">Riders see your full number only during active trips.</div>
                <div className="mt-3 space-y-2">
                  <input
                    type="tel"
                    value={phoneDraft}
                    onChange={(e) => setPhoneDraft(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full rounded-full border border-border/70 bg-secondary/40 px-4 py-2 text-xs outline-none focus:border-primary"
                  />
                  <div className="flex gap-2">
                  <input
                    inputMode="numeric"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                    placeholder="OTP"
                    className="min-w-0 flex-1 rounded-full border border-border/70 bg-secondary/40 px-4 py-2 text-xs outline-none focus:border-primary"
                  />
                  <button
                    type="button"
                    onClick={otpCode ? verifyPhoneOtp : sendPhoneOtp}
                    disabled={verifyingPhone || !isValidPhone(phoneDraft)}
                    className="rounded-full bg-primary px-4 py-2 text-xs font-medium text-primary-foreground disabled:opacity-60"
                  >
                    {verifyingPhone ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : otpCode ? "Verify" : "Send OTP"}
                  </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : role !== "driver" ? (
          <button
            onClick={becomeDriver}
            className="rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground btn-magnetic"
          >
            Become a driver
          </button>
        ) : (
          <motion.button
            layout
            disabled={goingOnline}
            onClick={() => (online ? goOffline() : setConfirmOnline(true))}
            className={`flex items-center gap-3 rounded-full px-6 py-3 text-sm font-medium disabled:opacity-70 ${
              online
                ? "bg-primary text-primary-foreground animate-pulse-gold"
                : "border border-border bg-card"
            }`}
          >
            {goingOnline ? <Loader2 className="h-4 w-4 animate-spin" /> : <Power className="h-4 w-4" />}
            {goingOnline ? "Going online…" : online ? "You're online" : "Go online"}
          </motion.button>
        )}
      </div>

      {/* Confirm online modal */}
      <AnimatePresence>
        {confirmOnline && !online && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[1002] grid place-items-center bg-background/70 backdrop-blur-sm p-6"
          >
            <motion.div
              initial={{ scale: 0.92, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.92, y: 20 }}
              className="glass w-full max-w-sm rounded-3xl border border-primary/40 p-8"
            >
              <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary">— Ready to drive?</p>
              <h3 className="mt-3 font-display text-2xl">Go online now</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                We'll share your live location with nearby riders while you're online. You can go offline anytime.
              </p>
              <div className="mt-6 grid grid-cols-2 gap-3">
                <button
                  onClick={() => setConfirmOnline(false)}
                  className="rounded-full border border-border py-3 text-sm hover:bg-secondary"
                >
                  Not yet
                </button>
                <button
                  onClick={async () => {
                    setConfirmOnline(false);
                    await goOnline();
                  }}
                  className="rounded-full bg-primary py-3 text-sm font-medium text-primary-foreground btn-magnetic"
                >
                  Go online
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Incoming ride modal */}
      <AnimatePresence>
        {pending && online && !active && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[1001] grid place-items-center bg-background/60 backdrop-blur-sm p-6"
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
                <h3 className="font-display text-3xl">₹{pending.fare_estimate}</h3>
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
              <div className="mt-4 rounded-2xl border border-border/60 bg-secondary/30 p-4 text-sm">
                <div className="text-xs text-muted-foreground">Rider phone</div>
                <div className="mt-1 font-mono text-xs tracking-widest text-muted-foreground">
                  {maskPhone(pendingRiderProfile?.phone)}
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
            className="absolute inset-x-0 bottom-0 z-[1000] mx-auto max-w-2xl"
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

              {riderProfile && ACTIVE_RIDE_STATUSES.includes(active.status) && (
                <div className="mt-3 flex items-center justify-between rounded-xl border border-primary/40 bg-primary/5 p-3">
                  <div>
                    <div className="text-xs text-muted-foreground">Rider</div>
                    <div className="font-medium">{riderProfile.display_name ?? "Rider"}</div>
                  </div>
                  {riderProfile.phone && riderProfile.phone_verified && (
                    <a
                      href={`tel:${riderProfile.phone}`}
                      className="flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-medium text-primary-foreground"
                    >
                      <Phone className="h-3.5 w-3.5" /> {riderProfile.phone}
                    </a>
                  )}
                  {(!riderProfile.phone || !riderProfile.phone_verified) && (
                    <span className="rounded-full border border-border px-4 py-2 text-xs text-muted-foreground">
                      {maskPhone(riderProfile.phone)}
                    </span>
                  )}
                </div>
              )}

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
