---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
row: 76 (phase C, milestone M6, wave M6-W1, class B; blueprint rev 2.1)
date: 2026-10-09
agent: coder-execution (DRIVER of the row-76 pair; the navigator reviews and re-runs)
source_plan: identification/02_structured.md rev 2.1 row 76 (:239); masterplan/07_transcript_spec.md (tx) §B.1-§B.7, §C; masterplan/01_specs.md §E.3; masterplan/09_security_design_review.md SEC35-14; masterplan/10_test_strategy.md M6-AD-1 (:215), M6-CP-1 (:216), static rule (:412)
narrative_tier: 3
status: complete — five decisions for the controller to confirm (section 9) and four items handed to later rows (section 10)
closes: NM-06 (adapter part), SEC35-14 (single key-loader + static rule), W1-C3, W1-C12; DOC-05 first part (engines used by this row); the transcriber side of CS-22 (presence check) and of op 92 (probe)
depends_on: rows 57, 107-110, 113
verification: M6-AD-1 PASS (10 tests), M6-CP-1 PASS (16 tests), static rule PASS (33 tests) and shown red; cpu-local REAL run reproduces the row-109 bytes; omlx-server REAL run reproduces the row-12 bytes; oMLX started 10:54:17 and stopped 10:54:42 (+07:00), port 8000 free before and after
---

# Row 76 — Transcriber app, `TranscriberAdapter`, two backends, fixtures (M6-W1)

## 1. What exists now

A new workspace `apps/transcriber` (`@dems/transcriber`). Before this row there was no transcriber code at all (AU-2 §4.4: 0 repository hits). Every "done" below has a file and a line.

| Piece | File:line | What it does |
|---|---|---|
| Contract (tx §B.1, §B.5) | `apps/transcriber/src/types.ts:1-160` | `TranscriberChunk`, `TranscribeOptions`, `TranscribeResult`, `TranscriptSegment` as strict zod schemas; `documentShape` (`:80`); `TranscriberError` with typed codes |
| `TranscriberAdapter` (tx §B.4) | `apps/transcriber/src/adapter.ts:58` | builds ONE backend from a resolved configuration; frozen; no setter; no fallback to the other backend; every call through one `SerialQueue` |
| Configuration (tx §B.4, §B.7) | `apps/transcriber/src/config.ts:111` | `resolveTranscriberConfig(selection, runtime)`: `selection` = the `stt_config` members (`backend`, `endpoint`, `model`, `language`, `credentialRef`); `runtime` = host facts (engine path, model directory, physical cores). Loopback-only endpoint (`:91`), Indonesian only, model = a plain file name inside the model directory |
| Backend `cpu-local` (tx §B.3) | `apps/transcriber/src/backends/cpu-local.ts:137` | starts `whisper-cli`; `-ng` is a constant (`:44`) placed in every command (`:67-74`); files checked before a start (`:77`); lowered priority (`:119`); typed failures; no made-up text |
| Backend `omlx-server` (tx §B.2) | `apps/transcriber/src/backends/omlx-server.ts:72` | `POST /v1/audio/transcriptions` multipart; QA members optional; the `duration` member is never read |
| oMLX HTTP client | `apps/transcriber/src/backends/omlx-http.ts:48` | the only `fetch` call and the only place the `Authorization` header is built; re-checks loopback; `redirect: 'error'` (`:61`) |
| Single key-loader (SEC35-14) | `apps/transcriber/src/key-loader.ts:70` | the only module that names or reads the oMLX settings file; opaque `Credential`; one function turns it into text (`:104`) |
| Log + blanking rule (E-31) | `apps/transcriber/src/log.ts:51`, `:102` | structured JSON lines to a rotated file; blanking by position (`Bearer`, credential-named members) and by value |
| CPU priority rule (tx §C) | `apps/transcriber/src/cpu-priority.ts:47`, `:77` | `threads * processors <= physical cores` (refused, not shrunk); default leaves 2 cores to capture; `SerialQueue`; `STT_NICE = 10` |
| Physical cores | `apps/transcriber/src/host/physical-cores.ts:36` | `/proc/cpuinfo` (Linux) or `sysctl hw.physicalcpu` (macOS); fallback = half of the logical count |
| Connection probe (op 92) | `apps/transcriber/src/probe.ts:63` | a function of the form of the Core's `SttConnectionProbe` (`apps/core-server/src/modules/stt-config/seams.ts:56`): one `GET /v1/models`, or a presence check; no audio |
| `TtsFixtureProvider` (tx §B.6) | `apps/transcriber/src/fixtures/tts-fixture-provider.ts:107`, `:185` | `provide()` proves the sealed bytes (size + SHA-256) before handing them out; `generate()` realises the row-12 recipe into a NEW file; a synthesiser for the installed speech model |
| Static rule | `apps/transcriber/src/__tests__/static-rules.ts:82`, `static.test.ts` | 17 pattern rules + 4 required-text rules, each shown red on a planted line |

Workspace files: `apps/transcriber/package.json`, `tsconfig.json`, `vitest.config.ts` (automated suite, 2 workers), `vitest.real.config.ts` (real-engine runs, 1 worker, never part of `npm test`).

## 2. Design rules that hold (each has a test)

1. **Selection is configuration, never automatic.** The adapter is frozen and has four members (`backend`, `model`, `queue`, `transcribe`). When `omlx-server` fails, `cpu-local` is not tried, and the other way round (`adapter-contract.test.ts`, group "selection is configuration").
2. **Identical document shape.** Both backends return a value that parses under one strict schema; `documentShape` is equal for both. QA members are carried only where the engine reported them and are never zero-filled.
3. **`-ng` cannot be left out.** There is no option for it. The stand-in engine of the unit suite refuses a command without `-ng` (exit 9), so a passing run proves the flag reached the process.
4. **Fail closed.** Wrong model path, missing engine, missing audio, non-zero exit, missing or malformed output, another language, text without segments: each is a typed error and no text is returned.
5. **The key.** Read by one module, held in memory, sent only as a header to a loopback address, never in a result, a record, an error, a log line, an argument list or an environment variable. A non-loopback endpoint is refused twice (configuration and HTTP client).
6. **No figure (D230).** Nothing measures or stores a duration or a speed; the static rule forbids timing calls in this workspace. The engine time bound (1,800,000 ms, the rows 109/110 bound) only stops a hung engine.

## 3. Verification — M6-AD-1 (test strategy `:215`)

Definition: "one interface, two backends (`omlx-server`, `cpu-local`) return the identical document shape; `TtsFixtureProvider` produces the fixture; config-driven selection, never automatic mid-session" — transcriber contract unit, 1 run.

Command (from the repository root):

```
$ npm run test -w @dems/transcriber
 Test Files  6 passed (6)
      Tests  126 passed (126)
```

The 10 tests named `M6-AD-1` (`apps/transcriber/src/__tests__/adapter-contract.test.ts`), all passing (`-- --reporter=verbose`):

```
✓ M6-AD-1: one interface, two backends, the identical document shape > both backends answer the same chunk with a result of the same shape
✓ ... > negative control: a result with another top-level member, or a segment without `end`, has another shape and does not parse
✓ ... > QA members are carried where the engine reported them and omitted elsewhere, never zero-filled
✓ ... > the unreliable `duration` member of the server answer is never read: any value gives the same result
✓ M6-AD-1: selection is configuration, never automatic mid-session > the backend is the configured one and is fixed for the lifetime of the adapter
✓ ... > a failing omlx-server is a failure: cpu-local is never tried in its place, though it is installed and working
✓ ... > a failing cpu-local is a failure: the server is never called in its place
✓ ... > a backend that is not one of the two, and another language, are refused when the configuration is resolved
✓ M6-AD-1: TtsFixtureProvider produces the fixture > the seal is the row-12 fixture: 13 scripted sentences, two voices, Indonesian
✓ ... > negative control: a file that is not the sealed bytes is refused, never handed to a check
```

In the automated suite the `cpu-local` backend starts a real stand-in process and the `omlx-server` backend talks to an in-process answerer at the `fetch` seam: no engine, no model, no port. The same contract on the REAL engines is section 5.

## 4. Verification — M6-CP-1 (test strategy `:216`)

Definition: "capture outranks STT: bounded thread product <= physical cores asserted; oMLX calls serialised (never beside a large VLM session)" — config assertion unit + runbook check, 1 run.

Same command as section 3. The 16 tests named `M6-CP-1` (`apps/transcriber/src/__tests__/cpu-priority.test.ts`) pass. What they assert:

| Clause | Assertion | Negative control |
|---|---|---|
| thread product <= physical cores | every plan for 1..64 cores x 1..66 threads x 1..4 processors: accepted plans hold the bound | every over-bound plan is refused with `THREAD_PRODUCT_EXCEEDS_CORES`; both sides visited more than 1,000 times |
| exact edge | 10 x 1 and 5 x 2 on 10 cores accepted | 11 x 1 and 6 x 2 refused |
| bound reaches the command | `-t 8`, and `-t 4 -p 2`, in the built argument list | an over-bound configuration is refused before any engine exists; a plan tampered with after acceptance is refused by the engine module, nothing is started |
| capture keeps cores | default plan = physical cores minus 2, one processor | — |
| lower priority | the stand-in process observes niceness 10 for itself | when the host forbids it, a `warn` line is logged (never silent) |
| calls serialised | 8 transcriptions fired at once reach the server one at a time; two adapters sharing a queue never overlap; 4 `cpu-local` chunks run in turn | the same 8 requests sent past the adapter overlap (8 in flight) |

Runbook half of the check ("never beside a large VLM session"), as done in this row: `lsof` on port 8000 and `pgrep` for `omlx serve` and `whisper-cli` before the server was started (section 6); the CPU run finished before the server was started; the real oMLX run reported `maxCallsInFlight: 1`.

Note on the sandbox: inside the Claude Code Bash sandbox `sysctl` and `setpriority` on a child are refused (EPERM). The suite passes in both conditions (126/126 inside and outside); outside the sandbox the niceness branch runs (`nice: 10` in section 5.1).

## 5. Verification — both backends exercised for real

### 5.1 `cpu-local`: `whisper-cli -ng` on the sealed fixture reproduces row 109

Command (outside the sandbox, alone; `uptime` before: load averages 8.96 7.98 7.62):

```
$ npm run test:real:cpu-local -w @dems/transcriber
 Test Files  1 passed (1)
      Tests  4 passed (4)
```

The command the adapter started, as recorded by the run (`.cache/stt/checks/row76/cpu-local.evidence.json`, git-ignored):

```
/Users/gsp-budi/Documents/DEMS/.cache/stt/whisper.cpp/build/bin/whisper-cli
  -m /Users/gsp-budi/Documents/DEMS/.cache/stt/models/ggml-large-v3-turbo.bin
  -ng -t 8 -l id -oj
  -of /Users/gsp-budi/Documents/DEMS/.cache/stt/checks/row76/work/stt-d8584fee-8fa8-46b2-960b-23657d150058
  -f /Users/gsp-budi/Documents/DEMS/.cache/spikes/stt-check/fixture-two-speaker-id.wav
```

| Fact | This run | Row 109/110 (`gateway_check/26_m1_cpu_stt_addendum.md:13`, `:157`) |
|---|---|---|
| raw engine output SHA-256 | `6039a9447ed165b94d01cfff94ae7c4d17e034f2366e4af4c0c0d4e7cab94439` | `6039a9447ed165b94d01cfff94ae7c4d17e034f2366e4af4c0c0d4e7cab94439` |
| raw bytes | 3717 | 3,717 |
| segments | 14 | 14 |
| language | `id` | `id` |
| exit code | 0 | 0 |
| fixture SHA-256 (checked by `TtsFixtureProvider.provide()` first) | `6743181a7d976ca24c03ad8e427d6d7093fbb0b9f72257e6e2f91dcfc0f4fe71` | same |
| physical cores / source | 10 / `sysctl` | 10 |
| niceness given to the engine | 10 | — |

Byte-identical to row 109. Engine artefacts unchanged after the run: `whisper-cli` `2429de42…86a3db`, model `1fc70f77…e8e2bc69` (the row 107/108 values).

Negative controls (same test file):

| Control | Result |
|---|---|
| wrong model name (`ggml-model-that-is-not-there.bin`) | `MODEL_NOT_FOUND`; 0 engine runs; one `error` log record |
| corrupted fixture (the sealed file cut to 12 s, header consistent) | `TtsFixtureProvider.provide()` refuses it: `FIXTURE_CORRUPT` / `FIXTURE_HASH_MISMATCH` |
| the engine on that cut file | raw SHA-256 `5d09469d7e4064b8248c304c5e5c4c122b4892f1cad2a21b759f55cc060b5e41` (differs), 3 segments (fewer than 14) |

### 5.2 `omlx-server`: the real server of this Mac, through the adapter and the single key-loader

Command (outside the sandbox, with the server up — section 6):

```
$ npm run test:real:omlx-server -w @dems/transcriber
 Test Files  1 passed (1)
      Tests  6 passed (6)
```

| Check | Result (`.cache/stt/checks/row76/omlx-server.*.json`) |
|---|---|
| probe (one `GET /v1/models`, no audio) | `{"reachable":true,"modelAvailable":true,"detailCode":"OK"}` |
| transcription of the sealed fixture | HTTP 200, 17 segments, language `id` |
| raw answer SHA-256 / bytes | `08900b7c5eb97d8364aa3df55bb3036a4c14f7d9924ec17023f0eb69f3da6998` / 6801 |
| row-12 answer (`.cache/spikes/stt-check/runs/whisper-run1.json`) | `shasum -a 256` → `08900b7c5eb97d8364aa3df55bb3036a4c14f7d9924ec17023f0eb69f3da6998`, 6801 bytes: **byte-identical** |
| every segment `start`/`end`/trimmed text and `avgLogprob` | equal to the row-12 file |
| key in any output (result, run record, configuration, log, adapter) | absent — proven by scrubbing with the loaded credential, the key never becomes text in the test |
| calls in flight | 1 |
| negative control: no credential | `CREDENTIAL_REJECTED` (HTTP 401) |
| negative control: a model that is not served | `MODEL_NOT_AVAILABLE` (HTTP 404), no text |
| negative control: endpoint `http://192.168.1.10:8000` | `ENDPOINT_NOT_LOOPBACK`, refused before any request |
| fixture synthesiser, one scripted turn (`B1`) with the installed speech model | WAV, mono, 16 bit, 24000 Hz, 151,724 bytes |

The server log of this session (scrubbed excerpt kept at `.cache/stt/checks/row76/omlx-serve.row76.excerpt.log`; secret-pattern count 0) shows what the audits found before: `MLX executor thread initialized: generation_stream = ThreadLocalStream(Device(gpu, 0), 4)`. This backend runs on the Apple GPU and is a development tool only (D7; AU2-11). It gives no evidence for the CPU clause; section 5.1 does.

### 5.3 Both real results: the identical document shape

```
$ npm run test:real:shape -w @dems/transcriber
 Test Files  1 passed (1)
      Tests  1 passed (1)
```

`.cache/stt/checks/row76/shape.evidence.json`:

```
{"shape":{"top":["engine:string","language:string","model:string","segments:array","text:string"],"segment":["end","id","start","text"]},
 "identical":true,"cpuLocalSegments":14,"omlxServerSegments":17,
 "cpuLocalSegmentKeys":["end","id","start","text"],
 "omlxServerSegmentKeys":["avgLogprob","compressionRatio","end","id","noSpeechProb","seek","start","temperature","text","tokens"]}
```

The shape is identical; the content differs (14 against 17 segments: two different engines), which the contract allows.

## 6. oMLX — start and stop log (D7(d); shared host service)

Exactly the procedure of `implementation/50_m2_lane_v2_completion.md` §4.1 and `verification/21_audit_spikes_stt.md` §4.2. All times 2026-10-09, +07:00.

| Step | Time | Command and evidence |
|---|---|---|
| Pre-check | 10:54:12 | `lsof -nP -iTCP:8000 -sTCP:LISTEN` → no listener; `pgrep -fl "omlx serve"` → none; `pgrep -fl whisper-cli` → none (the CPU run had ended); `brew list --versions omlx` → `omlx 0.6.4` |
| Log backed up first | 10:54:13 | secret-pattern count in the current log: 0; `cp -p ~/.omlx/logs/omlx-serve.log .cache/stt/checks/row76/omlx-serve.log.bak-20261009T105413` (6,136 B; the start script truncates the log, AU2-10) |
| Start | 10:54:17 | `~/Documents/omlx-script/start.sh` → `PID 88434`, `oMLX siap: http://127.0.0.1:8000`, exit 0. The sanctioned script is the only thing that bound port 8000 |
| Calls, serialised | 10:54:24 – 10:54:33 | one vitest file, one worker, one queue: 1 model list, 1 transcription, 2 refused transcriptions (the negative controls), 1 speech synthesis |
| Stop | 10:54:42 | `~/Documents/omlx-script/stop.sh` → `Menghentikan oMLX (PID 88434)... oMLX berhenti.`, exit 0 |
| Down confirmed | 10:54:45 | `lsof` → no listener; `pgrep` → none; `status.sh` → `STATUS : DOWN (http://127.0.0.1:8000)`; `brew list --versions omlx` → `omlx 0.6.4` (unchanged) |

Up for 25 seconds. Not upgraded, not reinstalled, not reconfigured by this row. The key was never printed: it was loaded only by `apps/transcriber/src/key-loader.ts` inside the test process; every command output was filtered for key patterns before display; `grep -rlE 'Bearer|sk-[A-Za-z0-9]{6}' .cache/stt/checks/row76` → no file.

One observation, stated so nobody is surprised: the modification time of `~/.omlx/settings.json` moved to the start time (10:54:18) while its size (3,268 B) and its SHA-256 are unchanged. The server rewrites its own settings file when it starts (its previous modification time, about 01:55, is the time of the previous server start by another row: the backed-up server log is dated 01:56). This row wrote nothing there. `~/Documents/omlx-script/config.env` is unchanged in time and size.

## 7. Static rule — passes on the tree, red on a planted violation

Rule file `apps/transcriber/src/__tests__/static-rules.ts`; test `apps/transcriber/src/__tests__/static.test.ts` (the path the test strategy names, `:412`). 33 tests pass. Coverage of the strategy's sentence:

| Strategy clause | Rule(s) |
|---|---|
| never reads `~/.omlx/settings.json` (outside the single key-loader) | `KEY_FILE_ONLY_IN_KEY_LOADER` (holds in test files too), `NO_ENVIRONMENT_READ` |
| never prints the API key / never logs a header | `CREDENTIAL_TEXT_ONLY_IN_HTTP_CLIENT`, `AUTHORIZATION_HEADER_ONLY_IN_HTTP_CLIENT`, `NO_CONSOLE`, `NO_STDOUT_WRITE` |
| model path from config only | `NO_MODEL_OR_PATH_LITERAL`, `NO_URL_LITERAL` |
| no runtime downloads | `NO_DOWNLOAD_OR_INSTALL`, `FETCH_ONLY_IN_HTTP_CLIENT` |
| never binds port 8000 | `NEVER_LISTENS` (stricter than the strategy text: the workspace binds no port at all, see decision D-76-4), `NO_PORT_8000_LITERAL` |
| added by this row | `CHILD_PROCESS_ONLY_IN_ENGINE_MODULES`, `NO_SHELL`, `NO_OTYPE_FLAG` (W1-C3), `NO_GPU_ENABLING_FLAG`, `NO_TIMING_MEASUREMENT` (D230), and the required texts `NO_GPU_FLAG_IS_A_CONSTANT`, `NO_GPU_FLAG_IS_IN_EVERY_COMMAND`, `REDIRECTS_ARE_ERRORS`, `HTTP_CLIENT_RECHECKS_LOOPBACK` |

Red, in the suite: 23 planted lines, one or more per rule (`every rule has a planted case` asserts none is missing), plus three tests that cover the four required texts.

Red, on disk (a real file planted, the test run, the file removed):

```
$ printf ... > apps/transcriber/src/planted-violation.ts      # a second reader of the key file that prints a header
$ npx -w @dems/transcriber vitest run src/__tests__/static.test.ts
     × scans the production files of the workspace: the list is pinned, so an empty scan cannot pass
     × has no violation
     × the settings file is named in the single key-loader and nowhere else, tests included
+     "match": ".omlx",            "path": "src/planted-violation.ts", "rule": "KEY_FILE_ONLY_IN_KEY_LOADER",
+     "match": "'Authorization'",  "path": "src/planted-violation.ts", "rule": "AUTHORIZATION_HEADER_ONLY_IN_HTTP_CLIENT",
+     "match": "console.",         "path": "src/planted-violation.ts", "rule": "NO_CONSOLE",
 Test Files  1 failed (1)
      Tests  3 failed | 30 passed (33)
$ rm apps/transcriber/src/planted-violation.ts
$ npx -w @dems/transcriber vitest run src/__tests__/static.test.ts
 Test Files  1 passed (1)
      Tests  33 passed (33)
```

## 8. Baseline — not worse

| Check | Command | Result |
|---|---|---|
| typecheck | `npm run typecheck -w @dems/shared`, `-w @dems/core-server`, `-w @dems/transcriber` | exit 0, 0, 0 |
| lint | `npm run lint -w …` (same three) | exit 0, 0, 0 |
| shared tests | `npm run test -w @dems/shared` | 74 files, 1914 passed, 0 failed (the brief's 1894 plus the tests other rows added; this row adds none there) |
| core-server static guards | `npx -w @dems/core-server vitest run --project unit test/static` | 13 files, 137 passed. No pinned count changed: this row edited no file under `apps/core-server` or `packages/shared` |
| core-server unit | `npm run test -w @dems/core-server` | inside the sandbox: 7 failed / 4199 passed — the 3 baseline MODG failures (`modules/sessions/__tests__/routes.test.ts` x2, `modules/evidence/__tests__/routes.test.ts` x1) plus 4 in `modules/stt-config/__tests__/routes.test.ts`, which bind a loopback port (sandbox EPERM). Re-run of that folder outside the sandbox: `npx -w @dems/core-server vitest run --project unit src/modules/stt-config` → 2 files, 58 passed. So: **3 failed, the baseline** |
| transcriber | `npm run test -w @dems/transcriber` | 6 files, 126 passed (inside and outside the sandbox) |
| media/model files in git | `git ls-files --others --exclude-standard apps/transcriber \| grep -ciE '\.(wav\|bin\|mp4\|aiff\|onnx)$'` | 0 |
| no-figure grep (D230) | `grep -rniE '\brtf\b\|\bwer\b\|real[- ]time factor\|throughput\|ms per audio' apps/transcriber --include='*.ts' \| grep -v static` | no match (exit 1) |
| Homebrew | no `brew install`/`upgrade` was run; `omlx 0.6.4` before and after | unchanged |

Lockfile: one write, under the lock, offline, lockfile only:

```
$ /usr/bin/lockf -k .locks/npm.lock npm install --package-lock-only --offline --ignore-scripts --no-audit --no-fund
up to date
$ diff <before> package-lock.json      # 18 added lines: the "apps/transcriber" block and the "node_modules/@dems/transcriber" link
```

The link itself was made by hand, exactly as npm makes it: `ln -s ../../apps/transcriber node_modules/@dems/transcriber` (no reify of `node_modules` while a lane stack is running). New npm dependencies: none (`zod`, `vitest`, `oxlint`, `typescript`, `@types/node` at the versions already in the lockfile).

## 9. Decisions taken in this row (for the decision log)

| ID | Decision | Why | Needs confirmation |
|---|---|---|---|
| D-76-1 | For `cpu-local`, `stt_config.model` is a FILE NAME inside a host-configured model directory (for example `ggml-large-v3-turbo.bin`); a separator, `..` or an absolute path is refused. The engine path and the model directory are host configuration (`TranscriberRuntime`), never a database value | "model path from config only"; an operator-editable value must not be able to point the engine at an arbitrary file | **yes** — row 115 supplies `TranscriberRuntime`; row 117 (web menu) should show a model list or validate the same pattern |
| D-76-2 | An over-bound thread plan is REFUSED at configuration time, not clamped at run time. tx §C says "the adapter clamps" | a silent clamp would let a session run with another bound than its configuration states; refusal keeps the checkpoint/document determinism argument of §B.4. The default plan (physical cores minus 2, one processor) always holds the bound | **yes** — wording of tx §C |
| D-76-3 | `CAPTURE_RESERVED_CORES = 2` and `STT_NICE = 10` are PROPOSALS (tx §0.2 style). On this Mac the default gives `-t 8`, the rows 109/110 value | no decided value exists; calibration is class C (C-7) | no (flagged) |
| D-76-4 | The transcriber workspace binds no port at all (stricter than "never binds port 8000 outside the `omlx-server` adapter") and the automated suite uses an in-process answerer at the `fetch` seam instead of a listening fake | the adapter is a client only; nothing here needs a listener; the suite then runs inside the sandbox | no |
| D-76-5 | Segment `id` is the index in the result on both backends; text is trimmed on both; `start`/`end` stay chunk-relative seconds; `offsetMs` is carried, not applied; the adapter does NOT clamp a segment that ends past the audio | tx §B.1 ("A.5 converts"), §A.3 (clamping is the pipeline's, row 77). The real oMLX run still shows the row-12 phantom tail (`65.54 – 95.52` on a 65.72 s file), so row 77 must gate it | **yes** — row 77 owns the clamp |
| D-76-6 | The credential reference the loader accepts is exactly `omlx-settings:auth.api_key`; any other store or member is `CREDENTIAL_REF_UNSUPPORTED`. An `ENCRYPTED` credential (`SECRET` write, D-113-3) is not readable by the transcriber yet | the Core credential store does not exist yet (D-113-3); reading any other member of the settings file would widen SEC35-14 | **yes** — the row that builds the credential store adds its loader branch inside `key-loader.ts` (the static rule keeps it the only place) |
| D-76-7 | `THIRD_PARTY_NOTICES.md` gained the entries for the engines this row uses (whisper.cpp, ggml, turbo weights, oMLX as a dev tool, OmniVoice as a dev fixture). Silero VAD, sherpa-onnx and the diarization assets are added by rows 77/78 | DOC-05 is listed for this row; the other components are not used by any code yet | no |

## 10. Not done here, said plainly

| Item | State | Owner |
|---|---|---|
| Mounting in the Core: `provideProbe(createConnectionProbe(...))`, the `stt_config` snapshot at session start, `enabled = false` handling | NOT wired; `apps/core-server` does not import `@dems/transcriber` | row 115 |
| CS-22 boot check "model files present" in `apps/core-server/src/core/boot-checks.ts` | the transcriber side exists (`checkCpuLocalFiles`, `cpu-local.ts:77`; probe); the boot step itself is NOT added | row 115 |
| SH-09 dataset service list (transcription health) in `packages/shared` | NOT touched (`packages/shared` was outside this row's files while row 113 is under review) | controller to assign |
| VAD chunking, checkpoints, retries (`STT_CHUNK_RETRIES`), segment clamping, diarization, document assembly | NOT in this row | rows 77, 78 |
| `TtsFixtureProvider.generate()` on the real server for all 13 turns with voice cloning | NOT run. Unit-tested with a stand-in synthesiser; one real turn without cloning was synthesised (section 5.2). The reference voices (`say` + `afconvert`) are inputs, not created by this code. Checks reuse the sealed bytes by rule (tx §B.6) | none needed unless a new fixture is wanted |
| W1-C5 (pyannote excluded, sherpa-onnx route) | no diarization code in this row; nothing here downloads or references a gated model (static rule `NO_DOWNLOAD_OR_INSTALL`) | row 78 |
| `masterplan/02_plan.md`, `status_tasks.md`, `implementation/99_implementation_report.md` | NOT edited (parallel run: shared files are the controller's) | controller |
| Persistent log location | `createFileLog({ dir })` exists and is tested; the directory is a caller's configuration value. The real runs used the in-memory log and wrote evidence JSON under `.cache/` | row 115 passes the Core log directory |

## 11. Files

Created:

- `apps/transcriber/package.json`, `tsconfig.json`, `vitest.config.ts`, `vitest.real.config.ts`
- `apps/transcriber/src/index.ts`, `types.ts`, `config.ts`, `adapter.ts`, `cpu-priority.ts`, `key-loader.ts`, `log.ts`, `probe.ts`, `wav.ts`
- `apps/transcriber/src/backends/cpu-local.ts`, `omlx-http.ts`, `omlx-server.ts`
- `apps/transcriber/src/host/physical-cores.ts`
- `apps/transcriber/src/fixtures/tts-fixture-provider.ts`
- `apps/transcriber/src/__tests__/support.ts`, `static-rules.ts`, `static.test.ts`, `adapter-contract.test.ts`, `cpu-priority.test.ts`, `key-loader.test.ts`, `backends.test.ts`, `tts-fixture-provider.test.ts`
- `apps/transcriber/test/real/real-support.ts`, `cpu-local.real.test.ts`, `omlx-server.real.test.ts`, `shape.real.test.ts`
- `docs/2026-10-07_dems_real_capture_sealing/implementation/33_m6_transcriber_adapter.md` (this file)
- `docs/2026-10-07_dems_real_capture_sealing/delegation_progress/coder_execution_row76.md`

Updated:

- `package-lock.json` (18 added lines: the new workspace and its link)
- `THIRD_PARTY_NOTICES.md` (one section appended)

Outside git (git-ignored): `node_modules/@dems/transcriber` (symlink); `.cache/stt/checks/row76/` (evidence JSON, the cut negative-control WAV, one synthesised turn, the oMLX log backup and excerpt).

Pinned counts changed in existing static guards: none.

## 12. Commands for the navigator

```
# 1. automated suite: M6-AD-1, M6-CP-1, static rule (inside the sandbox)
npm run typecheck -w @dems/transcriber && npm run lint -w @dems/transcriber
npm run test -w @dems/transcriber                       # 6 files, 126 passed
npm run test -w @dems/transcriber -- --reporter=verbose # test names

# 2. cpu-local for real (alone; outside the sandbox so sysctl and setpriority work)
uptime
npm run test:real:cpu-local -w @dems/transcriber        # 4 passed
jq '{argv, rawSha256, rawBytes, matchesRow109, segments, nice}' .cache/stt/checks/row76/cpu-local.evidence.json
# expect rawSha256 6039a9447ed165b94d01cfff94ae7c4d17e034f2366e4af4c0c0d4e7cab94439, 3717 bytes, 14 segments

# 3. omlx-server for real — ONLY with the server started by the sanctioned script, log backed up first,
#    and stopped again afterwards (section 6). Never beside step 2.
npm run test:real:omlx-server -w @dems/transcriber      # 6 passed
shasum -a 256 .cache/spikes/stt-check/runs/whisper-run1.json   # 08900b7c… = rawSha256 of omlx-server.evidence.json

# 4. both real results, one shape (needs the result files of 2 and 3)
npm run test:real:shape -w @dems/transcriber            # 1 passed

# 5. baseline
npm run test -w @dems/shared                            # 1914 passed
npm run test -w @dems/core-server                       # 3 failed (MODG) outside the sandbox
lsof -nP -iTCP:8000 -sTCP:LISTEN                        # no listener
```

---
*Generated: 2026-10-09 11:00 (+07:00)*

---

# Fix round 1 (navigator findings) — 2026-10-09

Source: `delegation_progress/pair_76_navigator.md` (ACCEPT-WITH-FINDINGS; 0 blocker, 3 major, 11 minor) and the controller's fix-round brief. Files touched: `apps/transcriber/**` and the evidence folder `.cache/stt/checks/row76/` only. No file of `packages/shared` or `apps/core-server` was edited; no lockfile write (one `scripts` line added to `apps/transcriber/package.json`; no dependency change).

## F1. What this round supersedes in the text above

| Above | Now |
|---|---|
| §1, §9 D-76-1: "`stt_config.model` is a FILE NAME inside the model directory" | **Withdrawn by controller ruling.** The model is an IDENTIFIER; for `cpu-local` the file is `<modelDir>/<id>.bin` (`apps/transcriber/src/config.ts:101`, `:136`). The pattern is the ONE shared constant `STT_MODEL_ID_PATTERN` / `isSttModelId` of `packages/shared/src/api/transcription.ts:126-131` (exported by the row-113 fix round; imported, not copied) |
| §5.1: the command starts with `whisper-cli` | It starts with `/usr/bin/nice -n 10`, then the same `whisper-cli … -ng -t 8 -l id -oj …` (F4) |
| §3, §5.3: `documentShape` | Removed. `resultShape` + the strict schema (F9) |
| §7: static rule = 17 text patterns + 4 required texts | Rebuilt on the TypeScript syntax tree: 21 rules + `UNPARSEABLE_SOURCE` + 6 required-structure rules (F2) |
| §5, §12: evidence at `.cache/stt/checks/row76/*.json` | Each run writes a new directory under `.cache/stt/checks/row76/runs/` (F11). The round-0 files stay where they were |
| §2 rule 5, `log.ts`: own blanking patterns | By-position blanking is the shared rule set `redactCredentialText` / `redactCredentialValue` of `packages/shared/src/api/redaction.ts` (row 113); by-value blanking stays here (F8) |

## F2. Per finding

| Finding | Outcome | Where | Proof |
|---|---|---|---|
| **N-1** static rule blind spots | **Fixed.** The rule engine parses every file with the TypeScript compiler API (`typescript` 6.0.3, already a devDependency) and reads imports (with and without `node:`, static, dynamic, `require`), member accesses by dot or by bracket-with-text, destructuring, identifiers used as values, object keys quoted or not, numbers, and texts with `+` folded. Comments are not in the tree; a `//` inside a text is text | `apps/transcriber/src/__tests__/static-rules.ts:115` (facts), `:250` (rules), `:373` (required), `:455` (`scanSources`) | F3 |
| **N-2** model identifier (ruling on D-76-1) | **Fixed.** `<modelDir>/<id>.bin`; an id ending in `.bin` (any case), a separator, `..`, an absolute path, NUL, white space, a leading `-` or `.`, an empty id and more than 128 characters are refused (`MODEL_ID_INVALID`) for BOTH backends; `omlx-server` sends the id as it is. Shared pattern imported from `@dems/shared/api` — it WAS exported when I checked, so no local copy and no TODO exists | `config.ts:101`, `:136`, `:145` | 17 refusals x 2 backends; a table test that the transcriber and `isSttModelId` agree on 25 candidates; the seeded row `STT_CONFIG_DEFAULT` resolves and runs (unit); the REAL run with the seeded id reproduces row 109 (F5) |
| **N-4** timing figures in evidence | **Fixed.** `omlx-serve.row76.excerpt.log` rewritten by the new excerpt step: 0 timing figures (was 2). The step (`apps/transcriber/test/real/log-excerpt.ts:17`, `:27`) removes the timestamp of every line and every number with a time or rate unit, and THROWS instead of writing a line in which one is left. Not derived anywhere else: neither row document quoted the figures | `test/real/log-excerpt.ts`, `test/real/omlx-log-excerpt.real.test.ts`, unit `src/__tests__/log-excerpt.test.ts` | `grep -cE '[0-9.]+s,\|[0-9]{2}:[0-9]{2}:[0-9]{2}'` on the excerpt → 0. See F12 for what was NOT changed |
| **N-5** niceness | **Fixed, with one stated limit.** (a) The engine is started THROUGH `nice` with no shell (`spawn(nicePath, ['-n','10', binary, …])`, `cpu-local.ts:195`): `nice` lowers itself and then becomes the engine, so the engine is never un-lowered. (b) `nice` goes on when the host refuses, so the host is asked first, once per backend (`hostLowersPriority`, `cpu-local.ts:75`); the default mode `required` then starts NO engine (`PRIORITY_NOT_APPLIED`, `:252`); `best-effort` exists only for a sandbox and logs a `warn`. (c) A missing `nice` is `ENGINE_NOT_FOUND`/`NICE_NOT_FOUND`. (d) Unit: one of two strict blocks runs, chosen by what the OS answers; a wrong value fails in either. (e) Real run: the niceness is asserted from `ps -o ni=,comm= -p <pid>` sampled during the run | `cpu-local.ts:75`, `:195`, `:252`; `cpu-priority.test.ts`; `test/real/cpu-local.real.test.ts:38` | F5: every `ps` sample of the engine at 10; none before the engine replaced `nice` |
| N-5 Linux caveat | **NOT claimed.** On Linux a niceness belongs to a thread. Starting already lowered should hand it to every thread, but that is unproven here: **class-C item for the real Core device** (also `/proc/cpuinfo` counting) | — | — |
| **N-6** engine environment | **Fixed.** `ENGINE_ENVIRONMENT` = `PATH=/usr/bin:/bin`, `LANG=C`, `LC_ALL=C`, frozen; nothing of the parent | `cpu-local.ts:65`, `:195` | the stand-in engine dumps its environment: exactly those three (plus `__CF_USER_TEXT_ENCODING`, which macOS adds itself); a canary planted in the parent is absent. The real run reproduces the row-109 bytes under this environment |
| **N-7** model link out of the directory | **Fixed.** real path of the file must lie under the real path of the directory + separator; else `MODEL_OUTSIDE_MODEL_DIR`, no engine start; the probe answers `MODEL_NOT_AVAILABLE` | `cpu-local.ts:135-156` | link to outside refused; a sibling directory whose name only starts like the model directory refused; negative control: a link that stays inside is accepted |
| **N-8** `localhost` | **Fixed, with a correction to the brief.** The request address is rewritten to `127.0.0.1`; the name never reaches the transport (adapter, probe and fixture synthesiser share the client). **The `Host` header cannot be kept as `localhost`:** the runtime's `fetch` drops a `Host` header a caller sets. Measured with a scratch listener: header set to `localhost:<port>`, the server received `127.0.0.1:<port>` (`.cache/stt/checks/row76/fix1/host-header-probe.mjs`). The client therefore sets none and the code says so. Keeping `Host: localhost` would need a custom dispatcher, that is a new dependency or a `node:http` client; neither was added. The oMLX server does not route on the header (real run: 200) | `omlx-http.ts:62` | unit: 3 endpoints requested at `127.0.0.1`, through client, adapter and probe; REAL run: configured `http://localhost:8000`, requested `["http://127.0.0.1:8000/v1/models"]`, answer `OK` |
| **N-9** query / fragment | **Fixed locally** (the shared pattern is row 113's file). `?` or `#` → `ENDPOINT_HAS_QUERY_OR_FRAGMENT`; a backslash, white space or a control character → `ENDPOINT_MALFORMED`; refused by the configuration AND by the HTTP client. Follow-up for row 113: put the same rule into `STT_LOOPBACK_ENDPOINT_PATTERN` so op 91 refuses what the transcriber refuses | `config.ts:115-127` | 9 endpoints, nothing sent; negative control: a plain path keeps the request path |
| **N-10** escaped credentials | **Fixed.** By value: every protected credential is blanked as it is, as JSON writes it (once and twice), URL-encoded and as base64 (`key-loader.ts:111`, `:124`); a record is blanked member by member BEFORE it becomes JSON (`log.ts:73`). By position: the shared rule set of row 113, which WAS exported, replaces this workspace's own patterns | `key-loader.ts`, `log.ts:58`, `:73` | 5 awkward keys (quote, backslash, non-ASCII, tab, `+/=&`), 5 written forms each, 0 found in the log; negative control without protection keeps the key |
| **N-11** shape test | **Fixed by saying what proves what.** `documentShape` is gone. "Identical shape" = both results parse under the ONE strict schema, and the tests show that schema REJECTING (extra top member, extra segment member, wrong QA type, each mandatory member missing). `resultShape` now reports the union of segment keys, so it can differ for two valid results, and does on the real ones: `cpu-local` 4 keys, `omlx-server` 10; the difference is asserted to be QA members only. For row 78: if QA members enter the sealed document, the sealed document will differ per backend | `types.ts:89`; `adapter-contract.test.ts`; `test/real/shape.real.test.ts` | F6 |
| **N-13** audio format | **Fixed.** PCM chunks: `Int16Array`, exactly 16000 Hz, not empty. File chunks: RIFF/WAVE, integer PCM, 16 bit, ONE channel (the rate is the container's: the engine resamples a file, which is how the sealed 24 kHz fixture is read). Else `AUDIO_FORMAT_UNSUPPORTED`, before any engine or request. `durationMs` is still carried and unused here (row 77's clamp uses it) | `wav.ts:85`; `cpu-local.ts`, `omlx-server.ts` | 10 bad chunks x 2 backends; negative control: 16 kHz PCM and a 24 kHz mono file accepted |
| **N-14** evidence overwritten | **Fixed.** `createRunDir` makes `.cache/stt/checks/row76/runs/<UTC stamp>-<pid>-<kind>/` and fails when it exists; every file is written with the exclusive flag; the shape test reads the newest run of each backend | `test/real/real-support.ts:36`, `:45` | unit `evidence-runs.test.ts`; 5 run directories exist after this round, none rewritten by a later run |
| N-3, N-12 | recorded by the controller (not this driver's) | — | — |

## F3. N-1 — red first, then green

The new cases were written against the OLD engine first:

```
$ npx -w @dems/transcriber vitest run src/__tests__/static.test.ts     # old static-rules.ts
     × K: a token printed to stderr
     × B: code after // inside a string
     × A: an unquoted Authorization key
     × C: http without the node: prefix
     × D: child_process without the node: prefix
     × E: the environment by bracket
     × F: fetch through an alias
     × G: the settings path by concatenation
     × H: the environment by import
     × I: a net client on the port
     × J: a plain second reader
     × the six violations in ONE file, as the navigator planted them, are all reported
     × the same six lines appended to an EXISTING production file are reported too (no new file needed)
     × the three violations of the first on-disk demonstration (a second key reader that prints a header)
      Tests  46 failed | 36 passed (82)
```

(kept at `.cache/stt/checks/row76/fix1/red_static_old_engine.txt`). With the new engine: `static.test.ts` 82 passed. All planted cases are in-memory source texts; nothing is planted on disk.

| Navigator probe | Rule(s) now reported |
|---|---|
| A unquoted `Authorization` key | `AUTHORIZATION_HEADER_ONLY_IN_HTTP_CLIENT` |
| B code after `//` inside a text | `NO_CONSOLE`, `FETCH_ONLY_IN_HTTP_CLIENT` |
| C `http` without `node:` | `NO_NETWORK_MODULE` |
| D `child_process` without `node:` | `CHILD_PROCESS_ONLY_IN_ENGINE_MODULES`, `NO_SHELL` |
| E `process['env']` | `NO_ENVIRONMENT_READ` |
| F `globalThis.fetch` alias | `FETCH_ONLY_IN_HTTP_CLIENT` |
| G settings path by concatenation | `KEY_FILE_ONLY_IN_KEY_LOADER`, `HOME_DIRECTORY_ONLY_IN_KEY_LOADER` |
| H `import { env } from 'node:process'` | `NO_ENVIRONMENT_READ` |
| I `net` client with `8e3` | `NO_NETWORK_MODULE`, `NO_PORT_8000_LITERAL` |
| J plain second reader | `KEY_FILE_ONLY_IN_KEY_LOADER`, `HOME_DIRECTORY_ONLY_IN_KEY_LOADER` |
| K `process.stderr.write` | `STDERR_ONLY_IN_LOG` |

Beyond the probes: 53 single-line cases (bracket access, destructuring, dynamic `import()`, `require`, folded texts, templates, numeric forms of 8000), 6 required-structure rules each shown red (a command without the constant `-ng`, `-ng` made optional, an engine that inherits the parent environment, a missing `shell: false`, redirects followed, loopback not re-checked), a file the parser cannot read is itself a violation, and three "not a violation" controls (comments; a `//` inside a text; ordinary names that only contain a forbidden word).

Stated limit, also written in the rule file: this is a guard against a careless change, not a sandbox. Code that builds a name at run time from character codes is outside any static reading; `NO_DYNAMIC_CODE` closes `eval`, `Function` and `node:vm`. A text inside a regular-expression literal is not read as a text.

## F4. Suite totals

```
$ npm run typecheck -w @dems/transcriber      # exit 0
$ npm run lint -w @dems/transcriber           # exit 0
$ npm run test -w @dems/transcriber
 Test Files  8 passed (8)
      Tests  239 passed | 1 skipped (240)
```

Was 6 files / 126 tests. The 1 skipped test is by design: the two niceness blocks are complementary (`it.runIf(HOST_LOWERS_PRIORITY)` / `it.runIf(!HOST_LOWERS_PRIORITY)`), and a third test asserts that exactly one of them ran and that the product's own probe agrees with the test's. Inside the sandbox the "host forbids" block runs; outside it the "host lowers" block runs. Same totals in both.

M6-AD-1: 11 tests, all pass (was 10; the N-11 test was added). M6-CP-1: 20 pass + the 1 complementary skip (was 16).

Red before the fix, for the non-static findings. Honest account: I had applied these fixes before their tests existed, so "red first" in the strict sense holds only for N-1. For the others each fix was taken out again, one at a time, in a scratch COPY of the workspace, and the new test run on it (`.cache/stt/checks/row76/fix1/mutation-red.py`, result `mutation-red.json`):

| Fix removed | New tests failing |
|---|---|
| N-2 id maps to `<id>.bin` | 2 |
| N-2 the one shared id pattern | 4 |
| N-5 started through `nice` (outside the sandbox) | 1 |
| N-5 `required` mode refuses (inside the sandbox) | 1 |
| N-6 own environment | 1 |
| N-7 real path inside the model directory | 3 |
| N-8 `localhost` as the address | 4 |
| N-9 query / fragment refused | 4 |
| N-10 escaped forms blanked | 1 |
| N-13 audio format checked | 10 |
| N-11 shape helper can differ | 1 |
| N-4 timing stripped | 1 |
| N-14 evidence written once | 1 |

## F5. `cpu-local` real run with the SEEDED default id

Outside the sandbox, alone (port 8000 free, no `omlx serve`, no other `whisper-cli`):

```
$ npm run test:real:cpu-local -w @dems/transcriber
 Test Files  1 passed (1)
      Tests  5 passed (5)
```

Run directory `.cache/stt/checks/row76/runs/20261009T043107461Z-2033-cpu-local/`, `cpu-local.evidence.json`:

```
modelId   ggml-large-v3-turbo                      (= STT_CONFIG_DEFAULT.model)
argv      /usr/bin/nice -n 10
          /Users/gsp-budi/Documents/DEMS/.cache/stt/whisper.cpp/build/bin/whisper-cli
          -m /Users/gsp-budi/Documents/DEMS/.cache/stt/models/ggml-large-v3-turbo.bin
          -ng -t 8 -l id -oj -of <run dir>/work/stt-1ddb337b-… -f …/fixture-two-speaker-id.wav
rawSha256 6039a9447ed165b94d01cfff94ae7c4d17e034f2366e4af4c0c0d4e7cab94439     matchesRow109: true
rawBytes  3717      segments 14      language id      physicalCores 10 (sysctl)
nice      10        engineObservedFromOutsideWithPs: true      everyPsSampleOfTheEngineAtNice10: true
```

So the seeded id, the `nice` start and the three-variable environment together still give the row-109 bytes. Negative controls unchanged: wrong id → `MODEL_NOT_FOUND`, 0 runs; cut fixture → provider refuses, engine output `5d09469d…060b5e41`, 3 segments.

One correction made after the run: the test first wrote the NUMBER of `ps` samples into the evidence file. A count of samples taken at a fixed interval is a duration in disguise (D230), so the two counts were removed from that file and the test now writes the two booleans above. The file carries a note saying so.

## F6. `omlx-server` real run (once) and the shape

| Step | Time (2026-10-09, +07:00) | Evidence |
|---|---|---|
| Pre-check | 11:32:52 | port 8000: no listener; no `omlx serve`, no `whisper-cli` (the CPU run had ended); `omlx 0.6.4` |
| Log backed up first | 11:32:52 | secret-pattern count 0; `cp -p` → `.cache/stt/checks/row76/fix1/omlx-serve.log.bak-20261009T113252` (8,288 B) |
| Start | 11:32:52 | `~/Documents/omlx-script/start.sh` → `PID 2825`, `oMLX siap`, exit 0 |
| One serialised test file | 11:32:55 – 11:33:08 | `npm run test:real:omlx-server -w @dems/transcriber` → 7 passed (was 6; + the `localhost` check) |
| Excerpt step | after it | `DEMS_OMLX_SERVE_LOG=… npm run test:real:omlx-log-excerpt -w @dems/transcriber` → 1 passed (reads the log file only; no request) |
| Stop | 11:33:10 | `stop.sh` → `Menghentikan oMLX (PID 2825)... oMLX berhenti.`, exit 0 |
| Down confirmed | 11:33:14 | no listener; `pgrep` none; `STATUS : DOWN`; `omlx 0.6.4`; settings content hash unchanged |

Result (`runs/20261009T043256807Z-2868-omlx-server/`): HTTP 200, 17 segments, raw `08900b7c5eb97d8364aa3df55bb3036a4c14f7d9924ec17023f0eb69f3da6998`, 6801 B (= row 12), `keyFreeOutputs: true`, `maxCallsInFlight: 1`; no credential → `CREDENTIAL_REJECTED`; unserved model → `MODEL_NOT_AVAILABLE` (404); `localhost` → requested at `127.0.0.1`, `OK`. Never beside the CPU run. Not upgraded, reinstalled or reconfigured. Key never printed (`grep -rlE 'Bearer [A-Za-z0-9]|sk-[A-Za-z0-9]{6}'` over the evidence folder, log backups aside: no file).

```
$ npm run test:real:shape -w @dems/transcriber
      Tests  2 passed (2)
```

`runs/20261009T043323967Z-3184-shape/shape.evidence.json`: `bothParseUnderTheStrictSchema: true`; top-level keys equal; `cpuLocalSegmentKeys` = `end,id,start,text`; `omlxServerSegmentKeys` = those four + six QA members; `differenceIsQaMembersOnly: true`; 14 and 17 segments.

## F7. Baseline

`apps/core-server` and `packages/shared` were not edited by this round. `npx -w @dems/core-server vitest run --project unit test/static` → 13 files, 137 passed. The `shared` and `core-server` unit suites were NOT re-run this round: other rows' fix rounds are editing those trees, so a count taken now would not be this row's (the navigator made the same call). The transcriber imports four names from `@dems/shared/api` that row 113 added in its fix round (`isSttModelId`, `STT_MODEL_ID_PATTERN`, `STT_CONFIG_DEFAULT`, `redactCredentialText`/`redactCredentialValue`/`CREDENTIAL_BLANK`); `npm run typecheck -w @dems/shared` → exit 0 at the time of this round. If row 113 renames one of them, the transcriber's typecheck fails loudly.

## F8. Decisions and follow-ups for the controller

| ID | Item | Needs |
|---|---|---|
| D-76-8 | `Host` header: cannot be kept as `localhost` through the runtime's `fetch` (measured). The connection goes to `127.0.0.1` and the header is the address. If row 115's contract really needs `Host: localhost`, it needs a custom dispatcher (a new dependency or `node:http`) | **ruling** |
| D-76-9 | New host options on `CpuLocalRuntime`: `nicePath` (default `/usr/bin/nice`) and `priority` (`required` default, `best-effort` for a sandbox only). Row 115 should leave both at their defaults | record |
| D-76-10 | File chunks: mono 16-bit integer-PCM WAV of any rate (the engine resamples); PCM chunks: exactly 16 kHz. Row 77 supplies 16 kHz | record |
| D-76-11 | Run-directory names carry a UTC stamp. That is a clock time of when a check ran, not a duration of the engine; stated so nobody reads it as a figure | record |
| follow-up, row 113 | put the `?` / `#` / stray-character refusal (N-9) into the shared endpoint pattern so op 91 and the table CHECK refuse what the transcriber refuses | row 113 |
| follow-up, class C | Linux: per-thread niceness of the engine started through `nice`; `/proc/cpuinfo` core counting | class-C pack |
| superseded | D-76-1 (replaced by the ruling), the "own blanking patterns" of §2 | — |

## F9. Not changed, said plainly (N-4 remainder)

The server-log BACKUPS (`.cache/stt/checks/row76/omlx-serve.log.bak-20261009T105413`, `…/fix1/omlx-serve.log.bak-20261009T113252`) still hold the server's own timing lines. They are byte copies of the shared service's log, kept only because the start script truncates it; they are not evidence, are cited nowhere and are git-ignored. I did not edit them: an edited backup is no backup. The navigator's copy of my old excerpt under `.cache/stt/checks/row76_nav/driver_evidence_copy/` is the navigator's file and was not touched. If the controller wants the backups gone, that is a deletion I was not asked to make.

## F10. Files of this round

Created: `apps/transcriber/src/__tests__/log-excerpt.test.ts`, `apps/transcriber/src/__tests__/evidence-runs.test.ts`, `apps/transcriber/test/real/log-excerpt.ts`, `apps/transcriber/test/real/omlx-log-excerpt.real.test.ts`.

Updated: `apps/transcriber/package.json` (one script), `src/adapter.ts`, `src/config.ts`, `src/index.ts`, `src/key-loader.ts`, `src/log.ts`, `src/probe.ts`, `src/types.ts`, `src/wav.ts`, `src/backends/cpu-local.ts`, `src/backends/omlx-http.ts`, `src/backends/omlx-server.ts`, `src/__tests__/static-rules.ts` (rewritten), `static.test.ts` (rewritten), `support.ts`, `adapter-contract.test.ts`, `backends.test.ts`, `cpu-priority.test.ts`, `key-loader.test.ts`, `test/real/real-support.ts`, `cpu-local.real.test.ts`, `omlx-server.real.test.ts`, `shape.real.test.ts`; this document; `delegation_progress/coder_execution_row76.md`.

The workspace now has 34 files (was 30). Git-ignored: `.cache/stt/checks/row76/runs/` (5 run directories), `.cache/stt/checks/row76/fix1/` (red output, mutation script and result, `Host` probe, log backup), and the rewritten `omlx-serve.row76.excerpt.log`.

## F11. Commands for the navigator (fix round 1)

```
# automated (sandbox is fine)
npm run typecheck -w @dems/transcriber && npm run lint -w @dems/transcriber
npm run test -w @dems/transcriber                                 # 8 files, 239 passed, 1 skipped
npx -w @dems/transcriber vitest run src/__tests__/static.test.ts  # 82 passed
npm run test -w @dems/transcriber -- --reporter=verbose | grep -cE '✓.*M6-AD-1'   # 11
npm run test -w @dems/transcriber -- --reporter=verbose | grep -cE '✓.*M6-CP-1'   # 20
# the same suite outside the sandbox: 239 passed, 1 skipped (the other niceness block runs)

# red when a fix is removed (works on a scratch copy; run outside the sandbox for the N-5 line)
python3 .cache/stt/checks/row76/fix1/mutation-red.py              # 12 of 13 RED outside the sandbox;
                                                                  # "N-5 required mode refuses" is red INSIDE it

# cpu-local for real, seeded default id (alone, outside the sandbox)
npm run test:real:cpu-local -w @dems/transcriber                  # 5 passed
jq '{modelId, argv, rawSha256, rawBytes, matchesRow109, segments, nice, engineObservedFromOutsideWithPs, everyPsSampleOfTheEngineAtNice10}' \
   "$(ls -d .cache/stt/checks/row76/runs/*-cpu-local | tail -1)/cpu-local.evidence.json"

# omlx-server for real: only inside the sanctioned start/stop procedure (F6); never beside the CPU run
npm run test:real:omlx-server -w @dems/transcriber                # 7 passed
DEMS_OMLX_SERVE_LOG="$HOME/.omlx/logs/omlx-serve.log" npm run test:real:omlx-log-excerpt -w @dems/transcriber   # 1 passed
npm run test:real:shape -w @dems/transcriber                      # 2 passed

# N-4
grep -cE '[0-9.]+s,|[0-9]{2}:[0-9]{2}:[0-9]{2}' .cache/stt/checks/row76/omlx-serve.row76.excerpt.log   # 0
# N-8, the measurement behind D-76-8 (outside the sandbox: it listens on a random loopback port)
node .cache/stt/checks/row76/fix1/host-header-probe.mjs           # receivedHost 127.0.0.1:<port>
lsof -nP -iTCP:8000 -sTCP:LISTEN                                  # no listener
```

---
*Fix round 1 appended: 2026-10-09 11:45 (+07:00)*

---

# Fix round 2 (navigator re-check) — 2026-10-09

Source: "Re-check of fix round 1" in `delegation_progress/pair_76_navigator.md` (row 76 ACCEPTED; one new major R-1, one minor R-2, one evidence-hygiene item). Files touched: `apps/transcriber/**` and `.cache/stt/checks/row76/` only. No lockfile write, no dependency change, no oMLX run, nothing committed.

## G1. Per finding

| Finding | Outcome | Where | Proof |
|---|---|---|---|
| **R-1** (major) niceness judged against exactly 10 | **Fixed.** `nice -n 10` adds to the niceness of the process that starts it. The rule is now `engine niceness >= min(parent niceness + STT_NICE, 19)`, judged against this process's own `os.getPriority()`: in the host probe, in the unit helper and in the real test. The run record carries the niceness the engine really runs at (15 under a parent at 5), not the constant | rule `apps/transcriber/src/cpu-priority.ts:24`, `:31`, `:42`; probe `src/backends/cpu-local.ts:79`, `:100`, `:267`; unit helper `src/__tests__/support.ts:28-29`; real test `test/real/cpu-local.real.test.ts:100` | G2, G4 |
| **R-2** (minor) four plain evasions of the static rule | **Fixed**, 14 in-memory fixtures. (a) `process` used as a value (alias, `Reflect.get(process, …)`, `globalThis['process']`, in an object or a list) → new rule `PROCESS_OBJECT_IS_NOT_PASSED_AROUND`; (b) `createRequire`, `node:module` with or without the prefix, `process.mainModule` → `NO_DYNAMIC_CODE`; (c) `write`/`writeSync`/… with a literal 0, 1 or 2 as descriptor, `{ fd: 0|1|2 }`, `process.emitWarning`, `process.report` → new rule `NO_DIRECT_OUTPUT`; (d) `inspector`, `inspector/promises` → `NO_NETWORK_MODULE` | `src/__tests__/static-rules.ts:277`, `:327`, `:329`, `:372` | G3 |
| R-2 residual | **Stated, not closed:** a name built at run time (character codes, a computed member with a non-constant key) is outside a static reading. Also: a descriptor held in a variable (`const fd = 2; writeSync(fd, …)`) is not seen; only a literal is | header of `static-rules.ts` | — |
| Evidence hygiene | **Fixed.** `Start at` and `Duration` removed from `.cache/stt/checks/row76/fix1/red_static_old_engine.txt` (were lines 628-629); per-test millisecond suffixes removed from the three captured runner outputs. Every capture step of this round pipes the runner output through `grep -vE '^\s*(Start at\|Duration)'` and `sed -E 's/ [0-9]+ms$//'` before it is stored | evidence folder | `grep -rlE '^\s*Duration\|Start at  \|[0-9]ms$'` over the folder (log backups aside) → 0 files |

Note asked for by the brief: `engineIsLowered` is a rule about the engine and ITS PARENT process. "The engine must be lower than the CAPTURE WORKER" is a different rule, between two sibling processes that rows 77/115 start; it is not built here and the function's comment says so (`cpu-priority.ts:34-41`).

## G2. R-1 — red first, then green

Tests written before the fix (`src/__tests__/cpu-priority.test.ts`, group "fix round 2, R-1"), captured red in `.cache/stt/checks/row76/fix2/red_before_fix.txt` (19 failed: 14 static fixtures + 5 niceness tests). Honest note on what that red means for R-1: the five niceness tests name two functions that did not exist yet, so they failed for that reason. The BEHAVIOURAL red is the navigator's own failed background run (`PRIORITY_NOT_APPLIED`, 2 of 5 real tests failed) and this mutation, run after the fix on a scratch copy with the old absolute rule put back (`engineNice === STT_NICE`):

```
     × the rule: the engine is at least STT_NICE below the niceness of its parent (parent 0 -> 10, parent 5 -> 15)
     × negative controls: nice not applied (parent 5, child 5), and an absolute 10 under a parent at 5, are refused
     × at the floor of the scale the operating system clamps: a parent at 12 or lower still gets the lowest niceness, and that is accepted
      Tests  3 failed | 2 passed | 21 skipped (26)
```

The four cases of the brief, now green:

| Parent | Engine | Verdict | Test |
|---|---|---|---|
| 0 | 10 | accepted | `engineIsLowered(0, 10)`; real foreground run |
| 5 | 15 | accepted | `engineIsLowered(5, 15)`; real background-job run |
| 5 | 5 (nice not applied) | refused | `engineIsLowered(5, 5)`; and a stand-in `nice` program that starts the command without lowering it is found out by the real probe (`hostLowersPriority` → false) |
| 5 | 10 | refused | `engineIsLowered(5, 10)`; and the real probe's measured child judged against a parent 5 above the real one → false |

Also covered: a negative parent (-5 → 5), lower than asked (0 → 15 accepted), and the floor of the scale (a parent at 12 or lower can only get 19; accepted; macOS's 20 accepted).

## G3. R-2 fixtures

| Evasion | Rule reported |
|---|---|
| `const p = process; p.env.X` | `PROCESS_OBJECT_IS_NOT_PASSED_AROUND` |
| `Reflect.get(process, 'env')` | `PROCESS_OBJECT_IS_NOT_PASSED_AROUND` |
| `const p = globalThis['process']` | `PROCESS_OBJECT_IS_NOT_PASSED_AROUND` |
| `{ process }`, `[process]` | `PROCESS_OBJECT_IS_NOT_PASSED_AROUND` |
| `createRequire(import.meta.url)('http')` | `NO_DYNAMIC_CODE` |
| `process.mainModule.require('http')` | `NO_DYNAMIC_CODE` |
| `require('module')` | `NO_DYNAMIC_CODE` |
| `writeSync(1, token)`, `fs.writeSync(2, token)`, `fs.write(2, …)`, `fs['writeSync'](1, …)` | `NO_DIRECT_OUTPUT` |
| `process.emitWarning(token)` | `NO_DIRECT_OUTPUT` |
| `createWriteStream('', { fd: 2 })` | `NO_DIRECT_OUTPUT` |
| `import { open } from 'node:inspector'`, `import('inspector/promises')` | `NO_NETWORK_MODULE` |

Negative control: `process.execPath`, `process.version`, `process.stderr.write` in `log.ts`, and `writeSync(fd, bytes)` on an opened file are not violations. The real tree has no violation. The priority probe's one-line script is a text handed to a child process, not code of this workspace; it is the only place the text `writeSync(1, …)` appears.

Rule count: 23 rules + `UNPARSEABLE_SOURCE` + 6 required-structure rules (was 21 + 1 + 6). `static.test.ts`: 97 passed (was 82).

## G4. Real run: foreground AND as a background job

Outside the sandbox, alone (port 8000 free; no `omlx serve`, no other `whisper-cli`), the same command twice: `npm run test:real:cpu-local -w @dems/transcriber`, the second time as a zsh background job (`( … ) & wait`), which zsh starts 5 lower. Both: 5 passed.

| | Foreground | Background job |
|---|---|---|
| run directory | `runs/20261009T044719633Z-11811-cpu-local/` | `runs/20261009T044824177Z-12336-cpu-local/` |
| `parentNice` (this process, `os.getPriority()`) | 0 | 5 |
| `expectedEngineNice` | 10 | 15 |
| `nice` in the run record | 10 | 15 |
| every `ps -o ni=,comm=` sample of the engine at the expected niceness | true | true |
| command | `/usr/bin/nice -n 10 …/whisper-cli -m …/ggml-large-v3-turbo.bin -ng -t 8 -l id -oj -of … -f …/fixture-two-speaker-id.wav` | the same |
| model id | `ggml-large-v3-turbo` (seeded default) | the same |
| raw SHA-256 | `6039a9447ed165b94d01cfff94ae7c4d17e034f2366e4af4c0c0d4e7cab94439` | `6039a9447ed165b94d01cfff94ae7c4d17e034f2366e4af4c0c0d4e7cab94439` |
| raw bytes / segments | 3717 / 14 | 3717 / 14 |

Before the fix the background start was refused with `PRIORITY_NOT_APPLIED` (the navigator's first attempt). After it: an engine at 15, the row-109 bytes.

## G5. Suite totals

```
$ npm run typecheck -w @dems/transcriber      # exit 0
$ npm run lint -w @dems/transcriber           # exit 0
$ npm run test -w @dems/transcriber
 Test Files  8 passed (8)
      Tests  259 passed | 1 skipped (260)
```

Was 239 / 1. Same totals inside and outside the sandbox; the one skip is the complementary niceness block (outside the sandbox the skipped one is "host forbids it", which is the condition under which green proves the niceness). M6-AD-1: 11 pass. M6-CP-1: 25 pass (20 + the 5 R-1 tests) plus the complementary skip.

## G6. Two changes forced by the row-113 round running beside this one

Both showed up as failing tests of mine when `packages/shared` changed under me, and both are fixed on my side only:

1. **`STT_MODEL_ID_PATTERN` was tightened** (a trailing `.` is now refused too). My test had pinned the TEXT of the pattern; that was my mistake — it is row 113's constant. The test now pins what matters: the transcriber and `isSttModelId` give the same verdict on every candidate, and none of the 17 refused ids is accepted.
2. **The shared blanking rules changed** so that my own placeholder `[credential]` followed by `:` was read as a member name and the text after it was blanked. The transcriber's placeholder is now the shared `CREDENTIAL_BLANK` (`***`) itself (`src/key-loader.ts:24-29`), so a line blanked by value holds nothing the by-position rules could take for a name.

## G7. Carried by the controller, not done here

R-3 (hex / unpadded-base64 forms of a credential) → the row that adds the ENCRYPTED loader branch. Shared endpoint pattern alignment (N-9) → a row-113 follow-up. Gate runs outside the sandbox that show which niceness block ran → rows 77/115. Linux per-thread niceness → class C. D-76-8 (`Host` header) still awaits a ruling.

## G8. Files of this round

Updated: `apps/transcriber/src/cpu-priority.ts`, `src/backends/cpu-local.ts`, `src/key-loader.ts`, `src/types.ts` (one comment), `src/__tests__/static-rules.ts`, `static.test.ts`, `cpu-priority.test.ts`, `backends.test.ts`, `support.ts`, `test/real/cpu-local.real.test.ts`; this document; `delegation_progress/coder_execution_row76.md`. Created: none in the workspace (still 34 files).

Git-ignored evidence: `.cache/stt/checks/row76/fix2/` (`red_before_fix.txt`, `mutation-red-r1-absolute-ten.txt`), two new run directories under `runs/`, and the cleaned `fix1/red_static_old_engine.txt`.

## G9. Commands for the navigator (fix round 2)

```
npm run typecheck -w @dems/transcriber && npm run lint -w @dems/transcriber
npm run test -w @dems/transcriber                                   # 8 files, 259 passed, 1 skipped
npx -w @dems/transcriber vitest run src/__tests__/static.test.ts    # 97 passed
npx -w @dems/transcriber vitest run src/__tests__/cpu-priority.test.ts -t 'R-1'   # 5 passed
npm run test -w @dems/transcriber -- --reporter=verbose | grep -cE '✓.*M6-AD-1'   # 11
npm run test -w @dems/transcriber -- --reporter=verbose | grep -cE '✓.*M6-CP-1'   # 25

# real, alone, outside the sandbox: foreground, then as a background job (parent niceness 5)
npm run test:real:cpu-local -w @dems/transcriber                     # 5 passed
( npm run test:real:cpu-local -w @dems/transcriber ) & wait           # 5 passed
for R in $(ls -d .cache/stt/checks/row76/runs/*-cpu-local | tail -2); do
  jq -c '{parentNice, expectedEngineNice, nice, everyPsSampleOfTheEngineAtTheExpectedNice, rawSha256, segments}' $R/cpu-local.evidence.json
done
# expect parentNice 0 -> nice 10 and parentNice 5 -> nice 15, both with 6039a944…cab94439, 14 segments

grep -rlE '^\s*Duration|Start at  |[0-9]ms$' .cache/stt/checks/row76 --include='*.txt' --include='*.json' --include='*.log' | grep -v 'bak-'   # no file
lsof -nP -iTCP:8000 -sTCP:LISTEN                                     # no listener
```

---
*Fix round 2 appended: 2026-10-09 11:55 (+07:00)*
