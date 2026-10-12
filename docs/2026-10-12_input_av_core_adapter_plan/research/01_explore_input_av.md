---
task_id: 2026-10-12_input_av_core_adapter_plan
row: 1
date: 2026-10-12
agent: explore (reasoning tier)
scope: apps/input-av/ source and docs (nvr/**/*.py, nvr/web/index.html in part, scripts/, deploy/, README.md, docs/*.md)
narrative_tier: 2
status: complete
---

# Exploration Report: input-av hardware input logic (row 1)

## 0. How to read this report

- All paths are relative to `apps/input-av/` unless they start with another root. A citation `nvr/recorder.py:148-149` means `/Users/gsp-budi/Documents/DEMS/apps/input-av/nvr/recorder.py`, lines 148 to 149.
- Facts only. No verdict on what the Core should adopt (that is row 7).
- Each finding gives: what was found, why it matters to the port, how it was verified (always: the cited lines were read in this pass on 2026-10-12, unless a Grep is named).
- Where a value is derived from the code (an example command for a concrete device), it is marked DERIVED. Where a statement is not in the source, it is marked HYPOTHESIS.

### What was read and what was not

| Read in full | Read in part | Not opened |
|---|---|---|
| All 31 `.py` files under `nvr/` (23 top level, 8 under `routers/`; count by `find nvr -name '*.py' \| wc -l` = 31) | `nvr/web/index.html` lines 560-661 (audio calibration UI) plus one Grep for endpoint names | Everything under `data/` (not listed, not opened, not read) |
| `README.md`, `docs/SERAH-TERIMA.md`, `docs/UJI-LAN-KANTOR.md`, `docs/SETUP-AWAL.md` | `docs/API-TABLET.md` (Grep for codec, preview and audio terms only) | `.env` (none read; `.env.example` was read, it holds no secret) |
| `scripts/install.sh`, `scripts/start-lan-test.sh`, `scripts/dems-netalias`, `scripts/uji/*.py` (3 files) | | `bin/mediamtx` (binary), `.venv/`, `.claude/` inside input-av |
| `deploy/mediamtx.yml`, `deploy/dems-nvr.service`, `deploy/dems-mediamtx.service`, `deploy/Caddyfile`, `requirements.txt`, `.env.example`, `.gitignore` | | |

Nothing was executed from input-av, no network device was contacted, nothing outside the task folder was written. No Graft query was used: the scope was one small folder read file by file.

## 1. Overview

input-av ("DEMS EDGE", version `0.3.0`, `nvr/__init__.py:2`) is a FastAPI application that records evidence from ONVIF cameras and ALSA sound cards by spawning one FFmpeg process per source and per part (`nvr/recorder.py:1`, `README.md:14-19`). It drives hardware only through external programs and plain sockets; it links no media library. Python dependencies are five packages: fastapi, uvicorn, requests, sqlalchemy, PyJWT (`requirements.txt:1-5`).

External programs and protocols driven (Grep of `subprocess` call sites in `nvr/*.py`, plus `scripts/dems-netalias`):

| Program / protocol | Used for | Where |
|---|---|---|
| `ffmpeg` | record, level meter, live monitor, test record, playback copy, preview transcode | `nvr/recorder.py:150`, `nvr/audio.py:218`, `nvr/audio.py:315`, `nvr/playback.py:177`, `nvr/mediamtx.py:56` |
| `ffprobe` | duration, stream test, codec probe, channel count | `nvr/recorder.py:232`, `nvr/routers/admin.py:411`, `nvr/mediamtx.py:37`, `nvr/playback.py:57`, `nvr/playback.py:67` |
| `arecord` | list capture cards, dump hardware parameters | `nvr/audio.py:29`, `nvr/audio.py:136`, `nvr/audio.py:419` |
| `amixer` | read and set capture gain | `nvr/audio.py:159`, `nvr/audio.py:181` |
| `ip` | interface addresses, neighbour (ARP) table, add or delete alias | `nvr/discovery.py:67`, `nvr/discovery.py:90`, `nvr/netalias.py:37` |
| `ping` | liveness | `nvr/discovery.py:101` |
| `sudo -n /usr/local/sbin/dems-netalias` | alias add/del, passive listen through `tcpdump` | `nvr/netalias.py:44`, `nvr/passive.py:80`, `scripts/dems-netalias:28-29` |
| `systemd-inhibit` | block sleep while recording | `nvr/service.py:307-308` |
| `timedatectl` | NTP sync state | `nvr/service.py:87`, `nvr/doctor.py:145` |
| ONVIF SOAP over HTTP (`requests`) | device, media and network operations | `nvr/onvif_client.py:106-131` |
| WS-Discovery, UDP multicast `239.255.255.250:3702` | camera discovery | `nvr/discovery.py:42`, `nvr/onvif_client.py:53` |
| MediaMTX HTTP API `127.0.0.1:9997`, local RTSP `127.0.0.1:8554` | live preview only | `nvr/mediamtx.py:23-30`, `deploy/mediamtx.yml:14-15,28-29` |
| `/proc/asound/*`, `/sys/class/net/*` | sound card facts, link state | `nvr/audio.py:83-89,124,325`, `nvr/discovery.py:77-84` |

Why it matters: every hardware behaviour of input-av is expressed as a command line, a small text configuration or a SOAP body. Those are quoted verbatim in section 4.

Platform fact: the code is Linux-only in its hardware parts. It calls `libc.so.6` `prctl` (`nvr/recorder.py:63-64`, guarded by `sys.platform == "linux"` at `nvr/recorder.py:74`), reads `/proc/asound` and `/sys/class/net`, and uses ALSA. The bench server is a laptop with Ubuntu 24.04 (`docs/SERAH-TERIMA.md:78`).

Repository fact: `git status --short apps/input-av` in the DEMS repository prints `?? apps/input-av/`, so the folder is untracked there; input-av's own `.gitignore:2` lists `data/`; the hand-over document states "Proyek belum memakai git" (`docs/SERAH-TERIMA.md:24`).

## 2. Per-file inventory (31 files, one label each)

Labels: HARDWARE_LOGIC, RECORD_KEEPING, API_UI, SUPPORT. A file gets the label of its main purpose. Because several files mix purposes, section 3 lists the hardware items individually (H-nn); the last column points to them.

### 2.1 `nvr/` top level (23 files)

| # | File | Label | What it does | Drives | Records it writes | Evidence | H items |
|---|---|---|---|---|---|---|---|
| 1 | `nvr/__init__.py` | SUPPORT | Holds the version string `0.3.0` | - | none | `nvr/__init__.py:2` | - |
| 2 | `nvr/audio.py` | HARDWARE_LOGIC | Sound card listing, capabilities, automatic USB source, mixer gain, level meter with live monitor, test record, hot-plug monitor, generation of the shared-capture ALSA configuration | `arecord`, `amixer`, `ffmpeg`, `/proc/asound` | File `<DATA_DIR>/alsa/dems-alsa.conf` (`nvr/audio.py:395,481-486`); temporary WAV files in `<tmp>/dems-audio-test` (`nvr/audio.py:299,314`); audit `audio.connected`, `audio.disconnected` (`nvr/audio.py:362,367`) | `nvr/audio.py:1-5` | H-13 to H-15, H-19 to H-22 |
| 3 | `nvr/audit.py` | RECORD_KEEPING | Hash-chained audit log: `hash = SHA256(prev_hash + canonical JSON)`, chain verification | SQLite via SQLAlchemy | Table `audit_log` rows (`nvr/audit.py:30-40`) | `nvr/audit.py:1-5,26-27` | - |
| 4 | `nvr/commissioning.py` | RECORD_KEEPING | Mandatory first-setup gate; builds the installation record from doctor checks and database state; recording is refused until it exists | `doctor.run_checks()` | `settings` row key `commissioning` (`nvr/commissioning.py:12,88-94`); audit `system.commissioned`, `system.commissioning_reset` (`nvr/commissioning.py:95,106`) | `nvr/commissioning.py:1-6`; gate at `nvr/service.py:112-115` | - |
| 5 | `nvr/config.py` | SUPPORT | Environment configuration: data paths, token lifetimes, FFmpeg paths, reconnect delay, discovery defaults | - | File `<DATA_DIR>/.jwt_secret` when no secret is set (`nvr/config.py:17-27`) | `nvr/config.py:11-65` | holds values of H-10, H-23 to H-26 |
| 6 | `nvr/db.py` | RECORD_KEEPING | SQLAlchemy models and engine; SQLite pragmas WAL, foreign keys, synchronous FULL; additive column migration | SQLite | Declares tables `users`, `refresh_tokens`, `rooms`, `cameras`, `cases`, `sessions`, `recordings`, `markers`, `devices`, `settings`, `audit_log` (`nvr/db.py:41,52,61,70,111,122,147,174,184,203,211`) | `nvr/db.py:225-236` | - |
| 7 | `nvr/discovery.py` | HARDWARE_LOGIC | Four background loops: link monitor, WS-Discovery listener plus Probe, ARP sweep or poke with ping and direct ONVIF check, camera heartbeat; device registry; follow camera IP by MAC | sockets (UDP 3702, UDP 9, TCP 554/80), `ip`, `ping`, ONVIF HTTP, `/sys/class/net` | Table `devices` (`nvr/discovery.py:603-606`); `cameras.host`, `rtsp_url`, `preview_url` on IP change (`nvr/discovery.py:649-654`); audit `network.link_up`, `network.link_down`, `device.discovered`, `device.online`, `device.offline`, `device.ip_changed`, `camera.ip_followed` (`nvr/discovery.py:388,607,610,614,629,668`) | `nvr/discovery.py:1-17` | H-11, H-23 to H-27 |
| 8 | `nvr/doctor.py` | SUPPORT | System diagnostics: required programs, installer marker, network helper, audio group, registered audio sources against plugged cards, MediaMTX, NTP, disk, JWT secret, camera network. CLI and API | `shutil.which`, `sudo -n -l`, `timedatectl`, MediaMTX API | Calls `init_db()` first (`nvr/doctor.py:44-45`), which creates tables and adds missing columns (`nvr/db.py:249-251`); no other record | `nvr/doctor.py:1-5,43-184` | H-38; see section 5 |
| 9 | `nvr/export.py` | RECORD_KEEPING | Evidence package per session: ZIP of original files, `session.json`, `audit_log.json`, `SHA256SUMS`, `README.txt` | zipfile | File `<DATA_DIR>/exports/<case>_<session8>_<stamp>.zip`, mode 0444 (`nvr/export.py:40,83`) | `nvr/export.py:1-9` | - |
| 10 | `nvr/factory.py` | HARDWARE_LOGIC | Scan of factory-default camera IPs, set camera IP through ONVIF, next free IP, new-camera wizard job | netalias, WS-Discovery probe, `ping`, ONVIF | `devices` rows through `discovery.service._seen` (`nvr/factory.py:69,185`); audit `device.factory_scan`, `device.set_ip` (`nvr/factory.py:76,99,171`); in-memory `jobs` dict only (`nvr/factory.py:134`); `cameras` rows through registration (`nvr/factory.py:190-193`) | `nvr/factory.py:1` | H-30 to H-32; see section 5 |
| 11 | `nvr/main.py` | API_UI | FastAPI application, router mounting, start and stop order of background services, bootstrap admin, static web UI | - | First `users` row (`nvr/main.py:27-34`); audit `system.bootstrap_admin`, `system.start`, `system.stop` (`nvr/main.py:35,50,62`); creates `recordings/` and `exports/` directories (`nvr/main.py:43-44`) | `nvr/main.py:41-62` | - |
| 12 | `nvr/media.py` | API_UI | HTTP Range file response for player seeking | - | none | `nvr/media.py:12-48` | - |
| 13 | `nvr/mediamtx.py` | HARDWARE_LOGIC | Live preview through MediaMTX: registers path `cam<ID>`, probes the video codec, for non-H.264 runs an on-demand FFmpeg transcode to H.264 for preview only | MediaMTX API, `ffprobe`, `ffmpeg`, `setpriv`, `nice` | none in the database; MediaMTX path configuration | `nvr/mediamtx.py:1-6,45-62` | H-33 |
| 14 | `nvr/netalias.py` | HARDWARE_LOGIC | Temporary `/24` IP alias on the camera port to reach a camera on another subnet; timed removal; cleanup at start and stop | `ip addr add/del`, fallback `sudo -n` helper | `settings` row key `net_aliases` (`nvr/netalias.py:21,63-70`); audit `network.alias_add`, `network.alias_remove`, `network.alias_remove_failed` (`nvr/netalias.py:101,130,133`); host network state | `nvr/netalias.py:1-11` | H-29 |
| 15 | `nvr/onvif_client.py` | HARDWARE_LOGIC | Minimal ONVIF client without zeep: WS-Discovery probe, SOAP calls with WS-UsernameToken and HTTP Digest fallback, device info, media URL, profiles, stream URI, MAC, set network, channel resolution | ONVIF SOAP over HTTP, UDP multicast | none itself; changes the camera's own network configuration in `set_network` (`nvr/onvif_client.py:200-230`) | `nvr/onvif_client.py:1-5` | H-01 to H-06, H-31 |
| 16 | `nvr/passive.py` | HARDWARE_LOGIC | Passive detection on the camera cable from packet headers: ARP probe/announce/reply, DHCP request, WS-Discovery; classifies by a direct ONVIF check, with an alias when the device is on another subnet | `sudo -n dems-netalias listen` (tcpdump) | `devices` rows through `_seen` (`nvr/passive.py:138`); audit `device.dhcp_request` (`nvr/passive.py:114`); alias state through netalias (`nvr/passive.py:131`) | `nvr/passive.py:1-9` | H-28 |
| 17 | `nvr/playback.py` | RECORD_KEEPING | Playback copy after finalisation: MP4 H.264 (remux when H.264, transcode otherwise), M4A for audio; muxes the sound card recording into the video copy with a measured offset; watchdog | `ffmpeg`, `ffprobe`, `nice` | File `camN-pNN.play.mp4` or `.play.m4a` beside the original, mode 0444 (`nvr/playback.py:149,157,203-204`); `recordings.playback_path`, `playback_sha256`, `playback_status` (`nvr/playback.py:97-103,206`); audit `recording.playback_copy`, `recording.playback_copy_failed` (`nvr/playback.py:199,207`) | `nvr/playback.py:1-12` | H-34 |
| 18 | `nvr/recorder.py` | HARDWARE_LOGIC | FFmpeg process manager: one process per recording file; argument lists for RTSP and ALSA input; spawner thread with parent-death signal; graceful stop; media-start estimate; SHA-256 and duration helpers | `ffmpeg`, `ffprobe`, `prctl` | The evidence file itself, written by FFmpeg at the path given (`nvr/recorder.py:143,149`) | `nvr/recorder.py:1-8` | H-07 to H-09, H-16, H-17 |
| 19 | `nvr/registration.py` | HARDWARE_LOGIC | Registers one physical camera through ONVIF: one channel per lens, device limit, duplicate-MAC refusal | ONVIF | `cameras` rows including `username`, `password`, `rtsp_url` with credentials (`nvr/registration.py:62-69`; column comment `nvr/db.py:79`); audit `camera_device.register` (`nvr/registration.py:74`) | `nvr/registration.py:31-78` | H-06 |
| 20 | `nvr/security.py` | RECORD_KEEPING | scrypt password hashing, JWT (HS256) access, refresh, preview and media tokens, role dependency | - | `refresh_tokens` rows (`nvr/security.py:66`) | `nvr/security.py:17-18,23-26,61-70` | - |
| 21 | `nvr/service.py` | RECORD_KEEPING | Session logic: start and stop of all sources of a room, part numbering, reconnect, finalisation with hash and read-only bit, crash recovery, sleep inhibitor. One open session per room | recorder, `systemd-inhibit`, `timedatectl` | `sessions` and `recordings` rows (`nvr/service.py:127-131,159-162,225-241`); deletes zero-size files and repeat-failure rows (`nvr/service.py:236,250-256`); audit `session.start`, `session.stop`, `session.interrupted`, `recording.stream_lost`, `recording.connect_failed`, `recording.resumed` (`nvr/service.py:141,177,201,295,344`) | `nvr/service.py:1-7` | H-10 to H-12, H-14, H-36 |
| 22 | `nvr/settings.py` | RECORD_KEEPING | Site settings model stored as JSON; presets; change listeners | - | `settings` row key `site` (`nvr/settings.py:16,113-119`) | `nvr/settings.py:19-67` | holds values of H-18, H-25, H-30 |
| 23 | `nvr/storage.py` | SUPPORT | Disk capacity, measured data rate per camera, refusal below the safe limit, orderly stop of all sessions below the critical limit | `shutil.disk_usage` | audit `storage.critical`, `storage.low` (`nvr/storage.py:114,120`) | `nvr/storage.py:1-8,18-21` | H-37 |

### 2.2 `nvr/routers/` (8 files)

| # | File | Label | What it does | Records it writes | Evidence |
|---|---|---|---|---|---|
| 24 | `nvr/routers/__init__.py` | SUPPORT | Empty package marker (0 lines by `wc -l`; no line to cite) | none | file listing, 0 lines |
| 25 | `nvr/routers/admin.py` | API_UI | Users, rooms, room layout, cameras, ONVIF search, physical camera registration, setup endpoints, site settings, stream test with `ffprobe` | `users`, `rooms`, `cameras` rows; `cameras.device_info.last_test` (`nvr/routers/admin.py:416-424`); audits `user.*`, `room.*`, `camera.*`, `settings.update` (`nvr/routers/admin.py:54,75,104,136,197,209,273,347,387,400`) | `nvr/routers/admin.py:1,403-425` |
| 26 | `nvr/routers/audio.py` | API_UI | Audio devices, mixer, meter, test record, audio source create and update with allocation rules | `cameras` rows with `kind="audio"` and `device_info.audio`, `device_info.av_offset_ms` (`nvr/routers/audio.py:192-195,240-245`); audits `audio.mixer`, `audio_source.create`, `audio_source.update` (`nvr/routers/audio.py:77,198,247`) | `nvr/routers/audio.py:1,83-118` |
| 27 | `nvr/routers/audit_internal.py` | API_UI | Audit list and chain verification; internal MediaMTX auth callback restricted to localhost | none | `nvr/routers/audit_internal.py:16-35,52-74` |
| 28 | `nvr/routers/auth.py` | API_UI | Login, refresh with rotation, logout, me | `refresh_tokens.revoked` (`nvr/routers/auth.py:48,62`); audits `auth.login`, `auth.login_failed`, `auth.logout` (`nvr/routers/auth.py:30,34,64`) | `nvr/routers/auth.py:25-36` |
| 29 | `nvr/routers/devices.py` | API_UI | Detected devices, forget, scan now, factory scan, set IP, next free IP, wizard job, alias removal, system check, storage, network status, event feed | deletes a `devices` row; audit `device.forget` (`nvr/routers/devices.py:57-59`) | `nvr/routers/devices.py:1,62-154` |
| 30 | `nvr/routers/serializers.py` | API_UI | Model to JSON; camera credentials never leave (`rtsp_url` redacted) | none | `nvr/routers/serializers.py:1,19` |
| 31 | `nvr/routers/sessions.py` | API_UI | Cases, session start and stop, markers, export, room preview, recording file serving and verification | `cases`, `markers` rows (`nvr/routers/sessions.py:45-48,149-151`); `cameras.preview_url` and `device_info.preview_codec` backfill (`nvr/routers/sessions.py:219-229`); audits `case.create`, `session.marker`, `session.export`, `room.preview`, `recording.play`, `recording.download`, `recording.verify`, `storage.rejected` (`nvr/routers/sessions.py:51,101,153,167,202,255,292`) | `nvr/routers/sessions.py:1` |

Count check: 23 + 8 = 31 files, each listed once with one label. Label totals: HARDWARE_LOGIC 9 (`audio`, `discovery`, `factory`, `mediamtx`, `netalias`, `onvif_client`, `passive`, `recorder`, `registration`), RECORD_KEEPING 8 (`audit`, `commissioning`, `db`, `export`, `playback`, `security`, `service`, `settings`), API_UI 9 (`main`, `media`, 7 routers), SUPPORT 5 (`__init__`, `config`, `doctor`, `storage`, `routers/__init__`).

Labelling note for row 7: `nvr/service.py`, `nvr/playback.py`, `nvr/storage.py` and `nvr/doctor.py` are not labelled HARDWARE_LOGIC as files, yet each holds hardware behaviour. Those behaviours are items H-10 to H-12, H-14, H-34, H-36, H-37, H-38 below, so no hardware rule is lost by the one-label rule.

### 2.3 Non-Python files in scope

| File | Purpose | Evidence |
|---|---|---|
| `nvr/web/index.html` (1213 lines) | Single-file web UI. Audio calibration UI polls the meter every 200 ms and shows guide lines at -18 and -12 dBFS | `nvr/web/index.html:631-638`, `nvr/web/index.html:608-609` |
| `scripts/install.sh` | Idempotent installer: packages, `audio` group, network helper with sudoers, NTP, venv, MediaMTX v1.9.3, ufw rules, systemd units, install marker `/etc/dems-nvr/install.json` | `scripts/install.sh:30,36-37,81,86-87,93,123-124,194-198` |
| `scripts/start-lan-test.sh` | Starts MediaMTX and uvicorn (1 worker, port 8000) for the laptop test, then runs the doctor | `scripts/start-lan-test.sh:42-49` |
| `scripts/dems-netalias` | Root helper: add or delete a private `/24` alias, or passive listen through `tcpdump` | `scripts/dems-netalias:24-46` |
| `scripts/uji/uji_multi_ruangan.py` | End-to-end multi-room test against a scratch instance | `scripts/uji/uji_multi_ruangan.py:1-10` |
| `scripts/uji/level_audio.py` | Level per input from a 6-channel WAV (written for the Audient EVO 8) | `scripts/uji/level_audio.py:1-3,9-10` |
| `scripts/uji/uji_discovery_link_down.py` | Test of the WS-Discovery loop when the camera port IP is gone | `scripts/uji/uji_discovery_link_down.py:1-3` |
| `deploy/mediamtx.yml` | MediaMTX for live preview only; HTTP auth callback; RTSP on localhost, TCP only | `deploy/mediamtx.yml:1,6-7,28-30` |
| `deploy/dems-nvr.service` | systemd unit: user `dems`, `SupplementaryGroups=audio`, one worker, `TimeoutStopSec=60`, `KillMode=mixed` | `deploy/dems-nvr.service:8-17` |
| `deploy/dems-mediamtx.service`, `deploy/Caddyfile` | MediaMTX unit; HTTPS reverse proxy example | `deploy/dems-mediamtx.service:7`, `deploy/Caddyfile:2-16` |
| `.env.example` | Example environment; holds no secret value | `.env.example:1-26` |

## 3. Hardware-logic items (H-nn), for the verdicts of row 7

Each item is one behaviour or workaround. "Why it matters" is the hardware reason the code itself states, where it states one.

| Id | Item | Where | Hardware behaviour or workaround it encodes |
|---|---|---|---|
| H-01 | ONVIF SOAP call with WS-UsernameToken PasswordDigest whose `Created` uses the camera's clock; on HTTP 401 the same envelope is re-sent with HTTP Digest | `nvr/onvif_client.py:87-104`, `nvr/onvif_client.py:116-120`, `nvr/onvif_client.py:141-152` | Cameras reject a token when the clocks differ (`nvr/onvif_client.py:87-88`); some cameras use HTTP Digest, not WS-Security (`nvr/onvif_client.py:116`). `sync_time` failure is not fatal because some cameras refuse it without login (`nvr/onvif_client.py:260-263`) |
| H-02 | Media service address from `GetCapabilities` category Media, fallback `http://<host>:<port>/onvif/media_service` | `nvr/onvif_client.py:159-163` | Cameras that return no media XAddr |
| H-03 | One channel per video source (lens); per lens the profile with the largest width x height is the record stream, the smallest is the preview stream | `nvr/onvif_client.py:232-256` | Dual-lens cameras give two channels (`nvr/onvif_client.py:233-234`) |
| H-04 | Single-profile path: the named profile token, else the first profile | `nvr/onvif_client.py:258-274` | Comment: "profile pertama biasanya main stream" (`nvr/onvif_client.py:269`) |
| H-05 | `GetStreamUri` with `RTP-Unicast` and transport protocol `RTSP`; user and password percent-encoded into the URI when the camera did not include them; redaction for logs and API | `nvr/onvif_client.py:182-190`, `nvr/onvif_client.py:277-285`, `nvr/onvif_client.py:288-289` | Most cameras return the URI without credentials (`nvr/onvif_client.py:278`) |
| H-06 | MAC from `GetNetworkInterfaces`, fallback neighbour table then device registry; refusal of a second registration of the same MAC; lens limit; physical-device limit | `nvr/onvif_client.py:192-198`, `nvr/registration.py:47-57`, `nvr/registration.py:24-28` | Identity that survives an IP change |
| H-07 | Camera recording command: RTSP over TCP, video copied, camera audio to AAC, MPEG-TS container | `nvr/recorder.py:148-152`, `nvr/recorder.py:216-217` | MPEG-TS keeps codec parameter sets in-stream, so the file is valid for cameras that do not send them at RTSP session start (common with H.265) and stays readable after a sudden stop (`nvr/recorder.py:3-6`, `README.md:200-201`) |
| H-08 | All FFmpeg processes spawned by one long-lived thread with `PR_SET_PDEATHSIG = SIGTERM`; graceful stop by writing `q` to stdin | `nvr/recorder.py:55-85`, `nvr/recorder.py:185-202` | An orphan FFmpeg would keep writing a file that recovery already hashed; the death signal is bound to the forking thread, hence a single spawner (`nvr/recorder.py:55-58`). An orphan also keeps the sound card open (`nvr/audio.py:238-239`) |
| H-09 | Estimated wall-clock time of the first media sample: the minimum over progress reports of `now - out_time_us` | `nvr/recorder.py:33-36`, `nvr/recorder.py:156-170`; stored at `nvr/service.py:227` | Aligns the separate sound card file with the video in the playback copy (`nvr/db.py:161-163`, `nvr/playback.py:106-121`) |
| H-10 | Reconnect and part rule (section 4, TS-5) | `nvr/service.py:20-21`, `nvr/service.py:181-217`, `nvr/config.py:50` | A lost stream closes and hashes the file, then continues as the next part so the gap is documented (`nvr/service.py:4-5`) |
| H-11 | The record URL is re-read from the database at each part; cameras whose MAC is known follow an IP change | `nvr/service.py:156-158`, `nvr/discovery.py:616-619`, `nvr/discovery.py:643-656` | A camera can change IP under DHCP in mid-session (`nvr/service.py:158`) |
| H-12 | Finalisation: SHA-256, duration by `ffprobe`, mode 0444, zero-size file removed and marked error; at start-up a session still `recording` is marked `interrupted` and its files are hashed | `nvr/service.py:220-247`, `nvr/service.py:331-346` | Evidence integrity after normal stop and after a crash |
| H-13 | Sound card enumeration by `arecord -l`; channels, rates and bit depth from `/proc/asound/card<N>/stream<D>`, fallback `arecord --dump-hw-params`, with caches | `nvr/audio.py:25-54`, `nvr/audio.py:118-145`, `nvr/audio.py:82-89` | `/proc` stays readable while the device is in use; hw-params fail when it is busy, hence the cache (`nvr/audio.py:119-121`) |
| H-14 | Generic source `alsa:auto-usb` = the first USB Audio Class card present; the concrete card is resolved once at REKAM and kept for the session; REKAM is refused when a selected input exceeds the card's input count; the card identity is written to the session-start audit | `nvr/audio.py:77-79`, `nvr/audio.py:99-112`, `nvr/service.py:42-61`, `nvr/service.py:145-147` | Brand-independent card swap; evidence consistency within a session (`nvr/service.py:43-44`) |
| H-15 | Shared-capture ALSA configuration generated per card (section 4, TS-7) | `nvr/audio.py:389-488` | One ALSA card can be opened by one process only; `dsnoop` lets several rooms record different inputs of one interface at the same time (`nvr/audio.py:390-392`) |
| H-16 | Open all device channels, then select inputs with a `pan` filter (section 4, TS-8) | `nvr/recorder.py:92-116`, `nvr/recorder.py:205-215` | Opening with fewer channels makes the ALSA plug layer downmix the inputs (`nvr/recorder.py:105-106`, `docs/SERAH-TERIMA.md:271-272`) |
| H-17 | Stored audio form: 1-2 inputs FLAC, more than 2 inputs WAV RF64 PCM | `nvr/recorder.py:119-127` | FLAC knows speaker layouts only (wrong labels for 3, 4, 5, 7 microphones) and at most 8 channels (`nvr/recorder.py:120-122`) |
| H-18 | Allocation rules: one sound card input belongs to one audio source; all sources on one card use one sample rate; the configuration form offers a site-standard number of inputs (default 8) while only inputs present on the plugged card may be chosen | `nvr/routers/audio.py:83-105`, `nvr/routers/audio.py:108-118`, `nvr/audio.py:57-74`, `nvr/settings.py:35-37` | The `dsnoop` slave has one rate (`nvr/routers/audio.py:85-86`) |
| H-19 | Capture gain through the card mixer | `nvr/audio.py:155-185` | USB XLR interfaces often have an analogue gain knob only, so the control list can be empty (`nvr/audio.py:156-157`) |
| H-20 | Level meter per 100 ms with optional live monitor, one FFmpeg for both | `nvr/audio.py:192-295` | See section 5.3 |
| H-21 | Test record of 1-15 seconds | `nvr/audio.py:298-321`, `nvr/routers/audio.py:158-169` | See section 5.3 |
| H-22 | Sound card hot-plug monitor: `/proc/asound/cards` every 3 s; regenerates the ALSA configuration; remembers which cards were USB | `nvr/audio.py:324-386` | A removed card has already vanished from `/proc`, so USB-ness is remembered (`nvr/audio.py:377-382`) |
| H-23 | Link monitor on physical Ethernet ports | `nvr/discovery.py:75-85`, `nvr/discovery.py:377-401` | Pulling the PoE switch uplink marks every device on that interface offline at once (`nvr/discovery.py:5-6,396-397`) |
| H-24 | WS-Discovery: passive Hello/Bye plus periodic Probe from the same UDP 3702 socket | `nvr/discovery.py:404-482` | ProbeMatch then returns to port 3702, so the firewall needs only UDP 3702 from the camera subnet (`nvr/discovery.py:405-407`); on `OSError` the interface IP is re-read (`nvr/discovery.py:433-437`, fixed 12 October per `docs/SERAH-TERIMA.md:106`) |
| H-25 | ARP sweep (empty UDP datagram to port 9 of every host) or poke of known neighbours, 8 s settle, neighbour table read, ping of known devices, direct unauthenticated ONVIF check | `nvr/discovery.py:485-567` | Finds devices that do not announce themselves or where multicast is blocked (`nvr/discovery.py:523-524`) |
| H-26 | Camera heartbeat every 3 s, offline after 2 consecutive failures; ping, then TCP 554 and 80 | `nvr/discovery.py:107-121`, `nvr/discovery.py:349-374` | Cameras that block ICMP (`nvr/discovery.py:112`) |
| H-27 | Device registry upsert keyed by MAC, key `ip:<ip>` until the MAC is known; vendor from the IEEE OUI file | `nvr/discovery.py:584-641`, `nvr/discovery.py:127-139` | An IP taken over by another MAC is not merged (`nvr/discovery.py:590-593`) |
| H-28 | Passive monitor: parse `tcpdump -n -e -q` lines for ARP probe, announce, reply, DHCP request, WS-Discovery | `nvr/passive.py:21-46`, `nvr/passive.py:79-97`, `scripts/dems-netalias:28-29` | A camera with any factory IP is detected, including brands not in the default list (`nvr/passive.py:3-6`) |
| H-29 | Temporary alias `<subnet>.<host>/24` on the camera port, removed after N minutes, at stop and at next start | `nvr/netalias.py:84-134`, `nvr/main.py:51,60`, `scripts/dems-netalias:38-43` | Reaching a camera on its factory subnet; `arping -D` conflict check when present (`scripts/dems-netalias:39-42`) |
| H-30 | Factory-IP scan | `nvr/factory.py:40-79` | Section 5.1 |
| H-31 | Set camera IP through ONVIF | `nvr/onvif_client.py:200-230`, `nvr/factory.py:82-104` | Section 5.2 |
| H-32 | New-camera wizard job and next free IP | `nvr/factory.py:108-203` | Section 5.2 |
| H-33 | Live preview: MediaMTX pulls H.264 directly over TCP on demand; any other codec is transcoded to H.264 by an on-demand FFmpeg at low CPU priority, tied to MediaMTX by `setpriv --pdeathsig TERM` | `nvr/mediamtx.py:33-62` | Browsers cannot play H.265 (`nvr/mediamtx.py:46-48`); preview never touches the evidence path (`deploy/mediamtx.yml:1`) |
| H-34 | Playback copy: remux for H.264, transcode `libx264 -preset veryfast -crf 20` otherwise; sound card audio muxed in with `-itsoffset` or `-ss`; more than 2 channels mixed to mono with `dynaudnorm`; stderr to a file; stall watchdog 300 s | `nvr/playback.py:156-178`, `nvr/playback.py:85-94`, `nvr/recorder.py:130-136` | A pipe that is not read blocks FFmpeg when a broken file floods stderr (`nvr/playback.py:179-180`) |
| H-35 | Stream test by `ffprobe` over TCP with a 20 s process timeout; result stored as `last_test` | `nvr/routers/admin.py:403-425` | Feeds the commissioning step "every active camera passed the stream test" (`nvr/commissioning.py:49-58`) |
| H-36 | Sleep, idle and lid-switch inhibitor while any session is active; NTP sync state recorded per session | `nvr/service.py:300-320`, `nvr/service.py:85-91`, `nvr/service.py:128` | The server can be a laptop (`nvr/service.py:301`) |
| H-37 | Disk protection: default 4 Mbps estimate, check every 15 s, refuse below `min_free_gb` (10), stop all below `critical_free_gb` (2) | `nvr/storage.py:19-20`, `nvr/storage.py:93-123`, `nvr/settings.py:66-67` | An orderly stop keeps evidence files valid when the disk fills (`nvr/storage.py:6-7`) |
| H-38 | System diagnostics | `nvr/doctor.py:43-184` | Section 5.4 |

## 4. Tested input scheme

Nine parameter groups named by the blueprint (TS-1 to TS-9), then two groups the delegation asked for in addition (TS-10 audio capture argument list, TS-11 discovery). For each group: the quoted value, the source lines, the bench device it was observed on.

### TS-1. FFmpeg argument list for camera recording

Assembled from `nvr/recorder.py:148-152` and `nvr/recorder.py:216-217`. Verbatim list elements, in order:

```
<NVR_FFMPEG, default "ffmpeg">
-hide_banner -nostats -loglevel warning -n
-progress pipe:1 -stats_period 0.5
-rtsp_transport tcp -timeout 5000000 -i <rtsp url with credentials>
-map 0:v:0 -map 0:a:0? -c:v copy -c:a aac -ar 48000 -b:a 128k -f mpegts <path>
```

Source lines, quoted:

- `nvr/recorder.py:148-149`: `out = ["-map", "0:v:0", "-map", "0:a:0?", "-c:v", "copy", "-c:a", "aac", "-ar", "48000", "-b:a", "128k", "-f", "mpegts", str(path)]`
- `nvr/recorder.py:150-152`: `cmd = [config.FFMPEG, "-hide_banner", "-nostats", "-loglevel", "warning", "-n", "-progress", "pipe:1", "-stats_period", "0.5", *_input_args(source_url, audio), *out]`
- `nvr/recorder.py:217`: `return ["-rtsp_transport", "tcp", "-timeout", "5000000", "-i", url]  # timeout 5 dtk`

Facts that go with the list:

| Fact | Evidence |
|---|---|
| The FFmpeg binary is `NVR_FFMPEG`, default `ffmpeg` | `nvr/config.py:47` |
| `-n` never overwrites an existing file | `nvr/recorder.py:150` |
| Only the first video stream is taken; the first audio stream is optional (`?`) | `nvr/recorder.py:148` |
| Video is copied. Camera audio, when present, is re-encoded to AAC 48 kHz 128 kbit/s | `nvr/recorder.py:148-149`, `README.md:186-187` |
| Container is MPEG-TS, file name `cam<id>-p<part 2 digits>.ts` under `<RECORDINGS_DIR>/<YYYY/MM/DD>/<session id>/` | `nvr/service.py:153-154` |
| stdin, stdout and stderr are pipes: stdin for `q`, stdout for progress, stderr tail of 30 lines kept with credentials redacted | `nvr/recorder.py:71-73`, `nvr/recorder.py:30`, `nvr/recorder.py:174` |
| No other input flag is set. Grep `wallclock\|fflags\|rw_timeout\|stimeout\|reconnect_\|segment\|max_delay\|analyzeduration\|probesize\|allowed_media_types\|rtsp_flags` over `nvr/*.py` returned no match | Grep, 2026-10-12 |
| A non-RTSP URL (a local file) is played in real time in a loop as a "virtual camera": `["-re", "-stream_loop", "-1", "-i", url]` | `nvr/recorder.py:218-219`, `README.md:84-85` |

Bench device: recorded on the UNIVIEW IPC312LP at 192.168.100.117 and on three Tiandy TC-C320N at 192.168.100.101 to .103, all H.265 1920x1080 25 fps (`docs/SERAH-TERIMA.md:79-80`). First recording on real devices, 12 October 15:18-15:19 WIB: four rooms at once, 4 video files of 54-57 s, all `complete`, SHA-256 recomputed from disk and matching, all four readable without error (`docs/SERAH-TERIMA.md:122-124`). The `-c:a aac` branch for camera audio has no bench observation: the UNIVIEW has no audio (`docs/SERAH-TERIMA.md:79`) and a camera with a microphone is listed as not yet tested (`README.md:207`).

Document conflict, reported as found: `README.md:206` says the only physical camera tested is the UNIVIEW IPC312LP; `docs/SERAH-TERIMA.md:80,122-124` (dated 12 October 15:50 WIB) records the three Tiandy cameras as registered and recorded. The hand-over document is the later one.

### TS-2. ONVIF profile choice and stream-URI resolution

Two code paths exist. Which one runs depends on the endpoint.

Path A, physical camera registration (`POST /camera-devices`, the wizard, and the "Daftarkan kamera" button): `resolve_channels()`.

- Profiles come from `GetProfiles` on the ver10 media service (`nvr/onvif_client.py:165-166`; namespace `http://www.onvif.org/ver10/media/wsdl` at `nvr/onvif_client.py:22`).
- Profiles are grouped by `VideoSourceConfiguration/SourceToken` (`nvr/onvif_client.py:243-245`).
- Per group: `area = (width or 0) * (height or 0)`; `best = max(items, key=area)`, `small = min(items, key=area)` (`nvr/onvif_client.py:248-249`). `best` is the record stream ("main"), `small` the preview stream.
- Each lens becomes one `cameras` row; at most `lenses_per_device` lenses are kept (default 2) (`nvr/registration.py:54-57`, `nvr/settings.py:34`).
- Stored per row: `profile_token`, `rtsp_url`, `preview_url`, `video_source_token`, `device_info.profile`, `device_info.preview_profile` (`nvr/registration.py:62-69`).

Path B, single camera (`POST /cameras` with `host`): `resolve_rtsp(profile_token)` takes the profile with the given token, else `profiles[0]` (`nvr/onvif_client.py:268-269`; called at `nvr/routers/admin.py:259-262`). No preview URL is stored on this path; it is back-filled on the first preview request (`nvr/routers/sessions.py:214-221`).

Stream-URI request body, verbatim (`nvr/onvif_client.py:183-185`):

```
<trt:GetStreamUri><trt:StreamSetup>
<tt:Stream>RTP-Unicast</tt:Stream><tt:Transport><tt:Protocol>RTSP</tt:Protocol></tt:Transport>
</trt:StreamSetup><trt:ProfileToken>{token}</trt:ProfileToken></trt:GetStreamUri>
```

Order of calls: `sync_time` (unauthenticated `GetSystemDateAndTime`, failure ignored) then `GetCapabilities` (Media) then `GetProfiles` then `GetStreamUri` (`nvr/onvif_client.py:235-250`). The device service address is `http://<host>:<port>/onvif/device_service`, port default 80 (`nvr/onvif_client.py:79-84`).

Which stream is recorded: `record_stream` defaults to `"main"`; an admin may set `"sub"`, in which case the preview URL is recorded (`nvr/db.py:98-102`, `nvr/routers/admin.py:229,382-383`).

The ONVIF-reported encoding is stored but is not used to choose or refuse a profile: `encoding` is read at `nvr/onvif_client.py:176` and no code branches on it (the selection at `nvr/onvif_client.py:248-249` uses area only). Why it matters: on the bench both camera models deliver H.265 "walau ONVIF melaporkan H264" (`docs/SERAH-TERIMA.md:79-80`). HYPOTHESIS, not from the source: the ver10 media service cannot express H.265, which would explain the mismatch; the code does not call the ver20 media service (no `ver20` namespace in `nvr/onvif_client.py:19-25`).

Bench device: UNIVIEW IPC312LP, both profiles opened, 1920x1080 and 720x576 at 25 fps (`docs/SERAH-TERIMA.md:79,109`); three Tiandy TC-C320N registered 12 October 15:12-15:16 WIB (`docs/SERAH-TERIMA.md:80`). All four are single-lens; a dual-lens camera is listed as not tested on physical hardware (`README.md:207`).

### TS-3. RTSP transport

- Recording: `-rtsp_transport tcp` (`nvr/recorder.py:217`).
- Stream test and codec probe: `["-rtsp_transport", "tcp", "-timeout", "5000000"]` (`nvr/routers/admin.py:409`, `nvr/mediamtx.py:35`).
- Preview pulled by MediaMTX: `"rtspTransport": "tcp"` (`nvr/mediamtx.py:51`); preview transcode input `-rtsp_transport tcp` (`nvr/mediamtx.py:56`).
- The ONVIF request asks for `RTP-Unicast` over `RTSP` (TS-2).
- The RTSP URL carries the credentials in its authority part, percent-encoded (`nvr/onvif_client.py:284`); it is stored that way in `cameras.rtsp_url` (`nvr/db.py:79`) and the camera password is also stored as plain text in `cameras.password` (`nvr/db.py:77`, `README.md:205`).

Bench device: same four cameras as TS-1.

### TS-4. Timeouts

| What | Value | Evidence |
|---|---|---|
| RTSP input option on record | `-timeout 5000000`, commented "timeout 5 dtk" | `nvr/recorder.py:217` |
| RTSP input option on stream test and codec probe | `-timeout 5000000` | `nvr/routers/admin.py:409`, `nvr/mediamtx.py:35` |
| `ffprobe` process timeout, stream test and codec probe | 20 s | `nvr/routers/admin.py:414`, `nvr/mediamtx.py:39` |
| `ffprobe` duration of a finished file | 30 s | `nvr/recorder.py:234` |
| Stop of a job | `q` on stdin, wait 10 s, then `terminate()`, wait 5 s, then `kill()`; then wait up to 30 s for the exit callback | `nvr/recorder.py:185-202` |
| systemd stop of the backend | `TimeoutStopSec=60`, `KillMode=mixed` | `deploy/dems-nvr.service:16-17` |
| ONVIF HTTP call, default | 5.0 s | `nvr/onvif_client.py:80`, `nvr/onvif_client.py:115` |
| ONVIF "is this ONVIF" check in discovery, factory scan, passive classify | 2 s | `nvr/discovery.py:541`, `nvr/factory.py:26`, `nvr/passive.py:134` |
| ONVIF calls in the wizard | 4 s on the old IP, 3 s on the new IP; wait for the camera at the new IP up to 180 s, polling every 4 s | `nvr/factory.py:155`, `nvr/factory.py:176-181` |
| WS-Discovery probe wait | 2.5 s (`ws_probe_from`, `discover_onvif`); the API caps it at 10 s | `nvr/discovery.py:185`, `nvr/discovery.py:270`, `nvr/routers/admin.py:234-236` |
| `ping` | `ping -n -c 1 -W 1 <ip>`, process timeout 3 s | `nvr/discovery.py:101-102` |
| TCP liveness fallback | ports 554 then 80, 1 s each | `nvr/discovery.py:115-117` |
| `arecord`, `amixer` | 5 s | `nvr/audio.py:29`, `nvr/audio.py:137`, `nvr/audio.py:159-160`, `nvr/audio.py:182` |
| Meter | 0.8 s settle after start, then the process must be alive; idle stop after 30 s without a poll | `nvr/audio.py:245-249`, `nvr/audio.py:17`, `nvr/audio.py:266-271` |
| Test record | process timeout `seconds + 20` | `nvr/audio.py:318` |
| MediaMTX API call | 3 s; doctor check 2 s | `nvr/mediamtx.py:25`, `nvr/doctor.py:136` |
| Preview transcode idle close | `runOnDemandCloseAfter: "10s"` | `nvr/mediamtx.py:61-62` |
| Playback copy stall | 300 s without progress kills FFmpeg | `nvr/playback.py:85-94` |

HYPOTHESIS, not from the source: the meaning of FFmpeg's RTSP `-timeout` option depends on the FFmpeg version (socket I/O timeout in microseconds in recent versions). The source states only the intent "5 dtk". The bench ran FFmpeg 6.1 (`docs/SERAH-TERIMA.md:166`).

Not found: no connect-timeout distinct from `-timeout`, no read-stall watchdog on the record process. The record process is watched only through its exit (`nvr/recorder.py:172-179`).

### TS-5. Reconnect and part rule

Constants: `RECONNECT_DELAY = float(env NVR_RECONNECT_DELAY, "2")` seconds (`nvr/config.py:49-50`); `MAX_RETRY_DELAY = 30.0`, `RESUME_CONFIRM_S = 5.0` (`nvr/service.py:20-21`).

The rule, from `nvr/service.py:181-217`:

1. An FFmpeg exit that was requested (`stop_requested`) finalises the file as `complete` (`nvr/service.py:183-185`).
2. An exit that was not requested while the session is stopping finalises as `complete` when the file has data, else `error` (`nvr/service.py:189-192`).
3. Otherwise the stream was lost. `had_data = job.size > 0` (`nvr/service.py:182`).
   - `fail_streak = 0` when the part had data, else `fail_streak + 1` (`nvr/service.py:193`).
   - `fail_streak > 1` (a repeated attempt with no data): the file and its `recordings` row are deleted and the part number is taken back (`nvr/service.py:194-197`, `nvr/service.py:250-256`).
   - Otherwise the part is finalised with status `error` (file hashed when it has data, removed when empty) and an audit entry is written: `recording.stream_lost` when it had data, `recording.connect_failed` when not, with `sha256` and the last 300 characters of FFmpeg's stderr (`nvr/service.py:199-204`).
4. Delay before the next attempt: `RECONNECT_DELAY` when the part had data, else `min(RECONNECT_DELAY * 2 ** max(fail_streak - 1, 0), MAX_RETRY_DELAY)`: 2, 4, 8, 16, 30, 30 ... seconds (`nvr/service.py:205-206`).
5. The retry starts a new part (`part + 1`, new file, new `recordings` row) unless the session is stopping (`nvr/service.py:214-217`, `nvr/service.py:151-167`).
6. For a video source the URL is re-read from the database before each part (`nvr/service.py:156-158`). For an audio source the device chosen at session start is kept (`nvr/service.py:42-61`).
7. A resumed part (part > 1) writes `recording.resumed` only if, 5 s after start, the process is alive and the file is larger than zero (`nvr/service.py:168-178`).
8. There is no limit on the number of attempts while the session is open (no counter bound in `nvr/service.py:181-217`).
9. A part is never appended to: each part is a separate file with its own hash; the session keeps recording the other sources meanwhile (`nvr/service.py:138-140`, per-run state at `nvr/service.py:24-39`).

One session per room: a second start in a busy room raises `Conflict` (`nvr/service.py:119-120`); several rooms record at the same time (`_active` dict, `nvr/service.py:74-76`).

Bench device: no recorded result of a stream loss on a physical camera was found. `docs/UJI-LAN-KANTOR.md:94` lists "cabut kabel kamera ... `recording.stream_lost`; ... `recording.resumed` (part 2)" as an expected result of a suggested checklist, not as an observed one. Search used: reading `README.md`, `docs/SERAH-TERIMA.md`, `docs/UJI-LAN-KANTOR.md` in full for `stream_lost`, `resumed`, `part`.

### TS-6. Keyframe note

- `README.md:184-185`: "Rekaman dimulai pada **keyframe** berikutnya (video di-copy tanpa re-encode). Set I-frame interval kamera ke 1 detik."
- `docs/UJI-LAN-KANTOR.md:46`: "Atur jam kamera ke NTP, dan I-frame interval = 1 detik (atau sama dengan FPS)."
- Bench state: the UNIVIEW sends a keyframe every 2 seconds (`docs/SERAH-TERIMA.md:79`); the open task is to set its I-frame interval to 25 (1 second) in the camera's web page, and the I-frame interval of the three Tiandy cameras has not been checked (`docs/SERAH-TERIMA.md:169-171`).
- In the code there is no keyframe handling on the record path. Grep `keyframe|i-frame|iframe|"-g"|force_key|gop` (case-insensitive) over `nvr/*.py` returned one match, `nvr/mediamtx.py:58` (`"-g", "25"`), which belongs to the preview transcode, not to recording.

Why it matters: with stream copy the first decodable picture of every part is the first keyframe after connect, so the camera's I-frame interval bounds the loss at each start and each reconnect. This is a camera-side setting, stated in the documents only.

### TS-7. ALSA shared-capture configuration generation

Function `ensure_alsa_config()` (`nvr/audio.py:463-488`). File: `ALSA_CONF = config.DATA_DIR / "alsa" / "dems-alsa.conf"` (`nvr/audio.py:395`). The file was not opened; its content is known from the generator.

Generated text, verbatim template (`nvr/audio.py:466`, `nvr/audio.py:473-479`):

```
</usr/share/alsa/alsa.conf>
pcm.<name>_shared {
  type dsnoop
  ipc_key <key>
  ipc_perm 0660
  slave { pcm "hw:CARD=<card>,DEV=<dev>" channels <channels> rate <rate> format <format> period_size 1024 buffer_size 8192 }
}
pcm.<name> { type plug slave.pcm "<name>_shared" }
```

| Placeholder | Rule | Evidence |
|---|---|---|
| `<name>` | `dems_<card>_<dev>`, from `plughw:CARD=<card>,DEV=<dev>` | `nvr/audio.py:442-445`, `nvr/audio.py:471` |
| `<key>` | `52000 + zlib.crc32("<card>:<dev>") % 9000` | `nvr/audio.py:472` |
| `<channels>` | the card's native capture channel count, default 2 | `nvr/audio.py:475`; source of the count `nvr/audio.py:126-131` |
| `<rate>` | the sample rate of the first registered audio source on that card (default 48000), checked against the rates the card supports: if not supported, 48000 if supported, else the first supported rate | `nvr/audio.py:448-460`, `nvr/audio.py:430-439`, `nvr/audio.py:476` |
| `<format>` | the first of `("S32_LE", "S24_3LE", "S24_LE", "S16_LE")` that the card lists in `/proc/asound/card<N>/stream<D>` (fallback `arecord --dump-hw-params`), default `S32_LE` | `nvr/audio.py:396`, `nvr/audio.py:401-414`, `nvr/audio.py:477` |
| period and buffer | `period_size 1024 buffer_size 8192` | `nvr/audio.py:478` |

Other facts:

| Fact | Evidence |
|---|---|
| One block pair per ALSA capture card; the automatic entry and `pulse:` sources are skipped | `nvr/audio.py:467-469` |
| Written only when the text changed, through a `.tmp` file and `os.replace` | `nvr/audio.py:481-486` |
| The process environment variable `ALSA_CONFIG_PATH` is set to the file, so every FFmpeg child inherits it | `nvr/audio.py:487`, docstring `nvr/audio.py:464-465` |
| The hardware-parameter dump itself runs with `ALSA_CONFIG_PATH=/usr/share/alsa/alsa.conf` | `nvr/audio.py:421` |
| When it runs: at server start, on every card change, at REKAM of a room with an audio source, at meter start, at test record | `nvr/main.py:52`, `nvr/audio.py:353-356`, `nvr/service.py:57-58`, `nvr/audio.py:210`, `nvr/audio.py:306` |
| FFmpeg opens the plug PCM `dems_<card>_<dev>`, never `hw:` or `plughw:` | `nvr/recorder.py:207-210` |
| All sources on one card must use one sample rate; the API refuses a different one | `nvr/routers/audio.py:103-105` |
| `pulse:` sources stay exclusive | `nvr/routers/audio.py:52-61`, `README.md:197-199` |

Bench device: the multi-room test (29 of 29 checks) ran with two rooms sharing the laptop's onboard sound card, card `sofhdadsp` device 6, 2 channels, plus a third reader on the same shared PCM (`docs/SERAH-TERIMA.md:107,112`, `scripts/uji/uji_multi_ruangan.py:15-16`, `scripts/uji/uji_multi_ruangan.py:57-58,76`). On the Audient EVO 8 (ALSA card `EVO8`, USB 2708:0007): "Dikenali aplikasi, masuk konfigurasi capture bersama, empat proses rekam paralel berhasil" (`docs/SERAH-TERIMA.md:82,110`); the manual measuring command opens `dems_EVO8_0` with 6 channels (`docs/SERAH-TERIMA.md:249-251`). The native format the EVO 8 reported is not stated in any document read.

### TS-8. Channel-open then input-select logic

Verbatim (`nvr/recorder.py:104-116`):

```python
def capture_channels(a: dict | None) -> int:
    """Kanal ASLI perangkat. Membuka dengan kanal lebih sedikit membuat ALSA plug
    mencampur (downmix) input; jadi selalu buka semua kanal lalu PILIH input (pan)."""
    a = a or {}
    return max(int(a.get("device_channels") or 2), max(audio_inputs(a)))


def audio_select_filter(a: dict | None) -> str | None:
    ins, total = audio_inputs(a), capture_channels(a)
    if ins == list(range(1, total + 1)) and total <= 2:
        return None                                   # semua input, apa adanya
    layout = {1: "mono", 2: "stereo"}.get(len(ins), f"{len(ins)}c")
    return f"pan={layout}|" + "|".join(f"c{i}=c{x - 1}" for i, x in enumerate(ins))
```

| Rule | Evidence |
|---|---|
| Inputs are 1-based numbers in the order chosen; legacy forms `"1"`, `"2"`, `"both"`, `{"channels": n}` are still read | `nvr/recorder.py:92-101` |
| Channels opened = `max(device_channels, highest selected input)` | `nvr/recorder.py:108` |
| `device_channels` is taken from the card actually plugged at REKAM, not from the stored configuration | `nvr/service.py:51,60`; same for meter and test record `nvr/audio.py:211`, `nvr/audio.py:307` |
| No filter when all inputs of a 1- or 2-channel card are selected in order | `nvr/recorder.py:113-114` |
| Otherwise `pan=<layout>\|c0=c<in1-1>\|c1=c<in2-1>...`, layout `mono`, `stereo`, or `<n>c` | `nvr/recorder.py:115-116` |
| Inputs are selected, never mixed, in the evidence file | `nvr/routers/audio.py:22-24` |
| REKAM is refused when the highest selected input exceeds the plugged card's channel count | `nvr/service.py:53-56` |
| The filter is placed after `-map 0:a:0` as `-af <filter>` | `nvr/recorder.py:145-146` |

DERIVED examples (computed from the function above, not quoted from a log): EVO 8 with 6 channels, input 3 selected gives `-channels 6` and `-af pan=mono|c0=c2`; a 2-channel card with input 2 gives `-channels 2` and `-af pan=mono|c0=c1`; a 2-channel card with inputs `[1, 2]` gives no `-af`.

Bench device: bit-exact separation of input 1 and input 2 against a 2-channel reference recording was proven on the onboard laptop card (`scripts/uji/uji_multi_ruangan.py:125-142`, result line `docs/SERAH-TERIMA.md:107`). On the EVO 8 the three microphones on inputs 1-3 are stated as "sudah terbukti terpisah satu sama lain" (`docs/SERAH-TERIMA.md:92`). EVO 8 inputs 5-6 are loopback, not microphones, and the form still offers them (`docs/SERAH-TERIMA.md:82,177-179`). An interface with 8 physical inputs has never been tested (`docs/SERAH-TERIMA.md:172-173`).

### TS-9. Sample format and rate

| Parameter | Value | Evidence |
|---|---|---|
| Default sample rate | 48000, allowed 8000-192000 | `nvr/routers/audio.py:25`; default applied in the command `nvr/recorder.py:215` |
| Default bit depth | 24, allowed 16, 24, 32 | `nvr/routers/audio.py:26`, `nvr/routers/audio.py:189-190`; default applied `nvr/recorder.py:213` |
| FFmpeg ALSA input sample codec | `-c:a pcm_s<bits>le`, so `pcm_s24le` by default; only for `alsa`, not for `pulse` | `nvr/recorder.py:213` |
| Hardware-side format | the `dsnoop` slave opens the card in its native format (preference S32_LE, S24_3LE, S24_LE, S16_LE); the `plug` layer converts to what FFmpeg asks | `nvr/audio.py:396,477,479` |
| Hardware-side rate | one rate per card, see TS-7 | `nvr/audio.py:476` |
| Stored form, 1-2 inputs | `[".flac", ["-c:a", "flac", "-f", "flac"]]` | `nvr/recorder.py:124-125` |
| Stored form, more than 2 inputs | `[".wav", ["-c:a", "pcm_s24le" or "pcm_s32le" when bits = 32, "-rf64", "auto", "-f", "wav"]]` | `nvr/recorder.py:126-127` |
| The web form follows the plugged card: rate 48000 when the card supports it, else its first rate; 24-bit when the card's maximum is at least 24, else 16 | `nvr/web/index.html:583-584` |
| Storage estimate | `inputs x sample_rate x bits / 8`, times 0.65 for FLAC | `nvr/storage.py:38-41` |

Why it matters: "24-bit / 48 kHz" is the default of the API model, not a constant of the capture code; the card is opened in its own native format and one rate per card.

Bench device: the multi-room test asserts `codec_name == "flac"`, 1 channel, `sample_rate == "48000"`, `bits_per_raw_sample == "24"` on the onboard laptop card (`scripts/uji/uji_multi_ruangan.py:119-121`). EVO 8: "Capture 6 kanal 24-bit, 44,1-96 kHz" (`docs/SERAH-TERIMA.md:82`). `README.md:26` names FLAC lossless 24-bit/48 kHz with the Behringer UMC202HD as the example device; that card is no longer plugged (`docs/SERAH-TERIMA.md:83`). The WAV RF64 branch (more than 2 inputs in one source) has no bench observation: every registered source uses one input (`docs/SERAH-TERIMA.md:84`) and "interface audio lebih dari 2 input" is listed as not tested on physical hardware (`README.md:208`).

### TS-10. FFmpeg argument list for audio capture

Assembled from `nvr/recorder.py:144-146`, `nvr/recorder.py:150-152`, `nvr/recorder.py:206-215`. Verbatim list elements, in order, for an `alsa:` source:

```
<NVR_FFMPEG, default "ffmpeg">
-hide_banner -nostats -loglevel warning -n
-progress pipe:1 -stats_period 0.5
-thread_queue_size 1024 -f alsa -c:a pcm_s<bits>le -channels <capture_channels> -sample_rate <sample_rate> -i dems_<card>_<dev>
-map 0:a:0 [-af <pan filter>] -c:a flac -f flac <path>.flac            (1-2 inputs)
-map 0:a:0  -af <pan filter>  -c:a pcm_s24le -rf64 auto -f wav <path>.wav   (more than 2 inputs; pcm_s32le when bits = 32)
```

Source lines, quoted:

- `nvr/recorder.py:212-215`: `return ["-thread_queue_size", "1024", "-f", fmt, *(["-c:a", f"pcm_s{int(a.get('bits', 24))}le"] if fmt == "alsa" else []), "-channels", str(capture_channels(a)), "-sample_rate", str(int(a.get("sample_rate", 48000))), "-i", dev]`
- `nvr/recorder.py:146`: `out = ["-map", "0:a:0", *(["-af", sel] if sel else []), *audio_format(audio)[1], str(path)]`
- `nvr/recorder.py:209-210`: `from .audio import shared_pcm` / `dev = shared_pcm(dev)      # capture bersama (dsnoop): banyak ruangan, satu kartu`

For a `pulse:` source the list is the same without `-c:a pcm_s<bits>le` and with `-f pulse -i <source>` (`nvr/recorder.py:207-215`).

DERIVED example with the defaults on the EVO 8, input 1: `ffmpeg -hide_banner -nostats -loglevel warning -n -progress pipe:1 -stats_period 0.5 -thread_queue_size 1024 -f alsa -c:a pcm_s24le -channels 6 -sample_rate 48000 -i dems_EVO8_0 -map 0:a:0 -af pan=mono|c0=c0 -c:a flac -f flac <path>/cam<id>-p01.flac`. The input half matches the manual command in the hand-over document: `-f alsa -c:a pcm_s24le -channels 6 -sample_rate 48000 -i dems_EVO8_0` (`docs/SERAH-TERIMA.md:250-251`).

Related capture commands that are not evidence recording:

| Command | Verbatim tail after the same input arguments | Evidence |
|---|---|---|
| Meter | `-hide_banner -loglevel error -nostats <input> -af <pan,>asetnsamples=n=4800:p=0,astats=metadata=1:reset=1,ametadata=mode=print:file=- -f null -` | `nvr/audio.py:216-219`, `nvr/audio.py:237` |
| Meter with live monitor | `-filter_complex [0:a]<pan,>asplit=2[m][o0];[m]<meter chain>[mo];[o0]<listen>anull[o] -map [mo] -f null - -map [o] -c:a libopus -b:a 96k -application lowdelay -f rtsp -rtsp_transport tcp rtsp://127.0.0.1:8554/audiomon` | `nvr/audio.py:230-235` |
| Test record | `-hide_banner -loglevel error -y <input> [-af <pan[,listen mix]>] -t <seconds> -c:a pcm_s16le <tmp>/dems-audio-test/uji-<epoch>.wav` | `nvr/audio.py:315-317` |

Bench device: first recording on real devices produced 3 audio files (FLAC by rule, one input each), all `complete`, hashes matching (`docs/SERAH-TERIMA.md:122-123`). Their content was practically silent: peak about -101 dBFS, cause not known (`docs/SERAH-TERIMA.md:126,187-188`). Three limits recorded in the hand-over document bear on "tested":

1. One full-scale sample at the start of the first recording after the EVO 8 is plugged, proven to repeat, entering the evidence file as a click; no handling exists (`docs/SERAH-TERIMA.md:180-186`).
2. Audio/video sync has never been measured correctly; all offsets are 0 (`docs/SERAH-TERIMA.md:165-168`).
3. Since 15:23 WIB on 12 October the plugged card is a 2-input "USB Audio CODEC" (PCM2902, USB 08bb:2902), not the EVO 8; with the automatic source, "Mic #1" and "Mic #2" moved to it without confirmation (`docs/SERAH-TERIMA.md:81,189-193`).

### TS-11. Discovery methods and intervals

Defaults: `discovery_interval_s` 30 s (range 5-600), `device_offline_after_s` 90 s (range 15-3600), `discovery_scope` default `"onvif"`, `deployment_mode` default `"lan"`, `follow_camera_ip` default true (`nvr/config.py:61-62`, `nvr/settings.py:27,45-49`). Discovery as a whole is switched by `NVR_DISCOVERY` (`nvr/config.py:55`, `nvr/main.py:54-56`).

| Method | How | Interval or timing | Evidence |
|---|---|---|---|
| Interface choice | the configured interface, else the first physical Ethernet interface that has an IPv4 address; physical = has `device`, no `wireless`, name not starting with `lo`, `docker`, `br`, `virbr`, `veth`, `tailscale`, `tun`, `tap`, `wg`, `zt`; subnet from settings or from the interface address | at start and on settings change | `nvr/discovery.py:43`, `nvr/discovery.py:78-79`, `nvr/discovery.py:316-331` |
| Link monitor | `carrier` of each physical Ethernet port; link down on the camera interface marks its devices offline, link up triggers a scan | every 2 s | `nvr/discovery.py:377-401` |
| WS-Discovery passive | UDP socket bound to port 3702 with `SO_REUSEADDR`, multicast group `239.255.255.250` joined on the camera interface; `Hello` marks seen, `Bye` marks offline; falls back to a random port (Probe only) when 3702 is taken | instant; receive wait 1.0 s per loop | `nvr/discovery.py:404-416`, `nvr/discovery.py:439-442`, `nvr/discovery.py:447-461` |
| WS-Discovery active | Probe for `dn:NetworkVideoTransmitter` sent from the same socket, multicast TTL 1, outgoing interface set to the server's camera-port IP | every `discovery_interval_s`, and at each scan | `nvr/discovery.py:172-182`, `nvr/discovery.py:417`, `nvr/discovery.py:425-438`, `nvr/discovery.py:509` |
| Scan loop | scope `all` and subnet of at most 1024 addresses and `NVR_SWEEP=1`: empty UDP datagram to port 9 of every host (forces ARP). Otherwise: the same poke only to neighbours the kernel already knows in the camera subnet | first after 1 s, then every `discovery_interval_s` or when kicked | `nvr/discovery.py:485-508`, `nvr/discovery.py:333-343`, `nvr/discovery.py:545-567` |
| ARP settle and read | wait `ARP_SETTLE_S = 8.0`, read `ip -j -4 neigh show dev <iface>`, alive = state `REACHABLE` or `PERMANENT` with a MAC inside the subnet | 8 s per scan | `nvr/discovery.py:44-45`, `nvr/discovery.py:88-96`, `nvr/discovery.py:510-513` |
| Ping of known devices | known devices not alive by ARP are pinged, 16 in parallel | per scan | `nvr/discovery.py:516-522` |
| Direct ONVIF check | unauthenticated `GetSystemDateAndTime` to `http://<ip>:80/onvif/device_service`, 2 s timeout, result cached `ONVIF_CHECK_TTL_S = 600` | per scan, for alive devices not yet known as ONVIF | `nvr/discovery.py:46`, `nvr/discovery.py:523-528`, `nvr/discovery.py:537-543` |
| Scope filter | with scope `onvif`, a device is recorded only if it is ONVIF, already known by IP, or already known by MAC | per scan | `nvr/discovery.py:529-534` |
| Camera heartbeat | for ONVIF or registered devices: `ping`, then TCP 554 and 80; offline after `HEARTBEAT_FAILS = 2` | every `HEARTBEAT_S = 3` s | `nvr/discovery.py:107-121`, `nvr/discovery.py:349-374` |
| Stale rule | a device not seen for `device_offline_after_s` is marked offline with reason `no_response` | per scan | `nvr/discovery.py:535`, `nvr/discovery.py:579-581` |
| Passive cable monitor | `sudo -n dems-netalias listen <iface> 60` runs `timeout 60 tcpdump -i <iface> -n -e -l -q -s 128 'arp or (udp and (port 67 or port 68 or port 3702))'`; lines parsed for ARP probe, announce, reply, DHCP request, WS-Discovery | continuous in 60 s chunks; retry after 30 s on error, 120 s when not permitted | `nvr/passive.py:20`, `nvr/passive.py:66-97`, `scripts/dems-netalias:24-30` |
| Manual ONVIF search | poke neighbours, Probe (multicast plus unicast to each neighbour) from the camera-port IP, direct ONVIF check of each neighbour, merged with the registry | on request, wait 2.5 s, capped at 10 s | `nvr/discovery.py:270-305`, `nvr/routers/admin.py:233-236` |
| Factory-IP scan | section 5.1 | on request | `nvr/factory.py:40-79` |
| Follow camera IP | when a known MAC appears at a new IP, registered cameras with that MAC get the new host in `host`, `rtsp_url`, `preview_url` | on detection | `nvr/discovery.py:616-619`, `nvr/discovery.py:643-656` |
| Sound card hot-plug | `/proc/asound/cards` compared with the previous reading | every 3 s | `nvr/audio.py:343-352` |
| Nothing is registered automatically | a detected device becomes a camera only by an admin action | - | `nvr/discovery.py:16`, `README.md:104` |

Stated detection times: `README.md:92-102` (link at most 2 s; Hello and Bye instant; Probe at most the interval; sweep at most interval + 8 s; camera unplugged about 5-8 s).

Unused code: the function `discover()` in `nvr/onvif_client.py:35-72` (a one-shot Probe with TTL 2 and a 3.0 s timeout) has no caller in `nvr/*.py` (Grep `onvif_client\.discover|[^_a-z]discover\(` returned only its definition). The running discovery is `nvr/discovery.py`.

Bench device: server laptop, camera port `enp3s0` 192.168.100.1/24 to an unmanaged PoE switch, `ufw` active (`docs/SERAH-TERIMA.md:78`). The WS-Discovery loop fix was tested with 0 exceptions (`docs/SERAH-TERIMA.md:106`). Three cameras were moved from factory addresses 192.168.1.10 to .12 into 192.168.100.0/24 and registered (`docs/SERAH-TERIMA.md:80,157-158`). Open findings on the bench: 25 office-LAN devices with an empty interface column were recorded while the camera cable was unplugged, cause not investigated (`docs/SERAH-TERIMA.md:194-198`); a device entry `192.168.0.90` without MAC on the camera port, possibly from the factory-IP check (`docs/SERAH-TERIMA.md:199-202`); `ufw` blocks incoming multicast, so WS-Discovery handling was tested in-process (`docs/SERAH-TERIMA.md:266-267`).

### 4.12 What "tested" covers, by device

| Bench item | What the documents record | Evidence |
|---|---|---|
| UNIVIEW IPC312LP (192.168.100.117) | ONVIF registration, both RTSP profiles opened, H.265 on both streams although ONVIF reports H264, no audio, keyframe every 2 s, one real recording | `docs/SERAH-TERIMA.md:79,109,122-124` |
| 3 x Tiandy TC-C320N (192.168.100.101-103) | Moved from factory IPs, registered, one real recording each, 1920x1080 25 fps H.265 although ONVIF reports H264 | `docs/SERAH-TERIMA.md:80,122-124` |
| Four rooms at once on real cameras | 4 sessions, 7 files (4 video, 3 audio), 54-57 s, all `complete`, hashes match, staggered stop worked | `docs/SERAH-TERIMA.md:122-123` |
| Audient EVO 8 | Recognised, in the shared-capture configuration, four parallel record processes; real recording silent; first-open full-scale sample; inputs 5-6 loopback | `docs/SERAH-TERIMA.md:82,110,126,177-186` |
| Burr-Brown PCM2902 "USB Audio CODEC" | Plugged since 15:23 WIB; not checked for the first-sample behaviour | `docs/SERAH-TERIMA.md:81,186` |
| Behringer UMC202HD | Earlier card, 2 inputs, not plugged | `docs/SERAH-TERIMA.md:83`, `README.md:26` |
| Onboard laptop card + virtual cameras (H.264 `libx264` test pattern) | Multi-room test 29/29: 8 rooms at once, 2 rooms on one card, bit-exact input separation, independent stop, allocation validation, hashes, audit, playback copies | `docs/SERAH-TERIMA.md:107,112,221-222`; `scripts/uji/uji_multi_ruangan.py:119-121` |
| Not tested on physical hardware | dual-lens camera, camera with microphone, 8 cameras at once, audio interface with more than 2 inputs in one source, 8-input interface, A/V sync, stream-loss reconnect | `README.md:206-209`, `docs/SERAH-TERIMA.md:165-173` |

## 5. Non-recording tools

Four tools named by the blueprint. For each: where it lives, how it is reached, what it drives, what it writes.

### 5.1 Factory-IP scan

| Aspect | Fact | Evidence |
|---|---|---|
| Module | `nvr/factory.py`, function `scan()`; uses `nvr/netalias.py`, `nvr/discovery.py` | `nvr/factory.py:40-79` |
| Reached by | `POST /api/v1/devices/scan-factory`, admin only; web UI "Scan IP default pabrik" and the wizard | `nvr/routers/devices.py:70-78`, `nvr/web/index.html:793`, `nvr/web/index.html:1010` |
| Targets | `factory_default_ips`, default `192.168.1.64`, `192.168.1.108`, `192.168.0.90`, `192.168.1.13` (Hikvision, Dahua, Axis, Uniview per the comment); at most 32; private IPv4 only | `nvr/settings.py:53-57`, `nvr/settings.py:69-78` |
| Steps | group targets by `/24`; ensure the server has an address in each (`reach`, alias `<subnet>.<factory_alias_host>` default 253, lifetime `factory_alias_minutes` default 30); WS-Discovery probe from that address (multicast plus unicast); `ping` and direct ONVIF check, 8 in parallel; read the neighbour table for the MAC | `nvr/factory.py:29-37`, `nvr/factory.py:44-67`, `nvr/settings.py:58-59` |
| Conflict detection | more than one ONVIF endpoint reference answering from one IP is reported as `conflict` (several cameras with the same IP) | `nvr/discovery.py:210-214`, `nvr/factory.py:70-72` |
| Writes: database | `devices` rows through `discovery.service._seen(ip, mac, "factory-scan", ...)` with the audit entries of the registry (`device.discovered`, `device.online`, `device.ip_changed`); `settings` row `net_aliases` | `nvr/factory.py:68-69`, `nvr/discovery.py:603-641`, `nvr/netalias.py:96-99` |
| Writes: audit | `device.factory_scan` with targets, found, errors; `network.alias_add`; later `network.alias_remove` | `nvr/factory.py:76-77`, `nvr/netalias.py:101-102`, `nvr/netalias.py:133-134` |
| Writes: outside the application | adds an IP address to the host's camera interface (`ip addr add <cidr> dev <iface>`, directly or through the sudo helper) | `nvr/netalias.py:36-54`, `scripts/dems-netalias:43` |
| Privilege | `CAP_NET_ADMIN` on the service, or the helper through `sudo -n`; the helper accepts only a private `/24` on an existing interface | `nvr/netalias.py:8-10`, `scripts/dems-netalias:21-22,32-35` |

### 5.2 Set camera IP (and the new-camera wizard)

| Aspect | Fact | Evidence |
|---|---|---|
| Module | `nvr/factory.py`, function `set_ip()`; SOAP in `nvr/onvif_client.py`, method `set_network()` | `nvr/factory.py:82-104`, `nvr/onvif_client.py:200-230` |
| Reached by | `POST /api/v1/devices/{device_id}/set-ip`, admin only; body: `dhcp`, `address`, `prefix_length` (8-30, default 24), `gateway`, `username`, `password`, `port` | `nvr/routers/devices.py:81-99` |
| ONVIF operations | `GetNetworkInterfaces` (token), `SetNetworkInterfaces` (manual address with prefix, or DHCP), `SetNetworkDefaultGateway` when a gateway is given (failure becomes a warning), `SystemReboot` when the camera answers `RebootNeeded` true (error ignored because the connection may drop) | `nvr/onvif_client.py:204-230` |
| Reachability | calls `reach(old_ip, ...)` first: no alias when the server is already in that subnet | `nvr/factory.py:94`, `nvr/netalias.py:87-92` |
| Writes: database | none directly; the camera reappears through discovery and is followed by MAC | `nvr/factory.py:102-104` |
| Writes: audit | `device.set_ip` with MAC, old IP, mode, new IP, prefix, gateway, reboot flag, warnings. The camera password is not in the details | `nvr/factory.py:99-101` |
| Writes: outside the application | changes the camera's own network configuration and may reboot it | `nvr/onvif_client.py:202-203` |
| Wizard | `start_provision()` runs `_provision()` in a thread: reach the factory IP, ONVIF check, read MAC, pick `new_ip` or `next_free_ip()`, refuse when the new IP answers ping, set the network, wait up to 180 s for the same MAC at the new IP, mark seen, optionally register to a room | `nvr/factory.py:137-203`; endpoint `nvr/routers/devices.py:113-139` |
| Wizard writes | in-memory `jobs` dict (password removed from the stored parameters); audit `device.set_ip` with `via: wizard`; `devices` row; when a room is given, `cameras` rows and audit `camera_device.register` | `nvr/factory.py:134,139-140`, `nvr/factory.py:171-173`, `nvr/factory.py:185-193` |
| Next free IP | first host from `<subnet>.<camera_ip_start>` (default 101) that is not a known device, a registered camera host or a live neighbour and does not answer ping; at most 40 candidates in batches of 8 | `nvr/factory.py:108-131`, `nvr/settings.py:62` |
| One job at a time | a second wizard is refused while one runs | `nvr/routers/devices.py:129-130` |

### 5.3 Gain calibration

Location, which the blueprint asked this row to establish: the calibration logic is in `nvr/audio.py` (mixer, meter, test record), its API in `nvr/routers/audio.py`, its UI in `nvr/web/index.html:564-660`. There is no separate calibration module.

| Part | Fact | Evidence |
|---|---|---|
| Read gain controls | `amixer -c <card> scontents`, keeping controls that have a capture volume or whose name matches `capture\|mic\|line\|input\|boost`; returns name, percent, dB | `nvr/audio.py:155-175` |
| Set gain | `amixer -c <card> sset <control> <0-100>% cap`; card and control names validated by pattern | `nvr/audio.py:178-185` |
| Endpoint | `POST /api/v1/audio/mixer`, admin only | `nvr/routers/audio.py:70-79` |
| Level meter | one FFmpeg with `asetnsamples=n=4800:p=0,astats=metadata=1:reset=1,ametadata=mode=print:file=-`; peak and RMS per channel; a peak of at least -0.1 dBFS counts as a clip; values floored at -120 | `nvr/audio.py:216-217`, `nvr/audio.py:251-264` |
| Live monitor | same process, Opus 96 kbit/s to MediaMTX path `audiomon`, heard through WebRTC; one input solo or a mono mix | `nvr/audio.py:189`, `nvr/audio.py:220-235`; endpoint `nvr/routers/audio.py:121-142` |
| Meter lifetime | stops after 30 s without a poll; the UI polls every 200 ms | `nvr/audio.py:17,266-271`, `nvr/web/index.html:631-638` |
| UI targets | scale -60 to 0 dBFS, guide lines at -18 and -12, red from -1, amber from -6 | `nvr/web/index.html:602-603,608-609,636` |
| Test record | 1-15 s (UI uses 5 s), 16-bit WAV in `<tmp>/dems-audio-test`, files older than 1 hour deleted, served with a 1-hour media token | `nvr/audio.py:299-321`, `nvr/routers/audio.py:158-179`, `nvr/web/index.html:643` |
| A/V offset | `av_offset_ms` per audio source, -2000 to 2000, applied only in the playback copy | `nvr/routers/audio.py:32-33,43`, `nvr/playback.py:119` |
| Writes: audit | `audio.mixer` with card, control, percent and the resulting value; `audio_source.create`, `audio_source.update` when a source or its offset is saved | `nvr/routers/audio.py:77-78,198-199,247` |
| Writes: database | `cameras.device_info.audio` and `cameras.device_info.av_offset_ms` of the audio source row. The meter and the test record write no database row | `nvr/routers/audio.py:192-195,240-245` |
| Writes: files | temporary WAV files outside the data folder; the shared-capture ALSA configuration is regenerated when needed | `nvr/audio.py:299,310-314`, `nvr/audio.py:210,306` |
| Writes: hardware | the gain is set in the sound card's mixer. The application stores no gain value of its own (only the audit entry) | `nvr/audio.py:181-185` |
| Bench facts | EVO 8 gain is the mixer control `Mic`, 0-116 = -8 to +50 dB in 0.5 dB steps; a setting made with `amixer` directly is not in the audit log; the setting was lost after the EVO 8 was unplugged and plugged again; 48V state cannot be read from the laptop | `docs/SERAH-TERIMA.md:94-98` |
| Measuring aid | `scripts/uji/level_audio.py` reads a 6-channel WAV and prints peak, RMS, clip count for inputs 1-4; reference levels in the hand-over document | `scripts/uji/level_audio.py:5-14`, `docs/SERAH-TERIMA.md:248-257` |

### 5.4 Doctor (system diagnostics)

| Aspect | Fact | Evidence |
|---|---|---|
| Module | `nvr/doctor.py`, `run_checks()` and CLI `main()` (exit code 1 when any check is `error`) | `nvr/doctor.py:43-184`, `nvr/doctor.py:195-208` |
| Reached by | `GET /api/v1/system/check` (admin); `.venv/bin/python -m nvr.doctor`; the installer; the laptop start script; the commissioning steps | `nvr/routers/devices.py:149-154`, `scripts/install.sh:206-208`, `scripts/start-lan-test.sh:49`, `nvr/commissioning.py:19-22` |
| Checks | programs `ffmpeg`, `ffprobe`, `tcpdump`, `arecord`, `amixer`, `setpriv`, `ip`; installer marker `/etc/dems-nvr/install.json` with matching version; network helper installed, same SHA-256 as the project copy, allowed through `sudo -n -l`; `audio` group membership or `/dev/snd` access; each enabled audio source resolves to a plugged card with enough inputs; MediaMTX API answers; NTP synchronised; disk against `min_free_gb`; JWT secret from the service configuration; camera interface and link | `nvr/doctor.py:50-56`, `nvr/doctor.py:60-71`, `nvr/doctor.py:74-89`, `nvr/doctor.py:94-107`, `nvr/doctor.py:110-131`, `nvr/doctor.py:134-142`, `nvr/doctor.py:145-149`, `nvr/doctor.py:152-161`, `nvr/doctor.py:164-167`, `nvr/doctor.py:170-183` |
| Output | list of `{id, label, status ok/warn/error, detail, fix}`; `fix` is a command, usually the installer | `nvr/doctor.py:25-26`, `nvr/doctor.py:21-22` |
| Writes | It calls `init_db()` before anything else, which creates the database tables and adds missing columns when they do not exist. It writes no audit entry and no settings row of its own | `nvr/doctor.py:44-45`, `nvr/db.py:249-272` |
| Its result is stored by another module | `commissioning.complete()` embeds the diagnostics in the `settings` row `commissioning` and in the audit entry `system.commissioned` | `nvr/commissioning.py:84-95` |
| Reads but does not write | `cameras` rows of kind audio; sound card facts; `/etc/dems-nvr/install.json`; helper file hashes | `nvr/doctor.py:115-117`, `nvr/doctor.py:60-63`, `nvr/doctor.py:74` |

### 5.5 Adjacent installation tools (not among the four, listed because they write records or host state)

| Tool | What it writes | Evidence |
|---|---|---|
| Temporary IP alias (`nvr/netalias.py`, `scripts/dems-netalias`) | `settings` row `net_aliases`; audits `network.alias_add`, `network.alias_remove`, `network.alias_remove_failed`; host interface addresses | `nvr/netalias.py:21,96-102,130-134` |
| Passive cable monitor (`nvr/passive.py`) | `devices` rows; audit `device.dhcp_request`; may add an alias | `nvr/passive.py:114,131,138` |
| Commissioning (`nvr/commissioning.py`) | `settings` row `commissioning`; audits `system.commissioned`, `system.commissioning_reset`; gates REKAM | `nvr/commissioning.py:88-95,106`, `nvr/service.py:112-115` |
| Installer (`scripts/install.sh`) | packages, user `dems`, `audio` group, helper in `/usr/local/sbin`, sudoers file, ufw rules, `/etc/dems-nvr.env` with a generated JWT secret and admin password, systemd units, `/etc/dems-nvr/install.json` | `scripts/install.sh:36-37,75-87,123-124,139-144,148-181,194-198` |
| Stream test (`POST /cameras/{id}/test`) | `cameras.device_info.last_test`; no audit entry | `nvr/routers/admin.py:403-425` |

## 6. Source against decisions row P3

P3 (`docs/2026-10-12_input_av_core_adapter_plan/decisions/decisions.md:9`) is the controller's wording. The source governs; differences are listed, none is judged.

| P3 wording | What the source says | Difference |
|---|---|---|
| "ONVIF main stream" | Registration of a physical camera picks, per video source, the profile with the largest pixel area (`nvr/onvif_client.py:248-249`). The single-camera path picks the named token or the first profile (`nvr/onvif_client.py:268-269`). An admin can switch a camera to record the sub stream (`nvr/db.py:98-102`). A camera can also be registered with a hand-typed RTSP URL and no ONVIF (`nvr/routers/admin.py:254-256`) | "Main stream" is a selection rule with two variants and one override, not a fixed profile. One channel per lens is part of the scheme |
| "over RTSP/TCP" | `-rtsp_transport tcp` (`nvr/recorder.py:217`) | Matches |
| "stream copy" | Video is copied. Camera audio, when present, is re-encoded to AAC 48 kHz 128 kbit/s into the same MPEG-TS (`nvr/recorder.py:148-149`) | P3 does not mention that camera audio is transcoded, nor that only the first video and first audio stream are taken |
| "the codec the camera delivers (H.265 on the four bench cameras)" | No codec test exists on the record path; the ONVIF `Encoding` value is stored and not used (`nvr/onvif_client.py:176`). The four bench cameras deliver H.265 while ONVIF reports H264 (`docs/SERAH-TERIMA.md:79-80`) | Matches, with one addition: the ONVIF-reported encoding is wrong on all four bench cameras |
| (not in P3) | The record container is MPEG-TS, chosen because many H.265 cameras do not send parameter sets at RTSP session start (`nvr/recorder.py:3-6`, `README.md:200-201`) | The container is part of why copy works for these cameras. P3 places the stored form under Q8; the stated reason concerns ingest as well |
| "USB Audio Class card through ALSA shared capture" | `dsnoop` plus `plug` per card, generated configuration, `ALSA_CONFIG_PATH` (`nvr/audio.py:463-488`). `pulse:` sources are also accepted and are exclusive (`nvr/audio.py:40-43`, `nvr/routers/audio.py:52-61`). Non-USB ALSA cards are listed too (`nvr/audio.py:30-37`) | Matches for the default path. The USB requirement is a product statement (`README.md:192-194`) and the rule of the automatic source (`nvr/audio.py:103-106`), not a restriction of the capture code |
| "all device channels opened then inputs selected" | `capture_channels` and `audio_select_filter` (`nvr/recorder.py:104-116`) | Matches. Addition: with a 1- or 2-channel card and all inputs selected in order, no filter is applied |
| "24-bit / 48 kHz" | Defaults of the API model: `bits = 24`, `sample_rate = 48000`; allowed 16/24/32 and 8000-192000 Hz (`nvr/routers/audio.py:25-26,189-190`). The card itself is opened in its native format, preferred order S32_LE, S24_3LE, S24_LE, S16_LE, at one rate per card (`nvr/audio.py:396,476-477`) | 24-bit / 48 kHz is the default request to the plug layer, not the hardware format and not a fixed value. One rate per card is a hard rule |
| "separate lossless FLAC/WAV" (stored form, left open by P3) | FLAC for 1-2 inputs, WAV RF64 PCM for more than 2 (`nvr/recorder.py:119-127`) | Matches |
| (not in P3) | Reconnect as numbered parts, each hashed; media-start estimate for A/V alignment; process tied to the parent's life; device pinned per session; identity of the card in the session-start audit | Parts of the tested scheme that P3 does not name; see TS-5, H-08, H-09, H-14 |
| "tested" | See 4.12. Audio on real hardware produced silent files; the bit-exact audio proof used the onboard laptop card and virtual H.264 cameras; reconnect, A/V sync, WAV RF64, camera audio, dual-lens and 8-input interfaces have no physical test on record | The bench supports the camera scheme on four H.265 cameras; the audio scheme is proven in logic and on a 2-channel onboard card, not yet with audible content on the USB interface |

## 7. Other differences between documents and code (reported as found)

| Item | Document | Code | Evidence |
|---|---|---|---|
| Evidence file type in the test checklist | "2 file MP4" | evidence is `.ts` | `docs/UJI-LAN-KANTOR.md:93`; `nvr/service.py:154` |
| Tested physical cameras | README: only the UNIVIEW | hand-over: UNIVIEW plus three Tiandy | `README.md:206`; `docs/SERAH-TERIMA.md:80` |
| API version | title version `0.2.0` | application `0.3.0` | `nvr/main.py:65`; `nvr/__init__.py:2`; noted in `docs/SERAH-TERIMA.md:208` |
| README code table | lacks `audio`, `commissioning`, `doctor`, `playback`, `storage`, `passive`, `registration` | modules exist | `README.md:165-180`; `docs/SERAH-TERIMA.md:203-207` |
| Systemd capability | README says run the service with `AmbientCapabilities=CAP_NET_ADMIN` on the board | the shipped unit sets no capability and says the helper runs through sudo | `README.md:139-140`; `deploy/dems-nvr.service:19-20` |
| Git | "Proyek belum memakai git" | the folder sits untracked inside the DEMS repository | `docs/SERAH-TERIMA.md:24`; `git status --short apps/input-av` on 2026-10-12 |

## 8. Gaps / needs investigation

- `nvr/web/index.html` was read only at lines 560-661 and by one Grep. Hardware know-how that lives only in other UI text was not looked for.
- `docs/API-TABLET.md` was read by Grep only (codec, preview, audio terms); no hardware parameter was found there (`docs/API-TABLET.md:41-42,132-135`).
- The generated ALSA configuration file and every recorded value under `data/` were not opened. The native capture format the EVO 8 reports, and the actual content of the generated file, are therefore unknown to this report.
- The meaning of `-timeout 5000000` for the FFmpeg version on the bench was not verified (HYPOTHESIS in TS-4).
- Why the ONVIF media service reports H264 for H.265 streams was not established (HYPOTHESIS in TS-2).
- No observed result exists for: reconnect on a physical camera, camera audio to AAC, WAV RF64, dual-lens, an 8-input interface, A/V sync.
- The camera models' audio capability is stated only for the UNIVIEW (none); the Tiandy cameras' audio is not stated in the documents.
- `bin/mediamtx` is a binary; its version is known only from the scripts (`v1.9.3`, `scripts/install.sh:30`, `scripts/start-lan-test.sh:10`).

## 9. External technology landscape

No external technology landscape sources identified for this task scope. The row is a local source inventory; no web search was run.

---
*Generated: 2026-10-12 17:22*
*Last Updated: 2026-10-12 17:22*
