# src/components/ui

Up: [src/components](../README.md)

## Purpose

Animation primitives copied in from Magic UI and Motion Primitives (both MIT licensed, copied on 2026-10-01). Each file starts with a header naming its source, the upstream SHA-256 and every local change; local changes are marked `// DEMS:` in the code and the notices are listed in `THIRD_PARTY_NOTICES.md`. Most local changes apply the console's motion policy and colour tokens. Two files are verbatim copies that may only be edited to track upstream.

## Files

| File | Role |
|---|---|
| [`__tests__/`](__tests__/) | Test of the copied-in items |
| [`animated-background.tsx`](animated-background.tsx) | `AnimatedBackground` (Motion Primitives): sliding highlight behind the active item; used by the sidebar |
| [`animated-beam.tsx`](animated-beam.tsx) | `AnimatedBeam` (Magic UI): gradient beam between two elements, bronze to gold |
| [`animated-list.tsx`](animated-list.tsx) | `AnimatedList` and `AnimatedListItem` (Magic UI): list whose new items enter with a highlight fade |
| [`animated-number.tsx`](animated-number.tsx) | `AnimatedNumber` (Motion Primitives): count-up number; a hidden page or reduced motion shows the final value |
| [`border-beam.tsx`](border-beam.tsx) | `BorderBeam` (Magic UI, verbatim): light travelling along an element's border |
| [`orbiting-circles.tsx`](orbiting-circles.tsx) | `OrbitingCircles` (Magic UI): items orbiting a centre, keyframes in Motion |
| [`particles.tsx`](particles.tsx) | `Particles` (Magic UI): canvas particle field following the pointer without React renders |
| [`ripple.tsx`](ripple.tsx) | `Ripple` (Magic UI): concentric ripple rings, keyframes in Motion |
| [`shine-border.tsx`](shine-border.tsx) | `ShineBorder` (Magic UI): shining gradient border, keyframes in Motion |
| [`sliding-number.tsx`](sliding-number.tsx) | `SlidingNumber` (Motion Primitives, verbatim except `as const` on its transition): digits that slide on change |
| [`spotlight.tsx`](spotlight.tsx) | `Spotlight` (Motion Primitives): spotlight that follows the pointer over its parent |
| [`text-effect.tsx`](text-effect.tsx) | `TextEffect` (Motion Primitives): per-word or per-character text reveal presets |
| [`text-scramble.tsx`](text-scramble.tsx) | `TextScramble` (Motion Primitives, upstream fix 182 included): scrambles text before showing it |
| [`text-shimmer.tsx`](text-shimmer.tsx) | `TextShimmer` (Motion Primitives): shimmer across text |
| [`transition-panel.tsx`](transition-panel.tsx) | `TransitionPanel` (Motion Primitives): animated switch between panels |

## Main exports

| Export | Used by |
|---|---|
| `AnimatedNumber` | dashboard, devices, evidence, login, paired-devices, session-monitor, storage, users-roles |
| `AnimatedList` | api-reference, dashboard, paired-devices, security-audit, session-monitor, storage, users-roles |
| `SlidingNumber` | [media](../media/README.md) (REC indicator), [shell](../shell/README.md) (top bar), api-reference, home, login, network-time, paired-devices |
| `TextEffect` | [composed](../composed/README.md) (glow ring), shell (page header), dashboard, login |
| `TextScramble` | dashboard, evidence, paired-devices, security-audit, session-monitor |
| `BorderBeam` | shell (SECURE pill), home, login |
| `Spotlight` | dashboard, system |
| `TransitionPanel` | evidence, session-new |
| `AnimatedBackground` | shell (sidebar) |
| `AnimatedBeam`, `OrbitingCircles` | network-time |
| `Ripple`, `ShineBorder` | dashboard |
| `Particles` | login |
| `TextShimmer` | session-monitor |

Feature folders are under [src/features](../../features/).

## Core operations, state and shared modules

- No Core operation and no simulator state is read here.
- Shared package module: `@dems/shared/tokens` (`text-effect.tsx`).
- Console modules: [src/motion](../../motion/) (motion policy, reduced motion), `src/lib/utils`.

## Tests

- [`__tests__/`](__tests__/): `copy-in-items.test.tsx` (animated beam, list, number, orbiting circles, particles, ripple, shine border, spotlight, text scramble, text shimmer).
- No page-level test in [src/test](../../test/) imports this folder directly.

## Related decisions

- D40 (row 109): the `AnimatedNumber` count-up ran on animation frames only, so a hidden page stayed at 0.0; fixed in `animated-number.tsx` (hidden page shows the final value, as with reduced motion).
