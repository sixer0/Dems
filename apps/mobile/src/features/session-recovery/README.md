# `apps/mobile/src/features/session-recovery`

Up: [`src/features/`](../README.md)

## Purpose

Recovery Status at `/session/recovery`: the recovery analysis pipeline over the five checks, the per-track rows, the outcome, and the hand-over to Finalizing. Actions come from `useCoreActions()`; a region error boundary keeps a render crash from blanking the screen.

## Contents

| Entry | Role |
|---|---|
| [`testing/`](testing/) | Test beds, fakes and fixtures for the tests (no production code). |
| `failed-start.test.tsx` | Test: Tests "a failed start on /session/recovery (pass D7 item 1)". |
| `i18n.ts` | English copy of the `session-recovery` feature, mounted at `features.session-recovery.*` through `src/i18n/features.ts`. |
| `live-recovery-restart.test.tsx` | Test: The row's Live test of recovery after a server-side fault. On the app's real Live source over the contract-checked fake transport, the Core server stops and starts again with a NEW epoch ... |
| `live-recovery-sites.test.tsx` | Test: Recovery Status in LIVE mode — settle sites S2-3 (Start recovery, operation 33), S4-8 (Acknowledge: one acknowledgeAlert per matching alert, operation 70) and S5-2 (the role hint; the Core ... |
| `recovery-analysis.tsx` | The recovery analysis: the C-4 Stepper `pipeline` over the five checks of the book's §18.1 RECOVERY_SCAN → INCOMPLETE_SESSION_ANALYSIS, and the per-track integrity rows (VIDEO-01/02, AUDIO-01/02). |
| `recovery-boundary.tsx` | Error boundary around each region of the Recovery Status screen. A render crash in one region never blanks the screen and never touches the session or the evidence: 1. |
| `recovery-finalizing-handover.test.tsx` | Test: Tests "MB-06: Recovery hands over to Finalizing in place (pass D7 item 2)". |
| `recovery-live-static.test.ts` | Test: Tests "Recovery takes the Core through the light Live API (CLG c, AC-C-53)". |
| `recovery.model.test.ts` | Test: Recovery Status maths and the local simulator adapter. |
| `recovery.model.ts` | Recovery Status maths. Pure: no React, no simulator instance. `use-recovery.ts` reads the simulator into the flat `RecoveryInputs`, `sim-adapter.ts` bridges what the simulator does not model (SIM-GAP-M81-*), and the ... |
| `session-recovery-screen.test.tsx` | Test: Recovery Status. Renders the real `/session/recovery` route on the real providers with a test simulator: fault-demo (Camera 2 lost, MIC 2 clipping, GNSS → NTP) plus POWER_FAIL puts the session in FAULT, then the ... |
| `session-recovery-screen.tsx` | Recovery Status at `/session/recovery`; step 81. Replaces step 70's stub; the export name and the `SafeScreen id="session-recovery"` root stay. The runtime's route sync opens this screen when a critical fault ... |
| `sim-adapter.ts` | Local simulator adapter of Recovery Status: permission check and the start of a recovery. |
| `use-recovery.ts` | Recovery Status data. Every selector returns primitives (or `null`), so `useSim`'s shallow compare keeps the screen quiet while the simulator ticks audio at 20 Hz: it re-renders when the state, a finding or a ... |

## Main exports

- Screens: `SessionRecoveryScreen` (`session-recovery-screen.tsx`).
- Hooks: `useRecoveryStepperWords`, `useStepDetails`, `useFollowedRecovery`, `useRecoveryMilestone`, `useRecoveryOutcome`, `useRecoveryRole`, `useAckSettled`, `useSimNow`, `useRecoveryActions`.
- Components: `RecoveryPipeline`, `TrackRows`.

## Core operations and state

- Replica state read through `useSim` selectors (`@dems/shared/sim` or local): `selectRecoveryInputs`, `selectRole`.
- Core actions sent (`useCoreActions()` and `settle` of `@dems/shared/live`, or a local actions hook): `acknowledgeAlert`, `acknowledgeAlerts`, `canOpenEvidence`, `recover`.

Core origin: this folder never builds a Core URL. Every call goes through the runtime, whose Live client, socket and media transport are built in `src/runtime/sim-adapters.ts` from `coreOriginOf(getCoreAddress())` of `src/runtime/core-address.ts` (D263, D265).

## Tests

7 test files sit beside the code in this folder (`*.test.ts`, `*.test.tsx`, jest with the `jest-expo` preset; setup in `apps/mobile/jest.setup.ts`).
Shared test beds and fixtures of this folder are in [`testing/`](testing/) (no production code).
Run: `npm test -w @dems/mobile` (all) or `npx jest <path>` inside `apps/mobile`.

## Related decisions

No entry of `decisions.md` (2026-11-05 team update audit) names this folder or its files.
