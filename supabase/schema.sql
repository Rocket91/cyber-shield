-- ============================================
-- CiberShield · Supabase Schema
-- ============================================

-- 1. TABLA DE PERFILES
CREATE TABLE IF NOT EXISTS public.perfiles (
  id         UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  nombre     TEXT,
  apellido   TEXT,
  plan       TEXT DEFAULT 'basico',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.perfiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ver perfil propio"
  ON public.perfiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Editar perfil propio"
  ON public.perfiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Insertar perfil propio"
  ON public.perfiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- 2. TRIGGER: crear perfil automático al registrarse
CREATE OR REPLACE FUNCTION public.crear_perfil()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.perfiles (id, nombre, apellido)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'nombre',
    NEW.raw_user_meta_data->>'apellido'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_signup ON auth.users;
CREATE TRIGGER on_signup
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.crear_perfil();
