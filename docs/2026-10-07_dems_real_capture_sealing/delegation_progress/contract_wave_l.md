# Contract of fix wave L — member names (written by L-S; L-W and L-M read members BY NAME)

First version 2026-10-11 10:25 WIB (L-S, before its code is green). A line that says
"ADDED" names a member L-S is adding now; it is not on lane 2 until lane 2 is restarted
after the line "LS consistent at <time>" at the end of this file. A line that says
"EXISTS" is on lane 2 today. Totals unmoved: 97 operations, 67 audit types, schema 6.

Import path of every name below: `@dems/shared/sim` unless another path is written.

## 1. G75d-01 — the UNSEALABLE alert is an OPEN NOTICE, of ITS session only

| What | Member / export | State |
|---|---|---|
| The alert | slice `alerts[]`: `kind 'SYSTEM'`, `severity 'CRITICAL'`, `active true`, `target` = the session id, `params.reason 'UNSEALABLE'`, `params.sessionId`, `params.cause` (a code) | EXISTS (`ALR-000049` on lane 2) |
| "Is this alert the unsealable notice?" | `isUnsealableAlert(alert)` — true for `kind SYSTEM` + `params.reason === SEAL_UNSEALABLE_REASON`, active or not | ADDED |
| **THE ONE FACT for "an open notice that does not block recording"** | `openUnsealableNoticesOf(state)` -> `UnsealableNotice[]` (`{ alertId, sessionId, cause, at, acknowledged }`), newest first; every ACTIVE unsealable alert. Length 0 = no open notice. Header / Home / Dashboard ring read this and nothing else for the notice | ADDED |
| "Does this alert block recording?" | `alertBlocksRecording(alert)` — `false` for the unsealable notice, `true` for an active `SEAL_BLOCKED`; for every other alert it answers `null` (the alert itself does not say: read `faults` / the session as before) | ADDED |
| Of ONE session | `unsealableNoticeOf(state, sessionId)` — the notice of exactly that session, or null | EXISTS |
| Example (active) | `SEAL_UNSEALABLE_EXAMPLE_ALERT`, `SEAL_UNSEALABLE_EXAMPLE_SESSION_ID` | ADDED |
| Example (after the acknowledgement that resolved it) | `SEAL_UNSEALABLE_EXAMPLE_ALERT_RESOLVED` (`active false`, `acknowledged true`, `resolvedAt` set) | ADDED |

**Why the web Monitor drew "FAULT … This recording could not be sealed" over a healthy later
recording (cause found, CLIENT reading):** `apps/core-web/src/features/session-monitor/model.ts:252-257`
(`selectBanner`, phase RECORDING) takes `selectWorstAlert(s)` — the worst ACTIVE alert of the
whole Core — and draws a CRITICAL one as the fault of the session that is recording, with the
alert's `message` as the reason. The unsealable alert of session X is active and CRITICAL, so it
became the "fault" of session Y. The server fact is right (the alert names its session twice).
**The exact test clients must make before an alert is drawn as a condition of the open session:**
`alertBlocksRecording(alert) === false` -> never a fault / attention state of ANY session (it is
the open notice); for an alert that names a session (`alert.params?.sessionId` is a string) ->
only when `alert.params.sessionId === state.session?.id`. Mobile: `unsealable-notice.tsx:19`
calls `unsealableNoticeOf(state, sessionId)` with a possibly undefined id, which answers the
newest active notice of ANY session: pass the id of the session the screen follows, or use
`openUnsealableNoticesOf` where the screen means "any".

**What ends it (ADDED, server).** Operation 70 `acknowledgeAlert` (the existing bell action; no
new operation), sent by an operator whose role holds `UNSEALABLE_ACKNOWLEDGE_PERMISSION`
(= `Permission.EVIDENCE_REVIEW`: SUPERVISOR today; ruling D228 (2) "a supervisor"):

- the alert becomes `acknowledged true`, `active false`, `resolvedAt` = the Core instant;
- ONE audit row `FAULT_CLEARED` (no new type), severity INFO, `sessionId` = the UNSEALABLE
  session (never the session open at that moment), actor = the operator, `deviceId` by the
  sending-device rule, `details: { reason: 'UNSEALABLE', cause, alertId, operationId: 'acknowledgeAlert' }`;
  no timeline event is written (nothing is drawn on a later session's timeline);
- it works on an alert that is ALREADY `acknowledged` (lane 2's `ALR-000049` was acknowledged
  by the gate and stayed active): the supervisor's acknowledgement resolves it all the same.

An acknowledgement by a role WITHOUT that permission is what it was: `acknowledged true`, the
alert stays `active` (204, no row). Clients: `canResolveUnsealable(role)` (ADDED) tells whether
the signed-in role's acknowledgement closes the notice; the others read "A supervisor
acknowledges this notice to close it." Nothing else ends it: not a later sealed session, not a
restart (the alert is a stored row; it comes back `active` at every start until acknowledged).

## 2. G75d-02 — a blocked seal: who may retry, and what the Core does by itself

| What a client must know | Member | State |
|---|---|---|
| (a) the seal of the open session is blocked | `sealAttentionOf(state)?.kind === 'BLOCKED'` (examples `SEAL_BLOCKED_EXAMPLE_FINALIZATION`, `SEAL_BLOCKED_EXAMPLE_ALERT`) | EXISTS |
| it is retriable on demand | every `BLOCKED` is: a seal is BLOCKED only for a cause that may heal (a cause no retry gets past ends UNSEALABLE instead). The retry is operation 33 `recoverSession` (`POST session/{id}/recover`, answers 202 `state FINALIZING`) | EXISTS |
| (b) who may retry | the permission of operation 33: `SEAL_RETRY_PERMISSION` (= `Permission.SESSION_START`: INVESTIGATOR and SUPERVISOR; a TECHNICIAN gets 403). Test `canRetryBlockedSeal(role)` | ADDED (two names for an existing rule; nothing new on the wire) |
| what the retry writes | `RECOVERY_STARTED` with `details.reason: 'SEAL_RETRY'`, the operator, the sending device | EXISTS |
| the bounded design, as a constant clients may print from | `SEAL_AUTOMATIC_RETRIES` (= 3) | ADDED |

**The design, kept (no endless loop added).** One attempt at the stop, then THREE automatic
retries in the same process, 5 s / 30 s / 120 s after the failure before (so four runs, the last
155 s after the first). Then the seal is BLOCKED: the Core runs it again ONLY at a start of the
Core (which has its own three retries) or when operation 33 is sent. It does NOT retry by itself
when the cause heals. True UI sentences: "Sealing stopped after 3 automatic retries." and
"An investigator or a supervisor can retry." (the web offers the control to
`canRetryBlockedSeal(role)`; the devices say who can). The alert text "then start recovery for
the session or restart the Core" names exactly operation 33.

## 3. G75d-04 — the UNSEALABLE end and `resumed`

| Fact | Member | State |
|---|---|---|
| The session ended UNSEALABLE (terminal) | `unsealableNoticeOf(state, sessionId) !== null` while the notice is open; durable: `sessionHistory[]` entry of that id with `outcome 'INCOMPLETE'`; `state.session` is null (or the next session). Operation 83 answers `404 NOT_FOUND` for that id — there is NO progress of an ended session: a dialog that still holds the last body of operation 83 must drop it (no percentage, no "Finalizing", no "Resumed") | EXISTS |
| `resumed` of operation 83 | CHANGED on a Core in real capture: `true` ONLY for a seal that a START of the Core ran again. The on-demand retry (operation 33) and the automatic retries are NOT `resumed` (was: op 33 set it, G75d-09 (a)). Example `sealingProgress` of `SESSION_EXAMPLES` unchanged | CHANGED (server) |
| The web's own "Resumed after restart" | is NOT operation 83's member: `apps/core-web/src/features/session-monitor/sealing-progress.ts:109` computes `resumed: attempt > 1` (the attempt grows with every automatic retry). L-W: read operation 83's `resumed`, or do not say it | client |
| The failed step's sentence while a cause NO retry gets past is retried | CHANGED: `session.finalization.steps[].detail` keeps "Sealing is being retried (retry n of 3, in s s). <cause>" but the cause now comes WITHOUT the conclusion ": this session cannot be sealed." (example, attempt 1 of the rig's `unsealable`: "Sealing is being retried (retry 1 of 3, in 5 s). A session key of an earlier session with this session number is in the Core's key store. A session key is never reused."). The conclusion is true only at the terminal end, where the notice says it. A retriable cause reads as before | CHANGED (server) |
| The code in brackets | the alert's `message` is "This recording could not be sealed. Its files were kept in quarantine on the Core. (<CODE>)" (stored, unchanged). Clients that must not print a code draw `SEAL_UNSEALABLE_PLAIN_SENTENCE` (ADDED: the same sentence without the bracket) and show `cause` as a detail | ADDED |

## 4. G89c-04 — the sealed format on the item (operation 40, and the replicated item)

| What | Member | State |
|---|---|---|
| The manifest's per-track `profile`, as SIGNED (field 36) | `evidence.files[].profile` (optional string, e.g. `H264_720P30`); present exactly with `evidence.sealedPackage === 'PRESENT'` | ADDED (optional) |
| The session carried a `STREAM_PROFILE_DIFFERS` notice | `evidence.streamProfileNotice` (optional): `{ tracks: [{ trackId, stream, configured }] }` — present when the Core's alert list still holds that notice for the item's session; ABSENT = the Core holds no such notice (never to be read as "was checked and equal" for an item older than the alert list) | ADDED (optional, operation 40 only) |
| Examples (import path `@dems/shared/api`) | `EVIDENCE_SEALED_PROFILE_EXAMPLE` (spread into an item: `files` with `profile`), `EVIDENCE_STREAM_PROFILE_NOTICE_EXAMPLE` | ADDED |
| `profileId` | NOT touched (D224 (5)) | - |

## 5. G75d-06 / G70c-02 / G89c-01 — what is a fact on a real-capture Core

`captureDevices.devices[]` of a Core in real capture (lane 2), per member:

| Member | Real fact or model value |
|---|---|
| `id`, `kind` (`CAMERA` / `MIC` / `POE`) | fact (the registry row) |
| `adapter` (`FAKE`, `LOCAL_DEVICE`, `ONVIF_RTSP`, ...), `sourceClass` (`DEVELOPMENT` / `PRODUCTION`) | fact (the registry of the running operation; EXISTS on every camera and microphone of a real-capture Core). **`adapter === 'FAKE'` = a GENERATED test source: name it as generated ("Generated test source · CAM-01"), never by `model`** |
| `sourceOpen` | fact (runtime; LOCAL_DEVICE only) |
| `host` | fact for an adopted camera (the address it was added with). For a built-in FAKE source: the loopback address of the generator — true, of no use to an operator |
| `model`, `firmware`, `poePort` of a device with `adapter 'FAKE'` | **model value — not to be drawn** (the seed dataset: "Dual-lens IP camera DL-2", "3.8.14", "POE_CAM_1", "USB condenser microphone UM-1", "1.04"). REQUIRED nullable members of a stored registry row: L-S does not null them (see decision 2 of note 153). For an ADOPTED fake camera (`CAM-04`, `CAM-05`) `model` is what the fake device announced ("FAKE-CAM-1"): harmless, but the same rule hides it |
| `online`, `streamState` | NOT a checked fact while nothing records: `online` = the row is enabled; `streamState LIVE` = "enabled". (G70c-02; deferred D217 (6).) Client rule unchanged: "Reachable" at rest, "Live" only while RECORDING |
| `capabilities` | fact of the registry |

Other slices a real-capture Core still replicates from the simulator's model — ALL model
values there (hide, or under the "Synthetic demo values" chip): `cameras[].model`, `.firmware`,
`.poePort`, `.resolution`, `.fps`, `.codec`, `.bitrateMbps`, `.room`; `mics[].gainDb`,
`.phantom`, `.name` / `.role` ("Interviewer" / "Subject"), `.channel`; `otherDevices[]` (PoE
switch "2/2 Ports Active", recording indicator, tablet row); `ports[]` (the port map incl.
"GNSS SMA"); `device.cameraModelFirmware`. Facts in those slices: `cameras[].id`, `.deviceId`,
`.online` / `.lens` / `.recState` as far as the capture session drives them; `mics[].id`,
`.deviceId`, `.micRole`, `.state`, `.recState`. The format of a track is
`captureConfig.cameras[].profile` (EXISTS; for a FAKE source the generator's declared
`H264_720P30`), never `cameras[].resolution` / `.fps`.

**G89c-01 — "this item has a real sealed package", and the hash to show:**
`evidence.sealedPackage === 'PRESENT'` (the Core read the item's own manifest under the digest
of record) — with `evidence.integritySource === 'REAL'` for a recording of this Core, or a
seed-sealed demonstration item (`integritySource 'DEMO_PACKAGE'`, still `PRESENT`). The hash:
`evidence.manifestHash` (EXISTS; the digest the manifest states and the database recorded).
`sealedPackage` absent = no sealed package in this Core's store (then "no media package" is
true); `'NOT_READABLE'` = it should be there and is not what was sealed. Example (EXISTS):
`EVIDENCE_EXAMPLES.getEvidence.responses[200].productSealed.value.evidence` of
`@dems/shared/api` (`integritySource: 'REAL'`, `sealedPackage: 'PRESENT'`, `manifestHash`).

## 6. Notes G70c-04, G70c-05 (server only; nothing for clients)

- Boot line `CAPTURE_CONFIG_LOADED … locked`: now the rule of the route (a session that is not
  SEALED is open). `captureConfig.locked` of operation 76 was already right.
- `CAPTURE_DISCOVERY_SEARCHED` (and the other camera-search rows): `details.sessionId` only
  while a session is OPEN (not SEALED); otherwise the key is absent.

## 7. G94c-01 — the cut stream; the 409 body

| What | Member | State |
|---|---|---|
| The 409 of the media route at the byte of the cut | `MEDIA_FRAGMENT_NOT_AUTHENTIC_EXAMPLE` (`@dems/shared/api`): `{ status: 409, body: { error: { code: 'MEDIA_NOT_AVAILABLE', message, details: { simCode: 'MEDIA_NOT_AVAILABLE', reason: 'FRAGMENT_NOT_AUTHENTIC', fileId: 'VIDEO-02', seq: 3 }, requestId } } }` - `.body` is the body the Core sends, member for member (a Core test holds them equal; only `requestId` is the request's own). The reason as a constant: `MEDIA_FRAGMENT_NOT_AUTHENTIC_REASON` | ADDED (the body itself EXISTS on the wire) |

**L-S finding on the cut (measured on a real loopback socket, test
`apps/core-server/src/modules/media-stream/__tests__/wave-l-s-cut-socket.test.ts`): the Core's
side is clean and was NOT changed.** A range that reaches a fragment that fails authentication is
answered `206` with the full `content-length`, the bytes before the fragment, and then the Core
DESTROYS the connection: the reader's body never completes (`complete false`, `aborted`), the
socket is gone in well under 2 s, also on a keep-alive connection (the agent keeps no socket for a
next request). The same request from the byte of the cut answers the clean `409` above. There is
nothing more the Core can do on the wire without changing the answer: the status line and the
length are sent before the failed fragment is read, a trailer does not reach a browser, and the
socket is already destroyed rather than ended. The hang the verifier measured is the dev
server's proxy (5177) not passing an upstream that closed short on to the browser. **L-W:** the
fix is on the web side - (a) the probe must not wait for the end of a body: after an idle limit
(or at once when the bytes received are fewer than `content-length` and no byte arrives) ask
`range: bytes=<received>-` and read the `409`; and/or (b) the dev proxy closes the browser's
response when the upstream response closes before its end (`proxyRes` `aborted` / `close` with
`!proxyRes.complete` -> destroy the client response).

## Announcements

(L-W / L-M: "rig in use by <driver> from <time>" / "rig free"; "lane 2 restarted at <time>".)

**LS consistent at 2026-10-11 10:37 WIB.** L-S's tests are green (shared 149 of 149 in the touched
files, core-server unit 447 of 447 in the touched files + `test/static`, db 142 of 142 in the
touched modules), core-server and shared typecheck and lint clean, OpenAPI regenerated (97
operations). Every "ADDED" / "CHANGED" line above is in the working tree. L-W may restart lane 2.
After that restart lane 2's `ALR-000049` (acknowledged, still active) is resolved by ONE
acknowledgement of the supervisor (bell -> acknowledge, or `POST alerts/ALR-000049/acknowledge`):
that is the live proof of section 1. Lane 1 is UP again (PID 85523, SIMULATED, not reset), on the
new code.


**lane 2 restarted at 2026-10-11 10:38 WIB by L-W** (`lane.sh stop 2` 10:38:23, `start 2 --with-camera-stub --speech-mic` ready 10:38:26, PID 86337, no reset, seal rig installed and OFF, no session was open: `SES-20261011-0043` SEALED). Lane 2 now runs the wave L tree. Operator sessions are lost: sign in again; devices reconnect by themselves. New stub ports and a new fixture account (not read).
**L-W 10:39: `ALR-000049` was acknowledged by the supervisor from the web bell (the live proof of section 1): `active false`, `resolvedAt` set, audit seq 781 `FAULT_CLEARED` (`reason UNSEALABLE`, `operationId acknowledgeAlert`, session `SES-20261011-0041`). Lane 2 has NO active alert now.**

**rig in use by L-W from 10:39** (`seal-rig 2 blocked`, one 45 s session through the API on CAM-01 / CAM-02 / MIC-01 / MIC-02, blocked about 155 s after its stop, then `release` + the web Retry). Lane 2 shows "Sealing blocked" on every client meanwhile; no new session can be started until "rig free".

**rig free** (L-W, 10:44): `seal-rig 2 release` at 10:43:32, `status` OFF read at 10:44. Session `SES-20261011-0044` was BLOCKED from 10:43:04 and sealed at 10:43:53 by the web's "Retry sealing" (operation 33, supervisor) -> `EV-20261011-0033`. No session is open; no alert is active. L-M may use the rig.

**rig in use by L-W from 10:48** (`seal-rig 2 unsealable`, one 45 s session through the API; it ends UNSEALABLE about 35 s after its stop; a new quarantined session and ONE new active UNSEALABLE alert follow - L-W leaves that alert ACTIVE for L-M's and the re-check's own acknowledgement proof).
**rig free** (L-W, 10:50): `release`, `status` OFF. `SES-20261011-0045` ended UNSEALABLE at 10:50 (quarantined; its alert is ACTIVE and NOT acknowledged - left so for L-M and the re-check). L-W now records ONE more clean 45 s session through the API (no rig) to show the Monitor beside an open notice; then lane 2 is free of L-W sessions.

**rig in use by L-M from 10:57** (`seal-rig 2 blocked`, ONE 45 s session started on the TABLET on CAM-01 / CAM-02 / MIC-01 / MIC-02; it is BLOCKED about 155 s after its stop. L-M writes "blocked session exists" below when it is; L-W may press its "Retry sealing" on it and write "retried" - otherwise L-M releases the rig after its device screenshots, at the latest 20 minutes later, and sends operation 33 itself.)
**L-W 11:00: L-W does NOT press Retry on L-M's blocked session (L-W's own retry proof is done: `SES-20261011-0044` -> `EV-20261011-0033`); the session and the rig are L-M's to release. L-W is off lane 2 from now: its browser is stopped, its helper sessions are signed out; it started no session after `SES-20261011-0046` (sealed, `EV-20261011-0035`, verify PASS).**
**L-W 11:00 (helper note for L-M):** the helper jar `.cache/gate-env/session_lane2_SUPERVISOR.jar` is one shared path - L-W signed that session out (204, then 401) and removed the jar at 11:00. If L-M used the same jar, sign in again with the helper. The INVESTIGATOR and TECHNICIAN jars there are not L-W's and were not touched.

**L-M 11:02: blocked session exists** - `SES-20261011-0047` (started on the tablet, `DEV-0001`), BLOCKED since about 11:02; the rig is still `BLOCKED`. L-W: press "Retry sealing" if you want it for your proof and write "retried"; L-M releases the rig and retries itself after its device screenshots (a few minutes).

**rig free** (L-M, 11:09): `seal-rig 2 release`, `status` OFF read. `SES-20261011-0047` (tablet-started, BLOCKED from about 11:02) was retried by L-M with operation 33 (investigator, through the API) after the release and is SEALED -> `EV-20261011-0036`. No session is open.

**L-Z (closing pass) 12:10 WIB - names added / words changed in `@dems/shared/sim` (no operation, no member, no audit type; totals 97 / 36 / 61 / 67 and schema 6 unmoved; OpenAPI not touched):**

| What | Name | Note |
|---|---|---|
| THE selector in force (G70c-01's rule, one function for the simulator, the web and the devices) | `sessionIsOpen`, `openSessionSnapshot`, `selectorOfSession`, `selectorInForce`, `micLinesInForce`, `cameraLinesInForce` (`src/sim/selector-in-force.ts`) | a session's snapshot names the sources only while that session is open (stated, not `SEALED`); otherwise `captureConfig`. `captureMicLines(state)` IS `micLinesInForce(state)` now. A fact OF one session (its summary, the Monitor's "Configured profile") still reads that session's own snapshot |
| The name of the retry control and who presses it where | `SEAL_RETRY_CONTROL_NAME` (= "Retry sealing"), `SEAL_RETRY_HOW_SENTENCE` | the Core's alert of a blocked seal ends its hint with this sentence. Section 2's line "The alert text 'then start recovery for the session or restart the Core' names exactly operation 33" is SUPERSEDED: the alert now says `..., then retry the seal: an investigator or a supervisor presses "Retry sealing" on the Session Monitor of the web console, or the Core is restarted.` |
| What the Core did by itself, and that it waits | `sealStoppedSentence(retries = SEAL_AUTOMATIC_RETRIES)` | the END of the failed step's sentence of a blocked seal (`session.finalization.steps[].detail`): `<cause> Sealing stopped after 3 automatic retries: the Core now waits and does not run it again by itself.` (was: "... Sealing will be tried again when the Core starts, or by the recovery action.") |
| The examples | `SEAL_BLOCKED_EXAMPLE_ALERT.message`, `SEAL_BLOCKED_EXAMPLE_FINALIZATION.steps[0].detail` | CHANGED to the new words (a Core test holds them equal to the Core's functions) |
| Engine door | `SEAL_BLOCKED_MESSAGE_MAX` = 600 (`apps/core-server/src/engine/sealing-notice-doors.ts`) | was a literal 400; the alert message is now up to about 450 characters |

Lane 2 runs the code it booted with (10:38): its Core still writes the OLD sentences until its next restart; an alert STORED before that restart keeps its old text.
