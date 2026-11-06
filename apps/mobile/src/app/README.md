# `apps/mobile/src/app`

Up: [`src/`](../README.md)

## Purpose

Expo Router routes. Each file here is a route (or a layout) and stays thin: it reads route parameters and renders a screen from `features/` or the navigation shell. Groups in parentheses do not appear in the URL: `(auth)` holds the login stack, `(app)` the signed-in tabs and the session flow. Files starting with `+` are Expo Router special files.

## Contents

| Entry | Role |
|---|---|
| [`(app)/`](%28app%29/README.md) | The signed-in part of the app. |
| [`(auth)/`](%28auth%29/README.md) | The sign-in stack. |
| `+native-intent.tsx` | Expo Router system-URL hook: checks every launch URL and deep link before routing (pairing gate, pending href). |
| `+not-found.tsx` | Any URL that matches no route. |
| `_layout.tsx` | Root layout: loads fonts, then `MotionPolicyProvider`, `AppProviders`, `BootGate`, the root navigator, `SignedOutLanding` and the route error boundary. |
| `dev-gallery.tsx` | Debug-only gallery of the composed components and asset renderers. |
| `index.tsx` | Route `/` |
| `pair.tsx` | Route `/pair`. |
| `stack-check.tsx` | Route `/stack-check` (public) |

## Route map

| File (under `src/app`) | URL | Kind | Renders (from) |
|---|---|---|---|
| `+native-intent.tsx` | `+native-intent` | special | - |
| `+not-found.tsx` | `+not-found` | special | `NotFoundScreen` (navigation) |
| `_layout.tsx` | `/` | layout of `root` | `RootNavigator` (navigation), `RouteErrorFallback` (navigation) |
| `dev-gallery.tsx` | `/dev-gallery` | route | - |
| `index.tsx` | `/` | route | `BootRedirect` (navigation), `StackCheckRoute` (navigation) |
| `pair.tsx` | `/pair` | route | `PairingScreen` (features/pairing) |
| `stack-check.tsx` | `/stack-check` | route | `StackCheckRoute` (navigation) |
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
| `(auth)/_layout.tsx` | `/` | layout of `(auth)` | `AuthStack` (navigation) |
| `(auth)/login.tsx` | `/login` | route | `LoginScreen` (features/login) |

## Main exports

- Components: `NotFoundRoute`, `RootLayout`, `ErrorBoundary`, `DevGalleryRoute`, `BootRoute`, `PairRoute`, `StackCheck`.

## Tests

No test file in this folder.
Run: `npm test -w @dems/mobile` (all) or `npx jest <path>` inside `apps/mobile`.

## Related decisions

No entry of `decisions.md` (2026-11-05 team update audit) names this folder or its files.
