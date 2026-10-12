---
task: 2026-10-12_input_av_core_adapter_plan
row: 167
milestone: M2 / WP-13a
agent: coder-execution (batch 6, agent B)
date: 2026-10-13
tier: T3
status: complete
---

# Row 167 - web console: the pre-check screen and an unassigned selector slot

Paths are relative to `/Users/gsp-budi/Documents/DEMS`. `WEB` = `apps/core-web/src`. Names are those of
`decisions/161_selector_names_register.md` (5.2, 5.4, 5.5: N7, N8, N12, N13, N14, E34).

## Statement

The Devices Check step of a new session draws the item of an unassigned selector slot: a BLOCK row with the
sentence of row 28 ("Standby microphone has no source assigned. Assign one on Devices."), for each of the four
slots, the standby microphone included (decision C25). The item carries no device id; it is found by the one
shared recogniser `unassignedSlotOfPrecheckItem` and worded by its slot. A microphone meter is labelled from
`meterInputOfChannel`: a channel with no input names none. Simulated mode on the seeded selector reads as before.

## Site closed

| Site (row 27) | Was | Now |
|---|---|---|
| W3 `features/session-new/devices-step.tsx:316-321` | `micInputOfChannel`: a meter labelled `MIC-01` / `MIC-02` with no line behind it | `meterInputOfChannel`; `null` -> no input, no role; on a Core in its own capture the meter reads "Not assigned" |
| the closed rule list `lib/capture-notices.ts:217` (E34) | 7 members; an item without a device id was dropped | 8 members (`sourceNotAssigned`); the item is drawn through the shared recogniser, not through the unreachable form |

## Change set

| File | Change |
|---|---|
| `WEB/lib/capture-notices.ts` | `CAPTURE_START_RULES` gains `sourceNotAssigned`; `UnreachablePrecheck.rule` excludes it and `unreachablePrecheckOf` answers `null` for it (the unreachable sentence takes a device, this rule a slot); NEW `unassignedPrecheckText(t, slot)` |
| `WEB/features/session-new/devices-step.tsx` | `useCheckReason`: the unassigned slot first, before every other rule; `CheckRow`: `data-rule="sourceNotAssigned"`, `data-slot`, and its `value` is not sent to the value enumeration; `MicMeter`: `meterInputOfChannel`, the absent case |
| `WEB/features/session-new/__tests__/precheck-unreachable.test.tsx` | one new block, 6 cases |

No new component, style, dependency or string. The BLOCK chip, the blocked alert and the gate are the existing
ones: the item is `status: BLOCK`, so the step's own rule blocks "Continue".

## Checks

| Check | Command (in `apps/core-web`) | Result |
|---|---|---|
| Session-new tests | `npx vitest run src/features/session-new/__tests__ src/test/live-session-new-precheck.test.tsx src/test/live-session-new-local-notice.test.tsx --maxWorkers=2` | `Test Files  7 passed (7)` / `Tests  72 passed (72)` |
| The same, after the local recogniser was replaced by the shared one (a code change, not a failure) | the same | `Test Files  7 passed (7)` / `Tests  72 passed (72)` |
| Typecheck | `npx tsc -b` | run 1: 2 errors of this row (a test cast; the typed sentence of the unreachable form with the new member) and 4 in `packages/shared/src/sim/session-machine.ts` (`:22`, `:504`, `:839` twice - agent A's file, in flight, not edited); final run: exit 0 |
| Lint | `npx oxlint` on the three files | exit 0 |
| Names of the positional function left in `devices-step.tsx` | `grep -c micInputOfChannel` | 0 |

Verification cell: "an item of the new rule without a device id is drawn as a blocking item with the text of
row 28" - case "all four slots"; "with no microphone line the screen shows neither `MIC-01` nor `MIC-02`" -
the `it.each` "the meters" (no line, PRIMARY alone, STANDBY alone); "0 other changed results" - no existing
expectation of the seven files was edited.

## Driver decisions (for the controller to confirm)

| # | Decision | Why |
|---|---|---|
| DD-1 | The shared names of row 163 are IMPORTED (`unassignedSlotOfPrecheckItem`, `CaptureStartRule.SOURCE_NOT_ASSIGNED`): they landed in `@dems/shared/sim` while this row was open. A first local form marked `PENDING-SHARED` was removed again | the register wants one recogniser for both clients; no `PENDING-SHARED` constant is left |
| DD-2 | A meter channel with no input on a Core in its own capture is labelled "Not assigned" (`common.captureSlot.notAssigned`); the simulated lane keeps `common.tracks.<channel>` as today | no string names "a channel without an input"; the simulated label names a room role, not an input |
| DD-3 | The blocked alert keeps its general hint "Clear the fault, then re-run the checks." beside the slot sentence | the hint is shared by every block; a hint of its own would be a new string (not requested) |
| DD-4 | `features/session-new/model.ts` `reasonKeyFor` was not edited: for the new item it still answers the id's fault key, but its only reader (`devices-step.tsx`) asks the slot first | outside the row's two files; no visible effect |

## Double, and what stays unproven

The double is a hand-built item list and selector slice in the simulator's store (a Core in its own capture is
the state member `security.platformNotReported`). That the Core produces the item is rows 163 / 30; the screen
against it is the scripted device session of the milestone gate. No browser session. Nothing goes to the hardware package.

## Requests / PENDING-SHARED

None left.

---
*Generated: 2026-10-13*
