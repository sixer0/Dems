# `src/sealing`

Up: [`src`](../README.md)

## Purpose

The steps of the v2 sealing pipeline as a library: the six steps in order with their checkpoints and resume rules, the step journal on `sealing_jobs`, signing helpers, and the `FINALIZE_TRANSCRIPT` step. It holds no key and opens no connection; `src/sealing-host` puts it to work.

## Contents

| File or folder | Role |
|---|---|
| [`dev-key-cli.ts`](./dev-key-cli.ts) | `npm run evidence:dev-key -w @dems/core-server [-- --data-dir <dir>]`. |
| [`index.ts`](./index.ts) | `src/sealing` — the steps of the v2 sealing pipeline. |
| [`signing.ts`](./signing.ts) | Where the sealing pipeline takes its signing key from. |
| [`step-journal.ts`](./step-journal.ts) | The journal of one sealing step: a row of `sealing_jobs`. |
| [`finalize-transcript/`](./finalize-transcript/README.md) | The `FINALIZE_TRANSCRIPT` sealing step: its bounds (sealing waits for the transcript, but not for ever), the transcript document and files it writes, and the commit of the step. See its README. |
| [`pipeline/`](./pipeline/README.md) | The sealing pipeline itself: the controller that holds one run per session, the ordered steps, reading camera files and writing sealed camera files, the package writer, and the way out of an interrupted run. See its README. |

## Main exports and entry points

Other units import this folder through `index.ts`.

- Exported from `index.ts`: * from `./step-journal`, * from `./finalize-transcript/contract`, `CLOSE_OUT_CHUNK_CODE`, `FINALIZE_TRANSCRIPT_CLOSE_OUT_ATTEMPTS`, `FINALIZE_TRANSCRIPT_CLOSE_OUT_ATTEMPTS_MAX`, `FINALIZE_TRANSCRIPT_LIMITS`, `closeOutAttemptsOf`, `limitsFault`, `systemStepTimer`, `waitLimitOf`, `FinalizeTranscriptLimits`, `StepTimer`, `FINALIZE_TRANSCRIPT_CHECKPOINT_VERSION`, `finalizeTranscript`, * from `./finalize-transcript/commit`, `createTranscriptFileReader`, `SPEAKER_LABELS_UNAVAILABLE_FLAG`, `SealedTranscriptDocumentSchema`, `readSealedTranscriptDocument`, `uncommittedSegments`, `SealedTranscriptDocument`, * from `./pipeline/contract`, `SEALING_PROGRESS_INTERVAL_MS`, `TRANSCRIPT_POLL_MS`, `TRANSCRIPT_RETRIES_PER_RUN`, `createSealingPipeline`, * from `./pipeline/controller`, * from `./pipeline/way-out`, `SEALING_ORPHANS_DIR`, `finishSealedPlaintext`, and 14 more.

Command-line entry: `dev-key-cli.ts`.

## Dependencies

Module-level imports of the production files (tests excluded).

Inbound (who imports this folder):

- [`evidence-export`](../evidence-export/README.md): `index.ts`
- [`modules/transcripts`](../modules/transcripts/README.md): `index.ts`
- [`sealing-host`](../sealing-host/README.md): `index.ts`
- [`sealing-host/demo-seed`](../sealing-host/demo-seed/README.md): `index.ts`

Outbound (what this folder imports inside `src`):

- [`capture`](../capture/README.md)
- [`core`](../core/README.md)
- [`modules/recording-fragments`](../modules/recording-fragments/README.md)
- [`modules/transcript-chunks`](../modules/transcript-chunks/README.md)
- [`modules/transcripts`](../modules/transcripts/README.md)
- [`plugins/config`](../plugins/config/README.md)
- [`plugins/logger`](../plugins/logger/README.md)

- Workspace packages: `@dems/shared`
- npm packages: `pg`, `zod`
- Node built-ins: `node:crypto`, `node:fs`, `node:path`, `node:url`, `node:util`

## Tests

| Location | Test files | `*.db.test.ts` |
|---|---|---|
| [`__tests__/`](./__tests__/) | 23 | 5 |

5 test file(s) end in `.db.test.ts`: they need a PostgreSQL test database and run only in a DB window, not in the plain unit run.

Tests elsewhere that import it (12 folders): `src/capture/__tests__`, `src/capture/fence/__tests__/e2e`, `src/engine/__tests__`, `src/evidence-export/__tests__`, `src/evidence-facts/__tests__`, `src/evidence-verify/__tests__`, `src/media-stream/__tests__`, `src/modules/capture-config/__tests__/e2e`, and more.

## Related decisions

No entry of the 2026-11-05 audit decisions log names this folder or its files. Code comments cite earlier design decisions; see the file headers.
