# Row 191c - the signed audio gap (driver)

Status: **complete** on generated microphones. Record: `implementation/191c_signed_audio_gap.md`.

- **Built:** the seal writes `audio.absentOnRestart` (one record per restart: attempts, both bounds in ms) into the SIGNED manifest; a session without a restart seals no such member. The transcript's interval read states every row before the last START row 0..0 (the seal's rule).
- **Bounds read from:** the session's stored audit entries `CAPTURE_AUDIO_ABSENT_ON_RESTART`, out of the rows `sealing-host/session-reader.ts` already reads for the extract (`READ_SEAL_AUDIT_ROWS`). No statement, schema or grant changed; `capture-session/statements.ts` untouched.
- **Files:** `apps/core-server/src/sealing/pipeline/pipeline.ts`, `contract.ts`; `src/sealing-host/session-reader.ts`; `src/transcription/index.ts`; tests extended: `sealing/__tests__/pipeline.test.ts` (+4), `sealing-host/__tests__/sealing-host.test.ts` (+3), `transcription/__tests__/session-run.test.ts` (+1), `evidence-export/__tests__/export-one-camera.test.ts` (+1); `.cache/task4-row191/restart.db.test.ts` (block under `ROW191C=1`); NEW `.cache/task4-row191c/` (identity instrument, in no commit).
- **Byte identity:** two fixtures without a restart, sealed before (twice) and after: `session-manifest.json` identical (`cmp`; sha256 `ddbb4fe4...` 10582 bytes, `b6da3099...` 10444 bytes), signature files identical.
- **Checks:** unit 4 files `118 passed | 1 skipped`; static set and area suites 1068 passed, the one remaining red `test/static/search-path.test.ts:94` is row D2's migration 0027; database `94 passed | 3 skipped`, 0 remain; scenario `r191c-s1` `1 passed`; typecheck: two lines in `capture/boot/__tests__` (another row), none in this row's files.
- **Seal per run:** identity fixtures `SEALED` 6 of 6; scenario `SEALED` 1 of 1 (six steps DONE at attempt 1, no `WRITE_FAILED`); INTERRUPTED path not run.
- **Scenario facts:** signed member `{1, 2, 292, 625}` = the stored entry; Core verify PASS 15 of 15; export COMPLETE; receiver's verify ok 7 of 7, manifest bytes equal.
- **Requests (3):** README known limit 7 new text; row 191b's first remainder (timeline) still open; reds of other rows.
- **Driver decisions (3):** bounds from the audit rows already read; a malformed gap entry stops the seal's read; the transcript keeps superseded rows as 0..0.
- Edit tool only for existing files; nothing committed.
