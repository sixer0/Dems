---
step: 74b
agent: coder-execution
status: blocked
started: 2026-10-01T06:43+07:00
finished: 2026-10-01T09:20+07:00
---

# Step 74b: emulator scheduling priority (D73, F74-01) (progress)

| Time (WIB) | Event |
|---|---|
| 06:43 | Inputs read: D73, D75, review 74 §2.3-2.4 and F74-01, `verification/assets/74_cold_start_evidence.txt`, `apps/mobile/scripts/device-session.sh`, and step 74's scratch scripts (`s74/session74c.sh`) |
| 06:43 | **The precondition changed.** The background-band PIDs 51262 and 51273 died at about 05:50 (step 75's log, 06:05 incident). Step 75's helper sessions rebooted the AVDs: tablet PID 92922 at 06:04, phone PID 95964 at 06:07. The new PIDs run at nice 0 with no `4T` threads: phone 103×`31T`, 3×`46T`, 1×`97R`, 1×`47R`; tablet 81×`31T`, 2×`46T`, 2×`20T`, 1×`97R`. Host load average 22.6 on 10 cores |
| 06:44 | Both PIDs confirmed to be `qemu-system-aarch64 -avd dems_<avd>` (uid 501). Ran `taskpolicy -B -p 95964` and `taskpolicy -B -p 92922`: both exit 0. It was a no-op, because neither process was in `PRIO_DARWIN_BG`; the thread histograms are unchanged. Evidence: `implementation/assets/74b_emulator_priority_evidence.txt` |
| 06:47 | **Root cause of the step-19 state (evidence):** priority is inherited from the launching shell. Some agent shells run at nice 5 (the phone-lock holder lockf 7736 and its helper sh 14298; zsh 18782 at PRI 26, nice 5), others at nice 0. Tested on a throwaway `/bin/sleep`: `taskpolicy -b` gives `4T` and PRI 4, and `-B` restores `31T`. Unprivileged `renice -n 0` exits 0 but leaves nice unchanged, so only a reboot from a nice-0 shell clears an inherited nice |
| 06:47 | **Controller relay D78:** `pgrep -fl 'qemu-system.*dems_'` gives 95964 (phone) and 92922 (tablet), which equal the `.pid` files. The files are current, so none was rewritten. The 06:44 `-B` hit the live PIDs. Nothing was killed or rebooted |
| 06:48 | Dry test of the fallback on a throwaway sleep: `taskpolicy -t 0 -l 0 -p` exits 0, and tiers 0-5 are accepted (`-t 9` gives exit 64). The tier cannot be read back and there is no "unspecified" value, so it cannot be undone with taskpolicy; it lasts until the process exits |
| 06:45 | Measurement session queued on the phone lock: `METRO_PORT=8086 LOCK_WAIT=3600 SESSION_MAX_SECS=480`, 1 warm-up launch plus 5 measured launches, and `-t 0 -l 0` only if the median is above 4.5 s. The lock is held by another session (lockf 7736), and 3 more sessions are waiting |
| 06:58-07:05 | Phone lock held for 6 min 50 s, Metro 8086. **At session start the phone was back at 106×`4T`, PRI 4, nice 0.** Warm-up 10.67 s. M1-M5 12.52 / 12.11 / 12.41 / 12.71 / 12.91, **median 12.52 s**. Fallback `taskpolicy -t 0 -l 0` on both PIDs (exit 0), still `4T`: Q1-Q5 13.72 / 14.09 / 14.28 / 17.34 / 17.32, **median 14.28 s**. Metro stopped by the helper |
| 07:06-07:08 | Band-return sampling after `-B`: the phone falls back to `4T` at +32 s, with short `31T` windows. The tablet stays `4T` even though `-B` exits 0. The phone flips on its own (07:06:12 `4T`, then 07:06:24 `31T`) |
| 07:08-09:15 | Controller-side interruption |
| 09:16-09:18 | Resumed under a 15-minute box. `-B -t 0 -l 0`: both at `31T` flip to `4T` together at +6 s. The unified log has no runningboardd or launchservicesd line naming the PIDs. Both qemu ASNs are on `lsappinfo` visibleProcessList, and the phone flips with no change in the front app. Agent shells under claude 1345 are nice 0 (`31T`); shells reparented to launchd are nice 5 (`26T`). None is at `4T` |
| 09:20 | Log `implementation/67_emulator_priority.md` written |

**Status: blocked** on the D73 acceptance check (median of 4.5 s or less). `taskpolicy` cannot hold the emulators out of the `4T` band. The band is most likely assigned by macOS to the windowed qemu processes (an App Nap or background role; a hypothesis supported by behavioural evidence). Inherited nice 5 from background agent shells is a real but separate factor.

**Recommendation (log §6):** boot the emulators from the user's own Terminal and keep both windows on screen during demos and measurements. Step 61 tries `-no-window` for agent lanes, adds `-no-snapshot-load` (F-79-3), and records the band with each baseline.

**Files written:**
- `implementation/67_emulator_priority.md`
- `implementation/assets/74b_emulator_priority_evidence.txt`
- `implementation/assets/74b_session74b.sh`
- `delegation_progress/coder_execution_step_74b.md`

**Host changes:**
- `taskpolicy -B` and `taskpolicy -t 0 -l 0` on qemu 95964 and 92922. `-B` has no lasting effect. `-t 0 -l 0` cannot be undone with taskpolicy, has no measurable effect, and ends when the process exits.
- No persistent settings, no kill, no reboot, no rewrite of a `.pid` file.

**For the controller:** set row 74b in `masterplan/02_plan.md` and `status_tasks.md` (left alone because of P8). Relay to steps 60 and 61 and to the mobile lanes: cold starts of 10-17 s are environment-bound while the emulators sit in the `4T` band.
