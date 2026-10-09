# coder-execution - integration pass B (D112)
status: complete

Files changed (all under apps/core-server/src/transcription/):
- statements.ts (new)
- snapshot.ts (createDatabaseSnapshotStore; head comment)
- index.ts (default store = database; export)
- session.ts (one comment)
- __tests__/snapshot-store.test.ts (new, unit)
- __tests__/snapshot-store.db.test.ts (new, db)
- __tests__/session.test.ts, __tests__/encrypted-credential.test.ts (pass the memory store explicitly)
Not touched: db/**, modules/stt-config, src/sealing, apps/transcriber, packages/shared, test/static/imports.test.ts.
Note: docs/2026-10-07_dems_real_capture_sealing/implementation/91_integration_pass_b.md
