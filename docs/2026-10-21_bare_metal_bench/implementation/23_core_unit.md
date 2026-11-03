# Row 43: unit file G (dems-core.service)

Date: 2026-10-22, host .73 (D30). `systemd-analyze verify` silent; `root root 644`; After holds time-sync.target, dems-loopback-rule.service, postgresql@18-main.service; Wants holds postgresql@18-main.service; Requires holds dems-loopback-rule.service; `LimitCORE=0`, `NoNewPrivileges=yes`, `KillMode=mixed`; `disabled` (R18-5: enabled only at row 58).
