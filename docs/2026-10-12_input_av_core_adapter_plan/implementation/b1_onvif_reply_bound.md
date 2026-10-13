---
task_id: 2026-10-12_input_av_core_adapter_plan
row: B1
date: 2026-10-13
agent: coder-execution (agent B1, track D)
tier: T1
source: verification/060b_m3_review_second_pass.md finding B-01; decisions/decisions.md C95
status: complete
---

# Row B1 - a device's ONVIF reply is capped per read and scanned before the package reads it

## 1. What, why, for whom (5W1H)

| | |
|---|---|
| What | A one-pass, constant-memory guard in front of the ONVIF package: a size cap per reply fitted to the read it answers, a bound on the one text shape that makes the package's namespace replacement quadratic, and structural bounds (declarations, instructions, depth, element and attribute counts) |
| Why | B-01: one unauthenticated reply inside the 1 MiB cap held the Core's event loop for 41.9 s (review, check 1). The step is synchronous and inside the package (`node_modules/onvif/lib/utils.js:56`), so no caller deadline ends it |
| Who is affected | Every caller of the three facades of `onvif-session.ts` (connection test of operations 95 / 96, the stored-credential test, the locator read at each open of a source, the camera watch's time read, the scan probe, the set-IP poll) and of `onvif-network.ts` (`setAddress`) |
| Where | `apps/core-server/src/capture/adapters/camera/` - the two files and one new helper beside them |
| When | 2026-10-13, branch `task4/input-av-core-port`, working tree on 0f5d2a8e |
| How | Read of the package's code (read-only), measurement on this Mac (node v26.8.2, onvif 0.8.3, load average 13 to 18 during every measurement), tests on loopback doubles only. Nothing under `node_modules` and no lockfile was written; no dependency added |

## 2. The triggering shape (evidence: `node_modules/onvif/lib/utils.js:56`)

`xml = xml.replace(/xmlns([^=]*?)=(".*?")/g, '')` runs on every reply body before the XML parse (`lib/cam.js:368`).

At EVERY occurrence of the five letters `xmlns` the expression walks forward until the next `=`. Then, only if a `"` follows, it walks to the next `"` on that line. Its cost per occurrence is therefore the distance to the next equals sign (or to the END of the text when there is none) plus the length of the quoted value. Many occurrences, each far from an equals sign: quadratic. `'xmlns'.repeat(n)` is the purest form (no equals sign at all).

Counted, not timed (the attempt-by-attempt model in `onvif-reply-guard.test.ts`, `replacementWork`): the reproducer at 64 KiB costs 6,553 character looks PER BYTE of reply, and four times the text is sixteen times the work.

A second, smaller form of the same step: a quoted value that does not close on its line. The expression gives that declaration up and then tries every occurrence INSIDE the value on its own.

Not part of the trigger (review's check 2, re-read): entities are not expanded; deep nesting ends in a `RangeError` the package catches.

## 3. The fix

### 3.1 Files

| File | Change |
|---|---|
| `camera/onvif-reply-guard.ts` (NEW, 0 imports) | `createOnvifReplyScan` / `scanOnvifReply` (the scan), `ONVIF_REPLY_MAX_BYTES` and `onvifReplyMaxBytes` (the caps), `ONVIF_REPLY_BOUNDS`, `OnvifReplyRefusal` (7 codes), `guardOnvifReplies` (the wrap) |
| `camera/onvif-session.ts` | one import; the guard installed on the exchange's agent; `ask` names the read being asked and answers at once after a refusal; a connection made after a refusal is destroyed |
| `camera/onvif-network.ts` | the same four places; the reboot step is skipped after a refused reply (`reboot` stays `NOT_ASKED`) |
| `capture/__tests__/static.test.ts` | ONE named entry: `./onvif-reply-guard` in the pinned import list of the set-network file, and one line that holds the guard to "imports nothing" and the connection file to one import of it |

No export was added to either ONVIF file (their export lists are pinned by the static set). `ws-discovery.ts` and `probe-answer.ts` were not touched (section 6).

### 3.2 How the guard stands in front of the package

The package makes its requests through the ONE agent the calling file built. `guardOnvifReplies` wraps that agent's `addRequest`, takes the response first (`prependOnceListener`), and wraps the response's own `on`: the package's `data` listener gets a chunk only after the scan admitted it, and its `end` listener - where the package parses - is not called once a chunk was refused. So the package never holds the refused text. No listener is put on the package's client and no module is imported.

### 3.3 What a refusal becomes (existing named outcomes only)

| Refusal | In `onvif-session.ts` | In `onvif-network.ts` |
|---|---|---|
| `OVERSIZED` | `cut('BYTE_CAP')`: `UNREACHABLE` / `BYTE_CAP` (time read: not answered) | `BYTE_CAP` with what is known |
| any shape refusal | the read being asked answers `INVALID_ANSWER` - what a reply that is no answer always was: clock or services `UNREACHABLE` / `NOT_ONVIF`, profiles `WRONG_PROFILE` / `PROFILE_ANSWER_INVALID`, stream address `WRONG_PROFILE` / `STREAM_ADDRESS_MISSING` | interfaces `INTERFACES_ANSWER_INVALID`; set `UNKNOWN` / `SET_ANSWER_INVALID`; gateway `NOT_CONFIRMED`; reboot `SENT_NO_ANSWER` |

Nothing further is sent after a shape refusal: every later read of the exchange answers `INVALID_ANSWER` without a request, the sockets are destroyed, and a connection the package would still open is destroyed at creation. One consequence differs from a merely malformed reply, on purpose: a refused `GetServices` is NOT followed by `GetCapabilities`, and a refused gateway answer is NOT followed by the reboot.

AD-06: the guard hands the calling file one of seven codes. No byte, offset or count of the reply is returned, logged or kept; neither ONVIF file logs.

## 4. The caps and bounds, with the measured sizes

Measured on the fake ONVIF stub's well-formed answers through the real package (scratch run on loopback, bytes of the body):

| Answer | Bytes | Elements | Depth | Attributes (max on one element) | Cap | Cap / measured |
|---|---|---|---|---|---|---|
| GetSystemDateAndTime | 773 | 17 | 7 | 5 (5) | 16 KiB | 21 x |
| GetServices | 836 | 15 | 6 | 5 (5) | 64 KiB | 78 x |
| GetCapabilities | 588 | 8 | 6 | 5 (5) | 64 KiB | 111 x |
| GetProfiles, 1 profile | 1,012 | 20 | 7 | 9 (5) | 128 KiB | 130 x |
| GetProfiles, 4 profiles (`TWO_SOURCES`) | 3,635 | 88 | 7 | 25 (5) | 128 KiB | 36 x |
| GetStreamUri | 586 | 8 | 5 | 5 (5) | 16 KiB | 28 x |
| GetNetworkInterfaces | 778 | 16 | 8 | 6 (5) | 64 KiB | 84 x |
| SetNetworkInterfaces | 431 | 4 | 4 | 5 (5) | 16 KiB | 38 x |
| SetNetworkDefaultGateway / its read-back | 360 / 484 | 3 / 5 | 3 / 5 | 5 (5) | 16 KiB | 34 x |
| SystemReboot | 410 | 4 | 4 | 5 (5) | 16 KiB | 40 x |

The largest cap is 128 KiB, an eighth of the old 1 MiB. Reasoning for the margin: a real device writes a longer envelope and more members than the stub; the profile list is read to 16 profiles (`maxProfiles`), and 128 KiB is 8 KiB a profile against about 900 bytes a profile on the stub.

Structural bounds (`ONVIF_REPLY_BOUNDS`): depth 32 (measured 8), 8,192 elements (88), 4,096 attributes in all (25), 128 on one element (5); an equals sign within 48 bytes of each `xmlns`, a double-quoted value closed or line-ended within 512 bytes. Refused outright: any `<!` that is not a comment or a CDATA section (document type, entity, notation), any processing instruction after the document began.

GAP, stated: the test camera fixtures of `apps/capture-worker/test-fixtures/` speak RTSP only - they have no ONVIF answer to measure. The sizes of the bench cameras' answers are NOT known (as the review said). HYPOTHESIS, unverified here: real cameras answer the clock in 1 to 4 KiB and a profile in 2 to 8 KiB. A request line asks the hardware package for the counts. A real answer above a cap would end by name (`BYTE_CAP`), never silently.

DRIVER DECISION (to confirm): `maxReceivedBytes` of both files stays 1,048,576, now only the total of an exchange. Reason: the brief's "existing tests pass unedited" and the pin at `onvif-session.test.ts:374`. The bound that matters is per reply.

## 5. Proof

### 5.1 Measurements (this Mac, load average 13 to 18)

| Case | Before | After |
|---|---|---|
| The reproducer, 1,000 KiB, as the clock reply | 41.9 s (review); 82.2 s re-measured here with the guard switched off (section 5.3) | 1.8 to 3.1 ms per call (time read x3, connection test x1) |
| The same, 256 KiB | 2.8 s (review) | 1.0 to 7.5 ms |
| The same, 15 KiB (under the new clock cap) | 11 ms at 16 KiB (review) | 2.9 to 19.1 ms (first call of the process included) |
| The scan alone on the reproducer | - | refused at byte 54, 0.02 ms, at every size |

Sweep, whole connection test of three requests on loopback with an ADMITTED profile reply (minimum of 3; the same test with an empty profile reply costs 2.0 to 2.6 ms):

| Admitted shape | 16 KiB | 32 KiB | 64 KiB | 127 KiB |
|---|---|---|---|---|
| the worst the bounds leave the replacement | 4.7 ms | 3.8 ms | 4.3 ms | 7.4 ms |
| elements up to the element bound | 5.9 ms | 8.7 ms | 22.7 ms | 17.9 ms (100 KiB: the element bound) |
| entities and text | 5.1 ms | 5.2 ms | 6.5 ms | 9.1 ms |

Counted linearity of the replacement on admitted text: at most 8.6 character looks per byte for the constructed worst of the bounds (the reproducer: 13,107 at 128 KiB). 200,000 seeded texts: of 15,001 admitted none exceeded the linear bound; the replacement's worst time on 2,000 admitted texts of 64 KiB was 0.21 ms, against 284 ms for the reproducer of that size.

PER-REPLY BUDGET: 25 ms measured as the most one admitted reply cost at any size up to its cap; asserted as 250 ms for scan plus replacement (pure) and 1,000 ms for a whole three-request test (loopback).

### 5.2 Tests

| File | What |
|---|---|
| `__tests__/onvif-reply-guard.test.ts` (NEW, 23 cases, no socket) | every refusal with its control at the bound; the same verdict byte by byte and cut at every place; the reproducer refused at 16, 256 and 1,000 KiB inside 250 ms; the control that the package's expression IS quadratic on it (counted and timed); the size sweep (counted work under 16 per byte, time under 250 ms); a seeded generator; the wrap on a hand-made agent, request and response |
| `__tests__/onvif-session.test.ts` (ONE block appended, 5 cases) | the reproducer as the first reply at 1,000 / 256 / 15 KiB through all three facades: named outcome, under 5,000 ms, ONE request; as a later reply at each read, with nothing further sent (control: a reply merely cut IS followed by `GetCapabilities`); the other refused shapes with a canary that is not in the result; the caps at 16 KiB and 128 KiB with their controls; the sweep through the real package |
| `__tests__/onvif-network.test.ts` (two imports, ONE block appended, 4 cases) | the reproducer at each of the calls and at the package's own gateway read-back; no reboot after a refused gateway answer; the 64 KiB cap with its control; the canary |

The hostile modes of the stub (`MALFORMED_REPLY`, `OVERSIZED_REPLY`, `MARKUP_TOKEN`, `MARKUP_TEXT`, `TWO_ENDPOINTS`) keep their outcomes: their existing cases in `onvif-network.test.ts` and in `modules/capture-config/camera-network` and `factory-scan` passed unedited. Every existing case of the two ONVIF test files passed unedited (71 of 71 before any test was added).

### 5.3 The bound fails on the old behaviour (mutation control, run once, reverted)

With `guardOnvifReplies` returning at once (a temporary line, removed; `grep` of the file for it: no match) the first B1 case failed: `1000 KiB, the connection test: expected 82198.4 to be less than 5000`. The outcome itself was equal - only the time told the two apart, which is why the case asserts time.

### 5.4 Result lines

| Check | Result |
|---|---|
| the two ONVIF test files, unedited, after the product change | `Test Files 2 passed (2)`, `Tests 71 passed (71)` |
| the three camera files after the new cases (second run; the first failed in B1's own new network block: the odd device's five fixed ports are shared with the connection file's test - the block got a listener of its own on a system-chosen port) | `Test Files 3 passed (3)`, `Tests 103 passed (103)` |
| adapters, static set, fence, capture-discovery, capture-config (unit project) | `Test Files 1 failed, 61 passed (62)`, `Tests 1 failed, 1552 passed (1553)` - the one red is `src/capture/fence/__tests__/fence.test.ts:294`, not B1's (section 7) |
| final: capture static set, the three camera files, `ws-discovery`, `probe-answer` | `Test Files 6 passed (6)`, `Tests 228 passed (228)` |
| `tsc --noEmit` of `apps/core-server` | 2 errors, both in `src/capture/boot/__tests__/program-checks.test.ts` (256,79) and (259,87); 0 in any file of this row |

## 6. Other XML entry points

Text search of `apps/core-server/src` for the package, `xml2js`, `parseString`, `DOMParser`, `fast-xml`:

| Entry | State |
|---|---|
| `camera/onvif-session.ts`, `camera/onvif-network.ts` (the only two importers of the package; static rule SR-3) | FIXED here |
| `camera/probe-answer.ts:263` (WS-Discovery answers, called by `ws-discovery.ts`) | NOT AFFECTED, not changed. It uses `xml2js.Parser` directly and never the package's replacement; it already caps a datagram at 16 KiB, refuses declarations and depth above 24, and a search reads at most 256 datagrams. Measured at its cap with ten hostile shapes, the reproducer among them: 0.04 to 2.53 ms each |
| any other XML parse of device text | none found |

Not measured: the package's parse of the `WWW-Authenticate` header (`lib/cam.js` `getDigestHeaders`, `_parseChallenge`). Node bounds a response head (16 KiB by default) and both files hold a challenge to 2,048 characters before the package answers it, but the package's own split of the header runs first. Named for the third pass (row 60c).

## 7. Open, and not B1's

- `src/capture/fence/__tests__/fence.test.ts:294`: red against the in-flight `fence/index.ts` (the `addressHelperSocketPresent` member; likely row HC).
- `tsc`: `src/capture/boot/__tests__/program-checks.test.ts` (256,79), (259,87) (likely rows HC / H2).
- The size of real answers: hardware package (`9A/H-17`), request line in `file_requests.md`.
- TLS: as before, never run (the stub speaks none); the guard sits above the transport and does not depend on it.
- S-05 of the review (the two files duplicate their exchange) stands: the guard is ONE shared file, but its installation is written twice.

## 8. Assumptions

- Times are of this Mac under load; the production host's are not known. The assertions are 60 to 2,500 times above the measured values.
- "Linear" rests on the counted model of the one expression and on timing of the parser for the shapes tried (section 5.1); the XML parser was not proven linear for every input, only bounded in size, depth and counts and measured.
- Edit tool only for existing files; new files with Write. One temporary mutation line was added and removed with the Edit tool (section 5.3).

---
*Generated: 2026-10-13*
