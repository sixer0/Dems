/*
 * TransitionPanel from Motion Primitives (MIT License, Copyright (c) 2024 ibelick).
 * Copied in from https://motion-primitives.com/c/transition-panel.json on 2026-10-01 (identical to
 * components/core/transition-panel.tsx in ibelick/motion-primitives). Upstream SHA-256
 * 1b3c67058a09a560a034b7fe52ad1c205b589a63ed80055900e8a66830db0be2; see THIRD_PARTY_NOTICES.md.
 *
 * Local changes (step 37; each marked `// DEMS:` below):
 *   1. `import type` for type-only imports (verbatimModuleSyntax).
 *   2. Motion policy (03_motion_spec M-C-09, R7, §8):
 *      - without `variants` the panel uses the policy's direction-aware `step` variants
 *        (enter x ±24 → centre → exit x ∓24, spring `gentle`; pass `custom` = ±1);
 *      - under reduced motion the policy's opacity-only `step` variants always win, and the
 *        caller's `transition` is ignored.
 */
'use client';
import { AnimatePresence, motion } from 'motion/react';
import type { MotionProps, Transition, Variant } from 'motion/react'; // DEMS: 1
import { cn } from '@/lib/utils';
import { useMotionPolicy } from '@/motion'; // DEMS: 2

export type TransitionPanelProps = {
  children: React.ReactNode[];
  className?: string;
  transition?: Transition;
  activeIndex: number;
  variants?: { enter: Variant; center: Variant; exit: Variant };
} & MotionProps;

export function TransitionPanel({
  children,
  className,
  transition,
  variants,
  activeIndex,
  ...motionProps
}: TransitionPanelProps) {
  // DEMS: 2
  const m = useMotionPolicy();
  const resolvedVariants = m.reduced || !variants ? m.variants.step : variants;
  const resolvedTransition = m.reduced ? undefined : transition;

  return (
    <div className={cn('relative', className)}>
      <AnimatePresence
        initial={false}
        mode='popLayout'
        custom={motionProps.custom}
      >
        <motion.div
          key={activeIndex}
          variants={resolvedVariants}
          transition={resolvedTransition}
          initial='enter'
          animate='center'
          exit='exit'
          {...motionProps}
        >
          {children[activeIndex]}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
