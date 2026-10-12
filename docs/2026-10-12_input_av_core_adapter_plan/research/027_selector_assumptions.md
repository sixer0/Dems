---
task_id: 2026-10-12_input_av_core_adapter_plan
task_slug: input_av_core_adapter_plan
date: 2026-10-12
agent: data-analyst
row: 27 ([M2|WP-13a])
type: measurement (research; docs only)
narrative_tier: 2
confidence: HIGH for every line cited (opened in this pass); MEDIUM for "what happens with a NULL" where it is derived by reading and not by a run (nothing was run)
baseline: branch task4/input-av-core-port at 2307e9dc; `git diff cf2f8008 2307e9dc -- apps packages` is empty, so the lines of the addendum and of the security check still hold
closes: the three NOT VERIFIED facts of masterplan/04_design_addendum.md 1.4 #4, #5, #6 and section 12; the reader inventory AD-04 asks for (verification/04_security_addendum.md 3.2)
last_updated: 2026-10-12 22:40 WIB
---

# Row 27: what assumes that every selector slot is assigned

Abbreviations: `CS` = `apps/core-server/src`, `SHARED` = `packages/shared/src`, `WEB` = `apps/core-web/src`, `MOB` = `apps/mobile/src`.

## 0. Summary

| Question | Answer | Where |
|---|---|---|
| 1. The simulator's session-start action | `startRecordingTransition`. It has **no check of the selector at all**. On an incomplete selector it starts, names microphones the selector does not hold, and the simulated capture then turns durable with zero cameras | `SHARED/sim/session-machine.ts:784-830`, `:754-769`; `SHARED/sim/audio.ts:78-80`; `SHARED/sim/capture-session.ts:305-311` |
| 2. Client files that assume the lines are there | No client reads a column or a row member. Almost every client reader finds a line by track, role or input and tolerates its absence. What fails is different: **both selector screens draw one row per existing line, so an absent line has no row and no way to assign it**, and both microphone commands return "nothing to send" unless both roles are held. A second group shows a default input (`MIC-01`, `MIC-02`) for a channel that has no line | section 3 |
| 3. The pre-check of the capture notices | The server file is a gate that asks the configured devices before the action; it does not evaluate the items. The evaluation is in `SHARED`. Today an unassigned video slot is **PASS**, an unassigned microphone role is **WARN "no signal"** (it can be acknowledged). No item says "not assigned" and none says "not recordable" | `CS/capture-notices/precheck.ts:171-173,199-205`; `SHARED/sim/session-machine.ts:470-480,496-523`; `SHARED/sim/capture-notices.ts:392-431` |
| AD-04 inventory | 9 code sites in 7 files name the six columns or the six row members; 5 of them are not null-safe (4 fail at run time, 1 is a type only). `WEB` and `MOB`: 0 sites. Two of the four stop the boot | section 4 |

Counts, taken from the tables below: column and member sites 9, not null-safe 5. Slice readers classified 71 (CS 22, SHARED 26, WEB 12, MOB 11), not safe 31 (CS 3, SHARED 16, WEB 6, MOB 6).

**Three things the controller should read before rows 28 to 32 start** (section 6): the pre-check change is in `SHARED`, not in the server folder row 30 names; the central positional rule is `micInputOfChannel`, which AD-04 (2) does not list and which 24 files in the four workspaces go through; and the meaning of "a meter channel without a line" is a design decision nobody has taken yet.

## 1. Method and limits

Read-only. Text search with `grep` over the four workspaces, then every hit opened at its lines. Nothing was built, started or run; no suite; no database. Nothing under `apps/input-av/` was opened; no `.env`. The Graft graph was not queried (plain search was enough and writes nothing).

Search for the columns and members, the same pattern row 149 can pin:

```
video_01_device_id|video_01_profile|video_02_device_id|video_02_profile|mic_primary_id|mic_standby_id|
video01DeviceId|video01Profile|video02DeviceId|video02Profile|micPrimaryId|micStandbyId
```

over `apps/core-server`, `packages/shared`, `apps/core-web`, `apps/mobile`, and once over the whole repository without `docs`, `graft`, `node_modules`, `dist`, `apps/input-av`. Result: hits only under `apps/core-server` and `packages/shared`. `apps/core-web`, `apps/mobile`, `apps/capture-worker`, `apps/mock-core`, `apps/transcriber`, `packages/capture-protocol`, `scripts/`, `src/`: 0 files.

Verdict words. **NOT SAFE** = with an unassigned slot the site throws, refuses a legitimate edit, or states a device, input or result that the selector does not hold. **SAFE** = it does not, whatever it then shows. A SAFE site can still need a change for wording; that is said in the note.

What "unassigned" looks like at each layer (addendum 1.4 #2): a NULL column, an absent line of the slice. For a microphone this needs one more sentence, because a microphone line's `inputId` is its `deviceId` (`SHARED/sim/capture-config.ts:118`, decision D106 (4)): an unassigned PRIMARY is "no line with `role: PRIMARY`", not a line with an empty device.

Not verified here: any behaviour by a run. Each "what happens" below is read from the code.

## 2. Fact 1: the simulator's session-start action

**Finding.** The action is `startRecording`, bound at `SHARED/sim/actions.ts:164` to `startRecordingTransition` (`SHARED/sim/session-machine.ts:784-830`). It requires an operator and an ARMED session (`:785-786`) and nothing else. The selector is read twice, both without a check:

| Step | Line | With an incomplete selector |
|---|---|---|
| The audio pair of the session | `session-machine.ts:791` calls `audioSourceAtStart` (`:754-769`) | A missing role falls back to the line at that channel's position, and that falls back to a constant: `micInputOfChannel` answers `mics[index]?.inputId ?? DEFAULT_MIC_INPUT_OF_CHANNEL[channel]` (`SHARED/sim/audio.ts:78-80`, the table at `:53-56`). With no microphone line the session states `activeInputId: 'MIC-01'`, `standbyInputId: 'MIC-02'`: two inputs the selector does not name. With only a STANDBY line that line becomes the **active** input (`:760`) |
| The snapshot | `session-machine.ts:800` calls `captureConfigSnapshot` (`:738-746`) | Copies whatever is there; an empty list is copied as an empty list |
| The decision of the simulated start | `advanceCaptureStart`, `SHARED/sim/capture-session.ts:305-311` | The failure rule is `cameras.length > 0 && missing.length === cameras.length` (`:307`). With zero cameras it is false: the session turns durable. A recording with no source |

It does not throw. The security check's worry (a throw before the refusal, hence a `500`, `04_security_addendum.md` 3.1 last paragraph) does not occur: `audioSourceAtStart` has no throwing path.

**Why it matters.** In `SIMULATED` nothing else refuses: the server's own refusal is `recordingStartedIn`, which returns at once when capture is not real (`CS/capture-session/index.ts:611`), so `assertRecordableSelector` (`CS/modules/capture-config/plan.ts:120-126`) is never reached there. Addendum 1.5, column `SIMULATED`, rows 1 to 4 ("boots; start refused") is therefore not true today; it becomes true only with 1.4 #4.

In the two real operations the refusal exists and runs after the transition inside the same unit: the invented pair of `audioSourceAtStart` is in the pending state, `plan.ts:124` throws `SELECTOR_SHAPE`, `CS/capture-session/index.ts:625` turns it into `409 INVALID_STATE`, the unit rolls back. Safe, as the security check derived.

**The refusal to add** goes into `startRecordingTransition` before `:791`, as a `SimTransitionError` with `SimErrorCode.ILLEGAL_STATE` (the form `:839` already uses for a `409 INVALID_STATE` with a `details.reason`). Then `audioSourceAtStart` is only ever called with a complete pair and its two fallbacks (`:760-761`) can go, which is AD-04 (2).

**The hosted action `setCaptureConfig`** (the security check's reader 9, verified again): `setCaptureConfigTransition`, `SHARED/sim/capture-config.ts:152-264`.

| Line | What it assumes | With an absent line |
|---|---|---|
| `:163-165` `assignCamera` | a line for the track exists | throws "the selector has no such video track": a slot, once unassigned, cannot be assigned again. Operations 78 and 79 both go through it (`:180`, `:205`) |
| `:190-199` microphone line without `role` | a line for the input exists | throws "the selector has no such mic input" |
| `:107-140` `replaceMicPair` | exactly two new lines (`:112`); compares with the held pair | Works from an empty or half selector, and is today the only way a microphone gets back in. But the audit row says `from: before?.deviceId ?? mic.deviceId` (`:137`): for an empty slot `from` is the **new** device. AD-10 (1) wants `from` to be what was there |
| `:208-214` `PRIMARY_MIC` | the input is a line | not found is the action's 404; correct |
| `:75-84` `assertSelector` | reads two lines by position, each guarded by `undefined` | no throw; the two rules simply do not apply to a single line |
| `:227-240` meters re-key | a line per channel, by position, default otherwise (`micInputOfChannel`) | keys the meters by `MIC-01` / `MIC-02` for a channel without a line |
| no `unassign` | - | `CaptureConfigChange` has three kinds and no member to clear a slot (`SHARED/sim/types.ts:869-872`) |

The body check of the in-app simulator refuses an unknown member: only `cameras` and `mics` (`SHARED/sim/api.ts:678-679`), each of 1 or 2 lines (`:683`, `:704`). The contract schema is a strict object with the same two members (`SHARED/api/devices.ts:144-149`).

## 3. Fact 2: the clients

**Finding.** `captureConfig` is named by 43 non-test files: `SHARED` 20, `WEB` 12, `MOB` 11 (the addendum counted 42). Files that read the **lines** of the selector, directly or through the shared helpers: tables 5.3 and 5.4. None reads by a bare index into `cameras` or `mics`. Three patterns need a change.

**Pattern A: a row per existing line. No line, no row, no offer.**

| Workspace | Site | What it does |
|---|---|---|
| `WEB` | `features/devices/capture-selector-panel.tsx:525-536`, `:546-556` | `config.cameras.map(...)`, `config.mics.map(...)`: one `CameraSourceRow` / `MicRow` per line the Core sent |
| `MOB` | `features/capture-selector/capture-selector-model.ts:91-102`, `:105-115` (`cameraRows`, `micRows`), drawn at `capture-selector.tsx:174`, `:212-214`, `:244` | the same |

With an unassigned slot the screen shows three rows, or none, and nothing says a slot is empty. The "empty" state does not catch it: it needs the registry to be empty too (`capture-selector-panel.tsx:497`; `capture-selector-model.ts:224-226`).

**Pattern B: a microphone command only when both roles are held.**

| Workspace | Site | What it does |
|---|---|---|
| `WEB` | `features/devices/capture-selector.ts:222-229` `micPairFor`, called at `capture-selector-panel.tsx:312` | `if (mics.length !== 2) return null`; needs a line of the other role. Nothing is sent |
| `MOB` | `features/capture-selector/capture-selector-model.ts:211-221` `micLineCommand` | `standby === null ? null : ...` (`:217`), `primary === null ? null : ...` (`:220`) |

The contract agrees with them: a replacing pair is exactly two lines (`SHARED/api/devices.ts:120-126`; `SHARED/sim/capture-config.ts:112`). So with the contract as it is, a single microphone cannot be put into an empty selector by any client; both roles must be assigned in one body. That is a rule row 28 has to state, not only a client matter.

**Pattern C: a default input shown for a channel without a line.** Everything that asks "which input is meter channel n" goes through `micInputOfChannel` (`SHARED/sim/audio.ts:78-80`), which answers `MIC-01` / `MIC-02` when the line at that position is absent, and which makes a lone STANDBY line "channel 1". Call sites: `WEB` 5 files, `MOB` 10 files (tables 5.3, 5.4). The one that matters before a session is the pre-check screen: `WEB/features/session-new/devices-step.tsx:316-321` would label a meter "MIC-01" with no device behind it; `MOB/features/session-new/device-previews.tsx:118` reads that input's level.

**What already tolerates an absent line** (found by track, role, input or device, with `?.` and a null or empty answer): every other reader of tables 5.3 and 5.4. Supporting fact: a client's neutral state before the first replication is already an empty selector, `captureConfig: { cameras: [], mics: [], ... }` (`SHARED/live/source/neutral-state.ts:260`), and the wire schema bounds neither array (`SHARED/api/state-slices.ts:1114-1117`, addendum fact 8 confirmed).

**Why it matters.** The addendum's sequence for a first production boot, step (f) "assign the four slots" (1.4, last paragraph), cannot be done from either client as they are, and is refused by the hosted action for cameras (section 2). Rows 28, 31 and 32 carry it; the size is in the two selector screens and the two command builders, not in the many readers.

## 4. Fact 3: the pre-check

**Finding.** Two places, and the one the addendum names is not where the item is decided.

| Part | Where | What it does with an unassigned slot |
|---|---|---|
| The gate before the action | `CS/capture-notices/precheck.ts:147-276` | Reads the selector at `:171`, collects the device ids of its lines (`:172-173`), asks each. An absent line gives no id: nothing is asked, nothing is raised. No throw. `:199-205` then calls the shared start rule for the audit rows' `degraded` |
| The start rule | `SHARED/sim/capture-notices.ts:392-431` `captureReachabilityOf` | One row per **line**. With no camera line `noCamera` is true (`[].every`, `:398`) but no row is pushed, so nothing blocks. `noMic` is guarded by `mics.length > 0` (`:414`). An unassigned slot has no row |
| The items | `SHARED/sim/session-machine.ts:489-577` `evaluatePrecheck` | `LENS_1` / `LENS_2` (`:496-505`): the lens check reads the hardware slice `state.cameras`, then `unreachableSource(state, track)` finds no row and answers null (`:471-472`): **PASS, value READY**. `MIC_PRIMARY` / `MIC_STANDBY` (`:506-523`): no row, then `input` is null (`:513`), `track` null, and the item is **WARN, NO_SIGNAL** (`:516-517`), which an operator may acknowledge |

So today a pre-check on an all-unassigned selector shows two lens items PASS and two microphone items WARN, and can end "passed with warnings". In the real operations the start is then refused `409`; in `SIMULATED` it is not (section 2).

There is no "not recordable" pre-check item. The words exist as a client text (`SHARED/i18n/en/common.ts:857`) and in both clients' closed lists of rule suffixes (`WEB/lib/capture-notices.ts:217`; `MOB/features/capture-selector/capture-notices-model.ts:141`), but no non-test line of `CS` or `SHARED` writes `rule: 'notRecordable'` into an item (search for `notRecordable`: the fence, the adapters and the session start only, all of them the `409` at the start). The addendum's "worded 'source not assigned', not 'not recordable'" (1.4 #6) is about a wording that the pre-check never produced.

**What the change touches.** A BLOCK item for an unassigned slot is produced in `SHARED/sim/session-machine.ts` (`evaluatePrecheck`, or a row of `captureReachabilityOf` with a new rule). The existing unreachable form cannot carry it as it is: it needs a `deviceId` (`CaptureSourceReachability.deviceId: string`, `SHARED/sim/capture-notices.ts:370`), and both clients drop an item whose `params.deviceId` is not a device id (`WEB/lib/capture-notices.ts:242`). The closed sets that move: `CaptureStartRule` (`SHARED/sim/capture-notices.ts:357-363`) or `PrecheckReasonCode` (`SHARED/sim/vocabulary.ts:570`), the two client lists above, the text at `SHARED/i18n/en/common.ts:851-857` and the mobile copy at `MOB/features/capture-selector/i18n.ts:215`. `CS/capture-notices/precheck.ts` itself needs no change.

## 5. AD-04: the inventory

### 5.1 Sites that name a column or a row member (non-test source)

| # | Site | Reads or writes | With a NULL | Verdict |
|---|---|---|---|---|
| A1 | `CS/modules/capture-config/store.ts:46-53` (the statement), `:85-108` (`recordOf`) | reads, raw SQL and a hand-written parse | The statement is fine: `json_build_object` writes a JSON null. `text()` throws `CAPTURE_ROW_INVALID` on anything that is not a string (`:88-92`, used for all six at `:99-104`). `store.load` is the boot step `capture.config` (`CS/modules/capture-config/boot.ts:28,50`): **the Core does not start** | NOT SAFE |
| A2 | `CS/modules/capture-config/slices.ts:31-40` (the record type), `:97-123` (`captureConfigSliceOf`), `:82-89` (`micInputOf`) | reads | The type is six strings. `byId.get(null)` is undefined: throws `CAPTURE_DEVICE_UNKNOWN` (`:101-104`, `:108-111`); `micInputOf(null)` throws `CAPTURE_MIC_INPUT_UNKNOWN`. Same boot step | NOT SAFE |
| A3 | `CS/db/mapping/rows.ts:782-804` (`captureConfigToRow`) | **writes** | Two cameras by position (`:784`); a role, else the line at position 0 or 1 (`:785-786`); fewer lines throw `ROW_SHAPE` (`:787-789`). Called for every engine write that touches the selector (`CS/db/mapping/changes.ts:237-238`) and by `to-rows.ts:153`. Kept after a rewrite, the fallback writes a lone `VIDEO-02` line into the `video_01_*` columns and a lone STANDBY into `mic_primary_id` | NOT SAFE |
| A4 | `CS/db/mapping/rows.ts:906-931` (`captureConfigFromRow`) | reads | `named()` throws `ROW_SHAPE` for a device the registry does not hold (`:908-914`); `codeToProfile(null)` throws (`:762-766`). Called at engine rehydration (`CS/db/mapping/from-rows.ts:157`): **the second place that stops the boot** | NOT SAFE |
| A5 | `CS/db/mapping/rows.ts:957-959` (`selectorDeviceIds`) | reads | Puts a null into the set; the set is only asked `has(row.id)` (`:950`), which a null never answers. The compiler will flag the type | SAFE |
| A6 | `CS/db/mapping/changes.ts:69` (the column list of the write-through), with `:116-118`, `:236-245` | names the members | Compared with `Object.is`, written through `pick`: a null is a value like another | SAFE |
| A7 | `CS/capture/fence/statements.ts:22-27` (`READ_ASSIGNED_SOURCES`) | reads, raw SQL | A JOIN on the device id: a NULL slot yields no row. This is the behaviour the design relies on | SAFE |
| A8 | `CS/capture/fence/fake-profile.ts:34-42` | reads and writes, raw SQL | `WHERE d1.id = c.video_01_device_id AND d2.id = c.video_02_device_id`: with either slot NULL no row matches and nothing is corrected. No error. Side effect: a generated source in the other slot keeps a wrong profile until both are assigned. Development capture only (`CS/capture/fence/boot.ts:260`) | SAFE |
| A9 | `SHARED/domain/entities.ts:272-284` (interface `CaptureConfig`) | a type | Six members typed `string` / `MicInputId`. No reader found: named only at `:62` and `:338` of the same file. The type states NOT NULL | NOT SAFE |

Definitions, not readers: `CS/db/schema/capture.ts:98-103` (the six `.notNull()`), `:111-133` (four foreign keys; a NULL is not checked by a foreign key), `:145-152` (three CHECKs; each is NULL, hence passing, when an operand is NULL, as the addendum says). Comments only: `CS/modules/capture-config/routes.ts:174`, `SHARED/sim/initial-state.ts:87-88`.

Carriers that pass the typed row on without naming a member (the compiler follows them): `CS/db/store/store.ts:260` (the SELECT of the whole row), `CS/db/mapping/from-rows.ts:59-65,157-158`, `CS/db/mapping/to-rows.ts:153`, `CS/db/reset/kept-tables.ts:85` (the reset carries the row image; a NULL survives).

**Count: 9 sites in 7 files; not null-safe 5** (A1 to A4 fail at run time; A9 is a type nobody reads). `WEB`: 0. `MOB`: 0. A1 and A4 each stop the boot on their own, so naming `store.ts` alone (as the gate condition of row 29 does in its text) is not enough: the engine rehydration must pass too.

### 5.2 The stated file list for row 149

Source files that match the pattern today (10): `CS/capture/fence/statements.ts`, `CS/capture/fence/fake-profile.ts`, `CS/db/mapping/rows.ts`, `CS/db/mapping/changes.ts`, `CS/db/schema/capture.ts`, `CS/modules/capture-config/routes.ts` (comment), `CS/modules/capture-config/store.ts`, `CS/modules/capture-config/slices.ts`, `SHARED/sim/initial-state.ts` (comment), `SHARED/domain/entities.ts`.

Test and fixture files (14), which also pin the NOT NULL state and move with schema set A: `apps/core-server/test/db/fixtures.ts`, `contract-v2-delta.ts`, `contract-inventory.json`, `privileges.db.test.ts`, `constraints.db.test.ts`; `CS/capture/fence/__tests__/fence.test.ts`, `fence.db.test.ts`, `development-session.db.test.ts`, `e2e/development-session-e2e.db.test.ts`; `CS/db/mapping/__tests__/from-rows.test.ts`; `CS/db/reset/__tests__/m2-guard-keepset.db.test.ts`; `CS/modules/devices/__tests__/source-class.db.test.ts`; `CS/modules/capture-config/__tests__/capture-config.db.test.ts`, `slices.test.ts`.

Generated or historical: `CS/db/migrations/0004_capture.sql`, `0005_capture_privileges.sql:35-36`, and the eleven snapshots `meta/0004_snapshot.json` to `0014_snapshot.json`.

### 5.3 Readers of the selector lines: server and shared

Server (`CS`):

| # | Site | How it finds a line | Verdict | Note |
|---|---|---|---|---|
| B1 | `modules/capture-config/plan.ts:121-126` | two cameras by position, each held to its track; roles by `find` | SAFE | the refusal itself; "exactly four" stays (AD-10 (4)) |
| B2 | `capture-session/index.ts:617-631` | takes the session's copy, else the slice | SAFE | |
| B3 | `capture-session/index.ts:952` | by device id | SAFE | |
| B4 | `capture-session/index.ts:1039-1058` | iterates | SAFE | reached only after B1 |
| B5 | `capture-session/index.ts:1183` | `some` by input | SAFE | |
| B6 | `capture-session/index.ts:1196-1198` | by input | SAFE | |
| B7 | `capture-session/index.ts:1249-1251` | by device id; "the other" is the line that is not this device | SAFE | not positional |
| B8 | `capture-notices/precheck.ts:171-173,199-205` | iterates | SAFE | asks nothing for an absent line (section 4) |
| B9 | `sealing-host/session-reader.ts:418-419` | by track, then a stand-in text | SAFE | |
| B10 | `modules/devices/status.ts:112-115` | the built-in slots only when the state holds no slice | SAFE | |
| B11 | `modules/devices/status.ts:128-133` (`videoTracksOf`) | by track; `slot?.deviceId ?? camera.deviceId` | NOT SAFE | answers the built-in camera as `sourceDeviceId` of a track that has no source |
| B12 | `modules/devices/status.ts:167-177` (`audioChannelsOf`) | `micInputOfChannel` (position, then default); `?? mic.deviceId`, `?? mic.micRole` | NOT SAFE | states an input, a device and a role for a channel without a line |
| B13 | `modules/devices/status.ts:202-206` (`activeInputOf`) | PRIMARY, else the hardware slice's first microphone through `micInputOfChannel`, else `'MIC-01'` | NOT SAFE | the fallback AD-04 (2) names |
| B14 | `modules/capture-inputs/routes.ts:121` | by device id, else null | SAFE | |
| B15 | `modules/sessions/routes.ts:442` | `some` by input | SAFE | |
| B16 | `engine/capture-session.ts:106-108` | by input | SAFE | |
| B17 | `modules/capture-config/routes.ts:170` | reorders what is there | SAFE | |
| B18 | `modules/capture-config/routes.ts:222-234` | inputs held, as a set | SAFE | |
| B19 | `modules/capture-config/routes.ts:194-213,247-252` | the devices an edit assigns | SAFE | must learn that `unassign` assigns nothing, and that it is refused while locked before the action (`:250`) |
| B20 | `modules/capture-discovery/connect/service.ts:565` | returns the slice | SAFE | |
| B21 | `db/mapping/rows.ts:847` (inside `captureDevicesToRows`) | by device id, then two fallbacks | SAFE | |
| B22 | `db/mapping/rows.ts:1017,1062` | the session's copy as JSON | SAFE | |

`CS/capture/supervisor.ts:1098-1100,1180` reads the worker's plan, built after B1; it is not a selector reader.

Shared (`SHARED`):

| # | Site | How it finds a line | Verdict | Note |
|---|---|---|---|---|
| C1 | `sim/session-machine.ts:784-830` (the start) | no check | NOT SAFE | section 2 |
| C2 | `sim/session-machine.ts:754-769` (`audioSourceAtStart`) | role, else position, else default | NOT SAFE | named by AD-04 (2) |
| C3 | `sim/session-machine.ts:738-746` | copies | SAFE | |
| C4 | `sim/session-machine.ts:470-480,496-505` (lens items) | start-rule row by slot | NOT SAFE | PASS for an unassigned video slot |
| C5 | `sim/session-machine.ts:506-523` (microphone role items) | role | NOT SAFE | WARN "no signal" for an unassigned role |
| C6 | `sim/session-machine.ts:931`, `:979` | by input | SAFE | |
| C7 | `sim/capture-session.ts:305-311` | counts the cameras | NOT SAFE | zero cameras turn durable |
| C8 | `sim/capture-session.ts:270-279` | filters | SAFE | |
| C9 | `sim/capture-config.ts:163-173` (`assignCamera`) | by track, must exist | NOT SAFE | cannot assign an empty slot |
| C10 | `sim/capture-config.ts:190-199` | by input, must exist | NOT SAFE | the same for a microphone line without `role` |
| C11 | `sim/capture-config.ts:107-140` (`replaceMicPair`) | by role and by input | NOT SAFE | audit `from` is the new device when the slot was empty (`:137`) |
| C12 | `sim/capture-config.ts:227-240` | `micInputOfChannel` | NOT SAFE | meters keyed by a default input |
| C13 | `sim/capture-config.ts:75-84` | position, guarded | SAFE | |
| C14 | `sim/capture-config.ts:208-214` | by input | SAFE | |
| C15 | `sim/audio.ts:78-80` (`micInputOfChannel`) | **position, then a constant** | NOT SAFE | the central rule; not in AD-04 (2)'s list |
| C16 | `sim/audio.ts:83-91`, `:282-290`, `:377` | through C15 | NOT SAFE | |
| C17 | `sim/faults.ts:238`, `:351`, `:618`; `sim/health.ts:164-165`; `sim/react.ts:111` | through C15 | NOT SAFE | |
| C18 | `sim/selector-in-force.ts:120-125` (`audioPairOfSelector`) | role, else `lines[0]`, else the first other line | NOT SAFE | a lone STANDBY line reads as the active input; not in AD-04 (2)'s list |
| C19 | `sim/selector-in-force.ts:54-75,136-141` | hands the lists on | SAFE | |
| C20 | `sim/capture-notices.ts:392-431` | iterates | SAFE | gives no row for an absent line (section 4) |
| C21 | `sim/capture-notices.ts:236-250` | by device id | SAFE | |
| C22 | `sim/capture-telemetry.ts:124-141`, `:196-197` | by device id; C15's inverse, then a 404 | SAFE | |
| C23 | `sim/api.ts:347-352` (`videoTracks`) | by track; `?? camera.deviceId` | NOT SAFE | the in-app twin of B11 |
| C24 | `sim/api.ts:366-375` (`audioInputs`) | through C15; `?? mic.micRole` | NOT SAFE | the in-app twin of B12 |
| C25 | `sim/api.ts:677-705` (body check of operation 78) | only `cameras` and `mics` | NOT SAFE | refuses the new member as unknown |
| C26 | `sim/api.ts:814-817`, `:1492`, `:1591`, `:1659` | by role, device or input | SAFE | |

Contract and types that gain the member, not readers: `SHARED/api/devices.ts:144-149` (strict object), `SHARED/sim/types.ts:869-872` (`CaptureConfigChange`), `SHARED/live/source/bindings.ts:185-194` and `SHARED/api/sim-actions.ts:136` (operation by kind of change: a new kind needs an entry, a new member of `UPDATE` does not).

### 5.4 Readers of the selector lines: clients

Web console (`WEB`):

| # | Site | How | Verdict | Note |
|---|---|---|---|---|
| W1 | `features/devices/capture-selector-panel.tsx:497,525-536,546-556` | a row per line | NOT SAFE | pattern A |
| W2 | `features/devices/capture-selector.ts:222-229`, panel `:310-312` | needs two lines | NOT SAFE | pattern B |
| W3 | `features/session-new/devices-step.tsx:316-321` | `micInputOfChannel`, `audioPairOfSelector` | NOT SAFE | pattern C, on the pre-check screen |
| W4 | `features/session-monitor/audio-panel.tsx:33,64-71` | `micInputOfChannel` | NOT SAFE | pattern C |
| W5 | `features/devices/audio-input-card.tsx:61`; `components/composed/dbfs-meter.tsx:198` | `micInputOfChannel` | NOT SAFE | pattern C |
| W6 | `features/session-monitor/audio-source.ts:144,153-171,214` | pair in force; `micInputOfChannel` at `:171` | NOT SAFE | pattern C |
| W7 | `features/dashboard/devices-panel.tsx:46-49` | by input, else null | SAFE | |
| W8 | `features/session-new/model.ts:234-241`; `features/session-monitor/sim-adapter.ts:202-214` | filters the lines that state a profile | SAFE | |
| W9 | `features/session-monitor/model.ts:440-441` | by track | SAFE | |
| W10 | `features/devices/source-class.ts:97,108,139-158`; `local-source-gate.ts:59-70,210` | by track, input or role | SAFE | |
| W11 | `features/devices/track-reach.ts:14`; `camera-preview.tsx:37` | by track | SAFE | |
| W12 | `features/devices/registered-devices-model.ts:62-69` | by device id, else null | SAFE | already reads "on no line" |

Also to change, not a line reader: `WEB/lib/capture-notices.ts:217,236-253` (the closed list of rule suffixes; an item without a device id is dropped at `:242`).

Mobile client (`MOB`):

| # | Site | How | Verdict | Note |
|---|---|---|---|---|
| M1 | `features/capture-selector/capture-selector-model.ts:91-115`; `capture-selector.tsx:174,212-214,244`; `use-capture-selector.ts:200-201` | a row per line | NOT SAFE | pattern A |
| M2 | `features/capture-selector/capture-selector-model.ts:211-221` | needs the other role | NOT SAFE | pattern B |
| M3 | `features/session-new/device-previews.tsx:118` | `micInputOfChannel` | NOT SAFE | pattern C, on the pre-check screen |
| M4 | `features/session-live/mic-source-model.ts:144,151-163,183,197`; `mic-card.tsx:139,168`; `use-mic-source.ts:92,105` | `micInputOfChannel`; pair in force | NOT SAFE | pattern C |
| M5 | `features/capture-selector/source-state.ts:80-81,100-101`; `features/dashboard/device-tiles.tsx:168`; `use-home-data.ts:208-210,339-341` | `micInputOfChannel` | NOT SAFE | pattern C |
| M6 | `features/devices/device-mic-meter.tsx:59`; `sim-adapter.ts:241`; `runtime/use-audio-shared-values.ts:98` | `micInputOfChannel`, its inverse | NOT SAFE | pattern C |
| M7 | `features/capture-selector/source-state.ts:88-94`; `development-source-badge.tsx:170,180,190-208,214` | by track, input or role, else null | SAFE | `:180` falls back to the input id as the device id |
| M8 | `features/capture-selector/open-local-sources.tsx:32-34`; `local-source-notice-model.ts:56-57,92,108-112` | by track, input, device | SAFE | |
| M9 | `features/devices/camera-preview.tsx:81-82`; `registered-devices-model.ts:65-66`; `use-devices-data.ts:56`; `device-detail.tsx:521,688` | by track or device | SAFE | |
| M10 | `features/dashboard/use-home-data.ts:97,216,330` | iterates; by track | SAFE | |
| M11 | `features/session-new/configured-profile.ts:17`; `session-new-model.ts:251-254`; `features/capture-selector/camera-clock-card.tsx:45`; `capture-selector-model.ts:145,181,224-226,357-364` | filters, maps, `some` | SAFE | |

Also to change, not a line reader: `MOB/features/capture-selector/capture-notices-model.ts:141` (closed rule list) and `i18n.ts:215` (the mobile copy of the start-rule sentences).

## 6. The files that must change, per workspace

Derived from the tables; the row that owns each is the blueprint's, with the three places where the blueprint's wording does not reach the file marked **OPEN**.

| Workspace | File | Why | Row |
|---|---|---|---|
| `SHARED` | `api/devices.ts:144-149` | the `unassign` member; a body that unassigns and assigns one slot is 422 | 28 |
| `SHARED` | `sim/types.ts:869-872`; `sim/api.ts:677-705`; `sim/capture-config.ts:107-140,152-264` | the change type; the body check; the hosted action rewritten (C9 to C12, the audit `from`) | 28 |
| `SHARED` | `sim/session-machine.ts:754-769,784-791` | the start refusal; the two fallbacks removed (C1, C2) | 28 |
| `SHARED` | `sim/audio.ts:78-91`; `sim/selector-in-force.ts:120-125` | the positional rule and the positional pair (C15, C18) | 28, **OPEN 2** |
| `SHARED` | `sim/session-machine.ts:470-523`; `sim/capture-notices.ts:357-431`; `sim/vocabulary.ts:570` if a reason code is chosen | the BLOCK item "source not assigned" (C4, C5) | **OPEN 1** |
| `SHARED` | `sim/api.ts:347-352,366-375` | the in-app reads state a source for an unassigned track or channel (C23, C24) | 28 |
| `SHARED` | `i18n/en/common.ts:851-857` and the selector strings | "not assigned" | 28 |
| `SHARED` | `domain/entities.ts:272-284` | the type (A9) | 28 |
| `CS` | `db/schema/capture.ts:98-103,145-152` and the generated set-A file | nullable; the pair CHECK | 17 / WP-24 |
| `CS` | `modules/capture-config/store.ts:85-108`; `slices.ts:31-40,82-123` | A1, A2: the boot step `capture.config` | 29 |
| `CS` | `db/mapping/rows.ts:782-804,906-931,957-959` | A3, A4, A5: the writer by track and role; the reader, which is the engine rehydration | 29 |
| `CS` | `modules/capture-config/routes.ts:194-213,241-262` | `unassign` through operation 78; nothing to check as assignable | 29 |
| `CS` | `modules/devices/status.ts:128-133,167-177,202-206` | B11 to B13 | 150 |
| `CS` | `capture/fence/fake-profile.ts:34-42` | no change required for safety; the side effect of A8 is to be accepted or fixed by decision | **OPEN 3** |
| `CS` | the 14 test and fixture files of 5.2 | they pin NOT NULL or build a row by hand | 17, 29, 149 |
| `WEB` | `features/devices/capture-selector-panel.tsx`; `capture-selector.ts:222-229` | W1, W2 | 31 |
| `WEB` | `features/session-new/devices-step.tsx:316-321`; `lib/capture-notices.ts:217,236-253` | W3; the new pre-check item | 31, **OPEN 1** |
| `WEB` | `features/session-monitor/audio-panel.tsx`, `audio-source.ts`; `features/devices/audio-input-card.tsx`; `components/composed/dbfs-meter.tsx` | W4 to W6, only if `micInputOfChannel` changes its answer | **OPEN 2** |
| `MOB` | `features/capture-selector/capture-selector-model.ts:91-115,211-221`; `capture-selector.tsx`; `use-capture-selector.ts` | M1, M2 | 32 |
| `MOB` | `features/session-new/device-previews.tsx:118`; `features/capture-selector/capture-notices-model.ts:141`; `i18n.ts` | M3; the new pre-check item | 32, **OPEN 1** |
| `MOB` | the nine files of M4 to M6 | only if `micInputOfChannel` changes its answer | **OPEN 2** |

No change needed, checked: `CS/capture/fence/statements.ts`, `boot.ts`, `operation.ts`, `CS/capture/boot/checks.ts` (the fence stays as it is); `CS/modules/capture-config/plan.ts:120-126` in behaviour; `CS/capture-notices/precheck.ts`; `CS/db/mapping/changes.ts:69`; `CS/db/reset/kept-tables.ts`; `SHARED/api/state-slices.ts:1114-1117`.

### The three open points, for the controller

**OPEN 1. Who owns the pre-check item.** Row 30 is titled "Server pre-check" and the addendum places the change in "the pre-check of `CS/capture-notices`". The item is decided in `SHARED/sim/session-machine.ts:489-577`, which is row 28's workspace, and its wording is drawn by two closed lists in the clients (rows 31, 32). As written, row 30 has nothing to change in its own folder. Either row 30's ownership area becomes the shared pre-check files, or the item moves into row 28.

**OPEN 2. What a meter channel is when its line is absent.** `micInputOfChannel` is positional by ruling D137 ("the channel order is the order of the microphone lines", `SHARED/sim/audio.ts:71-76`), and its default table is what invents `MIC-01` / `MIC-02`. AD-04 (2) lists three fallbacks to remove (`rows.ts:785-786`, `status.ts:205`, `session-machine.ts:760-761`); this function and `audioPairOfSelector` are two more, and the first, with its inverse `channelOfMicLine`, is used in 24 non-test files (`SHARED` 8 with its own, `CS` 1, `WEB` 5, `MOB` 10). Two ways, with different sizes: (a) it answers "absent" (a nullable result): every call site changes, and row 28 is larger than its S or M; (b) it stays positional and total, and the rule is "no session and no meters reading without a complete pair", enforced by the start refusal and stated as a decision: then only the pre-check screens (W3, M3) and the reads B12, C24 need care. This record does not choose; it is a design decision that D137 and AD-04 (2) pull in opposite directions.

**OPEN 3. A generated source beside an empty slot.** With one video slot unassigned, `CORRECT_GENERATED_SOURCE_PROFILES` corrects nothing (A8), so a `FAKE` camera in the other slot keeps an operator-set profile and a later session carries the profile notice. Development capture only, and no session can start with an empty slot anyway (B1). Harmless by that argument; listed so that it is accepted on purpose.

## 7. Against the documents this row serves

| Document statement | Measured |
|---|---|
| Addendum 1.4 #4: the simulator's start "refuses with the same 409" after the change; whether it assumes two cameras was not known | It assumes nothing about cameras and refuses nothing. For microphones it invents a pair. The refusal is new code, not an adjustment |
| Addendum 1.4 #5: 42 non-test files name `captureConfig` | 43. The number does not measure the work: the change is in 4 client files for the selector (W1, W2, M1, M2) plus the pre-check screens, unless OPEN 2 goes way (a) |
| Addendum 1.4 #6: the pre-check item is in `CS/capture-notices` | It is in `SHARED/sim` (OPEN 1) |
| Addendum 1.5, column `SIMULATED`, rows 1 to 4 | Not true today: a session starts. True once 1.4 #4 is built |
| Security check 3.1: `audioSourceAtStart` may throw, giving a `500` | It cannot throw; it answers defaults. The `409` of `plan.ts:124` is reached in both real operations |
| Security check 3.2, reader 1 (`store.ts`) "stops the boot" | Confirmed, and `rows.ts:906-931` stops it a second time at engine rehydration (the check's reader 3, listed there without that consequence) |
| Security check 3.2, reader 9 (the hosted action) "must be rewritten" | Confirmed line by line (section 2); in addition the audit `from` of a pair replacement into an empty slot is wrong (`capture-config.ts:137`) |
| Security check 3.2, reader 10 (slice readers) | All listed sites re-opened. Positional or inventing: `status.ts` (three sites), `session-machine.ts:754-769`, `audio.ts:78-80`, `selector-in-force.ts:120-125`, `api.ts:347-352,366-375`. The rest find by key. None decides a source class |
| AD-04 (4): the inventory as a test over the server and shared sources | The list to pin is 5.2. `WEB` and `MOB` hold none today; the test can hold them to zero at no cost |

## 8. Assumptions, gaps, what stays unproven

- Read, not run: every "throws" and "answers" above. Rows 29 and 33 prove the boot and the 21 states; row 149 pins the list.
- The verdict NOT SAFE on the type `SHARED/domain/entities.ts:272-284` is a type statement only; no reader was found by search for `CaptureConfig` as a type name in the four workspaces.
- Test files were listed, not opened line by line; which of them fail when the columns become nullable is for rows 17 and 29 to find by running them.
- The client screens were read for how they find a line, not for layout; "not assigned" as a drawn row is rows 31 and 32.
- No hardware and no double is involved in this row. Nothing here goes to the hardware package.
- External research: no dimension in scope, no web source used.

---
*Generated: 2026-10-12 22:40 WIB*
*Last Updated: 2026-10-12 22:40 WIB*
