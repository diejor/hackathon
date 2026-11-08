// Route-level transition wrapper. App.tsx renders one of these per route, keyed by route,
// inside an AnimatePresence with mode="wait" so the old page finishes leaving before the new
// one arrives. Keeps the router's scroll-to-top and heading focus working unchanged.
import type { ReactNode } from 'react'
import { motion, useReducedMotion } from 'motion/react'

/** Short enough that navigation still feels instant, long enough to read as a move. */
const DURATION = 0.26

export function PageTransition({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion()

  // With reduced motion on, cross-fade only — no movement.
  const variants = reduced
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
      }
    : {
        initial: { opacity: 0, y: 14, filter: 'blur(3px)' },
        animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
        exit: { opacity: 0, y: -10, filter: 'blur(3px)' },
      }

  return (
    <motion.div
      initial="initial"
      animate="animate"
      exit="exit"
      variants={variants}
      transition={{ duration: reduced ? 0.15 : DURATION, ease: [0.22, 0.61, 0.36, 1] }}
      style={{ willChange: 'transform, opacity' }}
    >
      {children}
    </motion.div>
  )
}

/**
 * Staggered reveal for a group of cards or tiles. Wrap the container in <Reveal> and each
 * child in <RevealItem> — they come in one after another instead of all at once.
 */
export function Reveal({ children, className = '' }: { children: ReactNode; className?: string }) {
  const reduced = useReducedMotion()
  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="shown"
      variants={{
        hidden: {},
        shown: { transition: { staggerChildren: reduced ? 0 : 0.07, delayChildren: 0.05 } },
      }}
    >
      {children}
    </motion.div>
  )
}

export function RevealItem({ children, className = '' }: { children: ReactNode; className?: string }) {
  const reduced = useReducedMotion()
  return (
    <motion.div
      className={className}
      variants={{
        hidden: reduced ? { opacity: 0 } : { opacity: 0, y: 16 },
        shown: {
          opacity: 1,
          y: 0,
          transition: { duration: reduced ? 0.15 : 0.38, ease: [0.22, 0.61, 0.36, 1] },
        },
      }}
    >
      {children}
    </motion.div>
  )
}
