# src/features/session-monitor

Up: [src/features](../README.md)

## Purpose

The Session Monitor: the live view of the current session while it records, stops, finalizes (seals), or is in fault or recovery. The page is a grid of panels: K header and status banner; L live feed; M details; N integrity over O audio; P action bar; Q timeline; R camera and input status over S storage; T live audit. Overlays follow the finalization (sealing progress, forward-only) and recovery of a session, and state a blocked, retried, interrupted or unsealable seal in words. Monitoring can be paused locally (the meters dim); recording continues.

Panels read the data source through selectors that return primitives, so a panel re-renders only when one of its own fields changes, not on the 10 Hz clock or the 20 Hz audio slice.

## Files

| File | Role |
|---|---|
| [`__tests__/`](__tests__/) | Unit and page tests of this folder |
| [`action-bar.tsx`](action-bar.tsx) | `ActionBar` (P): marker, note, snapshot, pause monitoring and stop recording with a hold; input limits `MARKER_MAX`, `NOTE_MAX` |
| [`audio-panel.tsx`](audio-panel.tsx) | `AudioPanel` (O): one meter per pair slot named "Mic N (Camera N)", Pair 1 marked Transcribed; no source switch (operation 81 is retired) |
| [`audio-source-controls.tsx`](audio-source-controls.tsx) | `AudioSilentWarning`, `AudioSourceFooter`: the silent-input warning and the audio-source band (operation 82) |
| [`audio-source.ts`](audio-source.ts) | `useAudioSource`, `useAudioSourceIntervals`, `silentInputOf` and selectors: the transcribed input, the silence warning and the audio-source intervals read (operation 82) |
| [`audit-panel.tsx`](audit-panel.tsx) | `AuditPanel` (T): the latest 12 audit rows |
| [`capture-checkpoints-model.ts`](capture-checkpoints-model.ts) | `captureCheckpointsOf`, `checkpointAge`: the capture checkpoint facts (`session.captureCheckpoints`) of a recording of the Core's own capture |
| [`capture-checkpoints.tsx`](capture-checkpoints.tsx) | `CaptureCheckpoints`, `SessionCaptureCheckpoints`: draws those facts |
| [`choreography.ts`](choreography.ts) | Panel beats and variants of the page enter (`PANEL_BEAT_MS`, `usePanelVariants`, `useStaggerVariants`) |
| [`details-panel.tsx`](details-panel.tsx) | `DetailsPanel` (M): session details |
| [`finalization-modal.tsx`](finalization-modal.tsx) | `FinalizationModal`: the finalization or recovery overlay with sealing steps (operation 83) |
| [`flight-context.ts`](flight-context.ts) | `FlightContext`, `useFlight`: marker-chip and snapshot-thumbnail flight requests |
| [`flight-layer.tsx`](flight-layer.tsx) | `FlightLayer`: draws those flights |
| [`index.tsx`](index.tsx) | `SessionMonitorPage`: page root (`page-session-monitor`), grid, pause state, recover action |
| [`inputs-panel.tsx`](inputs-panel.tsx) | `InputsPanel` (R): one tile per camera track (the Core's reach-gated live picture on a Core in real capture) and the mics with compact meters |
| [`integrity-panel.tsx`](integrity-panel.tsx) | `IntegrityPanel` (N): integrity facts and the audit-chain check (`verifyAuditChain`, operation 60) |
| [`interrupted-seal.tsx`](interrupted-seal.tsx) | `InterruptedSealNotice`: status line of the seal dialog for a recording that was interrupted |
| [`live-feed-panel.tsx`](live-feed-panel.tsx) | `LiveFeedPanel` (L): the main feed, camera switch (`setActiveCamera`), snapshot flash; closes while the tab is hidden |
| [`log.ts`](log.ts) | `logSessionMonitorError`, `describeSessionMonitorError`, `newSessionMonitorCorrelationId`: structured records to `webErrorSink` |
| [`model.ts`](model.ts) | Pure view models over the state: `phaseOf`, `selectPageModel`, banner model and ranks, durable-capture and connecting-camera selectors |
| [`panel.tsx`](panel.tsx) | `Panel`, `PanelErrorBoundary`: the common panel frame and its error boundary |
| [`reach-recheck.ts`](reach-recheck.ts) | `useReachRecheckOnOpen`, `reachRecheckTargets`: on opening, re-checks once each camera whose stored reach is stale (operation 112) |
| [`real-seal-facts.ts`](real-seal-facts.ts) | `realSealFactsOf`: what a real sealed item states about its seal |
| [`scroll-edges.ts`](scroll-edges.ts) | `useScrollEdges`: scroll-edge visibility for the scroll shadows of panels Q and T, from scroll events |
| [`seal-attention.tsx`](seal-attention.tsx) | `SealAttentionNotice`: a blocked or retried seal, through the shared `sealAttentionOf` reading |
| [`seal-retry.tsx`](seal-retry.tsx) | `SealRetryControl`: retry of a blocked seal through operation 33 (`recoverSession`) |
| [`sealing-progress.ts`](sealing-progress.ts) | `advanceSealing`, `useSealingProgress`, `etaSeconds`: forward-only sealing progress from the finalization states the Core sent |
| [`session-monitor.css`](session-monitor.css) | Page styles, every selector starts with `.sm-` |
| [`sim-adapter.ts`](sim-adapter.ts) | Reads over the data source: write-rate series, audio peak, autosave segment, timelines of own capture, stream profile notice, capture fault reason |
| [`status-banner.tsx`](status-banner.tsx) | `StatusBanner` (K): state banner with the recover button (operation 33) |
| [`storage-panel.tsx`](storage-panel.tsx) | `StoragePanel` (S): storage ring and write-rate sparkline |
| [`timeline-panel.tsx`](timeline-panel.tsx) | `TimelinePanel` (Q): the session timeline with marker and snapshot arrivals |
| [`unsealable-cause.ts`](unsealable-cause.ts) | `selectUnsealableCause`: the cause code of a session that ended UNSEALABLE, from its alert |
| [`unsealable-notice.tsx`](unsealable-notice.tsx) | `UnsealableNotice`: the terminal sentence of a session the Core could not seal |
| [`use-interrupted-seal.ts`](use-interrupted-seal.ts) | `useInterruptedSeal`: the words of an interrupted seal for one surface |

## Main exports

- Screen: `SessionMonitorPage` (`index.tsx`), with the panels `ActionBar`, `AudioPanel`, `AuditPanel`, `DetailsPanel`, `InputsPanel`, `IntegrityPanel`, `LiveFeedPanel`, `StatusBanner`, `StoragePanel`, `TimelinePanel`, and the overlay `FinalizationModal`.
- Model: `model.ts`, `sealing-progress.ts`, `capture-checkpoints-model.ts`, `real-seal-facts.ts`, `unsealable-cause.ts` (pure).
- Hooks and live readers: `useAudioSource`, `useAudioSourceIntervals`, `useSealingProgress`, `useReachRecheckOnOpen`, `useInterruptedSeal`, `useWriteRateSeries`, `useScrollEdges`, `useFlight`.

Routes: `/session/` (route file `src/routes/_app/session/index.tsx`).

## Core operations, state and shared modules

- Actions of `useCoreActions()`: `addMarker`, `addNote`, `snapshot`, `stopRecording`, `setActiveCamera`, `verifyAuditChain` (operation 60), `recover` (operation 33 `recoverSession`).
- Reads: operation 82 (audio-source intervals), operation 83 (sealing progress), operation 112 (camera live preview, through [`src/features/devices`](../devices/)). Operation 81 is retired and sent nowhere.
- State slices read with `useSim`: `session`, `activeCameraId`, `alerts`, `audio`, `audit`, `cameras`, `captureConfig`, `clock`, `evidence`, `faults`, `mics`, `operators`, `security`, `storage`, `time`.
- Shared modules: `@dems/shared/api`, `@dems/shared/domain`, `@dems/shared/live`, `@dems/shared/realtime`, `@dems/shared/sim`, `@dems/shared/tokens`.
- Console folders used: [`src/components/composed`](../../components/composed/), [`src/components/media`](../../components/media/), [`src/components/shell`](../../components/shell/), [`src/components/ui`](../../components/ui/), [`src/features/devices`](../devices/), [`src/lib`](../../lib/) (`capture-notices`, `core-errors`, `core-queries`, `event-words`, `own-capture`, `pending-control`, `seal-attention`, `utils`), [`src/motion`](../../motion/), [`src/runtime`](../../runtime/).

## Tests

- [`__tests__/`](__tests__/): `audio-source.test.tsx`, `connecting-leftovers.test.tsx`, `failed-start-close.test.tsx`, `integrity-facts.test.tsx`, `interrupted-seal.test.tsx`, `live-previews.test.tsx`, `no-live-levels.test.tsx`, `sealing-progress.test.tsx`, `session-monitor.test.tsx`, `simulator-start.test.tsx`, `situation-c.test.tsx`, `unsealable-notice.test.tsx`.
- In `src/test`: [`live-session-monitor-actions.test.tsx`](../../test/live-session-monitor-actions.test.tsx), [`live-session-monitor-panels.test.tsx`](../../test/live-session-monitor-panels.test.tsx), [`live-session-monitor-audio-source.test.tsx`](../../test/live-session-monitor-audio-source.test.tsx), [`live-session-note-role.test.tsx`](../../test/live-session-note-role.test.tsx), [`live-d2-client-seams.test.tsx`](../../test/live-d2-client-seams.test.tsx), [`live-local-source-on.test.tsx`](../../test/live-local-source-on.test.tsx), [`selector-in-force.test.tsx`](../../test/selector-in-force.test.tsx), [`real-core-facts.test.tsx`](../../test/real-core-facts.test.tsx), [`visual-audit-45b.test.tsx`](../../test/visual-audit-45b.test.tsx).

## Related decisions

- D46: the monitor drew only the active or standby pair chip; channel now taken from the track `AUDIO-0N`.
- D54, D242: failed start, recover and the "NO SESSION" state (row 111, U-18).
- D98: both Session Monitor feed mounts wrapped in the reach-gated camera preview.
- D134: operation 81 toggle removed; halves labelled "Mic N (Camera N)", Pair 1 "Transcribed".
- D231, D232, D239: input thumbnails on the reach-gated live preview, hidden-tab close of the main feed, the once-per-mount re-check of stale reach (fix wave W4-1).
