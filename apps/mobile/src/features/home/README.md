# `apps/mobile/src/features/home`

Up: [`src/features/`](../README.md)

## Purpose

The stack-proof screen used by `/stack-check` (and `/` with `?motion=`): HeroUI Native components, a Reanimated enter transition, the Skia heartbeat pulse ring, the live heartbeat and the service health of the Core. In Live mode `use-health.ts` reads operation 1 `getServiceHealth` through the Live client; in the other modes it probes the local mock-core.

## Contents

| Entry | Role |
|---|---|
| `home-screen.test.tsx` | Test: Tests "HomeScreen". |
| `home-screen.tsx` | Mobile stack-proof screen `HomeScreen`: HeroUI Native components, Reanimated enter transition, Skia pulse ring and the live heartbeat; the proof card names the real data source. |
| `pulse-ring.tsx` | Skia heartbeat ring. The radius is a Reanimated derived value (a worklet), so the pulse animates entirely on the UI thread. |
| `stack-proof-source.test.tsx` | Test: Tests "Stack Check names the data source the app really uses (E2E-P-2)". |
| `use-health.ts` | Service health of the Core the app talks to (Stack Check, `/stack-check`). |

## Main exports

- Screens: `HomeScreen` (`home-screen.tsx`).
- Hooks: `useHealth`.
- Components: `PulseRing`.

## Core operations and state

- Operations called directly on the Live client (`useMobileLive()?.client.call`): `getServiceHealth` (`use-health.ts`).

Core origin: this folder never builds a Core URL. Every call goes through the runtime, whose Live client, socket and media transport are built in `src/runtime/sim-adapters.ts` from `coreOriginOf(getCoreAddress())` of `src/runtime/core-address.ts` (D263, D265).

## Tests

2 test files sit beside the code in this folder (`*.test.ts`, `*.test.tsx`, jest with the `jest-expo` preset; setup in `apps/mobile/jest.setup.ts`).
Run: `npm test -w @dems/mobile` (all) or `npx jest <path>` inside `apps/mobile`.

## Related decisions

No entry of `decisions.md` (2026-11-05 team update audit) names this folder or its files.
