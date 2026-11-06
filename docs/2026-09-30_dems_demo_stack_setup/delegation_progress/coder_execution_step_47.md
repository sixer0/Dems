---
step: 47
agent: coder-execution
plan_row: 02_plan §4 W-13 (Evidence list, detail and export wizard; D50 real media and real integrity verification)
status: complete
started: 2026-10-01 05:45 WIB
finished: 2026-10-01 07:00 WIB
lane: web (shared Vite 127.0.0.1:5178, P14/D72)
log: implementation/26_page_evidence.md
---

# Step 47: Evidence list, detail and export wizard (progress)

| Time (WIB) | Event |
|---|---|
| 05:45 | Inputs read: 02_structured row 47 + Parallel Execution Protocol; 01_specs §14.2, §14.5.3, AC-63, AC-64; research/04 §5.1; ui_design/DEMS-Mobile.png MB 5/6; 03_motion_spec §1–§3, §5 (M-C-09, M-C-11, M-C-21), §6 M-PG-EVID, §8, §9; implementation 13 §2, 18, 19, 20, 64, 65, 66; decisions D28, D38, D41, D49, D50, D61, D63, D67, D70–D72 |
| 05:45 | Write set (P6): `apps/core-web/src/features/evidence/**`, `packages/shared/src/i18n/en/evidence.ts` (additive), own tests (`apps/core-web/src/test/evidence-table.test.tsx`, `apps/core-web/src/features/evidence/__tests__/*`), this file, `implementation/26_page_evidence.md`, `implementation/assets/26_*` |
| 05:45 | Progress file created; implementation started in `apps/core-web/src/features/evidence/` |
| ~06:00 | Controller relay D74 (review 40 §6 R1–R10, M2/M3/M4, m12) applied: package paths only (no `evidenceMedia()`), one glob over demo-media + demo-evidence, M4 join guard (case + subject + session suffix), package verdict only (SIM-GAP-W47-1), demo-data kept in a lazy chunk |
| 06:16–06:30 | Tests written: `src/test/evidence-table.test.tsx` (AC-64, 8), `__tests__/evidence-integrity.test.tsx` (9), `__tests__/evidence-export.test.tsx` (7), `__tests__/evidence-media.test.tsx` (4) — 28/28 green. Found: Vite `server.fs.deny` blocks `*.pem` → certificate from demo-data module (DR-47-3); RAC SharedElementTransition needs `getAnimations` in jsdom (harness stub) |
| 06:32–06:38 | Full suite showed step-41 shell tests timing out on `/evidence` cold load under load avg 30–40 → page shells made light, bodies `React.lazy` (DR-47-4); detail ID split into prefix/suffix spans so the step-38 route test's `getByText(id)` stays unique |
| 06:40 | core-web typecheck exit 0; oxlint (feature + test) 0 diagnostics; core-web suite 318/319 — the 1 failure and 1 failed suite are foreign (step 42's deleted probe file `zz-import-timing`; shell-motion "escalation pulses" waits on the dashboard's ambient slots) — P11 |
| 06:41–06:53 | Browser pass (chrome-headless-shell 1243 / Chromium 153 over CDP, shared Vite 5178): found and fixed B-47-1 (kit rows commit after the parent effect → MutationObserver row motion), B-47-2 (chips over the stills' burned-in OSD → moved below), B-47-3 (1440 table cramped → thumbnails ≥ 1600 only, nowrap), B-47-4 (invisible selection boxes → outlined), B-47-5 (oversized player → 42vh cap). Results: fps 60.2/60.3, 0 long tasks after warm-up, ambient 1/4 (shell), verify EV 0001 PASS 8/8 computed, EV 0005 FAIL `track:AUDIO-02` only, media in sync with MIC switch, EXP-000031.zip downloaded with SHA-256 = export manifest, investigator denial, reduced motion static |
| 06:57–06:58 | B-47-6: header flight cancelled by StrictMode → origin kept per item; re-probed: 51 frames from the preview heading to rest |
| 06:59 | Final gates: typecheck exit 0; lint exit 0 (feature 0 diagnostics); core-web 26 files / 320 tests exit 0; mutation check 4 mutations → 5 failing tests, restored (cmp) |
| 07:00 | Processes: Chrome 20469 and 34312 stopped; shared Vite stopped twice as last registered user under `.locks/vite.lock` (95238/95266 of another step; 34217/34240 restarted by me); ports 5178 and 9347 free. `implementation/26_page_evidence.md` written. Status **complete**. Shared controller files not edited (P8) |
