# `src/capture-session`

Up: [`src`](../README.md)

## Purpose

The capture of one recording session in real capture mode: starting the worker for the one open session, pairing ingest, stating the source facts, and stopping. A closed unit; other units import its index only.

## Contents

| File or folder | Role |
|---|---|
| [`facts.ts`](./facts.ts) | What the capture side knows of a session and the seal needs. |
| [`index.ts`](./index.ts) | The capture of a session. |
| [`ingest-pairing.ts`](./ingest-pairing.ts) | SA-3: when a camera of a session counts as open. |
| [`statements.ts`](./statements.ts) | The statements of the capture-session unit. |

## Main exports and entry points

Other units import this folder through `index.ts`.

- Exported from `index.ts`: `SOURCE_KIND_NOT_RECORDABLE`, `MIC_START_BOUND_MS`, `CAMERA_CLOCK_OFFSET_ADVISORY_MS`, `CAPTURE_NOT_DURABLE`, `STT_SNAPSHOT_NOT_STORED`, `SESSION_LEFT_RECORDING`, `STOP_NOT_CLEAN`, `NO_CAMERA_CONNECTED`, `PRODUCTION_CAMERA_OPEN_BOUND_MS`, `CAMERA_OPEN_BOUND`, `RELAY_REPORTS_NOT_WIRED`, `CAMERA_INGEST_NOT_PAIRED`, `SUPERSEDED_REPORT_LINES`, `INGEST_ADDRESS_UNKNOWN`, `sessionMediaFolder`, `cameraFileName`, `micFileName`, `mediaMsOfSample`, `isCameraFile`, `isCameraFragmentRecord`, `channelFilesOf`, `fragmentTracksOf`, `pairedMicMissingOf`, `CHECKPOINT_FACTS_INTERVAL_MS`, `RELAY_PLAYING_SILENCE_BOUND_MS`, `registerSessionCaptureShutdown`, `sessionCapture`, `INGEST_PAIRING_BOUND_MS`, `IngestPairingFault`, `IngestPairingFailure`, and 20 more.
- Types exported from `index.ts`: `SessionCaptureEvent`, `SessionFirstVideo`, `SessionCameraFile`, `SessionCaptureListener`, `SessionCapturePorts`, `SessionCapture`.

## Dependencies

Module-level imports of the production files (tests excluded).

Inbound (who imports this folder):

- [`capture-composition.ts`](../capture-composition.ts): `index.ts`
- [`capture-notices`](../capture-notices/README.md): `index.ts`
- [`modules/devices`](../modules/devices/README.md): `index.ts`
- [`modules/sessions`](../modules/sessions/README.md): `index.ts`
- [`sealing-host`](../sealing-host/README.md): `index.ts`

Outbound (what this folder imports inside `src`):

- [`capture`](../capture/README.md)
- [`capture/adapters`](../capture/adapters/README.md)
- [`capture/fence`](../capture/fence/README.md)
- [`engine`](../engine/README.md)
- [`modules/capture-config`](../modules/capture-config/README.md)
- [`modules/recording-fragments`](../modules/recording-fragments/README.md)
- [`plugins/error-envelope`](../plugins/error-envelope/README.md)
- [`plugins/logger`](../plugins/logger/README.md)
- [`transcription`](../transcription/README.md)

- Workspace packages: `@dems/capture-protocol`, `@dems/shared`
- npm packages: `fastify`
- Node built-ins: `node:crypto`, `node:fs`, `node:path`

## Tests

| Location | Test files | `*.db.test.ts` |
|---|---|---|
| [`__tests__/`](./__tests__/) | 4 | 1 |

1 test file(s) end in `.db.test.ts`: they need a PostgreSQL test database and run only in a DB window, not in the plain unit run.

Tests elsewhere that import it (10 folders): `src/__tests__`, `src/capture-notices/__tests__`, `src/capture/__tests__`, `src/capture/fence/__tests__`, `src/capture/fence/__tests__/e2e`, `src/db/reset/__tests__`, `src/modules/capture-config/__tests__/e2e`, `src/modules/sessions/__tests__`, and more.

## Related decisions

From the 2026-11-05 audit decisions log:

- D42: source rows are written at start before the microphones open.
- D132: operator notice `PAIRED_MIC_MISSING` raised from this unit.
- D141: the session names the channel file, adapters never did.
- D150: session durability counts camera-file records only.
- D235: recording opens every mic and writes one file per channel.
