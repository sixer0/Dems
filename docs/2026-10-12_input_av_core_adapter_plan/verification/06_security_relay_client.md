---
task_id: 2026-10-12_input_av_core_adapter_plan
document: verification/06_security_relay_client.md
date: 2026-10-13
agent: security-review
subject: the relay's hand-written RTSP client (decision row C38, candidate (a))
method: static reading only; nothing was compiled, started or bound
status: complete
---

# Security review: the relay's own RTSP client (C38, candidate (a))

## 1. Verdict and recommendation

**Verdict for (a) as built: ACCEPTABLE WITH THE LISTED FIXES.** It is not acceptable for a real camera in its present state.

**Recommendation: (a), after fixes F-1 to F-9 of section 8, with (c) as the fallback.**
Candidate (a) is the only option that holds "Digest only" (S13-01) and "never to another host" (AD-05 (3)) by construction, keeps the password out of every address, and holds only the Digest key after the first challenge; one full reading of its 1,688 lines found no memory-safety flaw.
What it lacks is evidence, not design: no fuzzing, no sanitizer build, no test of the framing and header reader at all, and time bounds that a camera can defeat, all of which are fixable at size M.
This runs against the user's standing preference for ready-made components; if that preference governs, take (c), not (b): (b) does not close the case S13-01 was written for (section 9).

Counts: 2 High, 6 Medium, 8 Low. None of the High findings is a demonstrated memory-safety flaw.

## 2. Frame (5W1H) and limits

| | |
|---|---|
| What | `apps/capture-worker/src/relay/relay.h` (186 lines), `relay.c` (357), `relay_rtsp.c` (415), `relay_core.c` (730); `relay-check.sh`; `test/relay_unit_test.c`; the relay lines of the `Makefile` (70-96) |
| Why | C38: the row 41 agent built an own client instead of stopping for the user (S13-01 (c); addendum section 10 item 4). The user decides among (a) to (d) on evidence |
| Who is affected | the evidence host: the relay runs as the Core's user and holds the camera account |
| Threat model | the camera, or anyone who can answer at its address on the camera LAN, is hostile. A memory-safety flaw is code execution as the Core's user |
| How | every function that touches camera bytes was read in full, each length traced to its bound; the Digest computation compared with RFC 2617 / 7616; the tests read against the list of the request |
| When | 2026-10-13, branch `task4/input-av-core-port`, working tree as found |

Limits, stated once:

- **Static reading only.** The compiler-warning build was skipped: `.locks/heavy-host.lock` was held (`lockf -t 0`: "already locked", rc 75). The record of row 41 reports the build clean with `-Wall -Wextra -Werror`; that was not repeated here.
- One reader, one pass. "No flaw found" is not "no flaw": that gap is finding H-1.
- libavformat and libavcodec sources were not read. Every statement about their inside is marked **hypothesis**.
- `test-fixtures/row041_relay.py` was read in its case list (lines 370-410), not in full.

## 3. High findings

### H-1. No adversarial evidence for code whose failure is code execution

- `Makefile:74`: `-std=c11 -D_DEFAULT_SOURCE -O2 -g -Wall -Wextra -Werror`. No sanitizer in any build, no `_FORTIFY_SOURCE`, no stack-protector flag, no PIE / RELRO / `-z now` flag. `CC := clang` (`Makefile:42`); whether Ubuntu's clang turns any of these on by default is a hypothesis (experiment: `checksec` or `readelf -lW` on the Linux binary, row 79).
- No fuzz target exists in `apps/capture-worker` (search for `fsanitize`, `FORTIFY`, `stack-protector`, `libFuzzer`: 0 lines).
- `Makefile:89`: the unit build compiles `relay_core.c` only. **`relay_rtsp.c` has no unit test**: the head reader (`relay_rtsp.c:149-201`), Content-Length (`:166-170`), the interleaved framing (`:209-214`, `:360-373`) and the head search (`:217-220`, `:379-380`) are exercised only by well-formed answers of the test camera and by three raw-double runs (redirect, foreign control address, Digest then Basic).
- Coverage of the cases named in the request (section 7): about 8 of 34 have a test with malformed input; 0 of the 16 header, Content-Length, framing and RTP-header cases.
- Fix (F-1, F-2): section 8.

### H-2. The time bounds are not bounds; a camera can hold the relay, spin it, and make it deaf to the stop order

- `relay_rtsp.c:93-102`: `wait_for` looks at the deadline (`:100`) only after a 100 ms slice passed with nothing ready; `:98` returns as soon as the socket is ready. `fill` returns after any byte (`:125`). A camera that sends one byte every 99 ms never meets the "5 s per answer" bound that `relay.h:57` and the row 41 record (section 3, "every wait is bounded") state.
- During the open this is unlimited, not only slow: interleaved frames before an answer are dropped and the loop continues (`relay_rtsp.c:209-214`), and messages with another CSeq are skipped (`:263-266`). Neither path has a count or a clock. The keyframe bound does not run yet (`relay.c:311`).
- While playing: frames of another channel and zero-length frames are dropped with `continue` (`relay_rtsp.c:364-372`). The stop order is asked once per call (`:350`), the keyframe bound only after a video packet came back (`relay.c:341`), the silence bound is renewed by every byte (`:125`). A camera that sends only such frames keeps the relay in this loop for ever with no code.
- If it sends them fast, `recv` never blocks, so `wait_for` (the only other place that asks for the stop) is never reached: the relay ignores the end of standard input and SIGTERM (`relay.c:85`, the flag is read only in `stop_asked`). `drop` moves the whole buffer per frame (`relay_rtsp.c:133-136`): 4-byte frames in a 256 KiB buffer cost about 8 GB of copying per buffer, one core at 100 %.
- Effect: availability only. One hostile camera occupies one core of the evidence host and a relay that only SIGKILL ends. The door offers the kill (`production-door.ts:168`); the adapter that calls it at a bound is row 46, not built.
- While the open is held, a camera that never challenges also keeps the password in memory (`relay.c:305` runs only after the open returns).
- Fix (F-3): one absolute deadline per answer checked on every loop turn; a wall-clock bound on the whole open; the stop order and the keyframe bound checked on every loop turn of `relay_camera_read`; a read index instead of `memmove` per frame.

## 4. Medium findings

| Id | Finding | Evidence | Fix |
|---|---|---|---|
| M-1 | **The library does read camera bytes.** libavcodec's H.264 / HEVC stream parser runs on camera-chosen parameter sets and the first keyframe, in the process that holds the Digest key; the library's RTSP writer then builds its description from the same bytes and packetises every picture. "The library never reads the camera" is true of the demuxer only | `relay.c:192-209` (`av_parser_parse2`), `:226-229`, `:260` | F-4: validate each parameter set before the library sees it (type byte, length floor); state the remaining surface in the design. Removing the parser needs an own SPS reader, which is more hand-written code: not recommended |
| M-2 | **What is forwarded is not validated.** The relay guarantees form only: each unit follows a start code and has its header bytes. Not checked: the forbidden bit, the inner type of a fragment (any value 0-31 / 0-63 becomes a unit header, `relay_core.c:649-650`, `:666-667`), start codes inside a unit, the type of an HEVC set from the description (`relay_core.c:495-497`, H.264 is checked at `:488-489`). The worker must stay robust (residual 4 of `05_security_branch_b.md:151` is unchanged) | as cited | F-5: refuse inner types that are not a unit (H.264 0, 24-31; HEVC 48-63), check HEVC set types 32 / 33 / 34, count refusals |
| M-3 | **The camera controls recorded time.** Each picture moves the clock by the camera's stamp difference, up to 2^31 ticks (about 6.6 hours) forward per picture; backward becomes +1 tick | `relay.c:249-252` | F-6: a plausibility bound on one step (for example 10 s) ending with `STREAM_INVALID`, or a ruling that the worker's anchor governs |
| M-4 | **Digest toward a forged responder.** The first realm and every nonce are the responder's choice; the "strongest" hash is the strongest *offered* (`relay_rtsp.c:194`), so MD5 is always available to an attacker; alternating 401 / 200 on keep-alives yields a fresh answer to a chosen nonce every keep-alive period (`:387-390`, minimum 2 s by `:338`). Each answer supports offline guessing of the password. Inherent to Digest (S13-03), not a flaw of this client, but it is the residual of "Digest only" | as cited | F-7 (optional): end the leg on the first 401 while playing unless it is marked stale; a per-camera setting "SHA-256 only" for models that offer it. Otherwise S13-03 (c): password length |
| M-5 | **The Digest key is in unlocked heap for the life of the process.** It authenticates to that realm like the password. `mlock` covers the start structure and the line only | `relay_rtsp.c:60`, `:76`; `relay.c:124-125` | F-8: lock the camera structure, or keep the key inside the locked static |
| M-6 | **A stated rule is not kept: "beyond a bound: a refusal, never a cut".** A description is cut silently at 96 lines of the video section and 16 payload types | `relay.h:40`; `relay_core.c:505`, `:525`, `:535` | F-9: refuse with `DESCRIPTION_INVALID` |

## 5. Low findings

| Id | Finding | Evidence |
|---|---|---|
| L-1 | The request counter `nc` is not restarted with a new nonce (RFC 7616 section 3.4). Interoperability with a strict camera only | `relay_rtsp.c:251`, `:291` |
| L-2 | A camera can force exit `INTERNAL` (70): a realm, nonce and opaque full of quotes double in length and overflow the header buffer. Bounded and refused, but the code misleads; on these two returns the request buffers are not overwritten (they hold a Digest answer, not the password) | `relay_rtsp.c:238`, `:251`, `:257`; `relay_core.c:387-397` |
| L-3 | `atoi` on camera text (undefined on overflow in the C standard) | `relay_rtsp.c:179` |
| L-4 | No folded headers; `Digest` and `Basic` in one header line reads as "not readable" and ends with `AUTH_SCHEME_NOT_ALLOWED`. Fails closed; some cameras send exactly that line | `relay_rtsp.c:191-197`; `relay_core.c:298`, `:309` |
| L-5 | The last Content-Length of a head wins; trailing text after the number is accepted | `relay_rtsp.c:166-170` |
| L-6 | Closing every descriptor up to `getdtablesize()` twice is slow where the limit is large (a container) | `relay.c:121-122`, `:158-159` |
| L-7 | `signal()` instead of `sigaction()`; behaviour differs by platform | `relay.c:292-294` |
| L-8 | `relay-check.sh` is a text search ("a tripwire, not a proof", its own line 16). It proves no absence | `relay-check.sh:16`, `:30-34` |

## 6. The assessment, point by point

### 6.1 Memory safety of the parsers

No out-of-bounds read or write, no integer wrap and no unbounded copy was found. Unbounded loops: H-2.

| Parser | Checked before use | Result |
|---|---|---|
| Head search | at most 8,192 bytes scanned; no end by then is `CAMERA_PROTOCOL` (`relay_rtsp.c:217-220`, `:395`) | bounded |
| Status line, header lines | each line ends at a line feed found inside the head (`:155-158`); status digits read behind a 9-byte prefix test, short-circuit (`:162`); an embedded 0 byte shortens a line, nothing reads past the head; a bare-LF head is never recognised and ends at the 8,192 bound | sound |
| Content-Length | `strtol`, then `< 0` or `> 65536` refused (`:166-169`); body copied into a 65,537-byte buffer (`:79`, `:227-228`); head + body at most 73,728 of a 262,144-byte buffer; a mismatch only waits (H-2) | sound |
| Content-Base, Session | length tested before `strcpy` / `memcpy` (`:171`, `:173-177`); session bytes restricted to printable | sound |
| Challenge | name 31, value 512, each tested before the write (`relay_core.c:306`, `:316`, `:323`); a backslash before the end is not skipped (`:315`); an unterminated quote is refused (`:319`); control bytes refused; a repeated parameter overwrites; every loop turn consumes input or returns | sound |
| SDP | 0 byte refused (`:509`); lines are pointer and length, never copied unbounded; control at most 1,024 (`:556-557`); base64 text at most 2,047 characters into a stack copy, decoded into 1,027 bytes, more than 1,024 refused (`:458-468`). That `av_base64_decode` stops at the given size is a **hypothesis** (library not read); experiment: the fuzz build of F-1 | sound, one hypothesis |
| Interleaved frame | length is 16 bit, frame at most 65,539 bytes, the buffer is 262,144; zero length and other channels dropped (`relay_rtsp.c:362-372`) | sound; liveness H-2 |
| RTP header | 12-byte floor and version (`relay_core.c:685`); CSRC count (`:689-690`); extension length (`:691-695`); padding count against the remainder (`:696-699`) | sound |
| Depacketiser | aggregation sizes against the remainder (`:634`); fragment without start is dropped (`:655`, `:672`); start without end is dropped at the next stamp (`:702-705`); growth capped at 8 MiB with exit (`:588`) | sound; type confusion M-2 |
| Address rules | host compared with the next byte required to be `:`, `/` or the end (`:254-258`); a user part cannot pass; output tested printable (`:276`) | sound |

### 6.2 Digest, the password, and "never Basic, never elsewhere"

- **Computation.** HA1 = H(account:realm:password) (`relay_core.c:371-384`); HA2 = H(method:address); response = H(HA1:nonce:HA2), or with `qop=auth` H(HA1:nonce:nc:cnonce:auth:HA2) (`:406-430`). Correct for MD5 and SHA-256; the unit test holds the published vectors of RFC 2617 3.5 and RFC 7616 3.9.1 (`relay_unit_test.c:93-104`). The client nonce is 16 bytes of system randomness (`relay_rtsp.c:246-249`).
- **Not answered:** session variants and any other algorithm name (`relay_core.c:335`), `auth-int` alone (`:340`), `userhash`. Each ends with `AUTH_SCHEME_NOT_ALLOWED`.
- **Stale:** one renewed answer per request (`relay_rtsp.c:281-282`); an exchange sends at most three requests. **Another realm or hash after the key exists:** `AUTH_REFUSED` (`:290`); the password is gone by then, so it cannot be hashed for a second realm.
- **Lifetime.** The line: overwritten on every path (`relay.c:151`). The password: overwritten in the line after the key is made (`relay_rtsp.c:286-287`) and again after the open (`relay.c:305`). Hash contexts overwritten (`relay_core.c:364-365`). The key: M-5. A camera that never challenges: H-2, last bullet.
- **Outputs.** One writer, fixed words and numbers (`relay.c:77-83`); library messages counted, never formatted (`:71-74`). No path was found that carries the password, the key, the account or the locator to an output or an exit code.
- **Basic.** The only `Authorization` value is built at `relay_core.c:431` and begins `Digest username="`; it is written at one place (`relay_rtsp.c:254-255`), only when a key and a challenge are held (`:240`). No encoder for the Basic form exists in the sources. **No path can emit `Authorization: Basic`.**
- **Another host.** One socket and one connect to the address of the start message (`relay_rtsp.c:303`, `:307`), never reopened. A 3xx is refused and `Location` is never read (`:323`). `Content-Base` and an absolute control address must name the same host and port or the open ends (`:328-329`; `relay_core.c:263`, `:268`); even a wrong address would travel on the same socket. **No path sends anything derived from the password to another peer.** The push leg goes to `127.0.0.1` on 8554-8564 with an address that cannot hold a user part (`relay_core.c:142-158`).

### 6.3 Resource and liveness

Memory: fixed (256 KiB buffer, 64 KiB body, picture at most 8 MiB, doubling to at most 16 MiB). Descriptors: one socket of its own plus the library's push. Holding and spinning: H-2. Malformed stream to the worker: M-2, M-3.

### 6.4 Process hygiene (S13-02, AD-09)

| Rule | State |
|---|---|
| No secret in arguments or environment | an argument is refused (`relay.c:297`); no `getenv` in the sources; that the libraries read none on this path is a hypothesis (the import net of `relay-check.sh:103` covers the binary's own imports only) |
| Core-file limit | set to 0 and read back, else exit 13 (`relay.c:117`); Linux `prctl` calls compiled on Linux only (`:118-120`), effect unproven until row 79 |
| Inherited descriptors | closed from 3 upward (`:121-122`) before anything is read |
| Exit codes, fixed words | yes (`relay_core.c:23-52`); L-2 for code 70 |
| Standard input closes | stop seen between pictures (`relay.c:88-102`); defeated by H-2 |
| File-system confinement before the first camera byte (RC-6) | not built (the record says so: row 79 / WP-14) |

## 7. The tests against this threat model

| Area (cases named in the request) | With a malformed-input test | Which |
|---|---|---|
| Status line and headers (5) | 0 | - |
| Content-Length (4) | 0 | - |
| Challenge parser (8) | 3 | no nonce; session algorithm; `auth-int` alone (`relay_unit_test.c:84-88`). Not: escapes, unterminated quote, repeats, 513-byte fields |
| SDP (5) | 3 | embedded 0 byte, no video section, second video section ignored (`:118-130`). Not: oversized base64, oversized control, missing fields |
| Interleaved framing (4) | 0 | - |
| RTP header (3) | 0 | only "wrong version" and "5 bytes" (`:175-176`) |
| Depacketiser (5) | 2 | fragment without start (`:173-174`); sequence gap (`:169-170`). Not: aggregation overrun, growth bound, type confusion |
| **Total** | **about 8 of 34** | |

The 79 checks are mostly positive (20 refused start messages come from the Core, not from the camera). The 28 fixture runs prove function on a well-behaved double and three hostile answers. No fuzzing. Warnings as errors: yes. Sanitizers, `_FORTIFY_SOURCE`, stack protector: none.

## 8. What makes (a) acceptable

| Fix | What | Size |
|---|---|---|
| F-1 | A permanent fuzz and sanitizer build: `make relay-fuzz` with `-fsanitize=address,undefined -fno-sanitize-recover`, four entry points (answer stream through framing and head reader; challenge; description; RTP packets into the picture collector), a kept corpus, a short run in `make relay`. Needs the framing and head reader moved out of the socket code into the pure part | M |
| F-2 | Unit tests with malformed input for every row of section 7 that shows 0; hardening flags on the release build (`-D_FORTIFY_SOURCE=2`, `-fstack-protector-strong`, `-fPIE -pie`, `-Wl,-z,relro,-z,now`) checked by the import-net step | S |
| F-3 | H-2: real deadlines, stop and keyframe bound on every loop turn, no per-frame `memmove` | S |
| F-4 to F-9 | as in section 4 (F-7 optional) | S each |
| Not a fix | a real camera has never met this client (record, section 8): interoperability is the hardware package | unknown |

Total: **M**. The fuzz build must exist before the first real camera, and stay.

## 9. The options, compared on residual risk

| | (a) own client, fixed | (b) library + pre-flight + exception | (c) patched library | (d) another client |
|---|---|---|---|---|
| Basic to a forged responder | impossible by construction | **open** | closed if the patch is right | closed if the mask holds (hypothesis) |
| Password in the process | until the first challenge; then the key | whole life, inside an address (F10 (b) and erratum E-A2 return) | same as (b) | whole life, as an option value |
| Redirect, other host | never (read) | library's behaviour, unverified | same as (b) | off by default (hypothesis) |
| Who parses camera bytes | about 1,100 bounded hand-written lines, plus the library's stream parser (M-1) | the library's RTSP reader, description reader and depacketisers | same as (b) | the library for signalling; description and depacketiser still hand-written |
| Ready-made (user preference) | no | yes | yes, plus one patch | partly |
| Real-camera interoperability | unproven | best | best | unproven |

**(b), what stays exposed.** The pre-flight reads a challenge on one connection; the library then opens its own. Anyone who can answer at the camera's address on the camera LAN (a replaced device, address takeover on the switch) offers Digest to the pre-flight and Basic to the library, and receives the password in a reversible form. That is the forged-responder case of S13-01, unchanged. The check stops only a camera that is statically set to Basic. A genuine but compromised camera gains little (it knows its own account), unless the password is shared between cameras. (b) therefore needs the user to accept the S13-01 risk itself, not a narrow exception.

**(c), the patch (hypothesis, source not read).** libavformat keeps HTTP and RTSP authentication in one unit (`httpauth.c`): one function notes the scheme of a challenge, one builds the header. The patch would make the Basic branch produce nothing, about ten lines. Experiments that settle it: the fixture's `basic` mode and the Digest-then-Basic double against the patched `ffprobe` (pass: `auth_basic` 0); the redirect and foreign-control doubles (does the library follow, and does it answer Digest there). Cost: the plan already knows Ubuntu 24.04 packages FFmpeg 6.1 while the pin is 63.1.102 (`04_design_addendum.md:724`, HA-13), so a self-built library is needed anyway and the marginal cost is one patch file re-applied at every pin move. The pin compares version numbers only (`relay.c:50`, `:298`): a patched and an unpatched build look the same, so the Basic-only run must become a boot or build check.

**(d), candidates (all hypothesis).** libcurl speaks RTSP signalling and delivers interleaved RTP to a callback; its authentication mask can be set to Digest only and it follows no redirect unless told. It reads no description and assembles no picture, so `relay_core.c` stays, and it brings a resolver, file and environment reads that break the import net of RC-6. GStreamer's and live555's clients: no option to refuse Basic is known to this reviewer. Experiment: a 50-line libcurl client against the fixture's `basic`, `both` and redirect modes, then `nm -u` against the import net. (d) removes about 415 lines at the price of a third library: not recommended.

## 10. Control mapping (short)

| Control | State |
|---|---|
| ISO 27001 A.10 cryptography | gap accepted elsewhere (S13-03): Digest over an unencrypted LAN; M-4 |
| A.12.6 technical vulnerability management | gap: no sanitizer or fuzz evidence (H-1) |
| A.14.2 security in development | partial: static rules with negative controls exist; adversarial tests do not |
| A.9 access control | kept: one peer, Digest only, key bound to one realm |
| GDPR Art. 32 | the camera account is a credential, not personal data; availability of evidence recording: H-2 |

## 11. Assumptions and gaps

- Hypotheses are marked where they stand: `av_base64_decode` bounds; default hardening of Ubuntu's clang; the inside of libavformat's authentication and redirect handling; libcurl's RTSP authentication mask; environment reads by the libraries.
- Not examined: the worker's handling of what the relay pushes; the Core adapter (row 46); Linux behaviour of every line (rows 79, 141).
- No file other than this one was changed. `masterplan/02_plan.md` was not updated, by the order of this review.

---
*Generated: 2026-10-13 02:55*
