---
task_id: 2026-10-12_input_av_core_adapter_plan
row: 215b
track: D
date: 2026-10-13
agent: coder-execution (driver)
status: complete
tier: 3 (mechanical record with evidence)
builds_on: implementation/215_x2_set_password_command.md ; test/216_x2_command_acceptance.md ; test/220_m11_bench_boot_session.md ; decisions C66 (4)
---

# Row 215b - where `operator:set-password` takes its connection file from, and what it shows

## 1. What was found first (it changes the reading of C66 (4))

C66 (4) says the command "read its connection file from `.data`, not from the directory given as `--data-dir`". Reading the code and the bench driver, that is not what happened:

| Fact | Evidence |
|---|---|
| Before this row the command already built the path from the argument: `join(args.dataDir, CONNECTION_FILE_NAME)` and handed it to `readConnectionFile` | `apps/core-server/cli/operator-set-password-command.ts`, step 3, as committed at 0f5d2a8e (the line this row replaced) |
| No default data directory, no `loadConfig` call and no variable was in either file of the command | the same file and `cli/operator-set.ts`; pinned now by a test (section 4, case 1) |
| The bench session of row 220 GAVE the command the repository's own data directory: `runSetPasswordCommand(['--database', database.name, '--data-dir', (run as TestRun).dataDir, '--all-demo'], ports)` while X-1 and the boots got the temporary directory | `.cache/task4-row220/bench-session.mts:166`, `:319`, `:341` |
| Row 220's record says exactly that, as its own driver decision | `test/220_m11_bench_boot_session.md:55` - "X-2 read its connection file from the directory of the test helper ... no second copy of a connection file was made for the temporary directory (secrets rule)" |

So the command showed the directory it was given and read the file of that same directory. What the bench session shows is a property of the SESSION (two commands on two directories), not a wrong path in the command. FOR THE CONTROLLER: C66 (4) may want one corrected sentence; this agent does not write `decisions/decisions.md`.

What was nevertheless true and is closed here: (a) the confirmation named the directory but never the FILE, so the person could not see which file was read; (b) the entry was only checked by the reader's mode test, which follows a link and does not ask who owns the file; (c) nothing pinned "the stated directory and no other place" against a later change.

## 2. Which of the two fixes, and why

THE FIRST: the connection file is located from the stated directory, the same way the Core locates it. The second (keep another location and show it) does not apply, because by the design the runtime connection file IS under the data directory:

- The Core: `const dataDir = resolve(options.dataDir ?? DEFAULT_DATA_DIR); const file = join(dataDir, CONNECTION_FILE_NAME); readConnectionFile(file)` - `apps/core-server/src/plugins/config/load-config.ts:95-97`; `CONNECTION_FILE_NAME = 'pg.env'` in `src/config.ts`.
- The design's inventory of the same rule for the owner role: "connection file `<data dir>/pg.owner.env` (0600) the command reads itself; nothing goes through the environment or the arguments" - `masterplan/05_design_x1_x2.md` B15 (line 260).
- The probe of row 214: "`readConnectionFile(file)` is a function of a path; `loadConfig` calls it for `<data dir>/pg.env`" - `test/214_x2_h2_h3_grants_probe.md:40`.

The command differs from the Core in one point on purpose, unchanged: it has NO default directory (`--data-dir` is required and absolute).

## 3. What was changed

| File | Change |
|---|---|
| `apps/core-server/cli/operator-set-password-command.ts` | NEW exported `connectionFileOf(dataDir)` = `{ dataDir: resolve(dataDir), file: join(resolved, CONNECTION_FILE_NAME) }` (the Core's expression). NEW exported `ConnectionFileProblem` (`CONNECTION_FILE_MISSING`, `_MODE`, `_LINK`, `_NOT_A_FILE`, `_OWNER`) and `connectionFileProblem(file, uid, inspect)`: the entry AS IT IS (lstat) must be a regular file, owned by the calling user, without access for group or others. Step 3 runs it before the reader; a problem is `REFUSED (CONNECTION_FILE) <full path> could not be used (<problem>). Nothing was read.` The two older refusal lines now name the full path instead of "pg.env of the data directory". The summary gained one line after `data directory:` - `connection file: <full path> (the file this command read; the Core of this data directory reads the same one)` - and shows the RESOLVED directory. Header comment: one paragraph, one word in the order list |
| `apps/core-server/cli/operator-set.ts` | comment only: the entry names no data directory and no connection file. No statement changed |

Reuse, by import only: `inspectEntry` and `EntryFacts` of `cli/production-key-command.ts` (the lstat facts X-1 uses for its directory rule). Nothing was copied; nothing under `src/capture/signer` was touched or imported.

Error paths: unchanged pattern - every refusal is a fixed line with a code; database failures go to the persistent error log through the existing `persist`. The new refusals happen before a pool exists and write a line only (as the reader's refusals did before).

## 4. Tests

Database-free, `test/cli/operator-set-password.test.ts`, four new cases in the existing describe "the connection file (SX-03)":

1. `connectionFileOf` gives the Core's path, also for a directory not written in its shortest form; neither command file holds `DEFAULT_DATA_DIR`, a `loadConfig(` call or a quoted `.data`; the reader is called once, with `file`.
2. Two temporary directories, each with its own synthetic connection file (ports 4431 and 4430, a value made per run): the one STATED reaches the pool port (its port, its value; the other's not), both ways round; the summary names the stated directory and `connection file: <stated>/pg.env`, never the other directory, never a value; shown before the word; nobody prompted.
3. `<dir>/nothing/..` is shown as `<dir>` and `<dir>/pg.env`.
4. Absent, a link (to a file that would pass), a directory of that name, mode 0640, mode 0604, another user's (caller uid + 1): each exactly one refusal line with the full path and its named problem; pool opened 0, questions 0, prompts 0. Control: the same good file asked by its owner is read.

Database, `test/cli/operator-set-password.db.test.ts`, one new case "step 6 (row 215b)" at the end of the row 215 block: a temporary data directory with a connection file written by the test (this clone's port, role `dems_app`, a value made in the run); the command gets that directory only; the pool port receives the file's port, role and value and the database named on the command line; the database answers (operator found, summary printed with the temporary directory and file, not the helper's directory); the word is refused, nothing set. Then the directory without a file: one refusal line, no pool, no prompt.

THE ONE DOUBLE in that case: a made-up value cannot authenticate at PostgreSQL, so after proving the handed connection is the file's, the pool is opened with the helper's in-memory credential in place of the value. Unproven here and left to the hardware / installation package: a run where the file's own value authenticates (that is every real run, and rows 215 / 216 steps on the helper's directory already exercise it end to end).

| Check | Command | Result line |
|---|---|---|
| command (database-free) + the static rule files | `npx vitest run --project unit --maxWorkers=2 test/cli/operator-set-password.test.ts test/static` | `Test Files  17 passed (17)` / `Tests  218 passed (218)` |
| command on throw-away databases, under `.locks/db-migrate.lock` | `npx vitest run --project db --maxWorkers=2 test/cli/operator-set-password.db.test.ts` | `Test Files  1 passed (1)` / `Tests  16 passed (16)`; `teardown: dropped 2 database(s) ...; 0 remain with the run prefix` |
| typecheck, `@dems/core-server` | `npx tsc --noEmit` | exit 0, 0 `error TS` lines |
| lint of the four files | `npx oxlint <four files>` | exit 0 |

One run each; none failed.

## 5. Existing tests: what was edited

No expectation pinned the old location, so none was edited for that reason. Two edits in the existing rig of `operator-set-password.test.ts`, both forced by the new owner check (the rig's calling user was the literal 1000, which does not own the run's temporary files):

- `uid: () => 1000` -> `uid: () => options.uid ?? UID` (`UID` = the real calling user), with a new optional `uid` in the rig's options;
- the audit-details expectation `invokerUid: 1000` -> `...(UID >= 0 ? { invokerUid: UID } : {})`.

The existing cases on mode 0644, another role and a missing directory pass unchanged (their patterns still match the new lines). The database file's existing blocks are unchanged.

## 6. Limits and driver decisions

- DRIVER DECISION: the fix was built although the stated defect was not in the command (section 1), because the brief's three concrete requirements (true path shown, unsafe entry refused, tests) hold on their own.
- DRIVER DECISION: the owner check is skipped when the host cannot name the calling user (uid < 0), as the signer store does.
- Not checked: the DIRECTORY above the file (a data directory that is itself a link, or an ancestor writable by others). The design asks that of X-1's directory (R-X1-7), not of X-2; the summary shows the lexically resolved path, not a real path. For the X-2 security review (row 221) to rule.
- Between the entry check and the reader's open there is a short window (check, then open by name). The reader repeats the mode test; a descriptor-based read would need a change in `src/plugins/config/connection-file.ts`, which this row does not own. No request filed: stated here for row 221.
- Secrets: this agent opened no credential file; `.data/pg.env` was stat-ed once (type, mode, owner) and not read. Every connection file of the tests is synthetic, in a temporary directory the test removes.
- Edit-only rule kept: every existing file with the Edit tool; this record and `row_215b.md` are new files.
