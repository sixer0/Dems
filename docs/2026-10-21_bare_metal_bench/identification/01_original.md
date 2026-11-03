---
task_id: 2026-10-21_bare_metal_bench
task_slug: bare_metal_bench
date: 2026-10-21
agent: request-translator
status: original
---

# Original Request: Bare-metal installation of DEMS on bench host 192.168.0.73

## User Request

> Ya, buat blueprint instalasi bare-metal DEMS di .73 dengan orkestrasi penuh

(English: "Yes, make the blueprint for the bare-metal installation of DEMS on .73, with full orchestration.")

## Request Metadata

- **Task Title**: Bare-metal installation of DEMS on bench host 192.168.0.73
- **Date Received**: 2026-10-21
- **History References Provided**: Yes
  - docs/2026-10-21_bare_metal_bench/01_backup_and_docker_removal.md
  - docs/2026-10-21_bare_metal_bench/decisions/decisions.md (D1-D4, open O1, O2)
  - docs/2026-10-21_bench_deploy_findings/HANDOFF-DEMS-BENCH.md (contains plaintext secrets: referenced by section only, never quoted)
  - docs/2026-10-21_bench_deploy_findings/DEMS-TEMUAN-20261021.md (same caution)
  - scripts/host/HOST-PROFILE-UBUNTU-24.04.md
  - scripts/host/INSTALLER-NOTE-FIRST-PRODUCTION-BOOT.md
  - scripts/host/10-preflight.sh .. 95-database.sh, host-profile-lib.sh
  - docs/2026-10-19_lcd_installer/ (plan.md, verification.md)
  - docs/2026-10-12_input_av_core_adapter_plan/status_tasks.md

## Raw Context

Preceding user decisions in the same conversation (verbatim):

- "Lanjut bare-metal di .73: backup volume dems-data dan pg_dump dulu, lalu copot Docker sesuai HOST-21" (done; see 01_backup_and_docker_removal.md).
- Earlier: "kamu saja yg full control host dems" (the user granted passwordless sudo on the host to the agent).

Host facts the controller verified on 2026-10-21 (as passed by the controller):

- Ubuntu 24.04.1 x86_64. Docker removed (HOST-21: 0 `ii` lines). Forwarding 0 at runtime.
- No Node.js installed.
- Source tree at `~/Desktop/DEMS-source`: git, HEAD e05a1567 plus 32 uncommitted changes, no node_modules.
- Camera LAN on enp4s0 192.168.100.254/24 with 4 cameras.
- No physical microphone or USB audio interface. No LCD panel plugged in.
- Wi-Fi DHCP .73. Access is by SSH key from the Mac.

Points the controller asked to surface:

- Target operation is the REAL_PRODUCTION bench boot of the INSTALLER-NOTE: a bench test on a seeded DB, not real examinations.
- Without microphones the 4 slots cannot be filled, so no session can start. Is "REAL_PRODUCTION boot passes + cameras assigned" enough as the acceptance for now?
- LCD panel: install the LCD backend as a systemd service now, or later?
- Performers: per D3 the agent runs the steps, except password typing by the user/operators.
- Open O1 (signer private key in the backup) and O2 (operator passwords).

---
*Generated: 2026-10-21*
