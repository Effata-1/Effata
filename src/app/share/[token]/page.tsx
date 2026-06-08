import { createClient }           from '@supabase/supabase-js'
import type { PresentationSnapshot } from '@/app/(app)/genai-controls/presentation/actions'
import { SharedDeck }              from './_components/shared-deck'

export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

  const { data } = await supabase
    .from('genai_presentations')
    .select('id, title, snapshot, created_at')
    .eq('public_token', token)
    .eq('is_public', true)
    .is('revoked_at', null)
    .maybeSingle()

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3 max-w-sm px-6">
          <div className="w-12 h-12 rounded-xl bg-card border border-border flex items-center justify-center mx-auto">
            <svg className="w-6 h-6 text-muted-foreground/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          </div>
          <h1 className="text-sm font-semibold text-foreground/70">Link expired or revoked</h1>
          <p className="text-xs text-muted-foreground/50">
            This presentation link is no longer active. Contact the sender to request a new link.
          </p>
        </div>
      </div>
    )
  }

  const snapshot  = data.snapshot as PresentationSnapshot
  const createdAt = new Date(data.created_at as string).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  return <SharedDeck snapshot={snapshot} createdAt={createdAt} />
}
