# `src/modules/transcript-chunks`

Up: [`src/modules`](../README.md)

## Purpose

The `transcript_chunks` store: the database side of the transcriber's chunk checkpoints, offered as the three-member port (`insertMissing`, `update`, `read`) the transcriber uses.

## Contents

| File or folder | Role |
|---|---|
| [`attempts.ts`](./attempts.ts) | Rows are attempts, chunks are audio ranges. |
| [`index.ts`](./index.ts) | The `transcript_chunks` store: the database side of the transcript checkpoints. |
| [`statements.ts`](./statements.ts) | The statements of the `transcript_chunks` store. |

## Main exports and entry points

Other units import this folder through `index.ts`.

- Exported from `index.ts`: `TranscriptChunkStoreError`, `createTranscriptChunkStore`, `failedChunkCount`, `summariseChunkAttempts`, `ChunkAttempt`, `ChunkAttemptSummary`, `ChunkOutcome`.
- Types exported from `index.ts`: `TranscriptChunk`, `TranscriptChunkPatch`, `TranscriptChunkStoreErrorCode`, `TranscriptChunkStore`.

## Dependencies

Module-level imports of the production files (tests excluded).

Inbound (who imports this folder):

- [`sealing-host`](../../sealing-host/README.md): `index.ts`
- [`sealing/finalize-transcript`](../../sealing/finalize-transcript/README.md): `index.ts`
- [`transcription`](../../transcription/README.md): `index.ts`

Outbound: imports nothing else inside `src`.

- npm packages: `pg`

## Tests

| Location | Test files | `*.db.test.ts` |
|---|---|---|
| [`__tests__/`](./__tests__/) | 2 | 1 |

1 test file(s) end in `.db.test.ts`: they need a PostgreSQL test database and run only in a DB window, not in the plain unit run.

Tests elsewhere that import it (1 folders): `src/sealing/__tests__`.

## Related decisions

No entry of the 2026-11-05 audit decisions log names this folder or its files. Code comments cite earlier design decisions; see the file headers.
