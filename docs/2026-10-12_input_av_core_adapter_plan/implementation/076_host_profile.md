---
task_id: 2026-10-12_input_av_core_adapter_plan
task_slug: input_av_core_adapter_plan
date: 2026-10-12
agent: document-writer
blueprint_row: 76
milestone: M5
work_package: WP-14
type: record of a product document (the Linux host profile for Ubuntu 24.04)
narrative_tier: 1
source_plan: identification/03_implementation_blueprint.md (row 76, profile line 379); masterplan/02_plan.md (phase 5)
source_analysis: masterplan/01_specs.md; masterplan/04_design_addendum.md; verification/02_security.md; verification/04_security_addendum.md; verification/03_plan_review.md
status: complete
confidence: MEDIUM for the list of items (it follows the row's cell and the named sources item by item); LOW for the commands (none was run on Ubuntu; 43 of 49 items carry a "to confirm" mark)
closes_requirements: document half of P12-F12, S13-03 (b), S13-07 (RC-5, RC-6 host part), S13-09 (PF-7), AD-09 (1), request R-1 (a). None is proven on a host
last_updated: 2026-10-12 22:57 (host clock)
---

# Row 76: the Linux host profile for Ubuntu 24.04, record

**The document is UNVERIFIED on Ubuntu.** It was written on the development Mac. No command of it was run anywhere, no source file was changed, nothing was installed. This record says what was written, from what, what was decided by the driver, and what stays open.

## 0. Frame (5W1H), method, limits

| Question | Answer |
|---|---|
| What | One product document, `scripts/host/HOST-PROFILE-UBUNTU-24.04.md`: 49 items (`HOST-01` to `HOST-49`), each one line with the command or file and the check that shows it took effect; 7 files printed in full (A to G); 16 open points that need the host; a list of what is outside the profile; a removal paragraph |
| Who | Written by row 76 (document-writer). Read by the installer and by whoever runs `9A/H-01`. Consumed by rows 77 (scripts), 78 (container), 80 (boot checks), 125 (procedure chapter), 135 (installer note), each by contract (`76:C`) |
| When | 2026-10-12, level 0 of the waves (no build dependency) |
| Where | The document is in the product tree; this record and `delegation_progress/row_076.md` are in the task folder |
| Why | Decision U12 A2 made Ubuntu 24.04 the production host and U13 moved every host check to a later hardware package; the profile is what makes `9A/H-01` executable line by line (`masterplan/02_plan.md:543`) |
| How | Each item was derived from a named requirement or from the tested input-av reference, then given a check command. Counts were taken by a script over the table rows (section 5) |
| Limits | No Linux host, no container, no `sudo`, nothing run. `apps/input-av/data/` and every `.env` were not opened. Ubuntu facts (package names, default services, the behaviour of the crash collector) are the author's recollection unless a source line is given, and are marked |

## 1. The row's cell, item by item

Cell text: `identification/03_implementation_blueprint.md:199`. Request R-1 (a): `delegation_progress/file_requests.md` (row 103's line); decision C19: `decisions/decisions.md`.

| Content the cell asks for | Items | Source of the requirement |
|---|---|---|
| Pinned FFmpeg built from source with the ALSA input | HOST-10 to HOST-16 | `verification/03_plan_review.md:68` (P12-F12 a); the pin `apps/capture-worker/src/ingest.c:59-61`; the build file `apps/capture-worker/Makefile` (`CC := clang`, `pkg-config`, the import check) |
| The named `arping` package | HOST-18 | P12-F12 (c), `verification/03_plan_review.md:68`; input-av installed `iputils-arping` (`apps/input-av/scripts/install.sh`, package list) |
| The dedicated camera port with forwarding off | HOST-19, HOST-20, HOST-21 | S13-03 (b), `verification/02_security.md:110` |
| The loopback rule of RC-5 | HOST-25, HOST-41, HOST-03 | `verification/02_security.md:159` |
| Run directory 0700 with pipes 0600 | HOST-08, HOST-42 | RC-6, `verification/02_security.md:160`; the path `apps/core-server/src/capture/fence/index.ts:106` (`run/capture`), `apps/core-server/src/capture/adapters/mic-transport.ts:103-110` |
| Firewall rule for probe answers | HOST-22, HOST-23, HOST-24 | fork F-5 of `masterplan/01_specs.md:465`; note SN-5 (`:460`); 5.4 step 7 of `verification/02_security.md:224`; the listener `apps/core-server/src/config.ts:37` |
| Audio access | HOST-26, HOST-27, HOST-28 | `apps/input-av/scripts/install.sh` step 2; `apps/input-av/nvr/doctor.py` (the audio check); `apps/input-av/README.md` (USB Audio Class) |
| Sleep | HOST-29, HOST-30 | `masterplan/01_specs.md:116` (H-36) |
| Time sync | HOST-31, HOST-32 | same; `apps/input-av/nvr/doctor.py` (`timedatectl show -p NTPSynchronized --value`) |
| The Core's unit: core-file limit 0, no diagnostic-report or heap-snapshot switch (AD-09 (1)) | HOST-33 to HOST-37 | `verification/04_security_addendum.md:204` |
| `NoNewPrivileges=yes`, empty capability set (C19, R-1 (a), PF-7) | HOST-38, HOST-39, HOST-40 | `decisions/103_helper_privilege_form.md` section 5, PF-7 |
| The helper as a root service: one group, two unit files (C19) | HOST-43 to HOST-47 | `decisions/103_helper_privilege_form.md` sections 5 and 7; `verification/02_security.md:214-227` |
| Camera activation step (DR-12) | HOST-48 | `masterplan/01_specs.md:427` |
| What it cannot settle without the host | section 5 of the document, 16 lines | `masterplan/02_plan.md:373,380`; blueprint section 12 |
| Not in the cell, added because the Core needs them | HOST-01 to HOST-07, HOST-09, HOST-17, HOST-49 | root `README.md` ("Prerequisites": Node 26.8.2; "Real capture, sealing and transcript": the worker path rule, the media store rules, the evidence volume); F-06 of `verification/01_verification.md:215`; P12-F12 (b) |

## 2. Verification cell of row 76, checked

| Criterion | Result | How counted |
|---|---|---|
| Items without a check line | **0** of 49 | script over the rows that start with `\| HOST-`: every row has 5 cells; cell 3 (command or file) and cell 4 (check) are non-empty in all 49 |
| Lines an agent would have to run with `sudo` | **0** | every step is the user's, stated in the document's section 1; this row ran no command of the profile and no `sudo` |

Other counts: ids sequential `HOST-01` to `HOST-49`, 49 unique; items marked "to confirm in 9A/H-nn": **43**; items with no specific doubt: 6 (HOST-04, 06, 20, 29, 35, 42); characters outside ASCII: 0 (no emoji); IPv4 literals in the document: only `127.0.0.1`; no name of a person, host or network, no credential.

## 3. Driver decisions (conservative; for the controller to confirm)

| # | Decision | Why | Alternative not taken |
|---|---|---|---|
| D-1 | Path `scripts/host/HOST-PROFILE-UBUNTU-24.04.md`, a new folder | The tracked product documents sit beside their subject (`README.md`, `apps/capture-worker/README.md`); the existing installer documents are under `release/`, which `.gitignore:65` ignores, so a file there would never be committed; row 77's scripts go under `scripts/` (profile line 380). Upper-case name as the two installer documents have | The repository root (a third root document); `release/` (ignored); a section of the root README (that file has its own writer) |
| D-2 | Stable ids `HOST-nn` | Rows 77, 80 and 125 need to point at an item; `HP-`, `PF-`, `H-` are taken | No ids |
| D-3 | RC-5 as an `nftables` table of its own, loaded by a one-shot unit that the Core's unit requires | A rule by owner of the connecting socket is not expressible as a plain `ufw` rule; an own table touches no other rule set; the dependency makes a missing rule stop the Core rather than let it listen unprotected | A line in the firewall's own rule files; the system-wide `nftables.conf`, whose default content the author recalls as clearing every rule set |
| D-4 | HOST-37 added: the crash collector is disabled and the core pattern points at a program that discards | AD-09 (1) asks for a limit of 0. The author's recollection, not verified: on Linux a core pattern that pipes to a program is served regardless of the limit, and Ubuntu's default pattern pipes to its crash collector. Marked "to confirm in 9A/H-01"; if wrong, the item is harmless | Trusting `LimitCORE=0` alone |
| D-5 | The Core's unit carries only the options a requirement names (`LimitCORE`, `NoNewPrivileges`, the two capability lines, `UMask`, the groups) | `decisions/103_helper_privilege_form.md` section 8: a further hardening option may break the capture path and needs its own check with a session | A fuller sandbox |
| D-6 | The pinned libraries are found through a loader configuration file, not through a library path in the Core's environment | Keeps the environment of the evidence-writing process free of a path that redirects libraries | `LD_LIBRARY_PATH` in the environment file |
| D-7 | `ExecStart` is left open in file G | The repository has no production start command (`apps/core-server/package.json:8` is `tsx src/index.ts`); inventing one would be a fabrication | Writing the development command as the production one |
| D-8 | The firewall rule for search answers matches SOURCE port 3702 | The Core sends an active probe and has no passive listener (U9); the answer comes from the camera's port 3702 to a port the Core chose. input-av's tested rule matched destination port 3702 for its passive listener. Marked for `9A/H-12` | Copying input-av's rule unchanged |

## 4. Findings for other rows

| For | Finding | Blocking |
|---|---|---|
| Row 80 (boot checks) | A Core with an empty capability set probably cannot list the packet-filter rule set. Its check of the loopback rule may have to read the state of `dems-loopback-rule.service` (HOST-25, HOST-41) instead of the rule. HYPOTHESIS, to settle in the container of row 78 | no |
| Row 80 | If D-4's recollection holds, "a core-file limit above 0" is not the whole of AD-09 (1) on Ubuntu: the check should also name a core pattern that pipes to a collector. HYPOTHESIS | no |
| Row 77 (scripts) | The scripts of the profile belong beside the document, under `scripts/host/`, one per group of items, keyed by `HOST-nn` | no |
| Row 78 (container) | Three first-contact points the container can settle: the configure line of HOST-12; `CC := clang` on Ubuntu; the import list `apps/capture-worker/test/static/imports.pin` against glibc symbol names | no |
| Rows 125, 127 | HOST-43 to HOST-47 state the helper's installed state only; the steps, the hashes and the nine refusals stay in the helper's procedure. `9A/H-05` in `masterplan/02_plan.md:547` still says "sudoers line": under C19 it reads "socket unit and group" | no |
| Controller | Not stated in any source read: how the clients reach a Core whose listener is bound to `127.0.0.1` (`apps/core-server/src/config.ts:37`), and which PostgreSQL a Linux host uses (the Mac uses the npm package's binaries, root `README.md` "Prerequisites"). Both are listed in the document as outside the profile | no |

Two lines were appended to `delegation_progress/file_requests.md` (rows 80 and 77).

## 5. Method of the counts

A script read the document, took every line that starts with `| HOST-`, split it on unescaped bars and counted: rows 49, unique ids 49, sequential yes, rows with other than 5 cells 0, rows with an empty command or check cell 0, rows whose last cell holds "to confirm in" 43, others exactly "-" 6. It also listed characters above ASCII (none) and IPv4 literals (`127.0.0.1` only). Output line: `items 49 unique 49 sequential True / without check 0 bad cols 0 to confirm 43 plain 6`.

## 6. Assumptions, gaps, what stays unproven

- **The double.** There is none: this row is a document. Nothing in it is proven. Every item goes to `9A/H-01` ("profile lines whose check fails: 0"), and the marked ones to the check they name: `9A/H-01` to `H-08`, `H-12`, `H-13`, `H-16`, `H-17`, `H-24`, `H-25`, `H-27`.
- **Assumptions.** A single-purpose host with one administrator; a local Linux file system for the evidence; the service manager and the firewall front end of a default Ubuntu 24.04 installation; unit and group names of the helper are those rows 104 and 127 fix.
- **Gaps.** Processor architecture not ruled. No production start command. No statement on the database of the host or on client reachability. The licence of the FFmpeg build that ships is the user's open decision (root `README.md`, "The user's open decisions").
- **Not read.** `apps/input-av/data/`, any `.env`, the helper (rows 104 and 105 are not built), the relay and the guard (rows 41 and 23 are not built).

## 7. Files

| File | Kind |
|---|---|
| `scripts/host/HOST-PROFILE-UBUNTU-24.04.md` | new, product document (269 lines) |
| `docs/2026-10-12_input_av_core_adapter_plan/implementation/076_host_profile.md` | new, this record |
| `docs/2026-10-12_input_av_core_adapter_plan/delegation_progress/row_076.md` | new, short record |
| `delegation_progress/file_claims.md`, `delegation_progress/file_requests.md` | one and two lines appended |
