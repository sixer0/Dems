# `src/modules/alerts`

Up: [`src/modules`](../README.md)

## Purpose

Alerts: operations 69 (`listAlerts`) and 70 (`acknowledgeAlert`).

## Contents

| File or folder | Role |
|---|---|
| [`acknowledge.ts`](./acknowledge.ts) | Operation 70 `acknowledgeAlert`: whether a call acknowledged an alert, and the one log line of an acknowledgement. |
| [`index.ts`](./index.ts) | Alerts module. |

## Main exports and entry points

Other units import this folder through `index.ts`.

- Exported from `index.ts`: `ALERTS_MODULE_OPERATIONS`, `ACKNOWLEDGE_ACTION`, `registryEntry`, `alertsModule`, `ACKNOWLEDGE_UNIT_LABEL`, `ALERT_ACKNOWLEDGED_MESSAGE`, `acknowledgementLine`, `becameAcknowledged`, `AcknowledgementLine`.
- Types exported from `index.ts`: `AlertsModuleOperation`.

## Dependencies

Module-level imports of the production files (tests excluded).

Inbound (who imports this folder):

- [`app.ts`](../../app.ts): `index.ts`

Outbound (what this folder imports inside `src`):

- [`plugins/authenticate`](../../plugins/authenticate/README.md)
- [`plugins/permission-guard`](../../plugins/permission-guard/README.md)

- Workspace packages: `@dems/shared`
- npm packages: `fastify`, `fastify-type-provider-zod`, `zod`

## Tests

| Location | Test files | `*.db.test.ts` |
|---|---|---|
| [`__tests__/`](./__tests__/) | 4 | 1 |

1 test file(s) end in `.db.test.ts`: they need a PostgreSQL test database and run only in a DB window, not in the plain unit run.

## Related decisions

No entry of the 2026-11-05 audit decisions log names this folder or its files. Code comments cite earlier design decisions; see the file headers.
