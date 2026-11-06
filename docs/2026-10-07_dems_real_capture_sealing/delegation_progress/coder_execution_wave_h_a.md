# coder-execution - wave H driver A (integrity core)

- Status: **needs-review** (all findings of the brief handled; decisions and spec defects open; one tree incident reported).
- Note: `implementation/120_fix_wave_h_a.md` (findings table, the 119-field table, spec defects, decisions, runner checks, re-gate list).
- Claims: `delegation_progress/file_claims.md`, two lines `wave H A`.
- Requests filed (`file_requests.md`, 10:20:55Z, four lines): wave H B (banner, storage panel, GNSS chips); controller (the `time` slice in real capture); controller + API owner (checkpoint figures); spec owner (fields 13, 17-19, 22-23, 38-40, 53, 73 / B.8).
- Incident: an accidental `git stash` + immediate `git stash pop` in the shared tree at about 16:47 WIB (note 120 section 0). Restored without conflict; other drivers may have seen committed content for a few seconds.
- Not done by me: `seal-e2e.db.test.ts` and the whole db suite (handed to the test runner with what must show); no device / browser check.
- Outside my first claim, taken for C3: `apps/core-server/src/sealing/pipeline/{contract,pipeline}.ts`; `capture-session/index.ts` by decision D202.
