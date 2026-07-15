DROP POLICY IF EXISTS "rider creates ride" ON public.rides;
CREATE POLICY "verified rider creates ride"
ON public.rides
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = rider_id
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND phone_verified = true
  )
);

DROP POLICY IF EXISTS "rider reads own rides" ON public.rides;
CREATE POLICY "verified users read allowed rides"
ON public.rides
FOR SELECT
TO authenticated
USING (
  (auth.uid() = rider_id)
  OR (auth.uid() = driver_id)
  OR (
    status = 'pending'::ride_status
    AND public.has_role(auth.uid(), 'driver'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND phone_verified = true
    )
  )
);

DROP POLICY IF EXISTS "rider updates own ride" ON public.rides;
CREATE POLICY "verified users update allowed rides"
ON public.rides
FOR UPDATE
TO authenticated
USING (
  (
    (auth.uid() = rider_id)
    OR (auth.uid() = driver_id)
    OR (
      status = 'pending'::ride_status
      AND public.has_role(auth.uid(), 'driver'::app_role)
    )
  )
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND phone_verified = true
  )
)
WITH CHECK (
  (
    (auth.uid() = rider_id)
    OR (auth.uid() = driver_id)
    OR (
      status = 'accepted'::ride_status
      AND driver_id = auth.uid()
      AND public.has_role(auth.uid(), 'driver'::app_role)
    )
  )
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND phone_verified = true
  )
);

DROP POLICY IF EXISTS "users can self-assign driver role" ON public.user_roles;
CREATE POLICY "verified users can self-assign driver role"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND role = 'driver'::app_role
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND phone_verified = true
  )
);

DROP POLICY IF EXISTS "driver upserts own location" ON public.driver_locations;
CREATE POLICY "verified driver upserts own location"
ON public.driver_locations
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = driver_id
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND phone_verified = true
  )
);

DROP POLICY IF EXISTS "driver updates own location" ON public.driver_locations;
CREATE POLICY "verified driver updates own location"
ON public.driver_locations
FOR UPDATE
TO authenticated
USING (
  auth.uid() = driver_id
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND phone_verified = true
  )
)
WITH CHECK (
  auth.uid() = driver_id
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND phone_verified = true
  )
);