# Row pg_start: start the project PostgreSQL after the Mac restart

- Status: complete
- Agent: coder-execution (mechanical row, model sonnet)
- Date: 2026-10-14
- Result: project PostgreSQL running on 127.0.0.1:4432, PID 65169 (`postgres`, TCP only), `.locks/postgres.pid` = 65169.
- Stale pid: `.locks/postgres.pid` held 32505 (process gone, ESRCH). Not an obstacle: `startServer` treats a dead pid as "stopped" and overwrites the pid file itself after the start. No file deleted by hand. No `.data/postgres/postmaster.pid` existed.
- Sandbox: switched off for `npm run pg:start` (port bind), and for `lsof` / `db:status` (local connections to 4432). Each such call was individual.
- Read-only checks: `db:status` (SELECT only, verified in status.ts) for dems_demo, dems_lane_1, dems_lane_2, dems_lane_3: all four exist, audit heads/lineage/43 tables/triggers intact. Each reports exit 1: 15 migrations (0015-0029) not applied; databases at schema version 6 (dbc-7), code expects 13 (dbc-14). This is pre-existing drift, not a restart effect. Migrating is a decision for the controller/user; not done.
- Not run: pg:init, pg:stop, db:create, db:migrate, db:seed, db:reset, initdb. System PostgreSQL (`/Library/PostgreSQL/18`) untouched.
- Artifact: docs/2026-10-12_input_av_core_adapter_plan/implementation/pg_start_after_restart.md
- Consequence for other agents: database tests need the databases they use at schema version 13; the four project databases are at 6 until the controller decides on `db:migrate`. Tests that create their own `dems_test_*` databases are not affected by this.
