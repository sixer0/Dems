---
task_id: 2026-10-04_dems_backend_rbac_pairing
step: 12
date: 2026-10-04
agent: data-collector
tier: 2
items_collected: 95 findings (host baseline 14, Vitest 5 and runner mechanics 12, in-process injection 6, database isolation 23, WebSocket 8, coverage 9, end-to-end 23), 35 rows in the tool register, 12 searches, 80 fetch attempts, 42 npm metadata lookups
last_updated: 2026-10-04
status: complete
---

# Test Tooling Evidence for a PostgreSQL-backed Fastify API (Row 12, Tier 2)

## Task Overview

Blueprint row 12 (FIRM, `identification/02_structured.md` row 12): collect evidence on test tooling for a PostgreSQL-backed Fastify API with Vitest 5, using generic queries only. Scope: in-process injection; database isolation per test or per worker (template databases, schemas, transactions); WebSocket testing; coverage; end-to-end options for a web console plus an Android emulator pair, including the Maestro CLI already on the host.

This file collects. It contains no analysis and no recommendation. Where a source recommends something, the text says "the source states". The choice belongs to row 14 (TD-12 test tooling).

Constraints applied (from the row and the project rules):
- Ready-made frameworks and libraries only.
- No Docker, no account, no hosted service. Options that need one are listed in section 9 as excluded, with the reason.
- Read-only on the host. No installs, no test runs, no emulator or `adb`. `npm view` metadata lookups only.
- Every web query is generic. The query log (section 11) lists every query string and every fetched URL.

### How facts were verified and how to read the confidence labels

| Label | Meaning |
|---|---|
| H | Primary source: project or vendor documentation, the PostgreSQL manual or release notes, the npm registry (`npm view`), a file in this repository, or a file on the host |
| M | Secondary source read in full by `WebFetch`: an engineering blog post, a mailing-list message, a README of a third-party library |
| L | Rests only on a web-search summary, or on a fetch whose extraction was partial. Treat as a hypothesis |

`WebFetch` returns an extraction written by a small model, not the raw page. Quotation marks in this file reproduce what that extraction returned. Fetch date for every URL is 2026-10-04 (today). Where a page returned HTTP 403 or 404, the attempt is in the log and no fact is taken from it.

---

## 1. Host Baseline: Installed Test Tools (quoted with file:line)

All lines read from the working tree on 2026-10-04. Verified by `grep -n` on the files named, and by reading `node_modules/<pkg>/package.json` for installed values.

| ID | Found | Why it matters | Verified by | Source |
|---|---|---|---|---|
| H-01 | `packages/shared` pins `vitest` at `5.0.3`; its `test` script is `vitest run` | Shared contract tests already run under Vitest 5 | grep of package.json | `packages/shared/package.json:42` (devDependency), `:27` (script) |
| H-02 | `apps/core-web` pins `vitest` `5.0.3`, `jsdom` `30.1.1`, `@testing-library/dom` `10.4.2`, `@testing-library/jest-dom` `7.0.1`, `@testing-library/react` `16.3.3`; script `vitest run` | Web console component tests use jsdom, not a real browser | grep | `apps/core-web/package.json:56`, `:51`, `:44`, `:45`, `:46`, `:11` |
| H-03 | `apps/mock-core` pins `vitest` `5.0.3`, `ws` `8.22.0`, `@types/ws` `8.18.2`, `fastify` `5.12.5`, `@fastify/websocket` `11.3.1`, `@fastify/cors` `11.3.0`; script `vitest run` | The existing Fastify service already combines Fastify 5, the WebSocket plugin and the `ws` client under Vitest | grep | `apps/mock-core/package.json:27`, `:28`, `:24`, `:19`, `:18`, `:17`, `:12` |
| H-04 | `apps/mobile` pins `jest` `29.7.0`, `jest-expo` `~57.0.5`, `@testing-library/react-native` `13.3.3`, `react-test-renderer` `19.2.3`; script `jest`; app stack `react-native` `0.86.3`, `expo` `~57.0.26`, `react` `19.2.3` | The Expo app is the only workspace on Jest; Vitest 5 and Jest 29 coexist in the repo | grep | `apps/mobile/package.json:81`, `:82`, `:76`, `:83`, `:12`, `:58`, `:32`, `:54` |
| H-05 | Installed (resolved) versions: `vitest` 5.0.3 (MIT), `jest` 29.7.0 (MIT), `jest-expo` 57.0.5 (MIT); `light-my-request` 6.6.0; `@fastify/websocket` 11.3.1 | Pinned and installed values agree | `node -e` reading `node_modules/<pkg>/package.json` | `node_modules/vitest/package.json`, `node_modules/jest/package.json`, `node_modules/jest-expo/package.json`, `node_modules/light-my-request/package.json`, `node_modules/@fastify/websocket/package.json` |
| H-06 | Installed `vitest` declares `"engines": { "node": "^22.12.0 \|\| ^24.0.0 \|\| >=26.0.0" }`; host Node is v26.8.2 (stated in the task brief) | Node 26 is inside the declared range | read of package.json | `node_modules/vitest/package.json:114-116` |
| H-07 | `@vitest/coverage-v8` and `@vitest/coverage-istanbul` are not present in root `node_modules`; no `coverage` key appears in any workspace `package.json` or in `vitest.config.ts` / `vite.config.ts` | Coverage is not configured today in any workspace | `node -e require(...)` returned "not installed"; `grep -n coverage` over package.json and config files returned no matches | repo-wide grep, 2026-10-04 |
| H-08 | Existing `inject()` usage: `app.inject({ method: 'GET', url: '/api/v1/health', headers: {...} })` in the health test; `app.inject` also at `:30`, `:40` | In-process injection is already the repo's pattern for HTTP routes | read of file | `apps/mock-core/test/health.test.ts:16`, `:30`, `:40` (spec header comment `:1`) |
| H-09 | Existing WebSocket test pattern: `buildApp({ logger: false })`, `await app.listen({ host: '127.0.0.1', port: 0 })`, read `app.server.address()` port, connect with `new WebSocket('ws://127.0.0.1:${port}/ws', ...)` from `ws`, `afterAll(() => app.close())` | Real-socket WebSocket testing on an ephemeral loopback port is the repo's pattern | read of file | `apps/mock-core/test/ws-origin.test.ts:4-20`; same pattern `apps/mock-core/test/heartbeat.test.ts:4`, `:11` |
| H-10 | Vitest configs: `environment: 'node'`, `include: ['test/**/*.test.ts']` for shared and mock-core; `environment: 'jsdom'`, `setupFiles: ['./src/test/setup.ts']`, `include: ['src/**/*.test.{ts,tsx}']` for core-web; Jest config uses `preset: 'jest-expo'` and `setupFilesAfterEnv: ['./jest.setup.ts']` | A new backend workspace has no config yet; the three existing configs are per workspace | read of files | `packages/shared/vitest.config.ts:4-6`, `apps/mock-core/vitest.config.ts:4-6`, `apps/core-web/vite.config.ts:26-30`, `apps/mobile/jest.config.js:7-8` |
| H-11 | Root `package.json` workspace globs are `packages/*` and `apps/*`; root `test` script is `npm run test --workspaces --if-present` | Any new `apps/<name>` workspace is picked up by the root test script | read of file | `package.json:9-11`, `:34` |
| H-12 | Maestro CLI 2.11.0 is on the host: `~/.maestro/lib/maestro-cli-2.11.0.jar`; `~/.maestro/lib/maestro-web.jar` also exists; `~/.maestro/analytics.json` shows `"enabled" : false` and `"cachedToken" : null` | CLI version confirmed from the jar file name; a web module ships in the install; analytics are off and no cloud token is cached on this host | `ls ~/.maestro/lib`; read of `analytics.json` (uuid omitted here) | `~/.maestro/lib/` listing; `~/.maestro/analytics.json:3-4` |
| H-13 | The mobile `e2e` script is `MAESTRO_CLI_NO_ANALYTICS=true MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED=true "$HOME/.maestro/bin/maestro" ${ANDROID_SERIAL:+--device $ANDROID_SERIAL} test e2e/maestro`; the directory `apps/mobile/e2e` does not exist | The script is wired; no flows are authored (matches the task brief) | read of package.json; `ls apps/mobile/e2e` returned "No such file or directory" | `apps/mobile/package.json:13` |
| H-14 | The host's Playwright browser cache holds `chromium-1234`, `chromium-1243`, `chromium_headless_shell-1234`, `chromium_headless_shell-1243`, `ffmpeg-1011`; the `playwright` and `@playwright/test` npm packages are not in the workspace `node_modules` | Browser binaries exist on the host from outside this workspace; which revision Playwright 1.63.0 expects is not confirmed | `ls ~/Library/Caches/ms-playwright`; `ls node_modules/@playwright` returned "No such file or directory" | `~/Library/Caches/ms-playwright/` listing |

---

## 2. Vitest 5 and Test-Runner Mechanics

| ID | Found | Why it matters | Verified by | Source (fetched 2026-10-04) | Conf |
|---|---|---|---|---|---|
| V-01 | npm registry: `vitest` 5.0.3, MIT, modified 2026-09-30T11:30:42Z; peers `vite ^6.4.0 \|\| ^7.0.0 \|\| ^8.0.0`, `@types/node ^22.0.0 \|\| >=24.0.0`, optional peers `@vitest/coverage-v8` 5.0.3, `@vitest/coverage-istanbul` 5.0.3, `@vitest/browser-playwright` 5.0.3, `@vitest/browser-preview` 5.0.3, `@vitest/ui` 5.0.3, `jsdom`, `happy-dom` | Coverage and browser providers are separate packages pinned to the same version as the runner | `npm view vitest version license time.modified peerDependencies` | https://registry.npmjs.org/vitest (via npm view) | H |
| V-02 | Vitest 5 migration page: "Vitest 5.0 requires Vite >= 6.4.0 and Node.js >= 22.12.0." Also: `clearMocks` now defaults to true; `extends` defaults to true for inline projects; the top-level `bench` function is removed; `test.sequential`/`describe.sequential` are removed; "Worker and pool identifiers now start at 1 instead of 0," affecting `VITEST_POOL_ID` and `VITEST_WORKER_ID`; the entry points `vitest/coverage`, `vitest/reporters`, `vitest/environments`, `vitest/snapshot`, `vitest/runners`, `vitest/suite` no longer work; a single `.vitest` directory at the project root is the shared artifact root | Per-worker resource naming must use 1-based IDs; mock call history resets between tests | `WebFetch` of the page | https://vitest.dev/guide/migration | H |
| V-03 | Default pool is `forks` (child processes). `threads` uses worker threads: "Native libraries like Prisma and bcrypt may fail with segfaults" and `process.chdir()` is unavailable. `vmThreads`/`vmForks` run in a sandboxed VM context; "Vitest team cannot fix any of the issues on our side" | Native addons chosen in row 10 (hashing) or row 7 (drivers) interact with the pool choice | `WebFetch` | https://vitest.dev/config/pool | H |
| V-04 | "By default, Vitest runs test files in parallel across multiple workers"; within a file, tests run sequentially; `fileParallelism: false` or `--no-file-parallelism` runs files one at a time; `maxWorkers` caps workers; `.concurrent` tests share the worker of their file ("Vitest doesn't create extra workers for concurrent tests") | Files are the parallel unit, so a database strategy keyed per file or per worker maps to Vitest's model | `WebFetch` | https://vitest.dev/guide/parallelism, https://vitest.dev/guide/improving-performance | H |
| V-05 | `process.env.VITEST_POOL_ID` ("integer-like string") is documented in the `setupFiles` page as the way "to distinguish between workers and spread the workload." The installed code sets it per worker: `process.env.VITEST_POOL_ID = String(message.poolId)` and `process.env.VITEST_WORKER_ID = String(message.workerId)`, with the comment "Exposed to test runner as `VITEST_POOL_ID`. Value is between 1-`maxWorkers`." A web-search summary adds that `VITEST_WORKER_ID` "is not affected by maxThreads and will increase with each created worker" (L) | A stable per-worker key (for a database or schema name) exists in Vitest 5 and is 1-based | `WebFetch` of docs; `grep -n` and `sed -n` over installed Vitest chunks | https://vitest.dev/config/setupfiles ; `node_modules/vitest/dist/chunks/init.D0qF-GGk.js:265-266`, `node_modules/vitest/dist/chunks/index.DpLw24bj.js:10765` ; search S4 for the L part | H (docs, code), L (WORKER_ID semantics) |
| V-06 | `setupFiles`: "They will run before each _test file_ in the same process." `globalSetup`: runs "before the test workers are created and only if there is at least one test queued," teardown "after all test files have finished running"; tests cannot read globalSetup variables, but can receive "serializable data to tests via `provide` method and read them in your tests via `inject` imported from `vitest`"; in watch mode teardown runs before process exit | Once-per-run work (build a template database) belongs in globalSetup; per-file work (clone it) belongs in setup files or hooks | `WebFetch` | https://vitest.dev/config/setupfiles, https://vitest.dev/config/globalsetup | H |
| V-07 | `test.extend` fixtures: scopes `test` (default), `file`, `worker` ("initialized once per worker process"), added in 3.2.0; builder pattern with automatic type inference added in 4.1.0 with `onCleanup`; object syntax uses `use()` with cleanup after it | A worker-scoped fixture can hold one database or schema per worker and release it at scope end | `WebFetch` | https://vitest.dev/guide/test-context | H |
| V-08 | `test.projects` in a root config defines multiple projects by glob; per-project `environment` (node, jsdom, happy-dom); "All projects must have unique names"; "coverage is done for the whole process," so results aggregate across projects | The repo has per-workspace configs and no root Vitest config today (H-10); a root `projects` file is the documented aggregation path | `WebFetch` | https://vitest.dev/guide/projects | H |
| V-09 | Isolation: "By default Vitest runs every test file in an isolated environment based on the pool"; `--no-isolate` / `test.isolate: false` disables it and then tests "must not depend on a clean `window` or module state"; docs do not address database-backed tests; `pool: 'forks'` "may be slightly slower than `pool: 'threads'` in larger projects"; `--shard` splits "test files, not your test cases" | Shard and isolation settings change which tests share a database | `WebFetch` | https://vitest.dev/guide/improving-performance | H |
| V-10 | Vitest browser mode runs tests "in the browser natively"; providers `preview`, `playwright`, `webdriverio`; "Vitest always requires a provider to be defined"; "to run tests in CI you need to install either `playwright` or `webdriverio`." Registry: `@vitest/browser` 5.0.3 MIT; `@vitest/browser-playwright` 5.0.3 MIT (peers `vitest 5.0.3`, `playwright *`); `@vitest/browser-webdriverio` 5.0.0 MIT (peers `vitest ^5.0.0`, `webdriverio *`); `@vitest/browser-preview` 5.0.3 MIT | An alternative to jsdom for the web console component tests; needs a browser provider and binaries | `WebFetch` and `npm view` | https://vitest.dev/guide/browser/ ; npm registry | H |
| V-11 | Fastify's own testing guide: "At the end of your tests it is highly recommended to call `.close()` to ensure that all connections to external services get closed"; it recommends the Node Test Runner in its examples | Pools and plugins need a close hook in any runner | `WebFetch` | https://fastify.dev/docs/latest/Guides/Testing/ | H |
| V-12 | Existing repo practice for teardown: `afterAll(() => app.close())` | Same practice, in repo | read of file | `apps/mock-core/test/ws-origin.test.ts:15`, `apps/mock-core/test/health.test.ts:13` | H |

---

## 3. In-Process Injection

| ID | Found | Why it matters | Verified by | Source (fetched 2026-10-04) | Conf |
|---|---|---|---|---|---|
| I-01 | Fastify has "built-in support for fake HTTP injection thanks to `light-my-request`"; `.inject()` "ensures all registered plugins have booted up and our application is ready to test"; parameters: method, url, query, payload, headers, cookies; callback, chained (`.end()`), and async/await forms | Route tests need no listening socket and no port | `WebFetch` | https://fastify.dev/docs/latest/Guides/Testing/ | H |
| I-02 | Fastify guide advises separating app construction from listening: a builder function returns the instance without calling `listen()`; the server file calls it and listens | Matches the repo's `buildApp()` in `apps/mock-core/src/app.ts:32` | `WebFetch`; `grep -n "export function buildApp"` | https://fastify.dev/docs/latest/Guides/Testing/ ; `apps/mock-core/src/app.ts:32` | H |
| I-03 | Server reference: `fastify.inject(options)` "functions without the server actively listening"; `fastify.ready()` returns a Promise when called with no arguments and runs "when all the plugins have been loaded" | Plugin boot (including a database plugin) completes before the first injected request | `WebFetch` | https://fastify.dev/docs/latest/Reference/Server/#inject | M (extraction is partial) |
| I-04 | `light-my-request` 6.6.0, BSD-3-Clause, modified 2026-08-02: "Injects a fake HTTP request/response into a node HTTP server"; options `url`/`path`, `method` (default GET), `headers`, `cookies`, `query`, `payload`/`body`, `remoteAddress` (default 127.0.0.1), `server`; "Note how `server.listen` is never called." Installed version matches (H-05) | Injected requests carry `remoteAddress` 127.0.0.1 by default, relevant to rate limiting and loopback checks | `npm view`; `WebFetch` of README | https://registry.npmjs.org/light-my-request ; https://github.com/fastify/light-my-request | H |
| I-05 | `supertest` 7.3.1, MIT, modified 2026-10-02: "If the server is not already listening for connections then it is bound to an ephemeral port for you"; uses real HTTP through superagent. Whether Fastify documents it as a path is not confirmed | A real-HTTP alternative to injection; adds a dependency | `npm view`; `WebFetch` | https://registry.npmjs.org/supertest ; https://github.com/forwardemail/supertest | H (version, licence), M (README) |
| I-06 | Node `fetch` and `WebSocket` are globals: `fetch` "No longer experimental" since v21.0.0, "based upon undici"; `WebSocket` added v21.0.0 / v20.10.0, "No longer experimental" as of v22.4.0. Registry: `undici` 8.11.2, MIT | A real-socket HTTP client needs no extra package on Node 26 | `WebFetch`; `npm view undici` | https://nodejs.org/docs/latest/api/globals.html ; https://registry.npmjs.org/undici | H |

---

## 4. Database Isolation per Test or per Worker

Scope note: the strategies below are generic PostgreSQL test-isolation techniques. How the server is provisioned is row 6; the data-access layer is row 7. Container-based helpers are excluded (section 9).

### 4.1 PostgreSQL facts the strategies rest on

| ID | Found | Why it matters | Verified by | Source (fetched 2026-10-04) | Conf |
|---|---|---|---|---|---|
| D-01 | "`CREATE DATABASE` actually works by copying an existing database. By default, it copies the standard system database named `template1`." "The principal limitation is that no other sessions can be connected to the source database while it is being copied. `CREATE DATABASE` will fail if any other connection exists when it starts; during the copy operation, new connections to the source database are prevented." Database-level `GRANT`s are not copied. With `datistemplate` set, "the database can be cloned by any user with `CREATEDB` privileges." The page states no cost or duration | Cloning a template needs the template to be idle; concurrent clones of one template collide | `WebFetch` | https://www.postgresql.org/docs/current/manage-ag-templatedbs.html | H |
| D-02 | `STRATEGY` parameter: `WAL_LOG` (default) copies "block by block and each block will be separately written to the write-ahead log. This is the most efficient strategy in cases where the template database is small." `FILE_COPY` writes a small WAL record per tablespace, "does reduce the write-ahead log volume substantially, especially if the template database is large, it also forces the system to perform a checkpoint both before and after the creation of the new database. In some situations, this may have a noticeable negative impact on overall system performance." Same page: "no other sessions can be connected to the template database while it is being copied" | The copy method sets the cost of a clone; template size matters | `WebFetch` | https://www.postgresql.org/docs/current/sql-createdatabase.html | H |
| D-03 | PostgreSQL 15 release notes (release date 2022-10-13): "Add new WAL-logged method for database creation ... This is the new default method for copying the template database, as it avoids the need for checkpoints during database creation. However, it might be slow if the template database is large, so the old method is still available." | Version in which `WAL_LOG` became the default is stated by the project | `WebFetch` | https://www.postgresql.org/docs/current/release-15.html | H |
| D-04 | `file_copy_method` server setting: values `COPY` (default) and `CLONE` "(if operating support is available)"; `CLONE` "uses the `copy_file_range()` (Linux, FreeBSD) or `copyfile` (macOS) system calls, giving the kernel the opportunity to share disk blocks"; affects `CREATE DATABASE ... STRATEGY=FILE_COPY` and `ALTER DATABASE ... SET TABLESPACE`. PostgreSQL 18 release notes list its addition; PostgreSQL 18 release date 2025-09-25 | A documented way to make the `FILE_COPY` strategy cheaper on macOS; the speed gain is not quantified by the page | `WebFetch` of two pages | https://www.postgresql.org/docs/current/runtime-config-resource.html ; https://www.postgresql.org/docs/current/release-18.html | H |
| D-05 | Schemas: "A database contains one or more named schemas, which in turn contain tables." Default `search_path` is `"$user", public`; `SET search_path TO myschema,public;`; `DROP SCHEMA myschema CASCADE;`. "A client connection to the server can only access data in a single database" but "schemas are not rigidly separated: a user can access objects in any of the schemas in the database they are connected to, if they have privileges to do so" | A schema is a naming boundary, a database is a connection boundary | `WebFetch` | https://www.postgresql.org/docs/current/ddl-schemas.html | H |
| D-06 | `SAVEPOINT` "establishes a new savepoint within the current transaction"; `ROLLBACK TO` restores the state at the savepoint; multiple savepoints per transaction are allowed; "Savepoints can only be established when inside a transaction block." | Savepoints are the mechanism behind nested-transaction test wrappers | `WebFetch` | https://www.postgresql.org/docs/current/sql-savepoint.html | H |

### 4.2 Strategies with the cost stated by sources

Cost per test run is quoted as each source states it. Figures come from different machines, template sizes and years; they are not comparable with each other. "Not confirmed" means no fetched source gives a figure.

| ID | Strategy | Cost as stated by the source | Context stated by the source | Source (fetched 2026-10-04) | Conf |
|---|---|---|---|---|---|
| ISO-01 | Database per test, cloned from a template (`CREATE DATABASE ... TEMPLATE ...`) | "creating a new database from this template takes `~40ms` per test" | Template "roughly `~14MB`"; Go test suite (per the article's URL title); tests run directly against PostgreSQL; clone fails if the template has active connections; fix: set `datistemplate='true'` and `datallowconn='false'` | https://www.nirvanatech.com/blog/how-we-made-postgresql-work-in-unit-tests | M |
| ISO-02 | Database per test, cloned from a template, chained | "Test setup is quick: about 30ms." | Describes `CREATE DATABASE test_0 TEMPLATE test;` then `CREATE DATABASE test_1 TEMPLATE test_0;`; template size and PostgreSQL version not stated; publication date not confirmed | https://eradman.com/posts/database-test-isolation.html | M |
| ISO-03 | Database per test, cloned from a template | "around 400 milliseconds every time we drop & create the DB"; "over 4000 integration tests"; "We would roughly spend around 1600 seconds = 26 minutes just for the DB setup" | Their proposed alternative (track and clean only accessed tables with triggers) "cut down our CI runtime by around 30%." Fetched from the mirror host `seo-blog.carbonhealth.com`; the primary host returned HTTP 403 | https://seo-blog.carbonhealth.com/blog-post/cleaning-postgresql-db-between-integration-tests-efficiently | M |
| ISO-04 | Database per test, cloned from a template, with seed data | "a couple hundred milliseconds" for a schema-plus-seed database; "Fifteen thousand full-stack database tests in twenty minutes on a single machine" | Template locked with `ALTER DATABASE ... is_template=true`; a sync command unlocks, applies pending migrations, re-locks inside a `finally`; database names derived by hashing the test file path; the drop routine refuses any name without the prefix `deel_test_db_` | https://www.deel.com/blog/database-integrations-tests/ | M |
| ISO-05 | Database per test, cloned from a template | Not a figure: "the copy isn't literally free (it scales with the size of the template), but a file copy beats a full schema build every time"; schema setup "takes a few seconds" | "the template must have zero other connections at the moment you clone it. If anything is still attached, Postgres refuses"; "two workers can't clone the same template at once. Give each worker its own template...or chain the clones." | https://mergify.com/blog/postgres-database-per-test-sqlalchemy | M |
| ISO-06 | Database per test (high connection count) | "around a ~30% (!!) total CPU overhead in native_queued_spin_lock_slowpath (as profiled with linux perf), presumably because of the high connection count" | Original poster, pgsql-general, 2024-02-26: unit and end-to-end tests with "around 500-1000 database schemas"; reply from Pavel Stehule suggests "use templates - CREATE DATABASE test TEMPLATE some;" and "disable fsync (only for testing!!!)" | https://www.postgresql.org/message-id/CAF5w5042yWdX%3DCAVkbmkbWzN_WWtCZRLyUdRCwwvWgPh6udwgA%40mail.gmail.com ; mirror https://www.postgrespro.com/list/thread-id/2685280 | M |
| ISO-07 | Schema per test or per worker (`CREATE SCHEMA`, `search_path`, `DROP SCHEMA ... CASCADE`) | "around 1000ms per schema insertion means we're wasting 500 cpu-seconds, and there seems to be quite some lock contention too"; "native_queued_spin_lock_slowpath overhead to around 10%" versus about 30% for database per test, "but total test time is still slower due to all schema initialization being done" | Same thread as ISO-06: "~500 table/index definitions across 500 test schema's" | same URL as ISO-06 | M |
| ISO-08 | Schema per test | Not confirmed. The article states no timing | Technique: `CREATE SCHEMA foo`, connection with search path scoped to it, run tests, `DROP SCHEMA foo CASCADE`; "avoids race conditions, makes clean up easy, and requires only a single logical database"; limitation: "only works if you aren't using schemas for other purposes in your application" | https://conroy.org/per-test-database-isolation-in-postgres | M |
| ISO-09 | Schema per Jest worker | Not confirmed. The article states no timing | Schemas named `test_worker_1` ... `test_worker_n` selected through `process.env.JEST_WORKER_ID` in a setup file and passed by `DATABASE_URL`; Prisma as the data layer; the authors disable it in CI with `is-ci` ("Most CI/CD machines are relatively weak, so the recommended approach there is to run tests sequentially"); the article's PostgreSQL ran in Docker (the technique itself does not need it) | https://dev.to/cseby92/how-to-run-jest-integration-tests-in-parallel-using-isolated-sql-schemas-1bm7 | M |
| ISO-10 | Transaction rollback per test (`BEGIN` before, `ROLLBACK` after) | Suite totals, not per test: for "~700 tests", truncation "PostgreSQL: 76s" versus transaction "PostgreSQL: 18s" (SQLite 34 s versus 17 s), "4x speed increase for PostgreSQL". Per-test figure: not confirmed | Mailing-list message by Dmytrii Nagirniak, 2012-03-16, Rails-era stack; same message: "Best perf optimisation - `fsync=off`" (about 20 percent, as extracted) | https://www.postgresql.org/message-id/64B8E470-0719-40F3-81BB-0BF609F2B85E%40gmail.com | M (old, different stack) |
| ISO-11 | Transaction rollback per test | Not confirmed for PostgreSQL. A MySQL measurement exists: RSpec "Transaction: 10.20, 10.11", "Truncation: 26.82, 26.46", "Deletion: 12.08, 12.12" (units not shown in the extraction); the page states "The performance measurements in this card needs to be retaken for PostgreSQL" | MySQL, average Rails project | https://makandracards.com/makandra/620324-text-column-sizes-mysql/previous?read=true | M (not PostgreSQL) |
| ISO-12 | Truncate or delete between tests | Suite total: ~700 tests, truncation 76 s on PostgreSQL (see ISO-10). Cleanup call "taking around 150-200ms" in one suite (ISO-03 source) | ISO-03 source: "truncate is faster only when tables contain a considerable amount of data"; ISO-02 source: truncation approach "requires extra work like refreshing materialized views or resetting sequences" | https://www.postgresql.org/message-id/64B8E470-0719-40F3-81BB-0BF609F2B85E%40gmail.com ; https://seo-blog.carbonhealth.com/blog-post/cleaning-postgresql-db-between-integration-tests-efficiently ; https://eradman.com/posts/database-test-isolation.html | M |
| ISO-13 | Transaction rollback: caveats stated | Not a cost. (a) "the same database connection is used throughout all of the tests," which "may be impossible for external binaries"; PostgreSQL savepoints "don't enable true nested transactions; any error fails the entire outer transaction" (b) with savepoints standing in for transactions, "now() will never change during the tests, deferred constraints/triggers won't work, other processes can't see the data" (c) "the database never actually reaches a `COMMIT`. You're testing a savepoint release standing in for a commit" (d) search summary (L): a second pool connection cannot see uncommitted fixtures under READ COMMITTED | These limit which code paths a rolled-back test can exercise (for example append-only audit chains written by several connections, or code that commits) | (a) https://eradman.com/posts/database-test-isolation.html (b) https://www.postgresql.org/message-id/-5597225702073313349%40unknownmsgid (c) https://mergify.com/blog/postgres-database-per-test-sqlalchemy (d) search S2 | M, L for (d) |

### 4.3 Alternative database engines for tests (no Docker, no account)

| ID | Option | Found | Cost / limits as stated | Source (fetched 2026-10-04) | Conf |
|---|---|---|---|---|---|
| ALT-01 | PGlite `@electric-sql/pglite` 0.5.8, Apache-2.0 (registry; project docs: "Dual-licensed under Apache 2.0 and the PostgreSQL License") | "a WASM Postgres build packaged into a TypeScript/JavaScript client library, that enables you to run Postgres in the browser, Node.js and Bun, with no need to install any other dependencies"; "under 3mb Gzipped"; modes in-memory, file (`new PGlite('./path/to/pgdata')`), IndexedDB; "PGlite is single user/connection"; "very fast to start and tear down" (no figure). Postgres major version not stated on the pages fetched | Per-test cost: not confirmed (qualitative only: "Tests run in milliseconds"). One guide shows one instance per file with `TRUNCATE` in `beforeEach` | https://pglite.dev/docs/about ; https://github.com/electric-sql/pglite ; https://makerkit.dev/blog/tutorials/unit-testing-prisma-vitest ; https://registry.npmjs.org/@electric-sql/pglite | H (docs, registry), M (guide) |
| ALT-02 | `@electric-sql/pglite-socket` 0.2.11, Apache-2.0 | Registry lists peer `@electric-sql/pglite` 0.5.8 and extension packages. Purpose and behaviour not confirmed from a fetched page (the repository page did not mention it) | not confirmed | https://registry.npmjs.org/@electric-sql/pglite-socket | H (registry only) |
| ALT-03 | `pg-mem` 3.0.14, MIT | "an experimental in-memory emulation of a postgres database"; "a best effort to replicate PG"; "The sql syntax parser is home-made...some features are not implemented"; materialized views implemented as views; no timezone support; restore points to reset state between tests | Per-test cost: not confirmed | https://github.com/oguimbal/pg-mem ; https://registry.npmjs.org/pg-mem | H (registry), M (README) |
| ALT-04 | `embedded-postgres` 18.4.0-beta.17, MIT code; binaries Apache-2.0 | "A Node package that allows you to spawn a Postgresql cluster programatically"; binaries from the zonky embedded-postgres-binaries project; macOS x64 and arm64, Windows x64, several Linux architectures; PostgreSQL 14 to 18; "Docker is not required"; API `initialise()`, `start()`, `stop()`, `createDatabase()`, `dropDatabase()`. The version string is a beta | Row 6 owns server provisioning; listed here because a test suite can use `createDatabase()` and `dropDatabase()` | https://github.com/leinelissen/embedded-postgres ; https://registry.npmjs.org/embedded-postgres | H (registry), M (README) |

### 4.4 Isolation strategy count for the verification rule

Strategies with a source-stated cost per test run (as the row's verification requires): database per test from a template (ISO-01 40 ms, ISO-02 30 ms, ISO-03 400 ms, ISO-04 "a couple hundred milliseconds"); schema per test (ISO-07 about 1000 ms for a schema of about 500 table and index definitions). Transaction rollback and truncate have suite totals only (ISO-10); a per-test figure for them is "not confirmed".

---

## 5. WebSocket Testing

| ID | Found | Why it matters | Verified by | Source (fetched 2026-10-04) | Conf |
|---|---|---|---|---|---|
| W-01 | `@fastify/websocket` 11.3.3, MIT (registry; modified 2026-10-03). Installed in the repo: 11.3.1 (H-03, H-05) | Registry is two patch versions ahead of the pin | `npm view` | https://registry.npmjs.org/@fastify/websocket | H |
| W-02 | Plugin README, testing section: `injectWS([path], [upgradeContext])`; "`fastify.ready()` needs to be awaited to ensure that fastify has been decorated"; "Websocket needs to be closed manually at the end of each test"; "You need to register the event listener before sending the message if you need to process the server response"; example passes headers (`{ headers: { "api-key" : "some-random-key" } }`) and ends with `ws.terminate()` | A WebSocket upgrade can be exercised without a listening port; headers (for example credentials) can be supplied | `WebFetch` | https://github.com/fastify/fastify-websocket | H |
| W-03 | Same README: "Hooks that run **before** the websocket connection is established will be called - this includes onRequest, preParsing, preValidation, and preHandler"; options `verifyClient`, `handleProtocols`, `errorHandler`, `preClose`; "Licensed under MIT" | Authentication at upgrade can be tested through the same hooks used for HTTP | `WebFetch` | https://github.com/fastify/fastify-websocket | H |
| W-04 | Real-socket pattern: listen on `127.0.0.1` port 0, read `app.server.address()`, connect with the `ws` client; used in the repo today (H-09). `ws` 8.22.0, MIT, modified 2026-09-26; optional peers `bufferutil`, `utf-8-validate` | Tests the full network path including origin checks and HTTP 403 before upgrade, as the repo test does | `npm view ws`; read of repo test | https://registry.npmjs.org/ws ; `apps/mock-core/test/ws-origin.test.ts:12-29` | H |
| W-05 | Node's global `WebSocket` is "No longer experimental" as of v22.4.0 (I-06) | A client without the `ws` package is available on Node 26 | `WebFetch` | https://nodejs.org/docs/latest/api/globals.html | H |
| W-06 | MSW (Mock Service Worker): the Vitest page says it "allows you to mock `http`, `WebSocket` and `GraphQL` network requests, and is framework agnostic"; example `ws.link('wss://chat.example.com')` with `addEventListener('connection', ...)`; it "uses the `@mswjs/interceptors` library". Registry: `msw` 3.0.2, MIT, peers `vite >=6`, `graphql >=16`, `typescript >=5.9.x`. Node version needed for the WebSocket global under MSW: not confirmed on the page (a search summary says Node 22 or higher, L) | Mocks the server for client-side tests (web console, mobile client code); does not test the Fastify server | `WebFetch`; `npm view msw` | https://vitest.dev/guide/mocking/requests ; https://registry.npmjs.org/msw | H (page, registry), L (Node note) |
| W-07 | `vitest-websocket-mock` 0.8.0, MIT, peers `vitest >=5 <6`: "A set of utilities and Vitest matchers to help testing complex websocket interactions: mock websocket servers, wait for connections and messages"; `WS` class with `nextMessage`, `messages`, `send`, `close`; the README demonstrates testing clients against a mock server. `mock-socket` 9.3.1 MIT (modified 2023-09-11) and `jest-websocket-mock` 2.5.0 MIT (modified 2023-09-10) are the older siblings | A server mock for client tests; it does not exercise the real Fastify upgrade path | `WebFetch`; `npm view` | https://github.com/akiomik/vitest-websocket-mock ; https://registry.npmjs.org/vitest-websocket-mock ; https://registry.npmjs.org/mock-socket ; https://registry.npmjs.org/jest-websocket-mock | H (registry), M (README) |
| W-08 | Search summary (L): integration tests for WebSocket servers commonly start the server in `beforeAll`, close connections in `afterAll`, and use a real `ws` client; a repository example exists for Jest/Vitest (`itenthusiasm/testing-websockets`, not fetched) | Confirms the pattern in H-09 is common | search S5 | search S5 | L |

---

## 6. Coverage

| ID | Found | Why it matters | Verified by | Source (fetched 2026-10-04) | Conf |
|---|---|---|---|---|---|
| C-01 | Vitest coverage providers: `v8` (native) and `istanbul` (instrumented), plus a custom provider; "By default, `v8` will be used." Packages `@vitest/coverage-v8` and `@vitest/coverage-istanbul`; Vitest "will prompt you to install the corresponding support package automatically" | Neither package is installed (H-07), so a coverage run would trigger an install prompt | `WebFetch` | https://vitest.dev/guide/coverage | H |
| C-02 | Registry: `@vitest/coverage-v8` 5.0.3, MIT, modified 2026-09-30T11:29:29Z, peers `vitest 5.0.3`, `@vitest/browser 5.0.3`; `@vitest/coverage-istanbul` 5.0.3, MIT, modified 2026-09-30T11:29:22Z, peer `vitest 5.0.3` | Both match the pinned runner version | `npm view` | https://registry.npmjs.org/@vitest/coverage-v8 ; https://registry.npmjs.org/@vitest/coverage-istanbul | H |
| C-03 | "Since version 3.2.0, Vitest has used AST based coverage remapping for V8 coverage, which produces identical coverage reports to Istanbul." v8 advantages: "Faster execute times than Istanbul", "Lower memory usage than Istanbul". v8 limits: "In some cases can be slower than Istanbul, e.g. when loading lots of different modules"; "does not work on environments that don't use V8, such as Firefox or Bun." Istanbul: "Coverage instrumentation can be limited to specific files"; "Execution speed is slower than V8 due to instrumentation overhead"; "Memory usage is higher than V8." No figures given | Stated trade-offs; no measured numbers in the docs | `WebFetch` | https://vitest.dev/guide/coverage | H |
| C-04 | The Vitest 5 coverage page contains no Vitest-5-specific breaking changes; the migration page lists the `vitest/coverage` entry point among those that "no longer work" (V-02) | Import paths for custom coverage code change | `WebFetch` of both pages | https://vitest.dev/guide/coverage ; https://vitest.dev/guide/migration | H |
| C-05 | With `test.projects`, "coverage is done for the whole process," so results aggregate across projects (V-08) | One report can span the shared, core-web and a new backend workspace if they are projects of one root config | `WebFetch` | https://vitest.dev/guide/projects | H |
| C-06 | Jest 29 (the mobile workspace): `collectCoverage` default `false`, "it may significantly slow down your tests"; "Jest ships with two coverage providers: `babel` (default) and `v8`"; `coverageThreshold` global, glob or path, positive number = minimum percentage, negative = maximum uncovered entities; `coverageReporters` default `["clover", "json", "lcov", "text"]` | Mobile coverage is a separate tool with its own thresholds | `WebFetch` of the 29.7 page | https://jestjs.io/docs/29.7/configuration | H |
| C-07 | Standalone tools, registry metadata only: `c8` 12.0.0, ISC, modified 2026-07-16, optional peer `monocart-coverage-reports ^2`; `nyc` 18.0.0, ISC, modified 2026-02-25 | Candidates outside the runner; docs not fetched, behaviour with Vitest 5 not confirmed | `npm view` | https://registry.npmjs.org/c8 ; https://registry.npmjs.org/nyc | H (registry only) |
| C-08 | Coverage of server code run in a separate child process during an end-to-end run, and coverage collected through `injectWS` or a real socket: not confirmed by any fetched source | Only code executed inside the Vitest worker is evidenced as measurable | none | not confirmed | n/a |
| C-09 | Playwright coverage page (`https://playwright.dev/docs/test-coverage`) returned HTTP 404; browser-side coverage through Playwright: not confirmed | End-to-end coverage of the web console has no evidence here | `WebFetch` returned 404 | https://playwright.dev/docs/test-coverage | n/a |

---

## 7. End-to-End Options: Web Console plus Android Emulator Pair

### 7.1 Maestro CLI (on the host)

| ID | Found | Why it matters | Verified by | Source (fetched 2026-10-04) | Conf |
|---|---|---|---|---|---|
| E-01 | Version: CLI 2.11.0 on the host (jar `maestro-cli-2.11.0.jar`, H-12); the GitHub releases page lists "CLI 2.11.0 - September 29", "CLI 2.10.0 - August 31", "CLI 2.9.0 - August 26" (year not shown in the extraction); release notes point to `CHANGELOG.md`. `maestro --version` was attempted once and failed under the sandbox (see section 11.4), so the jar name is the version evidence | Installed version equals the newest listed release | `ls ~/.maestro/lib`; `WebFetch` | `~/.maestro/lib/` ; https://github.com/mobile-dev-inc/Maestro/releases | H (jar), M (page extraction) |
| E-02 | Licence: Apache License 2.0 ("Maestro is open-source under the Apache 2.0 license"); the repository LICENSE file begins "Apache License Version 2.0, January 2004" | Licence is confirmed from the repository | `WebFetch` of README and LICENSE | https://github.com/mobile-dev-inc/Maestro ; https://github.com/mobile-dev-inc/Maestro/blob/main/LICENSE | H |
| E-03 | Platforms: "Android, iOS, and web apps." "Flows run on any emulator, simulator, browser, or physical Android device. Physical iOS devices are not yet supported." "Maestro requires Java 17 or higher to be installed on your system." Install command shown: `curl -fsSL 'https://get.maestro.mobile.dev' \| bash` | Android emulators are supported targets; Java 17+ is a prerequisite (host Java version not checked, no process started) | `WebFetch` | https://github.com/mobile-dev-inc/Maestro | H |
| E-04 | Android: "Maestro connects to your target via ADB (Android Debug Bridge)"; "Maestro automatically detects and connects to running emulators or physical devices"; "Maestro assumes the application is already installed on the target device/emulator before the test begins"; "Whether you use Kotlin, Java, Flutter, React Native, or Compose, Maestro interacts only with the rendered UI"; "You don't need to add test dependencies to your `build.gradle` or compile a special 'test APK.'"; same page: "Local Testing: Sequential execution on a single device at a time." | No instrumentation build is needed; the app must be installed before each run; local runs are described as sequential on one device | `WebFetch` | https://docs.maestro.dev/get-started/supported-platform/android | H |
| E-05 | Device selection and parallelism: `maestro --device <id> test flow.yaml`; `maestro list-devices`; `maestro start-device --platform android`; "`--shard-all`: Run the exact same test collection across multiple devices" (`maestro test --shard-all 3 .maestro`); "`--shard-split`: Divide your suite. If you have 9 tests and 3 devices, Maestro will run 3 unique tests on each device"; explicit devices: `maestro test --device "emulator-5554,emulator-5556" --shard-split 2 ./myTests`; "You can speed up your local execution by 'sharding' your tests" | Two named emulators can be addressed in one invocation; sharding splits or repeats whole flows, it is not shown to coordinate two devices inside one flow | `WebFetch` | https://docs.maestro.dev/maestro-flows/flow-control-and-logic/specify-and-start-devices | H |
| E-06 | `maestro test` options listed: `--device`/`--udid`, `--shard-split`, `--shard-all`, `-c`/`--continuous`, `--format` (`JUNIT`, `HTML`, `NOOP`; default NOOP), `--output`, `-e`/`--env`, `--include-tags`, `--exclude-tags`, `--headless` ("(Web only)"), `-p`/`--platform`, `--analyze` ("[Beta]... AI Insights"). Commands listed: `test`, `cloud`, `record`, `start-device`, `list-devices`, `list-cloud-devices`, `login`, `logout`, `mcp`, `bugreport`, `driver-setup`, `download-samples` | JUnit and HTML reports are built in; `cloud`, `login`, `list-cloud-devices` and `--analyze` relate to the hosted service | `WebFetch` | https://docs.maestro.dev/maestro-cli/maestro-cli-commands-and-options | H |
| E-07 | Web: "Web support is currently in Beta. It is functional for Chromium-based testing"; "The current default and only supported browser is Chromium"; replace `appId` with `url` in the YAML; "On the first run, Maestro will automatically download a managed version of Chromium"; limits: locale `en-US`, screen size and viewport preset. The host install already ships `maestro-web.jar` (H-12) | The web console could be driven by the same CLI, in Beta, with a browser download on first run | `WebFetch` | https://docs.maestro.dev/get-started/supported-platform/web-browser.md | H |
| E-08 | JavaScript in flows: inline `${}`, `evalScript`, `runScript` with an external `.js` file; env passed with `env`; the `output` object stores state across steps; `console.log` accepts one argument only. An `http` request helper and the JavaScript engine name are not confirmed from the fetched pages (a search summary says GraalJS and HTTP calls, L) | Whether a flow can fetch a pairing code over HTTP from the backend is not confirmed | `WebFetch` (page 404 at the first URL; second URL succeeded) | https://docs.maestro.dev/maestro-flows/javascript/run-and-debug-javascript | H (scripting forms), L (HTTP, engine) |
| E-09 | `clearState` "ensures a reproducible environment by clearing app data (the equivalent of `adb shell pm clear <package-name>`) before the app launches"; `launchApp` accepts `clearState`, `clearKeychain`, `permissions`, `arguments` (the extraction shows the iOS permissions example) | Resets app data between flows on the emulator; related to what a reinstall or clear does to stored credentials, which row 11 covers | `WebFetch` of the documentation corpus | https://docs.maestro.dev/llms-full.txt | M (partial extraction) |
| E-10 | Account and cost: "Test for free on your own devices with Maestro Studio or the CLI"; Maestro Cloud "$250/device/mo" for hosted devices; the pages fetched do not state whether the local CLI needs an account (not confirmed). Host evidence: `~/.maestro/analytics.json` has `cachedToken: null` and analytics disabled (H-12); the repo script sets `MAESTRO_CLI_NO_ANALYTICS=true` (H-13); the variable's documentation was not found | Hosted pieces are excluded (section 9); no cloud token is present on this host | `WebFetch`; file read | https://maestro.dev/pricing ; https://docs.maestro.dev/maestro-cli ; `~/.maestro/analytics.json` | M |
| E-11 | A single run on web plus Android in one flow, and one flow driving two devices at the same time: not confirmed by any fetched source. A search summary states only that multiple devices "can run tests at the same time" and that web support is Beta (L) | The pairing scenario spans a browser and a phone; how Maestro would sequence both is not evidenced | searches S6, S12 | search S12 | L |

### 7.2 Other end-to-end tools

| ID | Tool | Found | Why it matters | Source (fetched 2026-10-04) | Conf |
|---|---|---|---|---|---|
| E-12 | Playwright Test `@playwright/test` 1.63.0 / `playwright` 1.63.0, Apache-2.0, modified 2026-10-03 | `webServer` launches "a local dev server before running your tests", accepts an array for several servers, each with `command`, `url`, `name`, `timeout`; `reuseExistingServer`; default timeout 60000 ms; `url` expected to return 2xx, 3xx, 400, 401, 402 or 403 | Starts the backend and the web console from the test config | https://playwright.dev/docs/test-webserver ; https://registry.npmjs.org/@playwright/test | H |
| E-13 | Playwright parallelism | "test files are run in parallel. Tests in a single file are run in order, in the same worker process"; `workers`, `fullyParallel`, `workers: 1` disables parallelism; `TEST_WORKER_INDEX` starts at 1, `TEST_PARALLEL_INDEX` between 0 and `workers - 1`; worker-scoped fixtures | A per-worker key exists in Playwright as in Vitest | https://playwright.dev/docs/test-parallel | H |
| E-14 | Playwright browsers | `npx playwright install`; cached at `~/Library/Caches/ms-playwright` on macOS; "a few hundred megabytes" with example sizes chromium 281M, firefox 187M, webkit 180M; downloads come from Microsoft's CDN by default, overridable with `PLAYWRIGHT_DOWNLOAD_HOST`; branded Chrome or Edge can be used through the `channel` option | Binary download is a host change; the host cache already has Chromium entries (H-14) | https://playwright.dev/docs/browsers | H |
| E-15 | Playwright Android | "Playwright has experimental support for Android automation... This includes Chrome for Android and Android WebView"; needs an Android device or AVD emulator, ADB, Chrome 87 or newer; "Raw USB operation is not yet supported, so you need ADB"; it drives web content only, not native app UI (per the extraction) | Not a driver for a native Expo app screen | https://playwright.dev/docs/api/class-android | H |
| E-16 | Detox `detox` 20.51.4, MIT, peers `jest 30.x.x \|\| 29.x.x \|\| 28.x.x \|\| ^27.2.5` | README: "React Native apps (Android & iOS)"; official compatibility "RN v0.77.x - v0.84.x" with the New Architecture; newer versions "might work with Detox, but they've not been thoroughly tested"; gray-box synchronisation; "Jest integration out of the box"; Expo support, requirements and the test-binary need: not confirmed from the pages fetched (the Expo guide URL returned 404). The app here is React Native 0.86.3 (H-04), outside the stated range | Compatibility statement versus the app's React Native version is a documented gap | https://github.com/wix/Detox ; https://wix.github.io/Detox/docs/introduction/getting-started ; https://registry.npmjs.org/detox | H (registry, README), L for Expo |
| E-17 | Appium `appium` 3.8.0 Apache-2.0; `appium-uiautomator2-driver` 8.7.0 Apache-2.0 (peer `appium ^3.0.0-rc.2`) | Docs: four parts (core, drivers, clients, plugins); "install Appium itself", "a driver for your target platform", "a client library"; the UiAutomator2 driver is named for Android. Docs footer: "Copyright OpenJS Foundation and Appium contributors." Node and SDK requirements: not confirmed | Server-plus-driver architecture, more moving parts than a single CLI | https://appium.io/docs/en/latest/intro/ ; https://registry.npmjs.org/appium ; https://registry.npmjs.org/appium-uiautomator2-driver | H (registry), M (docs) |
| E-18 | Cypress `cypress` 16.1.1, MIT; WebdriverIO `webdriverio` 9.32.0, MIT (optional peer `puppeteer-core >=22.x <=24.x`) | Registry metadata only; their Android and Expo capabilities were not researched in this collection. Hosted add-ons by the same vendors were not evaluated | Listed for completeness of the web-end-to-end field | https://registry.npmjs.org/cypress ; https://registry.npmjs.org/webdriverio | H (registry only) |
| E-19 | Expo documentation on testing | "Expo recommends using Jest with the jest-expo library" ("a Jest preset that mocks the native part of the Expo SDK"); "For UI testing, we recommend end-to-end tests instead of snapshot unit tests"; it links to an "E2E tests with Maestro" guide and "E2E tests with EAS Workflows" | The vendor of the mobile stack names Maestro for end-to-end tests; the EAS Workflows path is a hosted service | https://docs.expo.dev/develop/unit-testing/ | H |
| E-20 | Registry for the mobile unit-test stack: `jest-expo` 57.0.5 MIT (peers `expo *`, `react-native *`, `@react-native/jest-preset ^0.86.3`); `jest` 30.5.2 MIT is the registry latest while the repo pins 29.7.0; `@testing-library/react-native` 14.0.1 MIT is the registry latest (peers `jest >=29.0.0`, `react >=19.0.0`, `react-native >=0.78`, `test-renderer ^1.0.0`) while the repo pins 13.3.3 | Pinned and latest versions differ for the mobile test stack | `npm view` | https://registry.npmjs.org/jest-expo ; https://registry.npmjs.org/jest ; https://registry.npmjs.org/@testing-library/react-native | H |

### 7.3 Emulator and `adb` facts relevant to a two-emulator run

| ID | Found | Why it matters | Source (fetched 2026-10-04) | Conf |
|---|---|---|---|---|
| E-21 | "Each emulator uses a pair of sequential ports - an even-numbered port for console connections and an odd-numbered port for `adb` connections" (Emulator 1: 5554/5555; Emulator 2: 5556/5557); serial format `emulator-5554`; `adb -s <serial>` targets one device; "you can set the `$ANDROID_SERIAL` environment variable to contain the serial number" | Two emulators are addressed by serial; the repo's `e2e` script already honours `ANDROID_SERIAL` (H-13) | https://developer.android.com/tools/adb | H |
| E-22 | Address `10.0.2.2` is a "Special alias to your host loopback interface (127.0.0.1 on your development machine)"; "The address 127.0.0.1 on your development machine corresponds to the emulator's loopback interface. To access services running on your development machine loopback interface, use the special address `10.0.2.2` instead." The page fetched for `adb reverse` did not describe that command (not confirmed there) | A host-bound service reaches the emulator through `10.0.2.2`, or through `adb reverse` which the repo already uses (`"reverse": "adb reverse tcp:4400 tcp:4400 && adb reverse tcp:8081 tcp:8081"`, `apps/mobile/package.json:18`) | https://developer.android.com/studio/run/emulator-networking-address | H |
| E-23 | Maestro quickstart (Android): create a virtual device with a system image ("API 31 or higher is recommended") and start it; the quickstart page states nothing about a login for local runs or a Java version (not confirmed there) | Emulator image level is an input to the Maestro run | https://docs.maestro.dev/get-started/quickstart.md | H |

---

## 8. Tool Register (version, licence, URL with fetch date)

Version and licence for npm packages come from `npm view <pkg> version license time.modified peerDependencies` run on 2026-10-04 (registry `https://registry.npmjs.org/<pkg>`, fetched 2026-10-04). Docs URLs were fetched 2026-10-04. "Needs" lists Docker, account, hosted service or binary download.

| Tool | Version | Licence | URL (fetched 2026-10-04) | Needs | Status in this collection |
|---|---|---|---|---|---|
| vitest | 5.0.3 | MIT | https://registry.npmjs.org/vitest ; https://vitest.dev/guide/ pages in section 2 | none | In repo (H-01..H-03) |
| @vitest/coverage-v8 | 5.0.3 | MIT | https://registry.npmjs.org/@vitest/coverage-v8 | none | Candidate; not installed |
| @vitest/coverage-istanbul | 5.0.3 | MIT | https://registry.npmjs.org/@vitest/coverage-istanbul | none | Candidate; not installed |
| @vitest/browser | 5.0.3 | MIT | https://registry.npmjs.org/@vitest/browser | browser binaries via provider | Candidate |
| @vitest/browser-playwright | 5.0.3 | MIT | https://registry.npmjs.org/@vitest/browser-playwright | `playwright` + browser download | Candidate |
| @vitest/browser-webdriverio | 5.0.0 | MIT | https://registry.npmjs.org/@vitest/browser-webdriverio | `webdriverio` | Candidate |
| @vitest/browser-preview | 5.0.3 | MIT | https://registry.npmjs.org/@vitest/browser-preview | none stated | Candidate |
| @vitest/ui | 5.0.3 | MIT | https://registry.npmjs.org/@vitest/ui | none | Registry only |
| fastify | 5.12.5 | MIT | https://registry.npmjs.org/fastify ; https://fastify.dev/docs/latest/Guides/Testing/ | none | In repo (H-03) |
| light-my-request | 6.6.0 | BSD-3-Clause | https://registry.npmjs.org/light-my-request ; https://github.com/fastify/light-my-request | none | In repo via Fastify (H-05) |
| @fastify/websocket | 11.3.3 (repo pin 11.3.1) | MIT | https://registry.npmjs.org/@fastify/websocket ; https://github.com/fastify/fastify-websocket | none | In repo |
| ws | 8.22.0 | MIT | https://registry.npmjs.org/ws | none | In repo |
| @types/ws | 8.18.2 | MIT | https://registry.npmjs.org/@types/ws | none | In repo |
| supertest | 7.3.1 | MIT | https://registry.npmjs.org/supertest ; https://github.com/forwardemail/supertest | none | Candidate |
| undici | 8.11.2 | MIT | https://registry.npmjs.org/undici | none | Registry only |
| pg | 8.23.1 | MIT | https://registry.npmjs.org/pg | none (optional peer `pg-native`) | Registry only; row 7 owns drivers |
| postgres | 3.4.9 | Unlicense | https://registry.npmjs.org/postgres | none | Registry only; row 7 owns drivers |
| @electric-sql/pglite | 0.5.8 | Apache-2.0 (docs: dual Apache 2.0 and PostgreSQL License) | https://registry.npmjs.org/@electric-sql/pglite ; https://pglite.dev/docs/about | none | Candidate test engine (ALT-01) |
| @electric-sql/pglite-socket | 0.2.11 | Apache-2.0 | https://registry.npmjs.org/@electric-sql/pglite-socket | none | Registry only |
| pg-mem | 3.0.14 | MIT | https://registry.npmjs.org/pg-mem ; https://github.com/oguimbal/pg-mem | none | Candidate test engine (ALT-03) |
| embedded-postgres | 18.4.0-beta.17 | MIT (code); binaries Apache-2.0 | https://registry.npmjs.org/embedded-postgres ; https://github.com/leinelissen/embedded-postgres | binary download via npm platform packages | Candidate (row 6 overlap) |
| msw | 3.0.2 | MIT | https://registry.npmjs.org/msw ; https://vitest.dev/guide/mocking/requests | none | Candidate for client tests |
| vitest-websocket-mock | 0.8.0 | MIT | https://registry.npmjs.org/vitest-websocket-mock ; https://github.com/akiomik/vitest-websocket-mock | none | Candidate for client tests |
| mock-socket | 9.3.1 | MIT | https://registry.npmjs.org/mock-socket | none | Registry only (last modified 2023-09-11) |
| jest-websocket-mock | 2.5.0 | MIT | https://registry.npmjs.org/jest-websocket-mock | none | Registry only (last modified 2023-09-10) |
| c8 | 12.0.0 | ISC | https://registry.npmjs.org/c8 | none | Registry only |
| nyc | 18.0.0 | ISC | https://registry.npmjs.org/nyc | none | Registry only |
| @playwright/test / playwright | 1.63.0 | Apache-2.0 | https://registry.npmjs.org/@playwright/test ; https://playwright.dev/docs/test-webserver | browser download (Microsoft CDN by default) | Candidate |
| Maestro CLI | 2.11.0 (host jar; GitHub releases) | Apache-2.0 | https://github.com/mobile-dev-inc/Maestro ; https://github.com/mobile-dev-inc/Maestro/blob/main/LICENSE ; https://docs.maestro.dev/ pages in section 7.1 | Java 17+; Chromium download for web; local-CLI account need not confirmed | On host; no flows yet |
| detox | 20.51.4 | MIT | https://registry.npmjs.org/detox ; https://github.com/wix/Detox | Android build; stated RN range 0.77 to 0.84 | Candidate (gap against RN 0.86.3) |
| appium / appium-uiautomator2-driver | 3.8.0 / 8.7.0 | Apache-2.0 | https://registry.npmjs.org/appium ; https://registry.npmjs.org/appium-uiautomator2-driver ; https://appium.io/docs/en/latest/intro/ | server + driver install | Candidate |
| cypress | 16.1.1 | MIT | https://registry.npmjs.org/cypress | not researched | Registry only |
| webdriverio | 9.32.0 | MIT | https://registry.npmjs.org/webdriverio | not researched | Registry only |
| jest / jest-expo / @testing-library/react-native | repo 29.7.0 / ~57.0.5 / 13.3.3; registry 30.5.2 / 57.0.5 / 14.0.1 | MIT | https://registry.npmjs.org/jest ; https://registry.npmjs.org/jest-expo ; https://registry.npmjs.org/@testing-library/react-native ; https://docs.expo.dev/develop/unit-testing/ | none | In repo (mobile) |
| start-server-and-test / wait-on | 3.0.12 / 9.5.1 | MIT | https://registry.npmjs.org/start-server-and-test ; https://registry.npmjs.org/wait-on | none | Registry only; behaviour not researched |

---

## 9. Excluded Options (marked, with the reason)

| Option | Version and licence (registry) | Reason excluded | Evidence |
|---|---|---|---|
| `testcontainers` and `@testcontainers/postgresql` | 12.2.0, MIT (both) | Container-based: "throwaway instances of common databases... or anything else that can run in a Docker container"; Docker or another container runtime is required | https://node.testcontainers.org/ (fetched 2026-10-04); registry. The page's excerpt did not itself state the runtime requirement, only the Docker-container model (M) |
| `@databases/pg-test` | 4.0.0, MIT | "uses docker to allow you to run tests against a real postgres database"; "You should install docker" | https://www.atdatabases.org/docs/pg-test (fetched 2026-10-04) |
| Maestro Cloud, `maestro cloud`, `maestro login`, `list-cloud-devices`, `--analyze` | not applicable | Hosted service on paid per-device pricing ("$250/device/mo") | https://maestro.dev/pricing ; https://docs.maestro.dev/maestro-cli/maestro-cli-commands-and-options |
| EAS Workflows end-to-end path (named by Expo docs) | not applicable | Hosted build and test service | https://docs.expo.dev/develop/unit-testing/ |
| Hosted device farms that appeared only in search results (for example BrowserStack, TestingBot) | not collected | Hosted and account-bound; not fetched | searches S6, S7, S8, S12 |
| Docker-based database run paths in articles (for example the Docker PostgreSQL in the schema-per-worker article) | not applicable | The technique is kept in section 4; only the Docker provisioning in that article is excluded | https://dev.to/cseby92/how-to-run-jest-integration-tests-in-parallel-using-isolated-sql-schemas-1bm7 |

Not excluded but limited (stated as found): PGlite is a WASM build with a single connection, not a native server (ALT-01); `pg-mem` is an emulator (ALT-03); Playwright Android drives web content only (E-15); Maestro web is Beta (E-07).

---

## 10. Not Confirmed and Gaps

1. Per-test cost for transaction rollback and for truncate on current PostgreSQL: only suite totals from 2012 (ISO-10) and a MySQL series (ISO-11).
2. Per-test cost for schema per test other than the single 1000 ms per 500-definition schema figure (ISO-07); the two schema articles give none (ISO-08, ISO-09).
3. Per-test cost for PGlite and `pg-mem`: no figure in any fetched source.
4. Template clone cost on PostgreSQL 18 with `file_copy_method=clone` on macOS: the manual states the mechanism, no measurement was found (D-04).
5. Publication dates of the Nirvana, Eradman, Deel and Mergify posts: not shown in the extractions.
6. Whether the local Maestro CLI needs an account: not stated on any fetched page; host evidence only (E-10).
7. Maestro `http` helper in flows, JavaScript engine name, `MAESTRO_CLI_NO_ANALYTICS` documentation: not found (E-08, E-10).
8. Maestro driving a web browser and an Android emulator in one flow, or two devices inside one flow: not confirmed (E-11).
9. Detox support for Expo and for React Native 0.86: the stated range ends at 0.84; the Expo page returned 404 (E-16).
10. Appium requirements (Node, SDK, Java): not in the extraction (E-17).
11. Coverage of out-of-process server code and of WebSocket paths: not confirmed (C-08). Playwright coverage page: 404 (C-09).
12. Host Java version and whether the installed Maestro runs inside the sandbox: not checked; the one `maestro --version` attempt failed (section 11.4).
13. Which Chromium revision Playwright 1.63.0 expects versus the cached `chromium-1234` and `chromium-1243`: not confirmed (H-14).
14. Fastify 5 compatibility statement of `@fastify/websocket` 11.3.3 and of `light-my-request` 6.6.0: the registry shows no Fastify peer range; the README extractions do not state one. The repo runs Fastify 5.12.5 with `@fastify/websocket` 11.3.1 (H-03).
15. Whether a root Vitest `projects` config would change any existing workspace setting beyond `extends` defaulting to true: not evidenced here.
16. Web-search summaries (L) were not independently confirmed: S2 transaction/pool caveat, S4 `VITEST_WORKER_ID` semantics, S6/S12 Maestro multi-device wording, S5/S9 general statements.

---

## 11. Query Log

### 11.1 Web search queries (exact strings, in order; all generic technology queries)

The search tool may run follow-up searches on its own when a first pass is thin (S8 and S12 show this in their output); those follow-ups were generated by the tool, not typed by the collector, and each stayed on the generic topic of the query above it.

| # | Exact query string | Mode |
|---|---|---|
| S1 | `PostgreSQL template database per test worker integration tests speed milliseconds CREATE DATABASE TEMPLATE` | standard |
| S2 | `PostgreSQL integration tests isolation transaction rollback per test versus schema per test versus database per test comparison` | standard |
| S3 | `Vitest per worker database schema VITEST_POOL_ID node-postgres parallel integration tests` | standard |
| S4 | `vitest environment variable VITEST_POOL_ID VITEST_WORKER_ID documentation` | standard |
| S5 | `testing WebSocket server with ws client in Vitest or Node test runner wait for message listen on port 0` | standard |
| S6 | `Maestro mobile UI testing run flows on multiple Android emulators in parallel shard CLI` | standard |
| S7 | `Maestro CLI JavaScript runScript evalScript http request in flow, launchApp clearState, Expo React Native Android testID id selector` | standard |
| S8 | `Maestro CLI anonymous analytics opt out MAESTRO_CLI_NO_ANALYTICS local testing no account required` | standard |
| S9 | `PGlite in-memory Postgres for unit tests startup time milliseconds per test fresh instance Vitest` | standard |
| S10 | `PostgreSQL test cleanup TRUNCATE tables between tests versus transaction rollback versus drop database benchmark seconds` | standard |
| S11 | `Postgres schema per test CREATE SCHEMA search_path run migrations each test time cost parallel Node integration tests` | standard |
| S12 | `Maestro test flow cross-platform web and Android device in a single flow multi-device orchestration limitation` | standard |

### 11.2 Fetched URLs (all on 2026-10-04; result column: OK, 403, 404, partial)

| # | URL | Result |
|---|---|---|
| F1 | https://vitest.dev/guide/coverage | OK |
| F2 | https://fastify.dev/docs/latest/Guides/Testing/ | OK |
| F3 | https://www.postgresql.org/docs/current/manage-ag-templatedbs.html | OK |
| F4 | https://www.postgresql.org/docs/current/sql-createdatabase.html | OK |
| F5 | https://vitest.dev/guide/test-context | OK |
| F6 | https://vitest.dev/config/globalsetup | OK |
| F7 | https://conroy.org/per-test-database-isolation-in-postgres | OK |
| F8 | https://www.nirvanatech.com/blog/how-we-made-postgresql-work-in-unit-tests | OK |
| F9 | https://mergify.com/blog/postgres-database-per-test-sqlalchemy | OK |
| F10 | https://www.deel.com/blog/database-integrations-tests/ | OK |
| F11 | https://www.npmjs.com/package/pgsql-test | 403 |
| F12 | https://pglite.dev/docs/ | OK (partial facts) |
| F13 | https://vitest.dev/guide/parallelism | OK |
| F14 | https://dev.to/cseby92/how-to-run-jest-integration-tests-in-parallel-using-isolated-sql-schemas-1bm7 | OK |
| F15 | https://vitest.dev/config/pool | OK |
| F16 | https://vitest.dev/guide/improving-performance | OK |
| F17 | https://vitest.dev/config/setupfiles | OK |
| F18 | https://github.com/fastify/fastify-websocket | OK |
| F19 | https://github.com/fastify/light-my-request | OK |
| F20 | https://vitest.dev/guide/mocking/requests | OK |
| F21 | https://github.com/akiomik/vitest-websocket-mock | OK |
| F22 | https://nodejs.org/docs/latest/api/globals.html | OK |
| F23 | https://github.com/mobile-dev-inc/Maestro | OK |
| F24 | https://docs.maestro.dev/maestro-cli/maestro-cli-commands-and-options | OK |
| F25 | https://docs.maestro.dev/get-started/supported-platform/android | OK |
| F26 | https://docs.maestro.dev/advanced/specify-a-device | 404 |
| F27 | https://docs.maestro.dev/get-started/supported-platform/web-desktop-browser | 404 |
| F28 | https://docs.maestro.dev/maestro-flows/flow-control-and-logic/specify-and-start-devices | OK |
| F29 | https://docs.maestro.dev/get-started/supported-platform/web-browser.md | OK |
| F30 | https://docs.maestro.dev/api-reference/commands/runscript | 404 |
| F31 | https://docs.maestro.dev/api-reference/commands/clearstate | 404 |
| F32 | https://docs.maestro.dev/maestro-flows/javascript/run-and-debug-javascript | OK |
| F33 | https://docs.maestro.dev/llms-full.txt | OK (partial extraction) |
| F34 | https://github.com/mobile-dev-inc/Maestro/releases | OK |
| F35 | https://maestro.dev/pricing | OK |
| F36 | https://docs.maestro.dev/maestro-cli | OK (partial facts) |
| F37 | https://docs.maestro.dev/getting-started/installing-maestro | 404 |
| F38 | https://playwright.dev/docs/test-webserver | OK |
| F39 | https://playwright.dev/docs/api/class-android | OK |
| F40 | https://playwright.dev/docs/browsers | OK |
| F41 | https://wix.github.io/Detox/docs/introduction/getting-started | OK (partial facts) |
| F42 | https://appium.io/docs/en/latest/intro/ | OK (partial facts) |
| F43 | https://docs.expo.dev/develop/unit-testing/ | OK |
| F44 | https://wix.github.io/Detox/docs/guide/expo | 404 |
| F45 | https://developer.android.com/tools/adb | OK (no `adb reverse` text) |
| F46 | https://developer.android.com/studio/run/emulator-networking | OK (overview only) |
| F47 | https://developer.android.com/studio/run/emulator-networking-address | OK |
| F48 | https://github.com/wix/Detox | OK |
| F49 | https://vitest.dev/guide/browser/ | OK |
| F50 | https://github.com/launchql/pgsql-test | 404 |
| F51 | https://carbonhealth.com/blog-post/cleaning-postgresql-db-between-integration-tests-efficiently | 403 |
| F52 | https://code.djangoproject.com/ticket/16622 | OK (no strategy comparison; no fact used) |
| F53 | https://eradman.com/posts/database-test-isolation.html | OK |
| F54 | https://www.postgresql.org/message-id/-5597225702073313349%40unknownmsgid | OK |
| F55 | https://www.postgresql.org/message-id/64B8E470-0719-40F3-81BB-0BF609F2B85E%40gmail.com | OK |
| F56 | https://makandracards.com/makandra/620324-text-column-sizes-mysql/previous?read=true | OK |
| F57 | https://www.postgrespro.com/list/thread-id/2685280 | OK |
| F58 | https://www.postgresql.org/message-id/CAF5w5042yWdX%3DCAVkbmkbWzN_WWtCZRLyUdRCwwvWgPh6udwgA%40mail.gmail.com | OK |
| F59 | https://www.postgresql.org/docs/current/ddl-schemas.html | OK |
| F60 | https://www.postgresql.org/docs/current/sql-savepoint.html | OK |
| F61 | https://pglite.dev/docs/about | OK |
| F62 | https://makerkit.dev/blog/tutorials/unit-testing-prisma-vitest | OK |
| F63 | https://github.com/electric-sql/pglite | OK |
| F64 | https://github.com/oguimbal/pg-mem | OK |
| F65 | https://github.com/leinelissen/embedded-postgres | OK |
| F66 | https://www.atdatabases.org/docs/pg-test | OK |
| F67 | https://vitest.dev/guide/migration | OK |
| F68 | https://vitest.dev/guide/projects | OK |
| F69 | https://node.testcontainers.org/ | OK (partial facts) |
| F70 | https://jestjs.io/docs/29.7/configuration | OK |
| F71 | https://github.com/mobile-dev-inc/Maestro/blob/main/LICENSE | OK |
| F72 | https://playwright.dev/docs/test-parallel | OK |
| F73 | https://docs.maestro.dev/get-started/quickstart.md | OK |
| F74 | https://seo-blog.carbonhealth.com/blog-post/cleaning-postgresql-db-between-integration-tests-efficiently | OK |
| F75 | https://www.postgresql.org/docs/current/runtime-config-resource.html | OK |
| F76 | https://www.postgresql.org/docs/current/release-18.html | OK |
| F77 | https://www.postgresql.org/docs/current/release-15.html | OK |
| F78 | https://playwright.dev/docs/test-coverage | 404 |
| F79 | https://github.com/forwardemail/supertest | OK |
| F80 | https://fastify.dev/docs/latest/Reference/Server/#inject | OK (partial extraction) |

### 11.3 `npm view` metadata lookups (read-only; registry `https://registry.npmjs.org/`, 2026-10-04)

Command form, run once per package with the cache redirected because the sandbox blocks the default npm cache:

`NPM_CONFIG_CACHE="$TMPDIR/npm-cache" npm view <pkg> version license time.modified peerDependencies`

Each run printed repeated stderr lines `ERROR: failed to copy trust settings of system certificate-<n>`. They did not stop the lookup and are not part of the registry data; later batches filtered them with `grep -v`. Output as returned (peer ranges abbreviated only where noted):

| Package | version | license | time.modified | peerDependencies (as returned) |
|---|---|---|---|---|
| vitest | 5.0.3 | MIT | 2026-09-30T11:30:42.795Z | vite ^6.4.0 \|\| ^7.0.0 \|\| ^8.0.0; jsdom *; happy-dom *; @vitest/ui 5.0.3; @types/node ^22.0.0 \|\| >=24.0.0; @edge-runtime/vm *; @opentelemetry/api ^1.9.0; @vitest/coverage-v8 5.0.3; @vitest/browser-preview 5.0.3; @vitest/coverage-istanbul 5.0.3; @vitest/browser-playwright 5.0.3; @vitest/browser-webdriverio ^5.0.0-beta.5 \|\| >=5.0.0 |
| @vitest/coverage-v8 | 5.0.3 | MIT | 2026-09-30T11:29:29.654Z | vitest 5.0.3; @vitest/browser 5.0.3 |
| @vitest/coverage-istanbul | 5.0.3 | MIT | 2026-09-30T11:29:22.735Z | vitest 5.0.3 |
| @vitest/browser | 5.0.3 | MIT | 2026-09-30T11:29:56.037Z | vitest 5.0.3 |
| @vitest/browser-playwright | 5.0.3 | MIT | 2026-09-30T11:29:36.517Z | vitest 5.0.3; playwright * |
| @vitest/ui | 5.0.3 | MIT | 2026-09-30T11:29:49.977Z | vitest 5.0.3 |
| @vitest/browser-webdriverio | 5.0.0 | MIT | 2026-09-08T11:47:06.826Z | vitest ^5.0.0; webdriverio * |
| @vitest/browser-preview | 5.0.3 | MIT | 2026-09-30T11:29:42.516Z | vitest 5.0.3 |
| c8 | 12.0.0 | ISC | 2026-07-16T19:40:22.522Z | monocart-coverage-reports ^2 |
| nyc | 18.0.0 | ISC | 2026-02-25T04:02:38.783Z | none printed |
| fastify | 5.12.5 | MIT | 2026-09-16T10:23:05.222Z | none printed |
| light-my-request | 6.6.0 | BSD-3-Clause | 2026-08-02T10:42:20.054Z | none printed |
| @fastify/websocket | 11.3.3 | MIT | 2026-10-03T14:44:35.209Z | none printed |
| ws | 8.22.0 | MIT | 2026-09-26T15:00:58.022Z | bufferutil ^4.0.1; utf-8-validate >=5.0.2 |
| @types/ws | 8.18.2 | MIT | 2026-09-29T08:07:45.836Z | {} |
| supertest | 7.3.1 | MIT | 2026-10-02T14:51:40.258Z | none printed |
| undici | 8.11.2 | MIT | 2026-09-25T09:45:20.203Z | none printed |
| pg | 8.23.1 | MIT | 2026-09-30T15:39:58.618Z | pg-native >=3.0.1 |
| postgres | 3.4.9 | Unlicense | 2026-04-05T15:18:33.180Z | none printed |
| @electric-sql/pglite | 0.5.8 | Apache-2.0 | 2026-08-26T18:40:09.299Z | none printed |
| @electric-sql/pglite-socket | 0.2.11 | Apache-2.0 | 2026-08-26T18:36:11.025Z | @electric-sql/pglite 0.5.8; pglite-age 0.0.9; pglite-pgtap 0.0.9; pglite-pg_ivm 0.0.9; pglite-pgvector 0.0.9; pglite-pg_uuidv7 0.0.9; pglite-pg_hashids 0.0.9; pglite-pg_textsearch 0.0.10 |
| pg-mem | 3.0.14 | MIT | 2026-02-26T11:33:37.382Z | optional peers @mikro-orm/core, @mikro-orm/postgresql, knex, kysely, pg-promise, slonik, typeorm, postgres ^3.4.4, pg-server ^0.1.5 |
| embedded-postgres | 18.4.0-beta.17 | MIT | 2026-06-05T10:13:13.594Z | none printed |
| @databases/pg-test | 4.0.0 | MIT | 2026-07-06T16:46:19.673Z | none printed |
| testcontainers | 12.2.0 | MIT | 2026-09-28T15:46:04.258Z | none printed |
| @testcontainers/postgresql | 12.2.0 | MIT | 2026-09-28T15:47:58.595Z | none printed |
| @playwright/test | 1.63.0 | Apache-2.0 | 2026-10-03T05:30:56.319Z | none printed |
| playwright | 1.63.0 | Apache-2.0 | 2026-10-03T05:34:00.258Z | none printed |
| cypress | 16.1.1 | MIT | 2026-09-29T18:19:18.559Z | none printed |
| detox | 20.51.4 | MIT | 2026-09-04T19:59:44.175Z | jest 30.x.x \|\| 29.x.x \|\| 28.x.x \|\| ^27.2.5 |
| appium | 3.8.0 | Apache-2.0 | 2026-09-27T07:45:02.347Z | none printed |
| appium-uiautomator2-driver | 8.7.0 | Apache-2.0 | 2026-10-01T18:21:39.060Z | appium ^3.0.0-rc.2 |
| webdriverio | 9.32.0 | MIT | 2026-10-03T06:13:33.788Z | puppeteer-core >=22.x <=24.x |
| msw | 3.0.2 | MIT | 2026-10-03T01:31:45.756Z | vite >=6; graphql >=16; typescript >=5.9.x |
| mock-socket | 9.3.1 | MIT | 2023-09-11T06:13:27.680Z | none printed |
| vitest-websocket-mock | 0.8.0 | MIT | 2026-09-10T12:29:55.544Z | vitest >=5 <6 |
| jest-websocket-mock | 2.5.0 | MIT | 2023-09-10T14:31:24.842Z | none printed |
| @testing-library/react-native | 14.0.1 | MIT | 2026-08-07T04:22:47.110Z | jest >=29.0.0; react >=19.0.0; react-native >=0.78; test-renderer ^1.0.0 |
| jest-expo | 57.0.5 | MIT | 2026-10-03T13:01:40.668Z | expo *; react-native *; react-server-dom-webpack ~19.0.4 \|\| ~19.1.5 \|\| ~19.2.4; @react-native/jest-preset ^0.86.3 |
| jest | 30.5.2 | MIT | 2026-09-18T13:58:07.334Z | node-notifier ^8.0.1 \|\| ^9.0.0 \|\| ^10.0.0 |
| start-server-and-test | 3.0.12 | MIT | 2026-08-01T10:38:13.851Z | none printed |
| wait-on | 9.5.1 | MIT | 2026-10-01T16:35:07.639Z | none printed |

### 11.4 Local read-only commands run (not queries; recorded for the deviation list)

All paths are relative to the workspace root unless they start with `~`.

| Command class | Purpose | Note |
|---|---|---|
| `ls`, `grep -n`, `sed -n`, `find` over the task folder, `package.json` files, config files, `apps/mock-core/test`, `node_modules/vitest/dist/chunks` | Locate row 12 and quote lines | Read-only |
| `node -e` reading `node_modules/<pkg>/package.json` (vitest, jest, jest-expo, light-my-request, @fastify/websocket, @vitest/coverage-*) | Installed versions and licences (H-05, H-07) | One-line Node processes that read files and print; no server, no test run |
| `ls ~/.maestro`, `ls ~/.maestro/lib`, read of `~/.maestro/analytics.json` | Maestro install facts (H-12) | Read-only; the uuid in that file is not reproduced |
| `~/.maestro/bin/maestro --version` | Attempt to print the CLI version | Ran once, printed `Picked up JAVA_TOOL_OPTIONS: -Djava.net.preferIPv4Stack=true` and then `Exception in thread "main" java.lang.ExceptionInInitializerError`. This started a JVM against the host install. Not retried. The version is taken from the jar file name instead (E-01). Reported as a deviation from "no processes" |
| `ls ~/Library/Caches/ms-playwright` | Playwright browser cache listing (H-14) | Read-only |

---

## 12. Collection Log

| Step | Action | Result |
|---|---|---|
| 1 | Read `identification/02_structured.md` row 12, the prior progress file format | Row 12 text matches the task brief |
| 2 | Read test-tool versions with line numbers in the four workspaces and the root | Section 1 |
| 3 | `npm view` for 42 packages | Section 11.3 |
| 4 | Vitest 5 documentation: coverage, test context, globalSetup, setupFiles, pool, parallelism, performance, projects, browser mode, migration | Sections 2, 6 |
| 5 | Fastify and plugin documentation: testing guide, server reference, `@fastify/websocket`, `light-my-request`, `supertest` | Sections 3, 5 |
| 6 | PostgreSQL manual and release notes: templates, `CREATE DATABASE`, schemas, `SAVEPOINT`, `file_copy_method`, releases 15 and 18 | Section 4.1 |
| 7 | Isolation-cost sources: Nirvana, Eradman, Carbon Health mirror, Deel, Mergify, pgsql-general thread, PostgreSQL mailing list 2012, Conroy, dev.to, makandra | Section 4.2 |
| 8 | Alternative engines: PGlite, pg-mem, embedded-postgres; excluded helpers: Testcontainers, `@databases/pg-test` | Sections 4.3, 9 |
| 9 | End-to-end: Maestro docs and host files, Playwright, Detox, Appium, Expo, Android `adb` and emulator networking | Section 7 |
| 10 | Verification pass over the document (below) | See "Self-check" |

### Self-check against the row's verification text

| Check | Result |
|---|---|
| At least 2 isolation strategies with sources and their cost per test run | Database per test from a template (ISO-01 to ISO-04: 40 ms, 30 ms, 400 ms, "a couple hundred milliseconds") and schema per test (ISO-07: about 1000 ms per schema of about 500 definitions); transaction rollback and truncate have suite totals (ISO-10, ISO-12); "not confirmed" is written where a source gives no figure (ISO-08, ISO-09, ISO-11, ALT-01, ALT-03) |
| Every tool has version, licence and a URL with fetch date | Section 8 gives all three per tool; fetch date 2026-10-04 stated in the section header; rows that show only a registry URL (for example Cypress, WebdriverIO, `start-server-and-test`, `wait-on`, `c8`, `nyc`, `undici`, `pg`, `postgres`, `@vitest/ui`, `mock-socket`, `jest-websocket-mock`, `@types/ws`, the Vitest coverage and browser packages) had no documentation page fetched |
| The query log contains no design-book term | Section 11.1 (searches) and 11.2 (URLs) contain only generic technology strings; no project name, product name, user name or design-document text. Section 11.4 is a separate list of local commands and is not part of the query log |

---
*Generated: 2026-10-04*
*Last Updated: 2026-10-04*
