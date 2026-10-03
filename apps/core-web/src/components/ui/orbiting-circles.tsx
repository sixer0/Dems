/*
 * OrbitingCircles from Magic UI (MIT License, Copyright (c) Magic UI).
 * Copied in from https://magicui.design/r/orbiting-circles.json on 2026-10-01 (identical to
 * apps/www/registry/magicui/orbiting-circles.tsx in magicuidesign/magicui). Upstream SHA-256
 * 859b88b6c22144e5cd4bf04ab49d339090eea13b422d3085a80584e6b9d4da68; see THIRD_PARTY_NOTICES.md.
 *
 * Local changes (step 37; each marked `// DEMS:` below):
 *   1. Keyframes in Motion. The registry's `animate-orbit` utility needs a global `@keyframes
 *      orbit` rule, and the copy-in model never edits the global stylesheet. The rule
 *      `rotate(a + t) translateY(r) rotate(-(a + t))` for t = 0 → 360° splits into three nested
 *      layers, all composite-only transforms:
 *      - a carrier rotating by t around the orbit centre;
 *      - the upstream element, with the static `rotate(a) translateY(r) rotate(-a)`;
 *      - an inner layer counter-rotating by -t, so the child stays upright.
 *      The rest is unchanged: linear, `duration / speed` seconds per turn, `reverse` turns the
 *      other way. `transform-gpu` is dropped, because the inline transform replaces it.
 *   2. Tokens: the path ring uses `stroke-bronze/20` instead of the black and white 10% pair,
 *      because the console is dark only.
 *   3. Motion policy (03_motion_spec §8, §9.4, R10, M-C-23):
 *      - the orbit registers with the step-36 ambient registry (`useAmbientLoop`, cap 4) and turns
 *        only while granted, visible and on screen;
 *      - under reduced motion the icons stay still at their base angles;
 *      - proof mode scales the period.
 *      New optional props: `active` (for example "GNSS locked"), `loopGroup` (default
 *      `orbiting-circles`, so concentric rings count as one loop) and `loopPriority`.
 */
import React, { useRef } from "react"
import { motion, type MotionStyle } from "motion/react" // DEMS: 1

import { cn } from "@/lib/utils"
import { useAmbientLoop, useMotionPolicy, type AmbientPriority } from "@/motion" // DEMS: 3

export interface OrbitingCirclesProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string
  children?: React.ReactNode
  reverse?: boolean
  duration?: number
  delay?: number
  radius?: number
  path?: boolean
  iconSize?: number
  speed?: number
  /** DEMS: 3. The caller's own run condition (default true). */
  active?: boolean
  /** DEMS: 3. Ambient loops with the same group share one of the four viewport slots. */
  loopGroup?: string
  /** DEMS: 3. `page` loops win slots over `shell` loops. */
  loopPriority?: AmbientPriority
}

export function OrbitingCircles({
  className,
  children,
  reverse,
  duration = 20,
  radius = 160,
  path = true,
  iconSize = 30,
  speed = 1,
  active = true,
  loopGroup = "orbiting-circles",
  loopPriority = "page",
  ...props
}: OrbitingCirclesProps) {
  const calculatedDuration = duration / speed
  // DEMS: 3
  const anchorRef = useRef<HTMLDivElement>(null)
  const m = useMotionPolicy()
  const loop = useAmbientLoop("orbiting-circles", {
    ref: anchorRef,
    enabled: active,
    group: loopGroup,
    priority: loopPriority,
  })
  // DEMS: 1
  const turn = reverse ? -360 : 360
  const spin = loop.running
    ? {
        duration: m.seconds(calculatedDuration * 1000),
        ease: "linear" as const,
        repeat: Infinity,
      }
    : { duration: 0 }

  return (
    <>
      {path && (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          version="1.1"
          className="pointer-events-none absolute inset-0 size-full"
        >
          <circle
            className="stroke-bronze/20 stroke-1" // DEMS: 2
            cx="50%"
            cy="50%"
            r={radius}
            fill="none"
          />
        </svg>
      )}
      {React.Children.map(children, (child, index) => {
        const angle = (360 / React.Children.count(children)) * index
        return (
          // DEMS: 1. Carrier: turns by t around the orbit centre.
          <motion.div
            ref={index === 0 ? anchorRef : undefined}
            {...loop.attrs}
            className="absolute flex size-(--icon-size) items-center justify-center"
            style={{ "--icon-size": `${iconSize}px` } as MotionStyle}
            animate={{ rotate: loop.running ? turn : 0 }}
            transition={spin}
          >
            <div
              style={
                {
                  "--duration": calculatedDuration,
                  "--radius": radius,
                  "--angle": angle,
                  "--icon-size": `${iconSize}px`,
                  // DEMS: 1. The static part of the orbit transform.
                  transform: `rotate(${angle}deg) translateY(${radius}px) rotate(${-angle}deg)`,
                } as React.CSSProperties
              }
              className={cn(
                `flex size-(--icon-size) items-center justify-center rounded-full`,
                className
              )}
              {...props}
            >
              {/* DEMS: 1. Counter-rotation keeps the child upright. */}
              <motion.div
                className="flex size-full items-center justify-center"
                animate={{ rotate: loop.running ? -turn : 0 }}
                transition={spin}
              >
                {child}
              </motion.div>
            </div>
          </motion.div>
        )
      })}
    </>
  )
}
