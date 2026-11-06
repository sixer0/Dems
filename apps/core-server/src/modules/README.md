# `src/modules`

Up: [`src`](../README.md)

## Purpose

The API operations of the Core, one folder per area. Each module registers its routes from the shared operation registry; access rules are applied by `plugins/permission-guard`, not inside the modules.

## Contents

| File or folder | Role |
|---|---|
| [`admin/`](./admin/README.md) | User and role administration: operations 11 to 14 of the shared registry (list users, assign a role, enable and disable a user), including the rule that refuses system principals. See its README. |
| [`alerts/`](./alerts/README.md) | Alerts: operations 69 (`listAlerts`) and 70 (`acknowledgeAlert`). See its README. |
| [`camera-preview/`](./camera-preview/README.md) | Registers the three camera-preview routes (operations 112 and 113 and `GET /preview/:token`) and nothing else; what the routes do lives in `src/camera-preview`. See its README. |
| [`capture-config/`](./capture-config/README.md) | Capture configuration: the store and boot of the two capture slices (the selector and the capture-device registry), their routes, camera credential holders and reveal, and the camera network, factory scan, host alias, installation acceptance and network sub-areas. See its README. |
| [`capture-discovery/`](./capture-discovery/README.md) | Camera search and the candidate list: operations 93 (`startCaptureDiscovery`) and 94 (`getCaptureDiscovery`), the one call of the camera adapter's `discover`, the in-memory candidate store, adoption of a found camera, readdressing and the segment scan. See its README. |
| [`capture-inputs/`](./capture-inputs/README.md) | The live path of operation 97 `rescanCaptureInputs`: the re-read of the local microphone inputs, its spacing limit and its audit row, plus the `audio-cards` sub-area. See its README. |
| [`demo/`](./demo/README.md) | Demo control: operations 71 to 75 of the shared registry (demo status, load a scenario, inject and clear a fault, reset), available only with the demo flag. See its README. |
| [`devices/`](./devices/README.md) | The recording hardware of the Core itself: operations 44 to 52 of the shared registry (device health, audio and video status and related reads and commands). See its README. |
| [`evidence/`](./evidence/README.md) | Evidence: operations 39 to 43 of the shared registry (list, get, verify, export and archive an evidence item), with cursors and media references. See its README. |
| [`evidence-export/`](./evidence-export/README.md) | Registers the two evidence-export routes: operation 87 (`getEvidenceExportJob`) and the download route `GET /exports/:token`. See its README. |
| [`health/`](./health/README.md) | The health operation `GET /api/v1/health`: liveness plus readiness. See its README. |
| [`identity/`](./identity/README.md) | Identity: sign-in, sign-out and the auth sessions (operations 2 to 6), the session registry seam, the console lockout, password policy, plus the `password-hash` and `biometric` sub-areas. See its README. |
| [`media-stream/`](./media-stream/README.md) | Registers the two media routes, operation 88 (`createEvidenceMediaSession`) and `GET /media/:token`, and nothing else. See its README. |
| [`network-time/`](./network-time/README.md) | Network and time: operations 56 (`getNetworkStatus`) and 57 (`getTimeStatus`). See its README. |
| [`pairing/`](./pairing/README.md) | Pairing and the device registry: operations 15 to 23 (pairing code, redeem, list, revoke, a device's own registration, unpair, credential rotation) and the `deviceResolver` seam that resolves a device credential at the authenticate stage. See its README. |
| [`rbac/`](./rbac/README.md) | RBAC: operation 10 (`getRoleMatrix`), which answers the roles, permissions and assignments as stored in PostgreSQL, and the boot step that checks the stored matrix. See its README. |
| [`recording-fragments/`](./recording-fragments/README.md) | The `recording_fragments` store and the recorder that feeds it from the capture worker's checkpoint records: one row per fragment per camera, in order, without a gap, idempotent on a replay. See its README. |
| [`sealing/`](./sealing/README.md) | The route of operation 83 (`getSealingProgress`) and the mount of the sealing composition from `src/sealing-host`. See its README. |
| [`security-audit/`](./security-audit/README.md) | Security and audit: operations 58 to 63 of the shared registry (security status, audit rows, audit chain verification, audit and log export). See its README. |
| [`sessions/`](./sessions/README.md) | The recording lifecycle of the one session a Core has open: operations 24 to 38 of the shared registry (create, pre-check, start, stop, cancel, recover, markers, notes, snapshots, summary and history). See its README. |
| [`storage/`](./storage/README.md) | Storage: operations 53 (`getStorageStatus`), 54 (`getStorageDetail`) and 55 (`setStoragePolicy`). See its README. |
| [`stt-config/`](./stt-config/README.md) | STT configuration: operations 90 (`getSttConfig`), 91 (`updateSttConfig`) and 92 (`testSttConnection`). See its README. |
| [`system/`](./system/README.md) | System and maintenance: operations 64 to 68 of the shared registry (system status, diagnostics, service restart, software update and related settings). See its README. |
| [`transcript-chunks/`](./transcript-chunks/README.md) | The `transcript_chunks` store: the database side of the transcriber's chunk checkpoints, offered as the three-member port (`insertMissing`, `update`, `read`) the transcriber uses. See its README. |
| [`transcripts/`](./transcripts/README.md) | Transcripts: operations 84, 85 and 86 of the shared registry, and the store of a sealed machine transcript and its signed revisions. See its README. |

## Main exports and entry points

No files of its own; see the subfolders.

## Dependencies

Module-level imports of the production files (tests excluded).

Inbound (who imports this folder):

- [`app.ts`](../app.ts): `admin/index.ts`, `alerts/index.ts`, `camera-preview/index.ts`, `capture-config/index.ts`, `capture-discovery/index.ts`, `capture-inputs/index.ts`, and 17 more
- [`capture-composition.ts`](../capture-composition.ts): `capture-config/credential-holders.ts`, `capture-config/index.ts`, `capture-discovery/index.ts`, `capture-inputs/index.ts`
- [`capture-session`](../capture-session/README.md): `capture-config/index.ts`, `recording-fragments/index.ts`
- [`capture/boot`](../capture/boot/README.md): `identity/password-hash/index.ts`
- [`db/seed`](../db/seed/README.md): `identity/password-hash/index.ts`
- [`evidence-export`](../evidence-export/README.md): `transcripts/index.ts`
- [`index.ts`](../index.ts): `capture-config/index.ts`
- [`plugins/authenticate`](../plugins/authenticate/README.md): `identity/index.ts`, `pairing/index.ts`
- [`realtime`](../realtime/README.md): `pairing/index.ts`
- [`sealing-host`](../sealing-host/README.md): `evidence/index.ts`, `recording-fragments/index.ts`, `transcript-chunks/index.ts`, `transcripts/index.ts`
- [`sealing-host/demo-seed`](../sealing-host/demo-seed/README.md): `recording-fragments/index.ts`
- [`sealing/finalize-transcript`](../sealing/finalize-transcript/README.md): `transcript-chunks/index.ts`, `transcripts/index.ts`
- [`sealing/pipeline`](../sealing/pipeline/README.md): `recording-fragments/index.ts`
- [`transcription`](../transcription/README.md): `stt-config/index.ts`, `transcript-chunks/index.ts`

Outbound (what this folder imports inside `src`):

- [`camera-preview`](../camera-preview/README.md)
- [`capture`](../capture/README.md)
- [`capture-notices`](../capture-notices/README.md)
- [`capture-session`](../capture-session/README.md)
- [`capture/adapters`](../capture/adapters/README.md)
- [`capture/fence`](../capture/fence/README.md)
- [`config.ts`](../config.ts)
- [`core`](../core/README.md)
- [`credential-store`](../credential-store/README.md)
- [`db/mapping`](../db/mapping/README.md)
- [`db/reset`](../db/reset/README.md)
- [`db/schema`](../db/schema/README.md)
- [`engine`](../engine/README.md)
- [`evidence-export`](../evidence-export/README.md)
- [`evidence-facts`](../evidence-facts/README.md)
- [`evidence-verify`](../evidence-verify/README.md)
- [`lcd`](../lcd/README.md)
- [`media-stream`](../media-stream/README.md)
- [`plugins/authenticate`](../plugins/authenticate/README.md)
- [`plugins/db`](../plugins/db/README.md)
- [`plugins/error-envelope`](../plugins/error-envelope/README.md)
- [`plugins/logger`](../plugins/logger/README.md)
- [`plugins/permission-guard`](../plugins/permission-guard/README.md)
- [`plugins/readiness`](../plugins/readiness/README.md)
- [`realtime`](../realtime/README.md)
- [`sealing`](../sealing/README.md)
- [`sealing-host`](../sealing-host/README.md)
- [`segment-probe-socket.ts`](../segment-probe-socket.ts)
- [`transcript-package`](../transcript-package/README.md)
- [`transcription`](../transcription/README.md)
- [`version.ts`](../version.ts)

- Workspace packages: `@dems/capture-protocol`, `@dems/shared`
- npm packages: `a
 * gap`, `drizzle-orm`, `fastify`, `fastify-type-provider-zod`, `in force`, `pg`, `rate-limiter-flexible`, `the folder is missing`, `zod`
- Node built-ins: `node:crypto`, `node:os`

## Tests

| Location | Test files | `*.db.test.ts` |
|---|---|---|
| [`__tests__/`](./__tests__/) | 1 | 0 |
| [`admin/__tests__/`](./admin/__tests__/) | 11 | 7 |
| [`alerts/__tests__/`](./alerts/__tests__/) | 4 | 1 |
| [`camera-preview/__tests__/`](./camera-preview/__tests__/) | 1 | 0 |
| [`capture-config/__tests__/`](./capture-config/__tests__/) | 13 | 5 |
| [`capture-config/camera-network/__tests__/`](./capture-config/camera-network/__tests__/) | 2 | 1 |
| [`capture-config/factory-scan/__tests__/`](./capture-config/factory-scan/__tests__/) | 2 | 1 |
| [`capture-config/host-alias/__tests__/`](./capture-config/host-alias/__tests__/) | 1 | 0 |
| [`capture-config/installation-acceptance/__tests__/`](./capture-config/installation-acceptance/__tests__/) | 2 | 1 |
| [`capture-config/network/__tests__/`](./capture-config/network/__tests__/) | 2 | 1 |
| [`capture-discovery/__tests__/`](./capture-discovery/__tests__/) | 14 | 5 |
| [`capture-discovery/connect/__tests__/`](./capture-discovery/connect/__tests__/) | 5 | 3 |
| [`capture-inputs/__tests__/`](./capture-inputs/__tests__/) | 2 | 1 |
| [`capture-inputs/audio-cards/__tests__/`](./capture-inputs/audio-cards/__tests__/) | 3 | 1 |
| [`demo/__tests__/`](./demo/__tests__/) | 10 | 5 |
| [`devices/__tests__/`](./devices/__tests__/) | 8 | 4 |
| [`evidence-export/__tests__/`](./evidence-export/__tests__/) | 2 | 0 |
| [`evidence/__tests__/`](./evidence/__tests__/) | 12 | 7 |
| [`health/__tests__/`](./health/__tests__/) | 1 | 0 |
| [`identity/__tests__/`](./identity/__tests__/) | 15 | 8 |
| [`identity/biometric/__tests__/`](./identity/biometric/__tests__/) | 11 | 8 |
| [`media-stream/__tests__/`](./media-stream/__tests__/) | 3 | 1 |
| [`network-time/__tests__/`](./network-time/__tests__/) | 3 | 1 |
| [`pairing/__tests__/`](./pairing/__tests__/) | 11 | 7 |
| [`rbac/__tests__/`](./rbac/__tests__/) | 2 | 1 |
| [`recording-fragments/__tests__/`](./recording-fragments/__tests__/) | 2 | 1 |
| [`sealing/__tests__/`](./sealing/__tests__/) | 1 | 0 |
| [`security-audit/__tests__/`](./security-audit/__tests__/) | 11 | 6 |
| [`sessions/__tests__/`](./sessions/__tests__/) | 10 | 6 |
| [`storage/__tests__/`](./storage/__tests__/) | 5 | 2 |
| [`stt-config/__tests__/`](./stt-config/__tests__/) | 6 | 3 |
| [`system/__tests__/`](./system/__tests__/) | 5 | 2 |
| [`transcript-chunks/__tests__/`](./transcript-chunks/__tests__/) | 2 | 1 |
| [`transcripts/__tests__/`](./transcripts/__tests__/) | 7 | 2 |

92 test file(s) end in `.db.test.ts`: they need a PostgreSQL test database and run only in a DB window, not in the plain unit run.

Tests elsewhere that import it (21 folders): `src/__tests__`, `src/capture-notices/__tests__`, `src/capture/__tests__`, `src/capture/adapters/__tests__`, `src/capture/boot/__tests__`, `src/capture/fence/__tests__`, `src/core/__tests__`, `src/db/fixtures`, and more.

## Related decisions

No entry of the 2026-11-05 audit decisions log names this folder or its files. Code comments cite earlier design decisions; see the file headers.
