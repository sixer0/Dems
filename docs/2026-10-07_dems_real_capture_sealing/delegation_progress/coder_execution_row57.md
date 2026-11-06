---
agent: coder-execution (driver, pair-programming; navigator reviews)
row: 57 (M3-W1)
date: 2026-10-09
status: needs-review
artifact: implementation/19_m3_supervisor_ipc.md
base: HEAD 9d3a1ef, nothing committed
---

# Row 57 progress (parallel run: this file replaces writes to the shared trackers)

## Status

needs-review. The code, the three named checks (M3-KC-3, M3-KC-1, M3-SR-1), the P25 edit list and
the respawn of a killed worker are done and green. It is not `complete` because:

1. SH-18 and CS-04, which the row lists under "closes", are NOT closed (no INTERNAL engine actions
   exist; `implementation/19_m3_supervisor_ipc.md` section 2). Needs a routing decision.
2. One existing security guard was changed (`test/static/credentials.test.ts`: exactly
   `src/capture/ipc.ts` may import the process module). Needs review.
3. A defect in row 52's `modules/capture-config/store.ts` was fixed outside this row's file list
   (`updated_at::int` stopped every boot once the module was mounted). Needs review.

## Milestones

| # | Milestone | Evidence |
|---|---|---|
| 1 | `packages/capture-protocol` created and linked (lockfile +17 lines under `lockf`) | note section 7 |
| 2 | Supervisor, process channel, timers, module in `apps/core-server/src/capture/` | note sections 1, 3 |
| 3 | P25 edits 1-6, 11, 12 applied; `config.ts` untouched | note section 4 (file:line table, `git diff -U0`) |
| 4 | M3-KC-3, M3-KC-1, M3-SR-1: 72/72 in 3 runs (2 + 1), with controls and three mutation proofs | note section 5.1 |
| 5 | Killed real process respawns (PID changes, session kept); control with no restart allowed | note section 5.2 |
| 6 | Full unit suite: 9 failed = 3 baseline + 6 row 113; 0 from this row | note section 5.7 |
| 7 | Full db suite: first run 89 failed (boot step `capture.config`), fixed, second run 29 failed + 1 file not collected, all row 113; 0 from this row | note sections 5.7, 6 |

## Blockers

None for this row's own checks. For the M3 gate: SH-18 / CS-04 routing (above).

## Decisions to record (IDs are local to this row; details in the note, section 9)

- D57-1 IPC transport: NDJSON over the worker's stdin/stdout, no port.
- D57-2 Protocol adds `HELLO` and `ACK` to the spec's eight messages.
- D57-3 `CaptureSupervisor` gains `boot()` / `shutdown()` for the entry point.
- D57-4 Timing and queue defaults are unmeasured choices (HYPOTHESIS until row 58).
- D57-5 `credentials.test.ts` child-process guard narrowed to exempt `src/capture/ipc.ts` only (needs review).
- D57-6 Spec §G G-R1 is false as written for two pre-capture files; guard pins those two (erratum candidate).
- D57-7 Fixed `updated_at::int` in `modules/capture-config/store.ts` (row 52's file) with a db test that keeps the failing scenario.
- D57-8 SH-18 and CS-04 not closed; `15_m2_api_contract.md:10` claims SH-18 closed by row 48 but `sim-actions.ts` still has 42 actions and one INTERNAL (`setTabletLink`).
- D57-9 Telemetry coalesces under back-pressure; progress and warnings never dropped.
- D57-10 `app.ts` header comments are stale (untouched by rule).
- D57-11 Row 113 added `sttConfigModule` to the P25-frozen `app.ts` (lines 96, 317): outside spec §I's list of 12.
- D57-12 Row 58 must update the `config.ts` assertion of `src/capture/__tests__/static.test.ts` when it adds edits 7-10.

## Drift-log candidates

- Row 57 delivered 3 of its 5 "closes" IDs (NM-03, CS-01, CS-03).
- Row 57 edited four existing test files to extend pins (scaffold units 21 -> 23, seams 9 -> 10, closed units + `src/capture`, child-process exemption) and one production file of row 52.
- The entry point's two new lines have no runtime test (no test starts the entry point; pre-existing gap).
- The running lane stack (4421-4423) was not restarted and still runs pre-row-57 code; `apps/core-server/logs/errors.log` has no entry after 08:42 local.

## Files

See `implementation/19_m3_supervisor_ipc.md` section 3 (15 created, 10 modified, 0 deleted).

---

# Fix round 1 (navigator findings)

Status: **needs-review** (all assigned findings are fixed with tests except F-7, which is returned
as a decision because the specification is silent). Detail and evidence:
`implementation/19_m3_supervisor_ipc.md`, section "Fix round 1".

| Finding | Outcome |
|---|---|
| F-1 | fixed: the worker's output is never paused; heartbeats and ACKs are always read (fake + real-process tests, red first) |
| F-2 | fixed: the supervisor's own events are delivered at once and wait for no listener |
| F-3 | fixed: `STOP` is outside the command window |
| F-4 | fixed: `eventQueueLimit` is a hard bound, tested at the bound on the fake and on a real process |
| F-7 | returned as a decision: spec silent on what a restarted worker does with the existing file; options A/B/C in the note, R3. Only the OD-08 consequence ("never destroy existing bytes") was written into the protocol header |
| F-8 | fixed: pin test of the two restated value sets |
| F-10 | hypothesis proved by a test, then fixed |
| F-11 | fixed (comment) |
| 6(d) | fixed: `app.ts` header records the waived edit set; P25 pin updated in the same change |

Decisions and notes for the controller:
- D57-14 Back-pressure design: no pause; bounded queue that replaces levels and evicts at the bound; losses counted and reported as `CAPTURE_EVENT_OVERFLOW`. Supersedes D57-9: progress values CAN now be superseded or evicted.
- D57-15 A record that must never be lost (fragment checkpoints, row 59) must not use the supervisor's event queue.
- D57-16 F-7 needs a decision (A segment per attempt / B resume in the same file / C no restart once fragments exist).
- D57-17 `CaptureStatus.inputPaused` removed, `droppedEvents` added; `WorkerChannel.pause/resume` removed. Row 58 builds on this interface.
- One of the 72 original tests was replaced because it asserted the removed pause (named in the note, R4).
- `app.ts` gained 5 comment lines under the §I allowance; the line numbers of the 8 code edits moved by +5.

Suites: capture 86/86 twice; full unit 7 failed = 3 baseline + 4 row 113, 0 row 57; typecheck and lint exit 0 for core-server and capture-protocol; capture db test 3/3.
