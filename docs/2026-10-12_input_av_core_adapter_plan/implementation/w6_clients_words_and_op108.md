---
task_id: 2026-10-12_input_av_core_adapter_plan
row: W6 (wave 12, track D)
date: 2026-10-14
agent: coder-execution (W6)
decisions: C117, C126 (d), C130, C141, C143, C144
request_lines: 526, 557, 564, 565, 566, 569 (closed here); one new line (row W6) for the controller
status: complete
---

# Row W6 - operation 108 wired ("Test connection" of an adopted camera), the new words, the seventh network setting

Tier 1. Head cb06d42c + uncommitted work, branch task4/input-av-core-port. Single writer of `apps/core-web/**` and `apps/mobile/**` (C144). Nothing committed. No browser, no emulator, no port, no device.

## 1. The user's goal and what now reaches it

The user: "saya sudah coba search dan test connection ... saya belum bisa assign save ke cam 1 / 2". Since rows PR and V7 a production camera is assigned only with a STORED profile, and the one step that stores profiles for an ADOPTED camera is operation 108. Before this row no client called it (W5 finding F7). Now the web console calls it from two places, and a `PROFILES_STORED` answer brings the profile into the selector without a reload, so the camera can be saved to Camera 1 / Camera 2. A page test covers the whole path on the fake Core: NO_PROFILE, then Test connection, then the profile is offered and preselected, then Save sends operation 78 with that profile.

The web console is English only (i18n A10). The tablet is English only too (`apps/mobile/src/i18n/index.ts`: "the `id` locale is out of scope, A10"). So every word below is English. No Indonesian resource exists to extend.

## 2. (1) Operation 108 in the web console

| Item | Where | Source |
|---|---|---|
| Request, answer, refusal model (pure) | NEW `apps/core-web/src/features/devices/adopted-camera-test.ts` (`testAdoptedCamera`, `adoptedTestResultOf`, `adoptedTestRefusal`, `adoptedTestPath`) | contract `packages/shared/src/api/capture-discovery.ts:1385-1629` |
| The control | NEW `apps/core-web/src/features/devices/adopted-camera-test-control.tsx` (`AdoptedCameraTest`) | the readdress dialog's pattern (`camera-readdress-dialog.tsx`) |
| Place 1: under the NO_PROFILE sentence of a selector row | `capture-selector-panel.tsx` (`adopted-test-selector-<track>`) | W5's `NO_PROFILE` |
| Place 2: the device entry (drawer) of a production camera on a Core in real capture | `registered-device-drawer.tsx` (`adopted-test-drawer`), plus the fact "Stored stream profiles" from the entry (line 526 (1)) | V7 `profiles` member |

**No credential, no body.** The contract has no request schema for operation 108 (`CAPTURE_DEVICE_TEST_SCHEMAS` holds only the answer; its description says "**No body.** No credential, address, host, port, URL, path or profile member exists"). The call is `client.call('testCaptureDeviceConnection', { params: { id } })`. The test checks that the logged request has no body text. The Core reads the password it stored at adoption. The password is typed only in the connect dialog of a found camera (operations 95 and 96).

**Refreshing the list.** On `PROFILES_STORED` the control invalidates the operation-77 query (`CORE_QUERY_KEYS.captureDevices`), which the selector reads. The drawer reads the replicated slice, which the Core republishes (V7 database case 'row PR (a) then (c)'). The test stands in for that republish with a socket delta.

**Who can press it.** Holders of `CAPTURE_CONFIG`, as the Core's access rule requires. With a session open the button is closed and the hint says why. The selector row's own edit block also closes it.

Words (`web.adoptedTest` in `i18n-web.ts`, plus shared and contract words):

| Answer | Words |
|---|---|
| button / pending | "Test connection" / "Testing the connection…" (shared `common.captureConnect.test` / `.testing`) |
| hint | "The Core tests this camera with the password it stored when the camera was added. Nothing is typed here, and no setting of the camera is changed." |
| `PROFILES_STORED` | "The connection works. The Core stored the stream profiles this camera states: it can now be assigned to Camera 1 or Camera 2." |
| `STREAM_PROFILE_DIFFERS` | "The camera now states other stream profiles than the ones stored for it. Nothing was stored: the stored profiles stand, and a connection test does not replace them. To use what the camera states now, adopt the camera again." |
| REACHABLE, no `profiles` | "The connection works with the stored password. No stream profile was stored." |
| AUTHENTICATION_FAILED | "The camera refused the stored password. No stream profile was stored." + the shared attempts line; `SCHEME_NOT_ALLOWED`: the shared `captureConnectTarget.schemeNotAllowed` |
| UNREACHABLE / WRONG_PROFILE / NOT_H264 | the shared `common.captureConnect.outcome.*` + "No stream profile was stored." |
| 409 reasons (CANDIDATE_NOT_TESTABLE, CREDENTIAL_REQUIRED, CONNECTION_TEST_IN_PROGRESS) | the contract's `CAPTURE_DEVICE_TEST_REFUSAL_SENTENCES` |
| 503 DISCOVERY_NOT_READY | the contract's `CAPTURE_DEVICE_TEST_NOT_READY_SENTENCE` |
| 409 LOCKED / 404 / 503 store / 403 / other | own sentences under `web.adoptedTest.refusal`; 429: the shared lock-out and rate words; an outage goes to the presenter first, then one page record (`reportDevicesError`) |

The NO_PROFILE sentence now names the remedy (C117), web: "This camera cannot be assigned yet: the Core holds no stream profile for it, and it does not pick one for a camera. Press "Test connection": when the test reads the camera's stream, the Core stores the profiles it states and they are offered here. Nothing was changed."

**Tablet.** Operation 108 is web console only (`403 WEB_CONSOLE_ONLY`), so the tablet gets no control. Its NO_PROFILE sentence points to the web console: "... On the web console, open Devices and press "Test connection" for this camera: when the test reads its stream, the Core stores the profiles it states and they are offered here. Nothing was changed."

## 3. (2) The new words

| Line | What | Where |
|---|---|---|
| 564 | `CAMERA_PROFILE_WITHOUT_STREAM` added to the web list pin (`named`) and to the `expected` table (the shared sentence), and to the header table of `slot-refusal.ts`. The web needed no code change: it reads the shared group. The pin that was RED at :586 is GREEN | `selector-microphones.test.tsx`, `slot-refusal.ts` |
| 565 | Tablet `PROFILE_REFUSAL_REASONS` gains the word, so the notice reads the shared sentence. Test beside the W5 block | `capture-selector.tsx`, `selector-lines.test.tsx` |
| 566 / 569 web | `sourceLineState`: the Core's explicit `streamState: null` becomes `NOT_READ` and shows as a neutral chip, "Stream not read". An ABSENT member still says nothing. A NOT_REACHABLE source keeps its reach word alone (pin `source-state.test.tsx:37` kept). The No-preview tile shows `data-state="NOT_READ"` and "Stream not read" instead of 'ONLINE'. The drawer's stream fact reads "Stream not read" for a camera | `source-state.ts`, `source-state-chips.tsx`, `camera-preview.tsx`, `registered-device-drawer.tsx`, `i18n-web.ts` (`web.source.streamNotRead`) |
| 566 / 569 tablet | `cameraLineStatus`: null becomes `NOT_READ`, "Not read" (it was LIVE). The sheet's `?? 'LIVE'` fallback becomes `?? null`. The detail's stream fact for a camera reads "Not read" | `capture-selector-model.ts`, `capture-source-sheet.tsx`, `capture-selector.tsx` (tone), `i18n.ts`, `registered-device-detail.tsx` |
| 569 (1) | Operations 44 and 46: no client of either app calls them (only `dev-probes.ts` names the path). Nothing to render | - |
| 526 (1) | The drawer shows the entry's stored profiles: "Stored stream profiles" with each profile's facts, or "None stored yet" | `registered-device-drawer.tsx` |

## 4. (3) The seventh network setting (line 557, row V7b)

`model.ts`: `NetworkSettingsFormValues.onvifPorts`, `NETWORK_SETTINGS_FIELDS` +1, and NEW `onvifPortsOf` (1 to 8 entries, whole numbers 1 to 65535 with no sign and no leading zero, no repeats, separated by commas, blanks or lines). The form value is the stored order, one port per line. `settingsChangeOf` sends the whole list only when it differs entry by entry IN ORDER, so another order counts as a change. `index.tsx` adds one TextArea, `com-field-onvifPorts`.

Words:
- Label: "Allowed ONVIF ports".
- Hint: "The ports a stored camera's ONVIF service may be reached on, in order, 1 to 8 ports, separated by commas or lines. A camera stored without a port is reached on port 80, so keep 80 in the list for such cameras."
- Error: "1 to 8 whole numbers from 1 to 65535, each once".

The interface hint now says "letters of either case, digits, "_", "." and "-", the first a letter or a digit, at most 15 characters" (example `enP3s0`). Its error says "letters of either case". A page test types `enP3s0` and a reordered list and sees both sent.

Item (4) of line 557 (render `onvifPortCount` in the audit trail) was NOT built. It is optional by its own words, and this row did not check whether the trail renders details by key.

## 5. Tests and mutations (each new rule seen RED, then reverted with the Edit tool)

| Mutant | RED in |
|---|---|
| web: the control not drawn under NO_PROFILE | `camera-profile.test.tsx` row W6: the PROFILES_STORED and STREAM_PROFILE_DIFFERS cases |
| web: PROFILES_STORED does not invalidate the device list | `camera-profile.test.tsx` PROFILES_STORED case |
| web: `adoptedTestResultOf` ignores STREAM_PROFILE_DIFFERS | `camera-profile.test.tsx` pure case |
| web: explicit null read as absent (`sourceLineState`) | `source-state.test.tsx` row W6, both cases |
| web: `camera-preview` null data-state back to 'ONLINE' | `camera-no-preview.test.tsx` row W6 |
| web: ONVIF ports compared sorted | `commissioning.test.tsx` row W6 model case |
| web: `onvifPortsOf` admits a repeated port | `commissioning.test.tsx` row W6, both cases |
| tablet: `cameraLineStatus` null branch removed | `capture-selector-model.test.ts` row W6; `mic-limit-option.test.tsx` row W6 |
| tablet: the word left out of `PROFILE_REFUSAL_REASONS` | `selector-lines.test.tsx` row W6 |
| tablet: the detail leaves the null fact out | `registered-devices.test.tsx` row W6 |
| tablet: the sheet fallback `?? 'LIVE'` put back (run alone) | `mic-limit-option.test.tsx` row W6 |

**Existing expectations moved (2, both required by C117):**
- The NO_PROFILE sentence in web `camera-profile.test.tsx` (W5 case "no stored profile").
- The same sentence in tablet `camera-profile.test.tsx` (W5 case "no stored profile").

**Lists extended (564):** `named` and `expected` in `selector-microphones.test.tsx`.

**Helper changed:** web `camera-profile.test.tsx` `liveSelector` now also returns `page`.

No other existing case was edited.

## 6. Checks (2026-10-14, this Mac)

| Check | Command | Result |
|---|---|---|
| web targeted | `vitest run src/features/devices src/features/commissioning src/features/session-monitor src/features/dashboard src/features/session-new src/i18n src/test/real-core-facts.test.tsx src/test/live-devices-capture-selector.test.tsx src/test/live-runtime-static.test.tsx src/test/live-static-ac-c-53.test.ts src/components/shell --maxWorkers=2` | 42 files, 585 passed (before: the same set less the 9 new cases, with `selector-microphones` :586 red by design per C141) |
| web, after the lint fix | `vitest run camera-profile.test.tsx registered-devices.test.tsx` | 2 files, 28 passed |
| web typecheck / lint | `npm run typecheck` / `npx oxlint` | exit 0 / exit 0. Lint first flagged `Date.now` in render in my control; fixed by taking the lock-out time when the refusal arrives |
| tablet targeted | `jest src/features/capture-selector src/features/devices src/features/session-live src/i18n src/features/dashboard src/features/session-new --maxWorkers=2` | 86 suites, 1039 passed (4 new cases; 1035 before) |
| tablet typecheck / lint | `npm run typecheck` / `npm run lint` | exit 0 / exit 0 |

Run counts:
- Web `camera-profile.test.tsx`: three runs, all within the rules (1 red in my own new drawer case → fixed; then a re-run after my lint fix).
- Tablet `camera-profile.test.tsx`: two runs (the moved sentence).
- Every other file: one run, plus the mutant runs.

## 7. What the tests do NOT prove

- A real Core's operation 108 against a real camera. The fake transport answers 108 with contract-checked bodies; the stored list is put into the served device list by the test. The Core side is V7's database case.
- The drawer's refresh through the Core's own republish. A socket delta stands in for it.
- No browser and no emulator session. Hardware checks 9A/H-nn are unchanged.

## 8. Driver decisions (for the controller to confirm)

1. The NO_PROFILE sentence and STREAM_PROFILE_DIFFERS use the shared tree's wording "adopt the camera again" (V7c's sentence), with no path promised. See request line "row W6": no screen can re-adopt a registered camera today (`CANDIDATE_ALREADY_REGISTERED`, and no remove operation exists).
2. Web `NOT_READ` is a fourth stream value of `SourceLineState`, given only for the Core's explicit null and not for an absent member. NOT_REACHABLE keeps no stream word (the existing pin). A source with `checkedAt: null` keeps "Not checked" alone.
3. The drawer shows the test only for a production camera (`ONVIF_RTSP`) on a Core in real capture. Simulated mode would only ever answer 503 there.
4. The tablet gets no op-108 control, because the operation is web-console only. Its sentence names the web console.
5. The component file is named `adopted-camera-test-control.tsx`, because a `.tsx` with the model's base name would be shadowed by the `.ts` in module resolution. The first draft had that name and was renamed (my own new file) before any import used it.

## 9. Statement

Existing files were changed with the Edit tool only, one small edit at a time after reading them. The two new files were written with Write. There was no scripted replace and no shell append. No file of packages/shared, apps/core-server or the worker was written. Nothing was left running.
