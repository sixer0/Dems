# `src/modules/capture-inputs`

Up: [`src/modules`](../README.md)

## Purpose

The live path of operation 97 `rescanCaptureInputs`: the re-read of the local microphone inputs, its spacing limit and its audit row, plus the `audio-cards` sub-area.

## Contents

| File or folder | Role |
|---|---|
| [`index.ts`](./index.ts) | Capture-inputs module. |
| [`routes.ts`](./routes.ts) | Operation 97 `rescanCaptureInputs`. |
| [`audio-cards/`](./audio-cards/) | Sub-area with 6 source files. |

## Main exports and entry points

Other units import this folder through `index.ts`.

- Exported from `index.ts`: `rescanSearchId`, `captureInputsModule`, `CAPTURE_INPUTS_MODULE_OPERATIONS`, `CAPTURE_INPUTS_UNIT_LABEL`, `captureInputsOperation`, `CaptureInputsModuleOperation`, `CaptureInputsRouteSeams`, `captureAudioCardsControl`, `AudioCardEnumerator`, `AudioCardListing`, `CaptureAudioCardsControl`.

## Dependencies

Module-level imports of the production files (tests excluded).

Inbound (who imports this folder):

- [`app.ts`](../../app.ts): `index.ts`
- [`capture-composition.ts`](../../capture-composition.ts): `index.ts`

Outbound (what this folder imports inside `src`):

- [`capture-notices`](../../capture-notices/README.md)
- [`capture/fence`](../../capture/fence/README.md)
- [`core`](../../core/README.md)
- [`engine`](../../engine/README.md)
- [`plugins/authenticate`](../../plugins/authenticate/README.md)
- [`plugins/error-envelope`](../../plugins/error-envelope/README.md)
- [`plugins/logger`](../../plugins/logger/README.md)
- [`plugins/permission-guard`](../../plugins/permission-guard/README.md)

- Workspace packages: `@dems/shared`
- npm packages: `fastify`, `fastify-type-provider-zod`, `pg`

## Tests

| Location | Test files | `*.db.test.ts` |
|---|---|---|
| [`__tests__/`](./__tests__/) | 2 | 1 |
| [`audio-cards/__tests__/`](./audio-cards/__tests__/) | 3 | 1 |

2 test file(s) end in `.db.test.ts`: they need a PostgreSQL test database and run only in a DB window, not in the plain unit run.

Tests elsewhere that import it (7 folders): `src/__tests__`, `src/capture-notices/__tests__`, `src/modules/capture-config/__tests__/e2e`, `src/modules/capture-discovery/__tests__`, `src/modules/devices/__tests__`, `src/modules/evidence/__tests__`, `src/modules/media-stream/__tests__`.

## Related decisions

No entry of the 2026-11-05 audit decisions log names this folder or its files. Code comments cite earlier design decisions; see the file headers.
