/*
 * ShineBorder from Magic UI (MIT License, Copyright (c) Magic UI).
 * Copied in from https://magicui.design/r/shine-border.json on 2026-10-01 (identical to
 * apps/www/registry/magicui/shine-border.tsx in magicuidesign/magicui). Upstream SHA-256
 * c9344b563c2427f26393f6f5e2fe5c72d6a3fcb4b90b8f073ebad515e963c46c; see THIRD_PARTY_NOTICES.md.
 *
 * Local changes (step 37; each marked `// DEMS:` below):
 *   1. Keyframes in Motion. The registry's `animate-shine` utility needs a global `@keyframes
 *      shine` rule, and the copy-in model never edits the global stylesheet. Motion's
 *      `useAnimate` now plays the same keyframes on the same element:
 *      - background-position 0% 0% → 100% 100% → 0% 0%;
 *      - `duration` seconds per cycle, linear, endless.
 *      The upstream compositor-hint class on `background-position` is dropped, because
 *      03_motion_spec §9.3 allows such hints in four named places only (MS-03).
 *   2. Tokens (M-C-23): the default `shineColor` is gold → bronze instead of black.
 *   3. Motion policy (§8, §9.4, R10):
 *      - the loop registers with the step-36 ambient registry (`useAmbientLoop`, cap 4) and runs
 *        only while granted, visible and on screen;
 *      - it is off under reduced motion (a static border), which replaces upstream `motion-safe:`;
 *      - proof mode scales the period.
 *      New optional props: `active`, `loopGroup` (default `shine-border`) and `loopPriority`.
 */
"use client"

import * as React from "react"
import { useAnimate } from "motion/react" // DEMS: 1
import { palette } from "@dems/shared/tokens" // DEMS: 2

import { cn } from "@/lib/utils"
import { useAmbientLoop, useMotionPolicy, type AmbientPriority } from "@/motion" // DEMS: 3

interface ShineBorderProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Width of the border in pixels
   * @default 1
   */
  borderWidth?: number
  /**
   * Duration of the animation in seconds
   * @default 14
   */
  duration?: number
  /**
   * Color of the border, can be a single color or an array of colors
   * @default [gold, bronze] (DEMS: 2)
   */
  shineColor?: string | string[]
  /** DEMS: 3. The caller's own run condition (default true). */
  active?: boolean
  /** DEMS: 3. Ambient loops with the same group share one of the four viewport slots. */
  loopGroup?: string
  /** DEMS: 3. `page` loops win slots over `shell` loops. */
  loopPriority?: AmbientPriority
}

// DEMS: 1. The registry keyframes `shine`.
const SHINE_KEYFRAMES = { backgroundPosition: ["0% 0%", "100% 100%", "0% 0%"] }

/**
 * Shine Border
 *
 * An animated background border effect component with configurable properties.
 */
export function ShineBorder({
  borderWidth = 1,
  duration = 14,
  shineColor = [palette.gold, palette.bronze],
  active = true,
  loopGroup = "shine-border",
  loopPriority = "page",
  className,
  style,
  ...props
}: ShineBorderProps) {
  // DEMS: 1, 3
  const [scope, animate] = useAnimate<HTMLDivElement>()
  const m = useMotionPolicy()
  const loop = useAmbientLoop("shine-border", {
    ref: scope,
    enabled: active,
    group: loopGroup,
    priority: loopPriority,
  })
  const periodSeconds = m.seconds(duration * 1000)

  React.useEffect(() => {
    const element = scope.current
    if (!loop.running || !element) return undefined
    const controls = animate(element, SHINE_KEYFRAMES, {
      duration: periodSeconds,
      ease: "linear",
      repeat: Infinity,
    })
    return () => {
      controls.stop()
      element.style.backgroundPosition = "" // back to the static frame
    }
  }, [loop.running, periodSeconds, animate, scope])

  return (
    <div
      ref={scope}
      {...loop.attrs}
      style={
        {
          "--border-width": `${borderWidth}px`,
          "--duration": `${duration}s`,
          backgroundImage: `radial-gradient(transparent,transparent, ${
            Array.isArray(shineColor) ? shineColor.join(",") : shineColor
          },transparent,transparent)`,
          backgroundSize: "300% 300%",
          mask: `linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)`,
          WebkitMask: `linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)`,
          WebkitMaskComposite: "xor",
          maskComposite: "exclude",
          padding: "var(--border-width)",
          ...style,
        } as React.CSSProperties
      }
      className={cn(
        "pointer-events-none absolute inset-0 size-full rounded-[inherit]", // DEMS: 1, 3
        className
      )}
      {...props}
    />
  )
}
