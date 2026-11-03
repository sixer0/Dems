---
task_id: 2026-10-21_bare_metal_bench
task_slug: bare_metal_bench
date: 2026-10-22
agent: data-analyst
row: 93
type: spec (R-FLEX host-profile and installer delta)
narrative_tier: 1
confidence: HIGH for the current text and line numbers (re-read in the repo this session); MEDIUM for the proposed wording (depends on row 89 where marked DEP-89, and on row 96 Q-R4)
source_structured_task: docs/2026-10-21_bare_metal_bench/identification/02_structured.md (row 93, line 261)
inputs: research/01_explore_rflex_network_ui_docs.md, research/01_explore_rflex_security_history.md, research/01_explore_rflex_network_core.md, research/01_explore_host_survey.md, identification/01_translated.md (AC1-AC8), decisions/decisions.md D10-D12, masterplan/01_specs_rflex_register.md (R-FLEX names), masterplan/01_specs_register.md (install names)
consumers: row 11 (applicability), 14 (security delta), 16 (impact), 17 (reconcile), 18 (runbook), 95 (R-FLEX reconcile), 96 (decision sheet), 113 (host docs code row), 114 (host script code row)
last_updated: 2026-10-22
---

# R-FLEX host-profile and installer delta (row 93)

## 0. 5W1H (Tier 1)

| W | Answer |
|---|---|
| What | The wording change for the host profile items HOST-19 to HOST-25 and HOST-46, for the firewall script `scripts/host/40-network-firewall.sh` and for the network steps of `scripts/host/INSTALLER-NOTE-FIRST-PRODUCTION-BOOT.md`. Each item is either amended or kept, with the reason. The section also covers what happens to the script test pin, which install rows 11-79 and 122-128 are affected, and the exact text proposed for AC6, AC7 and AC9 |
| Who | Decided by the user: D10 ruling 2 ("Global penuh"), D11 (risk accepted), D12 (U-RF3: HOST-23 stays on the camera port only, AC7 unchanged; U-RF4: AC9 added, AC6 reworded). Applied by row 113 (profile and note text) and row 114 (script and test). Consumed by install rows 11, 14, 16-18, 34, 36, 45, 46, 66-79, 124, 128 |
| When | Spec wave S2 (after row 87), beside row 89, 2026-10-22. Text lands in code wave W-g (rows 113, 114), before gate G-RF |
| Where | `scripts/host/HOST-PROFILE-UBUNTU-24.04.md`, `scripts/host/40-network-firewall.sh`, `scripts/host/test_host_profile_scripts.sh`, `scripts/host/INSTALLER-NOTE-FIRST-PRODUCTION-BOOT.md`; on the bench host .73 the interfaces `enp4s0` (camera) and `wlp3s0` (room network, Wi-Fi), as named in the install register (masterplan/01_specs_register.md:44, :124-125) |
| Why | Under "Global penuh" the Core searches for cameras and connects to them on every host interface, so the camera port is no longer the Core's only camera path (D10 ruling 2; register RM-N1..RM-N4). The host items that isolate the camera port are kept as host hygiene, because each one still defends against a threat that lifting point 2 does not cancel (section 2). The documents must say so, so that an installer does not read them as the Core's guard |
| How | Each item's current text was re-read with its line number. Each item was then checked against two things: the threats that survive the lift (research/01_explore_rflex_security_history.md §2) and the boot checks in code (host-checks.ts, program-checks.ts). Wording only. No item is added or removed, and no command or check changes except where stated |
| Alternatives | HOST-23 on every interface (rejected by the user, D12 U-RF3). Dropping HOST-19 and HOST-20 (rejected here: section 2, reasons R1-R4). Leaving the documents unchanged (rejected: the camera-port sentences would then describe a guard that no longer exists) |
| Assumptions | (A1) RQ-N2 / Q-R4 follows the register's recommendation: the commissioning scan and set-IP stay bound to one configured interface (register section 9 Q-R4). Wording that depends on this is marked `[Q-R4]`. (A2) Row 89 keeps points 1, 3 and 4 and refuses an off-link target (`NO_SOURCE_INTERFACE`, register NW-R1). Marked `[DEP-89-n]` with its default. (A3) The bench has no address helper (install register :66, :103) |
| Gaps | Section 9 |

## 1. Fixed inputs (verified this session)

| # | Fact | Evidence |
|---|---|---|
| I1 | HOST-19..25 sit at profile lines 81-87 and HOST-46 at line 132. The placeholder `<camera-interface>` is defined at :38 as "The network port that carries only the cameras" | `grep -n` on `scripts/host/HOST-PROFILE-UBUNTU-24.04.md` |
| I2 | The HOST-23 rule is already scoped to the camera interface: `ufw allow in on <camera-interface> proto udp from any port 3702` | profile :85; script `40-network-firewall.sh:85`; research/01_explore_rflex_network_ui_docs.md (RQ-N6) |
| I3 | The only `ufw` command the script runs is the HOST-23 `act`. HOST-22 is MANUAL, so its commands print as a manual block and not as `would-run` | `grep -c 'act ufw' 40-network-firewall.sh` = 1; script :73-81 |
| I4 | The test pin asserts the printed HOST-23 command line | `scripts/host/test_host_profile_scripts.sh:233-234` (`grep -q 'would-run: ufw allow in on enp3s0 proto udp from any port 3702'`) |
| I5 | The test compares item ids between the profile and the scripts, not item titles. Notes can be added to an item freely | test :121-135 (ids only); `note()` exists in the lib (test :252; used by script :48) |
| I6 | HOST-20 is a production start refusal in the Core: `CAPTURE_HOST_FORWARDING_ON`, which reads `net.ipv4.ip_forward` and `net.ipv6.conf.all.forwarding` | `apps/core-server/src/capture/boot/host-checks.ts:113-114, :140, :250-255` |
| I7 | HOST-46 is asked by the Core only when part of the helper is installed AND a stored interface exists. With nothing of the helper it is `NOT_ASKED` | `apps/core-server/src/capture/boot/program-checks.ts:20-24, :129, :331, :341` |
| I8 | Discovery is not tied to the camera interface. It probes up to 4 eligible IPv4 interfaces, chosen by property and not by name, and Wi-Fi is not excluded | `apps/core-server/src/capture/adapters/camera/discovery-collector.ts:32, :63-80`; research/01_explore_rflex_network_core.md N3 |
| I9 | The search answer carries `interfaceCount`, "a count, never a name or an address". No per-candidate interface name will be added | `packages/shared/src/api/capture-discovery.ts:258`; register F9, NW-S1 |
| I10 | Bench network: enp4s0 192.168.100.254/24 has no gateway and is never-default; wlp3s0 192.168.0.73/24 carries the default route via 192.168.0.1. ufw is inactive and iptables has 0 rules | research/01_explore_host_survey.md:24, :139, :141-142 |
| I11 | Only point 2 of S13-11 (with DR-4) is cancelled by the user's ruling. Points 1, 3 and 4, AD-02 and S13-08 still stand | research/01_explore_rflex_security_history.md §2 |
| I12 | Installer note network text: step 1 at :235, step 5 ("off the room network") at :240, step 10 (search and connect) at :246, active-scan note at :258, room-network cable note at :259, section 6 at :278 | `grep -n` on `INSTALLER-NOTE-FIRST-PRODUCTION-BOOT.md` |

## 2. Why the camera-port items are kept as host hygiene

| Id | Reason | Evidence |
|---|---|---|
| R1 | The host must not route between its networks. If forwarding were on, the host would join the camera LAN and the office LAN. That would expose cameras that use digest over unencrypted HTTP/RTSP to the office network, independently of what the Core dials. The Core refuses a production start with forwarding on (I6) | host-checks.ts:140; profile :293 |
| R2 | The acceptance of digest authentication over an unencrypted camera network (UA-12) names "the dedicated port, the dedicated switch and HOST-20" as the host's part of that condition | profile :293; HW-ACCEPTANCE-1-FRAME.md:136 |
| R3 | No gateway on the camera port keeps one default route, on the room network. It keeps the camera LAN unreachable from beyond the host and gives the Core one source per on-link subnet | research/01_explore_host_survey.md:142; register NW-R1 |
| R4 | `[Q-R4]` The commissioning scan and the set-address job stay bound to one interface, which is the camera port of HOST-46 (they rewrite a camera's address and use the helper alias; S13-08 points 2 and 3 survive) | register section 9 Q-R4; research/01_explore_rflex_security_history.md §2 |
| R5 | Point 2 is the only guard lifted (I11). The host items never were the Core's destination rule: no boot or source file names HOST-19 or HOST-23 | research/01_explore_rflex_network_core.md:93; research/01_explore_rflex_network_ui_docs.md "Pins and tests" |

## 3. Per item: amended or kept

| Item | Verdict | Reason | Command / check change |
|---|---|---|---|
| HOST-19 | **KEPT as host hygiene, wording amended** | R1-R4. Under R-FLEX the port is no longer "the only port of the cameras" for the Core | none |
| HOST-20 | **KEPT unchanged** | R1, R2. Also a Core start refusal (I6). Under "Global penuh" it matters more: the host now dials on the office network and must not bridge it to the camera LAN | none |
| HOST-21 | **KEPT unchanged** | Guards HOST-20 against software that re-enables forwarding. Not affected by the network scope. Bench: Docker removed (D2); its `rc` configs, the `docker` group and `docker.sources` remain but are not `ii` (research/01_explore_host_survey.md:100, :115) | none |
| HOST-22 | **KEPT unchanged** | Default deny incoming and routed is the host's barrier on every network, Wi-Fi included (AC7). Not scope-dependent. The bench SSH rule on wlp3s0 is "the user's own remote-administration rule" (D5) | none |
| HOST-23 | **KEPT on the camera port only (D12 U-RF3), wording amended** | The user decided. The rule text already matches (I2). The amendment states the consequence: the search also probes the other networks (I8), and their multicast answers are not admitted. A device on another network is reached by typed or stored address. That this works under default deny is a hypothesis: the answer to a unicast request belongs to that request's connection state. To confirm in 9A/H-12 and row 72 | check gains "no other rule names port 3702" |
| HOST-24 | **KEPT, wording amended** | The Core and the DB listen on 127.0.0.1 only, so they are unreachable from every network. The item text names only the camera port. Under R-FLEX the room network is a camera network too, so the text must name it (AC7) | check unchanged. Confirm cell gains "from a machine on the room network". Whether the console port 5173 joins the port list is a question for row 14 (install register W4) |
| HOST-25 | **KEPT unchanged** | The loopback-only rule for 8554-8564 is independent of the network scope (research/01_explore_rflex_network_ui_docs.md: "Not network-scope dependent") | none |
| HOST-46 | **KEPT, wording amended: single-interface helper file** `[Q-R4]` | The file names the one interface on which the address helper adds its temporary address. Since R-FLEX it is no longer "the Core's camera interface" for search and connection. File path and boot check unchanged (register CF-2, CF-3: `/etc/dems/netalias-interface`, `CAPTURE_HOST_INTERFACE_FILE_MISMATCH`). Bench: not applicable, because the helper is absent and the check is `NOT_ASKED` (I7; install register :103) | none |

## 4. Profile edits (exact text for row 113)

Line numbers refer to `scripts/host/HOST-PROFILE-UBUNTU-24.04.md` as of 2026-10-22. "Unchanged" cells keep their current text.

| Id | Where | Current (short) | New text |
|---|---|---|---|
| E-P1 | New paragraph after :7 | (none) | **Revision of `<date of row 113>` (R-FLEX; decisions D10, D11, D12 of task 2026-10-21_bare_metal_bench; still unverified on Ubuntu).** The Core no longer limits the camera search and camera connections to the camera port. They run on every IPv4 network the host is attached to (D10 ruling 2), a risk the user accepted (D11). The camera port, forwarding off and the firewall stay, as host hygiene. Changed: the placeholder `<camera-interface>`, HOST-19, HOST-23 (wording only; the rule stays on the camera port only, D12 U-RF3), HOST-24, HOST-46 (wording), the posture paragraph of section 3.4, the echo note of section 3.11, open point 8 and the digest-authentication line of section 5. No item was added or removed: the items are HOST-01 to HOST-56 as before. |
| E-P2 | :38 `<camera-interface>` meaning | "The network port that carries only the cameras" | The network port dedicated to the cameras (HOST-19), and the one port on which the address helper acts (HOST-46). Since R-FLEX it is not the only port on which the Core reaches cameras |
| E-P3 | New paragraph after the heading :76 | (none) | **Posture since R-FLEX (D10 ruling 2, D11).** The Core searches for cameras and connects to them on every IPv4 network of the host, the room network included, so a signed-in technician can make the Core dial a private address on any of them. The Core's guards that do not depend on the port stay: an IPv4 literal only, private ranges only, never the host's own addresses, the port list, and the scan size and spacing `[DEP-89-1]`. The items below no longer make the camera port the Core's only camera path. They keep the camera network clean (HOST-19), stop the host from joining its networks (HOST-20, HOST-21), keep the Core's own services off every network (HOST-22, HOST-24), and admit search answers on the camera port only (HOST-23). |
| E-P4 | :81 HOST-19, item cell | "The cameras are on a dedicated port and a dedicated switch: one static private `/24` address, no gateway, no name server, no DHCP on that port" | The camera port is a dedicated port with a dedicated switch: one static private `/24` address, no gateway, no name server, no DHCP on that port. Host hygiene: since R-FLEX the Core also reaches cameras on other networks of the host, but the cameras of this installation are on this port, and it never carries the default route |
| E-P4b | :81 HOST-19, command cell (recommended, see For row 96, F96-1) | "file B, then `sudo netplan try`" | file B, then `sudo netplan try`; or the same settings in the host's network manager, held to the same two checks |
| E-P5 | :82 HOST-20 | - | unchanged |
| E-P6 | :83-84 HOST-21, HOST-22 | - | unchanged |
| E-P7 | :85 HOST-23, item cell | "Answers to the camera search arrive: datagrams from source port 3702 are admitted on the camera port" | Answers to the camera search arrive on the camera port: datagrams from source port 3702 are admitted on the camera port and on no other port of the host (decision D12 U-RF3). The search also asks on the other networks of the host. Their answers are not admitted, so a camera on another network is reached by its typed address |
| E-P7b | :85 HOST-23, check cell | "`sudo ufw status numbered` lists the rule with `on <camera-interface>`; the search in the web console lists at least 1 camera" | `sudo ufw status numbered` lists the rule with `on <camera-interface>`, and no other rule names port 3702; the search in the web console lists at least 1 camera |
| E-P7c | :85 HOST-23, confirm cell | "...and 9A/H-13 (answers from a factory subnet through a temporary address)" | append: `; and 9A/H-12 (that a typed address on another network of the host is answered with this rule alone)` |
| E-P8 | :86 HOST-24, item cell | "The Core's own services are not reachable on the camera port or on any temporary address added to it" | The Core's own services are not reachable from any network of the host: not on the camera port, not on any temporary address added to it, not on the room network |
| E-P8b | :86 HOST-24, confirm cell | "(a connection attempt to those ports from a laptop on the camera switch fails)" | (a connection attempt to those ports from a laptop on the camera switch, and from a machine on the room network, fails) |
| E-P9 | :87 HOST-25 | - | unchanged |
| E-P10 | :132 HOST-46, item cell, first sentence `[Q-R4]` | "The interface file: one line that names `<camera-interface>`, owner root, mode 0644; it is not the port of the default route." | The interface file: one line that names `<camera-interface>`, the one port on which the address helper adds its temporary address (the factory-address scan and the camera address change use it). Since R-FLEX it is not the port that limits the camera search or the camera connections. Owner root, mode 0644; it is not the port of the default route. (the rest of the cell unchanged) |
| E-P11 | :161, last sentence of the `ping` bullet `[Q-R4]` | "...with HOST-19 in force that is the camera port." | ...with HOST-19 in force and the address inside the camera subnet, that is the camera port. |
| E-P12 | :276 open point 8, first cell | "Search answers pass the firewall with the rule of HOST-23, on the camera subnet and from a factory subnet" | Search answers pass the firewall with the rule of HOST-23, on the camera subnet and from a factory subnet; answers on the other networks of the host are not admitted, and a typed address there is still answered |
| E-P13 | :293 digest line | "...The dedicated port, the dedicated switch and HOST-20 are the host's part of that condition; the acceptance itself is a decision of the user." | ...The dedicated port, the dedicated switch and HOST-20 are the host's part of that condition for the cameras on the camera port. A camera the Core reaches on another network of the host (R-FLEX) is outside that part, and its acceptance is also a decision of the user `[DEP-89-3]`. |
| E-P14 | :297 section 6 Removal | - | unchanged (the HOST-23 rule is still deleted "by its number"; there is one rule) |

Row 113 diff check: only lines 7 (new paragraph after it), 38, 76 (new paragraph after it), 81, 85, 86, 132, 161, 276 and 293 change. Every other line stays byte-identical.

## 5. Firewall script edits (`scripts/host/40-network-firewall.sh`, for row 114)

Only the wording of comments, titles, notes, checks and confirm lines changes. **No `act`, `put_file`, `show_file` or `hp_need` line changes.**

| Id | Where | New text |
|---|---|---|
| S1 | After :7 (header comment) | `# R-FLEX (D10-D12): the camera port is host hygiene, not the Core's only camera path;` and `# the search-answer rule (HOST-23) stays on the camera port only.` |
| S2 | :26 HOST-19 title | `item HOST-19 MANUAL 'The camera port is dedicated (host hygiene): one static private /24 address, no gateway, no name server, no DHCP'` |
| S3 | :84 HOST-23 title | `item HOST-23 AUTO 'Answers to the camera search arrive on the camera port only: datagrams from source port 3702 are admitted there and on no other port'` |
| S3b | New `note` block between :84 and :85 | `note <<'EOF'` / `the search also asks on the other networks of the host (R-FLEX); their answers are not admitted, and a camera there is reached by its typed address (decision D12 U-RF3)` / `EOF` |
| S3c | :85 `act ufw allow in on "$HP_CAMERA_INTERFACE" ...` | **unchanged** |
| S3d | :86-89 check block, added line | `sudo ufw status numbered   -> no other rule names port 3702` |
| S3e | :90 confirm | `confirm '9A/H-12 (whether this rule alone suffices; that a typed address on another network is answered) and 9A/H-13 (answers from a factory subnet through a temporary address); open point 8'` |
| S4 | :92 HOST-24 title | `item HOST-24 NONE 'The services of the Core are not reachable from any network of the host: not on the camera port, not on a temporary address added to it, not on the room network'` |
| S5 | :18-24, :47-71, :73-82, :102-139 | unchanged (HOST-18, HOST-20, HOST-21, HOST-22, HOST-25) |

### 5.1 Test pin `scripts/host/test_host_profile_scripts.sh:234`

- **Stays as is.** Its expected string `would-run: ufw allow in on enp3s0 proto udp from any port 3702` is still printed, because S3c leaves the `act` line unchanged.
- **Addition proposed (row 114), in the same file after :234** (this extends the existing file, as the test-suite consolidation rule asks). It pins U-RF3, so that a later edit cannot widen the rule to every interface without a failing test:

```sh
expect 'one firewall rule is printed, the search-answer rule on the camera port (U-RF3)' \
  [ "$(grep -c 'would-run: ufw allow' "$RUN/out/values.txt")" = 1 ]
```

  Basis: I3 (exactly one `act ufw` today). The item-id checks at :121-135 are untouched (no item added).
- Row 114 checks: the test exits 0, and `shellcheck` is clean on both changed files.

## 6. Installer-note edits (`scripts/host/INSTALLER-NOTE-FIRST-PRODUCTION-BOOT.md`, wording only, for row 113)

| Id | Where | Current (short) | New text |
|---|---|---|---|
| N1 | :235 step 1, step cell | "...the camera port, the firewall, the loopback rule..." | ...the camera port (host hygiene since R-FLEX), the firewall (search answers admitted on the camera port only), the loopback rule... |
| N2 | :240 step 5 ("off the room network") | - | **unchanged.** R-FLEX does not change why the first boot is kept off the room network. The bench's D5 is a recorded deviation, not product text |
| N3 | :246 step 10, step cell, after "Then search and connect the camera in the web console;" | - | insert: `the search asks on every network of the host (R-FLEX), and its answers pass the firewall on the camera port only (HOST-23), so a camera on another network of the host is connected by its typed address;` |
| N4 | :258 note, appended sentences `[Q-R4]` | "The camera search is an active scan only. ... (ruling U9)." | append: Since R-FLEX (decisions D10 to D12 of the bench task) the search and the connection are not tied to the camera port: the Core may reach a device on any network of the host, the room network included, a risk the user accepted (D11). The factory-address scan and the camera address change stay on the one interface the address helper names (`HOST-46`). |
| N5 | :259 note, appended sentence | "The room network cable is plugged in only after step 8 has passed (`PREP-11`)." | append: From then on the room network is also a network on which the Core may search for cameras and connect to them (R-FLEX). |
| N6 | Section 6 (:278 onward), new bullet at the end | (none) | `- Added by R-FLEX, each "to confirm" on a host: the search on every network of the host, with its answers admitted on the camera port only (HOST-23): 9A/H-12; a camera reached by its typed address on another network of the host: 9A/H-12.` |

Out of scope for rows 113 and 114 (no edit; see F96-3): `scripts/hardware-acceptance/HW-ACCEPTANCE-1-FRAME.md:136` (UA-12), `HW-ACCEPTANCE-3-NETWORK-CAMERAS-SESSION.md:76, :84`, `collect-h01.sh:238-268`, `80-helper-state.sh:52`. They stay consistent with the kept rules. Only UA-12 carries the camera-port-only assumption that E-P13 qualifies.

## 7. Affected install rows (02_structured.md rows 11-79, 122-128)

Row N of the table sits at `identification/02_structured.md` line 168+N.

| Row | Affected | How it changes |
|---|---|---|
| 11 | yes | The HOST-19..25 and HOST-46 lines of the applicability matrix take the verdicts of section 3 and cite this file. HOST-46 is N/A on the bench (helper absent, I7). HOST-19 is applied by the NM-profile equivalent (A8) |
| 12 | no (already consistent) | The register already states `<camera-interface>` = `enp4s0` as host hygiene and HOST-23 as camera port only (01_specs_register.md:44, :140) |
| 14 | yes | HOST-23 scope = `allow in on enp4s0 proto udp from any port 3702` and nothing else (U-RF3). SSH allow on `wlp3s0` first (D5). Whether HOST-24's port list gains the console port 5173 is row 14's decision (W4). Cites row 89 for the posture `[DEP-89-1]` |
| 16 | yes | The impact list gains: the Core may dial the room network (D11); answers to the multicast search on wlp3s0 are dropped by design (U-RF3); the digest condition for cameras off the camera port (E-P13) |
| 17 | yes | AC6, AC7 and AC9 map to the exact text of section 8 |
| 18 | yes | Runbook sections for rows 34, 36, 45, 66-72, 124 and 128 use the checks of sections 3 and 8. The HOST-23 check gains "no other rule names port 3702" |
| 20-33 | no | Not network-scope dependent. Row 33 (HOST-20, file C) is unchanged by item E-P5 |
| 34 | yes (label only) | The check list is unchanged: one address on enp4s0, no default route via enp4s0, no DNS or gateway on the profile. Recorded as "HOST-19 equivalent, host hygiene (E-P4)". Deviation A8 is kept. If F96-1 is taken (E-P4b), A8 is no longer a deviation of form |
| 35 | no | HOST-25 unchanged |
| 36 | yes (verification wording) | Rule set in order: SSH allow in on wlp3s0, default deny incoming and routed, HOST-23 on enp4s0 only, enable on the user's yes. Added check: `ufw status numbered` shows exactly one rule naming 3702, with `on enp4s0` |
| 37-44 | no | Not network-scope dependent |
| 45 | yes (outcome wording) | HOST-46 outcome: "N/A, helper absent; `/etc/dems/netalias-interface` must not exist; boot reports `NOT_ASKED` (program-checks.ts:331)". The amended item text (E-P10) does not change the check |
| 46 | yes | Gate G1 judges HOST-19..25 and HOST-46 against the revised matrix of row 11, and AC7 before boot |
| 47 | no | Forwarding `0 0 0` check unchanged |
| 48-57 | no | - |
| 58 | no (expectation stated) | `CAPTURE_HOST_FORWARDING_ON` is still asked (I6). HOST-46 is `NOT_ASKED` (I7). No host-doc change reaches the boot |
| 59-65 | no | - |
| 66-69 | **yes: verification must change** | "search result names the interface it was found on" cannot be met: the answer carries only `interfaceCount`, and no name is added (I9; register NW-S1). New check: "camera listed and connected; the search answer's `interfaceCount` equals the number of eligible host interfaces (expected 2, enp4s0 and wlp3s0; hypothesis until read in row 66); no credential in doc" |
| 70 | yes (label only) | "camera-LAN host-hygiene invariants". Checks unchanged |
| 71 | yes | Checks against AC6 as reworded (section 8) |
| 72 | yes | AC7 unchanged. Exact checks: SSH from the Mac over Wi-Fi succeeds; 4420-4423, 5173, the DB port of the register and 8554-8564 are refused or filtered from Wi-Fi; `ufw status numbered` shows exactly one 3702 rule, `on enp4s0`. 3702 is a source-port rule for answers, not a listening DEMS port |
| 73 | no | - |
| 74 | yes | Verifies AC6, AC7 and AC9 with the section 8 text |
| 75 | yes | The deployed posture (ufw, forwarding) equals verification/06_rflex_security.md (row 117) and E-P3 |
| 76 | yes | Config review: the HOST-23 rule scope, the NM profile against file B (A8 or E-P4b), and the HOST-24 port list |
| 77 | no | - |
| 78 | yes | The deviation register records the D10/D11 effect on HOST-19, 23, 24 and 46 (wording) and keeps A8 |
| 79 | yes | The report states that HOST-19 to HOST-23 are host hygiene under R-FLEX |
| 122 | no | Console on 127.0.0.1:5173. Its HOST-24 coverage belongs to row 14 |
| 123 | no | Watchdog flag, not network docs |
| 124 | yes (dependent) `[Q-R4]` | Default: `interface_name` = enp4s0 and `camera_subnet` = 192.168.100.0/24 stay meaningful only for the scan and set-IP, which need the absent helper. Whether the step is N/A is row 90's decision. This file sets no field |
| 125-127 | no | Audio. They are covered by AC9 (section 8), not by host docs |
| 128 | **yes: verification must change** | "search lists 4 cameras with interface" is replaced by "search lists the 4 cameras; `interfaceCount` equals the row-66 value" (I9) |

Code rows fed directly: 113 (sections 4 and 6) and 114 (section 5).

## 8. Acceptance-criteria text (D12 U-RF4 accepted in principle; exact wording)

| # | Criterion (exact text) | Evidence (exact text) | Basis |
|---|---|---|---|
| AC6 (reworded) | The 4 cameras are connected in the production console. The camera-LAN host-hygiene invariants hold and persist across a reboot: the HOST-19 equivalent as host hygiene (enp4s0 holds exactly one IPv4 address, 192.168.100.254/24; no default route, gateway or name server on enp4s0) and HOST-20 forwarding `0 0 0` (net.ipv4.ip_forward, net.ipv6.conf.all.forwarding, enp4s0 forwarding). Under R-FLEX these are host hygiene, not the Core's only camera path (D10 ruling 2, D11) | console state; `ip -br -4 addr show dev enp4s0`, `ip -4 route show default`, the `nmcli` fields of profile `DEMS Camera LAN`, and `sysctl` output, before and after the final reboot | 01_translated.md AC6; E-P4; install register :44-45, :125 |
| AC7 (unchanged, D12) | ufw is active and admits SSH only on the room network. No DEMS port is reachable from Wi-Fi | `ufw status verbose`, `ss -ltnp` | 01_translated.md AC7; D12 U-RF3. Reading note, not part of the AC: the HOST-23 rule is `on enp4s0`, not on the room network, so "SSH only on the room network" holds as written |
| AC9 (new) | R-FLEX on the host. Audio: the USB mic bound to one DEMS input is shown bound (`boundTo`) and is not offered for a new binding. Re-binding it to another input releases the old binding (`releasedDeviceId` in the answer; the old input audited with change `RELEASED`). After a move to another USB port the binding still recognises the card, with no `AUDIO_CARD_CHANGED` for it. Cameras: the global search reports every eligible host interface searched (`interfaceCount` equals the eligible interfaces, expected 2: enp4s0 and wlp3s0) and lists the 4 cameras. Binding and cameras persist after the final reboot | rows 125-127 (listing, register answer, audit entries), rows 66-69 (search answers), row 128 (after reboot; journal grep for `AUDIO_CARD_CHANGED`) | 02_structured.md:61; register AU-L1, AU-B2, AU-A1, F9. "Input" vs selector line depends on Q-R5, and per-card vs per-input exclusivity on Q-R1 (rows 88/96). Defaults follow the register's recommendations |

## 9. Dependencies on row 89 (parallel) and on row 96

| Id | Depends on | What this file assumes (default) | Effect if row 89 / 96 differs |
|---|---|---|---|
| DEP-89-1 | Row 89 residual guard list | Kept: point 1 (literal, private, host-own, edges), point 3 (port list), point 4 (size, spacing), as proposed at 02_structured.md:485 | E-P3's list of kept guards is edited to match, at row 95 |
| DEP-89-2 | Row 89 host-level egress guard (e.g. an nft owner match limiting `dems-core` outbound to chosen interfaces) | None proposed. D11 accepted dialling on the office LAN | A new rule is either a HOST-25 extension or a new item. Adding an item is MAJOR (it changes the item count pinned by the test at :128-133) |
| DEP-89-3 | Row 89 statement on digest/unencrypted cameras off the camera port | The limit is stated (E-P13). Acceptance is the user's | E-P13 wording follows row 89 |
| DEP-89-4 | Row 89/90 source rule `NO_SOURCE_INTERFACE` (register NW-R1): off-link targets refused | On-link only, so "every network the host is attached to" in E-P1, E-P3 and N4 is literal | If routed targets are allowed, E-P1, E-P3 and N4 read "any private address the host can route to", and R3 gains weight |
| Q-R4 | Row 96: commissioning scan and set-IP stay bound | Bound (register recommendation) | If global: E-P10, E-P11 and N4's last sentence are rewritten, and HOST-46 needs a new reason (CF-2/CF-3 provisional) |

## 10. For row 96

| Id | Question | Options | Recommendation | Consequence |
|---|---|---|---|---|
| F96-1 | Should HOST-19 accept a network-manager equivalent of file B (E-P4b)? | (a) yes, product text; (b) no, keep netplan only and leave A8 as a bench deviation | (a): the item's two checks are the invariant, and the file is only one way to produce it | (a) A8 stops being a deviation of form; (b) no change |
| F96-2 | Digest over unencrypted transport for a camera reached off the camera port | (a) state the limit (E-P13), user accepts per installation; (b) refuse stored cameras off the camera port (reintroduces part of point 2) | (a): matches "Global penuh" | (b) conflicts with D10 ruling 2 |
| F96-3 | Hardware-acceptance documents (UA-12, HW-3 :76/:84, collect-h01.sh) | (a) leave for a later task; (b) add a row beside 113 | (a): they stay consistent with the kept rules; only UA-12 needs the E-P13 qualifier | (b) adds one S row (MINOR) |

## 11. Risks

| Risk | Trigger | Mitigation |
|---|---|---|
| An installer reads HOST-19 to HOST-23 as the Core's camera guard | Old wording kept | E-P1, E-P3 and E-P4 state host hygiene |
| Someone widens HOST-23 to "every interface" so that Wi-Fi cameras answer the multicast search | A camera on Wi-Fi is not found | The section 5.1 pin; the HOST-23 text names the typed address as the path; AC7 unchanged |
| A typed address on Wi-Fi gets no answer under default deny | The conntrack hypothesis (section 3, HOST-23) is wrong | 9A/H-12 / row 72 records it. Fallback is a user decision (U-RF3 option b), not a silent rule change |
| Rows 66-69 and 128 fail on an impossible check (interface name) | Verification text not updated | Section 7. Row 19 adopts the new check |

## 12. Gaps

- The conntrack behaviour for a unicast probe answer under ufw default deny was not tested. It is a hypothesis, settled by 9A/H-12 or row 72.
- The eligible-interface count of 2 on .73 is inferred from I8 and I10 (enp4s0, wlp3s0; lo internal). Not read on the host in this row.
- `HW-ACCEPTANCE-*` texts were grepped, not read in full.
- Row 89 output (masterplan/01_specs_rflex_security.md) did not exist when this file was written. The defaults of section 9 apply.

---
*Generated: 2026-10-22*
*Last Updated: 2026-10-22*
