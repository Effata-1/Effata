'use client'

import { useState } from 'react'

function rootDomain(domain: string): string {
  return domain.replace(/^https?:\/\//, '').split('/')[0].split('.').slice(-2).join('.')
}

interface Props {
  domain: string
  letter: string
  bg:     string
  size:   number
  radius?: string
}

// Source cascade:
// 1. logo.clearbit.com  — proper brand logo (free tier, works for most major companies)
// 2. Google favicon S2  — always available, smaller but recognisable icon
// 3. Letter avatar       — guaranteed fallback

const SOURCES = (domain: string) => {
  const root = rootDomain(domain)
  return [
    `https://logo.clearbit.com/${root}`,
    `https://www.google.com/s2/favicons?domain_url=https://${root}&sz=128`,
  ]
}

export function AppLogo({ domain, letter, bg, size, radius = 'rounded-xl' }: Props) {
  const sources = SOURCES(domain)
  const [srcIndex, setSrcIndex] = useState(0)
  const [allFailed, setAllFailed] = useState(false)

  function handleError() {
    if (srcIndex + 1 < sources.length) {
      setSrcIndex(i => i + 1)
    } else {
      setAllFailed(true)
    }
  }

  const containerStyle: React.CSSProperties = {
    width:       size,
    height:      size,
    flexShrink:  0,
    overflow:    'hidden',
    display:     'flex',
    alignItems:  'center',
    justifyContent: 'center',
    backgroundColor: allFailed ? bg : '#ffffff',
  }

  return (
    <div className={radius} style={containerStyle}>
      {allFailed ? (
        <span style={{ fontWeight: 700, fontSize: size * 0.38, color: 'white', userSelect: 'none' }}>
          {letter}
        </span>
      ) : (
        <img
          key={srcIndex}
          src={sources[srcIndex]}
          alt=""
          onError={handleError}
          style={{
            width:      srcIndex === 0 ? '82%' : '68%',
            height:     srcIndex === 0 ? '82%' : '68%',
            objectFit:  'contain',
          }}
        />
      )}
    </div>
  )
}
