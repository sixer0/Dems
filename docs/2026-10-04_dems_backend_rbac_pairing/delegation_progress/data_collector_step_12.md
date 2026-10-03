---
task_id: 2026-10-04_dems_backend_rbac_pairing
step: 12
agent: data-collector
status: complete
date: 2026-10-04
---

# Progress: blueprint row 12, test tooling evidence (Tier 2)

## Status

complete

## Files created

| File | Purpose |
|---|---|
| `docs/2026-10-04_dems_backend_rbac_pairing/research/02g_collection_test_tooling.md` | Row 12 deliverable: host test-tool baseline with file:line, Vitest 5 runner mechanics, in-process injection, database isolation (PostgreSQL facts, 13 strategy findings with source-stated costs, 4 alternative engines), WebSocket testing, coverage, end-to-end options (Maestro on the host, Playwright, Detox, Appium, Cypress and WebdriverIO as metadata only), 35-row tool register, excluded register, 16 gaps, query log (12 searches, 80 fetch attempts, 42 npm metadata lookups) |
| `docs/2026-10-04_dems_backend_rbac_pairing/delegation_progress/data_collector_step_12.md` | This file |

No other file was written. `delegation_progress_report.md` and `status_tasks.md` were not touched (parallel run).

## Milestones

1. Read row 12 and the earlier progress file format; fixed scope (injection, isolation, WebSocket, coverage, end-to-end) and the confidentiality rule.
2. Quoted the installed test tools with file:line: Vitest 5.0.3 in shared, core-web, mock-core; Jest 29.7.0 with jest-expo ~57.0.5 and @testing-library/react-native 13.3.3 in mobile; Maestro CLI 2.11.0 on the host.
3. Collected primary documentation: Vitest 5 (coverage, fixtures, globalSetup, setupFiles, pool, parallelism, projects, migration, browser mode), Fastify testing and `inject`, `@fastify/websocket` `injectWS`, the PostgreSQL manual (templates, `CREATE DATABASE` strategies, schemas, savepoints, `file_copy_method`), Maestro, Playwright, Android `adb` and emulator networking.
4. Collected isolation-cost evidence from engineering posts and mailing lists: database from template 40 ms (14 MB template), about 30 ms, about 400 ms, "a couple hundred milliseconds"; schema about 1000 ms per schema of about 500 definitions; transaction versus truncation as suite totals (18 s versus 76 s for about 700 tests, 2012). "Not confirmed" is written where no source gives a figure.
5. Marked excluded: Testcontainers, `@databases/pg-test` (Docker), Maestro Cloud and EAS Workflows (hosted), hosted device farms seen only in search results.
6. Verification applied by this agent before returning: the query-log sections (11.1, 11.2) were extracted and grepped for project and design terms, none found; 12 search rows and 80 fetch rows counted in the file; every tool-register row has a version, licence and URL (registry URL only where no documentation page was fetched).

## Blockers

None. Gaps are in section 10 of the output (16 items). The ones most likely to matter to row 14:

- Per-test cost of transaction rollback and truncate on current PostgreSQL: only 2012 suite totals (PostgreSQL mailing list) and a MySQL series.
- Whether the local Maestro CLI needs an account: not stated on any fetched page. Host evidence only (`~/.maestro/analytics.json`: analytics off, `cachedToken` null).
- Maestro running web and Android in one flow, or two devices inside one flow: not confirmed. Sharding across named emulators is documented.
- Detox states React Native 0.77 to 0.84; the app is 0.86.3 (`apps/mobile/package.json:58`). Expo support page returned 404.
- No coverage package is installed or configured (`@vitest/coverage-v8` 5.0.3 and `@vitest/coverage-istanbul` 5.0.3 exist in the registry).

## Decisions and deviations for the controller to record

1. **One JVM start.** I ran `~/.maestro/bin/maestro --version` once to read the CLI version. It printed `Exception in thread "main" java.lang.ExceptionInInitializerError` and exited; it was not retried. This is a process start on the host, which the row forbids in spirit ("no processes"). The version in the deliverable comes from the jar name `~/.maestro/lib/maestro-cli-2.11.0.jar` plus the GitHub releases page. The controller may treat this as a deviation to log. No file was knowingly written; the sandbox restricts writes outside the allowed paths.
2. **Short Node processes.** `node -e` one-liners read `node_modules/<pkg>/package.json` to print installed versions and licences. No server, no test run.
3. **npm cache redirect.** `npm view` ran as `NPM_CONFIG_CACHE="$TMPDIR/npm-cache" npm view <pkg> version license time.modified peerDependencies`, as instructed. The first two batches also printed repeated stderr lines `ERROR: failed to copy trust settings of system certificate-<n>`; the lookups still returned data. Later batches filtered those lines. No install, no workspace file changed.
4. **WebFetch returns model-written extractions.** All quotation marks in the deliverable reproduce what the extraction returned. Confidence labels H, M, L are on each finding; findings resting on web-search summaries are L.
5. **Pages that failed:** 403 for `npmjs.com/package/pgsql-test` and `carbonhealth.com` (a mirror host, `seo-blog.carbonhealth.com`, was fetched instead); 404 for six Maestro, Detox, Playwright and GitHub URLs. No fact is taken from a failed page.
6. **Old and cross-stack figures are flagged.** The transaction-versus-truncation totals date from 2012 and a Rails-era stack; the MySQL series is not PostgreSQL. They are in the file with those labels and are not comparable with the template-clone figures.
7. **No recommendation made.** Where a source recommends something the file says "the source states". The choice is left to row 14 (TD-12).
8. **Search tool follow-ups.** For S8 and S12 the search tool ran its own follow-up searches; these stayed on the generic topic of the query above them and are noted in the query log.
9. **No Edit tool.** Six small text corrections after the first write (counts, one cost-wording fix, one citation) were applied with a one-off exact-string Python replacement on the deliverable. No other file was changed this way.

## Handoff

Row 14 (data-analyst) consumes `research/02g_collection_test_tooling.md` for TD-12 (test tooling). Rows 6, 7, 8 and 11 overlap on server provisioning, data access, plugin versions and device credential reset; the file points to them where it touches their ground (`embedded-postgres`, `pg`, `@fastify/websocket`, `clearState`).
