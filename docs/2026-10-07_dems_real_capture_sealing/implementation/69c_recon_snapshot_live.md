---
task_id: RECON-F2b (row 55 F2 / D56-D57 — live dev DBs to SH-10 snapshot version 2 + M2-LANE-1 boot restored, task 3 phase C)
task_slug: dems_real_capture_sealing
date: 2026-10-08
agent: coder-execution-local (sole db-runner this turn)
source_plan: implementation/69b_recon_snapshot_code.md §5/§7.1, implementation/50 (§5 lane state), implementation/09 (row 44 pairing/lane procedure), report/report.md §6-§7, decisions D56-D57
status: completed — all four DBs store sim_schema_version=2 (kept tables + pairings intact), lane Cores 4421-4423 boot green against v2 (ready.db/ready.engine true x2 runs), Vite 5176-5178 200 + proxy ok, blocked-until-redeem proven live on lane 3; lanes 1/2 device sockets pending the user's keyguard unlock (known gate, §4)
tier: 3
---

# RECON-F2b — advance the live project-local dev DBs to snapshot v2 and restore M2-LANE-1 boot

> Written incrementally: created after STEP 1, appended after each step.

## 0. STEP 0 — environment and live state as found (read-only)

| Probe | Result |
|---|---|
| PostgreSQL | `pg:status: OK, running` → `PG_STATUS_EXIT:0` (project cluster `127.0.0.1:4432`; host `*:5432` never contacted) |
| Baseline stored versions (`.cache/reconF2b/probe.mjs`, SELECT-only, owner creds read through `scripts/pg/lib.mjs readConnectionFile` inside the process, every printed line through `say()`/redact, under `lockf -k -t 120 .locks/db-migrate.lock`, `</dev/null`) → `PROBE_EXIT:0` | all four DBs store **1** on both columns (quoted below) |
| Stale stack at receipt | listeners `127.0.0.1:{4421,4422,4423,5176,5177,5178}` present — row 53's stack, started 02:28 local (19:28Z) i.e. BEFORE RECON-F1/F2a changed the code; these processes run pre-F2a code against DBs storing 1. `.locks/core-server.lane*.pid` files hold no live pid (the stack is session-inherited background processes, pids 91275/91531/91587 zsh roots). Health at receipt: 4421/4422/4423 all `"status":"ok" ... "ready":{"database":true,"engine":true}` (stale-code green), ws.clients 0/0/1 |
| Metro 8081 | listener pid 91228 alive (row 53's) — NOT touched by this row (device bundle server, not part of the Core/Vite restart) |
| Orphaned readers | `ps` grep `adb logcat` → none |
| Guards on the target tables | `core_state_values_check` allows `sim_schema_version >= 1` (0001_tables.sql:436); `hardware_snapshot` has no version CHECK; no triggers on either table (only audit_log/audit_chain_history append-only triggers exist) → value 2 is admitted by the stored constraints, no migration needed (F2a §2) |
| `timeout` binary | absent on this host (rows 46/52/53 finding stands); anti-hang = `lockf -k -t <secs>` + `</dev/null` + tool wall-clock caps |

### Baseline probe (BEFORE, quoted verbatim, exit 0)

```
dems_demo: role=dems_owner super=false core_state.sim_schema_version=1 hardware_snapshot.sim_schema_version=1
  schema_meta={"singleton":true,"schema_version":2,"contract_revision":"dbc-3"} journal=8
  kept: registry_counters=2 console_settings=1 pairing_codes=5 paired_devices=5 device_credentials=5 auth_sessions=11 biometric_tokens=0 capture_devices=5 capture_device_credentials=0 capture_config=1 stt_config=1 audit_chain_history=1
  pairing: DEV-0001:REVOKED@1791337941415 DEV-0002:REVOKED@1791338146082 DEV-0003:PAIRED@1791338265921 DEV-0004:PAIRED@1791338294189 DEV-0005:PAIRED@1791343020593
dems_lane_1: role=dems_owner super=false core_state.sim_schema_version=1 hardware_snapshot.sim_schema_version=1
  schema_meta={"singleton":true,"schema_version":2,"contract_revision":"dbc-3"} journal=8
  kept: registry_counters=2 console_settings=1 pairing_codes=2 paired_devices=1 device_credentials=1 auth_sessions=7 biometric_tokens=0 capture_devices=5 capture_device_credentials=0 capture_config=1 stt_config=1 audit_chain_history=1
  pairing: DEV-0001:PAIRED@1791426649334
dems_lane_2: role=dems_owner super=false core_state.sim_schema_version=1 hardware_snapshot.sim_schema_version=1
  schema_meta={"singleton":true,"schema_version":2,"contract_revision":"dbc-3"} journal=8
  kept: registry_counters=2 console_settings=1 pairing_codes=1 paired_devices=1 device_credentials=1 auth_sessions=6 biometric_tokens=0 capture_devices=5 capture_device_credentials=0 capture_config=1 stt_config=1 audit_chain_history=1
  pairing: DEV-0001:PAIRED@1791426674169
dems_lane_3: role=dems_owner super=false core_state.sim_schema_version=1 hardware_snapshot.sim_schema_version=1
  schema_meta={"singleton":true,"schema_version":2,"contract_revision":"dbc-3"} journal=8
  kept: registry_counters=2 console_settings=1 pairing_codes=1 paired_devices=1 device_credentials=1 auth_sessions=7 biometric_tokens=0 capture_devices=5 capture_device_credentials=0 capture_config=1 stt_config=1 audit_chain_history=1
  pairing: DEV-0001:PAIRED@1791426593561
PROBE_DONE
```

The lane `paired_at` values are exactly row 53 §5.4's row-44-era pairings (1791426649334 /
1791426674169 / 1791426593561): this is the pairing state to preserve. `auth_sessions` are higher
than row 53's first probe (7/6/7 vs 4/3/4) because that assertion itself signed supervisors in —
kept-table web sessions expiring on their own, not drift.

## 1a. STEP 1a — stale stack stopped FIRST by process tree (write-back hazard)

The stale Cores hold v1-shaped engine state loaded under pre-F2a code; a graceful shutdown could
write `core_state` back with the version they loaded (1) and silently clobber the advance. They were
therefore stopped BEFORE the UPDATE, deepest process first (plain `tsx src/index.ts` — no watch
parent to respawn, verified in the ps tree):

```
kill -TERM 91416 91580 91637   (lane Core node processes)  -> all gone incl. tsx wrappers 91360/91579/91635
kill -TERM 91775 91803 92042   (Vite node processes)       -> wrappers 91757/91785/92019 and zsh roots 91749/91777/92008 exited with them
lsof -nP -iTCP:4421..4423,5176..5178 -sTCP:LISTEN          -> NO_LISTENERS
Metro 8081                                                    -> still listening (pid 91228, untouched)
```

No orphaned `adb logcat` readers existed before or after (STEP 0 ps + re-check). SMART WMS
(`npm exec tsx watch apps/api/src/index.ts`, pid 6970) and every non-DEMS process untouched.

## 1b. STEP 1b — sanctioned one-shot UPDATE: stored `sim_schema_version` 1→2 (task 1 DONE)

Mechanism per D57 / F2a §7.1: the targeted UPDATE (not `db:reset`) — it changes exactly two integer
columns and cannot touch kept tables, pairings, audit chain or evidence. Script
`.cache/reconF2b/advance.mjs`: per database one transaction (`BEGIN` → role check `dems_owner` +
non-superuser → `SELECT … FOR UPDATE` before-values → two guarded `UPDATE … WHERE sim_schema_version = 1`
→ after-select → COMMIT only if both read back 2, else ROLLBACK). Run under
`/usr/bin/lockf -k -t 300 .locks/db-migrate.lock … </dev/null`, credentials read through the repo's
`scripts/pg/lib.mjs` connection-file helper (mode-checked, endpoint-asserted loopback-only), never printed.

```
dems_demo: core_state 1->2 hardware_snapshot 1->2 (updated rows 1/1)
dems_lane_1: core_state 1->2 hardware_snapshot 1->2 (updated rows 1/1)
dems_lane_2: core_state 1->2 hardware_snapshot 1->2 (updated rows 1/1)
dems_lane_3: core_state 1->2 hardware_snapshot 1->2 (updated rows 1/1)
ADVANCE_DONE
ADVANCE_EXIT:0
```

### AFTER-probe (same read-only script, exit 0 — `PROBE_AFTER_EXIT:0`)

```
dems_demo: role=dems_owner super=false core_state.sim_schema_version=2 hardware_snapshot.sim_schema_version=2
  schema_meta={"singleton":true,"schema_version":2,"contract_revision":"dbc-3"} journal=8
  kept: registry_counters=2 console_settings=1 pairing_codes=5 paired_devices=5 device_credentials=5 auth_sessions=11 biometric_tokens=0 capture_devices=5 capture_device_credentials=0 capture_config=1 stt_config=1 audit_chain_history=1
  pairing: DEV-0001:REVOKED@1791337941415 DEV-0002:REVOKED@1791338146082 DEV-0003:PAIRED@1791338265921 DEV-0004:PAIRED@1791338294189 DEV-0005:PAIRED@1791343020593
dems_lane_1: role=dems_owner super=false core_state.sim_schema_version=2 hardware_snapshot.sim_schema_version=2
  kept: registry_counters=2 console_settings=1 pairing_codes=2 paired_devices=1 device_credentials=1 auth_sessions=7 biometric_tokens=0 capture_devices=5 capture_device_credentials=0 capture_config=1 stt_config=1 audit_chain_history=1
  pairing: DEV-0001:PAIRED@1791426649334
dems_lane_2: role=dems_owner super=false core_state.sim_schema_version=2 hardware_snapshot.sim_schema_version=2
  kept: registry_counters=2 console_settings=1 pairing_codes=1 paired_devices=1 device_credentials=1 auth_sessions=6 biometric_tokens=0 capture_devices=5 capture_device_credentials=0 capture_config=1 stt_config=1 audit_chain_history=1
  pairing: DEV-0001:PAIRED@1791426674169
dems_lane_3: role=dems_owner super=false core_state.sim_schema_version=2 hardware_snapshot.sim_schema_version=2
  kept: registry_counters=2 console_settings=1 pairing_codes=1 paired_devices=1 device_credentials=1 auth_sessions=7 biometric_tokens=0 capture_devices=5 capture_device_credentials=0 capture_config=1 stt_config=1 audit_chain_history=1
  pairing: DEV-0001:PAIRED@1791426593561
PROBE_DONE
```

**Task 1 clauses proven:** before→after per DB `1→2` on both `core_state` and `hardware_snapshot`
(4/4); every kept-table count identical before/after (demo `paired_devices=5` with the same five
rows and states; each lane `paired_devices=1 device_credentials=1` with the unchanged row-44-era
`paired_at`; `stt_config=1` present on all four; `capture_config=1`/`capture_devices=5` seed state
intact); `schema_meta` and the migration ledger untouched (still `(2,'dbc-3')`, journal 8 — the
sim-shape axis moved, the schema-contract axis did not).

## 2. STEP 2 — lane Cores and Vites restarted against the v2 databases

Row-44/53 command forms, started as tracked background processes (parent-session lifetime so the
stack survives this sub-agent for row 56); readiness confirmed by port + health before proceeding:

| Process | Command | bg id / pid | Ready |
|---|---|---|---|
| Core lane 1 | `DEMS_CORE_PORT=4421 npm run start:server` | bgp_11daf218… / 29894 | `Server listening at http://127.0.0.1:4421` |
| Core lane 2 | `DEMS_CORE_PORT=4422 npm run start:server` | bgp_11daf2d2… / 29968 | listening 4422 |
| Core lane 3 | `DEMS_CORE_PORT=4423 npm run start:server` | bgp_11daf2fb… / 30018 | listening 4423 |
| Vite lane 1 | `DEMS_CORE_PROXY_PORT=4421 VITE_DEMS_CORE_MODE=live npm run dev -w @dems/core-web -- --port 5176 --strictPort --host 127.0.0.1` | bgp_11dafab5… / 30477 | `Local: http://127.0.0.1:5176/` |
| Vite lane 2 | same, 5177 / proxy 4422 | bgp_11dafb6e… / 30530 | Local 5177 |
| Vite lane 3 | same, 5178 / proxy 4423 | bgp_11dafb9d… / 30557 | Local 5178 |

Metro 8081 (pid 91228, row 53's) was NOT restarted or touched — it serves the device bundle and is
outside this row's restart set. No orphaned `adb logcat` readers existed or were created.

Device plumbing repair found by probe (pre-existing drift, not caused by this row): `adb -s
emulator-5558 reverse --list` was EMPTY (row 53 had left `tcp:8081` + `tcp:4420->4421`), so lane 1's
device could not reach its Core at all. Restored with the row-44 commands (no device security
touched): `REVERSE_RESTORED_5558: host-18 tcp:8081 tcp:8081 host-18 tcp:4420 tcp:4421`.

## 3. STEP 3 — M2-LANE-1 BOOT clause assertion (2 runs)

### Run 1 (first sweep after restart)

```
4421 status=ok ready.db=True ready.engine=True ws.clients=0
4422 status=ok ready.db=True ready.engine=True ws.clients=0
4423 status=ok ready.db=True ready.engine=True ws.clients=1     <- lane-3 device reconnected by itself
5176 root=200 proxy_health=ok ; 5177 root=200 proxy_health=ok ; 5178 root=200 proxy_health=ok
lane 1 signin=200 count=1 | DEV-0001:PAIRED online=False pairedAt=1791426649334
lane 2 signin=200 count=1 | DEV-0001:PAIRED online=False pairedAt=1791426674169
lane 3 signin=200 count=1 | DEV-0001:PAIRED online=True  pairedAt=1791426593561
```

(Sign-in via each lane's Vite proxy with the README-published demo credentials for synthetic local
accounts — password never logged here; `GET /api/v1/pairing/devices` as supervisor.)

**The v2 boot check passes:** all three Cores report `ready.database=true ready.engine=true` while
the stored `sim_schema_version` is 2 and the code constant is 2 (`SIM_SNAPSHOT_VERSION`, the boot
checks of `db/mapping/rows.ts` compare against it since RECON-F2a) — `engine.rehydrate` accepted the
stored `core_state` + `hardware_snapshot` rows. No boot error occurred on any lane.

### Blocked-until-redeem clause (D258 / E-24), proven live on lane 3 (non-mutating; no session was ever started)

```
before force-stop (paired device socket up):        ws.clients=1
after force-stop com.dems.demo.tablet:              ws.clients=0    <- gate closed
after relaunch demsdemo:///login?core=LIVE&motion=off: ws.clients=1 <- reconnect via the credential the redeem minted, NO re-pairing
lane3 after cycle: count=1 | DEV-0001:PAIRED online=True pairedAt=1791426593561   (unchanged row-44-era pairing)
```

Mechanism chain: a session start is refused while the tablet link is offline — the shared sim marks
the pre-check item `BLOCK … 'Core link offline'` (`packages/shared/src/sim/session-machine.ts:452`,
reasonCode CORE_OFFLINE), answered 409 `PRECHECK_BLOCKED` by `src/modules/sessions/refusals.ts`;
`engine/rehydrate.ts` §12.4 recomputes the link from open sockets at boot, so after this restart the
gate was closed until a paired-device socket connected. The only way a device holds a lane socket is
the redeem-minted credential (row 44 §2.5 / row 53 §5.4): the 0→1 transition above IS that
credential returning, with `paired_devices` untouched (count 1, same `paired_at`). Lanes 1/2 sit at
exactly this closed-gate state pending their devices' unlock (see §5).

### Run 2 (consolidated re-check, identical shape)

```
4421 status=ok ready.db=True ready.engine=True ws.clients=0
4422 status=ok ready.db=True ready.engine=True ws.clients=0
4423 status=ok ready.db=True ready.engine=True ws.clients=1
5176 root=200 proxy_health=ok ; 5177 root=200 proxy_health=ok ; 5178 root=200 proxy_health=ok
lane 1 signin=200 count=1 | DEV-0001:PAIRED online=False pairedAt=1791426649334
lane 2 signin=200 count=1 | DEV-0001:PAIRED online=False pairedAt=1791426674169
lane 3 signin=200 count=1 | DEV-0001:PAIRED online=True  pairedAt=1791426593561
```

(`auth_sessions` grows by the supervisors' sign-ins these assertions perform — kept-table web
sessions expiring on their own, same note as row 53 §5.5.)

## 4. Device-connect state (honest report — user gate, NOT a F2b failure)

Read-only `apps/mobile/scripts/emulator-user-lock.sh status` at this turn:

```
phone (emulator-5554): AVD dems2_phone2,  isKeyguardShowing=false, CredentialType=NONE      <- lane 3, lock-free
phone2 (emulator-5558): AVD dems2_phone,  isKeyguardShowing=true,  CredentialType=PIN       <- lane 1, LOCKED
tablet (emulator-5556): AVD dems2_tablet, isKeyguardShowing=true,  CredentialType=PIN       <- lane 2, LOCKED
```

No PIN was typed and no lock setting was read-modified anywhere (standing rule). While the keyguard
is up Android refuses the app activity start (row 53 §5.3 proof), so lanes 1/2 keep `ws.clients=0`
and `online=False` at the API level while their DB/API pairing clauses pass fully. The user's
one-click unlock is:

```
apps/mobile/scripts/emulator-user-lock.sh unlock        # all three; or add phone|phone2|tablet
```

After unlock, launch per the row-44 recipe (`am start -W -a android.intent.action.VIEW -d
'demsdemo:///login?core=LIVE&motion=off' com.dems.demo.tablet`) and expect `ws.clients` 0→1 on
4421/4422 with the stored credentials — the lane-3 cycle in §3 just re-proved that mechanism against
the v2 databases (no re-pairing; `paired_at` values are row-44-era).

## 5. Final state and red-line compliance (verified at close)

- Stored versions: all four DBs `core_state.sim_schema_version=2` + `hardware_snapshot.sim_schema_version=2` (before→after quoted §1b); kept tables + pairings byte-for-byte preserved (§1b AFTER-probe vs §0 BEFORE-probe); `schema_meta` still `(2,'dbc-3')`, journal 8 — untouched axes.
- PostgreSQL `127.0.0.1:4432`: `pg:status: OK, running` at close (`PG_STATUS_EXIT:0`). Host `*:5432` never contacted: every connection went through `scripts/pg` helpers whose `assertEndpoint` hard-refuses port 5432 and non-loopback hosts.
- Databases: `dems_demo, dems_lane_1, dems_lane_2, dems_lane_3, postgres` — no throwaway was created by this row, none to drop (cookie jars + probe scripts live in git-ignored `.cache/reconF2b/`).
- Role: `dems_owner` (session-verified non-superuser per database); `dems_admin` never used. Credentials read via `readConnectionFile` (mode-600 asserted), every printed line through `say()`/redact — nothing secret appears in this document or any log.
- Listeners: only `127.0.0.1:{4421,4422,4423,5176,5177,5178}` (+ inherited Metro 8081). SMART WMS 5173/5174/5175 and oMLX 8000 never bound; SMART WMS processes untouched (its pid 6970 not signalled).
- Left running for row 56: Cores 4421-4423, Vite 5176-5178 (parent-session lifetime via inherit), Metro 8081, three booted AVDs (lane 3 connected).
- No source touched: zero edits under `packages/shared/**`, `apps/**`, `scripts/**`; no migration SQL; no `db:reset`/reseed; no git add/commit/push; no sudo; no emoji. The stale stack stopped at §1a was row 53's pre-F2a-code boot — stopping it before the UPDATE prevented a v1 write-back race (documented decision D-F2b-1).

## 6. Issues & decisions log

- D-F2b-1: **stop-before-update ordering.** The received stack ran pre-F2a code with v1-shaped
  engine state loaded; a graceful stop AFTER the UPDATE could have written `core_state` back with
  version 1 and silently undone STEP 1. The stale stack was therefore stopped first (§1a), then the
  DBs advanced (§1b), then fresh processes booted (§2). Same net order the brief lists, sequenced
  deliberately inside-out for write-back safety.
- D-F2b-2: **targeted UPDATE chosen over `db:reset`.** Reset would also carry kept tables, but it
  discards the live audit chain, bumps the epoch and rebuilds the dataset — far more than the SH-10
  transient needs. Two integer columns changed under per-DB transactions with COMMIT-only-on-readback
  is the minimal sanctioned action D57 names first.
- D-F2b-3: **lane-1 reverse rules were missing at receipt** (empty `reverse --list` on emulator-5558
  vs row 53's delivered state). Restored with the documented row-44 commands; reported because it
  affects whoever unlocks lane 1's device next (without them the app cannot reach 4421 even unlocked).
- D-F2b-4: the brief names the locked AVDs "emulator-5556 (tablet) and emulator-5558 (phone2)";
  the live read-only probe shows 5558 runs AVD `dems2_phone` and 5554 runs `dems2_phone2` (AVD↔port
  rotation, row 53 §5.2 noted serials rotate per boot). Substance unchanged: two PIN-keyguarded
  AVDs (lanes 1/2), one lock-free AVD (lane 3, connected).
