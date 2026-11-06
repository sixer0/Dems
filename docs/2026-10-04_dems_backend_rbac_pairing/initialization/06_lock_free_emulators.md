VERDICT: PASS

> **What this covers.** Controller row W02b (decision D58). The three PIN-locked Android emulators
> `dems_phone`, `dems_tablet` and `dems_phone2` were shut down gracefully and replaced, on the same
> ports, by three new emulators `dems2_phone`, `dems2_tablet` and `dems2_phone2` that never had a
> screen lock. Each new emulator was booted cold through `apps/mobile/scripts/device-session.sh`,
> shows `isKeyguardShowing=false` with user 0 `RUNNING_UNLOCKED`, holds the current debug APK and
> opens the app in Simulated mode. No PIN, pattern or password was typed anywhere, no lock,
> biometric or other security setting was set, changed or cleared, and the old AVD folders were
> neither deleted, renamed, wiped nor edited.

| Field | Value |
|---|---|
| Task | 2026-10-04_dems_backend_rbac_pairing, controller row W02b (D58), phase initialization |
| Agent | coder-execution (tier R) |
| Evidence tier | 3 (what was done, with the command output) |
| Run window | 2026-10-04 10:31:12 to 10:51 WIB (UTC+7) |
| Tools | Android emulator 37.1.11, adb 1.0.41 (37.0.1-15733141), `avdmanager` of cmdline-tools 23.0, all through a login shell (`zsh -l -c`) or with `ANDROID_HOME=~/Library/Android/sdk` |
| Sandbox | `adb`, the emulator, `avdmanager`, `pgrep`/`ps`/`lsof` and writes under `~/.android/avd` ran with the per-command bypass (P10). Evidence that it is needed: `adb devices` inside the sandbox ends with "could not install *smartsocket* listener: Operation not permitted"; `touch ~/.android/avd/.w02b_write_probe` ends with "Operation not permitted" (no file was created) |
| Raw logs | `implementation/assets/02b_*` (list in section 14) |

## 1. Result at a glance

| | `dems2_phone` | `dems2_tablet` | `dems2_phone2` (reserved) |
|---|---|---|---|
| Serial / console port | `emulator-5554` / 5554 | `emulator-5556` / 5556 | `emulator-5558` / 5558 |
| Device profile | `pixel_10`, 1080x2424, 420 dpi, RAM 3072 | `pixel_tablet`, 2560x1600, 320 dpi, RAM 4096 | `pixel_10`, 1080x2424, 420 dpi, RAM 3072 |
| `config.ini` SHA-256 | `74c9f92c...8f51b02` = old `dems_phone` | `9b5639d5...138a6112` = old `dems_tablet` | `74c9f92c...8f51b02` = old `dems_phone2` |
| PID (`.locks/<avd>.pid`) | 68181 | 68876 | 70102 |
| Booted (through the script) | 10:38:45 to 10:39:22, "Boot completed in 36393 ms" | 10:39:31 to 10:40:33, "Boot completed in 61148 ms" | 10:40:35 to 10:41:47, "Boot completed in 71093 ms" |
| `isKeyguardShowing` | `false` | `false` | `false` |
| User 0 | `RUNNING_UNLOCKED` | `RUNNING_UNLOCKED` | `RUNNING_UNLOCKED` |
| `locksettings get-disabled` (read) | `true` | `true` | `true` |
| Credential type / fingerprints (read) | `NONE` / `"count":0` | `NONE` / `"count":0` | `NONE` / `"count":0` |
| App `com.dems.demo.tablet` | `versionCode=100`, `versionName=0.1.0` | same | same |
| `firstInstallTime` | 2026-10-04 10:43:16 | 2026-10-04 10:43:24 | 2026-10-04 10:43:32 |
| `base.apk` SHA-256 on the device | `d89c9be3...8a14ec` = host APK | same | same |
| Launch check (`13_launch_check.sh`) | status 0, 10:46:51 | status 0, 10:44:50 | status 0, 10:46:07 |
| Screencap (app in Simulated mode) | `implementation/assets/02b_dems2_phone_launch.png` | `implementation/assets/02b_dems2_tablet_launch.png` | `implementation/assets/02b_dems2_phone2_launch.png` |
| Reverse rules left | none | none | none |

Old emulators: PIDs 84074 (`dems_phone`), 84299 (`dems_tablet`) and 84494 (`dems_phone2`) were
stopped by this row with `adb emu kill` (D58 is the recorded exception to "never kill an
emulator"). Their AVD folders are still in `~/.android/avd`, not running, with `config.ini` and
`<avd>.ini` byte-identical to the before state (section 10.3).

Script: `apps/mobile/scripts/device-session.sh` addresses `dems2_*` by default, the old AVDs with
`DEMS_AVD_PREFIX=dems_`, and stops with exit status **77** on a device with a secure screen lock
(section 3).

## 2. Before state (read-only, 10:31:24 to 10:31:41)

```
$ adb devices -l
List of devices attached
emulator-5554          device product:sdk_gphone64_arm64 model:sdk_gphone64_arm64 device:emu64a transport_id:1
emulator-5556          device product:sdk_gphone64_arm64 model:sdk_gphone64_arm64 device:emu64a transport_id:2
emulator-5558          device product:sdk_gphone64_arm64 model:sdk_gphone64_arm64 device:emu64a transport_id:3

$ ps -axo pid,ppid,nice,etime,rss,command | grep -E "qemu-system|emulator -avd"
84074     1  5    04:04:04 447072 .../qemu-system-aarch64 -avd dems_phone -port 5554 -no-metrics -gpu host -no-boot-anim -no-snapshot-load -no-snapshot-save
84299     1  5    04:03:35 280992 .../qemu-system-aarch64 -avd dems_tablet -port 5556 -no-metrics -gpu host -no-boot-anim -no-snapshot-load -no-snapshot-save
84494     1  5    04:03:19 314912 .../qemu-system-aarch64 -avd dems_phone2 -port 5558 -no-metrics -gpu host -no-boot-anim -no-snapshot-load -no-snapshot-save
$ .locks pid files
dems_phone.pid=84074
dems_tablet.pid=84299
dems_phone2.pid=84494
=== emulator-5554
avd_name=dems_phone
sys.boot_completed=1
isKeyguardShowing=true
State: RUNNING_LOCKED
versionCode=100 minSdk=24 targetSdk=36
versionName=0.1.0
lastUpdateTime=2026-10-04 07:08:42
firstInstallTime=2026-10-01 10:45:40
reverse: [;]
=== emulator-5556
avd_name=dems_tablet
sys.boot_completed=1
isKeyguardShowing=true
State: RUNNING_LOCKED
versionCode=100 minSdk=24 targetSdk=36
versionName=0.1.0
lastUpdateTime=2026-10-04 07:15:40
firstInstallTime=2026-10-01 11:03:12
reverse: [;]
=== emulator-5558
avd_name=dems_phone2
sys.boot_completed=1
isKeyguardShowing=true
State: RUNNING_LOCKED
versionCode=100 minSdk=24 targetSdk=36
versionName=0.1.0
lastUpdateTime=2026-10-04 07:15:52
firstInstallTime=2026-10-01 10:05:38
reverse: [;]
```

Host memory and disk:

```
$ uptime
10:31  up 2 days, 17:44, 1 user, load averages: 4.38 3.56 2.85
$ vm_stat   (page size of 16384 bytes)
Pages free:                                     9110.
Pages active:                                 360655.
Pages inactive:                               359929.
Pages wired down:                             185026.
$ memory_pressure | tail -1
System-wide memory free percentage: 47%
$ sysctl hw.memsize vm.swapusage
hw.memsize: 25769803776
vm.swapusage: total = 5120.00M  used = 3700.88M  free = 1419.12M  (encrypted)
$ df -h /
/dev/disk3s5     926Gi   228Gi   667Gi    26%    2.4M  7.0G    0%   /System/Volumes/Data
```

AVDs and their folders:

```
$ zsh -l -c 'avdmanager list avd'
Available Android Virtual Devices:
    Name: dems_phone
  Device: pixel_10 (Google)
    Path: /Users/gsp-budi/.android/avd/dems_phone.avd
  Target: Google APIs (Google Inc.)
          Based on: Android 16.0 ("Baklava") Tag/ABI: google_apis/arm64-v8a
  Sdcard: 512 MB
---------
    Name: dems_phone2
  Device: pixel_10 (Google)
    Path: /Users/gsp-budi/.android/avd/dems_phone2.avd
  ...
---------
    Name: dems_tablet
  Device: pixel_tablet (Google)
    Path: /Users/gsp-budi/.android/avd/dems_tablet.avd
  ...
$ ls -la ~/.android/avd
drwxr-xr-x@ 25 gsp-budi  staff  800 Oct  4 06:27 dems_phone.avd
-rw-r--r--@  1 gsp-budi  staff  118 Oct  1 00:08 dems_phone.ini
drwxr-xr-x@ 24 gsp-budi  staff  768 Oct  4 06:28 dems_phone2.avd
-rw-r--r--@  1 gsp-budi  staff  120 Oct  1 10:04 dems_phone2.ini
drwxr-xr-x@ 25 gsp-budi  staff  800 Oct  4 06:27 dems_tablet.avd
-rw-r--r--@  1 gsp-budi  staff  120 Oct  1 00:06 dems_tablet.ini
$ du -sk
6268020	/Users/gsp-budi/.android/avd/dems_phone.avd
7429860	/Users/gsp-budi/.android/avd/dems_tablet.avd
2450372	/Users/gsp-budi/.android/avd/dems_phone2.avd
$ stat config.ini / .ini
dems_phone.avd/config.ini 3570 bytes mtime=2026-10-01 00:08:18
dems_phone2.avd/config.ini 3570 bytes mtime=2026-10-01 10:04:39
dems_tablet.avd/config.ini 3572 bytes mtime=2026-10-01 00:07:09
dems_phone.ini 118 bytes mtime=2026-10-01 00:08:14
dems_phone2.ini 120 bytes mtime=2026-10-01 10:04:30
dems_tablet.ini 120 bytes mtime=2026-10-01 00:06:47
$ shasum -a 256
74c9f92c4f43cc2e40aab82066994c56e05ef4604bdd969c219e463cd8f51b02  dems_phone.avd/config.ini
74c9f92c4f43cc2e40aab82066994c56e05ef4604bdd969c219e463cd8f51b02  dems_phone2.avd/config.ini
9b5639d5c7f7f53be4e0e53b17d62e51c117b34d7694996082aa4eee138a6112  dems_tablet.avd/config.ini
d9aecbe20615373cb1de01029d037121753a00428383a13cc9a1052a95df6ba7  dems_phone.ini
03b1318c28b7dda3affd26d0d0cdd53eeca9d00355f1582eb77c7e3d89b3329f  dems_phone2.ini
33d34ac0eb40c85ee469eb8acb599f057c167c2ec88f1f52bda88a934de0335c  dems_tablet.ini
```

A full file list (name, size, mtime) of each old AVD folder was taken at 10:31:41 for the later
comparison: 31, 31 and 24 files.

## 3. Names (step 2)

New AVD names: `dems2_phone`, `dems2_tablet`, `dems2_phone2`. `avdmanager list avd` (above) showed
only the three old AVDs, and `ls -la ~/.android/avd | grep -c dems2_` printed `0`: no AVD of
those names existed. `avdmanager list device -c` lists both `pixel_10` and `pixel_tablet`, and
`~/Library/Android/sdk/system-images/android-36/google_apis/arm64-v8a` is installed, so no SDK
component had to be installed.

## 4. The script change (step 3)

### 4.1 Pre-image (P23)

```
$ git diff acaff20 -- apps/mobile/scripts/device-session.sh > .cache/rollback/W02b.pre.patch
git diff exit=0
-rw-r--r--@ 1 gsp-budi  staff  3294 Oct  4 10:32 .cache/rollback/W02b.pre.patch
88bc2317e07afe67a48f020b321d4cb39d63e4f33a4f406ad47a44dde479e0d8  .cache/rollback/W02b.pre.patch
 apps/mobile/scripts/device-session.sh | 25 ++++++++++++++++++++++++-
 1 file changed, 24 insertions(+), 1 deletion(-)
```

The patch holds step 35's change (`DEMS_CORE_HOST_PORT`), as expected. Proof on a scratch copy:
`git show acaff20:apps/mobile/scripts/device-session.sh` plus `git apply W02b.pre.patch` gave a
file that `cmp` reports identical to the file as this row found it (SHA-256
`db4cf1093d1dd0c319436f4ee13fa39e49e8d4f3c09f2252c1c9c9511bd0bdd4`, 23,431 bytes).

### 4.2 What changed

Full diff against the pre-image: `implementation/assets/02b_device_session.diff` (178 lines).
`git diff --stat acaff20`: 100 insertions, 16 deletions (step 35's change included). File mode
unchanged (`-rwxr-xr-x`), 27,589 bytes, SHA-256
`f25f3096c35fd3178c6ae9e3bcfbcff99fe6d7ce1871b58402af47089cff93bf`.

The code hunks:

```diff
+# AVD-name prefix (row W02b, D58). The AVD of a target is "$AVD_PREFIX<target>": dems2_phone,
+# dems2_phone2 and dems2_tablet by default (created without a screen lock); DEMS_AVD_PREFIX=dems_
+# addresses the older AVDs. Lock files, target names, serials and ports never depend on it. Checked
+# before any lock is taken: the value goes into a pgrep pattern and into file names.
+AVD_PREFIX="${DEMS_AVD_PREFIX:-dems2_}"
+case "$AVD_PREFIX" in
+  *[!A-Za-z0-9_]*)
+    echo "DEMS_AVD_PREFIX must hold only letters, digits and underscores (got '$AVD_PREFIX')" >&2
+    exit 64
+    ;;
+esac
...
-avd_process() { pgrep -f -- "(qemu-system-[a-z0-9_]+|emulator) -avd dems_$1( |\$)" 2>/dev/null | head -n 1; }
+avd_process() { pgrep -f -- "(qemu-system-[a-z0-9_]+|emulator) -avd ${AVD_PREFIX}$1( |\$)" 2>/dev/null | head -n 1; }
...
 ensure_avd() {
   s=$(serial_of "$1")
-  name="dems_$1"
+  name="${AVD_PREFIX}$1"
...
-log "session serial:$ALL_SERIALS ($(for a in $AVDS; do printf 'dems_%s ' "$a"; done | sed 's/ $//'))${DEMS_SESSION_TARGET:+; picked by $DEMS_SESSION_TARGET}"
+log "session serial:$ALL_SERIALS ($(for a in $AVDS; do printf '%s%s ' "$AVD_PREFIX" "$a"; done | sed 's/ $//'))${DEMS_SESSION_TARGET:+; picked by $DEMS_SESSION_TARGET}"
...
-  AVD_NAME=dems_$AVD
+  AVD_NAME=${AVD_PREFIX}$AVD
   export SERIAL ANDROID_SERIAL AVD_NAME
 fi

+keyguard_state() { adb -s "$1" shell dumpsys window 2>/dev/null | tr -d '\r' | grep -o 'isKeyguardShowing=[a-z]*' | head -n 1; }
+check_keyguard() { # $1 = serial; 0 = no keyguard (or its state cannot be read), 1 = secure lock
+  adb -s "$1" shell input keyevent KEYCODE_WAKEUP >/dev/null 2>&1
+  adb -s "$1" shell wm dismiss-keyguard >/dev/null 2>&1
+  kn=0
+  while kg=$(keyguard_state "$1") && [ "$kg" = "isKeyguardShowing=true" ] && [ "$kn" -lt 10 ]; do
+    sleep 1
+    kn=$((kn + 1))
+  done
+  case "$kg" in
+    isKeyguardShowing=false) log "$1: screen awake, no keyguard" ;;
+    isKeyguardShowing=true)
+      log "$1: LOCKED. The keyguard still shows after wake + dismiss, so this device has a secure screen lock (PIN, pattern or password)"
+      log "$1: no agent unlocks a device; this script enters no credential and changes no lock setting (D35, D49). The user unlocks it, or use a lock-free AVD (DEMS_AVD_PREFIX, default dems2_)"
+      return 1
+      ;;
+    *) log "$1: WARNING could not read the keyguard state (dumpsys window); going on" ;;
+  esac
+}
+for s in $SERIALS; do check_keyguard "$s" || exit 77; done
```

In words:

| Item | Before | After |
|---|---|---|
| AVD of a target | literal `dems_<target>` | `${DEMS_AVD_PREFIX:-dems2_}<target>`; a value with any character other than letters, digits and underscore is refused with exit 64 before any lock |
| Lock files | `.locks/dems_<target>.lock` | unchanged |
| Targets, serials, ports | `phone` 5554, `phone2` 5558, `tablet` 5556 | unchanged |
| PID file and emulator log of a boot | `.locks/dems_<target>.pid`, `.emulator.log` | `.locks/<AVD name>.pid`, `.emulator.log` (the script's existing `$name` naming): `dems2_phone.pid` by default, `dems_phone.pid` with the old prefix |
| Exported `AVD_NAME`, "session serial" log line | `dems_<target>` | the real AVD name, prefix included (deviation DV-1, section 13) |
| After the device is confirmed up | straight to force-stop, Metro, reverse rules | first: `input keyevent KEYCODE_WAKEUP`, `wm dismiss-keyguard`, then a read of `isKeyguardShowing` (polled for up to 10 s). `false`: go on. Still `true`: two log lines and **exit 77**; no Metro, no reverse rule, `<commands>` do not run. State unreadable: a warning, and the session goes on |
| Header and usage text | named `dems_*` as the AVDs | names the prefix, the default AVDs, the old ones, step 1b, `AVD_NAME`, `DEMS_AVD_PREFIX`, exit 77; `usage` lists `[DEMS_AVD_PREFIX=dems2_]` |

The check enters nothing into a lock screen and runs no `locksettings` command. On a device with a
secure lock `wm dismiss-keyguard` only brings up the device's own unlock prompt; the script then
reads the state and stops.

Left as they are (not part of this row; listed for the controller): the log line "booted cold;
D78: reinstall the current step-72 debug APK" in `ensure_avd` (step 35's F-9), `SHOTS` pointing at
the predecessor's task folder, and the target aliases `dems_phone | dems_phone2 | dems_tablet` in
the argument `case` (section 12, F-3).

### 4.3 Syntax checks and the usage path (final file)

```
sh -n OK
bash -n OK
zsh -n OK
-rwxr-xr-x@ 1 gsp-budi  staff  27589 Oct  4 10:49 apps/mobile/scripts/device-session.sh
f25f3096c35fd3178c6ae9e3bcfbcff99fe6d7ce1871b58402af47089cff93bf  apps/mobile/scripts/device-session.sh

$ apps/mobile/scripts/device-session.sh
usage: [METRO_PORT=8081..8086] [NO_METRO=1] [DEMS_CORE_HOST_PORT=4420..4423] [DEMS_AVD_PREFIX=dems2_] [DEVICE_SESSION_MAX_SECONDS=1800] apps/mobile/scripts/device-session.sh any-phone|any|phone|phone2|tablet|both '<commands>'
exit=64
$ apps/mobile/scripts/device-session.sh phone                 -> usage, exit=64
$ apps/mobile/scripts/device-session.sh nosuch true           -> usage, exit=64
$ DEMS_AVD_PREFIX='dems_;x' ... phone true
DEMS_AVD_PREFIX must hold only letters, digits and underscores (got 'dems_;x')
exit=64
$ DEMS_AVD_PREFIX='de ms' ... phone true      -> same message, exit=64
$ DEMS_AVD_PREFIX='dems-' ... phone true      -> same message, exit=64
$ DEMS_CORE_HOST_PORT=4420x ... phone true
DEMS_CORE_HOST_PORT must be 4420-4423 (P4) (got '4420x')
exit=64
$ DEVICE_SESSION_MAX_SECONDS=0 ... phone true
DEVICE_SESSION_MAX_SECONDS must be a whole number of seconds above 0 (got '0')
exit=64
```

(`zsh -n` inside the sandbox also prints two "nice(5) failed: operation not permitted" lines for
the two background jobs in the file; that is the sandbox, not a syntax message.)

The device runs of sections 7 to 10 used the file with SHA-256 `585ba5d2...845b6c6b`. One header
comment was reflowed afterwards (10:49). `grep -v '^#'` of both versions is identical (`cmp`):
"CODE IDENTICAL". The final file was then run again on all three emulators (section 11.2).

### 4.4 Dry run with a stub `adb`: the locked-device path, without a locked device

Method (as step 35): the pre-image and the new script each run in their own scratch root with
stubs for `adb`, `pgrep` and the emulator binary that record their arguments and talk to no
device; `NO_METRO=1`, so no Metro. The stub `adb` answers `dumpsys window` from a state file: a
secure lock keeps `isKeyguardShowing=true`, a keyguard without a credential turns `false` when
`wm dismiss-keyguard` is called. Harness: `implementation/assets/02b_device_session_dry_run.sh`;
trace: `implementation/assets/02b_device_session_dry_run.txt`.

```
== W02b dry run 2026-10-04 10:50:01
pre-image sha256: db4cf1093d1dd0c319436f4ee13fa39e49e8d4f3c09f2252c1c9c9511bd0bdd4
new       sha256: f25f3096c35fd3178c6ae9e3bcfbcff99fe6d7ce1871b58402af47089cff93bf

---- summary
old_running_unlocked: exit=0 adb calls=7 commands ran=yes (0 s)
new_running_unlocked: exit=0 adb calls=10 commands ran=yes (0 s)
new_running_secure_lock: exit=77 adb calls=17 commands ran=no (11 s)
new_running_swipe_keyguard: exit=0 adb calls=10 commands ran=yes (0 s)
new_running_unreadable: exit=0 adb calls=10 commands ran=yes (0 s)
new_down_default_prefix: exit=0 adb calls=10 commands ran=yes (0 s)
new_down_old_prefix: exit=0 adb calls=10 commands ran=yes (0 s)
new_down_tablet: exit=0 adb calls=10 commands ran=yes (1 s)
new_down_phone2: exit=0 adb calls=10 commands ran=yes (0 s)
new_both_tablet_locked: exit=77 adb calls=24 commands ran=no (10 s)
new_secure_lock_keep_app: exit=77 adb calls=16 commands ran=no (10 s)
new_any_phone_secure_lock: exit=77 adb calls=17 commands ran=no (11 s)

---- old vs new on a running, unlocked device: adb trace diff (expected: only the three added calls)
3a4,6
> adb -s emulator-5554 shell input keyevent KEYCODE_WAKEUP
> adb -s emulator-5554 shell wm dismiss-keyguard
> adb -s emulator-5554 shell dumpsys window
```

The secure-lock case (`new_running_secure_lock`):

```
adb start-server
adb -s emulator-5554 get-state
adb -s emulator-5554 shell getprop sys.boot_completed
adb -s emulator-5554 shell input keyevent KEYCODE_WAKEUP
adb -s emulator-5554 shell wm dismiss-keyguard
adb -s emulator-5554 shell dumpsys window
   ... (10 more identical dumpsys window calls: the 10 s poll)
adb -s emulator-5554 shell am force-stop com.dems.demo.tablet
[device-session phone HH:MM:SS] lock held; hard cap 120 s, until HH:MM:SS (watchdog PID N)
[device-session phone HH:MM:SS] session serial: emulator-5554 (dems2_phone)
[device-session phone HH:MM:SS] emulator-5554: LOCKED. The keyguard still shows after wake + dismiss, so this device has a secure screen lock (PIN, pattern or password)
[device-session phone HH:MM:SS] emulator-5554: no agent unlocks a device; this script enters no credential and changes no lock setting (D35, D49). The user unlocks it, or use a lock-free AVD (DEMS_AVD_PREFIX, default dems2_)
[device-session phone HH:MM:SS] session ended with status 77
```

No `reverse` call, `<commands>` did not run (their marker file was not written), and the only call
after the check is the cleanup's `am force-stop` (absent with `KEEP_APP=1`, case
`new_secure_lock_keep_app`). The same status comes back through `any-phone` and through `both`
when only the tablet is locked.

The prefix (`new_down_default_prefix`, `new_down_old_prefix`, `new_down_tablet`, `new_down_phone2`):

```
=== new_down_default_prefix: stub pgrep calls
pgrep -f -- (qemu-system-[a-z0-9_]+|emulator) -avd dems2_phone( |$)
=== new_down_default_prefix: stub emulator calls
emulator -avd dems2_phone -port 5554 -no-metrics -gpu host -no-boot-anim -no-snapshot-load -no-snapshot-save
=== new_down_default_prefix: what <commands> saw
AVD_NAME=dems2_phone SERIAL=emulator-5554
=== new_down_default_prefix: .locks of the scratch root
dems2_phone.emulator.log dems2_phone.pid dems_phone.lock

=== new_down_old_prefix (DEMS_AVD_PREFIX=dems_): stub pgrep calls
pgrep -f -- (qemu-system-[a-z0-9_]+|emulator) -avd dems_phone( |$)
=== new_down_old_prefix: stub emulator calls
emulator -avd dems_phone -port 5554 -no-metrics -gpu host -no-boot-anim -no-snapshot-load -no-snapshot-save
=== new_down_old_prefix: what <commands> saw
AVD_NAME=dems_phone SERIAL=emulator-5554
=== new_down_old_prefix: .locks of the scratch root
dems_phone.emulator.log dems_phone.lock dems_phone.pid

=== new_down_tablet: stub emulator calls
emulator -avd dems2_tablet -port 5556 -no-metrics -gpu host -no-boot-anim -no-snapshot-load -no-snapshot-save
=== new_down_phone2: stub emulator calls
emulator -avd dems2_phone2 -port 5558 -no-metrics -gpu host -no-boot-anim -no-snapshot-load -no-snapshot-save
```

The old prefix was proven with the stub only. The old AVDs were not booted again (their ports are
in use by the new emulators, and they would sit at the PIN keyguard).

## 5. The new AVDs (step 4)

### 5.1 Creation

A first attempt at 10:36:57 ran `avdmanager` with an empty `-d` (my shell loop did not split the
"name device" pair in zsh); `avdmanager` answered "Error: Missing argument for flag -d." and its
usage text three times and created nothing (`ls -la ~/.android/avd` still showed only the three old
AVDs). The commands were then run explicitly:

```
== 2026-10-04 10:37:06 WIB
$ zsh -l -c 'echo no | avdmanager create avd -n dems2_phone -k "system-images;android-36;google_apis;arm64-v8a" -d pixel_10'
exit=0
Loading local repository...
Auto-selecting single ABI arm64-v8a
$ zsh -l -c 'echo no | avdmanager create avd -n dems2_tablet -k "system-images;android-36;google_apis;arm64-v8a" -d pixel_tablet'
exit=0
Loading local repository...
Auto-selecting single ABI arm64-v8a
$ zsh -l -c 'echo no | avdmanager create avd -n dems2_phone2 -k "system-images;android-36;google_apis;arm64-v8a" -d pixel_10'
exit=0
Loading local repository...
Auto-selecting single ABI arm64-v8a
```

(`echo no` answers the "custom hardware profile?" question.) Each call wrote
`~/.android/avd/<name>.ini` (120 or 122 bytes) and `~/.android/avd/<name>.avd/config.ini`, nothing
else; the disk images are made by the emulator at the first boot.

```
--- dems2_phone.ini
avd.ini.encoding=UTF-8
path=/Users/gsp-budi/.android/avd/dems2_phone.avd
path.rel=avd/dems2_phone.avd
target=android-36
```

### 5.2 `config.ini`: old versus `avdmanager`'s default

```
=== diff OLD dems_phone/config.ini  vs  NEW (avdmanager default) dems2_phone/config.ini
9c9
< disk.dataPartition.size=8G
---
> disk.dataPartition.size=10G
23c23
< hw.audioInput=no
---
> hw.audioInput=yes
26c26
< hw.camera.back=none
---
> hw.camera.back=emulated
72,73c72,73
< hw.gpu.enabled=yes
< hw.gpu.mode=host
---
> hw.gpu.enabled=no
> hw.gpu.mode=auto
78c78
< hw.keyboard=yes
---
> hw.keyboard=no
91c91
< hw.ramSize=3072
---
> hw.ramSize=2G
130c130
< showDeviceFrame=no
---
> showDeviceFrame=yes
```

`dems_phone2` versus `dems2_phone2`: the same eight lines. `dems_tablet` versus `dems2_tablet`: the
same, with `hw.ramSize=4096` on the old side, plus one more line:

```
77,78c77,78
< hw.initialOrientation=landscape
< hw.keyboard=yes
---
> hw.initialOrientation=portrait
> hw.keyboard=no
```

These are exactly the keys the predecessor changed after creating the old AVDs
(`docs/2026-09-30_dems_demo_stack_setup/initialization/05_avds.md:66-104`). LCD size and density,
`fastboot.*`, `hw.camera.front=none`, the system image and every other key already matched; there
is no `skin.*` key on either side.

### 5.3 Alignment and the resulting diff

Each key was replaced in place in the NEW `config.ini` (one `perl -pi` substitution per key, after
checking that the key occurs exactly once). No file was copied from an old AVD folder; the old
`config.ini` files were only read.

```
== 2026-10-04 10:37:31 WIB
dems2_phone.avd/config.ini:  set disk.dataPartition.size=8G hw.audioInput=no hw.camera.back=none hw.camera.front=none hw.gpu.enabled=yes hw.gpu.mode=host hw.keyboard=yes showDeviceFrame=no hw.ramSize=3072 hw.initialOrientation=portrait
dems2_phone2.avd/config.ini: set disk.dataPartition.size=8G hw.audioInput=no hw.camera.back=none hw.camera.front=none hw.gpu.enabled=yes hw.gpu.mode=host hw.keyboard=yes showDeviceFrame=no hw.ramSize=3072 hw.initialOrientation=portrait
dems2_tablet.avd/config.ini: set disk.dataPartition.size=8G hw.audioInput=no hw.camera.back=none hw.camera.front=none hw.gpu.enabled=yes hw.gpu.mode=host hw.keyboard=yes showDeviceFrame=no hw.ramSize=4096 hw.initialOrientation=landscape

=== diff OLD dems_phone.avd/config.ini  vs  NEW dems2_phone.avd/config.ini (after the key edits)
IDENTICAL (no difference)
=== diff OLD dems_tablet.avd/config.ini  vs  NEW dems2_tablet.avd/config.ini (after the key edits)
IDENTICAL (no difference)
=== diff OLD dems_phone2.avd/config.ini  vs  NEW dems2_phone2.avd/config.ini (after the key edits)
IDENTICAL (no difference)

$ shasum -a 256 (old and new config.ini)
74c9f92c4f43cc2e40aab82066994c56e05ef4604bdd969c219e463cd8f51b02  dems_phone.avd/config.ini
74c9f92c4f43cc2e40aab82066994c56e05ef4604bdd969c219e463cd8f51b02  dems_phone2.avd/config.ini
9b5639d5c7f7f53be4e0e53b17d62e51c117b34d7694996082aa4eee138a6112  dems_tablet.avd/config.ini
74c9f92c4f43cc2e40aab82066994c56e05ef4604bdd969c219e463cd8f51b02  dems2_phone.avd/config.ini
74c9f92c4f43cc2e40aab82066994c56e05ef4604bdd969c219e463cd8f51b02  dems2_phone2.avd/config.ini
9b5639d5c7f7f53be4e0e53b17d62e51c117b34d7694996082aa4eee138a6112  dems2_tablet.avd/config.ini
```

**Remaining differences between an old and its new `config.ini`: none** (same bytes). The
`config.ini` holds no AVD name (`avd.name=<build>`), so the only difference between an old and a
new AVD definition is the path in `<name>.ini`. The hashes were the same again after the first
boot (the emulator does not rewrite `config.ini`). What differs is the content of the data
partition: the new AVDs start from the empty system-image state, the old ones hold the lock, the
enrolled fingerprint, the app data and an older install history.

Keys of interest in the new files:

| Key | `dems2_phone`, `dems2_phone2` | `dems2_tablet` |
|---|---|---|
| `hw.device.name` | `pixel_10` | `pixel_tablet` |
| `hw.lcd.width` x `hw.lcd.height`, `hw.lcd.density` | 1080 x 2424, 420 | 2560 x 1600, 320 |
| `hw.ramSize` | 3072 | 4096 |
| `hw.gpu.enabled` / `hw.gpu.mode` | yes / host | yes / host |
| `hw.keyboard` | yes | yes |
| `disk.dataPartition.size` | 8G | 8G |
| `hw.camera.back` / `hw.camera.front` | none / none | none / none |
| `hw.audioInput` | no | no |
| `hw.initialOrientation` | portrait | landscape |
| `showDeviceFrame` | no | no |
| `fastboot.forceChosenSnapshotBoot` / `forceColdBoot` / `forceFastBoot` | no / no / yes (as the old ones; the cold boot comes from the command-line flags) | same |
| `image.sysdir.1` | `system-images/android-36/google_apis/arm64-v8a/` | same |
| `PlayStore.enabled`, `tag.id` | no, `google_apis` | same |

## 6. Graceful shutdown of the old emulators (step 5)

Each emulator was stopped under its device lock, taken without blocking (`lockf -k -t 0`; a busy
lock would have been waited for up to 600 s; none was busy). The helper checked that the PID of
`.locks/<avd>.pid` is the emulator of that AVD on that port and that `adb emu avd name` agrees,
ran `adb -s <serial> emu kill`, and waited for the process and the two ports to go. No `kill`
signal, no `-wipe-data`. Log: `implementation/assets/02b_log_stop_old.txt`.

```
== W02b step 5 2026-10-04 10:38:16 WIB
$ /usr/bin/lockf -k -t 0 .locks/dems_phone.lock /bin/sh stop_old.sh emulator-5554 dems_phone 84074
== emulator-5554 (dems_phone, PID 84074) 10:38:16: device lock held
process check: PID 84074 is the emulator of dems_phone on port 5554
reverse rules before: [;]
$ adb -s emulator-5554 emu kill
OK: killing emulator, bye bye
OK
(exit=0)
PID 84074 gone after 1 s (10:38:17)
ports 5554 and 5555: no listener (after 0 s)
$ pgrep -fl -- '-avd dems_phone( |$)'
(no process)
$ adb devices
List of devices attached
emulator-5556	device
emulator-5558	device

== emulator-5554 stopped by row W02b (D58): old PID 84074
stop dems_phone: status 0

$ /usr/bin/lockf -k -t 0 .locks/dems_tablet.lock /bin/sh stop_old.sh emulator-5556 dems_tablet 84299
== emulator-5556 (dems_tablet, PID 84299) 10:38:17: device lock held
process check: PID 84299 is the emulator of dems_tablet on port 5556
reverse rules before: [;]
$ adb -s emulator-5556 emu kill
OK: killing emulator, bye bye
OK
(exit=0)
PID 84299 gone after 3 s (10:38:20)
ports 5556 and 5557: no listener (after 0 s)
(no process)
== emulator-5556 stopped by row W02b (D58): old PID 84299
stop dems_tablet: status 0

$ /usr/bin/lockf -k -t 0 .locks/dems_phone2.lock /bin/sh stop_old.sh emulator-5558 dems_phone2 84494
== emulator-5558 (dems_phone2, PID 84494) 10:38:20: device lock held
process check: PID 84494 is the emulator of dems_phone2 on port 5558
reverse rules before: [;]
$ adb -s emulator-5558 emu kill
OK: killing emulator, bye bye
OK
(exit=0)
PID 84494 gone after 2 s (10:38:22)
ports 5558 and 5559: no listener (after 0 s)
(no process)
== emulator-5558 stopped by row W02b (D58): old PID 84494
stop dems_phone2: status 0

final status=0
$ ps (emulator processes)
(end)
$ adb devices
List of devices attached

$ lsof listeners 5554-5559
(end)
```

**Processes stopped by this row:** 84074, 84299, 84494 (the three old emulators; D58). Nothing
else was stopped. The adb server (PID 83893, started by step 24) was left running.

## 7. Cold boot of the new emulators through the script (step 6)

One after another, through the changed script's own `ensure_avd` (so the script is proven to boot
them), with `BOOT_WAIT=600` for the first boot. Log: `implementation/assets/02b_log_boot.txt`.

```
== W02b step 6 phone 2026-10-04 10:38:45 WIB
$ NO_METRO=1 BOOT_WAIT=600 apps/mobile/scripts/device-session.sh phone '<read-only state commands>'
[device-session phone 10:38:45] lock held; hard cap 900 s, until 10:53:45 (watchdog PID 68166)
[device-session phone 10:38:45] session serial: emulator-5554 (dems2_phone)
[device-session phone 10:38:45] dems2_phone (emulator-5554) is down; booting it cold the P3/D78 way (-no-snapshot-load -no-snapshot-save)
[device-session phone 10:38:45] dems2_phone PID 68181 written to .locks/dems2_phone.pid
[device-session phone 10:39:22] dems2_phone booted cold; D78: reinstall the current step-72 debug APK (hash-verified) before testing
[device-session phone 10:39:22] emulator-5554: screen awake, no keyguard
[device-session phone 10:39:22] no Metro (NO_METRO=1); tcp:4400 -> tcp:4400 on emulator-5554
in session: AVD_NAME=dems2_phone SERIAL=emulator-5554
emu avd name: dems2_phone
sys.boot_completed=1
isKeyguardShowing=false
uptime: 32.09 66.98
[device-session phone 10:39:23] session ended with status 0
session exit=0

== W02b step 6 tablet 2026-10-04 10:39:31 WIB
[device-session tablet 10:39:31] session serial: emulator-5556 (dems2_tablet)
[device-session tablet 10:39:31] dems2_tablet (emulator-5556) is down; booting it cold the P3/D78 way (-no-snapshot-load -no-snapshot-save)
[device-session tablet 10:39:31] dems2_tablet PID 68876 written to .locks/dems2_tablet.pid
[device-session tablet 10:40:33] dems2_tablet booted cold; D78: reinstall the current step-72 debug APK (hash-verified) before testing
[device-session tablet 10:40:33] emulator-5556: screen awake, no keyguard
[device-session tablet 10:40:34] no Metro (NO_METRO=1); tcp:4400 -> tcp:4400 on emulator-5556
in session: AVD_NAME=dems2_tablet SERIAL=emulator-5556
emu avd name: dems2_tablet
sys.boot_completed=1
isKeyguardShowing=false
uptime: 60.43 115.64
[device-session tablet 10:40:34] session ended with status 0
session exit=0

== W02b step 6 phone2 2026-10-04 10:40:35 WIB
[device-session phone2 10:40:35] session serial: emulator-5558 (dems2_phone2)
[device-session phone2 10:40:35] dems2_phone2 (emulator-5558) is down; booting it cold the P3/D78 way (-no-snapshot-load -no-snapshot-save)
[device-session phone2 10:40:35] dems2_phone2 PID 70102 written to .locks/dems2_phone2.pid
[device-session phone2 10:41:47] dems2_phone2 booted cold; D78: reinstall the current step-72 debug APK (hash-verified) before testing
[device-session phone2 10:41:48] emulator-5558: screen awake, no keyguard
[device-session phone2 10:41:49] no Metro (NO_METRO=1); tcp:4400 -> tcp:4400 on emulator-5558
in session: AVD_NAME=dems2_phone2 SERIAL=emulator-5558
emu avd name: dems2_phone2
sys.boot_completed=1
isKeyguardShowing=false
uptime: 70.88 131.18
[device-session phone2 10:41:49] session ended with status 0
session exit=0
```

Processes, PID files and the cold-boot lines of the emulator logs (10:42:21):

```
dems2_phone.pid=68181
  PID  PPID NI ELAPSED COMMAND
68181     1  0   03:36 /Users/gsp-budi/Library/Android/sdk/emulator/qemu/darwin-aarch64/qemu-system-aarch64 -avd dems2_phone -port 5554 -no-metrics -gpu host -no-boot-anim -no-snapshot-load -no-snapshot-save
  log (.locks/dems2_phone.emulator.log):
    USER_INFO    | Emulator is performing a full startup. This may take upto two minutes, or more.
    INFO         | Boot completed in 36393 ms
dems2_tablet.pid=68876
68876     1  0   02:50 .../qemu-system-aarch64 -avd dems2_tablet -port 5556 -no-metrics -gpu host -no-boot-anim -no-snapshot-load -no-snapshot-save
    USER_INFO    | Emulator is performing a full startup. This may take upto two minutes, or more.
    INFO         | Boot completed in 61148 ms
dems2_phone2.pid=70102
70102     1  0   01:46 .../qemu-system-aarch64 -avd dems2_phone2 -port 5558 -no-metrics -gpu host -no-boot-anim -no-snapshot-load -no-snapshot-save
    USER_INFO    | Emulator is performing a full startup. This may take upto two minutes, or more.
    INFO         | Boot completed in 71093 ms
$ pgrep -fl with the script pattern (default prefix): 68181, 68876, 70102 (one line each)
$ pgrep with the old prefix (must find nothing)
(end)
```

`grep -c -E 'ERROR|FATAL|wipe'` gives 0 for each of the three logs. The only "snapshot" hits are a
Qt warning about the type `SnapshotInfo` (lines 93-94 of each log), not a snapshot load. The
emulators run at nice 0 (the old ones ran at nice 5).

## 8. Lock state of the new emulators (step 7, read-only, 10:42:07)

Log: `implementation/assets/02b_log_lock_state.txt`. Every command below is a query; nothing was
written. No `locksettings` sub-command other than `get-disabled` was run in this row.

```
=== emulator-5554  avd_name=dems2_phone  sys.boot_completed=1
$ adb -s emulator-5554 shell dumpsys window | grep -E 'isKeyguardShowing|mCurrentFocus|mDreamingLockscreen'
mCurrentFocus=Window{980edc8 u0 com.google.android.apps.nexuslauncher/com.google.android.apps.nexuslauncher.NexusLauncherActivity}
mShowingDream=false mDreamingLockscreen=false
isKeyguardShowing=false
$ adb -s emulator-5554 shell dumpsys user | grep -E 'State: '
State: RUNNING_UNLOCKED
$ adb -s emulator-5554 shell dumpsys trust | grep -E 'User "'
User "Owner" (id=0, flags=0x4c13) (current): trustState=UNTRUSTED, trustManaged=0, deviceLocked=0, isActiveUnlockRunning=0, strongAuthRequired=0x0
$ adb -s emulator-5554 shell locksettings get-disabled     (a query; nothing is written)
true
$ adb -s emulator-5554 shell dumpsys lock_settings | grep -i -E 'CredentialType|Quality'
Quality: 0
CredentialType: NONE
$ adb -s emulator-5554 shell dumpsys fingerprint | grep -o '"count":[0-9]*'
"count":0
$ settings get (read-only): screen_off_timeout=2147483647 stay_on_while_plugged_in=1 lockscreen.disabled=0
$ pm list packages | grep dems: []
reverse: [;]
=== emulator-5556  avd_name=dems2_tablet  sys.boot_completed=1
mCurrentFocus=Window{94c25a1 u0 com.google.android.apps.nexuslauncher/com.google.android.apps.nexuslauncher.NexusLauncherActivity}
mShowingDream=false mDreamingLockscreen=false
isKeyguardShowing=false
State: RUNNING_UNLOCKED
User "Owner" (id=0, flags=0x4c13) (current): trustState=UNTRUSTED, trustManaged=0, deviceLocked=0, isActiveUnlockRunning=0, strongAuthRequired=0x0
locksettings get-disabled: true
Quality: 0
CredentialType: NONE
"count":0
screen_off_timeout=2147483647 stay_on_while_plugged_in=1 lockscreen.disabled=0
pm list packages | grep dems: []
reverse: [;]
=== emulator-5558  avd_name=dems2_phone2  sys.boot_completed=1
mCurrentFocus=Window{2e98743 u0 com.google.android.apps.nexuslauncher/com.google.android.apps.nexuslauncher.NexusLauncherActivity}
mShowingDream=false mDreamingLockscreen=false
isKeyguardShowing=false
State: RUNNING_UNLOCKED
User "Owner" (id=0, flags=0x4c13) (current): trustState=UNTRUSTED, trustManaged=0, deviceLocked=0, isActiveUnlockRunning=0, strongAuthRequired=0x0
locksettings get-disabled: true
Quality: 0
CredentialType: NONE
"count":0
screen_off_timeout=2147483647 stay_on_while_plugged_in=1 lockscreen.disabled=0
pm list packages | grep dems: []
reverse: [;]
```

No secure lock on any of the three: no credential (`CredentialType: NONE`), lock screen disabled
(`get-disabled` = `true`), device not locked (`deviceLocked=0`), no fingerprint enrolled, user 0
unlocked. `screen_off_timeout` and `stay_on_while_plugged_in` are the values the system image
ships with on this emulator; this row read them and set nothing.

## 9. Install of the current debug APK (step 8)

### 9.1 The APK, checked on the host first (10:42:33)

```
$ ls -la app-debug.apk
-rw-r--r--@ 1 gsp-budi  staff  324537405 Oct  4 07:07 apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk
$ shasum -a 256 app-debug.apk
d89c9be31fb43e2b46361c26e357db1ffc7a4d9ba46e56af5230f7d57f8a14ec
APK SHA-256: MATCH (step 35 value d89c9be3...8a14ec)
APK size: MATCH (324,537,405 bytes)
$ zsh -l -c 'apksigner verify --print-certs app-debug.apk'
Signer #1 certificate DN: CN=Android Debug, OU=Android, O=Unknown, L=Unknown, ST=Unknown, C=US
Signer #1 certificate SHA-256 digest: fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c
(apksigner exit=0)
APK CERT: MATCH (fac61745...033b9c)
```

### 9.2 Install, inside a device session per emulator

Session commands: `implementation/assets/02b_install.sh` (checks the hash again, refuses if the
package is already there, `adb install` without `-r`, reads the package facts back, does not start
the app). Session logs: `implementation/assets/02b_session_install_dems2_<target>.txt`.

```
== W02b step 8 phone 2026-10-04 10:43:13 WIB
$ NO_METRO=1 DEVICE_SESSION_MAX_SECONDS=600 apps/mobile/scripts/device-session.sh phone "/bin/sh '<assets>/02b_install.sh'"
[device-session phone 10:43:13] lock held; hard cap 600 s, until 10:53:13 (watchdog PID 72676)
[device-session phone 10:43:13] session serial: emulator-5554 (dems2_phone)
[device-session phone 10:43:13] emulator-5554: screen awake, no keyguard
[device-session phone 10:43:13] no Metro (NO_METRO=1); tcp:4400 -> tcp:4400 on emulator-5554
== dems2_phone emulator-5554 10:43:13
emu avd name: dems2_phone
isKeyguardShowing=false
State: RUNNING_UNLOCKED
host APK: 324537405 bytes, sha256 d89c9be31fb43e2b46361c26e357db1ffc7a4d9ba46e56af5230f7d57f8a14ec
package before: []
-- INSTALL_START 10:43:15: adb -s emulator-5554 install <app-debug.apk>
Performing Streamed Install
Success
-- INSTALL_END 10:43:17
package after: [package:com.dems.demo.tablet]
versionCode=100 minSdk=24 targetSdk=36
versionName=0.1.0
lastUpdateTime=2026-10-04 10:43:16
signatures=PackageSignatures{d907de4 version:2, signatures:[51ed3f60], past signatures:[]}
firstInstallTime=2026-10-04 10:43:16
base.apk on the device: d89c9be31fb43e2b46361c26e357db1ffc7a4d9ba46e56af5230f7d57f8a14ec
base.apk: MATCH (= host APK)
app process after install (not started by this script): []
== dems2_phone end 10:43:18
[device-session phone 10:43:18] session ended with status 0
session exit=0
reverse rules AFTER the session: [;]
```

| | `dems2_phone` | `dems2_tablet` | `dems2_phone2` |
|---|---|---|---|
| Session | 10:43:13 to 10:43:18, status 0 | 10:43:19 to 10:43:25, status 0 | 10:43:26 to 10:43:34, status 0 |
| `adb install` | `Success` | `Success` | `Success` |
| `versionCode` / `versionName` | 100 / 0.1.0 | 100 / 0.1.0 | 100 / 0.1.0 |
| `firstInstallTime` = `lastUpdateTime` | 2026-10-04 10:43:16 | 2026-10-04 10:43:24 | 2026-10-04 10:43:32 |
| `signatures` | `[51ed3f60]` | `[51ed3f60]` | `[51ed3f60]` |
| `base.apk` SHA-256 on the device | `d89c9be31fb43e2b46361c26e357db1ffc7a4d9ba46e56af5230f7d57f8a14ec` | same | same |
| Reverse rules after the session | `[;]` (none) | `[;]` | `[;]` |

## 10. Launch check: the app opens in Simulated mode (step 9)

Order tablet, phone2, phone; one Metro at a time on port 8085 (no Metro was running before:
`lsof -nP -iTCP:8081-8089 -sTCP:LISTEN` empty at 10:43:47), started and stopped by each session.
Session commands: `implementation/assets/02b_launch_check.sh`, which runs step 35's
`13_launch_check.sh` **unchanged** and then copies its screencap to `02b_<avd>_launch.png` (the
step-35 script names its file after `AVD_NAME`, so it wrote `13_dems2_<target>_launch.png`; both
files exist, with the same bytes). Session logs:
`implementation/assets/02b_session_launch_dems2_<target>.txt`.

```
== W02b step 9 tablet 2026-10-04 10:44:46 WIB
$ METRO_PORT=8085 DEVICE_SESSION_MAX_SECONDS=540 apps/mobile/scripts/device-session.sh tablet "/bin/sh '<assets>/02b_launch_check.sh'"
[device-session tablet 10:44:46] lock held; hard cap 540 s, until 10:53:46 (watchdog PID 73781)
[device-session tablet 10:44:46] session serial: emulator-5556 (dems2_tablet)
[device-session tablet 10:44:47] emulator-5556: screen awake, no keyguard
[device-session tablet 10:44:47] Metro PID 73813 (own process group) on 127.0.0.1:8085 (log: .../T//dems-metro-8085.log)
[device-session tablet 10:44:49] emulator-5556: bundler location set to localhost:8081 (H-MB-09)
[device-session tablet 10:44:49] Metro ready; device tcp:8081 -> host tcp:8085, tcp:4400 -> tcp:4400 on emulator-5556
== dems2_tablet emulator-5556 10:44:49; METRO_PORT=8085; user state: State: RUNNING_UNLOCKED
versionCode=100 minSdk=24 targetSdk=36
lastUpdateTime=2026-10-04 10:43:24
signatures=PackageSignatures{d0aae2d version:2, signatures:[51ed3f60], past signatures:[]}
firstInstallTime=2026-10-04 10:43:24
base.apk on the device: d89c9be31fb43e2b46361c26e357db1ffc7a4d9ba46e56af5230f7d57f8a14ec
-- LAUNCH 10:44:50
Status: timeout
LaunchState: UNKNOWN (-1)
-- bundle wait: 6s
Android Bundled 15317ms node_modules/expo-router/entry.js (6084 modules)
-- pidof after launch: [5213]
mCurrentFocus=Window{5f6c51b u0 com.dems.demo.tablet/com.dems.demo.tablet.MainActivity}
-rw-r--r--@ 1 gsp-budi  staff  3294065 Oct  4 10:45 .../implementation/assets/13_dems2_tablet_launch.png
-- logcat of the app process: FATAL / JS error lines
10-04 10:44:51.502  5213  5213 E unknown:ReactNative: Unable to display loading message because react activity isn't active, message: Loading from localhost:8081…
10-04 10:44:51.518  5213  5213 E unknown:ReactNative: Unable to display loading message because react activity isn't active, message: Reloading...
   (end of logcat filter)
== dems2_tablet end 10:45:22
-- 13_launch_check.sh status: 0
-rw-r--r--@ 1 gsp-budi  staff  3294065 Oct  4 10:45 .../implementation/assets/02b_dems2_tablet_launch.png
screencap sha256: 49b76c5e9826eff2ebb1ff9c9148a046a8498895bea1692dbdb4ff0711ff39b6
isKeyguardShowing=false
lastUpdateTime=2026-10-04 10:43:24
firstInstallTime=2026-10-04 10:43:24
[device-session tablet 10:45:35] Metro 73813 stopped
[device-session tablet 10:45:35] session ended with status 0
session exit=0
reverse rules AFTER the session: [;]
Metro after the session (listeners 8081-8089): []
```

| | `dems2_tablet` | `dems2_phone2` | `dems2_phone` |
|---|---|---|---|
| Session | 10:44:46 to 10:45:35 | 10:46:04 to 10:46:40 | 10:46:48 to 10:47:25 |
| Metro (started and stopped by the session) | PID 73813, port 8085 | PID 75902, port 8085 | PID 77496, port 8085 |
| `am start -W` | `Status: timeout`, `LaunchState: UNKNOWN (-1)` (first bundle of this Metro cache: 15,317 ms) | `Status: ok`, `LaunchState: COLD`, `TotalTime: 6691` | `Status: ok`, `LaunchState: COLD`, `TotalTime: 7752` |
| Bundle | `Android Bundled 15317ms ... (6084 modules)` | `Android Bundled 1587ms ... (6084 modules)` | `Android Bundled 1904ms ... (6084 modules)` |
| App process after the launch | 5213 | 5133 | 4976 |
| `mCurrentFocus` | `com.dems.demo.tablet/.MainActivity` | same | same |
| `FATAL EXCEPTION` / `E ReactNativeJS` / `E AndroidRuntime` lines | none | none | none |
| `13_launch_check.sh` status | 0 | 0 | 0 |
| Screencap | `02b_dems2_tablet_launch.png`, 3,294,065 bytes, SHA-256 `49b76c5e...11ff39b6` | `02b_dems2_phone2_launch.png`, 1,711,342 bytes, SHA-256 `d1b598bc...d7318345` | `02b_dems2_phone_launch.png`, 1,710,569 bytes, SHA-256 `faa5049d...cabb657f` |
| `firstInstallTime` after the launch | 10:43:24 (unchanged) | 10:43:32 (unchanged) | 10:43:16 (unchanged) |
| Reverse rules after the session | `[;]` | `[;]` | `[;]` |
| Metro after the session | none | none | none |

**What the three screencaps show** (viewed after each run): the app's sign-in screen, "DEMS EDGE
CLIENT, Digital Evidence Recording Controller", empty Username and Password fields, the Sign In
button, "Biometrics not set up on this device", the collapsed "Demo operators" list, the green
"Core online" chip, the line **"Core: DEMS-IR-01 • paired (simulated)"**, "Pair this tablet" and
"v2.4.1". That is the first-run state of a fresh install in Simulated mode: no stored simulator
snapshot and no signed-in operator. The tablet shows the two-column landscape layout (2560x1600),
the phones the single-column portrait layout (1080x2424).

Notes:

- The only `E unknown:ReactNative` lines are "Unable to display loading message because react
  activity isn't active" (the dev loading banner at start). No fatal or JS error line.
- The tablet's `Status: timeout` is `am start -W` giving up its wait while Metro built the first
  bundle; the app was running and focused when the check looked, and its screencap shows the
  sign-in screen.
- `uiautomator dump` (added by the wrapper as a text proof) answered "ERROR: could not get idle
  state." on the animated sign-in screen, so there is no text dump; the screencaps are the
  evidence. The wrapper's text part was adjusted after the tablet run (it now prints that message
  and leaves no empty file).
- Nothing was typed into the app. No sign-in, no pairing, no biometric set-up, no Android setting.
  On each emulator the helper wrote its usual React Native developer preference
  `debug_http_host=localhost:8081` into the app's own preferences (its H-MB-09 step in a Metro
  session), and the app wrote whatever it writes at a first start. That holds for the reserved
  `dems2_phone2` too; beyond this launch check it is untouched and has no reverse rule.

**Step 35's open clause** ("the app opens in Simulated mode (screencap)") is met on all three
named emulators with the build of that step (`base.apk` = `d89c9be3...8a14ec`).

## 11. After state (step 10)

### 11.1 Devices, processes, lock state, app (10:48:49)

Log: `implementation/assets/02b_log_after_state.txt`.

```
$ adb devices
List of devices attached
emulator-5554	device
emulator-5556	device
emulator-5558	device

$ ps -axo pid,ppid,nice,etime,rss,command | grep -E "qemu-system|emulator -avd"
68181     1  0       10:04 3451968 .../qemu-system-aarch64 -avd dems2_phone -port 5554 -no-metrics -gpu host -no-boot-anim -no-snapshot-load -no-snapshot-save
68876     1  0       09:18 1506720 .../qemu-system-aarch64 -avd dems2_tablet -port 5556 -no-metrics -gpu host -no-boot-anim -no-snapshot-load -no-snapshot-save
70102     1  0       08:14 3415488 .../qemu-system-aarch64 -avd dems2_phone2 -port 5558 -no-metrics -gpu host -no-boot-anim -no-snapshot-load -no-snapshot-save
$ PID files
dems2_phone.pid=68181 alive=yes
dems2_tablet.pid=68876 alive=yes
dems2_phone2.pid=70102 alive=yes
dems_phone.pid=84074 alive=no   (old AVD; stale, left as it is)
dems_tablet.pid=84299 alive=no   (old AVD; stale, left as it is)
dems_phone2.pid=84494 alive=no   (old AVD; stale, left as it is)
=== emulator-5554 avd=dems2_phone boot_completed=1 isKeyguardShowing=false State: RUNNING_UNLOCKED
    locksettings get-disabled=true  trust: deviceLocked=0  fingerprints: "count":0
    app: versionCode=100 minSdk=24 targetSdk=36 firstInstallTime=2026-10-04 10:43:16
    base.apk sha256: d89c9be31fb43e2b46361c26e357db1ffc7a4d9ba46e56af5230f7d57f8a14ec
    app process: []  reverse --list: [;]
=== emulator-5556 avd=dems2_tablet boot_completed=1 isKeyguardShowing=false State: RUNNING_UNLOCKED
    locksettings get-disabled=true  trust: deviceLocked=0  fingerprints: "count":0
    app: versionCode=100 minSdk=24 targetSdk=36 firstInstallTime=2026-10-04 10:43:24
    base.apk sha256: d89c9be31fb43e2b46361c26e357db1ffc7a4d9ba46e56af5230f7d57f8a14ec
    app process: []  reverse --list: [;]
=== emulator-5558 avd=dems2_phone2 boot_completed=1 isKeyguardShowing=false State: RUNNING_UNLOCKED
    locksettings get-disabled=true  trust: deviceLocked=0  fingerprints: "count":0
    app: versionCode=100 minSdk=24 targetSdk=36 firstInstallTime=2026-10-04 10:43:32
    base.apk sha256: d89c9be31fb43e2b46361c26e357db1ffc7a4d9ba46e56af5230f7d57f8a14ec
    app process: []  reverse --list: [;]
$ Metro / expo processes
(end)
$ lsof listeners 8081-8089
(end)
$ lsof listeners 5554-5559
qemu-syst 68181 127.0.0.1:5555 / [::1]:5555 / 127.0.0.1:5554 / [::1]:5554
qemu-syst 68876 127.0.0.1:5557 / [::1]:5557 / 127.0.0.1:5556 / [::1]:5556
qemu-syst 70102 127.0.0.1:5559 / [::1]:5559 / 127.0.0.1:5558 / [::1]:5558
$ device-session leftovers (lockf, watchdog, session shells)
(end)
$ PostgreSQL 4432 (not touched)
postgres 19121 127.0.0.1:4432
postgres.pid=19121 alive=yes
```

### 11.2 The final script file on the running emulators (10:50:56)

```
== final script on the devices 2026-10-04 10:50:56 WIB; sha256 f25f3096c35fd3178c6ae9e3bcfbcff99fe6d7ce1871b58402af47089cff93bf
[device-session phone 10:50:56] session serial: emulator-5554 (dems2_phone)
[device-session phone 10:50:56] emulator-5554: screen awake, no keyguard
[device-session phone 10:50:56] no Metro (NO_METRO=1); tcp:4400 -> tcp:4400 on emulator-5554
in session: AVD_NAME=dems2_phone SERIAL=emulator-5554 emu-avd-name=dems2_phone isKeyguardShowing=false
[device-session phone 10:50:56] session ended with status 0
session exit=0
[device-session tablet 10:50:56] session serial: emulator-5556 (dems2_tablet)
[device-session tablet 10:50:56] emulator-5556: screen awake, no keyguard
in session: AVD_NAME=dems2_tablet SERIAL=emulator-5556 emu-avd-name=dems2_tablet isKeyguardShowing=false
[device-session tablet 10:50:56] session ended with status 0
session exit=0
[device-session phone2 10:50:56] session serial: emulator-5558 (dems2_phone2)
[device-session phone2 10:50:56] emulator-5558: screen awake, no keyguard
in session: AVD_NAME=dems2_phone2 SERIAL=emulator-5558 emu-avd-name=dems2_phone2 isKeyguardShowing=false
[device-session phone2 10:50:56] session ended with status 0
session exit=0
$ adb devices
emulator-5554	device
emulator-5556	device
emulator-5558	device
emulator-5554 reverse --list: [;] app process: [] isKeyguardShowing=false
emulator-5556 reverse --list: [;] app process: [] isKeyguardShowing=false
emulator-5558 reverse --list: [;] app process: [] isKeyguardShowing=false
$ Metro / session leftovers
(none)
(no Metro listener)
$ uptime
10:50  up 2 days, 18:03, 1 user, load averages: 2.43 7.27 7.88
```

A running `dems2_*` emulator is found by the script's process pattern and is not booted a second
time (no "is down; booting" line).

### 11.3 The old AVD folders

```
== 10:49:08 old AVD folders: final state vs the state right after the graceful shutdown (10:38:30)
--- dems_phone: diff of the file list (name, size in bytes, mtime): after shutdown vs now
IDENTICAL: 30 files, same names, sizes and mtimes
--- dems_tablet: ...
IDENTICAL: 30 files, same names, sizes and mtimes
--- dems_phone2: ...
IDENTICAL: 23 files, same names, sizes and mtimes
$ shasum -a 256 config.ini and .ini of the old AVDs
74c9f92c4f43cc2e40aab82066994c56e05ef4604bdd969c219e463cd8f51b02  dems_phone.avd/config.ini
9b5639d5c7f7f53be4e0e53b17d62e51c117b34d7694996082aa4eee138a6112  dems_tablet.avd/config.ini
74c9f92c4f43cc2e40aab82066994c56e05ef4604bdd969c219e463cd8f51b02  dems_phone2.avd/config.ini
d9aecbe20615373cb1de01029d037121753a00428383a13cc9a1052a95df6ba7  dems_phone.ini
33d34ac0eb40c85ee469eb8acb599f057c167c2ec88f1f52bda88a934de0335c  dems_tablet.ini
03b1318c28b7dda3affd26d0d0cdd53eeca9d00355f1582eb77c7e3d89b3329f  dems_phone2.ini
$ stat config.ini mtimes
dems_phone.avd/config.ini 3570 bytes mtime=2026-10-01 00:08:18
dems_phone2.avd/config.ini 3570 bytes mtime=2026-10-01 10:04:39
dems_tablet.avd/config.ini 3572 bytes mtime=2026-10-01 00:07:09
```

`config.ini` and `<avd>.ini` of all three old AVDs: same SHA-256, same size, same mtime as in the
before state (section 2). The folders are still listed by `avdmanager list avd` (six AVDs now), and
no process runs from them.

**What did change inside the old folders, and who wrote it.** The emulator processes themselves,
while running and at their own exit (this row wrote nothing there):

```
--- dems_phone: file list at 10:31 (before) vs 10:38:30 (after the shutdown)
< ./emulator-user.ini 113 2026-10-01 16:45:26
> ./emulator-user.ini 113 2026-10-04 10:38:16
< ./hardware-qemu.ini.lock 6 2026-10-04 06:27:21              (the running emulator's lock file; removed by its exit)
< ./modem_simulator/iccprofile_for_sim0.xml 14722 2026-10-04 06:27:35
> ./modem_simulator/iccprofile_for_sim0.xml 14747 2026-10-04 10:38:16
< ./modem_simulator/modem_nvram.json 164 2026-10-04 06:27:36
> ./modem_simulator/modem_nvram.json 164 2026-10-04 10:38:16
< ./userdata-qemu.img.qcow2 3124035584 2026-10-04 10:31:38
> ./userdata-qemu.img.qcow2 3124035584 2026-10-04 10:38:08       (the running guest's own writes)
```

`dems_tablet` and `dems_phone2`: the same five files (the tablet's `userdata-qemu.img.qcow2` also
grew by 65,536 bytes while it ran). Sum of file sizes: `dems_phone` 6,454,588,380 to 6,454,588,399
bytes, `dems_tablet` 7,642,612,464 to 7,642,678,019, `dems_phone2` 2,560,475,740 to 2,560,475,759.

`du -sk` (allocated blocks, not content):

| Folder | 10:31 before | 10:38:30 after shutdown | 10:48:49 |
|---|--:|--:|--:|
| `dems_phone.avd` | 6,268,020 | 6,268,016 | 6,241,008 |
| `dems_tablet.avd` | 7,429,860 | 7,429,856 | 7,401,248 |
| `dems_phone2.avd` | 2,450,372 | 2,450,368 | 2,438,144 |

Between 10:38:30 and 10:48:49 no file changed its name, size or mtime (lists identical), yet the
allocated size fell by 12 to 29 MB. Hypothesis, not measured: the file system released blocks that
were reserved for the image files while the emulators had them open. So "sizes equal to the before
state" holds for the file sizes after the shutdown, not to the kilobyte for `du`.

### 11.4 Memory and disk

| | Before (10:31) | After (10:48 to 10:50) |
|---|---|---|
| Load averages | 4.38 3.56 2.85 | 4.81 9.88 8.78 at 10:48; 2.43 7.27 7.88 at 10:50 (peak seen: 17.35 at 10:43, during the three first boots and installs, with other agents' tests running) |
| `memory_pressure` free percentage | 47% | 69% |
| Swap used | 3700.88M of 5120M | 1987.44M of 3072M |
| `vm_stat` pages free / active / inactive / wired | 9110 / 360655 / 359929 / 185026 | 8988 / 525656 / 523264 / 160276 |
| Emulator RSS (KB) | 447,072 / 280,992 / 314,912 (old; four hours idle) | 3,451,968 / 1,506,720 / 3,415,488 (new, minutes after boot) |
| `/System/Volumes/Data` used / available | 228Gi / 667Gi | 234Gi / 663Gi |
| New AVD folders (`du -sk`) | not present | `dems2_phone.avd` 2,106,368; `dems2_tablet.avd` 1,827,520; `dems2_phone2.avd` 2,204,352 = 6,138,240 KB, about 5.9 GiB (they grow with use, up to the 8G data partition each) |
| Old AVD folders (`du -sk`) | 16,148,252 KB | 16,080,400 KB, about 15.3 GiB |

At no moment were more than three emulators alive: the three old ones until 10:38:16, none from
10:38:22 to 10:38:45, then one, two and three new ones.

## 12. Host impact (commands for the user; NOT executed by this row)

Changes outside the workspace made by this row: three AVD definitions
`~/.android/avd/dems2_phone.ini`, `dems2_tablet.ini`, `dems2_phone2.ini` and their folders
`~/.android/avd/dems2_phone.avd`, `dems2_tablet.avd`, `dems2_phone2.avd` (about 5.9 GiB now). The
three old emulator processes were stopped; three new ones run (PIDs 68181, 68876, 70102). Nothing
was installed in the SDK, no shell profile was edited, no `sudo`.

**Remove the new AVDs** (stop them first):

```sh
adb -s emulator-5554 emu kill; adb -s emulator-5556 emu kill; adb -s emulator-5558 emu kill
zsh -l -c 'avdmanager delete avd -n dems2_phone'
zsh -l -c 'avdmanager delete avd -n dems2_tablet'
zsh -l -c 'avdmanager delete avd -n dems2_phone2'
# their PID files and logs in the workspace: .locks/dems2_*.pid, .locks/dems2_*.emulator.log
```

**Start the OLD emulators again** (only after the new ones are stopped: both families use ports
5554, 5556, 5558). They boot to the PIN keyguard and stay locked until the user unlocks them:

```sh
adb -s emulator-5554 emu kill; adb -s emulator-5556 emu kill; adb -s emulator-5558 emu kill
DEMS_AVD_PREFIX=dems_ NO_METRO=1 apps/mobile/scripts/device-session.sh phone  'true'   # boots dems_phone cold on 5554
DEMS_AVD_PREFIX=dems_ NO_METRO=1 apps/mobile/scripts/device-session.sh tablet 'true'   # dems_tablet on 5556
DEMS_AVD_PREFIX=dems_ NO_METRO=1 apps/mobile/scripts/device-session.sh phone2 'true'   # dems_phone2 on 5558
# each call boots the AVD and then ends with status 77 ("LOCKED"): the emulator stays up, the session stops.
# Or directly, from your own Terminal:
~/Library/Android/sdk/emulator/emulator -avd dems_phone -port 5554 -no-metrics -gpu host -no-boot-anim -no-snapshot-load -no-snapshot-save &
```

Every later session on the old AVDs needs `DEMS_AVD_PREFIX=dems_` as well.

**Delete the OLD AVDs** (the user's decision; frees about 15.3 GiB; it also removes the lock, the
enrolled fingerprints and the app data on them, for good):

```sh
zsh -l -c 'avdmanager delete avd -n dems_phone'
zsh -l -c 'avdmanager delete avd -n dems_tablet'
zsh -l -c 'avdmanager delete avd -n dems_phone2'
# workspace leftovers of the old AVDs: .locks/dems_phone.pid, dems_tablet.pid, dems_phone2.pid (stale PIDs) and .locks/dems_*.emulator.log (2026-10-01)
```

## 13. Rollback of this row

1. Script (P23): `git checkout acaff20 -- apps/mobile/scripts/device-session.sh` and then
   `git apply .cache/rollback/W02b.pre.patch` gives back the file as step 35 left it (SHA-256
   `db4cf109...1bd0bdd4`; proven in section 4.1). With that file a session addresses `dems_*` only.
2. Emulators: stop the new ones and start the old ones as in section 12 (they will be locked).
3. Host: delete the new AVDs as in section 12.
4. Documents and assets of this row: section 14.

## 14. Files

| Path | What |
|---|---|
| `apps/mobile/scripts/device-session.sh` (tracked, modified) | prefix variable, lock check, header and usage text |
| `.cache/rollback/W02b.pre.patch` (git-ignored) | P23 pre-image |
| `.locks/dems2_phone.pid`, `.locks/dems2_tablet.pid`, `.locks/dems2_phone2.pid` | PIDs 68181, 68876, 70102 (written by the script) |
| `.locks/dems2_phone.emulator.log`, `dems2_tablet.emulator.log`, `dems2_phone2.emulator.log` | emulator logs (written by the script) |
| `docs/.../initialization/06_lock_free_emulators.md` | this document |
| `docs/.../delegation_progress/coder_execution_step_w02b.md` | progress file |
| `docs/.../implementation/assets/02b_device_session.diff` | script diff, pre-image to final |
| `docs/.../implementation/assets/02b_device_session_dry_run.sh`, `02b_device_session_dry_run.txt` | stub harness and its output |
| `docs/.../implementation/assets/02b_install.sh`, `02b_launch_check.sh` | session commands of steps 8 and 9 |
| `docs/.../implementation/assets/02b_session_install_dems2_{phone,tablet,phone2}.txt` | install sessions |
| `docs/.../implementation/assets/02b_session_launch_dems2_{phone,tablet,phone2}.txt` | launch sessions |
| `docs/.../implementation/assets/02b_dems2_{phone,tablet,phone2}_launch.png` | screencaps, app in Simulated mode |
| `docs/.../implementation/assets/13_dems2_{phone,tablet,phone2}_launch.png` | the same screencaps under the name step 35's script gives them |
| `docs/.../implementation/assets/02b_log_stop_old.txt`, `02b_log_boot.txt`, `02b_log_lock_state.txt`, `02b_log_after_state.txt` | raw step logs |
| Outside the workspace: `~/.android/avd/dems2_{phone,tablet,phone2}.ini` and `.avd/` | the new AVDs |

Not touched: `README.md`, `package.json`, any other tracked file, `status_tasks.md`,
`delegation_progress_report.md`, `decisions/decisions.md`, `masterplan/02_plan.md`, PostgreSQL,
the adb server, `~/.android/avd/dems_*`.

## 15. What must change in `README.md` (for the README row; nothing was edited)

| README line(s) | Now says | Needs |
|---|---|---|
| 8 | the summary line ends with the emulator screen-lock PIN | the `dems2_*` emulators have no lock; the value belongs to the old AVDs only (or goes, if the user deletes them) |
| 43 | table row "Emulator screen-lock PIN (fingerprint enrolment)" with the value | same |
| 57 | AVDs `dems_phone`, `dems_phone2`, `dems_tablet` | the working AVDs are `dems2_phone` (5554), `dems2_phone2` (5558), `dems2_tablet` (5556); the `dems_*` AVDs are the older, PIN-locked set on the same ports, not running |
| 116 to 121 | what `device-session.sh` does | add `DEMS_AVD_PREFIX` (default `dems2_`, `dems_` = old set), the wake + dismiss step, exit 77 on a secure lock, `AVD_NAME` now `dems2_*`, PID files `.locks/dems2_<target>.pid` |
| 130 to 136 | manual boot `-avd dems_phone`, `echo $! > .locks/dems_phone.pid`, the phone2 and tablet variants | `-avd dems2_phone`, `.locks/dems2_phone.pid`, `dems2_phone2`, `dems2_tablet` |
| 141 | "After a reboot the PIN keyguard shows. Unlock it with ..." | true for the old AVDs only; the new ones boot to the launcher. No agent types that PIN |
| 147 to 159 | "Fingerprint enrolment (already done on all three AVDs)" with the `locksettings` and `emu finger` procedure (the value again in lines 150 and 152) | not done on `dems2_*` and not to be done by an agent (D49). The app shows "Biometrics not set up on this device"; biometric sign-in cannot be shown on these emulators |
| 165 | "Agents never kill or reboot emulators" | still the rule; D58 was the one recorded exception |
| 258 | "cold start 12-15 s" | first boot of a fresh AVD took 36 to 71 s here; later cold boots were not measured in this row |
| 278 to 281 | uninstall: `avdmanager delete avd -n dems_tablet / dems_phone / dems_phone2` | add the three `dems2_*` names |

Also outside the README: `package.json:26-27` (`npm run emulator`, `emulator:phone`) boot
`dems_tablet` and `dems_phone` by name, from a snapshot. P3 already forbids their use; they now
also name the locked set.

## 16. Findings, deviations, decisions needed

### Findings

| # | Finding | Source |
|---|---|---|
| F-1 | A fresh `google_apis` android-36 AVD has no screen lock at all: `locksettings get-disabled` = `true`, `CredentialType: NONE`, `deviceLocked=0`, no fingerprint; the image ships `screen_off_timeout=2147483647` and `stay_on_while_plugged_in=1`, so the screen does not time out. Consequence: no fingerprint can be enrolled without a lock, so the app shows "Biometrics not set up on this device" and biometric sign-in cannot be tested on these emulators (the consequence D49 told the user) | section 8; screencaps |
| F-2 | **The two AVD families share the ports, and the script does not notice a foreign emulator on a port.** If a session asks for one prefix while an emulator of the other prefix runs on that port, `ensure_avd` finds no process of its own AVD, starts the emulator binary (which cannot bind the port), overwrites `.locks/<AVD name>.pid` with the PID of that failed start, and `wait_up` then accepts the foreign emulator because the serial answers. The session would run on the wrong AVD (on a locked old one it stops with 77). Not changed here (the row allows nothing beyond the prefix and the lock check). A guard of about four lines in `ensure_avd` would close it: refuse to boot when `pgrep` finds any emulator with `-port <port>` | `device-session.sh`, `ensure_avd`; reasoning, not triggered in this row |
| F-3 | The target aliases `dems_phone`, `dems_phone2`, `dems_tablet` are still accepted as TARGET names (argument `case`), and now mean the `dems2_*` AVD of that target. Harmless, but misleading; left as it is | `device-session.sh`, argument `case` |
| F-4 | Stale texts left in the script: the log line "D78: reinstall the current step-72 debug APK" (step 35's F-9; it is printed at every boot, section 7) and `SHOTS` pointing at the predecessor's task folder | `device-session.sh` |
| F-5 | `.locks/dems_phone.pid`, `dems_tablet.pid`, `dems_phone2.pid` now hold PIDs of processes that no longer exist (84074, 84299, 84494). Left in place (nothing is deleted); the lock files `.locks/dems_<target>.lock` stay in use | section 11.1 |
| F-6 | An emulator writes into its own AVD folder at exit (`emulator-user.ini`, two `modem_simulator` files, removal of `hardware-qemu.ini.lock`). "Byte-for-byte untouched" therefore holds for `config.ini` and `<avd>.ini` (hashes equal), not for every file of the old folders; none of those writes is this row's | section 11.3 |
| F-7 | `uiautomator dump` cannot read the sign-in screen ("could not get idle state": the screen animates). A text proof of what is on screen needs another method; screencaps were used | section 10 |
| F-8 | `am start -W` reported `Status: timeout` on the first launch against a cold Metro cache (bundle 15.3 s); the app was up. A check that reads only that status line would report a false failure on a first launch | section 10 |
| F-9 | The new emulators run at nice 0; the old ones ran at nice 5 (step 24's note). First boots took 36, 61 and 71 s, each slower than the one before as the host load rose (1-minute load 17.35 at 10:43) | sections 7, 11.4 |
| F-10 | `decisions/decisions.md` held no row D58 when this row read it at 10:31 (last decision row D57); D58 is named in `status_tasks.md:27` and `delegation_progress_report.md:99` | the three files |
| F-11 | The root `README.md` prints the old emulators' screen-lock value in plain text in five places (lines 8, 43, 141, 150, 152). It was seen while listing the README lines of section 15; it was not used, typed or copied anywhere, and a scan of this row's documents, logs, scripts and the changed helper finds it in none of them | `README.md` |
| F-12 | `package.json:26-27` name the old AVDs (section 15) | `package.json` |

### Deviations

| # | Deviation | Why |
|---|---|---|
| DV-1 | The prefix is used in two more places than the two functions named: the exported `AVD_NAME` and the "session serial" log line | Both state the AVD's name. Left at `dems_<target>` they would have named the old, locked AVD in every session log and in every evidence file named after `AVD_NAME`. The scripts that read `AVD_NAME` (`12_device_w12.sh`, `13_install_launch.sh`, `13_launch_check.sh`, `13_reverse_check.sh`) use it for labels and file names only. Effect: step 35's screencaps are named `13_dems2_<target>_launch.png`. One-line revert if the controller prefers the old value: `AVD_NAME=dems_$AVD` |
| DV-2 | `DEMS_AVD_PREFIX` is validated (letters, digits, underscore; else exit 64 before any lock) | The value goes into a `pgrep` regular expression and into file names |
| DV-3 | An unreadable keyguard state is a warning, not a stop; only `isKeyguardShowing=true` after the 10 s poll gives 77 | So that a device whose `dumpsys` fails once does not get a new way to fail; a locked device always reports `true` |
| DV-4 | Exit status 77 was chosen (sysexits "permission denied"); 64, 69, 70, 75 and 142 were taken, 30 and 31 belong to the launch check | Distinct from every status the script and its known commands use |
| DV-5 | `hw.audioInput=no` and `hw.initialOrientation` were aligned too, beyond the keys the row lists | They are among the keys the predecessor set (SPEC-C10: no host microphone); with them the new `config.ini` equals the old one byte for byte |
| DV-6 | The first `avdmanager` attempt failed on my quoting error and created nothing | Section 5.1 |
| DV-7 | All three old emulators were stopped first, then the three new ones booted (not one pair at a time) | The order of the row's steps 5 and 6; never more than three alive |
| DV-8 | The launch check ran through a wrapper (`02b_launch_check.sh`) around the unchanged `13_launch_check.sh`; the screencaps exist under both names | The row asks for `02b_*` screencaps; step 35's script fixes its own file name |
| DV-9 | `implementation/99_implementation_report.md`, `masterplan/02_plan.md` and `status_tasks.md` were not written | Shared files in a parallel run; this document and the progress file carry the row |

### Decisions the controller may want to record

| # | Decision | Options |
|---|---|---|
| DN-1 | Record D58 in `decisions/decisions.md` with the stopped PIDs (84074, 84299, 84494) and the new ones (68181, 68876, 70102) | |
| DN-2 | Accept DV-1 (`AVD_NAME` = real AVD name) or revert it | Default: accept |
| DN-3 | Close F-2 with the port guard in `ensure_avd` | A small follow-up on `device-session.sh` (multi-writer path, P23) |
| DN-4 | Start the waiting device rows: device half of step 34 (W12), step 37 (W15); step 35's launch clause is closed by section 10 | Each device is in the app's first-run state; biometrics are unavailable (F-1), so the secure-store probe covers the unprotected item only (D49) |
| DN-5 | Binding (P3): lane 1 = `dems2_phone`, lane 2 = `dems2_tablet`, reserved = `dems2_phone2` | Serials and lock files are unchanged, so lane scripts need no change |
| DN-6 | README row: section 15; plus F-11 (the lock value in the README) and F-12 (`package.json` scripts) | |
| DN-7 | The old AVDs (about 15.3 GiB): keep or delete | The user's decision; commands in section 12 |

## 17. Follow-up (D63): port guard in `device-session.sh`, and a user-run lock helper

Run window 2026-10-04 11:04 to 11:20 WIB, after the controller's gate on this row (PASS, D63).
Two parts: (A) the port guard that closes finding F-2, (B) a helper the USER runs to give the
lock-free emulators a PIN and a fingerprint, to unlock them and to take the lock off again.

Rules of the follow-up, and how they were kept:

| Rule | Kept by |
|---|---|
| No device session by this agent; only read-only queries to the emulators | The only real `adb` calls were `devices`, `get-state`, `getprop sys.boot_completed`, `emu avd name`, `dumpsys window`, `dumpsys lock_settings`, `dumpsys fingerprint`, plus `pgrep` / `ps` on the host. Every test ran against a stub `adb` in a scratch directory |
| `device-session.sh` changed only by atomic replace | New content written to `apps/mobile/scripts/device-session.sh.w02b-new`, `chmod 755`, `sh -n`, stub-tested, then `mv -f` over the script (section 17.1) |
| P23 pre-image first | `.cache/rollback/W02b_followup.pre.patch` (13,433 bytes, SHA-256 `8f7bfae4...6a681c2c`), proven on a scratch copy: `acaff20` + patch = the file as it was (`f25f3096...9cff93bf`) |
| No agent runs `setup`, `unlock` or `remove` on a device; the PIN is not printed | Those three were executed only to show their refusal (exit 77, stub `adb` call log empty); their logic was tested through the stub. The transcripts mask the PIN as `<PIN>`; this document names the default only as the user's chosen test value (D60) |

State of the emulators at the end (read-only, 11:19:27): three `device`; `dems2_phone`,
`dems2_tablet`, `dems2_phone2`; `isKeyguardShowing=false`, `CredentialType: NONE`,
`"count":0` on each; same PIDs 68181, 68876, 70102. Nothing on them was changed by the follow-up.

### 17.1 Part A: the port guard

**What changed** (`implementation/assets/02b_followup_device_session.diff`, 116 lines; 65 lines
added, 7 removed). The script is now 31,104 bytes, SHA-256
`8baf7a8d51a44495a55357cc8fb1ecc7d0d0a701c08d58b1fe41097952ec0091`, mode `-rwxr-xr-x`.

| In `ensure_avd` | Before the follow-up | Now |
|---|---|---|
| The session's own AVD process exists and the serial answers | go on | `adb -s <serial> emu avd name` is read once. Another name than the session's AVD: two log lines and status **69**. No name (the console does not answer): go on as before |
| The own AVD is down | boot it | First the guard. The port counts as held when (a) any emulator process was started with `-port <the target's port>`, or (b) the serial answers `emu avd name`, or (c) `adb get-state` says `device`. Then: no boot, the PID file is not written, status **69**, and the log names the AVD found (from `emu avd name`, else from the process line) and the `DEMS_AVD_PREFIX` that addresses it |
| The own AVD is recognised only by the process pattern `-avd <name>` right after the binary | yes | also when the serial already answers with the session's AVD name (an AVD started in another form is used, never booted a second time) |
| After a boot | "booted cold" | `emu avd name` is read once more; another AVD answering means the port was already held and the start failed: status **69** with that explanation |
| Log line after a boot | "D78: reinstall the current step-72 debug APK (hash-verified) before testing" | "D78: check that the current debug APK is on it (base.apk SHA-256 = the host APK) before testing" (finding F-4) |
| Header | | names the guard in step 1, the credit line and the exit status 69 |

`SHOTS`, the lock check, Metro, the reverse rules and everything else are untouched. The two
new log lines of a refusal, as the stub run printed them:

```
[device-session phone HH:MM:SS] port 5554 is held by another emulator: AVD 'dems_phone' (PID 7001), not dems2_phone. Not booting dems2_phone; .locks/dems2_phone.pid is left as it is
[device-session phone HH:MM:SS] DEMS_AVD_PREFIX=dems_ addresses it; or stop that emulator first (this script never stops one)
[device-session phone HH:MM:SS] session ended with status 69
```

**Atomic replace** (11:12:03):

```
live before:  f25f3096c35fd3178c6ae9e3bcfbcff99fe6d7ce1871b58402af47089cff93bf  inode 13963922  mode -rwxr-xr-x
new (temp):   8baf7a8d51a44495a55357cc8fb1ecc7d0d0a701c08d58b1fe41097952ec0091  inode 14183999  mode -rwxr-xr-x
sh -n (temp) OK
mv exit=0
live after:   8baf7a8d51a44495a55357cc8fb1ecc7d0d0a701c08d58b1fe41097952ec0091  inode 14183999  mode -rwxr-xr-x
sh -n OK
bash -n OK
zsh -n OK
usage exit=64
```

The live file is the tested temporary file (same hash, the temporary file's inode); a session that
was running at that moment kept reading the old inode. The temporary file no longer exists.

**Stub dry run** (`implementation/assets/02b_followup_dry_run.sh`, output
`02b_followup_dry_run.txt`): each case runs a copy of the script in its own scratch root with
stubs for `adb`, `pgrep`, `ps` and the emulator binary.

```
== W02b follow-up dry run (port guard) 2026-10-04 11:11:02
before the follow-up sha256: f25f3096c35fd3178c6ae9e3bcfbcff99fe6d7ce1871b58402af47089cff93bf
new                  sha256: 8baf7a8d51a44495a55357cc8fb1ecc7d0d0a701c08d58b1fe41097952ec0091

---- summary
-- (2) the session's own AVD is running
old_own_running: exit=0 adb calls=10 emulator boots=0 commands ran=yes
new_own_running: exit=0 adb calls=11 emulator boots=0 commands ran=yes
new_own_running_console_silent: exit=0 adb calls=11 emulator boots=0 commands ran=yes
new_own_running_secure_lock: exit=77 adb calls=18 emulator boots=0 commands ran=no
new_own_running_other_form: exit=0 adb calls=12 emulator boots=0 commands ran=yes
-- (3) nothing on the port
old_down: exit=0 adb calls=11 emulator boots=1 commands ran=yes; pre-existing PID file: CHANGED
new_down: exit=0 adb calls=14 emulator boots=1 commands ran=yes; pre-existing PID file: CHANGED
new_down_tablet: exit=0 adb calls=14 emulator boots=1 commands ran=yes
new_down_old_prefix: exit=0 adb calls=14 emulator boots=1 commands ran=yes
-- (1) another emulator holds the port
new_foreign_process_and_name: exit=69 adb calls=2 emulator boots=0 commands ran=no; pre-existing PID file: UNTOUCHED
new_foreign_process_console_silent: exit=69 adb calls=2 emulator boots=0 commands ran=no; pre-existing PID file: UNTOUCHED
new_foreign_no_port_argument: exit=69 adb calls=2 emulator boots=0 commands ran=no; pre-existing PID file: UNTOUCHED
new_foreign_serial_only: exit=69 adb calls=3 emulator boots=0 commands ran=no; pre-existing PID file: UNTOUCHED
new_old_prefix_vs_new_emulator: exit=69 adb calls=2 emulator boots=0 commands ran=no; pre-existing PID file: UNTOUCHED
new_both_tablet_port_foreign: exit=69 adb calls=6 emulator boots=0 commands ran=no
new_own_process_but_serial_foreign: exit=69 adb calls=4 emulator boots=0 commands ran=no
new_foreign_seen_only_after_boot: exit=69 adb calls=7 emulator boots=1 commands ran=no

---- (2) old vs new, own AVD running: adb trace diff (expected: one added read-only call)
3a4
> adb -s emulator-5554 emu avd name
---- (2) old vs new, own AVD running: log lines (times stripped)
log lines IDENTICAL
---- (3) old vs new, nothing on the port: adb trace diff (expected: added read-only calls only)
1a2
> adb -s emulator-5554 emu avd name
3a5
> adb -s emulator-5554 get-state
4a7
> adb -s emulator-5554 emu avd name
---- (3) old vs new, nothing on the port: emulator call
emulator call IDENTICAL: emulator -avd dems2_phone -port 5554 -no-metrics -gpu host -no-boot-anim -no-snapshot-load -no-snapshot-save
```

The three cases the controller asked for:

| Case | Result |
|---|---|
| (1) a foreign emulator on the port | status 69; the emulator stub was not called (`emulator boots=0`); a PID file placed beforehand kept its content and mtime ("UNTOUCHED"); `<commands>` did not run; the only `adb` calls are `start-server` and `emu avd name`. The log names `dems_phone` from `emu avd name`, and from the process line when the console is silent (`new_foreign_process_console_silent`), with "DEMS_AVD_PREFIX=dems_ addresses it". The reverse direction (`DEMS_AVD_PREFIX=dems_` while `dems2_phone` holds the port) answers "DEMS_AVD_PREFIX=dems2_ addresses it". An emulator with no `-port` argument (`dems_tablet` on 5554) answers "no DEMS_AVD_PREFIX addresses it as target phone" |
| (2) the own AVD running | same status, same log lines, same calls plus the one `emu avd name`; the secure-lock stop (77) still works; a console that does not answer changes nothing |
| (3) nothing on the port | boots as before: the emulator call is identical, the PID file is written ("CHANGED" is the boot writing it), three read-only calls are added |

Two more cases: the own process exists but the serial is answered by another AVD (69, "dems2_phone
runs (PID 4242), but emulator-5554 is answered by AVD 'dems_phone'"), and a foreign emulator that
shows only after the boot (69, "was started, but emulator-5554 is answered by AVD 'dems_phone':
port 5554 was already held, so that start failed").

**The guard's queries on the three running emulators** (read-only, no session, 11:11:48):

```
phone (emulator-5554): avd_process(dems2_phone)=[68181]  avd_process(dems_phone)=[]  port_process(5554)=[68181] (all matches: 68181 )  emu avd name=[dems2_phone]  name from the process line=[dems2_phone]
tablet (emulator-5556): avd_process(dems2_tablet)=[68876]  avd_process(dems_tablet)=[]  port_process(5556)=[68876] (all matches: 68876 )  emu avd name=[dems2_tablet]  name from the process line=[dems2_tablet]
phone2 (emulator-5558): avd_process(dems2_phone2)=[70102]  avd_process(dems_phone2)=[]  port_process(5558)=[70102] (all matches: 70102 )  emu avd name=[dems2_phone2]  name from the process line=[dems2_phone2]
pattern self-match check: port_process(5999) = [] (expected empty: no emulator on 5999, and the query's own shell must not match)
.locks pid files: dems2_phone=68181 dems2_tablet=68876 dems2_phone2=70102
```

So with the default prefix each session takes the "own AVD running" path and the name matches; with
`DEMS_AVD_PREFIX=dems_` the own process is absent, the port process is the `dems2_*` emulator and
the name differs, which is the refusal of case (1). The port pattern matches exactly one process
per port and not the shell that runs the query.

### 17.2 Part B: `apps/mobile/scripts/emulator-user-lock.sh` (new file, 391 lines, mode 755)

SHA-256 `84365bdcc53941e5d8b0a78bebaff003173cc6c7a0b8c14eafbf509ba3eb9703`. POSIX `sh`,
`set -u`, header in the style of `device-session.sh`.

| Action | Who | What it does |
|---|---|---|
| `status [target\|all]` | any caller | Read-only. Per device one line: AVD name, `isKeyguardShowing`, `CredentialType`, fingerprint count, lock screen disabled. No lock is taken |
| `setup [target\|all]` | the user, in a terminal | Per device, holding `.locks/dems_<target>.lock` through `/usr/bin/lockf -k -t ${LOCK_WAIT:-1800}`: "already set up" if a credential and a fingerprint exist; a LOCKED device is reported and skipped; else `locksettings set-pin <PIN>`, `am start -a android.settings.BIOMETRIC_ENROLL`, the PIN and ENTER, three taps on the MORE / I AGREE position (phone 911,2266; tablet 1776,1280), `emu finger touch 1` / `emu finger remove 1` until `dumpsys fingerprint` reports a count of 1 (eight rounds at most), `KEYCODE_HOME`. Result line `set up: PIN yes, fingerprint count N`; with N = 0 the steps to finish by hand |
| `unlock [target\|all]` | the user, in a terminal | Same lock. If the keyguard shows: wake, `wm dismiss-keyguard` (the PIN pad), the PIN, ENTER, then `isKeyguardShowing` is read. One attempt |
| `remove [target\|all]` | the user, in a terminal | Same lock. `locksettings clear --old <PIN>`; Android drops the fingerprints with the lock. A LOCKED device is skipped |

- **The gate.** `setup`, `unlock` and `remove` stop with exit 77 and one line, before any `adb`
  call, unless standard input and standard output are both terminals. The inner call the script
  makes under the lock (`__locked`) has the same check. The header states that agents never work
  around it (no `script`, no pseudo-terminal, no `expect`, no sourcing the file to call its
  functions against a real device, no running its `adb` commands by hand).
- **Wrong AVD.** The three actions refuse a serial whose emulator reports another AVD name than
  `<DEMS_AVD_PREFIX><target>` (exit 69, nothing sent beyond the three opening reads).
- **The PIN.** Default: the user's chosen emulator test value (D60), written in the script as the
  default; `DEMS_EMULATOR_PIN` overrides it (digits only, 4 to 8; a bad value is refused with 64 and
  is not echoed). The script never prints the PIN; `set-pin`'s own output is discarded.
- **Exit status.** 0 every addressed device is in the wanted state; 1 at least one is not; 64 usage
  or bad value; 69 device unavailable or another AVD; 75 a device lock stayed busy; 77 not a user
  terminal.
- **Library mode.** `DEMS_USER_LOCK_LIB=1` makes the file define its functions and return. It is
  how the stub tests reach the action functions. Executed with that variable the script does
  nothing (tested), so it is not a way past the gate.

**Stub tests** (`implementation/assets/02b_user_lock_test.sh`: the harness with its stub `adb`
and stub `sleep`; `implementation/assets/02b_user_lock_transcript.txt`: the transcript). The stub
`adb` records every call and models the lock state per serial; its enrolment model follows the
documented procedure (enrolment started, the right PIN and ENTER, at least two taps, then sensor
touches), so a call sequence in the wrong order enrols nothing.

```
== emulator-user-lock.sh stub tests 2026-10-04 11:18
script sha256: 84365bdcc53941e5d8b0a78bebaff003173cc6c7a0b8c14eafbf509ba3eb9703
shell: /bin/sh; stdin of this harness is a terminal: no; stdout: no
...
== result: 123 passed, 0 failed
---- the same harness under dash: == result: 123 passed, 0 failed
---- shellcheck: not installed on this host (not run)
```

| Group | What is asserted |
|---|---|
| A. terminal check | `setup`, `unlock`, `remove` (with and without a target, and the inner `__locked` form) each: exit 77, the one line, the stub's call log empty. `DEMS_USER_LOCK_LIB=1` with the script executed: exit 0, no call, no output |
| B. usage and bad values | no action, unknown action or target, a third argument, `__locked ... all`: 64. `DEMS_EMULATOR_PIN` with letters, 3 digits or 9 digits, a bad prefix, a bad `LOCK_WAIT`: 64, no call; the bad PIN is not echoed |
| C. status | three devices, one down (69); only read calls; another AVD on the port is marked |
| D. setup, phone | the exact sequence below (24 `adb` calls); result line; the PIN is not in the output; a second run prints "already set up" with six read calls and no write |
| E. setup, tablet and phone2 | the same sequence with `emulator-5556` and taps at 1776 1280; with `emulator-5558` and 911 2266 |
| F. default PIN | with `DEMS_EMULATOR_PIN` unset the device receives the script's default (compared without printing it) |
| G. skips and refusals | already set up; LOCKED at the start (no write); another AVD on the port, in both prefix directions (69, three reads only); device down (69, one call); a lock of another kind (not touched); lock state unreadable (69); `set-pin` fails (no enrolment step follows); a PIN from an unfinished run (no second `set-pin`, enrolment only) |
| H. bounded loop | the enrolment never completes: exactly 8 sensor touches, `KEYCODE_HOME`, "fingerprint count 0", the manual steps, exit 1 |
| I. unlock | right PIN: the exact sequence (10 calls), "unlocked"; another PIN on the device: exactly one attempt, "STILL LOCKED", exit 1; not locked: no write; a keyguard without a credential: dismissed, no PIN typed; another AVD: 69 |
| J. remove | right PIN: the exact sequence (9 calls), "lock removed: CredentialType NONE, fingerprint count 0"; no lock: nothing; another PIN: one attempt, "NOT removed"; LOCKED: skipped; another AVD: 69 |
| K. device lock | while another process holds `.locks/dems_phone.lock`: 75 and "stayed busy", no call; lock free: the inner call runs under the lock and stops at the terminal check (77) |

The setup sequence on a phone, from the transcript (PIN masked):

```
adb -s emulator-5554 get-state
adb -s emulator-5554 shell getprop sys.boot_completed
adb -s emulator-5554 emu avd name
adb -s emulator-5554 shell dumpsys lock_settings
adb -s emulator-5554 shell dumpsys fingerprint
adb -s emulator-5554 shell dumpsys window
adb -s emulator-5554 shell locksettings set-pin <PIN>
adb -s emulator-5554 shell dumpsys lock_settings
adb -s emulator-5554 shell am start -a android.settings.BIOMETRIC_ENROLL
sleep 2
adb -s emulator-5554 shell input text <PIN>
adb -s emulator-5554 shell input keyevent 66
sleep 2
adb -s emulator-5554 shell input tap 911 2266
sleep 2
adb -s emulator-5554 shell input tap 911 2266
sleep 2
adb -s emulator-5554 shell input tap 911 2266
sleep 2
adb -s emulator-5554 emu finger touch 1
sleep 1
adb -s emulator-5554 emu finger remove 1
sleep 1
adb -s emulator-5554 shell dumpsys fingerprint
   (the last five lines twice more: three touches in the stub's model)
adb -s emulator-5554 shell input keyevent KEYCODE_HOME
```

**The refusal from this agent's own shell** (the shipped script; `adb` pointed at the stub so that
nothing could reach a device even if the check failed), 11:18:34:

```
this shell: stdin is a terminal: no; stdout is a terminal: no
$ ANDROID_HOME=<stub sdk> apps/mobile/scripts/emulator-user-lock.sh setup
emulator-user-lock.sh setup: this action is the user's; run it in your own Terminal (no agent sets, opens or removes a device lock)
exit=77
$ ANDROID_HOME=<stub sdk> apps/mobile/scripts/emulator-user-lock.sh unlock
emulator-user-lock.sh unlock: this action is the user's; run it in your own Terminal (no agent sets, opens or removes a device lock)
exit=77
$ ANDROID_HOME=<stub sdk> apps/mobile/scripts/emulator-user-lock.sh remove
emulator-user-lock.sh remove: this action is the user's; run it in your own Terminal (no agent sets, opens or removes a device lock)
exit=77
(the same for `setup phone`, `unlock all`, `remove tablet`)
stub adb call log after the six runs: EMPTY (no adb call was made)
```

**`status` against the three real emulators** (read-only, 11:18:42):

```
$ apps/mobile/scripts/emulator-user-lock.sh status
phone (emulator-5554): AVD dems2_phone, isKeyguardShowing=false, CredentialType=NONE, fingerprint count=0, lock screen disabled=true
phone2 (emulator-5558): AVD dems2_phone2, isKeyguardShowing=false, CredentialType=NONE, fingerprint count=0, lock screen disabled=true
tablet (emulator-5556): AVD dems2_tablet, isKeyguardShowing=false, CredentialType=NONE, fingerprint count=0, lock screen disabled=true
exit=0
$ DEMS_AVD_PREFIX=dems_ apps/mobile/scripts/emulator-user-lock.sh status phone
phone (emulator-5554): AVD dems2_phone, isKeyguardShowing=false, CredentialType=NONE, fingerprint count=0, lock screen disabled=true   <- not dems_phone: another AVD holds this port
exit=0
```

### 17.3 The commands for the user

In the user's own Terminal (not an agent shell), from the workspace root
`/Users/gsp-budi/Documents/DEMS`:

```sh
apps/mobile/scripts/emulator-user-lock.sh status     # what each emulator has now (anyone may run this)
apps/mobile/scripts/emulator-user-lock.sh setup      # PIN + one fingerprint on all three (under a minute each; not measured)
apps/mobile/scripts/emulator-user-lock.sh unlock     # after a cold boot: open the PIN keyguard on all three
apps/mobile/scripts/emulator-user-lock.sh remove     # back to lock-free (the fingerprints go with the lock)
```

One device only: add `phone`, `phone2` or `tablet`. Each action waits for a running device session
on that emulator (its lock) and then runs. After `setup`, every cold boot leaves the emulators at
the keyguard, and `device-session.sh` stops with 77 until `unlock` has been run (the trade-off of
D60). The script takes one target or `all` per call: to leave the reserved emulator `phone2`
lock-free, run `setup phone` and `setup tablet` instead of `setup`.

### 17.4 What is NOT verified

| Item | Why | What proves it |
|---|---|---|
| `setup`, `unlock`, `remove` on a real device | No agent runs them (D35, D49, D60) | The user's first run; `status` afterwards |
| That the blind enrolment lands on Android 16 with these pauses and tap positions | Same. The positions and the order are the README's and the predecessor's (`docs/2026-09-30_dems_demo_stack_setup/implementation/47_mobile_login.md:255-265`, `72_second_phone_avd.md:29-33`), which worked on the `dems_*` AVDs of the same image and profiles on 2026-10-01 | `fingerprint count=1` in the result line; otherwise the helper prints the manual steps |
| That `CredentialType` reads `PIN` after `set-pin` on this image | Not run. The helper accepts any value other than `NONE` as "a credential exists" | The result line |
| The Settings path named in the manual steps ("Security & privacy > Device unlock > Fingerprint Unlock") | Not opened on these emulators; labels may differ | The user |
| `main` to `lockf` to the inner call with a real terminal | The tests have no terminal by design. Tested: busy lock gives 75; free lock reaches the inner call, which refuses with 77 | The user's first run |
| `shellcheck` | Not installed; nothing was installed | `sh -n`, `bash -n`, `zsh -n`, `dash -n` pass for both scripts; the helper's harness passes under `/bin/sh` and `dash` |

### 17.5 Findings, deviations, decisions (follow-up)

Earlier items changed by the follow-up: **F-2 is closed** (the guard); **F-4**: the stale log line
is corrected, `SHOTS` is left as it is; the SHA-256 of `device-session.sh` given in sections 4 and
11 (`f25f3096...`) is the state before the follow-up, the current one is `8baf7a8d...`. The first
dry-run harness (`02b_device_session_dry_run.sh`) models a serial that always answers and so no
longer fits the "AVD down" cases of the current script; `02b_followup_dry_run.sh` replaces it for
those.

| # | Finding | Source |
|---|---|---|
| FU-F1 | `status` does not call `locksettings get-disabled`; it reads `IsLockScreenDisabled` from `dumpsys lock_settings`. On the three emulators that line reads `true`, the value `locksettings get-disabled` printed at 10:42. Reason (hypothesis from the AOSP shell command's source as I recall it, not tested here because no device has a credential): once a credential is set, the `locksettings` shell command checks the old credential before every sub-command, `get-disabled` included, so calling it without `--old` would be a failed credential check and not a read | section 17.2; `adb -s emulator-5556 shell dumpsys lock_settings` at 11:05 |
| FU-F2 | The guard covers more than "a process with `-port <port>`": the serial answering at all, or with another AVD name, also counts, and the name is checked again after a boot. Needed because `npm run emulator` and `emulator:phone` (`package.json:26-27`) start an AVD without `-port`, on the first free port, which the process pattern cannot see | `new_foreign_no_port_argument`, `new_foreign_serial_only`, `new_foreign_seen_only_after_boot` |
| FU-F3 | The port pattern is anchored to the first word of the command line (so the shell that runs the query never matches). An SDK path with a space in it would not match; the serial checks still catch such an emulator once adb lists it | section 17.1, self-match check |
| FU-F4 | The terminal check stops accidents, not intent: a process with a pseudo-terminal, or plain `adb`, can do what the helper does. The rule itself lives in the header, in the delegation rule and in the project memory note | `emulator-user-lock.sh`, header |
| FU-F5 | After `setup`, `device-session.sh` stops with 77 after every cold boot until `unlock` is run; its 77 log line does not name the helper (not changed: outside this follow-up) | `device-session.sh`, `check_keyguard` |
| FU-F6 | A cold boot is the only way these emulators lock: the image keeps `stay_on_while_plugged_in=1` and a maximal `screen_off_timeout` (section 8), read, not set | section 8 |

| # | Deviation | Why |
|---|---|---|
| FU-DV1 | The guard is wider than the literal instruction (FU-F2), and an own AVD started in another form is recognised by its name on the serial | Otherwise `npm run emulator` would still slip through; all added calls are read-only (running path +1 `adb` call, boot path +3) |
| FU-DV2 | The helper refuses unless the AVD name EQUALS `<prefix><target>`; the instruction said "starts with the prefix" | Stricter, and it also catches a `dems2_*` AVD on the wrong port |
| FU-DV3 | `status` shows "lock screen disabled" from `dumpsys`, not from `locksettings get-disabled` | FU-F1 |
| FU-DV4 | `remove` also skips a LOCKED device ("run unlock first"); `unlock` types no PIN at a keyguard without a credential; `setup` goes on from a PIN left by an unfinished run and does not touch a lock of another kind | Predictable behaviour in states the instruction did not name |
| FU-DV5 | Exit status 1 for "a device is not in the wanted state" in addition to 64, 69, 75, 77 | The caller can tell "skipped / fingerprint missing / wrong PIN" from success |
| FU-DV6 | The pauses (2 s, 1 s), the three taps and the eight rounds are constants at the top of the script, with no environment variable | No extra switch on a script that changes device security |

| # | For the controller | Note |
|---|---|---|
| FU-DN1 | Hand the user the `setup` command (D60) when the device rows allow it | Section 17.3. Until then the emulators stay lock-free and biometric parts are jest-only (D49) |
| FU-DN2 | README row: replace the old "Fingerprint enrolment" block and the "Unlock it with ..." line by the helper's four commands; name the PIN as the project's test fixture (D60); the items of section 15 still stand | `README.md:141, 147-159` |
| FU-DN3 | Optional: let the 77 log line of `device-session.sh` name `emulator-user-lock.sh unlock` | One line; a multi-writer path (P23, atomic replace) |
| FU-DN4 | `apps/mobile/scripts/emulator-user-lock.sh` is a new, untracked file: it belongs in the next checkpoint commit together with `device-session.sh` | `git status --short -- apps/mobile/scripts` |

### 17.6 Files and rollback of the follow-up

| Path | What |
|---|---|
| `apps/mobile/scripts/device-session.sh` (tracked, replaced atomically) | port guard, one log line, header |
| `apps/mobile/scripts/emulator-user-lock.sh` (new) | the user-run helper |
| `.cache/rollback/W02b_followup.pre.patch` (git-ignored) | P23 pre-image of `device-session.sh` before the follow-up |
| `docs/.../implementation/assets/02b_followup_device_session.diff` | the follow-up's diff of `device-session.sh` |
| `docs/.../implementation/assets/02b_followup_dry_run.sh`, `02b_followup_dry_run.txt` | port-guard stub harness and output |
| `docs/.../implementation/assets/02b_user_lock_test.sh`, `02b_user_lock_transcript.txt` | the helper's stub harness (with the stub `adb`) and its transcript, with the real refusal and the real `status` appended |
| `docs/.../initialization/06_lock_free_emulators.md`, `docs/.../delegation_progress/coder_execution_step_w02b.md` | this section; progress |

Rollback: `git checkout acaff20 -- apps/mobile/scripts/device-session.sh` followed by
`git apply .cache/rollback/W02b_followup.pre.patch` gives back the script as the first part of
this row left it (`f25f3096...`); done as an atomic replace if sessions may be running (apply on a
copy, then `mv -f`). The helper is removed by deleting `apps/mobile/scripts/emulator-user-lock.sh`
(the controller's or the user's action; nothing else refers to it). No host state was changed by
the follow-up.

---
*Generated: 2026-10-04 10:58*
*Last Updated: 2026-10-04 11:24 (section 17, follow-up)*
