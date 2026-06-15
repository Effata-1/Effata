'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { generatePresentation, revokePresentation } from '../actions'

interface Props {
  existing:  { id: string; public_token: string; revoked_at: string | null; created_at: string } | null
  onPresent?: () => void
}

export function PresentationActionsBar({ existing, onPresent }: Props) {
  const router                    = useRouter()
  const [isPending, start]        = useTransition()
  const [shareToken, setShareToken] = useState<string | null>(
    existing && !existing.revoked_at ? existing.public_token : null,
  )
  const [shareId, setShareId]     = useState<string | null>(
    existing && !existing.revoked_at ? existing.id : null,
  )
  const [copied, setCopied]       = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [origin, setOrigin]       = useState('')

  // Resolve origin client-side only to avoid SSR/hydration mismatch
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setOrigin(window.location.origin) }, [])

  const shareUrl = shareToken ? `${origin}/share/${shareToken}` : null

  function handlePrint() {
    window.print()
  }

  function handleShare() {
    setError(null)
    start(async () => {
      const result = await generatePresentation()
      if (result.error) { setError(result.error); return }
      if (result.token && result.id) {
        setShareToken(result.token)
        setShareId(result.id)
        router.refresh()
      }
    })
  }

  function handleRevoke() {
    if (!shareId) return
    if (!confirm('Revoke this share link? Anyone with the link will no longer be able to view it.')) return
    setError(null)
    start(async () => {
      const result = await revokePresentation(shareId)
      if (result.error) { setError(result.error); return }
      setShareToken(null)
      setShareId(null)
      router.refresh()
    })
  }

  function handleCopy() {
    if (!shareUrl) return
    void navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="print:hidden space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        {onPresent && (
          <button
            type="button"
            onClick={onPresent}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-md bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
            Present
          </button>
        )}
        <button
          type="button"
          onClick={handlePrint}
          className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-md border border-border bg-card hover:bg-muted/40 text-foreground/80 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          Download PDF
        </button>

        {!shareToken && (
          <button
            type="button"
            onClick={handleShare}
            disabled={isPending}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
            {isPending ? 'Generating…' : 'Share with CISO'}
          </button>
        )}

        {shareToken && (
          <button
            type="button"
            onClick={handleRevoke}
            disabled={isPending}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-md border border-red-500/30 bg-red-500/5 text-red-400 hover:bg-red-500/10 disabled:opacity-50 transition-colors"
          >
            {isPending ? 'Revoking…' : 'Revoke Link'}
          </button>
        )}
      </div>

      {shareToken && shareUrl && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/30 border border-border">
          <span className="text-xs text-muted-foreground/60 shrink-0">Share link:</span>
          <code className="flex-1 text-xs text-foreground/80 truncate">{shareUrl}</code>
          <button
            type="button"
            onClick={handleCopy}
            className="shrink-0 text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
}
