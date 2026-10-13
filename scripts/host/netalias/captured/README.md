# Captured tool texts for the alias helper's parsers

Real output of the three tools whose text `dems-core-netalias` reads, captured on 2026-10-13 by task 4 row H3 in the Ubuntu 24.04 container of this repository (image `b914f7078f7b`, arm64, `iputils-arping 3:20240117-1ubuntu0.1`, `iproute2 6.1.0-1ubuntu6.4`, the tools run with `LC_ALL=C`). They are data for the next change of the helper's parsers: byte for byte the tool's standard output, nothing edited. No test reads them yet.

**A container capture, not a host capture.** The kernel is the development Mac's virtual machine, the interfaces are virtual (veth, dummy), the architecture is arm64. What a physical port of the production host prints is hardware check `9A/H-25`, `9A/H-05`, `9A/H-06`.

Record with every command and the helper's verdict per text: `docs/2026-10-12_input_av_core_adapter_plan/test/h3_helper_parser_captures.md`. Helper tested: SHA-256 `1e758a2407f862ebfc461768f11c491ff43f3e89fcbf9d9a2da45763c7d015b1`.

## `arping/` - standard output of `<program> -D -c 2 -w 3 -I <interface> <address>`

| File | Program | Interface, address | Exit status | Standard error | `conflict_verdict` of that hash |
|---|---|---|---|---|---|
| `iputils_free_other_subnet.stdout` | `/usr/bin/arping` (iputils) | `eth0`, `192.168.1.250` | 0 | empty | `FREE` |
| `iputils_free_same_subnet.stdout` | iputils | `eth0`, `172.31.203.222` | 0 | empty | `FREE` |
| `iputils_in_use.stdout` | iputils | `eth0`, `172.31.203.50` (a second container) | 1 | empty | `ADDRESS_IN_USE` |
| `iputils_loopback_not_arpable.stdout` | iputils | `lo`, `192.0.2.1` | 0 | empty | `CONFLICT_RESULT_UNKNOWN` (55) |
| `iputils_noarp_not_arpable.stdout` | iputils | `h3na` (veth, `arp off`), `203.0.113.77` | 0 | empty | `CONFLICT_RESULT_UNKNOWN` (55) |
| `iputils_interface_down.stdout` | iputils | `h3dn` (veth, down), `192.0.2.77` | 2 | empty | `CONFLICT_CHECK_FAILED` (51) |
| `iputils_no_carrier_prints_free.stdout` | iputils | `h3nc` (veth up, its peer down: no carrier), `198.51.100.77` | **0** | empty | **`FREE`** - the text and the status of a free address although nobody could be asked; only the flag check (no `LOWER_UP` = 47) stops this case |
| `iputils_no_such_interface.stdout` (0 bytes) | iputils | `h3none`, `192.0.2.1` | 2 | `/usr/bin/arping: Device h3none not available.` | `CONFLICT_CHECK_FAILED` (51) |
| `other_program_free.stdout` | `/usr/sbin/arping` (package `arping` 2.24) | `eth0`, `172.31.203.223` | **1** | empty | `CONFLICT_RESULT_UNKNOWN` (55) |
| `other_program_in_use.stdout` | package `arping` 2.24 | `eth0`, `172.31.203.50` | **0** | empty | `CONFLICT_RESULT_UNKNOWN` (55) |

The other program's exit status is the reverse of the expected program's: 0 when the address answered, 1 when nobody did.

## `ip/` - standard output of `/usr/sbin/ip -json -4 addr show` and `... route show default`

| File | State |
|---|---|
| `addr_eth0_and_lo.json` | the container's `eth0` (`BROADCAST,MULTICAST,UP,LOWER_UP`) and `lo` (`LOOPBACK,UP,LOWER_UP`) |
| `addr_made_interfaces.json` | plus `h3dn` down (`BROADCAST,MULTICAST,M-DOWN`), `h3nc` without carrier (`NO-CARRIER,BROADCAST,MULTICAST,UP,M-DOWN`), `h3na` (`BROADCAST,MULTICAST,NOARP,UP,LOWER_UP`; one address with `valid_life_time` 300 and `"dynamic":true`, one with 4294967295), `h3dm` dummy (`BROADCAST,NOARP,UP,LOWER_UP`), `h3up` (`BROADCAST,MULTICAST,UP,LOWER_UP`) |
| `addr_eth0_down.json` | the same after `ip link set eth0 down`: `eth0` is `BROADCAST,MULTICAST` |
| `route_default_none.json` | `[]` (an internal network has no default route) |

## `dpkg/` - the package manager's records

| File | What |
|---|---|
| `iputils-arping.list`, `iputils-arping.md5sums` | `/var/lib/dpkg/info/` of the expected package (both mode 0644, owner 0:0; no architecture suffix in the names) |
| `dpkg_S_usr_bin_arping.txt` | `dpkg -S /usr/bin/arping` |
| `ls_ln_dpkg_info.txt` | `ls -ln` of the package's files in `/var/lib/dpkg/info` and of the folder |
| `other_package_arping.list`, `other_package_arping.md5sums` | the same two records of the OTHER package (`arping` 2.24-1build2), installed after the expected one was removed: its program is `/usr/sbin/arping`. The two packages conflict in both directions; `dpkg` installs only one of them |
