-- ============================================================
-- Onboarding Profiles — stores 5-step wizard responses
-- ============================================================

CREATE TABLE onboarding_profiles (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Q1: Who are you and where do you operate?
  industry        TEXT,
  regions         TEXT[] DEFAULT ARRAY[]::TEXT[],

  -- Q2: Which DLP tool and licences/modules?
  tools           TEXT[] DEFAULT ARRAY[]::TEXT[],
  modules         JSONB DEFAULT '{}'::jsonb,   -- { toolId: [moduleId, ...] }

  -- Q3: Which coverage areas are configured today?
  coverage_areas  JSONB DEFAULT '{}'::jsonb,   -- { areaId: stateId }

  -- Q4: Policy maturity
  policy_presence TEXT,
  policy_mode     TEXT,
  incident_review TEXT,

  -- Q5: Data protection priorities
  data_categories TEXT[] DEFAULT ARRAY[]::TEXT[],
  top_priorities  TEXT[] DEFAULT ARRAY[]::TEXT[],

  -- Progress tracking
  current_step    INT NOT NULL DEFAULT 1,
  completed       BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at    TIMESTAMPTZ,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- One row per user
  UNIQUE (user_id)
);

ALTER TABLE onboarding_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_manage_own_onboarding" ON onboarding_profiles
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER onboarding_updated_at
  BEFORE UPDATE ON onboarding_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
