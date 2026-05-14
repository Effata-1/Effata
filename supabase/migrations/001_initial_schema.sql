-- ============================================================
-- Effata — Initial Schema
-- Run this in Supabase SQL Editor
-- ============================================================

-- Enable UUID extension (already enabled by default in Supabase)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- organisations
-- ============================================================
CREATE TABLE organisations (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name             TEXT NOT NULL,
  type             TEXT NOT NULL DEFAULT 'enterprise' CHECK (type IN ('enterprise', 'consulting_firm', 'client')),
  parent_org_id    UUID REFERENCES organisations(id) ON DELETE SET NULL,
  branding         JSONB DEFAULT '{}'::jsonb,
  subscription_tier TEXT NOT NULL DEFAULT 'trial' CHECK (subscription_tier IN ('trial', 'starter', 'professional', 'enterprise')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE organisations ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- profiles (extends auth.users — one row per auth user)
-- ============================================================
CREATE TABLE profiles (
  id                   UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id               UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  role                 TEXT NOT NULL DEFAULT 'analyst' CHECK (role IN ('admin', 'analyst', 'read_only')),
  full_name            TEXT,
  assigned_client_orgs UUID[] DEFAULT ARRAY[]::UUID[],
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS policies — organisations
-- ============================================================
CREATE POLICY "users_see_own_org" ON organisations
  -- Use JWT claim directly — avoids subquery into profiles (prevents recursion)
  FOR SELECT USING (
    id = (auth.jwt() ->> 'org_id')::UUID
  );

-- ============================================================
-- RLS policies — profiles
-- ============================================================
CREATE POLICY "users_see_own_profile" ON profiles
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "admins_see_org_profiles" ON profiles
  FOR SELECT USING (
    org_id = (auth.jwt() ->> 'org_id')::UUID
    AND (auth.jwt() ->> 'user_role') = 'admin'
  );

-- ============================================================
-- JWT custom claim — inject org_id into every session token
-- This lets RLS policies use auth.jwt() ->> 'org_id' directly
-- ============================================================
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event JSONB)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  claims   JSONB;
  user_org UUID;
  user_role TEXT;
BEGIN
  SELECT org_id, role
    INTO user_org, user_role
    FROM public.profiles
   WHERE id = (event ->> 'user_id')::UUID;

  claims := event -> 'claims';

  IF user_org IS NOT NULL THEN
    claims := jsonb_set(claims, '{org_id}',  to_jsonb(user_org::TEXT));
    claims := jsonb_set(claims, '{user_role}', to_jsonb(user_role));
  END IF;

  RETURN jsonb_set(event, '{claims}', claims);
END;
$$;

GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM authenticated, anon, public;

-- ============================================================
-- Trigger: auto-create org + profile when a user signs up
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_org_id UUID;
  org_name   TEXT;
BEGIN
  -- Pull org name from metadata (passed from signup form)
  org_name := COALESCE(NEW.raw_user_meta_data->>'org_name', split_part(NEW.email, '@', 2));

  -- Create the organisation
  INSERT INTO organisations (name, type)
  VALUES (org_name, 'enterprise')
  RETURNING id INTO new_org_id;

  -- Create the profile as admin (first user of the org)
  INSERT INTO profiles (id, org_id, role, full_name)
  VALUES (
    NEW.id,
    new_org_id,
    'admin',
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
