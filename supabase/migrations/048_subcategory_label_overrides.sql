-- Stores org-level overrides for catalog subcategory → classification label.
-- Used when a user manually reassigns a subcategory that has no org_data_types
-- in scope yet (catalog fallback rows in the Classifications page).

CREATE TABLE IF NOT EXISTS org_subcategory_label_overrides (
  org_id                      UUID        NOT NULL,
  subcategory                 TEXT        NOT NULL,
  org_classification_label_id UUID        NOT NULL,
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, subcategory)
);

ALTER TABLE org_subcategory_label_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation" ON org_subcategory_label_overrides
  USING ((org_id)::text = (auth.jwt() ->> 'org_id'));
