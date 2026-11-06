# `apps/mobile/src/app/(app)/(tabs)`

Up: [`src/app/(app)/`](../README.md)

## Purpose

The tab routes. `_layout.tsx` renders the tab navigator of the navigation shell (`AppTabs`): a bottom bar on phones, a rail on tablets. The list routes with a detail (`devices`, `evidence`, `sessions`, `settings`) are folders with their own stack, so a deep link to a detail keeps the list underneath.

## Contents

| Entry | Role |
|---|---|
| [`devices/`](devices/) | Route files: `[deviceId].tsx`, `_layout.tsx`, `index.tsx`. |
| [`evidence/`](evidence/) | Route files: `[evidenceId].tsx`, `_layout.tsx`, `index.tsx`. |
| [`sessions/`](sessions/) | Route files: `[sessionId].tsx`, `_layout.tsx`, `index.tsx`. |
| [`settings/`](settings/) | Route files: `[section].tsx`, `_layout.tsx`, `index.tsx`. |
| `_layout.tsx` | Layout of the `(tabs)` group: the tab navigator. |
| `audit.tsx` | Route /audit. |
| `home.tsx` | Route `/home`. |
| `more.tsx` | Route /more. |
| `network-time.tsx` | Route /network-time. |
| `storage.tsx` | Route /storage. |

## Route map

| File (under `src/app`) | URL | Kind | Renders (from) |
|---|---|---|---|
| `(app)/(tabs)/_layout.tsx` | `/` | layout of `(tabs)` | `AppTabs` (navigation) |
| `(app)/(tabs)/audit.tsx` | `/audit` | route | `AuditScreen` (features/audit) |
| `(app)/(tabs)/home.tsx` | `/home` | route | `DashboardScreen` (features/dashboard) |
| `(app)/(tabs)/more.tsx` | `/more` | route | `MoreScreen` (features/more) |
| `(app)/(tabs)/network-time.tsx` | `/network-time` | route | `NetworkTimeScreen` (features/network-time) |
| `(app)/(tabs)/storage.tsx` | `/storage` | route | `StorageScreen` (features/storage) |
| `(app)/(tabs)/devices/[deviceId].tsx` | `/devices/[deviceId]` | route | `DeviceDetailScreen` (features/devices) |
| `(app)/(tabs)/devices/_layout.tsx` | `/devices` | layout of `devices` | `DrillInStack` (navigation) |
| `(app)/(tabs)/devices/index.tsx` | `/devices` | route | `DevicesScreen` (features/devices) |
| `(app)/(tabs)/evidence/[evidenceId].tsx` | `/evidence/[evidenceId]` | route | `EvidenceDetailScreen` (features/evidence) |
| `(app)/(tabs)/evidence/_layout.tsx` | `/evidence` | layout of `evidence` | `DrillInStack` (navigation) |
| `(app)/(tabs)/evidence/index.tsx` | `/evidence` | route | `EvidenceListScreen` (features/evidence) |
| `(app)/(tabs)/sessions/[sessionId].tsx` | `/sessions/[sessionId]` | route | `SessionDetailScreen` (features/sessions) |
| `(app)/(tabs)/sessions/_layout.tsx` | `/sessions` | layout of `sessions` | `DrillInStack` (navigation) |
| `(app)/(tabs)/sessions/index.tsx` | `/sessions` | route | `SessionsScreen` (features/sessions) |
| `(app)/(tabs)/settings/[section].tsx` | `/settings/[section]` | route | `SettingsSectionScreen` (features/settings) |
| `(app)/(tabs)/settings/_layout.tsx` | `/settings` | layout of `settings` | `DrillInStack` (navigation) |
| `(app)/(tabs)/settings/index.tsx` | `/settings` | route | `SettingsScreen` (features/settings) |

## Main exports

- Components: `TabsLayout`, `AuditRoute`, `HomeRoute`, `MoreRoute`, `NetworkTimeRoute`, `StorageRoute`.

## Tests

No test file in this folder.
Run: `npm test -w @dems/mobile` (all) or `npx jest <path>` inside `apps/mobile`.

## Related decisions

No entry of `decisions.md` (2026-11-05 team update audit) names this folder or its files.
