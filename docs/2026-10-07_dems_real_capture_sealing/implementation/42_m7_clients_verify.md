---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
row: 87 (M7-W6, class B) — clients + verify + tamper demo + B9
date: 2026-10-09
agent: coder-execution (single driver; rules D94, ownership D95)
source_plan: identification/02_structured.md row 87 (:419); masterplan/08_client_ux_spec.md flows 3-6; 06_evidence_package_spec.md §D, §F; 03_api_contract.md §3 op 41, §5.3; 10_test_strategy.md M7-VV-WEB / -PHONE, M7-TP-1, M7-FF-*
narrative_tier: 3
status: needs-review — software complete and green; NOT proven: anything on a device or in a browser (B9's logcat result above all), and anything against a package sealed by the Core (row 82)
---

# Row 87 — v2 verify views, forward-only sealing progress, tamper demo on one fragment, B9

## 1. What was built

| Piece | Where (file:line) | Real or stand-in |
|---|---|---|
| ONE defensive reader of the op 41 answer per app: today's contract (`files`, `transcriptOk`, `manifestOk`, `signatureOk`) + the pending members (`overall`, `interrupted`, `checks`, `fragments`, `transcriptState`); absent = null = nothing extra; malformed = dropped and named; an unknown check ID (row 141's V-15) is kept and drawn by its ID; `sources` is not read | web `apps/core-web/src/features/evidence/verify-v2.ts:254` (`readVerifyV2`), `:197` (fragments from findings), `:308` (`verdictOfAnswer`), `:344` (the fragment sentence); mobile `apps/mobile/src/features/evidence/verify-v2.ts:259`, `:202`, `:313`, `:349` | real; the two files are one text (semicolons apart) |
| v2 result view: per camera file stored bytes / decrypted bytes / fragment chain / fragment count, transcript hash, manifest, signature; the failed fragment by name; the per-check list V-01..V-14; the transcript-state label; the interrupted mark | web `verify-v2-report.tsx`, drawn at `integrity-tab.tsx:240`, waiting line `:226`; mobile `verify-v2-report.tsx`, drawn at `live-integrity-tab.tsx:240` | real against the recorded answers (§4) |
| Verdict = the Core's `ok`, through one mapping; pinned stored-verdict line per run unchanged (W92-10 / CF-M2) | web `use-verification.ts:356-377`; mobile `live-integrity-tab.tsx:186` | real |
| v2 run is not paced: no reveal timer, no bar, no "n of m" (the Core reports no progress of a verification); a v2 item (`item.files`) never shows the six v1 rows | web `use-verification.ts:113,146` (`awaitsV2`), `export-wizard.tsx` summary; mobile `live-integrity-tab.tsx:109` (`reveal`, no scramble), `:196` (`v1Revealed`) | real |
| Sealing progress forward-only from the Core's states (percent = floor(mean of step percents), the rule of op 83; a DONE step stays DONE; overall never falls; ETA = the Core's or "Estimating the time left…"; resumed note at attempt >= 2). No clock, no timer | web `features/session-monitor/sealing-progress.ts:73,119`, used at `finalization-modal.tsx:119,178,183`; mobile `features/session-finalizing/sealing-progress.ts:74,120`, `finalizing.model.ts:87`, `session-finalizing-screen.tsx:261,321,326` | real; fed by the simulator's own `progress` / `etaMs` / `attempt` today |
| WB-01 modal: a recovery that resumes the seal draws the finalization body in the SAME dialog (no close/reopen); a recovery that ends SEALED can now be closed (before, the dialog stayed locked) | `finalization-modal.tsx:72` | real (component test); a real resumed seal needs row 82 |
| B9 (FXR-DEV-2, MB-04): every copy of Finalizing that is part of a hand-over (in-place copy AND the route's copy) draws pipeline + status line from React only — no overlay, no entering fade, still Spinners; same for the Steppers of the Summary after the seal; a resumed seal enters without the rise | `session-finalizing-screen.tsx:99,267`; `finalization-pipeline.tsx:30`; `session-summary-screen.tsx:192,565` | real in code; **device result not proven** (§5) |
| B9: the SEALED stamp's rest state is React's (chip at opacity 1 / scale 1 after `STAMP_BUDGET_MS`); the motion starts at the layout of its own view | `sealed-stamp.tsx:44,59,109,140` | real in code; device not proven |
| Tamper demo script on ONE fragment: `DEMO_TAMPERED_FRAGMENT_TRACK = 'VIDEO-02'`, `DEMO_TAMPERED_FRAGMENT_SEQ = 3` (ev §F.2). `DEMO_TAMPERED_TRACK` stays `AUDIO-02`: the 14 frozen v1 packages are untouched | `packages/shared/src/sim/demo-alignment.ts:54-55` | the constant is real; **no v2 demo package exists yet** (§5) |
| Words | `packages/shared/src/i18n/en/evidence.ts:266` (`verifyV2`, one new block), `session.ts:341` (4 keys in `finalization`) | — |

Shared files edited (Edit tool, additive, re-read before): the two i18n files above and `sim/demo-alignment.ts`. Nothing in `sim/api.ts` or `api/**`.

## 2. Unchanged on purpose

v1 verify (Simulated mode, the 14 demo packages, the paced six-row list, the bundled check); "Connecting cameras…" / durable state (rows 72/73); `components/composed/stepper.tsx`; session-new; the audit-type labels of WB-08 / MB-12 (all 67 types are already worded in `common.auditType`, held by `i18n-vocabulary-sync.test.ts`).

## 3. To wire

| When | What |
|---|---|
| the op 41 schema gains the pending members (requests of rows 85 and 119, `file_requests.md` 10:06:23Z / 10:41:09Z) | nothing in the clients: the answer is parsed by the registry schema and reaches the readers as is. Then the fragment name, the 14 checks (incl. a separate certificate row V-13) and the transcript label appear. Until then a failed file says "This answer does not name the fragment…" |
| row 82 (Core verifies a real package; resumed seal) | M7-VV-*, M7-TP-1 and M7-FF-* on real packages; the web dialog's resumed path |
| row 141 | V-15 wording and the `sources` block (the slot: unknown check IDs are already drawn) |
| SH-24 v2 demo regeneration | EV-0005 altered at the two new constants (request filed 11:28:04Z) |
| session-recovery (not this row's folder) | in-place Recovery -> Finalizing draw (request filed 11:28:04Z) |
| integration pass (D95 §7: `labels_status`, `manifest_version`) | MB-05 Summary: per-file hashes, transcript hash, label status, real-signature note — **not built** |

## 4. Verification (commands from the repo root; 2 runs each where a count is given)

```
typecheck  core-web exit 0 · mobile exit 0 · shared 1 error, foreign and known (test/evidence-package.test.ts:453)
lint       core-web 0 · mobile 0 errors (1 foreign warning, runtime/log.test.ts:160) · shared 0
web        npx vitest run --root apps/core-web <evidence, session-monitor, 12 live/static files>   23 files, 224 tests passed (x2)
mobile     npm run test -w @dems/mobile -- --maxWorkers=2 <finalizing, summary, evidence, recovery, hand-over files, i18n, static, lib>   47 suites, 383 tests passed (x2)
shared     npx vitest run --root packages/shared test/i18n*.test.ts test/sim-demo-data-alignment.test.ts test/demo-evidence.test.ts test/evidence-verify.test.ts   5 files, 87 passed
mutations  python3 .cache/row87/mutation-red.py   18 of 18 RED, every source restored byte-exactly
```

New tests: web `features/evidence/__tests__/verify-v2.test.tsx` (25), `features/session-monitor/__tests__/sealing-progress.test.tsx` (15), `test/live-row87-verify-v2.test.tsx` (2); mobile `features/evidence/verify-v2.test.tsx` (18), `live-evidence-verify-v2.test.tsx` (2), `features/session-finalizing/sealing-progress.test.ts` (9), `finalizing-forward-only.test.tsx` (9).

The answers used are RECORDED from the real verifier: row 85's builder + `verifyPackageV2` + `contractBodyOf`, one byte of VIDEO-02 fragment 3 inverted (`.cache/row87/gen-fixture.mts`; run: `TSX_TSCONFIG_PATH=apps/core-server/tsconfig.json node --import tsx .cache/row87/gen-fixture.mts <out.json>`). Result: V-04, V-06, V-08 FAIL (TAMPERED), V-05 not run, the other ten PASS; the clients print "VIDEO-02 fragment 3 tampered (stored-bytes hash mismatch; chain broken from fragment 3)". Today's `body` parses with the registry schema; the body plus the pending members does not (asserted).

Negative controls asked for: a FAIL drawn as passed (W1-W4, M1-M2 red); progress moving without a Core state (a timer added to the web dialog and to the mobile screen: W9, M5 red; held answer + 5 s / 10 s of fake clock: nothing drawn).

Existing tests changed: `session-finalizing-screen.test.tsx` two percent assertions (0 % / 17 % -> the Core's percent computed from the state, bounded by the DONE count); two static file lists gained this row's files; the timer allow-list of `summary-live-static.test.ts` gained `sealed-stamp.tsx` (motion budget). One defect found by a surviving mutant and fixed: a state listing fewer steps made the percent read 100.

## 5. Not proven

- **B9 on a device.** The log of FXR-DEV-2 shows ONE new view tag per pipeline step (5, 7, 9, 11, 13, 15 lines) and one at the Summary (44). Which view it is was not determined from the code: the kit Spinner of the running step (entering/exiting fade + rotation) is the only per-step Reanimated view, the Stepper's overlays are the other candidates. The change removes ALL of them on the hand-over path, so the six cannot come from the pipeline any more; the 44-line tag is unidentified (the stamp is the remaining motion there). Only logcat decides.
- No browser, emulator or build was run. No package sealed by the Core was verified through op 41.
- The ETA is read from the running step's `etaMs`; the simulator writes the RUN's remaining time there, the slice text says "for this step". The line says "About N s left" without naming which.

## 6. Device / browser flows for the M7 gate (2 + 1 each)

| Flow | Steps | Pass |
|---|---|---|
| W-VV (M7-VV-WEB) | open a sealed v2 item -> Hash & Integrity -> Verify | waiting line, then PASS with both file rows, transcript, manifest, signature; with the schema landed: 14 checks incl. V-13 |
| W-TP (M7-TP-1) | Core fixture with one fragment altered -> Verify | FAIL; only that file's row fails; fragment named once the schema carries it; custody detail names it today |
| W-FF (M7-FF-WEB) | End Session on a fake-source recording, watch the dialog; repeat with a Core restart during sealing | percent and steps only advance; after the restart "Resumed after restart", max-seen kept, same dialog, closable at SEALED |
| P-VV (M7-VV-PHONE) | phone: evidence -> Hash & Integrity -> Verify | "Asking the Core…", then the whole v2 result; no v1 track mark |
| T-FF / P-FF (M7-FF-TAB / -PHONE) | tablet and phone on the monitor, stop from the web; repeat with a restart | percent/ETA only advance; no empty frame at monitor -> Finalizing -> Summary |
| B9 logcat | during T-FF / P-FF: `adb logcat -d \| grep -c "Unable to find SurfaceMountingManager"` from the stop to the Summary (run by the operator, not an agent) | 0 lines; if not 0, the tags and counts go back with the frame log |

## 7. Decisions for the controller

| ID | Decision | Alternative |
|---|---|---|
| D-87-1 | On the hand-over path the Finalizing pipeline has no step motion (still Spinner; the Core's percent is the sign of life). Motion stays on a deep link / relaunch | keep the motion and start each Stepper overlay at its `onLayout` — an edit of `components/composed/stepper.tsx`, not this row's file, and equally unproven |
| D-87-2 | Percent = mean of step percents (op 83's rule), so it is finer than "DONE steps / 6" | count DONE steps only |
| D-87-3 | A step drawn DONE stays DONE on a resume even while the Core re-runs it; then no step shows as running, the note says "Resumed after restart" | show the re-run step as running (a step back, against §5.7) |
| D-87-4 | v2 verify shows no progress at all (the Core reports none); the v1 paced reveal is kept for v1 only | pace the v2 rows like v1 |
| D-87-5 | The tamper demo is two new constants; `DEMO_TAMPERED_TRACK` is not changed, because the frozen v1 packages really are altered on AUDIO-02 | change it now (breaks the alignment test of the v1 packages) |
| D-87-6 | The transcript-state codes a client knows are the keys of its wording table, held equal to the verifier's table by a test; the verifier module is not imported at run time (bundle weight) | import `@dems/shared/evidence-verify` in the apps |
