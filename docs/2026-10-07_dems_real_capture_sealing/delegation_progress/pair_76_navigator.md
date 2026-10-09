---
task_id: 2026-10-07_dems_real_capture_sealing
row: 76 (M6-W1) — Transcriber app + adapter + fixtures
agent: verifier (NAVIGATOR of the row-76 pair; independent of the driver)
date: 2026-10-09
reviewed: apps/transcriber/** (30 untracked files), implementation/33_m6_transcriber_adapter.md, delegation_progress/coder_execution_row76.md, .cache/stt/checks/row76/
narrative_tier: 2
verdict: ACCEPT-WITH-FINDINGS
status: complete
---

# Row 76 — navigator review

## 1. Verdict

**ACCEPT-WITH-FINDINGS.** No blocker. Every number the driver reported was reproduced by my own runs (section 2). The adapter, both backends, the key-loader and the endpoint rule do what the spec asks. Three findings are major and need a ruling or a fix before the rows that build on this one (77, 115) start; the rest are minor.

| Major finding | One line |
|---|---|
| N-1 | The static rule misses real violations: a planted file with six of them produced zero rule hits |
| N-2 | D-76-1 does not agree with the seeded `stt_config.model`: the seeded default is not a file in the model directory, so a fresh `cpu-local` session would fail with `MODEL_NOT_FOUND` |
| N-3 | The row lists `SH-09`, `CS-22`, `W1-C5`, `DOC-05` as closed; only part of them is (the driver says so plainly; the controller must re-assign and log the drift) |

What I changed: nothing in the product. Scratch files I planted inside the repo (`apps/transcriber/test/real/nav-scratch.real.test.ts`, `apps/transcriber/src/planted-violation.ts`) were deleted; `git status --porcelain --untracked-files=all -- apps/transcriber` shows the same 30 files as before. My scratch lives under `.cache/stt/checks/row76_nav/` (git-ignored).

One side effect to know: the real-run tests write to a fixed directory (`apps/transcriber/test/real/real-support.ts:12`), so my re-run overwrote the driver's evidence files in `.cache/stt/checks/row76/`. I copied the driver's files first to `.cache/stt/checks/row76_nav/driver_evidence_copy/`; the five JSON files are identical in content after my run (compared with `jq -S | shasum`, all `SAME`).

## 2. Re-run numbers beside the driver's

| Check | Driver | Navigator (2026-10-09, +07:00) | Same |
|---|---|---|---|
| `npm run typecheck -w @dems/transcriber` | exit 0 | exit 0 | yes |
| `npm run lint -w @dems/transcriber` | exit 0 | exit 0 | yes |
| `npm run test -w @dems/transcriber` | 6 files / 126 passed | 6 files / 126 passed | yes |
| tests named `M6-AD-1` / `M6-CP-1` (verbose reporter, counted with `grep -c`) | 10 / 16 | 10 / 16 | yes |
| static rule test | 33 passed | 33 passed | yes |
| static rule on the driver's planted file | 3 failed, rules `KEY_FILE_ONLY_IN_KEY_LOADER`, `AUTHORIZATION_HEADER_ONLY_IN_HTTP_CLIENT`, `NO_CONSOLE` | the same 3 failed, the same 3 rules; 33 passed after removal | yes |
| `cpu-local` real run through the adapter | 4 passed; raw SHA-256 `6039a944...cab94439`, 3717 B, 14 segments, `id`, exit 0 | 4 passed; `6039a9447ed165b94d01cfff94ae7c4d17e034f2366e4af4c0c0d4e7cab94439`, 3717 B, 14 segments, `id`, exit 0 | yes |
| the same command WITHOUT the adapter (binary called directly, output hashed by `shasum`) | not done | `6039a9447ed165b94d01cfff94ae7c4d17e034f2366e4af4c0c0d4e7cab94439`, 3717 B, 14 entries, `id`, exit 0; stderr: `use gpu = 0`, `whisper_backend_init_gpu: no GPU found`, `n_threads = 8 / 10` | matches |
| niceness of the real `whisper-cli` process | 10 (value the adapter recorded) | **observed with `ps -o pid,ppid,ni,command`: every sample of both engine processes shows `ni=10` (sample count removed in the re-check: a count at a fixed interval is a duration, D230)** | yes |
| `cpu-local` negative control, fixture cut to 12 s | `5d09469d...060b5e41`, 3 segments | `5d09469d7e4064b8248c304c5e5c4c122b4892f1cad2a21b759f55cc060b5e41`, 3 segments | yes |
| `cpu-local` negative control, wrong model name | `MODEL_NOT_FOUND`, 0 runs | passed (same test) | yes |
| `omlx-server` real run | 6 passed; raw `08900b7c...f3da6998`, 6801 B, 17 segments, HTTP 200 | 6 passed; `08900b7c5eb97d8364aa3df55bb3036a4c14f7d9924ec17023f0eb69f3da6998`, 6801 B, 17 segments, HTTP 200, `maxCallsInFlight: 1` | yes |
| row-12 file `whisper-run1.json` | `08900b7c...` | `shasum -a 256` gives `08900b7c5eb97d8364aa3df55bb3036a4c14f7d9924ec17023f0eb69f3da6998` | yes |
| probe / no credential / unknown model / TTS turn | OK / `CREDENTIAL_REJECTED` / `MODEL_NOT_AVAILABLE` 404 / 151,724 B mono 16-bit 24 kHz | the same four results | yes |
| shape test | 1 passed, `identical: true`, 14 vs 17 | 1 passed, `identical: true`, 14 vs 17 | yes |

Host state for the CPU run: `uptime` at 11:05 showed load averages 15.28 12.49 10.38. The load came from other rows (two emulators and other agents' test runners); no job of mine and no other `whisper-cli` or `omlx serve` was running (`pgrep` exit 1). The check is functional, so the load does not change its meaning. No duration is recorded here (D230).

### 2.1 oMLX start and stop log (shared host service)

| Step | Time | Evidence |
|---|---|---|
| Pre-check | 11:08 | `lsof -nP -iTCP:8000 -sTCP:LISTEN` exit 1 (no listener); `pgrep -fl "omlx serve|whisper-cli"` exit 1; `omlx 0.6.4`; start and stop scripts contain no `read`, `sudo`, `brew`, `pip` or upgrade line (grep, no hit) |
| Settings hash before | 11:08 | `shasum -a 256 ~/.omlx/settings.json` first 12 characters `334d13f7a322`, 3268 B (hash only; the file was never displayed) |
| Log backed up first | 11:08:44 | secret-pattern count in the log: 0; `cp -p` to `.cache/stt/checks/row76_nav/omlx-serve.log.bak-20261009T110844` (8448 B) |
| Start | 11:08:44 to 11:08:47 | `~/Documents/omlx-script/start.sh`, exit 0, `PID 93307`, `oMLX siap: http://127.0.0.1:8000`; nothing interactive |
| One serialised test file | ended 11:08:56 | `npm run test:real:omlx-server -w @dems/transcriber`: 6 passed |
| Stop | 11:08:56 to 11:08:57 | `stop.sh`: `Menghentikan oMLX (PID 93307)... oMLX berhenti.` |
| Down confirmed | 11:08:59 | `lsof` exit 1; `pgrep` exit 1; `status.sh`: `STATUS : DOWN (http://127.0.0.1:8000)`; `omlx 0.6.4` (unchanged) |
| Settings hash after | 11:08:59 | identical (`diff` of the two hash files: no difference); size 3268 B; modification time moved to 11:08:45, as the driver observed (the server rewrites its own file at start) |

The server was never run beside the CPU run (the CPU runs had ended; `pgrep` was empty before the start). Not upgraded, not reinstalled, not reconfigured.

## 3. The eight review items

### 3.1 Adapter contract against tx §B

| Point | Result | Evidence |
|---|---|---|
| One interface, two backends | PASS | `TranscriberBackend` (`apps/transcriber/src/types.ts:110-114`); `createCpuLocalBackend` (`backends/cpu-local.ts:137`) and `createOmlxServerBackend` (`backends/omlx-server.ts:72`) both return it; both end in `TranscribeResultSchema.parse` (`cpu-local.ts:229`, `omlx-server.ts:158`) |
| Same document shape | PASS | one strict schema (`types.ts:61-67`); QA members optional and only set when the engine reported them (`omlx-server.ts:151-156`); none on `cpu-local` (`cpu-local.ts:223-228`) |
| Selection by configuration, no fallback | PASS | adapter frozen, one backend built once (`adapter.ts:58-74`) |
| Error taxonomy | PASS | 16 typed codes (`types.ts:116-144`); every failure path of both backends maps to one; no text is invented (`omlx-server.ts:141-144`) |
| Language `id` | PASS, one note | `-l id` in the command (`cpu-local.ts:70`), `language` form member (`omlx-server.ts:96`), any other option refused (`cpu-local.ts:148`, `omlx-server.ts:83`), `cpu-local` output must report `id` (`cpu-local.ts:219`). Note: when the server reports no language the result is still stamped `id` (`omlx-server.ts:136-139`) |
| Drift from the §B.1 sketch | acceptable | `TranscribeOptions` has no `modelPath`/`modelId` (the model is fixed by configuration, which is what §B.4 wants); `TranscriberChunk` carries `audio` (file or PCM) instead of `pcm` |

**What "identical" means.** The definition, `masterplan/10_test_strategy.md:215`:

> M6-AD-1 | TranscriberAdapter contract | one interface, two backends (`omlx-server`, `cpu-local`) return the identical document shape; `TtsFixtureProvider` produces the fixture; config-driven selection, never automatic mid-session | transcriber contract unit | 1

and tx §B.5: "the sealed transcript is byte-identical in shape regardless of backend; QA fields present on one backend and absent on the other are omitted, never zero-filled". The row's Verification cell says "both backends return the identical document shape on the fixture". So the requirement is **shape, not content**. The driver proved exactly that: one schema, 14 segments from one engine and 17 from the other. That is what M6-AD-1 defines. Content equality between two different engines was never required.

One weakness (finding N-11): `documentShape` (`types.ts:80-92`) keeps only the four mandatory segment keys before comparing, and the strict schema already forces those four and the five top-level members. So for any two results that pass the schema the two shape strings are always equal: the comparison cannot fail on its own. The real proof is "both results parse under the strict schema". The segments do differ in their key sets (4 keys against 10, see `shape.evidence.json`). Row 78 must decide whether QA members enter the sealed document; if they do, the sealed document will not have one shape for both backends.

### 3.2 M6-CP-1 — the CPU priority rule

Definition, `10_test_strategy.md:216`: "capture outranks STT: bounded thread product <= physical cores asserted; oMLX calls serialised (never beside a large VLM session)" — "config assertion unit + runbook check".

| Question | Answer | Evidence |
|---|---|---|
| Does the test assert the real rule or only a computed plan? | Both, with one gap. The plan is asserted over 1..64 cores (`cpu-priority.test.ts:17-41`); the bound reaches the real command (`-t 8` asserted on the real argv, `test/real/cpu-local.real.test.ts:47`); serialisation is observed at the fake server and at the queue (`:173-213`). **Gap:** the niceness of the real engine is recorded but never asserted in the real test (`cpu-local.real.test.ts:77` writes `nice`, no `expect`), and the unit test passes on either branch (`cpu-priority.test.ts:110-118`: when the host refuses, it only expects a warning). Inside the sandbox the refused branch runs, so the unit suite never proves the niceness there | finding N-5 |
| Is the niceness really applied? | **Yes on this Mac.** My own observation during the real run: every `ps` sample of the two `whisper-cli` processes shows `ni=10` | `.cache/stt/checks/row76_nav/ps_distinct.txt` |
| How it is applied | after the `spawn` event, with `setPriority(child.pid, STT_NICE)` (`cpu-local.ts:116-125`). The engine starts at niceness 0 and is lowered a moment later. On Linux (the Core) niceness is a per-thread value and `setpriority` on a pid changes the main thread only; threads created after the call inherit it, threads created before do not. Not proven on Linux | finding N-5 |
| D-76-2, refuse instead of clamp | **Acceptable, needs an erratum.** tx §C says "the adapter clamps"; the code refuses at configuration time (`cpu-priority.ts:56-63`) and re-checks before each run (`cpu-local.ts:149`). The invariant of M6-CP-1 (product <= physical cores) holds either way and refusal is the stricter reading. The default plan always holds the bound. The cost: a wrong host value stops the transcript of a session instead of running it with fewer threads | recommendation in 3.7 |
| D-76-3, where the spec fixes the constants | **Nowhere.** `grep -niE "nice|niceness|reserved core|setpriority"` over tx, specs, spec 05 and the test strategy: no hit. tx §0.2 only says `STT_MAX_THREADS` is "bounded"; specs §E.3 (`01_specs.md:367`) says "STT runs below capture priority" without a value. `CAPTURE_RESERVED_CORES = 2` and `STT_NICE = 10` are the driver's proposals; calibration is class C (C-7) | `cpu-priority.ts:19-21` |

### 3.3 Security

**Single key-loader (SEC35-14): PASS.** My own grep, independent of the static rule:

| Search | Result |
|---|---|
| `\.omlx|settings\.json|homedir|api_key` in `apps/transcriber/**/*.ts` | code that names or reads the file: only `src/key-loader.ts:62` (path) and `:79` (`readFileSync`). Other hits are comments, test fixtures with made-up keys, and the blanking patterns in `log.ts` |
| `authorization|bearer` in `apps/transcriber/**/*.ts` | header built only at `src/backends/omlx-http.ts:55`; text made only at `src/key-loader.ts:107`. Other hits are the blanking patterns and tests |
| `fetch(`, `process.env`, `console.`, `process.std*`, `spawn(`, `execFile`, imports of `http`/`net`/`child_process` | `fetch` only at `omlx-http.ts:51`; `spawn` only at `cpu-local.ts:104` (`shell: false`); `execFileSync('/usr/sbin/sysctl', ...)` at `host/physical-cores.ts:44`; `process.stderr.write` once, the log fallback, already blanked (`log.ts:118`); no environment read |
| `\.omlx` in the whole repository outside `docs/` (tracked and untracked) | outside `apps/transcriber` only two files, both comments: `apps/core-server/src/db/schema/stt.ts:13`, `packages/shared/src/api/transcription.ts:115`. No other reader exists |

**The key appears nowhere.** A script read the key into memory and searched by value (the key, its base64 form and its first 12 characters); it printed counts only.

| Searched | Files | Hits |
|---|---|---|
| `.cache/stt/checks/row76/` (driver and my evidence) | 13 | 0 |
| `.cache/stt/checks/row76_nav/` (my vitest outputs, start output, log backup) | 31 | 0 |
| `implementation/33_m6_transcriber_adapter.md`, `delegation_progress/coder_execution_row76.md` | 2 | 0 |
| all of `implementation/` and `delegation_progress/` | 178 | 0 |
| `apps/transcriber/`, `THIRD_PARTY_NOTICES.md`, `package-lock.json` | 32 | 0 |
| `ps` argv of the test runner and the server, sampled during the real oMLX run | 1 | 0 |
| environment of the real `whisper-cli` child (`ps eww`) | 1 | 0 |
| `~/.omlx/logs/omlx-serve.log` after the run | 1 | 0 |

Errors and logs (scratch test, a made-up key): a broken settings file gives `CREDENTIAL_UNAVAILABLE` / `NOT_JSON` with no file content in message, detail or stack; four other references (`auth.secret_key`, `auth`, `env:...`, `file:...`) give `CREDENTIAL_REF_UNSUPPORTED`; a transport that throws an error quoting the header leaves the key in neither the thrown error nor the log.

Two notes: the child inherits the whole environment of the parent process (finding N-6); value-based blanking misses a credential that contains a character JSON escapes (finding N-10). The current oMLX key has a plain character set (checked as a boolean only), so the second note does not bite today.

**Endpoint rule: PASS.** 39 candidate endpoints went through the adapter's own validation (`resolveTranscriberConfig` then `createOmlxHttp`) with a capturing transport. Every accepted one would connect to `127.0.0.1` or `localhost`. Full table: `.cache/stt/checks/row76_nav/nav_endpoint_probe.json`.

| Attempt | Verdict |
|---|---|
| `127.0.0.1.evil.example`, `localhost.evil.example`, `127.0.0.1.` , `localhost.` | refused |
| userinfo: `127.0.0.1@evil.example`, `127.0.0.1:8000@evil.example`, `user:pw@127.0.0.1` | refused |
| `[::ffff:127.0.0.1]`, `[::1]`, `2130706433`, `0x7f000001`, `0177.0.0.1`, `127.1`, `127.0.0.2`, `0.0.0.0` | refused |
| `LOCALHOST`, `HTTP://`, `https://`, leading space, newline or tab in the host or port, ideographic full stop | refused |
| port `0`, `65536` | refused |
| `#@evil` or `?@evil` right after the port | refused |
| `/#@evil.example`, `/?x=@evil.example`, `/\@evil.example`, `//evil.example`, `/../..`, tab or NUL in the path | accepted; host stays `127.0.0.1` (finding N-9: with `#` or `?` the request path is lost and the request goes to `/`) |
| `localhost` | accepted and passed to `fetch` as a name. On this host `dns.lookup('localhost', { all: true })` gives `::1` first, then `127.0.0.1` (finding N-8) |
| redirect | not followed. Two real listeners on random loopback ports: the first answered 307 to the second; the second received 0 requests; the adapter threw `UNREACHABLE`; the header reached the first listener only (`nav_redirect_probe.json`) |

**`cpu-local` command: PASS with one note.** No shell (`spawn(..., { shell: false })`, `cpu-local.ts:104`); arguments are an array.

| Model name tried | Verdict |
|---|---|
| `..`, `../outside`, `/etc/hosts`, `a/../b`, NUL inside, trailing newline, a space, 256 characters, empty | refused, `MODEL_NAME_INVALID` |
| `-ng`, `--help`, `-m`, `.hidden` | refused (the pattern needs a letter or digit first, `config.ts:84`) |
| a symlink inside the model directory that points outside it | **accepted and run** (finding N-7) |

Audio path: not confined to a directory (it comes from the pipeline, not from an operator). A path that looks like an option (`-ng`, `--help`) is passed as the value of `-f`, never as a flag; a prompt full of shell characters arrives as one argument after `--prompt` (argv recorded by the stand-in engine, `nav_audio_probe.json`).

### 3.4 Negative controls

| Control | Result |
|---|---|
| Driver's planted file (second reader of the key file, a header, a `console` call) | red: 3 tests fail, 3 rules named; green after removal |
| **My own planted file** (prints a token to `stderr`, a `console` call and a `fetch` on a line that has `//` inside a string, an `http` client with an unquoted `Authorization` key, `child_process` without the `node:` prefix, `process['env']`) | **zero rule violations.** Only the pinned file list failed. The same code added to an existing file would pass the whole static test (finding N-1) |
| 11 single-line violations through `scanSources` | 1 of 11 reported (`nav_static_probe.json`) |
| Wrong model path, real engine | `MODEL_NOT_FOUND`, no engine run |
| Corrupted fixture, real engine | provider refuses (`FIXTURE_CORRUPT`); the engine output on it differs (other hash, 3 segments) |

### 3.5 Real runs

Done once each; numbers in section 2. The direct invocation used the quoted argv with `-of` pointing into my scratch directory and gave the same bytes as the adapter run and as row 109.

### 3.6 Hygiene

| Check | Result |
|---|---|
| media or model files in git | `git status --porcelain --untracked-files=all | grep -icE "\.(mp4|m4a|aac|mp3|wav|mov|mkv|bin|gguf|onnx|safetensors)$"` gives 0 |
| hand-made symlink | `node_modules/@dems/transcriber -> ../../apps/transcriber`, the same relative form as the six other workspace links |
| lockfile | `git diff HEAD -- package-lock.json`: 35 added lines, 0 removed. 18 belong to this row (the `apps/transcriber` block and its `"link": true` entry); the other 17 are the `capture-protocol` workspace of another row. All are workspace or link lines; no version of an existing package changed |
| listener or child left behind | port 8000: no listener; no `whisper-cli`, no `omlx serve`. The `vitest --project db` processes still running belong to another row |
| work directory | `.cache/stt/checks/row76/work/` is empty (output files removed) |
| figures (D230) | the two row documents: no throughput or speed figure. **One finding (N-4):** the driver's evidence file `omlx-serve.row76.excerpt.log` keeps two server lines that state how long a transcription and a synthesis took. The same kind of line is inside the two server-log backups (the driver's and mine) |

### 3.7 Driver's open items — recommended owner and ruling

| Item | What I found | Recommendation |
|---|---|---|
| D-76-1, model = file name in a host model directory | The idea is sound and consistent with "model path from config only". **It does not fit row 113 as written:** the seeded default is `model: 'ggml-large-v3-turbo'` (`packages/shared/src/api/transcription.ts:500`, used by `apps/core-server/src/db/seed/seed.ts`), but the file on disk is `ggml-large-v3-turbo.bin` (`test -f .cache/stt/models/ggml-large-v3-turbo` exits 1). With the seeded row the first `cpu-local` session would end in `MODEL_NOT_FOUND`. Also op 91 accepts any trimmed text up to 255 characters (`transcription.ts:244`), while the transcriber accepts only `^[A-Za-z0-9][A-Za-z0-9._-]{0,254}$` (`config.ts:84`, applied to both backends at `:114`), so a value op 91 stores can be refused at session start | **Controller ruling, then the row-113 fix round or row 115.** Pick one: (a) the stored value is the file name, so the seed becomes `ggml-large-v3-turbo.bin`; or (b) the stored value is an id and the transcriber maps it to a file. Put one model pattern in `packages/shared` and use it in op 91 and in the transcriber. Row 117 shows the same rule |
| D-76-2, refuse instead of clamp | see 3.2 | **Accept.** Controller records an erratum to tx §C ("refuses at configuration time; the default plan always holds the bound"). Row 115 must resolve the configuration in the boot check, so a wrong host value fails the boot and not the first session |
| D-76-3, the two constants | not fixed by any spec | Keep as proposals; add both to tx §0.2 as PROPOSAL rows; calibration stays class C |
| D-76-5, phantom tail not clamped | Reproduced: the last server segment runs from 65.54 to 95.52 on a 65.72 s file. Its text repeats the segment before it, its `avgLogprob` is not low and its `noSpeechProb` is near zero, so the QA gate of tx §A.3 would not catch it. Row 77's text covers the clamp only by reference ("tx §A.1-§A.3"; the clamp is in the §A.3 failure row); its Verification cell names no clamp check | **Row 77 owns it.** Controller adds one explicit assertion to row 77: on the sealed fixture through `omlx-server`, no assembled segment ends after the container duration, and the remainder of a clamped tail that repeats the previous text is dropped. `chunk.durationMs` is already carried for this |
| D-76-6, loader accepts only `omlx-settings:auth.api_key` | Correct and already decided: blueprint row 115 says it "treats a stored `ENCRYPTED` kind as unavailable until row 84" (`identification/02_structured.md:74`, `:304`; D68(c)) | **Accept.** Row 84 builds the store; the loader branch is added inside `key-loader.ts` after it. Fix N-10 before that branch exists |
| SH-09 not closed | SH-09 is "Dataset: service list (worker, transcription health); v2 or legacy items per OD-02", file `packages/shared/src/sim/dataset.ts` (`research/03_analysis.md:137`). Today `CORE_SERVICES` has 16 names and none for the transcriber (`dataset.ts:168-185`). Rows 49, 51, 76, 77 and 78 all list it | **Row 78** (the last M6 row that lists it, when the transcript health states exist), after the row-113 fix round frees `packages/shared`. Controller records the move in the Drift Log (report §0 rule 2) |
| CS-22 | only the transcriber half exists (`checkCpuLocalFiles`, `cpu-local.ts:77`); no boot step | Row 115, as the driver proposes |
| DOC-05 partial | 5 of the 15 components of tx §F are in `THIRD_PARTY_NOTICES.md` (whisper.cpp, ggml, turbo weights, oMLX, OmniVoice); these are the ones this row uses | Accept; rows 77 and 78 add Silero VAD and the sherpa-onnx entries |
| W1-C5 | no diarization code in this row, nothing to close | Row 78 |
| `generate()` not run for all 13 turns with voice cloning | **Not required.** The row's Verification cell does not ask for it; M6-AD-1 says "`TtsFixtureProvider` produces the fixture" and tx §B.6 says test runs must reuse the sealed bytes. `provide()` does that and is proven on the real file. `generate()` is unit-tested and one real turn was synthesised | No action unless a new fixture is wanted |

### 3.8 Time base

Nothing in `apps/transcriber` assumes a time origin. `grep -rnE "1024|48000|priming|offsetMs|delay_moov"` over `src/` (tests excluded) finds only the declaration of `offsetMs` (`types.ts:34`, "carried, never applied") and a log size. Segment `start`/`end` are seconds relative to the chunk; no priming constant exists. So nothing here can disagree with row 58 yet.

What row 77 must take from row 58:

1. **One value for "media time of tap sample 0".** Under the pinned mux flags it is 1024/48000 s (file time 0 = T0 minus the AAC priming, spec 05 §F "File time 0", erratum PE-111; tx §A.2 pointer); it is 0 if row 58 adopts `delay_moov`. Row 58 decides and exports it as one named constant in a shared package; row 77 imports it and never writes the number itself.
2. **Which audio it chunks**: the PCM tap (sample index from T0, needs the constant) or the decoded `AUDIO-01` file (already in file time, needs no offset). The chunk `offsetMs` must be stated in media time of the sealed file.
3. A test with a known offset that fails when the constant is wrong (report §0 rule 3).

Also for row 77: engine times are floats (the tail above ends at `95.52000000000001`), so the conversion to integer milliseconds must round.

## 4. Findings

| ID | Severity | File:line | Evidence | Suggested fix |
|---|---|---|---|---|
| N-1 | major | `apps/transcriber/src/__tests__/static-rules.ts:28`, `:49`, `:54`, `:58`, `:61`, `:65`; `static.test.ts:60-62` | A planted file with six violations gave zero rule hits (section 3.4). Causes: `stripComments` removes everything after `//` even inside a string, so code later on that line is invisible; the header rule needs quotes around `Authorization`; the listen, process and environment rules match only the `node:` prefix or the dotted form; printing to `stderr` is not restricted to `log.ts` | Strip comments with a tokenizer (or the TypeScript scanner) instead of a regular expression; match imports of `http`, `https`, `net`, `tls`, `dgram`, `http2`, `child_process` with and without `node:`; match `Authorization` as a property name too; match `process` followed by `.env` or `['env']`; allow `process.stderr` in `log.ts` only. Add each of my eleven cases as a planted case |
| N-2 | major | `packages/shared/src/api/transcription.ts:500`, `:244`; `apps/transcriber/src/config.ts:84`, `:105-108`, `:114` | seeded model `ggml-large-v3-turbo` is not a file in the model directory; op 91 and the transcriber validate the model differently (section 3.7) | Controller ruling on D-76-1, one shared pattern, seed aligned; a test that resolves the seeded row against the real model directory |
| N-3 | major (scope) | `identification/02_structured.md:265` (row 76 "closes" list) | SH-09 not touched; CS-22 half; W1-C5 nothing; DOC-05 5 of 15. Stated plainly by the driver | Controller re-assigns as in 3.7 and records it in the Drift Log |
| N-4 | minor, fix required | `.cache/stt/checks/row76/omlx-serve.row76.excerpt.log` lines 3 and 7; the two `omlx-serve.log.bak-*` files | two server lines per run state a processing time (D230: no figure in evidence); `grep -cE "done: .*[0-9.]+s,"` gives 2, 1 and 2 | Remove those two lines from the excerpt (the GPU line is the only one needed). Never cite the backups; they exist only because the start script truncates the log |
| N-5 | minor | `apps/transcriber/test/real/cpu-local.real.test.ts:77`; `src/__tests__/cpu-priority.test.ts:110-118`; `src/backends/cpu-local.ts:116-125` | niceness not asserted in the real run; unit assertion passes on both branches; applied after start; per-thread on Linux | Assert `run.nice === STT_NICE` in the real test and read the value back with `getPriority(pid)`; make the unit test fail when the host allows the call and the value is not 10; for the Core, start the engine already lowered (for example through the `nice` program, without a shell) and prove it on Linux in row 77 |
| N-6 | minor | `apps/transcriber/src/backends/cpu-local.ts:104` | no `env` option: the engine inherits every variable of the Core process (variable names with KEY/TOKEN were present in the child during my run; the oMLX key was not) | pass a minimal environment (`PATH`, `HOME`, locale) |
| N-7 | minor | `apps/transcriber/src/config.ts:105-108`; `backends/cpu-local.ts:85-86` | a symlink in the model directory that points outside is followed | compare `realpathSync` of the model file with the real path of the model directory, or refuse a symlink (`lstatSync`) |
| N-8 | minor (hand to row 115) | `apps/transcriber/src/backends/omlx-http.ts:50-61` | `localhost` is passed to `fetch` as a name; it resolves to `::1` first on this host. Row 115 requires "connects `localhost` as 127.0.0.1" and "never sends the bearer key to an arbitrary loopback port" (`identification/02_structured.md:304`) | rewrite the host to `127.0.0.1` in the HTTP client; row 115 adds the port rule |
| N-9 | minor | `packages/shared/src/api/transcription.ts:108` (pattern); `apps/transcriber/src/config.ts:140` | an endpoint with `#` or `?` in its path is accepted and the request path is lost | refuse `#` and `?` in the endpoint (shared pattern, row 113's file) or build the URL with `new URL` and check its parts |
| N-10 | minor | `apps/transcriber/src/log.ts:79`; `key-loader.ts:111-116` | blanking by value runs on the JSON text, so a credential with `"`, `\` or a non-ASCII character is not blanked (`nav_key_probe.json`: `escapedCredentialSurvivesBlanking: true`, made-up value) | also blank the JSON-escaped form of each protected credential; add the case to `key-loader.test.ts` |
| N-11 | minor | `apps/transcriber/src/types.ts:80-92`; `test/real/shape.real.test.ts` | the shape comparison cannot differ for two schema-valid results | say in the report that the proof is the strict schema; or compare full key sets and state the allowed difference (QA keys) explicitly |
| N-12 | minor | `apps/transcriber/src/cpu-priority.ts:56-63` against tx §C | refuse instead of clamp (D-76-2) | erratum to tx §C; boot-time resolve in row 115 |
| N-13 | minor | `apps/transcriber/src/backends/omlx-server.ts:88`; `cpu-local.ts:169` | PCM chunks are not checked to be 16000 Hz; `durationMs` is carried and unused | refuse a PCM chunk with another rate |
| N-14 | info | `apps/transcriber/test/real/real-support.ts:12` | a re-run overwrites the previous evidence files | write each run into a directory named by the caller |

## 5. Decisions for the controller to record

1. Verdict ACCEPT-WITH-FINDINGS for row 76; N-1 fixed by the driver in a fix round (static rule), N-4 fixed by removing two lines from one evidence file.
2. Ruling on D-76-1 (N-2) before row 115 starts; owner of the shared change: the row-113 fix round.
3. D-76-2 accepted with an erratum to tx §C; D-76-3 kept as proposals in tx §0.2.
4. D-76-5: explicit clamp assertion added to row 77's Verification cell.
5. D-76-6: accepted (already in row 115 through D68(c)); row 84 then the loader branch.
6. SH-09 to row 78, CS-22 boot step to row 115, W1-C5 to row 78, DOC-05 remainder to rows 77 and 78; all four in the Drift Log.
7. Row 58 exports the one media-time constant; row 77 imports it (section 3.8).

## 6. What I did not check

- Linux behaviour of the niceness call and of `/proc/cpuinfo` counting on the real Core (no Linux host here).
- `generate()` for all 13 turns with voice cloning (not required, section 3.7).
- The `shared` and `core-server` baseline suites of the driver's section 8 (other rows' fix rounds are editing those trees now; a count taken today would not be this row's).
- The file log on disk under rotation in a real Core process (row 115 passes the directory).

## 7. Files

Created: `docs/2026-10-07_dems_real_capture_sealing/delegation_progress/pair_76_navigator.md` (this file).
Not edited: `masterplan/02_plan.md`, `status_tasks.md`, `delegation_progress_report.md`, any file under `apps/` or `packages/`.
Git-ignored scratch: `.cache/stt/checks/row76_nav/` (probe results `nav_*.json`, `ps_distinct.txt`, direct engine output, oMLX times and log backup, a copy of the driver's evidence).

---
*Generated: 2026-10-09 11:20 (+07:00)*

---

# Re-check of fix round 1 — 2026-10-09

Reviewed: the driver's "Fix round 1" (`implementation/33_m6_transcriber_adapter.md` F1-F11) and the code as committed in `101ce62` (34 files under `apps/transcriber`). Same rules as before: report only; my scratch test (`apps/transcriber/test/real/nav2-scratch.real.test.ts`) is deleted and was never committed (`git ls-files | grep -iE "nav2|nav-scratch"`: no hit); the oMLX key was never read or printed in this round. Probe results: `.cache/stt/checks/row76_nav/fix1/` (git-ignored).

## R1. Final verdict for row 76

**ACCEPT-WITH-FINDINGS.** All fourteen findings of the first review are fixed or correctly handed over, and each fix is covered by a test that goes red when the fix is removed. One new finding (R-1, major) must be fixed before any row runs `cpu-local` from a Core process; four small residuals are listed with their heirs in R5.

| New finding | One line |
|---|---|
| **R-1 (major)** | `nice -n 10` ADDS 10 to the niceness of the starting process, but the host probe demands exactly 10. A Core that is itself not at niceness 0 gets `PRIORITY_NOT_APPLIED` for every transcription. This happened to my first real run |

## R2. Suites, re-run by me

| Check | Driver | Navigator | Same |
|---|---|---|---|
| typecheck / lint | exit 0 / 0 | exit 0 / 0 | yes |
| transcriber suite, inside the sandbox | 8 files, 239 passed, 1 skipped | 8 files, 239 passed, 1 skipped (skipped: the "host lowers priorities" block) | yes |
| transcriber suite, outside the sandbox | 239 passed, 1 skipped | 239 passed, 1 skipped (skipped: the "host forbids it" block) | yes |
| `M6-AD-1` / `M6-CP-1` named tests | 11 / 20 | 11 / 20 | yes |
| static rule test | 82 passed | 82 passed | yes |
| mutation script, outside the sandbox | 12 of 13 red | 12 of 13 red; not red: "N-5 required mode refuses" | yes |
| mutation script, inside the sandbox | that line is red there | red there (failed 1); "N-5 started through nice" is NOT red there | yes |
| core-server static guards | 13 files, 137 passed | 13 files, 137 passed | yes |
| `cpu-local` real run, seeded id | 5 passed, `6039a944…cab94439`, 3717 B, 14 segments | 5 passed, `6039a9447ed165b94d01cfff94ae7c4d17e034f2366e4af4c0c0d4e7cab94439`, 3717 B, 14 segments, model id `ggml-large-v3-turbo`, cut-fixture control `5d09469d…060b5e41` with 3 segments | yes |
| `Host` probe | received `127.0.0.1:<port>` | `{"status":200,"sentHost":"localhost:<port>","receivedHost":"127.0.0.1:<port>","remote":"127.0.0.1"}` | yes |
| real `omlx-server` run | 7 passed | **not re-run** (see R3.7) | — |

The mutation script writes its result over the driver's `fix1/mutation-red.json`; I saved the driver's file first and put it back (same SHA-256 before and after). My results: `row76_nav/fix1/nav_mutation-red.json` and `nav_mutation-red_in_sandbox.json`.

## R3. The eight items

### R3.1 N-1, static rule on the compiler API — fixed; residual acceptable, three cheap additions recommended

My six violations of round 0, fed as one source text: all reported (`AUTHORIZATION_HEADER_ONLY_IN_HTTP_CLIENT`, `NO_CONSOLE`, `STDERR_ONLY_IN_LOG`, `FETCH_ONLY_IN_HTTP_CLIENT`, `NO_NETWORK_MODULE`, `NO_ENVIRONMENT_READ`, `CHILD_PROCESS_ONLY_IN_ENGINE_MODULES`, `NO_SHELL`). The same lines appended to the real `src/log.ts` are reported too. The five real production files alone give no violation.

39 new evasions (`nav2_static_probe.json`):

| Group | Cases | Result |
|---|---|---|
| Caught | namespace import, `require`, dynamic `import()` with fixed, folded and variable text, re-export, `const { env } = process`, `globalThis.process.env`, computed header key `['Author' + 'ization']`, header name held in a variable built with `+`, template settings path, `fs/promises` reader of a template path, `String.raw` path, console alias, console destructured, `globalThis['pro' + 'cess']['en' + 'v']`, `fetch` by folded bracket, `stderr` destructured, `os['home' + 'dir']()`, `new Function`, `spawn('/bin/sh', ['-c', …])` | 21 of 21 reported |
| Not caught, built at run time | header name by `[...].join('')` or from base64; settings path from character codes or `[...].join`; `process[key]` with a variable key; `globalThis[name]` with a variable name; `Object.entries(process)`; a path inside a regular-expression literal | **acceptable residual.** No static reading can follow a value made at run time; the rule file says so. A reviewer sees such code at once |
| Not caught, plain code | (a) `const p = process; p.env.X` and `Reflect.get(process, 'env')`; (b) `createRequire(import.meta.url)('http')` and `process.mainModule.require('http')`; (c) `writeSync(1, token)` / `writeSync(2, token)`, `process.emitWarning(token)`; (d) `node:inspector` `open()` (a listening port) | **minor, R-2.** These are ordinary one-liners, not obfuscation. Cheap to close: report `process` used as a value (anything but the object of a member access); add `module` and `inspector` to the module rules; report `writeSync`/`write` with a numeric first argument 1 or 2 outside `log.ts` |
| Not caught, by nature | `throw new Error(headerValue)` | acceptable; the thrown text is what the log blanks |

### R3.2 N-2 and N-7, model identifier — fixed

`config.ts:138` and `:145` call `isSttModelId` from `@dems/shared/api`; no local pattern is left in `apps/transcriber/src` (grep: only the two calls and a comment). 32 attacks through the adapter with the stand-in engine (`nav2_model_probe.json`):

| Attack | Result |
|---|---|
| id ending `.bin`, `.BIN`, `.Bin` | refused, `MODEL_ID_INVALID`, both backends |
| `..`, `a..b`, `../x`, `/`, `\`, absolute path, leading `-` or `.`, NUL, newline, leading or trailing space, empty, 129 characters, non-ASCII | refused, both backends |
| 128 characters; `x.bin.bak`; `x.bin.` (trailing dot) | accepted as ids; no such file, `MODEL_NOT_FOUND`, no engine |
| `<id>.bin` is a link to a file outside the directory | `MODEL_OUTSIDE_MODEL_DIR`, no engine |
| link into a sibling directory whose name starts like the model directory | `MODEL_OUTSIDE_MODEL_DIR` |
| `<id>.bin` is a directory | `MODEL_NOT_FOUND` |
| link that stays inside | runs |
| the model DIRECTORY itself is a link to a real directory | runs; a link out of it is still refused. Acceptable: the directory is host configuration, and both paths are resolved before they are compared (`cpu-local.ts:150`) |

Shared validator and transcriber agree on every candidate. Note for row 115: on this Mac the file system ignores case, so the id `MODEL-OK` opens `model-ok.bin`; on the Linux Core it will not.

### R3.3 N-5, niceness — fixed at niceness 0; new finding R-1

Mechanism: `spawn(config.nicePath, ['-n', '10', binary, …], { shell: false, env: ENGINE_ENVIRONMENT })` (`cpu-local.ts:195`). My own observation in the one real run (a `ps -Ao pid,ppid,ni,comm,args` loop in a separate shell job): the engine process shows `ni=10` in its first sample and in every later one, for both engine processes of the test file; no sample at another value. SHA and segments as in R2, with the seeded default id.

Modes, as described: inside the sandbox `required` starts no engine and `best-effort` runs with a `warn` (the "host forbids" block, passing); outside it the engine observes 10 in both modes.

**R-1 (major).** `nice -n 10` is an increment. Measured:

```
foreground:          own=0  through nice -n 10 = 10
zsh background job:  own=5  through nice -n 10 = 15
started at 12:       through nice -n 10 = 20
```

`hostLowersPriority` accepts only the text `10` (`cpu-local.ts:84`). So when the process that hosts the transcriber is not at niceness 0, the probe answers false and the default mode refuses every transcription, although the engine would run lower than asked. It happened here: I first started the real test as a zsh background job (zsh lowers those by 5); result `PRIORITY_NOT_APPLIED`, 2 of 5 tests failed, no engine started (`row76_nav/fix1/cpu_real_vitest_attempt1_bgnice_refused.out`; the empty run directory `runs/20261009T044010521Z-8142-cpu-local/` is from that attempt). Run in the foreground it passed. A Core started by a script with `&`, or a service with a niceness setting (also a negative one, to favour capture), meets the same refusal. The same test for exactly 10 is in the unit helper (`src/__tests__/support.ts:25-28`) and in the real test (`cpu-local.real.test.ts:96`).

Fix: compare with the niceness of the host process. The probe passes when the value it reports is higher than `os.getPriority()` of the parent (or equals parent + 10, capped at the system maximum); record the observed value in `EngineRunRecord.nice`; add a test that starts the suite's stand-in from a parent at niceness 5.

**The complementary-skip design.** Sound, on one condition. Sound because the selector is an independent question to the operating system, the third test fails if neither or both blocks ran, and a product that stopped using `nice` fails the "host lowers" block. The condition: inside the sandbox the strong block never runs, and there the mutation "started through nice removed" stays green (my in-sandbox mutation run shows exactly that). So a green suite proves the niceness only when the skipped test is the "host forbids" one. The gate run must be made outside the sandbox and must show that name as the skipped one; I recommend the suite print which block ran, or a gate script assert it. With R-1 the same hiding can also happen outside a sandbox (a parent at niceness 5 selects the weak block).

Linux per-thread niceness stays unproven; the driver says so and puts it in the class-C pack. Agreed.

### R3.4 N-6, N-9, N-10, N-11, N-13, N-14

| Finding | Result | Evidence |
|---|---|---|
| N-6 environment | **fixed.** The real `whisper-cli` child holds exactly `PATH=/usr/bin:/bin`, `LANG=C`, `LC_ALL=C` (`ps eww` on the running engine; names listed, then the capture deleted). The stand-in engine sees the same three plus `__CF_USER_TEXT_ENCODING`, which macOS adds | my real run; `nav2_model_probe.json` `.env` |
| N-9 endpoint | **fixed locally.** `?`, `#`, backslash, space, tab, NUL, DEL, no-break space: refused by `assertLoopbackEndpoint` (`config.ts:115-127`), by the configuration and by the HTTP client; a plain path prefix keeps the request path. Difference to the shared validator: R3.8 | `nav2_endpoint_probe.json` |
| N-10 blanking | **fixed for the stated forms.** By value, plain key: raw, JSON once, twice and three times, URL-encoded (also `+` for space, lower-case hex, double), base64 with and without padding, base64url: all blanked. Awkward key (quote, backslash, non-ASCII, tab, `+/=&`): raw, JSON once and twice, URL-encoded, base64 blanked. By position without any protected value (`Bearer`, a credential-named member, nested JSON): blanked by the shared rule set | `nav2_blanking_probe.json` |
| N-10 residual | not blanked by value, both keys: **hex** (also upper case and the spaced form a buffer dump prints), base64 of `Bearer <key>` or `user:<key>`. Awkward key only: JSON three times, lower-case-hex URL encoding, double URL encoding, base64 without padding, base64url. Also, by nature: reversed, upper-cased, half a key | **acceptable residual, R-3 (minor).** Blanking by value cannot cover every encoding. The key in use today has a plain character set, so only hex and the two embedded base64 forms apply to it. Add hex and unpadded/url-safe base64 when the `ENCRYPTED` branch arrives (arbitrary secrets) |
| N-11 shape | **fixed.** `documentShape` is gone; `resultShape` returns the union of segment keys (`types.ts:89-93`) and differs on the real results (4 keys against 10); the proof is the strict schema, shown rejecting. Mutation red | R2 |
| N-13 audio | **fixed.** Mutation: 10 tests red when the check is removed | R2 |
| N-14 run directories | **fixed.** Same stamp and kind twice: `EEXIST`; second write of a file: `EEXIST`, first content kept. Info only: `writeEvidence` joins the name without a check, so a name with `../` writes outside the run directory (test-side helper, constant names today) | `nav2_rundir_probe.json` |

### R3.5 N-4 / D230 — clean; keep the two backups, do not cite them

Grep over all 32 non-audio files of `.cache/stt/checks/row76/` (with `runs/` and `fix1/`) for a number with a time unit, `rtf`, `wer`, throughput, tokens per second, elapsed, `Duration`, timing lines:

| Where | Hits |
|---|---|
| the rewritten excerpt and the two excerpts under `runs/` | 0; no clock time and no duration left on any line |
| every evidence JSON, old and under `runs/` | 0; no sample count (`grep -E "[sS]amples?\"?: ?[0-9]"`: only `bitsPerSample`) |
| `fix1/red_static_old_engine.txt` line 629 | 1: the test runner's own `Duration` line of a static unit test. Not an engine figure; delete the line for tidiness |
| `omlx-serve.log.bak-20261009T105413`, `fix1/omlx-serve.log.bak-20261009T113252` | 2 and 3: the server's own timing lines |
| the two row documents | no throughput or speed figure. They hold clock times of the oMLX start/stop log (required by D7(d)) and "Up for 25 seconds" (how long the shared server was up, not an engine speed) |

Removing the `ps` sample counts was the right call: a count taken at a fixed interval is a duration. I did the same to my own first report (the counts are replaced by "every sample") and reduced my sample file to its distinct lines.

**Backups: keep, cite nowhere.** They are the only copy of the part of the shared service's log that the start script truncated; they are git-ignored and quoted in no document. Deleting them cannot be undone and nobody asked for it (red line on deletions). Recommendation for the controller: record in the decision log that the `omlx-serve.log.bak-*` files (the driver's two and my one under `row76_nav/`) are restore copies and not evidence, and let the user decide at handover whether they go. If the controller wants them out of the evidence tree sooner, that is the user's deletion to approve.

D-76-11 (run directories named by a UTC stamp): accepted; a clock time of a check is not an engine figure.

### R3.6 N-8 / D-76-8 — confirmed

| Check | Result |
|---|---|
| requested address, capturing transport | `http://localhost:8000` → `http://127.0.0.1:8000/v1/models`; `http://localhost` → `http://127.0.0.1/v1/models`; with a path prefix the prefix is kept |
| real `fetch`, listener bound to `127.0.0.1` only, endpoint `http://localhost:<port>` | status 200; the server saw `Host: 127.0.0.1:<port>`, remote `127.0.0.1`, the header present |
| real `fetch`, listener bound to `::1` only, same endpoint form | `UNREACHABLE` / `ECONNREFUSED`, 0 requests: the name is never resolved, so the first address of this host for `localhost` (`::1`) is never tried |
| driver's probe | caller set `Host: localhost:<port>`, server received `127.0.0.1:<port>` |

The name `localhost` never reaches DNS: the text handed to `fetch` holds the address literal. The ruling ACCEPTED (no custom dispatcher, no `node:http` client) fits the measured behaviour. Left for row 115: "never sends the bearer key to an arbitrary loopback port" (the client still sends the header to whatever loopback port the stored endpoint names).

### R3.7 Real `omlx-server` run — not repeated

Nothing in this round needs it again. The request the server receives changed in one respect only, the address for `localhost`, which I proved with a real `fetch` against scratch listeners (R3.6); the default test endpoint is `http://127.0.0.1:8000` and is untouched by the rewrite. Model id, credential path, form members and parsing are covered by the 239 unit tests and the mutation runs. The driver's own real run after the change is in `runs/20261009T043256807Z-2868-omlx-server/` with the row-12 hash. Port 8000 had no listener before and after my work; `omlx serve` was never started by me in this round; the content hash of `~/.omlx/settings.json` still begins `334d13f7a322`.

### R3.8 The two endpoint validators — what differs now

Shared (`packages/shared/src/api/transcription.ts:108`, unchanged): `^http://(127\.0\.0\.1|localhost)(:[0-9]{1,5})?(/.*)?$`, at most 512 characters, port 1 to 65535. Transcriber: the shared check first, then two more (`config.ts:120`, `:124`).

| Endpoint (after the port) | Shared, so op 91 and the table CHECK | Transcriber |
|---|---|---|
| `/?x=1`, `/a?b` | accepted | refused, `ENDPOINT_HAS_QUERY_OR_FRAGMENT` |
| `/#f`, `/a#b` | accepted | refused, same reason |
| `/\@evil.example` (backslash) | accepted | refused, `ENDPOINT_MALFORMED` |
| `/a b` (space), tab, NUL, DEL, no-break space in the path | accepted | refused, `ENDPOINT_MALFORMED` |
| line separator U+2028, newline | refused | refused |
| `/%3Fx`, `/%23`, `/%5C`, `//x`, `/..`, `/@x`, `/;x`, port `00080` | accepted | accepted |
| any host but the two, user part, upper case, IPv6 | refused | refused |

So an operator can store ten kinds of endpoint through op 91 that the transcriber refuses at session start (of my 29 candidates 14 are accepted by both, 10 by the shared one only, 5 by neither). No security gap: the stricter side is the one that connects. It is a consistency gap: op 91 answers 200 and the next session has no transcript. The driver is right that the three refusals belong in `STT_LOOPBACK_ENDPOINT_PATTERN` (and in the table CHECK, which mirrors it). Owner: row 113, whose re-check is in flight; I edited nothing there.

## R4. Status of the first review's findings

| ID | Status after fix round 1 |
|---|---|
| N-1 | fixed; residual R-2 |
| N-2 | fixed (controller ruling: identifier, `<id>.bin`, one shared pattern) |
| N-3 | not the driver's; re-assignment recorded by the controller |
| N-4 | fixed; backups kept by design (R3.5) |
| N-5 | fixed at niceness 0; **R-1 open**; Linux part is class C |
| N-6 | fixed |
| N-7 | fixed |
| N-8 | fixed; D-76-8 accepted |
| N-9 | fixed in the transcriber; shared pattern is row 113's (R3.8) |
| N-10 | fixed; residual R-3 |
| N-11 | fixed |
| N-12 | not the driver's; erratum by the controller |
| N-13 | fixed |
| N-14 | fixed |

## R5. Who inherits what

| Item | Severity | Heir |
|---|---|---|
| R-1 niceness compared with exactly 10 instead of with the host process (`cpu-local.ts:75-88`, `support.ts:25-28`, `cpu-local.real.test.ts:96`) | major | **row 76 driver, a short fix round 2**, or row 77 as its first step (row 77 also lists M6-CP-1). In either case before row 115 mounts the transcriber and before any `cpu-local` run from a Core process |
| The gate run of the suite is made outside the sandbox and shows "host forbids it" as the skipped test | condition | every row that quotes the transcriber suite as proof of M6-CP-1 (77, 115) |
| R-2 static rule: `process` as a value, `module`/`createRequire`, `inspector`, writes to descriptor 1 or 2 | minor | row 77 (it adds files to this workspace and will touch the pinned file list anyway) |
| R-3 blanking by value: hex, unpadded and url-safe base64 | minor | the row that adds the `ENCRYPTED` loader branch (after row 84) |
| Shared endpoint pattern and table CHECK take the `?` / `#` / stray-character refusals | minor | row 113 |
| "never sends the bearer key to an arbitrary loopback port"; id case on a case-sensitive file system; boot-time resolve of the configuration | — | row 115 |
| Linux: per-thread niceness through `nice`, `/proc/cpuinfo` counting | class C | class-C pack (real Core device) |
| Clamp of the phantom tail; the media-time constant from row 58 | — | row 77 (unchanged from section 3.7 and 3.8) |
| `omlx-serve.log.bak-*` files: restore copies, not evidence; keep or delete | decision | controller records; the user decides at handover |
| `fix1/red_static_old_engine.txt` line 629 (test runner duration line) | tidy | row 76 driver |

## R6. Files of the re-check

Updated: this file (section appended; in the first report the `ps` sample counts were replaced by "every sample", for D230).
Not edited: anything under `apps/`, `packages/`, `masterplan/`, `status_tasks.md`, `delegation_progress_report.md`.
Git-ignored scratch: `.cache/stt/checks/row76_nav/fix1/` (`nav2_*.json`, the two real-run outputs, my mutation results, the driver's mutation result as I found it). Left in the driver's tree by my runs: two new run directories under `.cache/stt/checks/row76/runs/` (`…044010521Z-8142-cpu-local`, the refused attempt; `…044043136Z-8333-cpu-local`, the passing run).

---
*Re-check appended: 2026-10-09 11:55 (+07:00)*
