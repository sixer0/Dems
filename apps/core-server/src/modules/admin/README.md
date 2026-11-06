# `src/modules/admin`

Up: [`src/modules`](../README.md)

## Purpose

User and role administration: operations 11 to 14 of the shared registry (list users, assign a role, enable and disable a user), including the rule that refuses system principals.

## Contents

| File or folder | Role |
|---|---|
| [`changes.ts`](./changes.ts) | The three state changes of user administration. |
| [`index.ts`](./index.ts) | User and role administration: operations 11 to 14 of the shared registry. |
| [`rule.ts`](./rule.ts) | The last-administrator rule: a role change or a disable is refused when it would leave no enabled operator whose role holds user administration. |
| [`statements.ts`](./statements.ts) | The statements of the administration module. |

## Main exports and entry points

Other units import this folder through `index.ts`.

- Exported from `index.ts`: `ADMIN_OPERATIONS`, `adminModule`, `ADMINISTRATION_PERMISSION`, `ADMIN_UNIT_LABEL`, `lastAdministrator`, `unknownOperator`, `Actor`, `ChangeOutcome`, `administratorsOf`, `applyChange`, `leavesNoAdministrator`, `OperatorChange`.
- Types exported from `index.ts`: `AdminOperation`.

## Dependencies

Module-level imports of the production files (tests excluded).

Inbound (who imports this folder):

- [`app.ts`](../../app.ts): `index.ts`

Outbound (what this folder imports inside `src`):

- [`core`](../../core/README.md)
- [`modules/identity`](../identity/README.md)
- [`plugins/authenticate`](../../plugins/authenticate/README.md)
- [`plugins/error-envelope`](../../plugins/error-envelope/README.md)
- [`plugins/logger`](../../plugins/logger/README.md)
- [`plugins/permission-guard`](../../plugins/permission-guard/README.md)

- Workspace packages: `@dems/shared`
- npm packages: `fastify`, `fastify-type-provider-zod`, `pg`, `zod`

## Tests

| Location | Test files | `*.db.test.ts` |
|---|---|---|
| [`__tests__/`](./__tests__/) | 11 | 7 |

7 test file(s) end in `.db.test.ts`: they need a PostgreSQL test database and run only in a DB window, not in the plain unit run.

## Related decisions

From the 2026-11-05 audit decisions log:

- D93: `isSystemPrincipal` moved to `rule.ts`; the system account refused for operations 12, 14, 16 and 17.
