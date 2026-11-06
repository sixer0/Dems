# `apps/mobile/src/app/(app)`

Up: [`src/app/`](../README.md)

## Purpose

The signed-in part of the app. Its `_layout.tsx` renders the app stack and mounts the runtime's `SessionRouteSync` (state-routed resync), `SessionDiagnostics` and `KeepAwakeController`, plus the alert toasts and the foreign-session toasts. The two groups below hold the tab routes and the full-screen session flow.

## Contents

| Entry | Role |
|---|---|
| [`(tabs)/`](%28tabs%29/README.md) | The tab routes. |
| [`session/`](session/README.md) | The session flow: Start Session wizard, the live Session Monitor, Finalizing, Recovery and the Session Summary. |
| `_layout.tsx` | Layout of the signed-in group: app stack, `SessionRouteSync`, `SessionDiagnostics`, `KeepAwakeController`, alert and foreign-session toasts. |

## Route map

| File (under `src/app`) | URL | Kind | Renders (from) |
|---|---|---|---|
| `(app)/_layout.tsx` | `/` | layout of `(app)` | `AlertToasts` (features/alerts), `ForeignSessionToasts` (features/sessions), `AppStack` (navigation) |
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
| `(app)/session/_layout.tsx` | `/session` | layout of `session` | `SessionFlowStack` (navigation) |
| `(app)/session/finalizing.tsx` | `/session/finalizing` | route | `SessionFinalizingScreen` (features/session-finalizing) |
| `(app)/session/live.tsx` | `/session/live` | route | `SessionFinalizingScreen` (features/session-finalizing), `MonitorLeavingNotice` (features/session-live), `SessionLiveScreen` (features/session-live) |
| `(app)/session/new.tsx` | `/session/new` | route | `SessionNewScreen` (features/session-new), `StartEntryChecking` (features/session-new) |
| `(app)/session/recovery.tsx` | `/session/recovery` | route | `SessionFinalizingScreen` (features/session-finalizing), `SessionRecoveryScreen` (features/session-recovery) |
| `(app)/session/summary/[sessionId].tsx` | `/session/summary/[sessionId]` | route | `SessionSummaryScreen` (features/session-summary) |

## Main exports

- Components: `AppLayout`.

## Tests

No test file in this folder.
Run: `npm test -w @dems/mobile` (all) or `npx jest <path>` inside `apps/mobile`.

## Related decisions

No entry of `decisions.md` (2026-11-05 team update audit) names this folder or its files.
