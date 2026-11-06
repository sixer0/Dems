---
task_id: 2026-09-30_dems_demo_stack_setup
task_slug: dems_demo_stack_setup
date: 2026-10-01
agent: coder-execution
step: 80 (blueprint row 80; 05_mobile_plan M-11 part a)
lane: mobile, Metro 8086
source_plan: /Users/gsp-budi/Documents/DEMS/docs/2026-09-30_dems_demo_stack_setup/identification/02_structured.md (row 80)
narrative_tier: 3
verification_lane: FAST LANE (D75)
status: completed
---

# Step 80: mobile Finalization + Session Summary (M-11 part a)

**Outcome: PASS (fast lane, D75).** One controller note (F-80-1) and one SIM-GAP (SIM-GAP-M80-1).

| Check (D75 fast lane + row 80) | Result | Evidence |
|---|---|---|
| Mobile typecheck exit 0 | **PASS** | `npx tsc --noEmit -p .` → exit 0 (09:26:26 WIB) |
| Mobile lint exit 0 | **PASS** | `npx eslint .` → exit 0 (09:26:26 WIB) |
| Own jest suites pass | **PASS** | `npx jest src/features/session-finalizing src/features/session-summary` → 4 suites, 33 tests passed |
| MA-29 finalize → summary part on dems_phone | **PASS** | FINALIZING → SEALED in 6.1 s (≤ 10 s); violet SEALED chip; `acknowledgeSummary` called once (persisted snapshot below) |
| ONE phone-portrait device check | **PASS** | dems_phone, screencaps `assets/mobile/80_dems_phone_*.png` |

Not run in this lane (D75; moved to the end passes 57 and 59): tablet layouts on device, reduced motion, fps, mutation checks.

## Files (all new or rewritten inside the two owned folders, P6)

`apps/mobile/src/features/session-finalizing/`
- `session-finalizing-screen.tsx`: rewritten (was the step-70 stub). Keeps the export and `SafeScreen id="session-finalizing"`.
- `finalizing.model.ts`: pure maths (phase, Stepper statuses, percent, step seconds, 1.2 s hand-off).
- `use-finalizing.ts`: flat `useSim` selectors (F74-13) and the sim-clock hand-off flag (F74-09).
- `finalization-pipeline.tsx`: C-4 Stepper, vertical `pipeline` variant over the 6 `FinalizationStep`s.
- `sealed-stamp.tsx`: the M-C-09 SEALED stamp.
- `flow-boundary.tsx`: error boundary for both screens.
- `i18n.ts`: filled.
- Tests: `finalizing.model.test.ts`, `session-finalizing-screen.test.tsx`. Test-only harness: `testing/flow-harness.tsx`, `testing/flow-test-setup.ts`.

`apps/mobile/src/features/session-summary/`
- `session-summary-screen.tsx`: rewritten (was the stub). Keeps the export, the props and `SafeScreen id="session-summary"`.
- `use-summary.ts`: flat selectors and `useAcknowledgeSummary`, which acknowledges at most once.
- `summary.model.ts`: track order, short hash, sizes, the §19.1 lifecycle, route availability.
- `hash-sheet.tsx`: full-value BottomSheet.
- `use-sheet-presence.tsx`: a copy of step 79's F-79-2 pattern.
- `stamp-once.ts`: the stamp plays once per session per process.
- `sim-adapter.ts`: SIM-GAP-M80-1.
- `i18n.ts`: filled.
- Tests: `summary.model.test.ts`, `session-summary-screen.test.tsx`.

## What was built (04 §4.6, §4.7)

- **Finalization:** a full-screen centred card. It shows the title, the session ID in mono, the status line (STOPPING spinner, then "NN% complete"), the Stepper pipeline (Spinner → check, each step's duration under it) and a "closes by itself" caption. A Session card follows with the case, the subject and its `SubjectTypeChip` (sim code), the recording length and the evidence ID. It sits below the pipeline on phones and beside it on tablet landscape (§2.4: 720 dp card plus side summary).
  - **Back** (§3.6): non-dismissible. A screen BackHandler consumes Back while STOPPING or FINALIZING, with the "Finalizing — please wait" toast (throttled to one per 2 s). There is no back arrow, and Back never leaves the app (F-79-1).
  - **FAULT/RECOVERY (P7):** the running step turns red once, and a calm danger `Alert` names the fault and offers "Open recovery status".
  - **Other states:** idle and not-ended states get a notice card.
- **Summary:**
  - **Hero:** the SEALED stamp (violet `StatusChip` with BadgeCheck), the session ID in mono, the case and subject chip, and the sealed time.
  - **Details:** case, subject + chip, investigator, room, start and end times, duration, size, evidence ID.
  - **Hashes:** VIDEO-01/02 and AUDIO-01/02 in short form, the manifest hash, and the signature with a SIMULATED chip. A tap opens the full selectable value in a BottomSheet.
  - **Finalization:** the finished pipeline and "Sealed N s after the recording ended". It is shown only while this is still the simulator's current session.
  - **Lifecycle:** a horizontal Stepper over §19.1, current stage SEALED LOCAL EVIDENCE.
  - **Actions:** "Done" (outline) and "View in Evidence" (primary), pinned at the bottom on phones. Each calls `acknowledgeSummary` once, then goes to `/home` (`dismissTo`) or `/evidence/<id>`. Hardware Back does the same as Done.
  - **Layouts:** tablets split into `pane-finalization` (hero, pipeline, lifecycle) and `pane-summary` (details, hashes, actions).
  - **Past sessions:** no stamp and no acknowledgement. An unknown ID gets a notice.
- **Motion:**
  - **Stamp:** scale `stampFrom` 1.2 → 1 on the `bouncy` spring (the only `bouncy` use in this flow, P4), a 400 ms e3 violet glow flash (`animatePulseOnce(…, 400)`, totalMs always passed, D73), a 700 ms hairline ring, and the `sealedStamp` haptic.
  - **Enter and reduced motion:** cards enter with R1 `enterRise`. Under reduced motion the stamp is static and the haptic still fires (§7.6).
- **Error handling:**
  - Each region sits in `FlowBoundary`: a fallback card, a persistent log (`reportRuntimeIssue` → `dems.mobile.log.v1`), and a rate-limited retry (3/6/12 s, at most 3).
  - Acknowledge and navigation failures show a toast and are logged.

## Device check (dems_phone, portrait, Metro 8086, 09:20–09:25 WIB)

- Sessions ran through `device-session.sh phone` (force-stop first).
- **Emulator and app:** the emulator was not touched (D78). The installed app was the 06:07:21 install of the step-72 debug APK (`dumpsys package` lastUpdateTime), so no reinstall was needed.
- **Sign-in and scenario:** real Login via uiautomator resource-ids (`?motion=off`), then the `&scenario=finalizing` debug deep link.

| Frame | Shows |
|---|---|
| [01_after_signin](assets/mobile/80_dems_phone_01_after_signin.png) | The post-sign-in resync landed on the pending Summary of the first run (boot router → this route) |
| [02_finalizing_early](assets/mobile/80_dems_phone_02_finalizing_early.png) | 17%: step 1 checked "0.9 s", step 2 Spinner with glow ring, steps 3–6 numbered; Session card (LP/2026/1001-0007, Ahmad Fauzi + Tersangka chip, 00:18:40, EV-20261001-0014) |
| [03_finalizing_mid](assets/mobile/80_dems_phone_03_finalizing_mid.png) | 67%: four checks with durations, "Sign manifest" running |
| [04_summary_top](assets/mobile/80_dems_phone_04_summary_top.png) | The route sync opened the Summary: violet SEALED chip, SES-20261001-0024, details |
| [05_summary_hashes](assets/mobile/80_dems_phone_05_summary_hashes.png), [06_summary_lifecycle](assets/mobile/80_dems_phone_06_summary_lifecycle.png) | 4 track hashes + manifest + signature SIMULATED; finished pipeline "Sealed 6.1 s after the recording ended"; lifecycle at stage 8 "Sealed local evidence" |
| [07_hash_sheet](assets/mobile/80_dems_phone_07_hash_sheet.png) | "VIDEO-01 · Camera 1" sheet with the full 64-hex value (the sheet opened, F-79-2 pattern holds) |
| [10_summary_top_fixed](assets/mobile/80_dems_phone_10_summary_top_fixed.png), [11_summary_hashes_fixed](assets/mobile/80_dems_phone_11_summary_hashes_fixed.png) | After two fixes found in run 1: the actions now split 2 : 3, so "View in Evidence" fits on one line (it wrapped in 04); the label "Signature" replaces "Manifest si…" (truncated in 05) |
| [12_home_after_done](assets/mobile/80_dems_phone_12_home_after_done.png) | Done → `screen-home` (uiautomator), "Ready for Recording", EV-20261001-0014 first in Recent Sessions |

- **Superseded frames:** `08_after_done` (Home, run 1) and `09_audit` (`/audit` is still a step-70 placeholder) are kept for the record. `00_launch` is the Login screen at launch, before sign-in.
- **SCR-02 proof:** the app's persisted AsyncStorage (`databases/RKStorage`, key `dems.sim.v1`, read with host `sqlite3`) after Done showed:
  - `"lastSealedSessionId":"SES-20261001-0024"` and `"lastSealedAcknowledged":true`;
  - exactly **1** `SUMMARY_ACKNOWLEDGED` audit row (OPR-001), after `RECORDING_STOPPED`, `SCENARIO_LOADED`, `EVIDENCE_SEALED`;
  - no step-80 entry in `dems.mobile.log.v1`.

## Notes for the controller

| ID | Owner | Note |
|---|---|---|
| **F-80-1** (drift) | step 73 runtime / step 91 | 04 §4.6 says "After 1.2 s, route-sync opens the Summary". `SessionRouteSync` replaces **immediately** on FINALIZING → SEALED (`isForcedTransition`), so the Finalization screen never shows SEALED on the normal path. **Handled in-folder:** the stamp moment (bouncy + glow + ring + haptic) plays on the Summary hero at first sight, once per session (`stamp-once.ts`). The Finalization screen keeps a fallback: a static sealed chip, then its own replace 1.2 s after the seal on the simulator clock (tested without the route sync). Seen on device: the last check resolves, then the Summary fades in with the stamp. If the controller wants the beat on the Finalization screen, step 91 can delay the sync's SEALED replace by 1.2 s; no screen change is needed |
| **SIM-GAP-M80-1** | step 91 (sim owner) | `SessionHistoryEntry` and `EvidenceItem` do not record the time source of Start and End (§4.7, S29 badge). `sim-adapter.ts` reads the newest `time.history` sample at or before each instant (10 s ring, 120 points) and shows **no badge rather than a guess** when there is no sample. Right after a `&scenario=` reload the ring has no samples before the instants, so the device frames show no GNSS badge. A live MA-29 run (recording ≥ 10 s after launch) shows it. **Closure:** record `startTimeSource`/`endTimeSource` on the history entry and export a selector, then swap the adapter |
| T-M02 | step 57 | `routes.test.tsx` `/session/summary/…` now fails only on its stub assertion `stub-param-sessionId` (`screen-session-summary` renders), like the evidence and session-new cases (steps 83, 78). `/session/finalizing` still passes. Step 57 updates the stub-level assertions |
| S80-1 | decision | No `usePreventRemove` "block" guard on Finalization. It would also hold the route sync's own `replace` at the SEALED edge (the guard flag updates one commit late). Back is covered by the screen BackHandler, the stack's `gestureEnabled: false` (active session) and the missing back arrow |
| S80-2 | decision | "Acknowledge" (brief) = 04 §4.7: both "Done" and "View in Evidence" acknowledge once (`useAcknowledgeSummary`, ref-guarded), and so does Back. A screen-reader hint says so |
| S80-3 | relay to step 91 | `GlowLayer`'s pulse calls `animatePulseOnce` without `totalMs` (the D73 hazard). The stamp uses its own glow layer with an explicit 400 ms |
| S80-4 | relay to step 81 (Sessions hub) | 04 §4.7 says "the same component serves `/sessions/[sessionId]`". The summary view handles past sessions (no stamp, no acknowledgement), so step 81 or 91 may reuse it |

## Status

Step 80 is complete under the fast lane. Remaining for the end passes (57/59): tablet layouts on dems_tablet (both screens implement the §2.4 two-pane and side-summary layouts and are covered by jest at 1280×800), reduced motion, and fps.
