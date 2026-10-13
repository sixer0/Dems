# Row 226d - driver K5 - status: complete

Record: `implementation/226d_signer_low_edges.md`.

- R-5 done: `host-key.ts` `keyIdSpent` - any entry naming an id of the series at or after the id spends it. The "before its prompts" refusal of `cli/production-key-command.ts` is a request (file not in the row's list); the command already ends `FAILED, KEY_EXISTS` and writes nothing.
- R-6 done: `markSigningKeyCompromised` looks at the directory first; `evidence:mark-compromised` shows what the store holds, refuses `STORE_NOT_TAKEN` before the word, looks again after it (`STORE_CHANGED`).
- R-7 done: `sealing-host/index.ts` `signingNow` refuses a null door, `BOOT_KEY_NOT_JUDGED`, before the load. `SIMULATED` and the seed command left as review 230 accepted, said in the comment at the place.
- Also: the two stale note texts of R-8 that review 230 routes to this row.

Files written: `src/capture/signer/host-key.ts`, `types.ts`, `index.ts`; `src/sealing-host/index.ts`; `cli/mark-compromised-command.ts`; `cli/rotate-key-command.ts` (one note text); tests extended: `signer/__tests__/active-key.test.ts`, `sign-time-guard.test.ts`, `sealing/__tests__/rotate-mark-commands.test.ts`, `sealing-host/__tests__/sealing-host.test.ts`. Existing tests edited: none. `test/static/cli.test.ts` and the row-229 driver: not edited.

Checks: own files `62 passed (62)` then `10 passed (10)`; unit folders `2295 passed, 2 failed (2297)` - both failures other rows' (111, 228b); database `240 passed, 7 failed (247)` - all 7 in `fence.db.test.ts`, `RESERVED_INSTALLATION_ID` of row 228b in flight; typecheck exit 0; row-229 driver `46 held, 1 recorded as observations, 0 difference(s) from the design`.

Driver decisions D-1 to D-5 in the record (new code `BOOT_KEY_NOT_JUDGED`; production-key command not edited; second look and `STORE_CHANGED`; R-8 note texts; a certificate-only key can be marked).

Requests: one line in `file_requests.md`, not blocking.

Edit tool only on existing files: kept.
