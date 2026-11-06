/*
 * Particles from Magic UI (MIT License, Copyright (c) Magic UI).
 * Copied in from https://magicui.design/r/particles.json on 2026-10-01 (identical to
 * apps/www/registry/magicui/particles.tsx in magicuidesign/magicui). Upstream SHA-256
 * f768e19deca7c0ba9c424b4683b62cae3eedd11ef3dac8b0363e65c2773f236e; see THIRD_PARTY_NOTICES.md.
 *
 * Local changes (step 37; each marked `// DEMS:` below):
 *   1. Performance (03_motion_spec §9.3, no React renders for high-rate input): the pointer is
 *      kept in a ref by a window `mousemove` listener. Upstream held it in React state
 *      (`MousePosition()`), which re-rendered the component on every mouse move. The magnetism
 *      maths is unchanged.
 *   2. `NodeJS.Timeout` → `ReturnType<typeof setTimeout>` (the app has no Node types).
 *   3. Tokens (M-C-23 "color #FFC86B"): the default `color` is gold instead of white.
 *   4. Motion policy (§8, §9.4, R10):
 *      - the rAF loop registers with the step-36 ambient registry (`useAmbientLoop`, cap 4) and
 *        runs only while granted, visible and on screen; when paused, the canvas keeps its
 *        last frame and resumes from it;
 *      - under reduced motion one static frame is drawn at the particles' target opacity;
 *      - proof mode slows drift, fade and magnetism by the time scale.
 *      New optional props: `active`, `loopGroup` (default `particles`) and `loopPriority`.
 *      The callback refs (`initCanvasRef`, `animateRef`, …) are now assigned in a layout effect
 *      instead of during render (react `refs` lint rule); the callbacks themselves are unchanged.
 */
"use client"

import React, {
  useEffect,
  useLayoutEffect,
  useRef,
  type ComponentPropsWithoutRef,
} from "react"
import { palette } from "@dems/shared/tokens" // DEMS: 3

import { cn } from "@/lib/utils"
import { useAmbientLoop, useMotionPolicy, type AmbientPriority } from "@/motion" // DEMS: 4

interface MousePosition {
  x: number
  y: number
}

interface ParticlesProps extends ComponentPropsWithoutRef<"div"> {
  className?: string
  quantity?: number
  staticity?: number
  ease?: number
  size?: number
  refresh?: boolean
  color?: string
  vx?: number
  vy?: number
  /** DEMS: 4. The caller's own run condition (default true). */
  active?: boolean
  /** DEMS: 4. Ambient loops with the same group share one of the four viewport slots. */
  loopGroup?: string
  /** DEMS: 4. `page` loops win slots over `shell` loops. */
  loopPriority?: AmbientPriority
}

function hexToRgb(hex: string): number[] {
  hex = hex.replace("#", "")

  if (hex.length === 3) {
    hex = hex
      .split("")
      .map((char) => char + char)
      .join("")
  }

  const hexInt = parseInt(hex, 16)
  const red = (hexInt >> 16) & 255
  const green = (hexInt >> 8) & 255
  const blue = hexInt & 255
  return [red, green, blue]
}

type Circle = {
  x: number
  y: number
  translateX: number
  translateY: number
  size: number
  alpha: number
  targetAlpha: number
  dx: number
  dy: number
  magnetism: number
}

export const Particles: React.FC<ParticlesProps> = ({
  className = "",
  quantity = 100,
  staticity = 50,
  ease = 50,
  size = 0.4,
  refresh = false,
  color = palette.gold, // DEMS: 3
  vx = 0,
  vy = 0,
  active = true,
  loopGroup = "particles",
  loopPriority = "page",
  ...props
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const canvasContainerRef = useRef<HTMLDivElement>(null)
  const context = useRef<CanvasRenderingContext2D | null>(null)
  const circles = useRef<Circle[]>([])
  const mousePosition = useRef<MousePosition>({ x: 0, y: 0 }) // DEMS: 1
  const mouse = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const canvasSize = useRef<{ w: number; h: number }>({ w: 0, h: 0 })
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio : 1
  const rafID = useRef<number | null>(null)
  const resizeTimeout = useRef<ReturnType<typeof setTimeout> | null>(null) // DEMS: 2
  const initCanvasRef = useRef<() => void>(() => {})
  const onMouseMoveRef = useRef<() => void>(() => {})
  const animateRef = useRef<() => void>(() => {})
  const drawStaticFrameRef = useRef<() => void>(() => {}) // DEMS: 4

  // DEMS: 4
  const m = useMotionPolicy()
  const loop = useAmbientLoop("particles", {
    ref: canvasContainerRef,
    enabled: active,
    group: loopGroup,
    priority: loopPriority,
  })
  const running = loop.running
  const runningRef = useRef(running)
  const reduced = m.reduced
  const reducedRef = useRef(reduced)
  const speed = 1 / m.timeScale // DEMS: 4 (proof mode)

  useEffect(() => {
    if (canvasRef.current) {
      context.current = canvasRef.current.getContext("2d")
    }
    initCanvasRef.current()
    // DEMS: 4. The loop is started by the effect below. Reduced motion shows one still frame.
    if (reducedRef.current) drawStaticFrameRef.current()

    const handleResize = () => {
      if (resizeTimeout.current) {
        clearTimeout(resizeTimeout.current)
      }
      resizeTimeout.current = setTimeout(() => {
        initCanvasRef.current()
        if (reducedRef.current) drawStaticFrameRef.current() // DEMS: 4
      }, 200)
    }

    window.addEventListener("resize", handleResize)

    return () => {
      if (rafID.current != null) {
        window.cancelAnimationFrame(rafID.current)
      }
      if (resizeTimeout.current) {
        clearTimeout(resizeTimeout.current)
      }
      window.removeEventListener("resize", handleResize)
    }
  }, [color])

  // DEMS: 1. Pointer tracking without React state.
  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      mousePosition.current.x = event.clientX
      mousePosition.current.y = event.clientY
      onMouseMoveRef.current()
    }

    window.addEventListener("mousemove", handleMouseMove)

    return () => {
      window.removeEventListener("mousemove", handleMouseMove)
    }
  }, [])

  useEffect(() => {
    initCanvasRef.current()
    if (reducedRef.current) drawStaticFrameRef.current() // DEMS: 4
  }, [refresh])

  // DEMS: 4. Reduced motion (also when switched on live): one still frame. A loop that is only
  // paused (hidden tab, off screen, no free slot) keeps its last frame and resumes from it.
  useEffect(() => {
    if (reduced) drawStaticFrameRef.current()
  }, [reduced])

  // DEMS: 4. Runs the rAF loop only while the ambient registry grants it.
  useEffect(() => {
    if (!running) return undefined
    rafID.current = window.requestAnimationFrame(animateRef.current)
    return () => {
      if (rafID.current != null) {
        window.cancelAnimationFrame(rafID.current)
        rafID.current = null
      }
    }
  }, [running])

  const initCanvas = () => {
    resizeCanvas()
    drawParticles()
  }

  const onMouseMove = () => {
    if (canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect()
      const { w, h } = canvasSize.current
      const x = mousePosition.current.x - rect.left - w / 2 // DEMS: 1
      const y = mousePosition.current.y - rect.top - h / 2 // DEMS: 1
      const inside = x < w / 2 && x > -w / 2 && y < h / 2 && y > -h / 2
      if (inside) {
        mouse.current.x = x
        mouse.current.y = y
      }
    }
  }

  const resizeCanvas = () => {
    if (canvasContainerRef.current && canvasRef.current && context.current) {
      canvasSize.current.w = canvasContainerRef.current.offsetWidth
      canvasSize.current.h = canvasContainerRef.current.offsetHeight

      canvasRef.current.width = canvasSize.current.w * dpr
      canvasRef.current.height = canvasSize.current.h * dpr
      canvasRef.current.style.width = `${canvasSize.current.w}px`
      canvasRef.current.style.height = `${canvasSize.current.h}px`
      context.current.scale(dpr, dpr)

      // Clear existing particles and create new ones with exact quantity
      circles.current = []
      for (let i = 0; i < quantity; i++) {
        const circle = circleParams()
        drawCircle(circle)
      }
    }
  }

  const circleParams = (): Circle => {
    const x = Math.floor(Math.random() * canvasSize.current.w)
    const y = Math.floor(Math.random() * canvasSize.current.h)
    const translateX = 0
    const translateY = 0
    const pSize = Math.floor(Math.random() * 2) + size
    const alpha = 0
    const targetAlpha = parseFloat((Math.random() * 0.6 + 0.1).toFixed(1))
    const dx = (Math.random() - 0.5) * 0.1
    const dy = (Math.random() - 0.5) * 0.1
    const magnetism = 0.1 + Math.random() * 4
    return {
      x,
      y,
      translateX,
      translateY,
      size: pSize,
      alpha,
      targetAlpha,
      dx,
      dy,
      magnetism,
    }
  }

  const rgb = hexToRgb(color)

  const drawCircle = (circle: Circle, update = false) => {
    if (context.current) {
      const { x, y, translateX, translateY, size, alpha } = circle
      context.current.translate(translateX, translateY)
      context.current.beginPath()
      context.current.arc(x, y, size, 0, 2 * Math.PI)
      context.current.fillStyle = `rgba(${rgb.join(", ")}, ${alpha})`
      context.current.fill()
      context.current.setTransform(dpr, 0, 0, dpr, 0, 0)

      if (!update) {
        circles.current.push(circle)
      }
    }
  }

  const clearContext = () => {
    if (context.current) {
      context.current.clearRect(
        0,
        0,
        canvasSize.current.w,
        canvasSize.current.h
      )
    }
  }

  const drawParticles = () => {
    clearContext()
    const particleCount = quantity
    for (let i = 0; i < particleCount; i++) {
      const circle = circleParams()
      drawCircle(circle)
    }
  }

  // DEMS: 4. One still frame: every particle at its target opacity, nothing moves.
  const drawStaticFrame = () => {
    clearContext()
    circles.current.forEach((circle: Circle) => {
      circle.alpha = circle.targetAlpha
      drawCircle(circle, true)
    })
  }

  const remapValue = (
    value: number,
    start1: number,
    end1: number,
    start2: number,
    end2: number
  ): number => {
    const remapped =
      ((value - start1) * (end2 - start2)) / (end1 - start1) + start2
    return remapped > 0 ? remapped : 0
  }

  const animate = () => {
    clearContext()
    circles.current.forEach((circle: Circle, i: number) => {
      // Handle the alpha value
      const edge = [
        circle.x + circle.translateX - circle.size, // distance from left edge
        canvasSize.current.w - circle.x - circle.translateX - circle.size, // distance from right edge
        circle.y + circle.translateY - circle.size, // distance from top edge
        canvasSize.current.h - circle.y - circle.translateY - circle.size, // distance from bottom edge
      ]
      const closestEdge = edge.reduce((a, b) => Math.min(a, b))
      const remapClosestEdge = parseFloat(
        remapValue(closestEdge, 0, 20, 0, 1).toFixed(2)
      )
      if (remapClosestEdge > 1) {
        circle.alpha += 0.02 * speed // DEMS: 4
        if (circle.alpha > circle.targetAlpha) {
          circle.alpha = circle.targetAlpha
        }
      } else {
        circle.alpha = circle.targetAlpha * remapClosestEdge
      }
      circle.x += (circle.dx + vx) * speed // DEMS: 4
      circle.y += (circle.dy + vy) * speed // DEMS: 4
      circle.translateX +=
        ((mouse.current.x / (staticity / circle.magnetism) - circle.translateX) /
          ease) *
        speed // DEMS: 4
      circle.translateY +=
        ((mouse.current.y / (staticity / circle.magnetism) - circle.translateY) /
          ease) *
        speed // DEMS: 4

      drawCircle(circle, true)

      // circle gets out of the canvas
      if (
        circle.x < -circle.size ||
        circle.x > canvasSize.current.w + circle.size ||
        circle.y < -circle.size ||
        circle.y > canvasSize.current.h + circle.size
      ) {
        // remove the circle from the array
        circles.current.splice(i, 1)
        // create a new circle
        const newCircle = circleParams()
        drawCircle(newCircle)
      }
    })
    // DEMS: 4. Schedule the next frame only while the loop still runs.
    if (runningRef.current) {
      rafID.current = window.requestAnimationFrame(animateRef.current)
    }
  }

  // DEMS: 4. Upstream assigns these refs during render. A layout effect runs before every passive
  // effect of the same commit, so the effects above still see the latest callbacks.
  useLayoutEffect(() => {
    initCanvasRef.current = initCanvas
    onMouseMoveRef.current = onMouseMove
    animateRef.current = animate
    drawStaticFrameRef.current = drawStaticFrame
    runningRef.current = running
    reducedRef.current = reduced
  })

  return (
    <div
      className={cn("pointer-events-none", className)}
      ref={canvasContainerRef}
      aria-hidden="true"
      {...loop.attrs} // DEMS: 4
      {...props}
    >
      <canvas ref={canvasRef} className="size-full" />
    </div>
  )
}
