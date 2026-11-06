# `src/plugins/readiness`

Up: [`src/plugins`](../README.md)

## Purpose

Readiness: the `readiness` decorator with the `database` and `engine` flags, named holds that refuse requests, and the boot steps that must succeed before the listener opens.

## Contents

| File or folder | Role |
|---|---|
| [`index.ts`](./index.ts) | Readiness. |

## Main exports and entry points

Other units import this folder through `index.ts`.

- Exported from `index.ts`: `READINESS_EXEMPT_OPERATION`, `BootError`, `createReadiness`, `readinessPlugin`.
- Types exported from `index.ts`: `ReadinessPart`, `ReadinessSnapshot`, `BootStep`, `Readiness`.

## Dependencies

Module-level imports of the production files (tests excluded).

Inbound (who imports this folder):

- [`app.ts`](../../app.ts): `index.ts`
- [`core`](../../core/README.md): `index.ts`
- [`index.ts`](../../index.ts): `index.ts`
- [`modules/demo`](../../modules/demo/README.md): `index.ts`
- [`modules/health`](../../modules/health/README.md): `index.ts`

Outbound (what this folder imports inside `src`):

- [`core`](../../core/README.md)
- [`plugins/error-envelope`](../error-envelope/README.md)

- npm packages: `fastify`

## Tests

| Location | Test files | `*.db.test.ts` |
|---|---|---|
| [`__tests__/`](./__tests__/) | 2 | 0 |

None of these tests needs a database window.

Tests elsewhere that import it (14 folders): `src/__tests__`, `src/capture/boot/__tests__`, `src/capture/fence/__tests__`, `src/capture/signer/__tests__`, `src/core/__tests__`, `src/db/reset/__tests__`, `src/engine/__tests__`, `src/modules/capture-config/__tests__`, and more.

## Related decisions

No entry of the 2026-11-05 audit decisions log names this folder or its files. Code comments cite earlier design decisions; see the file headers.
