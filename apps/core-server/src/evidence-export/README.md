# `src/evidence-export`

Up: [`src`](../README.md)

## Purpose

Evidence export: background export jobs, one export package per item (verified source, archive with the decrypted camera files, signed export manifest), the signed download token, sweeps at boot, and the receiver-side verification tool.

## Contents

| File or folder | Role |
|---|---|
| [`boot-sweep.ts`](./boot-sweep.ts) | The boot sweep of interrupted exports. |
| [`composite.ts`](./composite.ts) | The composite of an export: the side-by-side video made on demand. |
| [`control.ts`](./control.ts) | The control of the export jobs of an app: where the composition hands the jobs in and where the routes find them. |
| [`download-token.ts`](./download-token.ts) | The signed download token of a finished export. |
| [`export-manifest.ts`](./export-manifest.ts) | `export/export-manifest.json` and `export/export-manifest.sig` of a v2 export. |
| [`finished.ts`](./finished.ts) | The finished exports of a package, as its `export/` folder holds them. |
| [`host.ts`](./host.ts) | The export jobs on the running Core: what the app itself can give them. |
| [`index.ts`](./index.ts) | Evidence export. |
| [`jobs.ts`](./jobs.ts) | The export jobs: the background side of operation 42 and what operation 87 polls. |
| [`package-export.ts`](./package-export.ts) | One export of a sealed v2 package. |
| [`receiver-cli.ts`](./receiver-cli.ts) | The receiver's command: npm run evidence:verify-export -- <archive.zip> [--sha256 <hex>] [--trust <certificate sha256>]... the process entry is `cli/verify-export.ts` of this workspace; this file... |
| [`receiver-verify.ts`](./receiver-verify.ts) | The receiver's verification of an export. |
| [`secret-sweep.ts`](./secret-sweep.ts) | The secret sweep of an export. |
| [`service.ts`](./service.ts) | What the export routes do. |
| [`stored-trail.ts`](./stored-trail.ts) | The stored rows of an export. |
| [`zip-store.ts`](./zip-store.ts) | The archive of an export. |

## Main exports and entry points

Other units import this folder through `index.ts`.

- Exported from `index.ts`: `exportKindOfBody`, `EXPORT_IN_PROGRESS_TEXT`, `COMPOSITE_ENCODER_GATE`, `COMPOSITE_LICENCE_RECORD`, `GPL_ONLY_ENCODERS`, `compositeEncoderAllowed`, `exportKindsOf`, `selectedCompositeEncoder`, `CompositeEncoder`, `CompositeSource`, `COMPOSITE_ENTRY`, `EXPORT_MANIFEST_FILE`, `EXPORT_MANIFEST_SCHEMA_ID`, `EXPORT_SIGNATURE_FILE`, `EXPORT_SIGNATURE_SCHEMA_ID`, `ExportManifestError`, `ExportManifestSchema`, `ExportSignatureSchema`, `buildExportManifest`, `isSelfContainedExport`, `compositeMarkingHolds`, `computeExportManifestSha256`, `parseExportManifest`, `parseExportSignature`, `ExportManifest`, `ExportSignature`, `EXPORT_FAILED_UNIT_LABEL`, `EXPORT_FAILURE_READ_SOURCE`, `EXPORT_REQUEST_READ_SOURCE`, `EXPORT_SWEEP_BOOT_STEP`, and 81 more.

Command-line entry: `receiver-cli.ts`.

## Dependencies

Module-level imports of the production files (tests excluded).

Inbound (who imports this folder):

- [`evidence-facts`](../evidence-facts/README.md): `index.ts`
- [`modules/evidence`](../modules/evidence/README.md): `index.ts`
- [`modules/evidence-export`](../modules/evidence-export/README.md): `index.ts`
- [`sealing-host`](../sealing-host/README.md): `index.ts`

Outbound (what this folder imports inside `src`):

- [`capture`](../capture/README.md)
- [`capture/fence`](../capture/fence/README.md)
- [`core`](../core/README.md)
- [`engine`](../engine/README.md)
- [`evidence-verify`](../evidence-verify/README.md)
- [`media-stream`](../media-stream/README.md)
- [`modules/transcripts`](../modules/transcripts/README.md)
- [`plugins/authenticate`](../plugins/authenticate/README.md)
- [`plugins/db`](../plugins/db/README.md)
- [`plugins/error-envelope`](../plugins/error-envelope/README.md)
- [`plugins/logger`](../plugins/logger/README.md)
- [`plugins/permission-guard`](../plugins/permission-guard/README.md)
- [`sealing`](../sealing/README.md)

- Workspace packages: `@dems/shared`
- npm packages: `fastify`, `pg`, `yazl`, `zod`
- Node built-ins: `node:crypto`, `node:fs`, `node:os`, `node:path`, `node:stream`

## Tests

| Location | Test files | `*.db.test.ts` |
|---|---|---|
| [`__tests__/`](./__tests__/) | 10 | 3 |

3 test file(s) end in `.db.test.ts`: they need a PostgreSQL test database and run only in a DB window, not in the plain unit run.

Tests elsewhere that import it (2 folders): `src/modules/evidence-export/__tests__`, `src/sealing-host/__tests__/e2e`.

## Related decisions

From the 2026-11-05 audit decisions log:

- D119: `receiver-verify.ts` D5 coverage routed to row 153.
