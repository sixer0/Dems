# `apps/mobile/src/app/(auth)`

Up: [`src/app/`](../README.md)

## Purpose

The sign-in stack. `_layout.tsx` renders the auth stack of the navigation shell, and `login.tsx` renders the Login screen. The root navigator shows this group only while no operator is signed in.

## Contents

| Entry | Role |
|---|---|
| `_layout.tsx` | Layout of the `(auth)` group: the auth stack. |
| `login.tsx` | Route `/login`. |

## Route map

| File (under `src/app`) | URL | Kind | Renders (from) |
|---|---|---|---|
| `(auth)/_layout.tsx` | `/` | layout of `(auth)` | `AuthStack` (navigation) |
| `(auth)/login.tsx` | `/login` | route | `LoginScreen` (features/login) |

## Main exports

- Components: `AuthLayout`, `LoginRoute`.

## Tests

No test file in this folder.
Run: `npm test -w @dems/mobile` (all) or `npx jest <path>` inside `apps/mobile`.

## Related decisions

No entry of `decisions.md` (2026-11-05 team update audit) names this folder or its files.
