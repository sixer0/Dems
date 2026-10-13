# Row HC2 (agent HC2, track D) - 2026-10-13 - status: complete

**Question** (C49 (2), C102 (3); HC record section 1): can the Core's identity with an EMPTY capability set run `/usr/sbin/nft list table inet dems_loopback`?

**Answer: NO** (container result). uid `dems-core`, `CapEff/CapBnd 0000000000000000`, `NoNewPrivs 1`: exit status 1, standard output empty, standard error `Operation not permitted (you must be root)` / `netlink: Error: cache initialization failed: Operation not permitted` - 3 of 3, also with the reproducible lines of file G. The kernel answers the netlink request with EPERM (strace). With ONLY `CAP_NET_ADMIN` the same uid lists the table (exit 0). `nft list tables`, `nft -j list table`, `nft list ruleset` are refused the same way. The answer is the same whether the table exists or not.

**Product's judge** (`host-checks.ts`, the nft row, called from `.cache/task4-hc2/judge.ts`): a correct table's real listing -> PASS (null); table deleted -> `RULE_TABLE_ABSENT_OR_NOT_READABLE`; the capability-less answer -> `RULE_TABLE_ABSENT_OR_NOT_READABLE` too. So the row as built refuses every production start under file G.

**What the Core can see without privilege:** nothing about the table (`/proc/net/netfilter` holds only `nf_log`; module use counts are kernel-wide; it is the exempt user, so it cannot probe by connecting). `systemctl is-active`: not measurable (no service manager in the container).

**Where:** image `dems/hc2-nft-check:ubuntu-24.04` (`73a4b309e059`), derived from `b914f7078f7b` + `nftables 1.0.9-1ubuntu0.1`; kernel `6.8.0-117-generic aarch64` = this Mac's Linux virtual machine, not the host. Settled for good by `9A/H-16`.

**Record:** `test/hc2_nft_listing_unprivileged.md` (options A-E for the designers in section 6; findings F-1 to F-3 in section 7).

**Files written:** the record, this file, one line in `file_claims.md`, scratch under `.cache/task4-hc2/`. No product file changed. No request in `file_requests.md`.

**Driver decisions (to confirm):** file D taken out of `40-network-firewall.sh` and loaded with the unit's `ExecStart` line, the script not run with `--apply`; `<service-user>` = `dems-core`; the derived image is kept.

**Deviation:** one two-second probe container ran without the heavy-host lock before the build; all later runs held it.

**Containers left:** none of this row (`--rm`; `docker ps -a` shows only another project's three, untouched).
