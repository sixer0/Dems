---
task_id: 2026-10-04_dems_backend_rbac_pairing
row: 7
tier: 2
date: 2026-10-04
agent: data-collector
items_collected: 15 (13 candidates + 2 drivers) plus Node/TypeScript/zod baselines
last_updated: 2026-10-04 01:50
---

# Collection: typed PostgreSQL access layers, migration and seed tooling

## 1. Scope, method and conventions

**Task (row 7, from identification/02_structured.md line 280):** collect evidence on typed PostgreSQL access layers for Node 26.8.2 and TypeScript 6.0.3, with their migration and seed tooling, generic queries only. Per candidate: version, licence, driver, migration model (SQL files or generated), reset and rollback support, type-safety approach, zod 4 interoperability, maintenance signals.

**This document collects. It does not analyse, rank or recommend.** Comparison happens in row 14.

**Host facts used as the reference frame** (from the task brief, plus `package.json` read on the host): Node v26.8.2, npm 11.19.1, TypeScript 6.0.3 pinned, zod 4.6.5 pinned, Fastify 5.12.5 in `apps/mock-core`, ESM.

**Fetch date.** Every source below was fetched on **2026-10-04** (host local date; the GitHub HTTP `Date` header read `Sat, 03 Oct 2026 18:30 GMT`, the same instant). It is abbreviated **FD** in tables. Individual sections repeat the date where a claim is made.

**Verification methods and their limits.**

| Code | Method | Strength | Limit |
|------|--------|----------|-------|
| NPM | `npm view <pkg> ...` against registry.npmjs.org (read-only) | Byte-exact registry metadata | Says what is published, not whether it works |
| GH | `curl` to `api.github.com` (unauthenticated REST, JSON parsed with `jq`) | Byte-exact repository metadata | Rate limited; star and issue counts are point-in-time |
| WF | `WebFetch` of an official page | Primary source | The tool passes the page through a small summarising model. Quotes below are as returned by that tool. Where the tool paraphrased instead of quoting, the text says "fetch-tool paraphrase" |
| WS | `WebSearch` summary | Secondary source only | Used for discovery and for cross-checks, always labelled "secondary" |

No package was installed. Nothing was executed from any candidate. No candidate was tested against Node 26.8.2 or TypeScript 6.0.3 on the host; compatibility facts below are declared metadata (engines, peerDependencies) or documentation statements only.

**npm cache note (environment).** The first `npm view` batch failed with `EPERM` on `~/.npm/_cacache` (root-owned files, an npm bug from an older version; npm's own message suggests a `sudo chown`). That was not changed. The lookups were repeated with the environment variable `NPM_CONFIG_CACHE` pointing at a throw-away directory inside the session scratchpad, so no host state changed. A first retry that passed `--cache` as one quoted word was ignored by npm and failed the same way; it is logged as a failed attempt.

## 2. Baselines (the frame every candidate is measured against)

| Fact | Value | Source (FD 2026-10-04) | Verified by |
|------|-------|------------------------|-------------|
| TypeScript 6.0.3 publish time | 2026-04-16T23:38:27.905Z | `npm view typescript time[6.0.3]` | NPM |
| TypeScript npm dist-tags | latest `7.0.2`, rc `7.0.1-rc`, beta `6.0.0-beta`, next `7.1.0-dev.20261003.1` | `npm view typescript dist-tags` | NPM |
| TypeScript 7.0.2 publish time | 2026-07-08T15:55:18.431Z | `npm view typescript time[7.0.2]` | NPM |
| TypeScript 6.0 release | 2026-03-23; "the last release based on the current JavaScript codebase"; deprecated and slated for removal in 7.0: `--moduleResolution node`, `--baseUrl`, `--esModuleInterop false`, `--target es5`, module `amd`/`umd`/`systemjs`; `types` default now `[]`; `ignoreDeprecations: "6.0"` suppresses the warnings | https://devblogs.microsoft.com/typescript/announcing-typescript-6-0/ | WF |
| zod latest | `4.6.5`, MIT, published 2026-09-13T23:25:14.644Z; dist-tags include canary `4.5.0-canary.20260828T171753` | `npm view zod version license dist-tags`, `time[4.6.5]` | NPM |
| Node.js 26 | Released 2026-05-05; endoflife.date lists it as "upcoming LTS", latest 26.10.0 (2026-09-22), security support to 2029-04-30; Node 24 latest 24.21.0, Node 22 latest 22.23.3. The host runs 26.8.2 | https://endoflife.date/nodejs | WF |
| Node.js 26 LTS date | "enters LTS on 28 October 2026" (secondary) | WebSearch query 4 in the log (inmotionhosting.com, lilting.ch results) | WS (secondary) |
| Why it matters | The brief fixes Node 26.8.2 and TypeScript 6.0.3. TypeScript 6.0.3 is not the npm `latest` tag (7.0.2 is). Docs and `engines` fields below were written against Node LTS lines (20, 22, 24) in several cases | n/a | n/a |

## 3. Candidates

Fifteen items are covered in sections 3.1 to 3.15: ten typed access layers or generators (3.1 to 3.10, with 3.10 holding two parts), three migration-only tools (3.11 to 3.13) and two drivers (3.14, 3.15). Section 4 holds the comparison table.

### 3.1 Drizzle ORM (drizzle-orm, drizzle-kit, drizzle-seed, drizzle-zod)

**Found (versions and licences, NPM, FD 2026-10-04, `registry.npmjs.org/<pkg>`):**

| Package | `latest` tag | Published | Licence | Other tags | Unpacked size |
|---------|--------------|-----------|---------|-----------|---------------|
| drizzle-orm | 0.45.3 | 2026-09-21T10:06:39.969Z | Apache-2.0 | `rc` 1.0.0-rc.4 (2026-06-27T16:10:10.709Z); `beta` 1.0.0-beta.22 (2026-04-16T10:22:48.535Z) | 10,516,772 B |
| drizzle-kit | 0.31.11 | 2026-09-21T10:06:58.727Z | MIT | `rc` 1.0.0-rc.4 (2026-06-27T16:10:11.337Z, MIT) | 10,267,562 B |
| drizzle-seed | 0.3.1 | 2025-01-29T15:32:59.310Z | Apache-2.0 | `beta` 1.0.0-beta.22 | 7,948,591 B |
| drizzle-zod | 0.8.3 | 2025-08-06T08:03:58.355Z | Apache-2.0 | no `deprecated` field returned | 92,553 B |

- **Driver.** Peer dependencies of drizzle-orm 0.45.3 (NPM): `pg >=8`, `postgres >=3`, `@types/pg *` (plus many other drivers; `pg` marked optional in `peerDependenciesMeta`). `engines`: none returned for drizzle-orm 0.45.3 or drizzle-kit. Docs state "Drizzle has native support for PostgreSQL connections with the node-postgres and postgres.js drivers" and the Postgres quickstart installs `pg` (WF https://orm.drizzle.team/docs/get-started/postgresql-new, FD 2026-10-04). npm exports of 0.45.3 include `./node-postgres` and `./postgres-js`.
- **Documentation tracks the release candidate, not the npm `latest` tag.** The quickstart installs `drizzle-orm@rc` and `drizzle-kit@rc`; the zod page installs `drizzle-orm@rc zod`; the migrations page shows a banner "v1.0.0-beta.2" (WF, FD 2026-10-04). npm `latest` is 0.45.3.
- **Migration model: generated SQL files.** `drizzle-kit generate` "will read through your Drizzle schema file(s) and compose a json snapshot", compare it with the previous snapshot, and "Save `migration.sql` and `snapshot.json` in migration folder under current timestamp" (WF https://orm.drizzle.team/docs/drizzle-kit-generate). `generate --custom` "creates empty SQL migration files", with the page's own example `drizzle-kit generate --custom --name=seed-users`, "particularly useful for tasks like inserting seed data". Commands listed (WF https://orm.drizzle.team/docs/kit-overview): `generate`, `migrate`, `push`, `pull`, `studio`, `check` ("race conditions(collisions)"), `up` ("upgrade snapshots of previously generated migrations"), `export`. `push` applies a schema without migration files.
- **Applying.** `drizzle-kit migrate` "Reads through migration folder and read all `.sql` migration files", then applies pending ones and logs them in table `__drizzle_migrations` in schema `drizzle` (both configurable) (WF https://orm.drizzle.team/docs/drizzle-kit-migrate). Runtime application from code: `import { migrate } from 'drizzle-orm/node-postgres/migrator'; await migrate(db);` (WF https://orm.drizzle.team/docs/migrations).
- **Rollback: no down migrations in the official pages read.** The kit-overview command list contains no `down`, `rollback` or `reset`; the fetch tool noted the page "does not mention `down`, `rollback`". A secondary source (WS query 1, results from mintlify.com, makerkit.dev) states "Drizzle Kit doesn't have built-in rollback" and that a reverse migration is written as a new forward file. Status: official statement of absence not found; secondary source consistent.
- **Reset and seed.** `drizzle-seed` is "a TypeScript library that helps you generate deterministic, yet realistic, fake data"; the same seed number "will generate the same sequence of fake data every time"; its `reset` function, for PostgreSQL, "generates `TRUNCATE` statements with the `CASCADE` option" (WF https://orm.drizzle.team/docs/seed-overview). `drizzle-seed` peer: `drizzle-orm >=0.36.4`. No drizzle-kit command that drops and recreates a database is listed.
- **Type-safety approach.** The table schema is written in TypeScript and is the "single source of truth"; types come from `typeof users.$inferSelect` / `$inferInsert` or `InferSelectModel` / `InferInsertModel` (WF https://orm.drizzle.team/docs/goodies).
- **zod 4 interoperability.** Two routes. (a) `drizzle-zod` 0.8.3, peers `zod ^3.25.0 || ^4.0.0` and `drizzle-orm >=0.36.0` (NPM). (b) In the rc line, `drizzle-orm@1.0.0-rc.4` publishes a `./zod` export (npm `exports` map; the 0.45.3 map shows no `./zod`), with peers `zod ^3.25.0 || ^4.0.0`, `valibot >=1.0.0-beta.7`, `arktype >=2.0.0`. Docs: `import { createSelectSchema } from 'drizzle-orm/zod'`; functions `createSelectSchema`, `createInsertSchema`, `createUpdateSchema`, `createSchemaFactory`; the page references `zod/v4` and `z.coerce` (WF https://orm.drizzle.team/docs/zod). Not tested against zod 4.6.5.
- **Maintenance signals (GH, FD 2026-10-04).** `drizzle-team/drizzle-orm`: Apache-2.0, 35,943 stars, 2,102 open issues, last push 2026-10-01T21:26:29Z, not archived. Releases: `0.45.3` (2026-09-21T10:02:25Z), `drizzle-kit@0.31.11` (2026-09-21T10:02:50Z), `v1.0.0-rc.4` prerelease (2026-06-27T16:10:26Z), rc.3 (2026-05-18), rc.2 (2026-05-05), rc.1 (2026-04-30). The GitHub "latest release" endpoint returns `drizzle-kit@0.31.11`.
- **Node 26 / TypeScript 6.0.3.** No `engines` field and no `typescript` peer. No statement about Node 26 or TypeScript 6 found (WS query 6 returned no relevant result). Status: not confirmed.

**Why it matters.** Generated plain SQL is reviewable text and the migration folder is deterministic; the absence of down files and of a built-in reset puts reset work into seed tooling or scripts; the docs and the `latest` tag describe different release lines, so the pinned version determines which feature set applies.

### 3.2 Prisma ORM (v7 stable line and v8 release candidate)

**Found (versions and licences, NPM, FD 2026-10-04):**

| Package | Tag | Version | Published | Licence | Engines / peers |
|---------|-----|---------|-----------|---------|-----------------|
| prisma (CLI) | `latest` | 8.0.0-rc.19 | 2026-09-29T11:25:53.980Z | Apache-2.0 | node `>=22.18.0` |
| prisma (CLI) | `prev` | 7.10.0 | 2026-08-25T12:47:51.307Z | Apache-2.0 | not queried |
| @prisma/client | `latest` | 7.10.0 | 2026-08-25T12:54:34.412Z | Apache-2.0 | node `^20.19 \|\| ^22.12 \|\| >=24.0`; peers `prisma *`, `typescript >=5.4.0`; unpacked 74,458,946 B |
| @prisma/adapter-pg | `latest` | 7.10.0 | 2026-08-25T12:40:21.714Z | Apache-2.0 | depends on `pg ^8.16.3`, `@types/pg ^8.16.0` |

- `npm view @prisma/client@8.0.0-rc.19` returned **E404**; `@prisma/client` tags are `latest` 7.10.0, `prev` 6.19.3, `dev` 8.1.0-dev.7. The prisma CLI package `latest` tag points to the 8.0.0-rc.19 prerelease while `@prisma/client` `latest` is 7.10.0.
- **Release status (WF https://www.prisma.io/docs/orm/release-status):** Prisma ORM 8 is a "release candidate"; "Until the final release, some details of the API may still change"; GA anticipated October 2026; Prisma ORM 7 is the stable, recommended line and receives "bug fixes and security updates for 18 months from the day Prisma ORM 8 reaches general availability". The blog post dated 2026-09-09 (WF https://www.prisma.io/blog/is-prisma-8-ready-for-long-lived-production-apps) says the final release is "four to eight weeks out", that migration commands such as squashing and splitting "haven't shipped yet", "Breaking changes may still occur in release candidates", and that Prisma 7 receives fixes "for the next 12 months". The two pages state different durations (18 months versus 12 months); both are recorded as found.
- **Prisma 7, driver.** "In Prisma ORM v7, `PrismaClient` must be initialized with a driver adapter"; PostgreSQL adapter package `@prisma/adapter-pg` (depends on `pg`) (WF https://www.prisma.io/docs/orm/prisma-migrate/workflows/seeding; NPM).
- **Prisma 7, migration model: SQL files.** `prisma migrate dev --name init` creates `migration.sql` (WF https://www.prisma.io/docs/orm/v7/prisma-migrate/getting-started, page banner "Prisma ORM v7"). CLI reference (WF https://www.prisma.io/docs/orm/v7/reference/prisma-cli-reference): `migrate deploy` "applies all pending migrations, and creates the database if it does not exist", "Does not look for drift"; `migrate dev` uses a shadow database; neither triggers `prisma generate` or seeds in v7.
- **Prisma 7, reset and rollback.** `prisma migrate reset` "Drops the database/schema if possible, or performs a soft reset if the environment does not allow deleting databases/schemas", recreates it and applies all migrations; "In Prisma ORM v7, `migrate reset` no longer runs seed scripts automatically" (same CLI reference). Down migrations: "Prisma Migrate does not natively support down migrations"; documented manual path is `migrate diff` to produce a down SQL file, `prisma db execute --file ./down.sql`, then `prisma migrate resolve --rolled-back [migration-name]`; the page warns data changes are not reverted (WF https://www.prisma.io/docs/orm/prisma-migrate/workflows/generating-down-migrations, "Prisma ORM v7"). `migrate resolve` "only works with failed migrations" per the CLI reference.
- **Prisma 7, seed.** Configured in `prisma.config.ts` under `migrations.seed` (example `"tsx prisma/seed.ts"`); "seeding is only triggered explicitly by running `npx prisma db seed`" (WF seeding page above).
- **Prisma 8, different migration model (docs path without a version prefix serves v8 content).** Flow "Change your contract, plan a migration, review it, apply it": `npx prisma contract emit`, then `npx prisma migration plan --name <name>`; `migrate dev` becomes `migration plan` then `db migrate --advance-ref db`; `migrate deploy` becomes `db migrate`. Migration folders under `migrations/app/` hold `migration.ts` (editable TypeScript), `ops.json`, `migration.json`; "This replaces the SQL files approach of earlier versions". "`migrate reset` no longer exists as a command" (drop and recreate the database, migrate fresh). "Migrations are early ... Planning, editing, applying, and rolling back work today, but there is no squash command and no shadow-database dry run yet". PostgreSQL and MongoDB supported; SQLite experimental; MySQL unsupported (WF https://www.prisma.io/docs/orm/prisma-migrate/getting-started and https://www.prisma.io/docs/orm/prisma-client/queries/crud, FD 2026-10-04). Install and requirements: `npm create prisma@latest -- --provider postgres --no-deploy`, "Node.js 22.18 or newer" (WF https://www.prisma.io/docs/v8/quickstart/postgresql).
- **Type-safety approach.** v7: generated client (the CLI reference refers to `prisma generate`; "TypeScript: 5.4+" in system requirements). v8: `contract.prisma` replaces `schema.prisma`; `contract emit` produces `contract.json` and `contract.d.ts`; results are "typed from" the contract; `db.ts` is committed code "unlike Prisma 7's generated client" (WF pages above; fetch-tool paraphrase for the last point).
- **Supported PostgreSQL versions (v7 page):** 9.6 minimum through 18 (WF https://www.prisma.io/docs/orm/v7/reference/supported-databases).
- **zod 4 interoperability.** No first-party zod integration found in the pages read. Community generators (NPM, FD 2026-10-04): `prisma-zod-generator` 3.3.1, MIT, peer `zod >=3.25.0 <5`, modified 2026-08-21; `zod-prisma-types` 3.3.11, MIT, peers `prisma`/`@prisma/client` up to `^7.x.x` and `zod ^3.25.0 || ^4.0.0`, modified 2026-01-24. Neither is confirmed for Prisma 8.
- **Maintenance signals (GH).** `prisma/prisma` answers 301 to `prisma/orm`; Apache-2.0; 47,689 stars; 2,748 open issues; last push 2026-10-02T17:09:08Z. Latest prerelease tag in the GitHub release list: `v8.0.0-rc.14` (2026-09-30T16:24:39Z), then rc.13, rc.12 (2026-09-24), rc.11, rc.10. The GitHub release numbering (rc.14) and the npm CLI version (rc.19) were not reconciled. The GitHub "latest release" endpoint returns `v0.17.0` (2026-08-04), which does not correspond to either line.
- **Node 26 / TypeScript 6.0.3.** Docs list Node `^20.19.0, ^22.12.0, or ^24.0.0` (WF https://www.prisma.io/docs/orm/reference/system-requirements, "Prisma ORM v7"); npm engines `>=24.0` for `@prisma/client` and `>=22.18.0` for the CLI include 26. A secondary search summary says Prisma tests Active and Maintenance LTS and that Current releases "probably work but are not recommended for production use" (WS query 7). Peer `typescript >=5.4.0` includes 6.0.3. No Node 26 statement found. Status: Node 26 not confirmed.

**Why it matters.** The two Prisma lines have different migration models (SQL files versus TypeScript plus JSON ops), different reset semantics, and different npm packages; v8 is explicitly a release candidate with missing migration commands.

### 3.3 Kysely (kysely, kysely-ctl, kysely-codegen, kysely-postgres-js)

**Found (NPM, FD 2026-10-04):**

| Package | Version | Published | Licence | Engines / peers | Unpacked |
|---------|---------|-----------|---------|-----------------|----------|
| kysely | 0.29.6 (`next` 0.30.0-beta.2) | 2026-09-16T00:59:27.614Z | MIT | node `>=22.0.0` | 1,726,989 B |
| kysely-ctl | 0.21.0 | 2026-05-10T00:26:26.866Z | MIT | node `>=22`; peers `kysely >=0.18.1 <0.30.0`, `kysely-postgres-js ^2 \|\| ^3`, `kysely-neon ^2`, `kysely-prisma-postgres ^0.1`; bin `kysely` | 94,836 B |
| kysely-codegen | 0.20.0 | 2026-02-16T08:46:27.783Z | MIT | node `>=20.0.0`; peers include `kysely >=0.27.0 <1.0.0`, `pg >=8.8.0 <9.0.0` | 387,313 B |
| kysely-postgres-js | 5.0.1 | modified 2026-09-25T09:09:43.750Z (publish time not queried) | MIT | peers `kysely >= 0.29.0 < 1`, `postgres ^3.4.0` | not queried |

- **Driver.** Built-in `PostgresDialect` with the `pg` library and a `Pool`; Kysely "only deals with types in the TypeScript level. The runtime JavaScript types are decided by the underlying third-party driver" (WF https://kysely.dev/docs/getting-started). A postgres.js dialect exists as the separate package `kysely-postgres-js` (NPM).
- **Migration model: TypeScript files, not SQL files.** Migration modules export `up(db: Kysely<any>)` and a corresponding `down`; the `Migrator` with `FileMigrationProvider` provides `migrateToLatest()`, `migrateDown`, `migrateTo`; migrations "use a lock on the database level and parallel calls are executed serially" (WF https://kysely.dev/docs/migrations). The page does not mention SQL-file migrations (fetch-tool paraphrase). The `kysely` package ships the Migrator in library form; the command-line tool is the separate `kysely-ctl`.
- **kysely-ctl (WF https://raw.githubusercontent.com/kysely-org/kysely-ctl/main/README.md).** "the official command-line tool for Kysely"; migrate commands `latest`, `up`, `down`, `rollback`, `list`; "rollback without --all flag is not supported, as Kysely doesn't keep track of migration batches"; seed commands `make`, `run`, `list`; `kysely.config.ts` required (created by `kysely init`). The first-attempted documentation URL https://kysely-org.github.io/kysely-ctl/ returned HTTP 404.
- **Reset.** No reset or drop-and-recreate command found in the kysely-ctl README summary. Status: not confirmed.
- **Type-safety approach.** Hand-written `Database` interface ("This requires a TypeScript `Database` interface, that contains table names as keys and table schema interfaces as values"); minimum TypeScript 5.4 and `strict` mode (WF getting-started). Generated alternative: `kysely-codegen` "Generate Kysely type definitions from your database. That's it."; reads `DATABASE_URL`; PostgreSQL among supported dialects (WF https://github.com/RobinBlomberg/kysely-codegen).
- **zod 4 interoperability.** No first-party zod integration; the kysely-codegen README "makes no mention of Zod" (fetch-tool statement). A secondary search (WS query 3) found no Kysely-with-zod-4 package and describes only the general pattern of validating results with a separately written zod schema. Status: no maintained bridge confirmed.
- **Maintenance signals (GH).** `kysely-org/kysely`: MIT, 14,258 stars, 181 open issues, last push 2026-10-03T18:11:06Z, latest release `v0.29.6` (2026-09-16T01:06:58Z). `kysely-org/kysely-ctl`: MIT, 316 stars, 22 open issues, last push 2026-08-06T01:07:08Z. `RobinBlomberg/kysely-codegen`: MIT, 1,244 stars, 80 open issues, last push 2026-02-16T08:46:43Z. The package has not reached 1.0 (0.x versions).
- **Related fact.** `@mikro-orm/postgresql` 7.2.3 and `@mikro-orm/sql` 7.2.3 declare a dependency on `kysely 0.29.6` (NPM).
- **Node 26 / TypeScript 6.0.3.** Kysely engines `>=22.0.0` include 26; docs minimum TypeScript 5.4; no TypeScript 6 statement found. Status: Node 26 and TS 6.0.3 compatibility not confirmed beyond declared ranges.

**Why it matters.** Types are compile-time only and the query layer does not own schema creation; migration, seed and type generation are three separate packages with their own version ranges (kysely-ctl peer range stops below 0.30).

### 3.4 Knex.js

**Found (NPM, FD 2026-10-04):** `knex` 3.3.0, MIT, published 2026-06-26T14:56:43.597Z, engines node `>=16`, unpacked 941,393 B, dist-tags `latest` 3.3.0, `beta` 0.21.5-next1, `next` 2.5.1. Peer `pg-query-stream ^4.14.0`; `pg` is declared optional in `peerDependenciesMeta`. Dependencies include `pg-connection-string 2.6.2`, `tarn`, `lodash`.

- **Driver.** `client: 'pg'` in `knexfile` (WF https://knexjs.org/guide/migrations.html).
- **Migration model: JavaScript or TypeScript functions.** Files export `up` and `down` using the schema builder; commands `knex migrate:make`, `migrate:latest`, `migrate:rollback` ("reverts the last batch"), `migrate:up`, `migrate:down`; TypeScript migrations via `-x ts` and the knexfile `migrations` object. SQL-file migrations are not described on the page (fetch-tool paraphrase says "Knex does not support raw SQL files for migrations" and that raw SQL can be run inside `up` and `down`; treated here as a paraphrase, not a quote).
- **Rollback and reset.** `migrate:rollback` undoes the most recent batch; `migrate:rollback --all` "reverts all applied migrations"; `migrate:down` undoes the last executed migration (WF same page). A drop-and-recreate reset command is not documented there. Status: not confirmed.
- **Seed.** `knex seed:make seed_name`, `knex seed:run`; "seed files are executed in alphabetical order. Unlike migrations, _every_ seed file will be executed when you run the command"; `--specific` runs named files; default directory `./seeds` (WF same page).
- **Type-safety approach.** "officially supported TypeScript bindings"; table types declared by augmenting `Tables` in `'knex/types/tables'` (`'knex/types/tables.js'` under `node16`/`nodenext`); described as "best-effort": "not all usage patterns can be type-checked and in most such cases we err on the side of flexibility" (WF https://knexjs.org/guide/#typescript).
- **zod 4 interoperability.** Not confirmed: no first-party or maintained bridge found in the pages read.
- **Maintenance signals (GH).** `knex/knex`: MIT, 20,343 stars, 754 open issues, last push 2026-06-26T15:02:12Z, latest release `3.3.0` (2026-06-26T14:55:58Z). No push or release in the three months before the fetch date.
- **Node 26 / TypeScript 6.0.3.** engines `>=16` includes 26. No TypeScript 6 statement. Status: not confirmed beyond declared range.

**Why it matters.** Migration and seed commands ship in the same package as the query builder, while the project itself describes the TypeScript query typing as best-effort.

### 3.5 TypeORM

**Found (NPM, FD 2026-10-04):** `typeorm` 1.1.1, MIT, published 2026-09-01T11:02:28.812Z (package metadata modified 2026-10-03T02:22:34.550Z), engines node `^20.19.0 || ^22.13.0 || >=24.11.0`, unpacked 21,667,474 B; tags `latest` 1.1.1, `beta` 1.0.0-beta.3, `legacy` 0.3.31, `dev` 1.1.1-nightly.20261003. Peers: `pg ^8.5.1` (marked optional), `pg-native`, `pg-query-stream`, `ts-node`, other drivers. Dependencies include `reflect-metadata ^0.2.2`, `tslib`, `yargs`.

- **Driver.** `pg` (peer). The 1.0 release notes list PostgreSQL changes ("ADD VALUE for enum changes") and "Node.js 20+ required"; no minimum TypeScript version stated (WF https://typeorm.io/docs/releases/1.0/release-notes).
- **Migration model: TypeScript classes with raw SQL strings, optionally generated.** "TypeORM is able to automatically generate migration files based on the changes you made to the entities, comparing them with existing database schema on the server" (`typeorm migration:generate -d <datasource> <name>`); generated files are classes implementing `MigrationInterface` with `up(queryRunner)` and `down(queryRunner)` executing SQL through `queryRunner.query()`; file name `{TIMESTAMP}-<name>.ts`; `-o` for JavaScript (CommonJS) and `--esm` for ES modules (WF https://typeorm.io/docs/migrations/generating). The introduction defines a migration as "just a single file with SQL queries" (WF https://typeorm.io/docs/migrations/why).
- **Run and revert.** `typeorm migration:run -d path-to-datasource-config`; "The `migration:run` and `migration:revert` commands only work on `.js` files", so TypeScript needs compilation or the `typeorm-ts-node-commonjs` entry point (WF https://typeorm.io/docs/migrations/executing). `migration:revert`: "This command will execute `down` in the latest executed migration"; "If you need to revert multiple migrations you must call this command multiple times" (WF https://typeorm.io/docs/migrations/reverting).
- **Reset.** A `schema:drop` command was searched for in the fetched pages and was not described there. Status: not confirmed.
- **Seed.** No first-party seeding feature found in the pages read. Status: not confirmed.
- **Type-safety approach.** Decorated entity classes (`@Entity()`, `@PrimaryGeneratedColumn()`, `@Column()`); the fetched page does not state tsconfig decorator requirements, and does not discuss `EntitySchema` (WF https://typeorm.io/docs/entity/entities). Query-builder type strictness: not confirmed from fetched pages.
- **zod 4 interoperability.** Not confirmed: the targeted search (WS query 9) found no TypeORM-specific zod tool.
- **Maintenance signals (GH).** `typeorm/typeorm`: MIT, 36,657 stars, 686 open issues, last push 2026-10-01T19:35:55Z, latest release `1.1.1` (2026-09-01T10:55:04Z). Release notes headline "TypeORM 1.0 is here!".
- **Node 26 / TypeScript 6.0.3.** engines `>=24.11.0` branch includes 26. No TypeScript 6 statement. Status: not confirmed beyond declared range.

**Why it matters.** Generated migrations are TypeScript with embedded SQL strings, and the run and revert commands operate on compiled `.js` files; a revert undoes one migration per invocation.

### 3.6 MikroORM (core, postgresql, migrations, seeder)

**Found (NPM, FD 2026-10-04):** `@mikro-orm/core` 7.2.3 (MIT, published 2026-09-30T12:40:16.231Z, engines node `>= 22.17.0`, unpacked 1,694,704 B); `@mikro-orm/postgresql` 7.2.3 (MIT, depends on `pg 8.23.0`, `kysely 0.29.6`, `@mikro-orm/sql 7.2.3`); `@mikro-orm/migrations` 7.2.3 (MIT); `@mikro-orm/seeder` 7.2.3 (MIT, published 2026-09-30T12:39:59.277Z). tags: `latest-v6` 6.6.17, `next` 7.2.4-dev.6. Peer `@mikro-orm/core` pinned to the exact version `7.2.3` in each package.

- **Driver.** `pg` via `@mikro-orm/postgresql` (NPM dependency list above).
- **Migration model: TypeScript classes, generated from a schema diff, with snapshots.** `Migration` abstract class with `up()` and optionally `down()`; commands `migration:create` ("Create new migration with current schema diff"), `migration:up`, `migration:down` ("Migrate one step down"), `migration:fresh` ("Drop the database and migrate up to the latest version"); "Migrations are by default wrapped in a transaction"; snapshots "should be versioned just like the regular migration files"; raw `.sql` files are not supported (WF https://mikro-orm.io/docs/migrations, "v7.2", "latest: v7.2.3").
- **Seed.** `@mikro-orm/seeder` must be installed and `SeedManager` registered; `npx mikro-orm seeder:run`; `npx mikro-orm migration:fresh --seed` "will drop the database, run all migrations and the DatabaseSeeder class"; `schema:fresh --seed`; entity factories with `definition()` (WF https://mikro-orm.io/docs/seeding).
- **Type-safety approach.** Two entity styles: `defineEntity` ("full TypeScript type inference", with `InferEntity<typeof Book>`) or decorated classes; three metadata providers: default `MetadataProvider` ("Requires explicit type declarations"), `ReflectMetadataProvider` (`reflect-metadata`), `TsMorphMetadataProvider` (`ts-morph`) (WF https://mikro-orm.io/docs/defining-entities).
- **zod 4 interoperability.** No first-party zod integration found. Third party: `mikro-typebox` 1.5.2, Apache-2.0, modified 2026-07-29T02:22:17.915Z, described in a secondary search result as generating validation schemas (including zod) from entities (`npx mikro-typebox generate --target zod`) (WS query 8, secondary; NPM for version and licence). zod 4 support specifically: not confirmed.
- **Maintenance signals (GH).** `mikro-orm/mikro-orm`: MIT, 9,243 stars, 17 open issues, last push 2026-10-02T21:44:01Z, latest release `v7.2.3` (2026-09-30T12:38:10Z).
- **Node 26 / TypeScript 6.0.3.** engines `>= 22.17.0` includes 26. No TypeScript 6 statement. Status: not confirmed beyond declared range.

**Why it matters.** Migration, seed and a drop-and-recreate command (`migration:fresh --seed`) are published as packages of the same project and version, all pinned to the exact core version; the PostgreSQL package depends on Kysely 0.29.6.

### 3.7 Slonik

**Found (NPM, FD 2026-10-04):** `slonik` 49.10.10, npm licence `BSD-3-Clause`, published 2026-09-21T23:15:51.401Z, engines node `>=24`, unpacked 1,017,763 B, single tag `latest`. Dependencies include `zod ^4.3.6`, `@standard-schema/spec ^1.0.0`, `@slonik/pg-driver ^49.10.10`, `@slonik/driver`, `@slonik/sql-tag`, `roarr`, `p-queue ^9.3.0`. `@slonik/pg-driver` 49.10.10 (BSD-3-Clause, engines node `>=24`): peer `zod ^3.25 || ^4`, depends on `pg ^8.22.0`, `pg-types`, `pg-query-stream`.

- **Licence conflict between sources.** npm and the README say BSD-3-Clause; the GitHub API returns `NOASSERTION` for the licence field (GH, https://api.github.com/repos/gajus/slonik).
- **Driver.** `node-postgres` (`pg`) underneath (WF https://github.com/gajus/slonik: "A battle-tested Node.js PostgreSQL client with strict types, detailed logging and assertions").
- **Migration model.** "Migrations are handled through a separate package: `@slonik/migrator`" (WF same page). `@slonik/migrator` 0.12.0, ISC, last modified 2024-05-07T00:31:07.346Z, peer `slonik 27 - 29`, depends on `umzug ^3.1.1` (NPM). The declared peer range does not include 49.x. Migration file format: not confirmed.
- **Reset and rollback.** Not confirmed.
- **Seed.** Not confirmed (no seed tooling found).
- **Type-safety approach.** Runtime validation: `sql.type(zodSchema)` validates query results; Zod and Standard Schema are supported (WF same page).
- **zod 4 interoperability.** First-party. `slonik` depends on `zod ^4.3.6` directly and `@slonik/pg-driver` and `@slonik/driver` accept `zod ^3.25 || ^4` as a peer (NPM). Not tested against zod 4.6.5; the pinned repo version is 4.6.5 and the dependency range `^4.3.6` includes it.
- **Maintenance signals (GH).** `gajus/slonik`: 4,940 stars, 1 open issue, last push 2026-09-21T23:14:41Z; GitHub "latest release" tag `@slonik/test-ssls@49.10.10` (2026-09-21T23:15:17Z).
- **Node 26 / TypeScript 6.0.3.** engines `>=24` includes 26. No TypeScript statement. Status: Node 26 not confirmed beyond declared range.

**Why it matters.** Runtime result validation and zod 4 are part of the core package; the separate migration package declares a peer range (`slonik 27 - 29`) that does not include the current 49.x core.

### 3.8 PgTyped

**Found (NPM, FD 2026-10-04):** `@pgtyped/cli` 2.4.3, MIT, published 2025-03-15T01:13:22.332Z, peer `typescript 3.1 - 5`, engines node `>=14.16`, unpacked 119,007 B. `@pgtyped/runtime` 2.4.2, MIT, published 2025-02-10T00:04:28.223Z, depends on `@pgtyped/parser`, `chalk`, `debug`.

- **Driver.** Not stated on the pages read ("does not include information about ... the pg driver"); `@pgtyped/cli` dependencies list `@pgtyped/wire`, `@pgtyped/query`, `@pgtyped/parser` and no `pg` package (NPM). Status: not confirmed (the project has its own wire-protocol package).
- **Migration model.** None. It is a type generator, not a migration tool; it uses "your running Postgres database as the source of type information" (WF https://raw.githubusercontent.com/adelsz/pgtyped/master/README.md; marketing page https://pgtyped.dev/).
- **Reset, rollback, seed.** Not applicable (no migration or seed feature).
- **Type-safety approach.** "generates TS types for parameters and results of SQL queries of any complexity"; queries are SQL files with `/* @name FindBookById */` annotations or SQL template literals in TypeScript; CLI `npx pgtyped -w -c config`; ESM supported with CommonJS alternatives; separate runtime package `@pgtyped/runtime`.
- **zod 4 interoperability.** Not confirmed (no zod statement; CLI depends on `io-ts`).
- **Maintenance signals (GH).** `adelsz/pgtyped`: MIT, 3,284 stars, 97 open issues, last push 2026-10-02T02:02:35Z (after the last npm publish of 2025-03-15), latest release `v2.4.3` (2025-03-15T01:06:08Z). The documentation URL https://pgtyped.dev/docs/introduction returned HTTP 404.
- **Node 26 / TypeScript 6.0.3.** engines `>=14.16` includes 26. Peer range `typescript 3.1 - 5` does not include 6.0.3.

**Why it matters.** The declared peer range excludes the pinned TypeScript 6.0.3 and the last publish is more than 18 months before the fetch date.

### 3.9 Zapatos

**Found (NPM, FD 2026-10-04):** `zapatos` 6.6.1, MIT, published 2025-09-19T08:50:54.470Z, peers `pg >=7.18.2`, `@types/pg >=7.14.3`, `typescript >=4.1`, unpacked 191,242 B.

- **Licence note.** README: "Released under the MIT licence" (WF https://raw.githubusercontent.com/jawj/zapatos/master/README.md); GitHub API returns `NOASSERTION`.
- **Driver.** `pg` (README and peer).
- **Migration, reset, rollback, seed.** None found; the README summary does not discuss migrations. Not applicable as a feature (type generator).
- **Type-safety approach.** "No abstractions, no distractions: just your database, with type safety"; types generated from a live PostgreSQL database (README; details of the generator output: not confirmed).
- **zod 4 interoperability.** Not confirmed (no zod statement).
- **Maintenance signals (GH).** `jawj/zapatos`: 1,402 stars, 51 open issues, last push 2025-09-19T08:59:31Z (about 12.5 months before the fetch date).
- **Node 26 / TypeScript 6.0.3.** Peer `typescript >=4.1` includes 6.0.3. No `engines` field returned. Status: Node 26 not confirmed.

### 3.10 sqlc with sqlc-gen-typescript

**Found (GH, FD 2026-10-04):** `sqlc-dev/sqlc` v1.31.1 (release 2026-04-22T14:55:41Z), MIT, 18,344 stars, 697 open issues, last push 2026-10-01T12:00:58Z. `sqlc-dev/sqlc-gen-typescript`: release `v0.1.3` (2024-01-02T18:54:45Z), 523 stars, 40 open issues, last push 2024-11-26T06:22:58Z, GitHub licence field `null`.

- **What it is.** "sqlc generates **fully type-safe idiomatic Go code** from SQL." (WF https://docs.sqlc.dev/en/v1.31.1/index.html; the older URL https://docs.sqlc.dev/en/stable/ returned only a redirect page). The page excerpt lists PostgreSQL among supported engines and does not mention TypeScript.
- **TypeScript route.** A separate plugin: "generates TypeScript code from SQL queries and schemas", in "early access" with the caution "Here be dragons! This plugin is still in early access. Expect breaking changes, missing functionality, and sub-optimal output"; drivers `pg` and `postgres` (postgres.js) for PostgreSQL; configured as a WASM plugin in `sqlc.yaml` (WF https://github.com/sqlc-dev/sqlc-gen-typescript). Plugin licence: not confirmed.
- **Migration model.** sqlc is not a migration runner; it parses schema from existing migration files: "atlas, dbmate, golang-migrate, goose, sql-migrate, tern", and "sqlc ignores down migrations when parsing SQL files" (WF https://docs.sqlc.dev/en/v1.31.1/howto/ddl.html). Reset, rollback and seed belong to whichever migration tool is paired; none provided by sqlc. Install route for the binary: not collected (no install performed; not an npm package).
- **Type-safety approach.** Code generation from SQL query files plus schema.
- **zod 4 interoperability.** Not confirmed.
- **Node 26 / TypeScript 6.0.3.** Not confirmed (no statement; the generator runs outside Node).

### 3.11 node-pg-migrate (migration tool)

**Found (NPM, FD 2026-10-04):** 9.0.0, MIT, published 2026-07-17T08:50:59.857Z (metadata modified 2026-09-27), engines node `>=20.11.0`, peers `pg >=4.3.0 <9.0.0`, `@types/pg >=6.0.0 <9.0.0`, unpacked 560,783 B; tags `rc` 8.0.0-rc.6, `next` 9.0.0-alpha.4, `alpha` 10.0.0-alpha.3.

- **Migration model: SQL, JavaScript or TypeScript files.** "Node.js database migration management built exclusively for postgres"; commands `create`, `up`, `down`, `redo`; "Migrations can be written in JavaScript, TypeScript, or SQL"; "automatic inference of down migrations when possible"; README states "Node.js 22 or higher" and "PostgreSQL 14 or higher" (WF https://github.com/salsita/node-pg-migrate). The README requirement (Node 22) differs from npm `engines` (`>=20.11.0`).
- **Reset and seed.** `down` and `redo` documented; a drop-and-recreate reset and a seed feature: not confirmed.
- **Type-safety, zod.** Not applicable: not a query layer (no type-safety or zod feature collected).
- **Maintenance signals (GH).** `salsita/node-pg-migrate`: MIT, 1,487 stars, 33 open issues, last push 2026-10-03T13:41:01Z.

### 3.12 dbmate (migration tool)

**Found (NPM, FD 2026-10-04):** `dbmate` 2.36.0, MIT, published 2026-09-19T00:36:44.813Z, unpacked 44,001 B (the npm package installs the binary; install method listed in README: `npm install --save-dev dbmate`).

- **Migration model: plain SQL files.** "uses plain SQL for writing schema migrations"; each file has `-- migrate:up` and `-- migrate:down` sections; commands `new`, `up` ("create database and run pending migrations"), `migrate`, `rollback` ("revert the most recent migration"), `dump`, `wait`; databases: PostgreSQL, MySQL, MariaDB, SQLite, ClickHouse; for PostgreSQL TLS is required by default so `sslmode=disable` may be needed; reads `DATABASE_URL` and loads `.env` (WF https://raw.githubusercontent.com/amacneil/dbmate/main/README.md).
- **Type-safety, zod, seed.** Not applicable (migration tool). A seed feature: not confirmed.
- **Maintenance signals (GH).** `amacneil/dbmate`: MIT, 7,433 stars, 39 open issues, last push 2026-09-30T04:43:25Z.
- **Relation to sqlc.** The sqlc DDL page lists dbmate among parsable migration formats (section 3.10).

### 3.13 Graphile Migrate (migration tool)

**Found (NPM, FD 2026-10-04):** 1.4.1, MIT, published 2022-12-20T08:37:16.719Z (package metadata modified 2026-09-08T18:51:46.769Z), unpacked 225,190 B; tags `next` 2.0.0-rc.2, `rc` 2.0.0-rc.5.

- **Migration model: SQL files, roll-forward only.** "Opinionated SQL-powered productive roll-forward migration tool for PostgreSQL"; a "current migration" (default `migrations/current.sql`, idempotent) is committed into `migrations/committed/` as versioned SQL files; commands `watch`, `commit`, `migrate`, `reset` ("drops and recreates the database, rerunning all migrations"); no down migrations ("roll-forward only") (WF https://raw.githubusercontent.com/graphile/migrate/main/README.md).
- **Type-safety, zod, seed.** Not applicable (migration tool). Seed feature: not confirmed.
- **Maintenance signals (GH).** `graphile/migrate`: MIT, 835 stars, 30 open issues, last push 2026-09-08T18:49:12Z.

### 3.14 Driver: node-postgres (`pg`)

NPM: `pg` 8.23.1, MIT, published 2026-09-30T15:39:58.489Z, engines node `>= 16.0.0`, peer `pg-native >=3.0.1`, unpacked 102,632 B, tags `latest` 8.23.1, `beta` 8.14.2-alpha.1. Docs: "node-postgres is compatible with node 18.x, 20.x, 22.x, and 24.x" (WF https://node-postgres.com/); the docs list stops at 24.x. GH `brianc/node-postgres`: MIT, 13,218 stars, 540 open issues, last push 2026-10-01T15:52:44Z. Used by: Drizzle (optional peer), Prisma 7 adapter (`pg ^8.16.3`), Kysely, MikroORM (`pg 8.23.0`), Slonik (`pg ^8.22.0`), Knex (optional), TypeORM (optional), Zapatos, node-pg-migrate. TypeScript types come from `@types/pg` for several consumers (peer or dependency declarations above); the node-postgres site excerpt did not state where its types originate.

### 3.15 Driver: postgres.js (`postgres`)

NPM: `postgres` 3.4.9, licence `Unlicense`, published 2026-04-05T15:18:33.078Z (`time[3.4.9]`; package `time.modified` 2026-04-05T15:18:33.180Z), engines node `>=12`, unpacked 299,744 B, bundled types `types/index.d.ts`, tags `latest` 3.4.9, `beta` 3.0.0-rc.3. GH `porsager/postgres`: Unlicense, 8,731 stars, 320 open issues, last push 2026-09-02T08:02:08Z. Used by: Drizzle (`postgres >=3` peer), `kysely-postgres-js` 5.0.1 (peer `postgres ^3.4.0`), `sqlc-gen-typescript` (driver option).

## 4. Comparison table (no empty cell; "not confirmed" marks an unverified fact; FD for every cell 2026-10-04)

Row sources are the sections cited in the first column. Every version is the npm `latest` tag unless the cell says otherwise.

| Candidate (section) | Version | Licence | Driver | Migration model | Reset and rollback | Type-safety approach | zod 4 interoperability | Maintenance signals |
|---|---|---|---|---|---|---|---|---|
| Drizzle ORM + drizzle-kit (3.1) | orm 0.45.3 (latest, 2026-09-21); orm 1.0.0-rc.4 (rc, 2026-06-27); kit 0.31.11 (latest) / 1.0.0-rc.4 | orm Apache-2.0; kit MIT; seed Apache-2.0; drizzle-zod Apache-2.0 | `pg` or `postgres` (postgres.js); both optional peers | Generated SQL files (`migration.sql` + `snapshot.json` per timestamp folder) from a TypeScript schema diff; `generate --custom` for hand-written SQL; runtime `migrate()` from code | Down migrations: none documented (official pages read); secondary sources say none. Reset: `drizzle-seed` `reset()` truncates with CASCADE; no db drop-and-recreate command listed | TypeScript schema is source of truth; `$inferSelect` / `$inferInsert` | `drizzle-zod` 0.8.3 peer `zod ^3.25.0 \|\| ^4.0.0`; rc `drizzle-orm/zod` export, peer zod `^3.25.0 \|\| ^4.0.0`; not tested on 4.6.5 | 35,943 stars; 2,102 open issues; push 2026-10-01; releases 2026-09-21; rc cadence Apr-Jun 2026 |
| Prisma ORM 7 (3.2) | @prisma/client 7.10.0 (2026-08-25); prisma CLI `prev` 7.10.0 | Apache-2.0 | Driver adapter required: `@prisma/adapter-pg` 7.10.0 over `pg` | SQL files (`migration.sql`) via `migrate dev` / `migrate deploy`, schema diff generated | `migrate reset` drops and reapplies, no auto-seed in v7; down migrations not native (manual `migrate diff` + `db execute` + `migrate resolve --rolled-back`); seed via explicit `prisma db seed` | Generated client from schema | No first-party; community `prisma-zod-generator` 3.3.1 (peer zod `>=3.25.0 <5`), `zod-prisma-types` 3.3.11 (peer zod `^3.25.0 \|\| ^4.0.0`, Prisma up to 7) | 47,689 stars; 2,748 open issues; push 2026-10-02; docs: fixes for 18 months (release-status page) or 12 months (blog) after v8 GA |
| Prisma ORM 8 release candidate (3.2) | prisma CLI 8.0.0-rc.19 (npm `latest` tag of the CLI, 2026-09-29); `@prisma/client` has no 8.0.0 version (E404) | Apache-2.0 | not confirmed (the v8 quickstart read does not name the driver or adapter package) | TypeScript `migration.ts` + `ops.json` + `migration.json` from a contract diff (`contract emit`, `migration plan`, `db migrate`) | `migrate reset` removed (drop and recreate, then migrate); rolling back "works today", no squash, no shadow-database dry run | `contract.prisma` to `contract.d.ts`; results "typed from" the contract | not confirmed | RC; GA anticipated Oct 2026; GitHub release list at rc.14 (2026-09-30) vs npm rc.19; blog 2026-09-09: breaking changes may still occur |
| Kysely + kysely-ctl + kysely-codegen (3.3) | kysely 0.29.6 (2026-09-16); ctl 0.21.0 (2026-05-10); codegen 0.20.0 (2026-02-16) | MIT (all three) | `pg` (built-in PostgresDialect); postgres.js via `kysely-postgres-js` 5.0.1 | TypeScript files exporting `up`/`down` run by `Migrator`; SQL files not documented | `migrateDown`, `migrateTo`; ctl: `rollback` only with `--all`; reset command: not confirmed; seed: ctl `seed make/run/list` | Hand-written `Database` interface or types generated from a live DB by kysely-codegen; compile-time only | No first-party; no maintained bridge confirmed | 14,258 stars; 181 open issues; push 2026-10-03; 0.x line; ctl 316 stars, push 2026-08-06; codegen push 2026-02-16 |
| Knex (3.4) | 3.3.0 (2026-06-26) | MIT | `pg` (optional peer; `pg-query-stream` peer) | JavaScript/TypeScript `up`/`down` functions; SQL-file migrations not documented | `migrate:rollback` (last batch), `rollback --all`, `migrate:down`; reset command: not confirmed; seeds `seed:make` / `seed:run` (all files, alphabetical) | `Tables` interface augmentation; project calls TypeScript support "best-effort" | not confirmed | 20,343 stars; 754 open issues; push and release 2026-06-26 |
| TypeORM (3.5) | 1.1.1 (2026-09-01) | MIT | `pg` (optional peer) | TypeScript classes with `up`/`down` using raw SQL via `queryRunner.query`; `migration:generate` from entity diff | `migration:revert` reverts the latest migration per call; `migration:run`/`revert` only work on `.js` files; reset command: not confirmed; seed: not confirmed | Decorated entity classes (`@Entity`, `@Column`); query strictness not confirmed | not confirmed | 36,657 stars; 686 open issues; push 2026-10-01; release 1.1.1 on 2026-09-01 |
| MikroORM (3.6) | core/postgresql/migrations/seeder 7.2.3 (2026-09-30) | MIT | `pg` 8.23.0 via `@mikro-orm/postgresql` (depends on kysely 0.29.6) | TypeScript classes (`Migration`, `up()`, optional `down()`) generated from a schema diff, with snapshots; no `.sql` files | `migration:down` (one step), `migration:fresh` (drop database, migrate), `--seed` option; seeders via `@mikro-orm/seeder` with factories | `defineEntity` with `InferEntity`, or decorated classes; metadata providers (default explicit, reflect-metadata, ts-morph) | No first-party; third-party `mikro-typebox` 1.5.2 (zod target); zod 4 not confirmed | 9,243 stars; 17 open issues; push 2026-10-02; release 2026-09-30 |
| Slonik (3.7) | 49.10.10 (2026-09-21) | BSD-3-Clause (npm, README); GitHub API: NOASSERTION | `pg` via `@slonik/pg-driver` | Separate `@slonik/migrator` 0.12.0 (ISC, 2024-05-07, peer slonik `27 - 29`); file format not confirmed | not confirmed | Runtime result validation with `sql.type(zodSchema)`; Standard Schema supported | First-party: depends on `zod ^4.3.6`; driver peer `zod ^3.25 \|\| ^4` | 4,940 stars; 1 open issue; push and release 2026-09-21 |
| PgTyped (3.8) | cli 2.4.3 (2025-03-15); runtime 2.4.2 (2025-02-10) | MIT | not confirmed (own wire package `@pgtyped/wire`; no `pg` dependency listed) | None (type generator from SQL files or SQL tagged templates against a live database) | Not applicable (no migration feature); seed not applicable | Generated TypeScript types for query params and results from the live schema | not confirmed | 3,284 stars; 97 open issues; push 2026-10-02; last release 2025-03-15; peer typescript `3.1 - 5` |
| Zapatos (3.9) | 6.6.1 (2025-09-19) | MIT (README, npm); GitHub API: NOASSERTION | `pg` | None (type generator) | Not applicable (no migration feature); seed not applicable | Types generated from a live PostgreSQL database | not confirmed | 1,402 stars; 51 open issues; push 2025-09-19 |
| sqlc + sqlc-gen-typescript (3.10) | sqlc v1.31.1 (2026-04-22); plugin v0.1.3 (2024-01-02) | sqlc MIT (GitHub API); plugin: not confirmed (GitHub licence null) | Plugin targets `pg` and `postgres` (postgres.js) | None of its own; reads schema from migration files of atlas, dbmate, golang-migrate, goose, sql-migrate, tern; ignores down sections | Not applicable to sqlc itself (belongs to the paired migration tool); seed not applicable | Code generated from SQL queries and schema; TypeScript plugin "early access" | not confirmed | sqlc: 18,344 stars; 697 open issues; push 2026-10-01. Plugin: 523 stars; push 2024-11-26 |
| node-pg-migrate (3.11) | 9.0.0 (2026-07-17) | MIT | `pg` (peer `>=4.3.0 <9.0.0`) | SQL, JavaScript or TypeScript files; down inferred when possible | `down`, `redo`; reset: not confirmed; seed: not confirmed | Not applicable (not a query layer) | Not applicable (not a query layer) | 1,487 stars; 33 open issues; push 2026-10-03 |
| dbmate (3.12) | 2.36.0 (2026-09-19) | MIT | Standalone CLI (npm package installs the binary); connects through `DATABASE_URL` | Plain SQL files with `-- migrate:up` / `-- migrate:down` | `rollback` (most recent migration); reset: not confirmed; seed: not confirmed | Not applicable (not a query layer) | Not applicable (not a query layer) | 7,433 stars; 39 open issues; push 2026-09-30 |
| Graphile Migrate (3.13) | 1.4.1 (2022-12-20; metadata modified 2026-09-08) | MIT | not confirmed on the pages read | SQL files: `current.sql` committed into `committed/` | No down migrations (roll-forward only); `reset` drops and recreates the database; seed: not confirmed | Not applicable (not a query layer) | Not applicable (not a query layer) | 835 stars; 30 open issues; push 2026-09-08; 2.0.0-rc.5 on `rc` tag |
| pg (3.14), driver | 8.23.1 (2026-09-30) | MIT | itself | Not applicable (driver) | Not applicable (driver) | `@types/pg` for consumers | Not applicable (driver) | 13,218 stars; 540 open issues; push 2026-10-01 |
| postgres.js (3.15), driver | 3.4.9 (2026-04-05) | Unlicense | itself | Not applicable (driver) | Not applicable (driver) | Bundled `types/index.d.ts` | Not applicable (driver) | 8,731 stars; 320 open issues; push 2026-09-02 |

### 4.1 Declared engine and TypeScript statements (as published; none tested)

| Candidate | npm `engines.node` | Docs statement on Node | TypeScript peer or docs minimum | Node 26.8.2 covered by declared range | TypeScript 6.0.3 covered by declared range |
|---|---|---|---|---|---|
| drizzle-orm / drizzle-kit | none returned | not stated | none / not stated | no range declared | no range declared |
| @prisma/client 7.10.0 | `^20.19 \|\| ^22.12 \|\| >=24.0` | `^20.19.0, ^22.12.0, or ^24.0.0` | peer `>=5.4.0` | yes by npm range; docs list stops at 24 | yes by peer range |
| prisma CLI 8.0.0-rc.19 | `>=22.18.0` | "Node.js 22.18 or newer" (v8 quickstart) | not stated | yes | not confirmed |
| kysely 0.29.6 / kysely-ctl 0.21.0 | `>=22.0.0` / `>=22` | not stated | docs minimum 5.4, `strict` mode | yes | not confirmed (docs minimum only) |
| knex 3.3.0 | `>=16` | not stated | not stated | yes | not confirmed |
| typeorm 1.1.1 | `^20.19.0 \|\| ^22.13.0 \|\| >=24.11.0` | "Node.js 20+ required" (1.0 notes) | not stated | yes | not confirmed |
| @mikro-orm/core 7.2.3 | `>= 22.17.0` | not stated | not stated | yes | not confirmed |
| slonik 49.10.10 | `>=24` | not stated | not stated | yes | not confirmed |
| @pgtyped/cli 2.4.3 | `>=14.16` | not stated | peer `3.1 - 5` | yes | no (outside the declared peer range) |
| zapatos 6.6.1 | none returned | not stated | peer `>=4.1` | no range declared | yes by peer range |
| node-pg-migrate 9.0.0 | `>=20.11.0` | README: "Node.js 22 or higher" | not stated | yes | not confirmed |
| pg 8.23.1 | `>= 16.0.0` | docs: 18.x, 20.x, 22.x, 24.x | not stated | yes by npm range; docs list stops at 24 | not confirmed |
| postgres 3.4.9 | `>=12` | not stated | bundled types | yes | not confirmed |

## 5. Gaps and unverified items

- No candidate has a statement naming Node 26 or TypeScript 6.0.3 in any page read; dedicated searches (WS queries 6 and 7) returned nothing relevant for Drizzle and only a secondary summary for Prisma. Where the table says "yes", it means the declared range includes the version, not that anything was run.
- Drizzle: official statement on absence of down migrations not found (secondary sources only); behaviour of the rc line's `drizzle-kit` was read from docs that track the rc; the `latest` tag differs.
- Prisma 8: zod interop, the driver adapter package for v8, the relation between GitHub release numbers (rc.14) and npm (rc.19), and the 18-month versus 12-month support statements are unresolved.
- Kysely: SQL-file migrations not documented (not the same as proven absent); reset command not found; no zod bridge confirmed.
- Knex, TypeORM, Slonik, node-pg-migrate, dbmate: reset command and seed feature not confirmed where the table says so; the Knex "raw SQL files" statement is a fetch-tool paraphrase.
- TypeORM: decorator tsconfig requirements, seeding, zod interop not confirmed.
- Slonik: file format and rollback of `@slonik/migrator`; reset and seed.
- PgTyped: driver (no `pg` dependency listed; the project ships its own wire package).
- sqlc: binary install route (not collected); TypeScript plugin licence.
- Publish times: `kysely-postgres-js`, `@prisma/client` `prev` and several tag publish times were not queried; `time.modified` of a package is not a version publish time and is labelled "modified" where used.
- Counts (stars, open issues) are point-in-time GitHub API values; open-issue counts on GitHub include pull requests.
- No benchmark, install-size-on-disk, or behaviour test was performed; "unpacked size" values are npm `dist.unpackedSize` of the package alone, not its dependency tree.
- Not collected, outside the eight requested attributes or the 15 items: Atlas, Flyway, Effect SQL, ts-sql-query, and ORMs without PostgreSQL support.

## 6. Query log (exact strings and URLs; all queries are generic technology queries)

**Confidentiality statement.** No project name, product name, user name, file content or design-document text was placed in any query or URL. Package names and public vendor URLs only.

**One flag for the controller.** WebSearch query 2 contains the word "contract". It was taken from the vendor's own documentation text that had just been fetched (the Prisma 8 command `prisma contract emit`, section 3.2); it was not taken from any project document. It is recorded here so a reviewer scanning for design-book terms sees the source of the word.

### 6.1 WebSearch queries (exact strings, in order)

| # | Query string |
|---|--------------|
| 1 | `drizzle-kit down migrations rollback not supported` |
| 2 | `Prisma ORM 8 release candidate announcement migrations contract` |
| 3 | `Kysely zod 4 validation query results type-safe schema generation from database` |
| 4 | `Node.js 26 release schedule Current LTS October 2026` |
| 5 | `TypeScript 6.0 release breaking changes deprecations tsconfig` |
| 6 | `drizzle-orm TypeScript 6.0 support issue` |
| 7 | `Prisma TypeScript 6 compatibility Node.js 26 support` |
| 8 | `MikroORM zod schema validation entities standard schema` |
| 9 | `TypeORM zod schema generation entities validation` |

### 6.2 WebFetch URLs (all fetched 2026-10-04)

Drizzle: https://orm.drizzle.team/docs/migrations (fetched twice, different prompts), https://orm.drizzle.team/docs/zod, https://orm.drizzle.team/docs/seed-overview, https://orm.drizzle.team/docs/get-started/postgresql-new, https://orm.drizzle.team/docs/kit-overview, https://orm.drizzle.team/docs/drizzle-kit-generate, https://orm.drizzle.team/docs/drizzle-kit-migrate, https://orm.drizzle.team/docs/goodies

Prisma: https://www.prisma.io/docs/orm/prisma-migrate/workflows/generating-down-migrations, https://www.prisma.io/docs/orm/prisma-migrate/workflows/seeding, https://www.prisma.io/docs/orm/reference/system-requirements, https://www.prisma.io/docs/orm/prisma-migrate/getting-started (fetched twice), https://www.prisma.io/docs/orm/v7/prisma-migrate/getting-started, https://www.prisma.io/docs/orm/v7/reference/supported-databases, https://www.prisma.io/docs/orm/release-status, https://www.prisma.io/blog/is-prisma-8-ready-for-long-lived-production-apps, https://www.prisma.io/docs/orm/prisma-client/queries/crud, https://www.prisma.io/docs/orm/v7/reference/prisma-cli-reference, https://www.prisma.io/docs/v8/quickstart/postgresql, https://www.prisma.io/docs/v8 (returned no usable content for the question)

Kysely: https://kysely.dev/docs/migrations, https://kysely.dev/docs/getting-started, https://kysely-org.github.io/kysely-ctl/ (HTTP 404), https://raw.githubusercontent.com/kysely-org/kysely-ctl/main/README.md, https://github.com/RobinBlomberg/kysely-codegen

Knex: https://knexjs.org/guide/migrations.html (fetched twice), https://knexjs.org/guide/#typescript

TypeORM: https://typeorm.io/docs/migrations/why, https://typeorm.io/docs/migrations/executing, https://typeorm.io/docs/migrations/generating, https://typeorm.io/docs/migrations/reverting, https://typeorm.io/docs/releases/1.0/release-notes, https://typeorm.io/docs/entity/entities

MikroORM: https://mikro-orm.io/docs/migrations, https://mikro-orm.io/docs/seeding, https://mikro-orm.io/docs/defining-entities

Others: https://github.com/gajus/slonik, https://pgtyped.dev/docs/introduction (HTTP 404), https://pgtyped.dev/, https://raw.githubusercontent.com/adelsz/pgtyped/master/README.md, https://raw.githubusercontent.com/jawj/zapatos/master/README.md, https://docs.sqlc.dev/en/stable/ (redirect page only), https://docs.sqlc.dev/en/v1.31.1/index.html, https://docs.sqlc.dev/en/v1.31.1/howto/ddl.html, https://github.com/sqlc-dev/sqlc-gen-typescript, https://github.com/salsita/node-pg-migrate, https://raw.githubusercontent.com/amacneil/dbmate/main/README.md, https://raw.githubusercontent.com/graphile/migrate/main/README.md, https://node-postgres.com/

Baselines: https://endoflife.date/nodejs, https://devblogs.microsoft.com/typescript/announcing-typescript-6-0/

### 6.3 GitHub REST API URLs (curl, unauthenticated, 2026-10-04)

`https://api.github.com/repos/<owner>/<repo>` for: drizzle-team/drizzle-orm, prisma/prisma (first call without `-L` returned `301 Moved Permanently` to `/repositories/192925833`, then repeated with `-L`; result `prisma/orm`), kysely-org/kysely, knex/knex, typeorm/typeorm, mikro-orm/mikro-orm, gajus/slonik, adelsz/pgtyped, jawj/zapatos, sqlc-dev/sqlc, salsita/node-pg-migrate, brianc/node-postgres, porsager/postgres, kysely-org/kysely-ctl, RobinBlomberg/kysely-codegen, sqlc-dev/sqlc-gen-typescript, graphile/migrate, amacneil/dbmate.

`https://api.github.com/repos/<owner>/<repo>/releases/latest` for: drizzle-team/drizzle-orm, prisma/prisma, kysely-org/kysely, typeorm/typeorm, mikro-orm/mikro-orm, knex/knex, gajus/slonik, sqlc-dev/sqlc, adelsz/pgtyped, sqlc-dev/sqlc-gen-typescript.

`https://api.github.com/repos/drizzle-team/drizzle-orm/releases?per_page=6`, `https://api.github.com/repos/prisma/prisma/releases?per_page=5`, `https://api.github.com/rate_limit` (read several times; the unauthenticated limit is 60 per hour and 31 and 53 requests remained at two of the checks).

### 6.4 npm registry lookups (`npm view`, read-only; registry.npmjs.org; 2026-10-04)

Standard field set: `version license time.modified dist.unpackedSize peerDependencies engines dist-tags`. Extra fields (`dependencies`, `exports`, `bin`, `deprecated`, `peerDependenciesMeta`, `time[<version>]`) were requested where the section above quotes them.

Packages written up as candidates, drivers or companions: drizzle-orm, drizzle-kit, drizzle-zod, drizzle-seed, prisma, @prisma/client, @prisma/adapter-pg, prisma-zod-generator, zod-prisma-types, kysely, kysely-codegen, kysely-ctl, kysely-postgres-js, knex, typeorm, @mikro-orm/core, @mikro-orm/postgresql, @mikro-orm/sql, @mikro-orm/migrations, @mikro-orm/seeder, mikro-typebox, slonik, @slonik/migrator, @slonik/pg-driver, @slonik/driver, @pgtyped/cli, @pgtyped/runtime, zapatos, pg, postgres, node-pg-migrate, graphile-migrate, dbmate, typescript, zod.

Packages looked up for metadata only and not written up as candidates: sequelize, objection, @databases/pg, @databases/pg-typed, kanel, kanel-kysely, @ts-safeql/eslint-plugin, @pgkit/client. Metadata as returned (version, licence, `time.modified`): `sequelize` 6.37.8 MIT (2026-06-29T08:59:54.320Z); `objection` 3.1.5 MIT (2024-09-25T11:33:07.568Z, peer `knex >=1.0.1`); `@databases/pg` 6.1.0 MIT (2026-08-19T13:06:57.450Z); `@databases/pg-typed` 5.0.0 MIT (2026-07-06T16:46:25.575Z); `kanel` 4.0.4 MIT (2026-08-24T17:56:13.632Z); `kanel-kysely` 4.0.0 MIT (modified 2026-04-01, time of day not re-read); `@ts-safeql/eslint-plugin` 5.4.1 MIT (2026-06-30T08:59:23.498Z); `@pgkit/client` 0.6.1 Apache-2.0 (2025-08-30T21:19:54.641Z).

Failed attempts logged for completeness: (1) first batch (default cache) failed `EPERM` on `~/.npm/_cacache`, no data; (2) `--cache <dir>` supplied as one word was ignored with a warning and failed identically; (3) a `$C` shell variable did not split in zsh and failed identically. All data above comes from runs made with `NPM_CONFIG_CACHE` set to a scratchpad directory. `npm view @prisma/client@8.0.0-rc.19` returned E404 (a result, not a failure). The `postgres` 3.4.9 values were re-read at the end of the session: `time.modified = '2026-04-05T15:18:33.180Z'`, `time[3.4.9] = '2026-04-05T15:18:33.078Z'`.

---
*Generated: 2026-10-04 01:50*
*Last Updated: 2026-10-04 01:50*
