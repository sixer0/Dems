# Row 143c - progress

Status: complete (doubles on this Mac). Record: `implementation/143c_watch_and_candidate_bind.md`.

- Built: the camera watch's time read is bound to the rule's source address (heartbeat, `check`, `clockOffsetMs`); a missing source is the existing refusal, nothing sent. Under `REAL_PRODUCTION` the connection test of an unstored candidate (operations 95 / 96) and its stream probe are bound to the camera-interface address or refused before the bounds (C65); other capture operations unchanged, existing tests unedited.
- Checks: unit 440 of 444 on run 1 (4 reds in my new cases), fixed and green; loopback unit 92 passed; database 58 passed and 18 passed (real relay + test camera), `0 remain`; `tsc rc=0`.
- Out-of-area edits, declared: `connect/index.ts`, `capture-discovery/index.ts` (one export line), `stream-test.db.test.ts`, `capture-composition.db.test.ts`.
- Driver decisions: the candidate is judged by the STORED_CAMERA binding; every rule refusal is `409 CANDIDATE_NOT_TESTABLE`; no rule or no bindable tester is `503 DISCOVERY_NOT_READY`.
- Unproven: two-interface host (9A/H-09 to H-11); the routes on a booted production Core (rows 86 / 88).
- Edit tool only for existing files; new files with Write.
