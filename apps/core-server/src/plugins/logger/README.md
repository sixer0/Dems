# `src/plugins/logger`

Up: [`src/plugins`](../README.md)

## Purpose

The server's logging: Fastify logger options, the safe description of a thrown value, one request line per request with the route pattern, and the persistent error log.

## Contents

| File or folder | Role |
|---|---|
| [`error-log.ts`](./error-log.ts) | Persistent error log: one JSON object per line in `apps/core-server/logs/errors.log`. |
| [`index.ts`](./index.ts) | The server's logging: - `buildLoggerOptions`: options of Fastify's built-in logger; - `describeError`, `codedCauseOf`: the safe description of a thrown value, and the one walk over a `cause`... |
| [`log-controller.ts`](./log-controller.ts) | The server's log controller: Fastify's own extension point for the lines it writes per request. |
| [`logger-options.ts`](./logger-options.ts) | Options of Fastify's built-in logger. |
| [`request-log.ts`](./request-log.ts) | The fields of a request log line: method, route pattern, status, duration, request ID and a principal reference. |

## Main exports and entry points

Other units import this folder through `index.ts`.

- Exported from `index.ts`: `CAUSE_CHAIN_DEPTH`, `DEFAULT_ERROR_LOG_FILE`, `ERROR_LOG_ROTATE_BYTES`, `codedCauseOf`, `createErrorLog`, `describeError`, `rotatedErrorLogFile`, `CodedCause`, `ErrorDescription`, `ErrorLog`, `ErrorLogContext`, `ErrorLogEntry`, `ErrorLogOptions`, `CoreLogController`, `LOG_DEPTH_LIMIT`, `LOG_MEMBER_LIMIT`, `NOT_LOGGED`, `REDACTED`, `REDACT_PATHS`, `buildLoggerOptions`, `loggedError`, `safeLogObject`, `scrubMessage`, `LogStream`, `LoggedError`, `LoggerOptions`, `LoggerOptionsInput`, `noteFailureCode`, `noteRoutePattern`, `pathWithoutQuery`, and 4 more.

## Dependencies

Module-level imports of the production files (tests excluded).

Inbound (who imports this folder):

- [`app.ts`](../../app.ts): `index.ts`
- [`camera-preview`](../../camera-preview/README.md): `index.ts`
- [`capture`](../../capture/README.md): `index.ts`
- [`capture-notices`](../../capture-notices/README.md): `index.ts`
- [`capture-session`](../../capture-session/README.md): `index.ts`
- [`core`](../../core/README.md): `index.ts`
- [`engine`](../../engine/README.md): `index.ts`
- [`evidence-export`](../../evidence-export/README.md): `index.ts`
- [`evidence-facts`](../../evidence-facts/README.md): `index.ts`
- [`index.ts`](../../index.ts): `index.ts`
- [`media-stream`](../../media-stream/README.md): `index.ts`
- [`modules/admin`](../../modules/admin/README.md): `index.ts`
- [`modules/capture-config`](../../modules/capture-config/README.md): `index.ts`
- [`modules/capture-discovery`](../../modules/capture-discovery/README.md): `index.ts`
- [`modules/capture-inputs`](../../modules/capture-inputs/README.md): `index.ts`
- [`modules/demo`](../../modules/demo/README.md): `index.ts`
- [`modules/devices`](../../modules/devices/README.md): `index.ts`
- [`modules/identity`](../../modules/identity/README.md): `index.ts`
- [`modules/pairing`](../../modules/pairing/README.md): `index.ts`
- [`modules/security-audit`](../../modules/security-audit/README.md): `index.ts`
- [`modules/stt-config`](../../modules/stt-config/README.md): `index.ts`
- [`modules/transcripts`](../../modules/transcripts/README.md): `index.ts`
- [`plugins/authenticate`](../authenticate/README.md): `index.ts`
- [`plugins/db`](../db/README.md): `index.ts`
- [`plugins/error-envelope`](../error-envelope/README.md): `index.ts`
- [`plugins/origin-guard`](../origin-guard/README.md): `index.ts`
- [`plugins/permission-guard`](../permission-guard/README.md): `index.ts`
- [`plugins/throttle`](../throttle/README.md): `index.ts`
- [`realtime`](../../realtime/README.md): `index.ts`
- [`sealing-host`](../../sealing-host/README.md): `index.ts`
- [`sealing-host/demo-seed`](../../sealing-host/demo-seed/README.md): `index.ts`
- [`sealing/finalize-transcript`](../../sealing/finalize-transcript/README.md): `index.ts`
- [`sealing/pipeline`](../../sealing/pipeline/README.md): `index.ts`

Outbound (what this folder imports inside `src`):

- [`config.ts`](../../config.ts)
- [`plugins/authenticate`](../authenticate/README.md)

- Workspace packages: `@dems/shared`
- npm packages: `fastify`
- Node built-ins: `node:fs`, `node:path`, `node:url`

## Tests

| Location | Test files | `*.db.test.ts` |
|---|---|---|
| [`__tests__/`](./__tests__/) | 6 | 1 |

1 test file(s) end in `.db.test.ts`: they need a PostgreSQL test database and run only in a DB window, not in the plain unit run.

Tests elsewhere that import it (13 folders): `src/capture/adapters/__tests__`, `src/engine/__tests__`, `src/modules/admin/__tests__`, `src/modules/demo/__tests__`, `src/modules/evidence/__tests__`, `src/modules/identity/__tests__`, `src/modules/security-audit/__tests__`, `src/plugins/db/__tests__`, and more.

## Related decisions

No entry of the 2026-11-05 audit decisions log names this folder or its files. Code comments cite earlier design decisions; see the file headers.
