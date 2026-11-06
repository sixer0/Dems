# coder-execution-local — RECON-F2b (live dev DBs to snapshot v2 + M2-LANE-1 boot)

Status: COMPLETE (task 3 phase C, D56-D57 W20)
Artifact: implementation/69c_recon_snapshot_live.md (Tier 3)
Date: 2026-10-08

## Steps

| Step | Result |
|---|---|
| 0 baseline probe | all four DBs store sim_schema_version=1 (core_state + hardware_snapshot); stale row-53 stack on 4421-4423/5176-5178 running pre-F2a code; PG running |
| 1a stop stale stack | SIGTERM by process tree (cores then vites); all six ports free; Metro 8081 untouched; no logcat orphans |
| 1b advance DBs | one-shot transactional UPDATE under `lockf -k .locks/db-migrate.lock`: `1->2` on both columns for dems_demo + dems_lane_1/2/3 (updated rows 1/1 each, ADVANCE_EXIT:0); AFTER-probe: kept counts identical, pairings unchanged (demo 5 rows incl. 3 PAIRED; lanes 1 PAIRED each, row-44-era pairedAt), stt_config=1 present, schema_meta/journal untouched |
| 2 restart | Cores 4421/4422/4423 + Vite 5176/5177/5178 restarted (tracked bg, parent-session lifetime); lane-1 adb reverse rules were missing at receipt — restored (D-F2b-3) |
| 3 boot assertion x2 | 4421/4422/4423 `status=ok ready.db=True ready.engine=True` against v2 (engine.rehydrate accepted stored 2); 5176/5177/5178 root=200 proxy_health=ok; pairing per lane count=1 DEV-0001:PAIRED; blocked-until-redeem proven live on lane 3 (force-stop 1->0, relaunch 0->1 via redeem-minted credential, no re-pairing) |

## Device-connect state (user gate, not a F2b failure)

emulator-5556 (dems2_tablet, lane 2) + emulator-5558 (dems2_phone, lane 1) keyguard PIN up ->
ws.clients 0 / online False there; emulator-5554 (dems2_phone2, lane 3) lock-free and connected
(clients=1). No PIN typed. Unlock: `apps/mobile/scripts/emulator-user-lock.sh unlock`, then the
row-44 launch recipe; expect 0->1 on 4421/4422 with stored credentials.

## Hygiene at close

PG running (`pg:status: OK`); databases = four + postgres only (no throwaways created); dems_owner
only, admin never used; creds never printed (readConnectionFile + say/redact); host :5432 never
contacted (assertEndpoint refuses it); no source/migration/openapi/lockfile edits; no git write;
listeners only project ports; SMART WMS + oMLX untouched; stack left running for row 56.
