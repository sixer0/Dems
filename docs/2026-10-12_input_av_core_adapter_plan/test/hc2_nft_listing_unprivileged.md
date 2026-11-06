---
task_id: 2026-10-12_input_av_core_adapter_plan
row: HC2
date: 2026-10-13
agent: test-expert (agent HC2, track D)
tier: T2
decisions: C49 (2), C102 (3)
answers: implementation/hc_host_checks_follow_up.md section 1 ("the listing question"); implementation/076_host_profile.md:83 (the hypothesis)
status: complete (a CONTAINER result; the host is settled by 9A/H-16)
---

# Row HC2: can the Core's identity, with an empty capability set, list `inet dems_loopback`?

Paths are relative to `/Users/gsp-budi/Documents/DEMS`. No product file was changed. Scratch: `.cache/task4-hc2/` (`image/Dockerfile`, `measure.sh`, `judge.ts`, `run1.log`, `judge.log`, `out/*.stdout|stderr|rc`).

## 1. The answer

**NO. A process with the Core unit's identity and an empty capability set CANNOT list the table.** Measured 3 of 3 runs, in two forms of the identity (sections 4.2 and 4.3):

```
$ /usr/sbin/nft list table inet dems_loopback
exit status: 1
stdout (0 bytes):
stderr (112 bytes):
Operation not permitted (you must be root)
netlink: Error: cache initialization failed: Operation not permitted
```

The hypothesis of `implementation/076_host_profile.md:83` HOLDS in this container. The consequence stated in `implementation/hc_host_checks_follow_up.md` section 1 follows: the product's judge turns exactly this answer into `RULE_TABLE_ABSENT_OR_NOT_READABLE` (section 5), so the row as built refuses every production start under file G - on this kernel.

| Who asks | Capabilities (CapEff) | Exit | Standard output | Product's judge |
|---|---|---|---|---|
| root of the container (the profile's `sudo nft list ...`) | docker default + NET_ADMIN | 0 | the table, 226 bytes | PASS (null) |
| uid `dems-core`, only `CAP_NET_ADMIN` | `0000000000001000` | 0 | the same 226 bytes | PASS (null) |
| uid `dems-core`, NO capability, empty bounding set, no-new-privs | `0000000000000000` | 1 | empty | `RULE_TABLE_ABSENT_OR_NOT_READABLE` |
| the same + the reproducible lines of file G | `0000000000000000` | 1 | empty | `RULE_TABLE_ABSENT_OR_NOT_READABLE` |
| root, table deleted | docker default + NET_ADMIN | 1 | empty | `RULE_TABLE_ABSENT_OR_NOT_READABLE` |

The one capability that decides it is `CAP_NET_ADMIN`: with it alone, as the same uid, the listing works; without it, it does not. Nothing else differs between rows 2 and 3 of the table.

**Where the refusal comes from** (one run under `strace`, appendix lines 116-123): the tool opens `socket(AF_NETLINK, SOCK_RAW, NETLINK_NETFILTER)` successfully; the KERNEL answers the first request (`NFT_MSG_GETGEN`) and the table request (`NFT_MSG_GETTABLE`, name `dems_loopback`) with `NLMSG_ERROR error=-EPERM`. It is not a file permission, not the tool's own uid test, and not the container's seccomp or AppArmor profile (the same container lets the same uid through once it holds `CAP_NET_ADMIN`). "you must be root" is the tool's wording of that EPERM.

## 2. What this result is, and is not

| Point | Value | Source |
|---|---|---|
| Image | `dems/hc2-nft-check:ubuntu-24.04`, id `73a4b309e059` - DERIVED from `dems/capture-linux-check:ubuntu-24.04-ffmpeg-9.0.2` (`b914f7078f7b`, which has no `/usr/sbin/nft`) by `.cache/task4-hc2/image/Dockerfile`: `apt-get install -y nftables` (HOST-25's own command) | build output, section 3 |
| Distribution in the container | Ubuntu 24.04.5 LTS | appendix line 3 |
| Packages | `nftables 1.0.9-1ubuntu0.1`, `libnftables1 1.0.9-1ubuntu0.1`, `libnftnl11 1.2.6-2build1`, `util-linux 2.39.3-9ubuntu6.6` (`setpriv`), `libcap2-bin 1:2.66-5ubuntu2.4` (already in the base image), arm64 | appendix lines 5-10 |
| Kernel | `6.8.0-117-generic aarch64` (`#117-Ubuntu SMP PREEMPT_DYNAMIC Thu May 7 17:26:37 UTC 2026`). It is the kernel of THIS MAC'S LINUX VIRTUAL MACHINE (colima; `docker info`: `OS=Ubuntu 24.04.4 LTS kernel=6.8.0-117-generic arch=aarch64 cpus=4 security=[apparmor seccomp,profile=builtin cgroupns]`), shared by every container. It is not the production host's kernel | appendix line 4; `docker info` |
| Service manager | none: pid 1 is `bash`, `systemctl` is not installed | appendix lines 25, 333 |

The virtual machine happens to run an Ubuntu 24.04 kernel of the 6.8 series, which is the series Ubuntu 24.04 was released with; that makes the result more likely to carry over, it does not make it the host's. A real Ubuntu 24.04 host may run another kernel build (another 6.8 revision or a hardware-enablement kernel), on x86-64, under systemd, with its own AppArmor state. **The check that settles it for good is `9A/H-16`** (the production start under file G on the real machine; its criterion 6 is the deleted-table case), read together with HOST-39's own check (`grep -E '^Cap(Prm|Eff|Bnd|Amb)' /proc/<core-pid>/status`). Until then this is a container result (host profile, section 5).

HYPOTHESIS (not measured, stated as reasoning): the refusal is a rule of the kernel's netfilter netlink receive path that asks for `CAP_NET_ADMIN` over the network namespace for EVERY message of that family, reads included; it has been so for many kernel versions, so a different answer on the real host is unlikely. `9A/H-16` confirms or refutes.

## 3. How it was run

| Step | Command (from the repository root) | Result |
|---|---|---|
| Build the derived image | `/usr/bin/lockf -k -t 1800 .locks/heavy-host.lock docker build -f .cache/task4-hc2/image/Dockerfile -t dems/hc2-nft-check:ubuntu-24.04 .cache/task4-hc2/image` | `Successfully built 73a4b309e059`; `Setting up nftables (1.0.9-1ubuntu0.1) ...` |
| The measurement, ONE container | `/usr/bin/lockf -k -t 1800 .locks/heavy-host.lock docker run --rm --name dems-hc2-measure --network none --cap-add NET_ADMIN -v "$PWD/scripts/host:/host-scripts:ro" -v "$PWD/.cache/task4-hc2:/hc2" dems/hc2-nft-check:ubuntu-24.04 bash /hc2/measure.sh > .cache/task4-hc2/run1.log 2>&1` | `docker run exit: 0`; 408 lines (the appendix, verbatim) |
| The product's judge | `node --import tsx .cache/task4-hc2/judge.ts <labels>` | section 5 |

- **Capability added: `CAP_NET_ADMIN`, to that ONE container, for ONE purpose**: root's setup step (`nft -f` of file D, later `nft delete table`) and the two comparison rows that hold it on purpose (4a, 4b). The measured processes drop every capability with `setpriv` and show it from `/proc/self/status`. No `--privileged`, no `--network host`; `--network none`: the container's own network namespace holds only `lo`, and the table lives there. Nothing of the Mac's or the virtual machine's firewall or network was touched.
- The listener of section 4.4 binds `127.0.0.1:8554` INSIDE that namespace only (the rule's own port range; no port is published, nothing is bound on the Mac).
- The product's runner gives the child an empty environment (`host-checks.ts:73-75`), so every measured listing runs under `env -i`.
- Sandbox: `docker` commands ran with the command sandbox off (the runtime's socket is outside it), as driver rule 8 foresees.
- DEVIATION, stated: before the build, ONE probe `docker run --rm --network none b914f7078f7b sh -c 'ls -l /usr/sbin/nft; ...'` (under two seconds, to learn that the base image has no `nft`) ran WITHOUT the heavy-host lock. Every later build and run held it. The Mac's load average was 11-13 at the time (other sessions); this row added one four-second container.

**The table is made exactly as the profile's script makes it.** `scripts/host/40-network-firewall.sh` (sha256 `8d6d98e2...`) is mounted read-only; `measure.sh` takes the here-document of its `put_file /etc/dems/loopback-ingest.nft 0644 root root` step out of the script itself, replaces `<service-user>` as `host-profile-lib.sh:216` does, writes it root:root 0644, and loads it with the `ExecStart` line of the script's unit (`/usr/sbin/nft -f /etc/dems/loopback-ingest.nft`, script line 126), twice (the file says it is safe to load twice). Appendix lines 27-45. It equals file D of `HOST-PROFILE-UBUNTU-24.04.md:185-193`.

DRIVER DECISIONS: (1) the script was not run with `--apply`: that would also run `apt-get`, `systemctl` (absent) and the other items of HOST-18 to HOST-24; only its file D and its load command were used. (2) `<service-user>` = `dems-core`, the profile's proposal (`HOST-PROFILE-UBUNTU-24.04.md:29`); in the container uid 999, gid 998. (3) the derived image `dems/hc2-nft-check:ubuntu-24.04` is KEPT (it is this row's own; a repeat needs no network); remove with `docker rmi dems/hc2-nft-check:ubuntu-24.04`.

## 4. The measurements (three runs each; raw text in the appendix)

### 4.1 Setup as root - appendix lines 27-80

`nft -f` exit 0 twice. Root's listing (3 of 3 identical, exit 0, stderr empty):

```
table inet dems_loopback {
	chain output {
		type filter hook output priority filter; policy accept;
		oifname "lo" ip daddr 127.0.0.1 tcp dport 8554-8564 meta skuid != 999 counter packets 0 bytes 0 reject with tcp reset
	}
}
```

### 4.2 The question: uid of the Core, no capability - appendix lines 82-123

`setpriv --reuid 999 --regid 998 --clear-groups --inh-caps=-all --ambient-caps=-all --bounding-set=-all --no-new-privs`. The state, from `/proc/self/status`:

```
Uid:	999	999	999	999
Gid:	998	998	998	998
CapInh:	0000000000000000
CapPrm:	0000000000000000
CapEff:	0000000000000000
CapBnd:	0000000000000000
CapAmb:	0000000000000000
NoNewPrivs:	1
```

`env -i /usr/sbin/nft list table inet dems_loopback`: 3 of 3 - exit status 1, stdout 0 bytes, stderr the two lines of section 1.

### 4.3 With the lines of file G that can be reproduced - appendix lines 125-161

Reproduced: `User=`, `Group=`, `SupplementaryGroups=audio dems-netalias` (`Groups: 29 999`), `WorkingDirectory=` (`/opt/dems/core`), `UMask=0077`, `LimitCORE=0` (`Max core file size 0 0`), `NoNewPrivileges=yes` (`NoNewPrivs: 1`), `CapabilityBoundingSet=` and `AmbientCapabilities=` (all five capability lines zero). Result: 3 of 3 - exit status 1, stdout empty, the same two stderr lines. The supplementary groups change nothing.

**File G holds no other hardening line** (`HOST-PROFILE-UBUNTU-24.04.md:222`: "No further hardening option is set on purpose"): it has NO `PrivateNetwork`, `RestrictAddressFamilies`, `SystemCallFilter` or `ProtectKernelTunables`. So every line of file G that bears on the listing was reproduced. NOT reproduced, because the container has no service manager:

| Not reproduced | What it would do to an AF_NETLINK / NETLINK_NETFILTER request |
|---|---|
| systemd itself as the starter (its way of applying `User=`, the unit's control group, `EnvironmentFile=`, `Requires=` / `After=`, `TimeoutStopSec=`) | HYPOTHESIS: nothing; the kernel judges the request by the sender's capabilities over the network namespace, which were reproduced. A control group and start order are not consulted |
| `PrivateNetwork=yes` (NOT in file G) | HYPOTHESIS: the Core would live in a new, empty network namespace. The request would be answered for THAT namespace: still EPERM without the capability, and even with it the host's table would not be there to see. It would also cut the Core from the cameras, so it is no candidate |
| `RestrictAddressFamilies=` (NOT in file G) | HYPOTHESIS: if the list left out `AF_NETLINK`, the `socket()` call itself would fail (address family not supported) before any permission question, and the tool would end with another message; with `AF_NETLINK` listed, no effect |
| `SystemCallFilter=` (NOT in file G) | HYPOTHESIS: a filter on system-call numbers; it does not see the netlink protocol. `socket`, `sendto`, `recvmsg` are in any set a network server needs, so no effect; were one of them excluded, the call would fail or the process be killed before the kernel's capability test |
| `ProtectKernelTunables=yes` (NOT in file G) | HYPOTHESIS: makes `/proc/sys` and `/sys` read-only for the unit; a netlink request is not a file, so no effect on the listing (it would still allow READING `/sys/module`, section 6) |
| The host's AppArmor state for the unit | HYPOTHESIS: none for an unconfined unit. The container ran under the runtime's default AppArmor and seccomp profiles, i.e. stricter than the unit, and those did not refuse the listing once `CAP_NET_ADMIN` was held (4.4) |

### 4.4 Comparisons - appendix lines 163-293

| Asked | As | Result (3 of 3 unless said) |
|---|---|---|
| `nft list table inet dems_loopback` | uid 999, ONLY `CAP_NET_ADMIN` (`CapInh/Prm/Eff/Bnd/Amb: 0000000000001000`, `NoNewPrivs: 1`) | exit 0, the 226 bytes of 4.1, byte-identical to root's (`cmp`), stderr empty |
| `nft list tables` | uid 999, no capability | exit 1, stdout empty, the same two stderr lines |
| `nft -j list table inet dems_loopback` | uid 999, no capability | exit 1, stdout empty, the same two stderr lines (the JSON form is refused the same way, and prints no JSON error object) |
| `nft list ruleset` | uid 999, no capability | exit 1, stdout empty, the same two stderr lines |
| `nft list tables` | root (1 run) | exit 0, `table inet dems_loopback` |
| `nft -j list table inet dems_loopback` | root (1 run) | exit 0, 887 bytes of JSON; the uid is `"right": 999` |

The rule works as the profile says (1 run, a listener on the container's own `127.0.0.1:8554`): uid 999 `connected`; uid 1001 (`dems-check`) `ConnectionRefusedError [Errno 111]`; root `ConnectionRefusedError [Errno 111]` (root is "another user" too); afterwards `counter packets 2 bytes 120`.

### 4.5 The absent table - appendix lines 338-406

| State | As | Exit | stdout | stderr |
|---|---|---|---|---|
| table deleted (`nft delete table inet dems_loopback`, the unit's `ExecStop`) | root, 3 of 3 | 1 | empty | `Error: No such file or directory` / `list table inet dems_loopback` / `                ^^^^^^^^^^^^^` |
| table deleted | uid 999, no capability, 3 of 3 | 1 | empty | `Operation not permitted (you must be root)` / `netlink: Error: cache initialization failed: Operation not permitted` |
| an empty table of that name | root, 1 run | 0 | `table inet dems_loopback {` / `}` | empty |
| the chain without its rule (`nft flush chain`) | root, 1 run | 0 | table, chain, the `type filter hook output ...` line | empty |

**The capability-less caller gets the SAME answer whether the table is there or not**: exit 1, nothing on standard output, the same two lines on standard error. Only standard error tells "absent" (`No such file or directory`) from "may not ask" (`Operation not permitted`), and only for a caller that may ask. The product's runner drops standard error, and reading it would not help the Core: its own answer never changes.

## 5. The product's own judge on the captured text

`.cache/task4-hc2/judge.ts` imports `HOST_COMMAND_CHECKS` from `apps/core-server/src/capture/boot/host-checks.ts` (sha256 `3f2a2895dfc1e8a3...`, the working tree), finds the row whose program is `/usr/sbin/nft`, and calls its `judge(lines, exitCode)` with the captured standard output and exit status. `linesOf` is not exported; its three lines (`host-checks.ts:398-403`) are repeated word for word - the only copied piece.

```
$ node --import tsx .cache/task4-hc2/judge.ts root_list_1 ... root_norule_1
row under test: /usr/sbin/nft list table inet dems_loopback   code=CAPTURE_HOST_LOOPBACK_RULE_MISSING   items=HOST-25
root_list_1        exit=0 stdout=226 bytes lines=6  ->  null (PASS: the rule is in place)
root_list_2        exit=0 stdout=226 bytes lines=6  ->  null (PASS: the rule is in place)
root_list_3        exit=0 stdout=226 bytes lines=6  ->  null (PASS: the rule is in place)
netadmin_list_1    exit=0 stdout=226 bytes lines=6  ->  null (PASS: the rule is in place)
netadmin_list_2    exit=0 stdout=226 bytes lines=6  ->  null (PASS: the rule is in place)
netadmin_list_3    exit=0 stdout=226 bytes lines=6  ->  null (PASS: the rule is in place)
nocap_list_1       exit=1 stdout=  0 bytes lines=0  ->  RULE_TABLE_ABSENT_OR_NOT_READABLE
nocap_list_2       exit=1 stdout=  0 bytes lines=0  ->  RULE_TABLE_ABSENT_OR_NOT_READABLE
nocap_list_3       exit=1 stdout=  0 bytes lines=0  ->  RULE_TABLE_ABSENT_OR_NOT_READABLE
unitlike_list_1    exit=1 stdout=  0 bytes lines=0  ->  RULE_TABLE_ABSENT_OR_NOT_READABLE
unitlike_list_2    exit=1 stdout=  0 bytes lines=0  ->  RULE_TABLE_ABSENT_OR_NOT_READABLE
unitlike_list_3    exit=1 stdout=  0 bytes lines=0  ->  RULE_TABLE_ABSENT_OR_NOT_READABLE
root_absent_1      exit=1 stdout=  0 bytes lines=0  ->  RULE_TABLE_ABSENT_OR_NOT_READABLE
root_absent_2      exit=1 stdout=  0 bytes lines=0  ->  RULE_TABLE_ABSENT_OR_NOT_READABLE
root_absent_3      exit=1 stdout=  0 bytes lines=0  ->  RULE_TABLE_ABSENT_OR_NOT_READABLE
nocap_absent_1     exit=1 stdout=  0 bytes lines=0  ->  RULE_TABLE_ABSENT_OR_NOT_READABLE
root_empty_1       exit=0 stdout= 29 bytes lines=2  ->  RULE_CHAIN_MISSING
root_norule_1      exit=0 stdout=106 bytes lines=5  ->  RULE_NOT_IN_CHAIN
```

| Question | Answer |
|---|---|
| Does a CORRECT table's listing pass the judge? | YES - the real tool's text of nftables 1.0.9 (tab-indented, `meta skuid != 999`, `counter packets 0 bytes 0`) gives `null`. The judge's assumptions about the form (first line `table inet dems_loopback {`, last line `}`, `chain output {`, `type filter hook output priority `, the three rule parts) match the real output |
| Does an absent table give `RULE_TABLE_ABSENT_OR_NOT_READABLE`? | YES (root, table deleted: exit 1, empty) |
| Does the capability-less answer give it too? | YES - which is the problem: a correct host is refused |
| Empty table / chain without rule | `RULE_CHAIN_MISSING` / `RULE_NOT_IN_CHAIN`, as the row's record says |

So the judge is right about the text; what fails is that the Core's identity never gets the text.

## 6. What a capability-less process CAN observe about the table - appendix lines 295-341

| Looked at (uid 999, no capability) | Result | Use |
|---|---|---|
| `/proc/net/netfilter/` | one file, `nf_log` | none: no table is named anywhere |
| `/proc/net/nf_tables` | does not exist | none |
| `/proc/net/ip_tables_names`, `ip6_tables_names` | `Permission denied` | none (and they are the older rule sets, not this one) |
| `/sys/module/nf_tables`, `nft_reject_inet`, ... ; `/proc/modules` | readable: the modules are loaded; use counts | NOT a statement about the table. The counts are kernel-wide (all network namespaces): with the table `nf_tables 257`, `nft_reject_inet 1`; after deleting it `243` and `0` (root read both). They move with ANY rule set on the machine and cannot say which table or rule is there |
| `/sys/kernel/debug`, `/sys/fs/bpf` | empty | none |
| `systemctl is-active dems-loopback-rule.service` (what the product asked before, and still asks first) | NOT AVAILABLE in the container: `systemctl` is not installed, pid 1 is `bash`. Not measured | on a host an unprivileged account can normally ask it (HYPOTHESIS here; row 80's reason for choosing it) - but C49 (2) names its weakness: the unit is a one-shot that stays `active` when its table is deleted |
| Behaviour: connect to `127.0.0.1:8554` | uid 999 connects (it is the exempt user); another uid is refused | the Core itself cannot see the rule by trying: it is the one user the rule lets through, and with no capability and no-new-privs it cannot become another |

**In short: nothing.** Without `CAP_NET_ADMIN` the rule set is invisible to the Core, and the Core cannot probe it by behaviour.

Options this leaves, for the designers (none chosen here; each is a design decision, and each "how" on a real host is a HYPOTHESIS until a host shows it):

| # | Option | Cost |
|---|---|---|
| A | The table is read by something that HAS the right, before the Core starts, and the Core's start depends on its result: e.g. a root-run start condition of the Core's unit, or a second one-shot unit that lists the table and fails when it is absent | the check moves out of the Core's code into the unit file (host profile, file G / a new file); it is taken at start, not while running; a new HOST item and its hardware check |
| B | The Core asks a root-side helper over a socket (the pattern of the address helper) | a new privileged surface with its own review; the address helper is not mandatory (C94 j), so it cannot simply carry this |
| C | The Core's unit gets `CAP_NET_ADMIN` (bounding + ambient) | contradicts HOST-39 (empty set) and gives the Core the right to CHANGE the rule set, not only read it: the kernel has no read-only form of this capability |
| D | Back to the unit's state only | C49 (2) / BR-12, `9A/H-16` criterion 6: a deleted table with an active unit starts. The row as built must then be taken out (one hunk of `host-checks.ts` plus the named static-test entry, as the HC record says) |
| E | Leave the row as built | every production start under file G is refused `CAPTURE_HOST_LOOPBACK_RULE_MISSING` / `RULE_TABLE_ABSENT_OR_NOT_READABLE` (this result) |

## 7. Further findings

| # | Finding | For |
|---|---|---|
| F-1 | nftables 1.0.9 prints the rule's user as the NUMBER: `meta skuid != 999`, not `skuid != "dems-core"` (file D writes the name; the listing gives the uid, also in JSON). The took-effect check of HOST-25 in the profile and in `40-network-firewall.sh:136` says the listing holds `skuid != <service-user>`: an installer comparing literally will not find the name. The product's judge is not affected (it looks for `skuid != `) - and for the same reason it does not check WHICH user the rule exempts | host profile owner (wording of HOST-25's check); designers (whether the judge should hold the uid to the Core's own) |
| F-2 | root itself is refused by the rule on those ports (uid 0 is not the service user). Consistent with the profile's text "only `<service-user>`"; named because an administrator's test from a root shell counts as the "connection attempt from the administrator account" | 9A/H-01 |
| F-3 | The base image `b914f7078f7b` has no `nftables`; the derived image adds it. If later container rows need it, the repository's `Dockerfile.ubuntu-24.04` could carry it among its "tools of the later container rows" - not changed here (not this row's file) | owner of `scripts/host/container` |

## 8. Limits

- One container host kernel (the Mac's virtual machine), arm64, no service manager. Not the host: `9A/H-16`.
- `systemctl is-active` was not measurable.
- The four options named in the task as examples (`PrivateNetwork`, `RestrictAddressFamilies`, `SystemCallFilter`, `ProtectKernelTunables`) are not in file G; what is said about them is reasoning, labelled HYPOTHESIS.
- Each measured case ran three times in ONE container start (one `measure.sh` run); the container was not started three times.

## 9. Containers and images left

```
$ docker ps -a --format '{{.ID}} {{.Image}} {{.Status}} {{.Names}}'
839bfa527226 smartwms/suara:0.1.0 Up 5 days (healthy) smartwms-suara
a417660cb072 pgvector/pgvector:pg17 Up 5 days (healthy) smartwms-postgres
854e108642d1 pgvector/pgvector:pg17 Exited (255) 4 weeks ago smartwms-uji-migrasi
$ docker ps -a --filter ancestor=dems/hc2-nft-check:ubuntu-24.04 --filter ancestor=b914f7078f7b -q | wc -l
       0
```

No container of this row is left (both were run with `--rm`); the three listed are another project's, were there before, and were not touched. Images: `dems/hc2-nft-check:ubuntu-24.04` (`73a4b309e059`) created and kept; nothing pruned or removed. `git status --short | wc -l`: 618 before, 620 after - the two new files of this row (this record and `delegation_progress/row_hc2.md`); no tracked product file differs.

## Appendix: `.cache/task4-hc2/run1.log`, verbatim (sha256 `4e349b96da72...`), the output of `measure.sh` in the container

````

######## 0. the container
distribution: Ubuntu 24.04.5 LTS
kernel: 6.8.0-117-generic aarch64  (#117-Ubuntu SMP PREEMPT_DYNAMIC Thu May  7 17:26:37 UTC 2026)
libcap2-bin	1:2.66-5ubuntu2.4	arm64
libnftables1	1.0.9-1ubuntu0.1	arm64
libnftnl11	1.2.6-2build1	arm64
nftables	1.0.9-1ubuntu0.1	arm64
util-linux	2.39.3-9ubuntu6.6	arm64
nftables v1.0.9 (Old Doc Yak #3)
root's state in this container:
Uid:	0	0	0	0
Gid:	0	0	0	0
Groups:	0 
CapInh:	0000000000000000
CapPrm:	00000000a80435fb
CapEff:	00000000a80435fb
CapBnd:	00000000a80435fb
CapAmb:	0000000000000000
NoNewPrivs:	0
Seccomp:	2
capsh decode of root's CapEff: 0x00000000a80435fb=cap_chown,cap_dac_override,cap_fowner,cap_fsetid,cap_kill,cap_setgid,cap_setuid,cap_setpcap,cap_net_bind_service,cap_net_admin,cap_net_raw,cap_sys_chroot,cap_mknod,cap_audit_write,cap_setfcap
network interfaces:
1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN mode DEFAULT
init (no service manager): bash; systemctl: not installed

######## 1. SETUP as root (needs CAP_NET_ADMIN): the service account, then file D exactly as scripts/host/40-network-firewall.sh writes it
uid=999(dems-core) gid=998(dems-core) groups=998(dems-core)
audio:x:29:ubuntu
dems-netalias:x:999:
root root 644 /etc/dems/loopback-ingest.nft
$ cat /etc/dems/loopback-ingest.nft
table inet dems_loopback
delete table inet dems_loopback
table inet dems_loopback {
    chain output {
        type filter hook output priority filter; policy accept;
        oifname "lo" ip daddr 127.0.0.1 tcp dport 8554-8564 meta skuid != "dems-core" counter reject with tcp reset
    }
}
the unit's ExecStart line in the script: 126:ExecStart=/usr/sbin/nft -f /etc/dems/loopback-ingest.nft
$ /usr/sbin/nft -f /etc/dems/loopback-ingest.nft
exit status: 0
$ /usr/sbin/nft -f /etc/dems/loopback-ingest.nft   (a second load: the file says it is safe twice)
exit status: 0

######## 4a. COMPARISON: root of the container (the profile's own check is 'sudo nft list table inet dems_loopback')
---- root_list_1
$ env -i /usr/sbin/nft list table inet dems_loopback
exit status: 0
stdout (226 bytes):
table inet dems_loopback {
	chain output {
		type filter hook output priority filter; policy accept;
		oifname "lo" ip daddr 127.0.0.1 tcp dport 8554-8564 meta skuid != 999 counter packets 0 bytes 0 reject with tcp reset
	}
}
stderr (0 bytes):
---- root_list_2
$ env -i /usr/sbin/nft list table inet dems_loopback
exit status: 0
stdout (226 bytes):
table inet dems_loopback {
	chain output {
		type filter hook output priority filter; policy accept;
		oifname "lo" ip daddr 127.0.0.1 tcp dport 8554-8564 meta skuid != 999 counter packets 0 bytes 0 reject with tcp reset
	}
}
stderr (0 bytes):
---- root_list_3
$ env -i /usr/sbin/nft list table inet dems_loopback
exit status: 0
stdout (226 bytes):
table inet dems_loopback {
	chain output {
		type filter hook output priority filter; policy accept;
		oifname "lo" ip daddr 127.0.0.1 tcp dport 8554-8564 meta skuid != 999 counter packets 0 bytes 0 reject with tcp reset
	}
}
stderr (0 bytes):

######## 2. THE QUESTION: uid dems-core, NO capability, empty bounding set, no-new-privs; the product's runner gives an EMPTY environment (env -i)
$ setpriv --reuid 999 --regid 998 --clear-groups --inh-caps=-all --ambient-caps=-all --bounding-set=-all --no-new-privs bash -c '<state>'
uid=999(dems-core) gid=998(dems-core) groups=998(dems-core)
Uid:	999	999	999	999
Gid:	998	998	998	998
Groups:	 
CapInh:	0000000000000000
CapPrm:	0000000000000000
CapEff:	0000000000000000
CapBnd:	0000000000000000
CapAmb:	0000000000000000
NoNewPrivs:	1
Seccomp:	2
---- nocap_list_1
$ setpriv --reuid 999 --regid 998 --clear-groups --inh-caps=-all --ambient-caps=-all --bounding-set=-all --no-new-privs env -i /usr/sbin/nft list table inet dems_loopback
exit status: 1
stdout (0 bytes):
stderr (112 bytes):
Operation not permitted (you must be root)
netlink: Error: cache initialization failed: Operation not permitted
---- nocap_list_2
$ setpriv --reuid 999 --regid 998 --clear-groups --inh-caps=-all --ambient-caps=-all --bounding-set=-all --no-new-privs env -i /usr/sbin/nft list table inet dems_loopback
exit status: 1
stdout (0 bytes):
stderr (112 bytes):
Operation not permitted (you must be root)
netlink: Error: cache initialization failed: Operation not permitted
---- nocap_list_3
$ setpriv --reuid 999 --regid 998 --clear-groups --inh-caps=-all --ambient-caps=-all --bounding-set=-all --no-new-privs env -i /usr/sbin/nft list table inet dems_loopback
exit status: 1
stdout (0 bytes):
stderr (112 bytes):
Operation not permitted (you must be root)
netlink: Error: cache initialization failed: Operation not permitted
---- the same once under strace (network calls only), to see WHERE the refusal comes from
socket(AF_NETLINK, SOCK_RAW, NETLINK_NETFILTER) = 3
sendto(3, [{nlmsg_len=20, nlmsg_type=0xa10 /* NLMSG_??? */, nlmsg_flags=NLM_F_REQUEST, nlmsg_seq=0, nlmsg_pid=0}, "\x00\x00\x00\x00"], 20, 0, {sa_family=AF_NETLINK, nl_pid=0, nl_groups=00000000}, 12) = 20
recvmsg(3, {msg_name={sa_family=AF_NETLINK, nl_pid=0, nl_groups=00000000}, msg_namelen=12, msg_iov=[{iov_base=[{nlmsg_len=40, nlmsg_type=NLMSG_ERROR, nlmsg_flags=0, nlmsg_seq=0, nlmsg_pid=95}, {error=-EPERM, msg=[{nlmsg_len=20, nlmsg_type=NFNL_SUBSYS_NFTABLES<<8|NFT_MSG_GETGEN, nlmsg_flags=NLM_F_REQUEST, nlmsg_seq=0, nlmsg_pid=0}, {nfgen_family=AF_UNSPEC, version=NFNETLINK_V0, res_id=htons(0)}]}], iov_len=69631}], msg_iovlen=1, msg_controllen=0, msg_flags=0}, 0) = 40
sendto(3, [{nlmsg_len=40, nlmsg_type=NFNL_SUBSYS_NFTABLES<<8|NFT_MSG_GETTABLE, nlmsg_flags=NLM_F_REQUEST|NLM_F_ACK, nlmsg_seq=0, nlmsg_pid=0}, {nfgen_family=AF_UNIX, version=NFNETLINK_V0, res_id=htons(0)}, [{nla_len=18, nla_type=0x1}, "\x64\x65\x6d\x73\x5f\x6c\x6f\x6f\x70\x62\x61\x63\x6b\x00"]], 40, 0, {sa_family=AF_NETLINK, nl_pid=0, nl_groups=00000000}, 12) = 40
recvmsg(3, {msg_name={sa_family=AF_NETLINK, nl_pid=0, nl_groups=00000000}, msg_namelen=12, msg_iov=[{iov_base=[{nlmsg_len=60, nlmsg_type=NLMSG_ERROR, nlmsg_flags=0, nlmsg_seq=0, nlmsg_pid=95}, {error=-EPERM, msg=[{nlmsg_len=40, nlmsg_type=NFNL_SUBSYS_NFTABLES<<8|NFT_MSG_GETTABLE, nlmsg_flags=NLM_F_REQUEST|NLM_F_ACK, nlmsg_seq=0, nlmsg_pid=0}, {nfgen_family=AF_UNIX, version=NFNETLINK_V0, res_id=htons(0)}, [{nla_len=18, nla_type=0x1}, "\x64\x65\x6d\x73\x5f\x6c\x6f\x6f\x70\x62\x61\x63\x6b\x00"]]}], iov_len=69631}], msg_iovlen=1, msg_controllen=0, msg_flags=0}, 0) = 60
Operation not permitted (you must be root)
netlink: Error: cache initialization failed: Operation not permitted

######## 3. the same with the lines of file G a setpriv / prlimit / umask can reproduce: User, Group, SupplementaryGroups=audio dems-netalias, UMask=0077, LimitCORE=0, NoNewPrivileges=yes, CapabilityBoundingSet=, AmbientCapabilities=, WorkingDirectory
state:
uid=999(dems-core) gid=998(dems-core) groups=998(dems-core),29(audio),999(dems-netalias)
0077
Max core file size        0                    0                    bytes     
/opt/dems/core
Uid:	999	999	999	999
Gid:	998	998	998	998
Groups:	29 999 
CapInh:	0000000000000000
CapPrm:	0000000000000000
CapEff:	0000000000000000
CapBnd:	0000000000000000
CapAmb:	0000000000000000
NoNewPrivs:	1
Seccomp:	2
---- unitlike_list_1
$ prlimit --core=0:0 setpriv --reuid 999 --regid 998 --groups audio,dems-netalias --inh-caps=-all --ambient-caps=-all --bounding-set=-all --no-new-privs env -i /usr/sbin/nft list table inet dems_loopback
exit status: 1
stdout (0 bytes):
stderr (112 bytes):
Operation not permitted (you must be root)
netlink: Error: cache initialization failed: Operation not permitted
---- unitlike_list_2
$ prlimit --core=0:0 setpriv --reuid 999 --regid 998 --groups audio,dems-netalias --inh-caps=-all --ambient-caps=-all --bounding-set=-all --no-new-privs env -i /usr/sbin/nft list table inet dems_loopback
exit status: 1
stdout (0 bytes):
stderr (112 bytes):
Operation not permitted (you must be root)
netlink: Error: cache initialization failed: Operation not permitted
---- unitlike_list_3
$ prlimit --core=0:0 setpriv --reuid 999 --regid 998 --groups audio,dems-netalias --inh-caps=-all --ambient-caps=-all --bounding-set=-all --no-new-privs env -i /usr/sbin/nft list table inet dems_loopback
exit status: 1
stdout (0 bytes):
stderr (112 bytes):
Operation not permitted (you must be root)
netlink: Error: cache initialization failed: Operation not permitted

######## 4b. COMPARISON: uid dems-core with ONLY CAP_NET_ADMIN (effective through the ambient set), bounding set = net_admin
state:
uid=999(dems-core) gid=998(dems-core) groups=998(dems-core)
Uid:	999	999	999	999
Gid:	998	998	998	998
Groups:	 
CapInh:	0000000000001000
CapPrm:	0000000000001000
CapEff:	0000000000001000
CapBnd:	0000000000001000
CapAmb:	0000000000001000
NoNewPrivs:	1
Seccomp:	2
---- netadmin_list_1
$ setpriv --reuid 999 --regid 998 --clear-groups --inh-caps=+net_admin --ambient-caps=+net_admin --bounding-set=-all,+net_admin --no-new-privs env -i /usr/sbin/nft list table inet dems_loopback
exit status: 0
stdout (226 bytes):
table inet dems_loopback {
	chain output {
		type filter hook output priority filter; policy accept;
		oifname "lo" ip daddr 127.0.0.1 tcp dport 8554-8564 meta skuid != 999 counter packets 0 bytes 0 reject with tcp reset
	}
}
stderr (0 bytes):
---- netadmin_list_2
$ setpriv --reuid 999 --regid 998 --clear-groups --inh-caps=+net_admin --ambient-caps=+net_admin --bounding-set=-all,+net_admin --no-new-privs env -i /usr/sbin/nft list table inet dems_loopback
exit status: 0
stdout (226 bytes):
table inet dems_loopback {
	chain output {
		type filter hook output priority filter; policy accept;
		oifname "lo" ip daddr 127.0.0.1 tcp dport 8554-8564 meta skuid != 999 counter packets 0 bytes 0 reject with tcp reset
	}
}
stderr (0 bytes):
---- netadmin_list_3
$ setpriv --reuid 999 --regid 998 --clear-groups --inh-caps=+net_admin --ambient-caps=+net_admin --bounding-set=-all,+net_admin --no-new-privs env -i /usr/sbin/nft list table inet dems_loopback
exit status: 0
stdout (226 bytes):
table inet dems_loopback {
	chain output {
		type filter hook output priority filter; policy accept;
		oifname "lo" ip daddr 127.0.0.1 tcp dport 8554-8564 meta skuid != 999 counter packets 0 bytes 0 reject with tcp reset
	}
}
stderr (0 bytes):

######## 4c. COMPARISON, no capability: nft list tables / nft -j list table inet dems_loopback / nft list ruleset
---- nocap_tables_1
$ setpriv --reuid 999 --regid 998 --clear-groups --inh-caps=-all --ambient-caps=-all --bounding-set=-all --no-new-privs env -i /usr/sbin/nft list tables
exit status: 1
stdout (0 bytes):
stderr (112 bytes):
Operation not permitted (you must be root)
netlink: Error: cache initialization failed: Operation not permitted
---- nocap_tables_2
$ setpriv --reuid 999 --regid 998 --clear-groups --inh-caps=-all --ambient-caps=-all --bounding-set=-all --no-new-privs env -i /usr/sbin/nft list tables
exit status: 1
stdout (0 bytes):
stderr (112 bytes):
Operation not permitted (you must be root)
netlink: Error: cache initialization failed: Operation not permitted
---- nocap_tables_3
$ setpriv --reuid 999 --regid 998 --clear-groups --inh-caps=-all --ambient-caps=-all --bounding-set=-all --no-new-privs env -i /usr/sbin/nft list tables
exit status: 1
stdout (0 bytes):
stderr (112 bytes):
Operation not permitted (you must be root)
netlink: Error: cache initialization failed: Operation not permitted
---- nocap_json_1
$ setpriv --reuid 999 --regid 998 --clear-groups --inh-caps=-all --ambient-caps=-all --bounding-set=-all --no-new-privs env -i /usr/sbin/nft -j list table inet dems_loopback
exit status: 1
stdout (0 bytes):
stderr (112 bytes):
Operation not permitted (you must be root)
netlink: Error: cache initialization failed: Operation not permitted
---- nocap_json_2
$ setpriv --reuid 999 --regid 998 --clear-groups --inh-caps=-all --ambient-caps=-all --bounding-set=-all --no-new-privs env -i /usr/sbin/nft -j list table inet dems_loopback
exit status: 1
stdout (0 bytes):
stderr (112 bytes):
Operation not permitted (you must be root)
netlink: Error: cache initialization failed: Operation not permitted
---- nocap_json_3
$ setpriv --reuid 999 --regid 998 --clear-groups --inh-caps=-all --ambient-caps=-all --bounding-set=-all --no-new-privs env -i /usr/sbin/nft -j list table inet dems_loopback
exit status: 1
stdout (0 bytes):
stderr (112 bytes):
Operation not permitted (you must be root)
netlink: Error: cache initialization failed: Operation not permitted
---- nocap_ruleset_1
$ setpriv --reuid 999 --regid 998 --clear-groups --inh-caps=-all --ambient-caps=-all --bounding-set=-all --no-new-privs env -i /usr/sbin/nft list ruleset
exit status: 1
stdout (0 bytes):
stderr (112 bytes):
Operation not permitted (you must be root)
netlink: Error: cache initialization failed: Operation not permitted
---- nocap_ruleset_2
$ setpriv --reuid 999 --regid 998 --clear-groups --inh-caps=-all --ambient-caps=-all --bounding-set=-all --no-new-privs env -i /usr/sbin/nft list ruleset
exit status: 1
stdout (0 bytes):
stderr (112 bytes):
Operation not permitted (you must be root)
netlink: Error: cache initialization failed: Operation not permitted
---- nocap_ruleset_3
$ setpriv --reuid 999 --regid 998 --clear-groups --inh-caps=-all --ambient-caps=-all --bounding-set=-all --no-new-privs env -i /usr/sbin/nft list ruleset
exit status: 1
stdout (0 bytes):
stderr (112 bytes):
Operation not permitted (you must be root)
netlink: Error: cache initialization failed: Operation not permitted
---- for reference, root: nft list tables / nft -j list table
---- root_tables_1
$ env -i /usr/sbin/nft list tables
exit status: 0
stdout (25 bytes):
table inet dems_loopback
stderr (0 bytes):
---- root_json_1
$ env -i /usr/sbin/nft -j list table inet dems_loopback
exit status: 0
stdout (887 bytes):
{"nftables": [{"metainfo": {"version": "1.0.9", "release_name": "Old Doc Yak #3", "json_schema_version": 1}}, {"table": {"family": "inet", "name": "dems_loopback", "handle": 5}}, {"chain": {"family": "inet", "table": "dems_loopback", "name": "output", "handle": 1, "type": "filter", "hook": "output", "prio": 0, "policy": "accept"}}, {"rule": {"family": "inet", "table": "dems_loopback", "chain": "output", "handle": 2, "expr": [{"match": {"op": "==", "left": {"meta": {"key": "oifname"}}, "right": "lo"}}, {"match": {"op": "==", "left": {"payload": {"protocol": "ip", "field": "daddr"}}, "right": "127.0.0.1"}}, {"match": {"op": "==", "left": {"payload": {"protocol": "tcp", "field": "dport"}}, "right": {"range": [8554, 8564]}}}, {"match": {"op": "!=", "left": {"meta": {"key": "skuid"}}, "right": 999}}, {"counter": {"packets": 0, "bytes": 0}}, {"reject": {"type": "tcp reset"}}]}}]}
stderr (0 bytes):

######## 4d. the rule WORKS as the profile says (inside this container's own loopback; the container has --network none): a listener on 127.0.0.1:8554
as dems-core (uid 999), no capability:  connected
as dems-check (uid 1001), no capability: refused: ConnectionRefusedError [Errno 111] Connection refused
as root (uid 0):                         refused: ConnectionRefusedError [Errno 111] Connection refused
root listing after the three attempts (the counter):
		oifname "lo" ip daddr 127.0.0.1 tcp dport 8554-8564 meta skuid != 999 counter packets 2 bytes 120 reject with tcp reset

######## 5. what a capability-less process CAN observe about the table (uid dems-core, no capability)
$ ls -la /proc/net/netfilter/ 2>&1
total 0
dr-xr-xr-x  3 root      root      0 Oct 13 10:08 .
dr-xr-xr-x 56 dems-core dems-core 0 Oct 13 10:08 ..
-r--r--r--  1 root      root      0 Oct 13 10:08 nf_log
exit status: 0
$ ls /proc/net/ | tr "\n" " "
anycast6 arp dev dev_mcast dev_snmp6 fib_trie fib_triestat icmp icmp6 if_inet6 igmp igmp6 ip6_flowlabel ip6_mr_cache ip6_mr_vif ip6_tables_matches ip6_tables_names ip6_tables_targets ip_mr_cache ip_mr_vif ip_tables_matches ip_tables_names ip_tables_targets ipv6_route mcfilter mcfilter6 netfilter netlink netstat packet protocols psched ptype raw raw6 route rt6_stats rt_acct rt_cache snmp snmp6 sockstat sockstat6 softnet_stat stat tcp tcp6 udp udp6 udplite udplite6 unix wireless xfrm_stat exit status: 0
$ cat /proc/net/ip_tables_names /proc/net/ip6_tables_names /proc/net/nf_tables 2>&1
cat: /proc/net/ip_tables_names: Permission denied
cat: /proc/net/ip6_tables_names: Permission denied
cat: /proc/net/nf_tables: No such file or directory
exit status: 1
$ ls -d /sys/module/nf_tables /sys/module/nft_* /sys/module/nf_reject* 2>&1
/sys/module/nf_reject_ipv4
/sys/module/nf_reject_ipv6
/sys/module/nf_tables
/sys/module/nft_chain_nat
/sys/module/nft_compat
/sys/module/nft_reject
/sys/module/nft_reject_inet
exit status: 0
$ cat /sys/module/nf_tables/refcnt 2>&1
257
exit status: 0
$ grep -E "^(nf_tables|nft_|nf_reject)" /proc/modules 2>&1
nft_reject_inet 12288 1 - Live 0x0000000000000000
nf_reject_ipv4 20480 1 nft_reject_inet, Live 0x0000000000000000
nf_reject_ipv6 24576 1 nft_reject_inet, Live 0x0000000000000000
nft_reject 12288 1 nft_reject_inet, Live 0x0000000000000000
nft_chain_nat 12288 9 - Live 0x0000000000000000
nft_compat 24576 20 - Live 0x0000000000000000
nf_tables 352256 257 nft_reject_inet,nft_reject,nft_chain_nat,nft_compat, Live 0x0000000000000000
exit status: 0
$ ls /sys/kernel/debug 2>&1 | head -3; ls /sys/fs/bpf 2>&1 | head -3
exit status: 0
$ command -v systemctl || echo "systemctl: not installed in this container (no service manager; pid 1 is $(cat /proc/1/comm))"
systemctl: not installed in this container (no service manager; pid 1 is bash)
exit status: 0
---- /sys/module/nf_tables/refcnt and /proc/modules, read by root, WITH the table and after deleting it (does anything an unprivileged reader sees move with the table?)
with table:    refcnt=257  modules: nft_reject_inet:1 nf_reject_ipv4:1 nf_reject_ipv6:1 nft_reject:1 nft_chain_nat:9 nft_compat:20 nf_tables:257 

######## 6. THE ABSENT TABLE (root deletes it, as the unit's ExecStop does): what the listing answers then
$ /usr/sbin/nft delete table inet dems_loopback
exit status: 0
without table: refcnt=243  modules: nft_reject_inet:0 nf_reject_ipv4:1 nf_reject_ipv6:1 nft_reject:1 nft_chain_nat:9 nft_compat:20 nf_tables:243 
---- root_absent_1
$ env -i /usr/sbin/nft list table inet dems_loopback
exit status: 1
stdout (0 bytes):
stderr (93 bytes):
Error: No such file or directory
list table inet dems_loopback
                ^^^^^^^^^^^^^
---- root_absent_2
$ env -i /usr/sbin/nft list table inet dems_loopback
exit status: 1
stdout (0 bytes):
stderr (93 bytes):
Error: No such file or directory
list table inet dems_loopback
                ^^^^^^^^^^^^^
---- root_absent_3
$ env -i /usr/sbin/nft list table inet dems_loopback
exit status: 1
stdout (0 bytes):
stderr (93 bytes):
Error: No such file or directory
list table inet dems_loopback
                ^^^^^^^^^^^^^
---- nocap_absent_1
$ setpriv --reuid 999 --regid 998 --clear-groups --inh-caps=-all --ambient-caps=-all --bounding-set=-all --no-new-privs env -i /usr/sbin/nft list table inet dems_loopback
exit status: 1
stdout (0 bytes):
stderr (112 bytes):
Operation not permitted (you must be root)
netlink: Error: cache initialization failed: Operation not permitted
---- nocap_absent_2
$ setpriv --reuid 999 --regid 998 --clear-groups --inh-caps=-all --ambient-caps=-all --bounding-set=-all --no-new-privs env -i /usr/sbin/nft list table inet dems_loopback
exit status: 1
stdout (0 bytes):
stderr (112 bytes):
Operation not permitted (you must be root)
netlink: Error: cache initialization failed: Operation not permitted
---- nocap_absent_3
$ setpriv --reuid 999 --regid 998 --clear-groups --inh-caps=-all --ambient-caps=-all --bounding-set=-all --no-new-privs env -i /usr/sbin/nft list table inet dems_loopback
exit status: 1
stdout (0 bytes):
stderr (112 bytes):
Operation not permitted (you must be root)
netlink: Error: cache initialization failed: Operation not permitted
---- an EMPTY table of that name (root creates it, lists it, deletes it)
---- root_empty_1
$ env -i /usr/sbin/nft list table inet dems_loopback
exit status: 0
stdout (29 bytes):
table inet dems_loopback {
}
stderr (0 bytes):
---- the table loaded again, then the chain's rule flushed (a chain without the rule)
---- root_norule_1
$ env -i /usr/sbin/nft list table inet dems_loopback
exit status: 0
stdout (106 bytes):
table inet dems_loopback {
	chain output {
		type filter hook output priority filter; policy accept;
	}
}
stderr (0 bytes):
left in this network namespace at the end: 0 table(s)

######## END
````

## Appendix: `.cache/task4-hc2/measure.sh` (sha256 `b4e25ec307b1...`), the commands as run

````bash
#!/bin/bash
# HC2: runs INSIDE the container only. Root at start (container capabilities: docker default + NET_ADMIN).
set -u
[ -f /.dockerenv ] || { echo "container only" >&2; exit 64; }
OUT=/hc2/out
SCRIPT=/host-scripts/40-network-firewall.sh
ROW='/usr/sbin/nft list table inet dems_loopback'
say() { printf '\n######## %s\n' "$*"; }
# cap <label> <command...>: run, keep stdout / stderr / exit status apart, print all three verbatim
cap() {
  local label=$1; shift
  "$@" >"$OUT/$label.stdout" 2>"$OUT/$label.stderr"; local rc=$?
  echo "$rc" >"$OUT/$label.rc"
  printf -- '---- %s\n$ %s\nexit status: %d\nstdout (%d bytes):\n' "$label" "$*" "$rc" "$(wc -c <"$OUT/$label.stdout")"
  cat "$OUT/$label.stdout"
  printf 'stderr (%d bytes):\n' "$(wc -c <"$OUT/$label.stderr")"
  cat "$OUT/$label.stderr"
}
STATE='grep -E "^(Uid|Gid|Groups|CapInh|CapPrm|CapEff|CapBnd|CapAmb|NoNewPrivs|Seccomp):" /proc/self/status'

say "0. the container"
. /etc/os-release; echo "distribution: $PRETTY_NAME"
echo "kernel: $(uname -r) $(uname -m)  ($(uname -v))"
cat /opt/dems/container/hc2-packages.txt
/usr/sbin/nft --version
echo "root's state in this container:"; bash -c "$STATE"
echo "capsh decode of root's CapEff: $(capsh --decode=$(awk '/^CapEff/ {print $2}' /proc/self/status))"
echo "network interfaces:"; ip -o link show | cut -c1-80
echo "init (no service manager): $(cat /proc/1/comm); systemctl: $(command -v systemctl || echo 'not installed')"

say "1. SETUP as root (needs CAP_NET_ADMIN): the service account, then file D exactly as scripts/host/40-network-firewall.sh writes it"
groupadd --system dems-netalias
useradd --system --no-create-home --shell /usr/sbin/nologin dems-core
id dems-core; getent group audio dems-netalias
SUID=$(id -u dems-core); SGID=$(id -g dems-core)
install -d -o root -g root -m 0755 /etc/dems
# the here-document of put_file /etc/dems/loopback-ingest.nft, taken from the script itself; the placeholder is
# replaced as host-profile-lib.sh does it (HP_OUT=${HP_OUT//<service-user>/$HP_SERVICE_USER})
awk '/^put_file \/etc\/dems\/loopback-ingest.nft /{f=1;next} f&&/^EOF$/{exit} f' "$SCRIPT" | sed 's/<service-user>/dems-core/g' > /etc/dems/loopback-ingest.nft
chown root:root /etc/dems/loopback-ingest.nft; chmod 0644 /etc/dems/loopback-ingest.nft
stat -c '%U %G %a %n' /etc/dems/loopback-ingest.nft
echo '$ cat /etc/dems/loopback-ingest.nft'; cat /etc/dems/loopback-ingest.nft
echo "the unit's ExecStart line in the script: $(grep -n '^ExecStart=' "$SCRIPT")"
echo '$ /usr/sbin/nft -f /etc/dems/loopback-ingest.nft'; /usr/sbin/nft -f /etc/dems/loopback-ingest.nft; echo "exit status: $?"
echo '$ /usr/sbin/nft -f /etc/dems/loopback-ingest.nft   (a second load: the file says it is safe twice)'; /usr/sbin/nft -f /etc/dems/loopback-ingest.nft; echo "exit status: $?"

# the identities
NOCAP="setpriv --reuid $SUID --regid $SGID --clear-groups --inh-caps=-all --ambient-caps=-all --bounding-set=-all --no-new-privs"
UNITLIKE="setpriv --reuid $SUID --regid $SGID --groups audio,dems-netalias --inh-caps=-all --ambient-caps=-all --bounding-set=-all --no-new-privs"
NETADMIN="setpriv --reuid $SUID --regid $SGID --clear-groups --inh-caps=+net_admin --ambient-caps=+net_admin --bounding-set=-all,+net_admin --no-new-privs"

say "4a. COMPARISON: root of the container (the profile's own check is 'sudo nft list table inet dems_loopback')"
for n in 1 2 3; do cap "root_list_$n" env -i $ROW; done

say "2. THE QUESTION: uid dems-core, NO capability, empty bounding set, no-new-privs; the product's runner gives an EMPTY environment (env -i)"
echo "\$ $NOCAP bash -c '<state>'"; $NOCAP bash -c "id; $STATE"
for n in 1 2 3; do cap "nocap_list_$n" $NOCAP env -i $ROW; done
echo "---- the same once under strace (network calls only), to see WHERE the refusal comes from"
$NOCAP strace -f -e trace=socket,bind,sendto,sendmsg,recvmsg,recvfrom -s 64 $ROW 2>&1 | grep -v -E '^(\+\+\+|---)' | head -40

say "3. the same with the lines of file G a setpriv / prlimit / umask can reproduce: User, Group, SupplementaryGroups=audio dems-netalias, UMask=0077, LimitCORE=0, NoNewPrivileges=yes, CapabilityBoundingSet=, AmbientCapabilities=, WorkingDirectory"
echo "state:"; ( cd /opt/dems/core && umask 0077 && prlimit --core=0:0 $UNITLIKE bash -c "id; umask; grep 'Max core file size' /proc/self/limits; pwd; $STATE" )
for n in 1 2 3; do ( cd /opt/dems/core && umask 0077 && cap "unitlike_list_$n" prlimit --core=0:0 $UNITLIKE env -i $ROW ); done

say "4b. COMPARISON: uid dems-core with ONLY CAP_NET_ADMIN (effective through the ambient set), bounding set = net_admin"
echo "state:"; $NETADMIN bash -c "id; $STATE"
for n in 1 2 3; do cap "netadmin_list_$n" $NETADMIN env -i $ROW; done

say "4c. COMPARISON, no capability: nft list tables / nft -j list table inet dems_loopback / nft list ruleset"
for n in 1 2 3; do cap "nocap_tables_$n" $NOCAP env -i /usr/sbin/nft list tables; done
for n in 1 2 3; do cap "nocap_json_$n" $NOCAP env -i /usr/sbin/nft -j list table inet dems_loopback; done
for n in 1 2 3; do cap "nocap_ruleset_$n" $NOCAP env -i /usr/sbin/nft list ruleset; done
echo "---- for reference, root: nft list tables / nft -j list table"
cap "root_tables_1" env -i /usr/sbin/nft list tables
cap "root_json_1" env -i /usr/sbin/nft -j list table inet dems_loopback

say "4d. the rule WORKS as the profile says (inside this container's own loopback; the container has --network none): a listener on 127.0.0.1:8554"
python3 - <<'PY' &
import socket,time
s=socket.socket(); s.setsockopt(socket.SOL_SOCKET,socket.SO_REUSEADDR,1); s.bind(('127.0.0.1',8554)); s.listen(8); s.settimeout(6)
t=time.time()
while time.time()-t<6:
    try:
        c,_=s.accept(); c.close()
    except Exception: break
PY
LISTENER=$!
sleep 1
CONNECT='import socket,sys
s=socket.socket(); s.settimeout(3)
try:
    s.connect(("127.0.0.1",8554)); print("connected")
except Exception as e: print("refused:", type(e).__name__, e)'
echo "as dems-core (uid $SUID), no capability:  $($NOCAP python3 -c "$CONNECT")"
echo "as dems-check (uid $(id -u dems-check)), no capability: $(setpriv --reuid "$(id -u dems-check)" --regid "$(id -g dems-check)" --clear-groups --inh-caps=-all --ambient-caps=-all --bounding-set=-all --no-new-privs python3 -c "$CONNECT")"
echo "as root (uid 0):                         $(python3 -c "$CONNECT")"
wait $LISTENER 2>/dev/null
echo "root listing after the three attempts (the counter):"; /usr/sbin/nft list table inet dems_loopback | grep counter

say "5. what a capability-less process CAN observe about the table (uid dems-core, no capability)"
OBS() { printf '$ %s\n' "$*"; $NOCAP bash -c "$*" 2>&1 | head -12; echo "exit status: ${PIPESTATUS[0]}"; }
OBS 'ls -la /proc/net/netfilter/ 2>&1'
OBS 'ls /proc/net/ | tr "\n" " "'
OBS 'cat /proc/net/ip_tables_names /proc/net/ip6_tables_names /proc/net/nf_tables 2>&1'
OBS 'ls -d /sys/module/nf_tables /sys/module/nft_* /sys/module/nf_reject* 2>&1'
OBS 'cat /sys/module/nf_tables/refcnt 2>&1'
OBS 'grep -E "^(nf_tables|nft_|nf_reject)" /proc/modules 2>&1'
OBS 'ls /sys/kernel/debug 2>&1 | head -3; ls /sys/fs/bpf 2>&1 | head -3'
OBS 'command -v systemctl || echo "systemctl: not installed in this container (no service manager; pid 1 is $(cat /proc/1/comm))"'
echo "---- /sys/module/nf_tables/refcnt and /proc/modules, read by root, WITH the table and after deleting it (does anything an unprivileged reader sees move with the table?)"
echo "with table:    refcnt=$(cat /sys/module/nf_tables/refcnt 2>&1)  modules: $(grep -E '^(nf_tables|nft_|nf_reject)' /proc/modules 2>&1 | awk '{print $1":"$3}' | tr '\n' ' ')"

say "6. THE ABSENT TABLE (root deletes it, as the unit's ExecStop does): what the listing answers then"
echo '$ /usr/sbin/nft delete table inet dems_loopback'; /usr/sbin/nft delete table inet dems_loopback; echo "exit status: $?"
echo "without table: refcnt=$(cat /sys/module/nf_tables/refcnt 2>&1)  modules: $(grep -E '^(nf_tables|nft_|nf_reject)' /proc/modules 2>&1 | awk '{print $1":"$3}' | tr '\n' ' ')"
for n in 1 2 3; do cap "root_absent_$n" env -i $ROW; done
for n in 1 2 3; do cap "nocap_absent_$n" $NOCAP env -i $ROW; done
echo "---- an EMPTY table of that name (root creates it, lists it, deletes it)"
/usr/sbin/nft add table inet dems_loopback; cap "root_empty_1" env -i $ROW; /usr/sbin/nft delete table inet dems_loopback
echo "---- the table loaded again, then the chain's rule flushed (a chain without the rule)"
/usr/sbin/nft -f /etc/dems/loopback-ingest.nft; /usr/sbin/nft flush chain inet dems_loopback output; cap "root_norule_1" env -i $ROW
/usr/sbin/nft delete table inet dems_loopback
echo "left in this network namespace at the end: $(/usr/sbin/nft list tables | wc -l) table(s)"
chmod -R a+rX "$OUT"
say "END"
````

---
*Generated: 2026-10-13 17:15*
