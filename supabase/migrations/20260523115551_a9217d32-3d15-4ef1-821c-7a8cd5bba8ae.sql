-- Update handle_new_user trigger to support pending self-signups
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, phone)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email, NEW.phone),
    NEW.phone
  )
  ON CONFLICT (id) DO NOTHING;

  -- Only auto-assign 'delivery' role when this is NOT a pending self-signup.
  IF COALESCE(NEW.raw_user_meta_data->>'pending', 'false') <> 'true' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'delivery')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;

-- Ensure the trigger exists on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Allow pending self-signup users to read their own delivery_staff row (for pending status check)
DROP POLICY IF EXISTS "Staff view self by user_id" ON public.delivery_staff;
CREATE POLICY "Staff view self by user_id"
ON public.delivery_staff
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);