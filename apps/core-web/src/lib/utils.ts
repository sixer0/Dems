import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'
import { TYPOGRAPHY_FONT_SIZE_CLASSES } from '@dems/shared/tokens'

/**
 * tailwind-merge that knows the design typography tokens (`text-display`, `text-h1`, …) are
 * font sizes. Without this it treats them as colours and drops them next to `text-accent`.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: [...TYPOGRAPHY_FONT_SIZE_CLASSES] }],
    },
  },
})

/** The standard registry utility expected at `@/lib/utils` (Magic UI, Motion Primitives; V26). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
