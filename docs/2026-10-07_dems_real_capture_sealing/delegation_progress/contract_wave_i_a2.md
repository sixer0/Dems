# Contract notes of fix wave I, driver A2 - for drivers B (core-web) and C (mobile)

Written 2026-10-10 by driver A2 before the server code, from the spec and the code as read.
Each section ends with its state: RULED (final), or BEING BUILT (the names are fixed; the last
section of this file says what landed). Contract totals do not move (97 / 36 / 61 / 67).

## 1. G70b-02 - "needs no password" against "the camera refused this user name or password"

**Ruling: the SERVER is right, the WEB sentences are wrong. No server change.**

Sources: `masterplan/03_api_contract.md:481` - "A `DEVELOPMENT` candidate ... **may** be tested and
adopted without one; fixture cameras with fixture credentials exercise the authenticated outcomes";
`masterplan/05_capture_architecture_spec.md:875` (ST-3) - the stub is "a device service over HTTP
with **one fixture account**". So a development source MAY need no password; the stub of the lane
does need its account. `masterplan/08_client_ux_spec.md:827` / `:1418`
(`common.captureConnect.noPasswordNeeded`, "This development source needs no password.") states
more than the Core knows before a test.

What the Core answers for a test WITHOUT a credential that the device refuses (op 95, 200):
`{ outcome: "AUTHENTICATION_FAILED", authenticated: false, usableProfileCount: 0,
failedAttemptsRemaining: <unchanged>, ... }` - no `reason` member. `authenticated: false` is the
fact "no credential was sent" (`connect/service.ts:330`, `:426`). The guard does not count it
(`connect/limits.ts:188`: 0 rejected credential-bearing requests).

Exact wording for driver B (web only; the tablet has no connect dialog):

| Where | Condition | Sentence |
|---|---|---|
| Dialog, DEVELOPMENT candidate, before a test (replaces "This development source needs no password.") | `sourceClass === "DEVELOPMENT"` | **"A development source can be tested without a password. If the test asks for one, turn on "Enter a user name and password"."** |
| Result | `outcome === "AUTHENTICATION_FAILED" && authenticated === false` | **"This camera asks for a user name and a password. None was sent."** and under it **"Turn on "Enter a user name and password", type them, then test again."** - never "The camera refused this user name or password.", and NO remaining-attempts line |
| Result | `outcome === "AUTHENTICATION_FAILED" && authenticated === true && reason === undefined` | unchanged: "The camera refused this user name or password." + the remaining-attempts line |

State: **RULED.**

## 2. G70b-05 - the scheme refusal: counter text, guard, audit row

Spec: erratum PE-FM4-03 (`masterplan/03_api_contract.md:36`, `:1051`; decision D181 ruling 3): the
lock-out guard counts REJECTED CREDENTIAL-BEARING REQUESTS, not outcomes; "a test refused for the
sign-in method, or sent without a credential, is not counted".

| Point | Outcome |
|---|---|
| Guard | Already as the spec says (`connect/limits.ts:185-188`; gate 70b saw it live: "Did not count against the guard"). **No server change.** |
| Counter text | `failedAttemptsRemaining` is a REQUIRED member of op 95's answer (`CaptureConnectionTestSchema`), so the Core keeps sending it - for a scheme refusal it is the host's unchanged count. **Client rule for B: draw the remaining-attempts line ONLY when `outcome === "AUTHENTICATION_FAILED" && authenticated === true && reason === undefined`** (= a credential was sent and refused). For `reason === "SCHEME_NOT_ALLOWED"` (and for `authenticated === false`, section 1) no count is drawn: nothing was counted. The lock-out sentence itself (429 `CONNECTION_TEST_LOCKOUT_GUARD`) is unchanged |
| Audit row | The audit type set stays 67. `CAPTURE_CONNECTION_TESTED.details` has no existing member that tells a scheme refusal from a refused credential (`outcome`, `authenticated: true`, `guardTripped: false` are the same for both). **Additive optional detail member `reason: "SCHEME_NOT_ALLOWED"`** on the row of a scheme refusal (the same closed code as op 95's `reason`); absent on every other row. A no-credential test is told by the existing `authenticated: false` |

State: guard and client rule **RULED**; the audit detail member **LANDED** (section 6).

## 3. G70b-01 - reasons of a refused assignment (ops 78 / 79), for B and C

After the fix an adopted camera is assignable at once (no client change needed for that).
`422 INVALID_INPUT` of ops 78 / 79 keeps `details: { in: "body", reason, deviceId }`; `reason`
becomes the TRUE one:

| `details.reason` | When | Client sentence today |
|---|---|---|
| `DEVELOPMENT_SOURCE_NOT_ALLOWED` | the device is a development source and the Core does not run development sources (C3 §4 row of that reason - unchanged meaning) | "This source can only be used in the development configuration." (keep) |
| `PRODUCTION_SOURCE_NOT_ALLOWED` (new value of the open reason code) | the device is a production source and the Core runs development sources | falls to the clients' generic 422 sentence today; optional own sentence: "This source cannot be used while the Core runs development sources." |
| `CAPTURE_DEVICE_NOT_SERVED` (new value) | the device is registered but no capture adapter of the running Core serves it | generic 422 sentence; optional: "This device cannot be used by this Core yet." |
| `CAPTURE_DEVICE_CLASS_MISMATCH` (new value) | the device is not of the class the line asks for | generic 422 sentence |

Both clients already map every reason other than `DEVELOPMENT_SOURCE_NOT_ALLOWED` to their generic
"invalid" message (`core-web/src/features/devices/capture-selector.ts:252`,
`mobile/src/features/capture-selector/capture-selector-model.ts:296`), so nothing breaks; the three
own sentences are optional.

State: **LANDED** as written (section 6).

## 4. G70b-06 - "Online / Stream live" for a source nobody opened

It IS a server fact, and it is not a checked one. `online` / `streamState` of slice 29
(`captureConfig.cameras[]`, `.mics[]`) and slice 30 (`captureDevices.devices[]`) are read at boot
from the stored `enabled` column (`apps/core-server/src/db/mapping/rows.ts:872-873`, `:913`):
`online = enabled`, `streamState = enabled ? LIVE : LOST`. `enabled` is written once at
registration (a local device: "is in the device list"; an adopted camera: `true`). After that the
two members change only when the Core reads the device: a pre-check or op 97 probe
(`packages/shared/src/sim/capture-notices.ts:235`) or a worker telemetry frame of a recording
(`capture-telemetry.ts:109`). So on an idle real-capture Core "Online" means "registered and not
known to be gone", and `streamState: LIVE` does not mean a stream is flowing.

Proposed additive member - **NOT BUILT in this wave** (section 6; a proposal for the controller). A client that already reads it defensively loses nothing: it is absent on every Core today.

`captureDevices.devices[].checkedAt?: number | null` (slice 30, op 77, op 96 `device`)
- absent: the Core does not state it (SIMULATED capture, an older Core) - draw as today;
- `null`: this running Core has not read the device's state since it started - draw **"Not checked"** in the place of Online / Ready / Reachable, and no stream line;
- a number (epoch ms, Core clock): the last read; `online` / `streamState` are that read's result.

Client rule that holds WITH OR WITHOUT the member (B and C, real capture only =
`captureOperation` is not `SIMULATED`): **"Stream live" is drawn only while a session of this Core
is RECORDING** (the telemetry of the recording is the only thing that makes it true). Outside a
recording a camera line says "Reachable" / "Not reachable" (from `online`) or "Not checked" - never
"Stream live", and no bitrate / PoE figure the Core did not measure.

State: the client rule is **RULED** and is all a client has in this wave. With `online` alone the truthful words on an idle real-capture Core are: `online === true` -> "Registered" (or "Reachable" only right after a pre-check / a microphone re-read of this client's own view), `online === false` -> "Not reachable"; never "Online / Stream live" outside a recording.

## 5. G75b-04 / G75b-03 - audit rows (information; no client change)

- Every audit row of an action a PAIRED DEVICE sent carries that device's id in the row's
  `deviceId` (as `AUDIO_SOURCE_SWITCHED` does): `SESSION_CREATED`, `PRECHECK_PASSED` /
  `PRECHECK_BLOCKED`, `RECORDING_STARTED`, `RECORDING_STOPPED`, `SESSION_CANCELLED`. Web-sent
  actions keep `deviceId: null`. A client that lists audit rows may show the device as it does for
  the switch row.
- A graceful stop / start of a real-capture Core writes no `FAULT_RAISED` "Power fail detected", no
  `TABLET_LINK_CHANGED` "Tablet control offline" and no `RECOVERY_STARTED {faultKind: POWER_FAIL}`
  row and raises no power-fail alert. The SIMULATED lane is unchanged.

State: **LANDED**, with ONE LIMIT for G75b-03 (section 6).

## 6. What landed

Final, 2026-10-10 (driver A2). Contract totals unchanged: 97 operations (36 GET / 61 POST), 67 audit
types; OpenAPI regenerated by the generator (+5 lines: the one optional member below).

| Item | Landed? | What a client / a test can rely on |
|---|---|---|
| G70b-01 adopted camera assignable at once | YES | ops 79 / 78 answer 200 for a camera op 96 just registered on a development Core - no restart |
| G70b-01 reasons | YES | section 3 as written: `DEVELOPMENT_SOURCE_NOT_ALLOWED`, `PRODUCTION_SOURCE_NOT_ALLOWED`, `CAPTURE_DEVICE_NOT_SERVED`, `CAPTURE_DEVICE_CLASS_MISMATCH` (`CaptureAssignmentRefusal`, `apps/core-server/src/modules/capture-config/routes.ts`). A PRODUCTION camera named on a development Core now answers `PRODUCTION_SOURCE_NOT_ALLOWED` (it answered `DEVELOPMENT_SOURCE_NOT_ALLOWED`) |
| G70b-02 | no server change | section 1 (web wording) |
| G70b-05 guard | no server change | section 2 |
| G70b-05 audit member | YES | `CAPTURE_CONNECTION_TESTED.details.reason: "SCHEME_NOT_ALLOWED"`, only on the row of a scheme refusal. Example: `CAPTURE_CONNECTION_TESTED_SCHEME_REFUSAL_EXAMPLE` (`@dems/shared/api`) |
| G70b-06 `checkedAt` | **NO** | not built: it needs the member in slice 30, its transitions in the shared simulator and the boot mapping of the Core - more than a NOTE finding may move in a wave with three other drivers on the same files. The client rule of section 4 stands alone |
| G70b-07 search ids | YES | a camera search id is unique across restarts within one database: `DSC-NNNNNN` goes on from the highest number of the stored audit chain. Same pattern (`CAPTURE_SEARCH_ID_PATTERN`); a client must not assume the first search of a session is `DSC-000001` |
| G75b-04 sending device | YES | rows `SESSION_CREATED`, `PRECHECK_PASSED`, `PRECHECK_BLOCKED`, `RECORDING_STARTED`, `RECORDING_STOPPED`, `SESSION_CANCELLED` carry the paired device in the row's `deviceId`; no `details` key was added. NEW optional member of the session slice: `session.precheck.sendingDeviceId?: string` (the device that sent the pre-check; absent for a web session). Example: `SESSION_PRECHECK_SENDING_DEVICE_EXAMPLE` (`@dems/shared/api`). A client test bed that builds a `precheck` with a strict key list gains nothing to do: the member is optional |
| G75b-03 graceful stop / start | YES for a session that is FINALIZING and for the tablet row; **NOT for a session that was PRECHECK / ARMED / RECORDING / STOPPING at the stop** | Real capture only. FINALIZING at the stop: the next start writes no `FAULT_RAISED` "Power fail", no `RECOVERY_STARTED {faultKind: POWER_FAIL}`, raises no alert; the session stays FINALIZING and the seal resumes. No `TABLET_LINK_CHANGED` "Tablet control offline - recording continues" row at any start of a real-capture Core (the link reads OFFLINE in the state; "Tablet control connected" is written when a device connects). The other four states still get the simulator's restart fault (kind `POWER_FAIL`): open item, see implementation note 132 section 4 |
