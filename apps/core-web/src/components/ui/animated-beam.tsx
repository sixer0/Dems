/*
 * AnimatedBeam from Magic UI (MIT License, Copyright (c) Magic UI).
 * Copied in from https://magicui.design/r/animated-beam.json on 2026-10-01 (identical to
 * apps/www/registry/magicui/animated-beam.tsx in magicuidesign/magicui). Upstream SHA-256
 * 6afa2ee1d01694a428eb8517d48deebe5c6b532dc0ee871800bb9d92aae43e79; see THIRD_PARTY_NOTICES.md.
 *
 * Local changes (step 37; each marked `// DEMS:` below):
 *   1. Tokens (03_motion_spec M-C-23 "gradient bronze → gold"):
 *      - the gradient runs bronze → gold, and the idle path is gray;
 *      - the upstream ease `[0.16, 1, 0.3, 1]` is the `emphasized` token, now read from it.
 *   2. Motion policy (§8, §9.4, R10):
 *      - the travelling gradient registers with the step-36 ambient registry (`useAmbientLoop`,
 *        cap 4) and moves only while granted, visible and on screen;
 *      - under reduced motion only the static path shows ("Static paths");
 *      - proof mode scales `delay`, `duration` and `repeatDelay`.
 *      New optional props: `active` (for example "export running", M-C-23), `loopGroup`
 *      (default `animated-beam`, so every beam of one diagram counts as one loop, §9.4) and
 *      `loopPriority`.
 */
"use client"

import { useEffect, useId, useRef, useState, type RefObject } from "react" // DEMS: 2
import { motion } from "motion/react"
import { motion as motionTokens, palette } from "@dems/shared/tokens" // DEMS: 1

import { cn } from "@/lib/utils"
import { useAmbientLoop, useMotionPolicy, type AmbientPriority } from "@/motion" // DEMS: 2

// DEMS: 2. A zero-length gradient vector paints nothing (its last stop is transparent), which
// leaves only the static path.
const GRADIENT_REST = { x1: "0%", x2: "0%", y1: "0%", y2: "0%" }

export interface AnimatedBeamProps {
  className?: string
  containerRef: RefObject<HTMLElement | null> // Container ref
  fromRef: RefObject<HTMLElement | null>
  toRef: RefObject<HTMLElement | null>
  curvature?: number
  reverse?: boolean
  pathColor?: string
  pathWidth?: number
  pathOpacity?: number
  gradientStartColor?: string
  gradientStopColor?: string
  delay?: number
  duration?: number
  repeat?: number
  repeatDelay?: number
  startXOffset?: number
  startYOffset?: number
  endXOffset?: number
  endYOffset?: number
  /** DEMS: 2. The caller's own run condition (default true). */
  active?: boolean
  /** DEMS: 2. Ambient loops with the same group share one of the four viewport slots. */
  loopGroup?: string
  /** DEMS: 2. `page` loops win slots over `shell` loops. */
  loopPriority?: AmbientPriority
}

export const AnimatedBeam: React.FC<AnimatedBeamProps> = ({
  className,
  containerRef,
  fromRef,
  toRef,
  curvature = 0,
  reverse = false, // Include the reverse prop
  duration = 5,
  delay = 0,
  pathColor = palette.gray, // DEMS: 1
  pathWidth = 2,
  pathOpacity = 0.2,
  gradientStartColor = palette.bronze, // DEMS: 1
  gradientStopColor = palette.gold, // DEMS: 1
  repeat = Infinity,
  repeatDelay = 0,
  startXOffset = 0,
  startYOffset = 0,
  endXOffset = 0,
  endYOffset = 0,
  active = true,
  loopGroup = "animated-beam",
  loopPriority = "page",
}) => {
  const id = useId()
  const [pathD, setPathD] = useState("")
  const [svgDimensions, setSvgDimensions] = useState({ width: 0, height: 0 })
  // DEMS: 2
  const svgRef = useRef<SVGSVGElement>(null)
  const m = useMotionPolicy()
  const loop = useAmbientLoop("animated-beam", {
    ref: svgRef,
    enabled: active,
    group: loopGroup,
    priority: loopPriority,
  })

  // Calculate the gradient coordinates based on the reverse prop
  const gradientCoordinates = reverse
    ? {
        x1: ["90%", "-10%"],
        x2: ["100%", "0%"],
        y1: ["0%", "0%"],
        y2: ["0%", "0%"],
      }
    : {
        x1: ["10%", "110%"],
        x2: ["0%", "100%"],
        y1: ["0%", "0%"],
        y2: ["0%", "0%"],
      }

  useEffect(() => {
    const updatePath = () => {
      if (containerRef.current && fromRef.current && toRef.current) {
        const containerRect = containerRef.current.getBoundingClientRect()
        const rectA = fromRef.current.getBoundingClientRect()
        const rectB = toRef.current.getBoundingClientRect()

        const svgWidth = containerRect.width
        const svgHeight = containerRect.height
        setSvgDimensions({ width: svgWidth, height: svgHeight })

        const startX =
          rectA.left - containerRect.left + rectA.width / 2 + startXOffset
        const startY =
          rectA.top - containerRect.top + rectA.height / 2 + startYOffset
        const endX =
          rectB.left - containerRect.left + rectB.width / 2 + endXOffset
        const endY =
          rectB.top - containerRect.top + rectB.height / 2 + endYOffset

        const controlY = startY - curvature
        const d = `M ${startX},${startY} Q ${
          (startX + endX) / 2
        },${controlY} ${endX},${endY}`
        setPathD(d)
      }
    }

    // Initialize ResizeObserver
    const resizeObserver = new ResizeObserver(() => {
      updatePath()
    })

    // Observe the container element
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current)
    }

    // Call the updatePath initially to set the initial path
    updatePath()

    // Clean up the observer on component unmount
    return () => {
      resizeObserver.disconnect()
    }
  }, [
    containerRef,
    fromRef,
    toRef,
    curvature,
    startXOffset,
    startYOffset,
    endXOffset,
    endYOffset,
  ])

  return (
    <svg
      ref={svgRef} // DEMS: 2
      {...loop.attrs}
      fill="none"
      width={svgDimensions.width}
      height={svgDimensions.height}
      xmlns="http://www.w3.org/2000/svg"
      className={cn(
        "pointer-events-none absolute top-0 left-0 transform-gpu stroke-2",
        className
      )}
      viewBox={`0 0 ${svgDimensions.width} ${svgDimensions.height}`}
    >
      <path
        d={pathD}
        stroke={pathColor}
        strokeWidth={pathWidth}
        strokeOpacity={pathOpacity}
        strokeLinecap="round"
      />
      <path
        d={pathD}
        strokeWidth={pathWidth}
        stroke={`url(#${id})`}
        strokeOpacity="1"
        strokeLinecap="round"
      />
      <defs>
        <motion.linearGradient
          className="transform-gpu"
          id={id}
          gradientUnits={"userSpaceOnUse"}
          initial={GRADIENT_REST}
          // DEMS: 2. Travels only while the ambient loop runs; otherwise rests (static path only).
          animate={
            loop.running
              ? {
                  x1: gradientCoordinates.x1,
                  x2: gradientCoordinates.x2,
                  y1: gradientCoordinates.y1,
                  y2: gradientCoordinates.y2,
                }
              : GRADIENT_REST
          }
          transition={
            loop.running
              ? {
                  delay: m.seconds(delay * 1000), // DEMS: 2
                  duration: m.seconds(duration * 1000), // DEMS: 2
                  ease: motionTokens.easing.emphasized, // DEMS: 1 (same curve as upstream easeOutExpo)
                  repeat,
                  repeatDelay: m.seconds(repeatDelay * 1000), // DEMS: 2
                }
              : { duration: 0 }
          }
        >
          <stop stopColor={gradientStartColor} stopOpacity="0"></stop>
          <stop stopColor={gradientStartColor}></stop>
          <stop offset="32.5%" stopColor={gradientStopColor}></stop>
          <stop
            offset="100%"
            stopColor={gradientStopColor}
            stopOpacity="0"
          ></stop>
        </motion.linearGradient>
      </defs>
    </svg>
  )
}
