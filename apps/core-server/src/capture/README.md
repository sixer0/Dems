# `src/capture`

Up: [`src`](../README.md)

## Purpose

The capture unit: the one door (the `capture` seam) between the Core server and the capture worker process. It owns the supervisor (one worker process per session, heartbeat, restart with back-off), the process channel that starts the worker, the forwarder of worker events to the engine, the fragment reader of camera files, and the destination rule for camera addresses.

## Contents

| File or folder | Role |
|---|---|
| [`destination-rule.ts`](./destination-rule.ts) | The one destination rule: where the Core may dial on somebody's word. |
| [`forwarder.ts`](./forwarder.ts) | The forwarder: from the supervisor's events to the engine's internal actions. |
| [`fragments.ts`](./fragments.ts) | The camera file read again: box walk, fragment chain and tail validation. |
| [`index.ts`](./index.ts) | Capture module. |
| [`ingest-address.ts`](./ingest-address.ts) | The ingest address of a camera track: one function, in a unit that imports nothing. |
| [`ipc.ts`](./ipc.ts) | The capture worker as a child process. |
| [`stale-notices.ts`](./stale-notices.ts) | The capture notices a Core that went down left active. |
| [`supervisor.ts`](./supervisor.ts) | The capture supervisor. |
| [`timers.ts`](./timers.ts) | The timers of the capture supervisor. |
| [`types.ts`](./types.ts) | Types of the capture supervisor. |
| [`worker-arguments.ts`](./worker-arguments.ts) | The arguments of a capture worker process: one set for every start. |
| [`adapters/`](./adapters/README.md) | The adapter layer of the Core process: the three adapter seams (camera, PoE, microphone), the vocabulary of adapter kinds and source classes, the device registry and its refusal rules, camera credential and stream-locator handling, and the loader of the production adapters. See its README. |
| [`boot/`](./boot/README.md) | The boot checks of real capture. See its README. |
| [`fence/`](./fence/README.md) | The capture fence: the one definition of the capture operation (simulated, development or production), the `capture.fence` boot step with its refusals, the development test sources (generated cameras and microphones), and the production parts that the capture composition is allowed to use. See its README. |
| [`host-alias/`](./host-alias/README.md) | The Core's side of the address helper: its line protocol, the one caller, and the lifecycle, store and journal of the one temporary host address. See its README. |
| [`signer/`](./signer/README.md) | The evidence signer: a software Ed25519 key at rest (provisioning, loading, compromise mark), its self-signed certificate, signing and checking of a v2 manifest, and the key record shown in the Security & Audit view. See its README. |

## Main exports and entry points

Other units import this folder through `index.ts`.

- Exported from `index.ts`: `writeSupervisorFaults`, `captureModule`, `CAPTURE_MIC_RATE_LIMIT_PPM`, `CAPTURE_WARNING_CLEAR_HOLD_MS`, `CaptureNoticeCode`, `ForwarderReportCode`, `SUPERVISOR_REFUSAL_REASONS`, `forwardCaptureEvents`, `CaptureEngine`, `CaptureForwarderOptions`, `CaptureNotice`, `CAPTURE_WORKER_VERSION`, `captureBootControl`, `captureHostOfProcess`, `INTERFACE_FILE_COMMAND`, `captureHostRunnerOf`, `HostCommandRunner`, `CameraLinkState`, `createCameraLinkSource`, `CameraLinkReading`, `CameraLinkSource`, `storedCameraInterface`, `createProcessLauncher`, `unconfiguredLauncher`, `ProcessLauncherOptions`, `MAX_SESSION_ID_CHARS`, `OUTPUT_EXISTS`, `captureDownReasonOf`, `createCaptureSupervisor`, `restatePairedMics`, and 38 more.

## Dependencies

Module-level imports of the production files (tests excluded).

Inbound (who imports this folder):

- [`app.ts`](../app.ts): `index.ts`
- [`capture-composition.ts`](../capture-composition.ts): `fence/index.ts`, `index.ts`
- [`capture-notices`](../capture-notices/README.md): `adapters/index.ts`, `fence/index.ts`
- [`capture-session`](../capture-session/README.md): `adapters/index.ts`, `fence/index.ts`, `index.ts`
- [`db/seed`](../db/seed/README.md): `boot/checks.ts`, `fence/index.ts`
- [`evidence-export`](../evidence-export/README.md): `fence/index.ts`, `index.ts`
- [`evidence-facts`](../evidence-facts/README.md): `fence/index.ts`
- [`evidence-verify`](../evidence-verify/README.md): `adapters/index.ts`, `index.ts`
- [`index.ts`](../index.ts): `index.ts`
- [`lcd`](../lcd/README.md): `fence/index.ts`
- [`modules/capture-config`](../modules/capture-config/README.md): `adapters/index.ts`, `fence/index.ts`, `index.ts`
- [`modules/capture-discovery`](../modules/capture-discovery/README.md): `adapters/index.ts`, `fence/index.ts`, `index.ts`
- [`modules/capture-inputs`](../modules/capture-inputs/README.md): `fence/index.ts`
- [`modules/devices`](../modules/devices/README.md): `fence/index.ts`
- [`modules/evidence`](../modules/evidence/README.md): `fence/index.ts`
- [`modules/system`](../modules/system/README.md): `fence/index.ts`, `index.ts`
- [`modules/transcripts`](../modules/transcripts/README.md): `index.ts`
- [`sealing`](../sealing/README.md): `index.ts`
- [`sealing-host`](../sealing-host/README.md): `adapters/index.ts`, `fence/index.ts`, `index.ts`
- [`sealing/pipeline`](../sealing/pipeline/README.md): `index.ts`

Outbound (what this folder imports inside `src`):

- [`engine`](../engine/README.md)
- [`modules/identity`](../modules/identity/README.md)
- [`plugins/logger`](../plugins/logger/README.md)

- Workspace packages: `@dems/capture-protocol`, `@dems/shared`
- npm packages: `-([0-9]+)$`, `fastify`, `none:(0/[1-9][0-9]?)`, `none:0`, `none:<n>`, `onvif`, `pg`, `the server runtime
 * starts no child process`, `xml2js`
- Node built-ins: `node:child_process`, `node:crypto`, `node:dgram`, `node:fs`, `node:http`, `node:https`, `node:os`, `node:path`, `node:stream`

## Tests

| Location | Test files | `*.db.test.ts` |
|---|---|---|
| [`__tests__/`](./__tests__/) | 18 | 1 |
| [`adapters/__tests__/`](./adapters/__tests__/) | 7 | 1 |
| [`adapters/audio/__tests__/`](./adapters/audio/__tests__/) | 12 | 0 |
| [`adapters/camera/__tests__/`](./adapters/camera/__tests__/) | 15 | 0 |
| [`adapters/local/__tests__/`](./adapters/local/__tests__/) | 11 | 0 |
| [`boot/__tests__/`](./boot/__tests__/) | 11 | 0 |
| [`fence/__tests__/`](./fence/__tests__/) | 7 | 3 |
| [`host-alias/__tests__/`](./host-alias/__tests__/) | 3 | 1 |
| [`signer/__tests__/`](./signer/__tests__/) | 6 | 0 |

6 test file(s) end in `.db.test.ts`: they need a PostgreSQL test database and run only in a DB window, not in the plain unit run.

Tests elsewhere that import it (29 folders): `src/__tests__`, `src/capture-notices/__tests__`, `src/capture-session/__tests__`, `src/credential-store/__tests__`, `src/db/seed/__tests__`, `src/engine/__tests__`, `src/evidence-export/__tests__`, `src/evidence-verify/__tests__`, and more.

## Related decisions

From the 2026-11-05 audit decisions log:

- D150: session durability counts camera-file records only (`supervisor.ts`).
- D235: mic line resolved by mic id first; `forwarder.ts` checked.
- D240: `forwarder.ts` unchanged; worker levels already carry the mic id.
