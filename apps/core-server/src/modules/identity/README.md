# `src/modules/identity`

Up: [`src/modules`](../README.md)

## Purpose

Identity: sign-in, sign-out and the auth sessions (operations 2 to 6), the session registry seam, the console lockout, password policy, plus the `password-hash` and `biometric` sub-areas.

## Contents

| File or folder | Role |
|---|---|
| [`activity.ts`](./activity.ts) | The audit rows and events of the identity module. |
| [`console.ts`](./console.ts) | The console rule ID-1. |
| [`cookie.ts`](./cookie.ts) | The session cookie of a web console. |
| [`index.ts`](./index.ts) | Identity module. |
| [`limits.ts`](./limits.ts) | The numbers of the identity module. |
| [`lockout.ts`](./lockout.ts) | The sign-in lockout of a console. |
| [`operations.ts`](./operations.ts) | The registry entries of the identity operations. |
| [`password-policy.ts`](./password-policy.ts) | The password policy for a new password. |
| [`routes.ts`](./routes.ts) | The routes of the identity core: operations 2 to 6 of the shared registry. |
| [`session-store.ts`](./session-store.ts) | The statements of the identity module. |
| [`sessions.ts`](./sessions.ts) | Server-side sessions. |
| [`sign-in.ts`](./sign-in.ts) | The password sign-in. |
| [`sweeper.ts`](./sweeper.ts) | The timer of the expiry sweep moved to the core: the pairing module runs on it too, and a generic helper does not belong to one domain module. |
| [`tokens.ts`](./tokens.ts) | Session tokens. |
| [`biometric/`](./biometric/) | Sub-area with 8 source files. |
| [`password-hash/`](./password-hash/) | Sub-area with 2 source files. |

## Main exports and entry points

Other units import this folder through `index.ts`.

- Exported from `index.ts`: `identityControl`, `identityModule`, `appendActivities`, `appendActivity`, `attemptFailed`, `attemptLocked`, `sessionExpired`, `signedIn`, `signedOut`, `Activity`, `ExpiryReason`, `consoleIdentityOf`, `deviceNotPaired`, `deviceRevoked`, `pairedDeviceOf`, `refuseRetiredDevice`, `requireConsoleIdentity`, `statusConsoleKeyOf`, `ConsoleIdentity`, `SESSION_COOKIE_ATTRIBUTES`, `clearSessionCookie`, `setSessionCookie`, `LOCKOUT_DURATION_MS`, `LOCKOUT_MAX_ATTEMPTS`, `LOCKOUT_WINDOW_MS`, `SESSION_ABSOLUTE_TIMEOUT_MS`, `SESSION_IDLE_TIMEOUT_MS`, `SESSION_SWEEP_INTERVAL_MS`, `SESSION_TOUCH_MIN_INTERVAL_MS`, `WEB_CONSOLE_KEY`, and 33 more.
- Types exported from `index.ts`: `IdentityControl`.

## Dependencies

Module-level imports of the production files (tests excluded).

Inbound (who imports this folder):

- [`app.ts`](../../app.ts): `index.ts`
- [`capture/boot`](../../capture/boot/README.md): `password-hash/index.ts`
- [`db/seed`](../../db/seed/README.md): `password-hash/index.ts`
- [`modules/admin`](../admin/README.md): `biometric/index.ts`
- [`modules/pairing`](../pairing/README.md): `biometric/index.ts`, `index.ts`
- [`plugins/authenticate`](../../plugins/authenticate/README.md): `index.ts`

Outbound (what this folder imports inside `src`):

- [`core`](../../core/README.md)
- [`db/schema`](../../db/schema/README.md)
- [`plugins/authenticate`](../../plugins/authenticate/README.md)
- [`plugins/db`](../../plugins/db/README.md)
- [`plugins/error-envelope`](../../plugins/error-envelope/README.md)
- [`plugins/logger`](../../plugins/logger/README.md)
- [`plugins/permission-guard`](../../plugins/permission-guard/README.md)
- [`realtime`](../../realtime/README.md)

- Workspace packages: `@dems/shared`
- npm packages: `fastify`, `fastify-type-provider-zod`, `pg`, `rate-limiter-flexible`
- Node built-ins: `node:crypto`

## Tests

| Location | Test files | `*.db.test.ts` |
|---|---|---|
| [`__tests__/`](./__tests__/) | 15 | 8 |
| [`biometric/__tests__/`](./biometric/__tests__/) | 11 | 8 |

16 test file(s) end in `.db.test.ts`: they need a PostgreSQL test database and run only in a DB window, not in the plain unit run.

Tests elsewhere that import it (30 folders): `src/__tests__`, `src/capture/boot/__tests__`, `src/capture/fence/__tests__`, `src/core/__tests__`, `src/db/fixtures`, `src/db/fixtures/__tests__`, `src/db/seed/__tests__`, `src/modules/__tests__`, and more.

## Related decisions

No entry of the 2026-11-05 audit decisions log names this folder or its files. Code comments cite earlier design decisions; see the file headers.
