---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
row: fix wave I, driver B (apps/core-web) - web findings of re-gates 70 and 75
date: 2026-10-10
agent: coder-execution
narrative_tier: 2
tree: commit 74fd1f1 + the working tree of wave I (no commit, no git write)
contract: delegation_progress/contract_wave_i.md (A1), delegation_progress/contract_wave_i_a2.md (A2)
status: needs-review
---

# 133 - Fix wave I, driver B (core-web)

Area: `apps/core-web` only. `packages/shared`, `apps/core-server`, `apps/mobile` untouched. No lane,
no dev server, no browser, no device: the proof is component tests (one run each; red first).
Paths below are relative to `apps/core-web/src/` unless they start with another root.

## 1. Findings

| Finding | Reproduced (red)? | Fix | Test | Status |
|---|---|---|---|---|
| G75b-02 MAJOR - blocked seal not stated, dialog cannot be left | yes, 8 cases red | section 2.1 | `features/session-monitor/__tests__/wave-i-b-seal-blocked.test.tsx` (12) | fixed |
| G70b-02 - "needs no password" then "refused this user name or password" | yes | 2.2 | `features/devices/__tests__/wave-i-b-connect-wording.test.tsx` (7) | fixed |
| G70b-05 - remaining-attempts count beside a scheme refusal | yes | 2.2 | same file | fixed (web half; the audit detail is A2's) |
| G75b-06 web half - "RTC holdover", "TPM 2.0 Verified", Session Size 47 MB | yes, 9 cases red | 2.3 | `test/wave-i-b-own-core-facts.test.tsx` (14) | fixed; one decision open (D-1) |
| G75b-07 - "An integrity check failed" for any critical fault | yes, 4 cases red | 2.4 | `test/wave-i-b-header-critical.test.ts` (7) | fixed |
| G75b-08 NOTE - "Recording Started" while connecting | yes | 2.5 | `test/wave-i-b-own-core-facts.test.tsx` ("timeline", 3) | fixed |
| G75b-10 NOTE - "Secure timestamp confirmed" after a failed start | not a web-drawn row | none | - | request filed, left (2.6) |
| G70b-06 web half - "Online / Stream live" on an unopened source | yes (module absent = red) | 2.7 | `features/devices/__tests__/wave-i-b-source-state.test.tsx` (11) | rule in; `checkedAt` waits for A2; NOT proven on the rendered selector in Live mode (D-3) |

## 2. Per finding

### 2.1 G75b-02 - a seal that is blocked or retried

Cause.
- `features/session-monitor/finalization-modal.tsx` (before): `closable = sealed || recoveryDone || (finalization && state === null)` - a FINALIZING session whose seal failed never met it, so `isDismissable` was false and no Close button was drawn; the body drew the progress bar ("0% complete") and the note `session.finalization.resumed` whenever `progress.resumed`, which `sealing-progress.ts` derives from `attempt >= 2`. The Core's automatic retries raise `attempt`, so the note appeared with no restart (contract note A1 section 4). Nothing read the blocked-seal alert.
- `features/session-monitor/status-banner.tsx` case `FINALIZING` and `features/dashboard/active-session-panel.tsx` `FinalizingView` drew the running state from the step list alone.

Change.
- NEW `lib/seal-attention.ts`: `useSealAttention(sessionId)`, `useOpenSealAttention()`, `sealAttentionLine()` - the one web reader, a thin wrapper of the shared `sealAttentionOf` (no state member read by name).
- NEW `features/session-monitor/seal-attention.tsx` `SealAttentionNotice` (kit `Alert`): BLOCKED = headline "Sealing is blocked", the failed step's sentence, `SEAL_BLOCKED_DETAIL_SENTENCE[detail]`, the alert's whole message (what restores it), `SEAL_RECORDING_KEPT_SENTENCE`, what the operator can do, and "You can close this window. The session stays open on the Core."; RETRYING = the Core's retry sentence + kept + the closing note.
- `finalization-modal.tsx:93` `attention` joins `closable` (Close button, Escape, click outside); `:139` the body draws the notice INSTEAD of the progress bar and the ETA (no percentage is drawn while the seal needs attention); the heading names the state; `:219` "Resumed after restart" only when `!ownCapture || sawRecovery` (a session of the simulator's capture, where the attempt grows by a recovery alone, or a dialog that followed the session through RECOVERY). Operation 83's `resumed` is not polled by this dialog, so beside a session of the Core's own capture the note is not shown (contract rule 4.2).
- `status-banner.tsx`: FINALIZING with attention reads "SEALING BLOCKED" / "SEALING RETRIED" + the Core's sentence + "The recording is kept on the Core.", tone danger / warning, `data-seal`.
- `active-session-panel.tsx` `FinalizingView`: "Sealing blocked" / "Sealing is being retried", no spinner, no step progress, the same line, `data-seal`.
- The web console has no Sessions list (the tablet has): the rows of the session on the web are the Monitor banner and the Dashboard panel.

Test (examples imported from `@dems/shared/sim`: `SEAL_BLOCKED_EXAMPLE_ALERT`, `SEAL_BLOCKED_EXAMPLE_FINALIZATION`, `SEAL_RETRYING_EXAMPLE_FINALIZATION`, `SEAL_BLOCKED_EXAMPLE_SESSION_ID`; nothing retyped). Red first: `Tests 8 failed | 4 passed (12)` (the four controls). After the fix: `Test Files 1 passed (1) / Tests 12 passed (12)`.

### 2.2 G70b-02, G70b-05 - the connect dialog (ruling A2 sections 1, 2)

Cause: `features/devices/camera-connect-dialog.tsx` drew `common.captureConnect.noPasswordNeeded` for every development candidate, titled every AUTHENTICATION_FAILED answer that was no scheme refusal with `common.captureConnect.outcome.AUTHENTICATION_FAILED`, and drew `camera-connect-attempts` for every AUTHENTICATION_FAILED answer (`failedAttemptsRemaining` is a required member the Core always sends).

Change: `features/devices/camera-connect.ts:270` `connectionTestWording(result)` -> `{ kind: OUTCOME | SCHEME_NOT_ALLOWED | NO_CREDENTIAL_SENT | CREDENTIAL_REFUSED, showAttempts }`; the dialog (`:319`) uses it. Sentences word for word from the contract note (`i18n-web.ts` `web.connect.*`): "A development source can be tested without a password. If the test asks for one, turn on "Enter a user name and password".", "This camera asks for a user name and a password. None was sent.", "Turn on "Enter a user name and password", type them, then test again.". The remaining-attempts line is drawn only for `AUTHENTICATION_FAILED && authenticated === true && reason === undefined`. The lock-out sentence is unchanged.

Test: the rule against operation 95's documented example (`CAPTURE_DISCOVERY_EXAMPLES`, parsed by `CaptureConnectionTestSchema`); the dialog against the shared simulator's own answer of a test without a credential. Red first: `Tests 6 failed | 1 passed (7)`. After: with the two existing dialog files `Test Files 3 passed (3) / Tests 24 passed (24)`. One existing pin changed by delta: `features/devices/__tests__/camera-connect.test.tsx` (the development-source sentence).

### 2.3 G75b-06 - chips of a Core in its own capture

Cause: every chip read the simulator's slices with no host-clock branch - `features/dashboard/status-strip.tsx` (`time.source === 'RTC'` -> "RTC holdover", label "GNSS / Time"), `features/dashboard/security-panel.tsx` (chip `time.chip.RTC` "RTC HOLDOVER"; `tpm.verified` "TPM 2.0 Verified" from `security.tpm.ok`), `features/network-time/{status-banner,system-time-panel,hierarchy-panel,offset-panel}.tsx` (`timeLevel('RTC')` = HOLDOVER, stratum 0, "last sync 07:00:00", offset 0.0), the pill's checklist (`components/shell/secure-pill.tsx`), and `features/session-monitor/model.ts:468` (`session.bytesWritten`, the simulator's 8.2 GB/h formula).

Change.
- `lib/own-capture.ts` NEW `isOwnCaptureCore(state)` / `useOwnCaptureCore()`: the ONE rule outside a session = `isHostClockTime(state.time)` (the shared fact `time.hostClock`, set by the engine exactly where the capture is the Core's own).
- Dashboard strip: "Time - Host system clock", tone default. Dashboard card: time column "HOST CLOCK" with a tooltip that quotes no stratum / offset / last sync; platform column "NOT REPORTED - TPM: not reported - Secure Boot: not reported"; both neutral and not counted as "need attention".
- Network & Time: banner "Host system clock - Connected" with "no time service configured"; chip, source and chain name the host clock; the hierarchy panel states the one fact (no constellation "NO FIX", no tiers, no lock / stratum / last sync / offset / server); the offset panel says "Not measured"; no "RTC holdover" toast.
- Header pill checklist: `platform` row "Not reported", `timeSource` row "Host system clock" (only while the row would read OK; a row that shows a fault keeps it).
- Session size: `features/session-monitor/storage-panel.tsx:47` beside a session of the Core's own capture = the durable bytes of `captureCheckpointsOf(session)` (the reader of the "Durable Fragments" line); none stated = a dash. The simulated lane keeps `bytesWritten`.
- Checkpoint reader: core-web has ONE (`features/session-monitor/capture-checkpoints-model.ts`, now also used by the storage panel). The duplicate the post-gate list names is the mobile copy (`apps/mobile/.../own-capture.ts`) - not in this area; removing it needs a shared reader (C / shared owner).

Test: `HOST_CLOCK_TIME` imported from `@dems/shared/sim`. Red first, together with 2.4 / 2.5: `Tests 14 failed | 7 passed (21)`. After: `Test Files 2 passed (2) / Tests 21 passed (21)`.

### 2.4 G75b-07 - the header's critical sentence

Cause: `components/shell/secure-pill.tsx` drew `shell.securePill.CRITICAL.subtitle` ("An integrity check failed") for every CRITICAL severity of `selectSystemSeverity`.

Change: `components/shell/integrity-checks.ts:70` `selectPillCause` + `:87` `pillSubtitle`: a critical flag of the audit chain or the security platform keeps the integrity sentence; one other kind reads "Critical fault: <common.faultKind>"; several read "<n> critical faults".

Test: 7 cases, two negative controls (AUDIT_TAMPER; TPM_FAILURE beside a power fail keep the integrity sentence).

Limit (stated, not fixed here): the pill's STATE comes from the shared `selectSystemState`, which reads fault flags, not alerts. A blocked seal alone (alert kind SYSTEM, no flag) does not turn the pill CRITICAL; at the re-gate it was the "power fail" of the stop that did (G75b-03, A2 removes that row). The blocked seal is stated by the Monitor banner, the Dashboard panel, the dialog and the bell.

### 2.5 G75b-08 - "Recording Started" while connecting

Cause: the START item is in `session.timeline` from the accepted start command (`packages/shared/src/sim/session-machine.ts:790`); `features/session-monitor/timeline-panel.tsx` drew every item.
Change: `features/session-monitor/sim-adapter.ts:112` `timelineWhileConnecting`; the panel hides the START item while `captureFactsOf(session).capture === 'CONNECTING'`. It appears with its own time once the session reports `captureDurable: true`.

### 2.6 G75b-10 - not a web-drawn row

`grep -rn "TIMESTAMP_CONFIRMED\|Secure timestamp" apps/core-web/src` (tests left out): one comment (`features/session-monitor/integrity-panel.tsx:39`). The row is an audit row of the simulated Core. Request line 13:26:00Z in `delegation_progress/file_requests.md`; nothing changed.

### 2.7 G70b-06 web half (ruling A2 section 4)

Cause: `features/devices/capture-selector-panel.tsx` `StateChips` drew `online` as "Online" and `streamState: LIVE` as "Stream live" on every Core; `features/devices/camera-tile.tsx` drew the PoE port and the bitrate of the simulator's camera slice.
Change: NEW `features/devices/source-state.ts` (`sourceLineState`, `checkedAtOf`, `measuredFiguresShown`) and `source-state-chips.tsx`. On a real-capture Core (`useRealCaptureCore`, the console's existing rule): "Reachable" / "Not reachable"; "Stream live" only while a session is RECORDING (a LOST stream stays); `checkedAt === null` -> "Not checked", no stream chip; the camera tile draws no PoE port, and a bitrate only while recording. Simulated capture is drawn as before. `checkedAt` is read by name (absent = today).

## 3. Commands and results (one run each; a second run only after the red)

| Check | Command (repo root) | Result |
|---|---|---|
| New tests | `npx vitest run --root apps/core-web <the five wave-i-b files>` | 51 passed (12 + 7 + 11 + 7 + 14), each file red before its fix |
| Touched features, existing tests | `npx vitest run --root apps/core-web src/features/{session-monitor,dashboard,network-time,devices} src/test/{integrity-checks,live-dashboard-*,live-devices-{capture-selector,commands,drawer},live-network-time-page,live-runtime-static,live-session-monitor-*,live-shell-*,live-static-ac-c-53,live-w0-camera-words}.test.*` + the new files | `Test Files 55 passed, Tests 530 passed`; the 56th file `src/test/shell-motion.test.tsx` failed ONLY because it opens `src/components/shell/shell.css` relative to the working directory (`ENOENT ... /DEMS/src/components/shell/shell.css`) |
| The same file from the workspace | `npm test -w apps/core-web -- src/test/shell-motion.test.tsx src/test/routes.test.tsx src/features/storage` | `Test Files 4 passed, Tests 83 passed` |
| Typecheck | `npm run typecheck -w apps/core-web` | 0 errors |
| Lint | `npm run lint -w apps/core-web` | exit 0 |

## 4. Checks for the test runner

| Command | Lock | Expected |
|---|---|---|
| `npm test -w apps/core-web` (whole workspace, once per commit) | none | 0 failed; baseline 2001 + 51 new |
| `npm run typecheck -w apps/core-web && npm run lint -w apps/core-web` | none | clean |
| `npm test -w packages/shared -- test/sim-wave-i-a1-seal-blocked.test.ts` | none | A1's holder of the examples this driver imports |

## 5. Re-drive list for the gates (browser, lane 2 unless said)

1. Gate 75: a blocked seal (if one can still be made) - the dialog reads "Sealing is blocked" with the reason, no percent, Close and Escape leave it; Monitor banner "SEALING BLOCKED"; Dashboard "Sealing blocked"; reopening the Monitor shows the dialog again for the still-open session.
2. Gate 75: an automatic retry - the dialog reads the Core's "retry n of N" sentence; no "Resumed after restart".
3. Gate 75: a seal after a real restart of the lane - NOTE the web no longer says "Resumed after restart" beside a session of the Core's own capture (D-2).
4. Gate 75 (G75b-06): Dashboard strip and card, Network & Time page, the pill's checklist on lane 2; Monitor "Session Size" equals the "Durable Fragments" bytes. Lane 1 unchanged ("Synchronized", "TPM 2.0 Verified", demo figures).
5. Gate 75 (G75b-07): the demo capture fault on lane 1 -> header "Critical fault: Capture fault".
6. Gate 75 (G75b-08): Monitor timeline while "Connecting cameras..." shows no "Recording Started".
7. Gate 70 (G70b-02 / -05): development candidate hint; a test without a credential on the stub; the scheme refusal (no attempts line); a wrong account (attempts line stays).
8. Gate 70 (G70b-06): selector line of an unopened source on lane 2 reads "Reachable", no "Stream live"; camera tile shows no PoE port / bitrate; during a recording "Stream live" returns.

## 6. Decisions for the controller

- D-1 (G75b-06): the mark "this Core runs its own capture" outside a session is `time.hostClock`. The platform facts (TPM, Secure Boot) are worded "Not reported" on that mark because the state has no statement of its own (a real-capture Core still sends `security.tpm.ok: true`). Request 13:26:10Z asks for one. The Security Posture column ("SECURE", "All controls active"), the strip's Security cell, the Security & Audit page and the pill's `encryption` / `tamper` rows were NOT changed: the finding names the time chips, the TPM line and the session size.
- D-2 (G75b-02): "Resumed after restart" is no longer shown beside a session of the Core's own capture (the dialog does not poll operation 83). To show the truthful fact the dialog would have to read operation 83's `resumed`.
- D-3 (G70b-06): the selector chips and the tile figures follow the ruling; the rule and the chips are proven as a unit, the rendered selector in Live mode on a real-capture Core is left to the gate (item 8).
- D-4: the new sentences are in `apps/core-web/src/i18n-web.ts` (key `web`, merged by `i18n.ts` as the mobile app merges its own tree), because packages/shared was closed to this driver. Request 13:26:20Z offers the move.
- D-5: while a seal needs attention NO percentage is drawn (the bar is replaced by the notice); the step list stays (it shows which step failed - a fact of the state).

## 7. Open items

- `checkedAt` (A2 section 6 was empty when this note was written): nothing to do on the web when it lands.
- Storage page KPI "session size" (`features/storage/kpi-cards.tsx:35`) still reads `session.bytesWritten`; not named by the gate, not changed.
- Dashboard "Recent Events" may still list `RECORDING_STARTED` while connecting (G75b-08 names the timelines).
- The duplicate checkpoint reader is web + mobile, not two web readers.
- Plan tracking table, `status_tasks.md`, `99_implementation_report.md`: not written (driver rules; the task asked for this file).

---
*Generated: 2026-10-10 20:30 WIB*
