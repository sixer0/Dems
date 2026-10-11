---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
row: fix 151 - manifest field 36 `tracks[].profile` states the DECLARED format (finding of initialization/08_gate_environment_wave_k.md, smoke (a))
date: 2026-10-11
agent: coder-execution
narrative_tier: 1
source: initialization/08_gate_environment_wave_k.md section 4 (a); implementation/139_fix_wave_k_s1.md item 3; 144_fix_wave_k_kr.md item 2; decisions D222 (2), D224; errata PE-WK-15, PE-WK-16; controller ruling of 2026-10-11 (this fix)
tree: b05106b + this fix, uncommitted (no git write; no migration: schema 6 / dbc-7; totals 97 / 36 / 61 / 67 unchanged; no member added to packages/shared, no manifest member, schema `dems.manifest/2` unchanged)
status: complete (the spec text of erratum PE-WK-16 is now stale: open item 1, a docs pass)
---

# 151 - The manifest profile is what the stream declares

No `.data/pg*.env` read; PostgreSQL untouched (no db test was needed: no db file changed); ports
5173-5175 / 8000 / 5432 untouched; no install; no LOCAL_DEVICE source selected; nothing played; no
formatter run with `--write`; lane 1 not stopped. Of lane 2's packages only the manifests, the
fragment tables and the first 1,249 / 1,269 clear bytes (init segment) of camera files were read;
no key file was opened and no key material printed.

## 1. Cause

**The 27.67 / 26 are a MEASURED average, and the measure was wrong by construction: it divided the
frames by a span that contains the hold of the first video sample.** The generator delivered 30
per second; the stream declares 30 per second.

| Question | Answer | Evidence |
|---|---|---|
| Where does the figure come from | Wave K measured: video samples of the first 8 fragments x timescale / the sum of their `trun` durations, 2 decimals | at `b05106b`: `apps/core-server/src/capture/fragments.ts:618` (`run.samples * run.timescale / run.ticks`), fed by `:330` (`videoRun.ticks += total`); the text `apps/core-server/src/sealing-host/session-reader.ts:233` (nominal within 1 %, else the measured rate with 2 decimals); the notice on any text difference `:401` |
| What is in that span | The first video sample of a camera file is HELD from file time 0 to the first keyframe the worker could place (capture spec §C.4). The worker muxes with `+empty_moov` (`apps/capture-worker/src/ingest.c:47`), so the muxer moves that sample to time 0 and adds the hold to ITS duration. The hold is therefore inside the measured ticks | the session's own records: `CAPTURE_FIRST_VIDEO_HELD` `CAM-01` 1572 ms, `CAM-02` 3121 ms (note 08 section 4); signed manifest fields 127 / 128: `firstVideoSamplePts` 141509 and 280890 at timescale 90000 = 1.572 s and 3.121 s |
| Does the arithmetic reproduce the sealed text | Yes, on the item's own SIGNED fragment table. Span of the first 8 fragments: VIDEO-01 20.599 s, VIDEO-02 22.136 s. 30 per second after the hold: (20.599 - 1.572) x 30 = 571 pictures / 20.599 s = **27.71** (sealed 27.67); (22.136 - 3.121) x 30 = 570 / 22.136 s = **25.77** (sealed `26`: 25.77 is within 1 % of 26, so the wave K text wrote the whole number) | `session-manifest.json` of `SESSION-SES-20261011-0036`, `files[].fragments[0..7].mediaStartMs / mediaDurationMs`; test "the cause" (section 3). The 0.04 left over: fragment spans are whole ms and include the audio run |
| Did the generator deliver fewer frames | No sign of it. The irregular fragment durations are the fragment cut, not the delivery: the first fragment is the hold plus one second (2595 = 1572 + 1023; 4137 = 3121 + 1016), the others are two or three one-second GOPs (2.06 s / 3.06 s) | the same table. Limit: the `trun` boxes of a sealed file are ciphertext, so the per-fragment sample count of `EV-20261011-0025` was not read; the conclusion rests on the arithmetic agreeing for BOTH tracks with two different holds, and on the second smoke (section 4): holds of 1580 ms and 3103 ms again, and the manifest now reads `H264_720P30` |
| What the stream DECLARES | Sample entry `avc1`, 1280 x 720. Its sequence parameter set (in `avcC`): Baseline (profile_idc 66), level 3.1, coded 1280 x 720, VUI timing information present, `num_units_in_tick 1`, `time_scale 60`, `fixed_frame_rate_flag 1` = **30 frames per second** (time_scale / (2 x num_units_in_tick)). `mdhd` timescale 90000; `trex` default sample duration 0 (the container header states no rate) | parsed from the first 1,249 bytes of `fragments/VIDEO-01.mp4` and `VIDEO-02.mp4` of `EV-20261011-0025` (identical; SHA-256 `cd44581d5fba9f2d...`; the same bytes open every item recorded on lane 2 on 10 and 11 October). The demo item `EV-20261008-0001` (1,269 bytes, `af1fb87263c987ba...`) declares the same |
| What the worker reports to the Core about the stream | Nothing about size or rate. `FIRST_VIDEO_SAMPLE` carries `pts`, `timescale`, the skipped counts and span (`packages/capture-protocol/src/index.ts`, schema above `:743`); the worker only LOGS `frame_period_us` in its `video_started` line (`apps/capture-worker/src/ingest.c:653-657`), from the demuxer's `avg_frame_rate` / `r_frame_rate` | code |

Why earlier items never showed it: every item before `-0025` was sealed either by older code
(field 36 = the configured profile) or under the 1080p25 selector, where the measured text differed
from the selector anyway and nobody read the rate.

## 2. The rule as built

`tracks[].profile` is a FORMAT statement: what the stream declares about itself, in the profile
vocabulary (a CODE, `^[A-Z][A-Z0-9_]{0,63}$`: `apps/core-server/src/db/mapping/rows.ts:749`,
`0004_capture.sql:13` - a dot is not a character of it). Never a measured average, never a fraction.

| Part | As built | Where |
|---|---|---|
| Picture | the width and height of the first video sample entry of the init segment (unchanged from wave K) | `capture/fragments.ts:675` `videoFormatIn` |
| Rate | the NOMINAL rate the stream's own parameter set declares: H.264 `time_scale / (2 x num_units_in_tick)` of the first sequence parameter set of `avcC`, whatever `fixed_frame_rate_flag` says. Null when the stream declares none: no `avcC`, no parameter set in it (`avc3`), no VUI, a VUI without timing, a parameter set that cannot be read to that point, or HEVC (open item 3) | `fragments.ts:571` `avcDeclaredFrameRate`, `:671`; `:718` `videoStreamFormatOf` |
| No fragment is read | the reader stops at the `moov`. The wave K measure, its bound `VIDEO_FRAME_RATE_FRAGMENTS` and the accumulator of `mediaOf` are REMOVED: a recording file and a sealed file give the same answer (a resumed seal no longer reads a different one) | `fragments.ts:718-733`; `capture-session/facts.ts:288` |
| Text | `<codec>_<height>P<rate>` (16:9), `<codec>_<width>X<height>P<rate>` (other pictures), rate = the whole number declared, or N for a declared N x 1000 / 1001 (29.97 -> 30, 23.976 -> 24) | `sealing-host/session-reader.ts:225` `nominalRateOf`, `:246` `streamProfileOf` |
| "Not stated" | the spec's own value (PE-WK-16: a rate the Core does not have is ABSENT): `H264_720P`. Used when the stream declares no rate and when it declares one that has no whole-number name (12.5): no new shape, still a CODE | `session-reader.ts:246-250` |
| No picture size / no file | the configured profile, as before (PE-WK-16) | `session-reader.ts:436` |
| `STREAM_PROFILE_DIFFERS` | only when the DECLARED format is not the configured profile: declared whole-number rate -> the two texts differ; NO declared rate -> codec or picture differ (a configured `H264_720P30` over a stream that says `H264_720P` is contradicted by nothing the stream declares); a declared rate no code can name -> differs | `session-reader.ts:261` `streamProfileDiffers`, used at `:432` |
| Delivered rate | NOT stated anywhere: neither the manifest nor the session has a member for delivered / dropped frames or a measured rate, and none was added (open item 2) | - |
| Sealed packages | untouched. Field 36 is free text no verify check reads: `EV-20261011-0025` keeps `H264_720P27.67` / `H264_720P26` and its notice `ALR-000033`, the older items keep `H264_1080P25`; all verify PASS (section 4) | - |

Not changed: the notice door (`engine/sealing-notice-doors.ts`; its profile pattern still admits the
dot, so the stored `ALR-000033` stays readable), the selector correction of K-R, any contract file.

## 3. Tests

New: `apps/core-server/src/sealing-host/__tests__/fix-151-declared-profile.test.ts` (14 cases) and
its fixture `fix-151-init-segments.ts`: the two REAL init segments (headers only), the first 8 rows
of the signed fragment table of `EV-20261011-0025` and the table of the interrupted
`EV-20261010-0017` ([seq, mediaStartMs, mediaDurationMs] + fields 36, 127, 128; no hash, nonce, tag
or key ID), and a builder of made-up parameter sets. Recordings are rebuilt from the tables: 30 per
second, the table's fragment spans, the first sample held.

| Case | Asserts |
|---|---|
| the cause (2 cases; pass before and after) | 30 per second after the hold over the signed span is the sealed fraction of both tracks; the old arithmetic on the rebuilt files gives 27.7 / 25.8, and 30 without the hold |
| real init segments | H264, 1280 x 720, declared 30 - both |
| fragments do not matter | the rebuilt files of the finding, a stream DELIVERED at 27 per second, a sealed-like file, an init segment alone: all 30 |
| interrupted prefix | whole fragments + torn tail (`walkCameraFile` says `TORN_TAIL`): declared 30; a cut init segment, a lone fragment, an empty file: null |
| made-up parameter sets | 1080p at 25; 30000 / 1001; High profile; 12.5; and NO rate: VUI without timing, no VUI, `avc3`, no `avcC`, a parameter set cut short, `hvc1` |
| text / notice rule | never a fraction (incl. 27.67 and 25.77 handed in as a rate -> `H264_720P`), every text a CODE; ten notice cases |
| reader: THE FINDING | real init, holds 1.572 s / 3.121 s, selector `H264_720P30` -> `H264_720P30` twice, nothing told |
| reader: delivered ~27 | `H264_720P30`, nothing told |
| reader: different declared format | 1080p25 under a 720p30 selector and the real 720p30 under a 1080p25 selector: stated AND told |
| reader: one camera | the present file states its stream, the absent keeps its line; told only for a declared difference |
| reader: interrupted + sealed file | `H264_720P30` twice, nothing told |
| reader: no declared rate | `H264_720P`, not told under `H264_720P30`, told under `H264_1080P25` |

Red before the fix (the two changed sources put back to `b05106b` for one run, without git writes,
then restored): `Tests  12 failed | 2 passed (14)` - e.g. `expected [ 'H264_720P28', 'H264_720P26' ]
to deeply equal [ 'H264_720P30', 'H264_720P30' ]`, `expected 'H264_720P12.5' to be 'H264_720P'`,
`streamProfileDiffers is not a function`. The two that passed are the cause / control cases.

Pins moved by delta in `wave-k-s1-stream-profile.test.ts` (12 cases): its made-up files now carry an
`avcC` that declares their rate; "measured over the fragments" -> "declared"; a sealed-like file now
states its rate; 30.12 and 27.4 -> `H264_720P`.

| Check (one run each) | Command, from the repository root | Result |
|---|---|---|
| the two files | `npx vitest run --root apps/core-server --project unit src/sealing-host/__tests__/fix-151-declared-profile.test.ts src/sealing-host/__tests__/wave-k-s1-stream-profile.test.ts` | `Test Files  2 passed (2)` / `Tests  26 passed (26)` |
| sealing, sealing-host, capture, capture-session, evidence-verify, static rules | `npx vitest run --root apps/core-server --project unit src/sealing src/sealing-host src/capture src/capture-session src/evidence-verify test/static` (outside the sandbox: loopback) | `Test Files  118 passed (118)` / `Tests  1742 passed (1742)` |
| typecheck | `npx tsc --noEmit -p apps/core-server`; `-p packages/shared` | exit 0; exit 0 |
| lint | `npm run -s lint -w @dems/core-server`; `-w @dems/shared` | exit 0; exit 0 |
| db | none run: no db file touched, no statement, alert shape or door changed | - |

## 4. Smoke on lane 2 (one run, through the API, FAKE sources)

Lane 2 restarted with `scripts/lane/lane.sh stop 2`, then `start 2 --with-camera-stub --speech-mic`
(redirected to a 0600 file, not piped; NO reset). Session helper of note 08 section 8.

| Check | Result |
|---|---|
| session | `SES-20261011-0037` -> item **`EV-20261011-0026`**, case `LP/2026/1011-9151`, subject "Fix 151 Profile Smoke". Create 201, pre-check 202, start 200, `RECORDING` 03:44:12.991, stop 202 (body with a reason) at 03:45:05.185, `SEALED` 03:45:12.740: recording 52.2 s, seal 7.6 s. 21 + 21 fragments |
| manifest `tracks[].profile` | **`VIDEO-01` (`CAM-01`): `H264_720P30`; `VIDEO-02` (`CAM-02`): `H264_720P30`** (read from `session-manifest.json` of the package) |
| `STREAM_PROFILE_DIFFERS` | **none** for the session: 17 alerts, none active, none with target `SES-20261011-0037` and that reason; no `SEALING_STREAM_PROFILE_DIFFERS` line in the Core log. (`ALR-000033` of the earlier session is still there, as it must be) |
| the hold was there again | `CAPTURE_FIRST_VIDEO_HELD` `CAM-01` 1580 ms, `CAM-02` 3103 ms; fields 127: 142208, 279293. The old code would have written about 27.7 and 25.8 again |
| verify (op 41) `EV-20261011-0026` | `overall PASS`, 15 of 15, `manifestOk`, `signatureOk` true |
| verify `EV-20261011-0025` (fractional label) | `overall PASS`, 15 of 15 |
| verify `EV-20261010-0015` (`H264_1080P25`) | `overall PASS`, 15 of 15 |
| warn lines of the run | `CAPTURE_MIC_RATE_AT_LIMIT` (MIC-01), the two holds, one `transcriber.runner.clamp`; 0 error-level lines |
| end | summary acknowledged (204); sign-out 204, then 401; jar removed; no jar left |

Answers: `.cache/gate-env/fix-151/verify_*.json`, `smoke_session.log`, `start_2.log` (0600).

## 5. What changed in note 08's facts (also appended there, "After fix 151")

| Item | Note 08 | Now |
|---|---|---|
| Core lane 2 | PID 53035 | **PID 55401**, `127.0.0.1:4422`, REAL_DEVELOPMENT, `--with-camera-stub --speech-mic`, not reset; boot: `epoch 48, auditTotal 532, session SEALED, restartFault null, auditRows 0`; selector revision 2 |
| Camera stub ports | 53892 / 65503 / 65504 | **discovery UDP 62854, device TCP 50651, RTSP TCP 50652** |
| Stub fixture account | made at 03:25 | **made anew at this start**; the earlier one is dead. Not written here |
| Evidence on lane 2 | 25 items | **26**: + `EV-20261011-0026` (SEALED, v2). Next session `SES-20261011-0038`, next item `-0027` |
| `session/current` | `SES-20261011-0036` SEALED | `SES-20261011-0037` SEALED, summary acknowledged; no session open |
| Alerts | 16, none active | 17, none active (new: one INFO `MIC_RATE_AT_LIMIT` of the smoke) |
| Audit chain | ok, 531 rows | ok, 544 rows checked, then one sign-out |
| Seal rig | OFF | installed again by the start, **OFF** (read) |
| Devices | both on lane 2, online | unchanged, NOT unpaired by the restart: `pairing/devices` lists `DEV-0001`, `DEV-0002` `PAIRED`, online; health `ws.clients 2`; uiautomator on both: "Core online", "paired as DEV-0002" (phone), "paired as DEV-0001" (tablet); reverse rules `8081 -> 8081`, `4420 -> 4422` on both. No emulator touched otherwise |
| Lane 1, web servers, Metro | - | unchanged (lane 1 PID 52989, never stopped) |
| Selector | `H264_720P30` twice | unchanged: `CAM-01` / `CAM-02` `H264_720P30`, `MIC-01` PRIMARY, `MIC-02` STANDBY, `locked false` |

## 6. Files

| File | Change |
|---|---|
| `apps/core-server/src/capture/fragments.ts` | `VideoStreamFormat.frameRate` = the declared rate; NEW `avcDeclaredFrameRate`, `videoFormatIn` (replaces `videoPictureSizeIn`); `videoStreamFormatOf` reads the `moov` only; REMOVED `VIDEO_FRAME_RATE_FRAGMENTS` and the optional accumulator of `mediaOf` (both added by wave K, no other user) |
| `apps/core-server/src/sealing-host/session-reader.ts` | NEW `nominalRateOf`, `streamProfileDiffers`; `streamProfileOf` writes no fraction; the reader tells a difference by the declared format |
| `apps/core-server/src/capture-session/facts.ts` | comment of `readSessionVideoFormat` only |
| `apps/core-server/src/sealing-host/__tests__/fix-151-declared-profile.test.ts`, `fix-151-init-segments.ts` | NEW |
| `apps/core-server/src/sealing-host/__tests__/wave-k-s1-stream-profile.test.ts` | pins by delta |
| docs | this note; `initialization/08_gate_environment_wave_k.md` (appended section); `delegation_progress/file_claims.md` (one line); `delegation_progress/coder_execution_fix_151.md` |

## 7. Open items

1. **Spec text.** Erratum PE-WK-16 (`masterplan/06_evidence_package_spec.md:56`, `:329`, `:409-414`)
   still says "frame rate MEASURED over the first whole fragments", "within 1 %", "otherwise the
   measured rate with two decimals" and cites `fragments.ts:558`, `:590`, `session-reader.ts:218-236`.
   It needs a docs erratum with section 2 above (not written by me: masterplan files are the docs
   pass's). The same for the sentence of API contract erratum PE-WK-13 if it says "recorded stream
   that is not the profile" in the measured sense, and `README.md` if it repeats the rule.
2. **Delivered frames are stated nowhere.** No manifest or session member holds delivered / dropped
   frames or a measured rate, so a camera that delivers 22 of a nominal 30 seals as `..P30` without
   any statement of it. For the next manifest revision: a per-track member (frames written, and the
   span they cover EXCLUDING the hold of the first sample), fed by the worker's own counters - not
   by re-reading `trun` boxes at the seal.
3. **HEVC declares nothing here.** The `hvcC` parameter sets are not read: an HEVC file seals as
   `HEVC_<picture>P` with no rate, and is not told under a selector of that codec and picture. No
   HEVC source exists in this environment to prove a parser against.
4. **A stream without timing information** (a camera or encoder whose parameter set has no VUI
   timing; the VideoToolbox path of the helper was not read on this host - the generated stream
   here is Baseline with timing, i.e. the x264 table) seals as `H264_720P` and raises no notice
   for the rate. If the rate must always be stated, the source is the worker: a stream report record
   (it already knows `frame_period_us`, `ingest.c:653`) - a protocol member, next task.
5. `EV-20261011-0025` keeps its fractional label and `ALR-000033` for ever (sealed and signed);
   a re-check that lists manifests of lane 2 will see it.
6. The notice text for a declared rate no code can name reads "VIDEO-01 is H264_720P (configured
   H264_720P30)": true, but it does not say the rate that was declared. Not met by any source here.
7. Not run by me: the seal e2e and the kill matrix on the built worker (the test runner's, below).

## 8. Checks for the test runner

| Command | Lock | Expected |
|---|---|---|
| `npm test -w @dems/core-server` (unit) | none | green; nothing but the two test files above reads the changed functions |
| `npm run test:db -w @dems/core-server` | `.locks/db-migrate.lock`; lane 1 stopped for the slots and started again as note 08 section 1 says | green: `wave-k-s1-restart-fault.db.test.ts` stores the notice through the unchanged door |
| `DEMS_SEAL_E2E=1 ... src/sealing-host/__tests__/e2e/seal-e2e.db.test.ts` and the kill matrix | `.locks/heavy-host.lock` + the db lock; lane 2 DOWN (ports 8554 / 8556) | 3 of 3; 35 of 35; the manifest of a recording by the built worker reads `tracks[].profile: H264_720P30` and the session carries NO `STREAM_PROFILE_DIFFERS` under a `H264_720P30` selector. A pin that expects a notice or a fraction there is stale |

---
*Generated: 2026-10-11 03:50 WIB*
