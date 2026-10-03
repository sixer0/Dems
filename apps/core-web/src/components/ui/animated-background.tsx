/*
 * AnimatedBackground from Motion Primitives (MIT License, Copyright (c) 2024 ibelick).
 * Copied in from https://motion-primitives.com/c/animated-background.json on 2026-10-01 (identical
 * to components/core/animated-background.tsx in ibelick/motion-primitives). Upstream SHA-256
 * fa592713c408eaf58b21976c20737d84239c42a0b7e47cf9e7843121b1c0852c; see THIRD_PARTY_NOTICES.md.
 *
 * Local changes (step 37; each marked `// DEMS:` below):
 *   1. `import type` for type-only imports (verbatimModuleSyntax).
 *   2. Tokens (03_motion_spec M-SH-01): the default `transition` is the `indicator` spring
 *      (time-scaled in proof mode).
 *   3. Motion policy (§8 "Shared-element flights"): under reduced motion the background does not
 *      fly between items (no `layoutId`). It cross-fades at the destination instead.
 *   4. `defaultValue` seeds the initial state and later changes are applied during render. This
 *      replaces upstream's `setState` inside an effect (oxlint `set-state-in-effect`); the
 *      behaviour is the same.
 */
'use client';
import { cn } from '@/lib/utils';
import { AnimatePresence, motion } from 'motion/react';
import type { Transition } from 'motion/react'; // DEMS: 1
import {
  Children,
  cloneElement,
  type ReactElement,
  useState,
  useId,
} from 'react';
import { useMotionPolicy } from '@/motion'; // DEMS: 2, 3

export type AnimatedBackgroundProps = {
  children:
    | ReactElement<{ 'data-id': string }>[]
    | ReactElement<{ 'data-id': string }>;
  defaultValue?: string;
  onValueChange?: (newActiveId: string | null) => void;
  className?: string;
  transition?: Transition;
  enableHover?: boolean;
};

export function AnimatedBackground({
  children,
  defaultValue,
  onValueChange,
  className,
  transition,
  enableHover = false,
}: AnimatedBackgroundProps) {
  // DEMS: 4. Starts at `defaultValue` and follows later changes while rendering, instead of
  // setting state in an effect (same result, one render fewer).
  const [activeId, setActiveId] = useState<string | null>(defaultValue ?? null);
  const [seenDefaultValue, setSeenDefaultValue] = useState(defaultValue);
  if (defaultValue !== seenDefaultValue) {
    setSeenDefaultValue(defaultValue);
    if (defaultValue !== undefined) {
      setActiveId(defaultValue);
    }
  }
  const uniqueId = useId();
  // DEMS: 2, 3
  const m = useMotionPolicy();
  const flies = m.flags.sharedLayout;
  const resolvedTransition = flies
    ? (transition ?? m.transitions.indicator)
    : m.transitions.crossFade;

  const handleSetActiveId = (id: string | null) => {
    setActiveId(id);

    if (onValueChange) {
      onValueChange(id);
    }
  };

  return Children.map(children, (child: any, index) => {
    const id = child.props['data-id'];

    const interactionProps = enableHover
      ? {
          onMouseEnter: () => handleSetActiveId(id),
          onMouseLeave: () => handleSetActiveId(null),
        }
      : {
          onClick: () => handleSetActiveId(id),
        };

    return cloneElement(
      child,
      {
        key: index,
        className: cn('relative inline-flex', child.props.className),
        'data-checked': activeId === id ? 'true' : 'false',
        ...interactionProps,
      },
      <>
        <AnimatePresence initial={false}>
          {activeId === id && (
            <motion.div
              layoutId={flies ? `background-${uniqueId}` : undefined} // DEMS: 3
              className={cn('absolute inset-0', className)}
              transition={resolvedTransition} // DEMS: 2, 3
              initial={{ opacity: defaultValue ? 1 : 0 }}
              animate={{
                opacity: 1,
              }}
              exit={{
                opacity: 0,
              }}
            />
          )}
        </AnimatePresence>
        <div className='z-10'>{child.props.children}</div>
      </>
    );
  });
}
