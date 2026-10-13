---
task_id: 2026-10-12_input_av_core_adapter_plan
row: 12
package: M1 / WP-01 (experiment E-8, playback half)
date: 2026-10-13
agent: test-expert
status: needs-review
tier: T2
---

# Row 12 - E-8, playback half: one sealed development session from a generated HEVC source

Status `needs-review`: the seal, the web console and the export were run and measured; **the tablet part was NOT RUN** (section 6). Row 89 is not named as a carrier for the session itself: the session was made without any product change.

## 1. Result

| Question | Answer | Evidence (files under `.cache/task4-row012/out/`) |
|---|---|---|
| Does an HEVC session SEAL | **yes**: session `SES-20261013-0024`, item `EV-20261013-0014`, six seal steps `done`, state `SEALED`, manifest version 2 | `facts.json` (`finalization`, `sessionState`), `session-manifest.json` |
| Does it VERIFY | **yes**: operation verify 200, `ok true`, `overall PASS`, V-01 to V-15 all `PASS`; the receiver's command on the export: X-01 to X-07 `PASS`, `RESULT: PASS` | `verify.json`, `verify-export.txt` |
| Notice `STREAM_PROFILE_DIFFERS` | **raised**, once, for both tracks: `VIDEO-01:HEVC_720P:H264_720P30,VIDEO-02:HEVC_720P:H264_720P30`. Why: the selector line of a generated source states the generated adapter's profile `H264_720P30` (written at every development boot, log code `DEV_GENERATED_SOURCE_PROFILE_STATED`; `apps/core-server/src/capture/fence/fake-profile.ts`, `generated-sources.ts:90`), and the stream stated HEVC: the codec differs. It is an alert of kind SYSTEM (WARNING, already resolved) and the item member `streamProfileNotice`; it is NOT in the verify answer's `notices` (that list holds `AUDIT_EXTRACT_NOT_SIGNED` only) | `facts.json` (`alerts`, log code `SEALING_STREAM_PROFILE_DIFFERS`), `evidence-item.json` |
| What the sealed manifest states | per track `codec: "HEVC"` (field 43), `profile: "HEVC_720P"` (field 36), `mediaType: "video/mp4"`. **No rate** in the code and no member that holds a rate, a picture size or a sample-entry name. Agrees with the reader half (codec HEVC, rate null); here 720p because the generated picture is 1280x720 | `session-manifest.json` (`tracks[]`; its keys are listed in section 4) |
| Sample entry of the sealed file | **`hev1`** (both camera files; read from the export's decrypted files, whose SHA-256 equal the manifest's `sha256Plain`) | `ffprobe-export.txt` |
| Web console, the app's own player | **PLAYS**: two `video` elements, 1280x720, `readyState 4`, `error null`, position 10.1 s of 12.8 s ten seconds after Play, 263 and 265 frames presented, picture not empty (the generated colour bars are on the screenshot). Chrome 154 headless on this Mac only (section 5) | `web-result.json`, `web-21-player-playing.png` |
| Tablet app's player | **NOT RUN** (section 6). Read, not run: the app plays through `expo-video` 57 and takes a player status `error` to its own error path (`apps/mobile/src/features/evidence/sealed-player.tsx:453-454`; `expo-video` in `apps/mobile/package.json:52`) | - |
| Export | **made and readable**: job `EXPJ-000032` `COMPLETE`, archive 11,578,056 bytes; `ffprobe` reads both files as hevc Main / `hev1`, 1280x720, 336 frames; `ffmpeg` decodes both with exit 0 (the 51 lines of VIDEO-02 are timing lines of the null muxer, section 4.3) | `export.zip`, `export-job.json`, `ffprobe-export.txt`, `decode-VIDEO-0n.log` |
| A general (QuickTime-style) player and `hev1` | **measured once, on this Mac, with the system's own tools, not with QuickTime Player**: the QuickLook thumbnail tool did not return for the exported `hev1` file (stopped after 4 min 44 s, no thumbnail) and made a thumbnail at once for a stream copy of the same file tagged `hvc1`. That Apple's players need `hvc1` stays a **hypothesis** beyond this one observation (section 4.4) | `qt/` |
| Does anything name H.264 on screen for this session | "H.264": **0** times on the item page (three tabs, player closed, opened, playing), the dashboard and the evidence list. "H264": only inside the notice sentence, as the CONFIGURED profile `H264_720P30` (twice per page). The sealed format line reads `VIDEO-01 HEVC_720P VIDEO-02 HEVC_720P`. The live session monitor during the recording was not on screen (section 6) | `web-result.json` (step "codec words on screen"), `web-*.txt` |

Named outcome for row 14: **E-8 playback half: an HEVC development session seals and verifies; the manifest states `HEVC` / `HEVC_720P` without a rate; sample entry `hev1`; the web console (Chrome on macOS) plays it; the export decodes; the notice is raised because the generated source's configured code is H.264; tablet not run.**

For row 56: nothing here asks for the reader change beyond what row 11 found (the manifest states no rate; the stream declares one - `ffprobe` `r_frame_rate 30/1` on VIDEO-01). For row 57: the stored sample entry is `hev1`; Chrome and FFmpeg accept it; one macOS system tool did not, and accepted `hvc1`.

## 2. What was run, and what it is

One scripted session, three starts (two stopped at the pre-check within 12 s, section 7). The successful one: 08:56:54 to 08:59:31 WIB, under the heavy-host lock and the db lock.

```
# from the repository root, command sandbox off
/usr/bin/lockf -k -t 3000 .locks/heavy-host.lock /usr/bin/lockf -k -t 900 .locks/db-migrate.lock sh .cache/task4-row012/session.sh
```

`session.sh` starts, in this order, and stops all of it:

1. the runner `E8_PLAYBACK=1 npx vitest run --config .cache/task4-row012/vitest.config.ts` (one file, `.cache/task4-row012/e8_playback.db.test.ts`);
2. `DEMS_CORE_PROXY_PORT=4423 VITE_DEMS_CORE_MODE=live npx vite --host 127.0.0.1 --port 5178 --strictPort` in `apps/core-web`;
3. `node .cache/task4-row012/browser.mjs http://127.0.0.1:5178 .cache/task4-row012/out` (Google Chrome headless over the DevTools protocol, port 9334, a profile directory of its own).

Afterwards, outside the session:

```
unzip -q export.zip -d export
/usr/bin/lockf -k -t 900 .locks/heavy-host.lock sh -c '... ffprobe -v error -show_entries stream=... -count_frames -of json <file>; ffmpeg -hide_banner -nostdin -v error -i <file> -map 0 -f null - ...'
npm run -s evidence:verify-export -- .cache/task4-row012/out/export.zip --sha256 b2f606b0c5bd1cf8f0c4ac77a7989ae4ef7ce3a3ee5844b1586cae56e18d24b0
ffmpeg ... -i export/fragments/VIDEO-01.mp4 -map 0 -c copy -tag:v hvc1 -movflags +frag_keyframe+empty_moov+default_base_moof qt/VIDEO-01-hvc1-frag.mp4
/usr/bin/qlmanage -t -s 320 -o qt <file>;  /usr/bin/avmediainfo <file>
```

**The Core** is the product's app factory with every unit (`buildApp`), in capture operation `REAL_DEVELOPMENT`, built the way the existing runner check `apps/core-server/src/capture/fence/__tests__/e2e/development-session-e2e.db.test.ts` builds it; this row's runner is derived from that file. Its database is a THROW-AWAY database of the test helper (`dems_test_local_tmtpevcj_f02_r012_e8`, cloned from the helper's seed template, dropped at the end); its data directory, development signing key and media store are its own (`.cache/task4-row012/data-84896/`). The release worker `apps/capture-worker/build/capture-worker` (`capture-worker/0.6.0`) was started by the Core as it is.

**The sources** are the four built-in generated sources (`CAM-01`, `CAM-02`, `MIC-01`, `MIC-02`, adapter kind `FAKE`; asserted before the start, `selector-before.json`). No camera and no microphone of this Mac was opened.

**The four fixtures, none a product file** (all under `.cache/task4-row012/`, git-ignored):

| Fixture | What it does | Why |
|---|---|---|
| `ffmpeg-hevc` (helper program of this Core, `captureHelperFfmpegPath`) | hands every call to `.data/helpers/ffmpeg` unchanged, except the camera push (`-f rtsp` with `-c:v libx264`): there `libx264` becomes `libx265 -x265-params scenecut=0:keyint=30:min-keyint=30:bframes=0:log-level=error`; every other argument is the product's (`wrapper-calls.log`, `pushers-while-recording.json`) | the encoder is a literal of `apps/core-server/src/capture/adapters/local/camera-helper-args.ts:54`; no environment key selects it. The wrapper passes the helper's path rule as any private program does |
| a module replacement of `apps/core-server/src/capture/ingest-address.ts` inside the runner | the two ingest ports are 8559 and 8561 instead of 8554 and 8556 | the ports are constants (`ingest-address.ts:30`); driver rule 8 forbids 8554 / 8556 and lane 2, a development-capture Core, was running. DRIVER DECISION 2 |
| the runner opens the listener `127.0.0.1:4423` itself, after the seal | so that a browser can reach the Core | a listening Core takes its tablet link from a connected paired app; without one the pre-check blocks (section 7). The session was recorded as the e2e check records it: no listener, the link set through the engine's own door `setTabletLink('CONNECTED')`. DRIVER DECISION 3 |
| the browser gets the session cookie of the runner's own sign-in | no credential is typed into a page | the runner signs in with the seed's published demo operators through the test support, as the e2e check does |

## 3. The session

| Fact | Value |
|---|---|
| Pre-check (attempt 3) | outcome `PASS`, state `ARMED` without an acknowledgement: `CORE`, `LENS_1`, `LENS_2`, `MIC_PRIMARY`, `MIC_STANDBY`, `STORAGE` PASS; `TIME` and `SECURITY` WARN (`precheck.json`); start 200 |
| Camera pushes while recording | two, `libx265`, to `rtsp://127.0.0.1:8559/SES-20261013-0024/video-01/...` and `...:8561/.../video-02/...` (the last path element withheld) |
| Recorded | 10 s after the first durable fragment; no fault active while recording or after |
| Fragments | manifest: VIDEO-01 6, VIDEO-02 5 (database rows while recording: 5 and 4) |
| Seal | `CLOSE_TRACKS`, `FINALIZE_HASHES`, `FINALIZE_TRANSCRIPT` (transcription off), `BUILD_MANIFEST`, `SIGN_MANIFEST`, `STORE_SEALED_PACKAGE`: all `done`; sealed within 1 s of the stop |
| Log codes of the run | `CAPTURE_CLOCK_OFFSET_MEASURED`, `CAPTURE_FIRST_VIDEO_HELD`, `CAPTURE_SYNC_LEVEL`, `SEALING_FIRST_VIDEO`, `SEALING_STREAM_PROFILE_DIFFERS`, `SEALING_COMPLETE`, `SEALING_CAPTURE_FACTS_REMOVED`; no refusal, no `CAMERA_FILE_UNUSABLE` |
| Item | `status SEALED`, `integritySource REAL`, `developmentSources true`, signature Ed25519 with the development key, `files[].profile HEVC_720P`, `media.source LIVE_STREAM`, `access.play true` |

## 4. Manifest, export, players

### 4.1 Manifest (`session-manifest.json`, the signed file of the package)

Keys of a track: `avOffsetMs, bytes, clockOffsetMs, codec, deviceId, durationMs, file, firmware, firstVideoSamplePts, firstVideoSampleTimescale, fragmentChainHead, fragmentCount, keyframeAligned, mediaType, model, name, profile, sha256, sha256Plain, sourceClass, trackId`.

`VIDEO-01`: `codec HEVC`, `profile HEVC_720P`, `mediaType video/mp4`, `durationMs 12756`, `fragmentCount 6`, `keyframeAligned true`, `sourceClass FAKE`, `clockOffsetMs 0`. `VIDEO-02` the same with `durationMs 12758`, `fragmentCount 5`. Top level: `manifestVersion 2`, `developmentSources true`, `demo false`, `notice "DEVELOPMENT - sealed by a Core in development capture mode; ..."`.

### 4.2 Web console

Page `http://127.0.0.1:5178/evidence/EV-20261013-0014`, signed in as the seed's Supervisor, Live mode (`web-02-detail.png`). Tabs Media, Metadata, Hash & Integrity captured as text and picture (`web-03` to `web-05`). Then "Open playback" and "Play" were pressed.

| Read from the page | VIDEO-01 | VIDEO-02 |
|---|---|---|
| after "Open playback" | `readyState 4`, 1280x720, duration 12.756589, `error null` | the same, duration 12.757789 |
| 1 s after Play | position 0.92 s, not paused | 0.96 s |
| 7 s after Play | position 6.92 s, frames 166 (50 dropped) | 6.96 s, 167 (35 dropped) |
| 10 s after Play | position 10.15 s, frames 263 (61 dropped) | 10.19 s, 265 (35 dropped) |
| one frame drawn to a canvas | mean 127, 109 distinct colours | mean 127, 115 |

The media route answered `206`, `content-type: video/mp4` (no `codecs` parameter), for every request. The browser's own statement: `canPlayType` "probably" and `MediaSource.isTypeSupported` true for `avc1.42E01F`, `hev1.1.6.L93.B0` and `hvc1.1.6.L93.B0`. No console error or warning. The eight `net::ERR_ABORTED` entries are cancelled media range requests (`canceled: true`), not failures.

On screen for this item: "SEALED FORMAT (SIGNED MANIFEST) VIDEO-01 HEVC_720P VIDEO-02 HEVC_720P" and the warning "The Core noted for this session that the recorded stream differs from the configured profile: VIDEO-01 recorded HEVC_720P, configured H264_720P30; VIDEO-02 recorded HEVC_720P, configured H264_720P30." Chips: Exported, Core record, Development source.

### 4.3 Export

Archive SHA-256 `b2f606b0c5bd1cf8f0c4ac77a7989ae4ef7ce3a3ee5844b1586cae56e18d24b0`, equal to the job's `archive.sha256`. Entries: the manifest, signature, certificate, audit extract, `fragments/VIDEO-01.mp4`, `fragments/VIDEO-02.mp4`, `fragments/fragments.json`, the export manifest and its signature.

| File | Bytes | SHA-256 (= manifest `sha256Plain`) | ffprobe | Decode to null |
|---|---|---|---|---|
| `VIDEO-01.mp4` | 5776171 | `785f7ed8...3c7074` | hevc, Main, `hev1`, 1280x720, yuv420p, `r_frame_rate 30/1`, 336 frames, extradata 109; aac LC `mp4a`, 596 frames | exit 0, 0 lines |
| `VIDEO-02.mp4` | 5776383 | `5ded400d...a9bf3f` | hevc, Main, `hev1`, 1280x720, `r_frame_rate 30000/1001`, 336 frames; aac LC | exit 0, 51 lines, all "non monotonically increasing dts to muxer in stream 0" |

The 51 lines are written by the null muxer when it re-times a variable-rate picture to the rate it guessed; a stream copy of the same video to null gives 0 lines, and all 336 frames are read. It is the timing property of a source stamped with the wall clock that `camera-helper-args.ts:57-61` describes for the H.264 source too. Not compared with an H.264 session in this row.

### 4.4 `hev1` and Apple's players

| File | `avmediainfo` | QuickLook thumbnail (`qlmanage -t`) |
|---|---|---|
| as exported (`hev1`, fragmented) | reads it: "HEVC (Parameter Sets in Bitstream) 'hev1'" | **did not return**; stopped by this row after 4 min 44 s; no thumbnail |
| stream copy tagged `hvc1` (still fragmented) | "HEVC 'hvc1'" | thumbnail made at once |

One run each; macOS 27.0.1, arm64. QuickTime Player itself was not opened (an agent shell cannot open an application). Hypothesis, supported by this one observation and not proven: a general player built on AVFoundation needs `hvc1`; if the export is meant for such a player, the tag is a muxer option of the worker (`-tag:v hvc1` in FFmpeg terms), and whether the pinned muxer writes the parameter sets into `hvcC` as `hvc1` requires is not shown here.

## 5. Doubles and limits

- The source is libx265 through FFmpeg on this Mac (Main, 8 bit, GOP 30, no B-frames, parameter sets announced). A camera's HEVC is `9A/H-17`, `9A/H-20`.
- The web console was measured in ONE browser: Chrome 154 headless on macOS arm64, which decodes HEVC through the system. A browser without an HEVC decoder was not available; **what the player says when it cannot play was not exercised** (the path exists: `apps/core-web/src/features/evidence/sealed-player.tsx:724, 761`).
- The no-notice case (a configured `HEVC_...` code over an HEVC stream) was not sealed: a generated source's configured code is rewritten to `H264_720P30` at each development boot. It rests on the reader half's function call (row 11).
- Linux and another libavformat build: not here.

## 6. Not run, and why

| Not run | Why |
|---|---|
| **The tablet (or phone) app's player** | Both running emulators hold the user's standing set-up: `emulator-5556` (tablet) maps `tcp:4420 -> 4422` and its app is paired with lane 2 (`DEV-0001`); `emulator-5554` (phone) maps `tcp:4420 -> 4421`, paired with lane 1 (`DEV-0002`). Playing this row's item needs the app paired with this row's throw-away Core, which replaces the app's stored pairing; an agent cannot restore it without issuing a code on the user's lane. `device-session.sh` would also remove the `tcp:4420` rule at its end. `phone2` is down: a cold boot, a Metro bundle, a typed pairing code and sign-in and the way to the player is an exploratory device session, far beyond a short hold of the heavy-host lock while other agents waited for it. Not attempted; the device session at the M-gate (blueprint profile line of row 12) is where it fits |
| The live session monitor during the recording | the listener was opened after the seal (section 2). `apps/core-web/src/features/session-monitor/live-feed-panel.tsx:49` and `components/media/camera-feed.tsx:64` document an overlay example "1080p • 25 fps • H.264"; whether a real-capture Core shows it for an HEVC session is not measured |
| Lane 3 | its database is at schema version 6; the lane script's reset refuses it (`RESET_SCHEMA_MISMATCH`, `apps/core-server/src/db/reset/routine.ts:1104-1116`; `db:status` of `dems_lane_3`: "at schema version 6 (dbc-7); this code expects 7 (dbc-8)") and names `db:migrate`, which decision C29 keeps from the lane databases. Nothing of lane 3 was touched. DRIVER DECISION 1 |
| A second run, a control session in H.264 | one run, as the test-depth rule says |

## 7. Run history, rules kept, driver decisions

- Attempt 1 (08:55:31) and attempt 2 (08:56:17, with diagnostics): the runner opened its listener before the session and the pre-check ended `BLOCK` on `CORE` (`value OFFLINE`, `reasonCode CORE_OFFLINE`, "Core link offline"; read from attempt 2's `precheck.json`, which attempt 3 then overwrote - what is left of attempt 2 on disk is `precheck-acknowledge.json`: 409 `INVALID_STATE`, "The pre-check has no warning to acknowledge."); stopped after 10 s and 12 s, nothing recorded, the throw-away databases dropped. Attempt 3 is the result.
- **Heavy-host lock: one hold that was too long, my fault.** The `qlmanage` call of section 4.4 hung while the lock was held: about 5 minutes (09:01 to 09:06), with three other agents waiting. I stopped the process; the lock was released. The other holds: 11 s, 12 s, 2 min 37 s, and two probes of a few seconds.
- No product file, no test file of a workspace, no lane, no lane database and no emulator was changed, stopped or restarted. The emulators' reverse rules are as they were (`tcp:4420 -> 4422` and `-> 4421`, read before and after). Read-only device queries only (`reverse --list`, `dumpsys window`, `getprop`, a `grep` over the codec lists). No commit.
- Left on disk, all under `.cache/task4-row012/` (59 MB, git-ignored): the fixtures, `out/` (captures, the export, logs) and three data directories `data-83136`, `data-84295`, `data-84896` (each with a development signing key; the third with the sealed package). The browser's profile directory was deleted. No process, no listener (4423, 5178, 9334, 8559, 8561 free), no database.
- Written: this record, `delegation_progress/row_012.md`, one line in `delegation_progress/file_claims.md` (Edit tool).
- DRIVER DECISION 1: a throw-away database with a listener of the runner on 4423 (the stopped spare lane's port), instead of lane 3.
- DRIVER DECISION 2: the ingest ports moved to 8559 / 8561 by a module replacement in the runner.
- DRIVER DECISION 3: the session recorded without a listener, the tablet link set through the engine's door, as the existing e2e check does.
- DRIVER DECISION 4: the tablet part reported as not run rather than re-pairing a device the user has set up.
