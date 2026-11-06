---
task_id: 2026-10-12_input_av_core_adapter_plan
row: 191c
date: 2026-10-13
agent: coder-execution (driver)
tier: T3
builds_on: implementation/191b_audio_gap_in_evidence.md; implementation/v4_fourth_contract_step.md (item 6); decisions C57, C73, C83
status: complete on the generated microphones (three driver decisions to confirm, section 8; row 191b's first remainder stays open, section 7)
---

# Row 191c: audio absent across a worker restart, under the signature

Tier 3: what was built, where, and the output that shows it. Paths are relative to `/Users/gsp-budi/Documents/DEMS`; `CS` = `apps/core-server`. No microphone and no camera of this Mac was opened: every source is a double or a generated fixture.

## 1. Result

| Point of the row | Before | After |
|---|---|---|
| (1) the signed manifest | two `audio.sourceIntervals` of reason START; the gap in ms only in the unsigned extract | `audio.absentOnRestart`: one record per restart - `earlierAttempt`, `laterAttempt`, `absentAtLeastMs`, `absentAtMostMs` - inside `manifestSha256` and under the signature |
| (1) a session without a restart | - | NO such member; the manifest is byte for byte the one of before (section 4) |
| (2) the transcript's interval read | rows as stored: a superseded row that kept a span named its microphone, or overlapped the later row | every row before the LAST row of reason START is stated 0..0 - the seal's rule; no chunk is attributed to it |
| (3) verify and export | - | the Core's verify PASS (15 of 15), PACKAGE export COMPLETE, receiver's verify ok (7 of 7), on a product-sealed restart session - unit and scenario |

## 2. Where the bounds are read from

**From the session's stored audit entries, through the read the seal already makes.** `sealing-host/session-reader.ts` reads the audit rows of the session once (`READ_SEAL_AUDIT_ROWS`, unchanged) for `audit-session-extract.jsonl`. The new function `audioRestartGapsOf` takes, out of THE SAME rows, those of type `CAPTURE_AUDIO_ABSENT_ON_RESTART` and states one record per row in the order of the chain: `details.earlierAttempt`, `details.laterAttempt`, `details.audioAbsentAtLeastMs`, `details.audioAbsentAtMostMs`. A bound the entry leaves out (row 191b: its instant was unknown) is `null` in the manifest.

- No second statement, no other table, never the error log. The reader test counts the statements.
- **`capture-session/statements.ts` is NOT changed and no stored field was needed**: the reader of the sealing unit read `audit_log` for this session before this row (the extract). No closed-unit rule is met by a new read, because there is none.
- The signed numbers and the extract's numbers are therefore the same rows: they cannot differ.

## 3. What was built

| File | Change |
|---|---|
| `CS/src/sealing/pipeline/contract.ts` | ONE optional member of `SealSessionFacts`: `audioRestartGaps?: readonly ManifestAudioRestartGap[]` |
| `CS/src/sealing/pipeline/pipeline.ts` | `liveInput`: the audio block gains `...(restartGaps.length > 0 ? { absentOnRestart: restartGaps } : {})`; each record is copied to its four keys |
| `CS/src/sealing-host/session-reader.ts` | NEW `audioRestartGapsOf` and the constant of the audit type; the facts carry `audioRestartGaps` only when there is one; one header line |
| `CS/src/transcription/index.ts` | `READ_SESSION_INTERVALS_FOR_TRANSCRIPT` also selects `reason`; NEW `transcriptIntervalsOf` (the rule); `intervalsOf` calls it |

The member is part of the FROZEN input of BUILD_MANIFEST (the snapshot of fix F-M7), so a resumed build signs the same member although the session record is not read again (tested).

**Point (2), how the transcript maps time to a source.** `apps/transcriber/src/pipeline/runner.ts:304` (`audioSourceAt`): a chunk names the ONE interval with `fromMs <= start < toMs`; none or more than one gives no source and the flag `intervals_incomplete`. The document lists the intervals as handed in. Both take them from `intervalsOf` (`transcription/index.ts`), the one read that was changed. Stored rows of a session with a switch before the restart: `START MIC-x 0..15000`, `MANUAL 15000..15000`, later `START 0..open` - read as stored, every chunk below 15 s was covered twice. Nothing in `apps/transcriber` was changed.

## 4. THE BYTE-IDENTITY PROOF (a session without a restart)

Instrument: `.cache/task4-row191c/identity.test.ts` (in no commit). The PRODUCT pipeline seals the fixture session of `sealing/__tests__/pipeline-support.ts` (fixed session ids, the manual clock, the position-derived nonces of that support file). The two random inputs of a seal - `randomBytes` and the Ed25519 pair of the throw-away signer - are made a function of their call order in that file, so that two PROCESSES seal the same bytes; synthetic values, removed with the temporary directories.

Run twice on the tree BEFORE any edit of the row (the instrument's own control: two processes agree), once AFTER:

```
fixture "switch" (START 21..4021, MANUAL 4021..open)   session-manifest.json 10582 bytes
  before   ddbb4fe46ecc4ad1d2ce69de67502630df39fe98f17ef83a1508b6e5e299a73c
  before2  ddbb4fe46ecc4ad1d2ce69de67502630df39fe98f17ef83a1508b6e5e299a73c
  after    ddbb4fe46ecc4ad1d2ce69de67502630df39fe98f17ef83a1508b6e5e299a73c
fixture "one-interval" (START 21..open)                session-manifest.json 10444 bytes
  before   b6da3099d19aafeadf5639f178c9111793c6dbd4930c1450a228cd734d1d92e0
  before2  b6da3099d19aafeadf5639f178c9111793c6dbd4930c1450a228cd734d1d92e0
  after    b6da3099d19aafeadf5639f178c9111793c6dbd4930c1450a228cd734d1d92e0
cmp before.*.manifest.json after.*.manifest.json : identical, both fixtures
cmp before.*.signature     after.*.signature     : identical, both fixtures
```

SEAL of each of the six fixture seals: `SEALED`. Beside it, in the committed suite (`pipeline.test.ts`): the same recording sealed with the member absent and with an EMPTY list gives equal bytes that do not contain `absentOnRestart`; its control - one gap record changes the bytes.

## 5. The scripted scenario (run `r191c-s1`, worker killed after `STARTED`)

Row 191's instrument reused in place (`.cache/task4-row191/restart.db.test.ts`): one block that runs only under `ROW191C=1`. `ROW191B=1 ROW191C=1 sh .cache/task4-row191/run.sh settled r191c-s1`, both locks, one hold: `Test Files  1 passed (1)`, `Tests  1 passed (1)`, `0 remain`.

| Fact | Value |
|---|---|
| stored audit entry `CAPTURE_AUDIO_ABSENT_ON_RESTART` | `earlierAttempt` 1, `laterAttempt` 2, `audioAbsentAtLeastMs` 292, `audioAbsentAtMostMs` 625 |
| SIGNED `session-manifest.json`, `audio.absentOnRestart` | `[{ earlierAttempt: 1, laterAttempt: 2, absentAtLeastMs: 292, absentAtMostMs: 625 }]` |
| `audio.sourceIntervals` | seq 1 START 0..0; seq 2 START 21..8591 |
| `timeline.recordingDurationMs` / `tracks[].durationMs` | 10,053 / 8,663 and 8,664 (unchanged by this row, section 7) |
| the Core's verify (operation 41, as a supervisor) | `ok` true, `PASS`, 15 checks, none not passing |
| export (PACKAGE, by the route) | `COMPLETE` |
| receiver's verify of the unpacked archive | `ok` true, 7 checks, none failing; the received manifest equals the sealed one byte for byte and holds the member |

**THE SEAL, as a fact: `SEALED` 1 of 1** - six steps `DONE` at attempt 1, `SEALING_COMPLETE`, no `WRITE_FAILED`, no retry. An operator-stopped session; the INTERRUPTED path of row 184 was not run and nothing of it was touched. After the run: no worker, no helper left, no open source.

The receiver's trust anchor in the scenario is the certificate fingerprint the sealed manifest names, read from the Core's own package (a development key). What a receiver holds out of band is not this row's subject.

## 6. Checks

From `CS`, `--maxWorkers=2`; loopback, database and process runs with the command sandbox off.

| Check | Result line |
|---|---|
| unit: `pipeline.test.ts`, `sealing-host.test.ts`, `session-run.test.ts`, `export-one-camera.test.ts` | `Test Files  4 passed (4)`, `Tests  118 passed | 1 skipped (119)` |
| static set + the unit suites of the touched areas (`test/static`, `capture/__tests__/static`, `core/__tests__/static`, `engine/__tests__/static`, `sealing-host`, `sealing`, `transcription`, `evidence-export`, `evidence-verify`) | run 1 (sandbox on): `13 failed | 1068 passed | 1 skipped (1082)` - 12 are loopback binds refused by the sandbox (`probe.test.ts`, `encrypted-credential.test.ts`), 1 is `search-path.test.ts`; run 2 of those three files, sandbox off: `1 failed | 21 passed (22)` - the one is NOT this row's (below) |
| database (db-migrate lock): `session-capture.db.test.ts`, `sealing-host/__tests__/e2e/seal-e2e.db.test.ts` | `Test Files  1 passed | 1 skipped (2)`, `Tests  94 passed | 3 skipped (97)`, `0 remain` - the skipped file runs only under `DEMS_SEAL_E2E=1` (its own rule) |
| byte identity (section 4) | 3 runs, `Tests  1 passed (1)` each; `cmp` identical |
| scenario `r191c-s1` (section 5) | `Tests  1 passed (1)` |
| `npx tsc --noEmit` (after the last edit) | two error lines, NEITHER in a file of this row (below) |

New cases, each in the file of its subject: `pipeline.test.ts` +4 (the member and verify PASS with the tamper control; no restart = no key; frozen with the build; a record the manifest refuses fails the seal and signs nothing), `sealing-host.test.ts` +3 (the records out of the audit rows; the control without an entry; a malformed entry throws), `session-run.test.ts` +1 (the transcript across a restart, with the rule's two controls), `export-one-camera.test.ts` +1 (export and receiver's verify of a product-sealed restart package). No existing case was edited.

**Reds seen, not mine, files not edited:** `test/static/search-path.test.ts:94` (the list gained `src/db/migrations/0027_alias_removal_reasons_privileges.sql`; row D2, in flight). Typecheck: `src/capture/boot/__tests__/boot.test.ts(20,23)` TS2305 and `src/capture/boot/__tests__/support.ts(95,3)` TS2739 (the boot fixture, another row in flight); a first typecheck in the row showed three lines in `src/modules/capture-config/factory-scan/index.ts` instead, gone at the end.

## 7. Not built, not proven

| What | Where it goes |
|---|---|
| The `timeline` of a restarted session (`recordingDurationMs` spans the session; `durableEndMs` of an INTERRUPTED restarted session) | row 191b's first remainder, STILL OPEN; request line 2. The member states the audio gap (292..625 ms here), not the whole difference to the files (about 1.4 s: the later worker's start-up) |
| The window between the restart and the later worker's START row, in the transcript | until that row exists the read cannot know of a restart: with a switch before the restart the earlier START row keeps its span for those few hundred ms. No audio is delivered in that window (it IS the gap); a chunk cut there was not seen |
| A switch before a restart, end to end | the read is tested on rows and through the runner with a tap; no scenario with the worker |
| Two restarts in one session, end to end | records in order are tested at the reader and the seal; one restart in the scenario |
| An INTERRUPTED restarted session | not run (row 184's diagnosis row) |
| A receiver's verifier that predates V4 | refuses a package that carries the member (V4's statement; in the limit text) |
| `REAL_PRODUCTION` with real cards | `9A/H-07`, `H-08` |

README known limit 7: the new text is request line 1 of this row in `delegation_progress/file_requests.md`.

## 8. Driver decisions (for the controller)

1. **The bounds come from the audit rows the reader already reads**, not from a new stored field: no statement, no schema, no grant changed.
2. **A malformed gap entry stops the seal's read** (throws) instead of being skipped or stated as "not measured": a seal that signs fewer restarts than the audit chain holds would be a false statement under the signature. The audit writer enforces the form (V3), so the case needs a damaged row.
3. **The transcript states superseded rows 0..0 and keeps them in its interval list** (the seal's rule, so document and manifest agree), instead of leaving them out.

## 9. Rules kept

Edit tool only for every existing file (four product files, four test files, row 191's scenario file, two shared documents); new files with Write (this record, `row_191c.md`, the two files of the identity instrument under `.cache/task4-row191c/`). Nothing committed, staged or reverted; no full suite. NOT touched: `sealing-host/index.ts`, `capture/signer`, `packages/shared`, `capture-session/statements.ts`, any schema, anything under `apps/transcriber` or `apps/capture-worker`. Heavy-host lock for the one scenario run, db-migrate lock for every database run; throw-away databases only (`0 remain`); worker listeners 127.0.0.1:8559 / 8561; never ports 4423 / 5178; no `.env` read; no real device; no key left behind.

---
*Generated: 2026-10-13*
