---
task_id: 2026-10-12_input_av_core_adapter_plan
task_slug: input_av_core_adapter_plan
row: H3 (follow-up of row H2, decision C94; cautions R119-01 / R119-02)
date: 2026-10-13
agent: test-expert (agent H3)
tier: T2
status: complete - the three text forms captured in the container; 0 mismatches with the parsers of the tested hash; a container result, not a host result
---

# Row H3 - the alias helper's three text forms, captured and compared

**Plain statement.** Row H2 wrote three parsers from recollection (`implementation/h2_helper_r119_fixes.md` section 5, hypotheses 1 to 3). Each fails closed, so a wrong form would make the helper refuse every `add` on a real host. I captured the real forms in the Ubuntu 24.04 container of this repository and fed them to the helper's OWN functions. **All three forms are as the parsers expect: 0 mismatches. A correct installation is NOT refused by the helper as it stands - in this container.** No file of the helper was changed.

EVERY RESULT BELOW IS A CONTAINER RESULT: Ubuntu 24.04.5 user space, arm64, on the kernel of this Mac's virtual machine, virtual interfaces (veth, dummy), no service manager. What it does not settle is in section 7.

## 1. What was tested, and how

| Item | Value | Source |
|---|---|---|
| Helper | `scripts/host/netalias/dems-core-netalias`, SHA-256 `1e758a2407f862ebfc461768f11c491ff43f3e89fcbf9d9a2da45763c7d015b1` | `shasum -a 256` on this Mac before and after the row; checked again INSIDE each container by the driver, which stops on another hash |
| Image | `dems/capture-linux-check:ubuntu-24.04-ffmpeg-9.0.2`, identifier `b914f7078f7b` (rows 141 / 79) | `docker images` |
| Packages already in the image | `iputils-arping 3:20240117-1ubuntu0.1`, `iproute2 6.1.0-1ubuntu6.4` - nothing had to be added for the expected installation | `dpkg-query -W` in the derived image's build |
| Derived image (mine, removed at the end) | `dems/h3-arping-debs:tmp`: the base plus the package FILES of the other program, DOWNLOADED AND NOT INSTALLED (`apt-get install --download-only ... arping` into `/opt/h3/debs`: `arping_2.24-1build2_arm64.deb` and six library packages) | `.cache/task4-rowh3/ctx/Dockerfile` |
| How the helper ran | NOT installed, NOT a service, NOT a daemon, never through its `main()`. The driver `.cache/task4-rowh3/h3.py` reads the delivered file (mounted read-only), checks its hash, executes its text WITHOUT the last line `main()` and calls its functions with the delivered constants: `_safe_tool`, `_safe_directory`, `_safe_regular_file`, `_expected_conflict_tool`, `host_state`, `default_route_interfaces`, `refuse_unless_askable`, `run_tool`, `conflict_verdict`. In the container the delivered paths are the real ones (`/usr/bin/arping`, `/usr/sbin/ip`, `/var/lib/dpkg/info`), so no test copy and no double was needed | `h3.py` |
| Not called | `add`, `delete`, `installation` as a whole (they need the interface file, the service group and the marks folder, which were not created), `write_mark`, the socket path. No address was added by the helper |  |

Every arping case was run three times: twice by the driver with standard output and standard error apart (the texts quoted below), once by the helper's own `run_tool` (standard error discarded, `LC_ALL=C`, as in production). The three runs agreed in every case.

## 2. Containers, network, capabilities

| Container | Network | Capabilities | Used for |
|---|---|---|---|
| `dems-h3-pkg`, `dems-h3-pkg2` | `--network none` | the runtime's default set (dpkg needs `CHOWN`, `FOWNER`, `DAC_OVERRIDE` to install and remove) | the package states of section 3 |
| `dems-h3-c` | `dems-h3-net` | `--cap-drop ALL` (none) | the neighbour that holds `172.31.203.50`; it runs `sleep` |
| `dems-h3-a` | `dems-h3-net` | `--cap-drop ALL --cap-add NET_RAW` - **NET_RAW only** (`CapEff 0000000000002000`): the raw socket of `arping` | section 5, the container's own `eth0` and `lo` |
| `dems-h3-b` | `dems-h3-net` | `--cap-drop ALL --cap-add NET_RAW --cap-add NET_ADMIN` (`CapEff 0000000000003000`). **NET_ADMIN was needed, in this ONE container**, to make the veth and dummy interfaces, give them addresses, set `arp off`, and set `eth0` down; NET_RAW because `arping` is run on those interfaces | sections 4 and 5, the made interfaces |
| `dems-h3-e` | `dems-h3-net` | the runtime's default set (dpkg, and NET_RAW which that set contains) | the OTHER program installed in the place of the expected one |
| `dems-h3-u` | `dems-h3-net` | `--cap-drop ALL --cap-add NET_RAW --cap-add NET_ADMIN --security-opt no-new-privileges` on the BASE image: the two capabilities of the unit's `CapabilityBoundingSet` and its `NoNewPrivileges=yes` (`NoNewPrivs: 1`) | section 6 |

`dems-h3-net` = `docker network create --internal --subnet 172.31.203.0/24`: a user-defined bridge inside the virtual machine with NO route out. No `--privileged`, no `--network host`. Nothing on the Mac's network was changed: every `ip link` / `ip addr` command ran inside container B on that container's own network namespace. Every container and the network carried the label `dems.agent=h3`.

## 3. Form 1 - the package manager's records, and what `/usr/bin/arping` IS

### 3.1 The correct installation (state 1; image as built)

```
$ dpkg-query -W -f '${Package} ${Version} ${Architecture} ${db:Status-Abbrev}\n' iputils-arping arping
arping   un
iputils-arping 3:20240117-1ubuntu0.1 arm64 ii

$ dpkg -L iputils-arping                      (identical to: cat /var/lib/dpkg/info/iputils-arping.list)
/.
/usr
/usr/bin
/usr/bin/arping
/usr/share
/usr/share/doc
/usr/share/doc/iputils-arping
/usr/share/doc/iputils-arping/changelog.Debian.gz
/usr/share/doc/iputils-arping/copyright
/usr/share/man
/usr/share/man/man8
/usr/share/man/man8/arping.8.gz

$ cat /var/lib/dpkg/info/iputils-arping.md5sums
4e42a0d8a1cfd199153cb067545913f6  usr/bin/arping
bd019104b5aed64f2002e5c0f5eb3300  usr/share/doc/iputils-arping/changelog.Debian.gz
f7c8a10dc0c983c04ad45cd63623971a  usr/share/doc/iputils-arping/copyright
770094e2b7916f88092e79409ee589f4  usr/share/man/man8/arping.8.gz

$ dpkg -S /usr/bin/arping
iputils-arping: /usr/bin/arping
$ dpkg -S /usr/sbin/arping                     exit 1
dpkg-query: no path found matching pattern /usr/sbin/arping

$ ls -ln /var/lib/dpkg/info | grep -i arping; ls -lnd /var/lib/dpkg/info
-rw-r--r-- 1 0 0    246 Oct 13 01:53 iputils-arping.list
-rw-r--r-- 1 0 0    270 Jul 24  2025 iputils-arping.md5sums
-rwxr-xr-x 1 0 0    278 Jul 24  2025 iputils-arping.postinst
drwxr-xr-x 1 0 0 4096 Oct 13 07:25 /var/lib/dpkg/info

$ ls -ln /usr/bin/arping /bin/arping; ls -lnd /bin /sbin
-rwxr-xr-x 1 0 0 67512 Jul 24  2025 /usr/bin/arping
-rwxr-xr-x 1 0 0 67512 Jul 24  2025 /bin/arping          (the same file: /bin -> usr/bin)
lrwxrwxrwx 1 0 0    7 Apr 22  2024 /bin -> usr/bin
lrwxrwxrwx 1 0 0    8 Apr 22  2024 /sbin -> usr/sbin
$ md5sum /usr/bin/arping
4e42a0d8a1cfd199153cb067545913f6  /usr/bin/arping
$ getcap /usr/bin/arping
/usr/bin/arping cap_net_raw=ep
$ /usr/bin/arping -V
arping from iputils 20240117
libcap: yes, IDN: yes, NLS: no, error.h: yes, getrandom(): yes, __fpending(): yes
$ update-alternatives --query arping           exit 2
update-alternatives: error: no alternatives for arping
$ dpkg-divert --list | grep -i arp             no line (19 diversions in the image, none of them names arping)
```

Against hypothesis 3 of row H2:

| The parser expects (`_expected_conflict_tool`, helper lines 265-278) | Captured | Agrees |
|---|---|---|
| the two records are named `iputils-arping.list` / `iputils-arping.md5sums`, no architecture suffix | exactly those names | yes |
| both are regular files of owner 0, not writable by group or others; the folder likewise | `-rw-r--r-- 0 0`, `drwxr-xr-x 0 0` | yes |
| the list holds the line `/usr/bin/arping` | line 4 of 12 | yes |
| the checksum record holds exactly one line `<32 hex>` + two spaces + `usr/bin/arping` | line 1 of 4, lower-case hexadecimal, two spaces | yes |
| that checksum is the MD5 of the file at the path | `4e42a0d8...5913f6` both sides | yes |

**Helper's verdict, state 1:** `_safe_tool(/usr/sbin/ip)` True, `_safe_tool(/usr/bin/arping)` True, `_safe_directory` True, both `_safe_regular_file` True, `_expected_conflict_tool()` **True** - the program check passes.

Beside it, for `ip` (not a parser of row H2, but the same check reads it): `/usr/sbin/ip` is a symbolic link to `/bin/ip`, the file is `/usr/bin/ip` (`-rwxr-xr-x 0 0 812352`), and dpkg records it as `iproute2: /sbin/ip` and `iproute2: /bin/ip` while `dpkg -S /usr/sbin/ip` finds nothing. `_safe_tool` follows links and passes. (A record-based check of `ip` by its `/usr/sbin` path, should one ever be added, would NOT find it.)

### 3.2 Both packages at once: not possible

`/usr/bin/arping` is NOT an alternative and NOT a diversion. The two packages exclude each other, in both directions, and they do not even share a path:

```
$ dpkg -i /opt/h3/debs/*.deb                   (container dems-h3-pkg)
dpkg: regarding .../arping_2.24-1build2_arm64.deb containing arping:
 arping conflicts with iputils-arping
  iputils-arping (version 3:20240117-1ubuntu0.1) is present and installed.
dpkg: error processing archive /opt/h3/debs/arping_2.24-1build2_arm64.deb (--install):
 conflicting packages - not installing arping

$ dpkg -i --force-conflicts /opt/h3/debs/*.deb (container dems-h3-pkg2)
dpkg: warning: ignoring conflict, may proceed anyway!
dpkg: regarding .../arping_2.24-1build2_arm64.deb containing arping:
 iputils-arping conflicts with arping
 ... Errors were encountered while processing: /opt/h3/debs/arping_2.24-1build2_arm64.deb      rc=1

$ dpkg-deb -f arping_2.24-1build2_arm64.deb Package Version Conflicts Depends
Package: arping / Version: 2.24-1build2 / Conflicts: iputils-arping
$ dpkg-deb --contents arping_2.24-1build2_arm64.deb | grep bin
-rwxr-xr-x root/root     67616 2024-04-01 05:21 ./usr/sbin/arping
```

After both attempts `/usr/bin/arping` is still the iputils file (`dpkg -S`: `iputils-arping: /usr/bin/arping`, MD5 unchanged) and the helper's check passes. The other program's own place is **`/usr/sbin/arping`**, not the path the helper names. (The two packages do share `/usr/share/man/man8/arping.8.gz`.)

### 3.3 The other program, by every way it can come to the path

Container `dems-h3-e`: `dpkg -r iputils-arping` (rc 0; it removes the program and both records), then `dpkg -i` of the other package (rc 0).

| State | What is there | `_safe_tool(/usr/bin/arping)` | `_expected_conflict_tool()` | Helper's verdict | As intended |
|---|---|---|---|---|---|
| 1 correct installation | iputils file, its records | True | True | passes | yes |
| 2 the other package forced in beside it | dpkg refused; state 1 unchanged | True | True | passes | yes |
| 5 only the other package | `/usr/bin/arping` absent; `arping: /usr/sbin/arping`, MD5 `7d66f745...d40b917c`; no `iputils-arping.*` record | False | False | **37 `CONFLICT_TOOL_MISSING`** | yes |
| 6 a hand-made link `/usr/bin/arping -> /usr/sbin/arping` | the other program reachable at the path; no iputils record | True (the link is followed) | False | **38 `CONFLICT_TOOL_NOT_EXPECTED`** | yes |
| 7 the other program COPIED to `/usr/bin/arping` (0:0, 0755) and the two iputils records put back | records say `4e42a0d8...`, the file is `7d66f745...` | True | False | **38** | yes |
| 8 the iputils file copied back under the same records | MD5 equal again (its file capability is gone after the copy: `getcap` prints nothing) | True | True | passes | yes - the check is about content, as row H2 says |
| 9 state 1 under the unit's two capabilities and no-new-privileges | as state 1 | True | True | passes | yes |

So: **the check passes on a correct installation and refuses the other program** in each of the three ways I could put it at the path. Form 1: 9 states, **0 mismatches**.

## 4. Form 2 - the flag words of `ip -json -4 addr show`

Container A (as built) and container B (interfaces made with `ip link add ... type veth peer name ...` / `type dummy`, each given an IPv4 address so that the `-4` listing shows it). The listing, per interface, exactly as printed (the whole texts are in the fixture files):

```
{"ifindex":1,"ifname":"lo","flags":["LOOPBACK","UP","LOWER_UP"],"mtu":65536,"qdisc":"noqueue","operstate":"UNKNOWN","group":"default","txqlen":1000,"addr_info":[{"family":"inet","local":"127.0.0.1","prefixlen":8,"scope":"host","label":"lo","valid_life_time":4294967295,"preferred_life_time":4294967295}]}
{"ifindex":2,"link_index":56,"ifname":"eth0","flags":["BROADCAST","MULTICAST","UP","LOWER_UP"],"mtu":1500,"qdisc":"noqueue","operstate":"UP","group":"default","link_netnsid":0,"addr_info":[{"family":"inet","local":"172.31.203.60","prefixlen":24,"broadcast":"172.31.203.255","scope":"global","label":"eth0","valid_life_time":4294967295,"preferred_life_time":4294967295}]}
{"ifindex":4,"link":"h3dnp","ifname":"h3dn","flags":["BROADCAST","MULTICAST","M-DOWN"],"mtu":1500,"qdisc":"noop","operstate":"DOWN", ...}
{"ifindex":6,"link":"h3ncp","ifname":"h3nc","flags":["NO-CARRIER","BROADCAST","MULTICAST","UP","M-DOWN"],"mtu":1500,"qdisc":"noqueue","operstate":"LOWERLAYERDOWN", ...}
{"ifindex":8,"link":"h3nap","ifname":"h3na","flags":["BROADCAST","MULTICAST","NOARP","UP","LOWER_UP"], ... "addr_info":[{"family":"inet","local":"203.0.113.10","prefixlen":24,"scope":"global","label":"h3na","valid_life_time":4294967295,"preferred_life_time":4294967295},{"family":"inet","local":"10.203.5.10","prefixlen":24,"scope":"global","dynamic":true,"label":"h3na","valid_life_time":300,"preferred_life_time":300}]}
{"ifindex":9,"ifname":"h3dm","flags":["BROADCAST","NOARP","UP","LOWER_UP"],"mtu":1500,"qdisc":"noqueue","operstate":"UNKNOWN", ...}
{"ifindex":11,"link":"h3upp","ifname":"h3up","flags":["BROADCAST","MULTICAST","UP","LOWER_UP"], ...}
after `ip link set eth0 down`:
{"ifindex":2,"link_index":58,"ifname":"eth0","flags":["BROADCAST","MULTICAST"],"mtu":1500,"qdisc":"noqueue","operstate":"DOWN", ...}
```

| Interface | State | Flag words as printed | `refuse_unless_askable` | Intended by row H2 | Agrees |
|---|---|---|---|---|---|
| `eth0` | the container's interface, up | `BROADCAST`, `MULTICAST`, `UP`, `LOWER_UP` | passes | may be asked | yes |
| `h3up` | veth, both ends up | `BROADCAST`, `MULTICAST`, `UP`, `LOWER_UP` | passes | may be asked | yes |
| `lo` | loopback | `LOOPBACK`, `UP`, `LOWER_UP` | **46** `INTERFACE_NOT_ARPABLE` | 46 | yes |
| `h3na` | veth with `arp off` | `BROADCAST`, `MULTICAST`, `NOARP`, `UP`, `LOWER_UP` | **46** | 46 | yes |
| `h3dm` | dummy (no-ARP by its nature) | `BROADCAST`, `NOARP`, `UP`, `LOWER_UP` | **46** | 46 | yes |
| `h3dn` | veth never set up | `BROADCAST`, `MULTICAST`, `M-DOWN` | **47** `INTERFACE_DOWN` | 47 | yes |
| `eth0` | set down | `BROADCAST`, `MULTICAST` | **47** | 47 | yes |
| `h3nc` | veth up, its peer down: NO CARRIER | `NO-CARRIER`, `BROADCAST`, `MULTICAST`, `UP`, `M-DOWN` | **47** (no `LOWER_UP`) | 47 | yes |
| `h3none` | does not exist | not in the listing | **48** `INTERFACE_STATE_UNKNOWN` | 48 | yes |

Also read by the same call: `host_state()` did not refuse on either listing; the flag words with a hyphen (`NO-CARRIER`, `M-DOWN`) pass the helper's `LINK_FLAG` form; `valid_life_time` is a whole number of seconds, **`4294967295` for an address without a lifetime** (the helper's `LIFETIME_FOREVER`) and `300` (then `294`, `288`) for the one added with `valid_lft 300` - as hypothesis 2 says. `ip -json -4 route show default` printed `[]` (no default route on an internal network) and `default_route_interfaces()` returned the empty set.

Form 2: 9 interface states and 2 lifetime forms, **0 mismatches**.

Not captured (cannot be made here): a point-to-point port (`POINTOPOINT`, no `BROADCAST`), a port listed twice, a physical port without cable.

## 5. Form 3 - `/usr/bin/arping -D -c 2 -w 3 -I <interface> <address>`: text AND exit status

The vector is the helper's own (`add`, lines 731-734). Standard error was empty unless stated.

| # | Case | Exit | Standard output, whole | `conflict_verdict` | Intended | Agrees | Reached in a real `add`? |
|---|---|---|---|---|---|---|---|
| 1 | FREE, an address of another /24 (`192.168.1.250` on `eth0`) - the helper's real case | **0** | `ARPING 192.168.1.250 from 0.0.0.0 eth0` / `Sent 2 probes (2 broadcast(s))` / `Received 0 response(s)` | `FREE` | FREE | yes | yes |
| 2 | FREE, an address of the interface's own network (`172.31.203.222`) | 0 | `ARPING 172.31.203.222 from 0.0.0.0 eth0` / `Sent 2 probes (2 broadcast(s))` / `Received 0 response(s)` | `FREE` | FREE | yes | yes |
| 3 | FREE on the veth pair `h3up` (`10.203.6.77`) | 0 | `ARPING 10.203.6.77 from 0.0.0.0 h3up` / `Sent 2 probes (2 broadcast(s))` / `Received 0 response(s)` | `FREE` | FREE | yes | yes |
| 4 | IN USE: `172.31.203.50`, held by the second container | **1** | `ARPING 172.31.203.50 from 0.0.0.0 eth0` / `Unicast reply from 172.31.203.50 [26:26:D5:90:E5:6A]  0.529ms` / `Sent 1 probes (1 broadcast(s))` / `Received 1 response(s)` | `ADDRESS_IN_USE` | 44 | yes | yes |
| 5 | loopback, `192.0.2.1` on `lo` (the case of `test/079:91`) | **0** | `Interface "lo" is not ARPable` | `CONFLICT_RESULT_UNKNOWN` | 55 | yes | no - stopped earlier by 46 |
| 6 | loopback, its own address `127.0.0.1` | 0 | `Interface "lo" is not ARPable` | 55 | 55 | yes | no - 46 |
| 7 | no-ARP veth `h3na` | 0 | `Interface "h3na" is not ARPable` | 55 | 55 | yes | no - 46 |
| 8 | no-ARP dummy `h3dm` | 0 | `Interface "h3dm" is not ARPable` | 55 | 55 | yes | no - 46 |
| 9 | interface DOWN, veth `h3dn` | **2** | `Interface "h3dn" is down` (on standard OUTPUT) | `CONFLICT_CHECK_FAILED` | 51 | yes | no - 47 |
| 10 | interface DOWN, the container's own `eth0` after `ip link set eth0 down` | 2 | `Interface "eth0" is down` | 51 | 51 | yes | no - 47 |
| 11 | **UP WITHOUT CARRIER**, veth `h3nc` | **0** | `ARPING 198.51.100.77 from 0.0.0.0 h3nc` / `Sent 2 probes (2 broadcast(s))` / `Received 0 response(s)` | **`FREE`** | the TEXT is the free text, so the parser is right about the text; the CASE is refused by 47 | yes (see O-1) | no - 47 |
| 12 | no such interface `h3none` | 2 | empty; standard error `/usr/bin/arping: Device h3none not available.` | 51 | 51 | yes | no - 48 |
| 13 | case 1 under the unit's capability lines (container U) | 0 | as case 1 | `FREE` | FREE | yes | yes |
| 14 | case 4 under the unit's capability lines | 1 | as case 4 (reply line `Unicast reply from 172.31.203.50 [4E:04:BB:19:54:C7]  0.532ms`) | `ADDRESS_IN_USE` | 44 | yes | yes |

Against hypothesis 1 of row H2, line by line:

| The parser expects | Captured | Agrees |
|---|---|---|
| the result on standard output, ASCII, ended by a line feed, far below 4096 bytes | 91 to 155 bytes | yes |
| line 1 `ARPING <the address asked> from <a.b.c.d> <the interface>` | `ARPING 192.168.1.250 from 0.0.0.0 eth0` (the source is `0.0.0.0` in this mode) | yes |
| `Sent <n> probes (<m> broadcast(s))`, n at least 2 and m at least 1 for FREE | `Sent 2 probes (2 broadcast(s))`; when an answer comes the program stops at the first: `Sent 1 probes (1 broadcast(s))` (the parser asks for 2 only for FREE) | yes |
| `Received 0 response(s)` for FREE, nothing after it | exactly that | yes |
| status 1 and a count of at least 1 for IN USE, one reply line between | `Received 1 response(s)`, one `Unicast reply from ...` line | yes |
| FREE is exactly three lines | three lines | yes |

Form 3: 14 cases (42 runs), **0 mismatches**.

### The other program (`/usr/sbin/arping`, package `arping` 2.24), same vector - what the helper would read if step a did not stand

| Case | Exit | Standard output, whole | `conflict_verdict` |
|---|---|---|---|
| free address `172.31.203.223` on `eth0` | **1** | `..` TAB `100% packet loss (0 extra)` | 55 |
| in use, `172.31.203.50` | **0** | `!!` TAB `  0% packet loss (0 extra)` | 55 |
| `lo`, `192.0.2.1` | 1 | `..` TAB `100% packet loss (0 extra)` | 55 |

Its exit status is the REVERSE of the expected program's (0 = the address answered). A reader of the exit status alone - the helper before row H2 - would have taken an address in use for free with this program. With row H2 the program is refused before it is started (38) and its text would be refused after (55). 3 cases (9 runs), all as intended.

### Observations (not mismatches)

- **O-1 (the one that matters).** On a port that is up without carrier the expected program prints the COMPLETE free text and ends 0 (case 11): it sent two probes into nothing. `conflict_verdict` cannot tell this from a free address; nothing in the text can. Only `refuse_unless_askable` stops it (no `LOWER_UP` = 47). Row H2's driver decision D-3 ("no `LOWER_UP` counts as down; stricter than the review's three flags") is therefore load-bearing, not a nicety: without it a pulled camera cable would end in a done `add`. The flags are read BEFORE the probe; a carrier lost between the read and the probe is not seen. Stated in the request line; the owner decides.
- **O-2.** `Interface "..." is down` and `Interface "..." is not ARPable` are printed on standard OUTPUT; `Device ... not available.` on standard error. The first ends 2, the second ends 0, the third ends 2.
- **O-3.** `/usr/bin/arping` carries the file capability `cap_net_raw=ep`; a copy of the file loses it and keeps its checksum (state 8). The helper runs it as root, where it makes no difference; it ran with NET_RAW as the only capability (container A) and with no-new-privileges (container U).
- **O-4.** Duration of a free check was not measured (each run stayed inside the helper's own 8 s bound, or `run_tool` would have returned no status).

## 6. Does a correct installation get refused by the helper as it stands?

**No, not in this container.** With the packages HOST-18 names, as root with exactly the capabilities of the unit's `CapabilityBoundingSet` (`CAP_NET_ADMIN CAP_NET_RAW`) and no new privileges: the program check passes (state 9), the listing is read and an up port with carrier passes the flag check, a free address gives `FREE` and a taken one `ADDRESS_IN_USE` (cases 13, 14). The five new codes appear exactly where row H2 put them: 46 (loopback, no-ARP), 47 (down, no carrier), 48 (not listed), 55 (a text that is not the result), 38 (not the expected program).

## 7. What this does not settle (to the hardware package)

| Left open | Why not here | Check |
|---|---|---|
| amd64 and the host's own package build (the MD5 differs per architecture; the FORM does not depend on it, but it was read on arm64 only) | the image is arm64 | installation step 5 (`check`) |
| the unit's `ProtectSystem=strict`, `RestrictAddressFamilies=AF_UNIX AF_NETLINK AF_PACKET AF_INET`, `ProtectKernel*` around the same calls (hypothesis 4 of row H2) | no service manager in a container | `9A/H-05` |
| a physical port: its flag words with and without cable, and the reply line of a real camera (a `Broadcast reply` form, several replies) | veth and dummy only; the neighbour is a Linux container | `9A/H-25`, `H-06` |
| the helper end to end (`add` writing the mark and the address, `del`, the socket, the journal line) | only the reading functions were called, by the brief | `9A/H-05`, `H-06` |
| a point-to-point port, a port listed twice | cannot be made without more than this row may use | suite (doubles) |

## 8. Commands

```sh
# on this Mac, repository root; every container command under the lock, the lock released when the command ends
shasum -a 256 scripts/host/netalias/dems-core-netalias
/usr/bin/lockf -k -t 1800 .locks/heavy-host.lock docker build --label dems.agent=h3 -t dems/h3-arping-debs:tmp .cache/task4-rowh3/ctx
/usr/bin/lockf -k -t 1800 .locks/heavy-host.lock docker run --rm --name dems-h3-pkg  --label dems.agent=h3 --network none --user 0:0 \
    -v $PWD/scripts/host/netalias:/h3/netalias:ro -v $PWD/.cache/task4-rowh3:/h3/work dems/h3-arping-debs:tmp bash /h3/work/pkg.sh
/usr/bin/lockf -k -t 1800 .locks/heavy-host.lock docker run --rm --name dems-h3-pkg2 ... bash /h3/work/pkg2.sh
/usr/bin/lockf -k -t 1800 .locks/heavy-host.lock bash .cache/task4-rowh3/run_net.sh      # network + containers C, A, B, E; removes them
/usr/bin/lockf -k -t 1800 .locks/heavy-host.lock bash .cache/task4-rowh3/run_net_u.sh    # network + containers C, U on the base image; removes them
docker rmi dems/h3-arping-debs:tmp

# inside the containers (h3.py = the driver)
python3 -I -B /h3/work/h3.py pkg <state name>
python3 -I -B /h3/work/h3.py listing <tag>
python3 -I -B /h3/work/h3.py ask <tag> <interface> <address> [<program>]
```

Raw logs, untracked: `.cache/task4-rowh3/out/` (`pkg_run1.log`, `pkg.log`, `net_a.log`, `net_b.log`, `net_e.log`, `net_u.log`, the dpkg logs, the two console files) and every captured text with its vector, exit status and standard error under `.cache/task4-rowh3/fix/`.

Other checks: `node --test scripts/pg/static.test.mjs` once after the fixtures were added - it FAILS as row H2 found it, its failures name `scripts/hardware-acceptance/test_hw_collectors_camera.sh` and `test_hw_collectors_host.sh` only; no line names `scripts/host/netalias`. The helper's suite was not run: no file it reads was changed.

## 9. Fixtures added (new files; no existing file of the helper's folder touched)

`scripts/host/netalias/captured/` - `README.md` (the table of what each file is, its exit status and the verdict), `arping/` (10 texts), `ip/` (4 listings), `dpkg/` (6 records). 21 files, 8,250 bytes of captured text. They are read by no test yet; the request line asks the suite's owner to replay them in the place of the recollected constants. They lie inside the build context of the container definition (`scripts/host` is on its allow list), which changes nothing in what is built.

## 10. Left behind

`docker ps -a --filter label=dems.agent=h3`: 0 rows. `docker network ls --filter label=dems.agent=h3`: 0 rows. The derived image was removed (`docker rmi`, three layers of mine); the base image `b914f7078f7b` and every other image, container and network of this machine are as they were (three containers of another project, two of them running, untouched). No volume was made. Nothing was pruned.

## 11. Driver decisions, for the controller to confirm

1. **The other package's files were fetched by a derived image at build time** (`ports.ubuntu.com`, the image's own package sources), not at run time: every container then ran without a route out.
2. **The package containers ran with the runtime's default capability set**, because dpkg cannot install or remove without it. The brief names capabilities for the network checks only.
3. **Container B holds NET_ADMIN and NET_RAW together**: `arping` on a made interface needs both in one place. NET_ADMIN is in no other container except U, where it stands for the unit's own line and nothing used it.
4. **Case 11 is recorded as an observation, not a mismatch**: the parser reads the text as its author intended; what is wrong is what the program prints.
5. **The fixtures folder is `scripts/host/netalias/captured/`**: the suite lies in the helper's folder itself, there is no separate test folder.

## 12. Rules kept

No file of the helper, its suite, its build step, `SHA256SUMS` or the unit files was changed (hash equal before and after). Existing files changed with the Edit tool only: one line each in `file_claims.md` and `file_requests.md`. New files with Write, the fixture texts copied byte for byte from the capture folder. Nothing staged or committed. No `sudo`, no host address, no real device, no credential. Test code under `.cache/task4-rowh3/` (untracked; the driver was corrected once by a scripted replace, which touched no repository file).

---
*Generated: 2026-10-13 16:55 WIB*
