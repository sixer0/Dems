---
task_id: 2026-10-12_input_av_core_adapter_plan
row: 212
date: 2026-10-13
agent: coder-execution (batch 9, agent R10)
tier: T3
package: X2-1
requirements: SX-13; R-X2-6; UD-6 and UD-12 as working defaults of C42 and C44
status: needs-review (built and green; ONE point for the controller: the module's home, driver decision 1)
---

# Row 212: the password policy for a new password, and the repeat helper of one run

## What was built

| File | Change | Content |
|---|---|---|
| `apps/core-server/src/modules/identity/password-policy.ts` | new | `checkNewPassword(password, { username })`, `PASSWORD_POLICY`, `PASSWORD_POLICY_REFUSAL`, `createRunRepeatGuard()`, `RunRepeatGuardError` |
| `apps/core-server/src/modules/identity/__tests__/password-policy.test.ts` | new | 20 tests |
| `apps/core-server/src/modules/identity/index.ts` | edit (Edit tool) | ONE export block for the five names and three types |

The hash wrapper (`password-hash/`) and its parameters are untouched and are not called from the policy (pinned by a test).

## The rules, in the order asked

| # | Rule | Code | Source |
|---|---|---|---|
| 1 | at most 128 UTF-16 code units; the number is `SIGN_IN_LIMITS.passwordMax`, imported | `PASSWORD_TOO_LONG` | design 3.5; `packages/shared/src/api/identity.ts:71-78` |
| 2 | no control character (U+0000-U+001F, U+007F, U+0080-U+009F) | `PASSWORD_CONTROL_CHARACTER` | SX-13 |
| 3 | printable ASCII only, U+0020 to U+007E, the space included | `PASSWORD_NOT_PRINTABLE_ASCII` | SX-13, UD-12 |
| 4 | not the published demonstration password, in any letter case, nor a value that contains it; compared with the seed's constant by import | `PASSWORD_IS_DEMONSTRATION` | R-X2-6, SX-13 |
| 5 | not the operator's username, in any letter case, nor a value that contains it | `PASSWORD_HOLDS_USERNAME` | UD-6, SX-13 |
| 6 | at least 12 characters, counted in code points | `PASSWORD_TOO_SHORT` | UD-6, SX-13 |
| 7 | not one character repeated | `PASSWORD_ONE_CHARACTER` | design 3.5 |
| - | a value already set in this run (the helper) | `PASSWORD_REPEATED_IN_RUN` | SX-13 |
| - | not text; no username given (fail closed) | `PASSWORD_NOT_TEXT`, `USERNAME_MISSING` | - |

Not rules, each pinned by a test: no composition rule; no trim, fold or normalisation (a space at either end counts). A refusal is `{ code, message }` with the fixed words of the code - no part of the value and no length of it.

Rules 4 and 5 come BEFORE the length, so that the demonstration password and the username are refused under their own name whatever their length. They are compared without an early exit: every position and every character is visited, so the time depends on the two lengths only (the runtime gives no stronger guarantee; the demonstration password is published in any case).

The design lists no further variant of the username than "case-insensitively, also as a part" (SX-13); none was added.

## The reading of the three sign-in forms

| Form | Read at | What it does to the password | Difference from "as typed" |
|---|---|---|---|
| Web console | `apps/core-web/src/features/login/use-login-controller.ts:322-323` (the username is trimmed, `typedPassword = password`); `login-model.ts:133-136` (only "empty" is asked, on the untrimmed value); `auth-card.tsx:250-260` (the field; no length attribute) | handed over unchanged | none |
| Tablet | `apps/mobile/src/features/login/login-model.ts:37-38` (the username is trimmed; the password is `z.string().min(1)`); `use-login-controller.ts:164-171` (`auth.signIn(username, password)`); `login-card.tsx:262-290` (the input: no capitalisation, no correction, no length attribute) | handed over unchanged | none |
| Phone | the SAME card and controller as the tablet: `apps/mobile/src/features/login/login-screen.tsx:8-15` lays one card out for phone and tablet | handed over unchanged | none |
| Behind all three | `packages/shared/src/live/source/bindings.ts:337` (`body: { username, password }`); the contract `packages/shared/src/api/identity.ts:121-124` with the text rule `packages/shared/src/api/text.ts:29-42` (refuses U+0000 and an unpaired surrogate); the server `apps/core-server/src/modules/identity/sign-in.ts:48`, `password-hash/password-hash.ts:187-196` (hashed as its UTF-8 bytes, 1 to 128 code units) | refused: U+0000, an unpaired surrogate, above 128 code units | each already refused by rules 1, 2, 3 |

Result: **no form changes a password it sends; the only values a form or the contract cannot carry are already refused by rules 1 to 3. Further refusals from the forms: none.** Not read: what an operating-system keyboard, a password manager or autofill does before the field receives the text (the reason for rule 3; outside the sources).

## The repeat helper

`createRunRepeatGuard()` gives `{ refusalOf(password), remember(password) }`. The command asks `refusalOf` before hashing and calls `remember` after the operator's transaction committed (asking does not remember, so a failed transaction does not block the same value on a second try). It keeps HMAC-SHA-256 digests under a key of 32 random bytes made for the run; the key object cannot be exported and the bytes it was made from are zeroed; nothing is written anywhere. Limit: within one run.

## Checks

| Check | Command (in `apps/core-server`) | Result |
|---|---|---|
| The row's tests and the identity folder's static rules | `npx vitest run --project unit --maxWorkers=2 src/modules/identity/__tests__/password-policy.test.ts src/modules/identity/__tests__/static.test.ts` | one run: `Test Files 2 passed (2)`, `Tests 38 passed (38)` (20 of this row, 18 of the static file) |
| Static rules that watch the demonstration constant, logging and credentials | `npx vitest run --project unit --maxWorkers=2 src/db/mapping/__tests__/static.test.ts src/db/store/__tests__/static.test.ts test/static/{logging,log-calls,credentials,scan-coverage,network}.test.ts` | `Test Files 7 passed (7)`, `Tests 63 passed (63)` |
| Typecheck | `npx tsc --noEmit` | 6 errors, NONE in this row's files: `src/capture/__tests__/supervisor.test.ts:1069` (row 191), `src/capture/signer/host-key.ts:377, 378, 392, 414, 423` (R9, in flight) |
| Lint of the three files | `npx oxlint <the three files>` | exit 0 |

The verification cell:

| Cell item | Where |
|---|---|
| a rule table with one accepted and one refused value per rule, each built at run time | describe "the rule table": 11 tests; every value is drawn from `node:crypto` in the run (`runValue`, `pick`) |
| the demonstration password by its imported constant, never as a literal | test "the demonstration password..."; and "names the demonstration constant in two lines ... and holds its value nowhere" reads the module AND the test file and finds the value in neither |
| the reading of the three forms, each difference turned into a refusal or stated "none" | the section above: none |
| the repeat helper refuses a second use in one run | describe "the repeat helper of one run": 3 tests |
| the module imports no file system and no logger | test "imports the shared package twice and nothing else" |

**No echo, asserted:** the test captures `process.stdout.write`, `process.stderr.write` and six console methods for the whole file and fails if any judged value appears there. The module has no log sink (it imports none).

## Identifiers

SX-13: done - minimum in code points; control characters; printable ASCII; the forms read; demonstration password and username case-insensitively and as a part; the repeat inside one run. R-X2-6: the policy half done (the call "before hashing" is row 215's). UD-6, UD-12: applied as working defaults; the two numbers are one object, `PASSWORD_POLICY`.

## DRIVER DECISIONS (to confirm)

1. **The module's home.** The cell and the profile name the shared package (`SH/api/`, "ONE shared module"); the launching brief names the identity area, and R5 is the single writer of `packages/shared` in this batch. The module was written in the identity folder, PLATFORM-NEUTRAL so that it moves unchanged, and is exported by the identity module. The move and the one barrel line are a request (`file_requests.md`); not blocking for row 215.
2. **The keyed digest is the runtime's Web Crypto**, not `node:crypto`: it keeps the module platform-neutral, and the key object cannot be exported. Consequence to rule on: rule 2 and SR-61 of `identity/__tests__/static.test.ts` stay green UNEDITED because the file names neither `node:crypto` nor the HMAC constructor - but the folder now holds a second use of randomness. Stated as a request for a ruling; the move to the shared package ends the question.
3. The demonstration password and the username are asked before the minimum length.
4. A username of any length is matched as a part (the dataset's are 11 to 12 characters). A very short username would refuse many passwords; no lower bound was invented.
5. "One repeated character" is judged at any length at or above the minimum, the space included.
6. `checkNewPassword` takes text. The prompt of row 213 returns bytes; turning them into text once is row 215's (the hash wrapper takes text too).

## Requests left

Two lines in `delegation_progress/file_requests.md` (the move with the barrel line; the ruling on rule 2 / SR-61). Both non-blocking.
