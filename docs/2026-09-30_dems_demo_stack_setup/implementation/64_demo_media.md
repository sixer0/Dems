---
task_id: 2026-09-30_dems_demo_stack_setup
blueprint_row: 92
date: 2026-10-01
agent: coder-execution
narrative_tier: 3
status: complete
source_plan: identification/02_structured.md row 92; Parallel Execution Protocol P1–P13
decisions: D28, D46, D50, D51, D54, D61
---

# 64: Demo media (blueprint step 92)

Run on 2026-10-01 from 02:49 to 04:05 WIB, from `/Users/gsp-budi/Documents/DEMS`. **Outcome: PASS.** Every row-92 check passes (§1).

**Outputs**
- `packages/shared/scripts/gen-demo-media.ts` (1,551 lines, SHA-256 `f9d4cd8f…d282e`).
- `packages/shared/assets/demo-media/`: 198 files, 43,564,652 B (41.55 MiB); `du -sk` = **42,876 KB**.
  - 13 evidence items (EV 0001–0013).
  - Live loops for the recording scenario (session 0024).
  - A 640x360 mobile subset.
  - `media-index.json` and `README.md`.

**Host changes**
- Homebrew gained 14 formulae (`ffmpeg` and `espeak-ng` plus 12 dependencies). No existing formula changed version. The rollback is in §2.

**Not written by this step:** `THIRD_PARTY_NOTICES.md` (step 37 appended its own section at 03:23; §1), every `package.json` and lockfile, the simulator source and every other repository path (P6). No npm install ran, no long-lived process was started, and nothing was committed.

## 1. Row-92 verification

| Row-92 check | Result | Evidence |
|---|---|---|
| ffprobe on every file: videos h264 1280x720 at 25 fps; the mobile subset at its recorded lower size; audio AAC; durations listed | **PASS** | §6 table: 28 desktop videos are `h264 High 1280x720 25/1`, 28 mobile videos are `h264 Main 640x360 25/1`, 56 audio files are `aac` mono (48 kHz desktop, 24 kHz mobile). No video carries an audio stream. The 84 JPEGs are grouped in §6.2. Helper summary: `SUMMARY files=198 videos=56 (bad desktop 0, bad mobile 0) audio=56 (bad 0) pairs=28 pairFails=0 videoWithAudioStream=0` |
| Each session has two separate audio files whose durations match its video within 0.1 s | **PASS** | 28 pairings (14 items × desktop and mobile), all `maxDelta 0`. AUDIO-01 and AUDIO-02 are different files with different SHA-256 values. Separation on EV 0001: during the interviewer line, MIC 1 is −25.0 dB and MIC 2 −49.1 dB; during the subject line, MIC 2 is −20.3 dB and MIC 1 −45.2 dB |
| `du -sk` of demo-media ≤ 61,440 KB | **PASS** | `42876 /Users/gsp-budi/Documents/DEMS/packages/shared/assets/demo-media` (evidence 28,320; mobile 12,468; live 2,000; index 80; README 8) |
| Frame grabs at 1 s and at the loop point show the OSD (linked) | **PASS** | §7: 12 PNGs in `implementation/assets/92_*.png`. At 1 s the OSD shows the WIB timestamp, blinking REC, camera, room and "DEMS-IR-01 \| DEMO". At the loop point, frames 949 and 0 show the live OSD "CAM-0x \| VIDEO-0x \| LIVE \| DEMO" |
| A second run gives the same file list and the same durations | **PASS (stronger: same bytes)** | Run 4 (repo) and run 5 (`--out` scratch, same command): `file list identical: true 198 198`, `duration mismatches: 0`, `sha256 mismatches: 0`. After the last script edit, a preview of EV 0001 and the live loop matched the published bytes for 28 of 28 files |
| THIRD_PARTY_NOTICES.md unchanged unless a new licensed source was used | **PASS (not written by step 92)** | No new licensed source entered the repository (§3), so no row was due. At 03:22 the file had mtime 02:16:26 (step 29), SHA-256 `bd66ebd0…`. At 04:06 it has mtime 03:23:43, SHA-256 `4c5cbdfd…`: step 37 appended "## Magic UI and Motion Primitives items (step 37)", following P6's owner order 29 → 37 → 92. `grep -i "demo-media\|espeak\|ffmpeg\|step 92"` finds nothing |
| Homebrew rollback list and voice recorded | **PASS** | §2 (14 formulae, exact uninstall command) and §3 (eSpeak NG 1.52.0 `id`; the variant for each track is in `media-index.json` `voices`) |

**Extra checks**

| Check | Result |
|---|---|
| `npm run typecheck -w @dems/shared` (03:58, after step 32 landed) | exit 0. An earlier run at 03:23 failed only in step 32's in-progress `test/audio.test.ts` (22 errors, none in this step's file). That was P11 noise, and the re-run is clean |
| `npm run lint -w @dems/shared`; `oxlint --format default scripts/gen-demo-media.ts` | exit 0; "Found 0 warnings and 0 errors." |
| `npm test -w @dems/shared -- --maxWorkers=2` (regression only; this step adds no tests) | `Test Files 22 passed (22)`, `Tests 375 passed (375)` |
| Media distinct per item | 112 A/V files, 112 distinct SHA-256 values |
| Loop seam (live VIDEO-01 / VIDEO-02) | SSIM from frame 949 to frame 0 is 0.9641 / 0.9710. The in-stream keyframe transition 124→125 is 0.9650 / 0.9715, so the seam is indistinguishable from an ordinary GOP boundary. Mid-GOP neighbours score 0.9996. Motion, the scanline period and the OSD are periodic in the loop length |
| OSD time matches the dataset | EV 0001 starts at 2026-09-29 09:17:00 WIB; the grab at 1 s reads 09:17:01. EV 0013 starts at 2026-10-01 09:19:57; the grab at 1 s reads 09:19:58 |
| Audio levels | Peaks −4.9 to −7.9 dBFS, mean about −27 to −31 dB, room tone about −52 dBFS RMS before EQ |
| Error paths | `--as-of 2026-13-99`, `--as-of 2026-10-01T25:00`, `--as-of 1-10-2026`, `--voice robot`, and `--only` without `--out` each exit 1 with a structured error entry and create no output or temp folder |
| Synthetic-voice fallback (`--voice synthetic`, preview only) | Works: live tracks 36.000 s on all four files; `tools.voice` is `synthetic` |

## 2. Host install (Homebrew; P10 per-command sandbox bypass; the only Homebrew user in this phase)

**Why two install commands.** `brew install --dry-run ffmpeg espeak-ng` reported "Would upgrade 3 dependencies for ffmpeg: ca-certificates, openssl@3, xz". Those three are already installed and shared with other host tools (git, python). R40 says "nothing else touched". So:

1. The 12 missing dependencies were installed explicitly. A dry run confirmed that this upgrades nothing.
2. `ffmpeg` and `espeak-ng` were installed with `--ignore-dependencies`. Homebrew prints "unsupported Homebrew developer option" for this flag. All their dependencies were already present at that point.
3. The 12 dependencies were re-marked `--no-installed-on-request` with `brew tab`, so `brew leaves` shows only the two new leaves.

Every brew call ran with `HOMEBREW_NO_AUTO_UPDATE=1 HOMEBREW_NO_ANALYTICS=1 HOMEBREW_NO_ENV_HINTS=1 HOMEBREW_NO_INSTALL_UPGRADE=1 HOMEBREW_NO_INSTALL_CLEANUP=1`.

| Time (WIB) | Command | Result |
|---|---|---|
| 02:49 | `brew list --formula -1` (before) | 52 formulae |
| 02:52 | `brew install --dry-run ffmpeg espeak-ng` | would install 13 and **upgrade 3** (ca-certificates, openssl@3, xz), so this path was rejected |
| 02:52 | `brew install --dry-run dav1d mpg123 lame libvmaf libvpx opus sdl3 sdl2-compat svt-av1 x264 x265 pcaudiolib` | would install 12, upgrade none |
| 02:53:26–02:53:30 | `brew install dav1d mpg123 lame libvmaf libvpx opus sdl3 sdl2-compat svt-av1 x264 x265 pcaudiolib` | exit 0; 12 bottles poured |
| 02:53:34–02:53:41 | `brew install --ignore-dependencies ffmpeg espeak-ng` | exit 0; `ffmpeg/9.0.2: 290 files, 53.9MB`, `espeak-ng/1.52.0: 538 files, 26MB` |
| 02:55 | `brew tab --no-installed-on-request <the 12>` | exit 0; `brew leaves` shows ffmpeg and espeak-ng as the only new leaves |
| 02:55 | `brew list --formula -1` (after) | 66 formulae (+14, −0) |
| 02:55 | `brew list --versions` before vs after, restricted to the 52 pre-existing formulae | `diff` empty: **no pre-existing formula changed version** |

ffmpeg 9.0.2 therefore runs against the installed openssl@3 3.6.4 and xz 5.8.3, while its bottle lists 3.6.5 and 5.8.4. These are patch releases with the same sonames. `ffmpeg -version` and every encode in this step ran cleanly.

**Formulae added (14; this is the exact rollback list):**

| Formula | Version | Licence (Homebrew) | Role |
|---|---|---|---|
| ffmpeg | 9.0.2 | GPL-3.0-or-later | encoder and prober (leaf) |
| espeak-ng | 1.52.0 | GPL-3.0-or-later | TTS (leaf; D51) |
| dav1d | 1.5.4 | BSD-2-Clause | ffmpeg dependency |
| lame | 4.0 | LGPL-2.0-or-later | ffmpeg dependency |
| libvmaf | 3.2.1 | BSD-2-Clause-Patent | ffmpeg dependency |
| libvpx | 1.17.0 | BSD-3-Clause | ffmpeg dependency |
| mpg123 | 1.33.7 | LGPL-2.1-only | dependency of lame |
| opus | 1.6.1 | BSD-3-Clause | ffmpeg dependency |
| pcaudiolib | 1.3 | GPL-3.0-or-later | espeak-ng dependency |
| sdl2-compat | 2.32.72 | Zlib | ffmpeg dependency |
| sdl3 | 3.4.16 | Zlib | dependency of sdl2-compat |
| svt-av1 | 4.2.0 | BSD-3-Clause | ffmpeg dependency |
| x264 | r3222 | GPL-2.0-or-later | ffmpeg dependency |
| x265 | 4.3 | GPL-2.0-or-later | ffmpeg dependency |

Footprint: the Cellar holds 133,844 KB (`du -sk /opt/homebrew/Cellar/<14>`). The bottle cache holds about 51 MB in `~/Library/Caches/Homebrew/downloads/`.

**Rollback** (run outside the sandbox; it removes exactly what step 92 added):

```sh
HOMEBREW_NO_AUTO_UPDATE=1 brew uninstall ffmpeg espeak-ng dav1d lame libvmaf libvpx mpg123 opus pcaudiolib sdl2-compat sdl3 svt-av1 x264 x265
# optional: remove the 14 downloaded bottles
rm -f ~/Library/Caches/Homebrew/downloads/*--{ffmpeg,espeak-ng,dav1d,lame,libvmaf,libvpx,mpg123,opus,pcaudiolib,sdl2-compat,sdl3,svt-av1,x264,x265}--*.bottle*.tar.gz
```

Do not use `brew autoremove` as the rollback: it would also remove any unrelated orphans that were already on the host. After a rollback, the media stay valid, but the generator needs ffmpeg again to regenerate them.

**Capability finding.** Homebrew's slim `ffmpeg` 9.0.2 has no `drawtext` filter: its configure line has no `--enable-libfreetype`, and `ffmpeg -filters` lists no drawtext.
- The OSD is therefore rasterised by the generator from a hand-authored 5x7 bitmap font and overlaid as PNG layers.
- `ffmpeg-full` was not installed, because its dependency tree is much larger (R40).
- A side benefit: no system-font glyphs are embedded in the media.

## 3. Voice ruling (D51) and provenance

| Option (D51 order) | Checked | Verdict |
|---|---|---|
| macOS `say` / System Voices | not used | Excluded by D51 (the output licence is personal, non-commercial; this is a client demo) |
| **Piper** (MIT) with an Indonesian model | `voices.json` in `rhasspy/piper-voices` (177 voices) has exactly one `id` voice, `id_ID-news_tts-medium`. Its MODEL_CARD reads "Dataset URL: https://www.kaggle.com/code/mpwolke/indic-tts-malayalam-speech-corpus · License: See URL · Finetuned from U.S. English lessac voice". The `lessac` MODEL_CARD links the Blizzard 2013 licence, which grants use "exclusively for Research Purposes only" (clause 3.2, https://www.cstr.ed.ac.uk/projects/blizzard/2013/lessac_blizzard2013/license.html) | **Rejected.** The model licence cannot be verified as permissive: the dataset link is a notebook about a Malayalam corpus, and the base voice is research-only. The repository-level `license: mit` covers the repository, not each voice's dataset rights |
| **eSpeak NG** 1.52.0 `id` voice (`poz/id`) | Homebrew bottle. `espeak-ng --voices=id` lists `poz/id` (formant) and `mb/mb-id1` (MBROLA: not installed, not used) | **Used.** Formant synthesis has no recorded human samples, so no dataset licence applies. GNU GPL FAQ #GPLOutput: "the copyright status of the output inherits that of the input it was generated from"; the input is the generator's own fictional script |
| Speech-like synthetic fallback | Implemented (`--voice synthetic`, or automatic when espeak-ng is missing); preview-tested | Not used in the published media |

**Voices per track** (the full list is in `media-index.json` `evidence[].voices`):

| Role | Voice |
|---|---|
| AUDIO-01 (MIC 1, interviewer) | `id+m3` (AKP Budi Santoso) or `id+m7` (AKP Andi Pratama) |
| AUDIO-02 (MIC 2, subject) | chosen by the first name's gender: female `f4`, `Annie` or `Andrea`; male `m2`, `m4` or `m6`. Pitch and rate derive from the session number |

**Finding F-92-1.** eSpeak NG variants that use `breath` (f2, f3, f5, Alicia, whisperf) seed their noise from the wall clock.
- Proof: `f2` rendered 1.3 s apart gave SHA-256 `c5b7c840…` vs `55502177…`, while `f4`, `Annie`, `Andrea`, `f1`, `linda` and `m2`–`m7` rendered identically.
- Effect: run 2 differed from run 1 only in the audio of the five female subjects.
- Fix: those variants are excluded, and the code comment records why.

**Post-processing** (per MIC, in this order):
1. Mixed in Node from the talker, a faint bleed of the other talker (−24 dB, low-passed at 2.4 kHz, 3 ms later) and seeded room tone (loops cross-fade the tail into the head).
2. Filtered in ffmpeg: high-pass 90 Hz, a mic-specific body and presence EQ, low-pass 7.8 kHz, and light early reflections (`aecho` 17/33/53 ms).
3. Encoded as AAC mono: 48 kHz at 48 kbps (desktop) and 24 kHz at 32 kbps (mobile). MIC 1 and MIC 2 stay separate files and are never mixed (design book §6.3).

**Content.** All incidents are fictional and neutral: a lost wallet at a market, a parking scrape, a bumper touching a fence, a phone left on a bus, a parcel mix-up, a shopping-trolley scratch, a slow bumper touch at a crossing, and today's follow-ups in those same cases.
- Names come only from the canonical dataset (subject and investigator). Generic roles ("petugas parkir", "resepsionis") are not names.
- Every recording opens with "Rekaman ini adalah simulasi untuk demonstrasi."
- The OSD and the MP4/M4A title and comment metadata say DEMO.
- No date or greeting is spoken, so the audio does not depend on `--as-of`.

**THIRD_PARTY_NOTICES.md: unchanged.**
- The pictures derive from the step-29 hero still, which is already listed.
- The OSD font is original.
- The voices are generated at build time; the repository holds no eSpeak data or voice model.

## 4. Generator design (`packages/shared/scripts/gen-demo-media.ts`)

- **Run command:** `cd packages/shared && node --import tsx scripts/gen-demo-media.ts [--as-of YYYY-MM-DD[THH:MM]] [--voice auto|espeak|synthetic] [--out <dir>] [--only <session suffixes>] [--keep-temp]`.
  - It uses only Node built-ins, the ffmpeg/ffprobe CLI and the espeak-ng CLI (P1, D49). No package.json script was added.
  - `--out` and `--only` write a preview elsewhere; `--only` refuses to run without `--out`.
- **Data source:** it reads `buildHistory(now)`, `RECORDING_SCENARIO`, `IDLE_COUNTERS`, `OPERATORS` and `sessionIdFor` from `src/sim/dataset.ts` at run time, so the media follow any dataset revision.
  - `now` is `--as-of` in WIB, default `2026-10-01T10:00`; a date alone means 10:00 WIB.
  - All runs here used dataset.ts at mtime 03:02:34, SHA-256 `d73e24a4…` (step 32's final version).
- **Pictures:**
  - The step-29 still `room-2560.jpg` is cropped (Cam 1: the full-width 16:9 band at y 120, D46 object position; Cam 2: a mirrored 1792x1008 reverse-angle crop) and graded with the CSS brightness→sepia→saturate matrix (D46 dark-warm) plus `eq`.
  - Per frame, `perspective` (cubic) gives a sub-pixel push-in of 1.02→1.07 (loops: 1.02↔1.06 periodic) and drift that stays inside the frame. Then come scale to 1280x720, seeded temporal `noise`, `vignette`, a scanline band (8 %, 1.2 s sweep every 6 s, period-exact on loops) and the OSD layers.
  - One pass encodes both the 720p and the 360p output (`split`).
- **OSD:**
  - Per-evidence clips: the top-left WIB timestamp "YYYY-MM-DD  HH:MM:SS  UTC+07:00" is a half-second sprite cropped per frame. The top-right has "● REC" with the dot blinking at 1 Hz. The bottom row reads "CAM n VIDEO-0n | INTERVIEW ROOM 1" and "DEMS-IR-01 | DEMO".
  - Live loops: "CAM-0n | VIDEO-0n | LIVE | DEMO", bottom centre.
- **Encoding and determinism:**
  - x264 `-preset slow`: CRF 28 High@3.1 on desktop, CRF 29 Main@3.0 on mobile. GOP 125 (5 s, fixed), `-threads 4`, bitexact muxing, `+faststart`, no metadata except a DEMO title and comment.
  - Posters and thumbnails are the frame at 1 s, as bitexact MJPEG.
  - No `Math.random` and no wall clock in the outputs; eSpeak variants are limited to time-stable ones (F-92-1).
- **Publishing:** each run is staged in `$TMPDIR/dems-demo-media-*`. On success the output is written into `assets/demo-media` with fresh writes and files that are no longer produced are pruned; the temp folder is removed.
  - Finding F-92-2: `copyFileSync` produced APFS clones that kept ffmpeg's over-allocation (`du` showed 2,112 KB for a 1,200 KB file), which inflates the `du -sk` budget check. That is why the output is written fresh.
  - On failure, the temp folder is kept and reported.
- **Logging:** every run writes structured JSON lines (timestamp, level, source, correlationId, message, stack_trace, context) to `$TMPDIR/dems-gen-demo-media/run-*.jsonl`, outside the repository. Tool failures carry the stderr tail. Invalid arguments exit 1 before any work starts.

## 5. Output contract for consumers (steps 39, 42, 44, 47, 53, 72, 79, 83, 93)

**Join key (D61): the evidence number.** `media-index.json` has `"joinKey": "evidenceSuffix"`, `evidence[]` (EV 0001–0013) and `live`.

| Path | Content |
|---|---|
| `evidence/<EV suffix>/VIDEO-01.mp4`, `VIDEO-02.mp4` | 1280x720 H.264, no audio stream |
| `evidence/<EV suffix>/AUDIO-01.m4a`, `AUDIO-02.m4a` | MIC 1 (interviewer), MIC 2 (subject) |
| `evidence/<EV suffix>/VIDEO-0n.poster.jpg` (1280x720), `VIDEO-0n.thumb.jpg` (320x180) | frame at 1 s |
| `live/VIDEO-0n.loop.mp4`, `live/AUDIO-0n.loop.m4a`, `live/VIDEO-0n.poster.jpg`, `.thumb.jpg` | the recording scenario: `live.sessionSeq` = `RECORDING_SCENARIO.sessionSeq` = 24; `live.evidenceSuffixWhenSealed` = `formatSeq(IDLE_COUNTERS.evidence)` = "0014" |
| `mobile/evidence_<EV>_video_0n.mp4`, `_audio_0n.m4a`, `_video_0n_poster.jpg`; `mobile/live_video_0n_loop.mp4`, `live_audio_0n_loop.m4a`, `live_video_0n_poster.jpg` | 640x360 subset: 84 files, 12,646,268 B. Names are flat, lowercase and Android-resource-safe for step 72's static require map |
| `media-index.json` | Per item:<br>- IDs (sessionId and evidenceId, both with their suffixes)<br>- subject, investigator, outcome and `startedAt`<br>- `sessionDurationMs`, `excerpt`<br>- voices<br>- per-file path, bytes, SHA-256 and durationSec (desktop and mobile)<br>- the transcript: speaker, track, text, startSec and endSec |

**Excerpt rule** (`excerptRule` in the index and in the README):
- The media cover [0, excerpt.durationMs) of each recording: 31–47 s, against full durations of 13–68 min.
- A player that shows the full timeline maps position p to p mod excerpt.durationMs and labels playback as a DEMO excerpt.
- The four tracks of an item share one duration, so they stay in sync.
- Live loops repeat seamlessly.

**Rules for consumers**
- Consumers never hard-code hashes (P13). Step 93 computes its own SHA-256 over these files.
- The index SHA-256 values are a record, and they are stable across runs.
- Videos carry no audio, so a player that wants sound plays AUDIO-01 and/or AUDIO-02 alongside.

## 6. ffprobe of every file (final run 4, 03:44–03:57 WIB)

### 6.1 Audio and video (112 files)

| File | Stream (ffprobe) | Duration s | Bytes |
|---|---|---|---|
| evidence/0001/AUDIO-01.m4a | aac 48000 Hz 1 ch | 40.000 | 250029 |
| evidence/0001/AUDIO-02.m4a | aac 48000 Hz 1 ch | 40.000 | 249856 |
| evidence/0001/VIDEO-01.mp4 | h264 High 1280x720 25/1 fps, 1000 frames | 40.000 | 851765 |
| evidence/0001/VIDEO-02.mp4 | h264 High 1280x720 25/1 fps, 1000 frames | 40.000 | 831247 |
| evidence/0002/AUDIO-01.m4a | aac 48000 Hz 1 ch | 40.000 | 249988 |
| evidence/0002/AUDIO-02.m4a | aac 48000 Hz 1 ch | 40.000 | 251249 |
| evidence/0002/VIDEO-01.mp4 | h264 High 1280x720 25/1 fps, 1000 frames | 40.000 | 853614 |
| evidence/0002/VIDEO-02.mp4 | h264 High 1280x720 25/1 fps, 1000 frames | 40.000 | 834463 |
| evidence/0003/AUDIO-01.m4a | aac 48000 Hz 1 ch | 47.000 | 294010 |
| evidence/0003/AUDIO-02.m4a | aac 48000 Hz 1 ch | 47.000 | 293610 |
| evidence/0003/VIDEO-01.mp4 | h264 High 1280x720 25/1 fps, 1175 frames | 47.000 | 1021580 |
| evidence/0003/VIDEO-02.mp4 | h264 High 1280x720 25/1 fps, 1175 frames | 47.000 | 999302 |
| evidence/0004/AUDIO-01.m4a | aac 48000 Hz 1 ch | 41.000 | 256172 |
| evidence/0004/AUDIO-02.m4a | aac 48000 Hz 1 ch | 41.000 | 255781 |
| evidence/0004/VIDEO-01.mp4 | h264 High 1280x720 25/1 fps, 1025 frames | 41.000 | 888860 |
| evidence/0004/VIDEO-02.mp4 | h264 High 1280x720 25/1 fps, 1025 frames | 41.000 | 867740 |
| evidence/0005/AUDIO-01.m4a | aac 48000 Hz 1 ch | 42.000 | 262067 |
| evidence/0005/AUDIO-02.m4a | aac 48000 Hz 1 ch | 42.000 | 262307 |
| evidence/0005/VIDEO-01.mp4 | h264 High 1280x720 25/1 fps, 1050 frames | 42.000 | 909750 |
| evidence/0005/VIDEO-02.mp4 | h264 High 1280x720 25/1 fps, 1050 frames | 42.000 | 882147 |
| evidence/0006/AUDIO-01.m4a | aac 48000 Hz 1 ch | 43.000 | 268380 |
| evidence/0006/AUDIO-02.m4a | aac 48000 Hz 1 ch | 43.000 | 268675 |
| evidence/0006/VIDEO-01.mp4 | h264 High 1280x720 25/1 fps, 1075 frames | 43.000 | 941274 |
| evidence/0006/VIDEO-02.mp4 | h264 High 1280x720 25/1 fps, 1075 frames | 43.000 | 905239 |
| evidence/0007/AUDIO-01.m4a | aac 48000 Hz 1 ch | 34.000 | 212436 |
| evidence/0007/AUDIO-02.m4a | aac 48000 Hz 1 ch | 34.000 | 214921 |
| evidence/0007/VIDEO-01.mp4 | h264 High 1280x720 25/1 fps, 850 frames | 34.000 | 733213 |
| evidence/0007/VIDEO-02.mp4 | h264 High 1280x720 25/1 fps, 850 frames | 34.000 | 732690 |
| evidence/0008/AUDIO-01.m4a | aac 48000 Hz 1 ch | 34.000 | 212398 |
| evidence/0008/AUDIO-02.m4a | aac 48000 Hz 1 ch | 34.000 | 212764 |
| evidence/0008/VIDEO-01.mp4 | h264 High 1280x720 25/1 fps, 850 frames | 34.000 | 731404 |
| evidence/0008/VIDEO-02.mp4 | h264 High 1280x720 25/1 fps, 850 frames | 34.000 | 732304 |
| evidence/0009/AUDIO-01.m4a | aac 48000 Hz 1 ch | 34.000 | 212813 |
| evidence/0009/AUDIO-02.m4a | aac 48000 Hz 1 ch | 34.000 | 212481 |
| evidence/0009/VIDEO-01.mp4 | h264 High 1280x720 25/1 fps, 850 frames | 34.000 | 735398 |
| evidence/0009/VIDEO-02.mp4 | h264 High 1280x720 25/1 fps, 850 frames | 34.000 | 733734 |
| evidence/0010/AUDIO-01.m4a | aac 48000 Hz 1 ch | 31.000 | 194000 |
| evidence/0010/AUDIO-02.m4a | aac 48000 Hz 1 ch | 31.000 | 194201 |
| evidence/0010/VIDEO-01.mp4 | h264 High 1280x720 25/1 fps, 775 frames | 31.000 | 700649 |
| evidence/0010/VIDEO-02.mp4 | h264 High 1280x720 25/1 fps, 775 frames | 31.000 | 692016 |
| evidence/0011/AUDIO-01.m4a | aac 48000 Hz 1 ch | 34.000 | 212350 |
| evidence/0011/AUDIO-02.m4a | aac 48000 Hz 1 ch | 34.000 | 213188 |
| evidence/0011/VIDEO-01.mp4 | h264 High 1280x720 25/1 fps, 850 frames | 34.000 | 734746 |
| evidence/0011/VIDEO-02.mp4 | h264 High 1280x720 25/1 fps, 850 frames | 34.000 | 734400 |
| evidence/0012/AUDIO-01.m4a | aac 48000 Hz 1 ch | 34.000 | 212545 |
| evidence/0012/AUDIO-02.m4a | aac 48000 Hz 1 ch | 34.000 | 212455 |
| evidence/0012/VIDEO-01.mp4 | h264 High 1280x720 25/1 fps, 850 frames | 34.000 | 737298 |
| evidence/0012/VIDEO-02.mp4 | h264 High 1280x720 25/1 fps, 850 frames | 34.000 | 733242 |
| evidence/0013/AUDIO-01.m4a | aac 48000 Hz 1 ch | 34.000 | 212675 |
| evidence/0013/AUDIO-02.m4a | aac 48000 Hz 1 ch | 34.000 | 213947 |
| evidence/0013/VIDEO-01.mp4 | h264 High 1280x720 25/1 fps, 850 frames | 34.000 | 733105 |
| evidence/0013/VIDEO-02.mp4 | h264 High 1280x720 25/1 fps, 850 frames | 34.000 | 734328 |
| live/AUDIO-01.loop.m4a | aac 48000 Hz 1 ch | 38.000 | 237640 |
| live/AUDIO-02.loop.m4a | aac 48000 Hz 1 ch | 38.000 | 238252 |
| live/VIDEO-01.loop.mp4 | h264 High 1280x720 25/1 fps, 950 frames | 38.000 | 727931 |
| live/VIDEO-02.loop.mp4 | h264 High 1280x720 25/1 fps, 950 frames | 38.000 | 719560 |
| mobile/evidence_0001_audio_01.m4a | aac 24000 Hz 1 ch | 40.000 | 171480 |
| mobile/evidence_0001_audio_02.m4a | aac 24000 Hz 1 ch | 40.000 | 167477 |
| mobile/evidence_0001_video_01.mp4 | h264 Main 640x360 25/1 fps, 1000 frames | 40.000 | 286708 |
| mobile/evidence_0001_video_02.mp4 | h264 Main 640x360 25/1 fps, 1000 frames | 40.000 | 288346 |
| mobile/evidence_0002_audio_01.m4a | aac 24000 Hz 1 ch | 40.000 | 171071 |
| mobile/evidence_0002_audio_02.m4a | aac 24000 Hz 1 ch | 40.000 | 168740 |
| mobile/evidence_0002_video_01.mp4 | h264 Main 640x360 25/1 fps, 1000 frames | 40.000 | 286981 |
| mobile/evidence_0002_video_02.mp4 | h264 Main 640x360 25/1 fps, 1000 frames | 40.000 | 287509 |
| mobile/evidence_0003_audio_01.m4a | aac 24000 Hz 1 ch | 47.000 | 200566 |
| mobile/evidence_0003_audio_02.m4a | aac 24000 Hz 1 ch | 47.000 | 198473 |
| mobile/evidence_0003_video_01.mp4 | h264 Main 640x360 25/1 fps, 1175 frames | 47.000 | 346793 |
| mobile/evidence_0003_video_02.mp4 | h264 Main 640x360 25/1 fps, 1175 frames | 47.000 | 346172 |
| mobile/evidence_0004_audio_01.m4a | aac 24000 Hz 1 ch | 41.000 | 175073 |
| mobile/evidence_0004_audio_02.m4a | aac 24000 Hz 1 ch | 41.000 | 171019 |
| mobile/evidence_0004_video_01.mp4 | h264 Main 640x360 25/1 fps, 1025 frames | 41.000 | 302553 |
| mobile/evidence_0004_video_02.mp4 | h264 Main 640x360 25/1 fps, 1025 frames | 41.000 | 302950 |
| mobile/evidence_0005_audio_01.m4a | aac 24000 Hz 1 ch | 42.000 | 179685 |
| mobile/evidence_0005_audio_02.m4a | aac 24000 Hz 1 ch | 42.000 | 174308 |
| mobile/evidence_0005_video_01.mp4 | h264 Main 640x360 25/1 fps, 1050 frames | 42.000 | 306691 |
| mobile/evidence_0005_video_02.mp4 | h264 Main 640x360 25/1 fps, 1050 frames | 42.000 | 306892 |
| mobile/evidence_0006_audio_01.m4a | aac 24000 Hz 1 ch | 43.000 | 183694 |
| mobile/evidence_0006_audio_02.m4a | aac 24000 Hz 1 ch | 43.000 | 181808 |
| mobile/evidence_0006_video_01.mp4 | h264 Main 640x360 25/1 fps, 1075 frames | 43.000 | 316571 |
| mobile/evidence_0006_video_02.mp4 | h264 Main 640x360 25/1 fps, 1075 frames | 43.000 | 316064 |
| mobile/evidence_0007_audio_01.m4a | aac 24000 Hz 1 ch | 34.000 | 145031 |
| mobile/evidence_0007_audio_02.m4a | aac 24000 Hz 1 ch | 34.000 | 143232 |
| mobile/evidence_0007_video_01.mp4 | h264 Main 640x360 25/1 fps, 850 frames | 34.000 | 248292 |
| mobile/evidence_0007_video_02.mp4 | h264 Main 640x360 25/1 fps, 850 frames | 34.000 | 252381 |
| mobile/evidence_0008_audio_01.m4a | aac 24000 Hz 1 ch | 34.000 | 145805 |
| mobile/evidence_0008_audio_02.m4a | aac 24000 Hz 1 ch | 34.000 | 141108 |
| mobile/evidence_0008_video_01.mp4 | h264 Main 640x360 25/1 fps, 850 frames | 34.000 | 249006 |
| mobile/evidence_0008_video_02.mp4 | h264 Main 640x360 25/1 fps, 850 frames | 34.000 | 251581 |
| mobile/evidence_0009_audio_01.m4a | aac 24000 Hz 1 ch | 34.000 | 146350 |
| mobile/evidence_0009_audio_02.m4a | aac 24000 Hz 1 ch | 34.000 | 143450 |
| mobile/evidence_0009_video_01.mp4 | h264 Main 640x360 25/1 fps, 850 frames | 34.000 | 247147 |
| mobile/evidence_0009_video_02.mp4 | h264 Main 640x360 25/1 fps, 850 frames | 34.000 | 252062 |
| mobile/evidence_0010_audio_01.m4a | aac 24000 Hz 1 ch | 31.000 | 133428 |
| mobile/evidence_0010_audio_02.m4a | aac 24000 Hz 1 ch | 31.000 | 129593 |
| mobile/evidence_0010_video_01.mp4 | h264 Main 640x360 25/1 fps, 775 frames | 31.000 | 237152 |
| mobile/evidence_0010_video_02.mp4 | h264 Main 640x360 25/1 fps, 775 frames | 31.000 | 238159 |
| mobile/evidence_0011_audio_01.m4a | aac 24000 Hz 1 ch | 34.000 | 145346 |
| mobile/evidence_0011_audio_02.m4a | aac 24000 Hz 1 ch | 34.000 | 144010 |
| mobile/evidence_0011_video_01.mp4 | h264 Main 640x360 25/1 fps, 850 frames | 34.000 | 249095 |
| mobile/evidence_0011_video_02.mp4 | h264 Main 640x360 25/1 fps, 850 frames | 34.000 | 252962 |
| mobile/evidence_0012_audio_01.m4a | aac 24000 Hz 1 ch | 34.000 | 144653 |
| mobile/evidence_0012_audio_02.m4a | aac 24000 Hz 1 ch | 34.000 | 141820 |
| mobile/evidence_0012_video_01.mp4 | h264 Main 640x360 25/1 fps, 850 frames | 34.000 | 249421 |
| mobile/evidence_0012_video_02.mp4 | h264 Main 640x360 25/1 fps, 850 frames | 34.000 | 251834 |
| mobile/evidence_0013_audio_01.m4a | aac 24000 Hz 1 ch | 34.000 | 146350 |
| mobile/evidence_0013_audio_02.m4a | aac 24000 Hz 1 ch | 34.000 | 143090 |
| mobile/evidence_0013_video_01.mp4 | h264 Main 640x360 25/1 fps, 850 frames | 34.000 | 248049 |
| mobile/evidence_0013_video_02.mp4 | h264 Main 640x360 25/1 fps, 850 frames | 34.000 | 252548 |
| mobile/live_audio_01_loop.m4a | aac 24000 Hz 1 ch | 38.000 | 162537 |
| mobile/live_audio_02_loop.m4a | aac 24000 Hz 1 ch | 38.000 | 161407 |
| mobile/live_video_01_loop.mp4 | h264 Main 640x360 25/1 fps, 950 frames | 38.000 | 238469 |
| mobile/live_video_02_loop.mp4 | h264 Main 640x360 25/1 fps, 950 frames | 38.000 | 236000 |

### 6.2 Stills and other files (86 files)

| Group | ffprobe | Count | Bytes (min–max) |
|---|---|---|---|
| `evidence/*/VIDEO-0n.poster.jpg`, `live/VIDEO-0n.poster.jpg` | mjpeg 1280x720 | 28 | 45,603–59,027 |
| `evidence/*/VIDEO-0n.thumb.jpg`, `live/VIDEO-0n.thumb.jpg` | mjpeg 320x180 | 28 | 5,903–7,634 |
| `mobile/*_poster.jpg` | mjpeg 640x360 | 28 | 15,140–19,700 |
| `media-index.json`, `README.md` | n/a | 2 | 81,632; 5,266 |

Bytes by folder: evidence 28,804,863; mobile 12,646,268; live 2,026,623; root 86,898. Total: 43,564,652 B = 41.55 MiB.

## 7. Frame grabs (final files)

All are 1280x720 unless marked mobile, in `implementation/assets/`.

| Grab | Shows |
|---|---|
| [92_ev0001_video01_t1s.png](assets/92_ev0001_video01_t1s.png) | EV 0001 Cam 1 at 1 s: "2026-09-29  09:17:01  UTC+07:00", ● REC, "CAM 1 VIDEO-01 \| INTERVIEW ROOM 1", "DEMS-IR-01 \| DEMO" |
| [92_ev0001_video02_t1s.png](assets/92_ev0001_video02_t1s.png) | EV 0001 Cam 2 (mirrored reverse angle) at 1 s |
| [92_ev0007_video01_t1s.png](assets/92_ev0007_video01_t1s.png) | EV 0007 (today) at 1 s: "2026-10-01  07:06:13" |
| [92_ev0013_video02_t1s.png](assets/92_ev0013_video02_t1s.png) | EV 0013 Cam 2 at 1 s: "2026-10-01  09:19:58" |
| [92_live_video01_t1s.png](assets/92_live_video01_t1s.png), [92_live_video02_t1s.png](assets/92_live_video02_t1s.png) | Live loops at 1 s: "CAM-0n \| VIDEO-0n \| LIVE \| DEMO" |
| [92_live_video01_loop_last_f949.png](assets/92_live_video01_loop_last_f949.png) → [92_live_video01_loop_first_f0.png](assets/92_live_video01_loop_first_f0.png) | The loop point of VIDEO-01 (the last frame, then the first frame): same framing, same OSD |
| [92_live_video02_loop_last_f949.png](assets/92_live_video02_loop_last_f949.png) → [92_live_video02_loop_first_f0.png](assets/92_live_video02_loop_first_f0.png) | The loop point of VIDEO-02 |
| [92_mobile_ev0001_video01_t1s.png](assets/92_mobile_ev0001_video01_t1s.png), [92_mobile_live_video01_t1s.png](assets/92_mobile_live_video01_t1s.png) | Mobile 640x360: the OSD is legible |

## 8. Runs

| Run | When (WIB) | Command | Result |
|---|---|---|---|
| Previews 1–4 | 03:05–03:43 | `--out <scratch> --only …` | Calibration: size, OSD and loop seam; evidence-keyed layout check. Scratch output since deleted |
| 1 | 03:13:54–03:21:32 | default (repo) | exit 0; 198 files, 42.13 MiB; old session-keyed layout |
| 2 | 03:21:53–03:30:32 | default (repo) | exit 0; same list and durations; 20 audio files and the index differed (F-92-1) |
| 3 | 03:32:02–03:41:23 | default (repo) | exit 0; time-stable voices; 41.55 MiB |
| 4 (**final**) | 03:44:22–03:57:20 | default (repo), after D61 re-keying | exit 0; 198 files, 41.55 MiB, `du -sk` 42,876 |
| 5 | 03:44:25–03:57:23 | default with `--out <scratch>` (concurrent with run 4) | exit 0; byte-identical to run 4 (198/198) |
| Aborted | 03:59–04:01 | negative test `--as-of 2026-13-99` (INC-92-1) | stopped before publishing; repo re-hashed 198/198 = run 4 |
| Final check | 04:03 | `--out <scratch> --only 0011,0024` with the final script | 28/28 media files identical to the repo |

## 9. Decisions, drift, findings and incidents

| ID | Kind | Item |
|---|---|---|
| DR-92-1 | tech | Row 92 and D50 said `say -v Damayanti` with a pitch-shifted second voice. **D51 overrides:** eSpeak NG `id` with distinct variants per MIC was used, and Piper was rejected on licence evidence (§3). H-DM-1 (step 62) is resolved: no macOS system voice output is in the repository |
| DR-92-2 | tech | The OSD is rasterised from an original bitmap font, not drawn with `drawtext` (§2 capability finding) |
| DR-92-3 | env | Homebrew install in two steps with `--ignore-dependencies`, so outdated openssl@3, xz and ca-certificates were not upgraded (R40). espeak-ng and pcaudiolib were added under D51's authorisation. 14 formulae in total |
| DR-92-4 | data | The dataset changed during this step (step 32, D54 b / D61): 13 evidence items (0007–0013 today) plus the recording scenario 0024, not 6 + 1. All are covered. Scripts are keyed by session number and names are read from the dataset, so a renamed subject is still spoken correctly. An unknown future session gets a generic neutral script |
| DR-92-5 | form | **Join on the evidence number (D61):** `evidence/<EV>/`, `mobile/evidence_<EV>_*`, index `joinKey`. The live loop is keyed to `RECORDING_SCENARIO.sessionSeq` and `IDLE_COUNTERS.evidence`, never a literal |
| DR-92-6 | design | Excerpts, not full durations: 31–47 s against 13–68 min; the rule is in §5. Today's follow-ups are shorter (5 lines, about 34 s) to fit the budget |
| DR-92-7 | design | Live loops carry no running clock and no REC in the OSD: the UI overlays REC and the timer from the sim clock, idle camera tiles reuse the loops, and a burned-in clock would jump at each seam. The row's "running UTC+07:00 timestamp, REC" OSD is on every evidence clip |
| DR-92-8 | design | The MP4s carry no audio stream (independent tracks, §6.3). Players pair AUDIO-01 and AUDIO-02 themselves |
| DR-92-9 | form | Mobile names are flat and lowercase, because Metro turns paths into Android resource names by stripping `-` and `.`. Mobile audio is 24 kHz at 32 kbps for size |
| DR-92-10 | behaviour | `--as-of` takes a WIB date-time. Previous-day items depend only on the date. Today's items follow step 32's `todaySchedule(now)`, so their burned-in times match the simulator only when the demo loads near the `--as-of` time. Steps 60 and 93 should document and use the same `--as-of` |
| F-92-1 | finding | eSpeak NG `breath` variants are wall-clock seeded, so they are excluded (§3) |
| F-92-2 | finding | APFS clones inflate `du`, so the output is written fresh (§4) |
| F-92-3 | finding | The loop seam SSIM equals an in-stream keyframe transition (§1). A 5 s GOP halves the keyframe grain refresh against 2 s |
| INC-92-1 | incident | A negative test with `--as-of 2026-13-99` passed the format check (`Date.UTC` rolls over out-of-range values) and began a full generation into the repo.<br>- It was stopped about 2 min in, before the publish step: the generator stages in `$TMPDIR` and writes the repo last.<br>- The repo tree re-hashed identical to run 4 (198/198), and the temp folder was removed.<br>- Fix: `--as-of` must round-trip exactly (year, month, day, hour, minute).<br>- All five invalid-argument paths were re-tested under a 20 s alarm and each exits 1 before any work. The final script reproduced the published bytes |

**Persistent issues: none.** No check needed more than one repair cycle.

**Blockers: none.**

## 10. Relays

| To | Item |
|---|---|
| 39, 42, 44 (web) | Resolve through `import.meta.glob` over `@dems/shared/assets/demo-media/**` (package export `./assets/*`). Live feed: `live/VIDEO-0n.loop.mp4` (muted, looped). Evidence playback: `evidence/<EV>/`. Chips overlay REC and the timer. Posters and thumbnails exist for every video |
| 72 (mobile) | Copy `demo-media/mobile/` (84 files, 12,646,268 B) to `apps/mobile/assets/media/` unchanged. The per-file SHA-256 values are in `media-index.json` `…mobile.tracks` / `mobile.posters` |
| 93 | Package EV 0001–0013 from `evidence/<EV>/`, and the live media for the item sealed at run time (`live.evidenceSuffixWhenSealed` = 0014). Use the same `--as-of` (media default `2026-10-01T10:00`). Regenerate after any step-92 regeneration |
| 47, 53, 79, 83 | Join by `evidenceSuffix`; apply the excerpt rule (§5) |
| 60 (README) | Regeneration command, `--as-of` semantics (DR-92-10), the Homebrew rollback (§2) and F-92-1 |
| 61, 62 | Host-install log with rollback: §2. Voice licence: §3 (H-DM-1 resolved without macOS voices) |
| Controller | Tracking rows in `masterplan/02_plan.md`, `status_tasks.md` and `99_implementation_report.md` were not edited: they are shared files (P8) |
