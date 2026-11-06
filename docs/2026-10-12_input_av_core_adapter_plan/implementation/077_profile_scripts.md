---
task_id: 2026-10-12_input_av_core_adapter_plan
task_slug: input_av_core_adapter_plan
date: 2026-10-13
agent: coder-execution
blueprint_row: 77
milestone: M5
work_package: WP-14
type: record of the host profile scripts (print-only on this Mac)
narrative_tier: 3
source_plan: identification/03_implementation_blueprint.md (row 77, line 202; profile line 388)
status: complete
closes_requirements: script half of P12-F12 (WP-14), S13-07 RC-5 / BR-12 (the loopback rule as a step, HOST-25), AD-09 (1) host part (HOST-37). None is proven on a host
last_updated: 2026-10-13 00:50 (host clock)
---

# Row 77: the scripts of the Linux host profile, record

**Unproven on Linux.** The scripts were written on the development Mac. Only their print-only mode has run, and only here. The apply mode has run on no machine: on this Mac it is refused before its first step. What the scripts do on Ubuntu 24.04 is proven only by the hardware checks (`9A/H-01` and the checks each item names). No `sudo`, no package, no service, no firewall rule, no user or group, no file outside the repository was created or changed.

## 1. What was built

All new, under `scripts/host/` (repository root). Nothing under `scripts/host/netalias/` and not the profile document were touched.

| File | Items | Apply mode | Lines |
|---|---|---|---|
| `host-profile-lib.sh` | shared part, sourced | the guard and the two writing functions | 313 |
| `10-preflight.sh` | HOST-01 to HOST-03 | none (refused) | - |
| `20-user-dirs.sh` | HOST-04 to HOST-08 | yes | - |
| `30-runtime-media.sh` | HOST-09 to HOST-17 | yes | - |
| `40-network-firewall.sh` | HOST-18 to HOST-25 | yes | - |
| `50-audio.sh` | HOST-26 to HOST-28 | yes | - |
| `60-sleep-time.sh` | HOST-29 to HOST-32 | yes | - |
| `70-core-unit.sh` | HOST-33 to HOST-42 | yes (one step) | - |
| `80-helper-state.sh` | HOST-43 to HOST-47 | none (refused): installs nothing of the helper | - |
| `90-activation-final.sh` | HOST-48, HOST-49, the 16 open points | none (refused) | - |
| `95-database.sh` | DB-01 to DB-07 (the routed PostgreSQL point) | none (refused) | - |
| `test_host_profile_scripts.sh` | the test | - | - |

Total 1,448 lines in 12 files (`wc -l scripts/host/*.sh`).

**Shell: bash**, as Ubuntu 24.04 ships it (`/bin/bash`); not POSIX sh (text substitution and pattern tests are bash). Kept to what bash 3.2 has, so that the print-only mode runs on this Mac (`GNU bash, version 3.2.57`). Every script has `set -eu`. Files are mode 0644 (written with the Write tool; no `chmod` was run): they are started as `bash scripts/host/NN-name.sh`.

## 2. How a script behaves

| Rule | How it is met |
|---|---|
| Print-only is the default | No flag: every step is printed, nothing is started. The scripts use shell built-ins only in that mode: they complete with a `PATH` that holds no real program |
| A changing action only behind a flag | `--apply`. It is refused (exit 3, "Nothing was changed", no step printed) unless `/etc/os-release` names `ID=ubuntu` and `VERSION_ID="24.04"` and the caller is root. No script calls `sudo` |
| No evaluation of input | `/etc/os-release` is read line by line and compared with fixed words, never sourced. Values (`--service-user`, `--install-dir`, `--data-dir`, `--ffmpeg-prefix`, `--camera-interface`, `--camera-address`) must match a closed pattern or the script exits 2; a value is only ever one argument of a fixed command or text in a printed file. No `eval` |
| Each step names its item and its check | `== HOST-nn  title`, then `class`, the command (`would-run` / `would-write`, or `manual`, or `why`), one or more `check` lines, one `confirm` line |
| Nothing pretended | 43 items print "to confirm in 9A/H-nn" exactly where the profile does; the 6 others print "no specific doubt; still unverified on Ubuntu"; `90-activation-final.sh` prints the 16 open points, each with the check that settles it. No script evaluates a check: the checks are the installer's in `9A/H-01` |

Classes of the 49 items:

| Class | Count | Items |
|---|---|---|
| AUTO (run only with `--apply`) | 15 | 04, 05, 06, 10, 13, 18, 20, 23, 25, 26, 29, 30, 31, 32, 37 |
| MANUAL (the user's; no mode runs it) | 14 | 09, 11, 12, 14, 15, 19, 22, 33, 34, 43, 44, 45, 46, 49 |
| NONE (no command; the reason is printed) | 20 | 01, 02, 03, 07, 08, 16, 17, 21, 24, 27, 28, 35, 36, 38, 39, 40, 41, 42, 47, 48 |

## 3. The routed PostgreSQL point

`95-database.sh` prints seven steps, DB-01 to DB-07, each "to confirm on the host", none with an item id of the profile: the server source (three choices: distribution package, the PostgreSQL project's packages, the embedded binaries the development uses, with why the third is not usable as it is), the version (18.4 is the only one tested), the data directory, loopback only (`listen_addresses = '127.0.0.1'`, the port open), the two roles, the database `dems_demo` with the three `db:` commands of the acceptance frame, and the start order before the Core. It has no apply mode. Facts used: `package.json:65,70` (embedded-postgres 18.4.0-beta.17, install script allowed for darwin-arm64 only), `scripts/pg/init.mjs:89-94,239` (writes into `.data/`, port 4432), `scripts/hardware-acceptance/HW-ACCEPTANCE-1-FRAME.md:221,239-240,452-453`. The version of the distribution package (16) is the author's recollection and is printed as such.

One line in `file_requests.md` asks the profile document to gain the matching items (proposed HOST-50 to HOST-56).

## 4. Checks run on this Mac

| Check | Command | Result line |
|---|---|---|
| The test, first run | `/bin/bash scripts/host/test_host_profile_scripts.sh` | `RESULT: 160 passed, 6 failed` (two faults of the TEST: its word pattern matched the English word "source" in step text; the `mktemp` of macOS ignores `TMPDIR` and was denied by the sandbox) |
| The test, second run after both were fixed in the test | same | `RESULT: 167 passed, 0 failed`, exit 0 |
| shellcheck | `which shellcheck` | `shellcheck not found`: NOT run. The test runs it when present |
| Paths outside the repository | `ls /etc/dems /opt/dems` | `No such file or directory` twice |
| The scripts folder in git | `git status --porcelain -- scripts/host` | only the 12 new files, untracked |

What the 167 checks cover: `bash -n` and the `set -eu` line of every script; no `eval`; the shared file is the only file read as shell text; each of the 10 scripts exits 0 without a flag, with empty standard error, the PRINT-ONLY line, the UNPROVEN line and "commands run 0; files written 0"; the scripts name 49 items, each once, equal to the ids of the profile document; every item has a class, a check line, one confirm line and what its class needs; the "to confirm" marks equal the profile's item by item (43 marked, 6 plain); 16 open points; 7 database steps; `--apply` refused by all 10 (exit 3 for the six with an apply mode, exit 2 for the four that only print), nothing printed, nothing started; 17 refused values (among them `$(touch planted)` and a backquoted command: no file planted); given values replace the placeholders; the apply branch of the two writing functions called directly against the doubles (the command started equals the command printed; the file is handed to `install` with mode and owner; placeholder replaced); checksums of every file under `scripts/host/` equal before and after.

**The double.** Every run of a script has `PATH` set to one folder that holds only recording doubles of 55 tools (`sudo`, `apt-get`, `useradd`, `usermod`, `groupadd`, `install`, `systemctl`, `ufw`, `nft`, `sysctl`, `ldconfig`, `netplan`, `timedatectl`, file tools, database tools, and others). A started tool is either recorded or fails as "command not found". Recorded calls after the 10 print-only runs, the 10 refused apply runs and the value runs: **0**. Verification cell of the row: every script completes in print-only mode (10 of 10); files changed outside the temporary folder of the run: **0**.

## 5. What stays unproven

- The whole apply mode: the guard on a real Ubuntu 24.04, every AUTO command, the files as written by `install`. Its first run is `9A/H-01`, or the container of row 78 (a container result, not a host result).
- Every command text and every check line: copied from the profile document, where 43 of 49 are marked. Package names, the `nftables` rule beside `ufw`, `apport`, `netplan` are not read on a host.
- The 16 open points, unchanged.
- shellcheck findings, if any.
- The database steps: a proposal; no step has run anywhere.

## 6. Driver decisions (conservative; for the controller to confirm)

| # | Decision | Why |
|---|---|---|
| D-1 | bash, not POSIX sh | Text substitution of placeholders and pattern tests without starting a program; Ubuntu 24.04 ships bash |
| D-2 | Even with `--apply`, 14 steps are never run by a script: the camera address (`netplan try`), turning the firewall on, removing packages, downloading or building Node.js and FFmpeg, building the worker, writing file G and the environment file, starting the Core, everything of the helper | An unattended address change or firewall start can cut the user off; a checksum comparison is the user's; file G's `ExecStart` is unsettled (`9A/H-16`); the environment file holds the user's values; the helper has its own chapter (row 127) |
| D-3 | No way to override the distribution guard (no variable, no flag) | A switch that lets the apply mode run elsewhere would be a way to change this Mac. Price: the apply mode of the scripts is not run by any test here; only its two functions are, called directly |
| D-4 | `--service-user` refuses `root` and `dems` | The profile: the account must not be that of an earlier input-av installation, whose installer uses `dems` (`apps/input-av/scripts/install.sh`) |
| D-5 | File C is written whole under HOST-20 (`40-network-firewall.sh`); HOST-37 refers to it | One file, one writer; it carries the lines of both items |
| D-6 | HOST-30 needs `--with-lid` in addition to `--apply` | The item applies only to a host with a lid |
| D-7 | No `apt-get update` before the installs | The profile names none. On a fresh host the install may fail loudly; to settle in `9A/H-01` or row 78 |
| D-8 | The helper's group is the constant `dems-netalias`, not an option | Fixed by the delivered socket unit (`scripts/host/netalias/dems-core-netalias.socket`) |
| D-9 | The database steps carry ids DB-nn, not HOST-nn | The profile document has no such items; its writer is asked to add them |
| D-10 | Files left at mode 0644 | The rules allow Edit and Write only |

## 7. Findings for other rows

| For | Finding | Blocking |
|---|---|---|
| Row 76's document | The database items (request filed) | no |
| Row 78 (container) | The apply mode can have its first run there, as root in the container: `bash scripts/host/20-user-dirs.sh --apply ...` and the others; `40` needs a service manager and `ufw`, which a plain container may not have | no |
| Row 125, 135 | The installer runs the scripts in number order; print-only first, then `--apply` for 20 to 70; the MANUAL steps and the helper chapter in between as the output states | no |

## 8. Files

| File | Kind |
|---|---|
| `scripts/host/host-profile-lib.sh`, `10-preflight.sh`, `20-user-dirs.sh`, `30-runtime-media.sh`, `40-network-firewall.sh`, `50-audio.sh`, `60-sleep-time.sh`, `70-core-unit.sh`, `80-helper-state.sh`, `90-activation-final.sh`, `95-database.sh`, `test_host_profile_scripts.sh` | new |
| `docs/2026-10-12_input_av_core_adapter_plan/implementation/077_profile_scripts.md` | new, this record |
| `docs/2026-10-12_input_av_core_adapter_plan/delegation_progress/row_077.md` | new, short record |
| `delegation_progress/file_claims.md`, `delegation_progress/file_requests.md` | one line appended to each |
