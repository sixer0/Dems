# Batch 9 - common brief (read after driver_rules.md)

Tree: branch task4/input-av-core-port at commit 0f5d2a8e (schema version 8, dbc-9; 99 operations; 77 audit types; 15 permissions). Uncommitted on purpose: apps/capture-worker/ (row 193, a Linux portability row, is editing it) and the four HW-ACCEPTANCE chapters (row 181). Do not revert or reformat anything you did not write.

Your row is defined by its cells in identification/03_implementation_blueprint.md: Task Description, Expected Output, Verification, and its line in the Execution Profile (Ownership Area, dependencies, shared resources, checks) plus the requirement identifiers it carries (section 11; SX-nn texts are in verification/07_security_x1_x2.md, AD-nn in verification/04_security_addendum.md, BR-nn in verification/05_security_branch_b.md, S13-nn / RC-n in verification/02_security.md). Read them IN FULL before anything else, then the implementation records your row builds on (implementation/NNN_*.md of the rows named in your cells) and decisions/decisions.md (user rows U1-U19; controller rows C1-C48 - the later ones override the earlier documents).

Hard limits, in addition to driver_rules.md:
- Edit tool ONLY for existing files: no scripted replace, no shell append, no generated rewrite (a file the repository's own generator writes is fine - say which). Seven agents broke this; say in your report that you kept it. New files with Write.
- You commit nothing. No full suite. Targeted tests, `--maxWorkers=2`, one run, a second only after a failure (a third only if the failure was in your own new test - say so). Typecheck of each workspace you touched, and of every importer if you changed packages/shared or packages/capture-protocol, once per row.
- Loopback / process / PostgreSQL tests need the command sandbox off. Database tests: throw-away databases under `.locks/db-migrate.lock`, each clone dropped when its case ends (the live-clone guard refuses the 100th); NEVER `db:migrate` on the demo database or a lane database (C29).
- Heavy host: `/usr/bin/lockf -k -t 1800 .locks/heavy-host.lock <cmd>` from the repository root for anything that starts the capture worker, the relay, the guard, a media process, a container, or binds a port - PER RUN, released at once; sixteen agents share this host. Worker listeners 8559-8564, test-camera doubles 8565-8574, loopback only. Do NOT rebuild anything under apps/capture-worker (row 193 is its single writer); if a binary in apps/capture-worker/build is missing or mid-rebuild, wait on the lock and retry once, then report.
- Several rows in one agent: finish, check and record each before the next; one record at each row's Expected Output path and one delegation_progress/row_NNN.md per row.
- A red in a file you do not own: report file:line and the likely owner; do not edit it. A change you need in a file you do not own: one line in delegation_progress/file_requests.md, then continue behind a seam.
- REAL DEVICES (U15-U18): the user has connected a camera and a microphone to this Mac. Unless your brief says you are the real-device row, you contact NO real device, send no probe to the network, open no microphone or camera, and never type, read or store a real credential. Everything closes on doubles; say what stays unproven and its hardware check 9A/H-nn.
- SECRETS (X-1 / X-2 rows): no real key or password is ever created for use, read, printed or logged by an agent. Tests generate synthetic values per run and leave none behind. Never read the content of a key or credential file under .data/. The seed's published demo password is referred to as "the published demo password" - do not copy it into any new file except where a test must name the constant by import.
- Standing product rulings: C25 (all four selector slots required to start in real capture), C34 (pairing fail-closed in production), C35 + C40 (missing camera = degraded start; gate refusal = critical fault of that camera; accepted-but-unpaired = capture ended; one notice), C36 (no default profile for a production camera), C37 (a report of a superseded attempt is dropped), C46 (host and program checks fail-closed at the real entry; tests pass an explicit test host), C19 (alias helper = root service on a local socket; request line `add <address>/24 <minutes>`, `del <address>/24`; one alias at a time), U10 (commissioning = TECHNICIAN only), U9 (active scan only).

Single-writer resources in this batch:
| Agent | Rows | Area | Resource it alone writes |
|---|---|---|---|
| R1 | 85 | production registry builder, loader signature, the real entry's host facts (C46) and the sweep of suites that boot REAL_PRODUCTION | fence-wiring; capture/__tests__/static.test.ts |
| R2 | 191 | microphones restarted for a later worker (capture-session, supervisor hook) | session file, supervisor.ts |
| R3 | 143, 146, 154 | production camera adapter (stored-address rule), adopted-camera connection test, minted code vs hostile description | adapters/__tests__/static.test.ts, test/static/credentials.test.ts |
| R4 | 199, 200 | audio-cards module and the production microphone adapter store and match serial and port | - |
| R5 | 201, 194, 195, 102 | packages/shared: audit vocabulary step, re-address contract (operation 99 -> 100), its internal action, commissioning operations contract | shared hot files, op pins, audit pins, i18n, openapi.json |
| R6 | 202, 114, + the profiles CHECK | db schema steps (X-C: version 8 -> 9; set C: 9 -> 10; the CHECK on capture_devices.profiles with its data step) | db schema, migrations, value sets, schema pins |
| R7 | 105 | the Core's one caller of the alias helper behind a platform seam | config.ts keys |
| R8 | 44, 159 | relay experiments E-12 and hygiene observations (fixtures, docs) | - |
| R9 | 206, 210 | X-1: the production key command; signer store read path and write sync | sealing / signer files |
| R10 | 213, 212, 207 | X-2: terminal secret prompt, password policy; secret-scan needles | scripts/secret-scan |
| R11 | 214 | X-2 gate test (SX-02, SX-03) | - |
| R12 | 205 | baseline record of the boot check files (read-only git) | - |
| R13 | 15, 36 | gates M1 and M2 (documents) | - |
| R14 | 232 | REAL-DEVICE ROW: a Core of this branch for the user's camera search and connection test | a spare port, its own database |
| (in flight) | 193, 181 | apps/capture-worker; the four HW-ACCEPTANCE chapters | worker source and build; those documents |
