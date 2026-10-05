# Progress — step 80 (plan row W58): GATE: backend

- Agent: verifier-local (free-tier verifier)
- Role: read-only on code; sole owner of `127.0.0.1:4420` + `dems_demo` for the duration (P18), released
- Output document: `gateway_check/06_backend_gate.md` (verdict line: `W58: PASS-WITH-NOTES`)
- Assets: `gateway_check/assets/06_*` (logs, scripts)
- Run window: 2026-10-05 17:13 → 18:10 WIB

## Status of the items

| Item | What | Result |
|---|---|---|
| Reading | plan §8.3 W58, §11.1–11.3, §5.3–5.5, §14; structured 487–578 (P1–P25); 01_gate_report M1–M16; decisions D31, D62/D74, D83, D95, D113, D139, D141, D142, D144, D145 | done |
| A | Gate commands §11.2 for core-server + shared | **PASS** — typecheck 0, lint 0 (no finding), `unit` 153 files / 3,912, shared 68 / 1,814, `test:pg-scripts` 55/55, `gen-openapi --check` up to date (75 ops, 2 schemes, 0.2.0); all exit 0 |
| Ledger | P24 / L-3 / L-4 vs D142 | exact match on unit 153/3,912, db 122/1,740, shared 68/1,814; web 55/760 (+1 over D144's 759 → note F-1), mobile 94 suites / 1,230 (above the 72/833 baseline) |
| B | Whole `db` project | **PASS** — `DEMS_TEST_STEP=80 npm run test:db -w @dems/core-server -- --maxWorkers=2` exit 0, 122 files / 1,740, 151.47 s, 0 retried drops, **0 databases left** with prefix `dems_test_step_80_` (independently re-listed) |
| C | Shifted-clock sweep (D31), 4 instants × 3 suites | **PASS** — no calendar failure in web/shared/mobile at real clock, 00:05, 23:58, 2027-03-01; one red in `apps/core-web/src/test/live-login-model.test.tsx` during instant (i), caused by the concurrent web writer editing `runtime/presentation-follow.ts` + that test at 17:27/17:28 → P11 noise, re-run green three times (note F-2, owner: web row in flight). Jest-context shift proven by `06_c_jest_probe.txt` |
| D | Smoke run on 4420 with `dems_demo` under the lock | **PASS** — start by the documented command (`DEMS_CORE_PORT=4420 npm run start -w @dems/core-server`, npm pid 4396, listener pid 4421 in `.locks/core-server.pid`); health 200 `service=dems-core-server ready={database:true,engine:true}`; sign-in 200 cookie `dems_session_4420` `Path=/; HttpOnly; SameSite=Strict`; protected `listUsers` 200 users=3; denied `listUsers` as INVESTIGATOR 403 `NOT_PERMITTED` with **exactly one** `ACCESS_DENIED` row (seq 89, actor OPR-001, `permission=USER_ADMIN`, `operationId=listUsers`); socket `hello`+`heartbeat` received, heartbeat validates against `HeartbeatSchema`; `lsof -nP -iTCP:4420 -sTCP:LISTEN` = one `127.0.0.1` listener; `lsof -nP -a -p 4421 -i` = LISTEN + two `127.0.0.1→127.0.0.1:4432` sockets only; graceful stop (SIGTERM → `shutdown complete`), pid file emptied, lock released, port free |
| E | Session sweeper's first real run on a listening server | **observed** — its read statement seen on the server's own connection (`application_name=dems-core-server`) at 10:43:12.661Z, 10:56:23.233Z, 10:58:31.724Z across three starts; found nothing expired, opened no transaction, wrote no row (`AUTH_EXPIRED=0` before and after), no error line. Residual F62 item 5 closed as "ran, correctly, nothing to expire" (evidence limit noted, F-5) |
| F | Live `npm audit` | 80 entries (5 low, 25 moderate, **50 high, 0 critical**) = 16 advisories (4 high: undici ×2, node-forge, braces); 11 direct entries, all highs in the mobile/test chain; nothing installed or changed. Queue item of D113 discharged (F-3) |
| G | Hygiene | log scan clean (0 findings in all three server logs and another row's lane log; the 2 counts are this row's own step label text); server request lines hold `"route"` patterns only, `grep -c '"url"' = 0`, `?token=` marker never appears in a server log; modes 700 `.data`, 600 three credential files and the logs; no leftover listener on 4420-4423 / 5176-5178 / 8081-8086; no leftover PID of this row; PostgreSQL PID 19121 untouched |
| Verdict | written as the last line of the report | `W58: PASS-WITH-NOTES` |

## Load and protocol notes

- Load average: 4.06 at the start, peak 8.87 at 17:22 — below the P9 trigger of 10. One sandbox
  bypass used per command for the database/port work (P10); no `cd` into a subfolder from a prompt
  (only inside the row's own scripts, by absolute path); no `timeout` command used.
- No lane backend ran while this gate ran (4421–4423 verified empty before and after).
- Nothing printed from a credential file: every script reads `.data/pg.env` / `.data/pg.owner.env`
  internally and prints names, counts and statuses only; the seeded password is named only by its
  constant `DEMO_OPERATOR_PASSWORD` (P19).
- Processes started by this row and stopped again: 3 Core server processes (pids 4421, 5698, and the
  first attempt's 98520), their npm wrappers, and one hung asset script (98532, this row's own).
  No other agent's process was touched (P7).

## Files written by this row (its whole deliverable)

- `gateway_check/06_backend_gate.md`
- `gateway_check/assets/06_*` (a1–a6 command logs, b0–b2 db logs, c_* sweep logs ×13 + driver,
  d1/d2/d3 smoke and server logs + runner/probe scripts, f audit logs, g1/g2 hygiene logs,
  `06_db_inventory.mjs`, `06_db_snapshot.mjs`, `06_sweeper_watch.mjs`, `06_smoke.mjs`,
  `06_socket_probe.mjs`, `06_log_scan.mjs`)
- `delegation_progress/verifier_local_step_80.md` (this file)

Nothing else: no source file, no `status_tasks.md`, no `delegation_progress_report.md`, no
`decisions/decisions.md`, no other row's document, no `masterplan/02_plan.md`.

## What the controller needs from this row

- W104 (checkpoint commit 1, step 125) is unblocked (GR-9, D141 item 5).
- Notes F-1…F-9 are listed in the report's findings table with owners; none is a blocker and none
  is a High. Two of them touch other rows' books: the web ledger line (+1, F-1) and the demo
  database residue the next holder of 4420 will see (F-4).
- Housekeeping: this row created and then removed two stray empty folders caused by mistyped paths
  (`docs/2026-10-04_dems_backend_r_rbac_pairing/**`); `docs/` now holds only the two real task folders.
