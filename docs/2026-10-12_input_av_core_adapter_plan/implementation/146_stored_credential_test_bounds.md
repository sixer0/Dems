---
task_id: 2026-10-12_input_av_core_adapter_plan
row: 146
milestone: M3 / AD-03, AD-12
date: 2026-10-13
agent: coder-execution (batch 9, agent R3)
tier: T3
requirement: AD-03 point 5 (W-6: the stored-credential test uses the stored address, the existing bounds and the lock-out guard; the fourth refused attempt is not sent); AD-12 "S13-04 (d)" (the fixture refuses the RTSP credential twice, the count rises by 2, a third attempt is not sent); AD-02 (1) for the stored address
status: needs-review (the test is built and proven on doubles; it has NO ROUTE and no production composition hands it its reader - two requests)
---

# Row 146: the connection test of an adopted camera with its stored credential

Paths are relative to `/Users/gsp-budi/Documents/DEMS`. `CD` = `apps/core-server/src/modules/capture-discovery`, `CC` = `apps/core-server/src/modules/capture-config`.

## 1. Statement

`testAdoptedCamera(seams, caller, deviceId)` (`CD/adopted-test.ts`) tests a REGISTERED production camera with the credential the Core stores for it. It takes a device id and nothing a caller could aim it with. Its order, where every refusal stands before the reveal:

| # | Step | Refusal |
|---|---|---|
| 1 | no session is open | `409 CAPTURE_CONFIG_LOCKED` |
| 2 | the reader, the destination rule and the tester were handed in | `503 NOT_READY` (`DISCOVERY_NOT_READY`) |
| 3 | the device is a camera of the registry | `404` |
| 4 | the STORED facts, read on the pool outside any unit: a camera of a production adapter kind at an address of the stored form (`storedCameraCandidate` of row 143) | `409 CANDIDATE_NOT_TESTABLE` |
| 5 | the destination rule on that stored address (`judgeStoredCamera`, row 143) | `409 CANDIDATE_NOT_TESTABLE`; the rule's code to the log and the persistent error log |
| 6 | THE EXISTING BOUNDS: the same `ConnectionTestLimits` object operations 95 and 96 ask - single flight, spacing per host and per operator session, the per-minute bound, the lock-out guard of the host | `409 CONNECTION_TEST_IN_PROGRESS`, `429 CONNECTION_TEST_RATE_LIMITED`, `429 CONNECTION_TEST_LOCKOUT_GUARD` |
| 7 | the turn is taken, then ONE read of the credential: `reader.connectionTest(deviceId, operatorId)` - the reader bound to `CONNECTION_TEST` (row 144); no reason and no session is passed; the file opens no unit of work | nothing stored: `409 CREDENTIAL_REQUIRED`; any other failure: `503 CREDENTIAL_STORE_NOT_READY`; the turn is given back, nothing is sent |
| 8 | both halves of the test (`camera/stream-probe.ts`, row 50) under the 15,000 ms deadline | - (a failed test is a result) |
| 9 | the guard counts what the camera refused WITH the credential, ONVIF and stream together | - |

**Audit: exactly one entry per test that reached the reader** - the reader's `CAPTURE_CREDENTIAL_REVEALED` (device, reason `CONNECTION_TEST`, the operator as actor, no session), committed before the credential is returned. The file appends nothing itself. A test refused at steps 1 to 6 writes 0 entries.

## 2. Why it is not in `connect/service.ts`

The profile names `connect/service.ts`. That folder holds "no connection test without an operator-entered credential" by construction, and `connect/__tests__/service.test.ts:209-226` pins it over every file of the folder: ONE call of the tester, no reveal, no `SELECT`, no way back from the store. A stored-credential path inside it would have meant rewriting that rule. The new file stands beside the folder and shares exactly two things with it: the tester and the limits object. `connect/service.ts`, `connect/limits.ts` and `connect/index.ts` are unedited.

## 3. Change set

| File | State | What |
|---|---|---|
| `CD/adopted-test.ts` | new | the test; `adoptedCameraOf` (the stored row as a candidate); the control of an app (`registerAdoptedCameraTest`, `adoptedCameraTestControl(app).provide / ready / test`) |
| `CD/index.ts` | changed | the stream tester is one constant handed to the connect flow and to the new control; the control is built with `connect.limits` read at each call; three export names |
| `apps/core-server/src/capture/adapters/__tests__/static.test.ts` | changed, one entry | rule A-10 (c): the third caller of the judgement |
| `CD/__tests__/adopted-test.test.ts` | new | 15 cases on doubles |
| `CC/__tests__/adopted-camera-test.db.test.ts` | new | 7 cases on PostgreSQL with the real relay; in this folder because only its tests may import the wiring of the credential holders (rule R-6) |

## 4. Checks (this Mac; 2026-10-13; loopback only; sandbox off for the runs that bind a port; one lock hold per command)

| Check | Command (in `apps/core-server`) | Result |
|---|---|---|
| Unit, doubles | `npx vitest run --project unit --maxWorkers=2 src/modules/capture-discovery/__tests__/adopted-test.test.ts` (with the judgement's file) | run 1: `Test Files 2 passed (2)`, `Tests 21 passed (21)` |
| PostgreSQL, real relay | `(ulimit -c 0; lockf heavy-host; lockf db-migrate; npx vitest run --project db --maxWorkers=2 <the database file>)` | run 1 (the file then stood in `CD/__tests__`): `Tests 7 passed (7)`. Run 2, after the file was moved to `CC/__tests__` for rule R-6 (three import lines and the header changed): `Tests 7 passed (7)`, `0 remain with the run prefix` |
| Static rules and touched folders, 39 files | `... --project unit ... test/static`, the static tests of `capture`, `capture/adapters`, `capture-config`, the folders `modules/capture-discovery`, `capture/adapters/camera` | run 1: `Test Files 2 failed, 37 passed`, `Tests 2 failed, 660 passed (662)` - (1) rule R-6 of `CC/__tests__/static.test.ts:186`: my database file imported the wiring from outside the folder (moved, as above); (2) `CD/connect/__tests__/service.test.ts:378`, not mine, see section 7. Run 2: `Test Files 39 passed (39)`, `Tests 662 passed (662)` |
| Typecheck | `npx tsc --noEmit -p .` | 0 errors in a file of this row (the errors of files in flight elsewhere are listed in row 143's record) |
| Lint, secret scan | `npx oxlint` on the five files; `node scripts/secret-scan/count-only.mjs` on `CD`, the database file, `.cache/task4-row146` | exit 0; `TOTAL: 0 in 0 file(s)` |

### The verification cell

"The fixture refuses the RTSP credential twice: the guard's count for that host rises by 2 and a third attempt is not sent; a fourth refused attempt of the stored-credential test is not sent."

Facts of the database run (`.cache/task4-row146/facts.log`), camera `CAM-02` stored with a wrong secret, the ONVIF double taking it, the test camera's stream refusing it:

| Attempt | Answer | Relay exit | Guard, refused credentials the host may still see | Reveal entries | Camera's `auth_digest_refused` |
|---|---|---|---|---|---|
| before | - | - | 2 | - | 0 |
| 1 | `AUTHENTICATION_FAILED` | 23 | 1 | +1 | 1 |
| 2 | `AUTHENTICATION_FAILED` | 23 | 0 | +1 | 2 |
| 3 (same operator) | `429 CONNECTION_TEST_LOCKOUT_GUARD` | none started | 0 | +0 | 2 |
| 4 (another session) | `429 CONNECTION_TEST_LOCKOUT_GUARD` | none started | 0 | +0 | 2 |
| the right camera of the SAME host | `429 CONNECTION_TEST_LOCKOUT_GUARD` | none started | 0 | +0 | 2 |

After attempt 2 every count stands still: reveal entries, the whole audit trail, relays started, calls of the tester, requests at the ONVIF double. The camera ended with `auth_digest_refused` 2, `auth_basic` 0, `auth_digest_ok` 0. On the unit doubles the same sequence, and the guard is shown to be ONE for both paths: `limits.refusal(host, <another session>)`, the question operation 95 asks, answers the lock-out too; another host is not closed; after the 30-minute window one test is sent again.

### The tests the brief lists

| Statement | Evidence |
|---|---|
| through the reader with the bound reason `CONNECTION_TEST` | DB case 1: one entry `CAPTURE_CREDENTIAL_REVEALED`, details exactly `{ deviceId, reason: 'CONNECTION_TEST' }`, actor the operator, no session. Unit: the reader is handed `(deviceId, operatorId)` and nothing more |
| a read never inside a unit of work | DB "the read is OUTSIDE any unit": the test called from inside `app.pipeline.run` is refused by the reader (`PIPELINE_REENTRANT`), 0 entries, tester not called, the turn given back. Unit "the sources": the file names no unit, no pipeline, no engine door, no audit append |
| the audit entry committed before the value is returned | the reader's own property (row 145); here: the entry is in the trail when the test answers, in every case |
| the stream-level half | DB case 1: `REACHABLE`, 1 usable profile, relay exit 0, the camera's Digest counters; the refused cases end with relay exit 23 |
| exactly one audit entry per test | DB: trail +1 for a passed test, +2 for two refused tests, +0 for the refused third and fourth, +0 for a refused stored address, +0 from inside a unit, +1 when nothing is stored (the reader audits every CALL) |
| no value in any log, answer, argv or env | DB last case: 0 occurrences of 5 texts (account, both secrets, locator, path) in the log sink, the reader's error log, the audit trail, every answer and error, every note; every relay started with 0 arguments and an empty environment (3 starts) |

## 5. Doubles, and what stays unproven

- Doubles: the test camera (8565), the scripted ONVIF device (8557), the replicated state as an object of the test, limits on a manual clock; unit: reader, tester and stored row as spies. Real: the relay binary through the production door, the reader through its wiring, the pipeline, the audit chain and the credential store on a throw-away clone.
- Unproven: the test over HTTP (no operation exists); the reader handed in by the production composition; a real camera's lock-out rule against the conservative default of 2 in 30 minutes (`9A/H-10`); a camera whose ONVIF and RTSP accounts differ; the socket's source address (row 143's request).

## 6. DRIVER DECISIONS (for the controller to confirm)

1. **A new file beside `connect/`, not `connect/service.ts`** (section 2).
2. **No route.** The contract has no operation for this test and `packages/shared` is agent R5's. The function is reachable through `adoptedCameraTestControl(app)` only; until a composition calls `provide` it answers 503 before anything is read.
3. **One audit entry, the reveal.** `CAPTURE_CONNECTION_TESTED` requires a candidate and a search id, which an adopted camera has not. The OUTCOME of a stored test is therefore in the log only (`CAPTURE_STORED_CONNECTION_TESTED`: device, outcome, `guardTripped`, a reason code, a count). If the outcome must be audited, it needs a type or a widened detail rule (the vocabulary's writer).
4. **Refusal vocabulary reused**, no new reason: not testable, credential required, store not ready, the three limit reasons. An operation of the contract may name them better.
5. **A session that is open refuses the test**, as operation 95: a test opens a second connection to a camera that may be recording.
6. **The bounds are asked AFTER the stored address is judged and BEFORE the reveal**: a refused address spends no turn; a test the guard refuses reveals nothing.
7. **The answer has `deviceId` in the place of `candidateId`** and is otherwise operation 95's.
8. **The database file lies in `capture-config/__tests__`** (rule R-6: only that folder's tests import the wiring).
9. New files with Write; edits of existing files with Edit. The one moved file was my own untracked file of this row.

## 7. A red in a file of another row (not edited)

`CD/connect/__tests__/service.test.ts:378` failed once in 4 runs of this session: `holdsClearSecret(mixed, ACCOUNT.secret + 'x')` is expected false, and `mixed` is the secret followed by 20 RANDOM bytes - when the first of them is the byte of `x` the longer text is found (1 run in 256). A flaky expectation of row 142 / fix F-M4's test, not a fault of `holdsClearSecret`. Proposed: a fixed byte that is not `x` after the secret.

## 8. Requests left in `delegation_progress/file_requests.md`

Four lines: the operation of the contract (R5 / controller); the hand-over of the reader and the rule (row 85 / the composition); the audit of the outcome (vocabulary writer); the flaky expectation (controller).

---
*Generated: 2026-10-13*
