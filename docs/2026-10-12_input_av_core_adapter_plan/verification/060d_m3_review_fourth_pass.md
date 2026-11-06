---
task_id: 2026-10-12_input_av_core_adapter_plan
row: 60d
milestone: M3 (fourth and last reading pass of row 60, over what three passes left unread; decisions C93, C95, C98)
date: 2026-10-13
agent: senior-code-reviewer
tier: T1
reviewed: branch task4/input-av-core-port, head 0f5d2a8e, plus the uncommitted working tree
status: needs-review - lists A and the readers of the brief read in full; list B, the tablet's selector folder and the live source read IN PART (section 10 says exactly where this pass stopped)
---

# Row 60d - fourth pass of the code review of phase 3 (M3), and the closing statement of the review

## 1. Verdict and closing statement

**PASS WITH FOLLOW-UPS. Blocking findings for the M3 gate: 0** - in this pass, and across the four passes once row B1 is counted.

**The closing statement of the review, for row 61.**

1. **B-01 is fixed and the fix is sound** (section 3). The pre-scan is one pass over the bytes with constant memory; the cap of a reply is enforced before the package is handed the chunk that crosses it; a refusal leaves the guard as one of seven codes and neither ONVIF file logs. One residual, measured here and NOT blocking: the scan's model of "the value ends at its line" knows LF and CR, the package's expression also stops at U+2028 and U+2029. A reply built on that is admitted and costs the package 4.65 ms at 128 KiB (0.51 ms for the worst shape the row's test sweeps) - nine times the tested worst, still linear, 50 times inside the asserted budget (Q-06).
2. **M3 may close**, on two conditions the gate can check and a named list it carries forward (section 9): (a) the tree that holds row B1 is COMMITTED and the gate's suite is green on that commit - today the fix exists in the working tree only, and decision C100 records that the instance on port 5178 still runs the affected export; (b) the open items of section 9.3 marked "lift" are entered as preconditions of row 88. Nothing in what four passes read blocks M3 itself: the production camera adapter is still registered nowhere.
3. **What the review does NOT cover, stated plainly.** The product code written by the follow-up rows AFTER a pass had read its file - R1 (the report reader, the adapter's order rules, the watch, the session's `cameraLegSaid`), R2 (`routes.ts`, `plan.ts`, `connect/service.ts`), B2 (the early-loss store of the composition), V6 / V6b - was read by NO pass. Each pass excluded those files as in flight; this pass's list did not hold them. Row B1's guard is the one fix that was read (here). Section 10 lists it with the rest of what was never read.

Counts of this pass: follow-ups **12** (Q-01 to Q-12), notes **8** (N-01 to N-08), tests that would survive a mutation **4** (section 6). Two follow-ups are for the lift:

- **Q-01** - a camera lost INSIDE a session is told by a critical notice only: the track's tile keeps "Live" and the stored format on both clients for as long as the relay holds its push (measured by row R1: the worker's ingest stays connected through a 3 s absence). Row W4's item 6 ("a stale value after a camera loss: DONE") holds for the three fault sources it chose and not for the watch's fault.
- **Q-02** - no client can assign a production camera. Both send operation 79 with a track and no profile; the Core answers `CAMERA_PROFILE_NOT_STATED`, with a sentence that tells the operator to choose a profile no screen offers. Declared by row 187's own request line ("blocking: yes ... after the lift"); no row owns it.

Nothing was found in list A that mocks its subject, binds a fixed port, or leaves a process behind.

## 2. Frame, method, limits (5W1H)

| | |
|---|---|
| What | Code review of what the third pass named as still unread: (A) the discovery tests of the camera adapter and the capture-discovery module, `onvif-session.test.ts` as final; (B) the capture-config tests that drive the camera path; (C) the web and tablet readers of a camera's facts as row W4 left them; (D) the slice schemas of the camera facts and the live source. Then the closing statement of the review across four passes |
| Why | Decision C98: "a FOURTH pass (60d) over exactly these ... gate M3 (row 61) waits for T3, W4 and 60d" |
| Who is affected | the controller (gate M3, row 61; rows 86, 88), the owners named per finding |
| When | 2026-10-13, 18:00 to 18:50 local, working tree as found. Load average during the one check: 3.27 / 3.80 / 4.30 |
| How | Read-only: `Read` of files, text searches, `wc`, `sed` of single ranges. ONE targeted check was run (section 3.2): `node` with the reply guard's own file and a copy of the package's one expression - no port, no database, no lock, nothing written under the repository. No test, suite, build or typecheck was run. The Graft graph exists and was not queried: every finding rests on a file read, a text search or the one command, cited |
| Not reviewed | the in-flight edits of pass I-9b named in the brief. `packages/shared/src/api/state-slices.ts:558-559` (the bitrate made nullable) was seen while reading the schema and is cited as in flight, not judged |

The set of list A was made as the brief asks: the two test folders were listed (45 files, 22,150 lines with `capture-config/__tests__`) and the "read in full" tables of the three passes subtracted. What was left, and was read in full here:

| Folder | Files (lines) |
|---|---|
| `capture/adapters/camera/__tests__` | `ws-discovery.test.ts` (568), `probe-answer.test.ts` (322), `loopback-guard.test.ts` (156), `discovery-collector.test.ts` (303), `discovery-recording.test.ts` (167), `lan-probe.ts` (180), `onvif-reply-guard.test.ts` (459, new with row B1), `onvif-session.test.ts` (1,487), `onvif-network.test.ts:296-751` (the blocks rows B1, V6b and T3 appended after the third pass read the file at 310 lines) |
| `modules/capture-discovery/__tests__` | `search.test.ts:1-440`, `capture-discovery.db.test.ts` (905), `capture-discovery.booted.db.test.ts` (272), `lane-camera-stub.db.test.ts` (176), `limits-store.test.ts` (262), `search-ids.test.ts` (126), `session-expiry.test.ts` (112), `session-expiry.db.test.ts` (166), `static.test.ts` (273) |

## 3. Row B1: is the fix of B-01 sound

### 3.1 By reading (`CS/capture/adapters/camera/onvif-reply-guard.ts`, 430 lines, whole; its use at `onvif-session.ts:536-697`; the package at `onvif/lib/cam.js:300-375`)

| Question of the brief | Answer | Evidence |
|---|---|---|
| The pre-scan is linear | Yes. Every byte moves two state machines by one step; neither looks back; state is 13 numbers | `onvif-reply-guard.ts:192-287` (structure), `:289-343` (namespace shape), `:345-358` (one loop over the chunk) |
| The caps are enforced before the package sees the text | Yes. `push` judges the bytes inside the cap, then refuses the chunk that crosses it as a whole; the wrapped `on('data')` hands a chunk to the package's listener only after `admitted`, and the wrapped `on('end')` - where the package parses (`cam.js:355-369`) - is not called after a refusal. The guard's listener is put first on the request (`prependOnceListener`), and the package registers its body listeners with `res.on(...)` and no other call (`cam.js:351, 355`) | `:349-357`, `:394-426` |
| The cap is the read's, not the exchange's | Yes: asked once per response from the read being asked, never above the caller's limit; an unlisted name gets the smallest | `:100-117`; `onvif-session.ts:595, 689` |
| Nothing of a refused reply is logged | Yes. The guard returns one of seven codes; a text search of the three files for a logger or a console call finds none; `rawResponse` is emitted by the package inside the `end` listener that is not called (`cam.js:366`) | `:48-61`; search of `onvif-session.ts`, `onvif-network.ts`, `onvif-reply-guard.ts` |
| Nothing further is sent after a refusal | Yes: every later read answers `INVALID_ANSWER` without a request, sockets are destroyed, a connection the package would still open is destroyed at creation | `onvif-session.ts:558-561, 596-604, 685-688` |
| The proof fails on the old behaviour | Yes, twice over: by time at 1,000 KiB (row B1, 82.2 s with the guard off), and by BEHAVIOUR at 12 KiB in row T3's case - without the guard the reboot is sent (`onvif-network.test.ts:678-697`); in the session file the "later reply" cases show the same (`onvif-session.test.ts:1319-1349`: a refused `GetServices` is not followed by `GetCapabilities`, a merely cut one is) | as cited |

### 3.2 The one check that was run

`node` (v26.8.2) importing `onvif-reply-guard.ts` and timing `text.replace(/xmlns([^=]*?)=(".*?")/g, '')` (the package's line, `onvif/lib/utils.js:56`), best of three:

| Shape | Guard | 16 KiB | 64 KiB | 128 KiB |
|---|---|---|---|---|
| the review's reproducer | `NAMESPACE_SHAPE` | 8.43 ms | 137.41 ms | not run |
| the worst shape row B1's test sweeps | admitted | 0.06 ms | 0.25 ms | 0.51 ms |
| `xmlns="` + U+2028 + 100 x `xmlns` + `"`, then a tail without `=` | **admitted** | 0.57 ms | 2.32 ms | 4.65 ms |
| the same with U+2029, then `="` and a tail without a quote | **admitted** | 0.59 ms | 2.37 ms | 4.79 ms |
| units of that value with 2 KiB tails | **admitted** | 0.49 ms | 2.06 ms | 4.26 ms |

Reading of it: Q-06. The guard takes a value as closed at its quote (`:291-297`); the package's `.` had already given the declaration up at the line separator and then tries every occurrence INSIDE the value, each scanning to the next equals sign. At most 102 occurrences fit one value and each equals sign ends their scans, so the work is bounded by about 100 character looks per byte: linear, with a constant six times the `WORK_PER_BYTE = 16` the test asserts for the shapes it tries (`onvif-reply-guard.test.ts:287, 334`).

## 4. Findings on the tests (lists A and B)

`CS` = `apps/core-server/src`, `WEB` = `apps/core-web/src`, `MOB` = `apps/mobile/src`, `SH` = `packages/shared/src`. "Lift" = to close or rule before row 88.

| ID | File:line | Finding, and why it matters | Smallest fix |
|---|---|---|---|
| **Q-03** | `CS/capture/adapters/camera/__tests__/onvif-session.test.ts:395-402` against `onvif-session.ts:563-566` | **The connection limit of the SESSION file is held by no test.** The case asserts that a timer of `connectMs` was asked and that none is pending. No case of the file keeps a connection from being established and fires the timer: with `if (socket.connecting === true) socket.destroy();` deleted, every case passes (the "address this host does not hold" case ends by the bind's own error, `:1166-1178`; the HANG and DRIP devices are connected). Row T3 closed exactly this for the set-network file (`onvif-network.test.ts:607-637`) and the third pass named only that file. The request limit is held by a text pin only (`CS/capture/__tests__/static.test.ts:639, 666`); no case lets it end a call. Sixty-b's sentence stands: a caller whose signal never aborts has only these two limits | Row T3's case (b) and (c), once, for the tester (the three facades share the exchange) |
| **Q-04** | `CS/capture/adapters/camera/__tests__/discovery-recording.test.ts:100-108, 119, 127-128` | **"The session keeps recording" does not detect a stall.** The criterion is "more fragments after the search than before": a datagram handler that held the event loop for most of a 150 ms window passes, as long as one 5 ms tick ran. The booted form of the same check does it right - a count taken by a timer set BEFORE the search at a fixed wall time (`capture-discovery/__tests__/capture-discovery.db.test.ts:747-760`). This is the adapter-level half of M4-SEC-DISC-3, and B-01 was an event-loop stall | The fixed-time count of the booted file |
| **Q-07** | `ws-discovery.test.ts:148-149, 156-157`; `onvif-session.test.ts:389-390, 450-451`; `onvif-network.test.ts:481-482` | **An absence proven by a short sleep - these can pass FALSELY under load**, unlike the sleeps of the earlier passes, which fail closed. "The repeat is not sent before 250 ms" is `delay(20)` then `probes === 2`; "no further request follows" is 60 ms and 50 ms; "no uncaught exception" is 30 ms. A late event is not seen. Beside them, long sleeps where the event exists (T-10's family, fail closed): `delay(3_400)` for the 3,000 ms window at `capture-discovery.booted.db.test.ts:99`, `lane-camera-stub.db.test.ts:64`, `capture-discovery.db.test.ts:188` | The absence cases: assert at the NEXT positive event (after the clock moved 1 ms the count is exactly 4, and the stub's log holds no entry stamped before it). The windows: await the audit row |
| **Q-08** | `onvif-session.test.ts:169`; `:1251` | **Expectations that take either answer** (T-05's family). `WRONG_PROFILE` accepts `NO_USABLE_PROFILE` or `PROFILE_ANSWER_INVALID` for a device that lists no profile; a refused watch is `not PRESENT` (`UNKNOWN` and `ABSENT` both pass) | Pin the one value |
| **Q-09** | `ws-discovery.test.ts:256-271`; `capture-discovery/__tests__/search.test.ts:418-420, 423-428` | **Controls that assert on the test's own text.** The "negative control: the same throw WITHOUT the try / catch ends a process" runs two scripts written in the test; the product is not called. In `search.test.ts` the "CONTROL (the finding)" evaluates a lambda `before` of the test, and case 2 composes `openSessionOf` and the detail builder itself (the wiring is held by the text pin at `:432`). None is wrong; each proves a premise, not the product | Name them as premises in their titles, or delete (the product halves stand beside each: `ws-discovery.test.ts:224-254`, `search.test.ts:410-417`) |
| **Q-10** | `CS/capture/adapters/camera/ws-discovery.ts:191, 197, 328-329, 336, 339`; pins at `CS/capture/__tests__/static.test.ts:362, 394, 398` | **The typed address probe's product path has never run.** Under the loopback fixture the destination is replaced by the fixture's (`:197`) and the source check is skipped (`:191`), so every test proves the message and the count, not where it goes: the destination `{ address: unicast.address, port: 3702 }` and the TTL of 1 are held by exact source lines only; `setMulticastLoopback(false)` (`:336`) by nothing. And one fact for the hardware chapter: the source the destination rule named is checked to be HELD (`:191`) but the socket is bound to it only when ONE interface is probed (`:328-329`); with two or more the typed datagram leaves from whatever the host's route chooses | A hardware item (9A) with the two facts; one line in the record of row 96. No code change proposed here |

What was looked for in A and B and NOT found: a fixed port (every listener of the files read binds a port the system chooses: `ws-discovery`, `loopback-guard`, the odd device through `freeOddDevicePort`, the three listeners of `onvif-network.test.ts`, the lane stub through `freeFakeOnvifPorts`, `app.listen` at `capture-discovery.db.test.ts:798`) - **row T3 missed none in what this pass read**; a mock of the parser where the parse is the subject (`probe-answer.test.ts` and the reply guard's end-to-end cases use the pinned packages); a database case that leaves a process (none starts one).

What is sound and worth saying: `probe-answer.test.ts`, `discovery-collector.test.ts`, `limits-store.test.ts`, `session-expiry*.test.ts`, `plan.test.ts` and the C93 cases of `routes.test.ts:617-669` and `capture-config.db.test.ts:1502-1519` assert exact values with a control beside each refusal and gave no survivor. `capture-discovery.db.test.ts` proves "nothing was registered" by a digest of both tables and verifies the audit chain after every flow.

## 5. Findings on the readers and the live source (lists C and D)

### 5.1 How a real Core's facts reach a reader

| Step | Where | What it does |
|---|---|---|
| The store starts with no Core data | `SH/live/source/neutral-state.ts:155-263` | `cameras: []`, an empty selector, an empty registry. Nothing of the demo dataset |
| A snapshot or a delta replaces slices | `SH/live/source/replica.ts:60-101` | the 30 replicated slices are the message's, by reference where equal; no member is filled in |
| A session or a pairing ends | `SH/live/source/live-sim.ts:1040-1047` | the replicated slices go back to the neutral value in the same update |
| The link turns STALE or OFFLINE | `live-sim.ts:921-926` | ONLY the `audio` slice is reset. Every other slice stays as last heard |

**So the live source substitutes no simulator value for a missing live fact.** Every simulator value an operator of a live Core can read comes from the Core's own committed slices: the Core's engine holds the shared simulator state. That is the root of S-01, and it is why row W4 moved the readers off the `cameras` slice instead of null-checking it. Two literals of the live source stay as the M2 review left them (F-02): `silentAudio` names `MIC-01` / `MIC-02` and `activeInputId: 'MIC-01'` (`neutral-state.ts:48-50`); they are audio, not camera.

### 5.2 Findings

| ID | File:line | Finding, and why it matters | Smallest fix |
|---|---|---|---|
| **Q-01** (lift) | `WEB/features/devices/stream-facts.ts:97-111`, `camera-preview.tsx:62-74`, `source-state.ts:51-53`; `MOB/features/devices/stream-facts.ts:89-97`, `MOB/features/capture-selector/capture-selector-model.ts:267-269`; cause at `SH/sim/capture-telemetry.ts:108-113, 125-135` | **A stale "Live" and a stored format survive a camera loss inside a session.** A track's fault is read from three places: the selector line's `streamState` / `online`, an active "not reachable" notice, the `cameras` slice. The fault the camera watch raises for a camera that stops delivering (`CAPTURE_FAULT` / `CAMERA_STREAM_ENDED`, row 49 and row R1) is in none of them: it is an alert of another kind (`WEB/lib/capture-notices.ts:65-67`), and raising it changes no line. The line's state follows the WORKER's ingest, and while the relay re-opens its camera the push stays connected (row R1's run: `ingest_connected: 1`, gate refusals 0, through a 3,048 ms absence) - so the line reads `LIVE`, and during a recording both clients say "Live" (`source-state.ts:53`). The operator sees one critical notice and, on the track itself, "Live - Format: 2560x1920" until the relay gives up (62 s) or the camera returns. Row W4 states this was "not traced into the Core" (its section 8). By reading, not run | At the source, so that both clients follow one fact: the engine's transition for a `CAPTURE_FAULT` about a camera device sets that device's line and registry entry to `streamState: LOST` while the fault is active. Or, in the readers: an active `CAPTURE_FAULT` alert whose target is the line's device is `STREAM_LOST` in `trackFactsOf` / `statedTrackOf`. One case per client |
| **Q-02** (lift) | `WEB/features/devices/capture-selector.ts:390-395`, `capture-selector-panel.tsx:182, 230`; `MOB/features/capture-selector/capture-selector-port.ts:107`, `capture-selector-model.ts:360`; rule at `CS/modules/capture-config/routes.ts:329-337`; sentence at `SH/i18n/en/common.ts:922` | **No client can assign a production camera.** Both clients assign a camera by operation 79 with `{ trackId }`. For a production camera on a real Core the rule needs a profile of the device's own list: an EMPTY slot answers `CAMERA_PROFILE_NOT_STATED`; a HELD slot judges the NEW camera by the profile the OLD line keeps (`routes.ts:330`) and answers `CAMERA_PROFILE_NOT_OF_DEVICE` unless the two cameras happen to share a code. The web then prints "Choose one of the profiles stored for this camera, then assign it again" - the panel shows the code of a held line (`:230`) and offers no choice, and the replicated device slice carries no profile list to choose from. The tablet reads the general "invalid" for every 422 but one (`capture-selector-model.ts:360`). Declared at its source: request line `row 187` (`delegation_progress/file_requests.md:198`, "blocking: yes for assigning a production camera from a client after the lift") and `integration I-7` (`:244`). No review pass named it and no row owns it | A ruling first: either the registry slice gains the device's profile codes and both selectors a profile choice sent by operation 78; or operation 79 takes the camera's ONE stored code when its list holds exactly one (the device's own statement, not a default - C36 would have to say so). Then the tablet's two reasons |
| **Q-05** | `MOB/features/devices/registered-device-detail.tsx:41`; `WEB/features/devices/registered-device-drawer.tsx:98`; rule at `WEB/features/devices/source-state.ts:53`, `MOB/features/capture-selector/source-state.ts:159-161`; `SH/sim/capture-telemetry.ts:113` | **"Stream: LIVE" at rest in the two "View device" surfaces** - the surfaces an ADOPTED camera has. The one rule of both apps says a live stream is said only while a session records. The tablet's detail draws the registry entry's `streamState` whenever it is not null; the web's drawer hides it only for a source "not checked". After a recording the entry keeps `LIVE` (an ingest that ENDED outside a recording changes nothing, by the table at `capture-telemetry.ts:103-106`), so an idle Core reads "Stream LIVE" for a camera nobody is reading. HYPOTHESIS for the last step: by reading the transition, not run | Both through the rule that exists: `sourceLineState` (web), `cameraStreamWordApplies` (tablet) |
| **Q-06** | `CS/capture/adapters/camera/onvif-reply-guard.ts:299`; `__tests__/onvif-reply-guard.test.ts:287, 310, 334` | Section 3.2: the scan takes LF and CR as the end of a value's line; the package also stops at U+2028 and U+2029. Admitted, linear, about nine times the tested worst. The seeded generator has no line separator among its units | The two three-byte sequences as line ends in `namespaceShape` (the machine is byte-wise: two bytes of look-behind), or the constant stated as about 100 and one swept shape. Not before the gate |
| **Q-11** | `SH/api/state-slices.ts:528-543`; `CS/modules/devices/status.ts:181-198`; `WEB/features/session-monitor/model.ts:455-466`; `WEB/features/devices/stream-facts.ts:41-61` = `MOB/features/devices/stream-facts.ts:37-57` | **What is left of S-01.** (a) The committed `cameras` slice of the state stream of a real Core still holds the simulator's `1080p / 25 / H.264` (request line of row V6, `file_requests.md:459`, addressed to "the controller and the owner of the engine's state": no row). The readers no longer read it there; `selectFeed` still hands it on, and any later reader of the slice inherits it. (b) The profile-code form is now stated THREE times (the Core, the web, the tablet); the two client copies are the same 31 lines. Row W4 asks for the one function (its request 2, to R1b) | (a) the engine writes the stored statement or null into the slice in real capture - then the clients' decode goes; (b) the shared function |

Looked for and not found: a reader that invents a profile, a clock offset or a bitrate on a real Core. The tablet's camera clock card is an honest seam: `useCameraOffsets` returns none and every row reads "Not reported yet" (`MOB/features/capture-selector/camera-clock-card.tsx:38-40, 62-65`) - the third pass's N-08 stands: the watch's clock read has no reader. `registered-devices-model.ts` builds its cards from the Core's device list and from nothing else (`:80-104`); `capture-notices.tsx` draws one notice per active alert and hides none by a timer.

## 6. Tests that would survive a mutation (4)

| # | Test | It survives |
|---|---|---|
| 1 | `onvif-session.test.ts:395` "the connection limit is asked of the timer seam, and it is cancelled once the connection stands" | deleting `if (socket.connecting === true) socket.destroy();` (`onvif-session.ts:565`) - Q-03 |
| 2 | `discovery-recording.test.ts:83` "the session keeps recording: fragments advance contiguously ..." | a datagram handler that holds the event loop for most of each search window - Q-04 |
| 3 | `onvif-session.test.ts:164` "WRONG_PROFILE: authenticated, and the device lists no profile" | the product answering the other of its two reasons - Q-08 |
| 4 | `ws-discovery.test.ts:256` "negative control: the same throw in a datagram handler WITHOUT the try / catch ends a process" | everything: the product is not called - Q-09 |

Weaker, noted and not counted: `onvif-session.test.ts:1251`; `ws-discovery.test.ts:140` (the early-repeat half, on a loaded host only); `search.test.ts:418-420`; `onvif-session.test.ts:1285-1317` at 256 KiB and 15 KiB (the 5,000 ms bound is above the 2.8 s the old behaviour took at 256 KiB: only the 1,000 KiB run tells the two apart by time - the "later reply" cases tell them apart by behaviour).

The eighteen of the third pass and the five of the second are not re-listed: rows T2 and T3 show each red on a mutant. Of those, this pass read the cases as they now stand in `onvif-session.test.ts` and `onvif-network.test.ts` and agrees with the records.

## 7. Notes

| ID | File:line | Note |
|---|---|---|
| N-01 | `capture-discovery.db.test.ts:267`; `capture-discovery.booted.db.test.ts:57, 214-215` | Order dependence: `DSC-000001` needs the describes before it to have started no search; the booted file hands `adoptedId` from one case to the next. A filtered run fails by construction |
| N-02 | `capture-discovery.db.test.ts:697` | The case number of the recording session is drawn with `Math.random()` (90 values) in a case that runs twice. NOT CHECKED whether the Core refuses a case number that is in use; if it does, 1 run in 90 fails |
| N-03 | `WEB/features/devices/camera-tile.tsx:46-52, 70, 100-109`, `sim-adapter.ts:59`, `model.ts:83-87`; `MOB/features/devices/device-detail.tsx:549, 553` | The name, the status chip and the REC chip of a track tile are those of the built-in device of the track (`VIDEO-01` is `CAM-01`) read from the `cameras` slice, whatever device the selector line names. NOT TRACED which writer of a Core in real capture sets `online`, `lens` and `recState` there; row W4's "only what the Core states" is not shown for these members |
| N-04 | `SH/live/source/live-sim.ts:921-926` | With the link STALE or OFFLINE every camera fact stays as last heard. Whether the shell marks those screens while the link is down was NOT read |
| N-05 | `onvif-reply-guard.test.ts:15-17`; `onvif-session.test.ts:1444-1452`; `onvif-network.test.ts:336-338, 443-462, 712-720` | Two stale comments: "no test file may import the package (static rule G-R10)" - three cases of rows T3 and V6b import it and patch its prototype (restored in `finally`; the static rule reads production files); "that one takes one of five fixed ports" - row T3 changed it |
| N-06 | `capture-config.db.test.ts:1426-1434` | The profile rule of row 187 is proven over a registry the test wrote ("the registry after the lift"). Declared in place; the real registry's answer is row 88's |
| N-07 | `capture-discovery/__tests__/static.test.ts:179, 182` | The import rules of the re-address see `from '...'` only; the name rule beside them (`:211-212`) covers a dynamic import. The family of M-06 |
| N-08 | `MOB/features/capture-selector/capture-selector-model.ts:352-365` | Every 422 of operations 78 / 79 but one reads "invalid" on the tablet: `CAMERA_ON_BOTH_TRACKS` (row R2) and the two profile reasons have sentences in the shared tree the tablet does not read (request line `integration I-7`) |

## 8. The five questions asked of each test file - summary

| Question | Result in this pass |
|---|---|
| Passes with the feature removed or the check inverted | 4 (section 6) |
| Asserts on its own fixture | Q-09 (three places); N-06 |
| A negative control that is not negative | none. `ws-discovery.test.ts:293-300` and `discovery-recording.test.ts:146-166` are real ones (the instrument reads the other value on the product) |
| Sleeps where an event should be awaited | Q-07 |
| A fixed port without a lock | none found; row T3 missed none in the files read |

## 9. The closing statement in full

### 9.1 CLOSED, with the row that closed it

| Finding | Closed by | How it was checked here |
|---|---|---|
| **B-01** (blocking) | row B1 | read and measured, section 3 |
| F3-01 | row R1 | its record; the product code was NOT read (section 10) |
| F3-02, F3-03 (the rules), F3-04 (two documents), F3-11 | row R2 (SR-14, SR-5 entry 2, the erratum, ruling C93) | its record; `routes.test.ts:617-669`, `plan.test.ts:290-318`, `capture-config.db.test.ts:1502-1519` read |
| F3-06 for operations 95 / 96 and the web | rows R2 and W4 | records; search |
| F3-07, R-01, R-02, R-05, R-06, R-04 on the web | row W4 | `camera-tile.tsx`, `camera-preview.tsx`, `source-state.ts`, `stream-facts.ts` (both), `device-detail.tsx:496-586`, `model.ts:451-474` read |
| S-01 for operations 44 / 46 / 47 and for the readers | rows B2, V6, W4 | `status.ts:181-198`, the schemas, the readers |
| S-02 | row B2 | its record only |
| S-07, S-08, the five survivors of 60b section 7.4, M-08, M-10 | row T2 | its record; the cases at `onvif-session.test.ts:414-468, 1141-1164` read |
| T-01, T-02, T-03, T-04, T-06, T-08, T-09, four of the six places of T-05, X-04, X-06, X-07, X-09 | row T3 | its record; `onvif-network.test.ts:489-751` read |
| X-01 | row T3 (measured: it does not hold) | its record |

### 9.2 OPEN, with an owner

| Item | Owner |
|---|---|
| The caps of row B1 against a REAL camera's answers; a challenge above 2,048 characters | the hardware package (9A / H-17; C100 (1)) |
| F3-12, N-16, Q-10 (hardware questions of the relay and the typed probe) | the hardware package |
| F3-01's remainder: an audit type and a manifest member for a video absence; the notice's sentence | the writer of `packages/shared` (request 1 of row R1; before M6) |
| F3-04's remainder: a pointer where RC-6 is defined | the writers of the three documents, then row 86 |
| F3-11's remainder: a dual-lens camera as ONE device | the next blueprint refinement (C93) |
| M2 F-03, F-08 | row 88 (C50) |
| R-04 on the tablet's feed chip; row W4's four driver decisions | the controller (row W4's request 4) |
| Q-11 (b) and row W4's requests 2 and 3 | agent R1b |
| `INGEST_OPEN_STUCK` (S-09): unexplained, 0 in 240 sessions | the controller (C109) |
| The Linux build of row T2's unit test | row 193 |

### 9.3 OPEN, with no owner named in the records this pass read

| Item | For the lift? |
|---|---|
| **Q-01** the stale "Live" under a camera fault | **lift** |
| **Q-02** no client can assign a production camera | **lift** (declared so by row 187) |
| S-01 on the state stream (Q-11 (a)) | **lift** |
| S-03 three optional members whose absence turns a check off (`connect/service.ts:264, 375`; `onvif-session.ts:211, 237, 521`; `onvif-network.ts:188`) - still as found | **lift** |
| S-04 the port half of the stored-address judgement (`stored-address.ts:191`) - still as found | **lift** |
| S-06 the source address held to `DOTTED_QUAD` (`onvif-network.ts:206, 342`) - still as found | **lift** |
| F3-06 for operation 108 (`adopted-test.ts:203`: still "This device cannot be tested.") and for the tablet | **lift** |
| F3-05 (`adopted-test.ts:255`, `connect/service.ts:382` still re-write `storedCameraSourceOf`), F3-08 (one of four exit-code tables held to `relay.h`), F3-09 (`endedWithin` twice: `onvif-relay.ts:425`, `stream-probe.ts:416`), F3-10, S-05 | no |
| The code halves of F3-02 and F3-03 (`SourceNamed`; the two-parameter overload at `onvif-session.ts:865`) | no (request 4 of row R2) |
| S-10, S-11, S-12, S-13; T-05's two remaining places, T-07, T-10, T-11, T-12; X-02, X-03, X-05, X-08 | no |
| Q-03 to Q-09 of this pass | no (Q-03 before the gate quotes "bounded" for the session file) |
| M2 F-01, F-02, F-04; the notes of the four passes | no |
| **Q-12** the product code of rows R1, R2, B2, V6 and V6b was read by no pass | **lift**: a reading of those diffs belongs to row 86 or to the review of the next milestone |

### 9.4 Recommendation to the gate (row 61)

M3 MAY CLOSE. Blocking findings across four passes: 1 raised, 1 fixed, 0 open. Conditions: (1) the working tree that holds row B1 is committed and the gate's own suite is green on that commit - this review ran no suite and vouches for none; (2) the seven "lift" items of 9.3 are entered as preconditions of row 88, each with an owner; (3) the gate's record says, in these words or its own, that the review read the code of phase 3 and row B1, and NOT the product code of the other follow-up rows.

## 10. Read in full / read in part / not read - all four passes together

| Area | Read in full (pass) | Read in part (pass: what) | Never read by any pass |
|---|---|---|---|
| Relay and worker, C | `relay.c`, `relay_rtsp.c`, `relay_core.c`, `announce.c`, `guard.c` (1); `relay.h:60-379` (1) | `ingest.c:100-240, 555-620` and the give-up bound (1, 2); `capture_worker.c` (2: the bound) | the rest of `ingest.c` and `capture_worker.c`; `announce.h` beyond its declarations |
| Worker tests and fixtures | `relay_unit_test.c`, `relay_fuzz.c`, `relay_fuzz_controls.sh`, `check.sh`, `relay-check.sh`, `pinned_calls.py`, `planted.tsv`, `row58_gate.py`, `row143b_source_bind.py`, `row152_hostile_relay.py`, `row153_confinement.py` (2); `row041_relay.py`, `row042_probe.py`, `row186_bounds.py`, `br09_gate.py`, `row176_camera_end.py`, `rtsp_test_camera_check.py` (3) | `row043_reopen.py:196-385`, `rtsp_test_camera.py` (two ranges), `e11_listener_path.py` (three ranges), `test/e2e.py:192-195` (2, 3) | `row046_adapter_listener.py`, `e11b_announced_path.py`, `row175_log_hygiene.py`, `test/m3worker.py`; **these files as rows T2 and T3 changed them afterwards** (the interposed `bind` / `connect` of the unit test, the 35 new controls of the selftest, the new criteria of four fixtures) |
| Camera adapter, product | `onvif-relay.ts`, `relay-start.ts`, `stream-probe.ts`, `camera-watch.ts`, `stored-address.ts` (1, BEFORE row R1); `onvif-session.ts`, `onvif-network.ts` (2, BEFORE row B1); `onvif-reply-guard.ts` (4) | `ws-discovery.ts:165-354` (4); `onvif-session.ts:536-725` as final (4) | `probe-answer.ts`, `discovery-collector.ts`, `onvif-discovery.ts`, `connection-target.ts`, `onvif-rtsp.ts`, the rest of `ws-discovery.ts`; **`relay-start.ts`, `onvif-relay.ts`, `camera-watch.ts` as row R1 changed them; `onvif-network.ts` as rows B1 and V6b changed it** |
| Destination rule, fence, composition | `destination-rule.ts`, `fence/production-parts.ts`, `capture-config/network/facts.ts`, `connect/index.ts`, `readdress-route.ts`, `capture-composition.ts` (2) | `capture-session/index.ts` (1: four ranges); `ingest-pairing.ts` (1, before R1) | **`capture-composition.ts` as row B2 changed it; `capture-session/index.ts` as row R1 changed it**; the rest of `capture-session/index.ts` |
| Discovery and connect, product | `adopted-test.ts`, `adopted-test-route.ts` (1) | `connect/service.ts`, `adoption.ts`, `readdress.ts` (1, 2: ranges); `capture-config/routes.ts:39-73, 180-198, 329-339` (4) | `capture-discovery/index.ts`, `search.ts`, `store.ts`, `registered.ts`, `typed-address.ts`, `limits.ts`, `search-ids.ts`, `session-expiry.ts`, `connect/limits.ts`, `connect/statements.ts`; `routes.ts`, `plan.ts`, `connect/service.ts` as row R2 changed them; `modules/devices/status.ts` beyond `:100-220` |
| Camera adapter tests | every file of `camera/__tests__` (2: `destination-rule`, `stored-address`; 3: seven files; 4: the nine of section 2) | - | none |
| Capture-discovery tests | `adopted-test`, `readdress`, `readdress.db`, `connect/service`, `connect/limits`, `connect.db`, `minted-code.db`, `stream-test.db` (3); the eight of section 2 and `search.test.ts` whole (3 + 4) | - | none; **the four database files as row T3 changed them afterwards were not re-read** |
| Capture-config tests | `adopted-camera-test.db`, `camera-adapter-open.db` (3); `plan.test.ts`, `routes.test.ts` (4) | `capture-config.db.test.ts:1403-1534` and its outline; `credential-reader.db.test.ts:370-469`; `credential-reader.test.ts:338-439` (4) | `capture-config.db.test.ts:1-1402`; the rest of the two credential-reader files; `fencing`, `rbac-boot-equality`, `selector-reader-inventory`, `slices`, `static`, `support` (titles only); the tests of the sub-folders `factory-scan`, `camera-network`, `host-alias`, `network`; `src/__tests__/capture-composition*.test.ts`; `engine/__tests__/readdress-door.db.test.ts`; `modules/devices/__tests__/status.test.ts`; `capture-session/__tests__` as row R1 extended them |
| Web readers | `camera-tile.tsx`, `dashboard/devices-panel.tsx`, `inputs-panel.tsx`, `camera-preview.tsx` (3; the first and last again as final, 4); `stream-facts.ts`, `source-state.ts`, `capture-notices.tsx`, `registered-devices-model.ts`, `registered-device-drawer.tsx`, `capture-selector-panel.tsx` (4) | `session-monitor/model.ts:436-476`, `capture-selector.ts:384-400`, `labels.ts:1-60`, `model.ts:81-103`, `device-drawer.tsx` (the format rows), `lib/capture-notices.ts` (searched) (4) | `capture-selector.ts` beyond the range, `camera-connect*.ts(x)`, `camera-search*`, `camera-readdress*`, `slot-refusal.ts`, `source-class.ts`, `own-core-words.ts`, `track-reach.ts`, `session-new/*`, `session-monitor/*` beyond the ranges, `components/media/camera-feed.tsx`, `system/diagnostics.tsx`; the new folder `features/commissioning`; every web TEST of row W4 |
| Tablet readers | `devices/stream-facts.ts`, `devices/registered-device-detail.tsx`, `capture-selector/camera-clock-card.tsx`, `capture-selector/source-state.ts`, `capture-selector/selector-in-force.ts` (4) | `devices/device-detail.tsx:496-586`, `devices/devices-model.ts:120-184`, `session-live/live-feed.tsx:196-250`; `capture-selector/capture-selector-model.ts` and `capture-notices-model.ts` (outline and searched lines) (3, 4) | **the other 18 files of `capture-selector/`** (the panels, the sheet, the port beyond one line, the hooks: about 3,900 lines), the rest of `device-detail.tsx`, `registered-devices-model.ts`, `diagnostics-sheet.tsx`, `components/media/camera-feed.tsx`; every tablet test |
| Shared: schemas and live source | `live/source/neutral-state.ts`, `live/source/replica.ts` (4) | `api/state-slices.ts:505-575` (2, 4), `live/source/live-sim.ts:1-80, 905-944` and a search of its resets; `sim/capture-telemetry.ts:85-175` (4) | **`live/source/live-sim.ts` (2,696 lines) but for those ranges, `bindings.ts`, `command-gate.ts`, `live-result.ts`, `types.ts`, `structural-sharing.ts`, the rest of the folder**; the slice schemas beyond `cameras` (`captureConfig`, `captureDevices` by search only); `sim/selector-in-force.ts`; `packages/capture-protocol` |
| Documents | the two earlier reviews, the row records named in each brief | the design addendum, the security addenda (1) | about 30 implementation records of the rows in scope (1) |
| History | - | - | the three commits were never walked with `git show --stat`: every pass read the tree |

**Where this pass stopped, exactly.** List A: complete. `onvif-session.test.ts`: complete. List B: `plan.test.ts` and `routes.test.ts` whole; of `capture-config.db.test.ts` the block of row 187 and row R2 (`:1403-1534`); of the two credential-reader files the gate block and the commit-hold block; the six other files of the folder by their case titles only. List C: the web files the brief names whole; of the tablet the device detail's camera block and five files of `capture-selector/`, the other 18 not. List D: the camera fact schemas and two files of the live source whole; `live-sim.ts` at three places. Reason: volume - about 9,500 lines of tests and 3,300 lines of readers were read whole before C and D; the order of the brief was kept. A defect in what was not read is not excluded.

## 11. What was done well

- The reply guard is one file with no import, two small machines and one line that refuses by size; its test counts the package's work instead of only timing it, and proves the verdict equal for every way of cutting the bytes.
- Row T3's cases for the set-network file hold each rule by what the call DOES (a reboot that is not sent, a timer that is fired on a connection that never stands), not by a clock.
- The discovery tests state what did NOT happen with an instrument that is itself controlled: the loopback guard's refusals, the operating system's count of datagram sockets, the stub's request log.
- The readers of row W4 take the fault before the fact in one function per app, and the tablet's clock card says "Not reported yet" where no source exists instead of `0 ms`.
- Rows 187, W4, R1 and V6 wrote their own open ends into request lines: Q-01, Q-02 and Q-11 were found there or one step behind them.

## 12. Assumptions and gaps

- Nothing was run but the one check of section 3.2. Every "would pass with X deleted" rests on reading the test and the product line together; none was tried.
- Q-01 rests on row R1's measured `ingest_connected: 1` for one absence of 3 s and on reading the telemetry transition; a longer absence was not observed. Q-05's last step and N-02 are hypotheses, labelled where they stand.
- "No owner" (9.3) means: none named in the records this pass read (the three reviews, rows B1, B2, R1, R2, T2, T3, W4, decisions C93 to C109, and the request lines cited). `status_tasks.md` and the plan were not read.
- Section 3.2's times are of this Mac at load 3 to 4; the production host's are not known.
- Line numbers are of the working tree at the time of reading.
- No file other than this one and `delegation_progress/row_060d.md` was written. The check wrote one script under the session's temporary directory.

---
*Generated: 2026-10-13 18:50*
