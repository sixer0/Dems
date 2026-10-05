VERDICT: PASS-WITH-NOTES

> **What this covers.** Blueprint step 28 = plan row W06, the read-only environment check. Every port this task binds is free, including `127.0.0.1:4432` and `127.0.0.1:4420`. The three emulators run and all three hold the **debug** build of `com.dems.demo.tablet`. Node and npm match the baseline. The Maestro CLI starts outside the sandbox. The two stale markers are removed.
> **The notes:** a PostgreSQL 18 server of the host (not of this task) listens on `*:5432` (N-1); `~/.android/debug.keystore` does not exist, so the certificate was compared with the keystore that the Gradle debug signing config names (N-2); starting the Maestro CLI touched one file of its own under `~/.maestro/` (N-4).

| Field | Value |
|---|---|
| Task | 2026-10-04_dems_backend_rbac_pairing, blueprint step 28 = plan W06, phase initialization |
| Agent | verifier (tier R) |
| Evidence tier | 3 (statement, then the command and its output) |
| Run window | 2026-10-04 06:31:48 to 06:36:34 WIB (UTC+7) |
| Tree | `main` at `4b708c8`; no source file changed by this row |
| Helper script | `/private/tmp/claude-501/-Users-gsp-budi-Documents-DEMS/0d71fd65-4a51-4019-9c48-5c92d11bbdaf/scratchpad/w06/apk_cert_digest.py` (session scratchpad, not in the repository; section 2.4) |

---

## 1. PORTS (written first: step 29 waits for it)

**Result: PASS-WITH-NOTE. `127.0.0.1:4432` is FREE. `127.0.0.1:4420` is FREE.** Every port this task binds is free. One port that this task never binds, 5432, has a foreign listener (note N-1).

Probes: 06:31:48 WIB inside the sandbox, 06:32:26 WIB outside the sandbox, and a closing snapshot at 06:36:34 WIB (section 1.5). All three gave the same result.

### 1.1 `lsof -nP -iTCP:<port> -sTCP:LISTEN`, one call per port (06:32:26, outside the sandbox)

```
PORT 4400 rc=1 <no output>
PORT 4410 rc=1 <no output>
PORT 4411 rc=1 <no output>
PORT 4412 rc=1 <no output>
PORT 4413 rc=1 <no output>
PORT 4414 rc=1 <no output>
PORT 4415 rc=1 <no output>
PORT 4416 rc=1 <no output>
PORT 4417 rc=1 <no output>
PORT 4418 rc=1 <no output>
PORT 4419 rc=1 <no output>
PORT 4420 rc=1 <no output>
PORT 4421 rc=1 <no output>
PORT 4422 rc=1 <no output>
PORT 4423 rc=1 <no output>
PORT 4432 rc=1 <no output>
PORT 5173 rc=1 <no output>
PORT 5174 rc=1 <no output>
PORT 5175 rc=1 <no output>
PORT 5176 rc=1 <no output>
PORT 5177 rc=1 <no output>
PORT 5178 rc=1 <no output>
PORT 8081 rc=1 <no output>
PORT 8082 rc=1 <no output>
PORT 8083 rc=1 <no output>
PORT 8084 rc=1 <no output>
PORT 8085 rc=1 <no output>
PORT 8086 rc=1 <no output>
PORT 5432 rc=1 <no output>
```

`lsof -iTCP:<port>` covers IPv4 and IPv6, so the line for 5173 answers both `127.0.0.1:5173` and `[::1]:5173`. `lsof` without root lists only this user's processes, so a second, owner-independent probe was run.

### 1.2 `netstat -an -p tcp | grep LISTEN`, filtered to the same ports (any owner, any address)

```
tcp4       0      0  *.5432                 *.*                    LISTEN
tcp6       0      0  *.5432                 *.*                    LISTEN
```

No other line matched 4400, 4410-4419, 4420-4423, 4432, 5173-5178 or 8081-8086.

Positive control (the probes do see listeners). `lsof`, inside the sandbox:

```
PORT 5554 rc=0 :: qemu-syst 84074 gsp-budi   44u  IPv4 ... TCP 127.0.0.1:5554 (LISTEN)
                  qemu-syst 84074 gsp-budi   45u  IPv6 ... TCP [::1]:5554 (LISTEN)
PORT 5556 rc=0 :: qemu-syst 84299 gsp-budi   46u  IPv4 ... TCP 127.0.0.1:5556 (LISTEN)
                  qemu-syst 84299 gsp-budi   47u  IPv6 ... TCP [::1]:5556 (LISTEN)
PORT 5558 rc=0 :: qemu-syst 84494 gsp-budi   46u  IPv4 ... TCP 127.0.0.1:5558 (LISTEN)
                  qemu-syst 84494 gsp-budi   47u  IPv6 ... TCP [::1]:5558 (LISTEN)
PORT 5037 rc=0 :: adb     83893 gsp-budi   13u  IPv4 ... TCP 127.0.0.1:5037 (LISTEN)
```

The same `netstat` call lists `127.0.0.1.5037` and both `127.0.0.1` and `::1` on 5554 to 5559.

### 1.3 Port by port

| Port | P4 owner | Found | Result |
|---|---|---|---|
| `127.0.0.1:4400` | mock-core | FREE | PASS |
| `127.0.0.1:4410` to `4419` | packaged launcher; mock-core tests | FREE (all ten) | PASS |
| **`127.0.0.1:4420`** | Core server, main instance | **FREE** | PASS |
| `127.0.0.1:4421` | lane 1; proof harness of W05 / W12 | FREE at all three probes (no step-27 harness was listening at those moments) | PASS |
| `127.0.0.1:4422`, `4423` | lanes 2, 3 | FREE | PASS |
| **`127.0.0.1:4432`** | PostgreSQL of this task (W07) | **FREE** | PASS |
| `127.0.0.1:5173` | DEMS web console | FREE | PASS |
| `[::1]:5173` | another project | Not listening at probe time | PASS (nothing there to leave untouched) |
| `127.0.0.1:5174` | another project | Not listening at probe time | PASS |
| `[::1]:5175` (and `127.0.0.1:5175`) | another project | Not listening at probe time | PASS |
| `127.0.0.1:5176` | Vite lane 1 | FREE at all three probes (no step-27 Vite server was listening at those moments) | PASS |
| `127.0.0.1:5177`, `5178` | Vite lanes 2, 3 | FREE | PASS |
| 8081 to 8086 | Metro lanes | FREE (all six) | PASS |
| 5554, 5556, 5558 (with 5555, 5557, 5559) | emulator consoles and their adb ports | `qemu-system-aarch64` PIDs 84074, 84299, 84494 on `127.0.0.1` and `[::1]`: the PIDs that step 24 wrote to `.locks/dems_phone.pid`, `dems_tablet.pid`, `dems_phone2.pid` | PASS, owned as stated |
| 5432 | none ("5432 is never used") | **NOT FREE: `postgres`, PID 312, user `postgres`, bound to `*:5432` on IPv4 and IPv6** | PASS for this task (it never binds 5432); NOTE N-1 |

This row bound no port, stopped no process and sent no signal. The other project's ports had no listener, so nothing of it could be touched.

### 1.4 Note N-1: a PostgreSQL server of the host already listens on 5432

```
$ netstat -anv -p tcp | grep LISTEN | grep 5432          (columns: proto, local address, state, process:pid)
tcp4  *.5432  LISTEN  postgres:312
tcp6  *.5432  LISTEN  postgres:312

$ ps -p 312 -o pid,ppid,user,lstart,command
  PID  PPID USER     STARTED                      COMMAND
  312     1 postgres Thu Oct  1 16:47:43 2026     /Library/PostgreSQL/18/bin/postgres -D /Library/PostgreSQL/18/data
```

- It is a system-wide PostgreSQL 18 under `/Library/PostgreSQL/18`, run by the operating-system user `postgres` since the host started (`uptime`: "up 2 days, 13:49" at 06:36 on 2026-10-04). It is not a process of this task or of its predecessor. Nothing was done to it: no connection, no file read under `/Library/PostgreSQL`, no signal.
- It does **not** collide with this task: the plan binds `127.0.0.1:4432` and never 5432 (02_plan section 4.2).
- It corrects finding F1 ("No PostgreSQL on the host"). F1 looked for `psql`, `postgres` and `pg_ctl` on the `PATH`; this installation is outside the `PATH`.
- Consequence for W07 and every later row: **always pass port 4432 explicitly.** A script or client that falls back to the PostgreSQL default port would reach this foreign server on 5432 instead of failing to connect.
- It is not a shortcut for this task: D5 and D11 fix a project-local cluster from the npm binaries, and this server has another owner.
- It listens on every interface (`*`), not only on loopback. Whether that is intended is the user's matter; it is outside this task.

### 1.5 Closing snapshot (06:36:34 WIB, outside the sandbox)

```
== lsof per port ==
4400:free 4410:free 4411:free 4412:free 4413:free 4414:free 4415:free 4416:free 4417:free 4418:free 4419:free 4420:free 4421:free 4422:free 4423:free 4432:free 5173:free 5174:free 5175:free 5176:free 5177:free 5178:free 8081:free 8082:free 8083:free 8084:free 8085:free 8086:free 5432:free
== netstat, any owner ==
tcp4 *.5432 LISTEN postgres:312
tcp6 *.5432 LISTEN postgres:312
```

("5432:free" in the `lsof` line means only that no process of this user holds it; `netstat` shows the foreign owner.) A port probe is a snapshot: W07 still runs its own `lsof` on 4432 immediately before its first start, as its row says.

---

## 2. EMULATORS

**Result: PASS. All three emulators run, and all three hold the DEBUG build.** The release-signed build is on none of them.

### 2.1 Summary

| AVD | Serial | Running | `sys.boot_completed` | `com.dems.demo.tablet` | Build class | versionName / versionCode | Signing certificate SHA-256 | Airplane mode | `adb reverse --list` |
|---|---|---|---|---|---|---|---|---|---|
| `dems_phone` | `emulator-5554` | yes (`device`) | 1 | installed | **DEBUG** | 0.1.0 / 1 | `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c` | off (0) | empty |
| `dems_tablet` | `emulator-5556` | yes (`device`) | 1 | installed | **DEBUG** | 0.1.0 / 1 | `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c` | off (0) | empty |
| `dems_phone2` | `emulator-5558` | yes (`device`) | 1 | installed | **DEBUG** | 0.1.0 / 1 | `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c` | off (0) | empty |

The certificate is the debug certificate `CN=Android Debug, OU=Android, O=Unknown, L=Unknown, ST=Unknown, C=US` of `apps/mobile/android/app/debug.keystore` (section 2.5). The release certificate of the 0.1.0 APK is `995c1e389ed7df89f3e79a1690b2c14dc7376d928249bbf01de3c83272fd1647` (`docs/2026-09-30_dems_demo_stack_setup/implementation/69_release_apk.md:23`); no emulator holds it.

The build class rests on four independent facts, each the same on all three emulators:

1. The package flag `DEBUGGABLE` is set (the release build has no such flag: `69_release_apk.md:70`).
2. `versionCode=1` (the release build has `versionCode=100`: `69_release_apk.md:58`).
3. The SHA-256 of the installed `base.apk`, computed on the device, is `cb6b1f51...0be5`: the hash of the host's `app-debug.apk` and of the predecessor's debug APK (`69_release_apk.md:81`), and not the release hash `0009f33d...5ecd`.
4. The signing certificate is the debug certificate, not the release certificate.

### 2.2 State (read-only `adb`, outside the sandbox, 06:33:37 WIB)

```
Android Debug Bridge version 1.0.41
Version 37.0.1-15733141
== adb devices -l ==
List of devices attached
emulator-5554          device product:sdk_gphone64_arm64 model:sdk_gphone64_arm64 device:emu64a transport_id:1
emulator-5556          device product:sdk_gphone64_arm64 model:sdk_gphone64_arm64 device:emu64a transport_id:2
emulator-5558          device product:sdk_gphone64_arm64 model:sdk_gphone64_arm64 device:emu64a transport_id:3

=== emulator-5554
get-state=device
sys.boot_completed=1
avd_name=dems_phone
release/sdk=16/36
pm list packages com.dems.demo.tablet => package:com.dems.demo.tablet
pm path => package:/data/app/~~XTyMAODIFx05NLPkux9LUQ==/com.dems.demo.tablet-XmOMd94jrLFBJe2bdsDv5w==/base.apk
airplane_mode_on=0
reverse --list => []
=== emulator-5556
get-state=device
sys.boot_completed=1
avd_name=dems_tablet
release/sdk=16/36
pm list packages com.dems.demo.tablet => package:com.dems.demo.tablet
pm path => package:/data/app/~~ZrHLRvB7Y_PFZb0z93GWHw==/com.dems.demo.tablet-xnqpT5qsGZtSPFIk0pQ7Lw==/base.apk
airplane_mode_on=0
reverse --list => []
=== emulator-5558
get-state=device
sys.boot_completed=1
avd_name=dems_phone2
release/sdk=16/36
pm list packages com.dems.demo.tablet => package:com.dems.demo.tablet
pm path => package:/data/app/~~1oPJDU0g1PnFthTFcLSNsg==/com.dems.demo.tablet-bG-aei9dJblCAP0bvgbopQ==/base.apk
airplane_mode_on=0
reverse --list => []
```

The adb server is the one step 24 left running (PID 83893); it was used, not restarted. No reverse rule exists and none was added or removed.

### 2.3 `adb -s <serial> shell dumpsys package com.dems.demo.tablet`, filtered

```
=== emulator-5554
    codePath=/data/app/~~XTyMAODIFx05NLPkux9LUQ==/com.dems.demo.tablet-XmOMd94jrLFBJe2bdsDv5w==
    versionCode=1 minSdk=24 targetSdk=36
    versionName=0.1.0
    apkSigningVersion=2
    flags=[ DEBUGGABLE HAS_CODE ALLOW_CLEAR_USER_DATA ALLOW_BACKUP ]
    lastUpdateTime=2026-10-01 10:45:40
    installerPackageName=null
    signatures=PackageSignatures{95bb385 version:2, signatures:[51ed3f60], past signatures:[]}
    pkgFlags=[ DEBUGGABLE HAS_CODE ALLOW_CLEAR_USER_DATA ALLOW_BACKUP ]
      firstInstallTime=2026-10-01 10:45:40
=== emulator-5556
    codePath=/data/app/~~ZrHLRvB7Y_PFZb0z93GWHw==/com.dems.demo.tablet-xnqpT5qsGZtSPFIk0pQ7Lw==
    versionCode=1 minSdk=24 targetSdk=36
    versionName=0.1.0
    apkSigningVersion=2
    flags=[ DEBUGGABLE HAS_CODE ALLOW_CLEAR_USER_DATA ALLOW_BACKUP ]
    lastUpdateTime=2026-10-01 11:03:12
    installerPackageName=null
    signatures=PackageSignatures{dbffc10 version:2, signatures:[51ed3f60], past signatures:[]}
    pkgFlags=[ DEBUGGABLE HAS_CODE ALLOW_CLEAR_USER_DATA ALLOW_BACKUP ]
      firstInstallTime=2026-10-01 11:03:12
=== emulator-5558
    codePath=/data/app/~~1oPJDU0g1PnFthTFcLSNsg==/com.dems.demo.tablet-bG-aei9dJblCAP0bvgbopQ==
    versionCode=1 minSdk=24 targetSdk=36
    versionName=0.1.0
    apkSigningVersion=2
    flags=[ DEBUGGABLE HAS_CODE ALLOW_CLEAR_USER_DATA ALLOW_BACKUP ]
    lastUpdateTime=2026-10-01 10:05:38
    installerPackageName=null
    signatures=PackageSignatures{bcf86ed version:2, signatures:[51ed3f60], past signatures:[]}
    pkgFlags=[ DEBUGGABLE HAS_CODE ALLOW_CLEAR_USER_DATA ALLOW_BACKUP ]
      firstInstallTime=2026-10-01 10:05:38
```

(Filter: `versionName|versionCode|flags=|pkgFlags|signatures|firstInstallTime|lastUpdateTime|installerPackageName|codePath|apkSigningVersion`; the `privateFlags` line and one `flags=0x0` line of another block are left out.)

### 2.4 The installed APK and its certificate

The device prints no SHA-256 of the certificate: `pm get-app-links com.dems.demo.tablet` prints nothing on these Android 16 (API 36) images, `pm help` lists no certificate command, and `dumpsys package` prints only the 32-bit hash code `signatures:[51ed3f60]`. So the digest was taken from the APK itself, without `apksigner`.

**Step 1: the installed file, hashed on each device** (`adb -s <serial> shell "ls -l <base.apk>; sha256sum <base.apk>"`):

```
=== emulator-5554
-rw-r--r-- 1 system system 324503614 2026-10-01 10:45 /data/app/~~XTyMAODIFx05NLPkux9LUQ==/com.dems.demo.tablet-XmOMd94jrLFBJe2bdsDv5w==/base.apk
cb6b1f513d525372b6e6c6ea35c134da29e9e8a0c79f2566a8fa4e7d217b0be5  /data/app/~~XTyMAODIFx05NLPkux9LUQ==/com.dems.demo.tablet-XmOMd94jrLFBJe2bdsDv5w==/base.apk
=== emulator-5556
-rw-r--r-- 1 system system 324503614 2026-10-01 11:03 /data/app/~~ZrHLRvB7Y_PFZb0z93GWHw==/com.dems.demo.tablet-xnqpT5qsGZtSPFIk0pQ7Lw==/base.apk
cb6b1f513d525372b6e6c6ea35c134da29e9e8a0c79f2566a8fa4e7d217b0be5  /data/app/~~ZrHLRvB7Y_PFZb0z93GWHw==/com.dems.demo.tablet-xnqpT5qsGZtSPFIk0pQ7Lw==/base.apk
=== emulator-5558
-rw-r--r-- 1 system system 324503614 2026-10-01 10:05 /data/app/~~1oPJDU0g1PnFthTFcLSNsg==/com.dems.demo.tablet-bG-aei9dJblCAP0bvgbopQ==/base.apk
cb6b1f513d525372b6e6c6ea35c134da29e9e8a0c79f2566a8fa4e7d217b0be5  /data/app/~~1oPJDU0g1PnFthTFcLSNsg==/com.dems.demo.tablet-bG-aei9dJblCAP0bvgbopQ==/base.apk
```

**Step 2: the host files** (`shasum -a 256`, and the release hash file):

```
cb6b1f513d525372b6e6c6ea35c134da29e9e8a0c79f2566a8fa4e7d217b0be5  /Users/gsp-budi/Documents/DEMS/apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk
0009f33d60e9038201b7aa54c9ef1af750db9b852401affba56fbb9d3c345ecd  /Users/gsp-budi/Documents/DEMS/release/android/DEMS-Demo-0.1.0.apk
$ cat release/android/DEMS-Demo-0.1.0.apk.sha256
0009f33d60e9038201b7aa54c9ef1af750db9b852401affba56fbb9d3c345ecd  DEMS-Demo-0.1.0.apk
```

The three installed files are byte-identical to the host's `app-debug.apk` (324,503,614 bytes, same SHA-256) and differ from the release APK (PA-02: confirmed, the release hash is on no emulator).

**Step 3: the signer certificate, read from the APK Signing Block** with a standard-library Python script (it opens the file read-only, finds the block before the ZIP central directory, and hashes the DER certificate of the v2 signer; it also computes the Java `Arrays.hashCode` of the DER bytes, which is the value `dumpsys` prints):

```
== control: release APK (recorded cert SHA-256 995c1e38...1647, predecessor 69_release_apk.md:23,57) ==
file: /Users/gsp-budi/Documents/DEMS/release/android/DEMS-Demo-0.1.0.apk
scheme=v2 signer=0 cert=0 der_bytes=899 sha256=995c1e389ed7df89f3e79a1690b2c14dc7376d928249bbf01de3c83272fd1647 java_hashcode=3d5ced7b
== host debug APK (byte-identical to base.apk on the three emulators) ==
file: /Users/gsp-budi/Documents/DEMS/apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk
scheme=v2 signer=0 cert=0 der_bytes=895 sha256=fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c java_hashcode=51ed3f60
```

- **Control passed:** for the release APK the script prints exactly the digest that `apksigner` printed in the predecessor task (`995c1e38...1647`), so the script reads the right bytes.
- **The device agrees:** the hash code of the debug certificate, `51ed3f60`, is the value each emulator's package manager prints as `signatures:[51ed3f60]` (section 2.3). The release certificate would print `3d5ced7b`; no emulator shows it.

### 2.5 The debug keystore (note N-2)

The brief named `~/.android/debug.keystore`. **That file does not exist on this host:**

```
ls: /Users/gsp-budi/.android/debug.keystore: No such file or directory
-rw-r--r--@ 1 gsp-budi  staff  2257 Oct  1 11:34 /Users/gsp-budi/Documents/DEMS/apps/mobile/android/app/debug.keystore
```

The debug build is signed with the keystore inside the generated Android project, as its Gradle file says (`apps/mobile/android/app/build.gradle:100-106`: `debug { storeFile file('debug.keystore') ... keyAlias 'androiddebugkey' }`, with the public template password). So the comparison used that file. Only certificate fields were printed:

```
$ keytool -list -v -keystore apps/mobile/android/app/debug.keystore -storepass android | grep -E "Keystore type|Alias name|Entry type|Owner:|Issuer:|Valid from|SHA1:|SHA256:|Signature algorithm"
Keystore type: JKS
Alias name: androiddebugkey
Entry type: PrivateKeyEntry
Owner: CN=Android Debug, OU=Android, O=Unknown, L=Unknown, ST=Unknown, C=US
Issuer: CN=Android Debug, OU=Android, O=Unknown, L=Unknown, ST=Unknown, C=US
Valid from: Wed Jan 01 05:35:04 WIB 2014 until: Wed May 01 05:35:04 WIB 2052
	 SHA1: 5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25
	 SHA256: FA:C6:17:45:DC:09:03:78:6F:B9:ED:E6:2A:96:2B:39:9F:73:48:F0:BB:6F:89:9B:83:32:66:75:91:03:3B:9C
Signature algorithm name: SHA1withRSA (weak)
```

`FA:C6:17:45:...:3B:9C` equals the APK's certificate digest `fac61745...3b9c`: **match.**

Nothing under `apps/mobile/signing/` was opened. The release certificate digest above comes from the predecessor's document and from the public certificate inside the release APK.

For W13 (PA-03): this keystore sits in `apps/mobile/android/`, the folder that `expo prebuild` may clear (KI-21). **Hypothesis, not verified here:** prebuild puts the same template keystore back, so the rebuilt debug APK carries the same certificate. W13 can prove it in one line before its first `adb install -r`: the `keytool` call above must again print `FA:C6:17:45:...:3B:9C`. If it prints anything else, `adb install -r` will be refused on all three emulators and W13 returns `needs-review`, as PA-03 says.

### 2.6 What was not probed, by the row's rules

Whether a PIN or a fingerprint is enrolled; the app's local data (so whether the predecessor's simulated pairing state is present is unknown); any emulator setting other than airplane mode. The app was not started (closing snapshot: `pidof com.dems.demo.tablet` is empty on all three), nothing was installed, cleared or changed.

---

## 3. VERSIONS AND DISK

**Result: PASS.** Baseline: `initialization/02_baseline_gate.md:12` (node v26.8.2, npm 11.19.1).

```
2026-10-04 06:35:19 WIB
node -v => v26.8.2
npm -v => 11.19.1
which node => /usr/local/bin/node
which npm => /usr/local/bin/npm
== df -h / ==
Filesystem        Size    Used   Avail Capacity iused ifree %iused  Mounted on
/dev/disk3s1s1   926Gi    13Gi   671Gi     2%    484k  4.3G    0%   /
== df -h (data volume holding the workspace) ==
Filesystem      Size    Used   Avail Capacity iused ifree %iused  Mounted on
/dev/disk3s5   926Gi   225Gi   671Gi    26%    2.3M  7.1G    0%   /System/Volumes/Data
== uptime ==
 6:35  1 user, load averages: 3.17 2.64 1.96
```

| Check | Expected | Found | Result |
|---|---|---|---|
| `node -v` | v26.8.2 | v26.8.2 | PASS |
| `npm -v` | 11.19.1 | 11.19.1 | PASS |
| Free disk space | figure only (no threshold: GP-08) | **671 GiB** available of 926 GiB | recorded |

The 1-minute load average was 3.17 on 10 cores, below the load-guard line of 10 (P9).

---

## 4. MAESTRO (KI-02)

**Result: PASS. The Maestro CLI starts outside the sandbox and prints 2.11.0.** One attempt, with the per-command sandbox bypass. No flow was run.

```
$ ls -la ~/.maestro/bin/
-rwxr-xr-x@ 1 gsp-budi  wheel  1310 Sep 29 13:35 jvm-version.jar
-rwxr-xr-x@ 1 gsp-budi  wheel  8999 Sep 29 13:35 maestro
-rwxr-xr-x@ 1 gsp-budi  wheel  3352 Sep 29 13:35 maestro.bat

2026-10-04 06:35:22 WIB
$ MAESTRO_CLI_NO_ANALYTICS=1 MAESTRO_DISABLE_UPDATE_CHECK=true ~/.maestro/bin/maestro --version
╭──────────────────────────────────────────────────────────────────────────╮
│   Try out our new Analyze with Ai feature.                               │
│   See what's new:                                                        │
│   > https://maestro.mobile.dev/cli/test-suites-and-reports#analyze       │
│   Analyze command:                                                       │
│   $ maestro test flow-file.yaml --analyze | bash                         │
│   To disable this notification, set MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED environment variable to "true" before running Maestro.   │
╰──────────────────────────────────────────────────────────────────────────╯

2.11.0
maestro rc=0
2026-10-04 06:35:23 WIB
== leftover maestro processes ==
ps-grep rc=1 (1 = none)
```

(The banner box is shortened here: its padding and blank lines are removed, its text is complete. The lines outside the box are verbatim.) The version equals the one F19 recorded. The `ExceptionInInitializerError` of F19 is therefore an effect of the sandbox, not a broken installation. KI-02 stays open as planned: there are still no flows, and no row of this task claims a scripted run.

**Note N-4.** The two environment variables were added to keep the start free of analytics and of an update check (P20, loopback only); whether the CLI honours both names was not verified, and whether the start made any network request was not measured. The start changed one file of Maestro's own state outside the workspace: `~/.maestro/analyze-notification.json` (the counter of the banner above). It was left as it is.

---

## 5. STALE MARKERS (D9 DN-4)

**Result: PASS. Exactly the two markers were removed.**

Origin, checked before the removal: the predecessor's decision D122 (`docs/2026-09-30_dems_demo_stack_setup/decisions/decisions.md:125`) says the controller created both markers when it started mock-core on 4400 and Vite on `127.0.0.1:5173` for the user's manual test. Those servers are gone. Both files are git-ignored (`.gitignore:59: .locks/`) and untracked.

Before (06:36:10 WIB):

```
/Users/gsp-budi/Documents/DEMS/.locks/mock-core.users/:
total 0
drwxr-xr-x@  3 gsp-budi  staff   96 Oct  1 11:04 .
drwxr-xr-x@ 21 gsp-budi  staff  672 Oct  4 00:28 ..
-rw-r--r--@  1 gsp-budi  staff    0 Oct  1 11:04 user-manual-test

/Users/gsp-budi/Documents/DEMS/.locks/vite.users/:
total 0
drwxr-xr-x@  3 gsp-budi  staff   96 Oct  1 11:04 .
drwxr-xr-x@ 21 gsp-budi  staff  672 Oct  4 00:28 ..
-rw-r--r--@  1 gsp-budi  staff    0 Oct  1 11:04 user-manual-test
== listeners on 4400 and 5173 ==
lsof PORT 4400 rc=1 :: <no output>
lsof PORT 5173 rc=1 :: <no output>
netstat grep rc=1 (1 = no LISTEN socket on 4400 or 5173, any owner, any address)
== the Vite PID recorded on 2026-10-01 ==
vite.pid=73328
  PID STARTED                      COMMAND
ps rc=1 (1 = no such process)
```

A `ps` search for `mock-core|vite|metro|expo start` returned no line. So nothing uses what the markers protected: they are stale.

Removal and after (06:36:16 WIB):

```
$ rm .locks/mock-core.users/user-manual-test
rm mock-core marker rc=0
$ rm .locks/vite.users/user-manual-test
rm vite marker rc=0
== listing after ==
/Users/gsp-budi/Documents/DEMS/.locks/mock-core.users/:
total 0
drwxr-xr-x@  2 gsp-budi  staff   64 Oct  4 06:36 .
drwxr-xr-x@ 21 gsp-budi  staff  672 Oct  4 00:28 ..

/Users/gsp-budi/Documents/DEMS/.locks/vite.users/:
total 0
drwxr-xr-x@  2 gsp-budi  staff   64 Oct  4 06:36 .
drwxr-xr-x@ 21 gsp-budi  staff  672 Oct  4 00:28 ..
```

The two folders stay (empty), for the reference counting of P5. Every other entry of `.locks/` is unchanged: the three `.pid` files of step 24, the predecessor's `.lock`, `.log` and `vite.pid` files (the last one is stale too, PID 73328 is gone, but it is not this row's to remove).

Rollback H-16 (RB-16), if ever wanted: `touch .locks/mock-core.users/user-manual-test .locks/vite.users/user-manual-test`.

---

## 6. DP-1 INPUT

| Emulator | Running | DEMS build class | Usable for Live checks as it is | What would be needed |
|---|---|---|---|---|
| `dems_phone` (`emulator-5554`) | yes | **DEBUG** (0.1.0 / 1, cert `fac61745...3b9c`) | **Yes** (eligible under DP-1 A) | Only the planned step of W13: `adb install -r` of the rebuilt debug APK. No uninstall, no data wipe, no extra decision |
| `dems_tablet` (`emulator-5556`) | yes | **DEBUG** (0.1.0 / 1, cert `fac61745...3b9c`) | **Yes** (eligible under DP-1 A) | The same |
| `dems_phone2` (`emulator-5558`) | yes | **DEBUG** (0.1.0 / 1, cert `fac61745...3b9c`) | **Yes** (eligible under DP-1 A) | The same |

"Usable as it is" means: the emulator is in the set that DP-1 A allows, and the debug APK of W13 can replace the installed one in place. The APK that is installed now is the predecessor's build (SHA-256 `cb6b1f51...0be5`, 2026-10-01); it has no Live mode yet, so every Live check still waits for W13, as planned.

**Recommendation (the controller decides).** Record as the outcome of DP-1, option A (D17): **the debug-build emulators are `dems_phone`, `dems_tablet` and `dems_phone2`: three of three.** This is the first line of the table in 02_plan section 5.5:

| Debug-build emulators | Device lanes | Reserved for W94 to W96 | Effect |
|--:|---|---|---|
| 3 | Lane 1 `dems_phone`, lane 2 `dems_tablet` | `dems_phone2` | As section 5.1 |

- Option B (an uninstall on a named emulator) is **not needed**; no decision that names an emulator has to be recorded.
- W12 and W13 can start once the controller has recorded this list; W13 names all three emulators for `adb install -r`.
- The tablet holds the debug build, so the tablet check of the Pair screen (KI-01, W57) can run.
- Two points for W13, both from this row's evidence: (a) confirm the debug keystore digest after the prebuild (section 2.5); (b) the file to copy to `.cache/apk-backup/` (KI-21) is `apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk`, 324,503,614 bytes, SHA-256 `cb6b1f513d525372b6e6c6ea35c134da29e9e8a0c79f2566a8fa4e7d217b0be5`; `.cache/apk-backup/` does not exist yet.

---

## 7. PROCESSES AND HARD RULES

**Result: PASS. No process started by this row is left running; the emulators and the adb server are as step 24 left them.**

Closing snapshot, 06:36:34 WIB:

```
== processes this row could have left behind ==      (ps, pattern maestro|keytool|apk_cert_digest|netstat|lsof)
(end of list)
== adb server and emulators unchanged ==
83893     1       09:41 adb -L tcp:5037 fork-server server --reply-fd 4
84074     1       09:15 /Users/gsp-budi/Library/Android/sdk/emulator/qemu/darwin-aarch64/qemu-system-aarch64 -avd dems_phone -port 5554 -no-metrics -gpu host -no-boot-anim -no-snapshot-load -no-snapsh
84299     1       08:46 /Users/gsp-budi/Library/Android/sdk/emulator/qemu/darwin-aarch64/qemu-system-aarch64 -avd dems_tablet -port 5556 -no-metrics -gpu host -no-boot-anim -no-snapshot-load -no-snaps
84494     1       08:30 /Users/gsp-budi/Library/Android/sdk/emulator/qemu/darwin-aarch64/qemu-system-aarch64 -avd dems_phone2 -port 5558 -no-metrics -gpu host -no-boot-anim -no-snapshot-load -no-snaps
List of devices attached
emulator-5554	device
emulator-5556	device
emulator-5558	device

emulator-5554 boot_completed=1 app_pid=[] reverse=[] airplane=0
emulator-5556 boot_completed=1 app_pid=[] reverse=[] airplane=0
emulator-5558 boot_completed=1 app_pid=[] reverse=[] airplane=0
 6:36  up 2 days, 13:49, 1 user, load averages: 3.12 2.90 2.13
```

(The `ps` lines are cut at 200 characters by the command.) The PIDs are the ones of step 24 (adb server 83893; emulators 84074, 84299, 84494), with elapsed times that run from step 24.

| Hard rule | Kept | Evidence |
|---|---|---|
| Never kill, boot, reboot or wipe an emulator | yes | Same three PIDs, uptime continuous |
| Never uninstall or start an app | yes | `firstInstallTime` and `lastUpdateTime` are of 2026-10-01; `pidof` empty |
| Never stop a process this row did not start | yes | No `kill`, no signal, no `adb kill-server` in any command of this row |
| Start no server | yes | No listener appeared between the first and the closing probe |
| Change no source file | yes | The only repository-side changes are the two removals in `.locks/` and the two documents of this row |
| Only the two marker files deleted | yes | Section 5 |
| Never print a credential | yes | Printed: certificate subjects and digests, the public template password `android` of the debug keystore. Nothing under `apps/mobile/signing/` or `.data/` was read |
| Add or remove no reverse rule, change no setting | yes | `reverse=[]`, `airplane=0` before and after |

Commands that ran with the per-command sandbox bypass (P10), all read-only: the `lsof`, `netstat` and `ps` probes; every `adb` call; the one Maestro start. Reason, observed: inside the sandbox a loopback connect to the adb server fails (`nc -z 127.0.0.1 5037` returns 1), and `netstat` answers `sysctl: net.inet.tcp.pcblist_n: Operation not permitted`. Everything else (`node`, `npm`, `df`, `keytool`, `shasum`, the Python script, `rm` of the two markers) ran inside the sandbox.

---

## 8. Check list

| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | Every port this task binds is free (4400, 4410-4419, 4420, 4421-4423, 4432, `127.0.0.1:5173`, 5176-5178, 8081-8086) | PASS | 1.1, 1.2, 1.5 |
| 2 | `127.0.0.1:4432` free | PASS | 1.1, 1.2, 1.5 |
| 3 | `127.0.0.1:4420` free | PASS | 1.1, 1.2, 1.5 |
| 4 | The other project's listeners (`[::1]:5173`, `127.0.0.1:5174`, `[::1]:5175`) untouched | PASS | None was listening; this row stopped nothing (1.3, 7) |
| 5 | Emulator ports owned as stated | PASS | 1.2, 1.3 |
| 6 | 5432 not used by this task | PASS, with note N-1: a host PostgreSQL 18 listens there | 1.4 |
| 7 | `dems_phone`: running, build class and digest recorded | PASS: DEBUG, `fac61745...3b9c` | 2 |
| 8 | `dems_tablet`: running, build class and digest recorded | PASS: DEBUG, `fac61745...3b9c` | 2 |
| 9 | `dems_phone2`: running, build class and digest recorded | PASS: DEBUG, `fac61745...3b9c` | 2 |
| 10 | Airplane mode and reverse rules recorded | PASS: off; none | 2.2 |
| 11 | `node -v` is v26.8.2 | PASS | 3 |
| 12 | `npm -v` is 11.19.1 | PASS | 3 |
| 13 | Free disk space recorded | PASS: 671 GiB | 3 |
| 14 | Maestro CLI starts outside the sandbox | PASS: 2.11.0, exit 0 | 4 |
| 15 | The two stale markers removed, nothing else | PASS | 5 |
| 16 | No process started by the row is left running | PASS | 7 |

FAIL: none.

## 9. Notes

| # | Note | Where |
|---|---|---|
| N-1 | A PostgreSQL 18 server of the host (user `postgres`, PID 312, `/Library/PostgreSQL/18`) listens on `*:5432`. No collision; it corrects F1; always pass 4432 explicitly | 1.4 |
| N-2 | `~/.android/debug.keystore` does not exist. The comparison used `apps/mobile/android/app/debug.keystore`, the file the Gradle debug signing config names. Digests match | 2.5 |
| N-3 | The device prints no certificate SHA-256 (`pm get-app-links` empty, `dumpsys` gives a 32-bit hash code). The digest was read from the APK Signing Block of the byte-identical host file by a script, proven on the release APK and tied to each device by the file hash and by the hash code | 2.4 |
| N-4 | The Maestro start changed `~/.maestro/analyze-notification.json` (Maestro's own state). Two environment variables were added to the command; their effect was not verified | 4 |
| N-5 | No listener of the other project and none of step 27 was present at the three probe times. A port probe is a snapshot | 1.3 |
| N-6 | `.locks/vite.pid` (2026-10-01, PID 73328, process gone) is stale too. It is not in this row's write list and was left | 5 |

## 10. Limits of this check

- The certificate digest was read from the host's `app-debug.apk`, not from a copy pulled off each device. The link to each device is the SHA-256 of `base.apk` computed on that device (equal to the host file's) and the package manager's hash code `51ed3f60`.
- `lsof` shows only this user's processes; listeners of other users are covered by `netstat` (which is how N-1 was found).
- Not probed, by instruction: PIN and fingerprint enrolment, the app's local data, anything under `apps/mobile/signing/`.
- No connection was made to the server on 5432; what it holds and who uses it is unknown.
- That `expo prebuild` restores the same debug keystore is a hypothesis (2.5); W13 can check it in one command.

---
*Generated: 2026-10-04 06:39 WIB. The port section was first written to this file at about 06:36 WIB (between the Maestro start at 06:35:23 and the marker check at 06:36:10), before sections 2 to 10.*
