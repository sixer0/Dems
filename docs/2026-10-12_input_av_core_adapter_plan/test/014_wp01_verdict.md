---
task_id: 2026-10-12_input_av_core_adapter_plan
task_slug: input_av_core_adapter_plan
row: 14
package: M1 / WP-01 (written verdict over E-1, E-2, E-8, E-10, E-11)
date: 2026-10-13
agent: test-expert
narrative_tier: 1
source_blueprint: identification/03_implementation_blueprint.md (row 14, line 140)
status: complete - two answers are conditional (row 34 on row 43's record; row 57 on the tablet measurement)
---

# Row 14 - WP-01: the written verdict

Docs only. Nothing was run, no source file was changed. Every figure below is taken from the record named beside it; nothing was re-measured. Paths are relative to this task folder unless they begin with `apps/`.

## 1. Verdict in one table

### 1.1 The five results

| Run | Outcome | Decided by |
|---|---|---|
| **E-1** | **pass - WORKER PART** (finding F-05). HEVC with parameter sets in the description: `ingest_connected` codec `hevc`, extradata 85, 8 fragments, 350 of 350 expected frames, 0 decode errors. Sample entry recorded: **`hev1`** | `test/01_hevc_experiment.md:18`, `:97-104` |
| **E-2** | **pass - "recorded file"**. Parameter sets in-band only: extradata 87 taken from the stream, 350 of 350 frames, 0 decode errors; `INGEST_NO_EXTRADATA` not logged | `test/01_hevc_experiment.md:20`, `:22`, `:122-147` |
| **E-8** | **named outcome: INCOMPLETE - 2 of 3 clients measured, no product client refused.** Reader half: **pass** (codec `HEVC`, sample entry `hev1`, no refusal, rate null). Playback half: seals and verifies (V-01 to V-15 PASS); **web console: plays**; **export: readable and decodes**; **tablet: NOT RUN** | `test/011_e8_reader.md:17-21`, `:63-71`; `test/012_e8_playback.md:19-27` |
| **E-10** | **pass - "one file with a gap, 0 decode errors"** on one connection (9 of 9), **with a named qualification**: a resume in the middle of a group is written as it comes and 30 of 30 pictures up to the next keyframe are wrong while the decoder is silent (12 of 12). A re-opened push: **`SECOND_CONNECTION_REFUSED`** (6 of 6), first file kept clean | `test/010_e10_resumed_push.md:21-22`, `:29-30`, `:35-36` |
| **E-11** | **named outcome: ACCEPTED** - the unchanged worker records a push to a wrong path: 18 of 21 accepted, 3 inconclusive (trailing slash), 0 refused. **E-11b: announced path READABLE** from the library's log-message text (18 of 18), by the reading C26 (row 7's own word: "PARTLY"); refusal at that instant 3 of 3 in the probe. Gate: **branch B, provisional** | `test/006_e11_listener_path.md` section 1; `test/007_e11b_announced_path.md` section 1; `gateway_check/008_rc1_branch_gate.md` section 1; `decisions/decisions.md` C26-C28 |

### 1.2 The three consequences

| # | Consequence | Answer | Evidence row that decides it | Row |
|---|---|---|---|---|
| 1a | WP-10a, reader: does the Core reader NEED to read the HEVC rate | **no** | `test/011_e8_reader.md:19`, `:70`, `:81-84` (accepted, named `HEVC`, no refusal, notice not due for an `HEVC_...P` code); `test/012_e8_playback.md:19-20` (seals and verifies without it) | **56: SKIP** |
| 1b | WP-10a, worker: has a client refused the sample entry `hev1` | **no, on today's evidence; not final** - one product client is unmeasured | `test/012_e8_playback.md:24` (web plays), `:26` (export decodes), `:25` (tablet NOT RUN), `:27` (QuickLook, not a product client) | **57: WAIT** for the tablet measurement |
| 2 | WP-11: did E-10 fail | **no** - conditional on row 43 | `test/010_e10_resumed_push.md:21`, `:24`, `:29-30`; `masterplan/04_design_addendum.md:345`, `:233` | **34: SKIP**, final when row 43's record shows the gate after a re-open (section 5.3) |
| 3 | The home of SA-2 is the worker (branch B: the relay stays, the worker compares the announced path) | **yes, provisional** until the container repeat (row 141) | `gateway_check/008_rc1_branch_gate.md` section 1; C26, C27, C28; `verification/05_security_branch_b.md` section 1 | built: 58, 175, 176, 179, 142 |

## 2. Frame (5W1H)

| Question | Answer |
|---|---|
| What | The verdict the plan asks of WP-01 (`masterplan/02_plan.md:273`, `:277`, completion check `:279`): one outcome per run, and what the outcomes mean for three conditional pieces of work |
| Why | Rows 34, 56 and 57 are conditional on this verdict (blueprint lines 551, 566, 567); row 59 (worker re-verification) waits for the run or skip record of rows 34 and 57 (line 185); gate M1 (row 15) reads this record. A wrong "yes" changes the verified worker or the sealing reader without need; a wrong "no" leaves a client that cannot play, or wrong pictures in evidence |
| Who | Written by test-expert. Evidence produced by coder-execution (E-1, E-2), test-expert (rows 6, 7, 10, 11, 12), verifier (row 8), security-review (`verification/05`), controller (C26-C28). Readers: the controller, the verifier of row 15, the executors of rows 43 and 59, the user for the items of section 7 |
| When | 2026-10-13. Runs: E-1 / E-2 on 2026-10-12 18:43-18:46 local; E-11 / E-11b 2026-10-12; E-10 2026-10-12 19:08-19:24 UTC; reader half and playback half 2026-10-13 |
| Where | This Mac only (macOS 27, arm64; FFmpeg 9.0.2, libavformat 63.1.102). No Linux, no container, no real camera in any of the runs |
| How | Reading. Each record read in full (01, 010, 011, 012) or in its result sections (006, 007, 008); the conditions of rows 34, 56, 57 read as written in the blueprint and compared with the design sentences that created them (`masterplan/01_specs.md:331-333`, `masterplan/04_design_addendum.md:229-235`, `:338-345`, `:440-487`). The working tree was looked at once, read-only, to see whether row 43 exists (section 5.3) |

Scope excluded: no judgement on branch B itself (that is gate row 8 and `verification/05`); no judgement on the relay client (U17); nothing about microphones.

## 3. E-1, against its three criteria (F-05)

The design gives E-1 three pass criteria (`masterplan/01_specs.md:331`). The experiment covered the first. The record therefore states "worker part" and names where the other two stand.

| Criterion | State | Evidence | What it is NOT |
|---|---|---|---|
| `ingest_connected` logs HEVC with extradata above 0; fragments are published | **met by E-1** | `test/01_hevc_experiment.md:18`, `:76`, `:97-104` | - |
| The Core reader reports `HEVC` | **met afterwards, on E-1's own file**, by the reader half of E-8 | `test/011_e8_reader.md:63` (file `hevc_a`, SHA-256 at `:53`) | not a seal: the product functions were called from a script (`:126`) |
| The session seals and verifies | **not met by E-1** (E-1 had no session: the worker was driven directly). Met in kind by ANOTHER HEVC session: a development session from the generated source, 1280x720, sealed, V-01 to V-15 PASS | `test/012_e8_playback.md:19-20` | not E-1's file, not 1080p, not `REAL_PRODUCTION`, development signing key. The first production-mode HEVC session on doubles is row 89 |

For lift condition L-4 (F-05, `verification/01_verification.md:214`): the "sealed and verified HEVC session" it needs from E-8 now exists, in development capture mode. Whether that mode satisfies L-4 is for the gate that reads L-4, not for this row.

## 4. Consequence 1 - WP-10a

### 4.1 Row 56, "[cond: the verdict says the reader needs it]" - answer NO, row SKIPPED

Reading of the condition: the reader "needs" the rate when, without it, an HEVC file is refused, misnamed, cannot be sealed or verified, or carries a notice it should not carry. This is driver decision 1 of row 11 (`test/011_e8_reader.md:138`); I confirm it, for these reasons.

| Fact | Evidence |
|---|---|
| The reader accepts the HEVC files, names them `HEVC`, raises no refusal | `test/011_e8_reader.md:62-71`, `:80-84` |
| The rate is null because the reader looks for the box `avcC` only | `apps/core-server/src/capture/fragments.ts:702-706`; `test/011_e8_reader.md:92` |
| A session with a null rate seals and verifies | `test/012_e8_playback.md:19-20`, `:22` |
| The design already rests on the null rate: an HEVC code is minted as `HEVC_1080P`, and the notice is then not due | `masterplan/04_design_addendum.md:467-469`; as run, `test/011_e8_reader.md:70` |
| The minted code and the sealed statement come from the same function, so they agree with or without a rate | `masterplan/04_design_addendum.md:468` |
| Reading the rate later makes every HEVC code minted before it raise the notice | `masterplan/04_design_addendum.md:476`; `test/011_e8_reader.md:102-103` |

The notice `STREAM_PROFILE_DIFFERS` in the playback half is not evidence for the reader change. It was raised because the generated development source's configured code is rewritten to `H264_720P30` at every development boot while the stream was HEVC: a codec difference, which the notice exists to report (`test/012_e8_playback.md:21`, `:132`). A production camera's code is minted from the stream (addendum section 7), so the case does not arise there. A rate would not have removed this notice.

What is lost by skipping: the manifest's profile code states no rate for HEVC (`HEVC_720P`), while it does for H.264; the manifest holds no other rate member (`test/012_e8_playback.md:22`, `:88`). The rate stays readable in the file itself (`test/011_e8_reader.md:94-98`).

Cost of running it, as an assessment and not a measurement: a second parameter-set parser, for the HEVC sequence parameter set, on camera-supplied bytes inside the sealing path.

**What would change this reading:** a ruling that the manifest must state the rate the stream declares (an evidence-specification wish, the second reading of `test/011_e8_reader.md:138`). Nothing still unmeasured bears on it - not the tablet, not a real camera. If such a ruling comes, the order rule governs: before the first production adoption of an HEVC camera, or every adopted HEVC camera is tested again (`masterplan/04_design_addendum.md:476`). No production host exists yet, so that window is still open; the connection tests the user now allows on the real cameras (U18) run against development databases on this Mac.

### 4.2 Row 57, "[cond: a client refuses the sample entry]" - answer NO today, row WAITS

Reading of "a client": the clients the design names for E-8 - the web console, the tablet and an export (`masterplan/01_specs.md:333`); the row's own cell says "the name the clients play" (blueprint line 183). Reading of "refuses": the client was given the file and did not play it.

| Client | Measured | Outcome | Evidence |
|---|---|---|---|
| Web console | yes, one browser: Chrome 154 headless, macOS arm64 | plays `hev1` (both tracks, `error null`, position advances, picture drawn) | `test/012_e8_playback.md:24`, `:96-104` |
| Export | yes | the receiver's verify command PASS; `ffprobe` and `ffmpeg` read and decode both files | `test/012_e8_playback.md:20`, `:26`, `:112-115` |
| Tablet | **no** | - | `test/012_e8_playback.md:25`, `:139` |
| QuickLook thumbnail tool (macOS) | yes, one run each | did not return for `hev1` (stopped after 4 min 44 s); made a thumbnail at once for a copy tagged `hvc1` | `test/012_e8_playback.md:27`, `:121-126` |

By the words of the row the condition is **not met**: of three named clients, two accept `hev1` and one is unmeasured. The QuickLook observation does not meet it, for four reasons: it is not a product client; it is one run; it is a tool that hung, not a player that refused; and QuickTime Player itself was not opened. It is nevertheless the one sign that players built on Apple's media framework want `hvc1`, which is hypothesis H-G of the design (`masterplan/01_specs.md:335`) and stays a hypothesis.

The condition is also **not shown to be unmet**, because the tablet was not run. So the row neither runs nor is skipped: **it waits for the tablet measurement.**

| If the tablet run shows | Then |
|---|---|
| the app's player plays the sealed `hev1` item | row 57 is skipped, with this record and that run as its skip record |
| the player takes its error path, or shows nothing | the condition is met: row 57 runs, then row 59 covers the changed worker |

Two more things would change the reading without the tablet: (a) a ruling that the exported file must open in a general Apple player, which makes the QuickLook observation a refusal by a client that counts - then the QuickTime Player measurement (not possible from an agent shell, `test/012_e8_playback.md:126`) is the next step; (b) Safari named as a supported operator browser - not measured at all.

For the executor, should row 57 run - a hypothesis, not a finding: `hvc1` promises that the parameter sets are in the sample entry. For a camera that sends them in-band only (the E-2 case), whether the pinned muxer writes a conforming `hvcC` under that name is not shown (`test/012_e8_playback.md:126`). The row would have to repeat E-2, not only E-1.

**For the controller, on row 59:** row 59 needs a run or skip record of row 57 (blueprint line 185). Waiting has two forms: hold row 59 until the tablet has run, or let row 59 proceed on "row 57 not run, condition not met as of row 14" and accept one repeat of the worker series if the tablet later refuses `hev1`. The tablet run is short once an emulator is free; the choice is the controller's.

## 5. Consequence 2 - WP-11 (row 34, "[cond: E-10 failed]")

### 5.1 Reading

E-10 has a stated pass criterion: "one file with a gap" (`masterplan/02_plan.md:279`), and a stated trigger: "If the worker, the muxer or the Core reader does not accept the jump, WP-11 is triggered" (`masterplan/04_design_addendum.md:345`). Row 10 named the ambiguity (`test/010_e10_resumed_push.md:143`); I read the condition by the design sentence, which is about ONE connection.

| What E-10 found | Does it make E-10 "failed" | Why |
|---|---|---|
| Pause and resume on one connection: one file with a gap; worker, muxer and Core reader accept it | no - this is the pass criterion | 9 of 9; reader `ok`, `CLEAN`, `MATCH` in 15 of 15 (`test/010_e10_resumed_push.md:21`, `:24`) |
| A resume in the middle of a group: 30 of 30 pictures wrong, decoder silent | no - but it is a real hazard | The design stated it before the run ("after a gap it would mux whatever comes first") and gave it to the relay's keyframe gate, not to WP-11 (`masterplan/04_design_addendum.md:340-342`). WP-11 as written (the ingest accepts a resumed push) would not remove it |
| A second connection to the same address: refused at TCP, first file kept clean | no | It is the case WP-11 would change, and the design accepts it without WP-11: an ended relay is a camera loss for the rest of the session, limit LA-1 (`masterplan/04_design_addendum.md:233`). The refusal is also the safer behaviour: a foreign client in the gap finds no listener, so the fault case RC-4 does not arise |

**E-10 did not fail. WP-11 is not triggered. Row 34 is skipped.**

### 5.2 What has been built since, and what it covers

| Case | Covered by | State |
|---|---|---|
| The camera leg drops while the relay lives | the relay keeps its push connection and opens the camera again; no second connection reaches the worker | row 43, **in flight** |
| The pictures after such a re-open | the relay forwards nothing until a keyframe, after every open | row 43, **in flight**; done for the first open and after a sequence gap (`implementation/041_relay_record_mode.md:80`, `:102`) |
| The worker itself is started again inside a session | a new address per attempt, a new worker process with a new listener, the cameras opened again | row 179, done (`implementation/179_per_attempt_secret.md` sections 1, 3; blueprint line 626) |
| The relay process ends | nothing: camera loss for the rest of the session | limit LA-1, stated |

### 5.3 The condition on row 43

`implementation/043_relay_reconnect_gating.md` does not exist at the time of writing; the row is claimed by agent W2 of batch 8 (`delegation_progress/file_claims.md:117`) and the relay source in the working tree carries uncommitted re-open code (`apps/capture-worker/src/relay/relay.c`, comment "the re-open (row 43 ...)"), with no record and no result. **The "no" of consequence 2 is therefore conditional on row 43 landing with its check passed.** If row 43 is blocked or fails, consequence 2 is reopened - and the question is then where the keyframe gate lives, which is not necessarily WP-11 as titled.

**A requirement this verdict hands to row 43.** Its verification cell reads "one file, 0 decode errors after the gap" (blueprint line 169). E-10 showed that this check cannot see the fault it is meant to catch: with a mid-group resume the installed decoder gives 0 messages at level error and warning and exit 0, also with `-xerror -err_detect explode`, while 30 of 30 pictures are wrong (`test/010_e10_resumed_push.md:22`, `:141`). Row 43's evidence must show the gate by a means that can fail: the first picture in the file after the gap is a keyframe, the relay's held-back count is above 0, and the pictures after the gap equal the source's (the per-picture MD5 of the row 10 fixture). A record of row 43 that offers only "0 decode errors" does not satisfy the condition of this section.

## 6. Consequence 3 - the home of SA-2

**Branch B: the relay stays, and the worker enforces the ingest secret by a positive match of the announced path. Provisional until row 141.**

| Step | Fact | Evidence |
|---|---|---|
| The unchanged listener | accepts a wrong-path push: 18 of 21 near-miss runs, 3 inconclusive, 0 refused; so branch A is excluded | `test/006_e11_listener_path.md` section 1; C28 |
| Can the worker see the announced path in time | not from the context, its options or metadata; yes from the log callback, level 56 `Parsing[<n>]: ANNOUNCE <uri> RTSP/1.0`, 18 of 18, before `ANNOUNCE` is answered; refusal by the interrupt callback 3 of 3 | `test/007_e11b_announced_path.md` section 1 |
| The reading | log text counts as readable only in a fail-closed construction: accept on a positive match, refuse on a missing, changed or second line | C26 |
| Security acceptance | ACCEPT B, conditional, 12 binding requirements BR-01 to BR-12; a mismatch-only build or any switch that disables the comparison would be a REJECT | `verification/05_security_branch_b.md` section 1; C27 |
| Gate | GATE PASSED, branch B; B follows from the rule table by the letter of AD-01 (5), and that log text may be the source rests on C26 plus the security acceptance | `gateway_check/008_rc1_branch_gate.md` section 1; C28 |
| Built | the gate (row 58), log hygiene and the two refusal codes (175), the per-camera end (176), the address per attempt (179), the permanent near-miss test (142) | `implementation/058_wp11b_path_compare.md`, `175_...`, `176_...`, `179_...`, `142_...`; blueprint lines 568, 623, 624, 626, 598 |

Provisional, and why: every observation is from this Mac's library build. Row 141 must show the same line - text, level 56, instant - on the Ubuntu 24.04 library in the container and pass the BR-09 cases there; if it does not, the selection is reopened and branch C applies (BR-10, `verification/05_security_branch_b.md:143`; C27). Also open on the Mac: the worker's whole series on the changed worker has not been run (row 59; `implementation/142_near_miss_regression_test.md:9`, `:87`), and the concurrency and leak cases are row 178.

Residual risks recorded with the acceptance, unchanged by this verdict: a process running as the Core's own user can read the secret; recording availability depends on the library's log wording and fails closed (C27).

## 7. Still unmeasured, and where it is measured

| Item | Why it is open | Where it is measured |
|---|---|---|
| **The tablet's player** on a sealed `hev1` session | both emulators held the user's pairing with lanes 1 and 2 (`test/012_e8_playback.md:139`) | the device session of row 12, at the next point an emulator is free (blueprint lines 534, 789, 1072). It decides row 57. An emulator's decoder is not a real tablet's: the real one is `9A/H-20` (`masterplan/02_plan.md:562`) |
| **A browser without HEVC support**: what the web console says when it cannot play | only Chrome on macOS was run, which decodes HEVC through the system; the player's error path exists but was not exercised (`test/012_e8_playback.md:131`) | `9A/H-20` asks "plays or states that it cannot" per client. I found no row that exercises the "cannot play" words on this Mac among the rows I opened (not an exhaustive search): a gap for the controller to assign. It matters more than the sample-entry name: the production host is Linux (U12 A2), where a browser's HEVC support is not given, and row 57 does not help there - the ruled fallback is cameras set to H.264 (U12 A4) |
| **The live monitor during an HEVC recording** | the listener was opened after the seal (`test/012_e8_playback.md:140`) | the tile and overlay facts are row 54 (unit level); a running session with an HEVC camera is row 89, then `9A/H-17` |
| **A real camera**: packetisation, long groups, B-frames, late or changing parameter sets, its clock, a real pause and resume | every source was FFmpeg / libx265 or a hand-written pusher on this host (`test/01_hevc_experiment.md:28-29`; `test/010_e10_resumed_push.md:142`, `:147`). Real cameras are now on this Mac (U15, U16), but the user allows search and connection test only (U18): **no real-camera recording, so no real-camera HEVC measurement yet** | `9A/H-09` (folded into `H-17`), `H-11` (reconnect), `H-20` (playback); earlier only if the user lifts U18 |
| **Linux** and the Ubuntu 24.04 library | all runs on macOS, libavformat 63.1.102 | row 141 (container: the E-11 observations and the announce line); rows 78, 79 (container build); the host's own build at `9A/H-01` |
| A mid-group resume with **HEVC**, and through the relay | E-10 used H.264 and a hand-written pusher (`test/010_e10_resumed_push.md:142`, `:147`) | row 43 (the request of section 5.3 applies to both codecs the relay gates), then `9A/H-11` |
| A sealed HEVC session **without the notice** | the generated source's configured code is always H.264 (`test/012_e8_playback.md:132`); the no-notice case rests on a function call (`test/011_e8_reader.md:70`) | row 50 (the minted code against the sealed statement) and row 89 |
| Sealing and playback of a file that holds a **pause** | the reader accepted it; nothing was sealed (`test/010_e10_resumed_push.md:144`) | row 90 (a dropped camera leg in a scripted session) |

## 8. Alternatives considered

| Question | Alternative | Why not taken |
|---|---|---|
| Row 56 | run it now, so that manifests state the rate for both codecs | the row's condition is "needs"; the reader needs nothing, and the design chose the rate-less HEVC code knowingly. It becomes right only by a ruling on the evidence specification |
| Row 57 | run it now, as a precaution for Apple players | changes the verified worker and the stored form of evidence on one observation of a tool that is not a client; `hvc1` with in-band-only parameter sets is unproven |
| Row 57 | skip it now | one named client is unmeasured; "no client refused" cannot be said of a client that was not asked |
| Row 34 | read the silent wrong pictures as "E-10 failed" and run WP-11 | WP-11 as specified makes the worker listen again; it does not gate on keyframes. It would change the verified ingest, open a listener again inside a session (RC-4) and leave the hazard where it is |
| Row 34 | wait for row 43 before saying anything | the reading of the condition does not depend on row 43; only its finality does. Stated as a condition instead |

## 9. Assumptions and limits

- The records are taken as accurate; no raw run output under `.cache/` was opened and no run was repeated.
- Row 12 has status `needs-review`; this verdict uses what it measured and treats what it did not run as unmeasured.
- "Product client" is read from `masterplan/01_specs.md:333`. If the user counts a receiver's general player as a client of the export, section 4.2 (a) applies.
- The statement that row 43 is in flight rests on the claims line and on uncommitted source seen on 2026-10-13; it may have landed since.
- `masterplan/02_plan.md` was not edited by this row (shared file). The lines this verdict would tick are `:270` to `:273` and `:277`, with `:270` (E-8) carrying "tablet not run".

---
*Generated: 2026-10-13*
