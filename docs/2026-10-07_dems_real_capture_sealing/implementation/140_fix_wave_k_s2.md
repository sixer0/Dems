---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
date: 2026-10-11
agent: coder-execution (fix wave K, driver S2)
source_plan: docs/2026-10-07_dems_real_capture_sealing/delegation_progress/fix_brief_wave_k.md
status: completed
---

# 140 - Fix wave K, driver S2: transcript revisions, verify / export rows, sending device, STT pending fact, item provenance, export default

Tree: `57b80a9` + the in-flight edits of wave K. No commit, no migration (schema 6 / `dbc-7`),
totals 97 operations (36 GET / 61 POST) / 67 audit types unchanged. Step 0: lane 1 stopped
(`lane.sh: lane 1 stopped (was PID 49865); port 4421 is free`, 00:31 WIB; the first call inside
the command sandbox could only send TERM and reported exit 69 - the second, outside it, stopped the
lane). Lane 2 was not touched; no lane was started.

## 1. Findings

| Finding | Reproduced? | Cause (file:line at `57b80a9`) | Change | Test (fails without the fix) | Status |
|---|---|---|---|---|---|
| **G81b-01** op 85 signs a revision whose `from` is not the segment's text (D221 (2)) | YES - with the check neutralised the two new route cases are red (`Tests 3 failed \| 28 passed (31)`, the third is G81b-05) | `modules/transcripts/routes.ts:429` held only "the segment exists" | `routes.ts:173` `staleFromOf` (pure): current text = the `to` of the newest stored revision that changed the segment, else the sealed text; `:510` the check, INSIDE the unit, AFTER the head check (a stale base stays `409`) and on the list the unit settled; `422 INVALID_INPUT`, `details {in, member, reason: REVISION_FROM_NOT_CURRENT_TEXT, segmentIndex, currentRevision}` (`:152`, sentence `:162`). Thrown before the signer signs, before `appendRevision`, before the audit row and before the staged list - nothing is written. Stored revisions are read for their `to` only: a stored false `from` (the planted revision 4 of `EV-20261010-0020`) is not re-judged, and the verifier was not touched | `transcript-routes.db.test.ts` describe "FIX WAVE K, G81b-01" (2 cases: refusal writes no row / no audit row / list byte-identical + control 201; head's text accepted, sealed text of a revised segment refused, moved head 409 for a false AND a true `from`); `wave-k-s2-from-current.test.ts` (4 cases incl. "stored data is not re-judged") | done |
| **G89b-04** verify rows: no device, no `operationId`, the failed row names only the file | YES - shared test red with the rule neutralised (`Tests 4 failed \| 3 passed (7)`) | hosted verify `packages/shared/src/sim/evidence-actions.ts:102` and the Core's own verdict `session-machine.ts:1633-1640` wrote no device; the verdict record had no fragment list | see section 2; `EvidenceVerdictInput` + three optional members (`session-machine.ts:1612-1622`), row `:1659-1660` (`failedFragments` `<trackId>:<seq>`, at most 8, `failedFragmentCount`, `operationId`); `VerdictRecord.failedFragments` (`evidence-verify/index.ts:103`, `:359`); the seam hands device + operation in (`sealing-host/index.ts:734-737`, ONE call) | `sim-wave-k-s2-sending-device.test.ts` cases 1, 5; `seal-actions.db.test.ts` "G89b-04" (stored rows); pins `core-verification.test.ts`, `real-fragment-cipher.test.ts` | done |
| **G94b-03** export + the verify before it from the tablet: no device | YES (same red run) | `evidence-actions.ts` export rows wrote no device | section 2 (the rule) | shared cases 2, 4; `wave-k-s2-sending-device.db.test.ts` case 1 (stored rows `EVIDENCE_VERIFIED`, `EXPORT_DENIED`, `EVIDENCE_EXPORTED` = `DEV-0001`) + web control | done |
| **G75c-09** `SUMMARY_ACKNOWLEDGED`, `RECOVERY_STARTED` from a device | YES (same red run) | `session-machine.ts:1706`, `:1922` | section 2 (the rule) | shared case 3; db case 1 (`SUMMARY_ACKNOWLEDGED`) | done; `RECOVERY_STARTED` proven in the shared test only (the db rig has no fault door for a device principal) |
| **G81b-05** `pendingForNextSession` true with no session open | YES - red with the rule neutralised | `modules/stt-config/statements.ts` `SESSION_FACT`: "a row in `active_session`", which the last SEALED session keeps | `statements.ts:76-77`: the row counts only while `state <> 'SEALED'` (the simulator's `isSessionActive`). The same fact drives `appliesFrom`: a change after the seal applies `NOW`. The simulator was already right (`sim/api.ts:1044`) | `stt-config.db.test.ts` "G81b-05" (row of a SEALED session: pending false, a change answers `NOW` / false; control before and after: an open session = pending true) | done |
| **G81b-06** transcript model on no client | the ITEM did not carry it (only op 41) | - | additive `EvidenceItem.transcriptModel` (`api/state-slices.ts:847`, schema `EvidenceTranscriptModelSchema`), read by the sealed-facts reading from the ONE verifier's statement of a manifest whose signature held (`evidence-facts/sealed-facts.ts:65-74`), put on the replicated item by the door (`engine/sealed-facts-doors.ts:141-149`), laid over ops 39 / 40 (`evidence-facts/index.ts:114`). Names in `contract_wave_k.md` (written 00:35) | `wave-k-s2-transcript-model.test.ts` (6: local, server = name + three nulls, DISABLED = none, NEGATIVE CONTROL broken signature = none, door set / replace / remove, examples); `detail-facts.db.test.ts` (op 40, replicated item, op 39; control: a demonstration item states none) | done (server half); clients = W, M2 |
| **G94b-11** default destination "(simulated)" on a real-capture Core | YES - unit case 3 shows the simulator's text for the same request not handed the default | the route handed `destination: ''` and the simulator named ITS default (`evidence-actions.ts:50`) | `modules/evidence/export-request.ts` `exportDestinationDefaultOf` / `withDestinationDefault`; route `index.ts:294`: a Core in its own capture hands `Case file transfer` in (constant `DEFAULT_EXPORT_DESTINATION_REAL`); a Core in simulated capture hands the request on unchanged | `wave-k-s2-export-default.test.ts` (4) | done |
| **G94b-12** web and mobile default differ | server gave none | - | `EvidenceDetail.exportDestinationDefault` (op 40, `index.ts:237`; schema `api/evidence.ts:164`) | same file case 4; `wave-k-s2-sending-device.db.test.ts` routes case; pin `reads.db.test.ts` | done (server half); clients = W, M2 |
| **G94b-06** "The export is stored on the Core" on a SIMULATED item | the sentence is CLIENT-DRAWN (`i18n/en/evidence.ts:588` `onCore`) | no server text holds it | so that no client infers: `EvidenceExportAccepted.archiveOnCore` (op 42, `index.ts:318`): `true` = a job of this Core writes an archive, `false` = recorded only | db routes case (`false`), `evidence-export/__tests__/routes.test.ts` (`true` for a job) | done (server fact); wording = W, M2 (contract section 3) |
| **G89b-02** documentation request | - | - | line in `file_requests.md` (00:52) | - | filed |

## 2. The sending device - the rule and the sweep

Wave I named six session rows one by one. The rule of D216 (2) is now held where every row of an
action is written: `packages/shared/src/sim/events.ts:274` `auditWithActingDevice`, called by
`appendActivity` (`:297`): **the acting identity holds a paired device (`auth.deviceId`, set by
the Core for ONE hosted command - `engine/actor-scope.ts`), the row's actor is that identity, and
the row names no device of its own -> the row's `deviceId` is the paired device.** No `details`
key. Not touched: a row with its own device, a row without an actor, every row of a web console
session, the simulator inside an app (no device in `auth` - no client pin moves).

| Row type (route reachable by a device session) | Writer | Carries the device now? |
|---|---|---|
| `SESSION_CREATED`, `PRECHECK_PASSED` / `_BLOCKED`, `RECORDING_STARTED` / `_STOPPED`, `SESSION_CANCELLED` | hosted action | yes (wave I; now also by the rule) |
| `SUMMARY_ACKNOWLEDGED` | hosted `acknowledgeSummary` | **yes, new** |
| `RECOVERY_STARTED` of the operator's `recover` (and the `SYSTEM_BOOT` row beside it keeps the Core's own device) | hosted `recover` | **yes, new** |
| `EVIDENCE_VERIFIED` / `EVIDENCE_VERIFY_FAILED` (demonstration item) | hosted `verify` | **yes, new** (+ `operationId`) |
| `EVIDENCE_VERIFIED` / `EVIDENCE_VERIFY_FAILED` (sealed package) | INTERNAL `recordEvidenceVerification` (nobody in `auth`) | **yes, new** - handed in by the seam (+ `operationId`, `failedFragments`) |
| `EVIDENCE_EXPORTED` (request; also the DEFERRED request of a job), `EXPORT_DENIED` of the hosted action | hosted `exportEvidence` | **yes, new** |
| every other row a hosted action writes with the operator as its actor | hosted actions | **yes, new** (the rule). The shared sweep case drives marker, note, snapshot, archive, audit export and alert acknowledge from a device and asserts that EVERY row the operator wrote names it; actions it does not drive are covered by the rule, not by a case of their own |
| device command rows (`deviceCommand`), capture-selector rows | hosted | a row that names the device it is ABOUT (a camera, a microphone) keeps it - the rule never overwrites a device; the selector rows keep `details.sendingDeviceId` as wave H wrote it. A device-command row therefore does NOT name its sender (one column, two meanings: for the controller) |
| `AUDIO_SOURCE_SWITCHED` | `capture-session/index.ts:1265` | yes (wave H) |
| sign-in / sign-out / lockout / biometric rows, pairing rows | `modules/identity`, `modules/pairing` | yes (before) |
| `ACCESS_DENIED` of the permission guard, of the transcript case scope, of the media unit, `EXPORT_DENIED` + download rows of the export service | `permission-guard/decision.ts:181`, `transcripts/routes.ts:362`, `media-stream/service.ts:253`, `evidence-export/service.ts:171` | yes (before) |
| `TRANSCRIPT_REVISED`, `STT_CONFIG_CHANGED`, `ROLE_CHANGED` / `USER_*`, `CAPTURE_DISCOVERY_SEARCHED`, camera connect / adopt / credential rows | their modules (`principal.deviceId` / `actor.deviceId`) | yes (before) |
| `EVIDENCE_EXPORT_FAILED` of a job, engine-timed rows (`PRECHECK_*` on a tick takes the pre-check's device; seal, fault, boot rows) | the Core itself, no actor of a request | no, by the rule: nobody sent them |
| **demo controls: the lineage / `SCENARIO_LOADED` row of a reset and the `ACCESS_DENIED` of a refused reset** | `db/reset/routine.ts`, `modules/demo/host.ts:98` (`deviceId: null`) | **NO - not fixed**: the row is built inside the reset routine (`src/db/reset`, wave I A1's area, not in S2's), a demonstration control only. Decision for the controller |

## 3. Pins moved by delta (no acceptance pin moved: `test/acceptance` 8 files / 162 tests green as they are)

| File | Delta |
|---|---|
| `modules/transcripts/__tests__/transcript-routes.db.test.ts` | three requests re-sent the SEALED text as `from` for a segment a revision had already changed (the defect, in the test): `from` is now the text before (`:471` list case, `AFTER_FIRST` in two cases) |
| `evidence-verify/__tests__/core-verification.test.ts`, `real-fragment-cipher.test.ts` | the verdict record has `failedFragments` (`[]`, `['VIDEO-02:3']`) |
| `modules/evidence/__tests__/routes.test.ts`, `commands.db.test.ts` (2), `bulk.db.test.ts`, `modules/evidence-export/__tests__/routes.test.ts` | op 42 answers `archiveOnCore` (false; true asserted for a job) |
| `modules/evidence/__tests__/reads.db.test.ts` | op 40 has a fourth top-level member `exportDestinationDefault` |

## 4. Test results (each once; a second run only after a fail)

| What | Result |
|---|---|
| shared: `test/sim-wave-k-s2-sending-device.test.ts`, rule neutralised | `Tests 4 failed \| 3 passed (7)` |
| shared: the same, fixed | `Tests 7 passed (7)` |
| shared: `test/api-* openapi sim-api sim-contract sim-core-driven-seal sim-evidence sim-export ... sim-wave` | `Test Files 36 passed (36)`, `Tests 655 passed (655)` |
| shared: `test/sim*` | `Test Files 40 passed (40)`, `Tests 520 passed (520)` |
| core-server db, the two server rules neutralised | `Tests 3 failed \| 28 passed (31)` (G81b-05, G81b-01 x2) |
| core-server db: transcript-routes, stt-config, wave-k-s2-sending-device, detail-facts, seal-actions | `Test Files 5 passed (5)`, `Tests 51 passed (51)` |
| core-server db: `test/acceptance` + transcript-routes | `Test Files 8 passed (8)`, `Tests 162 passed (162)` |
| core-server db: engine, sessions, capture-config, evidence, evidence-export, evidence-facts, stt-config, security-audit, pairing, permission-guard | 60 files / 622 tests: 4 red - 3 mine (pins of section 3, moved, re-run green: `Tests 76 passed`, `33 passed`), 1 NOT mine: `engine/__tests__/commands.db.test.ts` "the log of the engine" names `restartFaultEnded` (S1's new log line) |
| core-server unit: evidence, transcripts, stt-config, evidence-facts, evidence-verify, engine, evidence-export, sealing-host, test/static, core | 96 files / 1297 tests: 6 red - 5 mine (pins, moved, re-run `Test Files 8 passed`, `Tests 178 passed`; then `3 passed / 28`), 1 NOT mine: `engine/__tests__/static.test.ts` lists `src/engine/restart-fault.ts` (S1's new file) |
| final run of the wave K S2 files (db 5 files, unit 9 files) | `51 passed`, `67 passed` |
| typecheck `packages/shared` | clean |
| typecheck `apps/core-server` | one error, NOT mine: `src/transcription/index.ts(438,62)` (S1, in flight) |
| lint `packages/shared`, `apps/core-server` | clean |
| OpenAPI generator under `.locks/npm.lock` | `97 operations ... 1360051 bytes` |

## 5. Checks for the test runner

| Command | Lock | Expect |
|---|---|---|
| `npm test -w packages/shared` | - | green |
| `npm test -w apps/core-server` (sandbox off: loopback) | - | green except S1's two pins above until S1 moves them |
| `/usr/bin/lockf -k .locks/db-migrate.lock npm run test:db -w apps/core-server` (sandbox off) | db-migrate | green except S1's log pin |
| `npm test -w apps/core-web`, `-w apps/mobile`, `-w apps/mock-core` + their typechecks | - | green: the shared changes are additive; the one row change the in-app simulator sees is `details.operationId: verifyEvidence` on its verify rows (the device rule does not act inside an app) |
| kill matrix, seal e2e, development e2e | heavy-host | unchanged (not run by S2) |

## 6. Re-drive list (device / browser, after lane 2 is restarted on this code)

| Gate check | Drive | Expect |
|---|---|---|
| 81 G81b-01 | API: op 85 on a sealed item with a false `from`; then the true text | 422 `REVISION_FROM_NOT_CURRENT_TEXT`, no audit row, list unchanged; 201. `EV-20261010-0020` still verifies 15 of 15 with its planted revision 4; its next revision of segment 4 must start from revision 4's `to` |
| 81 revise from web and tablet | a second correction of an already corrected segment | accepted (both clients send the text on screen) |
| 81 G81b-05 | seal + acknowledge, save an STT change, read op 90 | `pendingForNextSession: false`, the answer of the save `appliesFrom: NOW`; during an open session: true |
| 81 G81b-06 | op 40 of a transcribed item after the restart | `evidence.transcriptModel` with four members and the report line |
| 89 G89b-04 / 94 G94b-03 / 75 G75c-09 | tablet: verify (pass + tamper demo), export, Summary Back; phone lane 1: Close session | rows with `deviceId: DEV-…`; verify rows with `operationId`; the failed row with `failedFragments: VIDEO-02:3`; the same from the web: `null` |
| 94 G94b-11 | API export without a destination on lane 2 | row, custody and export manifest say `Case file transfer` |
| 94 G94b-06 / -12 | op 42 on a lane 1 demonstration item; op 40 on both lanes | `archiveOnCore: false`; `exportDestinationDefault` true to the lane |

## 7. Decisions for the controller

1. **The device rule is central, not per row** (`events.ts`): every row a hosted action writes for the acting operator names the sender. It is wider than the four row types of the task (markers, notes, snapshots, archive, audit export, alert acknowledge too) - the sweep asked for it, and a row type added later cannot miss it.
2. **Demo reset rows carry no device** (section 2, last row) - left; needs `src/db/reset` and `modules/demo`.
3. **`operationId` is on the simulator's own verify row too** (in-app Simulated mode): one detail key more on those rows.
4. **The item's model is a top-level member `transcriptModel`**, not inside `transcript`: it comes from the sealed-facts reading (signed manifest), which exists also where the summary does not yet; same name and shape as op 41's.
5. **A Core in simulated capture keeps "(simulated)"** as its default destination, also for a seed-sealed item whose export is a real job there: the default follows the Core's mode, as ruled.
6. Chunk count and language are NOT added to the item (G81b-06 names them as not shown; no ruling asked for them) - one line if wanted.
7. `transcriptModel` reaches an item at the Core's next start for items a running Core had already read.

## 8. Open items

- Clients: W and M2 read `transcriptModel`, `exportDestinationDefault`, `archiveOnCore` by the names of `contract_wave_k.md`.
- S1's three in-flight reds named in section 4 are S1's to close.
- The seam line in `sealing-host/index.ts` (device + operation of a real verification) is proven below it (the door, stored rows) and above it (the verdict record); the one call itself is proven only by the re-drive (tablet verify on lane 2).

---
*Generated: 2026-10-11 00:55 WIB*
