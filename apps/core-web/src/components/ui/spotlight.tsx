/*
 * Spotlight from Motion Primitives (MIT License, Copyright (c) 2024 ibelick).
 * Copied in from https://motion-primitives.com/c/spotlight.json on 2026-10-01 (identical to
 * components/core/spotlight.tsx in ibelick/motion-primitives). Upstream SHA-256
 * 04419912db5ebe72a03199a39265a3db33398b3c48c0e854e9fb5be604700041; see THIRD_PARTY_NOTICES.md.
 *
 * Local changes (step 37; each marked `// DEMS:` below):
 *   1. `import type` for `SpringOptions` (verbatimModuleSyntax), and the unused default `React`
 *      import is removed (noUnusedLocals).
 *   2. Performance (03_motion_spec §9.2: `top` and `left` are never animated): the light is
 *      positioned with `x` and `y` transforms at a fixed `left: 0; top: 0`, not by animating
 *      `left` and `top`.
 *   3. Tokens (M-C-16 "bronze at 12%"): the zinc gradient stops become bronze at 12%, then 5%,
 *      then transparent. A `className` with gradient stops still overrides them.
 *   4. Motion policy (§8): under reduced motion the light jumps to the pointer instead of
 *      springing after it.
 */
'use client';
import { useRef, useState, useCallback, useEffect } from 'react'; // DEMS: 1
import { motion, useSpring, useTransform } from 'motion/react';
import type { SpringOptions } from 'motion/react'; // DEMS: 1
import { cn } from '@/lib/utils';
import { useMotionPolicy } from '@/motion'; // DEMS: 4

export type SpotlightProps = {
  className?: string;
  size?: number;
  springOptions?: SpringOptions;
};

export function Spotlight({
  className,
  size = 200,
  springOptions = { bounce: 0 },
}: SpotlightProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [parentElement, setParentElement] = useState<HTMLElement | null>(null);
  const reduced = useMotionPolicy().reduced; // DEMS: 4

  const mouseX = useSpring(0, springOptions);
  const mouseY = useSpring(0, springOptions);

  // DEMS: 2. Transform offsets instead of `left` / `top` strings.
  const spotlightX = useTransform(mouseX, (x) => x - size / 2);
  const spotlightY = useTransform(mouseY, (y) => y - size / 2);

  useEffect(() => {
    if (containerRef.current) {
      const parent = containerRef.current.parentElement;
      if (parent) {
        parent.style.position = 'relative';
        parent.style.overflow = 'hidden';
        setParentElement(parent);
      }
    }
  }, []);

  const handleMouseMove = useCallback(
    (event: MouseEvent) => {
      if (!parentElement) return;
      const { left, top } = parentElement.getBoundingClientRect();
      // DEMS: 4
      if (reduced) {
        mouseX.jump(event.clientX - left);
        mouseY.jump(event.clientY - top);
        return;
      }
      mouseX.set(event.clientX - left);
      mouseY.set(event.clientY - top);
    },
    [mouseX, mouseY, parentElement, reduced]
  );

  useEffect(() => {
    if (!parentElement) return;

    const abortController = new AbortController();

    parentElement.addEventListener('mousemove', handleMouseMove, {
      signal: abortController.signal,
    });
    parentElement.addEventListener('mouseenter', () => setIsHovered(true), {
      signal: abortController.signal,
    });
    parentElement.addEventListener('mouseleave', () => setIsHovered(false), {
      signal: abortController.signal,
    });

    return () => {
      abortController.abort();
    };
  }, [parentElement, handleMouseMove]);

  return (
    <motion.div
      ref={containerRef}
      className={cn(
        'pointer-events-none absolute rounded-full bg-[radial-gradient(circle_at_center,var(--tw-gradient-stops),transparent_80%)] blur-xl transition-opacity duration-200',
        'from-bronze/12 via-bronze/5 to-transparent', // DEMS: 3
        isHovered ? 'opacity-100' : 'opacity-0',
        className
      )}
      style={{
        width: size,
        height: size,
        // DEMS: 2
        left: 0,
        top: 0,
        x: spotlightX,
        y: spotlightY,
      }}
    />
  );
}
