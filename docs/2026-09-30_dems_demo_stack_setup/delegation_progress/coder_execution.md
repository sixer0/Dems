# Delegation progress: coder-execution (blueprint rows 8, 9, 10)

Parallel-run file (D21). The controller synthesises this into `status_tasks.md`, `delegation_progress_report.md`, `decisions/decisions.md` and (once it exists) `masterplan/02_plan.md`. This agent did not write those shared files, nor `implementation/99_implementation_report.md` (a shared file in a parallel run; the three row logs below are the implementation evidence).

| Row | Task | Status | Evidence | Log |
|---|---|---|---|---|
| 8 | JDK 17 (Homebrew `openjdk@17`) + `~/.zprofile` block A | **complete** | `openjdk version "17.0.20.1"`; `os.arch = aarch64`; `JAVA_HOME` exists; keg `java` first on PATH | `initialization/03_jdk_install.md` |
| 9 | Android SDK (cmdline-tools 23.0 + 7 packages) + `~/.zprofile` block B | **complete** | `sdkmanager --list_installed` lists all 7; adb `37.0.1`; emulator `37.1.11.0`; `ANDROID_HOME` resolves | `initialization/04_android_sdk_install.md` |
| 10 | AVDs `dems_tablet` (`pixel_tablet`) + `dems_phone` (`pixel_10`), cold boot each | **complete** | boot 25 s / 22 s; `2560x1600` / `1080x2424`; SDK 36; arm64-v8a; host GPU; clean `adb emu kill` | `initialization/05_avds.md` |

## Timeline (WIB)

- 2026-09-30 23:53: baseline. `~/.zprofile` 11 lines, sha256 `84ff8ea5b3dcf3f570821ec7d1c4f2d1682ba374bbcf897c2ef33bd12b2d75f0`; `~/.zshrc` absent; `~/Library/Android`, `~/.android`, `~/.gradle` absent; 29 Homebrew formulae; no Java runtime.
- 23:53-23:54: row 8 `brew install openjdk@17` (38 s, 23 formulae added, 502.6 MiB, no sudo). Backup `~/.zprofile.bak.dems-2026-09-30-235451`; block A appended. Verified in `zsh -l -c` and in a clean-environment login shell. **Row 8 PASS.**
- 23:55-23:57: row 9 cmdline-tools zip downloaded from `dl.google.com`. Integrity: manifest SHA-1 `ad03dc49...e830` and size 155,384,151 bytes both match (the manifest has no SHA-256; computed SHA-256 `58da8f21...32d6` recorded). Unpacked to `~/Library/Android/sdk/cmdline-tools/latest` (rev 23.0). Block B appended.
- 23:57: finding: cmdline-tools 23.0 `sdkmanager` is a deprecation shim over the new Android CLI. `--licenses` is a no-op; the CLI spools usage metrics; hidden `--no-metrics` flag verified to stop spooling.
- 23:59:15-00:04:56: row 9 package install (`android --no-metrics sdk install <7 IDs>`), 341 s, exit 0. SDK 8.4G on disk. **Row 9 PASS.**
- 2026-10-01 00:06: AVDs created; `config.ini` set per 01_specs §6.3.
- 00:07:15-00:07:44: `dems_tablet` cold boot 25 s, then shutdown. 00:08:23-00:08:48: `dems_phone` cold boot 22 s, then shutdown. adb server stopped. **Row 10 PASS.**

## Milestones for the controller

- SC1 host-toolchain ACs satisfied: AC-01, AC-02 (row 8); AC-03, AC-04, AC-05 (row 9); AC-06..AC-08 equivalents for the renamed AVDs (row 10). See the AC wording notes below.
- Host Impact Register actuals: HI-1 502.6 MiB in 23 formulae (list in 03_jdk_install.md); HI-3 `~/.zprofile` 11 → 21 lines, two marked blocks; HI-4 `~/Library/Android/sdk` 8.4G; HI-5 `~/.android` 8.5G (AVDs 8.2G including quickboot snapshots, plus Android CLI runtime 246M).

## Decisions and deviations to record (proposed D-entries)

1. **Backup name** `~/.zprofile.bak.dems-2026-09-30-235451`, not the register's `~/.zprofile.bak.dems-2026-09-30`, because the delegation asked for a timestamped copy. Rollback commands in all three logs use the actual name.
2. **Marker text** uses the 03_analysis Host Impact Register lines verbatim (`# >>> dems-demo: jdk ...`, `# >>> dems-demo: android sdk ...`), so the register's `sed` rollback by marker works unchanged.
3. **Checksum**: the delegation asked for SHA-256 "published in the manifest", but Google's `repository2-3.xml` publishes only SHA-1 (872 of 872 entries). developer.android.com lists a SHA-256 only for the older 15859902 build. Verified with manifest SHA-1 + byte size, as pinned in 01_specs §6.4. Not a silent substitution; reported here and in 04.
4. **Android CLI metrics**: the package install ran as `android --no-metrics --sdk=... sdk install ...`, identical to what the `sdkmanager` shim builds (source quoted in 04) plus `--no-metrics`. The AC verification still used `sdkmanager` as specified. Spool: 5 small events (command names, arguments redacted, no project content). Recommendation: row 18 and later scripts use `android --no-metrics sdk ...` for any SDK change. Whether uploads honour `analytics.settings` `hasOptedIn:false` is unproven (G-3 gap narrowed, not closed).
5. **Licences**: `yes | sdkmanager --licenses` ran as instructed but is a no-op in 23.0 (exit 0, nothing written). `android sdk install` wrote `licenses/android-sdk-license` and `android-sdk-arm-dbt-license` itself, with no prompt; stdin was `/dev/null`, so nothing was auto-answered. This falls within approved row 9 ("licence acceptance", D1). AGP's licence check for row 18 is therefore satisfied.
6. **AVD names** `dems_tablet` / `dems_phone` per this delegation (D17). **01_specs §6.3, AC-06, AC-07 and the root `emulator` script still say `dems_tablet_api36`**, so the spec revision (row 6) must rename them.
7. **Phone profile `pixel_10`** (6.3 in, 1080x2424, 420dpi), the base model of the newest Pixel generation available (`pixel_10_pro`, `_pro_xl`, `_pro_fold` and `pixel_10a` also exist). RAM 3072 MB, 4 cores.
8. **Orientation (D17)**: `hw.initialOrientation` is landscape for the tablet (native 2560x1600) and portrait for the phone (native). This is the start pose, not a lock: both booted with `accelerometer_rotation=1`. 01_specs §6.3 lists "landscape" with reason A3; the reason should become "native orientation; not a lock (D17)".
9. **`disk.dataPartition.size=8G`** on both AVDs (spec §6.3 for the tablet; applied to the phone for parity; the avdmanager default was 10G).
10. **Quickboot snapshots** were saved on `adb emu kill` (tablet 3.5G, phone 2.8G). Normal launches will now quick-boot; any later cold-boot proof must pass `-no-snapshot-load`.

## AC wording notes (for the spec revision)

- AC-01: in agent sessions `java -version 2>&1 | head -1` returns `Picked up JAVA_TOOL_OPTIONS: -Djava.net.preferIPv4Stack=true`. That variable is injected by the Claude Code session environment, not by any user profile. Use `grep version` instead of `head -1`.
- AC-04: `--list_installed` prints slash IDs (`platforms/android-36`). Compare after `tr '/' ';'`, or list the slash forms.
- `cmdline-tools/latest` lists as `unknown -> 23.0.0` (the hand-unzipped copy has no `package.xml`). Harmless. Do not run `sdkmanager --update` unattended.
- §6.1 hypothesis resolved: emulator console 5554, adb 5555 and gRPC 8554 (JWT-protected) listen on loopback only; the adb server listens on 127.0.0.1:5037.

## Processes started and stopped

| PID | Process | Stopped | Confirmed |
|---|---|---|---|
| 28955 | adb server 127.0.0.1:5037 | `adb kill-server` | no 5037 listener; not in `ps` |
| 28966 | qemu-system-aarch64 (dems_tablet) | `adb -e emu kill` | exited in 4 s |
| 29282 | qemu-system-aarch64 (dems_phone) | `adb -e emu kill` | exited in 3 s |

Background shell tasks used for monitoring (install waiter, log monitor) completed or were stopped. Nothing from this delegation is still running.

## Files created or updated

Docs (workspace):
- `docs/2026-09-30_dems_demo_stack_setup/initialization/03_jdk_install.md` (created)
- `docs/2026-09-30_dems_demo_stack_setup/initialization/04_android_sdk_install.md` (created)
- `docs/2026-09-30_dems_demo_stack_setup/initialization/05_avds.md` (created)
- `docs/2026-09-30_dems_demo_stack_setup/delegation_progress/coder_execution.md` (this file)

Host (outside the workspace; sandbox disabled per command, D14):
- `~/.zprofile` (two marked blocks appended; 11 → 21 lines)
- `~/.zprofile.bak.dems-2026-09-30-235451` (created; pre-task original)
- `/opt/homebrew/Cellar/` + `/opt/homebrew/opt/`: 23 formulae incl. `openjdk@17` 17.0.20.1; `~/Library/Caches/Homebrew/` (bottles, API cache)
- `~/Library/Android/sdk/` (created; cmdline-tools 23.0 + 7 packages, `licenses/`, `.sdk/`)
- `~/.android/` (created; `analytics.settings`, `bin/android-cli`, `cli/`, `adbkey*`, emulator settings, `avd/dems_tablet.*`, `avd/dems_phone.*`)

Not touched: `~/.zshrc` (still absent), `/Library/Java`, system Node, `~/.gradle` (still absent), any workspace file outside `docs/`. No sudo was used.

---
*Last updated: 2026-10-01 00:13 WIB*
