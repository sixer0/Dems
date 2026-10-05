---
task_id: 2026-10-04_dems_backend_rbac_pairing
task_slug: dems_backend_rbac_pairing
date: 2026-10-04
agent: coder-execution (tier R)
blueprint_row: 35 (plan W13, npm slot N3, native rebuild, install)
source_plan: /docs/2026-10-04_dems_backend_rbac_pairing/masterplan/02_plan.md (section 8.2, row W13)
status: needs-review
evidence_tier: 3
---

# 13. npm slot N3, native debug rebuild and install (W13)

**Status: needs-review.** Everything the row builds and installs is done and verified. One
verification clause of the plan row is open: "the app opens in Simulated mode (screencap)".
The app could not be started on any emulator, because all three emulators have been at the PIN
keyguard since their cold boot at 06:27 (user 0 is `RUNNING_LOCKED`). Entering the PIN is a
credential entry at an operating-system lock prompt; this row did not do it and asks the user to
unlock the emulators (section 9). Nothing was uninstalled, wiped or cleared.

| Field | Value |
|---|---|
| Run window | 2026-10-04 06:53 to 07:19 WIB (UTC+7) |
| Host | macOS, 10 cores; Node v26.8.2, npm 11.19.1; OpenJDK 17.0.20.1; Android build-tools 36.0.0 |
| Commands that ran with the per-command sandbox bypass (P10) | the registry lookup, the npm slot, `npm audit`, `deps:check`, `doctor`, the Gradle slot, every `adb` call and every device session, `pgrep` / `lsof` / `ps` |
| Raw logs and helper scripts | `implementation/assets/13_*` (listed in section 3) |

## 1. Result in one table

| # | Item | Result |
|---|---|---|
| 1 | P23 pre-image of `package-lock.json` | Written before the first edit; proven on a scratch copy (section 4) |
| 2 | Backup of the debug APK and the debug keystore | Both in `.cache/apk-backup/`, byte-identical to their sources, git-ignored (section 5) |
| 3 | `expo-secure-store` `~57.0.4` added, lockfile pins 57.0.4 | Done; lockfile gains exactly one package entry; `app.json` byte-identical (section 6) |
| 4 | `npm audit` (SU-2) | 80 entries, byte-identical to step 25's Appendix A; no new entry (section 7) |
| 5 | `reverse` script maps `tcp:4420` | Done and run on a device (section 8.1) |
| 6 | `DEMS_CORE_HOST_PORT` in `device-session.sh` | Done; unset = identical commands (dry run); 4421 shown on a device (section 8.2 to 8.4) |
| 7 | Prebuild, keystore guard | `android/` was cleared (KI-21); the keystore came back with the same certificate; no restore needed (section 10) |
| 8 | Debug APK built (`assembleDebug` only) | `BUILD SUCCESSFUL in 4m 19s`; certificate `fac61745...033b9c` (section 10) |
| 9 | `adb install -r` on `emulator-5554`, `5556`, `5558` | `Success` three times; `firstInstallTime` unchanged; signature `51ed3f60` unchanged (section 11) |
| 10 | App opens in Simulated mode, screencap per emulator | **NOT DONE: emulators locked** (section 9) |
| 11 | `deps:check`, `doctor`, typecheck, lint, tests | All exit 0; 833 tests in 72 suites before and after (section 12) |

## 2. Timeline (WIB)

| Time | Step |
|---|---|
| 06:54:06 | P23 pre-image `.cache/rollback/W13.pre.patch` |
| 06:54:12 | Backup of `app-debug.apk` and `debug.keystore`; `keytool` digest of both keystore copies |
| 06:54:47 | Read-only device state: three emulators `device`, `sys.boot_completed` = 1, DEMS app 0.1.0 / versionCode 1, no reverse rule, all locks free |
| 06:54:55 to 06:54:59 | Baseline `deps:check` and `doctor` (before any change) |
| 06:55:09 to 06:56:08 | Baseline mobile jest run: 833 passed in 72 suites |
| 06:57:35 | Registry lookup of `expo-secure-store@~57.0.4` |
| **06:58:03 to 06:58:14** | **npm slot N3** under `.locks/npm.lock`. **Install window: 06:58:04 to 06:58:14** (`node_modules` rewritten once, one package added) |
| 06:58:38 | `npm audit` |
| 06:59 to 07:00 | `device-session.sh` edited (outside any lock); syntax checks, usage path, dry runs with a stub `adb` |
| **07:03:19 to 07:07:44** | **Gradle slot** under `.locks/gradle.lock`: prebuild 07:03:19 to 07:03:20; keystore guard; **build 07:03:20 to 07:07:40**; certificate check; daemon stopped |
| 07:08:38 to 07:13:58 | Device session `dems_phone` (Metro lane 8085, `DEMS_CORE_HOST_PORT=4421`): install 07:08:41 to 07:08:42; the launch failed (locked) |
| 07:14:18 | Lock state read on all three emulators |
| 07:15:38 to 07:15:40 | Device session `dems_tablet` (no Metro): install 07:15:39 to 07:15:40 |
| 07:15:51 to 07:15:53 | Device session `dems_phone2` (no Metro): install 07:15:52; `npm run reverse` check |
| 07:16:03 to 07:16:05 | `deps:check` and `doctor` after |
| 07:16:12 to 07:16:50 | Mobile jest run after: 833 passed in 72 suites |
| 07:17:00 to 07:17:14 | Final typecheck and lint of `@dems/mobile` |

**Windows another row may need for P11.** `node_modules` changed between 06:58:04 and 06:58:14.
The Gradle build loaded the host heavily between 07:03:20 and 07:07:40: the 1-minute load average
was 34 to 40 from about 07:05:30 to 07:07:40 (`uptime` at 07:05:37 `34.44`, 07:06:04 `38.74`,
07:06:40 `40.16`; at the end of the build `35.62 24.38 13.49`), and was back at 3.47 by 07:16:05.
A test of another row that timed out in that window may be repeated.

## 3. Files written

Owned write paths of W13:

| Path | Change |
|---|---|
| `apps/mobile/package.json` | `expo-secure-store` `~57.0.4` added; `reverse` script extended (section 6, 8.1) |
| `package-lock.json` | 10 lines added, 0 removed against the state W03 left (section 6) |
| `apps/mobile/scripts/device-session.sh` | optional `DEMS_CORE_HOST_PORT` (section 8.2) |
| `apps/mobile/android/**` (generated, git-ignored) | regenerated by prebuild, built |
| `.cache/apk-backup/app-debug.apk`, `.cache/apk-backup/debug.keystore` (git-ignored) | the backup |
| `.cache/rollback/W13.pre.patch` (git-ignored; P23) | the pre-image |

Task folder:

| Path | Content |
|---|---|
| `implementation/13_npm_slot_n3_mobile_native.md` | this document |
| `implementation/assets/13_npm_slot.sh`, `13_edit_manifest.mjs`, `13_npm_slot.txt` | the npm slot script, its manifest edit, its output |
| `implementation/assets/13_npm_audit.txt` | `npm audit` output, verbatim |
| `implementation/assets/13_gradle_slot.sh`, `13_gradle_slot.txt` | the Gradle slot script and its output |
| `implementation/assets/13_install_launch.sh`, `13_reverse_check.sh`, `13_cdp_probe.mjs` | the session commands that ran |
| `implementation/assets/13_session_dems_phone.txt`, `13_session_dems_tablet.txt`, `13_session_dems_phone2.txt` | the three session logs |
| `implementation/assets/13_device_session_dry_run.txt` | stub-`adb` traces of the old and the new helper |
| `implementation/assets/13_dems_phone_locked_screen_off.png` | the screencap taken after the failed launch: a black frame (screen off, keyguard) |
| `implementation/assets/13_launch_check.sh` | the follow-up launch check for section 9 (not run: needs unlocked emulators) |
| `delegation_progress/coder_execution_step_35.md` | progress file |

Not written (parallel run): `status_tasks.md`, `delegation_progress_report.md`,
`decisions/decisions.md`, `masterplan/02_plan.md`, `implementation/99_implementation_report.md`.

`git status --porcelain` at 07:17 shows, of this row: ` M apps/mobile/package.json`,
` M apps/mobile/scripts/device-session.sh`, ` M package-lock.json` (already modified by W03) and
the untracked documents above. Every other line belongs to another row (for the mobile workspace:
` M apps/mobile/src/runtime/debug.ts` and `?? apps/mobile/src/runtime/dev-probes.ts`, W12).
The root `package.json` is byte-identical to its state before this row
(SHA-256 `c556e9c0...ed3c922` before and after).

## 4. P23 pre-image

```
$ git diff acaff20 -- package-lock.json > .cache/rollback/W13.pre.patch          (06:54:06)
-rw-r--r--  278134  .cache/rollback/W13.pre.patch
7e074c442fea4018de70517484de5682b3413c1a884eff09f4d7410d66743515  .cache/rollback/W13.pre.patch
```

Proof on a scratch copy (the working tree was not touched): `git show acaff20:package-lock.json`
plus the patch gives the lockfile exactly as W03 left it.

```
patch exit=0
P23 pre-image proven on a scratch copy: acaff20 + W13.pre.patch == the lockfile as W03 left it
(sha256 cbf841a19f884363d5a3c05e3eb70eecaf2c093abcd9b3fea02c05719f72f019)
```

`apps/mobile/package.json` and `apps/mobile/scripts/device-session.sh` have one writer (W13);
their pre-image is `acaff20` itself (`git diff --stat acaff20` printed nothing for both at 06:54).

## 5. Backup before anything could clear `android/` (KI-21, F28, D26)

```
$ ls -la <sources>                                                               (06:54:12)
-rw-r--r--  324503614 Oct  1 10:41 apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk
-rw-r--r--       2257 Oct  1 11:34 apps/mobile/android/app/debug.keystore
$ cp -p ... .cache/apk-backup/ ; shasum -a 256 ; cmp
cb6b1f513d525372b6e6c6ea35c134da29e9e8a0c79f2566a8fa4e7d217b0be5  .cache/apk-backup/app-debug.apk
221e0a3106aa4c3ccc154e0a418b55020b3f9ea6e84f92e8749cd9e2f39f5e58  .cache/apk-backup/debug.keystore
apk identical
keystore identical
$ git check-ignore -v .cache/apk-backup/app-debug.apk .cache/apk-backup/debug.keystore
.gitignore:47:.cache/	.cache/apk-backup/app-debug.apk
.gitignore:47:.cache/	.cache/apk-backup/debug.keystore
```

Certificate of the backed-up keystore (`keytool -list -v -keystore <path> -storepass android
-alias androiddebugkey`; `android` is the public password of the Android debug template; only
certificate fields were printed):

```
== .cache/apk-backup/debug.keystore
Alias name: androiddebugkey
Entry type: PrivateKeyEntry
Owner: CN=Android Debug, OU=Android, O=Unknown, L=Unknown, ST=Unknown, C=US
Issuer: CN=Android Debug, OU=Android, O=Unknown, L=Unknown, ST=Unknown, C=US
Valid from: Wed Jan 01 05:35:04 WIB 2014 until: Wed May 01 05:35:04 WIB 2052
	 SHA1: 5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25
	 SHA256: FA:C6:17:45:DC:09:03:78:6F:B9:ED:E6:2A:96:2B:39:9F:73:48:F0:BB:6F:89:9B:83:32:66:75:91:03:3B:9C
```

The live file printed the same seven lines. Nothing under `apps/mobile/signing/` was opened by
this row.

## 6. npm slot N3

### 6.1 What was resolved

| Fact | Value | Source |
|---|---|---|
| Version Expo SDK 57 bundles | `"expo-secure-store": "~57.0.4"` | `node_modules/expo/bundledNativeModules.json:80` (the list `expo install` reads) |
| What `~57.0.4` resolves to today | `57.0.4` (the registry's 57.x releases: 57.0.0, 57.0.1, 57.0.2, 57.0.3, 57.0.4; dist-tags `latest` and `sdk-57` = 57.0.4) | `npm view 'expo-secure-store@~57.0.4' ...`, 06:57:35 |
| Licence, dependencies, peers | MIT; `dependencies = {}`; `peerDependencies = { expo: '*' }` | same |
| Install scripts | none (`scripts`: `lint`, `test`, `build`, `clean`, `expo-module` only) | same |
| Integrity | `sha512-7zBA1RThURTXdP4w65kBzZNbcSsfArqVd+p+ETAnPRWXO8J296Qd0YaCVyRpJ0HSwlCnGdvOnqO+NgSreHsOhA==` | registry and lockfile agree |

### 6.2 How it was added (deviation DV-1)

The dependency was added by one exact text edit of `apps/mobile/package.json` followed by
`npm install --ignore-scripts`, both inside the lock, **not** by `npx expo install`.
Reason: `expo install` adds the package's config plugin to `app.json` on its own
(`node_modules/@expo/cli/build/src/install/installAsync.js:194` calls `applyPluginsAsync`
unconditionally; `@expo/cli` 57.0.27; `expo-secure-store` ships `app.plugin.js`). `app.json` has
no writer in this task (P6, WT-7, TD-10), and for the seconds between the write and a revert the
plugin-count test of every other row would have failed. The version is the one `expo install`
would have chosen (the bundled list above), and `expo install --check` confirms it afterwards
(section 12).

```
$ /usr/bin/lockf -k -t 3600 .locks/npm.lock /bin/sh 13_npm_slot.sh
== npm slot N3 acquired 06:58:03
manifest edited: expo-secure-store ~57.0.4 added; reverse script extended
== dry run 06:58:03
add expo-secure-store 57.0.4

added 1 package in 1s
dry-run exit=0
== INSTALL_START 06:58:04

added 1 package, and audited 1731 packages in 9s

396 packages are looking for funding
  run `npm fund` for details

84 vulnerabilities (5 low, 25 moderate, 54 high)
...
== INSTALL_END 06:58:14 exit=0
== npm slot N3 released 06:58:14
lockf exit=0
npm lock free
```

### 6.3 Manifest diff

```diff
--- a/apps/mobile/package.json
+++ b/apps/mobile/package.json
@@ -15,7 +15,7 @@
-    "reverse": "adb reverse tcp:4400 tcp:4400 && adb reverse tcp:8081 tcp:8081"
+    "reverse": "adb reverse tcp:4400 tcp:4400 && adb reverse tcp:8081 tcp:8081 && adb reverse tcp:4420 tcp:4420"
@@ -42,6 +42,7 @@
     "expo-router": "~57.0.24",
+    "expo-secure-store": "~57.0.4",
     "expo-splash-screen": "~57.0.9",
```

No other dependency changed. The `e2e` script line is untouched (KI-02).

### 6.4 Lockfile diff against the pre-image: only the slot-N3 package

`diff <lockfile before this row> package-lock.json` (complete output, 10 added lines, 0 removed):

```
238a239
>         "expo-secure-store": "~57.0.4",
15032a15034,15042
>       }
>     },
>     "node_modules/expo-secure-store": {
>       "version": "57.0.4",
>       "resolved": "https://registry.npmjs.org/expo-secure-store/-/expo-secure-store-57.0.4.tgz",
>       "integrity": "sha512-7zBA1RThURTXdP4w65kBzZNbcSsfArqVd+p+ETAnPRWXO8J296Qd0YaCVyRpJ0HSwlCnGdvOnqO+NgSreHsOhA==",
>       "license": "MIT",
>       "peerDependencies": {
>         "expo": "*"
```

By entry (JSON comparison of the two `packages` maps):

```
entries before 1906 after 1907
added 1 [ 'node_modules/expo-secure-store@57.0.4' ]
removed 0 []
changed 1 [ 'apps/mobile' ]
  apps/mobile .dependencies.expo-secure-store: undefined -> ~57.0.4
```

Transitive packages added: **none** (the package has no dependencies).

```
$ npm ls expo-secure-store --all
dems-demo@0.1.0 /Users/gsp-budi/Documents/DEMS
`-- @dems/mobile@0.1.0 -> ./apps/mobile
  `-- expo-secure-store@57.0.4
```

### 6.5 `app.json` untouched

```
$ git diff --stat acaff20 -- apps/mobile/app.json
$                                                   (prints nothing; run after the install and again at 07:17)
c9fd07f20afa4a3bc43339b79a1d7b162ff2b31bf3a927e592ab8f0cb9ccb274  apps/mobile/app.json   (before and after)
app.json byte-identical to the pre-image
7 plugins: expo-router, expo-splash-screen, expo-video, expo-font, expo-status-bar, expo-local-authentication, ./plugins/with-dems-release-signing
```

## 7. `npm audit` (SU-2)

Run at 06:58:38 from the workspace root; exit code 1; full output in
`implementation/assets/13_npm_audit.txt`.

```
80 vulnerabilities (5 low, 25 moderate, 50 high)

To address all issues (including breaking changes), run:
  npm audit fix --force
```

Against step 25 (`implementation/03_npm_slot_n1_server_shared.md`, Appendix A): the 390 lines of
the text report are **byte-identical** (`diff` printed nothing; both files have SHA-256
`94b3169a...39d120a8`). **Entries that are new against step 25: none.** The string
`expo-secure-store` does not occur in the JSON form of the report. `npm audit fix` was not run.

As in step 25, two other totals exist for the same tree and are recorded, not explained: the
install summary and the `metadata` block of `npm audit --json` both say 84
(`{"info":0,"low":5,"moderate":25,"high":54,"critical":0,"total":84}`); the text report says 80.

## 8. Scripts (AC-C-84)

### 8.1 The `reverse` script

Diff in section 6.3. Run on `dems_phone2` inside a device session (plain `adb`, so the session's
`ANDROID_SERIAL` picks the device):

```
-- rules at command start (the helper's own tcp:4400 only)
host-16 tcp:4400 tcp:4400

-- npm run reverse -w @dems/mobile (plain adb; ANDROID_SERIAL=emulator-5558 picks the device)

> @dems/mobile@0.1.0 reverse
> adb reverse tcp:4400 tcp:4400 && adb reverse tcp:8081 tcp:8081 && adb reverse tcp:4420 tcp:4420

8081
4420
-- rules after npm run reverse
host-16 tcp:4400 tcp:4400
host-16 tcp:8081 tcp:8081
host-16 tcp:4420 tcp:4420

-- remove the two rules this command added (tcp:8081, tcp:4420); tcp:4400 is the helper's and goes at session end
host-16 tcp:4400 tcp:4400
...
-- reverse rules AFTER the session: [;]
```

### 8.2 `device-session.sh`: the diff (nothing else in the script changed)

`diff -u <pre-image> apps/mobile/scripts/device-session.sh`; every changed line is shown, some
unchanged context lines are left out or shortened (`log() { ... }`).

```diff
@@ -64,6 +64,10 @@
 # Environment: METRO_PORT (default 8081; lanes per P4), NO_METRO=1, KEEP_APP=1,
+#   DEMS_CORE_HOST_PORT (optional; 4420-4423, the host port of the Core server or of a lane backend.
+#   Set: the session also maps device tcp:4420 -> host tcp:$DEMS_CORE_HOST_PORT and removes that
+#   rule at the end; the device side is always tcp:4420. Unset or empty: no tcp:4420 rule is set
+#   or removed and the session runs exactly as before. Any other value: exit 64, before any lock),
 #   LOCK_WAIT (seconds to wait for a lock, default 1800),
@@ -77,7 +81,7 @@
 usage() {
-  echo "usage: [METRO_PORT=8081..8086] [NO_METRO=1] [DEVICE_SESSION_MAX_SECONDS=1800] $0 any-phone|any|phone|phone2|tablet|both '<commands>'" >&2
+  echo "usage: [METRO_PORT=8081..8086] [NO_METRO=1] [DEMS_CORE_HOST_PORT=4420..4423] [DEVICE_SESSION_MAX_SECONDS=1800] $0 any-phone|any|phone|phone2|tablet|both '<commands>'" >&2
   exit 64
 }
@@ -125,6 +129,17 @@
 esac
 
+# Optional Core server host port (04_client_integration_spec §9.6; plan W13). Checked before any lock
+# is taken. Unset or empty leaves CORE_HOST_PORT empty, and then nothing below runs for it.
+CORE_HOST_PORT=${DEMS_CORE_HOST_PORT:-}
+case "$CORE_HOST_PORT" in
+  '' | 442[0-3]) ;;
+  *)
+    echo "DEMS_CORE_HOST_PORT must be 4420-4423 (P4) (got '$CORE_HOST_PORT')" >&2
+    exit 64
+    ;;
+esac
+
 log() { ... }
@@ -236,6 +251,7 @@
 if [ "${NO_METRO:-0}" != 1 ]; then PLANNED_REV="8081 4400"; else PLANNED_REV="4400"; fi
+[ -n "$CORE_HOST_PORT" ] && PLANNED_REV="$PLANNED_REV 4420"
@@ -457,6 +473,13 @@
   log "no Metro (NO_METRO=1); tcp:4400 -> tcp:4400 on $SERIALS"
+fi
+# Core server (only with DEMS_CORE_HOST_PORT): the device side is always tcp:4420, the host side is
+# the given port. 4420 joins REVERSED first, so the cleanup removes this session's rule and no other.
+if [ -n "$CORE_HOST_PORT" ]; then
+  REVERSED="$REVERSED 4420"
+  for s in $SERIALS; do adb -s "$s" reverse tcp:4420 "tcp:$CORE_HOST_PORT" >/dev/null || exit 69; done
+  log "Core server: device tcp:4420 -> host tcp:$CORE_HOST_PORT on $SERIALS"
 fi
```

`git diff --stat acaff20 -- apps/mobile/scripts/device-session.sh`: 25 changed lines, that is 24
insertions and 1 deletion (the old usage line). The shared constant keeps the name `CORE_SERVER_PORT`; this is a shell variable of
this one script (plan section 3.4). `4420` is in both lists (`PLANNED_REV` for the watchdog's
forced clean-up, `REVERSED` for the normal one), as [CS:§9.6] asks. The check runs before any
lock is taken, like the cap check above it, so a wrong value never holds a device.

### 8.3 Syntax and the script's own usage path

```
sh -n OK
bash -n OK
zsh -n OK
--- usage path (no args)
usage: [METRO_PORT=8081..8086] [NO_METRO=1] [DEMS_CORE_HOST_PORT=4420..4423] [DEVICE_SESSION_MAX_SECONDS=1800] apps/mobile/scripts/device-session.sh any-phone|any|phone|phone2|tablet|both '<commands>'
exit=64
--- bad value, checked before any lock
DEMS_CORE_HOST_PORT must be 4420-4423 (P4) (got '4424')
exit=64
DEMS_CORE_HOST_PORT must be 4420-4423 (P4) (got '80')
exit=64
DEMS_CORE_HOST_PORT must be 4420-4423 (P4) (got '4420x')
exit=64
```

The file mode is unchanged (`-rwxr-xr-x`).

### 8.4 Dry run: with the variable unset the helper runs the same commands as before

Method: the pre-image and the new script were each placed in a scratch root, with a stub `adb`
that records its arguments and talks to no device (stubs also for `pgrep`, `curl`, the emulator
binary and `expo`, so nothing real was started and no real lock was taken). Traces are in
`implementation/assets/13_device_session_dry_run.txt`.

```
old_nometro_unset: exit=0 adb calls=7
new_nometro_unset: exit=0 adb calls=7
new_nometro_empty: exit=0 adb calls=7
new_nometro_4421: exit=0 adb calls=9
old_metro_unset: exit=0 adb calls=24
new_metro_unset: exit=0 adb calls=24
new_metro_4422: exit=0 adb calls=28
=== unset: old vs new adb traces
NO_METRO phone: IDENTICAL
NO_METRO phone, variable empty: IDENTICAL to old
Metro both: IDENTICAL
=== new NO_METRO DEMS_CORE_HOST_PORT=4421: diff against unset
5a6
> adb -s emulator-5554 reverse tcp:4420 tcp:4421
7a9
> adb -s emulator-5554 reverse --remove tcp:4420
=== new Metro both DEMS_CORE_HOST_PORT=4422: diff against unset
18a19,20
> adb -s emulator-5554 reverse tcp:4420 tcp:4422
> adb -s emulator-5556 reverse tcp:4420 tcp:4422
21a24
> adb -s emulator-5554 reverse --remove tcp:4420
24a28
> adb -s emulator-5556 reverse --remove tcp:4420
=== stderr logs (times stripped): old vs new, unset
NO_METRO log lines IDENTICAL
Metro log lines IDENTICAL
```

So: unset or empty gives the same `adb` calls in the same order and the same log lines as the
pre-image (`cmp`); set adds one `reverse` per device and one `reverse --remove` per device, and
nothing else.

### 8.5 On a device: `DEMS_CORE_HOST_PORT=4421` during a session, and not after it

`dems_phone`, session of 07:08:38 (`implementation/assets/13_session_dems_phone.txt`):

```
(before the session, 07:08:30)  emulator-5554 reverse before: [;]
[device-session phone 07:08:40] Metro ready; device tcp:8081 -> host tcp:8085, tcp:4400 -> tcp:4400 on emulator-5554
[device-session phone 07:08:40] Core server: device tcp:4420 -> host tcp:4421 on emulator-5554
-- reverse rules during the session (set by the helper)
host-16 tcp:8081 tcp:8085
host-16 tcp:4400 tcp:4400
host-16 tcp:4420 tcp:4421
...
[device-session phone 07:13:58] session ended with status 0
-- reverse rules AFTER the session:

(end of list)
```

With the variable unset, on `dems_tablet` and `dems_phone2` (sessions of 07:15:38 and 07:15:51):
`host-16 tcp:4400 tcp:4400` only during the session, `[;]` after it. Nothing listened on host
port 4421 for this check and no port was bound by this row.

## 9. OPEN: the app could not be started, because the emulators are locked

**What the plan row asks:** on each named emulator the app opens in Simulated mode (screencap).

**What happened on `dems_phone`** (one launch attempt, 07:08:42, after a successful install):

```
[device-session phone 07:08:40] emulator-5554: WARNING could not set the bundler location (is com.dems.demo.tablet installed?); the app will use 10.0.2.2:8081
run-as: couldn't stat /data/user/0/com.dems.demo.tablet: No such file or directory
-- LAUNCH 07:08:42 (one launch; the lane Metro serves the bundle)
Error: Activity not started, unable to resolve Intent { act=android.intent.action.VIEW dat=demsdemo:///... flg=0x10000000 xflg=0x4 pkg=com.dems.demo.tablet }
-- bundle wait: 300s
-- pidof after launch: []
mCurrentFocus=Window{4c10738 u0 NotificationShade}
cdp probe: no inspector target (not fatal)
```

**Cause** (read-only `adb`, 07:14:18; the same on all three emulators):

```
== emulator-5554
  State: RUNNING_LOCKED
  mCurrentFocus=Window{4c10738 u0 NotificationShade}
  mShowingDream=false mDreamingLockscreen=true
  isKeyguardShowing=true
  User "Owner" (id=0, flags=0x4c13) (current): trustState=UNTRUSTED, trustManaged=0, deviceLocked=1, isActiveUnlockRunning=0, strongAuthRequired=0x1
  data dir: run-as: couldn't stat /data/user/0/com.dems.demo.tablet: No such file or directory
== emulator-5556   (identical lines; window 36a6a4e)
== emulator-5558   (identical lines; window a490808)
```

- The emulators were booted cold at 06:27 to 06:28 by step 24 (W02) and have not been unlocked
  since (guest uptime at 07:19: 3,096 s, 3,071 s, 3,055 s; emulator PIDs 84074, 84299, 84494, the
  ones step 24 recorded; this row restarted nothing).
- Each AVD has a device PIN, set by the predecessor task for the fingerprint enrolment
  (`docs/2026-09-30_dems_demo_stack_setup/implementation/47_mobile_login.md:255`,
  `72_second_phone_avd.md:29`). `README.md:141` says: "After a reboot the PIN keyguard shows" and
  gives the unlock command.
- Until the first unlock after a boot, user 0 is `RUNNING_LOCKED`: its credential-encrypted
  storage is closed, so the app's data folder cannot be reached (`run-as: couldn't stat`), the
  helper cannot write the bundler location, and Android does not resolve the app's activity
  ("unable to resolve Intent"). This state existed **before** this row's install: the helper's
  warning at 07:08:40 precedes the install of 07:08:41.
- The package manager works in this state, so `adb install -r` was not affected (section 11).

**Why this row did not unlock them.** Unlocking means typing the device PIN at an
operating-system lock prompt. That is a credential entry this agent does not perform on its own,
and no instruction of this row covers it. It is the user's action, or an explicit instruction
from the user.

**What closes the clause** (about 2 minutes per emulator, no rebuild, no reinstall):

1. The user unlocks each of the three emulators once (in the emulator window, or with the
   command of `README.md:141` for each serial).
2. Then, from the workspace root, outside the sandbox, one after the other:
   `METRO_PORT=8085 DEVICE_SESSION_MAX_SECONDS=600 apps/mobile/scripts/device-session.sh phone "/bin/sh '$PWD/docs/2026-10-04_dems_backend_rbac_pairing/implementation/assets/13_launch_check.sh'"`
   and the same with `tablet` and `phone2`. The script stops with status 30 if the emulator is
   still locked; otherwise it launches once, waits for the bundle and writes
   `implementation/assets/13_<avd>_launch.png`. It was syntax-checked (`sh -n`) and its launch,
   wait and screencap commands are the ones that ran in the `dems_phone` session; it has not run
   on an unlocked emulator. A runtime proof of the module from the JS side is not part of this
   row's verification (section 18); the read-only inspector check is therefore off unless
   `W13_CDP_PROBE=1` is set.

**Who else this blocks.** Every device check of this wave and the next: the typed-client probe of
W12 (at 07:16 another session held `.locks/dems_phone.lock` with Metro on 8082), the secure-store
probe of W15, and every later lane check. None of them can start the app until the emulators are
unlocked.

**What is proven without a launch.** The module is in the binary that is installed on each
emulator: the generated module list names it, the APK's dex files hold its class, and the
`base.apk` on each device has the SHA-256 of that APK (sections 10.4, 11).

## 10. Prebuild, keystore guard, Gradle build

One hold of `.locks/gradle.lock`, 07:03:19 to 07:07:44, in a login shell (JDK 17, `ANDROID_HOME`).
Script: `implementation/assets/13_gradle_slot.sh`; output: `13_gradle_slot.txt`.
Prebuild ran once (`npm run prebuild -w @dems/mobile` with `EXPO_OFFLINE=1`), then the guard, then
`( cd apps/mobile/android && ./gradlew assembleDebug )`. `npm run build` was not used: its `pre`
hook runs prebuild a second time and leaves no place for the guard (deviation DV-3).

### 10.1 Prebuild (KI-21 confirmed again)

```
== before prebuild
-rw-r--r--  324503614 Oct  1 10:41 .../android/app/build/outputs/apk/debug/app-debug.apk
-rw-r--r--       2257 Oct  1 11:34 .../android/app/debug.keystore
keystore cert SHA256 (before prebuild): FA:C6:17:45:DC:09:03:78:6F:B9:ED:E6:2A:96:2B:39:9F:73:48:F0:BB:6F:89:9B:83:32:66:75:91:03:3B:9C
keystore file sha256 (before prebuild): 221e0a3106aa4c3ccc154e0a418b55020b3f9ea6e84f92e8749cd9e2f39f5e58
== PREBUILD_START 07:03:19
> EXPO_NO_TELEMETRY=1 expo prebuild --platform android --no-install
- Clearing android
✔ Cleared android code
- Creating native directory (./android)
✔ Created native directory
- Updating package.json
✔ Updated package.json | no changes
- Running prebuild
✔ Finished prebuild
== PREBUILD_END 07:03:20 exit=0
tracked files outside apps/mobile/src: unchanged by prebuild
 M apps/mobile/package.json
 M apps/mobile/scripts/device-session.sh
 M package-lock.json
 M package.json
a6cf2fe11dc3ac5267348bf31afc5dc3db1c973fbc10c83e25bd9df897520be2  -          (hash of the tracked diff: equal before and after)
git status of the generated folders (expect nothing: both are git-ignored):
(end)
== after prebuild (KI-21)
old app-debug.apk: GONE (android/ was cleared; the backup holds it)
```

Prebuild changed **no tracked file** (rule 8): the `git status` lines and the hash of the tracked
diff for `package.json`, `package-lock.json` and `apps/mobile` (without `src`, where other rows
write) are the same before and after.

### 10.2 Keystore guard: digests before and after prebuild

| | File SHA-256 | Certificate SHA-256 |
|---|---|---|
| Backup (`.cache/apk-backup/debug.keystore`) | `221e0a31...9f5e58` | `FA:C6:17:45:...:91:03:3B:9C` |
| Live file before prebuild | `221e0a31...9f5e58` | `FA:C6:17:45:...:91:03:3B:9C` |
| Live file after prebuild (regenerated) | `221e0a31...9f5e58` | `FA:C6:17:45:...:91:03:3B:9C` |

```
== KEYSTORE GUARD (F28, D26)
keystore after prebuild: present, file sha256 221e0a3106aa4c3ccc154e0a418b55020b3f9ea6e84f92e8749cd9e2f39f5e58
keystore cert SHA256 (after prebuild):  FA:C6:17:45:DC:09:03:78:6F:B9:ED:E6:2A:96:2B:39:9F:73:48:F0:BB:6F:89:9B:83:32:66:75:91:03:3B:9C
GUARD: digest equals the backed-up one; no restore needed
102:            storeFile file('debug.keystore')
104:            keyAlias 'androiddebugkey'
110:            signingConfig signingConfigs.debug
95:        versionCode 100
96:        versionName "0.1.0"
```

The hypothesis of the environment check (`initialization/01_env_check.md`, section 2.5) holds:
prebuild puts the same template keystore back, byte for byte (the certificate is valid from
2014, so it is the fixed keystore of the React Native template, not a generated one). PA-03 is
confirmed. The restore branch of the guard did not run.

### 10.3 Build

```
== BUILD_START 07:03:20 (assembleDebug only)
== BUILD_END 07:07:40 exit=0 duration=260s
BUILD SUCCESSFUL in 4m 19s
600 actionable tasks: 572 executed, 28 up-to-date
== stop the Gradle daemon this build started (P7)
Stopping Daemon(s)
1 Daemon stopped
== gradle.lock released 07:07:44
lockf exit=0
```

0 compiler errors (`e:` lines), 141 Kotlin `w:` warnings in library code (the predecessor's
debug build had 141 as well). No release task ran; `apps/mobile/android/app/build/outputs/apk/`
and `intermediates/merged_manifests/` hold only `debug`. `release/` was not touched.

### 10.4 The APK, old and new

| | Old (backup) | New |
|---|---|---|
| Path | `.cache/apk-backup/app-debug.apk` | `apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk` |
| Size | 324,503,614 bytes | 324,537,405 bytes |
| SHA-256 | `cb6b1f513d525372b6e6c6ea35c134da29e9e8a0c79f2566a8fa4e7d217b0be5` | `d89c9be31fb43e2b46361c26e357db1ffc7a4d9ba46e56af5230f7d57f8a14ec` |
| `versionCode` / `versionName` (`aapt2 dump badging`) | 1 / 0.1.0 | **100** / 0.1.0 |
| Debuggable | yes | yes |
| `READ_` / `WRITE_EXTERNAL_STORAGE` | present (`maxSdkVersion='32'`) | absent |
| Class `expo.modules.securestore.SecureStoreModule` in the dex files | 0 references in 23 dex files | present (`classes8.dex`, `classes22.dex`) |

Signing certificate of the new APK, checked **before** any install
(`~/Library/Android/sdk/build-tools/36.0.0/apksigner verify --print-certs`):

```
Signer #1 certificate DN: CN=Android Debug, OU=Android, O=Unknown, L=Unknown, ST=Unknown, C=US
Signer #1 certificate SHA-256 digest: fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c
Verifies
Verified using v1 scheme (JAR signing): false
Verified using v2 scheme (APK Signature Scheme v2): true
Verified using v3 scheme (APK Signature Scheme v3): false
APK CERT: MATCH (fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c)
```

The native module is in the build:

```
build log, line 96 (Expo autolinking):   - [📦] expo-secure-store (57.0.4)
node_modules/expo/android/build/generated/expo/src/main/java/expo/modules/ExpoModulesPackageList.kt
37:      expo.modules.localauthentication.LocalAuthenticationModule::class.java to null,
39:      expo.modules.securestore.SecureStoreModule::class.java to null,
```

The differences of the new APK beyond the new module come from `app.json` as the predecessor's
packaging step left it (`versionCode: 100`, `allowBackup: false`, `blockedPermissions`); they had
never been in a debug build (finding F-3).

## 11. Install on the three emulators (H-06)

Each install ran inside `apps/mobile/scripts/device-session.sh`, so the device lock was held; one
emulator at a time; `adb -s <serial> install -r <apk>`; no uninstall, no `pm clear`, no data wipe.
The session commands check the APK's SHA-256 first and stop unless `adb` prints `Success`.

| | `dems_phone` `emulator-5554` | `dems_tablet` `emulator-5556` | `dems_phone2` `emulator-5558` |
|---|---|---|---|
| Session | 07:08:38 to 07:13:58, Metro 8085, `DEMS_CORE_HOST_PORT=4421` | 07:15:38 to 07:15:40, `NO_METRO=1` | 07:15:51 to 07:15:53, `NO_METRO=1` |
| Install window | 07:08:41 to 07:08:42 | 07:15:39 to 07:15:40 | 07:15:52 |
| `adb install -r` | `Performing Streamed Install` / `Success` | `Performing Streamed Install` / `Success` | `Performing Streamed Install` / `Success` |
| `versionCode` before → after | 1 → 100 | 1 → 100 | 1 → 100 |
| `firstInstallTime` before / after | `2026-10-01 10:45:40` / `2026-10-01 10:45:40` | `2026-10-01 11:03:12` / `2026-10-01 11:03:12` | `2026-10-01 10:05:38` / `2026-10-01 10:05:38` |
| `lastUpdateTime` before → after | `2026-10-01 10:45:40` → `2026-10-04 07:08:42` | `2026-10-01 11:03:12` → `2026-10-04 07:15:40` | `2026-10-01 10:05:38` → `2026-10-04 07:15:52` |
| Signature before / after | `signatures:[51ed3f60]` / `signatures:[51ed3f60]` | `[51ed3f60]` / `[51ed3f60]` | `[51ed3f60]` / `[51ed3f60]` |
| `base.apk` SHA-256 on the device | `d89c9be3...8a14ec` = host APK | `d89c9be3...8a14ec` = host APK | `d89c9be3...8a14ec` = host APK |
| `ceDataInode` / `deDataInode` before | not recorded | 492664 / 278872 | 500157 / 278970 |
| `ceDataInode` / `deDataInode` after | 500332 / 279059 | 492664 / 278872 | 500157 / 278970 |
| `pkgFlags` after | `DEBUGGABLE HAS_CODE ALLOW_CLEAR_USER_DATA` | the same | the same |
| App process after the session | none (`pidof` empty) | none | none |
| Reverse rules after the session | none | none | none |

Verbatim, `dems_tablet` (the two other logs have the same shape; all three are in
`implementation/assets/13_session_*.txt`):

```
-- package BEFORE install
versionCode=1 minSdk=24 targetSdk=36
lastUpdateTime=2026-10-01 11:03:12
signatures=PackageSignatures{dbffc10 version:2, signatures:[51ed3f60], past signatures:[]}
pkgFlags=[ DEBUGGABLE HAS_CODE ALLOW_CLEAR_USER_DATA ALLOW_BACKUP ]
User 0: ceDataInode=492664 deDataInode=278872 installed=true hidden=false suspended=false ...
firstInstallTime=2026-10-01 11:03:12
-- INSTALL_START 07:15:39: adb -s emulator-5556 install -r <app-debug.apk>
Performing Streamed Install
Success
-- INSTALL_END 07:15:40
-- package AFTER install
versionCode=100 minSdk=24 targetSdk=36
lastUpdateTime=2026-10-04 07:15:40
signatures=PackageSignatures{dbffc10 version:2, signatures:[51ed3f60], past signatures:[]}
pkgFlags=[ DEBUGGABLE HAS_CODE ALLOW_CLEAR_USER_DATA ]
User 0: ceDataInode=492664 deDataInode=278872 installed=true hidden=false suspended=false ...
firstInstallTime=2026-10-01 11:03:12
-- base.apk on the device: d89c9be31fb43e2b46361c26e357db1ffc7a4d9ba46e56af5230f7d57f8a14ec  (host APK: d89c9be31fb43e2b46361c26e357db1ffc7a4d9ba46e56af5230f7d57f8a14ec)
```

**App data.** `install -r` replaces the package in place; the row ran no uninstall and no clear.
Evidence that the data folders are the same ones: `firstInstallTime` is unchanged on all three
(an uninstall resets it), and on `dems_tablet` and `dems_phone2` the inode numbers of the app's
two data folders are the same before and after. Limits, stated plainly: (a) a file-by-file
comparison of the app's data was prepared but could not run, because the data folder cannot be
read while the emulator is locked (section 9); the line "app data: IDENTICAL" in the session
logs compares two empty listings and proves nothing; (b) for `dems_phone` the inode numbers were
not recorded before the install.

## 12. Gates and the test ledger

| Check | Before this row | After |
|---|---|---|
| `npm run deps:check -w @dems/mobile` | `Dependencies are up to date`, exit 0 (06:54:55) | `Dependencies are up to date`, exit 0 (07:16:03) |
| `npm run doctor -w @dems/mobile` | `21/21 checks passed. No issues detected!`, exit 0 | `21/21 checks passed. No issues detected!`, exit 0 |
| `npm run typecheck -w @dems/mobile` | not run | exit 0 (07:04:41 during the build; again 07:17:00) |
| `npm run lint -w @dems/mobile` | not run | exit 0 (07:04:50; again 07:17:04) |
| `npm run test -w @dems/mobile -- --maxWorkers=2` | `Test Suites: 72 passed, 72 total` / `Tests: 833 passed, 833 total`, exit 0 (06:55:09 to 06:56:08) | `Test Suites: 72 passed, 72 total` / `Tests: 833 passed, 833 total`, exit 0 (07:16:12 to 07:16:50) |

Verbatim, after:

```
> EXPO_NO_TELEMETRY=1 expo install --check
Dependencies are up to date
deps:check exit=0

> EXPO_NO_TELEMETRY=1 expo-doctor
Running 21 checks on your project...
21/21 checks passed. No issues detected!
doctor exit=0

Test Suites: 72 passed, 72 total
Tests:       833 passed, 833 total
Snapshots:   0 total
Time:        37.867 s, estimated 42 s
EXIT=0
```

Findings of `deps:check` and `doctor`: none before, none after; so no new finding and no
pre-existing one. No test run had to be repeated; no test file was edited by this row.

**Test ledger (P24).**

| Workspace | Before | After | New test files of this row |
|---|---|---|---|
| `@dems/mobile` | 833 tests in 72 suites | 833 tests in 72 suites | none |
| `@dems/shared`, `@dems/core-web`, `@dems/core-server`, `@dems/mock-core` | not written by this row | not run | none |

Expected total for mobile = baseline 833 + 0.

## 13. AC-C-85

| Clause | Evidence |
|---|---|
| `app.json` lists seven plugins | section 6.5; the existing test: `✓ keeps step 67 plugins, including expo-video for the feed` (`src/components/media/brand-media.test.ts`, `Tests: 8 skipped, 1 passed, 9 total` with `-t plugins`; it is part of the 833) |
| The merged release manifest has no cleartext attribute | Shown from the inputs of that merge, **not** from a generated release manifest: this row builds the debug variant only, and no release task ran (deviation DV-5). (a) After prebuild `usesCleartextTraffic` occurs in `app/src/debug/AndroidManifest.xml` (1) and `app/src/debugOptimized/AndroidManifest.xml` (1) and not in `app/src/main/AndroidManifest.xml` (0); there is no `release` source set. (b) The one new library manifest, `node_modules/expo-secure-store/android/src/main/AndroidManifest.xml`, is `<manifest></manifest>`: no attribute, no permission. (c) The merger report of the debug build names a single origin for the attribute: `android:usesCleartextTraffic ADDED from .../android/app/src/debug/AndroidManifest.xml:6:18-53` (`app/build/outputs/logs/manifest-merger-debug-report.txt:336-337`); that file is not part of a release merge. The predecessor's release build verified the release manifest itself; since then the inputs of that merge changed by (b) only |

If the controller wants the generated file: `( cd apps/mobile/android && ./gradlew :app:processReleaseMainManifest )`
under the Gradle lock produces the merged release manifest without building or signing an APK.
It was not run here.

## 14. Plan-row verification, clause by clause

| Clause (02_plan §8.2, W13) | Result | Section |
|---|---|---|
| `deps:check` and `doctor` outputs quoted, no new finding | PASS | 12 |
| On each named emulator `adb install -r` prints `Success` | PASS (3 of 3) | 11 |
| ... and the app opens in Simulated mode (screencap) | **OPEN**: emulators locked; user action needed | 9 |
| With `DEMS_CORE_HOST_PORT=4421` `adb reverse --list` shows `tcp:4420` during a session and not after it | PASS | 8.5 |
| The merged release manifest has no cleartext attribute | PASS by the inputs of the merge (no release task run) | 13 |
| `app.json` lists seven plugins | PASS | 6.5, 13 |
| Mobile typecheck, lint and tests exit 0 at or above 833 tests in 72 suites | PASS (833 in 72) | 12 |
| Controller's additions: lockfile diff holds only the slot-N3 package; `git diff --stat acaff20 -- apps/mobile/app.json` prints nothing; backups exist with hashes; APK certificate `fac61745...033b9c`; `firstInstallTime` unchanged; helper unchanged when the variable is unset | PASS | 6.4, 6.5, 5, 10.4, 11, 8.4 |

## 15. Processes, locks, network

**Processes this row started, all stopped (P7).**

| Process | Started | Stopped |
|---|---|---|
| Gradle daemon of the build | 07:03:20 | `./gradlew --stop` → `1 Daemon stopped`; `pgrep` for Gradle and Kotlin daemons at 07:07:57: none (none existed before the build either) |
| Metro PID 13356 on `127.0.0.1:8085` (started by `device-session.sh`) | 07:08:38 | `[device-session phone 07:13:58] Metro 13356 stopped`; `8085: no listener` |
| Session watchdogs (PIDs 13333, 20136, 20427) | with each session | ended with their session |

Not started by this row and left alone: the three emulators (PIDs 84074, 84299, 84494), the adb
server, and another row's Metro on `127.0.0.1:8082` (PID 18279, seen at 07:16).

**Locks at the end:** `npm`, `gradle`, `dems_tablet`, `dems_phone2` free; `dems_phone` held by
another row at 07:16.

**Network (P20).** The npm registry (lookup, install, audit) and Gradle's repositories during
the build. In addition, `expo install --check` and `expo-doctor`, which the plan row prescribes,
contact Expo's own services (finding F-5). Prebuild ran with `EXPO_OFFLINE=1`. No `sudo`, no
`brew`, no Docker, no shell-profile edit.

## 16. Rollback

**H-06 / RB-06, verbatim from 02_plan §14.3** (not executed by this row; run only on the
controller's or the user's instruction):

```sh
ROOT=/Users/gsp-budi/Documents/DEMS

# RB-06  put the predecessor's debug build back on one emulator
adb -s emulator-5554 install -r "$ROOT/.cache/apk-backup/app-debug.apk"

# RB-06 as it must be run after W13 (controller ruling D34 on DN-2): the backup has versionCode 1,
# the installed build has versionCode 100, so the downgrade flag -d is needed (allowed for a
# debuggable package). Not executed. It uninstalls nothing and keeps the app's data.
adb -s emulator-5554 install -r -d "$ROOT/.cache/apk-backup/app-debug.apk"
```

The first command is the text of 02_plan §14.3; the second is the form to use from now on.
Likewise `emulator-5556` and `emulator-5558`. The backup is
`.cache/apk-backup/app-debug.apk`, SHA-256 `cb6b1f51...7b0be5`; keep `.cache/apk-backup/` until
the task has ended (RB-17).

**Note on RB-06 (finding F-2, not tested; accepted by D34).** The backup has `versionCode` 1 and the installed
build now has `versionCode` 100. Android refuses a lower version code on `install -r` with
`INSTALL_FAILED_VERSION_DOWNGRADE`; for a debuggable package the flag `-d` allows it:
`adb -s emulator-5554 install -r -d "$ROOT/.cache/apk-backup/app-debug.apk"`. This is the
documented behaviour of `adb install`, stated as an expectation: the command was not run,
because running it would undo the row. Like RB-06 itself it uninstalls nothing and keeps the
app's data.

**RB-05** (this row left no rule behind; for the record):
`adb -s emulator-5554 reverse --remove tcp:4420    # likewise emulator-5556, emulator-5558`

**R-PRE (tracked files), under the npm lock:**

```sh
git checkout acaff20 -- package-lock.json && git apply .cache/rollback/W13.pre.patch
git checkout acaff20 -- apps/mobile/package.json apps/mobile/scripts/device-session.sh
/usr/bin/lockf -k -t 3600 .locks/npm.lock npm install --ignore-scripts
```

followed by one prebuild and debug build under the Gradle lock if the native folder should match
again (or RB-06 alone, which needs no rebuild). The keystore backup
`.cache/apk-backup/debug.keystore` restores the signing key if a later prebuild should ever
produce a different one: copy it to `apps/mobile/android/app/debug.keystore` before the build.

## 17. Findings, deviations, decisions

### Findings (for F-n)

| ID | Finding | Evidence |
|---|---|---|
| F-1 | **All three emulators are locked at the PIN keyguard since the cold boot of step 24** (`RUNNING_LOCKED`). The app cannot be started and its data folder cannot be read until each is unlocked once. This blocks every device check, not only this row's | section 9 |
| F-2 | RB-06 as written will meet a version downgrade (backup `versionCode` 1, installed 100) and needs `-d`. Not tested | sections 10.4, 16 |
| F-3 | The new debug build differs from the old one in more than the new module: `versionCode` 100, no `ALLOW_BACKUP` flag, no external-storage permissions. Cause: `app.json` as the predecessor's packaging step left it; no debug build had been made since | section 10.4, 11 |
| F-4 | PA-03 confirmed: prebuild cleared `android/` again (KI-21) and regenerated the debug keystore byte-identically; the certificate is unchanged | section 10.2 |
| F-5 | `npm run deps:check` (`expo install --check`) and `npm run doctor` (`expo-doctor`) contact Expo's services, which P20 does not list. Known behaviour of the two tools, not captured on the wire here: they send the SDK version and names and versions of the app's dependencies; no source, no credential. Each ran twice (before and after) | section 15 |
| F-6 | `expo install <package>` writes the package's config plugin into `app.json` without asking; a later row that adds an Expo module must not use it as it is | section 6.2 |
| F-7 | The Gradle build drove the 1-minute load average to 34 to 40 for about two minutes (four ABIs, native code). P9 allows one Gradle build; other rows may need P11 for 07:03:20 to 07:07:40 | section 2 |
| F-8 | The Gradle build writes library build outputs under `node_modules/*/android/build` (for example `node_modules/expo/android/build/generated/...`); git-ignored, and the same in every build of the predecessor, but outside `apps/mobile/android/**` | section 10.4 |
| F-9 | Two texts of the helper are now out of date and were left as they are (the row may change nothing else in the script): the log line "reinstall the current step-72 debug APK" (`device-session.sh`, in `ensure_avd`) names the old build, and `SHOTS` points at the predecessor's task folder. The current debug APK is `d89c9be3...8a14ec` | `apps/mobile/scripts/device-session.sh` |
| F-10 | `npm audit`: the text report (80) and the JSON metadata (84) disagree for the same tree, as in step 25 | section 7 |

### Deviations (for DR-n)

| ID | Deviation | Reason |
|---|---|---|
| DV-1 | Dependency added by a manifest edit plus `npm install`, not by `npx expo install` | `expo install` would write `app.json` (F-6). Same version, confirmed by `expo install --check` |
| DV-2 | `--ignore-scripts` on the install | As W03 did (its DV-1). The new package has no install script |
| DV-3 | Prebuild once and `./gradlew assembleDebug` directly, not `npm run build`; `EXPO_OFFLINE=1` on prebuild | Room for the keystore guard between the two; no second prebuild; no network for the template |
| DV-4 | The launch check and its screencaps are missing | F-1. The one screencap that exists shows a black frame and is named accordingly |
| DV-5 | AC-C-85's release manifest is shown by the inputs of the merge, not by a generated file | The row builds the debug variant only |
| DV-6 | App-data check by install times and data-folder inodes, not file by file; no inode "before" for `dems_phone` | F-1 |
| DV-7 | Evidence files and helper scripts written as `implementation/assets/13_*`; `.cache/rollback/W13.pre.patch` written under P23 | Not in the row's path list; the same practice as steps 25 and 27 |

### Decisions needed (for D-n)

| ID | Decision | Recommendation |
|---|---|---|
| DN-1 | **Unlock the three emulators** (F-1). It is the user's action; an agent enters the PIN only on the user's explicit instruction | Ask the user to unlock them once (README.md:141). Then run `13_launch_check.sh` per emulator to close this row's open clause, before W15 and before any device check |
| DN-2 | RB-06 in 02_plan §14.3 and RB-06's line in the register | Add `-d` to the command (F-2) |
| DN-3 | The debug build now carries `versionCode` 100, `allowBackup=false` and the blocked permissions (F-3) | Accept and record; it is what `app.json` says |
| DN-4 | P20 names the npm registry, Maven and `npm audit` only (F-5) | Record that `deps:check` and `doctor` also reach Expo's services, or drop the two commands from later gates |
| DN-5 | Later Gradle builds, if any (F-7) | Schedule them when no gate row runs, or cap them with `--max-workers` |
| DN-6 | The helper's two stale texts (F-9) | Give them to the README row (W86) or to a recorded one-line change |

## Next steps

- DN-1, then the launch check of section 9 (three sessions of about two minutes).
- W14 (npm slot N2) may start: the npm lock is free and the lockfile is in its final W13 state
  (SHA-256 `bc6b6f0789f765a513d300fdf74b2c13db50680a6345a18ba881fe9e88e5ab75`).
- W15 needs the unlocked emulators as well.

## 18. Follow-up after the controller's rulings (D34; D33 withdrawn)

Recorded at 07:29 WIB, after the controller's two follow-up messages.

| Point | Ruling (controller) | What this row did |
|---|---|---|
| The done parts of the row | Accepted (D34) | nothing further |
| DN-1, the keyguard | A first ruling (D33) allowed the README unlock procedure; the controller **withdrew it** before it was used. Entering the PIN stays with the user | **Not unlocked.** No input event of any kind was sent to any emulator by this row, before or after the rulings; the only device access after 07:19 was the read-only state read below |
| DN-2, RB-06 needs `-d` | Accepted | The `-d` form is now in the rollback block (section 16) |
| DN-3, the debug build's `versionCode` 100, `allowBackup=false`, blocked permissions | Accepted | nothing further |
| DN-4, `deps:check` and `doctor` | Dropped from every later gate | nothing further; the outputs of section 12 stay as this row's record |
| DN-5, later Gradle builds | Noted; none is planned | nothing further |
| DN-6, the helper's two stale texts | Left as a known issue | nothing further |

**The launch check stays OPEN.** State of the three emulators at 07:28:04 (read-only `adb`):

| | `emulator-5556` `dems_tablet` | `emulator-5558` `dems_phone2` | `emulator-5554` `dems_phone` |
|---|---|---|---|
| User state | `RUNNING_LOCKED` | `RUNNING_LOCKED` | `RUNNING_LOCKED` |
| Keyguard | `isKeyguardShowing=true`, `deviceLocked=1` | the same | the same |
| Guest uptime (no reboot since step 24) | 3,613.74 s | 3,597.63 s | 3,638.93 s |
| DEMS app | `versionCode=100`, not running | `versionCode=100`, not running | `versionCode=100`, not running |
| `firstInstallTime` | `2026-10-01 11:03:12` (unchanged) | `2026-10-01 10:05:38` (unchanged) | `2026-10-01 10:45:40` (unchanged) |
| Reverse rules | none | none | none |
| Device lock (`.locks/`) | free | free | free |

No device setting was changed by this row at any time (no `settings put`, no `locksettings`, no
`input`, no `svc`); the emulators are as step 24 left them, except for the installed build.

**How quickly an emulator re-locks: not measured.** No emulator has been unlocked since the cold
boot, so this row has no observation. The predecessor's note is the only source
(`docs/2026-09-30_dems_demo_stack_setup/implementation/47_mobile_login.md:279`): the AVDs keep
`stay_on_while_plugged_in=1` and a maximal `screen_off_timeout`, "so the keyguard does not show
while they run". Whether those two settings still hold was not read here; it is a hypothesis
until the first unlock shows it.

**Runtime proof of the native module.** The plan row does not ask for one: its verification is
"`adb install -r` prints `Success` and the app opens in Simulated mode (screencap)" (02_plan §8.2,
W13), and TD-10 names as proof for this row "the module is in the debug binary; the app still
starts in Simulated mode". The first half is shown in sections 10.4 and 11. A proof from the
running JS side is left to step 37 (W15), which probes the module properly. For that reason the
inspector check in `13_launch_check.sh` is now off by default (`W13_CDP_PROBE=1` turns it on).
No source file was added for it.

**What is ready for the re-run** (after the user has unlocked the emulators; order as the
controller asked: `dems_tablet`, `dems_phone2`, then `dems_phone`, each waiting for its device
lock):

```sh
A=docs/2026-10-04_dems_backend_rbac_pairing/implementation/assets
METRO_PORT=8085 DEVICE_SESSION_MAX_SECONDS=600 apps/mobile/scripts/device-session.sh tablet "/bin/sh '$PWD/$A/13_launch_check.sh'"
METRO_PORT=8085 DEVICE_SESSION_MAX_SECONDS=600 apps/mobile/scripts/device-session.sh phone2 "/bin/sh '$PWD/$A/13_launch_check.sh'"
METRO_PORT=8085 DEVICE_SESSION_MAX_SECONDS=600 apps/mobile/scripts/device-session.sh phone  "/bin/sh '$PWD/$A/13_launch_check.sh'"
```

Each session takes the device lock, starts and stops its own Metro lane, sets and removes only
its own reverse rules (no `DEMS_CORE_HOST_PORT`, so no `tcp:4420` rule), launches once and writes
`implementation/assets/13_<avd>_launch.png`. The script stops with status 30 on a locked
emulator and with 31 if the app is not running after the launch. It does not pair, sign in or
type anything into the app, which is what the reserved emulator `dems_phone2` needs. Afterwards
`firstInstallTime` is compared with the table above.

---
*Generated: 2026-10-04 07:23*
*Last Updated: 2026-10-04 07:29*
