# `src/modules/sealing`

Up: [`src/modules`](../README.md)

## Purpose

The route of operation 83 (`getSealingProgress`) and the mount of the sealing composition from `src/sealing-host`.

## Contents

| File or folder | Role |
|---|---|
| [`index.ts`](./index.ts) | Sealing module: the route of operation 83 and the mount of the sealing composition. |

## Main exports and entry points

Other units import this folder through `index.ts`.

- Exported from `index.ts`: `SEALING_MODULE_OPERATIONS`, `sealingModule`.

## Dependencies

Module-level imports of the production files (tests excluded).

Inbound (who imports this folder):

- [`app.ts`](../../app.ts): `index.ts`

Outbound (what this folder imports inside `src`):

- [`plugins/error-envelope`](../../plugins/error-envelope/README.md)
- [`plugins/permission-guard`](../../plugins/permission-guard/README.md)
- [`sealing-host`](../../sealing-host/README.md)

- Workspace packages: `@dems/shared`
- npm packages: `fastify`, `fastify-type-provider-zod`, `zod`

## Tests

| Location | Test files | `*.db.test.ts` |
|---|---|---|
| [`__tests__/`](./__tests__/) | 1 | 0 |

None of these tests needs a database window.

## Related decisions

No entry of the 2026-11-05 audit decisions log names this folder or its files. Code comments cite earlier design decisions; see the file headers.
