---
task: 2026-10-12_input_av_core_adapter_plan
row: 104
milestone: M10 / WP-19a
agent: coder-execution
date: 2026-10-12
tier: T3
status: complete on doubles; UNPROVEN ON LINUX
closes_requirements: S13-08 (as built, on doubles); S13-16 point 1; the row-104 half of S13-09 / C19 (PF-1 to PF-6, PF-10)
---

# Row 104 - the alias helper as a file for the user to install

**Plain statement.** The helper was written and its argument handling and refusals were tested on this Mac with its two tools replaced by a recording double. It was never installed, never run with privilege, and no host address was changed; no `sudo`, `ip`, `ifconfig` or `arping` was started. **Nothing here is proven on Linux.** The real tools, the Linux numbers of the peer-credential option, the socket unit and the service unit are proven only by hardware checks `9A/H-05` (the helper as installed, its refusals through the socket), `9A/H-06` (alias lifetime and conflict, experiment E-13, hypothesis H-S) and `9A/H-25` (which `arping`, at which path), as blueprint section 12 names them. Until `9A/H-05` and `H-06` have passed the function is not used on an installation.

## 1. What was built

All new, in `scripts/host/netalias/`. No existing file was changed. Nothing in the Core imports or starts any of it (the caller is row 105).

| File | Kind | Content |
|---|---|---|
| `dems-core-netalias` | DELIVERED (the user installs it as `/usr/local/sbin/dems-core-netalias`, root, 0755) | the helper, 617 lines, Python 3 standard library |
| `dems-core-netalias.socket` | DELIVERED (`/etc/systemd/system/`, root, 0644) | the local socket: `/run/dems-core-netalias/socket`, root, group `dems-netalias`, 0660, one instance per connection, at most 1 at a time |
| `dems-core-netalias@.service` | DELIVERED (`/etc/systemd/system/`, root, 0644) | starts the helper as root WITHOUT ARGUMENTS, connection as standard input and output, standard error to the journal, capabilities bounded to network administration and raw sockets |
| `SHA256SUMS` | record | the three hashes below |
| `make_test_copy.py` | build step | makes the test copy: the delivered text with the values of its constants block replaced, nothing else |
| `test_dems_core_netalias.py` | tests | 58 tests, every helper run against the double |

**Where and why (DRIVER DECISION D-1).** `scripts/host/netalias/`: beside `scripts/host/HOST-PROFILE-UBUNTU-24.04.md`, whose items HOST-43 to HOST-47 describe the installed state of exactly these files; a tracked folder (not the git-ignored `/release/` or a `build/` folder); a folder of its own so that the hash list covers a closed set.

**Hashes (SHA-256) of the delivered files**, for row 127 to print:

```
62c0b7260a743224de455892ddb12c7cee8ce0c1907c1e9f89291ff35c2ee5fb  dems-core-netalias
8623c1cdc530308762c154ad5ad17c73ce50ee6a6e5854952710028d45ffdbcb  dems-core-netalias.socket
7e40f25e21a187e5f05942cb87926131f182718f466d40704784540ec38dd60a  dems-core-netalias@.service
```

Any edit of a delivered file changes its hash; `SHA256SUMS`, this record and row 127's chapter then move together (the hash test fails until they do: it failed once in this row for that reason and was corrected).

## 2. Language: Python 3, standard library only

| Reason | Detail |
|---|---|
| The caller must be read from the connection (C19, PF-5; risk row 1 of `decisions/103`, hypothesis HP-1) | A POSIX shell cannot read the kernel's peer credential of its standard input; it would have to trust a value the service manager may or may not put in the instance name (HP-1, unproven). Python reads it with `getsockopt` on descriptor 0 |
| S13-08 (7) "evaluates no input" | No shell exists in the path: no word splitting, no globbing, no expansion. Tools are started from an argument list with `shell=False`, one call site |
| No extra package (U12 A2 host) | Ubuntu 24.04 ships `/usr/bin/python3`; only standard-library modules are imported. HYPOTHESIS until `9A/H-05`: it is present on the acceptance host as installed |
| S13-16 (1) "reads no environment variable" | The file never reads its environment; it is started with `-I -S -B` (isolated, no site packages, no byte-code files), in the unit's `ExecStart` and in its first line |

## 3. The call (decision C19, `decisions/103` PF-3 to PF-5)

- Request: one line on standard input, at most 64 bytes with its line feed, printable ASCII, single spaces: `add <a.b.c.d>/24 <minutes>` or `del <a.b.c.d>/24`. The interface is never in the request.
- Answer: one line `<code> <NAME>`; the same code is the exit status. Closed set of 36 names (table `CODES` of the file); each refusal has its own code.
- Caller: the peer of standard input must be a local stream socket whose kernel-recorded user is THE ONE member of group `dems-netalias` (read from `/etc/group` and `/etc/passwd`, root-owned files only). Anybody else, root included, is refused through the socket.
- Journal: exactly one line per call on standard error (the unit sends it to the journal): `dems-core-netalias: caller_uid=<n|-> verb=<add|del|check|-> address=<a.b.c.d/24|-> result=<NAME> code=<n>`. The address is printed only after it passed every check of its form; nothing else of the caller is ever printed.
- `check`: the one command-line form, for root during installation (5.4 step 5, PF-10). It reads the same files and the route table, changes nothing, and cannot be reached through the socket because the unit starts the file without arguments.

## 4. The nine bounds of S13-08, each with its code and its test

Tests are in `test_dems_core_netalias.py`; class names in the first column of the test cell. Every refusal test also asserts the exact list of argument vectors the double received (for a refused request: none, or the read-only reads named).

| # | Bound | In the helper | Refusal code(s) | Tests |
|---|---|---|---|---|
| 1 | verb and one address; interface from the root-owned file; name pattern (first character alphanumeric); in `/sys/class/net`; not the default-route interface | `configured_interface`, `installation`, `default_route_interfaces` | `INTERFACE_FILE_UNSAFE` 31, `INTERFACE_NAME_INVALID` 32, `INTERFACE_ABSENT` 33, `INTERFACE_HAS_DEFAULT_ROUTE` 34 | `Bound1Interface`: `test_interface_not_the_configured_one_cannot_be_named_by_the_caller`, `test_path_traversal_and_other_bad_names_in_the_interface_file` (19 names), `test_interface_file_writable_by_group_or_others_a_link_or_missing`, `..._in_a_folder_others_can_write`, `..._too_large`, `test_files_not_owned_by_the_trusted_owner_are_not_believed`, `test_interface_absent_from_the_kernel_list`, `test_interface_of_the_default_route_is_refused_for_both_verbs`, `test_route_table_that_cannot_be_read` |
| 2 | RFC 1918, `/24` only, host part 1 to 254 | `checked_address`, `parse_quad` | `ADDRESS_MALFORMED` 20, `PREFIX_NOT_24` 21, `ADDRESS_LOOPBACK` 22, `ADDRESS_LINK_LOCAL` 23, `ADDRESS_MULTICAST` 24, `ADDRESS_NOT_PRIVATE` 25, `HOST_PART_OUT_OF_RANGE` 26 | `Bound2Address`: `test_address_not_private_loopback_link_local_multicast_and_octet_out_of_range` (27 addresses, both verbs), `test_prefix_not_24` (9 prefixes), `test_malformed_address` (24 forms); accepted ranges: `TheWork.test_the_three_private_ranges_and_both_ends_of_the_host_part_are_accepted` |
| 3 | no `add` when another interface holds an address in that `/24`; a limit of marked addresses | `add`, `overlaps_slash24`, `MAX_MARKED = 1` | `OTHER_INTERFACE_HOLDS_SUBNET` 40, `ALIAS_LIMIT_REACHED` 41 (also `ADDRESS_ALREADY_PRESENT` 42, `CAMERA_INTERFACE_HOLDS_SUBNET` 43) | `Bound3OtherInterfaceAndLimit`: `test_another_interface_holds_an_address_in_that_24`, `..._a_wider_or_narrower_network_over_that_24`, `test_a_second_alias_while_one_is_active_is_refused`, `test_a_third_alias_is_refused`, `test_the_limit_is_one_in_the_delivered_file`, `test_a_mark_whose_address_the_kernel_expired_does_not_count`, `test_an_address_the_host_already_holds_and_a_subnet_the_camera_port_already_has` |
| 4 | the conflict check always runs; tool missing = refusal | `installation(need_conflict_tool=True)`, the `arping -D` call before every add | `CONFLICT_TOOL_MISSING` 37, `ADDRESS_IN_USE` 44, `CONFLICT_CHECK_FAILED` 51 | `Bound4ConflictCheck`: `test_conflict_tool_missing_not_executable_or_writable_by_others`, `test_an_address_another_device_answers_for_is_not_added`, `test_a_conflict_check_that_fails_is_not_a_free_address`; order: `TheWork.test_add_runs_route_read_address_read_conflict_check_then_add` |
| 5 | adds marked as its own (root-owned state file under `/run`), lifetime 5 to 480 minutes | `write_mark`, `valid_lft`/`preferred_lft` in the add vector | `LIFETIME_OUT_OF_RANGE` 27, `STATE_DIR_UNSAFE` 35, `MARK_WRITE_FAILED` 54, `ADD_FAILED` 52 | `Bound5MarkAndLifetime`: `test_the_mark_and_the_lifetime_of_the_shortest_and_the_longest_request`, `test_lifetime_out_of_range_or_not_a_plain_number` (15 values), `test_an_add_the_tool_refuses_leaves_no_mark`, `test_marks_folder_others_can_write_or_with_a_foreign_entry` |
| 6 | `del` removes only an address it marked | `delete` | `NOT_MARKED` 45, `DEL_FAILED` 53 | `Bound6DelOnlyWhatWasMarked`: `test_the_camera_ports_own_address_and_any_unmarked_address_are_never_removed`, `test_a_marked_address_that_is_already_gone_is_done_without_a_removal`, `test_a_removal_the_tool_refuses_keeps_the_mark`, `test_del_needs_no_conflict_tool` |
| 7 | absolute tool paths, own search path, nothing from the environment, no evaluation | constants block; `run_tool` (the one place a process is started; environment of two fixed entries, working folder `/`) | `TOOL_MISSING` 36 | `Bound7NoInjectionPoint`: `test_a_hostile_environment_changes_nothing` (18 variables, decoy tools on the search path: 0 calls), `test_shell_metacharacters_are_never_evaluated` (21 requests), `test_option_injection_with_a_leading_dash` (14), `test_path_traversal_in_the_request` (7), `test_the_delivered_file_holds_absolute_constants_and_no_way_around_them`, `test_the_delivered_files_have_the_recorded_hashes`, `test_the_test_copy_differs_from_the_delivered_file_in_the_constants_only`, `test_the_build_step_writes_no_copy_beside_the_delivered_file_and_takes_no_other_name`, `test_the_unit_files_start_the_helper_without_arguments_as_the_only_command`; `Bound4ConflictCheck.test_ip_tool_missing` |
| 8 | one journal line per call: calling user, verb, address, result | `main` | - | asserted on EVERY helper run of the file (`Bench.run`: standard error is exactly one line of the fixed form); `Bound8And9JournalAndCodes.test_one_journal_line_for_a_done_call_names_user_verb_address_result` |
| 9 | fixed codes; no text of the caller in a message | `CODES`, `main`, `Call` | all | asserted on every run (answer equals `<code> <NAME>`, exit status equals the code, name in the closed set); `test_the_codes_are_distinct`, `test_no_text_of_the_caller_reaches_the_answer_or_the_journal` (9 requests) |

**The nine refusals of the verification cell** ("refusals 9 of 9": the five of plan phase 10 and the four S13-08 adds): another interface (`test_interface_not_the_configured_one...`), a public address and a prefix other than `/24` (`Bound2Address`), an address in use (`test_an_address_another_device_answers_for...`), the conflict tool missing (`test_conflict_tool_missing...`), `del` of an unmarked address, an overlap with another interface, the default-route interface, a third alias (and already the second): 9 of 9 pass. **One journal line per call:** asserted on every run. **Hash test:** passes; hashes in section 1.

**Added by the form of C19** (`TheFormOfTheCall`): any argument refused (`ARGUMENTS` 10, 10 forms); malformed input (`REQUEST_MALFORMED` 14, 16 forms, plus no line end and an empty connection); a second line (14, 5 forms); oversized input (`REQUEST_TOO_LONG` 13: 65, 66, 4101 and 200000 bytes; 64 bytes are read as a request); unknown verbs, the `listen` verb of input-av among them (`VERB_UNKNOWN` 15); a peer that is not the service user (`PEER_NOT_SERVICE_USER` 12); standard input that is not a local socket (`PEER_UNKNOWN` 11); a group with two, no or an unknown member, or a member that is root (`SERVICE_USER_UNRESOLVED` 30); a silent connection (`REQUEST_TIMEOUT` 16, after 5 s); `check` reads and changes nothing.

## 5. The doubles, and what the tests really exercise

- **The double** is one small program written by the test into a temporary folder as `ip` and as `arping`. It appends the argument vector, the environment and the working folder it received to `calls.jsonl` and answers from `plan.json`; an unplanned call answers 97 and is recorded. A second pair of the same double sits in a `decoy` folder that the hostile-environment test puts on the search path: it must record 0 calls.
- **The test copy** is made by `make_test_copy.py` in that temporary folder (outside the repository; the step refuses a target beside the delivered file). It replaces 11 constants: the two tool paths, the interface file, the kernel's interface list, the marks folder, the two account files, the trusted owner (this Mac's test user in place of root), and the three numbers of the peer-credential option (macOS local-socket numbers in place of the Linux ones). One test asserts the copy differs from the delivered file in exactly those 11 lines.
- **The caller is real in the tests:** standard input is one end of a socket pair and the copy reads the kernel's peer credential of it.
- Exact vectors asserted for a done `add` with 30 minutes on `eth1`:
  `ip -json -4 route show default`; `ip -json -4 addr show`; `arping -D -q -c 2 -w 3 -I eth1 192.168.1.250`; `ip addr add 192.168.1.250/24 dev eth1 valid_lft 1800 preferred_lft 1800`. For `del`: the two reads, then `ip addr del 192.168.1.250/24 dev eth1`.

## 6. Checks run

| Check | Command (repository root) | Result |
|---|---|---|
| Helper tests, first run | `python3 -I -B scripts/host/netalias/test_dems_core_netalias.py` | `Ran 58 tests in 23.520s` `FAILED (failures=1)`: the hash test, after the delivered file had been edited (non-ASCII comment rules removed) and before `SHA256SUMS` followed |
| Helper tests, second run (after the failure) | same | `Ran 58 tests in 20.324s` `OK` |
| Static rules over `scripts/` | `node --test scripts/pg/static.test.mjs` | `tests 6` `pass 6` `fail 0` |
| Leftovers | `ls scripts/host/netalias`; temporary folder | 6 files, no byte-code folder; 0 `netalias-*` folders left in the temporary directory |

No TypeScript file was written, so no workspace typecheck applies. No full suite was run. Python on this Mac: 3.14.7; the helper uses nothing newer than 3.8 by reading, NOT RUN on 3.12 (Ubuntu 24.04).

## 7. What stays unproven (to the hardware package)

| # | Unproven | Check |
|---|---|---|
| 1 | Everything on Linux: the delivered file itself was never executed with its real constants | `9A/H-05` |
| 2 | The peer credential with the Linux numbers (level 1, option 17, three integers); on this Mac the copy used the macOS numbers | `9A/H-05` (nine refusals sent through the socket as the service user; a foreign account refused) |
| 3 | The two unit files: accepted by the service manager, the socket node's owner, group and mode, one instance per connection, the marks folder created and kept, every hardening line compatible with `ip` and `arping` (HYPOTHESES; `systemd-analyze verify` is step 4 of the procedure) | `9A/H-05` |
| 4 | `/usr/sbin/ip` and `/usr/bin/arping` exist at those paths, root-owned; `ip -json` output has the fields read (`ifname`, `addr_info[].family/local/prefixlen`, `dev`, `nexthops[].dev`); iputils `arping -D` answers 0 for a free address and 1 for one in use | `9A/H-25`, `9A/H-06` |
| 5 | Hypothesis H-S: the kernel removes the address after `valid_lft` with the Core killed | `9A/H-06` (E-13) |
| 6 | The helper answers from inside the Core's unit with `NoNewPrivileges=yes` and an empty capability set | `9A/H-06` (V-4 of `decisions/103`) |
| 7 | Owner checks with a real foreign owner: on this Mac every fixture has one owner, so only "not the trusted owner at all" and the mode bits are exercised | `9A/H-05` |

## 8. Not built

- **S13-10 (a), the removal timer of the service manager.** It is required only if H-S fails at `9A/H-06`. Built today: the kernel lifetime. If E-13 fails, the helper needs the transient timer and its hash changes.
- No client in the Core (row 105), no boot check (row 81), no installation procedure (row 127), no group, no interface file.

## 9. Driver decisions (for the controller to confirm)

| # | Decision | Reason / alternative |
|---|---|---|
| D-1 | Folder `scripts/host/netalias/` | section 1 |
| D-2 | The two unit files are delivered here, beside the helper | `decisions/103` 6.1 effect (d) and PF-6 put them in row 104's hash; HOST-44 says "the two unit files of the helper's delivery". The launch brief said they belong to the host profile or row 105 "unless the row's cells say otherwise"; the cell is silent. If the controller rules otherwise the two files and two hash lines move, the helper does not change |
| D-3 | `add` carries the lifetime: `add <address>/24 <minutes>` | PF-3 names verb and address only; S13-08 (5) and DR-3 need the configured minutes at the helper. Out of range is refused, not clamped. Request in `file_requests.md` |
| D-4 | Limit of marked addresses: 1 | S13-08 (3) says 2; the brief and the table of row 99 say one alias. 1 is the narrower bound; the third-alias refusal of the review holds a fortiori. One constant (`MAX_MARKED`) |
| D-5 | The caller is the ONE member of group `dems-netalias`, resolved from `/etc/group` and `/etc/passwd` only | No per-host constant in the hashed file; HOST-43 already requires exactly one member. A service user from a network directory is refused |
| D-6 | Names: helper `/usr/local/sbin/dems-core-netalias`, units `dems-core-netalias.socket` / `@.service`, group `dems-netalias`, interface file `/etc/dems/netalias-interface`, marks `/run/dems-core-netalias/marks/` | The input-av path `/usr/local/sbin/dems-netalias` must be absent by HOST-02; a different name keeps that check true after installation |
| D-7 | The mark is a root-owned file under `/run`, not an address label | A label is limited to 15 characters with the interface name inside it. The folder is world-readable, so row 106's sweep and step 9 of the procedure can list it |
| D-8 | The default-route refusal reads the IPv4 table only | It is what HOST-46 checks; the address added is IPv4 |
| D-9 | Two refusals beyond the nine: an address the host already holds (42) and a `/24` the camera port already has (43) | Neither needs an alias; both are conservative |
| D-10 | A `check` argument for root (PF-10, 5.4 step 5) | Read-only; not reachable through the socket |
| D-11 | Tests in Python `unittest`, not in the repository's Node runner | The caller must be a real socket peer, which a socket pair gives without binding a path; optional npm script requested |
| D-12 | An `add` whose tool did not answer in time keeps its mark | The address may exist; `del` can then remove it, and the next `add` drops a mark without an address |

---
*Generated: 2026-10-12 23:35 WIB*
