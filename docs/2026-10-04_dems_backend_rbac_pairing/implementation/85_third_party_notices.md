---
task_id: 2026-10-04_dems_backend_rbac_pairing
task_slug: dems_backend_rbac_pairing
blueprint_row: 107
plan_row: W85
title: THIRD_PARTY_NOTICES.md, append-only section for the packages of the Live mode release
date: 2026-10-04
agent: coder-execution (tier D, model sonnet)
source_plan: /Users/gsp-budi/Documents/DEMS/docs/2026-10-04_dems_backend_rbac_pairing/masterplan/02_plan.md
evidence_tier: 3
status: complete
---

# W85: THIRD_PARTY_NOTICES.md, new section for the Live mode packages

All times are WIB (UTC+7) on 2026-10-04. Every command ran from `/Users/gsp-budi/Documents/DEMS`; no command changed into a subfolder. No `npm` command, no install, no network call and no web fetch ran. Everything below was read from `node_modules/**`, the manifests and the repository. Baseline for every comparison is commit `acaff20`.

## 1. Result

**Update at 11:10: F-W85-1 is closed by the follow-up of section 13.6 (the PostgreSQL License text, fetched by the controller from tag `REL_18_4` and appended verbatim). The row status is now complete; the table below is the state before the follow-up and is kept as written.**

| Item | Result |
|---|---|
| Status | **needs-review**, on one required content item only (finding F-W85-1): the text of the PostgreSQL License is not on disk in either npm package, nor anywhere under `node_modules/`, `docs/`, `scripts/`, `apps/` or `packages/`. By rule 4 it was not typed from memory. The section names the licence, lists where it was looked for, and says the text has to be added. Every other deliverable exists and the row's verification passes |
| File written | `/Users/gsp-budi/Documents/DEMS/THIRD_PARTY_NOTICES.md`: 96 lines appended (file lines 178 to 273); heading at line 181 |
| Additions only | `git diff acaff20 --stat` prints `96 insertions(+)`; `grep -c '^-[^-]'` prints `0`; `--numstat` prints `96 0`; the first 177 lines are byte-identical to the file as it was (compared with `cmp` against a copy taken before the append) |
| Direct dependencies mapped | 28 of 28 rows have a line in the new section, no empty cell (section 5); the cross-check of each line against name, version, licence and licence file: 28 consistent, 0 mismatch |
| Licence files read | 26 distinct files; identifier in `package.json` and licence text agree in 26 of 26 (section 7) |
| Packages with no licence file | 3: `drizzle-orm`, `drizzle-kit`, `@drizzle-team/brocli` (finding F-W85-2). Written as found, not corrected |
| Workspace-internal packages | `@dems/shared` is declared by `apps/core-server/package.json`; it is not third-party and is left out, as is `@dems/core-server` itself |

## 2. Inputs read

- `identification/02_structured.md`: row 107 (line 389) and the "Parallel Execution Protocol (rev 2, P1-P25)" (lines 487 to 577): P6 (write only the row's paths), P8 (own progress file), P9, P10, P19 (no secret in any output; the delegation prompt calls this P21), P21 (additive only), P23.
- `masterplan/02_plan.md`: row W85 (line 764), section 3.1 (lines 274 to 295), section 3.2 (line 299), gap GP-05 (line 207).
- `implementation/03_npm_slot_n1_server_shared.md` (sections 4 to 7, 11 and 12), `13_npm_slot_n3_mobile_native.md` and `14_npm_slot_n2_web.md`: what each slot installed and the remarks it recorded. Remarks used: N1 F-8 and DN-5 (`fast-uri` 3.1.8, BSD-3-Clause; `@drizzle-team/brocli` 0.10.2, Apache-2.0), N1 section 7.3 (install script of `@embedded-postgres/darwin-arm64`), N1 section 5.1 (`@types/pg` resolved to 8.23.1), N2 (no transitive package), N3 (`expo-secure-store` MIT, `~57.0.4`).
- `decisions/decisions.md`: D9 (DN-2, append-only), D27 (the install script reviewed and approved by exact name), D39 (the notices row gets one line for `qrcode.react`), and D4, D5, D11 for the PostgreSQL statements.
- The existing `THIRD_PARTY_NOTICES.md` (177 lines): format followed (heading levels, `---` between sections, pipe tables, bold lead-ins, log paths cited as quoted numbers, English, no emoji). It lists no npm package, so no line is duplicated.

## 3. What was done

1. Confirmed the file was unchanged since `acaff20` (`git hash-object` equals `git rev-parse acaff20:THIRD_PARTY_NOTICES.md`: `fa76c4556ba02c7e1a8056f7ae88c1ddb4a6e328`), ends with a newline and has no CRLF.
2. Listed the direct dependencies from `git diff acaff20 -- '*package.json'` and from `apps/core-server/package.json` (section 4).
3. For each package read `node_modules/<name>/package.json` (version, `license`) and found the licence file by name in the package folder (section 5). The PostgreSQL packages were searched for a PostgreSQL licence file by name, then by content (section 8).
4. Generated the tables of the new section by a script that reads those files (the prose was written by hand from the logs listed in section 2; every table cell comes from disk). The script, its output and the generated section are in the session scratchpad, outside the repository.
5. Appended the section with `cat >> THIRD_PARTY_NOTICES.md`, then ran the verification of section 6.

## 4. Direct dependencies added since `acaff20`

### 4.1 `git diff acaff20 -- '*package.json'` (verbatim)

```diff
diff --git a/apps/core-web/package.json b/apps/core-web/package.json
index 198acc5..81f0e63 100644
--- a/apps/core-web/package.json
+++ b/apps/core-web/package.json
@@ -27,6 +27,7 @@
     "i18next": "26.4.2",
     "lucide-react": "1.49.0",
     "motion": "13.4.6",
+    "qrcode.react": "4.2.0",
     "react": "19.2.3",
     "react-dom": "19.2.3",
     "react-hook-form": "7.89.0",
diff --git a/apps/mobile/package.json b/apps/mobile/package.json
index 54adedf..fb0c108 100644
--- a/apps/mobile/package.json
+++ b/apps/mobile/package.json
@@ -15,7 +15,7 @@
     "prebuild": "EXPO_NO_TELEMETRY=1 expo prebuild --platform android --no-install",
     "doctor": "EXPO_NO_TELEMETRY=1 expo-doctor",
     "deps:check": "EXPO_NO_TELEMETRY=1 expo install --check",
-    "reverse": "adb reverse tcp:4400 tcp:4400 && adb reverse tcp:8081 tcp:8081"
+    "reverse": "adb reverse tcp:4400 tcp:4400 && adb reverse tcp:8081 tcp:8081 && adb reverse tcp:4420 tcp:4420"
   },
   "dependencies": {
     "@dems/shared": "*",
@@ -42,6 +42,7 @@
     "expo-linking": "~57.0.11",
     "expo-local-authentication": "~57.0.3",
     "expo-router": "~57.0.24",
+    "expo-secure-store": "~57.0.4",
     "expo-splash-screen": "~57.0.9",
     "expo-status-bar": "~57.0.1",
     "expo-symbols": "~57.0.3",
diff --git a/package.json b/package.json
index e45a5cb..3a0cb23 100644
--- a/package.json
+++ b/package.json
@@ -31,9 +31,29 @@
     "build:android": "npm run build -w @dems/mobile",
     "typecheck": "npm run typecheck --workspaces --if-present",
     "lint": "npm run lint --workspaces --if-present",
-    "test": "npm run test --workspaces --if-present"
+    "test": "npm run test --workspaces --if-present",
+    "dev:server": "npm run dev -w @dems/core-server --",
+    "start:server": "npm run start -w @dems/core-server --",
+    "db:create": "npm run db:create -w @dems/core-server --",
+    "db:migrate": "npm run db:migrate -w @dems/core-server --",
+    "db:seed": "npm run db:seed -w @dems/core-server --",
+    "db:reset": "npm run db:reset -w @dems/core-server --",
+    "db:status": "npm run db:status -w @dems/core-server --",
+    "test:db": "npm run test:db -w @dems/core-server --",
+    "pg:init": "node scripts/pg/init.mjs",
+    "pg:start": "node scripts/pg/start.mjs",
+    "pg:stop": "node scripts/pg/stop.mjs",
+    "pg:status": "node scripts/pg/status.mjs",
+    "pg:remove-data": "node scripts/pg/remove-data.mjs",
+    "pg:remove": "node scripts/pg/remove.mjs",
+    "test:pg-scripts": "node --test scripts/pg/"
+  },
+  "devDependencies": {
+    "embedded-postgres": "18.4.0-beta.17",
+    "pg": "8.23.1"
   },
   "allowScripts": {
-    "@shopify/react-native-skia@2.6.2": true
+    "@shopify/react-native-skia@2.6.2": true,
+    "@embedded-postgres/darwin-arm64@18.4.0-beta.17": true
   }
 }
diff --git a/packages/shared/package.json b/packages/shared/package.json
index 49b17d1..1673c4a 100644
--- a/packages/shared/package.json
+++ b/packages/shared/package.json
@@ -13,6 +13,10 @@
     "./i18n": "./src/i18n/index.ts",
     "./brand": "./src/brand/index.ts",
     "./demo-data": "./src/demo-data/index.ts",
+    "./client": "./src/client/index.ts",
+    "./live": "./src/live/index.ts",
+    "./live/source": "./src/live/source/index.ts",
+    "./live/testing": "./src/live/testing/index.ts",
     "./assets/*": "./assets/*",
     "./theme/heroui-web.css": "./theme/heroui-web.css",
     "./theme/heroui-native.css": "./theme/heroui-native.css",
```

Only the lines marked `+` that name a package are dependencies: `qrcode.react` (web), `expo-secure-store` (mobile), `embedded-postgres` and `pg` (root `devDependencies`). The other changed lines are not dependencies and need no notice: the mobile `reverse` script, the root scripts, the root `allowScripts` entry for `@embedded-postgres/darwin-arm64@18.4.0-beta.17`, and the four export subpaths of `@dems/shared`. `git diff` shows no `apps/core-server/package.json` because the workspace is untracked (`git ls-files --error-unmatch apps/core-server/package.json` fails), so it was read directly.

### 4.2 `apps/core-server/package.json`

`dependencies` (15): `@dems/shared` `*` (workspace-internal, left out), `@fastify/cookie` 11.1.2, `@fastify/helmet` 13.1.1, `@fastify/rate-limit` 11.2.0, `@fastify/swagger` 9.9.1, `@fastify/websocket` 11.3.1, `drizzle-orm` 0.45.3, `fastify` 5.12.5, `fastify-type-provider-zod` 7.0.0, `openapi-types` 12.1.3, `pg` 8.23.1, `rate-limiter-flexible` 11.2.1, `react` 19.2.3, `tsx` 4.23.15, `zod` 4.6.5.

`devDependencies` (9): `@types/node` 26.6.3, `@types/pg` 8.23.1, `@types/ws` 8.18.2, `@vitest/coverage-v8` 5.0.3, `drizzle-kit` 0.31.11, `oxlint` 1.86.0, `typescript` 6.0.3, `vitest` 5.0.3, `ws` 8.22.0.

Of these 23 external entries, 11 are installed at `acaff20` already (`@fastify/websocket`, `fastify`, `react`, `tsx`, `zod`, `@types/node`, `@types/ws`, `oxlint`, `typescript`, `vitest`, `ws`; checked in the lockfile at `acaff20` with the same versions) and 12 are new (`@fastify/cookie`, `@fastify/helmet`, `@fastify/rate-limit`, `@fastify/swagger`, `drizzle-orm`, `fastify-type-provider-zod`, `openapi-types`, `pg`, `rate-limiter-flexible`, `@types/pg`, `@vitest/coverage-v8`, `drizzle-kit`). The reused 11 go to the separate sub-list. Four of them are the GP-05 tools (`tsx`, `typescript`, `oxlint`, `@types/node`); the other seven are listed too because rule 2 asks for every dependency of the new workspace (decision for the controller, section 10).

## 5. Mapping: direct dependency added since `acaff20` to its line in the new section

"Line" is the line number in `THIRD_PARTY_NOTICES.md`. Rows 1 to 5 come from the manifest diff (row 5 is the platform package of plan section 3.1, installed by row 1); rows 6 to 28 are the entries of `apps/core-server/package.json` (row 15 is the same `pg` as row 2: the same line). Every package is hoisted: its `package.json` and licence file are at `node_modules/<name>/`; `apps/core-server/node_modules` holds only `.DS_Store`, `.vite` and `.vite-temp`.

| # | Manifest | Package | Declared | Installed | `package.json` read | `license` in it | Licence file read | Line in `THIRD_PARTY_NOTICES.md` |
|--:|---|---|---|---|---|---|---|--:|
| 1 | package.json (root) devDependencies | `embedded-postgres` | `18.4.0-beta.17` | 18.4.0-beta.17 | `node_modules/embedded-postgres/package.json` | MIT | `node_modules/embedded-postgres/LICENSE.md` | 197 |
| 2 | package.json (root) devDependencies | `pg` | `8.23.1` | 8.23.1 | `node_modules/pg/package.json` | MIT | `node_modules/pg/LICENSE` | 199 |
| 3 | apps/core-web/package.json dependencies | `qrcode.react` | `4.2.0` | 4.2.0 | `node_modules/qrcode.react/package.json` | ISC | `node_modules/qrcode.react/LICENSE` | 200 |
| 4 | apps/mobile/package.json dependencies | `expo-secure-store` | `~57.0.4` | 57.0.4 | `node_modules/expo-secure-store/package.json` | MIT | `node_modules/expo-secure-store/LICENSE` | 201 |
| 5 | (installed by embedded-postgres; 02_plan 3.1) | `@embedded-postgres/darwin-arm64` | `^18.4.0-beta.17` | 18.4.0-beta.17 | `node_modules/@embedded-postgres/darwin-arm64/package.json` | MIT | `node_modules/@embedded-postgres/darwin-arm64/LICENSE.md` | 198 |
| 6 | apps/core-server/package.json dependencies | `@fastify/cookie` | `11.1.2` | 11.1.2 | `node_modules/@fastify/cookie/package.json` | MIT | `node_modules/@fastify/cookie/LICENSE` | 202 |
| 7 | apps/core-server/package.json dependencies | `@fastify/helmet` | `13.1.1` | 13.1.1 | `node_modules/@fastify/helmet/package.json` | MIT | `node_modules/@fastify/helmet/LICENSE` | 203 |
| 8 | apps/core-server/package.json dependencies | `@fastify/rate-limit` | `11.2.0` | 11.2.0 | `node_modules/@fastify/rate-limit/package.json` | MIT | `node_modules/@fastify/rate-limit/LICENSE` | 204 |
| 9 | apps/core-server/package.json dependencies | `@fastify/swagger` | `9.9.1` | 9.9.1 | `node_modules/@fastify/swagger/package.json` | MIT | `node_modules/@fastify/swagger/LICENSE` | 205 |
| 10 | apps/core-server/package.json dependencies | `@fastify/websocket` | `11.3.1` | 11.3.1 | `node_modules/@fastify/websocket/package.json` | MIT | `node_modules/@fastify/websocket/LICENSE` | 233 |
| 11 | apps/core-server/package.json dependencies | `drizzle-orm` | `0.45.3` | 0.45.3 | `node_modules/drizzle-orm/package.json` | Apache-2.0 | NONE FOUND (flagged) | 206 |
| 12 | apps/core-server/package.json dependencies | `fastify` | `5.12.5` | 5.12.5 | `node_modules/fastify/package.json` | MIT | `node_modules/fastify/LICENSE` | 232 |
| 13 | apps/core-server/package.json dependencies | `fastify-type-provider-zod` | `7.0.0` | 7.0.0 | `node_modules/fastify-type-provider-zod/package.json` | MIT | `node_modules/fastify-type-provider-zod/LICENSE` | 207 |
| 14 | apps/core-server/package.json dependencies | `openapi-types` | `12.1.3` | 12.1.3 | `node_modules/openapi-types/package.json` | MIT | `node_modules/openapi-types/LICENSE` | 208 |
| 15 | apps/core-server/package.json dependencies | `pg` | `8.23.1` | 8.23.1 | `node_modules/pg/package.json` | MIT | `node_modules/pg/LICENSE` | 199 |
| 16 | apps/core-server/package.json dependencies | `rate-limiter-flexible` | `11.2.1` | 11.2.1 | `node_modules/rate-limiter-flexible/package.json` | ISC | `node_modules/rate-limiter-flexible/LICENSE.md` | 209 |
| 17 | apps/core-server/package.json dependencies | `react` | `19.2.3` | 19.2.3 | `node_modules/react/package.json` | MIT | `node_modules/react/LICENSE` | 238 |
| 18 | apps/core-server/package.json dependencies | `tsx` | `4.23.15` | 4.23.15 | `node_modules/tsx/package.json` | MIT | `node_modules/tsx/LICENSE` | 228 |
| 19 | apps/core-server/package.json dependencies | `zod` | `4.6.5` | 4.6.5 | `node_modules/zod/package.json` | MIT | `node_modules/zod/LICENSE` | 236 |
| 20 | apps/core-server/package.json devDependencies | `@types/node` | `26.6.3` | 26.6.3 | `node_modules/@types/node/package.json` | MIT | `node_modules/@types/node/LICENSE` | 231 |
| 21 | apps/core-server/package.json devDependencies | `@types/pg` | `8.23.1` | 8.23.1 | `node_modules/@types/pg/package.json` | MIT | `node_modules/@types/pg/LICENSE` | 210 |
| 22 | apps/core-server/package.json devDependencies | `@types/ws` | `8.18.2` | 8.18.2 | `node_modules/@types/ws/package.json` | MIT | `node_modules/@types/ws/LICENSE` | 235 |
| 23 | apps/core-server/package.json devDependencies | `@vitest/coverage-v8` | `5.0.3` | 5.0.3 | `node_modules/@vitest/coverage-v8/package.json` | MIT | `node_modules/@vitest/coverage-v8/LICENSE` | 211 |
| 24 | apps/core-server/package.json devDependencies | `drizzle-kit` | `0.31.11` | 0.31.11 | `node_modules/drizzle-kit/package.json` | MIT | NONE FOUND (flagged) | 212 |
| 25 | apps/core-server/package.json devDependencies | `oxlint` | `1.86.0` | 1.86.0 | `node_modules/oxlint/package.json` | MIT | `node_modules/oxlint/LICENSE` | 230 |
| 26 | apps/core-server/package.json devDependencies | `typescript` | `6.0.3` | 6.0.3 | `node_modules/typescript/package.json` | Apache-2.0 | `node_modules/typescript/LICENSE.txt` | 229 |
| 27 | apps/core-server/package.json devDependencies | `vitest` | `5.0.3` | 5.0.3 | `node_modules/vitest/package.json` | MIT | `node_modules/vitest/LICENSE.md` | 237 |
| 28 | apps/core-server/package.json devDependencies | `ws` | `8.22.0` | 8.22.0 | `node_modules/ws/package.json` | MIT | `node_modules/ws/LICENSE` | 234 |

Transitive packages added to the new section because slot logs flagged them:

| Package | Installed | `package.json` read | `license` | Licence file read | Line |
|---|---|---|---|---|--:|
| `fast-uri` (nested under `json-schema-resolver`; N1 F-8 and DN-5) | 3.1.8 | `node_modules/json-schema-resolver/node_modules/fast-uri/package.json` | BSD-3-Clause | `node_modules/json-schema-resolver/node_modules/fast-uri/LICENSE` | 246 |
| `@drizzle-team/brocli` (N1 F-8; required by `drizzle-kit`) | 0.10.2 | `node_modules/@drizzle-team/brocli/package.json` | Apache-2.0 | NONE FOUND (flagged) | 247 |

Not added: `async-exit-hook` 2.0.1 (MIT, `license`; required by `embedded-postgres`) and the other transitive packages of N1 section 6: no slot log flagged them for a notice.

Structure of the appended section (file line, heading):

| File line | Heading |
|--:|---|
| 181 | `## npm packages of the Live mode release, @dems/core-server 0.2.0 (step 107)` |
| 191 | `### Direct dependencies added by this task` |
| 222 | `### Tools and libraries already installed at `acaff20`, used by the new workspace` |
| 240 | `### Transitive packages flagged by an npm slot` |
| 253 | `### PostgreSQL 18.4 binaries (`embedded-postgres` and `@embedded-postgres/darwin-arm64`)` |

## 6. Verification (quoted; run after the append)

```
$ git diff acaff20 --stat -- THIRD_PARTY_NOTICES.md
 THIRD_PARTY_NOTICES.md | 96 ++++++++++++++++++++++++++++++++++++++++++++++++++
 1 file changed, 96 insertions(+)

$ git diff acaff20 -- THIRD_PARTY_NOTICES.md | grep -c '^-[^-]'
0

$ git diff acaff20 --numstat -- THIRD_PARTY_NOTICES.md
96	0	THIRD_PARTY_NOTICES.md

$ git diff acaff20 -- THIRD_PARTY_NOTICES.md | grep '^@@'
@@ -175,3 +175,99 @@ Appended on 2026-10-01 by controller micro step 60b (decision D121). This sectio

$ git rev-parse acaff20:THIRD_PARTY_NOTICES.md
fa76c4556ba02c7e1a8056f7ae88c1ddb4a6e328

$ git hash-object THIRD_PARTY_NOTICES.md
80cd8a1a78f04f8c6012bcda5aeaf3aec9ec83f2

$ wc -l THIRD_PARTY_NOTICES.md
     273 THIRD_PARTY_NOTICES.md
```

`git hash-object` prints the new blob, `80cd8a1a...`, which differs from the `acaff20` blob by design. The one removed-looking line that `grep '^-'` alone would print is the diff header `--- a/THIRD_PARTY_NOTICES.md`, excluded by the pattern `^-[^-]` of the row's check. The appended text has no emoji; its only non-ASCII characters are the section sign (the existing file already uses it) and one apostrophe inside a copyright line copied from `qrcode.react`'s own `LICENSE`. A search of the appended text for `password`, `secret`, `token`, `bearer`, `ses_`, `dvc_` and `api key` found nothing (P21).

## 7. Licence files read, with the text kind found

The text kind is the first licence text in the file, found by its key sentence on whitespace-normalised text. `fast-uri`'s `LICENSE` has the three BSD conditions (the third names "contributors"); the two ISC files and the BSD file were also read in full.

| Licence file read | Bytes | SHA-256 | `license` in `package.json` | Text kind (first licence text in the file) | Agree |
|---|--:|---|---|---|---|
| `node_modules/embedded-postgres/LICENSE.md` | 1068 | `e094f576ecd150e7cad723e0bd56c13bd42ce9f4df61af14f439d852b39ad4d4` | MIT | MIT | yes |
| `node_modules/pg/LICENSE` | 1077 | `192b8f5c96900f04a1271dec39688655d7416c1c6ea84a508e18b50d2b6751f3` | MIT | MIT | yes |
| `node_modules/qrcode.react/LICENSE` | 877 | `908a4454d01d77cd6a0ae1eea0bafaa74a2e3befdbc4b7b714de2499a22351ce` | ISC | ISC | yes |
| `node_modules/expo-secure-store/LICENSE` | 1106 | `fb3ca4a837f5779e83cef89b78253a8949cfb9429c340309f62d0465ec6610b4` | MIT | MIT | yes |
| `node_modules/@embedded-postgres/darwin-arm64/LICENSE.md` | 1068 | `e094f576ecd150e7cad723e0bd56c13bd42ce9f4df61af14f439d852b39ad4d4` | MIT | MIT | yes |
| `node_modules/@fastify/cookie/LICENSE` | 1123 | `ba9677e5a34c2738c26b36bb478f95e0369cac48fbe68a01a91fd5c7972f2043` | MIT | MIT | yes |
| `node_modules/@fastify/helmet/LICENSE` | 2245 | `964706cd807eeda84e0244cff3b85f1fd595dcdaaee145bfee17c97e6495508c` | MIT | MIT | yes |
| `node_modules/@fastify/rate-limit/LICENSE` | 1123 | `d24d2e5bdc50e739dcc8c73f547e54fce61388ea77bb57cf836e0c6ece46f8e8` | MIT | MIT | yes |
| `node_modules/@fastify/swagger/LICENSE` | 1123 | `ba9677e5a34c2738c26b36bb478f95e0369cac48fbe68a01a91fd5c7972f2043` | MIT | MIT | yes |
| `node_modules/@fastify/websocket/LICENSE` | 1123 | `ba9677e5a34c2738c26b36bb478f95e0369cac48fbe68a01a91fd5c7972f2043` | MIT | MIT | yes |
| `node_modules/fastify/LICENSE` | 1123 | `23c91863859171455a536380991b4160fee4e19e2d8dc353ecf7143cc4e53ca2` | MIT | MIT | yes |
| `node_modules/fastify-type-provider-zod/LICENSE` | 1071 | `c73511d5d04f0215788274002a770cdf2dc5ae0a199df8e04cba5692dd579446` | MIT | MIT | yes |
| `node_modules/openapi-types/LICENSE` | 1083 | `a5b243ddbec533f2fc6e809f1194d24623dfc302bb4a29f99093e087928561e8` | MIT | MIT | yes |
| `node_modules/rate-limiter-flexible/LICENSE.md` | 750 | `0c1a06ed3e4eb91c77f80718c552c95bb4c5ef285011319461a1f41dd0ec4df6` | ISC | ISC | yes |
| `node_modules/react/LICENSE` | 1088 | `da6d3703ed11cbe42bd212c725957c98da23cbff1998c05fa4b3d976d1a58e93` | MIT | MIT | yes |
| `node_modules/tsx/LICENSE` | 1088 | `8dded67841a9261a622c739fb61c81785e93765de852828ceeb9403d20a74581` | MIT | MIT | yes |
| `node_modules/zod/LICENSE` | 1072 | `3f1189b28e3866e0d979968d466b78f813f76827cfdca1fbb124cc0a5c8841f8` | MIT | MIT | yes |
| `node_modules/@types/node/LICENSE` | 1141 | `c2cfccb812fe482101a8f04597dfc5a9991a6b2748266c47ac91b6a5aae15383` | MIT | MIT | yes |
| `node_modules/@types/pg/LICENSE` | 1141 | `c2cfccb812fe482101a8f04597dfc5a9991a6b2748266c47ac91b6a5aae15383` | MIT | MIT | yes |
| `node_modules/@types/ws/LICENSE` | 1141 | `c2cfccb812fe482101a8f04597dfc5a9991a6b2748266c47ac91b6a5aae15383` | MIT | MIT | yes |
| `node_modules/@vitest/coverage-v8/LICENSE` | 1102 | `04575fc5bfae19a9b63100f8691f901a2e15a399011ac02db435a9ef27295551` | MIT | MIT | yes |
| `node_modules/oxlint/LICENSE` | 1119 | `95ced5ecf1133fbf41d409b5555c86c344f83f3b019926057ddbc07cfdcc27b3` | MIT | MIT | yes |
| `node_modules/typescript/LICENSE.txt` | 9197 | `a7d00bfd54525bc694b6e32f64c7ebcf5e6b7ae3657be5cc12767bce74654a47` | Apache-2.0 | Apache-2.0 | yes |
| `node_modules/vitest/LICENSE.md` | 45233 | `c8f14eea9df88b94c4710b4c476d8642e080832d7de0d861eba1337746494b4d` | MIT | MIT | yes |
| `node_modules/ws/LICENSE` | 1183 | `2b29dcfe0d6471f7e8c92c5fb38c9f93edee10330937055440192f1832b1ecef` | MIT | MIT | yes |
| `node_modules/json-schema-resolver/node_modules/fast-uri/LICENSE` | 1813 | `b010b0dfdfdb23d7396e03b82cd4621fc9bb8f95d6b0aea70b9c24e12074c786` | BSD-3-Clause | BSD-3-Clause | yes |

Files: 26; agree: 26; disagree: 0; by text kind: {"MIT":22,"ISC":2,"Apache-2.0":1,"BSD-3-Clause":1}.

`vitest`'s `LICENSE.md` (994 lines) opens with the MIT licence of Vitest itself and then lists the licences of bundled code (BSD-3-Clause, ISC, MIT); it is listed once, with its first copyright line. `@fastify/helmet`, `oxlint`, `ws` and `fast-uri` carry more than one copyright line, all of which are in the section. `typescript`'s `LICENSE.txt` is the Apache License 2.0 text with no copyright line.

## 8. PostgreSQL: what was searched and found

Commands and results (names only; no binary file was printed):

```
$ ls -A node_modules/@embedded-postgres/darwin-arm64
.DS_Store  LICENSE.md  README.md  dist  native  package.json  scripts
$ find node_modules/@embedded-postgres/darwin-arm64 \( -iname 'COPYRIGHT*' -o -iname 'licen*' -o -iname 'copying*' -o -iname 'notice*' -o -iname 'readme*' \) -not -type d
node_modules/@embedded-postgres/darwin-arm64/LICENSE.md
node_modules/@embedded-postgres/darwin-arm64/README.md
$ ls -A node_modules/embedded-postgres
LICENSE.md  README.md  dist  package.json
$ find node_modules/embedded-postgres \( -iname 'COPYRIGHT*' -o -iname 'licen*' -o -iname 'copying*' -o -iname 'notice*' \) -not -type d
node_modules/embedded-postgres/LICENSE.md
$ grep -rIl -i -E 'without a written agreement is hereby granted|PostgreSQL Database Management System|PostgreSQL License' node_modules/@embedded-postgres/darwin-arm64
(no output)
$ grep -rIl -E 'without a written agreement is hereby granted' node_modules
(no output)
$ grep -rIl -E 'without a written agreement is hereby granted' docs scripts apps packages THIRD_PARTY_NOTICES.md README.md   (excluding node_modules, android, .expo)
(no output)
```

Both `LICENSE.md` files are MIT (`Copyright (c) 2022 Lei Nelissen`), byte-identical, SHA-256 `e094f576ecd150e7cad723e0bd56c13bd42ce9f4df61af14f439d852b39ad4d4`. Both `package.json` files say `"license": "MIT"`. Both `README.md` files say, in "Credits and Licensing" (platform package lines 62 to 63; wrapper lines 191 to 192), that the binaries are made available under the Apache License 2.0 and the package's own code under the MIT licence, and that the packaging is based on zonky's `embedded-postgres-binaries`. No Apache License 2.0 text file is in either package. Five text files of the platform package carry the notice "PostgreSQL Global Development Group" (they are listed in the section). No file named for a PostgreSQL licence or copyright exists in the package (the `native/share/postgresql` folder holds only SQL scripts, data files and sample configuration files).

The server's own licence, the PostgreSQL License, is named by 02_plan section 3.1 and by D5 and D11; neither npm package states it.

## 9. Findings for the controller

| ID | Finding | Evidence |
|---|---|---|
| F-W85-1 | **The PostgreSQL License text is not on disk.** Not in `@embedded-postgres/darwin-arm64`, not in `embedded-postgres`, not anywhere else in `node_modules/`, `docs/`, `scripts/`, `apps/`, `packages/`. The section says so, names the paths searched, and does not contain the text. It must be added by a row or by the controller from a PostgreSQL source distribution (an upstream fetch is outside this row's rules: no network). The row's text asked for the licence text, so this is the one open item of W85 | section 8 |
| F-W85-2 | **Three packages ship no licence file:** `drizzle-orm` 0.45.3 (Apache-2.0), `drizzle-kit` 0.31.11 (MIT), `@drizzle-team/brocli` 0.10.2 (Apache-2.0). Their identifiers come from `package.json` only; `README.md` of each has no licence statement. Searched to a depth of three levels. The only licence file below `drizzle-kit` is the one of its nested `esbuild` copy. Recorded as found | sections 5 and 8 |
| F-W85-3 | **The binaries' packaging licence is stated two ways:** `package.json` and `LICENSE.md` say MIT; the `README.md` of both packages says the binaries are under the Apache License 2.0 (and the package's own code MIT). PostgreSQL itself is under the PostgreSQL License (plan, D5, D11). Neither the Apache text nor the PostgreSQL text is shipped. All three statements are in the section as found; no reconciliation was attempted | section 8 |
| F-W85-4 | `qrcode.react` bundles the Project Nayuki QR Code generator (MIT; `lib/index.js` lines 66 to 70 carry `Copyright (c) Project Nayuki.` and `SPDX-License-Identifier: MIT`). Its `LICENSE` points to `src/third-party/qrcodegen`, which is not in the installed package. The MIT text of that part is not on disk | `node_modules/qrcode.react/LICENSE`, `lib/index.js` |
| F-W85-5 | `fast-uri` has three copies on disk: 4.2.1 at `node_modules/fast-uri`, 3.1.8 under `ajv`, 3.1.8 under `json-schema-resolver`. The first two are in the lockfile at `acaff20`; only the third was added by this task (N1 section 6). All three are BSD-3-Clause in `package.json`. The licence file of the third was read | lockfile at `acaff20`; section 5 |
| F-W85-6 | `apps/core-server/package.json` declares 15 `dependencies`; N1 recorded 14. The added one is `react` 19.2.3, declared by W14 (D28 D-4, D39). The section lists it with the reused packages | `14_npm_slot_n2_web.md` |
| F-W85-7 | `THIRD_PARTY_NOTICES.md` is copied into the web packages by the packager (`scripts/release/build-web-packages.ts:50`, per the existing file). The packaged copy in `release/` is the earlier version; this row did not touch `release/` (P6, P21) | existing file, "Known issue for the next package rebuild" |

Mismatches between a `package.json` identifier and its licence file: none (26 of 26 agree). Missing licence files: the three of F-W85-2.

## 10. Deviations, decisions needed, process notes

| ID | Item |
|---|---|
| DV-1 | The reused packages beyond the four of GP-05 (`fastify`, `@fastify/websocket`, `ws`, `@types/ws`, `zod`, `vitest`, `react`) are listed too, in the same sub-list and marked "`apps/core-server/package.json` only". Reason: rule 2 asks for a line for every dependency of `apps/core-server/package.json`. The controller can drop those seven rows; the mapping above would then show them as "not listed" |
| DV-2 | `@drizzle-team/brocli` is listed as a second flagged transitive package. N1 F-8 names it ("is Apache-2.0"); DN-5 asks for a notice only for `fast-uri`. It is additive and read from disk |
| DV-3 | The copyright line of each package was added as a column. It is copied from the licence file, without change; it is not required by the row |
| DV-4 | No P23 pre-image patch was written to `.cache/rollback/`. The file had one writer in this task and was identical to its `acaff20` blob before the append, so the patch would be empty, and rule 1 limits writes to the notices file and the two documents |
| DV-5 | The text at the top of the file ("npm dependencies ... are not listed here") was not edited; the new section says that it overrides that statement for the packages of this task (D9 DN-2: append-only) |
| PN-1 | `native/bin/postgres --version` was executed once, to confirm "PostgreSQL 18.4" for the section; it starts no server and writes nothing. The rules asked for reads only; this is the one execution of a binary |
| PN-2 | One scratch command of mine contained a stray `rm -f /dev/null`; the sandbox refused it ("Operation not permitted") and `/dev/null` is intact (`crw-rw-rw-`). The same scratch script also wrote an empty file `.cache_map_tmp_unused` in the repository root, and it was removed in the same command; `ls -a | grep -c cache_map_tmp` printed 0, and `git status` lists no path from this row other than `THIRD_PARTY_NOTICES.md` |
| PN-3 | The scripts and generated files of this row are in the session scratchpad (`/private/tmp/claude-501/-Users-gsp-budi-Documents-DEMS/0d71fd65-4a51-4019-9c48-5c92d11bbdaf/scratchpad/`), outside the repository |

Decisions needed from the controller: (1) how F-W85-1 is closed (which source the PostgreSQL License text is taken from, and which row appends it; a further append-only edit to the same section is enough); (2) whether the seven extra reused rows of DV-1 stay.

## 11. Files

| Path | Change |
|---|---|
| `/Users/gsp-budi/Documents/DEMS/THIRD_PARTY_NOTICES.md` | append: 96 lines (178 to 273); 0 lines removed or changed |
| `/Users/gsp-budi/Documents/DEMS/docs/2026-10-04_dems_backend_rbac_pairing/implementation/85_third_party_notices.md` | create (this document) |
| `/Users/gsp-budi/Documents/DEMS/docs/2026-10-04_dems_backend_rbac_pairing/delegation_progress/coder_execution_step_107.md` | create |

Not written (parallel run): `delegation_progress_report.md`, `status_tasks.md`, `decisions/decisions.md`, `masterplan/02_plan.md`, `implementation/99_implementation_report.md`.

## 12. Rollback R-CO (not executed)

```sh
git checkout acaff20 -- THIRD_PARTY_NOTICES.md
```

This restores the file to the 177 lines of `acaff20` and drops the section. It is safe because nothing else wrote this file in the task; if a later row appends more text to the file, take the text of that row first.

## 13. Follow-up: the PostgreSQL License text (status: blocked at the fetch)

The controller accepted the section (decision D65: DV-1 to DV-4 accepted, F-W85-2 to F-W85-7 recorded) and asked for one further append-only edit that closes F-W85-1: fetch the PostgreSQL `COPYRIGHT` file from PostgreSQL's own source with `curl`, check it, and append it verbatim. The fetch was refused by the sandbox proxy, so nothing was appended. All times are WIB, 2026-10-04.

### 13.1 Result

| Item | Result |
|---|---|
| Status of the follow-up | **blocked** at step 1 (the fetch). Steps 2 to 5 depend on the fetched bytes and were not done, except the evidence gathering of section 13.4 and this section |
| `THIRD_PARTY_NOTICES.md` | not changed by the follow-up. 273 lines; `sed -n '1,273p' THIRD_PARTY_NOTICES.md \| shasum -a 256` prints `f3463911e8ff2f336361eceb960585aeab50907ba62cb9ee9ec8ba09021dc098`, the same value taken before the attempt (11:03) and after it (11:06:44); `git diff acaff20 --stat` still prints `96 insertions(+)` and `grep -c '^-[^-]'` prints `0` |
| `assets/85_postgresql_COPYRIGHT.txt` | not created: no file was fetched |
| Text from memory, a mirror, a search engine or a web-page reader | none used (the controller's rule) |

### 13.2 The command and the exact error

Option (a) of the controller's list, run once, at 11:05:53, with the host `raw.githubusercontent.com` named in the allowed-domains parameter of the command. The response and body went to the scratch folder, not to `assets/`:

```
$ curl -sS --proto '=https' --max-time 30 -D "$TMPDIR/pg_a.hdr" -o "$TMPDIR/pg_a.body" -w 'http=%{http_code} bytes=%{size_download} effective_url=%{url_effective}\n' 'https://raw.githubusercontent.com/postgres/postgres/REL_18_4/COPYRIGHT'
curl: (56) CONNECT tunnel failed, response 502
http=000 bytes=0 effective_url=https://raw.githubusercontent.com/postgres/postgres/REL_18_4/COPYRIGHT
curl exit=56
```

The header file `pg_a.hdr` holds the proxy's answer to the `CONNECT`: `HTTP/1.1 502 Bad Gateway` and `Connection: close`. That is the proxy refusing the tunnel, not an answer of GitHub: no status or byte of the origin was received, no body file was written, and no request reached the origin. It is the same refusal that N1 recorded for the npm registry (03, F-4).

Not attempted, on purpose: options (b) and (c) (the controller's rule is to stop when the refused command is still refused with the host named), a retry with the sandbox bypass (not authorised by the message), and any other source.

Hypothesis, not tested: the allowed-domains parameter of the command tool is documented as effective in auto mode only; if this session is not in auto mode the parameter was ignored and the call behaved as the plain one. The way to unblock is a controller decision: allow `raw.githubusercontent.com` for this one command (the sandbox settings, or a per-command bypass that the controller authorises, as P10 does for npm), then re-delegate steps 1 to 5 as written. Nothing else of the follow-up is waiting.

### 13.3 Steps 2 to 5

Not done (they need the fetched file): the checks of HTTP status, byte count, SHA-256, line count, the three licence paragraphs and the two copyright lines; the comparison of the end year with the `...-2025` notices of the binaries; the append with the new sub-heading; the `diff` of the fenced block against the saved file.

### 13.4 Evidence already gathered for the later append

All read-only, taken at 11:03 to 11:06 WIB. A re-run should repeat them before writing the distribution sentence.

| Check | Command | Result |
|---|---|---|
| Lines 1 to 273 before the follow-up | `sed -n '1,273p' THIRD_PARTY_NOTICES.md \| shasum -a 256` | `f3463911e8ff2f336361eceb960585aeab50907ba62cb9ee9ec8ba09021dc098` |
| Whole file before | `wc -l`; `git hash-object` | 273 lines; `80cd8a1a78f04f8c6012bcda5aeaf3aec9ec83f2` |
| Binaries tracked by git | `git ls-files \| grep -c 'embedded-postgres/'` | `0` (and `git ls-files \| grep -c -i 'postgres'` also prints `0`) |
| `node_modules` ignored | `git check-ignore -q node_modules && echo ignored` | `ignored` |
| `release/` ignored | `git check-ignore -q release` | ignored |
| A file named `postgres` loose under `release/` | `find release -iname '*postgres*'` | none |
| Archive entry names containing `postgres`, `embedded-postgres` or `@embedded-postgres` (names listed only with `unzip -Z1` and `tar -tzf`; nothing extracted or opened) | pattern `(^\|/)postgres(\.exe)?$\|embedded-postgres\|@embedded-postgres` | `any-os-node.zip` 528 entries, 0 matches; `macos-arm64.zip` 11, 0; `macos-x64.zip` 529, 0; `windows-x64.zip` 11, 0; `windows-x64-signed-runtime.zip` 529, 0; `linux-x64.tar.gz` 11, 0; `DEMS-Demo-0.1.0.apk` 1,710, 0 |

What the table supports, once the text is fetched: the repository tracks no PostgreSQL binary; the binaries sit in the git-ignored `node_modules/`; and no archive under `release/` has an entry named for PostgreSQL. The `release/` files date from 2026-10-01 (10:41 to 11:45; they were built three days before the PostgreSQL packages were installed on 2026-10-04 at 06:35, 03 section 3). The check is by entry name only: it does not prove that the bytes of a binary are absent from an archive that holds a single sealed executable.

### 13.5 Correction to an earlier check, and process notes

- **An invalid search, now repeated.** In the first run, the search of the whole of `node_modules/` for the PostgreSQL licence sentence was written as `timeout 100 grep ...`. The `timeout` command does not exist on this macOS (`command not found: timeout`), so that call searched nothing and its empty output meant nothing. The sentence in the appended section and in section 8 (no match under `node_modules/`) rested on it. I repeated the search without `timeout` at 11:05: `grep -rIl -E 'without a written agreement is hereby granted' node_modules` exits 1 (no match), 0 lines on stderr, over 206,764 files. The statement in the section is therefore true, and now supported. The other searches of section 8 (the platform package; `docs`, `scripts`, `apps`, `packages`) had no `timeout` and were valid. The release-archive listing of section 13.4 first used `timeout` for the tar listing and reported 0 entries; it was repeated without it (11 entries, 0 matches).
- No `rm` was run in the follow-up. No file was created outside `docs/2026-10-04_dems_backend_rbac_pairing/` and the session scratch folder (`$TMPDIR`, here `/tmp/claude-501`: `pg_a.hdr`, `linux_tar_list.txt`, `linux_tar_err.txt`, `pg_nm_hits.txt`, `pg_nm_err.txt`). `THIRD_PARTY_NOTICES.md` and `assets/` were not touched.

### 13.6 Update at 11:10: follow-up completed with the controller's fetch (F-W85-1 closed)

After the block above, the controller fetched the file itself, outside the sandbox proxy: one anonymous `curl -sS --proto '=https' --max-time 30 -o <file> 'https://raw.githubusercontent.com/postgres/postgres/REL_18_4/COPYRIGHT'`, reported as `http=200 bytes=1198` at 2026-10-04 11:08:15 WIB, saved in the session scratchpad as `pg_COPYRIGHT_REL_18_4.txt`. I made no network call. The HTTP status is the controller's report; I did not fetch and cannot verify it. Everything else below I checked myself, on the bytes.

**Step 1, the saved copy.** The source file's SHA-256 was compared with the controller's value before use: `3d6af92ff8a4c2cdf69afb1cf44edea727922f5cd0cf8b5f72b11cdecac8fdfd` on both sides (match). Then `cp` to `implementation/assets/85_postgresql_COPYRIGHT.txt` (the destination did not exist); `cmp` source against copy: identical; the copy's SHA-256 is the same value.

**Step 2, my checks of the file** (`implementation/assets/85_postgresql_COPYRIGHT.txt`):

| Check | Result |
|---|---|
| Byte count | 1,198; the last byte is a newline |
| Line count (`wc -l`) | 23 |
| Type (`file`) | ASCII text; 0 non-ASCII bytes, 0 carriage returns, 0 tabs, 0 lines with trailing space |
| First line | `PostgreSQL Database Management System` (line 2: `(also known as Postgres, formerly known as Postgres95)`) |
| The three licence paragraphs | one match each: `Permission to use, copy, modify, and distribute` (line 8), `IN NO EVENT SHALL` (line 13), `THE UNIVERSITY OF CALIFORNIA SPECIFICALLY DISCLAIMS` (line 19) |
| The two copyright lines | line 4 `Portions Copyright (c) 1996-2026, PostgreSQL Global Development Group`; line 6 `Portions Copyright (c) 1994, The Regents of the University of California` |
| Plain text, not a web page | 0 lines with `<` or `>`; 0 matches of `404`, `not found`, `<html`, `<!doctype`, `<body` (case-insensitive); 0 lines with three backticks (so the fenced block cannot be broken) |
| Year range against the shipped notices | the fetched file ends in 2026 (`1996-2026`); the five files shipped with the binaries end in 2025 (`2003-2025`, `2003-2025`, `2007-2025`, `1996-2025`, `1996-2025`). They do not agree on the end year. Both are kept as found; one sentence in the section says so |

**Step 3, the append.** Written by one command: the heading and first paragraph, a fence line, `cat` of the saved file, the closing fence, then the closing paragraph. Nothing existing was replaced; the bullet "is not reproduced here, because it is not on disk" is unchanged, and the first sentence of the new sub-section says it supersedes that bullet. The guard of the command checked first that the lines 1 to 273 hash, the line count 273, the file hash and the distribution facts were as expected (`guards ok=1`).

| Item | Value |
|---|---|
| New sub-heading | file line 275: `### PostgreSQL License text, fetched from PostgreSQL's own source` (same level as the other subsections) |
| Lines added by the follow-up | 32 (the file grew from 273 to 305 lines; file lines 274 to 305) |
| Fence lines | 279 (opening) and 303 (closing); the block holds file lines 280 to 302 |
| Source sentence | URL, tag `REL_18_4`, 2026-10-04 11:08:15 WIB, "one anonymous request, made by the task's controller", 1,198 bytes, SHA-256, and the path of the saved file |
| Distribution sentence | see the table below |

**Distribution evidence** (re-run live for the facts that are cheap to repeat, at 11:09; the archive listing is the one of 11:03 to 11:05, section 13.4):

| Check | Result |
|---|---|
| `git ls-files \| grep -c 'embedded-postgres/'` | `0` |
| `git check-ignore -q node_modules && echo ignored` | `ignored` |
| `git check-ignore -q release` | ignored |
| `find release -iname '*postgres*'` | no file |
| Entry names in the 7 archives of `release/` (names listed with `unzip -Z1` and `tar -tzf`; nothing extracted) | 0 entries named for PostgreSQL in all seven (section 13.4 has the entry counts) |

The sentence in the section therefore says that the repository does not contain the binaries and does not, by that check, redistribute them, and that the archive check is by entry name only and the contents were not opened.

**Step 4, verification (quoted).**

```
$ sed -n '1,273p' THIRD_PARTY_NOTICES.md | shasum -a 256
f3463911e8ff2f336361eceb960585aeab50907ba62cb9ee9ec8ba09021dc098  -

$ git diff acaff20 --stat -- THIRD_PARTY_NOTICES.md
 THIRD_PARTY_NOTICES.md | 128 +++++++++++++++++++++++++++++++++++++++++++++++++
 1 file changed, 128 insertions(+)

$ git diff acaff20 -- THIRD_PARTY_NOTICES.md | grep -c '^-[^-]'
0

$ git diff acaff20 --numstat -- THIRD_PARTY_NOTICES.md
128	0	THIRD_PARTY_NOTICES.md
```

The first value equals the hash of those lines before the follow-up (taken at 11:03 and again at 11:06:44). The fenced block, extracted from the notices file between lines 279 and 303 by `awk`, is 1,198 bytes and 23 lines; `diff` against the saved file exits 0 and `cmp` reports identical; both have SHA-256 `3d6af92ff8a4c2cdf69afb1cf44edea727922f5cd0cf8b5f72b11cdecac8fdfd`. The file ends with a newline. The appended text has no emoji and no new non-ASCII character (7 lines with the section sign or the apostrophe, as before the follow-up). The whole file now has `git hash-object` `f9a2545e73f844336fd867de7706e57f671debbe` and SHA-256 `1a5c8cd7f3f90dcd5e973645ae71888c09541f6c460c31443345d83c5574eec8`.

**Findings.**

| ID | Finding |
|---|---|
| F-W85-1 | Closed. The PostgreSQL License text is in the section, verbatim, from `REL_18_4` |
| F-W85-8 | The end year of the PostgreSQL Global Development Group line differs: 2026 in the fetched `COPYRIGHT` of tag `REL_18_4`, 2025 in the five text files of the platform package `@embedded-postgres/darwin-arm64` 18.4.0-beta.17. Informational; both are kept as found and the section says so |

**Process.** No `rm`; no `timeout`; no network call by me. Files written: `THIRD_PARTY_NOTICES.md` (append), `implementation/assets/85_postgresql_COPYRIGHT.txt` (created by `cp`), this document and the progress file. Scratch files, all in `$TMPDIR` (`/tmp/claude-501`): `w85_part.1`, `w85_part.2`, `w85_block.txt`. Rollback is unchanged: `git checkout acaff20 -- THIRD_PARTY_NOTICES.md` (not executed); the saved file under `assets/` stays or is removed by hand, as the controller decides.

Row status after the follow-up: **complete**. No item of W85 is open.
