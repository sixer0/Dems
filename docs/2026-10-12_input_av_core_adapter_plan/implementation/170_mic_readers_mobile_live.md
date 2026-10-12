---
task: 2026-10-12_input_av_core_adapter_plan
row: 170
milestone: M2 / WP-13a
agent: coder-execution
date: 2026-10-13
tier: T3
status: complete
---

# Row 170 - mobile live-session microphone readers: by the lookup of row 164, "absent" for a role without a line

Paths are relative to `/Users/gsp-budi/Documents/DEMS`. `MOB` = `apps/mobile/src`. Names are those of
`decisions/161_selector_names_register.md` ("the register", section 7 files 16 to 18); site M4 is that
of `research/027_selector_assumptions.md`. N4 = `micInputOfRole`, N5 = `meterInputOfChannel`.

## 1. What was built

| File | Reader | Before | Now |
|---|---|---|---|
| `mic-source-model.ts` | `inputOfChannel(channel, mics)` | positional function; default list `[]` = the built-in pair | N5; `string \| null`; no default list (the caller states the lines) |
| | `selectActiveInputId` (seam reader 8 of 9 of row 28) | `string` | `string \| null`: the pair in force, the meters' member behind it, typed as the slice states it; compiles with the seam `AudioSliceInState` in and out |
| | `selectStandbyInputId` | the pair in force, else "the other line" of the selector, else the other input of the built-in pair, else the active input | `string \| null`: the pair in force; for an open session that states none, the selector it records under BY ROLE (N4): the STANDBY line, or the PRIMARY line when the active input is the one the STANDBY line holds. No line: `null`. The table `BUILT_IN_OTHER` is deleted |
| | `micSourceRole(input, active)` | two strings | also `null` for an absent input or an absent active input (overload; two strings answer as before) |
| | `silentInputOf`, `noSignalInputOf` | a channel target through the positional function, default list `[]` | one private rule `inputOfFaultTarget`: the input itself; the input of the channel by N5 - `null` for a channel without one (no input is named for the fault); an unreadable target is the active input, which may be `null`. No default list |
| | `MicLine` | `{ inputId }` | the shared `RoleMicLine` (N6) |
| `mic-card.tsx` | `useMicLevelState` | the frame of the positional input | N5; `null`: the new state `ABSENT` - no frame is read |
| | `MicCard` line input | positional | N5; `null`: no badge of a device; the state line reads "No microphone input" (never the channel record's own "No signal"); no role chip, no glow |
| `use-mic-source.ts` | `MicSourceView.activeInputId`, `.standbyInputId` | `string` | `string \| null` |
| | `useMicSwitch` | - | `ask` and `confirm` do nothing while a member of the pair is absent: no confirmation, no command |
| `mic-source-controls.tsx` (follows the hook) | `MicSourcePanel` | both ids required | both nullable. With a member absent while recording: the toggle and the two "switch" actions of the warnings are not drawn, one sentence stands where the toggle would be; a warning keeps naming its input |

Names of the positional function left in the three files of the row: 0 (and 0 in the whole folder
`MOB/features/session-live`).

Two English strings, in the feature's own namespace (`MOB/features/session-live/i18n.ts`):
`mic.levelState.ABSENT` = "No microphone input"; `micPairIncomplete` = "The microphone pair is not
complete. There is nothing to switch." No shared string was needed.

## 2. Change set

| File | Change |
|---|---|
| `MOB/features/session-live/mic-source-model.ts` | section 1; imports (`meterInputOfChannel`, `micInputOfRole`, `RoleMicLine`; `micInputOfChannel` and `otherMicInput` gone) |
| `MOB/features/session-live/mic-card.tsx` | `MicLevelState` (+`ABSENT`), `useMicLevelState`, the line input, the badge, the state line |
| `MOB/features/session-live/use-mic-source.ts` | the two members of the view; `ask`, `confirm`; the toast's name |
| `MOB/features/session-live/mic-source-controls.tsx` | the two props; `pairComplete`; the sentence |
| `MOB/features/session-live/i18n.ts` | two keys |
| `MOB/features/session-live/mic-source-model.test.ts` | new block "task 4 row 170" (5 cases); the calls that handed no lines now hand the seeded lines (`SEEDED`), expectations unchanged; TWO pins moved (section 4) and two seeded lines added beside them |
| `MOB/features/session-live/mic-source.test.tsx` | new block "task 4 row 170" (4 cases: lone PRIMARY on phone and tablet, no line, the seeded control); 4 panel cases (three absent pairs, a warning beside an incomplete pair); one hand-built list states its roles; ONE pin moved (section 4) |
| `MOB/features/session-live/audio-pair-in-force.test.tsx` | the probe prints a name only for a present input; new block "task 4 row 170" (2 cases on the hook) |

All edits with the Edit tool. No new dependency; the sentence is a `Text` of the panel's own style,
the state line is the card's existing one.

## 3. Checks (this Mac; jest, no device)

| Check | Command (in `apps/mobile`) | Result |
|---|---|---|
| Typecheck, to find the callers | `npx tsc --noEmit` | run 1: exit 2 - 20 lines in the three test files of the row (missing lines / roles, nullable ids), 2 in `mic-source-model.ts` (a narrowing; fixed), and 1 foreign: `packages/shared/src/sim/api.ts(393,21) Cannot find name 'micInputOfChannel'` (agent A's row 165, in flight; gone at the next run). Last run, after every edit: exit 0 |
| The session-live suites | `npx jest src/features/session-live --maxWorkers=2` | `Test Suites: 25 passed, 25 total`, `Tests: 245 passed, 245 total` (first run) |
| Other suites that read the model | `npx jest` on capture-selector `selector-in-force.test.ts`, `source-on-session-live.test.tsx`, `source-on-session-live-offscreen.test.tsx` | `Test Suites: 3 passed`, `Tests: 18 passed` |
| Lint | `npx eslint` on the 8 files | exit 0 |
| The positional function | `grep -c micInputOfChannel` on the three files; `grep -rn` on the folder | 0, 0, 0; 0 lines |

The verification cell, line by line:

| Cell | Evidence |
|---|---|
| each of the 3 files has a test with an absent line that passes | model: block "task 4 row 170" of `mic-source-model.test.ts` (no line, lone STANDBY, lone PRIMARY; channels, pair, role, fault targets). Card: `mic-source.test.tsx`, "a lone PRIMARY line" on phone portrait and tablet landscape, and "no microphone line at all". Hook: `audio-pair-in-force.test.tsx`, "a lone PRIMARY line" |
| names of the positional function left in the 3 files: 0 | the grep above |
| on the seeded selector the session-live tests show 0 changed results | 25 suites green; the three control cases; no expectation on the seeded selector was edited (section 4 lists the three pins that moved: none is a seeded selector) |

## 4. Pins moved (each with its reason in the test file)

| Test | Was | Now | Why |
|---|---|---|---|
| `mic-source-model.test.ts`, "reads the session's pair first": `selectStandbyInputId` of a state that holds NO selector at all, an open session that states no pair | `'MIC-02'` | `null` | the answer was the table `BUILT_IN_OTHER`: a built-in input for a role no line holds. Beside it, the same session under the SEEDED selector still answers `'MIC-02'` (new line) |
| the same test: no session, no selector, the meters say `MIC-02` | `'MIC-01'` | `null` | the same table |
| `mic-source.test.tsx`, "a replaced pair": `inputOfChannel('AUDIO-02')` with no lines | `'MIC-02'` | `inputOfChannel('AUDIO-02', [])` is `null` | "without lines, the built-in pair" is the positional default the row removes |

Calls that only gained their lines (`SEEDED`, or the list of their block), with the SAME expectation:
`inputOfChannel` 2, `silentInputOf` 9, `noSignalInputOf` 5 in `mic-source-model.test.ts`; one list in
`mic-source.test.tsx` states its roles.

## 5. What stays until another row

- Seam `AudioSliceInState` (row 28; removed by row 149): while it stands the meters' member cannot be
  `null`. With no PRIMARY line and no pair stated by a session, `selectActiveInputId` then answers
  what the state still holds (row 164's seam A: "the held input", never a line by position). This
  file needs no edit when the seam goes: the member is already read as `string | null`.
- `MicMeter` draws through `useAudioSharedValues` (row 171's file): the bars of a channel without
  an input follow with that row.
- Both states are reachable only in Simulated mode: a Core in its own capture refuses the start
  while a slot is unassigned (C25). The screens are judged on a device at the milestone gate.

## 6. DRIVER DECISIONS (for the controller to confirm)

| # | Decision | Why |
|---|---|---|
| DD-1 | `selectStandbyInputId` lost BOTH stand-ins: "the other line of the selector" and the built-in table. Its fallback for an open session that states no pair is by role | C18 (2) and row 164's DD-4 (the shared pair lost the same two); for a complete pair the answer equals the old one, in both role arrangements |
| DD-2 | The meters' member stays behind the pair for the ACTIVE input, unguarded | it is the Core's own statement (register E41, 4.5: `null` without a PRIMARY line), not a position; a guard "only if a line holds it" would be a rule no document states |
| DD-3 | A fault whose target is a channel without an input names NO input (it does not fall back to the active input) | register file 12 (the web twin): "`null`: no input named for the fault"; the fallback to the active input is kept for a target that cannot be read |
| DD-4 | With a member of the pair absent the toggle is NOT DRAWN and a sentence says why; no new kind of `MicSwitchBlock` | the block kinds and their texts are shared with the web console (`session.audioSource.block.*`, a shared i18n file); the state exists only in Simulated mode |
| DD-5 | `mic-source-controls.tsx` and `i18n.ts` of the feature were edited beyond the three files of the profile line | the nullable pair must be followed where it is drawn (row 28's request names the file), and the two states need words; both claimed first |
| DD-6 | The default list `= []` of `inputOfChannel`, `silentInputOf`, `noSignalInputOf` is removed | with a default a caller could ask without lines and be answered "absent" silently; every production caller already hands `micLinesInForce(state)` |

## 7. Requirements

| Id | State |
|---|---|
| C18 (2), AD-04 | site M4 closed: three files, 0 names of the positional function, no stand-in line, no built-in input |
| Row 28, seam reader 8 of 9 | served (`selectActiveInputId`, with the hook and the panel behind it) |

Double: the in-app simulator's recording scenario with the selector's microphone lines cut down
through the store. Nothing goes to the hardware package.

---
*Generated: 2026-10-13*
