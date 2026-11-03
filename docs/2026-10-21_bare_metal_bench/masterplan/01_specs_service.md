---
task_id: 2026-10-21_bare_metal_bench
task_slug: bare_metal_bench
date: 2026-10-22
agent: data-analyst
row: 15
type: spec (service delta)
tier: 1
confidence: MEDIUM (every line traced to code or to a run in the Docker session; nothing of this file has run as a systemd unit on .73)
source_structured_task: identification/02_structured.md (row 15; W1, W4, W5, W6 at lines 117-122)
inputs: research/01_explore_core_runtime.md, 01_explore_capture_build.md, 01_explore_cli_invocation.md, 01_explore_helper_absence.md, 01_explore_host_survey.md; scripts/host/HOST-PROFILE-UBUNTU-24.04.md, 70-core-unit.sh, INSTALLER-NOTE-FIRST-PRODUCTION-BOOT.md; decisions D8-D12
last_updated: 2026-10-22 16:45
---

# Service delta: the bare-metal Core on host .73 (row 15)

## 0. Names used in this file

Install names are taken verbatim from `masterplan/01_specs_register.md` (row 12). That register appeared while this file was being written (it was absent at 16:42); the names were then substituted from it. One name is not in the register and stays a placeholder with a request line in `delegation_progress/file_requests.md`.

| Name | Register line | Fixed by code? |
|---|---|---|
| `dems-core` (service user and group) | register:39, :63 | no |
| `/opt/dems/core` (install dir) | register:41, :79 | no |
| `/opt/dems/core/.data` (data dir) | register:42, :80 | **yes** (W1): load-config.ts:53-60 |
| `/opt/dems/node-26.12.1/bin/node` | register:56, :87, :213 | no (U-RF8) |
| `/opt/dems/ffmpeg-9.0.2` | register:43 | no |
| `dems-netalias` (group only) | register:40, :66 | **yes**: host-checks.ts:200; netalias/dems-core-netalias.socket:15 |
| `postgresql@18-main.service` | register:113 (register marks it a hypothesis; confirmed at rows 13/39) | no |
| `dems-console` (console account) | register:69 (proposal; "row 15 decides"): **decided here, separate account** (section 8) | no |
| `dems-console.service` | register:112 (name reserved; "row 15 decides" unit vs manual): **unit** (section 8) | no |
| Core port `4420`, `DEMS_CORE_PROXY_PORT=4420` | register:190 | 4420..4423 only (config.ts:49) |
| `<REQ:cli_cache_dir>` | not in the register (register:89, :197 leave it to row 14) | no; only the npm form of 7.3 needs it |

One conflict with the register, for row 17/96: register:63 gives `dems-core` home `/opt/dems/core/.data` (HOST-04 as written); this file proposes `/nonexistent` (section 3, F-S1).

## 1. Scope (5W1H)

| | |
|---|---|
| What | The settled file G (`dems-core.service`), the account, directory and ownership set the unit needs, the two forms of `/etc/dems/core.env` (key NAMES only), the use of files A, C, D, E, F on .73, the console decision (W4), and how the service user runs `evidence:production-key`, `operator:set-password` and the attended check (W5, W6) |
| Who | Executes: rows 22, 23, 42, 43, 54-58, 122 (coder-execution), row 59 (test-expert). Reconciled by row 17, runbook by row 18. Passwords are typed by the user only (D3, D6, OI-1) |
| When | SIMULATED form from row 42; unit at row 43; console at row 122 before G1 (row 46); REAL form at row 57; first production boot row 58 |
| Where | Host .73, Ubuntu 24.04, no lid (research/01_explore_host_survey.md:18, :41) |
| Why | HOST-PROFILE file G leaves `ExecStart` open ("to confirm in 9A/H-16", HOST-PROFILE:236, 70-core-unit.sh:32) and assumes a configurable data dir and DB settings in core.env, which the code contradicts (W1) |
| How | Each choice is traced to a file:line of the repository, to the Docker entrypoint that ran on .73 in the Docker session, or is labelled hypothesis |

Out of scope: database server, roles and `pg.owner.env` (row 13); ufw and exposure ruling (row 14); file B and HOST-19..23 (rows 11, 93); the address helper (stays absent).

## 2. Fixed data dir and the writable paths (W1)

Fact: the Core never reads a data dir from the environment. `loadConfig({ env: process.env })` passes no `dataDir` (apps/core-server/src/index.ts:58), so `DEFAULT_DATA_DIR` applies: five levels up from `src/plugins/config` plus `.data` = `<install_dir>/.data` (apps/core-server/src/plugins/config/load-config.ts:53-60, read). The connection file is `<data_dir>/pg.env` (src/config.ts:137, `CONNECTION_FILE_NAME`). The error log is `<install_dir>/apps/core-server/logs/errors.log` (src/plugins/logger/error-log.ts:34-40, per research/01_explore_core_runtime.md:33).

Consequences:
- HOST-34's "the database settings" do NOT go into core.env: they are the five keys of `pg.env` (src/config.ts:138-145). Deviation from HOST-34 text, recorded for row 11.
- HOST-06 applies to `<install_dir>/.data`. Its parents (`<install_dir>`, its parent, `/opt`) must be root-owned with no group/other `w` (production-key-command.ts:260-294 checks the ancestors, research/01_explore_cli_invocation.md §3).
- HOST-05 (root-owned tree) gets exactly three writable exceptions inside the tree, all as in the Docker image (Dockerfile:230-232):

| Path | Owner:group | Mode | Created by | Evidence |
|---|---|---|---|---|
| `<install_dir>` and every parent | root:root | 0755 | row 22 | HOST-05, HOST-06 |
| `<install_dir>/.data` | `dems-core`:`dems-core` | 0700 | row 22 (before the tree copy of row 26 must not overwrite it) | load-config.ts:53-60; Dockerfile:230 |
| `<install_dir>/.data/media`, `.data/media/sessions` | same | 0700 | row 22 | HOST-06; config.ts:88 (`MEDIA_STORE_SUBPATH`) |
| `<install_dir>/.data/pg.env` | same | 0600 | row 41 (row 13 spec) | operator-set-password-command.ts:176-182 refuses owner != caller and any group/other bit; entrypoint `write_private` 0600 |
| `<install_dir>/.data/signer`, `.data/handover` | same | set by the command | row 56, by `evidence:production-key` | INSTALLER-NOTE 2.6, 2.7 |
| `<install_dir>/.data/run/capture` | same | 0700 (Core-made) | the Core | HOST-08 |
| `<install_dir>/apps/core-server/logs` | same | 0700 | row 22 or 26 | Dockerfile:230; entrypoint `prepare_dirs` (dems-entrypoint.sh:48-51) |
| `<install_dir>/apps/core-web/node_modules` | root:root | 0755 | row 27/122 | Dockerfile:231 |
| `<install_dir>/apps/core-web/node_modules/.vite` | `dems-console`:`dems-console` | 0700 | row 122 | Dockerfile:232; entrypoint:114-116 |

Ordering note for row 26: a copy of the tree into `<install_dir>` as root must not carry a Mac `.data` (it holds bench secrets and the dev key) and must not reset the owner of the three writable paths. Re-run the `install -d -o ... -m 0700` lines after any re-copy.

Backup scope (for row 16): everything the Core keeps lives under `<install_dir>/.data` plus the DB cluster. A reinstall that deletes `<install_dir>` deletes the evidence store.

## 3. Service account (HOST-04, HOST-26, HOST-40, HOST-43)

| Step | Command (row 22, 37) | Evidence |
|---|---|---|
| Account | `sudo useradd --system --home-dir /nonexistent --no-create-home --shell /usr/sbin/nologin dems-core` | Deviation from HOST-04 (`--home-dir <data-dir>`, HOST-PROFILE:56). Reason: with W1 the data dir is the evidence store; a home there lets npm/tools write caches into it (research/01_explore_cli_invocation.md §4). Docker precedent: `--home-dir /nonexistent --no-create-home` (Dockerfile:227) and `HOME=/nonexistent` (entrypoint:34). The Core reads no HOME: grep of `src`, `cli` for `homedir(`/`process.env.HOME` found none (only `tmpdir()` in evidence-export/receiver-cli.ts:184). For row 96 (F-S1) |
| Audio group | `sudo usermod -aG audio dems-core` | HOST-26; host-checks.ts:271-278 requires `audio` among the process groups; `audio` is empty on .73 (host survey :104) |
| Helper group | `sudo groupadd --system dems-netalias`, `sudo usermod -aG dems-netalias dems-core` | HOST-43; file G names it, so it must exist or the unit does not start (HOST-PROFILE:117, :125). Install NOTHING else of the helper (research/01_explore_helper_absence.md §4) |
| Console account | `sudo useradd --system --home-dir /nonexistent --no-create-home --shell /usr/sbin/nologin dems-console`; no supplementary group | Dockerfile:228-229. Separate so the unhardened dev server cannot read `.data` (signer, pg.env) |

## 4. File G, settled

### 4.1 The unit

`/etc/systemd/system/dems-core.service`, root:root 0644 (HOST-33):

```ini
[Unit]
Description=DEMS Core
After=network-online.target time-sync.target dems-loopback-rule.service postgresql@18-main.service
Wants=network-online.target postgresql@18-main.service
Requires=dems-loopback-rule.service

[Service]
Type=simple
User=dems-core
Group=dems-core
SupplementaryGroups=audio dems-netalias
WorkingDirectory=/opt/dems/core/apps/core-server
EnvironmentFile=/etc/dems/core.env
ExecStart=/opt/dems/node-26.12.1/bin/node /opt/dems/core/node_modules/tsx/dist/cli.mjs src/index.ts
KillMode=mixed
UMask=0077
LimitCORE=0
NoNewPrivileges=yes
CapabilityBoundingSet=
AmbientCapabilities=
TimeoutStopSec=60

[Install]
WantedBy=multi-user.target
```

Delta against profile file G (HOST-PROFILE:238-261): `postgresql@18-main.service` in `After=`/`Wants=` (HOST-56), `Type=simple` (explicit default), `WorkingDirectory` one level deeper, a settled `ExecStart`, and `KillMode=mixed`. Nothing else; no `Restart=` (the profile sets none; a refused production start must stay down, not loop), no `Environment=` line, no extra hardening (HOST-PROFILE:236).

### 4.2 ExecStart traced to code

| Element | Trace |
|---|---|
| No build step; the Core runs from TypeScript through tsx | `apps/core-server/package.json:8` `"start": "tsx src/index.ts"`; no `build` script (package.json:6-28, read) |
| tsx is a runtime dependency, present after `npm ci` | package.json:46 (tsx 4.23.15; `node_modules/tsx/package.json` version read) |
| `node_modules/.bin/tsx` IS `cli.mjs` | `ls -l node_modules/.bin/tsx` -> `../tsx/dist/cli.mjs`; first line `#!/usr/bin/env node` (read). Calling `cli.mjs` with an absolute node removes the PATH dependency of the shebang (systemd's default PATH has no Node dir) and meets HOST-33 "absolute path of node" |
| Same command as the production-shaped Docker form | `exec setpriv ... -- "$TREE/node_modules/.bin/tsx" src/index.ts` after `cd "$TREE/apps/core-server"` (dems-entrypoint.sh:105-107, read). The Docker Core ran on .73 in the Docker session (01_backup_and_docker_removal.md:32: "The DEMS stack is now down. The console is no longer reachable"; 03_deployment_check D1: key commands ran in that volume) |
| `WorkingDirectory=<install>/apps/core-server` | `src/index.ts` is a relative argument; the entrypoint cd's there (entrypoint:105). The Core resolves its own files from `import.meta.url`, not cwd (research/01_explore_core_runtime.md:33); `process.cwd()` only for a relative `DEMS_MEDIA_DIR` (src/db/commands/media-store-root.ts:73), and section 5 sets that key absolute |
| No `NODE_OPTIONS` | `nodeOptionsSet: process.env['NODE_OPTIONS'] !== undefined` (src/index.ts:128, read) -> `HOST_DIAGNOSTIC_SWITCH` / `NODE_OPTIONS_SET` (host-checks.ts:403-404, read). Even an empty value refuses. systemd sets none; core.env must not hold it (HOST-34 grep) |
| No forbidden start argument | `DIAGNOSTIC_SWITCH = /^--(?:report\|diagnostic\|heap\|inspect)/` tested on `process.execArgv` (host-checks.ts:318, :403, read). The child that tsx starts carries `--require <tsx>/dist/preflight.cjs --import file://<tsx>/dist/loader.mjs` (cli.mjs `run`: `spawn(process.execPath, ["--require", preflight.cjs, "--import"\|"--loader", loader.mjs, ...args])`, read in node_modules/tsx/dist/cli.mjs). None of these starts with `--report`, `--diagnostic`, `--heap` or `--inspect`: by the regex, passes. Not run: confirm at row 58 |
| Listener | `LISTEN_HOST = '127.0.0.1'` constant (src/config.ts:47); port from `DEMS_CORE_PORT`, 4420..4423 only (config.ts:49-51); 4420 serves `dems_demo` (config.ts:148-150) |
| Stop | SIGTERM/SIGINT -> `shutdown()`, 10 s internal timer (SHUTDOWN_TIMEOUT_MS, src/index.ts:33; handler :73-104, read); `TimeoutStopSec=60` (profile) is above it |
| Not `Type=notify` | No sd_notify found (research/01_explore_core_runtime.md:37); the port opens only after `app.readiness.boot()` and `app.capture.boot()` (index.ts:134-136) |

### 4.3 Why `KillMode=mixed` (finding from reading tsx; hypothesis until row 58)

The `cli.mjs` form is TWO processes: the tsx parent (systemd's `MainPID`) and the Core as its child (`spawn(...)` in cli.mjs, read). tsx's `relaySignals` (cli.mjs, read): on SIGTERM the parent waits 30 ms for the child to report the same signal over tsx's IPC pipe; if no report arrives it sends SIGTERM to the child itself, waits 30 ms again, and if still no report it SIGKILLs the child. The child's report is sent by a hidden handler in `preflight.cjs` (read).

With systemd's default `KillMode=control-group`, both processes receive SIGTERM at once. If the child's report arrives before the parent has armed its wait (a race in that code), the parent sends a second SIGTERM, and the Core answers a second signal with `'second signal during shutdown; forcing exit'` and `process.exit(1)` (src/index.ts:74-77, message at :76), skipping `app.capture.shutdown()`. `KillMode=mixed` sends SIGTERM to the main process only (the tsx parent, which relays it once) and SIGKILL to the whole group only at `TimeoutStopSec`. That is the same signal path as `docker stop` on the Docker form, where the tsx parent is PID 1 of the container.

Residual (hypothesis, not measured): the second 30 ms window can still SIGKILL a Core whose event loop is blocked for more than 30 ms at the moment of the stop. Row 58 records one `systemctl stop` while idle and reads the journal for `shutdown complete` (index.ts:93). If it is missing, fall back to alternative B.

### 4.4 Alternative B (fallback, not recommended first)

`ExecStart=/opt/dems/node-26.12.1/bin/node --import tsx src/index.ts` in the same `WorkingDirectory`: ONE process, `MainPID` is the Core, no relay, no 30 ms window, `KillMode` default. `--import tsx` resolves from cwd up to `<install_dir>/node_modules/tsx` (export `.` exists in tsx's package.json `exports`, read). `execArgv` becomes `['--import','tsx']`, which the regex passes. Not chosen first because it is not the form the repository or the Docker image ever ran (traceability, OI-5). For row 96 (F-S2).

### 4.5 Which pid the checks read (row 59)

With the recommended form, `<core-pid>` of HOST-35..42 (HOST-PROFILE:40) is NOT `MainPID`: it is the child. Use `pgrep -P "$(systemctl show -p MainPID --value dems-core.service)"` (one line expected) and run the `/proc` checks on BOTH pids. Status-type values (limits, NoNewPrivs, Cap*, Groups, Umask) are inherited; `cmdline` differs (the child shows the tsx `--require`/`--import` pair). Open point 7 (HOST-PROFILE:275) applies to the parent/child pair as well.

### 4.6 Runtime writes outside `.data` (W6, Core side)

tsx writes its cache under `os.tmpdir()/tsx` and its IPC pipe under `os.tmpdir()/tsx-<euid>/<pid>.pipe` (tsx dist files, read: `join(tmpdir(), "tsx-" + euid)`). With no `TMPDIR` in the unit and no `PrivateTmp=`, that is `/tmp/tsx-<uid>` owned by the service user with `UMask=0077`. No `Environment=` line is needed. Verified by source reading only; row 58 lists `/tmp/tsx-*` after the start.

## 5. `/etc/dems/core.env`: key names in two forms

Directory `/etc/dems` root:root 0755; file root:`dems-core` 0640 (HOST-34). Values are written by the executing row from the register; none appears here. The only reader is `loadConfig` (src/index.ts:58; keys config.ts:61-76; read at load-config.ts:75-103).

| Key | SIMULATED (row 42) | REAL_PRODUCTION (row 57) | Note / evidence |
|---|---|---|---|
| `DEMS_CORE_PORT` | set | set | the register's Core port; 4420 -> `dems_demo` (config.ts:148-150) |
| `DEMS_CAPTURE_MODE` | set (`simulated`) | set (`real`) | the one value that changes between the forms; fence table capture/fence/operation.ts:13-19 |
| `DEMS_LOG_LEVEL` | optional | optional | default `info` (config.ts:80) |
| `DEMS_MEDIA_DIR` | set | set | absolute, equal to `/opt/dems/core/.data/media/sessions`, the code default (config.ts:88); set so HOST-34 is met literally and no relative path meets `process.cwd()` |
| `DEMS_CAPTURE_WORKER` | set | set | absolute path of HOST-14 build output (research/01_explore_capture_build.md §1) |
| `DEMS_CAPTURE_RELAY` | set | set | HOST-15 |
| `DEMS_CAPTURE_GUARD` | set | set | HOST-15 |
| `DEMS_CAPTURE_AUDIO_HELPER` | set | set | `/opt/dems/ffmpeg-9.0.2/bin/ffmpeg` (HOST-16) |
| `DEMS_INSTALLATION_DEVICE_ID` | absent | set | SIMULATED: not asked; REAL_PRODUCTION without it refuses `INSTALLATION_IDENTITY_NOT_CONFIGURED` (sealing-host/installation-identity.ts:17-24, :92-95). Must equal the id typed at row 56 (INSTALLER-NOTE 2.12) |
| `DEMS_INSTALLATION_NAME` | absent | set | same rule |
| `DEMS_CAPTURE_ALIAS_SOCKET` | absent | absent | helper absent; any other path than the installed socket refuses (`CAPTURE_HOST_ALIAS_SOCKET_PATH`, research/01_explore_helper_absence.md §3) |
| `DEMS_LCD_BACKEND_URL` | absent | absent | LCD backend is out of this task's scope (structured row list); add only on the register's word |
| `DEMS_CAPTURE_DEV_SOURCES` | **absent** | **absent** | HOST-34 grep key; with `simulated` it refuses `DEV_SOURCES_NEED_REAL_CAPTURE` (operation.ts:18, :78) |
| `DEMS_DEMO_CONTROLS` | **absent** | **absent** | HOST-34 grep key; with `real` it refuses `REAL_CAPTURE_WITH_DEMO_CONTROLS` (operation.ts:17, :77). SIMULATED without it boots as `SIMULATED` (operation.ts:14, :27-28) |
| `NODE_OPTIONS` | **absent** | **absent** | HOST-34/HOST-36 grep key; presence alone refuses (index.ts:128) |
| `DEMS_CAPTURE_HELPER_FFMPEG`, `DEMS_CAPTURE_DEV_FAKE_MIC` | absent | absent | development-fence keys (load-config.ts:84-89 comments) |
| `DEMS_PG_*`, any `PG*` | absent | absent | `DEMS_PG_*` live in `pg.env` only (config.ts:138-145); `PG*` are deleted and logged as ignored (src/plugins/db/index.ts:152-161; index.ts:54, :108-110) |

The two forms differ by: one value (`DEMS_CAPTURE_MODE`) and two added keys (installation identity). Writing the capture paths already in the SIMULATED form lets their parse rule (absolute, no NUL: load-config.ts:82-100) fail at row 48 rather than at row 58. Whether a SIMULATED boot ignores the program paths entirely is read from comments (load-config.ts:80 "Nothing here says that `real` needs a worker: the boot checks do"; index.ts:116 "Nothing is built in another operation"), not run: MEDIUM.

HOST-34 grep, required result 0 for BOTH forms (row 42 and row 57 checks):

```
sudo grep -c -E '^(DEMS_CAPTURE_DEV_SOURCES|DEMS_DEMO_CONTROLS|NODE_OPTIONS)=' /etc/dems/core.env   -> 0
```

Recommended extra check (not a profile item; for row 18): `sudo grep -c -E '^(DEMS_CAPTURE_HELPER_FFMPEG|DEMS_CAPTURE_DEV_FAKE_MIC|DEMS_CAPTURE_ALIAS_SOCKET|DEMS_PG_[A-Z_]*|PG[A-Z]*)=' /etc/dems/core.env -> 0`, and for REAL only `sudo grep -c -E '^DEMS_INSTALLATION_(DEVICE_ID|NAME)=' /etc/dems/core.env -> 2`. No command prints a value.

## 6. Files A, C, D, E, F on .73

| File | Choice | Evidence |
|---|---|---|
| A `/etc/ld.so.conf.d/dems-ffmpeg.conf` | apply as written: one line `/opt/dems/ffmpeg-9.0.2/lib`, root 0644, then `sudo ldconfig` | HOST-13, HOST-PROFILE:168-172; Dockerfile:82 same pattern |
| C `/etc/sysctl.d/60-dems-host.conf` | apply as written (four lines) | HOST-20, HOST-37. Docker removed (D2), so nothing turns forwarding back on; the Wi-Fi fixes F1-F3 use other files (02_host_wifi_outage_20261022.md) |
| D `/etc/dems/loopback-ingest.nft` | apply as written with `skuid != "dems-core"`; root 0644 | HOST-25. nftables 1.0.9 present, ruleset empty (host survey :26, :126) |
| E `/etc/systemd/system/dems-loopback-rule.service` | apply as written; enable `--now` before file G is started | HOST-25, HOST-41; file G `Requires=` it |
| F `/etc/systemd/logind.conf.d/60-dems-lid.conf` | **N/A**: no lid | host survey :18, :41 (`lid-is-present: no`), :55 |
| B | not decided here | rows 11, 93 (R-FLEX host-doc delta) |

## 7. The CLI commands as the service user (W5, W6)

### 7.1 Facts the invocation must meet

| Need | Evidence |
|---|---|
| A PTY on stdin for all three | password command `isatty(0)` (operator-set.ts:47; command :370); key command `process.stdin.isTTY` (production-key.ts:32); attended check `isatty(0)` + raw mode (secret-prompt.ts:265-267, :337, :365). So `ssh -t` (D6, OI-1) |
| Not root, key command only | `ROOT_REFUSED` (production-key-command.ts:91, :395) |
| Password command run by the owner of `pg.env` | owner uid must equal caller uid, no group/other bits (operator-set-password-command.ts:176-182). So also as `dems-core`, never root |
| No env var named like a password (password command) | `PASSWORD_VARIABLE_NAME = /^(?:PASSWORD\|NEW_PASSWORD\|DEMS_\w*PASSWORD\w*\|\w*OPERATOR\w*PASSWORD\w*)$/i` on env NAMES (operator-set-password-command.ts:190, :367) |
| `--data-dir` absolute, normalised | production-key-command.ts:383-388; so `/opt/dems/core/.data`, no trailing `/` |
| Core stopped | INSTALLER-NOTE 2.3: `sudo systemctl stop dems-core.service` first; the console may stay up (it holds no DB connection) |
| CLI error log | writes `apps/core-server/logs/errors.log` (operator-set.ts:64); with section 2's ownership the write now succeeds (it was lost under a root-owned tree, research/01_explore_cli_invocation.md §3) |

### 7.2 Recommended form: direct tsx (no npm)

Run from `/opt/dems/core/apps/core-server`, in the user's own `ssh -t` terminal:

```
cd /opt/dems/core/apps/core-server
sudo -u dems-core -- /opt/dems/node-26.12.1/bin/node /opt/dems/core/node_modules/tsx/dist/cli.mjs cli/secret-prompt.ts
sudo -u dems-core -- /opt/dems/node-26.12.1/bin/node /opt/dems/core/node_modules/tsx/dist/cli.mjs cli/operator-set.ts --database dems_demo --data-dir /opt/dems/core/.data --all-demo
sudo -u dems-core -- /opt/dems/node-26.12.1/bin/node /opt/dems/core/node_modules/tsx/dist/cli.mjs cli/production-key.ts --data-dir /opt/dems/core/.data
```

Trace: these are the script entries `tsx cli/operator-set.ts` (package.json:27), `tsx cli/production-key.ts` (package.json:24), and the attended-check start in secret-prompt.ts:43-45 (`npx tsx cli/secret-prompt.ts` from `apps/core-server`), with `tsx` written as the same absolute node + `cli.mjs` as file G. INSTALLER-NOTE:3 makes package.json the authority over the note's npm lines. Why first: no npm cache, no `$HOME` and no npm-injected `npm_*` variable names reach the password command; the only writes are `/tmp/tsx-<uid>` (section 4.6), `.data` and `logs/`. `sudo` keeps the controlling terminal, so stdin stays a TTY through the tsx parent to the child (hypothesis for the child: tsx spawns with inherited stdio; the Docker tools mode ran the same chain `npm -> tsx -> node` under `setpriv` with the key command succeeding, 03_deployment_check D1).

### 7.3 Alternative: the npm lines of INSTALLER-NOTE 2.1

```
cd /opt/dems/core
sudo -u dems-core -- env PATH=/opt/dems/node-26.12.1/bin:/usr/bin:/bin HOME=/nonexistent npm_config_cache=<REQ:cli_cache_dir> \
  npm run --silent evidence:production-key -w @dems/core-server -- --data-dir /opt/dems/core/.data
```

(same shape for `operator:set-password ... --database dems_demo --data-dir ... --all-demo`). `PATH` must hold the Node dir because `npm` and `.bin/tsx` start through `#!/usr/bin/env node` and sudo's `secure_path` has no Node dir. `<REQ:cli_cache_dir>` is a root-made dir owned by the service user, 0700, outside `.data`. Docker precedent: `npm run --silent <mode> -w @dems/core-server -- ...` as dems-core with `HOME=/nonexistent` (entrypoint:34, :130).

### 7.4 Unverified items (W6)

| # | Item | Status | Settled at |
|---|---|---|---|
| U1 | tsx cache/pipe dir `/tmp/tsx-<uid>` | read in tsx dist source; not run | row 54 (list `/tmp/tsx-*` after the attended check) |
| U2 | Child process keeps the TTY under `sudo -u` + tsx relay | hypothesis, indirect Docker evidence | row 54 (attended check shows no echo, terminal restored) |
| U3 | npm 11 with unwritable HOME/cache: warning or failure | unknown; only relevant to 7.3 | not needed if 7.2 is used |
| U4 | Does npm inject an env NAME matching `PASSWORD_VARIABLE_NAME` (e.g. a `npm_package_scripts_operator_set_password`)? | unknown; only relevant to 7.3 | not needed if 7.2 is used; with 7.3, a `PASSWORD_VARIABLE_SET` refusal would show it |
| U5 | ExecStart child `execArgv` passes HOST-36 | by regex only | row 58 journal and `/proc/<child>/cmdline` |
| U6 | `KillMode=mixed` gives one clean shutdown | by reading tsx relay code | row 58 (`shutdown complete` in journal after one stop) |

## 8. Console decision (W4)

### 8.1 Evidence

| Fact | Evidence |
|---|---|
| The Core serves no console; no static plugin | research/01_explore_core_runtime.md:45-46; deploy/docker/README.md:51 |
| Only the Vite dev server in Live mode talks to a Core; a build is Simulated-only | README.md:40, :51 |
| Dev server: `127.0.0.1:5173`, `strictPort` | apps/core-web/vite.config.ts:85-89 (read) |
| Proxy to the Core only with `DEMS_CORE_PROXY_PORT` in 4420-4423 | vite.config.ts:51-58, :89 |
| Core accepts only origin `http://127.0.0.1:5173` (no `localhost`) | src/config.ts:95-105 |
| Root-owned tree needs `--configLoader runner`; the only write is `apps/core-web/node_modules/.vite` | entrypoint:111-118 (EACCES measured in that row's smoke run); Dockerfile:231-232 |
| The Docker console ran on .73 as a non-root account in a root-owned tree, `restart: unless-stopped` | compose.yaml:113-123; 01_backup_and_docker_removal.md:32 |
| The console is needed in rows 49-51, 124-127 and after each reboot (rows 47, 71) | identification/02_structured.md rows 49-51, 122, 124-127 |
| No console unit exists in scripts/host | research/01_explore_core_runtime.md:58 |

### 8.2 Options

| | A: separate unit (recommended) | B: manual start per use |
|---|---|---|
| How | `dems-console.service`, enabled | `sudo -u dems-console -- env ... node .../vite.js --configLoader runner` in an SSH session |
| Survives reboot / SSH drop | yes | no: dies with the SSH session; repeated after rows 47, 71 |
| Account isolation | `dems-console`, cannot read `.data` | same if run with `sudo -u`, easy to get wrong (running it as the admin or as the Core account) |
| Matches what ran on .73 | yes (Docker `console` service) | no precedent |
| Exposure | 127.0.0.1:5173 only, reached by the SSH forward (OI-2, row 49); same exposure in both | same |

Recommendation: A, enabled at boot. Row 14 owns the exposure ruling; if it rules "on demand", keep the unit and leave it disabled (`systemctl start` per use), which still beats B.

### 8.3 The console unit

`/etc/systemd/system/dems-console.service`, root:root 0644:

```ini
[Unit]
Description=DEMS web console (Vite development server, 127.0.0.1:5173)
After=network-online.target dems-core.service

[Service]
Type=simple
User=dems-console
Group=dems-console
WorkingDirectory=/opt/dems/core/apps/core-web
Environment=DEMS_CORE_PROXY_PORT=4420 VITE_DEMS_CORE_MODE=live HOME=/nonexistent
ExecStart=/opt/dems/node-26.12.1/bin/node /opt/dems/core/node_modules/vite/bin/vite.js --configLoader runner
UMask=0077
LimitCORE=0
NoNewPrivileges=yes
CapabilityBoundingSet=
AmbientCapabilities=
TimeoutStopSec=20

[Install]
WantedBy=multi-user.target
```

Trace: `vite.js` path is what `require.resolve('vite/package.json')` + `bin/vite.js` gives (entrypoint:113; `ls node_modules/vite/bin/` shows `vite.js`, vite 8.3.1); the three environment entries are the entrypoint's (entrypoint:110-111, :34); hardening lines mirror the Docker `setpriv --inh-caps=-all --bounding-set=-all --no-new-privs` (entrypoint:117). `After=dems-core.service` without `Wants=`: starting the console never starts the Core (rows 52-57 keep the Core stopped while the console may run). No `SupplementaryGroups`. These values contain no secret, so `Environment=` is used, not a file.

Checks for row 122: `systemd-analyze verify` clean; `stat` root root 644; `sudo ss -H -ltnp 'sport = :5173'` shows `127.0.0.1:5173` only, owned by the console account; `curl -s http://127.0.0.1:5173/api/v1/health` answers through the proxy once the Core runs (smoke-test.sh:111-112 pattern).

Open (hypothesis): the TanStack router plugin (vite.config.ts:79) regenerates `src/routeTree.gen.ts` at start; in a root-owned tree that write would fail if the content differs. The Docker console ran, which suggests no write or a tolerated failure. Row 122 reads the journal for `EACCES`.

## 9. Assumptions, risks, alternatives

| # | Item | Mitigation |
|---|---|---|
| A1 | The tree placed by row 26 includes a complete `node_modules` from `npm ci` (row 27), with `tsx` and `vite` hoisted to the root as on the Mac | rows 26/27 list `node_modules/tsx/dist/cli.mjs` and `node_modules/vite/bin/vite.js` |
| R1 | Double SIGTERM ends the Core without capture shutdown | `KillMode=mixed`; row 58 stop test; fallback 4.4 |
| R2 | `/proc` checks on `MainPID` miss the real Core | section 4.5 for row 59 |
| R3 | Re-copy of the tree resets `.data`/`logs` owners or carries a Mac `.data` | section 2 ordering note; row 26 excludes `.data` |
| R4 | `DEMS_INSTALLATION_DEVICE_ID` differs from the id typed at row 56 | row 57 compares by `grep -c` on a value the user confirms, no print |
| Alt | A data dir outside the tree (HOST-06 as written) | not possible without a code change: no env key or argument sets it (W1) |

## 10. For row 96

| Id | Question | Options | Recommendation |
|---|---|---|---|
| F-S1 | Service-account home (HOST-04 says `<data-dir>`) | (a) `/nonexistent`, no home; (b) `<install_dir>/.data` as HOST-04 | (a): keeps tool caches out of the evidence store; Docker precedent; the Core reads no HOME |
| F-S2 | ExecStart form | (a) `node .../tsx/dist/cli.mjs src/index.ts` + `KillMode=mixed`; (b) `node --import tsx src/index.ts` | (a) first (traced, ran in Docker); switch to (b) if row 58's stop test fails |
| F-S3 | CLI invocation | (a) direct tsx form 7.2; (b) npm form 7.3 | (a): fewer unknowns (U3, U4 drop out) |
| F-S4 | Console | (a) unit enabled; (b) unit on demand; (c) manual | (a), subject to row 14's exposure ruling |
| F-S5 | HOST-34 text says DB settings live in core.env | record as a deviation; they live in `<data_dir>/pg.env` | record (row 11) |

---
*Generated: 2026-10-22 16:45*
*Last Updated: 2026-10-22 16:45*
