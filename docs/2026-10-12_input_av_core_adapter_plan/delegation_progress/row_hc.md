# Row HC - host-checks follow-up (agent HC, track D)

Status: **needs-review**. Record: `implementation/hc_host_checks_follow_up.md`.

Why needs-review: item 3's row `/usr/sbin/nft list table inet dems_loopback` is built as C49 (2) orders, but whether a Core with an empty capability set (HOST-39) may list the table is not known (hypothesis of record 076 line 83, never settled). If it may not, every production start on a prepared Linux host is refused by this row. `darwin` is not affected. Request line 1.

| Item | State | Named codes |
|---|---|---|
| 1. C94 (j): helper absent = fact, wrong or partial = refusal | done | log line `CAPTURE_HOST_ALIAS_HELPER_ABSENT` (warning); refusals as before: `CAPTURE_HOST_ALIAS_SOCKET` (`SOCKET_ABSENT`, `SOCKET_OWNER_GROUP_OR_MODE`), `CAPTURE_HOST_ALIAS_HELPER_UNSAFE`, `CAPTURE_HOST_ALIAS_GRANT_UNSAFE`. `SYSTEM_BOOT` member: `addressHelperSocket: 'PRESENT' | 'NOT_PRESENT'` (Linux production only) |
| 2. C53 (4c): configured socket path | done | `CAPTURE_HOST_ALIAS_SOCKET_PATH` / `CONFIGURED_PATH_NOT_THE_INSTALLED_ONE` |
| 3. C49 (2): rule table | done, open point above | `CAPTURE_HOST_LOOPBACK_RULE_MISSING` with `RULE_TABLE_ABSENT_OR_NOT_READABLE`, `RULE_CHAIN_MISSING`, `RULE_NOT_IN_CHAIN`; table installed by HOST-25 |
| 4. C55 DD-2: no host facts | done | `CAPTURE_HOST_FACTS_NOT_HANDED_IN` / `NO_HOST_FACTS` |

Blobs: `boot/checks.ts` dfb1a117 -> 90b3a1e6 (+75 lines, 1 replaced: the call of step 4e); `boot/index.ts` 5a264525 -> 63fe763e (+16, none replaced); `host-checks.ts` fd7e637d; `program-checks.ts` 15680a74; `fence/boot-key.ts` 24c358d9; `fence/index.ts` b61d3ed6; `fence/boot.ts`, `fence/operation.ts` unchanged.

Suites re-stated for item 4: `boot/__tests__/boot.test.ts` (the no-facts case), `fence/__tests__/fence.db.test.ts` (C46 / F-07, part 1).

Checks: unit and static `30 passed (30)`, `806 passed (806)`; database six suites `1 failed | 78 passed (79)` (the one: `capture-composition.db.test.ts:924`, agent V6), `fence.db.test.ts` again after the last edit `49 passed (49)`, 0 clones left; typecheck 6 errors, none in a file of this row (agent V6's files); lint clean.

Driver decisions D-1 to D-8 in the record. To confirm first: D-2 - a stopped socket unit with the helper's files left in place refuses the next start.

Requests: four lines in `file_requests.md` (the listing question; the document row - the order `HI-01..HI-07` before `9A/H-16` is no longer forced; an optional example for V6; reds of other rows).

Edit tool only for existing files: kept.
