# Row 33: file C and apport (HOST-20, HOST-37)

Date: 2026-10-22, host .73 (D30). Commands: masterplan/02_plan.md row 33 verbatim, plus one repeat of `sysctl --system`.
- `apport_before=enabled` (H-7); `apport_after=disabled`; `var_crash_entries=1` (recorded, not deleted); file C `root:root 644`.
- Forwarding `0` `0`, enp4s0 `0`; `fs.suid_dumpable` `0`.
- Deviation: right after the row the value of `kernel.core_pattern` was `core`, not `|/bin/false`. Cause: stopping apport writes `core` to `kernel/core_pattern` (`/usr/share/apport/apport:709` `write_to_proc_sys("kernel/core_pattern", "core")`), and the runbook stops apport after `sysctl --system`. A second `sysctl --system` gave `core_pattern=|/bin/false suid_dumpable=0 fwd=0`; apport is `inactive`/`disabled`, and file C is the only sysctl file that names core_pattern (`grep -rl core_pattern /etc/sysctl.d /usr/lib/sysctl.d /run/sysctl.d`), so the value holds at boot. Note for the runbook: run `sysctl --system` after the apport line.
