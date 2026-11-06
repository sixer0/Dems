# `src/capture/fence`

Up: [`src/capture`](../README.md)

## Purpose

The capture fence: the one definition of the capture operation (simulated, development or production), the `capture.fence` boot step with its refusals, the development test sources (generated cameras and microphones), and the production parts that the capture composition is allowed to use.

## Contents

| File or folder | Role |
|---|---|
| [`boot-key.ts`](./boot-key.ts) | Which key the Core started with: the two public members a real boot adds to the details of its `SYSTEM_BOOT` audit entry, beside `captureOperation`: signingKeyId the id of the evidence signing key... |
| [`boot.ts`](./boot.ts) | The boot of the capture fence. |
| [`development-discovery.ts`](./development-discovery.ts) | The admission of a development discovery source. |
| [`fake-mic.ts`](./fake-mic.ts) | What a test microphone plays. |
| [`fake-profile.ts`](./fake-profile.ts) | The selector line of a generated test source states its adapter's profile. |
| [`generated-sources.ts`](./generated-sources.ts) | The development test sources: adapters of kind `FAKE` that really feed the worker. |
| [`index.ts`](./index.ts) | The capture fence. |
| [`operation.ts`](./operation.ts) | The one definition of the capture operation. |
| [`production-parts.ts`](./production-parts.ts) | The capture unit's own parts of production capture. |
| [`registration.ts`](./registration.ts) | Registration of this Mac's camera and microphone as device rows of their own. |
| [`sources.ts`](./sources.ts) | The eight `session_capture_sources` rows of a session, and what a client is told about a source. |
| [`statements.ts`](./statements.ts) | The statements of the capture fence. |

## Main exports and entry points

Other units import this folder through `index.ts`.

- Exported from `index.ts`: `inspectHelperProgram`, `CAPTURE_RUN_SUBPATH`, `CaptureDeviceAdmission`, `buildDevelopmentRegistry`, `buildProductionRegistry`, `ADMISSION_FAILED`, `buildProductionRegistryOf`, `PRODUCTION_MICROPHONE_OPENER_PLATFORM`, `MACOS_MICROPHONE_OPENER_PLATFORM`, `MACOS_MICROPHONE_OPENER_ADMITTED`, `MACOS_MIC_UNCONFIRMED_PASSES`, `ProductionWiringCode`, `macosLossMatchOf`, `wireProductionRegistry`, `DEV_SOURCE_SWITCH_REFUSED`, `DevelopmentSourceSwitchRefusedError`, `captureFenceControl`, `mountCaptureFence`, `BOOT_AUDIT_OPERATIONS`, `CAPTURE_FENCE_BOOT_STEP`, `CaptureFenceError`, `CaptureFenceRefusal`, `DEVELOPMENT_FENCE_REFUSALS`, `HelperProgramProblem`, `captureFenceRefusalOf`, `helperProgramProblemOf`, `runCaptureFenceBoot`, `AssignedSource`, `CaptureFenceBootDeps`, `CaptureFenceOutcome`, and 118 more.
- Types exported from `index.ts`: `HelperProgramInspector`, `DevelopmentRegistryInput`, `CaptureProbeAdapters`, `BuiltCaptureRegistry`, `CaptureDeviceAdmission`, `ProductionRegistryDevices`, `ProductionRegistryAdapters`, `ProductionAdapterLoader`, `ProductionRegistryInput`, `LateDeviceAdapter`, `BuiltProductionRegistry`, `ProductionWiringAdmission`, `ProductionAudioParts`, `ProductionCaptureParts`, `ProductionWiringEnvironment`, and 2 more.

## Dependencies

Module-level imports of the production files (tests excluded).

Inbound (who imports this folder):

- [`capture`](../README.md): `index.ts`
- [`capture-composition.ts`](../../capture-composition.ts): `index.ts`
- [`capture-notices`](../../capture-notices/README.md): `index.ts`
- [`capture-session`](../../capture-session/README.md): `index.ts`
- [`capture/boot`](../boot/README.md): `operation.ts`
- [`db/seed`](../../db/seed/README.md): `index.ts`
- [`evidence-export`](../../evidence-export/README.md): `index.ts`
- [`evidence-facts`](../../evidence-facts/README.md): `index.ts`
- [`lcd`](../../lcd/README.md): `index.ts`
- [`modules/capture-config`](../../modules/capture-config/README.md): `index.ts`
- [`modules/capture-discovery`](../../modules/capture-discovery/README.md): `index.ts`
- [`modules/capture-inputs`](../../modules/capture-inputs/README.md): `index.ts`
- [`modules/devices`](../../modules/devices/README.md): `index.ts`
- [`modules/evidence`](../../modules/evidence/README.md): `index.ts`
- [`modules/system`](../../modules/system/README.md): `index.ts`
- [`sealing-host`](../../sealing-host/README.md): `index.ts`

Outbound (what this folder imports inside `src`):

- [`capture`](../README.md)
- [`capture/adapters`](../adapters/README.md)
- [`capture/boot`](../boot/README.md)
- [`capture/host-alias`](../host-alias/README.md)
- [`capture/signer`](../signer/README.md)

- Workspace packages: `@dems/capture-protocol`, `@dems/shared`
- npm packages: `-([0-9]+)$`, `fastify`

## Tests

| Location | Test files | `*.db.test.ts` |
|---|---|---|
| [`__tests__/`](./__tests__/) | 7 | 3 |

3 test file(s) end in `.db.test.ts`: they need a PostgreSQL test database and run only in a DB window, not in the plain unit run.

Tests elsewhere that import it (23 folders): `src/__tests__`, `src/capture-notices/__tests__`, `src/capture-session/__tests__`, `src/capture/adapters/__tests__`, `src/capture/adapters/audio/__tests__`, `src/capture/boot/__tests__`, `src/db/seed/__tests__`, `src/engine/__tests__`, and more.

## Related decisions

No entry of the 2026-11-05 audit decisions log names this folder or its files. Code comments cite earlier design decisions; see the file headers.
