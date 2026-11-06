---
step: 67c
decision: D100 (second phone so that phone lanes stop queuing on one lock); D78 (never kill or reboot dems_phone/dems_tablet; cold-boot flags)
agent: coder-execution
date: 2026-10-01
tier: 3
status: complete (with one deviation in the proof, see §4)
---

# Step 67c: second phone AVD `dems_phone2` and the `any-phone` / `any` targets

## 1. Host changes

| Item | Value |
|---|---|
| AVD | `dems_phone2`, path `/Users/gsp-budi/.android/avd/dems_phone2.avd` (+ `dems_phone2.ini`), 2.0 GB after first boot |
| Created with | `echo no \| avdmanager create avd -n dems_phone2 -k "system-images;android-36;google_apis;arm64-v8a" -d pixel_10` → rc 0 |
| config.ini | The same key edits as `initialization/05_avds.md` §3 (8G data partition, audio input off, both cameras none, 4 cores, GPU enabled + host, portrait start pose, keyboard, 3072 MB RAM, no device frame). `diff ~/.android/avd/dems_phone.avd/config.ini ~/.android/avd/dems_phone2.avd/config.ini` → **no differences, rc 0** |
| Emulator | qemu **PID 97196** (`.locks/dems_phone2.pid` = 97196), PPID 1 (setsid-detached the `ensure_avd` way), `-avd dems_phone2 -port 5558 -no-metrics -gpu host -no-boot-anim -no-snapshot-load -no-snapshot-save`. Log: `.locks/dems_phone2.emulator.log`. **Left running.** |
| Boot | Launched 10:04:56, `sys.boot_completed=1` after **24 s** (10:05:20). `adb devices` serial `emulator-5558` |
| Device facts | `Physical size: 1080x2424`, `Physical density: 420`, SDK 36, `arm64-v8a`, `user_rotation=0`, `accelerometer_rotation=1` (not orientation-locked, D17), `stay_on_while_plugged_in=1`, `screen_off_timeout=2147483647` (the same as `dems_phone`) |
| Existing AVDs | Not touched. `dems_phone` qemu 95964 and `dems_tablet` qemu 92922 are unchanged before and after |

## 2. App, permissions, enrolment on emulator-5558

- **APK:** `apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk`, 324,503,614 B. SHA-256 `cb6b1f513d525372b6e6c6ea35c134da29e9e8a0c79f2566a8fa4e7d217b0be5` matches step 72 (`45_mobile_brand_media.md` §4, line 150) and `47_mobile_login.md` §6. `adb install -r` → `Success`, `lastUpdateTime=2026-10-01 10:05:38`, versionName 0.1.0.
- **Permissions:** `USE_BIOMETRIC: granted=true` and `USE_FINGERPRINT: granted=true`. These are the only ones steps 67 and 75 recorded (`40_mobile_deps_native.md` line 169). No step ran `pm grant`. The manifest has no runtime ("dangerous") permission on API 36: storage is `maxSdkVersion=32`. The `runtime permissions:` section of `dumpsys package` is empty on both `emulator-5554` (read-only check) and `emulator-5558`.
- **Enrolment per `47_mobile_login.md` §5:**
  - `locksettings set-pin 1234` → `Pin set to '1234'`.
  - `BIOMETRIC_ENROLL`, then the PIN typed.
  - MORE once, then I AGREE at 911,2266.
  - 3 sensor touches → "Fingerprint added", then DONE.
  - Verified with `locksettings get-disabled` → `false` and `dumpsys fingerprint` → `"count":1`.
  - The device ended on the launcher. No keyguard is showing because the screen stays on. After a reboot, unlock with PIN 1234 (§5).
- **Not done:** the in-app binding (sign in once with a password, then Enable biometric). That needs a Metro session. A lane that tests biometric sign-in on phone2 does it once (§5).

## 3. `apps/mobile/scripts/device-session.sh` (step-67b version extended)

The file went from 405 to 476 lines. sha256 `81136209…f6245a1` (67b, re-checked just before the swap) → `1dff863fe2058f8e473c168db6a8c2d29886f04e33797083aa3db4036b07ae6e`. It was built and tested as `device-session.sh.67c-new`, then swapped in with an atomic `mv` at 10:13:13 (inode 10286915 → 10300273). Running sessions keep the old inode. Queued `phone` lanes start the new `__inner` when lockf grants them the lock. That path is unchanged apart from one extra log line.

| Change | Detail |
|---|---|
| Target `phone2` | `emulator-5558`, `.locks/dems_phone2.lock`, boot port 5558, `.locks/dems_phone2.pid` (`serial_of` / `port_of`). The `avd_process` regex `-avd dems_phone( \|$)` matches 95964 only. `dems_phone2` matches 97196 only (checked with pgrep) |
| Target `any-phone` | Probes `phone`, then `phone2`, with `lockf -k -t 0 <lock> /bin/sh device-session.sh __inner <avd> …`. A probe that succeeds already holds the lock and runs the session (no gap between probe and take). When every lock is busy, the probes repeat every 2 s ("whichever frees first") until `LOCK_WAIT` runs out on the wall clock → exit 75 |
| Target `any` | The same, over `phone phone2 tablet` |
| Telling a 75 from `<commands>` apart from "busy" | The session writes its AVD to a `$TMPDIR/dems-pick.*` marker as soon as it starts. Marker present: the status is returned unchanged. lockf's own "already locked" lines are sent to `/dev/null`. The session gets the caller's stderr back through fd 3 |
| Session start | Logs `session serial: emulator-5558 (dems_phone2); picked by any-phone`. Exports `SERIAL`, `ANDROID_SERIAL` and the new `AVD_NAME` |
| Kept unchanged | The wall-clock cap watchdog and backstop, the process groups, the cleanup, the phone→tablet lock order for `both`, `NO_METRO`, `KEEP_APP`, H-MB-09, the P4 port check, the D78 boot flags and the `exec lockf` path of the fixed targets |

## 4. Evidence (outside the sandbox)

| # | Test | Result |
|---|---|---|
| S | `/bin/sh -n` (bash 3.2), `/bin/dash -n`, `/bin/bash -n` on the installed file | All OK |
| H1 | Harness (the new script under a scratch root, with a stub adb; the real emulators were found by pgrep): two concurrent `any-phone 'sleep 20'`, 0.3 s apart | **S1 `SERIAL=ANDROID_SERIAL=emulator-5554 AVD_NAME=dems_phone`, S2 `emulator-5558 dems_phone2`**. Both rc 0 in 21 s. During the run phone and phone2 were BUSY. Afterwards all locks were free. 0 marker files left |
| H2 | phone held 8 s, phone2 held 4 s | "all busy (phone phone2)". After 5 s it got `emulator-5558`, rc 0 |
| H2b | Both held, `LOCK_WAIT=3` | rc **75** after 5 s (2 s probe step). The commands did not run |
| H3 | `<commands>` exit 75 on a free phone | rc **75**, 0 adb calls to 5558: it did not move on to phone2 |
| H4 | `any` with phone and phone2 held | `emulator-5556 dems_tablet` |
| H5 | `phone` / `phone2` / `tablet` / `both` | 5554 / 5558 / 5556 / `SERIALS=emulator-5554 emulator-5556`, all rc 0 |
| H6 | `__inner any-phone`, `bogus`, `LOCK_WAIT=x` | All 64 |
| Cap | `DEVICE_SESSION_MAX_SECONDS=3 any-phone 'sleep 60'` | rc **142** at 3 s. Lock free. No process left |
| R1 | **Real devices:** two concurrent `NO_METRO=1 LOCK_WAIT=120 device-session.sh any-phone '<echo ANDROID_SERIAL + getprop ro.boot.qemu.avd_name>; sleep 20'` | Before: phone BUSY (4 `lockf … __inner phone` processes: holder plus queue, 10:03), phone2 free, tablet BUSY. S1 got emulator-5558 at once (`avd=dems_phone2` through plain `adb`). S2 logged "all busy" and took emulator-5558 at 10:13:48, when S1 freed it. Both rc 0, 42 s. Afterwards phone2 was free, its reverse list was empty, and qemu 95964, 92922 and 97196 were unchanged |

**Deviation:** different serials could not be shown on the real devices. The real phone lock was held, by a holder plus queued lanes during the whole step. A `lockf -t 0` probe never wins against blocked waiters, by design. H1 proves the property with the identical script; only adb was stubbed. R1 proves the real-device path.

## 5. Notes for the controller and the lanes

- **Usage for lanes:** `NO_METRO=1 apps/mobile/scripts/device-session.sh any-phone '<commands using "$SERIAL" or plain adb>'`. With Metro, use `METRO_PORT=808x … any-phone '…'`. Never hard-code `emulator-5554`. Name screenshots with `$AVD_NAME`.
- **Lanes already queued on `phone` stay in that queue.** Only new calls with `any-phone` use phone2.
- **phone2 runs at nice 5.** It inherited the agent shell's nice level (74b finding), so its cold starts may be slower. If a timing check matters, boot it from the user's Terminal (74b §6).
- **Rollback:**
  1. Stop qemu 97196 with `adb -s emulator-5558 emu kill`.
  2. Run `avdmanager delete avd -n dems_phone2` (sandbox bypass).
  3. Remove `.locks/dems_phone2.{pid,lock,emulator.log}`.
  4. Restore the 67b script (sha `81136209…`). Nothing was committed.
- **Processes started by this step:** qemu 97196 (left running, as instructed), plus harness and test sessions, all of which ended. No `dems_phone`/`dems_tablet` process, adb server or other lane's process was signalled.
