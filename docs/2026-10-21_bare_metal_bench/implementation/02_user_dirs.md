# Row 22: accounts and directories (HOST-04..07)

Date: 2026-10-22, host .73 (D30). Commands: masterplan/02_plan.md row 22 verbatim.

Output: `/opt` `root:root 755` before anything; `dems-core /nonexistent /usr/sbin/nologin`, `dems-console /nonexistent /usr/sbin/nologin`; `.data` and `.data/media/sessions` `dems-core dems-core 700`; `namei -l`: `/`, `opt`, `dems`, `core` `root root drwxr-xr-x`, `.data` `dems-core dems-core drwx------`; `ext4 /dev/nvme0n1p2`. All as expected (HOST-07 partial; rest at row 58).
Files written: accounts dems-core, dems-console (system, nologin, home /nonexistent, none created); /opt/dems, /opt/dems/core root 0755; .data, .data/media, .data/media/sessions dems-core 0700.
