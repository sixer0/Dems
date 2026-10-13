# Row X4 - static rules for `cli/`, Web Crypto entry, pinned command

Status: **complete**. Record: `implementation/x4_cli_static_rules.md`.

| Item | Result |
|---|---|
| 1. F-06, rule set for `apps/core-server/cli/` | done: NEW `apps/core-server/test/static/cli.test.ts`, 29 cases (23 rules in groups A-F, 6 planted controls); coverage include gains `cli/**/*.ts` (`vitest.config.ts`) |
| 2. C-1 / F-07, Web Crypto in the identity folder | done: `src/modules/identity/__tests__/static.test.ts` 18 -> 22 cases; patterns `WEB_CRYPTO`, `KEYED_DIGEST`; ONE named entry `RUN_REPEAT_GUARD` (`password-policy.ts`, `createRunRepeatGuard`, decision C72); any other use fails (planted) |
| 3. F-08 / SR-9, the command pinned by name | done: `test/static/credentials.test.ts` 13 -> 14 cases; the existing rule not narrowed |

Checks: 46 static test files, one run: 44 passed, 2 failed, neither this row's - `src/capture/adapters/__tests__/static.test.ts:296` (`src/evidence-export/host.ts:56` imports the adapter layer) and `src/modules/capture-config/__tests__/static.test.ts:175` (`src/capture/host-alias/journal.ts`, `lifecycle.ts` not in `REVEAL_REASON_WRITERS`). Typecheck of `apps/core-server`: no output.

Product violations found by the new rules: none. Two facts beside the brief: `cli/` holds ten files, not nine; `cli/verify-export.ts:20` imports the process module (the receiver's `unzip`, task 3) - pinned as the one file, which holds no secret.

Driver decisions DD-1 to DD-6 in the record (the PROMPT kind; what "thin" means; exact import pins; constants exempt from the secret-name pattern; the coverage line; two patterns added beside the existing ones).

Requests in `file_requests.md`: none. Edit tool only for existing files; nothing committed.
