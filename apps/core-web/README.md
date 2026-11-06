# DEMS web console (`@dems/core-web`)

Back to the [repository README](../../README.md).

## What it is

The web console is the operators' and administrators' browser app: Dashboard, Session Monitor, Start Session, Evidence, Devices and Inputs, Paired Devices, Users and Roles, Security and Audit, Storage, Network Time and System. It is a React app built with Vite, TanStack Router, Tailwind CSS and TanStack Query.

It runs in one of two data modes (`src/runtime/core-mode.ts`):

- **LIVE**: the Core server (`apps/core-server`) is the source of truth. The Vite server proxies `/api/v1`, `/ws` and the signed paths `/media/...`, `/exports/...`, `/preview/...` to the Core on `127.0.0.1:<DEMS_CORE_PROXY_PORT>` (`vite.config.ts`), so the browser talks to one origin and the session cookie stays same-origin. The proxy forwards `Origin` and `Cookie` unchanged; the Core's origin guard checks them.
- **SIMULATED**: an in-browser simulator from `@dems/shared` stands in for the Core. Used for demos and development only.

The shared contract (API client, operations, i18n words, theme tokens) is `packages/shared` (`@dems/shared`).

The dev server binds `127.0.0.1:5173` (strict port). Open it as `http://127.0.0.1:5173`, not `localhost`: the Core accepts only the exact `127.0.0.1` origins (`WEB_CONSOLE_ORIGINS` in `apps/core-server/src/config.ts`; lanes use 5176 to 5178).

## Folder layout of `src/`

A README in every source folder describes its files, exports and tests: start at [`src/README.md`](src/README.md).

| Folder or file | What it holds |
|---|---|
| `main.tsx`, `router.tsx`, `routeTree.gen.ts` | App entry, router setup and the generated route tree |
| `routes/` | File routes: `login.tsx`, `_app.tsx` (signed-in shell) and `_app/` (dashboard, devices, evidence, session, alerts, storage, system, network-time, security-audit, stack-check, `admin/` for users, devices and commissioning, `developer/api`) |
| `features/` | One folder per page area: `alerts`, `api-reference`, `commissioning`, `dashboard`, `devices`, `evidence`, `home`, `login`, `network-time`, `paired-devices`, `security-audit`, `session-monitor`, `session-new`, `sessions`, `stack-check`, `storage`, `system`, `users-roles` |
| `components/` | `shell` (layout, navigation, top bar, notifications), `ui`, `composed`, `media` and small shared components |
| `runtime/` | Boot, data mode resolution, the production lock, the live host, error sink, owed sign-out storage |
| `lib/` | Core endpoint and queries, error words, download, CSP of the packaged build, helpers |
| `motion/` | Motion policy and ambient animation helpers |
| `i18n.ts`, `i18n-web.ts` | Words of the console |
| `assets/` | Brand assets |
| `test/` | Page-level tests and the test setup |

`public/` holds `favicon.svg` and `kiosk.html`.

## Requirements and setup

Node 26.8.2 and npm 11.19.1 (see the root README). From the repository root:

```sh
npm install
```

For LIVE mode a running Core server is needed (see [`apps/core-server/README.md`](../core-server/README.md)).

## Run, test, typecheck

| What | Command (repository root) |
|---|---|
| Dev server, SIMULATED | `npm run dev:web` |
| Dev server, LIVE against the Core on 4420 | `DEMS_CORE_PROXY_PORT=4420 VITE_DEMS_CORE_MODE=live npm run dev:web` |
| Build | `npm run build -w @dems/core-web` (`vite build && tsc -b`; the root `npm run build` builds shared, mock-core and the console) |
| Preview a build | `npm run preview -w @dems/core-web` (`127.0.0.1:4173`) |
| Tests | `npm test -w @dems/core-web` (Vitest, jsdom) |
| Typecheck | `npm run typecheck -w @dems/core-web` (`tsc -b`) |
| Lint | `npm run lint -w @dems/core-web` (oxlint) |

## Configuration

Read at start (dev server) or build time. No `.env` file is used.

| Variable | Read by | Purpose |
|---|---|---|
| `DEMS_CORE_PROXY_PORT` | `vite.config.ts` (dev server only) | `4420` to `4423`: turns on the proxy to the Core. Unset: no proxy. Any other value stops the dev server |
| `VITE_DEMS_CORE_MODE` | `src/runtime/boot.ts` | `live` or `simulated`: the default data mode when nothing is stored |
| `VITE_DEMS_PRODUCTION_LOCK` | `src/runtime/boot.ts` | Exactly `1`: the production console lock (below). Anything else is off |
| `VITE_DEMS_CORE_ORIGIN` | `src/lib/core-endpoint.ts` | `same-origin` only for the packaged build |

The console has no secrets of its own; it uses the operator's session cookie set by the Core.

## Production notes

- systemd unit `dems-console`, user `dems-console`, working directory `/opt/dems/core/apps/core-web`, port 5173. It runs the Vite server with `DEMS_CORE_PROXY_PORT=4420 VITE_DEMS_CORE_MODE=live`, and the drop-in `dems-console.service.d/production-lock.conf` sets `VITE_DEMS_PRODUCTION_LOCK=1`.
- Unit files and deploy guide: [`deploy/bench-config/README.md`](../../deploy/bench-config/README.md).
- Stopping `dems-console` leaves it `failed` with status 143 (the Vite server's exit on SIGTERM); it starts cleanly. A console restart ends the web sign-ins (decisions D115, D246).

## Key facts from the 2026-11-05 audit

- **Production console lock** (D25, D29). With `VITE_DEMS_PRODUCTION_LOCK=1` the console always runs LIVE, ignores any stored or configured mode, and the login page offers no Simulated mode. On a REAL_PRODUCTION Core, values without a real data source are shown as "Not reported".
- **Live previews** (D51, D53, D62; fix wave W4, D246). Camera tiles on Devices, Dashboard, Session Monitor and Start Session show the Core's live preview (`/preview/cps_...`, operation 112). The preview is reach-gated: no token is asked for while the Core's last reading says the camera is not reachable, until the operator presses "Try again" (`features/devices/reach-gated-preview.tsx`). Failed pictures back off from 2 s to 30 s; Devices tiles open automatically within the Core's pipeline cap and close when the tab is hidden (`features/devices/camera-live-preview.ts`). The preview URL is a bearer value and is never logged or stored.
- **Camera and microphone pairs (D5).** The selector, monitor, Start Session and Evidence pages show the VIDEO-0N / MIC-0N pairs and the per-pair audio tracks.
