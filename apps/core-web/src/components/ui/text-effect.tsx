/*
 * TextEffect from Motion Primitives (MIT License, Copyright (c) 2024 ibelick).
 * Copied in from https://motion-primitives.com/c/text-effect.json on 2026-10-01 (identical to
 * components/core/text-effect.tsx in ibelick/motion-primitives). Upstream SHA-256
 * 4b93c0ea6b9d747d69b7a244d5279f790a11a784e73713f3fe17a636abf53484; see THIRD_PARTY_NOTICES.md.
 *
 * Local changes (step 37; each marked `// DEMS:` below):
 *   1. Tokens (03_motion_spec §1 "rack focus", §2): the `blur`, `fade-in-blur` and `slide`
 *      presets use `blur.focusIn` (6 px) and `distance.rise` (12 px) instead of 12 px blur and a
 *      20 px rise. Segments ease with `luxe` unless `segmentTransition` sets another ease.
 *   2. Motion policy (§8, §12): under reduced motion every preset and custom variant becomes
 *      opacity only, at most `fast` (160 ms), with no stagger. In proof mode (`?motion=slow`)
 *      stagger, delay and segment duration are multiplied by the time scale.
 *   3. The custom stagger and delay are read through the `hasTransition` type guard instead of
 *      a cast after optional chaining (oxlint `no-unsafe-optional-chaining`); same values.
 */
'use client';
import { cn } from '@/lib/utils';
import {
  AnimatePresence,
  motion
} from 'motion/react';
import type {
  TargetAndTransition,
  Transition,
  Variant,
  Variants,
} from 'motion/react'
import React from 'react';
import { motion as motionTokens } from '@dems/shared/tokens'; // DEMS: 1
import { useMotionPolicy } from '@/motion'; // DEMS: 2

// DEMS: 1. Token distances for the presets.
const RISE = motionTokens.distance.rise;
const FOCUS_BLUR = `blur(${motionTokens.blur.focusIn}px)`;

export type PresetType = 'blur' | 'fade-in-blur' | 'scale' | 'fade' | 'slide';

export type PerType = 'word' | 'char' | 'line';

export type TextEffectProps = {
  children: string;
  per?: PerType;
  as?: keyof React.JSX.IntrinsicElements;
  variants?: {
    container?: Variants;
    item?: Variants;
  };
  className?: string;
  preset?: PresetType;
  delay?: number;
  speedReveal?: number;
  speedSegment?: number;
  trigger?: boolean;
  onAnimationComplete?: () => void;
  onAnimationStart?: () => void;
  segmentWrapperClassName?: string;
  containerTransition?: Transition;
  segmentTransition?: Transition;
  style?: React.CSSProperties;
};

const defaultStaggerTimes: Record<PerType, number> = {
  char: 0.03,
  word: 0.05,
  line: 0.1,
};

const defaultContainerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
    },
  },
  exit: {
    transition: { staggerChildren: 0.05, staggerDirection: -1 },
  },
};

const defaultItemVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
  },
  exit: { opacity: 0 },
};

const presetVariants: Record<
  PresetType,
  { container: Variants; item: Variants }
> = {
  // DEMS: 1 (blur, fade-in-blur, slide: token blur and rise)
  blur: {
    container: defaultContainerVariants,
    item: {
      hidden: { opacity: 0, filter: FOCUS_BLUR },
      visible: { opacity: 1, filter: 'blur(0px)' },
      exit: { opacity: 0, filter: FOCUS_BLUR },
    },
  },
  'fade-in-blur': {
    container: defaultContainerVariants,
    item: {
      hidden: { opacity: 0, y: RISE, filter: FOCUS_BLUR },
      visible: { opacity: 1, y: 0, filter: 'blur(0px)' },
      exit: { opacity: 0, y: RISE, filter: FOCUS_BLUR },
    },
  },
  scale: {
    container: defaultContainerVariants,
    item: {
      hidden: { opacity: 0, scale: 0 },
      visible: { opacity: 1, scale: 1 },
      exit: { opacity: 0, scale: 0 },
    },
  },
  fade: {
    container: defaultContainerVariants,
    item: {
      hidden: { opacity: 0 },
      visible: { opacity: 1 },
      exit: { opacity: 0 },
    },
  },
  slide: {
    container: defaultContainerVariants,
    item: {
      hidden: { opacity: 0, y: RISE },
      visible: { opacity: 1, y: 0 },
      exit: { opacity: 0, y: RISE },
    },
  },
};

// DEMS: 2. Reduced motion (§8): opacity only, no stagger, whatever the preset or custom variants.
// `visible` keeps the resting value of each transform or filter key that the full variant uses, so
// text that already landed does not move if the policy flips to reduced on a live page (the
// step-36 D-1 pattern).
const RESTING_KEYS = ['x', 'y', 'scale', 'rotate', 'filter'] as const;
const reducedContainerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};
const toReducedItemVariants = (item: Variants): Variants => {
  const visible = item.visible;
  const resting: Record<string, unknown> = {};
  if (visible && typeof visible === 'object') {
    for (const key of RESTING_KEYS) {
      if (key in visible) resting[key] = (visible as Record<string, unknown>)[key];
    }
  }
  return {
    hidden: { opacity: 0 },
    visible: { ...resting, opacity: 1 } as Variant,
    exit: { opacity: 0 },
  };
};

const AnimationComponent: React.FC<{
  segment: string;
  variants: Variants;
  per: 'line' | 'word' | 'char';
  segmentWrapperClassName?: string;
}> = React.memo(({ segment, variants, per, segmentWrapperClassName }) => {
  const content =
    per === 'line' ? (
      <motion.span variants={variants} className='block'>
        {segment}
      </motion.span>
    ) : per === 'word' ? (
      <motion.span
        aria-hidden='true'
        variants={variants}
        className='inline-block whitespace-pre'
      >
        {segment}
      </motion.span>
    ) : (
      <motion.span className='inline-block whitespace-pre'>
        {segment.split('').map((char, charIndex) => (
          <motion.span
            key={`char-${charIndex}`}
            aria-hidden='true'
            variants={variants}
            className='inline-block whitespace-pre'
          >
            {char}
          </motion.span>
        ))}
      </motion.span>
    );

  if (!segmentWrapperClassName) {
    return content;
  }

  const defaultWrapperClassName = per === 'line' ? 'block' : 'inline-block';

  return (
    <span className={cn(defaultWrapperClassName, segmentWrapperClassName)}>
      {content}
    </span>
  );
});

AnimationComponent.displayName = 'AnimationComponent';

const splitText = (text: string, per: PerType) => {
  if (per === 'line') return text.split('\n');
  return text.split(/(\s+)/);
};

const hasTransition = (
  variant?: Variant
): variant is TargetAndTransition & { transition?: Transition } => {
  if (!variant) return false;
  return (
    typeof variant === 'object' && 'transition' in variant
  );
};

const createVariantsWithTransition = (
  baseVariants: Variants,
  transition?: Transition & { exit?: Transition }
): Variants => {
  if (!transition) return baseVariants;

  const { exit: _, ...mainTransition } = transition;

  return {
    ...baseVariants,
    visible: {
      ...baseVariants.visible,
      transition: {
        ...(hasTransition(baseVariants.visible)
          ? baseVariants.visible.transition
          : {}),
        ...mainTransition,
      },
    },
    exit: {
      ...baseVariants.exit,
      transition: {
        ...(hasTransition(baseVariants.exit)
          ? baseVariants.exit.transition
          : {}),
        ...mainTransition,
        staggerDirection: -1,
      },
    },
  };
};

export function TextEffect({
  children,
  per = 'word',
  as = 'p',
  variants,
  className,
  preset = 'fade',
  delay = 0,
  speedReveal = 1,
  speedSegment = 1,
  trigger = true,
  onAnimationComplete,
  onAnimationStart,
  segmentWrapperClassName,
  containerTransition,
  segmentTransition,
  style,
}: TextEffectProps) {
  const segments = splitText(children, per);
  const MotionTag = motion[as as keyof typeof motion] as typeof motion.div;
  const m = useMotionPolicy(); // DEMS: 2
  const reduced = m.reduced;
  const timeScale = m.timeScale;

  const baseVariants = preset
    ? presetVariants[preset]
    : { container: defaultContainerVariants, item: defaultItemVariants };

  // DEMS: 2. No stagger when reduced; proof mode scales the stagger.
  const stagger = reduced ? 0 : (defaultStaggerTimes[per] / speedReveal) * timeScale;

  // DEMS: 2. At most `fast` when reduced; proof mode scales the segment duration.
  const baseDuration = reduced
    ? Math.min((0.3 / speedSegment) * timeScale, m.seconds(motionTokens.duration.fast))
    : (0.3 / speedSegment) * timeScale;

  // DEMS: 3. Same values as upstream, read through the `hasTransition` type guard.
  const customVisible = variants?.container?.visible;

  const customStagger = hasTransition(customVisible)
    ? customVisible.transition?.staggerChildren
    : undefined;

  const customDelay = hasTransition(customVisible)
    ? customVisible.transition?.delayChildren
    : undefined;

  // DEMS: 2. Custom stagger and delay values are seconds; proof mode scales them too.
  const resolvedStagger = reduced
    ? 0
    : typeof customStagger === 'number'
      ? customStagger * timeScale
      : stagger;
  const resolvedDelay =
    (typeof customDelay === 'number' ? customDelay : delay) * timeScale;

  const itemVariants = variants?.item || baseVariants.item;

  const computedVariants = {
    container: createVariantsWithTransition(
      // DEMS: 2
      reduced
        ? reducedContainerVariants
        : variants?.container || baseVariants.container,
      {
        staggerChildren: resolvedStagger,
        delayChildren: resolvedDelay,
        ...containerTransition,
        ...(reduced ? { staggerChildren: 0 } : {}),
        exit: {
          staggerChildren: resolvedStagger,
          staggerDirection: -1,
        },
      }
    ),
    item: createVariantsWithTransition(
      reduced ? toReducedItemVariants(itemVariants) : itemVariants, // DEMS: 2
      {
        duration: baseDuration,
        ease: motionTokens.easing.luxe, // DEMS: 1
        ...segmentTransition,
        ...(reduced ? { duration: baseDuration, delay: 0 } : {}), // DEMS: 2
      }
    ),
  };

  return (
    <AnimatePresence mode='popLayout'>
      {trigger && (
        <MotionTag
          initial='hidden'
          animate='visible'
          exit='exit'
          variants={computedVariants.container}
          className={className}
          onAnimationComplete={onAnimationComplete}
          onAnimationStart={onAnimationStart}
          style={style}
        >
          {per !== 'line' ? <span className='sr-only'>{children}</span> : null}
          {segments.map((segment, index) => (
            <AnimationComponent
              key={`${per}-${index}-${segment}`}
              segment={segment}
              variants={computedVariants.item}
              per={per}
              segmentWrapperClassName={segmentWrapperClassName}
            />
          ))}
        </MotionTag>
      )}
    </AnimatePresence>
  );
}
