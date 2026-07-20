
-- Remove phone-verification gating from RLS (SMS OTP requires an SMS provider that isn't configured)
-- and tighten profiles visibility so phone numbers aren't world-readable.

-- rides
DROP POLICY IF EXISTS "verified rider creates ride" ON public.rides;
DROP POLICY IF EXISTS "verified users read allowed rides" ON public.rides;
DROP POLICY IF EXISTS "verified users update allowed rides" ON public.rides;

CREATE POLICY "rider creates own ride" ON public.rides
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = rider_id);

CREATE POLICY "read allowed rides" ON public.rides
  FOR SELECT TO authenticated
  USING (
    auth.uid() = rider_id
    OR auth.uid() = driver_id
    OR (status = 'pending'::ride_status AND public.has_role(auth.uid(), 'driver'::app_role))
  );

CREATE POLICY "update allowed rides" ON public.rides
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = rider_id
    OR auth.uid() = driver_id
    OR (status = 'pending'::ride_status AND public.has_role(auth.uid(), 'driver'::app_role))
  )
  WITH CHECK (
    auth.uid() = rider_id
    OR auth.uid() = driver_id
    OR (driver_id = auth.uid() AND public.has_role(auth.uid(), 'driver'::app_role))
  );

-- driver_locations
DROP POLICY IF EXISTS "verified driver updates own location" ON public.driver_locations;
DROP POLICY IF EXISTS "verified driver upserts own location" ON public.driver_locations;

CREATE POLICY "driver upserts own location" ON public.driver_locations
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = driver_id);

CREATE POLICY "driver updates own location" ON public.driver_locations
  FOR UPDATE TO authenticated
  USING (auth.uid() = driver_id)
  WITH CHECK (auth.uid() = driver_id);

-- user_roles: allow any authenticated user to self-assign 'driver' role (kept unverified)
DROP POLICY IF EXISTS "verified users can self-assign driver role" ON public.user_roles;
CREATE POLICY "users can self-assign driver role" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND role = 'driver'::app_role);

-- profiles: tighten SELECT so phone numbers aren't exposed to every signed-in user.
-- Users may read their own profile, and the counter-party of a shared ride.
DROP POLICY IF EXISTS "profiles are readable by authenticated" ON public.profiles;

CREATE POLICY "users read own profile" ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "users read counterparty profile via shared ride" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.rides r
      WHERE (
        (r.rider_id = auth.uid() AND r.driver_id = profiles.id)
        OR (r.driver_id = auth.uid() AND r.rider_id = profiles.id)
      )
      AND r.status IN ('accepted'::ride_status, 'arrived'::ride_status, 'in_progress'::ride_status)
    )
  );

-- Default phone_verified to true going forward (SMS OTP is disabled in the app),
-- and backfill existing rows so previously-created accounts can book & drive.
ALTER TABLE public.profiles ALTER COLUMN phone_verified SET DEFAULT true;
UPDATE public.profiles SET phone_verified = true WHERE phone_verified IS DISTINCT FROM true;
