---
task_id: 2026-10-07_dems_real_capture_sealing
row: 115
milestone: M6
date: 2026-10-09
agent: coder-execution
status: needs-review
tier: 3
---

# Row 115 — STT configuration at runtime (R-8, M6)

Status **needs-review**: four of the five parts are built and proven; the session snapshot is
built and proven but held in **process memory**, because the session record has no column for it
(section 4, request filed). Two seams wait for `apps/transcriber` (not this row's files).

## 1. What was built

New closed unit `apps/core-server/src/transcription/` (one `CLOSED_UNITS` entry,
`test/static/imports.test.ts:68`). No frozen file was edited: `modules/stt-config` mounts it
(`modules/stt-config/index.ts:251`), as row 84 did with its hook.

| Part | Where | Real / stand-in |
|---|---|---|
| Host statement `<dataDir>/transcriber/host.json` (engine and model paths; `priority: 'required'` stated here, no `nicePath` member) | `transcription/host.ts:108`, scratch + tap path `:83`, `:89` | real |
| The one caller of `dems_stt_credential_reveal()` | `transcription/credential-reveal.ts:19`, `:49`; pin `modules/stt-config/__tests__/static.test.ts:36` | real |
| Op-92 probe in production wiring, on `createConnectionProbe` of `@dems/transcriber` | `transcription/probe.ts:148`; default probe of the module `stt-config/index.ts:254`, `:334` (`provideProbe` still wins) | real for `REFERENCE` / no credential / `cpu-local`; **`ENCRYPTED` = seam** (section 4) |
| CPU-only build check (13 GPU markers searched in the executable's bytes; never executed) | `probe.ts:59`, `:82` | real; reads the executable only (a build that loads backends from shared libraries is not seen through — the product engine is one static file) |
| Session snapshot, write-once, no credential and no reference in it | `transcription/snapshot.ts:38`, `:67`; `index.ts` `snapshotSttConfigForSession` | logic real; **store = memory stand-in** |
| Session composition from the SNAPSHOT: `captureWorkerPid` (supervisor status) to adapter and VAD, sticky `tapLost` from telemetry, tap under the session scratch, `shouldPause` (+ `hold`), `transcript_chunks` store as `mirror`, one queue | `transcription/session.ts:169` | real; **engine guard = seam** (section 4) |
| Torn / foreign checkpoint rule (N-17) | `session.ts:158` (`moveCheckpointAside`), rule in the file head | real |
| CS-22 boot step `transcriber.config` | `transcription/boot.ts:80`; mounted `index.ts` (end of `mountTranscription`) | real |
| Service state source for `modules/system` | `index.ts:176` (`transcriptionServiceSource`) | real; **not read by the system module yet** (request) |
| Transcriber log -> Core log + persistent error log (blanked, codes only) | `transcription/log.ts:33` | real |
| Op-91 endpoint rule (no `?`, `#`, backslash, white space, control character) | `packages/shared/src/api/transcription.ts:150`, `:167`, `:379` (shared applier: server and simulator) | real |

Rules decided here (also D-115-n in section 6):
- **Mounted or not.** An app whose data directory does not exist (every in-process test app) has
  no transcriber: boot step inert, state `NOT_CONFIGURED`, op 92 keeps answering 503. So no
  existing test changed its answer.
- **Boot (CS-22).** Simulated capture: inert, nothing read. Real capture: refuses for an unusable
  host file, an unseeded `stt_config`, an enabled selection that cannot be resolved on this host,
  missing nice / engine / model (`cpu-local`), an engine that is not the CPU-only build. Does not
  refuse for: STT disabled; `omlx-server` not answering (never started by DEMS; a warning at
  session start instead); a stated VAD whose files are absent (warning; fixed windows later).
- **Session start.** `snapshotSttConfigForSession` returns at once; the backend is asked once in
  the background (3 s bound); no answer = one warning (log, persistent error log, listener). It
  never throws.
- **Disabled.** Nothing is built: no adapter, no VAD, no runner, no directory, no tap path
  (`tapPathFor` answers null, so the plan carries no tap).
- **Torn checkpoint.** Moved aside as `transcript-checkpoint.json.invalid-<n>` (never deleted),
  logged and persisted with the reason, runner built again; it takes row numbers above the
  session's existing rows (the pipeline's own N-6 rule) and plans/decodes the audio again. The
  committed rows are untouched; **no text is taken from a row into the new checkpoint** (a row
  holds rounded milliseconds, not the chunk's sample range). At most 3 per session, then
  `UNAVAILABLE` (`CHECKPOINT_RECOVERY_EXHAUSTED`).

## 2. Commands and results (final state of the tree)

```
npm run -s typecheck -w @dems/core-server      # my files clean; 2 errors of another row's in-flight edit:
                                               # src/plugins/permission-guard/decision.ts:223, test/acceptance/rbac-matrix.support.ts:623
npm run -s lint -w @dems/core-server           # exit 0        npm run -s lint -w @dems/shared   # exit 0
npx vitest run --root apps/core-server --project unit src/transcription src/modules/stt-config \
  src/modules/system src/sealing/__tests__/stt-states.test.ts test/static src/credential-store/__tests__/static.test.ts
                                               # 415 passed, 2 failed: both test/static/credentials.test.ts,
                                               # both naming src/capture/adapters/local/__tests__/mic-helper.generated.test.ts:176 (not this row)
npx vitest run --root packages/shared test/api-stt-config.test.ts            # 44 passed
npx vitest run --root apps/transcriber src/__tests__/backends.test.ts src/__tests__/static.test.ts   # 201 passed
/usr/bin/lockf -k .locks/db-migrate.lock npm run -s test:db -w @dems/core-server -- src/modules/stt-config
                                               # 3 files, 23 passed; 0 databases remain
```

Sandbox off for the runs that bind a loopback port or reach PostgreSQL. Own test files:
`transcription/__tests__/{probe,session,boot}.test.ts` (14 + 14 + 11) and
`modules/stt-config/__tests__/op92-booted.db.test.ts` (9; run 3 times).

| Check | Result |
|---|---|
| `M6-STTCFG-API`, op-92 200 half | PASS on a booted server listening on 127.0.0.1 at an ephemeral port, real HTTP: `omlx-server` vs loopback fake 2 runs `reachable: true`; nothing listening 2 runs `200 reachable: false UNREACHABLE`; `cpu-local` 2 runs `OK` |
| Probe rules (N-14) | `localhost` endpoint arrives with `Host: 127.0.0.1:<port>`; a 302 is not followed and the port it names receives 0 requests; ONE `GET /v1/models` per test; `ENCRYPTED` = 0 requests |
| `cpu-local`, real files of this host (`.cache/stt/…`) | 2 runs `OK`, `cpuOnly: true`, no engine started |
| `M6-STTCFG-NEXT` (fake clock) | PASS in the unit suite (2 chunks of the open session went to the endpoint of its start, 0 to the new one; next session uses the new row) and against PostgreSQL through real op 91 |
| Disabled = no work | PASS: no request, no reveal, no directory, no tap path |
| Enabled, unreachable at start | PASS: the snapshot call returns while the request is still pending; one warning afterwards; also `TIMEOUT` |
| Op 91 = 422 for `?`, `#`, backslash, white space, control characters | PASS on the module app, on the booted server and in the simulator; OpenAPI regenerated under the npm lock: one changed line (a description); 92 / 35 / 57, version 0.3.0 unchanged |
| Boot refuses an unresolvable configuration | PASS, 11 refusals with code + reason, each beside a passing control |
| Canary (the key of the settings file), booted server | 0 hits in answers, log, persistent error log, `audit_log`, `events`, `stt_config`; the fake server received it 3 times (control) |
| Mutations | 12 of 12 red (write-once, snapshot ignored, tap phase, checkpoint not moved, start waits, engine files, CPU-only, ENCRYPTED falls through, disabled builds, laxer endpoint rule, boot not inert) |

## 3. Finding fixed in passing (file owned by this row)

**F-115-1** `modules/stt-config/change.ts:163`: the guard "the envelope still holds the plaintext"
searched for the plaintext bytes in the ciphertext whatever its length. An 80-byte envelope holds
a given single byte about 27 % of the time, so a one-character secret was answered `500` that
often (`credential-store.test.ts` "a one-character secret…" failed 2 of 4 runs here). Now the
search is made from 8 bytes on (`change.ts:170`); 6 of 6 runs green; a deterministic test was
added (`routes.test.ts`, "an envelope that happens to hold the byte…"). **Needs a ruling:** for a
secret shorter than 8 bytes a sealer that does not seal is no longer caught by this guard (the
envelope form is still checked).

## 4. Not done, said plainly

| Item | Why | What exists instead |
|---|---|---|
| **Snapshot in the session record** | No column: `active_session.transcript_status` is the engine's replicated strict progress object, `capture_config` the selector, `audio_source` the mic pair (dbc-3 §B.10, §B.13 names no column). No migration written, as instructed | Memory store behind the port `SttSnapshotStore`. A Core restart inside an open session = no snapshot = **no transcription for that session** (fail closed; never the current configuration). Request to rows 129/130 filed |
| **`ENCRYPTED` credential opened** | The brief says the key-loader takes an opener; it does not (`apps/transcriber/src/key-loader.ts` reads the oMLX reference only; no entry on `ProbeDeps` / adapter deps) | `CREDENTIAL_UNAVAILABLE`, no connection, envelope never opened. Request filed; the opener is reachable from `modules/stt-config/index.ts` |
| **Engine guard (N-2) in production wiring** | `createEngineGuard` is not exported by `@dems/transcriber` | Injected seam `SessionCompositionDeps.engineGuard`; the mount hands in none |
| **Service state shown by `modules/system`** | Its source is a plugin option set in `app.ts` (frozen) | `transcriptionServiceSource(app)`; one-line request to row 62 |
| Speaker embedder / assembly / `FINALIZE_TRANSCRIPT` | Rows 79 / 82 | `manifestSnapshot(sessionId)` and `scratchDirFor(sessionId)` are offered |
| The one real-oMLX probe | oMLX is not started by this row | Gate step below |

## 5. To wire when rows land

- **Row 71 (session start/stop):** at start `await transcriptionControl(app).snapshotSttConfigForSession(sessionId)` (never throws, never waits for a backend); surface `onSessionWarning` as the capture warning of its choice; `openSession(sessionId)` then `step({ final: false })` while recording, `hold(true|false)` under CPU pressure, `step({ final: true })` until `complete`, then `close()`.
- **Row 66 (plan builder):** `pcmTapPath = await tapPathFor(sessionId)` (null when the snapshot disables STT).
- **Rows 79 / 82:** `sttSnapshot = await manifestSnapshot(sessionId)`; files under `scratchDirFor(sessionId)`.
- **Rows 129/130:** the snapshot column -> replace `createMemorySnapshotStore`.
- **Row 79 (transcriber):** opener entry + `createEngineGuard` export -> two lines in `transcription/index.ts`; then `retainOnly('STT_API_KEY', [ref])`.
- **Row 62:** `transcriptionServiceSource(app)` as the default source. **Row 131:** `@dems/transcriber` into `dependencies`. **Row 117 (optional):** `isSttConfigEndpoint` in the menu's validation.
- `SessionCompositionDeps` accepts `log` as an alias of `transcriberLog` (row 116's test was written against both names during this wave); remove the alias once row 116 has landed.

## 6. Decisions taken (for the decision log)

| ID | Decision |
|---|---|
| D-115-1 | Host values come from `<dataDir>/transcriber/host.json`, not from new keys in the frozen `config.ts`. Alternative for the controller: three environment keys under a P25 waiver |
| D-115-2 | No data directory = no transcriber (the rule of the credential store); `provideProbe` kept and wins |
| D-115-3 | Torn checkpoint: move aside, re-plan under new row numbers, never rebuild from rows; limit 3 |
| D-115-4 | Boot refuses only in real capture mode and only for what is local; an unreachable server never stops a boot |
| D-115-5 | The credential reference is not in the snapshot; it is read when the session's adapter is built |
| D-115-6 | `isSttLoopbackEndpoint` keeps its meaning (the table CHECK; the transcriber's tests tell its refusals apart by reason); the stricter rule is the new `isSttConfigEndpoint`, used by the shared applier. C1 control characters are refused too (stricter than the transcriber, never laxer) |
| D-115-7 | `tapLost` latches only on a frame of this session while the supervisor's phase is `RECORDING` (a tap that ends at the stop is not a lost tap) |
| D-115-8 | New `detailCode` values of op 92: `CREDENTIAL_UNAVAILABLE`, `HOST_CONFIG_INVALID`, `CONFIG_INVALID`, `ENGINE_NOT_CPU_ONLY` (the set is open by contract) |
| D-115-9 | In this unit the transcriber's log is named `transcriberLog`, apart from the server logger: its entry form (`error`, `context.reason`) is the library's and the adapter reduces it to codes; the static rule on the server's log calls stays green without an exception entry |

## 7. Left for the gate session (one scripted flow)

1. Real oMLX, inside the sanctioned start/stop window only: stored config `omlx-server` +
   reference -> op 92 once -> `200 reachable: true, modelAvailable: true`; stop the server -> op 92
   -> `200 reachable: false`. Check that the oMLX log holds one `GET /v1/models` per test.
2. A lane Core in real capture mode with a host file pointing at `.cache/stt/…`: boot log shows
   `boot step passed` for `transcriber.config` and `TRANSCRIBER_RESOLVED`; rename the model file
   -> the Core refuses to start with `TRANSCRIBER_ENGINE_FILES_MISSING`.
3. `M6-STTCFG-OFF` / `-UNREACH` (2 + 1) once rows 71 and 79 are wired; web / tablet / phone
   checks of rows 117 / 118 are theirs.
