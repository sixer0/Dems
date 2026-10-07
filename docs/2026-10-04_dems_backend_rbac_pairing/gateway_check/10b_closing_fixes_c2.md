---
row: closing-fix round C2 (before the root gate W89 and the clean-state rebuild W90)
decisions: D190 O-14 (CPS1-9, security ruling 14), O-7 (CPW1-7), O-6 (CPW1-10), O-10 (D41's comment)
agent: coder-execution
date: 2026-10-06
tier: 3
status: needs-review. The four items are done and verified. One consequence lies outside this row's write paths and needs a controller decision before W90's database run: C2-R1, section 8
---

# Closing-fix round C2

Four small items, one change each. Assets are in `gateway_check/assets/10b_c2_*`. Pre-images and their SHA-256 are in `.cache/rollback/C2/` (`C2.pre.sha256`). The progress log is `delegation_progress/coder_execution_c2.md`.

## 1. Summary

| Item | Finding | Files | Outcome |
|---|---|---|---|
| 1 | CPS1-9 / ruling 14: the PostgreSQL server log holds failing rows with hash columns and grows without bound | `scripts/pg/init.mjs:61-86` (`CONF_BLOCK`), `:7-8` (header), `:240` (printed line); `scripts/pg/init.test.mjs:107-124` (the pinned test, changed by design), `:126-148` and `:150-174` (two new tests), `:3-4` (header), `:12` (imports) | Done for a NEWLY initialised cluster: `log_error_verbosity = terse`, plus the logging collector writing a ring of 24 hourly files. The running cluster and `.data/` were not touched. **C2-R1:** after W90's `pg:init`, `apps/core-server/test/db/pg-behaviours.db.test.ts` turns red in two tests, by design. Ruling 14 did not list that file |
| 2 | CPW1-7: the unguarded `await bootCoreRuntime(...)` | `apps/core-web/src/main.tsx:12, 46-75`; `apps/core-web/src/test/live-runtime-static.test.tsx:106, 123-128` (the granted pin); new `apps/core-web/src/test/live-runtime-boot-failure.test.tsx` (81 lines, 4 cases) | Done. A rejected boot shows one static sentence, records once without the error text and starts no simulator |
| 3 | CPW1-10: stale count in a comment | `packages/shared/test/i18n.test.ts:2` | Done: "13 namespaces" is now "15 namespaces". The test's own list (`:44-60`, 15 entries) and its title at `:93` ("exactly 15") are the authority |
| 4 | D41's stale comment | `packages/shared/src/i18n/en/common.ts:566-571` | Done. The comment now says the clients read the 12-entry map |

## 2. Item 1: CPS1-9, the PostgreSQL server log (security ruling 14)

### 2.1 Before

`.cache/rollback/C2/scripts/pg/init.mjs.pre:60-70`:

```js
/** Appended to postgresql.conf. Logging settings are not touched: they stay at the defaults
 *  (contract NL-5). */
export const CONF_BLOCK = [
  '',
  '# --- DEMS project-local settings (scripts/pg/init.mjs; plan W07, analysis TD-02) ---',
  '# Loopback IPv4 only, the project port, no Unix socket. Never the default port.',
  `listen_addresses = '${PG_HOST}'`,
  `port = ${PG_PORT}`,
  "unix_socket_directories = ''",
  '',
].join('\n');
```

The server is started by `scripts/pg/server.mjs:77-83` as `pg_ctl -D .data/postgres -l .data/postgres.log -w -t 30 -o "<endpoint options>" start` (unchanged). `pg_ctl -l` opens the file once in append mode. Nothing rotates it while the server runs.

### 2.2 After

`scripts/pg/init.mjs:66-86`. The non-comment lines added after the three endpoint lines:

```
log_error_verbosity = terse
logging_collector = on
log_directory = 'log'
log_filename = 'postgresql-%H.log'
log_file_mode = 0600
log_rotation_age = 1h
log_rotation_size = 0
log_truncate_on_rotation = on
```

Three comment lines in the block explain them, plus the doc comment `:61-65`. `init.mjs:240` prints one more line when RP-2 appends the block. The header `:7-8` names the settings. The full diff is `git diff -- scripts/pg`, quoted in section 6.

### 2.3 The mechanism and why

| Requirement (ruling 14) | Setting | Evidence |
|---|---|---|
| No failing row and no key value in the log | `log_error_verbosity = terse`: no DETAIL, HINT, QUERY or CONTEXT line. The ERROR line keeps the constraint's name, and the STATEMENT line (placeholders only, NL-3) is not governed by verbosity | Sample config of the installed binary, `node_modules/@embedded-postgres/darwin-arm64/native/share/postgresql/postgresql.conf.sample:603` (`terse, default, or verbose messages`). The project's own primary messages hold no hash: `apps/core-server/src/db/migrations/0002_audit_guards.sql:41, 61, 78` format only `NEW.seq`, `head_seq` and `TG_OP` |
| A size bound for the server's log | The logging collector writes `.data/postgres/log/postgresql-HH.log`: one strftime escape, the hour, so 24 names at most. A time-driven rotation every hour opens the next name and truncates it (`log_truncate_on_rotation = on`). The ring holds at most the last 24 hours of output | Sample `:495-518`. Truncation happens "only ... on time-driven rotation, not on restarts or size-driven rotation" (sample `:512-518`) |
| Size-driven rotation off, set explicitly | `log_rotation_size = 0`. Left at its default (`10MB`, sample `:509`), a size-driven rotation in a ring of fixed names reopens the same hour file in append mode, so it bounds nothing | Sample `:509-518`. Mutation M6 (section 2.5): removing the line leaves PostgreSQL at `10240` kB, and the tests fail |
| Mode and place of the files | `log_file_mode = 0600` (CR-3); `log_directory = 'log'` is relative to the cluster directory `.data/postgres` (mode 0700, already ignored by git through `/.data/`, CR-7 test unchanged and green) | `init.test.mjs:126-148` |

PostgreSQL 18 has no byte cap for its own log. The bound it supports is a ring of time-named files that are truncated on reuse. So the bound is "24 hours of output", not a fixed number of bytes. Hypothesis, not measured here: the brief's 57 MB came from the current cluster, created 2026-10-04 07:12 (mtime of `.data/pg.pwfile`), which is about 50 hours, or about 1.1 MB per hour at the default verbosity. At that rate a full ring holds about 27 MB, and less with `terse`. I measured no byte count, because no log content was read.

**Alternatives considered.**

| Option | Why not |
|---|---|
| The start script truncates or rotates `.data/postgres.log` before `pg_ctl -l` | Bounds the file only at a restart. A server that runs for days still grows without bound, because `pg_ctl -l` never rotates |
| Collector, `log_filename = 'postgresql-%a.log'`, `log_rotation_age = 1d` | Also bounded, but at 7 days of output |
| Collector, `%H%M` with `log_rotation_size` (the documentation's second example) | Size-driven files are opened in append mode and are only truncated when a later time-driven rotation lands on the same minute name: up to 1,440 names. A weaker bound |
| Collector, `%M` with `log_rotation_age = 1min` | A tighter bound (60 one-minute files), but only one hour of history for diagnosis |
| `terse` only, no collector | Leaves the hashes out but adds no size bound (ruling 14 asks for both) |

### 2.4 Tests

**The pinned test, changed by design.** Before (`.cache/rollback/C2/scripts/pg/init.test.mjs.pre:106-110`):

```js
test('the settings block names the loopback address, port 4432 and no Unix socket, and no logging setting (NL-5)', () => {
  const lines = CONF_BLOCK.split('\n').filter((line) => line !== '' && !line.startsWith('#'));
  assert.deepEqual(lines, ["listen_addresses = '127.0.0.1'", 'port = 4432', "unix_socket_directories = ''"]);
  assert.doesNotMatch(CONF_BLOCK, /log_|logging_collector/);
});
```

After (`init.test.mjs:107-124`), the same test with:
- an exact expected list of the 11 non-comment lines (the three endpoint lines, then the eight lines of section 2.2);
- `doesNotMatch(lines.join('\n'), /log_statement|log_min_duration|log_min_error_statement|log_parameter|log_min_messages|log_destination/)`, so WHAT is logged stays at the defaults (NL-5).

**New tests: assertions for the two settings.**
- `init.test.mjs:126-148`, "ruling 14 (CPS1-9)". It writes the block into a temporary cluster folder. The project's own reader (`readSettings`, which `pg:start` uses through `assertClusterEndpoint`) reads every line, and `assertClusterEndpoint` passes. The test then asserts `terse`, collector `on`, directory `log`, file name `postgresql-%H.log` with exactly one escape `%H`, age `1h`, truncation `on`, size rotation `0` and mode `0600`.
- `init.test.mjs:150-174`, "PostgreSQL 18.4 reads the block as written". It runs `postgres -D <temporary folder holding only this postgresql.conf> -C <name>` for 11 names. This reads the configuration and exits: no server, no port, no data directory beyond a temporary folder. It asserts the values PostgreSQL would run with (`terse`, `on`, `log`, `postgresql-%H.log`, `384` = 0600, `60` minutes, `0`, `on`) and the three NL-5 defaults (`none`, `-1`, `0`). The folder holds only `postgresql.conf` afterwards. The child process is started through `lib.mjs` `run`, as `static.test.mjs` requires.

The same `-C` check run by hand is in `assets/10b_c2_pg_conf_check.log`:

```
$ postgres (PostgreSQL) 18.4
log_error_verbosity                terse
logging_collector                  on
log_directory                      log
log_filename                       postgresql-%H.log
log_file_mode                      384
log_rotation_age                   60
log_rotation_size                  0
log_truncate_on_rotation           on
listen_addresses                   127.0.0.1
port                               4432
...
log_statement                      none
log_min_duration_statement         -1
log_parameter_max_length_on_error  0
# folder contents after: postgresql.conf
```

### 2.5 Can the tests fail (rule M15: scratch copy only)

`assets/10b_c2_pg_mutations.log`. Each mutation was applied to a copy of `scripts/pg` in the session scratch folder (`node_modules` symlinked). The workspace `init.mjs` has the same SHA-256 before and after (`4d3b2f80…c740`).

```
baseline (no mutation) => ℹ pass 3 ℹ fail 0
M1 terse line removed => ℹ pass 0 ℹ fail 3
M2 verbosity default => ℹ pass 0 ℹ fail 3
M3 verbosity typo (tersee) => ℹ pass 0 ℹ fail 3
M4 collector off => ℹ pass 0 ℹ fail 3
M5 filename per minute (%H%M) => ℹ pass 0 ℹ fail 3
M6 size rotation line removed (default 10MB) => ℹ pass 0 ℹ fail 3
M7 no truncation => ℹ pass 0 ℹ fail 3
M8 rotation age 1d => ℹ pass 0 ℹ fail 3
M9 file mode 0644 => ℹ pass 0 ℹ fail 3
M10 statement logging added => ℹ pass 1 ℹ fail 2
M11 unknown parameter name => ℹ pass 0 ℹ fail 3
```

11 of 11 mutations are caught.

### 2.6 Never-log wording (NL-1, NL-5): sentences for the errata

NL-1 and NL-5 live in `masterplan/03_database_contract.md`, which this row may not write. The one copy in a granted file, the doc comment of `CONF_BLOCK` (it used to read "Logging settings are not touched: they stay at the defaults (contract NL-5)"), is corrected at `init.mjs:61-65`. Proposed errata:

- **NL-5** (`03_database_contract.md:1355`), replace with: "What PostgreSQL logs stays at its defaults (`log_statement = 'none'`, `log_min_duration_statement = -1`, `log_parameter_max_length_on_error = 0`); the scripts under `scripts/pg/` MUST NOT change these. How the server log is written is set by `pg:init` (security ruling 14, CPS1-9): `log_error_verbosity = terse` (no DETAIL, HINT, QUERY or CONTEXT line) and the logging collector writing a ring of 24 hourly files, `.data/postgres/log/postgresql-HH.log`, each truncated when its hour comes round again (`log_rotation_age = 1h`, `log_truncate_on_rotation = on`, `log_rotation_size = 0`, `log_file_mode = 0600`). `.data/postgres.log` (`pg_ctl -l`) keeps only what the server writes before the collector starts [AN:300]."
- **NL-1** (`:1351`; see erratum D-3 at `:2683`), add: "The PostgreSQL server's own log: with `log_error_verbosity = terse` (NL-5) a refused statement writes its ERROR line (with the constraint's name) and its STATEMENT line (placeholders only, NL-3), but no DETAIL line, so no failing row and no key value. This holds for a cluster created by `pg:init` after closing-fix round C2 (W90). The project's own trigger messages carry a sequence number or `TG_OP` only (`0002_audit_guards.sql:41, 61, 78`)."
- **File table** (`:1925`, the row `.data/postgres.log`): "What the server writes before the logging collector starts (about one line per start). The server's own log is `.data/postgres/log/postgresql-HH.log` (24 files, 0600; NL-5)." The reader column "the log check of row 28 (W17)" moves to the collector's file (C2-R1).
- **Ruling 14** (`gateway_check/05_cp_access_control_security.md:482`) says the change "changes one test by design (`scripts/pg/init.test.mjs:106-110`)". It also changes `apps/core-server/test/db/pg-behaviours.db.test.ts` (C2-R1).

## 3. Item 2: CPW1-7, the unguarded web boot

**Before** (`.cache/rollback/C2/apps/core-web/src/main.tsx.pre:45-50`):

```tsx
const runtime = await bootCoreRuntime({ onSimError: reportSimError })

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('#root element missing from index.html')

if (runtime.kind === 'REFUSED') {
```

**After** (`apps/core-web/src/main.tsx`):
- `:12`: `import { webErrorSink } from './runtime/error-sink'`. This is the page's own sink, the same module instance `runtime/boot.ts:32` writes to.
- `:46-52`: a doc comment and `BOOT_FAILED_SENTENCE = 'The console could not start; reload the page to try again.'`.
- `:54-65`: `let runtime: Awaited<ReturnType<typeof bootCoreRuntime>> | null = null` and `try { runtime = await bootCoreRuntime(...) } catch (error) { webErrorSink.report({ level: 'error', source: 'main.boot', message: <fixed text>, at: Date.now(), context: { errorName: <Error.name or typeof> } }) }`. The record carries no message, no stack and no error text. `errorName` is the kind only (`Error`, `TypeError`, `string`), so a reader can tell a chunk failure from a thrown error.
- `:70-75`: `if (runtime === null)` builds one `<p role="alert">` with the DOM alone (`textContent`, so no markup is parsed) and replaces the children of `#root` with it. `else if (runtime.kind === 'REFUSED')` and `else` are unchanged.
- Nothing is started in its place: no second boot, no `createSim`, no router (AC-C-25, ADQ-7). The sentence makes no claim about the cause, because the cause is unknown, and offers the one action that retries, a reload.

**The pin, changed by design** (`live-runtime-static.test.tsx:106-135`, granted):

| | Static value imports of `main.tsx` | Dynamic imports |
|---|---|---|
| Before | `@fontsource-variable/orbitron`, `@fontsource-variable/inter`, `@fontsource-variable/jetbrains-mono`, `./index.css`, `react`, `react-dom/client`, `@tanstack/react-query`, `@tanstack/react-router`, `react-i18next`, `zod` (10) | `./runtime/boot`, `./i18n`, `./router`, `./runtime/live-host-refusal` |
| After | the same 10, then `./runtime/error-sink` (11) | unchanged |

The title at `:106` names the addition. A guard at `:125-128` checks the rule of that test ("main.tsx imports nothing statically that builds a zod schema"): `runtime/error-sink.ts` must have no import other than a type import, so loading it before `z.config` cannot build a schema. Why static and not dynamic: the failure path then depends on no further chunk load.

**New test** `apps/core-web/src/test/live-runtime-boot-failure.test.tsx`. It mocks `../runtime/boot` (the start-up), `../router` (`createAppRouter`) and `createSim` in `@dems/shared/sim`; i18n is real. Four cases: an Error, a TypeError ("Failed to fetch dynamically imported module …"), a rejected non-Error value, and a synchronous throw. Each asserts:
- importing `main.tsx` resolves (no unhandled rejection);
- the text of `#root` equals the sentence, with one `role="alert"`;
- the start-up was called once, and `createSim` and `createAppRouter` never;
- exactly one sink record `{ level: 'error', source: 'main.boot', context: { errorName } }` with no stack;
- the marker in the error (a `ses_`-shaped value and an address) appears in no record, not on the page and in no console call.

**Can it fail** (rule M15: load-time transform of `main.tsx` through a Vite plugin in a scratch config, `assets/10b_c2_web_mutate.config.mjs.txt`; the file on disk has the same SHA-256 before and after, `13174093…b966`). From `assets/10b_c2_web_mutations.log`:

```
baseline (no mutation) => Tests 4 passed (4) (anchor errors: 0)
W1 rethrow (guard removed) => Tests 4 failed (4) (anchor errors: 0)
W2 error text recorded => Tests 4 failed (4) (anchor errors: 0)
W3 fallback to the simulator => Tests 4 failed (4) (anchor errors: 0)
W4 start-up asked again => Tests 4 failed (4) (anchor errors: 0)
W5 sentence not shown => Tests 4 failed (4) (anchor errors: 0)
W6 recorded twice => Tests 4 failed (4) (anchor errors: 0)
W7 not recorded => Tests 4 failed (4) (anchor errors: 0)
W8 other sentence (claims a fallback) => Tests 4 failed (4) (anchor errors: 0)
W9 stack recorded => Tests 4 failed (4) (anchor errors: 0)
W10 router built anyway => Tests 4 failed (4) (anchor errors: 0)
```

Two spot checks of the failure reason: W3 fails with `AssertionError: expected "vi.fn()" to not be called at all, but actually been called 1 times` (the simulator constructor), and W7 with `AssertionError: expected [] to have a length of 1 but got +0` (the record).

## 4. Item 3: CPW1-10, `packages/shared/test/i18n.test.ts:2`

Before: `// one plain, deep-mergeable object with 13 namespaces, keep the Indonesian domain terms`. After: `// one plain, deep-mergeable object with 15 namespaces, keep the Indonesian domain terms`. The authority is `NAMESPACE_FILES` (`:44-60`, 15 entries) and the test at `:93`, "has exactly 15 namespace files". Comment only: one line out, one in.

## 5. Item 4: D41's comment, `packages/shared/src/i18n/en/common.ts:566-571`

D41 (`decisions.md:47`) left "a stale comment in `common.ts:566-569` (next writer fixes it)". After D37's option A, the map `securityAudit.rbac.permissions` holds all twelve permissions and is the one the clients read: `apps/core-web/src/features/users-roles/matrix-panel.tsx:63`, `role-dialog.tsx:80`, `features/security-audit/rbac-panel.tsx:103, 205`, `apps/mobile/src/features/settings/profile-sheet.tsx:64`. No production file reads `common.rbac.permissions` (grep over `apps/` and `packages/shared/src`). `test/i18n-vocabulary-sync.test.ts:119-131` requires a label there to read the same in both maps.

Before (`:568`): `(2026-10-04 01_specs §4.3). The nine earlier ones are \`securityAudit.rbac.permissions.*\`.`

After (`:568-570`):

```
 * (2026-10-04 01_specs §4.3). The map the clients read is `securityAudit.rbac.permissions.*`,
 * which holds all twelve, these three included (D37, D41); a label here must read the same
 * there (`test/i18n-vocabulary-sync.test.ts`).
```

Comment only: one line out, three in. No key or value changed, and no test pins this file (grep for `i18n/en/common` over `apps/`, `packages/` and `scripts/`: none).

## 6. Final verification

| Check | Command | Result | Asset |
|---|---|---|---|
| pg scripts | `npm run test:pg-scripts` (09:39 and 09:40) | `ℹ tests 57 ℹ pass 57 ℹ fail 0`, exit 0 | `10b_c2_pg_scripts_final.log` |
| Web, targeted | `npm --prefix apps/core-web run test -- src/test/live-runtime-boot-failure.test.tsx src/test/live-runtime-static.test.tsx --reporter=verbose` | `Test Files 2 passed (2)`, `Tests 13 passed (13)`, exit 0 | `10b_c2_web_targeted.log` |
| Shared, targeted | `npm --prefix packages/shared run test -- test/i18n.test.ts test/i18n-vocabulary-sync.test.ts` | `Test Files 2 passed (2)`, `Tests 50 passed (50)`, exit 0 | `10b_c2_shared_targeted.log` |
| Typecheck, lint | `npm --prefix apps/core-web run typecheck` / `lint`; `npm --prefix packages/shared run typecheck` / `lint` | exit 0, exit 0, exit 0, exit 0 | `10b_c2_typecheck_lint.log` |
| Web, full | `npm --prefix apps/core-web run test -- --maxWorkers=2` (09:36:14, load 3.99) | `Test Files 104 passed (104)`, `Tests 1396 passed (1396)`, exit 0. There are 104 test files on disk | `10b_c2_web_full.log` |
| Shared, full | `npm --prefix packages/shared run test -- --maxWorkers=2` (09:38:38) | `Test Files 69 passed (69)`, `Tests 1840 passed (1840)`, exit 0 | `10b_c2_shared_full.log` |
| Secret scan of the assets (counts only) | `grep -cE '\b(ses\|dvc\|bio)_[A-Za-z0-9_-]{6,}'` and `grep -ciE 'password=\|PGPASSWORD\|DEMS_PG_PASSWORD'` over the 12 `10b_c2_*` files | 0 and 0 in every file | none |

A first full web run at 09:33 was invoked as `npx --prefix apps/core-web vitest run --root apps/core-web --maxWorkers=2`, with the cwd at the repo root. It had one red file, recorded here rather than discarded: `src/test/shell-motion.test.tsx`, `Error: ENOENT … open '/Users/gsp-budi/Documents/DEMS/src/components/shell/shell.css'`. That test reads `${process.cwd()}/src/components/shell/shell.css` (`:513`), so the failure comes from the invocation's cwd and not from this change. The project's own invocation, `npm run test`, which sets the cwd to the package, is the run quoted above.

`git diff --stat` of the changed tracked files:

```
 apps/core-web/src/main.tsx                         | 30 ++++++++-
 .../core-web/src/test/live-runtime-static.test.tsx |  7 +-
 packages/shared/src/i18n/en/common.ts              |  4 +-
 packages/shared/test/i18n.test.ts                  |  2 +-
 scripts/pg/init.mjs                                | 23 ++++++-
 scripts/pg/init.test.mjs                           | 74 ++++++++++++++++++++--
 6 files changed, 127 insertions(+), 13 deletions(-)
```

Plus one new file, `apps/core-web/src/test/live-runtime-boot-failure.test.tsx` (81 lines).

`git diff -- scripts/pg` (full diff: `assets/10b_c2_scripts_pg.diff`, 154 lines; the excerpt for `CONF_BLOCK` is in section 2.2; summary): `init.mjs` gains the doc comment `:61-65`, three comment lines and eight settings in `CONF_BLOCK` (`:73-84`), two header lines (`:7-8`) and one `say` line (`:240`). `init.test.mjs` gains the header line `:3-4`, three imports (`assertClusterEndpoint`, `readSettings`, `run`), the changed test `:107-124` and the new tests `:126-148` and `:150-174`. No other file under `scripts/pg` differs. `server.mjs` and `server.test.mjs` have the same SHA-256 as their pre-images (`431214d1…16ac`, `01c2dff4…eb5`).

**`.data/` was not touched** (`assets/10b_c2_data_mtime.log`; `stat` of mtimes only, no content read):

| Path | Before (09:24:07) | After (09:41:30) |
|---|---|---|
| `.data` | 2026-10-04 07:12:26 | 2026-10-04 07:12:26 |
| `.data/pg-scripts.log` | 2026-10-06 05:46:13 | 2026-10-06 05:46:13 |
| `.data/pg.env`, `pg.owner.env`, `pg.pwfile` | 2026-10-04 07:12:23 | 2026-10-04 07:12:23 |
| `.data/postgres` | 2026-10-04 07:14:26 | 2026-10-04 07:14:26 |
| `.data/postgres/postgresql.conf` | 2026-10-04 07:12:24 | 2026-10-04 07:12:24 |
| `.data/postgres/postgresql.auto.conf`, `pg_hba.conf` | 2026-10-04 07:12:23 | 2026-10-04 07:12:23 |
| `.data/postgres.log` | 2026-10-06 09:06:08 | 2026-10-06 09:41:05 |

`.data/postgres.log` is appended to by the running server, which other rows' test runs keep busy. This row never wrote it. `.data/postgres/log` does not exist: the running cluster has none of the new settings, as intended. No server was stopped, started, restarted or re-initialised. No credential file was opened, and none had its content read.

## 7. Note for W90 (the clean-state rebuild)

1. **The new settings take effect at W90's `pg:init`**, when RP-2 runs `initdb` and appends `CONF_BLOCK` (`init.mjs:229-242`). They are NOT applied by `pg:start` on an existing cluster, nor by `node scripts/pg/init.mjs --resume` while `.data/postgres/PG_VERSION` exists (RP-2 then prints "initdb is not run again" and appends nothing). The order is therefore `npm run pg:remove-data` (which deletes the whole of `.data/`, the current 57 MB `postgres.log` included, `remove-data.mjs:56`), then `npm run pg:init`.
2. `pg:init` prints the new line `postgresql.conf: log_error_verbosity = terse and the hourly log ring in .data/postgres/log/ appended (ruling 14)`.
3. Expected after the first start, but not verified here because no server was started: `.data/postgres/log/postgresql-HH.log` (mode 0600) exists; `.data/postgres/current_logfiles` names it; `.data/postgres.log` holds about one line per start (the collector redirect notice); `SELECT setting FROM pg_settings WHERE name = 'log_error_verbosity'` answers `terse`.
4. **Before W90's database suite: C2-R1** (section 8). Without the change described there, `apps/core-server/test/db/pg-behaviours.db.test.ts` is red in two tests on the new cluster.
5. For the security review W99: a re-count of CPS1-9 reads `.data/postgres/log/*.log`, no longer `.data/postgres.log`.

## 8. Residuals for the controller

| ID | What | Why it is not done here | Proposal |
|---|---|---|---|
| **C2-R1** (blocks W90's db suite until handled) | `apps/core-server/test/db/pg-behaviours.db.test.ts` pins the old logging. (a) `:143` expects `{ name: 'log_error_verbosity', setting: 'default' }`, but the new cluster answers `terse`. (b) The log check (the `describe` at `:108`) reads `join(dataDir, 'postgres.log')` (`:109`); with the collector, refused statements are written to `.data/postgres/log/postgresql-HH.log`, so `appended()` finds 0 lines and `expect(statements).toHaveLength(7)` (`:234`) fails. (c) Its findings (`DETAIL:  Key (…)=(\x…)` and `Failing row contains` at `:242-259`, and the foreign-key DETAIL at `:262`) are exactly what `terse` removes, so they invert by design | Outside this row's write paths (`apps/core-server/**`). Ruling 14 named only `init.test.mjs:106-110` | The file's owner changes it before W90's db run. (1) `:143` setting `'terse'`. (2) `logFile()` reads the collector's current file from `join(dataDir, 'postgres', 'current_logfiles')` (one line `stderr log/postgresql-HH.log`, mode 0600, same OS user), resolved against `join(dataDir, 'postgres')`; across an hour boundary it reads the rest of the first file from its offset plus the new file from 0. (3) Inverted findings: 0 `DETAIL:` lines, 0 `Failing row contains`, 0 `Key (` lines carrying the markers; the ERROR lines name the constraints; the 7 STATEMENT lines with placeholders stay; mode 0600. The header `:5-8` names the new file. The other route is to keep the old cluster for W90, which is not what ruling 14 and D190 O-14 ask for |
| C2-R2 (Low) | A failed `pg:start` prints the last 15 lines of `.data/postgres.log` (`server.mjs:84-88`). Errors raised before the collector starts (configuration, bind, shared memory) are still there. An error after it starts (for example in crash recovery) is in `.data/postgres/log/` | Smallest change, and the failure path cannot be tested here (the real cluster holds 127.0.0.1:4432, so `startServer` in a test workspace refuses before `pg_ctl`) | One hint line in that message naming `.data/postgres/log/` (W91 or the runbook) |
| C2-R3 | Errata: NL-5, NL-1, the file-table row `:1925` of `03_database_contract.md`, and ruling 14's "one test" count | Not a granted file | Sentences in section 2.6 |
| C2-R4 (Info) | The three dynamic imports before the boot (`main.tsx:22-24`: `./runtime/boot`, `./i18n`, `./router`) are still unguarded. A chunk that fails to load there leaves a white page | CPW1-7 names `:45`. Guarding the imports changes the module's structure | For the web code review W92 |
| C2-R5 (Info) | The ring bounds the log by 24 hours of output, not by bytes, and `.data/postgres.log` grows by about one line per start | PostgreSQL has no byte cap for its own log (section 2.3) | Accepted residual, stated in the NL-5 erratum |

## 9. Rollback

Pre-images are in `.cache/rollback/C2/<path>.pre` and their SHA-256 in `.cache/rollback/C2/C2.pre.sha256`. That covers the six changed files, plus `scripts/pg/server.mjs` and `server.test.mjs`, which were saved but not changed. To roll back:

```sh
R=/Users/gsp-budi/Documents/DEMS; C=$R/.cache/rollback/C2
for f in scripts/pg/init.mjs scripts/pg/init.test.mjs apps/core-web/src/main.tsx \
         apps/core-web/src/test/live-runtime-static.test.tsx packages/shared/test/i18n.test.ts \
         packages/shared/src/i18n/en/common.ts; do cp "$C/$f.pre" "$R/$f"; done
# then remove the new file apps/core-web/src/test/live-runtime-boot-failure.test.tsx (controller's decision)
# check: shasum -a 256 the six files against C2.pre.sha256
```

Rolling back item 1 matters only before W90's `pg:init`. A cluster created with the new block keeps it until it is re-initialised.

Post-change SHA-256:

```
4d3b2f808a2db58980bb8b79592067799413249ac6ea5b55d413b948ec00c740  scripts/pg/init.mjs
afae65699b3e6436daacecf0bf08635791fac94f4ace3b46ea635edd95387775  scripts/pg/init.test.mjs
131740933fc8de3f85603eb14fe7d35008024d86ac291e7d8eef42f97e36b966  apps/core-web/src/main.tsx
274c425ca5473a41d500baf9e4dbc9574baf4214f7ee509e9cdb750fa1dc7e53  apps/core-web/src/test/live-runtime-static.test.tsx
a6ca0809e44681b6256e82deb39ccf83b24d794c7313ce39f0d32c521c0870bd  apps/core-web/src/test/live-runtime-boot-failure.test.tsx
405c5b8fed6f2832317b65c00b9be97bb40b2de72d1e0d30e3872a9097cc73ca  packages/shared/test/i18n.test.ts
3912e8ce8d1f50f4cc962d9b497a20bdcc53ae06c8aa6021fb85a7f95caee166  packages/shared/src/i18n/en/common.ts
```

## 10. Boundaries kept, and one deviation

- Writes: `scripts/pg/init.mjs`, `scripts/pg/init.test.mjs`, `apps/core-web/src/main.tsx`, one new test file under `apps/core-web/src/test/`, the granted pin in `live-runtime-static.test.tsx`, the comment of `packages/shared/test/i18n.test.ts:2`, the comment in `packages/shared/src/i18n/en/common.ts`, this document, the progress file, `gateway_check/assets/10b_c2_*` (12 files) and `.cache/rollback/C2/`. No path of C1 was written.
- No server, device, lane or Docker. No git write. No file deleted or renamed. Mutations ran on a scratch copy or as a load-time transform only (M15). The scratch folders are in the session scratchpad.
- **Deviation (disclosed):** at about 09:25, to take `CONF_BLOCK` for the `-C` check, I first imported `scripts/pg/init.mjs` with `node -e` without the test-runner guard. Its `main()` returns at once when the file is not the entry point (`lib.mjs:511-512`, `isMain`), so nothing ran. The mtime of `.data/pg-scripts.log`, which every script run writes to, is unchanged (05:46:13 before and after). Later imports set `NODE_TEST_CONTEXT=child`, a second guard (`lib.mjs:513`).
