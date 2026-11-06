---
task_id: 2026-10-07_dems_real_capture_sealing
row: 139
date: 2026-10-09
agent: coder-execution
status: needs-review
---

# Row 139 — R-10 situation C: session start with cameras not connected (server notices, web, tablet, phone)

Status **needs-review**: the server side and the Session Monitor / Session Live surfaces are built and
tested; four things are outside this row's folders and are filed as requests (section 5). Baseline
`e296ce7` + wave D tree. No commit, no migration, no new dependency, no device / browser run.
The row's Expected Output names `70_r10_session_start_alert.md`; the brief names this file. Each
check was run once after its last change (D122).

## 1. What was built

| Part | Where | What it does |
|---|---|---|
| Session-start watch | `apps/core-server/src/capture-notices/session-start.ts:99` (`createSessionStartWatch`), `:132` `announce`, `:155` `failedStart` | Reads the events of `sessionCapture(app)`: CONNECTING / STARTED / DURABLE / FAILED_START. Read-only: starts and stops nothing. Never throws into the capture session |
| Degraded start | same, `announce` | When the session RECORDS (DURABLE) and STARTED named a camera as not opened: one `SYSTEM` WARNING per camera (`reason: CAPTURE_DEVICE_UNREACHABLE`, `phase: SESSION_START`, `cause: NOT_CONNECTED`) + one `CAPTURE_DEVICE_UNREACHABLE` row, `degraded: true`. Nothing before DURABLE. Either order of STARTED / DURABLE, announced once |
| Clear on a later success | same | A camera opened in a later session that records: its SESSION_START warning is resolved (no audit row), unless a fault alert names that camera. A pre-check notice is not resolved here |
| Failed start | same, `failedStart` | The critical alert is the capture side's own `CAPTURE_FAULT` (forwarder). The watch adds nothing when it is active. Net: when NO capture fault alert is active at FAILED_START it raises one through `notifyNoCameraConnected` and writes `CAPTURE_SESSION_START_FAULT_RAISED_BY_NOTIFIER` to the error log |
| Mount | `capture-notices/index.ts:125` `listenToSessionStarts`, `:198` `watchSessionStarts`, `:214` `idle` | `captureNotices(app)` attaches the listener to `sessionCapture(app).on(...)` at its first use on an app that has the capture seam (today: the capture-discovery module's registration). `app.ts` untouched. `idle()` for tests and shutdown |
| Words | `packages/shared/src/i18n/en/common.ts:925` block `common.session` | `connectingCameras` (ux §14.2), `stopWhileConnecting`, `trackConnecting`, `failedStart.{title,openDevices,next,close}` |
| Web model | `apps/core-web/src/lib/capture-notices.ts:273,287,295`; `features/session-monitor/model.ts:164,171,210,376,400` | Failed start = session `FAULT` + explicit `captureDurable: false`; cause from the alert's `params.reason`; cameras named by SESSION_START notices |
| Web Session Monitor | `status-banner.tsx:39,130,135,144`; `live-feed-panel.tsx:83,282,327`; `action-bar.tsx:182,572,700` | Connecting: picture not live, "Connecting cameras…" in the feed panel, no start / recover / evidence action, End Session disabled with the reason (title + `aria-describedby`). Failed start: "No camera connected. Nothing was recorded." as `role="alert"`, action "Close session", link to Devices, no evidence link. Degraded: banner names "Camera 2 (CAM-02) is not connected", that camera reads NO SIGNAL |
| Web Session New | `features/session-new/index.tsx:362` | The start toast says "Connecting cameras…" instead of "Recording started" while `captureDurable` is false |
| Mobile model | `apps/mobile/src/features/capture-selector/capture-notices-model.ts:310,319,327` | `failedStartOf`, `failedStartWords`, `camerasNotConnectedOf` (same rules as the web) |
| Mobile Session Live (tablet + phone, one code) | `session-live/end-session.tsx:176`, `session-live-screen.tsx:293,327`, `live-feed.tsx:153,228`, `session-live.math.ts:150`, `use-monitor.ts:118,146`, `status-strip.tsx`, NEW `capture-start-notice.tsx:40,68` | Connecting: End Session disabled with the reason under it and as its hint; feed chip reads CONNECTING with no red dot, picture paused; strip rows read "VIDEO n CONNECTING", never REC. Degraded: warning banner naming the camera; its strip row OFFLINE and its tile NO SIGNAL. `FailedStartNotice` is built and tested but NOT mounted (section 5) |

Already in the tree before this row (rows 71b, 72, 73, C1): `captureDurable` in the payload, the 409
`CAPTURE_NOT_DURABLE`, the banner / label "Connecting cameras…" and the hidden timer. Not rebuilt.

## 2. Real vs stand-in

Real: the notifier, the simulator's notice transitions, the engine, its audit chain, the supervisor,
the forwarder, the capture-session unit, PostgreSQL as `dems_app`. Stand-in: the worker
(`FakeWorkerProcess`), the devices (fake adapters). Clients: Simulated client mode with the state put
on the store as the Core sends it — the simulator itself never writes `captureDurable`.

## 3. Results

| Check | Command | Result |
|---|---|---|
| Watch + notifier on the real simulator (12 new cases) | `npx vitest run --root apps/core-server --project unit src/capture-notices` | 33 / 33 |
| `M5-NODEV-C-1` on PostgreSQL, real engine, fake worker | `/usr/bin/lockf -k .locks/db-migrate.lock npx vitest run --root apps/core-server --project db src/capture-notices/__tests__/session-start.db.test.ts` (sandbox off) | 4 / 4 |
| Web `M5-NODEV-C-W` client half | `npx vitest run --root apps/core-web src/features/session-monitor/__tests__/situation-c.test.tsx` | 8 / 8 |
| Web folders touched | `npx vitest run --root apps/core-web src/features/session-monitor src/features/session-new src/features/devices/__tests__/capture-notices.test.tsx` | 90 / 90 |
| Mobile `M5-NODEV-C-T/-P` client half | `npm test -w apps/mobile -- src/features/session-live/situation-c.test.tsx --maxWorkers=2` | 9 / 9 |
| Mobile folder touched | `npm test -w apps/mobile -- src/features/session-live src/features/capture-selector/capture-notices-model.test.ts --maxWorkers=2` | 22 files, 194 / 194 |
| Shared i18n pins | `npx vitest run --root packages/shared test/i18n.test.ts test/i18n-vocabulary-sync.test.ts` | 50 / 50 |
| Typecheck | core-server, core-web, mobile, shared | 0 errors in this row's files. Foreign: `packages/shared/src/sim/api.ts:496` (`EXPORT_IN_PROGRESS`, pass D4 / D5), `packages/shared/test/live-source-bindings.test.ts:89` (`applyStorageVolume`) |
| Lint | core-server, core-web, mobile, shared | 0 findings in this row's files (mobile: 1 warning in `runtime/log.test.ts`, not this row's) |

What the db test shows. 0 cameras: session `RECORDING` + `captureDurable: false` after the start,
then `FAULT` with `startedAt: null`, `bytesWritten: 0`; exactly one active alert (`CAPTURE_FAULT`,
CRITICAL, no target), one new `FAULT_RAISED` row, 0 `CAPTURE_DEVICE_UNREACHABLE` rows, 0 `.mp4` in
the session folder, 0 fragment rows; after `recover`: session null, evidence count unchanged,
history +1. 1 camera: no alert before the first fragment; after it one WARNING for `CAM-02` with
the six-key audit row and `degraded: true`, `CAM-02` offline / `LOST`, no fault.

Negative controls. "Not shown as recording before the first durable fragment": server — the same
read turns `true` and DURABLE is told in the control case; web — REC indicator and timer absent,
then present after `captureDurable: true`; mobile — "REC", "VIDEO 1 REC" and the enabled End Session
present before and after, absent between. "A failed start creates no evidence item": evidence count
unchanged while the history count moves by one (the recovery ran), and the durable control ends as
INTERRUPTED, not FAILED_START.

Red, not this row's: `src/modules/sessions/__tests__/static.test.ts` 2 cases (counts of
`app.engine.state|slice` and `request.body` in `routes.ts`, in-flight edits of pass D4 / row 71c).

Not proven: no real worker, no real camera, no HTTP request in mode real, no client against a Core
(Live client mode), no device or browser.

## 4. Decisions taken (for the controller)

1. **The degraded warning is raised at DURABLE, not at STARTED.** A start that then fails has one
   alert only (the row's check), and "recording one camera only" is true only once it records.
2. **A pre-check notice of the same camera is replaced** by the session-start one at DURABLE
   (resolve, then raise): the simulator allows one active alert per (reason, device), so otherwise
   no SESSION_START alert and no session-start audit row would exist after a pre-check WARN. This
   resolves a situation-B alert from the capture side; ux §8e.4 names only "a later pre-check".
3. **The watch does not raise the critical fault** when the capture side did (its row carries row
   71c's keys); it is only the net. It never calls `camerasAvailable()`: D84 R-4 clears capture
   faults inside the capture unit.
4. **"Connected" for the clear** = opened in a session that became durable, and no fault alert
   names the camera. `SessionCaptureEvent` has no per-camera "delivered" fact.
5. **Failed start on the clients = `FAULT` + explicit `captureDurable: false`.** The words "No
   camera connected" appear only when the alert carries `params.reason: NO_CAMERA_CONNECTED`;
   otherwise "Recording did not start. Nothing was recorded." (request 2 below).
6. **Self-mount** by a value import of `../capture-session` in `capture-notices/index.ts` (no cycle
   today: capture-session does not import capture-notices). Attached at first use, not at boot.
7. **New words beyond ux §14.2** in `common.session.*` (section 1). The existing banner strings
   `session.audioSource.connecting.*` and `features.session-live.connecting` are left as they are.
8. **The D131 pin** ("a Core in simulated capture sends no `sourceClass` for its built-ins") is NOT
   written: the device slice is row 140 / pass D1b's (`modules/devices`, `db/mapping`).
9. Process: my edits to existing files of my area were scripted exact-string replaces with a count
   assertion (the shared `common.ts` block was added with the Edit tool).

## 5. To wire (requests filed in `delegation_progress/file_requests.md`)

| Owner | What | Until then |
|---|---|---|
| row 71c / pass D4 | one call of `captureNotices(app)` where the sessions module registers | attached by capture-discovery's registration |
| row 71c / pass D4 | `reason: NO_CAMERA_CONNECTED`, `evidenceFiles: 0` on the ALERT params | clients say "Recording did not start. Nothing was recorded." |
| pass D4 (sim), D5 (live) | a simulator member for `captureDurable: false` -> durable / failed start; `details.reason` on the Live rejection | situation C cannot be produced in Simulated client mode by an operator; tests set the store |
| controller (mobile `session-recovery`, `navigation`) | mount `FailedStartNotice`; no recovery-of-evidence presentation for a failed start (OP-125-5) | tablet / phone show the ordinary recovery screen |
| shell / dashboard / Home owners | alert-centre item and tiles worded from the reason; "Connecting cameras…" on Dashboard, Home, bottom bar, Sessions hub | those places say the fault kind / "Recording" |

Also open: the web and mobile audio meters are still drawn while connecting (real capture sends no
generated meter, D84); the integrity panel of the web monitor still keys on `RECORDING`.

## 6. Browser / device flows for gate 75 (not run)

- **Flow F1 — `M5-NODEV-C-W`, `-T`, `-P`, connecting -> recording** (development sources, both
  cameras): start; before the first fragment: "Connecting cameras…", no timer, no REC, End Session
  disabled with the sentence; pressing it does nothing; then "Recording", timer, End Session works.
- **Flow F2 — `M5-NODEV-C-1` (+1), `M5-NODEV-C-W/-T/-P`, no camera**: start with both camera
  sources stopped; after the ingest-open window: fault presentation "Nothing was recorded.", 0
  timer, 0 REC, one alert-centre item, one `FAULT_RAISED` row, 0 files, Devices pointer; close the
  session: idle, no evidence item in the archive.
- **Flow F3 — degraded, same check IDs**: start with one camera source stopped: warning naming the
  camera, its tile NO SIGNAL, timer and the other tile run, one `CAPTURE_DEVICE_UNREACHABLE` row;
  next session with both cameras: the warning is gone after the first fragment.
- **Flow F4 — stop refused**: (with 71b's flow D) a stop sent by API while connecting: 409
  `CAPTURE_NOT_DURABLE`, the session stays RECORDING.

## 7. Checks for the test runner

| Command | Lock | Expected | IDs |
|---|---|---|---|
| `npm run test -w @dems/core-server` | none | baseline + the two `sessions/static.test.ts` reds until their owner moves the pins; `src/capture-notices` 33 green | M5-NODEV-C-1 |
| `npm run test:db -w @dems/core-server` | db-migrate | `session-start.db.test.ts` 4 green; `capture-session`, `capture-inputs/no-device.db` unchanged by the listener | M5-NODEV-C-1 |
| `npm test -w @dems/core-web` | none | `situation-c.test.tsx` 8 green; no other file changed result | M5-NODEV-C-W |
| `npm test -w apps/mobile -- --maxWorkers=2` | none | `situation-c.test.tsx` 9 green | M5-NODEV-C-T, -P |
| `npm test -w @dems/shared` | none | i18n pins green (one appended block) | — |
| Flows F1-F4 above, browser + emulators | heavy-host for the worker | as written | gate 75 |
