---
task_id: 2026-09-30_dems_demo_stack_setup
blueprint_row: 10
agent: coder-execution
date: 2026-10-01
tier: 3
status: complete
pins: research/03_analysis.md SD-49, SD-50, HI-5, HI-13; masterplan/01_specs.md §6.1, §6.3, §7, SPEC-C10, AC-06..AC-08; decisions D13, D14, D17, D21
---

# Row 10: AVDs `dems_tablet` and `dems_phone` (D17: responsive, two devices, orientation not locked)

## Result

**PASS.** Both AVDs were created on `system-images;android-36;google_apis;arm64-v8a` and configured per 01_specs §6.3 (RAM, cores, host GPU, SPEC-C10 mic/camera off). Each was cold-booted on its own, unattended, from a background process. Each reached `sys.boot_completed=1` and was shut down cleanly with `adb emu kill`.

| AVD | Device profile | Cold boot to `sys.boot_completed=1` | `wm size` | `wm density` | SDK / release | ABI | GPU | Clean exit |
|---|---|---|---|---|---|---|---|---|
| `dems_tablet` | `pixel_tablet` (10.95 in, 2560x1600, xhdpi) | **25 s** | `Physical size: 2560x1600` | `Physical density: 320` | 36 / 16 | `arm64-v8a` | host (gfxstream, Vulkan on Metal, Apple M5) | 4 s |
| `dems_phone` | `pixel_10` (6.3 in, 1080x2424, 420dpi) | **22 s** | `Physical size: 1080x2424` | `Physical density: 420` | 36 / 16 | `arm64-v8a` | host (same) | 3 s |

Both are well inside AC-07's 180 s limit.

## Sandbox handling (D14)

These ran with the sandbox disabled because they write under `~/.android`, start the emulator, or need the process list (`pgrep`/`lsof` fail inside the sandbox with `sysmon request failed ... Cannot get process list`): `avdmanager create avd`, the `config.ini` edits, both boot-proof runs, `avdmanager list avd`, `adb kill-server` and the final process sweep. Log reads and `du` ran inside the sandbox.

## 1. Device-profile selection

```
$ zsh -l -c 'avdmanager list device'   (Pixel entries, abridged)
id: 29 or "pixel_10"            Name: Pixel 10            OEM : Google
id: 30 or "pixel_10_pro"        Name: Pixel 10 Pro        OEM : Google
id: 31 or "pixel_10_pro_fold"   Name: Pixel 10 Pro Fold   OEM : Google
id: 32 or "pixel_10_pro_xl"     Name: Pixel 10 Pro XL     OEM : Google
id: 33 or "pixel_10a"           Name: Pixel 10a           OEM : Google
...
id: 53 or "pixel_9"             Name: Pixel 9             OEM : Google
id: 60 or "pixel_tablet"        Name: Pixel Tablet        OEM : Google
```

**Phone profile chosen: `pixel_10`**, the base model of the newest Pixel phone generation in cmdline-tools 23.0. Pro, XL, Fold and "a" variants were not chosen: the base model is the most representative mainstream phone and matches the portrait phone designs (D16). Screen spec from `cmdline-tools/latest/lib/sdklib/tools.sdklib.jar` → `com/android/sdklib/devices/nexus.xml`:

```
pixel_10     diag 6.3    x 1080  y 2424  density 420dpi
pixel_tablet diag 10.95  x 2560  y 1600  density xhdpi
```

## 2. Create

```
$ zsh -l -c 'echo no | avdmanager create avd -n dems_tablet -k "system-images;android-36;google_apis;arm64-v8a" -d pixel_tablet'
Loading local repository...
Auto-selecting single ABI arm64-v8a
rc=0
$ zsh -l -c 'echo no | avdmanager create avd -n dems_phone -k "system-images;android-36;google_apis;arm64-v8a" -d pixel_10'
Loading local repository...
Auto-selecting single ABI arm64-v8a
rc=0
```

(`echo no` answers avdmanager's "custom hardware profile?" question with its default. `avdmanager` in 23.0 is still the classic Java tool, not an Android CLI shim.)

## 3. Configuration (`~/.android/avd/<name>.avd/config.ini`)

The keys were set by a replace-in-place script. The diff against avdmanager's defaults follows.

### `dems_tablet`

```
disk.dataPartition.size: 10G -> 8G
hw.audioInput: yes -> no              (SPEC-C10)
hw.camera.back: emulated -> none      (SPEC-C10)
hw.camera.front: none (unchanged)     (SPEC-C10)
hw.cpu.ncore: 4 (unchanged)
hw.gpu.enabled: no -> yes
hw.gpu.mode: auto -> host
hw.initialOrientation: portrait -> landscape
hw.keyboard: no -> yes
hw.ramSize: 2G -> 4096
showDeviceFrame: yes -> no
```

### `dems_phone`

```
disk.dataPartition.size: 10G -> 8G
hw.audioInput: yes -> no              (SPEC-C10)
hw.camera.back: emulated -> none      (SPEC-C10)
hw.camera.front: none (unchanged)     (SPEC-C10)
hw.cpu.ncore: 4 (unchanged)
hw.gpu.enabled: no -> yes
hw.gpu.mode: auto -> host
hw.initialOrientation: portrait (unchanged)
hw.keyboard: no -> yes
hw.ramSize: 2G -> 3072
showDeviceFrame: yes -> no
```

Values re-read **after** both boots (the emulator did not overwrite them):

```
[dems_tablet] disk.dataPartition.size=8G hw.audioInput=no hw.camera.back=none hw.camera.front=none hw.cpu.ncore=4 hw.device.name=pixel_tablet hw.gpu.enabled=yes hw.gpu.mode=host hw.initialOrientation=landscape hw.keyboard=yes hw.ramSize=4096 image.sysdir.1=system-images/android-36/google_apis/arm64-v8a/ showDeviceFrame=no
[dems_phone]  disk.dataPartition.size=8G hw.audioInput=no hw.camera.back=none hw.camera.front=none hw.cpu.ncore=4 hw.device.name=pixel_10 hw.gpu.enabled=yes hw.gpu.mode=host hw.initialOrientation=portrait hw.keyboard=yes hw.ramSize=3072 image.sysdir.1=system-images/android-36/google_apis/arm64-v8a/ showDeviceFrame=no
```

**Orientation (D17):** `hw.initialOrientation` is only the pose the emulator starts in. It does not lock rotation. The tablet starts in its native landscape (2560x1600) and the phone in its native portrait (1080x2424). Both booted with `settings get system accelerometer_rotation` = `1` (auto-rotate on) and `user_rotation` = `0`, so **neither device is orientation-locked**. The app manifest must not lock orientation either (row 18; D17 supersedes the A3 lock and the Android 16 opt-out).

## 4. Cold-boot proof (one AVD at a time)

Script: `boot_proof.sh <avd>` (session scratchpad), run under `zsh -l`. Steps: pre-flight `lsof` on 5554/5555/5037, then `adb start-server`, then launch in the background, then poll `adb -e shell getprop sys.boot_completed` every 2 s (300 s cap), then collect facts, then `adb -e emu kill`, then wait for the process to exit.

Launch command (both AVDs): `emulator -avd <name> -no-snapshot-load -no-audio -no-metrics -gpu host -no-boot-anim &`. This is the delegation's command plus the spec's `-no-metrics` (§7), `-gpu host` and `-no-boot-anim` (§6.3). The recorded `emu-launch-params.txt` confirms the flags. No snapshot existed before the first boot, and `-no-snapshot-load` was passed, so both boots were true cold boots.

### `dems_tablet`

```
== pre-flight port check 00:07:15
port 5554: free
port 5555: free
port 5037: free
adb server pid: 28955
== launch 00:07:15: emulator -avd dems_tablet -no-snapshot-load -no-audio -no-metrics -gpu host -no-boot-anim
emulator launcher pid: 28966
BOOT_COMPLETED=1 after 25 s
qemu pids: 28966
== adb devices
List of devices attached
emulator-5554	device
== wm size
Physical size: 2560x1600
== wm density
Physical density: 320
== ro.build.version.sdk: 36
== ro.build.version.release: 16
== ro.product.cpu.abi: arm64-v8a
== ro.product.model: sdk_gphone64_arm64
== user_rotation: 0; accelerometer_rotation: 1
== emulator listeners
qemu-syst 28966 ... TCP [::1]:50744 (LISTEN)
qemu-syst 28966 ... TCP [::1]:50745 (LISTEN)
qemu-syst 28966 ... TCP 127.0.0.1:5555 (LISTEN)
qemu-syst 28966 ... TCP [::1]:5555 (LISTEN)
qemu-syst 28966 ... TCP 127.0.0.1:50749 (LISTEN)
qemu-syst 28966 ... TCP [::1]:50749 (LISTEN)
qemu-syst 28966 ... TCP 127.0.0.1:5554 (LISTEN)
qemu-syst 28966 ... TCP [::1]:5554 (LISTEN)
qemu-syst 28966 ... TCP 127.0.0.1:8554 (LISTEN)
== shutdown 00:07:40: adb emu kill
OK: killing emulator, bye bye
OK
emulator exited after 4 s
qemu pids remaining:
== GPU lines from emulator log
INFO | Graphics backend: gfxstream
INFO | emuglConfig_init: vulkan_mode_selected:host gles_mode_selected:host
INFO |      Ok: Hardware GPU requirements to run avd: `dems_tablet` are passed
INFO | Selecting Vulkan device: Apple M5, Version: 1.1.323
INFO | Using Vulkan externalMemoryMode: Metal for VkEmulation
== done 00:07:44; BOOTED=1
```

### `dems_phone`

```
== pre-flight port check 00:08:23
port 5554: free
port 5555: free
port 5037: LISTEN (occupied)
adb     28955 gsp-budi ... TCP 127.0.0.1:5037 (LISTEN)      <- the adb server this row started for the tablet run
adb server pid: 28955
== launch 00:08:23: emulator -avd dems_phone -no-snapshot-load -no-audio -no-metrics -gpu host -no-boot-anim
emulator launcher pid: 29282
BOOT_COMPLETED=1 after 22 s
qemu pids: 29282
== adb devices
List of devices attached
emulator-5554	device
== wm size
Physical size: 1080x2424
== wm density
Physical density: 420
== ro.build.version.sdk: 36
== ro.build.version.release: 16
== ro.product.cpu.abi: arm64-v8a
== ro.product.model: sdk_gphone64_arm64
== user_rotation: 0; accelerometer_rotation: 1
== emulator listeners
qemu-syst 29282 ... TCP [::1]:50955 (LISTEN)
qemu-syst 29282 ... TCP [::1]:50956 (LISTEN)
qemu-syst 29282 ... TCP 127.0.0.1:5555 (LISTEN)
qemu-syst 29282 ... TCP [::1]:5555 (LISTEN)
qemu-syst 29282 ... TCP 127.0.0.1:50966 (LISTEN)
qemu-syst 29282 ... TCP [::1]:50966 (LISTEN)
qemu-syst 29282 ... TCP 127.0.0.1:5554 (LISTEN)
qemu-syst 29282 ... TCP [::1]:5554 (LISTEN)
qemu-syst 29282 ... TCP 127.0.0.1:8554 (LISTEN)
== shutdown 00:08:45: adb emu kill
OK: killing emulator, bye bye
OK
emulator exited after 3 s
qemu pids remaining:
== GPU lines from emulator log
INFO | Graphics backend: gfxstream
INFO | emuglConfig_init: vulkan_mode_selected:host gles_mode_selected:host
INFO |      Ok: Hardware GPU requirements to run avd: `dems_phone` are passed
INFO | Selecting Vulkan device: Apple M5, Version: 1.1.323
== done 00:08:48; BOOTED=1
```

### Listener exposure (resolves the §6.1 hypothesis "emulator default (loopback)")

Every emulator listener is on `127.0.0.1` or `[::1]`: console 5554, adb 5555, gRPC 8554 (and the emulator logs `The emulator now requires a signed jwt token for gRPC access!`), plus ephemeral netsim ports. The adb server listened on `127.0.0.1:5037`. **Confirmed: loopback only; nothing on the LAN.**

### Emulator log warnings (each log ~115 lines, the same set for both AVDs)

```
WARNING | The emulator now requires a signed jwt token for gRPC access! Use the -grpc flag if you really want an open unprotected grpc port
WARNING | Failed to process .ini file /Users/gsp-budi/.android/emu-update-last-check.ini for reading.   (tablet only: first run, file not yet created)
ERROR   | Failed to restore previous context: 12297
WARNING | Netsim Wifi dns:///localhost:<port> is gone due to Stream removed (CANCELLED)                   (at shutdown)
```

None stopped a boot. `Failed to restore previous context: 12297` is a host GL-context message logged during start-up; boot, GPU selection and `wm` queries were unaffected (hypothesis: benign, not investigated further). The emulator also wrote `~/.android/emu-update-last-check.ini`, meaning it ran its own update check.

### Quickboot snapshot saved on shutdown

`adb emu kill` makes the emulator save a quickboot snapshot, `default_boot` (log: `Saving snapshot 'default_boot' using 1930 ms`). The snapshot screenshots confirm the native orientation of each device:

```
dems_tablet.avd/snapshots/default_boot/screenshot.png  pixelWidth: 2560  pixelHeight: 1600
dems_phone.avd/snapshots/default_boot/screenshot.png   pixelWidth: 1080  pixelHeight: 2424
```

Consequence: a normal launch without `-no-snapshot-load` will now quick-boot from this snapshot. Any later **cold-boot** proof must keep `-no-snapshot-load`.

## 5. Verification

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
    Name: dems_tablet
  Device: pixel_tablet (Google)
    Path: /Users/gsp-budi/.android/avd/dems_tablet.avd
  Target: Google APIs (Google Inc.)
          Based on: Android 16.0 ("Baklava") Tag/ABI: google_apis/arm64-v8a
  Sdcard: 512 MB
```

| Check | Expected | `dems_tablet` | `dems_phone` | Result |
|---|---|---|---|---|
| `avdmanager list avd` shows the AVD with its device | listed | `pixel_tablet` | `pixel_10` | PASS |
| Config RAM / cores (01_specs §6.3; phone per delegation) | 4096/4; 3072/4 | 4096/4 | 3072/4 | PASS |
| SPEC-C10 `hw.audioInput=no`, cameras `none` | no/none/none | yes | yes | PASS |
| GPU `hw.gpu.enabled=yes`, `hw.gpu.mode=host`, host renderer used | host | `gles_mode_selected:host` | same | PASS |
| `adb devices` lists `emulator-5554	device` (AC-07) | listed | listed | listed | PASS |
| `sys.boot_completed` = 1 within 180 s (AC-07) | ≤180 s | 25 s | 22 s | PASS |
| `wm size` (AC-08 for the tablet) | tablet 2560x1600; phone resolution | `2560x1600` | `1080x2424` | PASS |
| `ro.build.version.sdk` / `ro.product.cpu.abi` (AC-08) | `36` / `arm64-v8a` | 36 / arm64-v8a | 36 / arm64-v8a | PASS |
| Orientation not locked (D17) | auto-rotate on | `accelerometer_rotation=1` | `accelerometer_rotation=1` | PASS |
| Clean shutdown | process exits | 4 s | 3 s | PASS |

## 6. Processes started by this row, all stopped

| PID | Process | Started | Stopped by | Confirmed gone |
|---|---|---|---|---|
| 28955 | `adb` server (127.0.0.1:5037) | `adb start-server`, 00:07:15 | `adb kill-server` (rc=0) after both boots | no listener on 5037; not in `ps` |
| 28966 | `qemu-system-aarch64` (dems_tablet) | 00:07:15 | `adb -e emu kill`, 00:07:40 | exited after 4 s |
| 29282 | `qemu-system-aarch64` (dems_phone) | 00:08:23 | `adb -e emu kill`, 00:08:45 | exited after 3 s |

Final sweep: `lsof -nP -iTCP -sTCP:LISTEN | grep -E ":(5037|5554|5555|8554) "` shows `none`. `ps -axo pid,comm | grep -E "adb|qemu-system|emulator|netsimd|android-cli"` finds no such processes. The only matches were `crashpad` helpers of the user's own apps (VS Code, Chrome, Claude, ChatGPT), which pre-date this row and were not touched.

## 7. Disk use

| Path | Size |
|---|---|
| `~/.android/avd/dems_tablet.avd` | 4.5G (of which `snapshots/` 3.5G) |
| `~/.android/avd/dems_phone.avd` | 3.7G (of which `snapshots/` 2.8G) |
| `~/.android` total (AVDs + Android CLI runtime from row 9) | 8.5G |

This is within the HI-5 hypothesis of 6-10 GB for AVD data. Free space after rows 8-10: 710 GiB (`df -h ~`).

## Rollback

```sh
# Stop anything still running (nothing is running at hand-off)
~/Library/Android/sdk/platform-tools/adb -e emu kill 2>/dev/null
~/Library/Android/sdk/platform-tools/adb kill-server 2>/dev/null

# Delete the two AVDs (removes <name>.avd/ and <name>.ini)
zsh -l -c 'avdmanager delete avd -n dems_tablet'
zsh -l -c 'avdmanager delete avd -n dems_phone'

# Full HI-5 rollback (absent at baseline): also removes adbkey, emulator settings, the Android CLI runtime and its metrics spool
rm -rf ~/.android
```

## Host paths changed by this row

| Path | Change | Baseline |
|---|---|---|
| `~/.android/avd/dems_tablet.avd/`, `~/.android/avd/dems_tablet.ini` | created | absent |
| `~/.android/avd/dems_phone.avd/`, `~/.android/avd/dems_phone.ini` | created | absent |
| `~/.android/adbkey`, `~/.android/adbkey.pub` | created by the first `adb start-server` | absent |
| `~/.android/emu-update-last-check.ini`, `emu-last-feature-flags.protobuf`, `modem-nv-ram-5554` | created by the emulator | absent |

---
*Generated: 2026-10-01 00:12 WIB*
