# Batch 6 - common brief (read after driver_rules.md)

State of the tree: branch task4/input-av-core-port at commit 6e6707dd, clean except in-flight new files under scripts/hardware-acceptance/ (rows 128/129).

Hard limits, in addition to driver_rules.md:
- Edit tool ONLY for existing files (no scripted or generated replace). New files with Write.
- You commit nothing. No full suite. Targeted tests, `--maxWorkers=2`, one run, a second only after a failure. Typecheck of each workspace you touched (and, if you changed packages/shared, of every workspace that imports it) once per row.
- Loopback / process / PostgreSQL tests need the command sandbox off. Database tests: throw-away databases under `.locks/db-migrate.lock`; never `db:migrate` on the demo or lane databases (C29).
- Heavy host (anything that starts the capture worker, the relay, a media process, or binds a port): `/usr/bin/lockf -k -t 1800 .locks/heavy-host.lock <cmd>` from the repository root; several rows of this batch share it - wait your turn. Worker ingest listeners 8559-8564, test-camera doubles 8565-8574, loopback only (C33).
- Static rule lists of the capture area (capture/__tests__/static.test.ts, adapters/__tests__/static.test.ts, test/static/credentials.test.ts): only the agent of rows 65+66 edits them in this batch. Everyone else puts the exact line in file_requests.md.
- Shared hot files of packages/shared (i18n/en/common.ts, api/core-api.ts, api/state-slices.ts, sim/types.ts, sim/api.ts, openapi.json): only the agent of rows 162+163+165 edits them in this batch; it regenerates openapi.json once at its end. A client agent that needs a new string or member requests it and builds behind a local constant marked `PENDING-SHARED`.
- When a row has several rows in one agent: finish, check and record each row before starting the next; one record and one delegation_progress/row_NNN.md per row.
- A red you see in a file you do not own: report file:line, do not edit it.

Who edits what in this batch:
| Agent | Rows | Area |
|---|---|---|
| A | 162, 163, 165 | packages/shared: sim/capture-config.ts, sim/session-machine.ts, sim/api.ts and the shared hot files |
| B | 31, 167, 168 | apps/core-web: capture-selector panel, session-new pre-check, session-monitor audio readers |
| C | 32, 169, 170, 171 | apps/mobile: capture-selector, session-new pre-check, live-session microphone readers, meter readers |
| D | 150, 145, 155 | apps/core-server: modules/devices/status.ts; credential reader (commit rule); card listing text rule |
| E | 41 | apps/capture-worker/src: the relay (new files), Makefile - single writer of the worker source and build |
| F | 40 | apps/capture-worker/test-fixtures/rtsp_test_camera*.py (fault modes) |
| G | 179, 48 | apps/core-server: capture/supervisor.ts; capture-session/index.ts |
| H | 65, 66 | apps/core-server: adapters/audio config generator; adapters/local/mic-helper-args (Linux table); the static lists |
| I | 70 | apps/core-server: NEW microphone registration module under modules/ |
| J | 10, 22 | experiments (new fixture files, docs) |
