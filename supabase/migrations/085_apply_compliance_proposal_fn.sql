-- Atomic approval of a compliance proposal.
-- All writes (compliance_regulations, compliance_requirements,
-- compliance_verification_log, compliance_proposed_changes) succeed or fail together.
-- Uses FOR UPDATE to prevent concurrent double-approvals.

CREATE OR REPLACE FUNCTION apply_compliance_proposal(
  p_proposal_id uuid,
  p_reviewed_by uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_proposal   compliance_proposed_changes%ROWTYPE;
  v_new_reg_id uuid;
  v_req        jsonb;
  v_matched_id uuid;
BEGIN
  -- Lock the row; if status != 'pending' or row doesn't exist → raise immediately.
  -- This prevents two concurrent approvals from both succeeding.
  SELECT * INTO v_proposal
  FROM compliance_proposed_changes
  WHERE id = p_proposal_id AND status = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Proposal not found or already reviewed';
  END IF;

  -- ── Apply changes ────────────────────────────────────────────────────────────

  IF v_proposal.change_type = 'update_regulation' THEN

    -- Update regulation-level fields only when they are present in proposed_data
    UPDATE compliance_regulations
    SET
      last_verified_at   = now(),
      content_updated_at = now(),
      summary  = CASE WHEN v_proposal.proposed_data ? 'summary'
                      THEN v_proposal.proposed_data ->> 'summary'
                      ELSE summary  END,
      max_fine = CASE WHEN v_proposal.proposed_data ? 'max_fine'
                      THEN v_proposal.proposed_data ->> 'max_fine'
                      ELSE max_fine END
    WHERE id = v_proposal.regulation_id;

    -- Apply each requirement field update
    FOR v_req IN
      SELECT value
      FROM jsonb_array_elements(
        COALESCE(v_proposal.proposed_data -> 'requirements', '[]'::jsonb)
      )
    LOOP
      -- Locate the existing requirement by article via the current_data snapshot
      SELECT (r.value ->> 'id')::uuid INTO v_matched_id
      FROM jsonb_array_elements(
        COALESCE(v_proposal.current_data -> 'requirements', '[]'::jsonb)
      ) AS r(value)
      WHERE r.value ->> 'article' = v_req ->> 'article';

      IF v_matched_id IS NOT NULL THEN
        UPDATE compliance_requirements
        SET
          description   = CASE WHEN v_req ->> 'field' = 'description'
                               THEN v_req ->> 'new_value'
                               ELSE description   END,
          dlp_relevance = CASE WHEN v_req ->> 'field' = 'dlp_relevance'
                               THEN v_req ->> 'new_value'
                               ELSE dlp_relevance END,
          fine          = CASE WHEN v_req ->> 'field' = 'fine'
                               THEN v_req ->> 'new_value'
                               ELSE fine          END,
          severity      = CASE WHEN v_req ->> 'field' = 'severity'
                               THEN v_req ->> 'new_value'
                               ELSE severity      END,
          dlp_controls  = CASE WHEN v_req ->> 'field' = 'dlp_controls'
                               THEN ARRAY(SELECT jsonb_array_elements_text(v_req -> 'new_value'))
                               ELSE dlp_controls  END
        WHERE id = v_matched_id;
      END IF;
    END LOOP;

  ELSIF v_proposal.change_type = 'new_regulation' THEN

    INSERT INTO compliance_regulations (
      code, short_name, name, regions, industries,
      jurisdiction, authority, type, summary, max_fine,
      effective_date, source_url, active
    ) VALUES (
      v_proposal.proposed_data ->> 'code',
      v_proposal.proposed_data ->> 'short_name',
      v_proposal.proposed_data ->> 'name',
      ARRAY(SELECT jsonb_array_elements_text(v_proposal.proposed_data -> 'regions')),
      -- industries is nullable; jsonb_typeof distinguishes JSON null from missing key
      CASE WHEN jsonb_typeof(v_proposal.proposed_data -> 'industries') = 'array'
           THEN ARRAY(SELECT jsonb_array_elements_text(v_proposal.proposed_data -> 'industries'))
           ELSE NULL END,
      v_proposal.proposed_data ->> 'jurisdiction',
      v_proposal.proposed_data ->> 'authority',
      v_proposal.proposed_data ->> 'type',
      v_proposal.proposed_data ->> 'summary',
      v_proposal.proposed_data ->> 'max_fine',
      (v_proposal.proposed_data ->> 'effective_date')::date,
      v_proposal.proposed_data ->> 'source_url',
      true
    )
    RETURNING id INTO v_new_reg_id;

    INSERT INTO compliance_requirements (
      regulation_id, article, title, description,
      dlp_relevance, fine, severity, dlp_controls
    )
    SELECT
      v_new_reg_id,
      req.value ->> 'article',
      req.value ->> 'title',
      req.value ->> 'description',
      req.value ->> 'dlp_relevance',
      req.value ->> 'fine',
      req.value ->> 'severity',
      ARRAY(SELECT jsonb_array_elements_text(req.value -> 'dlp_controls'))
    FROM jsonb_array_elements(
      COALESCE(v_proposal.proposed_data -> 'requirements', '[]'::jsonb)
    ) AS req(value);

  ELSE
    RAISE EXCEPTION 'Unknown change_type: %', v_proposal.change_type;
  END IF;

  -- ── Audit log ────────────────────────────────────────────────────────────────

  INSERT INTO compliance_verification_log (
    regulation_id, org_id, verified_by, changed, notes, changes
  ) VALUES (
    COALESCE(v_proposal.regulation_id, v_new_reg_id),
    '00000000-0000-0000-0000-000000000000'::uuid,
    p_reviewed_by,
    true,
    'Admin approved AI proposal',
    jsonb_build_object('source', 'admin_approval', 'proposal_id', p_proposal_id)
  );

  -- ── Mark applied ─────────────────────────────────────────────────────────────

  UPDATE compliance_proposed_changes
  SET
    status      = 'applied',
    reviewed_by = p_reviewed_by,
    reviewed_at = now(),
    applied_at  = now()
  WHERE id = p_proposal_id;

END;
$$;
