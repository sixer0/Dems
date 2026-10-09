---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
row: 78 (phase C, milestone M6, wave M6-W3, class B; blueprint rev 2.3)
date: 2026-10-09
agent: coder-execution (single driver, no pair reviewer — D88; quality control = rows 80, 81)
source_plan: identification/02_structured.md rev 2.3 row 78 (:330); masterplan/07_transcript_spec.md (tx) §A.4, §A.5, §D; masterplan/04_database_contract.md (dbc-3) §B.8, §B.9, §B.11; masterplan/06_evidence_package_spec.md (ev) §B.7; masterplan/10_test_strategy.md M6-TF-1, M6-LB-1; decisions D70, D71, D72(d), D81, D84, D88; controller rulings D90 (labelling without a segmentation model), D95 (file ownership)
narrative_tier: 3
status: needs-review
verification: M6-LB-1 PASS (unit, model stubbed); M6-TF-1 criterion 6 PASS on the sealed fixture as "UNAVAILABLE with its reason" (criterion 5 is rows 79/82+); canonical document, hash, three writes in one unit of work: PASS with negative controls; 29 mutations red. NOT PROVEN: a LABELLED document on real audio (section 3.2)
---

# Row 78 — speaker labelling, the `dems.transcript/1` document, and the sealed-transcript store (M6-W3)

No throughput, speed or duration figure is in this document, in the code or in the evidence this row stored (D230). Every "done" has a file and a line.

## 0. The outcome in five lines

1. **Speaker labelling ended on option 2 of ruling D90.** The path of option 1 is built and tested (one CAM++ embedding per committed segment, two clusters, no segmentation model). On the sealed two-voice fixture the real engine's answer does not meet the honesty conditions, so the document is **UNAVAILABLE, reason `NOT_TWO_SPEAKERS`, flag `speaker labels unavailable`**. A forced split would have attributed 11 of 14 sentences correctly: not good enough to seal as LABELLED. A second measurement on two built-in synthetic voices also ended UNAVAILABLE (`LOW_CONFIDENCE`; forced split 6 of 8). **This row has not produced a LABELLED document on real audio.**
2. The canonical document, its hash and its two renderings exist and are pinned from outside the code.
3. `transcripts`, `transcript_revisions` and `evidence_items.transcript_sha256` are written as `dems_app` in one unit of work; no migration.
4. `CORE_SERVICES` lists the transcriber service (17th entry); every count pin that follows was changed and is listed.
5. The row-77 review fixes that were handed to this row are in (section 8).

## 1. What exists now

| Piece | File:line | What it does |
|---|---|---|
| Labelling rule | `apps/transcriber/src/pipeline/diarization.ts:187` (`clusterInTwo`), `:247` (`labelSegments`) | Deterministic spherical 2-means (start = the two embeddings farthest apart); LABELLED only when ALL hold: >= 4 embedded segments, both clusters >= 2 segments, centres >= 0.5 apart (cosine distance), mean distance inside each cluster < 0.5, mean silhouette >= 0.5. `A` = first labelled segment's speaker |
| Engine module | `diarization.ts:386` (`createSpeakerEmbedder`), `:285` (deny list of 4 model hashes) | Starts `dems-speaker-embed` through the ONE engine starter (nice, no shell, fixed environment, sibling rule); strict reading of its output; refuses an absent model and a model that is not cleared (marker file or SHA-256) before any process exists |
| Engine program | `apps/transcriber/native/speaker-embed.c`, `native/README.md` | 100 lines of C on the sherpa-onnx C API: one embedding per span, CPU provider fixed in the source; no rule in it. Built with `/usr/bin/clang` into `.cache/` (not in git) |
| Post-pass | `diarization.ts:484` (`runDiarizationPass`) | Never throws for a labelling reason; embeds only segments >= 1500 ms; removes its audio work file however it ends |
| Document | `pipeline/document.ts:74` (schema), `:138` (build), `:183` (canonical text), `:205` / SRT, WebVTT, `:255` (`sealRecordOf`) | `dems.transcript/1`; five members; state `ASSEMBLED` / `PARTIAL` with reason; no instant in it |
| Assembly | `pipeline/assembly.ts:98` (`assembleTranscript`) | labels once -> three files (atomic) -> record once; refuses an unfinished transcript; idempotent; a rebuilt file must have the recorded hash |
| Checkpoint | `pipeline/checkpoint.ts:77`, `:98` | optional `diarization` (label map + state) and `document` (`{assembled, docSha256, …, speakerState, state}`) members, tx §D.1 |
| Core store | `apps/core-server/src/modules/transcripts/statements.ts:53`, `index.ts:204` (`createTranscriptStore`) | `writeSealedTranscript`, `read`, `revisionHead`, `appendRevision`, `readRevisions`; constant statements; not mounted (row 79 / op 85) |
| Service list (SH-09) | `packages/shared/src/sim/dataset.ts:189` | `'Transcription Service'`, last, so `SVC-01..16` keep their names |
| Static rules | `apps/transcriber/src/__tests__/static-rules.ts` `DIARIZATION_PROVIDER_IS_CPU`, `NO_UNCLEARED_DIARIZATION_MODEL` | no provider but `cpu`; neither uncleared asset is named in production code |

**Not built here (the row text read strictly):** the canonical body of a revision and its signature (Signer, row 83), operation 85 and its permission check, `transcript-revisions.json` in the package, the mount in the Core and the `FINALIZE_TRANSCRIPT` handler (row 79), `evidence_items.labels_status` (the mapping stores NULL: `db/mapping/rows.ts:432`, row 129's file — request filed), `transcript_chunks.embedding_ref` (stays NULL: embeddings are not kept; nothing needs them after the label map is written).

## 2. Design statements

**The document.** `{ header, segments[], speaker_state, intervals[], qa_flags[] }`. A segment is exactly `{index, start_ms, end_ms, text, speaker|null}` in media time of the sealed file; the QA members of an engine are not in it (tx §B.5). `header` carries `doc_version`, `session_id`, `language`, `backend`, `model {id, name, version, quantisation, sha256}`, `audio`, `state`, `partial_reason`, `chunks`, `failed_chunks`, `speaker_reason`, `diarization {num_speakers, confidence, engine|null}`.

**Canonicalisation rule** (the product's existing one, `canonicalJSON` of `@dems/shared/sim`): members of every object sorted by key in UTF-16 code-unit order, no whitespace, strings and numbers as ECMAScript `JSON.stringify` writes them, arrays in their order, UTF-8, no byte-order mark, no final line break. Segment text is the engine's text byte for byte (not re-normalised). **Hash:** SHA-256 of those bytes, lowercase hex.

**PARTIAL.** `audioUnavailable` of the checkpoint (row 77's tap signal) -> `state: PARTIAL`, `partial_reason: TRANSCRIPT_AUDIO_UNAVAILABLE`; a FAILED chunk -> `PARTIAL` / `CHUNKS_FAILED` with `failed_chunks`; both -> the audio reason, the count kept. No text is made up. An unfinished transcript (PENDING/RUNNING chunk, plan not complete) is refused, never assembled.

**One unit of work.** The runtime role has no UPDATE on `evidence_items.transcript_sha256`, so the value is written by the INSERT of the item. `writeSealedTranscript` reads the item back inside the caller's transaction and refuses unless it is bound to exactly this document hash; then it inserts `transcripts`. A refusal throws and the caller's rollback removes the item too.

**Revision chain.** `revision_no` = head + 1 inside the transaction; parent of revision 1 = `transcripts.json_sha256`; a stale base, another parent, or a lost race (primary key, 23505 — a row lock is not possible: no UPDATE privilege) = `TRANSCRIPT_REVISION_CONFLICT`.

## 3. Verification

### 3.1 Automated suites (final state of the tree)

```
$ npm run test -w @dems/transcriber                    # inside the sandbox
 Test Files  19 passed (19)        Tests  538 passed | 4 skipped (542)
$ npm run test -w @dems/transcriber                    # OUTSIDE the sandbox
 Test Files  19 passed (19)        Tests  539 passed | 3 skipped (542)
```

Was 377 passed / 2 skipped. The skips are complementary blocks: outside the sandbox the two "host forbids it" niceness blocks and the "host hides the process table" block; inside it the two "host lowers" blocks and the two N-2 tests that need `ps`. Stored verbose output, durations stripped: `.cache/stt/checks/row78/gate/transcriber_outside_sandbox_verbose.txt` (`grep -cE '✓.*(M6-LB-1|M6-TF-1)'` = 36).

```
$ npm run test -w @dems/shared                         -> 75 files, 1993 passed
$ npx vitest run --root apps/core-server --project unit test/static src/modules/transcripts src/modules/transcript-chunks \
    src/modules/system/__tests__/routes.test.ts src/modules/devices/__tests__/status.test.ts </dev/null
                                                       -> 17 files, 278 passed
$ /usr/bin/lockf -k .locks/db-migrate.lock npm run test:db -w @dems/core-server -- src/modules/transcripts \
    src/modules/transcript-chunks src/modules/system/__tests__/system.db.test.ts src/modules/system/__tests__/effects.db.test.ts
                                                       -> 4 files, 93 passed (36 of them the new transcripts.db.test.ts)
typecheck + lint: transcriber, shared, core-server     -> exit 0 x 6, 0 warnings
```

### 3.2 Speaker labelling on real audio — measured, and not what was hoped

```
$ /usr/bin/lockf -k -t 1800 .locks/heavy-host.lock npm run test:real:row78:labels -w @dems/transcriber    # outside the sandbox
 Test Files  1 passed (1)        Tests  5 passed (5)
```

Evidence: `.cache/stt/checks/row78/runs/20261009T092436935Z-86592-row78-labels/{fixture,control}.evidence.json`. STT input = the committed checkpoint of row 77's cpu-local run (14 segments); no STT engine and no oMLX was started in this row. Engine command, as recorded: `/usr/bin/nice -n 10 …/bin/dems-speaker-embed --model …/3dspeaker_speech_campplus_sv_en_voxceleb_16k.onnx --rate 24000 --pcm …/work/diarization-segments.pcm --spans …` (niceness 10 under a parent at 0).

| | Sealed two-voice fixture (14 sentences, script `ABABABABAABABA`) | Second measurement: 8 sentences, two built-in `say` voices, no cloning |
|---|---|---|
| Document state | **UNAVAILABLE**, reason `NOT_TWO_SPEAKERS`, flag `speaker labels unavailable`, 0 labels | **UNAVAILABLE**, reason `LOW_CONFIDENCE`, 0 labels |
| What a forced two-way split would give (evidence only, never written) | 11 of 14 sentences with their scripted speaker (`ABABABBBBABBBA`) | 6 of 8 (`ABAAAAAB`) |
| Separation / spread per cluster / confidence | 0.645 / 0.426, 0.508 / 0.39 | 0.737 / 0.466, 0.29 / 0.479 |
| Two runs | byte-identical document, hash `a8003cdd…683e883` both times | — |

Reading: the fixture's two "voices" are per-turn clones from two reference voices; the model hears three groups (several A turns sit with B1/B6). On neither audio do short single-sentence embeddings of synthetic voices fall into two clean groups. **What is not proven:** that the path reaches LABELLED on real two-person speech with the spec's 0.5 thresholds. It reaches LABELLED on stand-in embeddings in the unit tests only. The thresholds were NOT tuned after seeing these numbers.

Negative controls in the same run: each of the two uncleared segmentation files handed in as the model is refused by marker and, as a renamed copy, by hash — `MODEL_LICENCE_NOT_CLEARED`, 0 engine starts; an absent model -> `MODEL_ABSENT`, 0 engine starts, all 14 text segments still in the document.

### 3.3 M6-LB-1 (unit, model stubbed) and M6-TF-1 criterion 6

`src/__tests__/diarization.test.ts` (rule, engine module against a stand-in program, post-pass), `assembly.test.ts` (whole pipeline run with the real runner). Diarizer loaded -> LABELLED, 2 speakers, `A B A B A B`; diarizer absent -> UNAVAILABLE / `ENGINE_NOT_CONFIGURED` with the flag. Every other way to UNAVAILABLE has its test (14 reason codes; boundaries of both thresholds crossed in both directions; three voices -> `NOT_TWO_SPEAKERS`). Limits written in the module head: one embedding per segment (overlap not detected), a short segment carries no label, always a split into two.

### 3.4 Canonical document and hash

`src/__tests__/document.test.ts` (48 tests): the canonical text of a written-out document equals a literal in the test file, and its SHA-256 `a93aeaa4dbf00cef4fd1ac6c2f5ed861f5a2e9d09a3cd450880abe5c7942201b` (752 bytes) was computed with python `hashlib` outside the code; stable across two builds; stable with the members of every object reversed (the plain serialisation differs, shown); nine one-character changes each give another hash, an unchanged copy the same; 17 self-contradicting documents refused. Two whole pipeline runs in two directories at two commit instants: byte-identical files (`assembly.test.ts`).

### 3.5 The three writes, as `dems_app`

`apps/core-server/src/modules/transcripts/__tests__/transcripts.db.test.ts` (36 tests; throw-away clone; schema asserted 2 / dbc-3; `current_user` asserted `dems_app` / `dems_owner`). The real transcriber assembles the document; one transaction inserts the item with `transcript_sha256` and the `transcripts` row; both equal the SHA-256 of the document FILE. Negative controls: item bound to a hash one character off, or to none -> `TRANSCRIPT_HASH_NOT_BOUND`, neither row exists afterwards; three CHECK refusals roll the item back; second transcript for an item -> `TRANSCRIPT_ALREADY_SEALED`; nine statements refused 42501 (UPDATE of the three sealed item columns, UPDATE/DELETE of both tables, a row lock) with a control that a granted column can be updated. Chain: 1, 2, 3 chained; three conflicts; two concurrent writers (the second waits, then conflicts on the key); six table refusals. The revision signatures in the test are SIMULATED (and one Ed25519-shaped value): the real signer is row 83.

### 3.6 Mutations

`python3 .cache/stt/checks/row78/mutation-red.py` (scratch copy; `mutation-red.json`): **29 of 29 red** — 11 labelling, 3 document, 4 assembly, 11 row-77 review fixes. One of them ("the unlabelled flag is not added") is red because the test file no longer loads; counted as such in the JSON.

## 4. `CORE_SERVICES` and the pins that follow (done by a sub-agent of this row, checked here)

`packages/shared/src/sim/dataset.ts:189` adds `'Transcription Service'`. Pins changed 16 -> 17: `packages/shared/src/api/examples.ts:287`, `state-examples.ts:302` (SVC-17), `system.ts:245,269`, `core-api.ts:506`, `state-slices.ts:600`, `sim/derive.ts:7` (comment), `openapi/openapi.json` (regenerated by `scripts/gen-openapi.ts`; 16 insertions / 5 deletions; `info.version` unchanged), `test/api-domain-operations.test.ts:354`, `test/sim-gap-closure.test.ts:294,298`; `apps/core-web/src/features/system/__tests__/system-page.test.tsx:115,122,123`, `services-panel.tsx:30`; `apps/core-server/src/modules/system/__tests__/routes.test.ts:250,254,399,407,408,420,422`, `system.db.test.ts:126,441,456,464,466,603`, `effects.db.test.ts:254,263,351`, `modules/devices/__tests__/status.test.ts:100`. Mobile: none. Negative control: with the entry removed, shared 5 tests red, core-server unit 4, core-web 1. No fault is mapped to the new service: it stays RUNNING like the other unmapped ones.

**Findings for the controller.** (a) An already-seeded database and a persisted browser snapshot keep 16 services until a reseed/reset: the slice is stored and rehydrated verbatim (`db/mapping/rows.ts:304,333`; no reconciliation). (b) `system.services.responsibility.SVC-17` = "Speech-to-text transcript of the recorded audio" is this row's own wording (`i18n/en/system.ts:56`). (c) Several of these files are not this row's under D95 (it arrived after the edits): listed in `delegation_progress/file_requests.md`.

## 5. Licences (errata for the controller; masterplan files not edited)

| Asset | Outcome | Primary source |
|---|---|---|
| sherpa-onnx 1.13.8 (library) | Apache-2.0, used | `raw.githubusercontent.com/k2-fsa/sherpa-onnx/v1.13.8/LICENSE`; archive sha256 equals the release API digest |
| ONNX Runtime 1.28.2 (bundled) | MIT, used | `raw.githubusercontent.com/microsoft/onnxruntime/main/LICENSE` (read at `main`) |
| CAM++ `3dspeaker_speech_campplus_sv_en_voxceleb_16k.onnx` | Apache-2.0, used | model card `iic/speech_campplus_sv_en_voxceleb_16k` (`license: Apache License 2.0`, no login) + `modelscope/3D-Speaker` LICENSE. Not established: fidelity of sherpa-onnx's conversion; VoxCeleb data terms |
| Silero VAD v6.2.0 ggml | MIT, used | `snakers4/silero-vad` LICENSE; `ggml-org/whisper-vad` card `license: mit`, not gated |
| `sherpa-onnx-reverb-diarization-v1` | NOT usable ("Rev Model Non-Production License"), unused, refused by marker + hash | its own LICENSE (row 77) |
| `sherpa-onnx-pyannote-segmentation-3-0` | NOT cleared (excluded by the approved spec), unused, refused by marker + hash | archive LICENSE = MIT (c) 2022 CNRS; upstream `gated: auto` |

**Errata to apply:** tx §A.4 `:152` (route is "sherpa-onnx speaker embeddings per committed segment + two clusters, no segmentation model"; the named reverb asset is non-production; the titanet size is wrong — row 77), tx §F `:389` (the "segmentation `reverb-diarization-v1`" entry: not Apache-family, not shippable; add ONNX Runtime MIT), tx §F / LB-5 `:398` (the clean combination has no segmentation model), tx §A.4 "When LABELLED" (conditions as in section 1; "mean cluster-assignment confidence" = mean silhouette), tx §0.2 (new PROPOSAL constants `DIARIZATION_MIN_EMBED_MS` 1500, `CLAMP_MIN_REMAINDER_MS` 500).

## 6. Decisions taken in this row

| ID | Decision | Needs confirmation |
|---|---|---|
| D-78-1 | Labelling = one embedding per committed segment + deterministic 2-means; conditions of section 1 (the cohesion condition was added because three equally distinct voices passed the other four) | yes (spec erratum) |
| D-78-2 | sherpa-onnx comes in as the official prebuilt C-API archive under `.cache/` plus one C file of ours; no npm package, no Python, no Homebrew, no lockfile change | yes |
| D-78-3 | Hand-built parts, recorded as tx §G asks: the 2-means / silhouette (about 60 lines) and `speaker-embed.c` | record |
| D-78-4 | Labels are `A` / `B` (tx §A.4), `A` = first labelled speaker; a short or unembedded segment has `speaker: null` inside a LABELLED document | yes |
| D-78-5 | Document member names are snake_case as tx §A.5 writes them; QA members excluded; no instant in the document | yes |
| D-78-6 | The canonical rule is the existing `canonicalJSON` of `@dems/shared/sim` (the transcriber now imports that entry) | record |
| D-78-7 | SRT / WebVTT are renderings of the document with their own hashes; label as `[A] ` / `<v A>` | yes |
| D-78-8 | After the label map or the document exists, `retryFailed()` re-queues nothing (the PARTIAL machine transcript stands) | yes |
| D-78-9 | `transcript_chunks.embedding_ref` stays NULL | record |
| D-78-10 | The engine guard identifies a recorded engine by pid + start instant read with `ps`; where `ps` is not readable it stops nothing | yes |
| D-78-11 | N-10 is enforced at run time for a TAP timeline (`CONFIG_INVALID`), not by making the option types required (about 50 call sites) | yes |

## 7. For the controller and the user

1. **Speaker labels: needs a ruling.** Product behaviour today = UNAVAILABLE with an honest reason on both real audios tried. Open routes, none taken: real two-person recordings as a test set; longer units (join consecutive segments of a turn before embedding); another cleared embedding model; calibrating the PROPOSAL thresholds (class C).
2. **Pyannote files.** Downloaded and RUN ONCE by hand on the fixture under the first brief, before D90 (two engine runs of the unused `sherpa-onnx-offline-speaker-diarization` program; result discarded; it was also mostly wrong). Files kept with a `DO_NOT_USE` marker; removal is the user's call.
3. **Two lapses, stated.** (a) That hand run started while a capture e2e run of another driver was in progress (the check and the start were one command). Every later heavy run used `.locks/heavy-host.lock`. (b) `THIRD_PARTY_NOTICES.md` got its section by a scripted append before D95 arrived (17 lines added, 0 removed).
4. **A pin changed on instruction:** `media-time.test.ts` held "origin 0 is refused"; D-77-6 makes origin 0 legal, the test now says so. `adapter-contract.test.ts` gained the new member in its key list.
5. Requests in `delegation_progress/file_requests.md`: the frame-constant pin in `protocol-pins.test.ts`; `labels_status` in the item mapping.

## 8. Row-77 review fixes

| Finding | Outcome | Where | Proof |
|---|---|---|---|
| N-1 tap signal sticky | FIXED: asked at every step, latched in the file at once | `runner.ts:460` | `row77-review-fixes.test.ts` (3); mutation red |
| N-2 orphan engine, two engines, chunk audio left | FIXED: `createEngineGuard` (pid + start instant in `work/engine.json`), reaped before anything; stale work files removed | `cpu-local.ts:286`, `runner.ts:193` | `kill-resume.test.ts` "N-2" (real SIGKILL, nobody stops the orphan by hand) + pid-reuse test; outside the sandbox only (needs `ps`) |
| N-12 kill tests clean up | FIXED: `afterEach` stops every child and every journalled engine | `kill-resume.test.ts` | — |
| N-9 (a) tap below the cursor, (b) tap removed after the plan | FIXED: both PARTIAL / `TRANSCRIPT_AUDIO_UNAVAILABLE` | `runner.ts:361`, `:448` | 4 tests incl. controls; 2 mutations red |
| N-10 options not silently optional | FIXED for a tap timeline: `TAP_SIGNAL_NOT_STATED` / `CAPTURE_WORKER_NOT_STATED`; explicit `NO_TAP_SIGNAL`, `NO_CAPTURE_WORKER` | `runner.ts:186`, `cpu-local.ts:130`, `adapter.ts` `captureWorkerStated` | 4 tests; 2 mutations red. Row 115 passes: `captureWorkerPid: () => supervisor.status().workerPid`, `priority: 'required'`, a `tapLost` fed from telemetry, the tap path, `shouldPause`, the mirror store, `engineGuard` + `guard.record` as `onEngineStart` of adapter, VAD and embedder |
| N-5 repeated short answer dropped | FIXED: the text rule judges only a remainder < 500 ms; the QA rule unchanged | `clamp.ts:37` | 4 tests; phantom tail 65540..95520 still dropped; 2 mutations red |
| N-6 lost checkpoint file | FIXED: logged `CHECKPOINT_REBUILT`, new rows above the old ones, old rows untouched. Decision to record: the FILE is the only resume source | `runner.ts:246` | 2 tests; mutation red |
| N-11 false comment | FIXED (reworded: up to two frames longer) | `constants.ts:7` | — |
| N-4 incremental plan stalls on an unbroken run | CARRIED, not fixed (not a few lines: the guard change alters planning during recording). Still cured at the final step by fixed windows + `vad_fallback` | — | owner needed |
| D-77-6 / N-14 frame constant | FIXED: `CAPTURE_AAC_FRAME_SAMPLES`; origin 0 legal | `packages/shared/src/api/capture.ts:95`, `media-time.ts:57` | test + mutation red; pin in `protocol-pins.test.ts` requested |
| N-8 log backup | untouched, cited nowhere; this row's stored outputs are stripped (grep for a duration in `gate/*.txt`: 0) | — | — |
| Temp audio hygiene | FIXED: work directory removed at the end of a run and before a resume; labelling file removed always; `discardTranscriptAudio(scratch, tapPath)` for abandon / after assembly | `runner.ts:152`, `:487` | 3 tests; 2 mutations red |
| Rule "a DONE chunk is never decoded again" | stated in the runner head | `runner.ts` head comment | existing M6-KR-1 tests |
| N-7, N-13, N-15, N-17 | not this row's | — | — |

## 9. Commands

```
npm run typecheck -w @dems/transcriber && npm run lint -w @dems/transcriber
npm run test -w @dems/transcriber                                   # sandbox: 538 passed, 4 skipped; outside: 539 passed, 3 skipped
npx -w @dems/transcriber vitest run src/__tests__/diarization.test.ts src/__tests__/document.test.ts src/__tests__/assembly.test.ts src/__tests__/row77-review-fixes.test.ts
npx -w @dems/transcriber vitest run src/__tests__/kill-resume.test.ts        # OUTSIDE the sandbox: 6 passed, 1 skipped
python3 .cache/stt/checks/row78/mutation-red.py                               # 29 RED
npm run test -w @dems/shared                                                  # 1993 passed
npx vitest run --root apps/core-server --project unit test/static src/modules/transcripts src/modules/transcript-chunks </dev/null
/usr/bin/lockf -k .locks/db-migrate.lock npm run test:db -w @dems/core-server -- src/modules/transcripts     # 36 passed
/usr/bin/lockf -k -t 1800 .locks/heavy-host.lock npm run test:real:row78:labels -w @dems/transcriber          # outside the sandbox: 5 passed
shasum -a 256 .cache/stt/sherpa-onnx/*/bin/dems-speaker-embed      # f743164d…6e304762 (rebuild: apps/transcriber/native/README.md)
```

`masterplan/02_plan.md`, `status_tasks.md`, `delegation_progress_report.md`, `implementation/99_implementation_report.md` and every masterplan file were not edited (parallel run). Nothing was committed. No migration. oMLX was not started.

---
*Generated: 2026-10-09 16:35 (+07:00)*
