---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
row: fix wave J, ROUND TWO, driver J2-M (apps/mobile, all remaining mobile findings; tablet emulator-5556 lane 2, phone emulator-5554 lane 1)
date: 2026-10-12
agent: coder-execution (rules D94 / D122 / D163; briefs fix_brief_wave_j.md, fix_brief_wave_l.md)
narrative_tier: 2
status: needs-review - every MAJOR / BLOCKER of the mobile reports is now proven live in the normal launch form; 43 MINOR fixed, 9 MINOR not or only partly fixed with the reason (section 3); whole mobile suite green once (281 suites, 3,123 tests); JM-05's cause is measured but NOT removed
tree: 035150b + wave J round one (uncommitted) + this round (no git write)
---

# 171 - Fix wave J, round two, driver J2-M

## 1. Work list (written 09:30, BEFORE any code change)

State after round one: L = fixed and proven live; T = fixed, by test only; P = partly; N = not fixed.

### 1.1 Tablet report (judging_a1_tablet.md)

| Id | Sev. | After round one | Plan for this round |
|---|---|---|---|
| JT-01 | MAJOR | (c) L on the phone; (a), (b) T | see it live on the tablet on the way to JT-02 (seal rig) if the slot allows |
| JT-02 | MAJOR | L (Finalizing, hub); Home control mounted by J-P, never seen | verify on the tablet with the seal rig; build if absent |
| JT-03 | MAJOR | T (Home ring, Network & Time, Health, diagnostics); Settings half L | prove live: Home, Devices, Network & Time, Settings |
| JT-04 | MAJOR | T | prove live on EV-20261009-0005: list, header, Status |
| JT-05 | MAJOR | L (= JM-01) | logcat over every proof |
| JT-06 | MAJOR | T (confirmation); L "not available" on lane 2 | prove the confirmation on the phone (lane 1) and CANCEL |
| JT-07 | MAJOR | T | re-read masterplan 05 / 06, correct the sentence if needed, prove in a 45 s recording |
| JT-08 | MINOR | N (not reproduced) | five attempts in the normal launch form (Done, background, navigation) |
| JT-09 | MINOR | N | End Session: same gesture in both motion modes; toast not over the button |
| JT-10 | MINOR | N | transcript follows the playhead; a segment's time seeks |
| JT-11 | MINOR | N | draw markers / notes when the item carries them; say what a snapshot is |
| JT-12 | MINOR | P (selector, device rows, storage by J-P3) | the rest: Sessions row id, subject on Ready / Finalizing, bell rows, placeholders, Home camera tile title |
| JT-13 | MINOR | P (Home chips, selector rows) | Devices Check rows, completed stepper step |
| JT-14 | MINOR | T | see on the tablet |
| JT-15 | MINOR | N | J-S 4 rule: no "Download manifest" for an item sealed on this Core, pointer to Export |
| JT-16 | MINOR | P (sentence names every role) | row-menu Export gated like the button; Play disabled WITH its reason |
| JT-17 | MINOR | N | action-bar Play after an integrity stop |
| JT-18 | MINOR | N | ruling (c): Login notice "Console locked - sign in to continue" |
| JT-19 | MINOR | L on the phone | nothing (server session left to expire: see notes) |
| JT-20 | MINOR | N | detail pane follows the filter |
| JT-21 | MINOR | P (labels) | "Est. Remaining": reason if the slice still lacks the member |
| JT-22 | MINOR | N | stale New Session copy; "Run checks again" beside the block |
| JT-23 | MINOR | L | - |
| JT-24 | MINOR | N | Home says that a setup / armed session is open |
| N-01 .. N-14 | NOTE | N-03, N-05 done; N-13 = JA2-03 done | one-line / plainly wrong ones fixed; rest listed |

### 1.2 Phone report (judging_a2_phone.md)

| Id | Sev. | After round one | Plan |
|---|---|---|---|
| JA2-01 | BLOCKER | T (phone); L on the tablet | prove on the phone: INCOMPLETE item "Not sealed", no Verify |
| JA2-02 | MAJOR | T | prove on the phone: demonstration chip + wording on Summary, item, Verify |
| JA2-03 | MAJOR | L on the tablet; T | prove on the phone: Composite disabled with its reason |
| JA2-04, -05 | MAJOR | L | - |
| JA2-06 | MINOR | N | active microphone without signal is said on Session Live |
| JA2-07 | MINOR | P (Home) | Evidence list / item: "Incomplete" mark and worded cause |
| JA2-08 | MINOR | N | = JT-11 |
| JA2-09 | MINOR | N | subject not cut on Ready / Finalizing |
| JA2-10 | MINOR | N | New Session title not cut |
| JA2-11 | MINOR | T | see during a recording |
| JA2-12 | MINOR | N | bundled asset: reason |
| JA2-13 | MINOR | P | evidence sentences "this device" |
| JA2-14, -15 | MINOR | T | - |
| JA2-16 | MINOR | P | ruling (a): bell + account menu in the accessibility tree; uiautomator proof; other sheets checked |
| JA2-17 | MINOR | N | recovery rows' spoken state |
| JA2-18 | MINOR | closed by decision (D17, D244) | record only |
| JA2-19 | MINOR | N | no black screen when a recording is ended from outside |
| JA2-20 | MINOR | N | stepper labels, outside tap, result fits |
| JA2-21 | MINOR | N | = JT-15 |
| JA2-22 | MINOR | N | completed steps are not buttons that do nothing |
| JA2-23 | MINOR | N | "Run checks again" beside the block |
| JA2-24 .. -28 | MINOR | T | - |
| JA2-29 | MINOR | P | spec / developer words left in session, evidence, recovery copy; Metadata raw JSON |
| JA2-30 | MINOR | T (= JT-06) | with JT-06 |
| JA2-31 .. -35 | MINOR | T / P | -35: "Lock console" with JT-18 |
| JA2-36 | MINOR | N | reason hint; no autocorrect on names / reasons |
| JA2-37 | MINOR | N | simulator numbers: what is the app's, what is the simulator's |
| JA2-38 | MINOR | T | - |
| JA2-N1 .. N12 | NOTE | N1, N3, N6, N10 done | rest: fix or list |

### 1.3 Motion-on report (judging_b2_motion_on.md)

| Id | Sev. | After round one | Plan |
|---|---|---|---|
| JM-01 .. JM-05 | BLOCKER / MAJOR / MINOR | L (JM-05: words; canvas empty, cause unknown) | find the cause of the empty canvas or state what is ruled out |
| JM-06 | MINOR | N | measure; fix if the product's |
| JM-07 | MINOR | T (veil 0.55) | check on the phone |
| JM-08 | MINOR | N | ruling: one surface per kind in both motion modes |
| JM-09 | MINOR | P | ruling (d): one sentence in both layouts |
| JM-N1 .. N7 | NOTE | N6 done | fix or list |

### 1.4 Carried

| Item | Plan |
|---|---|
| W93-10, W93-19, W93-26, W93-27, B15, RC-7 link | each looked at with the devices; built where a defect or a missing exit |
| `auth/live-auth.test.tsx`, `capture-selector/local-source-start-notice.test.tsx` | find the order / shared-state / load dependence; fix the test |
| lint | run and read |


## 2. Final state of every finding

L = proven live in the NORMAL launch form (`force-stop`, `monkey ... LAUNCHER 1`); T = by test; C = by code only.
Paths are under `apps/mobile/src/`. Test files are EXISTING files unless "(new module)".

### 2.1 BLOCKER / MAJOR (all fixed in round one; proofs completed here)

| Id | Final | Proof of this round |
|---|---|---|
| JM-01 / JT-05 | fixed | L: export wizard step 1 -> 3 on the phone, 3 Verify + player + two recordings on the tablet: 0 `Worklets`, 0 duplicate-key lines |
| JM-02 | fixed, and the rule made the app's | `lib/sheet-open.ts` (new module, `sheet-open.test.tsx`): the confirmed open of round one moved out of Evidence and applied to ALL nine sheets. Reason: tablet, normal launch, device "Diagnostics" - 4 presses, the Core accepted the runs (202), no sheet. After: opened at the first press (1 of 1; the following presses were lost to a reload caused by another driver's edits of `packages/shared`) |
| JM-03 | fixed (round one) | not re-driven |
| JT-01 / JA2-04 | fixed | L tablet (a): `seal-rig 2 blocked` -> Home "ATTENTION / Sealing is being retried / ... The recording is kept on the Core." from the first failure, then "CRITICAL / Sealing blocked" (`t068`, `t069`). (b) unreachable camera: T only (source rig not used) |
| JT-02 | fixed | L tablet, ruling (b): "Retry sealing" ON Home's blocked entry -> confirmation naming SES-20261012-0101 -> SEALED as EV-20261012-0071, the tablet opened the Summary by itself. T: `dashboard/session-start-home.test.tsx` "JT-02" |
| JT-03 | fixed + four more places found live | L tablet: ring "SECURITY NOT REPORTED", Network & Time "Not reported" x3, device diagnostics "Not reported" x4, microphone detail "— dBFS / Not measured", About TPM "Not reported". FOUND AND FIXED HERE: Home mic tiles read "-60 dBFS" with bars (`dashboard/device-tiles.tsx`, `home-model.ts` `micReadoutKind`; T `home-mic-tiles-live.test.tsx` "JW-08 mobile half", `home-model.test.ts`); New Session's meters "-60 dBFS" (`session-new/device-previews.tsx`; L "Not measured"); Home chip "Network: Connected" beside the page's "Network: Not reported" (`home-model.ts` `chipRowFor`; T `home-model.test.ts`; L); **the pre-check SECURITY note was worded "Enclosure tamper detected"** (`session-new/devices-check-step.tsx`; T `precheck.test.tsx` with `PRECHECK_SECURITY_NOT_REPORTED_EXAMPLE`; L "Security, Not reported, NOTE") |
| JT-04 | fixed | L tablet `EV-20261009-0005`: list row, header chip, Status fact all "Sealed · verification FAILED" |
| JT-06 / JA2-30 | fixed | L phone (technician, lane 1): "Install update v2.5.0?" with slot B and restart -> "Not now"; still "Installed v2.4.1 · slot A" |
| JT-07 | fixed, sentence checked | Re-read masterplan 05 (`AUDIO-01` is the one session track carrying the active microphone, OD-01 / OD-09; never an auto-switch, OD-11, section E.1) and 06 (section B.5: `AUDIO-01` inside both camera files, `audio.sourceIntervals[]` with device, role, from / to, reason). Round one's sentence is exactly true and stays. L tablet during a recording (`t046_audio_b`): the sentence, cards "MIC 1" / "MIC 2" |
| JA2-01 | fixed | L phone: POWER_FAIL -> recovery -> `EV-20261012-0015`: "Not sealed ... nothing to verify", no Verify control, no PASS; Play says "The recording is not sealed." |
| JA2-02 | fixed + Summary | L phone `EV-20261012-0016`: item "Demonstration record of a simulated session: no media was recorded.", verdict with the DEMONSTRATION chip. FOUND: the Summary carried the word on its signature row only -> `session-summary/session-summary-screen.tsx` states it (T `live-summary-sites.test.tsx`; L) |
| JA2-03 | fixed | L phone: step 3, "Composite video is not available in this build." |
| JA2-05 | fixed (round one) | seen again: critical toast on the tablet (SEAL_BLOCKED), warning toast on the phone |

Five Verify presses, verdicts read: tampered item FAIL, FAIL (10:24:12, 10:24:25); `EV-20261012-0069` PASS x3, "15 of 15 checks passed".

### 2.2 MINOR

| Id | Final | Where / test / proof |
|---|---|---|
| JT-08 | not reproducible | ring text present in 7 of 7: sign-in, Fast Refresh, Go to Home from Finalizing, blocked seal, after Done, 35 s in the background, navigation away and back |
| JT-09 | PART | fixed: no toast on a short tap - the hint under the button is raised (`session-live/end-session.tsx`; T `session-live-screen.test.tsx` "JT-09"); snapshot / marker / mic-switch confirmations no longer lie over End Session (top, 2 s); a full hold completes by the touch's own timestamps (found live: a 1.9 s hold opened nothing while JS lagged; T same file; L 1.9 s hold opened the dialog on both devices). NOT changed: tap (reduced motion) versus hold (full) - section 3; the link banner still pushes the controls down - section 3 |
| JT-10 | fixed | `evidence/playback-link.ts` (new module + test, the web's rule), `sealed-player.tsx`, `transcript-pane.tsx`. L tablet: tap "0:10–0:13" -> player at 0:12 after Play; segment 0:13–0:20 marked "At the playhead". Not changed: the transcript is under the player (a seek brings the player into view) |
| JT-11 / JA2-08 | fixed | `evidence/session-annotations.tsx` (new module + test, `EVIDENCE_SESSION_ANNOTATIONS_EXAMPLE`). L tablet `EV-20261012-0071`: "Marker 1: J2M marker one" with its seek control, "Note from the session form: J2M form note: counsel present". Snapshot: the confirmation now says "Snapshot marked on the timeline. No image is stored." |
| JT-12 | fixed except search placeholders | row ids shrink and keep their number (`sessions/session-row.tsx`, `evidence/evidence-row.tsx`; L), subject whole on Ready and Finalizing, bell rows 4 lines, Home tile name full size with the chip under it and a compact "No preview" tile (L `t025`), interrupted line 2 lines, recent row 2 lines (L phone). Placeholders: section 3 |
| JT-13 | PART | completed steps that open nothing are text (`components/composed/stepper.tsx` `canPressStep`; T `stepper.test.tsx` "JA2-22"; L), the NOTE rows are explained in the row (L). Kit rows still report "clickable": section 3 |
| JT-14 | fixed (round one) | L: a tap on the state chip opened the detail |
| JT-15 / JA2-21 | fixed | `evidence/evidence-detail.tsx`: disabled with "The signed manifest is part of the export package. Use Export." (L `t030`); no entry for a never-sealed item |
| JT-16 | fixed | row-menu Export gated with its reason (`evidence-row.tsx`; T `evidence-more-menu-title.test.tsx` "JT-16"); a disabled Play says why (`evidence-detail.tsx`; T `evidence-detail.test.tsx` contract loop; L phone) |
| JT-17 | fixed, C only | `sealed-player.tsx`: the screen's Play does not restart a playback that stopped without a session end (it brings the stop sentence into view); Play at the end restarts from 0:00. No jest case (the harness has no integrity stop), not driven on the tampered item |
| JT-18 / JA2-35 | fixed | ruling (c): `login/login-card.tsx` (T `login.test.tsx` "JT-18"); the entry says what it does. L both devices: "Console locked. Sign in again to continue." (the web's words) |
| JT-19 | fixed (round one) | - |
| JT-20 | fixed | `evidence-list-screen.tsx`, `sessions/sessions-screen.tsx` (T `evidence-list.test.tsx`, `sessions-screen.test.tsx` "JT-20"; L tablet "EV-20261009-0005 is not in this list" + Clear filters). REPLACES the pinned "a filter keeps the selection" |
| JT-21 / JA2-38 | PART | labels (round one); "Est. Remaining": section 3 |
| JT-22 | PART | countdown caption follows the switch, "passed" hint at Ready (L), "Run checks again" beside the block (C). Back at step 2: section 3 |
| JT-23 / JM-04 | fixed (round one) | L: keyboard gone after End on both devices |
| JT-24 | fixed, T | `dashboard/quick-actions.tsx`; T `session-start-home.test.tsx` "JT-24" |
| JA2-06 | fixed | `session-live/mic-source-controls.tsx`, `mic-source-model.ts`; T `mic-source.test.tsx`, `mic-source-model.test.ts`; L phone `p024` |
| JA2-07 | fixed | `evidence/interrupted-line.tsx` `NeverSealedLine`; L phone: list row and header "Incomplete session — not sealed" |
| JA2-09, -10 | fixed | L phone `p022` (name whole), `p021` (title whole) |
| JA2-12 | not fixed | section 3 |
| JA2-13, -29 | fixed in app copy | "this device" in auth, refusal and evidence sentences (the pinned exception list of `settings-live-static.test.ts` is now empty), no "(SYS-008)" / "§" in app copy. Metadata JSON: section 3 |
| JA2-16 | fixed for the phone | ruling (a): bell and account menu are sheets (`dashboard/home-header.tsx`; T `dashboard-screen.test.tsx`). `uiautomator dump` on the phone: "Latest alerts", the alert's text, "Acknowledge: Storage full · ... " (labelled), "View all events", "Close"; account: name, role, "Settings and profile", "Lock console", its sentence, "Sign out". Back closed each; `topResumedActivity` stayed the app. The page underneath stays in the tree. Tablet popovers: section 3 |
| JA2-17 | fixed | `components/kit/key-value-list.tsx` `spokenValue`; T `session-recovery-screen.test.tsx`; L phone "..., INTACT. Continuous to the interruption" |
| JA2-18 | closed by decision | D17 / D244: no portrait lock; not built |
| JA2-19 | fixed | `app/(app)/session/live.tsx`, `session-live/monitor-leaving-notice.tsx`; T `live-handover-exit.test.tsx`; L filmed (`pf_sheet.jpg`): "The recording was interrupted / Opening session recovery…" for 1.75 s, no empty frame |
| JA2-20 / JM-08 | fixed | ruling: the Evidence sheets are sheets in BOTH motion modes (`evidence/sheet-frame.tsx`; T `play-sheet.test.tsx` "JM-08", REPLACES the Dialog case); the wizard is not discarded by an outside tap or a drag (L phone); one label under the badges on a phone (`stepper.tsx` `labels`; T; L "Step 1 of 6 · Authorize"). Result step on the phone: not driven to the end |
| JA2-22 | fixed | with JT-13 |
| JA2-23 | fixed, C | with JT-22 |
| JA2-36 | fixed | rule stated before any error, no autocorrect on reason and name (L "At least 5 characters. 0 / 500") |
| JA2-37 | not the app's | section 3 |
| JM-05 | NOT fixed; cause measured | section 3 |
| JM-06 | not established | section 3 |
| JM-07 | fixed (round one), T only | my film of two tab changes missed them (tooling); not re-measured |
| JM-09 | fixed, T | ruling (d): `sessions/foreign-session-notice.tsx` (new module + test), on the Summary and on New Session |
| JA2-11, -14, -15, -24 .. -28, -31 .. -34 | fixed (round one) | - |

### 2.3 Controller's addition (J2-S members), after the lanes ran the new code

| Item | Final |
|---|---|
| JW-26 mobile half | `lib/app-version.ts`, `lib/core-components.ts` (new modules + tests, `SYSTEM_COMPONENTS_EXAMPLE`), `settings/about-section.tsx`, `login-card.tsx`, `nav-rail.tsx`, `more-links.tsx`. L tablet: About "Core server 0.2.0 / Capture worker capture-worker/0.5.0 / API contract 0.3.0 / Mobile app 0.1.0" from operation 64, no "Software release v2.4.1"; Login "App v0.1.0"; rail "v0.1.0". Lane 1 keeps the model's rows under DEMO |
| notes with `origin: 'SESSION_FORM'` | L tablet (JT-11 row) |
| `unsealableCause` | `sessions/session-detail.tsx`; T `session-start-hub.test.tsx` (`SESSION_HISTORY_UNSEALABLE_ENTRY_EXAMPLE`); L tablet SES-20261011-0065: "... kept in the quarantine folder of the Core. Why the seal was given up: session key not of session." |

### 2.4 NOTES

Fixed: N-02 / JA2-29 app-side ids; N-03, N-05 (round one); N-08 quarantined sessions say where and why; N-10 phone sheets, recovery rows; N-13; JA2-N1, -N3, -N6, -N10 (round one); JA2-N7 for End Session; JM-N6 (round one).
Not done, with the reason: N-04 launcher name (native build); N-06 scan icon, counter (design); N-07 lifecycle strip cut, "Close tracks 246.9 s" carries the whole wait (the Core's step times); N-09 Metadata JSON (D200 / D201 mirror of the web); N-11 retry countdown (the Core sends the interval once); N-12; N-14 / JM-N1, -N2 library log lines (`ExpoVideo` PiP needs the config plugin: none seen in this run's windows); JA2-N2, -N4 (rulings); -N5 dialog dimming (kit); -N8 names; -N9, -N11, -N12; JM-N3, -N4, -N5, -N7 (answered by JT-16: the reason is now printed).

### 2.5 B8 remainder and RC-7

| Item | Done |
|---|---|
| RC-7 | built: "Back to Home" on the "Checking your permissions…" screen (`session-new/start-entry-checking.tsx`; T `rbac/role-gate-r2.test.tsx` "RC-7") |
| W93-10, B15 | not built, not timed: no dark or empty frame was seen at seven sign-ins and two pair-screen-free launches, but nothing was filmed frame by frame; W93-10 still needs the release build its finding names |
| W93-19 | not built: a merge of three working hooks, no defect behind it |
| W93-26 | not built: on a real-capture Core the row is "Not reported" (no bars to fit); the simulated row is pinned by `bandwidth-row-fit.test.tsx` |
| W93-27 | not built: wording decision; the real-capture page now says "Device link: Connected" and "This Core does not report its network." |

### 2.6 Stability

- `lib/keyboard.ts`: the 300 ms repeat of `putKeyboardAway` could fire after a test had ended ("Cannot read properties of undefined (reading 'dismiss')") and fail whichever file ran next in that worker. Seen in my first run in two files that pass alone (`session-live/live-gap-s4-7-tablet-link`, `runtime/live-device`). Guarded. I did not capture the assertion of the two files named in the brief (round one's logs hold names only); both passed in all three of my whole runs.
- Lint: run and read twice. First: 1 error (`react-hooks/refs`, my own edit), 2 warnings - fixed. Last: exit 0, 0 bytes of output.

## 3. NOT fixed, or only partly

| Id | Sev. | Reason |
|---|---|---|
| JM-05 canvas empty in the first seconds | MINOR | CAUSE MEASURED, NOT REMOVED. A probe in `dbfs-meter.tsx` (removed again) on the tablet: the two card meters mounted at .49 / .57 s and their `onLayout` reached JS 2.4 s later; the compact meters' 7 s later. The canvas learns its size, and Skia builds its first picture, through the JS thread, which is busy for seconds when a recording starts (debug build, emulator, host load 6-12; the timer skips in the same seconds). I tried a UI-thread `measure()` in the meter's clock: the canvas was still empty at 00:00:08, so I took it out (no evidence, and it warns under jest). Round one's words under the meter cover the gap. Needs: a profile of the JS thread at recording start in a release build |
| JM-06 switch dialog late | MINOR | not established. Same starvation: under load 10-13 the Audio Monitor sheet did not show within 3 s once and showed within 4.5 s the second time; the tablet then lost its Core link for some seconds. Not measured on a quiet host |
| JT-09 tap versus hold | part | kept: motion spec M-C-19 gives reduced motion the press; in both modes nothing ends without the reason dialog. A ruling can change it (7 test files drive the press) |
| JT-09 banner pushes controls | part | the banner's own container is closing-fix CF-M1 (a native crash at the Finalizing hand-over); while it shows the session actions are read-only. Floating it needs a device crash re-test |
| JT-12 search placeholders | part | the field cuts its hint at its width; shortening the sentence is a wording choice not made |
| JT-13 / JA2-32 rows report "clickable" | part | `ListGroup.Item` of the ready-made kit is a `Pressable`; the rows now carry role text and say what they are |
| JT-21 "Est. Remaining" | part | the replicated `storage` slice has no `estimatedRemainingMs` (J-P3 "to wire"); drawing the model's figure would break the one rule |
| JT-22 Back at step 2 | part | the session exists on the Core from step 2; no operation amends its details (97 operations fixed). "Session Info" is now text, not a dead button |
| JA2-12 mirrored label, tiny DEMO | MINOR | bundled demo asset |
| JA2-16 on the tablet (N-10) | part | the tablet keeps the kit's anchored `Popover` / `Menu`, whose content is not in the tree; the sheet form is one prop away (`sheet`) if the controller wants it there too |
| JA2-29 Metadata tab JSON | part | decision D200 / D201: the tab mirrors the web's record |
| JA2-37 summary / recovery numbers | MINOR | simulator's values (class S in the report) |
| JT-17 | fixed without proof | see 2.2 |

## 4. Device proofs: conditions and disclosures

- Lanes restarted ONCE by me at 10:17 (allowed by the controller's note): lane 2 `stop 2`, `start 2 --with-camera-stub --speech-mic` (not piped, no reset, PID 4987); lane 1 `stop 1`, `start 1` (PID 5105). Line in `contract_wave_j.md`. Not touched again after the controller's notice.
- Sessions: lane 2 SES-20261012-0100 (EV-0070; **2:25, over the brief's 60 s**: under host load 12 the tablet lost its Core link and End Session did not answer; ended through the API with a reason) and -0101 (EV-0071, 1:07, seal rig: ALR-000186, released, rig OFF). Lane 1 SES-20261012-0025 (INCOMPLETE by POWER_FAIL, EV-0015) and -0026 (SEALED, EV-0016). FAKE sources only; `CAM-03` / `MIC-03` never selected, pre-checked, started or tapped.
- One blind tap sequence: five taps at (1534, 1432) landed on the tablet's Login after a reload (an empty area; nothing typed). One Android Back during a recording opened "Leave the monitor?" (answered "Stay on monitor").
- Logcat: tablet 10:41-10:51 and phone 11:06-11:08 read at the end: 0 app ERROR lines, 0 `Worklets`, 0 duplicate-key, 0 PiP lines. Earlier windows were cleared by relaunches before an end-of-window read; in them I saw ONE app error record on the tablet's dev toast at 10:36:29: `motion.uiRuntime.stalled` "The animation runtime stopped answering its heartbeat." - host load 24 from my own jest run (the heartbeat's known false positive; it restarts nothing). `AndroidRuntime` lines of `uiautomator` itself (two dumps at once) are not the app's.
- The Login opened with the soft keyboard up at 2 of 4 normal launches (the username field takes focus at mount); ESC closes it. Not changed.
- Evidence: `.cache/wave-j2/m/` (0700).

## 5. Proof at the end

| Check | Result |
|---|---|
| `npx tsc --noEmit` (apps/mobile) | 0 errors |
| `npm run -s lint -w apps/mobile` | exit 0, no output |
| whole mobile suite, `npx jest`, load 5.0 at the start, both apps stopped | **281 suites, 3,123 tests, all passed, exit 0**, 204.5 s (`.cache/wave-j2/m/suite3.log`). The two runs before it: 5 failed (static rules, my own tests, one 20 s timeout under load 18), then 1 failed (a pinned tile test my change broke) - repaired |

Tests whose pinned behaviour a finding or ruling replaced (each says so in a comment): `evidence-list.test.tsx` (filter keeps the selection), `play-sheet.test.tsx` (Dialog under reduced motion), `live-summary-sites.test.tsx` (rule 8 of D158 DC-4: now the signature row AND the demonstration statement), `settings-live-static.test.ts` (exception list emptied; LIVE idiom list), `summary-live-static.test.ts`, the two session tests that expected "SYS-008".

## 6. Re-drive list for the confirmation judge (normal launch form, quiet host)

1. Tablet Home at rest: "SECURITY NOT REPORTED", "Network: Not reported", MIC tiles "Not measured / — dBFS"; New Session step 2: "Security, Not reported, NOTE".
2. Tablet: device Diagnostics, Audio Monitor during a recording, a Settings sheet - each opens at the first press, ten times.
3. Tablet: `seal-rig 2 blocked` -> Home says "being retried", then "Sealing blocked" with "Retry sealing" -> `release` -> press -> sealed.
4. Tablet item: marker time and transcript time seek; "At the playhead" follows; More -> manifest entry disabled with its reason; a filter that hides the selected item.
5. Tablet: tampered item, press the action bar's Play after the integrity stop (JT-17, not proven).
6. Phone: bell and account sheets with TalkBack; Lock console -> the notice; export wizard to "Complete" (outside tap, result step visible); POWER_FAIL during a recording.
7. Both: End Session by a 1.6 s hold on a loaded host; microphone cards in the first seconds (JM-05 remains); switch dialog latency (JM-06).
8. Sign in as another operator on an armed session and on an unacknowledged Summary (JM-09, by test only); Home with an open setup (JT-24).

## 7. State left (read back 11:25)

Both devices on Login in the environment note's form (`demsdemo:///login?core=LIVE&motion=off`), fields showing only their hints, "Core online", `DEV-0001` / `DEV-0002`, "App v0.1.0", dev toast showing; reverse rules tablet `tcp:8081 tcp:8081`, `tcp:4420 tcp:4422`, phone `tcp:8081 tcp:8081`, `tcp:4420 tcp:4421`; media volume 4 on both (as found; the tablet was 0 during playback). No session open on either lane; both rigs OFF; selector on the FAKE defaults; helper sessions signed out, no jar left; my slot lines released. No git write, no Gradle build, no install.

---
*Generated: 2026-10-12 11:30 WIB*
