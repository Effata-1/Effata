'use client'

import { useState } from 'react'

function rootDomain(domain: string): string {
  return domain.replace(/^https?:\/\//, '').split('/')[0].split('.').slice(-2).join('.')
}

interface Props {
  domain: string
  letter: string
  bg:     string
  size:   number   // px
  radius?: string  // tailwind class e.g. 'rounded-xl'
}

export function AppLogo({ domain, letter, bg, size, radius = 'rounded-xl' }: Props) {
  const [failed, setFailed] = useState(false)

  const style: React.CSSProperties = {
    width:  size,
    height: size,
    flexShrink: 0,
    backgroundColor: failed ? bg : '#ffffff',
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  }

  return (
    <div className={radius} style={style}>
      {failed ? (
        <span style={{ fontWeight: 700, fontSize: size * 0.38, color: 'white' }}>{letter}</span>
      ) : (
        <img
          src={`https://logo.clearbit.com/${rootDomain(domain)}`}
          alt=""
          onError={() => setFailed(true)}
          style={{ width: '78%', height: '78%', objectFit: 'contain' }}
        />
      )}
    </div>
  )
}
