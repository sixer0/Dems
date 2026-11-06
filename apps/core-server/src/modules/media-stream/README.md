# `src/modules/media-stream`

Up: [`src/modules`](../README.md)

## Purpose

Registers the two media routes, operation 88 (`createEvidenceMediaSession`) and `GET /media/:token`, and nothing else. The work is in `src/media-stream`.

## Contents

| File or folder | Role |
|---|---|
| [`index.ts`](./index.ts) | Media-stream module: the registration of the two media routes, and nothing else. |

## Main exports and entry points

Other units import this folder through `index.ts`.

- Exported from `index.ts`: `mediaStreamModule`.

## Dependencies

Module-level imports of the production files (tests excluded).

Inbound (who imports this folder):

- [`app.ts`](../../app.ts): `index.ts`

Outbound (what this folder imports inside `src`):

- [`media-stream`](../../media-stream/README.md)
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
