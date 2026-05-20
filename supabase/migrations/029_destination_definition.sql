-- Migration 029: destination definition field
-- Stores org-specific URL/IP/domain definitions for destination profiles,
-- matching Netskope URL category format (one entry per line).

ALTER TABLE org_destination_profiles
  ADD COLUMN IF NOT EXISTS definition TEXT;
