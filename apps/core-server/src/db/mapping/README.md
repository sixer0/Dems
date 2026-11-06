# `src/db/mapping`

Up: [`src/db`](../README.md)

## Purpose

The one slice-to-table mapping, in both directions: the durable engine slices to table rows (`toRows`), rows back to slices (`fromRows`), and the row changes between two states (`diffSlices`). Everything here is pure: no database, no clock, no file.

## Contents

| File or folder | Role |
|---|---|
| [`audit-verify.ts`](./audit-verify.ts) | The digest check of stored audit rows. |
| [`changes.ts`](./changes.ts) | Change detection: what to write when the engine's state moved from one value to another. |
| [`exports.ts`](./exports.ts) | Export records: the one table of the engine's data that no slice holds. |
| [`from-rows.ts`](./from-rows.ts) | `fromRows`: table rows back to the durable slices. |
| [`guards.ts`](./guards.ts) | What the mapping refuses. |
| [`health-snapshot.ts`](./health-snapshot.ts) | The health snapshot row. |
| [`index.ts`](./index.ts) | The one slice-to-table mapping. |
| [`rbac.ts`](./rbac.ts) | Roles, permissions and grants: the shared vocabulary as rows, and back. |
| [`rows.ts`](./rows.ts) | One entity, one row builder, one way back. |
| [`slices.ts`](./slices.ts) | Which slices of the simulator state are durable, and where each lives. |
| [`to-rows.ts`](./to-rows.ts) | `toRows`: the durable slices of a simulator state as table rows. |

## Main exports and entry points

Other units import this folder through `index.ts`.

- Exported from `index.ts`: `DURABLE_SLICE_KEYS`, `SNAPSHOT_SLICE_COLUMNS`, `SNAPSHOT_SLICE_KEYS`, `STORED_SLICE_KEYS`, `STORED_SLICE_TABLES`, `UNMAPPED_SLICES`, `pickDurable`, `DurableSliceKey`, `DurableSlices`, `MappableState`, `SnapshotSliceKey`, `StoredSliceKey`, `UnmappedSliceKey`, `MappingError`, `isStorableText`, `safeInteger`, `safeIntegerOrNull`, `storableJson`, `storableText`, `storableTextOrNull`, `MappingErrorCode`, `COUNTER_NAMES`, `activeSessionFromRow`, `activeSessionToRow`, `alertFromRow`, `alertReasonOf`, `alertToRow`, `auditRowFromRow`, `auditRowToRow`, `coreDeviceFromRow`, and 64 more.

## Dependencies

Module-level imports of the production files (tests excluded).

Inbound (who imports this folder):

- [`core`](../../core/README.md): `index.ts`
- [`db/reset`](../reset/README.md): `index.ts`
- [`db/seed`](../seed/README.md): `index.ts`
- [`db/store`](../store/README.md): `index.ts`
- [`engine`](../../engine/README.md): `index.ts`
- [`modules/capture-config`](../../modules/capture-config/README.md): `index.ts`
- [`modules/capture-discovery`](../../modules/capture-discovery/README.md): `index.ts`
- [`modules/demo`](../../modules/demo/README.md): `index.ts`
- [`modules/evidence`](../../modules/evidence/README.md): `index.ts`
- [`modules/security-audit`](../../modules/security-audit/README.md): `index.ts`
- [`modules/sessions`](../../modules/sessions/README.md): `index.ts`
- [`realtime`](../../realtime/README.md): `index.ts`

Outbound (what this folder imports inside `src`):

- [`db/schema`](../schema/README.md)

- Workspace packages: `@dems/shared`
- Node built-ins: `node:util`

## Tests

| Location | Test files | `*.db.test.ts` |
|---|---|---|
| [`__tests__/`](./__tests__/) | 6 | 1 |

1 test file(s) end in `.db.test.ts`: they need a PostgreSQL test database and run only in a DB window, not in the plain unit run.

Tests elsewhere that import it (17 folders): `src/capture/adapters/__tests__`, `src/core/__tests__`, `src/db/fixtures`, `src/db/fixtures/__tests__`, `src/db/reset/__tests__`, `src/db/seed/__tests__`, `src/db/store/__tests__`, `src/engine/__tests__`, and more.

## Related decisions

From the 2026-11-05 audit decisions log:

- D33: `capture_config.updated_by`/`revision` are fixed by `captureConfigToRow` in `rows.ts`.
- D92: demo rows matched by id alone in `rows.ts`, routed to row 128.
- D100: `rows.ts` demo match by built-in id AND FAKE.
