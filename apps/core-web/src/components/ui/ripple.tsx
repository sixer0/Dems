/*
 * Ripple from Magic UI (MIT License, Copyright (c) Magic UI).
 * Copied in from https://magicui.design/r/ripple.json on 2026-10-01 (identical to
 * apps/www/registry/magicui/ripple.tsx in magicuidesign/magicui). Upstream SHA-256
 * 1ac207017c0f4e993f83a1ead8b8a1b4a92286ef1595a297aba79782b2616eaf; see THIRD_PARTY_NOTICES.md.
 *
 * Local changes (step 37; each marked `// DEMS:` below):
 *   1. Keyframes in Motion. The registry's `animate-ripple` utility needs a global `@keyframes
 *      ripple` rule, and the copy-in model never edits the global stylesheet. The same timing is
 *      reproduced with Motion:
 *      - scale 1 → 0.9 → 1 over 2 s with the CSS `ease` curve;
 *      - each circle starts 60 ms after the previous one (the inline `animationDelay`);
 *      - the centring stays a `translate(-50%, -50%)`.
 *      The now-unused `--i` variable is dropped.
 *   2. Tokens (03_motion_spec M-C-23 "bronze"): a `color` prop (default bronze) replaces
 *      `--foreground` for the fill (25%) and the border.
 *   3. Motion policy (§8, §9.4, R10):
 *      - the loop registers with the step-36 ambient registry (`useAmbientLoop`, cap 4) and runs
 *        only while granted, visible and on screen;
 *      - it is off under reduced motion (static circles);
 *      - proof mode scales the period.
 *      New optional props: `active` (the caller's condition, for example "session idle"),
 *      `loopGroup` (loops in one group share a slot; default `ripple`) and `loopPriority`.
 */
import React, { useRef, type ComponentPropsWithoutRef } from "react"
import { motion, type MotionStyle } from "motion/react" // DEMS: 1
import { palette } from "@dems/shared/tokens" // DEMS: 2

import { cn } from "@/lib/utils"
import { useAmbientLoop, useMotionPolicy, type AmbientPriority } from "@/motion" // DEMS: 3

interface RippleProps extends ComponentPropsWithoutRef<"div"> {
  mainCircleSize?: number
  mainCircleOpacity?: number
  numCircles?: number
  /** DEMS: 2. Circle colour (hex); default bronze. */
  color?: string
  /** DEMS: 3. The caller's own run condition (default true). */
  active?: boolean
  /** DEMS: 3. Ambient loops with the same group share one of the four viewport slots. */
  loopGroup?: string
  /** DEMS: 3. `page` loops win slots over `shell` loops. */
  loopPriority?: AmbientPriority
}

// DEMS: 1. The registry keyframes: `ripple var(--duration, 2s) ease`, 0%/100% scale 1, 50% scale 0.9.
const RIPPLE_PERIOD_MS = 2000
const RIPPLE_STEP_MS = 60
const CSS_EASE = [0.25, 0.1, 0.25, 1] as const
const RIPPLE_KEYFRAMES = { scale: [1, 0.9, 1] }
const RIPPLE_REST = { scale: 1 }

export const Ripple = React.memo(function Ripple({
  mainCircleSize = 210,
  mainCircleOpacity = 0.24,
  numCircles = 8,
  color = palette.bronze,
  active = true,
  loopGroup = "ripple",
  loopPriority = "page",
  className,
  ...props
}: RippleProps) {
  // DEMS: 3
  const ref = useRef<HTMLDivElement>(null)
  const m = useMotionPolicy()
  const loop = useAmbientLoop("ripple", {
    ref,
    enabled: active,
    group: loopGroup,
    priority: loopPriority,
  })

  return (
    <div
      ref={ref}
      {...loop.attrs}
      className={cn(
        "pointer-events-none absolute inset-0 mask-[linear-gradient(to_bottom,white,transparent)] select-none",
        className
      )}
      {...props}
    >
      {Array.from({ length: numCircles }, (_, i) => {
        const size = mainCircleSize + i * 70
        const opacity = mainCircleOpacity - i * 0.03
        const borderStyle = "solid"

        return (
          <motion.div
            key={i}
            className={`absolute rounded-full border shadow-xl`}
            style={
              {
                width: `${size}px`,
                height: `${size}px`,
                opacity,
                borderStyle,
                borderWidth: "1px",
                // DEMS: 2
                borderColor: color,
                backgroundColor: `color-mix(in srgb, ${color} 25%, transparent)`,
                top: "50%",
                left: "50%",
                // DEMS: 1. translate(-50%, -50%), composed with the animated scale.
                x: "-50%",
                y: "-50%",
              } as MotionStyle
            }
            // DEMS: 1, 3
            animate={loop.running ? RIPPLE_KEYFRAMES : RIPPLE_REST}
            transition={
              loop.running
                ? {
                    duration: m.seconds(RIPPLE_PERIOD_MS),
                    ease: CSS_EASE,
                    delay: m.seconds(i * RIPPLE_STEP_MS),
                    repeat: Infinity,
                  }
                : { duration: 0 }
            }
          />
        )
      })}
    </div>
  )
})

Ripple.displayName = "Ripple"
