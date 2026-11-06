# `src/plugins`

Up: [`src`](../README.md)

## Purpose

Cross-cutting Fastify plugins: configuration, the database pool, logging, and the stages of the request pipeline (origin guard, authenticate, throttle, permission guard, error envelope, response headers, readiness).

## Contents

| File or folder | Role |
|---|---|
| [`authenticate/`](./authenticate/README.md) | The `authenticate` stage, stage 4 of the request pipeline: reads at most one credential (session cookie or bearer token) and resolves it to an operator, a device or anonymous. See its README. |
| [`config/`](./config/README.md) | The configuration loader: reads the environment values and the runtime connection file and builds the configuration object exposed as `app.config`. See its README. |
| [`db/`](./db/README.md) | The database pool plugin: `app.db` holds the one lazy pool of the runtime role. See its README. |
| [`error-envelope/`](./error-envelope/README.md) | The error envelope: owns every answer that is not a handler's success, such as 400, 404, 405, 413, 422, every `ApiFailure`, and 500 `INTERNAL_ERROR` with no detail. See its README. |
| [`logger/`](./logger/README.md) | The server's logging: Fastify logger options, the safe description of a thrown value, one request line per request with the route pattern, and the persistent error log. See its README. |
| [`origin-guard/`](./origin-guard/README.md) | The origin guard, stage 3 of the request pipeline: checks the `Origin` header, the session cookie and the `Authorization` header against a decision table and refuses with 403 `ORIGIN_NOT_ALLOWED` or lets the request through. See its README. |
| [`permission-guard/`](./permission-guard/README.md) | The permission guard, stage 6 of the request pipeline: finds the access rule of the route in the shared registry, decides for the resolved principal, and refuses with one audited `ACCESS_DENIED` row. See its README. |
| [`readiness/`](./readiness/README.md) | Readiness: the `readiness` decorator with the `database` and `engine` flags, named holds that refuse requests, and the boot steps that must succeed before the listener opens. See its README. |
| [`response-headers/`](./response-headers/README.md) | Adds the fixed security headers (Cache-Control, X-Content-Type-Options, Content-Security-Policy, Cross-Origin-Resource-Policy, Referrer-Policy) and the request ID header to every answer. See its README. |
| [`throttle/`](./throttle/README.md) | Stage 5 of the request pipeline: the request throttle per caller key and the denial budget that blocks a key after 20 audited refusals within 60 seconds. See its README. |

## Main exports and entry points

No files of its own; see the subfolders.

## Dependencies

Module-level imports of the production files (tests excluded).

Inbound (who imports this folder):

- [`app.ts`](../app.ts): `authenticate/index.ts`, `db/index.ts`, `error-envelope/index.ts`, `logger/index.ts`, `origin-guard/index.ts`, `permission-guard/index.ts`, and 3 more
- [`camera-preview`](../camera-preview/README.md): `authenticate/index.ts`, `error-envelope/index.ts`, `logger/index.ts`, `permission-guard/index.ts`
- [`capture`](../capture/README.md): `logger/index.ts`
- [`capture-notices`](../capture-notices/README.md): `authenticate/index.ts`, `logger/index.ts`
- [`capture-session`](../capture-session/README.md): `error-envelope/index.ts`, `logger/index.ts`
- [`core`](../core/README.md): `db/index.ts`, `error-envelope/index.ts`, `logger/index.ts`, `readiness/index.ts`
- [`db/commands`](../db/commands/README.md): `config/index.ts`
- [`db/reset`](../db/reset/README.md): `config/index.ts`
- [`db/seed`](../db/seed/README.md): `config/index.ts`
- [`engine`](../engine/README.md): `authenticate/index.ts`, `error-envelope/index.ts`, `logger/index.ts`
- [`evidence-export`](../evidence-export/README.md): `authenticate/index.ts`, `db/index.ts`, `error-envelope/index.ts`, `logger/index.ts`, `permission-guard/index.ts`
- [`evidence-facts`](../evidence-facts/README.md): `logger/index.ts`
- [`evidence-verify`](../evidence-verify/README.md): `authenticate/index.ts`
- [`index.ts`](../index.ts): `config/index.ts`, `db/index.ts`, `logger/index.ts`, `readiness/index.ts`
- [`lcd`](../lcd/README.md): `error-envelope/index.ts`
- [`media-stream`](../media-stream/README.md): `authenticate/index.ts`, `error-envelope/index.ts`, `logger/index.ts`, `permission-guard/index.ts`
- [`modules/admin`](../modules/admin/README.md): `authenticate/index.ts`, `error-envelope/index.ts`, `logger/index.ts`, `permission-guard/index.ts`
- [`modules/alerts`](../modules/alerts/README.md): `authenticate/index.ts`, `permission-guard/index.ts`
- [`modules/camera-preview`](../modules/camera-preview/README.md): `permission-guard/index.ts`
- [`modules/capture-config`](../modules/capture-config/README.md): `authenticate/index.ts`, `error-envelope/index.ts`, `logger/index.ts`, `permission-guard/index.ts`
- [`modules/capture-discovery`](../modules/capture-discovery/README.md): `authenticate/index.ts`, `error-envelope/index.ts`, `logger/index.ts`, `permission-guard/index.ts`
- [`modules/capture-inputs`](../modules/capture-inputs/README.md): `authenticate/index.ts`, `error-envelope/index.ts`, `logger/index.ts`, `permission-guard/index.ts`
- [`modules/demo`](../modules/demo/README.md): `error-envelope/index.ts`, `logger/index.ts`, `permission-guard/index.ts`, `readiness/index.ts`
- [`modules/devices`](../modules/devices/README.md): `authenticate/index.ts`, `logger/index.ts`, `permission-guard/index.ts`
- [`modules/evidence`](../modules/evidence/README.md): `error-envelope/index.ts`, `permission-guard/index.ts`
- [`modules/evidence-export`](../modules/evidence-export/README.md): `permission-guard/index.ts`
- [`modules/health`](../modules/health/README.md): `permission-guard/index.ts`, `readiness/index.ts`
- [`modules/identity`](../modules/identity/README.md): `authenticate/index.ts`, `db/index.ts`, `error-envelope/index.ts`, `logger/index.ts`, `permission-guard/index.ts`
- [`modules/media-stream`](../modules/media-stream/README.md): `permission-guard/index.ts`
- [`modules/network-time`](../modules/network-time/README.md): `permission-guard/index.ts`
- [`modules/pairing`](../modules/pairing/README.md): `authenticate/index.ts`, `db/index.ts`, `error-envelope/index.ts`, `logger/index.ts`, `permission-guard/index.ts`
- [`modules/rbac`](../modules/rbac/README.md): `permission-guard/index.ts`
- [`modules/sealing`](../modules/sealing/README.md): `error-envelope/index.ts`, `permission-guard/index.ts`
- [`modules/security-audit`](../modules/security-audit/README.md): `error-envelope/index.ts`, `logger/index.ts`, `permission-guard/index.ts`
- [`modules/sessions`](../modules/sessions/README.md): `error-envelope/index.ts`, `permission-guard/index.ts`
- [`modules/storage`](../modules/storage/README.md): `permission-guard/index.ts`
- [`modules/stt-config`](../modules/stt-config/README.md): `authenticate/index.ts`, `error-envelope/index.ts`, `logger/index.ts`, `permission-guard/index.ts`
- [`modules/system`](../modules/system/README.md): `authenticate/index.ts`, `permission-guard/index.ts`
- [`modules/transcripts`](../modules/transcripts/README.md): `error-envelope/index.ts`, `logger/index.ts`, `permission-guard/index.ts`
- [`realtime`](../realtime/README.md): `authenticate/index.ts`, `error-envelope/index.ts`, `logger/index.ts`
- [`sealing`](../sealing/README.md): `config/index.ts`
- [`sealing-host`](../sealing-host/README.md): `authenticate/index.ts`, `error-envelope/index.ts`, `logger/index.ts`
- [`sealing-host/demo-seed`](../sealing-host/demo-seed/README.md): `logger/index.ts`
- [`sealing/finalize-transcript`](../sealing/finalize-transcript/README.md): `logger/index.ts`
- [`sealing/pipeline`](../sealing/pipeline/README.md): `logger/index.ts`

Outbound (what this folder imports inside `src`):

- [`config.ts`](../config.ts)
- [`core`](../core/README.md)
- [`db/commands`](../db/commands/README.md)
- [`modules/identity`](../modules/identity/README.md)
- [`modules/pairing`](../modules/pairing/README.md)

- Workspace packages: `@dems/shared`
- npm packages: `@fastify/helmet`, `@fastify/rate-limit`, `answers`, `fastify`, `none found`, `pg`, `rate-limiter-flexible`, `unknown path`
- Node built-ins: `node:fs`, `node:path`, `node:url`

## Tests

| Location | Test files | `*.db.test.ts` |
|---|---|---|
| [`authenticate/__tests__/`](./authenticate/__tests__/) | 3 | 1 |
| [`config/__tests__/`](./config/__tests__/) | 2 | 0 |
| [`db/__tests__/`](./db/__tests__/) | 4 | 1 |
| [`error-envelope/__tests__/`](./error-envelope/__tests__/) | 2 | 0 |
| [`logger/__tests__/`](./logger/__tests__/) | 6 | 1 |
| [`origin-guard/__tests__/`](./origin-guard/__tests__/) | 2 | 0 |
| [`permission-guard/__tests__/`](./permission-guard/__tests__/) | 12 | 4 |
| [`readiness/__tests__/`](./readiness/__tests__/) | 2 | 0 |
| [`response-headers/__tests__/`](./response-headers/__tests__/) | 1 | 0 |
| [`throttle/__tests__/`](./throttle/__tests__/) | 3 | 0 |

7 test file(s) end in `.db.test.ts`: they need a PostgreSQL test database and run only in a DB window, not in the plain unit run.

Tests elsewhere that import it (46 folders): `src/__tests__`, `src/capture-notices/__tests__`, `src/capture-session/__tests__`, `src/capture/adapters/__tests__`, `src/capture/boot/__tests__`, `src/capture/fence/__tests__`, `src/capture/signer/__tests__`, `src/core/__tests__`, and more.

## Related decisions

No entry of the 2026-11-05 audit decisions log names this folder or its files. Code comments cite earlier design decisions; see the file headers.
