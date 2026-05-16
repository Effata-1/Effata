'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { logAuditEvent } from '@/lib/audit'

export async function login(formData: FormData) {
  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  })

  if (error) return { error: error.message }

  await logAuditEvent({ action: 'auth.login_success' })
  redirect('/dashboard')
}

export async function signup(formData: FormData) {
  const supabase = await createClient()

  const { error } = await supabase.auth.signUp({
    email: formData.get('email') as string,
    password: formData.get('password') as string,
    options: {
      data: { org_name: formData.get('org_name') as string },
    },
  })

  if (error) return { error: error.message }

  await logAuditEvent({ action: 'auth.signup' })
  redirect('/dashboard')
}

export async function logout() {
  const supabase = await createClient()
  await logAuditEvent({ action: 'auth.logout' })
  await supabase.auth.signOut()
  redirect('/auth/login')
}
