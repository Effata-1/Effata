-- Per-user theme preference, synced on every login
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS theme_preference TEXT NOT NULL DEFAULT 'light'
    CHECK (theme_preference IN ('light', 'dark', 'system'));

-- SECURITY DEFINER function: allows any authenticated user to update ONLY their own
-- theme_preference column. Bypasses RLS intentionally, but is column-scoped so it
-- cannot touch role, org_id, assigned_client_orgs, or any other profile field.
-- auth.uid() is preserved inside SECURITY DEFINER — it still returns the calling user.
CREATE OR REPLACE FUNCTION public.set_own_theme_preference(p_theme TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_theme NOT IN ('light', 'dark', 'system') THEN
    RAISE EXCEPTION 'Invalid theme value: %', p_theme;
  END IF;

  UPDATE profiles
    SET theme_preference = p_theme
  WHERE id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_own_theme_preference(TEXT) TO authenticated;
