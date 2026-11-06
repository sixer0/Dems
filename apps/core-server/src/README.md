# `apps/core-server/src`

Up: [`apps/core-server`](../README.md)

The source tree of the DEMS Core server. Every top-level folder below has its own README with its files, exports, dependencies, tests and related decisions.

## Top-level folders

| Folder | Purpose |
|---|---|
| [`camera-preview/`](./camera-preview/README.md) | Holds what the live camera preview and the idle microphone meters do: the handlers of operations 112 and 113 and of the `GET /preview/:token` stream, including its headers. |
| [`capture/`](./capture/README.md) | The capture unit: the one door (the `capture` seam) between the Core server and the capture worker process. |
| [`capture-notices/`](./capture-notices/README.md) | The no-device notices of the Core. |
| [`capture-session/`](./capture-session/README.md) | The capture of one recording session in real capture mode: starting the worker for the one open session, pairing ingest, stating the source facts, and stopping. |
| [`core/`](./core/README.md) | Core services of the server. |
| [`credential-store/`](./credential-store/README.md) | The Core credential store: the one place for every key the Core holds for data at rest (the STT credential key, camera credential keys and the per-session recording keys), with the envelope format and the fragment cipher built on them. |
| [`db/`](./db/README.md) | Everything about the Core's PostgreSQL database: the typed Drizzle schema, the SQL migrations, the database commands (create, migrate, status), the pure slice-to-table mapping, the store that writes it, the seed and the reset routine. |
| [`engine/`](./engine/README.md) | The engine host. |
| [`evidence-export/`](./evidence-export/README.md) | Evidence export: background export jobs, one export package per item (verified source, archive with the decrypted camera files, signed export manifest), the signed download token, sweeps at boot, and the receiver-side verification tool. |
| [`evidence-facts/`](./evidence-facts/README.md) | States what the Core knows about an evidence item beyond its stored rows, such as the media state of each kind of item, so that clients do not guess. |
| [`evidence-verify/`](./evidence-verify/README.md) | Verification of a real sealed evidence package at the Core: reading the package folder, opening its fragments with the session keys, running the checks, and recording and answering the verdict. |
| [`lcd/`](./lcd/README.md) | The Core's side of the LCD front panel: the bridge that posts each channel's state to the LCD backend every 2 seconds, the read of the panel firmware word (operation 114), and the proxy of the vendor-only panel setup (operations 115 and 116). |
| [`media-stream/`](./media-stream/README.md) | Media streaming of sealed evidence: the signed media session token, `Range` header handling, the seek index, and reading a camera file of a sealed v2 package as plaintext ranges for `GET /media/:token`. |
| [`modules/`](./modules/README.md) | The API operations of the Core, one folder per area. |
| [`plugins/`](./plugins/README.md) | Cross-cutting Fastify plugins: configuration, the database pool, logging, and the stages of the request pipeline (origin guard, authenticate, throttle, permission guard, error envelope, response headers, readiness). |
| [`realtime/`](./realtime/README.md) | The realtime channel: fills the `publish` seam (what a unit of work says after its commit) and registers the one socket route `GET /ws`; the hub decides which sockets get which message. |
| [`sealing/`](./sealing/README.md) | The steps of the v2 sealing pipeline as a library: the six steps in order with their checkpoints and resume rules, the step journal on `sealing_jobs`, signing helpers, and the `FINALIZE_TRANSCRIPT` step. |
| [`sealing-host/`](./sealing-host/README.md) | The composition of the sealing pipeline in the running Core, in real capture modes only: it supplies the production ports (journal, session keys, installation identity, session reader, transcript step, progress) to `src/sealing`. |
| [`transcript-package/`](./transcript-package/README.md) | The transcript files of a sealed package as the transcript operations use them: read-only access to the sealed machine transcript and the files of its revisions. |
| [`transcription/`](./transcription/README.md) | The Core's transcription composition: puts the `apps/transcriber` library to work with the Core's database, credential store and capture sessions (host statements, credential reveal and opener, model provenance, probe, scratch space and per-session runs). |
| [`__tests__/`](./__tests__/) | Tests of the files at this level (`capture-composition.ts`, `host-alias-socket.ts`) and slot replacement; one is a `*.db.test.ts`. No README. |

## Files at this level

| File | Role |
|---|---|
| [`app.ts`](./app.ts) | Application factory of the DEMS Core server. |
| [`capture-composition.ts`](./capture-composition.ts) | The composition of production capture. |
| [`config.ts`](./config.ts) | Configuration module of the DEMS Core server. |
| [`host-alias-socket.ts`](./host-alias-socket.ts) | The one local-socket client of the Core, and the platform seam of the address helper. |
| [`index.ts`](./index.ts) | Entry point of the DEMS Core server. |
| [`segment-probe-socket.ts`](./segment-probe-socket.ts) | The segment probes of smart attach. |
| [`test-configuration.ts`](./test-configuration.ts) | The mark of a test configuration. |
| [`version.test.ts`](./version.test.ts) | Tests of `version.ts`. |
| [`version.ts`](./version.ts) | Version of the DEMS Core server. |

## How the pieces fit

`index.ts` loads the configuration (`plugins/config`), builds the app with `app.ts`, runs the boot steps (database checks, engine rehydration, capture boot checks) and opens the listener. `app.ts` registers the plugins of `plugins/` and the route modules of `modules/`. Modules call the units at the top level (`engine`, `capture`, `sealing-host`, `evidence-export` and others) through their `index.ts`.
