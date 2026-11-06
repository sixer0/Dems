# `apps/mobile/src/features/sessions`

Up: [`src/features/`](../README.md)

## Purpose

The Sessions hub at `/sessions` and the session detail at `/sessions/[sessionId]` (a pane on tablets): the active-session card, the session list with filters and search, status chips, the notice for a session set up by another operator, and the toast when a session runs from another console.

## Contents

| Entry | Role |
|---|---|
| [`testing/`](testing/) | Test beds, fakes and fixtures for the tests (no production code). |
| `foreign-session-notice.test.tsx` | Test: Tests "foreignSessionOf: the rule". |
| `foreign-session-notice.tsx` | Notice "This session was set up by another operator". |
| `foreign-session-toasts.tsx` | The toast of a session run from another console. The runtime's route sync emits what it did not follow (`foreign-session-signal`); this says it, once per session and phase. Mounted beside the alert toasts in the ... |
| `hub-pane-row-fit.test.tsx` | Test: Tests "R-T-4: every value of a Sessions row fits on one line in a list pane". |
| `hub-pane-split.test.tsx` | Test: Tests "RF-T-2: the Sessions hub list and detail panes both stay usable". |
| `hub-top.tsx` | Top of the Sessions hub: the active-session `SectionCard` (MB 2's active-session card language: REC dot, recording timer, case and subject, "Return to monitor") and the primary "Start New Session" button. - The card ... |
| `i18n.ts` | English copy of the `sessions` feature, mounted at `features.sessions.*` through `src/i18n/features.ts`. |
| `interrupted-seal-hub.test.tsx` | Test: Tests "interrupted seal hub". |
| `live-d19b-stop-duration.test.tsx` | Test: Revision row RV-CODE, audit AU-1 finding AU1-2, ruling D19(b). |
| `live-sessions.test.tsx` | Test: The Sessions hub in LIVE mode, on the app's real Live source over the contract-checked fake transport [CS:§7.3 "features/sessions", S4-5]. |
| `rec-dot.tsx` | The REC dot of the hub's active-session card: opacity 1 → 0.35 → 1 and scale 1 → 0.9 → 1 over the `recPulse` period (1,200 ms, 0.83 Hz, under the P8 flash limit), with a halo ring that scales 1 → 2.2 while fading out ... |
| `row-no-preview.test.tsx` | Test: Tests "the Sessions hub row on a Core in real capture: no stock picture". |
| `session-detail-screen.tsx` | Session detail at `/sessions/[sessionId]`. |
| `session-detail-subject-chip.test.tsx` | Test: Tests "W93-8: the subject name wraps between words, never inside one". |
| `session-detail.tsx` | Session detail body, shared by the phone route `/sessions/[sessionId]` (`variant="screen"`) and the tablet detail pane (`variant="pane"`). |
| `session-row-deselect-drawn.test.tsx` | Test: The session row that loses ... |
| `session-row.tsx` | One Sessions hub row: poster thumbnail, session ID (mono), date and time, subject with its `SubjectTypeChip`, duration (mono), the state `StatusChip` and a chevron. A sealed session whose summary is still ... |
| `session-start-hub.test.tsx` | Test: Tests "session start on the Sessions hub (pass D7 item 3)". |
| `session-status-chip.tsx` | Sessions hub status chip: RECORDING danger with a filled dot, SEALED violet with a lock, INCOMPLETE amber, FAULT danger, FINALIZING info. The word is the shared `common.enums.sessionState.<status>` label. Kit recipe ... |
| `sessions-model.test.ts` | Test: Sessions hub view model: rows from the simulator's `sessionHistory` (including the INCOMPLETE session) plus the current session, filters, search, chip recipes and the hand-off table. Pure functions against the real ... |
| `sessions-model.ts` | Sessions hub view model. Pure TypeScript: no React, no hooks, so every rule is unit-tested directly. - Rows: the simulator's `sessionHistory` plus the current session while it is RECORDING, finalizing (STOPPING, ... |
| `sessions-screen.test.tsx` | Test: Sessions hub: the list of `sessionHistory` including the INCOMPLETE session, the filters and search, the active-session card while recording, the row hand-offs (monitor, summary, evidence, detail), the tablet panes ... |
| `sessions-screen.tsx` | Sessions hub at `/sessions`. |
| `use-hand-off.ts` | Row and button hand-offs of the Sessions hub. `useOpenSession()` returns one function: on a multi-pane window a `detail` hand-off selects the row into the detail pane; every other hand-off pushes its route (the ... |
| `use-sessions-data.ts` | Simulator reads for the Sessions hub. `useSim` compares results shallowly and the engine publishes a new state every 100 ms clock tick, so each selector returns a primitive, a state-held object (kept by reference ... |

## Main exports

- Screens: `SessionDetailScreen` (`session-detail-screen.tsx`), `SessionsScreen` (`sessions-screen.tsx`).
- Hooks: `useSafePush`, `useOpenSession`, `useSessionHistory`, `usePendingSummaryId`, `useCurrentSessionState`, `useActiveSessionFields`, `useSimDayStart`, `useSessionRows`, `useHubRows`, `useSessionRow`, `useLiveElapsedSeconds`, `useOperatorName`.
- Components: `ForeignSessionNotice`, `ForeignSessionToasts`, `HubTop`, `RecDot`, `SessionDetail`, `SessionStatusChip`.

## Core operations and state

- Replica state read through `useSim` selectors (`@dems/shared/sim` or local): `selectOperator`, `selectOperatorById`, `selectPendingSummaryId`, `selectSessionHistory`, `selectSessionHistoryById`.

Core origin: this folder never builds a Core URL. Every call goes through the runtime, whose Live client, socket and media transport are built in `src/runtime/sim-adapters.ts` from `coreOriginOf(getCoreAddress())` of `src/runtime/core-address.ts` (D263, D265).

## Tests

12 test files sit beside the code in this folder (`*.test.ts`, `*.test.tsx`, jest with the `jest-expo` preset; setup in `apps/mobile/jest.setup.ts`).
Shared test beds and fixtures of this folder are in [`testing/`](testing/) (no production code).
Run: `npm test -w @dems/mobile` (all) or `npx jest <path>` inside `apps/mobile`.

## Related decisions

No entry of `decisions.md` (2026-11-05 team update audit) names this folder or its files.
