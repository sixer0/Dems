# `apps/mobile/src/features`

Up: [`src/`](../README.md)

## Purpose

One folder per screen area. A feature folder holds its screen, its pure model (`*-model.ts`, no React, unit-tested), its data hooks (`use-*.ts`, reads of the runtime store through `useSim` selectors), its components, its English words (`i18n.ts`, registered in `src/i18n/features.ts`) and its tests. By the project's rule P6, one feature does not edit another feature's files; small helpers such as `use-sheet-presence.tsx` are therefore copied per feature on purpose.

No feature builds a Core URL. Data and commands go through the runtime (`useSim`, `useCoreActions()`, `useMobileLive()?.client.call(...)`); the runtime builds the client from `runtime/core-address.ts` (D263, D265).

## Contents

| Entry | Role |
|---|---|
| [`alerts/`](alerts/README.md) | The alert toasts: the consumer of the Core's alerts that Settings > Notifications promises. |
| [`audit/`](audit/README.md) | The Operator Audit View at `/audit`: the audit log, newest first, with category chips, severity and operator filters, search, a live/paused feed, the hash-chain status strip and a sheet with one entry in full (event JSON, previous and current hash). |
| [`capture-selector/`](capture-selector/README.md) | The device selector and everything around the capture sources, for the tablet and the phone: which camera feeds each video track and which microphone feeds each channel, the camera search (discovery), the microphone re-scan, the "no device" notices, the development-source badge and the confirm before a pre-check turns on the Core host's own camera or microphone. |
| [`dashboard/`](dashboard/README.md) | Home (Dashboard) at `/home`: the header with the bell and the Core link chip, the System Status card, the status tiles, the camera and microphone tiles (live preview thumbnails and meters), Quick Actions (Start Session, gated by role) and Recent Sessions. |
| [`devices/`](devices/README.md) | Devices & Inputs at `/devices` and the device detail at `/devices/[deviceId]` (a pane on tablets): the built-in camera and microphone rows, the registered devices beyond the built-in ids, device status, health chart, diagnostics, device commands (test signal, restart) and the live camera preview. |
| [`evidence/`](evidence/README.md) | The Evidence list at `/evidence` and the evidence detail at `/evidence/[evidenceId]` (a pane on tablets). |
| [`home/`](home/README.md) | The stack-proof screen used by `/stack-check` (and `/` with `?motion=`): HeroUI Native components, a Reanimated enter transition, the Skia heartbeat pulse ring, the live heartbeat and the service health of the Core. |
| [`login/`](login/README.md) | Login at `/login`: the brand block, the auth card (username, password, biometric button, Core chip and trust line), the ambient Skia accents and the entrance choreography. |
| [`more/`](more/README.md) | More at `/more`: the operator card, the console tiles (on phones the Audit, Storage, Network & Time and Settings tabs have no visible trigger, so More is their entrance), secondary links and the footer with the Core link chip and the app version. |
| [`network-time/`](network-time/README.md) | Network & Time at `/network-time`: the network status card (LAN, PoE, bandwidth bars), the time synchronisation card with the GNSS > NTP > RTC tier row and the GNSS orbit, the system time card and the camera clock card from `capture-selector`. |
| [`pairing/`](pairing/README.md) | Pairing at `/pair`, a public screen. |
| [`rbac/`](rbac/README.md) | One role gate for the controls that ruling R2 locks on the phone and the tablet: Start Session needs `SESSION_START`, Install update needs `MAINTENANCE`. |
| [`session-finalizing/`](session-finalizing/README.md) | Finalizing at `/session/finalizing`: the six-step finalization pipeline after a recording stops, forward-only sealing progress, the SEALED stamp, and the notices for a seal that needs attention, an interrupted seal, an unsealable recording and an open (not sealed) recording. |
| [`session-live/`](session-live/README.md) | The Session Monitor at `/session/live`, shown while RECORDING: the REC row and timer, the live camera feed, the microphone cards with meters, the status strip, the action tiles (marker, snapshot, camera switch), the timeline and audio sheets, the connection banner, the capture-start and paired-microphone notices, and End Session. |
| [`session-new/`](session-new/README.md) | Start New Session at `/session/new?step=1\|2\|3`: step 1 session information (case, subject, investigator) with the live readiness list, step 2 devices check (camera previews, microphone meters, pre-check), step 3 ready with the countdown. |
| [`session-recovery/`](session-recovery/README.md) | Recovery Status at `/session/recovery`: the recovery analysis pipeline over the five checks, the per-track rows, the outcome, and the hand-over to Finalizing. |
| [`session-summary/`](session-summary/README.md) | The Session Summary at `/session/summary/[sessionId]`: the sealed tracks in order, hashes (full value in a sheet), sizes, time source, the lifecycle stages, the sealed members of a schema-v2 item with the signature mark, and the acknowledgement. |
| [`sessions/`](sessions/README.md) | The Sessions hub at `/sessions` and the session detail at `/sessions/[sessionId]` (a pane on tablets): the active-session card, the session list with filters and search, status chips, the notice for a session set up by another operator, and the toast when a session runs from another console. |
| [`settings/`](settings/README.md) | Settings at `/settings` and one section at `/settings/[section]` (a pane on tablets): Account and Profile sheet, App Preferences, Notifications, Security & Privacy (biometric switch, pairing, Core address shown read-only), Capture (the device selector), Transcription status, System Maintenance and About. |
| [`storage/`](storage/README.md) | Storage at `/storage`: the capacity card and ring, the storage indicators (write speed, session size, time remaining), recent storage activity and the Manage Storage sheet (retention policy, auto-archive), which sends the `setStoragePolicy` action. |
| [`transcription/`](transcription/README.md) | The read-only transcription status section of Settings: enabled, backend, model, speaker labelling and whether a credential is set, as the Core reports them through `getSttConfig`. |

## Related decisions

No entry of `decisions.md` (2026-11-05 team update audit) names this folder or its files.
