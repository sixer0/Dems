# Row 35: loopback rule, files D and E (HOST-25)

Date: 2026-10-22, host .73 (D30). Commands: masterplan/02_plan.md row 35 verbatim.
- `systemd-analyze verify` printed nothing; unit enabled (symlink in multi-user.target.wants) and `active`.
- The row's grep (`skuid != "?dems-core"?`) counted 0 because nft prints the user as its number: the listed rule is `oifname "lo" ip daddr 127.0.0.1 tcp dport 8554-8564 meta skuid != 997 counter ... reject with tcp reset`, and `id -u dems-core` = 997. The runbook marked that regex (unverified); the rule is the specified one.
- Counter test: `counter_before=0 counter_after=1` (a connection by gsp-dems to 127.0.0.1:8554 was rejected and counted).
- `root:root 755 /etc/dems`, `root:root 644` file D, `root:root 644` file E.
