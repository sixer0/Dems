# coder-execution — step 67b (D93: hard cap in device-session.sh)

| Field | Value |
|---|---|
| Step | 67b (controller-scheduled, D93; incident F-83-6) |
| Agent | coder-execution |
| Started / finished | 2026-10-01 09:37 / 09:58 WIB |
| Status | **complete** |
| Output log | implementation/68_device_session_cap.md |

## Owned write paths (P6)

- `apps/mobile/scripts/device-session.sh` (only file changed; temporary candidate `.device-session.sh.67b` in the same dir was renamed onto it, so no extra file remains)

## Log

- 09:38 Read the script (263 lines), 40_mobile_deps_native.md §3, and 55_mobile_evidence.md F-83-6. Root cause from `pmset -g log`: clamshell sleep 07:08:30 → 09:12:47. `alarm(2)` counts only awake time (about 900 s of 1740 s). Perl signals were not the cause.
- 09:40–09:53 New cap: wall-clock watchdog (1 s poll), per-session PGID record, groups-only signalling, interruptible `wait`, 30 s backstop (STOP, KILL groups and hung child, bounded reverse removal, KILL shell), cleanup protected by a no-op trap. D78 boot flags fixed (`-no-snapshot-load` added).
- 09:46–09:54 Harness tests with stub adb and stub Metro (A2, B3, C, D, E, F): all pass. A test leftover (my stub's `sleep 600`, which ignored TERM through the old ignore-trap) was killed, and the trap was then changed to a no-op so children no longer inherit SIG_IGN.
- 09:54:56–09:55:16 Real test on dems_tablet: cap 20 with real Metro 8089 and `sleep 600` gave exit 142 in 21 s. Lock probe OK, reverse rules empty, no leftovers, emulator unchanged. The phone was not used: its lock had a holder plus 5 queued lanes.
- 09:55 Atomic `mv` into place (sha256 8113620974de…f6245a1). `sh -n` and `dash -n` OK. shellcheck is not installed.

## Blockers / decisions

- Tablet used instead of phone for the real test (phone queue 6 deep). Same code path.
- Booting a down AVD kept, as step 67 designed it. Only the D78 flags changed.
- Not written: 02_plan.md, status_tasks.md, delegation_progress_report.md (parallel run; the controller synthesises them).
