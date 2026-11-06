---
step: 74b
decision: D73 (F74-01), D75 (first in the next free slot), D78 (live-PID relay)
agent: coder-execution
date: 2026-10-01
tier: 3
status: blocked (the acceptance check, a median of 4.5 s or less, is not reachable with taskpolicy; the cause is identified and handed over)
---

# Step 74b: emulator scheduling priority

**Sources:**
- Raw evidence: `implementation/assets/74b_emulator_priority_evidence.txt` (206 lines).
- Measurement script: `implementation/assets/74b_session74b.sh`.
- Per-launch logcat files: `scratchpad/s74b/run_emulator-5554_065858/`.

## 1. Result in one paragraph

`taskpolicy -B` does not keep the emulators out of the background band. macOS assigns the `4T` band (PRI 4, every thread) to the windowed qemu GUI processes and re-assigns it within 6-32 s of `-B`. On the tablet, `-B` exits 0 and changes nothing. `taskpolicy -t 0 -l 0` does not lift the band either. Five cold starts in the band gave a median START → Displayed of **12.52 s**; after `-t 0 -l 0` the median was **14.28 s** (target 4.5 s or less). Separately, an emulator booted from a nice-5 agent shell inherits nice 5, and nice cannot be lowered without root. **Recommendation:** boot the emulators from the user's own Terminal and keep their windows on screen during demos and measurements (§6).

## 2. Process identity and the D78 check

- **The review's PIDs are gone.** The background-band PIDs 51262 and 51273 died at about 05:50.
- **Step 75's helper rebooted both AVDs** with `ensure_avd` (setsid, PPID 1):
  - Tablet: PID 92922 at 06:04.
  - Phone: PID 95964 at 06:07.
- **The `.pid` files are current.** `pgrep -fl 'qemu-system.*dems_'` returns 95964 and 92922, the same as `.locks/dems_{phone,tablet}.pid`, at 06:47 and again at 09:16. Nothing was rewritten.
- **Identity was checked before every taskpolicy call:** `qemu-system-aarch64 -avd dems_<avd>`, uid 501.

## 3. What was run and what it did

| Time (WIB) | Command (both PIDs unless noted) | Exit | Thread band before → after |
|---|---|---|---|
| 06:44 | `taskpolicy -B -p 95964`, `taskpolicy -B -p 92922` | 0, 0 | Both already `31T`. No-op: phone 103×`31T` → 103×`31T` |
| 06:58 | (no command; session start) | - | **Phone back at 106×`4T`, PRI 4, nice 0.** The band re-applied by itself within 14 min |
| 07:02:40 | `taskpolicy -t 0 -l 0 -p <pid>` (in-session fallback) | 0, 0 | Phone 103×`4T` → `4T`; tablet 123×`4T` → `4T` |
| 07:06:24 | `taskpolicy -B -p <pid>` | 0, 0 | Phone was already `31T` on its own (it had been `4T` at 07:06:12) and fell back to `4T` at **+32 s**, with short `31T` windows at +61 s and +122 s. Tablet stayed `4T` throughout (**`-B` had no effect**) |
| 09:16:13 | `taskpolicy -B -t 0 -l 0 -p <pid>` | 0, 0 | Both `31T` → **both `4T` at +6 s, flipping together**, and they stayed `4T` to +38 s |

- **Not done:**
  - No `defaults write`, pmset, App Nap toggle, System Settings change or renice on an emulator.
  - No kill or reboot.
  - No other process was touched, apart from the throwaway `/bin/sleep` probes in §5.
- **Lock use:**
  - Phone lock held 06:58:56-07:05:46 (6 min 50 s), with Metro 8086 started and stopped by the helper.
  - The taskpolicy calls and samples are host-only and ran without the device lock.

## 4. Cold starts (dems_phone, Metro 8086)

**Conditions:**
- Every launch was `demsdemo:///stack-check?motion=off`, using step 74's logcat method.
- 1 warm-up launch, then 5 measured launches, each after `am force-stop` and a 2 s idle.
- The app was the step-72 APK, reinstalled by step 75 (`lastUpdateTime 06:07:21`). The bundle has 5,512 modules.

| Launch | Host load | Band at +3 s | proc → class loader | bundle download | bundle → main | main → hydrated | **START → Displayed** |
|---|---|---|---|---|---|---|---|
| W0 (warm-up) | 3.4 | 104×`4T` | 1.02 | 1.36 | 2.11 | 5.08 | 10.67 |
| M1 | 4.6 | 104×`4T` | 1.26 | 1.39 | 3.22 | 5.15 | 12.52 |
| M2 | 4.0 | 103×`4T` | 1.15 | 1.08 | 2.92 | 5.60 | 12.11 |
| M3 | 4.2 | 104×`4T` | 1.03 | 1.06 | 2.79 | 6.22 | 12.41 |
| M4 | 4.0 | 103×`4T` | 1.15 | 1.28 | 3.05 | 5.81 | 12.71 |
| M5 | 4.3 | 105×`4T` | 1.30 | 1.33 | 3.10 | 5.73 | 12.91 |
| **Median M** (after `-B`, band re-applied) | | | | | | | **12.52** |
| Q1-Q5 (after `-t 0 -l 0`) | 4.8-7.5 | 102-140×`4T` | 1.14-1.73 | 1.14-1.98 | 3.22-4.24 | 6.21-7.63 | 13.72, 14.09, 14.28, 17.34, 17.32 |
| **Median Q** | | | | | | | **14.28** |

- **Every launch ran in the `4T` band**, so these numbers measure the band, not the code.
- **The phases before any JavaScript (process → class loader, 1.0-1.7 s) match review 74's slow runs** (1.06-1.54 s), against 0.33 s in its fast runs.
- **A fast-band measurement was not possible.** The band cannot be held at `31T` from an agent shell.

## 5. Where the band comes from

| Hypothesis | Evidence | Verdict |
|---|---|---|
| Inherited `PRIO_DARWIN_BG` from the launching shell | qemu nice 0 and PPID 1. The band appears and disappears with no command (phone `4T` at 07:06:12, `31T` at 07:06:24). `-B` clears the process flag, yet the band returns in 6-32 s, and on the tablet `-B` does nothing | **Rejected** for the `4T` band |
| macOS assigns it to the windowed GUI process (App Nap or a background app role) | `lsappinfo` lists both as `type="Foreground"` GUI apps, both on the visible-process list. Both flip to `4T` together (09:16:19). The phone flips to `31T` while the front app (WhatsApp, the user) does not change. The unified log at default level shows no runningboardd or launchservicesd line naming the PIDs | **Most likely (hypothesis).** The mechanism is unconfirmed; the evidence is behavioural |
| Inherited nice from agent shells | At 06:47 and 09:18, agent shells under the claude process (PID 1345) run at PRI 31, nice 0 (`31T`), while shells reparented to launchd run at PRI 26, nice 5 (`26T`); the current phone-lock holder (zsh 49968) is one of them. No agent shell was at `4T`. Throwaway sleep: `renice -n 0` exits 0 but leaves nice unchanged; `taskpolicy -b` gives `4T` and `-B` gives `31T` | **Real, but separate.** It explains the step-19 emulators' **nice 5** (they were booted from such a shell), not the `4T` band |

## 6. Recommendation and hand-over

### 6.1 README (step 60): boot the demo emulators at normal priority

1. **Boot from your own Terminal.**
   - Run: `~/Library/Android/sdk/emulator/emulator -avd dems_phone -port 5554 -no-metrics -gpu host -no-boot-anim -no-snapshot-save &` (tablet: `dems_tablet`, `-port 5556`).
   - Then write `echo $! > .locks/dems_<avd>.pid`.
   - Do not boot from an agent or background shell. An emulator inherits that shell's nice (agent background shells run at nice 5), and only a reboot clears it, because an unprivileged `renice` cannot lower nice.
2. **Keep both emulator windows on screen** while you demo or measure: not minimised, not on another Space, not behind a full-screen app. macOS moves a hidden emulator into the background band within seconds, and the guest then slows 3-4 times.
3. **Check:**
   - `ps -o pri,nice -p $(cat .locks/dems_phone.pid)` should show nice **0**.
   - `ps -M -p <pid> | awk 'NR>1{for(i=1;i<=NF;i++) if($i~/^[0-9]+[TRF]$/){print $i;break}}' | sort | uniq -c` should show mostly `31T`. Mostly `4T` means the background band.
   - `taskpolicy -B` does not fix this durably.
4. **Measure cold start this way:** 1 warm-up launch, then the median of 5 launches of START → Displayed (logcat `ActivityTaskManager: Displayed`). Record the qemu band at +3 s and the host load for each launch (script: `implementation/assets/74b_session74b.sh`).

### 6.2 Step 61 (reboot for AC-07, performance baseline)

- **When step 61 reboots the AVDs, boot them from a nice-0 context.** An agent shell under the claude process qualifies; a reparented background shell does not. Record `ps -o pri,nice` and the `ps -M` band right after boot.
- **Test once (hypothesis):** whether `-no-window` (headless qemu, no GUI window) keeps agent-lane emulators at `31T`. If so, use it for agent lanes, and use visible windows only for the user's demo.
- **Baseline:** record cold start only when the band at +3 s is mostly `31T`, as the median of 5 launches or more after 1 warm-up.
- **Related: F-79-3 (snapshot reverts the APK).** Add `-no-snapshot-load` to the same boot.

### 6.3 Options not taken (user decision only; persistent host settings)

- **A global App Nap opt-out** (for example `defaults write NSGlobalDomain NSAppSleepDisabled -bool YES`) was **not** applied. It is forbidden in this step.
- **Whether it works is unverified.** qemu has no bundle ID, so no per-app key exists.

## 7. Rollback

| Change | State now | Rollback |
|---|---|---|
| `taskpolicy -B` (06:44, 07:06, 09:16) | No lasting effect; the system re-assigns the band | None needed. `taskpolicy -b -p <pid>` would force the band; it is not a restore |
| `taskpolicy -t 0 -l 0` (07:02:40, 09:16) on PIDs 95964 and 92922 | No measurable effect (still `4T`; cold start not faster) | It cannot be undone with taskpolicy: the tier cannot be read back, and 0-5 are the only values. It ends when the emulator process exits, so step 61's reboot clears it. Harmless to leave |
| Host files | None changed outside `/docs` | - |
