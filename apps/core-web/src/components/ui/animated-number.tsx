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
 *   5. A hidden page (`document.visibilityState === 'hidden'`) runs no animation frames, so a spring
 *      started there never paints: the text stayed at `from` (audit DF-18, the dashboard headline
 *      "0.0 TB Free" beside the card's "0.4 TB"). While the page is hidden the final value is rendered
 *      as text and the spring is jumped, as under reduced motion; back on screen nothing replays.
 *   6. A view can say it is visible and still run no animation frames (an embedded or occluded pane:
 *      audit U-04b, the dashboard read "0.0 TB Free" / "0% USED" about 10 s after load with
 *      `document.hidden === false`). Change 5 cannot see that, so the final value is guaranteed by a
 *      timer, not by frames: a `setTimeout` at the held beat + the counter's settle time + a margin
 *      checks the painted text; if it neither moved nor reached the final value, the spring is jumped
 *      and the component renders the final value as text from then on (`data-count-fallback`), as in
 *      change 5. One check is outstanding at a time, so a value that changes faster than the deadline
 *      cannot keep postponing it.
 */
'use client';
import { cn } from '@/lib/utils';
import { motion, useSpring, useTransform } from 'motion/react';
import type { SpringOptions } from 'motion/react'; // DEMS: 1
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'; // DEMS: 2, 5, 6
import { useMotionPolicy } from '@/motion'; // DEMS: 3

// DEMS: 5. Page visibility as an external store (no animation frames run while the page is hidden).
function subscribeVisibility(onChange: () => void): () => void {
  document.addEventListener('visibilitychange', onChange);
  return () => document.removeEventListener('visibilitychange', onChange);
}
const isPageHidden = () => typeof document !== 'undefined' && document.visibilityState === 'hidden';
const serverPageHidden = () => false;

/**
 * DEMS: 6. How long a count-up may take before the timer fallback renders the final value (ms, time-scaled by
 * the policy). The `counter` spring (stiffness 90, damping 20, mass 1; slowest pole about 6.8/s) settles a
 * 1,000-step count within about 1.2 s; 1.75 s leaves a margin. A started count-up that has not reached its
 * value by then is not being painted.
 */
export const COUNT_UP_FALLBACK_MS = 1750;

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
  // DEMS: 5. A hidden page counts as "no animation": its frames never run, so a spring would hold `from`.
  const pageHidden = useSyncExternalStore(subscribeVisibility, isPageHidden, serverPageHidden);
  // DEMS: 6. Set once the timer found a count-up that frames did not finish; from then on this view gets text.
  const [framesStalled, setFramesStalled] = useState(false);
  const animateNumbers = m.flags.animateNumbers && !pageHidden && !framesStalled;
  const fallbackDelayMs = m.seconds(COUNT_UP_FALLBACK_MS) * 1000;
  const finalText = formatValue(value);

  // DEMS: 6. The frame check. The painted text is the transform's, updated on frames only, so "the text moved, or
  // it is the final one" is the proof that frames run. ONE outstanding check per component: a value that changes
  // faster than the deadline (the write speed or session bytes while recording) must not keep pushing it away, so
  // a value change does not restart it; the check reads the latest value. Cleared on unmount and when the number
  // stops animating (reduced motion, hidden page).
  const latest = useRef({ value, finalText });
  const frameCheck = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    latest.current = { value, finalText };
  });
  useEffect(
    () => () => {
      if (frameCheck.current !== null) clearTimeout(frameCheck.current);
      frameCheck.current = null;
    },
    [],
  );

  useEffect(() => {
    // DEMS: 3, 5. Reduced motion or a hidden page: numbers jump to their final value (§8 "Number tickers").
    if (!animateNumbers) {
      heldBeatPending.current = false;
      if (frameCheck.current !== null) clearTimeout(frameCheck.current);
      frameCheck.current = null;
      spring.jump(value);
      return undefined;
    }
    // DEMS: 6. The final value never depends on animation frames: by the deadline (held beat, if pending, + the
    // settle time) the painted text must have moved or landed. Moved but not landed: one more window. Neither: the
    // view runs no frames - jump and render text from then on.
    const beatMs = heldBeatPending.current ? heldBeat * 1000 : 0;
    const arm = (delayMs: number) => {
      const startText = display.get();
      frameCheck.current = setTimeout(() => {
        frameCheck.current = null;
        const shown = display.get();
        if (shown === latest.current.finalText) return;
        if (shown !== startText) {
          arm(fallbackDelayMs);
          return;
        }
        heldBeatPending.current = false;
        spring.jump(latest.current.value);
        setFramesStalled(true);
      }, delayMs);
    };
    if (frameCheck.current === null && display.get() !== finalText) arm(beatMs + fallbackDelayMs);
    if (heldBeatPending.current) {
      const timer = setTimeout(() => {
        heldBeatPending.current = false;
        spring.set(value);
      }, beatMs);
      return () => clearTimeout(timer);
    }
    spring.set(value);
    return undefined;
  }, [spring, display, value, finalText, animateNumbers, heldBeat, fallbackDelayMs]);

  return (
    <MotionComponent className={cn('tabular-nums', className)} data-count-fallback={framesStalled ? 'true' : undefined}>
      {/* DEMS: 3, 5, 6. Reduced motion, a hidden page or a view without frames renders the final value as text (robust under StrictMode; no frames needed). */}
      {animateNumbers ? display : finalText}
    </MotionComponent>
  );
}
