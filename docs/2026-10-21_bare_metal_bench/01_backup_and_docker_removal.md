# Bench .73: backup and Docker removal (HOST-21), 2026-10-21

The user chose bare-metal on 192.168.0.73 and ordered: back up volume dems-data and run pg_dump first, then remove Docker per HOST-21. The user had also granted the agent full control of the host (passwordless sudo). That is why this step was run by the agent and not by the user, as HOST-PROFILE §1 otherwise states.

## Backup (before removal)
- Location on the host: `~/dems-backup-20261021/` (mode 700). Off-host copy: `.data/bench-backup-20261021/` on the Mac (git-ignored). `shasum -c SHA256SUMS` passes on both copies, 10 files.
- Contents:
  - `dems_demo.pgdump`: custom-format dump of the running DB. `pg_restore -l` reads it, with 494 TOC entries and 49 TABLE DATA.
  - `pg_globals.sql`: the roles.
  - `vol-dems_dems-{data,logs,pgdata}.tar.gz`: raw volumes taken with the stack stopped, numeric owners kept. `data` includes `signer/` (production key CORE-KEY-EVSIGN-01), `signer.dev-backup/`, `credential-store/`, `handover/`, `pg.env` and `capture-worker-boot.jsonl`.
  - `installer-config.tar.gz`: `.env`, `.env.bak-simulated-20261021`, `.installed`, `secrets/`, `images.env` and `BUILD-INFO.txt`.
  - The earlier `dems-change-backup-20261021.sql`, the NM profile `dems-camera-lan.nmconnection`, the old `daemon.json`, and the list of Docker images.
- The backup holds the production private key and the DB passwords. Keep both copies private.

## Removal
- `./install.sh stop` stopped the containers. No volume was deleted.
- `apt-get remove`: containerd.io, docker-ce, docker-ce-cli, docker-buildx-plugin, docker-ce-rootless-extras, docker-compose-plugin. `remove` was used, not `purge`, and `autoremove` was not run, because git and pigz must stay.
- Kept on disk: `/var/lib/docker` (70 MB) and `/var/lib/containerd` (2.3 GB, which holds the images). Docker can be reinstalled from them. Delete them only on the user's word.
- `docker0` was deleted. Forwarding was set to 0 at runtime.

## Checks after removal
| Check | Result |
|---|---|
| HOST-21 `dpkg -l 'docker*' 'containerd*' 'libvirt*' 'wireguard*'` lines with `ii` | 0 (2 `rc` lines with config kept) |
| HOST-20 `ip_forward`, `all.forwarding`, `enp4s0/forwarding` | 0 0 0 (runtime only; persistent file C comes with `scripts/host/40-network-firewall.sh`) |
| dockerd/containerd processes | none |
| Listeners | 22 (SSH) and the system's loopback 631/53 only; 4420/4432/5173 closed |
| Network | wlp3s0 192.168.0.73, enp4s0 192.168.100.254/24 (camera LAN) unchanged |

## Open
- 15 iptables rules left by Docker stay until the next reboot. `/var/run/docker.sock` is a stale file.
- The DEMS stack is now down. The console is no longer reachable.
- Next is the bare-metal installation (Node 26.x, FFmpeg 9.0.2 from source, PostgreSQL loopback, the scripts in `scripts/host/` 10..95, then the first production boot per INSTALLER-NOTE §4). It needs its own blueprint before it starts.
