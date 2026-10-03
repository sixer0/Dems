---
task_id: 2026-09-30_dems_demo_stack_setup
blueprint_row: 93b
date: 2026-10-01
agent: coder-execution
narrative_tier: 3
status: complete
source_plan: identification/02_structured.md Parallel Execution Protocol P1 (package.json single writer); decisions D67 (a)
closes: R-93-1 (implementation/65_demo_evidence.md §8)
---

# 66: `@dems/shared/demo-data` subpath export (step 93b)

Run on 2026-10-01 from 04:50 to 04:57 WIB, from `/Users/gsp-budi/Documents/DEMS`. **Outcome: PASS.** `@dems/shared/demo-data` now resolves in all five consumer resolvers: TypeScript, Vite, tsx, jest-expo and Metro (§2). This closes R-93-1, so steps 47, 53 and 83 can import the module.

## 1. The change

One line was added to the `exports` map of `packages/shared/package.json`, directly after `./brand`. It uses the same plain-string form as the other subpath entries (`./sim`, `./i18n` and `./brand`), none of which use a conditional object:

```json
    "./demo-data": "./src/demo-data/index.ts",
```

The edit ran under `/usr/bin/lockf -k -t 600 .locks/npm.lock sh -c 'perl -0pi -e …'` (exit 0).

| Check | Evidence |
|---|---|
| This is the only change | The file already had uncommitted changes from earlier rows (i18n, brand, assets, scalar.css, scripts, deps), so I saved `git diff packages/shared/package.json` before and after the edit and compared the two. The only new diff line is `+    "./demo-data": "./src/demo-data/index.ts",`. The other differences are hunk-header offsets and the blob id |
| Removing the line restores the old file exactly | `grep -v '"./demo-data": …' package.json \| shasum -a 256` gives `79bd553e…61ced8`, the same as the pre-edit SHA-256. After the edit the SHA-256 is `543fe1cf…ced91b9`, and it was unchanged at 04:56 |
| `package-lock.json` untouched | SHA-256 `b43ae186…2eadcb` before, after the edit and at 04:56. Its `git diff` comes from earlier install rows, not this step. No npm install ran |
| Valid JSON | `node -e 'require("./packages/shared/package.json").exports["./demo-data"]'` gives `"./src/demo-data/index.ts"`. `exports` has 14 keys |

## 2. Resolution proof

Every probe also resolved a non-existent subpath (`@dems/shared/demo-dataX`) or the existing `@dems/shared/sim` as a control. That shows the resolver really enforces `exports`, so a pass cannot be a fallback.

| Consumer | Method | Result |
|---|---|---|
| core-web: TypeScript | Scratch `probe.ts` under `$TMPDIR` with `tsconfig.json` extending `apps/core-web/tsconfig.app.json` (bundler resolution, DOM lib, `noUnusedLocals`) and a `node_modules` symlink to the root. `tsc -p … --noEmit --traceResolution` | "Module name '@dems/shared/demo-data' was successfully resolved to '…/packages/shared/src/demo-data/index.ts'". tsc exit 0. Control `demo-dataX`: TS2307, exit 2 |
| core-web: Vite | Vite `createServer({ root: apps/core-web, configFile: false, middlewareMode, hmr: false, ws: false })`. The app's config is not loaded, so the router plugin writes nothing. `pluginContainer.resolveId(…, src/main.tsx)`, then `ssrLoadModule` | `@dems/shared/demo-data` resolves to `…/packages/shared/src/demo-data/index.ts`. `ssrLoadModule` gives 41 exports and 14 packages. Control `demo-dataX` is rejected: "not exported under the conditions ["module", "browser", "development", "import"]" |
| core-web: tsx | `node --import tsx -e "import('@dems/shared/demo-data')…"` from `apps/core-web` | `41 exports; 14 packages; 0004`, exit 0 |
| mock-core: tsx | The same command from `apps/mock-core` | `41 exports; 14 packages; 0004`, exit 0 |
| mobile: jest-expo | Scratch `apps/mobile/src/s93b-demo-data-probe.test.ts`, run with `npx jest --maxWorkers=2 --runTestsByPath …`. The same shell deleted it through a `trap`/`rm` | `PASS`, 1 of 1. `require.resolve` gives `…/packages/shared/src/demo-data/index.ts`. 41 exports, 14 packages, `getDemoEvidencePackage('0004')` works, `verifyDemoPackage` is a function. jest exit 0. `ls src \| grep -c s93b` gives 0 |
| mobile: Metro | Metro 0.84.5's own `resolvePackageTargetFromExports`, with the resolver settings from `expo/metro-config` `getDefaultConfig(apps/mobile)`: `unstable_enablePackageExports: true`, conditions `{"ios":["react-native"],"android":["react-native"],…}` | For android and ios, `@dems/shared/demo-data` gives `sourceFile …/packages/shared/src/demo-data/index.ts` (the file exists), and so does the control `./sim`. `demo-dataX` fails with `PackagePathNotExportedError`. This checks the exports step only; a full bundle was not run (§3) |

## 3. Regression

| Check | Command | Result |
|---|---|---|
| Shared typecheck | `npm run typecheck -w @dems/shared` | exit 0 |
| Shared tests | `npm test -w @dems/shared -- --maxWorkers=2` | `Test Files 23 passed (23)`, `Tests 393 passed (393)`, exit 0. This matches the step-93 baseline |

**Limit:** the Metro check ran Metro's exports resolver, not a full `expo export` bundle. A full bundle would compile the whole app and write output, which is out of scope. The step-47, 53 and 83 bundles will be the end-to-end check. The "failed to copy trust settings of system certificate" lines on stderr are sandbox noise (P11), and they appear on every node or npx call.

## 4. Scope and cleanup

- Only `packages/shared/package.json` was edited. Nothing was committed.
- Scratch files have been removed. `$TMPDIR/s93b_probe/` held the probe files, the tsconfig, the Vite and Metro harnesses and the symlink. `apps/mobile/src/s93b-demo-data-probe.test.ts` was deleted, and so was a short-lived `apps/core-web/.s93b-vite-resolve.mjs` from the first Vite attempt. `ls` confirms none is left.
- `apps/core-web/node_modules/.vite/deps` still shows mtime 03:15, so Vite did not write a cache.
- I did not write the shared tracking files (`masterplan/02_plan.md`, `status_tasks.md`, `delegation_progress_report.md`) because this was a parallel run under P8. The controller needs to mark row 93b done and R-93-1 closed.
