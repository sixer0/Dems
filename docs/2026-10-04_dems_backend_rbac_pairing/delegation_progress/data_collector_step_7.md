# data-collector, blueprint row 7 (FIRM): typed PostgreSQL access layers

- Status: complete
- Date: 2026-10-04
- Output: `research/02b_collection_data_access.md` (Tier 2, 373 lines)
- Progress file (this): `delegation_progress/data_collector_step_7.md`

## Milestones

1. Read row 7 (`identification/02_structured.md` line 280) and the host reference frame (`package.json`: Node >=26.8.2 <27, npm 11.19.1, TypeScript 6.0.3, zod 4.6.5, Fastify 5.12.5).
2. `npm view` metadata for 43 packages, GitHub REST metadata for 18 repositories plus releases, 54 official-page fetch calls (50 returned usable content; 4 did not: two HTTP 404, one redirect-only page, one page with no usable content), 9 generic web searches.
3. Output written; both tables checked mechanically (no empty cell; 9-column and 6-column row counts consistent).

## Coverage

13 candidates plus 2 drivers: Drizzle ORM (+kit, seed, zod), Prisma ORM (v7 stable and v8 release candidate), Kysely (+ctl, codegen), Knex, TypeORM, MikroORM, Slonik, PgTyped, Zapatos, sqlc (+sqlc-gen-typescript), node-pg-migrate, dbmate, Graphile Migrate; drivers `pg` and `postgres.js`. Baselines recorded for Node 26, TypeScript 6.0.x and 7.x, zod.

## Verification applied by the collector

| Check | Result |
|-------|--------|
| At least 4 candidates each with URL and fetch date for version, licence, migration model | 13 candidates, each with sources and FD 2026-10-04 |
| Comparison table has no empty cell | Scripted check: 0 bad rows in the 9-column table and the 6-column engine table |
| Query log contains no design-book term | 9 exact search strings plus all URLs logged. One word flagged in the document: query 2 contains "contract", taken from the vendor's own docs text (`prisma contract emit`) fetched immediately before |
| No emoji or non-ASCII in the output | grep scan clean |

## Blockers and environment notes for the controller (decisions are the controller's)

- The npm cache `~/.npm/_cacache` holds root-owned files, so default `npm view` fails with `EPERM`. Not changed. Lookups were made with `NPM_CONFIG_CACHE` pointing at the session scratchpad. Anything later that runs a real `npm install` on this host will hit the same `EPERM` unless the cache is repaired or redirected (npm's own message suggests `sudo chown -R 501:20 ~/.npm`; I did not run it).
- `Edit` was unavailable in this session; one correction pass on my own output file was applied by an exact-match Python replacement (each replacement asserted a single match).
- The WebFetch tool summarises pages through a small model. The document marks fetch-tool paraphrases separately from quotes.

## Findings the controller may want to see first (facts only, no recommendation)

- The `latest` npm tag and the vendor documentation describe different release lines for two candidates: drizzle-orm (`latest` 0.45.3; docs install `@rc`, rc 1.0.0-rc.4) and Prisma (`prisma` CLI `latest` is 8.0.0-rc.19, `@prisma/client` `latest` is 7.10.0, and `@prisma/client@8.0.0-rc.19` returns E404). Prisma 8 changes the migration model (TypeScript plus JSON ops, no `migrate reset`).
- TypeScript 6.0.3 is not the npm `latest` (7.0.2). `@pgtyped/cli` declares `typescript 3.1 - 5`, which excludes 6.0.3.
- No candidate publishes a statement naming Node 26 or TypeScript 6.0.3; only declared `engines` and peer ranges were collected, nothing was run.
- Slonik 49.10.10 depends on `zod ^4.3.6`; its migration package `@slonik/migrator` 0.12.0 declares peer `slonik 27 - 29`.
- Licence differences between sources: Slonik and Zapatos (npm and README name BSD-3-Clause and MIT; the GitHub API returns NOASSERTION); sqlc-gen-typescript (GitHub licence null).

## Decisions for the controller to record

None required for this row. Open items for row 14 are listed in section 5 of the output (Gaps and unverified items).
