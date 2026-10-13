---
task_id: 2026-10-12_input_av_core_adapter_plan
row: 207
date: 2026-10-13
agent: coder-execution (batch 9, agent R10)
tier: T3
requirement: SX-18
status: complete
---

# Row 207: the count-only secret scan gains three form needles and two rules on a file's name

## What was changed

| File | Change (Edit tool, additive) | Content |
|---|---|---|
| `scripts/secret-scan/count-only.mjs` | header paragraph; three entries appended to `NEEDLES`; new exports `NAME_RULES`, `nameRulesOf(name)`; `main` applies the name rules to the lists git gives | below |
| `scripts/secret-scan/count-only.test.mjs` | two pins of the earlier tests follow the longer list (the first six ids are still asserted in their order; the "clean" case now expects nine zeros); 8 tests appended | 13 tests in all |

sha256 before the edit: `count-only.mjs` `2f580fc3...1059b1f`, `count-only.test.mjs` `5201048a...fa74958`.

## The needles and the name rules

| Id | Form, in words | Counted | Not counted |
|---|---|---|---|
| `private-key-pem` | the opening line of a private key in PEM text: five dashes, the word BEGIN, zero or more kind words in capitals, the two words that name a private key, optionally the word for a key block, five dashes | plain, encrypted, RSA, EC, OpenSSH, a PGP key block | the same line of a public key or a certificate; the closing line; the two words in a sentence |
| `database-password-line` | one of the two password keys of the connection files (`CONNECTION_FILE_KEYS.password` of `apps/core-server/src/config.ts`, `OWNER_FILE_KEYS.password` of `src/db/commands/owner-connection.ts`), optional blanks, an equals sign, optional blanks, a character that is not a blank | the key with a value, also with blanks around the sign | the key without a value; the key as a word or as a quoted name; the other four keys; a key of another name |
| `argon2-encoded` | the encoded text of an Argon2 hash: a dollar sign, the algorithm word with one of its three variants, optionally the version member, the three parameters, a salt of 8 or more base64 characters, a tag of 16 or more | the three variants, with and without the version | the algorithm's name alone, with its parameters only, with an empty salt, an unknown variant, a hash of another family |
| `key-file-name` (name rule) | a file whose name ends in `.p8` or `.wrap` | - | `.crt`; `.p8.txt`; a file called `wrap.md` |
| `connection-file-name` (name rule) | a file named `pg.env` or `pg.owner.env`, in any folder | - | `pg.env.example`; `my-pg.env`; a folder of that name |

The name rules apply to `--tracked` and `--staged` only (the cell), to every name of the list, read or not. A named path or folder is scanned for content only.

**Note on the third needle.** This repository stores a password hash as columns (algorithm, parameters, salt, tag: `operator_credentials`), not as encoded text, so no code of it writes the form today. The needle catches the form entering by a library, a dump of another tool or a log line. The stored columns of a database dump are not a form this scan can know.

## The output

Unchanged for the six earlier needles: one count line each, `HIT <file>: <needle>=<count>, ...`, `TOTAL: <sum> in <n> file(s)`. Added: three count lines after the six; in the two git modes also one count line per name rule, one `NAME <file>: <rule>` line per file, and `BY NAME: <n> file(s)` after `TOTAL`. Exit 1 on any content hit or any name hit. No line holds a matched text.

## Checks

| Check | Command | Result |
|---|---|---|
| The scan's tests | `node --test scripts/secret-scan/` | one run: `tests 13`, `pass 13`, `fail 0` |
| Syntax | `node --check scripts/secret-scan/count-only.mjs` | ok |
| The earlier needles on the tracked tree, before and after the edit | `node scripts/secret-scan/count-only.mjs --tracked`, once before the first edit and once after | the six totals identical (20, 8, 8, 10, 57, 4); the `HIT` lines identical for the six needles, 61 files; **changed results: 0** |
| Hard gate of C23 (a): tracked log files | `... --tracked --ext=.log` | `scanned 726 file(s)`; the three new needles 0; both name rules 0; `TOTAL: 0 in 0 file(s)`; `BY NAME: 0 file(s)` |
| Hard gate of C23 (a): this task's docs folder | `... docs/2026-10-12_input_av_core_adapter_plan` | `scanned 350 file(s)`; the three new needles 0 |
| This agent's files of rows 213, 212, 207 | `... scripts/secret-scan apps/core-server/cli/secret-prompt.ts apps/core-server/test/cli <the three identity files>` | `scanned 7 file(s)`; all nine needles 0; exit 0 |

The verification cell:

| Cell item | Test |
|---|---|
| each needle: a planted positive counted 1 and a negative counted 0 | "private-key-pem: ...", "database-password-line: ...", "argon2-encoded: ..." - each through `countIn` and through a started scan of a planted file |
| each by-name rule: a positive 1 and a negative 0 | "the name rules: ..." (the function); "--tracked and --staged report a file by its NAME ..." (a repository made in the run's folder: 2 and 2 with the files in the index, 0 and 0 with them taken out) |
| the earlier needles show 0 changed results | the tracked-tree comparison above; and the test "the earlier needles do not count the new forms, and the new needles do not count the earlier forms" |
| planted values are built at run time; a key, hash or password line as a literal of a tracked file: 0 | bodies are `randomBytes` of the run; every form is joined from pieces; the test "this test file and the scan hold none of the forms they look for" scans both files: 0, 0, 0. The planted folder is removed (`ls $TMPDIR \| grep -c dems-secret-scan` printed `0`) |

## The tracked tree, for the baseline (decision C23 (b)) - counts and file NAMES only, no line was opened

`scanned 10901 file(s); skipped 0`

| Needle or rule | Count | Files |
|---|---|---|
| `private-key-pem` | 3 | `apps/core-server/src/core/__tests__/writers.test.ts` (1); `apps/core-server/src/evidence-export/__tests__/export.test.ts` (2) |
| `database-password-line` | 1 | `apps/core-server/src/plugins/config/__tests__/load-config.test.ts` (1) |
| `argon2-encoded` | 0 | - |
| `key-file-name` | 0 | - |
| `connection-file-name` | 0 | - |

All four hits are in test files. By their place they are planted fixtures of redaction and loader tests - a HYPOTHESIS until someone reads the lines. Proposed for C23: the three new needles and the two name rules are a HARD GATE (0) for tracked logs, this task's docs and everything a row writes under `.cache` (0 today); on the whole tracked tree the baseline is 3 / 1 / 0, the name rules 0 and a gate there too (a tracked key file or connection file has no synthetic reason). The six earlier needles on the tracked tree today: 20, 8, 8, 10, 57, 4 in 61 files (C23 recorded 54 for the camera form at its point).

## Not covered (stated)

- A private key in DER form (the signer store's own format) holds no text marker: that is what `key-file-name` is for, and it sees names only in the two git modes.
- A typed password has no form; the sweeps of R-X2-4 search for the run's own values in their own tests (rows 215, 216).
- Untracked files are seen only when a path names them.

## DRIVER DECISIONS (to confirm)

1. Name hits are their own lines (`NAME`, `BY NAME`) and do not enter `TOTAL`, so that every line the scan printed before means what it meant.
2. The key-block form of a private key is counted by `private-key-pem` ("of any kind").
3. A "value" after a password key is one character that is not a blank; a placeholder in a document therefore counts, and goes to the baseline by file name.
4. The version member of the encoded hash is optional; the salt and the tag have lower bounds of 8 and 16 characters so that a parameter description is not counted.

## Requests

None.
