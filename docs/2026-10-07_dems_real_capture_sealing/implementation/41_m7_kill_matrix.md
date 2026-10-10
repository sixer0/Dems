---
task_id: 2026-10-07_dems_real_capture_sealing
row: 86 (M7-W5) — kill matrix
date: 2026-10-09
agent: coder-execution
baseline: e296ce7 + the uncommitted wave D tree (row 71c was editing `src/sealing-host` during the runs)
status: needs-review — harness built; 9 of 35 checks run once (7 green, M7-REF-1 red then green, M7-KM-P4-S6 red); 26 checks are the test runner's; 2 findings filed; the carried demo regeneration is STOPPED with measured sizes
tier: 3
---

# Row 86 — kill matrix

Paths relative to the repository root; `K` = `apps/core-server/src/sealing/__tests__/kill-matrix`. No commit, no migration, no lockfile write, no product file edited, `.data/pg*.env` not read, no camera or microphone opened.

## 1. What was built

| File | What |
|---|---|
| `K/cells.ts` | The one table: 35 distinct checks (`M7-REF-1`, `M7-KM-P1..P4-0`, `M7-KM-C-S1..S6`, `M7-KM-P1..P4-S1..S6`), each with its kills (kind stated) and its pass rule; `PARKED_CELLS` = the 10 `S7` / `S8` cells with their condition (OD-21), not built and refused by `selectCells`. No "all", no repeat count |
| `K/core-child.ts` | The Core in a process of its own: `buildApp` with every unit, capture mode `real` + development sources, booted as `src/index.ts` boots it. The PRODUCT composition (`src/sealing-host`) seals and RECOVERY resumes; nothing of it is copied. Database configuration arrives over the IPC channel (no credential in argv or environment) |
| `K/rig.ts` | Harness side: start / SIGKILL / restart, session through the routes, rows as `dems_owner`, files, manifest, op 41 |
| `K/judge.ts` | Pass rules as pure functions |
| `K/cells.test.ts` | Unit: the table and every pass rule with a control that fails it (10 tests) |
| `K/kill-matrix.db.test.ts` | Runner file; skipped unless `DEMS_KILL_MATRIX` names checks; one `it` per named check; report per cell in `.cache/kill-matrix/` (git-ignored) |
| `K/run.sh` | `--list`, `--only <id>` (takes the heavy-host and the db lock; ports 127.0.0.1:8554 / 8556) |

**Kinds of kill, per cell (`cells.ts`, column `kills`).**

| Kill | Kind | Why |
|---|---|---|
| P1, P2, P3 | SIGKILL from the harness to the capture worker, the Core's process and the source helpers | The spec's kill of the capture side; real processes, signal from outside |
| P4 and every step `S1`..`S6` | The Core's process sends SIGKILL to ITSELF at a write of the sealing journal | A killed process (no `finally`, no flush, no report), at an exact point. A signal from outside cannot hit a step that lasts milliseconds. The production ports carry no hook (note 37b §5 item 4) and the product is closed, so the point is the pool's `query` wrapped in the child only: `BEFORE` = the step's RUNNING write not sent, `AFTER_WORK` = its DONE write not sent, `AFTER_CHECKPOINT` = DONE answered — the pipeline's own three hook points |

A step cell kills at `AFTER_WORK` (work on disk, journal unaware). P4 = `CLOSE_TRACKS:BEFORE` after the stop.

**Pass rule of a sealed cell:** session SEALED; 1 item in `evidence_items`, 1 `EVIDENCE_SEALED` audit row; six `sealing_jobs` rows DONE, last step at attempt 2 after a seal kill; at each seal kill the journal is the one the point names and no item exists before the commit; package folder = declared files only (no plaintext recording, no `.part`); manifest `interrupted` as expected on timeline and every fragment; each sealed fragment's plaintext digest = the recorder's row; no fragment durable at the kill is missing; `tracks[].sha256Plain` = SHA-256 of the first `bytes` of a copy of the recording taken at the kill; manifest + signature byte-identical to what the killed run wrote (`S5`, `S6`); `BUILD_MANIFEST`'s frozen checkpoint kept (`S4`); op 41 PASS, 15 checks, interrupted flag. **P1:** 0 items, 0 journal rows, no sealed file, 4 start records, session row not RECORDING, the armed Core not killed.

## 2. Real / stand-in / not staged

- Real: built worker, product app and composition, PostgreSQL as `dems_app`, SIGKILL, credential store, development signing key, verify v2.
- Generated: sources (FAKE kind, private helper); tablet link set through the engine.
- **P2's torn tail is synthetic** (half of the last recorded fragment appended to VIDEO-01 after the kill): a real kill never tore a fragment (note 21).
- **P3's "transcript chunk in flight" is NOT staged**: STT is off in the rig and no transcriber session runs for a recording. Each P3 report says so. To wire when row 71c lands.
- **"Final hashes equal M7-REF-1 / M7-KM-P*-0" is read per cell** (decision D-86-1): two live recordings never have equal bytes, and each seal has its own key and IVs. The reference is the cell's own recording.

## 3. Results (each once; D122)

| Check | Result | Notes |
|---|---|---|
| `cells.test.ts` + `test/static` + `pipeline.test.ts` | 205 passed | typecheck: 0 errors in `K`; lint: 0 findings in `K` |
| `M7-REF-1` | **run 1 RED, run 2 green** | F-86-1 |
| `M7-KM-P1-0` | green | killed: worker, Core, helper; no camera file yet; session row FAULT after the boot |
| `M7-KM-P2-0` | green | 28.0 MB torn tail dropped and marked (`VIDEO-01:3` truncated); 3 + 3 fragments; interrupted |
| `M7-KM-P3-0` | green | 2 interval rows, 1 open at the kill; interrupted |
| `M7-KM-P4-0` | green | 0 journal rows at the kill, session FINALIZING; not interrupted |
| `M7-KM-P1-S1` | green | armed Core not killed, 0 journal rows |
| `M7-KM-P2-S1` | green | all six steps at attempt 2; torn tail dropped once |
| `M7-KM-P3-S4` | green | resumed from `BUILD_MANIFEST`, frozen checkpoint kept |
| `M7-KM-P4-S6` | **RED** | F-86-2 |

Why these four kill cells: P1-S1 — the only step recovery of a failed start could enter; P2-S1 — a second seal-time encryption over a torn file; P3-S4 — the manifest rebuilt with an interval closed at seal time; P4-S6 — the commit / journal gap.

Staging history, not hidden: `M7-KM-P1-0` first ran green killing before the worker existed (too early); a version waiting for the camera file ended NOT STAGED twice (first fragment already durable); the final staging waits for the worker process. Rows 71c's edit of `sealing-host/session-reader.ts` broke the Core's boot for one run of `M7-KM-P4-S6` (export `NO_STT_SNAPSHOT`); the result above is from the run after it compiled again. Checks before that edit: REF-1, P2-0, P3-0, P4-0, P2-S1, P3-S4.

## 4. Findings (request lines filed, product not edited)

| ID | Cell | Evidence | Reading |
|---|---|---|---|
| F-86-1 | `M7-REF-1` run 1 | `.cache/kill-matrix/M7-REF-1-1791563426356.json`: journal six DONE, media rules pass, op 41 `ok false`, `CORRUPT`, V-05 FAIL | Not captured in that run: the finding code. Reading: `FRAGMENT_TOO_LARGE` (`packages/shared/src/evidence-verify/verify.ts:430`; bound 64 MiB, `:19`). Measured in this rig: fragments of 51-58 MB, sealed camera file 205 MB for 4. The pipeline seals any size. Same signature as note 37b §5 item 1 |
| F-86-2 | `M7-KM-P4-S6` | journal after the last boot: five DONE + `STORE_SEALED_PACKAGE:RUNNING:attempt 1`; item 1, audit 1, folder clean, bytes identical, verify PASS | `controller.ts:112-115`: a SEALED session answers NONE, the last step is never finished. Not measured: a death between the commit and the removal of the plaintext recordings would leave them for good |

Observation: on a resume the transcript step's row is rewritten at the new attempt although the run reports the step skipped (`M7-KM-P3-S4`).

## 5. Carried item — v2 demo packages: STOPPED, nothing written

`gen-demo-evidence.ts` and `packages/shared/assets/**` are untouched; SHA-256 over the 89 tracked files of `assets/demo-evidence` = `005e8f85…1fd4b1` before and after. Reasons: 205 MB per sealed camera file (about 410 MB per package, 5.7 GB for 14) against 42 MB of demo media today; a v2 package opens only with the session key of the Core that sealed it; the product writer / signer live in `apps/core-server`. It has to be a seed-time generator in `apps/core-server` — closed areas and a ruling.

## 6. Decisions

| ID | Decision |
|---|---|
| D-86-1 | Hash equality is judged against the cell's own recording (rows + copy), not against another run |
| D-86-2 | Step kills are a SIGKILL of the Core by itself at the journal write; a step cell kills at `AFTER_WORK` |
| D-86-3 | P kills take the worker, the Core and the helpers together (power-loss model); the supervisor's back-off path with a living Core is not a cell |
| D-86-4 | P1 = worker running, nothing durable; P2's torn tail synthetic; P3 without STT |
| D-86-5 | A check runs only when named; a parked or unknown ID fails the file |

## 7. To wire

| When | What |
|---|---|
| row 71c | P3 with a transcriber session; re-read `core-child.ts` if the STT snapshot changes what a rig with STT off seals |
| F-86-2 fixed | `M7-KM-*-S6` expected green |
| a hook in production ports | not needed |

## 8. Checks for the test runner

Each ONCE; a second run only after a red. Sandbox off. Command: `apps/core-server/src/sealing/__tests__/kill-matrix/run.sh --only <id>` (takes `.locks/heavy-host.lock` and `.locks/db-migrate.lock` itself; about 20 s per check; several `--only` in one call run one after the other). Report per check: `.cache/kill-matrix/<id>-<stamp>.json`.

| IDs | Expected |
|---|---|
| `M7-KM-C-S1` .. `M7-KM-C-S5` | green: SEALED, not interrupted, attempt 2 |
| `M7-KM-P1-S2` .. `M7-KM-P1-S6` | green: failed start, armed Core alive |
| `M7-KM-P2-S2` .. `M7-KM-P2-S5` | green: SEALED interrupted, torn tail dropped |
| `M7-KM-P3-S1`, `-S2`, `-S3`, `-S5` | green: SEALED interrupted (STT half not staged) |
| `M7-KM-P4-S1` .. `M7-KM-P4-S5` | green: SEALED, not interrupted |
| `M7-KM-C-S6`, `M7-KM-P2-S6`, `M7-KM-P3-S6` | expected RED by F-86-2 (predicted from `M7-KM-P4-S6`, not run) |
| any sealed cell | may show F-86-1: `facts.verify.failures` then names the code |

Also: `npx vitest run --root apps/core-server --project unit src/sealing/__tests__/kill-matrix` -> 10 passed. Not for the runner: `S7` / `S8` (parked, OD-21); kill loops (test strategy §F.3).
