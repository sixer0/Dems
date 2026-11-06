# Row 215c - review fixes (B-01, C-2 / F-10 (a), F-03, F-02, F-01)

Status: **complete**. Record: `implementation/215c_review_fixes.md`.

| Item | Result |
|---|---|
| 1 B-01 | done: 5 sessions x 2 targets refused `ROLE_NOT_RUNTIME`, prompt port 0 calls, nothing written. With the check removed: `5 failed \| 54 passed (59)`; check back in place: `59 passed` |
| 2 C-2 / F-10 (a) | done: `REPEAT_CHECK_LOST` (refusal word), `SetPasswordRun.repeatCheckLost`, one error-log entry (code, operator id, count); the walk stops; 4 cases |
| 3 F-03 | done: 6 of 6 refusals reached without a new seam under the command (11 cases); `DEMO_PASSWORD_REMAINS` is reachable, kept, commented |
| 4 F-02 | done, tests only: `STORE_NOT_AS_WRITTEN` (8 rows), `SUBJECT_MISMATCH` (2), `FAILED` (2), nine directory codes, the "a file" case |
| 5 F-01 | done: NEW `capture/boot/__tests__/one-load-mount.test.ts` (5 cases); on a scratch copy of the mount with two loads `3 failed` of 5; `boot/index.ts` not edited; re-run on row 228's state: 5 passed |

Checks: owned unit tests `107 passed (107)` in 4 files; the command's database tests `16 passed (16)`, 0 databases left; typecheck 0 errors; static files 350 of 353 (reds not this row's: `test/static/search-path.test.ts:94` names `factory-scan/service.ts`, row 107; `capture/__tests__/static.test.ts:406` SR-2, seen once).

Driver decisions to confirm: D-1 a lost repeat check after the LAST password is said, logged and in the result, the exit code stays; D-2 the guard is doubled with `vi.mock` of one function, no product seam; D-3 one additive member `installationId: INSTALLATION` in the existing boot case of `production-key.test.ts`, which row 228's check 4b-2 had turned red.

Edit-only rule kept (existing files by the Edit tool; new files by Write; the two scratch files of the proof were made and removed by this row). Nothing committed. No file under `.data/` opened by this agent; every key and value synthetic and removed.

Requests in `file_requests.md`: none.
