# DEMS mock Core (`@dems/mock-core`)

Back to the [repository README](../../README.md).

## What it is

The mock Core is the stand-in server of the first DEMS demo. It is **not** the Core server and holds no data: it answers a health check and broadcasts a heartbeat, so that the web console and the tablet app can show a link to "a Core" without the real one. It is used by the Simulated and Heartbeat modes and by tests only; production uses `apps/core-server`.

- Fastify server bound to `127.0.0.1:4400` only (`MOCK_CORE_HOST`, `MOCK_CORE_PORT` in `@dems/shared/api`).
- `GET /api/v1/health`: a health answer of the shared `HealthResponse` form.
- `GET /ws`: a WebSocket that sends one heartbeat a second (`HEARTBEAT_INTERVAL_MS` = 1000) with an increasing `seq`, the server time and the client count. The upgrade is refused (HTTP 403) for an `Origin` outside the allowlist (`WEB_DEV_ORIGINS` and `SELF_ORIGINS` of the shared contract).
- The shared contract (paths, ports, `HeartbeatSchema`) is `packages/shared` (`@dems/shared`).

The tablet reaches it through `adb reverse` of port 4400 (`npm run mobile:reverse`).

## Folder layout

| Path | What it holds |
|---|---|
| `src/index.ts` | Entry point: builds the app, listens on `127.0.0.1:4400`, shuts down on SIGINT / SIGTERM |
| `src/app.ts` | App factory: CORS, WebSocket, heartbeat plugin, the health route, error handling. Performs no listen |
| `src/heartbeat.ts` | The heartbeat hub: sequence, client registry, 1 Hz ticker, the `/ws` route and its origin allowlist |
| `src/error-log.ts` | Persistent error log, one JSON object per line in `apps/mock-core/logs/errors.log` |
| `scripts/ws-probe.ts` | A WebSocket probe that reads heartbeats and checks them against the schema |
| `standalone/dems-web-launcher.cjs` | Dependency-free launcher of the packaged web demo: serves the built console, the health answer and the `/ws` heartbeat from one loopback origin, without Fastify |
| `test/` | Health, heartbeat, WebSocket origin and launcher tests |

## Requirements and setup

Node 26.8.2 and npm 11.19.1. From the repository root: `npm install`.

## Run, test, typecheck

| What | Command (repository root) |
|---|---|
| Run with reload | `npm run dev:mock` |
| Run | `npm run start -w @dems/mock-core` |
| Probe the heartbeat | `npm run probe:ws` (options after `--`: `--url`, `--count`, `--timeout`, `--origin`; exit 0 on valid heartbeats, 1 on timeout or invalid message, 2 on HTTP 403) |
| Tests | `npm test -w @dems/mock-core` (Vitest) |
| Typecheck | `npm run typecheck -w @dems/mock-core` (`tsc --noEmit`; `build` runs the same check) |
| Lint | `npm run lint -w @dems/mock-core` (oxlint) |

## Configuration

| Variable | Purpose |
|---|---|
| `LOG_LEVEL` | Level of the JSON logger; default `info` |

Host and port are constants of the shared contract, not configuration. The standalone launcher reads no environment variables.

## Production notes

Not deployed on the bench host; no systemd unit. Production uses the Core server ([`apps/core-server/README.md`](../core-server/README.md), [`deploy/bench-config/README.md`](../../deploy/bench-config/README.md)).
