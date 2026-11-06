---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
row: fix wave I, driver A1 (sealing / session keys / reset / lane tool) - findings of re-gate 75
date: 2026-10-10
agent: coder-execution
narrative_tier: 1
source: gateway_check/10b_m5_regate.md (G75b-01, G75b-02 server half), decisions D147, D216
tree: 74fd1f1 + the uncommitted work of fix wave I (no commit, no migration: schema 6 / dbc-7)
status: complete (needs-review for decisions 1 to 4 of section 7)
---

# 131 - Fix wave I, driver A1

## 1. Step 0 and the state the lanes are in

| Item | State |
|---|---|
| `scripts/lane/lane.sh stop 1`, `stop 2` | done at 20:12 WIB, outside the command sandbox (inside it the script could send no signal: exit 69). `lane.sh status`: main, 1, 2, 3 all `stopped` |
| Lanes started again by me | NO. Lane 1, lane 2 and their web servers / Metro / emulators are as they were; an environment agent starts the lanes |
| Lane 2 data | RESET with the fixed tool at 20:39 (section 5). Lane 1 data: untouched |

## 2. G75b-01 - root cause, with evidence

The gate's hypothesis was read against the directory, the log and the code, and it holds. One
point of it is sharpened: why the 19:04 reset left the key.

| # | Fact | Evidence |
|---|---|---|
| 1 | Lane 2's key folder is `.data/credential-store/session-keys-5eb7d6943528705fe26b0e5904a4b219` | the scope of `<repo>/.data/media/dems_lane_2/sessions`, computed with the store's rule (`credential-store/index.ts` `sessionKeyScopeOf`) |
| 2 | Before the reset of this wave it held `KID-SES-20261008-0011.key` (19:04:53), `KID-SES-20261009-0015.key` (19:04:52), `KID-SES-20261010-0024.key` (13:26:47), `KID-SES-20261010-0025.key` (13:29:26), 40 bytes each, and NO `.blob` file | `ls -laT` of the folder (names, sizes, dates only; no key byte was read or printed) |
| 3 | The session's folder `SESSION-SES-20261010-0025` held `VIDEO-01.mp4` 36 206 406 B, `VIDEO-02.mp4` 35 451 833 B and `fragments/VIDEO-01.mp4.seal.part` of 1 249 B | the part file is the clear init segment and nothing after it: the FIRST fragment handed to the sealer threw |
| 4 | The Core log of lane 2 (`.locks/core-server.lane2.log`, the run of 19:57) says `SEALER_FAILED`, step `CLOSE_TRACKS`, attempts 5, 6, 7, 8, `retriable: true`, and `SEALING_SESSION_BLOCKED` - and no cause | lines 34, 42, 49, 59, 62 of that file |
| 5 | On the real folder, by file names only: `owns('KID-SES-20261010-0025') = true`, `bindingOf(...) = null`; the same for `-0024`; `-0026` not owned | a read-only probe through `SessionKeys.owns` / `bindingOf` (never `open`) |
| 6 | That is the refusal of `apps/core-server/src/sealing-host/session-key.ts:60-63`: `made = !keys.owns(keyId)` is false, the session's binding is `created-<createdAt>`, the key's binding is null, so `CREDENTIAL_SESSION_KEY_NOT_OF_SESSION` is thrown; `sealing/pipeline/pipeline.ts` wraps it as `SEALER_FAILED` | code; reproduced in `sealing-host/__tests__/wave-i-a1-session-key.test.ts` case 1 on the same layout |

**Why the key was there.** The keys of 13:26 / 13:29 were made by the build before wave H for
gate 75's first sessions (no binding existed then). Those sessions were erased by resets of that
older build, which destroyed no key. The reset of 19:04 (wave H's build) destroys "the keys of the
sessions it clears", and it learns those from the database it resets
(`db/reset/session-artefacts.ts:90` `READ_CLEARED_ARTEFACT_SESSIONS`: sessions with source rows, a
sealing job or an item). That database no longer named the sessions of 13:26 / 13:29, so their keys
were known to nobody - while every reset gives the session numbers out again. At 19:52 the next
session was numbered `-0025`.

**Why five failures ended "blocked" and not in the terminal path.** `SEALER_FAILED` is in the
RETRIABLE list (`sealing/pipeline/contract.ts:128`), and the way out makes only a NON-retriable
cause terminal (`sealing/pipeline/way-out.ts:77`); a retriable one is retried 3 times per process
(attempts 1-4), then waits for a start (attempts 5-8 after the gate's restart), for ever - by
design (D178 / D183: a key that is missing for a day must not cost a recording). The design was
followed; the CLASS was wrong for this cause: a key of another session under this session's ID
never becomes this session's key.

**Why the lane could not be reset.** The recording folder has no manifest, so the store scan
reads it as UNKNOWN and rule (5) of the real-evidence guard (a signed development manifest) cannot
clear it: `RESET_BLOCKED_REAL_EVIDENCE`, at every reset.

## 3. What changed

### 3.1 Findings

| Item | Reproduced in a test? | Fix | Test | Status |
|---|---|---|---|---|
| 2a reset leaves keys of sessions it no longer knows | yes (`BEFORE THE FIX (control)`: the rule of wave H alone leaves the key) | a reset destroys EVERY `KID-SES-...` key / binding of the key folder of the store root it resets (`everyKey`), with the two standing exceptions: the demo packages the same reset sealed anew, and a key whose package folder is still in the store (it is reported, blocks the next reset, and a start of that number is refused by 2b). Capture facts and staging of such a session go with the key. Session numbers ARE given out again; the rules are now consistent | `wave-i-a1-session-key.test.ts` (a), `wave-i-a1-reset-lane.db.test.ts` | done |
| 2b defect surfaces at seal, after the recording | yes (case 1) | `sealingHost(app).beforeStart(sessionId)`, called by `startSession` before any unit (also at the pre-check begin): `503 NOT_READY`, `details.reason: SESSION_KEY_NOT_OF_SESSION` or `SESSION_KEY_STORE_UNAVAILABLE`. Nothing is changed; the session can be cancelled and a new one (another number) created. Rule: a session that has not started has sealed nothing, so ANY key of this Core under its ID is not its own | same file (b); seal e2e passes through the route | done |
| 2c log line and alert name no cause | yes | a closed code `detail.cause` on `SEALER_FAILED` (`SealerCause` = `SEAL_BLOCKED_DETAILS` of shared), read from the `code` member of what the sealer threw - never a message, a path or key material. It is in: the persistent error log (`a sealing step failed`, context `cause`), the Core log line `the seal of a session failed` (`failureCause`; the key `cause` is refused by static rule CPB1-2), `SEALING_RETRY_SCHEDULED` / `SEALING_RETRIES_EXHAUSTED` / `SEALING_SESSION_BLOCKED` (context `cause`), the step sentence, the blocked alert (`params.detail` + sentence + a restore hint that follows the cause) | `wave-i-a1-way-out.test.ts`, `wave-i-a1-progress.test.ts` | done |
| 2d what the API gives for a blocked seal | - | NO contract member added (97 / 67 unchanged, no OpenAPI run). Existing members + one shared reader: `delegation_progress/contract_wave_i.md` | `packages/shared/test/sim-wave-i-a1-seal-blocked.test.ts`; clients' own tests | done |
| 2d "Resumed after restart" with no restart | yes (`REPRODUCTION`: attempt 4 reads resumed) | `resumed` of operation 83 on a Core in real capture is the sealing host's fact: this run was started by the boot resume or by `recoverSession`; automatic retries: false. Simulated mode keeps the simulator's rule | `wave-i-a1-progress.test.ts` | done |
| 2e blocked ended "blocked", not terminal | yes (`BEFORE THE FIX (control)`: classed retriable it is WAIT at attempts 4 and 9) | `SEALER_FAILED` with cause `SESSION_KEY_NOT_OF_SESSION` is NOT retriable: attempts 1 and 2 are retried, attempt 3 is TERMINAL - journal closed `UNSEALABLE`, both recordings MOVED to `.quarantine/<id>/`, session ended INCOMPLETE with cause `SESSION_KEY_NOT_OF_SESSION`, Core free. Every other sealer cause stays retriable and is never terminal (control) | `wave-i-a1-way-out.test.ts` (real pipeline, generated recordings) | done |
| 2e reset refused for ever on a development lane | yes (`REPRODUCTION`, and `WITHOUT the word`) | rules (12)-(15) of the guard: an unsealed recording folder (`SESSION-<id>` with NO manifest file, or `.quarantine/<id>`) of a session with EXACTLY four `FAKE` source rows and no sealed item is cleared ONLY when the caller writes `--discard-unsealed-fake-recordings` (`db:reset`, `lane.sh reset 2 ...`). Without the word it blocks as before and the refusal names the option. `LOCAL_DEVICE`, any production kind, three rows, a folder with a manifest, a session a blocking row names: never. Operation 75 never passes the word. REAL_PRODUCTION: unchanged (the proof needs four FAKE rows) | `wave-i-a1-unsealed-fake.test.ts`, `.db.test.ts`, `wave-i-a1-reset-lane.db.test.ts` | done |

Red first, said honestly: git writes (a stash included) are forbidden to drivers, so no test was
run against the tree before the fix. Each finding instead has a case that runs the rule of BEFORE
the fix as a control inside the same file and shows the finding (named `REPRODUCTION` /
`BEFORE THE FIX`), beside the case of the fix.

### 3.2 Per file

| File | Change |
|---|---|
| `packages/shared/src/sim/seal-blocked.ts` (NEW) + `sim/index.ts` (one export line) | `SEAL_BLOCKED_REASON`, `SEAL_BLOCKED_DETAILS`, sentences, `sealBlockedNoticeOf`, `sealAttentionOf`, examples |
| `apps/core-server/src/sealing/pipeline/contract.ts` | `SealerCause`, `sealerCauseOf`, `sealerCauseIn`, `sealingFailureRetriable`, `sealingCauseCodeOf`; `SealingError.retriable` uses the rule; the `SEALER_FAILED` sentence per cause |
| `.../pipeline/pipeline.ts` | the `SEALER_FAILED` throw carries `cause` (one import member) |
| `.../pipeline/way-out.ts` | terminal cause by `sealingCauseCodeOf`; `sealBlockedRestoreHint(code, detail)`; `blocked` port gets `detail`; three log contexts name the cause |
| `src/engine/sealing-notice-doors.ts` | `SealBlockedInput.detail` -> `params.detail`, only for a code of the closed list; the reason constant now comes from shared |
| `src/sealing-host/session-key.ts` | `sessionKeyStartRefusal` |
| `src/sealing-host/index.ts` | `beforeStart`, `resumedSeal`, `SESSION_KEY_START_TEXT`; the FAILED line names `failureCause`; `persist` writes no `err: null` (it was printed as an empty error object: lane 2 log line 34); `reportBlockedSeal` reads `params.detail`; the boot resume marks its session resumed |
| `src/sealing-host/progress.ts`, `src/modules/sealing/index.ts` | `sealingProgressOf(session, now, resumed)`; the route hands the host's fact |
| `src/modules/sessions/routes.ts` | ONE line after `capture().beforeStart()` |
| `src/db/reset/session-artefacts.ts` | `everyKey`, `keysOfUnknownSessions` |
| `src/db/reset/routine.ts` | the artefact block runs whatever the database named, with `everyKey: true`; option `discardUnsealedFakeRecordings`; the `RESET_UNSEALED_FAKE_RECORDINGS*` lines and the removal, before the key block |
| `src/db/reset/real-evidence.ts` | third branch of the ONE statement, rules (12)-(15), `unsealedFakeMessage`, `removeUnsealedFakeRecordings`, `DISCARD_UNSEALED_FAKE_OPTION` |
| `src/db/reset/package-removal.ts` | `removeQuarantineFolder` (containment one level down) |
| `src/db/reset/cli.ts`, `index.ts` | the option; exports |
| `src/db/commands/evidence-store.ts` | scan entry member `manifest: 'V2' | 'V1' | 'NONE'` (names only) |
| `scripts/lane/lane.sh` | `reset 2 --discard-unsealed-fake-recordings` (development capture lane only; exit 64 elsewhere) + the section "A LANE WHOSE SEAL FAILED" |
| Pins moved by delta | `db/reset/__tests__/{session-artefacts,cli,package-removal,real-evidence-m7}.test.ts`, `sealing-host/__tests__/wave-h-a-session-key-no-reuse.test.ts` (each: one additive member / the usage line) |

## 4. Tests and their output lines (each run once after its last change)

| Check | Command (from the repository root) | Result |
|---|---|---|
| shared, new | `npx vitest run --root packages/shared test/sim-wave-i-a1-seal-blocked.test.ts` | `Test Files 1 passed (1)  Tests 5 passed (5)` |
| core-server unit: the four new files + the five pins + `test/static` | `npx vitest run --root apps/core-server --project unit src/sealing-host/__tests__/wave-i-a1-progress.test.ts src/sealing-host/__tests__/wave-i-a1-session-key.test.ts src/sealing/__tests__/wave-i-a1-way-out.test.ts src/db/reset/__tests__/wave-i-a1-unsealed-fake.test.ts ... test/static` | `Test Files 25 passed (25)  Tests 283 passed (283)` |
| core-server unit, every touched folder (before the last wording alignment) | `... src/sealing src/sealing-host src/db/reset src/db/commands src/credential-store src/modules/sealing src/modules/sessions src/engine/__tests__/static.test.ts test/static` | 64 of 65 files, 1018 of 1019 tests; the one red was `test/static/log-calls.test.ts` (two hits: my key `cause`, renamed `failureCause`; and `modules/capture-discovery/search.ts:185` of driver A2). Green in the run above |
| db, guard | `/usr/bin/lockf -k .locks/db-migrate.lock npx vitest run --root apps/core-server --project db src/db/reset/__tests__/{wave-i-a1-unsealed-fake,real-evidence-m7,guard,store-root}.db.test.ts` | `Test Files 4 passed (4)  Tests 27 passed (27)` |
| db, the whole reset on the state of lane 2 | `... src/db/reset/__tests__/wave-i-a1-reset-lane.db.test.ts` | `Test Files 1 passed (1)  Tests 3 passed (3)` (second run; the first was red on my own rig - the keys were not below the data directory the routine reads) |
| db, reset routine + notice door | `... src/db/reset/__tests__/{reset,cli,m4-sec-reset,reset-failures,m2-guard-keepset}.db.test.ts src/engine/__tests__/sealing-notice-doors.db.test.ts` | `Test Files 6 passed (6)  Tests 86 passed (86)` |
| db, starts on a real-capture Core | `... src/modules/sessions/__tests__/{recover-failed-seal,audio-intervals}.db.test.ts src/capture-session/__tests__/session-capture.db.test.ts src/capture-notices/__tests__/session-start.db.test.ts src/capture/fence/__tests__/development-session.db.test.ts src/modules/sealing` | `Test Files 5 passed (5)  Tests 69 passed (69)` |
| SEAL E2E (built worker, generated sources, ports 8554 / 8556 free with lane 2 down) | `DEMS_SEAL_E2E=1 /usr/bin/lockf -k -t 1800 .locks/heavy-host.lock /usr/bin/lockf -k .locks/db-migrate.lock npx vitest run --root apps/core-server --project db src/sealing-host/__tests__/e2e/seal-e2e.db.test.ts` | `Test Files 1 passed (1)  Tests 3 passed (3)` |
| consumers of the shared examples (drivers B, C), after the wording alignment | web `wave-i-b-seal-blocked.test.tsx`; mobile `wave-i-c-seal-blocked*.test.tsx` x3 | 12 passed; 18 passed |
| typecheck | `npx tsc --noEmit -p apps/core-server`, `-p packages/shared` | exit 0, exit 0 |
| lint | `npm run lint -w @dems/core-server`, `-w @dems/shared` | exit 0, exit 0 |

Security / evidence integrity: each rule has its negative control in the same file (a key that is
not a session key is untouched; LOCAL_DEVICE / production / three rows / a manifest never cleared;
a detail outside the closed list never written; a store-unavailable cause never terminal). No
mutation run was made beyond those controls.

## 5. Lane 2 restored (step 4)

| Step | Result |
|---|---|
| Copy kept first (nothing was moved OUT of the store by hand) | `.data/gate-75b-set-aside/SESSION-SES-20261010-0025/` (0700, git-ignored by `.gitignore:70`): `VIDEO-01.mp4` 36 206 406 B, `VIDEO-02.mp4` 35 451 833 B, `fragments/VIDEO-01.mp4.seal.part` 1 249 B - 69 988 KiB on disk. Generated test pictures of the FAKE sources; no local-device material |
| `scripts/lane/lane.sh reset 2` | exit 1, `RESET_BLOCKED_REAL_EVIDENCE ... 1 unreadable package director(y/ies) [SESSION-SES-20261010-0025]. 1 of the folders named above are unsealed recordings of generated (FAKE) sources only ... (--discard-unsealed-fake-recordings). Nothing was changed.` |
| `scripts/lane/lane.sh reset 2 --discard-unsealed-fake-recordings` | exit 0 (log `.cache/gates/wave-i-a1/reset_2.log`, 0600): `removed 1 unsealed recording folder(s) of generated sources ...: SESSION-SES-20261010-0025`; `destroyed the session key of 2 cleared session(s) (KID-SES-20261010-0025, KID-SES-20261010-0024) ... 1 of them were keys of sessions this database did not name (left by an earlier reset). It removed 2 capture facts file(s)`; epoch 37 -> 38; the two demo packages sealed anew |
| After it | key folder: `KID-SES-20261008-0011.key`, `KID-SES-20261009-0015.key` (20:39:13, the renewed demo keys) and nothing else; store: the two demo package folders; `.capture-session/`, `.sealing/` empty |
| Moved by hand | NOTHING. The fixed tool cleared both things the brief named. The stale `KID-SES-...` key files were DESTROYED by the reset (ruling D216 (4)), not set aside: a key is not copied around. The recording folder was removed by the reset; its copy is the set-aside folder above |
| `.data/capture-local/` | not touched, not listed |

## 6. Checks for the test runner

| # | Command | Lock | Expected |
|---|---|---|---|
| 1 | `npm test -w @dems/core-server` (whole unit project), `npm test -w @dems/shared` | none | green; the count grows by 4 files / 30 tests in core-server unit, 1 file / 5 tests in shared |
| 2 | `npm run test:db -w @dems/core-server` | `.locks/db-migrate.lock` | green; +2 files / 6 tests of this driver |
| 3 | `apps/core-server/src/sealing/__tests__/kill-matrix/run.sh --only M7-REF-1 --only M7-KM-P2-S1 --only M7-KM-P4-S1` (the cells that end in or pass CLOSE_TRACKS; one run each) | heavy-host + db (the script takes them) | as before this wave: the boot resume now also marks the session resumed, nothing else of a cell's path changed |
| 4 | `DEMS_SEAL_E2E`-style runner check `src/capture/fence/__tests__/e2e/development-session-e2e.db.test.ts` (starts a session through the route on a real-capture Core) | heavy-host + db | green: `beforeStart` refuses nothing on a store without a key of that session |
| 5 | `apps/core-server/test/db/integration-d4.db.test.ts`, `src/evidence-export/__tests__/export-e2e.db.test.ts` | db (+ heavy-host where the file says) | green. A file that reuses ONE data directory AND a session number across two starts would now answer 503 `SESSION_KEY_NOT_OF_SESSION` at the second start - that would be a finding about the file's rig, report it to this driver |
| 6 | core-web and mobile suites | none | theirs; the shared file added one export module |

## 7. Decisions for the controller

1. **Session numbers are still given out again after a reset; keys are what must not survive.** The reset destroys every session key of the key folder of the store root it resets (not only those of sessions its database names). Kept: the demo packages' renewed keys; a key whose package folder is still in the store.
2. **`SESSION_KEY_NOT_OF_SESSION` is not retriable** (terminal UNSEALABLE at the third attempt, recordings in the quarantine). Every other `SEALER_FAILED` cause stays retriable and blocked-until-healed. With 2b a running Core should never reach it; it is the safety net.
3. **A start is refused on any own key under the session's ID, and on a key store that refuses to work** (`503 NOT_READY`, two new `details.reason` values, no new status or code). An app without a data directory (a test's) is not asked. Recorded as documented values like `CAPTURE_HELPERS_LEFT`; the C3 text should get the two values (docs owner).
4. **The reset option is explicit and FAKE-only.** `--discard-unsealed-fake-recordings` ERASES (the reset's meaning) unsealed folders proven by four FAKE source rows. I did not make it automatic: the proof is database rows and a folder name, weaker than the signed manifest of rule (5). A LOCAL_DEVICE recording that was never sealed still blocks a reset and has no tool - a decision for the user (it is a recording of a person).
5. **`sealing-notice-doors.ts` (engine) and `db/commands/evidence-store.ts` were edited** although my first claim line did not list them (one optional member each); both declared in `file_claims.md` second line.
6. `resumed` of operation 83 changed meaning on a real-capture Core to what the contract text always said (MB-06). No schema change.

## 8. Open items (not done, not claimed)

| Item | Why |
|---|---|
| Stale capture facts / staging of a session that has NO key in the folder and that no database names | swept only together with a key; `onForeignCaptureFacts` already refuses a foreign facts file at seal. Lane 2 has none left |
| The persistent error log of lane 2's failed session | in the database that was reset; not read (no driver reads a standing database). The Core log lines are quoted in section 2 |
| `masterplan/02_plan.md`, `status_tasks.md`, `99_implementation_report.md` | not written: the driver rules leave them to the controller; this note is the row's report |
| G75b-10 and G75b-06 requests of driver B in `file_requests.md` (13:26Z: `TIMESTAMP_CONFIRMED` after a failed start on the simulator; `security` slice constants) | not in this driver's task (simulator start path / core facts): unanswered |
| C3 contract text (`masterplan/03_api_contract.md`) | not edited: the two `details.reason` values, `params.detail` and the meaning of `resumed` are in `contract_wave_i.md` for the docs owner |

## 9. Re-drive list for the gate (device / browser; none was driven by me)

1. Lane 2, FAKE sources: create -> pre-check -> record -> stop -> SEALED, from the tablet and from the web (the blocked items B-1 to B-3 of re-gate 75), then the interrupted case (G75-03, -08, -10, -05b).
2. `GET session/{id}/sealing` during a normal seal: `resumed: false`; after a Core restart in FINALIZING: `resumed: true`.
3. Blocked seal on the surfaces (G75b-02): make the key store unusable on a development lane while a session is FINALIZING (for example the key folder not private), read the Finalizing screen and the seal dialog: the cause sentence, "The recording is kept on the Core.", leavable; alert `params.detail: SESSION_KEY_STORE_UNAVAILABLE`; Core log line `failureCause`.
4. Start refusal: with a key file of the next session number left in lane 2's key folder (a test key made by a throw-away sealer, never a copied key), `startSession` answers 503 `SESSION_KEY_NOT_OF_SESSION` before anything is recorded; cancel + create gives the next number and records.
5. `lane.sh reset 2` after a failed seal: refused with the option named; with the option: exit 0 and the lane records again.

---
*Generated: 2026-10-10 20:50 WIB*
