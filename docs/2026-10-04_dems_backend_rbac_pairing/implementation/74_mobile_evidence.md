---
task_id: 2026-10-04_dems_backend_rbac_pairing
row: W74 (blueprint step 96, plan step 92)
task_slug: mobile-evidence-live
date: 2026-10-06
agent: coder-execution
source_plan: docs/2026-10-04_dems_backend_rbac_pairing/masterplan/02_plan.md (row W74)
status: complete
gate: controller decision D162 (code accepted; DN-1, DN-3 to DN-6 ruled; DN-2 granted: one device re-run)
device_check: met by the re-run of 2026-10-06 00:19-00:22 (section 15); the first sitting (section 6) ended at the cap
---

# W74 — Mobile Evidence in LIVE mode (sites S1-5, S1-6, S3-1, S5-1, S5-5; the Core's verdict)

Tier 2 report. Citations follow the plan's convention (`[CS:…]` = `masterplan/04_client_integration_spec.md`,
`[DEC:…]` = `decisions/decisions.md`, code as `path:line` under `apps/mobile/src/features/evidence/`
unless a longer path is given). No credential value, token, pairing code or password appears here.

## 1. Result at a glance

| Item | Result | Evidence |
|---|---|---|
| S3-1 archive dialog: busy until the settle, success toast only after the Core's 2xx, presenter first on a refusal, close in `done`, LB-1 spinner late | Done | `archive-dialog.tsx:54-71`, `:48`, `:89`; `live-evidence-archive.test.tsx` 6/6 |
| S1-5 / S5-1 the denied role's probe, the hint kept | Done | `export-sheet.tsx:148-194`; export tests 1-4 |
| S1-6 the export: request at the build step, result at the later of the answer and `EXPORT_BUILD_MS` | Done | `export-sheet.tsx:207-281`; export tests 8-11 |
| S5-5 archive hint kept | Done (documented, no logic change) | `use-evidence-data.ts:54-64`; archive test 5 |
| `verify` (AC-C-61): operation 41 only, the server's verdict is the record; bundled package only for `DEMO_PACKAGE` (MS-2) | Done | `live-integrity-tab.tsx`, `use-core-verify.ts`, `use-evidence-media-ref.ts`; verify tests 8/8 |
| StrictMode (controller note, F69-1 / D158): one request per effect-started call | Done | `live-evidence-strict.test.tsx` 2/2; mutation L1 detected |
| CLG (a) existing tests pass, unchanged vs `acaff20` | Pass | §4.1 |
| CLG (b) one Live test per named site: success, refusal, outage | Pass | §3, §4.2 |
| CLG (c) no `useSimActions`, no `.actions` read on a `Sim` | Pass | §4.3, `assets/74_clg_c.log`; static test 12/12 |
| CLG (d) device check | **Met by the re-run (D162)** | §15: LIVE Evidence detail with the Core's verdict PASS ("Core record"), the S1-5 refusal (the Core's 403, denied Alert), the SIMULATED Evidence screen, `core=SIMULATED` last; the first sitting (§6) ended at the cap |
| SG: whole mobile suite / typecheck / lint | 112 suites / 1,419 tests exit 0; tsc 0; eslint 495 files 0 errors 0 warnings | §4.4, `assets/74_final_gate.log` |
| Mutation check (M15, in memory) | 18 detected of 18; tree identical before and after | §5, `assets/74_mutations.log` |
| Lock status before / after | Identical | `assets/74_lock_status_start.txt`, `74_lock_status_end.txt` |

## 2. What was built, and why

Write path: `apps/mobile/src/features/evidence/**` only. 11 files edited (513 insertions, 106 deletions by
`git diff --stat acaff20`), 10 new files (4 production, 6 test).

### 2.1 S3-1 — the archive dialog (`archive-dialog.tsx`)

| Line | What | Why |
|---|---|---|
| `:37` | `archive` returns `CoreResult<void>` | The Live action answers after the Core did [CS:§8.7 S3-1] |
| `:54-71` | `settle(() => archive(id), { ok: success toast, fail: log; Live: presenter first, else today's danger toast; done: busy off, close })` | "the success toast in `ok` and the danger toast in `fail`, and closes in `done`" [CS:S3-1]; AC-C-63 |
| `:48`, `:71` | the store's clock at the press; the kit's `Spinner` once `LIVE_PENDING_REVEAL_MS` passed | LB-1 "busy at once, spinner late", rule 7 (no `setTimeout`) |
| `:86-89` | Simulated keeps `isDisabled={busy}`; Live passes `accessibilityState { busy }` and no disabled look | The kit sets `accessibilityState` from `isDisabled` and a prop replaces it (`heroui-native/.../button.js:205`), so Simulated passes none and stays byte-for-byte in behaviour |

Callers: `evidence-list-screen.tsx:70,142` and `evidence-detail.tsx:90,393` take the action from `useCoreActions()` and
return its result (CLG c). Simulated mode: `settle` runs `ok`/`fail` and `done` before it returns, so the dialog toasts
and closes in one handler as before (pinned by the archive file's Simulated test).

### 2.2 S5-1, S1-5, S1-6 — the export wizard (`export-sheet.tsx`)

| Line | What | Why |
|---|---|---|
| `:89-104` (sheet) | `ExportSheet` reads `useCoreLink().source === 'LIVE'` and passes `live` | The sheet's content is portalled above the runtime's context (`sheet-frame.tsx:12-13`); one LIVE idiom (rule 5) |
| `:148-165` | Simulated Authorize: today's timer, the probe through `settle` | Same order as before (log, haptic, denied); CLG (a) |
| `:167-194` | Live Authorize: after `EXPORT_AUTH_MS` on the store's clock the hint decides (S5-1); a denied role fires the probe with an empty reason through `settle`; the denied Alert follows the answer; `denialRecorded` is true only for the Core's 403 | S1-5 "still calls the Core so that the denial is audited"; LB-2 (the spinner spans the request); the Alert's "recorded in the audit log" stays true (rule 8) |
| `:197-206` | Live "Verify source": operation 41 through `useCoreVerify`; PASS/FAIL from the Core's answer; "Verify again" without a verdict | §14 point 7: the verdict shown is the server's; nothing computed on the tablet |
| `:207-222` | Live submit: the request leaves at the press (start of the build step) | S1-6 "the request starts with the build step" |
| `:224-246` | `finishBuild`: today's union mapping, shared by both modes; Live success sentence of its own | "The union maps as today; INVALID_REASON returns to step 3"; the shared sentence says "(simulated)" (finding F-3) |
| `:248-260` | Simulated build: today's timer, the call inside `settle` | CLG (a) |
| `:263-281` | Live: the answer shows at the later of its arrival and `EXPORT_BUILD_MS` (store clock); no answer → presenter, back to Reason with the reason kept | LB-2, LB-6 |
| `:448` | Done: the Core's manifest hash and "The Core recorded this export. No file is sent to this tablet." | MS-1; rule 8 |
| `:499-533`, `:536-552` | `LiveSourceStep`; `DeniedAlert({ recorded })` | Wording of the Live states |

F59: the client keeps its bounds (5 to 500 after trimming, `evidence-model.ts` `checkExportReason`) and the Core's 422
is the judge (export test 10).

### 2.3 `verify` — the server's verdict is the record

| File:line | What |
|---|---|
| `use-core-verify.ts:43-80` | One verification: `settle(() => actions.verify(id))` (`:56`); the answer is handed over at the later of its arrival and the minimum "asking" time on the store's clock (`:77`, LB-2); a rejection goes to the presenter first and gets one runtime-log record (`:71-74`) |
| `live-integrity-tab.tsx:60-200` | The Live Hash & Integrity tab: the Core's sealed record from the replica before a verdict; after it, the Core's `EvidenceVerifyResult` (chip, per-track sealed vs computed hash, manifest and signature checks), the custody entry from the replica; the bundled package's precomputed result beside it only when the detail passes one (`:160`), the info Alert when they differ (`:126`, `:168`) |
| `live-integrity-tab.tsx:96-107` | Kebab "Verify": the request starts one microtask after the effect and only if the effect was not disposed — one request under StrictMode (F69-1) |
| `evidence-model.ts:349-391` | `coreIntegrityView(item, verdict)` (every `actual`, `ok`, the verdict and the failed list from the Core's answer) and `bundledDiffers` (verdict or failed tracks) |
| `use-evidence-media-ref.ts:42-63` | Operation 40 through `useMobileLive()?.client.call('getEvidence', …)` (`:43`), the only `client.call` of the folder; a failure is logged with class and status only |
| `evidence-detail.tsx:117-126` | Live joins bundled media, manifest and package by the suffix the Core named for a `DEMO_PACKAGE` item, nothing for `NONE` or without an answer; Simulated joins by the evidence number as before |
| `evidence-detail.tsx:257-294` | The Media tab says "Asking the Core…" / "unavailable" in Live while it has no reference; Live renders `LiveIntegrityTab` |
| `sim-adapter.ts:46-82`, `integrity-tab.tsx:84` | The Simulated guard takes the actions of `useCoreActions()` and the clock reading, and calls `verify` through `settle` (CLG c); behaviour unchanged |
| `integrity-tab.tsx` | Presentational parts exported (`VerdictLine` now takes `verdict`/`failed`, `Section`, `HashText`, `TrackHashRow`, `CheckLine`, `LifecycleStrip`, `CustodyLog`, `integrityStyles`) so both tabs read the same |

### 2.4 Copy (rule 8) and the store's clock (rule 7)

- `i18n.ts`: 11 Live-only keys (`media.checking`, `media.unavailable`, `integrity.coreLabel`, `integrity.coreNote`,
  `integrity.bundledResult`, `integrity.bundledDiffers` (the spec's sentence of §14 point 7), `actions.manifestToastLive`,
  `play.bundled`, `export.deniedBodyUnrecorded`, `export.zipNoteLive`, `export.successLive`). The 185 Simulated texts are
  the `acaff20` texts (digest pinned by `live-evidence-static.test.ts`).
- `play-sheet.tsx:46-69`: in Live the chips read "Bundled demo package" + "DEMO excerpt" with bundled media, none without.
- `use-clock-due.ts:17-39`: the one wait helper (the pairing flow's idiom: store subscription, microtask, disposed flag).
  No new `setTimeout`/`setInterval`/`Date.now` in the Live files (static test rule 4).
- The Core link notice: no screen of this folder words the link; no fourth rule (`link-notice-static.test.ts` passes).

## 3. The Live tests (CLG b) — on the fake transport

Bed: `testing/live-evidence-bed.tsx` — the app's real Live source over `createFakeTransport`, the real
`AppProviders` and the real evidence route files; a real simulator as the Core's engine (each command runs there and
its changed slices travel as one delta whose revision the answer names); `role` investigator or supervisor; `strict`
renders under `<StrictMode>`; `resetCoreErrorPresenterForTests()` in `beforeEach`; full motion (the paced minimum
times are tested; W67's bed runs reduced, where they are 0). Every refusal is named by the contract's own example.

| Site | Success | Refusal (AC-C-48) | Outage |
|---|---|---|---|
| S3-1 (list and detail) | toast only after the delayed 2xx; busy, spinner after 420 ms, second press ignored; detail path | `archiveEvidence` 403 `notPermitted` → "Not permitted" / "Requires the Supervisor role", no success toast | "Core server unreachable" / "Nothing was changed." |
| S1-5 | INVESTIGATOR: one probe with empty reason after `EXPORT_AUTH_MS`, the Core's 403 (`forbidden`) → denied Alert; one `EXPORT_DENIED` row on the engine | stale hint: the Core's 422 (`invalidReason`) → denied Alert saying the Core did not record a denial | presenter toast; Alert says not recorded |
| S5-1 | SUPERVISOR: authorized after the wait, no probe | — (a hint) | — |
| S1-6 | one request at the press, "Building" past the answer until `EXPORT_BUILD_MS`, Done with the Core's export ID, Live success sentence | 403 `forbidden` → the refusal's Alert (the union, [CS:§6.2] "Web, export wizard"); 422 → back to Reason, reason kept | presenter toast, back to Reason, reason kept, Export enabled |
| S5-5 | SUPERVISOR archive (above) | INVESTIGATOR: entry disabled, no request | — |
| verify (AC-C-61) | PASS: one `verifyEvidence`, no operation of the Demo tag in the fake's log, the Core's hashes and custody entry; FAIL (0005, AUDIO-02, the Core's computed hash shown); Core vs bundled differ → Alert; media NONE → no bundled check; op 40 outage → "unavailable" | a 404 (`notFound`) the presenter does not word → the tab's own toast; a later Verify succeeds | presenter toast, button back to "Verify" |

Totals: archive 6, export 11, verify 8, strict 2, static 12 = **39 tests in 5 new files**.

## 4. Verification (commands and the last lines of their output)

### 4.1 CLG (a)

```
## 23:53:42 CLG (a): existing test files of the folder vs acaff20
apps/mobile/src/features/evidence/evidence-detail.test.tsx
apps/mobile/src/features/evidence/evidence-list.test.tsx
apps/mobile/src/features/evidence/evidence-model.test.ts
apps/mobile/src/features/evidence/play-sheet.test.tsx
apps/mobile/src/features/evidence/testing/evidence-harness.tsx
apps/mobile/src/features/evidence/testing/evidence-test-setup.ts
apps/mobile/src/features/evidence/testing/kit-helpers.ts
-- git diff --stat acaff20 -- <those files>:
(empty = unchanged)
```
`npm run test -w @dems/mobile -- --maxWorkers=2 --verbose src/features/evidence` (`assets/74_evidence_tests_verbose.txt`,
before the 11th export test was added): `Test Suites: 9 passed, 9 total` / `Tests: 78 passed, 78 total` — the four
existing suites (40 tests) among them. The 72 baseline test files: `lines of git diff --stat acaff20 -- <the 72>: 0`.

### 4.2 CLG (b)

```
$ npm run test -w @dems/mobile -- --maxWorkers=2 src/features/evidence/live-evidence-export
    ✓ INVESTIGATOR: after EXPORT_AUTH_MS one call with an empty reason; the Core's 403 (forbidden) → the denied Alert, audited by the Core
    ✓ INVESTIGATOR, outage: the presenter's toast, and the denied Alert says the Core did not record the attempt
    ✓ a hint behind the Core (the Core answers the empty reason 422, F59): still the denied Alert, saying the Core did not record a denial; nothing exported
    ✓ SUPERVISOR (S5-1): the hint authorizes after EXPORT_AUTH_MS on the store's clock and no probe is sent
    ...
Tests:       11 passed, 11 total
```
The other four files: archive `Tests: 6 passed`, verify `Tests: 8 passed`, strict `Tests: 2 passed`, static
`Tests: 12 passed` (full lists in `assets/74_evidence_tests_verbose.txt`).

### 4.3 CLG (c) (`assets/74_clg_c.sh`, `74_clg_c.log`)

```
## 23:54:01 CLG (c) over 24 production files of features/evidence
-- grep -n useSimActions:
   (grep exit 1; 1 = no match)
-- grep -nE '<name containing sim/Sim>.actions':
   (grep exit 1; 1 = no match)
-- every '.actions' outside a quoted string, styles.actions excluded:
   (end of list)
```
Plus the workspace scans: `live-no-raw-fetch`, `live-auth-static`, `pairing-live-static`, `login-live-model`,
`link-notice-static`, `secure-store-import`: `Tests: 49 passed, 49 total`.

### 4.4 SG — whole suite, typecheck, lint (`assets/74_final_gate.log`)

```
## 2026-10-06 00:08:12 WIB load averages: 4.36 5.29 5.74
## $ npm run test -w @dems/mobile -- --maxWorkers=2
Test Suites: 112 passed, 112 total
Tests:       1419 passed, 1419 total
Time:        74.293 s
exit=0
## 00:09:27 $ npm run typecheck -w @dems/mobile
exit=0
## 00:09:34 $ npm run lint -w @dems/mobile -- --format json
exit=0
eslint json: files 495 errors 0 warnings 0
```
Above the floor (96 / 1,257); the totals include the other rows' files landing in parallel. An earlier run at 23:55
was 110 / 1,395 exit 0 (`assets/74_suite_run1.log`). No red file at either run. (The controller's 23:38 observation —
red only in this row's in-flight files — matched an unfinished draft of `live-evidence-verify.test.tsx`, replaced
minutes later.) KI-07: `62` markers / `13` IDs in `apps/mobile/src`, unchanged; the folder holds the 8 of `acaff20`.

## 5. Mutation check (rule M15; `assets/74_mutate.py.txt`, `74_mutating_transformer.cjs.txt`, `74_mutations.log`)

The M0 method: a jest transformer changes ONE source file in memory; the 5 Live test files run against it.

```
control (no mutation): exit=0 Tests:       38 passed, 38 total (31 s)
A1 detected (toast before the answer)   A2 detected (refusal skips presenter)   A3 detected (closes at press)
A4 detected (spinner at once)           E1 detected (no probe)                  E2 detected (unrecorded counted recorded)
E3 detected (no build minimum)          E4 detected (outage skips presenter)    E5 detected (source passes without verdict)
E6 detected (422 stays at Build)        E7 detected (no Authorize wait)         V1 detected (no asking minimum)
V2 detected (verify skips presenter)    L1 detected (kebab Verify in the effect: twice under StrictMode)
L2 detected (chip shows bundled verdict) L3 detected (no differs Alert)         M1 detected (sealed hash shown as computed)
D1 detected (Live joins bundled by evidence number)
## 18 detected (7 + 11), 0 not detected, 0 not applied
## the mutated files in the tree, before and after: identical
```
(The control ran before the 11th export test was added: 38 tests.)

## 6. The device check (CLG d) — first sitting (ended at the cap; superseded by the re-run of §15)

One sitting on the phone (`dems2_phone`, emulator-5554), lane 1 (`dems_lane_1`, backend `127.0.0.1:4421`, no
reset), inside `lockf .locks/core-server.lane1.lock` (it waited behind W78's run until 23:56:52) and
`device-session.sh phone` with `METRO_PORT=8083 DEMS_CORE_HOST_PORT=4421 DEVICE_SESSION_MAX_SECONDS=600`. Scripts:
`assets/74_run_w74.sh`, `74_device_w74.sh`, `74_device_flow.mts.txt`; log `74_device_run.log`.

| Step | Result |
|---|---|
| Lock / keyguard | `screen awake, no keyguard`; never exit 77; lock status identical before and after |
| `demsdemo:///?core=LIVE` | `runtime.live.ready` after 2 s; the LIVE Login with "Core online", "Core: DEMS-IR-01 • paired as DEV-0001" — `74_phone_live_login.png` |
| Sign-in (INVESTIGATOR, typed into the app's own fields; the password never printed) | `POST /api/v1/auth/sign-in 200` (device JS log and server request log, principal=device) |
| After the sign-in | The Session Summary of SES-20261005-0026 opened first, with the app's "Enable biometric sign-in on this tablet?" dialog on top — `74_phone_live_summary_first.png`. The script's tap on "Done" landed outside the dialog; no acknowledge request reached the Core (server request log: 5 requests, none an acknowledge); the dialog's buttons were not pressed |
| Evidence screen | **Not reached**: `uiautomator dump` could not get an idle state on the animated screens (37 × "could not get idle state", about 10 s each: the Login's ambient motion, then the Summary/Home), which used up the cap |
| `demsdemo:///?core=SIMULATED` (the last launch, D124) | Cold start, `runtime.sim.hydrated` at once; the session cap (600 s) ended the sitting while the SIMULATED Login was being filled: exit 142 |
| Clean-up | Metro stopped, reverse rules removed, app force-stopped (device-session); backend stopped; `lsof … 4421 8083: exit 1 (none)`; `.locks/core-server.lane1.pid` emptied |
| Secrets | `bearer/cookie/credential lines in the server log: 0` |

No second sitting was started: the brief allows ONE. What a re-run needs is in decision DN-2.

## 7. Contract gaps found

| ID | Where | Gap |
|---|---|---|
| CONTRACT-GAP-W74-1 | `export-sheet.tsx:176`; `testing/live-evidence-bed.tsx:23`, `:94` | The S1-5 probe sends an empty reason on purpose (a stale hint then gets the Core's 422, never an export: F59). The Core reads the role before the body and answers a denied role 403 + one `EXPORT_DENIED` whatever the body (`implementation/35_module_evidence.md` §6.2: "a short reason … the same 403"). Operation 42's request schema cannot express "after the guard", so a contract-checked fake refuses the probe's body. The bed adds exactly `{ reason: '', destination: '' }` to the accepted bodies of operation 42 and answers it in the server's order |
| CONTRACT-GAP-W74-2 | `evidence-media.ts:24` | Items of operation 39 (`EvidencePage`) and the replicated `evidence` slice carry no `EvidenceMediaRef`; only operation 40 does, one item per call. The Live detail follows MS-2; the list's row posters still join by the evidence number |

## 8. Findings

| # | Finding |
|---|---|
| F-1 | Device scripts must not rely on `uiautomator dump` on screens with continuous motion (Login, Home, the Summary under its dialog): every dump times out at "could not get idle state". W60's fixed Login coordinates and deep links avoid it |
| F-2 | After a LIVE sign-in on lane 1 the pending summary of SES-20261005-0026 opens first and the biometric-enable dialog sits on top of it; a device script must deal with that dialog (an app dialog, not a system prompt) before it can reach any other screen |
| F-3 | Shared copy says "(simulated)" in Live mode: `evidence.exportWizard.success` (replaced by `features.evidence.export.successLive` in Live) and the destination labels `evidence.exportWizard.destinationUsb/Network`, which are kept: they are the label the Core records as given, and no transfer happens in either mode. `packages/shared/**` is not this row's |
| F-4 | Live "Verify source" calls operation 41, so each export that reaches step 1 writes one `EVIDENCE_VERIFIED`/`EVIDENCE_VERIFY_FAILED` row (DN-1) |
| F-5 | The "busy at once, spinner late" press logic now exists in `session-new/use-pending-press.ts` (W67) and in a few lines of `archive-dialog.tsx`: the KI-08 class in a small form; a shared hook belongs in `runtime/` or `components/` (W100) |
| F-6 | The motion policy decides what a Live test proves: W67's bed sets `linkMotion: 'off'` (reduced: every paced minimum is 0); this bed runs full motion so LB-2's minimum times are tested |
| F-7 | Pre-existing noise in the evidence suites, also in the baseline logs (`assets/15_gate_mobile_test.log`): kit `colorKit` console errors and "A worker process has failed to exit gracefully"; the Live files alone exit cleanly |
| F-8 | The detail's "This evidence item is not on this device." also shows in Live when the replica lacks the item; the wording fits Simulated better (not changed) |

## 9. Deviations

| # | Deviation | Reason |
|---|---|---|
| DV-1 | CLG (d) not met in the first sitting | §6; met by the re-run the controller granted (D162, §15) |
| DV-2 | The Simulated paths of `export-sheet.tsx` and `integrity-tab.tsx` keep their `setTimeout` timers | Existing code; the existing tests use real timers over a manual-clock simulator, so moving them to the store's clock would change Simulated behaviour (CLG a). Every Live wait is on the store's clock |
| DV-3 | Live "Verify source" asks operation 41 (not named in S1-6) | §14 point 7: an integrity verdict shown in Live is the server's; the Simulated step shows a precomputed result labelled "verified by the Core", which Live may not do |
| DV-4 | The bed's request check accepts one extra body for operation 42 | CONTRACT-GAP-W74-1 |
| DV-5 | The archive dialog closes on an outage | S3-1 says "closes in `done`"; the dialog holds nothing typed (LB-6's "stays open" is about typed content) (DN-6) |
| DV-6 | Process: three shell commands started with a `cd` (23:08 a read-only listing; 23:16 a no-op subshell that failed; 23:21 before an edit with absolute paths) | Slips; nothing changed by them. The mutation runner starts jest with `cwd=apps/mobile` (a subprocess argument, the M0 method), because the `@/` alias resolves from there |

## 10. Decisions for the controller

| # | Decision |
|---|---|
| DN-1 | Accept that Live "Verify source" runs operation 41 (one audit row per export attempt reaching step 1), or show the replica's last recorded verification (`item.verification`) instead |
| DN-2 | Schedule one device re-run (≤ 10 min, phone/lane 1 or tablet/lane 2) with: W60's fixed Login coordinates (no dump on Login); after the sign-in, "Not now" on the biometric dialog, then the Summary's Done (acknowledges SES-20261005-0026, controller note 3); then `am start -d 'demsdemo:///evidence/EV-20261005-0014'` (recorded in Live: media `NONE`, so the screen also shows MS-2); dumps only on the Evidence screens (no ambient motion); tab Hash & Integrity → Verify → screencap; Export as INVESTIGATOR → the Core's 403 Alert → screencap; then `core=SIMULATED`. The scripts in `assets/74_*` hold everything else |
| DN-3 | CONTRACT-GAP-W74-1 for W83: teach the fake (or the contract) "permission before body" for operation 42; the probe must keep its empty reason (a valid reason would export on a stale hint) |
| DN-4 | CONTRACT-GAP-W74-2: a media reference on list items / the replica, or accept suffix-joined posters in the Live list |
| DN-5 | The shared "(simulated)" copy shown in Live (F-3): for the owner of `packages/shared/src/i18n` |
| DN-6 | Confirm DV-5 (archive dialog closes on an outage) |

## 11. State left on the device and its lane (after the first sitting; the final state is in §15.5)

| Where | State |
|---|---|
| `dems2_phone` | App force-stopped by the session clean-up after a cold `core=SIMULATED` launch (`runtime.sim.hydrated` seen). The stored source was not read back (the cap came first): that the launch stored SIMULATED is the D124 mechanism W60 observed, not verified in this sitting. The SIMULATED Login held a typed username when the app was stopped (not persisted). One UI dump file `/sdcard/w74.xml` (the SIMULATED Login hierarchy, password field empty; no secret) left on the phone. Biometric dialog buttons not pressed; no `setBiometricEnrollment` request; keyguard, PIN and fingerprint untouched (status identical) |
| `dems_lane_1` | DEV-0001 kept (`paired_devices 1`, `device_credentials 1` before and after); `audit_log 158 → 161` from the one device sign-in (the server's request log shows no other write); SES-20261005-0026's summary still unacknowledged; no reset |
| Ports, locks | 4421 and 8083 free; no reverse rule; lane-1 PID file empty. Lane 2, the tablet, `dems2_phone2`, 5432, 5173-5175, 4400 and lane 3 untouched |

## 12. Error handling and logging

Every `fail` branch writes one persistent runtime-log record (`reportRuntimeIssue`, privacy-filtered): `evidence.archive`
(`archive-dialog.tsx:59`), `evidence.export.authorize` / `.denied` / `.submit` / `.refused`, `evidence.verify.core`
(`use-core-verify.ts:73`), `evidence.mediaRef` (`use-evidence-media-ref.ts:45`, class and status only). User feedback:
the presenter's toast for its kinds (LB-5, LB-6, LB-10), otherwise the site's own toast or Alert; controls return to idle.

## 13. Rollback (R-CO; not executed)

1. Copy the 11 pre-images back from `.cache/rollback/W74/apps_mobile_src_features_evidence_<file>` (SHA-256 in
   `pre.sha256`; all 11 equal `acaff20`), or `git checkout acaff20 -- apps/mobile/src/features/evidence/<file>` for:
   `archive-dialog.tsx evidence-list-screen.tsx evidence-detail.tsx export-sheet.tsx integrity-tab.tsx sim-adapter.ts
   use-evidence-data.ts i18n.ts evidence-model.ts evidence-media.ts play-sheet.tsx`.
2. Remove the 10 new files: `live-integrity-tab.tsx use-clock-due.ts use-core-verify.ts use-evidence-media-ref.ts
   live-evidence-archive.test.tsx live-evidence-export.test.tsx live-evidence-verify.test.tsx live-evidence-strict.test.tsx
   live-evidence-static.test.ts testing/live-evidence-bed.tsx`.
3. Re-run the mobile suite.

## 14. Files

Production (edited): `archive-dialog.tsx`, `evidence-detail.tsx`, `evidence-list-screen.tsx`, `evidence-media.ts`,
`evidence-model.ts`, `export-sheet.tsx`, `i18n.ts`, `integrity-tab.tsx`, `play-sheet.tsx`, `sim-adapter.ts`,
`use-evidence-data.ts`. Production (new): `live-integrity-tab.tsx`, `use-clock-due.ts`, `use-core-verify.ts`,
`use-evidence-media-ref.ts`. Tests (new): `live-evidence-archive.test.tsx`, `live-evidence-export.test.tsx`,
`live-evidence-verify.test.tsx`, `live-evidence-strict.test.tsx`, `live-evidence-static.test.ts`,
`testing/live-evidence-bed.tsx`. Documents: this report, `delegation_progress/coder_execution_step_96.md`,
`implementation/assets/74_*` (18 files). Scratch: `.cache/w74/`, `.cache/rollback/W74/`.

---
*Generated: 2026-10-06 00:12 WIB*

## 15. Device re-run (decision D162)

Granted by the controller (D162, DN-2): one sitting of at most 10 minutes, on the phone and lane 1, with exactly the
steps of DN-2. **The sitting ran from 00:19:04 to 00:22:12 (3 min 8 s), with device-session exit 0 and run exit 0.**
No code was changed: the re-run showed no defect in the folder.

### 15.1 How it was run

| Item | Value |
|---|---|
| Locks and ports | `lockf .locks/core-server.lane1.lock`; `device-session.sh phone`; `METRO_PORT=8083`, `DEMS_CORE_HOST_PORT=4421`, `DEVICE_SESSION_MAX_SECONDS=600`; backend on `dems_lane_1` with no reset; demo controls off |
| Login (no dump) | W60's fixed coordinates (username 540,1105, the coach's Cancel 540,2338, password 540,1265), then the keypad's go key |
| Summary (no dump) | The biometric offer's "Not now" at 540,1443 and the Summary's "Done" at 246,2254, both measured off `74_phone_live_summary_first.png`. "Enable" was never pressed |
| Evidence | Deep link `demsdemo:///evidence/EV-20261005-0014` (the evidence of SES-20261005-0026, recorded in Live mode). `uiautomator dump` ran only on the Evidence screens, with a 20 s limit per dump; none timed out |
| Secrets | The password was typed into the app's own field, read from the dataset constant and never printed. Credential lines in the JS log: 0; in the server log: 0 |
| Scripts | `assets/74_rerun_w74.sh`, `74_rerun_device.sh`, `74_rerun_flow.mts.txt`; log `74_rerun_device_run.log`; server requests `74_rerun_server_requests.log` |

### 15.2 The run, as logged (`assets/74_rerun_device_run.log`)

```
-- 00:19:36 the app's sign-in: POST /api/v1/auth/sign-in 200
-- 00:19:42 tapped the biometric offer's "Not now" (Summary) at 540,1443
-- 00:19:45 tapped the Summary's "Done" at 246,2254
-- 00:19:46 acknowledge: POST /api/v1/session/{id}/summary/acknowledge 204
-- 00:19:49 deep link demsdemo:///evidence/EV-20261005-0014
-- 00:20:15 tapped evidence-tab-integrity at 703,1524
-- 00:20:19 tapped evidence-verify at 914,1709
-- 00:20:40 on screen: evidence-integrity-label, evidence-verdict-PASS
-- 00:20:44 tapped evidence-action-export at 582,2110
-- 00:21:05 on screen: evidence-export-denied
-- 00:21:07 credential/token lines in the JS log (must be 0): 0
-- 00:21:07 demo operations (must be 0): 0; biometric enrolment requests (must be 0): 0
-- LIVE flow exit: 0
...
-- 00:21:56 tapped evidence-row-EV-20261004-0013 at 540,608
-- 00:22:10 on screen: evidence-integrity-label, evidence-verdict-PASS
-- 00:22:11 Core requests in SIMULATED mode (must be 0): 0
-- SIMULATED flow exit: 0
-- prefs after: {"coreLinkSource":"SIMULATED"}
-- remove this row's dump file only: adb shell rm /sdcard/w74.xml
   ls: /sdcard/w74.xml: No such file or directory
device session exit=0
```

The backend's own request log for the sitting:

```
      1 GET /api/v1/auth/session 200 principal=operator
      1 GET /api/v1/auth/session 401 principal=device
      1 GET /api/v1/auth/status 200 principal=device
      1 GET /api/v1/evidence/:id 200 principal=operator
      1 GET /api/v1/health 200 principal=null
      1 GET /api/v1/pairing/device 200 principal=device
      1 POST /api/v1/auth/sign-in 200 principal=device
      1 POST /api/v1/auth/touch 200 principal=operator
      1 POST /api/v1/evidence/:id/export 403 principal=operator
      1 POST /api/v1/evidence/:id/verify 200 principal=operator
      1 POST /api/v1/session/:id/summary/acknowledge 204 principal=operator
-- bearer/cookie/credential lines in the server log (must be 0): 0
```

The script's per-step checks printed "NOT SEEN" for the media reference, the verify request and the export probe. Their
pattern looked for the literal evidence ID, but the app's request log writes path IDs as `{id}`. The same three requests
do appear in the app's request list (`GET /api/v1/evidence/{id} 200`, `POST …/verify 200`, `POST …/export 403`) and in the
backend's list above. This was a flaw in the check, not in the app.

### 15.3 The screencaps (`assets/74_rerun_*.png`, 1080 × 2424)

| File | What it shows |
|---|---|
| `74_rerun_live_login.png` | LIVE Login: "Core online", "Core: DEMS-IR-01 • paired as DEV-0001" |
| `74_rerun_live_after_signin.png` | After the sign-in: the Summary of SES-20261005-0026 with the app's biometric offer on top |
| `74_rerun_live_summary.png` | The offer gone after "Not now"; the Summary (SEALED, LP/2026/1005-0010, GNSS) with Done / View in Evidence |
| `74_rerun_live_detail.png` | Evidence Details of EV-20261005-0014 in LIVE mode, read from the replica (Sealed, Ahmad Fauzi / Tersangka, AKP Budi Santoso, 00:01:39, 227.2 MB) |
| `74_rerun_live_verdict.png` | **The Core's verdict:** Hash & Integrity shows "Verified by the Core", the chip **"Core record"**, "The Core runs the verification and returns the verdict of record; this tablet shows it as it is.", the verdict chip **PASS** "every hash matches the sealed manifest" and "Verify again". The hero shows the room still and no GNSS badge, and the dump listed no `evidence-bundled-*` node: no bundled package was shown for this Live-recorded item (MS-2). The body of the media reference was not captured, so it is not quoted here |
| `74_rerun_live_export_denied.png` | **Site S1-5 settled:** "Export EV-20261005-0014", step 1 Authorize in error, the denied Alert "Your role cannot export — Exporting evidence requires the Supervisor role. This attempt was recorded in the audit log." This follows the Core's 403 (backend log: `POST /api/v1/evidence/:id/export 403`). A debug-build LogBox banner "Open debugger to view warnings." covers the sheet's footer (finding F-9) |
| `74_rerun_simulated_login.png` | The SIMULATED Login after the cold `core=SIMULATED` launch |
| `74_rerun_simulated_list.png` | The SIMULATED Evidence list (6 rows on screen) after the biometric offer was declined by its test ID |
| `74_rerun_simulated_verdict.png` | SIMULATED Hash & Integrity of EV-20261004-0013, unchanged from `acaff20`: chip "DEMO - precomputed", the Simulated note "Integrity is checked on the Core against the sealed package; …", PASS, the toast "Evidence EV-20261004-0013 verified by the Core"; 0 Core requests |

### 15.4 Finding of the re-run

| # | Finding |
|---|---|
| F-9 | The LogBox banner over the export sheet in a debug build comes from the record `evidence.export.denied` at level `warn` (device JS log 00:20:44.388: `source: 'evidence.export.denied', message: 'Export denied by RBAC', context { evidenceId, role: 'INVESTIGATOR', status: 403 }`). Debug builds mirror warnings to LogBox. It is the same record at the same level that the Simulated wizard wrote at `acaff20` (`export-sheet.tsx:114` there), so the banner shows in Simulated debug builds too. Release builds are not affected. Writing an expected denial at level `info` (as `sim-adapter.ts` does for its expected case) would remove the banner in both modes. That changes the Simulated log level, so it is left to the controller and is not changed here |

### 15.5 State left on the phone and in `dems_lane_1` (final)

| Where | State |
|---|---|
| `dems2_phone` | Last launch `core=SIMULATED`; prefs read back `{"coreLinkSource":"SIMULATED"}`; signed in to the simulator as the INVESTIGATOR when the session clean-up force-stopped the app. The biometric offer was declined twice: "Not now" in LIVE and `biometric-offer-decline` in SIMULATED, never "Enable", and no `setBiometricEnrollment` request was made. The dump file `/sdcard/w74.xml` was removed (`ls: … No such file or directory`); nothing else on the phone was touched. Keyguard, PIN and fingerprint untouched; lock status identical before (00:18:56) and after (00:23:21): `phone … isKeyguardShowing=false, CredentialType=PIN, fingerprint count=1` |
| `dems_lane_1` | DEV-0001 kept (`paired_devices 1`, `device_credentials 1` before and after). `audit_log` went from 161 to 169 (8 rows written during the sitting; not itemised here). The writes in the request log were the sign-in, the summary acknowledgement, the verification and the denied export. **The Summary of SES-20261005-0026 is now acknowledged** (`POST …/summary/acknowledge 204`), through the app's own Done, as the controller allowed. EV-20261005-0014 is still SEALED (the detail's chip after the verification). The verification answered PASS, and per `implementation/35_module_evidence.md` §7 the server stores that state with the verification; it was not read back here. No reset |
| Ports, locks, reverse rules | 4421 and 8083 have no listener; `adb reverse --list` on emulator-5554 is empty; Metro stopped by device-session; backend stopped; `.locks/core-server.lane1.pid` emptied. Lane 2, the tablet, `dems2_phone2`, 5432, 5173-5175, 4400 and lane 3 untouched |

---
*Last updated: 2026-10-06 00:25 WIB (device re-run, decision D162)*

