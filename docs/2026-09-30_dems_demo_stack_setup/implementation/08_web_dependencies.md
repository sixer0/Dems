---
task_id: 2026-09-30_dems_demo_stack_setup
step: 27
plan_row: 02_plan §4 W-01 part a (SCR-05 export)
date: 2026-10-01
agent: coder-execution
tier: 3
status: complete
---

# Step 27: Web dependencies and shared exports (npm slot 1 of 2)

**Outcome: PASS.** All six row-27 checks pass, with command output below.
- Seven pins were installed exactly, per 01_specs §14.1.
- Four export keys and two scripts were added to `packages/shared/package.json`.
- Only the two workspace manifests and `package-lock.json` changed.

## 1. What changed

| File | Change |
|---|---|
| `packages/shared/package.json` | deps `@noble/hashes` 2.4.0, `zustand` 5.0.15; devDep `@scalar/openapi-parser` 0.29.9; exports `./i18n`, `./brand`, `./assets/*`, `./theme/scalar.css`; scripts `openapi:gen`, `gen:topo` |
| `apps/core-web/package.json` | deps `@scalar/api-reference-react` 0.9.76, `i18next` 26.4.2, `react-i18next` 17.0.15, `zustand` 5.0.15 |
| `package-lock.json` | 1,541 → 1,800 entries (+259, mostly the Scalar/Vue tree) |
| root `package.json`, `apps/mobile/package.json`, `apps/mock-core/package.json` | **Unchanged.** The shasum is identical before and after (`beedfcc…`, `bfa1319…`, `d9bccb4…`) |

**New shared export map**, in the existing convention of one `index.ts` per module:

| Key | Target | Who creates the target |
|---|---|---|
| `./i18n` | `./src/i18n/index.ts` | step 34 |
| `./brand` | `./src/brand/index.ts` | step 35 (see hand-off H-1) |
| `./assets/*` | `./assets/*` | steps 28 (`assets/brand/*.png`) and 29 (`assets/hero/*.jpg`) |
| `./theme/scalar.css` | `./theme/scalar.css` | step 30 |

**New scripts:**
- `"openapi:gen": "tsx scripts/gen-openapi.ts"` (script from step 33)
- `"gen:topo": "tsx scripts/gen-topo.ts"` (script from step 35)

The exports and scripts were written by `node edit_shared_manifest.mjs`, a session scratchpad script. It aborts if an existing export or script would be dropped or changed, and every existing key kept its value and order.

## 2. Commands (P1 npm slot, R-2, R-4)

The whole slot ran as one hold of the lock, so step 67 could not interleave:

```
/usr/bin/lockf -k -t 3600 .locks/npm.lock sh install.sh
```

`install.sh` exports `npm_config_cache=/Users/gsp-budi/Documents/DEMS/.cache/npm` and `npm_config_update_notifier=false`, then runs:

```
npm install --save-exact --no-fund zustand@5.0.15 @noble/hashes@2.4.0 -w @dems/shared
npm install --save-exact --no-fund --save-dev @scalar/openapi-parser@0.29.9 -w @dems/shared
npm install --save-exact --no-fund zustand@5.0.15 @scalar/api-reference-react@0.9.76 i18next@26.4.2 react-i18next@17.0.15 -w @dems/core-web
node edit_shared_manifest.mjs
```

```
exit=0 duration=31s
[step27] npm.lock acquired 2026-10-01 02:12:48
added 1 package … / added 13 packages … / added 245 packages, and audited 1677 packages in 25s
shared manifest updated: exports 13 scripts dev,build,typecheck,lint,test,openapi:gen,gen:topo
[step27] npm.lock releasing 2026-10-01 02:13:19
```

The installs ran inside the sandbox; no bypass was needed. After the run, `lockf -k -t 0 .locks/npm.lock true` succeeded immediately, so the lock is free for step 67. `.locks/` is git-ignored (`git check-ignore` exit 0).

## 3. Verification (row 27 column)

| # | Check | Result |
|---|---|---|
| V1 | `npm ls --workspaces --depth=0` shows every pin exactly | **PASS** (exit 0) |
| V2 | AC-13 (D42 boundary-anchored) prints only react and react-dom 19.2.3 | **PASS** |
| V3 | `npm ls @scarf/scarf` finds nothing | **PASS** |
| V4 | Four export keys present in `packages/shared/package.json` | **PASS** |
| V5 | `git diff --name-only` lists only package.json files and package-lock.json | **PASS** (scoped outside `docs/`, see note) |
| V6 | Root `npm run typecheck` exits 0 | **PASS** |

### V1 output (relevant lines)

```
+-- @dems/core-web@0.1.0 -> ./apps/core-web
| +-- @scalar/api-reference-react@0.9.76
| +-- i18next@26.4.2
| +-- react-i18next@17.0.15
| `-- zustand@5.0.15
+-- @dems/mobile@0.1.0 -> ./apps/mobile
| +-- i18next@26.4.2 deduped
| +-- react-i18next@17.0.15 deduped
| `-- zustand@5.0.15 deduped
`-- @dems/shared@0.1.0 -> ./packages/shared
  +-- @noble/hashes@2.4.0
  +-- @scalar/openapi-parser@0.29.9
  `-- zustand@5.0.15 deduped
```

Manifest and lockfile cross-check (node script over the three JSON files):
- All seven manifest entries are `OK` as exact strings, with no range prefix.
- The lockfile holds exactly one copy of each package: `node_modules/zustand@5.0.15`, `@noble/hashes@2.4.0`, `@scalar/openapi-parser@0.29.9`, `@scalar/api-reference-react@0.9.76`, `i18next@26.4.2` and `react-i18next@17.0.15`.
- Mobile already declared zustand, i18next and react-i18next at the same versions (D30), so all three workspaces share one hoisted copy.

### V2 and V3 output

```
$ npm ls react react-dom --all | grep -oE '(^| )react(-dom)?@[0-9.]+' | sed 's/^ //' | sort -u
react-dom@19.2.3
react@19.2.3
$ npm ls react-native --all | grep -oE '(^| )react-native@[0-9.]+' | sed 's/^ //' | sort -u   # AC-14, context
react-native@0.86.3
$ npm ls @scarf/scarf
dems-demo@0.1.0 /Users/gsp-budi/Documents/DEMS
`-- (empty)
$ /usr/bin/grep -c -E '"node_modules/(.*/)?(@scarf/scarf|swagger-ui[^"]*)"' package-lock.json
0
```

The same outputs were captured before the install, and AC-13 was re-run after the final typecheck. Both matched.

### V4 output

```
present ./i18n -> ./src/i18n/index.ts
present ./brand -> ./src/brand/index.ts
present ./assets/* -> ./assets/*
present ./theme/scalar.css -> ./theme/scalar.css
present script openapi:gen -> tsx scripts/gen-openapi.ts
present script gen:topo -> tsx scripts/gen-topo.ts
```

### V5 output

```
$ git diff --name-only -- . ':(exclude)docs'
apps/core-web/package.json
package-lock.json
packages/shared/package.json
$ git status --porcelain --untracked-files=all -- . ':(exclude)docs'
 M apps/core-web/package.json
 M package-lock.json
 M packages/shared/package.json
```

Note on V5: the unscoped `git diff --name-only` also lists four `docs/` files. These are the controller's decisions, status, report and step-25 progress files, and they were already modified before this step started (captured in the pre-install baseline). This step wrote nothing else outside `docs/`. The final re-check at 02:15:23 gave the same three files.

### V6 output

```
$ npm run typecheck        # exit=0, run twice (after install, and again at 02:15)
> @dems/shared   tsc --noEmit
> @dems/core-web tsc -b
> @dems/mobile   tsc --noEmit
> @dems/mock-core tsc --noEmit
```

### Extra regression evidence (beyond the row)

| Command | Result |
|---|---|
| `npm run lint` (root, 4 workspaces: oxlint ×3, eslint for mobile) | exit 0 |
| `npm test -w @dems/shared -- --maxWorkers=2` | exit 0; `Test Files 4 passed (4)`, `Tests 16 passed (16)` |
| `npm test -w @dems/core-web -- --maxWorkers=2` | exit 0; `Test Files 1 passed (1)`, `Tests 1 passed (1)` |
| `import.meta.resolve` from `packages/shared` | `zustand/vanilla`, `zustand/middleware`, `@noble/hashes/sha2.js` and `@scalar/openapi-parser` all resolve |
| `import.meta.resolve` from `apps/core-web` | `zustand`, `@scalar/api-reference-react`, `i18next` and `react-i18next` all resolve |

Mobile jest and the mock-core tests were not run. This step changed nothing in those workspaces, and steps 68 and 71 are editing mobile files right now (P11).

No P11 noise was hit: every typecheck, lint and test passed on its first run.

## 4. Observations for later steps (no action taken here)

| # | Finding | Evidence | Routed to |
|---|---|---|---|
| O-1 | `npm audit` (full tree) lists 30 advisories: 0 critical, 1 high, 24 moderate, 5 low. By dependency path, **16 are new with this step**: 5 low, 10 moderate and 1 high, from `@scalar/*`, `@ai-sdk/*`, `ai` and `undici`. **The other 14** are all moderate and come from the mobile Expo tree (`expo`, `@expo/*`, `expo-router`, `expo-splash-screen`, `query-string`, `decode-uri-component`, `uuid`, `xcode`), which this step did not touch. The install-time counts (0, 3, 16) appear to be filtered by the `-w` workspace; that is a hypothesis. Every "fix" npm offers is a downgrade below the §14.1 pins (`@scalar/api-reference-react@0.8.36`, `@scalar/openapi-parser@0.29.6`) or a major Expo downgrade, so none was applied: pins are fixed by D31 | `npm audit --json`, classified by package-name path | Steps 62 (security, web) and 63 (mobile) |
| O-2 | The one **high** advisory is `undici@7.29.0` (GHSA-rfgv-xxqx-mfg5, GHSA-w293-vg96-wgc3, plus 8 lower). It is a prod dependency, nested at `node_modules/@scalar/json-magic/node_modules/undici`, via `@scalar/api-reference` 1.72.3 → `@scalar/agent-chat` 0.12.39 → `@scalar/json-magic` 0.15.3. undici is a Node HTTP client. Whether any of it reaches the browser bundle is a **hypothesis**: step 53 or 62 can check the `/developer/api` chunk. The root copy is `undici@8.11.2`, a dev dependency | `npm explain undici` | Steps 53, 62 |
| O-3 | `@opentelemetry/api@1.9.0` (Apache-2.0, no dependencies, no install script) is new, via `@scalar/agent-chat` → `@ai-sdk/vue` → `ai@6.0.33`. It is the no-op OTel API only: no `@opentelemetry/sdk-*` or exporter is in the lock, and no telemetry package of any kind (`posthog`, `scarf`, `analytics`) is present. Agent chat is disabled in the §14.9 config (`agent: { disabled: true }`) | `npm explain @opentelemetry/api`; lockfile grep | Steps 53, 62 |
| O-4 | There is a new install script, `vue-demi@0.14.10` (3 nested copies under `@floating-ui/vue` and `radix-vue`). Its postinstall only picks the Vue 2 or Vue 3 build of `lib/`. The shipped `lib/index.mjs` already has `isVue3 = true`, and `vue` is 3.5.43, so it is a no-op whether npm runs it or blocks it. **No `allowScripts` entry was added**; the root `package.json` is unchanged | `scripts/postinstall.js` read; `lib/index.mjs` head | Step 62 |
| O-5 | **Pre-existing, not caused here.** `npm ls --all` flags `ajv-formats@3.0.1 invalid: "^2.1.1" from …/@hookform/resolvers`. That range is an *optional* peer (`peerDependenciesMeta.optional: true`), and HEAD's lockfile already had `ajv-formats` 3.0.1 (from fastify) with the same peer range. We use the zod resolver, not ajv. `npm ls --workspaces --depth=0` still exits 0 | `git show HEAD:package-lock.json` comparison | Step 64 (info) |
| O-6 | Disk use: `node_modules/@scalar` 160 MB, `@vue` 8.2 MB, `ai` 5.5 MB, `vue` 2.5 MB, `@ai-sdk` 1.4 MB; zustand, @noble/hashes and the i18n libs are under 1.3 MB each. `node_modules` is 9.2 GB in total, mostly the mobile native tree | `du -sh` | Info |

## 5. Hand-offs

| # | To step | What |
|---|---|---|
| H-1 | 35 | `@dems/shared/brand` resolves to `./src/brand/index.ts`, but row 35 names only `emblem.ts` and `topo.ts`. Step 35 owns `packages/shared/src/brand/**` (single-writer scan), so it should add a barrel `src/brand/index.ts` that re-exports both; step 72 imports from `@dems/shared/brand`. If step 35 does not, `./brand` fails to resolve and that is a P12 `needs-review` for step 72 |
| H-2 | 34 | `./i18n` resolves to `./src/i18n/index.ts`, which matches row 34 ("an index exporting one plain … object en") |
| H-3 | 28, 29, 39, 72 | Assets import as `@dems/shared/assets/<sub>/<file>`, for example `@dems/shared/assets/hero/room-2560.jpg` |
| H-4 | 30, 53 | The `./theme/scalar.css` export points at the step-30 generator output. Until step 30 writes the file, importing it fails; nothing imports it yet |
| H-5 | 33, 35 | `npm run openapi:gen -w @dems/shared` and `npm run gen:topo -w @dems/shared` run `tsx`. Per S15-1 (02_shared_package.md), `tsx` needs a per-command sandbox bypass, because it opens an IPC socket |
| H-6 | 67 | The npm slot is released and the lockfile is consistent. Mobile's zustand, i18next and react-i18next are unchanged and deduped with web |

## 6. Decisions and drift

| # | Kind | Item |
|---|---|---|
| S27-1 | Interpretation | Export targets follow the existing `./<module>` → `./src/<module>/index.ts` convention (`./domain`, `./api`, `./sim`, …). `./assets/*` maps 1:1 to the package folder. The spec gives no target paths for these keys |
| S27-2 | Interpretation | Script bodies follow the existing `build` script style (`tsx scripts/<file>.ts`). The file names come from 01_specs §14.15 (`gen-openapi.ts`, `gen-topo.ts`) |
| S27-3 | Interpretation | V5 is evaluated outside `docs/`, because the controller's own `docs/` files were already modified before this step started |
| S27-4 | Process | The three installs and the manifest edit ran under **one** `lockf` hold, not four, so step 67 could not take the slot in between. This is stricter than P1, not a deviation |
| Drift | none | No pin deviation. No `allowScripts` change. No package removed, and no file outside the three manifests written (plus this report and the progress file). Nothing was committed |

## 7. Rollback

**Before step 67 writes the lockfile** (whole-file restore to baseline `33e4c95`):

```
/usr/bin/lockf -k -t 3600 .locks/npm.lock sh -c 'git checkout -- package-lock.json packages/shared/package.json apps/core-web/package.json && npm_config_cache="$PWD/.cache/npm" npm install'
```

**After step 67 has written the lockfile**, a whole-file checkout would discard step 67's changes too. Remove only this step's packages instead, then delete the four export keys and two scripts from `packages/shared/package.json` by hand:

```
/usr/bin/lockf -k -t 3600 .locks/npm.lock sh -c 'export npm_config_cache="$PWD/.cache/npm"; npm uninstall @scalar/api-reference-react i18next react-i18next zustand -w @dems/core-web && npm uninstall zustand @noble/hashes @scalar/openapi-parser -w @dems/shared'
```

In the second case, mobile keeps its own zustand, i18next and react-i18next declarations.

---
*Generated: 2026-10-01 02:16 WIB*
