# 98 — Integration pass D4: the remaining contract operations and seams (decisions D146 to D149, D153)

Date 2026-10-09. Agent: coder-execution. Baseline `e296ce7` plus the wave D tree. No commit, no
migration (schema 5 / `dbc-6` asserted in each db file). Each check ran once after its last
change; a second run only after a fail or a later edit of the same file (D122).

## Items

| # | Item | Status | Where |
|---|---|---|---|
| 1 | Op 82 `listAudioSourceIntervals` | done | `apps/core-server/src/modules/sessions/audio-intervals.ts` (new), `routes.ts`, `operations.ts`; shared `sim/api.ts` (`audioSourceIntervalsOf` exported) |
| 2 | Ops 84 / 85 / 86 | done, with two blockers outside the pass (below) | `src/modules/transcripts/{routes.ts,revision-body.ts,store.ts,index.ts}`, new closed unit `src/transcript-package/`, mount in `app.ts` |
| 3 | `contract.test.ts` | 37 of 38 green; coverage red on two cells that are not op 83 | `test/acceptance/contract.test.ts`, `contract.transcripts.ts` (new); AC-B-70: the SIMULATOR was the wrong side |
| 4 | `rbac-matrix.test.ts` AC-B-16 | done, 39 of 39; every cell accounted | literal `{13, 0, 3}` with the cells by name |
| 5 | INTERNAL registry entries | storage volume NOT built (four files outside the pass, request filed); seal transitions removed from the pass by D147 | — |
| 6 | `db/mapping` | done: F-82-3, F-82-4, transport of a de-selected device | `src/db/mapping/{rows.ts,changes.ts}`, `sim/types.ts` (`EvidenceSignature` = the two pairs) |
| 7 | Op 42 / 88 server lines | not in the pass's area: `modules/evidence/index.ts` (row 91), `media-stream/service.ts` and `modules/evidence/media.ts` (row 90) — listed | request lines stand |
| 8 | Sessions MODG test | done (D1b's change, adapted: op 81 is in `CAPTURE_SESSION_OPERATION_IDS`) | `modules/sessions/__tests__/routes.test.ts` |
| 9 | Development-key line (D147) | done | `packages/shared/src/evidence-verify/{report.ts,types.ts,verify.ts}`, `api/evidence.ts` (`signature.developmentKey`), `src/evidence-verify/index.ts` |
| 10 | `integration-c1.test.ts` (D148) | done | the case now holds the new start rule |
| 11 | Op 42 `jobId` (D149) | contract + simulator existed since D1b; `ExportResult.jobId?` added; the server line is row 91's | request answered |
| 12 | Row 82b's pins (D153) | done: `DEFERRED_ROUTE` empty, sessions MODG admits op 83 by name, guard stub for `modules/sealing`, P25 index 18 -> 19 | four test files |

## What was decided while building

1. **Op 82.** The open session only (404 otherwise, decided on the committed state). Capture mode
   `real`: the rows of `session_audio_intervals`, newest first, cursor = the interval number.
   Capture mode `simulated`: the shared simulator's own derivation, so both answer one list for one
   state. The derivation listed the STANDBY as the first interval of an unswitched session: fixed.
2. **Ops 84 to 86 answer for an item whose seal committed a `transcripts` row** (a REAL v2 package
   with a machine transcript). Every other item answers `409 TRANSCRIPT_NOT_READY`. The simulator's
   in-memory revisions of a simulated item have no stored form (no table holds a revision's text),
   so the Core does not offer them.
3. **A revision never overwrites the sealed transcript.** One INSERT into `transcript_revisions`,
   one `TRANSCRIPT_REVISED` row in the same unit, one record appended to the package's
   `transcript-revisions.json` (staging file + rename, last act of the unit). Proof on a real
   package: SHA-256 of `session-manifest.json`, `signature.sig`, `device-certificate.pem`,
   `transcript.json` / `.srt` / `.vtt`, `fragments.json` and the columns `transcript_sha256`,
   `manifest_hash`, `signature_value`, `json_sha256` equal before and after two revisions; the
   product verifier passes all checks before and after (V-10, V-11 with the table's count).
4. **The body.** `dems.transcript-revision/1`: schema, evidenceId, revisionNo, baseRevision,
   parentSha256, machineTranscriptSha256, authorId, reason, createdAt, changes. Everything a reader
   is shown is inside the hash the Core key signs. Op 86 answers `changes` only from a body whose
   hash is the stored hash.
5. **`note` is required by the Core** (5 to 500 characters; the table's rule). Absent or short:
   `422 INVALID_INPUT`, `reason: REVISION_REASON_REQUIRED`. The Core never writes a reason itself.
6. **File system.** Static rule G-R1 forbids it in a module: the package files are the new closed
   unit `src/transcript-package` (one `CLOSED_UNITS` entry).
7. **Mount.** `modules/transcripts` is registered in `app.ts` (one import, one unit line) with its
   pins (scaffold, P25 waived list, guard stub), as rows 90 / 91 did. To be confirmed.
8. **AC-B-70.** C3 §3 row 39 and ev §A.1: a v2 item's `files` are the two camera files; the audio
   is inside them. The simulator listed a third "file" `AUDIO-01`: removed
   (`EVIDENCE_FILE_TRACKS`). Row 82's product seal (tracks, no `files`) agrees. The block now also
   leaves interval lists (a history, one microphone per interval) out of the pair rule.
9. **Transport.** De-selecting is not un-registering. A device the state holds no transport for is
   written by an UPDATE of the modelled columns that moved; `transport` is never one of them.
10. **Real signature.** Admitted on the way back only for `integrity_source` REAL and
    `manifest_version` 2; every other pair is refused as before.
11. **Development-key line** stands after the source block (the source line and its entries),
    before the verdict — not between the source line and its own entries.

## Findings (each has a request line, 16:24:16Z)

| # | Finding | Evidence |
|---|---|---|
| F-D4-1 | **V-11 does not hold a revision record to its body.** `body` is optional (a record with its body removed passes); `authorId` / `reason` / `createdAt` of the record are compared with nothing. Against ev §C.1 and tx §A.6. `verify.ts` `checkRevisions` :630-637, `revisions.ts` :35-46 | measured on a real package, `transcript-routes.db.test.ts`, last block of op 86 |
| F-D4-2 | **Op 85 cannot store a revision signed with the product key.** `transcript_revisions.signature_key_id` takes the CODE form; the key is `CORE-KEY-EVSIGN-01`. Answer: `503 SIGNING_KEY_ID_NOT_STORABLE`, nothing stored. Needs a migration or a key ID decision | same file, last block |
| F-D4-3 | **The session-holder fact reads a column that is always NULL.** `permission-guard/session-holder.ts` reads `started_by`; the mapping writes it NULL. The creator of a session is refused op 81; only a SUPERVISOR passes | contract walk, first run |
| F-D4-4 | Op 81, simulated mode, unknown input: Core 404, contract 409 `AUDIO_SOURCE_CONFLICT` | contract walk, first run |
| F-D4-5 | Interval `seq`: contract text and simulator from 0, table and manifest from 1 | `audio-intervals.db.test.ts`, first run |

## Results

| Check | Result |
|---|---|
| `npm run test -w @dems/shared` (once) | 89 files: 2353 passed, 4 failed — 2 OpenAPI drift (regenerated, green), 1 parity pin (moved, green), 1 `live-source-platform-neutral` (pass D5's in-flight area) |
| OpenAPI regenerated under `npm.lock` | 97 operations, offline 31; totals unchanged |
| typecheck shared, core-server, core-web, mobile | 0 errors each |
| lint shared, core-server | clean |
| core-server unit: `test/static`, capture static, permission-guard, sessions, transcripts, evidence MODG, evidence-verify, db/mapping, hosted-actions | 42 files, 946 passed |
| db (lock `db-migrate`): `integration-d4.db` 5, `audio-intervals.db` 4, `transcript-routes.db` 11 | green |
| `rbac-matrix.test.ts` | 39 of 39 |
| `contract.test.ts` | 37 of 38; coverage 455 of 457 cells |

### `contract.test.ts` blocks

| | Red | Green |
|---|---|---|
| After pass D1b | 12 | 25 |
| After pass D4 | **1** | 37 (one new block: the transcript) |

Red before: router = registry; area 4; 401; 403; 404 / 405; DEMO_DISABLED + grant removed; no GET
writes; U+0000; coverage; SC6 "every answer validated"; "the error codes"; AC-B-70.
Red after: **coverage**, on `createEvidenceMediaSession 201` and `resetDemo 409` (neither is op
83; neither was entered into `NOT_PRODUCED`). Op 83's cells are produced.
Cells added by this pass that no walk produced before: ops 81, 82, 83, 84, 85, 86, 87, three of
88, `CAPTURE_CONFIG_LOCKED` on 78 / 79 / 80 / 89, `setCaptureCameraSource 200`.

### AC-B-16 cells (`{11, 0, 0}` -> `{13, 0, 3}`)

| Operation | Rule | INVESTIGATOR | TECHNICIAN |
|---|---|---|---|
| 81 `switchAudioSource` | `SESSION_START` + `SESSION_HOLDER` | +1: holds the permission, is not the holder (no open session on the fixture) | +1 |
| 87 `getEvidenceExportJob` | `EVIDENCE_EXPORT` (SUPERVISOR only) | +1 | +1 |
| 85 `createTranscriptRevision` | `TRANSCRIPT_REVISE` (INVESTIGATOR, SUPERVISOR) | — | +1 |
| 82, 83; 84, 86, 88 | AUTHENTICATED; `EVIDENCE_VIEW` (every role) | — | — |

D1b's unexplained second INVESTIGATOR cell is op 81's condition; the support function counts it by
design (`rbac-matrix.support.ts` :265-269). The test now names the cells per role.

## Not proven / left

- Op 85 with the product signing key (F-D4-2). Everything else of op 85 ran with a key whose ID
  both rules take, through the seam `provideRevisionSigner`.
- Op 85 does not move `transcript.revision` in the replicated `evidence` slice (needs an engine door).
- A commit that fails after the package file was replaced: handled by rule (`reconciled`), proven
  on a constructed file, not by a failing commit.
- Op 82 in capture mode `real` was read through a real-mode boot with rows planted by the unit's
  own statements; no capture worker wrote them.
- Storage volume action (item 5); the fault key (held: migration).
- Row 82's `seal-actions.db.test.ts`: its two MEASURED expectations (:132, :221) are red by design
  now and must flip. Not edited.

## Device / browser checks for the gate

None of this pass's own. Row 92's transcript pane and revise form against a Core need a real
sealed item with a transcript and the decision on F-D4-2.
