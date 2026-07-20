import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Car, Loader2, LogOut, MapPin, Navigation, Phone, Search, ShieldCheck, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { signOut } from "@/hooks/use-auth";
import { toast } from "sonner";

const RideMap = lazy(() =>
  import("@/components/RideMap").then((m) => ({ default: m.RideMap })),
);

export const Route = createFileRoute("/_authenticated/app")({
  component: RiderApp,
});

const TIERS = [
  { id: "mini", name: "BR MINI", eta: "3 min", mult: 1, seats: 3 },
  { id: "grand", name: "BR Grand", eta: "5 min", mult: 1.7, seats: 6 },
  { id: "premium", name: "BR Premium", eta: "4 min", mult: 1.2, seats: 4 },
];

type LatLng = [number, number];
const DEFAULT_CENTER: LatLng = [40.7128, -74.006]; // NYC fallback

interface Ride {
  id: string;
  status: string;
  driver_id: string | null;
  pickup_lat: number;
  pickup_lng: number;
  dropoff_lat: number;
  dropoff_lng: number;
  fare_estimate: number;
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

function haversineKm(a: LatLng, b: LatLng) {
  const R = 6371;
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLon = ((b[1] - a[1]) * Math.PI) / 180;
  const s1 = Math.sin(dLat / 2) ** 2 +
    Math.cos((a[0] * Math.PI) / 180) *
      Math.cos((b[0] * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s1));
}

function RiderApp() {
  const navigate = useNavigate();
  const [center, setCenter] = useState<LatLng>(DEFAULT_CENTER);
  const [pickup, setPickup] = useState<LatLng | null>(null);
  const [dropoff, setDropoff] = useState<LatLng | null>(null);
  const [pickupText, setPickupText] = useState("Current location");
  const [dropoffText, setDropoffText] = useState("");
  const [tier, setTier] = useState("mini");
  const [ride, setRide] = useState<Ride | null>(null);
  const [driverPos, setDriverPos] = useState<LatLng | null>(null);
  const [driverProfile, setDriverProfile] = useState<Profile | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [phoneDraft, setPhoneDraft] = useState("");
  const [verifyingPhone, setVerifyingPhone] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: userRes } = await supabase.auth.getUser();
      if (!userRes.user) return;
      const { data } = await supabase
        .from("profiles")
        .select("display_name, phone, phone_verified")
        .eq("id", userRes.user.id)
        .maybeSingle();
      if (data) {
        setProfile(data);
        setPhoneDraft(data.phone ?? "");
      }
    })();
  }, []);

  // Get user location
  useEffect(() => {
    if (typeof window === "undefined" || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const c: LatLng = [p.coords.latitude, p.coords.longitude];
        setCenter(c);
        setPickup(c);
      },
      () => {
        setPickup(DEFAULT_CENTER);
      },
      { timeout: 5000 },
    );
  }, []);

  // Distance & fare
  const { distanceKm, baseFare } = useMemo(() => {
    if (!pickup || !dropoff) return { distanceKm: 0, baseFare: 0 };
    const d = haversineKm(pickup, dropoff);
    return { distanceKm: d, baseFare: Math.max(99, 49 + d * 24) };
  }, [pickup, dropoff]);

  // Search dropoff via OpenStreetMap Nominatim
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

  async function bookRide() {
    if (!profile?.phone) {
      toast.error("Add your phone number before booking a ride");
      return;
    }
    if (!pickup || !dropoff) {
      toast.error("Set a destination first");
      return;
    }
    setLoading(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      if (!userRes.user) throw new Error("Not signed in");
      const t = TIERS.find((x) => x.id === tier)!;
      const fare = baseFare * t.mult;
      const { data, error } = await supabase
        .from("rides")
        .insert({
          rider_id: userRes.user.id,
          pickup_address: pickupText,
          pickup_lat: pickup[0],
          pickup_lng: pickup[1],
          dropoff_address: dropoffText || "Destination",
          dropoff_lat: dropoff[0],
          dropoff_lng: dropoff[1],
          tier,
          fare_estimate: Number(fare.toFixed(2)),
        })
        .select()
        .single();
      if (error) throw error;
      setRide(data as Ride);
      toast.success("Searching for a driver…");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Booking failed");
    } finally {
      setLoading(false);
    }
  }

  async function sendPhoneOtp() {
    if (!isValidPhone(phoneDraft)) {
      toast.error("Enter a valid phone number with country code");
      return;
    }
    const normalizedPhone = normalizePhone(phoneDraft);
    setVerifyingPhone(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      if (!userRes.user) throw new Error("Not signed in");
      const { error } = await supabase.auth.updateUser({ phone: normalizedPhone });
      if (error) throw error;
      await supabase
        .from("profiles")
        .update({ phone: normalizedPhone, phone_verified: false, phone_verified_at: null })
        .eq("id", userRes.user.id);
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
    if (!isValidPhone(phoneDraft)) return;
    const normalizedPhone = normalizePhone(phoneDraft);
    setVerifyingPhone(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      if (!userRes.user) throw new Error("Not signed in");
      const { error } = await supabase.auth.verifyOtp({
        phone: normalizedPhone,
        token: otpCode.trim(),
        type: "phone_change",
      });
      if (error) throw error;
      await supabase
        .from("profiles")
        .update({ phone_verified: true, phone_verified_at: new Date().toISOString() })
        .eq("id", userRes.user.id);
      setProfile({ display_name: profile?.display_name ?? null, phone: normalizedPhone, phone_verified: true });
      setOtpCode("");
      toast.success("Phone verified");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "OTP verification failed");
    } finally {
      setVerifyingPhone(false);
    }
  }

  // Subscribe to ride updates
  useEffect(() => {
    if (!ride?.id) return;
    const ch = supabase
      .channel(`ride-${ride.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "rides", filter: `id=eq.${ride.id}` },
        (payload) => {
          setRide(payload.new as Ride);
          if (payload.new.status === "accepted") toast.success("Driver on the way");
          if (payload.new.status === "completed") toast.success("Trip completed. Ride safe.");
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [ride?.id]);

  // Subscribe to driver location
  useEffect(() => {
    if (!ride?.driver_id) return;
    // fetch driver profile (name + phone)
    supabase
      .from("profiles")
        .select("display_name, phone, phone_verified")
      .eq("id", ride.driver_id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setDriverProfile(data);
      });
    // initial fetch
    supabase
      .from("driver_locations")
      .select("lat,lng")
      .eq("driver_id", ride.driver_id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setDriverPos([data.lat, data.lng]);
      });
    const ch = supabase
      .channel(`drv-${ride.driver_id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "driver_locations",
          filter: `driver_id=eq.${ride.driver_id}`,
        },
        (payload) => {
          const row = payload.new as { lat: number; lng: number };
          if (row?.lat && row?.lng) setDriverPos([row.lat, row.lng]);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [ride?.driver_id]);

  async function cancelRide() {
    if (!ride) return;
    await supabase.from("rides").update({ status: "cancelled" }).eq("id", ride.id);
    setRide(null);
    setDriverPos(null);
    toast("Ride cancelled");
  }

  return (
    <div className="relative h-[100svh] w-full overflow-hidden bg-background">
      {/* Map */}
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
          <Link
            to="/"
            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Home
          </Link>
          <span className="font-display text-sm">
            BR Travels<span className="text-primary">.</span>
          </span>
          <button
            onClick={async () => {
              await signOut();
              navigate({ to: "/" });
            }}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
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
              {!ride ? (
                <motion.div key="book" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary">
                    — Where to?
                  </p>

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

                  {!profile?.phone_verified && (
                    <div className="mt-6 rounded-2xl border border-primary/40 bg-primary/5 p-4">
                      <div className="flex items-start gap-3">
                        <ShieldCheck className="mt-0.5 h-5 w-5 text-primary" />
                        <div className="flex-1">
                          <div className="text-sm font-medium">Verify your phone to book</div>
                          <div className="mt-1 text-xs text-muted-foreground">We'll show your number to the driver only after they accept your ride.</div>
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
                  )}

                  <div className="mt-6 grid grid-cols-3 gap-2">
                    {TIERS.map((t) => {
                      const active = tier === t.id;
                      const fare = baseFare * t.mult;
                      return (
                        <button
                          key={t.id}
                          onClick={() => setTier(t.id)}
                          className={`rounded-2xl border p-3 text-left transition ${
                            active
                              ? "border-primary bg-primary/10"
                              : "border-border/60 bg-secondary/30 hover:border-border"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <Car className="h-4 w-4 text-primary" />
                            <span className="font-mono text-[10px] text-muted-foreground">
                              {t.eta}
                            </span>
                          </div>
                          <div className="mt-3 text-xs font-medium">{t.name.split(" ")[1]}</div>
                          <div className="mt-1 font-display text-lg">
                            {dropoff ? `₹${fare.toFixed(0)}` : "—"}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <button
                    onClick={bookRide}
                    disabled={!dropoff || loading || !profile?.phone_verified}
                    className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-primary py-4 text-sm font-medium text-primary-foreground btn-magnetic disabled:opacity-40"
                  >
                    <Sparkles className="h-4 w-4" />
                    {loading ? "Booking…" : dropoff ? `Book ${TIERS.find((x) => x.id === tier)!.name}` : "Enter destination"}
                  </button>
                </motion.div>
              ) : (
                <motion.div key="track" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary">
                        — {ride.status.replace("_", " ")}
                      </p>
                      <h3 className="mt-3 font-display text-2xl">
                        {ride.status === "pending" && "Finding a driver"}
                        {ride.status === "accepted" && "Driver on the way"}
                        {ride.status === "arrived" && "Driver has arrived"}
                        {ride.status === "in_progress" && "En route"}
                        {ride.status === "completed" && "Trip complete"}
                        {ride.status === "cancelled" && "Ride cancelled"}
                      </h3>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-muted-foreground">Fare</div>
                      <div className="font-display text-2xl">₹{ride.fare_estimate}</div>
                    </div>
                  </div>

                  {ride.status === "pending" && (
                    <div className="mt-6 flex items-center gap-3 rounded-2xl border border-border/60 bg-secondary/40 p-4 text-sm text-muted-foreground">
                      <div className="h-2 w-2 animate-pulse-gold rounded-full bg-primary" />
                      Broadcasting your ride to nearby drivers…
                    </div>
                  )}

                  {(ride.status === "accepted" || ride.status === "arrived" || ride.status === "in_progress") && (
                    <div className="mt-6 rounded-2xl border border-border/60 bg-secondary/40 p-4">
                      <div className="text-xs text-muted-foreground">Distance</div>
                      <div className="mt-1 font-display text-lg">
                        {distanceKm.toFixed(1)} km · ~{Math.max(2, Math.round(distanceKm * 2.5))} min
                      </div>
                    </div>
                  )}

                  {driverProfile && ACTIVE_RIDE_STATUSES.includes(ride.status) && (
                    <div className="mt-3 flex items-center justify-between rounded-2xl border border-primary/40 bg-primary/5 p-4">
                      <div>
                        <div className="text-xs text-muted-foreground">Your driver</div>
                        <div className="mt-1 font-display text-lg">{driverProfile.display_name ?? "Driver"}</div>
                      </div>
                      {driverProfile.phone && driverProfile.phone_verified && (
                        <a
                          href={`tel:${driverProfile.phone}`}
                          className="flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-medium text-primary-foreground"
                        >
                          <Phone className="h-3.5 w-3.5" /> {driverProfile.phone}
                        </a>
                      )}
                      {(!driverProfile.phone || !driverProfile.phone_verified) && (
                        <span className="rounded-full border border-border px-4 py-2 text-xs text-muted-foreground">
                          {maskPhone(driverProfile.phone)}
                        </span>
                      )}
                    </div>
                  )}

                  <div className="mt-6 flex gap-2">
                    {["completed", "cancelled"].includes(ride.status) ? (
                      <button
                        onClick={() => {
                          setRide(null);
                          setDriverPos(null);
                          setDriverProfile(null);
                        }}
                        className="w-full rounded-full bg-primary py-3 text-sm font-medium text-primary-foreground btn-magnetic"
                      >
                        New ride
                      </button>
                    ) : (
                      <button
                        onClick={cancelRide}
                        className="w-full rounded-full border border-border py-3 text-sm hover:bg-secondary"
                      >
                        Cancel ride
                      </button>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
