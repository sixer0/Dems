# Row 40: cluster on 4432, loopback only (HOST-52/53)

Date: 2026-10-22, host .73 (D30).
- `0` listeners before; cluster `18 main 4432 down postgres /var/lib/postgresql/18/main ...`; `postgres 700`; `hba_before=postgres:postgres 640`.
- Defect of the runbook found: `pg_conftool 18 main set listen_addresses 127.0.0.1` wrote the value unquoted (`listen_addresses = 127.0.0.1`), and the server refused to start (`syntax error in file ".../postgresql.conf" line 60, near token ".0"`). `pg_conftool ... "'127.0.0.1'"` doubled the quotes (`'''127.0.0.1'''`). Fixed by writing the line directly: `listen_addresses = '127.0.0.1'`. The server never listened before the fix.
- After: `127.0.0.1:4432` only; `:5432` `0`; socket `postgres 700`; `SHOW listen_addresses` `127.0.0.1`; `18.6 (Ubuntu 18.6-1.pgdg24.04+2)`; pg_hba the three lines of DB §3.2, `postgres:postgres 640`; start.conf `auto` `1`; ufw lines with 4432 `0`; `enabled`, `active`.
