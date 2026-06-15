import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ConditionalSidebar } from '@/components/nav/conditional-sidebar'
import { ThemeRestorer } from '@/components/providers/theme-restorer'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  // Check onboarding completion and fetch theme preference in one query
  const [{ data: onboarding }, { data: profile }] = await Promise.all([
    supabase.from('onboarding_profiles').select('completed').eq('user_id', user.id).maybeSingle(),
    supabase.from('profiles').select('theme_preference').eq('id', user.id).maybeSingle(),
  ])

  if (!onboarding?.completed) {
    redirect('/onboarding')
  }

  const savedTheme = profile?.theme_preference ?? 'light'

  return (
    <div className="flex h-screen overflow-hidden">
      <ThemeRestorer savedTheme={savedTheme} />
      <ConditionalSidebar />
      <main className="flex-1 overflow-hidden bg-background">
        {children}
      </main>
    </div>
  )
}
