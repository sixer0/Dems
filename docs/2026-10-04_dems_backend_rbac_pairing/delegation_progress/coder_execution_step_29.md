---
task_id: 2026-10-04_dems_backend_rbac_pairing
agent: coder-execution (tier R)
blueprint_row: 29 (plan W07, PostgreSQL provisioning and trial; early proof b)
date: 2026-10-04
status: complete
evidence_tier: 3
---

# coder-execution progress: step 29 (W07, PostgreSQL provisioning and trial)

Status: **complete**. **TD-02 npm route CONFIRMED**: trial T2 to T7 with T3-a, T3-b and T5-a to
T5-j all PASS (T5-h recorded). The fallback row Fb is not needed. The server is **running** on
`127.0.0.1:4432`, PID 19121 in `.locks/postgres.pid`; `npm run pg:status` exits 0.

Output document: `initialization/04_postgres_provisioning.md` (evidence for every line below).
No credential value is in either document: file names, modes, key names, role names and PIDs only.

## Milestones (WIB)

| Time | Event |
|---|---|
| 06:50 | Row started; inputs read |
| 07:06 | Scratch `initdb` under `$TMPDIR` (no port bound): fails inside the sandbox on `shmget`, passes outside. Used for the `pg_hba.conf` fixture; scratch folder deleted |
| 07:11 | `scripts/pg/` written; `node --test scripts/pg/` 55 of 55 |
| 07:12:02 | `.data/` absent; `git check-ignore -v` matches; SU-1 hashes equal to step 25 |
| 07:12:16 | T2 (start of the time box) |
| 07:12:23 | `lsof -nP -iTCP:4432 -sTCP:LISTEN` prints nothing; `npm run pg:init`: RP-1 to RP-6, T3 to T5-j, exit 0 at 07:12:24. Superuser closed for good |
| 07:13:46 | T6 PASS (row survives stop and start) |
| 07:14:04 | T7 PASS (no process, no launchd job of ours, no brew service) |
| 07:14:25 | Idempotence checks; server started again, PID 19121 |
| 07:15:35 | `npm run test:pg-scripts` exit 0 (55 tests, 7 files) |
| 07:16 | `node scripts/pg/trial.mjs owner-steps` PASS; `npm run pg:status` exit 0; final evidence |
| 07:22:24 | `npm run test:pg-scripts` exit 0 again after the last edit (55 tests); leak scan over 142 files: 0 |
| 07:22:32 | Final check: `npm run pg:status` exit 0, PID 19121, one listener on `127.0.0.1:4432` |

## Files created or updated

Workspace (the owned write paths of W07; nothing else was written):

- `scripts/pg/init.mjs`, `start.mjs`, `stop.mjs`, `status.mjs`, `remove-data.mjs`, `remove.mjs` (the six npm commands)
- `scripts/pg/check-hba.mjs` (host-authentication check), `scripts/pg/check-superuser-trigger.mjs` (T5-j)
- `scripts/pg/trial.mjs`, `lib.mjs`, `server.mjs`, `db.mjs`
- `scripts/pg/lib.test.mjs`, `server.test.mjs`, `check-hba.test.mjs`, `init.test.mjs`, `remove-data.test.mjs`, `db.test.mjs`, `static.test.mjs`
- `scripts/pg/fixtures/pg_hba.initdb.conf`, `pg_hba.trust.conf`, `pg_hba.any-address.conf`

Git-ignored, created by `pg:init` and the scripts:

- `.data/` (700): `postgres/` (the cluster), `pg.pwfile`, `pg.owner.env`, `pg.env`, `postgres.log`, `pg-scripts.log` (600 each)
- `.locks/postgres.pid`, `.locks/postgres.lock`

Task folder:

- `initialization/04_postgres_provisioning.md`
- `delegation_progress/coder_execution_step_29.md` (this file)

No `package.json` was edited. `pg:remove` and `pg:remove-data` were not executed. No rollback was run.

## Processes (P7)

| PID | What | State |
|---|---|---|
| 16869 | PostgreSQL, first start by `pg:init` | Stopped by `pg:stop` (T6) |
| 18092 | PostgreSQL, restart of T6 | Stopped by `pg:stop` (T7) |
| 19121 | PostgreSQL, final start | **Left running** (P7 exception, P15); parent PID 1; `.locks/postgres.pid` |

No other process was started and left. The server on `*:5432` (PID 312, user `postgres`) was not
connected to, read or signalled.

## Test ledger (P24)

`scripts/pg/` is not a workspace. `npm run test:pg-scripts`: 0 tests before (no folder), **55
tests in 7 files** after, 0 failed. No workspace total changed and no existing test file was
touched. Workspace typecheck, lint and tests were not run by this row (it wrote no workspace
file).

## Findings (for the controller: F-n)

1. **F-1 Sandbox.** Inside the command sandbox: `initdb` fails (`shmget`: Operation not permitted); a TCP connection to `127.0.0.1:4432` fails with `EPERM`; `pg_ctl status` says "no server running" for a running server. So every database client needs the per-command bypass. `pg:status` handles it: exit 2 = "running by PID and files, connection checks not possible from here".
2. **F-2 T5-h.** `DROP DATABASE ... WITH (FORCE)` as `dems_owner` with an open `dems_app` session: refused, `42501` "permission denied to terminate process". PG-26 confirmed; TI-10's second branch applies; `pg_signal_backend` is not granted.
3. **F-3 T-AO-4.** The contract's own step T5-i puts `ALTER SYSTEM` into `scripts/pg/trial.mjs`; T-AO-4 expects no match for it in `scripts/` and exempts only `session_replication_role`. The static test of W08 / W17 needs that exception.
4. **F-4 Binaries.** Universal, signed by EDB, hardened runtime, not quarantined; `version()` names x86_64 while the process is ARM64.
5. **F-5 Hypotheses confirmed.** PG-21, PG-22, PG-23, PG-26, PG-27, PG-28, DA-11, DA-12, AS-01; `pg_ctl -w` without a Unix socket; `initdb -E UTF8 --locale=C`.
6. **F-6 Host server.** Its launchd job file is dated 12 September: it probably predates this task and the predecessor's sessions (a hypothesis from a file date). F27's "installed after the predecessor's last session" is doubtful.
7. **F-7** `.data/.DS_Store` (644), written by Finder at 07:16, not by the scripts.
8. **F-8** The macOS firewall is disabled; no prompt, no password request.
9. **F-9** After a reboot the server is down (by design); a leftover `postmaster.pid` is normally handled by PostgreSQL itself. Input for the README row (W86).
10. **F-10** `/usr/bin/lockf` does not hand its lock to the server it starts.

## Deviations from the plan (DR-n)

1. **DV-1** `CREATE ROLE ... PASSWORD` carries the SCRAM-SHA-256 verifier, not the clear password (stronger than RP-3's wording; tested against RFC 7677; logins proven by the trial).
2. **DV-2** One more file under `.data/`: `pg-scripts.log` (600), the scripts' own JSON-lines log.
3. **DV-3** Four more script files than the eight named (`lib`, `server`, `db`, `trial`) and three fixtures, all inside `scripts/pg/**`.
4. **DV-4** `pg:init --resume` exists and was **not executed** (it would connect as `dems_admin` again).
5. **DV-5** `pg:remove-data` stops the server and then refuses if one still runs (plan text and row rule both met).
6. **DV-6** The endpoint settings are in `postgresql.conf` and on the server's command line.
7. **DV-7** Three small edits after the provisioning run (status exit code 2; a conditional `RESET` and the `owner-steps` command in `trial.mjs`; a variable rename in `init.mjs`), re-verified at 07:16 without the superuser. The T5-j branch itself was not run again: `trial.mjs` now runs it only when `pg:init` asks (`superuserStep: true`); W90's clean rebuild is its next execution.
8. **DV-8** The shared tracking files were not written (parallel run, P8).

## Decisions needed (D-n)

1. **DN-1** Add database connections and `pg:start` / `pg:stop` / `pg:init` to P10 (sandbox bypass). Recommended.
2. **DN-2** Keep `pg_signal_backend` not granted (contract 15.1 item 26). Recommended.
3. **DN-3** Pass F-3 to the owner of the T-AO-4 static test (W08, W17).
4. **DN-4** Accept DV-1.
5. **DN-5** Accept DV-2, or ask for the removal of the script log.
6. **DN-6** Correct the wording of F27 (F-6).
7. **DN-7** W58 and W90 `stat` the named files, not every file under `.data/` (F-7).

## Blockers

None.
