---
task_id: 2026-10-04_dems_backend_rbac_pairing
task_slug: dems_backend_rbac_pairing
blueprint_row: 36
plan_row: W14
title: npm slot N2 (web): qrcode.react 4.2.0; react declared in the server workspace (D28 D-4)
date: 2026-10-04
agent: coder-execution (tier D, model sonnet)
source_plan: /Users/gsp-budi/Documents/DEMS/docs/2026-10-04_dems_backend_rbac_pairing/masterplan/02_plan.md
evidence_tier: 3
status: needs-review
---

# W14: npm slot N2 (web)

All times are WIB (UTC+7) on 2026-10-04. Every command ran from `/Users/gsp-budi/Documents/DEMS`; no
command changed into a subfolder. Baseline for every comparison is commit `acaff20` and, for the
lockfile, the file as steps 25 and 35 left it (the P23 pre-image).

## 1. Result

| Item | Result |
|---|---|
| Status | **needs-review** on one clause only (section 9.1): `npm install-scripts ls` now prints 8 lines, step 25's list had 7. The extra line is `fsevents@2.3.3`, which is not new (section 9.1). Every deliverable exists and every other check passes |
| `qrcode.react` 4.2.0 in `@dems/core-web` | Done. One lockfile entry added, no transitive package (it has no dependencies; `react` is its peer) |
| `react` 19.2.3 in `@dems/core-server` (D28 D-4) | Done. The pin was read from `apps/core-web/package.json` and equals the root `overrides.react`. Nothing installed |
| `npm install --ignore-scripts` | Exit 0, "added 1 package, and audited 1732 packages in 8s" |
| Lockfile | 11 lines added, 0 removed. 0 of 1,907 existing entries changed in version, resolved or integrity. The two workspace records gained one declared-dependency line each |
| One React, one React DOM | Yes: `react@19.2.3` and `react-dom@19.2.3`, one copy each on disk and in the lockfile |
| Typecheck, lint | `core-web` typecheck 0, `core-server` typecheck 0 (after two failures in another row's file, section 8.3), `core-web` lint 0 |
| `npm audit` | **Not deterministic for one and the same lockfile** (80 or 84 entries, section 9.2). No entry comes from this row |
| `npm audit signatures` | 1,721 verified, 0 invalid, 0 missing |
| Install window | **07:31:44 to 07:31:52** (8 seconds) |

## 2. Timeline

| Time | Step |
|---|---|
| 07:29:13 | P23 pre-images, `npm install-scripts ls` baseline (7 entries) |
| 07:29:24 | `npm view` inside the sandbox: `E502 Bad Gateway` (as in steps 25 and 35) |
| 07:30:38 | Registry lookup with the bypass (section 4) |
| 07:30:46, 07:30:52 | The two manifest edits |
| 07:31:11 | `npm install --ignore-scripts --dry-run` under the npm lock: "add qrcode.react 4.2.0", nothing else, nothing written |
| **07:31:44 to 07:31:52** | **Install window** (one `npm install --ignore-scripts` under the npm lock) |
| 07:32:55 to 07:33:04 | Typecheck of `core-web`, `core-server` (first run, failed), lint of `core-web` |
| 07:33:21 to 07:36:45 | `npm audit`, `npm audit signatures`, scratch audits, repeated audits (section 9.2) |
| 07:37:02 | `core-server` typecheck, second run (failed the same way) |
| 07:37:32 | Typecheck of the whole server project without the one failing file: exit 0 |
| 07:40:22 | `core-server` typecheck, third run: exit 0 |
| 07:40:32 to 07:40:41 | Final run of the three required commands: all exit 0 |

**Window for other rows (P11):** `node_modules` was rewritten once, between 07:31:44 and 07:31:52
(`node_modules/.package-lock.json` is stamped 07:31:45). Only one directory was added,
`node_modules/qrcode.react`. No existing package was moved, removed or changed.

Commands that ran with the per-command sandbox bypass (P10): the registry lookup, the dry run, the
install, `npm audit` (text, JSON, signatures with attestations), the scratch audits and the repeated
audits. Nothing else. No `sudo`, no `brew`, no host other than `registry.npmjs.org`.

## 3. P23 pre-images (before the first edit)

```
$ git diff acaff20 -- apps/core-web/package.json apps/core-server/package.json package-lock.json > .cache/rollback/W14.pre.patch
-rw-r--r--  278963  .cache/rollback/W14.pre.patch
62610d6f62b13d1bb596a7610a07f462873435ca82076d1181b65083783fe550  .cache/rollback/W14.pre.patch
$ cp -p apps/core-server/package.json .cache/rollback/W14.core-server.package.json     (untracked file: copied, not diffed)
a11994d1346c9a176d896f757588d2ef46ee03d087f1f810c058a1f14c73cdcd  .cache/rollback/W14.core-server.package.json
.gitignore:47:.cache/	.cache/rollback/W14.pre.patch
.gitignore:47:.cache/	.cache/rollback/W14.core-server.package.json
```

| File | SHA-256 before | SHA-256 after |
|---|---|---|
| `package-lock.json` | `bc6b6f0789f765a513d300fdf74b2c13db50680a6345a18ba881fe9e88e5ab75` | `6da29f742f93e253c9a81352c9212f34a663f000f74a19131ce7610a828573a4` |
| `apps/core-web/package.json` | `fb1103f92735024e6e2c83ba8807bb8827aa4c2fb9fee3b32d9a7de21b7d9ce6` | `711ced5c6309661a99cb31fcc18d864c01cf16ffd71cf70121165d327c3a3cd8` |
| `apps/core-server/package.json` | `a11994d1346c9a176d896f757588d2ef46ee03d087f1f810c058a1f14c73cdcd` | `c93528773268fcc14d276cfa1575b6c6b0746938a86569251e1023a83cc2a1aa` |
| `package.json` (root, not written) | `c556e9c0e85e580a4ca128c23a9fe86f00f2c17cccc1d172a8ab70af2ed3c922` | identical |

The patch holds only the lockfile: `apps/core-web/package.json` was identical to `acaff20` before this
row, and `apps/core-server/package.json` is untracked. The pre-image is proven on a scratch copy
(working tree untouched): `acaff20` lockfile plus the patch gives the hash above.

```
patch exit=0
bc6b6f0789f765a513d300fdf74b2c13db50680a6345a18ba881fe9e88e5ab75   (= "lockfile before this row")
core-web manifest at acaff20 == core-web manifest before this row (byte-identical)
core-server manifest pre-copy == the file before this row
```

## 4. The package, from the registry (TD-11, AN:699)

`implementation/assets/14_registry_qrcode_react_4_2_0.json`, looked up at 07:30:38:

| Field | Value |
|---|---|
| Name, version | `qrcode.react` 4.2.0; `latest` dist-tag is also 4.2.0 |
| Licence | ISC (the plan's §3.1 says ISC) |
| `dependencies` | none |
| `peerDependencies` | `react: ^16.8.0 \|\| ^17.0.0 \|\| ^18.0.0 \|\| ^19.0.0` (met by 19.2.3) |
| Install-time scripts | none (`build`, `build:code`, `build:examples`, `lint`, `pretty`, `prepack`, `prepublish-docs`, `publish-docs`, `test`, `typecheck`: all publish or development time; no `preinstall`, `install`, `postinstall`, `prepare`) |
| Integrity | `sha512-QpgqWi8rD9DsS9EP3z7BT+5lY5SFhsqGjpgW5DY/i3mK4M9DTBNz3ErMi8BWYEfI3L0d8GIbGmcdFAS1uIRGjA==` (registry and lockfile agree) |
| Registry signature | present (keyid `SHA256:jl3bwswu80PjjokCgh0o2w5c2U4LhQAE57gj9cz1kzA`); verified by `npm audit signatures` (section 9.3) |

On disk after the install (`node_modules/qrcode.react`): `LICENSE`, `README.md`, `lib`, `package.json`;
no `binding.gyp`, no `bin`. It loads under Node and exports what CA-10 needs:

```
$ node --input-type=module -e 'import("qrcode.react").then(m=>console.log(Object.keys(m).sort().join(", ")))'
QRCodeCanvas, QRCodeSVG
```

No source file imports it yet (`grep -rl qrcode.react apps packages` lists `apps/core-web/package.json`
only); W81 is its consumer.

## 5. The two manifest edits (by hand, exact versions, alphabetical order as each file keeps it)

```diff
--- apps/core-web/package.json   (before this row == acaff20)
+++ apps/core-web/package.json
@@ -27,6 +27,7 @@
     "i18next": "26.4.2",
     "lucide-react": "1.49.0",
     "motion": "13.4.6",
+    "qrcode.react": "4.2.0",
     "react": "19.2.3",
     "react-dom": "19.2.3",
     "react-hook-form": "7.89.0",
```

```diff
--- apps/core-server/package.json   (as steps 25 left it)
+++ apps/core-server/package.json
@@ -31,6 +31,7 @@
     "openapi-types": "12.1.3",
     "pg": "8.23.1",
     "rate-limiter-flexible": "11.2.1",
+    "react": "19.2.3",
     "tsx": "4.23.15",
     "zod": "4.6.5"
   },
```

The `react` pin was read, not assumed: `apps/core-web/package.json` has `"react": "19.2.3"`, and the root
`package.json` `overrides.react` is `19.2.3`. Nothing else in either manifest changed; both files still
parse as JSON and keep their final newline. No `npm install <pkg>` form was used.

## 6. The install

Dry run first (07:31:11, nothing written, lockfile hash unchanged):

```
$ /usr/bin/lockf -k -t 3600 .locks/npm.lock npm install --ignore-scripts --dry-run
add qrcode.react 4.2.0

added 1 package in 624ms
```

The install, as `implementation/assets/14_npm_slot.sh` under the lock (output in
`implementation/assets/14_npm_slot.txt`):

```
== npm slot N2 acquired 2026-10-04 07:31:44 WIB
== INSTALL_START 2026-10-04 07:31:44 WIB
== INSTALL_END 2026-10-04 07:31:52 WIB exit(npm install)=0

added 1 package, and audited 1732 packages in 8s

396 packages are looking for funding
  run `npm fund` for details

84 vulnerabilities (5 low, 25 moderate, 54 high)
...
== npm slot N2 released 2026-10-04 07:31:52 WIB
lockf exit=0
```

`--ignore-scripts` was on the command. No install script was approved or run; the root `allowScripts`
is unchanged (`{"@shopify/react-native-skia@2.6.2":true,"@embedded-postgres/darwin-arm64@18.4.0-beta.17":true}`).
The npm lock is free afterwards (`lockf -k -t 0 .locks/npm.lock true` exits 0).

## 7. Lockfile diff against the pre-image

`implementation/assets/14_lockfile.diff.txt`: the complete `diff` output, 11 lines added, 0 removed:

```
37a38
>         "react": "19.2.3",
71a73
>         "qrcode.react": "4.2.0",
22771a22774,22782
>     "node_modules/qrcode.react": {
>       "version": "4.2.0",
>       "resolved": "https://registry.npmjs.org/qrcode.react/-/qrcode.react-4.2.0.tgz",
>       "integrity": "sha512-QpgqWi8rD9DsS9EP3z7BT+5lY5SFhsqGjpgW5DY/i3mK4M9DTBNz3ErMi8BWYEfI3L0d8GIbGmcdFAS1uIRGjA==",
>       "license": "ISC",
>       "peerDependencies": {
>         "react": "^16.8.0 || ^17.0.0 || ^18.0.0 || ^19.0.0"
>       }
>     },
```

By entry (both lockfiles parsed, `packages` maps compared):

```
lockfileVersion 3 -> 3 | entries 1907 -> 1908
REMOVED entries: 0 []
ADDED entries: 1   + node_modules/qrcode.react {"version":"4.2.0", ... "license":"ISC","peerDependencies":{"react":"^16.8.0 || ^17.0.0 || ^18.0.0 || ^19.0.0"}}
CHANGED entries (same path, different content): 2
  ~ "apps/core-server" dependencies : ... => ... + "react":"19.2.3"
  ~ "apps/core-web"    dependencies : ... => ... + "qrcode.react":"4.2.0"
existing entries whose version, resolved or integrity changed: 0 of 1907
existing entries keep their relative order: true
top-level keys other than `packages`: unchanged
```

| Count asked for | Value |
|---|---|
| Entries added | **1**, `node_modules/qrcode.react` 4.2.0 |
| Transitive packages added | **0** (no dependencies; `react` resolves to the hoisted 19.2.3) |
| Existing entries changed in version, resolved or integrity | **0** of 1,907 |
| Existing records whose content changed | 2: the workspace records of `apps/core-web` and `apps/core-server`, one declared-dependency line each (the "workspace dependency lines" the row expected) |
| Existing package entries (non-workspace) changed in any way | **0** |

Against `acaff20` the whole lockfile reads `git diff --minimal --numstat acaff20 -- package-lock.json`
= `1750	0` (W03: 1,729; W13: 10; this row: 11; 0 deleted). `node_modules/react` and `node_modules/react-dom`
are the only copies, both 19.2.3.

## 8. Verification

### 8.1 One React, one React DOM

`npm ls react react-dom --all` exits 0 (no invalid, missing or extraneous line). Tally of the nodes whose
name is exactly `react` or `react-dom` (the full tree is `implementation/assets/14_npm_ls_react.txt`):

```
  44 react-dom@19.2.3 deduped
   1 react-dom@19.2.3 overridden
 117 react@19.2.3 deduped
   1 react@19.2.3 overridden
```

One real node of each (the "overridden" one, the root `overrides` entry), the rest are references to
it; one version. Step 25 counted 115 `react` references; the two new ones are `@dems/core-server`'s own
dependency and `qrcode.react`'s peer link. On disk (a walk of every `node_modules` folder up to depth 6):

```
node_modules/qrcode.react/package.json  qrcode.react  4.2.0  ISC
node_modules/react-dom/package.json     react-dom     19.2.3  MIT
node_modules/react/package.json         react         19.2.3  MIT
copies: { react: 1, 'react-dom': 1, 'qrcode.react': 1 }
```

```
$ npm ls qrcode.react
dems-demo@0.1.0 /Users/gsp-budi/Documents/DEMS
`-- @dems/core-web@0.1.0 -> ./apps/core-web
  `-- qrcode.react@4.2.0
exit=0
```

(A first tally of mine matched `react@0.9.76`, `react@1.49.0`, `react@16.3.3`, `react@3.2.6`, `react@4.2.0`
too. Those are the suffixes of `@scalar/api-reference-react`, `lucide-react`, `@testing-library/react`,
`@heroui/react` and `qrcode.react`, not React; the strict match above is the correct tally.)

### 8.2 Typecheck and lint

| Time | Command | Exit |
|---|---|--:|
| 07:32:55 | `npm run typecheck -w @dems/core-web` | 0 |
| 07:33:02 | `npm run typecheck -w @dems/core-server` (run 1) | **2** (section 8.3) |
| 07:33:03 | `npm run lint -w @dems/core-web` | 0 |
| 07:37:02 | `npm run typecheck -w @dems/core-server` (run 2) | **2**, same 18 errors |
| 07:40:22 | `npm run typecheck -w @dems/core-server` (run 3) | 0 |
| 07:40:32 to 07:40:41 | `npm run typecheck -w @dems/core-web` (final run, three commands in this order) | 0 |
| (same window) | `npm run typecheck -w @dems/core-server` (final) | 0 |
| (same window) | `npm run lint -w @dems/core-web` (final) | 0 |

### 8.3 The two failed `core-server` typechecks are another row's file (P11)

Both failed runs print 18 errors, **all in one file**:
`apps/core-server/src/plugins/response-headers/__tests__/response-headers.test.ts`
(`implementation/assets/14_typecheck_core_server_run1.txt`, `..._run2.txt`; the same 18 lines). The file's header
says "plan row W08"; it was written at 07:31:59, 7 seconds after my install ended, by a row that was
running at the same time. The errors read as a typing problem inside that test: line 25 reports "Tuple type '[]' of length '0' has no
element at index '0'" for its use of `Parameters<FastifyInstance['inject']>[0]`, and later lines treat a
`void & Promise<Response> & Chain` as a `Response`. No error names `react`, `qrcode` or any package this
row changed.

Proof that nothing else in the project is affected, with a throwaway `tsconfig` that lives in the
scratchpad (it extends the server's config and excludes that one file; no file of another row was touched;
`implementation/assets/14_tsconfig_core_server_minus_w08_test.json`):

```
$ node_modules/.bin/tsc -p <scratch config> --listFilesOnly   -> 62 core-server files; response-headers.test.ts in the program: 0
$ node_modules/.bin/tsc -p <scratch config>                   -> exit 0
$ node_modules/.bin/tsc -p apps/core-server/tsconfig.json --noEmit  -> exit 2, 18 errors, all in response-headers.test.ts
```

The owning row rewrote that file at 07:37:49 (6,511 to 6,426 bytes); the third run at 07:40:22 and the
final run exit 0 without any action from this row.

## 9. Supply chain (SR-80, AC-B-91; SU-2, SU-3)

### 9.1 `npm install-scripts ls` (SU-3): one line more than step 25, not a new script

| List | Entries |
|---|---|
| Step 25, final (06:38) | 7: `esbuild@0.28.2`, `unrs-resolver@1.12.2`, `vue-demi@0.14.10` x3, `esbuild@0.25.12`, `esbuild@0.18.20` |
| This row, before any edit (07:29) | the same 7 (`implementation/assets/14_install_scripts_before.txt`; the order of the lines differs, the set does not) |
| This row, after the install (taken between 07:37 and 07:40) | **8**: the same 7 and `fsevents@2.3.3 (install: (install scripts present))` (`..._after.txt`) |

Six consecutive runs after the install gave the same 8 each time. What is established:

1. **No new package and no new script.** `fsevents` 2.3.3 is in the lockfile at `acaff20` with
   `hasInstallScript: true`, `optional: true`, `os: ["darwin"]`; the lockfile diff of this row adds only
   `qrcode.react`; the install said "added 1 package"; `node_modules/fsevents` is dated Oct 1 00:27.
   Its dependents are `vite`, `tsx` and `jest-haste-map` (optional dependencies).
2. **It has no lifecycle script.** Its installed `package.json` has `clean`, `build`, `test`,
   `prepublishOnly` and nothing else; no `preinstall`, `install` or `postinstall`; no `binding.gyp`; it
   ships a prebuilt `fsevents.node`. npm's text "(install scripts present)" is its placeholder for "the
   lockfile flag is set and no script body was found" (`@npmcli/arborist/lib/install-scripts.js:96-107`).
3. **Nothing was approved, denied or run.** The root `allowScripts` is unchanged.

What is **not** established: why the listing changed between 07:29 and 07:37. I suspected the hidden
lockfile (`node_modules/.package-lock.json`, rewritten at 07:31:45 and recording `hasInstallScript: true` for
`fsevents`), but a read-only probe (run in the same window) that loads the tree two ways (`implementation/assets/14_probe_fsevents.cjs`:
the default load and `forceActual`) shows `hasInstallScript: false` and no enumerated script for `fsevents` in
both, so that theory is **not confirmed** and is not offered as the cause. The unexplained difference is
recorded as it is (decision DN-1).

`qrcode.react` is not in the list (it has no install-time script).

### 9.2 `npm audit` (SU-2): the output is not deterministic

First run of the row (07:33:21, `implementation/assets/14_npm_audit.txt`, exit 1):

```
84 vulnerabilities (5 low, 25 moderate, 54 high)

To address all issues possible (including breaking changes), run:
  npm audit fix --force

Some issues need review, and may require choosing
a different dependency.
```

That is not the number step 25's Appendix A and step 35 print (80 entries, 50 high). So the output was
compared by package set, and then the cause was tested instead of assumed:

| Evidence | Result |
|---|---|
| 11 JSON runs (real tree, a scratch copy of the pre-image lockfile, a scratch copy of the post-image lockfile) | Exactly **two** vulnerability sets: an 80-package set (7 runs) and an 84-package set (4 runs) |
| The 80-package set against step 25's Appendix A | **Identical by name, 80 of 80**; nothing extra, nothing missing |
| The 84-package set minus the 80-package set | Exactly 4 packages, all `high`: `@shopify/react-native-skia`, `heroui-native`, `uniwind`, `victory-native`. Each is a dependent of `react-native` (the text report says "Depends on vulnerable versions of react-native"); none is touched by this row (`implementation/assets/14_audit_set_80.txt`, `14_audit_set_84.txt`) |
| The pre-image lockfile (before this row's change), 4 JSON runs | Gave the 84-package set in 2 runs and the 80-package set in 2 |
| The post-image lockfile, 4 JSON runs; the real tree, 3 JSON runs | Post-image: 80-set 3 times, 84-set once. Real tree: 80-set twice, 84-set once |
| 16 text reports of this step, hashed | 8 are byte-identical to step 25's Appendix A (`94b3169a2fac99d4...39d120a8`, kept as `implementation/assets/14_npm_audit_matches_step25.txt`, `cmp` clean); the other 8 are six distinct variants. The two I diffed against step 25's file: the first 84-package report (four extra entries, plus different range strings for `jest-resolve-dependencies`, `@react-native/virtualized-lists` and `react-native-reanimated`) and an 80-package report that differs in one line only (`jest-resolve-dependencies  23.3.0 - 30.2.0` instead of `27.0.0-next.0 - 30.2.0`). The other four variants were counted by hash and not diffed |

**Entries new against step 25's appendix: none that this row causes.** In the 80-package state there are
none and the text is byte-identical in half of the runs. In the 84-package state there are the four above;
they appear equally with the pre-image lockfile, and steps 25 and 35 had already recorded an 84 in the
install summary and in the JSON metadata next to an 80 in the text. That earlier "two totals" is this
effect: one command gives 80 or 84 for one input from run to run. The mechanism inside `npm audit` is not
investigated. `qrcode.react` has no advisory and appears in no run. `npm audit fix` was not run.

Consequence for later rows (finding F-1): a gate that compares `npm audit` output byte for byte (W99, any
re-check of SU-2) will flap. Compare the set of package names instead and accept either of the two sets.

### 9.3 `npm audit signatures` (M4)

```
$ npm audit signatures
audited 1721 packages in 9s

1721 packages have verified registry signatures

401 packages have verified attestations
(use --json --include-attestations to view attestation details)
exit=0
```

With `--json --include-attestations`: `invalid` 0, `missing` 0, `verified` 401. Step 25 printed 1,719; the two
packages added since are `expo-secure-store` (step 35) and `qrcode.react` (this row). `qrcode.react` has a
verified registry signature and **no provenance attestation** (it is not among the 401), the same
position as `embedded-postgres`. No signature failed.

## 10. Test ledger (P24)

| Workspace | Before | After | New test file |
|---|---|---|---|
| all | not measured by this row | not run | none |

This row writes no source file and no test file. Its effect on the test environment is one added directory
in `node_modules` (`qrcode.react`, imported nowhere) and one declared dependency. Ledger addition: none. A
test of another row that failed between 07:31:44 and 07:31:52 may be repeated (section 2).

## 11. Findings, deviations and decisions

### Findings

| ID | Finding | Evidence |
|---|---|---|
| F-1 | `npm audit` returns 80 or 84 entries for the same lockfile, run to run; the 4 extra are `react-native` dependents already installed. This explains the "two totals" of steps 25 and 35. Gates must compare the package set, not the bytes | section 9.2 |
| F-2 | `npm install-scripts ls` now lists `fsevents@2.3.3` with npm's placeholder "(install scripts present)". The package has no script, is in the lockfile since `acaff20`, and was not touched. Why the list changed is not established | section 9.1 |
| F-3 | `qrcode.react` 4.2.0: ISC, no dependencies, one peer (`react`), no install-time script, registry signature verified, no provenance attestation; exports `QRCodeSVG` and `QRCodeCanvas` | sections 4, 9.3 |
| F-4 | The React version now sits in three places that must change together at an upgrade: `apps/core-web/package.json`, `apps/core-server/package.json` and the root `overrides` (all `19.2.3`) | section 5 |
| F-5 | W08's new test file was red under `tsc` at 07:33:02 and 07:37:02 and was rewritten by its own row at 07:37:49 (green at 07:40:22). It is not caused by this row; it is mentioned because `npm run typecheck -w @dems/core-server` was red in that window | section 8.3 |
| F-6 | W85 (notices) needs one line for `qrcode.react` 4.2.0, ISC, copyright from the package's own `node_modules/qrcode.react/LICENSE` | section 4 |

### Deviations from the row text

| ID | Deviation | Reason |
|---|---|---|
| DV-1 | A dry run, a registry lookup and a scratch-project audit were added | To see the exact change before it was written and to find out whether the audit difference came from this row |
| DV-2 | The "install-scripts" criterion is not met as written (one extra line) | Section 9.1; decision DN-1 |
| DV-3 | The shared tracking files (`masterplan/02_plan.md`, `status_tasks.md`, `decisions/decisions.md`, `delegation_progress_report.md`, `implementation/99_implementation_report.md`) were not written | Parallel run: the controller writes them (P8) |

### Decisions needed

| ID | Question | Options | Recommendation |
|---|---|---|---|
| DN-1 | The 8th line of `npm install-scripts ls` (`fsevents@2.3.3`, flag only) | (A) Read it like D27 option B: reviewed, no script exists, not approved, nothing to record in the manifest. (B) Record a name-only denial in an npm slot (`npm install-scripts deny fsevents`): writes the root manifest, changes no behaviour | (A). Nothing runs for it, it is optional and darwin-only, and a denial is a manifest write that W99 can take if the controller wants an empty list |
| DN-2 | How later rows compare `npm audit` | Compare package-name sets (accept both the 80-set and the 84-set) instead of bytes | Accept both sets; record in W99's check |

## 12. Rollback (R-PRE; not executed)

```sh
ROOT=/Users/gsp-budi/Documents/DEMS
# 1. the three files, from their pre-images
git checkout acaff20 -- apps/core-web/package.json                    # identical to its state before this row (proven, section 3)
git checkout acaff20 -- package-lock.json && git apply .cache/rollback/W14.pre.patch    # P23 form; lands on sha bc6b6f07...88e5ab75
cp -p .cache/rollback/W14.core-server.package.json apps/core-server/package.json         # sha a11994d1...73cdcd
# 2. reconcile node_modules (removes the directory node_modules/qrcode.react)
/usr/bin/lockf -k -t 3600 "$ROOT/.locks/npm.lock" npm install --ignore-scripts
```

Check after: `shasum -a 256 package-lock.json` is `bc6b6f0789f765a513d300fdf74b2c13db50680a6345a18ba881fe9e88e5ab75`,
and `npm ls qrcode.react` prints `(empty)`. The first two restores are exactly the pre-row states because
`apps/core-web/package.json` equalled `acaff20` and the patch carries the W03 and W13 lockfile changes.

## 13. Files written

| Path | Change |
|---|---|
| `apps/core-web/package.json` | `qrcode.react` 4.2.0 added to `dependencies` |
| `apps/core-server/package.json` | `react` 19.2.3 added to `dependencies` |
| `package-lock.json` | 11 lines added, 0 removed |
| `.cache/rollback/W14.pre.patch`, `.cache/rollback/W14.core-server.package.json` (git-ignored; P23) | the pre-images |
| `node_modules/qrcode.react/` (git-ignored) | the installed package |
| `implementation/14_npm_slot_n2_web.md` | this document |
| `implementation/assets/14_*` | `14_npm_slot.sh`, `14_npm_slot.txt`, `14_npm_audit.txt`, `14_npm_audit_matches_step25.txt`, `14_npm_audit_80run.txt`, `14_npm_audit_signatures.txt`, `14_audit_set_80.txt`, `14_audit_set_84.txt`, `14_lockfile.diff.txt`, `14_install_scripts_before.txt`, `14_install_scripts_after.txt`, `14_npm_ls_react.txt`, `14_registry_qrcode_react_4_2_0.json`, `14_typecheck_core_server_run1.txt`, `14_typecheck_core_server_run2.txt`, `14_tsconfig_core_server_minus_w08_test.json`, `14_probe_install_scripts.cjs`, `14_probe_fsevents.cjs` |
| `delegation_progress/coder_execution_step_36.md` | progress file |

Not written: the root `package.json` (hash unchanged), any other manifest, any source or test file, the shared
tracking files. This row started no process that is still running; the npm lock is free.

---
*Generated: 2026-10-04 07:45*
