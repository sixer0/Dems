---
agent: coder-execution-local
row: 44
milestone: M2
status: complete
date: 2026-10-08
artifact: implementation/09_m2_lane_recreation.md
---

# coder-execution-local - row 44 (M2-W1 part 1: lane recreation + per-lane pairing)

## Status: COMPLETE

Recreated the three parallel-test lanes on the current committed schema and paired one emulator per
lane through the existing pairing-redeem flow. M2-LANE-1 infrastructure clause passes on 2 runs.

## What was done (dbc-3 §F steps 1-3, 5-7; step 4 v2 seed / step 8 dems_demo reseed are row 53's)
- db:create dems_lane_1/2/3 (as dems_owner).
- db:migrate under `/usr/bin/lockf -k .locks/db-migrate.lock`: applied 0000-0003 only -> schema 1/dbc-2. No v2 migration exists or was applied.
- db:seed v1 per lane (clean slate: paired_devices=0).
- Cores 4421/4422/4423 (each auto-selects its lane DB by port) + Vite 5176/5177/5178 (--port override) + Metro 8081, as tracked background processes.
- Per-lane `adb reverse tcp:8081->8081` and `tcp:4420->442X`; launched `demsdemo:///login?core=LIVE&motion=off`; issued a code as supervisor via the lane Vite proxy and redeemed it in the app's Pair screen (no lock-screen PIN typed).

## Verification evidence (raw, quoted in the artifact)
- Direct read-only owner query on 127.0.0.1:4432 (creds read in-process, never printed):
  all four DBs reachable; every lane schema=1/dbc-2, tables=30, capture_config=false, paired_devices=1, device_credentials=1. dems_demo unchanged (paired_devices=5).
- Port listeners: 4421-4423, 5176-5178, 8081 all bound (127.0.0.1).
- Core health x3: status ok, ready.database=true, ready.engine=true, ws.clients=1.
- Vite x3: root HTTP 200 + proxied health ok.
- Pairing: three `POST /api/v1/pairing/redeem 201` in the Metro log; supervisor GET shows DEV-0001:PAIRED count=1 per lane; each emulator shows "paired as DEV-0001" on Login.
- Blocked-until-redeem (D258): before redeem apps were UNPAIRED (stale dems_demo credential 401-deleted); redeem 201 minted the lane credential and the device connected (ws.clients 0->1). Live gate demo on lane 3: force-stop -> ws.clients=0, relaunch (reconnects via stored credential) -> ws.clients=1. No recording was started.
- SMART WMS ports 5173/5174/5175 and oMLX 8000 never bound; host *:5432 never contacted; SMART WMS tsx watch (36258/36571/65669) left alive.

## Devices locked?
No. All three reported isKeyguardShowing=false at start. No PIN typed on any lock screen; no security setting changed. If a future cold boot locks one, the USER runs: `apps/mobile/scripts/emulator-user-lock.sh unlock`.

## Cleanup
- No orphaned `adb logcat` readers (none were ever started).
- Failed first Vite attempts (`dev:web -w`) exited on their own; corrected to workspace `dev` script.
- Throwaway read-only verifier (/tmp) removed.
- Left running intentionally (session lifetime): Metro 8081, Cores 4421-4423, Vite 5176-5178, three paired+connected emulators. Stop recipe + reverse-rule removal documented in the artifact.

## Environment observation (not a row-44 defect)
A parallel row (typed-schema v2, row 45) landed uncommitted edits under apps/core-server/src/db/schema/ in the shared checkout mid-session. `db:status` then failed on my v1 lanes with `capture_config does not exist` (42P01) because it enumerates the typed schema. Migration files/journal stayed at 0000-0003 and my lanes are correct v1; I proved state with a direct owner query instead. HEAD stayed 0024068.

## Files created
- implementation/09_m2_lane_recreation.md (Tier 3) - full path; distinct from implementation/09_rv_code_audit_fixes.md (not touched).
- delegation_progress/coder-execution-local__row44.md (this file).
