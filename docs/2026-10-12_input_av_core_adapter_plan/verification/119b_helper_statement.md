---
task_id: 2026-10-12_input_av_core_adapter_plan
task_slug: input_av_core_adapter_plan
date: 2026-10-13
agent: security-review
blueprint_row: 119b
type: re-examination of ONE statement of row 119 (section 2), on the helper as changed by row H2 and measured by row H3
narrative_tier: 1
baseline: head 0f5d2a8e, branch task4/input-av-core-port; the helper is UNCOMMITTED in the working tree
helper_sha256: 1e758a2407f862ebfc461768f11c491ff43f3e89fcbf9d9a2da45763c7d015b1
helper_statement: MADE for this hash, with four conditions (section 1)
r119_01: closed
r119_02: closed
new_cautions: 4 (all Low), 2 notes
fail_count: 0
status: complete
---

# Row 119b: the statement on the helper, re-examined

## 1. The statement

**MADE, with conditions**, for `scripts/host/netalias/dems-core-netalias`, SHA-256
`1e758a2407f862ebfc461768f11c491ff43f3e89fcbf9d9a2da45763c7d015b1`:

> S13-08 to S13-10 are closed in the helper as delivered: **closed in code**. S13-08, all nine bounds, and S13-09 as a form are closed in the three delivered files. S13-10 (b) and (c) are closed in the Core (unchanged since row 119). S13-10 (a) is not closed by any code and cannot be: it is closed only when `9A/H-06` passes on the host.

The conditions, each a condition and not a reservation of the rating:

| # | Condition | Who closes it | State today |
|---|---|---|---|
| C-1 | **S13-10 (a) remains for the host.** No removal timer is built; the address ends by its kernel lifetime alone (`add:738-743`). Until `9A/H-06` has passed, the temporary-address function is not used on an installation (S13-10 (d)). If `9A/H-06` fails, the helper changes again, the hash moves, this statement is void, and the mark logic changes with it (section 5, R119b-02) | the user's host run | open, by its nature |
| C-2 | **The statement is about code read and run on doubles and in a container.** What the installed helper does under the service manager is shown only by `HI-01` to `HI-08`, `9A/H-05`, `9A/H-25` (section 6). A failed criterion there reopens the bound it names | the user's host run | open, by its nature |
| C-3 | **The procedure prints THIS hash before the user installs.** Three lines of `scripts/hardware-acceptance/HW-ACCEPTANCE-4-HELPER-INSTALLATION.md` (`:151`, `:185`, `:489`) and record `implementation/104_alias_helper.md` still print `62c0b726...`. Today a user at `HI-01` finds a mismatch and installs nothing, which is the safe side; the documents must be moved all the same, and the collectors row H2 names (`test_hw_collectors_host.sh:529,542`) with them | rows 127, 104 (documents), 81 / 128 (collectors) | NOT met: condition 3 of row 119 section 2 is met for `SHA256SUMS` only |
| C-4 | **One hash.** The statement holds for the hash above and for no other. Any change of the helper, R119b-01 below included, needs a re-read of the changed lines by this agent type | the controller | stands |

Row 119 section 2 asked four things. (1) R119-01 in the helper with a test per case: met. (2) R119-02 in the same change: met. (3) the hash in `SHA256SUMS`, record 104 and the chapter of row 127: met in the first of three (C-3). (4) the procedure states S13-10 (a) as it is: met (`HW-ACCEPTANCE-4-HELPER-INSTALLATION.md:51`, `:139`, `:146`, `:493`).

**Not a condition of this statement, and why:** the Core's code table (section 7) is a condition of USING the function through the Core, not of releasing the helper. R119b-01 (a carrier lost during the probe) is a Low caution with a row, not a bound left open (section 4.3).

## 0. Frame (5W1H), method, limits

| Question | Answer |
|---|---|
| **What** | One statement: "S13-08 to S13-10 are closed in the helper as delivered". Row 119 refused it for hash `62c0b726...` on S13-08 bound 4 (R119-01), with R119-02 beside it |
| **Why** | Step 1 of the installation procedure (`verification/02_security.md:218`) waits for it; decision C94 holds the helper back from installation until it is made on new hashes |
| **Who** | security-review, read-only on source. Subjects: the helper's writer (row H2), the capture row (H3), the user who installs (UA-3) |
| **When** | 2026-10-13 16:56 WIB, after rows H2 (16:40) and H3 (16:55), before any hardware run |
| **Where** | `/Users/gsp-budi/Documents/DEMS`, working tree. `HP` = `scripts/host/netalias/dems-core-netalias`; line numbers are of the hash above |
| **How** | The helper read in full (815 lines), the two unit files, `SHA256SUMS`, both records in full, all 21 captured files, `apps/core-server/src/capture/host-alias/protocol.ts` in full and `caller.ts:208,384-397`, `lifecycle.ts:336-352`. Three checks run (section 8): the hashes, `py_compile`, the helper's own suite on doubles |

**Limits.** Nothing here is proven on a Linux host or under systemd. Row H3 is a container result (arm64, virtual interfaces, no service manager) and I take its captures as that row recorded them: I replayed none. The other 45 rows of row 119 section 3 were not re-read. Two statements about the kernel below rest on my own knowledge, not on a check of this row, and are marked **(hypothesis)**.

## 2. Each requirement, re-rated against the helper as it now is

| Requirement | Built at (`HP`) | Rating | Changed by H2 |
|---|---|---|---|
| S13-08 (1) verb and one address; interface from the root-owned file, pattern, kernel list, not the default route | `parse_request:424`, `configured_interface:311` (folder and file by `lstat`, owner 0, no group or other write, `O_NOFOLLOW` `:232`), `default_route_interfaces:492`, `installation:698-711` | **closed** | no |
| S13-08 (2) RFC 1918, `/24`, host part 1 to 254 | `checked_address:400-421`, `parse_quad:384` (no leading zero) | **closed** | no |
| S13-08 (3) another interface's subnet; the limit | `add:720-727`, `overlaps_slash24:598`, `MAX_MARKED = 1` `:111`. The limit now counts STANDING marks (`standing_marks:684`); a mark is dropped only when its address is gone or is not the helper's, so the count of helper-added addresses is not loosened (section 4.2). The limit is serialised by the socket unit's `MaxConnections=1`, not by the helper (note N-2) | **closed** | the count's input |
| **S13-08 (4) the conflict check always runs** | `installation:703-707` (tool missing 37, not the expected program 38), `refuse_unless_askable:544-558` (46, 47, 48) at `add:728`, the probe `add:731-734` (no `-q`), `conflict_verdict:561-595`, the one gate `add:736` (`verdict != "FREE"` refuses). No path reaches `write_mark:739` without `FREE`; `FREE` needs status 0 AND the whole three-line text for THIS address on THIS interface with at least 2 probes, at least 1 broadcast, 0 responses, no further line. A missing answer (`run_tool` returns `None`) is 51 | **closed** (was CAUTION R119-01). Residual R119b-01, Low | yes |
| S13-08 (5) marked as its own, lifetime bounded by itself | `write_mark:624-638` (`O_EXCL`, `O_NOFOLLOW`, before the add), `valid_lft` / `preferred_lft` `add:741`, a refused add drops its mark and an unanswered one keeps it `:744-750` | **closed**; that the kernel expires it is C-1 | the mark's third field is now the monotonic clock |
| **S13-08 (6) `del` removes only an address it marked** | `delete:753-769`, `read_mark:652-660`, `mark_stands:663-681`, `standing_marks:684-692`. A mark stands only for this interface, inside its recorded minutes plus 60 s, and while the kernel lists the address as `/24` on the camera port with a remaining lifetime no longer than asked; an unstated lifetime refuses (50) | **closed** (was CAUTION R119-02) | yes |
| S13-08 (7) absolute tools, own search path, nothing from the environment, no evaluation | constants `:71-82` (one added, `DPKG_INFO_DIR`), `TOOL_ENV:89`, `run_tool:459-476` (no shell, `cwd=/`, two variables), interpreter `-I -S -B` (shebang and `ExecStart`). The new reads are two fixed root-owned text files and the program file; decoded as ASCII, compared, never evaluated. The interface and the address enter the one new pattern through `re.escape` (`:583`) | **closed** | new reads only |
| S13-08 (8) one journal line per call | `main:793-812`; `call.note` takes one fixed word (`:764`); the three interface causes are told apart in the journal by code | **closed**; seen in a journal: `9A/H-05` | no |
| S13-08 (9) fixed codes, no text of the caller | `CODES:114-161`, now 41 pairs, numbers unique (1 + 7 + 8 + 9 + 9 + 6 + 1); `main:800` maps anything else to 60. The reply lines of the probe (a device's address and hardware address) are matched and dropped (`:586-587`): no device text reaches the answer or the journal | **closed** in the helper. The Core's copy has 36 (section 7) | 5 pairs added |
| S13-09 the form (PF-1 to PF-6) | unit files unchanged, hashes equal to `SHA256SUMS` (`8623c1cd...`, `7e40f25e...`); `peer_user_id:332`, `service_user_id:283` unchanged | **closed** as a form. Whether `ProtectSystem=strict` leaves `/var/lib/dpkg/info` readable to the new check is `9A/H-05` | no |
| S13-10 (a) removal scheduled by root if H-S fails | not built | **ONLY A HOST** (C-1) | no |
| S13-10 (b), (c) | the Core (row 119 rows 14, 15); not re-read | closed, as rated | no |

## 3. R119-01 and R119-02

**R119-01: CLOSED.** The defect was a tool that did not ask being read as "free". Three independent stops now stand in front of the add, and the captures of row H3 show each one working on the real program:

| Stop | What it catches | Evidence |
|---|---|---|
| the flag words (`:544`) | loopback, no-ARP, no broadcast address (46); down, **no carrier** (47); not listed, listed twice, unreadable words (48) | H3 form 2: 9 interface states, 0 mismatches |
| the printed result with the status (`:561`) | `Interface "lo" is not ARPable` with exit 0, the measured case of `test/079:91`, is 55; the other program's reversed exit status is 55 | H3 form 3 cases 5 to 8; `captured/arping/iputils_loopback_not_arpable.stdout`, `other_program_*.stdout` |
| the program's identity (`:257`) | the other `arping`, linked or copied to the path, is 38 before anything is started | H3 form 1 states 6, 7 |

Row 119 advised the flag read over the text read. H2 built both, and H3's case 11 shows why both are needed: neither alone is enough (the text cannot see a dead port; the flags cannot see a tool that printed nothing).

**R119-02: CLOSED**, and further than asked. Row 119 asked that a mark past its recorded lifetime be no mark. H2 added the kernel's own lifetime as a second witness, which closes the path "removed by hand, set again by another hand inside the lifetime" for every such address except one with a finite lifetime no longer than the mark's. That one needs root and is accepted.

## 4. Did the fixes open anything new

### 4.1 The program check (`_expected_conflict_tool:257-280`)

**What it trusts.** The folder `/var/lib/dpkg/info` and the two record files, each by `lstat`: owner 0, not writable by group or others, not a link; the files opened `O_NOFOLLOW`. The parents of the folder are not checked.

**A root-writable database trusted by a root service: acceptable.** Whoever can write the records or `/usr/bin/arping` is root and can replace the helper itself; no check inside the helper can stand against that, and the comment at `:276` says so. The check is not there against an attacker. It is there to IDENTIFY the program, because the two packages named `arping` take other options and return REVERSED exit codes (H3: free = 1, in use = 0). Before H2 the helper with the other program would have read an address in use as free.

**What the MD5 record proves, and what it does not.**

| It proves | It does not prove |
|---|---|
| the file the kernel will execute at the path has the checksum the package manager recorded when it unpacked `iputils-arping` | that the package is Ubuntu's (a locally built package of that name passes) |
| so: not the other package's program, not a link to it, not a local build, not a damaged or replaced file | a version (file and record move together on an update; intended) |
| | anything against root, or against a collision made by the author of the packaged file |
| | that the file is unchanged between the read (`:277`) and the start (`:731`); only root can change it |
| | the libraries the program loads |

MD5 is the right function here because it is the format of the record being compared; `usedforsecurity=False` is honest about it. Nothing is started to learn the answer, which is the property that matters for root code.

**Every "cannot tell" is a refusal:** a missing or unsafe record, no line or two lines for the path, a malformed checksum, a file over 4 MiB, any `OSError`, `ValueError` or `UnicodeError` returns `False` (38). A package half-unpacked during an update answers 38 for that moment: fail closed.

`del` does not ask for the conflict tool (`delete:754`), so nothing of this can hold a removal back. Correct.

### 4.2 The lifetime logic of the marks

Followed case by case:

| Case | What the helper does | Safe |
|---|---|---|
| the helper's own address, inside its lifetime | mark stands; `del` removes it | yes |
| the kernel removed it | mark does not stand, is dropped; `del` answers `0 OK note=already-absent` | yes |
| removed by hand, set again by hand without a lifetime or with a longer one | mark dropped; `del` answers 45 and removes nothing | yes |
| the listing does not state the lifetime of an address that is there | 50, mark kept, nothing added or removed | yes |
| `ip addr add` did not answer in time | mark kept (`:748`); next `del` removes the address if it is there, next `add` drops the mark if it is not | yes |
| the helper killed between mark and add | a mark without an address; dropped at the next call; `O_EXCL` cannot collide because the drop comes first (`:719`) | yes |
| the interface file changed while an alias is up | mark dropped; the address ends by its kernel lifetime (residual C74) | accepted |
| **the kernel does NOT remove the address at its lifetime** | after the recorded minutes plus 60 s the mark no longer stands; `del` answers 45; the helper will never remove its own address | **only if H-S fails: R119b-02** |

The mark's clock (`time.monotonic`, `:634`, `:675`) and the comparison are sound. The mark is written before the add, so the address ends at most one tool timeout (5 s) after the mark's own end; the 60 s of grace cover that and the kernel's delay. The comparison `lifetime <= minutes * 60` (`:681`) is looser than it could be (the remaining lifetime could be held to the mark's remaining time); what it admits needs root. No row asked.

Marks are dropped at the start of every `add` (`:719`), before the refusals. The service user can therefore cause drops by sending refused `add` requests. Only marks that do not stand are dropped, so this gives a caller nothing.

### 4.3 Any path where "unknown" is not a refusal

Searched by function. None found in `add`.

| Unknown | Where | Result |
|---|---|---|
| port not in the listing (no IPv4 address), listed twice, words not a list of flag words | `host_state:522-523`, `:552-554` | 48 |
| an empty flag list | `:555` | 46 (no `BROADCAST`) |
| the listing is not JSON, not a list, an address that cannot be parsed | `_json_list:479`, `:535` | 50 |
| the probe did not answer in time or could not be started | `run_tool:474`, `:571` | 51 |
| status 0 or 1 without its statement, non-ASCII, over 4096 bytes | `:573-595` | 55 |
| the lifetime of a marked address not stated | `:679` | 50 |

One place answers `0 OK` without having done anything: `del` of a marked address whose mark does not stand and whose address is not on the port as `/24` (`:762-765`). That is "already so" with a note in the journal, not an unknown read as success.

### 4.4 Time of check to time of use

The order in `add`: one read of the host (`:716`) - the bound checks - the flag check (`:728`) - the probe, 2 probes inside 3 s, bound 8 s (`:731`) - the mark (`:739`) - the add (`:740`).

| Window | What can change | Consequence | Rating |
|---|---|---|---|
| read to end of probe (about 3 s) | **the port loses carrier** | section 5 | **R119b-01, Low** |
| read to add (up to about 8 s) | another interface gains an address in that `/24` (a lease on the office port) | bound 3 passed on a stale read; the Core's own DR-4 guard stands beside it; ends with the lifetime | Low, closed by the same change as R119b-01 |
| end of probe to add | a device takes the address | inherent in any conflict probe | accepted |
| two instances at once | two adds pass the limit of one | excluded by `MaxConnections=1` of the socket unit, not by the helper | note N-2; `9A/H-05` |
| checksum read to program start | the program file | root only | accepted |

## 5. The load-bearing flag check (H3 observation O-1)

**Is `LOWER_UP` read from the call the helper already trusted? Yes.** One invocation, `/usr/sbin/ip -json -4 addr show` (`host_state:518`), made once per `add` (`:716`), gives both the addresses that decide bounds 3 and 6 and the flag words that decide 46, 47, 48 (`:521-523`). No second tool, no second reading, no sysfs file. The trust is the one row 119 already rated: `_safe_tool(IP_TOOL)` (`:701`). `ip` itself is not checked against a package record; H3 section 3.1 shows a record check by the `/usr/sbin` path would not find it, so that is not asked.

**Can the port lose carrier between that read and the probe? Yes.** A few milliseconds lie between the read and the start of the probe, then the probe runs about 3 seconds. A cable pulled, a switch restarted or a switch port that renegotiates inside that time is not seen: the flags are not read again.

**What then.** By H3's case 11 (`captured/arping/iputils_no_carrier_prints_free.stdout`, exit 0) the program prints the complete free text although it asked nobody. `conflict_verdict` answers `FREE`, the mark is written, the address is added to a port without a link, the answer is `0 OK`. Bound 4 was then honoured in form and not in substance for that one call.

How bad: the address is one private `/24` address on the camera port only, in no other interface's subnet, for at most 480 minutes, removable by `del`, with a journal line. No privilege boundary is crossed and the caller cannot cause it (it takes a physical event inside 3 s). Harm needs a second coincidence: when the link returns, another device holds exactly that address; then two devices answer for one address on the camera network until the alias ends. I rate it **Low** and not a bound left open: the check ran, on a port that could be asked when it was judged.

**R119b-01, the change.** After the probe answered `FREE` and before the mark, read the host once more with the same fixed vector and refuse (47, or 50 / 40 by their own rules) unless the port still shows `UP` and `LOWER_UP` and the bound checks of `:720-727` still hold. A carrier that went and came back inside the probe is caught by reading `/sys/class/net/<port>/carrier_changes` before and after and refusing on a difference **(hypothesis: the file exists on the host's kernel; to confirm on the host before it is relied on)**. This moves the hash. It is not a condition of the statement; the controller may take it before the user installs, to hand over one hash instead of two, and then a re-read of the changed lines is enough.

**What no flag can show, for the procedure:** a port with carrier whose switch port does not yet forward (a switch still starting), and a camera still booting. Both read as "nobody answered". The procedure should say: request the temporary address only when the switch has been up for a minute and the camera's link light is steady.

**R119b-02, the interaction with S13-10 (a).** Before H2 a `del` removed a marked address at any age. Now the helper stops honouring its own mark 60 s after the recorded lifetime (`:676`). If H-S holds, nothing is lost: the kernel has removed the address. If H-S fails on the host, the address stays, the helper answers 45 to every later `del`, the boot sweep cannot take it away, and only root by hand or a reboot ends it. That the kernel removes an IPv4 address at its `valid_lft` is long-standing behaviour **(hypothesis, not checked here)**, and the Core's own timer sends `del` at the lifetime's end, inside the grace. So this is not a defect today; it makes `9A/H-06` carry more than it did. `9A/H-06` gains two lines: after the lifetime with the Core killed, the address is gone AND a `del` of it answers `0 OK` with `note=already-absent` AND the marks folder is empty afterwards.

## 6. What only a host can show, by check name

| Check | What it shows that no code reading and no container can |
|---|---|
| **S13-10 (a) / `9A/H-06`** | Hypothesis H-S: with the Core killed, the kernel removes the address at its lifetime. Closes or reopens S13-10 (a), and with R119b-02 also the mark logic. Also: one `add` and one `del` from inside the Core's unit with `NoNewPrivileges` in force; `valid_life_time` as the host's `ip` prints it for the helper's own address (H2 hypothesis 2 on amd64) |
| `HI-01` | The user compares three hashes with the files in hand, against a chapter that prints `1e758a24...` (C-3) |
| `HI-02`, `HI-03` | The helper file and the interface file as installed: owner, mode, every parent root-owned, no link; the interface is not the default-route or office port. The port must hold its IPv4 address and a carrier, or every `add` answers 48 or 47 |
| `HI-04` | The group with ONE member, the two unit files, the socket node as the service manager makes it (root, `dems-netalias`, 0660) |
| `HI-05` | The first connection makes the marks folder; `check` answers 0. **New with H2:** `check` now also proves the two package records on the host's own architecture and package build (amd64; H3 read arm64) - a 38 here is H2 hypothesis 3 failing. `check` does NOT read the flag words: it cannot show 46, 47, 48 |
| `HI-06` | The refusals through the socket as the service user, a journal line each. The chapter names none of 38, 46, 47, 48, 55 today (`grep`: no line): to add, at least 47 with the camera cable pulled |
| `HI-07`, `HI-08` | The firewall on the camera port and on an alias address; the Core's boot check on the helper, the grant and the interface file |
| `9A/H-05` | Socket activation; the peer credential with the Linux numbers; `MaxConnections=1` really serialises calls (bound 3's limit rests on it, note N-2); the unit's `ProtectSystem=strict`, `RestrictAddressFamilies`, `MemoryDenyWriteExecute` do not stop the interpreter, `hashlib`, the read of `/var/lib/dpkg/info` or the two tools (H2 hypothesis 4: 38 through the socket while `check` passes would be this) |
| `9A/H-25` | On a PHYSICAL port: the flag words with and without cable (`LOWER_UP` gone when the cable is pulled, H3 had veth only); a free address gives 0, a taken one 44, with a real camera's reply line (a `Broadcast reply` form, several replies - H3 had one `Unicast reply` from a container); the cable pulled gives 47 and no address. To add: capture of the probe's whole text in each case, as H2 and H3 ask |

## 7. The Core's client does not yet know codes 38, 46, 47, 48, 55

**Fact.** `apps/core-server/src/capture/host-alias/protocol.ts:22-64` holds 36 pairs. `helperAnswerOf:166-173` returns `null` for a name outside it; `caller.ts:394` turns that into `HELPER_ANSWER_NOT_UNDERSTOOD` with effect UNKNOWN; `lifecycle.ts:349-352` treats UNKNOWN as "possibly in place" and sends a removal at once, which the helper answers with 45 (nothing was marked) and the row closes as `ADD_UNCONFIRMED`.

**For a release of the HELPER: acceptable, no condition.** The helper is the enforcement boundary and trusts no caller; what the caller understands does not touch a bound. The Core's reading is on the safe side in every one of the five cases: none of them is ever read as a done add, and the cost is one extra `del`.

**For USING the function through the Core: a condition (R119b-03).** Three things are wrong until the table has 41 pairs:

1. The technician is told "answer not understood" where the truth is "the camera cable is not connected" (47), "the wrong interface is configured" (46) or "the conflict tool is not the packaged one" (38). The commonest refusal of a commissioning day reads as a defect of the product.
2. The audit row closes as `ADD_UNCONFIRMED` where the helper said plainly that nothing was added: a reason that is not true, the kind R119-05 was raised for.
3. The header's own sentence "a closed set of 36 ... a copy of the helper's own table" (`protocol.ts:9`, `:21`) is no longer true, and row 119's bound 9 row cited that equality.

To do: the five pairs name by name and number by number, each with effect NOT_DONE (none of them follows an act), the count in `__tests__/caller.test.ts:190-191`. Gate: before the first hardware check that calls the helper through the Core (`9A/H-06` Core part, `9A/H-13` to `H-15`). The request is already filed by row H2 (`file_requests.md:440`).

## 8. Cautions of this row, each routed

| Id | Severity | Caution | Change | Row |
|---|---|---|---|---|
| R119b-01 | Low | A carrier lost between the flag read and the end of the probe gives `FREE` with nobody asked; bound 3 is judged on the same earlier read | Read the host again after `FREE` and before the mark; refuse unless `UP` and `LOWER_UP` still stand and the bound checks still hold; `carrier_changes` before and after once confirmed on the host; two tests on the double. Moves the hash | a follow-up of row H2 (proposed H2b); then this agent type re-reads the diff. The procedure sentence: rows 125 / 127 |
| R119b-02 | Low | If the kernel does not remove an expired address, the helper stops honouring its own mark 60 s later and can never remove the address | None today. `9A/H-06` gains: after expiry `del` answers `0 OK note=already-absent`, the marks folder is empty. If `9A/H-06` fails: the removal timer of S13-10 (a) AND a mark that stands while its address is listed | the writer of `9A/H-06` (chapter 2; row 125), collectors row 128 |
| R119b-03 | Low, a gate for the Core | The Core's table has 36 of the helper's 41 pairs | section 7 | the owner of `protocol.ts` / `caller.ts` (row 105 follow-up; `file_requests.md:440`) |
| R119b-04 | Low, documents (condition C-3) | Chapter 4 (`:151`, `:185`, `:489`) and record 104 print the old hash; `HI-06` and `9A/H-25` do not name the five new refusals | The new hash; a refusal step for 47 (cable pulled) and one for 46 or 38 where it can be made without harm | rows 127, 104, 125; collectors 81 / 128 |

Notes, no row asked:

- **N-1.** The 21 captured files are read by no test; the suite still holds the recollected forms, which H3 found equal. Replaying the captures in the suite changes no delivered file and no hash (request filed by row H3).
- **N-2.** The limit of one alias is exact only while calls come one at a time. The socket unit orders that (`MaxConnections=1`, hash unchanged); the helper holds no lock of its own. S13-08 (3) allowed two, so even a unit that did not serialise would stay near the requirement. A lock on the marks folder would make the helper independent of the unit; worth taking with R119b-01 if the hash moves anyway.

## 9. Evidence

| Check | Command (repository root) | Output |
|---|---|---|
| The helper is the hashed one | `shasum -a 256 scripts/host/netalias/dems-core-netalias`, before and after the suite | `1e758a2407f862ebfc461768f11c491ff43f3e89fcbf9d9a2da45763c7d015b1` both times; equal to `SHA256SUMS` line 1 |
| The unit files are unchanged | `shasum -a 256` of both | `8623c1cd...ffdbcb`, `7e40f25e...38dd60a`: equal to `SHA256SUMS` and to row 119 section 9 |
| It compiles | `python3 -m py_compile scripts/host/netalias/dems-core-netalias` (byte-code under the temporary folder) | exit 0; no byte-code folder left in `scripts/host/netalias` (`ls -a`: 6 entries and `captured`) |
| Its own suite, on doubles | `python3 -I -B scripts/host/netalias/test_dems_core_netalias.py` (as row H2 ran it) | `Ran 75 tests in 51.390s`, `OK`, exit 0 |
| The no-carrier text | `captured/arping/iputils_no_carrier_prints_free.stdout` | `ARPING 198.51.100.77 from 0.0.0.0 h3nc` / `Sent 2 probes (2 broadcast(s))` / `Received 0 response(s)`; exit 0 per `captured/README.md` |
| The no-carrier flag words | `captured/ip/addr_made_interfaces.json`, interface `h3nc` | `["NO-CARRIER","BROADCAST","MULTICAST","UP","M-DOWN"]`: no `LOWER_UP` |
| Documents on the old hash | `grep -c 62c0b7260a74` | chapter 4: 3 lines, 0 of the new; `implementation/104_alias_helper.md`: 1, 0 of the new |
| The Core's table | `protocol.ts:22-64` | 36 pairs; none of 38, 46, 47, 48, 55 |

## 10. Assumptions, gaps, alternatives

- **Assumption:** the host's `iputils-arping` and `iproute2` print what the container's did. If not, every parser fails closed (H2 section 5) and `HI-05` / `9A/H-25` show it.
- **Assumption (hypothesis):** the kernel removes an IPv4 address at its `valid_lft`; `/sys/class/net/<port>/carrier_changes` exists on the host. Neither checked here.
- **Gap:** I did not replay the captured texts through the helper's functions myself; row H3 did, and its table is taken as recorded. The suite of the Core was not run.
- **Gap:** `add` and `delete` end to end with real tools have run nowhere (H3 called the reading functions only). The first real `add` is the user's, in `9A/H-25`.
- **Alternative considered: refuse again until R119b-01 is built.** Not taken. Row 119 refused for a steady fail-open that a wrong line in a file was enough to reach. What is left is a race of about 3 seconds that needs a physical event and then a second coincidence to do harm, bounded to one private address on the camera port for at most 480 minutes. Refusing would hold the host run back for a Low.
- **Alternative considered: make the statement without conditions, the host items as "next steps".** Not taken. S13-10 (a) is by its own text decided on the host, and the installation procedure prints the statement beside a hash: a reader must see in the same sentence what it does not cover.
- **Alternative considered: make the Core's table a condition of the statement.** Not taken: the statement is about the helper, and the Core's reading of an unknown code is a refusal. It is a gate of the function instead (R119b-03).

## 11. Verification cell of row 119b, checked

| Cell | Result |
|---|---|
| The hash verified first | section 9 |
| S13-08 every bound, S13-09, S13-10 re-rated by function and line | section 2 |
| R119-01, R119-02 judged; what the fixes opened | sections 3, 4: both closed; four Low cautions, no FAIL |
| The flag check | section 5 |
| What only a host can show, by check name | section 6 |
| The Core's client | section 7 |
| The statement made or refused, conditions as conditions | section 1: MADE, C-1 to C-4 |

---
*Generated: 2026-10-13 16:56 WIB*
*Last Updated: 2026-10-13 16:56 WIB*
