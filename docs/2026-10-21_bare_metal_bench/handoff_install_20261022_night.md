> **[SUPERSEDED 2026-11-03]** Dokumen ini era Docker/simulasi dan tidak lagi akurat; handoff resmi: docs/2026-10-21_bare_metal_bench/handoff_20261103_komprehensif.md

# HANDOFF - DEMS bench .73 install, paused 2026-10-22 ~22:00 WIB

Controller: Claude Code on the Windows workstation over SSH alias `dems` (key `~/.ssh/id_gsp_dems`). Decisions D29-D34 in `decisions/decisions.md`; trail in `status_tasks.md`.

## Done tonight
- R-FLEX verification: row 115 (0 failures only in the R-FLEX tree vs a pre-R-FLEX Linux baseline), 116 CAUTION 0 blocking, 117 CAUTION (M-5 accepted, M-6 -> Wi-Fi search answers admitted), 118 F1 fixed. Fix rows 142, 143, 144.
- Gate G-RF passed on the user's word (D33). Commit c1e46f81 on task4/input-av-core-port (local only, R-FLEX only; task-4 LCD work still uncommitted). RB-1 diff + SHA256SUMS in `~/Desktop/DEMS-progress-20261022/rflex-restore-20261022/`.
- Install rows done: 121, 20, 21, 123, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32 (N/A), 33, 34, 35, 37, 38, 39, 40, 41, 42, 43, 44, 45, 122. Artifacts `implementation/01..25, 69, 70`, `initialization/01_env_check.md`.
- Runbook defects found and handled (each in its row file): row 121 umask -> tree modes (26), apport resets core_pattern (33), nft prints skuid as uid (35), PGDG short-id collision (39, D34), pg_conftool quoting of listen_addresses (40), ss peer-column false positive (122).

## State now
- Running: postgresql@18-main (127.0.0.1:4432), dems-console (127.0.0.1:5173), dems-loopback-rule. dems-core.service installed, disabled, not started.
- ufw INACTIVE (D34 (2) "Tunda"). Watchdog no-reboot flag present.

## Resume order
1. Row 36 (HIL): ask the user again for ufw; R0-R8 per runbook (two 3702 rules, D33 M-6).
2. Row 46 gate G1 (verifier) -> row 47 reboot (allowed by D34 (3) once G1 passes).
3. Rows 48-53 (SIMULATED first boot, console forward, user unassigns slots and switches STT off in the console, gate G2).
4. Rows 54-57 need the USER at a terminal (operator passwords, production key id) - by product rule no agent types them.
5. Row 58 REAL_PRODUCTION boot; then D31 acceptance: every camera on the camera LAN and on Wi-Fi appears in the console's camera search list (no camera login needed).

## Leftovers outside the install (dev verification only; remove on the user's word)
`~/.local/dems-dev` (Node for tests), `~/dems-baseline-r115` and `~/dems-commit-check` (git worktrees of DEMS-source), `~/dems-rb1.*`, `~/dems-dev-logs`, `~/Desktop/DEMS-source/node_modules` and `.data` (dev PostgreSQL cluster, stopped, generated dev passwords inside, mode 700).

## Update 2026-10-22 ~23:00
Done since: row 36 (ufw active; D35, D36), row 46 G1 PASS after D37 (postgres shell nologin), row 47 reboot ok, row 48 SIMULATED boot ok, row 49 forward ok.
Now: Core running SIMULATED on 127.0.0.1:4420 (unit started, still disabled), console forward from the Windows workstation (terminal tab "DEMS console forward"). Next: the USER does rows 50-51 in the console with Data mode = Live (D38); then the controller runs 52 (stop Core, db:status), 53 (G2); then rows 54-57 need the user at a terminal.

## Update 2026-10-22 ~23:05 - G2 PASS
Rows 50-51 done by the controller via the console's demo-operator picker on the user's word (D39), row 52 Core stopped + db:status OK, row 53 G2 PASS (`gateway_check/02_gate_pre_production.md`). Console forward stopped.
Next: rows 54-57 need the USER at a terminal on .73 or over `ssh -t dems` from the workstation: 54 attended check of the hidden prompt, 55-56 `operator:set-password` (each operator types a NEW password; the seeded demo password is refused at the production boot), 57 `evidence:production-key` (installation id typed exactly as in the env, DEMS-BENCH-01). The agent never types these. Then row 58 REAL_PRODUCTION boot and the D31 camera-list check.

## Update 2026-10-23 ~08:45 - test mode (D41, D43)
The Core runs SIMULATED with DEMS_DEMO_CONTROLS=1 for the team's console tests; slots CAM-01/CAM-02/MIC-01/MIC-02 assigned and STT on again. Before REAL_PRODUCTION: remove DEMS_DEMO_CONTROLS from /etc/dems/core.env, redo rows 50-51, then rows 54-58. Camera search exists only in real capture.
