-- ==============================================================================
-- SELAM KIDS - SUPABASE DATABASE SETUP & MIGRATION
-- Run this in your Supabase Dashboard: SQL Editor -> New query -> Run
-- ==============================================================================

-- 1. Create the public.profiles table
-- Note: id references auth.users.id, passwords are NEVER stored here.
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE,
  full_name TEXT,
  display_name TEXT DEFAULT '',
  email TEXT,
  avatar_url TEXT DEFAULT '',
  gender TEXT DEFAULT '',
  age INTEGER,
  legacy_points INTEGER NOT NULL DEFAULT 0,
  is_admin BOOLEAN NOT NULL DEFAULT FALSE,
  is_super_admin BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- If table already existed without full_name, add it safely
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS display_name TEXT DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username TEXT;

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. Row Level Security Policies (Protected with auth.uid())

-- Read policy: Users can read their own profile
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Users can read own profile"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Insert policy: Users can only insert their own profile
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
  ON public.profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Update policy: Users can only update their own profile (NEVER another user's profile)
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 4. Trigger function to auto-create / auto-sync profile when user signs up (Email or Google OAuth)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_full_name TEXT;
  v_avatar_url TEXT;
  v_base_username TEXT;
  v_clean_username TEXT;
  v_counter INTEGER := 1;
BEGIN
  -- Safely extract user metadata from Google OAuth or Email signup
  v_full_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    NEW.raw_user_meta_data->>'display_name',
    SPLIT_PART(NEW.email, '@', 1),
    'Reader'
  );

  v_avatar_url := COALESCE(
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.raw_user_meta_data->>'picture',
    ''
  );

  -- Generate clean base username
  v_base_username := LOWER(
    REGEXP_REPLACE(
      COALESCE(
        NEW.raw_user_meta_data->>'username',
        v_full_name,
        SPLIT_PART(NEW.email, '@', 1),
        'reader'
      ),
      '[^a-z0-9]',
      '',
      'g'
    )
  );

  IF v_base_username = '' THEN
    v_base_username := 'reader';
  END IF;

  v_clean_username := SUBSTRING(v_base_username FROM 1 FOR 20);

  -- Ensure unique username
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = v_clean_username AND id != NEW.id) LOOP
    v_clean_username := SUBSTRING(v_base_username FROM 1 FOR 15) || v_counter;
    v_counter := v_counter + 1;
  END LOOP;

  -- Insert profile row
  INSERT INTO public.profiles (
    id,
    email,
    username,
    full_name,
    display_name,
    avatar_url,
    gender,
    age,
    legacy_points,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    v_clean_username,
    v_full_name,
    v_full_name,
    v_avatar_url,
    COALESCE(NEW.raw_user_meta_data->>'gender', ''),
    CASE 
      WHEN NEW.raw_user_meta_data->>'age' IS NOT NULL AND NEW.raw_user_meta_data->>'age' ~ '^[0-9]+$' 
      THEN (NEW.raw_user_meta_data->>'age')::INTEGER 
      ELSE NULL 
    END,
    0,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), profiles.full_name),
    display_name = COALESCE(NULLIF(EXCLUDED.display_name, ''), profiles.display_name),
    avatar_url = COALESCE(NULLIF(EXCLUDED.avatar_url, ''), profiles.avatar_url),
    updated_at = NOW();

  RETURN NEW;
END;
$$;

-- 5. Attach the trigger to auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 6. Storage bucket for avatar uploads (optional)
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
CREATE POLICY "Avatar images are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Authenticated users can upload avatars" ON storage.objects;
CREATE POLICY "Authenticated users can upload avatars"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'avatars' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
CREATE POLICY "Users can update their own avatar"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
