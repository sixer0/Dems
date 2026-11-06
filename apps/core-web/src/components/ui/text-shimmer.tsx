/*
 * TextShimmer from Motion Primitives (MIT License, Copyright (c) 2024 ibelick).
 * Copied in from https://motion-primitives.com/c/text-shimmer.json on 2026-10-01 (identical to
 * components/core/text-shimmer.tsx in ibelick/motion-primitives). Upstream SHA-256
 * a294c8a1092296a38e28128ad8f2953401fcca85b5ae29ee479bd71bfac3348e; see THIRD_PARTY_NOTICES.md.
 *
 * Local changes (step 37; each marked `// DEMS:` below):
 *   1. `motion.create(Component)` is memoised. Upstream calls it on every render, which makes a
 *      new component type each time and remounts the element. Its type is narrowed so that a ref
 *      and data attributes type-check.
 *   2. Tokens: the base colour is `--foreground` and the sweep is `--accent` (gold). This replaces
 *      the zinc, black and white light/dark pairs, because the console is dark only.
 *   3. `repeat` prop (Motion semantics; default `Infinity`, as upstream). `repeat={0}` sweeps
 *      once, as used in M-PG-SM ("TextShimmer once, duration 2 s, then stops").
 *   4. Motion policy (03_motion_spec §8, §9.4, §12):
 *      - an endless shimmer is an ambient loop and registers with the step-36 registry
 *        (`useAmbientLoop`, cap 4);
 *      - under reduced motion the text stays on its final frame (plain base colour);
 *      - proof mode scales the duration.
 *      The sweep animates `background-position` on a text run only.
 */
'use client';
import React, { useMemo, useRef, type JSX } from 'react';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';
import { useAmbientLoop, useMotionPolicy } from '@/motion'; // DEMS: 4

export type TextShimmerProps = {
  children: string;
  as?: React.ElementType;
  className?: string;
  duration?: number;
  spread?: number;
  /** DEMS: 3. Extra sweeps after the first (Motion `repeat`); `0` sweeps once. */
  repeat?: number;
};

// DEMS: 4. The resting frame: the highlight has left the text, so only the base colour shows.
// Constant targets, so a re-render never restarts a sweep; toggling `sweeping` starts or rests it.
const REST = { backgroundPosition: '0% center' };
const SWEEP = { backgroundPosition: ['100% center', '0% center'] };

function TextShimmerComponent({
  children,
  as: Component = 'p',
  className,
  duration = 2,
  spread = 2,
  repeat = Infinity,
}: TextShimmerProps) {
  // DEMS: 1. Typed as a span only so the ref and data attributes type-check (a union over every
  // intrinsic element is too complex for TS2590); the rendered tag is still `Component`.
  const MotionComponent = useMemo(
    () =>
      motion.create(
        Component as keyof JSX.IntrinsicElements
      ) as unknown as typeof motion.span,
    [Component]
  );

  const dynamicSpread = useMemo(() => {
    return children.length * spread;
  }, [children, spread]);

  // DEMS: 4
  const m = useMotionPolicy();
  const ref = useRef<HTMLSpanElement>(null);
  const endless = repeat === Infinity;
  const loop = useAmbientLoop('text-shimmer', { ref, enabled: endless });
  const sweeping = endless ? loop.running : !m.reduced;

  return (
    <MotionComponent
      ref={ref}
      data-motion={m.policy}
      data-ambient={endless ? loop.attrs['data-ambient'] : undefined}
      className={cn(
        'relative inline-block bg-[length:250%_100%,auto] bg-clip-text',
        // DEMS: 2
        'text-transparent [--base-color:var(--foreground)] [--base-gradient-color:var(--accent)]',
        '[background-repeat:no-repeat,padding-box] [--bg:linear-gradient(90deg,#0000_calc(50%-var(--spread)),var(--base-gradient-color),#0000_calc(50%+var(--spread)))]',
        className
      )}
      initial={REST}
      animate={sweeping ? SWEEP : REST}
      // DEMS: 3, 4
      transition={
        sweeping
          ? { repeat, duration: duration * m.timeScale, ease: 'linear' }
          : { duration: 0 }
      }
      style={
        {
          '--spread': `${dynamicSpread}px`,
          backgroundImage: `var(--bg), linear-gradient(var(--base-color), var(--base-color))`,
        } as React.CSSProperties
      }
    >
      {children}
    </MotionComponent>
  );
}

export const TextShimmer = React.memo(TextShimmerComponent);
