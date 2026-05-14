import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/nav/sidebar'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  // Check onboarding completion
  const { data: onboarding } = await supabase
    .from('onboarding_profiles')
    .select('completed')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!onboarding?.completed) {
    redirect('/onboarding')
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto bg-zinc-950">
        <div className="p-8">{children}</div>
      </main>
    </div>
  )
}
