---
task_id: 2026-10-21_bare_metal_bench
date: 2026-10-22
agent: explore (row 1)
scope: Q1 ExecStart form, Q2 console serving, Q3 env key names (code read only; Graft not used, direct grep/read)
---

# Row 1: Core runtime facts (Q1-Q3)

Paths are relative to /Users/gsp-budi/Documents/DEMS. Names only, no values read from any secret.

## Q1. How the Core starts (ExecStart form)

| Fact | Evidence |
|---|---|
| There is NO build step and no built JS for the Core. The only start scripts are `"start": "tsx src/index.ts"` and `"dev": "tsx watch src/index.ts"`. No `build` script exists in the package. | apps/core-server/package.json:7-8 (scripts block 6-28) |
| `tsx` 4.23.15 is a runtime `dependency` (not dev), so it is present after `npm ci` (no `--omit=dev` problem) | apps/core-server/package.json:46 |
| Entry file: `apps/core-server/src/index.ts` (top-level `await`, ESM: `"type": "module"`) | src/index.ts:106-107; package.json:5 |
| The Docker entrypoint's production-shaped form: `cd $TREE/apps/core-server` then `exec setpriv ... -- $TREE/node_modules/.bin/tsx src/index.ts` (no Node flags) | deploy/docker/rootfs/opt/dems/docker/dems-entrypoint.sh:105-107 |
| tsx exists at the workspace root: `node_modules/.bin/tsx` and `node_modules/tsx/dist/cli.mjs` (hoisted workspace) | `ls` on the Mac tree (command output) |
| Docker `CMD ["core"]`, ENTRYPOINT dems-entrypoint | deploy/docker/Dockerfile:266-267 |

Derived candidate ExecStart (derivation, not run on a host; confirm at 9A/H-16):

```
WorkingDirectory=<install-dir>/apps/core-server
ExecStart=<abs node dir>/node <install-dir>/node_modules/tsx/dist/cli.mjs src/index.ts
```
Equivalent to the Docker form `<install-dir>/node_modules/.bin/tsx src/index.ts` (a script with a `#!/usr/bin/env node` shebang would need `node` on the unit's PATH, so the explicit absolute-node plus cli.mjs form fits HOST-33's "absolute path of node"). The shebang of `.bin/tsx` was not read; the `cli.mjs` path was only listed, not opened. Label: hypothesis for the exact `cli.mjs` invocation; the Docker `.bin/tsx` form is read from source.

Constraints on the start line:
- No diagnostic/heap/inspect switch and no `NODE_OPTIONS`: the Core refuses with `CAPTURE_HOST_DIAGNOSTIC_SWITCH` or `NODE_OPTIONS_SET` when `process.execArgv` matches `/^--(?:report|diagnostic|heap|inspect)/` or `NODE_OPTIONS` is defined in the env (even empty). Sources: src/index.ts:127-128; src/capture/boot/host-checks.ts:318, :403. Asked in production only (index.ts:121-122 comment). Docker entrypoint does `unset NODE_OPTIONS` (entrypoint:33). Note: tsx itself may add `--import`/loader args to execArgv; those do not match the regex (regex judged from source only; not run).
- Required cwd: nothing in the Core resolves from cwd for its own files. Error log, config, migrations resolve from `import.meta.url`: error log `<tree>/apps/core-server/logs/errors.log` (src/plugins/logger/error-log.ts:34-40); data dir `<tree>/.data` (src/plugins/config/load-config.ts:53-60). `process.cwd()` is used only for a relative `DEMS_MEDIA_DIR` (src/db/commands/media-store-root.ts:73). Docker still cd's to `apps/core-server` and the profile file G uses `WorkingDirectory=<install-dir>` (scripts/host/70-core-unit.sh:30); `apps/core-server` is the safe choice, since `tsx src/index.ts` is a relative path.
- Data dir is NOT configurable: `loadConfig({ env: process.env })` passes no `dataDir` (src/index.ts:58), so it is always `<install-dir>/.data` (DEFAULT_DATA_DIR, load-config.ts:53-60), which holds `pg.env` (CONNECTION_FILE_NAME, src/config.ts:137). The data dir and `apps/core-server/logs/` must be writable by the service user in a root-owned tree (Docker: chown dems-core, 0700, entrypoint:5, :49-50). Relevant to HOST-05/06 and row 4's pg.env question. The error-log write failure path is non-fatal by code reading (error-log.ts:205-214 catches), but the boot media/evidence checks need the data dir.
- The listen host is the constant `127.0.0.1` (LISTEN_HOST, src/config.ts:47; src/index.ts:136). Port from `DEMS_CORE_PORT`, default 4420, only 4420..4423 allowed (src/config.ts:51, :255-265; the exact allowed list is in `LISTEN_PORTS`, not opened).
- Shutdown on SIGTERM/SIGINT, 10 s timeout (src/index.ts:33, :101-102). Suggests `Type=simple`, default KillSignal, `TimeoutStopSec` above 10 s (inference).
- Startup does top-level `await app.ready()` and boot checks before `listen`, so the port opens only after boot succeeds (src/index.ts:106-136). Do not use `Type=notify`; no sd_notify code was found (not searched exhaustively: unknown).

## Q2. Who serves the web console

Answer: In a non-Docker install the Core does NOT serve the console. The console is served by the Vite development server (`vite`, `apps/core-web`), 127.0.0.1:5173, started with a proxy to the Core. A `vite build` bundle is Simulated-only and is not served by anything.

| Fact | Evidence |
|---|---|
| Core registers no static-file plugin; `@fastify/static` is not a dependency. grep for `@fastify/static`/`fastify-static`/`core-web/dist` under apps/core-server/src, its package.json, root package.json, deploy, scripts found no file | grep output (empty); apps/core-server/package.json:29-50 |
| Docker README states: "The Core serves no web console; only the Vite development server in Live mode talks to a Core, from origin http://127.0.0.1:5173" | deploy/docker/README.md:51 |
| `core-web` scripts: `dev: vite`, `build: vite build && tsc -b`, `preview: vite preview` | apps/core-web/package.json:6-12 |
| Vite dev server: host 127.0.0.1, port 5173, strictPort; preview 127.0.0.1:4173 strictPort | apps/core-web/vite.config.ts (`server` and `preview` blocks) |
| Live mode proxy only when `DEMS_CORE_PROXY_PORT` is set (4420-4423): `/api/v1`, `/ws`, `/media`, `^/exports/exs_` to `http://127.0.0.1:<port>`; the proxy exists in `vite serve` only, not in `vite preview` or a build | apps/core-web/vite.config.ts (coreDevProxy, `command === 'serve' && !isPreview`) |
| Core's Origin guard accepts only `http://127.0.0.1:5173` (and 5176-5178 for lanes). No `localhost` | apps/core-server/src/config.ts:95-105 |
| A `vite build` of core-web is Simulated-only by design; it never talks to a Core (`core-mode.ts` rule 1). The packaged build mode (`VITE_DEMS_CORE_ORIGIN=same-origin`) expects "the packaged launcher" to serve app, health and `/ws` from one origin; that launcher is not in the files read | deploy/docker/README.md:40; apps/core-web/src/lib/core-endpoint.ts:8-12; core-mode.ts not opened |
| Docker form: service `console` (profile `console`), `command: ["console"]`, runs `node <vite.js> --configLoader runner` in `$TREE/apps/core-web` as dems-console, env `DEMS_CORE_PROXY_PORT` = Core port (default 4420). `--configLoader runner` is needed because the root-owned tree refuses Vite's default temp-file write | deploy/docker/compose.yaml:6, :116, :122-123; entrypoint:109-118; README.md:115 |
| Access path stated by the package: open `http://127.0.0.1:5173` on the host itself, never `localhost`, choose Live mode, or `ssh -L 5173:127.0.0.1:5173 <host>` | deploy/docker/README.md:46, :115 |
| Dev-server writable dir: `apps/core-web/node_modules/.vite` (dependency cache), owner service console account, 0700 | Dockerfile:232-233; entrypoint comment :114-116 |

Consequences for the plan (stated as inferences):
1. Row 32 (web console build) is N/A for a Live-mode bench: nothing serves a built bundle. `apps/core-web/dist` exists on the Mac (ls) but is not read by any served path found.
2. The console needs its own service (a second unit, Vite dev server on 127.0.0.1:5173, `DEMS_CORE_PROXY_PORT=4420`, `--configLoader runner`) or must be run by hand. File G of the profile covers only the Core; no console unit exists in scripts/host (grep of scripts/host for `vite|5173|console` found only the INSTALLER-NOTE console steps, not a unit).
3. OI-2 (SSH `-L`) must forward to 127.0.0.1:5173 (the console), not to the Core port 4420; the Origin guard would otherwise reject a browser page not at origin `http://127.0.0.1:5173`. The local forward must keep local port 5173 so the browser origin matches (README.md:115 says the same).
4. Vite's dev server is not hardened for a network (README.md:115); it stays on 127.0.0.1.
5. Node for Vite: `vite.js` located via `require.resolve('vite/package.json')` (entrypoint:113), so it is in the hoisted node_modules.

Unknown: whether a future "packaged launcher" exists elsewhere (searched deploy, scripts, apps/core-server only; apps/core-web `src/runtime/core-mode.ts` not opened).

## Q3. Environment key NAMES the Core reads

### A. Read by the Core process from the environment (the only reader is `loadConfig`, fed `process.env` at src/index.ts:58; src/index.ts:10 says it is the only file that reads `process.env` in the server)

All constants at apps/core-server/src/config.ts:61-76; read at apps/core-server/src/plugins/config/load-config.ts:75-103.

| Key | config.ts line | read at (load-config.ts) | Note |
|---|---|---|---|
| DEMS_CORE_PORT | 61 | :76 | default 4420, 4420-4423 only |
| DEMS_DEMO_CONTROLS | 62 | :77 | boolean parse (values not read) |
| DEMS_LOG_LEVEL | 63 | :78 | |
| DEMS_LCD_BACKEND_URL | 64 | :75 | |
| DEMS_CAPTURE_MODE | 65 | :81 | simulated or real |
| DEMS_CAPTURE_WORKER | 66 | :82 | path |
| DEMS_MEDIA_DIR | 67 | :83 | path, default `<data dir>/media/sessions` (config.ts:87, :396) |
| DEMS_CAPTURE_DEV_SOURCES | 68 | :86 | dev switch (HOST-34 grep target) |
| DEMS_CAPTURE_HELPER_FFMPEG | 69 | :87 | path |
| DEMS_CAPTURE_DEV_FAKE_MIC | 70 | :89 | dev switch |
| DEMS_INSTALLATION_DEVICE_ID | 71 | :102 | |
| DEMS_INSTALLATION_NAME | 72 | :103 | |
| DEMS_CAPTURE_RELAY | 73 | :93 | path |
| DEMS_CAPTURE_GUARD | 74 | :94 | path |
| DEMS_CAPTURE_ALIAS_SOCKET | 75 | :97 | path |
| DEMS_CAPTURE_AUDIO_HELPER | 76 | :100 | path |

Also read from `process.env` directly: `NODE_OPTIONS` (presence only), src/index.ts:128.

Removed unread: every variable whose name starts with `PG` is deleted from the environment at start (`removeDriverEnvironment`), names are logged as a warning. src/plugins/db/index.ts:152-161; src/index.ts:54, :108-110. So `PGHOST`, `PGPASSWORD`, etc. are ignored (never used).

### B. NOT environment keys of the Core (do not put them in core.env)
- `DEMS_PG_HOST`, `DEMS_PG_PORT`, `DEMS_PG_DATABASE`, `DEMS_PG_APP_ROLE`, `DEMS_PG_APP_PASSWORD`: the five keys of the connection FILE `<data dir>/pg.env`, read by the loader (src/config.ts:138-145, CONNECTION_FILE_KEYS; src/plugins/config/load-config.ts:105-106). Not read from the environment by the Core (grep of src/cli for `process.env` found no such read).
- `DEMS_PG_OWNER_ROLE`, `DEMS_PG_OWNER_PASSWORD` (plus HOST/PORT/DATABASE): keys of the owner settings file, read by the `db:*` CLI commands, not the Core (src/db/commands/owner-connection.ts:35-39). Row 2 owns this.
- CLI-only environment reads (not the server): `DEMS_MEDIA_DIR` and the demo-package environment in `db:seed`/`db:reset` (src/db/seed/cli.ts:100; src/db/reset/cli.ts:246, :254, :280); `INIT_CWD` in `evidence:verify-export` (cli/verify-export.ts:48); `cli/operator-set.ts:48` lists environment NAMES only (`Object.keys(process.env)`, for the attended-prompt check). `src/db/commands/cli.ts:189` scrubs driver env for DB commands.
- Audit record strings (`DEMS_EVIDENCE_SIGNING_KEY_PROVISIONED`, `..._ROTATED`) are record names, not env keys (cli/production-key-command.ts:322; cli/rotate-key-command.ts:173).
- Names that appear only in tests or comments were not classified (e.g. DEMS_BOOT_CHECKS_SKIP, DEMS_CAPTURE_TEST_SIGNING_KEY, DEMS_KILL_MATRIX, DEMS_LOCAL_SESSION_ATTENDED, DEMS_REQUIRE_RECORDED_FILES): a grep of src and cli excluding tests found no non-test, non-comment read of them. Label: no read found (a read outside src/cli, e.g. test/support, was not searched).
- Docker-only names, not Core keys: DEMS_IMAGE, DEMS_PG_PORT (compose variable), DEMS_LCD_SERIAL_*, DEMS_LCD_BAUD (deploy/docker/.env.example; compose.yaml:83-101). LCD backend variables DEMS_BIND, DEMS_PORT, DEMS_DEV, DEMS_BAUD, DEMS_REKAM_DIR, DEMS_CH_NAMES, DEMS_LEASE_S belong to the LCD backend (compose.yaml:95-101), out of scope.
- Console-side: `DEMS_CORE_PROXY_PORT` (apps/core-web/vite.config.ts, coreDevProxy) and build-time `VITE_DEMS_CORE_ORIGIN` (core-endpoint.ts:8-9).

## Gaps / unknown
- Exact `tsx` cli.mjs argument form on a host: not run. The Docker `.bin/tsx src/index.ts` form is the evidence.
- Whether tsx adds execArgv that trips the DIAGNOSTIC_SWITCH regexp: judged from regex only (src/capture/boot/host-checks.ts:318); to be seen at 9A/H-16.
- The allowed port list `LISTEN_PORTS` and the value grammars were not opened for each key.
- core-web `core-mode.ts` and any "packaged launcher" were not opened.
- Methods: direct Read/grep (the Graft graph was not queried; findings are from file reads).
