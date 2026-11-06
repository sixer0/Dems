---
task_id: 2026-10-12_input_av_core_adapter_plan
row: 60e
milestone: M3 (fifth reading pass of row 60: the PRODUCT code four passes never read; decision C111)
date: 2026-10-14
agent: senior-code-reviewer
tier: T1
reviewed: branch task4/input-av-core-port, commit 1fbeada7, read from an export of that commit (not from the working tree, which other agents are editing)
status: needs-review - list A read in full or by its whole diff with five named exceptions; list B read by its code lines; lists C and D read IN PART (section 8 says exactly where this pass stopped)
---

# Row 60e - fifth pass of the code review of phase 3: the product code nobody had read

## 1. Verdict

**PASS WITH FOLLOW-UPS. BLOCKING findings for the lift (row 88): 0.**

Nothing in what this pass read lets a typed credential outlive its job, dials an address the destination rule did not return, or records with a production kind on a path that is wrong on a likely input. Every finding below is either improbable in its trigger, fails closed, or is a statement on a screen. That is a judgement by reading only: nothing was run.

Counts: follow-ups **17** (E-01 to E-15, E-17, E-18), notes **4** (E-16, E-19, E-20, E-21). Five follow-ups are conditions row 88 should tick before production kinds record (marked LIFT); two more belong before the first full session (M6) because they touch what the SIGNED manifest states.

The three that matter most:

1. **E-04** - the camera adapter can hand on a `REOPENED` whose loss number the listeners were never told as `LOST`. The camera watch then CLEARS the fault while the session keeps the absence OPEN to the end of the capture, and signs it as `NOT_RE_OPENED`. Two readers of one relay, two answers; reachable only when a relay line is lost.
2. **E-06** - the audit entry of a video absence is retried once on ANY failure, and the seal's reader does not recognise a repeat. A commit whose outcome was not known writes the entry twice; the manifest's own ordering rule then refuses the session. The same holds for the audio gap. Rare, and repairable in the reader afterwards.
3. **E-01** - the Core itself publishes `streamState: LIVE` and `online: true` for every ENABLED camera each time the slices are built from the database. This is the source of the fourth pass's Q-05, which it took for a leftover of a recording; a reader-side fix (row W5) cannot remove it.

## 2. Frame, method, limits (5W1H)

| | |
|---|---|
| What | The product diffs of the follow-up rows R1, R1b, R2, B1 (call sites), B2, V6, V6b, 143c, 85d, 106 / 106b / 106c, 111 / 111b, 108, 117; the discovery product files; the live source; the tablet's selector folder - as committed at `1fbeada7` |
| Why | Decision C111: four passes read tests and the first versions; the code the follow-up rows wrote afterwards was read by no pass (060d Q-12) |
| Who is affected | the controller (rows 61, 86, 88, 90), the owners named per finding |
| When | 2026-10-14 |
| How | `git archive 1fbeada7` of `apps/core-server/src`, `packages/shared/src/live`, `packages/shared/src/sim` and the tablet folder into the session scratchpad, then file reads, `git diff 0f5d2a8e 1fbeada7 -- <path>`, text searches. Three ways of reading are told apart in section 8: WHOLE (every line), DIFF (every hunk of the row's change), CODE LINES (comment lines filtered out before reading - what a comment promised was then not checked against the code). No test, suite, build, typecheck, port, database or lock. The Graft graph exists and was not queried |
| Not reviewed | the in-flight edits named in the brief. `modules/devices/status.ts`, `packages/shared`, `apps/mobile` were read as committed, from the export |

`CS` = `apps/core-server/src`, `SH` = `packages/shared/src`, `MOB` = `apps/mobile/src`. Line numbers are of commit `1fbeada7`.

## 3. What the brief asked to trace, and the answer

| Question | Answer | Evidence |
|---|---|---|
| Does any exit of the set-IP job keep the typed account? | No, in this file. `startCameraNetworkJob` drops it in `finally` for every refusal (`:588-593`); `run` drops it in `setOnce`'s `finally` (`:928-931`) and again in its own (`:988`). The set-network file disarms in `finish` and V6b's guard keeps a finished call from arming again (`onvif-network.ts:446, 513`). Two limits: E-05 (the SESSION file has no such guard) and E-12 (the two alias calls are not under the job's bound) | `CS/modules/capture-config/camera-network/service.ts` |
| Does any exit leave an alias up? | Not silently. Scan: asked away in `finally` per group (`factory-scan/service.ts:625-642`). Job: `aliasToRemove` is set for every `add` that did not answer `NOT_DONE` and asked away at `:948` or `:997`. Close of the app: the job's hook is registered before the lifecycle's (`capture-config/index.ts:164, 166`). Left to the kernel lifetime in two named cases: E-12 | as cited |
| A refusal that still sends a packet? | One: E-10 (echo requests to candidate new addresses before the late refusals) | `camera-network/service.ts:693-739` |
| State left behind by a thrown call? | E-09 (network facts after a failed boot read), E-14 (a device the adapter serves and the registry does not list) | sections 4, 5 |
| Two readers that can disagree? | E-04, E-07, E-08, E-13 (b), E-01 | section 4 |
| Time of check to time of use, rule to dial? | The set call is judged on the facts read BEFORE the poll and the neighbour question (`service.ts:868-869`, used at `:913`; `production-parts.ts:238`): up to about 10 s old. It fails closed - every connection is bound to the source the rule named (`onvif-network.ts:361`) - so a vanished alias is "no answer". Not a finding by itself; it is why E-08 matters | as cited |
| An entry written twice, or not at all? | E-06 (twice), E-13 (c) and E-10 (not at all) | section 4 |
| Bounds on device-controlled counts? | Present where looked: 256 datagrams, 64 responders, 8 matches a message, 16 KiB a probe answer, 2 KiB a candidate (`discovery-collector.ts:28-34`, `probe-answer.ts:24-41`); report lines 512 bytes, numbers 9 digits (`relay-start.ts:116, 174-186`); the neighbour and echo outputs 1,024 characters and 8 lines (`production-parts.ts:434-435, 489-490`). NOT bounded: the number of absences of one session (one audit entry and one manifest record per loss; the manifest's array has no maximum, the verifier reads up to 64 MiB) - stated, not judged a defect | as cited |
| Fail-open defaults? | S-03 is still as found at head, and one more of the family: E-02 | section 4 |
| B1: do the two call sites cover every reply path? | Yes. The guard hangs on the agent's `addRequest` (`onvif-reply-guard.ts:390-430`), so it sees every response of every request the package makes through that agent: the first request, the Digest retry (`cam.js:340`), the gateway read-back, and error replies - the package parses a body of ANY status in the same `end` listener (`cam.js:351-369`), which is not called after a refusal. Both files give the package no other agent (`onvif-session.ts:546-548, 615`; `onvif-network.ts:355, 421`). A 401 with a challenge is not parsed as a body; its header is held to 2,048 characters before the package's parse (`onvif-network.ts:246-250, 437`) | as cited |

## 4. Findings: the follow-up rows (list A)

| ID | File:line | Finding, and why it matters | Row | Smallest fix |
|---|---|---|---|---|
| **E-01** (LIFT) | `CS/modules/capture-config/slices.ts:125, 163-164`; `SH/sim/capture-telemetry.ts:108-113` | **`enabled` is published as "stream LIVE".** Each time the two selector slices are built from the database, a camera line and a registry entry say `online: device.enabled` and `streamState: LIVE` for an enabled camera - a column an operator set, stated as a stream nobody opened. Telemetry corrects it only for a camera the worker reports (`WAITING` -> `LOST`), so outside a session, and after every boot, every registered production camera reads LIVE whether it is plugged in or not. The fourth pass's Q-05 named the symptom and guessed another cause. Beside it (`:152`): an EMPTY registry answers the built-in five devices; whether a production Core can hold an empty registry was NOT traced | before task 4; no row | The devices slice states `streamState: null` for a camera until telemetry states one (the member is nullable there); the config line needs the contract's leave. Until then row W5's reader rule is the only line, and the gate should say so |
| **E-02** (LIFT) | `CS/capture/adapters/camera/onvif-relay.ts:305`; still as found: `connect/service.ts:264, 375`; `onvif-network.ts:188`; `onvif-session.ts:211, 237, 521` | **One more optional member whose absence turns a function off.** `relayEnded?` : without it a relay that ends by itself after its open is told to nobody, and no fault is raised. The production bundle states it (`capture-composition.ts:528`), as it states the other three - so none is open today; each is one refactor from silent. S-03 of the second pass is unchanged at this commit | 46, 49; S-03 | The four members required in their types; a test double states them |
| **E-03** (LIFT) | `CS/capture/adapters/camera/camera-watch.ts:307-315, 348, 524, 542-546` | **The watch keeps its loss state across sessions.** `lostStreams`, `lostLegs` and `raisedHere` are cleared by a later push only; `close()` clears the heartbeats and nothing else, and no call says "the session ended". A camera lost at the end of one session is in `lost()` until its next established push, which may be days later or never (the camera is unassigned). By reading it heals: the next push drops the stale entry and the sink answers the stale clear with `ENDED_BY_ANOTHER` (`production-parts.ts:826-830`), so no audit entry is written twice. What is NOT shown: that nothing reads `lost()` between sessions - the watch has no caller under `src/` yet | 49, R1 | Row 88 states who reads `lost()`; or one function that forgets the three collections when a capture ends, and one case |
| **E-04** (before M6) | `onvif-relay.ts:531-546`; `CS/capture-session/index.ts:1347, 1357`; `camera-watch.ts:490-496` | **A re-open the session cannot match.** When a `LOST` of a higher number arrives while a loss is open, the adapter moves `lossOpen` to the new number and hands nothing on ("the absence that was told goes on"). The `REOPENED` of that new number IS handed on. The watch matches by relay and clears the fault. The session matches by the number it was told (`open.loss !== leg.loss -> return`): its absence stays open, every later loss of that stream is ignored (`:1347`), and at the end it is written `NOT_RE_OPENED` with "at least" reaching to the end of the capture - a signed statement that a camera stayed away which came back. Needs the relay to say `LOST n+1` without `REOPENED n`, which a correct relay does not; a dropped report line does it | R1, R1b | In the adapter: remember the number that was TOLD and hand the re-open under it. One case with a skipped line |
| **E-05** | `CS/capture/adapters/camera/onvif-session.ts:638-646, 705` against `onvif-network.ts:446, 513` | **V6b's fix landed in one of two copies.** In the set-network file a finished call is never armed again. The session file - the one every camera open and every connection test uses - has no such line: after a cut, `finish` disarms, and a course that goes on to its next read arms the client again (`if (!armed) arm(...)`). No request leaves (`ask` answers an ended exchange without one), so nothing is sent; the two texts stand on the package's client until the exchange is collected. Caution R119-09 exactly, in the other file | V6b | The same two lines: `if (settled) return;` in `arm`, `if (settled) return ask(read, invoke);` first in `authorizedAsk` |
| **E-06** (before M6) | `capture-session/index.ts:1444-1452` (and `:1078-1086`); `CS/sealing-host/session-reader.ts:443-466, 390-406`; `SH/evidence-package/manifest.ts:469-471`; `CS/core/unit-of-work.ts:396-410` | **A retried audit entry can make a session unsealable.** The unit that writes `CAPTURE_VIDEO_ABSENT_IN_SESSION` is run once more on any failure. `COMMIT_FAILED` covers a commit whose answer never arrived - the row may be stored. The second run then stores the same attempt and loss again; the reader maps every row; the manifest refuses "a higher loss number of the same attempt"; `BUILD_MANIFEST` fails, and the audit chain is append-only. The audio gap has the same shape. Nothing is lost: a reader that knows a repeat seals the session later | R1b, 191b, 191c | In the two reader functions: an entry equal in every member to the one before it is the same fact, stated once. One case each |
| **E-07** | `session-reader.ts:464-465` | The "last attempt" that decides which absences are signed is the highest number the session's AUDIT ROWS name. A restart whose audio-gap entry could not be written (`CAPTURE_AUDIO_GAP_NOT_AUDITED`, `index.ts:1088`) and that had no absence of its own leaves the earlier attempt as "last": its absences are signed for files that hold nothing of that attempt | R1b | The attempt from the capture facts the reader already reads; or refuse to state absences when the error log's code is on record for the session |
| **E-08** | `CS/modules/capture-config/network/service.ts:197-238`; `camera-network/service.ts:613-622, 868-869, 913` | **The network configuration can be changed while a scan or a set-IP job runs.** Operation 102 asks whether a session is open; it does not ask the one turn of the commissioning functions. A job that planned its new address inside the old subnet then writes it into the camera with the facts it read earlier, and waits 180 s for a camera the new facts refuse. Needs two technician actions at once | 108, 111 | `409 COMMISSIONING_JOB_IN_PROGRESS` while the scan's gate is busy, before the unit |
| **E-09** | `network/index.ts:159-171`; `network/service.ts:210-212` | A boot read that fails leaves the facts unknown "until a change commits or the Core restarts" - and a change that changes nothing takes the early way out without `committed`. The technician must alter a value to get the stored one read. Fails closed (every address refused, with the word "not configured" for a Core that is) | 108 | On the no-change path, hand the row just read to `committed` |
| **E-10** | `camera-network/service.ts:693-734` before `:737-739`; header `:34-58` | **A refused job has already asked the network.** "Is the new address free" runs the echo and neighbour programs - up to 16 candidates, three observations each - BEFORE the session is looked at again and before the guard's second word; `CAMERA_NEW_ADDRESS_IN_USE` and `CAMERA_NO_FREE_ADDRESS` come after them by nature. None writes an audit entry or a log line of its own. The header's "each sends nothing to the camera" is true to the letter; packets do leave on the camera port, and a session that opened meanwhile is noticed only afterwards | 111, V6 | The session and guard checks once more BEFORE the observations; one log line with the count of observations on every refusal after them |
| **E-11** | `camera-network/service.ts:153-159, 934-945`; `onvif-network.ts:588, 597` | **The gateway's outcome is dropped.** The set-network file answers `gateway: NOT_CONFIRMED` and `reboot: REFUSED`; the job's shape of that answer has neither member. A camera whose gateway was not taken ends `COMPLETED`, with no word in the job, the audit entry or the log | 110, 111 | The two words into the closing audit entry and the log line (both are closed sets); the job answer when the contract next opens |
| **E-12** | `camera-network/service.ts:838, 854`; `CS/capture/host-alias/lifecycle.ts:286-288, 338-353` | Two places where the Core's own second line is absent. (a) `alias.add` and `alias.remove` are not under the job's `bounded`: the job - and the holder of the typed account, not yet taken - waits as long as the helper call does. Whether row 105's caller bounds it was NOT read. (b) An `add` that the helper confirmed and whose row cannot be read back falls to `removeOpen`, which returns at "state unreadable" before it arms anything: no retry, no lifetime timer. The address then rests on the kernel lifetime alone, which is hypothesis H-S until hardware check 9A/H-06 | 106, 111 | (a) read `caller.ts` for its bound, or put the two calls under `bounded`; (b) arm the retry when the state could not be read after an `add` |
| **E-13** | `CS/modules/capture-config/factory-scan/service.ts:646-655, 663, 698` | Three small ones in the scan. (a) An address inside the camera subnet that the rule no longer admits at the second judgement - or facts that turned "not configured" - is dropped silently and the scan answers `COMPLETE`; the alias groups say `ALIAS_NOT_IN_PLACE` for the same case. (b) Only a scan that ended with an answer is remembered, so a job is still bound to the scan BEFORE a later one that failed (held by the 10-minute age and the hardware-address binding). (c) The one audit entry is written after every probe: when it fails, a scan that asked the network left no record | 107, V6 | (a) fewer targets than planned is a named failure; (b) a failed scan forgets the last; (c) accepted or an intent entry, as the job has |
| **E-14** | `CS/capture/fence/index.ts:515-517` | `take(entry)` then `registry.register(...)`: when the second throws, the adapter serves a device the registry does not list. Harmless (nothing resolves to it) and idempotent on a retry; nobody retries but the next boot | 85d | Noted; register first if the registry allows a removal, else leave |
| **E-15** | `CS/modules/capture-config/routes.ts:302-312, 396-399` | `CAMERA_ON_BOTH_TRACKS` is judged on the state read BEFORE the action. Two edits at once can each pass and leave one camera on both tracks; the start then refuses it as `PROTOCOL_SHAPE` (`plan.ts:132-134`), not by the named reason. Fails closed | R2 | Judge inside the unit of the action |
| **E-17** (hypothesis) | `CS/modules/capture-config/installation-acceptance/service.ts:254-258`; `SH/sim/maintenance.ts:50-108` | The acceptance stores the diagnostics run as its permanent record. Four of its rows say "Not reported" on a Core in its own capture. The others - `CAMERA` ("Both lenses READY"), `AUDIO`, `CPU`, `TIME` ("GNSS stratum 1") - are computed by the shared simulator transition from `state.cameras`, `state.mics`, `state.health`, `state.time`. Whether a production Core states those inputs itself was NOT traced (060d N-03 is the same open end). If it does not, an acceptance records a pass nobody measured | 117, V6 | Trace the four inputs; a row over an input the Core does not read says `NOT_REPORTED` |

## 5. Findings: discovery (list B), live source (list C), tablet selector (list D)

**List B.** The discovery adapter is bounded at every point a device controls, refuses a declaration before the parser sees the text, takes an answer only from an address on a probed link and never from the host's own, and closes its one socket on every way out (`ws-discovery.ts:222-239`). The search runner sends nothing on a refusal (`search.ts:303-330` precede `store.begin`). No finding of weight.

**List C.** The fourth pass's sentence stands for what was read here: the live source puts no simulator value in the place of a Core's fact. Two literals remain, one of them with a lift context:

| ID | File:line | Finding | Row | Smallest fix |
|---|---|---|---|---|
| **E-18** (known as M2 F-02) | `SH/live/source/neutral-state.ts:48-50`; `live-sim.ts:925, 1046` | When the link turns stale and at sign-out the client writes an `audio` slice of its own: inputs `MIC-01` and `MIC-02`, `activeInputId: 'MIC-01'`, both "no signal". After the lift a session's microphones are registry ids of their own and the active one may be none: the client then names two inputs the Core never stated and says one is active. "No signal" is also a statement about a microphone; "not measured" is the word the Core's own frames have | M2 F-02 | The frames of the inputs the slice held, each "not measured", `activeInputId` as it was |

Also seen, not judged: `clockSliceAt` states the simulator's time zone constant in Live mode (`neutral-state.ts:58-60`); whether the Core replaces it was not read.

**List D** (seven files read, as committed; the folder is being edited now):

- `use-capture-selector.ts:62-73` - for any "invalid" answer to a camera command the tablet looks in its OWN state for the device on the other track and says so, before it reads the Core's reason. Since row R2 the Core says `CAMERA_ON_BOTH_TRACKS` itself; a guess stands where a stated reason exists (the family of 060d N-08).
- `capture-selector-port.ts:77, 107` - operation 79 with a track and no profile: 060d Q-02, unchanged at this commit.
- Nothing else found in the two ports, the two hooks and the search model: every port answers "offline" instead of throwing, a refused search during a recording is remembered per session, the progress bar never runs backward.

## 6. Notes

| ID | File:line | Note |
|---|---|---|
| **E-16** (AD-08) | `capture-config/{camera-network:176, factory-scan:166, host-alias:99, network:181, installation-acceptance:94}/index.ts`; `ws-discovery.ts:134-140`; `discovery-collector.ts:178`; `production-parts.ts:234, 520-531`; `capture-composition.ts:364, 371, 386` | Members under `src/` that exist for a test: five `replaceForTest`, the loopback fixture with its synthetic interface and its own parser, a default rule parameter, the door / program / bound of the host observations, three members of the composition's input. Each is a place where a handed-in value stands for a guard. The file comments say "no production file calls it"; this pass confirmed that for `loopbackFixture` only (one text search) |
| **E-19** (drift) | `camera-network/service.ts:366-407` = `factory-scan/service.ts:283-436`; `onvif-session.ts:536-725` ~ `onvif-network.ts:346-537`; `probe-answer.ts:98-107` ~ `factory-scan/service.ts:321-332`; `lifecycle.ts:177` = `journal.ts:148` | Beside the three stream-facts decoders: `judged`, `supposing`, `firstThreeOf`, the quad pattern and `codeOr` twice (about 50 lines); the agent, guard and credential block of the two ONVIF files as a near copy (about 180 lines) - E-05 is that copy having drifted already; two cleaners of device text that already differ (U+061C is taken out by one and kept by the other) |
| **E-20** | `lifecycle.ts:396-406`; `journal.ts:182-189, 234-240` | The boot sweep writes an intent and a result entry for every candidate address it has no row of - up to 40 addresses, so up to 80 audit entries at each boot of a production Core on Linux, when nothing was on the port |
| **E-21** (question) | `discovery-collector.ts:63-80`; `ws-discovery.ts:187, 265-293`; `search.ts:253` | A camera search probes every eligible interface of the host (at most four), not the stored camera interface; its audit entry says scope `CAMERA_NETWORK`. By design since row 131 (DS-2). After the lift a candidate from another network is listed and then refused at its test (row 143c) - honest, and a question for row 88 whether production should search the camera interface only |

## 7. For the lift (row 88)

**Must be fixed before production kinds may record: nothing found.** No blocking finding.

**To tick at the lift** (conditions, each checkable in minutes):

| Item | What to show |
|---|---|
| E-02 with S-03 | the four optional members are required, or the gate's record says they are stated by the one production maker and names the line |
| E-03 | who reads the watch's `lost()` and when; that the watch is attached before the first session can start, so that the early-loss store (`capture-composition.ts:267, 483-490`, 64 kept, each reported) holds nothing |
| E-01 | joined to Q-05: the record says the Core states LIVE for an enabled camera, and that row W5's reader rule is the only line until the slice changes |
| E-05 | the two lines |
| E-18 | joined to M2 F-02 |

**Before the first full session (M6):** E-04, E-06, E-07 - they decide what a SIGNED manifest says of an absent camera, and row 90's case "a dropped camera leg" is where they would show.

**May wait:** E-08 to E-15, E-17, the notes.

## 8. Read in full / in part / not read - this pass

| Area | WHOLE (every line) | DIFF or CODE LINES | Not read |
|---|---|---|---|
| Set-IP job (111, 111b, V6) | `camera-network/service.ts`, `index.ts`, `routes.ts`, `store.ts` | `production-parts.ts:126-248, 388-680` (the bindings and the two parsers) | `production-parts.ts` beyond those ranges and `:700-846` |
| Scan (107, V6) | `factory-scan/service.ts:60-711`, `index.ts:60-205`, `routes.ts:20-53` | - | the file headers (`service.ts:1-59`) |
| Alias (106, 106b, 106c) | `host-alias/lifecycle.ts`, `job-port.ts`, `journal.ts:60-253`, `facts.ts:30-156`; `capture-config/host-alias/service.ts:20-115`, `index.ts:28-123`, `routes.ts:20-56` | - | **`host-alias/caller.ts` (496), `protocol.ts`, `store.ts`, `host-alias-socket.ts`** - the helper call's own bound and the row statements |
| Network facts (108) | `network/service.ts`, `network/index.ts:30-226`, `network/facts.ts:40-185` | - | `network/routes.ts`, `network/store.ts` |
| Acceptance (117, V6, V6b) | - | CODE LINES: `installation-acceptance/service.ts:60-349`, `store.ts:30-208`, `index.ts:60-139` | `routes.ts`; the migrations |
| Set-network file, reply guard (110, B1, V6b) | `onvif-network.ts:60-608`; `onvif-reply-guard.ts:60-120, 360-430`; `onvif-session.ts:500-760`; the package's `cam.js:300-375` | - | `onvif-session.ts:1-499, 761-919` (the courses); the guard's two scanners (read by pass 4) |
| Relay, watch (R1, 143c, 85d) | `relay-start.ts`; `onvif-relay.ts:70-721`; `camera-watch.ts:60-548`; `capture-composition.ts:360-834` | CODE LINES: `fence/index.ts:405-700` | `capture-composition.ts:1-359`; **`stored-address.ts` and `stream-probe.ts` as changed since pass 1** |
| Session (R1, R1b) | - | DIFF, every hunk: `capture-session/index.ts` (697 lines of change), `ingest-pairing.ts`; `sealing-host/session-reader.ts`, `sealing/pipeline/contract.ts`, `pipeline.ts`; `manifest.ts:455-473` | the rest of `capture-session/index.ts` (about 1,850 lines); `statements.ts`; `core/audit-details.ts`; `sealing-host/index.ts`; the verifier's report line |
| R2, B2 | - | DIFF: `capture-config/routes.ts`, `plan.ts`, `connect/service.ts`, `modules/devices/status.ts`; `slices.ts:72-178` | `connect/index.ts`, `connect/limits.ts`, `connect/statements.ts`, the rest of `status.ts` |
| Discovery (list B) | - | CODE LINES, whole files: `ws-discovery.ts`, `onvif-discovery.ts`, `connection-target.ts`, `onvif-rtsp.ts`, `discovery-collector.ts`, `probe-answer.ts`; `capture-discovery/search.ts`, `typed-address.ts`, `limits.ts`, `search-ids.ts`, `session-expiry.ts`, `store.ts`, `registered.ts`, `index.ts:40-377` | `capture-discovery/routes.ts`; `adoption.ts`, `readdress.ts`, `readdress-route.ts` beyond the earlier passes' ranges |
| Live source (list C) | - | IN PART: `live-sim.ts` by a search for defaults and stand-ins and five ranges (about 90 of 2,696 lines); `neutral-state.ts:40-60`; `capture-telemetry.ts:84-150`; `maintenance.ts:36-120`; `core-facts.ts:225-285` | **`live-sim.ts` but for that; `bindings.ts`, `command-gate.ts`, `live-result.ts`, `types.ts`, `structural-sharing.ts`, `touch-throttle.ts`, `rebuild-error.ts`, `clock.ts`, `index.ts`** |
| Tablet selector (list D) | - | CODE LINES: `capture-selector-port.ts`, `capture-discovery-port.ts`, `use-capture-selector.ts`, `use-camera-search.tsx`, `camera-search-model.ts`, `settled-busy-state.ts`, `mic-input-name.ts` | **eleven files: `capture-selector.tsx`, `capture-source-sheet.tsx`, `camera-search-panel.tsx`, `mic-rescan.tsx`, `capture-notices.tsx`, `development-source-badge.tsx`, `local-source-notice.tsx`, `local-source-notice-model.ts`, `open-local-sources.tsx`, `settings-capture-section.tsx`, `i18n.ts`**; the two models beyond pass 4's outline |
| Engine (to judge E-06) | - | `engine/host.ts:600-700`, `core/unit-of-work.ts:380-412`, the error log's header | everything else of both |
| Records | the four earlier passes' reports (060d whole; 060, 060b, 060c through 060d's closing statement only), decisions C93 to C111 as named | - | **the implementation records the brief names (`r1_relay_report_reader.md`, `r1b_video_absence_signed.md` and those of the other rows)**; the three reports 060, 060b, 060c themselves |
| History | `git diff --stat 0f5d2a8e 1fbeada7` over `apps/core-server/src` | - | `git show --stat` of the two checkpoint commits beyond their last lines |

**Where this pass stopped, and why.** Volume: about 9,000 lines were read whole or by diff before lists C and D, in the order of the brief. List A is complete but for five named gaps (the helper's caller, two files changed since pass 1, the courses of the session file, the unchanged four fifths of the session unit). List B is complete by code lines. List C was searched, not read. List D: seven of the eighteen files. The row records were not opened: every statement here is about the code, and none was checked against what its row claimed. A defect in what was not read is not excluded.

## 9. What was done well

- The set-IP job states its refusals in one order and keeps to it; the typed account has one holder with three operations and is emptied on every way out, including the one where the route's own argument evaluation throws.
- The job's alias port turns four different endings of an `add` into two words with one rule ("`NOT_DONE` means nothing of this job is there"), and both callers follow it without a copy of the reasoning.
- The neighbour and echo readers refuse to call an address free on an exit code: the program must state its one sentence, and "no entry" is "not known". This is the careful reading of a tool that can end with 0 without having asked.
- The relay report reader judges a whole line against an anchored form and keeps nothing of a line it drops.
- The seal's reader throws on an audit entry it cannot read instead of signing fewer absences than the chain holds - which is also why E-06 fails closed.

## 10. Assumptions and gaps

- Nothing was run. Every "can" in section 4 is a path read in the code; none was reproduced.
- E-06 rests on reading `COMMIT_FAILED` as "the outcome may not be known" (`unit-of-work.ts:396-401`); the retry's second run was not tried against a stored first.
- E-01's sentence about an empty registry, E-03's about `lost()`, E-12 (a) and E-17 are labelled where they stand: not traced.
- "Row" names the row that wrote the lines as the brief attributes them; the records were not read to confirm.
- No file was written but this one and `delegation_progress/row_060e.md`. The export of the commit lies in the session's scratchpad, outside the repository.

---
*Generated: 2026-10-14*
