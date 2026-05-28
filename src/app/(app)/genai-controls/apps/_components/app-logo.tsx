'use client'

import { useState } from 'react'

function rootDomain(domain: string): string {
  return domain.replace(/^https?:\/\//, '').split('/')[0].split('.').slice(-2).join('.')
}

interface Props {
  domain:   string
  letter:   string
  bg:       string
  size:     number
  radius?:  string
  logoUrl?: string | null   // pre-resolved URL stored in DB — use directly when present
}

export function AppLogo({ domain, letter, bg, size, radius = 'rounded-xl', logoUrl }: Props) {
  const [failed, setFailed] = useState(false)

  // Use the stored URL first; fall back to Google Favicon API when not stored yet.
  const src = logoUrl ?? `https://www.google.com/s2/favicons?domain_url=https://${rootDomain(domain)}&sz=128`

  const containerStyle: React.CSSProperties = {
    width:          size,
    height:         size,
    flexShrink:     0,
    overflow:       'hidden',
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
    backgroundColor: failed ? bg : '#ffffff',
  }

  return (
    <div className={radius} style={containerStyle}>
      {failed ? (
        <span style={{ fontWeight: 700, fontSize: size * 0.38, color: 'white', userSelect: 'none' }}>
          {letter}
        </span>
      ) : (
        <img
          src={src}
          alt=""
          onError={() => setFailed(true)}
          style={{ width: '72%', height: '72%', objectFit: 'contain' }}
        />
      )}
    </div>
  )
}
