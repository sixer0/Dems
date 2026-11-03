# Row 122: console unit (dems-console.service)

Date: 2026-10-22, host .73 (D30). `data_before` = `data_after` = `dems-core:dems-core 700`; verify silent; enabled and `active`; listener `127.0.0.1:5173`; process user `dems-console`; EACCES `0`; unit `root:root 644`; `.vite` `dems-console:dems-console 700`.
The row's open-address grep counted `1`: a false positive - it greps the whole `ss` line, and the peer column of a listening socket is always `0.0.0.0:*`. Full line: `LISTEN 0 511 127.0.0.1:5173 0.0.0.0:* users:(("node-MainThread",...))`. The local address is loopback only. Runbook correction: apply the grep to the local-address column (`awk '{print $4}'`) only.
