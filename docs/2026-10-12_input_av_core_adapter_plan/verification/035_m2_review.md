---
task_id: 2026-10-12_input_av_core_adapter_plan
row: 35
milestone: M2 (plan phase 2 and WP-13a)
date: 2026-10-13
agent: senior-code-reviewer
tier: T2
baseline: cf2f8008
reviewed: commits 7969f0fa, b7ed4c60, 6e6707dd, 3b388746 and the uncommitted tree on branch task4/input-av-core-port
status: complete
---

# Row 35 - code review of phase 2 (M2) of track D

## 1. Verdict

**PASS WITH FOLLOW-UPS.** Blocking findings for the M2 gate: **0**. Follow-ups: **8** (F-01 to F-08). Notes: **10** (N-01 to N-10).

No path was found that records, or that a real Core reports as startable, with a selector slot unassigned. Nothing new resolves a camera or a microphone by position. No file under `apps/core-server` imports the simulator's default profile. The seven places changed by a script or a shell append hold exactly what their rows' records say. Both named deferrals are empty.

## 2. How this review was made, and its limits

Read-only. Instruments: `git diff cf2f8008 -- <path>`, `git show <commit> -- <path>`, `git log`, text searches of the four workspaces, the rows' records and the decisions. **No test, typecheck or suite was run** (a full suite was running in another agent; nothing here needed a run to be decided).

The change set against the baseline is 613 files (`git diff cf2f8008 --stat`: 81,695 insertions, 1,656 deletions; 153 test files). It was not read line by line. Read in full as diffs: the seven edit-only places, every closed-task guard file of question 5, the three static-rule test files' list hunks, the start rule in the shared machine, the plan builder, the session-capture start, the profile refusal of operation 78. Covered through their records plus targeted searches, not line by line: rows 20, 21, 23 to 26, 147, 164, 165, 167 to 171. A defect inside those rows that no search of this review would show is not excluded.

`CS` = `apps/core-server`, `SH` = `packages/shared`, `WEB` = `apps/core-web/src`, `MOB` = `apps/mobile/src`. Line numbers are of the working tree at the time of the review.

## 3. Ranked findings

| ID | Severity | File:line | Finding | Row to carry the fix |
|---|---|---|---|---|
| F-01 | follow-up | `SH/src/sim/session-machine.ts:506`, `:840`; `SH/src/sim/core-facts.ts:230-232`; `CS/src/engine/host.ts:1028-1040` | "Real capture" in the start rule is a PROXY: `isOwnCaptureCoreState` is true when the state says host clock or platform-not-reported. Both are written at rehydration when capture levels are external, so today it is always true on a real Core. A later task that gives a real Core a time service and a platform report makes it false, and then the pre-check BLOCK item and the shared refusal for an unassigned slot disappear silently. The plan builder (`CS/src/modules/capture-config/plan.ts:120-126`) would still refuse the start, so nothing would record, but the pre-check would read PASS for an empty video slot | a new row beside 163 (state the capture operation as its own fact), before any time or platform work |
| F-02 | follow-up | `SH/src/live/source/neutral-state.ts:49` | `silentAudio` still states `activeInputId: 'MIC-01'` and two built-in inputs: the one reader left that assumes `MIC-01` (row 149's own request 4, row 28's open finding). A client that lost its feed names an active input the selector may not hold | follow-up of row 149 |
| F-03 | follow-up | `CS/src/capture/fence/__tests__/fence.test.ts:818` | The expectation of the cell "category 6 x REAL_PRODUCTION" is computed from `OPENER_CAPABLE_KINDS`, the product's own list. For that one cell the test cannot fail whichever way the list moves (row 33 says so as a driver decision) | rows 85 / 88 (the lift pins both values by hand) |
| F-04 | follow-up | `CS/test/db/set7.db.test.ts:209` | `await applyMigrations(owner, folderOf(15)).catch(() => undefined)` replaced three exact assertions on the result. Any error is swallowed; the case still holds version, ledger and object count afterwards. The first case of the same file asserts the code (`SCHEMA_VERSION_MISMATCH`); this one should too | row 17 / 99 (the schema-set writer) |
| F-05 | follow-up | `CS/src/capture/__tests__/static.test.ts:610` | G-R10 export list of the connection file gained `OnvifTimeReader` and `createOnvifTimeReader` in integration pass I-7. SR-3 (2) admits "the names WP-04 needs for the profile and locator reads (row 26)"; the time reader serves row 49. The five reads are unchanged (`:502`, `:565`). No decision row admits the two names | controller decision row (extend SR-3 (2)); row 85 wires it |
| F-06 | follow-up | `CS/src/capture/adapters/local/process-door.ts:106-114`; `CS/src/capture/ipc.ts:69-83`; `CS/src/db/seed/demo-helper.ts:74-79` | Row 180's kill guard edits the local helper door, while SR-1 says "The local helper door is not edited". The change is correct and additive (a failed spawn no longer signals process id 0). The blueprint has row 180; `decisions/decisions.md` has no row for the exception | controller decision row |
| F-07 | follow-up | `CS/src/capture/boot/checks.ts:370`, `:376`; `CS/src/capture/types.ts:373` | Three optional members whose absence switches a production check off: `host?`, `programs?` (their comments say "every test from before them") and `attempts?` ("a double"). Production wires all three (`CS/src/capture/boot/index.ts:290-291`, `CS/src/capture-session/index.ts:1576`), so nothing is open today; a composition that forgets one fails open and no test would say so (AD-08) | rows 80, 81, 179: make them required, tests pass an explicit value |
| F-08 | follow-up | `CS/src/capture/fence/index.ts:337`; `CS/src/capture-notices/precheck.ts:130` | Row 33's finding F-3b is still open: with four production devices ASSIGNED in `REAL_PRODUCTION` the pre-check ends PASS with 0 BLOCK items and only the start answers 409 (no adapter serves them). Not an unassigned-slot path and nothing records; it is the "acknowledge, then meet a 409" experience C25 removed | rows 85 / 88 |
| N-01 | note | `CS/src/modules/capture-config/routes.ts:288` | The refusal of row 187 applies only when a registry is provided (real capture). A SIMULATED Core that holds an `ONVIF_RTSP` row would store the simulator's default profile for it, and a later real boot would read that row. Reachable only by switching one database between modes | row 187 or 85 |
| N-02 | note | `CS/src/core/audit-details.ts:190` | Seam left behind: the literal `'AUDIO_CARDS'` is still unioned into the scopes although `CaptureDiscoveryScope` holds the member since I-1 | any row that edits the file |
| N-03 | note | `SH/src/sim/session-machine.ts:509` | Dead branch: `CAPTURE_START_REQUIRED_SLOTS.includes(slot) ? 'BLOCK' : 'WARN'` - all four slots are required since C25 | row 163 follow-up |
| N-04 | note | `SH/src/sim/capture-notices.ts:385`, `:388`; `WEB/features/devices/capture-selector.ts` (`VIDEO_SLOTS`, `MIC_SLOTS`); `CS/src/modules/capture-config/plan.ts:104` | The four-slot list is written out four times beside the contract's `CAPTURE_SELECTOR_SLOTS` (held equal by a test for the shared pair only) | none needed now |
| N-05 | note | `CS/src/capture/fence/sources.ts:194` | `SAMPLE_BITS = [16, 24, 32]` restates `CAPTURE_AUDIO_SAMPLE_BITS` of `SH/src/api/capture-audio-cards.ts:73` | row 71 follow-up |
| N-06 | note | `CS/test/acceptance/contract.test.ts:502`, `:2047`, `:2205`, `:2218` | Both deferral lists are empty; four comments and one string still describe entries ("97 routed operations", "the 6 registry routes", "no route until task 4 row 70") | documentation rows at the close |
| N-07 | note | `CS/src/modules/capture-config/plan.ts:121`; `WEB/features/session-monitor/model.ts:451`; `MOB/features/session-live/live-feed.tsx:87` | Positional reads that were in the baseline and are unchanged: the plan builder destructures `[first, second]` and then checks each track id (fails closed); the two feed labels fall back to `cameras[0]` (display only) | none; stated for AD-04 |
| N-08 | note | `MOB/features/session-live/mic-source-model.ts:155`; `MOB/features/dashboard/use-home-data.ts:340-341` | Two comments still speak of the seam as to come | a mobile row |
| N-09 | note | `SH/test/sim-capture-config.test.ts:677` | One assertion line was touched for whitespace only (`},{`); meaning unchanged | none |
| N-10 | note | `SH/src/sim/api.ts:889` | `roleOf` answers PRIMARY for an input no selector line names | row 165 follow-up |

## 4. The seven questions

### 4.1 WP-13a end to end

**Does any path record, or report as recordable, with a slot unassigned? None found.** Three independent lines, in the order a start meets them:

| Line | Where | Keyed on |
|---|---|---|
| Pre-check item BLOCK "source not assigned", one per empty slot, all four slots | `SH/src/sim/session-machine.ts:505-515`; slots at `SH/src/sim/capture-notices.ts:385` | `isOwnCaptureCoreState` (F-01) |
| Shared start refused, `CAPTURE_SOURCE_NOT_ASSIGNED` | `SH/src/sim/session-machine.ts:840-845` | `isOwnCaptureCoreState` (F-01) |
| Plan builder refuses a selector that is not exactly two tracks and both roles (`SELECTOR_SHAPE`), inside the unit that would persist RECORDING, before any source row or worker | `CS/src/modules/capture-config/plan.ts:120-126`, called at `CS/src/capture-session/index.ts:805`; guard at `:819` | the Core's own capture mode (`real`), not the proxy |

Row 158's race (a session OPEN that loses to an unassign): the session is created on the selector without the slot (`test/158_unassign_rules.md`, case 4). In real capture it then stops at the first line; row 33 held it on PostgreSQL for states 1, 2, 5, 7 and both S-5: 409, 0 `RECORDING_STARTED`, 0 source rows, 0 workers (`test/033_selector_21_states.md` section 4). By reading, not run here: such a session cannot be completed either, because operation 78 is locked from the session's creation; the operator closes it and opens another.

Simulated mode and the in-app simulator start on an incomplete selector, as ruled (C21 (6), C25); the Core's session capture returns before any source is opened (`CS/src/capture-session/index.ts:797`, `if (!real) return`).

**Position (AD-04).** The positional function is gone: 0 occurrences of its name in `apps/` and `packages/`. New code finds lines by track or role (`WEB/features/devices/capture-selector.ts` `selectorSlotRows`, `micPairFor`; `CS/src/db/mapping/rows.ts:807-810`, `:953-956`, `:1002`). Three pre-existing positional reads remain, none new and none able to pick a source (N-07).

**C36 (1).** `CAPTURE_CONFIG_EMPTY_SLOT_PROFILE` under `apps/core-server`: one occurrence, a comment (`CS/src/modules/capture-config/routes.ts:52`). Defined and used in `SH/src/sim/capture-config.ts:100`, `:238` only. Held by a static rule with a planted control (`CS/src/modules/capture-config/__tests__/static.test.ts:224-249`). The refusal that replaces the default is `routes.ts:286-299`; its one gap is N-01.

### 4.2 The seam removal (row 149)

Markers and seam types searched in the four source trees (`PENDING-ROW`, `AudioSliceInState`, `statesRole`, `MicLineRoleUnstated`, `slotColumn`, `seamedSelectorRow`): 0 in code, 2 in comments (N-08). Readers of the active input with a fallback (`WEB/features/dashboard/devices-panel.tsx:49`, `MOB/features/session-live/mic-source-model.ts:157`, `MOB/features/dashboard/use-home-data.ts:343`, `SH/src/sim/api.ts:886`) fall back to the meters' member, which is null without a PRIMARY line; `api.ts:887` answers an empty list. The literal of C36 (2) is gone. One reader still assumes `MIC-01`: F-02. The remaining `'MIC-01'` literals in sources are the built-in device tables, examples and fixtures of the simulator, not readers of the selector.

### 4.3 Contracts and pins

| Pin | Baseline -> now | Where read |
|---|---|---|
| Operations | 97 -> 99 (36 GET, 63 POST) | `SH/src/api/core-api.ts:52`, `:1108-1110`; `CS/test/acceptance/contract.test.ts:472-475`, `:557` |
| Audit types | 67 -> 77 | `SH/src/sim/vocabulary.ts` (ten types, ten categories) |
| Permissions | 14 -> 15 | `SH/src/sim/vocabulary.ts` (`CAPTURE_COMMISSION`, row 100) |
| Schema | (6, dbc-7) -> (8, dbc-9) | `CS/src/capture/fence/__tests__/fence.db.test.ts:132-135` and its twin in `development-session.db.test.ts` |

A scan of every test diff for an exact matcher replaced by a weaker one found two hunks; one is legitimate (a deleted function's case), the other is F-04. Two contract widenings are bounded, not "any number": `channels` and `audio` from exactly 2 to at most 2 (`SH/src/api/core-api.ts:466-469`, `:524-527`), by C25 R-2.

**Named deferrals.** `LANDED_UNROUTED` is `[]` (`CS/test/acceptance/contract.test.ts:178`) and `LANDED_UNANSWERED` is `{}` (`:2044`), with `expect(deferred).toEqual([])` at `:2202`. None remains. Stale wording around them: N-06.

### 4.4 The edit-only breaches

| File | Row | What the diff holds beyond the record | Result |
|---|---|---|---|
| `SH/src/api/capture-discovery.ts` | 38 | In 7969f0fa: the five text edits, plus the member `AUDIO_CARDS` of `CaptureDiscoveryScope`, which is integration pass I-1 and recorded there. Later hunks are rows 94 and 96 | clean |
| `SH/src/api/core-api.ts` | 52 | One import, one comment, three members (5 insertions, 3 deletions, as recorded). Other hunks are rows 28 and 63 | clean |
| `SH/src/sim/vocabulary.ts` | 19 | 28 lines: ten types with a 5-line comment, ten categories with a 3-line comment. The 8 other lines are row 100's permission | clean |
| `CS/src/capture/types.ts` | 179 | One import, `CaptureAttemptIngest`, the `start` signature and its comment (27 added, 2 replaced, as recorded). The camera-reason hunk is row 182 | clean; see F-07 for the optional parameter |
| `WEB/features/devices/capture-selector.ts` | 31 | Header table, one import, `micPairFor`, `selectorSlotRows` with two row types, `setMicPair` signature, `unassign` | clean |
| `SH/test/sim-capture-config.test.ts` | 162 | One appended block at `:934`, no duplicated title, no duplicated import; two pins moved as recorded | clean; N-09 |
| `CS/src/capture/fence/__tests__/fence.db.test.ts` | I-7b | Three places: the `afterEach` import, the `caseClones` list with its hook, one `push` in `clone()`. No case body touched | clean |

No duplicated block, no changed line elsewhere and no whitespace that changes meaning in any of the seven.

### 4.5 Files of the closed task 3

| File | Change | Additive | Pre-existing assertions |
|---|---|---|---|
| `CS/src/capture/fence/boot.ts`, `operation.ts`, `statements.ts`, `fake-profile.ts`, `registration.ts` | none (`git diff cf2f8008 --stat` is empty) | - | - |
| `CS/src/capture/fence/sources.ts` | +88, row 71: source facts of a microphone slot; one new import of `adapters/audio/card-listing` | yes | untouched |
| `CS/src/capture/fence/index.ts` | +9 exports of the above | yes | - |
| `CS/src/capture/boot/checks.ts` | checks 4d and 4e, both `REAL_PRODUCTION` only; two refusal sets spread in; worker version 0.5.0 -> 0.6.0 | yes; F-07 | version pin moved by row 177 |
| `CS/src/capture/ipc.ts`, `adapters/local/process-door.ts`, `db/seed/demo-helper.ts` | row 180's kill guard | yes | F-06 |
| `fence/__tests__/development-session.db.test.ts` | ingest address compared by prefix plus a 22-character element; helpers named by listener port instead of start order | meaning kept (row 47 made the element random and the opens concurrent) | hold |
| `fence/__tests__/support.ts` | selector members nullable | yes | hold |

The M2 gate line "fence files unchanged" is true for `boot.ts` and `operation.ts` (C43) and not for `sources.ts` and `index.ts`; row 36 should word its evidence that way.

**Static-rule list entries added, and what admits each.**

| Rule, list | Entry added | Admitted by |
|---|---|---|
| G-R2 allowlist; process-module list; G-R8 process-start list; T-CR-2 (`CS/test/static/credentials.test.ts:116-118`) | `adapters/production-door.ts` | SR-1 entry 1 |
| G-R2 allowlist; file-system list | `adapters/audio/card-listing-reader.ts` | SR-1 entry 3 |
| G-R2 allowlist; file-system list | `adapters/audio/alsa-config-writer.ts` | SR-1 entry 2 |
| G-R2 socket exclusion; G-R10 importers of the `onvif` package | `adapters/camera/onvif-network.ts` | SR-3 (1) |
| G-R9 send call site (`transmit`, third destination) | the typed unicast destination | SR-2 |
| G-R10 export list | four names of row 26 | SR-3 (2) |
| G-R10 export list | `OnvifTimeReader`, `createOnvifTimeReader` | **no amendment: F-05** |
| G-R12 formats | `alsa`; the channel-selection bar; the two-integer device | SR-4 (1) to (3) |
| A-2 callers of the injection point | `adapters/camera/relay-start.ts` | not an SR row: design addendum 2.6 (`masterplan/04_design_addendum.md:251`), adopted by C14 |
| P25 configuration lines (two keys, four places) | `DEMS_CAPTURE_RELAY`, `DEMS_CAPTURE_GUARD` | not an SR row: design addendum 8.2 (`masterplan/04_design_addendum.md:542`), adopted by C14 |
| Discovery rule 3, statements of the adoption | `INSERT INTO public.capture_device_streams` | not an SR row: row 51 with schema set A |
| Worker guard tags (`CS/test/static/guard-family.test.ts:66`) | `BR-01`, `BR-03`, `BR-04` | not an SR row: C27 (branch B requirements) |

The timer, time and chance lists of G-R8 have no removed or added line.

### 4.6 Duplication and dead code

| Subject | Finding |
|---|---|
| Destination rule | One authority, `CS/src/capture/destination-rule.ts`. `SH/src/api/capture-discovery.ts:862-867` is a labelled simulator stand-in that says it is not the rule. The helper and the host script hold their own bounds by design (S13-08) |
| Card text rule | One function, `cardListingText` (`CS/src/capture/adapters/audio/card-listing.ts:154`), on the shared patterns. One restated list: N-05 |
| Selector start rule | Shared machine and Core plan builder state it twice on purpose (two lines of defence); the slot list is written four times (N-04) |
| Seams left | N-02; the empty `LANDED_UNANSWERED` construct (N-06) |
| Test-only parameters in `src/` | F-07 |
| Dead code | N-03. `otherMicInput` of mobile is deleted with its test; the web twin has a caller (`WEB/features/session-monitor/audio-source.ts:177`) |

### 4.7 Tests

| Check | Result |
|---|---|
| `.skip`, `.todo`, `.only` added in test diffs | 0 in TypeScript; one `@unittest.skipIf(os.getuid() == 0, ...)` in the alias helper's Python tests (never run as root: intended) |
| Test files deleted or renamed | 0 |
| `it(` lines removed against added | 96 removed, 720 added; every file with a removal has at least as many additions except `MOB/features/capture-selector/mic-input-name.test.ts` (1 removed, 0 added: the case of the deleted `otherMicInput`) |
| A test that cannot fail | F-03 (one cell) |
| An assertion loosened | F-04 |

## 5. What was done well

- The static rule for C36 (1) has a planted control and strips comments, so the comment at `routes.ts:52` is not a false occurrence.
- Row 33 derived its expectations from the code before reading the designed table, and reports four differences instead of bending the table.
- Every amended static list stays exact (`toEqual`), with the amendment named in a comment beside the entry.
- The kill guard of row 180 puts the signal in one function per door.

## 6. Sources read

Decisions: `decisions/decisions.md` (U1 to U19; C14, C17, C18, C21, C25, C27, C31, C32, C36, C41, C43), `decisions/003_amendment_rows.md` (SR-1 to SR-4), `decisions/161_selector_names_register.md` (searched). Records: `implementation/019`, `030`, `031`, `038`, `052`, `149`, `162`, `179`, `i07b`; `test/033_selector_21_states.md`, `test/158_unassign_rules.md`; `delegation_progress/driver_rules.md`. Code: the files cited above.

---
*Generated: 2026-10-13*
