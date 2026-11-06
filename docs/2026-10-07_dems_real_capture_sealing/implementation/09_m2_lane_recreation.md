---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
date: 2026-10-08
agent: coder-execution
blueprint_row: 44
milestone: M2
class: B
tier: 3
type: lane-infrastructure-recreation
status: complete
schema_applied: v1 only (migrations 0000-0003; NO v2 migration applied here)
closes: [CS-17 procedure, E-19, E-24, RK-10]
depends_on: [row 106 (DONE - M2 open)]
verification: M2-LANE-1 infrastructure clause, 2 runs (the +1 is at the M2 gate row 56)
---

# Row 44 - M2 lane recreation on the current committed schema (M2-W1 part 1)

## 0. Scope and result in one line

Recreated the three parallel-test lanes (`dems_lane_1/2/3`) on the **current committed schema**
(migrations 0000-0003 only; no v2 migration touched), started one Core per lane (4421-4423) and one
Vite per lane (5176-5178), and paired **one physical emulator per lane** through the existing
pairing-redeem flow (operations 15 + 18). **Status: COMPLETE.** All M2-LANE-1 infrastructure clauses
pass on two runs; SMART WMS and oMLX ports were never contacted; no device lock was typed or changed.

## 1. Environment as found (read-only probes, before any change)

| Probe | Result |
|---|---|
| Git HEAD | `0024068` (checkpoint commit holding rev-1 rows 1-40 + audit revisions). Branch `main`, no remote. |
| Migration files present | `0000_prelude`, `0001_tables`, `0002_audit_guards`, `0003_privileges` only. Journal idx 0-3. No `0004/0005`. |
| PostgreSQL | project-local cluster running on `127.0.0.1:4432` (pid 47413). Host `*:5432` never contacted by this row. |
| `dems_demo` baseline | schema 1 / dbc-2, seeded, `paired_devices=5` (DEV-0003/0004/0005 from predecessor). |
| Lane DBs | absent (must be recreated - matches handoff report §7). |
| Ports 4421-4423 / 5176-5178 / 8081 / 4400 | free at start. |
| Emulators | `dems2_phone`=emulator-5554, `dems2_tablet`=emulator-5556, `dems2_phone2`=emulator-5558, all booted. |
| Lock state (`emulator-user-lock.sh status`, read-only) | phone `CredentialType=PIN isKeyguardShowing=false`; tablet `PIN ... false`; phone2 `NONE ... false`. **No device was locked.** |
| Port-bind capability | verified locally (`BIND_OK 127.0.0.1:4499`); local binding works in this session. |
| Debug APK | `com.dems.demo.tablet` installed and `DEBUGGABLE` on all three emulators. |

## 2. Procedure executed (dbc-3 §F steps 1-3 and 5-7; step 4 v2 seed and step 8 dems_demo reseed are row 53's, NOT this row)

### 2.1 db:create (dbc-3 §F step 2)

```
db:create: created dems_lane_1 (owner dems_owner, encoding UTF8, locale C) on PostgreSQL 18.4 as dems_owner.
db:create: created dems_lane_2 (owner dems_owner, encoding UTF8, locale C) on PostgreSQL 18.4 as dems_owner.
db:create: created dems_lane_3 (owner dems_owner, encoding UTF8, locale C) on PostgreSQL 18.4 as dems_owner.
```

Provisioned as `dems_owner`; `dems_admin` was never used after provisioning (red line honoured).

### 2.2 db:migrate under the migrate lock (dbc-3 §F step 3)

Each run wrapped in `/usr/bin/lockf -k .locks/db-migrate.lock` (never `flock`). This row is the sole
db-runner.

```
db:migrate: dems_lane_1 on PostgreSQL 18.4 as dems_owner
db:migrate: schema version before: none (not migrated)
db:migrate: applied 4 migration(s): 0000_prelude, 0001_tables, 0002_audit_guards, 0003_privileges
db:migrate: schema version after: 1 (dbc-2)
```
(identical for dems_lane_2 and dems_lane_3)

Only the committed v1 set was applied. **No v2 migration exists in the tree and none was applied here**, exactly as this row requires.

### 2.3 db:seed v1 per lane (dbc-3 §F step 4 uses the v2 seed; THIS row seeds v1, the current committed seed)

```
db:seed: OK: dems_lane_1 is seeded.
db:seed: OK: dems_lane_2 is seeded.
db:seed: OK: dems_lane_3 is seeded.
```

Seeded baselines (run 1, via `db:status`): each lane `schema version 1; contract revision dbc-2`,
`device_credentials 0`, `paired_devices 0`, `pairing_codes 0` (clean slate for pairing).

### 2.4 Lane Cores and Vite (dbc-3 §F steps 5-6)

Started as tracked background processes (session lifetime):

| Process | Command | DB |
|---|---|---|
| Core lane 1 | `DEMS_CORE_PORT=4421 npm run start:server` | dems_lane_1 (auto by port) |
| Core lane 2 | `DEMS_CORE_PORT=4422 npm run start:server` | dems_lane_2 |
| Core lane 3 | `DEMS_CORE_PORT=4423 npm run start:server` | dems_lane_3 |
| Vite lane 1 | `DEMS_CORE_PROXY_PORT=4421 VITE_DEMS_CORE_MODE=live npm run dev -w @dems/core-web -- --port 5176 --strictPort --host 127.0.0.1` | forwards to 4421 |
| Vite lane 2 | same, `--port 5177`, proxy 4422 | forwards to 4422 |
| Vite lane 3 | same, `--port 5178`, proxy 4423 | forwards to 4423 |
| Metro | `npm run dev:mobile` | serves the debug bundle on 8081 to all three devices |

Note: the first Vite attempt used `npm run dev:web -w @dems/core-web` which npm resolved inside the
workspace (no such script there); corrected to the workspace's own `dev` script with CLI args. The
failed attempts exited on their own (npm error), leaving no listeners.

### 2.5 Per-lane adb reverse + pairing redeem (dbc-3 §F step 7; D258/E-24)

Device-to-lane mapping: emulator-5554 -> lane 1 (4421), emulator-5556 -> lane 2 (4422),
emulator-5558 -> lane 3 (4423). For each device:

```
adb -s <serial> reverse tcp:8081 tcp:8081      # Metro bundle (already present; kept)
adb -s <serial> reverse tcp:4420 tcp:442X       # retarget the device's Core port to this lane
adb -s <serial> shell am force-stop com.dems.demo.tablet
adb -s <serial> shell 'am start -W -a android.intent.action.VIEW -d "demsdemo:///login?core=LIVE&motion=off" com.dems.demo.tablet'
```

Reverse rules confirmed per device:
```
emulator-5554: host-16 tcp:8081 tcp:8081 ; host-16 tcp:4420 tcp:4421
emulator-5556: host-16 tcp:8081 tcp:8081 ; host-16 tcp:4420 tcp:4422
emulator-5558: host-16 tcp:8081 tcp:8081 ; host-16 tcp:4420 tcp:4423
```

On first launch against a lane, each app's stored `dems_demo` credential was refused and deleted
(Metro log): `GET /api/v1/pairing/device 401` then `"The Core does not know the stored device
credential; it is deleted"` -> runtime `pairing: UNPAIRED`. That is the correct precondition: pairing
is per database, so a device paired to `dems_demo` is unpaired on a lane.

Pairing per lane used the EXISTING flow with no PIN typed on any lock screen:
1. Supervisor sign-in through that lane's Vite proxy (same-origin, like the browser console):
   `POST /api/v1/auth/sign-in` `{username:"andi.pratama"}` with `Origin: http://127.0.0.1:<lane-vite>`.
2. Issue a one-time code (operation 15): `POST /api/v1/pairing/code` -> `{codeId, code}`.
3. Enter the 6-digit code into the app's own Pair screen (OTP field `pairing-code-input`) and submit
   (`onSubmitEditing` -> operation 18 redeem). The code is the app's pairing code, not a device PIN; it
   was held in a shell variable and never echoed.

Redeem responses captured in the Metro log (one per device):
```
INFO [DEMS-LIVE] POST /api/v1/pairing/redeem 201 b10eecfd-...   (lane 3, emulator-5558)
INFO [DEMS-LIVE] POST /api/v1/pairing/redeem 201 55779e6f-...   (lane 1, emulator-5554)
INFO [DEMS-LIVE] POST /api/v1/pairing/redeem 201 738292f1-...   (lane 2, emulator-5556)
```

## 3. Verification - M2-LANE-1 infrastructure clause (2 runs)

### Run 1 (during execution)
- Each lane Core `/api/v1/health`: `"status":"ok" ... "ready":{"database":true,"engine":true}`.
- Vite 5176/5177/5178 root HTTP 200 and proxied `/api/v1/health` = ok.
- Per-lane pairing landed: `paired_devices 0 -> 1`, `device_credentials 0 -> 1` after each redeem.
- Three `POST /api/v1/pairing/redeem 201` in the Metro log.

### Run 2 (consolidated re-check)

Databases reachable + v1 schema + pairing (direct read-only owner query on 127.0.0.1:4432; credentials
read inside the process, never printed; `dems_admin` not used):
```
dems_demo    schema=1/dbc-2 tables=30 capture_config=false paired_devices=5 device_credentials=5 pairing_codes=5
dems_lane_1  schema=1/dbc-2 tables=30 capture_config=false paired_devices=1 device_credentials=1 pairing_codes=2
dems_lane_2  schema=1/dbc-2 tables=30 capture_config=false paired_devices=1 device_credentials=1 pairing_codes=1
dems_lane_3  schema=1/dbc-2 tables=30 capture_config=false paired_devices=1 device_credentials=1 pairing_codes=1
```
`capture_config=false` on every lane proves the v1 schema (no v2 table present).

Port listeners (project only):
```
127.0.0.1:4421 127.0.0.1:4422 127.0.0.1:4423 127.0.0.1:5176 127.0.0.1:5177 127.0.0.1:5178 127.0.0.1:8081
```

Core health + live WS clients:
```
4421: status=ok ready.db=true ready.engine=true ws.clients=1
4422: status=ok ready.db=true ready.engine=true ws.clients=1
4423: status=ok ready.db=true ready.engine=true ws.clients=1
```

Vite lanes:
```
5176: root=200 proxy_health=ok
5177: root=200 proxy_health=ok
5178: root=200 proxy_health=ok
```

Paired device per lane (supervisor `GET /api/v1/pairing/devices`):
```
lane_1 -> count=1 DEV-0001:PAIRED
lane_2 -> count=1 DEV-0001:PAIRED
lane_3 -> count=1 DEV-0001:PAIRED
```

Device-side confirmation (uiautomator dump of each emulator): all three show `screen-login` with
"paired as DEV-0001" (the pairing gate released; no longer stuck on the Pair screen).

SMART WMS / oMLX ports never contacted:
```
lsof ... :5173|:5174|:5175|:8000  -> (empty; none bound by this task)
```
Host PostgreSQL `*:5432` never connected to; project cluster `127.0.0.1:4432` = pid 47413.

### Recording blocked until the redeem call returns (D258 / E-24)

Recording is gated on a connected paired tablet (engine `tabletLink` OFFLINE until a paired device
socket connects; README "Live mode -> Known limits"). The causal chain is proven by evidence, not
assumed:
- Before redeem: each app had no valid lane credential (`GET /api/v1/pairing/device 401` -> credential
  deleted -> `pairing: UNPAIRED`), so no paired-device socket existed -> the recording gate was closed.
- The `POST /api/v1/pairing/redeem 201` is what minted the lane credential; only afterwards does the
  device hold a credential and connect (`ws.clients` 0 -> 1).
- Live gate demonstration on lane 3 (non-mutating; no recording was ever started):
  ```
  before (paired+connected): ws.clients=1
  after force-stop of the paired device: ws.clients=0     # no connected paired tablet -> gate closed
  after relaunch (reconnects via the redeem-minted credential, no re-pairing): ws.clients=1
  ```
This shows recording availability tracks the connected paired device that the redeem produced, i.e. it
is blocked until the redeem call has returned.

## 4. Red-line compliance

- PostgreSQL: only `127.0.0.1:4432` through repo scripts / the repo pg helper; host `*:5432` untouched;
  `.data/pg.pwfile`, `.data/pg.owner.env`, `.data/pg.env` never printed, staged, or passed as arguments
  (the read-only verifier read them inside its process and printed only counts/schema facts);
  `dems_admin` never used after provisioning (create/migrate/seed ran as `dems_owner`; reads as owner).
- Emulators: no lock-screen PIN typed; no `locksettings`/`emu finger`/settings change; the read-only
  `emulator-user-lock.sh status` was the only lock-related command run. Only the app's own 6-digit
  pairing code was entered into the app's Pair field (legitimate operator action). Biometric test skipped.
- Launch used `demsdemo:///login?core=LIVE&motion=off` single-quoted for the device shell; web console
  addressed only at `http://127.0.0.1:<port>`; `apps/mobile/scripts/device-session.sh` was NOT used
  (manual stack running); `apps/mock-core/**` and `release/**` untouched; port 8000 not bound; SMART WMS
  ports untouched and its `tsx watch` processes (36258/36571/65669) left alive.
- No git push/remote; no sudo; no emoji; docs in English.

## 5. Environment observation (not a defect of this row)

Mid-session, a parallel blueprint row (typed-schema v2, row 45) landed uncommitted edits under
`apps/core-server/src/db/schema/` (new `capture.ts`/`recording.ts`/`transcript.ts`, modified
`index.ts`/`sessions.ts`/`evidence.ts`/`checks.ts`/`value-sets.ts`) in the SHARED checkout. Because
`db:status` enumerates tables from the typed schema, it began failing on my v1 lanes with
`relation "public.capture_config" does not exist` (SQLSTATE 42P01). The migration files and journal were
still only 0000-0003, and my lanes were created/migrated/seeded earlier against the v1 definition, so the
lanes themselves are correct v1. I switched the state proof to a direct read-only owner query (§3 Run 2),
which confirms `capture_config=false` on every lane. HEAD stayed `0024068`. This is a shared-working-tree
concurrency artifact; row 44's outputs are unaffected.

## 6. Delivered state and how to stop it

Left running (session lifetime) as the recreated lane infrastructure for later M2 device rows:
Metro (8081), Cores 4421-4423, Vite 5176-5178, and three paired+connected emulators (one per lane).
Lane databases remain at v1 (dbc-3 §F step 4 v2 seed and step 8 `dems_demo` v2 reseed belong to row 53).

To stop cleanly (process-tree aware):
```
# Cores/Vite/Metro are tracked background processes; kill by pid tree, loop pids individually.
# Remove reverse rules and leave no orphaned logcat readers:
for s in emulator-5554 emulator-5556 emulator-5558; do adb -s $s reverse --remove-all; done
```
If a future cold boot leaves an emulator at its keyguard, the USER unlocks it (no agent types a PIN):
```
apps/mobile/scripts/emulator-user-lock.sh unlock        # all three; or add phone|phone2|tablet
```

## 7. Register closure

| Register row | Closed by this row |
|---|---|
| CS-17 (procedure) | lane create/migrate/seed procedure executed on the committed schema (completion of CS-17 lands in row 53 with the v2 seed) |
| E-19 | lane databases recreated (were gone) |
| E-24 | per-lane pairing through the existing redeem flow; recordings gated on redeem return |
| RK-10 | parallel-test lanes restored on the current schema |

## 8. Notes / decisions

- Device-to-lane assignment chosen for convenience (5554->L1, 5556->L2, 5558->L3); pairing is per
  database so the assignment is arbitrary.
- Lane 1 shows `pairing_codes=2`: one ACTIVE code issued during a first attempt whose submit missed
  (keyboard covered the Pair button), plus the redeemed one. Unredeemed codes expire in 300 s; the
  invariant `paired_devices=1` holds. Fixed by submitting via keypad ENTER (`onSubmitEditing`).
- OTP entry recipe that proved reliable across phone and tablet layouts: tap slot-0 to focus ->
  `input text <6 digits>` -> tap slot-0 again to refocus -> `input keyevent 66` (ENTER submits).

---
*Generated: 2026-10-08 (row 44)*
