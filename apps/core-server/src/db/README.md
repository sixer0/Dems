# `src/db`

Up: [`src`](../README.md)

## Purpose

Everything about the Core's PostgreSQL database: the typed Drizzle schema, the SQL migrations, the database commands (create, migrate, status), the pure slice-to-table mapping, the store that writes it, the seed and the reset routine.

## Contents

| File or folder | Role |
|---|---|
| [`commands/`](./commands/README.md) | The command-line database commands `db:create`, `db:migrate` and `db:status`, with what they share: argument parsing, output, exit codes and the owner connection pools. See its README. |
| [`fixtures/`](./fixtures/) | The bulk fixture for volume tests (test databases only); test support, so it has no README of its own. |
| [`mapping/`](./mapping/README.md) | The one slice-to-table mapping, in both directions: the durable engine slices to table rows (`toRows`), rows back to slices (`fromRows`), and the row changes between two states (`diffSlices`). See its README. |
| [`migrations/`](./migrations/README.md) | The SQL migrations of the Core database, applied in numeric order by `db:migrate`, with the Drizzle journal and snapshots in `meta/`. See its README. |
| [`reset/`](./reset/README.md) | The reset and carry-over routine: steps R-0 to R-9 that rebuild a database while keeping a fixed set of tables, with a guard that refuses the reset when real sealed evidence exists in the database or on disk. See its README. |
| [`schema/`](./schema/README.md) | The typed Drizzle schema of the Core database (tables in schema `public`), grouped by area: RBAC, identity, pairing, audit, sessions, recording, evidence, transcripts, capture, STT and installation. See its README. |
| [`seed/`](./seed/README.md) | The seed program `db:seed`: the shared demonstration dataset as of one instant, the factory seed (vendor identities and the unit's own configuration only), and the demo-package helpers. See its README. |
| [`store/`](./store/README.md) | The database side of the slice-to-table mapping: the statements that write and read the rows produced by `../mapping`, the chain lock, the three RBAC tables and row counts. See its README. |

## Main exports and entry points

No files of its own; see the subfolders.

## Dependencies

Module-level imports of the production files (tests excluded).

Inbound (who imports this folder):

- [`core`](../core/README.md): `mapping/index.ts`, `schema/boot-checks.ts`, `schema/index.ts`
- [`engine`](../engine/README.md): `mapping/index.ts`, `schema/index.ts`, `store/index.ts`
- [`modules/capture-config`](../modules/capture-config/README.md): `mapping/index.ts`
- [`modules/capture-discovery`](../modules/capture-discovery/README.md): `mapping/index.ts`
- [`modules/demo`](../modules/demo/README.md): `mapping/index.ts`, `reset/index.ts`
- [`modules/evidence`](../modules/evidence/README.md): `mapping/index.ts`, `schema/index.ts`
- [`modules/identity`](../modules/identity/README.md): `schema/index.ts`
- [`modules/security-audit`](../modules/security-audit/README.md): `mapping/index.ts`, `schema/boot-checks.ts`, `schema/index.ts`
- [`modules/sessions`](../modules/sessions/README.md): `mapping/index.ts`, `schema/index.ts`
- [`plugins/db`](../plugins/db/README.md): `commands/media-store-root.ts`
- [`realtime`](../realtime/README.md): `mapping/index.ts`

Outbound (what this folder imports inside `src`):

- [`capture/boot`](../capture/boot/README.md)
- [`capture/fence`](../capture/fence/README.md)
- [`config.ts`](../config.ts)
- [`evidence-verify`](../evidence-verify/README.md)
- [`modules/identity`](../modules/identity/README.md)
- [`plugins/config`](../plugins/config/README.md)
- [`sealing-host`](../sealing-host/README.md)

- Workspace packages: `@dems/shared`
- npm packages: `drizzle-orm`, `pg`
- Node built-ins: `node:child_process`, `node:crypto`, `node:fs`, `node:path`, `node:perf_hooks`, `node:url`, `node:util`

## Tests

| Location | Test files | `*.db.test.ts` |
|---|---|---|
| [`fixtures/__tests__/`](./fixtures/__tests__/) | 6 | 1 |
| [`mapping/__tests__/`](./mapping/__tests__/) | 6 | 1 |
| [`reset/__tests__/`](./reset/__tests__/) | 21 | 9 |
| [`seed/__tests__/`](./seed/__tests__/) | 8 | 3 |
| [`store/__tests__/`](./store/__tests__/) | 2 | 1 |

15 test file(s) end in `.db.test.ts`: they need a PostgreSQL test database and run only in a DB window, not in the plain unit run.

Tests elsewhere that import it (26 folders): `src/capture/adapters/__tests__`, `src/core/__tests__`, `src/engine/__tests__`, `src/lcd`, `src/modules/admin/__tests__`, `src/modules/capture-config/__tests__`, `src/modules/capture-config/installation-acceptance/__tests__`, `src/modules/capture-discovery/connect/__tests__`, and more.

## Related decisions

No entry of the 2026-11-05 audit decisions log names this folder or its files. Code comments cite earlier design decisions; see the file headers.
