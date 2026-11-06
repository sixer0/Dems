# Row K6 - driver K6 - status: complete

Record: `implementation/k6_cli_key_command_refusals.md`.

- (1) done: `evidence:production-key` and `evidence:rotate-key` refuse an id of `ReservedInstallationId` as it is typed, `INSTALLATION_ID_RESERVED`, with the sentence "reserved for tests and demonstration data"; no word asked, no key, nothing written. The list is imported from `src/capture/boot/checks` by `cli/production-key-command.ts`; the rotation asks through the sibling.
- (2) done: `evidence:production-key` asks the store for its next key id before the first prompt: not the first id -> `REFUSED, KEY_EXISTS`; the store cannot say -> `REFUSED, STORE_REFUSED`. `evidence:rotate-key` already refused every store state before its first prompt: no code change, pinned by a case.

Files written: `cli/production-key-command.ts`, `cli/rotate-key-command.ts`; `test/static/cli.test.ts` (one allowed import, `src/capture/boot/checks` for `cli/production-key-command.ts`: its reason line, the file's line, the INSIDE list); tests extended: `src/sealing/__tests__/production-key.test.ts`, `src/sealing/__tests__/rotate-mark-commands.test.ts`.

Existing tests edited: TWO cases, both pinned the old "three prompts, then FAILED, KEY_EXISTS" (the row-226d R-5 case: two expectations; the row-215c case part (a): expectation moved, part (a2) added to keep the FAILED path covered). DRIVER DECISION, section 4 of the record.

Checks: red evidence `2 failed | 24 passed (26)`; own files with the cli static rule and the reserved-id rule `81 passed (81)`; static set `47 files, 823 passed (823)`, no red; typecheck exit 0. Not run: the two database files that call the production key command (ids not reserved, fresh stores).

Requests: none. Edit tool only on existing files: kept.
