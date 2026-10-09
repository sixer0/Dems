---
task_id: 2026-10-07_dems_real_capture_sealing
row: 73
title: M5-W3 tablet/phone mic UI + B15 (Session Live mic cards, Home mic tiles, test beds)
date: 2026-10-09
agent: coder-execution
status: needs-review
tier: 3
---

# Row 73 — tablet/phone mic UI + B15 (M5-W3)

Workspace `apps/mobile`. Built against the shared registry (op 81), the simulator and the Live source
binding `switchAudioSource`, on the contract-checked fake transport. Op 81 is not routed by the Core
yet (rows 66/71): **nothing here was run against a real Core, a worker, an emulator or a device.**
Nothing committed. No shared file (`packages/shared/**`, `apps/mobile/src/i18n/**`) was edited.

## 1. What was built (file:line, under `apps/mobile/src/` unless said)

| Item | Where |
|---|---|
| G4/G5 gate (pure), order: Checking (role unknown) -> Waiting (Core link down) -> NOT_RECORDING -> ROLE (`SESSION_START`) -> HOLDER (creator or SUPERVISOR, OD-09) -> allowed | `features/session-live/mic-source-model.ts:38,56,79` |
| Refusal classes of op 81 by code/status, never by text (CONFLICT, NOT_RECORDING, NOT_OPEN, OTHER); log facts = class, code, status only | `mic-source-model.ts:104,113` |
| The pair as the Core holds it (`session.audioSource`, else `audio.activeInputId`); the `MIC_SILENT` input | `mic-source-model.ts:132,135,148` |
| `captureDurableOf` — the ONE defensive read of `captureDurable` (only an explicit `false` = not durable) | `mic-source-model.ts:168,174` |
| View hook in both data modes (mobile role gate `useRoleGate`, `useCoreLinkReadOnly`) | `features/session-live/use-mic-source.ts:69` |
| The confirmed switch: the ONE call site of `actions.switchAudioSource`, `settle` + `usePendingPress`; success toast names the input the store holds at the settle; every refusal shown and written to the runtime log | `use-mic-source.ts:126` |
| UI: "Switch to MIC n" (always drawn while recording, disabled with its reason), reason line, refusal line, `MIC_SILENT` `Alert` with "Switch to standby", confirm `Dialog` (busy at once, spinner late, Cancel disabled while out) | `features/session-live/mic-source-controls.tsx:41,79,179`; mounted once per arrangement `session-live-screen.tsx:275` |
| MB-03 cards: "Active" / "Standby" chip, gold border + always-mounted `SelectionGlow` (row 68's E-15 pattern) | `features/session-live/mic-card.tsx:122,150,156`; `use-mic-source.ts:99` |
| "Connecting cameras…": label instead of "Recording", no timer, dot hidden by a React-set opacity (no Reanimated view removed) | `features/session-live/rec-indicator.tsx:36,50,105,115`; `session-live-screen.tsx:652`; string `features/session-live/i18n.ts:50` |
| MB-01 / B15: the level line rule (`LEVEL` / `NO_SIGNAL` / `NO_LEVEL`) and the tile's Active/Standby role (pure) | `features/dashboard/home-model.ts:99,105,112` |
| MB-01 / B15: the line re-read when the input's no-signal flag flips (also under `?motion=off`); role chip on the tile | `features/dashboard/device-tiles.tsx:133,147,182`; `use-home-data.ts:184,196` |
| MB-13 Live monitor bed: op 81 hosted on the model Core, `sendMeters` names the engine's active input, `raiseMicSilent` / `clearMicSilent` | `features/session-live/testing/live-monitor-bed.tsx:154,284,288,369` |
| MB-13 Simulated harness: `operator` option (sign in the other roles) | `features/session-live/testing/monitor-harness.tsx:55,105` |
| MB-13 Live home bed: `pushState` (one delta of the changed slices), `sendMeters` | `features/dashboard/testing/live-home-bed.tsx:117,119,281,292` |
| Tests (new) | `features/session-live/mic-source-model.test.ts` (14), `mic-source.test.tsx` (18), `live-mic-source.test.tsx` (9), `features/dashboard/home-mic-tiles-live.test.tsx` (5); `home-model.test.ts` (+2) |

Strings: the mic switch speaks the web twin's words (`session.audioSource.*`, row 72), `mobile.rbac.checking`,
row 68's two-role sentence (`features.capture-selector.selector.gate.denied`) and the monitor's own
read-only sentence. One new key, in this feature's own tree: `features.session-live.connecting`.

## 2. B15 — what the defect was

Observation D249 O-3 / O-RF-T-7: tablet Home MIC tiles read "No signal" beside a READY chip, idle and
during a recording. Found by reading the code and reproduced on the Live home bed (the two mutations
of section 4 bring the old text back):

1. `device-tiles.tsx` took "No signal" from the flat meter frame alone. On an idle Core no `meters`
   frame arrives, so the Live source's neutral frame said "No signal" while the microphone's state was
   READY. Now "No signal" needs the microphone's own state (`NO_SIGNAL`, the chip's word); a flat
   frame alone reads "— dBFS".
2. Under the `?motion=off` test switch (all device runs use it) the line refreshed once an hour, so
   the text of the mount stayed for the whole recording. Now it is read again in the render in which
   the input's no-signal flag flips; between flips the test switch still holds the number.

Not established: that these two are the ONLY causes on the device. If the Core publishes a wrong
`mics[].state`, the tile will still say what the Core says. The gate's device flow H-MIC decides.

## 3. Real vs stand-in

- Real: gate, confirmation, pending state, refusal handling, warning, cards, Home tiles, both data modes.
  In Simulated mode a confirmed switch writes exactly one `AUDIO_SOURCE_SWITCHED` row (asserted).
- Stand-in: Live mode is proven on the fake transport only (registry-checked request and answer).
- No optimistic flip: the Live test holds the delta back and asserts the cards, the replica and the
  toast are unchanged after the press AND after the answer, until the delta.
- Never by itself: `actions.switchAudioSource` has one call site, the confirm button's handler.
- **B11 "result applied" — partly.** Row 62's hooks are untouched (`runtime/session-diagnostics.ts`,
  `app/(app)/session/live.tsx`: no edit; its two test files still pass). The B11 MEASUREMENT does
  not exist yet (it is the gate's device run), so no measured result could be applied. What was
  applied is the structural consequence: the toggle and an open confirmation leave in the commit
  that shows the stop (wait point 3), so the monitor cannot send a switch for a recording the Core
  already stopped (tested, Live bed). Nothing new subscribes to the store or delays that commit.
- Not built:
  - ux §3.2 step 9 "Input interrupted — verifying" (no slice member carries the 2 s debounce state).
  - Development-source badge on cards/tiles (PE-125-05; `sourceClass` not in the shared registry; row 139).
  - "Both inputs down": left to the existing session fault presentation.
  - "Connecting cameras…" on the bottom Recording bar, Home and the Sessions hub (other screens still say "Recording"); the meters are still drawn while connecting.
  - Dev gallery (`app/dev-gallery.tsx`) not extended; `MicSourcePanel` is props-only and can be shown there.
  - The Audio Monitor sheet (large meters) has no Active/Standby chip.
- M5-WARN-1 itself (the warning raiser, fake clock) is the Core's (row 71). Here: the client half only.

## 4. Commands and results (2026-10-09)

| Command | Result |
|---|---|
| `npm run typecheck -w @dems/mobile` | exit 0 |
| `npm run lint -w @dems/mobile` | exit 0; 1 warning in `runtime/log.test.ts:160` (not this row) |
| `npm run test -w @dems/mobile -- src/features/session-live src/features/dashboard src/runtime/session-diagnostics.test.tsx src/runtime/session-route-sync src/runtime/dems-live-console-static.test.ts src/runtime/link-notice-static.test.ts src/i18n --maxWorkers=2` | 33 suites, 274 tests passed |
| the 14 `*static*.test.ts` files of the workspace, `--maxWorkers=2` | 14 suites, 125 tests passed |
| Negative controls (temporary mutations, files restored and compared byte for byte): gate lines ROLE + HOLDER removed; the warning effect calling `confirm()`; `micReadoutKind` returning NO_SIGNAL for any flat frame; Live test order `delta-first` | 12 tests red in 5 files (gate unit, TECHNICIAN, non-holder, gate-closes-dialog, 3 simulated + 1 Live never-auto-switch, 2 Home, 1 model, no-optimistic-flip) |
| Negative control: the flip re-read removed in `device-tiles.tsx` | 2 Home tests red |

Not mine, seen red: `features/capture-selector/capture-selector.test.tsx:145` ("camera source: assigning
CAM-01 to video track 2…", detail text) — the `capture-selector` folder imports nothing from
`session-live` or `dashboard` and this row edited no file of it; the shared simulator it runs on has
uncommitted edits by other rows (`packages/shared/src/sim/**`). Not investigated further. jest prints `[colorKit.RGB]` console errors for every kit `Button variant="outline"`
(45 in the capture-selector suite as well): kit noise in jest, not a failure.

Not run: whole-workspace suite, any emulator, adb, build.

## 5. To wire / re-check when rows 66 / 71 land

1. Op 81 on the real route from a tablet and a phone session: request `{ inputId }`, answer `AudioSourceState`; the Core republishes `session` (with `audioSource`) in the command's revision — the cards move only from that. Without the republish the confirm stays busy.
2. **The audit assertion marked `ROW-71`** in `mic-source.test.tsx` (test "confirm: one command…"): today it accepts the simulator's `deviceId`; replace it with the contract's key list `fromInput, fromMs, sendingDeviceId, toInput, toMs` once row 71 aligns the simulator (D105). The two input assertions above it already accept both spellings.
3. E-30: the client sends no device member; the Core must name the paired device from the session (`sendingDeviceId` = `DEV-NNNN`). Proven only at the gate.
4. `403` with `details.reason: SESSION_HOLDER`: the mobile presenter words every 403 as "Requires the <role> role" (wrong for a non-holder investigator; shared presenter, row 71). The gate normally prevents the press.
5. Real `409 AUDIO_SOURCE_CONFLICT`, `409 INVALID_STATE`, `404`: the cards show their fixed sentence (classified before the presenter, because the mobile presenter turns a 409 into its generic "refused").
6. `MIC_SILENT`: the fault target as the Core publishes it (`silentInputOf` accepts an input id, a channel, or none) and that it clears.
7. `captureDurable` once in the shared session schema (request filed by row 72): check that it reaches the Live replica (not checked: whether today's session schema drops an unknown member), then the label and the timer on a real start.
8. Home: that the Core's `mics[].state` is READY while it records (section 2), and `meters` frames arrive on Home.

## 6. Device checks left for the M5 gate (scripted flows, 2 + 1 each; no PIN typed by an agent)

**Flow T-MIC — M5-SW-T** (`dems2_tablet`, lane 2, `demsdemo:///login?core=LIVE&motion=off`):
1. INVESTIGATOR starts a session; before the first durable fragment the monitor reads "Connecting cameras…", no timer; then "Recording".
2. Monitor: MIC 1 "Active" (gold outline), MIC 2 "Standby"; the toggle passes through "Checking your permissions…" on a cold open.
3. "Switch to MIC 2" -> dialog -> Cancel: no request, no audit row. Again -> "Switch microphone": haptic, pending, MIC 2 Active only after the Core's state; toast; exactly one `AUDIO_SOURCE_SWITCHED` row whose `sendingDeviceId` is the tablet's `DEV-NNNN` (E-30); analyser: 1 AAC stream, monotonic PTS, 0 inserted/dropped samples, boundary within one input quantum + IPC latency, interval rows in media ms.
4. Feed silence below -50 dBFS for 10 s on the active mic: the warning names it; active mic unchanged for the whole observation; no audit row; "Switch to standby" opens the same dialog.
5. SUPERVISOR on the tablet (session opened by the investigator): enabled. TECHNICIAN: disabled + "Requires the Investigator or Supervisor role". Another INVESTIGATOR: disabled + the holder sentence.
6. Pull the link: toggle disabled + "Session actions are paused until the Core link is back."; restore: enabled.
7. Stop from the web during an open dialog: the dialog and the toggle leave with the stop; read row 62's `runtime.diag.lateStop` and `.handover` records for this session (B11) — this run is the B11 measurement.
8. Visual, NOT checked by this row: tablet landscape middle column (timer card + audio card with two cards, the toggle, a reason line and, worst case, the warning + status strip) still fits 800 dp without clipping; phone portrait and landscape rows.

**Flow P-MIC — M5-SW-P** (`dems2_phone`, lane 1): steps 2-7 on the phone; the audit row names the phone's `DEV-NNNN`.

**Flow H-MIC — B15** (tablet, same session as T-MIC): Home idle shows READY + "— dBFS" (not "No signal"); during the recording both tiles show a level and "Active" / "Standby"; after the switch the words swap; unplug a mic on the Core side: that tile reads NO SIGNAL / "No signal".

## 7. Decisions and deviations

- D-73-1: the three refusals with a fixed sentence (ux §3.5) are classified BEFORE the mobile presenter; the presenter keeps denial, outage and limit.
- D-73-2: a lost Core link is its own gate state with the monitor's read-only sentence (row 68's "waiting" pattern), not "Checking your permissions…" as the web twin shows it.
- D-73-3: an idle MIC tile without a meter frame reads "— dBFS" (the app's "no value" mark; no new copy — the dashboard copy digest is pinned). Controller's call if a word is wanted.
- D-73-4: mobile permission = the store's role (`useRoleGate`, follows `session.updated`), not `useCorePermission` as on the web.
- D-73-5: the role chips and the toggle stay as they are while "Connecting cameras…" (the stored state is RECORDING; op 81 is the Core's to refuse).
- D-73-6: `sendMeters` of the Live monitor bed now names the engine's active input (was the constant `MIC-01`); no existing test changed its result.
- D-73-7: `masterplan/02_plan.md` tracking row not edited (shared, many drivers) — controller to mark M5-W3.
- Scripted exact-match inserts (each asserted to match once) were used on this row's own files; no shared file was touched.
