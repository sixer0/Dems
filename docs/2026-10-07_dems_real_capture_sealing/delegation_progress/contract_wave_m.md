# Contract of fix wave M (producer: M-S; consumers: M-W, M-M)

Written by M-S at its start (2026-10-11). Totals unmoved: 97 operations (36 GET / 61 POST),
67 audit types, schema 6 / dbc-7, no migration. **M-S adds NO member and NO option to
`packages/shared/src/api`**: everything below is read through members that exist today.

## M-S 1. The SOURCE RIG (notification B, ruling D232)

Available on lane 2 ONLY AFTER its restart (the launcher gets a new argument); OFF by default.

```
scripts/lane/lane.sh source-rig 2 unreachable <deviceId>   # e.g. CAM-05 or MIC-02; a second call ADDS a device
scripts/lane/lane.sh source-rig 2 release                  # OFF: every rigged source answers again
scripts/lane/lane.sh source-rig 2 status
```

- Devices: a stored `FAKE` (generated) CAMERA or MICROPHONE - both are supported. A local
  device (`CAM-03` / `MIC-03`) or a production device named in the switch is NEVER touched (the
  switch is read by the generated adapters alone) and the Core says so in one warn line
  `LANE_SOURCE_RIG_NOT_A_FAKE_DEVICE`. The rig opens nothing.
- Refused on a lane that is not REAL_DEVELOPMENT (`lane.sh` exit 64; the launcher does not start
  a production Core with it: check `capture.sourceRig`, code `DEV_SOURCE_RIG_IN_PRODUCTION`; the
  capture fence refuses the switch in every operation but REAL_DEVELOPMENT).
- Takes effect on the RUNNING lane, no restart: the switch file is read at every reachability
  read and at every open of a generated source. It does NOT end a source that is already open
  (a running recording is not touched).
- Effect while ON, for the named device: its reachability read fails (camera: the adapter
  refuses the read, cause `UNREACHABLE`; microphone: the input list says `present: false`,
  `errorCode: DEVICE_NOT_FOUND`), and an OPEN of it at a session start is refused by the adapter.

### What a client receives at a pre-check (op 25 path: `beginPrecheck` / `retryPrecheck`) - existing members, exact values

Pinned by `apps/core-server/src/capture-notices/__tests__/notices.test.ts` ("THE SOURCE RIG ...", two cases:
the real generated adapters + the real rig rule + the product's gate, notifier and session machine).

| Fact | Where | Value for a rigged CAMERA on `VIDEO-02` (e.g. `CAM-05`), the other camera answering |
|---|---|---|
| the device | slice `captureDevices.devices[]` | `online: false` (written before the checks run) |
| the check row | `session.precheck.items[]`, id `LENS_2` (`LENS_1` for VIDEO-01) | `status: "WARN"`, `value: "UNREACHABLE"`, `params { deviceId, rule: "oneCamera" }` (not `PASS` / `READY`) |
| the outcome | `session.precheck.outcome` | `"WARN"`: the start is allowed after the acknowledgement of the warnings (`acknowledgePrecheckWarnings`) |
| both cameras rigged | the same members | `LENS_1` and `LENS_2` `status: "BLOCK"`, `params.rule: "noCamera"`; outcome `"BLOCK"`; a start is refused; one `PRECHECK_BLOCKED` row |
| the alert (notification B) | slice `alerts[]`, ONE per device per occurrence | `kind: "SYSTEM"`, `severity: "WARNING"`, `active: true`, `target: "<deviceId>"`, `message: "<deviceId> is not reachable"`, `params { reason: "CAPTURE_DEVICE_UNREACHABLE", deviceId, deviceKind: "CAMERA", phase: "PRECHECK", cause: "UNREACHABLE", searchResponderCount: <n> }`. It is raised when the ONE pre-check search has closed - a moment AFTER the 200 of the pre-check call - so that it carries the count (`searchResponderCount` is absent when no search could run) |
| the audit rows | audit trail | one `CAPTURE_DISCOVERY_SEARCHED` (`trigger: PRECHECK`, the discovery module's) and one `CAPTURE_DEVICE_UNREACHABLE` with `details { deviceId, deviceKind: "CAMERA", phase: "PRECHECK", reason: "UNREACHABLE", degraded: true, sessionId }` (`degraded: false` when the start is blocked) |
| a rigged STANDBY microphone | the same members | item `MIC_STANDBY` `status: "WARN"`, `params { deviceId, rule: "noStandby" }`; outcome `"WARN"`; alert `params { reason, deviceId, deviceKind: "MIC", phase: "PRECHECK", cause: "DEVICE_NOT_FOUND" }` (no search, no `searchResponderCount`), raised at once |
| a rigged ACTIVE microphone | the same members | item `MIC_PRIMARY` `status: "BLOCK"`, `value: "UNREACHABLE"`, `params { deviceId, rule: "activeMicrophone", other }`; outcome `"BLOCK"` |
| the search finds nothing | slice `alerts[]` | situation A is raised beside it (one `CAPTURE_DISCOVERY_EMPTY` alert) - on lane 2 the camera stub answers the search, so the count is normally >= 1 |

The sentence and the choices "Search again" / "choose another source" are the CLIENTS' (flow 11,
`ux` section 8e), drawn from that alert and the check row; the Core sends no sentence beyond
`message`. `M4-NODEV-NOCFG-T` needs nothing more from the Core: the search of the pre-check runs
once for the operator who started it, whether or not that operator holds `CAPTURE_CONFIG`.

**No gap was found in the product's pre-check**: with a source that does not answer, the gate,
the notifier and the session machine produce every fact above as they did before wave M (the
existing cases of the same test file hold that with stopped in-memory fakes). What was missing is
only a way to make a generated source not answer.

### After `release`

Nothing changes by itself (the Core does not poll its sources). The next pre-check run
(`retryPrecheck`, or a new session's `beginPrecheck`) reads the device again: `online: true`,
the check row `PASS`, the alert `active: false` with `resolvedAt` set, NO audit row for the
resolve - 0 banners; the session arms. Raise, release, raise again = 2 alerts (the first resolved)
and 2 `CAPTURE_DEVICE_UNREACHABLE` rows. Between a release and the next run the device tile
still reads not online (what the last pre-check read).

### A session START while a source is rigged

The source's OPEN is refused by its adapter: one camera of two = the degraded start of the product
(`CAPTURE_CAMERA_NOT_OPENED` warn line, the session-start notice of situation C when the session
records); no camera = the failed start (`NO_CAMERA_CONNECTED`); the PRIMARY microphone = the plan
is refused. Not needed for notification B - release before a recording unless that is the case
you drive.

### Order for a driver

1. `lane.sh source-rig 2 status` -> `OFF`; write "rig in use by <driver> from <time>" below.
2. `lane.sh source-rig 2 unreachable <deviceId>` - the device must be ON A TRACK of the selector
   (the pre-check asks the sources of the selector only). `CAM-04` / `CAM-05` are generated sources
   on lane 2 once it has restarted (stored `FAKE` rows): assign one to VIDEO-02, or rig `CAM-02`.
3. New session -> Devices Check (or Retry). Read the facts above; the Core log has one warn line
   `LANE_SOURCE_RIG_ON` with the device.
4. `lane.sh source-rig 2 release`; Retry -> 0 banners. Write "rig free".

## M-S 2. G94d-02 - no contract change

One tamper stop = ONE `EVIDENCE_MEDIA_SERVED` WARNING row also for range requests that are cut at
the same moment; the later request is a warn log line with `repeated: true`. A row that could not
be written is not remembered (the next request writes it).

## M-S 3. G75e-03 - no contract change

The late event was the supervisor's own CLEARED of the earlier session's fault, written by the
log listener as an error-level fault. It is now ONE info line `CAPTURE_SUPERVISOR_FAULT_OVER`
with `faultOfSessionId` (no `sessionId` member, nothing in the error log). No state, alert or
audit row is involved - before or after.

## M-S 4. G75e-07 - NO CHANGE (reported for the next task)

None of the 67 audit types fits an acknowledgement that closes nothing (`FAULT_CLEARED` would
state a clear that did not happen). Op 70 by a role that cannot close the notice stays:
`acknowledged: true` on the alert, no audit row, one info log line with operator and alert id.

## MS consistent at 15:00 WIB (2026-10-11)

Server work of M-S is at a consistent point: targeted unit tests green (28 files, 379 tests), db
files green (7 files, 38 tests), core-server and shared typecheck 0 errors, lint exit 0. Lane 1 is
UP again (PID 31434, `127.0.0.1:4421`, not reset). **M-W may restart lane 2 now**
(`scripts/lane/lane.sh stop 2`, then `start 2 --with-camera-stub --speech-mic`): the start output
then says "source rig available (development tool): switch ... says: OFF". Until that restart the
running lane 2 Core has NO source rig (`lane.sh source-rig 2 ...` writes the file; nothing reads it).

## Rig use log

(rig in use by <driver> from <time> / rig free)

lane 2 restarted at 15:08 WIB by M-W (stop 15:08:10, ready 15:08:12, PID 34466; no reset; seal rig OFF, source rig OFF). Helper sessions were lost: sign in again.
seal rig in use by M-W from 15:10 WIB (blocked, then unsealable; one session each)

## MS2 consistent at 15:10 WIB (2026-10-11)

Follow-up M-S2 (`implementation/161_fix_wave_m_s2.md`): a camera ADOPTED during a run (op 96) and assigned to a track now passes the next pre-check of the same run (before: `LENS_n` `WARN` / `UNREACHABLE` and a false notification B until a restart). No member, no option, no audit type changed. **Another lane 2 restart: product code changed (`apps/core-server/src/capture-notices/index.ts`, saved 15:05:37 WIB), so a Core started BEFORE that time needs one. M-W's restart of 15:08 WIB (PID 34466) came after the save and the lane runs from source (`tsx`, no build), so that Core most probably HAS the change already - inferred from the two times, NOT checked on the lane (M-S2 calls no lane). If the re-drive of 161 section 8 step 4 reads Camera 2 `UNREACHABLE`, restart lane 2 once more.** Lane 1 was not stopped or started by M-S2; lane 2 was not called.
seal rig free (M-W, 15:19 WIB): OFF, read; both rig sessions ended (SES-20261011-0064 sealed by the web retry, SES-20261011-0065 unsealable - its notice ALR-000097 acknowledged by the supervisor)

M-M (15:21 WIB): lane 2 has ONE session slot. M-M needs it for device proofs (an ARMED session on the tablet that is cancelled, one 45 s recording, the source-rig drive). M-M takes the slot only while `session/current` is not open and writes 'session slot in use by M-M from <time>' / 'session slot free' here. M-W: please write 'M-W sessions done' when your last session of the wave has ended.
session slot in use by M-M from 15:21 WIB
session slot free (15:29, M-M)
session slot in use by M-M from 15:32 WIB
session slot free (15:33, M-M)
source rig in use by M-M from 15:38 WIB (CAM-02; session slot in use by M-M)
source rig free (15:41, M-M): OFF, read; session slot free
