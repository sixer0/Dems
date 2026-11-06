# `src/capture/boot`

Up: [`src/capture`](../README.md)

## Purpose

The boot checks of real capture. It mounts one boot step, `capture.boot`, that decides whether a real capture start is allowed: the worker handshake, the evidence store probe, the host checks, the delivered-program checks and the camera interface link.

## Contents

| File or folder | Role |
|---|---|
| [`camera-link.ts`](./camera-link.ts) | The link of the camera interface, as the kernel states it. |
| [`checks.ts`](./checks.ts) | The CS-22 boot checks of real capture. |
| [`evidence-volume.ts`](./evidence-volume.ts) | The probe of the evidence store. |
| [`host-checks.ts`](./host-checks.ts) | The host checks of a production Core. |
| [`host-facts.ts`](./host-facts.ts) | The host facts of the core's own process, as the entry point hands them to the boot checks. |
| [`index.ts`](./index.ts) | The boot checks of real capture, mounted. |
| [`program-checks.ts`](./program-checks.ts) | The boot checks of the delivered programs. |
| [`worker-probe.ts`](./worker-probe.ts) | The worker's handshake at boot. |
| [`worker-stamp.ts`](./worker-stamp.ts) | The build stamp of the capture worker, as the Core reads it at boot. |

## Main exports and entry points

Other units import this folder through `index.ts`.

- Exported from `index.ts`: `HOST_NOT_SEEN`, `HOST_FACTS_NOT_TAKEN`, `CaptureHostFactsError`, `INSTALLATION_ID_NOT_TAKEN`, `CaptureInstallationIdError`, `captureBootControl`, `bootHostPlatformOf`, `STORAGE_VOLUME_NOT_APPLIED`, `storedSigningKeyReaders`, `SIGNING_KEY_UNIT_PREFIX`, `InstallationBindingProblem`, `signingKeyInstallationProblemOf`, `organisationalUnitsOf`, `SELECT_STORED_HASH_SETS`, `demoPasswordHashSetsAmong`, `storedHashSetIsDemoPassword`, `storedDemoPasswordOperators`, `SYSTEM_LISTING_PROGRAMS`, `SELECT_STORED_CAMERA_INTERFACE`, `storedCameraInterface`, `mountCaptureBootChecks`, `CAPTURE_BOOT_STEP`, `CAPTURE_WORKER_VERSION`, `CaptureBootError`, `CaptureBootRefusal`, `EvidenceStoreProblem`, `HandshakeFailure`, `OPERATORS_UNREADABLE`, `PLATFORM_NOT_LINUX_OR_DARWIN`, `PRODUCTION_PLATFORMS`, and 71 more.
- Types exported from `index.ts`: `CaptureBootHostFacts`, `CaptureBootControl`, `CaptureBootMount`, `InstallationBindingProblem`, `StoredHashSetRow`.

## Dependencies

Module-level imports of the production files (tests excluded).

Inbound (who imports this folder):

- [`capture`](../README.md): `checks.ts`, `index.ts`
- [`capture/fence`](../fence/README.md): `checks.ts`, `index.ts`
- [`db/seed`](../../db/seed/README.md): `checks.ts`

Outbound (what this folder imports inside `src`):

- [`capture`](../README.md)
- [`capture/adapters`](../adapters/README.md)
- [`capture/fence`](../fence/README.md)
- [`capture/signer`](../signer/README.md)
- [`engine`](../../engine/README.md)
- [`modules/identity`](../../modules/identity/README.md)

- Workspace packages: `@dems/capture-protocol`, `@dems/shared`
- npm packages: `fastify`, `pg`
- Node built-ins: `node:fs`, `node:path`

## Tests

| Location | Test files | `*.db.test.ts` |
|---|---|---|
| [`__tests__/`](./__tests__/) | 11 | 0 |

None of these tests needs a database window.

Tests elsewhere that import it (19 folders): `src/__tests__`, `src/capture-notices/__tests__`, `src/capture-session/__tests__`, `src/capture/__tests__`, `src/capture/fence/__tests__`, `src/capture/fence/__tests__/e2e`, `src/capture/signer/__tests__`, `src/engine/__tests__`, and more.

## Related decisions

From the 2026-11-05 audit decisions log:

- D23: point (1): link-up trigger for the camera sweep, which `camera-link.ts` implements.
- D41: `camera-link.ts` may import `node:fs/promises` read-only.
- D71: `boot/index.ts` imports `camera-link.ts`; both deploy together.
