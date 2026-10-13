# Batch 7 - common brief (read after driver_rules.md)

Tree: branch task4/input-av-core-port at commit 3b388746, clean except in-flight new files under scripts/hardware-acceptance/ (rows 128/129).

Hard limits, in addition to driver_rules.md:
- Edit tool ONLY for existing files. No scripted replace, no shell append, no generated rewrite. Six agents broke this; state in your report that you kept it. New files with Write.
- You commit nothing. No full suite. Targeted tests, `--maxWorkers=2`, one run, a second only after a failure (a third only if the failure was in your own new test, and say so). Typecheck of each workspace you touched (and of every importer if you changed packages/shared or packages/capture-protocol) once per row.
- Loopback / process / PostgreSQL tests need the command sandbox off. Database tests: throw-away databases under `.locks/db-migrate.lock`; never `db:migrate` on the demo or lane databases (C29).
- Heavy host: `/usr/bin/lockf -k -t 1800 .locks/heavy-host.lock <cmd>` from the repository root for anything that starts the worker, the relay, a media process or binds a port. KEEP EACH HOLD SHORT (take it per run, never across your thinking or editing): in batch 6 one agent held it for long stretches and two others waited for hours. Worker listeners 8559-8564, test-camera doubles 8565-8574, loopback only (C33).
- Several rows in one agent: finish, check and record each before the next; one record and one delegation_progress/row_NNN.md per row.
- A red in a file you do not own: report file:line and the likely owner; do not edit it.
- The relay's own RTSP client is a CANDIDATE (decisions C38, C39: the user has not ruled between it and a patched library). Build against the relay's INTERFACE (start message on standard input, exit codes, reports); do not deepen dependence on its internals.
- Standing product rulings you must not contradict: C25 (all four selector slots required to start in real capture), C34 (pairing fail-closed in production), C35 + C40 (missing camera = degraded start; a gate refusal = critical fault of that camera; an ACCEPTED arrival that does not pair = capture ended; one notice, not two), C36 (no default profile stands in for the stream's statement in the Core), C37 (a report for a superseded attempt is dropped, not a fault), U13 (no hardware: everything closes on doubles; say what stays unproven and its check 9A/H-nn).

Who edits what:
| Agent | Rows | Area | Single-writer resource |
|---|---|---|---|
| W | 23, 42, 142 | apps/capture-worker/src (guard program, relay probe mode), Makefile, the worker's own test series | worker source and build |
| X | 152 | apps/capture-worker/test-fixtures/rtsp_test_camera*.py (hostile modes) | - |
| Y | 46 | NEW production camera adapter under apps/core-server/src/capture/adapters/camera/ | static-adapters lists (adapters/__tests__/static.test.ts, test/static/credentials.test.ts) |
| Z | 67 | NEW production microphone adapter under apps/core-server/src/capture/adapters/audio/ | - (requests static entries from Y / the next pass) |
| S | 71, 30, 158 | capture-session/index.ts (source facts); capture-notices tests; capture-config unassign tests | session file |
| B | 80 | apps/core-server/src/capture/boot/checks.ts + new host-check files | static-capture list (capture/__tests__/static.test.ts) |
| R | 97, 156 | modules/capture-discovery (re-address); modules/capture-inputs/audio-cards (single-flight, spacing) | - |
| T | 172, 149 | packages/shared (delete the positional function, remove the seam, 'MIC-01' literal); the reader-inventory test in apps/core-server | shared hot files, openapi.json |
