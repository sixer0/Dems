# `src/modules/devices`

Up: [`src/modules`](../README.md)

## Purpose

The recording hardware of the Core itself: operations 44 to 52 of the shared registry (device health, audio and video status and related reads and commands). Paired tablets belong to `modules/pairing`, not here.

## Contents

| File or folder | Role |
|---|---|
| [`index.ts`](./index.ts) | Devices module: operations 44 to 52 of the shared registry, the recording hardware of the Core itself. |
| [`operations.ts`](./operations.ts) | The operations of the devices module, read from the contract registry, and the one link the registry does not hold yet. |
| [`source-facts.ts`](./source-facts.ts) | The source facts of a real capture operation, handed to the engine. |
| [`status.ts`](./status.ts) | The answers of the four device reads, built from the engine's committed slices. |

## Main exports and entry points

Other units import this folder through `index.ts`.

- Exported from `index.ts`: `devicesModule`, `SOURCE_FACTS_BOOT_STEP`, `SOURCE_FACTS_NOT_APPLIED`, `captureSourceFacts`, `mountCaptureSourceFacts`, `sourceFactsOf`, `CaptureSourceFactsFeed`, `RegisteredSource`, `SourceFactsPorts`, `DEVICES_OPERATIONS`, `DEVICE_COMMAND_OF_OPERATION`, `operationOf`, `DeviceCommandOperation`, `DevicesOperation`, `activeInputOf`, `audioChannelsOf`, `audioStatusOf`, `cameraStreamFactsOf`, `captureSlotsOf`, `deviceHealthOf`, `deviceInventoryOf`, `stateLevelsOf`, `storageStatusOf`, `videoStatusOf`, `videoTracksOf`, `withCameraStreamFacts`, `CameraStreamFacts`, `CaptureSlots`, `ChannelLevels`, `CommittedState`.

## Dependencies

Module-level imports of the production files (tests excluded).

Inbound (who imports this folder):

- [`app.ts`](../../app.ts): `index.ts`

Outbound (what this folder imports inside `src`):

- [`capture-session`](../../capture-session/README.md)
- [`capture/fence`](../../capture/fence/README.md)
- [`engine`](../../engine/README.md)
- [`lcd`](../../lcd/README.md)
- [`plugins/authenticate`](../../plugins/authenticate/README.md)
- [`plugins/logger`](../../plugins/logger/README.md)
- [`plugins/permission-guard`](../../plugins/permission-guard/README.md)

- Workspace packages: `@dems/shared`
- npm packages: `fastify`, `fastify-type-provider-zod`, `zod`

## Tests

| Location | Test files | `*.db.test.ts` |
|---|---|---|
| [`__tests__/`](./__tests__/) | 8 | 4 |

4 test file(s) end in `.db.test.ts`: they need a PostgreSQL test database and run only in a DB window, not in the plain unit run.

Tests elsewhere that import it (12 folders): `src/capture-notices/__tests__`, `src/capture/adapters/__tests__`, `src/capture/fence/__tests__`, `src/lcd`, `src/modules/__tests__`, `src/modules/camera-preview/__tests__`, `src/modules/capture-config/__tests__`, `src/modules/capture-discovery/__tests__`, and more.

## Related decisions

No entry of the 2026-11-05 audit decisions log names this folder or its files. Code comments cite earlier design decisions; see the file headers.
