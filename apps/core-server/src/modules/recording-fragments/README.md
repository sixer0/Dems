# `src/modules/recording-fragments`

Up: [`src/modules`](../README.md)

## Purpose

The `recording_fragments` store and the recorder that feeds it from the capture worker's checkpoint records: one row per fragment per camera, in order, without a gap, idempotent on a replay.

## Contents

| File or folder | Role |
|---|---|
| [`index.ts`](./index.ts) | The `recording_fragments` store and the recorder that feeds it from the capture worker's checkpoint records. |
| [`statements.ts`](./statements.ts) | The statements of the `recording_fragments` store. |

## Main exports and entry points

Other units import this folder through `index.ts`.

- Exported from `index.ts`: `RecordingFragmentStoreError`, `FragmentInsertOutcome`, `invalidMember`, `createRecordingFragmentStore`, `fragmentRowOf`, `createFragmentRecorder`, `AUDIO_FRAGMENT_TRACK_IDS`, `CHAIN_GENESIS_SHA256`, `FRAGMENT_TRACK_IDS`, `VIDEO_TRACK_IDS`, `AudioFragmentTrackId`, `FragmentTrackId`, `Queryable`, `VideoTrackId`.
- Types exported from `index.ts`: `RecordingFragment`, `RecordingFragmentStoreErrorCode`, `FragmentInsertOutcome`, `RecordingFragmentStore`, `AnyRecordingFragment`, `CheckpointFacts`, `FragmentRecorderReport`, `FragmentRecordEvent`, `FragmentRecorderOptions`, `FragmentRecorderStatus`, `FragmentRecorder`.

## Dependencies

Module-level imports of the production files (tests excluded).

Inbound (who imports this folder):

- [`capture-session`](../../capture-session/README.md): `index.ts`
- [`sealing-host`](../../sealing-host/README.md): `index.ts`
- [`sealing-host/demo-seed`](../../sealing-host/demo-seed/README.md): `index.ts`
- [`sealing/pipeline`](../../sealing/pipeline/README.md): `index.ts`

Outbound: imports nothing else inside `src`.

- npm packages: `a
 * gap`, `pg`

## Tests

| Location | Test files | `*.db.test.ts` |
|---|---|---|
| [`__tests__/`](./__tests__/) | 2 | 1 |

1 test file(s) end in `.db.test.ts`: they need a PostgreSQL test database and run only in a DB window, not in the plain unit run.

Tests elsewhere that import it (1 folders): `src/sealing/__tests__`.

## Related decisions

No entry of the 2026-11-05 audit decisions log names this folder or its files. Code comments cite earlier design decisions; see the file headers.
