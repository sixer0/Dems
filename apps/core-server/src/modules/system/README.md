# `src/modules/system`

Up: [`src/modules`](../README.md)

## Purpose

System and maintenance: operations 64 to 68 of the shared registry (system status, diagnostics, service restart, software update and related settings).

## Contents

| File or folder | Role |
|---|---|
| [`index.ts`](./index.ts) | System and maintenance module. |
| [`operations.ts`](./operations.ts) | The operations of the system module, read from the contract registry. |
| [`settings.ts`](./settings.ts) | Operation 68 `updateSettings`: what of a request body reaches the hosted action, which settings a call changed, and the one log line of a change. |
| [`status.ts`](./status.ts) | Operation 64 `getSystemStatus`: the five slices of the system page. |

## Main exports and entry points

Other units import this folder through `index.ts`.

- Exported from `index.ts`: `systemModule`, `SYSTEM_ACTION_OF_OPERATION`, `SYSTEM_MODULE_OPERATIONS`, `registryEntry`, `SystemModuleOperation`, `SETTINGS_CHANGED_MESSAGE`, `SETTINGS_UNIT_LABEL`, `changedSettingsKeys`, `settingsChangeLine`, `settingsPatchOf`, `SettingsChangeLine`, `CAPTURE_PHASE_VERDICT`, `CAPTURE_WORKER_SERVICE`, `TRANSCRIBER_NOT_MOUNTED`, `TRANSCRIBER_SERVICE`, `TRANSCRIBER_STATE_VERDICT`, `TranscriberServiceState`, `serviceReportsOf`, `servicesWithProcesses`, `systemComponentsOf`, `systemStatusOf`, `ServiceProbes`, `ServiceReport`, `SystemComponents`, `SystemStatusSource`, `TranscriberServiceReport`, `TranscriberServiceSource`.
- Types exported from `index.ts`: `SystemModuleOptions`.

## Dependencies

Module-level imports of the production files (tests excluded).

Inbound (who imports this folder):

- [`app.ts`](../../app.ts): `index.ts`

Outbound (what this folder imports inside `src`):

- [`capture`](../../capture/README.md)
- [`capture/fence`](../../capture/fence/README.md)
- [`config.ts`](../../config.ts)
- [`plugins/authenticate`](../../plugins/authenticate/README.md)
- [`plugins/permission-guard`](../../plugins/permission-guard/README.md)
- [`transcription`](../../transcription/README.md)
- [`version.ts`](../../version.ts)

- Workspace packages: `@dems/shared`
- npm packages: `fastify`, `fastify-type-provider-zod`

## Tests

| Location | Test files | `*.db.test.ts` |
|---|---|---|
| [`__tests__/`](./__tests__/) | 5 | 2 |

2 test file(s) end in `.db.test.ts`: they need a PostgreSQL test database and run only in a DB window, not in the plain unit run.

Tests elsewhere that import it (1 folders): `src/modules/alerts/__tests__`.

## Related decisions

No entry of the 2026-11-05 audit decisions log names this folder or its files. Code comments cite earlier design decisions; see the file headers.
