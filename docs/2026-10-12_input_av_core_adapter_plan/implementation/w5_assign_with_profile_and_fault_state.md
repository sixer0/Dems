---
task_id: 2026-10-12_input_av_core_adapter_plan
row: W5 (wave 12, track D)
date: 2026-10-14
agent: coder-execution (W5)
decision: C111 (findings Q-01 and Q-02 of verification/060d_m3_review_fourth_pass.md); C36, C60
status: needs-review
---

# Row W5 - the assignment of a production camera with a stored profile; a camera fault in the place of "Live"

Tier 1. Head 1fbeada7, branch task4/input-av-core-port. Writer of apps/core-web and apps/mobile only. Nothing committed.

## 1. Status in one paragraph

Q-01 is DONE in both clients. Q-02 is BUILT in both clients and is NOT CLOSED END TO END: the brief's premise - "the list the Core states for that device" - does not hold. No answer and no slice of the Core carries a camera's stored profile list, and the contract's device entry is a strict object that refuses the member. Both clients read the list through one function each (the seam); until the contract and the Core state the member, every production camera reads "no stored profile" on a real Core and cannot be assigned from either screen. That is why this row is `needs-review` and why two request lines are marked blocking.

## 2. What was found before writing (each with its source)

| # | Fact | Source |
|---|---|---|
| F1 | Operation 79's body has NO profile member: a strict `{ trackId }` | `packages/shared/src/api/devices.ts:203-207` (`CaptureCameraSourceRequestSchema`) |
| F2 | Operation 78's camera line has one: `{ trackId, deviceId, profile? }`; the Core judges it by the same rule | `packages/shared/src/api/devices.ts:106-114`; `apps/core-server/src/modules/capture-config/routes.ts:325-338` (`assertOwnProfile` over `cameraLinesOf`) |
| F3 | The device entry of operation 77 and of the `captureDevices` slice has no `profiles` member and is a strict object | `packages/shared/src/api/state-slices.ts:1166-1193` (`CaptureDeviceStatusSchema`) |
| F4 | The typed client refuses an answer with a member its schema does not name | `packages/shared/src/client/core-client.ts:763-766` |
| F5 | The stored list is read by the Core for its own rule only | `apps/core-server/src/modules/capture-config/store.ts:171-187` (`READ_CAMERA_PROFILES`); request line of row 187 (`delegation_progress/file_requests.md:198`: "the replicated device slice does not carry them yet") |
| F6 | The ONE writer of `capture_devices.profiles` is the adoption; the test of a registered camera (operation 108) stores nothing | `apps/core-server/src/modules/capture-discovery/adoption.ts:35`; `adopted-test-route.ts:1-31` ("changes no setting") |
| F7 | Neither client wires operation 108 | `grep testCaptureDeviceConnection apps/core-web/src apps/mobile/src`: the API reference only |
| F8 | The camera fault is an alert `kind: CAPTURE_FAULT`, `target: <device id>`, `params.reason`, `active`; raising it changes no selector line; the Core clears it by the same key | `packages/shared/src/sim/capture-telemetry.ts:175-255` (`faultOfCaptureWarning`, raise and clear transitions) |
| F9 | Ruling D222 (2) pins the tablet's FORMAT CHIP (`monitor-feed-format`) as absent beside a recording of the Core's own capture - not the tile's state word | `apps/mobile/src/features/session-live/connecting-meters.test.tsx:184-199` |

## 3. Q-02 - what was built

One rule, stated once per app (`camera-profile.ts`):

| The camera of the choice | Result | Request |
|---|---|---|
| any camera off a Core in real capture; a development source (`FAKE`, `LOCAL_DEVICE`) | `PLAIN` - no profile control | operation 79 `{ trackId }`, as before |
| a production camera (`CAMERA`, `ONVIF_RTSP`) with stored profiles | `CHOOSE` - the profiles are listed by what each is; exactly one is preselected and still shown; several: none preselected, Save disabled until chosen; a held line's profile is kept if the camera still lists it | operation 78 `{ cameras: [{ trackId, deviceId, profile }] }` |
| a production camera with no stored profile | `NO_PROFILE` - nothing offered, Save sends nothing, the sentence says why | none |

A profile reads `<codec> • <picture> • <rate>` from the stored code (W4's decoder `storedStreamFactsOf`), with "Codec not stated" / "Picture not stated" / "Rate not stated" per null fact, and "Not stated (CODE)" for a code that is no stream statement.

Web: `capture-selector-panel.tsx` (`CameraSourceRow`) draws a second kit `Select` (`selector-profile-<track>`) and a hint line (`selector-profile-hint-<track>`); `capture-selector.ts` `setCameraSource(deviceId, trackId, profile?)`. Tablet: `capture-source-sheet.tsx` draws a second kit `ListGroup` radio group under the cameras (`capture-source-profile-<code>`, hint `capture-source-profile-hint`); `SelectorCommand` of kind `camera` carries an optional `profile`; `capture-selector-port.ts` sends operation 78 for it (`cameraProfileBody`); `isNoChange` treats another profile of the held camera as a change. Tablet refusals: `CAMERA_PROFILE_NOT_STATED` and `CAMERA_PROFILE_NOT_OF_DEVICE` read the shared sentence (`common.captureSlotRefusal`) in the selector's notice; the web already did (row 234).

The words the operator reads:

- Two stored profiles: "This camera has 2 stored stream profiles. Choose the one this track records, then save." with the options e.g. "HEVC • 2560x1920 • 20 fps", "H.264 • 720p • 30 fps".
- One: "This camera has one stored stream profile. It is the one this track records."
- None: "This camera cannot be assigned: the Core holds no stream profile for it, and it does not pick one for a camera. The profiles of a camera are stored when its connection test reads its stream, before the camera is added. Nothing was changed."

## 4. Q-01 - what was built

`cameraCaptureFaultOf(alerts, deviceId)` in each app's `stream-facts.ts`: an ACTIVE `CAPTURE_FAULT` alert whose target is the camera. Reason `CAMERA_STREAM_ENDED` reads "Stream lost"; any other reason about the camera reads "No signal". A `SYSTEM` (advisory) alert and a fault of the capture as a whole are no track fault. Judged only on a Core in real capture.

| Reader | Before | Now, while the fault is active |
|---|---|---|
| web `trackFactsOf` (Devices tile and drawer, Dashboard tile, Session New, Session Monitor format line) | the stored format | the fault in the place of the format |
| web "No preview" tile, state line (the Session Monitor feed) | "Stream live" | "Stream lost"; `data-fault` |
| web Session Monitor input card, state word and dot | "READY", green | the fault word, danger, `role="status"` |
| tablet `statedTrackOf` (device detail) | the stored format | the fault |
| tablet "No preview" tile (the Session Live feed, Home, Devices) | "Reachable" / "On" | "Stream lost" |

When the Core resolves the alert each reader returns to what it said before. The tablet's format chip (D222 (2)) is not touched; `connecting-meters.test.tsx` passes unedited.

## 5. Driver decisions (for the controller to confirm)

1. The profile travels by operation 78, not 79 (F1, F2).
2. Real capture is told by the rule the apps already have (`useRealCaptureCore`; on the tablet the request's `reported` states): a Core in simulated capture never asks for a profile.
3. The sentence for "no stored profile" names no action, against the brief's "test the connection first" (F6, F7): that test stores nothing as built.
4. A reason other than `CAMERA_STREAM_ENDED` on a camera's capture fault reads the general "No signal".
5. Only the RAISED fault changes the state word of the two "No preview" tiles and the monitor card; the slice's own fault keeps its existing words there, so no existing expectation moved.
6. Row CB's line to W5 (drop the mode's part of `measuredFiguresShown`) was not taken: optional by its own words, and unsafe against an older Core.

## 6. Checks (2026-10-14, this Mac; no browser and no emulator check was made - the gate's scripted session covers it)

| Check | Command | Result |
|---|---|---|
| web, new and extended files | `vitest run camera-profile.test.tsx source-state.test.tsx camera-no-preview.test.tsx --maxWorkers=2` | 3 files, 41 passed |
| web, targeted existing suites | `vitest run src/features/devices src/features/session-monitor src/features/dashboard src/features/session-new src/i18n --maxWorkers=2` | 36 files, 424 passed |
| web, pin files and shell | `vitest run src/test/live-runtime-static.test.tsx src/test/live-static-ac-c-53.test.ts src/test/real-core-facts.test.tsx src/components/shell` | 4 files, 114 passed |
| web typecheck / lint | `npm run typecheck` / `npx oxlint` | exit 0 / exit 0 |
| tablet, new and extended files | `jest camera-profile.test.tsx selector-lines.test.tsx camera-no-preview.test.tsx real-capture-one-rule.test.tsx --maxWorkers=2` | 4 suites, 122 passed |
| tablet, targeted existing suites and the D222 pin | `jest src/features/capture-selector src/features/devices src/features/session-live --maxWorkers=2` | 63 suites, 730 passed |
| tablet, i18n, Home, Session New | `jest src/i18n src/features/dashboard src/features/session-new --maxWorkers=2` | 23 suites, 305 passed |
| tablet typecheck / lint | `npm run typecheck` / `npm run lint` | exit 0 / exit 0 |

One run each. One typecheck red of my own between runs (a cast in a new test), fixed, then green.

Mutations seen RED, each by a temporary Edit that was reverted:

| Mutant | Red |
|---|---|
| web `trackFactsOf` ignores the raised fault | `source-state.test.tsx` W5 case; `camera-no-preview.test.tsx` W5 first case |
| web row sends the assignment without the profile | four cases of `camera-profile.test.tsx` |
| tablet `cameraCaptureFaultOf` answers null | the W5 cases of `real-capture-one-rule.test.tsx` and `camera-no-preview.test.tsx` |
| tablet port sends operation 79 for a command with a profile; tablet sheet builds the command without the profile | cases of `camera-profile.test.tsx` and the block of `selector-lines.test.tsx` (7 red in the one run of the three tablet mutants) |

## 7. Existing expectations changed

None. No existing test case was edited; cases and blocks were appended. Simulated mode and development sources: every suite that covers them passes unedited.

## 8. What the tests do NOT prove

- That a Core states a camera's profile list. The web page cases replace the one reader of the list (`storedProfilesOf`) by a table, because the fake Core of the live harness serves by the contract and the contract refuses the member (F3, F4). The tablet cases put the member into the app's own store. The reader itself is a pure case in both apps.
- A real camera, a real relay loss, a real re-open: doubles only. The fault is raised and cleared by the shared package's own transitions on the recording dataset.
- No browser and no emulator session.

## 9. Requests left (delegation_progress/file_requests.md, five lines "row W5")

1. packages/shared: `profiles` on `CaptureDeviceStatusSchema` - BLOCKING for Q-02.
2. Core: the device slice and operation 77 state the stored list - BLOCKING for Q-02.
3. Controller: no action fills an empty list of a registered camera (operation 108 stores nothing; no client wires it) - blocking for a camera adopted without a stream probe.
4. Controller: confirm operation 78 as the carrier.
5. Controller: Q-01 by the alert; D222 chip untouched; row CB's line not taken.

## 10. Statement

Existing files were changed with the Edit tool only; new files with Write. No scripted replace, no shell append. No file of packages/shared or apps/core-server was written. No dev server, no emulator, no port bound.
