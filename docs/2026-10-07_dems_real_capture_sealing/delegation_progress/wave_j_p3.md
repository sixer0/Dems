# Fix wave J - sub-driver J-P3 (mobile: devices, capture-selector, network-time, storage)

Status: **needs-review**. Code + tests only; no device, no adb, no lane, no Gradle, no git write.
Tree 035150b + working tree. Paths below are under `apps/mobile/src/features/`.
Test files: `D` = `devices/real-capture-one-rule.test.tsx`, `S` = `capture-selector/capture-selector.test.tsx`,
`C` = `capture-selector/camera-search.test.tsx`, `N` = `network-time/network-time-screen.test.tsx`,
`T` = `storage/storage-screen.test.tsx`. All are EXISTING files; no new test file.

## Why needs-review (read first)

1. **41 tests of my files fail in `afterEach` of `apps/mobile/jest.setup.ts`, not in their bodies.** That
   file carries J-T's in-flight worklet audit (JM-01): "A worklet calls a function that is not a worklet …
   useDerivedValue: dbfsMeterTsx5 calls rect / vec / rrect". It fires for every test that mounts
   `components/composed/dbfs-meter.tsx` under the Skia mock. Neither file is mine; attributed, not fixed.
   Every one of the 41 shows ONLY that hook error (no body error in the output), so the bodies ran to
   their end - but a body that passes under a failing hook is weaker proof than a green test. Affected
   suites: `D`, `devices/devices-screen.test.tsx`, `S`, `C`. They must be re-run once J-T's audit accepts the
   Skia mock's `rect` / `vec` / `rrect`.
2. A red-first run was not possible without git; each fix has a CONTROL case in the same file instead.
3. Nothing here was seen on a device. Layout fixes (cut first letter, two-line rows) are prop-level.
4. `capture-notices.test.tsx` failed once (run 3: an uncaught render error surfaced as
   "window.dispatchEvent is not a function" in "situation A") and passed in runs 2 and 4 with the same
   code. Treated as load-sensitive; not explained.

## Findings

| Id | Result | Where (file:line) | Test |
|---|---|---|---|
| 1 JT-03 / JW-04 Network & Time | fixed - on a Core in its own capture LAN, PoE and Bandwidth are plain rows "Not reported" (no chip of the model, no bars, no moving figure, no LAN sheet); only this device's own link is stated; tablet header chip "Network: Not reported". Rule `networkNotReported` = Live AND (a device states a `sourceClass` OR `isOwnCaptureCoreState`) | `network-time/use-network-time.ts:49`, `network-status-card.tsx:139`, `network-time-screen.tsx` | `N:297` rule, both layouts, CONTROL both layouts |
| 1 JT-03 Health "Link quality 99.9%" | fixed - a GENERATED source draws "Not reported" + one sentence, no chart. Other devices keep the wave L chip | `devices/device-detail.tsx:702` | `D:380` both layouts; CONTROL `D:471` |
| 1 JT-03 diagnostics sheet | fixed - STORAGE / FAN / NETWORK / SECURITY read "Not reported" (neutral chip, `common.platformNotReported.value`, the words of Home's chip) when `isDiagnosticNotReported(check)` or when the Core states `platformNotReported` and the row is a PASS; summary "Every reported check passed · 4 checks are not reported by this Core". A WARN / FAIL the Core states is never hidden | `devices/diagnostics-sheet.tsx:46`, `:142` | `D:336` pure (imports `DIAGNOSTIC_NOT_REPORTED_EXAMPLE`), `D:380` both layouts, CONTROL `D:471` |
| 1 Settings diagnostics | NOT covered - `settings/maintenance-section.tsx:214` has its OWN `DiagnosticsSheet`; it does not share mine. See "needs another owner" | - | - |
| 2 JW-08 "NO SIGNAL" at rest | fixed on my screens - `deviceMicLevelKind`: "No signal" only when the microphone's state is `NO_SIGNAL`; `isLevelNotMeasured(frame)` or a flat / absent frame = "— dBFS" + "Not measured" plate (large meter), accessible value "— dBFS". The Devices rows and selector rows draw no level word; mic rescan draws none | `devices/device-mic-meter.tsx:38` | `D:336` pure (imports `AUDIO_FRAME_NOT_MEASURED_EXAMPLE`), `D:380`, CONTROL `D:471` |
| 2 JA2-34 meter under `motion=off` | partly fixed - the accessible value is the 1 Hz readout in every mode (the hour-long hold is removed) and the LARGE meter's clock is no longer stopped by the test switch, so its drawn number follows the input. Tested in both modes. NOT proven: that uiautomator still reaches idle on a microphone's detail under `motion=off` (decision 1) | `devices/device-mic-meter.tsx`, `device-detail.tsx` (MicHero) | `D:380` `it.each(['off','default'])` |
| 2 JA2-34 "System Time hh:mm:00" | fixed - `useDisplaySecond` is the true second in every mode; the roll is held by the reduced policy the switch resolves to | `network-time/use-network-time.ts:65` | `N:297` `it.each(['off','default'])`; `live-network-time.test.tsx:99` assertion updated on purpose |
| 3 JA2-24 camera refusal | fixed - the option of the camera that feeds the OTHER track says "In use by Video track 2. The Core accepts one camera on both tracks only with a different profile on each…" (visible + hint). Not disabled: the Core accepts it with two profiles. The refusal names the cause (`refusalCauseOf`: `cameraOnOtherTrack`, else the Core's reason code in words, else the plain sentence) | `capture-selector/capture-source-sheet.tsx:191`, `use-capture-selector.ts:62`, `capture-selector.tsx` (NoticeAlert) | `S:197`; `S:170` updated on purpose |
| 4 JA2-26 clip latch | fixed - the banner says "No session is recording." unless a session records; a latched clip names "Reset clip" with an "Open MIC 2" button; the microphone's Overview says '"Reset clip" clears the mark' | `devices/devices-screen.tsx:221`, `device-detail.tsx:589` | `D:471` |
| 5 JA2-33 Recording Indicator | fixed - `relayWords`: "Lamp off" and a grey beacon at rest, "SEDANG MEREKAM" and red only while a session records, a fault keeps its word; list, hero and Overview use it. This CHANGES the simulated rendering on purpose (the finding is of the simulated lane): `devices-screen.test.tsx:61` now expects "Lamp off" | `devices/devices-model.ts:156`, `device-row.tsx`, `device-detail.tsx` | `D:336`, `D:380` |
| 5 JA2-33 / JA2-29 "Live preview" / "this phase" | fixed in my folders - selector note "Status only. This build shows no live picture of the cameras."; the demo picture's label is the shared `devices.live.feedAria` ("…, bundled demo picture"); pane text no longer says "live preview". "(SYS-008)" is not in my folders (shared: J-S 12) | `capture-selector/i18n.ts`, `devices/device-detail.tsx:416`, `devices/i18n.ts` | `S:197` |
| 6 JA2-N10 camera search | fixed - on a SIMULATED Core (Live, device list, no `sourceClass`) that answered 503: one sentence saying it has no camera search and where its cameras are listed, NO Retry, the search control disabled with that sentence. A real-capture Core keeps Retry with "not available on this Core right now" (no "yet"). Intro no longer says "connects to nothing" | `capture-selector/camera-search-panel.tsx:60`, `:72`, `i18n.ts` | `D:534` + CONTROL, `C:536`; `C` S9 and intro assertions updated on purpose |
| 7 JA2-27 / JT-12 clipped text | fixed at prop level, NOT seen on a device - selector title 2 lines, selector detail 3, device row detail 2, registered row "Not assigned · CAM-04" 2, storage activity 2, storage legend label 2; the mic-rescan sentence is reworded and inset | `capture-selector/capture-selector.tsx:404`, `mic-rescan.tsx`, `devices/device-row.tsx`, `registered-device-rows.tsx`, `storage/storage-activity.tsx:85` | `S:197`, `T:248` |
| 7 JA2-13 "tablet" | fixed on my screens - "Device Control", "Device control offline", "This device · Core link", "Device link", "Read-only on this device." via feature-local keys (no shared key edited) | four `i18n.ts`, `devices/devices-model.ts` | `D:380`, `N:297`, `T:248`; `devices-screen.test.tsx:216` updated on purpose |
| 7 "PoE Switch, , 1 active" | fixed - a row without a detail has no empty middle | `devices/device-row.tsx` (RowFrame) | `D:380` |
| 8 JA2-38 / JT-21 storage counts | fixed - labelled "Sealed today" and "Recorded, not sealed" (they are counts over the Core's evidence list, never the list's size) | `storage/capacity-card.tsx:53` | `T:248` both layouts |
| 8 "Est. Remaining: Not reported" | NOT fixed - the mobile store has no member for the Core's `estimatedRemainingMs`: `StorageSlice` (`packages/shared/src/sim/types.ts:879`) does not carry it and `selectStorage` derives the figure from a fixed 8.2 GB/h. Drawing that on a real-capture Core would be a model value. See "to wire" | - | - |
| 9 JT-13 selector rows | fixed - a row does what "Change" does while allowed; otherwise it is disabled with the gate sentence | `capture-selector/capture-selector.tsx:394` | `S:197` |
| 9 JT-14 swallowed tap / chip colour | fixed - the badge and the suffix chips take no touch inside a device row; `registeredStateTone` gives "Not checked" one neutral tone in the row and the detail | `devices/device-row.tsx:229`, `registered-device-rows.tsx:71` | `D:336`, `D:380` |
| 10 RBAC | see list below; one addition: Diagnostics and Test signal now carry the `DIAGNOSTICS_RUN` gate | `devices/device-detail.tsx:174` | `D:471`, `S:197`, `T:248` |
| 11 JA2-16 sheets | partly fixed - Android Back closes the open sheet / dialog and is consumed (`useSheetBack` in the three `use-sheet-presence.tsx` copies) for the source sheet, diagnostics, LAN, Manage storage and the device command dialog; each sheet's content is marked modal; the picker's radio rows expose `checked`. NOT proven: TalkBack, and that the portalled content appears in the `uiautomator` tree (that is how the kit mounts its portal) | `*/use-sheet-presence.tsx`, `capture-selector/capture-source-sheet.tsx:103`, `:275` | `S:197` (Back, checked, modal), `D:380`, `N:297`, `T:248` (modal) |
| added by J-P: duplicate GNSS toasts | fixed - `useNetworkTimeAlerts` no longer raises the loss / RTC toasts (the app-wide alert toast is the one statement); "GNSS lock restored" stays | `network-time/use-network-time.ts:116` | `N:141` and `live-network-time.test.tsx:121` updated on purpose |
| added (contract J-S 3) | fixed - a storage activity row of an export that was only REQUESTED reads "Export requested" | `storage/storage-activity.tsx:29` | `T` last case |

## RBAC control list (my screens)

| Control | Permission | Investigator | Supervisor | Technician | Unknown role |
|---|---|---|---|---|---|
| Camera search | CAPTURE_CONFIG | disabled, "Requires the Supervisor or Technician role" | enabled | enabled | disabled, "Checking your permissions…" |
| Selector "Change" and the row itself | CAPTURE_CONFIG | disabled, same sentence | enabled (locked while a session is open, with its sentence) | enabled (same lock) | disabled, checking |
| Microphone "Search again" | CAPTURE_CONFIG | disabled, same sentence | enabled | enabled | disabled, checking |
| Restart | DEVICE_MANAGE | disabled, "Requires the Technician role" | disabled, same | enabled (disabled while recording, with its sentence) | disabled, checking |
| Test signal | DIAGNOSTICS_RUN | enabled | enabled | enabled | disabled, checking |
| Diagnostics | DIAGNOSTICS_RUN | enabled | enabled | enabled | disabled, checking |
| Reset clip | any signed-in role (op 52) | enabled | enabled | enabled | enabled |
| Manage storage (open) | - | opens read-only: "Your role (Investigator) can view the storage policy. A Supervisor or Technician changes it." | opens | opens | opens with the signed-out reason |
| Apply policy | EVIDENCE_REVIEW or MAINTENANCE | disabled | enabled once changed | enabled once changed | disabled |
| Connect a found camera | - | disabled, "Connect this camera from the web console." | same | same | same |

Unchanged except the two DIAGNOSTICS_RUN rows. No control on these screens is enabled-then-refused by role.

## To wire when J-S lands

Landed and wired during this run: `isDiagnosticNotReported`, `isLevelNotMeasured`, `isOwnCaptureCoreState`,
`exportPhaseOfEvent`; examples imported in `D`. Still open:

- **Network**: no member says "network not reported"; the rule is client-side (`networkNotReported`). Expected: a statement on the `network` slice, or `getNetworkStatus` not answering model values on such a Core.
- **Storage**: `estimatedRemainingMs` of `storage/status` is not in the replicated `storage` slice. Expected: an optional member there.
- **Camera search**: "this Core has no discovery" is inferred from a 503 plus the simulated-Core rule. Expected: a capability or a refusal reason that says so.

## Needs another owner

- `components/composed/dbfs-meter.tsx`: (a) the canvas number is refreshed only by the meter's clock, so a caller cannot hold animation and keep the number; (b) no way to draw "— dBFS" in place of the floor value. I worked around both in `device-mic-meter.tsx`; Home's compact tiles and Session Live use the component directly.
- `apps/mobile/jest.setup.ts` + `src/motion/testing/worklet-closure.ts` (J-T): the audit rejects the Skia MOCK's `rect` / `vec` / `rrect` (see above).
- `features/settings/maintenance-section.tsx` (J-P2 / J-T): its own diagnostics sheet still shows PASS for STORAGE / FAN / NETWORK / SECURITY. It can import `diagnosticNotReported` and `summaryOf` from `features/devices/diagnostics-sheet.tsx`.
- `packages/shared` i18n (J-S 12): `devices.other.tabletControl`, `tabletOfflineTitle/Body`, `networkTime.network.tablet*`, `devices.cameras.feedAria` ("Live preview, …") are no longer used by my screens but still say "tablet" / "Live preview" for any other reader.
- Typecheck errors in files that are not mine: `components/composed/nav/live-mini-bar.tsx(44)`, `features/dashboard/home-live.test.tsx(284)`, `features/login/login.test.tsx(356)`, `features/pairing/pairing-screen.test.tsx(285, 286)`, `motion/motion-policy-provider.tsx(176, 180)`.

## Decisions for the controller

1. The large microphone meter now runs under `motion=off` (policy reduced, no tween). If uiautomator cannot reach idle on a microphone's detail in that mode, the alternative is to fix `dbfs-meter.tsx` (owner above) and pause it again.
2. Selector rows of a role that may not change them are now DISABLED rows (the kit may dim them). The other reading of JT-13 was "not announced as a button", which the kit's row does not offer.
3. The camera of the other track stays choosable with a warning; I did not disable it because the Core accepts it with two profiles.
4. JA2-33 changes the simulated lane's Recording Indicator on purpose ("Lamp off" in place of "Active").
5. On a real-capture Core the LAN sheet is not reachable at all (it held model values only).
6. `heldSecond` stays exported and tested in `network-time-model.ts` but has no production caller now.

## Commands and results

From the repo root; load checked before each jest run (5.73, 5.15, 5.35, 5.71, 5.03).

- `npm -w @dems/mobile test -- <8 files>` (run 3, the last run that held all of them): `Test Suites: 7 failed, 1 passed, 8 total` / `Tests: 44 failed, 110 passed, 154 total` - 41 of the 44 are the `jest.setup.ts` hook only; the other 3 were fixed and re-run:
- `npm -w @dems/mobile test -- storage-screen live-network-time network-time-screen capture-notices` (run 4): `Tests: 1 failed, 45 passed, 46 total` (the held-minute assertion, updated on purpose), then
- `npm -w @dems/mobile test -- src/features/network-time/live-network-time.test.tsx` (run 5): `Tests: 8 passed, 8 total`.
- Green files at the end: `N`, `live-network-time.test.tsx`, `T`, `capture-notices.test.tsx`. Hook-only failures: `D`, `devices-screen.test.tsx`, `S`, `C`.
- `npm -w @dems/mobile run typecheck`: 7 errors, none in my files (listed above).
- `npm -w @dems/mobile run lint`: no problems reported.

## Checks for the test runner

- After J-T's audit fix: `D`, `devices/devices-screen.test.tsx`, `S`, `C` - expected green.
- NOT run by me (untouched files of my folders that scan or render what I changed): `devices/devices-live-static.test.ts`, `storage/storage-live-static.test.ts`, `devices/devices-states.test.tsx`, `devices/camera-no-preview.test.tsx`, `devices/live-devices-sites.test.tsx`, `devices/registered-devices.test.tsx`, `devices/live-devices-health-caption.test.tsx`, `capture-selector/selector-lines.test.tsx`, `capture-selector/mic-limit-option.test.tsx`, `capture-selector/settings-capture-section.test.tsx`, `network-time/time-sync-fit.test.tsx`, `network-time/bandwidth-row-fit.test.tsx`, `storage/live-storage-sites.test.tsx`, and the Home / Session Live suites that draw `DeviceMicMeter`-adjacent copy. A red there from my wording changes comes back to me.

## Files changed

devices: `i18n.ts`, `devices-model.ts`, `device-mic-meter.tsx`, `device-detail.tsx`, `device-row.tsx`, `devices-screen.tsx`, `diagnostics-sheet.tsx`, `device-command-dialog.tsx`, `registered-device-rows.tsx`, `registered-device-detail.tsx`, `use-sheet-presence.tsx`, `real-capture-one-rule.test.tsx`, `devices-screen.test.tsx`.
capture-selector: `i18n.ts`, `capture-selector.tsx`, `capture-source-sheet.tsx`, `camera-search-panel.tsx`, `mic-rescan.tsx`, `use-capture-selector.ts`, `capture-selector.test.tsx`, `camera-search.test.tsx`, `capture-notices.test.tsx`.
network-time: `i18n.ts`, `use-network-time.ts`, `network-status-card.tsx`, `network-time-screen.tsx`, `lan-sheet.tsx`, `system-time-card.tsx` (comment), `use-sheet-presence.tsx`, `network-time-screen.test.tsx`, `live-network-time.test.tsx`.
storage: `i18n.ts`, `capacity-card.tsx`, `storage-activity.tsx`, `manage-storage-sheet.tsx`, `use-sheet-presence.tsx`, `storage-screen.test.tsx`.
docs: `delegation_progress/file_claims.md` (one line), this file.
