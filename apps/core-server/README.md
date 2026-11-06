# DEMS Core server (`@dems/core-server`)

Back to the [repository README](../../README.md).

## What it is

The Core server holds the recording truth of a DEMS installation. It runs on the interview-room host and owns the PostgreSQL database, the operators, roles and permissions, the pairing of tablets, the capture of up to four cameras with their paired microphones, the sealing of each recording into a signed evidence package, export, transcription and the audit trail.

It is a Fastify server written in TypeScript, started with `tsx` (no build step).

| Talks to | How |
|---|---|
| Web console (`apps/core-web`) | HTTP JSON API under `/api/v1` and the realtime socket `GET /ws`, on `127.0.0.1:4420`. In development and on the bench host the console's Vite server proxies both to the Core, so the browser sees one origin |
| Tablet app (`apps/mobile`) | The same `/api/v1` API and `/ws` socket, plain `http` / `ws` (residual R263-TLS). Signed media, export and preview paths (`/media/...`, `/exports/...`, `/preview/...`) carry their own bearer token |
| Capture worker, relay and guard (`apps/capture-worker`) | Child processes. The worker speaks **capture protocol 6**: one JSON object per line on its standard input and output, contract in `packages/capture-protocol` (`CAPTURE_PROTOCOL_VERSION = 6`) |
| LCD front panel (`apps/lcd-backend`) | Every 2 s the Core posts each channel's state to `/api/dems/ch/<n>/status` on `DEMS_LCD_BACKEND_URL` (6 s lease) and reads `/api/dems/status`; it also proxies the console's panel setup (`src/lcd/`) |
| Transcriber (`apps/transcriber`) | A library imported in-process (`src/transcription/`) |
| PostgreSQL 18 | `127.0.0.1:4432`, database `dems_demo` for port 4420, through Drizzle; migrations in `src/db/migrations` |

The shared contract (types, operations, words, constants such as ports and the `/ws` path) is `packages/shared` (`@dems/shared`).

The listen host is the constant `127.0.0.1` (`LISTEN_HOST` in `src/config.ts`); no variable changes it. The port is 4420; 4421 to 4423 are development lanes, any other value stops the boot.

## Folder layout of `src/`

Per-folder documentation: [src/README.md](src/README.md).

| Folder or file | What it holds |
|---|---|
| `index.ts` | Entry point: loads the configuration, builds the app, runs the boot steps, listens. The only file that reads `process.env` |
| `app.ts` | The Fastify app factory: registers plugins and modules |
| `config.ts` | Constants and pure parsers of the configuration (ports, origins, environment variable names, connection file keys) |
| `plugins/` | Cross-cutting Fastify plugins: `config`, `db`, `logger`, `authenticate`, `origin-guard`, `permission-guard`, `readiness`, `throttle`, `error-envelope`, `response-headers` |
| `modules/` | The API operations, one folder per area: `admin`, `alerts`, `camera-preview`, `capture-config`, `capture-discovery`, `capture-inputs`, `demo`, `devices`, `evidence`, `evidence-export`, `health`, `identity`, `media-stream`, `network-time`, `pairing`, `rbac`, `recording-fragments`, `sealing`, `security-audit`, `sessions`, `storage`, `stt-config`, `system`, `transcript-chunks`, `transcripts` |
| `core/` | Core services and their boot checks |
| `engine/` | The session engine host: rehydration at boot and the committed state |
| `realtime/` | The `GET /ws` socket and the publish seam |
| `db/` | Database: `schema`, `migrations`, `commands` (create, migrate, status), `seed`, `reset`, `store`, `mapping`, `fixtures` |
| `capture/` | The capture supervisor, adapters (cameras, microphones), the development fence, the boot checks of real capture (`capture/boot/checks.ts`), host alias helper |
| `capture-composition.ts` | Composition of production capture |
| `capture-session/` | The capture of one session |
| `capture-notices/` | The no-device notices |
| `camera-preview/` | Live camera preview and idle microphone meters (decisions D51, D53) |
| `media-stream/` | Signed media sessions for playback |
| `credential-store/` | The one store of keys for data at rest |
| `sealing/`, `sealing-host/` | The sealing pipeline (library) and its composition in the running Core |
| `evidence-export/`, `evidence-verify/`, `evidence-facts/` | Export, verification of a sealed package, and the facts the Core states about an evidence item |
| `transcription/`, `transcript-package/` | The Core's use of `@dems/transcriber` and the transcript files of a sealed package |
| `lcd/` | The bridge to the LCD front panel |
| `host-alias-socket.ts`, `segment-probe-socket.ts` | Clients of the host helper sockets |
| `version.ts` | The server's version word |

Other folders of the app: `cli/` (host commands for keys and operator passwords), `test/` (DB global setup, acceptance tests, helpers, static rules, test support such as the fake ONVIF camera).

## Requirements and setup

- Node 26.8.2 for development (root `engines` `>=26.8.2 <27`), npm 11.19.1.
- PostgreSQL 18 on `127.0.0.1:4432`. In development this is the project-local cluster from the root scripts `pg:*`; port 5432 is refused (`FOREIGN_DATABASE_PORT`).
- For real capture: the capture worker, relay, guard and audio helper built from `apps/capture-worker` and an FFmpeg 9.0.2 build.

From the repository root:

```sh
npm install
npm run pg:init          # once: creates the project cluster in .data/
npm run pg:start
npm run db:create
npm run db:migrate
npm run db:seed
```

Other database scripts: `npm run db:status`, `npm run db:reset`, and inside this workspace `npm run db:generate -w @dems/core-server` (drizzle-kit). Stop the cluster with `npm run pg:stop`.

## Run, test, typecheck

| What | Command (repository root) |
|---|---|
| Run with reload | `npm run dev:server` |
| Run | `npm run start:server` |
| Unit tests (no database) | `npm test -w @dems/core-server` (Vitest project `unit`) |
| Database tests | `npm run test:db` (Vitest project `db`) |
| Typecheck | `npm run typecheck -w @dems/core-server` (`tsc --noEmit`) |
| Lint | `npm run lint -w @dems/core-server` (oxlint) |
| Coverage | `npm run coverage -w @dems/core-server` |
| Sealing end-to-end (gated) | `npm run test:seal-e2e` |
| Development session end-to-end (gated) | `npm run test:dev-session-e2e` |

**Database test isolation rule.** Files named `*.db.test.ts` (and everything under `test/acceptance/`) belong to the `db` project and run only through `npm run test:db`. Its global setup (`test/global-setup.db.ts`) attaches to PostgreSQL on `127.0.0.1:4432`, fails (never skips) when nothing answers there, and creates and drops throw-away databases.

- Run them only against the project-local cluster (`npm run pg:start`), never against a database that holds real data.
- On the bench host port 4432 belongs to the production cluster. DB tests run there only inside a **DB test window** (decision D32): production and `postgresql@18-main` are stopped, the project cluster is started in their place, the listed files run with `--maxWorkers=2`, then production is restored and smoke-checked. The full procedure is in the root README, section **Deploy procedure (short)**.
- Heavy runs take lock files under `.locks/` (`heavy-host.lock`, `db-migrate.lock`) at the repository root.

## Host commands (`cli/`)

All run as workspace scripts. Each file's header in `cli/` gives its full argument list.

| Script | What it does |
|---|---|
| `npm run evidence:production-key -w @dems/core-server -- --data-dir <absolute directory>` | Creates the production evidence signing key |
| `npm run evidence:rotate-key -w @dems/core-server -- --data-dir <absolute directory>` | Rotates the signing key |
| `npm run evidence:mark-compromised -w @dems/core-server -- --data-dir <absolute directory> --key-id <key id>` | Marks a key as compromised |
| `npm run evidence:dev-key -w @dems/core-server` | Development signing key under `<data directory>/signer` (`src/sealing/dev-key-cli.ts`) |
| `npm run evidence:verify-export -- <archive.zip>` | The receiver's check of an exported evidence package |
| `npm run operator:set-password -w @dems/core-server -- --database <name> --data-dir <absolute directory> --username <username>` | Sets an operator's password from the host (prompts for it) |

## Configuration

The Core reads environment variables once at start and one connection file. The template for production is [`deploy/bench-config/core.env.example`](../../deploy/bench-config/core.env.example); it documents every key with its allowed values. Never commit a filled copy.

| Variable | Purpose |
|---|---|
| `DEMS_CORE_PORT` | Listen port, 4420 (4421 to 4423 for lanes) |
| `DEMS_DEMO_CONTROLS` | Demo controls on or off (production: off) |
| `DEMS_LOG_LEVEL` | `fatal`, `error`, `warn`, `info` (default), `debug`, `trace`, `silent` |
| `DEMS_LCD_BACKEND_URL` | `http://127.0.0.1:<port>` of the LCD backend; unset disables the bridge |
| `DEMS_CAPTURE_MODE` | `simulated` (default) or `real` |
| `DEMS_CAPTURE_WORKER`, `DEMS_CAPTURE_RELAY`, `DEMS_CAPTURE_GUARD`, `DEMS_CAPTURE_AUDIO_HELPER` | Absolute paths of the capture programs |
| `DEMS_CAPTURE_ALIAS_SOCKET` | Absolute path of the capture host's address helper socket |
| `DEMS_MEDIA_DIR` | Media root; default `media/sessions` under the data directory |
| `DEMS_CAPTURE_DEV_SOURCES`, `DEMS_CAPTURE_HELPER_FFMPEG`, `DEMS_CAPTURE_DEV_FAKE_MIC` | Development fence: development sources, the helper program, the fake microphone (`tone` or `speech`). Production: no development sources |
| `DEMS_INSTALLATION_DEVICE_ID`, `DEMS_INSTALLATION_NAME` | Installation identity stated in the signed manifest |
| `DEMS_CAMERA_AUTOATTACH`, `DEMS_CAMERA_SEGMENT_CIDR` | Smart attach sweep (decision D62); the CIDR is one IPv4 `/24`, for example `192.168.x.0/24`, required while the sweep is on |
| `DEMS_CAMERA_DEFAULT_USER`, `DEMS_CAMERA_DEFAULT_PASSWORD` | Optional pair: the credential the cameras already have, used only to test and store an auto-adopted camera. Secret |

Files in the data directory (`<repository root>/.data` by default):

- `pg.env` (mode 0600, read by the server): `DEMS_PG_HOST`, `DEMS_PG_PORT`, `DEMS_PG_DATABASE`, `DEMS_PG_APP_ROLE`, `DEMS_PG_APP_PASSWORD`. The database actually used follows the port.
- `pg.owner.env` (read by the `db:*` commands): the owner role's keys `DEMS_PG_OWNER_ROLE`, `DEMS_PG_OWNER_PASSWORD` and the same host, port and database keys.
- `transcriber/host.json` (optional): where the speech-to-text engine and models are (`src/transcription/host.ts`).

There is no session secret in the environment: the cookie name is derived from the port (`dems_session_<port>`) and keys live in the Core's key store. Persistent errors are appended to `apps/core-server/logs/errors.log`.

## Production notes

- systemd unit `dems-core`, user `dems-core`, working directory `/opt/dems/core/apps/core-server`, environment file `/etc/dems/core.env`, port 4420 (health: `GET /api/v1/health`). It starts after `postgresql@18-main` and requires `dems-loopback-rule.service`, which lets only `dems-core` reach the capture ingest ports 8554 to 8564 on loopback.
- Unit files, the nftables rule and the full deploy-time guide (environment file, PostgreSQL roles, connection files, migrations): [`deploy/bench-config/README.md`](../../deploy/bench-config/README.md).
- A restart of the Core ends every sign-in (decisions D115, D246).

## Key facts from the 2026-11-05 audit

- **REAL_PRODUCTION boot checks.** With `DEMS_CAPTURE_MODE=real` and no demo controls the Core runs the boot checks of real capture (`src/capture/boot/checks.ts`): the worker program is configured and passes the path rule, the evidence store is private and supports hard links, the signing key loads, and more. A healthy start logs exactly one `CAPTURE_BOOT_CHECKS_PASSED` line with `"operation":"REAL_PRODUCTION"` and the worker version. A worker whose build stamp, version or protocol does not match is refused (`CAPTURE_WORKER_BUILD_STAMP_STALE`, `CAPTURE_WORKER_VERSION_MISMATCH`, `CAPTURE_WORKER_PROTOCOL_MISMATCH`). Anything without a real data source is reported as "Not reported" (D25).
- **Camera and microphone pairs (D5).** VIDEO-0N is paired with MIC-0N, fixed in the capture setup. An operator cannot move a microphone during a session (operation 81 answers `409 AUDIO_SOURCE_FIXED_BY_PAIRING`). A camera whose paired microphone is missing still records with a silent track, and the Core raises `PAIRED_MIC_MISSING`.
- **Capture protocol 6** with `capture-worker/0.8.0`: per-pair audio, `MIC-0N.m4a` tracks AUDIO-01 to AUDIO-04 (migration 0044), sealed and verified.
- **Tablet pairing.** A Supervisor issues a one-time code in the web console (Admin > Paired Devices); the tablet redeems it (`src/modules/pairing`; 3 failed redeems in 300 s lock redeeming for 60 s). No code is written in any README.
