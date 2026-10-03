/*
 * AnimatedNumber from Motion Primitives (MIT License, Copyright (c) 2024 ibelick).
 * Copied in from https://motion-primitives.com/c/animated-number.json on 2026-10-01 (identical to
 * components/core/animated-number.tsx in ibelick/motion-primitives). Upstream SHA-256
 * 3b4a9f3262cb79527fba01a76576e920e340137f0643bf34a7732f7f8b1ff792; see THIRD_PARTY_NOTICES.md.
 *
 * Local changes (step 37; each marked `// DEMS:` below):
 *   1. `import type` for type-only imports (verbatimModuleSyntax); the global `JSX` cast is gone
 *      (React 19 has no global JSX namespace; see change 2).
 *   2. No new motion component per render. Upstream calls `motion.create(as)` on every render,
 *      which makes a new component type each time and remounts the element. Now a tag uses
 *      Motion's cached `motion.<tag>`, and a custom component is wrapped once (memoised).
 *   3. Motion policy (03_motion_spec §8, M-C-02): the default spring is the `counter` token
 *      (time-scaled in proof mode). Under reduced motion the final number is rendered as plain
 *      text, and the spring is jumped so that a later switch back to full motion starts from it.
 *      Rendering the text directly matters under StrictMode: the second effect pass jumps to an
 *      unchanged value, so Motion emits no change and a MotionValue child would stay stale.
 *   4. Two optional props: `format` (default: upstream integer `toLocaleString()`) and `from`, a
 *      mount start value. When `from` is set, the first tick waits for the held beat (R4, 120 ms).
 */
'use client';
import { cn } from '@/lib/utils';
import { motion, useSpring, useTransform } from 'motion/react';
import type { SpringOptions } from 'motion/react'; // DEMS: 1
import { useEffect, useMemo, useRef } from 'react'; // DEMS: 2
import { useMotionPolicy } from '@/motion'; // DEMS: 3

export type AnimatedNumberProps = {
  value: number;
  className?: string;
  springOptions?: SpringOptions;
  as?: React.ElementType;
  /** DEMS: 4. Formats the animated value (default: rounded, `toLocaleString()`). */
  format?: (value: number) => string;
  /** DEMS: 4. Start value on mount (for example 0); the first tick waits for the held beat. */
  from?: number;
};

export function AnimatedNumber({
  value,
  className,
  springOptions,
  as: Component = 'span', // DEMS: 2 (renamed binding; the prop is still `as`)
  format,
  from,
}: AnimatedNumberProps) {
  // DEMS: 2. Tags come from Motion's own cached `motion.<tag>`; a custom component is created once.
  const MotionComponent = useMemo(
    () =>
      typeof Component === 'string'
        ? (motion[Component as keyof typeof motion] as typeof motion.span)
        : (motion.create(Component) as unknown as typeof motion.span),
    [Component]
  );
  const m = useMotionPolicy(); // DEMS: 3

  const spring = useSpring(from ?? value, springOptions ?? m.springOptions('counter')); // DEMS: 3, 4
  const formatValue = (current: number) =>
    format ? format(current) : Math.round(current).toLocaleString(); // DEMS: 4
  const display = useTransform(spring, formatValue);

  // DEMS: 4. Only the first update after a `from` mount waits for the held beat.
  const heldBeatPending = useRef(from !== undefined);
  const heldBeat = m.delays.heldBeat;
  const animateNumbers = m.flags.animateNumbers;

  useEffect(() => {
    // DEMS: 3. Reduced motion: numbers jump to their final value (§8 "Number tickers").
    if (!animateNumbers) {
      heldBeatPending.current = false;
      spring.jump(value);
      return undefined;
    }
    if (heldBeatPending.current) {
      const timer = setTimeout(() => {
        heldBeatPending.current = false;
        spring.set(value);
      }, heldBeat * 1000);
      return () => clearTimeout(timer);
    }
    spring.set(value);
    return undefined;
  }, [spring, value, animateNumbers, heldBeat]);

  return (
    <MotionComponent className={cn('tabular-nums', className)}>
      {/* DEMS: 3. Reduced motion renders the final value as text (robust under StrictMode). */}
      {animateNumbers ? display : formatValue(value)}
    </MotionComponent>
  );
}
