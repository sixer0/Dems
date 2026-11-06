---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
row: fix wave Q, driver Q-N (the native cure of CT-01; apps/mobile + one script; tablet emulator-5556 lane 2, phone emulator-5554 lane 1; NORMAL launch form)
date: 2026-10-12
agent: coder-execution (decision D247; rules D94 / D122 / D163; briefs fix_brief_wave_j.md, fix_brief_wave_l.md)
narrative_tier: 2
status: needs-review - the patch is in, built, installed on both devices (pairing kept) and does what it is for (0 failed updates, 0 logged stacks where the unpatched app logged 83 failures / 13,136 stack lines); the timer STILL stands for up to 8.4 s in the first 40 s of a recording, so "standstill under 1 s" is NOT met; the UI-thread timer of item 5 is built and tested but SWITCHED OFF (it did not cure the standstill on the device); item 6 done (tests; one live observation of its control case)
tree: b4b0c25 + fix wave Q + this note's changes (no git write)
evidence: .cache/wave-q/n/ (0700): logs/gradle_slot.txt, gradle_build.txt, age_before*.txt, age_after*.txt, recb1_*, reca1_*, reca2_*, phone_after.txt, suite1.log; rec/nb1.mp4, na1.mp4, na2.mp4; view/*_timer_sheet.jpg; apk/ (both APKs, keystore, the generated android/ of before); orig/ (the library file before and after)
---

# 178 - Fix wave Q, driver Q-N: the native patch of Reanimated 4.5.1

## 1. The patch, line by line

File: `apps/mobile/patches/react-native-reanimated+4.5.1.patch` (a unified diff, paths relative to the package), ONE library
file: `android/src/main/java/com/swmansion/reanimated/NativeProxy.kt`. Library file sha256 before `bc198ba5...`, after `224e4c87...`.

| Patched lines | What | Why this and not something else |
|---|---|---|
| `private val viewExistsMethod by lazy { mountingManager.javaClass.methods.firstOrNull { it.name.startsWith("getViewExists") && it.parameterTypes.size == 1 }?.apply { isAccessible = true } }` | React Native's own `MountingManager.getViewExists(tag)` (`node_modules/react-native/ReactAndroid/.../fabric/mounting/MountingManager.kt:214`), found by reflection exactly as the library already finds `updatePropsSynchronously` three lines above (`MountingManager` is `internal`) | `getViewExists` is `getSurfaceManagerForView(tag) != null` - the EXACT precondition of the `RetryableMountingLayerException` that `updatePropsSynchronously` throws (`MountingManager.kt:208-212, 272-279`). So every update that worked before works unchanged; only the throwing case is taken out. `firstOrNull`: on a React Native without that method there is no check (the old behaviour minus the stack), never a crash |
| `if (viewExistsMethod?.invoke(mountingManager, viewTag) == false) { noteSkippedUnmountedUpdate(viewTag); return@parse }` inside the existing `try` | a tag no surface knows is skipped BEFORE the call: no exception object is built, nothing is logged per tag | "check the view exists before the update" of the ruling. Cost per dead tag per event: one reflective call and one hash lookup (`getSurfaceManagerForView` is `@AnyThread`) |
| `noteSkippedUnmountedUpdate`: a counter and ONE `I/Reanimated DEMS-PATCH skipped N synchronous updates of unmounted views so far (last tag T)` line at most every 5 s | so the cure can be measured and a field log still says that dead tags exist | without it "0 failures" could not be told from "the path never ran" |
| `Log.w("Reanimated", "synchronouslyUpdateUIProps failed for tag $viewTag: ${e.cause ?: e}")` (was `..., e)`) | a failure that still happens is one line with its cause, no stack (about 158 lines each in today's logs, "about 190 frames" in note 176) | the stack on the UI thread, in a draw pass, was the cost |

**Not done, on purpose: dropping the tag from the registry.** The registry is C++ (`Common/cpp/reanimated/Fabric/updates/UpdatesRegistry.cpp:165-175`
returns every entry; entries leave through `remove(tag)` and, with `FORCE_REACT_RENDER_FOR_SETTLED_ANIMATIONS` on, through
`AnimatedPropsRegistry::removeUpdatesOlderThanTimestamp` when the JS thread asks for settled updates). Dropping at the first failed lookup from
Kotlin would need a new JNI call and would also drop a view that is not mounted YET (the 2-3 s after a transition), whose animation would then
never be applied. The entry stays; retrying it now costs a lookup. Why entries pile up in an hour-old process is still NOT established (section 4).

**iOS: not patched.** The code path is different (`apple/reanimated/apple/REANodesManager.mm:161-176`: a missing view is `nil`, messages to it do
nothing, nothing is thrown or logged). Android only. No newer version of the library is installed (`package-lock.json` resolves 4.5.1); the
package ships no changelog in `node_modules`, so "a later version already does this" could not be read offline.

## 2. How it is applied and guarded

| Piece | Where | Proof |
|---|---|---|
| The script | `apps/mobile/scripts/apply-patches.sh` (POSIX sh, system `/usr/bin/patch`, no dependency). Reads the version from the library's `package.json`; `--check` changes nothing | Six cases run by hand: original + `--check` -> exit 1 "is NOT patched..."; apply -> "patched", file byte-identical to my patched copy; again -> "already patched: nothing to do" (exit 0); one line of the source changed -> exit 1 "a hunk ... does not apply ... nothing was changed", no `.orig` / `.rej` left; marker present but file differs -> exit 1 "carries the patch marker but differs"; version 4.5.2 -> exit 1 "is version '4.5.2', and the patch is for exactly 4.5.1. Do not build..." |
| Install time | root `package.json` `"postinstall": "sh apps/mobile/scripts/apply-patches.sh"`; `apps/mobile/package.json` `patches:apply`, `patches:check`. A partial install without the library: "nothing to patch", exit 0 | `npm run -s postinstall` and `npm run -s patches:check -w @dems/mobile` run. **NOT proven: that `npm install` / `npm ci` fires it** (no install was allowed). An install with `--ignore-scripts` (this project has used it) skips it - the Gradle guard is the backstop |
| Build time | `apps/mobile/plugins/with-dems-library-patches.js` (house pattern of `with-dems-release-signing.js`; `android/` is generated and git-ignored) appends the task `demsCheckLibraryPatches` to `android/app/build.gradle` and makes `preBuild` depend on it: it fails every variant when the version is not 4.5.1 or the marker `DEMS-PATCH react-native-reanimated+4.5.1` is absent. Registered in `app.json` | After the prebuild: `signing 1, library patches 1` marker each. Negative control with the library UNPATCHED: `./gradlew --offline -q :app:demsCheckLibraryPatches` exit **1**; after the patch the same task ran inside the build (`> Task :app:demsCheckLibraryPatches`) and the build passed. Weaker than it should be: my log cut the failure text of the negative control, so the SENTENCE was not read from Gradle (it is pinned by the static test) |
| Static test | `apps/mobile/src/components/media/brand-media.test.ts` (the existing pin of `app.json`'s plugins), block "library source patches": the patch file exists and touches one file, the script names the exact version and the marker, `postinstall` is wired, no patch tool dependency, the Gradle block is idempotent and names the same version / marker / sentences | 13 of 13 in that file |
| Documentation | `apps/mobile/patches/README.md` (why, what, how applied, how to drop it at an upgrade) and one paragraph in the root `README.md` beside the debug-APK line | |

## 3. Build and install

| | |
|---|---|
| Command | under `/usr/bin/lockf -k .locks/gradle.lock`, JDK 17, both apps force-stopped: `EXPO_OFFLINE=1 npm run prebuild -w @dems/mobile` (1 s; it cleared and regenerated `android/`, the debug keystore came back byte-identical), the guard's negative control, `sh apps/mobile/scripts/apply-patches.sh`, then ONE `./gradlew --no-daemon --offline assembleDebug` (script `.cache/wave-q/n/tools/gradle_slot.sh`) |
| Duration | 16:30:12 - 16:35:34, `BUILD SUCCESSFUL in 5m 21s`, 601 tasks (573 executed); host load 8 before, **106** at its peak (four ABIs), 5.8 three minutes later |
| APK | `apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk`, 324,537,417 bytes, **sha256 `e01ec1c78893a35434941d4ee7889bfe22a11be1a24ee4baa1b202997d26f66c`**; signer certificate `fac61745...033b9c` = the old APK's; the string `DEMS-PATCH skipped` is in `classes3.dex` (0 in the old APK). Old APK (sha256 `d89c9be3...14ec`) kept in `.cache/wave-q/n/apk/app-debug.before.apk` |
| Install | `adb -s <serial> install -r` -> `Success` on both; `firstInstallTime` unchanged (2026-10-04), signature `51ed3f60` unchanged |
| Pairing | after a normal launch: tablet Login, "Core online", "paired as DEV-0001"; phone Login, "Core online", "paired as DEV-0002". Neither showed Pair. Rules read back on each after the install and at the end |

## 4. Before / after (tablet, normal launch, lane 2, FAKE sources)

"Before" = the Oct 4 debug app; "after" = the patched one. The same procedure both times: force-stop, normal launch, sign-in, 40 rounds
(Home, Evidence, an item, Devices, Settings, Sessions - `tools/age.sh`), then a recording filmed with `screenrecord` (`tools/recn.sh`).

| | Note 176, hour-old process (rec 1) | BEFORE, aged here | AFTER, aged here |
|---|---|---|---|
| Process age at the end of the ageing | over 1 h | 6:34 | 6:04 |
| Failed synchronous updates / distinct tags, launch + sign-in + 40 rounds | 4,519 / 73 (ring buffer) | **83 / 2** - all in the 3 s after the sign-in, **0 in the 40 rounds** | **0 / 0** |
| Logged stack lines in the same window | not counted (about 190 frames each) | **13,136** | **0** |
| `DEMS-PATCH skipped` | - | - | 1,329 skipped updates, 2 log lines |
| Recording: failed updates / stack lines | 4,519 / - | 23 on 4 tags / 3,689 (`SES-...-0118`) | **0 / 0** in both (`-0119`, `-0120`); 1,598 and 2,012 skipped in total by then |
| `motion.uiRuntime.stalled` / fallback switch | 2 / yes | 0 / none | 0 / none (both) |
| `motion.uiRuntime.busy` (warn) | - | 1 | 1 (both) |
| App ERROR records / `Worklets` | - | 0 / 0 in the log window (one error TOAST "The sheet did not open" appeared after it) | 0 / 0 |
| Longest stretch the timer stood (film) | about 52 s | not comparable (my timer layer blanked it, section 5) | **8.4 s** (`-0120`: 5.3, 7.5, 8.4 and 7.5 s, all in the first 45 s of the film; afterwards it changed every second). `-0119` not comparable (same blanking) |
| Audio Monitor sheet after its tap | not open after 17 s | not measured | **about 7 s** (`-0120`, film at 4 frames/s: tap at film second 24.5, sheet at 31.5) |
| Core link | lost about 50 s | kept | kept |
| Janky frames / 99th percentile | 27.6 % / 300 ms | 47.7 % / 700 ms | 50.0 % / 300 ms; 47.5 % / 300 ms |
| Host load at the start / end | 7 / 10 | 6.9 / 12.1 | 2.8 -> 9.7; 5.4 / 7.3 |

**What this proves.** The patched path runs (thousands of skips) and logs no failure and no stack where the unpatched app logged 83 failures
with 13,136 stack lines at one sign-in and 3,689 during one recording.

**What it does not prove.** (1) Forty rounds of navigation leave NO dead tag even in the unpatched app, so the hour-old pile of 73 tags was not
reproduced (one more attempt: six Fast Refresh updates of a component - 0 failures). The cure of THAT state is argued from the code (the same
call, per tag) and from the transition bursts, not measured. (2) **The timer still stands 5-8 s in the first 40 s of a recording, and the
Audio Monitor sheet took about 7 s**: the expected "standstill under 1 s" is NOT met. This is note 176's "remainder"; it is not the exception
flood. Half of all frames are janky during a recording on this emulator, with or without the patch.

Phone (reduced by the controller): install, launch, pairing kept, sign-in, Evidence and Sessions opened: 0 failed updates, 0 stack lines,
1 skip line, 0 app error records. No aged recording on the phone.

## 5. Item 5 - the timer

**Before (unchanged, and what the app runs today):** `src/runtime/recording-elapsed.ts:83-121` `createElapsedTicker` - whole seconds since the
session's `startedAt` on the Core clock, re-read by a plain JS timer at most every 250 ms and rendered by React through
`useSyncExternalStore` (`:180-201`); drawn by `RollingNumber` (`features/session-live/timer-readout.tsx`, `rec-indicator.tsx` `RecTimer`). It
never waited for messages (CF2-A); it does wait for the JS thread and a render. The REC dot is a Reanimated loop on the UI thread already. The
Finalizing screen has NO running clock (`session-finalizing/finalization-pipeline.tsx:13`: step durations are the Core's) - nothing to drive.

**Built:** a UI-thread clock for the readout (`timer-readout.tsx`): `useRecordingLocalOrigin` / `coreInstantOnDeviceClock`
(`runtime/recording-elapsed.ts`, `runtime/core-clock.ts`) put the recording's start on the device clock; a `useFrameCallback` computes
`floor((Date.now() - origin) / 1000)` and, when React's second is more than 250 ms overdue (`clockLayerText`), draws `HH:MM:SS` with Skia text
from a shared value (the level meter's mechanism), hiding React's readout meanwhile. LIVE mode only (a simulator's clock has a speed).

**What the tablet showed, in three runs:**
1. `-0118`: React's readout hidden and NOTHING drawn for most of the recording - Skia's `useFont` loads the face per mount, asynchronously. Fixed: the faces are loaded once per run.
2. `-0119`: still blank for the first 25 s - the canvas' own tree is committed by the JS thread. Fixed: the layer arms itself from inside the canvas.
3. `-0120`: no blanking of that kind, but the timer stood 5-8 s four times in the first 45 s and one sampled second was blank; from 00:00:42 it changed every second. On an idle screen (a probe on Home, removed) the layer drew correctly in both faces.

**Decision taken: the layer is SWITCHED OFF** (`rec-indicator.tsx` `DEVICE_CLOCK_LAYER = false`, pinned by a test). Where the timer stands, the
UI thread is busy too, so a UI-thread clock does not cure it, and it showed a blank second. The mechanism, its rule and its anchor stay in the
tree with tests (`session-live/live-monitor-timer-core-clock.test.tsx` "D247 item 5" - 5 cases; `monitor-timer-drawn.test.tsx` 1 case).
**Item 5 is therefore NOT achieved**: the timer is drawn from the clock, but it can still stand while both threads are busy.

## 6. Item 6 - no automatic opening of a foreign Summary after a sign-in

`navigation/session-routes.ts` `signInSessionHref`: SEALED + unacknowledged opens its Summary only when the session ran on this device;
`navigation/root-navigator.tsx` `useBootHref` uses it. "Ran on this device" = CT-05's rule (`runtime/session-route-sync.tsx`: the device stood
on a flow screen of the session), now also kept across a relaunch (AsyncStorage `dems.session.attended.v1`, the newest 24 ids, errors logged
through `reportRuntimeIssue`); without a Core link every session is the device's own. Home (`dashboard/quick-actions.tsx`,
`home-action-summary-elsewhere`): "Session {{id}} was sealed on another console. Summary not yet acknowledged." above which "View session
summary" opens it. **"<where>" is not said**: the session carries no member naming the console or device (only `createdBy`).
Tests, in the existing routing file `runtime/session-route-sync-live.test.tsx` "D247 item 6" (4 cases: the rule; a session of another console
-> boot target `/home` + Home's line; CONTROL own session -> its Summary; the stored list across a relaunch and a damaged value).
**Device proof: by component test only** (the controller's reduction): the foreign case was NOT driven on the tablet. Seen live, unplanned:
the control case - after a relaunch and sign-in the tablet opened the Summary of `SES-20261012-0120`, a session it had run before the relaunch.

## 7. Reverted / temporary

Nothing of items 1-3 was reverted. Temporary and removed again: a forced-late readout on Home (probe), six comment lines appended to
`components/composed/glow-ring.tsx` (restored byte-identical to its state before). `node_modules`' library file is LEFT PATCHED (the tree
expects it; the copies of before and after are in `.cache/wave-q/n/orig/`).

## 8. Proof of the tree

| Check | Result |
|---|---|
| `npx tsc --noEmit` (apps/mobile) | no output |
| `npm run -s lint` (apps/mobile) | no output |
| whole mobile suite, one run, load 6.2 at the start | **281 suites, 3,166 tests passed, exit 0**, 229 s (`logs/suite1.log`) |
| `git status --short` | no path under `node_modules`; `git check-ignore -v`: `node_modules/` (`.gitignore:12`), `apps/mobile/android/app/build`, `.gradle`, `app/build.gradle` (`apps/mobile/.gitignore:43 /android`) |
| `apply-patches.sh --check` at the end | "already patched" |

## 9. Checks for the test runner

1. `npm ci` (or `npm install`) under the npm lock in a scratch clone: the root `postinstall` line must print "patched react-native-reanimated 4.5.1"; then `--ignore-scripts` + `./gradlew :app:demsCheckLibraryPatches` must fail with the "is NOT patched" sentence (read the sentence this time).
2. Tablet, item 6: one session through the API as another console, sign out and in on the tablet -> Home with the line, not the Summary; "View session summary" opens it.
3. Phone: one 60 s session after the 40 rounds (dropped here).
4. Whole regression of the other workspaces: untouched by this driver except the root `package.json` script line.

## 10. What a release build still needs

- The same patch: the guard covers `assembleRelease` too (`preBuild`), and `build-release-apk.sh` runs prebuild, which re-applies the block. Not built here.
- A JS + UI profile of the first 40 s of a recording in a RELEASE build: the remaining standstills (5-8 s) and the 7 s sheet are there, and a debug build under an emulator at 50 % janky frames cannot say whether a release build has them.
- `reactNativeArchitectures` builds four ABIs (load 106 on this host): pass `-PreactNativeArchitectures=arm64-v8a` for emulator builds.

## 11. Disclosures

- Recordings over 60 s: `SES-20261012-0118` 4:15, `-0119` 3:27, `-0120` 2:35 - my end step missed each time (the End dialog now stands lower with the keyboard up; in the third the Audio Monitor sheet opened late and covered it). `-0120` was ended **through the API** (helper session, reason given). FAKE sources only; `CAM-03` / `MIC-03` never selected, pre-checked or started.
- Three recordings instead of the one the controller asked for after its reduction: the first "after" film showed a defect of my own timer layer and could not serve as the proof.
- One error toast on the tablet during `-0118` ("The sheet did not open: the sheet library accepted no request to slide in"), unpatched app, my blind taps.
- Lane 2: three inactive INFO alerts of my sessions are unacknowledged; 0 active. Lane 2's Core log was not read.
- No lock / PIN / fingerprint touched; no unlock was needed; biometric offer answered "Not now" by the sign-in helper's tap.

## 12. Decisions for the controller

1. **CT-01 stays open in its remainder.** The exception flood is cured; the 5-8 s standstills at recording start are not, and item 5's UI-thread clock does not help there. Accept as a stated limit of the debug build on the emulator until a release-build profile, or give a row for that profile.
2. The device-clock layer is in the tree, off. Delete it, or keep it for the profile row.
3. Item 6 says "another console", not where: naming the place needs an additive session member from the Core.
4. `postinstall` is new at the root: every `npm install` now runs one shell script. Installs with `--ignore-scripts` need `npm run patches:apply -w @dems/mobile`.
5. The workaround "start a demonstration from a freshly launched app" is still good advice: the pile-up of dead tags was not reproduced, so its cure is not measured.

## 13. State left (17:05)

Both devices on Login in the normal launch form, paired (`DEV-0001`, `DEV-0002`), "Core online", keyboard closed, dev toast closed; rules tablet
`tcp:8081 tcp:8081`, `tcp:4420 tcp:4422`, phone `tcp:8081 tcp:8081`, `tcp:4420 tcp:4421`. Lane 2: no session open (`SES-20261012-0120` SEALED,
acknowledged), rigs OFF, selector on the FAKE defaults, 0 active alerts. Lane 1: untouched. Metro, both web servers and both Cores were not
restarted. Slots file: my two lines, the last "free".

---
*Generated: 2026-10-12 17:08 WIB*
