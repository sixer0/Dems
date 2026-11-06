# `src/sealing-host`

Up: [`src`](../README.md)

## Purpose

The composition of the sealing pipeline in the running Core, in real capture modes only: it supplies the production ports (journal, session keys, installation identity, session reader, transcript step, progress) to `src/sealing`. A closed unit; other units import its index only.

## Contents

| File or folder | Role |
|---|---|
| [`index.ts`](./index.ts) | The composition of the sealing pipeline in the running Core. |
| [`installation-identity.ts`](./installation-identity.ts) | The installation identity of the Core: what the signed manifest of a sealed recording states as its device - manifest fields 20 and 21. |
| [`progress.ts`](./progress.ts) | The answer of operation 83 `getSealingProgress`. |
| [`session-key.ts`](./session-key.ts) | The SEAL-TIME cipher of the Core. |
| [`session-reader.ts`](./session-reader.ts) | The session as the seal reads it: the production `SealSessionReader`. |
| [`transcript-step.ts`](./transcript-step.ts) | `FINALIZE_TRANSCRIPT` as the running Core calls it. |
| [`demo-seed/`](./demo-seed/README.md) | The seed-time generator of the v2 demo packages: demo items are sealed by the Core into its own evidence store with the product pipeline, because a v2 package is bound to one Core's keys and cannot be a committed asset. See its README. |

## Main exports and entry points

Other units import this folder through `index.ts`.

- Exported from `index.ts`: `SEALING_RESUME_BOOT_STEP`, `INSTALLATION_IDENTITY_BOOT_STEP`, `SEAL_NOTHING_DURABLE_REASON`, `DEV_SEAL_RIG_REFUSED_CODE`, `SealRigRefusedError`, `SESSION_KEY_START_TEXT`, `sealingHost`, `mountSealingHost`, `isTimedSeal`, `sealingProgressOf`, `sessionKeyIdOf`, `sessionKeyStartRefusal`, `SessionKeyStartRefusal`, * from `./demo-seed`, `NO_STT_SNAPSHOT_RECORDED`, `SEAL_NOTICE`, `STAND_INS`, `STT_SNAPSHOT_NOT_RECORDED_MODEL`, `isSttSnapshotNotRecorded`, `streamProfileOf`, `SealVideoFormat`, `NO_TRANSCRIPT_LIMITS`, `SealTranscriptCode`, `createSealTranscriptStep`, `SealTranscriptRuns`, `SealTranscriptStepOptions`.
- Types exported from `index.ts`: `SealingHostSettings`, `SealingHost`.

## Dependencies

Module-level imports of the production files (tests excluded).

Inbound (who imports this folder):

- [`db/seed`](../db/seed/README.md): `index.ts`
- [`modules/capture-discovery`](../modules/capture-discovery/README.md): `index.ts`
- [`modules/sealing`](../modules/sealing/README.md): `index.ts`
- [`modules/sessions`](../modules/sessions/README.md): `index.ts`

Outbound (what this folder imports inside `src`):

- [`capture`](../capture/README.md)
- [`capture-session`](../capture-session/README.md)
- [`capture/adapters`](../capture/adapters/README.md)
- [`capture/fence`](../capture/fence/README.md)
- [`core`](../core/README.md)
- [`credential-store`](../credential-store/README.md)
- [`engine`](../engine/README.md)
- [`evidence-export`](../evidence-export/README.md)
- [`evidence-verify`](../evidence-verify/README.md)
- [`modules/evidence`](../modules/evidence/README.md)
- [`modules/recording-fragments`](../modules/recording-fragments/README.md)
- [`modules/transcript-chunks`](../modules/transcript-chunks/README.md)
- [`modules/transcripts`](../modules/transcripts/README.md)
- [`plugins/authenticate`](../plugins/authenticate/README.md)
- [`plugins/error-envelope`](../plugins/error-envelope/README.md)
- [`plugins/logger`](../plugins/logger/README.md)
- [`sealing`](../sealing/README.md)
- [`transcription`](../transcription/README.md)
- [`version.ts`](../version.ts)

- Workspace packages: `@dems/shared`
- npm packages: `fastify`, `pg`
- Node built-ins: `node:fs`, `node:path`

## Tests

| Location | Test files | `*.db.test.ts` |
|---|---|---|
| [`__tests__/`](./__tests__/) | 11 | 1 |

1 test file(s) end in `.db.test.ts`: they need a PostgreSQL test database and run only in a DB window, not in the plain unit run.

Tests elsewhere that import it (12 folders): `src/capture-session/__tests__`, `src/capture/adapters/camera/__tests__`, `src/db/reset/__tests__`, `src/engine/__tests__`, `src/modules/capture-config/__tests__`, `src/modules/capture-discovery/connect/__tests__`, `src/modules/devices/__tests__`, `src/modules/evidence/__tests__`, and more.

## Related decisions

No entry of the 2026-11-05 audit decisions log names this folder or its files. Code comments cite earlier design decisions; see the file headers.
