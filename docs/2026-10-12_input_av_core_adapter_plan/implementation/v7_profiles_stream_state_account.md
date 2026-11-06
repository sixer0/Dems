---
task_id: 2026-10-12_input_av_core_adapter_plan
row: V7 (wave 12, track D) - single writer of packages/shared and of the count pins after N2
date: 2026-10-14
agent: coder-execution (V7)
decisions: C36, C111 (Q-02), C113, C115, C117, C119; controller routing of row PR's two request lines (mid-row)
status: complete - three items built and checked; one red not mine (section 7); two findings for the controller (section 6)
---

# Row V7 - a camera's stored profiles reach the clients; a lost camera says LOST; the microphone account in two parts

Head 1fbeada7 plus the wave's uncommitted work. Nothing committed. NO schema change (D4a holds the schema pins). Edit tool only for existing files; new files with Write; `openapi.json` by the repository's generator.

## 1. Item 1 - the stored profile list on the device entry (C36, C111 Q-02, C117) - DONE

### 1.1 The member

`CaptureDeviceStatusSchema.profiles` (`packages/shared/src/api/state-slices.ts`), optional, strict entries:

| Member | Form |
|---|---|
| `profiles` | array of `CaptureDeviceProfileSchema`, at most `CAPTURE_DEVICE_PROFILES_MAX` = 16 (the Core's own bound, `STORED_PROFILES_MAX` of `capture/fence/production-parts.ts`; the table has no count CHECK) |
| `profiles[].code` | the minted code (`^[A-Z][A-Z0-9_]{0,63}$`) - the value a camera line of operation 78 names |
| `profiles[].codec` / `.resolution` / `.fps` | the forms of `CameraStreamFactSchemas`, each NULL where the code states none - never a default (C36) |

EMPTY list = none stored. PRESENT on every REGISTERED camera (Core and in-app simulator: `registerCaptureDevice` always states it; the simulator's cameras state `[]`). ABSENT on microphones, the switch, built-in devices whose row lists nothing, and from an older Core.

THE FACTS COME FROM THE CODE, not from `capture_device_streams`. DRIVER DECISION 1: the stream table holds codec / width / height but NO rate; the minted code holds all three in the closed form the mint makes, and reading it back is the mint's inverse (the Core's `cameraStreamFactsOf`, the clients' `storedStreamFactsOf`). ONE shared reader now: `captureProfileFactsOf` / `captureDeviceProfilesOf` (`packages/shared/src/sim/capture-profile.ts`; constants in `sim/vocabulary.ts` because the API contract may load no engine file - a static rule caught my first import).

### 1.2 Where it is carried

| Place | Change |
|---|---|
| shared engine type | `CaptureDeviceStatus.profiles?`, `CaptureDeviceProfile`, `RegisterCaptureDeviceInput.profiles?` |
| `registerCaptureDevice` | states the list it is given (refuses a value that is no list of <=16 codes each once; never cuts); none given = `[]` |
| `db/mapping/rows.ts` `captureDeviceFromRow` | reads `capture_devices.profiles` back (a value that is no list of codes = `[]`, never a refused rehydration); a built-in camera whose row lists nothing keeps its old shape. `captureDevicesToRows` still writes the empty form: the column's ONE writer stays the adoption's statement (header comment rewritten) |
| `adoption.ts` (one line) | `registerCaptureDeviceIn(..., profiles: device.profiles)` - the slice and the row state the same list in the adoption's unit |
| NEW internal action `storeCaptureDeviceProfiles` (51 -> 52) | for row PR's storing connection test (request line 511): shared transition + `SimActions` + `SIM_ACTION_OPERATIONS` (INTERNAL) + live binding (LOCAL); engine door `storeCaptureDeviceProfilesIn` (`engine/internal-actions.ts`, `host.ts`, `index.ts`); `adopted-profiles.ts` calls it through `StoredProfilesUnit.storeProfiles` in the unit that writes the row; `capture-discovery/index.ts` binds it |
| operation 108 (request line 512) | answer `profiles?: PROFILES_STORED \| STREAM_PROFILE_DIFFERS` (`CaptureDeviceTestProfiles`); `CAPTURE_DEVICE_CONNECTION_TESTED` gains `profiles`, `storedProfileCount`, `statedProfileCount` (0-16), `differingProfileCount` (0-32) - all four or none (builder rule); `adopted-test.ts` hands them (`storedProfilesFactsOf`) |
| clients | ONE line each in `storedProfilesOf` (web, tablet): an element that is an object is read by its `code`; a bare code is still read |

Operation 78's camera line stays the carrier (`plan.ts:98, 213` reads `profile` of the line; `routes.ts` `assertOwnProfile` over `cameraLinesOf`); operation 79 stays `{ trackId }` (`CaptureCameraSourceRequestSchema`). Not changed.

### 1.3 Proofs (beside the unit cases)
- DATABASE, the real door: `adopted-camera-test.db.test.ts` case "row PR (a) then (c)" - after operation 108 stored the code, `core.app.engine.state()` entry of CAM-01 states `[{ code, codec: 'HEVC', resolution: '1080p', fps: null }]` WITHOUT a restart; the answer says `PROFILES_STORED`; the entry's details carry the four keys.
- `readdress-door.db.test.ts` "TOGETHER" (the stored registry IS the engine's registry) went RED when a registered camera stated no member and `[]` came back from the row - the reason the action now always states the list. Green after.

## 2. Item 2 - finding E-01: a lost camera says LOST (C113, C115) - DONE

NEW `packages/shared/src/sim/camera-stream-fault.ts`, wired in `faults.ts` (`raiseFaultAtKey`, `clearFaultAtKey` - every door, `clearCaptureFaultsTransition` included) and `capture-telemetry.ts`:

| Event | Effect, in the unit of the fault |
|---|---|
| raise `CAPTURE_FAULT` keyed by a camera, reason in `CAMERA_STREAM_FAULT_REASONS` = `CAMERA_STREAM_ENDED`, `CAMERA_NOT_CONNECTED`, `CAMERA_NO_PICTURE` | `streamState: LOST` on the registry entry and every selector line naming it |
| the LAST active fault of that family on the camera clears | `LIVE` again - only for a device the Core holds as `online`; a not-online device stays LOST until telemetry says CONNECTED |
| telemetry `CONNECTED` while a family fault is active | does not say LIVE (the relay's ingest stays connected while it re-opens the camera) |

`online` untouched. NOT in the family (DRIVER DECISION 2): the two integrity refusals `CAMERA_ANNOUNCE_NOT_MATCHED/_SEEN` (what was refused is a connection whose origin is unknown), clock reasons, a reasonless `CAPTURE_FAULT` (the simulator's). The simulator raises none of the family itself: `sim-capture-telemetry`, `-fault`, `-own-capture`, `-notices`, `-start`, `-config` pass UNEDITED (233 tests, before my new cases).

AN IDLE CAMERA has no member of its own: at rest the selector line says `LIVE` (not nullable; the set has no "not read"). Not added - noted (request line).

### 2.1 THE POE CONSEQUENCE - and a finding (section 6, F-V7-1)
Test `sim-capture-telemetry.test.ts` "PoE (OD-22)": a camera with `CAMERA_STREAM_ENDED` reads LOST; the action behind operation 48 (`deviceCommand(id, RESTART)`) is ACCEPTED for it outside a recording (one `DEVICE_COMMAND` row; the camera stays LOST) and REFUSED inside one (`restart is unavailable while recording`). RESULT: green. CONTROL in the same case: the engine accepts the same restart for the LIVE camera too.

## 3. Item 3 - the microphone account (C119) - DONE

(a) TWO ENTRIES, the bound of 16 stays (`core/audit-details.ts`): required key `part` (1-2) added to the closed list (now 21 keys). `part` 1 = the path (7 keys: `sessionId, attempt, part, captureLayer, captureGroup, account, openRetries`) + the source's six numbers + `openRunFromSample` (at most 14); `part` 2 = the path + the track's seven numbers (14). `account: NONE` = two entries of 7 keys. Exported: `CAPTURE_AUDIO_ACCOUNT_PARTS`, `_PATH_KEYS`, `_PART_NUMBER_KEYS`, `captureAudioAccountParts` (the cut, for N11; throws on a half-stated account) and `captureAudioAccountOfParts` (the join, for N12: `ACCOUNT_PART_MISSING | _REPEATED | ACCOUNT_PARTS_DIFFER | ACCOUNT_PART_KEYS` - a missing part is no account). Writer accepts each part of N2's CLOSED and NOT_CLOSED accounts (the whole 19/20-key row is still refused, as it must be). Fixture row (`db/fixtures/operations.ts`) gained `part: 1` - one example entry, no row added (DRIVER DECISION 3: no fixture count moves). The shared vocabulary comment states the parts.

(b) RULE 5 (`evidence-package/manifest.ts`): the closing reconciliation (a run ends at or before the largest field 144; runs + not-listed at most the fed inserted total; the fed-sum bound) is asked only of an attempt whose MEASURED accounts are all `CLOSED`. `NOT_CLOSED` is exempt; identity (rule 2), per-record bounds, run order, overlap and count still hold; `NONE` as designed. A relaxing only. The notice's form for an attempt with a `NOT_CLOSED` account: "Audio: NOT SAMPLE-CONTINUOUS (bench capture path of a Mac). ACCOUNT NOT CLOSED, measured to sample Y: X arrived; Z are inserted silence (runs ...)." (DRIVER DECISION 4: "rest NOT MEASURED" dropped from THIS form to stay within 256 at the largest numbers - the existing bound test holds it; the mixed CLOSED+NONE form of N2 is unchanged.)

### 3.1 Existing packages verify byte-for-byte unchanged (N2's two instruments, `.cache/task4-n2/`, re-run after the LAST shared edit)
- Product pipeline: `v7b.switch` manifest sha256 `94f26937...9b823333`, signature `e720f9b6...1b017`; `v7b.one-interval` `e4de4742...a1e3e7bc`, `16bbc8ee...a91d78`; `cmp` against `before.*`: identical, both.
- Committed shared vs working tree, 5 manifests (example, restartGap, hostProfile, videoAbsence, allThree): `cmp verify.head.txt verify.work.txt` identical (and identical to N2's own `work` output).

## 4. Counts and pins

110 operations (=), 85 audit types (=), **52 actions (+1)**, 9 verify notices (=); internal 8 -> 9, local bindings 9 -> 10.

| File | Pin |
|---|---|
| `SH/test/api-domain-operations.test.ts` | 51 -> 52; internal 8 -> 9 (+ name) |
| `SH/test/live-source-bindings.test.ts` | 51 -> 52; local 9 -> 10 (+ name); ARGS + one |
| `CS/engine/__tests__/hosted-actions.test.ts` | 51 -> 52; NOT_HOSTED + one |
| `CS/core/__tests__/writers.test.ts` | account list +`part` (twice); 19/20/20 -> 19/20/21; tested list +4 keys |
| `SH/test/api-capture-discovery.test.ts` | operation 108 answer key list + `profiles` |
| `SH/test/sim-capture-discovery.test.ts` | two adoption expectations + `profiles: []` |
| `SH/test/evidence-package.test.ts` | the NOT_CLOSED notice line |

`openapi.json` by `npm run openapi:gen` (sandbox off: `tsx` binds a pipe). It was run FOUR times as the contract grew within this row (the controller's mid-row routing added two members); the last run is after the last shared source edit: 110 operations, 1,727,315 bytes, and the shared suite's byte comparison is green on it.

## 5. Existing expectations changed (all forced by a ruling; each named)
- Tablet `camera-no-preview.test.tsx:111` - W5 pinned "raising the fault changes no line" (the E-01 premise): now the line is LOST.
- Web `camera-profile.test.tsx:163`, tablet `camera-profile.test.tsx:54` - an object element was "no code"; it is the contract's shape now. Tablet `camera-profile.test.tsx:83`, `selector-lines.test.tsx:246` - the member's data in the contract's shape (typecheck).
- Row PR's `adopted-test.test.ts` (answer and details of cases (a), (b); the static list of `OutcomeFacts`; the world gained `engineLists` / `storeProfiles`) and `adopted-camera-test.db.test.ts` (row 146 and row PR cases: answer and detail keys; the settle wiring with the door).
- N2's `writers.test.ts` cases (the NONE examples gained `part`; "the 16-key cut is accepted" became "refused without `part`, accepted with it").

## 6. Findings for the controller
- **F-V7-1 (OD-22 is enforced nowhere).** `CAMERA_NOT_LOST` exists only in the contract text (`api/devices.ts:313`) and in the web client's refusal reader. Operation 48 runs `deviceCommand(id, RESTART)` (`modules/devices/index.ts:157-168`), refused only while RECORDING; no transition of the engine, no route of the Core and no simulated route reads `streamState`, performs a PoE cycle or writes `CAMERA_POE_CYCLED`. So `LOST` changes nothing at operation 48 today: a camera can be "restarted" whether LIVE or LOST. The consequence C115 feared does not arise from this row, and the rule it relies on is not built. Request line.
- **F-V7-2 (idle camera).** At rest a selector line says `LIVE`; the set has no "not read". Not added (brief). Request line for the next contract step if wanted.

## 7. Checks (this Mac; `--maxWorkers=2`)

| Check | Result |
|---|---|
| shared, whole workspace (after the last edit) | `Test Files 105 passed (105)`, `Tests 2912 passed (2912)`; `tsc` 0; `oxlint` 0 |
| Core unit, targeted (mapping, core, fixtures, engine, devices, capture-config, capture, capture-discovery, evidence-verify/export, capture-notices, test/static) | `Test Files 1 failed, 109 passed (110)`, `Tests 1 failed, 2429 passed` - the one red is NOT mine (below) |
| Core database, throw-away DBs under `db-migrate.lock` (fault-key, restart, readdress-door, capture-actions, two device-upsert, no-device, capture-discovery, minted-code, connect, capture-config, session-start, readdress) | `Test Files 13 passed (13)`, `Tests 155 passed (155)` |
| `adopted-camera-test.db.test.ts` (heavy host, its own lock; relay + test camera double on loopback) | first run 1 failed / 17 passed (row 146's answer keys - mine, fixed); second run `Tests 18 passed (18)` |
| Core `tsc` | 0 |
| web: `tsc -b`, `oxlint`; devices, session-monitor, dashboard, session-new, live-runtime-static, real-core-facts | 0, 0; `38 files, 524 passed` (after one red of my own: the object-element case) |
| tablet: `tsc`, `eslint`; capture-selector, devices, session-live, dashboard, session-new | 0, 0; `Test Suites 85 passed`, `Tests 1026 passed` (first run 2 failed: the W5 premise, mine; `devices-states.test.tsx` passed on the rerun unchanged - no edit) |
| mock-core, transcriber `tsc` | 0, 0 (mock-core's own tests bind ports: not run) |
| two unchanged-package proofs | identical, both (section 3.1) |

RED NOT MINE: `src/modules/capture-config/__tests__/static.test.ts:175` R-5 - `src/modules/capture-discovery/adopted-profiles.ts` (row PR's new file) is now a file that writes a reveal reason text; the pinned list `REVEAL_REASON_WRITERS` does not name it. Owner: row PR / the capture-config static list.

Mutations seen RED (each a temporary Edit, reverted): `captureDeviceOf` without the member; facts with a default rate of 25; `captureDeviceFromRow` without the member; `cameraStreamStateAfterFaults` a no-op; telemetry guard off; restore ignoring `online`; part 1 holding `fedSamples`; the join accepting one part; rule 5's exemption gone; rule 5 never asked; `settleStatedProfiles` without the door; the 108 builder emitting the word without its counts.

## 8. Not proven
No real camera, relay loss or PoE switch (doubles; hardware checks 9A). No browser or emulator session. The seal's use of the join (N12) and the writer's use of the cut (N11) are not built. The two clients show no new words for `PROFILES_STORED` / `STREAM_PROFILE_DIFFERS` (request line to the client writer).

## 9. Statement
Existing files changed with the Edit tool only; new files (`sim/capture-profile.ts`, `sim/camera-stream-fault.ts`, this record, `row_v7.md`) with Write. `openapi.json` is the generator's. No scripted replace, no shell append. Nothing committed, staged or reverted. No schema file, migration or schema pin touched.

---
*Generated: 2026-10-14*
