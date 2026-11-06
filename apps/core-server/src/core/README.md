# `src/core`

Up: [`src`](../README.md)

## Purpose

Core services of the server. It fills three seams of the app (`app.clock`, `app.pipeline`, `app.auditWriter`), holds the audit and event writers, the unit of work and the error and limit definitions, and registers the core boot checks.

## Contents

| File or folder | Role |
|---|---|
| [`audit-details.ts`](./audit-details.ts) | The allow-list of audit details for the twenty-three server-written types. |
| [`audit-writer.ts`](./audit-writer.ts) | The audit writer. |
| [`boot-checks.ts`](./boot-checks.ts) | Registration of the boot checks B-2 to B-9. |
| [`clock.ts`](./clock.ts) | The server clock. |
| [`errors.ts`](./errors.ts) | Errors of the core services. |
| [`event-writer.ts`](./event-writer.ts) | The event writer. |
| [`index.ts`](./index.ts) | Core services. |
| [`limits.ts`](./limits.ts) | Limits of the core services. |
| [`payload-rules.ts`](./payload-rules.ts) | The rules both writers apply to a row before a statement is sent. |
| [`pipeline.ts`](./pipeline.ts) | The serial unit-of-work queue. |
| [`sweeper.ts`](./sweeper.ts) | The timer of the expiry sweeps: the session sweep of the identity module and the pairing-code sweep of the pairing module. |
| [`types.ts`](./types.ts) | The types of the core services: the pipeline, the unit of work and its two writers. |
| [`unit-of-work.ts`](./unit-of-work.ts) | The transaction helper: the state of one unit of work. |
| [`unit-statement.ts`](./unit-statement.ts) | What a statement of a unit of work may be. |
| [`windows.ts`](./windows.ts) | Fixed windows measured by the server clock. |

## Main exports and entry points

Other units import this folder through `index.ts`.

- Exported from `index.ts`: `unitContextOf`, `corePlugin`, `CAPTURE_CREDENTIAL_REVEAL_REASONS`, `SERVER_AUDIT_DETAIL_RULES`, `SYSTEM_BOOT_SIGNING_DETAIL_RULES`, `PAIRING_CODE_CLOSE_REASONS`, `detailRulesOf`, `CaptureCredentialRevealReason`, `DetailRule`, `ServerAuditType`, `REPORTED_BOOT_CHECK`, `registerBootChecks`, `runDatabaseBootChecks`, `createSystemClock`, `followClock`, `raiseClockFloor`, `stampOf`, `Clock`, `FloorClock`, `CoreError`, `CoreErrorCode`, `PipelineFailure`, `PipelineRefusal`, `SqlState`, `driverErrorOf`, `isConnectionFailure`, `isConnectionFailureCode`, `sqlStateOf`, `EVENT_COUNTER_NAME`, `NATIVE_PAYLOAD_KEYS_MAX`, and 22 more.

## Dependencies

Module-level imports of the production files (tests excluded).

Inbound (who imports this folder):

- [`app.ts`](../app.ts): `index.ts`
- [`camera-preview`](../camera-preview/README.md): `index.ts`
- [`engine`](../engine/README.md): `index.ts`
- [`evidence-export`](../evidence-export/README.md): `index.ts`
- [`media-stream`](../media-stream/README.md): `index.ts`
- [`modules/admin`](../modules/admin/README.md): `index.ts`
- [`modules/capture-config`](../modules/capture-config/README.md): `index.ts`
- [`modules/capture-discovery`](../modules/capture-discovery/README.md): `index.ts`
- [`modules/capture-inputs`](../modules/capture-inputs/README.md): `index.ts`
- [`modules/demo`](../modules/demo/README.md): `index.ts`
- [`modules/identity`](../modules/identity/README.md): `index.ts`
- [`modules/pairing`](../modules/pairing/README.md): `index.ts`
- [`modules/stt-config`](../modules/stt-config/README.md): `index.ts`
- [`plugins/authenticate`](../plugins/authenticate/README.md): `index.ts`
- [`plugins/permission-guard`](../plugins/permission-guard/README.md): `index.ts`
- [`plugins/readiness`](../plugins/readiness/README.md): `index.ts`
- [`plugins/throttle`](../plugins/throttle/README.md): `index.ts`
- [`realtime`](../realtime/README.md): `index.ts`
- [`sealing-host`](../sealing-host/README.md): `index.ts`
- [`sealing/pipeline`](../sealing/pipeline/README.md): `index.ts`

Outbound (what this folder imports inside `src`):

- [`db/mapping`](../db/mapping/README.md)
- [`db/schema`](../db/schema/README.md)
- [`plugins/db`](../plugins/db/README.md)
- [`plugins/error-envelope`](../plugins/error-envelope/README.md)
- [`plugins/logger`](../plugins/logger/README.md)
- [`plugins/readiness`](../plugins/readiness/README.md)

- Workspace packages: `@dems/shared`
- npm packages: `a
 * part 2 that was not written`, `drizzle-orm`, `fastify`, `pg`
- Node built-ins: `node:async_hooks`

## Tests

| Location | Test files | `*.db.test.ts` |
|---|---|---|
| [`__tests__/`](./__tests__/) | 15 | 7 |

7 test file(s) end in `.db.test.ts`: they need a PostgreSQL test database and run only in a DB window, not in the plain unit run.

Tests elsewhere that import it (22 folders): `src/capture/adapters/__tests__`, `src/capture/fence/__tests__`, `src/db/fixtures/__tests__`, `src/engine/__tests__`, `src/modules/__tests__`, `src/modules/camera-preview/__tests__`, `src/modules/capture-config/__tests__`, `src/modules/capture-config/camera-network/__tests__`, and more.

## Related decisions

No entry of the 2026-11-05 audit decisions log names this folder or its files. Code comments cite earlier design decisions; see the file headers.
