---
task_id: 2026-09-30_dems_demo_stack_setup
blueprint_row: 9
agent: coder-execution
date: 2026-09-30 / 2026-10-01 (ran across midnight WIB)
tier: 3
status: complete
pins: research/03_analysis.md SD-46..SD-49, HI-3, HI-4; masterplan/01_specs.md §6.4, §7, AC-03..AC-05; decisions D11, D13, D14, D21
---

# Row 9: Android SDK install (cmdline-tools 23.0 + 7 packages)

## Result

**PASS.** Command-line tools rev 23.0 were downloaded from Google, integrity-checked against Google's repository manifest, and unpacked to `~/Library/Android/sdk/cmdline-tools/latest`. Block B was appended to `~/.zprofile`. All seven pinned packages installed at the revisions in 01_specs §6.4, exit 0, in 341 s. In a fresh login shell `sdkmanager --list_installed` lists every ID, `adb version` prints `37.0.1`, `emulator -version` prints `37.1.11.0`, and `ANDROID_HOME` resolves.

Three findings change how the plan's commands behave. Each is detailed below.

1. **The manifest publishes SHA-1, not SHA-256.** The zip was verified against the manifest's SHA-1 plus its exact byte size, and the computed SHA-256 is recorded (no Google-published SHA-256 exists for this build).
2. **cmdline-tools 23.0 `sdkmanager` is a deprecation shim over the new "Android CLI"** (`android sdk ...`). Package IDs are rewritten from `;` to `/`, and `--licenses` is a no-op. Licence files are written implicitly by `android sdk install`.
3. **The Android CLI keeps its own usage-metrics spool** and has a hidden `--no-metrics` flag. The package install ran through the CLI with `--no-metrics`.

## Sandbox handling (D14)

The sandbox was disabled only for commands that write under `~/Library/Android` or `~/.android`: unzip/move, the `~/.zprofile` append, `sdkmanager`/`android` runs, and the login-shell verification that invokes `sdkmanager`. The manifest and zip downloads, checksums, `unzip -l`, `du` and file reads ran inside the sandbox.

## 1. Command-line tools zip

### Manifest (fetched fresh)

```
$ curl -sS -fL -o repository2-3.xml https://dl.google.com/android/repository/repository2-3.xml
http=200 size=420815
```

Entry for `cmdline-tools;23.0` and `cmdline-tools;latest` (both identical, `channel-0`):

```xml
<archive>
  <complete>
    <size>155384151</size>
    <checksum type="sha1">ad03dc49bfacfd52c110b14104ea548b8a07e830</checksum>
    <url>commandlinetools-mac_arm64-16111833_latest.zip</url>
  </complete>
  <host-os>macosx</host-os>
  <host-arch>aarch64</host-arch>
</archive>
```

Checksum types in the whole manifest: `grep -o 'checksum type="..."' | sort | uniq -c` gives `872 sha1`. **The manifest has no SHA-256 values.**

### Download and verification

```
$ curl -sS -fL -o commandlinetools-mac_arm64-16111833_latest.zip https://dl.google.com/android/repository/commandlinetools-mac_arm64-16111833_latest.zip
http=200 size=155384151 time=13.671677s
$ stat -f "%z bytes"            -> 155384151 bytes                                   (manifest: 155384151)  MATCH
$ shasum -a 1                   -> ad03dc49bfacfd52c110b14104ea548b8a07e830          (manifest sha1)        MATCH
$ shasum -a 256                 -> 58da8f215781cc0208743e88b65ae259780c55e7eb40e50373d377cf369232d6  (computed; no published value to compare)
$ unzip -p ... cmdline-tools/source.properties
Pkg.Revision=23.0
Pkg.Path=cmdline-tools;23.0
```

**Deviation from the delegation wording (reported, not silent):** the delegation asked for a SHA-256 check "against the value published in Google's repository manifest", but the manifest publishes only SHA-1. The only Google SHA-256 table found, `https://developer.android.com/studio` ("Command line tools only"), still lists the **older** build: `commandlinetools-mac_arm64-15859902_latest.zip` (cmdline-tools 22.0), SHA-256 `835b62a26162b229b441d1f6d4680383815a270809eb33522c0d480fa5002c4e`. It has no row for 16111833. The integrity check used here is therefore the one 01_specs §6.4 pins: the manifest SHA-1 `ad03dc49...e830` plus the exact byte size, both from `dl.google.com` over TLS. The computed SHA-256 is recorded for future re-verification of the same file.

### Install

```
$ test ! -e ~/Library/Android            # absent at baseline (HI-4)
$ mkdir -p ~/Library/Android/sdk/cmdline-tools
$ unzip -q <zip> -d ~/Library/Android/sdk/cmdline-tools/.stage-dems
$ mv ~/Library/Android/sdk/cmdline-tools/.stage-dems/cmdline-tools ~/Library/Android/sdk/cmdline-tools/latest
$ rmdir ~/Library/Android/sdk/cmdline-tools/.stage-dems
$ cat ~/Library/Android/sdk/cmdline-tools/latest/source.properties
Pkg.Revision=23.0
```

## 2. `~/.zprofile` block B

Backup: the single pre-task backup from row 8, `/Users/gsp-budi/.zprofile.bak.dems-2026-09-30-235451` (sha256 `84ff8ea5...75f0`, the original 11-line file). Marker text follows the 03_analysis Host Impact Register exactly.

```diff
--- /Users/gsp-budi/.zprofile.bak.dems-2026-09-30-235451	2026-09-11 23:06:17
+++ /Users/gsp-budi/.zprofile	2026-09-30 23:56:55
@@ -9,3 +9,13 @@
 # User-level global npm binaries (e.g. @nanonets/graft)
 PATH="${HOME}/.npm-global/bin:${PATH}"
 export PATH
+
+# >>> dems-demo: jdk (added 2026-09-30, blueprint row 8) >>>
+export JAVA_HOME="/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home"
+export PATH="$JAVA_HOME/bin:$PATH"
+# <<< dems-demo: jdk <<<
+
+# >>> dems-demo: android sdk (added 2026-09-30, blueprint row 9) >>>
+export ANDROID_HOME="$HOME/Library/Android/sdk"
+export PATH="$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator"
+# <<< dems-demo: android sdk <<<
```

`~/.zprofile` is now 21 lines. `~/.zshrc` is still absent.

## 3. Finding: `sdkmanager` in cmdline-tools 23.0 is a shim over the Android CLI

```
$ zsh -l -c 'sdkmanager --version'
WARNING: The SDK Manager CLI tool (sdkmanager) is deprecated. Android CLI will be used instead.
The 'android' binary can also be found in the cmdline-tools directory, and 'android sdk' is the replacement for 'sdkmanager'.
To learn more about the Android CLI and how to use it, see the documentation (https://d.android.com/tools/agents/android-cli)
1.0.16457483 (Android CLI)
```

From the shim's source (`~/Library/Android/sdk/cmdline-tools/latest/bin/sdkmanager`, POSIX sh):

- `add_package()`: `PKG="$(printf '%s\n' "$1" | tr -d '\r' | tr ';' '/')"`. Semicolon IDs are rewritten to slash paths.
- `run_android_cli()`: `"$SCRIPT_DIR/android" --sdk="$SDK_ROOT" sdk "$@"`. Every call becomes `android --sdk=<root> sdk <install|list|remove|update> ...`.
- `--licenses)`: `echo "Warning: The --licenses option is no longer needed." >&2; LICENSES_CONFIGURED="true"`. With no packages the script then `exit 0`s and never reads stdin.

First use of the `android` launcher (3.6 MB in `cmdline-tools/latest/bin`) created `~/.android/` (absent at baseline) with `analytics.settings`, `bin/android-cli` (89 MB, Mach-O arm64), `cli/bundles/<hash>/{jre,lib,main.jar}` (150 MB), `cli/tos_displayed` (`1`), `cli/last_update_check` and `cli/analytics/`. It also created `~/Library/Android/sdk/.sdk/` (the CLI's object store, 436 KB).

### Package ID check before install (all 7 present on the stable channel)

`sdkmanager --list` (which runs `android sdk list --all`) printed 636 lines. The pinned IDs in the CLI's slash form:

```
platform-tools                                   37.0.1   Android SDK Platform-Tools
emulator                                         37.1.11  Android Emulator
platforms/android-36                             2.0.0    Android SDK Platform 36
build-tools/36.0.0                               36.0.0   Android SDK Build-Tools 36
ndk/27.1.12297006                                27.1.12297006  NDK (Side by side) 27.1.12297006
cmake/3.22.1                                     3.22.1   CMake 3.22.1
system-images/android-36/google_apis/arm64-v8a   7.0.0    Google APIs ARM 64 v8a System Image
```

Every ID matches 03_analysis SD-48/SD-49 and the revisions in 01_specs §6.4 (platform-tools 37.0.1, emulator 37.1.11, platform r2, image r7). Nothing was substituted.

## 4. Finding: Android CLI usage metrics

- `~/.android/analytics.settings` (the classic Android tools setting) was created with `"hasOptedIn":false`. Nothing was opted in.
- Separately, the Android CLI spools one small event per invocation to `~/.android/cli/analytics/metrics/spool/*.bproto`. The printable content of each event is the command path with arguments replaced by `<redacted>`, for example `android ... --sdk <redacted> ... sdk ... list ... --all <redacted>`, plus the environment-variable names `CLAUDECODE` / `CLAUDE_CODE_ENTRYPOINT`. There is no project content. `MetricsReporter.class` in `main.jar` contains the upload endpoint `https://play.google.com/log?format=raw` and references `com/android/tools/analytics/AnalyticsSettings`. Whether uploads honour `hasOptedIn:false` was **not proven** (hypothesis: they do; not decompiled). `last_upload_time` = `1790787435`, written on the first run and unchanged since.
- `AndroidCLI.class` defines a hidden global option `no-metrics` described as "Disable metrics/crash reports collection". Test:

```
$ ls ~/.android/cli/analytics/metrics/spool | wc -l          -> 4
$ android --no-metrics --version                               -> 1.0.16457483, rc=0
$ android --no-metrics --sdk=$HOME/Library/Android/sdk sdk list -> rc=0
$ ls ~/.android/cli/analytics/metrics/spool | wc -l          -> 4   (no new event)
```

**Decision taken (per 01_specs §7, "never pass an opt-in"; the most privacy-preserving option):** the package install ran as the exact command the shim would build, plus `--no-metrics`. Final spool count is 5 events: 4 from the first `sdkmanager --version`/`--list` calls, plus 1 from the verification `sdkmanager --list_installed`, which ran through the shim because the AC specifies it. The `--no-metrics` install added none.

## 5. Licences

```
$ zsh -l -c 'yes | sdkmanager --licenses; echo "rc=${pipestatus[2]}"'
WARNING: The SDK Manager CLI tool (sdkmanager) is deprecated. Android CLI will be used instead.
...
Warning: The --licenses option is no longer needed.
rc=0
$ ls ~/Library/Android/sdk          -> .sdk cmdline-tools      (no licenses/ yet)
```

The instructed command ran; it is a no-op in 23.0. The install below then wrote `~/Library/Android/sdk/licenses/android-sdk-license` and `android-sdk-arm-dbt-license` **without any prompt**: the Android CLI treats `sdk install` as acceptance of the package licences (`uses-license ref="android-sdk-license"` in the manifest). The install ran with stdin from `/dev/null`, so nothing was auto-answered. Licence acceptance is part of approved blueprint row 9 (D1). The licence files are what AGP checks before auto-installing NDK or CMake versions in row 18 (03 SD-48, V15), so that path remains open.

## 6. Package install

```
$ android --no-metrics --sdk="$HOME/Library/Android/sdk" sdk install \
    platform-tools emulator platforms/android-36 build-tools/36.0.0 \
    ndk/27.1.12297006 cmake/3.22.1 system-images/android-36/google_apis/arm64-v8a </dev/null
start 23:59:15
https://dl.google.com/android/repository/platform-tools_r37.0.1-darwin.zip...
https://dl.google.com/android/repository/emulator-darwin_aarch64-15917651.zip...
https://dl.google.com/android/repository/platform-36_r02.zip...
https://dl.google.com/android/repository/build-tools_r36_macosx.zip...
https://dl.google.com/android/repository/android-ndk-r27b-darwin.zip...
https://dl.google.com/android/repository/cmake-3.22.1-darwin.zip...
https://dl.google.com/android/repository/sys-img/google_apis/arm64-v8a-36_r07.zip...
Unzipping platform-tools......
Unzipping emulator......
Unzipping platforms/android-36......
Unzipping build-tools/36.0.0......
Unzipping ndk/27.1.12297006......
Unzipping cmake/3.22.1......
Unzipping system-images/android-36/google_apis/arm64-v8a......
exit=0
end 00:04:56
```

**Duration: 341 s** (23:59:15 to 00:04:56 WIB). All URLs are `dl.google.com`, stable channel (no `--beta`/`--canary`).

### Sizes on disk (`du -sh`)

| Path under `~/Library/Android/sdk` | Size | Sourced download size (03 HI-4) |
|---|---|---|
| `cmdline-tools/latest` | 172M | 148 MiB |
| `platform-tools` | 37M | 15 MiB |
| `emulator` | 1.1G | 376 MiB |
| `platforms/android-36` | 134M | 63 MiB |
| `build-tools/36.0.0` | 188M | 75 MiB |
| `ndk/27.1.12297006` | 2.4G | 797 MiB |
| `cmake/3.22.1` | 94M | 36 MiB |
| `system-images/android-36/google_apis/arm64-v8a` | 4.3G | 1,786 MiB |
| `licenses`, `.sdk` | 8.0K, 436K | none |
| **Total `~/Library/Android/sdk`** | **8.4G** | 3,296 MiB |
| `~/.android` (Android CLI runtime + settings, before any AVD) | 246M (`bin` 96M, `cli` 150M) | not in the register |

The on-disk total of 8.4 GB is inside the HI-4 hypothesis of 7-10 GB. The ~246 MB Android CLI runtime under `~/.android` was **not** in the Host Impact Register (new in cmdline-tools 23.0).

## 7. Verification (fresh login shell)

```
$ zsh -l -c 'echo "ANDROID_HOME=$ANDROID_HOME"; test -d "$ANDROID_HOME" && echo "ANDROID_HOME dir exists"; which sdkmanager avdmanager adb emulator; grep Pkg.Revision "$ANDROID_HOME/cmdline-tools/latest/source.properties"; sdkmanager --list_installed; echo "rc=$?"; adb version; emulator -version | head -3'
ANDROID_HOME=/Users/gsp-budi/Library/Android/sdk
ANDROID_HOME dir exists
--- which
/Users/gsp-budi/Library/Android/sdk/cmdline-tools/latest/bin/sdkmanager
/Users/gsp-budi/Library/Android/sdk/cmdline-tools/latest/bin/avdmanager
/Users/gsp-budi/Library/Android/sdk/platform-tools/adb
/Users/gsp-budi/Library/Android/sdk/emulator/emulator
--- cmdline-tools rev
Pkg.Revision=23.0
--- sdkmanager --list_installed
WARNING: The SDK Manager CLI tool (sdkmanager) is deprecated. Android CLI will be used instead.
...
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
--- adb version
Android Debug Bridge version 1.0.41
Version 37.0.1-15733141
Installed as /Users/gsp-budi/Library/Android/sdk/platform-tools/adb
Running on Darwin 27.0.0 (arm64)
--- emulator -version
Android emulator version 37.1.11.0 (build_id 15917651) (CL:N/A)
```

(The agent session's `Picked up JAVA_TOOL_OPTIONS` line was filtered from this capture; see 03_jdk_install.md.)

| Check (AC) | Expected | Observed | Result |
|---|---|---|---|
| AC-03 `ANDROID_HOME` | `/Users/gsp-budi/Library/Android/sdk` | same; dir exists | PASS |
| AC-03 `which sdkmanager` | under `$ANDROID_HOME/cmdline-tools/latest/bin` | `/Users/gsp-budi/Library/Android/sdk/cmdline-tools/latest/bin/sdkmanager` | PASS |
| AC-03 revision | `Pkg.Revision=23.0` | `Pkg.Revision=23.0` | PASS |
| AC-04 all 7 IDs listed | 7 IDs | all 7 listed (in slash form) | PASS |
| AC-05 adb | `Version 37.0.1` | `Version 37.0.1-15733141` | PASS |
| AC-05 emulator | `37.1.11` | `Android emulator version 37.1.11.0 (build_id 15917651)` | PASS |

**Notes for the controller (AC wording):**

- AC-04: `--list_installed` prints the IDs in **slash** form (`platforms/android-36`, `system-images/android-36/google_apis/arm64-v8a`). A literal grep for `platforms;android-36` would fail. Suggested check: `sdkmanager --list_installed | tr '/' ';'`, then grep the semicolon IDs.
- `cmdline-tools/latest` shows `unknown -> 23.0.0`: the hand-unzipped copy has no `package.xml`, so the CLI cannot read its version and offers "23.0.0" as an update. The files are rev 23.0 (`source.properties`). This is harmless; **do not run `sdkmanager --update`** unattended, because it would reinstall cmdline-tools and update anything else newer.
- Row 18 and scripts: prefer `android --no-metrics sdk ...` over `sdkmanager` for any further SDK changes, to keep the metrics spool empty.

## Rollback

```sh
# 1. Remove block B only (keeps block A), or both DEMS blocks, or restore the pre-task file
sed -i '' '/^# >>> dems-demo: android sdk/,/^# <<< dems-demo: android sdk/d' ~/.zprofile
sed -i '' '/^# >>> dems-demo:/,/^# <<< dems-demo:/d' ~/.zprofile          # both blocks
cp -p ~/.zprofile.bak.dems-2026-09-30-235451 ~/.zprofile                   # full restore

# 2. Stop anything using the SDK (adb server started in row 10 is already stopped; see 05_avds.md)
~/Library/Android/sdk/platform-tools/adb kill-server 2>/dev/null

# 3. Remove the SDK (absent at baseline, parent included; HI-4)
rm -rf ~/Library/Android

# 4. Remove ~/.android (absent at baseline; contains the Android CLI runtime, settings, metrics spool, and the row 10 AVDs; HI-5)
rm -rf ~/.android
```

## Host paths changed by this row

| Path | Change | Baseline |
|---|---|---|
| `~/Library/Android/sdk/` (all subfolders above, `licenses/`, `.sdk/`) | created, 8.4G | absent |
| `~/.android/` (`analytics.settings`, `bin/android-cli`, `cli/`) | created, 246M | absent |
| `~/.zprofile` | block B appended | exists |

---
*Generated: 2026-10-01 00:08 WIB*
