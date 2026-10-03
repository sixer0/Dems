---
task_id: 2026-09-30_dems_demo_stack_setup
task_slug: dems_demo_stack_setup
date: 2026-10-01
agent: coder-execution
step: 78 (blueprint row 78; 05_mobile_plan M-09)
lane: mobile, Metro 8085 (D72)
source_plan: /Users/gsp-budi/Documents/DEMS/docs/2026-09-30_dems_demo_stack_setup/identification/02_structured.md (row 78)
narrative_tier: 3
status: completed (fast lane D75; tablet device check deferred to the end pass)
---

# Step 78: mobile Start New Session (M-09)

## 1. Outcome

**Status: complete under the fast lane (D75).** The Start New Session flow runs end to end on dems_phone. Typecheck, lint and step 78's own tests pass. The tablet device check moves to the end pass.

The flow: Session Info, then Devices Check (the §5.3 gate), then Ready (ARMED), then Start Recording, which hands off to step 79's live monitor.

| Row-78 acceptance | Result | Evidence |
|---|---|---|
| T-M10 passes | **PASS**: 4 cases (PASS, WARN + acknowledgement, BLOCK Storage FULL, BLOCK Core offline). A mutation check makes 3 of 4 fail | §4.2 |
| MA-29 steps 1–3 on dems_phone | **PASS**. Form, scan, Next, then 8 checks in **3.9 s** (each 301–669 ms, ≤ 5 s), ARMED, Ready. Start, then 3-2-1, then RECORDING on `/session/live` with no "session active" toast | §5.2 |
| MA-30 step-2 part | **PASS**. Storage FULL gives BLOCK with "Storage (FULL)"; MIC 2 clip gives WARN, and acknowledging it arms | §5.1 |
| MA-11 MB 3 checklist | **Met** on 1080×2424; checklist in §5.3 | `78_dems_phone_fast_step1_filled.png` |
| Mobile typecheck, lint | **exit 0** (whole app) | §4.1 |
| Mobile jest | Step-78 suites **59/59 pass**. The full run is **671/681**: the 10 failures are all step-70 tests that assert placeholder `stub-param-*` testIDs, which go away when real screens replace the stubs. 6 are session-new's, 4 belong to steps 83 and 80 (§4.1, H-78-1) | §4.1 |
| F74-03 hand-over (D73) | **Done.** `SubjectTypeChip` accepts the simulator codes and the old display terms; labels come from shared `common.subjectType*`; `kit.test.tsx` 16/16 | §3.4 |

## 2. Files

All paths are under `apps/mobile/src/`. Step 78 wrote only its P6 paths plus the one D73 hand-over.

| Path | Kind | Content |
|---|---|---|
| `features/session-new/session-new-screen.tsx` | screen (replaces the step-70 stub; export, props and `SafeScreen id="session-new"` kept) | The flow: step derivation from the session state, the per-class layouts (§2.4), stepper, footer (Next / Start Recording), §3.6 guards, 3-2-1 countdown, the synchronous hand-off to `/session/live` |
| `features/session-new/session-info-step.tsx` | step 1 | MB 3 form: Case Number + simulated Scan, Subject Type `TagGroup` (TERSANGKA red / SAKSI info / LAINNYA neutral, long-press gloss), Subject Name, Investigator `Select` with `SearchField` (bottom sheet on phones, popover on tablets), Room, Recording Profile, Notes; create-error `Alert` |
| `features/session-new/devices-check-step.tsx` | step 2 | The §5.3 gate: 8 `ListGroup` rows (icon, title, live value, Spinner → PASS/WARN/BLOCK chip with one escalation pulse), BLOCK `Alert` with reasons, WARN `Alert` + "Acknowledge warnings" `Checkbox`, "Run checks again", progress "n of 8 checked", gate haptics |
| `features/session-new/ready-step.tsx` | step 3 | ARMED summary (`SectionCard` + `KeyValueList` + `SubjectTypeChip`), mini `GlowRing` (120 dp), "3-2-1 countdown" `Switch`; `CountdownOverlay` |
| `features/session-new/device-previews.tsx` | previews | `CameraFeed` ×2 + `DbfsMeter` ×2 (runtime shared values), "Speak to test (simulated)"; phones play one camera live (poster + tap to swap); tablet-landscape `LiveDeviceColumn` with the live §5.3 evaluation list |
| `features/session-new/session-new-header.tsx` | header | Back arrow, title, the "Load last session profile" `Menu` (Start with last profile, Clear form) on step 1 |
| `features/session-new/flow-guard.tsx` | guard | `useFlowBackPrompt` (root case: hardware Back with nothing to pop asks first, then Home) and the `DiscardDialog` (shared `sessionNew.cancelDialog`) |
| `features/session-new/session-new-model.ts` | pure rules | `effectiveStep`, gate phase, `canLeaveGate`, stepper statuses, arrangements, form defaults, last-profile values, value keys, flat evaluation encoding, countdown constants |
| `features/session-new/use-session-new.ts` | hooks | Flat simulator reads (F74-13), the form (react-hook-form + `zodResolver(sessionCreateSchema)`, `mode: 'onChange'`), actions with error handling (`useFlowActions`) |
| `features/session-new/sim-adapter.ts` | SIM-GAP-1 | Next synthetic case number (`LP/{YYYY}/{MMDD}-NNNN`) from the simulator's own data |
| `features/session-new/step-boundary.tsx` | error boundary | Per-region fallback card, persistent log, rate-limited retry (3 s / 6 s / 12 s, max 3) |
| `features/session-new/check-icon.tsx` | icon map | Lucide icon per check, tone-coloured |
| `features/session-new/use-sheet-presence.tsx` | copy (D78) | Step 79's mount-on-demand for kit sheets/popovers, used by the Selects |
| `features/session-new/i18n.ts` | copy | `features.session-new.*` (only what the shared `sessionNew.*` / `common.*` lack) |
| `features/session-new/precheck.test.tsx` | **T-M10** | PASS / WARN + acknowledgement / BLOCK (Storage FULL, Core offline) on the real simulator with fake time |
| `features/session-new/session-new-screen.test.tsx` | screen tests | MB 3 regions, validation, scan, investigator Select, create → precheck, TECHNICIAN refusal, CREATE resume, ARMED summary, hand-off (with and without 3-2-1, no busy toast), guard dialogs, root Back, tablet panes |
| `features/session-new/session-new-model.test.ts` | unit tests | The rules above and SIM-GAP-1 |
| `features/session-new/testing/session-new-harness.tsx`, `testing/session-new-test-setup.ts` | test-only | Router harness around the real `/session/new` route; gorhom mock (step 79 precedent) |
| `components/kit/subject-type-chip.tsx` | **hand-over D73 (F74-03)** | Accepts simulator codes `TERSANGKA/SAKSI/LAINNYA` and the old display terms; label and gloss from shared `common.subjectType*`; type-only simulator import |
| `components/kit/kit.test.tsx` | edited (allowed by D73) | 4 cases for the simulator codes |

Not written: `packages/shared/**`, `src/app/**`, `src/navigation/**`, `src/runtime/**`, `src/motion/**`, `src/i18n/features.ts`, any `package.json`, jest config, `delegation_progress_report.md`, `status_tasks.md`, `masterplan/02_plan.md`. No npm install, no commit.

## 3. Behaviour

### 3.1 The flow and its source of truth

| Step | Shown when (`effectiveStep`) | Next / action | Simulator |
|---|---|---|---|
| 1 Session Info | no session, SEALED, CREATE | Next (disabled until `sessionCreateSchema` validates) | `createSession(input)` → CREATE, then `beginPrecheck()` → PRECHECK (audit SESSION_CREATED) |
| 2 Devices Check | PRECHECK; ARMED with `?step=2` | Next: PASS or ARMED → step 3; WARN → `acknowledgePrecheckWarnings()` once ticked; BLOCK → disabled, "Run checks again" (`retryPrecheck`) | The simulator runs the 8 checks (seeded 300–700 ms each, ≤ 4.9 s); PASS arms by itself (PRECHECK_PASSED) |
| 3 Ready | ARMED (default) | Start Recording (3-2-1 by default, `Switch`) | `startRecording()` → RECORDING (RECORDING_STARTED) |

- The step follows the session state from the runtime contract (`useActiveSession`), the same source the shell's resync and deep-link policies use (§3.5, §3.7). The details come from the simulator.
- `?step=` is kept equal to the step shown, through the screen's own `navigation.setParams`. `router.setParams` asserts that the root is ready, which it is not while a deep-linked first screen runs its effects.
- A CREATE session left over from a relaunch is prefilled. If the operator edits it, it is cancelled and created again, since it has no checks or recording yet.
- **The hand-off.** `startRecording()` and a synchronous `navigation.dispatch(StackActions.replace('live'))` run together, in an effect one commit after the back guard turns off.
  - `router.replace` would not work here: expo-router only *enqueues* it (its routing queue drains one commit later).
  - In that gap the wizard route renders RECORDING and refuses itself with the shell's "A session is already active" toast. Jest caught this; the queued variant fails both hand-off tests (§4.2).
  - `replace` means Back from the monitor never returns to ARMED.

### 3.2 Layouts (04 §2.4)

| Class | Layout |
|---|---|
| compact (phone portrait) | MB 3: header, horizontal stepper, one step, gold button pinned at the bottom; step 2 previews above the list (one camera live, S78-6) |
| compact-landscape | Stepper on top; form in 2 columns; Ready ring beside the summary |
| medium (tablet portrait) | `pane-stepper` (vertical, 240 dp) \| `pane-content`; step 2 previews in the content (both live) |
| expanded (tablet landscape) | `pane-stepper` \| `pane-content` \| `pane-devices` (340 dp): previews, meters and, on steps 1 and 3, the eight §5.3 checks evaluated live (the brief's "live device check column") |

### 3.3 Leaving (§3.6) and errors

- **Guards.**
  - Step 1 with typed details: "Discard this session?" (shared copy).
  - A session in CREATE, PRECHECK or ARMED: step 70's `BackGuardDialog variant="flow"`, then `cancel()` (SESSION_CANCELLED), then the app leaves.
  - When Start Session is the only screen (deep link or resync), hardware Back asks first and then goes Home instead of closing the app (the F-79-1 pattern).
  - The guard turns off for the launch commit only.
- **Errors.** Every action is wrapped in three layers:
  - a toast with plain copy;
  - the persistent runtime log (`dems.mobile.log.v1`) with only the state and session id, never form values;
  - the screen stays usable.
  - Create refusals (NOT_PERMITTED, INVALID_INPUT, SESSION_ACTIVE, NOT_SIGNED_IN) show an inline `Alert`.
  - Each region sits in a `StepBoundary` with a rate-limited retry (3, 6, then 12 s; at most 3 retries).

### 3.4 Hand-over F74-03 (D73): `SubjectTypeChip`

- `type` accepts `TERSANGKA` / `SAKSI` / `LAINNYA` (the simulator's `SubjectType`) or the earlier `Tersangka` / `Saksi` / `Lainnya`. Normalisation is case-insensitive, and unknown values map to LAINNYA.
- The label is `t('common.subjectType.<CODE>')` and the `accessibilityHint` is `t('common.subjectTypeGloss.<CODE>')`. Tone is TERSANGKA danger, SAKSI info, LAINNYA default.
- The simulator import is type-only. New exports from the file: `SUBJECT_TYPE_CODES`, `SubjectTypeCode`, `SubjectTypeInput`, `SubjectTypeCodeTone`, `toSubjectTypeCode`. The kit barrel is unchanged.
- **Existing callers are unaffected.** The dashboard still passes display terms. Steps 80, 82 and 83 can pass simulator codes directly.
- **Test.** `kit.test.tsx` has 4 new cases (3 codes plus tone and normalisation): 16/16 pass.

### 3.5 Motion, haptics, i18n

- **Motion (03M M-PG-NEW).**
  - Stepper badges stagger.
  - Step content enters from the direction of travel (x ±24, `gentle`).
  - Fields rise 30 ms apart.
  - Checks resolve in sequence: Spinner, then a chip, with one escalation pulse for WARN/BLOCK (`animatePulseOnce(…, SPEC_LITERALS.escalationPulseMs)`, passed explicitly per F74-02).
  - The Ready ring sweep is the hero moment.
  - 3-2-1: each digit scales 1.1 → 1 over 600 ms, one second apart.
  - Reduced motion: fades only, no pulse; the digits change without scaling.
- **Haptics** all go through step 69's service:
  - Next, Retry and Back-to-checks: `primaryPress` / `stepperSelect`;
  - the subject tags and camera swap: `segmentSelect`;
  - the switch and checkbox: `switchToggle`;
  - gate WARN: `gateWarn`; gate BLOCK: `gateBlock`;
  - Start: `recordStart`;
  - the simulated scan: `verifyPass` (a success-kind event; the map has no scan event; S78-8).
- **i18n.** Copy comes from the shared `sessionNew.*`, `common.*` and `mobile.backGuard.*`, plus `features.session-new.*` for mobile-only strings. 0 missing keys across the three steps (asserted in the tests). MA-21 grep clean.

## 4. Verification (JS)

### 4.1 Gates (09:20–09:23 WIB, after the last code change)

| Check | Command | Result |
|---|---|---|
| Typecheck | `npm run typecheck -w @dems/mobile` | **exit 0** (0 `error TS`, whole app) |
| Lint | `npm run lint -w @dems/mobile` | **exit 0** |
| Step-78 suites | `npx jest --maxWorkers=2 src/features/session-new src/components/kit` | **4 suites, 59 tests pass** |
| Full jest | `npx jest --maxWorkers=2 --forceExit` | 54 suites: 52 pass. **671 / 681 tests**. All 10 failures are `Unable to find an element with testID: stub-param-*` in step 70's `routes.test.tsx` and `guard.test.tsx`: 6 `stub-param-step` (session-new, this step), 4 `stub-param-selectedId/evidenceId/sessionId` (steps 83, 80). See H-78-1 |

**H-78-1, a request for step 57 or the controller.** `guard.test.tsx:77` and `:172` and `routes.test.tsx:42` and `:103` assert the session-new stub's param readout. Pointing them at the real screen's `session-new-step-<n>` testIDs makes every session-new case pass:
- the wizard routes by the runtime contract, so step 70's `FakeRuntime` drives it;
- a temporary copy of `guard.test.tsx` with the 2 assertions changed passed all its session-new cases (17/18; the one remaining failure is step 83's evidence stub).

Step 78 does not own those files (P6).

### 4.2 Step-78 tests and mutation checks

| Test | File | Cases | Proves |
|---|---|---|---|
| **T-M10** | `precheck.test.tsx` | 4 | Rows in book order; first check RUNNING with a Spinner; seeded durations 300–700 ms, total ≤ 4.9 s; resolution in sequence ("1 of 8", then "8 of 8"); PASS arms with PRECHECK_PASSED, then Next → step 3. WARN (MIC 2 NO SIGNAL): warning Alert, Next disabled until acknowledged, then ARMED with `{warnings: 1, acknowledged: true}`. BLOCK: Storage FULL ("Storage (FULL)", PRECHECK_BLOCKED, Next disabled; fix + "Run checks again" → ARMED) and Core link offline ("Core Machine (OFFLINE)"). 0 missing keys |
| Screen | `session-new-screen.test.tsx` | 16 | MB 3 regions and defaults; zod messages and Next enablement; scan → `LP/2026/1001-0008`; investigator Select (sheet, search, pick Andi → OPR-002); long-press gloss; create normalises input → PRECHECK, `?step=2`; TECHNICIAN refused with the Alert; deep link with a stale `?step=3` → step 1, param corrected; CREATE resume prefilled; ARMED summary; hand-off without countdown (RECORDING, `/session/live`, no busy toast, Back → Home) and with 3-2-1 (Cancel; 3 → 2 → 1 → RECORDING); control case showing the busy toast does render in jest; flow dialog cancel (SESSION_CANCELLED → Home); discard dialog; root hardware Back asks; tablet panes (landscape 3 panes + 8 live checks; portrait 2 panes, previews in content) |
| Model | `session-new-model.test.ts` | 23 | `effectiveStep` table, gate phases, `canLeaveGate`, stepper statuses, arrangements, eligibility and defaults, search, last profile, value keys, flat encoding, SIM-GAP-1 (0008 on the dataset; 0009 once 0008 is in use) |
| Kit | `kit.test.tsx` | 16 (4 new) | F74-03 |

**Mutation checks.** Each mutant was swapped in through a temporary jest `moduleNameMapper` config in scratch, so no live source changed. The mutant copies were deleted afterwards.

| Mutant | Result |
|---|---|
| Hand-off through the queued `router.replace` | both hand-off tests **fail** (busy toast) |
| `canLeaveGate` lets WARN/BLOCK through | WARN, BLOCK and Core-offline **fail** (3/4); PASS unaffected |

### 4.3 Static checks

| AC | Command | Result |
|---|---|---|
| MA-22 | `grep -rnoE "#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?"` over `features/session-new` and `subject-type-chip.tsx` | no match |
| MA-21 | `grep -rnE "Tersangka\|Saksi\|Lainnya" apps/mobile/src/features/session-new` | no match (terms come from i18n keys) |
| MA-20 | `grep -rn "Haptics\." apps/mobile/src/features/session-new` | no match |
| MA-25 | URL grep over the feature | no match |
| MA-16 | `grep -rn "useAudioChannel"` over the feature | no match (meters use the runtime's shared values) |
| MA-28 | `grep -rn "@dems/shared/sim"` over the feature | 13 importers; nothing written under `packages/shared` |

## 5. Verification on dems_phone (portrait, Metro 8085, `device-session.sh`, D55/D78)

Every session went through `METRO_PORT=8085 apps/mobile/scripts/device-session.sh phone '…'`, outside the sandbox (P10). The helper force-stopped the app first and stopped Metro and its reverse rules at the end. Deep links were quoted inside `adb shell` (D68).

The procedure:
- sign-in through the dev-only `__DEMS_DEBUG__` handle using the published demo operator credentials, read from the project's simulator dataset (never written to logs or docs);
- state read through the Hermes inspector (`cdp.mjs`, loopback Origin);
- the simulator reset to `loadScenario('idle')` before and after each run, so no session was left in the shared AVD's `dems.sim.v1`.

No emulator was stopped or rebooted (D78).

### 5.1 Run 1 (06:27–06:34, `?motion=off`): step 1, BLOCK, cancel, WARN

| Check | Result | Screencap |
|---|---|---|
| Step 1 empty and filled (scan → `LP/2026/1001-0008`, Tersangka, "Ahmad Fauzi") | MB 3 match | `78_dems_phone_step1_empty.png`, `78_dems_phone_step1_filled.png` |
| MA-30: Storage FULL injected while idle → new session → step 2 | **BLOCK**: "Recording is blocked. Resolve these checks before continuing: Storage (FULL)."; Next disabled; simulator `{state: PRECHECK, outcome: BLOCK}` | `78_dems_phone_step2_block_storage_full.png` |
| Hardware Back on step 2 | "Cancel this session?" (Keep / Cancel); Cancel session → simulator session `null` | `78_dems_phone_cancel_dialog.png` |
| MIC 2 clip → step 2 | **WARN**: "Warnings to review" + Acknowledge; ticked → Next → ARMED; Ready shows "Ready, 1 warning acknowledged" (LAINNYA chip) | `78_dems_phone_step2_warn.png`, `…_warn_acknowledged.png`, `78_dems_phone_step3_ready_warn.png` |
| The happy path in this run | The UI thread **stalled ~13 s** while step 2 mounted two live videos (S78-6) | `78_dems_phone_run1_stall_step2.png`, `78_dems_phone_run1_step2_pass_late.png` |

### 5.2 The fast-lane check (09:17–09:18, full motion, current code except §6 items S78-9 and S78-7b)

Bundle: `Android Bundled 827ms … (5523 modules)`.

| Time | Action | Result | Screencap |
|---|---|---|---|
| 09:17:41 | `/session/new?step=1` | MB 3 step 1; investigator defaults to AKP Budi Santoso | `78_dems_phone_fast_step1_empty.png` |
| 09:17:44 | Investigator trigger | Bottom sheet slides in (mount-on-demand, F-79-2) with search, Budi ✓, Andi | `78_dems_phone_fast_step1_investigator_sheet.png` |
| 09:17:55 | Scan, Tersangka, name | Filled; Next enabled | `78_dems_phone_fast_step1_filled.png` |
| 09:17:57 | Next | Step 2: CAM 1 live, CAM 2 poster; checks resolving ("3 of 8", Spinner on Lens 2, MIC 1 "Checking…") | `78_dems_phone_fast_step2_running.png` |
| +2 s | (simulator) | **ARMED**, outcome PASS, gate **3,900 ms**, durations `[301, 434, 665, 378, 507, 619, 669, 327]`; audit `… SESSION_CREATED, PRECHECK_PASSED`; input `{LP/2026/1001-0008, TERSANGKA, OPR-001}` | `78_dems_phone_fast_step2_pass.png` ("8 of 8", "All checks passed", both meters live) |
| 09:18:05 | Next | Ready: mini ring, summary, 3-2-1 on | `78_dems_phone_fast_step3_ready.png` |
| 09:18:07 | Start Recording | Countdown overlay "2 — Recording starts in 2", Cancel | `78_dems_phone_fast_countdown.png` |
| +2 s | (simulator) | **RECORDING**; audit `… PRECHECK_PASSED, RECORDING_STARTED` | — |
| 09:18:11 / :14 | — | Step 79's monitor "Active Session SES-20261001-0024", REC 00:00:01, then 00:00:04; **no "session active" toast** | `78_dems_phone_fast_live_handoff.png`, `…_2.png` |

- **Logs.** 0 JS error lines (`ReactNativeJS:E`, `AndroidRuntime:E`). HWUI "Davey" only at 09:17:22, during app launch and before this screen (1.3 s). 534 Reanimated `synchronouslyUpdateUIProps failed` warnings were logged (S78-7).
- **Process hygiene (P7).** After the runs, nothing listens on 8085 and no `s78` process is left. My reverse rules are gone; the remaining `tcp:8081 → 8086` on the phone belongs to another lane. Emulator PIDs are unchanged (95964, 92922).

### 5.3 MA-11 MB 3 checklist (`78_dems_phone_fast_step1_filled.png`, 1080×2424)

| MB 3 region, in order | Present |
|---|---|
| Header: back arrow, "Start New Session", right icon | ✓ (icon read as "Load last session profile" → Menu) |
| Stepper 1 Session Info · 2 Devices Check · 3 Ready, gold lead-in | ✓ |
| Card "Session Information" | ✓ |
| Case Number with the scan icon | ✓ (scan fills `LP/2026/1001-0008`) |
| Subject Type: Tersangka (red) / Saksi / Lainnya | ✓ |
| Subject Name | ✓ |
| Investigator with the search icon, signed-in operator | ✓ |
| Room / Location | ✓ (Select chevron) |
| Notes (Optional) | ✓ (below Recording Profile) |
| Gold "Next →", dark label, pinned | ✓ |

Recorded differences:
- Recording Profile is added (04 §4.4, web parity).
- The sample values in MB 3 ("LP/123/2025", the name) are placeholders in the app; the mockup's case value does not match D62's format.
- The right icon is Lucide `FolderDown`.

### 5.4 Tablet

- Moved to the end pass (D75). What was seen in passing on dems_tablet: the three panes (`pane-stepper`, `pane-content`, `pane-devices`, uiautomator) with both cameras live and the live check list. The Discard dialog also rendered over a typed form (`78_dems_tablet_landscape_discard_dialog.png`; the run script's IME-hide BACK opened it).
- **For the end pass on that AVD:** Gboard's one-time "Try out your stylus" onboarding captures typed text. Dismiss it (Cancel) before typing. The hardware keyboard means no IME to hide.

## 6. Decisions, drift and findings

| ID | Type | Item | Resolution |
|---|---|---|---|
| S78-1 | SIM-GAP-1 | No "next case number" selector; `meta.counters.caseNumber` never advances | Local `sim-adapter.ts`: `max(counter, 1 + highest NNNN in the active session and the history)` with the simulator's `caseNumberFor`. Proposed for step 91: `selectNextCaseNumber` |
| S78-2 | finding (expo-router) | `router.replace` enqueues; it is dispatched one commit later | Synchronous `StackActions.replace` next to `startRecording()`. Relevant to every screen that changes the session state and navigates in one action (steps 79 and 80) |
| S78-3 | design | The wizard routes by `useActiveSession().state` (runtime contract) rather than a direct simulator read | Same source as the shell; step 70's `FakeRuntime` tests can drive it (H-78-1) |
| S78-4 | interpretation | "Start with last profile" copies case, investigator, room and profile of the newest session (a follow-up interview); subject, subject type and notes stay empty | Hypothesis, as the spec marks the icon |
| S78-5 | drift (spec) | 04 §4.4 asks for a long-press `Popover` with the EN gloss | Inline gloss line under the tags (3 s) plus `accessibilityHint`: no extra portal on a form |
| S78-6 | finding (device) and decision | Two concurrent H.264 decodes to texture views on dems_phone stalled the UI thread (HWUI `Davey! duration=13290ms`, `C2BqBuffer` dequeue failures) | Phones play one camera live, the other shows its bundled poster (tap to swap), within the 04 §7.8 compact budget. Tablets play both. Under the D43 switch both are posters (step 77 precedent) |
| S78-7 | finding (step 71 component, device only) | Stepper badges lost their glyph after a status change (done check, new active number); Reanimated logs `synchronouslyUpdateUIProps failed … Unable to find SurfaceMountingManager` | The Stepper is keyed by its statuses: each change remounts with final glyphs (the first-mount path renders correctly on device). The run-1 and fast-lane screencaps predate this. **For step 71:** apply a glyph's first state without a UI-thread update |
| S78-7b | note | The S78-7 remount and S78-9 changed after the one fast-lane device check | Verified in jest (59/59); device confirmation in the end pass |
| S78-8 | gap (step 69 map) | No haptic event for the simulated scan | `verifyPass` (the same success kind). Request: a `caseScan` event |
| S78-9 | fix | `router.setParams` threw "Attempted to navigate before mounting the Root Layout" for a deep-linked first screen whose `?step=` disagreed with the state (found by step 70's `routes.test`) | The screen's `navigation.setParams` (no root assertion), with try and log; jest case added |
| S78-10 | P11 | Earlier full runs saw step 75's `login.test` time out under load, and step 83's evidence tests typecheck errors | Absent in the final run |
| H-78-1 | request | Step 70's stub-param assertions for session-new | §4.1 |
| D73 / D78 | relays applied | F74-03 (§3.4); F74-13 (flat selectors: primitives, stable slices, string arrays); F74-02 (explicit `totalMs`); copied `use-sheet-presence` (no cross-feature import); no emulator restarts | Done |

## 7. Persistent issues

| Issue | Attempts | Root cause | Status | Blocking? |
|---|---|---|---|---|
| Full jest not exit 0 | — | Step 70's stub-param assertions (6 session-new, 4 from steps 80 and 83) once real screens replace the stubs | Needs the step-57 or controller update (H-78-1) | No for step 78's own gates |
| Tablet device check | 2 runs blocked by AVD environment (IME BACK, Gboard stylus onboarding) | Environment, not the app | Deferred to the end pass (D75) | No |

## 8. Next steps

- **End pass, dems_tablet:** landscape 3 panes through the full flow, portrait 2 panes, and the hand-off. Dismiss the stylus onboarding first.
- **End pass, both AVDs:** confirm S78-7 (stepper glyphs) and S78-9.
- **Step 57:** update the stub-param assertions (H-78-1).
- **Step 71:** stepper glyph fix (S78-7).
- **Step 69:** `caseScan` haptic event (S78-8).
- **Step 91:** `selectNextCaseNumber` (SIM-GAP-1).

---
*Generated: 2026-10-01 06:00 WIB*
*Last Updated: 2026-10-01 09:25 WIB*

