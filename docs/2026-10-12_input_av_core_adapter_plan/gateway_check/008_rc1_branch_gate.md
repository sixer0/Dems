---
task_id: 2026-10-12_input_av_core_adapter_plan
task_slug: input_av_core_adapter_plan
row: 8
gate: RC-1 (milestone M1; GATE CONDITION AD-01 (4))
date: 2026-10-12
agent: verifier
narrative_tier: 1
source_blueprint: identification/03_implementation_blueprint.md (row 8, section 9.1)
verdict: GATE PASSED - branch B, PROVISIONAL until row 141
status: complete
---

# Gate RC-1: the branch of design addendum 5.3, selected from the recorded observations

## 1. Verdict

**GATE PASSED. Branch B is selected (the relay stays; the worker compares the announced path with the plan's before it probes). The selection is PROVISIONAL until row 141 repeats it against the Ubuntu 24.04 library in the container.**

Three statements belong to the verdict and must be read with it:

1. **Which row of the table.** The recorded observations select row 3 of the table of blueprint 9.1 ("O-1 ACCEPTED in any run | O-2 any | E-11b READABLE -> B"). Branch A is excluded by two rows at once (rows 3/4: ACCEPTED in any run; row 5: INCONCLUSIVE runs are "not A").
2. **Table alone, or table plus C26.** The table as written does **not** select C without C26: by the definition the blueprint gives the E-11b cell (row 7's gate condition = AD-01 (5)) the cell reads READABLE, 12 of 12, and row 3 gives B. But the word in that cell was **not written by row 7**; row 7 reported "PARTLY", stated the letter as met, and left the word open because the source is library log-message text (`test/007:30`, `:231`, `:262`). The word was supplied by the controller's reading C26 and accepted by the security check (C27). So: **B follows from the table by the letter of AD-01 (5); that log text may be the source at all, and that it is safe, rests on C26 plus the security acceptance, not on the table alone.** Section 4 gives the reasoning; this gate adds no reading of its own.
3. **No source file was changed and nothing was run by this gate.** The evidence is the two test records, the decision log, the two security records and a read of `apps/capture-worker/src/ingest.c`.

## 2. Frame (5W1H)

| Question | Answer |
|---|---|
| What | The choice of the home of measure SA-2 (who makes sure a push to another path than the session's is never recorded): branch A (the library refuses), B (the worker compares), or C (the worker pulls, no listener) |
| Why | RC-1 is a security gate before any relay row (blueprint line 114, priority P0 at line 778). Branch C would replace rows 41 to 48 and 58; a wrong choice of A would leave a listener that records a foreign push |
| Who | Gate: verifier. Producers of the evidence: test-expert (rows 6, 7), controller (C26, C27), security-review (`verification/05`). Readers: controller; the executors of rows 47, 48, 58, 59, 141, 142; the security reviews of rows 86 and 137; the user (residual risks of C27) |
| When | 2026-10-12, after rows 6 and 7 (runs 16:14 to 16:37 UTC) and after the security check (23:47 WIB); before rows 41 to 48 and 58 |
| Where | `docs/2026-10-12_input_av_core_adapter_plan/`; `apps/capture-worker/src/ingest.c` read-only |
| How | Reading only. Each cell of the table matched to a recorded observation with its run count; the controller's reading compared with the wording of the table, of AD-01 and of addendum 5.2; six numbers of the test records recomputed from their own tables; five cited source lines opened |

Read in full: `test/006_e11_listener_path.md`, `test/007_e11b_announced_path.md` (with the probe source), blueprint section 9 and 9.1, rows 6 to 10, 41 to 48, 58, 59, 76, 80, 86, 125, 141, 142 and the lines 49, 113, 114, 632, 644, 694, 707, 731, `decisions/decisions.md` rows C26 and C27 (and U12 A3, B2), `verification/05_security_branch_b.md`, `verification/04_security_addendum.md` section 5 (F-1 to F-7, AD-01 (1) to (7), AD-14), `masterplan/04_design_addendum.md` lines 357 to 365.

**Not done, by the row's terms:** no run was repeated; the raw run output under `.cache/e11-listener-path/` and `.cache/e11b-probe/` was not opened. The gate rests on the two test records being accurate; what was checked is that each record agrees with itself (section 6).

## 3. The rule table, cell by cell

Table as written (blueprint 9.1, lines 619 to 625):

| # | O-1 (all near misses) | O-2 | E-11b | Branch |
|---|---|---|---|---|
| 1 | REFUSED in every run, each with its control | REFUSED | not run | A, provisional |
| 2 | REFUSED in every run | ACCEPTED | run | A with the second-connect rule |
| 3 | ACCEPTED in any run | any | READABLE | **B** |
| 4 | ACCEPTED in any run | any | NOT READABLE | C |
| 5 | INCONCLUSIVE or disagreeing runs | any | any | not A; repeated once; if still inconclusive, B when READABLE, else C |

Recorded observations:

| Cell | Recorded observation | Run counts | Source | Filled |
|---|---|---|---|---|
| O-1 | ACCEPTED for six of the seven near misses (last character, strict prefix, one more component, letter case, query string, percent-encoded), 3 of 3 each: statuses 200 200 200 200, one `ingest_connected`, 175 frames in the file. INCONCLUSIVE for the trailing slash, 3 of 3 (two `200`, connection closed at `SETUP` without a status, no `ingest_connected`, no file). REFUSED: 0 | 21 of 21 recorded: ACCEPTED 18, INCONCLUSIVE 3, REFUSED 0. Controls ACCEPTED 21 of 21 | `test/006:20-27`, `:39`, `:87-107` | Yes |
| O-2 | INCONCLUSIVE by AD-01 (3): the second client's TCP connection was refused, no request sent, no RTSP status; one `ingest_connected`; the first stream complete | 3 of 3; controls ACCEPTED 3 of 3 | `test/006:28`, `:40`, `:147-149` | Yes, with the label INCONCLUSIVE. The table has no O-2 value for it; in rows 3, 4 and 5 the O-2 column is "any", so the cell does not bear on the branch |
| E-11b, the letter of AD-01 (5) | For a push to a wrong path the probe printed a value equal to the wrong path as sent and different from the listener's address | 12 of 12 wrong-path runs (last character 3 observe + 3 refuse; six other near misses 1 each); 0 of 12 from `AVFormatContext.url`, options, metadata; `io_open` 0 calls in 18 | `test/007:20-28`, `:104-108`, `:133-140`, `:157-161`, `:227` | Yes by the letter |
| E-11b, the word for the table | "PARTLY": not from a field or function, yes from the text of log messages handed to the public callback; the word READABLE or NOT READABLE left to row 8 / the controller | - | `test/007:16`, `:30`, `:230-231`, `:262` | **Not by row 7.** Filled by the controller: C26 (READABLE only in a fail-closed positive-match construction), accepted conditionally by `verification/05` (C27) |
| E-11b, the facts C26 builds on | Level 56 `Parsing[<n>]: ANNOUNCE <uri> RTSP/1.0` seen in every run, right path and wrong; read inside `avformat_open_input`, before the answer to `ANNOUNCE`; with the interrupt callback the open ended with 0 packets; the right path still accepted | 18 of 18; refuse 3 of 3; right path accepted 3 of 3 | `test/007:25`, `:32`, `:157-162` | Yes |

**Selection by the table.** O-1 "ACCEPTED in any run" holds (18 runs): rows 3 and 4 apply, and the E-11b cell decides between them. With the cell READABLE the row is **3: branch B**. Rows 1 and 2 are not met (REFUSED in 0 runs).

**Row 5 applies beside it and gives the same branch.** The three trailing-slash runs and the three O-2 runs are INCONCLUSIVE, which is row 5's first column: "not A", and "B when E-11b is READABLE, else C". Row 5 also says "the runs are repeated once". That repeat was not run as a series (what exists: 4 supplementary raw-client runs, `test/006:132-135`, and 1 probe run, `test/007:138`, both showing the same close at `SETUP` or four `200` with a one-slash track address). **This does not move the branch**: no result of a repeat can remove the 18 recorded ACCEPTED runs, so "ACCEPTED in any run" stays true and A stays excluded whichever way the repeat falls; and rows 3 and 5 name the same branch for the same E-11b value. It is recorded as issue I-2 (section 9), not as a reason to hold the gate.

**Row 7's own condition** ("O-1 or O-2 ACCEPTED in any run", blueprint line 130) was met by O-1, so E-11b was rightly run.

## 4. Is C26 a reading of the rule, or a change of it

The texts compared:

| Text | Wording | Where |
|---|---|---|
| Table, row 3 | "ACCEPTED in any run / any / READABLE -> B" | blueprint 9.1 |
| Definition of READABLE that the blueprint attaches to the cell | "READABLE only if, for a push to a wrong path, the program prints a value equal to that wrong path and different from the address the listener was opened with; anything else is NOT READABLE" | blueprint row 7, Verification cell (= AD-01 (5), `verification/04:231`) |
| Which text governs | For the 5.3 decision rule the security check governs over the addendum: "READABLE not defined" is closed by rows 6, 7, 8 and section 9.1 | blueprint 11.3, line 731 |
| The addendum's question | "can the worker read the path a client announced, **through the public interface of libavformat 63.1.102**, before it probes the stream?" | `masterplan/04_design_addendum.md:357` |
| What branch B needs | "The value compared is the one the client announced, read before `ingest_connected` and before a byte reaches a file" | `verification/04:212` |
| C26 | Message text counts as READABLE **only** in a fail-closed construction: acceptance only after a positive match of the announce line with the session's expected secret path; a missing, changed or unparsable line refuses. Conditions: the boot refusal of another libavformat stays; a permanent test of near misses and of "line absent -> refused"; row 141 must show the same line, else C | `decisions/decisions.md:53` |

Findings, each with its evidence:

1. **The definitional test is met without C26.** AD-01 (5) asks for a printed value equal to the wrong path and different from the listener's address. That is recorded 12 of 12, for all seven near misses, and the value is not the listener's own address (`AVFormatContext.url` never changed), so it is not the false READABLE of F-5 that the definition was written against (`test/007:28`, `:227-228`). AD-01 (5) does not name a kind of source. By the letter the cell is READABLE and the table gives B.
2. **Would the table select C without C26? In this gate's judgment: no.** C would follow only if the addendum's phrase "through the public interface" were read as "through a declared field or a function that returns the value". Row 7 established that no such field or function exists (`test/007:230`) and that the means is a public function (`av_log_set_callback`, `libavutil/log.h:337`) whose message wording and level are declared in no header (`test/007:30`). Under that stricter reading of 5.2 the cell would be NOT READABLE and row 4 would give C. That reading is possible; it is not what the table and its attached definition say. It is recorded as the alternative (section 10).
3. **C26 changes no cell, no branch and no row of the table.** It settles the one point row 7 left open, and it settles it in the narrowing direction: by the letter alone B would be unconditional, and row 58's own check ("a wrong-path push never reaches `ingest_connected`", blueprint line 181) would be met by a build that refuses only on a seen mismatch, as the probe's `refuse` mode does (`test/007:319`, `:332`). C26 excludes that build: it requires the positive match, the line-absent test and the container repeat. Each condition can only turn a B into a refusal to record or into a C; none can turn a NOT READABLE into a READABLE.
4. **Where C26 and C27 go beyond the table, they are stricter.** The table makes only A provisional until row 141 (row 1; AD-01 (6) says "a selection of A is provisional"). C26 and C27 make B provisional as well and name the outcome of a mismatch in advance (C applies). Row 141's own gate condition ("the observations select the same branch as row 8, else the selection is reopened", blueprint line 264) is kept.
5. **The condition of branch B in `verification/04:212` is shown in the probe, not in the worker.** "Read before `ingest_connected` and before a byte reaches a file" holds for the probe (read inside `avformat_open_input`, 600 ms or more before the probe ends, `test/007:229`). Inside the worker (two ingest threads, one process-wide callback) it is not built and not shown (`test/007:168`, `:236`). That is BR-01, BR-03 and BR-09, not a matter of this gate.

**Conclusion of this section.** C26 is a reading of the rule, not a change of it. The selection of B is nevertheless not a product of the table alone: the table plus the letter of AD-01 (5) give B; the admission of diagnostic message text as the source, which row 7 declined to decide and which the addendum's wording leaves arguable, is the controller's (C26), and its safety is the security check's (C27, `verification/05`: ACCEPT B conditional, FAIL 0). Had the security check rejected the reading, C26 itself says C would have been selected. The gate condition "no judgment added" is kept: this gate applies the table to the recorded word and states whose word it is.

## 5. Residuals recorded with the selection

| # | Residual | Evidence | Carried by |
|---|---|---|---|
| R-1 | **O-2 inconclusive.** A second client on the right path was turned away one layer below RTSP (connection refused), 3 of 3; by AD-01 (3) that is not REFUSED. Not tested: a second client between the first one's TCP connect and its `ingest_connected` | `test/006:147-151` | SA-3 of row 48 unchanged (BR-08) |
| R-2 | **Trailing-slash case inconclusive.** Neither ACCEPTED nor REFUSED: the wrong path was answered `200` at `ANNOUNCE`; what ended the connection was the two-slash track address the FFmpeg client builds. With a one-slash track address all four requests got `200`. No run shows a trailing-slash push with media recorded, none shows it refused with a status. The repeat that row 5 of the table names was not run as a series | `test/006:99-101`, `:119-137`, `:170` | BR-02 (whole-message equality refuses it), BR-09 (trailing slash is one of the seven permanent near misses), row 141 |
| R-3 | **O-3: precondition never met.** No wrong-path push was turned away, so "the right path after a refused wrong-path push" could not be produced. What was seen instead: the listener takes one TCP connection, whatever its path, and does not listen again. After an ACCEPTED wrong-path push the right-path client got `Connection refused`, 3 of 3; after a single `OPTIONS` and a close the same, 3 of 3, and the camera ended `CAMERA_NOT_CONNECTED` | `test/006:29-30`, `:159-166` | accepted as the addendum records it (`verification/04:236`): a detected loss of one camera for one session, bounded by RC-5 (BR-12); BR-04 (3), BR-08 |
| R-4 | **One pusher implementation.** Every media push is the FFmpeg 9.0.2 command-line client; the raw client sends no media; `build/fake_cam` was not used. Not tested: a client that announces twice, announces nothing, writes the host differently, or addresses tracks otherwise | `test/006:174`, `test/007:171-172` | BR-02 (exactly one announce line), BR-09 (second `ANNOUNCE`, raw client with every method) |
| R-5 | **Mac build only.** Everything is this Mac's Homebrew libavformat 63.1.102. The text, level and instant of the announce line on the pinned library in the Ubuntu 24.04 container and on the production host are unproven | `test/006:180`, `test/007:173` | row 141 (BR-10), row 125 (`9A/H-01`) |
| R-6 | **The refusal seen is a closed connection, not an RTSP error status.** No public means to answer a 4xx was found. A push ended this way is INCONCLUSIVE by the letter of AD-01 (3); rows 48 and 142 word their check as "no `ingest_connected`, 0 bytes" | `test/007:32`, `:169` | rows 58, 142 |
| R-7 | **Probe, not worker.** The comparison inside the worker's ingest thread is not built | `test/007:168` | row 58 (BR-01 to BR-04), row 142 (BR-09), row 59 (BR-11) |
| R-8 | **A client that completes the handshake and sends nothing ends the whole worker** (exit 70, 12 of 12, right path as well as wrong). Independent of the branch; after B it needs the secret, which the relay holds | `test/007:189-198`; `ingest.c:524` | row 58 (BR-05) |
| R-9 | The residual risks the security check accepted with its verdict: a process of the Core's own user can read the secret; any local process RC-5 does not stop can deny one attempt its camera by connecting first; recording availability depends on one library's diagnostic wording (fails closed); the worker still parses the forwarded video bitstream | `verification/05:149-153`; C27 | recorded for the user by C27 |

## 6. Spot checks

### 6.1 Six numbers of the two test records against their own tables

| # | Stated | Recomputed from the record's own table | Agrees |
|---|---|---|---|
| 1 | O-1: "21 of 21 recorded; ACCEPTED 18, INCONCLUSIVE 3, REFUSED 0" (`test/006:27`) | the per-run table `test/006:87-107` has 21 rows: 7 near misses x 3; 18 rows end ACCEPTED, the 3 trailing-slash rows INCONCLUSIVE, 0 REFUSED; a control in each row | yes |
| 2 | "34 runs" (`test/006:33`, `:192`) and "30 series runs" (`:81`) | series `all` = 21 + 3 (O-2) + 3 (O-3) + 3 (O-3s) = 30 (`:54`); plus the 4 O-1s runs (`:56`, `:132-135`) = 34 | yes |
| 3 | E-11b: "12 of 12 wrong-path runs", "0 of 6 right-path runs", "18 of 18" (`test/007:24-25`) | wrong path: observe 3 (`:106-108`) + refuse 3 (`:159-161`) + six near misses 1 each (`:135-140`) = 12; right path: observe 3 (`:125-127`) + refuse 3 (`:162`) = 6; 12 + 6 = 18 | yes |
| 4 | Worker exit: "12 of 12 ... right path 6 of 6 ... wrong path 6 of 6"; "stays up 12 of 12"; "24 of 24" (`test/007:198`) | table `:189-196`: cases A and B, wrong and right, 3 runs each, all 70 = 12 (6 + 6); cases C and D, wrong and right, 3 runs each, all 0 = 12; 8 x 3 = 24 | yes |
| 5 | `Parsing[61]` for the `ANNOUNCE` line and `Parsing[60]` for the `OPTIONS` line (`test/007:83`, `:86`) | `ANNOUNCE rtsp://127.0.0.1:8563/e11b/Hs3kP9wQ2nVb7Xc2 RTSP/1.0` counts 9 + 43 + 9 = 61 characters; with `OPTIONS ` (8) it is 60. This is also what `verification/05:72` says of the bracketed number | yes |
| 6 | `log_messages=43` (wrong path) against `40` (right path) at the end of the open (`test/007:92`, `:119`) | the wrong-path open has `update_messages=1 differs_messages=2` more: 40 + 3 = 43 | yes |

No number of the two records disagreed with its own table. One loose wording outside the records: issue I-3.

### 6.2 `apps/capture-worker/src/ingest.c`, read-only

`git status --short apps/capture-worker` shows two untracked test fixtures and no modified file, so the lines below are the committed source.

| Line | Text as read | Claim | Confirmed |
|---|---|---|---|
| 91 | `static int interrupt_cb(void *o) { (void)o; return atomic_load(&g_stop_ingest); }` | "It returns the process-wide stop flag and ignores its argument" (`verification/05:78`) | yes; `:487` sets the callback and no argument for it |
| 524 | `if (r < 0) { fatal(src, "OUTPUT_SETUP_FAILED", r); atomic_store(&c->state, ING_ENDED); return NULL; }` | "a failed output setup is `fatal(...)`" (`test/007:218`; `verification/05:100`; C27) | yes |
| 512 | `if (!is->codecpar->extradata_size) { ingest_over(c, src, "INGEST_NO_EXTRADATA", AVERROR_INVALIDDATA); return NULL; }` | a stream without parameter sets is a fault of one camera | yes |
| 152, 153 | `if (level > AV_LOG_ERROR) return;` / `char msg[256];` | the callback writes level 16 and below only; 256-character buffer | yes |
| 490, 508, 515, 525 | `avformat_open_input` / `avformat_find_stream_info` / `open_output` / `ingest_connected` | the order BR-01 relies on: a gate after `:504` and before `:507` is before the probe, the file and the connect report | yes |
| 88-89, 138, 489, 491 | thread-local `tls_opening`, set before and cleared after the open, read in the callback | the attribution BR-03 builds on | yes |

## 7. Status until row 141, and what reopens the selection

**Status: PROVISIONAL.** Branch B may be built (rows 41 to 48, 58, 59, 142). The lift may not rest on it: entry condition L-2 of row 88 asks that "the selection is confirmed in the container (row 141, AD-01 (6))" (blueprint line 632), and the security review of row 86 depends on row 141 by build.

What reopens the selection:

| # | Event | Consequence | Source |
|---|---|---|---|
| 1 | Row 141: in the Ubuntu 24.04 container against the pinned library the announce line does not have the same text, level and instant, or BR-09 does not pass there | reopened; branch C applies (U12 A3), row 9 then runs | C26, C27, BR-10; blueprint line 264 |
| 2 | Row 141's observations select another branch than row 8 for any other reason (for example O-1 REFUSED in the container) | reopened | blueprint line 264 (AD-01 (6)) |
| 3 | A build of row 58 in which acceptance does not depend on the positive match, or any switch that turns the comparison off | the security acceptance turns into a REJECT; C | `verification/05:28` |
| 4 | No container runtime on this Mac | the selection stays provisional, AD-01 (6) moves to `9A/H-01`, and the lift then needs the user's word | blueprint line 787 |
| 5 | A move of the libavformat pin | BR-09 is run again first, by decision | BR-06 |
| 6 | The repeat on the production host's build (`9A/H-01`, row 125) disagrees | outside track D; a finding of the hardware package | `test/006:180` |

## 8. What the selection triggers in the blueprint

| Row | Condition | Effect of branch B |
|---|---|---|
| 9 | `[cond: branch C]` | **Skipped**, with this record as the evidence. It runs only if the selection is reopened to C; in that case it runs before any further relay row. AD-14 (branch C only) stays unused |
| 41 to 46 | none (drawn for A and B, assumption AS-3, blueprint line 49) | run as drawn; rows that depend on 8 by build (41, 47, 58, 142) are released by this gate |
| 47 | none | runs; builds the per-attempt, per-track random element; carries BR-07 |
| 48 | none | runs; SA-3 pairing and the second-connect rule; carries BR-08 |
| 58 | `[cond: branch B]` | **Runs.** The worker change (WP-11b) and the worker version step; carries BR-01 to BR-06 |
| 59 | `[cond: row 34, 57 or 58 ran]` | **Runs** (58 ran); the whole worker series and the kill matrix, once; carries BR-11 |
| 142 | `[cond: branch A or B]` | **Runs**; the permanent test; carries BR-09 |
| 141 | none | runs in M5; carries BR-10; closes or reopens this selection |
| 125 | none | carries the repeat on the host's build as `9A/H-01` |
| 76, 80 | none | carry RC-5 (blueprint 11.1, line 694): the loopback rule in the host profile and its boot check; BR-12 |
| 88, 92 | none | L-2 reads "rows 47, 48; 58 in branch B"; exit condition 5 allows `capture/boot/checks.ts` to differ by the worker version line in branch B (blueprint lines 632, 644) |
| 34 | `[cond: E-10 failed]` | not decided here (row 10) |

Table 9.1 names as the rows that build B: 47, 48, 58, 59, 142.

### Binding requirements of the security check, with their rows

| Id | Row | In one line | Source |
|---|---|---|---|
| BR-01 | 58 | Positive-match gate after `avformat_open_input` and before `avformat_find_stream_info`; unconditional in every build; the interrupt callback is never the only check | `verification/05:134` |
| BR-02 | 58 | Whole-message, constant-time equality with `Parsing[<n>]: ANNOUNCE <plan address> RTSP/1.0`; buffer of at least 2,048; exactly one `ANNOUNCE` line; any `Updating control URI` message refuses | `:135` |
| BR-03 | 58 | Attribution by thread-local owner and by context; per-camera result and per-camera refusal flag; the process-wide stop flag (`ingest.c:91`) is not used | `:136` |
| BR-04 | 58 | `av_log_set_level` not called; no path text in a log, frame or error at any level; two codes (differing line, no line) | `:137` |
| BR-05 | 58 | The handshake-then-close client ends one camera, not the worker (`ingest.c:524`) | `:138` |
| BR-06 | 58 | The three library pins stay; the worker version rises and the Core's check follows | `:139` |
| BR-07 | 47 | The secret: 128 bits; one per track and per attempt (today `supervisor.ts:794` re-sends the plan); one building function; never an argument, environment variable, log or row (`camera-helper-args.ts:135` changed or named as a development exception) | `:140` |
| BR-08 | 48 | SA-3 is not relaxed because the worker compares | `:141` |
| BR-09 | 142 | Permanent test: seven near misses, "line absent: refused", two cameras right and wrong in both assignments, a second `ANNOUNCE`, the oracle case, the case-A client on the right path, 0 occurrences of the secret | `:142` |
| BR-10 | 141 | Gate experiment in the container; until then B is provisional and the lift waits; row 125 keeps the host repeat | `:143` |
| BR-11 | 59 | Re-verification of the changed worker including BR-09 and the kill matrix, once | `:144` |
| BR-12 | RC-5 rows: 76 and 80 by blueprint 11.1 (line 694), with 125 for `9A/H-01`. The security check named "WP-14 and WP-20" without numbers; WP-14 holds 76, WP-20 holds 80 and 81 (blueprint line 80) | RC-5 stays mandatory in B; a production boot names a missing rule | `:145` |

## 9. Issues found

| Severity | Where | Issue | Route |
|---|---|---|---|
| Medium (I-1) | blueprint rows 47, 48, 58, 59, 141, 142 | Their Task and Verification cells still carry the text from before C27. Row 58's check, "a wrong-path push never reaches `ingest_connected`", is satisfied by a mismatch-only refusal, which `verification/05:28` names as a reason to REJECT. BR-01 to BR-12 bind by decision C27 only | controller: carry the BR text of each row into its delegation (or amend the cells); row 58's check must include "line absent: refused" |
| Low (I-2) | table 9.1, row 5 | "The runs are repeated once" was not run as a series for the INCONCLUSIVE trailing-slash and O-2 runs. The branch is not affected (section 3) | controller: log it; the trailing slash is repeated under the gate by BR-09 and in the container by row 141 |
| Low (I-3) | `decisions/decisions.md:53` (C26) | "the unchanged worker accepts a push to a wrong path (18 of 18)": the record says 18 ACCEPTED of 21 wrong-path pushes, 3 INCONCLUSIVE (`test/006:27`). 18 of 18 is true of the six near misses other than the trailing slash | controller: correct by a later log row if wanted; no effect on the selection |
| Low (I-4) | `masterplan/04_design_addendum.md:357` | "the public interface of libavformat": the callback that delivers the line is declared in `libavutil/log.h`, a library of the same FFmpeg build. Named so that a later reader does not look for it in `avformat.h` | none needed |

Failed gate items: 0.

## 10. Alternatives, assumptions, gaps

- **Alternative: branch C now.** It follows if "through the public interface" (addendum 5.2) is read as "a declared field or function". It removes the listener and with it the dependence on log wording; it puts the camera credential and the camera network's protocol parser into the process that writes the evidence files (`verification/05:109-119`), and it costs the refinement of row 9 and the 3 to 5 days of addendum 5.4. It remains the ruled fallback (U12 A3) and the named outcome of a row-141 mismatch. Not selected: the table with its attached definition gives B, and the security check rated B's residual the smaller.
- **Alternative: hold the gate until row 141.** Not taken: the table makes a selection provisional rather than withheld (row 1), and row 141 depends on rows 78 and 153 by build, which are far downstream.
- **Assumption:** the two test records are accurate. No run was repeated and the raw outputs were not opened.
- **Assumption:** the reading of blueprint 11.3 that AD-01 (5) is the definition of the E-11b cell. If a reader holds that the addendum's 5.2 wording still restricts the cell, finding 2 of section 4 changes to "C without C26", and the selection of B then rests wholly on C26 and C27.
- **Gap:** this decision was taken by the controller under U12 B2 (small matters decided and logged; stop only for a scope change, a security FAIL or a hard-to-reverse action). The security check has FAIL 0. Whether the admission of log text as an interface is a "small matter" is not this gate's to rule; C27 records the residual risks for the user, and the final report of track D should name C26 as a decision taken without the user.
- **Gap:** HB-1 to HB-4 of `verification/05:157-162` are hypotheses about libavformat's inside, settled only by BR-09.

## 11. Tracking

This gate wrote two files only (this record and `delegation_progress/row_008.md`). It did not edit `status_tasks.md`, `masterplan/02_plan.md`, the blueprint or `decisions/decisions.md`: those are the controller's shared files. For the controller to enter: row 8 done, gate RC-1 passed, branch B provisional; row 9 skipped with this record as evidence; rows 58, 59, 142 released as "condition met".

---
*Generated: 2026-10-12 23:58 WIB*
*Last Updated: 2026-10-12 23:58 WIB*
