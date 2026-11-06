# `src/modules/camera-preview`

Up: [`src/modules`](../README.md)

## Purpose

Registers the three camera-preview routes (operations 112 and 113 and `GET /preview/:token`) and nothing else; what the routes do lives in `src/camera-preview`.

## Contents

| File or folder | Role |
|---|---|
| [`index.ts`](./index.ts) | Camera-preview module: the registration of the three routes, and nothing else. |

## Main exports and entry points

Other units import this folder through `index.ts`.

- Exported from `index.ts`: `cameraPreviewModule`.

## Dependencies

Module-level imports of the production files (tests excluded).

Inbound (who imports this folder):

- [`app.ts`](../../app.ts): `index.ts`

Outbound (what this folder imports inside `src`):

- [`camera-preview`](../../camera-preview/README.md)
- [`plugins/permission-guard`](../../plugins/permission-guard/README.md)

- Workspace packages: `@dems/shared`
- npm packages: `fastify`, `fastify-type-provider-zod`

## Tests

| Location | Test files | `*.db.test.ts` |
|---|---|---|
| [`__tests__/`](./__tests__/) | 1 | 0 |

None of these tests needs a database window.

## Related decisions

No entry of the 2026-11-05 audit decisions log names this folder or its files. Code comments cite earlier design decisions; see the file headers.
