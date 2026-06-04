'use client'

import { motion, useReducedMotion } from 'framer-motion'

export function FadeIn({
  children,
  delay = 0,
  duration = 0.3,
  className,
}: {
  children: React.ReactNode
  delay?: number
  duration?: number
  className?: string
}) {
  const shouldReduceMotion = useReducedMotion()
  return (
    <motion.div
      initial={shouldReduceMotion ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={
        shouldReduceMotion
          ? { duration: 0 }
          : { duration, delay, ease: [0.21, 0.47, 0.32, 0.98] }
      }
      className={className}
    >
      {children}
    </motion.div>
  )
}
