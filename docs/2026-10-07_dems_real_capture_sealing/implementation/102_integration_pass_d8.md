---
task_id: 2026-10-07_dems_real_capture_sealing
row: integration pass D8 (what row 71c could not land; decision D157)
date: 2026-10-10
agent: coder-execution
baseline: e296ce7 + the uncommitted wave D tree
status: needs-review
tier: 3
---

# Integration pass D8 — STT model provenance, boot-time notice listener, failed-start keys

Paths below `apps/core-server/`. No commit, no migration (`[5, 'dbc-6']`), no lockfile write, no new dependency. `.data/pg*.env` not read. **The STT server on 127.0.0.1:8000 was not called, started or configured; no key was read; no model was downloaded or loaded** (one 48-byte header read of `.cache/stt/models/ggml-large-v3-turbo.bin` to check the header layout: magic `0x67676d6c`, `ftype` 1). No figure of how long anything took is written (D230). Each check was run once after its last change; repeats only after a fail (named in section 3).

## 1. Per item

| # | Item | State | What | Where |
|--|--|--|--|--|
| 1 | Model provenance (fields 84-87) | **done for `cpu-local`, with one decision open (version)**; `omlx-server` stays PARTIAL by ruling | Production provider behind row 71c's port; the port now answers a CODE when a member has no source | NEW `src/transcription/model-provenance.ts` (`:128` provider, `:100` header rule); `host.ts:64`, `:92` (`cpuLocal.modelVersions`); `session-run.ts:271-278`, `:368`; `index.ts:375-387` |
| 2 | Boot-time notice listener | **done** | The unit's own registration `registerCaptureNotices(app)` adds ONE `onReady` hook that attaches the session-start listener; the first-use attach is removed | `src/capture-notices/index.ts:235` (`:127` attach); called at `src/modules/capture-inputs/index.ts:37` |
| 3 | Failed-start keys | **forwarder half done and proven; the stored half waits for pass D6** | The raise of the supervisor fault carries `reason` + `evidenceFiles: 0` | `src/capture/forwarder.ts:83`, `:274`, `:302`, `:310` |
| 4 | D-71c-2 (no snapshot) | **not done: one condition in `capture-session/index.ts` (closed, not this pass's area)** | Request filed with the exact line and test; erratum sentence below | `delegation_progress/file_requests.md` |
| 5 | `codec` | **not done: no protocol change needed, two files outside this pass's area** | Request filed (sample entry of the init segment) | same |

### Item 1 — where each member comes from (ruled from the spec)

Spec lines: `06_evidence_package_spec.md:312-315` (fields 84-87, all "string / hex64, not null", source "transcriber adapter"); `07_transcript_spec.md:233` ("the model file's sha256 is recorded"), `:230` (tiers "q5_0/q8_0"), `:242` / `:274` (the Core requires the model files of the configured backend), §B.4 (`omlx-server` = "development + functional verification only"); `04_database_contract.md:415` (`transcripts.model`: "name, version, quantisation, params, model-file hash").

| Member | `cpu-local` | `omlx-server` |
|--|--|--|
| 84 name | the adapter's model identifier (= the session snapshot) | same |
| 85 version | **the host file**: `cpuLocal.modelVersions[<model id>]` (NEW optional member, decision 1). Not stated -> `MODEL_VERSION_NOT_STATED` | no source |
| 86 quantisation | the model file's own ggml header (`ftype`: `f16`, `q5_0`, `q8_0` ...); not ggml -> `MODEL_FILE_NOT_GGML`; unnamed type -> `MODEL_QUANTISATION_UNKNOWN` | no source |
| 87 SHA-256 | the Core hashes `<modelDir>/<id>.bin` (the path the adapter gives the engine); once per file and process, again when the file changes; unreadable -> `MODEL_FILE_UNREADABLE` | no source -> `MODEL_PROVENANCE_NO_SOURCE_FOR_BACKEND` |

**The strict schema allows no "not reported" value**: with a document all four are required (`packages/shared/src/evidence-package/manifest.ts:172-177` nullable only in the no-document shapes; `sealing/finalize-transcript/handler.ts:203-214`; `apps/transcriber/src/pipeline/document.ts:60-65` `min(1)` / hex64). Nothing was faked and no schema was edited: **a session with a member missing still seals `PARTIAL` without a document, `TRANSCRIPT_UNAVAILABLE_AT_SEAL`, at once; the missing member is named** by the code above in `availability`, the log and the error log (the seal's step writes it as `cause`, `sealing-host/transcript-step.ts`, unchanged).

**This installation today:** `.data/transcriber/host.json` does not exist, so nothing states a version and no `cpu-local` host values exist; a session with the oMLX backend seals PARTIAL without a document, cause `MODEL_PROVENANCE_NO_SOURCE_FOR_BACKEND` (before: `MODEL_PROVENANCE_UNKNOWN`). The host file was not written by this pass (an installation value).

### Item 4 — erratum sentence (D-71c-2, ruled)

> `06_evidence_package_spec.md` §B.7a, after the field 123 row: "**Limit (D-71c-2).** A session that was started before the STT snapshot was written inside the unit of the start has no `stt_config` snapshot. It is sealed `PARTIAL` without a transcript document (`disabledReason: TRANSCRIPT_UNAVAILABLE_AT_SEAL`) and field 123 holds the fixed stand-in `{ enabled: true, backend, model: 'not-recorded', diarization, revision }`, whose members other than `model` describe nothing. No session started by a Core from row 71c on may reach this state: a start whose snapshot is not stored is refused (`STT_SNAPSHOT_NOT_STORED`)."

The last sentence is not yet true for three causes (configuration unreadable at that instant, row gone, composition absent): see the request line.

## 2. Real vs stand-in

Real: the provider on files and the host file; the pipeline of `@dems/transcriber`; the app factory and its boot; supervisor, forwarder and (joined test) the shared simulator; PostgreSQL in the db test. Stand-ins: the engine (a script in the form of `whisper-cli`), the model file (a ggml header + filler written by the test), the worker (`FakeWorkerProcess`), the devices (fake adapters). Not run: a real engine, a real worker, a client.

## 3. Results

| Check | Command | Result |
|--|--|--|
| Touched unit files + static guards | `npx vitest run --root apps/core-server --project unit src/transcription src/sealing-host/__tests__/transcript-step.test.ts src/capture-notices src/capture/__tests__/forwarder.test.ts src/capture/__tests__/forwarder-engine.test.ts src/capture/__tests__/static.test.ts src/modules/capture-inputs src/modules/stt-config test/static` (sandbox off: process priority, loopback fakes) | 33 files, 438 passed, 1 expected fail (the `it.fails` of item 3), 0 skipped |
| Session-start notices on PostgreSQL | `/usr/bin/lockf -k .locks/db-migrate.lock npx vitest run --root apps/core-server --project db src/capture-notices/__tests__/session-start.db.test.ts` (sandbox off) | first run 3 passed + 1 red (below); after the correction 4 passed |
| Typecheck | `npx tsc --noEmit -p apps/core-server` | 0 errors after item 3; at the end 1 error in `test/acceptance/rbac-matrix.test.ts:807` (`holderFact`, pass D6, in flight; not this pass) |
| Lint | `npm run lint -w @dems/core-server` | exit 0, no line |

Reds on the way, each run again once after its fix: the cpu-local case inside the sandbox (`PRIORITY_NOT_APPLIED`: the sandbox forbids lowering a priority; green outside it, and the case is skipped BY NAME where the host cannot lower a priority); `forwarder-engine` (my helper used a member the rig does not return); one forwarder case of mine removed (it asserted nothing useful). Failing-first for item 2: with the call line in `capture-inputs` switched off, `boot-listener.test.ts` case 1 was red (0 listeners after `ready()`); restored, green.

**The red db case and why it was corrected, not fixed:** "with no forwarder mounted … the error log says who raised it" expected this unit's net to raise the fault. Since row 71c the engine's failed-start unit raises it itself BEFORE the `FAILED_START` event is told (`engine/capture-session.ts:88`, `capture-session/index.ts:557` then `:579`), so the net finds the fault active and writes nothing. Attributed by reading, not by a run on the baseline (row 71c ran `src/capture-notices` in the unit project only). The case now asserts one alert, one row, **the alert's params `reason: NO_CAMERA_CONNECTED`, `evidenceFiles: 0`**, and that the net wrote nothing; the net itself stays proven in `session-start.test.ts:226`.

Proof of item 1 with the engine double (`session-run.test.ts`, "THE PRODUCTION PROVIDER"): every member present -> `ASSEMBLED`, `model = { name: ggml-large-v3-turbo, version: <host statement>, quantisation: q5_0 (header), modelSha256: <hash of the test's bytes> }`; version not stated -> UNAVAILABLE `MODEL_VERSION_NOT_STATED`, no document; oMLX backend -> UNAVAILABLE `MODEL_PROVENANCE_NO_SOURCE_FOR_BACKEND`. Controls in `model-provenance.test.ts`: other bytes other hash, other header other quantisation, replaced file hashed again.

Proof of item 2: `boot-listener.test.ts` (real app factory, nothing uses the unit: 0 listeners before `ready()`, 1 after); the db test's rig no longer uses `captureNotices(app)` before a start, and its degraded and failed-start cases raise their notices.

Item 3, which half is proven: **proven** — the forwarder calls the raise with `{ code: CAPTURE_FAULT, subject: null, reason: NO_CAMERA_CONNECTED, evidenceFiles: 0 }` (controls: another crash code and a durable session carry no keys); the alert holds the keys when the failed-start unit made it (db). **Not true yet** — the alert and the `FAULT_RAISED` row when the forwarder's raise came first: the shared raise reads `code` and `subject` only (pass D6). `src/core/audit-details.ts` was NOT edited: `FAULT_RAISED` is a simulator type without a list; an engine-built row passes the general payload rules only (`core/audit-writer.ts:206`), which admit a text and a finite number. Giving it a list would move the 23 / 44 pins and would not apply to engine-built rows.

## 4. Decisions for the controller

| ID | Decision |
|--|--|
| D-D8-1 (FIRST) | **Field 85 `transcript.model.version` has no source in the runtime**: no member of a ggml file, no output of the engine and no row of `stt_config` states a version; the spec says "transcriber adapter" (`06…:313`) and the schema requires a non-empty text with a document (lines above). Built, pending this ruling: the host states it (`<dataDir>/transcriber/host.json`, `cpuLocal.modelVersions: { "<model id>": "<version>" }`, optional; D-115-1's file gains one member). Without the entry: PARTIAL, `MODEL_VERSION_NOT_STATED`. **Accept** (spec errata: `06…:313-315` source column = "adapter identifier / host file / model file header / Core hash of the model file"; `07…` §B.3 one row for the host member) **or** the smallest schema change instead: field 85 nullable with a document (`manifest.ts:174` rule, `handler.ts:209`, `document.ts:62`, `finalize-transcript/document.ts:43`; closed files of pass D6 / row 82c / row 76), and the host member is removed |
| D-D8-2 | `omlx-server` sessions never seal `ASSEMBLED`: the Core reads no model file of that service and its model list states identifiers only (the form the probe parses; the server was not asked in this pass, so whether oMLX reports more is NOT verified). Consistent with tx §B.4. To see `ASSEMBLED` on this Mac the installation needs a host file with `cpuLocal` (the `.cache` engine and `.cache/stt/models`), a version entry, and the `cpu-local` backend selected — an installation step for the user / controller, not done here |
| D-D8-3 | The hash of the model file is taken at the first session open of a process (stream read, kept by device / inode / size / modification instant). `begin` is not on the path of a start (`capture-session/index.ts:721` does not wait for it). If the read beside a starting capture is unwanted, move the first read to the CS-22 boot step — say so |
| D-D8-4 | The first-use attach of the session-start listener is REMOVED; the boot hook is the only automatic attach. The registration call sits in `modules/capture-inputs/index.ts` (the module of the notices unit's own operation; `app.ts` is frozen and that module is not otherwise this pass's — one import member + one line + its comment). The module's static rule (no `addHook(` in a module file) holds: the hook is in the unit |
| D-D8-5 | The forwarder gives the keys only for the protocol's `FINAL_CRASH_CODES` (today `NO_CAMERA_CONNECTED`) with no durable record seen. Any other failed start gets its keys from the failed-start unit when that unit makes the alert, as row 71c built |
| D-D8-6 | Row 139's db expectation "the net raised it" corrected to what row 71c made true (section 3) |
| D-D8-7 | Items 4 and 5 stopped at the area boundary; three request lines filed (shared raise; `capture-session` start refusal for every `!snapshot.ok`, which changes RK-1 for the snapshot read only; codec from the `stsd` sample entry + the stored form `H264` / `HEVC`) |

## 5. To wire when it lands

- Pass D6's shared raise: remove `.fails` in `capture/__tests__/forwarder-engine.test.ts` (it goes red because it passes); `session-capture.db.test.ts:433` can then require the reason.
- The `capture-session` line of item 4: then the erratum's last sentence is true.

## 6. Checks for the test runner

| ID | Command (repo root) | Lock / sandbox | Expected |
|--|--|--|--|
| D8-U1 | the unit command of section 3 | none / sandbox OFF | 33 files, 438 passed, 1 expected fail, **0 skipped** (a skipped case = the host could not lower a priority: not a pass) |
| D8-DB1 | `npx vitest run --root apps/core-server --project db src/capture-notices/__tests__/session-start.db.test.ts` | `db-migrate` / OFF | 4 passed (already run once by the driver) |
| D8-DB2 | `npx vitest run --root apps/core-server --project db src/capture-session src/capture/fence/__tests__/development-session.db.test.ts src/modules/capture-inputs` | `db-migrate` / OFF | green as rows 71c / 140 reported (NOT run by this pass). They now run with the notices listener attached at boot and the keys on the forwarder's raise; a red that names `captureNotices.sessionStart` or `raiseCaptureWarning` goes to this pass |
| D8-E2E | `src/sealing-host/__tests__/e2e/seal-e2e.db.test.ts` | heavy-host + `db-migrate` | **unchanged by item 1**: it switches STT off -> `DISABLED`. Were it run with STT on and the oMLX backend on this host: `PARTIAL` without a document, cause `MODEL_PROVENANCE_NO_SOURCE_FOR_BACKEND` |
| D8-ALL | whole core-server unit + db suites | per commit | baseline of D94 plus the lines above |

## 7. Device / browser flows for the gate

Failed start with no camera on a fresh Core (no pre-check, no search before it): the fault presentation appears; its wording names "no camera" only after pass D6's raise lands. STT on with `cpu-local` and a stated version: verify shows the transcript with model name, version, quantisation and hash; without the version entry: transcript unavailable.

*Not written by this pass (driver rules): `status_tasks.md`, `delegation_progress_report.md`, `masterplan/02_plan.md`, `99_implementation_report.md`.*
