# `apps/mobile/src/features/session-finalizing`

Up: [`src/features/`](../README.md)

## Purpose

Finalizing at `/session/finalizing`: the six-step finalization pipeline after a recording stops, forward-only sealing progress, the SEALED stamp, and the notices for a seal that needs attention, an interrupted seal, an unsealable recording and an open (not sealed) recording. `handover.ts` lets the monitor hand over to this screen without an empty frame.

## Contents

| Entry | Role |
|---|---|
| [`testing/`](testing/) | Test beds, fakes and fixtures for the tests (no production code). |
| `b9-still-indicator.test.tsx` | Test: The logcat criterion "0 lines of `Unable to find SurfaceMountingManager for tag`" from the stop to the Summary FAILED on every hand-over: 70 lines on the tablet (6 tags), ... |
| `finalization-pipeline.tsx` | The finalization pipeline: C-4 Stepper, vertical `pipeline` variant, over the six `FinalizationStep` labels of the shared i18n. A running step shows the kit Spinner, a finished one draws its check (300 ms) and fills ... |
| `finalizing-forward-only.test.tsx` | Test: Blueprint row 87. |
| `finalizing.model.test.ts` | Test: Tests "finalizingPhase / isFinalizingBusy". |
| `finalizing.model.ts` | Finalization maths. Pure: no React, no simulator instance. The screens read the simulator through `use-finalizing.ts` and turn it into these values; the tests check them directly. |
| `flow-boundary.tsx` | Error boundary around each region of the Finalization and Session Summary screens. A render crash in one region never blanks the screen and never touches the session or the evidence: 1. |
| `handover.ts` | The monitor-to-Finalizing hand-over. When a recording stops (here or on another console), `/session/live` used to render only a `<Redirect>` to `/session/finalizing` |
| `i18n.ts` | English copy of the `session-finalizing` feature, mounted at `features.session-finalizing.*` through `src/i18n/features.ts`. |
| `interrupted-seal.tsx` | THE INTERRUPTED SEAL OF A SESSION on the tablet and the phone. A recording that a fault ended and the Core sealed is named on every session surface - Finalizing, the Session Summary, the Sessions hub - with "Sealed — ... |
| `live-finalizing.test.tsx` | Test: Finalization in LIVE mode. The row changes no production file of this folder [CS:§7.3, §17.4 Row 21 #3]; these tests prove the unchanged screen tells the truth on the app's real Live ... |
| `open-notice.ts` | THE OPEN NOTICE of a recording that could not be sealed, on Home and its header (fix wave L, G75d-01; ruling D228 (2); contract `delegation_progress/contract_wave_l.md` section 1). |
| `seal-attention.tsx` | A SEAL THAT NEEDS ATTENTION, on the tablet and the phone (fix wave I, driver C; re-gate 75 finding G75b-02; rulings D186 (1), D216; contract note `delegation_progress/contract_wave_i.md`). |
| `sealed-stamp.tsx` | The SEALED stamp. The violet `StatusChip` SEALED badge with `BadgeCheck` |
| `sealing-progress.test.ts` | Test: Blueprint row 87: sealing progress on the tablet and the phone is forward-only and comes from the Core's states alone. The rule itself (pure); the screen is `finalizing-forward-only.test.tsx`. |
| `sealing-progress.ts` | Sealing progress, forward-only. The web console holds its own copy of the same rule (`apps/core-web/src/features/session-monitor/sealing-progress.ts`). |
| `session-finalizing-screen.test.tsx` | Test: Finalization screen. Renders the real `/session/finalizing` route on the real providers with a test simulator in the finalizing scenario. Import order matters: the gorhom mock, then the router harness, then the flow ... |
| `session-finalizing-screen.tsx` | Finalization at `/session/finalizing`; step 80. Replaces step 70's stub; the export name and the `SafeScreen id="session-finalizing"` root stay. After End Session the simulator runs STOPPING (1.5 s) and then the six ... |
| `unsealable-notice.test.tsx` | Test: Fix pass F-M7b (review row 88, R88-02 (c); rulings D178 (2), D183) |
| `unsealable-notice.tsx` | THE UNSEALABLE STATE OF A RECORDING (task 3 fix pass F-M7b; review R88-02 (c); rulings D178 (2), D183). |
| `use-finalizing.ts` | Finalization data. Selectors return primitives or the store's own slice references, so `useSim`'s shallow compare keeps the screen quiet while the simulator ticks audio at 20 Hz: it re-renders when a step resolves or ... |

## Main exports

- Screens: `SessionFinalizingScreen` (`session-finalizing-screen.tsx`).
- Hooks: `useFinalizingStepperWords`, `useInterruptedSeal`, `useOpenNotices`, `useCanCloseNotice`, `useSealAttention`, `useSealBlocked`, `useSealBlockedOf`, `useSealingProgress`, `useFinalizingSession`, `useFinalizationSteps`, `useSealedHandOffDue`.
- Components: `FinalizationPipeline`, `InterruptedSealNotice`, `SealAttentionNotice`, `SealRetryControl`, `SealedStamp`, `UnsealableNotice`.

## Core operations and state

- Replica state read through `useSim` selectors (`@dems/shared/sim` or local): `selectOperator`, `selectRole`.
- Core actions sent (`useCoreActions()` and `settle` of `@dems/shared/live`, or a local actions hook): `recover`.

Core origin: this folder never builds a Core URL. Every call goes through the runtime, whose Live client, socket and media transport are built in `src/runtime/sim-adapters.ts` from `coreOriginOf(getCoreAddress())` of `src/runtime/core-address.ts` (D263, D265).

## Tests

7 test files sit beside the code in this folder (`*.test.ts`, `*.test.tsx`, jest with the `jest-expo` preset; setup in `apps/mobile/jest.setup.ts`).
Shared test beds and fixtures of this folder are in [`testing/`](testing/) (no production code).
Run: `npm test -w @dems/mobile` (all) or `npx jest <path>` inside `apps/mobile`.

## Related decisions

No entry of `decisions.md` (2026-11-05 team update audit) names this folder or its files.
