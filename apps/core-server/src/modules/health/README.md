# `src/modules/health`

Up: [`src/modules`](../README.md)

## Purpose

The health operation `GET /api/v1/health`: liveness plus readiness. It answers 200 while the process answers and reports in `ready` what is usable, including whether the database answers.

## Contents

| File or folder | Role |
|---|---|
| [`index.ts`](./index.ts) | Health module. |

## Main exports and entry points

Other units import this folder through `index.ts`.

- Exported from `index.ts`: `HEALTH_OPERATION_ID`, `healthModule`.
- Types exported from `index.ts`: `CoreServerHealth`.

## Dependencies

Module-level imports of the production files (tests excluded).

Inbound (who imports this folder):

- [`app.ts`](../../app.ts): `index.ts`

Outbound (what this folder imports inside `src`):

- [`config.ts`](../../config.ts)
- [`plugins/permission-guard`](../../plugins/permission-guard/README.md)
- [`plugins/readiness`](../../plugins/readiness/README.md)
- [`version.ts`](../../version.ts)

- Workspace packages: `@dems/shared`
- npm packages: `fastify`, `fastify-type-provider-zod`

## Tests

| Location | Test files | `*.db.test.ts` |
|---|---|---|
| [`__tests__/`](./__tests__/) | 1 | 0 |

None of these tests needs a database window.

## Related decisions

No entry of the 2026-11-05 audit decisions log names this folder or its files. Code comments cite earlier design decisions; see the file headers.
