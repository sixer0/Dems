---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
row: fix wave H, driver D (devices, selector, discovery, the development stub launcher)
date: 2026-10-10
agent: coder-execution (+ two client sub-drivers: web, mobile)
narrative_tier: 2
tree: f293221 + wave H edits, no commit, no migration
status: needs-review
---

# 124 - Fix wave H, driver D

Evidence: `gateway_check/09_m4_gate.md` (B-1, G70-01..09), `10_m5_gate.md` (G75-13 / -14), ruling D196.
Nothing here was driven on a lane, a browser or a device. No lane was started. No discovery was sent
to a network: every search of this work went to the fake ONVIF stub on 127.0.0.1 under the loopback guard.

## 1. Findings

| Finding | Reproduced red? | Fix | Test | Status |
|---|---|---|---|---|
| **B-1** no supported way to give a running lane the stub | n/a (a missing tool: the red is "the file does not exist") | `scripts/lane/lane.sh start <lane> --with-camera-stub` runs `npm run start:camera-stub -w @dems/core-server` = `apps/core-server/test/support/lane-camera-stub-cli.ts` (the entry point's start order, mirrored) + `test/support/lane-camera-stub.ts` (stub, fixture account, presets); the fence's decision `src/capture/fence/development-discovery.ts` (`developmentDiscoveryAdmissionOf`); `fake-onvif-stub.ts` gains `openDeviceListener()` | `src/capture/fence/__tests__/development-discovery.test.ts` (5); `test/support/lane-camera-stub.test.ts` (6); `src/modules/capture-discovery/__tests__/lane-camera-stub.db.test.ts` (2, booted REAL_DEVELOPMENT Core: ops 93 / 94 / 95 x4 outcomes / 96 / empty search, loopback guard: 0 refused, all datagrams and connections to 127.0.0.1); `test/static/lane-camera-stub.test.ts` (10) | built, tests green; LIVE proof is the re-gate's |
| **G70-01** SIMULATED Core states a source class (op 97) | YES - `simulated-no-source-class.db.test.ts`: op 97 answered `adapter: FAKE, sourceClass: DEVELOPMENT` | `src/modules/capture-inputs/routes.ts`: in capture operation SIMULATED no entry carries `adapter` / `sourceClass` (either branch); `CaptureInputScanEntrySchema`: the two members optional; OpenAPI regenerated | `src/modules/devices/__tests__/simulated-no-source-class.db.test.ts` (ONE table: ops 76, 77, the four device reads, 93 (503), 94, 97, 78, 79, 80, alerts; slices; audit rows) + `capture-inputs/__tests__/routes.test.ts` (2 new cases; the two cases that read the members now run in capture mode real) | fixed |
| **G70-02** no client assigns a microphone beyond the two lines | YES (web 4 files / mobile 12 cases red first) | web `devices/capture-selector.ts` (`micPairFor`, `setMicPair`, op 78 pair replacement), `capture-selector-panel.tsx` (`MicRow`: select + Save per line; the other line's microphone disabled with its reason); mobile `capture-selector/{capture-selector-model,capture-selector-port,use-capture-selector,capture-selector,capture-source-sheet}` | web `devices/__tests__/selector-microphones.test.tsx` (also pins CAM-03 on each video track); mobile `capture-selector/wave-h-mic-lines.test.tsx` | fixed in code and test |
| **G70-03 / G75-13** stock picture as preview in real capture | YES (web, mobile 13 cases) | web new `devices/camera-preview.tsx` + rule in `devices/source-class.ts`, used by `camera-tile.tsx`, `dashboard/{active-session-panel,devices-panel}.tsx`, `session-monitor/{inputs-panel,live-feed-panel}.tsx`; mobile new `devices/camera-preview.tsx`, used in `devices/{device-row,device-detail}.tsx`, `dashboard/device-tiles.tsx`, `session-new/device-previews.tsx`, `session-live/live-feed.tsx` | web `camera-no-preview.test.tsx`; mobile `devices/wave-h-no-preview.test.tsx`, `capture-selector/wave-h-no-preview-{home,session-new,session-live}.test.tsx` | fixed; one surface left (section 4) |
| **G70-04** "busy" stays after "Search again" (mobile) | YES (3) | mobile new `capture-selector/settled-busy-state.ts`, `mic-rescan.tsx`, `camera-search-panel.tsx` | `devices/wave-h-busy-settled.test.tsx` | fixed in D's area; the app-wide cause is a request (section 3) |
| **G70-05** selector rows carry no sending device | YES - 3 cases red (`deviceId` null) | `packages/shared/src/sim/capture-config.ts`: the row's `deviceId` = `sendingDeviceOf(state)` (optional 4th parameter); details unchanged | `packages/shared/test/sim-capture-config-sending-device.test.ts` (7); `capture-config.db.test.ts` "G70-05" (stored row; engine command with a device-bound principal, not an HTTP request of a paired device) | fixed for the Core |
| **G70-06** role sentence twice (phone) | YES | mobile `mic-rescan.tsx`, `capture-selector.tsx` | mobile wave-h tests | fixed |
| **G70-07** mic card title cut off (web) | YES (class-level) | web `audio-input-card.tsx`, `devices.css` | `devices-gate70-minors.test.tsx` | fixed in code; the rendering is a browser check |
| **G70-08** notice rule passes through while the device list is unknown | YES (web 4 cases, mobile 7) | web `devices/local-source-gate.ts` (knowledge rule over ops 76 / 77; `guard` refuses; Confirm drops when knowledge was lost), `local-source-notice.tsx`, blocks in `session-new/{index,devices-step,ready-step}.tsx`; mobile `capture-selector/{local-source-notice-model,local-source-notice}`, blocks in `session-new/{session-new-screen,devices-check-step}.tsx` | web `local-source-gate-unknown.test.tsx`; mobile `wave-h-sources-known{,-gate}.test.tsx` | fixed; one gap left (section 4); server proposal = decision 4 |
| **G70-09 / G75-14** demo fault ignores top-level `cameraId` | read, not a defect of the route | NOT CHANGED: `DemoFaultRequestSchema` (`packages/shared/src/api/demo-controls.ts:81`) is `z.object`, not strict - the contract's schema lets the member through | - | decision 3 |
| **M4-PC-1** "Checking your permissions..." | reachable on the web | pinned by a component test (web `devices-gate70-minors.test.tsx`) | - | not dead UI on the web; mobile: see the sub-driver's tests |
| **M4-CONN-PTR** Connect disabled + pointer sentence | - | no code change | mobile component test with a candidate | proven by component test; live with the stub at the re-gate |

## 2. The launcher (B-1) - what it is and what it is not

- **Where the stub lives.** It stays in test support (`apps/core-server/test/support/`), exactly as test
  strategy CR-5 says. It was NOT moved under `src/` and the fence does not load it: the LAUNCHER loads
  it and asks the fence. Reason: static rules G-R9 / SEC35-27 (6) / CPB1-12 already forbid any file
  under `src/` to name the loopback target or to import `test/`; keeping them unchanged is a stronger
  guarantee than a fenced import. The product's entry point `src/index.ts` has no flag, no variable
  and no import that reaches the stub (pinned by name in `test/static/lane-camera-stub.test.ts`).
- **The "flag" is the program.** There is no environment variable and no configuration key. The option
  of `lane.sh` selects another npm script.
- **Refusals.** REAL_DEVELOPMENT: admitted. REAL_PRODUCTION: `DevelopmentDiscoveryError`, code
  `DEV_CAMERA_STUB_IN_PRODUCTION`, thrown before the stub binds and before `app.ready()`; the launcher
  ends with the boot's final line (check `capture.cameraStub`). SIMULATED: ignored, one warning line
  `LANE_CAMERA_STUB_IGNORED`, the Core starts as without the option and `lane.sh` prints "IGNORED".
- **Can a real-LAN probe still happen on a stub lane? No.** The module takes one factory
  (`provided ?? own`); with the launcher's handed in, every search of that process (operation 93 and
  the pre-check's search) is built around the stub's target; `ws-discovery.ts` binds 127.0.0.1 and
  sends to that one port. A second `provideAdapter` throws.
- **N = 1** (D126): a second testable device needs a second loopback address, which needs root.
- **Fixture account**: two random words per start, written owner-only to
  `.locks/camera-stub.lane<N>.fixture`, printed by `lane.sh` when the lane is ready, never in the
  Core's log, removed at stop.
- **Presets** (one word into `.locks/camera-stub.lane<N>.mode`, read within 0.5 s): `NORMAL`,
  `AUTH_SCHEME` (-> `SCHEME_NOT_ALLOWED`), `UNREACHABLE`, `NO_PROFILE` (-> `WRONG_PROFILE`), `NOT_H264`,
  `EMPTY` (empty search). A wrong account on `NORMAL` -> the rejected outcome.
- **Not proven**: the launcher PROGRAM end to end (its process, signals, `lane.sh` printing). The
  program was executed only up to its two early refusals (bad argument; a port outside 4420-4423),
  which wrote two `fatal` entries into the Core's error log. Its production refusal is proven on the
  library (`prepareLaneCameraStub`) and by the static order pin, not by running the program against a
  standing database.
- Also in `lane.sh`, on driver E's request (D198 / D201): `--speech-mic` (lane 2 only, refused by name
  elsewhere, combinable) and `-u DEMS_CAPTURE_DEV_FAKE_MIC` for every lane; the mode line prints the options.

## 3. Requests filed / open for other owners

| To | What |
|---|---|
| B (`sim/actions.ts:264`, `sim/api.ts:750`) | optional: pass the in-app simulator's console device to `setCaptureConfigTransition` (G70-05 for the in-app simulator) |
| B / controller | G70-09: `DemoFaultRequestSchema` strict or not (decision 3) |
| B / controller | the in-app simulator's op 97 still states `FAKE` / `DEVELOPMENT` (contract C3 §2.6 says so) |
| owner of `apps/mobile/src/runtime/pending-control.tsx:30` | `busyState` returns `{}` when idle - the app-wide cause of G70-04 (pin `pending-control.test.tsx:23-25`) |
| B (mobile `session-new`) | Next / Start buttons have no `accessibilityLabel` (the "busy"-only label of G70-04) |
| owner of `apps/mobile/src/features/sessions/session-row.tsx:47` | still draws the demo poster on a real Core (G70-03 left surface) |
| D-area follow-up | `devices/device-detail.tsx` (mobile) diagnostics button keeps `busyState` |
| attribution only | red static guards / typecheck errors from A, C1, F in flight (line in `file_requests.md`) |

## 4. Left open, said plainly

1. Web: the "No preview" rule is "Live mode AND a device carries `sourceClass`" (an empty registry also
   counts as real). It DEPENDS on G70-01 (a SIMULATED Core never sends `sourceClass`).
2. Web: the Devices audio cards still map AUDIO-01 / 02 to MIC-01 / MIC-02 by constant
   (`devices/sim-adapter.ts:60`): with another pair selected the cards may name the wrong microphone.
3. Web: if the device knowledge is lost DURING the 3-2-1 countdown after a confirmed Start, the start still fires.
4. Mobile: no single all-green full run after the sub-driver's last edits; the merged-tree run below covers
   `capture-selector` + `devices` only, not `session-new` / `session-live` / `dashboard`.
5. G70-05 is not proven by an HTTP request of a paired device.
6. Contract document `masterplan/03_api_contract.md` (op 97 row, §2.6) not edited: erratum to write.

## 5. Decisions for the controller

1. **Launcher placement** (section 2): test support + fence admission instead of a fenced import under `src/`. Accept or rule otherwise.
2. **Contract erratum, op 97**: `adapter` / `sourceClass` of `CaptureInputScan.inputs[]` are optional, absent on a SIMULATED Core. Whether the in-app simulator follows (request to B).
3. **G70-09**: make `DemoFaultRequestSchema` (and `ScenarioLoadRequestSchema`) strict -> 422 for an unknown member. A contract tightening; not built.
4. **G70-08, server side (proposal, not built)**: the Core could refuse a pre-check / start whose selector names a `LOCAL_DEVICE` source unless the request carries an explicit member, e.g. `localSourceAcknowledged: true` on `beginPrecheck` / `startRecording` -> `409` with reason `LOCAL_SOURCE_ACK_REQUIRED`, the acknowledgement written into the audit row. It is a contract change (two request bodies, one reason code, clients send the member only after the notice) in B's modules and the shared API. It would make the client notice a second barrier instead of the only one.
5. **Lock-out guard on a stub lane**: two wrong accounts hold tests of 127.0.0.1 for 30 minutes (the product's constant); a reachable test or a lane restart clears it. `lane.sh` prints this. The gate should drive the wrong-account outcome once.
6. A stub camera that is adopted is a `FAKE` device (`CAM-04` on lane 2); it stays in `dems_lane_2` until a reset.

## 6. Commands run (once each unless noted)

| Command | Result |
|---|---|
| core-server unit: `test/static`, `src/capture/__tests__/static.test.ts`, `src/capture/fence`, `src/modules/{capture-discovery,capture-config,devices}`, `test/support` (sandbox off: loopback) | 554 passed / 6 failed in 4 static files; 1 was this driver's (fence inventory pin, fixed, re-run); 5 + 1 are A / C1 / F in flight (section 3) |
| core-server unit `src/modules/capture-inputs` | 11 / 11 |
| core-server db (lock `db-migrate`, throw-away databases, 0 remain): `lane-camera-stub.db.test.ts` | 2 / 2 |
| db: `simulated-no-source-class.db.test.ts` (red x3 before the fix - one run more than D122 allows, to read the first failure), then with `no-device.db.test.ts` | 7 / 7 |
| db: `capture-config.db.test.ts` | 10 / 10 |
| shared: `sim-capture-config-sending-device` (red 3 -> green 7), `sim-capture-config`, `api-capture-discovery`, `sim-capture-discovery`, `openapi`, `api-openapi-scope`, i18n | green (70 in the last run; i18n 50) |
| OpenAPI generator under `.locks/npm.lock` | regenerated; second run "unchanged" |
| `sh -n scripts/lane/lane.sh`; usage refusals (exit 64) | ok |
| web `src/features/devices` (merged tree) | 14 files / 126 passed |
| mobile jest `--maxWorkers=2` `capture-selector` + `devices` (merged tree) | 37 suites / 315 passed |
| typecheck: core-web 0, mobile 0, core-server 10 errors, none in a file of this driver | |
| lint: core-server clean in this driver's files; core-web clean; mobile 0 errors, 1 warning | |

## 7. Checks for the test runner

- `npm run test -w @dems/core-server` and `/usr/bin/lockf -k .locks/db-migrate.lock npm run test:db -w @dems/core-server` (sandbox off) once the other drivers' reds are closed.
- `npm test -w @dems/core-web`; `npx jest --maxWorkers=2` in `apps/mobile` (whole): item 4 of section 4.

## 8. Gate 70 checks to re-drive

Start lane 2 with `scripts/lane/lane.sh start 2 --with-camera-stub` (after a stop; lanes reset first).

- `M4-DISC-W/-T/-P`, `M4-DISC-OWNER-W`, `M4-DISC-EMPTY-*` (preset `EMPTY`, notification A).
- `M4-CONN-W` with the five outcomes (fixture account; a wrong account ONCE; `AUTH_SCHEME`; `UNREACHABLE`; `NO_PROFILE` / `NOT_H264`), `-ABANDON-W`, `-GUARD-W`, `M4-SEC-UI-1`, `M4-CONN-NOCRED-1`, "Add as camera", `M4-CONN-LOCK-W`, `M4-CONN-PTR-T/-P`.
- `M4-DEVSRC-LABEL-W` on lane 1 (0 badges, the re-read result included) and lane 2.
- G70-02: assign `MIC-03` to a line from web, tablet, phone - SELECT ONLY; a pre-check or start with it is the user's attended run.
- G70-03: Devices, Home, Session New, Session Live / Monitor on lane 2 show "No preview"; lane 1 keeps DEMO pictures.
- G70-08: Next / Start disabled with "Checking the capture sources..." while the list is held (throttled / offline reload).
- G70-04 / -06 on tablet and phone; G70-07 in a browser; G70-05: a tablet selector edit's audit row carries `DEV-0001`.
- `lane.sh start 1 --with-camera-stub` prints "IGNORED"; `--speech-mic` on lane 2 (driver E's checks).
- Still not drivable: `M4-NODEV-B-*`, `M4-MIC-ACTIVE-*` (no way to stop one generated source on a lane).
