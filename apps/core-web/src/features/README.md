# src/features

Up: [src](../README.md)

## Purpose

One folder per page area of the web console. A feature folder holds the page component that a route file in [`../routes/`](../routes/README.md) renders, plus its pure model, hooks, live readers (TanStack Query readers of Core operations), panels and styles. Features share building blocks from [`../components/`](../components/README.md), [`../lib/`](../lib/README.md) and [`../runtime/`](../runtime/README.md); the data and words come from `@dems/shared`.

## Files

| File | Role |
|---|---|
| [`alerts/`](alerts/README.md) | Alerts page: every alert of the Core, acknowledge one (`/alerts`) |
| [`api-reference/`](api-reference/README.md) | API Reference page: the Core's OpenAPI document with Scalar and the Realtime panel (`/developer/api`) |
| [`commissioning/`](commissioning/README.md) | Camera network commissioning for the technician (`/admin/commissioning`) |
| [`dashboard/`](dashboard/README.md) | Dashboard, the landing page after sign-in (`/dashboard`) |
| [`devices/`](devices/README.md) | Devices and Inputs: camera tiles with live preview, audio inputs, registered devices (`/devices`) |
| [`evidence/`](evidence/README.md) | Evidence list and evidence detail (`/evidence/`, `/evidence/$evidenceId`) |
| [`home/`](home/README.md) | The stack proof view, shown inside the Stack Check page (no route of its own) |
| [`login/`](login/README.md) | Login page (`/login`) |
| [`network-time/`](network-time/README.md) | Network and Time page (`/network-time`) |
| [`paired-devices/`](paired-devices/README.md) | Paired Devices: pairing codes and paired tablets (`/admin/devices`) |
| [`security-audit/`](security-audit/README.md) | Security and Audit page: posture, audit hash chain, audit log (`/security-audit`) |
| [`session-monitor/`](session-monitor/README.md) | Session Monitor: the live view of the current session (`/session/`) |
| [`session-new/`](session-new/README.md) | Start New Session, a three-step flow (`/session/new`) |
| [`sessions/`](sessions/README.md) | Sessions: every finished session with its state (`/session/history`) |
| [`stack-check/`](stack-check/README.md) | Stack diagnostic page (`/stack-check`) |
| [`storage/`](storage/README.md) | Storage page: capacity, volumes, retention and storage policy (`/storage`) |
| [`system/`](system/README.md) | System and Maintenance page: services, update, settings, diagnostics (`/system`) |
| [`users-roles/`](users-roles/README.md) | Users and Roles: operators, role matrix, user commands (`/admin/users`) |

## Main exports

Each feature exports its page component from `index.tsx` (for example `DashboardPage`, `EvidenceListPage`, `EvidenceDetailPage`), which the matching route file imports. The route table is in [`../routes/_app/README.md`](../routes/_app/README.md).

## Core operations, state and shared modules

Listed per feature in each folder's README. In SIMULATED mode the pages read the simulator state through `useSim` (`@dems/shared/sim`); in LIVE mode the same state is replicated from the Core, and commands go through `useCoreActions` (`@dems/shared/live`).

## Tests

Each feature with tests has a `__tests__/` folder of its own (`alerts`, `api-reference`, `home` and `stack-check` have none). Page-level tests live in [`../test/`](../test/README.md).

## Related decisions

See the README of each feature. Decision D280 asked for these per-folder READMEs.
