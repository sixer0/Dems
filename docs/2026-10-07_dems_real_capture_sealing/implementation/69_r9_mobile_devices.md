---
task_id: 2026-10-07_dems_real_capture_sealing
row: 138 (R-9 / R-10 / R-11, tablet and phone Devices delta)
date: 2026-10-09
agent: coder-execution
status: needs-review (software complete; device flows and three decisions left for the gate)
---

# 69 — R-9..R-11 on the tablet and the phone (row 138)

Tier 3. Paths are under `apps/mobile/src/` unless they start with another root. `cs/` = `features/capture-selector/`.

## 1. What was built

| Flow | Built | Where |
|---|---|---|
| 9 Search (G13) | Pure rules: answer classes, gate, the 9 panel states, forward-only progress from Core instants, rows in the answer's order | `cs/camera-search-model.ts` |
| 9 | Port for the three operations a device session may call (93, 94, 97): `sim.request` / `client.call`; no member for 95 / 96 / 89 | `cs/capture-discovery-port.ts:44-93` |
| 9 | Hook + provider: one search per screen; entry read of op 94 on focus; no read for a role without `CAPTURE_CONFIG`; poll >= 1 s only while RUNNING; 429 keeps its fixed seconds | `cs/use-camera-search.tsx` |
| 9, 10 | "Camera search" panel: S1-S14, candidate rows (address, make/model, name as single text nodes), **Connect drawn disabled with "Connect this camera from the web console."**, panel note; no handler, no dialog, no field | `cs/camera-search-panel.tsx` |
| 11 A, B | Banners from the ACTIVE alerts of the `alerts` slice by `params.reason`; device label from the id; "Search again" (camera = G13, microphone = G17); cleared only by the slice | `cs/capture-notices.tsx` (`CaptureNoticesBanner`), `cs/capture-notices-model.ts` (`captureNoticesOf`) |
| 11 B, 13 | Session New pre-check: unreachable row and blocked text from `params.rule` (D114), block with the count of the pre-check's one search and the two "Search again"; no mic switch (D83) | `cs/capture-notices.tsx` (`precheckSentence`, `PrecheckCaptureNotices`); mounts in `features/session-new/devices-check-step.tsx` (4 small edits) |
| 11 | Home bell: a notice is titled from `params.reason` with the device label | `features/dashboard/home-header.tsx` (1 import, 1 expression) |
| 13 (G17) | Microphone "Search again": one op 97 request, per-microphone state + sentence (§8f.3), "Checked at", unregistered count, 429 / 503 / role states | `cs/mic-rescan.tsx` |
| 12 | One badge component ("Development source" + kind; "Core Mac's camera / microphone" on mobile); decision function; mounted on Devices rows + detail, selector lines + sheet options, search list (group), pre-check rows | `cs/development-source-badge.tsx`, `cs/capture-notices-model.ts` (`developmentSourceOf`); mounts `features/devices/device-row.tsx`, `device-detail.tsx`, `cs/capture-selector.tsx`, `cs/capture-source-sheet.tsx` |
| Mounts | Devices screen: provider, banner, panel above the selector; Settings -> Capture: entry row "Search for cameras" (opens Devices; starts nothing), notices in the selector card | `features/devices/devices-screen.tsx`, `cs/settings-capture-section.tsx`, `cs/capture-selector.tsx` |
| Row 132's request | `deviceConsole: true` on the mobile simulator (after `...rest`, cannot be turned off) + test | `runtime/sim-adapters.ts` (`createMobileSim`), `runtime/sim-adapters.test.ts` (last describe) |
| Copy | Texts of ux §14.2 word for word in the feature tree `features.capture-selector.{search,connect,notice,source,localDevice,inputs}` | `cs/i18n.ts` |

## 2. The red test `capture-selector.test.tsx:145` — the TEST was wrong

Cause is not row 133's `PRECHECK_ORDER`. Since row 66 (D106 (3)) ops 78-80 run the hosted `setCaptureConfig`, whose rule refuses one camera on both tracks with one profile (`packages/shared/src/sim/capture-config.ts` `assertSelector`; both seeded tracks use the same profile, `initial-state.ts:159-160`): assigning CAM-01 to VIDEO-02 answers 422. The production code drew that refusal correctly. Fixed in tests only: the scenario is now a camera added later (`CAM-03`) plus a test of the 422 refusal. Same cause, same fix in `cs/capture-selector-model.test.ts` and `cs/camera-clock-card.test.tsx`.

Also followed (pass C1 widened the mic input id to `string`): `MicSelectorRow.inputId` / the `primaryMic` command are `string`; this closed the mobile typecheck error in `capture-selector-model.ts`.

## 3. Real vs stand-in / not proven

| Part | State |
|---|---|
| Simulated mode: search, list, pointer, RBAC, notices, pre-check rule rows, op 97 | Real, against the real simulator |
| S3 (running), S5, S7-S12, op 97 error codes, 429 / 503 | Driven by answering `sim.request` in the simulator's place in the test; the in-app simulator cannot reach them |
| LIVE path of ops 93 / 94 / 97 (`client.call`) | Code only. **Not proven against a server or a fake transport** (only the idle entry read runs on the Live devices bed) |
| Badge in real capture | Decision function and the drawn badge are tested; **no Live-bed or device proof**. Built-in devices carry no `sourceClass` yet (rows 136 / 139), so today nothing is badged |
| "Is on" indicator (`sourceOpen`), local CAMERA named cause on a row | Not built: `sourceOpen` is not in `CaptureDeviceStatus`; a camera's cause shows only in its situation-B notice (OP-125-4) |
| Badge on Session Live tiles / Home tiles | Not mounted (row 73's files); request filed |
| "View device" for a camera added later (`CAM-03`) | Not drawn: the mobile device detail knows the seven built-in ids only |

## 4. Commands and results (2026-10-09, once each; D122)

| Command | Result |
|---|---|
| `npm run -w apps/mobile typecheck` | 1 error, not this row's: `src/features/evidence/verify-v2.test.tsx(186,50)` (`V-15`; rows 87 / 141 in flight). 0 in this row's files |
| `npm run -w apps/mobile lint` | 0 errors, 1 warning in `runtime/log.test.ts:160` (not this row) |
| `npx -w apps/mobile jest --maxWorkers=2 src/features/capture-selector` | 11 suites, 108 tests passed |
| same, `src/features/devices src/features/session-new src/features/dashboard src/features/network-time src/features/settings src/runtime/sim-adapters.test.ts src/navigation/__tests__/navigation-units.test.ts src/i18n` | passed after two fixes: the Live devices bed now scripts the idle answer of op 94 (`features/devices/testing/live-devices-bed.tsx`); two stale tests of section 2. Static guards `devices-live-static`, `home-more-live-static`, `navigation-units`, `i18n` green |

Failing-first: `capture-selector.test.tsx:145` (red before, green after); the static test carries its own "patterns can match" control. No mutation round (D122 rule 6).

New test files: `cs/{camera-search-model,capture-notices-model}.test.ts`, `cs/{camera-search,capture-notices,precheck-capture-notices,development-source}.test.tsx`, `cs/no-credential-inputs.static.test.ts` (0 password fields in every feature folder but the operator sign-in; 0 text-entry components in `capture-selector` and `devices`; 0 production files naming ops 95 / 96 / 89 or their paths).

## 5. Checks for the test runner

| Command | Lock | Expected |
|---|---|---|
| `npx -w apps/mobile jest --maxWorkers=2` (whole mobile suite) | none | green except suites of rows in flight (87 / 141 evidence); any red in `capture-selector`, `devices`, `session-new`, `dashboard`, `settings` goes back to row 138. Watch: other Live beds that mount the Devices screen need an answer for `getCaptureDiscovery` |
| `npm run -w apps/mobile typecheck` after rows 87 / 141 land | none | exit 0 |

## 6. Device flows for the M4 gate (not run; lanes `dems2_tablet` lane 2, `dems2_phone` lane 1; fake ONVIF stub)

| Flow | Steps | Asserts |
|---|---|---|
| F1 search | SUPERVISOR -> Devices (phone: Settings -> Device Settings) -> Search for cameras with N stub devices -> list -> Search again; Settings -> Capture -> "Search for cameras" row | `M4-DISC-T`, `M4-DISC-P`; inside it `M4-CONN-PTR-T` / `-P` (Connect disabled + sentence, 0 password fields in the view tree, request log has 0 calls of 95 / 96 / 89) |
| F2 empty | stub empty: empty state, one banner, one bell item, five searches still one; stub back: 0 banners | `M4-DISC-EMPTY-T`, `-P` |
| F3 role | INVESTIGATOR: Checking, then disabled with the role sentence, request log 0 calls of op 94 | `M4-DISC-RBAC-T`, `-P` |
| F4 pre-check | one fake camera stopped: warning row with the count, acknowledge, start; both stopped: blocked; reachable run: 0 banners; INVESTIGATOR on the tablet: notification only, Search again disabled, Retry works | `M4-NODEV-B-T`, `-P`, `M4-NODEV-NOCFG-T` |
| F5 microphones | Search again on a microphone (one request, per-mic result); active mic removed: blocked sentence, no toggle; cancel, make the other primary on Devices, start: warning + degraded | `M4-MIC-RESCAN-T`, `-P`, `M4-MIC-ACTIVE-T`, `-P` |
| F6 label | development configuration: badge on Devices rows, selector, sheet, search group, pre-check rows; flag off: 0 badges, 0 group header | `M4-DEVSRC-LABEL-T`, `-P` (needs rows 136 / 139 to send `sourceClass`; monitor tiles need the filed mount) |

Component checks `M4-DEVSRC-LOCAL`, `M4-UX-UNIT` are the jest files of section 4. `M4-UX-VOC-1` / `M4-UX-A11Y-1` were not run as named checks (texts are §14.2 verbatim; disabled controls carry a visible reason and an accessibility hint).

## 7. Decisions taken / for the controller

1. **Copy lives in the mobile feature tree**, not `common.*` as §14.2 proposes: row 137 writes the shared file in this wave. A later pass may merge the two.
2. **"Real capture" on mobile = Live mode AND the session's `demoControls` is false** (same server flag as op 71's `demo`; no extra request). Limit: a Core in SIMULATED capture with demo controls off would badge a device that carries `sourceClass: DEVELOPMENT`. Needs a ruling if op 71 must be read.
3. **In Simulated mode the search list has no "Development sources" group** (D91 read as covering the group header, not only the badge).
4. The search bar is a plain `View` with `accessibilityRole="progressbar"` (heroui-native 1.0.10 has no progress bar; same idiom as `boot-gate.tsx`).
5. "Search again" for cameras inside Session New runs the search and shows its summary; the list stays on Devices.
6. Edits outside the ownership list of D95 §8, all minimal and listed in `file_claims.md`: `features/session-new/devices-check-step.tsx`, `features/dashboard/home-header.tsx`, `features/devices/testing/live-devices-bed.tsx`. Several edits in my own folder and the first of these were applied by scripted exact-string replacement, not the Edit tool; no reformat.
