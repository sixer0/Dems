# `src/modules/sessions`

Up: [`src/modules`](../README.md)

## Purpose

The recording lifecycle of the one session a Core has open: operations 24 to 38 of the shared registry (create, pre-check, start, stop, cancel, recover, markers, notes, snapshots, summary and history).

## Contents

| File or folder | Role |
|---|---|
| [`audio-intervals.ts`](./audio-intervals.ts) | The answer of operation 82 `listAudioSourceIntervals`. |
| [`current.ts`](./current.ts) | The answer of operation 27 `getCurrentSession`. |
| [`history.ts`](./history.ts) | The answer of operation 38 `listSessionHistory`. |
| [`index.ts`](./index.ts) | Sessions module: operations 24 to 38 of the shared registry, the recording lifecycle of the one session a Core has open. |
| [`operations.ts`](./operations.ts) | The operations of the sessions module and what binds each to the contract. |
| [`refusals.ts`](./refusals.ts) | The refusals the sessions module answers itself. |
| [`routes.ts`](./routes.ts) | The routes of the sessions module: operations 24 to 38 of the shared registry. |
| [`text-body.ts`](./text-body.ts) | The bodies of `stopSession` and `addSessionNote`. |

## Main exports and entry points

Other units import this folder through `index.ts`.

- Exported from `index.ts`: `sessionsModule`, `INTERVALS_READ_SOURCE`, `intervalCursorOf`, `intervalPositionOf`, `listAudioSourceIntervals`, `pageOfIntervals`, `readIntervalPage`, `currentSessionResponse`, `CurrentSessionSource`, `cursorOf`, `listSessionHistory`, `positionOf`, `readHistoryPage`, `HistoryPosition`, `CAPTURE_SESSION_OPERATION_IDS`, `SESSION_OPERATION_IDS`, `SESSION_READ_IDS`, `actionOf`, `bodySchemaOf`, `operationOf`, `successStatusesOf`, `successesOf`, `ActionOf`, `SessionCommandId`, `SessionOperationId`, `SessionReadId`, `createRefusal`, `notOpenSession`, `precheckBlocked`, `precheckRunning`, and 6 more.

## Dependencies

Module-level imports of the production files (tests excluded).

Inbound (who imports this folder):

- [`app.ts`](../../app.ts): `index.ts`

Outbound (what this folder imports inside `src`):

- [`capture-notices`](../../capture-notices/README.md)
- [`capture-session`](../../capture-session/README.md)
- [`db/mapping`](../../db/mapping/README.md)
- [`db/schema`](../../db/schema/README.md)
- [`engine`](../../engine/README.md)
- [`plugins/error-envelope`](../../plugins/error-envelope/README.md)
- [`plugins/permission-guard`](../../plugins/permission-guard/README.md)
- [`sealing-host`](../../sealing-host/README.md)

- Workspace packages: `@dems/shared`
- npm packages: `drizzle-orm`, `fastify`, `fastify-type-provider-zod`, `pg`, `zod`

## Tests

| Location | Test files | `*.db.test.ts` |
|---|---|---|
| [`__tests__/`](./__tests__/) | 10 | 6 |

6 test file(s) end in `.db.test.ts`: they need a PostgreSQL test database and run only in a DB window, not in the plain unit run.

Tests elsewhere that import it (8 folders): `src/db/mapping/__tests__`, `src/db/reset/__tests__`, `src/engine/__tests__`, `src/modules/capture-discovery/__tests__`, `src/modules/capture-inputs/__tests__`, `src/modules/evidence/__tests__`, `src/modules/transcripts/__tests__`, `src/plugins/permission-guard/__tests__`.

## Related decisions

From the 2026-11-05 audit decisions log:

- D53: comments of `refusals.ts` on the number of pre-check checks, assigned to row 84.
