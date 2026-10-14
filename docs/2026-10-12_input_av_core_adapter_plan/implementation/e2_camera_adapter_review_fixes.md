---
task_id: 2026-10-12_input_av_core_adapter_plan
row: E2 (wave 12, track D; decision C113)
date: 2026-10-14
agent: coder-execution (agent E2)
tier: T2
source: verification/060e_m3_review_fifth_pass.md (findings E-02, E-03, E-04, E-05); decisions C46, C50, C60 (2), C99, C108, C113
status: complete on doubles - the adapter's DATABASE suites were NOT run (the db-migrate lock was held through two bounded waits); three request lines left
---

# Row E2 - the camera adapter: four findings of the fifth review pass

## 1. What, why, for whom

| | |
|---|---|
| What | E-04 (a re-open the session could not match), E-02 (optional members that fail open), E-03 (the watch kept loss state across sessions), E-05 (row V6b's guard missing in the session file) - fixed in `apps/core-server/src/capture/adapters/camera/`, each with a case seen RED on a mutant |
| Why | Decision C113: E-04 decides what a SIGNED manifest says of an absent camera (before M6); E-02, E-03, E-05 are ticks of the lift (row 88) |
| Who reads this | the controller; row E3 (capture-session); row 88 (the lift); the security acceptance |
| How it was checked | unit suites on doubles and the fake ONVIF stub on loopback; mutants made in place with the Edit tool and taken out again; typecheck of the Core workspace. No relay, no test camera, no device, no C, no binary rebuilt |

## 2. E-04 - the choice, and what the session now receives

**The defect (confirmed by reading and by mutant M1).** `legReported` moved its open number to a later `LOST` without telling anybody and then handed the `REOPENED` of that later number on. The watch matches by relay: it cleared the fault. The session matches by number (`capture-session/index.ts`, `open.loss !== leg.loss`): it kept the absence open and signed `NOT_RE_OPENED`.

**The choice: hand on, never refuse - under the number that was TOLD.** The rule of the fix is one sentence: *a listener hears every absence as ONE pair under ONE number*. The slot now keeps `lossTold` (the number a `LOST` went out under and whose re-open did not) apart from `lastLoss` (the highest number any taken line named).

| What arrives | What the adapter does | Why this leaves the session's record TRUE |
|---|---|---|
| `REOPENED m` while a loss `n` is told, `m` = the highest number heard or higher (a re-open line and perhaps a loss line were dropped) | hands `REOPENED` with `loss: n`, `through: m`, and the relay's numbers of loss `m` | the camera delivers again now (the relay forwards from a keyframe). The session closes the absence it knows: its span on the Core's clock covers every loss from `n` to `m`; `gapMs` of `m` is a true LOWER bound; "at most" is the Core's span plus 5,000 ms, as before |
| `REOPENED m` while NO loss is told, `m` higher than any number heard (the loss line was dropped, or the two came the wrong way round) | hands BOTH facts in order, in one turn: `LOST` with `loss: m`, cause `LOSS_NOT_TOLD`, then `REOPENED` with `loss: m` | the camera WAS away - the relay measured it. Refusing would leave a gap in the recording that no signed member states, and no fault could be "kept" because none was raised. The session's bounds become `gapMs` to `gapMs + 5,000` (its own span is about 0): both true |
| `REOPENED m` with `m` BELOW the highest number heard (a late or repeated line: a loss came after it) | dropped, counted, noted; what was told stays told | row R1's decision: a doubt about order KEEPS the fault. The absence stays open on both readers |
| `REOPENED` of a number heard already while nothing is told; a `LOST` whose number was said already | dropped, counted, noted | a repeat is no new fact |
| `LOST m` while a loss is told | nothing told (the absence goes on under its number); noted | unchanged from row R1 |
| any leg line before the push is established | dropped; a re-open of such a loss after the push is dropped too (`lossBeforePush`) | no loss inside a session |

**What a `LOST` put together by the adapter CANNOT state** (written in the type's comment): when the loss began - the listener learns of it at or after its end, so an instant taken at that `LOST` is the instant of the re-open, and the beginning lies before it by the `gapMs` of the `REOPENED` that follows at once (plus the relay's 5,000 ms silence bound) - and the relay's cause (`LOSS_NOT_TOLD` is the adapter's word, exported as `CAMERA_LOSS_NOT_TOLD`, no exit word of the relay).

**What `through` means for the three relay numbers:** `tries`, `heldBack`, `gapMs` are those of the LAST loss only. They say nothing of the losses before it.

**The session needs no change for its signed record to be true** (the number matches again). The request line for row E3 asks for wording only: keep the cause, do not call `lostAt` the instant of the loss when the cause is `LOSS_NOT_TOLD`, leave `tries` out or state `through` when it is present, add `through?` to the shape `RelayIngestReport['leg']`.

DRIVER DECISION (to confirm): the type `CameraLegReport` gained the optional member `through` and the cause word `LOSS_NOT_TOLD`. Both are additive; `capture-session` restates the type by shape and ignores an unknown member.

## 3. E-02 - which members became required

Verified by reading (read-only): the production composition hands every one in - `capture-composition.ts:528` (`relayEnded`), `capture/fence/production-parts.ts:222, 238` (`admitHwAddress`), `camera/onvif-relay.ts` (`from.sourceAddress` to `locate`), `capture-discovery/adopted-test.ts:290` (`sourceAddress` to `test`), `capture-discovery/connect/index.ts:276` (`candidateSource`).

| Member | File | Now | For a caller the type did not hold |
|---|---|---|---|
| `relayEnded` | `onvif-relay.ts` | REQUIRED | every open refused before anything is asked: `CAPTURE_CAMERA_RELAY_NOT_STARTED`, reason `RELAY_END_LISTENER_ABSENT` (no new code: an existing code with a reason word) |
| `admitHwAddress` | `onvif-network.ts` | REQUIRED | `NOT_SET`, `HW_ADDRESS_REFUSED`, no set request (no function is a judgement that refuses) |
| `sourceAddress` of `OnvifConnectionTester.test`, `OnvifStreamLocator.locate`, `exchange` | `onvif-session.ts` | REQUIRED TO BE STATED (`string \| undefined`): "as the host routes" is written `undefined`; a call that forgot it does not compile | the existing refusal of a text that is no source address is unchanged |
| `candidateSource` | `modules/capture-discovery/connect/service.ts:264, 375` | STILL OPTIONAL - not this row's file | request line (row 88 and the owner of the connect flow), with the three pins that move with it |

The doubles: `onvif-relay.test.ts` and `real.test.ts` state `relayEnded`; `onvif-network.test.ts` states `ADMIT_WHAT_THE_DEVICE_REPORTS`; `onvif-session.test.ts` states `AS_THE_HOST_ROUTES` ONCE, in two small helpers (`statedTester`, `statedLocator`) that the file's 76 existing calls go through - not at each call site; `loopback-guard.test.ts` states `undefined` at its two calls; `stream-probe.ts` hands the address on as it came (`[sourceAddress]`), so the two pinned call texts of the adapters' static file did not move.

DRIVER DECISIONS (to confirm): (1) `apps/core-server/src/capture/adapters/__tests__/real.test.ts` is outside the camera folder; its double lacked `relayEnded` and the tree would not compile: four lines added there. (2) Same family, seen and NOT changed because the review's list is four members: `StreamConnectionTester.test(..., sourceAddress?)` (`stream-probe.ts`), `CameraWatchDependencies.faults?` (`camera-watch.ts`: without a sink a loss raises no fault), the 2-argument overload of the time reader (pinned by `capture/__tests__/static.test.ts:727`, N4's file). All three are in the request line.

## 4. E-03 - the session boundary of the watch

New member `captureEnded()`: forgets `lostStreams` and `lostLegs`, and asks the sink ONCE to end each fault the watch raised itself (decision C60 (2): its own only). No change is told for it (no camera came back); the heartbeats are untouched.

Why the faults are asked away and not merely forgotten: the fence's sink (`production-parts.ts`, `owned`) keeps its own mark of a raise. A watch that forgot without asking would leave that mark, and the sink would answer the NEXT session's raise for that camera with nothing (`if (owned.has(key)) return`) - a loss of the second session with no fault. Read, not run against the real sink.

The boundary also holds by itself: the first ESTABLISHED push that names another session than the one whose reports the watch last read does the same (one capture runs at a time: `capture-session/index.ts:739`, `let live: Live | null`). A leg report or an ended relay of another session is no boundary.

What stays for row 88 (request line): `AttachedCameraWatch` gains `captureEnded` and the composition calls it when a capture ends; until then `lost()` still names the finished capture's cameras BETWEEN two sessions. Nobody under `src/` reads `lost()` today (text search `\.lost\(\)` outside tests: 0 hits).

## 5. E-05 - the two lines

`onvif-session.ts`: `if (settled) return;` first in `arm`, `if (settled) return ask(read, invoke);` in `authorizedAsk` after the no-credential line - as in `onvif-network.ts`.

## 6. Mutations (each made in place, run, taken out; the suites were green again after the last)

| Finding | Mutant | Cases RED |
|---|---|---|
| E-04 M1 | the re-open handed under the relay's number (`loss: report.loss`, no `through`) - the defect as found | relay: "out of order" (existing, rewritten), case 1, case 3, case 4 ("a re-open under a number that was not told", run 0) |
| E-04 M2 | a re-open with no loss told dropped, as before | case 2; case 4 by its reach count ONLY (`pairsPutTogether` 0) - the agreement of the two readers holds under M2, because a dropped pair is absent from both |
| E-04 M3 | the late re-open taken (`report.loss < slot.lastLoss` removed) | "out of order", case 3, case 4 |
| E-02 relay | the refusal line of `openSource` disabled | "an adapter built WITHOUT the listener" (by its 5,000 ms timeout: the open came up to the relay start) |
| E-02 network | the old guard back (`admitHwAddress === undefined` admits) | "asked ONCE ...": `no function at all: expected { outcome: 'SET' ... }` |
| E-03 M1 | `captureEnded` empty | watch case 1 (`['CAM-01','CAM-02']` still lost) |
| E-03 M2 | the boundary by itself removed | watch case 2 |
| E-03 M3 | losses forgotten, own faults not asked away | watch cases 1 and 2 (`cleared` empty) |
| E-05 A | both guard lines absent (the file at 1fbeada7) | both cases: the client held the account's two values |
| E-05 B | only the line in `arm` absent | the second case |
| E-05 C | only the line in `authorizedAsk` absent | NONE - stated, not hidden: with the line in `arm` it changes nothing a caller can see (it keeps a request from being counted on a result already handed out). It stands for parity with the set-network file |

## 7. Kept unchanged, and how that is shown

| Rule | Evidence |
|---|---|
| Reply guard of row B1 at every call site | `onvif-session.test.ts` block "row B1 / B-01" and `onvif-network.test.ts` blocks "row B1 / B-01", "row T3 / T-02": green; no line of `guardOnvifReplies` or of the two agents touched (`git diff` of both files shows the signature lines, the two guard lines and the hw-address block only) |
| Source binding, rows 143b / 143c | adapters' static file, case "(d) row 143b" (its pinned texts of `onvif-session.ts` and `stream-probe.ts` did not move); `onvif-session.test.ts` "row 143b", "row 143c"; `stream-probe.test.ts` "row 143b" - its last assertion changed on purpose: a test without a source now STATES `undefined` to the two facades (4 and 5 arguments, was 3 and 4), still no member `source` in the probe message |
| Stored-address rule, row 143 | `onvif-relay.test.ts` block "row 143", `camera-watch.test.ts` blocks "row 143", "row 143c", `stored-address.test.ts`: green; `stored-address.ts` not touched |
| Static rules A-1, A-9, A-10, A-11 | `capture/adapters/__tests__/static.test.ts` green and NOT edited (no entry was needed) |

## 8. Checks

| Check | Command (from `apps/core-server`) | Result |
|---|---|---|
| Camera adapter unit suite, adapters' own suites and static file, discovery unit suites, composition, camera-network service, the static set | `vitest run --project unit --maxWorkers=2 src/capture/adapters/camera/__tests__ src/capture/adapters/__tests__ src/modules/capture-discovery/__tests__ src/modules/capture-discovery/connect/__tests__ src/__tests__/capture-composition.test.ts src/modules/capture-config/camera-network/__tests__/service.test.ts src/capture/__tests__/static.test.ts test/static` | first run: `Test Files 2 failed \| 45 passed (47)`, `Tests 3 failed \| 1009 passed (1012)` - all three mine (two tests that judged the facade through the new helper, one pin of "no trailing argument"); second run after the fix: `Test Files 47 passed (47)`, `Tests 1012 passed (1012)` |
| Typecheck | `tsc --noEmit` | 0 errors |
| The adapter's DATABASE suites, first try | `lockf .locks/db-migrate.lock lockf .locks/heavy-host.lock vitest run --project db ...` | NOT RUN: `lockf: .locks/db-migrate.lock: already locked` after 45 s and again after 120 s (the controller: PostgreSQL on 127.0.0.1:4432 was down since the restart) |
| ADDENDUM (controller's order, PostgreSQL started): the relay / test-camera files, under `.locks/db-migrate.lock`, the heavy-host lock taken only around this run (waited for it from 09:31:14; ended 09:41:25) | `vitest run --project db --maxWorkers=1` of `camera-adapter-open.db`, `adopted-camera-test.db`, `stream-test.db`, `minted-code.db` | `Test Files 4 passed (4)`, `Tests 50 passed (50)` |
| ADDENDUM: the files without a relay, under `.locks/db-migrate.lock` only | `vitest run --project db --maxWorkers=1` of `connect.db`, `src/__tests__/capture-composition.db`, `camera-network/__tests__/routes.db` | `Test Files 1 failed \| 2 passed (3)`, `Tests 1 failed \| 46 passed (47)`. THE RED IS NOT THIS ROW'S: `connect.db.test.ts` > "the database this file runs on" > "is at the schema version of the code: [14, 'dbc-15'] = [13, 'dbc-14']" - the code and the database the file ran on stand one schema step apart (a schema step of another row is in flight; the writer of the schema and its pins). Every other case of that file passed. Not run a second time: no file of this row touches the schema |
| ADDENDUM: typecheck after the addendum | `tsc --noEmit` | 2 errors, both in files of agent PR's in-flight edit, not touched: `src/modules/capture-config/__tests__/adopted-camera-test.db.test.ts(277,5)` TS2741 (`settle` missing) and `src/modules/capture-discovery/__tests__/adopted-test.test.ts(56,235)` TS2322 (`AdoptedCameraStream[]` / `JudgedStream[]`). The database run of `adopted-camera-test.db` above passed all the same (vitest does not typecheck) |

ADDENDUM - THE TEST OF THE `authorizedAsk` LINE (E-05, mutant C of section 6). No behaviour tells the line from its absence (section 6 says why), so the test is a PIN OF THE SOURCE and says so: `onvif-session.test.ts`, block "finding E-05", case "the source, both copies: ...". It holds, in `onvif-session.ts` and in `onvif-network.ts`, that `authorizedAsk` answers an ended exchange before it arms or counts, that `arm` begins with the guard, and that each file has one of each. Green on the tree (`Tests 3 passed | 64 skipped (67)` for the block; the whole file with the adapters' static file: `Test Files 2 passed (2)`, `Tests 97 passed (97)`). SEEN RED on the mutant without the line `if (settled) return ask(read, invoke);` of `onvif-session.ts` (`Tests 1 failed | 2 passed`; the first `toEqual`). The mutant was taken out again. Mutations now: 11, all 11 with a red case - 10 by behaviour, this one by the source.

Reds not mine: the schema-version case of `connect.db.test.ts` and the two typecheck errors named above.

Ports: none of this row's new cases binds one (the E-05 cases answer every read inside the test; the E-02 network case uses the fake ONVIF stub's own free-port helper, as the file's other cases do).

## 9. Files

Product: `camera/onvif-relay.ts`, `camera/camera-watch.ts`, `camera/onvif-session.ts`, `camera/onvif-network.ts`, `camera/stream-probe.ts` (one line and its comment).
Tests: `camera/__tests__/onvif-relay.test.ts`, `camera-watch.test.ts`, `onvif-session.test.ts`, `onvif-network.test.ts`, `loopback-guard.test.ts`, `stream-probe.test.ts`; `adapters/__tests__/real.test.ts` (four lines).
Docs: this file, `delegation_progress/row_e2.md`, one line in `file_claims.md`, three lines in `file_requests.md`.
Every existing file was changed with the Edit tool only; no scripted replace, no shell append. Nothing committed, staged or stashed.

## 10. Unproven, and where it goes

- A REAL relay that drops or swaps a report line was not produced: the lines come from the test file in the relay's own form (held to the relay's sources by the existing case "the forms and the bounds are the relay's own"). Row 90's case "a dropped camera leg" is where the pair would show end to end.
- The session's own handling of the two repaired reports is restated by a double in the test (`sessionOf`), not run against `capture-session` (not this row's file; row E3).
- `captureEnded` against the real fault sink of the fence: by reading only.
- Hardware: nothing of this row touches a device; checks 9A/H-nn unchanged.

---
*Generated: 2026-10-14*
