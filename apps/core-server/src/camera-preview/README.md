# `src/camera-preview`

Up: [`src`](../README.md)

## Purpose

Holds what the live camera preview and the idle microphone meters do: the handlers of operations 112 and 113 and of the `GET /preview/:token` stream, including its headers. It registers no route itself; `modules/camera-preview` registers the three routes and calls into this unit.

## Contents

| File or folder | Role |
|---|---|
| [`index.ts`](./index.ts) | The live camera preview and the idle microphone meters at the API. |
| [`service.ts`](./service.ts) | The handlers of the live camera preview and of the idle microphone meters. |

## Main exports and entry points

Other units import this folder through `index.ts`.

- Exported from `index.ts`: `READ_PREVIEW_DEVICE`, `READ_PREVIEW_SESSION_OPEN`, `cameraPreview`, `CAMERA_PREVIEW_OPERATIONS`, `PREVIEW_ADAPTER_KIND`, `PREVIEW_BOUNDARY`, `PREVIEW_DENIED_UNIT`, `PREVIEW_ROUTE_PREFIX`, `PREVIEW_ROUTE_URL`, `PREVIEW_SESSION_CHECK_MS`, `PREVIEW_SESSION_ENDED_REASON`, `PREVIEW_SESSION_ISSUED_UNIT`, `PREVIEW_TOKENS_KEPT`, `PREVIEW_TOKEN_PATTERN`, `PREVIEW_VIEWER_BUFFER_BYTES`, `PreviewTokenRefusal`, `createCameraPreviewService`, `previewPartOf`, `CameraPreviewManagerShape`, `CameraPreviewOperation`, `CameraPreviewParts`, `CameraPreviewService`, `IdleMetersShape`, `PreviewDevice`, `PreviewSinkShape`, `PreviewViewerPlace`.
- Types exported from `index.ts`: `CameraPreviewProvision`, `CameraPreviewControl`.

## Dependencies

Module-level imports of the production files (tests excluded).

Inbound (who imports this folder):

- [`capture-composition.ts`](../capture-composition.ts): `index.ts`
- [`modules/camera-preview`](../modules/camera-preview/README.md): `index.ts`

Outbound (what this folder imports inside `src`):

- [`core`](../core/README.md)
- [`plugins/authenticate`](../plugins/authenticate/README.md)
- [`plugins/error-envelope`](../plugins/error-envelope/README.md)
- [`plugins/logger`](../plugins/logger/README.md)
- [`plugins/permission-guard`](../plugins/permission-guard/README.md)

- Workspace packages: `@dems/shared`
- npm packages: `fastify`, `zod`
- Node built-ins: `node:crypto`, `node:stream`

## Tests

No test folder inside this folder.

Tests elsewhere that import it (1 folders): `src/modules/camera-preview/__tests__`.

## Related decisions

No entry of the 2026-11-05 audit decisions log names this folder or its files. Code comments cite earlier design decisions; see the file headers.
