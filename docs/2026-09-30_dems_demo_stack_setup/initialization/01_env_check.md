---
task_id: 2026-09-30_dems_demo_stack_setup
task_slug: dems_demo_stack_setup
blueprint_row: 13
agent: verifier
date: 2026-10-01
narrative_tier: 3
status: complete
verdict: PASS (25/25 blocking items PASS: 24 executed now + 1 by reference to 05_avds.md; 0 FAIL; 1 non-blocking item PASS with note)
sources: status_tasks.md (controller pre-install baseline), initialization/02_git_init.md, 03_jdk_install.md, 04_android_sdk_install.md, 05_avds.md, 07_js_runtime.md, research/03_analysis.md (section G, Host Impact Register, V17, H5, R6), masterplan/01_specs.md (section 6.4, AC-01..AC-11), decisions/decisions.md (D11, D12, D23, D24)
---

# Row 13: Consolidated environment readiness check (host toolchain)

## Result

**PASS.** Every pinned host tool resolves and reports its pinned version in a fresh login shell (`zsh -l -c`). Two checks also ran in a clean-environment login shell (`env -i ... zsh -l -c`), so the result does not depend on this agent session's environment. Both AVDs are defined with the D23 names. `~/.zprofile` holds exactly the two marked blocks, with only additions against the backup. The git repo has no remote and ignores `.docx`. There is 710 GiB free. **`~/Documents` is not iCloud-synced**: iCloud Drive is on, but "Desktop & Documents" has never been enabled (`brctl`, Finder preferences and filesystem evidence all agree). Graft 0.18.0 reports the graph in sync (non-blocking).

This check was read-only. Nothing was installed, updated or configured, and no emulator was booted (D24; the boot proof is in `05_avds.md`).

There are **no FAIL items**. Three findings change plan wording but do not block anything. See "Findings for the controller" (F1 is a correction to D23).

## Method

| Aspect | Value |
|---|---|
| Run window | 2026-10-01 00:23:29 to 00:26 WIB |
| Shell | `/bin/zsh` 5.9 (arm64-apple-darwin26.0), login mode: `zsh -l -c '<cmd>'` |
| Clean-env cross-check | `env -i HOME="$HOME" USER="$USER" TERM=dumb /bin/zsh -l -c '<cmd>'` (no inherited agent variables) |
| Host | `uname -m` gives `arm64`; `sw_vers` gives macOS 27.0.1 (26A434) |
| "Before" column | The controller pre-install baseline in `status_tasks.md` ("Controller pre-screen evidence", 2026-09-30). Where that baseline did not record an item, the source is named in the cell (03_analysis V17, 02_git_init §1). |

### Sandbox handling (D14, D24)

Most commands ran inside the session sandbox. Four commands ran with the sandbox disabled, each after a sandbox denial:

| Command | Sandbox error observed | Why it needs the host |
|---|---|---|
| `android --no-metrics --sdk="$ANDROID_HOME" sdk list` (x2: listing, then ID check) | `Error: Failed to open "/Users/gsp-budi/.android/cli/bundles/lock" ... Operation not permitted (os error 1)` | The Android CLI opens its bundle lock under `~/.android`, which is outside the sandbox write scope |
| `emulator -version` | `Incompatible processor. This Qt build requires the following features: neon`, rc=134 | D24 reproduced: `sysctl` is denied in the sandbox, so the emulator's CPU-feature probe fails. It is not a hardware problem |
| `brctl status com.apple.CloudDocs` | `brctl: Trying to invoke brctl from a sandboxed process`, rc=1 | `brctl` refuses to run under a sandbox |

`adb version`, `emulator -list-avds` and `avdmanager list avd` all worked **inside** the sandbox.

## Readiness table

Each line quotes the observed output. "Re-run row" names the blueprint row that fixes the item if it ever fails.

| # | Item | Before (baseline) | Command (`zsh -l -c` unless noted) | Observed | Expected | Result | Re-run row |
|---|---|---|---|---|---|---|---|
| 1 | Node | `v26.8.2` | `node -v; which -a node` | `v26.8.2`; `/usr/local/bin/node` (only entry) | `v26.8.2`, first entry `/usr/local/bin/node` (AC-09, SD-01) | PASS | 12 |
| 2 | npm | `11.19.1` | `npm -v; which -a npm` | `11.19.1`; `/usr/local/bin/npm` | `11.19.1` (AC-09, SD-02) | PASS | 12 |
| 3 | Java version | Missing (`/usr/libexec/java_home -V`: `Unable to locate a Java Runtime.`, per 03_jdk_install baseline) | `java -version 2>&1 \| grep version` | `openjdk version "17.0.20.1" 2026-08-18` | contains `17.0.20.1` (AC-01, matched on "version", see F2) | PASS | 8 |
| 4 | `java` precedence | only the `/usr/bin/java` macOS stub | `which -a java` | 1st `/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home/bin/java`, 2nd `/usr/bin/java` | keg first (HI-3) | PASS | 8 |
| 5 | Java arch | n/a | `java -XshowSettings:properties -version 2>&1 \| grep os.arch` | `os.arch = aarch64` | `aarch64` (AC-02) | PASS | 8 |
| 6 | `JAVA_HOME` | unset | `echo $JAVA_HOME; test -d; test -x $JAVA_HOME/bin/java` | `/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home`; `JAVA_HOME dir exists`; `JAVA_HOME/bin/java executable` | that path, directory exists, `java` executable (AC-01) | PASS | 8 |
| 7 | JDK formula / no sudo symlink | Absent (V17) | `brew list --versions openjdk@17`; `ls -la /Library/Java/JavaVirtualMachines/` | `openjdk@17 17.0.20.1`; directory empty (only `.` and `..`) | installed; no `/Library/Java` symlink (SD-45) | PASS | 8 |
| 8 | `ANDROID_HOME` | unset | `echo $ANDROID_HOME; test -d "$ANDROID_HOME"` | `/Users/gsp-budi/Library/Android/sdk`; `ANDROID_HOME dir exists` | that path (AC-03) | PASS | 9 |
| 9 | cmdline-tools | Missing (`sdkmanager` not found) | `which sdkmanager avdmanager android; grep Pkg.Revision .../cmdline-tools/latest/source.properties` | all three under `.../sdk/cmdline-tools/latest/bin/`; `Pkg.Revision=23.0` | rev 23.0 (AC-03) | PASS | 9 |
| 10 | 7 pinned SDK packages | Missing | `android --no-metrics --sdk="$ANDROID_HOME" sdk list` (unsandboxed; see F1), then `tr "/" ";"` and grep each ID | all 7 `PRESENT` (listing below) | all 7 IDs (AC-04, D23) | PASS | 9 |
| 11 | `adb` | Missing | `adb version` | `Version 37.0.1-15733141` | `37.0.1` (AC-05) | PASS | 9 |
| 12 | Emulator binary | Missing | `emulator -version \| head -3` (unsandboxed, D24) | `Android emulator version 37.1.11.0 (build_id 15917651) (CL:N/A)` | `37.1.11` (AC-05) | PASS | 9 |
| 13 | AVD list | none (`~/.android` absent, V17) | `emulator -list-avds` | `dems_phone`, `dems_tablet`, rc=0 | both names (D23) | PASS | 10 |
| 14 | AVD definitions | none | `avdmanager list avd` | `dems_phone`: `pixel_10 (Google)`; `dems_tablet`: `pixel_tablet (Google)`; both `Android 16.0 ("Baklava") Tag/ABI: google_apis/arm64-v8a` | both AVDs on the pinned image (AC-06 with D23 names) | PASS | 10 |
| 15 | AVD config keys | none | `grep -E '^(hw.device.name\|hw.ramSize\|...)=' ~/.android/avd/<name>.avd/config.ini` | tablet `4096 / 4 / landscape / audioInput=no / cameras none / gpu host`; phone `3072 / 4 / portrait / audioInput=no / cameras none / gpu host` | per 01_specs §6.3, SPEC-C10, 05_avds §3 | PASS | 10 |
| 16 | AVD cold boot | n/a | **not re-run** (D24; a scaffold agent is using the emulators) | carried from 05_avds.md §4: `dems_tablet` 25 s, `dems_phone` 22 s to `sys.boot_completed=1` | at most 180 s (AC-07) | PASS (by reference) | 10 |
| 17 | `~/.zprofile` marked blocks | 11 lines, no DEMS blocks (V17; 03_jdk_install baseline sha256 `84ff8ea5...75f0`) | `grep -n -E '^# (>>>\|<<<) dems-demo' ~/.zprofile` | lines 13/16 (`jdk`), lines 18/21 (`android sdk`); file 21 lines | 2 marked blocks (D11, HI-3) | PASS | 8, 9 |
| 18 | `~/.zprofile` backup | n/a | `ls -la ~/.zprofile.bak.dems-*; shasum -a 256` | `/Users/gsp-budi/.zprofile.bak.dems-2026-09-30-235451`, 321 bytes, sha256 `84ff8ea5b3dcf3f570821ec7d1c4f2d1682ba374bbcf897c2ef33bd12b2d75f0` | exists, equal to the pre-task original (see F3 for the name) | PASS | 8 |
| 19 | Profile diff: only additions | n/a | `diff <backup> ~/.zprofile`; count of `^<` lines | `11a12,21`: 10 added lines (8 block lines + 2 blank separators); removed or changed lines: `0` | only additions (AC-11) | PASS | 8, 9 |
| 20 | `~/.zshrc` not created; no watchman/pnpm/fnm | `~/.zshrc` absent (V17); watchman and pnpm missing | `ls -la ~/.zshrc`; `brew list --formula -1 \| grep -cxE "watchman\|pnpm\|fnm"`; `which` each | `No such file or directory`; count `0`; all three `not found` | absent; `0` (AC-10, D11, D12) | PASS | 8 (profile); 12 (runtime tools) |
| 21 | Git repo | Not a repo (`fatal: not a git repository`, exit 128; 02_git_init §1); git `2.55.0` | `git -C /Users/gsp-budi/Documents/DEMS rev-parse --is-inside-work-tree; --show-toplevel; symbolic-ref HEAD` | `true`; `/Users/gsp-budi/Documents/DEMS`; `refs/heads/main`; `git version 2.55.0` | inside work tree, branch `main` (row 7) | PASS | 7 |
| 22 | Git remote empty, no commit yet | n/a | `git remote -v \| wc -l`; `git rev-parse --verify -q HEAD` | `0`; rc=1 (no commits) | no remote (D5); commit only at row 25 | PASS | 7 |
| 23 | `.docx` ignored | not ignored before row 7 (02_git_init §4.2) | `git check-ignore -v <design book>.docx`; nested probe; `ls-files '*.docx'`; `grep -c docx .git/info/exclude` | `.gitignore:9:*.docx` matches the design book and `some/nested/dir/test.docx`; 0 `.docx` in the index; interim exclude lines removed (`0`) | ignored by the root `.gitignore` (D5, D7) | PASS | 7 |
| 24 | Free disk | 725 GiB free | `df -h ~ /Users/gsp-budi/Documents/DEMS` | `926Gi` size, `189Gi` used, **`710Gi` avail**, 22% | enough for the remaining HI-6/HI-8 estimate (about 3-5 GB, 03 Disk estimate) | PASS | none |
| 25 | `~/Documents` iCloud sync (R6, H5) | Preliminary "not synced" (V17: CloudDocs empty) | 4 methods, see "iCloud verdict" | `Desktop & Documents: current=NO lastEnabled=(never) lastDisabled=(never)` | a verdict with evidence | PASS: **not synced** | none (decision item only if it ever becomes synced) |
| 26 | Graft (non-blocking) | `graft/` present, cache only (status_tasks.md) | `graft --version`; `graft check` (from repo root) | `0.18.0`; `graph check: OK — the wiring graph is in sync with the code.`, rc=0 | runs; non-blocking | PASS (non-blocking; note F5) | none (`graft build .` if stale) |

Count: items 1-25 are blocking, and all 25 PASS with 0 FAIL. Twenty-four were executed in this run. Item 16 passes by reference to `05_avds.md` as instructed, without a new boot. Item 26 is non-blocking.

## Evidence

### E1. JavaScript runtime (items 1-2)

```
$ zsh -l -c 'node -v; npm -v; which -a node; which -a npm'
v26.8.2
11.19.1
/usr/local/bin/node
/usr/local/bin/npm
rc=0
```

This agrees with row 12 (`initialization/07_js_runtime.md`, captured at 00:23:41 WIB, the same values).

### E2. Java (items 3-7)

```
$ zsh -l -c 'java -version 2>&1; echo "rc=$?"'
Picked up JAVA_TOOL_OPTIONS: -Djava.net.preferIPv4Stack=true
openjdk version "17.0.20.1" 2026-08-18
OpenJDK Runtime Environment Homebrew (build 17.0.20.1+0)
OpenJDK 64-Bit Server VM Homebrew (build 17.0.20.1+0, mixed mode, sharing)
rc=0

$ zsh -l -c 'java -version 2>&1 | grep version'
openjdk version "17.0.20.1" 2026-08-18

$ zsh -l -c 'which -a java'
/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home/bin/java
/usr/bin/java

$ zsh -l -c 'java -XshowSettings:properties -version 2>&1 | grep -E "os.arch|java.home"'
    java.home = /opt/homebrew/Cellar/openjdk@17/17.0.20.1/libexec/openjdk.jdk/Contents/Home
    os.arch = aarch64

$ zsh -l -c 'echo "JAVA_HOME=$JAVA_HOME"; test -d "$JAVA_HOME" && echo "JAVA_HOME dir exists"; test -x "$JAVA_HOME/bin/java" && echo "JAVA_HOME/bin/java executable"; javac -version 2>&1 | grep javac'
JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home
JAVA_HOME dir exists
JAVA_HOME/bin/java executable
javac 17.0.20.1

$ HOMEBREW_NO_AUTO_UPDATE=1 HOMEBREW_NO_ANALYTICS=1 brew list --versions openjdk@17
openjdk@17 17.0.20.1

$ ls -la /Library/Java/JavaVirtualMachines/
drwxr-xr-x  2 root  wheel   64 Sep 24 14:10 .
drwxr-xr-x  4 root  wheel  128 Sep 24 14:10 ..
```

Where `JAVA_TOOL_OPTIONS` comes from:

```
session JAVA_TOOL_OPTIONS=-Djava.net.preferIPv4Stack=true
$ env -i HOME="$HOME" USER="$USER" TERM=dumb /bin/zsh -l -c '...'
clean-env JAVA_TOOL_OPTIONS=<unset>
openjdk version "17.0.20.1" 2026-08-18        <- first line when the agent environment is absent
```

### E3. Android SDK (items 8-12)

```
$ zsh -l -c 'echo "ANDROID_HOME=$ANDROID_HOME"; test -d "$ANDROID_HOME" && echo "ANDROID_HOME dir exists"; which sdkmanager avdmanager adb emulator android; grep Pkg.Revision "$ANDROID_HOME/cmdline-tools/latest/source.properties"'
ANDROID_HOME=/Users/gsp-budi/Library/Android/sdk
ANDROID_HOME dir exists
/Users/gsp-budi/Library/Android/sdk/cmdline-tools/latest/bin/sdkmanager
/Users/gsp-budi/Library/Android/sdk/cmdline-tools/latest/bin/avdmanager
/Users/gsp-budi/Library/Android/sdk/platform-tools/adb
/Users/gsp-budi/Library/Android/sdk/emulator/emulator
/Users/gsp-budi/Library/Android/sdk/cmdline-tools/latest/bin/android
Pkg.Revision=23.0
```

The delegated command `sdkmanager --no-metrics --list_installed` **does not work** (finding F1):

```
$ zsh -l -c 'sdkmanager --no-metrics --list_installed; echo "rc=$?"'
WARNING: The SDK Manager CLI tool (sdkmanager) is deprecated. Android CLI will be used instead.
...
Unknown option: '--no-metrics'
<usage text>
rc=1
```

Root cause, from the shim source `~/Library/Android/sdk/cmdline-tools/latest/bin/sdkmanager`: the option loop has no `--no-metrics` case, so the flag falls through to `-*) echo "Unknown option: '$1'" >&2; show_help`, and `show_help` exits 1 before `run_android_cli` is reached. `--no-metrics` is a global option of the `android` binary (04_android_sdk_install §4). The metrics-free equivalent of `--list_installed` is therefore the command the shim builds (`"$SCRIPT_DIR/android" --sdk="$SDK_ROOT" sdk list`) with `--no-metrics` added:

```
$ zsh -l -c 'android --no-metrics --sdk="$ANDROID_HOME" sdk list; echo "rc=$?"'     (sandbox disabled; see Method)
Installed packages:
  build-tools/36.0.0                                     36.0.0                            Android SDK Build-Tools 36
  cmake/3.22.1                                           3.22.1                            CMake 3.22.1
  cmdline-tools/latest                                   unknown         ->        23.0.0  Android SDK Command-line Tools (latest)
  emulator                                               37.1.11                           Android Emulator
  ndk/27.1.12297006                                      27.1.12297006                     NDK (Side by side) 27.1.12297006
  platform-tools                                         37.0.1                            Android SDK Platform-Tools
  platforms/android-36                                   2.0.0                             Android SDK Platform 36
  system-images/android-36/google_apis/arm64-v8a         7.0.0                             Google APIs ARM 64 v8a System Image
rc=0

$ ... sdk list | tr "/" ";"  then grep -E "^[[:space:]]+<id>[[:space:]]" for each pinned ID     (D23 normalisation)
PRESENT platform-tools
PRESENT emulator
PRESENT platforms;android-36
PRESENT build-tools;36.0.0
PRESENT ndk;27.1.12297006
PRESENT cmake;3.22.1
PRESENT system-images;android-36;google_apis;arm64-v8a
```

Revisions match 01_specs §6.4: platform-tools 37.0.1, emulator 37.1.11, platform r2 (`2.0.0`), image r7 (`7.0.0`). `cmdline-tools/latest unknown -> 23.0.0` is the known harmless display quirk in 04_android_sdk_install §7. The files are rev 23.0 (item 9).

Metrics side-effect check. The metrics spool count was `5` before these commands and `5` after every one of them. `~/.android/cli/last_update_check` mtime stayed `Sep 30 23:57:15 2026`.

```
$ zsh -l -c 'adb version; echo "rc=$?"'                       (inside sandbox)
Android Debug Bridge version 1.0.41
Version 37.0.1-15733141
Installed as /Users/gsp-budi/Library/Android/sdk/platform-tools/adb
Running on Darwin 27.0.0 (arm64)
rc=0

$ zsh -l -c 'emulator -version 2>&1 | head -5'                (inside sandbox: D24 reproduced)
Incompatible processor. This Qt build requires the following features:
    neon
rc=134

$ zsh -l -c 'emulator -version 2>&1 | head -3'                (sandbox disabled)
Android emulator version 37.1.11.0 (build_id 15917651) (CL:N/A)
Copyright (C) 2006-2024 The Android Open Source Project and many others.
This program is a derivative of the QEMU CPU emulator (www.qemu.org).
rc=0
```

`adb version` does not start an adb server. No `adb devices`, `adb start-server` or emulator launch was run by this row.

### E4. AVDs (items 13-16)

```
$ zsh -l -c 'emulator -list-avds 2>&1; echo "rc=$?"'          (inside sandbox)
dems_phone
dems_tablet
rc=0

$ zsh -l -c 'avdmanager list avd'                              (inside sandbox)
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
rc=0

--- dems_tablet config.ini
hw.audioInput=no
hw.camera.back=none
hw.camera.front=none
hw.cpu.ncore=4
hw.device.name=pixel_tablet
hw.gpu.mode=host
hw.initialOrientation=landscape
hw.ramSize=4096
image.sysdir.1=system-images/android-36/google_apis/arm64-v8a/
--- dems_phone config.ini
hw.audioInput=no
hw.camera.back=none
hw.camera.front=none
hw.cpu.ncore=4
hw.device.name=pixel_10
hw.gpu.mode=host
hw.initialOrientation=portrait
hw.ramSize=3072
image.sysdir.1=system-images/android-36/google_apis/arm64-v8a/
```

The config values are identical to the post-boot re-read in 05_avds.md §3. `hw.initialOrientation` is a start pose, not a lock (05_avds §3, D17).

### E5. Shell profile (items 17-20)

```
$ grep -n -E '^# (>>>|<<<) dems-demo' ~/.zprofile
13:# >>> dems-demo: jdk (added 2026-09-30, blueprint row 8) >>>
16:# <<< dems-demo: jdk <<<
18:# >>> dems-demo: android sdk (added 2026-09-30, blueprint row 9) >>>
21:# <<< dems-demo: android sdk <<<

$ wc -l < ~/.zprofile; shasum -a 256 ~/.zprofile
      21
e8543f6d9b06b1d82a5da8e8af185445b0f5e946fa98fe73dded75717e6ac2cd  /Users/gsp-budi/.zprofile

$ ls -la ~/.zprofile.bak.dems-*; shasum -a 256 ~/.zprofile.bak.dems-*
-rw-r--r--@ 1 gsp-budi  staff  321 Sep 11 23:06 /Users/gsp-budi/.zprofile.bak.dems-2026-09-30-235451
84ff8ea5b3dcf3f570821ec7d1c4f2d1682ba374bbcf897c2ef33bd12b2d75f0  /Users/gsp-budi/.zprofile.bak.dems-2026-09-30-235451

$ diff ~/.zprofile.bak.dems-2026-09-30-235451 ~/.zprofile
11a12,21
>
> # >>> dems-demo: jdk (added 2026-09-30, blueprint row 8) >>>
> export JAVA_HOME="/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home"
> export PATH="$JAVA_HOME/bin:$PATH"
> # <<< dems-demo: jdk <<<
>
> # >>> dems-demo: android sdk (added 2026-09-30, blueprint row 9) >>>
> export ANDROID_HOME="$HOME/Library/Android/sdk"
> export PATH="$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator"
> # <<< dems-demo: android sdk <<<
diff rc=1   (differences present, as expected)
$ diff ... | grep -c '^<'
0          (no removed or changed lines)

$ ls -la ~/.zshrc
ls: /Users/gsp-budi/.zshrc: No such file or directory

$ zsh -l -c 'HOMEBREW_NO_AUTO_UPDATE=1 HOMEBREW_NO_ANALYTICS=1 brew list --formula -1 | grep -cxE "watchman|pnpm|fnm"'
0
watchman: not found
pnpm: not found
fnm: not found
```

The backup hash equals the pre-task hash recorded in 03_jdk_install.md (Baseline table), so the backup holds the unmodified original. The block text matches the Host Impact Register "Exact profile lines" verbatim.

### E6. Clean-environment login shell (cross-check for items 1-14)

```
$ env -i HOME="$HOME" USER="$USER" TERM=dumb /bin/zsh -l -c '...'
JAVA_TOOL_OPTIONS=<unset>
node v26.8.2 | npm 11.19.1
openjdk version "17.0.20.1" 2026-08-18
JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home
ANDROID_HOME=/Users/gsp-budi/Library/Android/sdk
node        /usr/local/bin/node
npm         /usr/local/bin/npm
java        /opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home/bin/java
sdkmanager  /Users/gsp-budi/Library/Android/sdk/cmdline-tools/latest/bin/sdkmanager
avdmanager  /Users/gsp-budi/Library/Android/sdk/cmdline-tools/latest/bin/avdmanager
adb         /Users/gsp-budi/Library/Android/sdk/platform-tools/adb
emulator    /Users/gsp-budi/Library/Android/sdk/emulator/emulator
git         /opt/homebrew/bin/git
graft       /Users/gsp-budi/.npm-global/bin/graft
Version 37.0.1-15733141
dems_phone
dems_tablet
--- PATH order
     1  /opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home/bin     <- block A (prepended)
     2  /Users/gsp-budi/.npm-global/bin
     3  /opt/homebrew/bin
     4  /opt/homebrew/sbin
     5  /Library/Frameworks/Python.framework/Versions/3.14/bin
     6  /usr/local/bin
     7  /System/Cryptexes/App/usr/bin
     8  /usr/bin
   ...
    16  /Users/gsp-budi/Library/Android/sdk/cmdline-tools/latest/bin          <- block B (appended)
    17  /Users/gsp-budi/Library/Android/sdk/platform-tools
    18  /Users/gsp-budi/Library/Android/sdk/emulator
```

The PATH order follows HI-3: the JDK is prepended ahead of the `/usr/bin/java` stub, and the Android entries are appended. `git` resolves to Homebrew's `/opt/homebrew/bin/git` (`git version 2.55.0`) ahead of `/usr/bin/git`.

### E7. Git (items 21-23)

```
$ git --version
git version 2.55.0
$ git -C /Users/gsp-budi/Documents/DEMS rev-parse --is-inside-work-tree
true
$ git -C /Users/gsp-budi/Documents/DEMS rev-parse --show-toplevel
/Users/gsp-budi/Documents/DEMS
$ git -C /Users/gsp-budi/Documents/DEMS symbolic-ref HEAD
refs/heads/main
$ git -C /Users/gsp-budi/Documents/DEMS remote -v | wc -l
       0
$ git -C /Users/gsp-budi/Documents/DEMS rev-parse --verify -q HEAD
HEAD verify rc=1            (no commits yet; row 25 commits)
$ git -C /Users/gsp-budi/Documents/DEMS check-ignore -v "DEMS_Edge_Client_Engineering_Design_Book_v0.2_DOWNLOAD(2).docx"
.gitignore:9:*.docx	DEMS_Edge_Client_Engineering_Design_Book_v0.2_DOWNLOAD(2).docx
rc=0
$ git -C /Users/gsp-budi/Documents/DEMS check-ignore -v --no-index some/nested/dir/test.docx
.gitignore:9:*.docx	some/nested/dir/test.docx
$ find /Users/gsp-budi/Documents/DEMS -name '*.docx' (excluding node_modules, .git) | check-ignore each
ignored  /Users/gsp-budi/Documents/DEMS/DEMS_Edge_Client_Engineering_Design_Book_v0.2_DOWNLOAD(2).docx
$ git -C /Users/gsp-budi/Documents/DEMS ls-files -- '*.docx' | wc -l
       0
$ grep -c 'docx' .git/info/exclude
0            (interim guard removed after D7, as planned)
$ git config --global user.name; git config --global user.email
Budi Kusharyanto
60373859+sixer0@users.noreply.github.com       (identity present for row 25; unchanged)
```

### E8. Free disk (item 24)

```
$ df -h ~ /Users/gsp-budi/Documents/DEMS
Filesystem      Size    Used   Avail Capacity iused ifree %iused  Mounted on
/dev/disk3s5   926Gi   189Gi   710Gi    22%    1.9M  7.4G    0%   /System/Volumes/Data
/dev/disk3s5   926Gi   189Gi   710Gi    22%    1.9M  7.4G    0%   /System/Volumes/Data

$ du -sh ~/Library/Android/sdk ~/.android
8.4G	/Users/gsp-budi/Library/Android/sdk
8.5G	/Users/gsp-budi/.android
```

Before: 725 GiB free. Now: 710 GiB free, a drop of 15 GiB. That is consistent with rows 8-10 (JDK 0.5 GiB + SDK 8.4 G + `~/.android` 8.5 G, with APFS rounding). The workspace is on the same volume as `~`.

### E9. iCloud verdict (item 25)

**Verdict: `~/Documents` is NOT iCloud-synced.** iCloud Drive is enabled for app containers. The "Desktop & Documents Folders" option is off and has never been turned on. Four independent read-only methods agree. No setting was changed.

| Method | Command | Result | What it shows |
|---|---|---|---|
| M1. iCloud daemon (authoritative) | `brctl status com.apple.CloudDocs` (sandbox disabled; `brctl` refuses to run sandboxed) | `1 containers matching 'com.apple.CloudDocs'` ... `caught-up` ...<br>`Desktop & Documents: current=NO lastEnabled=(never) lastDisabled=(never)` | The iCloud Drive container is active and caught up. Desktop & Documents sync is off and has **never** been enabled |
| M2. Finder preferences | `defaults read com.apple.finder FXICloudDriveEnabled / FXICloudDriveDesktop / FXICloudDriveDocuments` | `1` / `0` / `0` | iCloud Drive on; Desktop sync off; Documents sync off |
| M3. iCloud Drive container on disk | `ls -la ~/Library/Mobile\ Documents/com~apple~CloudDocs`; `ls -ld .../com~apple~CloudDocs/Documents .../Desktop` | container empty (only `.` and `..`); `Documents` and `Desktop`: `No such file or directory` | When Desktop & Documents sync is on, these folders exist inside the CloudDocs container. They do not exist here |
| M4. `~/Documents` itself | `ls -ldO@e ~/Documents`; `stat -f 'type=%HT flags=%Sf'`; `test -L`; `xattr -l` | `drwx------@ ... /Users/gsp-budi/Documents`; `type=Directory flags=-`; not a symlink; realpath `/Users/gsp-budi/Documents`; only xattr is `com.apple.macl` | A plain local directory with no file-provider attributes and no `dataless` or `compressed` flags. The workspace entries show flag `-` too (`ls -lO /Users/gsp-budi/Documents/DEMS`). Corroborating evidence only; M1 is the authoritative method |

Extra context, not a sync signal for `~/Documents`:

- `~/Library/Preferences/MobileMeAccounts.plist` is **absent** on this macOS 27 build (the directory listing works, so the sandbox is not hiding it). That preference file was therefore not usable as a method.
- `defaults read com.apple.bird` shows `"optimize-storage" = 1`. That setting affects only iCloud Drive content, which does not include `~/Documents` here. The account-scoped key in that domain and the `brctl` sync token are personal identifiers and are deliberately not quoted.
- iCloud app containers under `~/Library/Mobile Documents/` (Pages, Keynote, WhatsApp and others) exist. They are outside the workspace and irrelevant to R6.

Consequence for R6 and H5: resolved as **not synced**. `node_modules`, Gradle output and the confidential `docs/` in `/Users/gsp-budi/Documents/DEMS` are not uploaded to iCloud. The 02_structured "Decide after row 13" item 5 needs no user decision. **Re-check trigger:** if the user later enables "Desktop & Documents Folders" in System Settings > Apple Account > iCloud > iCloud Drive, re-run M1. `current=YES` means R6 becomes live.

### E10. Graft (item 26, non-blocking)

```
$ zsh -l -c 'which -a graft'
/Users/gsp-budi/.npm-global/bin/graft
$ zsh -l -c 'graft --version; echo "rc=$?"'
0.18.0
rc=0
$ zsh -l -c 'graft check --help' | head -3
Usage: graft check [options] [dir]
Fail if graft/ is stale relative to the code (for CI)
$ zsh -l -c 'cd /Users/gsp-budi/Documents/DEMS && graft check; echo "rc=$?"'
⬆ graft 0.18.0 → 0.21.1 available: run `npm i -g @nanonets/graft@latest` (restart your agent after).
deep layer: not built (run `graft build --deep` for concept nodes) — wiring graph is the source of truth

graph check: OK — the wiring graph is in sync with the code.
rc=0
```

`ls -la graft/` was identical before and after `graft check` (`.cache` 00:24, `.graph` 00:23, `INDEX.md` 00:23). Those mtimes predate this command. They come from graft's automatic refresh while the parallel scaffold agent writes `apps/`, `packages/` and `package.json` (created 00:24). `graft check` wrote nothing. The update notice was **not** acted on (read-only row; `npm i -g` would change HI-9 "global npm: none").

## Findings for the controller

| ID | Finding | Evidence | Impact | Suggested action |
|---|---|---|---|---|
| F1 | **D23 wording is not executable:** `sdkmanager --no-metrics ...` exits 1 with `Unknown option: '--no-metrics'`. The shim has no such case, and `--no-metrics` is a global flag of the `android` binary only | E3, shim source | Any script, AC or run-guide step that calls `sdkmanager --no-metrics` will fail. Calling `sdkmanager` without the flag works but adds one metrics spool event per call (04 §4) | Amend D23: "SDK queries use `android --no-metrics --sdk="$ANDROID_HOME" sdk <list\|install\|...>`; plain `sdkmanager` only where an AC names it." Update AC-04 to `android --no-metrics --sdk="$ANDROID_HOME" sdk list \| tr '/' ';'`, then grep the 7 IDs |
| F2 | AC-01's `java -version 2>&1 \| head -1` returns `Picked up JAVA_TOOL_OPTIONS: ...` inside agent sessions | E2: the session has `JAVA_TOOL_OPTIONS=-Djava.net.preferIPv4Stack=true`; in a clean `env -i` login shell it is `<unset>` and line 1 is the version | This is an AC-wording issue, not a host issue. Harmless to Gradle | Reword AC-01 to `java -version 2>&1 \| grep version` (already suggested in 03_jdk_install; confirmed) |
| F3 | The backup name in AC-11 and 01_specs §6.4 (`~/.zprofile.bak.dems-2026-09-30`) differs from the real file (`~/.zprofile.bak.dems-2026-09-30-235451`) | E5; stale name at `masterplan/01_specs.md:1209`, `:1282` and `research/03_analysis.md:428` | AC-11 as written would fail with "No such file" | Update AC-11 and the HI-3 rollback command to the timestamped name |
| F4 | AC-06/07 still name `dems_tablet_api36` | `masterplan/01_specs.md:1277-1278` | Stale names (already covered by D23) | Apply D23 in the row 5 plan / row 6 refinement: `dems_tablet` + `dems_phone` |
| F5 | Graft 0.21.1 is available (installed 0.18.0); deep layer not built | E10 | None for this task | No action in this task. Updating is a global npm change, outside HI-9 |
| F6 | `masterplan/02_plan.md` does not exist yet (the data-analyst is writing it in parallel), so this row's status could not be set in a plan tracking table | `ls masterplan/` → `01_specs.md` only | Tracking only | The controller records row 13 = done in `status_tasks.md`; row 5 lists row 13 as done when it writes 02_plan.md |

## Side-effect ledger (read-only confirmation)

| Change | Where | Cause |
|---|---|---|
| This file, `delegation_progress/verifier.md` | task docs folder | required deliverables |
| One transient file, 1,068 bytes | `/var/folders/rn/7bm_xjb14jxcbp36qw981phr0000gn/T/sdk_installed_semicolon.txt` (macOS per-user temp; `$TMPDIR` resolved there in the unsandboxed shell) | ID normalisation for item 10. It holds only the public package list. The OS temp cleaner removes it |
| Nothing else | none | No install or update. No profile, git, AVD or setting change. No emulator boot. No adb server start. Android CLI metrics spool 5 before and 5 after; `last_update_check` mtime unchanged; `graft/` unchanged by this row |

---
*Generated: 2026-10-01 00:30 WIB*
*Last Updated: 2026-10-01 00:30 WIB*
