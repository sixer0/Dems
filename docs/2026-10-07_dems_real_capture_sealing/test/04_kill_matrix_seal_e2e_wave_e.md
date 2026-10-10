---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
date: 2026-10-10
agent: test-expert (test runner, decision D122)
status: completed
scope: kill matrix (35 checks), seal end-to-end, development-session end-to-end; tree = schema 6 / dbc-7, uncommitted wave E
---

# Test report 04 - kill matrix, seal e2e, development-session e2e (wave E)

Paths relative to the repository root. Run 2026-10-10 between 09:08 and 09:32, sandbox off, one check at a time. No product file, no migration, no commit, no git write. No camera or microphone opened; `DEMS_LOCAL_SESSION_ATTENDED` / `DEMS_USER_ATTENDED` were not set (checked: `env` shows neither); nothing under `.../local/__tests__/e2e/` was run; `.data/pg*.env` not read; PostgreSQL 127.0.0.1:4432 was already up (`nc -z`); ports 5173-5175, 8000, 5432 not touched. The first check waited 546 s for `.locks/heavy-host.lock` (another agent's worker e2e held it).

## 1. Counts

| | |
|---|---|
| Kill matrix checks in the list | 35 (+ 10 parked) |
| Green | 35 |
| Red at the end | 0 |
| Green only after the single re-run | 18 (first run died at Core boot, section 3) |
| Parked (refused by the harness, not run) | 10: `M7-KM-C-S7`, `-C-S8`, `-P1-S7`, `-P1-S8`, `-P2-S7`, `-P2-S8`, `-P3-S7`, `-P3-S8`, `-P4-S7`, `-P4-S8` (condition printed: "OD-21 fallback path activated (CONCATENATE_SEGMENTS / ENCRYPT_PAYLOAD are not built)") |
| Not run | 0 |
| Seal e2e | 2 passed (after one re-run; first run: setup gap, section 4) |
| Development-session e2e | 2 passed, 1 skipped (the attended case, skipped as required) |

## 2. Kill matrix - every check

Command per check: `apps/core-server/src/sealing/__tests__/kill-matrix/run.sh --only <id>` (35-check list from `--list`: `M7-REF-1`, `M7-KM-C-S1..S6`, `M7-KM-P1..P4-0`, `M7-KM-P1..P4-S1..S6`). `runs` = how many times the check was started; `seal attempt` = `outcome.attempt` in the cell report (P1 cells seal nothing: a failed start); `duration` = wall seconds of the final run (vitest's own duration in brackets; wall includes lock wait where it is larger). Every final log ends `Test Files 1 passed (1)`, `Tests 1 passed (1)`. Each sealed cell report: `wrong: []`, verify `ok true`, `overall PASS`, 15 checks, `failures: []`, six `sealing_jobs` rows DONE.

| id | result | runs | seal attempt | interrupted | duration |
|---|---|---|---|---|---|
| M7-REF-1 | green | 1 | 1 | no | 546 s wall (lock wait) [15.7 s] |
| M7-KM-P4-S6 | green | 1 | 2 | no | 17 s |
| M7-KM-C-S6 | green | 1 | 2 | no | 16 s |
| M7-KM-P2-S6 | green | 1 | 2 | yes | 16 s |
| M7-KM-P3-S6 | green | 1 | 2 | yes | 17 s |
| M7-KM-C-S1 | green | 1 | 2 | no | 16 s |
| M7-KM-C-S2 | green | 1 | 2 | no | 17 s |
| M7-KM-C-S3 | green | 1 | 2 | no | 16 s |
| M7-KM-C-S4 | green | 1 | 2 | no | 16 s |
| M7-KM-C-S5 | green | 1 | 2 | no | 16 s |
| M7-KM-P1-0 | green | 1 | n/a (failed start) | n/a | 24 s |
| M7-KM-P1-S1 | green | 1 | n/a | n/a | 29 s |
| M7-KM-P1-S2 | green | 1 | n/a | n/a | 28 s |
| M7-KM-P1-S3 | green | 1 | n/a | n/a | 29 s |
| M7-KM-P1-S4 | green | 1 | n/a | n/a | 29 s |
| M7-KM-P1-S5 | green | 1 | n/a | n/a | 29 s |
| M7-KM-P1-S6 | green | 1 | n/a | n/a | 29 s |
| M7-KM-P2-0 | green | 2 | 1 | yes | 15 s |
| M7-KM-P2-S1 | green | 2 | 2 | yes | 16 s |
| M7-KM-P2-S2 | green | 2 | 2 | yes | 22 s wall [15.9 s] |
| M7-KM-P2-S3 | green | 2 | 2 | yes | 16 s |
| M7-KM-P2-S4 | green | 2 | 2 | yes | 16 s |
| M7-KM-P2-S5 | green | 2 | 2 | yes | 16 s |
| M7-KM-P3-0 | green | 2 | 1 | yes | 16 s |
| M7-KM-P3-S1 | green | 2 | 2 | yes | 17 s |
| M7-KM-P3-S2 | green | 2 | 2 | yes | 16 s |
| M7-KM-P3-S3 | green | 2 | 2 | yes | 17 s |
| M7-KM-P3-S4 | green | 2 | 2 | yes | 31 s wall [16.4 s] |
| M7-KM-P3-S5 | green | 2 | 2 | yes | 20 s wall [16.5 s] |
| M7-KM-P4-0 | green | 2 | 1 | no | 31 s wall [16.2 s] |
| M7-KM-P4-S1 | green | 2 | 2 | no | 126 s wall [16.9 s] |
| M7-KM-P4-S2 | green | 2 | 2 | no | 17 s |
| M7-KM-P4-S3 | green | 2 | 2 | no | 17 s |
| M7-KM-P4-S4 | green | 2 | 2 | no | 17 s |
| M7-KM-P4-S5 | green | 2 | 2 | no | 18 s |

Report files: `.cache/kill-matrix/<id>-<stamp>.json` (git-ignored; stamps >= 1791598000000 are today's). For the 18 cells with `runs 2` the first-run report in that folder holds only the `error` string of section 3; the cell result is the later stamp.

What the reports show (quoted from the report fields, no reading added):

- The four S6 cells and `M7-REF-1` (the step-2 group): `M7-KM-P4-S6`, `-C-S6`, `-P2-S6`, `-P3-S6` journal at the end: six rows DONE, `FINALIZE_TRANSCRIPT` attempt 2, `STORE_SEALED_PACKAGE` attempt 2, outcome `SEALED`, attempt 2, `skipped` = `CLOSE_TRACKS, FINALIZE_HASHES, FINALIZE_TRANSCRIPT, BUILD_MANIFEST, SIGN_MANIFEST`; `signedBytesComparedWithKilledRun: true`; verify PASS 15 checks. `M7-REF-1` journal six DONE at attempt 1, verify PASS (it was RED in note 41 with `CORRUPT` / V-05; green now with fragments of 3.3 / 2.6 MB in the `M7-KM-P4-S6` report `reference.sealedBytesPerFile`).
- P1 cells (7): report `facts.sessionRowAfterBoot: ["FAULT"]`, `cameraFileAtKill: false`, journal empty, `itemsAtKill: 0`, killed processes listed `capture-worker, core, ffmpeg x3`; `wrong: []`.
- P3 cells (6 + `M7-KM-P3-S6`): each report lists under `notStaged`: "a transcript chunk in flight (STT is off in the rig; no transcriber session is wired to a recording)" - unchanged from note 41.
- P2 cells: `interrupted: true`; the torn tail is the harness's synthetic one (note 41 section 2); not re-judged here.
- Plaintext recordings left: no, in every sealed cell - the pass rule (note 41 section 1) includes "package folder = declared files only (no plaintext recording, no `.part`)" and every report has `wrong: []`. I did not open any package folder.

## 3. Red results (first run) and the single re-run

There are 18 first-run reds, all the same signature, and none is red after the one re-run. The ids: `M7-KM-P2-0`, `P2-S1..S5`, `P3-0`, `P3-S1..S5`, `P4-0`, `P4-S1..S5` - exactly the 18 checks that ran between 09:14:44 and 09:15:29 in the loop (run 1 logs kept in the scratchpad `km/run1/`).

| Item | Value |
|---|---|
| Failing criterion (verbatim, same in all 18) | `Error: the Core's process ended (1) before it was ready: ... code: 'ERR_MODULE_NOT_FOUND', url: 'file:///Users/gsp-budi/Documents/DEMS/apps/core-server/src/db/seed/demo-helper'` |
| Where | `src/sealing/__tests__/kill-matrix/rig.ts:158` (the Core child); the test duration was 2-3 s, i.e. before any recording started |
| `facts.verify.failures` | none: no cell facts were produced (report holds only the `error` field), e.g. `.cache/kill-matrix/M7-KM-P2-0-1791598484417.json` |
| Re-run red again? | No: all 18 re-runs green (09:22:13 - 09:29:22), see section 2 |
| What I observed in the tree (not an attribution) | `apps/core-server/src/db/seed/demo-helper.ts` has mtime Oct 10 09:14 and is untracked (`??`); `seed/demo-core.ts`, `seed/cli.ts` mtime 09:16 - files in that folder were being written while the first run went through. At the re-run the file existed |

The 17 checks before that point (REF-1, the four S6, C-S1..S5, P1-0, P1-S1..S6) had run at 09:08-09:14:42 and were green on the first run.

## 4. Seal end-to-end

Command (as given): `DEMS_SEAL_E2E=1 DEMS_SEAL_E2E_OUT="$PWD/.cache/seal-e2e-waveE" /usr/bin/lockf -k -t 3600 .locks/heavy-host.lock /usr/bin/lockf -k -t 3600 .locks/db-migrate.lock npx vitest run --root apps/core-server --project db src/sealing-host/__tests__/e2e/seal-e2e.db.test.ts`

| Run | Result |
|---|---|
| 1 (09:29:48) | 2 failed: `Error: ENOENT: no such file or directory, open '.../.cache/seal-e2e-waveE/verify-SES-20261010-0024-<stamp>.json'` at `seal-e2e.db.test.ts:179` (`sealedAndVerified`), in both (a) and (b) |
| Cause as printed | The directory named by `DEMS_SEAL_E2E_OUT` did not exist; line 179 does `writeFileSync` into it without creating it, before the assertions at lines 180-184. The failure is therefore not a verdict on the sealed package |
| Deviation from my brief | I created the empty directory `.cache/seal-e2e-waveE` (git-ignored; it is the output directory the command itself names) and ran the check once more. That directory and the two JSON files in it are the only things written besides this report |
| 2 (09:30:31) | **2 passed (2)**, duration 31.4 s: (a) start -> record -> stop -> seal -> verify PASS, (b) worker KILLED mid-recording, Core down, new Core, RECOVERY seals as interrupted |

Reports in `.cache/seal-e2e-waveE/` (`verify-SES-20261010-0024-1791599448373.json` = (a), `...-1791599462314.json` = (b)):

| Field | (a) | (b) |
|---|---|---|
| `ok` / `overall` | true / PASS | true / PASS |
| `interrupted` (expected) | false (false) | true (true) |
| checks | V-01..V-15 all PASS (15) | V-01..V-15 all PASS (15) |
| `failedFragmentCount` | 0 | 0 |
| `sources` | `code: DEVELOPMENT`, `development: true`; tracks `VIDEO-01 CAM-01 FAKE`, `VIDEO-02 CAM-02 FAKE`; audio interval `1 MIC-01 FAKE` | same |
| `transcriptState` | `code DISABLED_BY_CONFIGURATION`, `sealedState DISABLED`, `documentSealed false`, `backendUnreachable false` | same |

- The test itself also asserts (lines 152-154): `VIDEO-01.mp4` / `VIDEO-02.mp4` do not exist in the package folder, and the manifest has `integrity: 'REAL'`, `developmentSources: true`, `transcript: { state: 'DISABLED' }`. It passed, so plaintext recordings left in the package folder: no.
- `tracks[].codec` and the microphone `missing` count are NOT in this test's report or assertions (grep of the test file for `codec` / `missing` finds nothing). So the seal e2e does not show them; section 5 gives them from the other e2e's package.

## 5. Development-session end-to-end (generated sources only)

Command (as given, no attended variable): `DEMS_DEV_SESSION_E2E=1 /usr/bin/lockf -k -t 3600 .locks/heavy-host.lock /usr/bin/lockf -k -t 3600 .locks/db-migrate.lock npx vitest run --root apps/core-server --project db src/capture/fence/__tests__/e2e/development-session-e2e.db.test.ts`. Run once (09:31:19), no lock wait.

Result: `Test Files 1 passed (1)`, `Tests 2 passed | 1 skipped (3)`, duration 16.2 s, exit 0. The skipped case is the attended one (`describe.skipIf(!ATTENDED)`, line 272; `DEMS_LOCAL_SESSION_ATTENDED` was not set), as required.

`row140-result.json` (in `.data/test-row61-row140e2e-89208-1/`, read as JSON only, no media opened):

| Field | Value |
|---|---|
| check / mode / verdict | `M5-LOCAL-E2E-1` / `GENERATED` / `pass` |
| seconds | 6 |
| fragments | `VIDEO-01:3`, `VIDEO-02:2` |
| `microphoneHelpersWhileRecording` | 2 |
| `microphoneFaultsWhileRecording` | `[]` |
| `developmentSources` | true |
| `verify` | PASS |
| `sources` | `CAM-01 FAKE`, `CAM-02 FAKE` |

Facts from the same fixture's sealed package (the folder was left in place by the test; I deleted nothing):

| Fact | Value | Source |
|---|---|---|
| `tracks[].codec` | `H264` for `VIDEO-01` (CAM-01, FAKE, 3,864,901 bytes) and `VIDEO-02` (CAM-02, FAKE, 3,105,166 bytes) | `media/sessions/SESSION-SES-20261010-0024/session-manifest.json` |
| `developmentSources` / `integrity` | true / REAL | same manifest |
| transcript | `disabledReason: DISABLED_BY_CONFIGURATION`, `configSnapshot: {backend cpu-local, diarization true, enabled false, model ggml-large-v3-turbo, revision 1}` | same manifest |
| `timeline.interrupted` | false | same manifest |
| microphones | `mic_summary` mic 1: `received 422912, missing 0, dropped 0, restarts 0`; mic 2: `received 422912, missing 0, dropped 0, restarts 0` | `capture-worker.jsonl` |
| camera summaries | cam 1: 219 video packets, 4 fragments, 4 durable, 3,864,901 bytes; cam 2: 174 video packets, 3 fragments, 3 durable, 3,105,166 bytes | `capture-worker.jsonl` |
| plaintext recordings left | no: `media/sessions/SESSION-SES-20261010-0024/` holds `fragments/` (`VIDEO-01.mp4`, `VIDEO-02.mp4`, `fragments.json`), `session-manifest.json`, `signature.sig`, `device-certificate.pem`, `audit-session-extract.jsonl`; no `VIDEO-0x.mp4` at the folder root; `media/sessions/.sealing/SES-20261010-0024` is empty (names listed only) | directory listing |
| `error.log` | two `warn` lines, code `CAPTURE_FIRST_VIDEO_HELD` ("video delivered before the first keyframe at or after the start is not in the camera file") | `error.log` |

## 6. Limitations

- The 18 reds of section 3 were a Core-boot failure (`ERR_MODULE_NOT_FOUND`) during a window when another agent's files in `src/db/seed/` were in motion. Their green re-runs prove the checks pass against the tree as it stood from 09:22; they do not tell what the tree looked like at 09:14. I attribute nothing beyond the printed error and the file times above.
- The 35 first-or-second runs are from different moments of a shared, uncommitted tree (09:08 - 09:29); a later edit by another row is not covered.
- P2's torn tail is synthetic and P3's "transcript chunk in flight" is not staged (both stated in note 41 and in the cell reports).
- Seal e2e (b) "crash" of the Core is an in-process `app.close()` (note 37b), unchanged.
- The seal e2e report does not carry `tracks[].codec` or microphone `missing`; those come from the development-session e2e package and worker log above.

## 7. Process check at the end (09:32)

`pgrep -fl 'capture-worker|ffmpeg'` returned nothing; no vitest, `core-child`, kill-matrix or e2e process of mine is running. (At 08:59 the same command had listed another agent's capture-worker build / e2e processes; none of them was started, touched or killed by me, and they were gone at the end.)

Run logs (scratchpad, not in the repo): `/private/tmp/claude-501/-Users-gsp-budi-Documents-DEMS/a653efdb-135b-4d4c-a16a-a0c17ca466ab/scratchpad/km/` (`<id>.log`, `run1/`, `results.tsv`, `seal-e2e-run1.log`, `seal-e2e.log`, `dev-e2e.log`).

---
*Generated: 2026-10-10 09:35*
