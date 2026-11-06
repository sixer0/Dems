# `src/modules/capture-discovery`

Up: [`src/modules`](../README.md)

## Purpose

Camera search and the candidate list: operations 93 (`startCaptureDiscovery`) and 94 (`getCaptureDiscovery`), the one call of the camera adapter's `discover`, the in-memory candidate store, adoption of a found camera, readdressing and the segment scan.

## Contents

| File or folder | Role |
|---|---|
| [`adopted-profiles.ts`](./adopted-profiles.ts) | What a STORED-CREDENTIAL connection test does with the streams it judged. |
| [`adopted-test-route.ts`](./adopted-test-route.ts) | The route of operation 108 `testCaptureDeviceConnection`. |
| [`adopted-test.ts`](./adopted-test.ts) | The connection test of an adopted camera with its stored credential. |
| [`adoption.ts`](./adoption.ts) | The registry side of an adoption. |
| [`index.ts`](./index.ts) | Camera search and candidate list. |
| [`limits.ts`](./limits.ts) | The bounds of a camera search. |
| [`readdress-route.ts`](./readdress-route.ts) | The live path of operation 100 `confirmCaptureDeviceAddress`. |
| [`readdress.ts`](./readdress.ts) | The operator-confirmed RE-ADDRESS of a registered camera. |
| [`registered.ts`](./registered.ts) | What a search knows of the registered cameras. |
| [`routes.ts`](./routes.ts) | The live paths of operations 93 and 94. |
| [`search-ids.ts`](./search-ids.ts) | The number of a camera search ID, unique across restarts of the Core within one database. |
| [`search.ts`](./search.ts) | One camera search, from its trigger to its audit row. |
| [`segment-scan.ts`](./segment-scan.ts) | The segment sweep of smart attach. |
| [`session-expiry.ts`](./session-expiry.ts) | An operator session that expires frees its candidate list at once. |
| [`store.ts`](./store.ts) | The candidate store: what a camera search found, as data of one operator session, in the memory of the Core. |
| [`typed-address.ts`](./typed-address.ts) | The rule of a typed address, as this module holds it. |
| [`connect/`](./connect/) | Sub-area with 4 source files. |

## Main exports and entry points

Other units import this folder through `index.ts`.

- Exported from `index.ts`: `captureDiscoveryControl`, `captureDiscoveryModule`, `ADOPTED_CAMERA_TRANSPORT`, `ADOPTED_STREAM_ROLE`, `AdoptionProfileInvalid`, `AdoptionRowMissing`, `INSERT_ADOPTED_CAMERA_STREAM`, `SET_ADOPTED_CAMERA_COLUMNS`, `assertAdoptedProfiles`, `registerAdoptedCamera`, `writeAdoptedCameraStreams`, `AdoptedCamera`, `AdoptedCameraStream`, `adoptedCameraTestControl`, `AdoptedCameraTest`, `AdoptedCameraTestControl`, `AdoptedCameraTestParts`, `StoredCredentialReader`, `SearchBound`, `createSearchLimiter`, `SearchAllowance`, `SearchLimiter`, `CAPTURE_READDRESS_MODULE_OPERATION`, `READDRESS_NETWORK_FACTS_UNREADABLE`, `captureReaddressControl`, `CaptureReaddressControl`, `READ_REGISTERED_CAMERAS`, `adoptionAddressOf`, `readRegisteredCameras`, `registeredIndexOf`, and 27 more.
- Types exported from `index.ts`: `DiscoveryAdapterFactory`, `CandidateDirectorySeam`, `CaptureDiscoveryControl`.

## Dependencies

Module-level imports of the production files (tests excluded).

Inbound (who imports this folder):

- [`app.ts`](../../app.ts): `index.ts`
- [`capture-composition.ts`](../../capture-composition.ts): `index.ts`

Outbound (what this folder imports inside `src`):

- [`capture`](../../capture/README.md)
- [`capture-notices`](../../capture-notices/README.md)
- [`capture/adapters`](../../capture/adapters/README.md)
- [`capture/fence`](../../capture/fence/README.md)
- [`core`](../../core/README.md)
- [`credential-store`](../../credential-store/README.md)
- [`db/mapping`](../../db/mapping/README.md)
- [`engine`](../../engine/README.md)
- [`plugins/authenticate`](../../plugins/authenticate/README.md)
- [`plugins/error-envelope`](../../plugins/error-envelope/README.md)
- [`plugins/logger`](../../plugins/logger/README.md)
- [`plugins/permission-guard`](../../plugins/permission-guard/README.md)
- [`sealing-host`](../../sealing-host/README.md)
- [`segment-probe-socket.ts`](../../segment-probe-socket.ts)

- Workspace packages: `@dems/shared`
- npm packages: `fastify`, `fastify-type-provider-zod`, `pg`, `zod`
- Node built-ins: `node:crypto`, `node:os`

## Tests

| Location | Test files | `*.db.test.ts` |
|---|---|---|
| [`__tests__/`](./__tests__/) | 14 | 5 |
| [`connect/__tests__/`](./connect/__tests__/) | 5 | 3 |

8 test file(s) end in `.db.test.ts`: they need a PostgreSQL test database and run only in a DB window, not in the plain unit run.

Tests elsewhere that import it (5 folders): `src/__tests__`, `src/modules/capture-config/__tests__`, `src/modules/capture-config/__tests__/e2e`, `src/modules/capture-config/camera-network/__tests__`, `src/modules/capture-inputs/__tests__`.

## Related decisions

No entry of the 2026-11-05 audit decisions log names this folder or its files. Code comments cite earlier design decisions; see the file headers.
