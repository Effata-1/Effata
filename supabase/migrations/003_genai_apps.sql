-- ============================================================
-- GenAI Apps — global catalog + per-org customer classification
-- ============================================================

-- Master list of GenAI apps (global, not per-org)
CREATE TABLE genai_apps (
  app_id       TEXT PRIMARY KEY,            -- 'chatgpt', 'gemini', etc.
  app_name     TEXT NOT NULL,
  vendor       TEXT NOT NULL,
  domain       TEXT NOT NULL,
  app_type     TEXT NOT NULL,
  logo_letter  TEXT NOT NULL DEFAULT 'A',
  logo_bg      TEXT NOT NULL DEFAULT '#6366f1',
  status       TEXT NOT NULL DEFAULT 'active',
  last_updated DATE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE genai_apps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_read_genai_apps" ON genai_apps
  FOR SELECT TO authenticated USING (true);

-- Profile fields per app per mode (enterprise / personal)
-- fields      = all scored fields as JSONB
-- dlp         = DLP activity support scores
-- breach_info = breach history fields
CREATE TABLE genai_app_profiles (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  app_id      TEXT NOT NULL REFERENCES genai_apps(app_id) ON DELETE CASCADE,
  mode        TEXT NOT NULL CHECK (mode IN ('enterprise', 'personal')),
  fields      JSONB NOT NULL DEFAULT '{}',
  dlp         JSONB NOT NULL DEFAULT '{}',
  breach_info JSONB NOT NULL DEFAULT '{}',
  UNIQUE (app_id, mode)
);

ALTER TABLE genai_app_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_read_genai_profiles" ON genai_app_profiles
  FOR SELECT TO authenticated USING (true);

-- Per-org customer classification (the one field customers control)
CREATE TABLE genai_customer_classifications (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id                  UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  app_id                  TEXT NOT NULL REFERENCES genai_apps(app_id) ON DELETE CASCADE,
  customer_classification TEXT NOT NULL DEFAULT 'unknown'
    CHECK (customer_classification IN (
      'enterprise-approved', 'approved-with-conditions',
      'permitted-with-restriction', 'personal', 'unknown', 'prohibited'
    )),
  classification_scope    TEXT,
  notes                   TEXT,
  updated_by              UUID REFERENCES profiles(id),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, app_id)
);

ALTER TABLE genai_customer_classifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_manage_classifications" ON genai_customer_classifications
  FOR ALL
  USING (org_id = (auth.jwt() ->> 'org_id')::UUID)
  WITH CHECK (org_id = (auth.jwt() ->> 'org_id')::UUID);

CREATE TRIGGER genai_classifications_updated_at
  BEFORE UPDATE ON genai_customer_classifications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
