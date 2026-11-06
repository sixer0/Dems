import { extendTailwindMerge, type ClassNameValue } from 'tailwind-merge';
import { TYPOGRAPHY_FONT_SIZE_CLASSES } from '@dems/shared/tokens';

/**
 * tailwind-merge that knows the design typography tokens (`text-display`, `text-h1` … `text-data`)
 * are font sizes (D41(d), row-17 finding S17-1). Without this it classifies them as colours and
 * drops them next to `text-accent`. Mirrors core-web `src/lib/utils.ts`.
 *
 * It fixes merging in app code only: HeroUI Native kit parts merge their own `className` through
 * tailwind-variants, which still drops these sizes. On a kit part keep the size token on an inner
 * plain `Text` and the colour on the kit part (the row-18 pattern).
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: [...TYPOGRAPHY_FONT_SIZE_CLASSES] }],
    },
  },
});

/** Joins class lists (falsy values skipped) and resolves Tailwind conflicts, last one wins. */
export function cn(...inputs: ClassNameValue[]): string {
  return twMerge(...inputs);
}
