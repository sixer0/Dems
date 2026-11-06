---
task_id: 2026-10-21_bare_metal_bench
task_slug: bare_metal_bench
date: 2026-10-21
agent: request-translator
model_tier: default
status: translated
---

# Translated Tasks: Bare-metal installation of DEMS on bench host 192.168.0.73

## Intent

The user wants DEMS Core running directly on the Ubuntu 24.04 bench host 192.168.0.73 (no Docker), brought up the way the repository's own installer path prescribes: host profile, PostgreSQL on loopback, a seeded database, a `SIMULATED` first boot, the key and password commands, then a first `REAL_PRODUCTION` boot. The aim is to prove that path on a real host for the first time (INSTALLER-NOTE §6: "A `REAL_PRODUCTION` Core has never been started on a host"). This is a bench test on a seeded database. No real examination is recorded (INSTALLER-NOTE §2.9).

The user asked for a blueprint with full orchestration (D4). The blueprint gets approved first, then the work runs. The agent performs the host steps (D3), except where a password has to be typed.

**Scale category**: Administration / deployment (installation on a host), with verification on the host.

## Goals

1. Apply the host profile `HOST-01` to `HOST-49` on .73 so that every took-effect check prints what the profile states (INSTALLER-NOTE §4 step 1; check `9A/H-01`). Items that belong only to the helper or to audio hardware are marked as not applicable, with the reason.
2. Set up PostgreSQL loopback-only with the two roles (`HOST-50`..`HOST-54`). Create, migrate and seed a new database (`HOST-55`). `db:status` exits 0 and the schema version is written down (steps 2-3).
3. Do a `SIMULATED` first boot on loopback. Unassign all four selector slots and switch STT off in the web console (steps 5-6; INSTALLER-NOTE §5, §2.11).
4. Provision a new production signing key for installation id `DEMS-BENCH-01`. Each operator password is set by a human (D6), the Supervisor first. Write the installation identity into the environment file with no development switch (step 7).
5. Do a first `REAL_PRODUCTION` boot (`DEMS_CAPTURE_MODE=real`) under the systemd unit `dems-core.service`. The log names the operation `REAL_PRODUCTION`. Any refusal is recorded with its code (step 8; check `9A/H-16`).
6. Adopt the 4 cameras on the camera LAN through the production console (step 10; check `9A/H-10`). The user types each camera password.
7. Write an evidence-backed record of every check (command plus output) and of every deviation, so that the next session can continue at step 11 once microphones exist.

## Primary Task

Bring DEMS Core up bare-metal on 192.168.0.73 through INSTALLER-NOTE §4 steps 1-8 and step 10, ending in a verified `REAL_PRODUCTION` boot with the cameras adopted. Steps 7a, 9, 11 and 12 are left out.

## Scope

### In scope
- **Host**: gsp-dems@192.168.0.73 (Ubuntu 24.04.1 x86_64). Access is by SSH key over Wi-Fi (wlp3s0). Camera LAN is enp4s0 192.168.100.254/24 with 4 cameras.
- **Repository inputs (read; run on the host)**: `scripts/host/HOST-PROFILE-UBUNTU-24.04.md`, `scripts/host/INSTALLER-NOTE-FIRST-PRODUCTION-BOOT.md`, `scripts/host/10-preflight.sh` .. `95-database.sh`, `scripts/host/host-profile-lib.sh`, `scripts/hardware-acceptance/HW-ACCEPTANCE-1-FRAME.md` .. `-3-*.md` (the PREP and 9A/H checks that apply).
- **On the host**: the service user and directories, Node 26.x, FFmpeg 9.0.2 built from source, the capture worker/relay/guard built against it, file B (netplan camera), file C (sysctl), ufw, the audio-access items as far as they apply without hardware, sleep/time, file G `dems-core.service` (the `ExecStart` form gets settled in 9A/H-16), PostgreSQL, the environment file, and a new data directory.
- **Source**: the tree at `~/Desktop/DEMS-source` (HEAD e05a1567 plus 32 uncommitted changes), placed in `/opt/dems/core` (assumption A6).
- **Task docs**: `/Users/gsp-budi/Documents/DEMS/docs/2026-10-21_bare_metal_bench/`.

### Out of scope
- Microphones: registering the inputs, filling the four slots, any session start, and checks `9A/H-07`, `9A/H-17` onward (steps 11-12). There is no physical microphone or USB audio interface.
- The address helper (steps 7a, 9; `HI-01`..`HI-10`; `9A/H-05`, `H-06`, `H-25`) and the input-av package. Nothing of the helper goes on the host, so the Core starts with `CAPTURE_HOST_ALIAS_HELPER_ABSENT`.
- The LCD backend as a systemd service. It is deferred because no panel is plugged in.
- STT engine provisioning: no `transcriber/host.json`.
- Restoring the Docker-era database (`dems_demo.pgdump`) or reusing its data directory or the key CORE-KEY-EVSIGN-01.
- Deleting `/var/lib/docker` or `/var/lib/containerd`, the `rc` package configs, or any backup member. Deletion only happens on the user's word, and under D7 the backups stay as they are.
- Closing security-review list A (A1-A9), recording real examinations, and handing the fingerprint to external receivers beyond recording it in the task docs.
- Committing or pushing the 32 uncommitted repository changes. That is a separate git decision of the user.

## Acceptance Criteria (to confirm at the blueprint gate, see A1)

| # | Criterion | Evidence |
|---|---|---|
| AC1 | Every applicable `HOST-01`..`HOST-49` took-effect check prints the profile's expected value. Each N/A item names its reason | command plus output per item |
| AC2 | PostgreSQL listens on `127.0.0.1` only. `db:status` exits 0 and its schema version is recorded | `ss -ltnp`, `db:status` output |
| AC3 | The `SIMULATED` boot log names `SIMULATED` and the listener is on `127.0.0.1` only. The selector shows 4 slots "not assigned", with one `CAPTURE_CONFIG_CHANGED` per action. STT is off | log lines, audit entries |
| AC4 | `operators that still have the demo password: 0` with exit 0. `evidence:production-key: OK` with exit 0. The certificate OU is `Evidence signing DEMS-BENCH-01` | terminal output, run by the agent, except the password-prompt lines, which are typed by the user |
| AC5 | `dems-core.service` starts the Core and the log names `REAL_PRODUCTION`. The `SYSTEM_BOOT` audit entry is present, with `addressHelperSocket: NOT_PRESENT` | `systemctl status`, journal, audit entry |
| AC6 | The 4 cameras are connected in the production console. The camera-LAN invariants hold: HOST-19 equivalent, HOST-20 forwarding `0 0 0` persistent across a reboot | console state, `ip`/`sysctl` output |
| AC7 | ufw is active and admits SSH only on the room network. No DEMS port is reachable from Wi-Fi | `ufw status verbose`, `ss -ltnp` |
| AC8 | Every deviation (D5-D7 plus any found on the way) and every refusal code is recorded in `decisions/decisions.md` and the final report | doc entries |

## Constraints

- **Installer path order**: INSTALLER-NOTE §4. A step whose expected result does not appear is stopped there, and the next step does not start.
- **Performers** (D3): the agent runs the host steps with passwordless sudo. The key and password commands run as `<service-user>`, never as root, with the Core stopped (§2.1, §2.13).
- **The agent never types, reads back, stores or logs a password or a secret.** That covers operator passwords, camera passwords and DB role secrets the user sets. No secret from `docs/2026-10-21_bench_deploy_findings/` (HANDOFF-DEMS-BENCH.md, DEMS-TEMUAN-20261021.md) is quoted or reused anywhere.
- **Installation id**: `DEMS-BENCH-01` is typed identically at the key prompt and in `DEMS_INSTALLATION_DEVICE_ID`. The reserved ids `DEMS-TEST-01`, `DEMS-IR-01` and `DEMS-JKT-07` are forbidden (§2.12).
- **Directory rule** (§2.10): every directory from `/` down to the data dir is owned by root or the service user and is not group- or world-writable.
- **Camera LAN isolation**: no gateway or DNS on enp4s0, and forwarding off (HOST-19/20/21).
- **No Docker or other forwarding software** gets reinstalled (HOST-21).
- **No emoji** in deliverables. snake_case docs under `/docs` only.
- Outward-facing or hard-to-reverse actions need the user's explicit confirmation: reboot, ufw enable, netplan apply on the camera port, `dropdb`, any deletion.

## Recorded Deviations (user decisions)

| Id | Deviation | From | Bound |
|---|---|---|---|
| D5 | Wi-Fi (room network, the agent's SSH path) stays up through PREP-08..PREP-9A/H-16. The `SIMULATED` first boot therefore does not happen "off the room network" | HW-ACCEPTANCE-1-FRAME PREP-08 / PREP-11; INSTALLER-NOTE §4 step 5 and the note "room network ... only after step 8" | ufw admits SSH only. The Core listens on `127.0.0.1` only |
| D6 | Operator passwords are typed over SSH in the user's own terminal (`ssh -t`), not at the host keyboard | INSTALLER-NOTE §2.5 | The agent never types a password. The attended prompt check (§2.4) is done on that SSH terminal |
| D7 | The signer private keys stay in both pre-task backup copies (`~/dems-backup-20261021` on the host, `.data/bench-backup-20261021` on the Mac) | INSTALLER-NOTE §2.8 | Bench key, never used to seal. The new data dir's `signer/` is excluded from any new backup |

## Assumptions Made (proposed defaults, to confirm at the blueprint gate)

| Id | Assumption | Reason |
|---|---|---|
| A1 | Acceptance without microphones means AC1-AC8: a passing `REAL_PRODUCTION` boot plus the cameras adopted. Steps 11-12 stay open | There is no microphone, so the 4 slots cannot be filled and no session can start (INSTALLER-NOTE §5) |
| A2 | The LCD backend is deferred and not installed as a systemd service in this task | No LCD panel is plugged in |
| A3 | PostgreSQL 18 is installed from the PGDG apt packages, loopback-only | HOST-50..54 is a proposal with open choices. PGDG is the maintained source for current majors on Ubuntu 24.04 |
| A4 | STT is switched off in the `SIMULATED` console. No transcriber host file is provided | Avoids `TRANSCRIBER_CONFIG_UNRESOLVABLE` / `CPU_LOCAL_RUNTIME_MISSING` (§2.11) with no engine on the host |
| A5 | A new key with installation id `DEMS-BENCH-01` goes in a new data directory. The Docker-era data dir and key are not reused | A key from another installation is refused (`CAPTURE_SIGNING_KEY_INSTALLATION_MISMATCH`), and the bench should not inherit the Docker-era state |
| A6 | The source comes from `~/Desktop/DEMS-source` and is placed in `/opt/dems/core`, as the tree at HEAD e05a1567 plus its 32 uncommitted changes. Dependencies are installed there | This is the tree already on the host. The path follows the host profile |
| A7 | No address helper and no input-av on the host: none of the helper's files, socket or unit | "All or none" rule. The helper is not released before `9A/H-06` (INSTALLER-NOTE §4 notes) |
| A8 | The existing NetworkManager profile `dems-camera-lan` (enp4s0 192.168.100.254/24) is kept as the HOST-19 equivalent instead of netplan file B. Its took-effect checks must pass (one address, no default route via enp4s0) | It already works with the 4 cameras. Replacing it risks the camera LAN with no gain. Recorded as a deviation of form, not of the invariant |
| A9 | The ufw rule that allows SSH is added before `ufw enable` | Prevents locking the agent out over Wi-Fi (D5) |
| A10 | Reboot the host once before PREP-08 (the `SIMULATED` boot), with the user's confirmation | Clears the 15 iptables rules Docker left and the stale `/var/run/docker.sock`. Proves that HOST-20 file C and the other persistent settings survive a reboot |

## Open Items

- **OI-1 (O2 follow-up)**: who types the three seeded operators' passwords. Either the user types all three over `ssh -t` (bench deviation that adds to D6), or each operator is present. INSTALLER-NOTE §2.2 says each operator types their own.
- **OI-2**: how the user reaches the web console. The Core listens on `127.0.0.1` and ufw admits SSH only, so the console is needed for step 6 (unassign, STT off) and step 10 (camera passwords). The proposal is an SSH local port forward from the Mac. This is an open point of the profile (INSTALLER-NOTE §6). The blueprint must name the method.
- **OI-3**: the organisation name typed at the `evidence:production-key` prompt. The user supplies it. It is not a secret.
- **OI-4**: the DB role secrets (HOST-50..54) are set by the user. The blueprint must say where the user types them and how the environment file gets them without the agent seeing them. The alternative is that the user explicitly allows the agent to generate them on the host into a mode-600 file it never prints.
- **OI-5**: the `ExecStart` form of `dems-core.service` is unsettled (HOST-PROFILE file G). It is settled and recorded in `9A/H-16`.
- **OI-6**: the credential-store backup policy (§2.8, "not decided by this note") for the new data dir. It is a user decision before any real installation and can be deferred for the bench.
- **OI-7**: the 32 uncommitted changes in the deployed tree. The deployed build is not reproducible from a commit. Record the `git status` and diff hash at deploy time, or commit first (the user's call).

## Source Documents

| Path | Type | Purpose | References |
|---|---|---|---|
| scripts/host/INSTALLER-NOTE-FIRST-PRODUCTION-BOOT.md | doc | authority for the path | §2.1-2.13, §4 steps 1-12, §5, §6 |
| scripts/host/HOST-PROFILE-UBUNTU-24.04.md | doc | host state items and checks | HOST-01..56, files B, C, G, §5 |
| scripts/host/10-preflight.sh .. 95-database.sh, host-profile-lib.sh | scripts | print the profile items (print-only by default) | all |
| scripts/hardware-acceptance/HW-ACCEPTANCE-1-FRAME.md (+ -2, -3) | doc | PREP-01..14, 9A/H checks, list A/B | PREP-04, 07-11, 13; H-01, H-10, H-16; §11 item 8 |
| docs/2026-10-21_bare_metal_bench/01_backup_and_docker_removal.md | task doc | pre-task state | backup, removal, open points |
| docs/2026-10-21_bench_deploy_findings/* | handoff | Docker-era findings | referenced by section only. Contains plaintext secrets, never quoted |

## Output Requirements

- **Format**: md (no format keywords in the request; not a research task, so the output-format question does not apply)
- **Destination**: `/Users/gsp-budi/Documents/DEMS/docs/2026-10-21_bare_metal_bench/` phase folders (CLAUDE.md §3), final `report/report.md`
- **Style**: evidence per check (command plus output), Tier 3 for logs and inventories, Tier 1 for the plan and specs

## External Research Scope

No external research dimensions detected in the request. This task is internal-only. Package sources (Node 26.x, PGDG PostgreSQL 18, FFmpeg 9.0.2 source) get confirmed during host readiness. That is not market or vendor research.

## History Relevance Assessment

| Reference | Relevance | Notes |
|---|---|---|
| docs/2026-10-21_bare_metal_bench/01_backup_and_docker_removal.md | Direct | Current host state: Docker removed, leftover iptables rules, backup locations |
| docs/2026-10-21_bare_metal_bench/decisions/decisions.md | Direct | D1-D7 bind this task |
| scripts/host/INSTALLER-NOTE-FIRST-PRODUCTION-BOOT.md, HOST-PROFILE-UBUNTU-24.04.md, 10..95 scripts | Direct | The procedure being executed |
| docs/2026-10-21_bench_deploy_findings/ | Indirect | Docker-era lessons on the same host. Contains secrets: section references only |
| docs/2026-10-19_lcd_installer/ | Indirect | LCD service install, deferred (A2) |
| docs/2026-10-12_input_av_core_adapter_plan/status_tasks.md | Indirect | Origin of the slot remedy and boot checks (impl 029/030, test 208). The input-av hardware is out of scope |

### Important Notes From History
- Nothing in the host profile has been verified on Ubuntu 24.04, and a `REAL_PRODUCTION` Core has never started on a host (INSTALLER-NOTE §6). Expect first-run findings and record each one.
- A seeded DB fills the slots with generated sources, so a `REAL_PRODUCTION` boot fails with `DEV_SOURCE_WITHOUT_FLAG` unless the slots are unassigned first (§5).
- A partly present helper refuses the start, so either none of it goes on the host or all of it does.
- The forwarding settings are runtime-only until file C is installed (01_backup_and_docker_removal.md).

### Lessons from History
- The Docker-era handoff wrote passwords in plain text. This task writes none.
- Memory: run one heavy runner at a time on the host, and gate in the shipped launch form (the systemd unit, not an ad-hoc start).

## Dependencies

- SSH key access to .73 and passwordless sudo (granted 2026-10-20).
- Internet on .73 over Wi-Fi for apt (Node, PGDG) and the FFmpeg source.
- The user is available for: the blueprint approval, the reboot/ufw confirmations, typing passwords (D6, OI-1, OI-4) and the camera passwords, and OI-3.

## Notes

- This file does not hold execution order or agent assignments. Those belong to `identification/02_structured.md` (task-architect).
- No password or secret has been copied from any handoff file into this document.

---
*Generated: 2026-10-21*
*Last Updated: 2026-10-21*
