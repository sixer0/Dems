---
task_id: 2026-10-12_input_av_core_adapter_plan
row: 60b
milestone: M3 (second pass of row 60, over what the first pass did not read; decision C93)
date: 2026-10-13
agent: senior-code-reviewer
tier: T1
reviewed: branch task4/input-av-core-port, head 0f5d2a8e, plus the uncommitted working tree
status: needs-review - items 1 to 3 read in full; items 4 and 5 read IN PART (section 7 says what and why)
---

# Row 60b - second pass of the code review of phase 3 (M3)

## 1. Verdict

**CHANGES REQUESTED. Blocking findings for the M3 gate: 1 (B-01).**

Follow-ups: **13** (S-01 to S-13). Notes: **12** (M-01 to M-12).

B-01 in one sentence: ONE unauthenticated HTTP reply of a device, inside the session's own byte cap, holds the Core's event loop for 41.9 s (measured), and the whole-test deadline cannot end it.

Why I call it blocking and not a follow-up - the controller may rule otherwise: (a) the file is in M3's list (rows 142, 26, 143b, pass I-7, row 110); (b) it is reachable at head WITHOUT the lift: the connection test of a candidate (operations 95 / 96, every capture operation) and the scan probe and set-IP poll the composition wires in `REAL_PRODUCTION` (`capture-composition.ts:662, 664`); (c) it breaks a bound the file states (SEC35-33: "ends in a named outcome, inside the bounds"; `onvif-session.ts:34-38`). Against it: the attacker must answer on the camera network at an address an operator tests, a scan probes or a camera is stored at.

Apart from B-01: the destination rule has NO path that answers "allowed" without a positive match (section 4.1), and no wiring error, door set twice or order dependence was found in the three composition files (section 4.3).

Limit, stated first: of the tests (item 4) about 9,500 of 22,000 lines were read; of the Core-side adapter and discovery tests most were NOT read. Section 7.

## 2. Frame, method, limits (5W1H)

| | |
|---|---|
| What | Code review of the files the first pass (`verification/060_m3_review.md`) listed as not read: the destination rule and its binders, the ONVIF session and set-network files, three composition files, the tests of phase 3, the camera facts of the slices and their readers |
| Why | Decision C93: "a review that skipped the tests and the destination rule does not close M3" |
| Who is affected | the controller (gate M3, row 61; rows 86, 88), the owners of the rows named per finding |
| When | 2026-10-13, working tree as found |
| How | Read-only: `Read` of files, text searches, `git diff --stat` of one path. Three targeted checks, none with a port, a database or the heavy-host lock (section 3). No suite, build or typecheck. The Graft graph was not queried: every finding rests on a file read, a text search or a command, cited |
| Not reviewed | the in-flight edits of rows R1 / R2 (`onvif-relay.ts`, `ingest-pairing.ts`, named static entries, the selector's refusal). `connect/service.ts` is cited at two lines and may have moved under R2 |

## 3. The three checks that were run

| # | Command (from the repository root) | Output |
|---|---|---|
| 1 | `node -e` : `require('onvif/lib/utils').parseSOAPString(body, cb, 200)` with `body = 'xmlns'.repeat(n)` | `16 KiB: 11 ms`, `256 KiB: 2753 ms`, `1000 KiB: 41938 ms`, each `callback: Wrong ONVIF SOAP response`; `node v26.8.2 onvif 0.8.3`. The bare expression alone: `32 KiB 37 ms, 64 KiB 138 ms, 128 KiB 553 ms` (quadratic) |
| 2 | same: 9,362 / 37,449 / 146,285 nested elements, and a document with an internal entity | `linerase` throws `RangeError` at each depth, inside the caller's callback; the entity document: `Wrong ONVIF SOAP response` (no expansion) |
| 3 | every `run` line of `test/relay_fuzz_controls.sh` as `sed "$script" src/relay/$file \| cmp -s - src/relay/$file` (standard output only) | `controls: 24, stale now: 0` |

## 4. The blocking finding

### B-01 - one device reply inside the byte cap blocks the Core for 42 seconds

- **Where.** `apps/core-server/src/capture/adapters/camera/onvif-session.ts:109` (`maxReceivedBytes: 1_048_576`), `:574-577` (the cap is the only bound on a body); `onvif-network.ts:74`, `:381-384` (the same cap). The cost is in the package: `node_modules/onvif/lib/utils.js:56`, `xml.replace(/xmlns([^=]*?)=(".*?")/g, '')`, run on every body before the XML parser (`lib/cam.js:368`).
- **What happens.** A body of `xmlns` repeated, with no `=`, makes that expression scan to the end of the text from every occurrence: quadratic. Check 1: 41.9 s for 1,000 KiB, synchronously. The exchange's deadline is an `abort` listener (`onvif-session.ts:626, 644`) and a timer seam (`:560`): neither runs while the expression runs. Nothing else of the Core runs either (HTTP, the supervisor, the engine).
- **Who can send it.** Any device that answers the FIRST read. `GetSystemDateAndTime` carries no credential (`:480`), so no account is needed. Reached by `test` (`:731`), `locate` (`:795`, at every open of a source), `read` (`:865`: the watch's heartbeat on every stored camera; the scan probe `fence/production-parts.ts:161-170`; the set-IP poll `:200-209`) and `setAddress` (`onvif-network.ts:508`).
- **Why the tests did not see it.** `onvif-session.test.ts:364-371` proves the cap against an ENDLESS body; `:439-446` a deep one of 3,000 levels. No case sends a body UNDER the cap and holds the wall time.
- **Producing rows.** 142 (the cap), 26 / I-7 / 143b / 110 (each new reach of the same exchange).
- **Smallest fix.** The cap per facade, sized by what the read can answer: the time reader 16 KiB (11 ms measured); tester, locator and setter at the smallest value the bench cameras' `GetProfiles` answers allow (64 KiB costs 138 ms, 256 KiB 2.8 s - the size of real answers is NOT known to me; measure it on the recorded answers). One test per facade: the hostile body at the cap, asserting elapsed time. A durable fix (the namespace strip replaced, by a patch of the package or an own parse) is a design choice for the controller.
- **Check 2, for the record.** Deep nesting does NOT crash: the package's own `try` hands the `RangeError` back through the read's callback, and `ask` takes one answer (`onvif-session.ts:650-664`). Entities are not expanded (sax 1.6.1 under xml2js 0.6.0).

## 5. Follow-ups

`CS` = `apps/core-server/src`, `WRK` = `apps/capture-worker`. "Lift" = to close or rule before row 88.

| ID | File:line | Finding, and why it matters | Row | Smallest fix |
|---|---|---|---|---|
| **S-01** (lift) | `CS/modules/devices/status.ts:168`; `packages/shared/src/api/state-slices.ts:553, 555`; `packages/shared/src/sim/initial-state.ts:297-299, 313-315`; readers `apps/core-web/src/features/dashboard/devices-panel.tsx:37-38, 324`, `session-monitor/model.ts:460-462` with `live-feed-panel.tsx:90-94`, `session-monitor/inputs-panel.tsx:83`, `apps/mobile/src/features/session-live/live-feed.tsx:217-219` | **A default stands in for a missing camera fact (decision C36).** `withCameraStreamFacts` answers "as it was" for a track whose selector slot is unassigned or holds no stream statement. "As it was" is the simulator's initial literal `1080p / 25 / H.264`: a text search finds NO writer of `resolution` or `codec` into the committed `cameras` slice under `packages/shared/src` or `CS`, and the substitution is made only in the three device reads (`devices/index.ts:129, 146, 154`). The contract cannot say "not known": `resolution` and `codec` are not nullable (only `fps` is, `state-slices.ts:538`). So an operator of a real Core reads a picture and a codec no stream stated. `device-drawer.tsx:240-241` and the mobile detail (`device-detail.tsx:527`) do say "not reported"; the readers listed do not. Not traced: which of these screens a real Core feeds from the slice and which from operation 44 | 52, 53, 54, 55 | A contract step: `resolution` and `codec` nullable; `withCameraStreamFacts` answers null for a slot without a statement in real capture; the readers print the existing "not reported" text. Until then: the `realCapture` guard of `device-drawer.tsx` in the listed readers. With F3-07 of the first pass |
| **S-02** (lift) | `CS/capture-composition.ts:484, 494` against `:486` | **Fail-open at the lift (the F-07 family).** Before a watch is attached, `relayEnded` and `onSourceLost` drop the loss silently (`cameraWatch?.relayEnded(end)`); the clock read beside them refuses BY NAME. If row 88 builds an adapter and forgets `attachCameraWatch`, every relay end raises nothing and logs nothing | 85b, 85c | `ports.report('error', CAMERA_WATCH_NOT_ATTACHED, {})` in the null branch (the code exists, `:117`); a second code for the microphone watch |
| **S-03** | `CS/modules/capture-discovery/connect/service.ts:264, 360` (in-flight file); `CS/capture/adapters/camera/onvif-session.ts:209, 235, 519, 552`; `onvif-network.ts:186, 518` | Three optional members whose absence turns a check OFF: `candidateSource?()` left out reads as "not required" (no rule, no source for a candidate's test); `sourceAddress?` left out dials "as the host routes"; `admitHwAddress?` left out sends the set without the hardware-address judgement. Each production caller states its member today (`connect/index.ts:276`; `production-parts.ts:238`). The type does not hold that | 143b, 143c, 111 | Required members; a test that wants the old behaviour states `{ required: false }` / `undefined` explicitly |
| **S-04** | `CS/capture/adapters/camera/stored-address.ts:191, 199-206`; pinned by `__tests__/stored-address.test.ts:103-106` | **The port half of the judgement is not held.** `new URL` drops the default port, so a stored `host` and a stored `host:80` both ask the rule about `undefined`; the rule answers the FIRST port of its list (`destination-rule.ts:330`), and the judgement never compares `destination.port` with the port it will dial. Latent: `allowedPorts` is set by no production file (text search), so the list is `[80]`. The day point 3's stored list exists and does not start with 80, a dial at 80 is admitted. Also stated here: point 3 has no production source at all - a camera on another ONVIF port is refused `PORT_NOT_LISTED` | 143, 95 | `service.port === '' ? 80 : Number(service.port)`; refuse (`RULE_FAILED`) when the admitted `destination.port` is not that port |
| **S-05** | `CS/capture/adapters/camera/onvif-network.ts:203-260, 344-501` against `onvif-session.ts:246-301, 532-695` | Structural duplication, about 200 lines: `Failure`, `Stop`, `failureOf`, `isAuthFailure`, `digestChallengeAllowed`, `NOT_AUTHORIZED`, `DIGEST_ALGORITHMS`, the watched agent, `arm` / `disarm`, `ask`, `authorizedAsk`. Two copies of "never Basic, at most one refused request with the credential" to keep equal; B-01's fix must be made twice | 110 | One `onvif-exchange.ts` both files use (G-R10 then names it: a named entry) |
| **S-06** | `CS/capture/adapters/camera/onvif-network.ts:204, 340` | The source address is held to `DOTTED_QUAD`, which admits `0.0.0.0` (no bind), multicast and broadcast, not to `isSourceAddress`. The product's rule never names such a source; the `rule` parameter of `cameraNetworkSetterOf` is the seam. Fifth statement of the dotted form (`destination-rule.ts:192`, `capture-config/network/facts.ts:58`, `stored-address.ts:113`, here, `relay_core.c` `source_ok`) | 110, 111 | `isSourceAddress(destination.sourceAddress)` |
| **S-07** | `WRK/relay-check.sh:245, 283` against rule lines `:51, :54, :61, :62, :63, :75, :78, :93, :117, :120, :126, :129, :130, :133, :136, :144, :146, :147` | **The selftest proves by TAG, not by rule.** A control passes when ANY rule of its tag refuses. The listed rule lines have no control of their own: each could be deleted and `--selftest` stays green. Among them `:54`, "the socket is given its source address before it is connected" - the order S13-11 point 2 rests on - and `:63`, "exactly one connect" | 41, 143b, 153, 186 | One message per rule and the selftest matches the message; a control for each listed line (for `:54`: the bind block moved below the connect) |
| **S-08** | `CS/modules/capture-discovery/connect/__tests__/service.test.ts:382-383` | The flaky expectation recorded as `service.test.ts:378` is STILL at head (the file grew by 206 lines since). Cause confirmed by reading: `mixed` is the secret followed by 20 random bytes; when the first is `x` the longer text is found: 1 run in 256. Diagnosed in `implementation/146_stored_credential_test_bounds.md:105`; not fixed | 142 (fix F-M4) | A fixed byte that is not `x` after the secret |
| **S-09** | `WRK/src/capture_worker.c:444`; `src/ingest.c:655`; `test-fixtures/e11_listener_path.py:43, 69, 247, 265`; `row58_gate.py:120-122` | **`INGEST_OPEN_STUCK` - HYPOTHESIS of its cause.** The worker gives a camera up when it is not CONNECTED `listen timeout + 10 s` after the SESSION started; CONNECTED is set after the open, the gate and the probe. The fixture's listen timeout is 12 s, so the bound is 22 s from the START; it sleeps 1.5 s and then starts a real-time (`-re`) x264 pusher. On a host under load the pusher's start and the probe can pass 22 s: the control camera is given up and the run fails (the "10 of 12"). The load is recorded (`:247`) and not judged. Fits what record 059 saw (0 in 36 sessions at load 5 to 7). Experiment: the case `right` under induced load | 58, 178 | The gate runs with `O3_LISTEN_S` (30 s, exists at `:44`), or a run that holds the code is marked INCONCLUSIVE with its load |
| **S-10** | `WRK/test-fixtures/row043_reopen.py:282, 312, 344`; `row153_confinement.py:135, 201-208` | Sleeps where an event exists: `time.sleep(2.0)` before the first camera is ended stands for "the push is established" (the line `push_established` can be awaited with `relay.saw`, as `:244` does for a loss). The negative control of row 153 needs `samples >= 5` from 1.5 s of sampling at about 0.4 s a sample: 4 or 5. Both fail CLOSED (a false alarm under load, never a false pass) | 43, 153 | `relay.saw(b'"report":"push_established"', 30)`; the control samples until 5 samples or a bound |
| **S-11** | `WRK/test-fixtures/row143b_source_bind.py:192-208`; `row152_hostile_relay.py:133-145`; `row153_confinement.py:244-255`; `row58_gate.py:216-227` | "N of N" counts EVERY `result.json` under the script's folder, also of an earlier run or an earlier version of the script; `all` does not clear the folder. A renamed or removed case stays in the count that a decision then quotes (C88) | 58, 143b, 152, 153 | `all` empties `runs/` first, or stamps and filters by a run id |
| **S-12** | `WRK/test/relay_fuzz.c:300-336, 388-441` | The fuzz build does not reach three things of row 43: the two report lines `relay_loss_line` / `relay_reopened_line` (the entry `report` makes the probe and established lines only), a SECOND leg (`relay_camera_drop` and a new connection), and any keep-alive (time-driven, never due in a fuzz run). The unit test holds the two lines at every room (`relay_unit_test.c:422-459`) and the second leg (`:1396-1445`) | 43, 186 | Two more calls in `fuzz_report`; a two-leg variant of `fuzz_client`; one control each |
| **S-13** | `WRK/test-fixtures/rtsp_test_camera.py:514-557` | The test camera challenges and verifies Digest with MD5 and no `qop` only. SHA-256 and `qop=auth` of the relay's client are proven by the published vectors of the unit test (`relay_unit_test.c:493-504`) and by no run against a camera | 40, 41 | A switch `--digest sha256-qop` in the test camera and one case of row 41's fixture |

## 6. Notes

| ID | File:line | Note |
|---|---|---|
| M-01 | `CS/capture/adapters/camera/onvif-session.ts:875-879`; `fence/production-parts.ts:168-169` | The time read is "answered" for any failed read whose raw body holds the words of `NOT_AUTHORIZED`. The scan then states `onvifReachable` for a web server that says "Unauthorized" |
| M-02 | `onvif-session.ts:560-569` | The connection limit looks at `socket.connecting`, false once TCP stands: a stalled TLS handshake is ended by the request limit (5 s), not by `connectMs` |
| M-03 | `fence/production-parts.ts:604-612` | A third copy of "read the facts, null when it threw" (first pass N-13), this one without `unreadable`: a reader that throws in a commissioning observation is not logged |
| M-04 | `CS/capture-composition.ts:170-184` | The relay report hub takes ONE source for the life of the app: after its own unsubscribe ran, `attached()` stays true and a new `attach` is refused |
| M-05 | `CS/modules/capture-discovery/connect/index.ts:253`; `capture-composition.ts:714` | Two readers of "is this production capture": the configuration there, the fence control here. One function behind both today |
| M-06 | `CS/modules/capture-discovery/__tests__/static.test.ts:63`; `readdress-route.ts:193-196` | Rule 4 finds `.replaceForTest(` by spelling: a destructured call is not seen. It is the only thing between production code and the permissive address rule of the re-address control |
| M-07 | `CS/modules/capture-discovery/__tests__/adopted-test.test.ts:359, 582, 612` | One `setImmediate` turn stands for "the test reached its tester", then `timers[...]?.fire()`: if the chain ever gains a turn of real I/O the `?.` makes the fire a silent no-op and the case hangs to its timeout |
| M-08 | `WRK/test/relay_unit_test.c:1474, 1488` | `source_dial` tells "the bind refused" from "the connect was refused" by the socket's own end after a refused connect: it rests on the kernel keeping the address it chose. Extends first-pass N-11; a counter of connects asked would not |
| M-09 | `WRK/test/static/pinned_calls.py:235-239`; `WRK/relay-check.sh:47, 63, 193` | The token rules read the worker's `src/*.c` only: the relay has spelling rules and the import net. `(bind)(...)` or `(connect)(...)` passes `:47` / `:63`, and the import net cannot list either (both are needed). The relay's own socket rule is the dynamic guard |
| M-10 | `CS/capture/adapters/camera/__tests__/onvif-session.test.ts:440-446` | The deep-nesting case accepts either of two outcomes and any reason |
| M-11 | `CS/modules/capture-discovery/readdress-route.ts:256-257` | A `404` AFTER the change was committed, if the device is gone from the slice; not reachable today (the idle lock) |
| M-12 | `WRK/check.sh:223` | The worker's selftest matches `": $tag"` as well; its planted lines each aim at one sub-rule and the pinned-call table refuses by its own message, so the gap of S-07 is small here |

## 7. The five items of the brief

### 7.1 The destination rule and its binders

Read in full with its test. Every address class traced to its refusal:

| Input | Where decided | Result |
|---|---|---|
| leading zero, octal, hex, bare integer, 3 or 5 parts, part above 255, trailing dot, glued port or prefix, blank, line end | `destination-rule.ts:192, 206-216, 234-246` | `MALFORMED_IPV4`. `\d` is ASCII in this engine; `$` does not match before a final line end |
| longer than 64 characters, not a text, empty | `:250` | `NOT_AN_ADDRESS`, before any expression runs |
| IPv4-mapped, compatible, translated; `::`, `::1`; any other IPv6; brackets; a zone | `:198-201, 236-244` | their own refusals. No branch of `refusalOfText` returns a value |
| loopback, 0/8, link-local, multicast, 240/4, public, 100.64/10 | `:253-258` | refused before the host's facts are read |
| the subnet test | `:219-221, 279-283` | exact arithmetic on numbers; a camera subnet must be private, /16 to /30, with no host bit (`:292-293`) |
| the source half | `:356-366` | inside the camera subnet: the first OWN address of the interface, which `factsOf` held inside that subnet (`:299`); outside: an alias whose /24 holds the target, for the two commissioning purposes only (`:104, 363`) |
| absent facts | `:290-291, 351`; binders `production-parts.ts:58, 64-77, 89-102, 604-615` | no reader, null, a throw, any member not well-formed: `NOT_CONFIGURED`. No reader path leads to an admission |

`allowed: true` is built at ONE line (`:373`), after a target that is private, not the host's, in no other interface's subnet, with a source found, not an edge, and a listed port. **No path returns "allowed" without a positive match.**

The test is honest: every refusal of the vocabulary is reached (`destination-rule.test.ts:428-446`), each with its control (`:54-76`); expectations are exact values.

Duplicated judgement between the purposes: the four bindings are one function with a purpose (`production-parts.ts:75, 100, 141, 187`), no second rule. What is repeated is the facts-reading body (M-03) and the dotted form (S-06). The port half: S-04.

### 7.2 The ONVIF session and set-network files

- XML: B-01. Entities and nesting: check 2.
- Bounds: connect 3 s, request idle 5 s, 1 MiB received, 16 profiles, token and locator forms. The whole-test deadline is the CALLER's signal: a caller with a signal that never aborts has only the idle limit.
- The bound local address: every socket of the one agent (`onvif-session.ts:552`; `onvif-network.ts:359`, which also forces host and port and cuts the call when the package strays, `:358-364`).
- What of a reply leaves: reason codes, counts, tokens held to `[A-Za-z0-9_.:-]{1,64}`, two bounded numbers, the locator after `credentialFreeLocator`, six pairs of a hardware address. No error object, fault text or envelope (`failureOf`, `:277-288`). Nothing is logged by either file.
- Digest: never Basic - the package answers Digest headers only (`cam.js:331-336`) and the wrapper refuses a hash outside MD5 / SHA-256 (`:604-610`); the first request of a read carries nothing; one refused request ends the call. A nonce is used once (a new client per exchange). The two values stand on the client object from `arm` to `finish` (`:613-624, 628-631`): the length of one exchange. MD5 with a nonce of the device's choice lets the device test guesses offline: stated in the file (CT-6), not new.

### 7.3 The three composition files

No door is set twice (`connect/index.ts:212-215`; `readdress-route.ts:188-191`; `capture-composition.ts:171, 512, 516, 707`). A door that refuses throws, and the entry point ends the process on it (`src/index.ts:120, 133-136`): no half-composed Core survives. Order: the composition runs after `app.ready()` and before the boot steps; the network reader is handed in, not called. Fail-open members: S-02, S-03. Notes M-04, M-05, M-06, M-11.

### 7.4 The tests

**Would pass with the feature removed or the check inverted** (in what was read):

1. `relay_unit_test.c:1488`, "dial: the socket's own end is the source address of the start message" - on loopback an unbound socket has the same address (M-08; first-pass N-11). The case that fails without the bind is `:1473-1474`.
2. `row143b_source_bind.py` case `probe_from_loopback` (`:181`) - the same; the fixture says so (`:29-34`). Its cases with `192.0.2.1` DO fail without the bind.
3. `onvif-session.test.ts:1102`, "the address this host holds ... (control)" - the same on the Core side.
4. `relay-check.sh --selftest` for each rule line of S-07: the RULE can be removed and the selftest stays green.
5. `onvif-session.test.ts:440-446` third part: any refusal passes (M-10).

Everything else read asserts exact values of the product: the unit test (982 checks: RFC 2617 and RFC 7616 vectors, every refusal with "nothing of it was kept", every report line byte for byte and at every room size), the fuzz entries (bounds of `relay.h` as `must`), the destination rule's table.

**Asserting on its own fixture:** the fixtures' counters of the test camera (`redirects_sent`, `foreign_control_descriptions`, `row152_hostile_relay.py:92-97`) are used as CONTROLS that the hostile switch fired, beside a criterion on the relay's exit code and on the other port's connections - not instead of one. Sound.

**Negative controls:** real ones - `relay_fuzz_controls.sh` (24 mutations, each with a staleness check; check 3: none stale; not part of `make`), `row043_reopen.py:371-384` (a relay built from a mutated copy, staleness checked), `row153_confinement.py:192-211`, `row143b` `record_from_loopback_is_seen`. The weak one is S-07.

**Do the planted lines trip their rule:** `planted.tsv` - each line aims at one rule and the refusing message is the rule's own for the pinned-call net (M-12). `relay-check.sh` - by tag only (S-07).

**Flakiness:** S-08 (`service.test.ts`, cause confirmed), S-09 (`INGEST_OPEN_STUCK`, hypothesis), S-10, M-07.

### 7.5 The camera facts

S-01. The first pass's F3-07 (`devices-step.tsx:466`) stands at head, unchanged. No reader was found that invents a PROFILE; `storedProductionFactsOf` answers null without a stored token (`capture-composition.ts:244-249`).

## 8. Read in full / read in part / not read

| Item | Read in full | Read in part (what) | Not read |
|---|---|---|---|
| 1 | `destination-rule.ts`, `__tests__/destination-rule.test.ts`, `fence/production-parts.ts`, `camera/stored-address.ts`, `camera/__tests__/stored-address.test.ts`; also `capture-config/network/facts.ts` | - | `__tests__/stored-address-cases.ts` |
| 2 | `onvif-session.ts`, `onvif-network.ts`; of the package `lib/cam.js:255-375, 430-480`, `lib/utils.js:40-110` | `__tests__/onvif-session.test.ts` (all case titles; `:356-451`) | `__tests__/onvif-network.test.ts`; the rest of `onvif-session.test.ts` |
| 3 | `connect/index.ts`, `readdress-route.ts`, `capture-composition.ts`; `src/index.ts:100-137` | `connect/service.ts` (two lines and `holdsClearSecret`) | the tests of the composition |
| 4 worker | `test/relay_unit_test.c`, `test/relay_fuzz.c`, `test/relay_fuzz_controls.sh`, `check.sh`, `relay-check.sh`, `test/static/pinned_calls.py`, `test/static/planted.tsv`, `row58_gate.py`, `row143b_source_bind.py`, `row152_hostile_relay.py`, `row153_confinement.py` | `row043_reopen.py` (`:196-385`, its sleeps), `rtsp_test_camera.py` (outline, `:513-560`), `e11_listener_path.py` (`:28-97, 205-294`), `capture_worker.c` and `ingest.c` (the give-up bound) | `row041_relay.py`, `row042_probe.py`, `row186_bounds.py`, `br09_gate.py`, `row176_camera_end.py`, `rtsp_test_camera_check.py` (of these only the list of their sleeps) |
| 4 Core | - | `connect/__tests__/service.test.ts` (`:340-400`), `__tests__/adopted-test.test.ts` (three places), `capture-discovery/__tests__/static.test.ts` (titles, rule 4); a search of every sleep and timer in both test folders | `onvif-relay.test.ts`, `stream-probe.test.ts`, `camera-watch.test.ts`, `probe-answer`, `discovery-*`, `loopback-guard`, `ws-discovery` tests; `readdress*.test.ts`, `search*.test.ts`, `limits*.test.ts`, `session-expiry*`, every `*.db.test.ts` |
| 5 | - | `state-slices.ts:505-575`, `devices/status.ts:100-220`, `devices/index.ts:105-125`; every reader LINE of `resolution`, `fps`, `codec` in web and mobile, and three readers around those lines | the slice schemas beyond `cameras`; the readers as whole files; the live source that feeds them |

**Why items 4 and 5 are not complete.** The list of item 4 is about 22,000 lines (8,800 worker, 13,100 Core). This pass put the product files of items 1 to 3 and the worker's unit, fuzz and static nets first, and read about 9,500 lines in full. **About 11,000 lines of Core-side tests and six worker fixtures were not read.** For them the questions "would it pass with the feature removed" and "does it assert on its own fixture" are NOT answered; only their sleeps and timers were listed. A defect in what was not read is not excluded. If gate M3 needs those questions answered for every test, a third reader on the Core-side tests alone is the way.

## 9. What was done well

- The destination rule is one pure function with one line that admits; its table reaches every refusal and states a control for each.
- The relay's unit test asserts bytes, not shapes, and copies every input to a heap block of its exact length so that the sanitizer build guards the end.
- The fuzz controls and the selftests check their own staleness (`cmp` on the mutated copy): a control cannot rot silently.
- The fixtures that assert an absence pair it with a control that proves the counter counts (`record_from_loopback_is_seen`).
- Every door of the composition refuses a second provider, and the entry point ends the process on a refusal.

## 10. Assumptions and gaps

- Line numbers are of the working tree at the time of this pass; `connect/service.ts` was under an in-flight edit.
- B-01's times are of this Mac (node v26.8.2); the production host's are not known. The real size of a `GetProfiles` answer is not known to me.
- S-09 is a hypothesis with its experiment named. S-01's last sentence names what was not traced.
- "No writer" and "set by no production file" (S-01, S-04) rest on text searches of `packages/shared/src` and `apps/core-server/src`; a write by a computed name would not be seen.
- No file other than this one and `delegation_progress/row_060b.md` was written. Check 3 wrote one script under the session's temporary directory.

---
*Generated: 2026-10-13*
