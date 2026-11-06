# Row 132 (R2.1 NEW) - coder-execution - complete

- T-13 verdict: op 78 ACCEPTS `{unassign:[PRIMARY], STANDBY: MIC-01}` (first run: 200, PRIMARY empty, STANDBY = MIC-01, 2 x CAPTURE_CONFIG_CHANGED scope MIC). Not refused.
- Finding on first run: moved line committed with transport `UNKNOWN`, stored `USB` (stored != committed). Fixed in routes.ts `withRegisteredTransports` (unassign first, R-2 shape), lines 399-408.
- Tests after fix: capture-config.db.test.ts 37/37 passed; routes.test.ts 28/28 passed.
- Typecheck core-server: red only in capture-inputs/audio-cards/service.ts:532 (TS2741 releasedDeviceId), not this row.
- PostgreSQL was stopped; started under db-runner lock, left running.
- Files: routes.ts (edit), capture-config.db.test.ts (edit), implementation/78_rflex_selector_mic_move.md (new), this file (new), file_claims.md (append).
- Deviation for controller: the fix was applied although op 78 did not refuse; it is the R-2 change (unassign first for mic lines, routes.ts only) answering the divergence T-13 exposed.
