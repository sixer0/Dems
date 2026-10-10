---
task_id: 2026-10-07_dems_real_capture_sealing
row: integration pass D9 (items 1-3 of D160; items 4-6 of D161; notes D162)
date: 2026-10-10
agent: coder-execution
baseline: e296ce7 + the uncommitted wave D tree
status: needs-review
tier: 3
---

# Integration pass D9 — conditional model provenance, snapshot-or-refuse, codec, microphone start, probe, rate advisory

Paths below `apps/core-server/` unless they start with `packages/` or `apps/`. No commit, no migration (`[5, 'dbc-6']`), no lockfile write, no new dependency. `.data/pg*.env` not read. **The STT server on 127.0.0.1:8000 was not called, started or configured; no key read; no model file read, hashed or downloaded.** No figure of how long anything took (D230). Each check ran once after its last change; repeats only after a fail (section 3).

## 1. Per item

| # | Item | State | What | Where |
|--|--|--|--|--|
| 1 | Model provenance by backend (D160) | **done; ONE consequence open in row 82c's test rig (31 reds, one line)**; verifier line requested of pass D10 | One shared rule: beside a sealed document the name is required; version / quantisation / file hash are NULL exactly for a server backend (`omlx-server`) and set for every other. Held by the manifest schema + builder, both transcript document schemas, the seal step's journal reader, and the provider port. No field added (128 / 119 pinned by a test) | `packages/shared/src/evidence-package/manifest.ts` `transcriptModelFaults` / `isServerSttBackend`, rule in `transcriptRules`; `apps/transcriber/src/pipeline/document.ts` (`TranscriptModelProvenanceSchema`, refine, `modelProvenanceFault`); `src/sealing/finalize-transcript/{document.ts,contract.ts,handler.ts}`; `src/transcription/model-provenance.ts` (server answer, `provenanceFitsBackend`, `MODEL_PROVENANCE_NOT_FOR_BACKEND`); `session-run.ts` (the gate of the port) |
| 2 | Every real-mode start writes the snapshot or refuses | **done** | `!snapshot.ok` for ANY cause -> `503 NOT_READY`, `details.reason: STT_SNAPSHOT_NOT_STORED`; the unit rolls back (no RECORDING, no source row, no snapshot row), the worker is started only after the commit; the cause code is in the error log only | `src/capture-session/index.ts` `recordingStartedIn` (the branch after `ports.snapshotIn`) |
| 3 | `codec` from the init segment | **done** | `videoSampleEntryOf(source)` reads `moov/trak[hdlr vide]/mdia/minf/stbl/stsd`; `avc1`/`avc3` -> `H264`, `hvc1`/`hev1` -> `HEVC`; anything else has no name. The reader throws `CAMERA_FILE_UNUSABLE` (`VIDEO_SAMPLE_ENTRY_UNKNOWN` / `NO_VIDEO_SAMPLE_ENTRY`) for a file that is there and names none; a missing file / no init segment stays null (CLOSE_TRACKS names it). Read from the recording file, or from the sealed camera file once the recording is gone (clear init segment: a resumed seal reads the same) | `src/capture/fragments.ts` (`videoSampleEntryOf`, `VIDEO_SAMPLE_ENTRY_CODECS`); `src/capture-session/facts.ts` `readSessionVideoSampleEntry`; `src/sealing-host/session-reader.ts` (port `videoSampleEntry`); `src/sealing-host/index.ts` (one port line) |
| 4 | Both microphones started together | **done** | `startMicrophones`: every helper is launched in the same turn after the worker's acknowledgement; nothing waits for either (cameras are opened at once); each start is held to the no-delivery bound (`MIC_START_BOUND_MS` 8,000 = `FIRST_DELIVERY_MS`, pinned); a failure is `CAPTURE_MIC_NOT_STARTED` with role and cause - `warn` for the standby, `error` for the primary - never a replacement; `STARTED` is said after every start has an outcome | `src/capture-session/index.ts` `startMicrophones`, `begin` |
| 5 | Reachability probe wired | **done** | NEW `captureNotices(app).provideProbeSource(source)`; the one call is in the unit's own boot registration `registerCaptureNotices` and reads `captureFenceControl(app).probeAdapters()` lazily (null before the fence's boot step and in SIMULATED: asked again at the next use, then kept). A provided probe still wins. No line was needed in `modules/capture-inputs` or `modules/devices` | `src/capture-notices/index.ts` |
| 6 | `MIC_RATE_AT_LIMIT` as the named advisory | **done** | The worker's WARNING with that reason is no longer forwarded as a bare `CAPTURE_FAULT`: ACTIVE raises the advisory notice `{ code: MIC_RATE_AT_LIMIT, subject: <device id> }` (SYSTEM alert, INFO, `params.reason`, target = the microphone), CLEARED resolves it at once, a new recording session resolves what an earlier one left. No fault, no audit row, no device state, no switch | `src/capture/forwarder.ts` `advise`, `resolveAdvice` |
| D162 (a) | `.fails` removed | done | pass D6's shared raise landed; the case is a plain check and green | `src/capture/__tests__/forwarder-engine.test.ts` |

**Today's verifier on a sealed server-backend package (item 1; not edited):** PASSES. `ok: true`, overall `PASS`, every check PASS, `transcript: { state: VERIFIED, revisions: 0 }`, `transcriptState.code: READY`. It accepts the nulls because V-01 parses with the shared manifest schema, which now holds the condition; it prints no line about the model and does not hold the document's header against fields 84-87. Request filed for pass D10 (report line + V-10).

**Spec errata written:** `06_evidence_package_spec.md` PE-D9-01 (§B.7, fields 84-87 by backend; the `cpu-local` version is a declared value), PE-D9-02 (§B.7a, limit D-71c-2 with its last sentence now true), PE-D9-03 (§B.4, field 43 source and stored form); `07_transcript_spec.md` §B.3 one row (host member `cpuLocal.modelVersions`).

## 2. Real vs stand-in

Real: the shared schema and builder; the pipeline of `@dems/transcriber`; the seal step; row 83's `sealPackage` (real bytes, hashes, signature) and the verifier; the app factory, engine and PostgreSQL in the db test; supervisor, forwarder and the shared simulator in the joined test; the fence's registry builder and the helpers' own logic. Stand-ins: the STT engine (the double of the shared rig / an in-process transport), the worker (`FakeWorkerProcess`), microphone helpers (scripted starts; the scripted process door: the device list is a text), init segments (generated boxes). Not run: a real engine, a real worker, a device, a client.

## 3. Results

| Check | Command | Result |
|--|--|--|
| Shared evidence package + verify | `npx vitest run --root packages/shared test/evidence-package.test.ts test/evidence-transcript-states.test.ts test/demo-evidence.test.ts test/evidence-verify.test.ts test/evidence-verify-sources.test.ts test/evidence-verify-development-key.test.ts` | 6 files, 240 passed |
| Transcriber document + static | `npx vitest run --root apps/transcriber src/__tests__/document.test.ts src/__tests__/static.test.ts` | 2 files, 157 passed |
| Seal step, reader | `npx vitest run --root apps/core-server --project unit src/sealing-host/__tests__/transcript-step.test.ts` ; `... src/sealing-host/__tests__/sealing-host.test.ts` (sandbox off) | 12 passed ; 11 passed |
| Fragments | `... --project unit src/capture/__tests__/fragments.test.ts` | 51 passed |
| Forwarder joined | `... --project unit src/capture/__tests__/forwarder-engine.test.ts` (sandbox off) | 8 passed, 0 expected fails |
| Touched units + static guards | `npx vitest run --root apps/core-server --project unit src/capture-notices src/modules/capture-inputs src/capture/__tests__/static.test.ts src/capture/__tests__/forwarder.test.ts src/transcription test/static` (sandbox off) | 29 files, 345 passed, 0 skipped lines reported |
| Capture session on PostgreSQL | `/usr/bin/lockf -k .locks/db-migrate.lock npx vitest run --root apps/core-server --project db src/capture-session/__tests__/session-capture.db.test.ts` (sandbox off) | 28 passed |
| Typecheck | `npx tsc --noEmit -p apps/core-server` ; `-p apps/transcriber` ; `-p packages/shared` | 0 errors each |
| Lint | `npm run lint -w @dems/core-server` ; `-w @dems/shared` ; `-w @dems/transcriber` | no line each (one unused import of mine removed, then clean) |

Reds on the way, each run again once after its fix: a shared purity rule (my message text held the word `document`: reworded); four fragment cases (my test read through a source that breaks the `ByteSource` contract: the assertion removed); two advisory cases (my expectations: the forwarder hands on the supervisor's session ID; a worker warning always names a device, so "no subject" cannot arrive - the case now uses a camera ID, which the engine refuses and the forwarder reports).

**Controls and the mutation proof (evidence integrity, item 1).** Schema: `cpu-local` with a null hash / version / quantisation REFUSED, the failing member named; a server backend with any of the three set REFUSED. Document: the same both ways. Provider: a server subject handed a real readable model path answers the name and three nulls (the same path under `cpu-local` IS read: control). Port: a provider that states a hash for a server session, or leaves one null for `cpu-local`, is refused `MODEL_PROVENANCE_NOT_FOR_BACKEND`, no document. Seal step: an invented provenance never leaves the step (`TRANSCRIBER_FAILED`). **Mutation:** the `cpu-local` half of the rule switched off in `transcriptModelFaults` -> 5 cases red in `evidence-transcript-states.test.ts` (the control, the rule, three document-member cases); restored, green. Item 2: three causes refused + the control that starts. Item 3: unknown sample entry refused, never mapped. Item 4: the sequential control shows 72,000 samples of gap; together 0. Item 5: no adapters offered -> 503; another device list -> absent. Item 6: the same frame without the reason is the plain fault.

**Counted once, in row 82c's area (not mine to edit):** `src/sealing/__tests__/{stt-states,stt-states-verify,finalize-transcript,last-resort,pipeline}.test.ts` -> **31 failed, 146 passed** (7 + 22 + 2; the last two files green). Every red is an `omlx-server` session whose shared rig hands the transcriber an invented version / quantisation / hash (`support.ts:182`), which D160 forbids. One line cures the rig; request filed, blocking.

## 4. Decisions for the controller

| ID | Decision |
|--|--|
| D-D9-1 (FIRST) | **The rule is strict both ways**: for a server backend the three members MUST be null (a value there is refused), not merely may be. Otherwise a manifest could not say which kind it is and the verifier's sentence would be false for it. Consequence: row 82c's test rig (`sealing/__tests__/support.ts:182`) must state the three nulls for `omlx-server`; 31 unit cases there are red until then (their db twins not run). The exact line is in `file_requests.md`. If the controller prefers "nulls permitted, values tolerated" for a server, it is one condition in `transcriptModelFaults` - but then nothing in the manifest distinguishes a verified hash from an invented one |
| D-D9-2 | The transcript document format keeps `dems.transcript/1`: no member added, three members of `header.model` became nullable under the same condition (`header.backend`). `transcripts.model` (jsonb) stores the nulls; no migration, no constraint touched |
| D-D9-3 | Field 43 stored form `H264` / `HEVC` (erratum PE-D9-03). The connection test's own vocabulary says `H265` (`capture/adapters/types.ts:110`) and the demo generator writes `H.264 + AAC-LC` into field 43 of the demo packages (`sealing-host/demo-seed/index.ts:227`, row 82c): three forms. Not changed here |
| D-D9-4 | An unknown video sample entry stops the seal BEFORE the first step row is written (the reader throws `CAMERA_FILE_UNUSABLE`), so the journal holds no FAILED row for it; the run rejects with the named failure. Such a recording cannot be sealed by this Core until its codec has a name: by the brief. Say so if it should seal with `codec: null` and a named warning instead |
| D-D9-5 | Item 4: after the worker's acknowledgement a microphone that cannot start is the disconnect rule of cap §E.1 / ML-7 (reported with its role; the worker's `MIC_DISCONNECTED` names it; never replaced, never switched). The session is NOT ended when both fail at that point: D80(6)'s block is the pre-check's and the plan builder's (no primary input -> the start fails), and by then video may be durable. Say so if both failing after the acknowledgement should end the capture |
| D-D9-6 | Item 5: from now on a pre-check of a session whose selector names the LOCAL camera makes the short open of this Mac's camera through the wired probe (row 140's note). Agents' runs keep the scripted door / the FAKE selector (D150) |
| D-D9-7 | Item 6: the advice is resolved at the worker's CLEARED and when another session records; a session that ENDS while the condition holds leaves the alert active until the next recording (the forwarder has no end-of-session edge that is not also a restart). The bare `CAPTURE_FAULT` is no longer raised for this reason. The telemetry-derived notice line (`CAPTURE_MIC_RATE_AT_LIMIT`, log + error log) is unchanged |
| D-D9-8 | Item 2 changes RK-1 for the snapshot read only (a start waits for one read of one row and refuses when it fails). A rig that starts a REAL session on an app without the transcription composition is now refused: none found in the files run here |

## 5. To wire when it lands

- Row 82c's line in `sealing/__tests__/support.ts`: the 31 cases turn green; nothing of this pass changes.
- Pass D10: the report line and V-10; then `transcript-step.test.ts` last case (an inline snapshot of today's verdict) gains the model line - it goes red by design, update the snapshot.

## 6. Checks for the test runner

| ID | Command (repo root) | Lock / sandbox | Expected |
|--|--|--|--|
| D9-U1 | the unit commands of section 3 | none / OFF | as listed; `session-run.test.ts` 0 skipped outside the sandbox |
| D9-DB1 | `npx vitest run --root apps/core-server --project db src/capture-session/__tests__/session-capture.db.test.ts` | `db-migrate` / OFF | 28 passed (run once by the driver) |
| D9-DB2 | `npx vitest run --root apps/core-server --project db src/capture-notices/__tests__/session-start.db.test.ts src/modules/capture-inputs/__tests__/no-device.db.test.ts src/capture/fence/__tests__/development-session.db.test.ts` | `db-migrate` / OFF | green as rows 139 / 133 / 140 reported, with their expected fails (NOT run by this pass). They now run with the probe source registered, the microphones started together and the snapshot refusal; a red that names `STT_SNAPSHOT_NOT_STORED`, `CAPTURE_MIC_NOT_STARTED` or `provideProbe` goes to this pass. Row 140's case "the microphone helpers are started" must stay green |
| D9-DB3 | `npx vitest run --root apps/core-server --project db src/sealing/__tests__/stt-states.db.test.ts src/sealing/__tests__/finalize-transcript.db.test.ts src/sealing/__tests__/last-resort.db.test.ts src/modules/transcripts` | `db-migrate` / OFF | red for `omlx-server` sessions with a document until row 82c's rig line lands (same cause as the 31); `modules/transcripts` expected green (jsonb takes the nulls; not run) |
| D9-SEAL | `npx vitest run --root apps/core-server --project unit src/sealing/__tests__` | none / OFF | 31 failed in three files until the rig line lands; then green |
| D9-E2E | `src/sealing-host/__tests__/e2e/seal-e2e.db.test.ts` | heavy-host + `db-migrate` | **what it should now show:** STT is switched off there, so `transcript.state: DISABLED` as before and the start is NOT refused (a readable configuration writes a disabled snapshot). NEW in the sealed manifest: `tracks[0].codec` and `tracks[1].codec` = `H264` (the generated H.264 sources through the worker; the test does not assert it - read the manifest). If instead the seal stops with `CAMERA_FILE_UNUSABLE` / `VIDEO_SAMPLE_ENTRY_UNKNOWN`, the worker's init segment carries a sample entry other than `avc1`/`avc3`: that goes to this pass with the four characters from the error detail. With the microphones started together the worker summary should show `missing: 0` on both microphones and no `MIC_DISCONNECTED` at the start |
| D9-ALL | whole shared, transcriber and core-server suites | per commit | baseline of D94 + the lines above |

## 7. Device / browser flows for the gate

STT on with the oMLX backend: the session seals with its transcript; verify shows the model name and (after pass D10) the sentence that it was reported by the STT server and not verified. Development session with this Mac's microphone: the roster shows "Rate correction at its limit (MIC_RATE_AT_LIMIT)" on that microphone while the worker reports it and the line goes when it clears; the active source does not change. "Search again" on microphones in real capture answers Ready / Not found per device. Evidence detail shows the codec `H264`.

*Not written by this pass (driver rules): `status_tasks.md`, `delegation_progress_report.md`, `masterplan/02_plan.md`, `99_implementation_report.md`.*
