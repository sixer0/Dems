---
task: 2026-10-12_input_av_core_adapter_plan
row: 168
milestone: M2 / WP-13a
agent: coder-execution (batch 6, agent B)
date: 2026-10-13
tier: T3
status: complete
---

# Row 168 - web console: the meter readers find an input by the selector's line

Paths are relative to `/Users/gsp-budi/Documents/DEMS`. `WEB` = `apps/core-web/src`. Names are those of
`decisions/161_selector_names_register.md` (section 7, files 11 to 14: N5 `meterInputOfChannel`, E24, E22).

## Statement

The audio panel and the audio source of the Session Monitor, the audio input card of Devices & Inputs and the
level meter ask `meterInputOfChannel` for the input of a meter channel. With no complete microphone pair the
answer is `null` and each draws its empty state: no input is named, no role chip, no source mark, no level.
The audio source has a nullable active input and a nullable standby; no built-in input and no other line
stands in. The name `micInputOfChannel` is in no file of `apps/core-web/src` any more. On the seeded selector
nothing reads differently.

## Sites closed

| Site (row 27) | File | Was | Now |
|---|---|---|---|
| W4 | `WEB/features/session-monitor/audio-panel.tsx` | three positional lookups per half; a half without a line read "STANDBY" with a chip of `MIC-01` / `MIC-02` | one `meterInputOfChannel`; `null`: `data-no-input`, no `data-source`, no chip, no marks |
| W6 | `WEB/features/session-monitor/audio-source.ts` (`:144`, `:153-171`, `:214`) | `selectActiveInputId: string` with the meters' member behind it; `selectStandbyInputId` ended in the table `MIC-01` <-> `MIC-02` and then in the active input itself; `silentInputOf` by position with a built-in default | both selectors `string \| null`, by role; the meters' member only under an OPEN session that states no pair and only when the selector in force holds that input; the table is deleted; `silentInputOf(faults, active \| null, lines)` through `meterInputOfChannel`, lines required |
| W5 | `WEB/features/devices/audio-input-card.tsx` | positional input; marks of a default microphone | `null`: `data-input-state="NOT_ASSIGNED"`, "Not assigned" in the sub line, no unreachable mark, no source marks, no peak |
| W5 | `WEB/components/composed/dbfs-meter.tsx` | the frame of the positional input at mount | the frame of `meterInputOfChannel`; `null`: the no-input drawing, at mount, for a frame that still reaches the meter, and when the input leaves while the meter is on screen |

## Change set

| File | Change |
|---|---|
| `WEB/features/session-monitor/audio-panel.tsx` | the half's input once, nullable; the empty state |
| `WEB/features/session-monitor/audio-source.ts` | the two selectors, `silentInputOf`, `AudioSourceView` (two nullable members), `ask` / `confirm` do nothing without a standby; `BUILT_IN_OTHER` removed |
| `WEB/features/session-monitor/audio-source-controls.tsx` | FOLLOWS the nullable pair only: no toggle and no silence offer without a standby; the footer's reason is the sentence of the unassigned STANDBY slot; the confirm dialog names nothing for an absent input |
| `WEB/features/devices/audio-input-card.tsx` | the nullable input; `PeakReadout` takes `hasInput` |
| `WEB/components/composed/dbfs-meter.tsx` | the frame lookup; the no-input rule in the frame handler; one `useSim` + effect for an input that leaves |
| `WEB/components/composed/__tests__/test-utils.ts` | `pushAudioFrame` writes the selector's input and throws for a channel without one |
| `WEB/components/composed/__tests__/dbfs-meter.test.tsx` | two helper lines renamed; 4 new cases |
| `WEB/features/session-monitor/__tests__/audio-source.test.tsx` | `silentInputOf` calls pass the lines (results unchanged); 1 new pure case; new block of 5 cases |
| `WEB/features/devices/__tests__/mic-input-name.test.tsx` | `silentInputOf` calls pass the lines; ONE pin moved (below) and one added beside it |
| `WEB/features/devices/__tests__/selector-microphones.test.tsx` | 4 new cases in the block "the audio cards follow the selector's lines" |
| `WEB/test/selector-in-force.test.tsx` | the one name: `meterInputOfChannel` (same expected value) |

No new component, style, dependency or string.

## The four absent-line tests (verification cell)

| File under test | Test file, case | Absent lines |
|---|---|---|
| `audio-panel.tsx` | `audio-source.test.tsx`, "the audio panel with ..." | none; PRIMARY alone; STANDBY alone |
| `audio-source.ts` | the same cases (toggle, footer, active input), "the pair (pure)", "a channel without a line names no input" | the same, plus an open session without a pair |
| `audio-input-card.tsx` | `selector-microphones.test.tsx`, "task 4 row 168, Simulated mode with ..." and "real capture with the STANDBY line alone" | none; PRIMARY alone; STANDBY alone |
| `dbfs-meter.tsx` | `dbfs-meter.test.tsx`, "with ... the meter draws no level of a built-in input" and "the input leaves the channel while the meter is on screen" | the same |

## Checks

| Check | Command (in `apps/core-web`) | Result |
|---|---|---|
| The test files of the features touched, ONE run | `npx vitest run src/components/composed/__tests__ src/features/devices/__tests__ src/features/session-monitor/__tests__ src/features/session-new/__tests__ src/test/live-d2-client-seams.test.tsx src/test/live-devices-clip.test.tsx src/test/live-meter-clip-reset.test.tsx src/test/live-pending-control.test.tsx src/test/live-session-monitor-audio-source.test.tsx src/test/live-session-monitor-panels.test.tsx src/test/real-core-facts.test.tsx src/test/selector-in-force.test.tsx src/test/live-devices-capture-selector.test.tsx src/test/live-dashboard-devices.test.tsx --maxWorkers=2` | `Test Files  45 passed (45)` / `Tests  584 passed (584)` |
| Names of the positional function left | `grep -rn micInputOfChannel src \| wc -l` | 0 (the 4 files, their test helpers, and the whole of `apps/core-web/src`) |
| Typecheck | `npx tsc -b` | exit 0 |
| Lint | `npx oxlint` on the 11 files | exit 0 |

"On the seeded selector the tests of the 4 subjects show 0 changed results": no expectation on the seeded
selector was edited. The edits to existing cases are (a) the third argument of `silentInputOf` - the seeded
or built-in pair given as lines, every expected value unchanged; (b) the helper name; (c) ONE moved pin, which is
not on a seeded selector: `mic-input-name.test.tsx`, `selectStandbyInputId` of a state with NO microphone line
answered `'MIC-01'` ("the other input of the built-in pair") and now answers `null`. That pin was the constant
stand-in the row removes (decision C18 (2)); it is marked "Moved by task 4 row 168" in the file.

## Driver decisions (for the controller to confirm)

| # | Decision | Why |
|---|---|---|
| DD-1 | `selectActiveInputId` no longer reads the meters' member except under an OPEN session that states no pair, and then only when the selector in force holds that input | with the seam `AudioSliceInState` the member cannot be null and may be stale; the rule of `audioPairInForce` ("the reader keeps the meters' active input" for that one state) is kept; the answer is the same on every complete selector |
| DD-2 | `audio-source-controls.tsx` edited (five statements) although the profile names four files | it is the only reader of the two nullable members of `AudioSourceView`; without it the tree does not compile. Claimed before the edit |
| DD-3 | A recording without a standby input: the toggle is not drawn and the footer reads "Standby microphone has no source assigned. Assign one on Devices." (`common.captureNotice.start.sourceNotAssigned` with `common.captureSlot.STANDBY`), `data-block="NO_STANDBY"` | "a control is hidden with its reason"; an existing sentence fits, so no new string. Reachable in Simulated mode only (C21 (6)) |
| DD-4 | The audio card of a channel without an input keeps its device identity (status chip, menu) and says "Not assigned" in its sub line; on an own-capture Core the line's name stands where the input id was named | the card is a LINE of the appliance (ruling D137); only what names an input changes |
| DD-5 | `DbfsMeter` and the card's peak readout put themselves into the no-input drawing (a `useSim` that changes only when the channel gains or loses its input) | the shared hook `useAudioChannel` calls back only for a defined frame, so a slot unassigned while the page is open would leave the last level on screen; request line left for row 165 as information |
| DD-6 | `silentInputOf` has no default for its lines | the default was "the built-in pair"; a caller without lines must say so |

## Double, and what stays unproven

The double is a hand-built selector slice with 0, 1 and 2 microphone lines (the simulator's store; the fake
Core's served slice), with the frames of the built-in inputs left in the meters slice. The screens against a
Core that answers an incomplete selector (rows 150, 162, 165, 29) are the scripted device session of the
milestone gate. No browser session. Nothing goes to the hardware package.

## Requests / PENDING-SHARED

No `PENDING-SHARED` constant. Two lines in `file_requests.md`, both "blocking: no": the answer to row 28's seam
reader 7, and the information on `useAudioChannel` for row 165.

---
*Generated: 2026-10-13*
