# `src/modules/transcripts`

Up: [`src/modules`](../README.md)

## Purpose

Transcripts: operations 84, 85 and 86 of the shared registry, and the store of a sealed machine transcript and its signed revisions.

## Contents

| File or folder | Role |
|---|---|
| [`heads.ts`](./heads.ts) | The transcript summaries after a start of the Core. |
| [`index.ts`](./index.ts) | Transcripts module. |
| [`revision-body.ts`](./revision-body.ts) | The canonical body of a transcript revision. |
| [`routes.ts`](./routes.ts) | The routes of the transcript operations: 84 getTranscript get /api/v1/evidence/{id}/transcript EVIDENCE_VIEW 85 createTranscriptRevision post /api/v1/evidence/{id}/transcript/revisions... |
| [`statements.ts`](./statements.ts) | The statements of the sealed-transcript store. |
| [`store.ts`](./store.ts) | The sealed-transcript store: the database side of a sealed machine transcript and of its signed revisions. |

## Main exports and entry points

Other units import this folder through `index.ts`.

- Exported from `index.ts`: `transcriptsModule`, * from `./store`, `TRANSCRIPT_HEADS_BOOT_STEP`, `TRANSCRIPT_HEADS_NOT_READ`, `TRANSCRIPT_HEAD_NOT_PUBLISHED`, `publishRevisionHeads`, `reconcileRevisionLists`, `REVISION_REASON_MAX`, `REVISION_REASON_MIN`, `TRANSCRIPT_REVISION_BODY_SCHEMA_ID`, `changesOfStoredBody`, `revisionBodyOf`, `revisionDigestOf`, `revisionIdOf`, `storableReasonOf`, `RevisionBody`, `RevisionBodyInput`, `RevisionChange`, `REVISION_UNIT_LABEL`, `RevisionFilesCode`, `TRANSCRIPTS_SOURCE`, `TRANSCRIPT_OPERATION_IDS`, `TranscriptReason`, `pageOfRevisions`, `provideRevisionSigner`, `reconciled`, `registerTranscriptRoutes`, `settlementLines`, `RevisionSignerLoader`, `SettlementLine`, and 1 more.

## Dependencies

Module-level imports of the production files (tests excluded).

Inbound (who imports this folder):

- [`app.ts`](../../app.ts): `index.ts`
- [`evidence-export`](../../evidence-export/README.md): `index.ts`
- [`sealing-host`](../../sealing-host/README.md): `index.ts`
- [`sealing/finalize-transcript`](../../sealing/finalize-transcript/README.md): `index.ts`

Outbound (what this folder imports inside `src`):

- [`capture`](../../capture/README.md)
- [`engine`](../../engine/README.md)
- [`evidence-verify`](../../evidence-verify/README.md)
- [`media-stream`](../../media-stream/README.md)
- [`plugins/error-envelope`](../../plugins/error-envelope/README.md)
- [`plugins/logger`](../../plugins/logger/README.md)
- [`plugins/permission-guard`](../../plugins/permission-guard/README.md)
- [`sealing`](../../sealing/README.md)
- [`transcript-package`](../../transcript-package/README.md)

- Workspace packages: `@dems/shared`
- npm packages: `fastify`, `fastify-type-provider-zod`, `pg`, `the folder is missing`, `zod`
- Node built-ins: `node:crypto`

## Tests

| Location | Test files | `*.db.test.ts` |
|---|---|---|
| [`__tests__/`](./__tests__/) | 7 | 2 |

2 test file(s) end in `.db.test.ts`: they need a PostgreSQL test database and run only in a DB window, not in the plain unit run.

Tests elsewhere that import it (1 folders): `src/sealing/__tests__`.

## Related decisions

No entry of the 2026-11-05 audit decisions log names this folder or its files. Code comments cite earlier design decisions; see the file headers.
