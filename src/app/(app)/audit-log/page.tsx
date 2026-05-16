import { redirect } from 'next/navigation'

export default function AuditLogRedirect() {
  redirect('/settings/admin/audit-log')
}
