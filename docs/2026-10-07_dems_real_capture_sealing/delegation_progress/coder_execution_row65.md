# coder-execution — row 65 (adapter layer) — 2026-10-09

Status: needs-review. Report: `implementation/25_m4_adapters.md`.

- Built: `apps/core-server/src/capture/adapters/**` (16 production files, 6 test files).
- Edited outside the folder: `src/capture/__tests__/static.test.ts` (file-list pin split, one hunk); `src/db/store/store.ts` (four SET-list lines removed, one comment added) — done BEFORE the D95 message; not touched since; row 129 owns it.
- Not built: worker-side lateness bound (D85 R-3) — request line in `file_requests.md`.
- Not run: browser form of `M4-SEL-W`.
- Foreign red seen: `test/static/imports.test.ts` open-unit list now holds `src/credential-store` (row 84).
- No commit, no dependency, no lockfile write, no port in the barred ranges, `.data/pg*.env` not read. Database runs: 4, each under `.locks/db-migrate.lock`, sandbox off for loopback.
