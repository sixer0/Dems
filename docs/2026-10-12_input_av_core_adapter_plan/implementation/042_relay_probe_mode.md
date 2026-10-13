---
task_id: 2026-10-12_input_av_core_adapter_plan
row: 42
date: 2026-10-13
agent: coder-execution (batch 7, agent W)
tier: T3
work_package: WP-03c
requirement: AD-06 (3) (the probe report is a frame of fixed shape and bounded size, with a stated maximum for the parameter-set bytes); AD-06 (1), (2) (the relay's part: it reports facts, no text of the camera); S13-01 (b) probe mode (Digest only); S13-06 = RC-3 (i) ("push established" defined and reported); S13-02 (a), (d) for the new output; C37 (the report carries its attempt)
status: complete on this Mac's doubles. The relay's RTSP client stays a CANDIDATE (decisions C38, C39): nothing of this row leans on its internals
---

# Row 42: the relay's probe mode and the report "push established"

Paths are under `apps/capture-worker/` unless they begin with `docs/`.

## 1. What was built

| File | State | What |
|---|---|---|
| `src/relay/relay.h` | changed | `RelayMode`, `RelayStart.mode`, `.attempt`; `RelayDescription.rate_milli`; `RelayProbe`, `relay_established_line`, `relay_probe_line`; bounds `RELAY_ATTEMPT_MAX`, `RELAY_SIDE_MAX`, `RELAY_RATE_MILLI_MAX`, `RELAY_REPORT_MAX`; code 43 `RELAY_REPORT_NOT_WRITTEN`; header text "THE TWO MODES AND THE ONE REPORT LINE" |
| `src/relay/relay_core.c` | changed | the start message: two modes and the member `attempt` (`attempt_of` `:202`, the closed set per mode `:259-266`); the stated rate of a description (`rate_of` `:576`, taken once `:664`); the two report lines (`:668-727`). Pure: no descriptor, no clock |
| `src/relay/relay.c` | changed | `report` (`:92`), the ONE writer of standard output, bounded; `stream_facts` (`:238`), what both modes read of the stream; `probe_report` (`:252`); in `main` the place where the modes part (`:397`) and the established report (`:407`) |
| `relay-check.sh` | changed | the rule "nothing on standard output" is replaced by six lines (S13-02, AD-06, S13-01), with 2 planted lines and 2 mutations |
| `test/relay_unit_test.c` | extended | 376 -> 590 checks |
| `test/relay_fuzz.c` | extended | an eighth entry point `report`; new assertions in `start` and `description`; 10 new corpus inputs |
| `test/relay_fuzz_controls.sh` | extended | 16 -> 22 planted flaws |
| `test-fixtures/row042_probe.py` | new | the adapter-level runs (21) |
| `test-fixtures/row041_relay.py` | changed, 2 places | its criterion "nothing on standard output" in a session run is now "the one report line when the push was opened, else nothing" (it could not stay true by design of this row); one fact added |
| `Makefile`, `README.md` | comment and text | counts (eight entry points, 22 controls); one bullet |

**Not touched**: `src/relay/relay_rtsp.c` (the candidate client: 0 lines changed), the worker's sources, `rtsp_test_camera*.py`.

## 2. The interface, as other rows see it

**Start message.** One line as before (`docs/.../implementation/041_relay_record_mode.md`, section 3). New:

| Mode | Members (closed set; any other, a repeated one, a missing one: `START_MESSAGE_INVALID`) |
|---|---|
| `"mode":"record"` | `type`, `mode`, `ingest`, `access`; optional `attempt` |
| `"mode":"probe"` | `type`, `mode`, `access`; optional `attempt`. **An `ingest` member is refused**: a probe pushes nothing and is given no session address |

`attempt` is a JSON number: digits only, no sign, no leading 0, no fraction, no exponent, 1 to 999,999,999. Absent: the reports say `"attempt":0` ("not stated"). The messages of today (no `attempt`) are taken unchanged.

**Standard output: at most ONE line, then nothing.**

```
record  {"report":"push_established","v":1,"attempt":<n>}
probe   {"report":"probe","v":1,"attempt":<n>,"codec":"H264"|"HEVC","width":<n>,"height":<n>,"rate_milli":<n>,"sets_in_description":true|false,"sets_in_stream":true|false,"vps":"<hex>","sps":"<hex>","pps":"<hex>"}
```

| Property | Value |
|---|---|
| Shape | the members above in this order, no blank, one line feed last; characters of the set `{}":,_`, digits, lower-case letters and `H E V C` only |
| Size | at most `RELAY_REPORT_MAX` = 6,400 bytes. The largest line there can be is 6,332 bytes (unit check). **The stated maximum of the parameter-set bytes: 1,024 bytes each (`RELAY_PSET_MAX`), 2,048 hexadecimal characters** |
| `codec` | one of two words of the relay (its enumeration), never the camera's text. Per AD-06 (1) the Core does not trust it either: it decides the profile from the bytes |
| `width`, `height` | 1 to 16,384, read by the library's stream parser from the validated sets and the first keyframe (as record mode does before it announces) |
| `rate_milli` | the `a=framerate` of the description's video section in thousandths (25 -> 25000), 1 to 1,000,000; 0: not stated, stated twice, or not readable. The stream is not measured |
| `sets_in_description` / `sets_in_stream` | complete sets stood in the description / came in the stream before the first keyframe |
| `vps`, `sps`, `pps` | the sets the size was read with, each valid for its kind (`relay_sets_valid`); lower-case hexadecimal; `vps` empty for H.264 |
| Never in a line | an address, a path, an account, a text of the description, of the library or of the start message. No function that makes a line takes a text |

**"Push established"** (S13-06, RC-3 (i)) is written when `avformat_write_header` returned success - the worker answered OPTIONS, ANNOUNCE, SETUP and RECORD - and the relay's own socket check passed; before the first picture is written. It is the relay's half of the pairing. It does NOT say that the worker's gate took the push: a worker that answers RECORD and then refuses is told apart by the worker's own frame (shown in section 4, last run).

**Probe mode**: the same `relay_camera_open` (one call for both modes, held by a static rule), the same keyframe gate; at the first keyframe with complete sets it reports and ends with code 0, TEARDOWN to the camera, no push, no connection to any ingest. **Exit 0 without a line means "stopped before the answer"**, never "probed" (run `probe_stopped_before_the_keyframe`). The marks on standard error gain one event, `probe_reported`.

**Exit codes**: unchanged numbers; one added, 43 `REPORT_NOT_WRITTEN` (the line could not be written within 5 s: the write is non-blocking and bounded, so a reader that does not take it cannot hold the relay).

## 3. Why the probe and report logic is not entangled with the RTSP client (C38, C39)

- Both lines are made in `relay_core.c` from a struct of numbers and a pointer to validated sets. `relay_rtsp.c` has no diff.
- `relay.c` reaches the camera only through the interface of `relay.h` that row 41 defined (`relay_camera_new`, `_open`, `_read`, `_progress`, `_limit`, `_close`); probe mode adds no call.
- If the user rules for another client, the description reader that fills `rate_milli` and the sets moves with that client's replacement; the report functions, the writer, the start-message rules, the unit rows, the fuzz entry `report` and the fixture stay as they are.

## 4. Checks (this Mac, libavformat 63.1.102; 2026-10-13; loopback only; sandbox off; every build and run under `.locks/heavy-host.lock`, one hold per command)

| Check | Command (repository root) | Result |
|---|---|---|
| Whole build | `make -C apps/capture-worker` | `make rc=0` (`.cache/row042/make_1.out`); relay rules OK, 36 relay controls refused (32 before); `relay_unit_test: 590 checks passed; the 34 named malformed-input cases of review 06: 34 of 34 pass`, twice (plain, sanitizers); 3 unit controls fail as required; `relay_fuzz: 1352192 inputs over 8 entry point(s) in 16.0 s, seed 186: 0 failures`; `relay-check.sh: build/capture-relay: import net OK` |
| Fuzz controls | `make -C apps/capture-worker relay-fuzz-controls` | run 1 and 2: 21 of 22 (my control of the attempt did not COMPILE under `-Werror`; the control was rewritten, the relay was not); run 3: `relay_fuzz controls: 22 of 22 planted flaws found by the fuzz build (seed 186, at most 20 s each)` |
| Probe, refusals, start | `row042_probe.py probe`, `refused`, `start` | run 1: 12 of 18 (one criterion of the new fixture named the camera's Digest class wrongly; the relay's output was right in all six); run 2: 18 of 18 |
| Record with the worker | `make ... proof`, then `row042_probe.py record` | 3 of 3; summary `ROW42 PROBE: 21 run(s), 21 PASS, 0 FAIL; probe runs 10, requests of the Basic scheme received by the camera in them: 0` |
| Record mode as before | `row041_relay.py all` | `ROW41 RELAY: 28 run(s), 28 PASS, 0 FAIL` |
| Time bounds as before | `row186_bounds.py all` | `ROW186 BOUNDS (capture-relay): 23 run(s), 23 PASS, 0 FAIL` |
| Secret scan | `node scripts/secret-scan/count-only.mjs` on `src/relay`, the two test files, the fixture, `.cache/row042-probe` | `TOTAL: 0 in 0 file(s)` |

**The row's verification cell.**

| Cell statement | Evidence |
|---|---|
| The probe reports codec, picture size and parameter-set bytes for the H.264 and the HEVC fixture | 4 runs (each codec, sets in the description and in the stream) plus 2 (no attempt stated; Basic and Digest offered): exit 0 in 0.04 to 0.5 s; one line of 233 to 322 bytes; `codec` `H264` / `HEVC`; 1920 x 1080; `rate_milli` 25000 (the camera's description states 25); `sets_in_description` / `sets_in_stream` true / false with the sets in the description and false / true with the sets in the stream. **The parameter-set bytes equal, byte for byte, the sets of the clip the camera sends**, read by the camera's own reader (H.264: SPS 25 and PPS 4 bytes; HEVC: VPS 24, SPS 43, PPS 6). No push opened, 0 pictures forwarded, the camera got a TEARDOWN |
| `Authorization: Basic` requests in 2 probe runs: 0 | `probe_basic_only_run_1`, `_2`: exit 22 `AUTH_SCHEME_NOT_ALLOWED`, standard output 0 bytes, the camera received 1 request, of class `none`. Over all 10 probe runs: 0 requests of the Basic scheme; with Basic and Digest offered the four requests carry Digest |

Further cases:

| Case | Result |
|---|---|
| Wrong password, probe | exit 23 `AUTH_REFUSED` after one refused Digest answer; no line |
| The order to stop before the keyframe | exit 0, 0 bytes on standard output, gone 0.04 s after the input closed |
| Start messages that are not the contract | a probe with an ingest address, attempt 0, an attempt as text, negative, 10 digits; a record with a fractional attempt: exit 10 each |
| A description whose codec name, session name and rate are 300 characters of lower-case markup (AD-06 (5), the relay's part) | exit 28 `CODEC_NOT_SUPPORTED`, 0 bytes on standard output, every line of standard error has only the fixed members |
| Record, attempt 7 | standard output is exactly `{"report":"push_established","v":1,"attempt":7}` and a line feed; the worker reports the connect once; file 125 pictures; every criterion of row 41's record run holds |
| Record, the relay announces a near miss of the plan's address | the worker's gate refuses (`CAMERA_ANNOUNCE_NOT_MATCHED`); relay exit 40 `INGEST_REFUSED`; **nothing on standard output**; the control camera records |
| Record against the proof worker whose gate sees no line | the worker answers RECORD, then refuses: the relay DID report (`attempt` 9), then exit 41 `INGEST_LOST`; worker frames `CAMERA_ANNOUNCE_NOT_SEEN`, nothing recorded. This is the stated limit of "established": the pairing's half (ii) is missing, and by C35 (b) / C40 the Core treats it as such |
| No text of the session in any output | password, account, locator, stream path, ingest address, its last element: 0 occurrences in standard output and standard error of all 21 runs |

**New readers and output paths, their malformed-input rows** (unit test, plain and sanitizer build, inputs on heap copies of exact length):

| Path | Rows | Examples |
|---|---|---|
| mode and `attempt` of the start message | 7 taken, 27 refused | probe with an ingest address; a mode in another case; attempt 0, negative, leading 0, fraction, exponent, 10 digits, 38 digits, a letter after it, a string, `true`, `null`, no value, `+3`, `0x10`, twice, as the last byte, inside `access`; of every refused message nothing is kept |
| the stated rate | 28 values, 20 cut lengths | 29.97, 0.001, 1000; refused to "not stated": 0, 1000.001, five digits, 32 digits, four places, `25.`, `.5`, negative, `25fps`, a leading blank, empty, two points, an exponent, 300 characters of markup, stated twice, stated outside the video section |
| the established line | 6 and one per room size | exact text; negative and too large attempt; every room from 1 byte to 4 beyond the line: no line and a 0 first byte, or the whole line |
| the probe line | 3 exact, 43 room sizes, 19 refusals (18 values, 1 for no report or no buffer) | exact text for H.264 and HEVC; bytes of a set that would be a quote or a line feed appear as hexadecimal only; the largest line (6,332 bytes) into rooms around its size; no codec, a width of 0 / negative / 16,385, a rate of -1 / beyond, sets that are not complete, not valid, beyond their bound, of negative length, HEVC named with H.264 sets |

Fuzz: entry `report` makes both lines from values of any size into a heap block of any size and asserts "no line and nothing in the room, or a line of the fixed shape that says exactly what it was given"; `start` asserts mode, attempt and "probe keeps no ingest address"; `description` asserts the rate's bound and that every description with complete sets makes a probe line. The six new controls (digit bound of the attempt, digit bound and range of the rate, room of the hexadecimal and of a word, sets not validated) are each found, the slowest at input 36,257.

## 5. Doubles, and what stays unproven

- Doubles: the test camera `rtsp_test_camera.py` (1920 x 1080, 25 pictures a second, Digest; its description states `a=framerate:25`), a raw one-connection double for the hostile description, the release worker and the proof worker `capture-worker-noannounce`. No real camera.
- Unproven: a real camera's description (no `a=framerate`, or one in another form: the rate is then 0 and the Core must not invent one - C36); a camera whose sets change between a probe and a recording; picture sizes other than 1920 x 1080; a probe against a camera that needs longer than the adapter's bound for its first keyframe (the relay's own bound is 60 s); the report through the real production door and its 64 KiB buffers (a socket pair in Node: the non-blocking write was run against Python pipes only); everything on Linux. Hardware package: `9A/H-10` to `H-12`, `H-17` (the 5 s pairing bound with a real relay and worker), `H-21` to `H-23`.
- A frame SCHEMA on the Core's side (AD-06 (3): "checked by a schema as the worker's frames are") is not this row's file: the shape above is what it has to hold. Request line filed.

## 6. Left to the named rows

| Row | What |
|---|---|
| 43 | re-open by the retry rule; whether a re-open reports "push established" again (today: one announce, one report, per process); `LOCATOR_NOT_FOUND` for a probe of a missing path already ends with code 24 |
| 44 | E-12 over all outputs in three failure runs with the report line present; survivors after a killed parent |
| 46 / 47 / 48 | the adapter sends `attempt` in the start message and reads standard output as ONE line against the shape above; a report with attempt 0 is "not stated" (C37: a superseded attempt is dropped, a never-issued one is the mismatch); one notice, not two, when a gate refusal and a pairing end meet (C40) |
| 29 / 50 (WP-05) | the minted profile from `sps` / `pps` / `vps` by the Core's own parse; `codec` of the line is a hint only; `rate_milli` 0 is "not stated" |
| 59 | the whole e2e series is not touched by this row (the relay is not part of it) |
| 178 | - |

## 7. Driver decisions (for the controller to confirm)

1. **`attempt` is an optional member** of the start message, in both modes; absent is reported as 0. Chosen so that the start messages of rows 41 / 46 as built are still taken. If the Core wants it required, it is one condition in `relay_start_parse`.
2. **Probe mode takes no `ingest` member and refuses one.**
3. **"Established" = the worker answered RECORD with success**, written before the first picture (RC-3 (i) as worded). The relay cannot know the gate's verdict; the last run of section 4 shows the consequence.
4. **The report is JSON text of a fixed order and a closed character set**, key `report` (the marks on standard error keep the key `relay`), version member `v` 1.
5. **Sets in hexadecimal**, lower case; the stated maximum is `RELAY_PSET_MAX` 1,024 bytes each; the line bound 6,400 bytes.
6. **The rate is the description's statement only** (`a=framerate` of the video section, once); never measured, never read from the sets.
7. **One new exit code, 43 `REPORT_NOT_WRITTEN`**; the write of the line is non-blocking with the 5 s bound (the relay sets `O_NONBLOCK` on its standard output when it reports).
8. **Exit 0 for a finished probe** (code word `STOPPED`); the line is what says "probed".
9. **`row041_relay.py` was edited in two places** (the criterion that this row makes false by design); declared in the closing line of `file_claims.md`.
10. **The record-mode line carries the attempt only**, not the stream's facts; if the Core wants the sets at a recording start as well (C36), the probe line's members can be added to it behind the same functions.

## 8. Requests

Two lines in `delegation_progress/file_requests.md` (none blocking): to rows 46 / 147 (the member `attempt`; a probe message without `ingest`), and to the row that owns the Core's frame schemas (a schema for the two lines).

---
*Generated: 2026-10-13*
