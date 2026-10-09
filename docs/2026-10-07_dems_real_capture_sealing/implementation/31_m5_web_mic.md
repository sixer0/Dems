---
task_id: 2026-10-07_dems_real_capture_sealing
row: 72
title: M5-W2 web mic UI (Session Monitor toggle, Dashboard tiles, audio-source band)
date: 2026-10-09
agent: coder-execution
status: needs-review
tier: 3
---

# Row 72 — web mic UI (M5-W2)

Workspace `apps/core-web`. Built against the shared registry (ops 81, 82), the simulator and the
Live source binding `switchAudioSource`, on the contract-checked fake transport. Ops 81/82 are not
routed by the Core yet (rows 66/71): **nothing here was run against a real Core, a worker or a browser.**

## 1. What was built (file:line, under `apps/core-web/src/` unless said)

| Item | Where |
|---|---|
| Op 82 gate, key and factory: `useAudioSourceReadGate`, `audioSourceIntervalsQueryKey(sessionId)` (`['core','audio-source-intervals',id]`, emptied by the bridge with a session end), `audioSourceIntervalsQueryOptions` | `lib/core-queries.ts:205,211,227` |
| G4/G5 gate (pure): Checking -> NOT_RECORDING -> ROLE (`SESSION_START`) -> HOLDER (creator or SUPERVISOR, OD-09) -> allowed | `features/session-monitor/audio-source.ts:75,84` |
| Refusal classes of op 81 by code/status (CONFLICT, NOT_RECORDING, NOT_OPEN, OTHER) | `audio-source.ts:105` |
| View in both data modes (pair from `session.audioSource`, else `audio.activeInputId`; `MIC_SILENT` input) | `audio-source.ts:130,139,162` |
| The confirmed switch: the ONE call site of `actions.switchAudioSource`, through `usePendingControl().settle`; presenter first, then the panel's own sentence; success toast names the input the store holds on the settle | `audio-source.ts:217` |
| Op 82 read in both modes (Live: factory, re-asked when the Core's `switchedAt` changes; Simulated: `sim.request` of the same operation); failure = one page record + rate-limited Retry, never blocks the toggle | `audio-source.ts:283` |
| UI: Active/Standby chip per meter, header toggle "Switch to MIC n", `MIC_SILENT` warning with "Switch to standby", footer (band, reason line, refusal line), confirm `AlertDialog` | `features/session-monitor/audio-source-controls.tsx:30,52,77,131,175`; mounted `audio-panel.tsx:29-39` |
| WB-10 composed `AudioSourceBand` + pure layout (`audioSourceBandSegments`, `formatMediaMs`); reusable by row 87's playback band | `components/composed/audio-source-band.tsx:35`, `audio-source-band.math.ts:39,55`, `index.ts` |
| WB-10 timeline: `AUDIO_SWITCH` detail "MIC 1 to MIC 2" from `params.from/to` | `features/session-monitor/timeline-panel.tsx:56-61` |
| D84/D91 "Connecting cameras…": one defensive helper `captureDurableOf`; banner kind `CONNECTING`; feed REC indicator and timer only when durable | `features/session-monitor/model.ts:62,68,101,195,353`; `status-banner.tsx:28` |
| WB-02 Dashboard mic tiles: Active/Standby from the session's pair while RECORDING (row 67's Primary/Standby config chip otherwise) | `features/dashboard/devices-panel.tsx:45-48,~276` |
| Live test bed answers op 82 by default from the model Core (so no existing Live monitor test meets an unscripted call) | `runtime/testing/live-harness.ts:385` |
| Strings: one block `session.audioSource.*` (Edit tool) | `packages/shared/src/i18n/en/session.ts:147` |
| Styles | `features/session-monitor/session-monitor.css` (`.sm-audio-wrap` ... `.sm-audio-reason`) |
| Tests | `features/session-monitor/__tests__/audio-source.test.tsx` (20), `test/live-session-monitor-audio-source.test.tsx` (6) |

## 2. Real vs stand-in

- Real: gate, confirmation, pending state, refusal handling, warning, band, both data modes. In
  Simulated mode a confirmed switch writes exactly one `AUDIO_SOURCE_SWITCHED` row (asserted).
- Stand-in: Live mode is proven on the fake transport only (registry-checked request and answer).
- No optimistic flip: the chips read the store; the Live test holds the delta and asserts the pair
  is unchanged until it arrives.
- The UI never switches by itself: `actions.switchAudioSource` has one call site, behind the confirm.
- Not built:
  - ux §3.2 step 9 "Input interrupted — verifying" (2 s debounce): no slice member carries the pending state.
  - Development-source badge on meters/tiles (PE-125-05; `sourceClass` not in the slice schema; row 139/137).
  - "Both inputs down": left to the existing session fault presentation.
  - Op 82 pagination: the first page only (one interval per manual switch).
  - Action bar (marker, note, snapshot, end) is unchanged while "Connecting cameras…".

## 3. Commands and results (2026-10-09)

| Command | Result |
|---|---|
| `npm run typecheck -w @dems/core-web` | exit 0 |
| `npm run lint -w @dems/core-web` | exit 0, 0 warnings |
| `npm run test -w @dems/core-web -- --maxWorkers=2 <36 files>`: `src/features/session-monitor`, `src/features/dashboard`, `src/components/composed`, `src/lib`, `live-session-monitor-{audio-source,actions,panels}`, `live-session-note-role`, `live-dashboard-{devices,page}`, `live-runtime-bridge`, `live-devices-capture-selector`, `live-meter-clip-reset`, `live-gap-indicator-connecting`, `home-page`, `visual-audit-45b`, static guards `live-static-ac-c-53`, `live-runtime-static`, `routes`, `fxr-w-nits`, `live-w0-page-logs`, `live-strict-mode-starts` | 36 files, 405 tests passed |
| `npm run test -w @dems/shared -- test/i18n.test.ts test/i18n-vocabulary-sync.test.ts` | 50 passed |
| Negative control: the two role lines (`ROLE`, `HOLDER`) removed from `audioSourceToggleGate` | 4 tests red (gate unit, TECHNICIAN, non-holder INVESTIGATOR, G5 TECHNICIAN); file restored, suite green again |

Not run: whole-workspace suite, mobile tests (mobile reads the `session` namespace; the edit is additive), any browser.
No negative control was run for the no-optimistic-flip assertion.

## 4. To wire / re-check when rows 66 / 71 land

1. Op 81 on the real route: request `{ inputId }`, answer `AudioSourceState`; the Core republishes `session` (with `audioSource`) and `meters.audio.activeInputId` in the command's revision — the panel shows the new pair only from that.
2. `403` for a holder refusal carries `details.reason: SESSION_HOLDER`; today the shared presenter words every 403 as "Requires the <first role holding SESSION_START> role", which is wrong for an INVESTIGATOR who did not open the session. The UI gate normally prevents the press; if the Core can still answer it, the presenter (not this row's file) needs the holder sentence.
3. Real `409 AUDIO_SOURCE_CONFLICT`, `409 INVALID_STATE`, `404` (classes in `switchRefusal`).
4. Audit row: C3 §5.2 keys are `fromInput`, `toInput`, `fromMs`, `toMs`, `sendingDeviceId`; the simulator writes `fromInputId`, `toInputId`, `deviceId` (the mic, not the sending client). The test asserts the simulator's keys; M5-SW-W must assert the Core's.
5. Simulated mode: the simulator ACTION `switchAudioSource` checks `SESSION_START` only; the holder condition exists in its HTTP route (`sim/api.ts`) and in this UI gate. Row 66 owns the hosted pair.
6. Op 82 on the real route (shape, order newest first, `toMs` of the closed interval); today a real Core answers 404, which shows "The audio source history could not be read." with Retry and one page record.
7. `MIC_SILENT`: fault target as the Core publishes it (`silentInputOf` accepts a channel or an input id) and that it clears.
8. `captureDurable` once in the schema (request filed): type `captureDurableOf`, check the banner and the feed timer on a real start.

## 5. Browser checks left for the M5 gate (agent-browser, lane web, 2 + 1) — flow W-MIC

1. SUPERVISOR opens `/session` on a starting session: banner "Connecting cameras…", no timer/REC, until the first durable fragment; then "Recording".
2. On load the toggle passes through "Checking your permissions…" (M4-PC-1 for G4); MIC 1 Active, MIC 2 Standby; Dashboard tiles agree.
3. Press "Switch to MIC 2" -> confirm dialog -> confirm: pending, then MIC 2 Active only after the Core's state; toast; timeline "Microphone Switched — MIC 1 to MIC 2"; band shows two segments; exactly one `AUDIO_SOURCE_SWITCHED` row with the sending device id; analyser: 1 AAC stream, monotonic PTS, 0 inserted/dropped samples, boundary within one input quantum + IPC latency, interval rows in media ms (M5-SW-W).
4. Cancel in the dialog: no request, no audit row.
5. INVESTIGATOR who opened the session: enabled. Another INVESTIGATOR: disabled + holder sentence. TECHNICIAN: disabled + "Requires the INVESTIGATOR or SUPERVISOR role".
6. Feed silence below -50 dBFS for 10 s on the active mic: warning names it, active mic unchanged for the whole observation, no audit row (no auto-switch); "Switch to standby" opens the same confirmation.
7. Pull the link: toggle disabled with "Checking your permissions…"; restore: enabled again.
8. Visual: panel O at 1280x760 and the compact tier still fits without scrolling with the chip, the header button, the footer line and (worst case) the warning — NOT checked by this row.
9. End the session: toggle gone, reason "The microphone can be switched while a session is recording."

## 6. Decisions and deviations

- D-72-1: chips read "Active" / "Standby" (the session's pair), not "PRIMARY" as ux §3.2 step 1 words it: Primary/Standby stays the configured role on Devices and can differ from the active input after a switch.
- D-72-2: all strings in `session.audioSource.*`, including "Checking your permissions…" and "Connecting cameras…"; ux §14 names `common.rbac.checking` and `common.session.connectingCameras`, which no row has added to `common.ts`. Controller's call to move them.
- D-72-3: the command follows the Session Monitor's convention (`useCoreActions()` + `settle`), not row 67's `live.client.call` / `sim.request` pair.
- D-72-4: without a recording the toggle is not drawn and its reason is (ux §3.5 "hidden-with-reason"); for role/holder it is drawn disabled.
- D-72-5: the warning offers "Switch to standby" only when the silent input is the active one.
- D-72-6: `captureDurable` absent = durable (today's behaviour); only an explicit `false` reads "Connecting cameras…".
- Edits outside the paths named in the brief: `runtime/testing/live-harness.ts` (one default answer, additive), `features/dashboard/devices-panel.tsx` (WB-02 chip), `components/composed/index.ts` (exports).
- Request filed: `captureDurable` in the shared session schema (`delegation_progress/file_requests.md`, row 72, not blocking).
