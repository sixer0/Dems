# `src/modules/network-time`

Up: [`src/modules`](../README.md)

## Purpose

Network and time: operations 56 (`getNetworkStatus`) and 57 (`getTimeStatus`). The area has no command.

## Contents

| File or folder | Role |
|---|---|
| [`index.ts`](./index.ts) | Network and time module. |

## Main exports and entry points

Other units import this folder through `index.ts`.

- Exported from `index.ts`: `NETWORK_TIME_MODULE_OPERATIONS`, `networkTimeModule`.
- Types exported from `index.ts`: `NetworkTimeModuleOperation`.

## Dependencies

Module-level imports of the production files (tests excluded).

Inbound (who imports this folder):

- [`app.ts`](../../app.ts): `index.ts`

Outbound (what this folder imports inside `src`):

- [`plugins/permission-guard`](../../plugins/permission-guard/README.md)

- Workspace packages: `@dems/shared`
- npm packages: `fastify`, `fastify-type-provider-zod`

## Tests

| Location | Test files | `*.db.test.ts` |
|---|---|---|
| [`__tests__/`](./__tests__/) | 3 | 1 |

1 test file(s) end in `.db.test.ts`: they need a PostgreSQL test database and run only in a DB window, not in the plain unit run.

## Related decisions

No entry of the 2026-11-05 audit decisions log names this folder or its files. Code comments cite earlier design decisions; see the file headers.
