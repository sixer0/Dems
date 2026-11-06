# `src/capture/signer`

Up: [`src/capture`](../README.md)

## Purpose

The evidence signer: a software Ed25519 key at rest (provisioning, loading, compromise mark), its self-signed certificate, signing and checking of a v2 manifest, and the key record shown in the Security & Audit view. It registers no route and reads no configuration.

## Contents

| File or folder | Role |
|---|---|
| [`der.ts`](./der.ts) | A minimal DER writer for the self-signed certificate of the evidence signing key. |
| [`host-key.ts`](./host-key.ts) | The software Ed25519 key of the Core on this machine. |
| [`index.ts`](./index.ts) | Evidence signer. |
| [`key-record.ts`](./key-record.ts) | CS-13: the real signing-key record for the Security & Audit view. |
| [`seal.ts`](./seal.ts) | Signing a v2 manifest. |
| [`types.ts`](./types.ts) | The `Signer` seam. |

## Main exports and entry points

Other units import this folder through `index.ts`.

- Exported from `index.ts`: `buildSelfSignedCertificate`, `certificateDer`, `certificatePem`, `subjectText`, `utcFields`, `CertificateRequest`, `CertificateSubject`, `ACTIVE_KEY_POINTER_NAME`, `SIGNING_CERTIFICATE_VALIDITY_DAYS`, `activateSigningKey`, `activeSigningKeyId`, `fileWrapSecrets`, `loadSoftwareSigner`, `lookAtSigningKeyStore`, `markSigningKeyCompromised`, `nextSigningKeyId`, `signingKeySeriesNumber`, `provisionSigningKey`, `readRetainedCertificates`, `readSigningCertificate`, `readStoredCertificate`, `refuseHoldWithoutBootKey`, `RetainedCertificateRefusal`, `signerHeldToBoot`, `verifyEd25519`, `KeyStoreOptions`, `LoadedSigner`, `SignerHold`, `SigningKeyStoreLook`, `ProvisionOptions`, and 19 more.

## Dependencies

Module-level imports of the production files (tests excluded).

Inbound (who imports this folder):

- [`capture`](../README.md): `index.ts`
- [`capture/boot`](../boot/README.md): `index.ts`
- [`capture/fence`](../fence/README.md): `index.ts`

Outbound: imports nothing else inside `src`.

- Workspace packages: `@dems/shared`
- Node built-ins: `node:crypto`, `node:fs`, `node:path`

## Tests

| Location | Test files | `*.db.test.ts` |
|---|---|---|
| [`__tests__/`](./__tests__/) | 6 | 0 |

None of these tests needs a database window.

Tests elsewhere that import it (3 folders): `src/capture/boot/__tests__`, `src/capture/fence/__tests__`, `src/credential-store/__tests__`.

## Related decisions

No entry of the 2026-11-05 audit decisions log names this folder or its files. Code comments cite earlier design decisions; see the file headers.
