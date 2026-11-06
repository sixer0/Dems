# `src/plugins/authenticate`

Up: [`src/plugins`](../README.md)

## Purpose

The `authenticate` stage, stage 4 of the request pipeline: reads at most one credential (session cookie or bearer token) and resolves it to an operator, a device or anonymous.

## Contents

| File or folder | Role |
|---|---|
| [`console.ts`](./console.ts) | The console rule ID-1, as stages 3 and 4 decide it. |
| [`credentials.ts`](./credentials.ts) | Which credential a request presents. |
| [`index.ts`](./index.ts) | The `authenticate` stage: stage 4 of the request pipeline. |

## Main exports and entry points

Other units import this folder through `index.ts`.

- Exported from `index.ts`: `SESSION_TOUCH_MIN_INTERVAL_MS`, `ANONYMOUS_PRINCIPAL`, `authenticationOf`, `notSignedIn`, `credentialConflict`, `operatorSessionOf`, `ACTIVITY_EXEMPT_OPERATIONS`, `authenticatePlugin`, `WEB_CONSOLE_KEY`, `consoleIdentityOf`, `deviceNotPaired`, `deviceRevoked`, `pairedDeviceOf`, `ConsoleIdentity`, `bearerValueOf`, `readCredential`, `PresentedCredential`.
- Types exported from `index.ts`: `Principal`, `AuthenticationFailure`, `Authentication`.

## Dependencies

Module-level imports of the production files (tests excluded).

Inbound (who imports this folder):

- [`app.ts`](../../app.ts): `index.ts`
- [`camera-preview`](../../camera-preview/README.md): `index.ts`
- [`capture-notices`](../../capture-notices/README.md): `index.ts`
- [`engine`](../../engine/README.md): `index.ts`
- [`evidence-export`](../../evidence-export/README.md): `index.ts`
- [`evidence-verify`](../../evidence-verify/README.md): `index.ts`
- [`media-stream`](../../media-stream/README.md): `index.ts`
- [`modules/admin`](../../modules/admin/README.md): `index.ts`
- [`modules/alerts`](../../modules/alerts/README.md): `index.ts`
- [`modules/capture-config`](../../modules/capture-config/README.md): `index.ts`
- [`modules/capture-discovery`](../../modules/capture-discovery/README.md): `index.ts`
- [`modules/capture-inputs`](../../modules/capture-inputs/README.md): `index.ts`
- [`modules/devices`](../../modules/devices/README.md): `index.ts`
- [`modules/identity`](../../modules/identity/README.md): `index.ts`
- [`modules/pairing`](../../modules/pairing/README.md): `index.ts`
- [`modules/stt-config`](../../modules/stt-config/README.md): `index.ts`
- [`modules/system`](../../modules/system/README.md): `index.ts`
- [`plugins/logger`](../logger/README.md): `index.ts`
- [`plugins/permission-guard`](../permission-guard/README.md): `index.ts`
- [`plugins/throttle`](../throttle/README.md): `index.ts`
- [`realtime`](../../realtime/README.md): `index.ts`
- [`sealing-host`](../../sealing-host/README.md): `index.ts`

Outbound (what this folder imports inside `src`):

- [`core`](../../core/README.md)
- [`modules/identity`](../../modules/identity/README.md)
- [`modules/pairing`](../../modules/pairing/README.md)
- [`plugins/error-envelope`](../error-envelope/README.md)
- [`plugins/logger`](../logger/README.md)
- [`plugins/origin-guard`](../origin-guard/README.md)

- Workspace packages: `@dems/shared`
- npm packages: `fastify`

## Tests

| Location | Test files | `*.db.test.ts` |
|---|---|---|
| [`__tests__/`](./__tests__/) | 3 | 1 |

1 test file(s) end in `.db.test.ts`: they need a PostgreSQL test database and run only in a DB window, not in the plain unit run.

Tests elsewhere that import it (34 folders): `src/capture-notices/__tests__`, `src/capture-session/__tests__`, `src/capture/fence/__tests__`, `src/engine/__tests__`, `src/evidence-verify/__tests__`, `src/modules/admin/__tests__`, `src/modules/alerts/__tests__`, `src/modules/camera-preview/__tests__`, and more.

## Related decisions

No entry of the 2026-11-05 audit decisions log names this folder or its files. Code comments cite earlier design decisions; see the file headers.
