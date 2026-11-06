# `src/modules/demo`

Up: [`src/modules`](../README.md)

## Purpose

Demo control: operations 71 to 75 of the shared registry (demo status, load a scenario, inject and clear a fault, reset), available only with the demo flag.

## Contents

| File or folder | Role |
|---|---|
| [`host.ts`](./host.ts) | What a demo reset needs of the server, bound to the seams of the app. |
| [`index.ts`](./index.ts) | Demo-control module: operations 71 to 75 of the shared registry. |
| [`operations.ts`](./operations.ts) | The operations of the demo-control module, read from the contract registry. |
| [`reset.ts`](./reset.ts) | The server side of a demo reset. |
| [`status.ts`](./status.ts) | The answer of operation 71 `getDemoStatus`. |

## Main exports and entry points

Other units import this folder through `index.ts`.

- Exported from `index.ts`: `DEMO_STATUS_SOURCE`, `demoControl`, `demoModule`, `OPERATOR_ROLES_SOURCE`, `READ_OPERATOR_ROLES`, `createResetHost`, `runBootChecks`, `DEMO_MODULE_OPERATIONS`, `RESET_DEMO_SCENARIO`, `RESET_REASON_OF_OPERATION`, `operationOf`, `DemoModuleOperation`, `ResetOperation`, `RECOVERY`, `RESET_ERROR_SOURCE`, `RESET_HOLD_NAME`, `RESUME_STEPS`, `RESYNC_STEP`, `ResetRefusal`, `ResumeFailure`, `createDemoReset`, `roleChanges`, `DemoReset`, `GrantRow`, `OperatorRoleRow`, `ResetCall`, `ResetHost`, `ResetRoutine`, `ResumeStep`, `LOADABLE_SCENARIOS`, and 5 more.
- Types exported from `index.ts`: `DemoControl`.

## Dependencies

Module-level imports of the production files (tests excluded).

Inbound (who imports this folder):

- [`app.ts`](../../app.ts): `index.ts`

Outbound (what this folder imports inside `src`):

- [`core`](../../core/README.md)
- [`db/mapping`](../../db/mapping/README.md)
- [`db/reset`](../../db/reset/README.md)
- [`modules/capture-config`](../capture-config/README.md)
- [`plugins/error-envelope`](../../plugins/error-envelope/README.md)
- [`plugins/logger`](../../plugins/logger/README.md)
- [`plugins/permission-guard`](../../plugins/permission-guard/README.md)
- [`plugins/readiness`](../../plugins/readiness/README.md)
- [`realtime`](../../realtime/README.md)

- Workspace packages: `@dems/shared`
- npm packages: `fastify`, `fastify-type-provider-zod`

## Tests

| Location | Test files | `*.db.test.ts` |
|---|---|---|
| [`__tests__/`](./__tests__/) | 10 | 5 |

5 test file(s) end in `.db.test.ts`: they need a PostgreSQL test database and run only in a DB window, not in the plain unit run.

Tests elsewhere that import it (1 folders): `src/modules/__tests__`.

## Related decisions

No entry of the 2026-11-05 audit decisions log names this folder or its files. Code comments cite earlier design decisions; see the file headers.
