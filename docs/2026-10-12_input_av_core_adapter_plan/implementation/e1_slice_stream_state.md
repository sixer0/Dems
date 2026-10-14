# Row E1 (wave 12, track D) - the camera's stream state the Core publishes

Status: **needs-review**. No product file was written. Date 2026-10-14, head 1fbeada7 plus the wave's uncommitted work.

## 1. What was asked

Finding E-01 (review 60e) and Q-01 / Q-05 (review 60d): the Core states `streamState: LIVE` for every enabled camera, also for one with an active fault. The row was to change `apps/core-server/src/modules/capture-config/slices.ts` so that the slice states the real state, rebuilt when a fault is raised or cleared.

## 2. What was found: the owned file is not what a client reads

| Claim | Source |
|---|---|
| The two builders of `slices.ts` are called from one place, `store.load` | `modules/capture-config/store.ts:202-203` |
| `store.load` runs once, in the boot step; nothing calls it again | `modules/capture-config/boot.ts:50`; `index.ts` boot step |
| The loaded snapshot has one non-test reader: the boot log line (device count, revision, locked) | `boot.ts:51-56`; `grep captureConfigControl(` - every `.snapshot()` caller is a test |
| The module says so itself | `index.ts:120`: "The reads of operations 76 and 77 answer from the engine's committed state, not from here." |
| Operation 76 answers from the engine's state | `routes.ts:243` (`state.captureConfig`) |
| The engine's slices are built from the rows at rehydration by the row mapping, which mirrors slices.ts without importing it | `db/mapping/rows.ts:898` (registry entry), `:961` (selector line), comment `:923-926` |
| After that they change only through engine transitions; the stream state through telemetry alone | `packages/shared/src/sim/capture-telemetry.ts:109-113, 122-140` |
| Raising or clearing a capture fault changes the fault list and the alert, no device line | `capture-telemetry.ts:215-218, 251-255` |

So an edit of `slices.ts` would change a boot-time copy and its log line. No client, no state stream, no operation would read it; the requested test "a client reading the state stream sees it" cannot pass from this file. Building it there would have produced a green row and left E-01 open, and would have made slices.ts differ from the row mapping that mirrors it. The citation `slices.ts:125, 163-164` in E-01 names the mirror, not the publisher.

## 3. The closed set and the mapping (by reading; not built)

`CaptureStreamState = { LIVE, LOST }` (`packages/shared/src/sim/vocabulary.ts:318`). The selector line's member is not nullable (`api/state-slices.ts:236`); the registry entry's is (`:1176`).

| Camera | Member the type allows | Note |
|---|---|---|
| active `CAPTURE_FAULT` keyed by its device ID (stream / presence reasons) | `LOST` | exists; no new member needed |
| recording, no fault | `LIVE` | as today (telemetry `CONNECTED`) |
| enabled, no session, no fault | selector line: `LIVE` (no idle member, not nullable); registry entry: `null` already for an adopted camera, `LIVE` for the built-in pair | a truthful rest state needs the contract: request to N2 |

## 4. Where it has to be built (request lines written)

1. `raiseCaptureWarningTransition` / `clearCaptureWarningTransition` / `clearCaptureFaultsTransition` in packages/shared (writer N2): set and restore `streamState` of the device's registry entry and selector line in the same unit as the fault, so the revision carries it without another event.
2. `db/mapping/rows.ts` for the state after a rehydration.

Two points for the controller before either is built:
- `LOST` is the condition of a PoE cycle (`CAMERA_NOT_LOST`, OD-22): a fault that sets `LOST` makes operation 48 legal for that camera outside a recording.
- The simulator runs the same transitions: "Simulated unchanged" needs a condition on real capture there.

## 5. DRIVER DECISION

DD-E1-1: not to edit `slices.ts`. A change there is unobservable, would pass its own unit tests and would be reported as the fix of a LIFT finding. Conservative choice: no product edit, the finding stays open, the right place is named.

## 6. Checks

| Check | Command | Result |
|---|---|---|
| existing slice tests, unedited | `npx vitest run src/modules/capture-config/__tests__/slices.test.ts --maxWorkers=2` | `Test Files 1 passed (1)`, `Tests 23 passed (23)` |
| no product change | `git status --short apps/core-server/src/modules/capture-config` | empty |

Not run, because nothing changed: the capture-config database suite, the acceptance pair, the static set, typecheck. No new test, so no mutation statement. No expectation changed.

## 7. Files

Written: this record, `delegation_progress/row_e1.md`; one line in `file_claims.md`, three in `file_requests.md` (Edit tool). Nothing else.
