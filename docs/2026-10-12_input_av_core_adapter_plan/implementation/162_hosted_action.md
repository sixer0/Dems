---
task: 2026-10-12_input_av_core_adapter_plan
row: 162
milestone: M2 / WP-13a
agent: coder-execution (batch 6, agent A)
date: 2026-10-13
tier: T3
status: complete, with one marked seam (section 4)
---

# Row 162 - shared: the hosted action `setCaptureConfig`, rewritten

Paths are relative to `/Users/gsp-budi/Documents/DEMS`. `SH` = `packages/shared`. Names are those of
`decisions/161_selector_names_register.md` ("the register"); N and E numbers are its entries; site
labels C9 to C13 are those of `research/027_selector_assumptions.md`.

## 1. What the action does now (`SH/src/sim/capture-config.ts`)

| Site | Before | Now |
|---|---|---|
| C9 `assignCamera` | a line of the track had to exist; an empty track threw "no such video track" | the line is found BY ITS TRACK; a track without a line gets one (kept in track order). Operations 78 and 79 both fill an empty track |
| C10 mic line without `role` | the input had to be a line | unchanged as a rule (register 4.2, form "edit": the line edits an input the selector holds, else 422). An empty microphone slot is filled by the BY ROLE form, which now takes ONE line |
| C11 `replaceMicPair` | exactly two lines; audit `from` was the NEW device when the role held nothing | replaced by `assignMicsByRole`: one or two lines, each with a role, no role twice; the role a single line does not name keeps its line (found by role). `from` is ABSENT when the slot of the role was empty |
| C12 meters | keyed through the positional function, hence by `MIC-01` / `MIC-02` for a channel without a line | one frame per microphone line of the new selector and no other key; the active input is `micInputOfRole(mics, 'PRIMARY')` (N4). Two complete pairs: the frames move by channel as before (D137, through N5). Anything else: a line keeps the frame of its own input, or starts at "no signal" |
| C13 `assertSelector` | two lines read by position, guarded | the two rules hold between ANY two lines; no index is read |
| no `unassign` | - | N1 honoured: each slot named loses its line, found by its track or its role |

Order inside one change (register 4.3): `unassign`, then `cameras`, then `mics`; the rules of the selector as a whole are held on the result.

Audit rows (register 4.4; AD-10 (1)), all of type `CAPTURE_CONFIG_CHANGED`, keys of today's list:

| Edit | Rows | Members beside `operationId`, `permission` |
|---|---|---|
| `unassign` of a video slot that holds a device | 1 | `scope: CAMERA`, `field: SOURCE`, `trackId`, `from` |
| `unassign` of a microphone slot that holds an input | 1 | `scope: MIC`, `field: SOURCE`, `inputId`, `from` |
| `unassign` of an empty slot | 0 | the SAME state object is returned |
| an assignment into an empty slot | 1 | as today, `from` absent; `to`, `deviceId` the new device |
| an assignment over a held slot | as today | `from` the device that held the slot |

Refusals added: `CAPTURE_CONFIG_SLOT_UNASSIGNED_AND_ASSIGNED = 'SLOT_UNASSIGNED_AND_ASSIGNED'` (N17, `details.reason` of the 422); a single line by role that names the other role's input is `MIC_ON_BOTH_INPUTS` (E11; register D-3).

Names of the positional function `micInputOfChannel` left in the file: 0 (was 6 uses and the import).

## 2. Change set

| File | Change |
|---|---|
| `SH/src/sim/capture-config.ts` | the header table and the paragraph "a slot may be unassigned"; imports (N4, N5, `CAPTURE_PROFILE_1080P25`, `CaptureStreamState`, three types); N17; `CAPTURE_CONFIG_EMPTY_SLOT_PROFILE`; the private slot helpers; `inTrackOrder`; `assertSelector`; `assignMicsByRole` in place of `replaceMicPair`; `assignCamera`; the `UPDATE` case (the `unassign` step, the N17 checks); the role and meter tail |
| `SH/test/sim-capture-config.test.ts` | two pins moved (a single line with a role is no longer refused whatever it names: section 3); a new block "a selector slot may be unassigned and assigned again (task 4 row 162)": 7 category cases and 7 cases; six import lines |

No other file. `sim/types.ts`, `sim/audio.ts`, `api/`, `apps/` not touched.

## 3. Checks (this Mac; pure functions and the in-app simulator on a manual clock)

| Check | Command | Result |
|---|---|---|
| Shared typecheck | `npx tsc --noEmit -p .` in `SH` | exit 0 |
| The action's existing tests, before any test edit | `npx vitest run --maxWorkers=2 test/sim-capture-config.test.ts test/sim-sending-device.test.ts` | `Tests 2 failed, 64 passed (66)`: the two pins "a single line with a role is refused" (`:620`, `:649` at the time), which the register names as the one change of rule MIC-ASSIGN ("One line: was 422, now valid"). Every other existing case: 0 changed results |
| The same two files after the pins and the new block | the same command | run 1: 6 failed, all in the new block (the test double held meters that did not agree with its selector; the double was corrected, no source change); run 2: `Test Files 2 passed (2)`, `Tests 80 passed (80)` |
| Simulator suites that read the selector | `npx vitest run --maxWorkers=2` on audio, sim-selector-in-force, session-machine, sim-capture-telemetry, sim-api, sim-api-validation, sim-contract, sim-v2-parity, sim-faults-scenarios, api-state-slices, api-domain-operations, sim-evidence-item-kind, live-source-bindings, sim-capture-notices, live-testing-fetch | `Test Files 15 passed (15)`, `Tests 598 passed (598)`; 0 changed expectations |
| Lint | `npx oxlint src/sim/capture-config.ts test/sim-capture-config.test.ts` | 2 warnings in the new test lines, removed; then no finding |
| Typecheck of the workspaces that import `SH` | `tsc --noEmit` in `apps/core-server`, `apps/mobile`, `apps/mock-core`; `tsc -b` in `apps/core-web`; `npm run -s typecheck` in `apps/transcriber` | mock-core, core-web, transcriber: no error line. core-server and mobile: errors in files other agents of this batch are writing, none in a line that reads this row's file (section 6) |

NOT run: `npm test`, any database file, anything heavy.

The verification cell, line by line:

| Cell | Evidence (`SH/test/sim-capture-config.test.ts`, block of row 162) |
|---|---|
| unit table over the 7 selector categories of addendum 1.5: every slot can be unassigned and assigned again | `it.each` over 7 hand-built states (categories 1 to 7; D and P devices in one registry) by 4 slots = 28 unassign-then-assign runs: the slot is empty after the clear, no other slot moved, a second clear returns the same state, the slot holds the device again, a held slot is back with the same lines in the same order |
| audit rows: 2 for two cleared slots, 0 for an empty one | case "AD-10 (1)": 2 rows for `['VIDEO-02', 'STANDBY']` with their exact members; the four-slot clear over a half-empty selector gives 2 more; over the empty selector the same state (0 rows); 4 rows in total |
| `from` never the new device | every row of the 28 runs: an assignment into an empty slot has NO `from` key (exact `toEqual`), and where `from` is present it differs from `to`; case "the order inside one change": `from` of an assignment over a held slot is the device that was there |
| on the seeded selector the action's existing tests show 0 changed results | the first run above: 64 of 66 unchanged, the 2 named pins; the 15 other suites green with no edit |

Beyond the cell: AD-04 at the action (a lone `VIDEO-02` line and a lone STANDBY line stay what they are; operation 79 fills an empty track; operation 80 on a lone line); AD-10 (3) in its three forms with controls; AD-10 (2) at the action (`unassign` refused `ILLEGAL_STATE` while `recording` and `finalizing`, no row, same state); the meters keyed only by inputs the selector holds after every microphone edit (`expectSound`).

## 4. Seam

| Marker | What it withholds | Removed by |
|---|---|---|
| `PENDING-ROW-28-SEAM`, `activeInputId = micInputOfRole(mics, PRIMARY) ?? state.audio.activeInputId` | the state cannot hold `null` (`AudioSliceInState`, row 28). Without a PRIMARY line the member keeps the input it held: never a line by its place, never a built-in input; no meter is keyed by it. Not reached on a selector with a PRIMARY line | row 149 with the seam of `sim/types.ts`: the `??` goes; the test line `expect(rest.audio.activeInputId).toBe('MIC-01')` becomes `toBeNull()` |

## 5. DRIVER DECISIONS (for the controller to confirm)

| # | Decision | Why | Reversible |
|---|---|---|---|
| DD-1 | A camera assigned into an EMPTY video slot by a change that names no profile gets `CAPTURE_CONFIG_EMPTY_SLOT_PROFILE` (= `CAPTURE_PROFILE_1080P25`, `H264_1080P25`); a NEW exported name outside the register | a line needs a profile (the stored CHECK: device and profile both set). Operation 79 has no profile member and neither client's camera command sends one (searched `profile` in both command builders: 0), so a refusal would leave site C9 open for every caller. A held slot keeps its own profile as before. In real capture a profile that differs from the stream is what the existing profile notice reports | yes: one constant; the alternative is a 422 |
| DD-2 | The action refuses with N17 also the two forms the schema already refuses (a camera line of the cleared track, a by-role line of the cleared role) | the action is called without the schema in front of it by the in-app simulator action and by tests; "the transition holds the rule itself" (the file's own principle) | yes |
| DD-3 | A slot of `unassign` that is no slot of the selector is `INVALID_INPUT`; a slot named twice is harmless (the second clear finds an empty slot) | the schema refuses both; the action stays total | yes |
| DD-4 | For a selector that is not two complete pairs before and after, a microphone line keeps the frame of ITS OWN input | register 4.5 fixes the keys and the complete case only; by input is the reading that takes nothing by position | yes |
| DD-5 | The audit rows of the by-role form are written in the order PRIMARY, STANDBY whatever the order of the lines | what the pair replacement always did (it built `[primary, standby]`); kept so that existing expectations do not move | - |
| DD-6 | The new test block was appended to the existing test file by one shell append, not by the Edit tool | a slip against the brief's "Edit tool only for existing files"; nothing existing was replaced by it (the two moved pins and every later correction were made with Edit). Reported so that the controller can check the diff | - |

## 6. Reds seen in files this row does not own (not edited)

| File:line | What | Likely owner |
|---|---|---|
| `apps/core-server/src/capture-session/index.ts:1111`, `:1171`, `:1313` | `INGEST_ADDRESS_UNKNOWN` not found; `Live` lacks `ingest`, `cameras`; 5 arguments for 4 | agent G (row 48), in flight |
| `apps/core-server/src/modules/capture-config/__tests__/credential-reader.db.test.ts:157` to `:333` (13 lines) | "Expected 2 arguments, but got 1" | agent D (row 145), in flight |
| `apps/mobile/src/features/capture-selector/capture-selector-model.test.ts:89-91` | a readonly table given to `it.each` | agent C (row 32), in flight |

None names a symbol of `SH/src/sim/capture-config.ts`.

## 7. Requirements

| Id | State after this row |
|---|---|
| AD-04 (1), (2) | the hosted action is rewritten; nothing in it resolves a camera or a microphone by position (sites C9 to C13). The stored-row half (a lone `VIDEO-02`, a lone STANDBY read back as NULL columns) is rows 166 / 29 |
| AD-10 (1) | closed at the action: one row per cleared slot with the track or input and `from`; none for an empty slot. Counted through operation 78 at the Core: row 29 |
| AD-10 (3) | closed at the action (N17), beside the schema of row 28 |
| AD-10 (2) | the action refuses while a session is open (unchanged rule, now tested for `unassign`); the 409 `CAPTURE_CONFIG_LOCKED` table is row 29 |
| C21 (8) | a microphone role is assignable alone |
| C18 (2) | no use of the positional function in this file |

## 8. Doubles, and what stays unproven

Double: hand-built simulator states (one registry of 4 development and 4 production devices, 7 selectors). Nothing goes to the hardware package. Not proven here: `unassign` through operation 78 at the Core (row 29 forwards the member); the in-app REST body check (row 165, this agent's third row); a `null` in the state's `activeInputId` (row 149).

## 9. Requests left in `file_requests.md`

Three lines: row 29 (what the action now takes and answers); row 149 (the seam line and its test line); the reds of section 6 as information.

---
*Generated: 2026-10-13 02:10 WIB*
