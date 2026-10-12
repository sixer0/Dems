---
task_id: 2026-10-12_input_av_core_adapter_plan
row: 186
date: 2026-10-13
agent: coder-execution
tier: T2
subject: hardening of the relay's own RTSP client (candidate (a) of decision C38; fixes F-1 to F-9 of verification/06_security_relay_client.md, ordered by C39)
status: complete - 2 High, 6 Medium, 5 Low closed; 3 Low left with their reason (section 2); the user's ruling on C38 is still open and is not anticipated here
---

# Row 186: the relay's RTSP client, hardened and with adversarial evidence

Paths below are under `apps/capture-worker/` unless they begin with `docs/`. All runs: this Mac (arm64, Apple clang 21.0.0, libavformat 63.1.102), loopback only, command sandbox off, every build and run under `.locks/heavy-host.lock`, 2026-10-12 20:10 to 21:45 UTC.

## 1. What was built

| File | State | What |
|---|---|---|
| `src/relay/relay.h` | changed | the time bounds as one table (`:61-80`); `RelayAnswer`, `relay_head_parse`, `relay_wire_front` (the pure readers of the camera leg, `:206-232`); `relay_set_valid`, `relay_sets_valid`, `relay_step_plausible`; `relay_camera_progress`, `relay_camera_limit`; the test hook declaration |
| `src/relay/relay_core.c` | changed | the head reader and the framing moved here from the socket code (`:838-934`); stricter challenge, description and depacketiser (section 2) |
| `src/relay/relay_rtsp.c` | changed | absolute bounds asked on every loop turn (`turn`, `:122`), receive buffer read by an index, the open in one bound, the read loop bounded by complete pictures |
| `src/relay/relay.c` | changed | `sigaction`; the keyframe bound handed to the camera leg; parameter sets validated before the library's parser; recorded time held to this host's clock |
| `Makefile` | changed, additive | `relay-asan`, `relay-fuzz` (both inside `relay`, so inside `make`), `relay-fuzz-controls`; hardening flags of the relay's release build only. The worker's lines are untouched |
| `relay-check.sh` | changed, additive | rules H-2, M-1, M-3, HOOK, HARDEN with 11 new controls; the import net also holds the binary to its hardening |
| `test/relay_unit_test.c` | extended | 79 -> 376 checks: the 34 named cases as tables, the real camera leg on a socket pair |
| `test/relay_fuzz.c` | new | seven entry points, a seeded mutation driver |
| `test/relay_fuzz_controls.sh` | new | 16 planted flaws the fuzz build must find |
| `test-fixtures/rtsp_test_camera.py` | changed, additive | ONE opt-in switch `--adversary <mode>` with three parameters (`:423-475`, `:832-840`); default `none` |
| `test-fixtures/row186_bounds.py` | new | the time bounds, measured (23 runs) |
| `README.md` | one added bullet | |

**The relay's interface is unchanged**: the start message, the exit codes and their numbers, the three line kinds and their members, what is forwarded. Row 186 adds no probe mode, no retry, no report. Which code a hostile camera now gets, and where a well-behaved one could meet a new refusal: section 7.

**Edit rule kept.** Every existing file was changed with the Edit tool only; no scripted, generated or shell-appended change to a tracked file. New files were written with Write. The negative controls work on copies under `build/` (git-ignored) made by `sed`; `src/relay/` is never their target.

## 2. Each finding of the review: what changed, where, its test

| Id | Change | Where | Test |
|---|---|---|---|
| **H-1** no adversarial evidence | (1) sanitizer build of the unit checks and of the whole relay, warnings as errors, no recovery, in every `make`; (2) the 34 named cases, table-driven (section 3); (3) fuzz build, 14 s in every `make`, a longer run recorded (section 4); (4) negative controls for the unit checks (3) and for the fuzz build (16); (5) hardening flags on the release build, held on the binary. To reach the head reader and the framing without a socket they moved to the pure part (F-1) | `Makefile:95-155`; `relay_core.c:856` `relay_head_parse`, `:923` `relay_wire_front`; `relay_rtsp.c:320` test hook, `:42-59` sanitizer guard of the receive buffer | sections 3, 4, 6 |
| **H-2** the bounds are not bounds | every bound is an absolute time of the monotonic clock, asked on EVERY turn of every loop that reads the camera, before the read (`turn`); `wait_for` never sleeps past it; one bound for DESCRIBE, SETUP and PLAY together (15 s) besides the 5 s per answer; at most 8 messages that are not the awaited answer; playing: 5 s without a COMPLETE PICTURE (not "without a byte"), and the keyframe bound asked inside the read loop; the order to stop asked at least every 20 ms while bytes arrive (100 ms slices while none do); TEARDOWN has 0.5 s; the buffer is read by an index and moved only when the index passed its middle (amortised: never more is moved than was read since) | `relay.h:61-80`; `relay_rtsp.c:122` `turn`, `:133` `wait_for`, `:165` `drop`, `:174` `fill`, `:203` `next_message`, `:262`, `:331` `relay_camera_open`, `:372` `relay_camera_read`, `:425`; `relay.c:336`, `:366` | section 5 (23 measured runs, release and sanitizer build); unit: "600 KiB of frames through a 256 KiB buffer" (`relay_unit_test.c:941`), "nine are not" (skipped count); static rules H-2 with 3 controls |
| **M-1** the library reads camera bytes | each parameter set is held to its kind, forbidden bit 0 and a least length, where it is taken (description, stream) and again before the library's stream parser sees it; an invalid set ends with `STREAM_INVALID`. **What stays (stated for the design):** `av_parser_parse2` still reads the validated sets and the first keyframe, and the library's RTSP writer packetises every picture, in the process that holds the Digest key. Units are now of a valid type, each after a start code of the relay's own and none inside (M-2), but their CONTENT is the camera's. Removing the parser needs an own SPS reader: not done, as the review advises | `relay_core.c:463` `relay_set_valid`, `:478`; `relay.c:223` | unit `:730-747`; fuzz `check_sets`; static rule M-1 with its control |
| **M-2** what is forwarded is not validated | refused and counted, the picture not handed on: a forbidden bit (single unit, fragment, unit among several); an inner type that is no unit (H.264 0, 24-31; HEVC 48-63) in a fragment or among several; a start code INSIDE a unit (the picture must hold exactly the start codes the relay wrote); a unit cut by the next one. HEVC sets of the description are checked for types 32 / 33 / 34. Refusals are counted in `forms_not_taken`; after any picture that was not handed on the gate waits for the next keyframe | `relay_core.c:644` `refuse`, `:654` `unit_type`, `:660` `sound`, `:737` `cut`, `:743`; `relay.c:348` | cases 30 to 34 (55 rows); fuzz `check_picture`; controls `start_code_inside_a_unit_handed_on`, `fragment_type_that_is_no_unit_handed_on` |
| **M-3** the camera controls recorded time | one step may be ahead of this host's clock by at most 10 s more than the time that passed since the picture before; the whole stream by 10 s plus one hundredth of the time played; else `STREAM_INVALID` (was: up to 6.6 hours forward per picture) | `relay.h:80`; `relay_core.c:820`; `relay.c:260` | unit `:749-756` (7 checks); static rule M-3 with its control |
| **M-4** Digest toward a forged responder | F-7 as written: while playing, a 401 is renewed only when it is marked stale, for the same realm and hash, and the second refusal in a row ends the leg. Not built: a per-camera "SHA-256 only" (it would be a new member of the start message). The residual of Digest itself (S13-03: password length) is unchanged | `relay_rtsp.c:409` | unit `:968-976` (3 checks) |
| **M-5** Digest key in unlocked heap | the camera structure, which holds the key, is locked (best effort, as the start message) | `relay_rtsp.c:98` | by reading (an `mlock` has no observable effect in a test) |
| **M-6** "a refusal, never a cut" | more than 96 lines in the video section, more than 16 payload types, a parameter set beyond 1,024 bytes: `DESCRIPTION_INVALID` | `relay_core.c:570`, `:580`, `:487` | unit `:549-553`; case 20 |
| L-1 `nc` not restarted | the count starts again with a new nonce | `relay_rtsp.c:291`, `:411` | by reading; `nc=00000001` asserted after a challenge (`:883`) |
| L-2 a camera can force exit 70 | the request buffers hold every field at its bound with every character escaped; they are overwritten on every return | `relay_rtsp.c:227-256` | unit `:881` (1,536 quotes: answered, not code 70) and `:449-457`; fuzz `client` asserts no camera can cause `INTERNAL` |
| L-3 `atoi` on camera text | bounded digit readers; no library conversion is left on camera text | `relay_core.c:838`, `:847`, `:895` | unit `:324-336` |
| L-5 last Content-Length wins, trailing text | stated once, digits only (at most 6), else refused | `relay_core.c:881` | cases 6 to 9 |
| L-7 `signal()` | `sigaction` without restart | `relay.c:302-316` | the 10 SIGTERM runs of section 5 |
| **L-4 left** | several challenges on ONE header line, folded headers. It fails closed (`AUTH_SCHEME_NOT_ALLOWED`, asserted in case 17). Reading such a line is a parser extension of about 40 lines for an interoperability case no camera here has shown: hardware package | `relay_core.c:293` | case 17 row "a second scheme on the same line" |
| **L-6 left** | the descriptor loop. Measured: with the limit of this shell (1,048,576) the relay needs 0.38 s to start, 0.03 s at 65,536. The clean fix is `close_range` (Linux only, cannot be built here); a cap would weaken the hygiene. For row 79; a portable alternative is `poll` in blocks of 1,024 | `relay.c:121`, `:158` | measurement in this section |
| **L-8 left** | `relay-check.sh` stays a text search by nature. What proves is now beside it: sanitizers, fuzz, controls | - | - |

## 3. The 34 named malformed-input cases

The review names the areas and their counts (section 7 of the review: 5 + 4 + 8 + 5 + 4 + 3 + 5) and some cases by name; the full list below is this row's (driver decision 1). Every row runs on a heap copy of the input's exact length, in the plain and in the sanitizer build. `build/relay_unit_test_san --cases` prints this table.

| # | Case | Refusal asserted | Rows | Result |
|---|---|---|---|---|
| 1 | status line that is not `RTSP/1.0` | head refused -> `CAMERA_PROTOCOL` | 8 | PASS |
| 2 | status that is not three digits of 100 to 599 | head refused -> `CAMERA_PROTOCOL` | 9 | PASS |
| 3 | head with no end inside 8,192 bytes (also bare line feeds) | `CAMERA_PROTOCOL` | 7 | PASS |
| 4 | 0 byte inside the head | head refused -> `CAMERA_PROTOCOL` | 4 | PASS |
| 5 | session identifier or Content-Base beyond its bound, or not printable | head refused | 7 | PASS |
| 6 | Content-Length negative | head refused -> `CAMERA_PROTOCOL` | 4 | PASS |
| 7 | Content-Length beyond 65,536, or too long for any integer | head refused -> `CAMERA_PROTOCOL` | 5 | PASS |
| 8 | Content-Length that is no number, or text after it | head refused -> `CAMERA_PROTOCOL` | 8 | PASS |
| 9 | Content-Length stated twice | head refused -> `CAMERA_PROTOCOL` | 3 | PASS |
| 10 | challenge without a nonce or a realm | not readable (-1) | 4 | PASS |
| 11 | session variant of a hash, or an unknown hash | not answered (0) | 4 | PASS |
| 12 | integrity protection alone | not answered (0) | 3 | PASS |
| 13 | escapes in a quoted value; a backslash before the end | the characters themselves; not readable | 4 | PASS |
| 14 | quote that never ends | not readable | 3 | PASS |
| 15 | parameter stated twice | not readable | 6 | PASS |
| 16 | field of 513 bytes (512 is taken) | not readable | 12 | PASS |
| 17 | control byte in a value, name beyond 31 bytes, no equals sign | not readable | 6 | PASS |
| 18 | 0 byte inside the description | `DESCRIPTION_INVALID` | 3 | PASS |
| 19 | no video section, empty, beyond 65,536 bytes | `DESCRIPTION_INVALID` | 6 | PASS |
| 20 | parameter set beyond its bound (1,025 bytes; 2,048 characters) | `DESCRIPTION_INVALID`; a wrong kind is not taken | 10 | PASS |
| 21 | control value beyond 1,024 bytes | `DESCRIPTION_INVALID` | 3 | PASS |
| 22 | missing fields: no payload type, no rtpmap, a type that is no number | `CODEC_NOT_SUPPORTED` | 8 | PASS |
| 23 | frame with a length of 0 | dropped, counted, never handed on | 3 | PASS |
| 24 | frame of another channel | dropped, counted | 3 | PASS |
| 25 | length field beyond what arrives; the largest length | more is awaited (`CAMERA_LOST` at the end); 65,535 handed on whole | 6 | PASS |
| 26 | byte that begins neither a frame nor a message | `STREAM_INVALID` (playing), `CAMERA_PROTOCOL` (open) | 6 | PASS |
| 27 | packet shorter than 12 bytes, or not version 2 | `STREAM_INVALID` | 7 | PASS |
| 28 | source count or extension length beyond the packet | `STREAM_INVALID` | 6 | PASS |
| 29 | padding count 0, or beyond the packet | `STREAM_INVALID` | 5 | PASS |
| 30 | fragment without its start (H.264, HEVC) | no picture, counted as lost | 4 | PASS |
| 31 | fragment start without its end | no picture, counted as lost | 5 | PASS |
| 32 | aggregation size beyond the packet, or 0 | no picture; nothing read past the packet | 6 | PASS |
| 33 | reassembly without end | `STREAM_INVALID` at 8 MiB, memory at most 16 MiB | 2 | PASS |
| 34 | type that is no unit, forbidden bit, a start code inside a unit | refused, counted, not handed on | 38 | PASS |

Result line (plain and sanitizer build): `relay_unit_test: 376 checks passed; the 34 named malformed-input cases of review 06: 34 of 34 pass`.

Negative controls in `make relay-asan` (a copy of the sources with one bound removed must FAIL the sanitizer build): aggregation size not held to the packet (1 AddressSanitizer report: the exact-length copies do catch a read past the packet); a second Content-Length taken (3 failed checks); a start code inside a unit handed on (6 failed checks).

## 4. The fuzz build

| | |
|---|---|
| Tool | `test/relay_fuzz.c`: a deterministic, seeded mutation driver of its own. **libFuzzer is not available**: `clang -fsanitize=fuzzer` fails on this Mac (`libclang_rt.fuzzer_osx.a` not found). The entries also build as one libFuzzer target (`-DRELAY_LIBFUZZER`), NOT built or run here. No new dependency |
| Entry points | `head`, `wire` (framing and heads), `challenge` (with the Digest computation), `description` (with the address rules), `rtp` (both codecs), `client` (the REAL camera leg on a socket pair, then the picture collector), `start` |
| Oracle | AddressSanitizer and UndefinedBehaviorSanitizer on heap copies of exact length; in test builds the unread parts of the receive buffer are marked unreadable; and assertions of the bounds of `relay.h` on every result (for example: a picture handed on holds exactly the start codes the relay wrote and only valid unit types; no camera can cause exit `INTERNAL`) |
| Corpus | 51 valid and near-valid inputs written in the file; two generators (RTP trains, whole dialogues with frames, answers with a body at the bound); a pool of earlier mutants; 15 mutations |
| Every build | `make relay-fuzz`: 2 s per entry, seed 186. Final `make`: **1,311,680 inputs in 14.0 s, 0 failures** |
| One-off run | seed 186, 40 s per entry: **26,154,048 inputs in 280 s**; `client`, seed 20261013, 60 s: 337,024; `rtp`, seed 20261013, 30 s: 1,622,656. **Together 28,113,728 inputs in 370 s, 0 failures.** Logs: `.cache/row186/fuzz_long_*.log` |

**Crashes found: 1, fixed, turned into a regression case.**

| # | Found | What | Fix | Regression |
|---|---|---|---|---|
| 1 | entry `head`, seed 186, input 252,307 of the per-build run | `Transport: ...interleaved=<a number no integer holds>`: the reader converted with `strtol` (which returns the largest `long`) and added 1 for the second channel: signed overflow, undefined behaviour (UndefinedBehaviorSanitizer). In the code since row 41 (`relay_rtsp.c:186-187` of that state) | channels are read as one to three digits; no library conversion on camera text remains | `relay_core.c:847`, `:906`; unit `relay_unit_test.c:334` (6 inputs) |

**Does the fuzz build find what it is for?** `make relay-fuzz-controls`: 16 copies of the sources with one bound removed each. Result: `relay_fuzz controls: 16 of 16 planted flaws found by the fuzz build (seed 186, at most 20 s each)`; the slowest at input 6,297. The first version of the controls found 11 of 15, and that changed the build: a frame taken before it arrived read old bytes of the one receive buffer and no sanitizer saw it (now: the guard of `relay_rtsp.c:42-59`); bounds of long values were reached too rarely through the camera leg (now: runs of one byte as long as each bound and one more; answers with a body at the bound). One planted "flaw" was none (the source-count check is covered by the checks after it) and was replaced.

## 5. The time bounds, measured

`test-fixtures/row186_bounds.py all`, against the test camera's `--adversary` modes. Each time runs from an event the CAMERA states to the relay's process being gone. Result lines: `ROW186 BOUNDS (capture-relay): 23 run(s), 23 PASS, 0 FAIL` and `ROW186 BOUNDS (capture-relay-san): 23 run(s), 23 PASS, 0 FAIL` (the sanitizer build of the whole relay, 0 sanitizer reports).

| Phase | What the camera does | Bound | Measured, release (sanitizer build) | Exit |
|---|---|---|---|---|
| one answer | answers in single bytes, one every 99 ms | 5 s | 5.006 s (5.012) | `CAMERA_STALLED` |
| one answer | frames in the place of the answer: 1,642 MB in the 5 s | 5 s | 5.002 s (5.005) | `CAMERA_STALLED` |
| one answer | takes the connection, says nothing | 5 s | 5.057 s from the start of the relay's process (5.083) | `CAMERA_STALLED` |
| DESCRIBE, SETUP, PLAY together | every answer 4.5 s late | 15 s | 15.007 s (15.011) | `CAMERA_STALLED` |
| first keyframe | pictures at 25 a second, never a keyframe | 60 s | 60.005 s (60.011) | `KEYFRAME_TIMEOUT` |
| playing | a video packet in single bytes | 5 s | 5.008 s (5.013) | `CAMERA_STALLED` |
| playing | flood of empty frames and frames of another channel: 927 MB | 5 s | 5.002 s (5.004) | `CAMERA_STALLED` |
| playing | flood of RTP packets of another payload type: 1,022 MB | 5 s | 5.002 s (5.004) | `CAMERA_STALLED` |
| playing | silence | 5 s | 5.007 s (5.010) | `CAMERA_STALLED` |
| playing, push open (worker, live session) | 100 pictures, then the flood | 5 s after the last picture | 4.965 s after the flood began (4.960) | `CAMERA_STALLED`; file: 75 pictures (= 100 - 25 the worker drops), 0 decode errors |
| reassembly | units of one time stamp, never the mark | 8 MiB per picture | ended after 8.6 MB, in 0.006 s; most memory of the process 17.8 MiB (43.8 with sanitizers) | `STREAM_INVALID` |

**The order to stop, 1 s into the camera's behaviour** (stated bound: seen within 0.02 s while bytes arrive, 0.1 s while none do; gone within 0.6 s, or 2.6 s with a push open):

| During | Standard input closed | SIGTERM |
|---|---|---|
| flood in the place of an answer | 0.021 s | 0.021 s |
| answer in single bytes | 0.031 s | 0.003 s |
| flood while playing (other channels, empty frames) | 0.015 s | 0.014 s |
| flood of packets of another payload type | 0.003 s | 0.003 s |
| video packet in single bytes | 0.042 s | 0.003 s |
| flood while playing, push open, worker recording | 0.014 s; file 75 pictures, 0 decode errors | 0.012 s; the same |

All exit 0 `STOPPED`. The largest over both builds: 0.045 s.

**Honest limits of these numbers.** A flood costs one core for as long as it lasts (5.02 s of processor time in a 5 s flood): the relay reads what arrives, up to 328 MB a second here; the bound limits the time, not the rate. The 5 s of the CONNECT itself is not measured: loopback of this Mac refuses at once what it does not take (400 attempts against a full queue), so a connection that never completes cannot be made without a real unreachable address: hardware package. The bounds are compiled constants; no build can change them (static rule: no `-DRELAY_` in the relay's flags).

## 6. Everything that passed still passes

| Check | Command (repository root, under the lock) | Result |
|---|---|---|
| Whole build | `make -C apps/capture-worker` | `make rc=0`; `check.sh: src: static rules OK`; 107 `refused as required` lines = the worker's 75 as before + the relay's 32 (21 before); `relay_unit_test: 376 checks passed` twice (plain, sanitizers); 3 unit controls fail as required; fuzz line of section 4; `relay-check.sh: build/capture-relay: import net OK` |
| Worker untouched | `git diff --stat -- apps/capture-worker/check.sh apps/capture-worker/src/*.c apps/capture-worker/src/*.h apps/capture-worker/test/static` | empty |
| Relay, adapter level | `row041_relay.py all` | `ROW41 RELAY: 28 run(s), 28 PASS, 0 FAIL` |
| Gate | `row58_gate.py all` | `ROW58 GATE: 12 run(s), 12 PASS, 0 FAIL` |
| Camera end | `row176_camera_end.py all` | `ROW176 CAMERA END: 6 run(s), 6 PASS, 0 FAIL` |
| Log hygiene | `row175_log_hygiene.py repeat`, then `scan` | rc 0; `ROW175 LOG HYGIENE: 14 run(s) scanned, 14 PASS, 0 FAIL; path text in any worker log: 0` |
| Test camera, base | `rtsp_test_camera_check.py --port 8570 --runs 3` | `BIND RULE ... no_address_option=True`; `RESULT PASS  runs 12  passed 12  listener_left []` |
| Test camera, faults | `... --suite faults --port 8570 --runs 3` | `RESULT PASS  suite faults  runs 42  passed 42  listener_left []` |
| Bounds | section 5 | 23 of 23, twice |
| Fuzz controls | `make -C apps/capture-worker relay-fuzz-controls` | 16 of 16 |
| Left behind | `lsof` listeners on 8554-8574; `pgrep` | 0; none |
| Secret scan | `node scripts/secret-scan/count-only.mjs` on the changed sources and the three run folders | `TOTAL: 0 in 0 file(s)` |

Hardening flags of the release build. Set, accepted by this Mac's clang: `-U_FORTIFY_SOURCE -D_FORTIFY_SOURCE=2`, `-fstack-protector-strong`, `-fPIE`. On the binary: imports `___stack_chk_fail`, `___stack_chk_guard`, `___memcpy_chk`; `otool -hv`: `PIE`. **Could not be set for both toolchains:** `-pie` (Apple clang: "argument unused during compilation", an error under `-Werror`) and `-Wl,-z,relro,-z,now` (ELF linkers only). Both stand in a Linux-only line of the Makefile and are unproven until row 79, as is every statement about Ubuntu's clang (no Linux host was used).

## 7. What other rows see (the interface is the same; the reasons for a code are wider)

| Code | Now also when |
|---|---|
| `CAMERA_STALLED` (31) | DESCRIBE, SETUP and PLAY take more than 15 s together; a playing camera completes no picture for 5 s although bytes arrive |
| `CAMERA_PROTOCOL` (21) | a first line that is neither an RTSP/1.0 answer nor a request; a 0 byte in a head; Content-Length twice or with text after it; more than 8 messages that are not the awaited answer |
| `DESCRIPTION_INVALID` (27) | more than 96 lines or 16 payload types in the video section; a parameter set beyond 1,024 bytes |
| `STREAM_INVALID` (33) | a time step more than 10 s ahead of this host's clock; parameter sets that are not valid ones |
| `AUTH_REFUSED` (23) | a 401 to a keep-alive that is not marked stale |
| counter `forms_not_taken` | also counts refused units (forbidden bit, a type that is none, a start code inside) |

Where a WELL-BEHAVED camera could meet one of these, for the hardware package: a camera that answers an expired nonce on a keep-alive without `stale=true` (M-4; one condition at `relay_rtsp.c:409` if the user prefers interoperability); a camera whose RTP time jumps more than 10 s forward; a camera that pads units with a trailing `00 00 01`.

## 8. Unproven here

- A real camera with this client (unchanged from row 41, section 8), plus the three points of section 7.
- Linux: the sanitizer and fuzz builds, the hardening flags, the `readelf` branch of the hardening check, `-pie` and relro: rows 79, 141.
- The connect bound (section 5). libFuzzer (section 4).
- Coverage of the fuzz run is not measured (no coverage runtime in this toolchain); the 16 controls are the evidence that the readers are reached.

## 9. Driver decisions (for the controller to confirm)

1. **The list of the 34 cases** is this row's enumeration inside the review's areas and counts.
2. **"Playing" is bounded by complete pictures**, not by bytes or packets: only that cannot be extended by a camera.
3. **Constants**: open 15 s; stop asked every 20 ms; TEARDOWN 0.5 s; 8 skipped messages per answer.
4. **M-3 rule**: a step at most 10 s ahead, the whole stream 10 s plus 1 per cent; `STREAM_INVALID`.
5. **F-7 built as written** although the review calls it optional (section 7 names its interoperability cost).
6. **M-2 beyond the review's fix line**: a start code inside a unit is refused; a fragment cut by the next unit loses its picture; the gate closes after ANY picture that was not handed on.
7. **Bounds of the description**: an oversized parameter set refuses the description; one that is not readable or of the wrong kind is only not taken.
8. **A repeated challenge parameter** makes the challenge not readable.
9. **A test hook lives in the product source** (`RELAY_TEST_HOOKS`: the camera leg on a test's descriptor, the sanitizer guard of the buffer), in three named places, refused in the relay's flags and in its binary by `relay-check.sh`.
10. **`-pie` and relro are Linux-only lines** of the Makefile, since this Mac's toolchain refuses them.
11. **The camera's switch is `--adversary`**, not `--hostile`: a longer spelling of `--host` made the camera's own bind-rule check fail (found by the base suite, fixed before the final runs).
12. **Regression inputs are C arrays in the unit test**, not binary files: `test/relay_fuzz_corpus/` of this row's claim was not created.

## 10. Requests

None in `file_requests.md`.

---
*Generated: 2026-10-13 04:50 (local)*
