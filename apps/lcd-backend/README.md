# LCD backend for DEMS

Back to the [repository README](../../README.md).

Imported from the user's `Downloads/backend-lcd.zip` on 2026-10-19. Python HTTP service → USB serial ESP32 panel, protocol JSON v2, 115200 baud. The archive contained no panel firmware; firmware/hardware compatibility still needs an attended check.

The DEMS Core owns the recording truth. This service only displays it; its HTTP `rec=start` endpoint does not start a DEMS recording. Use **Devices & Inputs → Front Panel → LCD connection** in the Live console to inspect configuration, channel state, HTTP reachability and USB responses. The existing SVG is a preview, not a screenshot of the ESP32.

## Role in DEMS and how it talks

| Peer | How |
|---|---|
| ESP32 front panel | USB serial at 115200 baud, one JSON line per message (panel protocol v2). The panel asks for status; the backend answers with the channel strip, aggregate state, health and identity lines |
| Core server (`apps/core-server/src/lcd/`) | Every 2 s the Core posts each channel's state to `/api/dems/ch/<n>/status` on `DEMS_LCD_BACKEND_URL` (`http://127.0.0.1:8090` on the bench host) and reads `/api/dems/status` around each update and for the console's LCD view (operation 114). The console's pre-delivery panel setup (operations 115 and 116, decision D57) is proxied by the Core to `/api/dems/identity`, `/api/dems/logo` and `/api/dems/setup`; the backend checks each write against the Core's own session routes under `/api/v1/auth` at `DEMS_CORE_URL` |
| Operators | `GET /` monitor page, `GET /healthz`, `/api/dems/ch/<id>/status`, `/api/dems/log`, `/api/dems/identity`, `/api/dems/logo`, `/api/dems/setup` (the route list is the header of `app/dems_backend.py`) |

It is a single Python 3 file using the standard library HTTP server and `pyserial` 3.5 (Pillow is used for logo conversion when present, with a pure-PNG fallback). It listens on `127.0.0.1:8090` by default and has no authentication.

## Folder layout

| Path | What it holds |
|---|---|
| `app/dems_backend.py` | The service: HTTP API, serial worker, health, identity and logo upload |
| `tests/test_backend.py` | Unit tests (serial import stubbed; never opens USB) |
| `dems-lcd.service` | An earlier copy of the systemd unit; the unit installed on the bench host is `deploy/bench-config/systemd/dems-lcd.service` (section **Systemd service** below) |
| `Dockerfile`, `compose.yaml` | Optional Linux Docker bench service |

## Native service (Mac or Linux)

From the repository root, create a dedicated environment and install the pinned serial dependency:

```sh
python3 -m venv .cache/lcd-venv
.cache/lcd-venv/bin/python -m pip install pyserial==3.5
```

Set the actual serial device and the **same media root as this Core**. The directory must exist and be readable so disk health is meaningful. Example for Linux, where this Core uses `/var/lib/dems/media/sessions`:

```sh
DEMS_BIND=127.0.0.1 DEMS_PORT=8090 \
DEMS_DEV=/dev/ttyACM0 DEMS_BAUD=115200 \
DEMS_REKAM_DIR=/var/lib/dems/media/sessions \
DEMS_CH_NAMES=CH1,CH2,CH3,CH4 DEMS_LEASE_S=6 \
.cache/lcd-venv/bin/python -B apps/lcd-backend/app/dems_backend.py
```

On macOS use the panel's actual `/dev/cu.usbmodem…` device. Give the service account access to the serial device on Linux. Run one backend per panel and configure **one Core instance only** to publish to it; two Cores would overwrite each other's status. Stop the service before flashing ESP32 firmware.

In the Core process environment add this setting, preserving that process's existing capture/database configuration, then restart Core:

```sh
export DEMS_LCD_BACKEND_URL=http://127.0.0.1:8090
```

Unset the variable and restart Core to disable integration. Only explicit `http://127.0.0.1:<port>` URLs are accepted. Backend and Core run on the same host/network namespace. No URL is accepted from a browser; no CORS or unauthenticated proxy is added to Core. Backend HTTP itself has no authentication and must remain private to this host.

## Channel and failure behavior

| Panel | DEMS source |
|---|---|
| CH1 | VIDEO-01 (whatever physical camera that track is assigned) |
| CH2 | VIDEO-02 |
| CH3 | VIDEO-03 |
| CH4 | VIDEO-04 |

Correction (2026-11-06, decision D60): the Core records up to four video tracks, so CH3 and CH4 now carry VIDEO-03 and VIDEO-04 (before, they were unused). Each line also carries the device behind the track (`dev`); with `DEMS_CH_MODE=device` the backend merges tracks of the same physical camera into one panel channel, with `track` (the default) one track is one channel. Since fix wave W4 (D246) the camera lamp is lit only for a reachable camera or an open stream.

Use two to four channels; preserve this order. Custom names may be supplied with `DEMS_CH_NAMES`; the Core maps by channel number. A real capture reports REKAM only after durable capture, with an assigned online source, a LIVE stream and a REC/DEGRADED track. STOPPING, lost cameras, failed starts and an unavailable Core never report REKAM. A Core using simulated capture sends its simulated recording state; the ESP32 protocol does not have a DEMO badge, so use this only for demonstrations when simulated capture is enabled.

Every two seconds Core sends each channel's `rec`, `cam`, `dev`, `lease:6`, `clear_file:true`. No evidence filename/path, case name, operator identity, camera credential or session token is sent. Each request has a one-second timeout; updates do not overlap. Partial failures drop the console's last channel claims. If Core crashes or the service stops receiving updates, REKAM expires after six seconds (plus up to one second for the reaper). On orderly shutdown Core attempts STOP on every known channel.

HTTP success alone is not USB success. Panel “Responding” requires a status request received from the ESP32 within ten seconds and a serial response sent. This confirms communication, not physical rendering. Backend health uses its own disk/panel checks; it is not a hardware certification.

## Optional Linux Docker bench service

Native service is preferred for the current DEMS production host profile, which prohibits a container runtime. Docker is only a bench/demo alternative. No Docker deployment was performed as part of this integration.

```sh
export DEMS_LCD_RECORDINGS_DIR=/absolute/path/to/the/core/media/root
export DEMS_LCD_SERIAL_DEVICE=/dev/ttyACM0
export DEMS_LCD_DIALOUT_GID=20  # replace with the actual device group id
export DEMS_LCD_UID=1000        # use an account that can read the Core media directory
export DEMS_LCD_GID=1000
docker compose -f apps/lcd-backend/compose.yaml up -d --build
```

Uses the Linux host daemon that sees the serial device, loopback-published port 8090, a read-only recordings mount and a non-root process. A backend container uses `DEMS_BIND=0.0.0.0` inside its namespace; only host loopback is published. If Core is also in a container, it must share the host/network namespace to reach this loopback address. This does not resolve the separate task-4 production-container boot limitations.

## Verification

```sh
python3 -B -m unittest discover -s apps/lcd-backend/tests
npm run test -w @dems/core-server -- src/lcd
```

Tests stub the serial import and never open USB. The Core integration test launches the actual imported Python HTTP handler, sends recording and stop states and observes lease expiry. Hardware test: connect ESP32, set the actual serial path, verify USB responses in the console, start/stop a demo session, then stop Core and check that the panel leaves REKAM within about seven seconds. Real production recording still needs the user's explicit authorization under the existing task-4 gate.

Local changes from the archive: native bind defaults to loopback; repeated START heartbeats preserve recording start time; compose paths, device/group and media-root configuration adapted to the repository. The archive's deploy script (which replaces containers and accesses the host daemon) was not imported or executed. Python bytecode was not imported.

## Systemd service (DEMS Edge production host)

Correction (2026-11-06, decisions D274, D275): the byte-for-byte copy of the unit installed on the bench host is now [`deploy/bench-config/systemd/dems-lcd.service`](../../deploy/bench-config/systemd/dems-lcd.service), with the install guide in [`deploy/bench-config/README.md`](../../deploy/bench-config/README.md). It differs from `apps/lcd-backend/dems-lcd.service` in this folder: it selects the panel by its `/dev/serial/by-id/...` path and `DEMS_USB_SERIAL`, and adds `DEMS_CH_MODE=device` and `DEMS_IDENTITY_FILE`. Install from `deploy/bench-config/`; the paragraphs below describe the earlier copy.

The unit actually used on this host is versioned here as `dems-lcd.service`. It runs the backend as
the `dems-core` system account with `SupplementaryGroups=dialout`, so no permanent group membership
is added to that account, and it reads the **same** `/etc/dems/core.env` as `dems-core.service`:
`DEMS_SATKER` (line 3 of the panel) and `DEMS_MEDIA_DIR` (the disk-health source) are then
configured in one place for the whole machine. The backend accepts `DEMS_REKAM_DIR` and falls back
to `DEMS_MEDIA_DIR`, so no second media path has to be maintained.

```sh
# install / update the service
sudo -S -p '' install -m 0644 apps/lcd-backend/dems-lcd.service /etc/systemd/system/dems-lcd.service
sudo -S -p '' systemctl daemon-reload && sudo -S -p '' systemctl enable --now dems-lcd.service
systemctl status dems-lcd --no-pager -n 0
journalctl -u dems-lcd -f          # device log lines are prefixed with 'panel:'

# promote an edited app/dems_backend.py to the installed tree
sudo -S -p '' install -m 0644 -o root -g root \
  apps/lcd-backend/app/dems_backend.py /opt/dems/core/apps/lcd-backend/app/dems_backend.py
sudo -S -p '' systemctl restart dems-lcd
```

Requirements on this host: the ESP32 panel on a USB serial port (the earlier unit names `/dev/ttyACM0`; the installed unit names the adapter's `/dev/serial/by-id/` path, because the `ttyACM` number moves when the cable is re-plugged); `pyserial` for the system interpreter
(here python 3.12 + pyserial 3.5 are already present, so the venv above is optional); and a media
root the service user can `stat()`. If the media root is unreadable the health check silently
reports `dir tak terbaca` and the panel stays on WASPADA forever.

Stop the service before flashing ESP32 firmware (`sudo systemctl stop dems-lcd`) — it is the single
holder of the serial port. To disable only the Core side, remove `DEMS_LCD_BACKEND_URL` from
`/etc/dems/core.env` and restart `dems-core.service`; the panel keeps `NETWORK=OK` and simply stops receiving
pushes: the six-second lease is what
releases any channel that was REKAM (`bridge.close()` also sends an explicit all-stop with
`cam:false` on a clean Core exit). `LINK_STALE_MS` and the red `BACKEND DIAM` line appear only
when THIS backend stops or the USB cable is pulled, not when Core stops.

**Never publish port 8090.** This API has no authentication and its `rec=start` endpoint moves real
relay contacts. It binds loopback, and the host firewall (`ufw`, default deny incoming) keeps it
there. Console access for another PC is a separate, temporary decision: expose only the console
port, bound to the LAN interface address rather than `0.0.0.0`, so the camera network cannot reach
it either.

## Configuration

All settings are environment variables read by `app/dems_backend.py`. In production they come from the shared `/etc/dems/core.env` plus the unit's `Environment=` lines; the template [`deploy/bench-config/core.env.example`](../../deploy/bench-config/core.env.example) lists them. No real value belongs in the repository.

| Variable | Default | Purpose |
|---|---|---|
| `DEMS_BIND`, `DEMS_PORT` | `127.0.0.1`, `8090` | Listen address and port. Keep the bind on loopback |
| `DEMS_DEV` | `/dev/ttyACM0` | Serial device of the panel |
| `DEMS_USB_SERIAL`, `DEMS_USB_VIDPID` | empty | Find the panel by its USB serial number (and vendor:product id) when `DEMS_DEV` is gone |
| `DEMS_BAUD`, `DEMS_DTR`, `DEMS_RTS`, `DEMS_USB_RETRY_S` | `115200`, `1`, `1`, `2` | Serial line settings and reopen backoff |
| `DEMS_REKAM_DIR` (falls back to `DEMS_MEDIA_DIR`) | | Media root whose free space drives the disk health |
| `DEMS_MIN_FREE_GB`, `DEMS_CRIT_FREE_GB` | `20`, `5` | Free-space warning and critical thresholds |
| `DEMS_CH_NAMES` | `CH1,CH2,CH3,CH4` | Channel names; the count is the number of names |
| `DEMS_CH_MODE` | `track` | `track` or `device` (see **Channel and failure behavior**) |
| `DEMS_LEASE_S`, `DEMS_CH_STALE_S`, `DEMS_PANEL_SILENT_S`, `DEMS_PUSH_S` | `0`, `0`, `10`, `1.0` | Default start lease, stale-channel warning, panel-silent limit, push interval |
| `DEMS_SATKER`, `DEMS_CLIENT` | empty | Identity lines 3 and 2 of the panel header |
| `DEMS_IDENTITY_FILE`, `DEMS_LOGO_DIR` | empty, then `/var/lib/dems-lcd` | Where identity and logos persist across restarts |
| `DEMS_PROVISION_KEY` | empty | Secret that guards writing the client name (`X-Provision-Key` header). Generate it at deploy time; never commit it |
| `DEMS_CORE_URL`, `DEMS_CORE_CONSOLE_ORIGIN` | `http://127.0.0.1:4420`, `http://127.0.0.1:5173` | Core address for the setup page's sign-in check |
| `DEMS_SETUP_TTL_S` | `900` | Lifetime of a setup page session |
| `DEMS_LOGO_*` (`CHUNK`, `ACK_S`, `GAP_S`, `MAX_TRIES`, `REPUSH_MIN_S`, `WAIT_S`, `AUTOPUSH`, `MAX_BYTE`, `MAX_W`, `MAX_H`) | see the file | Logo upload to the panel |

## Production notes

- systemd unit `dems-lcd`, user `dems-core` with supplementary group `dialout`, port 8090 on `127.0.0.1` (status: `GET /api/dems/status`).
- Unit file and install guide: [`deploy/bench-config/README.md`](../../deploy/bench-config/README.md).
- On the Core side, `DEMS_LCD_BACKEND_URL=http://127.0.0.1:8090` in `/etc/dems/core.env` turns the bridge on.
