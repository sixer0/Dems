---
task_id: 2026-10-04_dems_backend_rbac_pairing
date: 2026-10-04
agent: explore
blueprint_row: 5
scope: service and packaging coupling (apps/mock-core, standalone launcher, scripts/release, release/, root package.json, tsconfig.base.json, .gitignore, .locks)
narrative_tier: 2
status: complete
---

# Row 5: Service and Packaging Coupling (read-only inventory)

## Overview

This file maps what a second backend (planned as `apps/core-server` on `127.0.0.1:4420`, blueprint P4 at `identification/02_structured.md:433`) would touch or collide with, and which files may not change if the released 0.1.0 packages are to stay as they are. It records structure and facts only. It designs nothing.

Method and sources:

- Orientation came from the Graft graph: `graft map`, `graft skeleton apps/mock-core/src/app.ts`, `graft callers buildApp`. Everything else (line numbers, constants, hashes, listings) came from direct inspection with Read, `grep`, `ls`, `cat -n` and `shasum`.
- Nothing under `apps/`, `packages/`, `release/` or `scripts/` was written. No server, build or test was started. The two hash checks that did run are read-only and are listed in "Verification log" at the end.
- Nothing under `apps/mobile/signing/` was opened. `git check-ignore -v apps/mobile/signing/x` was asked only about a path string.
- No web call was made (P20).

Paths below are relative to `/Users/gsp-budi/Documents/DEMS/` unless absolute.

## Findings at a glance

| ID | Finding | Needs a controller decision |
|---|---|---|
| F-E1 | `buildApp()` in mock-core performs no listen and registers cors, websocket, the heartbeat plugin and one health route | no |
| F-E2 | mock-core CORS allows only GET/POST/OPTIONS, header `Content-Type`, no credentials, origin 5173 only; the socket origin rule adds 4400 self origins | yes (DN-5); also a spec input for ADQ-6 |
| F-E3 | Heartbeat is a 1 Hz plugin with a fixed message shape that two clients and two test suites depend on | no |
| F-E4 | The error log writes inside `apps/mock-core/logs/` and stamps `service: dems-mock-core`; Fastify's default logger writes request URLs | no (spec input for NFR2) |
| F-E5 | mock-core host and port are constants with no override; `index.ts` cannot be reused for another port | no |
| F-E6 | mock-core has 4 test files, 19 `it()` blocks; two launcher tests bind fixed ports 4410 and 4411 | no |
| F-E7 | Every mock-core dependency on `@dems/shared` is listed in the coupling table (section 3) | no |
| F-E8 | The launcher imports nothing from `@dems/shared`; it duplicates 5 constants, 2 JSON shapes, the CSP header and 6 security headers; one test file guards them | no |
| F-E9 | Launcher ports are 4410 to 4419, then an OS-assigned port; single-instance probe uses `/api/v1/health` plus header `X-DEMS-Launcher` | no |
| F-E10 | The packaged CSP and the Core endpoint resolver tie the 0.1.0 web build to its own origin; they are imported by the launcher test, the packager and `vite.config.ts` | no |
| F-E11 | `scripts/release/` holds 3 files; none is called by a root npm script; the packager writes into `release/` when run | no |
| F-E12 | `release/web/BUILD-INPUTS.txt` pins 748 input files in 16 roots; the current tree matches all 748 | yes (DN-1) |
| F-E13 | `release/` holds 29 files (28 excluding `.DS_Store`); both checksum sets match the files today; `release/` has no tracked git file | no |
| F-E14 | Root workspace globs pick up any new `apps/*` folder; root `typecheck`, `lint`, `test` run it automatically; root `build` and `theme:gen` rewrite files that are build inputs | yes (DN-6) |
| F-E15 | `tsconfig.base.json` is extended by mock-core and shared only; core-web and mobile do not extend it | no |
| F-E16 | `.gitignore` covers `.env*`, `.cache/`, `.locks/`, `*.log`, `/release/`; it has no rule for a database data directory | no |
| F-E17 | `.locks/` naming convention is documented below; two reference-count markers there are stale | yes (DN-4) |
| F-E18 | 4420 appears nowhere in tracked source; the full list of constants and paths a second backend touches is in section 8 | no |
| F-E19 | Provisional rows 23-27, 57, 66-74, 98-100 write 8 of the 16 build-input roots | yes (DN-1) |
| F-E20 | `HealthResponseSchema` pins `service: 'dems-mock-core'`, `ws.path: '/ws'`, `heartbeatIntervalMs: 1000` as literals | yes (DN-3) |
| F-E21 | `THIRD_PARTY_NOTICES.md` states that npm dependencies are not listed in it; blueprint row 100 plans to add them | yes (DN-2) |
| F-E22 | The 0.1.0 APK has no input fingerprint; its sources are not verifiable the way the web packages are | no (hypothesis flagged) |

## 1. Directory structure

### Directories and files in scope

| Path | Purpose | Status |
|---|---|---|
| `apps/mock-core/` | Fastify health plus heartbeat service, launcher, tests | EXISTING |
| `apps/mock-core/src/` | `app.ts` (103 lines), `heartbeat.ts` (124), `error-log.ts` (46), `index.ts` (54) | EXISTING |
| `apps/mock-core/test/` | `health.test.ts` (44), `heartbeat.test.ts` (39), `ws-origin.test.ts` (45), `standalone-launcher.test.ts` (364) | EXISTING |
| `apps/mock-core/scripts/ws-probe.ts` | WS probe CLI (91 lines) | EXISTING |
| `apps/mock-core/standalone/` | `dems-web-launcher.cjs` (1015 lines), `tsconfig.json` (15 lines) | EXISTING |
| `apps/mock-core/{package.json,tsconfig.json,vitest.config.ts}` | workspace manifests | EXISTING |
| `apps/mock-core/logs/` | target of the error log; does not exist now | ABSENT |
| `scripts/release/` | `build-web-packages.ts` (949 lines), `collect-web-licenses.ts` (248), `gen-npm-licenses.mjs` (192) | EXISTING |
| `release/` | the 0.1.0 packages, git-ignored, no tracked file | EXISTING |
| `.locks/` | lock, PID and log files, git-ignored | EXISTING |
| `.cache/release/` | packager scratch (`licenses`, `node-v26.8.2`, `sea`, `stage`, `web-dist`, `web-manifest.json`) | EXISTING |
| `apps/core-server/`, `scripts/pg/`, `.data/` | planned by the blueprint | NOT YET (no tracked or on-disk trace) |

Evidence: `ls` of each folder; `wc -l`; `git ls-files apps/mock-core scripts release` lists 14 mock-core files and 3 `scripts/release` files and no `release/` file.

### Entry points

- `apps/mock-core/src/index.ts` is the only `listen` call (`index.ts:51`). `app.ts` states "Performs no listen" (`app.ts:2`).
- `apps/mock-core/standalone/dems-web-launcher.cjs` runs `main()` when it is the main module or a Node SEA (`dems-web-launcher.cjs:1013-1015`).
- `scripts/release/build-web-packages.ts` is run as `node --import tsx scripts/release/build-web-packages.ts [options]` (`build-web-packages.ts:4`).

### Configuration files

| File | Relevant content | Source |
|---|---|---|
| `package.json` | scripts, workspace globs, `engines.node >=26.8.2 <27`, `packageManager npm@11.19.1` | `package.json:5-12, 20-35` |
| `.npmrc` | `save-exact=true` | `.npmrc:1` |
| `.node-version` | `26.8.2` | `.node-version:1` |
| `tsconfig.base.json` | strict base (section 6) | `tsconfig.base.json:1-16` |
| `apps/mock-core/package.json` | name `@dems/mock-core`, version `0.1.0`, deps | `apps/mock-core/package.json:2-29` |
| `apps/mock-core/tsconfig.json` | extends base, `types: ["node"]`, include `src scripts test vitest.config.ts` | `apps/mock-core/tsconfig.json:2-6` |
| `apps/mock-core/standalone/tsconfig.json` | `allowJs`, `checkJs`, `nodenext`, include only the launcher | `standalone/tsconfig.json:5-14` |
| `apps/mock-core/vitest.config.ts` | `environment: 'node'`, include `test/**/*.test.ts` | `vitest.config.ts:4-7` |
| `.gitignore` | section 7 | `.gitignore:1-65` |

### File type summary of the inventoried area

| Area | Files | Note |
|---|---|---|
| `apps/mock-core` (excluding `node_modules`) | 4 src, 4 test, 1 script, 2 standalone, 3 config | counted from `ls` |
| `scripts/release` | 2 `.ts`, 1 `.mjs` | `ls -la scripts/release` |
| `release/` | 29 files in 4 folders, 28 excluding `.DS_Store` (listing in section 5) | `ls -laR release` |
| Build inputs pinned by `BUILD-INPUTS.txt` | 748 files in 16 roots | `wc -l`, per-root count in section 4 |

## 2. Findings in detail (Tier 2: what, why it matters here, how verified, source)

### F-E1 App factory
- **Found**: `buildApp(opts)` builds a Fastify instance and returns it without listening. Registration order is `@fastify/cors`, `@fastify/websocket`, the heartbeat plugin plus `GET /api/v1/health`, then an `onError` hook. The logger is a JSON logger at `process.env.LOG_LEVEL ?? 'info'`, or off when `opts.logger === false`. `SERVICE_VERSION` comes from the workspace's own `package.json` through a JSON import. `WS_CLOSE_GRACE_MS` is 1000, and the WS server has `maxPayload: 65536`.
- **Why it matters**: it is the pattern the planned `apps/core-server` would mirror (the blueprint row 25 says "app factory with no listen"). `LOG_LEVEL` is the only environment variable mock-core reads.
- **Verified**: Read of the whole file; `graft skeleton` shows `BuildAppOptions` (27-30) and `buildApp` (32-103); `graft callers buildApp` lists four callers: `index.ts:6`, `health.test.ts:5`, `heartbeat.test.ts:6`, `ws-origin.test.ts:5`.
- **Source**: `apps/mock-core/src/app.ts:2, 4, 18, 22, 25, 33-35, 38, 46-47, 74-90, 93-100`.

### F-E2 CORS and socket origin rules
- **Found**:
  - HTTP CORS: `origin: [...WEB_DEV_ORIGINS]`, `methods: ['GET','POST','OPTIONS']`, `allowedHeaders: ['Content-Type']`, `credentials: false`, `maxAge: 600`. `WEB_DEV_ORIGINS` is `http://127.0.0.1:5173` and `http://localhost:5173` only.
  - Socket origin: `ALLOWED_WS_ORIGINS = WEB_DEV_ORIGINS + SELF_ORIGINS` (`http://127.0.0.1:4400`, `http://localhost:4400`). A request with no `Origin` header passes; any other origin gets `403 {"error":"origin_not_allowed"}` from a `preValidation` hook that runs before the upgrade.
  - There is no `Host` header check in mock-core. (The launcher has one; see F-E8.)
- **Why it matters**: the planned backend needs sign-in (cookie or bearer), role administration and pairing, which means PUT/PATCH/DELETE and an `Authorization` header or credentialed requests. The mock-core rule allows none of these. The shared Vite lane 5178 (P14, `02_structured.md:454`) and spare lanes 5176-5177 (`:430`) are not in `WEB_DEV_ORIGINS`. Editing `WEB_DEV_ORIGINS` means editing a build-input file (section 4).
- **Verified**: Read; the tests `health.test.ts:15-37` (allowed origin gets ACAO, foreign origin gets none) and `ws-origin.test.ts:37-44` (403 for `http://evil.example`, 101 for 5173 and for no origin) encode the same rules.
- **Source**: `app.ts:38-44`; `heartbeat.ts:20, 62-67, 91`; `packages/shared/src/api/constants.ts:27, 29`.

### F-E3 Heartbeat
- **Found**: a plugin owns `seq`, a client `Map`, and a 1 Hz `setInterval` started in `onReady` and cleared in `onClose`. A connecting client gets one heartbeat immediately. Inbound messages are counted and ignored. Socket errors go to the error log. The message always carries `sessionState: null`. `/api/v1/health` reports `ws.clients` from the same hub.
- **Why it matters**: the mobile HEARTBEAT mode (`ws://127.0.0.1:4400/ws`, `apps/mobile/src/runtime/core-link.ts:7`) and both clients' `HeartbeatProvider` (default `CORE_WS_URL`, `packages/shared/src/realtime/heartbeat-context.tsx:2, 22`) read this shape. The schema `HeartbeatSchema` allows `sessionState` to be a `SessionState` or null (`realtime-messages.ts:33`), so a live backend can fill it without a schema change; `intervalMs` is the literal 1000 and `v` the literal 1.
- **Verified**: Read of `heartbeat.ts`; `heartbeat.test.ts:9-38` checks bind address, at least 3 schema-valid beats, strictly increasing `seq`, close code 1001.
- **Source**: `heartbeat.ts:36-60, 79-89, 91-123`; `packages/shared/src/api/realtime-messages.ts:5-20, 25-34`.

### F-E4 Error log and logging
- **Found**: `appendErrorLog` appends one JSON object per line to `apps/mock-core/logs/errors.log` (path resolved from `import.meta.url`, `error-log.ts:10-15`), creating the folder on demand. Each line carries `service: 'dems-mock-core'` (`:41`) and a `source` string: `mock-core.http` (`app.ts:96`), `mock-core.websocket` (`app.ts:66`), `mock-core.heartbeat.socket` (`heartbeat.ts:118`), `mock-core.<name>` for fatal and shutdown events (`index.ts:16, 30`). The function swallows its own errors (`error-log.ts:43-45`). Its doc says context holds "Never payloads or secrets" (`error-log.ts:23`). The folder does not exist today. The file would be ignored through the root `*.log` rule (`git check-ignore -v apps/mock-core/logs/errors.log` answers `.gitignore:48:*.log`).
- **Found (stdout logger)**: the default Fastify logger is used with no redaction option (`app.ts:33-35`). A saved mock-core run shows request lines with `req.method`, `req.url`, `req.host`, `req.remoteAddress` (`.locks/mock-core.step53.log`, line 10).
- **Why it matters**: if a second backend imported this module it would write into mock-core's folder and mislabel its service. A URL that carries a token or pairing code would appear in the default request log. NFR2 of the blueprint ("no secret in git, logs, URLs") is not served by anything in mock-core.
- **Verified**: Read; `ls apps/mock-core` (no `logs`); `git check-ignore -v`; a head of the saved log (no secret in it).
- **Source**: `apps/mock-core/src/error-log.ts:10-46`; `app.ts:33-35, 62-71, 93-100`.

### F-E5 Entry point, host, port, shutdown
- **Found**: `index.ts` listens on `MOCK_CORE_HOST` and `MOCK_CORE_PORT` imported from the shared contract. SIGINT and SIGTERM start a graceful close with a 5000 ms timeout. A second signal, an uncaught exception or an unhandled rejection exits with code 1. Workspace scripts: `dev` is `tsx watch src/index.ts`, `start` is `tsx src/index.ts`, `build` and `typecheck` are `tsc --noEmit`, `lint` is `oxlint`, `test` is `vitest run`, `probe:ws` is `tsx scripts/ws-probe.ts`.
- **Why it matters**: the shared constants state "there are no environment overrides" (`constants.ts:3`), so mock-core's host and port cannot be configured and `index.ts` is not reusable for port 4420. mock-core runs TypeScript source directly through `tsx`; nothing is compiled.
- **Verified**: Read of `index.ts` and `package.json`.
- **Source**: `index.ts:5, 9, 20-48, 51`; `apps/mock-core/package.json:6-14`; `packages/shared/src/api/constants.ts:1-9`.

### F-E6 Tests
- **Found**: four files, 19 `it()` blocks by static count (3 + 1 + 13 + 2), none run in this row. Fixed ports: only `standalone-launcher.test.ts:344-363` binds 4410 and 4411, and it skips itself when either is busy (`:351`). Every other test uses port 0 (`heartbeat.test.ts:11`, `ws-origin.test.ts:13`, launcher tests `--port 0` at `:173`, `:295`). Vitest config has no worker or setup options; the root script `test` is `npm run test --workspaces --if-present` (`package.json:34`).
- **Why it matters**: tests of a second backend that follow this pattern (in-process `inject` and port 0) do not collide with mock-core or with each other. The only collision surface is 4410 and 4411.
- **Verified**: `grep -c` of `it(` and `describe(` per file; Read of all four files.
- **Source**: `apps/mock-core/test/*.test.ts`; `apps/mock-core/vitest.config.ts:4-7`.

## 3. Coupling table: `@dems/shared` dependencies of mock-core and the launcher

Resolution mechanism: `apps/mock-core/package.json:16` declares `"@dems/shared": "*"`. npm links it as `node_modules/@dems/shared -> ../../packages/shared` (`ls -la node_modules/@dems`). The exports map points each subpath at TypeScript source, for example `"./api": "./src/api/index.ts"` (`packages/shared/package.json:9`), so there is no build step: an edit of `packages/shared/src/**` reaches mock-core, both clients and the launcher test at once.

### 3a. mock-core source, script and test files

| # | Consumer (file:line) | Shared symbol | Defined at | Use site | If the shared value or shape changes |
|---|---|---|---|---|---|
| C1 | `apps/mock-core/src/app.ts:10` | `API_VERSION` | `constants.ts:32` | `app.ts:81` | health body and launcher guard test |
| C2 | `app.ts:11` | `HEALTH_PATH` | `constants.ts:15` | `app.ts:77` | route moves; launcher guard test fails |
| C3 | `app.ts:12` | `HEARTBEAT_INTERVAL_MS` | `constants.ts:20` | `app.ts:86` | health body; launcher guard test |
| C4 | `app.ts:13` | `SERVICE_NAME` | `constants.ts:31` | `app.ts:79` | health body; launcher guard test |
| C5 | `app.ts:14` | `WEB_DEV_ORIGINS` | `constants.ts:27` | `app.ts:39` | CORS allowlist |
| C6 | `app.ts:15` | `WS_PATH` | `constants.ts:17` | `app.ts:85` | health body |
| C7 | `app.ts:16` | type `HealthResponse` | `health.ts:5` | `app.ts:77` | return type check |
| C8 | `apps/mock-core/src/heartbeat.ts:12` | `HEARTBEAT_INTERVAL_MS` | `constants.ts:20` | `heartbeat.ts:56, 83` | message field and ticker period |
| C9 | `heartbeat.ts:13` | `SELF_ORIGINS` | `constants.ts:29` | `heartbeat.ts:20` | socket origin set |
| C10 | `heartbeat.ts:14` | `WEB_DEV_ORIGINS` | `constants.ts:27` | `heartbeat.ts:20` | socket origin set |
| C11 | `heartbeat.ts:15` | `WS_PATH` | `constants.ts:17` | `heartbeat.ts:91` | upgrade route |
| C12 | `heartbeat.ts:16` | type `Heartbeat` | `realtime-messages.ts:5` | `heartbeat.ts:49` | return type of the message builder |
| C13 | `apps/mock-core/src/index.ts:5` | `MOCK_CORE_HOST`, `MOCK_CORE_PORT` | `constants.ts:8-9` | `index.ts:51` | bind address of mock-core |
| C14 | `apps/mock-core/scripts/ws-probe.ts:12` | `CORE_WS_URL`, `HeartbeatSchema` | `constants.ts:18`; `realtime-messages.ts:25` | `ws-probe.ts:16, 75` | probe default URL and validation |
| C15 | `apps/mock-core/package.json:16` | workspace dependency `@dems/shared` | `packages/shared/package.json:2` | n/a | resolution of every row above |
| C16 | `apps/mock-core/test/health.test.ts:4` | `HealthResponseSchema` | `health.ts:23` | `health.test.ts:23` | test fails on shape change |
| C17 | `apps/mock-core/test/heartbeat.test.ts:5` | `HeartbeatSchema`, type `Heartbeat` | `realtime-messages.ts:25, 5` | `heartbeat.test.ts:16, 22` | test fails on shape change |
| C18 | `apps/mock-core/test/ws-origin.test.ts` (no import) | literal duplicates: `/ws` (`:20`), `http://127.0.0.1:5173` (`:42`), `http://evil.example` (`:37`) | `constants.ts:17, 27` | same lines | not tied to the constants; fails if 5173 leaves the allowlist |
| C19 | `apps/mock-core/test/health.test.ts` (no import for these) | literal duplicates: `/api/v1/health` (`:18`), origin `http://127.0.0.1:5173` (`:19, :26`), `{ path: '/ws', heartbeatIntervalMs: 1000, clients: 0 }` (`:25`) | `constants.ts:15, 17, 20, 27` | same lines | same |

### 3b. Standalone launcher (`apps/mock-core/standalone/dems-web-launcher.cjs`)

The launcher has no import or `require` of `@dems/shared` (its `require` calls are `node:*` only, `dems-web-launcher.cjs:24-29`). It duplicates the contract on purpose; its header names the guard (`:20-21`).

| # | Launcher (file:line) | What is duplicated | Shared definition | Guard |
|---|---|---|---|---|
| L1 | `dems-web-launcher.cjs:37` | `HEALTH_PATH = '/api/v1/health'` | `constants.ts:15` | `standalone-launcher.test.ts:156` |
| L2 | `:38` | `WS_PATH = '/ws'` | `constants.ts:17` | test `:157` |
| L3 | `:39` | `HEARTBEAT_INTERVAL_MS = 1000` | `constants.ts:20` | test `:158` |
| L4 | `:40` | `SERVICE_NAME = 'dems-mock-core'` | `constants.ts:31` | test `:159` |
| L5 | `:41` | `API_VERSION = 'v1'` | `constants.ts:32` | test `:160` |
| L6 | `:378-387` | the health JSON body (`status`, `service`, `version`, `apiVersion`, `serverTime`, `uptimeMs`, `ws.{path,heartbeatIntervalMs,clients}`) | `health.ts:5-21`, schema `:23-35` | test `:191` (`HealthResponseSchema.parse` of a live reply) and `:192`; self-test shape check `launcher:791-808` |
| L7 | `:389-399` | the heartbeat JSON (`type`, `v: 1`, `seq`, `serverTime`, `uptimeMs`, `intervalMs`, `clients`, `sessionState: null`) | `realtime-messages.ts:5-20`, schema `:25-34` | test `:195-211` (`HeartbeatSchema.parse` of 2 live beats); self-test `launcher:811-824` |
| L8 | `:88-103` | the CSP header text | `apps/core-web/src/lib/packaged-csp.ts:47-67` (header delivery) | test `:161-163` for ports 4410, 4419, 51234 and `:185`; packager `build-web-packages.ts:281` |
| L9 | `:105-115` | six security headers as literals | none in shared | test `:185-190` asserts the literal values |
| L10 | `:33` | `VERSION = '0.1.0'` | equals `apps/mock-core/package.json:3` and `build-web-packages.ts:47` | test `:183, :192` compare to the literal `'0.1.0'`; nothing links them to `package.json` (hypothesis: a version bump in mock-core would not fail any test) |
| L11 | `:409-413` | origin and host rule: own origin only, `421` for a foreign `Host` | differs from mock-core (`heartbeat.ts:20`) | test `:213-235` |
| L12 | `:43-47` | `HOST`, `DEFAULT_PORT 4410`, fallbacks 4411-4419, `MAX_WS_CLIENTS 32`, `MAX_WS_PAYLOAD 65536` | none in shared (mock-core uses `maxPayload: 65536` at `app.ts:47`) | test `:344-363` (4410 to 4411 fallback) |

Not duplicated by the launcher: `API_BASE_PATH` (the launcher hard-codes `/api` and `/api/` for its 404 rule, `:470`), `WEB_DEV_ORIGINS`, `SELF_ORIGINS`, `CORE_HTTP_ORIGIN`, `CORE_WS_URL`.

### 3c. The guarding test

The one test that guards the launcher is `apps/mock-core/test/standalone-launcher.test.ts` (header: `:1-3`). It has 13 `it()` blocks in 3 `describe()` blocks and runs the launcher as a child process against a fixture web root. It also imports `packagedCsp` from `../../core-web/src/lib/packaged-csp` (`:24`), which makes it the only test that reaches across workspaces. The packager runs this same file as part of its gate (`build-web-packages.ts:255`) and type-checks the launcher with `standalone/tsconfig.json` (`:254`). Root `npm run typecheck` does not check the launcher: `apps/mock-core/tsconfig.json:6` includes `src scripts test vitest.config.ts`, and `standalone/tsconfig.json` is referenced only at `build-web-packages.ts:254`.

## 4. The "must not change" list for the 0.1.0 packages' sources

### 4a. Hash-pinned build inputs (`release/web/BUILD-INPUTS.txt`, 748 files)

`build-web-packages.ts:133-150` defines `INPUT_ROOTS`. `release/web/BUILD-INPUTS.txt` lists each input file with its SHA-256 (748 lines; per-root counts below from `awk` over the file, which sum to 748). `--verify-inputs` (`build-web-packages.ts:195-215`) reports a file as `changed` if its hash differs, `removed` if it is gone, and `added` if any new file appears under a directory root. It exits 1 on any of the three. Reading the file and the code is how this list was made; the script itself was not run.

| # | Input root (must not change) | Files pinned | Notes |
|---|---|---|---|
| 1 | `apps/core-web/src/**` | 360 | includes tests under `src/` (`build-web-packages.ts:132` says "a superset") |
| 2 | `apps/core-web/public/**` | 1 | `favicon.svg` |
| 3 | `apps/core-web/index.html` | 1 | |
| 4 | `apps/core-web/vite.config.ts` | 1 | imports `./src/lib/packaged-csp.ts` (`vite.config.ts:7`) |
| 5 | `apps/core-web/package.json` | 1 | |
| 6 | `packages/shared/src/**` | 81 | contract, simulator, i18n, demo-data, realtime |
| 7 | `packages/shared/assets/**` | 292 | demo media and evidence packages |
| 8 | `packages/shared/theme/**` | 3 | generated CSS |
| 9 | `packages/shared/openapi/**` | 1 | `openapi.json` |
| 10 | `packages/shared/package.json` | 1 | holds the `exports` map (`:6-21`) |
| 11 | `apps/mock-core/standalone/dems-web-launcher.cjs` | 1 | embedded as the SEA main script |
| 12 | `scripts/release/build-web-packages.ts` | 1 | |
| 13 | `scripts/release/collect-web-licenses.ts` | 1 | |
| 14 | `THIRD_PARTY_NOTICES.md` | 1 | copied into every package's `licenses/` |
| 15 | `package.json` (root) | 1 | |
| 16 | `package-lock.json` (root) | 1 | |

Baseline state today (read-only evidence, run in this row):

- `shasum -a 256 -c release/web/BUILD-INPUTS.txt` answered `OK=748 FAILED=0`.
- A `find` of the 16 roots (skipping `.DS_Store`, as the packager's `walk` does, `build-web-packages.ts:101`) against the file list gave 748 files in the tree and 748 in the list, with 0 added and 0 removed.
- So the tree equals the build inputs of the 0.1.0 web packages right now. The next change to any path above, or any new file under roots 1, 2, 6, 7, 8 or 9, makes `--verify-inputs` exit 1.

### 4b. Files that are not hash-pinned but must not change (behavioural coupling)

| File | Why (source) |
|---|---|
| `apps/mock-core/test/standalone-launcher.test.ts` | the guard of the launcher; run by the packager gate (`build-web-packages.ts:255`); P21 forbids changes under `apps/mock-core/` (`02_structured.md:438, 476`) |
| `apps/mock-core/standalone/tsconfig.json` | the packager's gate type-checks the launcher with it (`build-web-packages.ts:254`) |
| `apps/mock-core/package.json` | `version` `0.1.0` is what mock-core's health returns (`app.ts:22`) and what `health.test.ts:24` compares with; the launcher's own `0.1.0` is a literal |
| `apps/mock-core/src/**`, `apps/mock-core/scripts/ws-probe.ts`, `apps/mock-core/{tsconfig.json,vitest.config.ts}` | not packaged, but `apps/mock-core/**` is read-only by P5 and P21; HEARTBEAT mode regression depends on them |
| In `packages/shared/src/api/`: values of `HEALTH_PATH`, `WS_PATH`, `HEARTBEAT_INTERVAL_MS`, `SERVICE_NAME`, `API_VERSION`; the shapes of `HealthResponseSchema` and `HeartbeatSchema` | the launcher test fails if any of them differs from the launcher's duplicates (`standalone-launcher.test.ts:156-160, 191, 201`). Additive members elsewhere in the contract do not trip it |
| `apps/core-web/src/lib/packaged-csp.ts` text of `packagedCspDirectives` | must stay byte-equal to the launcher's `cspHeader` (`packaged-csp.ts:5-8`; `standalone-launcher.test.ts:161-163`; `build-web-packages.ts:280-281`) |
| `.gitignore` rule `/release/` (`.gitignore:64`) | `preflight()` fails if `release/probe` is not ignored (`build-web-packages.ts:117`). Additive rules are safe |
| `.npmrc`, `.node-version`, root `engines` | the packager requires Node exactly `v26.8.2` (`build-web-packages.ts:116`); `save-exact=true` pins every dependency |
| `tsconfig.base.json` | hypothesis: `packages/shared/tsconfig.json:2` extends it and Vite's transform reads the nearest tsconfig for TypeScript files, so a change could alter the bundle. Not run or proven |
| `release/**` (all 29 files) | P21: never written. `RUN-ON-ANOTHER-PC.md` is rewritten by the packager only when its text changes (`build-web-packages.ts:864-870, 895`), so do not run the packager |
| `docs/2026-09-30_dems_demo_stack_setup/implementation/73_web_core_origin.md`, `.../33_sim_gap_closure_web.md` | the packager checks that they exist and logs "in" or "NOT YET IN" (`build-web-packages.ts:62-68, 880-881`). Low impact: a log line only |

### 4c. What the Android APK depends on (no pin)

- `release/android/BUILD-INFO.txt` records `git_head: 33e4c9577ff5... (dirty files: 952)`, the build time, versions and the signer subject. It contains no input fingerprint. The APK's sources are `apps/mobile/**` (excluding the git-ignored `android/` and `signing/`) plus `packages/shared/**`. Nothing in the repository can verify today that they match the APK. This is a hypothesis about intent, labelled as such: any change to `apps/mobile` or `packages/shared` would change what a rebuild produces, and no check would flag it.
- The APK is signed with a demo key kept under `apps/mobile/signing/` (git-ignored, `.gitignore:65`; the signing plugin is `apps/mobile/plugins/with-dems-release-signing.js`). Neither was opened.

## 5. `release/` listing (quoted) and checksum files

Command: `ls -laR /Users/gsp-budi/Documents/DEMS/release`. No file under it was opened for writing; the only reads were `cat`, `sed`, `grep` and `shasum`.

```
/Users/gsp-budi/Documents/DEMS/release:
total 40
drwxr-xr-x@  6 gsp-budi  staff   192 Oct  1 11:33 .
drwxr-xr-x@ 25 gsp-budi  staff   800 Oct  1 12:06 ..
-rw-r--r--@  1 gsp-budi  staff  6148 Oct  4 00:28 .DS_Store
-rw-r--r--@  1 gsp-budi  staff  9428 Oct  1 11:38 RUN-ON-ANOTHER-PC.md
drwxr-xr-x@  8 gsp-budi  staff   256 Oct  1 11:22 android
drwxr-xr-x@ 17 gsp-budi  staff   544 Oct  1 11:45 web

/Users/gsp-budi/Documents/DEMS/release/android:
total 278544
drwxr-xr-x@ 8 gsp-budi  staff        256 Oct  1 11:22 .
drwxr-xr-x@ 6 gsp-budi  staff        192 Oct  1 11:33 ..
-rw-r--r--@ 1 gsp-budi  staff       1091 Oct  1 10:41 BUILD-INFO.txt
-rw-r--r--@ 1 gsp-budi  staff  142592154 Oct  1 10:41 DEMS-Demo-0.1.0.apk
-rw-r--r--@ 1 gsp-budi  staff         86 Oct  1 10:41 DEMS-Demo-0.1.0.apk.sha256
-rw-r--r--@ 1 gsp-budi  staff       8189 Oct  1 11:33 INSTALL-ANDROID.md
-rw-r--r--@ 1 gsp-budi  staff        766 Oct  1 11:22 SHA256SUMS.txt
drwxr-xr-x@ 9 gsp-budi  staff        288 Oct  1 11:22 licenses

/Users/gsp-budi/Documents/DEMS/release/android/licenses:
total 2936
drwxr-xr-x@ 9 gsp-budi  staff      288 Oct  1 11:22 .
drwxr-xr-x@ 8 gsp-budi  staff      256 Oct  1 11:22 ..
-rw-r--r--@ 1 gsp-budi  staff    11357 Oct  1 11:21 Apache-2.0-MaterialSymbols.txt
-rw-r--r--@ 1 gsp-budi  staff     4377 Oct  1 11:21 OFL-1.1-Inter.txt
-rw-r--r--@ 1 gsp-budi  staff     4399 Oct  1 11:21 OFL-1.1-JetBrainsMono.txt
-rw-r--r--@ 1 gsp-budi  staff     4426 Oct  1 11:21 OFL-1.1-Orbitron.txt
-rw-r--r--@ 1 gsp-budi  staff     2230 Oct  1 11:22 README.txt
-rw-r--r--@ 1 gsp-budi  staff  1440578 Oct  1 11:21 THIRD-PARTY-LICENSES.txt
-rw-r--r--@ 1 gsp-budi  staff    20004 Oct  1 11:21 THIRD_PARTY_NOTICES.md

/Users/gsp-budi/Documents/DEMS/release/web:
total 854680
drwxr-xr-x@ 17 gsp-budi  staff       544 Oct  1 11:45 .
drwxr-xr-x@  6 gsp-budi  staff       192 Oct  1 11:33 ..
-rw-r--r--@  1 gsp-budi  staff     20172 Oct  1 11:48 BUILD-INFO.txt
-rw-r--r--@  1 gsp-budi  staff     92414 Oct  1 11:45 BUILD-INPUTS.txt
-rw-r--r--@  1 gsp-budi  staff  37196089 Oct  1 11:45 DEMS-Web-Demo-0.1.0-any-os-node.zip
-rw-r--r--@  1 gsp-budi  staff       102 Oct  1 11:45 DEMS-Web-Demo-0.1.0-any-os-node.zip.sha256
-rw-r--r--@  1 gsp-budi  staff  83886762 Oct  1 11:45 DEMS-Web-Demo-0.1.0-linux-x64.tar.gz
-rw-r--r--@  1 gsp-budi  staff       103 Oct  1 11:45 DEMS-Web-Demo-0.1.0-linux-x64.tar.gz.sha256
-rw-r--r--@  1 gsp-budi  staff  80746025 Oct  1 11:45 DEMS-Web-Demo-0.1.0-macos-arm64.zip
-rw-r--r--@  1 gsp-budi  staff       102 Oct  1 11:45 DEMS-Web-Demo-0.1.0-macos-arm64.zip.sha256
-rw-r--r--@  1 gsp-budi  staff  83136920 Oct  1 11:45 DEMS-Web-Demo-0.1.0-macos-x64.zip
-rw-r--r--@  1 gsp-budi  staff       100 Oct  1 11:45 DEMS-Web-Demo-0.1.0-macos-x64.zip.sha256
-rw-r--r--@  1 gsp-budi  staff  76256035 Oct  1 11:45 DEMS-Web-Demo-0.1.0-windows-x64-signed-runtime.zip
-rw-r--r--@  1 gsp-budi  staff       117 Oct  1 11:45 DEMS-Web-Demo-0.1.0-windows-x64-signed-runtime.zip.sha256
-rw-r--r--@  1 gsp-budi  staff  76213194 Oct  1 11:45 DEMS-Web-Demo-0.1.0-windows-x64.zip
-rw-r--r--@  1 gsp-budi  staff       102 Oct  1 11:45 DEMS-Web-Demo-0.1.0-windows-x64.zip.sha256
-rw-r--r--@  1 gsp-budi  staff       626 Oct  1 11:45 SHA256SUMS.txt
```

Counts from that listing: `release/` 2 files (`.DS_Store`, `RUN-ON-ANOTHER-PC.md`); `release/android` 5 files plus `licenses/` with 7 files; `release/web` 15 files and no subfolder. Total 2 + 5 + 7 + 15 = 29 files, 28 excluding `.DS_Store`. Four folders: `release`, `release/android`, `release/android/licenses`, `release/web`.

Checksum files and what they cover:

| File | Lines | Covers |
|---|---|---|
| `release/web/SHA256SUMS.txt` | 6 | the six web archives, bare file names (so it must be checked from inside `release/web`) |
| `release/web/<archive>.sha256` | 6 files, 1 line each | one archive each |
| `release/web/BUILD-INPUTS.txt` | 748 | the build inputs (section 4a), not the archives |
| `release/android/SHA256SUMS.txt` | 8 | `DEMS-Demo-0.1.0.apk` and the 7 files under `licenses/` (relative paths) |
| `release/android/DEMS-Demo-0.1.0.apk.sha256` | 1 | the APK |

Baseline integrity evidence (read-only, run in this row): all 6 web archives, the APK and the 7 licence files hash to the values in their checksum files; the 7 per-file `.sha256` entries agree with the computed hashes. `release/` has no file tracked in git (`git ls-files release` printed nothing), so the checksum files are the only integrity record.

## 6. Root `package.json`, workspace globs, `tsconfig.base.json`

### 6a. Root scripts (quoted from `package.json:20-35`)

```
"scripts": {
  "theme:gen": "npm run build -w @dems/shared",
  "dev:mock": "npm run dev -w @dems/mock-core",
  "dev:web": "npm run dev -w @dems/core-web",
  "dev:mobile": "npm run dev -w @dems/mobile",
  "android": "npm run android -w @dems/mobile",
  "emulator": "emulator -avd dems_tablet -no-metrics -gpu host -no-boot-anim",
  "emulator:phone": "emulator -avd dems_phone -no-metrics -gpu host -no-boot-anim",
  "mobile:reverse": "npm run reverse -w @dems/mobile",
  "probe:ws": "npm run probe:ws -w @dems/mock-core --",
  "build": "npm run build -w @dems/shared -w @dems/mock-core -w @dems/core-web",
  "build:android": "npm run build -w @dems/mobile",
  "typecheck": "npm run typecheck --workspaces --if-present",
  "lint": "npm run lint --workspaces --if-present",
  "test": "npm run test --workspaces --if-present"
}
```

| Script | Line | Targets | Picks up a new `apps/core-server` automatically | Touches a build input |
|---|---|---|---|---|
| `theme:gen` | 21 | `@dems/shared` build: `tsx scripts/gen-theme.ts && tsc --noEmit` (`packages/shared/package.json:24`) | no | yes: `gen-theme.ts:323-325` rewrites the 3 files in `packages/shared/theme/` (root 8) |
| `dev:mock` | 22 | mock-core `dev` | no | no |
| `dev:web`, `dev:mobile`, `android` | 23-25 | core-web, mobile | no | no |
| `emulator`, `emulator:phone` | 26-27 | AVDs `dems_tablet`, `dems_phone` | no | no |
| `mobile:reverse` | 28 | mobile `reverse` = `adb reverse tcp:4400 tcp:4400 && adb reverse tcp:8081 tcp:8081` (`apps/mobile/package.json:18`) | no | no |
| `probe:ws` | 29 | mock-core `probe:ws` (default URL from `CORE_WS_URL`, `ws-probe.ts:16`) | no | no |
| `build` | 30 | `-w @dems/shared -w @dems/mock-core -w @dems/core-web` (named list) | no: a new workspace is not built unless this line is edited | yes: runs shared `build`, which rewrites the theme files; core-web `build` is `vite build && tsc -b` |
| `build:android` | 31 | mobile `build` = `expo prebuild ... && cd android && ./gradlew assembleDebug` | no | no (KI-21: prebuild wipes `apps/mobile/android/`) |
| `typecheck` | 32 | every workspace that has the script | yes | no |
| `lint` | 33 | every workspace that has the script | yes | no |
| `test` | 34 | every workspace that has the script | yes | no |

Also in root `package.json`: `engines.node` `>=26.8.2 <27` (`:6-8`), `packageManager npm@11.19.1` (`:5`), `overrides` pinning React 19.2.3 and its types (`:13-19`), `allowScripts` for `@shopify/react-native-skia@2.6.2` (`:36-38`). No root script calls anything in `scripts/release/` (`grep` of `package.json` for `release`, `build-web-packages`, `collect-web-licenses`, `gen-npm-licenses`: no match).

### 6b. Workspace globs

- `"workspaces": ["packages/*", "apps/*"]` (`package.json:9-12`; the lockfile repeats it at `package-lock.json:10-13`).
- The lockfile registers each workspace twice: `apps/core-web` (`package-lock.json:18`), `apps/mobile` (`:176`), `apps/mock-core` (`:356`), `packages/shared` (`:25800`), and link entries `node_modules/@dems/core-web` (`:2175`), `.../mobile` (`:2179`), `.../mock-core` (`:2183`), `.../shared` (`:2187`). Disk symlinks match: `ls -la node_modules/@dems` shows four links.
- Consequence for a new `apps/core-server`: the glob registers it with no edit of the root `package.json`. The first `npm install` after its `package.json` appears adds a workspace entry and a link entry to `package-lock.json` (a build input, root 16), and any new dependency adds more. The lockfile has `lockfileVersion: 3` (`:4`).
- Backend dependencies already hoisted at the root: `fastify` 5.12.5, `ws` 8.22.0, `zod` 4.6.5, `@fastify/cors` and `@fastify/websocket` (`grep '"version"' node_modules/<name>/package.json`; `ls node_modules/@fastify`). `.npmrc` has `save-exact=true`. Hypothesis: a new workspace that pins a different version of a package that is already hoisted could change which copy sits at the root and so which copy core-web resolves. Not tested.

### 6c. `tsconfig.base.json` (quoted lines)

```
 3  "target": "ES2023",              7  "strict": true,
 4  "lib": ["ES2023"],               8  "noUncheckedIndexedAccess": true,
 5  "module": "ESNext",              9  "isolatedModules": true,
 6  "moduleResolution": "Bundler",  10  "verbatimModuleSyntax": true,
11  "erasableSyntaxOnly": true,     12  "resolveJsonModule": true,
13  "skipLibCheck": true,           14  "noEmit": true
```

| Consumer | Extends the base? | Source |
|---|---|---|
| `apps/mock-core/tsconfig.json` | yes, adds `types: ["node"]`, include `src scripts test vitest.config.ts` | `tsconfig.json:2, 4, 6` |
| `packages/shared/tsconfig.json` | yes, adds `jsx: react-jsx`, `types: ["node"]` | `packages/shared/tsconfig.json:2-5` |
| `apps/core-web/tsconfig.app.json`, `tsconfig.node.json` | no, standalone, `moduleResolution: bundler` and `nodenext` | `apps/core-web/tsconfig.app.json:1-27`, `tsconfig.node.json:1-23` |
| `apps/mobile/tsconfig.json` | no, extends `expo/tsconfig.base` | `apps/mobile/tsconfig.json:2` |

Why it matters here: a backend under the base inherits `erasableSyntaxOnly` (no `enum`, no parameter properties, no namespaces), `verbatimModuleSyntax` (explicit `import type`), `noUncheckedIndexedAccess` and `moduleResolution: Bundler`. mock-core's `import pkg from '../package.json' with { type: 'json' }` (`app.ts:18`) works because of `resolveJsonModule`. mock-core's `build` script is a type-check only (`package.json:9`); no emitted JavaScript exists for any workspace.

## 7. `.gitignore` coverage and `.locks` conventions

### 7a. `.gitignore` (root, 65 lines; checks by `git check-ignore -v`)

| Path | Result | Rule |
|---|---|---|
| `release/probe` | ignored | `.gitignore:64 /release/` |
| `apps/mock-core/logs/errors.log` | ignored | `.gitignore:48 *.log` |
| `.locks/x` | ignored | `.gitignore:59 .locks/` |
| `.cache/x` | ignored | `.gitignore:47 .cache/` |
| `apps/core-server/.env` and `.env` | ignored | `.gitignore:40 .env` (`.env.*` at `:41`, `!.env.example` at `:42`) |
| `apps/mobile/signing/x` | ignored (path string only) | `.gitignore:65` |
| `.data/postgres` | **not ignored** (no output) | no rule |
| `node_modules/`, `dist/`, `build/`, `*.tsbuildinfo`, `coverage/` | ignored by rule | `.gitignore:12, 15, 16, 18, 45` |
| `*.apk`, `*.aab`, `*.keystore`, `*.jks`, `*.p12`, `*.pfx`, `*.key`, `*.docx` | ignored by rule | `.gitignore:29-32, 35-37, 9` |
| `/graft/` | ignored | `.gitignore:2` |

- `release/` is anchored with a leading slash on purpose: the comment at `.gitignore:61-63` says an unanchored `release/` would also hide `scripts/release/`.
- `apps/core-web/.gitignore` (253 bytes) adds `logs`, `*.log`, `dist`, `*.local` and editor files. `apps/mock-core` and `packages/shared` have no `.gitignore` of their own.
- Gap: no rule for a database data directory (`.data/`) or a PostgreSQL password file. `.env` and `.env.*` are covered.

### 7b. `.locks/` (quoted listing, `ls -la .locks`)

```
-rw-r--r--@  1 gsp-budi  staff  20945 Oct  1 16:45 dems_phone.emulator.log
-rw-r--r--@  1 gsp-budi  staff      0 Oct  1 10:42 dems_phone.lock
-rw-r--r--@  1 gsp-budi  staff      6 Oct  1 06:07 dems_phone.pid
-rw-r--r--@  1 gsp-budi  staff   8891 Oct  1 16:45 dems_phone2.emulator.log
-rw-r--r--@  1 gsp-budi  staff      0 Oct  1 11:26 dems_phone2.lock
-rw-r--r--@  1 gsp-budi  staff      6 Oct  1 10:04 dems_phone2.pid
-rw-r--r--@  1 gsp-budi  staff  14177 Oct  1 16:45 dems_tablet.emulator.log
-rw-r--r--@  1 gsp-budi  staff      0 Oct  1 10:51 dems_tablet.lock
-rw-r--r--@  1 gsp-budi  staff      6 Oct  1 06:04 dems_tablet.pid
-rw-r--r--@  1 gsp-budi  staff      0 Oct  1 11:34 gradle.lock
-rw-r--r--@  1 gsp-budi  staff      0 Oct  1 02:18 mock-core.lock
-rw-r--r--@  1 gsp-budi  staff  13357 Oct  1 09:51 mock-core.step53.log
drwxr-xr-x@  3 gsp-budi  staff     96 Oct  1 11:04 mock-core.users
-rw-r--r--@  1 gsp-budi  staff      0 Oct  1 02:18 npm.lock
-rw-r--r--@  1 gsp-budi  staff  10253 Oct  1 09:51 vite.5178.log
-rw-r--r--@  1 gsp-budi  staff      0 Oct  1 06:06 vite.lock
-rw-r--r--@  1 gsp-budi  staff      6 Oct  1 09:39 vite.pid
drwxr-xr-x@  3 gsp-budi  staff     96 Oct  1 11:04 vite.users
(+ .DS_Store; mock-core.users/user-manual-test and vite.users/user-manual-test, 0 bytes each, Oct 1 11:04)
```

Conventions (observed names; commands from the predecessor blueprint and this blueprint):

| Pattern | Meaning | Source |
|---|---|---|
| `<resource>.lock` (0 bytes) | `lockf` target: `/usr/bin/lockf -k -t <seconds> .locks/<resource>.lock <command>`; `flock` is absent (exit 75 when taken) | `02_structured.md:409, 412, 438, 467` (this task); predecessor `02_structured.md:110, 463, 467` |
| `<name>.pid` (6 bytes) | PID of a long-lived process (emulators, Vite) | `ls`; `cat` of the four `.pid` files |
| `<resource>.users/step-<N>` | reference count for a shared service; the last user stops it | `02_structured.md:438, 454` |
| `<name>.<tag>.log`, `<name>.emulator.log` | captured output | `ls` |
| names planned by this task, none present yet | `.locks/postgres.pid` (P15, `:456`), `.locks/db-migrate.lock` (P16, `:462`), `.locks/core-server.lock` (P18, `:467`) | blueprint |

Observations:

- P18 says the holder of `core-server.lock` "records its PID" but names no PID file for the backend (`02_structured.md:467`). The convention would give `.locks/core-server.pid`; it is not stated.
- Stale reference-count markers: `mock-core.users/user-manual-test` and `vite.users/user-manual-test` exist (decision D122 of the predecessor registered them "so agents never stop it"), while the controller's probe found nothing listening on 4400, 5173 or 8081 (`decisions/decisions.md`, F2). Under the P5 rule ("stop it only when the last user leaves") a service started by an agent would never be stopped while the marker stays. Not touched (Red Line: no deletion). Liveness of the PIDs in the `.pid` files was not probed here (row 24).

## 8. Constants and paths a second backend on another port would touch

### 8a. Shared constants (all in `packages/shared/src/api/constants.ts`, a build input)

| Constant | Line | Value | Consumers (non-test) | Consumers (tests with the literal) |
|---|---|---|---|---|
| `MOCK_CORE_HOST` | 8 | `127.0.0.1` | `mock-core/src/index.ts:5, 51` | none |
| `MOCK_CORE_PORT` | 9 | `4400` | `mock-core/src/index.ts:5, 51` | none |
| `CORE_HTTP_ORIGIN` | 10 | `http://127.0.0.1:4400` | `shared/src/api/health.ts:2, 47`; `shared/src/api/openapi.ts:29`; `core-web/src/lib/core-endpoint.ts:20, 43, 65, 69-70`; `core-web/src/features/api-reference/api-document.ts:17, 118-121`; `mobile/src/features/login/login-model.ts:15, 79` | `core-web/src/test/sim-fetch.test.ts:7, 59, 143-144`; `core-web/src/lib/__tests__/core-endpoint.test.tsx:14, 69-74, 83-111, 171-197`; `shared/test/openapi.test.ts:14, 167`; `shared/test/sim-api.test.ts:16` |
| `API_BASE_PATH` | 13 | `/api/v1` | `shared/src/api/core-api.ts:49` (9 paths at `:436-613`); `core-web/src/features/api-reference/sim-fetch.ts:20, 31, 98` | none |
| `HEALTH_PATH` | 15 | `/api/v1/health` | `mock-core/src/app.ts:11, 77`; `shared/src/api/core-api.ts:49`; `health.ts:2, 47`; `sim-fetch.ts:20` | `standalone-launcher.test.ts:156` |
| `WS_PATH` | 17 | `/ws` | `mock-core/src/app.ts:15, 85`; `heartbeat.ts:15, 91`; `core-web/src/lib/core-endpoint.ts:24, 50` | `standalone-launcher.test.ts:157` |
| `CORE_WS_URL` | 18 | `ws://127.0.0.1:4400/ws` | `shared/src/realtime/heartbeat-context.tsx:2, 22`; `shared/src/api/openapi.ts:30`; `core-web/src/lib/core-endpoint.ts:21, 48`; `core-web/src/features/api-reference/api-document.ts:18, 119-121`; `mock-core/scripts/ws-probe.ts:12, 16` | `core-endpoint.test.tsx:15, 71-75`; `shared/test/openapi.test.ts:15, 189` |
| `HEARTBEAT_INTERVAL_MS` | 20 | `1000` | `mock-core/src/app.ts:12, 86`; `heartbeat.ts:12, 56, 83` | `standalone-launcher.test.ts:158` |
| `WEB_DEV_ORIGINS` | 27 | `http://127.0.0.1:5173`, `http://localhost:5173` | `mock-core/src/app.ts:14, 39`; `heartbeat.ts:14, 20`; `core-web/src/lib/core-endpoint.ts:23, 55` | `core-endpoint.test.tsx:19, 73-85` |
| `SELF_ORIGINS` | 29 | `http://127.0.0.1:4400`, `http://localhost:4400` | `mock-core/src/heartbeat.ts:13, 20` | none |
| `SERVICE_NAME` | 31 | `dems-mock-core` | `mock-core/src/app.ts:13, 79` | `standalone-launcher.test.ts:159` |
| `API_VERSION` | 32 | `v1` | `mock-core/src/app.ts:10, 81` | `standalone-launcher.test.ts:160` |

Literal copies of the same values outside the constants file: `packages/shared/src/api/health.ts:25, 31, 32` (`'dems-mock-core'`, `'/ws'`, `1000` as zod literals); `realtime-messages.ts:15, 31` (`intervalMs` 1000); `packages/shared/openapi/openapi.json:11, 38, 50` (4400); `packages/shared/src/api/core-api.ts:7, 427` (prose naming mock-core and 4400; the stale-description item KI-18).

### 8b. Port literals outside the shared constants (source lines; none refers to 4420)

| Port | Where | Meaning |
|---|---|---|
| 4400 | `apps/mobile/package.json:18`; `apps/mobile/scripts/device-session.sh:35, 238, 449, 453, 455, 457-459`; `README.md:19, 94, 106, 114` | `adb reverse` rules map only 4400 and 8081 today; no rule exists for any other backend port |
| 4400 | many comments and test literals under `apps/core-web/src` and `apps/mobile/src` (for example `core-web/src/test/scalar-config.test.ts:90`, `core-web/src/features/login/__tests__/login-page.test.tsx:333`, `mobile/src/features/login/login.test.tsx:177`, `mobile/src/features/login/login-model.test.ts:65-66`, `shared/test/heartbeat-client.test.ts:51`) | wording and expectations tied to mock-core's address |
| 4410-4419 | `dems-web-launcher.cjs:44-45, 695, 954`; `build-web-packages.ts:281, 462, 470, 744, 820, 856`; `standalone-launcher.test.ts:161, 344-359`; `core-endpoint.test.tsx:49-50, 80, 99-103`; `packaged-csp.test.ts:16-47`; `README.md:28`; `release/RUN-ON-ANOTHER-PC.md:5, 81, 117` | the packaged 0.1.0 launcher range |
| 4173 | `apps/core-web/vite.config.ts:19` | `vite preview`, `strictPort` |
| 5173 | `apps/core-web/vite.config.ts:18` (`host 127.0.0.1`, `strictPort: true`); `constants.ts:27` | dev server and the only allowed web origin |
| 5178 | not in tracked source; `.locks/vite.5178.log` exists; planned as the shared Vite lane (P14) | not in `WEB_DEV_ORIGINS` |
| 8081 | `apps/mobile/package.json:7-8, 18`; `device-session.sh` | Metro |
| 4420-4429 | no match in `apps`, `packages`, `scripts`, `package.json`, `README.md` (`grep -E '\b442[0-9]\b'`) | free in tracked source |

The launcher's last candidate is port 0 (`dems-web-launcher.cjs:954`, `listenOn` with `exclusive: true` at `:618`), which asks the OS for a free port. No code path in the launcher selects 4420 except an explicit `--port 4420` (`:946`). Which range the OS picks from was not checked.

### 8c. Behaviour and paths a second backend meets

| Item | Fact | Source |
|---|---|---|
| Workspace name and folder | any new folder under `apps/` becomes a workspace through the glob; `typecheck`, `lint`, `test` run it from the root | `package.json:9-12, 32-34` |
| Root test gate | the new workspace's `test` script would run in root `npm test` whether or not a database is running | `package.json:34` |
| Lockfile and root manifest | adding the workspace and its dependencies edits `package-lock.json`; new root scripts edit `package.json`; both are build inputs | section 4a, roots 15 and 16 |
| Shared exports | any new shared subpath is an edit of `packages/shared/package.json:6-21`, a build input; any new file under `packages/shared/src/` counts as `added` in `--verify-inputs` | `build-web-packages.ts:204-213` |
| CORS and socket origin lists | mock-core's lists come from shared constants; a second backend needs its own list for 5173, 5178, 5176-5177 and its own self origin; editing the shared constants edits a build input | F-E2 |
| Health body | `HealthResponseSchema` requires `service: 'dems-mock-core'`, `ws.path: '/ws'`, `heartbeatIntervalMs: 1000` | `health.ts:23-35` |
| Health fetch | `fetchHealth()` is hard-wired to `CORE_HTTP_ORIGIN`; core-web re-points it with a `fetchImpl` wrapper only in the packaged build | `health.ts:46-50`; `core-endpoint.ts:63-75` |
| Packaged build reach | the packaged page may fetch only its own origin and open `ws://127.0.0.1:<launcher port>` (`connect-src 'self' ws://127.0.0.1:<port> ws://localhost:<port>`); a call to `http://127.0.0.1:4420` is outside that policy | `packaged-csp.ts:60`; `dems-web-launcher.cjs:97` |
| Release APK reach | the release APK is Simulated-only and allows no cleartext traffic (decision in the predecessor spec); `app.json` has no cleartext string (`grep` found no match) | blueprint F-A19 (`02_structured.md:89`); `grep -nE 'cleartext' apps/mobile/app.json` (no output) |
| Error log | per-service path and `service` stamp are hard-coded to mock-core | F-E4 |
| Version string | `0.1.0` appears in 5 manifests (root, core-web, mobile, mock-core, shared), the launcher (`:33`) and the packager (`:47`) | `ls`/`cat` of manifests |
| Lock names | `core-server.lock`, `db-migrate.lock`, `postgres.pid` are planned and absent | section 7b |
| Data directory | `.data/` is not git-ignored yet | section 7a |
| Packager gate | runs core-web typecheck, lint and vitest, mock-core typecheck and the launcher test; it does not run any other workspace | `build-web-packages.ts:246-259` |
| Licence collection | `npm ls --omit=dev --all --json -w @dems/core-web` (web) and `gen-npm-licenses.mjs --workspace <name>` (mobile): a new backend workspace does not enter either tree unless core-web or mobile depends on it | `collect-web-licenses.ts:27, 116`; `gen-npm-licenses.mjs:36, 95` |

## 9. `scripts/release/` inventory

| File | Lines | Role | Writes | Source |
|---|---|---|---|---|
| `build-web-packages.ts` | 949 | builds the six web packages: preflight, gate, `vite build` with `VITE_DEMS_CORE_ORIGIN=same-origin`, manifest, Node binaries from nodejs.org verified against `SHASUMS256.txt`, SEA builds (macOS arm64, Windows x64, Linux x64), staging, archives, checksums, smoke, BUILD-INFO | `.cache/release/**` (`:50-54`); `release/web/*.zip, *.tar.gz, *.sha256, SHA256SUMS.txt, BUILD-INPUTS.txt, BUILD-INFO.txt` (`:543-549, 650-655, 904, 944`); `release/RUN-ON-ANOTHER-PC.md` when its text changes (`:864-870`) | file header `:1-22` |
| `collect-web-licenses.ts` | 248 | builds `licenses/` content from `npm ls ... -w @dems/core-web` and the three font packages | the output folder it is given (`.cache/release/licenses`) | `:1-19, 27, 116` |
| `gen-npm-licenses.mjs` | 192 | same idea for one named workspace; used for the APK's `THIRD-PARTY-LICENSES.txt` | the `--out` file | `:1-12, 36, 95` |

Options of the packager (`:6-11`): `--skip-gate`, `--skip-web-build`, `--skip-smoke`, `--gate-only`, `--verify-inputs`. Only `--verify-inputs` is read-only. Hard rules from its header: Node built-ins plus system `tar`, `unzip`, `zip`, `ditto`, `codesign`, `git`; "No npm install, no package.json edit (P1)" (`:13`).

Cross-workspace imports found in the whole tree (`grep` of relative imports between `core-web`, `mobile`, `mock-core`, `shared`): exactly two, both into `apps/core-web/src/lib/packaged-csp.ts`: `build-web-packages.ts:43` and `apps/mock-core/test/standalone-launcher.test.ts:24`.

## 10. Provisional blueprint rows against the build-input roots (F-E19)

From the Single-writer scan (`02_structured.md:526-540`), the row text and P17/P21:

| Build-input root (section 4a) | Provisional rows that write it | Lines |
|---|---|---|
| 1 `apps/core-web/src/**` | 66-74, 99, and the other web rows | `02_structured.md:339-347, 372` |
| 5 `apps/core-web/package.json` | 57 | `:330` |
| 6 `packages/shared/src/**` | 26, 27, 98; planned new folders `client/`, `live/` and additions to `realtime/` | `:299, 300, 371, 464`; layout `:206-211` |
| 9 `packages/shared/openapi/openapi.json` | 27, 98 (regenerated) | `:300, 371` |
| 10 `packages/shared/package.json` | 57 (export subpaths) | `:330` |
| 14 `THIRD_PARTY_NOTICES.md` | 100 | `:373` |
| 15 root `package.json` | 23 (npm route), 25, 57, 77 | `:298, 528` |
| 16 `package-lock.json` | 23 (npm route), 25, 57, 77 | `:528` |

Roots 2, 3, 4, 7, 8, 11, 12, 13 are not written by any row read. Roots 7, 11, 12, 13 are protected by P13 (`:453`), P5 and P21 (`:438, 476`). The row text of the remaining provisional rows (29-65, 75-97) was not read in full, so the list of web and shared writers may be longer. Row 109 (`:382`) verifies the 0.1.0 packages by checking that files under `release/` match their checksum files and by a `git diff acaff20` over `apps/mock-core`, `scripts/release` and the simulator; it does not call `--verify-inputs`.

The requirement text: "The offline simulated demo and the released 0.1.0 packages still work, or any change to them is a recorded decision" (`identification/01_translated.md:82`); `release/` is "Not to be overwritten or deleted" (`:97`).

## 11. Decisions needed, drift and gaps

### Decisions needed (for the controller to record; none is made here)

- **DN-1 (F-E12, F-E19)**: how to read "the 0.1.0 packages' sources must keep working unchanged". Facts: the six web archives, the APK and their checksum files are artifacts that no source edit changes; `--verify-inputs` compares sources and will exit 1 after the first write to any of 8 roots; the web console's Live wiring lives in `apps/core-web/src` (root 1) by blueprint design; the root manifest and lockfile change with the first workspace install. Reading A: the artifacts and `release/` stay byte-identical (SC8 as row 109 states it) and `--verify-inputs` is expected to report DIFFERENT from the first provisional write on, recorded once as a decision. Reading B: roots 1 to 16 stay frozen, which the blueprint's web rows (66-74) cannot satisfy because they write inside root 1. This row cannot choose.
- **DN-2 (F-E21)**: `THIRD_PARTY_NOTICES.md:3` says "npm dependencies carry their own licence files inside `node_modules` and are not listed here". Row 100 (`:373`) plans to add every new dependency to it, which changes a build input and contradicts the file's own scope. The npm tree is covered by the generated `THIRD-PARTY-LICENSES.txt`, not by this file.
- **DN-3 (F-E20)**: `HealthResponseSchema` fixes `service` to the literal `'dems-mock-core'`, so a backend whose health answer must pass the shared schema reports the same service name as mock-core, and a client cannot tell them apart by the body. Changing the schema is an edit in root 6.
- **DN-4 (F-E17)**: the stale `user-manual-test` markers under `.locks/mock-core.users/` and `.locks/vite.users/`. Leaving them keeps a started mock-core or Vite from ever being stopped by the last-user rule. Removing them is a deletion the user did not ask for.
- **DN-5 (F-E2)**: where the new origin lists (5173, 5178, 5176-5177 and the backend's self origin) live. Facts: `WEB_DEV_ORIGINS` is in root 6 and lacks 5178.
- **DN-6 (F-E14)**: root `typecheck`, `lint` and `test` pick up every `apps/*` workspace, and root `build` and `theme:gen` rewrite `packages/shared/theme/*` (root 8) with the generator's output (`gen-theme.ts:323-325`). Whether the new workspace's `test` script may need a running database in the root gate, and whether a gate row may run `npm run build`, are open. Hypothesis, not tested: the generator rewrites byte-identical content when nothing changed.

### Drift against the blueprint's facts

None found. Facts F-A10, F-A11, F-A12, F-A17 and F-A18 of `02_structured.md:80-88` were re-checked against the files and agree (CORS at `app.ts:38-44`, launcher at `:7-10, 17-21, 37-45`, root globs at `package.json:9-12`, scripts at `:32-34`, `.gitignore` lines 40-42, 47, 59, 64). The line spans quoted for `constants.ts` in F-A10 (`4-5, 8-18, 27`) cover the comment at lines 3-6 and the constants at 8-18 and 27; the exact lines are in section 8a.

### Gaps and not examined

- Whether anything listens on 4400, 4410-4419, 4420-4423 or 5178 now: not probed (P7). The controller's probe at task start reports nothing on 4400, 5173, 8081 (`decisions.md` F2). Row 24 owns the port check.
- PIDs in `.locks/*.pid`: liveness not probed.
- The APK's generated manifest (`apps/mobile/android/`, git-ignored) and any cleartext flag in it: not read (row 4 owns it). `app.json` has no cleartext string.
- Rows 29-65 and 75-97 of the provisional blueprint were not read in full.
- The effect of a root-manifest or lockfile change on the packager's `npm ls` tree: not run.
- Whether `tsconfig.base.json` influences the Vite bundle of `packages/shared/src`: hypothesis only.

## 12. Verification log (read-only commands run in this row)

| Command (summary) | Result |
|---|---|
| `ls`, `ls -la`, `ls -laR release` on the inventoried folders | listings quoted in sections 1, 5, 7 |
| `wc -l` on mock-core and `scripts/release` files | line counts in section 1 |
| `grep -rnE` for the 11 shared constants, for `\b4400\b`, `\b441[0-9]\b`, `\b442[0-9]\b`, for cross-workspace imports | tables in sections 3, 8, 9 |
| `cat -n package.json tsconfig.base.json .npmrc .node-version .gitignore` | quotes in sections 6 and 7 |
| `git check-ignore -v` on 7 path strings; `git ls-files apps/mock-core scripts release` | section 7a; section 1 |
| `shasum -a 256 -c release/web/BUILD-INPUTS.txt`, then a `find` of the 16 roots against the list | `OK=748 FAILED=0`; 748 in tree, 748 in list, 0 added, 0 removed |
| `shasum -a 256` of the 6 web archives, the APK and 7 licence files, compared to `SHA256SUMS.txt` in `release/web` and `release/android` and to the per-file `.sha256` files | all match |
| `graft map`, `graft skeleton apps/mock-core/src/app.ts`, `graft callers buildApp` | orientation and the four `buildApp` callers |
| `date` | 2026-10-04 01:34 local |

Not run, by instruction: `build-web-packages.ts` (any option), any npm command, any test, any server.

---
*Generated: 2026-10-04 01:40*
*Last Updated: 2026-10-04 01:40*
