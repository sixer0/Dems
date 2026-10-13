---
task_id: 2026-10-12_input_av_core_adapter_plan
task_slug: input_av_core_adapter_plan
row: 36
gate: M2 (plan phase 2: contracts, the process door; WP-13a) - GATE CONDITION AD-04
date: 2026-10-13
agent: verifier (batch 9, agent R13)
narrative_tier: 1
source_blueprint: identification/03_implementation_blueprint.md (row 36; section 9, line "M2")
baseline: cf2f8008
read_at: commit 0f5d2a8e, host clock 2026-10-13 10:45 (batch 9 is writing in the working tree; statements are about the commit unless they say "working tree")
verdict: PASSED WITH NAMED OPEN ITEMS - WP-13a CLOSED
status: complete
---

# Gate M2: contracts, the process door, WP-13a

## 1. Verdict

**PASSED WITH NAMED OPEN ITEMS. GATE CONDITION AD-04 is met: WP-13a is closed** (rows 29, 33, 149, 150, 166, 172 passed; count check 5 of 5, 31 of 31, 24 of 24, unaccounted 0).

Two of section 9's evidence lines hold only as amended by a recorded decision: "set A committed alone" (it is not: C32) and "fence files unchanged" (true for `boot.ts` and `operation.ts`; C48).

**What must be CLOSED before the class-C lift (row 88), not merely scheduled:**

| Item | Why it cannot wait | Evidence | Owner |
|---|---|---|---|
| **F-07** (`host?`, `programs?` fail open) | It is not a latent risk: **today no real start runs steps 4d and 4e at all.** The one mount of the boot checks hands in no host facts, so on a `REAL_PRODUCTION` start the loopback owner rule (BR-12, RC-5), the core-file limit (AD-09 (1)), the relay and guard path rule and the delivered-program checks are skipped silently. After the lift that Core records | `apps/core-server/src/capture/index.ts:324-332` (the mount: `timers`, `sinks`, no `host`); `apps/core-server/src/capture/boot/checks.ts:456`, `:468` (`deps.host !== undefined`, `deps.programs !== undefined`); row 81's own record ("the entry point does not hand in host facts"). The review's sentence "Production wires all three ... so nothing is open today" (`verification/035:39`) is right for `attempts` only | row 85 (agent R1, in flight; C46), judged by row 86 |
| **F-03** (one cell of the 21-state unit table cannot fail) | The cell "category 6 x REAL_PRODUCTION" takes its expectation from `OPENER_CAPABLE_KINDS`, and the lift is the change that moves that list. The cell must be pinned by hand **in the lift's own change set**, or the one state the lift changes is unguarded at gate 92 | `apps/core-server/src/capture/fence/__tests__/fence.test.ts:818`; `verification/035:35` | row 88 (with 85) |

Scheduled is enough for the others: F-01 and F-02 (reasons in section 8), F-04 (a test fix), F-08 (it disappears with the lift and can only be checked at gate 92). F-05 and F-06 are closed by the decision text C48 records. One note of the review should be read by row 86 before the lift: N-01 (section 8).

**Open items of the milestone, each with an owner:**

| # | Open item | Owner |
|---|---|---|
| M2-O1 | Row 17's remainder: the CHECK on the elements of `capture_devices.profiles` is not built (AD-06 (4)) | agent R6, batch 9 ("the profiles CHECK", with its data step); C29 (2) |
| M2-O2 | Row 23's guard source is untracked (`apps/capture-worker/src/guard/guard.c`), and the worker's `make` was not part of the last full run c05 | controller: committed with row 193's landing and its own `make` result |
| M2-O3 | F-07, F-03 before the lift (above); F-01, F-02, F-04, F-08 scheduled | section 8 |
| M2-O4 | Row 37 ("commit phase 2": 1 commit) cannot be met as written: phase 2 is inside five commits | controller: a record like C32 |
| M2-O5 | Row 18 has no record file (`implementation/018_commit_set_a.md` does not exist); it stands on C32 alone | controller |

## 2. Frame (5W1H)

| Question | Answer |
|---|---|
| What | Whether plan phase 2 and WP-13a (the nullable selector slot, end to end) are closed by their evidence, and what of the review's follow-ups the lift must wait for |
| Why | AD-04 is a security gate "before WP-13a closes" and entry condition 6 of the lift (blueprint 9.2) reads "AD-04: gate M2 has passed" |
| Who | Gate: verifier. Evidence: the rows' executors, the code review of row 35 (C48), the suite runner (c01 to c05), the controller's record (`delegation_progress/file_ownership.md`) |
| When | 2026-10-13 10:45, at commit 0f5d2a8e; batch 9 in flight |
| Where | `/Users/gsp-budi/Documents/DEMS`, branch `task4/input-av-core-port`; macOS only |
| How | Reading records and the tests they cite; read-only git against cf2f8008; text searches. **No test, typecheck or suite was run by this gate**: "passes" below means the record and the full run c05 say so and the test was opened where the table says "opened" |

Limits: the 613-file change set was not read line by line (the review did not either: `verification/035:25`). Tests were opened by title and, where stated, by body; a test whose body asserts less than its title would not have been seen in the title-only cases. The worker's `make` is outside c05.

## 3. Check 1 - every row of the milestone

40 rows carry the prefix `[M2`: done 36 (one with a remainder, one with a deviation, one with its source uncommitted), skipped by a recorded decision 2, this gate 1, open with a named owner 1. 36 + 2 + 1 + 1 = 40.

| Row | State | Commit or reason |
|---|---|---|
| 17 | done with a remainder (M2-O1) | b7ed4c60; record status `needs-review` for the CHECK only |
| 18 | done with a deviation | b7ed4c60 holds set A with the other rows of batch 3: C32; no record file (M2-O5) |
| 19 | done | 7969f0fa; remainder closed by pass I-1 |
| 20, 147 | done | 7969f0fa |
| 21 | done | 6e6707dd |
| 22 | done | 3b388746 (guard needed: yes) |
| 23 | done, source uncommitted (M2-O2) | record in 0f5d2a8e; `src/guard/` untracked |
| 24, 26 | done | b7ed4c60 |
| 25 | done on macOS | 0f5d2a8e: 0 survivors of 12 with the guard, relay 0 of 3; control without the guard 6 of 6 survive. Linux: `9A/H-02`, row 79 |
| 27 | done | 7969f0fa |
| 28, 164, 166, 180 | done | 6e6707dd |
| 29, 31, 32, 150, 162, 163, 165, 167 to 171 | done | 3b388746 |
| 30, 33, 149, 158, 172, 187 | done | 0f5d2a8e |
| 161 | done | b7ed4c60 |
| 34 | skipped by decision | C45; its condition on row 43 is now met (`implementation/043_relay_reconnect_gating.md:66-74`) |
| 173 | skipped by decision | C21 (9) |
| 35 | done | 0f5d2a8e: PASS WITH FOLLOW-UPS, 0 blocking; adopted by C48 |
| 36 | this gate | - |
| 37 | open (M2-O4) | git-specialist, after this gate |

Integration passes read: I-1 to I-7b (`file_ownership.md`, updates 23:30 to 10:16). Full runs: c01 to c04, and **c05, the last: every command exit 0** (typecheck 7 workspaces, lint, core-server 7629, shared 2795, core-web 2420, mobile 3219, test:db 2799 passed and 7 skipped, 0 databases left), without the worker's `make` (`test/c05_suite_run_batch_7_8.md:10-25`).

## 4. Check 2 - requirement identifiers of M2 rows, sampled

27 lines, 24 hold. "opened" = the test or source line was read for this gate; "title" = the test was found by its title and its body was not read.

| # | Identifier (row) | Evidence | Holds |
|---|---|---|---|
| 1 | AD-03 (1) closed reveal reasons (19) | `CS/src/core/audit-details.ts:182`; `CS/src/core/__tests__/writers.test.ts:473-476` (three accepted, any other refused) - opened | yes |
| 2 | AD-03 (6) bytes by one function, the mark in every print form (147) | `CS/src/capture/adapters/__tests__/credential.test.ts:141`, `:239` - title | yes |
| 3 | AD-03 (6) zero-fill after the write (21) | `CS/src/capture/adapters/production-door.ts:239`, `:288` (`startBytes?.fill(0)`) - opened; the door's static test not opened | yes |
| 4 | AD-04 (1) hosted action (162) | `SH/test/sim-capture-config.test.ts:934`, `:1065` - title | yes |
| 5 | AD-04 (1) the boot on six NULLs (29) | `CS/src/modules/capture-config/__tests__/capture-config.db.test.ts:828-845`: `it.each` over the three operations, steps `capture.config` and `engine.rehydrate` by name - opened | yes |
| 6 | AD-04 (2) row mapping (166) | `CS/src/db/mapping/__tests__/from-rows.test.ts:346` - title | yes |
| 7 | AD-04 (2) status readers (150) | `CS/src/modules/devices/__tests__/status.test.ts:445`, `:475`, `:553` - title | yes |
| 8 | AD-04 (2) the session machine (163) | `SH/src/sim/session-machine.ts:505-515`, `:840-845` - opened | yes, keyed on a proxy: F-01 |
| 9 | AD-04 (2), C18 (2) the positional function is gone (172) | search of the four source trees for `micInputOfChannel`: 0 lines (run for this gate); static block in `SH/test/audio.test.ts` with a planted control (`implementation/172:40-47`) | yes |
| 10 | AD-04 (3) `capture.config` by name, one boot row, 409 (33) | `CS/src/capture/fence/__tests__/fence.db.test.ts:744-809` - opened | yes |
| 11 | AD-04 (4) the reader inventory as a test (149) | `CS/src/modules/capture-config/__tests__/selector-reader-inventory.test.ts:150-232`: list equality with three planted controls - opened; counts in `implementation/149:53`, `:65`, `:85`, `:105` | yes |
| 12 | AD-10 (1) one audit row per cleared slot, none for an empty one (162) | `SH/test/sim-capture-config.test.ts:1025` - title | yes |
| 13 | AD-10 (2) refused while locked, 0 rows (29, 158) | `capture-config.db.test.ts:986`, `:1205` (every state that holds the lock, on PostgreSQL) - opened | yes |
| 14 | AD-10 (3) one slot in both members is 422 (28, 158) | `SH/test/sim-capture-config.test.ts:899`; `capture-config.db.test.ts:1286` - title | yes |
| 15 | AD-10 (4) S-5: a lone unassigned STANDBY (158) | `CS/src/modules/capture-config/__tests__/plan.test.ts:236`: 15 of 15 incomplete selectors `SELECTOR_SHAPE` - opened | yes, at the plan builder; at a booted Core the operator is answered 409 `PRECHECK_BLOCKED` (C43 (1)) |
| 16 | C18 (1) BLOCK item per unassigned slot (30, 163) | `CS/src/capture-notices/__tests__/precheck-unassigned.db.test.ts:118-171`: each slot, all four, the control, Simulated - title | yes |
| 17 | C18 (3) a row per slot with an assign offer, mobile (32) | `MOB/features/capture-selector/capture-selector.test.tsx:268-325`; `capture-selector-model.test.ts:97`, `:116` - title | yes |
| 18 | C18 (3) the same, web (31) | `WEB/features/devices/__tests__/selector-microphones.test.tsx`, the block of 11 cases named in `implementation/031:37` - not opened by line | yes, on the record and c05 |
| 19 | C21 (6) Simulated starts as today | `precheck-unassigned.db.test.ts:171`; `capture-config.db.test.ts:986`; `test/033` states 3, 6 | yes |
| 20 | C21 (9) row 173 skipped | the decision row | yes |
| 21 | C25 R-1 four required slots, the plan builder agrees | `SH/src/sim/capture-notices.ts:385`; `CS/src/modules/capture-config/plan.ts:120-126`; `plan.test.ts:236` - opened | yes |
| 22 | C25 R-2 the widening for an absent value (28) | `SH/src/api/core-api.ts:462-470` (`.max(2)`, nullable active input) - opened | yes |
| 23 | C36 (1) no default profile in the Core (187) | `CS/src/modules/capture-config/__tests__/static.test.ts:224-249` with a planted control - opened; search: one occurrence under `CS/src`, a comment (`routes.ts:52`); `capture-config.db.test.ts:1445` | yes; residual N-01 |
| 24 | C36 (2) the literal of the simulator's answers (149) | search of `SH/src/sim/api.ts` for `'MIC-01'`: 0 lines (run for this gate) | yes at the place C36 names; `SH/src/live/source/neutral-state.ts:49` still states it: F-02 |
| 25 | **AD-06 (4)** the CHECK on `capture_devices.profiles` (17) | not built: `implementation/017` status line; C29 (2); `file_ownership.md` update 09:45 | **no** (M2-O1) |
| 26 | **F-09, C9** set A committed alone (18) | b7ed4c60 holds 141 files; its migrations are 0015 and 0016 | **no, as written** (C32) |
| 27 | **AD-08** | carried by rows 89 and 157 only, both M6 and open: **no M2 row carries it**, so nothing of it is closed here. F-07 is where phase 2 touches it | **not closed; not due at M2** |

Of AD-03, points (2) to (5) belong to rows 144, 145, 146 (M3), not to this gate.

## 5. Checks 3 and 4 - the interim state and the named deferrals

| Check | Result | Evidence |
|---|---|---|
| The interim state "unassign accepted but nothing changes" is ended | **yes** | `implementation/029_selector_server.md:21-23`: operation 78 forwards `unassign`; measured at a booted Core on PostgreSQL: columns NULL, the answer without the line, one `CAPTURE_CONFIG_CHANGED` row. Tests: `capture-config.db.test.ts:875` (each of the four slots), `:946` (`REAL_PRODUCTION`) |
| `LANDED_UNROUTED` | **empty** | `CS/test/acceptance/contract.test.ts:178` (`= []`); emptied by row 70 (C31's condition) |
| `LANDED_UNANSWERED` | **empty** | `contract.test.ts:2044` (`= {}`), `:2202` (`expect(deferred).toEqual([])`); emptied by row 96 |

Stale wording around both lists remains (review note N-06). Row 100 introduced three named deferrals for row 102; they belong to M10, not to this gate.

## 6. Check 5 - the fence and boot files against cf2f8008

Command: `git diff cf2f8008 --stat -- apps/core-server/src/capture/fence apps/core-server/src/capture/boot` -> 15 files changed, 2993 insertions, 21 deletions. Sources (tests left out):

| File | +/- | Row | Commit | Reading |
|---|---|---|---|---|
| `fence/boot.ts` | **0** | - | - | unchanged |
| `fence/operation.ts` | **0** | - | - | unchanged |
| `fence/statements.ts`, `fake-profile.ts`, `registration.ts`, `generated-sources.ts`, `fake-mic.ts`, `development-discovery.ts` | 0 | - | - | unchanged |
| `fence/sources.ts` | +88 / -0 | 71 (M4) | 0f5d2a8e | additive: the source facts of a microphone slot; one new import of `adapters/audio/card-listing` |
| `fence/index.ts` | +9 / -0 | 71 | 0f5d2a8e | nine exports |
| `boot/checks.ts` | +57 / -1 | 177 (6e6707dd); 80, 81 (0f5d2a8e) | - | steps 4d and 4e, two refusal sets spread in; the one removed line is the worker version `0.5.0` -> `0.6.0`. No existing refusal changed. These are the three rows section 6 of the blueprint admits |
| `boot/index.ts` | +92 / -1 | 81 | 0f5d2a8e | the wiring of 4d and 4e, `storedCameraInterface`; the one removed line is the configuration destructure, widened by two keys. **Not in the review's table 4.5.** It is not one of the three restricted files, but it is one of the two SX-17 pins (row 205) |
| `boot/host-checks.ts` | new, 407 | 80 | 0f5d2a8e | - |
| `boot/program-checks.ts` | new, 269 | 81 | 0f5d2a8e | - |

Tests: `fence.test.ts` and `fence.db.test.ts` (row 33; pins by I-2, I-7; the clone clean-up of I-7b), `development-session.db.test.ts` (address pins of row 47 by pass I-3; schema pins), `support.ts` (nullable members), four boot test files (rows 80, 81; version pins by I-4).

So the gate line reads, as C48 asked: **`boot.ts` and `operation.ts` are unchanged against cf2f8008; `fence/sources.ts` and `fence/index.ts` were changed additively by row 71; `capture/boot/checks.ts` and `capture/boot/index.ts` were changed additively by rows 177, 80 and 81.**

## 7. Check 6 - the schema sets in git

| Set | Commit | Migrations in it | Alone |
|---|---|---|---|
| A (version 7, dbc-8) | b7ed4c60 | 0015, 0016 | **no**: 141 files, with the other rows of batch 3. Deviation C32; its own undo statements were proven by row 17 |
| B (version 8, dbc-9) | b60a9fa3 | 0017, 0018 | **yes**: 73 files of rows 99, 192, 100. Recorded exceptions: three test files with set-B pins and other rows' hunks went into 0f5d2a8e; one line of the task-3 contract document is in b60a9fa3 (`file_ownership.md` update 10:37) |

No other commit of the branch holds a migration file.

## 8. Check 7 - the follow-ups F-01 to F-08

| ID | Home (C48) | Before the lift? | Reason |
|---|---|---|---|
| F-01 | a row beside 163 | **scheduled is enough, with a tripwire** | The proxy is true on every real Core today, and what keeps a recording from starting with a slot empty does not use it: the plan builder refuses on the Core's own capture mode (`plan.ts:120-126`, called inside the unit that would persist RECORDING). The lift does not touch the time or platform facts. A loss of the proxy would turn `fence.db.test.ts` states 1 and 2 red (four BLOCK items expected). It must be closed **before any row gives a real Core a time service or a platform report** |
| F-02 | with F-01's row | scheduled | Display only, on a client that lost its feed. It becomes visible with production microphones (`MIC-11`...), so before the hardware acceptance, not before row 88 |
| F-03 | rows 85 / 88 | **yes: inside the lift's change set** | section 1 |
| F-04 | the schema-set writer | scheduled | A test that swallows any error; no product path. Agent R6 is writing the next schema steps now: the cheapest moment |
| F-05 | closed by C48 (SR-5) | - | decision recorded |
| F-06 | closed by C48 | - | decision recorded; diff reviewed clean |
| F-07 | row 85 (C46) | **yes: closed, with the test C46 names** | section 1. To reconcile in the same row: row 157's cell says the two mounts "keep today's argument members", while C46 adds `host` to the boot-check mount |
| F-08 | rows 85 / 88 | cannot close before; checked at gate 92 | It exists only because no adapter serves a production device, which is the rule the lift removes |

**N-01, for row 86.** The refusal of row 187 applies only when a registry is provided (`CS/src/modules/capture-config/routes.ts:288`). A SIMULATED Core that holds an `ONVIF_RTSP` row stores the simulator's default profile for it, and a later real boot reads that row. Before the lift nothing could record from it; after the lift it is a default standing in for the stream's statement, which C36 (1) forbids. Reachable only by running one database in two modes; row 86 should rule whether that is acceptable or the stored profile is checked against the device's own at the open.

## 9. Alternatives considered

| Verdict | Why not |
|---|---|
| PASSED | Two evidence lines hold only by a recorded deviation, one requirement of row 17 is unbuilt, and one follow-up is a production check that does not run. A plain pass would carry these into the lift unseen |
| NOT PASSED | The gate condition itself (AD-04) is met on every row it names, the review has 0 blocking findings, the last full run is green, and each open item has an owner and a row in flight or named. None is a defect of WP-13a |

## 10. For the controller

1. Entry condition 6 of the lift ("AD-04: gate M2 has passed") is met by this gate. F-07 and F-03 are conditions of rows 85 and 88, to be read by row 86 and gate 92.
2. The review's line on F-07 should be corrected in the record (it is not wired today).
3. M2-O4 and M2-O5 need decision rows; not written by this gate.
4. Not checked by this gate: the worker's `make` after row 23 (last recorded rc 0 at 10:04, agent W2), and anything on Linux.

---
*Generated: 2026-10-13 10:45*
