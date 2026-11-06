# `src/modules/capture-config`

Up: [`src/modules`](../README.md)

## Purpose

Capture configuration: the store and boot of the two capture slices (the selector and the capture-device registry), their routes, camera credential holders and reveal, and the camera network, factory scan, host alias, installation acceptance and network sub-areas.

## Contents

| File or folder | Role |
|---|---|
| [`boot.ts`](./boot.ts) | The boot of the capture-config module. |
| [`credential-holders.ts`](./credential-holders.ts) | The holders of the credential reader: the one file that builds the handout and takes the two readers. |
| [`credential-reader.ts`](./credential-reader.ts) | The credential reader: the read path of the stored camera credential. |
| [`credential-reveal.ts`](./credential-reveal.ts) | The one caller of the reveal function of the camera credential. |
| [`fencing.ts`](./fencing.ts) | The real-mode demo fencing of the capture-config module. |
| [`index.ts`](./index.ts) | Capture-config module. |
| [`plan.ts`](./plan.ts) | The `CapturePlan` builder. |
| [`routes.ts`](./routes.ts) | The live paths of operations 76 to 80. |
| [`slices.ts`](./slices.ts) | The slice builders of the capture-config module. |
| [`store.ts`](./store.ts) | The store of the capture-config module. |
| [`camera-network/`](./camera-network/) | Sub-area with 4 source files. |
| [`factory-scan/`](./factory-scan/) | Sub-area with 3 source files. |
| [`host-alias/`](./host-alias/) | Sub-area with 3 source files. |
| [`installation-acceptance/`](./installation-acceptance/) | Sub-area with 4 source files. |
| [`network/`](./network/) | Sub-area with 5 source files. |

## Main exports and entry points

Other units import this folder through `index.ts`.

- Exported from `index.ts`: `captureConfigControl`, `captureConfigModule`, `CAPTURE_CONFIG_BOOT_STEP`, `runCaptureConfigBoot`, `CaptureBootSinks`, `CaptureMode`, `DemoState`, `captureModeOf`, `demoFencingOf`, `DemoFencing`, `baselineCaptureConfig`, `baselineCaptureDevices`, `captureConfigSliceOf`, `captureDevicesSliceOf`, `CaptureSliceError`, `CaptureConfigRecord`, `CaptureDeviceRecord`, `CapturePlanError`, `CapturePlanReason`, `CapturePlanRefusal`, `CapturePlanWarningCode`, `MIC_CHANNEL_IDS`, `assertRecordableSelector`, `buildCapturePlan`, `capturePlanConstants`, `capturePlanPairWarnings`, `capturePlanSubjects`, `CapturePlanCameraSource`, `CapturePlanPairWarning`, `CapturePlanInput`, and 40 more.
- Types exported from `index.ts`: `CaptureConfigControl`.

## Dependencies

Module-level imports of the production files (tests excluded).

Inbound (who imports this folder):

- [`app.ts`](../../app.ts): `index.ts`
- [`capture-composition.ts`](../../capture-composition.ts): `credential-holders.ts`, `index.ts`
- [`capture-session`](../../capture-session/README.md): `index.ts`
- [`index.ts`](../../index.ts): `index.ts`
- [`modules/demo`](../demo/README.md): `index.ts`

Outbound (what this folder imports inside `src`):

- [`capture`](../../capture/README.md)
- [`capture/adapters`](../../capture/adapters/README.md)
- [`capture/fence`](../../capture/fence/README.md)
- [`core`](../../core/README.md)
- [`db/mapping`](../../db/mapping/README.md)
- [`plugins/authenticate`](../../plugins/authenticate/README.md)
- [`plugins/error-envelope`](../../plugins/error-envelope/README.md)
- [`plugins/logger`](../../plugins/logger/README.md)
- [`plugins/permission-guard`](../../plugins/permission-guard/README.md)
- [`version.ts`](../../version.ts)

- Workspace packages: `@dems/capture-protocol`, `@dems/shared`
- npm packages: `fastify`, `fastify-type-provider-zod`, `in force`, `pg`, `zod`
- Node built-ins: `node:crypto`, `node:os`

## Tests

| Location | Test files | `*.db.test.ts` |
|---|---|---|
| [`__tests__/`](./__tests__/) | 13 | 5 |
| [`camera-network/__tests__/`](./camera-network/__tests__/) | 2 | 1 |
| [`factory-scan/__tests__/`](./factory-scan/__tests__/) | 2 | 1 |
| [`host-alias/__tests__/`](./host-alias/__tests__/) | 1 | 0 |
| [`installation-acceptance/__tests__/`](./installation-acceptance/__tests__/) | 2 | 1 |
| [`network/__tests__/`](./network/__tests__/) | 2 | 1 |

9 test file(s) end in `.db.test.ts`: they need a PostgreSQL test database and run only in a DB window, not in the plain unit run.

Tests elsewhere that import it (6 folders): `src/__tests__`, `src/capture/__tests__`, `src/capture/adapters/__tests__`, `src/capture/fence/__tests__`, `src/modules/capture-discovery/__tests__`, `src/modules/demo/__tests__`.

## Related decisions

From the 2026-11-05 audit decisions log:

- D100: `slices.ts` LIVE/LOST by id alone, routed to row 128b.
