---
agent: coder-execution
row: closing-fix round C2 (D190 O-14 CPS1-9, O-7 CPW1-7, O-6 CPW1-10, O-10 D41's comment)
status: needs-review (four items done and verified; C2-R1 needs a controller decision before W90's database run)
---

# coder-execution: closing-fix round C2

| Time | Event |
|---|---|
| 09:20 | Started. Read the brief, `gateway_check/05_cp_access_control_security.md` CPS1-9 (`:427-433`) and ruling 14 (`:482`), `gateway_check/08_cp_web_runtime.md` CPW1-7 and CPW1-10 (`:323, 326, 656`), decisions D37, D41, D88 (rule M15) and D190, contract NL-1/NL-3/NL-5 (`03_database_contract.md:1351-1355`), `scripts/pg/init.mjs`, `init.test.mjs`, `server.mjs`, `lib.mjs` (`readSettings`, `run`, `main`), `apps/core-web/src/main.tsx`, `runtime/boot.ts`, `runtime/error-sink.ts`, `live-runtime-static.test.tsx` |
| 09:22 | Found the reader of the server log outside this row: `apps/core-server/test/db/pg-behaviours.db.test.ts:5-8, 108-262` reads `.data/postgres.log`, pins `log_error_verbosity = default` (`:143`) and the DETAIL findings. Not in ruling 14's list. Recorded as C2-R1 |
| 09:24 | `.data/` mtime listing BEFORE (stat only). The target files were clean against HEAD (`git status --short` empty). Pre-images of 8 files and `C2.pre.sha256` written to `.cache/rollback/C2/` |
| 09:25 | Item 1: `CONF_BLOCK` extended (terse; collector, hourly ring, mode 0600, size rotation 0, truncation on). Mechanism checked against the installed binary's `postgresql.conf.sample:495-518, 603`. **Deviation:** imported `init.mjs` with `node -e` without the test-runner guard. Its `main()` is entry-point-only (`lib.mjs:511-512`), so nothing ran, and the mtime of `.data/pg-scripts.log` is unchanged (05:46:13). Later imports set `NODE_TEST_CONTEXT=child` |
| 09:27 | `postgres -C` on a scratch folder holding only the block: PostgreSQL 18.4 accepts every value (terse, on, log, postgresql-%H.log, 384, 60, 0, on). No server, no port. The folder holds only `postgresql.conf` afterwards |
| 09:28 | `init.test.mjs`: the pinned test `:106-110` changed by design (`:107-124`); two tests added (`:126-148` the settings through the project's own reader; `:150-174` `postgres -C` on a temporary folder). `node --test init.test.mjs`: 10/10 |
| 09:28-09:29 | M15 on a scratch copy of `scripts/pg`: 11 of 11 mutations caught. Whole pg suite 57/57. Header and printed line of `init.mjs` updated; 57/57 again |
| 09:29-09:30 | Item 2: `main.tsx` guarded (`:12, 46-75`); pin changed by design (+ `./runtime/error-sink`, guard: the sink imports no value); new `live-runtime-boot-failure.test.tsx` (4 cases). Targeted: 2 files / 13 tests passed |
| 09:30-09:32 | M15 as a load-time Vite transform from a scratch config: 10 of 10 mutations caught. Failure reasons spot-checked (W3: the simulator constructor called; W7: no record) |
| 09:32 | Items 3 and 4: the two comments. Shared i18n tests 2 files / 50 passed. No test pins `common.ts` |
| 09:32-09:33 | Typecheck and lint, core-web and shared: exit 0 (×4) |
| 09:33 | Shared full (`npx … --maxWorkers=2`): 69/1,840 exit 0. Web full through `npx --prefix … --root …` (cwd = repo root): 1 red file, `shell-motion.test.tsx` ENOENT on `${process.cwd()}/src/components/shell/shell.css`, caused by the invocation's cwd. Recorded, not discarded |
| 09:36 | Web full via `npm --prefix apps/core-web run test -- --maxWorkers=2` (load 3.99): 104/1,396 exit 0 (104 test files on disk) |
| 09:38 | Shared full via `npm run test -- --maxWorkers=2`: 69/1,840 exit 0 |
| 09:39-09:41 | Final pg suite 57/57. `.data/` mtime listing AFTER: unchanged except `postgres.log`, which the running server appends to; `.data/postgres/log` does not exist. Assets re-captured: both mutation sets re-run into logs (same results), `-C` check, targeted, full, typecheck/lint, mtimes, the `scripts/pg` diff. Count-only secret scan of 12 assets: 0 / 0 |
| 09:45 | `gateway_check/10b_closing_fixes_c2.md` written. Done |

## Files

- modified: `scripts/pg/init.mjs`, `scripts/pg/init.test.mjs`, `apps/core-web/src/main.tsx`, `apps/core-web/src/test/live-runtime-static.test.tsx` (the granted pin), `packages/shared/test/i18n.test.ts` (comment `:2`), `packages/shared/src/i18n/en/common.ts` (comment `:566-571`)
- created: `apps/core-web/src/test/live-runtime-boot-failure.test.tsx`
- documents: `gateway_check/10b_closing_fixes_c2.md`, this file, `gateway_check/assets/10b_c2_*` (12 files)
- rollback: `.cache/rollback/C2/` (8 pre-images, `C2.pre.sha256`); `server.mjs` and `server.test.mjs` were saved but are unchanged

## Decisions taken inside the row

| # | Decision | Why |
|---|---|---|
| C2-D1 | Size bound = logging collector, ring `postgresql-%H.log`, `log_rotation_age = 1h`, `log_truncate_on_rotation = on`, `log_rotation_size = 0` | The only bound PostgreSQL 18 applies to a RUNNING server's log; `pg_ctl -l` never rotates. Size rotation in a fixed ring would append (sample `:512-518`), and its default 10MB would apply if the line were left out. 24 hours of history for diagnosis |
| C2-D2 | `log_file_mode = 0600` and `log_directory = 'log'` set explicitly (both are the defaults) | They make CR-3 and the location visible and testable |
| C2-D3 | The web sink is imported statically, with a guard that it imports no value | The failure path depends on no further chunk load; the zod-JIT rule holds |
| C2-D4 | The record carries `context.errorName` (the kind of the error), never the message or the stack | "Without the error text"; the kind tells a chunk failure from a thrown error |
| C2-D5 | `server.mjs` unchanged (no hint line on a start failure) | Smallest change; the path cannot be tested while the real cluster holds the port. Residual C2-R2 |

## Residuals for the controller

C2-R1 (blocks W90's db suite until handled: `pg-behaviours.db.test.ts` changes by design, outside this row's paths), C2-R2 (start-failure hint), C2-R3 (errata sentences for NL-5, NL-1, file table `:1925`, ruling 14's count), C2-R4 (dynamic imports `main.tsx:22-24` unguarded, for W92), C2-R5 (bound by hours, not bytes). Details are in `gateway_check/10b_closing_fixes_c2.md` §8.
