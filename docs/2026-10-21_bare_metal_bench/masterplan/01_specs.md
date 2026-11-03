---
task_id: 2026-10-21_bare_metal_bench
task_slug: bare_metal_bench
date: 2026-10-22
agent: data-analyst
row: 17
type: spec (consolidated install specification; reconciliation of install deltas 11, 13, 14, 15, 16 against the install register (row 12) and the R-FLEX specification (row 95))
narrative_tier: 1
confidence: HIGH for the reconciliation (every resolution cites its source file and section; three code facts re-read this session); MEDIUM for host behaviour, which no row has run on .73 yet (hypotheses carried, section 9)
source_structured_task: docs/2026-10-21_bare_metal_bench/identification/02_structured.md (row 17, line 185)
source_translated_task: docs/2026-10-21_bare_metal_bench/identification/01_translated.md (AC1-AC8, lines 53-64)
inputs: masterplan/01_specs_register.md (12), masterplan/01_specs_database.md (13), masterplan/01_specs_security.md (14), masterplan/01_specs_service.md (15), research/03_analysis_impact.md (16), research/03_analysis_applicability.md (11), masterplan/01_specs_rflex.md (95), masterplan/01_specs_rflex_host_docs.md (93), masterplan/01_specs_rflex_register.md (87 + section 11), delegation_progress/file_requests.md, decisions/decisions.md D8-D16, decisions/02_rflex_decision_sheet.md
register_edits: masterplan/01_specs_register.md line 63 corrected (D16 I-01) and section 11 added (this row)
last_updated: 2026-10-22 17:40
---

# Consolidated install specification for host .73 (row 17)

## 0. How to read this file

- This file is the single install specification for rows 18 (runbook), 19 (refinement), 20-79 and 122-128 (execution), and 74-78 (verification). Where it differs from a delta file (rows 11, 13, 14, 15, 16), **this file wins**. Each difference is listed in section 3 with its reason. The delta files are not edited (row 17 brief).
- Install names come only from `masterplan/01_specs_register.md` (cited "register §n"), including its section 11, which this row adds. R-FLEX names come only from `masterplan/01_specs_rflex_register.md` and `masterplan/01_specs_rflex.md` (cited "SPEC-RF §n").
- Short references: DB = `masterplan/01_specs_database.md` (row 13); SEC = `masterplan/01_specs_security.md` (row 14); SVC = `masterplan/01_specs_service.md` (row 15); IMP = `research/03_analysis_impact.md` (row 16); APP = `research/03_analysis_applicability.md` (row 11); HD = `masterplan/01_specs_rflex_host_docs.md` (row 93); SHEET = `decisions/02_rflex_decision_sheet.md` (row 96); HP = `scripts/host/HOST-PROFILE-UBUNTU-24.04.md`.
- "SI-nn" names a spec item of section 4. Section 5 maps AC1-AC9 to them.
- No secret value appears in this file. Secret slots are named only.

### 0.1 5W1H (Tier 1)

| W | Answer |
|---|---|
| What | One reconciled install specification: every `<DEP:...>` and `<REQ:...>` placeholder of the install deltas resolved, the install register completed, the cross-delta conflicts settled, the user's row-96 rulings (D16) applied, AC1-AC9 mapped to spec items, and the blueprint edge and row requests collected for row 19 |
| Who | Producer: data-analyst (row 17). Consumers: row 18 (runbook), row 19 (task-architect refinement, MAJOR/MINOR), rows 20-79 and 122-128 (executors), rows 74-78 (verification, deviation register). Decider of every ruling applied here: the user (D8, D12, D16) |
| When | 2026-10-22, after rows 11, 13-16 landed and the user answered the row-96 sheet (D16). Before row 18. The install itself still waits for gate G-RF (row 119; D10 ruling 3) |
| Where | Docs only. Target host `gsp-dems@192.168.0.73` (Ubuntu 24.04.1, one ext4 file system, Wi-Fi the only admin path; register §0) |
| Why | The five install deltas were written in parallel under D13 and left 25 placeholders, two blueprint edges and several mutual inconsistencies (section 3). D15 moved the resolution of their `<DEP:...>` placeholders to this row. Without one reconciled file, the runbook (row 18) would inherit contradictions such as a baseline layout that fails on its second command (C-3) and a dump command the specified `pg_hba.conf` refuses (C-4) |
| How | (1) Every placeholder was listed by `grep -o -E '<(DEP\|REQ):[^>]+>'` over the five deltas (section 2). (2) Each was resolved against the landed source that owns it, cited by file and section. (3) Every cross-delta statement on the same object was compared; the owning row's statement wins, unless a later user ruling (D16) or a code fact re-read this session decides otherwise. (4) New register names were grepped in both registers and in `apps/`, `packages/`, `scripts/`, `deploy/` before the edit (section 8) |
| Alternatives | Per conflict in section 3. Editing the delta files in place was rejected (brief; the R-FLEX precedent SPEC-RF §0 keeps deltas unedited and records substitutions) |
| Assumptions | (A1) D16 applies every recommendation of SHEET sections 2-4 as written. (A2) R-FLEX lands on its recommended path: no migration (Q96-07 a), `usb_port` kept (Q96-09 a), set-IP and scan bound (Q96-04 a). (A3) The host is in the state recorded by the row-6 survey plus 02_/03_ host files; nothing changed since (no host access in this row) |
| Gaps | Section 9 |

## 1. Rulings applied (D16 and earlier)

| Ruling | Source | Effect on this spec |
|---|---|---|
| I-01 (a) home `/nonexistent` | SHEET §3 I-01; SVC §3, F-S1; SEC §4 | `dems-core` and `dems-console` get `--home-dir /nonexistent --no-create-home`. Register line 63 corrected by this row. Deviation from HOST-04 (HP:56) for row 78 |
| I-02 (a) ExecStart tsx `cli.mjs` + `KillMode=mixed`, fallback `node --import tsx` | SHEET I-02; SVC §4.1-4.4 | SI-21; fallback switch rule of IMP R10 adopted |
| I-03 (a) CLI direct tsx | SHEET I-03; SVC §7.2 | `cli_cache_dir` is not created and not registered; every `<REQ:cli_cache_dir>` resolves to "N/A" (section 2) |
| I-04 (a) console unit enabled | SHEET I-04; SVC §8.3; SEC §3 | SI-22 |
| I-05 HOST-34 deviation recorded | SHEET §4; SVC F-S5; APP HOST-34 (PD-11-07) | DB settings live in `/opt/dems/core/.data/pg.env`; `core.env` holds no `DEMS_PG_*` |
| I-06 (a) 9A/H-07 not named | SHEET I-06 | rows 125-127 observe re-plug |
| I-07 (a) 9A/H-12 named in rows 66-69 | SHEET I-07 | steps .1-.2 run; steps .3-.4 do not run because row 124 is N/A (Q96-16 a, SHEET:138) |
| I-08 (a) HOST-28 on the USB card by id | SHEET I-08; APP PD-11-05 | SI-15 |
| I-09 (a) SSH from any source on `wlp3s0` | SHEET I-09; SEC §2.3 | SI-14 |
| I-10 (a) ufw built-in accepts kept, recorded | SHEET I-10; SEC §2.4 | row 72 does not count an ICMP echo answer as a breach |
| I-11 (b) + (c) if applicable | SHEET I-11 | the user's own action; no install row. Deletion only on the user's word |
| I-12 (a) sshd settings recorded only | SHEET I-12; SEC §2.2 R0 | SI-14 R0 |
| I-13 (a) the user types `DEMS_INSTALLATION_NAME` at row 57 | SHEET I-13 | SI-25 |
| I-14 (a) camera-page forward ports 18101/18102/18103/18117 | SHEET I-14; register §5.3 | SI-26 |
| I-15 (a) keep `dems_demo` | SHEET I-15; DB For row 96 | no reset after acceptance |
| I-16 PostgreSQL `18.6-1.pgdg24.04+2` held; `pg.owner.env` ephemeral, owner `PASSWORD NULL` between runs | SHEET §4; DB §2.2, §4.3 | SI-17, SI-19, SI-23; deviation from HP:149 "18.4 tested" for row 78 |
| I-17 (b) watchdog no-reboot flag right after row 21 | SHEET I-17; IMP §8.2-1 | SI-03; row-order request E-4 (section 6) |
| I-18 (a) recordings only while the user is at the bench | SHEET I-18; IMP Finding 3 | SI-27 stop rule |
| I-19 (a) INSTALL-R-A default | SHEET I-19; IMP §7.1 | SI-31 |
| I-20 (a) no Docker restore planned | SHEET I-20; IMP §7.3 | IMP §7.3 stays a reference only |
| SEC-NPM | SHEET §4; SEC §5 option A | SI-09 |
| Q96-04 (a) set-IP and scan bound | SHEET; SPEC-RF §1.2 RF-N3 | HOST-46 N/A on the bench (helper absent, `NOT_ASKED`); row 124 N/A |
| Q96-07 (a), Q96-09 (a) | SHEET §2, §4; SPEC-RF §1.3 RF-P3 | no R-FLEX migration: 34 migration files, schema 15, `dbc-16` (SI-23) |
| Q96-11 (a) HOST-19 accepts a network-manager equivalent | SHEET Q96-11; HD E-P4b | once row 113 lands, A8 is no longer a deviation of form; the bench record keeps the A8 note |
| Q96-15 (a) count only; Q96-16 (a) row 124 N/A; Q96-17 (a) AC text of SPEC-RF §7 | SHEET; SPEC-RF §2.8, §7 | SI-26; AC9 text in section 5 |
| Q96-18 (a) R-FLEX-R-B | SHEET; SPEC-RF §8.3 | SI-31 code rollback; no DB down step |
| D5, D6, D7, D8 (A1-A10, OI-1..OI-7, F7), D12 (U-RF3..U-RF10) | decisions.md | carried unchanged |

## 2. Placeholder resolutions

Every `<DEP:...>` and `<REQ:...>` placeholder of the install deltas, found by `grep -o -E '<(DEP|REQ):[^>]+>'` over DB, SEC, SVC, IMP and APP this session (counts in brackets). The deltas keep their text; implement with the "Resolved value" column.

### 2.1 `<DEP:...>` placeholders

| # | Placeholder (file, sections) | Resolved value | Source |
|---|---|---|---|
| P-01 | `<DEP:row91:migrations>` (DB §5, §11) [2] | **34** migration files `0000_prelude.sql` .. `0033_capture_device_retirement_privileges.sql`, journal head idx 33, version row schema **15**, contract **`dbc-16`**. No R-FLEX migration. (36 files / 16 / `dbc-17` would apply only under Q96-07 b or Q96-09 b, both not chosen) | SPEC-RF §1.3 RF-P3, §9.2; R-FLEX register §11.2 (DB-A1, DB-M1..M5 not used); D16 (Q96-07 a, Q96-09 a); DB C14 |
| P-02 | `<DEP:row91:down_migration>` (IMP R12) [3] | **None.** R-FLEX has no migration on the chosen path; a code rollback is R-FLEX-R-B (reverse patch `rflex_only_diff`, R-FLEX register RB-1), with no DB step. A bench DB built with R-FLEX code stays valid for the old code. In IMP R12's command block, the step `<DEP:row91:down_migration>` is dropped | SPEC-RF §9.2; D16 Q96-18 a; SHEET Q96-18 "Tidak ada langkah DB di jalur rekomendasi" |
| P-03 | `<DEP:row11:HOST-29_applicability>` (IMP Finding 5, §7.1 step 3) [2] | **Applicable, already PASS**: the four sleep targets are masked since 10-20; row 38 re-checks only. No change by the install, therefore no rollback step. HP §6 "unmask the four targets" is NOT run on .73 (deviation for row 78, E-5) | APP HOST-29 line (APP:90) |
| P-04 | `<DEP:row11:HOST-37_apport_file>` (IMP §4.3, §6 S5, §7.1 step 3) [4] | **No apport settings file is changed.** HOST-37 changes only the unit (`sudo systemctl disable --now apport.service`) plus the two core lines of file C (HP:114). Baseline (row 20): `systemctl is-enabled apport.service` into the baseline folder, and a copy of `/etc/default/apport` only if it exists (it is not modified; the copy is for comparison). Rollback: `sudo systemctl enable --now apport.service` only if the baseline shows it `enabled` | HP:114; APP HOST-37 (APP:98, apport state "not surveyed", row 33 records it) |
| P-05 | `<DEP:row13:dump_command>` (IMP R8, R11) [3] | `sudo -u postgres pg_dump -p 4432 -Fc dems_demo` (unix socket, peer authentication; **no `-h 127.0.0.1`**: DB §3.2 `pg_hba.conf` admits `postgres` only on the `local` line). Output redirected by the calling shell into `<install_backup_dir>/dems_demo.pgdump` | DB §3.1 (socket kept, peer for `postgres` only), §3.2; conflict C-4 |
| P-06 | `<DEP:row13:dump_command_globals>` (IMP R8) [2] | `sudo -u postgres pg_dumpall -p 4432 --globals-only --no-role-passwords` into `<install_backup_dir>/pg_globals.sql`. `--no-role-passwords` keeps the SCRAM verifier of `dems_app` out of the backup; roles are recreated with fresh secrets by DB Block R on restore | DB §4.4 (rotation by Block R); conflict C-5. `--no-role-passwords` is a `pg_dumpall` option since PostgreSQL 10 (from knowledge, not fetched; row 18 confirms with `pg_dumpall --help` on the host) |
| P-07 | `<DEP:row13:db_status_invocation>` (IMP R2) [2] | DB Block O (DB §4.4) with `STEPS='src/db/commands/status.ts'`, Core stopped. Expected line: `OK: dems_demo is at the schema version this code expects and the ledger matches the files` (DB §7 HOST-55) | DB §4.4 note "For a later upgrade", §7 |
| P-08 | `<DEP:row89:HOST-23>` (SEC §9 note) [1] | Not needed: HOST-23 = `ufw allow in on enp4s0 proto udp from any port 3702`, camera port only (U-RF3) | SEC §2.1; HD §3 HOST-23 |
| P-09 | `<DEP:row89:guards>` (IMP placeholder table) [1] | Not needed: RG-1..RG-14 kept (Q96-05 a) | IMP; D16 Q96-05 a |
| P-10 | `<DEP:row93:HOST-nn>`, `<DEP:row93>` (APP, history notes only) [2] | Already resolved by row 11 against HD lines 63-70 | APP "Placeholders for row 95" |
| P-11 | `<DEP:row91:...>`, `<DEP:row11:...>`, `<DEP:...>` (generic mentions in DB/IMP/SEC text) [3] | No value: these are references to the placeholder kind, not placeholders | - |

### 2.2 `<REQ:...>` placeholders (install register names)

| # | Placeholder (files) [count] | Resolved value (register §11.1) | Requested by |
|---|---|---|---|
| P-12 | `<REQ:ufw_revert_unit>` (SEC §2.2 [9], IMP R1 [5]) | `dems-ufw-revert`: transient `systemd-run` unit; its timer `dems-ufw-revert.timer`, its service `dems-ufw-revert.service`; exists only between SEC R5 and R8 | rows 14, 16 (file_requests.md) |
| P-13 | `<REQ:pg_socket_dir>` (DB §3.1, §7 [3]) | `/var/run/postgresql` (socket file `/var/run/postgresql/.s.PGSQL.4432`, owner `postgres`, mode 0700 per DB §3.1). Hypothesis until row 39: package default; `/var/run` is a link to `/run` on Ubuntu (not read on .73) | row 13 |
| P-14 | `<REQ:pg_conf_dir>` (DB §7 [4]) | `/etc/postgresql/18/main` (holds `postgresql.conf`, `pg_hba.conf`, `start.conf`). Hypothesis until row 39 | row 13 |
| P-15 | `<REQ:pg_common_conf>` (DB §7 [2]) | `/etc/postgresql-common/createcluster.conf` (line `create_main_cluster = false`). Hypothesis until row 39 | row 13 |
| P-16 | `<REQ:pg_log_file>` (DB §3.1 [2]) | `/var/log/postgresql/postgresql-18-main.log` (packaged logrotate). Hypothesis until row 39 | row 13 |
| P-17 | `<REQ:host_baseline_dir>` (IMP [12]) | `/home/gsp-dems/dems-host-baseline-<YYYYMMDD>`, `gsp-dems:gsp-dems` 0700; `<YYYYMMDD>` = host local date at the start of row 20; exactly one folder; layout per C-3 | row 16 |
| P-18 | `<REQ:install_backup_dir>` (IMP [8]) | `/home/gsp-dems/dems-install-backup-<YYYYMMDD-HHMM>`, `gsp-dems:gsp-dems` 0700; one folder per backup (before rows 44, 57, 71, any tree re-copy, any rollback) | row 16 |
| P-19 | `<REQ:disk_free_threshold>` (IMP R6 [3]) | `20 %` free on `/`. Stop rule: stop when `df --output=pcent / \| tail -1 \| tr -dc 0-9` prints a value above `80` | row 16 |
| P-20 | `<REQ:cli_cache_dir>` (DB §4.4, §8, §11 [3]; SEC §4, §9 [4]; SVC §0, §7.3 [3]) | **N/A, not registered.** The npm CLI form (SVC §7.3) is not chosen (D16 I-03 a); the direct-tsx form needs no npm cache | SHEET I-03; file_requests.md RULING (held) |
| P-21 | `<REQ:name>` (DB §0 text) [1] | No value: describes the placeholder kind | - |

Total: 25 distinct placeholder strings (86 mentions across the five files), each with a value or a stated "no value"; 0 open.

### 2.3 Other angle-bracket names left by IMP (not DEP/REQ, closed here so row 18 has one value each)

| IMP name | Resolved value | Basis |
|---|---|---|
| `<staging folder of row 121>` (R8) | register §11.1 `tree_staging_dir` = `/home/gsp-dems/dems-tree-staging-<YYYYMMDD>` | blueprint row 121 "NEW under /home/gsp-dems/" (02_structured.md:415) |
| `<ffmpeg build directory declared by row 28>` (R6) | register §11.1 `ffmpeg_build_dir` = `/home/gsp-dems/dems-ffmpeg-build-9.0.2` | IMP R6 (build tree removed after row 31; prefix stays) |
| `<row unit>` (R2, long builds detached) | register §11.1 `host_build_unit` = `dems-host-build-row<NN>` (`systemd-run --unit=dems-host-build-row28 --collect ...`) | IMP R2 mitigation |
| `<pin>` (R11) | `18.6-1.pgdg24.04+2` | D16 I-16; DB §2.2 |
| `<baseline marker>` (§4.2) | `<host_baseline_dir>/marker` (written by the row-20 block) | IMP §4.3 last lines |
| `<daemon.json member>`, `<tarball>` (§7.3) | N/A: Docker restore not planned (D16 I-20 a) | SHEET I-20 |
| `<row start>`, `<timestamp>`, `<line>`, `<list>` | runtime values or ufw's own file suffix; no register value | IMP R4, R1, R11 |

## 3. Conflicts between the deltas, and how they are settled

| Id | Conflict (where) | Resolution | Reason |
|---|---|---|---|
| C-1 | Role-secret form. SEC §1 S3 rule 1: 43 characters of `[A-Za-z0-9]` from `tr`, written with `printf`, session settings `SET log_min_error_statement TO panic; SET log_statement TO none;`. DB §4.4: generator `randomBytes(32).toString("base64url")` (43 characters of `[A-Za-z0-9_-]`), file written by `appendFileSync` into a pre-created 0600 file, server gets only the SCRAM verifier | **DB §4.4 generator governs** (D16 I-16 accepted row 13's flow; the clear secret never reaches a statement, DB C11, `scripts/pg/db.mjs:28-38` re-read this session). Two additions from SEC: (1) the psql stdin of Block R and Block O begins with SEC's two `SET` lines, so a failing `ALTER ROLE` does not log its statement; (2) SEC §7's scan pattern is widened from `[A-Za-z0-9]{43}` to `[A-Za-z0-9_-]{43}` with the boundary class `[^A-Za-z0-9_-]`, so a leaked base64url secret is still detected | The settings-file parsers accept any value after `=` (`/^([A-Z][A-Z0-9_]*)=(.*)$/`, re-read this session in `owner-connection.ts:136` and `plugins/config/connection-file.ts:64`). Without the wider pattern, SEC's own leak scan would miss DB's form |
| C-2 | ufw order and revert command. SEC §2.2 R0-R8 (`ufw disable`, SSH rule before defaults, `default allow outgoing`). IMP R1 (defaults before SSH rule, `ufw --force disable`, no `allow outgoing` line) | **SEC §2.2 R0-R8 governs** (security owns the ruleset; D5/HOST-22 "SSH rule first"), with IMP's `/usr/sbin/ufw --force disable` as the revert command (non-interactive in every ufw version). IMP R1's command block is superseded; IMP R1's five stop preconditions stay | SEC §2.3; IMP R1 |
| C-3 | Baseline layout (IMP §4.3). `cp -a ... /etc/default/ufw ... "$B"/` creates the FILE `$B/ufw`; the next line `cp -a /etc/ufw "$B"/ufw` then fails ("cannot overwrite non-directory"). IMP R1's rollback reads `<baseline>/default/ufw`, a path the block never writes | Layout mirrors absolute paths: `sudo cp -a --parents /etc/passwd /etc/group /etc/shadow /etc/gshadow /etc/default/ufw /etc/ufw "$B"/` (gives `$B/etc/default/ufw`, `$B/etc/ufw/ufw.conf`); `/etc/default/apport` copied the same way only if present (P-04). Every restore reads `$B/etc/<path>` | Mechanical defect in the block as written (GNU `cp` semantics); paths must match between backup and restore |
| C-4 | Dump command. IMP R8 default: `pg_dump -h 127.0.0.1 -p 4432` as `postgres`. DB §3.2: `pg_hba.conf` has no TCP line for `postgres` | Socket form (P-05) | DB §3.2 is the configured state; a TCP connection as `postgres` would be refused |
| C-5 | Globals dump (IMP R8) would carry the `dems_app` SCRAM verifier into a backup | `--no-role-passwords` (P-06) | SEC §1 S3 "never stored elsewhere"; Block R recreates the secret |
| C-6 | `core.env` capture paths. Register §6.1: `DEMS_CAPTURE_WORKER`, `_RELAY`, `_GUARD`, `_AUDIO_HELPER` "REAL" only. SVC §5: set in BOTH forms | **SVC §5 governs** (register §6 delegates key inclusion to row 15) | SVC §5: the parse rule then fails at the SIMULATED boot (row 48), not at row 58 |
| C-7 | Register §6.1 left `DEMS_LOG_LEVEL`, `DEMS_CAPTURE_HELPER_FFMPEG`, `DEMS_DEMO_CONTROLS` to row 15 | All three **absent** in both forms (SVC §5 table) | SVC §5 |
| C-8 | Register §2 line 63: home `/opt/dems/core/.data`. SVC §3, SEC §4, APP HOST-04: `/nonexistent` | `/nonexistent` (D16 I-01). Register line 63 corrected in place by this row | SHEET I-01 "register instalasi :63 dikoreksi di baris 17" |
| C-9 | Console forward. Register §5.3: `-L 5173:127.0.0.1:5173`. SEC §1 S2, S4: bind the Mac side explicitly, `-L 127.0.0.1:5173:127.0.0.1:5173`, same for the camera forwards | SEC form: `-L 127.0.0.1:5173:127.0.0.1:5173` and `-L 127.0.0.1:18101:192.168.100.101:80` (and 18102, 18103, 18117) | SEC S2: the forward never listens on the Mac's LAN side; Origin guard unaffected (local port stays 5173, host `127.0.0.1`) |
| C-10 | Flag timing. IMP R3 stop rule checks the flag "before row 48"; blueprint row 123 sets it before the first Core start | Flag set right after row 21 (D16 I-17); IMP R3's flag check applies from row 22 onward | SHEET I-17 |
| C-11 | Register §3.1 "npm cache / temp ... row 14 decides" | None created. tsx writes `/tmp/tsx-<uid>` (owner `dems-core`, mode from `UMask=0077`; hypothesis until rows 54/58) | SEC §4; SVC §4.6, §7.4 U1 |
| C-12 | `pg.owner.env` lifetime. Register §3.2 and SEC §1 S3: "row 13 decides" | Exists only during an owner run; owner role `PASSWORD NULL` between runs | DB §4.3; D16 I-16 |
| C-13 | HOST-51 in APP: "pending U-RF10" | `18.6-1.pgdg24.04+2`, held; fallback `18.4-1.pgdg24.04+1` on DB §2.2's rule; deviation from HP:149 "18.4 tested" recorded for row 78 | DB §2.2; D16 I-16 |
| C-14 | HOST-46 in APP: "row 45 records the outcome as amended once row 93 lands" | Outcome fixed: N/A, helper absent; `/etc/dems/netalias-interface` must not exist; boot reports `NOT_ASKED` | HD §7 row 45; D16 Q96-04 a |
| C-15 | IMP R12 stop rule "row 96 answered Q89-1..Q89-5" | Satisfied by D16 (Q96-04..Q96-08, the de-duplicated ids of SPEC-RF §8.2). The other half (gate 119 posture confirmation) still holds | SPEC-RF §8.2 "Merges" column |
| C-16 | IMP and R-FLEX both say "R-A/R-B" | Qualified names: INSTALL-R-A / INSTALL-R-B (IMP §7.1/7.2) and R-FLEX-R-A / R-FLEX-R-B (row 94) | SPEC-RF X-5 |
| C-17 | Blueprint rows 66-69 and 128 check "search result names the interface" | Replaced by the `interfaceCount` check (section 6, E-8) | SPEC-RF §2.8; HD §7; D16 Q96-15 a |
| C-18 | Row 44 verification "schema version equals the R-FLEX journal head" | Journal head idx 33, 34 entries, schema 15 / `dbc-16` (P-01) | SPEC-RF RF-P3 |
| C-19 | Row 41 verification "settings files exist with spec mode" | `pg.env` exists `dems-core dems-core 600`; `pg.owner.env` is **absent** | DB §10 |
| C-20 | Copy form at row 26 vs a later re-copy. IMP R8 copies without delete (keeps `.data`), so files that a newer tree removed would stay behind | First placement: as IMP R8. A re-copy (re-opened G-RF) compares the placed tree to the row-121 manifest and lists extra files; their removal is a listed `rm` per file under the R7/R8 stop rules, never `--delete` and never under `.data` | IMP R8; blueprint row 26 verification "manifest sha256 equals row-121 manifest" |

No conflict was found between DB §7, SVC §4.1 and APP HOST-56 on the PostgreSQL unit name (`postgresql@18-main.service` in all three; hypothesis until row 39).

## 4. Consolidated specification items

Each item names its rows, the governing source section, and what this file adds or changes. Commands live in the cited sections; row 18 copies them with the resolutions of sections 2 and 3 applied.

### 4.1 Constraints that hold for every host row (20-79, 122-128)

| Id | Constraint | Source |
|---|---|---|
| SI-00a | No secret value in any command line, output, doc or transcript. Checks print names, modes, counts and exit codes only | SEC §1; 02_structured.md §4 |
| SI-00b | **Purge and autoremove ban.** A command line holding `apt-get purge`, `apt purge`, `dpkg -P`, `dpkg --purge`, `autoremove` or `docker` is a stop. A command holding `rm`, `mv`, `chown`, `chmod`, `tar -x` or `rsync --delete` with `/var/lib/docker`, `/var/lib/containerd`, `dems-backup-20261021`, `dems-change-backup-20261021.sql` or `DEMS-Linux-Docker-LCD-20261019` is a stop. End of each stage: `du -sb` of the two Docker paths equals the baseline, and the backup `SHA256SUMS` check prints nothing | IMP R7, §4.2 |
| SI-00c | `.data` protection: no `chown -R` over `/opt/dems/core`, no `rm -rf /opt/dems/core`, no copy with delete; `stat -c '%U:%G %a' /opt/dems/core/.data` prints `dems-core:dems-core 700` before and after rows 26, 27, 122 and any re-copy | IMP R8 |
| SI-00d | Wi-Fi guard before each host row: kernel journal has 0 lines matching `IO_PAGE_FAULT\|failed to get tx report` this boot, and the watchdog logged no reload/reboot in the last 15 min. A dropped SSH call is retried once after 60 s, then `blocked` | IMP R2; driver_rules.md addendum |
| SI-00e | Clock guard before rows 47, 48, 58, 62-65, 71, 125-128: `timedatectl show -p NTPSynchronized --value` prints `yes`; no manual `set-time` | IMP R5 |
| SI-00f | Disk guard before rows 24, 27, 28, 44 and each recording: used share of `/` not above 80 (`disk_free_threshold` 20 %) | IMP R6; P-19 |
| SI-00g | Long builds and installs run detached (`systemd-run --unit=dems-host-build-row<NN> --collect ...` or `nohup` with a log file), so an SSH drop does not kill them | IMP R2 |
| SI-00h | Secret scan (SEC §7) with the widened 43-character pattern of C-1, run by each row on its own files before `complete`, and by row 75 over the task folder | SEC §7; C-1 |

### 4.2 Host preparation (rows 20-38, 123)

| Id | Item | Rows | Governing source | Added or changed here |
|---|---|---|---|---|
| SI-01 | Preflight HOST-01..03, **plus HOST-17** (two `ps` observations: `ps -axo pid=,comm=` short names, `ps -axo pid=,args=` full paths), HOST-21 re-check (no `ii` container runtime) | 21 | APP HOST-01..03, HOST-17, HOST-21; HP:74 | HOST-17 assigned to row 21 (E-3) |
| SI-02 | Pre-change baseline in `host_baseline_dir`: the file list and state lists of IMP §4.3 with the C-3 layout, apport per P-04, `docker_kept_du.txt`, backup check, `marker`, `SHA256SUMS.baseline`. Folder never copied off-host (holds `/etc/shadow` copies) | 20 | IMP §4.3 | C-3, P-04, P-17 |
| SI-03 | Watchdog no-reboot flag `/etc/dems-wifi-watchdog.noreboot`, `root:root` 0644, empty, **right after row 21**; `dems-wifi-watchdog.timer` stays active. Removal only with no recording running (IMP R3 rollback) | 123 (moved) | register §3.2; IMP R3 | D16 I-17; edge request E-4 |
| SI-04 | Accounts and groups: `dems-core` (`--system --home-dir /nonexistent --no-create-home --shell /usr/sbin/nologin`), group `dems-netalias` (`--system`) with `dems-core` as only member, `dems-core` into `audio` (row 37), `dems-console` (same form, no supplementary group) | 22, 23, 37 | SVC §3; register §2 | home per D16 I-01 (C-8) |
| SI-05 | Directories and the writable exceptions of the root-owned tree: `/opt`, `/opt/dems`, `/opt/dems/core` root 0755; `.data`, `.data/media`, `.data/media/sessions`, `apps/core-server/logs` `dems-core` 0700; `apps/core-web/node_modules/.vite` `dems-console` 0700 (row 122). `install -d` lines re-run after any tree copy | 22, 26, 122 | SVC §2 table; register §3.1 | PD-11-01, PD-11-02 recorded (section 7) |
| SI-06 | apt package set: HOST-10 build tools (incl. `clang`, `libasound2-dev`), HOST-18 `iputils-arping`, `nftables`, `alsa-utils`, `iputils-ping`; HOST-11 `dpkg -s libavformat-dev` reports not installed | 24 | APP HOST-10, -11, -18; 02_structured.md row 24 | SI-00b applies |
| SI-07 | Node `26.12.1` at `/opt/dems/node-26.12.1`, root-owned, archive sha256 `6170b2d4...079bbd` equal to the publisher line; `node --version` prints `v26.12.1` | 25 | register §7.1 | deviation HOST-09 (U-RF8, W11) |
| SI-08 | Tree placement from `tree_staging_dir` (row 121 copy, `.data` excluded) into `/opt/dems/core` with the IMP R8 copy form, then the SI-05 `install -d` lines; OI-7 record incl. the R-FLEX-only diff hash | 121, 26 | IMP R8; blueprint rows 26, 121 | C-20 re-copy rule |
| SI-09 | `npm ci` as root with `--ignore-scripts --no-audit --no-fund`, throw-away cache under `/root`, five workspaces `@dems/shared`, `@dems/capture-protocol`, `@dems/transcriber`, `@dems/core-server`, `@dems/core-web`; checks: `node_modules/tsx/dist/cli.mjs` and `node_modules/vite/bin/vite.js` exist, no group/other `w` | 27 | SEC §5 (SEC-NPM) | - |
| SI-10 | FFmpeg 9.0.2 LGPL in `/opt/dems/ffmpeg-9.0.2` (signature key `FCF986EA...58D8`, repo sha256 pin), sources in `ffmpeg_build_dir`, file A + `ldconfig`; worker, relay, guard built with the named REQUIRED target set and `PKG_CONFIG_PATH=/opt/dems/ffmpeg-9.0.2/lib/pkgconfig` (PD-11-03), `ldd` resolves `libavformat.so.63` under the prefix; build tree removed after row 31 | 28-31 | register §7.2; APP HOST-12..16; IMP R6 | section 2.3 names |
| SI-11 | File C `/etc/sysctl.d/60-dems-host.conf` (forwarding 0, core lines) and `systemctl disable --now apport.service` (HOST-20, HOST-37) | 33 | SVC §6; HP:114; APP HOST-20, -37 | P-04 |
| SI-12 | Camera port hygiene, read-only: NM profile `DEMS Camera LAN` on `enp4s0`, exactly one address `192.168.100.254/24`, no default route, gateway or name server on `enp4s0`. Label: "HOST-19 equivalent, host hygiene (E-P4)" | 34, 70 | HD §3, §7 row 34; register §3.2 file B | Q96-11 a (A8 status, section 1) |
| SI-13 | Files D and E: nft table `inet dems_loopback`, `tcp dport 8554-8564`, `skuid != "dems-core"`; `dems-loopback-rule.service` enabled before file G starts (HOST-25) | 35 | SVC §6; register §3.2, §4 | - |
| SI-14 | Firewall: SEC §2.2 R0-R8 in order with `dems-ufw-revert` (C-2), SSH allow on `wlp3s0` from any source (I-09), defaults deny in / allow out / deny routed, HOST-23 `allow in on enp4s0 proto udp from any port 3702` only, user's yes before R5, fresh-session test, disarm. R0 records sshd settings (I-12) and the package built-in accepts (I-10). Extra check: `ufw status numbered` lists exactly one rule naming 3702, `on enp4s0` | 36 (HIL) | SEC §2; HD §3 HOST-22..24, §7 row 36 | C-2; P-12 |
| SI-15 | Audio access: `dems-core` in `audio`; `arecord -l` as `dems-core` lists the USB card by **name** `BOMGE USB AUDIO` (card numbers shift); HOST-27 by `/proc/asound/cards` driver `USB-Audio`; HOST-28 `fuser` on the USB capture node resolved through `/dev/snd/by-id` only, with no desktop session logged in; an ALC897 holder is recorded, not failed | 37 | APP HOST-26..28 (PD-11-05) | D16 I-06, I-08 |
| SI-16 | Sleep/time: HOST-29 re-check only (already masked, P-03); HOST-31 `NTPSynchronized yes`; HOST-32 `systemd-time-wait-sync.service` enabled; record `TimeoutStartUSec` of that unit | 38 | APP HOST-29, -31, -32; IMP R5 | P-03 |

### 4.3 PostgreSQL (rows 39-41, 44)

| Id | Item | Rows | Governing source | Added or changed here |
|---|---|---|---|---|
| SI-17 | PGDG source `/etc/apt/sources.list.d/pgdg.sources` (suite `noble-pgdg`), key gate: gpg fingerprint `B97B0AFCAA1A47F044F244A07FCC7D46ACCC4CF8` equals the value from one independent source (recorded), else stop; `create_main_cluster = false` in `/etc/postgresql-common/createcluster.conf` before installing `postgresql-18` and `postgresql-client-18` at `18.6-1.pgdg24.04+2`, then `apt-mark hold`; row 39 reads the 18.5/18.6 release notes first (fallback 18.4 per DB §2.2) | 39 | DB §2, §7 HOST-50/51 | P-15; D16 I-16 |
| SI-18 | Cluster `18 main` by `pg_createcluster` on port **4432**, `listen_addresses = '127.0.0.1'`, socket kept in `/var/run/postgresql` with `unix_socket_permissions = 0700`, `log_error_verbosity = terse`, `pg_hba.conf` in `/etc/postgresql/18/main` replaced by DB §3.2's three lines; data dir `/var/lib/postgresql/18/main` `postgres` 0700 | 40 | DB §3, §7 HOST-52/53 | P-13, P-14, P-16 |
| SI-19 | Roles `dems_owner` (`CREATEDB`, `PASSWORD NULL`) and `dems_app`; `pg.env` by DB Block R (generated, never printed); `pg.owner.env` absent afterwards | 41 (HIL per OI-4, run by the agent under option B) | DB §4.1-4.4 | C-1 additions; C-19; edge request E-1 |
| SI-23 | `dems_demo` created, migrated, seeded, status by DB Block O as `dems-core`, Core stopped. Expected: 34 ledger entries, schema version 15 (`DB_SCHEMA_VERSION` of the deployed `meta.ts`), contract `dbc-16`; seed takes the named skip; `pg.owner.env` absent and owner `rolpassword IS NULL` after the block | 44 | DB §4.4, §5, §7 HOST-55 | P-01; C-18 |

### 4.4 Core environment, units, console (rows 42, 43, 45, 122)

| Id | Item | Rows | Governing source | Added or changed here |
|---|---|---|---|---|
| SI-20 | `/etc/dems` root 0755; `/etc/dems/core.env` `root:dems-core` 0640. SIMULATED form (row 42): `DEMS_CORE_PORT`, `DEMS_CAPTURE_MODE=simulated`, `DEMS_MEDIA_DIR` (absolute default), the four program paths. REAL form (row 57): `DEMS_CAPTURE_MODE=real` plus `DEMS_INSTALLATION_DEVICE_ID` (`DEMS-BENCH-01`) and `DEMS_INSTALLATION_NAME` (typed by the user, I-13). Absent in both: `DEMS_CAPTURE_DEV_SOURCES`, `DEMS_DEMO_CONTROLS`, `NODE_OPTIONS`, `DEMS_CAPTURE_HELPER_FFMPEG`, `DEMS_CAPTURE_DEV_FAKE_MIC`, `DEMS_CAPTURE_ALIAS_SOCKET`, `DEMS_LCD_BACKEND_URL`, `DEMS_LOG_LEVEL`, `DEMS_PG_*`, `PG*`. Greps of SVC §5 (0 / 0 / 2) | 42, 57 | SVC §5; register §6.1 | C-6, C-7; I-05 (PD-11-07) |
| SI-21 | Unit file G `/etc/systemd/system/dems-core.service` root 0644 exactly as SVC §4.1 (`After=`/`Wants=postgresql@18-main.service`, `Requires=dems-loopback-rule.service`, `SupplementaryGroups=audio dems-netalias`, `WorkingDirectory=/opt/dems/core/apps/core-server`, `ExecStart=/opt/dems/node-26.12.1/bin/node /opt/dems/core/node_modules/tsx/dist/cli.mjs src/index.ts`, `KillMode=mixed`, `UMask=0077`, `LimitCORE=0`, `NoNewPrivileges=yes`, empty capability sets, `TimeoutStopSec=60`, no `Restart=`). Fallback form B (`--import tsx`, no `KillMode=mixed`) only if row 58's stop test fails (IMP R10) | 43, 58 | SVC §4; IMP R10 | D16 I-02; edge request E-2 |
| SI-22 | Console unit `/etc/systemd/system/dems-console.service` root 0644 as SVC §8.3 (user `dems-console`, `Environment=DEMS_CORE_PROXY_PORT=4420 VITE_DEMS_CORE_MODE=live HOME=/nonexistent`, `vite.js --configLoader runner`, no `--host`), **enabled**. Check: listener `127.0.0.1:5173` only; any `0.0.0.0`, `[::]` or LAN address is a stop; journal read for `EACCES` (route tree write) | 122 | SVC §8.3; SEC §3 | D16 I-04; register §11.1 adds `VITE_DEMS_CORE_MODE` |
| SI-24 | Helper absence: HOST-44/45 absence checks; HOST-46 N/A (`/etc/dems/netalias-interface` absent, boot `NOT_ASKED`); HOST-47 sudoers grep `netalias` 0 | 45 | APP HOST-44..47; HD §7 row 45 | C-14 |

### 4.5 Boots, keys, console actions (rows 46-61)

| Id | Item | Rows | Governing source | Added or changed here |
|---|---|---|---|---|
| SI-25 | Gate G1 on the revised matrix (APP, 56 lines, PD-11-01..09); reboot before PREP-08 (forwarding `0 0 0`, NTP yes, ufw active); SIMULATED boot through the unit (journal names `SIMULATED`, listeners `127.0.0.1` only); console forward with the C-9 bind; user unassigns 4 slots and switches STT off; Core stop; gate G2; attended check, `operator:set-password --all-demo`, `evidence:production-key` typed by the user over `ssh -t` in the direct-tsx forms of SVC §7.2 as `dems-core`; REAL env; first REAL_PRODUCTION boot (journal `REAL_PRODUCTION`, `SYSTEM_BOOT` with `addressHelperSocket: NOT_PRESENT`); one idle stop test (`shutdown complete` present, `second signal during shutdown; forcing exit` absent); `/proc` checks on both the tsx parent and the Core child (PD-11-08); `/tmp/tsx-*` owner `dems-core`; gate G3; fingerprint record | 46-61 | SVC §4.3-4.5, §7; SEC §1 S1, S5; IMP R9, R10; APP HOST-35/36 | D16 I-02, I-03, I-13; IMP R9 refusal routing |

### 4.6 Cameras and R-FLEX on the host (rows 62-73, 124-128)

| Id | Item | Rows | Governing source | Added or changed here |
|---|---|---|---|---|
| SI-26 | Camera pages through the C-9 forwards on 18101/18102/18103/18117 (I-14), password change and clock by the user; adoption through the **global search**: camera listed and connected; the search answer's `interfaceCount` equals the number of eligible host interfaces (expected 2, `enp4s0` and `wlp3s0`; hypothesis until read in row 66); 9A/H-12 steps .1-.2 named (I-07); only the four camera addresses are adopted; a camera reached on `wlp3s0` is not adopted (IMP R12). Row 124 **N/A** (Q96-16 a: set-IP/scan bound, no factory-default camera to re-address); 9A/H-12 steps .3-.4 therefore "not run" with that reason | 62-69, 124 | SPEC-RF §2.8; HD §7 rows 66-69; IMP R4, R12 | C-17; D16 I-07, I-14, Q96-15, Q96-16 |
| SI-27 | R-FLEX audio on the bench mic: bind (`boundTo` = the MIC id, not offered again), selector move PRIMARY to STANDBY (PRIMARY "Not assigned"), USB port move (same MIC id, re-registration answers `REENABLED`, no `AUDIO_CARD_CHANGED` for it). Each recording-capable row runs only while the user is at the bench | 125-127 | SPEC-RF §7 AC9; SPEC-RF RF-A1..A4 | D16 I-18 |
| SI-28 | Persistence: camera-LAN host-hygiene record (row 70), final reboot with AC6 checks before and after, Core active naming `REAL_PRODUCTION` without manual start, 4 cameras connected; R-FLEX after reboot: binding read back equals row 126, search lists the 4 cameras with `interfaceCount` equal to the row-66 value, no `AUDIO_CARD_CHANGED` in the journal | 70, 71, 128 | HD §8 AC6; SPEC-RF §7 | C-17 |
| SI-33 | Reachability from the Mac over Wi-Fi: SSH succeeds; 4420-4423, 5173, 4432 and 8554-8564 refused or filtered; exactly one 3702 rule, `on enp4s0`; an ICMP echo answer is not a breach (I-10). Resource baseline (row 73) with the 20 % floor | 72, 73 | HD §7 row 72; SEC §2.4; IMP R6 | D16 I-10; P-19 |

### 4.7 Backup, stop rules, rollback

| Id | Item | Rows | Governing source | Added or changed here |
|---|---|---|---|---|
| SI-29 | Backup into `install_backup_dir`, Core stopped: `.data` without `signer/` (`tar --exclude=./.data/signer`), `/etc/dems/core.env`, `dems_demo.pgdump` (P-05), `pg_globals.sql` (P-06), `SHA256SUMS`; `tar -tzf ... \| grep -c '/signer/'` prints 0. Taken before rows 44, 57, 71, every tree re-copy and every rollback | 44, 57, 71 (pre-steps) | IMP R8 | P-05, P-06, P-18; C-4, C-5 |
| SI-30 | Stop rules R1-R12 of IMP §5 as stated, with C-2 for R1's commands, C-10 for R3's timing, P-19 for R6 | 20-128 | IMP §5 | - |
| SI-31 | Rollback: per stage (IMP §6) with the C-3 baseline paths; whole install **INSTALL-R-A** (IMP §7.1: data and cluster kept; no `netplan apply`, no unmask of the sleep targets); INSTALL-R-B only on a separate word after the user hears that `signer/` is in no backup; Docker restore not planned; R-FLEX code rollback R-FLEX-R-B with no DB step (P-02) | 77 (readiness) | IMP §6, §7; SPEC-RF §8.3 | D16 I-19, I-20, Q96-18 |
| SI-32 | Secret flows S1-S9 of SEC §1, with S3 carried out by DB Block R/O (C-1) and S7: every password in the Docker-era findings is treated as burned; I-11 is the user's action | all HIL rows | SEC §1, §6 | C-1 |

## 5. AC1-AC9 mapped to spec items

AC1-AC8: 01_translated.md:57-64. AC6 in the reworded text of HD §8 (U-RF4, D12; Q96-17 a). AC7 unchanged (D12). AC9 in the reconciled text of SPEC-RF §7 (O-10), accepted by D16 Q96-17 a.

| AC | Criterion (short) | Spec items | Rows | Evidence the verifier (row 74) reads |
|---|---|---|---|---|
| AC1 | Every applicable HOST-01..49 took-effect check prints the profile's value; each N/A names its reason | SI-01 (incl. HOST-17), SI-02, SI-04..SI-16, SI-20, SI-21, SI-24, SI-25 (`/proc` checks on both pids); matrix APP (36 applicable, 5 partial, 11 deviation, 4 N/A: HOST-30, -44, -45, -46) | 21-45, 59, gate 46 | command plus output per item; deviations by D-id/PD-id (section 7) |
| AC2 | PostgreSQL on `127.0.0.1` only; `db:status` exit 0; schema version recorded | SI-17, SI-18, SI-23 | 39, 40, 44 | `ss -H -ltn 'sport = :4432'` one line `127.0.0.1:4432`, `:5432` empty; Block O output with schema 15, 34 ledger entries |
| AC3 | SIMULATED boot log, listener `127.0.0.1`, 4 slots unassigned with one `CAPTURE_CONFIG_CHANGED` each, STT off | SI-20 (SIMULATED form), SI-21, SI-22, SI-25 | 48-53 | journal, audit entries, `ss` |
| AC4 | `operators that still have the demo password: 0`, `evidence:production-key: OK`, OU `Evidence signing DEMS-BENCH-01` | SI-25 (direct-tsx forms as `dems-core`), SI-32 (S1, S1a, S5) | 54-56, 60, 61 | terminal summary lines (prompt lines typed by the user), 3 `OPERATOR_PASSWORD_SET` audits |
| AC5 | `dems-core.service` starts the Core, journal names `REAL_PRODUCTION`, `SYSTEM_BOOT` with `addressHelperSocket: NOT_PRESENT` | SI-21, SI-24, SI-25 | 57-60 | `systemctl status`, journal, audit entry; ExecStart form recorded |
| AC6 | 4 cameras connected; camera-LAN host-hygiene invariants (HOST-19 equivalent, HOST-20 `0 0 0`) persist across a reboot | SI-11, SI-12, SI-26, SI-28 | 33, 34, 62-71 | console state; `ip -br -4 addr show dev enp4s0`, `ip -4 route show default`, `nmcli` fields of `DEMS Camera LAN`, `sysctl` before and after row 71 |
| AC7 | ufw active, SSH only on the room network, no DEMS port reachable from Wi-Fi | SI-14, SI-18 (loopback DB), SI-22 (loopback console), SI-33 | 36, 72 | `ufw status verbose`, `ss -ltnp`, Mac-side probes |
| AC8 | Every deviation and refusal code recorded in decisions.md and the final report | Section 7 (deviation list), SI-30 (IMP R9 refusal routing), SI-31 | 78, 79 | `decisions/01_deviation_register.md` (row 78) |
| AC9 | R-FLEX on the host (SPEC-RF §7): bound mic shown `boundTo` and not offered (125); port move keeps the MIC id, `REENABLED`, no `AUDIO_CARD_CHANGED` (127); re-bind releases: PRIMARY to STANDBY leaves PRIMARY "Not assigned" (126), op 99 release (`RELEASED` then `REENABLED`, `releasedDeviceId`) proven by DB test T-10 at row 115; global search `interfaceCount` = eligible interfaces (expected 2) with the 4 cameras; a `wlp3s0` device reachable by typed address only if one exists (9A/H-12); binding and cameras persist after the final reboot | SI-26, SI-27, SI-28 | 66-69, 115 (T-10), 125-128 | listing, register answers, audit entries, search answers, journal grep after reboot |

Result: AC1-AC9 each map to at least one spec item and at least one evidence-producing row.

## 6. Requests for row 19 (blueprint edges and row changes)

| Id | Request | Basis | Class (proposal) |
|---|---|---|---|
| E-1 | Row 41: add `25:B` (Node) and `26:B` (placed tree). Block R imports `/opt/dems/core/scripts/pg/db.mjs` with the pinned Node; it needs no `node_modules` (DB §9 A4), so `27` is not required. Row 41 verification text per C-19 | DB §6 item 2, §10 | MINOR |
| E-2 | Row 43: add `40:B`, so the unit named in `After=`/`Wants=` exists at `systemd-analyze verify` | DB §6 item 3 | MINOR |
| E-3 | Row 21: add HOST-17 (two `ps` observations) | APP Finding 2 | MINOR |
| E-4 | Row 123 runs **right after row 21** (deps `21:B` only; drop `16:C`, which is satisfied). Add `123:B` to the direct successors of row 21: rows 22, 24, 33, 38. Row 46 keeps `123:B`. Row 123 verification adds "flag present before any apt/dpkg, build or migration" | D16 I-17; IMP §8.2-1 | MINOR (order only; inside scope) |
| E-5 | HOST-PROFILE §6 (HP:297) steps unfit for .73, recorded as deviations for row 78 and kept out of every rollback block: (a) "unmask the four targets of HOST-29" (masked before the install, P-03); (b) "`sudo netplan apply`" (file B never written; it would re-apply the Wi-Fi profile over the only SSH path). Also recorded: HP §6 does not cover PostgreSQL, Node, FFmpeg, the console unit, the PGDG source, ufw or `systemd-time-wait-sync`; INSTALL-R-A covers them | IMP Finding 5, §7.1 | MINOR (record) |
| E-6 | Purge/autoremove ban SI-00b added to the blueprint's section 4 constraints and to every host row's stop condition | IMP R7 | MINOR |
| E-7 | PD-11-01..09 recorded as deviations (section 7) and their check forms applied in rows 22, 26, 27, 29, 37, 40-42, 57, 58, 59, 72 | APP Recommendations 1 | MINOR (record); none changes an AC |
| E-8 | Rows 66-69 verification: "camera listed and connected; the search answer's `interfaceCount` equals the number of eligible host interfaces (expected 2, enp4s0 and wlp3s0; hypothesis until read in row 66); 9A/H-12 steps .1-.2 recorded; no credential in doc". Row 128: "binding read back equals row 126; search lists the 4 cameras; `interfaceCount` equals the row-66 value; no `AUDIO_CARD_CHANGED` in journal" | SPEC-RF §2.8; HD §7; D16 Q96-15 a, I-07 | MINOR (the old check cannot pass; the AC is unchanged) |
| E-9 | Row 124: **N/A** (Q96-16 a). Proposed form: one N/A record row (docs only, `sonnet`), deps `60:B`, so row 66 keeps its `124:B` edge without a HIL sitting. 9A/H-12 steps .3-.4 recorded "not run" with this reason | D16 Q96-16 a; SHEET:138 | MINOR |
| E-10 | Row 32 stays the N/A record (console is the Vite dev server; start moves to row 122) | 02_structured.md row 32; SVC §8 | none (already in the blueprint) |
| E-11 | Row 44 verification: "4 steps exit 0; schema version 15 equals `DB_SCHEMA_VERSION` of the deployed tree; 34 ledger entries; seed counts recorded; `pg.owner.env` absent after the block" | C-18; P-01 | MINOR |
| E-12 | Backup pre-steps (SI-29) before rows 44, 57, 71: either inside those rows or as three S rows; row 18 chooses | IMP R8, §8.1-4 | MINOR |
| E-13 | Row 58: add the idle stop test and the ExecStart fallback rule (SI-21, SI-25); row 59: `/proc` checks on both pids | IMP R10; PD-11-08 | MINOR |
| E-14 | Rows 125-128 and any recording: "only while the user is at the bench" in the HIL text | D16 I-18 | MINOR |
| E-15 | Row 36 verification adds "exactly one rule naming 3702, `on enp4s0`" and the R0 records (sshd settings, built-in accepts) | HD §7 row 36; D16 I-10, I-12 | MINOR |
| E-16 | Row 22: `/nonexistent` home and the `dems-console` account | D16 I-01; SVC §3 | MINOR |
| E-17 | Row 77 readiness: INSTALL-R-A with the C-3 baseline paths, R-FLEX-R-B with the restore-folder `SHA256SUMS` check run inside the folder | D16 I-19, Q96-18; SPEC-RF §9.1 | MINOR |

Classification note for row 19: none of E-1..E-17 removes a HIL row, changes an AC, or changes a residual guard; each adds an edge, a check or a record inside the approved scope (02_structured.md §1.5 MINOR rule). Row 19 decides.

## 7. Deviations to record (for the controller now and for row 78)

| Id | Deviation | From | Source |
|---|---|---|---|
| D5, D6, D7 | Wi-Fi up through PREP-08..9A/H-16; passwords over `ssh -t`; signer keys kept in the Docker-era backups | HW-ACCEPTANCE PREP-08/11; IN §2.5; IN §2.8 | decisions.md |
| D8 A8 | NM profile instead of file B for HOST-19. Ends as a deviation of form once row 113 lands the E-P4b text (Q96-11 a) | HP:81 | HD E-P4b |
| D8 F7 | Camera pages through SSH forwards via .73 (HOST-48) | HP:139 | register §5.3 |
| PD-11-01 | HOST-05: three writable paths inside the root-owned tree | HP:57 | APP |
| PD-11-02 | HOST-06: data dir fixed at `/opt/dems/core/.data` (W1) | HP:36, :58 | APP |
| PD-11-03 | HOST-14: named REQUIRED target set instead of a bare `make` | HP:71 | APP |
| PD-11-04 | HOST-24: check extended with 4432 and 5173 | HP:86 | APP; SEC §3 |
| PD-11-05 | HOST-28: USB card only, by id (D16 I-08) | HP:95 | APP |
| PD-11-06 | HOST-33: file G settled (`postgresql@18-main.service`, `Type=simple`, deeper `WorkingDirectory`, `ExecStart`, `KillMode=mixed`; D16 I-02) | HP:238-261 | APP; SVC §4.1 |
| PD-11-07 | HOST-34/HOST-54 (and DB-05): DB settings in `.data/pg.env`, not `core.env` (D16 I-05) | HP:111, :152 | APP; SVC F-S5 |
| PD-11-08 | `/proc` checks on the tsx parent and the Core child | HP:40, :112-119 | APP; SVC §4.5 |
| PD-11-09 | HOST-53: PostgreSQL port 4432 (5432 refused by code, W2) | HP:151 | APP; register §5.4 |
| I-01 | HOST-04: home `/nonexistent` instead of `<data-dir>` | HP:56 | SHEET I-01 |
| I-16 | HOST-51: 18.6 held instead of "18.4 tested" | HP:149 | DB §2.2 |
| U-RF8 / W11 | HOST-09: Node 26.12.1 instead of 26.8.2; signing-key list from the GitHub README | HP:66 | register §7.1 |
| R13-a | Unix socket kept with `peer` for `postgres` only (dev form had none); server log via packaged logrotate instead of the dev ring | dev form `scripts/pg/init.mjs:72-74` | DB §10 |
| E-5 a/b | HP §6 removal: no unmask of the sleep targets, no `netplan apply` on .73 | HP:297 | IMP Finding 5 |
| I-17 | Row order: watchdog flag right after row 21 | blueprint row 123 | SHEET I-17 |
| Q96-16 | Row 124 N/A; 9A/H-12 steps .3-.4 not run | blueprint row 124 | SHEET Q96-16 |
| AC9 bench form | Op 99 release to another input proven by DB test T-10, not on the bench (1-input mic) | AC9 (D12 U-RF4) | SPEC-RF §7; Q96-17 a |
| D10/D11 | HOST-19, -23, -24, -46 wording as host hygiene; S13-11 point 2 / DR-4 lifted | HP | HD §3-§4 |

Row 78 also lists every refusal code met at rows 48 and 58 (IMP R9) and the R-FLEX code additions/removals (R-FLEX register §3).

## 8. Register reconciliation (verification item "0 name conflicts with both registers")

### 8.1 Edits made to `masterplan/01_specs_register.md` by this row

1. **Line 63 corrected** (D16 I-01): service user home `/nonexistent` (`--no-create-home`), was `/opt/dems/core/.data`. The old value is kept in the cell as "was ..." for traceability.
2. **Section 11 added** (additive; sections 0-10 unchanged otherwise):
   - 11.1 names added: `ufw_revert_unit`, `pg_socket_dir`, `pg_conf_dir`, `pg_common_conf`, `pg_log_file`, `host_baseline_dir`, `install_backup_dir`, `disk_free_threshold` (the eight requested), plus `tree_staging_dir`, `ffmpeg_build_dir`, `host_build_unit` (closing IMP's unnamed folders, section 2.3) and the console key `VITE_DEMS_CORE_MODE` = `live` (used by SVC §8.3, absent from register §6.2; the key exists in code: `apps/core-web/src/runtime/env.d.ts:13`, `apps/core-web/src/runtime/core-mode.ts:13`).
   - 11.2 names not registered: `cli_cache_dir` (D16 I-03).
   - 11.3 status changes of existing entries (the "row N decides" cells now decided: G4-G8, §3.1 npm cache, §3.2 `pg.owner.env` lifetime, §4 console unit, §5.3 forward bind, §6.1 key inclusion, §7.3 PostgreSQL minor, §3.2 flag timing).

### 8.2 Conflict check (run this session before the edit)

| Check | Command | Result |
|---|---|---|
| New names vs the R-FLEX register | `grep -c -- <name> masterplan/01_specs_rflex_register.md` for each of the 11 names and the 4 folder prefixes | 0 definitions. The eight requested names appear once each in the R-FLEX register's line "Not added (INSTALL register, rows 12/17): ..." (section 11.1), which defers them to this register; that is a cross-reference, not a second value |
| New names vs the install register (before edit) | `grep -c -- <name> masterplan/01_specs_register.md` | 0 each |
| New names vs code and scripts | `grep -rIl -- <name> apps packages scripts deploy` (`*.ts`, `*.tsx`, `*.sh`, `*.mjs`, `*.json`, `*.yaml`, excluding `node_modules`) | 0 each. The prefix `dems-build` was rejected because it matches `.dems-build-info.txt` (`deploy/docker/build-image.sh:101`, `Dockerfile:235`); `dems-host-build-row<NN>` was taken instead |
| R-FLEX names used in this file | `boundTo` (AU-L1), `releasedDeviceId` (AU-B2), `RELEASED` (AU-A1), `REENABLED`, `AUDIO_CARD_CHANGED`, `interfaceCount` (F9/NW-S1), `NO_SOURCE_INTERFACE` (NW-R1), RG-1..RG-14, `rflex_only_diff` (RB-1) | each taken verbatim from `masterplan/01_specs_rflex_register.md` or SPEC-RF; none is redefined here |
| Install names vs R-FLEX names | the install register defines host paths, accounts, units, ports, env keys; R-FLEX register CF-1 adds no `DEMS_*` name and defines no host path except CF-2 `/etc/dems/netalias-interface`, which the install register also names with the same meaning (register §3.2 "Not written") | same value in both: not a conflict |

**Result: 0 name conflicts with the install register and 0 with the R-FLEX register.**

## 9. Risks, assumptions, gaps

| # | Item | Status | Owner |
|---|---|---|---|
| H-1 | PostgreSQL paths (`/var/run/postgresql`, `/etc/postgresql/18/main`, `/etc/postgresql-common/createcluster.conf`, log file), unit name `postgresql@18-main.service`, server account `postgres` | hypothesis (postgresql-common convention) | row 39 (`pg_lsclusters`, `systemctl list-units 'postgresql@*'`, `ls`) |
| H-2 | `pg_dumpall --no-role-passwords` available in the 18 client | knowledge, not fetched | row 18 (`pg_dumpall --help` on the host) |
| H-3 | `interfaceCount` = 2 on .73 | inferred (HD I8, I10) | row 66 |
| H-4 | Typed-probe reply on Wi-Fi admitted as ESTABLISHED | hypothesis | 9A/H-12 (steps .3-.4 not run on the bench, Q96-16) / row 72 |
| H-5 | `KillMode=mixed` gives one clean shutdown; child keeps the TTY under `sudo -u` | read in tsx source only | rows 54, 58 |
| H-6 | sshd on port 22 | hypothesis (register G1) | row 36 R0 |
| H-7 | apport enabled on .73 | not surveyed | row 33 |
| R-1 | A delta file is read instead of this one | parallel docs | section 0 rule; row 18 cites this file per runbook section |
| R-2 | IMP §4.3 block copied verbatim into the runbook | C-3 defect reproduced | row 18 uses the C-3 form |
| G-1 | No host access and no command run in this row; every host fact is from rows 6, 02_ and 03_ host files | - | - |
| G-2 | The 18.5/18.6 release notes are not read | DB §9 A3 | row 39 |

No `masterplan/02_plan.md` is written by this row; the runbook is row 18's.

## 10. Notes for the controller

- Record in decisions.md (controller only): the C-1 additions (SET lines; widened scan pattern), C-3 (baseline layout), C-4/C-5 (dump forms) as spec corrections; the section 7 list for row 78.
- Rows 18 and 19 should read this file first; row 19 receives E-1..E-17.
- SEC §7's self-check pattern change (C-1) applies to the scan run by row 75 and to every row's own scan from now on.

---
*Generated: 2026-10-22 17:40*
*Last Updated: 2026-10-22 17:40*
