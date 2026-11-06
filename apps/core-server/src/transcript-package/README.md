# `src/transcript-package`

Up: [`src`](../README.md)

## Purpose

The transcript files of a sealed package as the transcript operations use them: read-only access to the sealed machine transcript and the files of its revisions. `modules/transcripts` reaches the package only through this unit.

## Contents

| File or folder | Role |
|---|---|
| [`index.ts`](./index.ts) | The transcript files of a sealed package, as the transcript operations use them. |

## Main exports and entry points

Other units import this folder through `index.ts`.

- Exported from `index.ts`: `TRANSCRIPT_FILE_MAX_BYTES`, `sha256HexOf`, `readSealedTranscriptBytes`, `SEALED_MANIFEST_MAX_BYTES`, `readSealedManifestTranscript`, `readRevisionList`, `writeRevisionList`, `STAGED_REVISIONS_SUFFIX`, `stageRevisionList`, `promoteStagedRevisionList`, `readStagedRevisionRecords`, `settleRevisionFiles`, `withRevisionLock`, `retainCertificate`.
- Types exported from `index.ts`: `RevisionListInput`, `StoredRevisionFacts`, `StagedSettlement`, `RevisionFilesSettlement`.

## Dependencies

Module-level imports of the production files (tests excluded).

Inbound (who imports this folder):

- [`modules/transcripts`](../modules/transcripts/README.md): `index.ts`

Outbound: imports nothing else inside `src`.

- Workspace packages: `@dems/shared`
- Node built-ins: `node:crypto`, `node:fs`, `node:path`

## Tests

No test folder inside this folder.

## Related decisions

No entry of the 2026-11-05 audit decisions log names this folder or its files. Code comments cite earlier design decisions; see the file headers.
