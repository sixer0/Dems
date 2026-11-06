# `src/transcription`

Up: [`src`](../README.md)

## Purpose

The Core's transcription composition: puts the `apps/transcriber` library to work with the Core's database, credential store and capture sessions (host statements, credential reveal and opener, model provenance, probe, scratch space and per-session runs).

## Contents

| File or folder | Role |
|---|---|
| [`boot.ts`](./boot.ts) | The CS-22 boot step of the transcriber. |
| [`credential-opener.ts`](./credential-opener.ts) | The opener of an `ENCRYPTED` STT credential. |
| [`credential-reveal.ts`](./credential-reveal.ts) | The one caller of the reveal function of the STT credential. |
| [`host.ts`](./host.ts) | What the host knows about the transcriber. |
| [`index.ts`](./index.ts) | The core's transcription composition. |
| [`log.ts`](./log.ts) | The transcriber's log, written to the Core's two sinks. |
| [`model-provenance.ts`](./model-provenance.ts) | The provenance of a session's STT model: manifest fields 84 to 87. |
| [`probe.ts`](./probe.ts) | The probe of operation 92 in production wiring. |
| [`scratch.ts`](./scratch.ts) | The removal of a session's transcriber scratch. |
| [`session-run.ts`](./session-run.ts) | The transcriber session of a recording, from capture start to the seal. |
| [`session.ts`](./session.ts) | The transcription of one session, built from its snapshot. |
| [`snapshot.ts`](./snapshot.ts) | The STT configuration of a session, as it was at its start. |
| [`statements.ts`](./statements.ts) | The statements of the session STT snapshot. |

## Main exports and entry points

Other units import this folder through `index.ts`.

- Exported from `index.ts`: `TranscriptionServiceState`, `READ_SESSION_INTERVALS_FOR_TRANSCRIPT`, `transcriptIntervalsOf`, `SESSION_START_CHECK_TIMEOUT_MS`, `transcriptionControl`, `transcriptionServiceSource`, `mountTranscription`, `TRANSCRIBER_BOOT_STEP`, `TranscriberBootError`, `TranscriberBootFailure`, `runTranscriberBoot`, `TranscriberBootDeps`, `TranscriberBootOutcome`, `SttCredentialOpenError`, `SttCredentialOpenFailure`, `coreSttEnvelopeOpener`, `SttEnvelopeOpener`, `REVEAL_STT_CREDENTIAL`, `SttCredentialRevealError`, `revealSttCredential`, `RevealedSttCredential`, `TRANSCRIBER_HOST_FILE`, `TRANSCRIBER_HOST_FOLDER`, `TRANSCRIBER_SCRATCH_FOLDER`, `TRANSCRIPTION_SESSIONS_FOLDER`, `TRANSCRIPTION_TAP_FILE`, `TranscriberHostError`, `readTranscriberHost`, `sessionScratchDir`, `sessionTapPath`, and 52 more.
- Types exported from `index.ts`: `TranscriptionServiceState`, `TranscriptionServiceReport`, `SttSessionWarning`, `SnapshotOutcome`, `TranscriptionControl`, `TranscriptionHost`, `MountTranscriptionDeps`.

## Dependencies

Module-level imports of the production files (tests excluded).

Inbound (who imports this folder):

- [`capture-session`](../capture-session/README.md): `index.ts`
- [`modules/stt-config`](../modules/stt-config/README.md): `index.ts`
- [`modules/system`](../modules/system/README.md): `index.ts`
- [`sealing-host`](../sealing-host/README.md): `index.ts`

Outbound (what this folder imports inside `src`):

- [`credential-store`](../credential-store/README.md)
- [`modules/stt-config`](../modules/stt-config/README.md)
- [`modules/transcript-chunks`](../modules/transcript-chunks/README.md)

- Workspace packages: `@dems/shared`, `@dems/transcriber`
- npm packages: `pg`, `zod`
- Node built-ins: `node:crypto`, `node:fs`, `node:os`, `node:path`

## Tests

| Location | Test files | `*.db.test.ts` |
|---|---|---|
| [`__tests__/`](./__tests__/) | 11 | 1 |

1 test file(s) end in `.db.test.ts`: they need a PostgreSQL test database and run only in a DB window, not in the plain unit run.

Tests elsewhere that import it (5 folders): `src/capture-session/__tests__`, `src/db/reset/__tests__`, `src/modules/stt-config/__tests__`, `src/modules/system/__tests__`, `src/sealing/__tests__`.

## Related decisions

No entry of the 2026-11-05 audit decisions log names this folder or its files. Code comments cite earlier design decisions; see the file headers.
