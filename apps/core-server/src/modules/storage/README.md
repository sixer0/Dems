# `src/modules/storage`

Up: [`src/modules`](../README.md)

## Purpose

Storage: operations 53 (`getStorageStatus`), 54 (`getStorageDetail`) and 55 (`setStoragePolicy`).

## Contents

| File or folder | Role |
|---|---|
| [`index.ts`](./index.ts) | Storage module. |
| [`policy.ts`](./policy.ts) | Operation 55 `setStoragePolicy`: what of a request body reaches the hosted action. |
| [`status.ts`](./status.ts) | Operation 53 `getStorageStatus`: the design-book summary of the storage. |

## Main exports and entry points

Other units import this folder through `index.ts`.

- Exported from `index.ts`: `STORAGE_MODULE_OPERATIONS`, `STORAGE_POLICY_ACTION`, `storageModule`, `policyPatchOf`, `storageStatusOf`, `StorageStatusSource`.
- Types exported from `index.ts`: `StorageModuleOperation`.

## Dependencies

Module-level imports of the production files (tests excluded).

Inbound (who imports this folder):

- [`app.ts`](../../app.ts): `index.ts`

Outbound (what this folder imports inside `src`):

- [`plugins/permission-guard`](../../plugins/permission-guard/README.md)

- Workspace packages: `@dems/shared`
- npm packages: `fastify`, `fastify-type-provider-zod`

## Tests

| Location | Test files | `*.db.test.ts` |
|---|---|---|
| [`__tests__/`](./__tests__/) | 5 | 2 |

2 test file(s) end in `.db.test.ts`: they need a PostgreSQL test database and run only in a DB window, not in the plain unit run.

Tests elsewhere that import it (3 folders): `src/modules/network-time/__tests__`, `src/modules/stt-config/__tests__`, `src/transcription/__tests__`.

## Related decisions

No entry of the 2026-11-05 audit decisions log names this folder or its files. Code comments cite earlier design decisions; see the file headers.
