# Row H3 - the alias helper's three text forms captured in the Ubuntu 24.04 container

- **Status:** complete (a container result; arm64, virtual interfaces, no service manager).
- **Helper tested:** `scripts/host/netalias/dems-core-netalias`, SHA-256 `1e758a2407f862ebfc461768f11c491ff43f3e89fcbf9d9a2da45763c7d015b1` (checked on the Mac before and after, and inside every container). NOT changed.
- **Record:** `test/h3_helper_parser_captures.md`.

## Result per form

| Form | Cases | Mismatches | Note |
|---|---|---|---|
| 1 dpkg records and the program check | 9 states | 0 | `iputils-arping.list` / `.md5sums` as expected (no architecture suffix, `<md5>  usr/bin/arping`). `/usr/bin/arping` is no alternative and no diversion: the two packages conflict in both directions, dpkg installs only one; the other program lives at `/usr/sbin/arping`. Correct installation passes; the other program is refused (37 when absent from the path, 38 when linked or copied there) |
| 2 flag words of `ip -json -4 addr show` | 9 interface states, 2 lifetime forms | 0 | `LOOPBACK` / `NOARP` = 46; down or no carrier = 47; not listed = 48; `valid_life_time` 4294967295 for "forever" |
| 3 `arping -D` text and exit status | 14 cases (42 runs), plus 3 of the other program (9 runs) | 0 | FREE and IN USE exactly as the parser expects |

**A correct installation is NOT refused by the helper as it stands** (also under the unit's two capabilities and no-new-privileges).

## The one observation for the owner (request line filed, not blocking)

On a port that is UP WITHOUT CARRIER the expected program prints the complete free text and ends 0. Only the flag check (no `LOWER_UP` = 47, row H2's decision D-3) stops that case; the text parser alone answers FREE.

## Capabilities

NET_RAW only (container A); NET_RAW + NET_ADMIN (ONE container, B, for the made interfaces; and container U, the unit's own two); the runtime's default set for the three package containers (dpkg). No `--privileged`, no `--network host`. One internal docker network, removed.

## Files

- NEW `scripts/host/netalias/captured/` (21 files: README, 10 arping texts, 4 `ip` listings, 6 dpkg records) - read by no test yet.
- NEW `test/h3_helper_parser_captures.md`, this file.
- One line each in `file_claims.md`, `file_requests.md` (Edit tool).
- Untracked: `.cache/task4-rowh3/`.

## Left behind

Containers with label `dems.agent=h3`: 0. Networks: 0. Derived image removed. Nothing pruned; the other project's containers untouched.

## Unproven (hardware package)

amd64; a physical port and a real camera's reply line (`9A/H-25`, `H-06`); the unit's `ProtectSystem` / `RestrictAddressFamilies` around these calls (`9A/H-05`); the helper end to end.
