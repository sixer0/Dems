---
agent: coder-execution
step: 100
decisions: D104, D110, D112
status: complete
date: 2026-10-01
---

# Step 100: web Core origin (parallel-run progress note)

**Status:** complete. The browser check was not run: the sandbox returned EPERM on local listen and connect, and D112 asked to skip optional work.

**Log:** `implementation/73_web_core_origin.md`. It holds the contract for step 95 in §3.

## Files created
- `apps/core-web/src/env.d.ts`
- `apps/core-web/src/lib/core-endpoint.ts`
- `apps/core-web/src/lib/packaged-csp.ts`
- `apps/core-web/src/lib/__tests__/core-endpoint.test.tsx`
- `apps/core-web/src/lib/__tests__/packaged-csp.test.ts`
- `docs/2026-09-30_dems_demo_stack_setup/implementation/73_web_core_origin.md`
- this file

## Files modified
- `.gitignore`: appended `/release/` and `apps/mobile/signing/`
- `apps/core-web/vite.config.ts`
- `apps/core-web/src/routes/__root.tsx`
- `apps/core-web/src/features/home/use-health.ts`
- `apps/core-web/src/features/login/login-model.ts`
- `apps/core-web/src/features/api-reference/`:
  - `api-document.ts`
  - `index.tsx`
  - `realtime-panel.tsx`
  - `server-strip.tsx`
  - `service-banner.tsx`
  - `sim-fetch.ts`
  - `use-realtime-feed.ts`

## Reverted (net zero)
- I edited `packages/shared/src/api/health.ts` and `openapi.ts` before D110 arrived, then restored both exactly.
- `packages/shared/test/core-origin.test.ts` was created, then deleted.
- The openapi drift test passes, 21/21.

## Verification
- **core-web:** typecheck exit 0, oxlint exit 0, vitest 39 files / 438 tests passed. The first run had 4 P11 failures while step 54 was writing the devices, storage and network-time `sim-adapter.ts` files. They were green on re-run.
- **shared:** typecheck exit 0, oxlint exit 0, vitest 28 files / 508 tests passed.
- **Mutation check:** dropping `url={coreWsUrl()}` makes the 2 packaged wiring tests fail.
- **git check-ignore:** `release/probe` and `apps/mobile/signing/x` are ignored; `scripts/release/build-web-packages.ts` is not.

## For the controller
- **Decision to record:** the `.gitignore` line is `/release/`, anchored, instead of `release/`. The unanchored form would ignore step 95's `scripts/release/` sources.
- **End-pass items:**
  - Optionally move `fetchCoreHealth` and `pointAtCoreOrigin` into the shared §3.4 options (`fetchHealth(fetchImpl, origin)`, `serverUrl`) once step 54 is done.
  - The health operation's prose in `core-api.ts:427` still names `127.0.0.1:4400` in packaged mode.
- **Not written:** `masterplan/02_plan.md`, `status_tasks.md` and `delegation_progress_report.md`. They are shared files and this is a parallel run.
- **Collisions:** none with step 54 (`shared/src/sim/**`, `sim-adapter.ts` files) or step 45b (media, motion, presentation files).
