# Status — DEMS Backend (Postgres), Integrated RBAC and Pairing

| Phase | Step | Status | Notes |
|---|---|---|---|
| A. Identification | A.1 Title + history screen | done | Related history: `docs/2026-09-30_dems_demo_stack_setup/` (specs, mobile specs, decisions D1–D132, known issues KI-01..KI-29) |
| A. Identification | A.2 Seed folder | done | README.md, status_tasks.md, decisions/decisions.md |
| A. Identification | A.3 request-translator | done | REQUEST_TRANSLATED; A1–A10, Q1–Q16 defaults adopted (D4); U1–U9 stay the user's call |
| A. Identification | A.4 task-architect | done | blueprint rev 1: 118 rows (1–22 firm, 23–118 provisional), P1–P22 |
| A. Identification | A.4a Pre-HIL validation V1–V7 | done — all PASS | D7 |
| A. Identification | A.5 BLUEPRINT_APPROVAL | pre-granted by the user's instruction (D1); blueprint summary reported (D7, D8); B.9 second gate: MAJOR, pre-granted, reported (D22) | |
| B. Research | Rows 1–12 (5 explore + 7 data-collector) | done — all gated PASS | findings F4–F19 |
| B. Research | Row 13 baseline root gate (verifier) | done — PASS-WITH-NOTES | shared 508, mock-core 19, mobile 833 green; core-web 436/438 (two calendar-dependent tests, D10 / F20) |
| B. Research | Row 14 analysis (data-analyst) | done | 23 decision records accepted (D11, D12) |
| B. Research | Row 15 system specification (data-analyst) | done | 75 operations, 3 roles × 12 permissions, 67 SR, 71 AC-B (D13) |
| B. Research | Rows 16 (database contract) ∥ 17 (client integration spec) | done | 29 tables (D14); 101 AC-C (D15) |
| B. Research | Row 20 security design review | done — CAUTION (5 Medium, 0 High) | D16: fix now |
| B. Research | Row 18 plan rev 1; rows 20a / 20b security corrections in 03, 01, 04 | done | D17, D18, D19: specs at rev 2 (SR-82, AC-B-93, AC-C-110; 30 tables) |
| B. Research | Contract patch rev 2.1 ∥ plan rev 2 | done | D19, D20: 105 work rows, coverage 93 / 110 / 82 |
| B. Research | Rows 19 (consistency check) ∥ 21 (blueprint refinement) | done | D21 PASS-WITH-NOTES (text fixes applied: specs rev 2.1, contract rev 2.2); D22 blueprint rev 2, 127 rows, V1–V7 PASS, class MAJOR |
| B. Research | Plan rev 2.1, specs rev 2.2, contract rev 2.2, blueprint rev 2.1 | done | D23; controller quality gate before implementation: PASS (gateway_check/01_gate_report.md) |
| B. Research | Row 22 docs commit (git-specialist) | done — `4b708c8` | SC1 reference 2026-10-04T06:25:02+07:00 (D24) |
| B. Research | rows 14 (analysis) → 15, 16, 17 (specs) → 18 (plan) → 19, 20 (checks) → 21 (refine) → 22 (docs commit) | pending | |
| C. Implementation | Steps 23 (W01), 24 (W02), 28 (W06) | done | D25 (core-web 438 / 438), emulators up, D26 (DP-1 option A) |
| C. Implementation | Step 25 (W03) npm slot N1 | done | D27: 13 pins installed, PostgreSQL binaries 18.4 present, one install script approved by name after reading |
| C. Implementation | Steps 26 (W04), 27 (W05) — early proofs d and f | done — both CONFIRMED | D28 (headless engine), D29 (same-origin proxy) |
| C. Implementation | W01b, 29 (W07), 31 (W09) | done | D31 (three suites calendar-robust), D32 (PostgreSQL 18.4 running on 127.0.0.1:4432), D30 (Argon2id built-in) |
| C. Implementation | 35 (W13), W02b (lock-free emulators) | done | D63: `dems2_phone` / `dems2_tablet` / `dems2_phone2` running without a lock, debug APK installed, launch check 0 on all three |
| C. Implementation | 34 (W12) typed client + emulator proof | done — early proof (e) CONFIRMED | D69: 15 of 15 device checks; client type fix applied (D64 closed); shared 1,406 / 1,406 |
| C. Implementation | W02b follow-up (port guard + user-run lock helper) | done | D70: `emulator-user-lock.sh status|setup|unlock|remove`; the `setup` command handed to the user at 11:26 (recommended: `phone` and `tablet`); not yet run by the user |
| C. Implementation | 37 (W15 secure-store wrapper + probe) | done — early proof (g) | D71: unprotected item works on three emulators; protected refused without enrolment (MB-5 case c); mobile 870 / 870. Re-probe with enrolment: one command, after the user's `setup` |
| C. Implementation | 66 (W44 Live source) | done | D75: shared 1,650 / 1,650; proven on the fake transport only — first contact with the real server is the lane check of the client rows and the backend gate |
| C. Implementation | 68 (W46 checkpoint CP-C1: review of the shared client layer) | done — PASS WITH FIXES | D80: 0 Blocker, 0 High, 6 Medium, 12 Low, 4 Info; fix now |
| C. Implementation | CP-C1 fix round: typed client (2 findings) and Live source (17 findings, local end DR-11) | done | D81, D84: every fix red-before / green-after; shared 1,735 / 1,735 (controller, 14:18) |
| C. Implementation | Live source follow-ups (gap-ID rename, observed client, one export) | done | D86: all 17 CP-C1 findings of the Live source fixed; one more real defect found and fixed (stale data on a non-operator socket); shared 1,747 / 1,747 (controller, 14:37) |
| C. Implementation | 60 (W38 checkpoint CP-B1: review of the backend foundation) | done — PASS WITH FIXES | D87: 1 Blocker (= D85, fix in flight), 2 High, 12 Medium, 9 Low, 2 Info; fix now in two rounds; rule M14 |
| C. Implementation | W28 owner fix (D85 / CPB1-1, D88 grants assertion) and CP-B1 fix round A | done | D95, D96: CP-B1 open blockers 0; F53 shown to be a real silent loss of an audit row on the old code and closed by construction; server `unit` 2,822 (controller, 15:54), `db` 1,112 |
| C. Implementation | CP-B1 fix round B2b (`app.ts`, typed codes, cycles, shims, module follow-ons) | queued after B2a | CPB1-5, 9, 10; remove the modules' own API-7 lines; devices module reads `meters()`; demo module uses the exported boot-check runner; the remaining read-block copies; shims; Low items |
| C. Implementation | CP-C1 re-review of the fix rounds | done — PASS WITH FIXES | D90: 19 of 22 closed in code; 10 new findings (2 Medium); runtimes may start |
| C. Implementation | Live source second and third fix rounds | done | D97, D107: shared 1,807 / 1,807 (controller); the shared client layer is closed until W92; brief list for the runtimes = implementation/44 §17.4 (34 rows) |
| C. Implementation | 30 (W08), 32 (W10), 36 (W14), 38 (W16) | done | D40 scaffold 330 tests; D38 drizzle confirmed; D39 npm slots closed; D37 vocabulary 12 / 18 / 53 |
| C. Implementation | 33 (W11), 40 (W18), W16 label follow-up, W01c | done | D48, D43, D41, D42 |
| C. Implementation | 41 (W19 contract A) | done | D50: 37 operations in the `all` scope, offline scope unchanged at 10 |
| C. Implementation | 44 (W22 contract B), 45 (W23 request guards), typed-client adaptation | done | D53, D52, D51 — server unit 979 / 979, shared 977 / 977 |
| C. Implementation | 39 (W17 schema + migrations) | done | D54: 30 tables live, catalog diff empty, 233 database tests |
| C. Implementation | 42 (W20 mapping + seed), 52 (W30 live socket client), 53 (W31 fake transport), SIM-GAP-1, two one-file follow-ups | done | D62 (`dems_demo` built and seeded: 301 rows, 82 audit rows, 59 events), D59, D61, D56 — shared 1,351 / 1,351 |
| C. Implementation | 49 (W27 contract C) | done | D64, condition closed by D69: 75 operations in the registry and in the committed OpenAPI document; typecheck green in every workspace |
| C. Implementation | 43 (W21 core services), 107 (W85 notices) | done | D67 (server `unit` 1,281 / 1,281, `db` 382 / 382), D68 (`THIRD_PARTY_NOTICES.md` +128 lines, licence text byte-checked) |
| C. Implementation | 47 (W25 bulk fixture) | done | D73: all 30 minimums met (5,000 audit rows), deterministic, test databases only |
| C. Implementation | 51 (W29 reset routine + lane databases) | done | D74: `dems_lane_1..3` built and seeded (controller `db:status`); failure at any of 15 checkpoints leaves the target untouched |
| C. Implementation | W11b (helper forced-drop retry) | done | D76: autovacuum cause reproduced; bounded retry; a leaked client session still fails clearly. Whole server suites at 12:28: `unit` 1,848 / 1,848, `db` 623 / 623 |
| C. Implementation | 48 (W26 engine host) | done | D77: the simulator core runs headless on PostgreSQL; 230 audit rows of the recording scenario equal the simulator's by hash; server `unit` 1,848 / 1,848 (controller, 12:42), `db` 623 / 623 |
| C. Implementation | 46 (W24 identity core) | done | D78: sign-in, server sessions, cookie, lockout, sweeper, operations 2 to 6; 20 concurrent wrong sign-ins → exactly 5 derivations; dump and log hold no secret |
| C. Implementation | 51 follow-up (reset test and routine close) | done | D79: cause was cross-run interference on a fixed application name, not load; a real early-"closed" defect of the routine fixed. Server suites: `unit` 1,850, `db` 629 |
| C. Implementation | 50 (W28 RBAC guard + pipeline integration) | done | D83: deny by default; 40 cells of the HTTP decision table through the real stages; server `unit` 1,992 (controller, 14:11), `db` 740. Standing rules M1–M13 for module rows in gateway_check/01_gate_report.md |
| C. Implementation | 59 (W37 storage + network-time) | done | D88: any-of proven end to end; policy survives a restart; server `unit` 2,647 (controller, 15:12), `db` 1,047 (row) |
| C. Implementation | 58 (W36 devices) | done | D89: 409 `RECORDING_ACTIVE` / `COMMAND_UNSUPPORTED` proven; server `unit` 2,658 (controller, 15:17), `db` 1,071 (row) |
| C. Implementation | 55 (W33 user and role administration) | done | D91: last-administrator rule held in 77 concurrent rounds incl. two instances on one database; role change applies to the next request of the same session |
| C. Implementation | 57 (W35 evidence) | done | D92: sealed evidence unchanged at the level of stored bytes through verify, tamper fault, export, archive; denied export = one guard row |
| C. Implementation | 54 (W32 pairing + device registry) | done | D93: of 20 concurrent wrong redeems exactly three count; the code closes at five; two redeems of the right code → one device; no code or credential in rows, events or log |
| C. Implementation | 56 (W34 sessions) | done | D94: 40 rounds of concurrent creates → one session each; journey's audit sequence equals the simulator's; one precedence item for fix round B |
| C. Implementation | 65 (W43 demo control) | done, one follow-up running | D101: reset from inside the server proven step by step and on failure; a failed reset will take a new epoch |
| C. Implementation | 61 (W39 security-audit) | done | D102: paging returns every row once while rows are appended; incremental chain verification; lineage. Fixture follow-up done (D103) |
| C. Implementation | 62 (W40 system + alerts) | done | D104: nine domain modules landed; server `unit` 3,536 (controller, 16:52), `db` 1,516 (row) |
| C. Implementation | 63 (W41 biometric token), W43 follow-up | done | D105 (two concurrent uses of one token → exactly one session, 25 rounds), D106 (a failed reset takes a new epoch) |
| C. Implementation | 75 (W53 restart acceptance test), sessions follow-up, fixture follow-up 2 | done | D110 (SC2 proven through the real routes: 12 restarts, 30 tables; 16 tests — controller run 17:43), D108, D109. One hazard for fix round B2: a clock behind the stored state at a start (F74) |
| C. Implementation | 64 (W42 realtime channel), CP-B1 fix round B1 | done | D111: all backend module rows landed (75 operations + the socket); first contact of the shared client layer with the real server: no mismatch; three handshake defects found and fixed. D112: structure per the review. Server `unit` 3,609 (controller, 17:54), `db` 1,540 + 1 skipped |
| C. Implementation | 67 (W45 security review CP-S1) | done — CAUTION | D113: 0 Critical, 0 High, 2 Medium (both already in fix rounds B2a / B2b, required before the gate), 7 Low, 4 Info; 82 of 82 requirements have code and tests, 0 not met |
| C. Implementation | 74 (W52 contract conformance) | done | D115: 337 of 337 operation-by-status cells; zero undocumented routes, zero unregistered operations; 34 tests (controller run 18:40) |
| C. Implementation | 70 (W48 pairing lifecycle) | done | D116: SC5 through the real routes and socket, 31 tests (controller run 18:49); a device revoked mid-recording: 403, socket 4403 within 5 ms, the recording stays and another operator stops it; no secret in any table, row, frame or log |
| C. Implementation | 69 (W47 role by endpoint matrix) | done | D117: SC4 through the real pipeline, 34 tests, 1,200 cells equal to the specification (controller run 18:53); 19 of 19 production changes detected |
| C. Implementation | 71 (W49 shared state between two clients) | done | D119: SC3 through the real channel, 6 tests, 2,934 frames validated (controller run 19:25); B equals A, also after a lost connection and a reset |
| C. Implementation | realtime follow-up (CPS1-4, CPS1-5, test support) | done | D120: a socket cap per session (4) and per device (2); forgotten upgrade sockets gone within 5.25 s; controller run 19:36 |
| C. Implementation | 72 (W50 web runtime with the mode switch) | done | D121: 48 files / 598 tests (controller run 19:40); both modes shown in a real browser on lane 3 |
| C. Implementation | identity security Lows (CPS1-6, -7, -8); guard step for CPS1-3 (operation 23); matrix test adaptation (69b) | done | D123 (controller runs 20:25 to 20:29) |
| C. Implementation | 73 (W51 mobile runtime) | done | D124: 82 suites / 992 tests; the Pair chip `LIVE` moved to W57 |
| C. Implementation | fix round B2a (engine + clock: F74 / CPS1-1, F73, F71, F66, API-7 hook, boot-check runner) | done | D122: one by-design test line granted |
| C. Implementation | operation 8 add-on (D118 step 2; F77) | done | D126: CPS1-3 closed in full (controller runs 20:50–20:52) |
| C. Implementation | engine follow-up (granted line, `meters` required, F78) | done | D127 (controller runs 20:57–21:00); one by-design demo test handed to B2b |
| C. Implementation | 78 (W56 mobile sign-in) | done | D129: 90 suites / 1,185 tests (controller run 21:50) |
| C. Implementation | 77 (W55 web Login) | done | D128: web 55 files / 758 tests (controller run 21:58); sign-in on lane 3 in a real browser; the session only in an `HttpOnly` cookie |
| C. Implementation | 76 (W54 web shell, navigation, admin routes) | **done — GATED PASS** | D136: web 759 / 55 exit 0, the row's 84 tests in 3 files, mutation 133 of 137 with four proven equivalent; Decision 3 (the `danger` tone of RECONNECTING) and Decision 9 (the second copy of the mode switch) routed to CP-W1 |
| C. Implementation | 79 (W57 mobile pairing flow) | **done — GATED PASS** | D137: pairing folder 6 suites / 66 tests, +51 new; tablet paired on lane 2 as `DEV-0001` (DN-6 binding); DN-1 accepted as KI-01/KI-10 residual, DN-2 declined, DN-3 to DN-8 ruled |
| C. Implementation | 81 (W59 mobile Login in LIVE mode) | **done — GATED PASS** | D138: audit-first kept the leftover, one block rewritten for the React Compiler lint; +20 tests; lane-1 device check on the unpaired phone; the paired-device evidence moves to W60 and W94 |
| C. Implementation | fix round B2b items 8a, 9–13 | done — **round open on the whole-project green** | D139: shims removed, log-call spread test, activity-exempt list, drop-run script; item 10 delivered as the safe subset, the remainder routed (owners / a scheduled slot / W91); two shim follow-ups routed to their owners |
| C. Implementation | helper follow-up 3 | **done — CLOSED on the non-local tier** | D142, DR-13: the folder was complete-but-unmeasured from two dead rounds; verified with zero program-line writes; whole `db` 122 / 1,740 exit 0 twice, whole `unit` 153 / 3,912 exit 0, 11 of 11 new mutations caught, cluster untouched. F W3-3 (`test/static/scan.ts:19` does not skip `.cache`) routed to a post-gate structural slot |
| C. Implementation | RESUME wave 1 (2026-10-05) | closed — 4 of 4 returned | B2b holder, W59 holder, verifier (evidence), helper holder (failed twice); then two evidence-repair rows closed W54's and W57's gaps |
| C. Implementation | RESUME wave 2: 82 (W60 mobile pairing gate), 83 (W61 CP-W1 review), helper finish | closed — 3 of 3 returned | D143 (W60 PASS, mobile 1,230 / 94, the LIVE sign-in evidence delivered on device), D144 (CP-W1 PASS WITH FIXES, 0 Blocker / 1 High / 4 Medium; **D136(g) superseded, F76-13 withdrawn**), D142 (helper) |
| C. Implementation | RESUME wave 3: 80 (W58 backend gate), CP-W1 fix round, 84 (W62 CP-M1) | done | D146, D147, D148 |
| C. Implementation | 125 (W104 checkpoint commit 1) | **done — `b90a3c6`** | D150: 1,562 files, local only; the other tool's half-done staging finished after a content scan; controller's fresh runs all green 20:07–20:12 |
| C. Implementation | M0 (CPM1-3, one link rule in `@/runtime`) | done | D151: mobile 96 suites / 1,257 (controller run 22:38) |
| C. Implementation | 85 (W63 web Dashboard) | done | D152: web 62 files / 853 (controller run 22:46) |
| C. Implementation | 86 (W64 web Start New Session) | done | D153 (controller run 23:04); row W0 queued: one shared pending-control hook after W65 and W69 |
| C. Implementation | 87 (W65 web Session Monitor) | done | D154: a real recording on the paired tablet, meters on the console from the socket, sealed (controller run 23:12) |
| C. Implementation | 93 (W71 web Storage and Network & Time) | done | D155 (controller run 23:22) |
| C. Implementation | 92 (W70 web Devices) | done | D156 (controller run 23:34) |
| C. Implementation | 89 (W67 mobile Start Session), 91 (W69 web Evidence) | done | D157, D158 (controller runs 23:38, 23:40) |
| C. Implementation | 88 (W66 mobile Home and More) | done | D159 (controller run 23:50) |
| C. Implementation | 100 (W78 mobile Devices) | done | D160 (controller run 00:04) |
| C. Implementation | static-scan slot (F W3-3) | done | D161 |
| C. Implementation | 96 (W74 mobile Evidence) | done | D162, D163 (device re-run passed) |
| C. Implementation | M1 (mobile consolidation) | done | D164 (controller run 00:28); follow-up in flight |
| C. Implementation | W0 (web consolidation) | done | D165 (controller run 00:48); reporter move in flight |
| C. Implementation | W0 follow-up (reporter to `lib/`), M1 follow-up | done | D166 |
| C. Implementation | 101 (W79 mobile Storage and Network & Time), 102 (W80 mobile Operator Audit) | done | D167, D168 (controller run 01:14) |
| C. Implementation | 94 (W72 mobile Finalization / Summary / Sessions) | done | D169 (controller run 01:21); hub follow-up and the runtime resync fix in flight |
| C. Implementation | 90 (W68 mobile Session Monitor) | done | D170 (controller run 01:25); runtime banner fix queued to the runtime's writer |
| C. Implementation | 99 (W77 web Users & Roles) | done | D174 (controller run 02:04, web 93 / 1,242) |
| C. Implementation | 95 (W73 mobile Recovery), 97 (W75 web Security & Audit) | done | D175, D176 |
| C. Implementation | 104 (W82 mobile Settings) | done | D177: CPM1-1 and CPM1-2 closed; all ten mobile page rows done |
| C. Implementation | 98 (W76 web System and Demo Control) | done | D178 (controller run 02:24) |
| C. Implementation | 103 (W81 web Paired Devices) | done | D179 — **all twenty page rows W63–W82 done** |
| C. Implementation | M2 (closing mobile round) | done | D180; follow-up L-1 / L-2 (Login's link visuals) in flight |
| C. Implementation | M2b (Login's link visuals) | done | D181 |
| C. Implementation | W1 (closing web round) | done | D182; its two test files (DC-3) in flight |
| C. Implementation | W1 follow-up (DC-3), 105 (W83 phase 1: the gap ledger, read-only) | running — 2 in flight | then W105 checkpoint commit 2, then W83 phase 2 after the rulings | then W105 checkpoint commit 2; closing mobile round (one read-only helper) before W93 | then W105 checkpoint commit 2 |
| C. Implementation | queue after wave 4 | pending | page rows W66–W82 (mobile after M0) → 105 (W83 close-out, 9 files still carry `CONTRACT-GAP-*`, KI-18 still in `core-api.ts:601`) → 106 (W84) → 108 (W86 README, carries the four-tab sentence of D144) → the static-scan slot (F W3-3) → CPS1-9 at a quiet restart and the W15 lock re-probe (needs the user's finger) |
| D. Verification | — | pending | |
| E. Close | — | pending | |

## Controller pre-screen evidence (read-only, 2026-10-04)

- Git: branch `main`, HEAD `33e4c95` (baseline); the predecessor task's final commit (its step 66) never ran — the previous session ended while it was starting. Working tree: 967 untracked, 32 modified, 1 deleted. Step 66 is re-delegated now so this task starts from a committed baseline.
- Toolchain: node v26.8.2, Homebrew present. **Missing:** `psql`, `postgres`, `pg_ctl` (no PostgreSQL on the host). `docker` CLI exists at `/opt/homebrew/bin/docker` (daemon state not probed; Docker is not used without the user's explicit OK — predecessor rule).
- Ports: nothing listens on 4400, 5173–5178, 8081 or 5432. The predecessor's manual-test servers (mock-core, Vite, Metro) are gone — the host session ended.
- Emulators: `adb` cannot start its daemon inside the sandbox; device state not probed yet.
