# `src/modules/evidence-export`

Up: [`src/modules`](../README.md)

## Purpose

Registers the two evidence-export routes: operation 87 (`getEvidenceExportJob`) and the download route `GET /exports/:token`. The work itself is in `src/evidence-export`.

## Contents

| File or folder | Role |
|---|---|
| [`index.ts`](./index.ts) | Evidence-export module: the registration of two routes. |

## Main exports and entry points

Other units import this folder through `index.ts`.

- Exported from `index.ts`: `EVIDENCE_EXPORT_MODULE_OPERATIONS`, `evidenceExportModule`.
- Types exported from `index.ts`: `EvidenceExportModuleOperation`.

## Dependencies

Module-level imports of the production files (tests excluded).

Inbound (who imports this folder):

- [`app.ts`](../../app.ts): `index.ts`

Outbound (what this folder imports inside `src`):

- [`evidence-export`](../../evidence-export/README.md)
- [`plugins/permission-guard`](../../plugins/permission-guard/README.md)

- Workspace packages: `@dems/shared`
- npm packages: `fastify`, `fastify-type-provider-zod`, `zod`

## Tests

| Location | Test files | `*.db.test.ts` |
|---|---|---|
| [`__tests__/`](./__tests__/) | 2 | 0 |

None of these tests needs a database window.

## Related decisions

No entry of the 2026-11-05 audit decisions log names this folder or its files. Code comments cite earlier design decisions; see the file headers.
