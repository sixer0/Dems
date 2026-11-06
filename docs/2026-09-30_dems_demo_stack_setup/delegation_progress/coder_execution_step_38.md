---
step: 38
agent: coder-execution
plan_row: 02_plan §4 W-06 (app shell and routing skeleton)
status: complete
started: 2026-10-01 02:59 WIB
finished: 2026-10-01 03:25 WIB
log: implementation/19_app_shell.md
---

# Step 38: Web app shell and routing skeleton (progress)

| Time (WIB) | Event |
|---|---|
| 02:59 | Inputs read: 02_structured row 38 and P1–P13; 01_specs §14.2–§14.4, §14.6, §14.8, §14.11, §14.13–§14.14; 04 §1–§2; 03_motion_spec §3–§4; implementation 11, 12, 15, 16; D28, D38, D41, D45, D48, D49, D52, D53, D54; ui_design D1 and SM |
| 03:05 | Wrote `src/i18n.ts`, `src/router.tsx`, `routes/__root.tsx` (providers), `components/shell/*` (13 files), 16 route files + `routes/-search.ts`, 13 feature stubs; moved `routes/index.tsx` → `routes/_app/stack-check.tsx`; `main.tsx` now builds the sim + router context; `shell.ts` i18n: +14 keys (SECURE checklist) |
| 03:12 | Route tree generated with `@tanstack/router-generator` (same config as the Vite plugin); core-web typecheck 0, lint 0; probe confirms typed routes and typed i18n keys reject bad values |
| 03:14 | `src/test/routes.test.tsx` 31/31 (first run 28/29: my redirect expectation used a non-canonical href; fixed) |
| 03:15 | Controller D59: 5174 is held by another project (SMART WMS, PID 3550; not touched); web lane A uses Vite **5176** for dev checks. Bare MotionConfig kept (step 41 swaps in MotionPolicyProvider) |
| 03:16–03:20 | Browser checks on Vite 5176 (dems.auth seeded, P4): Browser pane (agent-browser not installed) + existing chrome-headless-shell 1243 over CDP. Fixed three visual defects found: Drawer transparent (shell vars not on :root for portaled parts), kit button icons forced to 16 px (kit selector specificity (0,2,2)), "API Reference" wrapping or truncating at 1440 |
| 03:20 | `npm run build -w @dems/core-web` exit 0; entry chunk gzip -9 164431 B; no `scalar` in the entry chunk |
| 03:21 | Mutation check (guard off + test ID renamed) → 4 failures; files restored byte-identical. routeTree.gen.ts regenerated → identical sha1, 16 route imports |
| 03:21:52 | Final gate after the last edit: core-web typecheck 0, lint 0, test 6 files / 64 tests; shared test 12 files / 239 tests, typecheck 0 |
| 03:23 | Final captures: AC-59 232/80, 216/72, 72/72, 0/64 (+ 600 px 0/64); no truncated labels. All my processes stopped (Vite 97757/97781 and 1546/1567, headless shells); port 5176 free; pane tab closed |
| 03:24 | Wrote `implementation/19_app_shell.md` (Tier 3). Status **complete**; decisions DR-38-1..16 recorded there; no blockers |

## Files written (step 38)

- `apps/core-web/src/main.tsx` (modified), `router.tsx`, `i18n.ts`
- `apps/core-web/src/routes/__root.tsx` (modified), `-search.ts`, `_app.tsx`, `login.tsx`, `_app/{index,dashboard,devices,storage,network-time,security-audit,system,stack-check}.tsx`, `_app/session/{index,new}.tsx`, `_app/evidence/{index,$evidenceId}.tsx`, `_app/developer/api.tsx`; `routes/index.tsx` moved → `_app/stack-check.tsx`; `routeTree.gen.ts` (regenerated)
- `apps/core-web/src/components/shell/{app-shell,app-layout,top-bar,sidebar,secure-pill,notifications-bell,user-menu,nav-drawer,bottom-tabs,page-header,brand-emblem}.tsx`, `{integrity-checks,nav-items,use-shell-layout,index}.ts`, `shell.css`
- `apps/core-web/src/features/{dashboard,session-monitor,session-new,evidence,devices,storage,network-time,security-audit,system,api-reference,login,stack-check}/index.tsx`
- `apps/core-web/src/test/routes.test.tsx`
- `packages/shared/src/i18n/en/shell.ts` (+14 keys)
- `docs/…/implementation/19_app_shell.md`, `docs/…/implementation/assets/19_shell_*.png` (7)
