-- Data lineage for AI-generated policies: which job created them and what
-- org context was current at generation time (coverage score, timestamp).
ALTER TABLE org_genai_policies
  ADD COLUMN IF NOT EXISTS source_job_id      UUID REFERENCES ai_jobs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS generation_context JSONB;
-- generation_context shape: { coverage_score_at_generation: number, generated_at: string }
