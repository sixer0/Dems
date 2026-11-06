/*
 * TextScramble from Motion Primitives (MIT License, Copyright (c) 2024 ibelick).
 * Copied in from
 * https://raw.githubusercontent.com/ibelick/motion-primitives/main/components/core/text-scramble.tsx
 * on 2026-10-01. Upstream SHA-256
 * 119cda3b695ee97235ab7aaa62698a98e881d5bdc8b9c96d2597730cd07aeff2; see THIRD_PARTY_NOTICES.md.
 * The registry JSON (motion-primitives.com/c/text-scramble.json) is one revision older: it lacks
 * upstream fix #182, which derives the shown text from `children` so a changed hash never shows
 * stale text. The repository version was taken for that reason.
 *
 * Local changes (step 37; each marked `// DEMS:` below):
 *   1. `import type` for `MotionProps` (verbatimModuleSyntax).
 *   2. `motion.create(Component)` is memoised. Upstream calls it on every render, which remounts
 *      the element on every scramble tick.
 *   3. Motion policy (03_motion_spec §8, §12):
 *      - under reduced motion there is no scramble: the final text shows at once and
 *        `onScrambleComplete` still fires;
 *      - proof mode scales the duration.
 *   4. The interval is cleared on unmount.
 */
'use client';
import { type JSX, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import type { MotionProps } from 'motion/react'; // DEMS: 1
import { useMotionPolicy } from '@/motion'; // DEMS: 3

export type TextScrambleProps = {
  children: string;
  duration?: number;
  speed?: number;
  characterSet?: string;
  as?: React.ElementType;
  className?: string;
  trigger?: boolean;
  onScrambleComplete?: () => void;
} & MotionProps;

const defaultChars =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

export function TextScramble({
  children,
  duration = 0.8,
  speed = 0.04,
  characterSet = defaultChars,
  className,
  as: Component = 'p',
  trigger = true,
  onScrambleComplete,
  ...props
}: TextScrambleProps) {
  // DEMS: 2
  const MotionComponent = useMemo(
    () => motion.create(Component as keyof JSX.IntrinsicElements),
    [Component]
  );
  const [scrambledText, setScrambledText] = useState<string | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const text = children;
  const displayText = scrambledText ?? children;
  const m = useMotionPolicy(); // DEMS: 3
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null); // DEMS: 4

  const scramble = async () => {
    if (isAnimating) return;

    // DEMS: 3. Reduced motion: no character churn; the final text is already shown.
    if (m.reduced) {
      onScrambleComplete?.();
      return;
    }

    setIsAnimating(true);

    const steps = (duration * m.timeScale) / speed; // DEMS: 3
    let step = 0;

    const interval = setInterval(() => {
      let scrambled = '';
      const progress = step / steps;

      for (let i = 0; i < text.length; i++) {
        if (text[i] === ' ') {
          scrambled += ' ';
          continue;
        }

        if (progress * text.length > i) {
          scrambled += text[i];
        } else {
          scrambled +=
            characterSet[Math.floor(Math.random() * characterSet.length)];
        }
      }

      setScrambledText(scrambled);
      step++;

      if (step > steps) {
        clearInterval(interval);
        intervalRef.current = null; // DEMS: 4
        setScrambledText(null);
        setIsAnimating(false);
        onScrambleComplete?.();
      }
    }, speed * 1000);
    intervalRef.current = interval; // DEMS: 4
  };

  useEffect(() => {
    if (!trigger) return;

    scramble();
    // Upstream runs the scramble only when `trigger` changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger]);

  // DEMS: 4
  useEffect(
    () => () => {
      if (intervalRef.current !== null) clearInterval(intervalRef.current);
    },
    []
  );

  return (
    <MotionComponent className={className} {...props}>
      {displayText}
    </MotionComponent>
  );
}
