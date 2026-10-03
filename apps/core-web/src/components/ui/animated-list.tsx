/*
 * AnimatedList and AnimatedListItem from Magic UI (MIT License, Copyright (c) Magic UI).
 * Copied in from https://magicui.design/r/animated-list.json on 2026-10-01 (identical to
 * apps/www/registry/magicui/animated-list.tsx in magicuidesign/magicui). Upstream SHA-256
 * 9363c5afa61d7aab1919b4500f7325cc8871b35103d5dd60a2a1625fe5e7dc58; see THIRD_PARTY_NOTICES.md.
 *
 * Local changes (step 37; each marked `// DEMS:` below):
 *   1. AnimatedListItem variants edited per 03_motion_spec M-C-07:
 *      - the vendor enters from `scale: 0`, too springy for P4; rows now enter from
 *        `{ opacity: 0, y: -rise (12), scale: enterFrom (0.98) }`;
 *      - the vendor spring `{ stiffness: 350, damping: 40 }` is kept (ζ ≈ 1.07), and so is
 *        `layout`;
 *      - the exit is opacity only, `fast` (160 ms) with the `exit` easing, replacing the vendor
 *        scale to 0.
 *   2. AnimatedListItem `highlight` prop (M-C-07): a gold layer on the newest row fades from 0.18
 *      to 0 over 1,500 ms, using opacity only.
 *   3. Motion policy (§8, §12):
 *      - under reduced motion rows appear and leave instantly, with no layout animation, and
 *        keep only the highlight;
 *      - AnimatedList shows every child at once instead of revealing them one by one;
 *      - proof mode turns the vendor spring into the policy's slowed tween and scales the
 *        reveal delay.
 */
"use client"

import React, {
  useEffect,
  useMemo,
  useState,
  type ComponentPropsWithoutRef,
} from "react"
import { AnimatePresence, motion, type MotionProps } from "motion/react"
import { motion as motionTokens } from "@dems/shared/tokens" // DEMS: 1

import { cn } from "@/lib/utils"
import { useMotionPolicy } from "@/motion" // DEMS: 3

// DEMS: 1. Vendor spring, kept on purpose (M-C-07).
const VENDOR_SPRING = { type: "spring", stiffness: 350, damping: 40 } as const
// DEMS: 2. Spec literals (M-C-07; D49 keeps untokenised timings as documented literals).
export const HIGHLIGHT_FADE_MS = 1500
export const HIGHLIGHT_FROM_OPACITY = 0.18

export function AnimatedListItem({
  children,
  highlight = false,
}: {
  children: React.ReactNode
  /** DEMS: 2. Marks the newest row: a gold layer fades 0.18 → 0 over 1,500 ms. */
  highlight?: boolean
}) {
  const m = useMotionPolicy() // DEMS: 3
  // DEMS: 1, 3
  const animations: MotionProps = m.reduced
    ? {
        initial: false,
        animate: { opacity: 1, y: 0, scale: 1 },
        exit: { opacity: 0, transition: { duration: 0 } },
        transition: { duration: 0 },
      }
    : {
        initial: {
          opacity: 0,
          y: -motionTokens.distance.rise,
          scale: motionTokens.scale.enterFrom,
        },
        animate: { opacity: 1, y: 0, scale: 1, originY: 0 },
        exit: { opacity: 0, transition: m.transitions.exit },
        transition: m.timeScale === 1 ? VENDOR_SPRING : m.transitions.enter,
      }

  return (
    <motion.div
      {...animations}
      layout={!m.reduced} // DEMS: 3
      className={cn("mx-auto w-full", highlight && "relative")}
    >
      {children}
      {/* DEMS: 2 */}
      {highlight && (
        <motion.div
          aria-hidden="true"
          className="bg-accent pointer-events-none absolute inset-0 rounded-[inherit]"
          initial={{ opacity: HIGHLIGHT_FROM_OPACITY }}
          animate={{ opacity: 0 }}
          transition={{ duration: m.seconds(HIGHLIGHT_FADE_MS), ease: "linear" }}
        />
      )}
    </motion.div>
  )
}

export interface AnimatedListProps extends ComponentPropsWithoutRef<"div"> {
  children: React.ReactNode
  delay?: number
}

export const AnimatedList = React.memo(
  ({ children, className, delay = 1000, ...props }: AnimatedListProps) => {
    const [index, setIndex] = useState(0)
    const childrenArray = useMemo(
      () => React.Children.toArray(children),
      [children]
    )
    // DEMS: 3
    const m = useMotionPolicy()
    const revealAll = m.reduced
    const stepMs = delay * m.timeScale

    useEffect(() => {
      if (revealAll) return undefined // DEMS: 3
      let timeout: ReturnType<typeof setTimeout> | null = null

      if (index < childrenArray.length - 1) {
        timeout = setTimeout(() => {
          setIndex((prevIndex) => (prevIndex + 1) % childrenArray.length)
        }, stepMs)
      }

      return () => {
        if (timeout !== null) {
          clearTimeout(timeout)
        }
      }
    }, [index, stepMs, childrenArray.length, revealAll])

    const shownIndex = revealAll ? childrenArray.length - 1 : index // DEMS: 3

    const itemsToShow = useMemo(() => {
      const result = childrenArray.slice(0, shownIndex + 1).reverse()
      return result
    }, [shownIndex, childrenArray])

    return (
      <div
        className={cn(`flex flex-col items-center gap-4`, className)}
        {...props}
      >
        <AnimatePresence>
          {itemsToShow.map((item) => (
            <AnimatedListItem key={(item as React.ReactElement).key}>
              {item}
            </AnimatedListItem>
          ))}
        </AnimatePresence>
      </div>
    )
  }
)

AnimatedList.displayName = "AnimatedList"
