# `src/db/store`

Up: [`src/db`](../README.md)

## Purpose

The database side of the slice-to-table mapping: the statements that write and read the rows produced by `../mapping`, the chain lock, the three RBAC tables and row counts. Used by the seed, the reset routine and the engine host.

## Contents

| File or folder | Role |
|---|---|
| [`index.ts`](./index.ts) | The store: the database side of the slice-to-table mapping. |
| [`store.ts`](./store.ts) | The database side of the slice-to-table mapping: the statements that write and read the rows of `../mapping`. |

## Main exports and entry points

Other units import this folder through `index.ts`.

- Exported from `index.ts`: `ALL_TABLES`, `StoreError`, `applyChanges`, `countAllTables`, `insertRows`, `lockAuditChain`, `readRbacRows`, `readStoredRows`, `writeRbacRows`, `writeRows`, `ApplyOptions`, `ChainHead`, `ReadOptions`, `RowExecutor`, `StoreErrorCode`.

## Dependencies

Module-level imports of the production files (tests excluded).

Inbound (who imports this folder):

- [`db/reset`](../reset/README.md): `index.ts`
- [`db/seed`](../seed/README.md): `index.ts`
- [`engine`](../../engine/README.md): `index.ts`

Outbound (what this folder imports inside `src`):

- [`db/mapping`](../mapping/README.md)
- [`db/schema`](../schema/README.md)

- npm packages: `drizzle-orm`

## Tests

| Location | Test files | `*.db.test.ts` |
|---|---|---|
| [`__tests__/`](./__tests__/) | 2 | 1 |

1 test file(s) end in `.db.test.ts`: they need a PostgreSQL test database and run only in a DB window, not in the plain unit run.

Tests elsewhere that import it (4 folders): `src/capture/adapters/__tests__`, `src/db/fixtures`, `src/db/fixtures/__tests__`, `src/db/seed/__tests__`.

## Related decisions

No entry of the 2026-11-05 audit decisions log names this folder or its files. Code comments cite earlier design decisions; see the file headers.
