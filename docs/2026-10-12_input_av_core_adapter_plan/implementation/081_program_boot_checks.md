---
task_slug: input_av_core_adapter_plan
row: 81
milestone: M5 / WP-20
date: 2026-10-13
agent: coder-execution (batch 8, agent K/P/N)
status: needs-review (the four checks and the wiring inside the boot folder are built and tested on doubles; ONE hop is not built - the entry point does not hand the host facts in yet - see section 4)
tier: T3
requirement: F10 (d) (the relay's stated library), S13-09 with C19 and decisions/103 section 6.1 (the grant), HOST-44 to HOST-46, the wiring request of row 80 (HOST-49, BR-12 at run time)
---

# Row 81 - boot checks of the delivered programs, and the wiring row 80 left

Paths are relative to `/Users/gsp-budi/Documents/DEMS`. `BOOT` = `apps/core-server/src/capture/boot`. Nothing here has run on a Linux host: every question goes to a runner that starts nothing.

## 1. What was built

| File | State | Change |
|---|---|---|
| `BOOT/program-checks.ts` | NEW | The four checks, their 4 codes and 14 reasons (fixed words), two tables of questions (literal paths), the diagnostics form (`deliveredProgramResults`) and the boot form (`deliveredProgramOutcomeOf`). One type import; no process, no file system, no database |
| `BOOT/checks.ts` | additive | one import; `...CaptureProgramRefusal` after row 80's codes; `...PROGRAM_REFUSAL_TEXT`; the optional dependency `programs?: DeliveredProgramDeps`; one message constant; STEP 4e (5 lines) between step 4d and the worker handshake; 6 header lines. No existing check, order, code, text or log line changed |
| `BOOT/index.ts` | the wiring | the seam `CaptureBootMount.host?: CaptureBootHostFacts` (process facts and the runner, WITHOUT the program paths) and `storedCameraInterface?`; the mount adds `captureRelayPath` / `captureGuardPath` of the configuration and hands `host` and `programs` to `runCaptureBootChecks`; `storedCameraInterface(app)` with the statement `SELECT_STORED_CAMERA_INTERFACE`; the names of `host-checks.ts` and `program-checks.ts` exported |
| `BOOT/__tests__/program-checks.test.ts` | NEW | 23 cases in 5 blocks |
| `BOOT/__tests__/host-support.ts` | additive | `PROGRAM_ANSWERS` (recorded-style answers per question), `fakeProductionHost` (one runner for both tables) |
| `BOOT/__tests__/checks.test.ts` | additive | one import line widened, one added; one block of 5 cases at the end (step 4e) |
| `BOOT/__tests__/boot.test.ts` | additive | two import lines; one block of 7 cases at the end (the mounted wiring) |
| `apps/core-server/src/capture/__tests__/boot.db.test.ts` | additive | one import line; one case at the end (the stored interface read as the runtime role) |

`host-checks.ts` is NOT edited (row 80's static pins on it hold). `capture/__tests__/static.test.ts` is NOT edited (agent SC) and stays green.

## 2. The four checks (step 4e)

Asked in `REAL_PRODUCTION` only, only when the composition hands `deps.programs` in, after the host checks of row 80 (4d) and before the worker is started. The first that is missing refuses the start through the existing `refuse` (same log line, same error-log row).

| # | Code | What | How it is asked | Reasons when missing |
|---|---|---|---|---|
| 1 | `CAPTURE_HOST_RELAY_LIBRARY_UNVERIFIED` | the relay: the path rule of check 2 once more, then its STATED media library (F10 (d)) | the relay program of the configuration, started with NO argument and given NO start message; its answer is its exit code (`relay.h`): 10 or 11 = past its library statement; every platform | `RELAY_LIBRARY_VERSION_MISMATCH` (12), `RELAY_CORE_FILE_LIMIT_NOT_SET` (13), a word of the path rule |
| 2 | `CAPTURE_HOST_ALIAS_HELPER_UNSAFE` | the helper file: a regular file of root, it and its directory not writable by group or others (HOST-45) | `/usr/bin/stat -c '%F %U %G %a'` on `/usr/local/sbin/dems-core-netalias` and `/usr/local/sbin` | `FILE_ABSENT`, `NOT_THE_DELIVERED_KIND`, `NOT_OWNED_BY_ROOT`, `WRITABLE_BY_GROUP_OR_OTHERS` |
| 3 | `CAPTURE_HOST_ALIAS_GRANT_UNSAFE` | the grant (C19): the socket's directory and the two unit files, root's and not writable by group or others (HOST-44) | the same `stat` on `/run/dems-core-netalias`, `/etc/systemd/system/dems-core-netalias.socket`, `.../dems-core-netalias@.service` | the same four |
| 4 | `CAPTURE_HOST_INTERFACE_FILE_MISMATCH` | the interface file against the stored row `capture_network_config.interface_name` (HOST-46) | the stored row through an injected reader, then `/usr/bin/cat /etc/dems/netalias-interface` | `INTERFACE_FILE_DIFFERS_FROM_ROW` (THE NAMED MISMATCH), `INTERFACE_FILE_ABSENT`, `INTERFACE_FILE_NOT_ONE_NAME`, `INTERFACE_ROW_UNREADABLE` |

Every question also has `HOST_COMMAND_NOT_STARTED`, `HOST_COMMAND_TIMED_OUT`, `HOST_ANSWER_NOT_UNDERSTOOD`: a check that cannot see refuses. The socket NODE (owner, group, mode 0660) stays row 80's question (`CAPTURE_HOST_ALIAS_SOCKET`), asked earlier. Checks 2 to 4 are asked on `linux` only (`NOT_ASKED` elsewhere). Passing says one line, `CAPTURE_PROGRAM_CHECKS_PASSED` with `programChecks` and `notAsked`.

No path, owner name or INTERFACE NAME leaves the module: tests plant a canary in the refused outputs and assert the message, the reason, the log lines and the error-log rows hold neither it nor `/usr/`, `/run/`, `/etc/` nor an interface name.

## 3. Driver decisions (for the controller to confirm)

| # | Decision | Reason |
|---|---|---|
| DD-1 | The relay's "stated library version" is read from its INTERFACE: a start with no argument and no start message, judged by exit code | The relay takes no argument and prints no version (`relay.c`: an argument is `RELAY_USAGE`); its source is another agent's and a CANDIDATE (C38, C39). The order in its `main` is hygiene, usage, library statement, start message, so 10 / 11 can only be reached past the library statement. The four numbers are held equal to `relay.h` by a test |
| DD-2 | A database with NO stored interface (no row, or a row that names none) is `NOT_ASKED`, not a refusal | A fresh production Core must boot before an operator can store the network configuration; there is nothing for the file to agree with. A row that cannot be READ refuses (fail closed) |
| DD-3 | The path rule of the relay is not a fifth question: row 80 holds it (`CAPTURE_HOST_RELAY_PROGRAM_UNUSABLE`); check 1 applies it once more only so that nothing is started from a path that fails it | row 80's request line to this row |
| DD-4 | `stat` judges owner `root` and "no write bit for group or others"; the group and the exact mode are not pinned (755 and 555 both pass) | the cell's words ("root-owned and not writable by the service user") |
| DD-5 | NO DEFAULT HOST FACTS in the mount (section 4) | measured: with a default, every `REAL_PRODUCTION` start that does not configure a relay is refused `CAPTURE_HOST_RELAY_PROGRAM_UNUSABLE` |
| DD-6 | The delivered-program checks live in a new file with a second table, not as rows of `HOST_COMMAND_CHECKS` | row 80's static block pins that file's imports, its program literals and its one `run(` call; the static list is agent SC's |
| DD-7 | PF-8 (no-new-privileges) is not a fifth check here | row 80 built it (`CAPTURE_HOST_CAN_GAIN_PRIVILEGES`) |

## 4. NOT BUILT: the last hop of the wiring (why the status is needs-review)

The task asks that "a REAL_PRODUCTION start really runs the host checks". Inside the boot folder that is true and tested: a mount that is handed the host facts runs steps 4d and 4e in `REAL_PRODUCTION` (and never in the two other operations). What is not built is WHO hands them in for the real server.

- The facts are facts of the Core's own process (`process.platform`, `process.execArgv`, whether the runtime's option variable is set, the core-file limit) and a runner over a process door. The capture folder may read no environment (G-R2) and `hostCommandRunnerOver` may have no caller in the product without a change of row 80's static pin (agent SC's file).
- A DEFAULT inside the mount (real facts when none are handed in) was not taken: at least 12 test files boot `REAL_PRODUCTION` through `buildApp` or the bare mount with no relay configured (`grep "captureMode: 'real'"` without `captureDevSources: true`: `boot.test.ts`, `fence.db.test.ts`, `session-capture.db.test.ts`, `export-e2e.db.test.ts`, `export-restart.db.test.ts`, `capture-config.db.test.ts`, `source-class.db.test.ts`, `session-start.db.test.ts`, `audio-intervals.db.test.ts`, `recover-failed-seal.db.test.ts`, `tidy-fy.test.ts`, `forwarder.test.ts`, the kill-matrix child, `demo-seed-v2.test.ts`). Each would be refused `CAPTURE_HOST_RELAY_PROGRAM_UNUSABLE` / `NOT_SET`; the brief requires the existing tests unchanged and green, and eleven other agents run them in this batch.
- So the facts are a SEAM of the mount, to be handed in by the ENTRY POINT, as `errorLogFile` is. Three small edits outside this row's area (request line in `file_requests.md`): `src/app.ts` (`BuildAppOptions.captureHost?`, passed to the capture unit), `src/capture/index.ts:324` (one member of the mount call), `src/index.ts:55` (the real facts, with `hostCommandRunnerOver(startHelperProcess, timers)`), and the caller list in row 80's static block. With them, every start by the entry point in `REAL_PRODUCTION` runs both steps; every test keeps today's behaviour unless it hands a host in.
- RULING NEEDED with it: a production Core off Linux started by the entry point then needs a core-file limit of 0, no diagnostic switch, `DEMS_CAPTURE_RELAY` and `DEMS_CAPTURE_GUARD` set (row 80, driver decision 3).

## 5. Evidence

| Check | Command | Result |
|---|---|---|
| The boot folder (all 7 files) and the capture static file, first run | from `apps/core-server`: `npx vitest run --project unit --maxWorkers=2 src/capture/boot src/capture/__tests__/static.test.ts` | `Test Files 8 passed (8)`, `Tests 249 passed (249)` |
| Existing fence unit tests and whole-app real-capture tests, unchanged | the same command on `src/capture/fence`, `src/capture/__tests__/forwarder.test.ts`, `tidy-fy.test.ts`, `protocol-pins.test.ts` | `Test Files 7 passed (7)`, `Tests 197 passed (197)` |
| Database: the boot and the fence on throw-away databases | from the repository root, sandbox off: `/usr/bin/lockf -k -t 1800 .locks/db-migrate.lock sh -c 'cd apps/core-server && npx vitest run --project db --maxWorkers=2 src/capture/__tests__/boot.db.test.ts src/capture/fence/__tests__/fence.db.test.ts'` | `Test Files 2 passed (2)`, `Tests 47 passed (47)`; 2 databases dropped, 0 remain |
| Typecheck | `npx tsc --noEmit` in `apps/core-server` | no output (0 errors) |
| Lint | `npx oxlint src/capture/boot src/capture/__tests__/boot.db.test.ts` | no output |

Verification cell: "each of the 4 checks has a passing and a failing fixture, 8 tests passing" - block 1 of `program-checks.test.ts`, the eight cases named `1 pass` to `4 fail`. "A mismatch of file and row is a named refusal" - case `4 fail` (the module), the second case of the new block of `checks.test.ts` (the boot: code, reason, one error line, one error-log row, worker not started) and the third case of the new block of `boot.test.ts` (the mounted step, from the file's side and from the row's side).

The brief's conditions: every existing boot check, its order, code and log line unchanged - the cases of before in `checks.test.ts` (69) and `boot.test.ts` pass unedited, row 80's exact line lists included; SIMULATED runs none of the real checks and REAL_DEVELOPMENT starts as today - the fourth case of each new block, on a host where everything is wrong (0 questions, 0 reads, the lines of before), and the fence suites above.

## 6. The doubles, and what stays unproven

| Double | What it is |
|---|---|
| The runner | `fakeProductionHost` / the local runner of `program-checks.test.ts`: starts nothing; answers written by hand from what the host profile states `stat` and `cat` print and from the relay's header |
| The relay | never started: its answer is an exit code of the table |
| The stored row | a function of the test; in the database case the real table, read as `dems_app` |
| The path rule, the store, the key, the worker (mounted cases) | REAL: the inspector on stand-in files of the fixture, the stand-in worker script |

| Unproven | Proven by |
|---|---|
| That the built relay, started with no argument and its input at end, exits 10 within the runner's 5 s bound on the host, and 12 on another libavformat | row 43 / row 59 (the relay's own series); `9A/H-04` |
| `stat -c '%F %U %G %a'` prints `regular file` / `directory` in that form on Ubuntu 24.04, exits 1 with the found lines when a path is absent; `/usr/bin/cat` and `/usr/bin/stat` exist there and run with an empty environment | `9A/H-01`, `9A/H-05` |
| The installed paths of the helper's delivery (the helper file, the two unit files, the interface file, the socket's directory) are the ones this file asks | `9A/H-05` (the installation procedure, row 127) |
| A start with one of the four removed names exactly that one on the host | `9A/H-04` (HOST-49) |
| That the real server runs any of this | section 4: not until the entry point hands the facts in |
