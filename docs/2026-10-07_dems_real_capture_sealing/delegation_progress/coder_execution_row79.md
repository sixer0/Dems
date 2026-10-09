# coder-execution — row 79 (M6-W4, transcript <-> sealing)

Status: **complete** (software half; the step is called by nothing until row 82).
Note: `implementation/36_m6_transcript_seal.md`.

## Files created
- `apps/core-server/src/sealing/index.ts`
- `apps/core-server/src/sealing/step-journal.ts`
- `apps/core-server/src/sealing/finalize-transcript/{contract,handler,document,commit,files}.ts`
- `apps/core-server/src/sealing/__tests__/{support.ts,finalize-transcript.test.ts,finalize-transcript.db.test.ts}`
- `apps/core-server/src/modules/transcript-chunks/attempts.ts`
- `apps/transcriber/src/__tests__/row79-carried.test.ts`
- `.cache/stt/checks/row79/mutation-red.py`, `mutation-red.json` (not in git)
- `docs/.../implementation/36_m6_transcript_seal.md`, this file

## Files changed
- `apps/core-server/src/modules/transcript-chunks/index.ts` (one export line)
- `apps/transcriber/src/pipeline/{chunker,runner,checkpoint}.ts` (N-4)
- `apps/transcriber/src/__tests__/chunker-clamp.test.ts` (two exact-shape expectations gained `openRunUntil: null`; six N-4 tests added)
- SHARED `packages/shared/src/api/state-slices.ts` (two optional members, one Edit); `packages/shared/openapi/openapi.json` (regenerated under `.locks/npm.lock`, 9 added lines)
- SHARED `apps/core-server/test/static/imports.test.ts` (`CLOSED_UNITS` entry `src/sealing`, on the coordinator's instruction)
- On the coordinator's mediated request: schema pin `[3, 'dbc-4']` -> `[4, 'dbc-5']` in `modules/transcript-chunks/__tests__/transcript-chunks.db.test.ts:66` and `modules/transcripts/__tests__/transcripts.db.test.ts:166` (and the two test titles); both files green under the db lock

## Results
- core-server unit (sealing + transcripts + transcript-chunks): 58 passed; db, same three folders: 75 passed, 0 databases left
- transcriber: 9 pipeline files 356 passed; kill-resume 6 passed / 1 skipped
- shared: 6 files 451 passed
- mutations: 13 of 13 red
- static guards of core-server: no failure names `src/sealing`, `modules/transcripts` or `modules/transcript-chunks`

## Open for the controller
- Decisions D-79-1 .. D-79-9 (note §5)
- Request to row 129: `labels_status` / `manifest_version` in the item mapping (a DISABLED v2 item is stored as version 1 today)
- Not closed here: M6-TF-1 criterion 5 (needs the package: rows 82/83/85); a SIGKILL of a Core process at FINALIZE (row 82's kill matrix)
- Left to rows 83/85: revision body, signature, op 85, `transcript-revisions.json`
