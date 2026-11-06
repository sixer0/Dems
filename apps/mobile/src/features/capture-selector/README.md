# `apps/mobile/src/features/capture-selector`

Up: [`src/features/`](../README.md)

## Purpose

The device selector and everything around the capture sources, for the tablet and the phone: which camera feeds each video track and which microphone feeds each channel, the camera search (discovery), the microphone re-scan, the "no device" notices, the development-source badge and the confirm before a pre-check turns on the Core host's own camera or microphone. The card is mounted on the Devices screen and in Settings > Capture, so the two surfaces cannot differ.

## Contents

| Entry | Role |
|---|---|
| `camera-clock-card.test.tsx` | Test: The camera clock rows on Network & Time. Rendered with the real providers and an injected simulator. The offset value is a SEAM today (`useCameraOffsets` returns no record), so the rows must say "Not reported yet" ... |
| `camera-clock-card.tsx` | Camera clock rows on Network & Time. WHAT IS REAL AND WHAT IS A SEAM (said plainly) |
| `camera-profile.test.tsx` | Test: Task 4 row W5: NO CLIENT COULD ASSIGN A PRODUCTION CAMERA. The tablet sent operation 79 with a track alone; the Core refuses a production camera without a profile of its own (`CAMERA_PROFILE_NOT_STATED`) and never ... |
| `camera-profile.ts` | THE STREAM PROFILE OF A CAMERA ASSIGNMENT, the tablet's side. The web console holds the same rule in `apps/core-web/src/features/devices/camera-profile.ts`; what follows is that file's rule, word for word. THE RULE ... |
| `camera-search-model.test.ts` | Test: Tests "what an answer of operation 93 / 94 means (§8c.2)". |
| `camera-search-model.ts` | Pure model of the camera search on the tablet and the phone (task 3, blueprint row 138; `masterplan/08_client_ux_spec.md` §8c flow 9, §8d.10 flow 10 on these clients; specs R-9 AC-1..4, AC-11..13; decisions D80(3), ... |
| `camera-search-panel.tsx` | The "Camera search" panel of the tablet and the phone. Mounted on the Devices screen — the phone reaches the same screen through Settings → Device Settings — inside a `CameraSearchProvider`. |
| `camera-search.test.tsx` | Test: The camera search on the Devices screen of the tablet and the phone. Real route files, real simulator, real providers, as `capture-selector.test.tsx`. |
| `capture-discovery-port.ts` | The one way the tablet and the phone send the three operations of flows 9 and 13 a device session may call. |
| `capture-notices-model.test.ts` | Test: Tests "situations A and B are the active alerts of the slice, told apart by ". |
| `capture-notices-model.ts` | Pure model of the no-device notifications, the development-source label and the microphone re-read on the tablet and the phone. No React, no simulator instance, no clock. |
| `capture-notices.test.tsx` | Test: The no-device notifications and the microphone re-read on the Devices screen. Real route files, real simulator, real providers. The notices are raised and cleared through the INTERNAL pair the Core itself uses: the ... |
| `capture-notices.tsx` | The no-device notifications on the tablet and the phone (task 3, blueprint row 138; ux spec §8e flow 11 situations A and B, §8g.3 the start rule at pre-check; specs R-10 AC-1..AC-6; decisions D80(2), D83, D114). |
| `capture-selector-model.test.ts` | Test: The pure model and the two ports of the device selector (task 3 row 68; ux spec §2 flow 1; checks M4-PC-1 (unit inventory) and M4-RG-MOB). |
| `capture-selector-model.ts` | Pure model of the device selector on the tablet and the phone. No React, no simulator instance, no clock: rows, options, the gate and the refusal classes are plain functions of the two replicated slices ... |
| `capture-selector-port.ts` | The one way the device selector sends operations 79 `setCaptureCameraSource` and 78 `updateCaptureConfig` — the microphone lines BY CHANNEL of D61 (2026-11-04) |
| `capture-selector.test.tsx` | Test: The device selector on the Devices screen. Real route files, real simulator, real providers, as `devices-screen.test.tsx`. |
| `capture-selector.tsx` | The device selector card. One component, mounted on the Devices screen (tablet and phone; the phone reaches it through Settings → Device Settings as well) and in Settings → Capture. |
| `capture-source-sheet.tsx` | The edit sheet of one selector field. |
| `development-source-badge.tsx` | The "Development source" badge of the tablet and the phone. ONE component for every surface: the kit `StatusChip`, tone `warning`, an icon AND the text — never colour alone — with the kind beside it ("Core Mac's ... |
| `development-source-rule.test.tsx` | Test: Tests "the badge follows ". |
| `development-source.test.tsx` | Test: The badge as drawn, and Simulated client mode on the real Devices screen. ... |
| `i18n.ts` | English copy of the `capture-selector` feature, mounted at `features.capture-selector.*` through `src/i18n/features.ts`. |
| `local-source-notice-model.test.ts` | Test: Fix pass F-M4: which local device a pre-check would turn on, decided from the two slices and the Live fact — the one rule of the notice on the tablet and the phone. |
| `local-source-notice-model.ts` | Which local device a pre-check would turn on. Pure: no React, no simulator instance. A pre-check on a selector that names the Core Mac's camera or microphone OPENS that device on the Core Mac. The tablet and the ... |
| `local-source-notice.test.tsx` | Test: Fix pass F-M4 — Session New on the tablet and the phone, LIVE mode: the app's own Live source over the contract-checked fake transport (`session-new/testing/live-session-new-bed`); the Core's engine is a real ... |
| `local-source-notice.tsx` | The notice with a confirm step before a pre-check turns on the Core Mac's camera or microphone, for the tablet and the phone. |
| `local-source-start-notice.test.tsx` | Test: Fix pass F-M4, second follow-up — Start Recording on a selector that names the Core Mac's camera or microphone: the recording keeps the device ON, so the tablet and the phone ask first, and a pre-check consent given ... |
| `mic-input-name.test.ts` | Test: Tests "the number of a microphone id". |
| `mic-input-name.ts` | The name of a microphone input on the tablet and the phone, from the id the Core sends (integration pass D2, item 5; decisions D106 (4), D115 (2), D133 (1); ux spec §8f.1). |
| `mic-limit-option.test.tsx` | Test: Fix pass F-M4 — where the operator CHOOSES the Core Mac's microphone (the option of the primary-microphone sheet) the short limit sentence is shown: only for a microphone the Core marked as its local device, only in ... |
| `mic-move-dialog.tsx` | The confirm of a microphone move on the selector. Row 188 built the gate (`micMoveGate`, hook `moveAsk` / `confirmMove` / `cancelMove`); this is its dialog, as the web's. |
| `mic-rescan.tsx` | Microphones: "Search again" re-reads the local inputs (task 3, blueprint row 138; ux spec §8g flow 13, control G17; specs R-10 AC-2; decisions D80(5), D83). |
| `no-credential-inputs.static.test.ts` | Test: Tests "no camera credential can be typed on the tablet or the phone (D80(3))". |
| `open-local-sources.tsx` | Session Live: the "is on" line of every local device the Core holds open that no tile of the monitor draws. The monitor draws the line itself for the camera ON SCREEN (`TrackSourceBadge` on the feed) and for the ... |
| `precheck-capture-notices.test.tsx` | Test: Session New, the pre-check step: an unreachable capture device (task 3 row 138; ux spec §8e.2 situation B, §8e.3, §8g.3 the start rule; decisions D80(2), D80(6), D83, D114; the software half of M4-NODEV-B-T / -P, ... |
| `selector-in-force.test.ts` | Test: Tablet Home and Session New kept naming the camera a track had BEFORE a selector change. Cause: every reader spelled `state.session?.captureConfig ?? ... |
| `selector-in-force.ts` | The selector IN FORCE: the ONE place the app decides whether a screen names its capture sources from a session's own selector snapshot or from the Core's current selector (fix wave L, G70c-01). |
| `selector-lines.test.tsx` | Test: Tests "every registered source on the lines of the selector". |
| `settings-capture-section.test.tsx` | Test: Settings → Capture. The section screen inside the real AppProviders with an injected simulator, as `settings-screen.test.tsx` mounts the other sections. |
| `settings-capture-section.tsx` | Settings → Capture. The section holds the device selector — the same `CaptureSelector` card the Devices screen mounts, so the two surfaces can never disagree — and a row to the Devices screen, where status, health ... |
| `settled-busy-state.ts` | The accessibility state of a control that STAYS on screen after its command ended. Unlike the runtime's `busyState` it always names `busy` |
| `source-on-home.test.tsx` | Test: Fix pass F-M4 — the Home device tiles say "Core Mac's camera is on" / "Core Mac's microphone is on" from the Core's `sourceOpen` fact. LIVE mode on the app's own Live source over the contract-checked fake transport ... |
| `source-on-session-live-offscreen.test.tsx` | Test: Fix pass F-M4, follow-up — a local device that is OPEN but drawn by no tile of the monitor (the camera of the track that is NOT on screen) still shows its fixed line. Base case: Session Live says "Core Mac's camera ... |
| `source-on-session-live.test.tsx` | Test: Fix pass F-M4 — Session Live says "Core Mac's camera is on" / "Core Mac's microphone is on" from the Core's `sourceOpen` fact, on the camera on screen and on the mic card. LIVE mode: the app's own Live source over ... |
| `source-on-session-new.test.tsx` | Test: The app's own Live source over the contract-checked fake transport (`session-new/testing/live-session-new-bed`). |
| `source-state.test.ts` | Test: Tests "checkedFactOf: the typed ". |
| `source-state.ts` | WHAT THE CORE REPORTED FOR A CAPTURE SOURCE, in words. On a Core in REAL capture `online` / `streamState` of a device are read from its registration and change only when the Core reads the device (a pre-check, a ... |
| `sources-known-gate.test.tsx` | Test: The notice gate itself (`useLocalSourceGate`) refuses to send while the device classes are unknown, whatever the button in front of it does. The pure rule ... |
| `sources-known.test.tsx` | Test: The app's own Live source over the contract-checked fake transport (`session-new/testing/live-session-new-bed`). |
| `use-camera-search.tsx` | State and commands of the camera search. |
| `use-capture-selector.ts` | Data and commands of the device selector. |

## Main exports

- Screens: `OpenLocalSourcesOffScreen` (`open-local-sources.tsx`).
- Hooks: `useCameraOffsets`, `useCaptureNotices`, `usePrecheckSentence`, `useSourceBadgeMode`, `useDevelopmentSource`, `useSourceOnKey`, `useMicInputName`, `useLocalSourcesChecking`, `useLocalSourceGate`, `useLocalSourceNotice`, `useLocalSourcesCheckingHint`, `useMicRescan`, `useCameraSearchController`, `useCameraSearch`, `useCaptureSelector`.
- Components: `CameraClockCard`, `CameraSearchPanel`, `SearchButton`, `CaptureNoticesBanner`, `CameraSearchAgain`, `PrecheckCaptureNotices`, `CaptureSelector`, `CaptureSourceSheet`, `SourceBadge`, `MicrophoneLimitLine`, `DevelopmentSourceBadge`, `TrackSourceBadge`, `MicInputSourceBadge`, `PrecheckSourceBadge`, `LocalSourcesChecking`, `LocalSourceNoticeDialog`, `LocalSourceNotStarted`, `MicMoveDialog`, `MicRescanControl`, `CaptureSection`, `CameraSearchProvider`.

## Core operations and state

- Replica state read through `useSim` selectors (`@dems/shared/sim` or local): `selectFailedStartClosing`.
- Operations called directly on the Live client (`useMobileLive()?.client.call`): `setCaptureCameraSource` (`capture-selector-port.ts`), `updateCaptureConfig` (`capture-selector-port.ts`).

Core origin: this folder never builds a Core URL. Every call goes through the runtime, whose Live client, socket and media transport are built in `src/runtime/sim-adapters.ts` from `coreOriginOf(getCoreAddress())` of `src/runtime/core-address.ts` (D263, D265).

## Tests

27 test files sit beside the code in this folder (`*.test.ts`, `*.test.tsx`, jest with the `jest-expo` preset; setup in `apps/mobile/jest.setup.ts`).
Run: `npm test -w @dems/mobile` (all) or `npx jest <path>` inside `apps/mobile`.

## Related decisions

From `decisions.md` of the 2026-11-05 team update audit:

- D170: row 186: paired-microphone-missing notice.
- D175: row 188: microphone move and swap bodies.
- D195: row 192: `source-state.ts` on the shared slot readers.
- D210: row 189: microphone move confirm dialog.
- D214: row 226: confirm label and sheet wording.
- D221: row 213: lint warnings in `capture-selector-model.ts`.
