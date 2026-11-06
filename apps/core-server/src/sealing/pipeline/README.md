# `src/sealing/pipeline`

Up: [`src/sealing`](../README.md)

## Purpose

The sealing pipeline itself: the controller that holds one run per session, the ordered steps, reading camera files and writing sealed camera files, the package writer, and the way out of an interrupted run.

## Contents

| File or folder | Role |
|---|---|
| [`camera-files.ts`](./camera-files.ts) | The camera files of a session on the file system: the bytes for the box walk of `src/capture/fragments.ts`, the writer of a sealed camera file, and the `.part` names beside a recording file. |
| [`contract.ts`](./contract.ts) | The contract of the sealing pipeline v2. |
| [`controller.ts`](./controller.ts) | The sealing controller: one run of the pipeline per session at a time, the engine side of the pipeline's port, and the decision what a session needs after a restart. |
| [`package-writer.ts`](./package-writer.ts) | Writes the clear files of a sealed package. |
| [`pipeline.ts`](./pipeline.ts) | The sealing pipeline v2. |
| [`sealed-plaintext.ts`](./sealed-plaintext.ts) | The plaintext a sealed session left on the media store. |
| [`way-out.ts`](./way-out.ts) | Every seal failure has a way out. |

## Main exports and entry points

There is no `index.ts`; callers import the files directly.

- `camera-files.ts`: `nodeSha256`, `openCameraFile`, `ensureDirectory`, `createExclusive`, `removeIfThere`, `renameWithin`, `syncDirectory`, `syncFile`, `cameraFileNames`, `removeName`, and 5 more.
- `contract.ts`: `SEALING_STEP_ORDER`, `SEALING_MAX_FRAGMENT_BYTES`, `SEALING_QUARANTINE_DIR`, `SealingFailure`, `SealerCause`, `sealerCauseOf`, `sealerCauseIn`, `sealingFailureRetriable`, `sealingCauseCodeOf`, `CONFINED_TO_ONE_CAMERA_FILE`, and 7 more.
- `controller.ts`: `sealedItemInterrupted`, `sealEngineOf`, `createSealingController`, `sealOnCaptureHandOff`.
- `package-writer.ts`: `createPackageWriter`.
- `pipeline.ts`: `SEALING_PROGRESS_INTERVAL_MS`, `TRANSCRIPT_POLL_MS`, `TRANSCRIPT_RETRIES_PER_RUN`, `createSealingPipeline`.
- `sealed-plaintext.ts`: `SEALING_ORPHANS_DIR`, `removeSealedOrphans`, `sealedSessionHoldsPlaintext`, `finishSealedPlaintext`, `sweepSealedSession`.
- `way-out.ts`: `SEAL_RETRY_DEFAULTS`, `SEALING_UNSEALABLE_CODE`, `sealWayOutOf`, `sealRetryingNotice`, `sealCauseWithoutConclusion`, `sealWaitingNotice`, `sealClosingNotice`, `sealBlockedRestoreHint`, `sealBlockedNotice`, `quarantineSessionFiles`, and 2 more.

## Dependencies

Module-level imports of the production files (tests excluded).

Inbound (who imports this folder):

- [`sealing`](../README.md): `camera-files.ts`, `contract.ts`, `controller.ts`, `pipeline.ts`, `sealed-plaintext.ts`, `way-out.ts`

Outbound (what this folder imports inside `src`):

- [`capture`](../../capture/README.md)
- [`core`](../../core/README.md)
- [`modules/recording-fragments`](../../modules/recording-fragments/README.md)
- [`plugins/logger`](../../plugins/logger/README.md)
- [`sealing`](../README.md)
- [`sealing/finalize-transcript`](../finalize-transcript/README.md)

- Workspace packages: `@dems/shared`
- Node built-ins: `node:crypto`, `node:fs`, `node:path`

## Tests

No test folder inside this folder.

Tests elsewhere that import it (2 folders): `src/sealing/__tests__`, `src/sealing/__tests__/kill-matrix`.

## Related decisions

No entry of the 2026-11-05 audit decisions log names this folder or its files. Code comments cite earlier design decisions; see the file headers.
