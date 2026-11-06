---
task_id: 2026-09-30_dems_demo_stack_setup
task_slug: dems_demo_stack_setup
date: 2026-10-01
agent: coder-execution
step: 72 (blueprint row 72, rev 4; 05_mobile_plan M-05)
lane: mobile-C, Metro 8083 (P4)
source_plan: /Users/gsp-budi/Documents/DEMS/docs/2026-09-30_dems_demo_stack_setup/identification/02_structured.md (row 72)
narrative_tier: 3
status: completed
decisions: D28, D46, D48, D50, D53, D55, D58, D61, D64
---

# Step 72: mobile brand and media (M-05)

Run on 2026-10-01 from 04:29 to 04:58 WIB in `/Users/gsp-budi/Documents/DEMS`. **Outcome: PASS.**

- The app now uses the real brand:
  - the shared emblem module (step 35) in `Emblem` and `EmblemDraw`;
  - the shared topographic SVG (`SvgXml`) and the W-05 room still in `HeroBackdrop`;
  - the step-28 PNGs as the launcher icon, adaptive icon, monochrome icon and splash.
- `CameraFeed` plays video through expo-video (muted, looped), with a UTC+07:00 overlay. The step-71 procedural renderer is the fallback.
- The 84-file 640×360 mobile media subset from step 92 is bundled through a static require map.
- There was one Gradle rebuild, under `gradle.lock`. The new APK was reinstalled on both AVDs.

## 1. Row-72 acceptance

| Row-72 check | Result | Evidence |
|---|---|---|
| **MA-24**: no `DEMS-Mobile` reference | **PASS** | `grep -rn "DEMS-Mobile" apps/mobile` (without node_modules and android) printed nothing (exit 1) |
| **MA-24**: the hero SHA-256 equals step 29's `room-1600.jpg` | **PASS** | `c8f8721cf737611f566532b6a2ac738e6bafd7dc0968655d457d4d06397066a3` for both `apps/mobile/assets/images/hero/room-1600.jpg` and `packages/shared/assets/hero/room-1600.jpg` |
| **MA-24**: the notices name `apps/mobile` | **PASS** | `THIRD_PARTY_NOTICES.md:77`, the hero row: "`apps/mobile`: the 1600 px variant (copied by the mobile brand-media row to `apps/mobile/assets/images/hero/`) …" |
| Every copied media file's SHA-256 equals its step-92 source; subset size recorded | **PASS** | 84/84 equal to `packages/shared/assets/demo-media/mobile/*`, and 84/84 equal to the SHA-256 values step 92 recorded in `media-index.json`. Size: **12,646,268 B**, `du -sk` 12,468 KB (§4.2) |
| CameraFeed plays the video on both AVDs (screencaps) | **PASS** | §5. The clip's burnt-in OSD "CAM-01 \| VIDEO-01 \| LIVE \| DEMO" is visible. The video region changes between frames 2.5 s apart while the page chrome is pixel-identical. ExoPlayer `Init` and the `video/avc` codec appear in logcat |
| A test covers the procedural fallback | **PASS** | `camera-feed-video.test.tsx` "falls back to the procedural renderer when the player fails, and logs it once". A mutation check (fallback disabled) makes that test fail (§3.2) |
| Launcher icon and splash screencaps on both AVDs (MA-11 icon and splash part) | **PASS** | §5.1: `72_dems_{phone,tablet}_launcher_drawer.png`, `…_launcher_icon_zoom.png`, `…_splash.png` |
| The Gradle run held the lock | **PASS** | `/usr/bin/lockf -k -t 3600 .locks/gradle.lock …`: acquired 04:41:28, released 04:44:33, `lockf exit=0` (§4.1) |
| `THIRD_PARTY_NOTICES.md` not modified by this step | **PASS** | mtime `Oct 1 03:23:43` (step 37), SHA-256 `4c5cbdfd5b06098283af2420da1969ac094e345fb2afa6a76a5e34a5f660ceb3`, the same values step 92 recorded at 04:06 (D46: the hero entry already names mobile) |
| Extra checks from the delegation: expo-doctor clean; the app launches on both AVDs; APK size before and after | **PASS** | doctor 21/21 and `expo install --check` up to date (§4.3). Launch `Status: ok` on both. APK 323,640,100 → 324,503,614 B (§4.2) |

## 2. Files (P6 write set)

| Path (under `apps/mobile/`) | Change | Content |
|---|---|---|
| `assets/images/brand/icon-foreground-1024.png`, `icon-monochrome-1024.png`, `splash-1024.png` | new (copies) | Byte copies of `packages/shared/assets/brand/*` (step 28). SHA-256 values: `04c1a741…573d`, `3a3a4995…5b26`, `3d3b7c26…c27c` |
| `assets/images/hero/room-1600.jpg` | new (copy) | Byte copy of step 29's mobile variant (1600×1066, 326,153 B) |
| `assets/media/` (84 files) | new (copies) | Step 92's mobile subset, unchanged:<br>- 13 evidence items × (2 videos, 2 audio tracks, 2 posters);<br>- the live loops for session 0024 (2 videos, 2 audio tracks, 2 posters). |
| `app.json` | edit (icon and splash keys only) | See the diff below. The `plugins` list is step 67's and is unchanged, including `expo-video` |
| `jest.setup.ts` | append (D58 hand-over) | The `expo-video` mock:<br>- `useVideoPlayer` returns one event-emitting player per source;<br>- `VideoView` is a host View that receives the props;<br>- the `Mock*` types sit outside the factory (S72-11). |
| `src/components/media/brand-assets.ts` | new | Exports:<br>- `EMBLEM_SHARED`: the step-71 adapter over `@dems/shared/brand`, plus the user-space gradient vector;<br>- `TOPO_XML` (= `TOPO_SVG`) and `TOPO_XML_MAX_LINE_ALPHA` (0.40);<br>- `HERO_STILL` (`require` of the hero);<br>- `HERO_FOCUS` (D46: 62 % 45 %). |
| `src/components/media/demo-media.ts` | new | The static require map:<br>- `DEMO_MEDIA_LIVE` and `DEMO_MEDIA_EVIDENCE['0001'…'0013']`, keyed by evidence suffix (D61), each `{ video, audio, poster }` keyed by track ID;<br>- `DEMO_EVIDENCE_SUFFIXES`, `demoMediaForEvidence()` and `liveLoopFor()`.<br>The map holds no hashes (P13). |
| `src/components/media/camera-feed.tsx` | edit | The video renderer (expo-video) with a Skia overlay, and the procedural fallback. New props: `source` and `showLabel`. `image` now defaults to the hero still (§3.1) |
| `src/components/media/emblem.tsx`, `emblem-paths.ts` | edit | The shared emblem is the default data. A user-space gradient ramp is shared by all 7 paths (`EmblemPathData.gradient`). The placeholder stays for tests and as an explicit fallback |
| `src/components/media/hero-backdrop.tsx` | edit | Defaults: the hero still at D46 framing and the shared texture. `null` selects either placeholder. The texture layer opacity is scaled so the brightest line lands at `topoOpacity` |
| `src/components/media/index.ts` | edit | Exports the new modules |
| `src/components/media/camera-feed-video.test.tsx` | new | 5 tests (§3.2) |
| `src/components/media/brand-media.test.ts` | new | 9 tests (§3.2) |
| `src/components/media/media.test.tsx` | edit | The adapter test now also checks `EMBLEM_SHARED`. The step-71 procedural test passes `source={null}`. Added: shared-emblem defaults, procedural default still, and HeroBackdrop defaults and placeholders |
| `android/` | regenerated | By prebuild, under `gradle.lock` (git-ignored) |

`app.json` diff (keys owned by step 72; the `before` copy is in the scratchpad):

```
-    "icon": "./assets/images/icon.png",
+    "icon": "./assets/images/brand/icon-foreground-1024.png",
-        "foregroundImage": "./assets/images/android-icon-foreground.png",
-        "backgroundImage": "./assets/images/android-icon-background.png",
-        "monochromeImage": "./assets/images/android-icon-monochrome.png"
+        "foregroundImage": "./assets/images/brand/icon-foreground-1024.png",
+        "monochromeImage": "./assets/images/brand/icon-monochrome-1024.png"
-          "image": "./assets/images/splash-icon.png",
-          "imageWidth": 76
+          "image": "./assets/images/brand/splash-1024.png",
+          "imageWidth": 288
```

`adaptiveIcon.backgroundColor` and the splash `backgroundColor` stay `#0B0D0F` (D48).

**Also written:**
- `docs/…/delegation_progress/coder_execution_step_72.md`
- this log
- 23 screencaps `docs/…/implementation/assets/mobile/72_*.png`

**Not written:**
- `packages/shared/**` and `THIRD_PARTY_NOTICES.md`
- `src/app/**`, which includes the dev-gallery captions (see R-5)
- `src/runtime/**` and the providers
- `package.json` and the lockfiles: no npm install was run, because expo-video 57.0.5 was already installed by row 18 and plugged in by step 67
- `status_tasks.md`, `delegation_progress_report.md`, `masterplan/02_plan.md` and `99_implementation_report.md`: these are shared files in a parallel run (P8), and the controller synthesises them

Nothing was committed.

## 3. Design and verification of the code

### 3.1 CameraFeed contract (for steps 75–89)

| Use | Call | Result |
|---|---|---|
| Live feed (Session Monitor, idle tiles) | `<CameraFeed cameraId="CAM-1" motion={policy} paused={!focused} />` | Plays that camera's live loop from `demo-media.ts` (session 0024, seamless, no audio). The overlay burns in the UTC+07:00 time (1 Hz) and "CAM n". REC stays the screen's kit `Chip` (DR-92-7) |
| Evidence playback | `mode="playback" source={DEMO_MEDIA_EVIDENCE[suffix].video['VIDEO-01']}` | Plays the clip. The clip has its own OSD (time, REC, labels), so the overlay shows nothing by default (`showTimestamp` and `showLabel` override this). Apply the excerpt rule: clips are 31–47 s, labelled DEMO excerpt (64 §5) |
| Poster or thumbnail | `mode="poster" image={DEMO_MEDIA_EVIDENCE[suffix].poster['VIDEO-01']} showLabel={false}` | A static still. Posters carry the burnt-in OSD |
| Procedural only | `source={null}` (and `image={null}` for the placeholder room) | The step-71 renderer. Its still defaults to the W-05 photo |
| Player failure | automatic | Logs `warn` `media.cameraFeed.video` through `reportMotionIssue`. Step 73's `installRuntimeLogSinks` persists that to `dems.mobile.log.v1`. The feed then switches to the procedural renderer, and each failed clip gets only one attempt |

- **Pausing.** `paused` and `noSignal` pause the player. The NO SIGNAL fade draws over the paused clip.
- **Reduced motion.** The video keeps playing: it is the monitored content, like the meters (S72-2).
- **Audio.** Audio tracks (`audio['AUDIO-01' | 'AUDIO-02']`) are separate files. Nothing in this step plays them (see R-3).

### 3.2 Tests and gates (fresh runs; final run 04:55:52–04:56:05)

| Command | Result |
|---|---|
| `npm run typecheck -w @dems/mobile` | exit **0**, 0 `error TS` |
| `npm run lint -w @dems/mobile` | exit **0**, no problems (the two warnings the first mock draft caused were fixed) |
| `npm test -w @dems/mobile -- --maxWorkers=2 --forceExit` | exit **0**: **33 suites, 438 tests pass** (including the parallel steps' suites) |
| `npm test … src/components/media` | 3 suites, **30 tests** pass |
| MA-22 `grep -rnoE "#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?" apps/mobile/src/features apps/mobile/src/components apps/mobile/src/app/dev-gallery.tsx` | no output, exit 1. The first draft of `brand-media.test.ts` had `#0B0D0F` literals; it now uses `palette.black` |
| URL grep on `src/components/media` | no output, exit 1 |

New tests:

- **`camera-feed-video.test.tsx` (5 tests):**
  1. Live mode plays `liveLoopFor(1)` muted and looped, with `surfaceType: 'textureView'`; the overlay only (no still, grade or scanline), with the time and "CAM 1".
  2. Reduced motion keeps playing; `paused` and no-signal pause.
  3. **The fallback on a player error, logged once.**
  4. `source={null}` and poster mode use the procedural renderer.
  5. A playback clip gets no overlay text.
- **`brand-media.test.ts` (9 tests):**
  - `EMBLEM_SHARED` equals the adapter (widths 3.2/2.6, gradient y 6→122); `TOPO_XML === TOPO_SVG`.
  - Byte identity of the brand PNGs and the hero; 84 media files byte-identical to step 92's mobile subset.
  - The require map names every bundled file exactly once, with keys that agree with the file names.
  - The suffixes are 0001–0013.
  - The `app.json` icon and splash keys point at existing brand PNGs.
  - The plugin list is unchanged.

**Mutation check.** With `setFailedClip(clipKey)` replaced by a no-op, the fallback test fails. Output: "✕ falls back to the procedural renderer when the player fails, and logs it once", `Tests: 1 failed, 4 passed`. The file was restored (SHA-256 identical to the backup).

## 4. Native rebuild, APK and bundle size

### 4.1 Gradle slot (P2; outside the sandbox for `~/.gradle`, D24)

```
/usr/bin/lockf -k -t 3600 .locks/gradle.lock /bin/sh gradle_slot_72.sh     (JAVA_HOME=openjdk@17)
== gradle.lock acquired 04:41:28
✔ Cleared android code / ✔ Finished prebuild   (×2: the npm pre-hook plus the build script, O-1 of step 67)
BUILD SUCCESSFUL in 3m
600 actionable tasks: 572 executed, 28 up-to-date
== BUILD_EXIT=0 DURATION=184s BUILD_END 04:44:32
-rw-r--r--  324503614  android/app/build/outputs/apk/debug/app-debug.apk
cb6b1f513d525372b6e6c6ea35c134da29e9e8a0c79f2566a8fa4e7d217b0be5  app-debug.apk
mipmap-anydpi-v26/ic_launcher.xml: background @color/iconBackground, foreground @mipmap/ic_launcher_foreground,
                                   monochrome @mipmap/ic_launcher_monochrome
colors.xml: splashscreen_background #0B0D0F, iconBackground #0B0D0F
styles.xml: windowSplashScreenAnimatedIcon @drawable/splashscreen_logo (xxxhdpi 396,915 B)
USE_BIOMETRIC count: 1 · PROPERTY_COMPAT count: 0 · screenOrientation="unspecified" · cleartext debug 1 / main 0
1 Daemon stopped
== gradle.lock released 04:44:33                                           lockf exit=0
```

- The build ran with 0 errors. It logged 141 Kotlin `w:` deprecation warnings, all in library code, the same count as in step 67.
- `expo.modules.video.VideoModule` is in the generated `ExpoModulesPackageList.kt:41`, and the APK dex holds the `expo/modules/video/VideoModule` classes.
- AC-25, AC-26 and MA-02 still pass (the counts above).

### 4.2 Sizes

| Item | Before (step 67, 02:31) | After (step 72, 04:44) | Delta |
|---|---|---|---|
| `app-debug.apk` | 323,640,100 B (`22572c22…6f30`) | 324,503,614 B (`cb6b1f51…0be5`) | **+863,514 B** (splash drawables 5 densities ≈ 926 KB, launcher webp; the template images are gone from the resources) |
| Media inside the debug APK | 0 files | 0 files | Debug builds do not embed the JS bundle or assets; they stream from Metro (`unzip -l … \| grep -cE "\.mp4\|\.m4a\|index\.android\.bundle"` → 0) |
| Bundled media (`apps/mobile/assets/media`) | none | 84 files, 12,646,268 B (`du -sk` 12,468) | + mobile subset only |

**Release-bundle check** (F-72-1). This shows what an embedded or release build would carry.

Command: `EXPO_OFFLINE=1 npx expo export --platform android --output-dir <scratch>/export72`. It finished in 19 s with exit 0, and the scratch output was deleted afterwards. It produced:
- a Hermes bundle of 10,263,591 B;
- **119 assets** totalling 15,589,211 B: 28 mp4, 28 m4a, 29 jpg, 24 png, 8 ttf, 2 xml.

A hash join of those assets against the repository gives:

```
{"exportedAssets":119,"fromMobileMediaSet":84,"mobileSetSize":84,"fromDesktopDemoMedia":0,"heroStill":1,"videoOrAudioNotInMobileSet":0}
```

So a release APK would carry exactly the mobile set (12.6 MB) plus the hero still (0.33 MB), and **none of the 28.8 MB desktop evidence set** or the 720p live loops.

### 4.3 expo-doctor and the dependency check (after the rebuild; network, outside the sandbox)

```
Running 21 checks on your project...  21/21 checks passed. No issues detected!    doctor exit=0
expo install --check → Dependencies are up to date                                deps exit=0
```

### 4.4 Reinstall (P3/D55: `device-session.sh`, NO_METRO=1, AVD lock held, app force-stopped first)

| | dems_phone (emulator-5554) | dems_tablet (emulator-5556) |
|---|---|---|
| Session | 04:45:25–04:45:37 | 04:45:44–04:45:56 |
| `adb install -r` | `Performing Streamed Install` / `Success` | `Success` |
| `lastUpdateTime` | 2026-10-01 04:45:27 | **2026-10-01 04:45:47** (NATIVE REINSTALL DONE) |
| `USE_BIOMETRIC` | granted=true | granted=true |
| OS | sdk 36 (Android 16) | sdk 36 (Android 16) |

## 5. Device smoke (lane Metro 8083; every session through `device-session.sh`)

| Session | AVD | Window (WIB) | What it did |
|---|---|---|---|
| 1 | phone | 04:47:55–04:48:57 | Cold launch plus a splash burst. First bundle: `Android Bundled 6832ms … (5436 modules)`. It also produced the emblem and hero captures |
| 2 | phone | 04:49:47–04:50:02 | Feed video frames. `am start -W` → `Status: ok`, `TotalTime: 3907` |
| 3 | phone | 04:50:29–04:51:18 | CAM 2, drop signal, restore, reduced motion |
| 4 | tablet | 04:51:50–04:52:24 | Cold launch plus the splash burst; feed; reduced motion |
| 5 | tablet | 04:52:48–04:53:35 | CAM 2, drop signal, restore, scroll to the emblem and hero |

Every session ended with status 0, and the helper stopped Metro on every exit.

### 5.1 Launcher icon and splash (MA-11 icon and splash part)

| Check | Phone | Tablet |
|---|---|---|
| All-apps drawer | [72_dems_phone_launcher_drawer.png](assets/mobile/72_dems_phone_launcher_drawer.png): "DEMS Table…" shows the gold emblem on the dark `#0B0D0F` circle | [72_dems_tablet_launcher_drawer.png](assets/mobile/72_dems_tablet_launcher_drawer.png) |
| Icon zoom (3×, from uiautomator bounds) | [72_dems_phone_launcher_icon_zoom.png](assets/mobile/72_dems_phone_launcher_icon_zoom.png), bounds `[293,999][540,1331]` | [72_dems_tablet_launcher_icon_zoom.png](assets/mobile/72_dems_tablet_launcher_icon_zoom.png), bounds `[1813,569][2080,819]`: double-rim shield, 6 ridges and the roof, fully inside the mask |
| Splash (Android 12+ SplashScreen API) | [72_dems_phone_splash.png](assets/mobile/72_dems_phone_splash.png): gold emblem centred on `#0B0D0F`, not clipped by the ⅔ mask | [72_dems_tablet_splash.png](assets/mobile/72_dems_tablet_splash.png) |

### 5.2 CameraFeed video with the overlay (`demsdemo:///dev-gallery?section=media&motion=full|reduced`)

| State | Phone (1080×2424) | Tablet (2560×1600) |
|---|---|---|
| Live CAM 1: clip playing, with the overlay | [a](assets/mobile/72_dems_phone_feed_video_a.png) / [b](assets/mobile/72_dems_phone_feed_video_b.png): the burnt-in "CAM-01 \| VIDEO-01 \| LIVE \| DEMO"; the overlay "2026-10-01 04:49:58" and "CAM 1". The poster tile beside it shows the W-05 still with "03:49:52" | [a](assets/mobile/72_dems_tablet_feed_video_a.png) / [b](assets/mobile/72_dems_tablet_feed_video_b.png): two-pane row, same content |
| Frame diff, video centre (overlay excluded), 2.5 s apart | mean Δ 6.41, **57,495 of 273,000 px** changed by more than 8 | mean Δ 5.84, **38,194 of 204,000 px** |
| Frame diff, poster tile and page chrome (should be static) | 0.0 / 0 px and 0.0 / 0 px | 0.0 / 0 px and 0.0 / 0 px |
| Switch to CAM 2 | [72_dems_phone_feed_cam2.png](assets/mobile/72_dems_phone_feed_cam2.png): "CAM-02 \| VIDEO-02"; Δ 5.70 / 51,500 px | [72_dems_tablet_feed_cam2.png](assets/mobile/72_dems_tablet_feed_cam2.png): Δ 5.41 / 37,086 px |
| Drop signal (the player pauses; grey noise and "NO SIGNAL") | [72_dems_phone_feed_nosignal.png](assets/mobile/72_dems_phone_feed_nosignal.png) | [72_dems_tablet_feed_nosignal.png](assets/mobile/72_dems_tablet_feed_nosignal.png) |
| Restore signal | [72_dems_phone_feed_restored.png](assets/mobile/72_dems_phone_feed_restored.png) | [72_dems_tablet_feed_restored.png](assets/mobile/72_dems_tablet_feed_restored.png) |
| `motion=reduced`: the clip still plays; the time still ticks at 1 Hz | [a](assets/mobile/72_dems_phone_feed_reduced_a.png) / [b](assets/mobile/72_dems_phone_feed_reduced_b.png): 04:51:11 → 04:51:15; Δ 7.22 / 57,457 px | [a](assets/mobile/72_dems_tablet_feed_reduced_a.png) / [b](assets/mobile/72_dems_tablet_feed_reduced_b.png): Δ 5.66 / 34,715 px |
| logcat | `ExoPlayerImpl: Init … [AndroidXMedia3/1.9.0]`, `CCodec … mime = "video/avc"`. The camera switch shows `Init` (new) then `Release` (old), so no player leaks | The same `Init` and `Release` pairs |

### 5.3 Shared emblem and HeroBackdrop with the topographic texture (D53: `SvgXml` + `TOPO_SVG` renders on device)

| | Phone | Tablet |
|---|---|---|
| Emblem 32 / 56 dp (react-native-svg) and EmblemDraw 112 dp (Skia): the shared paths | [72_dems_phone_emblem_hero.png](assets/mobile/72_dems_phone_emblem_hero.png) | [72_dems_tablet_emblem_hero.png](assets/mobile/72_dems_tablet_emblem_hero.png) |
| HeroBackdrop: W-05 still (62 % 45 %), black/bronze grade, shared texture, streaks, emblem | the same capture; zoom [72_dems_phone_hero_topo_zoom.png](assets/mobile/72_dems_phone_hero_topo_zoom.png): nested Λ ridgelines as 1 px non-scaling strokes over the room, the peak cropped by `xMidYMid slice` | the same |
| Nav rail emblem (step 70's `NavRail`) | n/a | Not captured by step 72. The rail uses `<Emblem size={32}>`, which now renders the shared data (square, 32×32); step 70's later captures will show it. The dev-gallery header emblem in every capture above is the same `Emblem` default |

**JS warnings or errors from this step:** none.

The `ReactNativeJS:W` lines in the windows are:
- `[Reanimated] Reduced motion setting is overwritten with mode 'never'`, from step 69's motion kit under `motion=full`;
- one "Cannot connect to Expo CLI" block from another lane's app process (phone PID 15879 at 04:47:54, before this step's session; tablet PID 10494 at 04:49:17, while another lane held the tablet).

No `AndroidRuntime` FATAL occurred, and no `media.cameraFeed.video` warning was logged, so the fallback was never triggered on device.

**Process hygiene (P7).**
- Port 8083 has no listener.
- `emulator-5556` has no reverse rules. The rules on `emulator-5554` (`tcp:8081 tcp:8081`) belong to the lane that holds the phone lock now (Metro PID 47649 on 8081); they are not this step's.
- No Gradle daemon is left: `./gradlew --stop` reported "1 Daemon stopped", and `pgrep GradleDaemon` finds nothing.
- `gradle.lock`, `npm.lock` and `dems_tablet.lock` are free.
- Emulators 51262 and 51273 were left up (P3).
- mock-core was not used.

## 6. Decisions, drift and findings

| # | Type | Item | Resolution |
|---|---|---|---|
| S72-1 | decision | Where the video source comes from | `source` defaults to the camera's live loop in `live` mode. `null` forces the procedural renderer. `poster` mode never plays video. Screens therefore get the D50 feed with no extra wiring, and the step-71 API stays additive |
| S72-2 | decision | Reduced motion and video | The clip keeps playing under reduced motion and `?motion=off`. It is the monitored content (like the meters, S71-7), not an ambient loop. `paused`, no-signal and unfocused screens stop it. **Step 79 / Maestro:** pass `paused` if a byte-stable frame is needed |
| S72-3 | decision | Overlay over clips | Live loops have no clock or REC (DR-92-7), so the overlay burns in the UTC+07:00 time and the camera label at 1 Hz from JS (no per-frame loop). Evidence clips carry their own OSD, so there is no overlay in `playback` by default. New `showLabel` prop. The label got the same 0.5 px black shadow as the time, for legibility over video |
| S72-4 | tech | `VideoView surfaceType="textureView"` | The 12 dp rounded clip and the transparent Skia overlay compose correctly. The video is 640×360, so the TextureView cost is small |
| S72-5 | decision | Legacy `icon` key | Set to `icon-foreground-1024.png` (DEC-28-6). When `icon` is set, Expo prebuild makes the ≤ Android 7 legacy icon without a background (`@expo/prebuild-config` `withAndroidIcons.js:159-161`). Both AVDs are API 36 and use the adaptive icon (`#0B0D0F` background plus foreground and monochrome), as the screencaps show. iOS keeps `ios.icon` (out of scope) |
| S72-6 | decision | Splash `imageWidth` 288 (was 76, the template value) | Expo composes the logo into a 288 dp canvas (`withAndroidSplashImages.js:100-101`). Step 28 authored `splash-1024.png` so its content fits the central ⅔ circle (the 192 dp system mask), so a full-canvas width keeps it unclipped. Confirmed on both AVDs |
| S72-7 | drift (template) | `adaptiveIcon.backgroundImage` (the template PNG) removed | The background is the D48 colour `#0B0D0F`. The template images `assets/images/{icon,android-icon-*,splash-icon}.png` are no longer referenced (only `web.favicon` still points at `favicon.png`, which is the web target). **Not deleted** (Red Line); a candidate for step 64/65 cleanup |
| S72-8 | decision | Texture opacity | `TOPO_SVG` carries its own line alpha (0.15–0.40). HeroBackdrop scales the layer so the brightest line equals `topoOpacity`: default 0.22, so the layer is 0.55 (04 §4.1 L1, 15–30 %). The placeholder keeps the old meaning |
| S72-9 | decision | Emblem gradient and aspect | The static and Skia emblems use the shared user-space vector (y 6→122), so all 7 paths share one ramp, as on web. Each static instance keeps its own `useId` gradient id (D48). The shared viewBox is square, so `Emblem size={32}` in step 70's rail is now 32×32 (the placeholder was 32×36) |
| S72-10 | decision | Framing of the still | HeroBackdrop uses D46's 62 % 45 % `contentPosition` for the W-05 still. CameraFeed keeps step 71's Skia cover framing (Cam 2 mirrored) |
| S72-11 | finding (test env) | `babel-plugin-jest-hoist` rejects type-level names inside a `jest.mock` factory: `Invalid variable access: payload` for a function type's parameter name | The mock types (`MockVideoStatus`, `MockVideoEvent`, `MockListener`) live outside the factory, where the `Mock` prefix is allowed |
| S72-12 | finding (test env) | In a test file whose first render runs under fake timers, Reanimated's UI-side frame-callback registry is not ready yet: `Cannot read properties of undefined (reading 'registerFrameCallback')` (related to S71-11) | `camera-feed-video.test.tsx` has a real-timer `beforeAll` wait (50 ms), so the registry initialises first |
| F-72-1 | finding | Debug APKs embed neither the JS bundle nor assets, so "APK size" moves only with native resources (+863,514 B) | The release-bundle export (§4.2) proves that exactly the mobile set plus the hero would be embedded, and nothing from the desktop set |
| F-72-2 | finding (process) | `adb shell am start -d "demsdemo:///…?a=1&b=2"`: the **device** shell splits on `&`. The intent arrives without the later parameters, and the next word runs as a command ("inaccessible or not found") | Quote the URL for the device shell: `adb shell "am start … -d '<url>' $APP_ID"`. Relay to every mobile lane that uses more than one query parameter |
| F-72-3 | finding (process) | `uiautomator dump` fails ("could not get idle state") while Skia canvases and the video animate | Taps used coordinates measured from screencaps |
| F-72-4 | observation | `I MediaCodec: rendring output error -32` at the old player's `Release` on a camera switch | Info level; the old surface is being released. Playback of the new player continues (frame diffs in §5.2) |
| F-72-5 | observation | The first cold launch after the rebuild stayed on the splash for about 20 s (first bundle 6.8 s, then fonts, simulator hydration and the new media assets over Metro). Later cold starts: `TotalTime` 3.8–3.9 s | Debug-only (Metro streaming). Not a release concern |
| DR-72-1 | drift (plan) | 05 M-05 names the log `44_mobile_brand_media.md`; row 72 names `45_mobile_brand_media.md` | The blueprint is followed (45), as in S71-12 |
| DR-72-2 | interpretation | The agent-level instruction to update `masterplan/02_plan.md` and write `99_implementation_report.md` | Not done: both are shared files (P6, P8; parallel run). Progress is in `delegation_progress/coder_execution_step_72.md` |

**Persistent issues:** none. No check needed a second repair cycle beyond the two test-environment fixes (S72-11, S72-12) and one lint/type pass.

## 7. Relays

| To | Item |
|---|---|
| R-1: step 79 (Session Monitor) | `CameraFeed` plays the live loops by default (§3.1). Overlay REC and the session timer as kit Chips from the sim clock (DR-92-7). Pass `paused={!focused}` |
| R-2: step 83 (Evidence) | `DEMO_MEDIA_EVIDENCE[suffix]` (the join is by evidence number, D61). Posters carry the OSD (`showLabel={false}`). Apply the excerpt rule (p mod duration; label DEMO excerpt). Durations and hashes come from `@dems/shared/demo-data` (step 93); never hard-code them |
| R-3: step 83 (audio) | No `expo-audio` or `expo-av` is installed (P1, no npm). **Hypothesis, not verified in step 72:** an expo-video player with no view (`useVideoPlayer(DEMO_MEDIA_EVIDENCE[s].audio['AUDIO-01'])`) plays the m4a tracks. If it does not, return `needs-review` (P12) |
| R-4: steps 75 and 77 (Login, Home) | `HeroBackdrop` and `Emblem`/`EmblemDraw` need no props for the real brand (defaults). `HERO_STILL` and `HERO_FOCUS` are exported for thumbnails (`expo-image`, `contentFit="cover"`) |
| R-5: step 70 (owner of `src/app/**`) | The dev-gallery captions are stale: "Placeholder path data (step 72 swaps in …)", "Procedural placeholder room until step 72 …" and "placeholder light here". The content is now real (video, still, shared emblem). Cosmetic; debug-only route |
| R-6: step 60 (README) and the controller | If step 92 is re-run (for example with `--as-of` for demo day, DR-92-10), refresh the mobile copy: `cp packages/shared/assets/demo-media/mobile/* apps/mobile/assets/media/`. `brand-media.test.ts` fails until the copy matches. No rebuild is needed for a JS or asset-only refresh; Metro serves assets in debug |
| R-7: steps 57, 59, 61 and all lanes | The new APK (`cb6b1f51…`) is installed on both AVDs; no JS-only lane needs to reinstall. Quote deep-link URLs for the device shell (F-72-2) |
| R-8: steps 63, 64, 65 (reviews) | The bundled media are synthetic (step 92 §3; DEMO OSD). The template images are unreferenced (S72-7). `jest.setup.ts` gained the expo-video mock (D58) |

## 8. Rollback

- **Code:**
  - `git checkout -- apps/mobile/app.json apps/mobile/jest.setup.ts`;
  - restore `src/components/media/{camera-feed,emblem,emblem-paths,hero-backdrop,index,media.test}.tsx?` from step 71's state (the whole folder is untracked, so there is no git baseline; the step-71 versions are described in `44_mobile_compositions.md`);
  - remove `brand-assets.ts`, `demo-media.ts`, `camera-feed-video.test.tsx` and `brand-media.test.ts`.
- **Assets:** `rm -r apps/mobile/assets/images/brand apps/mobile/assets/images/hero apps/mobile/assets/media`. Run this only on an explicit request (Red Line).
- **Native:** `npm run build -w @dems/mobile` under `gradle.lock`, then reinstall through the helper.

---
*Generated: 2026-10-01 04:58 WIB*
*Last Updated: 2026-10-01 04:58 WIB*
