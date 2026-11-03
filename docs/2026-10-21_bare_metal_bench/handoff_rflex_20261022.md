# HANDOFF — DEMS bare-metal bench + R-FLEX, for the agent ON host .73

Paused 2026-10-22 ~18:30 WIB on the user's word: "stop progres, pindahkan semua progres ke remote host di desktopnya tempat sourcecode beserta dengan handoff progress saat ini" and "tujuannya pekerjaan ini akan dilanjutkan oleh agent yang ada di remote host".
Written by the previous controller (Claude Code on the Mac). **You are the next controller, running locally on gsp-dems@192.168.0.73** (Ubuntu 24.04.1, kernel 7.0.0-38, Ryzen 5 5600G, 14 GiB).

- Repo on this host: `~/Desktop/DEMS-source` (git, branch `task4/input-av-core-port`, HEAD e05a1567, **nothing of this work is committed**).
- Task folder: `~/Desktop/DEMS-source/docs/2026-10-21_bare_metal_bench/` (this file is at its root; a copy is at `~/Desktop/HANDOFF-RFLEX-20261022.md`).
- No secret value is in this file or in the task folder. Plaintext passwords exist only in the OLD files `~/Desktop/HANDOFF-DEMS-BENCH.md` / `DEMS-TEMUAN-20261021.md` (user ruling I-11: restrict or delete them only on the user's word; never reuse those passwords).

## 0. How the user works (keep these)

- Language: Bahasa Indonesia with the user; technical identifiers in English. Short, concrete reports.
- Orchestrated task with gates: blueprint approval, HIL rows, decision log. Every user ruling goes into `decisions/decisions.md` (next id **D29**) the moment it happens, quoted verbatim. Status lines go to `status_tasks.md`.
- Never claim done without fresh evidence (command + output). Never fabricate. Unknown is a valid answer.
- Hard-to-reverse or outward actions need the user's explicit word: commit (row 120), reboot, ufw enable, apt purge (banned), deleting anything. HIL rows: you prepare, the user types (passwords, installation name), you verify.
- Never touch PC 192.168.0.72. Never restart NetworkManager (Wi-Fi is the only admin path). Do not remove `/var/lib/docker`, `/var/lib/containerd`, `~/dems-backup-20261021`.
- Parallel sub-agents are welcome, but one writer per file, Edit-tool-style small edits on shared files, targeted tests only, `--maxWorkers=2`, one heavy test runner at a time. Full rules: `delegation_progress/code_wave_rules.md`.

## 1. Where things stand

| Part | Rows | State |
|---|---|---|
| Blueprint rev 2 + R2.1 + R2.2 | — | approved: D8, D12, D16 (row-96 sheet, all recommendations), D17/D25 (MINOR) |
| Install research / specs / runbook / install-row refinement | 1-19 | done (`masterplan/01_specs*.md`, `masterplan/02_plan.md`) |
| R-FLEX research, specs, decision sheet, refinement | 80-97 | done (`masterplan/01_specs_rflex*.md`, `decisions/02_rflex_decision_sheet.md`) |
| R-FLEX code | 98-114, 129-141 | **done** (98 = N/A, no migration) — reports `implementation/50..87_*.md` |
| R-FLEX regression | 115 | **stopped mid-report**: the 9 suites ran on the Mac, report not written (§3) |
| R-FLEX verification | 116-118 | not started |
| Gate G-RF (HIL) | 119 | not started |
| Commit (HIL) / stage tree on host | 120 / 121 | not started; commit only on the user's word |
| Bare-metal install on this host | 20-79, 122-128 | not started; held behind G-RF (D10 ruling 3) |

Blueprint: `identification/02_structured.md` (141 rows + Execution Profile). Decisions D1-D28: `decisions/decisions.md`. Agent trail: `delegation_progress_report.md`, `delegation_progress/row_N_*.md`, `file_claims.md`, `file_requests.md`.

## 2. What R-FLEX changed (user rulings D10/D11/D16)

- **USB audio:** no port lock. Identity = USB id + serial where stated, else the single unit of that model (`MODEL_SHARED`/`NOT_TELLABLE` when two serial-less units of one model are plugged). One physical card -> one DEMS microphone (op 99 refuses `AUDIO_CARD_ALREADY_BOUND`); `release: true` moves the holder (audit `RELEASED` then `REENABLED`). PRIMARY<->STANDBY move = one op-78 edit. The bench BOMGE mic (card 1, port 1-1, no serial) opens after a port move.
- **ONVIF cameras:** typed probe + stored camera are global over eligible on-link interfaces; residual guards RG-1..RG-14 kept; new refusals `NO_SOURCE_INTERFACE`, `SOURCE_INTERFACE_AMBIGUOUS`; scan and set-IP stay bound to the camera interface (enp4s0). Security posture CAUTION, risk accepted by the user (D11). Known limit D26 (holder order), open risk RR-2 (DHCP address reuse could send a camera credential digest to another device; host docs now require static addresses/reservations).
- **Docs/scripts:** `scripts/host/HOST-PROFILE-UBUNTU-24.04.md`, `INSTALLER-NOTE-FIRST-PRODUCTION-BOOT.md` (row 113), `40-network-firewall.sh` + U-RF3 pin (row 114).
- Pre-existing reds NOT from R-FLEX (task-4 uncommitted LCD work): 4 pins in `apps/core-server/src/capture/__tests__/static.test.ts` — the user ruled "leave red, re-pin when the LCD work is committed" (D28).

## 3. Row 115 partial results (logs: `test/04_rflex_regression_logs/`, run on the Mac)

| Suite | Result |
|---|---|
| s1 typecheck / s2 lint | rc 0 / rc 0 |
| s3 shared | 2929/2929 pass |
| s4 core-server unit | 27 fail / 9006 pass: 4 = D28 pre-existing; **22 `card-listing.test.ts` + 1 `usb-audio-macos.test.ts` = OPEN R-FLEX REGRESSION** (both pass 76/76 on the pre-R-FLEX baseline, `b5_audio_unit.log`); likely owner row 107 (audio identity) or 131 (matcher) |
| s5 core-server db | 3 fail / 3346 pass — first-full-session r89_door_late + production-key-proof x2: **also fail on the baseline** (`b1`-`b4`) -> pre-existing |
| s6 core-web | 1 fail / 2504 pass — box-check CW-01: **also fails on the baseline** (`b6`) -> pre-existing |
| s7 mobile, s8 host scripts, s9 dev e2e | pass |

## 4. THIS HOST is not yet a dev box — read before running anything

- **No Node, npm, PostgreSQL, build tools, ffmpeg** on this host (`03_deployment_check_20261022.md`, `research/01_explore_host_survey.md`). Tests cannot run here until Node 26.12.1 is installed and `npm ci` runs — which are install rows 24-27 of the runbook. Do not improvise a different Node; follow `masterplan/02_plan.md` (signature-checked Node archive, `npm ci --ignore-scripts` as root per SEC-NPM).
- The Mac dev setup used `embedded-postgres` (darwin binary); on Linux `npm ci` pulls the linux package. DB tests start the project PostgreSQL on 127.0.0.1:4432 via `npm run pg:start` (`.data/postgres`).
- Therefore the cleanest order on this host: (a) the user decides whether to finish R-FLEX verification here (needs the dev toolchain: Node + npm ci + build tools, which the install rows bring anyway) or on another dev machine; (b) ask before installing anything — U-RF6 (no host prep beside R-FLEX coding) is the user's rule and install row 20 is held behind G-RF.
- Commands in `masterplan/02_plan.md` are written as `ssh ... gsp-dems@192.168.0.73 '<cmd>'` from the Mac; on this host run `<cmd>` locally.
- Locks used by the rows: `~/Desktop/DEMS-source/.data/locks/{heavy-host,db-runner}.lock` with `flock` (Linux) instead of macOS `lockf`.
- Wi-Fi is the only admin path. Watchdog `dems-wifi-watchdog.timer` is active; set `/etc/dems-wifi-watchdog.noreboot` right after row 21 (I-17) and while recording.

## 5. Resume steps (in order)

1. Read this file, `status_tasks.md` (last rows), `decisions/decisions.md` (D16-D28), `delegation_progress/code_wave_rules.md`, `identification/02_structured.md` rows 115-128.
2. Ask the user §4 (a): where to finish R-FLEX verification; record the answer as D29.
3. Fix the open regression (card-listing.test.ts 22 + usb-audio-macos.test.ts 1) as a new fix row owned by row 107/131's area; re-run only those files.
4. Row 115: write `test/04_rflex_regression.md` from the logs + the re-run.
5. Rows 116-118 (verifier, security-review incl. RR-2, senior-code-reviewer) in parallel.
6. Row 119 G-RF (HIL): user confirms posture + residual guards.
7. Row 120 (HIL): commit only on the user's word; write `rflex-only.diff` + SHA256SUMS line; keep task-4's `DeviceHealthResponse` openapi change (D21).
8. Row 121: the tree is already on this host (§6) — verify by hash, do not re-copy blindly.
9. Install rows 20-79, 122-128 per `masterplan/02_plan.md`.

## 6. Transfer record (2026-10-22)

- Before the copy, the host repo was archived to `~/Desktop/DEMS-source-before-rflex-20261022.tar.gz`.
- Copied from the Mac working tree into `~/Desktop/DEMS-source`: every tracked modified file and every untracked non-ignored file (incl. this task folder and logs). Not copied: `.git` changes (none exist), node_modules, `.data`, `graft/`, `release/`, `docs/2026-10-21_bench_deploy_findings/` (plaintext passwords).
- Row-80 restore point copied to `~/Desktop/DEMS-progress-20261022/rflex-restore-20261022/` (rollback R-FLEX-R-B base; a full restore must exclude `docs/*`).
- Hash verification: `transfer_20261022.md` next to this file.
