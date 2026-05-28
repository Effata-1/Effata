-- Add logo_url to genai_apps.
-- Stores a pre-resolved logo URL so the frontend never needs to cascade
-- through multiple external sources on every page load.
-- Populated here using Google Favicon API (reliable, always available).

ALTER TABLE genai_apps ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- Derive root domain (e.g. "chat.openai.com/foo" → "openai.com") and build favicon URL.
UPDATE genai_apps
SET logo_url = 'https://www.google.com/s2/favicons?domain_url=https://' ||
  (regexp_matches(domain, '([^./]+\.[^./]+)(?:/|$)'))[1] || '&sz=128'
WHERE logo_url IS NULL;
