import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ConditionalSidebar } from '@/components/nav/conditional-sidebar'

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
      <ConditionalSidebar />
      <main className="flex-1 overflow-hidden bg-zinc-950">
        {children}
      </main>
    </div>
  )
}
