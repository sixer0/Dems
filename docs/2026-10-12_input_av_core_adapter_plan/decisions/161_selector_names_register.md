---
task_id: 2026-10-12_input_av_core_adapter_plan
task_slug: input_av_core_adapter_plan
date: 2026-10-12
agent: data-analyst
row: 161 ([M2|WP-13a])
type: names register (decisions; docs only)
narrative_tier: 1
confidence: HIGH for every EXISTING name (opened at its line in this pass); MEDIUM for what a NEW name does to a test that was not run (nothing was run)
basis: research/027_selector_assumptions.md (row 27); decisions/decisions.md C14, C18, C21; masterplan/04_design_addendum.md section 1; verification/04_security_addendum.md AD-04, AD-10; identification/03_implementation_blueprint.md rows 28-36, 149, 150, 161-173 with their profile lines and section 8.1
status: complete, with two points for the controller (section 9)
last_updated: 2026-10-12 23:35 WIB
---

# Row 161: names register of work package WP-13a

Abbreviations: `SH` = `packages/shared/src`, `CS` = `apps/core-server/src`, `WEB` = `apps/core-web/src`, `MOB` = `apps/mobile/src`. "Site A1, C15, W3 ..." are the site labels of row 27.

## 0. Frame

| | |
|---|---|
| What | The one list of names, members, refusal codes, text keys and contract shapes that the rows of WP-13a share: nullable selector slots, `unassign` on operation 78, lookup of a microphone by role in place of the positional fallback |
| Why | Rows 28, 29, 31, 32, 150 and 162 to 172 are written in four workspaces at the same time. Without one register two rows name one thing twice (blueprint section 13, recommendation P0) |
| Who reads it | Rows 28 and 164 by build dependency; rows 31, 32, 163 by contract dependency; every other row of the package through those; the reviewer of row 35; the gate of row 36 |
| When | Before any row of the package other than 166 starts (blueprint 8.1, "Waves") |
| Scope | Names and shapes only. No application file was written. Nothing here changes the fence, the boot checks, a grant, a value set, the operation count or the audit vocabulary |
| How | Read-only. Each EXISTING name was opened at its line (`grep -n` from the repository root, then the lines read). The working tree was moving while this was read (rows 17 and others in flight): `SH/sim/api.ts` shifted by 11 lines between two reads. Where a line number here and one of row 27 differ, the site label of row 27 identifies the place |
| Binding rulings | C18 (1)-(3) and C21 (6)-(9). Section 1 restates them as the register applies them |

Marks: **EXISTING** = the identifier is in the code today (file:line); a row may change its body or widen its type, never its spelling. **NEW** = no such identifier today (searched in the four source trees: 0 files); the writer row is the only row that declares it.

## 1. The rulings, as this register applies them

| Ruling | Text | What it fixes here |
|---|---|---|
| C18 (1) | real capture: an unassigned slot blocks the pre-check and the start is refused; Simulated keeps today's behaviour and data | N7 to N12; the marker E26 |
| C18 (2) | nothing resolves a microphone or a camera by position; `micInputOfChannel` is replaced by a lookup by role | N4, N5; section 5 |
| C18 (3) | both selector screens draw a row for an empty slot with an assign offer | section 6 |
| C21 (6) | Simulated mode on an incomplete selector starts as today; the refusal is a real-capture rule | the refusal N9 and the item N7 are produced only where `isOwnCaptureCoreState(state)` is true (E26) |
| C21 (7) | the meter channel of a microphone line: D137 kept for a complete pair, no amendment | N5: the answer for a complete pair is today's; for anything else it is absent |
| C21 (8) | a microphone role is assignable alone; a session start needs the PRIMARY; a missing STANDBY warns as today (D80(6)) | the rule MIC-ASSIGN (section 4.2); N11 holds three slots |
| C21 (9) | `fake-profile.ts` beside an empty slot is accepted; row 173 is skipped | no name; row 173 reads nothing here |

The two rules this row was to draft (blueprint decisions 7 and 8) are therefore not drafted as alternatives: they are stated as ruled, each with its evidence line and its effect on a complete selector (sections 3.2 and 4.2).

## 2. The six names the row's verification asks for

| # | Asked | Name | Mark |
|---|---|---|---|
| 1 | the lookup | `micInputOfRole(mics, role)`, with the meter-channel form `meterInputOfChannel(mics, channel)` | NEW, row 164 |
| 2 | the "absent" answer | `null` (the result type is `CaptureMicInputId \| null`). Never `undefined`, never an empty string, never a constant of `DEFAULT_MIC_INPUT_OF_CHANNEL` | the value is the language's; the precedent is EXISTING: `channelOfMicLine` answers `null` (`SH/sim/audio.ts:83`), `AudioPairInForce` holds `null` members (`SH/sim/selector-in-force.ts:86`) |
| 3 | the four slot names of `unassign` | `'VIDEO-01'`, `'VIDEO-02'`, `'PRIMARY'`, `'STANDBY'` as `CAPTURE_SELECTOR_SLOTS` / `CaptureSelectorSlot` | values EXISTING (`TrackId`, `SH/domain/enums.ts:139`; `MicRole`, `:169`); the list and the type NEW, row 28 |
| 4 | the rule name of the pre-check item | `CaptureStartRule.SOURCE_NOT_ASSIGNED = 'sourceNotAssigned'` | NEW member of an EXISTING object (`SH/sim/capture-notices.ts:357`), row 163 |
| 5 | the text key | `common.captureNotice.start.sourceNotAssigned` | NEW, row 28 |
| 6 | the reason of the start refusal | `CAPTURE_SOURCE_NOT_ASSIGNED_REASON = 'CAPTURE_SOURCE_NOT_ASSIGNED'` | NEW, row 163 |

## 3. Register: the lookup by role (rows 164, 172)

### 3.1 Names

| # | Identifier | Declared in (writer) | Type / shape | Read by | Mark |
|---|---|---|---|---|---|
| N4 | `micInputOfRole` | `SH/sim/audio.ts` (164) | `(mics: readonly RoleMicLine[], role: MicRole) => CaptureMicInputId \| null`. The `inputId` of the one line whose `role` is the role asked; `null` when no line holds it. No other line stands in | 150, 162, 163, 164, 165, 167 | NEW |
| N5 | `meterInputOfChannel` | `SH/sim/audio.ts` (164) | `(mics: readonly RoleMicLine[], channel: AudioTrackId) => CaptureMicInputId \| null`. See 3.2 | 150, 162, 165, 167 to 171 | NEW |
| N6 | `RoleMicLine` | `SH/sim/audio.ts` (164) | `Pick<CaptureConfigMic, 'inputId' \| 'role'>`, exported. It replaces the private `MicLine` (`SH/sim/audio.ts:59`), which states no role | every caller of N4, N5 | NEW |
| E19 | `micInputOfChannel` | `SH/sim/audio.ts:78` | positional, total, answers a constant. Stays exported and unchanged until row 172 deletes it. The spelling of N5 was chosen so that a case-sensitive search for `micInputOfChannel` does not match it (the static test of row 172) | today 24 files (section 5) | EXISTING, deleted by 172 |
| E20 | `channelOfMicLine` | `SH/sim/audio.ts:83` | `(mics, inputId) => AudioTrackId \| null`: the inverse. Signature and name kept; the body is re-based on N5 by row 164; the line type becomes N6 | `SH/sim/session-machine.ts:514,991`, `SH/sim/capture-telemetry.ts:196`, `MOB/features/devices/sim-adapter.ts:241` | EXISTING |
| E21 | `activeMeterChannel` | `SH/sim/audio.ts:89` | unchanged. Its `?? 'AUDIO-01'` names a channel, never an input: with no line behind that channel N5 answers `null` and the caller has no frame | `SH/sim/faults.ts:99,617`, `SH/sim/capture-telemetry.ts:192` | EXISTING |
| E22 | `DEFAULT_MIC_INPUT_OF_CHANNEL` | `SH/sim/audio.ts:53` | stays as the table of the built-in pair; after row 164 it is the answer of no lookup. `WEB/features/devices/audio-input-card.tsx:64` compares against it for a label and keeps doing so | 168 | EXISTING |
| E23 | `captureMicLines`, `micLinesInForce`, `selectorInForce` | `SH/sim/audio.ts:66`; `SH/sim/selector-in-force.ts:68,63` | unchanged: which lines are in force | all | EXISTING |
| E24 | `audioPairOfSelector`, `audioPairInForce`, `AudioPairInForce`, `PairMicLine` | `SH/sim/selector-in-force.ts:120,136,86,92` | name and result type kept. Row 164 changes the body of the first: `{ activeInputId: PRIMARY line or null, standbyInputId: STANDBY line or null }`; the two stand-ins of `:122-123` (`lines[0]`, "the first other line") go (site C18) | 167, 168, 170, 171, `WEB/features/dashboard/devices-panel.tsx:49` | EXISTING |

### 3.2 The meter channel (ruling C21 (7); D137 kept, no amending row)

Evidence line: D137 (1) "meter channel -> input follows the selector's INPUT ORDER (D106(1))" (`docs/2026-10-07_dems_real_capture_sealing/decisions/decisions.md:150`); the code comment `SH/sim/audio.ts:69-76`.

`meterInputOfChannel(mics, channel)`:

| The lines given | Answer |
|---|---|
| a complete pair: exactly two lines, one `PRIMARY` and one `STANDBY`, two different inputs | the `inputId` of the line at the channel's place in the list as held (`AUDIO-01` the first, `AUDIO-02` the second). This is the expression of E19 without its default |
| anything else: no line, one line, two lines that are not one of each role | `null` for both channels |

Effect on a complete selector: the answer equals today's `micInputOfChannel` for every list of two lines with both roles, in both role arrangements (`MIC-01` PRIMARY or `MIC-02` PRIMARY), because the same index is read. Differences to D137: none. An amending row to D137: not needed.

What is no longer answered: `MIC-01` / `MIC-02` for a channel without a line, and "channel 1" for a lone STANDBY line. A lone line (possible since C21 (8)) has a role, hence N4 finds it, and it has no meter channel until the pair is complete: the channel-keyed surfaces draw their empty state for both channels. In real capture no session runs in that state (`CS/modules/capture-config/plan.ts:120-126`, unchanged).

A caller that only has lines without a role (a hand-built test list of `{ inputId }`) no longer type-checks: that is intended, the test moves with its subject.

## 4. Register: operation 78 and the hosted action (rows 28, 162, 165, 29)

### 4.1 Names

| # | Identifier | Declared in (writer) | Type / shape | Read by | Mark |
|---|---|---|---|---|---|
| E1 | operation `updateCaptureConfig` (78) | `SH/api/devices.ts:464` | id, path, permission, statuses unchanged; the count stays 97. Client kinds unchanged (AD-10 (5); blueprint decision 2): no web-console condition | 28, 29, 31, 32, 165 | EXISTING |
| E2 | `CaptureConfigUpdateRequestSchema` | `SH/api/devices.ts:144` | gains the optional member N1 and one body rule (4.3). Stays a strict object | 28, 29, 165 | EXISTING |
| N1 | `unassign` | member of E2 and of the `UPDATE` kind of E5 (28) | schema: `z.array(z.enum(CAPTURE_SELECTOR_SLOTS)).min(1).max(4).optional()`, no slot twice. Type: `unassign?: readonly CaptureSelectorSlot[] \| undefined` | 29, 31, 32, 162, 165, 33 | NEW |
| N2 | `CAPTURE_SELECTOR_SLOTS` | `SH/api/devices.ts` (28) | `[TrackId.VIDEO_01, TrackId.VIDEO_02, MicRole.PRIMARY, MicRole.STANDBY] as const` | 28, 163, 165 | NEW |
| N3 | `CaptureSelectorSlot` | `SH/sim/types.ts` (28) | `VideoTrackId \| MicRole` (structural, so that `sim/types.ts` imports nothing of `api/`); equal by a type test to `(typeof CAPTURE_SELECTOR_SLOTS)[number]` | 31, 32, 162, 163, 165, 167, 169 | NEW |
| E3 | `CaptureConfigCameraUpdateSchema` | `SH/api/devices.ts:106` | unchanged | 28 | EXISTING |
| E4 | `CaptureConfigMicUpdateSchema` | `SH/api/devices.ts:128` | members unchanged; the description of `role` is reworded to the rule MIC-ASSIGN (a single line with `role` is valid) | 28, 165 | EXISTING |
| E5 | `CaptureConfigChange` | `SH/sim/types.ts:889` | the `UPDATE` kind gains N1. **No new kind**: `CAPTURE_CONFIG_CHANGE_OPERATIONS` (`SH/api/sim-actions.ts:132`), `CAPTURE_CONFIG_CHANGE_OPERATION_ID` (`SH/sim/capture-config.ts:41`) and `SH/live/source/bindings.ts:185` do not move | 29, 162 | EXISTING |
| E6 | `CaptureConfigCameraChange`, `CaptureConfigMicChange` | `SH/sim/types.ts:864,871` | members unchanged; the comment of `role` follows E4 | 162 | EXISTING |
| E7 | `setCaptureConfigTransition`, `SET_CAPTURE_CONFIG_ACTION` | `SH/sim/capture-config.ts:152,38` | name and signature kept; body rewritten by row 162 (sites C9 to C12) | 29, 33 | EXISTING |
| E8 | `Permission.CAPTURE_CONFIG` | `SH/sim/vocabulary.ts:42` | unchanged; `unassign` needs it and nothing else | 28, 29 | EXISTING |
| E9 | `ApiErrorCode.CAPTURE_CONFIG_LOCKED`; `CONFIG_LOCKED` | `SH/api/core-api.ts:212`; `SH/api/devices.ts:398` | the lock refusal of `unassign`: `409`, thrown before the action (`CS/modules/capture-config/routes.ts`, the `isSessionActive` line of `edit`), 0 audit rows (SEC35-19; AD-10 (2)) | 29, 33 | EXISTING |
| E10 | `AuditType.CAPTURE_CONFIG_CHANGED` with its detail keys | `SH/sim/vocabulary.ts:414`; keys `CS/core/audit-details.ts:276-287` | the only audit type of the package; `from`, `to`, `deviceId` are OPTIONAL keys today, so 4.4 needs no vocabulary change | 29, 162 | EXISTING |
| E11 | `CAPTURE_CONFIG_MIC_ON_BOTH_INPUTS`, `CAPTURE_CONFIG_CAMERA_ON_BOTH_TRACKS` | `SH/sim/capture-config.ts:61,59` | unchanged `details.reason` of two `422` | 162, 31, 32 | EXISTING |
| N17 | `CAPTURE_CONFIG_SLOT_UNASSIGNED_AND_ASSIGNED = 'SLOT_UNASSIGNED_AND_ASSIGNED'` | `SH/sim/capture-config.ts` (162) | `details.reason` of the `422` the hosted action throws when a body clears and fills one slot in a form the schema cannot see (4.3, second line) | 29, 165 | NEW |
| E12 | `checkCaptureConfigUpdate` | `SH/sim/api.ts:689` (site C25) | accepts the key `unassign` with the rules of N1 and 4.3; refusal path `unassign` | 165 | EXISTING |
| E13 | `CaptureConfigCamera`, `CaptureConfigMic`, `CaptureConfigSlice` | `SH/sim/types.ts:672,690,704` | unchanged. An unassigned slot is an ABSENT line, never a line with an empty device (row 27 section 1; `SH/api/state-slices.ts:1114-1117` bounds neither array) | all | EXISTING |
| E14 | `CaptureConfig` (domain) | `SH/domain/entities.ts:272` (site A9) | `video01DeviceId`, `video01Profile`, `video02DeviceId`, `video02Profile`: `string \| null`; `micPrimaryId`, `micStandbyId`: `MicInputId \| null` | 28 | EXISTING |
| E15 | `CaptureConfigRecord` | `CS/modules/capture-config/slices.ts:31` (site A2) | the same six members `string \| null`; `store.ts` `recordOf` accepts a JSON null for them (site A1) | 29 | EXISTING |
| E16 | `CaptureConfigRow`; CHECK `capture_config_slot_pair_check` | `CS/db/schema/capture.ts` (row 17, in the working tree at the time of reading: `:346`, `:187`) | six nullable columns; the CHECK name is the addendum's proposed one, as row 17 wrote it. No row of WP-13a writes this file | 29, 166, 149 | EXISTING (row 17) |
| E17 | `captureConfigToRow`, `captureConfigFromRow`, `selectorDeviceIds` | `CS/db/mapping/rows.ts:782,906,957` (sites A3, A4, A5) | names kept; by track and by role, NULL for an absent line, no line at position 0 or 1 | 166, 29, 33 | EXISTING |

### 4.2 The rule MIC-ASSIGN (ruling C21 (8))

Evidence line: row 27 section 3 pattern B (`SH/api/devices.ts:120-126`, `SH/sim/capture-config.ts:112`: a replacing pair is exactly two lines today); C21 (8).

The member `mics` of the body has three forms:

| Form | Lines | Meaning | Today |
|---|---|---|---|
| edit | 1 or 2 lines, none with `role` | each line edits the input it names, which the selector must hold (`422` otherwise) | unchanged |
| by role | 1 or 2 lines, every one with `role`, no role twice, each `deviceId` equal to its `inputId` | each line puts its input on the slot of its role. The slot of a role the body does not name keeps what it holds | two lines: unchanged (pair replacement, D133 (1)). One line: was `422`, now valid |
| mixed | some lines with `role`, some without | `422 INVALID_INPUT` | unchanged |

A single line by role whose input is the one the other role holds is `422` with `details.reason: MIC_ON_BOTH_INPUTS` (E11); two microphones trade roles through operation 80 or through the two-line form, as today. (DRIVER DECISION D-3.)

Effect on a complete selector: every body that is valid today gives the same selector and the same audit rows. Additional: one role of a complete selector can now be replaced alone. The clients keep sending the two-line form whenever the other role holds a line (section 6), so their tests on the seeded selector do not change.

### 4.3 `unassign` and an assignment in one body (AD-10 (3))

| Case | Where refused | Answer |
|---|---|---|
| a slot is in `unassign` and is the `trackId` of a line of `cameras`, or the `role` of a line of `mics` | the schema (a rule on the body object) and `checkCaptureConfigUpdate` | `422 INVALID_INPUT`, path `unassign` |
| a slot is in `unassign` and a line of `mics` WITHOUT `role` edits the input that slot holds | the hosted action (the schema cannot know which role holds an input) | `422 INVALID_INPUT`, `details.reason: SLOT_UNASSIGNED_AND_ASSIGNED` (N17) |
| a slot twice in `unassign`; an unknown slot; an empty list | the schema | `422 INVALID_INPUT` |

Order inside the action: `unassign` first, then `cameras`, then `mics`; the rules of the selector as a whole (`assertSelector`, `SH/sim/capture-config.ts:75`) are held on the result. `unassign` assigns nothing, so `assertAssignable` of the route has no device to ask for it (row 27 B19).

### 4.4 Audit rows of the action (AD-10 (1); all of type E10, keys of today's list)

| Edit | Rows | Members beside `operationId` and `permission` |
|---|---|---|
| `unassign` of a video slot that holds a device | 1 | `scope: 'CAMERA'`, `field: 'SOURCE'`, `trackId`, `from: <the device cleared>`; `to` and `deviceId` absent |
| `unassign` of a microphone slot that holds an input | 1 | `scope: 'MIC'`, `field: 'SOURCE'`, `inputId: <the input cleared>`, `from: <the device cleared>`; `to` and `deviceId` absent |
| `unassign` of an empty slot | 0 | nothing changes |
| an assignment into an empty slot | 1 | as today, with `from` ABSENT (today `SH/sim/capture-config.ts:137` writes the new device there) and `to`, `deviceId` the new device |
| an assignment over a held slot | as today | `from` the device that held the slot |

`to` and `deviceId` absent on a cleared slot is DRIVER DECISION D-1 (the security check asks for "the track or input and `from`"; no line names a device after the clear).

### 4.5 The meters after an edit (site C12)

`state.audio.inputs` holds one frame per line of the new selector and no other key; `state.audio.activeInputId` is `micInputOfRole(mics, 'PRIMARY')`, hence `null` without a PRIMARY line. For two complete pairs (before and after) the frames move by channel as today. This needs the shape of section 8.

## 5. Register: the start, the pre-check item (rows 163, 30, 167, 169, 28)

### 5.1 Names

| # | Identifier | Declared in (writer) | Type / shape | Read by | Mark |
|---|---|---|---|---|---|
| E26 | `isOwnCaptureCoreState` | `SH/sim/core-facts.ts:230` | `(state) => boolean`: "the one reader of: is this a Core in its own capture". It is the marker blueprint 8.1 rule (2) asks row 163 to find. True: the item N7 and the refusal N9 apply. False (Simulated lane, in-app simulator): today's behaviour, by C21 (6) | 163, 30, 33 | EXISTING |
| N10 | `unassignedSlotsOf` | `SH/sim/capture-notices.ts` (163) | `(selector: { cameras: readonly { trackId: VideoTrackId }[]; mics: readonly { role: MicRole }[] }) => CaptureSelectorSlot[]`, in the order of N2. A slot is unassigned when no line names its track or its role | 163, 30 | NEW |
| N11 | `CAPTURE_START_REQUIRED_SLOTS` | `SH/sim/capture-notices.ts` (163) | `readonly CaptureSelectorSlot[]` = `['VIDEO-01', 'VIDEO-02', 'PRIMARY']`. The slots without which the shared start is refused and whose item is BLOCK. `STANDBY` is not in it (C21 (8)). See section 9, point R-1 | 163, 30, 33 | NEW |
| N7 | `CaptureStartRule.SOURCE_NOT_ASSIGNED` | member of the EXISTING object `SH/sim/capture-notices.ts:357` (163) | `'sourceNotAssigned'`: `params.rule` of the item and the suffix of the text key | 163, 167, 169 | NEW member |
| N8 | `SOURCE_NOT_ASSIGNED_PRECHECK_VALUE` | `SH/sim/capture-notices.ts` (163) | `'NOT_ASSIGNED'`: `value` of the item. Precedent of the word: `WEB/features/devices/camera-preview.tsx:75` (`data-state`) | 163, 167, 169 | NEW |
| N12 | `unassignedSlotOfPrecheckItem` | `SH/sim/capture-notices.ts` (163) | `(item: Pick<PrecheckItem, 'value' \| 'status' \| 'params'>) => CaptureSelectorSlot \| null`: the slot when `value` is N8, `params.rule` is N7 and `params.slot` is one of N2. One recogniser for both clients, so that neither writes its own | 167, 169 | NEW |
| N9 | `CAPTURE_SOURCE_NOT_ASSIGNED_REASON` | `SH/sim/capture-notices.ts` (163) | `'CAPTURE_SOURCE_NOT_ASSIGNED'`: `SimTransitionError.reason`, which the Core answers as `details.reason` of `409 INVALID_STATE` with no further code (`CS/engine/errors.ts:118-131` copies a named reason). Declared in this file and not in `SH/sim/vocabulary.ts`, so row 163 does not need the `sh-hot` file | 163, 33 | NEW |
| E25 | `startRecordingTransition`, `audioSourceAtStart`, `evaluatePrecheck`, `unreachableSource` | `SH/sim/session-machine.ts:784,754,489,470` | names kept; bodies changed by row 163 (sites C1, C2, C4, C5) | 30, 33 | EXISTING |
| E27 | `SimTransitionError`; `SimErrorCode.ILLEGAL_STATE`, `.INVALID_INPUT` | `SH/sim/errors.ts:62,12,38` | the form of both refusals of the package | 162, 163 | EXISTING |
| E28 | `CaptureSourceReachability`, `captureReachabilityOf` | `SH/sim/capture-notices.ts:367,392` | unchanged. The unreachable form needs a `deviceId: string`, so the new item is NOT a row of it (row 27 section 4) | 163 | EXISTING |
| E29 | `PrecheckReasonCode` | `SH/sim/vocabulary.ts:598` | not moved. The item carries `reasonCode: null` and a `params.rule`, as the unreachable item and the two notes do (`SH/sim/core-facts.ts:237,254`) | - | EXISTING |
| E30 | `assertRecordableSelector`, `CapturePlanReason.SELECTOR_SHAPE`, `SOURCE_KIND_NOT_RECORDABLE` | `CS/modules/capture-config/plan.ts:120,61`; `CS/capture-session/index.ts:120` | unchanged: "exactly four" at the real start (AD-10 (4)). The second line behind N9 | 33 | EXISTING |
| E31 | `advanceCaptureStart` | `SH/sim/capture-session.ts:301` (site C7) | name kept; the failure rule loses `cameras.length > 0`, so zero camera lines end as the existing "no camera connected" failure | 163 | EXISTING |

### 5.2 The item

Produced by `evaluatePrecheck` only when `isOwnCaptureCoreState(state)` and the slot of the item is in `unassignedSlotsOf(selectorInForce(state))`. Checked before every other rule of that item (before the lens state, before the reachability row, before the level).

| Check id | Slot | Status | Item |
|---|---|---|---|
| `LENS_1` | `VIDEO-01` | BLOCK | `{ status, value: 'NOT_ASSIGNED', reason: '<slot>: source not assigned', reasonCode: null, params: { rule: 'sourceNotAssigned', slot: '<slot>' } }` |
| `LENS_2` | `VIDEO-02` | BLOCK | the same |
| `MIC_PRIMARY` | `PRIMARY` | BLOCK | the same |
| `MIC_STANDBY` | `STANDBY` | WARN (C21 (8); it is not a note: it is counted and acknowledged as a warning) | the same |

The status is `BLOCK` when the slot is in N11, else `WARN`. The item carries no `deviceId` and no `deviceKind`: there is no device. `CS/capture-notices/precheck.ts` is not edited (row 30).

Where the marker is false the four items are computed as today: PASS READY for an unassigned video slot, WARN NO_SIGNAL for an unassigned role (row 27 section 4). That is C18 (1) and C21 (6), word for word.

### 5.3 The start refusal

In `startRecordingTransition`, after the two existing requirements and before the audio pair is read: when `isOwnCaptureCoreState(state)` and a slot of N11 is in `unassignedSlotsOf(state.captureConfig)`:

`throw new SimTransitionError(session.state, 'startRecording', 'a capture source is not assigned', SimErrorCode.ILLEGAL_STATE, CAPTURE_SOURCE_NOT_ASSIGNED_REASON)`

The Core answers `409 INVALID_STATE`, `details: { simCode: 'ILLEGAL_STATE', from: 'ARMED', event: 'startRecording', reason: 'CAPTURE_SOURCE_NOT_ASSIGNED' }`. No audit row, no state change. No text key and no entry of `SIM_REFUSAL_REASON_TEXT` (`CS/engine/errors.ts:113`): the sentence is the general one of the code; a client that honours the BLOCK item does not reach this answer.

`audioSourceAtStart` reads by role with no stand-in (N4). When either role has no line it states no pair: the session's `audioSource` is left absent (the member is nullable and optional on the wire, `SH/api/state-slices.ts:422-430`; `openSessionAudioSource`, `SH/sim/selector-in-force.ts:110`, already reads "an open session that states none"). Reached only in Simulated mode, or in the pending state of a real start that `plan.ts:124` then refuses. (DRIVER DECISION D-4.)

### 5.4 Text keys

| # | Key | File (writer) | English text | Read by | Mark |
|---|---|---|---|---|---|
| N13 | `common.captureNotice.start.sourceNotAssigned` | `SH/i18n/en/common.ts`, in the block at `:859` (28) | `'{{slot}} has no source assigned. Assign one on Devices.'` (one sentence for BLOCK and WARN; it promises nothing about the start) | 167, and 169 if it reads the shared key | NEW |
| N14 | `common.captureSlot.VIDEO-01`, `.VIDEO-02`, `.PRIMARY`, `.STANDBY`, `.notAssigned`, `.assign`, `.assignLabel` | `SH/i18n/en/common.ts`, a new block (28) | `'Camera 1'`, `'Camera 2'`, `'Primary microphone'`, `'Standby microphone'`, `'Not assigned'`, `'Assign'`, `'Assign a source to {{slot}}'` | 31, 32, 167, 169 | NEW (7 keys) |
| N15 | `features.capture-selector.notice.start.sourceNotAssigned` | `MOB/features/capture-selector/i18n.ts`, in the block at `:209` (169) | the text of N13, as the mobile copy of the other start-rule sentences | 169 | NEW |
| E32 | `common.captureNotice.start.*` (8 keys) | `SH/i18n/en/common.ts:859-869` | unchanged; `notRecordable` (`:868`) is not used for this item (addendum 1.4 #6) | 167 | EXISTING |
| E33 | `devices.selector.notAssigned`; `features.capture-selector.selector.sheet.notAssigned` | `SH/i18n/en/devices.ts:313`; `MOB/features/capture-selector/i18n.ts:81` | `'Not assigned'` both; a row may keep reading its own. N14 exists because rows 31 and 32 do not own these two files | 31, 32 | EXISTING |

All new shared strings are in `common.ts`, the one i18n file in row 28's ownership area; the mobile workspace already reads `common.*` (192 call sites counted). (DRIVER DECISION D-5.)

### 5.5 The clients' closed lists

| # | Identifier | File (writer) | Change | Mark |
|---|---|---|---|---|
| E34 | `CAPTURE_START_RULES` | `WEB/lib/capture-notices.ts:217` (167) | gains `'sourceNotAssigned'` (7 to 8 members). `unreachablePrecheckOf` (`:237`) stays as it is: the new item is found by N12, not by a device id | EXISTING |
| E35 | `START_RULES` | `MOB/features/capture-selector/capture-notices-model.ts:141` (169) | the same | EXISTING |

## 6. Register: the selector screens (rows 31, 32; C18 (3))

| # | Identifier | File (writer) | Shape after the row | Mark |
|---|---|---|---|---|
| E36 | `micPairFor` | `WEB/features/devices/capture-selector.ts:222` (31) | name kept; result `readonly MicPairLine[] \| null` of 1 or 2 lines: the two-line pair when the other role holds a line (today's body, so the seeded tests do not move); ONE line by role when the other role is empty; `null` only when the microphone chosen is the other role's | EXISTING |
| E37 | `micLineCommand`, `SelectorCommand` | `MOB/features/capture-selector/capture-selector-model.ts:211,276` (32) | names kept; the two `null` answers for an empty other role (`:217`, `:220`) become N16 | EXISTING |
| N16 | `SelectorCommand` kind `'micRole'` | the same file (32) | `{ readonly kind: 'micRole'; readonly role: MicRole; readonly inputId: string }`: operation 78 with `mics: [{ inputId, deviceId: inputId, role }]` | NEW |
| E38 | `cameraRows`, `micRows` | `MOB/features/capture-selector/capture-selector-model.ts:91,105` (32) | always 2 + 2 rows in the order of N2; a row of an empty slot has `deviceId: null` and the offer | EXISTING |
| - | the web panel's two `map` calls | `WEB/features/devices/capture-selector-panel.tsx` (31; site W1) | the same four rows; the row model's name is the row's own, it is read by no other row | - |

A row of an empty slot shows `common.captureSlot.notAssigned` (or the workspace's own E33) and the offer `common.captureSlot.assign`; the command it builds is the camera command of today for a track, and `micPairFor` / `micLineCommand` for a role. No screen sends `unassign` unless it draws a control for it; the first-boot procedure uses the web console (blueprint decision 2).

## 7. The 24 files of the positional function: what each asks, what replaces it

Q1 = "which input is meter channel n" -> `meterInputOfChannel` (N5), `null` handled as stated. Q2 = "which channel is this input" -> `channelOfMicLine` (E20), already nullable. Q3 = "which input holds a role" -> `micInputOfRole` (N4).

| # | File | Row | Site | Lines (at reading) | Asks | Replacement, and the answer for `null` |
|---|---|---|---|---|---|---|
| 1 | `SH/sim/audio.ts` | 164, then 172 | C15, C16 | `:84`; `:290`; `:377`; definition `:78-80` | Q2 body; Q1; Q3 | `:84` re-based on N5; `:290` no frame is generated for a channel without an input; `:377` N4 with PRIMARY, `null` when none. Row 172 deletes `:78-80` |
| 2 | `SH/sim/capture-config.ts` | 162 | C12 | `:230`, `:246`; `:238-239`; `:240` | Q1; Q1; Q3 | N5, a channel without an input moves no role; the frames as section 4.5; N4 |
| 3 | `SH/sim/session-machine.ts` | 163 | C2 (with C5) | `:760-761`; `:514`, `:991` | Q3; Q2 | N4 for both roles, no stand-in (5.3); `:514` and `:991` keep E20 (`:991` keeps its channel label `?? 'AUDIO-01'`: a label of the timeline, not an input) |
| 4 | `SH/sim/api.ts` | 165 | C24 (with C23) | `audioInputs` (`:377`); `videoTracks` (`:355`) | Q1 | N5; a channel without an input gives no entry; a track without a line gives `sourceDeviceId: null` (section 8) |
| 5 | `SH/sim/faults.ts` | 165 | C17 | `:238`, `:351`, `:618` | Q1 | N5; `null`: no write, no frame read |
| 6 | `SH/sim/health.ts` | 165 | C17 | `:165` | Q1 | N5; `null`: the level of an input without a frame, as the function already has for `undefined` |
| 7 | `SH/sim/react.ts` | 165 | C17 | `:111` | Q1 | N5; `null`: `undefined` frame |
| 8 | `SH/sim/capture-telemetry.ts` | 165 | C22 | `:196`; `:192` | Q2 | E20 and E21, names unchanged; the file holds 0 names of the positional function today and stays in the count because it goes through its inverse |
| 9 | `CS/modules/devices/status.ts` | 150 | B11, B12, B13 | `:170`; `:206`; `:130` | Q1; Q3; by track | N5, no entry for `null`; N4 with PRIMARY, `null` when none and no frame states one (the `'MIC-01'` of `:206` goes); `sourceDeviceId: slot?.deviceId ?? null`. `BUILTIN_SLOTS` for a state without a slice (B10) stays |
| 10 | `WEB/features/session-new/devices-step.tsx` | 167 | W3 | `:317`, `:319` | Q1; the pair | N5, `null`: no meter label for that channel; E24 (by role after row 164) |
| 11 | `WEB/features/session-monitor/audio-panel.tsx` | 168 | W4 | `:64`, `:69`, `:71` | Q1 | N5; `null`: the empty state of the row, no role chip, no source marks |
| 12 | `WEB/features/session-monitor/audio-source.ts` | 168 | W6 | `:171`; `:144` | Q1 of a fault target; the active input | N5, `null`: no input named for the fault; `selectActiveInputId` (`:144`) answers `string \| null` |
| 13 | `WEB/features/devices/audio-input-card.tsx` | 168 | W5 | `:61`, `:64` | Q1 | N5; `null`: the card's empty state; the comparison with E22 only for a non-null input |
| 14 | `WEB/components/composed/dbfs-meter.tsx` | 168 | W5 | `:198` | Q1 | N5; `null`: `undefined` frame, the meter's no-input drawing |
| 15 | `MOB/features/session-new/device-previews.tsx` | 169 | M3 | `:118` | Q1 | N5; `null`: no level is read |
| 16 | `MOB/features/session-live/mic-source-model.ts` | 170 | M4 | `:144`, `:183`, `:197`; `:151` | Q1; the active input | the local `inputOfChannel` answers `string \| null` through N5; `selectActiveInputId` answers `string \| null` |
| 17 | `MOB/features/session-live/mic-card.tsx` | 170 | M4 | `:139`, `:168` | Q1 | N5; `null`: the card's absent state |
| 18 | `MOB/features/session-live/use-mic-source.ts` | 170 | M4 | `:92`, `:105` | through file 16 | follows the two nullable answers of file 16; it names the function nowhere (the 24th file of row 27) |
| 19 | `MOB/features/capture-selector/source-state.ts` | 171 | M5 | `:81`, `:101` | Q1 | N5; `null`: the source state "no input" |
| 20 | `MOB/features/dashboard/device-tiles.tsx` | 171 | M5 | `:168` | Q1 | N5; `null`: the tile's empty state |
| 21 | `MOB/features/dashboard/use-home-data.ts` | 171 | M5 | `:210`, `:341` | Q1 | N5; `null`: no role for the tile |
| 22 | `MOB/features/devices/device-mic-meter.tsx` | 171 | M6 | `:59` | Q1 | N5; `null`: the meter's empty state |
| 23 | `MOB/features/devices/sim-adapter.ts` | 171 | M6 | `:241` | Q2 | E20, name unchanged |
| 24 | `MOB/runtime/use-audio-shared-values.ts` | 171 | M6 | `:98` | Q1 | N5; `null`: `undefined` frame |

Count: 24 files of 24 (shared 8, core-server 1, core-web 5, mobile 10), each with its row of blueprint 8.1. Test files that name the function move with their subjects; row 172's static test then holds the four trees to 0.

## 8. Contract shapes that must admit "absent"

Rows 150, 162 and 165 cannot answer "no source" through schemas that require a value. These are EXISTING schemas; the change is a widening only.

| # | Identifier | File:line | Today | Shape the package needs | Needed by |
|---|---|---|---|---|---|
| E39 | `VideoTrackStatusSchema.sourceDeviceId` | `SH/api/core-api.ts:390`, member at `:399` | `z.string().min(1)` | `.nullable()`: `null` for a track without a line. `tracks` stays `length(2)` | 150 (B11), 165 (C23) |
| E40 | `AudioStatusResponseSchema` | `SH/api/core-api.ts:450` | `channels` `.length(2)`; `activeInputId` a required `MIC-NN` | `channels` `.max(2)`: one entry per meter channel that has an input (an entry IS an input, `AudioChannelStatusSchema` `:422` unchanged); `activeInputId` `.nullable()` | 150 (B12, B13), 165 (C24) |
| E41 | `AudioSliceSchema`; `SimState['audio']` | `SH/api/state-slices.ts:611`; `SH/sim/types.ts:668` | `inputs` exactly two keys; `activeInputId` a required `MIC-NN` | `inputs` at most two keys; `activeInputId: CaptureMicInputId \| null` | 162 (C12), 164 (`audio.ts:375-377`) |

On a complete selector every answer is byte-equal to today's. Entries omitted rather than three nullable members of an entry is DRIVER DECISION D-2 (fewer nullable members for the clients to follow). **No row of WP-13a owns `SH/api/core-api.ts` or `SH/api/state-slices.ts`: section 9, point R-2.**

## 9. For the controller

**R-1. An unassigned STANDBY in real capture: C21 (8) and the cells of rows 30, 33, 163.** As registered (C21 (8) taken literally): the item is WARN, the shared start does not refuse for it (N11 holds three slots). The real start is still refused, by `plan.ts:124` (`SELECTOR_SHAPE`, AD-10 (4), state S-5 of the security check), which no row edits. So: (a) security is unchanged and the 21 states of row 33 keep "start refused" in both real columns; (b) an operator can acknowledge the STANDBY warning and then meets a `409` worded "not recordable"; (c) the verification cells "one BLOCK item per unassigned slot" of rows 30 and 163 hold for three slots, not four, and C18 (1) "an unassigned slot makes the pre-check item BLOCKING" is narrowed by C21 (8) for this one slot. If the controller wants BLOCK for STANDBY in real capture too, the change is one value: `'STANDBY'` added to N11; no other name moves. Either ruling leaves Simulated mode as it is.

**R-2. Two contract files without a writer.** Section 8 needs three schema widenings in `SH/api/core-api.ts` and `SH/api/state-slices.ts`, the generated description regenerated once more, and the type of `SimState['audio'].activeInputId` in `SH/sim/types.ts` (`sh-hot`, row 28). Recommended: row 28 carries all of it (it already regenerates `openapi.json`); rows 150, 162, 164 and 165 then build against a schema that accepts their answers. The nullable `activeInputId` is also read outside the package's file map: `SH/live/source/live-sim.ts:914`, `SH/sim/api.ts` (two reads, row 165's file), `WEB/features/dashboard/devices-panel.tsx:49`, and two test harnesses (`WEB/runtime/testing/live-harness.ts:399`, `MOB/features/session-live/testing/live-monitor-bed.tsx:284`): the typecheck names them; each is a one-line follow of the type and needs an owner or a file request.

**Blueprint cells that C21 (6) moves (not edited by this row):** row 163 "start: refused for each incomplete selector category" reads "in a state of real capture"; the four cells of row 33's column `SIMULATED`, categories 1 to 4, read "boots; a start is accepted as today" (with zero camera lines it then ends as the existing no-camera failure, E31).

**Driver decisions to confirm:** D-1 the audit row of a cleared slot carries `from` and neither `to` nor `deviceId` (4.4). D-2 an audio channel without an input gives no entry (section 8). D-3 a single line by role that names the other role's input is `422 MIC_ON_BOTH_INPUTS` (4.2). D-4 a session started on an incomplete microphone pair states no `audioSource` (5.3). D-5 the new shared strings are in `common.ts` (5.4).

## 10. Pins a name moves

| Pin | Moved by | Rows |
|---|---|---|
| The body schema of operation 78 and its generated description in `packages/shared/openapi/openapi.json` | N1, the reworded `role` of E4 | 28 |
| Tests of the body and of the document: `packages/shared/test/api-registry.test.ts`, `openapi.test.ts`, `api-openapi-scope.test.ts`, `api-domain-operations.test.ts`, `sim-api.test.ts`, `sim-capture-config.test.ts`, `live-source-bindings.test.ts` (the files that name the operation or its body; found by search, not run) | N1 | 28, 162, 165 |
| `CaptureStartRule` (5 to 6 members): `packages/shared/test/sim-capture-notices.test.ts` | N7 | 163 |
| The two client lists (7 to 8 members): `MOB/features/capture-selector/capture-notices-model.test.ts`; no web test file names the web list | N7 | 167, 169 |
| Label-sync of `SH/i18n/en/common.ts` (key sets of the locales, if a test holds them) | N13, N14 | 28 |
| If R-2 is accepted: the three schemas of section 8, their examples, and the description once more | E39 to E41 | 28 |

Not moved: operations 97; audit types (no type added; `AuditType`, its category map and `CS/core/audit-details.ts` unchanged); permissions 14; `PrecheckReasonCode`; `CAPTURE_CONFIG_CHANGE_OPERATIONS` and the two tables beside it; `SIM_REFUSAL_REASON_TEXT`; the three fence files.

**Database pins moved by a name of this register: 0.** No value set is added or widened: the slot names of `unassign` are the track and role values of the request, not the stored set `CAPTURE_SOURCE_SLOT` (`'MIC-PRIMARY'` / `'MIC-STANDBY'`, `SH/evidence-package/source-class.ts:45`, `CS/capture/fence/sources.ts:34`), which stays the vocabulary of `session_capture_sources` alone; the pre-check item has no reason code of the stored closed set; the schema version, the tables, the CHECKs and the grants are row 17's (set A).

## 11. Count

| | EXISTING | NEW |
|---|---|---|
| Entries of this register | 40 (E1 to E17, E19 to E41; the number E18 is not used) | 17 (N1 to N17) |
| of which the six names of the row's verification | the value `null`; the four slot values | N4 with N5, N2 with N3, N7, N13, N9 |

An EXISTING entry may group identifiers that are declared together and move together (for example E17: the three functions of the row mapping); the identifiers inside the entries were not counted singly. Of the NEW entries only N14 is a group (7 text keys).

Writers of the NEW names: row 28: N1, N2, N3, N13, N14. Row 164: N4, N5, N6. Row 163: N7 to N12. Row 169: N15. Row 32: N16. Row 162: N17. The members added to the two client lists (rows 167, 169) are counted with E34 and E35.

## 12. Alternatives not taken, assumptions, gaps

| Alternative | Why not |
|---|---|
| The slot names of `unassign` taken from `CAPTURE_SOURCE_SLOTS` (`MIC-PRIMARY`, `MIC-STANDBY`) | they are a stored value set; the rule of 4.3 compares a slot with `trackId` and `role` of the same body, which use the bare role |
| The reason code in `SH/sim/vocabulary.ts` | a hot file of other packages; the constant has no closed set to join (the existing `CAPTURE_NOT_DURABLE` is a plain constant too, `SH/sim/session-machine.ts:95`) |
| The item as a row of `captureReachabilityOf` | that form needs a device id and both clients drop a row without one (row 27 section 4) |
| The real-capture marker as the `capture` parameter of `startRecordingTransition` | `evaluatePrecheck` has no such parameter; one marker for the item and the refusal is `isOwnCaptureCoreState` |
| A meter channel for a lone line, by its role | that is the amendment of D137 that C21 (7) declined |

Assumptions: the Core in real capture states `time.hostClock` or `security.platformNotReported` before the first pre-check (the comment of `SH/sim/core-facts.ts:224-229` says "at every start and at every health tick"; not run). The pre-check `value` is not held by a stored value set (searched `CS/db/schema/value-sets.ts` and the slice schemas: no list of values found; row 163's targeted tests confirm).

Gaps: nothing was built or run; line numbers are those of the working tree between 22:50 and 23:20 WIB while other rows were writing. No double is involved and nothing here goes to the hardware package. External research: no dimension in scope.

## 13. Rows unblocked by this register

| Dependency | Rows |
|---|---|
| By build (`161:B`) | **28**, **164** |
| By contract (`161:C`), each also waiting for 28 or 164 by build | 31, 32, 163 |
| Through 28 and 164 (the package's level 3) | 150, 162, 165, 167, 168, 169, 170, 171 |
| Not waiting for it | 166 (started beside it); 173 is skipped (C21 (9)) |

Rows 28 and 164 can start now (row 164's one line that writes a null `activeInputId`, `SH/sim/audio.ts:375-377`, waits for the type of section 8). Rows 150, 162 and 165 should not write their "absent" answers before R-2 has an owner; R-1 changes one value and blocks no start.

---
*Generated: 2026-10-12 23:35 WIB*
*Last Updated: 2026-10-12 23:35 WIB*
