---
step: 40
checkpoint: CP-1
agent: senior-code-reviewer
status: complete
verdict: PASS (0 open blockers)
started: 2026-10-01 05:08 WIB
finished: 2026-10-01 05:45 WIB
output: verification/06_foundation_review.md
---

# Step 40 (CP-1): senior review of the web and shared foundation (progress)

| Time (WIB) | Event |
|---|---|
| 05:08 | Inputs read: row 40, P1–P13, the waves and the single-writer scan; D37–D69; 01_specs §14; 03_motion_spec §7–§9 and §11; 04_mobile_specs SCR-01..07; research/01 §5.3–§6.4 |
| 05:15 | Read implementation logs 12, 13, 14, 19, 20, 64, 65 and 66 (the others scanned for open findings) and the step-39 and step-93b progress files |
| 05:18–05:33 | Read the simulator, api, i18n, demo-data, brand and tokens sources and the core-web motion, shell, composed, media and routes sources; also `vite.config.ts` and `THIRD_PARTY_NOTICES.md` |
| 05:25–05:35 | Scratchpad probes (read-only imports): selector stability; i18n ↔ vocabulary coverage; SECURE pill vs `systemStatus`; simulated-API edge cases |
| 05:33 | Graft: `callers systemStatus`, `callers selectSystemState`, `grep "Suffix"` |
| 05:36 | Fresh gates: shared vitest 23 files / 393 tests pass; shared typecheck exit 0; core-web vitest 13 files / 161 tests pass; core-web `tsc -b` exit 0 (step 44 writing at the same time, P11; the run was clean) |
| 05:37 | D42 anchored greps (one React 19.2.3 and one RN 0.86.3); `npm ls @scarf/scarf` empty; MS-01/02/03 greps clean |
| 05:42–05:45 | Wrote `verification/06_foundation_review.md` and corrected four line references after re-checking them |

**Status: complete. Verdict: PASS**, with 0 blockers, 8 major, 12 minor and 7 nits. Steps 43 and 46–53 may start under the §6 rules R1–R10.

**Findings, with owners:**
- **M1** `selectSystemState` is shallow-unstable, so `useSim(selectSystemState)` loops. Owner **54**; interim rule R1 for all pages.
- **M2** The web `evidenceMedia()` ignores package paths and returns the pristine AUDIO-02 for tampered EV-0005 (and null for 0014). Owner **47** (R2); follow-up **controller**.
- **M3** SIM-GAP-W1: the simulator says EV-0005 is pristine, uses ECDSA keys and synthetic hashes; the packages say the opposite. Owner **54** (§5.c); interim **47, 42**.
- **M4** A suffix-only join attaches the recording-scenario package (0014) to any presenter-created session. Owners **47, 83** (guard); durable **controller → 54**.
- **M5** Session commands have no RBAC check and fall back to `createdBy` for the audit actor. A signed-out stop returns 202 and is attributed to OPR-001; a TECHNICIAN stop returns 202. Owner **54** (§5.e); interim **44, 46, 53**.
- **M6** D62 confirmed: an off-schema case number returns 201. Owner **54** (§5.d).
- **M7** The core-web vitest include is `*.test.tsx` only, so step 53's `scalar-config.test.ts` and `sim-fetch.test.ts` would never run. **Controller ruling needed before step 53.**
- **M8** Presentation mode has no owner (Login reads it, System sets it). **Controller ruling needed before steps 43 and 52**, then 54 closes it.
- **Minor:**
  - m1: sync test (54, spec §5.a);
  - m2: notices lack the demo-media derivation, the eSpeak NG note and the no-macOS-voices statement (controller → 60; check 62);
  - m3: Data gaps: caseType, uptime, write-rate series, per-device health, settings (47, 48, 52 → 54);
  - m4: English display strings without params (54);
  - m5: POWER_FAIL pill/checklist inconsistency (54 + controller);
  - m6: `sim.request` throws URIError (54; interim 53);
  - m7: duplicated helpers (reuse rule; debt → controller);
  - m8: error codes (54);
  - m9: 10 Hz selectors (42/43/44; 54);
  - m10: BorderBeam loop not registered (43; controller for /stack-check);
  - m11: api → sim leaf layering (54);
  - m12: bundle hazards (58, 47, 53).

**Files written:**
- `docs/2026-09-30_dems_demo_stack_setup/verification/06_foundation_review.md`
- `docs/2026-09-30_dems_demo_stack_setup/delegation_progress/senior_code_reviewer_step_40.md`

**For the controller:**
1. Set row 40 to done in `masterplan/02_plan.md` and `status_tasks.md`, and append the review summary to `implementation/99_implementation_report.md`. I did not edit these shared files (P8).
2. Rule on M7 before step 53 and on M8 before steps 43 and 52.
3. Consider P6 hand-overs:
   - `apps/core-web/src/components/media/demo-media.ts` (M2);
   - `packages/shared/src/demo-data/index.ts` → `joinDemoPackage` (M4);
   - `apps/core-web/src/components/shell/integrity-checks.ts` (m5);
   - `THIRD_PARTY_NOTICES.md` (m2);
   - `api/core-api.ts` for 401/403 on start and stop (M5).
4. Relay R1–R10 to step 44 (running) and to steps 42, 43 and 46–53.
5. Record a D-entry for these rulings, and note D61's "case ≤ 64" change if §5.d option 1 is adopted.

**P1–P13:**
- Read-only: no source, config or package edits, no install, no git.
- No Vite or mock-core started; ports 5174, 5175 and 5179 unused.
- Short-lived test, typecheck, npm ls, graft and probe processes only; all exited.
- Probe scripts live in the session scratchpad only.
