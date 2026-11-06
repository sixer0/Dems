# coder-execution - closing pass F-X

- Status: **needs-review** (2026-10-10). Note: `implementation/117_closing_pass_fx.md`.
- Done: 1 (contract walk green 38/38, op 41 / 33 texts, errata PE-FX-01 / -02, HTTP test of op 33), 2 (op 87 from stored rows, restart test), 3 (player tests, mobile + web), 4a (R74-14 (1) wiring test), 4b (R74-08, contained latch), 5 (advisory raised), 6 (sendingDeviceId), 7 (one `exportJobIdOf`), 8a (R80-08, staged file + boot reconcile).
- Not built, risk paragraph written: R74-14 (2), R80-05.
- Item 9: both typecheck errors are gone on this tree; nothing changed.
- Sub-drivers (coder-execution): item 2, item 3, item 8; their results were read and their files exist.
- Files: the two "pass F-X" lines of `delegation_progress/file_claims.md`.
- Open for the controller: decisions 1, 2, 4, 5 of the note (R80-08 without a body column; V-14 on a pending staged file; `'TABLET'`; 503 on a failed stored read).
- Red from another pass, not fixed: `apps/core-server/src/capture/__tests__/static.test.ts` (ONVIF facade exports).
