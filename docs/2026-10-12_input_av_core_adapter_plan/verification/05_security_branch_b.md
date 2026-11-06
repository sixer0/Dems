---
task_id: 2026-10-12_input_av_core_adapter_plan
task_slug: input_av_core_adapter_plan
date: 2026-10-12
agent: security-review
type: security check of one controller reading (decision C26), before the worker change is built
narrative_tier: 1
source: decisions/decisions.md row C26; test/006_e11_listener_path.md; test/007_e11b_announced_path.md
verdict: ACCEPT B, conditional (12 binding requirements; 1 gate experiment in row 141)
fail_count: 0
status: complete
---

# Security check of reading C26: branch B on library log-message text

## 1. Verdict

**ACCEPT branch B, on the twelve binding requirements of section 8. Branch C is not selected. The selection stays provisional until row 141 shows the same line on the Ubuntu 24.04 library; if it does not, C applies without a further review.**

| # | Question | Verdict | One line |
|---|---|---|---|
| 1 | Is the construction fail-closed? | **Yes, if built as BR-01 to BR-04 say** | The safety property needs only one thing: acceptance requires a message equal to a string that contains the 128-bit secret. Every way the mechanism can break (wording, level, thread, truncation, attribution) ends in "refused", not "accepted" |
| 2 | The secret | **CAUTION** | Not built yet; today's path is predictable. It is not a worker argument and not in the worker's log. Two gaps: a worker restart re-sends the same plan, and the development camera helper takes the address as a process argument |
| 3 | What B does not cover | **CAUTION** | B makes the worker-ending client need the secret. The one process that holds the secret and parses a camera is the relay, so the defect must still be fixed. Local denial of one session's recording stays; it is detected and bounded by RC-5 |
| 4 | B against C, security only | **B leaves the smaller residual** | B's failure modes are refusals to record (loud). C puts the camera credential and the camera network's protocol parser into the process that writes both evidence files |
| 5 | A third construction | **None supported at similar cost** | A socket only the relay can reach is a hypothesis; the experiment is named. RC-5 stays as defence in depth |

What would turn this into a REJECT: a build in which acceptance does not depend on the positive match (a refusal only on a seen mismatch, as the probe's `refuse` mode does); any switch that turns the comparison off; row 141 not showing the line.

Not assessed here, by scope: GDPR and the ISO control mapping (no personal data and no control changes in this question; they are rated in `verification/02_security.md`).

## 2. Frame (5W1H), method, limits

| Question | Answer |
|---|---|
| What | A rating of one reading: library log text counts as READABLE for the rule table of blueprint 9.1 only in a fail-closed construction |
| Why | C26 puts the reading to a security check before row 58 changes the worker; a rejection selects C |
| Who | Reviewer: security-review. Readers: controller, rows 47, 48, 58, 59, 141, 142 |
| When | 2026-10-12 23:47 WIB, after rows 6 and 7, before row 8's gate is closed on B |
| Where | `apps/capture-worker/src` (`WRK`), `apps/core-server/src` (`CS`), `packages/capture-protocol/src` (`PROTO`), read-only |
| How | Reading and text search. Nothing built, started or bound to a port. Nothing under `apps/input-av/data/`, no `.env`. No secret is printed; the fixture paths of the test records are not repeated here |

Read in full: C26; `test/006`, `test/007` with the probe source; blueprint 9.1 and rows 8, 47, 48, 58, 59, 125, 141, 142; addendum section 5; `verification/04_security_addendum.md`; `WRK/ingest.c`; `WRK/README.md`; `CS/capture/worker-arguments.ts`. In part: `verification/02_security.md` (RC-1 to RC-6, lines 143-166, 354); `WRK/capture_worker.c:104-137, 365-392` and a search; `WRK/worker.h` by search; `CS/capture/supervisor.ts:1078-1096` and a search; `CS/capture-session/index.ts:1051-1056, 1132` by search.

**Limit that matters most.** libavformat's source was not opened (it is not in the repository; only its headers are installed). Every statement about what the library does inside is either taken from the two test records or marked HYPOTHESIS with what settles it. The requirements are written so that they hold whichever way a hypothesis falls.

## 3. Question 1: is the construction fail-closed?

### 3.1 The property, and why it does not rest on the fragile parts

Acceptance (reaching the probe at `WRK/ingest.c:508`, the file at `:515`, `ingest_connected` at `:525`) must require: during this open, on this thread, for this context, the callback received a message **equal to** `Parsing[<n>]: ANNOUNCE <the plan's address> RTSP/1.0`.

The message is the library's echo of bytes the client sent (`test/007:25`, 18 of 18; the value follows the client in all seven near misses, `test/007:133-142`). A client that does not know the address cannot make that message appear. So:

| What can go wrong | Result |
|---|---|
| The library changes the wording, the level, or stops emitting the line | no match: every push refused, the right one too. Recording stops; nothing foreign is recorded |
| The callback runs on another thread, or with another context | no match: refused |
| Camera 1's line is seen by camera 2's check | it does not equal camera 2's expected string (other port, other secret): refused |
| The message is truncated | it does not equal the expected string: refused |

This is why the reading is acceptable although the source is diagnostic text: the text is used as a necessary condition for acceptance, never as a sufficient condition for refusal. **The probe's `refuse` mode is the opposite construction** (it refuses when it sees a differing line, `test/007:319, 332`, and accepts otherwise) and must not be copied: with it, a missing line accepts.

### 3.2 The points asked, each with evidence

| Point | Finding | Evidence | Verdict |
|---|---|---|---|
| Process-wide callback, two ingest threads | One callback for the process (`WRK/ingest.c:699`); the header requires it to be thread safe (`log.h:329-330`, quoted `test/007:51`). The worker already attributes a message to a camera by a thread-local (`ingest.c:88-89`, set `:489`, cleared `:491`, read `:138`) and its existing transport refusal depends on that (`:140-148`) | as cited | Sound by design; **not shown in the worker** (`test/007:168`: the probe is one thread, one listener) |
| Is the context pointer enough? | In the probe every message used came with the listener's own context (`test/007:168`, `ctx=listener`). Alone it is not enough as a rule (a child context, a reused address); alone the thread-local is not either. Both together, plus the expected string being unique per listener, are. HYPOTHESIS HB-1: the listening open emits its request-line messages on the thread that called `avformat_open_input`. If false the result is refusal of every push, seen in the first run of BR-09's two-camera case | `test/007:168` | BR-03 |
| Raising the log level to 56 | **Not needed, and must not be done.** A callback set with `av_log_set_callback` receives every level: the probe never calls `av_log_set_level` (appendix, `test/007:391`) and got level 56; the worker never calls it either (search of `WRK/src`: 0 hits) and its callback already returns for everything above 16 (`ingest.c:152`) | as cited | BR-04 |
| What else arrives at those levels, and can it carry the secret into the worker's log | Level 24 `WARNING: Path <client's> differs from expected <listener's>` names the secret path as a bare path on every wrong-path request (`test/007:26, 174`). Level 32 `Updating control URI`, level 56 request lines and responses. None is written today: the callback writes level 16 and below only (`ingest.c:152`) and withholds a message that contains `://` (`:157`). A bare path at level 16 would be written (HX-3 of the addendum review); the one level-16 message seen names none (`test/007:174`) | as cited | BR-04: withhold by content too, not only by level |
| Truncation | The worker's buffer for a written message is 256 characters (`ingest.c:153`). A comparison done on a buffer shorter than the expected message, or by prefix, would let a longer line match by truncation. The bracketed number is the length of the received line (61 for the 61-character line of `test/007:86`), so the whole message, number included, changes with any longer line | `ingest.c:153`; `test/007:86` | BR-02: whole-message equality, checked length |
| Percent-encoding, case, trailing slash, query, prefix, extra component | The library normalises nothing: each of the seven arrives as written (`test/007:133-142`). Exact equality therefore refuses all seven. The plan's address cannot itself contain a percent sign, a query or a trailing slash (`WRK/capture_worker.c:110-126`; `PROTO/index.ts:508`) | as cited | Closed by BR-02; tested by BR-09 |
| Embedded CR or LF forging a second `ANNOUNCE` line | A forged line can only help an attacker if it equals the expected message, which needs the secret. A forged or second line that differs must refuse. HYPOTHESIS HB-2: the library's line reader ends a line at LF and drops CR, so a header line can read like a request line; not verified here. Harmless under equality plus the count rule | reasoning; not run | BR-02 (exactly one), BR-09 |
| Two `ANNOUNCE` requests | Not tested (`test/007:172`). On a second announce the library adopts the new address (`test/007:24`). Rule: more than one `ANNOUNCE` line, or any `Updating control URI` message, for this context refuses | `test/007:24, 172` | BR-02 |
| An oracle inside the one connection | If any answer of the listener to an unauthenticated request named the expected path, a client could read it and then announce it on the same connection. The `OPTIONS` answer seen names no path (`test/006:162`). Other methods were not examined | `test/006:162` | BR-09 (bytes received by a wrong-path client hold 0 occurrences) |
| Timing: comparison before any media byte reaches a file | `avformat_open_input` returns after the handshake (`test/007:92`); the file is opened only at `ingest.c:515`, after the probe at `:508`. A gate placed after `:504` and before `:507` is therefore before any byte of media can reach a file and before `ingest_connected` (`:525`). The interrupt callback (3 of 3, `test/007:157-161`) only makes the refusal earlier; it is not the gate | `ingest.c:490-525` | BR-01 |
| The interrupt callback today | It returns the process-wide stop flag and ignores its argument (`ingest.c:91`, `:487`). A refusal built on that flag would stop the other camera | as cited | BR-03 |

**Verdict for question 1: fail-closed, on BR-01 to BR-04.** None of the open hypotheses can produce an acceptance; each can only produce a refusal that the permanent test sees.

## 4. Question 2: the secret

| Point | Finding | Evidence | Verdict |
|---|---|---|---|
| Today | The path is `<sessionId>/<track>`: predictable, no secret | `CS/capture-session/index.ts:1056` | to be built (row 47) |
| Entropy | The grammar admits letters, digits and four marks, 256 characters in all: 128 bits fit (22 characters of URL-safe base64). Row 47's check already says 128 bits | `WRK/capture_worker.c:110-126`; `PROTO/index.ts:508-512`; blueprint row 47 | PASS as planned |
| Is it a worker argument today? | **No.** The arguments are the log path, the heartbeat and the named settings only; the address arrives in the plan of `START` on standard input | `CS/capture/worker-arguments.ts:47-49`; `WRK/capture_worker.c:372-388, 158-165`; header `:10` | PASS |
| Is it in the worker's log today? | No: the address is used at one place, the open; no log line takes it. 0 occurrences of any path text in 34 + 24 runs | `WRK/ingest.c:490` (only use); `test/006:33`; `test/007:57` | PASS; kept by BR-04 |
| How it reaches the relay | Through the adapter's open (`CS/capture-session/index.ts:1132`), then the start message (AD-03 (6), AD-05 (1)). The relay does not exist yet | as cited | BR-07 |
| **An argument list today** | The existing local camera helper puts the address as the last word of its process arguments | `CS/capture/adapters/local/camera-helper-args.ts:135`; `camera-helper.ts:291` | **Finding.** Development adapters only, fenced out of production. BR-07 (4) names it |
| **Per attempt** | A restart inside a session re-sends the stored plan unchanged with a higher attempt number | `CS/capture/supervisor.ts:794` (`plan: current.plan`) | **Finding.** RC-2 asks for one per attempt and per track. BR-07 (2) |
| Constant time | One connection per listener (`test/006:166`), so one guess per attempt; no practical timing attack. Required anyway: it is one line, and F-7 of the addendum review requires it if a listener ever accepts again | `test/006:166` | BR-02 |
| Not reused after the session | Follows from per-attempt generation; the worker is one process per session (`supervisor.ts:9-11`) | as cited | BR-07 (2), tested |

## 5. Question 3: what B does not cover

| Fact | With B | Requirement |
|---|---|---|
| **The worker-ending client**: handshake through `RECORD` with parameter sets, no media, close: exit 70, the other camera's recording lost, 12 of 12, right path as well as wrong (`test/007:189-198`). Cause as read: `ingest.c:524` treats a failed output setup as fatal, while a stream without parameter sets is a fault of one camera (`:512`) | A wrong-path client is refused before `:508`, so it never reaches `:515`. **The crash is then reachable only with the secret.** But the holder of the secret is the relay, which parses the camera. A camera that answers its description and then stalls, or a relay that dies between `RECORD` and its first packet, is exactly this client. The argument that makes B better than C ("its death is a camera fault", `verification/02_security.md:162`) is false while this stands | **BR-05, row 58.** Binding |
| **O-2**, a second connection: refused at TCP, 3 of 3; the first stream undisturbed (`test/006:147-151`) | Unchanged. Not tested: a second client between the first one's connect and its connect report | none new; SA-3 of row 48 stays (BR-08) |
| **An `OPTIONS`-only client consumes the listener**, 3 of 3 (`test/006:162-166`); any first connection does | Unchanged by B. The camera is lost for that attempt; under SA-3 the capture of the session ends (addendum 5.3). A detected denial, not a false recording | BR-04 (3): a code of its own; BR-08; BR-12 |
| **A connection flood, or simply connecting first** | The same class: whoever connects first holds the one connection | BR-12 (RC-5) is the control. Accepted residual for a process of the Core's own user |
| A client that connects and sends nothing | Bounded today: the camera is given up at the listen timeout plus 10 s while the other records (`ingest.c:17-20`, `:464-467`) | none |
| Re-listening after a refusal | Not tested (`test/007:170`). It would turn "one connection denies" into "a flood denies". Not required; if row 58 adds it, every new open is held to BR-01 again and the count is bounded | optional, row 58 |

## 6. Question 4: B against C, security only

| | Branch B | Branch C |
|---|---|---|
| Removes | nothing; adds a gate | the listener, the secret, SA-2, SA-3, RC-1 to RC-5, the dependence on log text, the local denial through the port |
| Camera credential | in the Core and the relay only | in the worker, the process that writes both evidence files (addendum 5.4) and holds the fragment cipher (`WRK/worker.h:150`) |
| Parser of the camera network (RTSP, description, transport) | in the relay, which can be confined (RC-6) and whose death is one camera's fault (with BR-05) | inside the evidence writer; a flaw there reaches both files, the audio and the cipher key |
| Outbound connections | none from the worker; the check "every socket is a stream socket on loopback" stays whole (`ingest.c:95-109`) | the check must admit non-loopback sockets; the redirect and Basic-challenge risks (HX-2, S13-01) move into the worker; AD-14 states what of RC-6 a file-writing process cannot keep |
| Failure mode of the new mechanism | refusal to record, loud, found by a test | exposure of a credential or of the writer, silent |
| Dependence on one library build | yes, for availability only; three pins exist (`ingest.c:61`, `:73-77`, `capture_worker.c:417-423`) | none of this kind |
| Honest limit of B | the worker still parses the video bitstream the relay forwards; B removes the protocol layer from the writer, not the codec layer | the same exposure, plus the protocol layer |

**Which leaves the smaller residual on a single-purpose host with one dedicated user: B.** What B leaves open needs a local process (bounded by RC-5 to the Core's own user, who already owns everything) and can only deny a recording, visibly. What C leaves open is reachable from the camera network and touches confidentiality and the integrity of the writer. C stays a sound fallback; it is not the safer choice.

## 7. Question 5: a third construction

| Idea | What can be supported | Status |
|---|---|---|
| The listener on a per-session local socket or an inherited descriptor, so that only the relay can reach it | Nothing in the records supports it. The listening RTSP input has no I/O context (`pb=NULL`, `test/007:55`), `io_open` is never called (0 of 18, `test/007:22`), and the headers show no listen/accept pair for RTSP (`test/007:55`). So a custom transport cannot be handed in through the public interface | **HYPOTHESIS HB-3: not available.** Experiment: the probe of row 7 opened with a local-socket address and `protocol_whitelist` extended; if the open fails, closed. Not required for B; could ride on row 141 |
| Media over an inherited pipe in another container format | Removes the listener, but the worker's timing rests on the sender reports of RTSP (`ingest.c:24-30`); the earlier review declined it for the same reason (`verification/02_security.md:354`) | not at similar cost |
| Comparing the peer's source port | 16 bits; declined as a sole measure (addendum 5.3) | not needed beside the secret |
| Firewall owner-match rule (RC-5) | Already required; it is the only control for the denial cases of section 5 | **kept as binding, BR-12** |

## 8. Binding requirements

| Id | Row | Requirement |
|---|---|---|
| BR-01 | 58 | **Positive-match gate.** After `avformat_open_input` returns and before `avformat_find_stream_info`, the ingest continues only if the match of BR-02 was recorded for this open. Otherwise the input is closed and the camera ends as a fault. The gate is unconditional: every operation, release and proof builds alike, no argument, environment variable, plan member or compile switch turns it off (a proof build may only force "no match", to show the refusal). The interrupt callback may end the open earlier; it is never the only check |
| BR-02 | 58 | **The match.** The formatted message equals, as a whole and in constant time, `Parsing[<n>]: ANNOUNCE <plan address> RTSP/1.0`, with `<n>` computed from the expected line. Formatting buffer at least 2,048 characters; a formatting result that does not fit is a mismatch. No prefix, substring, case-folded or decoded comparison; no splitting of the address. Exactly one `ANNOUNCE` line per open; a second one, a differing one, or any `Updating control URI` message for this context refuses |
| BR-03 | 58 | **Attribution.** A message counts only when the thread-local owner is this camera **and** the callback's context is this camera's input context. The result lives in the camera's own state, reset before each open. The early refusal uses a per-camera flag through the interrupt callback's argument; the process-wide stop flag is not touched. No shared mutable state is added to the callback |
| BR-04 | 58 | **Log hygiene.** (1) `av_log_set_level` is not called; nothing above level 16 is written. (2) Neither the announced nor the expected address or path is written to the log, a frame or an error; a library message that contains the session's path element is withheld at every level. (3) Two codes: refused on a differing or repeated line, and refused because no line was seen (a library change), so the two are told apart; neither carries path text |
| BR-05 | 58 | **Fault isolation.** A connected stream that yields no usable picture size (the client of `test/007` case A) ends that camera as a capture fault like `ingest.c:512`, not the worker; the other camera keeps recording. A failure of the writer itself stays fatal |
| BR-06 | 58 | **Pins stay.** The compile-time pin, the boot refusal of another libavformat and the build check are unchanged; the worker version rises and the Core's version check follows. A new library version is a decision that re-runs BR-09 first |
| BR-07 | 47 | **The secret.** (1) At least 128 bits from the system's random source, in the worker's address grammar. (2) One per track and per attempt: a worker restart inside a session gets a new one (today `supervisor.ts:794` re-sends the plan); test: two attempts, different elements. (3) One function builds the address; the relay announces the byte-identical string (host `127.0.0.1`, no trailing slash, no query). (4) It exists in the plan frame and the relay's start message, both on standard input: never a process argument, an environment variable, a log, an audit detail, a row, an error or a file. The development helper's argument (`camera-helper-args.ts:135`) is either changed or named as an exception limited to development operations in the static test of AD-05 (1) |
| BR-08 | 48 | **SA-3 is not relaxed because the worker compares.** Pairing of relay report and worker connect report stays; a refused or consumed listener is a capture fault with an audit entry; nothing of that track is sealed (AD-05 (2)) |
| BR-09 | 142 | **Permanent test in the worker's own series**, each with a right-path control in the same run: the seven near misses (no connect report, 0 bytes); "line absent: refused" (proof build or a client that never announces); two cameras pushed at the same instant, one right and one wrong, in both assignments (the right one records, the wrong one does not); a second `ANNOUNCE`; a raw wrong-path client sending every method: 0 occurrences of the secret in the bytes it receives; the case-A client on the right path: the other camera's file is complete; search of the worker's log and output for the secret: 0 |
| BR-10 | 141 | **Gate experiment.** In the Ubuntu 24.04 container against the pinned library: the line has the same text, level and instant; BR-09 passes there. If not, the selection is reopened and C applies. Until then B is provisional and the lift waits. Row 125 keeps the repeat on the host's build (`9A/H-01`) |
| BR-11 | 59 | **Re-verification** runs the whole series including BR-09 and the kill matrix on the changed worker, once, and records the count |
| BR-12 | RC-5 rows of WP-14 and WP-20 (numbers not verified here) | **RC-5 stays mandatory in B**: only the Core's service user may open a connection to the loopback ingest ports; a production boot names a missing rule. It is the only control for the denial cases of section 5 |

## 9. Residual risks, accepted with the verdict

1. A process of the Core's own user (or root) can read the secret from memory and push; it already holds the database role, the credential store and the signing path (`verification/02_security.md:143`).
2. Any local process that RC-5 does not stop can deny one session attempt its camera by connecting first. Detected, audited, not a false recording.
3. Recording availability depends on one library's diagnostic wording. A change stops recording until the pin is moved by decision; it cannot open the listener.
4. The worker still parses the forwarded video bitstream.
5. Everything is this Mac's library until row 141 and `9A/H-01`.

## 10. Hypotheses, assumptions, gaps

| Id | Statement | Settled by |
|---|---|---|
| HB-1 | Request-line messages are emitted on the thread that called the open, with the input context as first argument | BR-09, two-camera case; false means every push refused |
| HB-2 | The line reader ends at LF and drops CR | BR-09, second-announce and raw-client cases; harmless either way under BR-02 |
| HB-3 | A listening RTSP input cannot be given a local socket or an inherited descriptor | the experiment of section 7 |
| HB-4 | No message of the form `Parsing[..]: ..` is produced from anything but received bytes | BR-09: near misses and the oracle case give 0 matches |

- Assumption: the two test records are accurate; no run was repeated here.
- Gap: the relay does not exist; how its own library logs the address it pushes to is covered only by AD-05 (1)'s search of the relay's outputs.
- Gap: `CS/capture/supervisor.ts` was read by search and one passage, not in full; BR-07 (2) is written as an outcome with its own test.
- Alternative considered: making re-listening after a refusal binding. Not taken: untested (`test/007:170`), and RC-5 already bounds the denial.

---
*Generated: 2026-10-12 23:47 WIB*
*Last Updated: 2026-10-12 23:47 WIB*
