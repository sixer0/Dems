---
task_id: 2026-10-12_input_av_core_adapter_plan
row: X4
date: 2026-10-13
agent: coder-execution (X4, track D)
tier: T2
source: verification/222_m11_review.md (F-06, F-07, F-08, section 5.4); verification/221_x1_x2_as_built_security.md (C-1, section 7 (a), (b)); decisions C53, C54, C64, C67, C71, C72
status: complete
---

# Row X4 - static rules for `cli/`, the Web Crypto entry, the pinned command

Static rules (tests) only. No product file was changed. No key or credential file was read; nothing under `.data/` was opened, listed or stat-ed.

## 1. What was written

| File | Change | Cases |
|---|---|---|
| `apps/core-server/test/static/cli.test.ts` | NEW (Write) | 29: 23 rule cases, 6 planted-control cases |
| `apps/core-server/src/modules/identity/__tests__/static.test.ts` | Edit, additive: 4 edits (header line, patterns and the named entry, rule 2 cases, SR-61 case) | 18 -> 22 |
| `apps/core-server/test/static/credentials.test.ts` | Edit, additive: 1 new case after the script rule (then 2 small edits inside that new case) | 13 -> 14 |
| `apps/core-server/vitest.config.ts` | Edit: coverage `include` gains `'cli/**/*.ts'` and one comment line | - |

## 2. Item 1 (F-06): the rule set for `cli/`

Every rule is a function over source texts, run on the real files (no finding) and on planted files (the finding it must make).

| Group | Rule | Planted control (same function) |
|---|---|---|
| A. closed list | The folder holds exactly ten `.ts` files and nothing else; `scanCoverage(all, ['cli/'])` equals `SCAN_COVERS`. Five ENTRIES (`mark-compromised`, `operator-set`, `production-key`, `rotate-key`, `verify-export`), four COMMANDS (`*-command.ts`), one PROMPT (`secret-prompt.ts`) | a file outside the list is `unexpected` |
| A. thin entry | An entry starts on its own file name only, holds one start block, calls ONE `run...Command(process.argv.slice(2), ...)` imported from its pinned logic file, sets `process.exitCode` in exactly two places, holds a pinned number of `if` (1 or 3), no `for / while / switch / try / catch / class / parseArgs`, no statement, at most 50 code lines (largest today: 47) | an entry with an argument parser, a loop and three exit writes: 4 findings |
| A. command | A command exports `run...Command(args, ports)`, names no member of `process`, no console, no `node:readline` / `node:tty`, no start block | 4 findings + 1 |
| A. process | The members of `process` each file names are pinned per file; no `process[...]`; no `process.exit(` anywhere | both found |
| B. imports | Every import of `src/` is on a list of 19 modules, each with its reason, pinned file by file. The list states the REACH of each (unit index 4, sub-index 3, file directly under `src/` 2, INSIDE a unit past its index 10) and the test computes the reach from the tree and compares | `../src/core/audit-writer` is not on the list and is computed as INSIDE |
| B. imports | No import leaves the folder for anything but `src/`; sibling imports pinned; no `require(` / `import(`; packages and built-ins pinned per file; `fastify` and `pg` are `import type` only | test code import, `node:crypto`, a run-time load: all found |
| C. output | No output call (console, both process streams, `ports.out / io.out / io.err / ask`, `say`, `refuse`, `persist`, `errorLog.append`, a logger, a prompt label, `terminal.write`, `writeSync`), no error (`new ...Error(`, `new UnitStop(`, `reject(`, `super(`, `throw x`) and no `${...}` of any template names: `.secret`; a name that holds the value (`typed`, `accepted`, `buffers`, `buffer`, `record`, `hashSet`, `fields`; in the prompt `held`, `chunk`); an answer of the prompt except `.code` / `.cause`; `connection` except `.port`; or any lower-case name matching `passw|secret|token|credential|wrap|privat|seed|pepper|salt|hash` | 14 findings on two planted files, one clean line passes |
| C. reach | Every `.write(` in the folder is one of the output calls the rule reads | - |
| C. names | The prompt is read in two files; the names bound to its answer and to the value inside it are DISCOVERED from the text (aliases, `push`, loop names) and must be the pinned ones; the answer is never destructured | two new aliases are discovered |
| C. named uses | In the password command every use of the typed value, the hash set and the database credential is one of 27 named forms; after the forms are taken out nothing of the names is left. One text copy, one hasher call, one remembered digest, one pool, one written credential. Bytes zeroed in `finally` | a log of `typed` and a write of `fields.password + connection.password + hashSet.salt` are reported |
| C. prompt errors | `SecretPromptError` is made with one of three literal codes; its constructor passes the fixed words | - |
| C. process | `child_process`, `worker_threads`, `cluster`, `spawn / exec / fork` calls: ONE file (`cli/verify-export.ts`), which holds no secret, reads no prompt and imports no sibling. Nothing writes `process.env`, `process.argv` or `process.title` | 3 + 5 found |
| D. environment | Two reads in the folder, pinned by form: the NAMES (`Object.keys(process.env)` in `operator-set.ts`) and one value, `INIT_CWD` (`verify-export.ts`). `node:process` not imported, no `{ env } = process` | value reads, a whole-object read, a destructure: found |
| D. refusal list | `PASSWORD_VARIABLE_NAME` exists in the password command (read from its source text, not imported): refuses 8 password-like names, admits 6 unrelated ones | an emptied list no longer refuses |
| D. order | The refusal runs once, on the names, before `readConnectionFile`, `openPool`, the first prompt and `ask`; the entry hands in the names only | - |
| E. scripts | A script that names a path of `cli/` is exactly `tsx cli/<entry>.ts`; the five scripts and their entries are pinned; one script per entry; no script names a command file or the prompt | an option, a variable, a command file, two commands in one line: 4 findings |
| F. rest | No cryptography module, Web Crypto or weak random source; no file-read call and the `node:fs` names per file pinned; no unlink / rename; ONE writing statement (the credential UPDATE); the audit table never named, one `unit.audit.append(`; `tsconfig.json` includes `cli`, coverage includes `cli/**/*.ts` | each found |

Coverage configuration: `vitest.config.ts:27` now includes `cli/**/*.ts`. It is a test-configuration line; nothing in the repository pins the coverage include or reads a threshold (search of `*.ts, *.mjs, *.json, *.sh, *.yml` outside `docs/`), and `network.test.ts` reads the file only for network words. No existing rule's result moved (section 5). `scan.ts:97-99` (`isProductionSource`) was NOT changed: it would move every rule that uses it; the new file scans `cli/` itself.

## 3. Item 2 (C-1 / F-07): Web Crypto in the identity folder

- `CRYPTO` also reads the module without the `node:` prefix. Two new patterns: `WEB_CRYPTO` (`globalThis.crypto`, `crypto.subtle / getRandomValues / randomUUID`, `.subtle` under any holder, `getRandomValues`, `webcrypto`, `CryptoKey`) and `KEYED_DIGEST` (`importKey / generateKey / deriveKey / exportKey / wrapKey / unwrapKey`, `deriveBits`, `subtle.sign / verify / encrypt / decrypt / digest`, `'HMAC'`).
- ONE named entry `RUN_REPEAT_GUARD`: file `src/modules/identity/password-policy.ts`, symbol `createRunRepeatGuard` (and its constant `DIGEST_ALGORITHM`), purpose "comparison in memory, per run, nothing derived is stored or leaves the process", comment naming decision C72 (with C53 (2), C67 (2), review 221 C-1, review 222 F-07).
- Rule 2: `WEB_CRYPTO` is named by that one file and every occurrence lies inside the symbol. SR-61: the same for `KEYED_DIGEST` (symbol or its constant line).
- The helper is held to its purpose: key bytes from the runtime's generator once per call; `importKey('raw', material, DIGEST_ALGORITHM, false, ['sign'])` once (not extractable); both byte arrays zeroed in `finally`; one `subtle.sign`; the two `return` statements pinned; the file imports `@dems/shared/api` and `@dems/shared/sim` only; no `exportKey`, `wrapKey`, serialiser, file write, `fetch`, logger, process or console.
- Planted controls: five uses in another file of the folder (5 findings, and `CRYPTO` sees the `node:crypto` import); a second use in the named file outside the symbol (reported at its line); the symbol renamed (every use reported); a stored HMAC key in another file and in the named file (5 + 2 findings).
- The existing cases and their counts are unchanged (`CRYPTO` 2, `SIGNING` 5, `files(CRYPTO)` = `tokens.ts`, `SIGNING` on the folders = none).

## 4. Item 3 (F-08 / SR-9): the pinned command

One new case in `credentials.test.ts`: the script `operator:set-password` is exactly `tsx cli/operator-set.ts`; the entry file exists; it is the one script of its family and the only one naming the entry; four variants (an option, a variable, the command file, another runner) are not the pin. The comment says why the file has this name and cites C64, C71 (b), C72: the code is right, the rule is wide on purpose, the name is not to be "repaired", no exception is added. The existing rule (`passw|secret|token|credential|.data/` on every script) is untouched.

## 5. Checks

| Check | Command | Result |
|---|---|---|
| The three files, each alone | `npx vitest run --project unit <file> --maxWorkers=2` | `cli.test.ts` 29 passed (third run; runs 1 and 2 failed in my own new cases: wrong expectations and two patterns, see 7); identity `static.test.ts` 22 passed (first run); `credentials.test.ts` 14 passed (first run) |
| Every static test file of `apps/core-server` (46 files: `test/static/*.test.ts` 17, `**/static*.test.ts` 29) | the same, one run | `Test Files 2 failed, 44 passed (46)`; `Tests 2 failed, 791 passed (793)` |
| Typecheck | `npx tsc --noEmit -p tsconfig.json` in `apps/core-server`, once | no output (0 errors) |

Reds that are NOT this row's (not edited):

| Red | Finding | Likely owner |
|---|---|---|
| `src/capture/adapters/__tests__/static.test.ts:296` (A-5) | `src/evidence-export/host.ts:56 imports the adapter layer and is not a unit that wires it` | the row in flight on `src/evidence-export/host.ts` / the sealing host (K2 or K3); the list's writer is R3 / pass I-9a |
| `src/modules/capture-config/__tests__/static.test.ts:175` (R-5) | `src/capture/host-alias/journal.ts` and `lifecycle.ts` write a reveal-reason text and are not in `REVEAL_REASON_WRITERS` | row 106 (agent A1, host-alias) with the owner of that list |

## 6. Findings in product code

No rule written here found a violation in product code: all 23 rule cases are green on the tree as it lies.

Two facts differ from the brief's words; neither is a violation, both are pinned by name:

1. `cli/` holds TEN files, not nine (`rotate-key*.ts` and `mark-compromised*.ts` of row 226 are four of them).
2. "child_process is not imported at all" does not hold for the folder: `apps/core-server/cli/verify-export.ts:20` imports `spawnSync` (the receiver's entry of task 3, ruling D200: the system `unzip`, fixed arguments, no shell). The rule pins it as the ONE file that starts a process and holds that this file holds no secret, reads no prompt and imports no sibling; none of the three secret-holding files can start a process.

Seen while reading, already known to review 222 and not re-reported as findings: the two terminal tests (`isatty(0)` / `process.stdin.isTTY`, F-05 (b)).

## 7. Driver decisions (for the controller to confirm)

- DD-1: `secret-prompt.ts` is a third kind, PROMPT (it owns the terminal AND holds the read loop, and carries the attended check with its own start block). It has no npm script; the rule holds that none names it (review 222 section 5.4, DD-6 of row 213).
- DD-2: "thin" is made checkable as: one command call, two exit writes, a pinned number of `if`, no loop / try / class / argument parser / statement, at most 50 code lines. The `ask` closure over `readline` in two entries (F-05 (b)) counts as terminal ownership, not logic.
- DD-3: the import list is pinned EXACTLY (file by file), so a removed import also needs the list edited. Chosen over "subset of" because a stale allowed entry is a door.
- DD-4: the secret-name pattern exempts constants and type names (`SET_PASSWORD_COMMAND`, `SetPasswordRefusal`): they hold fixed words.
- DD-5: the coverage line was edited (the brief allowed it under a condition, which holds).
- DD-6: in item 2 the existing patterns' cases were kept and two patterns added beside them, rather than folding Web Crypto into `SIGNING`: the existing positive-control counts stay, and the named entry applies to the new patterns only.

Limits of what a text rule can hold, stated: the output rule reads names. A secret handed to another function under a neutral parameter name is not followed into that function; in the password command the named-uses rule closes this (every use of the value is listed), in the other files there is no secret variable to follow. `stripComments` does not know regular-expression literals (its own header says so).

## 8. Edit-only statement

Kept. Existing files (`credentials.test.ts`, identity `static.test.ts`, `vitest.config.ts`, `file_claims.md`) were changed with the Edit tool only, each after re-reading, additively; no scripted replace, no shell write, no whole-file rewrite. New files with Write: `cli.test.ts`, this record, `delegation_progress/row_x4.md`. The corrections to `cli.test.ts` after its first run were made with Edit as well. Not touched: `test/static/network.test.ts`, `src/credential-store/__tests__/static.test.ts`, `test/static/scan.ts`, every file under `cli/` and every non-test file under `src/`. No request was left in `file_requests.md`. Nothing committed or staged.

---
*Generated: 2026-10-13*
