# `apps/mobile/src/app/(app)/session`

Up: [`src/app/(app)/`](../README.md)

## Purpose

The session flow: Start Session wizard, the live Session Monitor, Finalizing, Recovery and the Session Summary. These routes are full screens without the tab chrome; the navigation shell's session guards decide which one a session state may open.

## Contents

| Entry | Role |
|---|---|
| [`summary/`](summary/) | Route files: `[sessionId].tsx`. |
| `_layout.tsx` | Layout of the session flow group. |
| `finalizing.tsx` | Route `/session/finalizing`. |
| `live.tsx` | Route `/session/live`. |
| `new.tsx` | Route `/session/new?step=1\|2\|3`. |
| `recovery.tsx` | Route `/session/recovery`. |

## Route map

| File (under `src/app`) | URL | Kind | Renders (from) |
|---|---|---|---|
| `(app)/session/_layout.tsx` | `/session` | layout of `session` | `SessionFlowStack` (navigation) |
| `(app)/session/finalizing.tsx` | `/session/finalizing` | route | `SessionFinalizingScreen` (features/session-finalizing) |
| `(app)/session/live.tsx` | `/session/live` | route | `SessionFinalizingScreen` (features/session-finalizing), `MonitorLeavingNotice` (features/session-live), `SessionLiveScreen` (features/session-live) |
| `(app)/session/new.tsx` | `/session/new` | route | `SessionNewScreen` (features/session-new), `StartEntryChecking` (features/session-new) |
| `(app)/session/recovery.tsx` | `/session/recovery` | route | `SessionFinalizingScreen` (features/session-finalizing), `SessionRecoveryScreen` (features/session-recovery) |
| `(app)/session/summary/[sessionId].tsx` | `/session/summary/[sessionId]` | route | `SessionSummaryScreen` (features/session-summary) |

## Main exports

- Components: `SessionLayout`, `SessionFinalizingRoute`, `SessionLiveRoute`, `SessionNewRoute`, `SessionRecoveryRoute`.

## Tests

No test file in this folder.
Run: `npm test -w @dems/mobile` (all) or `npx jest <path>` inside `apps/mobile`.

## Related decisions

No entry of `decisions.md` (2026-11-05 team update audit) names this folder or its files.
