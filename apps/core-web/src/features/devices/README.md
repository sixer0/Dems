# src/features/devices

Up: [src/features](../README.md)

## Purpose

The Devices and Inputs page of the web console (`/devices`). It shows the capture devices of the Core: the camera tiles with their live preview, the audio input cards with their level meters, the registered devices beyond the built-in ids, the appliance "twin" (front panel with the 800x480 LCD and LEDs, rear port map, PoE and other devices), the health chart, the capture device selector (which camera and microphone feed each VIDEO-0N / MIC-0N track), the camera search and connect flow, the microphone re-read and the host's sound cards.

Several modules here are shared by other pages. The camera picture (`camera-preview.tsx`, `reach-gated-preview.tsx`), the stream facts of a track (`stream-facts.ts`), the reach of a track (`track-reach.ts`), the development-source badge (`source-badge.tsx`, `source-class.ts`) and the local-source notice (`local-source-gate.ts`, `local-source-notice.tsx`) are also used by the Dashboard, Session New, the Session Monitor, the Evidence page and others.

Most rules live in `.ts` modules so that the `.tsx` files export only components (the lint rule "only export components").

## Files

| File | Role |
|---|---|
| [`__tests__/`](__tests__/) | Unit and component tests of this folder (see Tests) |
| [`adopted-camera-test-control.tsx`](adopted-camera-test-control.tsx) | The "Test connection" control of an adopted camera, drawn from the rules in `adopted-camera-test.ts` |
| [`adopted-camera-test.ts`](adopted-camera-test.ts) | "Test connection" of an adopted camera: operation 108 `testCaptureDeviceConnection`, its one request, what its answer means and the wording of its refusals |
| [`audio-cards-panel.tsx`](audio-cards-panel.tsx) | The `AudioCards` panel: the sound cards of the Core's host and the registration of one input as a microphone; a blocked control carries its reason |
| [`audio-cards.ts`](audio-cards.ts) | Rules of operations 98 `searchCaptureAudioCards` and 99 `registerCaptureAudioInput` (web console only): gate, answers, refusals, input choices |
| [`audio-input-card.tsx`](audio-input-card.tsx) | One audio input card: level meter (number text updated at most 4 times per second), clip indicator and its reset, and the idle meter lease of operation 113 |
| [`camera-connect-dialog.tsx`](camera-connect-dialog.tsx) | The connect dialog of a found camera (form, test, adopt); its log record names the operation and the answer's codes, never what the operator typed |
| [`camera-connect.ts`](camera-connect.ts) | The connect flow of a found camera: form rules, the commands of operations 95 (test a candidate) and 96 (adopt a candidate), and what each answer means |
| [`camera-live-preview.ts`](camera-live-preview.ts) | Rules of the live camera preview, operation 112 `createCameraPreviewSession`: which devices may preview, retry backoff (2 s to 30 s), first-frame wait, automatic-open debounce and concurrency slots |
| [`camera-preview.tsx`](camera-preview.tsx) | The one component that draws a camera picture on every page (Devices, Session New, Dashboard, Session Monitor): simulated feed, live preview, "No preview" tile, and the `CameraPreviewTryAgain` button |
| [`camera-profile.ts`](camera-profile.ts) | The stream profile of a camera assignment: on a Core in real capture a production camera (`ONVIF_RTSP`) is assigned with a profile of its own (operations 77, 78, 79) |
| [`camera-readdress-dialog.tsx`](camera-readdress-dialog.tsx) | The dialog that offers and confirms a new address for a registered camera |
| [`camera-readdress.ts`](camera-readdress.ts) | The operator-confirmed re-address of a registered camera: offer, request of operation 100 `confirmCaptureDeviceAddress`, refusal wording |
| [`camera-search-address.tsx`](camera-search-address.tsx) | The "search one address" form of the camera search (operation 93): the form check, and the Core's `DISCOVERY_ADDRESS_NOT_ALLOWED` and "not probed" answers |
| [`camera-search-context.tsx`](camera-search-context.tsx) | `CameraSearchProvider`: one camera search per page (operations 93 and 94) and the page's one microphone re-read control (operation 97); `SearchCamerasButton`, `SearchMicrophonesButton` |
| [`camera-search-panel.tsx`](camera-search-panel.tsx) | The camera search panel: the found cameras of the discovery read and their actions |
| [`camera-search.ts`](camera-search.ts) | The camera search: the read of operation 94 under its own query key, its polling, gates and the start command of operation 93 |
| [`camera-tile.tsx`](camera-tile.tsx) | One camera tile (lens number 1 to 4, one tile per video track) with its status and preview |
| [`capture-inputs.ts`](capture-inputs.ts) | "Search again" for microphones (operation 97, re-read of the microphones connected to the Core) and the states of a local device |
| [`capture-notices.tsx`](capture-notices.tsx) | The no-device notification strip (one alert per notice the Core raised, with "Search again") and the unreachable marks of a track or microphone |
| [`capture-selector-panel.tsx`](capture-selector-panel.tsx) | The capture device selector panel: assigns cameras and microphones to tracks, PoE cycle, test of an adopted camera |
| [`capture-selector.ts`](capture-selector.ts) | The selector's read (operation 76), its edit gate and PoE-cycle gate and its commands (operations 78, 79, 80; PoE cycle through operation 48) |
| [`context.ts`](context.ts) | Page-level React contexts: device actions (open the drawer, kebab commands), the Identify blink, the microphone level sampler |
| [`device-drawer.tsx`](device-drawer.tsx) | The drawer with the details of one built-in device |
| [`device-menu.tsx`](device-menu.tsx) | The kebab menu of a device (Details, Test signal, Identify, Restart) and the Identify ring; each command follows the Core's permission through `src/lib/device-command-gate` |
| [`devices-banner.tsx`](devices-banner.tsx) | The page-header status banner (READY, RECORDING, ATTENTION, CRITICAL) |
| [`devices.css`](devices.css) | Styles of the page, including the appliance twin and its LEDs |
| [`front-panel.tsx`](front-panel.tsx) | The appliance front panel: LCD, five LEDs (POWER, RECORD, NETWORK, STORAGE, FAULT) and the four navigation buttons |
| [`health-chart.tsx`](health-chart.tsx) | The Health chart (Recharts): drawn once when the tab opens, then streamed without animation |
| [`idle-meter-lease.ts`](idle-meter-lease.ts) | The lease of the idle microphone meters, operation 113 `holdIdleMeters`: held and renewed while the page is visible and no session records |
| [`index.tsx`](index.tsx) | `DevicesPage`, the route component (root test id `page-devices`): page layout, providers and panels |
| [`labels.ts`](labels.ts) | Display names of the page's devices and rear-panel ports, all from i18n |
| [`lcd-connection.tsx`](lcd-connection.tsx) | The LCD connection view, read through the authenticated Core client (no request from the browser to the USB backend) |
| [`lcd-display.tsx`](lcd-display.tsx) | The appliance's 800x480 status display drawn as an SVG; re-renders at 1 Hz and cross-fades between pages |
| [`live.ts`](live.ts) | What the page reads the same in both data modes: `DEVICE_WORDS` / `useDeviceWords` (simulated words and their Live twins) and `DEVICE_COMMAND_OF` |
| [`local-source-gate.ts`](local-source-gate.ts) | The notice before a pre-check that turns on this computer's camera or microphone: which local devices a selector names (from the selector read, operation 76) |
| [`local-source-notice.tsx`](local-source-notice.tsx) | "Checking the capture sources..." and the local-source notices that explain why pre-check and start controls are disabled; a failed read offers a rate-limited Retry |
| [`mic-rescan.tsx`](mic-rescan.tsx) | One registered microphone as the last re-read found it: name, state chip, and what to do for a local device that cannot be opened |
| [`model.ts`](model.ts) | The page's view model: pure selectors over `SimState`, device status and tone, track source and track status (one status function for tiles, cards, banner, summary and drawer) |
| [`motion.ts`](motion.ts) | The page's motion choreography (panel beat, hero bloom, LED and row stagger) |
| [`other-devices.tsx`](other-devices.tsx) | The "Other devices" card (tablet link and other appliance devices), with the tablet-offline wording chosen by whether a session records |
| [`own-core-words.ts`](own-core-words.ts) | What a screen of a Core in real capture may say of a source: which members are registry facts and which are model values of the seed dataset |
| [`panel.tsx`](panel.tsx) | `DevicesPanel` (a page block, with "Not reported" for model-only blocks on a Core in its own capture) and `DevicesErrorBoundary` |
| [`port-map.tsx`](port-map.tsx) | The rear-panel port map with one link and activity code per port |
| [`precheck-search.tsx`](precheck-search.tsx) | "Search again" actions after a pre-check: the camera search (operation 93) or the microphone re-read (operation 97) |
| [`reach-gated-preview.tsx`](reach-gated-preview.tsx) | `ReachGatedCameraPreview`: the live preview for Session New and the Session Monitor, asking for no preview token while the Core says the camera is not reachable, until "Try again" |
| [`registered-device-drawer.tsx`](registered-device-drawer.tsx) | The drawer of one registered device (from the Core's device list), with its connection test (operation 108) |
| [`registered-devices-model.ts`](registered-devices-model.ts) | The registered devices beyond the built-in ids: roster, which built-in id is drawn by its own tile (`drawnByOwnTile`), microphone rate limit |
| [`registered-devices.tsx`](registered-devices.tsx) | One registered device card: name, id, state chip, development-source badge, use, rate warning and "View device" |
| [`report.ts`](report.ts) | The page's error record through `createPageReporter` of `src/lib/page-report` |
| [`sim-adapter.ts`](sim-adapter.ts) | Reads over the simulator: device ids, PoE view of the design book's two ports, rear ports and their links |
| [`slot-refusal.ts`](slot-refusal.ts) | Plain wording of why the Core refused to assign a source to a selector slot (`422 INVALID_INPUT` reasons of operations 78, 79 and 80) |
| [`source-badge.tsx`](source-badge.tsx) | The one "Development source" badge and the source marks of devices, tracks, microphones and pre-check items; draws nothing outside real capture |
| [`source-class.ts`](source-class.ts) | Which devices carry the development-source label, decided only from the `sourceClass` the Core sent; hooks for the real-capture state and a device by id |
| [`source-state-chips.tsx`](source-state-chips.tsx) | The state chips of a source line ("Online"/"Offline" simulated; "Reachable"/"Not reachable"/"Not checked" in real capture) |
| [`source-state.ts`](source-state.ts) | Pure rule for the state of a source line on a Core in real capture (reach, last check time, which measured figures are shown) |
| [`status-chip.tsx`](status-chip.tsx) | `StatusChip` and `StatusDot`, with one halo pulse when the status escalates |
| [`stream-facts.ts`](stream-facts.ts) | The stream facts of a video track (picture, rate, format, fault) as the Core states them; one rule for every reader (Devices, Dashboard, Session Monitor, Session New) |
| [`summary-cards.tsx`](summary-cards.tsx) | The summary cards that count the appliance devices (PoE switch, relay lamp, port map), gated where the Core has no producer |
| [`track-reach.ts`](track-reach.ts) | The reach of the source on a video track of a Core in real capture, for a tile's status word |

## Main exports

- `DevicesPage` (`index.tsx`), the route component. The clip reset of an audio card is the `resetClip` action of `useCoreActions`.
- Used by other pages: `CameraPreview`, `CameraPreviewTryAgain` (`camera-preview.tsx`), `ReachGatedCameraPreview` (`reach-gated-preview.tsx`), `useTrackFacts` and the stream-fact helpers (`stream-facts.ts`), `useTrackReach` (`track-reach.ts`), `DevelopmentSourceBadge` and the source marks (`source-badge.tsx`), `useRealCapture` / `useCaptureDevice` (`source-class.ts`), `LocalSourceNotice` / `useLocalSources` (`local-source-notice.tsx`, `local-source-gate.ts`), `PrecheckSearchActions` (`precheck-search.tsx`), `trackStatus` / `deviceStatus` (`model.ts`).

Routes: `/devices` (`src/routes/_app/devices.tsx`).

## Core operations, state and shared modules

Core operations named in the code of this folder:

| Operation | Name | Where |
|---|---|---|
| 19 | the paired devices list ("n paired, m online" in the drawer), through `src/lib/core-queries` | `device-drawer.tsx` |
| 44, 45, 46 | the Core's track status; `model.ts` keeps the same rule for the tiles | `model.ts` |
| 48 | device command; a camera Restart in Live mode is the PoE cycle `POE_CYCLE` sent with `{ confirm: true }` (`deviceCommand` action) | `index.tsx`, `capture-selector.ts` |
| 76 | capture selector read (`/api/v1/capture/config`) | `capture-selector.ts`, `local-source-gate.ts` |
| 77 | capture device list | `camera-profile.ts`, `camera-readdress.ts`, `registered-devices-model.ts` |
| 78 | edit the selector lines (cameras and microphone lines by channel) | `capture-selector.ts`, `slot-refusal.ts` |
| 79 | set a camera's source (`/api/v1/capture/cameras/{id}/source`) | `capture-selector.ts`, `camera-profile.ts` |
| 80 | `setPrimaryMic` (`/api/v1/capture/mics/{id}/primary`) | `capture-selector.ts` |
| 93, 94 | start a camera search, read the discovery state (`/api/v1/capture/discovery`) | `camera-search.ts` |
| 95, 96 | test and adopt a found camera | `camera-connect.ts` |
| 97 | re-read the microphones (`/api/v1/capture/inputs/rescan`) | `capture-inputs.ts` |
| 98, 99 | list the host's sound cards, register an input as a microphone | `audio-cards.ts` |
| 100 | `confirmCaptureDeviceAddress` (`/api/v1/capture/devices/address/confirm`) | `camera-readdress.ts` |
| 108 | `testCaptureDeviceConnection` (`/api/v1/capture/devices/{id}/test`) | `adopted-camera-test.ts` |
| 112 | `createCameraPreviewSession` (live preview, `/preview/cps_...`) | `camera-live-preview.ts`, `camera-preview.tsx` |
| 113 | `holdIdleMeters`, renewed every 10 s | `idle-meter-lease.ts`, `audio-input-card.tsx` |

State slices read through `useSim`: `captureDevices`, `captureConfig`, `session`, `network`, `tabletLink`, `security`, `alerts`, `pairing`, `clock`, plus the device and track views of the simulator.

Shared package modules: `@dems/shared/api`, `@dems/shared/client`, `@dems/shared/domain`, `@dems/shared/i18n`, `@dems/shared/live`, `@dems/shared/realtime`, `@dems/shared/sim`, `@dems/shared/tokens`.

Console folders used: [`src/lib`](../../lib/) (own-capture, core-errors, core-queries, capture-notices, pending-control, device-command-gate, page-report, event-words, effect-start), [`src/runtime`](../../runtime/), [`src/motion`](../../motion/), [`src/components`](../../components/) (shell, media, composed, ui, synthetic-values-chip, demo-mark).

## Tests

- [`__tests__/`](__tests__/): `audio-cards`, `camera-auto-preview`, `camera-connect-canary`, `camera-connect`, `camera-live-preview`, `camera-no-preview`, `camera-profile`, `camera-search`, `capture-notices`, `capture-selector`, `devices-page`, `health-caption`, `idle-meter-lease`, `lcd-connection`, `local-source-gate-unknown`, `local-source-notice`, `mic-input-name`, `registered-devices`, `selector-microphones`, `source-state` (all `.test.tsx`), and the shared bed `search-bed.tsx`.
- Page-level tests in [`src/test`](../../test/): `live-devices-commands`, `live-devices-clip`, `live-devices-drawer`, `live-w0-camera-words`, `selector-in-force`, `real-core-facts`, `dev-console-logging`, `live-w0-page-logs` (all `.test.tsx`).

## Related decisions

From `decisions.md` of the 2026-11-05 team update audit:

- D50 (row 107): "Recording continues" only while a session records, on the other-devices alert; the devices banner pinned by test.
- D92 (row 131): `drawnByOwnTile` omits only a built-in id on its own line, so registered CAM-03/04 and MIC-03/04 are listed.
- D95 (row 130): the Devices tile auto-preview is gated on reach; "Try again" asks once.
- D97 (row 129): one status function in `model.ts` feeds the tiles, cards, banner, summary and drawer.
- D98 (row 130b): `ReachGatedCameraPreview` wraps the Session New and Session Monitor previews.
- D231: the Dashboard, Session Monitor and Devices pictures are the same component, `camera-preview.tsx`; the live picture is opt-in per caller.
- D232, D238 (fix wave W4, W4-2): camera-search "View device" decides registered card or built-in tile through `drawnByOwnTile`; in self-capture the PoE switch and recording lamp are not counted; audio inputs and registered microphones on one reader.
- D246: the W4 deploy.
