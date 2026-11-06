---
task_id: 2026-10-12_input_av_core_adapter_plan
task_slug: input_av_core_adapter_plan
row: 220
package: M11 | X-G (bench boot session)
date: 2026-10-13
agent: test-expert (wave 10, agent X3)
tier: 2
status: needs-review
requirements: design 05 section 2.10 (boot checks 4, 4b, 4c); SX-15 (the boot row names the key); SX-18 (scan); C29, C46, U18
---

# Row 220 - the bench boot session on this Mac

Status `needs-review`: every check of the row's Verification cell holds and everything the session made is gone. It is not `complete` because three facts differ from what the launch brief expected and need the controller's word (section 2).

Branch `task4/input-av-core-port`, working tree on `0f5d2a8e` with the uncommitted work of waves 9 and 10. No product file and no test file of a workspace was written. One run, 12:46 WIB, about 12 s.

## 1. What was found

| # | The cell asks | Result | Evidence (transcript line) |
|---|---|---|---|
| 1 | a throw-away database, created, migrated, seeded | **HOLDS**: two databases by the repository's test helper (`TestRun`, templates built from the migrations on disk and the seed); `schema of A: version 11, contract dbc-12` | step 1 |
| 2 | the X-2 walk through the command's function, run-generated values | **HOLDS**: count of check 4c `3` before, `exit 0; set and committed: 3`, last line `operators that still have the demo password: 0`, count `0` after; 6 typed entries, each zeroed | step 2 |
| 3 | then X-1 on that directory | **HOLDS**: `exit 0; refusal null`; subject `CN=CORE-KEY-EVSIGN-01,OU=Evidence signing DEMS-TEST-220,O=SYNTHETIC BENCH ORG - NOT AN INSTALLATION`; certificate sha256 `a2d9d93f...ed9e31a3` (public) | step 3 |
| 4 | with both commands run and nothing else, checks 4, 4b, 4c pass through the real boot function | **HOLDS FOR THE THREE CHECKS, NOT FOR "NOTHING ELSE"** (finding F-1): on the seeded database as it is, the start is refused BEFORE the capture checks, at step `transcriber.config`. With two fixture statements the step `capture.boot` passes: `CAPTURE_FENCE_PASSED, CAPTURE_HOST_PROFILE_NOT_ASKED, CAPTURE_PROGRAM_CHECKS_PASSED, CAPTURE_BOOT_CHECKS_PASSED` | 4a, 4b |
| 5 | with either command left out the boot refuses with the existing code | **HOLDS**: X-1 left out: `REFUSED at step capture.boot, code CAPTURE_SIGNING_KEY_UNUSABLE, reason KEY_ABSENT`; X-2 left out: `REFUSED at step capture.boot, code CAPTURE_DEMO_OPERATOR_PASSWORD_IN_PRODUCTION, reason operators=3` | 4c, 4d |
| 6 | the Core starts and its `SYSTEM_BOOT` row names the key, OR the log line of the check that stops it | **THE CORE STARTED** (finding F-2): a process of its own, `REAL_PRODUCTION`, with the host facts of that process, listening on `127.0.0.1:4477` only; health 200 `"ready":{"database":true,"engine":true}`; its `SYSTEM_BOOT` row (seq 88): `{"signingKeyId":"CORE-KEY-EVSIGN-01","captureOperation":"REAL_PRODUCTION","signingCertificateSha256":"a2d9d93f...ed9e31a3"}` = the fingerprint X-1 printed | step 5 |
| 7 | no camera search started, no real device opened (U18) | **HOLDS**: 0 lines of a search or a connection test in the log; the session itself sent only health requests to the port (the requests in the log were not counted before the log was removed); no child process but the script runtime's own (`esbuild`); the selector is empty; the audio card listing answered `NOT_AVAILABLE_ON_THIS_PLATFORM` | step 5 |
| 8 | the count-only scan with the needles of row 207 over the run's logs, records and `.cache` counts 0 | **HOLDS**: logs of the run and the driver folder: `TOTAL: 0 in 0 file(s)` (5 files); again over the transcript, the two records of row 216 and the driver folder: `TOTAL: 0 in 0 file(s)`. Value sweep: 36 needles x 10 places = 0 hits, positive control found | step 6 |
| 9 | every database, directory, key and process it created, each shown gone, also on failure | **HOLDS on the passing run; "also on failure" is by construction** (the removal is the `finally` of the session; no failed run was produced) | step 7, section 4 |

## 2. Three facts for the controller

**F-1. "Both commands and nothing else" does not start a production Core on a seeded database.** Measured: `REFUSED at step transcriber.config, code TRANSCRIBER_CONFIG_UNRESOLVABLE, reason CPU_LOCAL_RUNTIME_MISSING`; no capture code was logged, so checks 4, 4b, 4c were not reached. The seed enables speech-to-text and the temporary data directory holds no transcriber host file. The session then wrote, as the owner role, the two statements rows 208 and 216 use (speech configuration off; the six selector columns set to NULL) and the start passed. NOT measured separately: whether the seeded selector alone (simulated devices) would be refused by the fence in production - row 208's header says so; here both statements were written together. Consequence for decision C42 ("X-1 and X-2 make a production boot possible for a bench test on the seeded database"): true only with a transcriber host file in the data directory or speech-to-text switched off, and - by row 208's statement - an empty selector. No operation or command of the product does either for an installer today. The installer note (row 217) should say it or a row should close it.

**F-2. On this Mac a `REAL_PRODUCTION` start through the entry point's statements is NOT refused by a `CAPTURE_HOST_*` code. It starts.** The launch brief expected a refusal ("the fail-closed proof of C46 on the real entry"). Measured, with the facts of the process handed in exactly as `src/index.ts` hands them (`captureHostOfProcess`, platform `darwin`): one WARNING, `{"level":40,"code":"CAPTURE_HOST_PROFILE_NOT_ASKED","operation":"REAL_PRODUCTION","hostChecks":4,"msg":"the questions of the Linux host profile were not asked: this host is not Linux, so the loopback rule and the other host prerequisites are unchecked"}`, then `CAPTURE_PROGRAM_CHECKS_PASSED`, `CAPTURE_BOOT_CHECKS_PASSED` (`workerVersion capture-worker/0.6.0`, the built worker), `CAPTURE_SUPERVISOR_BOOTED`, `Server listening at http://127.0.0.1:4477`. It is the code as written, not a defect of this session: `src/capture/boot/host-checks.ts` asks the table of the Linux profile on `linux` only (`hostCheckResults`, the branch `deps.platform !== 'linux'`), and `src/capture/boot/checks.ts` (step 4d) logs the warning and goes on; the four checks of the Core's own process (core-file limit 0, no diagnostic switch, relay path, guard path) passed for real. So C46's "fail-closed at the real entry" holds for a host that is not SEEN (no facts) and for a Linux host that lacks a prerequisite; a host that states another platform is let through with a warning. Whether a production start off Linux should be a refusal is a ruling (it would open `checks.ts`, the row-205 baseline). Hardware check H6 / 9A is still the only proof of the Linux profile.

**F-3. `src/index.ts` itself was NOT started - DRIVER DECISION, against the letter of the launch brief.** That file can only listen on 4420 to 4423 and takes its database from the port (`dems_demo` or a lane) and its data directory from the repository's `.data/` (`src/config.ts` `LISTEN_PORTS`, `databaseNameFor`; `plugins/config/load-config.ts`). 4421 to 4423 are the user's running instances; 4420 would be a production start against the user's demo database with the key store of `.data/` - forbidden by C29, by the port rule of the driver rules and by the secrets rule. What ran instead is `.cache/task4-row220/launch.mts`: the statements of `src/index.ts` in their order, with the database name and the data directory replaced and the listener on a spare port (the precedent of row 232, DD-1). The proof that the FILE `src/index.ts` does what the launcher does is the text pin of row 85, not this session.

## 3. How the session was built

Driver: `.cache/task4-row220/bench-session.mts` (the session) and `launch.mts` (the process), git-ignored. Command, repository root, command sandbox off:

`/usr/bin/lockf -k -t 1800 .locks/db-migrate.lock /usr/bin/lockf -k -t 1800 .locks/heavy-host.lock sh -c 'cd apps/core-server && node --import tsx ../../.cache/task4-row220/bench-session.mts'`

Result line: `RESULT: every expectation of the session held`, exit 0 (21 expectations, 0 failed).

| Part | Real | Double |
|---|---|---|
| X-2, X-1 | the commands' functions, the product's hasher, pool, pipeline, audit writer, signer store | the prompt port and the echoed questions; for X-1's directory rule the directories above the session's root (row 206's double) |
| The four in-process starts (step 4) | `buildApp`, the capture unit's own mount, every reader of checks 1 to 4c on PostgreSQL and on the key store | the test host through the boot control's door (`provideTestCaptureHost`, C46) and three stand-in programs (row 61's worker stand-in; relay and guard of `test/support/capture-host.ts`) |
| The process start (step 5) | the entry point's statements, the facts of the process, the built `capture-worker`, `capture-relay`, `capture-guard` of `apps/capture-worker/build` (used as built: the same SHA-256 before and after), the system clock, a listener on loopback | none of the host. The configuration's port word is 4420 (origins and cookie name only; nothing listened there) |

X-2 read its connection file from the directory of the test helper, as rows 215 and 216 do; X-1, the boots and the process used the temporary data directory. DRIVER DECISION: no second copy of a connection file was made for the temporary directory (secrets rule), so "both commands on ONE directory" is not what ran; the directory is X-2's way to its connection file and nothing else.

Environment of the started process, names only: `PATH, HOME, TMPDIR, DEMS_CORE_PORT, DEMS_DEMO_CONTROLS, DEMS_LOG_LEVEL, DEMS_CAPTURE_MODE, DEMS_CAPTURE_WORKER, DEMS_CAPTURE_RELAY, DEMS_CAPTURE_GUARD, DEMS_INSTALLATION_DEVICE_ID, DEMS_INSTALLATION_NAME` and four of the session's own. No alias socket and no audio helper were configured: nothing asked for them on this platform.

One artefact of the session in the process log: `ENGINE_CLOCK_BEHIND` (warning). The in-process starts ran on a manual clock two seconds ahead of the system time, so the process found stored instants ahead of its clock and raised its floor (decision D110 at work, not a fault).

## 4. What was created, and its removal

| Created | Shown gone by |
|---|---|
| databases `dems_test_local_tmu01x2b_f01_row220_bench`, `..._f02_row220_no_x2` and the run's two templates | the helper's teardown: `databases dropped: 4`; `remain with the run prefix (read from the catalog after the drops): 0; failed drops: 0` |
| temporary root `<temporary folder>/dems-row220-AnGbxP` with `data/` (the key store `signer/`, the record `handover/`, what the Core wrote), `data-without-key/`, `logs/` | `gone` (`lstat` fails); a count from outside afterwards: 0 entries `dems-row2*` in the temporary folder |
| the stand-in programs `.data/test-row61-row220-12028-1` (no key ever lay there) | `gone`; 0 entries `test-row61-row220*` under `.data/` afterwards |
| the key of X-1 (inside the temporary root) | removed with the root; nothing of it was copied or read by the session |
| process PID 12059 (`node --import tsx launch.mts`) and the script runtime's child 12060 | `stop: ended on TERM (exit 0, signal null)`; `PID 12059: no such process`; `ps -p 12059,12060` afterwards: neither; 0 processes name the temporary root; `port 4477: free` |

Listeners before and after the session (4400-4499, 5170-5179, 8550-8579), compared by `diff`: identical - the user's instances on 4421, 4422, 4423, 5176, 5177, 5178 with the same PIDs, PostgreSQL on 4432. The database `dems_test_m12_row232` and `.cache/task4-row232/` were not touched.

LEFT BEHIND, stated: the two driver source files in `.cache/task4-row220/` (git-ignored; no data, no key, no log), so that gate 223 can run the session again. Nothing else.

## 5. What stays unproven

- The Linux host profile and the address helper (checks 4d, 4e on `linux`): hardware check H6 / 9A.
- The file `src/index.ts` as a started process (F-3).
- A person at a terminal for either command (attended check H5).
- A recording: no source exists in the selector, and the production kinds do not record before row 88.
- "Removed also on failure" on a measured failed run.
- Both commands given the same directory (section 3).

## 6. Red that is not this row's

None seen. For the record of others: `capture-relay` was rebuilt at 12:20 by its writer (SHA-256 `9299b7cc...c0ffdaa1`; row 232 recorded `815725e3...` at 10:46); the user's instance of row 232 runs on the binaries of the working tree.

Process: the only existing files changed are `delegation_progress/file_claims.md` (one line, Edit tool) and the test file of row 216. Nothing committed, staged or stashed. No real device contacted, no probe sent, no credential typed or read by this agent.

---
*Generated: 2026-10-13*
