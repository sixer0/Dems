# LCD backend for DEMS

Imported from the user's `Downloads/backend-lcd.zip` on 2026-10-19. Python HTTP service → USB serial ESP32 panel, protocol JSON v2, 115200 baud. The archive contained no panel firmware; firmware/hardware compatibility still needs an attended check.

The DEMS Core owns the recording truth. This service only displays it; its HTTP `rec=start` endpoint does not start a DEMS recording. Use **Devices & Inputs → Front Panel → LCD connection** in the Live console to inspect configuration, channel state, HTTP reachability and USB responses. The existing SVG is a preview, not a screenshot of the ESP32.

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
| CH3/CH4 | Unused, always STOP / camera disconnected |

Use two to four channels; preserve this order. Custom names may be supplied with `DEMS_CH_NAMES`; the Core maps by channel number. A real capture reports REKAM only after durable capture, with an assigned online source, a LIVE stream and a REC/DEGRADED track. STOPPING, lost cameras, failed starts and an unavailable Core never report REKAM. A Core using simulated capture sends its simulated recording state; the ESP32 protocol does not have a DEMO badge, so use this only for demonstrations when simulated capture is enabled.

Every two seconds Core sends each channel's `rec`, `cam`, `lease:6`, `clear_file:true`. No evidence filename/path, case name, operator identity, camera credential or session token is sent. Each request has a one-second timeout; updates do not overlap. Partial failures drop the console's last channel claims. If Core crashes or the service stops receiving updates, REKAM expires after six seconds (plus up to one second for the reaper). On orderly shutdown Core attempts STOP on every known channel.

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

Requirements on this host: the ESP32 panel on `/dev/ttyACM0`; `pyserial` for the system interpreter
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
