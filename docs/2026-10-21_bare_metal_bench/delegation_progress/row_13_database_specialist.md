# Row 13 - database-specialist - 2026-10-22
Status: complete (needs row 95 to resolve 1 DEP + 4 REQ placeholders)
Output: masterplan/01_specs_database.md
Also appended: delegation_progress/file_requests.md (4 register requests: pg_socket_dir, pg_conf_dir, pg_common_conf, pg_log_file)
Decisions taken (delegated): U-RF10 -> PostgreSQL 18.6-1.pgdg24.04+2, apt-mark hold (fallback 18.4); W3 -> pg.owner.env exists only during an owner run, dems_owner PASSWORD NULL between runs, fresh secret per run; unix socket kept (peer for postgres only, perms 0700).
Controller notes: add B edges Node install + tree placement -> row 41; add 40:B -> row 43; reword row 41 check (pg.owner.env absent).
Placeholders: <DEP:row91:migrations> default 36 (0034/0035, schema 16, dbc-17) else 34 (schema 15, dbc-16).
