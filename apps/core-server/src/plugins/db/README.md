# `src/plugins/db`

Up: [`src/plugins`](../README.md)

## Purpose

The database pool plugin: `app.db` holds the one lazy pool of the runtime role. Creating it opens no connection; the first query connects.

## Contents

| File or folder | Role |
|---|---|
| [`index.ts`](./index.ts) | Database pool plugin. |

## Main exports and entry points

Other units import this folder through `index.ts`.

- Exported from `index.ts`: `DATABASE_TIMEOUT_MS`, `PROBE_REUSE_MS`, `POOL_MAX_CONNECTIONS`, `BOOT_STEP_DATABASE_ANSWERS`, `RUNTIME_SEARCH_PATH`, `RUNTIME_CONNECTION_OPTIONS`, `SEARCH_PATH_QUESTION`, `SEARCH_PATH_NOT_PINNED`, `BOOT_STEP_MEDIA_STORE_ROOT`, `MEDIA_STORE_ROOT_NOT_RECORDED`, `DatabaseBootError`, `createRuntimePool`, `removeDriverEnvironment`, `dbPlugin`.
- Types exported from `index.ts`: `ReadContext`, `PoolFactory`, `Database`, `DatabasePluginOptions`.

## Dependencies

Module-level imports of the production files (tests excluded).

Inbound (who imports this folder):

- [`app.ts`](../../app.ts): `index.ts`
- [`core`](../../core/README.md): `index.ts`
- [`evidence-export`](../../evidence-export/README.md): `index.ts`
- [`index.ts`](../../index.ts): `index.ts`
- [`modules/identity`](../../modules/identity/README.md): `index.ts`
- [`modules/pairing`](../../modules/pairing/README.md): `index.ts`

Outbound (what this folder imports inside `src`):

- [`config.ts`](../../config.ts)
- [`db/commands`](../../db/commands/README.md)
- [`plugins/error-envelope`](../error-envelope/README.md)
- [`plugins/logger`](../logger/README.md)

- npm packages: `answers`, `fastify`, `pg`

## Tests

| Location | Test files | `*.db.test.ts` |
|---|---|---|
| [`__tests__/`](./__tests__/) | 4 | 1 |

1 test file(s) end in `.db.test.ts`: they need a PostgreSQL test database and run only in a DB window, not in the plain unit run.

Tests elsewhere that import it (9 folders): `src/core/__tests__`, `src/db/reset/__tests__`, `src/engine/__tests__`, `src/modules/admin/__tests__`, `src/modules/demo/__tests__`, `src/modules/identity/__tests__`, `src/modules/identity/biometric/__tests__`, `src/modules/pairing/__tests__`, and more.

## Related decisions

No entry of the 2026-11-05 audit decisions log names this folder or its files. Code comments cite earlier design decisions; see the file headers.
