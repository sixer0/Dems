# `src/sealing/finalize-transcript`

Up: [`src/sealing`](../README.md)

## Purpose

The `FINALIZE_TRANSCRIPT` sealing step: its bounds (sealing waits for the transcript, but not for ever), the transcript document and files it writes, and the commit of the step.

## Contents

| File or folder | Role |
|---|---|
| [`bounds.ts`](./bounds.ts) | The bounds of `FINALIZE_TRANSCRIPT`. |
| [`commit.ts`](./commit.ts) | Committing a consumed transcript with its item, and its summary for the evidence slice. |
| [`contract.ts`](./contract.ts) | The contract of the sealing step `FINALIZE_TRANSCRIPT`. |
| [`document.ts`](./document.ts) | The core's own reading of the machine transcript `dems.transcript/1`. |
| [`files.ts`](./files.ts) | The file reader of `FINALIZE_TRANSCRIPT` on the real file system: reads one transcript file whole, for hashing. |
| [`handler.ts`](./handler.ts) | The handler of `FINALIZE_TRANSCRIPT`. |

## Main exports and entry points

There is no `index.ts`; callers import the files directly.

- `bounds.ts`: `FINALIZE_TRANSCRIPT_CLOSE_OUT_ATTEMPTS`, `FINALIZE_TRANSCRIPT_CLOSE_OUT_ATTEMPTS_MAX`, `closeOutAttemptsOf`, `FINALIZE_TRANSCRIPT_LIMITS`, `waitLimitOf`, `limitsFault`, `systemStepTimer`, `CLOSE_OUT_CHUNK_CODE`, `withinBound`.
- `commit.ts`: `commitSealedTranscript`, `evidenceTranscriptSummary`, `sealInputWithTranscriptSummary`.
- `contract.ts`: `FINALIZE_TRANSCRIPT_STEP`, `FinalizeTranscriptFailure`, `FinalizeTranscriptError`.
- `document.ts`: `TRANSCRIPT_DOC_VERSION`, `SPEAKER_LABELS_UNAVAILABLE_FLAG`, `SealedTranscriptDocumentSchema`, `readSealedTranscriptDocument`, `uncommittedSegments`.
- `files.ts`: `createTranscriptFileReader`.
- `handler.ts`: `FINALIZE_TRANSCRIPT_CHECKPOINT_VERSION`, `finalizeTranscript`.

## Dependencies

Module-level imports of the production files (tests excluded).

Inbound (who imports this folder):

- [`sealing`](../README.md): `bounds.ts`, `commit.ts`, `contract.ts`, `document.ts`, `files.ts`, `handler.ts`
- [`sealing/pipeline`](../pipeline/README.md): `bounds.ts`, `contract.ts`

Outbound (what this folder imports inside `src`):

- [`modules/transcript-chunks`](../../modules/transcript-chunks/README.md)
- [`modules/transcripts`](../../modules/transcripts/README.md)
- [`plugins/logger`](../../plugins/logger/README.md)
- [`sealing`](../README.md)

- Workspace packages: `@dems/shared`
- npm packages: `zod`
- Node built-ins: `node:crypto`, `node:fs`

## Tests

No test folder inside this folder.

## Related decisions

No entry of the 2026-11-05 audit decisions log names this folder or its files. Code comments cite earlier design decisions; see the file headers.
