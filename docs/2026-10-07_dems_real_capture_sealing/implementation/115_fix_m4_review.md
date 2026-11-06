# 115 — Fix pass F-M4 (code review row 69, milestone M4; decision D178)

| Item | Value |
|---|---|
| Agent | coder-execution (driver) + two sub-agents of the same row (mobile half, web Session New half) |
| Date | 2026-10-10 |
| Base | commit `abf742f`; no commit made; no migration (schema 6 / `dbc-7`) |
| Review | `gateway_check/17_m4_code_review.md` (3 MAJOR, 8 MINOR, 5 NOTE) |
| Status | **complete** — 3 MAJOR fixed, 3 rulings applied, 7 of 8 MINOR fixed, 1 MINOR recorded as a gap; device / browser flows not run (gate 70 / 75) |

No discovery was run against a network, no camera credential was used, no local device was selected,
pre-checked or opened, no attended variable was set. Every "local device" in a test is fixture state.

## 1. Findings

| Finding | Reproduced? | Fix | Test | Status |
|---|---|---|---|---|
| **R69-01** MAJOR — pre-check opens the Core Mac's camera with no notice | Yes, web and mobile. Web: `no answer is scripted for POST …/precheck/retry` (sent with no notice), 5 of 8 new cases red. Mobile: `expect(sent).toEqual([])` got `createSession` + `beginPrecheck` | One pure rule per client (selector line → device with `adapter: LOCAL_DEVICE`, real capture only) and one confirm dialog; nothing is sent before Confirm; Retry asks once per press; the web resume effect sends nothing by itself for a local selector and shows the sentence + "Run the device check". Web: `core-web/src/features/devices/local-source-gate.ts`, `local-source-notice.tsx`, mounts in `session-new/index.tsx`. Mobile: `capture-selector/local-source-notice-model.ts`, `local-source-notice.tsx`, gate in `session-new/use-session-new.ts` (`createAndCheck`, `retryChecks`), two mounts in `session-new-screen.tsx`. Wording: `common.localSourceNotice.*` | Web `src/test/live-session-new-local-notice.test.tsx` (8 cases, a control in each group), `devices/__tests__/local-source-notice.test.tsx`. Mobile `capture-selector/local-source-notice.test.tsx`, `local-source-notice-model.test.ts` | fixed |
| **R69-02** MAJOR — "is on" only on the mobile Devices roster | Mobile: yes (`source-on-session-live` / `source-on-home` absent). Web: does not reproduce — the three surfaces already draw it (`source-badge.tsx` `LocalSourceOn`; Monitor `audio-panel.tsx:66`, Dashboard `devices-panel.tsx:338` for the microphone) | Mobile: one model function `sourceOnKeyOf` (+ `openLocalSourcesOf`) in `devices/registered-devices-model.ts`; the three badge components of `capture-selector/development-source-badge.tsx` draw the line, so Session New and Home needed no edit; Session Live gets ONE mount (`OpenLocalSourcesOffScreen`, `session-live-screen.tsx` +3 lines) for an open local device no tile draws | Mobile `source-on-session-live.test.tsx`, `source-on-home.test.tsx`, `source-on-session-live-offscreen.test.tsx`, `registered-devices-model.test.ts`. Web `src/test/live-local-source-on.test.tsx` (three surfaces, each with its control) | fixed (mobile) / confirmed (web) |
| **R69-03** MAJOR — `REAL_PRODUCTION` lists stored development devices | Yes, by the db test the reviewer named: `expected ['CAM-01 - -', 'CAM-02 - -', 'CAM-03 LOCAL_DEVICE DEVELOPMENT', …] to deeply equal [5 production / switch rows]` | `capture/fence/sources.ts` `storedDeviceListingOf` (the caller `deviceSourceFieldsOf(...).listed` never had); applied where the stored rows become the state: `db/mapping` (`fromRows(rows, { captureDeviceListing })`, a device the selector names is never dropped — that refusal stays the fence's); handed to the engine by `modules/devices/source-facts.ts` at registration through the door `provideCaptureDeviceListing` (`engine/index.ts`, `host.ts`, `rehydrate.ts`), read at EVERY rehydration. Rows stay stored. The boot already registers no local device outside `REAL_DEVELOPMENT` and the production registry holds no adapter (asserted). Follow-on defect closed: the id of an adopted camera is minted over the STORED registry (`connect/service.ts`), else a hidden row could be overwritten | `modules/devices/__tests__/source-class.db.test.ts` (R69-03 case: list, slice, wire, registry, rows unchanged, reload; SIMULATED control; the existing REAL_DEVELOPMENT case is the control); `fence.test.ts`, `db/mapping/__tests__/from-rows.test.ts`, `connect/__tests__/service.test.ts` (red `expected 'CAM-03' to be 'CAM-08'`) | fixed |
| **R69-12** ruling — confirm the full target | New behaviour; red only by construction (member and function did not exist) | `connectionTargetOf` in `camera/onvif-session.ts`: built from the same `targetOf` the test uses, port always written. Optional contract member `CaptureCandidate.connectionTarget` (+ OpenAPI). Dialog shows it as text and the tick reads "I have checked that {{target}} is this camera" | `onvif-session.test.ts` "R69-12" (2 cases, incl. the stub contacted on that port and path), `search.test.ts`, `packages/shared/test/capture-connect-target.test.ts`, web `camera-connect-canary.test.tsx` "R69-12" | fixed |
| **R69-13** ruling — unanswered sign-in method | Web row: red (`Password refused` drawn). Server: red by construction | `cap` §A.6.2 already gives this case `AUTHENTICATION_FAILED` with reason `SCHEME_NOT_ALLOWED`; none of the other four fits. The outcome is kept and the reason now travels (optional `reason`, closed list of one code, on the op 95 answer and on `lastTest`); the dialog and the search row never say the password was refused. One request, no second attempt (unchanged). No sixth outcome | `connect/__tests__/service.test.ts` "R69-13" (+ control), shared contract test, web canary "R69-13" (dialog + row, each with its control) | fixed — see decision 2 |
| **R69-11** ruling — user-name bound 120 | Comments / spec text | Errata PE-FM4-01 in `masterplan/03_api_contract.md` §2.6 (op 95 row) and `08_client_ux_spec.md` §8d.3; stale comments corrected in `connect/index.ts` (3), web `source-badge.tsx`, `source-class.ts`, `registered-devices-model.ts`, mobile `registered-devices-model.ts` | — | fixed |
| **R69-04 / Q1** MINOR — typed text in the `value` attribute | Yes: an observer created before the dialog received `value|null|CANARYuser…`, `value|  CANARYpass…|null` (18 records) | The two fields are plain UNCONTROLLED inputs with the kit's field classes (not `TextField`); text is read from the element at the press; "filled" is two booleans; `react-hook-form` and the `MutationObserver` remover are gone from the dialog. Reveal, blur rule, clear on refusal / adoption / close, anti-autofill attributes unchanged. Erratum PE-FM4-02 (`08` §8d.3) | `camera-connect-canary.test.tsx` "an observer created before the dialog…" (with a planted control) | fixed |
| **R69-10** MINOR — canary could not fail | Yes (same run) | The new case asserts the property at every instant; the old line stays as the end-state check | same | fixed |
| **R69-05 / Q2** MINOR — `holdsClearSecret` | Yes: a stand-in answer of the right form was written (`expected true to be 'SealedCameraSecretRefused'`) | `credential-store/envelope.ts`: `isStoreSealedSecret` (a brand: the objects `sealSecret` returned, in the store's form). `sealFor` takes only that (seam `storeSealed`, wired in `connect/index.ts`); the 33-byte copy of the form check is gone; `holdsClearSecret` stays as second line | `service.test.ts` "question 2" (4 stand-ins refused, control) | fixed |
| **R69-06 / Q5** MINOR — seed's helper check | Yes: a program in a `0777` directory was accepted (`expected null …`) | `db/seed/demo-helper.ts` asks the boot's `helperProgramProblemOf` with the boot's inspector; codes are the boot's under `HELPER_` | `db/seed/__tests__/demo-helper.test.ts` (real inspector + 8 fact cases + control) | fixed |
| **R69-07 / Q10** MINOR — microphone limit only behind "View device" | Yes on both clients | Short sentence `common.localSourceNotice.microphoneLimit` on the selector line / option and on the pre-check row of a `LOCAL_DEVICE` microphone, real capture only | web `live-local-source-on.test.tsx`, `capture-selector` test; mobile `mic-limit-option.test.tsx` | fixed (first half). The alert body "to hold it in step": **not changed** — whether the audio stays in step at the limit is the worker's behaviour, not determinable from this row's files |
| **R69-08 / Q11** MINOR — `H265` literal | Yes (`expected ['src/capture/adapters/types.ts'] to deeply equal []`) | `adapters/types.ts`: `'H264' \| 'HEVC' \| 'OTHER'` | `adapters/__tests__/static.test.ts` A-6 | fixed (adapter half). The seeder half (`sealing-host/demo-seed/index.ts:240`) is fix F-M7's area: **not touched** |
| **R69-09** MINOR — replaced keys never destroyed | By reading (as the review) | **Not built**: the runtime role may read no `key_ref`, so only an owner-side unit could call `retainOnly`, and none exists — not a small fix. The two comments now state the gap | — | recorded gap |
| R69-14 NOTE | — | none (limits of log layer 5; no call meets them) | — | listed |
| R69-15 NOTE | — | none (the local device name is a literal; a limit of the phase) | — | listed |
| R69-16 NOTE | — | none (operation 91 is outside M4) | — | listed |

## 2. Decisions for the controller

1. **Three engine files were edited** (`engine/host.ts`, `index.ts`, `rehydrate.ts`; own lines marked "Device-list block (fix F-M4…)"). The device list reaches every client through the engine's replicated state; there is no projection step in the realtime channel, so the rule had to be applied at rehydration. The engine imports nothing of the capture unit (static rule): the devices module provides the rule.
2. **Two OPTIONAL contract members** were added (`CaptureCandidate.connectionTarget`, `reason` on the op 95 answer and on `lastTest`) and the OpenAPI document regenerated. Optional, so the simulator (`sim/api.ts`, other agents' file) is unchanged: in Simulated capture the dialog confirms the host as before.
3. **R69-13: the lock-out guard still counts the outcome** although nothing was sent (03 §7 counts `AUTHENTICATION_FAILED` outcomes). Conservative; say if it should not count.
4. **In `REAL_PRODUCTION` the four FAKE built-in cameras / microphones are no longer listed** (the ruling names FAKE). One existing pin moved for it (`source-class.db.test.ts`, the production case). The switch (`POE-SWITCH`, kind FAKE) stays listed: it is no capture source and carries no class.
5. **The connection target includes the path** the device announced (untrusted text, URL-path characters, at most 128; drawn as text, never a link). One existing pin moved (`search.test.ts`: "no service address is in the answer").
6. **Start Recording** also opens the local devices and has no notice of its own: D178 names the pre-check only. Not built.
7. Mobile: the gate sits in `useFlowActions`; while the dialog is open the Next / Retry control is busy, so hardware Back is held until the dialog is answered.
8. Seed helper codes changed (`HELPER_ABSENT` → `HELPER_NOT_FOUND`, …): one acceptance pin moved (`test/acceptance/demo-seed-v2.test.ts`).
9. The stale comment at `core-web/.../__tests__/registered-devices.test.tsx:186` ("no `sourceOpen` yet") was left.

## 3. Verification (each once; repeats only after a fail)

| Command | Result |
|---|---|
| `npm -w apps/core-server run test -- src/capture/fence src/capture/adapters src/modules/{devices,capture-config,capture-discovery,capture-inputs} src/credential-store src/db/mapping src/db/seed src/engine test/static` | 78 files passed, 2 failed, 1273 / 1275 tests. The 2: `engine/__tests__/static.test.ts` file count 20 ≠ 19 (`engine/export-doors.ts`, fix F-M8's new file) and `test/static/guard-family.test.ts` (tags `R63-06`, `R63-09`, the M3 fix). Neither is this row's |
| `lockf .locks/db-migrate.lock npm -w apps/core-server run test:db -- src/modules/devices src/capture/fence src/modules/capture-config src/modules/capture-discovery src/modules/capture-inputs src/db/seed src/db/mapping test/acceptance/demo-seed-v2.test.ts` | 17 files passed, 1 skipped; 179 passed, 3 skipped |
| `npm -w packages/shared run test -- test/capture-connect-target.test.ts test/api-capture-discovery.test.ts test/openapi.test.ts test/sim-capture-discovery.test.ts test/api-registry.test.ts`; `test/i18n*.test.ts` | 100 passed; 50 passed |
| `npm -w apps/core-web run test -- src/features/devices src/test/live-session-new-local-notice.test.tsx src/test/live-local-source-on.test.tsx src/test/live-session-new-precheck.test.tsx` | 13 files, 133 tests passed |
| mobile (sub-agent): `npm -w apps/mobile run test -- --maxWorkers=2 src/features/capture-selector src/features/session-new …` and the follow-up set | 45 suites / 386 tests; follow-up 6 suites / 56 tests; static 15 suites / 132 tests |
| typecheck | shared clean; core-web clean; core-server: only `src/capture/__tests__/records.test.ts` (2, not this row); mobile: only `session-recovery/failed-start.test.tsx:155` (not this row) |
| lint | shared, core-web clean; core-server 3 warnings and mobile 1 warning, none in this row's files |

Not proven here: anything in a browser, on a device or against a running Core; the look of the new dialog and lines; red runs for R69-12 and the server half of R69-13 (new members — red by construction, not run).

## 4. Checks for the test runner

| Command | Lock | Expect |
|---|---|---|
| `npm -w apps/core-server run test` | — | green but the baseline; this row adds no failure |
| `npm -w apps/core-server run test:db` | `.locks/db-migrate.lock` | green; watch `capture-session/__tests__/session-capture.db.test.ts` (boots `REAL_PRODUCTION`; not run here) and `test/acceptance/**` |
| `npm -w packages/shared run test`; `npm -w apps/core-web run test`; `npm -w apps/mobile run test -- --maxWorkers=2` | — | green |

Gate 70 (browser, `REAL_DEVELOPMENT`, FAKE sources plus a scripted registry entry that SAYS `LOCAL_DEVICE` — never CAM-03 / MIC-03 for real):
1. NEW — Session New, Next: the dialog names the device(s); 0 × create, 0 × pre-check in the network log. "Not now": step 1, 0 requests. Confirm: one create, one pre-check.
2. NEW — reload at step 2 with the session in CREATE: the sentence and "Run the device check"; 0 requests until Confirm.
3. NEW — "Re-run checks" twice: one notice per press. Control: an all-FAKE selector shows no notice and resumes by itself.
4. ALTERED — connect dialog: the full target row and the tick sentence; typing shows no `value` attribute in the Elements panel; a Basic-only stub camera reads "sign-in method … not sent", the row reads "Sign-in method not supported".
5. NEW — `REAL_PRODUCTION` lane on a database that holds CAM-03 / MIC-03 rows: Devices roster, selector options and operations 76 / 77 show none of them and none of CAM-01/02, MIC-01/02 (`M4-LOCAL-SEL-1`).

Gate 75 (`M5-SEC-PRIV-2-W / -T / -P`; a stub helper or the scripted door drives `sourceOpen`):
- Web: the line on the pre-check row, the Dashboard tile, the Monitor camera and audio card, the roster and drawer; gone within one delta after close; the local microphone row and selector line also show "Not fit for recording yet…".
- Tablet / phone: Home tile (`home-device-…-source-on`); Session New notice then the row line (`session-new-check-…-source-on`); Session Live `monitor-feed-source-on` for the camera on screen, `monitor-open-local-sources-<id>` for an open local device no tile draws, `monitor-mic-source-N-on` on the mic card; Devices roster unchanged. No line can be dismissed.

## 5. Follow-up — controller decision D181 (2026-10-10)

Decisions 1, 2, 4, 5, 6, 8 of section 2 were accepted. Two rulings applied, each red first.

| Ruling | Reproduced? | Fix | Test | Status |
|---|---|---|---|---|
| **(7) Start Recording** opens the local devices with no notice | Yes. Web: `no answer is scripted for POST /api/v1/session/{id}/start` (sent with no notice), 3 of 13 red. Mobile: `starts` expected 0, received 1 | The existing gate and dialog take a kind `PRECHECK` \| `START`; the START wording is `common.localSourceStartNotice.*` ("… and keep it on until the recording ends"). A confirm is never remembered: the pre-check consent does not count for the start, and every press asks again. Web: `features/devices/local-source-gate.ts`, `local-source-notice.tsx`, ONE line in `session-new/index.tsx` (`onStart`). Mobile: `capture-selector/local-source-notice.tsx`, `local-source-notice-model.ts`, ONE line in `session-new/use-session-new.ts` (the one function that sends the start) | Web `src/test/live-session-new-local-notice.test.tsx`, describe "D181 Start Recording…" (5 cases: confirm / cancel, countdown, pre-check consent does not count, reload, control). Mobile `capture-selector/local-source-start-notice.test.tsx` (4 cases) + one model case | fixed |
| **(3) Lock-out guard** counted a test in which nothing was sent | Yes: ten `AUTHENTICATION_FAILED` tests with 0 rejected requests closed the host (`guardTripped: true`); service `expected 1 to be 2` | `connect/limits.ts`: the guard counts REJECTED CREDENTIAL-BEARING REQUESTS; 0 adds nothing and forgives nothing; an adapter that reports no count (`null`) is counted as one. `connect/service.ts` hands the adapter's count on (or `null`). Erratum PE-FM4-03 in `masterplan/03_api_contract.md` §7 (`CAPTURE_CONNECTION_TEST_MAX_FAILURES`) | `connect/__tests__/limits.test.ts` "D181 (3)" (3 cases: N scheme-refused tests never lock, the same number of real rejections does; no forgiveness; unknown counts), `service.test.ts` "R69-13" (remaining stays 2 over five tests, `guardTripped: false`; a real rejection lowers it — control) | fixed |

Every path that can send a start: web one sender (`session-new/index.tsx` `startNow`, reached from the press and from the countdown that only a press begins); mobile one sender (`use-session-new.ts` `startRecording`, reached from `launch()` after a press). None is automatic; a reload / remount sends nothing (tested on both).

One pin moved by ruling (3): `limits.test.ts` had "a failed outcome whose count is unknown or 0 still counts once" — 0 is now not counted, unknown still is.

For the controller:
- Order of the notice and the 3-2-1 countdown differs: the web console asks BEFORE the countdown; tablet / phone ask AFTER it (the gate sits at the one sender; asking at the press needs an edit of `onStart` in the hot screen file). Say if mobile should match.
- Ruling (3) as built also leaves uncounted a test of a camera that asked for a credential when none was typed (`CREDENTIAL_ABSENT`, 0 requests): the same rule, no credential was sent.

Results (once each): core-server unit `src/modules/capture-discovery` 76 passed; db `src/modules/capture-discovery` 35 passed; core-web `live-session-new-local-notice` + `live-session-new-precheck` 30 passed, `live-local-source-on` + `devices/__tests__/local-source-notice` green; mobile `capture-selector/local-source*` + `session-new` + static 27 suites / 250 tests; typecheck and lint clean in this row's files (mobile workspace lint not repeated after one unused test helper was removed).

Gate 70 / 75 addition (stub entry that SAYS `LOCAL_DEVICE`, never the real device): on the ready step press Start Recording — the notice "Turn on a local device for the recording" names the device(s), 0 × start in the request log; "Not now" leaves the session armed; the next press asks again; Confirm sends exactly one start; a reload / relaunch on the ready step sends none; an all-FAKE selector shows no notice. Connect dialog: a Basic-only stub camera tested repeatedly keeps "2 more attempts" and never pauses; two wrong passwords on a Digest stub still pause it.
