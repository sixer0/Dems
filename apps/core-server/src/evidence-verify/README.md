# `src/evidence-verify`

Up: [`src`](../README.md)

## Purpose

Verification of a real sealed evidence package at the Core: reading the package folder, opening its fragments with the session keys, running the checks, and recording and answering the verdict.

## Contents

| File or folder | Role |
|---|---|
| [`fragment-opener.ts`](./fragment-opener.ts) | The fragment opener of verify V2 at the Core. |
| [`index.ts`](./index.ts) | Verification of a real sealed evidence package at the Core. |
| [`package-reader.ts`](./package-reader.ts) | The file-system side of verify v2: one sealed package folder as a `PackageReader`. |
| [`source-class-agreement.ts`](./source-class-agreement.ts) | M7-DEVSRC-BUILD-1: the adapter kinds of the Core and the adapter kinds the package maps to a manifest source class are the same set, held at compile time. |

## Main exports and entry points

Other units import this folder through `index.ts`.

- Exported from `index.ts`: `isSeedSealedDemoItem`, `hasSealedPackageHere`, `SigningKeyVerdict`, `COMPROMISED_KEY_NOTICE_CODE`, `COMPROMISED_KEY_NOTICE_REPORT`, `PACKAGE_MANIFEST_FILE_V1`, `sessionPackageDir`, `sessionManifestPath`, `corePorts`, `contractBodyOf`, `custodyDetailOf`, `readSealedSourceMark`, `verifySealedPackageUnderCoreTrust`, `markedCertificatesOfPackage`, `createRealEvidenceVerification`, `coreFragmentOpener`, `PACKAGE_READ_CHUNK_BYTES`, `createPackageReader`.
- Types exported from `index.ts`: `PackagedItemFacts`, `RealEvidenceItem`, `SigningKeyVerdict`, `VerdictRecord`, `VerdictRecorder`, `RealVerificationOptions`, `RealVerificationRun`, `RealVerification`, `SealedSourceMark`, `SealedSourceMarkAnchors`, `CoreTrustVerification`.

## Dependencies

Module-level imports of the production files (tests excluded).

Inbound (who imports this folder):

- [`db/reset`](../db/reset/README.md): `index.ts`
- [`evidence-export`](../evidence-export/README.md): `index.ts`
- [`evidence-facts`](../evidence-facts/README.md): `index.ts`
- [`media-stream`](../media-stream/README.md): `index.ts`
- [`modules/transcripts`](../modules/transcripts/README.md): `index.ts`
- [`sealing-host`](../sealing-host/README.md): `index.ts`
- [`sealing-host/demo-seed`](../sealing-host/demo-seed/README.md): `index.ts`

Outbound (what this folder imports inside `src`):

- [`capture`](../capture/README.md)
- [`capture/adapters`](../capture/adapters/README.md)
- [`credential-store`](../credential-store/README.md)
- [`plugins/authenticate`](../plugins/authenticate/README.md)

- Workspace packages: `@dems/shared`
- Node built-ins: `node:crypto`, `node:fs`, `node:path`

## Tests

| Location | Test files | `*.db.test.ts` |
|---|---|---|
| [`__tests__/`](./__tests__/) | 10 | 0 |

None of these tests needs a database window.

Tests elsewhere that import it (12 folders): `src/capture/fence/__tests__/e2e`, `src/db/reset/__tests__`, `src/evidence-export/__tests__`, `src/evidence-facts/__tests__`, `src/media-stream/__tests__`, `src/modules/capture-config/__tests__/e2e`, `src/modules/demo/__tests__`, `src/modules/evidence/__tests__`, and more.

## Related decisions

No entry of the 2026-11-05 audit decisions log names this folder or its files. Code comments cite earlier design decisions; see the file headers.
