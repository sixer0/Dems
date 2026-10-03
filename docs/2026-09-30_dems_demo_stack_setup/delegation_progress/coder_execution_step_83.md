# coder-execution — step 83 (mobile Evidence list, detail, export and play sheets, M-12)

| Field | Value |
|---|---|
| Step | 83 (blueprint row 83, rev 4; 05_mobile_plan M-12) |
| Agent | coder-execution (mobile lane, Metro 8084 per D72) |
| Started | 2026-10-01 05:40 WIB |
| Status | complete (D75 fast lane; tablet re-checks in the end pass) |
| Finished | 2026-10-01 09:40 WIB |
| Output log | implementation/55_mobile_evidence.md |

## Owned write paths (P6)

- `apps/mobile/src/features/evidence/**` (screens, their `i18n.ts`, their tests, a local `sim-adapter.ts` for SIM-GAPs)
- `docs/…/implementation/55_mobile_evidence.md`, `docs/…/implementation/assets/mobile/83_<avd>_*.png`, this file

Never: `packages/shared/**`, `src/app/**`, `src/navigation/**`, `src/runtime/**`, `src/components/**`, any `package.json`, jest config, npm install.

## Log

- 05:40 Inputs read: 02_structured row 83 + P1–P13; decisions D17, D28, D38, D43, D50, D51, D55, D58, D61, D66, D67, D68, D69, D71, D72; 04_mobile_specs §2.2–§2.6, §3.1, §3.5, §4.0, §4.10, §4.11, §7.1–§7.8, §9, §10.1, §11 (MA-11/12/13); 05 M-12; implementation 43 (screen contract), 45 (CameraFeed contract, R-2, R-3), 46 (runtime hand-over), 65 (demo-data API), 66 (subpath export); MB 5 and MB 6 crops viewed.
- 05:40 Baseline: concurrent lanes 75 (8081), 77 (8082), 79 (8083), 78 (8085); web 43, 47–51; review 74. No Metro answering on 8081–8086 at 05:39.
- 05:40 Relay D73 received (review 74): F74-13 flat useSim selectors, F74-02 explicit `totalMs` on the pulse builder, F74-03 SubjectTypeChip mapping via `SubjectTypeLabel`. All three applied in the feature code (`use-evidence-data.ts`, `integrity-tab.tsx` VerdictLine, `evidence-chips.tsx`).
- 05:45–06:10 Code: `src/features/evidence/{i18n.ts, evidence-model.ts, evidence-media.ts, use-evidence-data.ts, detail-intent.ts, sim-adapter.ts, use-scramble.ts, use-evidence-playback.ts, sheet-frame.tsx, evidence-chips.tsx, evidence-row.tsx, evidence-list-screen.tsx, evidence-detail.tsx, evidence-detail-screen.tsx, media-tab.tsx, metadata-tab.tsx, integrity-tab.tsx, play-sheet.tsx, export-sheet.tsx, archive-dialog.tsx}`; tests `evidence-list.test.tsx` (T-M15, 7), `evidence-detail.test.tsx` (7), `play-sheet.test.tsx` (4), `evidence-model.test.ts` (22); test-only `testing/{evidence-test-setup.ts, evidence-harness.tsx, kit-helpers.ts}`.
- SIM-GAP-M83-1 (sim EV 0005 not tampered vs package FAIL → the Core's verify is recorded only when the verdicts agree) and SIM-GAP-M83-2 (no per-evidence snapshots) logged in `sim-adapter.ts`.
- 06:10 JS gate (own folder): 4 suites / 40 tests pass; eslint src/features/evidence 0 problems; mobile typecheck exit 0. Next: device sessions on Metro 8084 (phone, then tablet), D68 audio proof.
- 06:21–06:58 Phone device sessions (Metro 8084): MB 5 / MB 6 screens; Verify PASS (0013) and FAIL on AUDIO-02 (0005); **D68 proven** (3 ExoPlayers, 2 audio/mp4a-latm decoders, 2 AudioTracks started at 24 kHz, MIC switch swaps mutedState, Pause → paused). Device fixes: sheet opens after body layout; reduced-motion sheet presentation; sheet keyboard props removed + keyboard padding; full-width hashes; compact facts.
- 06:58–07:04 Tablet session: MA-12 evidence part PASS (rail 8 items, pane-list, pane-detail, selection through sign-in); MA-13 rotation PASS under full motion (PID unchanged); pane split skew after rotation fixed in code (flexBasis 0); PaneLayout freeze under reduced motion = F-83-4 (layout owner).
- **INCIDENT F-83-6:** my interactive tablet session kept `dems_tablet.lock` + Metro 8084 from 06:58 to 09:16:32 (the helper's session cap never fired). Stopped by me at 09:16 (TERM on my perl wrapper); helper cleanup ran; port 8084 free, reverse rules gone. Later sessions self-bounded (AGENT_SECS).
- 09:16 Controller D75/D78 received: fast lane; tablet list/detail to the end pass; emulator rule. Files re-checked: no foreign edits in `features/evidence`; kit SubjectTypeChip now takes sim codes (passed directly); leftover debug log removed.
- 09:17 Gate: typecheck 0, lint 0 (whole app); own tests 4 suites / 39 → 40 after the reduced-motion Dialog test.
- 09:18–09:26 Phone runs: one discarded (reverse rule lost at 09:19:28, P11), one disturbed by my own mid-run edit (Fast Refresh); found the reduced-motion sheet still flaky on a fresh start → SheetFrame renders a kit Dialog under reduced motion.
- 09:29–09:32 Final phone run (Dialog form, `?motion=off`): D68 re-proven (players, decoders, AudioTracks, MIC swap, seek excerpt OSD 13:22:29, pause, close releases); export as SUPERVISOR with the keyboard → EXP-000032 accepted.
- 09:33 Second typecheck/lint failed only in concurrent files of steps 81/85 (P11); `features/evidence` 0 errors. Full jest (09:2x): 10 failures in step 70's navigation suites (3 = stub assertions for the Evidence routes, R-83-1).
- 09:40 Report written: implementation/55_mobile_evidence.md. No processes left running.
