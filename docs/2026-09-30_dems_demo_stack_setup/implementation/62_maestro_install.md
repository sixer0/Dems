---
task_id: 2026-09-30_dems_demo_stack_setup
blueprint_row: 90
agent: coder-execution
narrative_tier: 3
status: complete
date: 2026-10-01
spec: identification/02_structured.md row 90 and Parallel Execution Protocol P1-P12; masterplan/05_mobile_plan.md M-17 (§3 row, §6 steps, §13 rollback); masterplan/04_mobile_specs.md VM-17, §10.2, MA-26, MA-27; decisions D37, D38 (Q-M2 yes), D39, D43
---

# Step 90: Maestro CLI 2.11.0 install (host, `~/.maestro`)

**Result: PASS.** All four blueprint row 90 checks hold:

| Row 90 check | Result | Evidence (quoted below) |
|---|---|---|
| Computed sha256 equals the published checksum (both quoted) | PASS | computed `5384593cb4e7a106489e75a821d157dd43f4e438df6bc308b72e82c685e1283a`; published `5384593cb4e7a106489e75a821d157dd43f4e438df6bc308b72e82c685e1283a`; `shasum -a 256 -c checksums_sha256.txt` → `maestro.zip: OK` |
| `maestro --version` prints 2.11.0 | PASS | `/Users/gsp-budi/.maestro/bin/maestro --version` → `2.11.0`, exit 0 |
| `test ! -e ~/.zshrc` exits 0 (AC-10 still PASS) | PASS | exit 0 before (02:12:03) and after (02:19); `~/.zprofile` sha256 unchanged (`e8543f6d…6ac2cd`) |
| Rollback `rm -rf ~/.maestro` recorded | PASS, **widened** | §7. Maestro also writes `~/Library/Logs/maestro`, so the full rollback is `rm -rf ~/.maestro ~/Library/Logs/maestro` |

**D43 check:** a trivial flow on the launcher ran on **both** AVDs.
- `dems_phone` (`emulator-5554`): `[Passed] launcher_smoke (2s)`, exit 0.
- `dems_tablet` (`emulator-5556`): `[Passed] launcher_smoke (3s)`, exit 0.
- JUnit `status="SUCCESS"` on both.

No app flow was written; step 57 owns app flows.

- **Window:** 2026-10-01 02:12:03 to 02:20 WIB.
- **Shell:** JDK from the login shell (`zsh -l`): `openjdk version "17.0.20.1" 2026-08-18` at `/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home/bin/java`.
- **Not used:** the curl installer. No shell profile was edited.

---

## 1. Pre-check (02:12:03)

| Check | Command | Result |
|---|---|---|
| `~/.maestro`, `~/.maestro-tmp` | `ls -la ~/.maestro ~/.maestro-tmp` | Both `No such file or directory` |
| AC-10 | `test ! -e ~/.zshrc; echo $?` | `0` |
| Other profiles | `ls -la ~/.zshrc ~/.zprofile ~/.bashrc ~/.bash_profile` | Only `~/.zprofile` (787 B, Sep 30 23:56) |
| `~/.zprofile` baseline | `shasum -a 256 ~/.zprofile` | `e8543f6d9b06b1d82a5da8e8af185445b0f5e946fa98fe73dded75717e6ac2cd` |
| `maestro` on PATH | `which maestro` | `maestro not found` |
| Java (login shell) | `zsh -l -c 'which java; java -version'` | 17.0.20.1 (see header); `JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home` |
| `XDG_STATE_HOME` | `zsh -l -c 'echo $XDG_STATE_HOME'` | empty, so Maestro state goes to `~/.maestro` (see §3) |
| Disk | `df -h ~` | 690 GiB free |
| Home listing | `ls -1A ~ > home_before.txt` | 50 entries (scratchpad marker for the §6 diff) |

## 2. Download and checksum (02:12:15-02:13)

The release was confirmed through the GitHub API first:

```
$ curl -sS https://api.github.com/repos/mobile-dev-inc/maestro/releases/tags/cli-2.11.0 | <print tag + assets>
cli-2.11.0 2026-09-29T13:36:34Z https://github.com/mobile-dev-inc/Maestro/releases/tag/cli-2.11.0
checksums_sha256.txt 78 sha256:8960cb334181dc971065eac0589bb471cf246997c71a6f6acc5dccb0a2c31b14 .../cli-2.11.0/checksums_sha256.txt
maestro.zip 314886578 sha256:5384593cb4e7a106489e75a821d157dd43f4e438df6bc308b72e82c685e1283a .../cli-2.11.0/maestro.zip
```

Both files were downloaded into the session scratchpad (`…/scratchpad/step90/`), not into `$HOME`:

```
$ curl -fsSL -o checksums_sha256.txt https://github.com/mobile-dev-inc/Maestro/releases/download/cli-2.11.0/checksums_sha256.txt
$ cat checksums_sha256.txt
5384593cb4e7a106489e75a821d157dd43f4e438df6bc308b72e82c685e1283a  maestro.zip
$ shasum -a 256 checksums_sha256.txt
8960cb334181dc971065eac0589bb471cf246997c71a6f6acc5dccb0a2c31b14  checksums_sha256.txt   # = GitHub asset digest
$ curl -fSL -o maestro.zip https://github.com/mobile-dev-inc/Maestro/releases/download/cli-2.11.0/maestro.zip
http=200 size=314886578 time=29.062039s
```

The checksum was verified before anything was unpacked:

```
$ shasum -a 256 maestro.zip
5384593cb4e7a106489e75a821d157dd43f4e438df6bc308b72e82c685e1283a  maestro.zip      # computed
$ cat checksums_sha256.txt
5384593cb4e7a106489e75a821d157dd43f4e438df6bc308b72e82c685e1283a  maestro.zip      # published
$ shasum -a 256 -c checksums_sha256.txt
maestro.zip: OK                                                                     # exit 0
$ unzip -tq maestro.zip
No errors detected in compressed data of …/maestro.zip.
```

The value was cross-checked three ways, and all three agree:
- the published `checksums_sha256.txt`;
- the GitHub API asset digest;
- the value in the spec (04_mobile_specs VM-17: `5384593c…1283a`, 314,886,578 B).

## 3. Install and the analytics opt-out

**Unpack and move** (02:13-02:14:17):
- `unzip -q -d …/scratchpad/step90/unz maestro.zip` produced `unz/maestro/{bin,lib}`: 198 files, 345 MiB, 195 jars in `lib/`.
- The only extended attribute was `com.apple.provenance`; there was no `com.apple.quarantine`.
- Host write, with a per-command sandbox bypass (P10). The guard stops `mv` from nesting inside an existing directory:
  ```
  $ test ! -e /Users/gsp-budi/.maestro && mv …/scratchpad/step90/unz/maestro /Users/gsp-budi/.maestro
  mv_exit=0
  ```
- **Deviation from 05 §6:** no `~/.maestro-tmp` was created, because the unpack happened in the scratchpad (§8, DEC-90-1).
- **Integrity after the move:** the sha256 manifest of the installed tree is byte-identical to a fresh unpack of the verified zip (`cmp` exit 0, 198 files).
  - Manifest digest: `d3d7ec43e7a9ccd65767b411fe0e8baf5a5d9c1dd80bea6509b05f0c5577abd3`.
  - Recompute with `cd ~/.maestro && find bin lib -type f | LC_ALL=C sort | xargs shasum -a 256 | shasum -a 256`. This is a tamper baseline for step 63.
- **Launcher script** (`bin/maestro`, 8,999 B): a stock Gradle POSIX start script.
  - It runs `maestro.cli.AppKt`, uses `$JAVA_HOME/bin/java` and refuses Java below 17 (lines 250-257).
  - It contains no profile writes and no network calls.

**Analytics opt-out: what the 2.11.0 binary reads.** Evidence comes from `javap -c -p` on `lib/maestro-cli-2.11.0.jar`.

| Setting | Class | Semantics (from bytecode) |
|---|---|---|
| `MAESTRO_CLI_NO_ANALYTICS` | `maestro.cli.analytics.Analytics` | Any value disables analytics. The in-binary message reads: `To opt out, set MAESTRO_CLI_NO_ANALYTICS environment variable to any value before running Maestro.` The sink is PostHog `https://us.i.posthog.com` |
| First-run state | `Analytics.warnAndEnableAnalyticsIfNotDisable` (App.kt:142) | On the first run it calls `saveInitialState(enabled = !envVarSet, uuid)`, which writes `$XDG_STATE_HOME/maestro/analytics.json` or `~/.maestro/analytics.json`. Later runs skip this because `hasRunBefore` is true. `trackEvent` returns early when `state.enabled` is false **or** the env var is set |
| `MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED` | `maestro.cli.insights.TestAnalysisManager` | Suppresses the AI-analysis notification (04 §10.2) |
| `MAESTRO_DISABLE_UPDATE_CHECK` | `maestro.cli.update.Updates` | `Boolean.parseBoolean(getenv(...))`, so it must be exactly `true`. When set, the version and changelog fetch is skipped. **Not in the spec; added** (DEC-90-2) |

**First run.** It was made with all three variables set, which persists the opt-out.

A sandboxed attempt at 02:14 failed before the CLI wrote anything. This proves the first write happens in `App.kt:142`, before `--version` is handled:

```
Exception in thread "main" java.nio.file.FileSystemException: /Users/gsp-budi/.maestro/analytics.json: Operation not permitted
	at maestro.cli.analytics.AnalyticsStateManager.saveInitialState(AnalyticsStateManager.kt:107)
	at maestro.cli.analytics.Analytics.warnAndEnableAnalyticsIfNotDisable(Analytics.kt:78)
	at maestro.cli.AppKt.main(App.kt:142)
```

The same command was re-run with a per-command bypass at 02:14:35:

```
$ zsh -l -c 'export MAESTRO_CLI_NO_ANALYTICS=true MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED=true MAESTRO_DISABLE_UPDATE_CHECK=true;
             /Users/gsp-budi/.maestro/bin/maestro --version; echo "exit=$?"'
2.11.0
exit=0
$ cat ~/.maestro/analytics.json      # 466 B; all identity/org fields null
{ "uuid" : "4fa1a787-…", "enabled" : false, "cachedToken" : null, … }
```

The analytics prompt line ("Anonymous analytics enabled…") was **not** printed, because the env var suppressed it. The persisted `"enabled" : false` now keeps analytics off even if a later caller forgets the env var. The env vars stay mandatory in every invocation as defence in depth (MA-26, MA-27).

## 4. Trivial flow on the launcher (D43), both AVDs

**Flow file.** It is scratchpad only and never in the workspace. It targets the launcher (`com.google.android.apps.nexuslauncher`, resolved with `cmd package resolve-activity … HOME`) and does not launch any app:

```yaml
appId: com.google.android.apps.nexuslauncher
---
- pressKey: Home
- assertVisible:
    id: "com.google.android.apps.nexuslauncher:id/hotseat"
- assertVisible: "Chrome"
- takeScreenshot: step90_launcher
```

**Runs.** Each ran inside its AVD lock, one lock at a time, phone before tablet (P3). There was no Metro and no `adb reverse`; the 8084 lane was not needed (P4):

```
$ /usr/bin/lockf -k -t 1800 .locks/dems_phone.lock zsh -l -c '… maestro --no-ansi --device emulator-5554 test launcher_smoke.yaml \
      --format junit --output …/maestro-phone.xml --test-output-dir …/out --debug-output …/debug'
[Passed] launcher_smoke (2s)
1/1 Flow Passed in 2s
maestro_test_exit=0 elapsed=6s                       # 02:16:29-02:16:35
$ … --device emulator-5556 …                          # 02:17:16-02:17:23
[Passed] launcher_smoke (3s)
maestro_test_exit=0 elapsed=7s
```

JUnit results:
- `<testsuite … device="dems_phone" tests="1" failures="0" time="2.15">` … `status="SUCCESS"`
- `<testsuite … device="dems_tablet" tests="1" failures="0" time="2.796">` … `status="SUCCESS"`

**Log excerpts** (`maestro.log`):
- `Maestro Version: 2.11.0`, `Java Version: 17`.
- `Selected device emulator-5554 using port 65350`: Maestro picks an ephemeral host port for its in-process forward. `adb forward --list` was empty before and after.
- The assertions logged are `Assert that id: com.google.android.apps.nexuslauncher:id/hotseat is visible COMPLETED` and `Assert that "Chrome" is visible COMPLETED`.

**Screencaps** (P3 path):
- `implementation/assets/mobile/90_dems_phone_launcher_smoke.png`
- `implementation/assets/mobile/90_dems_tablet_launcher_smoke.png`

**Idle detection (D43).** On the launcher, Maestro reached idle and read the view hierarchy in 5-24 ms per request (device logcat `D/Maestro … View hierarchy received in 24 ms`).

This proves the CLI, driver and hierarchy path work on both AVDs. It does **not** prove anything about the DEMS app's animated screens: the app was in the background throughout. Step 57 must still use the reduced-motion switch (`?motion=off` or equivalent) for app flows, as D43 requires.

**On-device footprint** (the 04 §10.2 package names were a hypothesis and are now confirmed):

| Observation | Evidence |
|---|---|
| Before each run: no Maestro package, forward or reverse | `pm list packages -u \| grep -i -E "maestro\|dev\.mobile"` exit 1; `forward --list` and `reverse --list` empty (phone and tablet) |
| During a run: driver `dev.mobile.maestro` plus instrumentation `dev.mobile.maestro.test` (`androidx.test.runner.AndroidJUnitRunner`) and an IME `dev.mobile.maestro/.input.MaestroInputMethodService` | tablet logcat 02:17:22: `Crash of app dev.mobile.maestro running instrumentation ComponentInfo{dev.mobile.maestro.test/androidx.test.runner.AndroidJUnitRunner}`, then `Input method uninstalled, disabling: ComponentInfo{dev.mobile.maestro/dev.mobile.maestro.input.MaestroInputMethodService}` |
| On close, Maestro **uninstalls both** | `Force stopping dev.mobile.maestro … deletePackageX`, `broadcast=ACTION_PACKAGE_FULLY_REMOVED pkg=dev.mobile.maestro`. The "Crash of app" line is the instrumentation being torn down by that delete, not a flow failure (the flow had already passed) |
| After each run: no Maestro package; `dumpsys package dev.mobile.maestro` → `Unable to find package` | phone 02:17:06, tablet 02:17:23 and 02:18 |
| Default IME restored on both AVDs | `settings get secure default_input_method` → `com.google.android.inputmethod.latin/com.android.inputmethod.latin.LatinIME` (phone and tablet) |

## 5. Processes (P7)

| Process | Started by this step | Action |
|---|---|---|
| adb server (`127.0.0.1:5037`, PID **61779**) | Yes. It was not running at 02:16:03 (`* daemon not running; starting now at tcp:5037`) | Stopped at 02:18 with `adb kill-server`, after a `lockf -k -t 0` probe showed both AVD locks free and `lsof` showed 61779 still owned 5037. After: nothing listening on 5037 |
| Maestro JVMs (5 invocations) | Yes | Each exited by itself. `pgrep -fl maestro.cli.AppKt` exit 1 after each run |
| Emulators 51262 (`emulator-5554`) and 51273 (`emulator-5556`) | No (step 19, P3/D40) | Untouched; still listening on 5554 and 5556 at 02:18 |
| Metro, Vite, mock-core | Not started | None |

## 6. Host paths written (complete list)

| Path | Size | Written by | Needed by later runs |
|---|---|---|---|
| `/Users/gsp-budi/.maestro/bin/`, `/Users/gsp-budi/.maestro/lib/` | 345 MiB, 198 files (from the verified zip) | `mv` at 02:14:17 | yes |
| `/Users/gsp-budi/.maestro/analytics.json` | 466 B, `"enabled" : false` | the first `--version`, 02:14:35 | yes (it persists the opt-out) |
| `/Users/gsp-budi/.maestro/deps/{applesimutils,simulator-server}` | 648 KiB (iOS helpers unpacked from the jar) | **every** invocation (`maestro.cli.util.Unpacker.binaryDependency` re-unpacks and `chmod`s them) | regenerated automatically |
| `/Users/gsp-budi/.maestro/sessions` | 0 B | `maestro test`, 02:16 | regenerated automatically |
| `/Users/gsp-budi/Library/Logs/maestro/<yyyy-MM-dd_HHmmss>_<pid>.zip` | 20 KiB total, 5 zips (an empty `maestro.log`, plus a 78 B `system_info.log` for test runs) | **every** invocation (`maestro.debuglog.DebugLogStore`, appdirs user log dir; no env switch found). Directory born `Oct 1 02:14:36 2026` | no (**not in the spec**, DEC-90-3) |

**Not written:**
- `~/.maestro-tmp`, `~/.maestro/tests/`: test and debug output was redirected to the scratchpad with `--test-output-dir` and `--debug-output`.
- `~/.zshrc`, `~/.bashrc`, `~/.bash_profile`.
- `~/.zprofile`: sha256 unchanged.

**Evidence:**
- **Home listing:** `diff home_before.txt home_after.txt` shows only `> .maestro`.
- **Corrected `find ~ -maxdepth 3 … -newer <marker>` scan.** It listed only these Maestro-related paths:
  - `~/.maestro/**`
  - `~/Library/Logs/maestro`

  Other new entries belong to other processes:
  - `~/.npm/_logs`: other lanes;
  - `~/.graft/telemetry-queue.ndjson`;
  - `~/Library/Preferences/com.apple.*`: macOS;
  - `~/Library/Logs/DiagnosticReports/chrome-headless-shell-2026-10-01-021440.ips` and `chrome_crashpad_handler-…021428.ips`: a headless Chrome from another lane.

**Workspace paths written by this step:**
- `docs/…/implementation/62_maestro_install.md` (this file);
- `docs/…/implementation/assets/mobile/90_dems_{phone,tablet}_launcher_smoke.png`;
- `docs/…/delegation_progress/coder_execution_step_90.md`;
- `.locks/*.lock`: restored, see §8 INC-90-1.

## 7. Rollback (verbatim)

```
# Host (CLI, state, per-run debug logs)
rm -rf /Users/gsp-budi/.maestro /Users/gsp-budi/Library/Logs/maestro
# AVDs: only needed if a Maestro run is killed before it closes (Maestro uninstalls its driver on a normal exit)
adb -s emulator-5554 uninstall dev.mobile.maestro; adb -s emulator-5554 uninstall dev.mobile.maestro.test
adb -s emulator-5556 uninstall dev.mobile.maestro; adb -s emulator-5556 uninstall dev.mobile.maestro.test
```

This supersedes 05 §13 (`rm -rf ~/.maestro ~/.maestro-tmp`):
- `~/.maestro-tmp` was never created;
- `~/Library/Logs/maestro` was missing from that rollback.

## 8. Decisions, drift and incident (for the controller to record)

| ID | Type | Planned | Actual | Why |
|---|---|---|---|---|
| DEC-90-1 | process (MINOR) | 05 §6: `unzip -q -d ~/.maestro-tmp`, then move to `~/.maestro` | Unzip in the session scratchpad, then one guarded `mv` into `~/.maestro` | One host write instead of two; no `~/.maestro-tmp` on the host. Content was proven identical to the verified zip (manifest `cmp`) |
| DEC-90-2 | env (MINOR) | Opt-outs `MAESTRO_CLI_NO_ANALYTICS=true` and `MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED=true` | Plus `MAESTRO_DISABLE_UPDATE_CHECK=true` | The 2.11.0 binary (`maestro.cli.update.Updates`) makes a version and changelog fetch on each run unless this variable is `true`. Fewer outbound calls, in line with I6. **Recommend** step 67 add it to the `e2e` script and step 60 to the run guide (MA-26's grep for `MAESTRO_CLI_NO_ANALYTICS=true` is unaffected) |
| DEC-90-3 | env (MINOR) | Footprint `~/.maestro` only; rollback `rm -rf ~/.maestro` (04 §10.2, 05 §13, row 90) | Also `~/Library/Logs/maestro/*.zip`, one per invocation (about 138-328 B each) | `maestro.debuglog.DebugLogStore` writes to the appdirs user log dir. No env switch found. The rollback is widened (§7). Step 63 should list it in the Maestro footprint |
| DEC-90-4 | process (MINOR) | Trivial launcher flow on one device (brief) | Ran on both AVDs, under one lock at a time | 7 s each. It gives step 57 proof for both devices. The AVDs were left as found (§4) |
| DEC-90-5 | fact | 04 §10.2: driver package names are a hypothesis, "Rollback: `adb uninstall` each" | Confirmed `dev.mobile.maestro` and `dev.mobile.maestro.test` (plus IME `MaestroInputMethodService`). Maestro 2.11.0 installs them per session and **uninstalls them on close** | logcat §4. The AVD rollback is only needed after an aborted run |
| INC-90-1 | incident (process) | P3 lock probes | At 02:15:51 (tablet) and 02:18 (phone, tablet, gradle, npm, mock-core), `/usr/bin/lockf -t 0 <lock> true` was run **without `-k`**. lockf then **unlinked** the empty lock files `dems_phone.lock`, `dems_tablet.lock`, `mock-core.lock` and `npm.lock` (`gradle.lock` did not exist and was created and removed). **Restored at 02:18** with `touch`, only if absent. All four are back as empty files; only mtimes changed | Every probe got the lock at once (exit 0), so no holder or waiter was displaced. The 02:15:51 tablet file was recreated at 02:17:16 by this step's own `lockf -k`. **Lesson for P3:** probes must also use `-k` (`/usr/bin/lockf -k -t 0 …`); without it, lockf deletes the lock file |

## 9. Hand-offs to later steps

- **Step 57 (Maestro app flows):**
  - **Invocation:**
    ```
    MAESTRO_CLI_NO_ANALYTICS=true MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED=true MAESTRO_DISABLE_UPDATE_CHECK=true /Users/gsp-budi/.maestro/bin/maestro --device <serial> test <flows> --format junit --output $TMPDIR/maestro-<avd>.xml --test-output-dir <dir> --debug-output <dir>
    ```
    - Run it in a login shell (JDK 17 on PATH), inside the AVD lock.
  - **Sandbox:** every invocation writes `~/.maestro/deps` and `~/Library/Logs/maestro`, and uses adb. **Each `maestro` call therefore needs the per-command sandbox bypass (P10)**, even `--help`. Inside the sandbox it fails with `FileSystemException: /Users/gsp-budi/.maestro/deps/applesimutils: Operation not permitted` (`Unpacker.kt:154`).
  - **Output location:** without `--test-output-dir` and `--debug-output`, run artefacts go to `~/.maestro/tests/`.
  - **Commands not to use (I6):** `cloud`, `login`, `mcp` or `test --analyze` (AI Insights).
  - **Idle:** app flows must use the D43 reduced-motion switch.
- **Step 60 (README run guide):** call Maestro by absolute path, or for the current shell only use `export PATH="$HOME/.maestro/bin:$PATH"`. No profile edit (AC-10). Include the three env vars and the §7 rollback.
- **Step 63 (mobile security):**
  - Footprint = §6.
  - Analytics state `"enabled" : false`.
  - Tamper baseline: manifest digest `d3d7ec43…abd3` (§3).
  - The driver IME is removed on close and the default IME is LatinIME on both AVDs.
- **Step 67 (`e2e` script, MA-26):** add `MAESTRO_DISABLE_UPDATE_CHECK=true` next to the two required variables (DEC-90-2).

## 10. Verification summary

- **dry-run-verify-fix:** no build, lint, typecheck or test commands apply to a host CLI install. The delivery path is the row 90 acceptance checks above. All passed on the first attempt; 0 repair cycles.
- **Final state at 02:19:**
  - `test ! -e ~/.zshrc` → exit 0.
  - `~/.zprofile` sha256 unchanged.
  - `~/.maestro` is 346 MiB, 202 files: 198 from the zip, plus `analytics.json`, `sessions` and 2 `deps` files.
  - No `~/.maestro-tmp`.
  - Nothing listening on 5037.
  - Both emulators up.
  - All `.locks/*.lock` present.
