---
step: 67b
decision: D93 (fix the session cap, incident F-83-6), D78 (cold-boot flags)
agent: coder-execution
date: 2026-10-01
tier: 3
status: complete
---

# Step 67b: hard cap in `device-session.sh`

**Changed file (only):** `apps/mobile/scripts/device-session.sh`. It went from 263 to 405 lines, sha256 `81136209…f6245a1`. The new version was tested under a temporary name in the same directory, then put in place with an atomic `mv` at 09:55 WIB (inode 9892039 → 10286915). Sessions that were already running keep the old inode, and their shell is not affected.

## 1. Root cause of F-83-6: host sleep, not Perl signals

The old cap was Perl `alarm(1740)`. On macOS, `alarm(2)` counts only the time the Mac is awake. `pmset -g log` shows the host in sleep for most of the incident window:

```
2026-10-01 07:08:30 Sleep  Entering Sleep state due to 'Clamshell Sleep'
  ... short DarkWakes only (2-10 s each) ...
2026-10-01 09:12:47 Wake   Wake from Deep Idle [CDNVA] : due to ... lid
```

The Mac was awake for about 630 s (06:58 → 07:08:30), plus the DarkWakes (about 1 min in total), plus 225 s (09:12:47 → 09:16:32). That is roughly 900 s of awake time, well under 1740 s, so the alarm was never due. Perl's deferred signals were not the cause. Step 67's `SESSION_MAX_SECS=2` test fired correctly.

## 2. What changed

| Area | Change |
|---|---|
| Cap | A background watchdog starts as soon as the lock is held. Once a second it compares the wall clock (`date +%s`) with `DEADLINE = start + DEVICE_SESSION_MAX_SECONDS`. The default is 1800. `SESSION_MAX_SECS` is still read when the new variable is unset. Bad values exit 64 before any lock is taken. After a host sleep the cap fires within about 1 s of wake. The cap covers the whole lock hold: boot wait, Metro start-up and `<commands>`. |
| At the deadline | The watchdog sends TERM to the session's recorded process groups and to the session shell. The shell runs its normal cleanup: Metro and `<commands>` are stopped (KILL after 10 s and 5 s), the app is force-stopped, this session's reverse rules are removed, and the shell exits **142**. Then lockf exits and the lock is free. |
| Backstop | If the session shell is still alive 30 s after the cap (for example a hung adb), the watchdog does the cleanup itself, in this order: SIGSTOP the shell, KILL the recorded groups and the shell's own hung foreground child, remove the reverse rules (each call bounded to 5 s, and the lock is still held), then KILL the shell. lockf then exits 70 and the lock is free. |
| Process groups | `<commands>` and Metro each lead their own process group (`perl setpgrp`, with INT/QUIT reset to default). The group IDs go to a per-session temp dir under `$TMPDIR`, which is removed at exit. Groups are only ever signalled as groups (`kill -SIG -PGID`). The emulator, the adb server and anything else the session did not start are never signalled. A booted emulator is setsid-detached and never recorded. |
| Shell waits | The session shell waits with the interruptible `wait`. Before, it blocked in Perl `waitpid`. Signals now reach the traps at once. `<commands>` keep the caller's stdin through a short-lived fd 3. |
| Normal exit | Anything that `<commands>` left running in their group is stopped too. Before, those processes outlived the session. P3: nothing uses the device after the lock is released. |
| Session shell killed from outside | The watchdog stops the recorded groups, so no Metro stays orphaned on the lane port. It does not touch the reverse rules, because the lock is already free. |
| D78 | The cold-boot flags are now `-no-snapshot-load -no-snapshot-save`. Before, the script passed only `-no-snapshot-save`. After a boot, the log reminds the lane to reinstall the step-72 APK. |
| Kept | Lock order (phone, then tablet), `both` mode, serial selection and exports, `NO_METRO`, `KEEP_APP`, initial and final force-stop, `debug_http_host=localhost:8081` (H-MB-09), the P4 port check, the port-busy guard, the process-based "never boot a second copy" check, and booting a down AVD (the existing step-67 behaviour; see §4). |

## 3. Evidence (all runs outside the sandbox, 2026-10-01 WIB)

| # | Test | Result |
|---|---|---|
| R1 | **Real device:** `DEVICE_SESSION_MAX_SECONDS=20 METRO_PORT=8089 … tablet 'sleep 600'`, with a real expo Metro | Lock held 09:54:56. Reverse rules during the session: `tcp:8081 tcp:8089; tcp:4400 tcp:4400`. Cap fired at 09:55:16 on groups `86887 86986`; "Metro 86887 stopped". **Exit 142, 21 s.** `lockf -k -t 0 .locks/dems_tablet.lock true` → exit 0. `adb -s emulator-5556 reverse --list` was empty before and after. No `expo … 8089` or `sleep 600` left. Port 8089 free. Tablet qemu PID 92922 unchanged. State dir removed |
| A2 | Harness: stub adb plus a stub Metro that spawns a grandchild `sleep 900`; cap 20 | Exit 142 in 20 s. Lock free. `reverse --remove tcp:8081` and `tcp:4400` logged. No Metro, grandchild or sleep left |
| B3 | Harness: cap 10 and a hung `force-stop` during cleanup | Cap at 10 s. "still running 30 s after the cap; forcing it out" at 40 s. Watchdog `reverse --remove tcp:4400`. lockf exit 70 after 41 s. Lock free. The hung child was killed |
| C | Harness: normal exit. Piped stdin, `sleep 777 &` left behind, legacy `SESSION_MAX_SECS=300` | Exit 0. Stdin reached `<commands>`. The leftover `sleep 777` was stopped. Metro stopped. Rules removed. Lock free |
| D | Harness: TERM sent to the session shell from outside | Exit 143. Metro stopped. Rules removed. Lock free |
| E | Harness: KILL sent to the session shell from outside | Lock free at once (lockf 70). Within 8 s the watchdog had stopped the stub Metro, its grandchild and `sleep 622`. Port free |
| F | `DEVICE_SESSION_MAX_SECONDS=abc` / `=0` | Exit 64, no lock taken |
| S | `/bin/sh -n` (bash 3.2 as sh) and `/bin/dash -n` | Both OK. **shellcheck is not installed** (not run) |

## 4. Deviations and notes for the controller

- **R1 ran on the tablet, not the phone.** At test time `dems_phone.lock` had a holder plus 5 queued `lockf` (6 at 09:56). The tablet lock was free, so the 21 s test delayed no lane. The code path is the same; only the serial differs.
- **"Refusing to boot a down emulator":** the step-67 script boots a down AVD (P3) and refuses only a second copy of a running one. I kept that behaviour and fixed only the flags (D78). If the controller wants a down AVD to be refused instead, that is a policy change for a later step.
- **Queued phone lanes run the new inner code.** A queued lane already ran the outer part, but lockf starts `/bin/sh device-session.sh __inner …` only when the lock is granted. So every lane granted the lock after 09:55 runs the new code. The arguments are the same and `SESSION_MAX_SECS` is still honoured, so this is compatible.
- Each lane's `LOCK_WAIT` (`lockf -t`) also uses `alarm(2)`. A host sleep stretches the lock wait too. I did not change this: it only makes lanes wait longer and never holds a lock.
- Run-only processes: harness stubs plus Metro 8089 (R1). All were stopped. No emulator, adb server or other lane's process was touched. Nothing was committed.
