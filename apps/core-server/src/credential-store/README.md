# `src/credential-store`

Up: [`src`](../README.md)

## Purpose

The Core credential store: the one place for every key the Core holds for data at rest (the STT credential key, camera credential keys and the per-session recording keys), with the envelope format and the fragment cipher built on them.

## Contents

| File or folder | Role |
|---|---|
| [`envelope.ts`](./envelope.ts) | The credential envelope, version. |
| [`errors.ts`](./errors.ts) | The failures of the Core credential store. |
| [`fragment-cipher.ts`](./fragment-cipher.ts) | Per-fragment AES-256-GCM. |
| [`index.ts`](./index.ts) | The Core credential store. |
| [`key-material.ts`](./key-material.ts) | Key material as an opaque object. |
| [`key-store.ts`](./key-store.ts) | The key files of the Core credential store. |

## Main exports and entry points

Other units import this folder through `index.ts`.

- Exported from `index.ts`: `CredentialPurpose`, `SESSION_KEY_PREFIX`, `sessionKeyScopeOf`, `sessionKeyFolderOf`, `SESSION_KEY_BINDING`, `createCredentialStore`, `coreCredentialStore`, `CredentialStoreError`, `CredentialStoreFailure`, `FragmentAuthenticationError`, `ENVELOPE_ALGORITHM`, `ENVELOPE_MIN_CIPHERTEXT_BYTES`, `ENVELOPE_VERSION`, `isSealedSecret`, `isStoreSealedSecret`, `SealedSecret`, `StoreSealedSecret`, `KEY_MARK`, `KeyMaterial`, `FRAGMENT_NONCE_BYTES`, `FRAGMENT_TAG_BYTES`, `createFragmentSealer`, `fragmentAad`, `openFragment`, `planRangeRead`, `readDecryptedRange`, `ByteRange`, `DecryptedRangeRequest`, `FragmentKey`, `FragmentPosition`, and 5 more.
- Types exported from `index.ts`: `CredentialPurpose`, `SttCredentialCipher`, `CaptureCredentialCipher`, `CredentialKeyRotation`, `SessionKeys`, `NamedSecrets`, `KeyWrapSecretStore`, `CoreCredentialStore`, `CredentialStoreOptions`, `CoreCredentialStoreStatus`, `CredentialStoreHost`.

## Dependencies

Module-level imports of the production files (tests excluded).

Inbound (who imports this folder):

- [`capture-composition.ts`](../capture-composition.ts): `index.ts`
- [`evidence-verify`](../evidence-verify/README.md): `index.ts`
- [`media-stream`](../media-stream/README.md): `index.ts`
- [`modules/capture-discovery`](../modules/capture-discovery/README.md): `index.ts`
- [`modules/stt-config`](../modules/stt-config/README.md): `index.ts`
- [`sealing-host`](../sealing-host/README.md): `index.ts`
- [`transcription`](../transcription/README.md): `index.ts`

Outbound: imports nothing else inside `src`.

- Node built-ins: `node:crypto`, `node:fs`, `node:path`

## Tests

| Location | Test files | `*.db.test.ts` |
|---|---|---|
| [`__tests__/`](./__tests__/) | 4 | 0 |

None of these tests needs a database window.

Tests elsewhere that import it (13 folders): `src/db/reset/__tests__`, `src/evidence-export/__tests__`, `src/evidence-verify/__tests__`, `src/modules/capture-config/__tests__`, `src/modules/capture-config/__tests__/e2e`, `src/modules/capture-discovery/__tests__`, `src/modules/capture-discovery/connect/__tests__`, `src/modules/evidence/__tests__`, and more.

## Related decisions

No entry of the 2026-11-05 audit decisions log names this folder or its files. Code comments cite earlier design decisions; see the file headers.
