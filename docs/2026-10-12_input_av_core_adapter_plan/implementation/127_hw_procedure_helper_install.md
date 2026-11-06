---
task_id: 2026-10-12_input_av_core_adapter_plan
task_slug: input_av_core_adapter_plan
date: 2026-10-13
agent: document-writer
blueprint_row: 127
milestone: M7
work_package: WP-27
type: record of a product document (hardware acceptance test package, chapter 4: installation of the address helper)
narrative_tier: 1
source_plan: identification/03_implementation_blueprint.md (row 127, profile line 438); masterplan/02_plan.md (section 9A)
source_analysis: verification/02_security.md (5.3 S13-08 to S13-10, 5.4); decisions/103_helper_privilege_form.md; decisions/decisions.md (C19); implementation/104_alias_helper.md with scripts/host/netalias/ (the helper, the two unit files, SHA256SUMS); scripts/host/HOST-PROFILE-UBUNTU-24.04.md (HOST-04, HOST-05, HOST-18 to HOST-25, HOST-33 to HOST-47, file G) with scripts/host/20-, 40-, 70-, 80-*.sh; scripts/hardware-acceptance/HW-ACCEPTANCE-1-FRAME.md, -2-, -3-; delegation_progress/file_ownership.md (the order defect, row 181)
status: complete
confidence: MEDIUM for the content of each step against the delivered files (the request form, the codes, the order of the helper's checks and the journal line were read from the source); LOW for every command and expected output on Ubuntu (none was run; no Linux host)
closes_requirements: the procedure half of S13-08 (gate: installation by the user), of S13-09 / C19 (step 4 in its "root service" branch) and of 5.4 (U12 B5, UA-3). None is proven on a host
last_updated: 2026-10-13 01:06 WIB (host clock)
---

# Row 127: hardware acceptance test package, chapter 4 (helper installation) - record

**The document is UNVERIFIED on a host, by definition.** It was written on the development Mac. No command of it was run, no source file was changed, nothing was installed, no `sudo`, no host address, no device, no credential. `apps/input-av/data/` and every `.env` were not opened. The only commands run were read-only: reading files, `shasum -a 256` on the three delivered files, and counts over the written document.

## 0. Frame (5W1H)

| Question | Answer |
|---|---|
| What | One product document, `scripts/hardware-acceptance/HW-ACCEPTANCE-4-HELPER-INSTALLATION.md` (533 lines): the ten steps of `verification/02_security.md` 5.4 as steps `HI-01` to `HI-10` for the user, for the helper as delivered by row 104 in the form of decision C19; an Indonesian summary of 237 words at the top; a section on what must precede the Core's first start; a table of the nine refusals and where each is proven; a failure rule; seven open points |
| Who | Written by row 127 (document-writer). Performed by the user with administrator rights (UA-3, U12 B5). Consumed by row 181 (the order and the cross-references of chapters 1 to 3), row 128 (collectors), rows 130, 131 |
| When | 2026-10-13, before rows 81, 105, 106 and 119 have landed. `HI-01.1` and `HI-08` therefore state outcomes and mark the missing parts |
| Where | The document is in the product tree beside chapters 1 to 3, under the file name the frame gives it (`HW-ACCEPTANCE-1-FRAME.md:46`). This record and `delegation_progress/row_127.md` are in the task folder |
| Why | The helper is a new privilege on the evidence host. The security review made its installation a gate for the user and listed what the procedure must contain (`verification/02_security.md:214-227`) |
| How | Each step was built from its line of 5.4, the "root service" column of `decisions/103` section 7, and the delivered files read in full. Expected answers and journal lines were derived from the helper's source, in the order its checks run. Counts were taken by command over the written file (section 3) |

## 1. The request form, confirmed against the source

Confirmed by reading `scripts/host/netalias/dems-core-netalias` (not by running it):

| Point | Source | Finding |
|---|---|---|
| `add <a.b.c.d>/24 <minutes>`, three tokens, single spaces | `:16-18`, `:360` | confirmed. Minutes 5 to 480, no leading zero, refused outside (`27`), never clamped (`:142`, `:365`) |
| `del <a.b.c.d>/24`, two tokens | `:360` | confirmed |
| One line, at most 64 bytes with its line feed, printable ASCII | `:85`, `:284-305`, `:350-352` | confirmed. The helper does NOT require the sending side to be closed (`:303`) |
| The interface is never in the request | `:65`, `:235-250` | confirmed. A fourth token is `14 REQUEST_MALFORMED` (`:360-361`): the code chapter 2 marks "to confirm" in `9A/H-05.3` (c) |
| One alias at a time | `:91` (`MAX_MARKED = 1`) | confirmed |
| The caller is the sole member of `dems-netalias` | `:78`, `:207-232`, `:583-587` | confirmed. Root through the socket is `12` |
| `check` is the one command-line form, read-only | `:575-580` | confirmed |

The three hashes printed in the chapter equal `SHA256SUMS`, section 1 of `implementation/104_alias_helper.md` and a fresh `shasum -a 256` of the three files (`62c0b726...`, `8623c1cd...`, `7e40f25e...`).

## 2. The ten steps

| Step | 5.4 | Content | Sub-steps |
|---|---|---|---|
| `HI-01` | 1 | the review's statement; `sha256sum -c` and the three hashes against the page; the S13-10 (a) condition | 5 |
| `HI-02` | 2 | the helper file: `install -o root -g root -m 0755`; `stat`, `namei -l`, hash | 6 |
| `HI-03` | 3 | the interface file: ports listed, the user's confirmation, `/etc/dems`, the file, four checks, the default-route line | 6 |
| `HI-04` | 4 | part A the group and membership; part B the two unit files, `systemd-analyze verify`, the socket enabled; socket owner, group, mode; sudoers lines 0 | 11 |
| `HI-05` | 5 | tools at the helper's paths; first connection as root (`12`); the marks folder; the self-check `0 OK` with a table of its other answers | 5 |
| `HI-06` | 6 | refusals with harmless requests: foreign account (socket), root (`12`), nine or ten requests as the service user, a wrong interface in the file (`33`, `34`), the journal count, nothing changed | 6 |
| `HI-07` | 7 | four readings of `HOST-20`, `HOST-22`, `HOST-24`, `HOST-25`; nothing changed | 4 |
| `HI-08` | 8 | the Core's boot check; the same act as `9A/H-05.6` and `.7` | 3 |
| `HI-09` | 9 | `.1` the listing (every run); `.2` to `.8` the rollback | 8 |
| `HI-10` | 10 | the confirmation paragraph with date, host label, commit and the three hashes | 2 |

**What touches the helper in the host profile, and how the chapter avoids repeating it.** `HOST-43` to `HOST-47` (script `80-helper-state.sh`, print-only, no apply mode) state the installed state and defer every command to this chapter; the chapter uses the same commands and the same check lines. `HOST-40` (file G, script `70-core-unit.sh`) names the group in the Core's unit. `/etc/dems` is created by `HOST-25` (`40-network-firewall.sh:107`); `HI-03.3` reads it and creates it with the same command only if it is absent. `HI-07` reads four profile lines and changes nothing.

## 3. Verification cell, and counts

| Cell (`identification/03_implementation_blueprint.md:252`) | Result |
|---|---|
| Steps 10 of 10 | `HI-01` to `HI-10`: 10 headers, each with the six parts (each part label counted 10 times) |
| The printed hash equals the hash recorded by row 104 | 3 of 3 (helper and both unit files) |
| Steps run by an agent | 0 |

Also counted over the file: numbered sub-steps 56; "to confirm in 9A/H-nn" marks 12 (`H-05` 10, `H-16` 1, `H-25` 1); "to confirm when the timer row lands" marks 3 (`HI-01.2`, `HI-09.1`, `HI-10`); "to confirm when the review row lands" 1 (`HI-01.1`); 16 marks in all. Non-ASCII characters 0 (no emoji). Addresses in the text: `127.0.0.1` and the documentation address `203.0.113.10` only. No name, no credential. `git check-ignore` on the file exits 1 (tracked path).

## 4. Findings while writing (for the controller)

1. **The self-check answers `35 STATE_DIR_UNSAFE` on a fresh installation and after every restart of the host** (reading of the delivered files, HYPOTHESIS until `9A/H-05`). `check` calls `marked_addresses()` (`:515`), which needs `/run/dems-core-netalias/marks`; that folder is the `RuntimeDirectory` of the template service (`dems-core-netalias@.service:26-28`), created by the first instance, and `/run` is emptied at boot. The socket unit creates only the parent. The chapter orders one connection before the self-check (`HI-05.2` before `HI-05.4`). Consequences elsewhere: a collector that counts mark files (`9A/H-06.2`, `9A/H-13.4`) must read a missing folder as 0; a boot check of row 81 must not treat a missing marks folder as a fault.
2. **Two of the nine refusals of 5.4 step 6 have no step in the package:** the conflict tool missing (`37`) and the alias limit (`41`). Neither can be shown with harmless requests. `41` could be read between the add and the del of `9A/H-25.4`. `37` stays a result on doubles unless a step is ruled.
3. **`HI-01.1` cannot be met today:** the statement of row 119 (`verification/119_commissioning_security.md`) does not exist. `PREP-12` of the frame points to it through `HI-01`.
4. **`HI-08` and `9A/H-05` are knotted:** the interface file can agree with the database row only after the interface is chosen in the console (`9A/H-05.6`), while `9A/H-05` names "chapter 4 done (`HI-01` to `HI-10`)" as its precondition. The chapter resolves it on its side: `HI-08` is performed as `9A/H-05.6` and `.7`, `HI-10` after.
5. **S13-10 (a) is not built** (`implementation/104` section 8). The chapter says so in section 1, makes it a reading of `HI-01.2`, states in `HI-09.1` that a timer count of 0 says nothing about cleanup, and carries the condition into the record of `HI-10`.

## 5. Points for row 181 (the other chapters; not edited by this row)

1. **Order.** `HI-04` part A (steps `HI-04.1` to `HI-04.4`, the group and the membership) must come before `9A/H-16.2`, the first start of `dems-core.service`. Two ways: move only part A (it needs `HOST-04` and nothing else), or move `HI-01` to `HI-07` before `9A/H-16` and leave `HI-08` after it. With the second way and the room network still unplugged, `HI-03.6`, `HI-06` (b10) and (c3) are repeated after `PREP-11`; the chapter says so in its section 2.
2. `9A/H-05` precondition: "chapter 4 done (`HI-01` to `HI-10`)" should read "`HI-01` to `HI-07`"; `HI-08` is its own steps `.6` and `.7`.
3. `9A/H-05.3`: the request form of chapter 4 is the Python client of its section 1; `nc -N -U` is an equivalent where `netcat-openbsd` is installed; "the client must close its sending side" is not a requirement of the helper.
4. `9A/H-05.3` (c): the code is `14 REQUEST_MALFORMED`, confirmed from the source.
5. `9A/H-25.4`: a second `add` while the control address is in place would show `41 ALIAS_LIMIT_REACHED` on the host (finding 2).
6. The frame's open point E of chapter 2 and open point 6 of chapter 1 can cite section 2 of chapter 4.
7. The manual removal that `9A/H-06` (criterion 4) and `9A/H-13` refer to is `HI-09.2`.
8. `PREP-12` names the statement of `HI-01`: it is the output of row 119.

## 6. Driver decisions (to confirm)

| # | Decision | Why the conservative one |
|---|---|---|
| D-1 | Each `HI` step is written in the six parts of the frame's section 8, with "changes on the host" in its header line | One form for the whole package; the frame requires the form of chapters 2 and 3 only |
| D-2 | The client is a nine-line Python 3 text typed once into a shell variable, not `nc` and not a new file | `decisions/103` HP-3: a socket client may not be installed; Python 3 is present wherever the helper can run; nothing is written to the host. NOT RUN, marked in the chapter |
| D-3 | `HI-06` holds only harmless requests; of the nine refusals of 5.4 step 6, one is left to `9A/H-25` (address in use), two have no step (tool missing, alias limit) and two are conditional on the room network (section 4 of the chapter) | The brief: harmless requests only. 5.4 asks for nine in this step |
| D-4 | Refused `add` requests carry a lifetime of 5 minutes (chapter 2 uses 30) | If the helper wrongly accepted, the address would expire soonest |
| D-5 | While the interface file is wrong on purpose (`HI-06` part C) only `del` and the self-check are sent | An `add` that a faulty helper accepted would land on the wrong port |
| D-6 | The first connection of `HI-05.2` is sent as root and expects `12` | It creates the marks folder and cannot be accepted whatever its content (finding 1) |
| D-7 | `HI-08` is performed inside `9A/H-05` | Finding 4 |
| D-8 | Removing the group is a separate, last removal step, only when the helper leaves for good, after file G no longer names it | A deleted group stops the Core's unit from starting |
| D-9 | Section 2 states what must precede the Core's first start and leaves the order of chapter 1 unchanged | Row 181 owns the other chapters |
| D-10 | The claims line was appended with one shell append | The file is appended by other rows at the same time |

## 7. Alternatives considered

- `nc -N -U` as the only client (chapter 2's proposal): rejected as the primary form because of HP-3; named as an equivalent.
- A client script delivered by row 128 (the recommendation of `decisions/103` section 7): better for the collectors; not available today. The chapter's client text can be taken over by row 128 unchanged.
- All nine refusals inside `HI-06`: rejected by the brief (it would add an address and remove a tool during installation).
- Moving `9A/H-16` in this row: not this row's files.

## 8. Assumptions and gaps

| # | Assumption or gap | Settled by |
|---|---|---|
| 1 | Every command and output on Ubuntu 24.04 (`install`, `namei`, `systemd-analyze verify` on a template unit, the wording of `systemctl enable`, the socket as created, `journalctl -t`) | `9A/H-05` |
| 2 | An unknown group in `SupplementaryGroups` gives `status=216/GROUP` (author's recollection of the service manager) | `9A/H-16` |
| 3 | `/usr/sbin/ip` and `/usr/bin/arping` are root-owned files or links to such on Ubuntu 24.04 | `9A/H-25` |
| 4 | Instances that end with a refusal code are collected and do not accumulate as failed units (`CollectMode=inactive-or-failed`) | `9A/H-05` |
| 5 | The codes and lines of the Core's boot check and of the helper's caller | rows 81, 105; `9A/H-05` |
| 6 | The security statement of row 119 | row 119 |

## 9. Requests

None in `file_requests.md`.

## 10. What stays unproven

Everything in the document. It is a procedure; it has no result.

---
*Generated: 2026-10-13 01:06 WIB*
*Last Updated: 2026-10-13 01:06 WIB*
