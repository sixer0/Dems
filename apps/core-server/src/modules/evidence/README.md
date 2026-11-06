# `src/modules/evidence`

Up: [`src/modules`](../README.md)

## Purpose

Evidence: operations 39 to 43 of the shared registry (list, get, verify, export and archive an evidence item), with cursors and media references.

## Contents

| File or folder | Role |
|---|---|
| [`cursor.ts`](./cursor.ts) | The cursor of the evidence list. |
| [`export-request.ts`](./export-request.ts) | The body of `exportEvidence`. |
| [`index.ts`](./index.ts) | Evidence module: operations 39 to 43 of the shared registry. |
| [`media.ts`](./media.ts) | The media reference of an evidence item. |
| [`reads.ts`](./reads.ts) | The two reads of the evidence module, from PostgreSQL. |
| [`real-verification.ts`](./real-verification.ts) | The seam of operation 41 to the verification of a real sealed package. |

## Main exports and entry points

Other units import this folder through `index.ts`.

- Exported from `index.ts`: `EVIDENCE_MODULE_OPERATIONS`, `evidenceModule`, `evidenceVerification`, `EvidenceVerificationControl`, `RealEvidenceVerification`.
- Types exported from `index.ts`: `EvidenceModuleOperation`.

## Dependencies

Module-level imports of the production files (tests excluded).

Inbound (who imports this folder):

- [`app.ts`](../../app.ts): `index.ts`
- [`sealing-host`](../../sealing-host/README.md): `index.ts`

Outbound (what this folder imports inside `src`):

- [`capture/fence`](../../capture/fence/README.md)
- [`db/mapping`](../../db/mapping/README.md)
- [`db/schema`](../../db/schema/README.md)
- [`engine`](../../engine/README.md)
- [`evidence-export`](../../evidence-export/README.md)
- [`evidence-facts`](../../evidence-facts/README.md)
- [`plugins/error-envelope`](../../plugins/error-envelope/README.md)
- [`plugins/permission-guard`](../../plugins/permission-guard/README.md)

- Workspace packages: `@dems/shared`
- npm packages: `drizzle-orm`, `fastify`, `fastify-type-provider-zod`, `pg`, `zod`

## Tests

| Location | Test files | `*.db.test.ts` |
|---|---|---|
| [`__tests__/`](./__tests__/) | 12 | 7 |

7 test file(s) end in `.db.test.ts`: they need a PostgreSQL test database and run only in a DB window, not in the plain unit run.

Tests elsewhere that import it (3 folders): `src/evidence-verify/__tests__`, `src/modules/sealing/__tests__`, `src/sealing-host/__tests__`.

## Related decisions

No entry of the 2026-11-05 audit decisions log names this folder or its files. Code comments cite earlier design decisions; see the file headers.
