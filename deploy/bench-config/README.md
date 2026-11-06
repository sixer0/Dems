# Bench host configuration

This folder holds the systemd units and the nftables rule of the DEMS bench host (a single Linux machine that runs Core, web console and LCD front panel from `/opt/dems/core`), plus a template for the Core's environment file. Decisions D274 and D275.

The unit files and the nft rule are byte-for-byte copies of the files installed on the bench host on 2026-11-06. They contain no secret values. **The real environment file `core.env` is NOT in this repository and must never be.** Only the template `core.env.example` is published; every value is configured at deploy time (section **Configure it yourself at deploy time**).

## Files

| File in this folder | What it is | Installs to | Owner | Mode |
|---|---|---|---|---|
| `systemd/dems-core.service` | The Core server (Node, `apps/core-server`), as user `dems-core`. Reads `/etc/dems/core.env`. Requires `dems-loopback-rule.service`, starts after `postgresql@18-main` | `/etc/systemd/system/dems-core.service` | root:root | 0644 |
| `systemd/dems-console.service` | The web console (Vite server of `apps/core-web`, 127.0.0.1:5173), as user `dems-console` | `/etc/systemd/system/dems-console.service` | root:root | 0644 |
| `systemd/dems-console.service.d/production-lock.conf` | Drop-in: sets `VITE_DEMS_PRODUCTION_LOCK=1` for the console | `/etc/systemd/system/dems-console.service.d/production-lock.conf` | root:root | 0644 (directory 0755) |
| `systemd/dems-lcd.service` | The LCD front-panel backend (`apps/lcd-backend`, Python, 127.0.0.1:8090), as user `dems-core` with group `dialout`. Reads the same `/etc/dems/core.env`, then its own `Environment=` lines | `/etc/systemd/system/dems-lcd.service` | root:root | 0644 |
| `systemd/dems-kiosk-agent.service` | The root side of the Edge kiosk physical-key lock; runs `/usr/local/lib/dems/dems-kiosk-agent.py` | `/etc/systemd/system/dems-kiosk-agent.service` | root:root | 0644 |
| `systemd/dems-loopback-rule.service` | Oneshot that loads `/etc/dems/loopback-ingest.nft` before the Core starts and deletes the table on stop | `/etc/systemd/system/dems-loopback-rule.service` | root:root | 0644 |
| `systemd/dems-wifi-watchdog.service` | Oneshot bench Wi-Fi watchdog; runs `/usr/local/sbin/dems-wifi-watchdog` | `/etc/systemd/system/dems-wifi-watchdog.service` | root:root | 0644 |
| `systemd/dems-wifi-watchdog.timer` | Runs the watchdog every minute (first run 2 min after boot) | `/etc/systemd/system/dems-wifi-watchdog.timer` | root:root | 0644 |
| `nftables/loopback-ingest.nft` | Table `inet dems_loopback`: only the user `dems-core` may connect to 127.0.0.1 TCP 8554-8564 (the capture ingest ports); everyone else gets a TCP reset | `/etc/dems/loopback-ingest.nft` | root:root | 0644 |
| `core.env.example` | Template of `/etc/dems/core.env`, built from the code only (`apps/core-server/src/config.ts`, `apps/core-server/src/plugins/config/load-config.ts`, `apps/lcd-backend/app/dems_backend.py`) | copy to `/etc/dems/core.env` | root:dems-core | 0640 |

Not included here (installed by other means and outside this folder's scope): the helper programs the units start (`/usr/local/lib/dems/dems-kiosk-agent.py`, `/usr/local/sbin/dems-wifi-watchdog`), the Node runtime under `/opt/dems/node-26.12.1`, the FFmpeg build and the capture worker, and the PostgreSQL 18 server itself.

Hardware-specific values in `dems-lcd.service`: `DEMS_DEV` (a `/dev/serial/by-id/...` path) and `DEMS_USB_SERIAL` name the USB serial adapter of the bench's own LCD panel. They are not secrets. On another machine replace them with that machine's adapter (`ls /dev/serial/by-id/`), or remove both lines to fall back to `/dev/ttyACM0`.

## Prerequisites on the host

- Service users and groups the units name: `dems-core` (group `dems-core`, supplementary groups `audio`, `dems-netalias`, `dialout`), `dems-console` (group `dems-console`), and the group `dems-netalias`.
- The repository tree at the deployed commit in `/opt/dems/core` (not a git checkout; see the root README, **Deploy procedure**), with its `node_modules`.
- Node at `/opt/dems/node-26.12.1/bin/node` (path used by the units), `python3`, `nft`.
- PostgreSQL 18 running as `postgresql@18-main`, listening on 127.0.0.1 port 4432. Port 5432 is refused by the Core (`FOREIGN_DATABASE_PORT`, `apps/core-server/src/config.ts`).

## Configure it yourself at deploy time

Run these steps as an administrator on the target host. Every name below comes from the code; the source is given in brackets.

### 1. Create `/etc/dems/core.env` from the template

```sh
sudo install -d -o root -g root -m 0755 /etc/dems
sudo install -o root -g dems-core -m 0640 deploy/bench-config/core.env.example /etc/dems/core.env
```

Owner root, group `dems-core`, mode 0640: both units that read it (`EnvironmentFile=/etc/dems/core.env` in `dems-core.service` and `dems-lcd.service`) run as group `dems-core`, and systemd reads the file as root before dropping privileges. Nobody else needs access.

### 2. Fill in every variable

Edit with `sudoedit /etc/dems/core.env`. Replace every `<set-me>` placeholder. Grouped by purpose:

**Ports and listeners**
- `DEMS_CORE_PORT=4420` (allowed: 4420 to 4423; the host is fixed to 127.0.0.1 in code).
- `DEMS_LCD_BACKEND_URL=http://127.0.0.1:8090` (must be `http://127.0.0.1:<port>`).
- The LCD backend's own `DEMS_PORT` / `DEMS_BIND` are set in `dems-lcd.service`; keep the bind on 127.0.0.1 (its API has no authentication).

**Capture**
- `DEMS_CAPTURE_MODE=real` for production (`simulated` is the default and starts no worker).
- `DEMS_CAPTURE_DEV_SOURCES=0` and `DEMS_DEMO_CONTROLS=0` in production.
- `DEMS_CAMERA_AUTOATTACH=0`, or `1` together with `DEMS_CAMERA_SEGMENT_CIDR` = one IPv4 `/24` literal such as `192.168.7.0/24` (the boot stops if the CIDR is missing while the sweep is on).

**Paths** (each must be an absolute path; `parseCapturePath` in `config.ts` stops the boot otherwise)
- `DEMS_CAPTURE_WORKER`, `DEMS_CAPTURE_RELAY`, `DEMS_CAPTURE_GUARD`, `DEMS_CAPTURE_AUDIO_HELPER`: the installed programs of production capture.
- `DEMS_CAPTURE_ALIAS_SOCKET`: the socket of the capture host's address helper.
- `DEMS_MEDIA_DIR`: the media root; it must be writable by `dems-core` (the LCD backend also stats it for free space).

**Identity**
- `DEMS_INSTALLATION_DEVICE_ID`: a capital letter, then capitals, digits or hyphens, 32 characters at most (e.g. `DEMS-SITE-21`).
- `DEMS_INSTALLATION_NAME`: 1 to 120 printable characters, no leading or trailing space.
- `DEMS_SATKER`: the work unit shown on the LCD panel.

**Security (secrets)**
- `DEMS_CAMERA_DEFAULT_PASSWORD` (optional; only with `DEMS_CAMERA_DEFAULT_USER`): this is the password **the camera already has**, so you do not generate it; copy it from the camera's own setup. Code limit: 1 to 256 printable characters.
- `DEMS_PROVISION_KEY` (optional, LCD backend): guards writing the client name on the panel, sent as header `X-Provision-Key`. The code accepts any non-empty string; generate one with:

  ```sh
  openssl rand -hex 32
  ```
- There is **no** session secret and **no** signer-key path in the environment: the session cookie name is derived from the port (`sessionCookieNameFor`), and the signing and session keys live in the Core's key store, not in `core.env`.
- The database password is **not** in `core.env` either; it lives in the connection file of step 3.

### 3. Create the PostgreSQL roles, the database and the connection files

Names, from `scripts/pg/lib.mjs` and `apps/core-server/src/db/schema/boot-checks.ts`:

| What | Name | Attributes (from `scripts/pg/init.mjs`) |
|---|---|---|
| Owner role (runs migrations; owns the database) | `dems_owner` | `LOGIN NOSUPERUSER CREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS` |
| Runtime role (the running Core) | `dems_app` | `LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS` |
| Database on port 4420 | `dems_demo` (`databaseNameFor(4420)` in `config.ts`) | owner `dems_owner`, `TEMPLATE template0 ENCODING 'UTF8' LOCALE 'C'` |

Generate the two passwords the same way the project's own provisioning does (`newPassword()` in `scripts/pg/lib.mjs`: 32 random bytes as base64url, at least 24 required):

```sh
openssl rand -base64 32 | tr '+/' '-_' | tr -d '='    # run twice: one for dems_owner, one for dems_app
```

Create the roles as the PostgreSQL superuser on the system cluster (port 4432). `\password` prompts for the value, so it never appears in the shell history or the process list:

```sh
sudo -u postgres psql -p 4432 -c "CREATE ROLE dems_owner LOGIN NOSUPERUSER CREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS"
sudo -u postgres psql -p 4432 -c "CREATE ROLE dems_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS"
sudo -u postgres psql -p 4432 -c "\password dems_owner"
sudo -u postgres psql -p 4432 -c "\password dems_app"
```

Authentication must be `scram-sha-256` on 127.0.0.1 (the project cluster is initialised with `-A scram-sha-256`, `scripts/pg/init.mjs`).

Write the two connection files into the data directory, which is `<repository root>/.data` (`DEFAULT_DATA_DIR`, `apps/core-server/src/plugins/config/load-config.ts`), i.e. `/opt/dems/core/.data` on the bench. Keys, in file order (`CONNECTION_FILE_KEYS` in `config.ts`, `OWNER_KEYS` / `APP_KEYS` in `scripts/pg/lib.mjs`):

`/opt/dems/core/.data/pg.env` (read by the Core; owner `dems-core`, mode 0600: the Core refuses any group or other bit, `CONNECTION_FILE_MODE` in `connection-file.ts`):

```
DEMS_PG_HOST=127.0.0.1
DEMS_PG_PORT=4432
DEMS_PG_DATABASE=dems_demo
DEMS_PG_APP_ROLE=dems_app
DEMS_PG_APP_PASSWORD=<the dems_app password>
```

`/opt/dems/core/.data/pg.owner.env` (read by the `db:*` commands; `OWNER_FILE_NAME` in `apps/core-server/src/db/commands/owner-connection.ts`; mode 0600, owned by the account that runs those commands):

```
DEMS_PG_HOST=127.0.0.1
DEMS_PG_PORT=4432
DEMS_PG_DATABASE=dems_demo
DEMS_PG_OWNER_ROLE=dems_owner
DEMS_PG_OWNER_PASSWORD=<the dems_owner password>
```

Create the files with `install -m 0600` first and then edit them, so they never exist with a wider mode. The data directory itself is mode 0700.

Then create the database (as `dems_owner`, through `pg.owner.env`):

```sh
cd /opt/dems/core
npm run db:create -w @dems/core-server -- --database dems_demo
```

(On a development machine `npm run pg:init` does all of step 3 for a project-local cluster; the bench uses the system cluster instead.)

### 4. Apply the migrations and seed the unit

```sh
cd /opt/dems/core
npm run db:migrate -w @dems/core-server -- --database dems_demo
npm run db:status  -w @dems/core-server -- --database dems_demo
```

The migrations also grant the runtime role its privileges (`apps/core-server/src/db/migrations/0003_privileges.sql` and later `*_privileges.sql`). The documented form takes the migrate lock: `/usr/bin/lockf -k .locks/db-migrate.lock npm run db:migrate -w @dems/core-server -- --database dems_demo` (header of `apps/core-server/src/db/commands/migrate.ts`; `lockf` is the macOS tool, so on Linux make sure no reset or other migration runs at the same time).

Seed a production unit with the **factory** seed, which writes no operator password. It reads `DEMS_INSTALLATION_DEVICE_ID`, `DEMS_INSTALLATION_NAME` and `DEMS_DEVICE_CERT_FINGERPRINT` from its environment (`factoryIdentityOfEnvironment`, `apps/core-server/src/db/seed/factory.ts`):

```sh
npm run db:seed -w @dems/core-server -- --database dems_demo --factory
```

Then give each operator a password, interactively (the command requires a terminal and never takes the password as an argument):

```sh
npm run operator:set-password -w @dems/core-server -- --database dems_demo --data-dir /opt/dems/core/.data --username <username>
```

### 5. Install the units and the nft rule, then start them

```sh
cd /opt/dems/core/deploy/bench-config
sudo install -o root -g root -m 0644 nftables/loopback-ingest.nft /etc/dems/loopback-ingest.nft
sudo nft -c -f /etc/dems/loopback-ingest.nft          # syntax check only
sudo install -o root -g root -m 0644 systemd/*.service systemd/*.timer /etc/systemd/system/
sudo install -d -o root -g root -m 0755 /etc/systemd/system/dems-console.service.d
sudo install -o root -g root -m 0644 systemd/dems-console.service.d/production-lock.conf /etc/systemd/system/dems-console.service.d/
sudo systemctl daemon-reload
sudo systemctl enable --now dems-loopback-rule.service
sudo systemctl enable --now dems-core.service dems-console.service dems-lcd.service
sudo systemctl enable --now dems-kiosk-agent.service dems-wifi-watchdog.timer   # bench extras, only where their programs are installed
```

`dems-loopback-rule.service` runs `nft -f /etc/dems/loopback-ingest.nft`; you do not need to load the rule by hand.

### 6. Verify the install

```sh
journalctl -u dems-core -b --no-pager | grep CAPTURE_BOOT_CHECKS_PASSED
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:4420/api/v1/health     # expect 200
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:5173/                  # expect 200
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8090/api/dems/status    # expect 200
sudo nft list table inet dems_loopback
```

A healthy production start logs exactly one `CAPTURE_BOOT_CHECKS_PASSED` line with `"operation":"REAL_PRODUCTION"` and `"checks":"real"` (`apps/core-server/src/capture/boot/checks.ts`). A start without that line is not a healthy production start.

**REAL_PRODUCTION refuses to boot while any operator still has the published demo password** (boot check 4c, refusal `DEMO_PASSWORD_IN_PRODUCTION` in `checks.ts`; `CAPTURE_DEMO_OPERATOR_PASSWORD_IN_PRODUCTION`, S99-01). It also refuses when that count cannot be read. This is why a production unit uses the factory seed and `operator:set-password`, never the demonstration seed.

### 7. Warning: the real `core.env` stays private

- **Never commit** `/etc/dems/core.env`, `pg.env` or `pg.owner.env`, filled or partly filled, to this or any repository. This repository is public.
- Keep `core.env` at root:dems-core **0640**, and both connection files at **0600**.
- Share a filled file only privately, for example with `scp` over SSH directly between team machines. Never by e-mail, chat, an issue, a pull request or a paste service.
- Backup copies of these files (`core.env.bak-*`) carry the same secrets and the same rules.
