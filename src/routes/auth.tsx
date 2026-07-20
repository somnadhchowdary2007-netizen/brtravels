import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";

export const Route = createFileRoute("/auth")({
  ssr: false,
  component: AuthPage,
});

function normalizePhone(value: string) {
  const compact = value.trim().replace(/[^\d+]/g, "");
  if (compact.startsWith("+")) return `+${compact.slice(1).replace(/\D/g, "")}`;
  const digits = compact.replace(/\D/g, "");
  return digits.length === 10 ? `+91${digits}` : `+${digits}`;
}

function isValidPhone(value: string) {
  return /^\+[1-9]\d{7,14}$/.test(normalizePhone(value));
}

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [pendingPhone, setPendingPhone] = useState("");
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const [otpStep, setOtpStep] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/app" });
    });
  }, [navigate]);

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        if (!isValidPhone(phone)) {
          throw new Error("Please enter a valid phone number with country code");
        }
        const normalizedPhone = normalizePhone(phone);
        const { data: signUpData, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin + "/app",
            data: { full_name: name, phone: normalizedPhone },
          },
        });
        if (error) throw error;
        if (!signUpData.session) {
          toast.success("Account created. Sign in after confirming your email to verify your phone.");
          setMode("signin");
          return;
        }
        const { error: otpError } = await supabase.auth.updateUser({ phone: normalizedPhone });
        if (otpError) throw otpError;
        if (signUpData.user) {
          await supabase
            .from("profiles")
            .update({ display_name: name, phone: normalizedPhone, phone_verified: false, phone_verified_at: null })
            .eq("id", signUpData.user.id);
          setPendingUserId(signUpData.user.id);
        }
        setPendingPhone(normalizedPhone);
        setOtpStep(true);
        toast.success("SMS OTP sent. Verify your number to continue.");
        return;
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Signed in.");
      }
      navigate({ to: "/app" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!pendingPhone || !pendingUserId) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        phone: pendingPhone,
        token: otpCode.trim(),
        type: "phone_change",
      });
      if (error) throw error;
      await supabase
        .from("profiles")
        .update({ phone: pendingPhone, phone_verified: true, phone_verified_at: new Date().toISOString() })
        .eq("id", pendingUserId);
      toast.success("Phone verified. Welcome to BR Travels.");
      navigate({ to: "/app" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "OTP verification failed");
    } finally {
      setLoading(false);
    }
  }

  async function resendOtp() {
    if (!pendingPhone) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ phone: pendingPhone });
      if (error) throw error;
      toast.success("SMS OTP sent again.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't resend OTP");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) throw result.error;
      if (result.redirected) return;
      navigate({ to: "/app" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Google sign-in failed");
      setLoading(false);
    }
  }

  return (
    <div className="relative grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      {/* Left panel — cinematic */}
      <div className="relative hidden overflow-hidden lg:block">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(1000px 700px at 30% 30%, oklch(0.82 0.15 78 / 0.25), transparent 60%), linear-gradient(180deg, oklch(0.14 0.02 260), oklch(0.1 0.015 260))",
          }}
        />
        <div className="relative flex h-full flex-col justify-between p-12">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back to BR Travels
          </Link>
          <div>
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1 }}
              className="font-display text-6xl leading-[1]"
            >
              Your ride, <span className="text-gold italic">curated</span>.
            </motion.h1>
            <p className="mt-6 max-w-md text-muted-foreground">
              Sign in to book luxury cabs, track your driver in real time, and unlock BR Gold benefits.
            </p>
          </div>
          <div className="text-xs uppercase tracking-[0.4em] text-muted-foreground">
            — BR Travels · 2026
          </div>
        </div>
      </div>

      {/* Right panel — auth */}
      <div className="flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-md">
          <div className="mb-10">
            <div className="inline-flex rounded-full border border-border/60 p-1">
              {(["signin", "signup"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`rounded-full px-5 py-2 text-xs font-medium transition ${
                    mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                  }`}
                >
                  {m === "signin" ? "Sign in" : "Create account"}
                </button>
              ))}
            </div>
            <h2 className="mt-8 font-display text-4xl">
              {mode === "signin" ? "Welcome back." : "Join BR Travels."}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {mode === "signin"
                ? "Enter your details to hit the road."
                : "A few details and you're rolling."}
            </p>
          </div>

          <button
            onClick={handleGoogle}
            disabled={loading}
            className="mb-6 flex w-full items-center justify-center gap-3 rounded-full border border-border/70 py-3 text-sm font-medium hover:bg-secondary disabled:opacity-60"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
              <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/>
              <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.3 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
              <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.3 34.9 26.8 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
              <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.1 5.6l6.2 5.2c-.4.4 6.6-4.8 6.6-14.8 0-1.3-.1-2.4-.4-3.5z"/>
            </svg>
            Continue with Google
          </button>

          <div className="mb-6 flex items-center gap-4">
            <span className="h-px flex-1 bg-border" />
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">or</span>
            <span className="h-px flex-1 bg-border" />
          </div>

          {otpStep ? (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="rounded-2xl border border-primary/40 bg-primary/5 p-4">
                <div className="flex items-center gap-3">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                  <div>
                    <div className="text-sm font-medium">Verify phone number</div>
                    <div className="text-xs text-muted-foreground">OTP sent to {pendingPhone}</div>
                  </div>
                </div>
              </div>
              <div>
                <label className="mb-2 block text-xs uppercase tracking-widest text-muted-foreground">
                  SMS OTP
                </label>
                <input
                  required
                  inputMode="numeric"
                  minLength={4}
                  maxLength={8}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                  className="w-full rounded-xl border border-border/70 bg-secondary/40 px-4 py-3 text-sm tracking-[0.35em] outline-none focus:border-primary"
                  placeholder="000000"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3 text-sm font-medium text-primary-foreground btn-magnetic disabled:opacity-60"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Verify & continue
              </button>
              <button
                type="button"
                onClick={resendOtp}
                disabled={loading}
                className="w-full rounded-full border border-border py-3 text-sm hover:bg-secondary disabled:opacity-60"
              >
                Resend OTP
              </button>
            </form>
          ) : (
          <form onSubmit={handleEmail} className="space-y-4">
            {mode === "signup" && (
              <div>
                <label className="mb-2 block text-xs uppercase tracking-widest text-muted-foreground">
                  Name
                </label>
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-xl border border-border/70 bg-secondary/40 px-4 py-3 text-sm outline-none focus:border-primary"
                />
              </div>
            )}
            {mode === "signup" && (
              <div>
                <label className="mb-2 block text-xs uppercase tracking-widest text-muted-foreground">
                  Phone
                </label>
                <input
                  required
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="w-full rounded-xl border border-border/70 bg-secondary/40 px-4 py-3 text-sm outline-none focus:border-primary"
                />
              </div>
            )}
            <div>
              <label className="mb-2 block text-xs uppercase tracking-widest text-muted-foreground">
                Email
              </label>
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-border/70 bg-secondary/40 px-4 py-3 text-sm outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="mb-2 block text-xs uppercase tracking-widest text-muted-foreground">
                Password
              </label>
              <input
                required
                minLength={6}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-border/70 bg-secondary/40 px-4 py-3 text-sm outline-none focus:border-primary"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3 text-sm font-medium text-primary-foreground btn-magnetic disabled:opacity-60"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === "signin" ? "Sign in" : "Create account"}
            </button>
          </form>
          )}

          <p className="mt-8 text-center text-xs text-muted-foreground">
            Driver? <Link to="/driver" className="text-primary hover:underline">Enter driver mode</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
