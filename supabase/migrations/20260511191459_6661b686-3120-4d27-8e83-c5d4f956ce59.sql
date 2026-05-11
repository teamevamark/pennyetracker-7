
-- ============ ROLES ============
CREATE TYPE public.app_role AS ENUM ('super_admin', 'admin', 'delivery');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin','super_admin')) $$;

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile + default role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'delivery');
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ LOCATIONS ============
CREATE TABLE public.states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.states ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.districts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state_id UUID NOT NULL REFERENCES public.states(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(state_id, name)
);
ALTER TABLE public.districts ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.panchayaths (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  district_id UUID NOT NULL REFERENCES public.districts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(district_id, name)
);
ALTER TABLE public.panchayaths ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.wards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  panchayath_id UUID NOT NULL REFERENCES public.panchayaths(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  ward_number TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(panchayath_id, name)
);
ALTER TABLE public.wards ENABLE ROW LEVEL SECURITY;

-- ============ DELIVERY STAFF ============
CREATE TABLE public.delivery_staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  vehicle_number TEXT,
  license_number TEXT,
  ward_id UUID REFERENCES public.wards(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.delivery_staff ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER delivery_staff_updated_at BEFORE UPDATE ON public.delivery_staff
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ POLICIES ============
-- profiles
CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Admins view all profiles" ON public.profiles FOR SELECT USING (public.is_admin(auth.uid()));
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins update profiles" ON public.profiles FOR UPDATE USING (public.is_admin(auth.uid()));

-- user_roles
CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins view all roles" ON public.user_roles FOR SELECT USING (public.is_admin(auth.uid()));
CREATE POLICY "Super admin manage roles insert" ON public.user_roles FOR INSERT WITH CHECK (public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "Super admin manage roles delete" ON public.user_roles FOR DELETE USING (public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "Super admin manage roles update" ON public.user_roles FOR UPDATE USING (public.has_role(auth.uid(),'super_admin'));

-- locations: signed-in read, admin write
DO $$ DECLARE t TEXT; BEGIN
  FOR t IN SELECT unnest(ARRAY['states','districts','panchayaths','wards']) LOOP
    EXECUTE format('CREATE POLICY "Authenticated read %1$s" ON public.%1$s FOR SELECT TO authenticated USING (true);', t);
    EXECUTE format('CREATE POLICY "Admins insert %1$s" ON public.%1$s FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));', t);
    EXECUTE format('CREATE POLICY "Admins update %1$s" ON public.%1$s FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));', t);
    EXECUTE format('CREATE POLICY "Admins delete %1$s" ON public.%1$s FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));', t);
  END LOOP;
END $$;

-- delivery_staff
CREATE POLICY "Admins view staff" ON public.delivery_staff FOR SELECT USING (public.is_admin(auth.uid()));
CREATE POLICY "Staff view self" ON public.delivery_staff FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins insert staff" ON public.delivery_staff FOR INSERT WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins update staff" ON public.delivery_staff FOR UPDATE USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins delete staff" ON public.delivery_staff FOR DELETE USING (public.is_admin(auth.uid()));

-- Helper: promote user to super_admin by email (run from SQL editor)
CREATE OR REPLACE FUNCTION public.promote_to_super_admin(_email TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid UUID;
BEGIN
  SELECT id INTO _uid FROM auth.users WHERE email = _email LIMIT 1;
  IF _uid IS NULL THEN RAISE EXCEPTION 'User % not found', _email; END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (_uid, 'super_admin')
  ON CONFLICT (user_id, role) DO NOTHING;
END; $$;
