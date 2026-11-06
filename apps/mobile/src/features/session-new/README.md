# `apps/mobile/src/features/session-new`

Up: [`src/features/`](../README.md)

## Purpose

Start New Session at `/session/new?step=1|2|3`: step 1 session information (case, subject, investigator) with the live readiness list, step 2 devices check (camera previews, microphone meters, pre-check), step 3 ready with the countdown. `use-start-entry-guard.ts` applies the role gate to every start entry, including deep links.

## Contents

| Entry | Role |
|---|---|
| [`testing/`](testing/) | Test beds, fakes and fixtures for the tests (no production code). |
| `check-icon.tsx` | Prefix icon of a §5.3 check row. Lucide icons coloured by the check's tone. |
| `configured-profile.ts` | The profile a new session records with (fix wave Q, CT-08; D228 (3), as the web console). |
| `countdown-sources.test.tsx` | Test: Tests "Session New (mobile): knowledge of the capture sources lost during the 3-2-1 countdown". |
| `device-previews.tsx` | Step 2 previews (04 §4.4 "CameraFeed and C-2 above the list (compact) or beside it (tablet), with the hint 'Speak to test (simulated)'") and the tablet-landscape live device column (the brief's "form + live device ... |
| `devices-check-step.tsx` | Step 2 of Start Session: devices check and pre-check. |
| `flow-guard.tsx` | Leaving Start Session (04_mobile_specs §3.6; §4.4 "Cancel after data entry → Dialog → cancel()"). |
| `i18n.ts` | English copy of the `session-new` feature, mounted at `features.session-new.*` through `src/i18n/features.ts`. |
| `idle-control-state.test.tsx` | Test: On the tablet and the phone the Session New "Next" kept announcing "busy" after its action had ended (after "Not now" on the local-source notice). |
| `live-readiness.test.tsx` | Test: The step-1 live readiness list reads the shared live reader `evaluateLiveReadiness`. |
| `live-readiness.tsx` | The step-1 live readiness list of Start Session (the tablet-landscape device column), audit row 182. Every check of `PRECHECK_ORDER`, with its live state from the shared live reader `evaluateLiveReadiness` ... |
| `live-session-new-handoff.test.tsx` | Test: Start Session in LIVE mode — the start-recording hand-off and the pending state of a control, on the app's real Live source over the contract-checked fake transport (see ... |
| `live-session-new-replica.test.tsx` | Test: Start Session in LIVE mode — what the screen reads from the replica and from the Core link, on the app's real Live source over the contract-checked fake transport: S4-6 the case-number ... |
| `live-session-new-sites.test.tsx` | Test: Start Session in LIVE mode — settle sites S1-4 (create, then pre-check) and S2-2 (acknowledge, retry, cancel; the start is in `live-session-new-handoff.test.tsx`), each with its success, ... |
| `live-start-handoff-in-place.test.tsx` | Test: Tests "RF-PH-3: the start hand-off draws the monitor in place". |
| `precheck-mic-roles.test.ts` | Test: Session New pre-check: the selector mapping of the microphone checks and the channel-keyed check ids. Pure model. The rendered value line of a check row is unchanged (`precheck.test.tsx` holds it); the channel line ... |
| `precheck.test.tsx` | Test: The Start Session Devices Check, the book's §5.3 pre-recording gate, on the real simulator with fake time (the simulator's manual clock drives the seeded 300–700 ms per check; jest's fake timers hold every UI ... |
| `ready-step.tsx` | Step 3 of Start Session: ready, with the countdown overlay. |
| `session-info-step.tsx` | Step 1 of Start Session: session information form. |
| `session-new-header.tsx` | Start Session header (04_mobile_specs §4.4; MB 3 (650–885, 45–75)) |
| `session-new-model.test.ts` | Test: Start Session rules: the step the screen shows, the §5.3 gate phases, Next enablement, stepper statuses, the form defaults and SIM-GAP-1's next case number. Pure functions over plain values and a real test simulator. |
| `session-new-model.ts` | Start New Session: the pure rules of the three-step flow. No React, no simulator instance: every function takes plain values, so the precheck test (T-M10) and the screen share one set of rules. |
| `session-new-screen.test.tsx` | Test: Start New Session: the MB 3 form with the shared zod schema, the create → precheck hand-over, the ARMED summary, the Start Recording hand-off to the monitor route (with and without 3-2-1), the §3.6 guards and the ... |
| `session-new-screen.tsx` | Start New Session at `/session/new?step=1\|2\|3`; step 78. Owner: step 78 (P6). |
| `sim-adapter.ts` | Local simulator adapter of Start Session: the next case number. |
| `start-entry-checking.tsx` | The Start Session entry while the operator's role is not yet known: Live mode before the first snapshot. The wizard is not shown on an unknown role; this screen says why and waits. As soon as the role is known the ... |
| `step-boundary.tsx` | Error boundary around each Start Session region. A render crash in one region never blanks the flow or touches the session: 1. |
| `use-pending-press.ts` | Re-export of the runtime's `usePendingPress`. |
| `use-session-new.ts` | Hooks of the Start Session flow. Every function that calls a hook is named `use*`. |
| `use-sheet-presence.tsx` | Mount-on-demand for kit sheets (copy of the session monitor's pattern, P6). |
| `use-start-entry-guard.ts` | R2 for every start entry: the Home and Sessions buttons are locked without `SESSION_START`, and this guard covers the entries that are not buttons (a deep link, a pending href, a resync to a setup session left behind) |

## Main exports

- Screens: `SessionNewScreen` (`session-new-screen.tsx`).
- Hooks: `useConfiguredProfile`, `useFlowBackPrompt`, `usePendingPress`, `useSessionNewData`, `useLiveReadiness`, `useSessionForm`, `useFlowActions`, `useSheetPresence`, `useStartEntryGuard`.
- Components: `CheckIcon`, `DevicePreviews`, `LiveDeviceColumn`, `DevicesCheckStep`, `DiscardDialog`, `LiveReadinessChecks`, `ReadyStep`, `CountdownOverlay`, `SessionInfoStep`, `SessionNewHeader`, `StartEntryChecking`, `SheetContentSignal`.

## Core operations and state

- Replica state read through `useSim` selectors (`@dems/shared/sim` or local): `selectLiveReadiness`, `selectNewestHistory`, `selectNextCaseNumber`, `selectOperators`, `selectPrecheck`, `selectReadiness`, `selectSessionId`, `selectSessionInput`.
- Core actions sent (`useCoreActions()` and `settle` of `@dems/shared/live`, or a local actions hook): `acknowledgePrecheckWarnings`, `acknowledgeWarnings`, `beginPrecheck`, `cancel`, `cancelSession`, `createAndCheck`, `createSession`, `resetClip`, `retryChecks`, `retryPrecheck`, `startRecording`.

Core origin: this folder never builds a Core URL. Every call goes through the runtime, whose Live client, socket and media transport are built in `src/runtime/sim-adapters.ts` from `coreOriginOf(getCoreAddress())` of `src/runtime/core-address.ts` (D263, D265).

## Tests

11 test files sit beside the code in this folder (`*.test.ts`, `*.test.tsx`, jest with the `jest-expo` preset; setup in `apps/mobile/jest.setup.ts`).
Shared test beds and fixtures of this folder are in [`testing/`](testing/) (no production code).
Run: `npm test -w @dems/mobile` (all) or `npx jest <path>` inside `apps/mobile`.

## Related decisions

From `decisions.md` of the 2026-11-05 team update audit:

- D167: row 181: `check-icon.tsx` covers all pre-check ids.
- D172: row 183: step-2 previews from the capture pairs.
- D193: row 182: live readiness (needs-review).
- D197: row 182: live readiness mounted in `device-previews.tsx`.
- D206: row 184: pre-check timing test.
- D219: row 196: `device-previews.tsx` live preview site.
- D256: row 235: pre-check microphone lines.
