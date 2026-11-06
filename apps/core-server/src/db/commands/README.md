# `src/db/commands`

Up: [`src/db`](../README.md)

## Purpose

The command-line database commands `db:create`, `db:migrate` and `db:status`, with what they share: argument parsing, output, exit codes and the owner connection pools.

## Contents

| File or folder | Role |
|---|---|
| [`cli.ts`](./cli.ts) | What the three database commands share: the argument, the output, the exit code and the owner pools. |
| [`create.ts`](./create.ts) | `db:create`: creates a project database when it is absent. |
| [`database-names.ts`](./database-names.ts) | The database names a `db:*` command accepts. |
| [`evidence-store.ts`](./evidence-store.ts) | The evidence store as it stands on disk. |
| [`media-store-root.ts`](./media-store-root.ts) | Where the Core keeps its media, as the database stores it. |
| [`migrate.ts`](./migrate.ts) | `db:migrate`: applies the pending migrations to a project database, as the owner role. |
| [`migrations.ts`](./migrations.ts) | The migration set and its ledger. |
| [`owner-connection.ts`](./owner-connection.ts) | The owner-role connection of the `db:*` commands. |
| [`statements.ts`](./statements.ts) | The one text of `CREATE DATABASE` for an empty project database. |
| [`status.ts`](./status.ts) | `db:status`: prints the state of a project database, as the owner role. |

## Main exports and entry points

There is no `index.ts`; callers import the files directly.

- `cli.ts`: `usage`, `parseDatabaseArgument`, `runCommand`, `readDatabaseFacts`, `isEntryPoint`, `main`.
- `create.ts`: `createDatabaseStatement`, `runCreate`.
- `database-names.ts`: `PROJECT_DATABASES`, `TEST_DATABASE_PATTERN`, `guardTargetDatabase`, `MIGRATE_LOCK_DATABASE`, `MIGRATE_LOCK_HINT`.
- `evidence-store.ts`: `EVIDENCE_STORE_SUBPATH`, `PACKAGE_DIRECTORY_PREFIX`, `PACKAGE_MANIFEST_FILE`, `PACKAGE_V2_MANIFEST_FILE`, `STORE_QUARANTINE_DIRECTORY`, `evidenceStoreRoot`, `evidenceStoreRootOf`, `sessionIdOfPackageDirectory`, `readEvidenceStore`.
- `media-store-root.ts`: `MEDIA_STORE_ROOT_MAX_LENGTH`, `RECORD_MEDIA_STORE_ROOT`, `READ_MEDIA_STORE_ROOT`, `MediaStoreRootError`, `storableMediaStoreRoot`, `recordMediaStoreRoot`, `readMediaStoreRoot`.
- `migrate.ts`: `runMigrate`.
- `migrations.ts`: `MIGRATIONS_FOLDER`, `MIGRATIONS_SCHEMA`, `MIGRATIONS_TABLE`, `INITIAL_MIGRATION_TAGS`, `readMigrationSet`, `readAppliedMigrations`, `compareLedger`, `inspectLedger`, `assertLedgerCurrent`, `readSchemaVersion`, and 1 more.
- `owner-connection.ts`: `OWNER_ROLE`, `APP_ROLE`, `OWNER_FILE_NAME`, `OWNER_FILE_KEYS`, `MAINTENANCE_DATABASE`, `PROVISIONING_COMMAND`, `DbCommandError`, `scrubDriverEnvironment`, `readOwnerConnection`, `createOwnerPool`, and 3 more.
- `statements.ts`: `EMPTY_DATABASE_TEMPLATE`, `DATABASE_ENCODING`, `DATABASE_LOCALE`, `createEmptyDatabaseStatement`.
- `status.ts`: `SCHEMA_TABLE_NAMES`, `AUDIT_TRIGGER_NAMES`, `collectStatus`, `formatStatus`, `runStatus`.

Command-line entry: `cli.ts`.

## Dependencies

Module-level imports of the production files (tests excluded).

Inbound (who imports this folder):

- [`db/reset`](../reset/README.md): `cli.ts`, `database-names.ts`, `evidence-store.ts`, `media-store-root.ts`, `migrations.ts`, `owner-connection.ts`, and 1 more
- [`db/seed`](../seed/README.md): `cli.ts`, `database-names.ts`, `migrations.ts`, `owner-connection.ts`
- [`plugins/db`](../../plugins/db/README.md): `media-store-root.ts`

Outbound (what this folder imports inside `src`):

- [`config.ts`](../../config.ts)
- [`db/schema`](../schema/README.md)
- [`plugins/config`](../../plugins/config/README.md)

- npm packages: `drizzle-orm`, `pg`
- Node built-ins: `node:crypto`, `node:fs`, `node:path`, `node:url`

## Tests

No test folder inside this folder.

Tests elsewhere that import it (5 folders): `src/db/fixtures`, `src/db/fixtures/__tests__`, `src/db/reset/__tests__`, `src/db/seed/__tests__`, `src/modules/demo/__tests__`.

## Related decisions

No entry of the 2026-11-05 audit decisions log names this folder or its files. Code comments cite earlier design decisions; see the file headers.
