# `src/plugins/permission-guard`

Up: [`src/plugins`](../README.md)

## Purpose

The permission guard, stage 6 of the request pipeline: finds the access rule of the route in the shared registry, decides for the resolved principal, and refuses with one audited `ACCESS_DENIED` row.

## Contents

| File or folder | Role |
|---|---|
| [`access-rules.ts`](./access-rules.ts) | The access rules of the Core server, compiled from the contract registry. |
| [`decision.ts`](./decision.ts) | The decision of stage 6. |
| [`denial.ts`](./denial.ts) | What a refusal of stage 6 answers and what it writes. |
| [`index.ts`](./index.ts) | The permission guard: stage 6 of the request pipeline. |
| [`matrix.ts`](./matrix.ts) | The stored role and permission matrix. |
| [`router-table.ts`](./router-table.ts) | The routes of the router, read back from Fastify's printed route table. |
| [`session-holder.ts`](./session-holder.ts) | The `SESSION_HOLDER` fact of stage 6. |

## Main exports and entry points

Other units import this folder through `index.ts`.

- Exported from `index.ts`: `DENIAL_UNIT_LABEL`, `permissionGuard`, `routeOfOperation`, `permissionGuardPlugin`, `ANY_OF_SEPARATOR`, `AccessRuleError`, `AccessRuleErrorCode`, `CAMERA_PREVIEW_ROUTE_URL`, `CAMERA_PREVIEW_SESSION_OPERATION`, `CAMERA_PREVIEW_STREAM_ID`, `EVIDENCE_EXPORT_DOWNLOAD_ID`, `EVIDENCE_EXPORT_DOWNLOAD_URL`, `EVIDENCE_EXPORT_JOB_OPERATION`, `EVIDENCE_MEDIA_ROUTE_URL`, `EVIDENCE_MEDIA_SESSION_OPERATION`, `EVIDENCE_MEDIA_STREAM_ID`, `EXPORT_DENIALS`, `FORBIDDEN_OPERATION`, `REALTIME_CHANNEL_ID`, `REALTIME_CHANNEL_RULE`, `RETIRED_DEVICE_OPERATIONS`, `compileAccessRule`, `createRuleBook`, `denialPermissionCode`, `isAccessRule`, `permissionsOfDenialCode`, `routePatternOf`, `AccessRule`, `AccessRuleProblem`, `ExportDenialShape`, and 28 more.
- Types exported from `index.ts`: `LoadedMatrix`, `PermissionGuardControl`.

## Dependencies

Module-level imports of the production files (tests excluded).

Inbound (who imports this folder):

- [`app.ts`](../../app.ts): `index.ts`
- [`camera-preview`](../../camera-preview/README.md): `index.ts`
- [`evidence-export`](../../evidence-export/README.md): `index.ts`
- [`media-stream`](../../media-stream/README.md): `index.ts`
- [`modules/admin`](../../modules/admin/README.md): `index.ts`
- [`modules/alerts`](../../modules/alerts/README.md): `index.ts`
- [`modules/camera-preview`](../../modules/camera-preview/README.md): `index.ts`
- [`modules/capture-config`](../../modules/capture-config/README.md): `index.ts`
- [`modules/capture-discovery`](../../modules/capture-discovery/README.md): `index.ts`
- [`modules/capture-inputs`](../../modules/capture-inputs/README.md): `index.ts`
- [`modules/demo`](../../modules/demo/README.md): `index.ts`
- [`modules/devices`](../../modules/devices/README.md): `index.ts`
- [`modules/evidence`](../../modules/evidence/README.md): `index.ts`
- [`modules/evidence-export`](../../modules/evidence-export/README.md): `index.ts`
- [`modules/health`](../../modules/health/README.md): `index.ts`
- [`modules/identity`](../../modules/identity/README.md): `index.ts`
- [`modules/media-stream`](../../modules/media-stream/README.md): `index.ts`
- [`modules/network-time`](../../modules/network-time/README.md): `index.ts`
- [`modules/pairing`](../../modules/pairing/README.md): `index.ts`
- [`modules/rbac`](../../modules/rbac/README.md): `index.ts`
- [`modules/sealing`](../../modules/sealing/README.md): `index.ts`
- [`modules/security-audit`](../../modules/security-audit/README.md): `index.ts`
- [`modules/sessions`](../../modules/sessions/README.md): `index.ts`
- [`modules/storage`](../../modules/storage/README.md): `index.ts`
- [`modules/stt-config`](../../modules/stt-config/README.md): `index.ts`
- [`modules/system`](../../modules/system/README.md): `index.ts`
- [`modules/transcripts`](../../modules/transcripts/README.md): `index.ts`

Outbound (what this folder imports inside `src`):

- [`core`](../../core/README.md)
- [`plugins/authenticate`](../authenticate/README.md)
- [`plugins/error-envelope`](../error-envelope/README.md)
- [`plugins/logger`](../logger/README.md)

- Workspace packages: `@dems/shared`
- npm packages: `fastify`, `none found`

## Tests

| Location | Test files | `*.db.test.ts` |
|---|---|---|
| [`__tests__/`](./__tests__/) | 12 | 4 |

4 test file(s) end in `.db.test.ts`: they need a PostgreSQL test database and run only in a DB window, not in the plain unit run.

Tests elsewhere that import it (21 folders): `src/db/fixtures/__tests__`, `src/engine/__tests__`, `src/modules/admin/__tests__`, `src/modules/alerts/__tests__`, `src/modules/capture-config/__tests__`, `src/modules/capture-inputs/__tests__`, `src/modules/demo/__tests__`, `src/modules/devices/__tests__`, and more.

## Related decisions

No entry of the 2026-11-05 audit decisions log names this folder or its files. Code comments cite earlier design decisions; see the file headers.
