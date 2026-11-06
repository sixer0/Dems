---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
row: 79 (phase C, milestone M6, wave M6-W4, class B; blueprint rev 2.4)
date: 2026-10-09
agent: coder-execution (single driver, no pair reviewer — D88; rules D94, ownership D95)
source_plan: identification/02_structured.md row 79 (:411); masterplan/06_evidence_package_spec.md (ev) §E.1, §E.5, §B.7, §B.7a; masterplan/07_transcript_spec.md (tx) §D.3, §A.5; masterplan/03_api_contract.md §2.4, §3 op 39; decisions D-EV-1, D90, D97; review pair-77 N-4, N-7
narrative_tier: 3
status: complete (software); nothing calls the step until row 82
verification: M6-KR-1 at the FINALIZE step PASS as an in-process stop at each durable boundary (NOT a SIGKILL of a Core process — no seal process exists before row 82); the four outcomes + DISABLED PASS on the real tables as dems_app; idempotence PASS; negative controls PASS; 13 of 13 mutations red. M6-TF-1 criterion 5 ("sealed and verified INSIDE the package") is NOT closed here: there is no package before rows 82/83/85
---

# Row 79 — `FINALIZE_TRANSCRIPT`: the transcript meets the seal (M6-W4)

No throughput, speed or duration figure is in this document, the code or the tests (D230).

## 1. What was built

New folder (mine): **`apps/core-server/src/sealing/`** — a closed unit, not registered by `app.ts`, called by nothing yet.

| Piece | File:line | What it does |
|---|---|---|
| Contract | `src/sealing/finalize-transcript/contract.ts` | Input `{sessionId, sttSnapshot, attempt}`; ports (transcriber seam `assemble` / `locate`, chunk rows, file reader, step journal, error log, clock); result `WAITING` \| `DONE`; typed `FinalizeTranscriptError` (11 codes) |
| Handler | `handler.ts:249` (`finalizeTranscript`) | `:318` journal first — a committed transcript is consumed, the transcriber is only asked where the files are, the three files must hash to the committed hashes; `:348` STT disabled in the snapshot -> DONE `DISABLED` at once; `:351` otherwise ask for the assembled transcript: not ready -> `WAITING` with chunk counters; assembled -> hash the files, read the document with the Core's own schema, record must equal document, session + backend must match, `:386` every segment must be held by a DONE row of `transcript_chunks` |
| Core's reading of the document | `document.ts:36` (strict schema), `:106` (`uncommittedSegments`) | Independent of the transcriber's code; held to it by tests on documents the real transcriber wrote |
| Commit + summary | `commit.ts:47` (`commitSealedTranscript`), `:79` (`evidenceTranscriptSummary`) | The `transcripts` row inside the item's unit of work, read-first so it is idempotent; the slice summary as a pure projection of the manifest block + revision head |
| Step journal | `src/sealing/step-journal.ts:102`, statement `:84` | One row of `sealing_jobs` per `(session, step)`; insert, or update exactly the seven granted columns |
| File reader | `finalize-transcript/files.ts` | `node:fs` read for hashing (the handler imports no file system) |
| N-7 rule | `src/modules/transcript-chunks/attempts.ts:52` (`summariseChunkAttempts`, `failedChunkCount`) | Rows are attempts: grouped by audio range, the newest `seq` decides; a FAILED row with a later DONE row is not a failed chunk |
| Slice summary shape | `packages/shared/src/api/state-slices.ts:751-752` | Two OPTIONAL members added: `failedChunks`, `backendUnreachable`; `openapi.json` regenerated (9 added lines, nothing else) |
| N-4 | `apps/transcriber/src/pipeline/chunker.ts:91`, `:123`; `runner.ts:374-385`; `checkpoint.ts:127` | The maximum chunk length cuts an open speech run while recording; the next pass is told how far the run reached |

**What `DONE` returns** (`FinalizedTranscript`): `manifest` (ev fields 79-94, 121-123, ready for `BUILD_MANIFEST`), `transcriptRow`, `itemColumns {manifestVersion: 2, transcriptSha256, labelsStatus}`, `partialReason`, `speakerReason`, `counters`, `failedChunksByRows`, plus the three source files. The journal checkpoint holds the whole answer and no text, path or instant.

**Single source types** (agreed by contract, nothing copied): manifest block = `ManifestV2Input['transcript']` of `@dems/shared/evidence-package` (row 83); slice summary = `EvidenceItemBody['transcript']` of `@dems/shared/api`. A test puts the step's block through row 83's `buildUnsignedManifest` for all five outcomes. No request to row 83 was needed. State mapping manifest -> slice: `ASSEMBLED -> READY`, `PARTIAL -> PARTIAL`, `DISABLED -> DISABLED`.

## 2. Carried items

| Item | Outcome |
|---|---|
| **N-7** `failedChunks` counts chunks | The manifest value is the DOCUMENT's (`header.failed_chunks`, one state per chunk in the checkpoint file). The rows are counted beside it with the attempt rule and reported (`failedChunksByRows`); a difference is a `warn` in the persistent log and does not stop a seal. Proven on the real table: 4 rows / 3 chunks, plain count 1, rule 0, sealed 0 |
| **N-4** unbroken run | FIXED, not documented away. A 7-minute run without a pause: every step while recording plans and decodes; what is not yet in a chunk stays below one maximum chunk + the tail guard; no `vad_fallback`; the chunks cover the run without a gap. The pass after a cut starts inside the run and treats `[cursor, openRunUntil)` as speech whatever a cold-started VAD says. Two exact-shape expectations in `chunker-clamp.test.ts` gained `openRunUntil: null` (new member, same behaviour) |
| **No fabricated text** | Asserted twice: in the transcriber (`row79-carried.test.ts`: the document's segments are exactly the committed ones, none in the failed chunk's range) and as a guard IN the handler — a placeholder, an ellipsis, a neighbour repeated into the gap, a changed or moved segment are each refused `TRANSCRIPT_TEXT_NOT_COMMITTED` even when file and record hashes are consistent |
| **Revision body (dbc-3 §B.9)** | Row 79's text asks for none. Built here: only `revisionHead: 0` at seal and `revision` in the summary from the store's head. LEFT for rows 83/85: canonical revision body, its signature, op 85 + permission, `transcript-revisions.json` |

## 3. Verification

```
$ npx vitest run --root apps/core-server --project unit src/sealing src/modules/transcripts src/modules/transcript-chunks </dev/null
 Test Files  3 passed (3)        Tests  58 passed (58)          # 30 of them the new finalize-transcript.test.ts
$ /usr/bin/lockf -k .locks/db-migrate.lock npm run test:db -w @dems/core-server -- src/sealing src/modules/transcripts src/modules/transcript-chunks   # outside the sandbox
 Test Files  3 passed (3)        Tests  75 passed (75)          # 17 of them the new finalize-transcript.db.test.ts; 0 databases left
$ npx -w @dems/transcriber vitest run <9 pipeline test files incl. row79-carried, static>      -> 356 passed
$ npx -w @dems/transcriber vitest run src/__tests__/kill-resume.test.ts                         -> 6 passed, 1 skipped (outside the sandbox)
$ npx -w @dems/shared vitest run <6 files on the evidence slice / openapi / evidence-package>   -> 451 passed
$ python3 .cache/stt/checks/row79/mutation-red.py                                               -> 13 of 13 RED (mutation-red.json)
typecheck: transcriber 0; core-server and shared 0 in this row's files. lint: transcriber, shared 0; core-server 0 in this row's files
```

| Asked | Where | Result |
|---|---|---|
| READY / PARTIAL (chunks failed) / PARTIAL (audio unavailable) / labels UNAVAILABLE / DISABLED: summary + item columns | both test files; db test as `dems_app`, item + transcript in one transaction | PASS. DISABLED: item v2, hash NULL, labels NULL, no `transcripts` row |
| Idempotent | db "called twice" | one `transcripts` row, same hash; second call asks the transcriber nothing; journal row not rewritten |
| M6-KR-1 at FINALIZE | stop after assembly / before DONE (connection dies, 57P01); stop inside the item's unit of work | same transcript hash, no chunk decoded again; neither item nor transcript after the rollback, both after the resume |
| Tampered committed transcript | unit + db | `TRANSCRIPT_HASH_MISMATCH`, step FAILED, committed checkpoint kept, nothing assembled in its place; restored -> DONE, same hash |
| Fabricated text turns a test red | mutations 1 and 12 | red in the Core suite and in the transcriber suite |
| `backendUnreachable` | unit | `UNREACHABLE` on any backend; `TIMEOUT` only on `omlx-server` |

**Not proven / not run:** no real STT, no oMLX, no model (the engines are in-process stand-ins; the pipeline, checkpoint, mirror and assembly are real). No SIGKILL of a Core process. Nothing verified inside a sealed package.

**Red in the tree, not this row's** (by file): static guards name `src/capture/adapters/local/*` and `camera/ws-discovery.ts`, `src/modules/capture-config/*`, `src/transcription/*` (rows 131, 134/135, 66, 115); typecheck: `adapters/local/__tests__/e2e/local-mic-capture.ts`, `src/transcription/session.ts`, `capture-config.db.test.ts`, shared `test/evidence-package.test.ts:453`.

## 4. To wire when row 82 lands (and 83, 115)

1. Row 82 calls `finalizeTranscript` per attempt until `DONE`; `WAITING.progress` / counters feed SH-05. Before a retry after `TRANSCRIPT_TEXT_NOT_COMMITTED`, run one `runner.step({final: true})` (it re-syncs the mirror and decodes nothing).
2. The transcriber seam: `transcriberSeam` in `src/sealing/__tests__/support.ts:91` is the reference adapter (`assembleTranscript` + the checkpoint's `errorCode` of FAILED chunks; `ASSEMBLY_REFUSED / TRANSCRIPT_NOT_COMPLETE` -> `NOT_READY`). Row 115 owns the production composition.
3. `sttSnapshot` = the session-start snapshot (row 115). Never the configuration as it is now.
4. The item INSERT (rows 82/83) carries `itemColumns`, then `commitSealedTranscript(createTranscriptStore(unitOfWork), …)` on the same connection.
5. `BUILD_MANIFEST` places `transcript.manifest` as it is; copies `files.{json,srt,vtt}` to `transcript/`.
6. Row 82 may adopt or replace `createSealingStepJournal` for the other steps.
7. On `TRANSCRIPT_HASH_MISMATCH` after a commit RECOVERY decides: `assembleTranscript` rebuilds a damaged file only with the recorded hash, then the step is retried. The step never repairs by itself.

## 5. Decisions taken (for the controller)

| ID | Decision | Confirm |
|---|---|---|
| D-79-1 | Sealing steps live in a new top-level unit `src/sealing/` (file system needed; modules and `src/capture` may not import it — guards G-R1/G-R2) | yes |
| D-79-2 | `failedChunks` = the document's count; rows counted by the attempt rule beside it, difference logged, never blocking | yes (ev §B.7 field 93 source text is an erratum) |
| D-79-3 | Text guard is blocking: a segment no DONE row holds fails the step. Every DONE row counts, also of an earlier plan (N-6), so a rebuilt checkpoint cannot block a seal | yes |
| D-79-4 | A tampered committed transcript is refused, never auto-repaired by the step | yes |
| D-79-5 | `backendUnreachable`: `UNREACHABLE`, plus `TIMEOUT` on the server backend only | yes |
| D-79-6 | Slice summary gains optional `failedChunks`, `backendUnreachable`; `partialReason` is not added (it is in the document header and the step answer) | yes |
| D-79-7 | The summary is a projection of the MANIFEST block. No item column holds `transcript.state` / `failedChunks`: after a reset rebuilds `sealing_jobs`, a reader takes them from the sealed manifest (row 85) | yes — or a column, row 129 |
| D-79-8 | N-4 fixed in the planner; new optional checkpoint member `openRunUntilSample` | yes (tx §A.2 erratum) |
| D-79-9 | A session the transcriber has no checkpoint for is `TRANSCRIBER_FAILED`, not a wait | yes |

Requests filed (`delegation_progress/file_requests.md`): row 129 mapping — `labels_status` and `manifest_version` for a DISABLED v2 item (today derived from the hash, which stores 1); two already-applied shared edits listed for review.

## 6. Device / browser checks left for the gate (D89 flows)

One flow, after rows 82/83/85/115: record a short session on each backend -> stop -> seal -> open the item: transcript state READY with the hash; verify passes with the transcript inside the package (M6-TF-1 criterion 5). Second flow: STT backend stopped before the session -> seal completes, item shows PARTIAL with the failed-chunk count and no transcript text for the missing stretch (M6-STTCFG-UNREACH). Third: STT disabled -> seal does not wait, item shows DISABLED (M6-STTCFG-OFF). Kill matrix cell for the Core process at `FINALIZE_TRANSCRIPT` belongs to row 82 (M7-KM).

No commit. No migration. No lockfile write. oMLX not started. `masterplan/*`, `status_tasks.md`, `delegation_progress_report.md` not edited.

---
*Generated: 2026-10-09 17:00 (+07:00)*
