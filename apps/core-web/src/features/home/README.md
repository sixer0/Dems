# src/features/home

Up: [src/features](../README.md)

## Purpose

The stack proof view: `@heroui/react` (HeroUI v3) components, Magic UI BorderBeam, Motion Primitives SlidingNumber, a Motion spring enter transition and a live heartbeat indicator bound to the Core health reader. It no longer has a route of its own: `/` redirects to `/dashboard` (`src/routes/_app/index.tsx`), and the view is shown by the `/stack-check` page of [`src/features/stack-check`](../stack-check/).

## Files

| File | Role |
|---|---|
| [`home-page.tsx`](home-page.tsx) | `HomePage`: the proof view (kit components, BorderBeam, SlidingNumber, enter transition, heartbeat indicator) |
| [`motion-variants.ts`](motion-variants.ts) | `MotionMode`, `enterVariants`, `enterTransition`: the enter animation, with `slow` as the proof mode (`?motion=slow`) |
| [`use-motion-mode.ts`](use-motion-mode.ts) | `useMotionMode`: `'slow'` when the page was opened with `?motion=slow`, otherwise `'normal'` (read once) |

## Main exports

- `HomePage`, `HomePageProps` (`home-page.tsx`).
- `useMotionMode` (`use-motion-mode.ts`), `enterVariants`, `enterTransition` (`motion-variants.ts`).

Routes: none of its own. Imported by `src/features/stack-check/index.tsx` (`/stack-check`).

## Core operations, state and shared modules

- The heartbeat reads the console's health query from [`src/lib`](../../lib/) (`health-query`); no simulator slice is read here.
- Shared modules: `@dems/shared/domain`, `@dems/shared/realtime`, `@dems/shared/tokens`.
- Console folders used: [`src/components/ui`](../../components/ui/) (`border-beam`, `sliding-number`), [`src/lib`](../../lib/) (`health-query`, `tone-icons`), [`src/motion`](../../motion/).

## Tests

No `__tests__` folder. Page-level test: [`src/test/home-page.test.tsx`](../../test/home-page.test.tsx).

## Related decisions

None found in decisions.md (the "Home" entries there concern the tablet app's Home screen, not this folder).
