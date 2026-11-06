---
task_id: 2026-10-12_input_av_core_adapter_plan
task_slug: input_av_core_adapter_plan
row: 15
gate: M1 (plan phase 1: the experiments)
date: 2026-10-13
agent: verifier (batch 9, agent R13)
narrative_tier: 1
source_blueprint: identification/03_implementation_blueprint.md (row 15; section 9, line "M1")
baseline: cf2f8008
read_at: commit 0f5d2a8e, host clock 2026-10-13 10:45
verdict: PASSED WITH TWO NAMED OPEN ITEMS
status: complete
---

# Gate M1: plan phase 1, the experiments

## 1. Verdict

**PASSED WITH TWO NAMED OPEN ITEMS.** Neither stops a later milestone's coding; the first sits on the path to the lift through rows 57 and 59.

| # | Open item | What the gate's words require | What is unmet | What closes it, exactly | Owner |
|---|---|---|---|---|---|
| O-1 | **E-8 is incomplete: the tablet was not measured** | "verdict complete" (row 15); "the verdict of row 14 with five results" (section 9); the plan's completion check asks E-8 "per client as plays or states that it cannot" (`masterplan/02_plan.md:279`), for three clients (`masterplan/01_specs.md:333`) | 1 of 3 per-client outcomes: web console plays, export decodes, **tablet NOT RUN** (`test/012_e8_playback.md:25`; `test/014_wp01_verdict.md:25`, `:94`). Consequence 1b is therefore "no on today's evidence, not final", not a yes or no | One run of the tablet app's player on a sealed `hev1` item, on an emulator that the user's lanes 1 and 2 do not hold, recorded as "plays" or "takes its error path" in `test/012` and carried into `test/014` section 4.2. That record is also the run-or-skip record of row 57, which row 59 needs | controller schedules it (C45: asked of the user, or the device session at the M-gate); test-expert runs it |
| O-2 | **"0 product source files changed" does not hold by its letter: 1 file** | "change set = fixtures, tests, documents only" (row 15); "0 product source files changed" (section 9); rollback "remove the one change set of fixtures and tests" (`masterplan/02_plan.md:280`) | Row 13 added 15 lines to `apps/core-server/src/capture/adapters/mic-transport.ts` in 7969f0fa: a 10-line header statement and two exported constants (section 4). No behaviour: the only importer of the two constants is the test | A controller decision row that records the deviation (as C32 did for set A). No code correction is expected: the row's own cell asked for it ("the transport statement for production", row 13; `masterplan/02_plan.md:276`), so the gate's wording and the row's cell disagreed from the start | controller |

Everything else the gate asks holds: five results are written, each with its evidence; E-6 passed on all 16,777,216 values; the branch is logged (C26, C27, C28: branch B, provisional until row 141); the three consequences are decided and adopted (C45).

**Can M1 close with E-8 incomplete? Yes, as "passed with an open item", not as "passed".** Reasons: (1) row 14's cell admits "a named outcome" and E-8 has one, INCOMPLETE, with the missing part named; (2) the gate rule of section 9 is that a failed item is routed, and this one has a route (C45); (3) nothing built in M2 to M5 reads the tablet result; (4) lift condition L-4 asks only that E-1 and E-2 passed for the worker part, which they did. What it does hold: row 57 (run or skip) and behind it row 59, which is part of lift condition L-2. The controller's two options are those of `test/014:110`: hold row 59 for the tablet run, or let it proceed on "condition not met as of row 14" and accept one repeat of the worker series.

## 2. Frame (5W1H)

| Question | Answer |
|---|---|
| What | Whether plan phase 1 (WP-01 experiments E-1, E-2, E-8, E-10, E-11; WP-09 check E-6; gate RC-1) is closed by its evidence |
| Why | Rows 34, 56, 57 and 59 take their run-or-skip from this phase; the lift's conditions L-2 and L-4 cite it |
| Who | Gate: verifier. Evidence by coder-execution (E-1, E-2, row 13), test-expert (rows 6, 7, 10, 11, 12, 14), verifier (row 8), security-review (`verification/05`), controller (C26 to C28, C45) |
| When | Runs 2026-10-12 and 2026-10-13; this gate 2026-10-13 10:45, at commit 0f5d2a8e |
| Where | This Mac only (macOS, FFmpeg 9.0.2, libavformat 63.1.102). No Linux, no container, no real camera in any run |
| How | Reading the records, not the executors' summaries; read-only git against the baseline cf2f8008. Nothing was run, no suite, no source file changed |

Read in full: `test/014_wp01_verdict.md`, `decisions/decisions.md`, `delegation_progress/file_ownership.md`, row 13's record and note. Read in their result sections: `gateway_check/008`, `test/01`, `006`, `007`, `010`, `011`, `012`, `022`, `025`. **Not done:** no raw run output under `.cache/` was opened and no run was repeated; the gate rests on the records agreeing with each other and with git.

## 3. The gate's items, one by one

| Item | Result | Evidence |
|---|---|---|
| Row 8 (dependency): gate RC-1 | passed: branch B, provisional until row 141 | `gateway_check/008_rc1_branch_gate.md` section 1; C28 |
| Row 13 (dependency): E-6 | passed: 16,777,216 of 16,777,216 equal, raw and scaled, with a control that 2^24+1 does not survive | `implementation/013_wp09_transport.md`; the test at `apps/core-server/src/capture/adapters/__tests__/static.test.ts:169-181` |
| Row 14 (dependency): five results | E-1 pass (worker part), E-2 pass, E-8 INCOMPLETE, E-10 pass with a named qualification, E-11 ACCEPTED (18 of 21, 3 inconclusive, 0 refused) | `test/014_wp01_verdict.md:23-27` |
| Row 14: three consequences, each yes or no | 1a no (row 56 skipped); **1b not final (row 57 waits): O-1**; 2 no (row 34 skipped); 3 yes, provisional | `test/014:33-36`; C45 |
| Consequence 2 was conditional on row 43 | **now final.** Row 43 landed with the evidence row 14 demanded: first sample after the gap a sync sample, `held_back` 25, pictures 76 of 76 equal, and a negative control without the gate (0 of 76 equal with 0 decode errors) | `implementation/043_relay_reconnect_gating.md:66-74`; `file_ownership.md` update 10:04 |
| Branch logged | yes | C26, C27, C28; blueprint 9.1 "Outcome as recorded" |
| Change set = fixtures, tests, documents only | **not by its letter: O-2** | section 4 |

Provisional and carried, not open items of this gate: branch B until row 141 shows the announce line on the Ubuntu 24.04 library (BR-10; waits for row 193); the "repeated once" step for the inconclusive trailing-slash runs was not run and cannot change the branch (C28, I-2).

## 4. The change set of phase 1, checked against git

Phase 1 has no commit of its own: its rows landed in five commits together with other phases (7969f0fa, b7ed4c60, 6e6707dd, 3b388746, 0f5d2a8e), so the claim was checked on the paths the M1 rows name, with `git diff cf2f8008 --stat -- <paths>` and `git log --stat cf2f8008..HEAD -- <path>`.

| Row | Paths it names | Kind | In git |
|---|---|---|---|
| 6 | `apps/capture-worker/test-fixtures/e11_listener_path.py` | fixture, new, 516 lines | b7ed4c60 |
| 7 | `apps/capture-worker/test-fixtures/e11b_announced_path.py`; probe under `.cache/e11b-probe/` | fixture, new, 249 lines; git-ignored | b7ed4c60 |
| 10 | `apps/capture-worker/test-fixtures/row010_resumed_push.py` | fixture, new | 3b388746 |
| 11 | `.cache/hevc-experiment/e8_reader/` | git-ignored | - |
| 12 | `.cache/task4-row012/` (runner, four fixtures, a module replacement inside the runner) | git-ignored | - |
| 13 | `apps/core-server/src/capture/adapters/__tests__/static.test.ts` (one test, block A-3) | test | 7969f0fa |
| 13 | **`apps/core-server/src/capture/adapters/mic-transport.ts`** | **product source: +15, -0** | 7969f0fa |
| 8, 14, E-1/E-2 | records only | documents | 2307e9dc, b7ed4c60, 0f5d2a8e |

The one product file, from `git diff cf2f8008 HEAD -- apps/core-server/src/capture/adapters/mic-transport.ts`: ten comment lines ("THE SAMPLE-WIDTH STATEMENT FOR PRODUCTION") and

```
export const MIC_EXACT_SOURCE_BITS = 24;
export const MIC_PCM24_SCALE = 8_388_608;
```

A search of `apps/core-server/src` and `packages` finds both names in two files only: their definition and `static.test.ts`. `MIC_TRANSPORTS` is untouched. So the change states a fact and changes no path a recording takes; it is still a product source file, and the count the gate asks for is 1, not 0.

Records that state "no product file changed" and hold against git: `test/006:189-190`, `test/007:243-244`, `test/010:13`, `test/011:136`, `test/012:148`, `test/01:170`. Worker binary unchanged across E-1, E-11, E-11b by its SHA-256 (`03795324...f1dc`).

## 5. Alternatives considered

| Verdict | Why not |
|---|---|
| PASSED | One named client of E-8 is unmeasured, and the "0 product files" count is 1. Saying "passed" would hide both |
| NOT PASSED | Neither item is a defect with a correction to make in phase 1's own work: O-1 is a measurement that needs a free emulator, with a route and an owner; O-2 is a wording conflict between the gate and a row's cell. A gate "never blocks without a route" (section 9), and both have one |

## 6. For the controller

1. Record O-2 as a deviation in `decisions/decisions.md` (not written by this row).
2. Row 16 ("commit phase 1": 1 commit) cannot be met as written: the phase is already inside five commits. It needs the same kind of record as C32 gave row 18.
3. `masterplan/02_plan.md:270-277` (the WP-01 and WP-09 tick list) is not updated; line 270 (E-8) would carry "tablet not run". Not edited by this row.
4. Row 14's gap without a row stays unassigned: what the web console says in a browser without HEVC support (`test/014:163`). It matters on the Linux production host.
5. Left on disk by row 12: about 59 MB under `.cache/task4-row012/` with development keys, and `ffprobe-export.txt` at the repository root (untracked).

## 7. Assumptions and limits

- The records are taken as accurate where git cannot check them (run counts, media results).
- The attribution of paths to rows follows the rows' own records; a file changed in phase 1 that no record names would not have been seen. The two shared commits were not read line by line for this gate.
- All evidence is from macOS. Linux: row 141, rows 78 and 79, `9A/H-01`.

---
*Generated: 2026-10-13 10:45*
