# apps/core-web/src/routes/_app

Up: [routes](../README.md)

## Purpose

The file routes of every page inside the signed-in shell. The pathless layout [`../_app.tsx`](../_app.tsx) wraps them in `AppLayout` and sends a signed-out visit to `/login?redirect=...` before any of these routes load. Each file maps one URL to one page component from [`../../features/`](../../features/README.md), with its own guard or search schema where needed.

## Files

| File | Role |
|---|---|
| [`admin/`](admin/) | Administration routes, guarded per Core permission (see the sub-table below). |
| [`alerts.tsx`](alerts.tsx) | `/alerts`: every alert the Core holds, with its state and acknowledgement. |
| [`dashboard.tsx`](dashboard.tsx) | `/dashboard`. |
| [`developer/`](developer/) | `/developer/api`, the API Reference. |
| [`devices.tsx`](devices.tsx) | `/devices`: Devices & Inputs. |
| [`evidence/`](evidence/) | `/evidence` list and `/evidence/$evidenceId` detail. |
| [`index.tsx`](index.tsx) | `/`: redirects to `/dashboard` (replace); the `_app` guard runs first. |
| [`network-time.tsx`](network-time.tsx) | `/network-time`: Network & Time. |
| [`security-audit.tsx`](security-audit.tsx) | `/security-audit`: Security & Audit. |
| [`session/`](session/) | `/session` monitor, `/session/new` and `/session/history`. |
| [`stack-check.tsx`](stack-check.tsx) | `/stack-check`: developer diagnostic of the console build, reachable by URL only, for every signed-in operator. |
| [`storage.tsx`](storage.tsx) | `/storage`: Storage. |
| [`system.tsx`](system.tsx) | `/system`: System & Maintenance, host of the Demo Control Panel. |

Files of the subfolders:

| Subfolder file | URL | Guard or search |
|---|---|---|
| admin/-guard.ts | (no route) | `requireCorePermission(sim, permission)`: in Live mode, an operator without the permission is sent to `/dashboard` (replace) and `noteDeniedPage` records which page was refused. In Simulated mode the page opens and shows its own state. Kept out of the route tree by the `-` prefix. |
| admin/commissioning.tsx | `/admin/commissioning` | `CAPTURE_COMMISSION` (TECHNICIAN only) |
| admin/devices.tsx | `/admin/devices` | `PAIRING_MANAGE` |
| admin/users.tsx | `/admin/users` | `USER_ADMIN` |
| developer/api.tsx | `/developer/api` | none; the page chunk is lazy, so the Scalar reference loads only here |
| evidence/index.tsx | `/evidence/` | `q`, `status`, `caseType`, `investigator`, `from`, `to`, `page` |
| evidence/$evidenceId.tsx | `/evidence/$evidenceId` | `tab`: `media`, `metadata` or `integrity` |
| session/index.tsx | `/session/` | none; shows the NO SESSION state when idle |
| session/new.tsx | `/session/new` | `step` 1, 2 or 3 (default 1); without `SESSION_START` the operator is sent to `/dashboard` and the refusal is noted |
| session/history.tsx | `/session/history` | `q`, `state` (`SEALED` or `INCOMPLETE`); every role may open it |

## Main exports

Each route file exports `Route`. URL to component:

| URL | Component | Feature folder |
|---|---|---|
| / | (redirect to `/dashboard`) | |
| /alerts | `AlertsPage` | [`alerts`](../../features/alerts/README.md) |
| /dashboard | `DashboardPage` | [`dashboard`](../../features/dashboard/README.md) |
| /devices | `DevicesPage` | [`devices`](../../features/devices/README.md) |
| /evidence | `EvidenceListPage` | [`evidence`](../../features/evidence/README.md) |
| /evidence/$evidenceId | `EvidenceDetailPage` | [`evidence`](../../features/evidence/README.md) |
| /network-time | `NetworkTimePage` | [`network-time`](../../features/network-time/README.md) |
| /security-audit | `SecurityAuditPage` | [`security-audit`](../../features/security-audit/README.md) |
| /session | `SessionMonitorPage` | [`session-monitor`](../../features/session-monitor/README.md) |
| /session/new | `SessionNewPage` | [`session-new`](../../features/session-new/README.md) |
| /session/history | `SessionsPage` | [`sessions`](../../features/sessions/README.md) |
| /stack-check | `StackCheckPage` | [`stack-check`](../../features/stack-check/README.md) |
| /storage | `StoragePage` | [`storage`](../../features/storage/README.md) |
| /system | `SystemPage` | [`system`](../../features/system/README.md) |
| /admin/users | `UsersRolesPage` | [`users-roles`](../../features/users-roles/README.md) |
| /admin/devices | `PairedDevicesPage` | [`paired-devices`](../../features/paired-devices/README.md) |
| /admin/commissioning | `CommissioningPage` | [`commissioning`](../../features/commissioning/README.md) |
| /developer/api | `ApiReferencePage` | [`api-reference`](../../features/api-reference/README.md) |

## Core operations, state and shared modules

- No Core operation is called here. Guards read the router context: `selectCan` and `Permission` of `@dems/shared/sim` (session new), and the Core mode and permission list of the data source (`admin/-guard.ts`, `@dems/shared/live`).
- Search schemas use zod and the helpers of [`../-search.ts`](../-search.ts); `EvidenceStatus` comes from `@dems/shared/sim`.
- Console folders used: [`../../lib/denied-page.ts`](../../lib/denied-page.ts) (`noteDeniedPage`), [`../../features/`](../../features/README.md).

## Tests

No `__tests__/` here. [`../../test/routes.test.tsx`](../../test/routes.test.tsx) renders every page path and checks the signed-out guard.

## Related decisions

From `decisions.md` of the 2026-11-05 audit:

- D80: storing `interfaceName` through operation 102 needs a TECHNICIAN at `/admin/commissioning` (recorded as a blocked-credential user action).
- D226: the controller issued a pairing code at `/admin/devices` to re-pair the emulator.
