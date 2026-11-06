# `src/realtime`

Up: [`src`](../README.md)

## Purpose

The realtime channel: fills the `publish` seam (what a unit of work says after its commit) and registers the one socket route `GET /ws`; the hub decides which sockets get which message.

## Contents

| File or folder | Role |
|---|---|
| [`admission.ts`](./admission.ts) | Who a socket is: the decision table for the WebSocket upgrade. |
| [`handshake.ts`](./handshake.ts) | The sockets of upgrade requests, from the moment Node hands them over until the socket route takes them. |
| [`hub-types.ts`](./hub-types.ts) | The types of the realtime hub. |
| [`hub.ts`](./hub.ts) | The hub of the realtime channel. |
| [`index.ts`](./index.ts) | Realtime channel. |
| [`limits.ts`](./limits.ts) | The server's own numbers of the realtime channel. |
| [`messages.ts`](./messages.ts) | The server's messages on `/ws`, as text frames. |
| [`publication.ts`](./publication.ts) | The type of the seam `app.publish`. |
| [`tablet-link.ts`](./tablet-link.ts) | The tablet link, driven by real device connections. |

## Main exports and entry points

Other units import this folder through `index.ts`.

- Exported from `index.ts`: `realtimeControl`, `realtimePlugin`, `admissionOf`, `beyondCap`, `deviceRetired`, `displacedBy`, `isRefused`, `principalCapOf`, `principalKeyOf`, `sessionInvalid`, `topicsOf`, `Admission`, `AnonymousAdmission`, `ConnectionCaps`, `DeviceAdmission`, `OpenCounts`, `OperatorAdmission`, `PrincipalCaps`, `PrincipalKey`, `RefusedAdmission`, `createHandshakeGuard`, `HandshakeGuard`, `HandshakeLimits`, `HandshakeStats`, `createRealtimeHub`, `ClientMessageRefusal`, `ConnectionCounters`, `ConnectionHandle`, `ConnectionSummary`, `HubDependencies`, and 29 more.
- Types exported from `index.ts`: `RealtimeControl`.

## Dependencies

Module-level imports of the production files (tests excluded).

Inbound (who imports this folder):

- [`app.ts`](../app.ts): `index.ts`
- [`engine`](../engine/README.md): `index.ts`
- [`modules/demo`](../modules/demo/README.md): `index.ts`
- [`modules/identity`](../modules/identity/README.md): `index.ts`

Outbound (what this folder imports inside `src`):

- [`core`](../core/README.md)
- [`db/mapping`](../db/mapping/README.md)
- [`engine`](../engine/README.md)
- [`modules/pairing`](../modules/pairing/README.md)
- [`plugins/authenticate`](../plugins/authenticate/README.md)
- [`plugins/error-envelope`](../plugins/error-envelope/README.md)
- [`plugins/logger`](../plugins/logger/README.md)

- Workspace packages: `@dems/shared`
- npm packages: `@fastify/websocket`, `fastify`, `ws`
- Node built-ins: `node:crypto`, `node:http`, `node:stream`

## Tests

| Location | Test files | `*.db.test.ts` |
|---|---|---|
| [`__tests__/`](./__tests__/) | 17 | 7 |

7 test file(s) end in `.db.test.ts`: they need a PostgreSQL test database and run only in a DB window, not in the plain unit run.

Tests elsewhere that import it (11 folders): `src/engine/__tests__`, `src/modules/admin/__tests__`, `src/modules/capture-inputs/__tests__`, `src/modules/demo/__tests__`, `src/modules/devices/__tests__`, `src/modules/evidence/__tests__`, `src/modules/identity/__tests__`, `src/modules/rbac/__tests__`, and more.

## Related decisions

From the 2026-11-05 audit decisions log:

- D242: `hub.ts` publishes the session replacement after recover with no delay; not reproduced, parked.
