# `src/plugins/error-envelope`

Up: [`src/plugins`](../README.md)

## Purpose

The error envelope: owns every answer that is not a handler's success, such as 400, 404, 405, 413, 422, every `ApiFailure`, and 500 `INTERNAL_ERROR` with no detail.

## Contents

| File or folder | Role |
|---|---|
| [`api-failure.ts`](./api-failure.ts) | The error envelope: `{ error: { code, message, details?, requestId } }`. |
| [`index.ts`](./index.ts) | Error envelope plugin. |
| [`json-body.ts`](./json-body.ts) | Request bodies: a body is a JSON object of at most 65,536 bytes. |
| [`route-table.ts`](./route-table.ts) | The table of registered routes, filled by an `onRoute` hook. |

## Main exports and entry points

Other units import this folder through `index.ts`.

- Exported from `index.ts`: `classify`, `sendFailure`, `handleFrameworkError`, `errorEnvelopePlugin`, `ApiFailure`, `EnvelopeCode`, `errorBody`, `internalError`, `invalidInput`, `invalidJson`, `invalidPath`, `methodNotAllowed`, `NOT_SIGNED_IN_TEXT`, `notFound`, `notReady`, `payloadTooLarge`, `ApiFailureOptions`, `ErrorBody`, `ErrorDetails`, `createRouteTable`, `patternToRegExp`, `KnownPath`, `RouteTable`.
- Types exported from `index.ts`: `Classified`, `ErrorEnvelopeOptions`.

## Dependencies

Module-level imports of the production files (tests excluded).

Inbound (who imports this folder):

- [`app.ts`](../../app.ts): `index.ts`
- [`camera-preview`](../../camera-preview/README.md): `index.ts`
- [`capture-session`](../../capture-session/README.md): `index.ts`
- [`core`](../../core/README.md): `index.ts`
- [`engine`](../../engine/README.md): `index.ts`
- [`evidence-export`](../../evidence-export/README.md): `index.ts`
- [`lcd`](../../lcd/README.md): `index.ts`
- [`media-stream`](../../media-stream/README.md): `index.ts`
- [`modules/admin`](../../modules/admin/README.md): `index.ts`
- [`modules/capture-config`](../../modules/capture-config/README.md): `index.ts`
- [`modules/capture-discovery`](../../modules/capture-discovery/README.md): `index.ts`
- [`modules/capture-inputs`](../../modules/capture-inputs/README.md): `index.ts`
- [`modules/demo`](../../modules/demo/README.md): `index.ts`
- [`modules/evidence`](../../modules/evidence/README.md): `index.ts`
- [`modules/identity`](../../modules/identity/README.md): `index.ts`
- [`modules/pairing`](../../modules/pairing/README.md): `index.ts`
- [`modules/sealing`](../../modules/sealing/README.md): `index.ts`
- [`modules/security-audit`](../../modules/security-audit/README.md): `index.ts`
- [`modules/sessions`](../../modules/sessions/README.md): `index.ts`
- [`modules/stt-config`](../../modules/stt-config/README.md): `index.ts`
- [`modules/transcripts`](../../modules/transcripts/README.md): `index.ts`
- [`plugins/authenticate`](../authenticate/README.md): `index.ts`
- [`plugins/db`](../db/README.md): `index.ts`
- [`plugins/origin-guard`](../origin-guard/README.md): `index.ts`
- [`plugins/permission-guard`](../permission-guard/README.md): `index.ts`
- [`plugins/readiness`](../readiness/README.md): `index.ts`
- [`plugins/throttle`](../throttle/README.md): `index.ts`
- [`realtime`](../../realtime/README.md): `index.ts`
- [`sealing-host`](../../sealing-host/README.md): `index.ts`

Outbound (what this folder imports inside `src`):

- [`config.ts`](../../config.ts)
- [`plugins/logger`](../logger/README.md)
- [`plugins/response-headers`](../response-headers/README.md)

- Workspace packages: `@dems/shared`
- npm packages: `fastify`, `unknown path`

## Tests

| Location | Test files | `*.db.test.ts` |
|---|---|---|
| [`__tests__/`](./__tests__/) | 2 | 0 |

None of these tests needs a database window.

Tests elsewhere that import it (30 folders): `src/capture-session/__tests__`, `src/core/__tests__`, `src/engine/__tests__`, `src/modules/alerts/__tests__`, `src/modules/capture-config/__tests__`, `src/modules/capture-config/camera-network/__tests__`, `src/modules/capture-config/factory-scan/__tests__`, `src/modules/capture-config/host-alias/__tests__`, and more.

## Related decisions

No entry of the 2026-11-05 audit decisions log names this folder or its files. Code comments cite earlier design decisions; see the file headers.
