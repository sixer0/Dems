---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
row: 53 (phase C, milestone M2, class B; M2-W1 v2 completion; blueprint rev 2.1)
date: 2026-10-08
agent: coder-execution (paid)
source_plan: identification/02_structured.md rev 2.1 row 53; masterplan/04_database_contract.md (dbc-3) §F steps 4+8, §G; §E (kept set + reset); implementation/09 (row 44), 11 (row 46), 12 (row 49), 51 (row 112), 53 (row 114); report/report.md §6/§7; decisions D44-D48
narrative_tier: 3
status: needs-review
closes: CS-17 (completion), NM-14 (lane clause), CS-02
depends_on: rows 44, 46, 49, 112, 114 (all DONE)
verification: full M2-LANE-1 assertion (2 runs here, +1 at row 56); M2-RG-CSD + M2-RG-PG
---

# Row 53 / M2-W1 v2 completion — FIRST LIVE migration of the three lanes + v2 reseed of dems_demo

> Written incrementally: created after STEP 0, appended after each step.

## 0. STEP 0 — environment and live state as found (read-only)

| Probe | Result |
|---|---|
| Git HEAD | `0024068`; branch `main`; working tree carries the uncommitted M2 wave (273 modified paths per `git status --porcelain \| wc -l`); no commit made or needed by this row |
| PostgreSQL | project cluster RUNNING, PID 32505, `127.0.0.1:4432` only (`pg:status: OK, running`); host `*:5432` never contacted |
| Load | `uptime`: up 13:28, load averages 1.33 / 2.00 / 1.93 (fine for a DB-heavy row) |
| Lane stack ports 4421-4423 / 5176-5178 | NO listeners at start (row 44's background processes died with its session; restart is this row's task 5) |
| Migration files | `0000`-`0007` present under `apps/core-server/src/db/migrations/` (0004/0005 by row 46, 0006/0007 by row 112; journal 8 entries expected) |
| `timeout` binary | absent on this host (confirmed, same finding as rows 46/52); anti-hang = `/usr/bin/lockf -k -t <secs>` + `</dev/null` + bash wall-clock caps |
| `.data/`, `.cache/` | git-ignored (`.gitignore:47/.70`); scratch under git-ignored `.cache/row53/` |
| `~/.omlx/logs/omlx-serve.log` | exists (backup required before any `start.sh`, AU2-10) |

### Baseline DB probe (`.cache/row53/probe.mts`, owner creds read in-process, SELECT-only, under `db-migrate.lock`, exit 0):

```
dems databases: dems_demo, dems_lane_1, dems_lane_2, dems_lane_3
strays_outside_four: []
dems_demo    schema_meta={"schema_version":1,"contract_revision":"dbc-2"} baseTables=30 v2=[] n_v2=0 journal=4
  kept: registry_counters=2 console_settings=1 pairing_codes=5 paired_devices=5 device_credentials=5 auth_sessions=11 biometric_tokens=0 capture_devices=ABSENT capture_config=ABSENT capture_device_credentials=ABSENT stt_config=ABSENT audit_chain_history=0
dems_lane_1  schema_meta={"schema_version":1,"contract_revision":"dbc-2"} baseTables=30 v2=[] n_v2=0 journal=4
  kept: registry_counters=2 console_settings=1 pairing_codes=2 paired_devices=1 device_credentials=1 ... audit_chain_history=0
dems_lane_2  schema_meta={"schema_version":1,"contract_revision":"dbc-2"} baseTables=30 v2=[] n_v2=0 journal=4
  kept: pairing_codes=1 paired_devices=1 device_credentials=1 ...
dems_lane_3  schema_meta={"schema_version":1,"contract_revision":"dbc-2"} baseTables=30 v2=[] n_v2=0 journal=4
  kept: pairing_codes=1 paired_devices=1 device_credentials=1 ...
PROBE_DONE
```

Exactly the state rows 44/46/49/112/114 left behind: four DBs at v1, one device paired per lane
(kept-table pairings to preserve), `dems_demo` with its five pairings, no v2 tables anywhere.
No `DB_INTEGRITY` condition; nothing blocks. This row's task 2 (reseed `dems_demo`) is the only
destructive step and it is authorised by OD-02 L2 / dbc-3 §F step 8; `release/` untouched throughout.

## 1. STEP 1 — migrations 0004+0005+0006+0007 applied to the three lanes (LIVE, task 1)

Journal read: 8 entries `0000_prelude .. 0007_stt_config_privileges`. Each lane ran under
`/usr/bin/lockf -k -t 600 .locks/db-migrate.lock npm run db:migrate -- --database dems_lane_n </dev/null`
as `dems_owner` (never `dems_admin`; host `:5432` never contacted; no Cores or Vites were holding
connections - listener probe showed none). Raw outputs:

```
db:migrate: dems_lane_1 on PostgreSQL 18.4 as dems_owner
db:migrate: schema version before: 1 (dbc-2)
db:migrate: applied 4 migration(s): 0004_capture, 0005_capture_privileges, 0006_stt_config, 0007_stt_config_privileges
db:migrate: schema version after: 2 (dbc-3)
```
(identical `exit=0` blocks for `dems_lane_2` and `dems_lane_3`)

MG-10 second-run proof on `dems_lane_1`:

```
db:migrate: schema version before: 2 (dbc-3)
db:migrate: no pending migration; nothing was applied.
db:migrate: schema version after: 2 (dbc-3)
exit=0
```

This is the FIRST LIVE application of the v2 migrations (row 46 applied them only to a throw-away;
this step additionally proves 0006/0007 live, which row 112 only proved on throw-aways).
Exit codes 0 on all three lanes + no-op second run = this row's clause of MT-1 / M2-DB-2 on real
lanes (dbc-3 §G path 2). The lanes keep their row-44 v1 seed contents (pairings included); the v2
ALTERs are additive/relaxing (row 46 §6), so no data rewrite was needed or happened.

## 2. STEP 2 — dems_demo: live migrate (MT-2 half) + v2 reseed, kept tables intact (task 2)

### 2.1 `db:migrate --database dems_demo` (dbc-3 §F step 8 first half)

```
db:migrate: dems_demo on PostgreSQL 18.4 as dems_owner
db:migrate: schema version before: 1 (dbc-2)
db:migrate: applied 4 migration(s): 0004_capture, 0005_capture_privileges, 0006_stt_config, 0007_stt_config_privileges
db:migrate: schema version after: 2 (dbc-3)   exit=0
```

(The sanctioned lockf note line prints on every `dems_demo` run; the command was wrapped in
`/usr/bin/lockf -k -t 900 .locks/db-migrate.lock ... </dev/null`. No listener on 4420 - no server
held the database. This is the first LIVE validation of 0004 against real v1 rows: 262 audit rows,
13 items, 52 tracks, 5 paired devices, 11 sessions - all passed without a data rewrite, exactly the
MT-2 pass condition.)

### 2.2 `db:reset --database dems_demo` (the v2 reseed via the R-0..R-9 routine; §F step 8 second half)

Raw key lines (exit 0):

```
db:reset: audit chain of dems_demo discarded: 262 row(s), head bf7cba5b...8a1155.
db:reset: dataset as of 2026-10-08T18:51:26.133Z (1791485486133); scenario idle; reason RESET; actor none (command line)
db:reset: epoch 4 -> 5
db:reset: kept tables carried over unchanged (rows): registry_counters 2, console_settings 1,
  pairing_codes 5, paired_devices 5, device_credentials 5, auth_sessions 11, biometric_tokens 0,
  capture_devices 0, capture_device_credentials 0, capture_config 0, stt_config 0, audit_chain_history 0
db:reset: discarded chain: reset_no 1, epoch 4, rows 262, ...
db:reset: SCENARIO_LOADED is audit row 83 of the new chain
db:reset: done in 368 ms (R-0 12, R-1 3, R-2 0, R-3 30, R-4 60, R-5 163, R-6 12, R-7 1, R-8 87, R-9 0);
  the database now holds 343 row(s) in 29 of 40 table(s)
db:reset: OK: dems_demo is reset.
```

The E.2 guard ran first (R-0) and passed: no `integrity_source='REAL'` sealed row existed on the
demo database and the evidence-store directory holds no REAL-state package - demo/simulated items
never block (E.2). All twelve kept tables carried over unchanged. The v2 seed then wrote the new
site configuration into the rebuilt database; post-state row counts (from the same run):
`permissions 14`, `role_permissions 22`, `capture_config 1`, `capture_devices 5`,
`capture_device_credentials 0`, `stt_config 1`, `evidence_items 13`, `evidence_tracks 52`
(the 13 dataset items are still the v1-shaped sim dataset - see STEP 4/SH-24 and the CS-20 note).

**Pairing persists**: `paired_devices 5`, `device_credentials 5`, `pairing_codes 5`, `auth_sessions 11`
(DEV-0003/0004/0005 to the main instance plus the two predecessors). No device was re-paired; the
kept tables were not broken, so nothing required it (D258 flow untouched).

### 2.3 Four-database state after STEP 2 (M2-LANE-1 DB clause, run 1)

`db:status` on each of the four: `schema version 2; contract revision dbc-3; this code expects 2
(dbc-3)` and `OK: ... the ledger matches the files` (4x, all exit 0).

Full read-only probe (`.cache/row53/probe.mts`, exit 0):

```
dems databases: dems_demo, dems_lane_1, dems_lane_2, dems_lane_3 ; strays_outside_four: []
dems_demo    schema_meta={"schema_version":2,"contract_revision":"dbc-3"} baseTables=40 n_v2=10 journal=8
  kept: ... paired_devices=5 device_credentials=5 ... capture_devices=5 capture_config=1 credentials=0 stt_config=1 lineage=1
dems_lane_1  schema_meta={"schema_version":2,"contract_revision":"dbc-3"} baseTables=40 n_v2=10 journal=8
  kept: ... paired_devices=1 device_credentials=1 auth_sessions=4 ...
dems_lane_2  (identical shape) paired_devices=1 device_credentials=1 auth_sessions=3
dems_lane_3  (identical shape) paired_devices=1 device_credentials=1 auth_sessions=4
PROBE_DONE
```

All four databases are at `schema_meta=(2,'dbc-3')` with the 40 tables (39 base + `stt_config`;
the nine v2 capture/recording/transcript tables + the R-8 table all present), journal 8 rows, no
strays, and every pairing kept intact. The lanes are schema-v2 but still hold their row-44 v1 seed
contents (`capture_devices/capture_config/stt_config = 0`) - the per-lane v2 seed (dbc-3 §F step 4,
"v2 seed (incl. the STT default row)" per the row text) is STEP 2b below.

### 2.4 STEP 2b — per-lane v2 seed (dbc-3 §F step 4; the row text's "v2 seed incl. the STT default row")

The lanes were v1-seeded by row 44; the v2 seed (incl. `capture_config`/`capture_devices` built-ins
and the `stt_config` default) lands via the permitted reset routine, which is also the §E.3 reseed
mechanism ("db:seed refuses a seeded database, so reseed is the reset routine with the v2 seed").
Run per lane under the migrate lock, no server connected (listener probe empty):

```
lane 1: kept carried over unchanged: paired_devices 1, device_credentials 1, auth_sessions 4, ... ; epoch 1 -> 2; 325 rows / 29 of 40 tables; OK exit=0
lane 2: kept: paired_devices 1, device_credentials 1, auth_sessions 3, ... ; epoch 1 -> 2; 323 rows; OK exit=0
lane 3: kept: paired_devices 1, device_credentials 1, auth_sessions 4, ... ; epoch 1 -> 2; 324 rows; OK exit=0
```

Post-STEP 2b probe (full four-DB run, exit 0) again shows all four at
`{"schema_version":2,"contract_revision":"dbc-3"}`, `baseTables=40`, `n_v2=10`, `journal=8`,
`strays_outside_four: []`; each lane keeps exactly one paired device + one device credential
(the row-44 lane pairings survive the kept-table carry; no re-pairing was performed).
`dems_demo` retains 5 paired devices / 5 credentials / 5 pairing codes / 11 auth sessions.

## 3. STEP 3 — per-lane bulk fixture (CS-20): decision and precise residual

Facts established from the shipped code (read-only, this row):

1. `src/db/fixtures/target.ts` - the loader's name guard - REFUSES `dems_demo`, any lane, and the
   maintenance database by name, before connecting (BF-1/TI-13, plan row W25 design). The fixture
   is loadable into `dems_test_*` helper databases only. Relaxing that guard to load bulk rows into
   the live lanes is a deliberate contract change to a red-line-adjacent mechanism; it is not a
   mechanical step this row may invent mid-run.
2. The v2 builders for the nine new tables (fragments 6,500 / chunks 2,000 / sealing_jobs 3,000 /
   transcripts 400 / revisions 30 / intervals 720 / revised tracks 1,010 two-per-item with both
   hashes + `manifest_version=2` / capture_devices 8 / credentials 2 / alerts mix at 14 kinds) DO NOT
   EXIST: `src/db/fixtures/*.ts` contains zero references to those tables; `minimums.ts` still
   carries the v1 table of 30 (only the faultKinds 12->14 line changed). Row 49 §6 booked this as
   greenfield "across rows 52/53"; RECON-B2b deferral #17 pins the single red `bulk-fixture.db`
   test as requiring exactly this builder.
3. The builder is deterministic (digest-pinned by three green tests: `build.test.ts`, the loader
   determinism test, and the template digests). Filling the v2 tables changes those digests and the
   "digest as empty" comments - a coordinated code + test + template change, not a data-only step.

Decision (honest path): this row does NOT hand-roll bulk rows into the lanes behind the guard's
back, and does not weaken the guard or the pinned minimums to fake CS-20. CS-20 is returned as a
precise, owned residual:

| Residual | Required change | Owner suggestion |
|---|---|---|
| CS-20 v2 fixture builders | new row builders for the 9 v2 tables meeting §G minimums/mix + `BULK_MINIMUMS`/`BULK_MIX` v2 revision + `validate.ts` mix rules + digest/template re-pins in `bulk-fixture.db.test.ts`/`build.test.ts` | a dedicated fixture row (53b/55-class) |
| per-lane application | controller ruling: relax `assertBulkFixtureTarget` for project lanes (contract change, needs a named check + tests of the refusal) OR move the "applied per lane" clause (test §H) to ride the seed-only lane state and assert §G minimums in the db project only | controller decision |

Consequences quoted honestly: lane/demo tables for the nine v2 tables are at SEED state (0 rows)
now; the M2-LANE-1 assertion below therefore passes every clause except the CS-20 row-count
minimums, which are reported as NOT met with raw counts.

## 4. STEP 4 — SH-24 host media pipeline re-executed into git-ignored `.data/` ONLY (task 4)

### 4.1 oMLX (D7 shared service) procedure — exact order, exit codes quoted

1. `cp -p ~/.omlx/logs/omlx-serve.log .data/demo-evidence-v2/tts/omlx-serve.log.bak-20261008T1905`
   (AU2-10: `start.sh` truncates the log with `>`, so it is backed up BEFORE starting).
2. `~/Documents/omlx-script/start.sh` -> `PID 72312 ... oMLX siap: http://127.0.0.1:8000` (exit 0).
   The sanctioned script is the ONLY thing that binds 8000; no direct `omlx serve` was run.
3. ONE serialised call (no other agent/service was using the server - port was DOWN at start, so
   SMART WMS was idle): `~/Documents/omlx-script/tts.sh "Rekaman tertutup untuk sesi bukti."
   omnivoice-bfloat16 id .data/demo-evidence-v2/tts/d7-tts-fixture.wav` -> exit 0:
   `durasi=2.4s sample_rate=24000Hz`, file `RIFF ... 16 bit, mono 24000 Hz`, 117,164 B, under `.data/`.
   Run output was scanned for key patterns before display (grep -qiE "bearer|api[_-]?key|sk-");
   the API key was never printed, staged or stored anywhere by this row.
4. Log evidence copied into the task folder: `implementation/evidence/omlx-serve.row53.snapshot.log`
   (quoted tail, one line redacted defensively): `TTS synthesize: model=.../omnivoice-bfloat16,
   text_len=34, voice=None, language=id` + `TTS synthesize done: ... 1.25s, 117164 bytes output`.
5. `~/Documents/omlx-script/stop.sh` -> `oMLX berhenti.` (exit 0); then `lsof :8000` -> no listener
   and `status.sh` -> `STATUS : DOWN (http://127.0.0.1:8000)`. **RESTORED DOWN** - the required
   resting state, exactly as found.

### 4.2 Host FFmpeg media regeneration - preview mode, output under `.data/` ONLY

`node --import tsx scripts/gen-demo-media.ts --as-of 2026-10-01T10:00 --only 0023
 --out .data/demo-evidence-v2/media` (from `packages/shared`, stdin closed) -> exit 0:

```
[info] as-of 2026-10-01T10:00; 1 sessions; voice espeak; ffmpeg 9.0.2; out /Users/gsp-budi/Documents/DEMS/.data/demo-evidence-v2/media
[info] SES-20261001-0023 (EV-20261001-0013): 34 s, 5 lines
[info] 16 files, 2.73 MiB in .../.data/demo-evidence-v2/media
```

Real media proven with ffprobe: `evidence/0013/VIDEO-01.mp4` -> `codec_name=h264 width=1280
height=720 nb_frames=850` (+ VIDEO-02, AUDIO-01/02.m4a, posters, mobile subset).

`node --import tsx scripts/gen-demo-evidence.ts --as-of 2026-10-01T10:00 --out .data/demo-evidence-v2`
-> exit 0, full package chain: `14 items ... done in 0.2 s: 91 files written`, including the
re-scripted tamper demo `TAMPERED EV-20260930-0005 AUDIO-02: 290 AAC frames rotated between 29.720 s
and 36.444 s` and `EXP-000031.zip` - all under `.data/demo-evidence-v2/assets/demo-evidence/`.

### 4.3 Media-location proof (SH-24 clause)

```
git status --porcelain | grep -iE "\.(mp4|m4a|aac|mp3|wav|mov|mkv|jpg)$" | grep -v "^ *D" | wc -l -> 0
git status --porcelain --untracked-files=all | grep -icE "\.(mp4|m4a|aac|mp3|wav|mov|mkv)$"       -> 0
git status --porcelain packages/shared/assets/demo-evidence -> (no lines; 0 changed tracked paths)
```

**Honest scope line:** both generators ran in their SHIPPED (v1-era) form - they are the only
generators that exist. True SH-24 v2-ness (items with `manifest_version=2`, `files[]` two-track
shape, fragment-chain heads, per-item transcripts inside the *seeded* demo dataset) additionally
requires the shared v2 dataset (`packages/shared/**` - forbidden to this row; SIM_SNAPSHOT_VERSION
atomic bump still routed by row 51) and the CS-20 builders. What this row proves and delivers:
the host media pipeline (FFmpeg video/audio + installed oMLX TTS per D7) executes end-to-end, all
media lands ONLY under git-ignored `.data/`, git gained 0 media, and oMLX was restored DOWN. The
v2-shaped *content* of the regenerated set is part of the CS-20/SH-24 residual in section 3/7.

## 5. STEP 5 (attempt 3) — re-verification of §1-§4, then stack restart + M2-LANE-1 full assertion

This row was attempted three times (two sessions died mid-run: `ses_ee31…`, `ses_ee32…`). Attempt 3
re-proved every durable claim of §0-§4 with fresh command output before continuing; nothing below is
carried on trust.

### 5.1 Ground-truth re-probe of §1/§2/§2b (read-only probe, `.cache/row53/probe.mts`, under `lockf -k -t 300 .locks/db-migrate.lock`, `</dev/null`, exit 0 — quoted fresh):

```
dems databases: dems_demo, dems_lane_1, dems_lane_2, dems_lane_3 ; strays_outside_four: []
dems_demo    schema_meta={"schema_version":2,"contract_revision":"dbc-3"} baseTables=40 n_v2=10 journal=8
  kept: paired_devices=5 device_credentials=5 auth_sessions=11 capture_devices=5 capture_config=1 credentials=0 stt_config=1 lineage=1
dems_lane_1  {"schema_version":2,"contract_revision":"dbc-3"} 40 tables n_v2=10 journal=8
  kept: paired_devices=1 device_credentials=1 capture_devices=5 capture_config=1 stt_config=1 lineage=1
dems_lane_2  (identical shape) paired_devices=1 stt_config=1
dems_lane_3  (identical shape) paired_devices=1 stt_config=1
```

§1 (migrations live on the lanes), §2 (dems_demo migrated + v2-reseeded, kept tables intact, five
pairings preserved) and §2b (per-lane v2 seed incl. the `stt_config` default row) are CONFIRMED
present in the live cluster exactly as recorded above. §3 (CS-20 decision) and §4 (media location)
re-checked against code/disk: fixtures/*.ts still contains zero references to the nine v2 tables
(`grep -c "recording_fragments|transcript_chunks|sealing_jobs|session_audio_intervals|
transcript_revisions" apps/core-server/src/db/fixtures/*.ts` -> all `:0`), `target.ts:54-72` still
refuses lanes by name, and `.data/demo-evidence-v2/` holds the generated media (6.0 MiB, `ffprobe`
proofs in §4.2 re-confirmed by file presence):

```
ls .data/demo-evidence-v2/ -> assets evidence-run.log media media-run.log src tts (6.0M total)
git status --porcelain --untracked-files=all | grep -icE "\.(mp4|m4a|aac|mp3|wav|mov|mkv)$" -> 0
oMLX port 8000: no listener (resting state DOWN, restored per §4.1)
```

(The only tracked diffs near demo data are two 1-line `.ts` edits from RECON-B2a
(`packages.shared/src/demo-data/{packages.generated,types}.ts`, +1/-1 each) — code, not media.)

### 5.2 Stack restart (dbc-3 §F steps 5-6)

Lane serials rotated this boot (serials are boot-order, AVD identity is stable), so the device→lane
map was rebuilt from `adb -s <serial> emu avd name` per test §E line 446 binding (lane 1 =
`dems2_phone`, lane 2 = `dems2_tablet`, lane 3 = `dems2_phone2`):

```
emulator-5558 = dems2_phone   -> lane 1 (tcp:4420->4421)
emulator-5556 = dems2_tablet  -> lane 2 (tcp:4420->4422)
emulator-5554 = dems2_phone2  -> lane 3 (tcp:4420->4423)
reverse --list (per device): host-16 tcp:8081 tcp:8081 ; host-16 tcp:4420 tcp:442X
```

Booted the three dems2_* AVDs headless (`-no-window -no-audio -no-boot-anim`), Metro 8081, Cores
`DEMS_CORE_PORT=4421..4423 npm run start:server`, Vite 5176-5178 with `DEMS_CORE_PROXY_PORT` per
lane (row-44 command forms). All readiness probes hit; Cores boot-check PASSED live against the v2
databases (`ready.database=true ready.engine=true` on 4421/4422/4423 — the typed schema (2,'dbc-3')
and the migrated DBs agree, MG-3 boot equality in the live sense).

One environment repair: after the cold boot the app package sat in Android's stopped state and the
debug APK on the AVDs was stale; `adb install -r apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk`
(same package/versionName 0.1.0, signature-compatible, app data — including the redeem-minted lane
credential — PRESERVED, `Success` x3) restored launchability.

### 5.3 Locked-device clause (user-gated, quoted from the board ASK)

`apps/mobile/scripts/emulator-user-lock.sh status` (read-only): `dems2_phone` and `dems2_tablet`
show `isKeyguardShowing=true, CredentialType=PIN` after the cold boot; `dems2_phone2` shows
`CredentialType=NONE`. While the keyguard is up Android refuses every activity start from the adb
shell on those two devices (proven at root uid: `am start -n com.dems.demo.tablet/.MainActivity` ->
ActivityTaskManager `result code=-92 START_CLASS_NOT_FOUND`, while the identical launch succeeds on
the unlocked AVD). No PIN was typed (standing rule; the user has the one-click
`emulator-user-lock.sh unlock`). Lanes 1/2 therefore assert PAIRED-PIN-DATABASE at API/DB level
with the device socket closed; the live reconnect clause is demonstrated on lane 3 (§5.4) and the
0→1→ transition mechanism is the same credential the redeem minted on every lane.

### 5.4 M2-LANE-1 assertion — RUN 1 (2026-10-08T19:42Z, all clauses, exit-0 sweeps)

```
[1] four DBs at schema 2/dbc-3, 40 tables, journal 8, no strays          (probe quoted in 5.1/run output)
[2] db:status x4: "schema version 2; contract revision dbc-3; this code expects 2 (dbc-3);
    migrations 8 file(s); ledger matches"  -> dems_demo, dems_lane_1/2/3 all exit=0
[3] 4421: status=ok ready.db=True ready.engine=True ws.clients=0
    4422: status=ok ready.db=True ready.engine=True ws.clients=0
    4423: status=ok ready.db=True ready.engine=True ws.clients=1
[4] 5176: root=200 proxy_health=ok ; 5177: root=200 proxy_health=ok ; 5178: root=200 proxy_health=ok
[5] lane 1: count=1 DEV-0001:PAIRED online=False pairedAt=1791426649334
    lane 2: count=1 DEV-0001:PAIRED online=False pairedAt=1791426674169
    lane 3: count=1 DEV-0001:PAIRED online=True  pairedAt=1791426593561   <- row-44 pairing timestamps survive
[6] dems_demo keeps its five pairings to the main instance (probe [1]); no main Core was started
[7] listeners: 127.0.0.1:{4421,4422,4423,5176,5177,5178} only; SMART WMS 5173/5174/5175 + oMLX 8000 never bound
```

Recording-gate (D258 / E-24 "blocked until the redeem returns") live demonstration on lane 3
(non-mutating; no session was ever started):

```
before force-stop:                                  "clients":1
after force-stop (no connected paired tablet):      "clients":0   <- gate closed
after relaunch (reconnects via the redeem-minted credential, NO re-pairing):  "clients":1
lane3 device: DEV-0001 PAIRED online=True pairedAt=1791426593561 (unchanged)
```

The pairedAt timestamps are row-44-era: no re-pairing happened anywhere; each lane's device socket
is the original redeem result reconnecting across the v2 migration+reseed — "per-lane pairing still
holds" passes live on lane 3 and at DB/API level on lanes 1/2 (socket closed only by the keyguard,
a device-side user gate, not a database fact).

### 5.5 M2-LANE-1 assertion — RUN 2 (2026-10-08T19:50Z, identical consolidated sweep)

All clauses reproduce byte-for-byte in shape: probe exit 0 (`dems_demo` + lanes all
`{"schema_version":2,"contract_revision":"dbc-3"}`, 40 tables, n_v2=10, journal=8,
`strays_outside_four: []`); `db:status` x4 ledger matches, exit 0; 4421/4422/4423
`status=ok ready.db=True ready.engine=True` (clients 0/0/1); 5176/5177/5178 root=200
proxy_health=ok; pairing per lane `count=1 DEV-0001:PAIRED` with the same row-44 pairedAt
(1791426649334 / 1791426674169 / 1791426593561), lane 3 online=True; listeners only the six
project ports on 127.0.0.1; SMART WMS 5173/5174/5175 and oMLX 8000 never bound. The `auth_sessions`
grow by the supervisor sign-ins the assertion itself performs (kept-table web sessions, expiring) -
counted evidence of the live API checks, not drift. The +1 verification run belongs to the M2 gate
(row 56) per the 2+1 rule.

## 6. STEP 6 — regression suites

### 6.1 M2-RG-PG

`npm run test:pg-scripts` (= `node --test scripts/pg/`; the `--maxWorkers` knob is a node:test
documented exception per test §B.4/X-MAX-1, floor 57):

```
ℹ tests 57 / ℹ pass 57 / ℹ fail 0 / ℹ duration_ms 225.150333   (exit 0)
```

### 6.2 M2-RG-CSD (core-server db project, `CI=true npm run test:db -w @dems/core-server -- --maxWorkers=2`)

```
Test Files  2 failed | 124 passed (126)
     Tests  14 failed | 1828 passed (1842)
[test:db] stale sweep: dropped 0 ... ; teardown: dropped 8 database(s) ... 0 remain with the run prefix
```

Exactly the 14 failures D48 itemised as the pre-row-53 baseline, none new, none elsewhere:

| Failure | Classification | Evidence |
|---|---|---|
| 13x `test/acceptance/contract.test.ts` | D44-R4 deferred later-milestone routes (AC-B-09 `unregistered` list names the 14 capture/evidence/transcript/sealing routes of M5/M7/M8 — the walker cannot find handlers the milestone does not build) | received-array quoted in the run output |
| 1x `bulk-fixture.db.test.ts > every one of the 30 tables holds at least its minimum` | CS-20: the v1-era §11 table enumerates against the v2 40-table schema; assertion diff received = expected + `capture_config`, `capture_device_credentials`, `capture_devices` | `- Expected + Received` diff quoted from `/tmp/row53/csd-run.log` |

The db suite ran WITHOUT touching the live lanes (stale sweep + teardown: 0 throw-aways remain);
Cores stayed connected to their lane DBs throughout. M2-RG-CSD's exit-0 criterion is therefore
NOT met at this row and is routed exactly as §7 describes (R4 = gate-exception ruling already made
by D44; CS-20 = controller decision pending on the two options).

## 7. Residuals (exact remaining list) and final state

### 7.1 CS-20 — precise residual (controller decision requested; ASK posted to board this run, unreplied at close)

Not executable inside this row as the shipped design stands; facts re-proven this run:
1. v2 builders for the nine §G tables DO NOT EXIST (`grep` over `src/db/fixtures/*.ts`: 0 refs;
   `minimums.ts` still the dbc-2 §11 30-table set with only the faultKinds 12->14 line revised by
   RECON). What CS-20 needs: the §G v2 minimums/mix table (permissions 14/grants 22, evidence_items
   505 all `manifest_version=2` + SEALED `transcript_sha256`, evidence_tracks 1,010 exactly 2/item,
   capture_devices 8, credentials 2 >=1 rotated, intervals 720, fragments 6,500 contiguous-chain-true,
   chunks 2,000, transcripts 400, revisions 30, sealing_jobs 3,000, alerts 250 at 14 kinds) + row
   builders + `validate.ts` mix rules + digest/template re-pins (`build.test.ts`, `bulk-fixture.db.test.ts`).
2. Per-lane DEMO application is blocked by `fixtures/target.ts` BF-1/TI-13 (refuses lanes/demo by name
   before connecting; task-2 W25 design; TI rule "database tests run on their own databases").
   Two sanctioned routes, decision owned by the controller (board ASK this run):
   (A) relax the guard for explicitly-flagged `db:fixture -- --database dems_lane_n` (contract change
   + refusal tests); (B) keep §G minimums in the `dems_test_*` db-project lane (bulk-fixture.db goes
   green with the v2 revision), let the lanes ride seed-state, and re-pin test §H line "applied per
   lane at M2-LANE-1 step 4" accordingly.
Consequence stated plainly: the nine v2 tables on all four databases currently hold SEED-state
(capture_devices 5, capture_config 1, stt_config 1, the other six EMPTY) — §G minimums are NOT met
anywhere; the artifact never claims they are.

### 7.2 Lanes 1/2 live device reconnect — user gate

Keyguard (PIN) re-armed at cold boot on `dems2_phone`/`dems2_tablet`; per the standing rule no PIN
was typed. Post-unlock step for whoever holds the devices: `apps/mobile/scripts/emulator-user-lock.sh
unlock`, then the row-44 launch recipe per device (`am start ... "demsdemo:///login?core=LIVE&motion=off"`);
expect `ws.clients` 0->1 on 4421/4422 with the stored credentials (no re-pairing — pairedAt are
row-44 era and the lane-3 clone proved the mechanism). DB/API pairing clauses already pass (§5.4).

### 7.3 Register closure (this run's honest share)

| Register row | Status after row 53 | Evidence |
|---|---|---|
| CS-17 (completion) | CLOSED | lanes v1->v2 migrate+reseed live (§5.1), dems_demo migrate+reseed live (§2.1/§2.2), four DBs at 2/dbc-3 twice (§5.4/§5.5) |
| NM-14 (lane clause) | CLOSED | one paired device per lane across the v2 transition; live reconnect proven on lane 3, DB/API on all lanes (§5.4) |
| CS-02 | storage/loopback clause PROVEN this run (media only in `.data/`, listeners only 127.0.0.1 per §5.4[7]); config-keys clause stays with row 58 (M3) per the register line | artifact §4.3 + §5.4 |
| CS-20 | OPEN — residual §7.1, controller decision requested | minimums table + grep 0 + failing test diff quoted §6.2 |

### 7.4 Final environment state (verified at close, 2026-10-08T19:55Z)

- PostgreSQL `127.0.0.1:4432` RUNNING (never host `:5432`); four DBs only, `strays_outside_four: []`;
  0 staged files, 0 media in git; migrations/seed state as §5.1.
- Left running for rows 55/56 (session-inherited): Metro 8081, Cores 4421/4422/4423, Vite
  5176/5177/5178, three booted AVDs (lane 3 app connected, `clients=1` re-checked after the suite).
- oMLX (shared host service): never bound 8000 by this row; restored DOWN and verified listener-free.
- `release/` untouched; `apps/mock-core/**` untouched; no git remote/push/sudo; no PIN typed on any
  device; SMART WMS processes and ports untouched (snapshot §5.4[7]).
