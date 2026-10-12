---
task: 2026-10-12_input_av_core_adapter_plan
row: 164
milestone: M2 / WP-13a
agent: coder-execution
date: 2026-10-13
tier: T3
status: complete, with two marked seams (section 4)
---

# Row 164 - shared: the lookup of a microphone input by role

Paths are relative to `/Users/gsp-budi/Documents/DEMS`. `SH` = `packages/shared`. Names are those of
`decisions/161_selector_names_register.md` ("the register"); N and E numbers are its entries.

## 1. What was built

| # | Name | Where | Statement |
|---|---|---|---|
| N6 | `RoleMicLine` | `SH/src/sim/audio.ts`, exported | `Pick<CaptureConfigMic, 'inputId' \| 'role'>` |
| N4 | `micInputOfRole(mics, role)` | the same file, beside `micInputOfChannel` | the `inputId` of the one line whose role is the role asked; `null` when no line holds it. No other line stands in |
| N5 | `meterInputOfChannel(mics, channel)` | the same file | a complete pair (exactly two lines, one PRIMARY, one STANDBY, two different inputs): the line at the channel's place in the list as held (D137, kept by C21 (7)). Anything else: `null` for both channels |
| E19 | `micInputOfChannel` | the same file | exported, body and signature unchanged (row 172 deletes it). Its private line type `MicLine` stays with it |
| E20 | `channelOfMicLine` | the same file | name and result kept; body re-based on N5. A lone line has no channel. Parameter: section 4, seam B |
| E21 | `activeMeterChannel` | the same file | seam reader 1 of row 28: a `null` active input answers the channel label `'AUDIO-01'` without a lookup. Compiles with the seam in and out |
| C16 | the frame loop of `createAudioSubsystem` | the same file | a channel without an input gets no frame (was: a frame under `MIC-01` / `MIC-02`) |
| C16 | the write of `audio.activeInputId` | the same file | seam reader 2 of row 28: the held input while it has a frame, else `micInputOfRole(lines, 'PRIMARY')`; the positional last resort is gone. Section 4, seam A |
| E24 / C18 | `audioPairOfSelector` | `SH/src/sim/selector-in-force.ts` | `{ activeInputId: PRIMARY line or null, standbyInputId: STANDBY line or null }`; the two stand-ins (`lines[0]`, "the first other line") are gone. Name and result type kept |

Absent is `null` in every answer: never `undefined`, an empty text or a constant of `DEFAULT_MIC_INPUT_OF_CHANNEL`.

Built only what the register names row 164 as writer of (N4, N5, N6) and the two bodies it assigns
(E20, E24). No other of the 24 fallback files was edited; `SH/src/sim/types.ts` was not edited.

## 2. Change set

| File | Change |
|---|---|
| `SH/src/sim/audio.ts` | N4, N5, N6; the private `isCompleteMicPair`; E20 re-based; E21; the frame loop; the active-input write; the parameter seam `MicLineRoleUnstated` with `statesRole` |
| `SH/src/sim/selector-in-force.ts` | body and comment of `audioPairOfSelector` only. The file still imports nothing |
| `SH/test/audio.test.ts` | new block "the lookup of a microphone input by role (task 4 row 164)": a table of 7 line sets, and 5 cases |
| `SH/test/sim-selector-in-force.test.ts` | the one case of `audioPairOfSelector`: its positional pin moved (lines without roles name no pair), one line added (a lone STANDBY) |
| `SH/test/sim-capture-config.test.ts` | one line (`:746`): the hand-built list given to `channelOfMicLine` states its roles; expectation unchanged. Named by the shared typecheck (register 3.2: "the test moves with its subject") |

All edits with the Edit tool; no scripted replace.

## 3. Checks (this Mac; pure functions and the in-app simulator on a manual clock; no device)

| Check | Command | Result |
|---|---|---|
| Shared typecheck | `npx tsc --noEmit -p .` in `SH` | run 1: 3 errors, all `test/sim-capture-config.test.ts:746` (fixed, section 2); last run: exit 0 |
| Shared, targeted | `npx vitest run --maxWorkers=2` on audio, sim-selector-in-force, sim-capture-config, session-machine, sim-capture-telemetry, sim-api, sim-contract, sim-v2-parity, sim-faults-scenarios, api-state-slices | `Test Files 10 passed (10)`, `Tests 340 passed (340)` (run again after seam B: the same line) |
| Workspaces that import `SH` | `npx tsc --noEmit` in `apps/core-server`, `apps/mobile`, `apps/mock-core`; `npx tsc -b` in `apps/core-web`; `npm run -s typecheck` in `apps/transcriber` | run 1: mobile 1 error (`features/devices/sim-adapter.ts:241`), the others exit 0; after seam B: exit 0, five of five |
| Readers downstream, on the seeded selector | core-web `vitest` on selector-in-force, live-dashboard-devices, precheck-unreachable, live-session-new-pending; mobile `jest` on audio-pair-in-force, selector-in-force, mic-source-model, devices-states; core-server unit `modules/devices/__tests__/status.test.ts` | `Tests 57 passed (57)`; `Tests: 35 passed, 35 total`; `Tests 44 passed (44)`. 0 changed expectations |
| Lint | `npx oxlint` on the two source and three test files | exit 0 |

NOT run: `npm test`, any database file, anything heavy.

The verification cell, line by line:

| Cell | Evidence (`SH/test/audio.test.ts`) |
|---|---|
| for a complete selector in both role arrangements each reader answers as the register states | table lines 1 to 3: `micInputOfRole` for both roles, `meterInputOfChannel` for both channels, `channelOfMicLine`, `audioPairOfSelector`; and `meterInputOfChannel` equals `micInputOfChannel` for each (D137 kept) |
| a lone STANDBY line is never the active input | table line 4 and the second case; in the subsystem the active input is not moved to it (third case) |
| a selector without microphone lines answers absent and neither `MIC-01` nor `MIC-02` | table line 6; second case: six answers `null`, with the control that the positional function still answers the two constants; the subsystem writes no frame |
| Simulated mode exactly as today on the seeded selector | last case (20 frames per channel per second, active input = PRIMARY = `MIC-01`); the nine other shared files and the three downstream runs green with 0 changed expectations |

## 4. Seams (both marked in the code, both a line of `file_requests.md`)

| | Marker | What it withholds | Removed by |
|---|---|---|---|
| A | `PENDING-ROW-28-SEAM`, the write `activeInputId: active ?? state.audio.activeInputId` | the state cannot hold `null` (`AudioSliceInState`, row 28). With no PRIMARY line the member keeps what it held; it is never a line by position and never a constant. Not reached on a selector with a PRIMARY line | row 149, with the seam of `types.ts`: `active` alone; one test line flips to `toBeNull()` |
| B | `PENDING-ROW-171`, the type `MicLineRoleUnstated` on the parameter of `channelOfMicLine` | the register gives the parameter `RoleMicLine`. `apps/mobile/src/features/devices/sim-adapter.ts:240` (`channelOf`) declares its lines as `{ inputId }`; that folder is row 55's in this batch and the file is row 171's. Lines that state no role are answered as no pair: no channel | row 171 states the type at `channelOf`; row 172 then narrows the parameter |

## 5. DRIVER DECISIONS (for the controller to confirm)

| # | Decision | Why | Reversible |
|---|---|---|---|
| DD-1 | `audioPairOfSelector` spells the by-role rule itself and does not call `micInputOfRole` | `selector-in-force.ts` "imports nothing", and `audio.ts` imports it: a call would be an import cycle. The table test holds the two equal on every line | yes |
| DD-2 | Seam A keeps the held input instead of writing `null` through a cast | a cast would put a `null` in front of the seven readers of other rows that still take a string | yes: one line |
| DD-3 | Seam B: the parameter of `channelOfMicLine` accepts a line that does not state its role, and answers `null` for such a list | "never leave the tree not compiling" against "do not edit row 55's folder". No caller is answered by position | yes: one type |
| DD-4 | The STANDBY member of the pair no longer excludes the active input (`line.inputId !== active`) | by role only; the selector's own rule refuses one input on both roles (`MIC_ON_BOTH_INPUTS`) | yes |
| DD-5 | `meterInputOfChannel` answers `null` for two lines of one role and for more than two lines | register 3.2: "anything else" | - |

## 6. Requirements

| Id | State after this row |
|---|---|
| AD-04 | sites C16 and C18 closed: nothing in the two files resolves a microphone by position except the unchanged `micInputOfChannel` (row 172) and N5 on a complete pair (D137, as ruled). The inventory test is row 149 |
| C18 (2) | the lookup by role exists, with the refusal `null` |
| C21 (7) | D137 kept: for a complete pair N5 equals the positional answer in both arrangements (tested) |
| C25 | nothing of R-1 or R-2 in this row; the answers fit the widened schemas of row 28 (0 or 2 frames) |
| Row 28 seam readers 1 and 2 of 9 | served; the seam itself stays |

## 7. Doubles, and what stays unproven

Double: hand-built selector lines; the in-app simulator with a selector put in place by `store.setState`.
Nothing goes to the hardware package. Not proven here: the 22 other callers of the positional function
(rows 150, 162, 163, 165, 167 to 171); a `null` in the state's `activeInputId` (after row 149).

## 8. Requests left in `file_requests.md`

Four lines: the answer to row 55's line on the mobile typecheck (resolved); row 171 for `channelOf`,
then row 172 for the narrowing; row 149 for seam A; information for rows 167 and the dashboard panel.

---
*Generated: 2026-10-13*
