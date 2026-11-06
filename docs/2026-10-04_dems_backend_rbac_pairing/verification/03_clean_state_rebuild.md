---
task_id: 2026-10-04_dems_backend_rbac_pairing
row: W90
date: 2026-10-07
agent: verifier
source_plan: docs/2026-10-04_dems_backend_rbac_pairing/masterplan/02_plan.md (row W90, line 769)
status: PASS with one CAUTION for a controller ruling (F-1)
tier: 3
---

# W90: Clean-state rebuild, following README.md literally

Window: 2026-10-07 05:29:00 to 05:35:23 WIB. Evidence: 42 files under `verification/assets/03_*`.
Every command below ran from the repository root. PostgreSQL connections and port binding ran with the
per-command sandbox bypass, as README Troubleshooting says.

## 1. Environment

| Item | Value | Evidence |
|---|---|---|
| Host | macOS 27.0.1 (26A434), Node v26.8.2, npm 11.19.1, HEAD `057fc17` | `assets/03_00_environment_before.txt` |
| Load | 2.29 at the start; 3.0 to 4.4 during the run; 3.84 at the end (limit 14, never reached) | `uptime` lines in 03_00, 03_60 and the step logs |
| Before | Old cluster PID 48897 on `127.0.0.1:4432`. Ports 4400, 4410, 4411, 4420-4423, 5173, 5176-5178 and 8081 free | 03_00 |
| Old databases (names only) | `dems_demo`, `dems_lane_1`, `dems_lane_2`, `dems_lane_3`, `postgres`, `template0`, `template1` | `assets/03_01_old_cluster_before.txt` |
| Old cluster logging | `log_error_verbosity = default`, `logging_collector = off`, no CPS1-9 lines in `postgresql.conf`, no `.data/postgres/log/` | 03_01 |
| Tracked files | 210 modified before and after. The SHA-256 of `git status --porcelain` (`4e6785b2...`) and of `git diff` (`15688668...`) are the same before and after, so this row changed no tracked file | 03_00, 03_60 |

## 2. README steps

"README" means `README.md` § Live mode. Exit codes come from the process (`echo exit=$?`).

| # | README step | Command | Exit | Evidence | Result |
|---|---|---|---|---|---|
| 1 | §1 status | `npm run pg:status` | 0 | 03_10: old PID 48897, HA-1..HA-4 PASS | PASS |
| 2 | §1 stop | `npm run pg:stop` | 0 | 03_11: "stopped PID 48897; 127.0.0.1:4432 is free" | PASS |
| 3 | Remove | `npm run pg:remove-data` | 0 | 03_12: ".data/ deleted (cluster, credential files, logs)". Afterwards `ls .data` gives "No such file"; 4432 is free | PASS |
| 4 | §1 status (no cluster) | `npm run pg:status` | 4 | 03_13: "no cluster ... Run npm run pg:init". README: "4: no cluster" | PASS (exit code as documented) |
| 5 | §1 init | `npm run pg:init` | 0 | 03_14: SU-1 binaries reprinted; CR-7; RP-1 to RP-6; trial T2 to T5-end all PASS (T5-h RECORDED as designed); "postgresql.conf: log_error_verbosity = terse and the hourly log ring ... appended"; server left RUNNING, PID 32434 | PASS |
| 6 | §1 status | `npm run pg:status` | 0 | 03_15: RUNNING PID 32434, HA-1..HA-4 PASS, modes 700/600 | PASS |
| 7 | §1 start | `npm run pg:start` | 0 | 03_16: "already running, PID 32434 ...; nothing done" (README: "does nothing when it already runs") | PASS |
| 8 | §2 create | `npm run db:create -- --database dems_demo` | 0 | 03_20: "created dems_demo (owner dems_owner, encoding UTF8, locale C) ... as dems_owner" | PASS |
| 9 | §2 migrate | `/usr/bin/lockf -k .locks/db-migrate.lock npm run db:migrate -- --database dems_demo` | 0 | 03_21: "applied 4 migration(s): 0000_prelude, 0001_tables, 0002_audit_guards, 0003_privileges"; schema version 1 (dbc-2) | PASS |
| 10 | §2 seed | `/usr/bin/lockf -k .locks/db-migrate.lock npm run db:seed -- --database dems_demo` | 0 | 03_22: "the database now holds 301 row(s) in 21 of 30 table(s)"; dataset as of 2026-10-06T22:30:44.943Z (05:30 WIB) | PASS |
| 11 | §2 status | `npm run db:status -- --database dems_demo` | 0 | 03_23: ledger matches (4 full file hashes equal to the stored ones), audit triggers `=A`, 30 counts (section 4) | PASS |
| 12 | §3 start | `npm run start:server`, run as `/usr/bin/lockf -k -t 900 .locks/core-server.lock npm run start:server` (the plan's P18 holder lock; the inner command is the README's) | running | 03_30: B-1 to B-9 passed, "Server listening at http://127.0.0.1:4420", database `dems_demo`, demoControls false | PASS |
| 13 | §3 health | `curl -s http://127.0.0.1:4420/api/v1/health` | 0 | 03_31: `"status":"ok"`, `"ready":{"database":true,"engine":true}`, matching the README's comment | PASS |
| 14 | change state (row W90) | `node --import tsx assets/03_state_change.mjs`: Supervisor sign-in from origin `http://127.0.0.1:5173`, read the session, sign out, then a read refused | 0 | 03_33: sign-in 200 (cookie `dems_session_4420`, 47 chars, value not printed); session 200 SUPERVISOR; sign-out 204; session afterwards 401. Rows: audit 84 `AUTH_SUCCESS` OPR-002, 85 `AUTH_SIGNED_OUT` OPR-002 (03_34) | PASS |
| 15 | §3 stop | `lsof -nP -iTCP:4420 -sTCP:LISTEN` then `kill -TERM 33116` | 0 | 03_37: 4420 free after 1 s. Server log: "shutdown requested ... pipeline closed (drained, 0 failed) ... shutdown complete" | PASS |
| 16 | §3 restart | as step 12, then health | 0 | 03_40, 03_42: B-1 to B-9 pass; "engine started" epoch 2, `auditRows:0`; health ok | PASS |
| 17 | second cycle | `kill -TERM 34613`, start again (run 3) | 0 | 03_43, 03_45: epoch 3, `auditRows:0` | PASS |
| 18 | §1 status (final) | `npm run pg:status` | 0 | 03_51: section 9 | PASS |
| 19 | §3 stop (end) | `kill -TERM 35020` | 0 | 03_60: 4420 free; no launcher left; PostgreSQL PID 32434 RUNNING | PASS |

**README deviations: none.** Every README command exited 0 as written. Step 4's exit 4 is the code the
README documents for "no cluster". The rebuild order (`pg:remove-data`, then `pg:init`, then create,
migrate and seed again) is the one in the README's Remove bullet: "After `pg:remove-data` ... `npm run
pg:init` then makes a new, empty cluster (create, migrate and seed again, and pair the devices again)".

## 3. CPS1-9 on the new cluster (D195 C2)

The values were read through the repository's own access path: `scripts/pg/lib.mjs`
`readConnectionFile` plus `scripts/pg/db.mjs` `connect`, which allows only 127.0.0.1:4432 and scrubs
every PG* variable. The role was `dems_owner`, through the asset `assets/03_db_probe.mjs`. The README
documents no psql path. No credential was printed or passed as an argument. Evidence: `assets/03_17_cps1_9_new_cluster.txt`, `03_52`, `03_54`.

| Setting | Old cluster (03_01) | New cluster | Source | Result |
|---|---|---|---|---|
| `SHOW log_error_verbosity` | `default` | **`terse`** | configuration file | PASS |
| `SHOW logging_collector` | `off` | **`on`** | configuration file | PASS |
| `log_file_mode` | `0600` (default) | `0600` | configuration file | PASS |
| `log_rotation_age` / `_size` / `log_truncate_on_rotation` | `1d` / `10MB` / `off` | `1h` / `0` / `on` | configuration file | PASS |
| `log_directory`, `log_filename` | not visible to `dems_owner` (42501, needs `pg_read_all_settings`) | Read from `postgresql.conf:901-902`: `log_directory = 'log'`, `log_filename = 'postgresql-%H.log'` | file | PASS |
| Log directory | absent | `.data/postgres/log` mode **700** | `stat` | PASS |
| Log file | absent | `.data/postgres/log/postgresql-05.log` mode **600** (05 = the hour of the run) | `stat` | PASS |
| `log_statement` / `log_min_duration_statement` | `none` / `-1` | `none` / `-1` (defaults, NL-5) | default | PASS |
| Terse in effect | n/a | Collector file: 13 `ERROR:` lines, **0 `DETAIL:`, 0 `HINT:`** (counts only) | 03_52 | PASS |
| `.data/postgres.log` (pg_ctl `-l`) | n/a | 1 line, 94 bytes, mode 600: only what is written before the collector starts | 03_52 | as designed (C2-R2 premise) |

## 4. Seed counts against W20

W20 (`implementation/20_db_mapping_seed.md` §6 and §9.1) recorded 30 tables, 21 with rows, 301 rows
(82 audit, 59 events). The new `db:status` (03_23) prints:

| Table | W20 | Now | | Table | W20 | Now |
|---|--:|--:|---|---|--:|--:|
| operators | 3 | 3 | | session_history | 13 | 13 |
| operator_credentials | 3 | 3 | | evidence_items | 13 | 13 |
| roles | 3 | 3 | | evidence_tracks | 52 | 52 |
| permissions | 12 | 12 | | evidence_custody | 28 | 28 |
| role_permissions | 18 | 18 | | exports | 1 | 1 |
| core_device | 1 | 1 | | **audit_log** | **82** | **82** |
| core_state | 1 | 1 | | audit_chain_head | 1 (seq 82) | 1 (seq 82) |
| storage_policy | 1 | 1 | | **events** | **59** | **59** |
| console_settings | 1 | 1 | | schema_meta | 1 | 1 |
| hardware_snapshot | 1 | 1 | | active_session, alerts, health_snapshots | 0 | 0 |
| engine_counters | 5 | 5 | | auth_sessions, pairing_codes, paired_devices, device_credentials, biometric_tokens | 0 | 0 |
| registry_counters | 2 | 2 | | audit_chain_history | 0 | 0 |

**30 of 30 equal; total 301.** The migration file hashes also match W20's abbreviated values
(`ca4c6e03...603a0b`, `46b6bcbe...9224e9`, `35429449...a9cf41`, `7a054fd4...0871d4`). The audit head
hash differs from W20's (`90273cdc...` against `22eb48f7...`). That is expected: the seed is built "as
of the current clock" (README §2).

## 5. Checksums before and after the restart

`03_db_probe.mjs checksums` computes, for each of the 30 public tables, `count(*)` and
`md5(string_agg(row::text ORDER BY row::text))`.

| Snapshot | When | File | Rows |
|---|---|---|--:|
| C0 | after the first boot, before any request | 03_32 | 303 |
| A1 | after the state change, server running | 03_35 | 308 |
| A2 | 20 s later, server running and idle | 03_36 | 310 |
| **B** | **server stopped** (`kill -TERM`) | 03_38 | 310 |
| **C** | **right after the restart is ready** | 03_41 | 310 |
| B2 / C2 | second cycle, with per-column hashes | 03_44 / 03_46, diff 03_47 | 310 / 310 |

**Result B against C: 28 of 30 tables equal.** These are equal: `audit_log` (85, `5b4524f6...`),
`events` (63, `d9862dd6...`), `audit_chain_head`, `auth_sessions` (1, `b1269d38...`), `operators`,
`operator_credentials`, every evidence and session table, `engine_counters` (`88f94b1d...`),
`health_snapshots`, `registry_counters` and `schema_meta`. The prefix checksums `audit_log seq <= 85`
and `events seq <= 63` are equal in B and C (03_39, 03_41). The restart boot wrote 0 audit rows
(`"auditRows":0` in 03_40 and 03_45).

**2 tables differ, identically in both cycles.** The per-column diff (03_47) shows which columns:

| Table | Changed columns | Why |
|---|---|---|
| `core_state` | `epoch` (1→2, 2→3), `updated_at` | Specified: "epoch (it continues: plus 1 at every start and at every reset, [DEC:D14])" (`masterplan/01_specs.md:376`, E-23; also RT-7 at :1253 and :1414). All other columns are equal: seed, `seeded_at`, `created_at`, scenario, last sealed session |
| `hardware_snapshot` | `storage`, `time_status`, `network`, `health`, `written_at` | Simulated live telemetry, rewritten by the engine. All other columns are equal: cameras, mics, security, services, ports, faults, `tablet_link` and the rest |

There is also a periodic write while the server runs. A1 and A2 differ by `events` +1
(`HEALTH_CHECK_OK`), `health_snapshots` 0→1, `engine_counters` and `hardware_snapshot`, with no
request in between. So a checksum taken while the server runs is not stable; B and C above are taken
at rest and right after ready. See F-1.

## 6. lsof (03_50, with both listeners up)

```
postgres 32434 gsp-budi    6u  IPv4 ...  TCP 127.0.0.1:4432 (LISTEN)
node     35020 gsp-budi   17u  IPv4 ...  TCP 127.0.0.1:4420 (LISTEN)
```
`lsof -a -p 35020,32434 -i` shows these two listeners and loopback ESTABLISHED sockets only. No other
44xx listener exists. 4421-4423, 5173 and 8081 are free. **PASS: 4432 and 4420 are on 127.0.0.1 only.**

## 7. SU-1 hashes (03_02, 05:30:01; `pg:init` reprinted the three binaries at 05:30:17)

| File (`node_modules/@embedded-postgres/darwin-arm64/`) | Bytes | Recorded (W03 §7.2; W07 §3) | Recomputed `shasum -a 256` | Equal |
|---|--:|---|---|---|
| `scripts/hydrate-symlinks.js` | 1,397 | `3596fdda55321a3672bd77bcaecf00d46462914409346ccfa1932a19c5977e11` | same | yes |
| `native/pg-symlinks.json` | 1,363 | `badbb4ed4901bcdc87c47e2f0e57778289e1e481bf7baf33e422e240a6e33e67` | same | yes |
| `native/bin/postgres` | 19,458,112 | `515d8e4c690ecd6ae86074eedd5d6d0ed50df434b3743274085b9692f1e923f9` | same | yes |
| `native/bin/initdb` | 440,656 | `b81069a19bcec5d2dd263f5c9bce2ce0b5075ae0f9b8a5c81b79f34bef503c39` | same | yes |
| `native/bin/pg_ctl` | 245,792 | `2c37317f9f606d9716e493d6765ff14f84d8df9b8c07eaa722431de16446f071` | same | yes |

`shasum -a 256 -c` against the recorded values printed `OK` five times, exit 0. **PASS (AC-B-91, SR-80).**

## 8. Host authentication HA-1 to HA-4 (03_51, final, server running)

| Check | Result | Detail |
|---|---|---|
| HA-1 | PASS | 6 effective `pg_hba.conf` lines |
| HA-2 | PASS | loopback addresses only (127.0.0.1/32, ::1/128, local) |
| HA-3 | PASS | `scram-sha-256` on every line, no `trust` |
| HA-4 | PASS | `dems_app` with a wrong password gets SQLSTATE 28P01 |

`pg:status` exit 0, "OK, running". The same result appears at 03_15 (after init) and in `pg:init`'s
RP-4 (03_14).

## 9. File modes (03_52, `stat -f '%Sp %OLp %Su %N'`; contents never read or printed)

| Path | Mode | Expected |
|---|---|---|
| `.data` | 700 | 700 |
| `.data/postgres` | 700 | 700 |
| `.data/postgres/log` | 700 | 700 |
| `.data/pg.pwfile` | 600 | 600 |
| `.data/pg.owner.env` | 600 | 600 |
| `.data/pg.env` | 600 | 600 |
| `.data/postgres.log` | 600 | 600 |
| `.data/pg-scripts.log` | 600 | 600 |
| `.data/postgres/log/postgresql-05.log` | 600 | 600 |

All owned by `gsp-budi`. The connection files hold the five key names each (key names only, from
`pg:status`). **PASS (AC-B-64, SD-15).**

## 10. README Live section against AC-B-92

| Condition | README text (Live mode, "Read this first") | Result |
|---|---|---|
| C1: published demo credentials for synthetic accounts | "**The seeded accounts use published demo credentials for synthetic accounts on a local demo.** ... They are not a secret: the Live sign-in demonstrates the mechanism, it does not protect the data." The Indonesian summary (line 9) says the same | PASS |
| C4: loopback only | "**Live mode is for loopback only.** Every listener binds `127.0.0.1` ... Before anything leaves loopback, the seeded password must be replaced and the demo disclosure removed." | PASS |
| No credential value beyond what is already published | The script in 03_55 compared the shared constant inside the process without printing it. The Live section (lines 220-351) holds the password literal on **0** lines. In the whole file it appears only on lines 8, 40, 41 and 42 (the Indonesian summary and the Quick start demo table, where it is already published). The generated PostgreSQL passwords are never in the README; the README names only the file paths and says "never print" | PASS |

## 11. Databases afterwards (03_53, names only)

`dems_demo` (owner `dems_owner`), `postgres`, `template0`, `template1`.
**`dems_lane_1`, `dems_lane_2` and `dems_lane_3` no longer exist.** Every device pairing of the old
cluster is gone with them (README: "`pg:remove-data` ends every pairing"). The new `dems_demo` has 0
paired devices and 0 device credentials. It has 1 `auth_sessions` row (this row's signed-out
Supervisor session), audit up to seq 85 and epoch 3. A lane database is created by its first
`db:reset --database dems_lane_k` (README §2).

## 12. End state (03_60)

- PostgreSQL is **RUNNING** on the new cluster, PID 32434 (`.locks/postgres.pid`), on `127.0.0.1:4432`; `pg:status` exit 0.
- The backend I started was stopped (SIGTERM, "shutdown complete"). 4420-4423, 4400, 4410, 4411, 5173, 5176-5178 and 8081 are free, and no launcher is left.
- Not started: Vite, Metro, mock-core, emulators. The three emulators were already booted; I only listed their `adb reverse` rules, read-only (F-2).
- `apps/core-server/test/db/pg-behaviours.db.test.ts` not touched; `test:db` not run (row C3).

## 13. Findings

| ID | Severity | Finding | Evidence | Route / suggestion |
|---|---|---|---|---|
| F-1 | **CAUTION (ruling needed)** | Criterion "the per-table checksums before and after the restart are equal" holds for 28 of 30 tables. `core_state` differs (`epoch` +1 and `updated_at`), which the spec requires at every start (E-23, RT-7, D14). `hardware_snapshot` differs in 5 telemetry columns. All durable and append-only data are equal, and the restart writes 0 audit rows. A checksum taken while the server runs is not stable either (the periodic `HEALTH_CHECK_OK` event, `health_snapshots`, `engine_counters`) | §5; 03_38, 03_41, 03_47 | Controller: read W90's criterion as "durable tables equal; `core_state.epoch` +1 per E-23; `hardware_snapshot` telemetry excluded", or record it as drift. W101 cites this |
| F-2 | Low | **Port 4420 was not used by this row alone.** `emulator-5558` still has `adb reverse tcp:4420 tcp:4420` from the manual session (`emulator-5554` → 4421, `emulator-5556` → 4422). Its app reconnected at boot with its old device credential, was refused (`4401 SESSION_INVALID`), then opened an anonymous socket and called `GET /pairing/device` (401) and `GET /auth/status` (200). It wrote no database row (audit 83-85 and events 60-63 are accounted for) | 03_30 (server log lines at 05:31:04-06), adb list in this report §12 | Not touched (no device changes). For W94: that app now has a credential the new database refuses, so it should fall back to the Pair screen. Whether to clear the reverse rules is for the controller and user to decide |
| F-3 | Info | The first server start after a seed writes 1 audit row (`TABLET_LINK_CHANGED`, seq 83) and 1 event (`TABLET_DISCONNECTED`), with `tabletLinkReset:true`. So `db:status` shows 83/60 after the first start, not W20's 82/59. W20's numbers hold for the database as seeded | 03_32, 03_34, 03_30 "engine started" | W94-W98 and W101: compare W20's counts only before the first start |
| F-4 | Info | Terse logging removes DETAIL, HINT, QUERY and CONTEXT, but the collector file still holds a `STATEMENT:` line for every ERROR (13/13), because `log_min_error_statement` stays at its default (NL-5). Count-only check: 0 lines with "password" and 0 with a SCRAM verifier. 8 lines are `pg:init` trial refusals and 5 are this row's own probe (`SHOW` / `select` refused 42501) | 03_52, 03_54 | W92 / W102 (with C2-R3 NL-1/NL-5 errata): say so in one sentence |
| F-5 | Info | `dems_owner` cannot `SHOW log_directory`, `log_filename` or `unix_socket_directories`, or call `pg_current_logfile()` (42501, needs `pg_read_all_settings`). Those were confirmed from `postgresql.conf` and the file system instead | 03_17 | None; by design (owner is not privileged) |
| F-6 | Info (cosmetic) | `db:migrate` and `db:seed` print "dems_demo is migrated/seeded under the migrate lock: this command must be run as "/usr/bin/lockf -k ..."" even when run under that lock. It reads like a warning, but the exit is 0 | 03_21, 03_22 | Optional wording fix (W93) |
| F-7 | Info | C2-R2 (a failed `pg:start` shows only the tail of `.data/postgres.log`) was not exercised, because it needs an induced start failure. Its premise was observed: with the collector on, `.data/postgres.log` holds 1 line (94 bytes) | 03_52 | W102 errata as routed in D195 |

## 14. Process notes (disclosed)

- **Restarts.** I started the server three times (two restarts) instead of once. The second cycle added per-column hashes to pin F-1. This stays within the D232/D233 2 + 1 rule.
- **Password on my console.** One exploratory `grep` for the export name in `packages/shared/src/sim/dataset.ts` printed line 153, which holds the *published* demo password literal, to my own console. It was not written to any file. The asset scan in 03_55 shows 0 occurrences across all 42 assets.
- **Secret scan read the credential files in-process.** The scan (03_55) read the three generated PostgreSQL passwords inside a node process, only to confirm that no asset contains them. Nothing was printed, staged or passed as an argument. No connection was made as `dems_admin`. The only `dems_admin` sessions were `pg:init`'s own RP-3 and T5-j, which closed (RP-6).
- **Probe errors in the log.** The probe's refused `SHOW` statements added 5 ERROR lines to `.data/postgres/log/postgresql-05.log` (F-4).

## 15. Acceptance summary (row W90)

| Criterion | Result |
|---|---|
| Every README command exits 0 as written | PASS (step 4's exit 4 is the documented "no cluster" answer) |
| `db:status` equals W20's seed counts | PASS (30/30, 301 rows) |
| Per-table checksums before and after the restart equal | **CAUTION**: 28/30 equal; 2 differ by specified epoch and telemetry (F-1) |
| `lsof`: 4432 and 4420 on 127.0.0.1 only | PASS |
| SU-1: five SHA-256 values equal W03/W07 | PASS |
| `pg:status` HA-1..HA-4 | PASS |
| `stat` 700 / 600 | PASS |
| README Live section against AC-B-92 | PASS |
| CPS1-9 on the new cluster (D195 C2) | PASS |
| H-02 and H-03 proven (removable and rebuildable) | PASS (`pg:remove-data` deleted `.data/`; `pg:init` rebuilt it; the process is left running) |

---
*Generated: 2026-10-07 05:36 WIB*
