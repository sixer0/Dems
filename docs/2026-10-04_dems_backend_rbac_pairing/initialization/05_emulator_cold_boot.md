VERDICT: PASS

> **What this covers.** Blueprint step 24 = plan row W02. The three Android emulators `dems_phone`, `dems_tablet` and `dems_phone2` were found not running and were booted cold, one after another, outside the sandbox, with `-no-snapshot-load -no-snapshot-save`. All three report `sys.boot_completed` = 1 and are listed by `adb` as `device`. Nothing was installed, started, wiped, killed or reconfigured.

| Field | Value |
|---|---|
| Task | 2026-10-04_dems_backend_rbac_pairing, blueprint step 24 = plan W02, phase initialization |
| Agent | coder-execution (tier D, `model="sonnet"`) |
| Evidence tier | 3 (what was done, with the command output) |
| Run window | 2026-10-04 06:27:20 to 06:28:40 WIB (UTC+7) |
| Emulator | Android emulator 37.1.11.0 (build_id 15917651), `~/Library/Android/sdk/emulator/emulator`; adb 1.0.41, version 37.0.1-15733141 |
| Host load at start | load averages 0.95 1.16 1.30 on 10 cores; 676 GiB free on `/` |
| Raw logs | session scratchpad `/private/tmp/claude-501/-Users-gsp-budi-Documents-DEMS/0d71fd65-4a51-4019-9c48-5c92d11bbdaf/scratchpad/<avd>.log` (session-scoped; the lines that matter are quoted below). The predecessor's `.locks/<avd>.emulator.log` files of 2026-10-01 were left untouched |

## 1. Summary table

| AVD | Serial | Console port | PID (`.locks/<avd>.pid`) | Started | Seen booted | Emulator's own "Boot completed" | Guest `/proc/uptime` at the final check |
|---|---|---|--:|---|---|--:|---|
| `dems_phone` | `emulator-5554` | 5554 | 84074 | 06:27:20 | 06:27:36 | 13824 ms | 60.09 s |
| `dems_tablet` | `emulator-5556` | 5556 | 84299 | 06:27:49 | 06:28:00 | 10381 ms | 35.22 s |
| `dems_phone2` | `emulator-5558` | 5558 | 84494 | 06:28:05 | 06:28:19 | 12371 ms | 19.08 s |

No emulator needed a retry. The boots ran strictly one after another: each wait loop saw `get-state` = `device` and `sys.boot_completed` = 1 before the next emulator was launched (limit was 300 s each; none came near it).

## 2. Pre-boot checks (read-only, sandbox bypass)

The sandbox cannot run `ps`, `pgrep` or the adb server, so these ran with the per-command bypass (P10).

```
$ ps -axo pid,ppid,nice,etime,command | grep -E "qemu-system|emulator/emulator|/emulator -avd|netsimd" | grep -v -E "grep|Claude"
(no output)

$ adb devices -l
List of devices attached
(empty)

$ ps -o pid,command -p 95964 / 92922 / 97196      # PIDs recorded in the three .locks/*.pid files of 2026-10-01
(no output: all three processes are gone)
```

Result: no emulator process and no adb device existed, so there was no running instance to keep or to flag. The stale PID files (`dems_phone.pid` 95964, `dems_tablet.pid` 92922, `dems_phone2.pid` 97196) matched no live process and were overwritten with the new PIDs, as the plan intends (`.locks/<avd>.pid` is this row's write path).

AVD facts: `~/.android/avd/` holds `dems_phone.avd`, `dems_tablet.avd` and `dems_phone2.avd` with their `.ini` files. Each AVD folder has a zero-byte `multiinstance.lock` from 2026-10-01; the emulator takes its lock on that file with a file lock, so the leftovers did not block any boot.

## 3. The commands

The flags are those of 02_plan section 5.5, which equal `apps/mobile/scripts/device-session.sh:223-224`. The detach wrapper is the one `device-session.sh` itself uses (a new session, every inherited descriptor above 2 closed), so the emulators outlive this shell and no lock file stays open.

```sh
export ANDROID_HOME=$HOME/Library/Android/sdk
nohup /usr/bin/perl -MPOSIX -e 'POSIX::setsid(); POSIX::close($_) for 3 .. 255; exec @ARGV or die "exec: $!\n"' -- \
  "$ANDROID_HOME/emulator/emulator" -avd dems_phone  -port 5554 \
  -no-metrics -gpu host -no-boot-anim -no-snapshot-load -no-snapshot-save >"$SP/dems_phone.log"  2>&1 </dev/null &
echo $! > /Users/gsp-budi/Documents/DEMS/.locks/dems_phone.pid
# then the same for dems_tablet (-port 5556) and dems_phone2 (-port 5558), one after the other
```

`$SP` is the session scratchpad. `npm run emulator` and `npm run emulator:phone` were not used (they boot from the snapshot).

`emulator` exec'd straight into `qemu-system-aarch64` (the PID that `$!` returned is the qemu process; parent PID 1 after the detach), so each `.locks/<avd>.pid` holds the PID of the real emulator process, the same meaning the predecessor's files have.

## 4. Evidence of a true cold boot

Each emulator log contains the full-startup line, and none contains a snapshot load:

```
== dems_phone
USER_INFO    | Emulator is performing a full startup. This may take upto two minutes, or more.
INFO         | Boot completed in 13824 ms
== dems_tablet
USER_INFO    | Emulator is performing a full startup. This may take upto two minutes, or more.
INFO         | Boot completed in 10381 ms
== dems_phone2
USER_INFO    | Emulator is performing a full startup. This may take upto two minutes, or more.
INFO         | Boot completed in 12371 ms
```

A grep of the three logs for `ERROR|WARNING|multiple|abort` returned nothing. The only "snapshot" hits are a Qt warning about the type `SnapshotInfo`, not a snapshot restore. The boots are short (10 to 14 s) because the host is an Apple Silicon arm64 machine with `-gpu host` and the images are arm64; the guest uptime (17.6 s at the first look at `dems_phone`) confirms a fresh guest, not a restored one.

## 5. Verification (blueprint step 24, verbatim output)

### 5.1 `adb devices`

```
$ adb devices
List of devices attached
emulator-5554	device
emulator-5556	device
emulator-5558	device
```

### 5.2 `sys.boot_completed` and AVD name per serial

```
=== emulator-5554
sys.boot_completed=1
avd_name=dems_phone
=== emulator-5556
sys.boot_completed=1
avd_name=dems_tablet
=== emulator-5558
sys.boot_completed=1
avd_name=dems_phone2
```

### 5.3 Process command lines and PID files

```
dems_phone.pid=84074
  PID  PPID NI ELAPSED COMMAND
84074     1  5   01:05 /Users/gsp-budi/Library/Android/sdk/emulator/qemu/darwin-aarch64/qemu-system-aarch64 -avd dems_phone -port 5554 -no-metrics -gpu host -no-boot-anim -no-snapshot-load -no-snapshot-save
dems_tablet.pid=84299
  PID  PPID NI ELAPSED COMMAND
84299     1  5   00:36 /Users/gsp-budi/Library/Android/sdk/emulator/qemu/darwin-aarch64/qemu-system-aarch64 -avd dems_tablet -port 5556 -no-metrics -gpu host -no-boot-anim -no-snapshot-load -no-snapshot-save
dems_phone2.pid=84494
  PID  PPID NI ELAPSED COMMAND
84494     1  5   00:20 /Users/gsp-budi/Library/Android/sdk/emulator/qemu/darwin-aarch64/qemu-system-aarch64 -avd dems_phone2 -port 5558 -no-metrics -gpu host -no-boot-anim -no-snapshot-load -no-snapshot-save
```

Count of live processes whose command line matches `qemu-system-aarch64 -avd dems_(phone|tablet|phone2) ... -no-snapshot-load -no-snapshot-save`: **3**.

Stability re-check at 06:28:40: PIDs 84074, 84299 and 84494 all alive; `adb devices` unchanged; listeners on 127.0.0.1 and [::1] for 5554/5555, 5556/5557 and 5558/5559 (console and adb port of each emulator); no other process on those ports.

### 5.4 Information only: which DEMS package is installed (read-only, nothing acted on)

```
=== emulator-5554 (dems_phone)
$ adb -s emulator-5554 shell pm list packages | grep dems
package:com.dems.demo.tablet
=== emulator-5556 (dems_tablet)
package:com.dems.demo.tablet
=== emulator-5558 (dems_phone2)
package:com.dems.demo.tablet
```

All three AVDs still hold the DEMS app `com.dems.demo.tablet` (the package of `apps/mobile/app.json:21`): the cold boot kept the data partition, as the plan expects (a cold boot is not a wipe). Its build class (`DEBUG` or `RELEASE-SIGNED`) and signing digest were **not** read: that is W06's job (02_plan section 5.5, DP-1), and this row does not inspect the app. Third-party packages seen beyond that: `com.android.systemui.emulation.pixel_10` and `com.android.internal.emulation.pixel_10` on the two phones (system overlays of the Pixel 10 device profile, not DEMS).

## 6. Unusual points and notes for the controller

| # | Point | Detail | Action taken |
|---|---|---|---|
| 1 | Emulators run at nice 5 | The `NI` column shows 5 for all three, inherited from the agent shell: the R14 effect (agent-started emulators run at background priority; `identification/02_structured.md:919`, Risk Assessment) and the same as `dems_phone2` in D105 of the predecessor task ("runs at nice 5"). The boots were still fast (10 to 14 s) because the host was idle | None. Priority was not changed (the row forbids changing emulator settings). R14's remedy stays the user's: boot from a Terminal |
| 2 | An adb server is now running | PID 83893, `adb -L tcp:5037 fork-server server --reply-fd 4`, started at about 06:26:54 by this row's first `adb` call (none was running before; the adb daemon cannot start inside the sandbox). It is the transport to the three emulators | Left running on purpose: P7 excepts the emulators, and the adb server is their transport; W06, `device-session.sh` (`adb start-server`) and every device row need it, and stopping it would only create a window in which a parallel row's adb call finds no devices for a few seconds. The controller can stop it with `adb kill-server` if it wants P7 read literally. No emulator is affected by that command |
| 3 | The app is present on all three emulators | See 5.4. Pre-existing state from the predecessor task; D105 says `dems_phone2` held the step-72 debug APK (hash-matched), and D78 binds a lane that reboots a down emulator to reinstall that APK. What each emulator holds now was not measured | Not acted on. Input for W06 (build class) and DP-1 (default A, decided by D17) |
| 4 | Logs are in the scratchpad, not in `.locks/` | The predecessor's `.locks/<avd>.emulator.log` files (2026-10-01) were kept as they are; this run's logs went to the session scratchpad | Quoted above. `device-session.sh` will overwrite the `.locks` logs the next time it boots a down emulator |
| 5 | The AVD `multiinstance.lock` files are zero-byte leftovers from 2026-10-01 | They did not stop any boot | None |

## 7. What was not done (by the row's rules)

No APK install, no app start, no `adb reverse`, no emulator setting change, no `-wipe-data`, no snapshot boot or save, no `adb emu kill`, no kill of any process, no `npm run emulator`. Files written: `.locks/dems_phone.pid`, `.locks/dems_tablet.pid`, `.locks/dems_phone2.pid` and the two documents of this row.

## 8. Rollback

H-14: the emulators stay up until the user closes their windows. An agent never kills an emulator. The three PID files record the processes for that purpose.

---
*Generated: 2026-10-04 06:30*
