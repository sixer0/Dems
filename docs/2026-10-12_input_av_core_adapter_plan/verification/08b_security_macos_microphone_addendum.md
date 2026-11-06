---
task_id: 2026-10-12_input_av_core_adapter_plan
task_slug: input_av_core_adapter_plan
row: M2b (track D; row N0 of the design's section 10)
date: 2026-10-13
agent: security-review
type: addendum to the security review of a design (no code exists yet)
narrative_tier: 1
addendum_to: verification/08_security_macos_microphone.md (row M2, verdict CAUTION, provisional)
reviewed: masterplan/06_design_macos_microphone.md, revision 2 (row M1b); delegation_progress/row_m1b.md
measurements_read: test/mm_macos_microphone_measurement.md, test/mm2_macos_microphone_48k.md, test/mm3_macos_microphone_loss.md
decisions_read: U21, U22, U23, U24, U25, C88, C96, C97, C104, C106, C107 (decisions/decisions.md:123-147)
overall: CAUTION
fail_count: 0
caution_count: 31
pass_count: 9
verdict_final: yes for the design of revision 2; two sentences of SR-15 stay provisional until one run on a generated source (section 8); three named events bring the design back to review (section 1)
sr_15: CONFIRMED as restated by revision 2, TIGHTENED in five points (section 8)
devices_opened: none
source_changed: none
status: complete
---

# Addendum: security review of revision 2 of the macOS production microphone path

Abbreviations: "the review" = `verification/08_security_macos_microphone.md`; "the design" = `masterplan/06_design_macos_microphone.md` revision 2; `MM`, `MM2`, `MM3` = the three measurement records, cited by section; `WK` = `apps/capture-worker/src`; `CS` = `apps/core-server/src`. A statement marked HYPOTHESIS is this reviewer's reading or knowledge and was not run.

## 1. Verdict

**CAUTION. FAIL: 0. FINAL for the design of revision 2.** Nothing in this scope stops for the user. The device questions that made the first verdict provisional are measured. The design is accepted as the base of the build under 40 requirements (SM-01 to SM-40: 9 PASS, 31 CAUTION, 0 FAIL), of which 8 are gates.

Why CAUTION and not PASS: the path provably loses about one sample in ten (MM3 s0), the user accepts that (U25), and what is left to judge is whether the record of the loss is honest. As designed it is honest in its TOTAL and not yet honest in four places, each closed by a requirement that fits a row the design already has:

1. **A package of this path could be sealed with no shortfall statement at all** (the member is built from audit rows only; a Core that ends before the row is written leaves none, and "absent" then reads like a Linux package). Gate SM-36.
2. **The account as designed leaves zeros outside it** (it counts "since this microphone's first sample"; the worker inserts silence before that, and discards received samples in three places without telling). Gate SM-29.
3. **The design says the silences stand "near" the missing sound. The code does not support that** (section 4.1). The sentence must not reach a document, a notice or the evidence. SM-30.
4. **Inserted silence of any length cannot be told from recorded silence in the package**: the design states counts only. Runs of 100 ms or more must carry their position under the signature. Gate SM-30.

Why no FAIL: no code exists; each of the four is a change of words in a contract row that is not yet cut; none needs a ruling of the user; where the tool cannot give certainty the requirement is a statement in the signed record or a refusal, never a silent acceptance.

**What stays provisional:** two sentences of SR-15 - the pre-check list and the single-output push list - were never run in their exact form (design 4.2, "not measured"). They are confirmed when the build row has run them once on a generated source, no device (section 8).

**What brings the design back to this review** (each is a stop of the row, not a row's decision):
- a form of the helper row fails on the generated source so that a word of SR-15 must change;
- the worker row cannot make the account exact on the stand-in pattern (SM-29 (5)), or the resampler cannot be shown transparent and cannot be bypassed (SM-31);
- the user takes the option of section 11 (an own reader): SR-15, SM-03, SM-04 and SM-35 are then rewritten.

| # | Point of the delegation | Rating | The ruling in one line |
|---|---|---|---|
| 1 | Requirements "that cannot be met as written" | CAUTION | all five restated in a form that can be met; none stays open (section 3) |
| 2 | The shortfall as evidence | CAUTION (2 gates) | honest in the total; positions required for runs of 100 ms or more; the account must cover the whole timeline; a transcript carries the statement; the 12.0% bound stays as a floor and gains a comparison with the session's own level (section 4) |
| 3 | The worker change | CAUTION (gate) | the whole BR-11 series and the kill matrix again; media bytes and records of `PCM_FIFO` unchanged, proven by a baseline taken BEFORE the first edit (section 5) |
| 4 | One process, two microphones | CAUTION | the role keeps its contract name; the operator never reads the bare word "standby" for it; the signed record states the shared capture process (section 6) |
| 5 | The dropping FIFO | CAUTION | every drop is inside the worker's count - never silent in the total; the amount per microphone and its place come from the worker's numbers, not from the helper's two lines (section 7) |
| 6 | SR-15 for the exact row | CAUTION | confirmed, tightened: the push list and the pre-check list are compared as whole TEMPLATES (section 8) |
| 7 | Unreliable opens | CAUTION | bounded and reported; its gap is stated at a restart; at a session START it is stated only once SM-29 holds (section 9) |
| 8 | The bench-form marking | CAUTION (gate) | yes: the product refuses to describe such a session as anything else - the seal, the export and both verdict lines (section 10) |
| 9 | The user's untaken option | view only | section 11 |

## 2. Rank-1 list: green before the build

| Rank | What | Who | Gate for |
|---|---|---|---|
| 1 | This addendum adopted; SR-15 in the words of section 8 confirmed | controller | every build row |
| 2 | **The design amended in place (revision 2.1) with the contract words of SM-29, SM-30, SM-34 (3) and SM-36**: the account from sample 0 with its discard count and its closed mark; the track total, the longest run and the list of runs of 100 ms or more; the capture group; the rule that the seal anchors on the source-fact key. N1 and N2 are contract rows: cut before this, they are cut twice | designer, then controller | N1, N2 (and through them N3, N11, N12) |
| 3 | **The worker's baseline taken BEFORE its first edit** (SM-33 (2)): the hashes of the three binaries, the BR-11 series result and the kill matrix result on the unchanged source, and the reference outputs of the comparison run | controller cuts; the worker row's first step | N3 |
| 4 | **The four forms of the helper row that no measurement ran** are run on a generated source (no device) before the static pins of N4 close: the pre-check to standard output; one queued output alone; a reader absent at the start; a reader that closes its pipe | N4 (it needs the real helper, not a device) | the close of N4; N9 |
| 5 | **Two rows the design does not have are cut**: the verdict lines and the export statement (SM-37), and the statement in a transcript (SM-38). The design's 16 rows end at a session that seals; a reader meets the package through the verifier and the transcript | controller, task-architect | N15 and the first real session |
| 6 | **The user is told, in so many words**: (a) a recording made on this Mac says in its signed record that about a tenth of the sound is missing and that silence was put in its place; (b) the "standby" microphone on this Mac ends with the primary's capture program; (c) the application that hosts the agents holds a standing microphone grant since row MM (MM s6) - the recommendation to switch it off again after row N15 stands (review SM-15 (3)) | controller | not a gate of a build row |

Gates after the addendum (8): SM-02, SM-04, SM-14, SM-16 (kept); SM-29, SM-30, SM-33, SM-36 (new). SM-26 (the measurement row) is CLOSED: met by rows MM, MM2, MM3.

**What would turn a CAUTION into a FAIL** (each a stop for the user):
- a build that seals a session of this path without the member, or shows it with a verdict line that does not name the shortfall (SM-36, SM-37);
- a build in which anything but the counted zero-fill pads, stretches or re-times audio of this path - in the helper's row or in the worker (SR-15, SM-31);
- a change of any expected value of the worker's existing checks in order to make the Linux path pass (SM-33).

## 0. Frame (5W1H), method, limits

| | |
|---|---|
| **What** | Rulings on nine points of the delegation against revision 2 of the design; the requirements SM-01 to SM-28 re-rated, twelve added (SM-29 to SM-40); SR-15 in final words; the order of the work packages |
| **Why** | Decision C96: no build row before the measurement and this addendum. Decision U25 (3): the path is built as it is, and the evidence must not claim audio it does not hold |
| **Who** | Reviewer: security-review. Next reader: the controller, the task-architect, the designer. Decision owner: the user |
| **When** | 2026-10-13, written by 18:42 host time (`date`; the start was not taken); working tree of branch `task4/input-av-core-port`, uncommitted |
| **Where** | This task folder; `WK/audio.c`, `WK/capture_worker.c`, `CS/capture-session/index.ts` read-only |
| **How** | Reading. No device opened, no listing through the capture program, no command that asks the system for microphone or camera access. Commands: reads, searches and `date` |

**Read in full:** the review; the three measurement records; the design revision 2 (816 lines); `delegation_progress/row_m1b.md`; the decision rows named in the header; `WK/audio.c:20-45`, `:80-100`, `:150-300`, `:345-670`. **In part:** `WK/capture_worker.c:160-182`; `CS/capture-session/index.ts:180-190`, `:1660-1715`, `:2068-2090` and the call sites `:2217`, `:2228`; `packages/shared/src/evidence-package/manifest.ts` (search hits for the optional members); `apps/capture-worker/test/static/` (file names and five lines). **NOT read:** `WK/micwatch.c` beyond its function names, `WK/ingest.c`, `sink.c`, `ipc.c`; the supervisor and the forwarder; the sealing pipeline; `apps/transcriber/src` (a search only: no file there names an optional manifest member); the web console. Nothing is claimed about them beyond what is cited.

**Hypotheses of this addendum**

| Id | Hypothesis | Settled by |
|---|---|---|
| HB-1 | The worker's resampler, switched on by a compensation of nothing (`WK/audio.c:358`), may not hand samples on value for value: a resampler of this kind filters. The source's own comment says "passed through sample for sample" (`:465-466`); no row cited shows it | N3: a marker signal through the gapped kind, largest difference against the input (SM-31) |
| HB-2 | On a pipe at about 90% the worker's zero runs fall at the END of whatever is buffered, that is between two packets that ARRIVED one after the other, about every sixth quantum, in runs of roughly 300 to 450 samples; they bear no relation to the places of the lost packets, because a lost packet changes nothing in the arrival times the worker sees (MM3 s1: one packet per read whether or not one was skipped). Read from `WK/audio.c:436-449`, `:599` and MM3's read interval; not run | N3: the marker stand-in (design 7.2 already orders it) |
| HB-3 | The helper's `fifo` output has further options than the four of the row (recovery, time shift, restart); named from the reviewer's knowledge of the program family, not from the pinned build | N4: `-h muxer=fifo` of the pinned program (prints help, opens nothing), the whole list pinned |
| HB-4 | The program accepts an option whose value is read from a FILE (a leading slash after the dash), and several spellings of a filter option | not needed: the template rule of section 8 holds either way |
| HB-5 | The watch's listing through the capture program every 5,000 ms, made while the helper holds the device, may add to the loss: every 60 s run of MM3 was made with no listing during the capture (MM3 s2), and MM2 could not separate its own listing from the refused opens (MM2 s3) | N15: the shortfall with the watch running |

## 3. Point 1 - the requirements "that cannot be met as written", restated

| Requirement | Was | Restated (what the build must do) | What it still guards | Rating |
|---|---|---|---|---|
| **SM-04 (2)** | the stream line read by one pattern "for two integers" | The stream line of the design's 4.6 rows 1 to 4, as designed: anchored after `Input #0, avfoundation, from 'none:<n>':` with the `<n>` of the argument and before any `Output #` line; the rate one integer that must be exactly 48,000; the layout WORD through a closed table that holds MEASURED entries only (`5.1` = 6 today); the count so obtained must equal the system list's count of the launch's listing; a word outside the table refuses. Added: (a) the table is a constant of ONE file, and a row that adds a word cites the measurement that showed it; (b) no option that renames the word may stand in the list (held by the template of section 8); (c) samples that reached the worker from a launch that then FAILED one of its checks are an interval of the session's record (review SM-18 (4)): the worker is started before the helpers (`CS/capture-session/index.ts:2217`, `:2228`), so up to the settle time of audio from a device that did not pass is already in the track | that the opened device is the registered one (the built-in input has 1 channel and cannot state `5.1`), and that the rate is the device's own | CAUTION, gate kept |
| **SM-19 (4)** | "prove two helpers on one device; if refused, the fallback comes back to this review" | Settled: refused 3 of 3 (MM s5). The fallback IS the row and is reviewed here (sections 6 to 8). The rest of SM-19 stands and is widened by SM-34 | that nobody takes the standby for an independent microphone | CAUTION |
| **SM-16 (5)**, **SM-20 (2)** | "built, not fit to record" until the delivered rate is right | The gate on the RATE cannot pass and is withdrawn (U25 (2)). In its place, two things that can be met: (a) THE ACCOUNT IS RIGHT - on the stand-in whose pattern is known, the numbers the product signs equal the known numbers (SM-29 (5)); on the device the signed shortfall lies inside the measured range (design N15); (b) the product NEVER declares this path fit to record, in any text, and every package of it says what it is (SM-36, SM-37). SM-16 (1) to (4) are met by the design's 4.6 and stay | that a reader is not told more than the path delivers | CAUTION, gate kept (SM-16) |
| **SR-15 (3)** | formats `avfoundation`, `f32le`, `null` | `avfoundation`, `fifo`, `f32le`; `fifo` only inside a push section with its four fixed option groups; `null` leaves (section 8) | that no format word opens a new way to write or read | CAUTION |
| **SM-06**, last sentence | a helper whose PROGRESS stops for 5,000 ms is stopped | The helper's progress is no measure of delivery (MM3 s8.3). The stall is read from the worker's `receivedSamples`: (a) NO microphone of a helper's group advances for 5,000 ms after its first sample: the session closes the handles of that group, which stops the helper (`AUDIO_HELPER_EXITED`, detail `STALLED`), and the interval is in the session's record; (b) ONE microphone does not advance while the other does: a fault of that microphone only, the helper stays. The design's W17 ("stated, not stopped") is not accepted for case (a): a helper that lives and delivers nothing holds the device and keeps the session from its own re-open | that a dead capture is ended and stated, not left "open" | CAUTION |
| **U25 (3)**, the source facts | "the source facts state by how much it fell short" | Confirmed as the designer puts it (now SM-40): the source facts are written once at the start and state THAT the path is not sample-continuous; HOW MUCH is in the audit row and the signed member. This is the better form: the key written at the start is what the seal anchors on (SM-36) | - | PASS |

Also confirmed for the controller (row M1b, points 3 to 6): the production door's observer of standard error is accepted under SM-12 as widened (section 12); the word `hostForm: BENCH_DARWIN` need not be added (section 10); the disagreement of two measurements on the property-list form is settled in N6 before its words are pinned (SM-02, gate kept); a small strict property-list reader of our own needs nobody's word, a ready-made parser is a new dependency and needs the user's.

## 4. Point 2 - THE SHORTFALL AS EVIDENCE

### 4.1 What the worker does, read in the code (the design read it "not run"; so did this review)

| # | Read | Source | Consequence |
|---|---|---|---|
| 1 | The timeline is the host's clock; a quantum of 480 samples is due every 10 ms, 40 ms after its capture | `WK/audio.c:88`, `:599` | the design's WF2 holds |
| 2 | A quantum takes what the buffer holds; the REST of the quantum is zero; the zeros are added to `missing` | `:436-449` | WF3 holds. The zeros stand at the tail of what was buffered (HB-2) |
| 3 | A controller asks the resampler for up to 5,000 parts per million | `:93`, `:464-477`, `:480` | WF4 holds |
| 4 | `received`, `missing`, `dropped` leave the worker in one log line at the end, and `missing` in a test manifest | `:646`, `:653` | WF5 holds |
| 5 | **The resampler is in the path of every sample**, switched on at the open by a compensation of nothing | `:356-358`, `:399` | not named by the design: "the controller asks for nothing" does not remove it (HB-1; SM-31) |
| 6 | **Received samples are discarded in three places, two of them uncounted**: when the buffer is full (counted in `dropped`, told only in the end line); when a microphone that stopped is placed anew (`fifo_drop_oldest`, NOT counted); when a second microphone began before T0 (NOT counted) | `:396`, `:428-431`, `:582` | `received` is not "what is in the track". The design's "the three numbers add up" (9.2) is not true as designed (SM-29) |
| 7 | **A sample that is not a finite number is replaced by zero**, uncounted | `:393` | a zero the product made that is in no count (SM-29) |
| 8 | **Zeros stand before a microphone's first sample**: a second microphone owes its lead in silence; and when no microphone delivers for 3,000 ms the timeline starts on silence | `:91`, `:439`, `:570`, `:576`, `:579-583` | the design counts `timelineSamples` "since this microphone's first sample" (8.2): these zeros are in the track and outside the account. On this path the launch with its pause and one retry can pass 3,000 ms (design 4.7: up to about 6.9 s) (SM-29) |
| 9 | A microphone with nothing for 200 ms is "stopped" and placed anew when it returns | `:92`, `:423-434` | a re-timing of that microphone's samples; it must be in the account as a discard and as a run (SM-29, SM-30) |

So the sub-question "does any stretch, pad or re-time other than the counted zero-fill remain once the 5,000 ppm stretch is removed" is answered: **NOT CONFIRMED as designed.** Removed by the design: the controller's request. Remaining, each closed by a requirement: the resampler itself (5), three discards (6), the non-finite replacement (7), zeros outside the account (8), the re-placement (9).

**On "near".** The design's 7.2 says the silences "mark that samples are missing near that place" and 8.5 says they are "near the holes, not at them". By HB-2 the worker's zero runs are governed by the beat of its 10 ms quantum against the helper's 11.9 ms read, and a lost packet leaves no trace in the arrival times. The honest sentence is: the TOTAL of the inserted silence equals the total of what did not arrive; its PLACES are the product's and say nothing about where sound is missing; and the inserted silence cuts sound that did arrive in one piece. The build measures the pattern (the marker stand-in of design 7.2) and the documents state what it found.

### 4.2 Rulings

**(a) Is the designed record honest?** In its total, yes, once SM-29 holds: two integers per microphone and attempt under the signature, no percentage, nothing rounded, zero when the path is whole. In four respects not yet: the account's coverage (SM-29), positions (SM-30), the anchor of presence (SM-36), and the word "near". Rating CAUTION.

**(b) Must inserted silence be distinguishable from recorded silence IN THE PACKAGE? Yes - by position for runs of 100 ms or more, by statement below that.** The stored form is AAC: an exact zero does not survive it, so nothing in the sound itself tells inserted silence from a quiet room. In ordinary running the runs are a few milliseconds and stand all over the track; listing them is neither possible in a manifest (HB-2: of the order of ten a second) nor needed - nobody takes 8 ms for a pause in speech, and the statement says they are everywhere. A LONG run is another matter: a stalled reader drops seconds (MM3 s8.2: 2.65 s for a 3 s stall), a helper in a background class delivers 11 to 27% (MM3 s6), a start can open on silence (4.1 row 8). A reader who hears three seconds of nothing in a recording used as evidence must be able to learn from the package itself whether the room was quiet or the audio was not there. Counts cannot tell him. SM-30.

**(c) Must a transcript carry the statement? Yes.** A transcript has no silence and no cut: what the audio lost is invisible in it, and it is the form in which most readers will meet the recording. `apps/transcriber` exists in this repository and no file of its `src` reads an optional manifest member today (a search, not a reading). SM-38.

**(d) The 12.0% bound.** It is the right FLOOR and the wrong ONLY test. Right: it trips at once for the faults that matter most (MM3 s6, s8.2) and it catches a session that is bad from its first second, which a comparison with the session's own level never can. Wrong alone: the measured shortfall is 8.2 to 10.6%, so a further standing loss of 1.4 to 3.8 points passes for ever. The notice is the operator's; the signed numbers do not depend on it (design 8.3, last paragraph - confirmed, and that is why this is not a gate). SM-32.

**(e) What a reader may conclude:** section 13.

### 4.3 New requirements

**SM-29 (CAUTION, GATE). The account is whole: every sample of the track is either received or counted as inserted, and every received sample is either in the track or counted as discarded.** Rows N1 (words), N3, N11.
1. `timelineSamples` counts from SAMPLE 0 of the session's audio timeline for every microphone of the plan, not from that microphone's first sample. Silence before a first sample, the lead of a second microphone, a start on silence, the time a microphone is "stopped": all are `insertedSamples`.
2. A fourth number, `discardedSamples`: received and not put on the timeline - the full buffer (`WK/audio.c:396`), the re-placement (`:431`), the trim before T0 (`:582`). A non-finite sample replaced by zero (`:393`) is counted as inserted, or in a number of its own; it is never uncounted.
3. THE IDENTITY, checked by the worker's own test at every account: `timelineSamples` = `receivedSamples` - `discardedSamples` - (what is still buffered, and what the resampler holds, both stated) + `insertedSamples`. A build in which it does not hold to the sample does not ship the record.
4. THE ACCOUNT STATES ITS COVERAGE. The record every 60 s is right for a killed worker (design 8.2) and it leaves up to 60 s of track after the last record. The record carries the timeline sample it reaches and a mark that it is the CLOSING account (written with the end of the timeline) or not; the audit row and the signed member carry both. A reader must see "the account ends at sample X, the track at Y" and never take the tail for whole. Where the Core holds a later telemetry value it may state it as a second, lower-trust figure; it does not replace the record.
5. EXACT ON THE STAND-IN: with the pattern stand-in of design 9.2 (512 samples every 11.9 ms, one packet in ten left out, a known total), `receivedSamples` equals what the stand-in wrote and `insertedSamples` equals the timeline less that, to one quantum at each end; with a whole pipe, inserted and discarded read zero after the start. This replaces the withdrawn rate gate (section 3).
6. The account record is a RECORD (not droppable) - confirmed as designed; its numbers are whole numbers within the bounds of design 8.2.

**SM-30 (CAUTION, GATE). Inserted silence carries its position where a reader could mistake it.** Rows N1, N2 (words), N3, N11, N12.
1. THE TRACK, not only the microphone. The audio of the package is the track the encoder was fed: one microphone at a time, by the source intervals. The worker counts the inserted samples of the microphone that FEEDS THE ENCODER in each quantum; the signed member states that total per attempt (`trackInsertedSamples` or the build's name). Two per-microphone totals do not answer "how much of what I hear is inserted" once the operator has switched.
2. THE LIST OF LONG RUNS. Every run of consecutive inserted samples of 4,800 or more (100 ms) on the feeding microphone is a record of its own: the first sample of the run on the timeline's sample counter (the counter of `AUDIO_SOURCE_INTERVAL`, `WK/audio.c:160-170`), its length, the microphone. It goes into the audit row's chain and under the signature, in the order of the timeline. The list is bounded (the build names the bound; 1,024 per attempt is enough for any session that is worth keeping); when the bound is reached the member says so with the count and the sum of the runs not listed - it is never cut silently.
3. BELOW THE THRESHOLD: no positions. The member states the count of runs and the longest run per attempt, so that "they are everywhere and at most this long" is a signed fact.
4. Why 100 ms: above the longest ordinary run (HB-2: one quantum; the read interval reached 22 to 37 ms at its worst, MM3 s9 item 3) with room, and below the shortest silence a listener would read as a pause. The build confirms on the stand-in that ordinary running lists NO run; if it lists any, the threshold is raised and stated, not the list dropped.
5. THE WORDS. No document, notice, screen or manifest comment says the silence stands at or near the missing sound. The fixed sentence for all of them: "Sound that did not arrive is not in the recording. Silence of the same total length was inserted by the recorder; its places are not the places of the missing sound."
6. RECOMMENDED, put to the controller and the user, NOT a requirement: a sealed side file with EVERY inserted run (position and length), named and hashed by the manifest. With it an examiner can take the inserted silence out again and hear exactly what the device delivered. Cost: a new member of the package and its reader. Without it the track cannot be reduced to what was delivered.

**SM-31 (CAUTION). For the gapped kind nothing in the worker changes a sample's value or order except the counted zero-fill and the counted discards.** Row N3.
1. The whole controller block (`WK/audio.c:452-480`) is not entered for a gapped microphone: no level tracking that acts, no compensation call, no `micwatch_rate`; `MIC_RATE_AT_LIMIT` cannot arise (design 7.2 - confirmed).
2. THE RESAMPLER (HB-1): the row shows with a marker signal that what leaves the buffer equals what was read, value for value, with at most a constant delay that is stated; if it does not, a gapped microphone bypasses the resampler. Either is acceptable; "not shown" is not.
3. The telemetry's `ratePpm` for a gapped microphone is a fixed statement (null), never a number that reads like a controlled clock.
4. The displacement of sound against picture (design 7.2 point 4) is MEASURED and stated against the product's bound; if the bound is not met the row stops and reports - "holding the buffer by inserting zeros earlier" is a change of what the evidence says and comes back here.
5. `nonZero` is taken from the samples as read, before any replacement.

**SM-32 (CAUTION). The notice compares against a floor AND against the session's own level, and a long run raises it at once.** Rows N2, N11.
1. KEPT: above 12.0% over 10 s in two windows in a row (design 8.3).
2. ADDED: the session's REFERENCE is the median shortfall of its first six complete windows (one minute); it is fixed for the attempt. A window more than 2.0 points above the reference, twice in a row, raises the same notice with the reason word of its own. The reference itself is held to the floor. Why fixed: a running median follows a slow worsening and never trips.
3. ADDED: a run of SM-30 (2) raises the notice at once, with its length.
4. The three figures (12.0, 2.0, six windows) are constants beside the existing one, not settings; N15 measures a session of at least 30 minutes WITH THE WATCH RUNNING (HB-5), reports how often each test tripped, and the figures are confirmed or changed on that report. A notice that fires in every ordinary session is as dishonest as none.
5. Whether the advisory list can carry a level above information is the contract row's (design 8.3); `MIC_SAMPLES_SHORT_ABOVE_BOUND` is a WARNING in what the operator reads.

**SM-38 (CAUTION). A product derived from the audio carries the statement.** A new row (rank 5); before any transcript of a session of this path is shown or exported.
1. A transcript, a clip, an audio-only export or any other product made from a session whose manifest carries `audio.samplesNotReceived` states at its head the fixed sentence of SM-30 (5) with the numbers of the member.
2. At the place of every listed run (SM-30 (2)) the transcript carries a marker with the run's length; text is never joined across it.
3. The transcriber takes the fact from the SIGNED member, not from a flag of the Core.
4. Until the row exists: the README says that a transcript of a session recorded on this Mac does not show what the audio lost.

## 5. Point 3 - THE WORKER CHANGE

**SM-33 (CAUTION, GATE). A new pipe kind in the C source owes the worker's whole re-verification, and the Linux path owes proof that nothing of it moved.** Row N3; the controller for the series.

1. WHAT IT OWES: everything decision C88 lists for BR-11, again, on the binaries built from the changed source: `make` (guard, relay unit), `make e2e`, `row58_gate` three times, rows 176, 175, 041, 042, 043, 186, 143b, 152, 153, the fuzz controls, the row-046 database test; AND THE KILL MATRIX, all 35 cases, under the port rule of C88 (it ran once inside a suite run; it runs again the same way). The protocol goes from version 4 to 5: every fixture that speaks version 4 changes one number, and each such edit is listed.
2. THE BASELINE FIRST (rank 3): before the first edit of `WK/`, the row records the three binary hashes, the result of the series and of the kill matrix on the unchanged source, and the outputs of the comparison run of (4). Without it "unchanged" has nothing to be compared with.
3. NO EXPECTED VALUE OF AN EXISTING CHECK IS EDITED to make it pass, except the protocol number and the presence of the new telemetry members; every edited expectation is listed with its reason in the row's record. One that is not on that list is a failed row.
4. WHAT MUST NOT CHANGE for `PCM_FIFO`, and how it is shown:
   - THE MEDIA: the audio packets of a session on `PCM_FIFO`. The worker can write a per-packet digest list (`WK/audio.c:258-271`). The row runs the same fixture input through the binary of the baseline and through the new one under conditions in which the worker's result is determined (the row finds or builds them - a paced fixture and a fixed first-sample time; if two runs of the BASELINE binary do not agree with each other the instrument is not fit, and the row says so and falls back to the sample-exact checks of rows 041 to 043 unchanged). Equal digest lists, equal `missing` counts.
   - THE RECORDS: the account record of SM-29 is sent for a GAPPED microphone only. A Linux session gets no new record kind: the Core's session handling on Linux is unproven on hardware (C97, last sentence) and is given no new input by this task. The three telemetry members may be sent for every kind (the schema stays one), under (5).
   - THE CODE: the gapped behaviour hangs on ONE predicate of the microphone, set in ONE place (the plan reader, from the kind word) and read in a listed set of places; the worker's static rules (`apps/capture-worker/test/static/`) gain a rule that pins those places and planted lines that must fail it: a second place that sets it, a compensation call reachable for a gapped microphone, a branch on the kind anywhere else.
   - THE EVIDENCE: the byte-identity proof of design 8.4 (manifest and signature of two fixture sessions identical by `cmp`, before and after) - confirmed as designed, and it is run on a session that went through the NEW worker.
5. THE TELEMETRY BUFFER: the `levels` text is 768 bytes for two microphones and is sent EMPTY when it does not fit (`WK/audio.c:487`, `:528-529`). With three members more per microphone at their largest values and the longest device id the row shows it fits, by a test at the bounds; an empty `levels` would switch off the non-zero gate and the notices without a word.
6. THE PLAN READER (`WK/capture_worker.c:176`): two words are accepted, any other is `PLAN_INVALID`; the fuzz controls gain the new word, a near-miss of it, and both kinds in one plan (admitted: the kind is per microphone).
7. NEW KILL CASES for a gapped microphone: the worker killed before its first account, between two accounts, and after the closing one; each time the Core's audit row and the sealed member state what SM-29 (4) and SM-36 require.
8. The row's long runs go to a separate test runner, one heavy run at a time, the database lock before the heavy-host lock (C88).

## 6. Point 4 - ONE PROCESS, TWO MICROPHONES

The handle group of design 6.1 is accepted: a group is launched once; a handle starts once; an output cannot be added to a running helper (refused); the last close stops the helper; exit status 255 after the adapter's own stop is the ordered end; the helper's own end tells every live handle. It keeps the rule of rows 191 / 191b without a change to the session.

**Is it still a "standby"?** In the contract, yes: `STANDBY` is the name of a slot and of a role in the start rule, the plan, the source intervals and the signed manifest, and U22 (2) forbids changing the start rule. For the OPERATOR and for a READER OF THE PACKAGE, no: a standby is what you turn to when the primary fails, and here every fault but one - the microphone itself or its cable into the interface - takes both in the same instant, the capture program's end included. A notice that is advisory, non-blocking and gone when the session ends (design 6.2) does not carry that into the places where the word is read later.

**SM-34 (CAUTION). The role keeps its contract name; the bare word is never what the operator or the reader gets.** Rows N2, N9, N11, N16, and the web row that shows a microphone's role.
1. THE OPERATOR'S WORD. Wherever the product shows the STANDBY role of a pair that resolves to one device, the label carries the qualifier, at the assignment, at the pre-check, during the session and in the session's summary: "second channel of the same device" (the Indonesian text is the document row's). The plain "standby" label is shown only for two devices.
2. THE NOTICE `STANDBY_ON_PRIMARY_DEVICE` (design 6.2) is kept, and its sentence names the process too: "The standby microphone is another channel of the primary's device and is recorded by the same capture program. It guards a microphone and its cable, nothing else."
3. THE SIGNED STATEMENT. Each record of the signed member gains a small whole number, the CAPTURE GROUP: microphones with the same number were captured by one process from one device. A reader of the package who sees a source interval with the role `STANDBY` then sees, under the same signature, that it was not an independent source. Same `usbPort` and `cardId` in the source facts (design 6.2) is not enough: the source facts are the database's, not the package's.
4. NO SWITCH AS A REMEDY. When the group's helper has ended, both microphones are gone: the product does not offer the switch to the standby as the way out, and a switch asked for then is answered with what is true.
5. Never "redundant", in any document or screen (review SM-19 (3) - kept).
6. A handle opened after the launch is refused (design 6.1); the refusal's sentence tells the operator that both microphones of one device are started together.

## 7. Point 5 - THE DROPPING FIFO

What the design does: the helper's two lines become notices; "what was dropped is inside the measured shortfall (the worker never received it)" (design 4.6 row 5).

**Ruling.** The second sentence is right and is what matters: a packet the helper's queue drops never reaches the pipe, the worker fills its place on the timeline with zeros, and those zeros are counted. So NO drop is silent in the total - of the standby and of the primary alike - and that holds even when the helper's lines are never read. The count is the control; the lines are advice. Three things the design does not yet do:

**SM-35 (CAUTION). The amount of a drop comes from the worker's numbers, per microphone, with its place.** Rows N4, N8, N9, N11.
1. THE AMOUNT. The helper's lines carry no count and name a pointer, not an output (design 4.6). The notice of a queue event therefore states, per microphone of the group, the growth of `insertedSamples` between the line `FIFO queue full` and the first account after `FIFO queue flushed`: that tells which microphone lost and how much. "A count" of lines is not an amount.
2. THE PLACE. A drop of this kind is a long run: it is in the list of SM-30 (2) when it is on the feeding microphone, with its position. That is where the evidence states it; the notice is the operator's.
3. THE PRIMARY'S OWN PACKETS. In the product both pipes have ONE reader, the worker's audio thread (`WK/audio.c:555-556`, `:602`): a reader that stalls, stalls for both, and the queue drops both. It is counted for both by (1). The case "the primary's reader alone stalls" cannot arise in the product and was not measured (MM3 s10); the README says so rather than claim it.
4. A QUEUE LINE WITHOUT ITS TWIN. `FIFO queue full` with no `flushed` within 10,000 ms is a fault of the group (the reader never came back), not a standing notice.
5. THE FOUR UNRUN FORMS (rank 4) before the adapter relies on them: one queued output alone; a reader absent at the start (does the helper wait, drop, or end); a reader that closes its pipe (does the OTHER output live on - design 6.1 leaves a closed handle's output writing into a pipe nobody reads, which is exactly the dropping case and is accepted on that proof only); the pre-check to standard output.
6. `-drop_pkts_on_overflow 1` is never `0`: the blocking form stops the primary for as long as the other reader stalls, without a line (MM2 s5: 2.772 s). Held by the template of section 8.
7. Standard error is read as it arrives, per line, bounded (SM-12 as widened): a line over 512 characters is dropped unread; the observer has a byte budget per second and for the helper's life, and when it is spent the observer stops reading and says so ONCE - a helper that floods its diagnostics cannot take the Core's memory or its turn. The count of SM-29 does not depend on it.

## 8. Point 6 - SR-15, final words for the row of revision 2

Confirmed: the restatement of design 4.3 in substance (one or two output sections; the selection once per section; `fifo` in the format set; the one log level `info`; the property-list row word for word; the forbidden options named). Tightened in five points, reversed in none. Words for the controller:

> NAMED AMENDMENT SR-15 (final words for the row of revision 2). Rule G-R12 as amended by SR-4 and SR-12 gains the places below, all for the production microphone of kind `USB_AUDIO` on `darwin`, in a kind of list of its own (neither a development list nor a Linux list), and loses none.
> (1) THE DEVICE WORD is one of the CLOSED SET of 32 words `none:0` to `none:31`: the word `none:`, then the decimal form of one whole number 0 to 31 without sign and without a leading zero, made by ONE table function that takes that one number and nothing else. The number is the audio index of the device list read for THIS LAUNCH of the device's helper - at a retry, of the listing made for the retry - of a device whose tie held in that same listing. The video part is the literal `none` always. No name, product, USB id, serial, location, card id or any other text of a listing, of the database or of the configuration forms any part of it.
> (2) THE PUSH LIST IS A TEMPLATE AND IS COMPARED WHOLE. It is, word for word and in this order: `-hide_banner -nostdin -nostats -loglevel info -thread_queue_size 1024 -f avfoundation -i <device word>`, then ONE or TWO sections, each `-map 0:a -af <selection> -ac 1 -ar 48000 -c:a pcm_f32le -f fifo -fifo_format f32le -drop_pkts_on_overflow 1 -queue_size 32 -format_opts flush_packets=1 -y <pipe>`. Its only computed words are the device word, one SELECTION per section - one of the 64 words of SR-4 (2), made by the SAME table function from one whole number 0 to 63 below the live channel count - and one PIPE per section, held to the pipe argument rule. The sections stand in the ascending order of their selections; two sections never hold the same selection or the same pipe. A list that differs from the template in a word, in the order or in the count is a violation: there is no set of admitted words beside the template.
> (3) THE PRE-CHECK LIST IS A TEMPLATE TOO: `-hide_banner -nostdin -nostats -loglevel info -f avfoundation -i <device word> -t 1 -map 0:a -af <selection> -ac 1 -ar 48000 -c:a pcm_f32le -f f32le -flush_packets 1 -`. The word `-t` stands in this list and in no other. What it writes to standard output is read by the Core in memory, within a bound of bytes and of time, counted and stored nowhere.
> (4) The formats of the table are `avfoundation`, `fifo` and `f32le`. `fifo` stands only as the output format of a push section with its four fixed groups; of the options of that output format in the pinned program no other stands in the table, and `-drop_pkts_on_overflow` is never `0`.
> (5) NOTHING BETWEEN THE DEVICE AND THE PIPE PADS, STRETCHES, RE-TIMES, CUTS OR MIXES. The table holds no filter but the one selection per output, in no spelling of a filter option and from no file; no option of design section 4.2a; no log level but `info`; no progress report; no option that selects a device by another way; no `default`.
> (6) The listing of USB audio devices on `darwin` is THREE FIXED ROWS WITHOUT A PARAMETER: `/usr/sbin/ioreg -r -c IOUSBHostDevice -l -d 2 -a`; `/usr/sbin/system_profiler SPAudioDataType -json`; and the audio helper program of the configuration with the existing device-list row, unchanged. The first two programs are absolute literals named by the table file alone. Each row is handed to the production door unchanged by its ONE caller in the fence, with an empty environment and no start message, on `darwin` only, and is killed at its own bound (5,000 ms, 10,000 ms, 5,000 ms).
> (7) The helper of a push list and of a pre-check list is started by the guard through the production door, with an empty environment; no other program stands before it.
> Kept, unchanged: every other sentence of G-R12, SR-4 and SR-12; the two files that may name `-list_devices` and `avfoundation`; AD-07 (2) in its words on either platform.

What changed against the design's restatement, and why:

| # | Design 4.3 | Final | Reason |
|---|---|---|---|
| a | admissions by place ("directly after `-af`", a format set, a forbidden list) | the two lists are TEMPLATES compared whole (2), (3) | a list of forbidden words is only as good as its completeness: the program has several spellings of a filter option and can read an option's value from a file (HB-4); a template has no such gap. The forbidden list stays, as CONTROLS |
| b | "for THIS LAUNCH" | and at a retry the listing of the retry (1) | design 4.7 makes a fresh listing for the retry: the words must say whose index it is |
| c | `fifo` "directly followed by" four groups | no OTHER option of that output format, `-drop_pkts_on_overflow` never `0` (4) | HB-3: recovery and time-shift options of the queue would restart or delay an output; the blocking form stops the primary (MM2 s5) |
| d | the pre-check "a list of the table too" | its template, with `-t` in it alone (3) | design 4.2a forbids `-t` in a push list; the rule must say where it is allowed |
| e | - | the guard and the empty environment (7) | MM3 s6: a wrapper that sets a scheduling class costs 73 to 89% of the audio without a line |

**SM-08, restated (the static rule).** Rows N4 and the static test's owner.
1. The rule is the template equality of (2) and (3), for every list the macOS table can make: one section and two, every device word, every selection.
2. PLANTED CONTROLS, each of which the rule must be SEEN to refuse (a control the rule passes is a failed rule): every word of design 4.2a, each in the place where it would act (an input option before `-i`; an output option inside a section; text after a comma or a semicolon inside the selection word); a filter option in another spelling and one whose value comes from a file; `-af` twice in a section; a third section; `-t` in a push list; a second log level; `-progress`; `-drop_pkts_on_overflow 0`; `-queue_size` with another number; every option of the `fifo` output format that the pinned program's help text lists beside the four (the row runs `-h muxer=fifo`, which opens nothing, and pins the list: HB-3); the same selection twice; the same pipe twice; sections in descending order; the controls of the review's SM-08 (e) for the device word; `nice`, `taskpolicy`, a shell before the helper.
3. At the ONE caller (the macOS adapter): each table function is called once per launch (and once more for the one retry), with the index of the located device of that launch's listing, the stored input numbers, the pipes and the registry ids (design 4.3, last paragraph - confirmed).

Provisional inside SR-15: sentence (3) and the one-section form of (2), until the run of rank 4. If a word must change, it is a new amendment.

## 9. Point 7 - UNRELIABLE OPENS

The pause of 1,000 ms after a close and the ONE retry of design 4.7 are accepted: the retry needs all of exit status 251, the fixed refusal line and no stream line yet; it makes a fresh full listing; a second refusal is the end with a named detail; it is inside the one `start` of a handle and never restarts a helper that fed a worker.

**SM-39 (CAUTION). Bounded, reported, and its gap stated - also at a session's START.** Rows N9, N11, N15.
1. BOUNDED: one retry per launch, never a loop; the count of retries of a session is a number of its record.
2. REPORTED: the notice `AUDIO_OPEN_RETRIED` in the log and the persistent error log (design 4.7 - confirmed). No text of the helper's diagnostics is in it.
3. THE GAP AT A RESTART: inside `audio.absentOnRestart`, signed with both bounds (row 191c) - confirmed; nothing to add.
4. THE GAP AT A START is NOT stated by the design. The worker runs before the helpers are launched (`CS/capture-session/index.ts:2217`, `:2228`) and starts its timeline on silence when no microphone has delivered for 3,000 ms (`WK/audio.c:91`, `:570`). A launch with the pause and the retry can take longer (design 4.7). The track then opens with silence the account of design 8.2 does not count. Closed by SM-29 (1) and, when it is 100 ms or more on the feeding microphone, listed by SM-30 (2). No further rule is needed, and none less.
5. THE PAUSE holds across everything that closes a helper on the device: a pre-check followed by a session start, a restart, a session after a session. The instant is kept per device by the adapter, not per session.
6. THE 8,000 ms: the worst case of about 6.9 s is computed from figures taken under load, and the system listing's own bound is 10,000 ms. N9 times a launch with pause and retry on doubles; N15 on the device. A launch that passes the bound fails with its named refusal - it fails closed, which is accepted; it is not lengthened by a second retry.
7. NOT SEPARATED BY THE MEASUREMENTS (HB-5): whether the listing through the capture program plays a part in the refused opens or in the loss. N15 states the shortfall and the refusals with the watch running; if the watch costs audio, its pass reads the USB tree alone for "present" (the review's SM-10 (4)) and the full listing less often.

## 10. Point 8 - THE BENCH-FORM MARKING

The design does not add the review's word `hostForm: BENCH_DARWIN` (design 8.1): the signed manifest already states `hostProfileNotAsked: { platform: 'darwin' }` (row P1, C97) and, in the new member, `captureLayer: AVFOUNDATION`. **Accepted** (SM-40): a third word would say the same a third time. What is not accepted is that the statement can be MISSING or UNSEEN.

**Must the product refuse to describe such a session as anything but the bench form? Yes.** A path that provably cannot deliver every sample has one honest description. In three places:

**SM-36 (CAUTION, GATE). The seal cannot make a package of this path without the member.** Rows N11, N12.
1. THE ANCHOR is the source-fact key written at the session's start, which the runtime role cannot change (design WF10): `sampleContinuity: NOT_CONTINUOUS`. The seal reads it. For every microphone that carries it and every capture attempt of the session, the member holds a record.
2. Where the audit row of that microphone and attempt is missing (the Core ended before it wrote it, the worker left no account) the record is written WITH NULL NUMBERS - "not sample-continuous; the amount was not measured" - never left out.
3. A session with the key on any microphone and no member is NOT sealed as `REAL`: the seal stops with a named reason. The design's "PRESENT ON THIS MAC, ALWAYS" (8.4) is a rule of the seal, not an expectation.
4. The reverse holds as designed: no key, no member; a Linux package has the same bytes as before (SM-33 (4)).
5. The member's own statement of absence stays as the design words it: "this manifest states no measured shortfall", never "the audio is complete".

**SM-37 (CAUTION). The verifier's verdict, the export and every description say it.** A new row (rank 5); before N15 and before the first real session.
1. THE VERDICT LINES of the Core's verify and of the receiver's command do not show the optional members today (C97, "open, stated"). For a package that carries `audio.samplesNotReceived` both print, beside the verdict on the signature and the digests, a line of their own that cannot be switched off: the audio is not sample-continuous (bench capture path of a Mac); received X of Y samples; Z samples of inserted silence; N listed runs, the longest L; the two microphones are one device and one capture program; the host profile was not asked. Where a number is null or the account is not closed, the line says "not measured" or "measured up to ...". The verdict on integrity stays what it is: a package can be untouched and its audio incomplete, and the reader is told both.
2. THE EXPORT: the same statement in every form in which a session leaves the Core - the package's human-readable summary, an audio-only export, a clip.
3. THE WORDS OF THE PRODUCT: no screen, document, log line or report calls a session of this path "complete audio", "fit to record", "hardened" or "production-grade"; the operator's notice of design 8.3 stands at every pre-check and every session start. `REAL_PRODUCTION` remains the name of the mode (U21); it is not a statement about the audio.
4. A verifier older than the member refuses the package (design 8.4): the safe side, kept.

**SM-20, restated.** (1) The mark in code is the adapter's own file and its two constants, the transport kind and the two source-fact keys (design 8.1) - accepted. (2) "Fit to record" is never declared for this path (section 3). (3) Every weaker point W1 to W17 of design section 11 is in the README and the installer note; W12 in the words of SM-30 (5); W17 as restated in section 3.

## 11. Point 9 - the option the user has not taken (a view, not a requirement)

1. It is the only measure that reaches the cause: the loss is the pinned tool's way of reading (MM3 s1), and no setting of that tool changes it.
2. Its first step is cheap and decides the rest: a reader that only COUNTS samples for 60 s, keeps nothing, and tells whether the system and the device deliver all 48,000 a second. Nobody has measured that (MM3 s7). This reviewer recommends that the user allow that one measurement even if the reader itself is never built.
3. For security it is a trade, not a loss: a small new program in the evidence path to review and sign, against the removal of the name tie, the index of another process's list, the layout word, the refused opens, the dropping queue and most of SR-15; and a program of its own can hold the microphone grant by itself instead of the application that starts the Core (review SM-15).
4. Nothing built now is wasted by it: the gapped kind, the account, the signed member and the verdict line stay as the measure of whatever a reader delivers - and would then read zero or say what is still missing.
5. As long as this Mac is a bench, the design of revision 2 with this addendum is acceptable. Before a recording from this Mac is relied on as evidence by anyone outside, the option should be put to the user again with the result of step 2.

## 12. The requirements after the addendum

Unchanged in words and rating, as in the review: SM-01, SM-03, SM-05, SM-11, SM-13, SM-17, SM-21, SM-22, SM-23, SM-24, SM-27 (PASS: SM-01, SM-05, SM-21, SM-22, SM-24).

| Req | Was | Now | What changed |
|---|---|---|---|
| SM-02 (gate) | CAUTION | CAUTION | the design takes the property-list form (2.3); two runs disagree on the interface class: N6 settles it before its words are pinned; a failed row in a confined process is a listing failure, never "no card" |
| SM-04 (gate) | CAUTION | CAUTION | (2) restated: one integer and one word of a closed table; the interval of a launch that failed after samples flowed (section 3) |
| SM-06 | CAUTION | CAUTION | the stall is read from the worker's received count; a group that delivers nothing for 5,000 ms is stopped (section 3) |
| SM-07 | CAUTION | CAUTION | SR-15 final (section 8); two sentences provisional until rank 4 |
| SM-08 | CAUTION | CAUTION | the static rule is template equality with planted controls (section 8) |
| SM-09 | PASS | PASS | the selection stands once PER output section; the same function |
| SM-10 | CAUTION | CAUTION | (4) the watch's listings are measured against the shortfall (HB-5; SM-39 (7)) |
| SM-12 | CAUTION | CAUTION | (3) widened to the live observer of standard error: bounded per line, per second and per life; nothing of a line kept (SM-35 (7)) |
| SM-14 (gate) | CAUTION | CAUTION | as the design's 4.6: the pre-check counted by the Core, the session start by the worker's `nonZero` on the feeding microphone within 8,000 ms; a silent standby warns (U25 (1)). The pre-check's count is judged for "one non-zero sample", never against 48,000 |
| SM-15 | CAUTION | CAUTION | MM s6: the application that hosts the agents holds the grant; rank 6 (c) |
| SM-16 (gate) | CAUTION | CAUTION | (1) to (4) met by design 4.6; (5) replaced: the account is right, and the path is never declared fit (section 3) |
| SM-18 | CAUTION | CAUTION | the two keys on `darwin` only are accepted; (4) the fault intervals now include SM-04 (c) and SM-06 (a) |
| SM-19 | CAUTION | CAUTION | (4) settled by measurement; widened by SM-34 |
| SM-20 | CAUTION | CAUTION | restated (section 10); the extra host word is not required |
| SM-25 | CAUTION | CAUTION | the fixtures and stand-ins of design 9.1, 9.2 accepted; added: the stand-in modes of SM-29 (5), a long run, a start on silence, an account that is not closed, a queue line without its twin |
| SM-26 (gate) | CAUTION | **PASS, closed** | rows MM, MM2, MM3 ran inside the bounds as U24 (1) lifted them; no audio kept, no device text in a record (each record's end state), the built-in input never selected |
| SM-28 | PASS | PASS | the user's own list is the design's 9.3 (five points); added: the first-open levels seen once (MM s4), to watch at the first pre-check |
| **SM-29** (gate) | - | CAUTION | the account is whole (section 4.3) |
| **SM-30** (gate) | - | CAUTION | positions for long runs; the track total; the words (section 4.3) |
| **SM-31** | - | CAUTION | no other change of a sample in the worker (section 4.3) |
| **SM-32** | - | CAUTION | the notice: a floor, the session's own level, a long run (section 4.3) |
| **SM-33** (gate) | - | CAUTION | the worker's re-verification; the Linux path unchanged, shown (section 5) |
| **SM-34** | - | CAUTION | the operator's word; the signed capture group (section 6) |
| **SM-35** | - | CAUTION | the amount and the place of a queue drop (section 7) |
| **SM-36** (gate) | - | CAUTION | the seal cannot leave the member out (section 10) |
| **SM-37** | - | CAUTION | the verdict lines, the export, the words (section 10) |
| **SM-38** | - | CAUTION | a transcript carries the statement (section 4.3) |
| **SM-39** | - | CAUTION | unreliable opens (section 9) |
| **SM-40** | - | PASS | the source facts state THAT, the audit row and the member HOW MUCH; no extra host word (sections 3, 10) |

**Count: 40 requirements. PASS 9** (SM-01, SM-05, SM-09, SM-21, SM-22, SM-24, SM-26, SM-28, SM-40). **CAUTION 31. FAIL 0.** Gates (8): SM-02, SM-04, SM-14, SM-16, SM-29, SM-30, SM-33, SM-36.

Requirements by row of the design's section 10:

| Row | Requirements of this addendum (the review's stay as mapped by the design's "rows of revision 1" table) |
|---|---|
| N1 (protocol) | SM-29, SM-30 (words), SM-33 (4, 5) |
| N2 (shared package) | SM-30, SM-32 (5), SM-34 (2, 3), SM-36 (5) |
| N3 (worker) | SM-29, SM-30 (1, 2, 4), SM-31, SM-33 |
| N4 (table, static rule) | SR-15, SM-08, SM-35 (5, 6), rank 4 |
| N5 (door) | SM-12 (3), SM-35 (7) |
| N6 (listing) | SM-02 |
| N8 (reader of the helper's lines) | SM-04 (2), SM-35 (4) |
| N9 (adapter) | SM-04, SM-34 (4, 6), SM-35, SM-39 |
| N11 (session, forwarder, source facts) | SM-06, SM-29 (4), SM-30, SM-32, SM-34 (1), SM-35 (1), SM-36 (1), SM-39 (1, 4) |
| N12 (seal) | SM-30 (2), SM-36, SM-33 (4, evidence) |
| N14, N15 (tests) | SM-25, SM-29 (5), SM-32 (4), SM-39 (6, 7) |
| N16 (documents) | SM-20 (3), SM-30 (5), SM-34 (5), SM-38 (4) |
| NEW: verdict lines and export | SM-37 |
| NEW: transcript | SM-38 |

## 13. What a reader of a sealed package may conclude about its audio

Meant for the README, the installer note and the verdict line; true once SM-29, SM-30, SM-34, SM-36 and SM-37 are built. "The member" = `audio.samplesNotReceived`.

**May conclude, from the signed package:**

| # | Statement | From |
|---|---|---|
| 1 | The recording was made on a Mac whose host profile was not asked, through the capture layer of that system: the bench form, not the hardened form | `hostProfileNotAsked`; `captureLayer` |
| 2 | The audio track is as long as the recording's wall time; its timeline is the recorder's clock | the worker's timeline (`WK/audio.c:599`); the track against the source intervals |
| 3 | Of the Y samples of the timeline, X were received from the microphone and Z are silence the recorder inserted; that silence is not sound of the room | the member's numbers |
| 4 | Every inserted silence of 100 ms or more stands in a list with its place. A silence of that length that is NOT in the list is what the device delivered | the member's run list |
| 5 | Inserted silences shorter than 100 ms stand throughout the track, N of them, none longer than L | the member's count and longest run |
| 6 | Both microphones were channels of one device recorded by one program: a switch to the "standby" was a switch to another channel, not to another source | the capture group |
| 7 | Where a number reads "not measured", or the account ends before the track does, the amount for that part is unknown - not zero | null numbers; the closed mark |
| 8 | When the recorder was replaced during the session, how long no audio was recorded at all | `audio.absentOnRestart` |

**May NOT conclude:**

| # | Not this | Why |
|---|---|---|
| 1 | That the sound he hears is continuous | about nine times a second, 10.67 ms of sound is absent with NO mark at its place (MM3 s1); where, nothing records. No passage of the track is known to be free of such cuts |
| 2 | That a sound which is not in the recording was not in the room | a sound shorter than a cut can be lost whole; during a listed run nothing was recorded |
| 3 | That the places of the inserted silence are the places of the missing sound | section 4.1; SM-30 (5) |
| 4 | That a short silence is a pause | statement 5 above |
| 5 | Anything that rests on the waveform being unbroken: a duration measured by counting samples within a passage, a timing finer than the stated displacement of sound against picture, a comparison of voices, an examination for edits | the track holds cuts and inserted silence BY CONSTRUCTION. A break in the waveform is no sign of tampering here, and an edit cannot be told from the path's own cuts by listening or by signal analysis: integrity rests on the signature and the digests alone |
| 6 | That no other program read or changed the microphone, that the gain was constant, that the device was the same for every sample | review SM-17: macOS gives no exclusive access; the identity is checked at the listings |
| 7 | That the rate was 48,000 Hz for every second | it is checked at the launch and at every watch pass; a change between two passes is a fault with its interval, not repaired (review SM-16 (2)) |
| 8 | From a package WITHOUT the member, that its audio is complete | the member's absence states nothing (design 8.4); a Linux package makes no claim of sample continuity either way |
| 9 | From a transcript, that it holds every word that was spoken | SM-38 |

## 14. Order of the work packages

Before any row: rank 1. Before N1 and N2: rank 2. Before N3's first edit: rank 3.

| Wave | Rows | May run in parallel | Waits for |
|---|---|---|---|
| A | N4, N5, N6, N8 | all four: four owners, no shared file (N4 the table file and its static pins; N5 the door; N6 the listing and one word of `card-listing.ts`; N8 a pure reader) | rank 1. N4 does not CLOSE before rank 4 is run |
| A' | N1, N2 | with each other and with wave A (N1 the one writer of the protocol package, N2 of the shared package) | rank 1 AND rank 2 |
| B | N3; N7; N9; N13 | N3 alone on the worker build and the heavy-host lock; N7, N9, N13 beside it and beside each other, with one exception: N7 and N10 share the fence wiring and its pins, so N7 lands before N10 | N3: N1 and rank 3. N7: N4, N6. N9: N4 closed, N5, N6, N8, and N1's words. N13: N2 |
| B+ | the BR-11 series and the kill matrix on the changed worker (SM-33 (1)) | one heavy runner; nothing else heavy beside it | N3 |
| C | N10; N11; N12 | N10 beside N11; N12 after N11's words on the audit row. N11 is the one writer of `capture-session/index.ts` | N10: N9, N7. N11: N1, N2, and N3's and N9's words. N12: N2, N11 |
| C' | the two new rows: verdict lines and export (SM-37); transcript (SM-38) | with each other and with wave C | N2; SM-37 also N12 |
| D | N14; N16 | beside each other | N14: N3 with B+ green, N7, N9, N10, N11, N12. N16: N9, N11 |
| E | N15 | alone: one opener of the one device; the user at the Mac for the system's question | N14, and the verdict-line row |

Single-writer resources, as the design names them: the protocol package, the shared package, the table file, the door, the worker build, `capture-session/index.ts`, the seal, the README. No row but N15 opens a device; rank 4 and N3's stand-ins use a generated source.

## 15. Compliance view (short; only what the addendum changes)

| Item | Status | Finding |
|---|---|---|
| GDPR Art. 5(1)(d) (accuracy) | Gap, closed by requirements | a voice recording that reads as whole and is not is inaccurate personal data; SM-29, SM-30, SM-36, SM-37, SM-38 make the record say what it holds |
| GDPR Art. 5(1)(c), Art. 25 | Met in the design | the pre-check reads one second in memory, counts and drops it (design 4.6); the live observer of standard error keeps no text (SM-35 (7)) |
| GDPR Art. 30, 33, 35 | Not examined | - |
| ISO 27001 A.12.4 (logging) | Met with findings | the shortfall, the long runs, the retries and the fault intervals are in the session's record; no device text in a notice (SM-39 (2)) |
| ISO 27001 A.12.1.2, A.14.2 (change control, secure development) | Finding | a change of the worker's C source owes the whole re-verification and a baseline (SM-33); the argument rule is a template with planted controls (SM-08) |
| ISO 27001 A.18 / evidence integrity | Finding | the bench form and the shortfall are signed and cannot be left out or unseen (SM-36, SM-37) |

## 16. Assumptions, gaps, alternatives

- **Assumption.** The three measurement records are true as written; they were read, not repeated. Their numbers are of one interface on one afternoon under a load of 3.77 to 7.72 (MM3 s6).
- **Gap.** What the worker does with a pipe at about 90% was read in the code by the designer and by this review and run by nobody. HB-1 and HB-2 are this review's reading; the marker stand-in of row N3 settles both, and SM-30 (4) and SM-31 (2), (4) say what follows from either result.
- **Gap.** The sealing pipeline, the forwarder and the transcriber's sources were not read. SM-36 to SM-38 state what must hold; where it lives is the rows' to find, and the row verifies first whether a sealed reader pins the source-fact key list (review SM-18 (2), still open).
- **Gap.** The product's bound for the offset between sound and picture, against which the displacement is judged, was not looked up (the design did not either, its section 13).
- **Alternative rated and not taken: FAIL for the shortfall record as designed.** Its total is right and its four weaknesses are words of contract rows that are not yet cut; a FAIL would stop for the user a matter the user has already ruled on (U25) and that the controller's own sentence of C107 already frames. It becomes a FAIL under the three conditions of section 2.
- **Alternative rated and not taken: positions for EVERY inserted run in the manifest.** Of the order of ten a second (HB-2): tens of thousands of records an hour under the signature. Offered instead as a hashed side file, SM-30 (6), for the user to take or leave.
- **Alternative rated and not taken: renaming the role `STANDBY`.** It is a contract word of the start rule the user has fixed (U22 (2)); the operator's label and the signed capture group reach the same end without touching it.
- This row changed no source file, did not write `decisions/decisions.md` or a tracking file, and opened no device.

---
*Generated: 2026-10-13 18:42*
*Last Updated: 2026-10-13 18:42*
