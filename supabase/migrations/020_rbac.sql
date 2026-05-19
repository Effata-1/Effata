-- RBAC: role-enforced RLS policies on profiles

-- Admins can update any profile in their org (for role changes)
CREATE POLICY "admins_update_org_profiles" ON profiles
  FOR UPDATE USING (
    org_id = (auth.jwt() ->> 'org_id')::UUID
    AND (auth.jwt() ->> 'user_role') = 'admin'
  );

-- Admins can delete profiles in their org (remove member), but not themselves
CREATE POLICY "admins_delete_org_profiles" ON profiles
  FOR DELETE USING (
    org_id = (auth.jwt() ->> 'org_id')::UUID
    AND (auth.jwt() ->> 'user_role') = 'admin'
    AND id != auth.uid()
  );
