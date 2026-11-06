# Row 226b (agent K2) - complete

- Choice: the signer re-asks the compromise mark and the active pointer before EACH signature (`host-key.ts`); the commands stay database-free. A moved pointer does NOT switch a running Core: `ACTIVE_KEY_CHANGED` until restart (design 2.7 (3), 2.10: the boot judges and names the key).
- Code: `src/capture/signer/host-key.ts`, `types.ts` (`ACTIVE_KEY_CHANGED`), `seal.ts` (a named signer refusal keeps its code), `src/sealing-host/index.ts` (comment).
- Tests: new `sign-time-guard.test.ts` (5), `seal-after-mark.test.ts` (3). One re-stated expectation: `active-key-call-sites.test.ts` resolver count 4 -> 5.
- Checks: unit set 1421 passed / 22 failed (1 mine, re-stated; 21 of rows in flight: 228 and two static lists); database 82 passed; typecheck clean.
- Record: `implementation/226b_compromise_mark_on_running_core.md`.
