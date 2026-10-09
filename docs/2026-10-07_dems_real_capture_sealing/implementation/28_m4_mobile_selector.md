---
task_id: 2026-10-07_dems_real_capture_sealing
row: 68 (M4-W4, tablet/phone selector)
date: 2026-10-09
agent: coder-execution
status: needs-review (software complete; device checks and three decisions left for the gate)
---

# 28 — M4 mobile selector (row 68)

Tier 3. Paths are under `apps/mobile/src/` unless they start with another root.

## 1. What was built

| Register | Built | Where |
|---|---|---|
| MB-08 Devices | The device selector card on the Devices screen (tablet and phone), in its own panel boundary | `features/capture-selector/capture-selector.tsx:47-170`; mount `features/devices/devices-screen.tsx` (block "Task 3 row 68", above the camera section) |
| MB-09 Settings | New Settings section **Capture** (row in the System group, route value `capture`, title) holding the same card and a row to Devices | `features/capture-selector/settings-capture-section.tsx:24-43`; `navigation/params.ts:32`; `features/settings/settings-model.ts` (row `capture`, `SECTION_TITLE_KEYS.capture`); `features/settings/settings-controls.tsx` (`capture: Cctv`); `features/settings/section-body.tsx` (`case 'capture'`) |
| G1-G3 gate (E-16) | One function, order checking → waiting → denied → locked → allowed; controls always drawn, disabled with the reason | `features/capture-selector/capture-selector-model.ts:113-140`; hook `use-capture-selector.ts:78-125` |
| Ops 79 / 80 | One port, two ways in: `sim.request` (SIMULATED, HEARTBEAT) and `useMobileLive().client.call` (LIVE); never throws; refusal classes of ux §2.5 | `features/capture-selector/capture-selector-port.ts:44-84`; classes `capture-selector-model.ts:160-196` |
| Optimistic-free save | Nothing written locally; row reads "Saving…" while the command is out and until `captureConfig.updatedAt` reaches the answer's | `capture-selector-model.ts:219-225`; `use-capture-selector.ts:150-160` |
| Edit sheet per field | Bottom sheet (tablet), 92 % sheet (phone); draft → Save; options = registered cameras only (an adopted `CAM-NN` is one, a candidate never) | `features/capture-selector/capture-source-sheet.tsx`; `cameraOptions` `capture-selector-model.ts:84-98` |
| E-15 | Selector rows and sheet options: `ROW_CARD_BORDER` + always-mounted `SelectionGlow` | `capture-selector.tsx` (`SelectorRow`), `capture-source-sheet.tsx` (`OptionRow`) |
| G9 (restart / PoE cycle) | Unknown role now reads "Checking your permissions…" instead of "Requires the Technician role" | `features/devices/device-detail.tsx` (`roleKnown`, `restartHint`) |
| MB-02 Session New | `PrecheckCheckId` typecheck error closed (`MIC_PRIMARY`, `MIC_STANDBY` icons); role-keyed ids read the microphone state words; each microphone check row shows "Primary/Standby microphone · MIC-0N" from the session's selector snapshot | `features/session-new/check-icon.tsx:9-21`; `session-new-model.ts` (`valueKey`, `micRoleLine`, `checkMicBinding`); `devices-check-step.tsx` (`CheckRow`, second description line) |
| MB-10 Network & Time | "Camera Clocks" card: one row per configured camera (follows the selector). **Offset value is a seam** (section 2) | `features/capture-selector/camera-clock-card.tsx`; `features/network-time/network-time-model.ts` (`cameraClockRows`, `signedOffset`); mount in `network-time-screen.tsx` |
| MB-11 runtime audio | Already keyed by microphone input since M2 (`runtime/use-audio-shared-values.ts:121`, `MIC_INPUT_OF_CHANNEL`); no change needed; its test re-run green |
| MB-12 Audit | Labels of all audit types incl. the ten capture-phase ones proven present; a `CAPTURE_CONFIG_CHANGED` entry shows "Change: VIDEO-02: CAM-02 → CAM-01" | `features/audit/audit-model.ts` (`captureChangeOf`); `audit-entry-detail.tsx` |
| i18n | One new tree `features.capture-selector.*` (registered in `i18n/features.ts`) | `features/capture-selector/i18n.ts` |
| Row 118 (mediated, D95) | `case 'transcription'` + import in `section-body.tsx`; row 118's earlier edits in `params.ts`, `settings-model.ts`, `settings-controls.tsx` kept as ruled |

Why a feature folder of its own: the `*-live-static` tests of `devices`, `settings`, `audit` and
`network-time` pin each folder's file list, its copy digest, "no `useMobileLive` in devices" and "no
timer". The selector needs a Live call, a Retry cooldown and new words, so it lives in
`features/capture-selector/` and those four pins are untouched.

## 2. Real vs stand-in

| Part | State |
|---|---|
| Reads (`captureConfig`, `captureDevices` via `useSim`), gate, sheet, simulated ops 79/80 incl. audit rows | Real, tested against the real simulator |
| LIVE ops 79/80 | Code path real (`client.call`), tested with a fake client only — **not proven against a server** (row 66 not built) |
| Camera clock offsets | **Seam**: `useCameraOffsets()` returns no record; rows read "Not reported yet". Reason: offsets exist only in op 57's answer, and `live-network-time.test.tsx:112-114` pins "no read of operations 56 and 57" for this screen. I did not break that pin |
| "Development source" badge, camera search, notifications | Not built (rows 139, 138, 133); slots marked `SLOT row NNN` in `capture-selector.tsx`, `devices-screen.tsx`, `settings-capture-section.tsx` |
| Op 78 `updateCaptureConfig` | Not used by mobile (79 and 80 cover both fields) |

## 3. Commands and results (2026-10-09)

| Command | Result |
|---|---|
| `npm run -w apps/mobile typecheck` | exit 0 (was 1 error, `check-icon.tsx`) |
| `npm run -w apps/mobile lint` | 0 errors, 1 warning in `runtime/log.test.ts:160` (not this row) |
| `npx -w apps/mobile jest --maxWorkers=2 <touched folders + static guards>` (devices, settings, network-time, capture-selector, audit, session-new, more, transcription, navigation-units, settings-tab-root, i18n, lib, four runtime guards) | 56 suites, 476 tests passed |
| Negative control: `editable = true` in the card | 4 gate tests fail; restored |

New test files: `features/capture-selector/{capture-selector-model,capture-selector,settings-capture-section,camera-clock-card}.test.*`, `features/session-new/precheck-mic-roles.test.ts`, `features/network-time/camera-clocks.test.ts`, `features/audit/audit-capture-labels.test.ts`.

Pins moved (count/list pins only, by this wave's delta): `navigation-units.test.ts:199` (+`capture-selector`, +`transcription`); `settings-model.test.ts` System rows (+`capture`, +`transcription`); `settings-screen.test.tsx` System labels (+2); `more-screen.test.tsx:121` `5 sections` → `7 sections` (5 + transcription + capture).

## 4. To wire / re-check when row 66 lands

1. LIVE snapshot and deltas carry `captureConfig` and `captureDevices` (incl. `locked: true` while a session is open); the card needs nothing else.
2. Ops 79 / 80 from a tablet and a phone session: 200 answers `CaptureConfig` with `updatedAt`, and the slice republish has `updatedAt` >= that value (otherwise a row stays "Saving…").
3. Refusals reach the client as status + `error.code` (+ `details.reason`): 409 `CAPTURE_CONFIG_LOCKED`, 403, 404, 422 (`DEVELOPMENT_SOURCE_NOT_ALLOWED`), 503 (`CAPTURE_NOT_READY`).
4. Whether the Core emits `MIC_1`/`MIC_2` or `MIC_PRIMARY`/`MIC_STANDBY` precheck items: `CHECK_ORDER` still renders the shared eight (`PRECHECK_ORDER`); if the Core switches pairs, `PRECHECK_ORDER` (shared, not mine) must change.
5. A Live-bed test of the card over the fake transport (as `live-devices-sites.test.tsx`) once the contract examples of ops 79/80 are answerable.

## 5. Device checks left for the gate (scripted flows, 2 + 1 each)

- **Flow A — M4-SEL-T** (`dems2_tablet`, lane 2, `demsdemo:///login?core=LIVE&motion=off`): SUPERVISOR → Devices → Capture Sources → Change "Video track 2" → pick another registered camera (incl. an adopted `CAM-NN`) → Save → row shows it after refresh; Change primary microphone → roles swap; Settings → Capture shows the same; Audit entry shows the Change line. Also: deselected rows are not drawn empty (E-15).
- **Flow B — M4-SEL-P** (`dems2_phone`, lane 1): same through Settings → Capture and Settings → Device Settings; the sheet opens at 92 % height and Save is reachable.
- **Flow C — M4-PC-1** inside A and B: INVESTIGATOR sees the four Change controls disabled with the role sentence; open session → locked banner; first frames after sign-in show "Checking your permissions…" (G1-G3, G9).
- **Flow D — M4-RG-MOB**: Session New pre-check shows the role line under MIC 1 / MIC 2; Network & Time shows Camera Clocks without overlap in the tablet's third pane.

## 6. Decisions taken / for the controller

1. STT status stays its own Settings section "Transcription status" (ux §8a "Entry"), not embedded in Capture.
2. Denied sentence names both roles ("Requires the Supervisor or Technician role", ux §2.4), not the single-role sentence of `useRoleGate`.
3. **Needs a ruling:** camera clock offsets — add them to the replicated `time` slice, or lift the "no op 57" pin of Network & Time for one read.
4. **Needs a ruling:** the pre-check keeps `MIC_1`/`MIC_2` rows (shared `PRECHECK_ORDER`); moving to the role-keyed pair is a shared change with row 67.
5. `masterplan/02_plan.md` tracking row not edited by me (shared file, many drivers) — controller to mark M4-W4.
