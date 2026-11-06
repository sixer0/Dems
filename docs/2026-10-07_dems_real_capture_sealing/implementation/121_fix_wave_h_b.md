---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
row: wave H, driver B (decision D200; notice D203)
date: 2026-10-10
agent: coder-execution
narrative_tier: 2
tree: f293221 + the working tree of wave H (no commit, no migration)
status: needs-review - the three MAJORs and the MINORs listed DONE are green in tests; the D203 time-source ruling and driver A's three client lines are NOT DONE; nothing was driven on a device or in a browser
---

# 121 - Fix wave H, driver B: session state, interrupted recordings, the clients' session surfaces

## 1. Findings

| Finding | Reproduced in a test (red)? | Fix | Test | Status |
|---|---|---|---|---|
| G75-03 / G89 B-3 (MAJOR) an interrupted seal reads as a plain seal | YES: web banner said "SESSION SEALED", mobile Summary stamped "SEALED", hub row "Sealed" | The fact is read from an EXISTING member: the item's custody entry `RECORDING_INTERRUPTED` (`interruptedSealOfItem`, `interruptedSealOfSession`, `packages/shared/src/sim/capture-session.ts`); while the seal still runs, from the session's `fault`. Words in one place (`INTERRUPTED_SEAL_SENTENCES`, `interruptedSealCauseSentence`, `capture-fault-wording.ts`; i18n `common.interruptedSeal`). Named on: web banner, feed card, seal dialog (heading, stamp, line, notice); mobile Finalizing (title, stamp, notice), Summary (stamp word, notice), Sessions hub row / detail / active chip | `packages/shared/test/sim-wave-h-b-session.test.ts`; web `session-monitor/__tests__/interrupted-seal.test.tsx`; mobile `session-summary/interrupted-seal.test.tsx`, `sessions/interrupted-seal-hub.test.tsx` | DONE in tests. Evidence list / item header: request line to C2 |
| G75-08 `stoppedAt: null`, durations run on | YES (shared, web) | `completeSealTransition` writes `stoppedAt = durableEndAt` for an interrupted seal, AT SEALED only; `recordingEndOf(session)` (selectors.ts) = the stop, or the fault that ended the recording; `selectElapsedMs`, the web Duration and audio band, the mobile hub timer and Finalizing length read it | same shared + web tests (a minute later: same value) | DONE in tests |
| G89-02 (MAJOR) B9 logcat, 70 / 70 / 110 lines | PARTLY: what jest can see - a kit Spinner on a hand-over copy and `cancelAnimation` at its removal - was red (1 Spinner per running step; 23 cancels from STOPPING to SEALED). The logcat line itself cannot be counted in jest | Source read from `.cache/gates/89/logcat_P.txt`: every line is Reanimated's `synchronouslyUpdateUIProps failed for tag N`, retried at each event dispatch (stack enters at `SvgView.onDraw`, hence 5, 7, 9 ... and the jump at the Summary); one tag per REMOVED running indicator = the status-line Spinner + six step Spinners (7 tags on the phone, 6 on the tablet). The kit Spinner keeps a shared value even with `animation="disable-all"` and cancels it on unmount. A still copy now draws the lucide `LoaderCircle` glyph from React: `components/composed/stepper.tsx` (the running badge) and `session-finalizing-screen.tsx` (status line) | `session-finalizing/b9-still-indicator.test.tsx` (3 cases, one control); pin of row 87 moved in `finalizing-forward-only.test.tsx` | DONE in tests; **device re-check mandatory** (section 5). A hypothesis until logcat reads 0 |
| G75-02 (MAJOR) the phone's switch names no device on the simulated lane | YES (shared, engine) | `AuthSlice.deviceId?` set by the Core's actor scope for one hosted command (`withActorScope(..., principal.deviceId)`, `host.ts` one argument); `sendingDeviceOf(state, deviceConsole)` is the one rule of the action and of op 81. The in-app simulator keeps its own paired device id `TABLET` (its pairing rows use the same id) | shared test "G75-02"; `engine/__tests__/actor-scope.test.ts` "G75-02" (with a web-console control) | DONE in unit tests; the route-level proof is a db check for the runner |
| G75-04 meters while connecting / in a failed start (web) | YES: 2, 2 and 1 meters | `noLiveLevelsOf(session)` (shared) -> web Audio Monitor cards, Camera & Input Status panel, Dashboard microphone tiles show the state instead of a meter | web `__tests__/no-live-levels.test.tsx` | DONE in tests |
| G75-05 `FAULT_CLEARED` worded by another cause; crash alert without `reason` | YES | The clear row reads the reason of the fault's alert (`captureWideReason`, faults.ts). Reason of the crash alert: driver F's closed list `CaptureDownReason`; its 30 sentences are in the wording table (F's request) | shared "G75-05"; `capture/__tests__/fault-wording.test.ts` 48 passed | DONE |
| G75-06 demo op 74 clears a closed failed start's fault | YES | `clearFaultTransition` never clears a capture-wide fault whose alert names a cause other than the demo control's own (`isCaptureOriginatedFault`) | shared "G75-06" + control | DONE |
| G75-09 demo `CAPTURE_FAULT` says "interrupted" while recording | YES | The demo inject carries `reason: DEMO_CAPTURE_FAULT`: "The demo control raised a capture fault. The recording is not affected." | shared "G75-09" | DONE |
| G75-10 stale capture fault = "Recording Blocked" / "integrity check failed" | YES | (a) cleared at the interrupted seal (`endCaptureFaultAtSeal`, one FAULT_CLEARED); (b) the fault a CLOSED session left is a WARNING flag in `systemStatus`, critical only for the open session | shared "G75-10" (2 cases) | DONE in shared; the client words follow the state (not driven) |
| G75-11 failed start leaves "Recording Started" | Timeline: the test was green at first run because the edit preceded it (lapse, section 4) | The failed start removes the START node of its session's timeline. Audit: `RECORDING_STARTED` is the contract's only type and the chain is append-only; it is followed by `FAULT_RAISED {reason, evidenceFiles: 0}` (asserted). Dashboard event "Recording session started": NOT changed | shared "G75-11" + control | PARTIAL |
| G75-07 (a) warning covered by the demo fault's banner | YES | web banner draws the covered degraded warning in its own line (`sm-banner-degraded`) | `situation-c.test.tsx` appended, with control | DONE (web) |
| G75-07 (b) phone Home "Recording Blocked" while recording | YES | CRITICAL while RECORDING reads "Recording — critical fault / Recording <id> continues..." (`common.criticalWhileRecording`; the dashboard copy pin of 79 texts is untouched) | `dashboard/session-start-home.test.tsx` appended, with control | DONE |
| G75-07 (c), (d) warning outlives its session; next pre-check warns | YES | `advanceCaptureEnd` (simulator's own capture): the SESSION_START warning is resolved and the device reads reachable once no session records | shared "G75-07" | DONE (simulator); the Core's real capture is driver F's notices unit |
| G89-11 "About 1 s left" for 11 s | YES (pins moved first, red) | The line names what the number is: "This step: about N s left" (`session.sealingEta.step`), web and mobile | `finalizing-forward-only.test.tsx`, web `sealing-progress.test.tsx` | DONE. The run's ETA of op 83 is not drawn: the clients read the slice |
| G70-04 "busy" after the action ended (Session New) | What jest can see: idle controls carried no `busy` member (red) | Cause reasoned, not observed: `busyState` drops `accessibilityState` when idle and RN Android ignores a removed state. The three footer buttons state `busy: false` explicitly | `session-new/idle-control-state.test.tsx` | DONE in tests; device re-check; "Search again" and the retry button: request to D |
| G89-13 tablet drew Finalizing after the Core had sealed | NO test written | none | - | NOT DONE (a NOTE; cause not determined) |
| Item 5: connecting delay configurable | - | No existing demo control fits. Not built | - | DECISION (section 2) |

## 2. Decisions for the controller

1. **No contract member for the interrupted fact.** `session_history_outcome_check` forbids a fault kind on a SEALED entry and a new member needs a column. The fact is derived from the item's custody. If the REST history (op 38) must say it to a non-app reader, it needs a read-time join in `db/mapping` or a migration.
2. **Foreign file edited:** `apps/mobile/src/components/composed/stepper.tsx` (one import, one expression), declared in `file_claims.md` before the write; no driver lists it and the finding names it.
3. **Row 87's pin changed:** `finalizing-forward-only.test.tsx` asked for a disabled kit Spinner on the hand-over copy; it now asks for none.
4. **The cause sentence of an interrupted seal has no reason code:** the custody holds the fault kind only, so the surfaces read the no-reason capture sentence, not F's specific one.
5. **G75-11 audit row stays**; the Dashboard event wording is open.
6. **Connecting delay:** proposal `CreateSimOptions.captureConnectMs` + a test-only Core environment setting (config.ts is frozen) - a new control, not built.
7. **`sealing/pipeline/controller.ts:124`** reads `stoppedAt !== null` as STOPPED; true now for an interrupted session once SEALED (notice filed).
8. **Demo fault wording** uses the word "demo": true for a fault the demo control raised.

## 3. NOT DONE

- Decision D203 item 2: the truthful `time` slice in the Core's own capture, the pre-check TIME note, `RECORDING_STARTED.timeSource`, the `HEALTH_CHECK_OK` condition in `generator.ts`.
- Driver A's lines of 10:20:55Z: web banner "All integrity checks passing", storage panel "Write Speed" / AUTOSAVE, mobile GNSS chips.
- G89-13; the Dashboard event of G75-11; item 5; the web timeline's "Critical fault: CAPTURE_FAULT" code row; `modules/sessions/**` and `modules/demo/**` (no edit was needed for the findings closed).

Nothing of these is half-built in the tree.

## 4. Checks I ran (once each; a second run only after a fail or a later edit of mine)

| Check | Result |
|---|---|
| shared suite (`vitest run --root packages/shared`) | 2494 passed, 2 failed: `api-openapi-scope` and `openapi` byte drift - another driver's in-flight contract edit; I changed nothing under `src/api`. Later shared edits re-checked by 7 + 5 targeted files: 111 and 49 passed |
| core-server unit: actor-scope, engine static, parity, hosted-actions, fault-wording, fault-lifecycle, forwarder-advisories, `test/static` | all passed after F's sentences landed, except `engine/__tests__/static.test.ts` file count 22 -> 23 (`engine/sealed-facts-doors.ts`, not mine) |
| core-web: session-monitor, dashboard, session-new, two static guards | 149 passed, 1 failed: `connecting-leftovers` `storageWrite(integrity)` - the integrity panel is driver A's in-flight edit |
| mobile (`--maxWorkers=2`): session-finalizing, session-summary, sessions, session-new, dashboard, session-recovery, composed/stepper; session-live | 54 suites / 394 passed; 24 suites / 190 passed |
| typecheck: shared, core-server, core-web, mobile | 0 errors each |
| lint: shared, core-server, core-web | clean; mobile: 0 errors, 1 warning in `runtime/log.test.ts` (not mine) |

Lapses: (1) the shared wording and the first `capture-session.ts` edit were written before the test file, so G75-11's timeline case was never seen red; (2) I ran Prettier with `--write` on `dashboard/system-status-card.tsx`, which reformatted the file; restored from HEAD and the two edits re-applied (diff 12 / 8 lines).

## 5. Checks for the test runner

| Command | Lock | Expect |
|---|---|---|
| `npm -w packages/shared test` | - | green once the OpenAPI document is regenerated by its owner |
| `npm -w apps/core-server test` | - | green; watch pins of the demo capture fault text, `systemStatus` CRITICAL with no session, a START node after a failed start |
| `/usr/bin/lockf -k .locks/db-migrate.lock npm -w apps/core-server run test:db` (sandbox off) | db-migrate | watch `seal-actions.db`, `capture-actions.db`, `recording.db`, `rehydrate-failed-start.db`, `modules/sessions/**`, `capture-session/session-capture.db`: `stoppedAt` after an interrupted seal, one more FAULT_CLEARED at that seal, the switch row's device on the simulated path |
| `npm -w apps/core-web test`, `npm -w apps/mobile test -- --maxWorkers=2`, mock-core | - | green apart from other drivers' files |

## 6. Gate checks to re-drive on a device / browser

1. **B9 (mandatory):** tablet and phone, Monitor -> Finalizing -> Summary, real and simulated seal: `adb logcat | grep -c "Unable to find SurfaceMountingManager"` from the stop to the Summary = 0. If not 0: tags and counts back.
2. Worker kill on lane 2: web banner / feed card / seal dialog, tablet Finalizing / Summary / hub read "Sealed — recording was interrupted" with the cause; `stoppedAt` set; Duration equal on web and tablet and not counting; no CRITICAL header afterwards; one FAULT_CLEARED at the seal.
3. `M5-SW-P` on lane 1: the phone's switch row carries `deviceId` and `sendingDeviceId`.
4. Web: no meter while connecting (status panel) and in a failed start (cards, panel, Dashboard).
5. Lane 1: failed start then a good start (`FAULT_CLEARED` wording); demo op 74 after a closed failed start (no clear); demo `CAPTURE_FAULT` wording; degraded start (banner line, phone Home title, warning gone after the session, next pre-check PASS); failed-start timeline without "Recording Started".
6. G70-04: uiautomator dump of Session New "Next" after "Not now".
7. Phone ETA line during a simulated seal.

---
*Generated: 2026-10-10*
