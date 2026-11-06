---
task_id: 2026-10-04_dems_backend_rbac_pairing
agent: explore
blueprint_row: 3
date: 2026-10-04
status: complete
---

# explore, row 3: web console consumption of the simulator

## Status

complete. Read-only inventory; no file under `apps/`, `packages/`, `release/` or `scripts/` was changed (`git status --porcelain apps packages scripts release` prints 0 lines). No server or process was started. No web call was made.

## Files created

- `/Users/gsp-budi/Documents/DEMS/docs/2026-10-04_dems_backend_rbac_pairing/research/01c_explore_web.md` (the row's one deliverable, Tier 2, 700 lines)
- `/Users/gsp-budi/Documents/DEMS/docs/2026-10-04_dems_backend_rbac_pairing/delegation_progress/explore_step_3.md` (this file)

Scratch files (parse scripts, draft parts) stayed in the session scratchpad and are not part of the deliverable.

## Milestones

1. Counted the match set at run time: 167 files under `apps/core-web/src` match `@dems/shared/sim` (blueprint time: 167).
2. Grouped them into 18 groups (components/composed, components/media, components/shell, 10 feature folders with a simulator import plus api-reference, lib, main.tsx and router.tsx, routes, src/test); 167 rows, 0 missing, 0 duplicated, re-checked on the final file.
3. Read each of the 11 `sim-adapter.ts`, the sign-in controller, the 4 route/guard files, the shell leave path, `core-endpoint.ts`, `packaged-csp.ts`, the API Reference simulated-fetch path.
4. Located every synchronous-return dependency with `file:line`: 14 production sites for 11 value-returning actions (section 5.1), 36 void-action call sites that depend on synchronous throw, 7 read-your-write sites, 3 route guards, plus test sites.
5. Quoted storage keys (2 shared, 6 web-owned) and guards from code.

## Findings the controller should know (details with sources in the file)

- One `Sim` is created in `main.tsx:37`; the router context, `SimProvider` and the hooks are the three injection points.
- Roles and permissions are client-side (`selectCan` over static `ROLE_PERMISSIONS`); nothing in the web reads a server permission; navigation is not gated.
- Sign-in is synchronous and client-side (`SignInResult` consumed at `use-login-controller.ts:196,215`); stored session is `dems.auth` plus `dems.sim.v1` in `sessionStorage`, managed by the shared simulator, never by web code.
- The web re-verifies the audit hash chain itself (`security-audit/model.ts`) and verifies evidence packages in-browser from bundled files.
- Core origin is `http://127.0.0.1:4400` or same-origin; no third origin and no dev proxy; packaged CSP `connect-src` allows loopback `ws://` only; the CSP text is duplicated in the launcher and pinned by a test.
- 24 `createSim(` calls in 19 test files plus `main.tsx`; 7 test files write state with `store.setState`.

## Blockers

None.

## Deviations

None from the row text. Two methodological notes: Graft indexes 343 of 360 web files and missed four of five callers of `useSimCommand`, so `grep` decided the groups; the per-file regex columns are a lower bound (labelled so in the file).

## Decisions needed (controller to record)

1. Row 14 must decide whether the Live source sits behind the existing synchronous `Sim`/`useSim` contract or introduces an asynchronous actions contract; the file gives the counts of sites each choice touches (14 Class A, 36 Class B, 7 Class C, 3 guards, the static permission table).
2. Row 18 must keep the 28 simulator-dependent test files runnable in Simulated mode (19 construct `createSim` directly).

## Environment note (not an action by this row)

`apps/core-web/src/.DS_Store` appeared during the run (file count 360 at the start, 361 at the end); it is git-ignored (`apps/core-web/.gitignore:19`) and was not created by any command of this row.
