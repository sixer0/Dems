# src/features/stack-check

Up: [src/features](../README.md)

## Purpose

A stack diagnostic page. It shows the original stack proof screen (`@heroui/react` components, Magic UI BorderBeam, Motion Primitives SlidingNumber, a Motion enter transition and the live Core heartbeat) inside the signed-in shell. It was moved from `/` into the shell and kept as a diagnostic. Opening it with `?motion=slow` slows the enter transition. It stays reachable by address for every role but is linked from no operator navigation (checked by `src/test/routes.test.tsx`, JW-20).

## Files

| File | Role |
|---|---|
| [`index.tsx`](index.tsx) | `StackCheckPage`: the page header plus the `HomePage` proof view from `src/features/home`, with the motion mode read from the URL |

## Main exports

- `StackCheckPage`, root test ID `page-stack-check`.

Routes: `/stack-check` (route file `src/routes/_app/stack-check.tsx`).

## Core operations, state and shared modules

- No Core operation of its own; the heartbeat comes through the `HomePage` view of [`src/features/home`](../home) (`home-page`, `use-motion-mode`).
- Console folders used: [`src/components/shell`](../../components/shell/) (`PageHeader`), [`src/features/home`](../home).

## Tests

No `__tests__` folder. Page-level coverage in `src/test`: [`routes.test.tsx`](../../test/routes.test.tsx); the proof view itself is tested by [`home-page.test.tsx`](../../test/home-page.test.tsx).

## Related decisions

None found in decisions.md.
