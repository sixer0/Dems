# DEMS deployment check on .73, 2026-10-22 16:10 WIB

Read-only, after the Wi-Fi fix reboot. No secret values are recorded here.

## Deployment state
- No DEMS deployment is running. Docker was removed on 10-21 (01_backup_and_docker_removal.md); the bare-metal install is not started (status_tasks.md pause point).
- Install folder ~/DEMS-Linux-Docker-LCD-20261019-amd64-unverified intact. `.env` still says capture real + DEV_SOURCES=1 + demo 0 + DEMS-BENCH-01 (REAL_DEVELOPMENT). The install log ends "install exit 0" from the 10-20 SIMULATED install.
- Docker leftovers: /var/lib/docker 70 MB with volumes dems_dems-{data,logs,pgdata}; /var/lib/containerd 2.3 GB. Both still kept, per the user's rule.
- The 01 "Open" items are closed by the reboot: iptables has 0 rules, docker.sock is gone, docker0 is absent, and ip_forward / all.forwarding / ipv6 forwarding are 0.
- HOST-21 PASS: `dpkg -l` shows only `rc containerd.io`, `rc docker-ce` (config kept), no `ii` (rule text: HOST-PROFILE-UBUNTU-24.04.md:83).

## Backups
- Host ~/dems-backup-20261021: `sha256sum -c SHA256SUMS` 0 failures. Mac .data/bench-backup-20261021: `shasum -c` all OK.
- vol-dems_dems-data holds signer/ (production key), signer.dev-backup/, credential-store/ (1 camera credential key), handover/, pg.env and capture-worker-boot.jsonl. It holds NO media files.

## Findings
| # | Finding | Root cause / evidence | Impact | Action |
|---|---|---|---|---|
| D1 | The dev key and the production key share the key id CORE-KEY-EVSIGN-01. Dev: O=DEMS Core, OU=DEVELOPMENT KEY - NOT FOR PRODUCTION, sha256 21:BB:A4:1D... Production: OU=Evidence signing DEMS-BENCH-01, sha256 9F:90:A2:0A... (openssl x509 on the backup certs) | evidence:dev-key ran first at 09:09Z with the default id. evidence:production-key then wrote the same id at 09:42Z, and the dev key was moved aside to signer.dev-backup | No evidence was signed: the volume has no media and the worker boot log has 9 lines with no session (start, then stop on input_ended). Not verified in the DB: no pg_restore on the Mac | For the bare-metal install, do NOT carry over signer.dev-backup. Provision a fresh production key in the new data dir (HANDOFF §7 already says so) |
| D2 | A USB microphone is now attached: HANMUS "BOMGE USB AUDIO" (3347:2430), capture card 1, USB port 1-1. It was not there on 10-21 | It states no USB serial (`/sys/.../serial` absent) | DEMS card identity (card-listing.ts:86-107) falls back to the USB port: the mic must stay in port 1-1. Only 1 mic is present; the 4-slot rule needs 2 MIC slots. Whether this one card can fill both is not determined | Confirm with the user: a second mic, or which port it lives in |
| D3 | ALSA card numbers shifted: USB mic = card 1, ALC897 moved to card 2 (10-21: ALC897 was card 1) | Kernel enumeration order changes with USB devices | Low: DEMS reads /proc/asound at runtime and writes the hw:CARD index fresh (alsa-config.ts:143). Verify at the first production boot | none now |
| D4 | Bare-metal prerequisites are still absent: node, ffmpeg, postgresql server, build-essential, service user dems-core, iputils-arping (HOST-18), nftables + dems-loopback-rule.service, and ufw inactive | Not installed yet (blueprint rows 20+) | REAL_PRODUCTION boot checks would refuse (host-checks.ts:108, 190-196) | Blueprint wave 1 |
| D5 | Present and fine: sleep/suspend masked, NTP synchronized, disk 5% used, camera LAN up with .101/.102/.103/.117 answering on 554 | - | - | - |
| D6 | Wi-Fi outage and fixes | 02_host_wifi_outage_20261022.md | management path hardened | done |

Earlier findings (DEMS-TEMUAN-20261021.md A-F) still hold. The source code confirms them, and the host state matches them except E: one USB mic now exists (D2).
