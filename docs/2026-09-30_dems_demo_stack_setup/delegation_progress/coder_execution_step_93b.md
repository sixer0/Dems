---
step: 93b
agent: coder-execution
status: complete
started: 2026-10-01T04:50+07:00
finished: 2026-10-01T04:57+07:00
---

# Step 93b: `./demo-data` subpath export (progress)

| Time (WIB) | Event |
|---|---|
| 04:50 | Inputs read: D67 (a), 65_demo_evidence.md (R-93-1) and `packages/shared/package.json`. Subpath entries use the plain-string form, not conditional objects. Saved the baseline: the existing `git diff` of package.json (changes from earlier rows), package.json SHA-256 `79bd553e…` and package-lock SHA-256 `b43ae186…` |
| 04:51 | Under `lockf .locks/npm.lock`, inserted `"./demo-data": "./src/demo-data/index.ts",` after `./brand`. Comparing the diff before and after shows only that line. Removing the line gives the pre-edit SHA-256 again. The lockfile hash is unchanged |
| 04:52 | Web: tsc with the core-web tsconfig resolves the subpath (trace, exit 0; `demo-dataX` gives TS2307). Vite `resolveId` and `ssrLoadModule` give 41 exports and 14 packages, and Vite rejects `demo-dataX`. tsx import from core-web and mock-core: 41 exports, 14 packages |
| 04:53 | Mobile: a throwaway jest-expo test passes 1 of 1, `require.resolve` points to `packages/shared/src/demo-data/index.ts`, and the test is deleted. Metro 0.84.5's exports resolver with the Expo default config (android and ios, `react-native` condition) gives `index.ts`, and `demo-dataX` is not exported |
| 04:56 | Shared typecheck exit 0. Tests: 23 of 23 files and 393 of 393 tests. Final hashes: package.json `543fe1cf…`, package-lock `b43ae186…` (unchanged). Scratch removed |
| 04:57 | Log `implementation/66_demo_data_export.md` written |

**Status: complete.** R-93-1 is closed, so steps 47, 53 and 83 can import `@dems/shared/demo-data`.

**Files written:**
- `packages/shared/package.json`: one line added to `exports`
- `implementation/66_demo_data_export.md`
- `delegation_progress/coder_execution_step_93b.md`

**For the controller:** set row 93b to done in `masterplan/02_plan.md` and `status_tasks.md`, and note that R-93-1 is closed (I left them alone because of P8). Metro was checked at the exports-resolver level, not with a full bundle. The bundles in steps 47, 53 and 83 will be the end-to-end check.
