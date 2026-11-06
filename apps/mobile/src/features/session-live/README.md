# `apps/mobile/src/features/session-live`

Up: [`src/features/`](../README.md)

## Purpose

The Session Monitor at `/session/live`, shown while RECORDING: the REC row and timer, the live camera feed, the microphone cards with meters, the status strip, the action tiles (marker, snapshot, camera switch), the timeline and audio sheets, the connection banner, the capture-start and paired-microphone notices, and End Session. The microphone switch (operation 81) is retired on the tablet (D177, row 185).

## Contents

| Entry | Role |
|---|---|
| [`testing/`](testing/) | Test beds, fakes and fixtures for the tests (no production code). |
| `action-tiles.tsx` | S5 action tiles (04_mobile_specs §4.5 S5; MB 4 (948–1185, 403–455) |
| `audio-pair-in-force.test.tsx` | Test: Fix 157 (fix wave L) - the same class as G70c-01, another member: `session.audioSource`, the active / standby microphone pair. The `session` slice keeps the LAST session after its seal, with the pair that session ... |
| `back-guard.test.tsx` | Test: On the Session Monitor during RECORDING, Back opens the "Leave the monitor?" Dialog and the session stays RECORDING; Stay keeps the monitor; Go to Home leaves for /home and the recording continues. Back never ... |
| `capture-checkpoints.tsx` | The capture checkpoint facts on Session Live (wave H closing pass Z2; ruling D203 (3)) |
| `capture-start-notice.tsx` | Situation C on the tablet and the phone (task 3, blueprint row 139, NEW SCOPE R-10; `masterplan/08_client_ux_spec.md` §8e flow 11; decisions D72(k), D84, D91 ruling R-1 option A). |
| `connecting-meters.test.tsx` | Test: Tests "connecting meters". |
| `connection-banner.tsx` | S7 connection banner. The state comes from the runtime (`useConnectionBanner()`, step 73) |
| `development-source-mounts.test.tsx` | Test: The app's own Live source over ... |
| `elapsed-ticker.test.ts` | Test: Tests "createElapsedTicker". |
| `end-session.tsx` | S6 End Session control with its confirm dialog. |
| `i18n.ts` | English copy of the `session-live` feature, mounted at `features.session-live.*` through `src/i18n/features.ts`. |
| `live-client-restart.test.tsx` | Test: Tests "R-S-2: a socket the client gave up itself is a transient, not ". |
| `live-feed.tsx` | S3 live feed. - The picture is `CameraFeed` in `live` mode: it plays the camera's live loop from the step-72 media subset (session 0024, `RECORDING_SCENARIO.sessionSeq`) and burns in the UTC+07:00 time (top left) and ... |
| `live-gap-read-only-dialog.test.tsx` | Test: Tests "S2-1: the monitor". |
| `live-gap-s4-7-tablet-link.test.tsx` | Test: A Live test that names site S4-7. |
| `live-handover-exit.test.tsx` | Test: Tests "R-P-1: the Finalizing hand-over removes the monitor with no exiting animation below it". |
| `live-late-stop-handover-mark.test.tsx` | Test: Blueprint row 62 (B11, RK-5; prepares M5-SW-T) |
| `live-mic-source.test.tsx` | Test: The microphones of the Session Live monitor in LIVE mode - the app's REAL Live source over the contract-checked fake transport, with a model Core behind it (`testing/live-monitor-bed`); ... |
| `live-monitor-timer-core-clock.test.tsx` | Test: Tests "RF-PH-1: the monitor timer follows the Core while heartbeats are handled late". |
| `live-rc1-elapsed-stop-hold.test.tsx` | Test: Tests "RC-1 under D19(b): the hold applies while RECORDING; at the stop the Core\". |
| `live-session-live-link.test.tsx` | Test: The Session Monitor in LIVE mode — the meters come from the socket (I8: `meters` frames into the store's `audio` slice, then Reanimated shared values on the UI thread; no request, no React ... |
| `live-session-live-sites.test.tsx` | Test: The Session Monitor in LIVE mode — settle site S2-1 (`useMonitorActions.run` with its consumers Snapshot, Marker and End Session) and S4-2 (the timeline's newest node read after ... |
| `live-stop-handover.test.tsx` | Test: Tests "E2E-P-4 / E2E-T-4: a stop made on another console hands the monitor over to Finalizing without an empty frame". |
| `marker-flight.tsx` | M-C-17 Add Marker flight. A chip with the marker label starts at the Bookmark tile and travels on the `gentle` spring (≈ 520 ms) to the History icon (phone: the badge then pops) or into the inline timeline (tablet), ... |
| `mic-card.tsx` | S4 MIC card (04_mobile_specs §4.5 S4, S8; §5.4 transient meter path; MB 4 (948–1185, 310–395)). |
| `mic-source-controls.tsx` | The microphone warnings under the MIC cards of the Session Live monitor. Audit row 185: operation 81 is RETIRED - the microphone of each pair is fixed by setup. The "Switch to MIC n" toggle, its block reasons, its ... |
| `mic-source-model.test.ts` | Test: The pure reads of the monitor's microphone pair - the pair as the Core holds it, the input a silence or no-signal warning names, and the defensive read of `captureDurable`. |
| `mic-source-model.ts` | The microphone pair of the Session Live monitor, its pure reads. The web twin is `apps/core-web/src/features/session-monitor/audio-source.ts`. |
| `mic-source.test.tsx` | Test: Tests "the MIC cards mark Pair 1, the transcribed pair, with the gold outline, as the web Session monitor (D191, D5)". |
| `monitor-handoff-in-place.test.tsx` | Test: Tests "RF-PH-3: the monitor after the start hand-off is drawn in place". |
| `monitor-handoff.ts` | The Ready-to-monitor hand-off without an empty frame. On the phones and the tablet, 7 of 18 starts showed ONE empty frame (7-109 ms: only the background, the status bar and the gesture pill) between "Starting..." and ... |
| `monitor-leaving-notice.tsx` | What `/session/live` draws while it leaves for a screen other than Finalizing (fix wave J round two, JA2-19). |
| `monitor-sheets.tsx` | The monitor's sheets on the kit `BottomSheet` (`@gorhom/bottom-sheet` underneath): Timeline, Audio monitor and Monitor settings. |
| `monitor-timer-drawn.test.tsx` | Test: Tests "D247 item 5: a simulator has no instant on the device clock". |
| `own-capture.ts` | THE ONE RULE OF THE MOBILE APP FOR "THIS SESSION IS A RECORDING OF THE CORE'S OWN CAPTURE" |
| `rec-indicator.tsx` | S2 REC row (04_mobile_specs §4.5; 03_motion_spec M-C-05; MB 4 (948–1185, 88–112)). |
| `session-live-screen.test.tsx` | Test: Session Monitor screen. Renders the real `/session/live` route on the real providers with a test simulator in the recording scenario (session 0024). |
| `session-live-screen.tsx` | Session Monitor at `/session/live`; step 79. The route renders this screen only while RECORDING. Regions: S1 header (guarded back, "Active Session", History), S2 REC row with the clock-derived timer, S2b §5.4 status ... |
| `session-live.math.test.ts` | Test: Session Monitor maths: layout per 04 §2.4, the S4 clock-derived timer, the S2b §5.4 status strip, timeline rows, markers and the S21 End Session reason rule. |
| `session-live.math.ts` | Session Monitor maths. Pure, React-free and simulator-free, so the rules are tested directly (T-M08 covers the screen). |
| `simulator-start.test.tsx` | Test: Tests "Session Live on the simulator itself: a recording start". |
| `situation-c.test.tsx` | Test: Tests "situation c". |
| `status-strip.tsx` | S2b §5.4 status strip: the book's recording-screen elements that MB 4 omits — VIDEO 1 REC, VIDEO 2 REC, STORAGE OK, TIME GNSS LOCKED — as a `ScrollShadow` row of StatusChips. The MIC rows are the meter cards. ... |
| `timeline-capture-facts.test.tsx` | Test: Tests "G75-01: the Session Live timeline beside a recording of the Core\". |
| `timer-readout.tsx` | The monitor's HH:MM:SS readout, drawn by React. |
| `use-mic-source.ts` | The microphone pair of the Session Live monitor and its warnings. The pure reads are in `mic-source-model.ts`; the cards and the warnings draw what these hooks return. |
| `use-monitor.ts` | Session Monitor data and actions. Selectors return primitives or the store's own slice references, so `useSim`'s shallow compare keeps these hooks quiet while the simulator ticks audio at 20 Hz: the timer hook ... |
| `use-sheet-presence.tsx` | Mount-on-demand for kit sheets (the monitor's BottomSheets and the Bookmark popover's bottom-sheet presentation). |

## Main exports

- Screens: `SessionLiveScreen` (`session-live-screen.tsx`).
- Hooks: `useCamerasNotConnected`, `useFailedStart`, `useFailedStartClosing`, `usePairedMicMissing`, `useMicLevelState`, `useOwnCapture`, `useConnectingCameras`, `useMicSource`, `useMonitorSession`, `useMonitorElapsedSeconds`, `useMonitorClockOrigin`, `useMonitorCameras`, `useMonitorMics`, `useMonitorTimeline`, `useMonitorStrip`, `useMonitorActions`, `useSheetPresence`.
- Components: `ActionTiles`, `CaptureCheckpoints`, `SessionCaptureCheckpoints`, `PairedMicMissingNotices`, `CaptureStartNotice`, `FailedStartNotice`, `ConnectionBanner`, `EndSession`, `LiveFeed`, `MarkerFlight`, `MicMeter`, `MicCard`, `MicSourcePanel`, `MicSourceControls`, `MonitorLeavingNotice`, `TimelineSheet`, `AudioMonitorSheet`, `MonitorSettingsSheet`, `RecDot`, `RecTimer`, `RecLabel`, `RecRow`, `StatusStrip`, `TimerReadout`, `SheetContentSignal`.

## Core operations and state

- Replica state read through `useSim` selectors (`@dems/shared/sim` or local): `selectActiveInputId`, `selectCameras`, `selectCamerasNotConnected`, `selectConnectingCameras`, `selectFailedStart`, `selectFailedStartClosing`, `selectMics`, `selectStandbyInputId`, `selectTimeline`.
- Core actions sent (`useCoreActions()` and `settle` of `@dems/shared/live`, or a local actions hook): `addMarker`, `endSession`, `resetClip`, `setActiveCamera`, `snapshot`, `stopRecording`.

Core origin: this folder never builds a Core URL. Every call goes through the runtime, whose Live client, socket and media transport are built in `src/runtime/sim-adapters.ts` from `coreOriginOf(getCoreAddress())` of `src/runtime/core-address.ts` (D263, D265).

## Tests

25 test files sit beside the code in this folder (`*.test.ts`, `*.test.tsx`, jest with the `jest-expo` preset; setup in `apps/mobile/jest.setup.ts`).
Shared test beds and fixtures of this folder are in [`testing/`](testing/) (no production code).
Run: `npm test -w @dems/mobile` (all) or `npx jest <path>` inside `apps/mobile`.

## Related decisions

From `decisions.md` of the 2026-11-05 team update audit:

- D177: row 185: operation 81 retired on the tablet.
- D191: row 210: microphone cards, pair chip.
- D200: row 187: pair notice band.
- D219: row 196: `live-feed.tsx` live preview site.
