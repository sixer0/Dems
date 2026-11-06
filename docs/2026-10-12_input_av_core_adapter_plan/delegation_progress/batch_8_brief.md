# Batch 8 - common brief (read after driver_rules.md)

Tree: branch task4/input-av-core-port at commit 3b388746 plus the landed, uncommitted rows of batch 7 (do not revert or reformat anything you did not write).

Hard limits, in addition to driver_rules.md:
- Edit tool ONLY for existing files. No scripted replace, no shell append, no generated rewrite. Six agents broke this; state in your report that you kept it. New files with Write.
- You commit nothing. No full suite. Targeted tests, `--maxWorkers=2`, one run, a second only after a failure (a third only if the failure was in your own new test, and say so). Typecheck of each workspace you touched (and of every importer if you changed packages/shared or packages/capture-protocol) once per row.
- Loopback / process / PostgreSQL tests need the command sandbox off. Database tests: throw-away databases under `.locks/db-migrate.lock`; never `db:migrate` on the demo or lane databases (C29).
- Heavy host: `/usr/bin/lockf -k -t 1800 .locks/heavy-host.lock <cmd>` from the repository root for anything that starts the worker, the relay, a media process or binds a port. KEEP EACH HOLD SHORT (take it per run, never across your thinking or editing): in batch 6 one agent held it for long stretches and two others waited for hours. Worker listeners 8559-8564, test-camera doubles 8565-8574, loopback only (C33).
- Several rows in one agent: finish, check and record each before the next; one record and one delegation_progress/row_NNN.md per row.
- A red in a file you do not own: report file:line and the likely owner; do not edit it.
- The relay's own RTSP client is a CANDIDATE (decisions C38, C39: the user has not ruled between it and a patched library). Build against the relay's INTERFACE (start message on standard input, exit codes, reports); do not deepen dependence on its internals.
- Standing product rulings you must not contradict: C25 (all four selector slots required to start in real capture), C34 (pairing fail-closed in production), C35 + C40 (missing camera = degraded start; a gate refusal = critical fault of that camera; an ACCEPTED arrival that does not pair = capture ended; one notice, not two), C36 (no default profile stands in for the stream's statement in the Core), C37 (a report for a superseded attempt is dropped, not a fault), U13 (no hardware: everything closes on doubles; say what stays unproven and its check 9A/H-nn).

- NEW, user ruling U15 (decisions.md): the class-C lift is released by the user and real devices are now connected. For YOUR row nothing changes unless its brief says so: no agent contacts a real camera, opens a real microphone, changes a host or camera address, or types a credential. Real-device work is a separate, user-attended step. Continue to close on doubles and say what stays unproven.
- Width: 12 agents run at once. Take the heavy-host lock per run and release it; do not hold it while editing or thinking.

Who edits what (one writer per resource):
| Agent | Rows | Area | Single-writer resource |
|---|---|---|---|
| W (still in flight) | 42, 142 | apps/capture-worker/src, Makefile, worker series | worker source and build |
| SC | 49, 110, 96 | adapters/camera (loss, presence, clock; set-network file); the one datagram file (typed probe) | static-capture list |
| K | 68, 81 | adapters/audio (microphone loss); capture/boot/index.ts wiring + boot checks of delivered programs | fence boot files (row 81 only) |
| P | 188 | capture-session/index.ts, ingest-pairing.ts | session file |
| G | 185, 190 | packages/shared registry action for a microphone; server registrar | shared registry files (not i18n) |
| N | 187 | modules/capture-config (operation 78 refuses a production camera without its own profile) | - |
| V | 33 | capture/fence/__tests__ (the 21-state table; tests only) | - |
| D | 99, 100 (+192) | db schema set B, migrations, value sets, schema version, permission vocabulary; the port/serial columns of capture_audio_inputs | db schema, migrations, permission pins |
| U | 72, 98 | apps/core-web features/devices (sound cards; typed address) | packages/shared i18n/en/common.ts |
| E | 12 | E-8 playback half (fixtures, a throw-away Core instance, one emulator session) | emulator, a spare lane |
| H | 25, 69, 184 | experiments and real-code audio check on macOS (fixtures, docs) | - |
| C | 78 | Ubuntu 24.04 container definition | container runtime |
| I | 135 | installer note (docs) | - |
