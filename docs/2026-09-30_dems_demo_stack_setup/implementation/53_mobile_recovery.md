---
task_id: 2026-09-30_dems_demo_stack_setup
step: 81
row: 05_mobile_plan M-11 part b
date: 2026-10-01
agent: coder-execution (mobile lane C, Metro 8083)
tier: 3
lane: FAST LANE (D75)
status: completed
---

# Step 81: mobile Recovery Status screen (04_mobile_specs §4.8; T16; book §6.4 item 5, §18.1)

## 1. What was built

The `/session/recovery` screen replaces step 70's stub. The export name and the `SafeScreen id="session-recovery"` root are unchanged. The runtime's route sync opens the screen when a critical fault moves the session to FAULT.

| Phase | What the screen shows |
|---|---|
| FAULT | <ul><li>A danger Alert names the fault and the time recording stopped. It plays ONE glow pulse, then holds a steady colour (P7). `animatePulseOnce` gets `totalMs` explicitly (F74-02).</li><li>A mini GlowRing in the `critical` state.</li><li>The C-4 Stepper pipeline, every step waiting.</li><li>A "Start recovery" button, gated by role: SESSION_START, see SIM-GAP-M81-2. A refused role gets the SimPermissionError toast and a hint line.</li><li>"Go to Home".</li><li>One `criticalFault` haptic per session.</li></ul> |
| RECOVERY (the simulator's 3 s, on the sim clock) | <ul><li>The pipeline runs five checks inside the two §18.1 stages, in this order: recovery marker, track integrity, last good segment, time-source continuity, incomplete-session analysis.</li><li>The stage line reads "Recovery scan · stage 1 of 2", then "…stage 2 of 2".</li><li>The VIDEO-01, VIDEO-02, AUDIO-01 and AUDIO-02 rows resolve one by one: Spinner, then the chip (INTACT, GAP, FLAGGED or NO MEDIA) and a short line.</li><li>Steps with a finding turn `warn`: one halo pulse, then steady amber.</li><li>The ring moves to `attention` (colour only).</li><li>Back is consumed with a calm toast.</li></ul> |
| Outcome | <ul><li>INCOMPLETE: amber chip and the shared line "Session marked INCOMPLETE. It will never be sealed (SYS-008)."</li><li>The details: evidence item (recorded, unsealed), recorded length and size.</li><li>"Acknowledge" marks the fault's alert as seen, settles the ring on READY (600 ms of sim time), then opens Home.</li><li>"View evidence item" checks EVIDENCE_VIEW, then pushes `/evidence/<id>`.</li><li>A RECOVERED · SEALED variant with the recovery signature is ready, but only for SIM-GAP-M81-1.</li></ul> |
| Other / idle | A notice card with a way out: "Return to the session" (through `sessionResyncHref`) or "Go to Home" |

**Layout (04 §2.4):**
- Phone: centred cards. The details card (tracks, case, subject, room, interrupted at/during, last good segment, time source) sits below the main card.
- Tablet landscape (`expanded`): two panes, a 720 dp card beside a 360 dp details pane (`pane-recovery` | `pane-recovery-details`).
- `compact-landscape`: a single column, at most 560 dp wide.
- `medium`: a single column, at most 640 dp wide.

**Error handling, three layers:**
- `RecoveryBoundary` around each region: a message card and a rate-limited retry (3, 6, then 12 s; at most 3 tries).
- Every navigation, action or permission failure writes to the persistent runtime log (`reportRuntimeIssue`, `dems.mobile.log.v1`).
- Toasts tell the user what happened, following the D61 contract.

## 2. Files (all under `apps/mobile/src/features/session-recovery/`, P6)

| File | Change |
|---|---|
| `session-recovery-screen.tsx` | replaced the stub: screen, back handling, cards, fault Alert pulse |
| `recovery.model.ts` | new: pure phase, milestones, pipeline statuses, track/segment/time findings, outcome, ring state |
| `use-recovery.ts` | new: flat `useSim` selectors, the followed-session latch, milestone, outcome, role, actions with the D61 toasts |
| `recovery-analysis.tsx` | new: the Stepper pipeline and the track rows |
| `recovery-boundary.tsx` | new: the region error boundary |
| `sim-adapter.ts` | new: SIM-GAP-M81-1..4, `startRecovery` (role check), `recoverySignatureOf` |
| `i18n.ts` | filled: `features.session-recovery.*` |
| `recovery.model.test.ts`, `session-recovery-screen.test.tsx` | new: 14 + 12 tests |
| `testing/recovery-harness.tsx`, `testing/recovery-test-setup.ts` | new: test-only harness (real route, real providers, test sim, real `SessionRouteSync`) and the gorhom mock |

Nothing outside the folder was edited.

## 3. Verification (FAST LANE, D75)

| Check | Command | Result |
|---|---|---|
| Own jest | `npx jest --maxWorkers=2 src/features/session-recovery` | **exit 0: 2 suites, 26 tests passed.** <ul><li>The screen test drives FAULT → RECOVERY → INCOMPLETE and checks each state: stage line, step labels, track chips, the outcome line, evidence RECORDED, route stays `/session/recovery`.</li><li>Other tests cover role gating, the pre-recording fault, Back, the route sync from the monitor, notices, the tablet panes and the SIM-GAP-M81-1 rendering.</li><li>No missing i18n keys.</li></ul> |
| Lint | `npx eslint .` (whole app) and `npx eslint src/features/session-recovery` | **exit 0** both |
| Typecheck | `npx tsc --noEmit -p .` (whole app) | exit 2, **0 errors in this folder**. The only error is in `packages/shared/src/sim/actions.ts(109,3)`: another lane is extending `SimActions` (`scanCaseNumber`, `exportLogs`, `resetDemo`, `restartServices`…). An earlier run had a single error in `features/storage/capacity-ring.tsx` (step 85's folder) that is now gone. Neither is step 81's |
| T-M02 | `npx jest src/navigation/__tests__/routes.test.tsx -t "session/recovery"` | `/session/recovery renders screen-<id>` passes. The full file has 10 failures elsewhere: stub-param assertions on screens other steps replaced. They were there before this step (step 57 owns T-M02) |
| Static | MA-22 hex grep, `Haptics.`, Tersangka/Saksi/Lainnya, `useAudioChannel`, `onSize`, `Date.now`/`setTimeout` on the folder | no match |

### Device check: dems_phone portrait (one check, lane 8083)

Run through `METRO_PORT=8083 apps/mobile/scripts/device-session.sh phone …`, outside the sandbox (P10). The helper force-stopped the app first. Emulators were neither killed nor rebooted (D78). The step-72 APK was already installed (`lastUpdateTime=2026-10-01 06:07:21`). One read-only `adb devices` call ran inside the sandbox by mistake. It tried to start a second adb server, which failed ("ADB server didn't ACK"). Nothing on the host server or the emulators changed: both still listed as `device` from outside the sandbox.

Steps:
1. Deep link `'demsdemo:///session/recovery?motion=off&scenario=fault-demo'`.
2. Sign-in through the simulator's biometric action (`OPR-001`, via `__DEMS_DEBUG__`).
3. `inject("POWER_FAIL")` via `__DEMS_DEBUG__` (SIM-GAP-M81-4). The route sync opened the recovery screen.

| Moment | Evidence |
|---|---|
| FAULT | [02 fault top](assets/mobile/81_dems_phone_02_fault_top.png), [03 details](assets/mobile/81_dems_phone_03_fault_details.png). State FAULT from RECORDING. `uiautomator` ids include `screen-session-recovery`, `recovery-fault`, `recovery-pipeline-step-0..4`, `recovery-start` and `recovery-track-*` |
| RECOVERY | [04 step 1 running](assets/mobile/81_dems_phone_04_analysing.png); [04b at 605 ms: scan done, Track integrity running, VIDEO-01 checking](assets/mobile/81_dems_phone_04b_analysing.png). Stage RECOVERY_SCAN |
| Outcome | [05 outcome top](assets/mobile/81_dems_phone_05_outcome_top.png): steps 2 and 4 amber ("2 tracks need attention", "GNSS → NTP at 09:40:51"); last good segment "Ends 09:41:19 · 00:18:30 of media"; INCOMPLETE. [06 outcome card](assets/mobile/81_dems_phone_06_outcome_card.png), [07 details](assets/mobile/81_dems_phone_07_outcome_details.png): VIDEO-02 GAP from 09:39:56, AUDIO-02 FLAGGED from 09:40:31, the other two INTACT. Simulator: `session: null`, history `SES-20261001-0024` INCOMPLETE, `EV-20261001-0014` RECORDED. Audit tail `RECOVERY_STARTED, FAULT_CLEARED, SESSION_INCOMPLETE, RECOVERY_COMPLETED` |
| Acknowledge | [08 Home](assets/mobile/81_dems_phone_08_after_acknowledge.png): `screen-home`. The POWER_FAIL alert is `{ack: true}`. The runtime log ends with `info features.sessionRecovery.acknowledge`. Crash buffer: 0 lines |

The first run's frame 04 was captured before the re-render. A 30-second re-capture at 09:53–09:54 replaced it and added 04b. Driver scripts: `drive81.sh` and `drive81b.sh` in the session scratchpad.

## 4. SIM-GAPs (bridged in `sim-adapter.ts`; owner: step 91)

| ID | Gap | Bridge / proposed closure |
|---|---|---|
| SIM-GAP-M81-1 | `recover()` always ends INCOMPLETE (S32-8; SYS-008), so there is no RECOVERED → sealed outcome | The screen maps a history entry with outcome SEALED to RECOVERED and shows the signature (proven in jest by writing that state). The simulator never produces it. Closure: a sealing recovery path with a `recovery` flag on the entry |
| SIM-GAP-M81-2 | `recover()` has no role check | `startRecovery` checks SESSION_START (Investigator, Supervisor) and throws `SimPermissionError('recover', 'SESSION_START')`. Closure: the same check inside the simulator |
| SIM-GAP-M81-3 | `RecoverySlice` has only the two stages and their times: no per-check findings or timing | Findings are derived from the state at the interruption: the fault flags `faults.active`, the session timeline AUTOSAVE, and GNSS_LOSS. The five checks are paced at fixed milestones inside the 3 s (0.5, 0.75, 1.0, 1.25, 1.5, 2.0, 2.5, 3.0 s). Closure: `findings` on `RecoverySlice` |
| SIM-GAP-M81-4 | No FAULT or RECOVERY scenario: `fault-demo` stays RECORDING | Device check: `fault-demo` deep link + `inject("POWER_FAIL")` through `__DEMS_DEBUG__`. Closure: a `power-fail` scenario |

## 5. Decisions and drift

| ID | Type | Note |
|---|---|---|
| S81-1 | drift (additive) | 04 §4.8 names a two-stage pipeline. Per the brief, it shows five checks inside those two §18.1 stages, and the stage line names the current one |
| S81-2 | decision | The RECOVERED outcome is a mapping only (SIM-GAP-M81-1). INCOMPLETE stays the only reachable outcome, as SYS-008 requires |
| S81-3 | decision | §4.8 says "the ring goes to ATTENTION, then READY". This is applied to the screen's own mini GlowRing: critical → attention → ready on Acknowledge, then Home. Home's own ring follows Home's rules. After this demo Home still reads "Recording Blocked", because fault-demo's CAMERA_LOSS (a CRITICAL alert, S32-11), MIC_CLIP and GNSS_LOSS stay active |
| S81-4 | decision | Acknowledge also acknowledges the alert(s) of the followed fault (kind and time within ±1 s), so the bell stops counting it |
| S81-5 | decision | Back while RECOVERY is consumed with a toast. §3.6 does not list recovery; this mirrors Finalization. In FAULT or after the outcome, Back pops, or goes Home when nothing sits below it (F-79-1) |
| S81-6 | decision | Two panes on `expanded` only. `medium` keeps §2.4's single 640 dp card. The tablet layout is jest-checked, not device-checked (fast lane: tablet → end pass) |
| F-81-1 | finding (step 91, Stepper owner) | C-4 `warn` steps keep their number glyph and leave the connector below unfilled, because the fill only follows `done`. On this screen that gives grey segments under steps 2 and 4 (see 05). This is composition behaviour, left as is |
| P11 | noise | `[colorKit.RGB]` console errors from the kit Button's `setAlpha` in jest. The step-80 suite logs the same lines; they are unrelated to this step |

## 6. Rollback

Restore the step-70 stub `session-recovery-screen.tsx` (`<ScreenStub id="session-recovery" />`) and the empty `i18n.ts` (`sessionRecoveryEn = {}`). Then delete the other files listed in §2. No other file changed. Nothing was committed.

*Generated 2026-10-01 09:58 WIB*
