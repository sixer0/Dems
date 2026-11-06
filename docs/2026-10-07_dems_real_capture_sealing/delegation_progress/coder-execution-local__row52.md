# Row 52 — coder-execution-local (phase C, M2-W10) — FINAL

## Status: COMPLETE (reconciled an interrupted attempt)
Capture-config module (store/slices/boot, NM-09) + devices v2 status feed (CS-06 read) + real-mode
demo fencing (CS-23) + rbac.matrix boot equality vs seeded grants (SH-04). Targeted non-db run exit 0.
Row-scope typecheck clean. No source rewrite needed — the prior partial edits were complete and coherent;
this run verified them against C3/specs and proved them.

## Anti-hang / anti-stuck
No `timeout`/`gtimeout` on this macOS host. Every long command ran through the tracked background-process
monitor (wall-time cap, returns as the process exits). vitest: `CI=true`, `--run`, `--maxWorkers=2`,
`--project unit`, `< /dev/null`, never watch. `unit` project structurally excludes `*.db.test.ts`. Never
took `.locks/db-migrate.lock`. Reported progress after each step.

## Gates (fresh, quotable)
- targeted run `npx vitest run --project unit --maxWorkers=2 --run src/modules/capture-config src/modules/devices/__tests__/status.test.ts src/modules/devices/__tests__/routes.test.ts </dev/null` -> **Test Files 5 passed (5) / Tests 102 passed (102)**, exit 0 (M2-RG-CSU)
- rbac boot equality (fake boot, no DB, seeded rows from `rbacRows()`) -> `[row52] rbac.matrix boot equality | stored=22 shared=22 equal=true`; four new grants inside; negative control drops SUPERVISOR CAPTURE_CONFIG -> boot refuses `STORED_GRANTS_MISMATCH` naming it (M2-API-3 / M2-MT-7 / D88)
- fencing 403 end-to-end -> flag OFF + SUPERVISOR: `injectFault`/scenario/status/reset all **403 DEMO_DISABLED** before the body, engine commands `[]`, audit rows `[]`; positive control flag ON -> **204** reaches hosted action; TECHNICIAN -> `NOT_PERMITTED` (audited); ANON -> 401 (CS-23 / OD-18)
- fencing 409 -> code exists in `ApiErrorCode`; `resetDemo` documents `responses['409']`; fencing data names both refusals (live DB+disk guard = row 54, deferred)
- M2-API-3 slice-count clause -> `REPLICATED_SLICE_NAMES` length **30**, `[28]=captureConfig`, `[29]=captureDevices`
- M2-MT-7 seed-count clause (in-memory at seed source) -> permissions **14**, grants **22** (INV5/SUP12/TECH5) == `ROLE_PERMISSIONS`; capture baseline 1/5/0
- row-scope typecheck `npx tsc --noEmit` filtered to capture-config/devices -> **0 errors**

## Deferred to checkpoint 55 (with reason)
- `effects.db.test.ts` — db-project test; this turn forbids db runs + the migrate lock (row 54 sole db-runner). Edits reconciled in-scope (AUDIO->MIC re-key, exhaustive `URL_OF`), not executed here.
- live `409 RESET_BLOCKED_REAL_EVIDENCE` refusal — needs a REAL sealed package on DB+disk; owned by row 54's guard.
- workspace-wide `tsc` green — 25 residual errors in 7 UNMODIFIED out-of-scope files (`to-rows.test.ts`, `ticks.db.test.ts`, `evidence/index.ts`, `rbac/matrix.db.test.ts`, `permission-guard/{decision,denial}.test.ts`, `test/acceptance/rbac-matrix.support.ts`), all consumers of shared-shape changes from rows 47/48/49/51 (AudioSlice re-key, AccessCaller.sessionCreatorId, op-42 QUEUED, SESSION_HOLDER). None reference capture-config; none in this row's editable set. = the consolidated RECON wave (D38 RECON-1..5), independently flagged by rows 47/47a/50/51 on the board.

## Boundary
Edited ONLY `apps/core-server/src/modules/capture-config/**` (new) and `apps/core-server/src/modules/devices/**`.
Did NOT touch packages/shared, core-web/mobile, mock-core/release, migrations, openapi.json, the lockfile, or
the trackers (status_tasks.md, delegation_progress_report.md). No git push/remote; no sudo; no db lock.

## Files
Artifact: implementation/18_m2_config_demo.md (Tier 3). Full changed-file list in artifact §6.
