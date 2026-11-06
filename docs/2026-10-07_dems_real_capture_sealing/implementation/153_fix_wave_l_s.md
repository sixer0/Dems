---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
row: fix wave L, driver L-S (apps/core-server + packages/shared)
date: 2026-10-11
agent: coder-execution
narrative_tier: 1
source: gateway_check/10d_m5_m6_recheck.md (G75d-01, -02, -04, -06), 09c_m4_recheck.md (G70c-01 hypothesis, -02, -04, -05), 12c_m7_recheck.md (G89c-01, -04), 13c_m8_recheck.md (G94c-01 cause); decisions D227, D228, D229, D230b; delegation_progress/fix_brief_wave_l.md
tree: b05106b + the uncommitted fix 151 + this wave (no commit, no migration: schema 6 / dbc-7; totals 97 / 36 / 61 / 67 unchanged; additive optional members only; OpenAPI regenerated under the lock)
status: needs-review (items 1, 2, 3, 4, 6, 7, 8 done; item 5 answered in the contract file, its "stop sending" half NOT done - decision 2)
---

# 153 - Fix wave L, driver L-S

Lane 2 was not called, started, stopped or reset by me. Lane 1 was stopped at my start (the first
`lane.sh stop 1` ran inside the command sandbox and could only send TERM; the second, outside it,
stopped PID 52989) and started again at my end (`scripts/lane/lane.sh start 1 >
.cache/gate-env/wave-l/start_1.log`, exit 0, PID 85523, not reset, health ok, 0 error-level lines).
No file under `.data/` was opened, no local device selected, no git write. Member names for L-W and
L-M: `delegation_progress/contract_wave_l.md` (first version 10:25, "LS consistent at 10:37").

## 1. Findings

| # | Finding | Cause (file:line at b05106b) | Change | Test (fails without the fix) | Status |
|---|---|---|---|---|---|
| 1a | G75d-01 the UNSEALABLE alert is ended by nothing | `packages/shared/src/sim/faults.ts:561` `acknowledgeAlertTransition` only set `acknowledged`; `endUnsealableTransition` (`session-machine.ts:1578`) raises the alert `active` and no transition ever resolved it (the restart rule of wave K is about `POWER_FAIL` only) | `faults.ts` `acknowledgeAlertTransition(state, alertId, now?)`: an ACTIVE unsealable notice acknowledged by a role that holds `UNSEALABLE_ACKNOWLEDGE_PERMISSION` (= `EVIDENCE_REVIEW`, SUPERVISOR; D228 (2)) is resolved (`active false`, `resolvedAt`) - also one somebody else had acknowledged - with ONE audit row `FAULT_CLEARED` (`sessionId` of the NOTICE, the operator, the sending device by the rule of `events.ts`, `details { reason, cause, alertId, operationId }`), no timeline event; `actions.ts:192` hands the instant in. The Core's operation 70 runs that hosted action: no change in `modules/alerts` | shared `sim-wave-l-s-unsealable-notice.test.ts` 2, 3, 4 (control 1: the rule before leaves it active, also through a later sealed session); db `wave-l-s-unsealable-ack.db.test.ts` (real engine, three processes) | done |
| 1b | the alert of session X drawn as the fault of session Y | CLIENT reading: `apps/core-web/src/features/session-monitor/model.ts:252-257` (`selectBanner`, RECORDING) takes `selectWorstAlert(s)` - the worst active alert of the whole Core - as the fault of the recording session. The server fact was right (`target` and `params.sessionId` name the session) | none on the server. Readers added so that clients test ONE thing: `isUnsealableAlert`, `alertBlocksRecording`, `openUnsealableNoticesOf` (`seal-unsealable.ts`); the exact rule is in the contract file section 1 | shared test 7, 8 | named for L-W; mobile `unsealable-notice.tsx:19` named for L-M |
| 1c | ONE fact for "an open notice that does not block recording" | none existed as one reading | `openUnsealableNoticesOf(state)` (every active notice, newest first, with `alertId` and `acknowledged`); `UnsealableNotice` gained those two members | shared test 7 | done |
| 2 | G75d-02 who may retry a blocked seal; does the Core retry by itself | facts exist: `sealAttentionOf(...).kind === 'BLOCKED'`; operation 33 is the retry (`modules/sessions/routes.ts:307`, `sealing-host/index.ts:628` `retryFailedSeal`), permission `SESSION_START` (`packages/shared/src/api/sessions.ts:423`); bounded design `sealing/pipeline/way-out.ts:61` (three retries 5 / 30 / 120 s, then WAIT) | no contract member. Two names for the existing rule: `SEAL_RETRY_PERMISSION`, `canRetryBlockedSeal(role)`, and `SEAL_AUTOMATIC_RETRIES` (= 3) in `seal-blocked.ts`. The design is KEPT: no automatic retry after the third; stated in the contract file section 2 | `wave-l-s-retry-sentence.test.ts` 3 (the shared constant IS the Core's bound; a fourth step is WAIT); shared test 9 | done |
| 3a | G75d-04 / G75d-09 (a) `resumed true` with no restart | `sealing-host/index.ts:635` `resumedSeals.add(sessionId)` in `retryFailedSeal` | removed: `resumed` of operation 83 is true only for a seal a START of the Core ran again. Description of the member (`sessions.ts:233`) says so | `sealing-host.test.ts` (appended assertions in "retryFailedSeal: true ONLY ...": `resumedSeal` false before, after the retry and after it settled) | done |
| 3b | "being retried" and "cannot be sealed" in one sentence | `way-out.ts:384` `sealRetryingNotice(next, reason)` with the reason of a cause no retry gets past, which ends ": this session cannot be sealed." (`contract.ts:239-256`) | `way-out.ts` `sealCauseWithoutConclusion`: the retry sentence states the cause and stops; the WAIT and the alert sentences are untouched | `wave-i-a1-way-out.test.ts` (pin moved by delta, with the finding as control); `wave-l-s-retry-sentence.test.ts` 1, 2 | done |
| 3c | the web's "Finalizing evidence / 0% / Resumed after restart" at the UNSEALABLE end | CLIENT: operation 83 answers 404 for an ended session (`modules/sealing/index.ts:56`) and the dialog kept its last body; its "Resumed" is `apps/core-web/src/features/session-monitor/sealing-progress.ts:109` `resumed: attempt > 1`, not operation 83's member | none on the server beyond 3a; the terminal facts are named in the contract file section 3; `SEAL_UNSEALABLE_PLAIN_SENTENCE` added for a surface that must not print the code in brackets | shared test 8 | named for L-W / L-M |
| 4 | G89c-04 the sealed format on the item | `evidence-facts/sealed-facts.ts:55` restated the manifest's tracks without `profile`; no member for the notice | `EvidenceItemSchema.files[].profile` (optional; the SIGNED manifest's field 36) through `SealedFileFact.profile` - so it is on the replicated item, operations 39 and 40; `evidence.streamProfileNotice` (optional, operation 40) from the alert the seal wrote (`evidence-facts/index.ts` `streamProfileNoticeOf`). Examples `EVIDENCE_SEALED_PROFILE_EXAMPLE`, `EVIDENCE_STREAM_PROFILE_NOTICE_EXAMPLE`. `profileId` untouched | `wave-l-s-sealed-profile.test.ts` 1-5; db `detail-facts.db.test.ts` (pin by delta + one new case through the route) | done |
| 5 | G75d-06 / G70c-02 / G89c-01 what is a fact | the device slice of a real-capture Core carries the seed dataset's `model` / `firmware` / `poePort` for the built-in FAKE sources (`db/seed/seed.ts:172-175` -> `db/mapping/rows.ts:864`); `adapter` / `sourceClass` are facts (`modules/devices/source-facts.ts`); the simulator's `cameras` / `mics` / `otherDevices` / `ports` slices are model values there | none in code (decision 2). Contract file section 5: member by member, real or "model value - not to be drawn", the client rule (`adapter === 'FAKE'` -> named as generated, never by `model`), and the members for G89c-01 (`sealedPackage === 'PRESENT'`, `integritySource`, `manifestHash`) | - | answered; "stop sending" NOT done |
| 6a | G70c-04 boot line `locked true` | `modules/capture-config/store.ts:58` `EXISTS (SELECT 1 FROM public.active_session)` | the statement reads `... s WHERE s.state <> 'SEALED'` - the rule of operation 76 (`isSessionActive`) | `wave-l-s-open-session.test.ts` 4 (text of the statement); lane 1's boot line read `locked false` at my start (no proof: lane 1 holds no sealed session row) | done; NOT driven on a database that holds a SEALED row (re-drive 5) |
| 6b | G70c-05 search rows name a sealed session | `modules/capture-discovery/index.ts:146-150` handed "the session in the state" to the runner | `search.ts` `openSessionOf` (null for no session and for a SEALED one), used by the module at one place | `wave-l-s-open-session.test.ts` 1-3 | done |
| 7 | G94c-01 the Core's half | measured, NOT a defect of the Core: section 2 | none in `media-stream`. Exported `MEDIA_FRAGMENT_NOT_AUTHENTIC_EXAMPLE` / `_REASON` (`packages/shared/src/api/evidence.ts`) | `wave-l-s-cut-socket.test.ts` 1-3 (real loopback socket; 2 holds the Core's 409 body equal to the example) | done; the client fix is L-W's |
| 8 | README "measured frame rate" | `README.md:644` | one sentence: the format the stream DECLARES, never a measured average | - | done |

## 2. G94c-01 - what the Core does on the wire

`wave-l-s-cut-socket.test.ts` serves the app's own request handling behind a plain loopback
listener and reads with `node:http` on a keep-alive agent. For `range: bytes=0-` over a file whose
third fragment was altered: status `206`, `content-length` = the whole file, `content-range` whole;
the body is exactly the bytes before the fragment; then `response.complete === false`, the
`aborted` event, the socket destroyed, within 2 s (it took milliseconds); the agent keeps no free
socket. The request from the byte of the cut answers `409` in JSON, complete, on a connection that
stays usable. Control: an unaltered file completes and its connection is reused. So the Core
already DESTROYS the socket (Fastify's stream handling on a source that errors) - it does not end
the response - and there is no further signal it could give without changing an answer whose
status and length are on the wire. The hang is between the dev server's proxy and the browser.
What the web side can do is written in the contract file section 7.

## 3. Files

| File | Change |
|---|---|
| `packages/shared/src/sim/seal-unsealable.ts` | readers, the permission, the plain sentence, two example alerts |
| `packages/shared/src/sim/seal-blocked.ts` | `SEAL_AUTOMATIC_RETRIES`, `SEAL_RETRY_PERMISSION`, `canRetryBlockedSeal` |
| `packages/shared/src/sim/faults.ts`, `actions.ts` (one line) | the acknowledgement rule |
| `packages/shared/src/api/{alerts.ts,sessions.ts,state-slices.ts,evidence.ts}`, `openapi/openapi.json` | op 70 description + `also: [FAULT_CLEARED]`; `resumed`; `files[].profile`, `streamProfileNotice`; three examples |
| `apps/core-server/src/evidence-facts/{sealed-facts.ts,index.ts}`, `engine/{sealed-facts-doors.ts,index.ts}` | item 4 |
| `apps/core-server/src/sealing-host/{index.ts,progress.ts}`, `modules/sealing/index.ts` (comment), `sealing/pipeline/way-out.ts` | item 3 |
| `apps/core-server/src/modules/capture-config/store.ts`, `modules/capture-discovery/{index.ts,search.ts}` | item 6 |
| tests | NEW six `wave-l-s-*` files (five core-server, one shared); by delta: `sealing-host.test.ts`, `wave-i-a1-way-out.test.ts`, `detail-facts.db.test.ts`, shared `api-registry.test.ts`, `sim-m7b-unsealable.test.ts` |
| `README.md` | one sentence |
| docs | `delegation_progress/contract_wave_l.md` (NEW), `file_claims.md` (2 lines), this note, `delegation_progress/coder_execution_wave_l_s.md` |

## 4. Tests run (one run after the last change; a second run only after a fail)

| Check | Command (repository root; outside the sandbox where it binds loopback or PostgreSQL) | Result |
|---|---|---|
| shared, touched files + registry / OpenAPI / example pins | `npx vitest run --root packages/shared sim-wave-l sim-m7b api-registry api-examples openapi.test api-openapi-scope api-state-examples sim-contract` | `Test Files 8 passed (8)  Tests 149 passed (149)` |
| core-server unit, touched files + `test/static` | `npx vitest run --root apps/core-server --project unit src/modules/alerts src/modules/capture-discovery/__tests__/{wave-l-s-open-session,search,static}.test.ts src/modules/capture-config src/modules/media-stream src/evidence-facts src/sealing-host/__tests__/{sealing-host,wave-i-a1-progress}.test.ts src/sealing/__tests__/{wave-l-s-retry-sentence,wave-i-a1-way-out,way-out}.test.ts src/modules/sealing test/static` | `Test Files 39 passed (39)  Tests 447 passed (447)` |
| core-server unit, the wider areas (run once before the last two edits) | `... src/modules/alerts src/modules/sealing src/modules/capture-discovery src/modules/capture-config src/modules/media-stream src/media-stream src/evidence-facts src/sealing-host src/sealing src/engine src/modules/evidence src/modules/sessions test/static` | `Test Files 1 failed | 107 passed (108)  Tests 1 failed | 1545 passed (1546)`; the one red (`alerts/__tests__/acknowledge.test.ts`: the transition read the actor of a state that has none) was mine and is fixed; its folder re-run `3 passed / 70 passed` |
| db | `/usr/bin/lockf -k .locks/db-migrate.lock npx vitest run --root apps/core-server --project db src/modules/alerts src/modules/evidence/__tests__/detail-facts.db.test.ts src/modules/capture-discovery src/modules/capture-config src/modules/sealing src/engine/__tests__/{unsealable-doors,sealing-notice-doors}.db.test.ts src/modules/sessions` | `Test Files 21 passed (21)  Tests 142 passed (142)` |
| typecheck | `npx tsc --noEmit -p packages/shared`, `-p apps/core-server` | 0 errors, 0 errors |
| lint | `npm run -s lint -w @dems/shared`, `-w @dems/core-server` | clean, clean |
| OpenAPI | `/usr/bin/lockf -k .locks/npm.lock npm run -s openapi:gen -w @dems/shared` | `97 operations` |

Runs that failed on the way and why: the db test's second process needed a later clock (the
test's defect); the socket test first used the app's `listen()` (it starts the realtime pacing,
which the stand-in engine refuses) and read `response.socket` after a completed keep-alive answer;
an extra log line I had put into `modules/alerts` broke that folder's static rules ("ONE log
call") and was taken out again - the module is byte for byte as committed.

Negative controls: shared test 1 (the finding), 5 (two roles do not close it), 6 (a fault alert is
never closed by an acknowledgement); sealed profile 2 (a value outside the pattern is not
restated), 4 (another session, another reason, unreadable tracks: no notice); socket 3.

## 5. Checks for the test runner

| Command | Lock | Expected | Why |
|---|---|---|---|
| `npm test -w @dems/shared` | none | green | whole suite; `UnsealableNotice` has two more members |
| `npm test -w @dems/core-server` | none (loopback: outside the sandbox) | green | whole suite, incl. the static rules over the new files |
| `npm run test:db -w @dems/core-server` | `.locks/db-migrate.lock` | green | operation 40 answers `files[].profile`; `acknowledgeAlert` may write a row |
| `npm test -w @dems/core-web`, `-w @dems/mobile` | none | a test that expects `unsealableNoticeOf(...)` to equal exactly `{ sessionId, cause, at }`, the retry sentence with ": this session cannot be sealed.", or `files[]` of a real item without `profile` is a stale pin of L-W / L-M | consumers |
| seal e2e and the kill matrix | `.locks/heavy-host.lock` + db lock; lane 2 DOWN (ports) | 3 of 3; 35 of 35 | `way-out.ts` and the sealing host were touched (sentence and the resume mark only) |

## 6. Re-drive list (lane 2, after L-W restarted it)

1. `GET alerts`: `ALR-000049` `active true, acknowledged true`. As the INVESTIGATOR: acknowledge -> still active, no new audit row. As the SUPERVISOR: acknowledge -> `active false`, `resolvedAt`; ONE `FAULT_CLEARED` row with `sessionId SES-20261011-0041`, the supervisor, `details.reason UNSEALABLE`, `alertId ALR-000049`; from a device: its `deviceId`. A restart before the acknowledgement: still active.
2. With the notice open, record a session: the web Monitor banner is not "FAULT ... could not be sealed" (L-W's reading); `GET alerts` still lists the notice with `params.sessionId` of the OTHER session.
3. Rig `blocked`: after the third retry no fourth run; `release`; op 33 as the investigator -> 202, sealed; op 83 during that retry: `resumed false`. Core stopped and started during a seal: `resumed true`.
4. Rig `unsealable`: the step sentence at retry 1 and 2 holds no "cannot be sealed"; at the end `session/current` none, op 83 404, the notice open.
5. Core log line `CAPTURE_CONFIG_LOADED` at lane 2's start: `locked false` (its last session is SEALED).
6. A camera search with no session open: the row has no `details.sessionId`; during a recording it has.
7. `GET evidence/EV-20261011-0032`: `files[].profile` `H264_720P30` twice, no `streamProfileNotice`; `EV-20261011-0025`: `H264_720P27.67` / `H264_720P26` and `streamProfileNotice` (its alert `ALR-000033` is in the list).

## 7. Decisions for the controller

1. **Who closes the notice.** There is no "alert-acknowledge permission": operation 70 is for every signed-in role. I held D228 (2) ("a supervisor") with `UNSEALABLE_ACKNOWLEDGE_PERMISSION = EVIDENCE_REVIEW` (SUPERVISOR only today); another role's acknowledgement is recorded and leaves the notice open, and `canResolveUnsealable(role)` tells a client which it is. One constant to change if every role should close it.
2. **The device slice still sends the dataset's `model` / `firmware` / `poePort` for the built-in FAKE sources.** They are REQUIRED (nullable) members of a stored registry row. Sending null means changing the engine's state, and the write-through then rewrites `capture_devices` of the lane's database - a change of stored rows I did not make without a ruling. The contract file marks them "model value - not to be drawn" and gives the client rule. Options: (a) accept; (b) null them in the WIRE form only (a mapping step between the state and the slice a client reads - new code in the slice publisher); (c) clear the columns at a real-capture boot, as wave K did for the selector profile (`capture/fence/fake-profile.ts`).
3. **The audit row of the acknowledgement is `FAULT_CLEARED`** (67 types unmoved) with no timeline event, and names the session of the notice. Operation 70's registry entry now lists it under `also`; `success` stays "none (parity)".
4. **`resumed` is narrower** than "a start of the Core or the recovery action": only a start. A client that wanted "this seal was run again on demand" has no member for it; none asked.
5. `streamProfileNotice` is read from the alert list (the newest 100 alerts): for an old item whose alert left the list the member is absent. The manifest's own value is always on `files[].profile`.
6. G70c-01 (the tablet tiles): the hypothesis names a client expression (`state.session?.captureConfig ?? state.captureConfig`). The server's `session/current` answers `captureConfig: null` for a sealed session per the gate; I changed nothing there and did not examine the replicated `session` slice of a SEALED session - L-M's finding to confirm on the device.

## 8. Open items

- Decision 2 (item 5, second half).
- Not proven by me: everything in section 6 (no lane 2 call); the whole suites and the heavy runs of section 5; item 6a on a database that holds a SEALED session row.
- Lane 1 runs the new code (PID 85523), not reset; it still has no paired device (note 08).

---
*Generated: 2026-10-11 10:45 WIB*
