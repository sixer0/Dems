# `src/capture/adapters`

Up: [`src/capture`](../README.md)

## Purpose

The adapter layer of the Core process: the three adapter seams (camera, PoE, microphone), the vocabulary of adapter kinds and source classes, the device registry and its refusal rules, camera credential and stream-locator handling, and the loader of the production adapters. It is not registered in the app; other units use it as a library.

## Contents

| File or folder | Role |
|---|---|
| [`commands.ts`](./commands.ts) | Which adapter seam carries each device command. |
| [`credential.ts`](./credential.ts) | Camera credentials and stream locators. |
| [`errors.ts`](./errors.ts) | Refusals of the adapter layer. |
| [`index.ts`](./index.ts) | The adapter layer of the Core process. |
| [`kinds.ts`](./kinds.ts) | The vocabulary of the adapter layer. |
| [`mic-transport.ts`](./mic-transport.ts) | What a microphone transport promises, stated once. |
| [`production-door.ts`](./production-door.ts) | The process door of the production programs. |
| [`real.ts`](./real.ts) | The one loader of the production adapters. |
| [`registry.ts`](./registry.ts) | The capture device registry. |
| [`types.ts`](./types.ts) | The seams of the adapter layer. |
| [`audio/`](./audio/) | Sub-area with 18 source files. |
| [`camera/`](./camera/) | Sub-area with 18 source files. |
| [`fake/`](./fake/) | Sub-area with 4 source files. |
| [`local/`](./local/) | Sub-area with 14 source files. |
| [`poe/`](./poe/) | Sub-area with 1 source files. |

## Main exports and entry points

Other units import this folder through `index.ts`.

- Exported from `index.ts`: `CAPTURE_DEVICE_COMMANDS`, `SEAM_OF_DEVICE_COMMAND`, `operationOfDeviceCommand`, `CaptureCommandSeam`, `CaptureDeviceCommand`, `CREDENTIAL_MARK`, `SealedCredential`, `blankCredentialLocators`, `credentialAtInjection`, `credentialFreeLocator`, `sealCredential`, `startMessageBytes`, `streamLocator`, `usingCredential`, `CameraCredential`, `InjectedStreamAccess`, `StartMessage`, `StartMessagePlainMember`, `CaptureAdapterError`, `CaptureAdapterRefusal`, `FAKE_CAMERA_PROFILE`, `FAKE_CAMERA_SECOND_PROFILE`, `FAKE_MIC_PRIMARY_DBFS`, `FAKE_MIC_STANDBY_DBFS`, `FakeTopology`, `createFakeAudioInputAdapter`, `createFakeCameraAdapter`, `createFakePoeController`, `createFakeRegistry`, `FakeAudioInputAdapter`, and 111 more.

## Dependencies

Module-level imports of the production files (tests excluded).

Inbound (who imports this folder):

- [`capture`](../README.md): `index.ts`
- [`capture-notices`](../../capture-notices/README.md): `index.ts`
- [`capture-session`](../../capture-session/README.md): `index.ts`
- [`capture/boot`](../boot/README.md): `kinds.ts`, `local/index.ts`, `local/mic-helper-args.ts`
- [`capture/fence`](../fence/README.md): `audio/alsa-config-writer.ts`, `audio/card-listing-reader.ts`, `audio/card-listing.ts`, `audio/idle-meter.ts`, `audio/macos-card-listing.ts`, `audio/macos-plist.ts`, and 23 more
- [`evidence-verify`](../../evidence-verify/README.md): `index.ts`
- [`modules/capture-config`](../../modules/capture-config/README.md): `index.ts`
- [`modules/capture-discovery`](../../modules/capture-discovery/README.md): `index.ts`
- [`sealing-host`](../../sealing-host/README.md): `index.ts`

Outbound (what this folder imports inside `src`):

- [`capture`](../README.md)

- Workspace packages: `@dems/capture-protocol`, `@dems/shared`
- npm packages: `none:(0/[1-9][0-9]?)`, `none:0`, `none:<n>`, `onvif`, `xml2js`
- Node built-ins: `node:child_process`, `node:dgram`, `node:fs`, `node:http`, `node:https`, `node:os`, `node:path`, `node:stream`

## Tests

| Location | Test files | `*.db.test.ts` |
|---|---|---|
| [`__tests__/`](./__tests__/) | 7 | 1 |
| [`audio/__tests__/`](./audio/__tests__/) | 12 | 0 |
| [`camera/__tests__/`](./camera/__tests__/) | 15 | 0 |
| [`local/__tests__/`](./local/__tests__/) | 11 | 0 |

1 test file(s) end in `.db.test.ts`: they need a PostgreSQL test database and run only in a DB window, not in the plain unit run.

Tests elsewhere that import it (21 folders): `src/__tests__`, `src/capture-notices/__tests__`, `src/capture-session/__tests__`, `src/capture/__tests__`, `src/capture/boot/__tests__`, `src/capture/fence/__tests__`, `src/capture/signer/__tests__`, `src/db/seed/__tests__`, and more.

## Related decisions

No entry of the 2026-11-05 audit decisions log names this folder or its files. Code comments cite earlier design decisions; see the file headers.
