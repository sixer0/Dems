# Row B2 - review follow-ups S-01 and S-02 (second pass of the phase-3 code review)

Status: S-02 complete on doubles; S-01 partial - done as far as the contract allows, the rest is a request to contract step V6.
Agent: coder-execution (B2, track D). Date: 2026-10-13. Tier 1.
Sources: `verification/060b_m3_review_second_pass.md` (S-01, S-02), decisions C36, C50 (N-01), C60, C63, C95.

## 1. S-01 - a track without a stored stream statement

### What was there
`withCameraStreamFacts` (`apps/core-server/src/modules/devices/status.ts`) answered a track "as it was" when its selector slot
is unassigned or holds a code that is no stream statement. "As it was" is the simulator's initial `1080p / 25 / H.264` of the
`cameras` slice: no stream stated any of the three (against C36).

### What the contract allows today (read-only reading of `packages/shared`)
- `CameraStreamFactSchemas` (`packages/shared/src/api/state-slices.ts:528-541`) feeds the `cameras` slice (`:553-555`) and the
  video track status (`core-api.ts:424-426`).
- `fps`: `.nullable()`, described "null when the stream states no rate. Never a default." - an honest "not stated" EXISTS.
- `resolution`: a text held to `CAMERA_RESOLUTION_PATTERN`; `codec`: `z.enum(['H.264', 'HEVC'])`. Neither nullable nor
  optional; the slice is a strict object. No `UNKNOWN` member. There is NO honest "not stated" for either.
- Measured, not only read: the case "THE GAP THAT STAYS" of the test block refuses null, an absent member, `UNKNOWN` and an
  empty text for both, with a positive control (the unchanged track and a null rate are valid).

### What was changed
- `withCameraStreamFacts`: for a track without a statement `fps` is now `null`. `resolution` and `codec` stay the slice's;
  no other value is invented. Identity is kept (the same array when nothing differs; a track whose rate is null already is the
  same object). The state is not written.
- Scope of the effect: the three camera-bearing reads of a Core in REAL capture (operations 44, 46, 47), where the routes pass
  `streamFacts`. A SIMULATED Core is unchanged (control case).
- Readers: none changed. The web and mobile readers named by the review already print a null rate without a rate
  (`cameraFormatNoRate`, row 54 / 55).

### What an operator now sees for a track without a stream statement
On the reads of operations 44 / 46 / 47 of a real Core: `1080p` and `H.264` with NO rate (before: `1080p / 25 / H.264`), and
no source (`sourceDeviceId: null`) when the slot is unassigned. The picture and the codec shown are still not a stream's
statement. That is the part left open.

### The fact that bounds the harm (verified by existing tests, run in this row)
- ASSIGN: a production camera (`ONVIF_RTSP`) on a Core in real capture is refused without a profile of its own stored list -
  `422 INVALID_INPUT`, `CAMERA_PROFILE_NOT_STATED` / `CAMERA_PROFILE_NOT_OF_DEVICE` (row 187, C36 (1)). Run:
  `capture-config.db.test.ts`, block "5. task 4 row 187": 4 cases passed.
- START: the camera adapter opens no stream without the stored stream row of the profile - `CAPTURE_PROFILE_UNKNOWN`, 0
  reveals, 0 requests, 0 relays. Run: `camera-adapter-open.db.test.ts`, "no profile in the target ...": passed.
- So, by the Core's own writers, a production track without a statement is an unassigned track: nothing is recorded under the
  invented picture and codec.
- LIMIT OF THAT BOUND (found while verifying, stated rather than assumed): the database holds a stored profile code to the
  `CODE` form only (`capture_devices_profiles_code_check`, `capture_device_streams_profile_check`), NOT to the statement form.
  The statement form is what adoption mints (row 51), by code, not by constraint. Row 187's own fixture uses
  `HEVC_2160P25_MAIN`, a code that is no statement: such a code, written by another hand, would be assignable and its track
  would read here like an unassigned one (null rate, the slice's picture and codec). A case of the new block pins this reading.
- NOT a refusal added by this row: no new assignment or start rule was needed or written (`capture-config`, the camera
  adapter and `capture-session` are other agents' areas).

### Left, with the exact request (`file_requests.md`, row B2)
`CameraStreamFactSchemas.resolution` and `.codec` nullable in `packages/shared/src/api/state-slices.ts`; then
`withCameraStreamFacts` answers all three null in the `facts === null` branch; the readers listed in the request print the
existing "not reported" text. Also open and outside this row: the committed `cameras` slice itself still holds the
simulator's literal on a real Core (no Core writer puts stream facts into it); which screen reads the slice and which the
operations was not traced (the review says the same).

DRIVER DECISION D-1 (for the controller to confirm): answering `fps: null` while `resolution` and `codec` cannot follow. The
row reads "1080p, H.264, no rate" - partly honest. Taken because the brief says to use any null the schema admits and because
it removes one invented fact without adding one; the alternative (leave all three) keeps a rate no stream stated.

## 2. S-02 - a loss before its watch is attached

### What was there
`capture-composition.ts`: `relayEnded: (end) => cameraWatch?.relayEnded(end)` and
`onSourceLost: (id, error) => micLossWatch?.sourceLost(id, error)` - before the attach both dropped the loss without a word.

### What was changed (the composition only; the two loss paths, the two attach members, three codes)
- A loss that arrives before the attach is KEPT (per watch, in order, at most `EARLY_LOSSES_KEPT` = 64) and REPORTED at once
  through the composition's report port, level `error`: `CAPTURE_COMPOSITION_CAMERA_WATCH_NOT_ATTACHED` (existing code) or
  `CAPTURE_COMPOSITION_MIC_LOSS_WATCH_NOT_ATTACHED` (new), with the device id (only a text of the id form) and the count kept.
  A lift that never attaches its watch is therefore seen at the first relay end (the review's scenario).
- At the attach the kept losses are handed to the watch, in order, once. Nothing else is handed over: no fault is invented
  (control case: an attach with nothing kept raises nothing).
- SUPERSEDED ATTEMPTS (rows 191, 85c; C60 (2)). The microphone watch asks `superseded` "in the turn the adapter speaks".
  For a kept loss the composition asks the port in that turn and keeps the answer (or the throw); at the hand-over the watch's
  `superseded` answers THAT, not the port's later word. A word of a superseded attempt is still dropped by the watch; a word
  whose port could not answer still counts. The camera watch judges nothing by attempt in `relayEnded` (the adapter does,
  before it tells): the `end` is handed over unchanged.
- BOUND: beyond 64 a loss is not kept and is reported `CAPTURE_COMPOSITION_EARLY_LOSS_NOT_DELIVERED`
  (`reason: MORE_THAN_KEPT`); a watch that throws at the hand-over is reported with `reason: WATCH_THREW` and the next kept
  loss still reaches it. Codes and device ids only; no text of an error or of an `end` is logged.
- After the attach the two paths are exactly as before.

### Proof (doubles, at the composition's level - before the lift no production kind records)
Block "row B2 (S-02)" of `src/__tests__/capture-composition.test.ts`, 5 cases: the report lines; the REAL camera watch on the
composition's sink over the engine double (two early relay ends raise two faults at the attach, in order; the later path
unchanged; control with nothing early); the REAL microphone loss watch (an early loss raises at the attach, an early loss of
a superseded attempt raises nothing although the port says otherwise at the hand-over, and the reverse); the port that
throws; the bound and the throwing watch. Two existing cases re-stated (the early loss now reaches the recording double).

The doubles: the ports of the composition (`rig`), the fault engine (`engineDouble`), no adapter, no relay, no card.
UNPROVEN, for the lift (row 88) and the hardware package: that the lift attaches each watch before its adapter can report;
a kept loss is raised with the time of the hand-over, and a camera that re-opened in between is cleared only when the watch
observes it back (its own rule, C60 (2)).

DRIVER DECISION D-2: level `error` for an early loss (the review's proposal), also when the attach follows normally.
DRIVER DECISION D-3: the bound of 64 per watch.

## 3. Files

Changed, Edit tool only (no shell write, no scripted replace, no whole-file rewrite):
- `apps/core-server/src/modules/devices/status.ts`
- `apps/core-server/src/modules/devices/__tests__/status.test.ts`
- `apps/core-server/src/capture-composition.ts`
- `apps/core-server/src/__tests__/capture-composition.test.ts`
- `delegation_progress/file_claims.md`, `delegation_progress/file_requests.md` (one line each)

New: this file, `delegation_progress/row_b2.md`.
Not touched: `packages/shared`, `capture/adapters/camera`, `capture-session`, the static lists, `apps/core-web`, `apps/mobile`.

## 4. Checks (targeted, `--maxWorkers=2`)

| Check | Result line |
|---|---|
| Unit: composition, `src/modules/devices` (all), three static files - first run | `Tests 1 failed, 307 passed (308)` - the one red was this row's own new control (a one-track answer; the schema wants two) |
| Unit: `status.test.ts` after the fix | `Test Files 1 passed (1)`, `Tests 64 passed (64)` |
| Database: `capture-composition.db`, the four devices database files | `Test Files 5 passed (5)`, `Tests 65 passed (65)`, `0 remain` |
| Database: row 187 block and the adapter's `PROFILE_UNKNOWN` case (the bounding fact) | `Test Files 2 passed (2)`, 5 cases passed, `0 remain` |
| Static set `test/static` | `Test Files 17 passed (17)`, `Tests 210 passed (210)` |
| Typecheck `tsc --noEmit` (core-server) | exit 0 |

Not re-run after the last one-line edit of a test TITLE in `capture-composition.test.ts` (no code or expectation changed).
No full suite was run (driver rule 7). Database runs under `.locks/db-migrate.lock`, throw-away databases only; ports 4423 and
5178 not touched.
