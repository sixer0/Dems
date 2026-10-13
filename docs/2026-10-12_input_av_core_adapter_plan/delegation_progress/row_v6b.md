# Row V6b (agent V6b, track D) - 2026-10-13

Status: complete, one driver decision to confirm. Record: `implementation/v6b_acceptance_clock_guard.md`.

- Item 1 (R119-08, operation 109): DONE. The INSERT carries its own condition (`INSERT ... SELECT $1..$9 WHERE NOT EXISTS (SELECT 1 FROM public.installation_acceptances AS stored WHERE stored.accepted_at > $1::bigint OR stored.revoked_at > $1::bigint) RETURNING ...`); no row answered = the clock is behind the record: 409, nothing stored, no entry, no persisted failure, one warning line.
- DRIVER DECISION: the contract lists `INSTALLATION_CLOCK_BEHIND_RECORD` for operation 110 only, so operation 109 answers the nearest reason it has, `INSTALLATION_ACCEPTANCE_IN_FORCE` - inexact when none is in force. Request line `row V6b` in `file_requests.md` (the member for 109, then one constant of the Core).
- Static rule: ONE named entry (`CLOCK_FLOOR_ENTRY` in `installation-acceptance/__tests__/service.test.ts`, word for word, with its purpose) and a planted-control case.
- Item 2 (R119-09): DONE. `onvif-network.ts`: `authorizedAsk` answers before arming when the call is settled; `arm` does nothing on a settled call. One appended test, red before the fix.
- Checks: folder unit 27 passed; folder database 16 passed (second run; first 1 failed, a count pin of the file); camera unit suite 304 passed; static set and folder unit 654 passed; typecheck exit 0; the acceptance pair with the folder's database tests 208 passed, 3 failed - none of this row (the OpenAPI byte comparison while `packages/shared` is being written; two lines "Row T3 (X-07)" of `camera-adapter-open.db.test.ts`).
- Mistake: that last command ran `camera-adapter-open.db.test.ts` (real relay and worker) without `.locks/heavy-host.lock`.
- Not touched: `packages/shared`, the schema, row B1's reply guard. Existing files: Edit tool only.
