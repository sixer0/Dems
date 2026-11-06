---
task_id: 2026-10-12_input_av_core_adapter_plan
row: 11
package: M1 / WP-01 (experiment E-8, reader half)
date: 2026-10-13
agent: test-expert
status: complete
tier: T2
---

# Row 11 - E-8, reader half: the Core's readers on the HEVC files of E-1 / E-2

## 1. Result

| Question of the row | Answer | Evidence |
|---|---|---|
| Codec reported HEVC | **yes**, for both HEVC files (parameter sets announced, and in-band only) | section 3, `sampleEntry` |
| Frame rate | **null** for both HEVC files; 25 for the H.264 control | section 3, `format` |
| WP-10a (reader, row 56) needed | **no** for the reader to accept the file, name its codec and keep the notice off; the rate gap itself is real (section 4). DRIVER DECISION 1 | sections 3, 4 |

Named outcome for row 14: **E-8 reader half: pass - HEVC accepted and stated `HEVC`, sample entry `hev1`, no refusal; the stream's declared rate (25) is not read.**

## 2. What was run, and which reader it is

"The Core's reader" of a worker file is three product functions and their two callers on the sealing path. All were called unchanged, from a script of the row.

| Step of the seal | Product function | Called by the seal at |
|---|---|---|
| Init segment and fragments (CLOSE_TRACKS) | `validateCameraFile` -> `walkCameraFile`, `apps/core-server/src/capture/fragments.ts:828, 349` | `apps/core-server/src/sealing/pipeline/pipeline.ts:328` |
| Codec, manifest field 43 | `videoSampleEntryOf`, `fragments.ts:511`; through the port `readSessionVideoSampleEntry`, `apps/core-server/src/capture-session/facts.ts:248` | `apps/core-server/src/sealing-host/session-reader.ts:399-403` |
| Picture and rate, field 36 | `videoStreamFormatOf`, `fragments.ts:718`; through the port `readSessionVideoFormat`, `facts.ts:288` | `session-reader.ts:411-412` |
| Stream statement and the notice | `streamProfileOf`, `streamProfileDiffers`, `session-reader.ts:246, 261` | `session-reader.ts:412, 432` |

`apps/capture-worker/test/tail_check.ts` wraps the first of these only (already run by E-1, `test/01_hevc_experiment.md` section 6); `frames_check.ts` decodes worker output lines, not a camera file. Neither prints a codec, so the row's script calls the functions directly.

Script (git-ignored): `.cache/hevc-experiment/e8_reader/e8_reader.ts`. Outputs: `.cache/hevc-experiment/e8_reader/out/<variant>_<track>.json`.

```
# from the repository root, inside the command sandbox (the tsx loader, not the tsx command: no pipe)
for v in h264_control hevc_a hevc_b hevc_b2; do for t in VIDEO-01 VIDEO-02; do
  node --import tsx .cache/hevc-experiment/e8_reader/e8_reader.ts .cache/hevc-experiment/runs/$v/media $t \
    HEVC_1080P HEVC_1080P25 HEVC_360P HEVC_360P25 H264_1080P25 H264_1080P H264_360P25 \
    > .cache/hevc-experiment/e8_reader/out/${v}_$t.json; done; done
```

Eight runs, each exit 0, one run each. Node v26.8.2. The files of E-1 / E-2 were present; nothing was regenerated, no lock taken, no worker, Core, emulator or database started.

Input files (`media/VIDEO-01.mp4`):

| Variant | Bytes | SHA-256 |
|---|---|---|
| `h264_control` | 24860520 | `e723d9170388509345d2316a6c03f0e809176e3961c5b5fadc39d7d44914987a` |
| `hevc_a` (parameter sets announced) | 15915317 | `c755e9a4431605d7bfa43fb099711591a3b54588feb44b118f96d95652b8fd3d` |
| `hevc_b2` (in-band only) | 2525587 | `a874e4aa7af311445051b0c1f1345ea2090b4b243a89e564b42611ac83e70d1c` |

Product code as of commit `b7ed4c60`; `git diff --stat HEAD` on `fragments.ts`, `facts.ts`, `session-reader.ts` and `sealing/pipeline` is empty.

## 3. Facts per file (`VIDEO-01.mp4`, 1920x1080)

| | `hevc_a` | `hevc_b2` | `h264_control` |
|---|---|---|---|
| Init segment accepted | yes: `state CLEAN`, `flags []`, `initLength 1322` | yes: `CLEAN`, `[]`, `initLength 1305` | yes: `CLEAN`, `[]`, `initLength 1251` |
| Sample entry read | `{"state":"KNOWN","codec":"HEVC","sampleEntry":"hev1"}` | the same | `{"state":"KNOWN","codec":"H264","sampleEntry":"avc1"}` |
| Codec, and its vocabulary | `HEVC`: the stored form of manifest field 43 (`VideoCodec`, `H264` or `HEVC`, `fragments.ts:457`). Not the screen form of the camera slice (`H.264` or `HEVC`, `implementation/052_camera_slice_contract.md`) | `HEVC`, same | `H264`, stored form |
| Same answer through the seal's port | yes | yes | yes |
| Fragments | 8, numbered 1 to 8; `durableLength` = file length 15915317; `tail null` | 8; 2525587; `tail null` | 8; 24860520; `tail null` |
| Each fragment accepted | 8 of 8 with media time, 8 of 8 start on a keyframe | 8 of 8, 8 of 8 | 8 of 8, 8 of 8 |
| Picture and rate | `{"width":1920,"height":1080,"frameRate":null}` | the same | `{"width":1920,"height":1080,"frameRate":25}` |
| Field 36 as the seal would state it | `HEVC_1080P` | `HEVC_1080P` | `H264_1080P25` |
| Notice `STREAM_PROFILE_DIFFERS` due, by configured code | `HEVC_1080P` no; `HEVC_1080P25` no; `H264_1080P25` yes; `H264_1080P` yes | the same | `H264_1080P25` no; `H264_1080P` yes; every `HEVC_` code yes |
| Refusal | none | none | none |
| Boxes inside the sample entry (the script's own look, not a product function) | `hvcC(111)`, `pasp(8)` | `hvcC(110)` | `avcC(40)`, `pasp(8)` |

The second camera (`VIDEO-02.mp4`, 640x360) gives the same in all three variants: `HEVC` / `hev1`, rate null, `HEVC_360P` for both HEVC files; `H264` / `avc1`, 25, `H264_360P25` for the control. `hevc_b` (a second run of variant A, not evidence for E-2) reads as `hevc_a`.

First fragment of each file, as the walk returns it: `hevc_a {"index":1,"start":1322,"len":1142027,"media":{"mediaStartMs":0,"mediaDurationMs":3552,"keyframe":true}}`; the full lists are in the output files.

### Refusals that exist on this path, none raised

| Code | Reason | Raised at | Condition | Met by a `hev1` file |
|---|---|---|---|---|
| `CAMERA_FILE_UNUSABLE` | `VIDEO_SAMPLE_ENTRY_UNKNOWN` / `NO_VIDEO_SAMPLE_ENTRY` | `session-reader.ts:400-401` | the sample entry is not one of `avc1`, `avc3`, `hvc1`, `hev1`, or there is none | no |
| `CAMERA_FILE_UNUSABLE` | `NO_INIT_SEGMENT` / `NO_WHOLE_FRAGMENT` | `pipeline.ts:331-332, 397` | walk flags | no |
| `CAMERA_FILE_UNUSABLE` | `NO_MEDIA_TIME` | `pipeline.ts:421` | a fragment whose `moof` gives no media time | no (8 of 8 have it) |

### What `hev1` means for the reader

Nothing requires `hvc1` or `avc1`. The map `fragments.ts:459` holds four names; `hev1` and `hvc1` both give `HEVC`. The walk (`tracksOf`, `mediaOf`, `fragments.ts:212-331`) reads `tkhd`, `mdhd`, `hdlr`, `trex`, `tfhd`, `tfdt`, `trun` and never a sample entry: it is codec-blind. The sample-entry name is not written to the manifest (field 43 holds the codec). Whether a player accepts `hev1` is the playback half.

## 4. The rate gap, measured

The reader looks for one box inside the sample entry, `avcC` (`fragments.ts:702`); an HEVC entry holds `hvcC`, so `frameRate` stays null (`fragments.ts:698`). The streams themselves declare a rate:

```
ffmpeg -hide_banner -nostdin -i <file> -map 0:v -c copy -bsf:v trace_headers -frames:v 1 -f null -
hevc_a, hevc_b2: vps_timing_info_present_flag 0; vui_parameters_present_flag 1; vui_timing_info_present_flag 1; vui_num_units_in_tick 1; vui_time_scale 25
h264_control:    timing_info_present_flag 1; num_units_in_tick 1; time_scale 50   (50 / (2 * 1) = 25, what the reader returned)
```

So for these files the HEVC statement `HEVC_1080P` omits a rate the stream states (25, in the sequence parameter set's VUI; the video parameter set states none). Consequences, both from `streamProfileDiffers` as run:

- Without WP-10a: a code minted as `HEVC_1080P` (design addendum 7.2) or `HEVC_1080P25` raises no notice. The codec mismatch `H264_...` over an HEVC stream raises it, as designed.
- With WP-10a later: the statement becomes `HEVC_1080P25` and a stored `HEVC_1080P` then raises the notice (addendum 7.2, last rule) - WP-10a before the first production adoption, or not at all.

## 5. Where the reading path names H.264 literally (nothing changed)

Code:

| Place | What |
|---|---|
| `apps/core-server/src/capture/fragments.ts:457` | `VideoCodec = { H264: 'H264', HEVC: 'HEVC' }` |
| `fragments.ts:459` | the map `avc1`, `avc3` -> `H264`; `hvc1`, `hev1` -> `HEVC` |
| `fragments.ts:571` | `avcDeclaredFrameRate`: the only parameter-set reader; refuses a NAL unit that is not an H.264 sequence parameter set (`:572`, type 7) |
| `fragments.ts:702-705` | the rate is read from a child box named `avcC` only |
| `apps/core-server/src/sealing-host/demo-seed/index.ts:243`, `demo-seed/source-arguments.ts:29` | the demo seed's `codec: 'H264'` and `DEMO_CAMERA_PROFILE = 'H264_720P30'` (seed data, not the reader) |

Comments and examples only: `fragments.ts:449, 453, 541-546, 552, 567-568, 695`; `session-reader.ts:89, 236-237, 243, 256-257, 271`; `demo-seed/index.ts:241-242`; `capture/fence/fake-profile.ts:6`; `engine/sealing-notice-doors.ts:163`.

No codec name at all (search `h.?264|avc|hev1|hvc|hevc|h.?265`, tests excluded): `capture-session/facts.ts`, `sealing/` (pipeline, package writer), `modules/sealing`, `modules/media-stream`, `modules/recording-fragments`, `evidence-facts`. The media route states `content-type: video/mp4` without a `codecs` parameter (`apps/core-server/src/media-stream/service.ts:45`).

The line numbers of review section 5 rows 2, 3, 4 and 11 (`verification/03_plan_review.md:123-125, 132`) still hold.

## 6. Doubles, limits, what stays unproven

- Double: the files are from FFmpeg / libx265 pushers on this Mac through the release worker (E-1, E-2). No real camera: Main profile, 8 bit, GOP 25, no B-frames. A camera stream with another profile, a long GOP or parameter sets that change is `9A/H-17`, `9A/H-20`.
- NOT a seal: no session, no database rows, no package. Not run: the pipeline's comparison of each fragment with its `recording_fragments` row (`pipeline.ts:364-386`), encryption, the package writer, the verifier. The E-1 driver kept only the count of `FRAGMENT_CHECKPOINT` records (8 per camera, equal to the walk's 8), not their values, so the walk was not compared with records (`comparison null`).
- The sealed file of a package has the same init segment in the clear (`facts.ts:241-243`); that the answers repeat on a sealed HEVC file is part of the playback half / WP-13c (L-4).
- Existing unit tests already hold the map for built init segments (`capture/__tests__/fragments.test.ts:345-354`, `sealing-host/__tests__/sealing-host.test.ts:238-240`); this row adds the worker's real files.

## 7. For the playback half (row 12) and the verdict (row 14)

Row 12 still has to show: (1) a sealed session with an HEVC source exists at all - seal, verify, manifest field 43 `HEVC` and field 36 `HEVC_...P`, no notice; (2) per client - web console, tablet, export - "plays" or "states that it cannot", with `hev1` over a `video/mp4` answer that names no codec; (3) the sample-entry name in the sealed file, which decides row 57. Row 56 (reader rate) does not depend on row 12.

## 8. Rules kept, driver decisions

- No product file changed; no commit. Written: this record, `delegation_progress/row_011.md`, one claims line, and `.cache/hevc-experiment/e8_reader/` (script and outputs).
- Incident, no effect on any file: one inspection command of mine (`grep` over a run folder) blocked on the folder's two FIFOs `mic1.pcm`, `mic2.pcm` and was moved to the background; I released it by opening each FIFO for writing without blocking and closing it (no byte written). It ended with exit 0.
- DRIVER DECISION 1: "WP-10a (reader) needed" is read as "an HEVC file is refused, misnamed or carries the notice without it". By that reading: no. If the controller reads it as "the manifest must state the rate the stream declares", the answer is yes, and section 4 is the evidence either way.
