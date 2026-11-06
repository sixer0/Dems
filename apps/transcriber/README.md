# DEMS transcriber (`@dems/transcriber`)

Back to the [repository README](../../README.md).

## What it is

The transcriber is the speech-to-text (STT) pipeline of the Core. It is a **library**, not a server: it opens no port, knows no database and no HTTP route. The Core server imports it (`apps/core-server/src/transcription/`) and runs it on the MIC-01 audio of a recording, which feeds the transcription (decision D5 pairs: only MIC-01 feeds the tap).

What it does, in order (`src/index.ts`):

1. Audio intake, then voice activity detection with Silero VAD to cut the audio into chunks.
2. STT per chunk through one adapter seam with two backends (`src/adapter.ts`), chosen by configuration, never automatically:
   - `cpu-local`: the `whisper-cli` engine built with the GPU backends off, started through `nice` at a lowered priority, so capture always outranks STT (`src/cpu-priority.ts`);
   - `omlx-server`: an oMLX server reached over loopback HTTP only (`src/backends/omlx-http.ts`, the only module that calls `fetch`).
3. The phantom-tail clamp, media time, chunk checkpoints with resume, and the mirror of the Core's `transcript_chunks`.
4. A diarization post-pass for two speakers (labelled or unavailable).
5. The canonical `dems.transcript/1` document with its hash and renderings, written once by the assembly step.

The language is fixed to Indonesian (`TRANSCRIBER_LANGUAGE = 'id'`). It uses the shared contract `packages/shared` (`@dems/shared`) for the loopback endpoint and model id rules and the log-blanking rules.

## Folder layout

| Path | What it holds |
|---|---|
| `src/adapter.ts`, `src/types.ts` | The `TranscriberAdapter` seam and its contract |
| `src/config.ts` | Checks the STT selection (from the Core's `stt_config` table) and the host runtime, fail-closed |
| `src/backends/` | `cpu-local.ts` (whisper-cli), `omlx-server.ts` and `omlx-http.ts` (oMLX over loopback) |
| `src/pipeline/` | Audio source, Silero VAD, chunker, clamp, media time, checkpoint, runner, mirror, diarization, document, assembly |
| `src/cpu-priority.ts`, `src/host/` | The CPU priority rule and the physical core count of the host |
| `src/key-loader.ts` | The single loader of the oMLX credential (by reference, never a key in configuration) |
| `src/probe.ts` | The connection test of the configured backend |
| `src/log.ts` | Persistent structured log, one JSON object per line, blanked before writing and rotated by size |
| `src/wav.ts` | Minimal WAV handling |
| `src/fixtures/` | Development-only test audio provider |
| `src/__tests__/` | Unit tests |
| `test/real/` | Runs against the real engines; not part of `npm test` |
| `native/` | `speaker-embed.c`, the speaker embedding caller of the diarization (see `native/README.md` for its build) |

## Requirements and setup

Node 26.8.2 and npm 11.19.1. From the repository root: `npm install`. Unit tests need no engine.

For real runs the engines and models are not in git. In development they live under the git-ignored `.cache/stt/` at the repository root (the whisper.cpp build with `whisper-cli` and the VAD program, the models, sherpa-onnx for the speaker embedding; see `native/README.md` and `THIRD_PARTY_NOTICES.md`).

## Run, test, typecheck

| What | Command (repository root) |
|---|---|
| Unit tests | `npm test -w @dems/transcriber` (Vitest) |
| Typecheck | `npm run typecheck -w @dems/transcriber` (`tsc --noEmit`) |
| Lint | `npm run lint -w @dems/transcriber` (oxlint) |
| Real engine runs (one at a time, heavy) | `npm run test:real:cpu-local -w @dems/transcriber`, `test:real:omlx-server`, `test:real:shape`, `test:real:omlx-log-excerpt`, `test:real:row77:cpu-local`, `test:real:row77:omlx-server`, `test:real:row77:df1`, `test:real:row78:labels` (config `vitest.real.config.ts`) |

There is no run command: the Core starts the pipeline.

## Configuration

The transcriber reads **no environment variables**. Its configuration has two sources, both handed in by the Core:

- **STT selection**, edited by operators through the Core (table `stt_config`, operations 90 to 92): backend (`cpu-local` or `omlx-server`), loopback endpoint (oMLX only), model, and a credential **reference** (never the key itself).
- **Host runtime**, which no operator edits: where the engine executables and model files are, thread counts. The Core reads it from the optional file `<data directory>/transcriber/host.json` (`apps/core-server/src/transcription/host.ts`). Without it, `cpu-local` is refused as `CPU_LOCAL_RUNTIME_MISSING`.

No model name, model path, endpoint or port is defaulted in this workspace's source.

## Production notes

The transcriber runs inside the `dems-core` process (systemd unit `dems-core`, see [`apps/core-server/README.md`](../core-server/README.md) and [`deploy/bench-config/README.md`](../../deploy/bench-config/README.md)). It has no unit and no port of its own. CPU STT is heavy: capture keeps priority, and the real engine runs on a development host take the shared heavy-host lock.
