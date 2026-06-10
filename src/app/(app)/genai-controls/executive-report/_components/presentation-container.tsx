'use client'

import { useState } from 'react'
import { PresentationActionsBar } from './presentation-actions-bar'
import { PresentationSlideshow }  from '@/components/presentation/presentation-slideshow'
import type {
  CategorySlide, OverrideSlide, CoachingSlide, PolicySlide,
  AppCounts, SlideData,
} from '@/lib/genai/presentation-types'

export type { CategorySlide, OverrideSlide, CoachingSlide, PolicySlide, AppCounts, SlideData }

interface Props extends SlideData {
  existing:  { id: string; public_token: string; revoked_at: string | null; created_at: string } | null
  children:  React.ReactNode
}

export function PresentationContainer({ existing, children, ...slideData }: Props) {
  const [isPresenting, setIsPresenting] = useState(false)

  return (
    <>
      <PresentationActionsBar
        existing={existing}
        onPresent={() => setIsPresenting(true)}
      />

      {children}

      {isPresenting && (
        <PresentationSlideshow
          {...slideData}
          onClose={() => setIsPresenting(false)}
        />
      )}
    </>
  )
}
