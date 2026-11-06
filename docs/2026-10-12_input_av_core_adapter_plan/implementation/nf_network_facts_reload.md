---
task_slug: input_av_core_adapter_plan
row: NF
wave: 12
date: 2026-10-14
agent: coder-execution (wave 12, agent NF)
tier: T3
source: review 120b finding S2-01 and its section 6 (T-1, T-3 to T-7); review 60e finding E-09; decisions C64, C76, C116
status: complete for cases (a) and (b) and for 5 of the 9 named tests; case (c) has its door built and tested and is LEFT to the reset's owner (request line); 4 named tests are left with their owners (section 4)
---

# Row NF - the reader of the network facts follows the stored row; the surviving tests of review 120b

Paths are relative to `/Users/gsp-budi/Documents/DEMS`. `CS` = `apps/core-server`, `NET` = `CS/src/modules/capture-config/network`.

## 1. What was wrong (S2-01), and what is built

Operation 101 answers from the DATABASE. The destination rule and the alias caller's file-against-row check (`storedInterface()`) judge on the reader's MEMORY, which was loaded once at boot and replaced only by `afterCommit` of operation 102. After a commit the reader could stay behind the row until a restart.

| Item | Where | What |
|---|---|---|
| The re-load after every unit | `NET/service.ts`, `unitThenReload` (called by `changeNetworkConfig`) | the ONE unit of a change runs in a `try`; in its `finally` the seam `reload()` is awaited. So: a confirmed commit, a failed commit / unknown outcome, the no-change path and a refusal inside the unit all end with one read of the row, OUTSIDE the unit, after it ended. The two refusals BEFORE the unit (a session open, a Core that cannot commission) read nothing |
| The seam | `NET/service.ts`, `NetworkConfigSeams.reload(): Promise<void>` | never rejects |
| The door | `NET/index.ts`, `control.reload()` on `CaptureNetworkConfigControl` | reads the row through the folder's store on the pool and puts it in memory. Also the door for any other code that changes the table behind the reader (the demo reset) |
| Fail-closed | same | a read that FAILS sets memory to null and `loaded()` to false: "not configured", every stored camera address refused. ONE log line and ONE persistent entry, code `CAPTURE_NETWORK_FACTS_RELOAD_FAILED` (`NETWORK_FACTS_RELOAD_FAILED_CODE`), source `captureNetworkConfig.reload`, fields `cause` (the error's code, never its text) and `readerCleared` |
| Order of two hand-overs | same, `turn` | a counter moved by every commit, every load and the START of every re-load; a re-load applies only while it is the last. A slow read that began before a later commit or a later re-load changes nothing; when it fails late it is logged (`readerCleared: false`) and does not clear the reader |
| A corrected reader says so | same | info line `CAPTURE_NETWORK_FACTS_RELOADED` (two facts: `stored`, `configured`; no value) ONLY when memory was behind the row. After a confirmed commit `committed` already handed the same row over and nothing is said |

Unchanged: the reader stays SYNCHRONOUS at judgement time (`facts: () => networkFactsOf(control.stored, control.interfaces())`); the re-load is the only asynchronous part and runs at the write. `committed` still runs through `unit.afterCommit` only. `load()` (the boot step) is as it was, except that it moves the counter.

## 2. The three cases of S2-01

| Case | State | Evidence |
|---|---|---|
| (a) a COMMIT whose answer is lost (`COMMIT_FAILED`, tasks never run, the row may be stored) | CLOSED | unit bench: commit `ANSWER_LOST` - the row is stored, `committed` not called, the reader holds the stored row; the retry is `REVISION_CONFLICT` and the reader still follows. Database: the owner writes the row behind the reader (the state such a commit leaves), the retry is `409 REVISION_CONFLICT`, and the rule then judges on the row operation 101 shows. NOT reproduced: a real connection that stores a commit and loses its answer |
| (b) the no-change path (60e E-09) | CLOSED | unit bench: a reader that holds nothing holds the stored row after a body that changes nothing; database: the same on a row moved behind the reader, no entry, unchanged revision |
| (c) a demo reset empties the table and does not tell the reader | LEFT, with its door | the reset has no hook a module can join: its resume names each reload itself (`modules/demo/reset.ts`: `pool.reopen`, `boot.checks`, `rbac.matrix`, `engine.reload`), and `modules/demo/host.ts` is the reset owner's file. Built and tested here: `control.reload()` after the table is emptied answers "not configured". The call from the reset is a request line. Until it lands the reader is corrected by the next call of operation 102 that reaches its unit, or by the boot step `capture.config` at the next start. On a Core in production capture the demo operations are refused |

Also now HELD BY A TEST (it was true and unheld): no reader sees a new value before a commit that rolls back - section 3, T-1.

## 3. The nine named tests of review 120b section 6

Every mutation was applied IN MEMORY, at transform time, by `.cache/task4-nf/mutant.vitest.config.ts` (git-ignored; it replaces one exact text in one file as the test runner loads it and stops when the text does not occur exactly once). No file of the tree was mutated; `git diff` of the five mutated product files outside `NET` is empty.

| # | Test | Mutation | Red (mutant) | Green (tree) |
|---|---|---|---|---|
| T-1 (1 of 2) | `NET/__tests__/service.test.ts`, new case "NEVER A NEW VALUE BEFORE A COMMIT THAT ROLLS BACK ..." beside the named one (the bench's unit can now end a resolved work with a commit that is `REFUSED` or whose `ANSWER_LOST`) | `unit.afterCommit(() => seams.committed(after))` -> `seams.committed(after)` (`NET/service.ts`) | `3 failed, 25 passed (28)` at that point of the work; the named case of `:478` stays green under it, as the review said | `31 passed (31)` |
| T-1 (2 of 2) | `NET/__tests__/routes.db.test.ts`, new case of the same title: the work resolves and PostgreSQL refuses the COMMIT (a deferred constraint of the test on the throw-away clone); the reader is asked at the instant the unit has ended, before the re-load's read returns | the same | `1 failed, 16 passed (17)`: `expected ['OUTSIDE_CAMERA_SUBNET', ...] to deeply equal ['ALLOWED from 192.168.50.1', ...]` | `17 passed (17)` |
| T-3 | `CS/src/__tests__/host-alias-socket.test.ts`, new case "THE NODE ALONE is not the trusted owner's while its folder is" (the answer of `lstat` for the node's path only is given another owner; folder, mode and socket are real) | `node.uid !== trustedOwnerUid || ` removed (`host-alias-socket.ts`) | `1 failed, 18 passed (19)` | in `168 passed (168)` of three files |
| T-6 | `CS/src/modules/capture-config/camera-network/__tests__/service.test.ts`, new case "THE AGE OF THE SCAN, EXACTLY AT THE BOUND" | `scanAge > CAMERA_NETWORK_SCAN_MAX_AGE_MS` -> `>=` (`camera-network/service.ts`) | `1 failed, 79 passed (80)` | same run |
| T-7 | `CS/src/capture/host-alias/__tests__/lifecycle.test.ts`, the named case, three assertions appended (the row's reason, who removed it, both entries' reason and row id) | in the close of the row, `subject.removeReason` -> `outcome.refusal === NOT_MARKED ? 'EXPIRED' : subject.removeReason` (`journal.ts`) | `2 failed, 67 passed (69)`: the named case and its restart sibling | same run |
| T-4 (three tests) | `CS/src/capture/__tests__/destination-rule.test.ts` "point 4" | the product's spacing removed or inverted | LEFT - the three cases call functions no product file calls (S2-03), so no product mutation reaches them. MEASURED instead: the product's own spacings are held by the product's tests - scan: `if (waitMs > 0) throw rateLimited(waitMs)` removed -> `factory-scan/__tests__/service.test.ts` `1 failed, 225 passed (226)` (with the rule's file); typed probe: the interval test removed, and inverted -> `capture-discovery/__tests__/search.test.ts` `1 failed` each | not edited |
| T-5 | `CS/src/modules/capture-discovery/__tests__/readdress.test.ts` "a candidate whose service address names a port" | none exists (it asserts on its own fixture) | LEFT - the context `allowedPorts: [80, 8080]` has no production source until the seventh setting of decision C116 | not edited |

Counted: 5 of 9 made to fail on their mutant (T-1 x2, T-3, T-6, T-7). Left: 4 - T-4 x3 (owner: the tidy row of S2-03, decision C116) and T-5 x1 (owner: row D4, decision C116). No named test lives in a file another agent of this wave owns.

Further mutants of this row's own code, all RED: the re-load removed (`await seams.reload()` deleted): unit `5 failed, 23 passed (28)`, database `5 failed, 12 passed (17)`; the re-load not awaited (`void`): unit `5 failed`; the overtaken guard removed (`if (turn !== control.turn) return;`): unit `1 failed, 30 passed`, database `1 failed, 16 passed`; the fail-closed clear removed: unit `1 failed`; a late failure clears always (`if (last)` -> `if (true)`): unit `1 failed`; the re-load does not replace memory: unit `3 failed`.

A mutant that first SURVIVED and was closed: the re-load not awaited passed while the bench's re-load took one microtask; the bench now takes a whole turn of the event loop.

## 4. Checks (2026-10-14; database runs with the command sandbox off under `.locks/db-migrate.lock`, throw-away databases)

| Check | Command (in `CS`) | Result |
|---|---|---|
| Unit: the network folder | `npx vitest run --project unit --maxWorkers=2 src/modules/capture-config/network/__tests__/service.test.ts` | `Test Files 1 passed (1)`, `Tests 31 passed (31)` (23 before this row) |
| Database: the network folder | `npx vitest run --project db --maxWorkers=2 src/modules/capture-config/network/__tests__/routes.db.test.ts` | `Test Files 1 passed (1)`, `Tests 17 passed (17)` (12 before); `0 remain`. First attempt of the day: NOT RUN, the project's PostgreSQL (127.0.0.1:4432) was stopped since the restart; the controller started it |
| The three other test files | `... src/__tests__/host-alias-socket.test.ts src/modules/capture-config/camera-network/__tests__/service.test.ts src/capture/host-alias/__tests__/lifecycle.test.ts` | first run: 3 files failed to LOAD, `ReferenceError: CAPTURE_PROFILE_CODE_PATTERN is not defined` at `packages/shared/src/api/state-slices.ts:1170` (N2 in mid-edit); second run: `Test Files 3 passed (3)`, `Tests 168 passed (168)` |
| Unit and static set | `... src/modules/capture-config/network test/static src/capture/__tests__/static.test.ts src/capture/adapters/__tests__/static.test.ts src/modules/capture-config/__tests__/static.test.ts src/modules/capture-config/__tests__/routes.test.ts src/modules/capture-discovery/__tests__/static.test.ts src/__tests__/capture-composition.test.ts` and the three files above | `1 failed, 640 passed (641)`, 27 files. The one red was MINE: `test/static/audit-protection.test.ts` "no file under apps/core-server drops a trigger" on the first form of the T-1 database case. Fixed (the constraint is silenced by a switch table, nothing is dropped); that file again: `Tests 9 passed (9)`. The whole set was not run a second time |
| Composition, siblings, acceptance pair | `npx vitest run --project db --maxWorkers=2 src/__tests__/capture-composition.db.test.ts src/modules/capture-config/camera-network/__tests__/routes.db.test.ts src/modules/capture-config/factory-scan/__tests__/routes.db.test.ts src/modules/capture-config/__tests__/capture-config.db.test.ts test/acceptance/contract.test.ts test/acceptance/rbac-matrix.test.ts` | `Test Files 1 failed, 5 passed (6)`, `Tests 1 failed, 148 passed (149)`; `0 remain`. NOT MINE: `contract.test.ts` "the committed openapi.json lists the same 110 operations ... equals what the generator produces now" (`expected false to be true`) - N2's file |
| Typecheck | `npx tsc --noEmit -p .` | 3 lines, none in a file of this row, all TS2741 `Property 'settle' is missing ... 'AdoptedCameraTestHost'`: `src/modules/capture-discovery/index.ts:315`, `src/modules/capture-discovery/__tests__/adopted-test.test.ts:97`, `src/modules/capture-config/__tests__/adopted-camera-test.db.test.ts:277`. 0 lines in `modules/capture-config/network` or in the three test files |

## 5. Driver decisions (for the controller to confirm)

| # | Decision | Why |
|---|---|---|
| DD-1 | The re-load runs after EVERY unit of operation 102, the refusals inside the unit included (a stale revision, a refused setting, a session that opened meanwhile) | the brief names "any outcome that is not a clean refusal BEFORE the unit"; the retry after a lost answer IS a revision conflict, so that path must heal the reader. Cost: one read per call that reached its unit |
| DD-2 | `committed` stays, and the re-load follows it on a confirmed commit | the hand-over at the commit is what the next synchronous judgement reads with no gap; the re-load is the net for the ends `committed` does not see |
| DD-3 | The re-load reads on the pool directly (as `load` does), not through `app.db.read` | one line and one entry with the named code; `app.db.read` would add its own line and turn the failure into `503`. Consequence: a failed re-load does not start the pool's readiness probe |
| DD-4 | A failed re-load answers the change as it ended (200 for a stored change) and clears the reader | the change IS stored; the fail-closed state is in the log and the error log, and the next call of operation 102 heals it |
| DD-5 | `load()` keeps what the reader held when its read fails; only `reload()` clears | `load` runs at boot, where nothing is held; an existing case pins that behaviour. The request to the reset names `reload()` |
| DD-6 | The info line `CAPTURE_NETWORK_FACTS_RELOADED` | the one trace that a commit's answer was lost or a table was changed elsewhere; said only when memory was behind |
| DD-7 | Operation 101 was NOT made to refresh the reader | "a read writes nothing" is the folder's stated rule; it would close (c) from this side and is offered as an option if the reset's line waits |
| DD-8 | T-3 replaces the operating system's answer for one path in the test | a node of another owner in a folder of the trusted one cannot be made on this Mac without another account; no product file was given a seam for it |

## 6. Doubles, and what stays unproven

The host is a table of interfaces of the tests; the Core is SIMULATED and accepts a change by `replaceForTest`. The refused COMMIT is a deferred constraint on a throw-away clone. No camera, no network device, no credential, no port.

Unproven: a commit that PostgreSQL stores and whose answer is lost on a real connection (the bench and "the row behind the reader" stand for it); the re-load on a booted `REAL_PRODUCTION` Core; the reset's call of the door (not built); a real socket node of another owner under a root-owned folder on the Linux host (`9A/H-05`).

## 7. Requests left in `delegation_progress/file_requests.md` (four lines, all `row NF`)

1. The reset's owner: `reloadNetworkFacts` in `createResetHost` and one `await` after the engine's reload; replaces row 108's line 311.
2. N2: the `openapi.json` red, information.
3. The owner of `capture-discovery` in this wave: the three typecheck lines, information.
4. The tidy row of S2-03 and row D4: T-4 and T-5 left, with the measurements.

Existing files were edited with the Edit tool only; new files were written with Write. Nothing was committed or staged. `.cache/task4-nf/` (git-ignored) holds the mutation runner.

---
*Generated: 2026-10-14*
