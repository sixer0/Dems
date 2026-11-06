---
task_id: 2026-10-12_input_av_core_adapter_plan
row: N2 (work package N2 of masterplan/06_design_macos_microphone.md, revision 3: THE ONE CONTRACT STEP; decisions U25, C107, C110, C112)
date: 2026-10-14
agent: coder-execution (agent N2, wave 12, track D)
tier: T3
builds_on: masterplan/06 sections 6.2, 7.2a, 8.1 to 8.6, 10.1, 10.2; verification/08b (SM-29, SM-30, SM-32 (5), SM-34, SM-36 (5), SM-37 (1), SM-38); implementation/v4_fourth_contract_step.md item 6, 191c_signed_audio_gap.md, r1b_video_absence_signed.md, p1_production_platforms.md, i09b_integration_pass.md item 11
status: needs-review - the contract is built, green and proven byte-identical for every existing package; TWO findings need a ruling before rows N11 and N12 can use it (section 6); nine driver decisions to confirm (section 7)
---

# Row N2: the contract of an audio path that is not sample-continuous

Paths are relative to `/Users/gsp-budi/Documents/DEMS`; `SH` = `packages/shared`, `CS` = `apps/core-server/src`. CONTRACT ONLY: no Core writer, no seal, no worker, no screen. No device, no microphone, no credential, no database, no port; nothing under `apps/capture-worker`, `packages/capture-protocol`, `capture/fence`, `sealing`, `apps/core-web` or `apps/mobile` was written. Simulated mode is unchanged: the simulator raises, writes and states none of this.

## 1. Result

| Point of the brief | Built | Where |
|---|---|---|
| (a) the manifest member | the OPTIONAL signed member **`audio.samplesNotReceived`**, fields 139 to 158; its schema, its reconciliation rules, the builder; absent = the bytes of before | `SH/src/evidence-package/manifest.ts`, `build.ts` |
| (a) the verifier | accepts the member (V-01 is the schema), REFUSES one whose counts do not reconcile, and SAYS it in TWO notices | `SH/src/evidence-verify/types.ts`, `verify.ts`; `SH/src/api/evidence.ts` |
| (b) two audit types | **`CAPTURE_AUDIO_SAMPLES_NOT_RECEIVED`** (the totals, 20 closed details) and **`CAPTURE_AUDIO_SILENCE_INSERTED`** (one run, 5), category DEVICE, labels, rules | `SH/src/sim/vocabulary.ts`, `SH/src/i18n/en/common.ts`; `CS/core/audit-details.ts` |
| (c) the source facts | NOT a shared member (the shared package declares no source facts of a session); the closed words are exported for row N11 | section 5 |
| (d) the notices | FIVE advisory reasons with their sentences; the advisory list carries a second level (WARNING) for three | `SH/src/sim/capture-notices.ts`, `capture-fault-wording.ts`, NEW `audio-not-continuous.ts` |
| (d) the operator's words | "Second channel of the same device" and five more, in one new group | `common.micSameDevice` |
| (e) the transcript | two OPTIONAL members of operation 84: **`audioNotSampleContinuous`** (the statement) and **`segments[].insertedSilenceMs`** (the mark); the words of the statement | `SH/src/api/evidence.ts`; `common.audioNotSampleContinuous` |
| (f) the seal's refusal | NOT in the shared package: `SealingFailure` lives in `CS/sealing/pipeline/contract.ts` - LEFT to row N12 | - |

## 2. The contract (verbatim names)

### 2.1 The member `audio.samplesNotReceived` (fields 139-158)

Optional; when present a list of at least one strict record, in the order `attempt` ascending, then `micDeviceId` ascending:

| Field | Member | Form |
|---|---|---|
| 139 | `micDeviceId` | text |
| 140 | `attempt` | whole number, 1 or more |
| 141 | `captureLayer` | `MANIFEST_AUDIO_CAPTURE_LAYERS` = `['AVFOUNDATION']` |
| 142 | `captureGroup` | 1 to `MANIFEST_AUDIO_CAPTURE_GROUP_MAX` (2) |
| 143 | `account` | `MANIFEST_AUDIO_SAMPLE_ACCOUNTS` = `['CLOSED', 'NOT_CLOSED', 'NONE']` |
| 144-155 | `timelineSamples`, `receivedSamples`, `insertedSamples`, `discardedSamples`, `bufferedSamples` (at most 96,000), `nonFiniteSamples`, `fedSamples`, `fedInsertedSamples`, `fedRuns`, `fedLongestRunSamples`, `runsNotListed`, `runsNotListedSamples` | THE TWELVE COUNTS (`MANIFEST_AUDIO_SAMPLE_COUNT_MEMBERS`): each a whole number 0 to `MANIFEST_AUDIO_DAY_SAMPLES` (4,147,200,000) or null; ALL numbers or ALL null |
| 156 | `openRunFromSample` | 0 to one day, or null |
| 157, 158 | `insertedRuns[]` of `{ fromSample, samples }` | optional inside a record; 1 to 1,024 records; `samples` 4,800 (`MANIFEST_AUDIO_INSERTED_RUN_MIN_SAMPLES`) to one day; ascending `fromSample` |

`MANIFEST_V2_OPTIONAL_FIELDS`: 10 -> 30 entries. `MANIFEST_V2_FIELDS` stays 128 / 119.

THE RECONCILIATION (`samplesNotReceivedRules`, run by the schema at the seal and by every verifier):

1. `account` is `NONE` exactly when the twelve counts are all null; then no open run and no `insertedRuns`. Otherwise all twelve are numbers.
2. THE IDENTITY: `timelineSamples` = `receivedSamples` - `discardedSamples` - `bufferedSamples` + `insertedSamples`.
3. `CLOSED` implies `bufferedSamples` = 0 and `openRunFromSample` = null.
4. Two `CLOSED` records of one attempt state the same `timelineSamples`.
5. The listed runs of an attempt do not overlap, are at most 1,024 over its records together, each ends at or before the largest `timelineSamples` of the attempt, and their lengths plus the attempt's `runsNotListedSamples` are at most the sum of its `fedInsertedSamples`.
6. A pair (`micDeviceId`, `attempt`) stands once, in order; never beside `demo` or an integrity other than `REAL`; only in a manifest that also carries `hostProfileNotAsked`; an empty list is refused.

And the bounds of the fields against each other: 146, 150, 153 at most 144; 147, 149 at most 145; 151 at most 150 and 146; and the sum of `fedSamples` of an attempt at most its largest `timelineSamples` (driver decision 3).

WHAT A MEMBER THAT DOES NOT RECONCILE IS: not a manifest. The verifier fails **V-01** with the EXISTING code **`MANIFEST_FIELD_INVALID`** (failure class `UNREADABLE`) and names the member, e.g. `audio.samplesNotReceived.0.timelineSamples`. No new failure class: the design names none ("checked by its schema at the seal and again by every verifier, V-01"). No notice is drawn from a manifest that was refused.

THE MANIFEST'S SIZE (the design asked row N2 to check before 1,024 is pinned): the verifier reads a manifest of up to 64 MiB (`VERIFY_MAX_MANIFEST_BYTES`, `SH/src/evidence-verify/verify.ts:111`); 1,024 runs of about 45 characters are about 46 KB per attempt. No bound is met.

### 2.2 Two verify notices (decision C112 (4))

| Code | Raised | Line |
|---|---|---|
| `AUDIO_SAMPLES_NOT_RECEIVED` | the manifest carries the member | `audioSamplesNotReceivedReport(records)`; three forms |
| `AUDIO_ONE_CAPTURE_GROUP` | two records of the highest attempt state the same `captureGroup` (`audioOneCaptureGroup`) | `AUDIO_ONE_CAPTURE_GROUP_REPORT`: "Audio: PRIMARY and STANDBY were channels of ONE device recorded by ONE capture program. A switch between them was not a switch to an independent source." |

The three forms of the first line, with the numbers of the HIGHEST attempt (`audioSamplesNotReceivedNumbers`: Y = the largest field 144, Z = the sum of fields 151, X = Y - Z, N listed runs, R = the sum of fields 154, L = the largest field 153):

- every account of the attempt `CLOSED`: "Audio: NOT SAMPLE-CONTINUOUS (bench capture path of a Mac). X of Y samples of the track arrived; Z are inserted silence, not sound (runs of 100 ms or more: N listed, R not listed, longest L samples)."
- otherwise, with at least one number: "Audio: NOT SAMPLE-CONTINUOUS (bench capture path of a Mac). Measured to sample Y only, rest NOT MEASURED: X arrived; Z are inserted silence (runs of 100 ms or more: N listed, R not listed, longest L samples)."
- nothing measured: "Audio: NOT SAMPLE-CONTINUOUS (bench capture path of a Mac). How much sound did not arrive was NOT MEASURED."

Measured at the largest numbers a manifest can state: both numbered forms are at most 256 characters (the second is exactly at the bound by this record's count; the test holds it). The second form is shorter in WORDS than the design's sketch ("Measured up to sample Y only; the rest of the track was NOT MEASURED") because that sketch did not fit; no number was dropped (driver decision 4). They fail nothing and change no verdict. The verify answer admits 9 notices (`.max(8)` -> `.max(9)`: nine codes can now stand in one result; driver decision 5).

### 2.3 Two audit types

`CAPTURE_AUDIO_SAMPLES_NOT_RECEIVED` - label "Audio samples not received from a microphone"; details, in this order: `sessionId`, `attempt`, `captureLayer`, `captureGroup`, `account`, `openRetries` (0 to 1) REQUIRED; `timelineSamples`, `receivedSamples`, `insertedSamples`, `discardedSamples`, `bufferedSamples`, `nonFiniteSamples`, `fedSamples`, `fedInsertedSamples`, `fedRuns`, `fedLongestRunSamples`, `listedRuns` (0 to 1,024), `runsNotListed`, `runsNotListedSamples` (the thirteen, `CAPTURE_AUDIO_ACCOUNT_NUMBER_KEYS`) and `openRunFromSample` OPTIONAL. 20 keys.

`CAPTURE_AUDIO_SILENCE_INSERTED` - label "Silence inserted into the audio track"; all five REQUIRED: `sessionId`, `attempt`, `index` (1 to 1,024), `fromSample`, `samples` (4,800 to one day).

Both: category DEVICE, no fixed severity (the writer states WARNING, as the audio gap's does), no `operationId`, no `permission`, no device or card text, no percentage. The Core's constants (`CAPTURE_AUDIO_DAY_SAMPLES`, `..._BUFFERED_MAX_SAMPLES`, `..._INSERTED_RUN_MIN_SAMPLES`, `..._INSERTED_RUNS_MAX`, `..._CAPTURE_LAYERS`, `..._CAPTURE_GROUP_MAX`, `..._SAMPLE_ACCOUNTS`, `..._OPEN_RETRIES_MAX`) are held equal to the manifest's by a test.

### 2.4 Five advisory reasons (5 -> 10) and their level

`MIC_PATH_NOT_SAMPLE_CONTINUOUS` (INFO), `MIC_SAMPLES_SHORT_ABOVE_BOUND` (WARNING), `MIC_SAMPLES_SHORT_ABOVE_SESSION_LEVEL` (WARNING), `MIC_SILENCE_RUN_INSERTED` (WARNING), `STANDBY_ON_PRIMARY_DEVICE` (INFO); each of device kind MIC. Sentences: the design's section 8.3 and 6.2, word for word, in `CAPTURE_FAULT_SENTENCES` (the i18n block `common.captureFault.reason` IS that table). The fixed sentence is ONE constant, `AUDIO_INSERTED_SILENCE_SENTENCE`.

THE LEVEL (SM-32 (5), "the contract row's to settle"): the advisory list carries a second level. `CAPTURE_ADVISORY_SEVERITY` gives each reason `INFO` or `WARNING`; the alert of the three carries the severity WARNING and is advice in every other respect (no fault life cycle, no audit row, nothing stopped); `CAPTURE_ADVISORY_WARNING_REASONS` names them; `CAPTURE_REASON_SEVERITY` agrees (held equal by a test). The numbers travel as whole numbers on the raise and in the alert's `params`: `shortfallPer100k`, `referencePer100k` (parts per 100,000), `runMs`; `micShortfallSentence` fills the sentence, a share is CUT to one decimal (`shortfallPercentText`), and a number outside its bounds is left out of the text AND of `params`.

### 2.5 Words

`common.micSameDevice` (`MIC_SAME_DEVICE_WORDS`): `role` "Second channel", `slot` "Second channel of the same device", `line` "Microphone for the standby line - second channel of the same device", `source` "MIC (second channel of the same device)", `joinsAtNextStart`, `switchRefused` (the two refusals of design 6.2). The plain standby words did not move.

`common.audioNotSampleContinuous` (`AUDIO_NOT_SAMPLE_CONTINUOUS_WORDS`): `title`, `sentence` (the fixed one), `measured`, `measuredTo`, `notMeasured`, `runs`, `segment` ("[inserted silence {{ms}} ms]"), `transcript`.

### 2.6 Operation 84

`TranscriptDocumentSchema.audioNotSampleContinuous` (optional strict object): `arrivedSamples`, `trackSamples`, `insertedSamples` (0 to one day, or null), `listedRuns` (0 to 1,024), `runsNotListed`. `TranscriptSegmentSchema.insertedSilenceMs` (optional, 1 to 86,400,000). Absent for every other transcript: the answer of before parses to itself. The sealed document `dems.transcript/1` gained no member (C112 (1): its statement comes from the stored facts - row N18).

## 3. THE PROOF THAT EXISTING PACKAGES VERIFY UNCHANGED

Two instruments, both in `.cache/task4-n2/` (git-ignored, in no commit).

**(1) The product pipeline, before and after** (row 191c's instrument, copied from row R1b's with its own seed text kept): the PRODUCT seals the two fixture sessions of `sealing/__tests__/pipeline-support.ts`; random bytes and the Ed25519 pair are a function of their call order. Twice BEFORE the first edit, once AFTER the last.

```
fixture "switch"        session-manifest.json 10582 bytes
  before / before2 / after  94f26937c667bbf87942f83125196430ff38c621d62986a8b31e94619b823333
  signature file            e720f9b6aaebf8fab7316f76d4496c2efef408b7dec231d6600839f1da83b017  (all three)
fixture "one-interval"  session-manifest.json 10444 bytes
  before / before2 / after  e4de4742c9a796c5db68d1297b665151e1cc79080aa2c6f1227699e115b3e7bc
  signature file            16bbc8ee4803f7fde67e8fdebc44c4901aa44963478a32489789de6bc1a91d78  (all three)
cmp before.*.manifest.json after.*.manifest.json : identical, both fixtures
cmp before.*.signature     after.*.signature     : identical, both fixtures
```

These are also the digests of row R1b's own `after` files: the tree's output has not moved since.

**(2) The shared package as COMMITTED against the working tree** (`git archive HEAD packages/shared/src` extracted under `.cache/task4-n2/head/`; `verify-compare.test.ts`): each tree builds the example manifest and four manifests with the optional members of before (`absentOnRestart`; `hostProfileNotAsked`; `absentInSession`; all three), serializes them and verifies each with a manifest-scope run. Per manifest: the byte count and SHA-256 of the manifest, `manifestSha256`, the V-01 status, the notice codes, and the SHA-256 of the WHOLE verify result as JSON.

```
cmp out/verify.head.txt out/verify.work.txt : identical (5 lines)
example      7097 bytes  sha256 25ab389c...8dd825  V-01 PASS  notices AUDIT_EXTRACT_NOT_SIGNED
restartGap   7198 bytes  sha256 b0e8283c...67b6a4  V-01 PASS
hostProfile  7141 bytes  sha256 68e4a2d8...fcd4f7  V-01 PASS
videoAbsence 7205 bytes  sha256 6ecc9491...e35b70  V-01 PASS
allThree     7458 bytes  sha256 ea875308...b5caba  V-01 PASS
```

And in the committed suite: `SH/test/evidence-package.test.ts`, case "row N2: A PACKAGE WITHOUT THE MEMBER IS UNCHANGED" (no key, the same bytes, `undefined` = left out, V-01 PASS, the notices of before), beside the 2,891 cases of before, all green.

## 4. Counts and pins

Counts after: **110 operations (unchanged), 85 audit types (+2), 51 actions (unchanged), 9 verify notices (+2)**; 41 server-listed audit types (+2); 30 optional manifest fields (+20); 10 advisory reasons (+5).

| File | Pin | From -> to |
|---|---|---|
| `SH/test/i18n-vocabulary-sync.test.ts` | type count; the last types; six positions | 83 -> 85; +1 assertion; each position -2 |
| `SH/test/api-registry.test.ts`, `api-domain-operations.test.ts`, `api-capture-discovery.test.ts` | type count (and the two titles that name it) | 83 -> 85 |
| `SH/test/evidence-verify.test.ts` | the notice list | 7 -> 9 names |
| `SH/test/evidence-package.test.ts` | the optional field list | 10 -> 30 rows |
| `SH/test/sim-capture-fault.test.ts` | "advice is INFO" for every advisory reason | now: INFO but for the three of `CAPTURE_ADVISORY_WARNING_REASONS`; counts 10 |
| `SH/test/sim-capture-telemetry.test.ts` | the case list of the advisory notices and its severity column | 5 -> 10 cases; the severity is the level table's |
| `CS/core/__tests__/writers.test.ts` | type count; listed types; four positions; the two key lists | 83 -> 85; 39 -> 41; each -2; +2 entries each |
| `CS/db/fixtures/__tests__/audit-details.test.ts` | allow-list count; the list of fixture-only types; two table lengths | 39 -> 41; +2 names; 83 -> 85 twice |
| `CS/capture/__tests__/fault-lifecycle.test.ts` | the list of notices a boot resolves (every advisory reason + the volume notice) | 6 -> 11 names (driver decision 8) |

`openapi.json` regenerated ONCE by `npm run openapi:gen` (the repository's generator; 110 operations, 1,716,480 bytes): the notice description of operation 41 and its bound, the two members of operation 84.

## 5. What row N2 did NOT build, and for whom

| What | Whose | Why |
|---|---|---|
| The seal's refusal `AUDIO_SHORTFALL_NOT_STATED`; the reader of `source_facts`; the member's writer in the pipeline | N12 | `SealingFailure` is the Core's list (`CS/sealing/pipeline/contract.ts`), not the shared package's |
| The three source-fact keys (`captureLayer`, `sampleContinuity`, `captureGroup`) and the word `NOT_CONTINUOUS` | N11 | the shared package declares no source facts of a session; `MIC_SOURCE_FACT_KEYS` is `CS/capture/fence/sources.ts` (reserved in wave 12). The closed words N11 needs are exported: `MANIFEST_AUDIO_CAPTURE_LAYERS`, `MANIFEST_AUDIO_CAPTURE_GROUP_MAX` |
| The writers of the two audit types; the windows, the reference, the raising of the five notices; the Core's floor constant (to be held equal to `MIC_SHORTFALL_FLOOR_PER_100K`) | N11 | - |
| The receiver's two lines (`CS/evidence-export/receiver-verify.ts`, `receiver-cli.ts`); the export manifest's `audioNotSampleContinuous` | N17 | the wording sources exist; the receiver's command does not print them yet |
| The three flag texts of the sealed transcript document, the derived mark, the renderings, the answer of operation 84, the seal's check | N18 | - |
| The README, the installer note, the hardware chapter; the Indonesian texts | N16 | - |
| The `SYSTEM_BOOT` example with `microphonePermission` and its detail rule | N13 (request line) | the brief gives row N2 two audit entries; the member's closed words stand nowhere in the design |
| `sharesDeviceWithPrimary` on the microphone's device shape | the web row | "only if the web row's check asks for it" (design 10.1) |
| Any screen | W5 and later | no line was needed in `apps/core-web` or `apps/mobile`: both typecheck clean |

NOT PROVEN: the fixture loaded into a real database (no database test was run: the two fixture rows are flat, hold no forbidden key and pass the audit writer in the unit suite); a session that carries the member through seal, verify, export and the receiver's verify (rows N12, N14, N17); a verifier OLDER than the member, which refuses a package that carries it (the safe side, design 8.4).

## 6. TWO FINDINGS THAT NEED A RULING (both in `delegation_progress/file_requests.md`)

**F-1. The designed account row cannot be written today.** `CAPTURE_AUDIO_SAMPLES_NOT_RECEIVED` with its thirteen numbers holds 19 keys (20 with `openRunFromSample`). The audit writer holds a native row to `NATIVE_PAYLOAD_KEYS_MAX` = 16 (`CS/core/limits.ts:51`; `payload-rules.ts:133`) and refuses such a row with `AUDIT_DETAILS_NOT_FLAT` before it looks at one key. Seen in the first Core run of this row: the fixture's closed account and two of the writer's accepted rows were refused. The design (section 8.4) read the table's flat CHECK and not this bound. What stands now: the closed list of 20 keys AS DESIGNED; the fixture and the accepted rows in the form `account: NONE` (6 keys); and an expectation in `writers.test.ts` that the designed CLOSED and NOT_CLOSED rows ARE refused (and that the same row cut to 16 keys is accepted) - it turns red on the day the bound moves. Ways out, the controller's: (a) for a type with a closed list the key bound is the list - recommended, a few lines of the audit writer, no other type gains a key; (b) the bound 16 -> 20 for every native row; (c) the account re-cut (a change of design 8.4 and of C112 (3)). BLOCKING for row N11's writer.

**F-2. Rule 5 against a worker that is killed.** A run row is written when the worker's record arrives; the account of a killed worker is its last PERIODIC one, up to 60 s older. A run that ended after that account lies past the account's `timelineSamples`, so rule 5 (built as worded) refuses the manifest and an honest session cannot be sealed. Fail-closed, and wrong for the user. Kept strict because a later relaxing breaks no sealed package while a later tightening would. Ways out in the request line. BLOCKING before row N12 closes.

## 7. DRIVER DECISIONS for the controller

1. **No new verification failure class.** A member that does not reconcile fails V-01 as `MANIFEST_FIELD_INVALID` (`UNREADABLE`), the code of every other schema refusal.
2. **Rules beyond the design's six are limited to the table's own bounds** (146, 150, 153 at most 144; 147, 149 at most 145; 151 at most 150 and 146) and ONE more (decision 3). Not added: `listedRuns + runsNotListed` at most `fedRuns`; a listed run at most `fedLongestRunSamples`; `runsNotListedSamples` at least 4,800 times `runsNotListed`; "group 2 only beside a group 1"; at most two records per attempt.
3. **One rule the design does not word**: the sum of `fedSamples` of an attempt is at most its largest `timelineSamples` (one microphone feeds the track at a time). Without it the verdict line could state more inserted silence than the track holds.
4. **The second form of the verdict line is reworded to fit 256 characters** ("Measured to sample Y only, rest NOT MEASURED: ..."), and it is also the form for a MIXED attempt (one account closed, the other `NONE`): the inserted total is then not whole, and the line says "measured only" rather than state a total as complete.
5. **The verify answer's bound of notices 8 -> 9**: with two codes more, nine can stand in one result and the Core's own answer would have failed its schema.
6. **The level is a level** (three advisory alerts with severity WARNING), not the word "Warning" inside an INFO sentence. One test of before pinned "advice is INFO" and was changed to the level table.
7. **The operator's words stand in a NEW group** (`common.micSameDevice`), not in the four existing groups: their key lists are pinned and their readers were not read. The statement's words (`common.audioNotSampleContinuous`) are this row's wording; the design names the members and the fixed sentence only.
8. **Outside the first claims line:** `CS/capture/__tests__/fault-lifecycle.test.ts` (a list pin of the advisory reasons, +5 names) and `SH/src/sim/index.ts` (one export line), `NEW SH/src/sim/audio-not-continuous.ts`. Claimed and NOT written: `i18n/en/devices.ts`, `session-new.ts`, `api/security-audit.ts`.
9. **`STANDBY_ON_PRIMARY_DEVICE` is resolved at a boot** with every other advisory reason (the Core's list is "every advisory reason"); whether that is wanted for a notice that can stand outside a session is row N11's (request line).

## 8. Checks

`--maxWorkers=2`; no database, no port, no process test. Sandbox off for the generator only (`tsx` binds a local pipe; the first try inside the sandbox failed).

| Check | Result line |
|---|---|
| shared, whole workspace (after the one `openapi:gen` and the last edit) | `Test Files 105 passed (105)`, `Tests 2900 passed (2900)` - the OpenAPI byte comparison is green |
| Core unit, targeted: `core/__tests__`, `db/fixtures/__tests__`, five `capture/__tests__` files of the notices and the wording, `fault-lifecycle`, `sealing`, `sealing-host`, `evidence-verify`, `evidence-export`, `test/static` | `Test Files 1 failed, 81 passed (82)`, `Tests 1 failed, 1520 passed (1521)` - the one failure is `sealing/__tests__/pipeline.test.ts:515`, NOT mine (the file is in flight, agent D1) |
| Core, the audit files alone after the last edit | `Test Files 13 passed (13)`, `Tests 440 passed (440)` |
| byte identity (section 3 (1)) | 3 runs, `Tests 1 passed (1)` each; `cmp` identical |
| committed against working tree (section 3 (2)) | 2 runs, `Tests 1 passed (1)` each; `cmp` identical |
| `npx tsc --noEmit`: shared, core-web, mobile, mock-core, transcriber | 0 errors in each |
| `npx tsc --noEmit`: core-server | 1 error, not in a file of this row: `src/modules/capture-config/network/__tests__/service.test.ts(237,9)` |
| `oxlint`: the shared workspace; the five Core files touched | 0 (one warning of my own test, removed) |

Runs repeated after a failure: `evidence-package.test.ts` five times - each failure was in my own new cases (a builder that dropped a `null` member instead of handing it to the schema - A BUG OF MINE, fixed in `build.ts`; three expectations that named one member where the schema names two; one that read the overall class of a harness that fails other checks too); `sim-capture-telemetry.test.ts` twice (my five new notices were counted among the three conditions of MIC-01: moved to MIC-02); the Core's audit files twice (finding F-1).

**Mutations seen RED** (each made, run, and taken back; nine):

| Test | Mutation | Red on |
|---|---|---|
| `writers.test.ts`, row N2 | `bufferedSamples` bound raised to one day | `bufferedSamples 96001` |
| | `samples` of a run admitted from 0 | `samples 4799` |
| | `captureLayer` given a second word (`ALSA`) | `captureLayer ALSA` |
| `evidence-package.test.ts`, "THE ACCOUNT RECONCILES" | the identity switched off | `timelineSamples 1` |
| | the overlap test of the runs switched off | the overlapping pair accepted |
| | "only beside `hostProfileNotAsked`" switched off | accepted without the host member |
| `evidence-package.test.ts`, the two notices | the inserted total taken from the microphone's `insertedSamples` | the closed line |
| `sim-capture-fault.test.ts`, row N2 | the share rounded instead of cut | the sentence of 13,250 |
| `sim-capture-telemetry.test.ts`, row N2 | the raise taking `INFO` for all five | two cases |

## 9. Rules kept

Edit tool only for every existing file; new files with Write (`SH/src/sim/audio-not-continuous.ts`, this record, `row_n2.md`, the two scratch files of section 3 (2)) or copied as scratch from row R1b's instrument (`.cache/task4-n2/identity.test.ts`, `vitest.config.ts`; one path in the copied config changed by a command, a scratch file of this row). `openapi.json` is the generator's. Nothing committed, staged, stashed or reverted. No full suite across workspaces (the shared workspace's own suite, as its single writer). No lock was needed: no database, no port, no worker, no device. `git archive HEAD` was the one git command that reads history. No `.env` read; nothing under `apps/input-av/data/`.

---
*Generated: 2026-10-14 09:20*
