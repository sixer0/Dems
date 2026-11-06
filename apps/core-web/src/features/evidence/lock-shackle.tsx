import { motion } from 'motion/react'
import { useMotionPolicy } from '@/motion'

/**
 * The RBAC-denial lock (03_motion_spec M-PG-EVID "an RBAC denial shows the Alert slide (240) plus a
 * lock-icon shackle close"; the shackle motion of M-C-22: rotate 20° → 0 on the `snappy` spring).
 * Only the shackle's transform animates. Reduced motion: drawn closed.
 */
export function LockShackle({ size = 20 }: { size?: number }) {
  const m = useMotionPolicy()
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" data-testid="lock-shackle">
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <motion.path
        d="M8 11V7a4 4 0 0 1 8 0v4"
        style={{ originX: '16px', originY: '11px', transformBox: 'view-box' }}
        initial={m.reduced ? false : { rotate: 20 }}
        animate={{ rotate: 0 }}
        transition={m.transitions.feedback}
      />
      <path d="M12 15v2" />
    </svg>
  )
}
