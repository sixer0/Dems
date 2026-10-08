---
task_id: 2026-10-07_dems_real_capture_sealing
date: 2026-10-07
agent: data-collector
blueprint_row: 3
milestone: M0
class: A
tier: 2
items_collected: 102
external_queries_sent: 105
query_log_entries: 68
project_identifiers_in_queries: 0
last_updated: 2026-10-07 14:05
---

# Data Collection Report — Capture / Media Stack Facts (Row 3, M0)

## Task Overview

Collection of external, generic-source facts plus local `ffmpeg`/`ffprobe` command output covering the ten collection items assigned to blueprint row 3: fragmented-MP4 muxer flags, RTSP listen (push) mode, runtime input switching, MP4-muxer encryption, per-fragment hash chains and box byte ranges, GStreamer availability on Homebrew and Linux x86, MediaMTX, ONVIF client libraries, LGPL/GPL build-flag consequences, and public statements about fragmented MP4 as a single evidentiary item.

Scope discipline: **facts only**. No engine recommendation, no design judgement, no code changes, no repository edits outside this task folder. Every row carries a URL citation or quoted local command output. Rows 7/8/9/14 own the empirical measurement; this row only supplies documented behaviour and tool availability.

Acceptance criteria from `identification/02_structured.md` row 3 Verification column:
1. every fact cites a URL or local `ffmpeg -h` output — met (column "Citation");
2. query log lists every query with 0 project names, paths or identifiers — met (`## Query Log`).

Local host baseline used for all local probes: FFmpeg 9.0.2 (Homebrew, arm64), quoted in `## Local Command Output Evidence`.

---

## Fact Table

Confidence key: **H** = primary source (project manual, project source file with line number, or locally executed command output); **M** = vendor/publisher page or package registry metadata, not independently reproduced here; **L** = secondary source or inference from a fetched source, flagged for confirmation in a later row.

### Group 1 — Fragmented MP4 muxer behaviour (unblocks rows 7, 31, 32)

| ID | Fact | Value | Citation | Conf | Unblocks |
|----|------|-------|----------|------|----------|
| F-01 | Local FFmpeg build identity | `ffmpeg version 9.0.2`, `libavutil 61.1.102`, `libavcodec 63.1.102`, prefix `/opt/homebrew/Cellar/ffmpeg/9.0.2` | Local `ffmpeg -version` (see evidence block E-1) | H | 2, 7, 8 |
| F-02 | Fragmentation trigger set on the mp4 muxer | Fragments are created when any of `frag_duration`, `frag_size`, `movflags +frag_keyframe`, `movflags +frag_custom` fires; `min_frag_duration` must additionally be satisfied for any of them to apply | FFmpeg manual, MP4 muxer section: https://ffmpeg.org/ffmpeg-formats.html ("Fragmentation is enabled by setting one of the options…") | H | 7, 31 |
| F-03 | `frag_duration` unit and meaning | "Maximum fragment duration", type `<int>`, **microseconds**; manual: "Create fragments that are duration microseconds long" | `ffmpeg -h muxer=mp4` (E-2); https://ffmpeg.org/ffmpeg-formats.html | H | 7, 31 |
| F-04 | `frag_size` meaning | "Maximum fragment size" — payload bytes per fragment, not file bytes | `ffmpeg -h muxer=mp4` (E-2); formats manual | H | 7, 31 |
| F-05 | `frag_type` is **not** an mp4-muxer option | `frag_type` (values `none` / `every_frame` / `duration` / `pframes`) exists only on the **dash** muxer; the mp4 muxer exposes `frag_duration`, `frag_size`, `min_frag_duration` and the movflags instead | `ffmpeg -h full` — `frag_type` appears under "dash muxer AVOptions" only (E-3); absent from `ffmpeg -h muxer=mp4` | H | 7, 31 |
| F-06 | `empty_moov` semantics | movflag "Make the initial moov atom empty" → header box carries track setup only, no sample tables, so nothing has to be rewritten after the first byte of media | `ffmpeg -h muxer=mp4` (E-2); source `movenc.c:98` https://raw.githubusercontent.com/FFmpeg/FFmpeg/master/libavformat/movenc.c | H | 7, 31 |
| F-07 | `empty_moov` is undocumented in the HTML manual | The movflags list in `ffmpeg-formats.html` covers `cmaf`, `dash`, `default_base_moof`, `delay_moov`, `disable_chpl`, `faststart`, `frag_custom`, `frag_discont`, `frag_every_frame`, `frag_keyframe`, `global_sidx`, `isml`, `negative_cts_offsets`, `omit_tfhd_offset`, `prefer_icc`, `rtphint`, `separate_moof`, `skip_sidx`, `skip_trailer`, `use_metadata_tags`, `write_colr`, `write_gama`, `hybrid_fragmented` — `empty_moov` is **not** among them, although the option exists and works | https://ffmpeg.org/ffmpeg-formats.html vs `ffmpeg -h muxer=mp4` (E-2) | H | 7, 31 |
| F-08 | `default_base_moof` semantics | Avoids writing absolute `base_data_offset` in `tfhd` by using the `default-base-is-moof` flag; manual states the flag "is new from 14496-12:2012" and "may make the fragments easier to parse… avoiding basing track fragment location calculations on the implicit end of the previous track fragment" | https://ffmpeg.org/ffmpeg-formats.html | H | 7, 31, 32 |
| F-09 | `omit_tfhd_offset` semantics and redundancy | Manual: "Do not write any absolute base_data_offset in tfhd atoms. This avoids tying fragments to absolute byte positions." Source clears the flag when `default_base_moof` is also set: "if the latter is set that's enough and omit_tfhd_offset doesn't add anything extra" | https://ffmpeg.org/ffmpeg-formats.html; `movenc.c:8367-8371` | H | 7, 31 |
| F-10 | `dash` movflag implies three flags | `movflags +dash` sets `FRAGMENT \| EMPTY_MOOV \| DEFAULT_BASE_MOOF`; `+cmaf` sets the same plus `NEGATIVE_CTS_OFFSETS` | `movenc.c:8324-8329` https://raw.githubusercontent.com/FFmpeg/FFmpeg/master/libavformat/movenc.c | H | 7, 31 |
| F-11 | `delay_moov` implies `empty_moov` | Source: `if (mov->flags & FF_MOV_FLAG_DELAY_MOOV) mov->flags \|= FF_MOV_FLAG_EMPTY_MOOV;` — moov is written at the first fragment cut/flush | `movenc.c:8296-8297`; manual movflag text "Delay writing the initial moov until the first fragment is cut, or until the first fragment flush" | H | 7, 31 |
| F-12 | `moov_size` is the preallocation knob for **non**-fragmented output | "Reserves space for the moov atom at the beginning of the file instead of placing the moov atom at the end. If the space reserved is insufficient, muxing will fail." Not the append-only mechanism; `empty_moov` is | https://ffmpeg.org/ffmpeg-formats.html; `ffmpeg -h muxer=mp4` (E-2) | H | 31 |
| F-13 | `write_prft` writes a producer reference time box with a chosen NTP source | Type `<int>` 0..2, default 0; values `wallclock`=1, `pts`=2. Manual: PRFT "with a specified time source for the NTP field"; `pts` "applicable only for a live encoding use case, where PTS values are set as wallclock time at the source" | `ffmpeg -h muxer=mp4` (E-2); https://ffmpeg.org/ffmpeg-formats.html | H | 7, 31, 32 |
| F-14 | `default_prft` does **not** exist in this build | No `default_prft` token anywhere in `ffmpeg -h full` output (14,000 lines) and none in `movenc.c` movflags table | Local `ffmpeg -h full` grep (E-3); `movenc.c` grep | H | 31 |
| F-15 | Fragment-number option on the mp4 muxer | There is **no** `frag_start_number` on the mp4 muxer. The numbering option is `-fragment_index <int> 1..INT_MAX (default 1)` — "Fragment number of the next fragment". Sequence-number options belong to other muxers: `-start_number` (dash/hls/image2), `-segment_start_number` (segment muxer, default 0) | `ffmpeg -h muxer=mp4` (E-2); `ffmpeg -h muxer=segment`; `ffmpeg -h full` lines 3378, 3439, 3991 (E-3) | H | 7, 31 |
| F-16 | `frag_discont` movflag exists to signal discontinuity | "Signal that the next fragment is discontinuous from earlier ones" — the container-level way to mark a break without splitting files | `ffmpeg -h muxer=mp4` (E-2); formats manual | H | 8, 31, 32 |
| F-17 | `separate_moof` gives one moof/mdat pair per track | "Write a separate moof (movie fragment) atom for each track. Normally, packets for all tracks are written in a moof atom (which is slightly more efficient), but with this option set, the muxer writes one moof/mdat pair for each track, making it easier to separate tracks." | https://ffmpeg.org/ffmpeg-formats.html | H | 7, 31, 32 |
| F-18 | `frag_interleave` conflicts with `omit_tfhd_offset` / `separate_moof` | Source returns `AVERROR(EINVAL)` with "Sample interleaving in fragments is mutually exclusive with omit_tfhd_offset and separate_moof" | `movenc.c:8373-8379` | H | 31 |
| F-19 | `skip_trailer` suppresses the fragmented-file index trailer | movflag "skip writing the mfra/tfra/mfro trailer for fragmented files" — relevant when the writer must never rewrite or append an index | `ffmpeg -h muxer=mp4` (E-2) | H | 7, 31 |
| F-20 | Interrupted-write claim for fragmented output | Manual: "Writing a fragmented file has the advantage that the file is decodable even if the writing is interrupted (while a normal MOV/MP4 is undecodable if it is not properly finished), and it requires less memory when writing very long files… The downside is that it is less compatible with other applications." | https://ffmpeg.org/ffmpeg-formats.html | H | 7, 31, 32 |
| F-21 | `hybrid_fragmented` movflag is the recoverability variant | "For recoverability - write the output file as a fragmented file. This allows the intermediate file to be read while being written (in particular, if the writing process is aborted uncleanly). When writing is finished, the file is converted to a regular, non-fragmented file… If writing is aborted, the intermediate file can manually be remuxed" | https://ffmpeg.org/ffmpeg-formats.html | H | 7, 31 |
| F-22 | `hybrid_fragmented` and `faststart` are mutually exclusive | Source errors out: "Setting both hybrid_fragmented and faststart is not supported." Manual also says faststart "will not work in various situations such as fragmented output" | `movenc.c:8311-8315`; https://ffmpeg.org/ffmpeg-formats.html | H | 7, 31 |
| F-23 | Truncated fMP4 still probes (local observation) | A 4.00 s h264+aac fMP4 truncated to 60 % of its bytes (44,005 of 73,342) probes with exit 0: `nb_streams=2`, `duration=3.021406`, `size=44005`, streams `0,h264` and `1,aac` | Local probe E-6 | H | 7, 31 |
| F-24 | `empty_moov` disables automatic bitstream filtering | Source: "Empty MOOV enabled; disabling automatic bitstream filtering" (`s->flags &= ~AVFMT_FLAG_AUTO_BSF`) — affects codec-copy paths that rely on muxer-inserted BSFs | `movenc.c:8331-8334` | H | 7, 31 |
| F-25 | Real-world append-only fMP4 part size precedent | MediaMTX records streams as fMP4 with defaults `recordFormat: fmp4`, `recordPartDuration: 1s`, `recordMaxPartSize: 50M`, `recordSegmentDuration: 1h` | https://raw.githubusercontent.com/bluenviron/mediamtx/main/mediamtx.yml lines 576-596 | M | 7, 31 |

### Group 2 — RTSP listen (push) mode between two FFmpeg processes (unblocks rows 7, 9, 31)

| ID | Fact | Value | Citation | Conf | Unblocks |
|----|------|-------|----------|------|----------|
| F-26 | `listen` is an **input-side** (demuxer) flag only | `-rtsp_flags listen` is listed on the RTSP **demuxer** with flag mask `.D.........`; the RTSP **muxer** (`ffmpeg -h muxer=rtsp`) exposes no `rtsp_flags` at all | `ffmpeg -h demuxer=rtsp`, `ffmpeg -h muxer=rtsp` (E-2) | H | 7, 9 |
| F-27 | `-listen_timeout` implies listen | "-listen_timeout <int> … set maximum timeout (in seconds) to wait for incoming connections (-1 is infinite, imply flag listen) (default -1)" | `ffmpeg -h demuxer=rtsp` (E-2) | H | 7 |
| F-28 | `-rtsp_transport tcp` is available on both directions | Flag set `ED` (export+demux) with values `udp`, `tcp`; demuxer additionally offers `udp_multicast`, `http`, `https` tunneling and `prefer_tcp` | `ffmpeg -h demuxer=rtsp`, `ffmpeg -h muxer=rtsp` (E-2) | H | 7, 9 |
| F-29 | Listening side waits for `ANNOUNCE` then `SETUP` | `rtsp_read_announce()` requires `Content-Type: application/sdp`, parses the SDP with `ff_sdp_parse()`, and the server advertises `Public: ANNOUNCE, PAUSE, SETUP, TEARDOWN, RECORD` | `rtspdec.c:191-254` https://raw.githubusercontent.com/FFmpeg/FFmpeg/master/libavformat/rtspdec.c | H | 7 |
| F-30 | Pushing side sends `ANNOUNCE` + `RECORD` | `rtspenc.c` issues `ff_rtsp_send_cmd_with_content(s, "ANNOUNCE", …, "Content-Type: application/sdp\r\n", …)` then `ff_rtsp_send_cmd(s, "RECORD", …, "Range: npt=0.000-\r\n")`, and `TEARDOWN` at close | `rtspenc.c:85-120, 240` https://raw.githubusercontent.com/FFmpeg/FFmpeg/master/libavformat/rtspenc.c | H | 7 |
| F-31 | Resulting two-process command shape | Ingest/server: `ffmpeg -rtsp_flags listen -i rtsp://<addr>:<port>/ <output-options> out.mp4`. Pusher/client: `ffmpeg -re -f lavfi -i testsrc … -f lavfi -i sine … -rtsp_transport tcp -f rtsp rtsp://<addr>:<port>/`. The listener is the RTSP server; the pusher is an RTSP client using the rtsp muxer | Derived from F-26/F-29/F-30 (both endpoints implemented in FFmpeg itself). Not executed in this row — measured in row 7 | M | 7, 9 |
| F-32 | State machine forces re-handshake per session; nothing persists | In `RTSP_STATE_IDLE` only `ANNOUNCE` and `OPTIONS` are accepted; each new connection therefore renegotiates its SDP. No SDP or track state is written to disk by the demuxer | `rtspdec.c:431-450` | H | 7, 31 |
| F-33 | Track setup after a restart is renegotiated, not restored | Consequence of F-30 + F-32: the pusher regenerates the SDP (payload types, `sprop-*` parameters) on every `ANNOUNCE`; a restarted ingest process sees whatever SDP the new session carries | Derived from F-30, F-32 | M | 7, 31 |
| F-34 | Port conventions | RTSP default port 554 (RFC 2326 convention); MediaMTX default `rtspAddress: :8554`, `rtspsAddress: :8322`, SRTP `:8004/:8005`; FFmpeg binds the port given in the listen URL; UDP range options `-min_port` (5000) / `-max_port` (65000) | `ffmpeg -h demuxer=rtsp` (E-2); mediamtx.yml lines 243-266 | H/M | 7, 9 |
| F-35 | MediaMTX RTSP handshake is always TCP | Config comment: "Enabled RTSP transport protocols. The handshake is always performed with TCP." `rtspTransports: [udp, multicast, tcp]`, `rtspAuthMethods: [basic]` | mediamtx.yml lines 244-280 | M | 9, 31 |
| F-36 | FFmpeg HTML manual has no prose section for RTSP listen mode | Searching `ffmpeg-formats.html` and `ffmpeg.html` for "listen" yields no RTSP-related prose; the only authoritative description is the AVOption help text and the source | Local grep of https://ffmpeg.org/ffmpeg-formats.html and https://ffmpeg.org/ffmpeg.html (E-4) | H | 7 |

### Group 3 — Runtime input switching and the AAC discontinuity floor (unblocks rows 8, 31)

| ID | Fact | Value | Citation | Conf | Unblocks |
|----|------|-------|----------|------|----------|
| F-37 | `astreamselect` options | Filter `astreamselect` (shared implementation with `streamselect`): `inputs <int> 2..INT_MAX (default 2)`, `map <string>`; dynamic inputs and outputs; flag `T` on `map` (timeline-capable) | `ffmpeg -h filter=astreamselect` (E-2); https://ffmpeg.org/ffmpeg-filters.html#streamselect_002c-astreamselect | H | 8, 31 |
| F-38 | Runtime command surface of the filter | "The streamselect and astreamselect filter supports the following commands: `map` — Set input indexes to remap to outputs." | https://ffmpeg.org/ffmpeg-filters.html (Commands subsection) | H | 8, 31 |
| F-39 | Documented switching mechanism is time-scheduled, not operator-triggered | Manual examples: `sendcmd='5.0 streamselect map 1',streamselect=inputs=2:map=0` and `asendcmd='5.0 astreamselect map 1',astreamselect=inputs=2:map=0` | https://ffmpeg.org/ffmpeg-filters.html | H | 8, 31 |
| F-40 | `sendcmd`/`asendcmd` command grammar is interval-based | Interval syntax `START[-END] COMMANDS;`; command syntax `[FLAGS] TARGET COMMAND ARG`; flags `enter`, `leave`, `expr`; commands fire when the **current frame timestamp** enters/leaves the interval; commands supplied via the `commands` option or a `filename` script | https://ffmpeg.org/ffmpeg-filters.html#sendcmd_002c-asendcmd | H | 8, 31 |
| F-41 | Consequence for an operator-initiated switch | Because `asendcmd` triggers on media timestamps rather than on an external signal, a wall-clock operator switch cannot be expressed with the CLI filter graph alone; the documented CLI mechanism covers pre-scheduled switches. External injection would need the libavfilter API (`avfilter_graph_send_command`) rather than the `ffmpeg` CLI | Derived from F-39/F-40. Row 8 measures what is actually achievable | M | 8, 31 |
| F-42 | `concat` filter is sequential, not a switch | "Concatenate audio and video streams, joining them together one after the other… All segments must have the same number of streams of each type… For this filter to work correctly, all segments must start at timestamp 0. All corresponding streams must have the same parameters in all segments; the filtering system will automatically select a common pixel format for video streams, and a common sample format, sample rate and channel layout for audio streams, but other settings, such as resolution, must be converted explicitly by the user." | https://ffmpeg.org/ffmpeg-filters.html#concat | H | 8, 31 |
| F-43 | `concat` gapless behaviour and audio padding | "The concat filter will use the duration of the longest stream in each segment (except the last one), and if necessary pad shorter audio streams with silence." Different frame rates are accepted but produce VFR output | https://ffmpeg.org/ffmpeg-filters.html#concat | H | 8, 31 |
| F-44 | AAC frame size at 48 kHz — arithmetic confirmed | Local `ffprobe` on a 48 kHz AAC-LC track reports `time_base=1/48000`, packet `duration=1024`, `duration_time=0.021333` → 1024 / 48000 = 0.0213333 s = **21.33 ms** per AAC frame | Local probe E-5 | H | 8, 31 |
| F-45 | AAC block-size standard basis | "AAC uses a pure MDCT… AAC uses a blocksize of 1024 or 960 samples, allowing more efficient coding than MP3's 576 sample blocks; higher coding accuracy for transient signals (AAC uses a blocksize of 128 o[r 120]…)" — long frame 1024 (960 variant exists; short window 128/120) | https://en.wikipedia.org/wiki/Advanced_Audio_Coding (encoding block size section); normative standard designation ISO/IEC 14496-3 | M | 8 |
| F-46 | Caveat on the 21.3 ms floor | The 21.33 ms floor holds for long-window frames only; a short-window (128-sample) frame would be 2.67 ms at 48 kHz, and the 960-sample variant is 20.0 ms. Encoder configuration decides which applies | Derived from F-45; local encoder behaviour measured in E-5 shows 1024 for FFmpeg's `aac` encoder | M | 8, 31 |

### Group 4 — Encryption inside the MP4 muxer (unblocks rows 31, 32)

| ID | Fact | Value | Citation | Conf | Unblocks |
|----|------|-------|----------|------|----------|
| F-47 | Only two encryption schemes are accepted by the mp4 muxer | `-encryption_scheme` allowed values are `none` and `cenc-aes-ctr`; source maps anything else to an error, so **no GCM path exists in the muxer** | `ffmpeg -h muxer=mp4` (E-2); `movenc.c:84, 8532-8538` | H | 31, 32 |
| F-48 | CENC key length is fixed at 16 bytes | `AES_CTR_KEY_SIZE (16)`, `AES_CTR_IV_SIZE (8)`; muxer rejects a wrong key length: "Invalid encryption key len %d expected %d" | https://raw.githubusercontent.com/FFmpeg/FFmpeg/master/libavutil/aes_ctr.h lines 35-36; `movenc.c:8536-8538` | H | 31, 32 |
| F-49 | What CENC encrypts in the box tree | Per-packet IVs and optional subsample ranges are written as auxiliary info (`senc`-style) with `saio`/`saiz` sample-table atoms: `ff_mov_cenc_write_stbl_atoms()` is called for fragmented output at the moof offset, and `ff_mov_cenc_write_sinf_tag()` writes the protection metadata into the sample description | `movenc.c:1478, 1619-1620, 3121-3122, 5996-5997, 3510-3511`; `movenccenc.c:534, 562` | H | 31, 32 |
| F-50 | Sample tables stay in the clear | Encryption is applied while packet payloads are written (`ff_mov_cenc_write_packet`, `…_avc_parse_nal_units`, `…_av1_write_obus`); the structural boxes (moov/trak/stbl, moof/trun) are written by normal muxer paths and are not encrypted | `movenc.c:7234-7360`; `movenccenc.c:173-190` | H | 31, 32 |
| F-51 | Subsample (partial-clear) capability | `use_subsamples` allows parts of a packet to be encrypted: "when enabled parts of a packet can be encrypted, otherwise the whole packet is encrypted"; comment in code: "The spec requires encrypted bytes to be in blocks multiple of 16" | `movenccenc.h:47-50, 65-68`; `movenccenc.c:347` | H | 31, 32 |
| F-52 | Integrity consequence of CTR mode | AES-CTR is a stream cipher mode with no authentication tag: ciphertext malleability translates directly to predictable plaintext changes, so CENC provides confidentiality only and cannot itself prove a fragment is untampered | Property of CTR mode (NIST SP 800-38A definition of CTR as an unauthenticated confidentiality mode); no MAC/AEAD tag is written by the muxer per F-47/F-49 | H | 31, 32 |
| F-53 | Alternative shape: per-fragment AEAD outside the muxer | Since the muxer offers no GCM (F-47), an authenticated-per-fragment scheme must wrap the stored fragment bytes (in-band container or sidecar) and keep the hash/tag independent of the muxer; C2PA's BMFF hash assertion is the published example of hashing selected boxes/segments of a BMFF asset (F-58..F-60) | Absence evidence F-47; https://c2pa.org/specifications/specifications/2.3/specs/C2PA_Specification.html §18.6 | M | 31, 32 |

### Group 5 — Per-fragment hash chains and reading box byte ranges (unblocks rows 7, 31, 32)

| ID | Fact | Value | Citation | Conf | Unblocks |
|----|------|-------|----------|------|----------|
| F-54 | `ffprobe` exposes per-packet byte position and length | `-show_packets` fields include `pos` (byte offset) and `size` (bytes), e.g. video packet 0: `pts=0, dts=0, duration=786, size=3372, pos=1825, flags=K__`; audio packet 0: `duration=1024, size=188, pos=12633` | Local probe E-5; field list from `ffprobe -show_packets -of json` | H | 7, 32 |
| F-55 | `ffprobe` has no ISO-BMFF box-tree dump | `ffprobe -h full` contains no box-dump option (only unrelated matches such as `AudioToolbox`); `-show_entries` selects stream/format/packet/frame/chapter/program entries, not container boxes | Local `ffprobe -h full` grep (E-4) | H | 7, 32 |
| F-56 | Bento4 `mp4dump` is a box dumper with JSON output | `mp4dump [options] <input>`; `--verbosity <n>` (0-3), `--track <track_id>[:<key>]` (writes track data, optionally decrypting with a 128-bit hex key), `--format text\|json` | https://www.bento4.com/documentation/mp4dump/ | M | 32 |
| F-57 | GPAC `MP4Box` is the other box-inspection route, dual-licensed | GPAC README: "GPAC is distributed under the LGPL v2.1 or later, and is also available, for most of it, under a commercial license"; GitHub licence detection reports `LGPL-2.1` | https://raw.githubusercontent.com/gpac/gpac/master/README.md line 38; https://api.github.com/repos/gpac/gpac/license | M | 32 |
| F-58 | Published practice for partial hashing of BMFF assets (C2PA) | C2PA §18.5.1: "Each data hash assertion defines a specified range of bytes over which the hash has been computed. If only a portion of the asset shall be hashed, then the range(s) to be excluded shall be present in the array value of the exclusions field… For data hash exclusion ranges, the range shall begin and end within the same logical unit (e.g., box, segment, object) and shall not overlap with any header or length field associated with that unit, except for freebox or pad data." | https://c2pa.org/specifications/specifications/2.3/specs/C2PA_Specification.html §18.5.1 | H | 31, 32 |
| F-59 | C2PA defines a BMFF-specific hash assertion with a Merkle tree | §18.6.1: assertion label `c2pa.hash.bmff.v3`; "All Merkle trees used in BMFF-based hash assertions shall be balanced binary trees with the minimum depth necessary to accommodate leaf nodes, where NULL padding is applied only to the rightmost positions…"; §18.6.2: "all bytes of the file are added to the hash excluding those BMFF boxes or subset[s] thereof which match any exclusion entry" | Same URL, §18.6.1-18.6.2 | H | 31, 32 |
| F-60 | C2PA schema separates whole-file, per-segment, per-mdat and live-sequence cases | CDDL `bmff-hash-map`: `hash` — "For non-fragmented MP4, this is the hash of the entire BMFF file excluding boxes listed in the exclusions array. For fragmented MP4 (live or VOD), this field is the hash of the segment excluding boxes listed in the exclusions array."; `merkle` — "A set of Merkle tree rows and the associated data required to enable verification of a single 'mdat' box, multiple 'mdat' boxes, and/or individual fragment files within the asset."; `sequenceNumber` — "in a live video workflow, the monotonically increasing sequence number for each segment" | Same URL, §18.6.3 | H | 31, 32 |
| F-61 | C2PA addresses long-lived capture sessions separately | §17/§20 area notes a session-key mechanism: "To address the risk of the Claim Generator's certificate getting revoked during a very long lived session, the validator should check that the certificate used to sign the C2PA Manifest from which the current session key was retrieved is still valid… the validation of that segment shall fail with a failure code of `livevideo.sessionkey.invalid`" | Same URL (live-video session-key text) | H | 31, 32 |
| F-62 | Hash-over-stored-bytes vs hash-over-plaintext are different objects | With CENC (F-49/F-50) the stored fragment bytes are ciphertext while the sample tables stay clear, so a hash over stored bytes verifies integrity without the key but not plaintext content; a plaintext hash requires decryption first. Both are representable under the exclusion-range model of F-58 | Derived from F-49, F-50, F-58 (no external claim needed) | H | 31, 32 |

### Group 6 — GStreamer on Homebrew/macOS and Linux x86 (unblocks rows 13, 14, 15)

| ID | Fact | Value | Citation | Conf | Unblocks |
|----|------|-------|----------|------|----------|
| F-63 | GStreamer is not installed on this host | `gst-launch-1.0 not found`, `gst-inspect-1.0 not found`; `MP4Box not found`; `ffmpeg`/`ffprobe` resolve to `/opt/homebrew/bin/` | Local `which` probe (E-1) | H | 2, 13 |
| F-64 | Homebrew has exactly one GStreamer formula | `formulae.brew.sh/api/formula/gstreamer.json` → stable `1.28.7`, bottle available; `gst-plugins-base`, `gst-plugins-good`, `gst-plugins-bad`, `gst-plugins-rs`, `gst-libav` all return HTTP 404 from the same API | https://formulae.brew.sh/api/formula/gstreamer.json ; sibling 404s recorded in the query log | H | 13, 15 |
| F-65 | That formula bundles the Rust plugins | Formula declares `resource "rs"` with url `…/gst-plugins-rs/-/archive/gstreamer-1.28.7/gst-plugins-rs-gstreamer-1.28.7.tar.bz2`, installed into `subprojects/gst-plugins-rs`, and meson arg `-Drs=enabled` | https://raw.githubusercontent.com/Homebrew/homebrew-core/HEAD/Formula/g/gstreamer.rb (lines 13-14, 39-40, install block) | H | 13, 14 |
| F-66 | The formula builds base+good+bad+ugly+libav+rtsp_server+tools | Meson args include `-Dbase=enabled -Dgood=enabled -Dugly=enabled -Dbad=enabled -Dlibav=enabled -Drtsp_server=enabled -Ddevtools=enabled -Dges=enabled -Dtls=enabled -Dtools=enabled` | Same formula source | H | 13, 14 |
| F-67 | `isobmff` is the Rust plugin that provides `isofmp4mux` | gst-plugins-rs README, `mux` group: "`isobmff`: A MP4/ISOBMFF/CMAF muxer for generating fragmented (e.g. DASH/HLS media) and non-fragmented (MP4) files" providing `cmafmux`, `dashmp4mux`, `isofmp4mux`, `isomp4mux`, `onviffmp4mux`, `onvifmp4mux` | https://gitlab.freedesktop.org/gstreamer/gst-plugins-rs/-/raw/main/README.md lines 188-194 | H | 13, 14, 15 |
| F-68 | Element metadata for `isofmp4mux` | Docs page: "ISO fragmented MP4 muxer", hierarchy `… → GstAggregator → GstFMP4Mux → isofmp4mux`, implements `GstChildProxy`; Classification `Codec/Muxer`; Rank `primary`; **Plugin `isobmff`**; **Package `gst-plugin-isobmff`**; sink pads `sink_%u` accepting `video/x-h264` (avc/avc3), `video/x-h265` (hvc1/hev1), `video/x-h266`, `vp8`, `vp9`, `av1`, raw/zlib-compressed, and audio `audio/mpeg`, `audio/x-ac3`, `audio/x-eac3`, `audio/x-flac`, `audio/x-opus`, `audio/x-raw`; only property exposed on the page is `offset-to-zero` ("Offsets all streams so that the earliest stream starts at 0", default false) | https://gstreamer.freedesktop.org/documentation/isobmff/isofmp4mux.html?notgi=true | H | 13, 14, 31 |
| F-69 | `isobmff` build option defaults to `auto` | `option('isobmff', type: 'feature', value: 'auto', description: 'Build ISO BMFF plugin')`; meson.build registers `'isobmff': {'library': 'libgstisobmff', examples: [dash_vod, hls_live, hls_vod]}`; the Homebrew formula passes no `-Dgst-plugins-rs:isobmff=` override | https://gitlab.freedesktop.org/gstreamer/gst-plugins-rs/-/raw/main/meson_options.txt line 36; …/meson.build lines 104-110; Homebrew formula arg list | H | 13 |
| F-70 | `input-selector` element facts | "Direct one out of N input streams to the output pad." Sink pads are a `GstPad` subclass (`GstSelectorPad`) with per-pad properties `running-time`, `tags`, `active`, `always-ok` ("Make an inactive pad return GST_FLOW_OK instead of GST_FLOW_NOT_LINKED"); pad template `sink_%u` (request, ANY) → `src` (always, ANY); Classification `Generic`; Rank `none`; Plugin `coreelements`; Package `GStreamer` | https://gstreamer.freedesktop.org/documentation/coreelements/input-selector.html?notgi=true | H | 14, 31 |
| F-71 | `rtspsrc` and `qtdemux` locations | `rtspsrc`: Classification `Source/Network`, Rank `primary`, Plugin `rtsp`, Package `GStreamer`. `qtdemux`: Classification `Codec/Demuxer`, Rank `primary`, Plugin `isomp4`, Package `GStreamer` | https://gstreamer.freedesktop.org/documentation/rtsp/rtspsrc.html?notgi=true ; https://gstreamer.freedesktop.org/documentation/isomp4/qtdemux.html?notgi=true | H | 14 |
| F-72 | Verification command shape | `gst-inspect-1.0 isofmp4mux`, `gst-inspect-1.0 input-selector`, `gst-inspect-1.0 rtspsrc`, `gst-inspect-1.0 qtdemux` — exit 0 means the element is registered; the element→plugin/package names above are what `gst-inspect-1.0` prints | Standard tool behaviour; element names per F-68/F-70/F-71. Row 13 gate uses exactly the first two | M | 13 |
| F-73 | Linux distro packaging for the Rust plugins was not found | Searches returned no package: Debian package search (`keywords=plugins-rs`, `gstreamer+plugins+rs`) → no name matches; `packages.debian.org/trixie/gstreamer1.0-plugins-rs` and `…/gstreamer1.28-plugins-rs` → "No such package"; `tracker.debian.org/pkg/gst-plugin-rs` → 404; `sources.debian.org/api/src/gst-plugin-rs/` → `{"error":404}`; Fedora `src.fedoraproject.org/rpms/gstreamer1-plugins-rs` → 404; Arch official search (`?q=gst-plugins-rs`, `?name=gst-plugin-plugins-rs`) → empty; AUR RPC search (`gst-plugins-rs`, `rust-gst-plugins-rs`) → no results; Alpine package search for `isobmff` → no match | Query log entries Q-38..Q-52 (all generic) | M | 14, 15 |
| F-74 | Practical consequence for an x86 Linux target device | On Linux the Rust plugins are obtained by building `gst-plugins-rs` from source (meson + cargo-c, per its own build requirements) rather than from a distribution package; the GStreamer core/base/good/bad sources are the monorepo `subprojects/` | Derived from F-73 plus the gst-plugins-rs build files cited in F-69 | M | 14, 15 |

### Group 7 — MediaMTX as an RTSP test server (unblocks rows 9, 14, 31)

| ID | Fact | Value | Citation | Conf | Unblocks |
|----|------|-------|----------|------|----------|
| F-75 | Identity and licence | "MediaMTX is a ready-to-use and zero-dependency live media server and media proxy that allows to publish, read, proxy, record and playback real-time video and audio streams"; LICENSE file is MIT ("Copyright (c) 2019 aler9") | https://raw.githubusercontent.com/bluenviron/mediamtx/main/README.md ; …/LICENSE | H | 9, 14 |
| F-76 | Homebrew availability | Formula `mediamtx`, stable `1.21.1`, bottle available, licence `MIT`, desc "Zero-dependency real-time media server and media proxy" | https://formulae.brew.sh/api/formula/mediamtx.json | H | 9, 14 |
| F-77 | Portability and footprint claim | "Compatible with Linux, Windows and macOS, does not require any dependency or interpreter, it's a single executable" | mediamtx README | M | 9, 14, 15 |
| F-78 | Protocol surface | Publish with Media-over-QUIC, SRT, WebRTC, RTSP, RTMP, HLS, MPEG-TS, RTP; read with Media-over-QUIC, SRT, WebRTC, RTSP, RTMP, HLS; automatic protocol conversion; several streams in separate paths; hot reload of configuration | mediamtx README feature list | M | 9 |
| F-79 | Path model and auth | `authMethod: internal` by default; `authInternalUsers` with user `any` (anonymous included), per-path permissions `publish`, `read`, `playback`, `api`, `metrics`, `pprof`; a localhost-only entry grants api/metrics/pprof; HTTP-based auth (`authHTTPAddress`, 20x = allow) and JWT auth (`authJWTJWKS`) also supported; regex paths via `~` prefix | mediamtx.yml lines 58-141, 472+ | M | 9, 31 |
| F-80 | Recording feature relevant to fMP4 practice | "Record streams to disk in fMP4 or MPEG-TS format", "Playback recorded streams from disk"; config keys `record`, `recordPath: ./recordings/%path/%Y-%m-%d_%H-%M-%S-%f`, `recordFormat: fmp4`, `recordPartDuration: 1s`, `recordMaxPartSize: 50M`, `recordSegmentDuration: 1h`, `recordDeleteAfter: 1d`; hooks fire on segment create/complete | mediamtx README; mediamtx.yml lines 576-596, 854-863 | M | 9, 31 |

### Group 8 — ONVIF client libraries for Node.js and Rust (unblocks rows 31, 34 and class-C C-1)

| ID | Fact | Value | Citation | Conf | Unblocks |
|----|------|-------|----------|------|----------|
| F-81 | npm `onvif` (agsh/onvif) | Latest `0.8.3`, published 2026-09-07, licence MIT, 54 published versions, repo `github.com/agsh/onvif`. README claims Profiles S/T/G/M/C/A, "WS-Discovery, WS-Security, Digest (MD5 / SHA-1 / SHA-256)", lazy-loaded services incl. `device`, `media`/`media2`, `ptz`, `events`, `imaging`, `recording/replay/search`; separate `Discovery` export with `probe()`; methods incl. `media.getProfiles()`, `media.getStreamUri({protocol:'RTSP'})` | https://registry.npmjs.org/onvif ; https://raw.githubusercontent.com/agsh/onvif/master/README.md lines 9-12, 76-96, 126, 213 | H | 31, C-1 |
| F-82 | npm `onvif` time handling | Documented connect sequence step 1: "Time synchronization — `getSystemDateAndTime()` first. ONVIF WS-Security includes a timestamp in the nonce digest, so the client needs the clock offset (`timeShift`)"; service docs reference typed request options incl. `dateTime?: Date` on `SetSystemDateAndTimeExtended` | agsh/onvif README lines 265-268, 283-285 | H | 31, C-1 |
| F-83 | npm alternatives and their state | `ts-onvif` 1.0.1 (2026-08-25, MIT, same agsh/onvif repo); `@2bad/onvif` 2.0.0 (2026-10-05, MIT, "High-performance ONVIF client for TypeScript with no runtime dependencies") with companion `@2bad/onvif-media` 2.0.0 ("ONVIF media profiles, snapshots and stream URLs") and `@2bad/onvif-events` 2.0.0; `node-onvif` 0.1.7 last published **2018-08-14** (futomi) — stale; `node-onvif-ts` 0.1.7 (2020-07-25) — stale; `onvif-rx` 9.0.2 (2022-04-06) — stale | npm registry search `text=onvif` and per-package registry documents | H | 31 |
| F-84 | Rust `oxvif` | crates.io `oxvif` 0.17.0, updated 2026-09-14, licence MIT, repo `github.com/smiti1642/oxvif`, 15 stars, description "Async ONVIF client for IP cameras (Profile S/T/G) in Rust — discovery, PTZ, media, imaging & events". README feature table row: "Discovery and device \| WS-Discovery, capabilities, services, identity, **time**, network, users, and I/O"; requires tokio | https://crates.io/api/v1/crates/oxvif/versions ; https://api.github.com/repos/smiti1642/oxvif ; https://raw.githubusercontent.com/smiti1642/oxvif/master/README.md lines 11-19, 127-136 | H | 31 |
| F-85 | Rust `gst-plugin-onvif` | crates.io 0.15.1, updated 2026-02-28, licence **MPL-2.0**, repository is the gst-plugins-rs monorepo (`gitlab.freedesktop.org/gstreamer/gst-plugins-rs`), 15,885 downloads — i.e. shipped with the Rust plugin set rather than as a standalone client library | https://crates.io/api/v1/crates/gst-plugin-onvif/versions ; crates.io search result | H | 14, 31 |
| F-86 | Other Rust ONVIF crates | `onvif-cam-rs` 0.2.1, MIT, last release 2023-09-09 (stale); `onvif-device-rs` 0.8.0, MIT, 2026-09-29 but described as an "ONVIF Device (**server**) library"; `onvif-server` 0.1.1 (server); `onvif` 0.0.0 (placeholder, "ONVIF types and traits"); `dahua-camera-*` 0.3.1 family (vendor-specific, includes WS-Discovery and ONVIF PullPoint); `rtsp-backchannel` 0.5.2 ("Discover ONVIF cameras, resolve RTSP streams…"); `retina` 0.4.21 ("high-level RTSP multimedia streaming library", 187k downloads); `rtsp-runtime` 0.7.0 ("Sans-IO RTSP 1.0 (RFC 2326) session engine — driveable client + server") | https://crates.io/api/v1/crates?q=onvif&per_page=25 and per-crate version endpoints | H | 31 |
| F-87 | Gap in the collected ONVIF evidence | No public conformance statement (ONVIF Test Spec / profile certification) was located for any of these libraries; maintenance status above is inferred from published version dates and repository activity only | Absence across the fetched registry and README pages | M | 31, C-1 |

### Group 9 — Licensing of build configurations (unblocks rows 15, 31 and DOC-05 in M9)

| ID | Fact | Value | Citation | Conf | Unblocks |
|----|------|-------|----------|------|----------|
| F-88 | FFmpeg base licence | "FFmpeg is licensed under the GNU Lesser General Public License (LGPL) version 2.1 or later. However, FFmpeg incorporates several optional parts and optimizations that are covered by the GNU General Public License (GPL) version 2 or later. If those parts get used the GPL applies to all of FFmpeg." Also: "FFmpeg is not available under any other licensing terms, especially not proprietary/commercial ones, not even in exchange for payment." | https://ffmpeg.org/legal.html | H | 15, 31, DOC-05 |
| F-89 | First item of the project's LGPL compliance checklist | "Compile FFmpeg without `--enable-gpl` and without `--enable-nonfree`." Next item: "Use dynamic linking (on windows, this means linking to dlls) for linking with FFmpeg libraries." Checklist additionally requires distributing the exact FFmpeg source, explaining the configure line, hosting the source alongside the binary, adding the LGPLv2.1 attribution line at every download link, mentioning it in the about box and EULA, and removing reverse-engineering prohibitions from the EULA | https://ffmpeg.org/legal.html ("License Compliance Checklist") | H | 15, 31, DOC-05 |
| F-90 | Explicit GPL-library warning in the checklist | "Make sure your program is not using any GPL libraries (notably libx264)." | https://ffmpeg.org/legal.html | H | 15, DOC-05 |
| F-91 | This host's FFmpeg build is a GPL build | Configuration string contains `--enable-gpl`, `--enable-libx264`, `--enable-libx265`, `--enable-version3`, `--enable-libsvtav1`, `--enable-libopus`, `--enable-libmp3lame`, `--enable-libdav1d`, `--enable-libvmaf`, `--enable-libvpx`, `--enable-openssl`, `--enable-videotoolbox`, `--enable-audiotoolbox`, `--enable-neon` | Local `ffmpeg -version` (E-1) | H | 2, 15, DOC-05 |
| F-92 | Homebrew's GStreamer formula declares LGPL but is configured GPL | Formula `license all_of: ["LGPL-2.0-or-later", "LGPL-2.1-or-later", "MIT"]` **and** meson arg `-Dgpl=enabled`, with build dependencies `x264`, `x265`, `ffmpeg` | https://raw.githubusercontent.com/Homebrew/homebrew-core/HEAD/Formula/g/gstreamer.rb ; https://formulae.brew.sh/api/formula/gstreamer.json | H | 13, 15, DOC-05 |
| F-93 | GStreamer's own licensing rule for code | "GStreamer is a plugin-based framework licensed under the LGPL… We require that all code going into our core packages is LGPL. For the plugin code, we require the use of the LGPL for all plugins written from scratch or linking to external libraries… We do not accept GPL code to be added to our plugins modules, but we do accept LGPL-licensed plugins using an external GPL library for some of our plugin modules." Plugins with known patent issues go to `gst-plugins-ugly` | https://gstreamer.freedesktop.org/documentation/frequently-asked-questions/licensing.html | H | 15, DOC-05 |
| F-94 | GStreamer's guidance to application authors | "you have to make an active decision on whether you want your application to be used together with proprietary plugins or not"; suggested remedy is licensing the application LGPL/MPL/BSD, or adding a GPL exception clause (Totem example quoted on the page); "pure GPL licensed code without the above-mentioned clause is not re-usable in your application under a GPL plus exception clause" | Same page | H | 15, 31, DOC-05 |
| F-95 | Auxiliary-tool licences relevant to a verifier | Bento4: "This software is available under two different licenses. For applications that are entirely distributable under the terms of the GPL, the Bento4 GPL license applies. For applications that cannot be entirely distributable under the terms of the GPL… a non-GPL commercial license is available from Axiomatic Systems LLC." GPAC: LGPL v2.1 or later, plus commercial dual licence | https://www.bento4.com/about/ ; https://raw.githubusercontent.com/gpac/gpac/master/README.md line 38 | M | 32, DOC-05 |
| F-96 | MediaMTX licence | MIT (see F-75/F-76) | mediamtx LICENSE; formulae.brew.sh | H | 9, DOC-05 |

### Group 10 — Cross-cutting: fragmented MP4 as "one whole file" in evidentiary contexts

| ID | Fact | Value | Citation | Conf | Unblocks |
|----|------|-------|----------|------|----------|
| F-97 | Container standard designation | ISO/IEC 14496-12 (ISO base media file format), owner ISO/IEC, extended from QuickTime, extended to MP4/3GP/3G2/.mj2/.dvb/.dcf/.m21/f4v/HEIF; latest release cited as **ISO/IEC 14496-12:2026** (April 2026); the infobox links `iso.org/standard/85596.html`; marked "Open: No" | https://en.wikipedia.org/wiki/ISO_base_media_file_format (secondary source; iso.org direct fetch returned HTTP 403 Cloudflare challenge) | M | 31, 32, OD-21 memo |
| F-98 | The standard edition that introduced the flag FFmpeg relies on | FFmpeg's own manual states the `default-base-is-moof` flag "is new from 14496-12:2012" | https://ffmpeg.org/ffmpeg-formats.html | H | 31, 32 |
| F-99 | Fragmented files are a defined form of the container, with a compatibility caveat | FFmpeg manual treats fragmented output as a mode of the same `.mp4` file (one file, boxes `moov` + repeated `moof`/`mdat`), stating it is decodable when writing is interrupted but "less compatible with other applications" (F-20). No separate file per fragment is implied | https://ffmpeg.org/ffmpeg-formats.html | H | 31, 32, OD-21 memo |
| F-100 | Forensic guidance bodies publish ISO-BMFF-specific video documents | SWGDE video-committee index lists, among others: "Best Practices for Digital Forensic Video Analysis (18-V-001-2.0)" 2025-12-10; "Best Practices for Digital Video Authentication (23-V-001-1.2)" 2024-03-07; "Best Practices for Data Acquisition from Digital Video Recorders (17-V-002-1.4)" 2025-08-21; "SWGDE Best Practices for Frame Timing Analysis of Video Stored in ISO Base Media File Formats v1.1" 2022-06-09; "SWGDE Best Practice for Frame Timing Analysis of H.264 Video Stored in ISO Base Media File Formats v1.0" 2020-09-17 | https://www.swgde.org/documents/published-by-committee/video/ | M | 32, OD-21 memo |
| F-101 | An industry provenance spec hashes fragmented MP4 as one asset | C2PA's BMFF hash assertion covers a single asset whose segments/mdat boxes are individually verified through one Merkle root, with per-segment hashes and monotonic `sequenceNumber`s (F-58..F-60) — i.e. a standardised treatment of a fragmented MP4 as one verifiable object made of hashable parts | https://c2pa.org/specifications/specifications/2.3/specs/C2PA_Specification.html §18.6 | H | 31, 32, OD-21 memo |
| F-102 | What was **not** found | No public standards-body, forensic-guidance or case-law source was located that states in terms whether a fragmented MP4 counts as "one whole file" for evidentiary purposes. The searches that produced this negative are logged (Q-53..Q-61). Reporting only; no legal conclusion is drawn here | Query log | M | 32, OD-21 memo |

---

## External Research Findings

Dimensions in scope for this row, per `identification/01_translated.md` → "External Research Scope": **Technology Evaluation (Dim 2)** and **Regulatory & Compliance (Dim 5)**.

### Technology Evaluation (Dim 2)

Collected data points, grouped by the evaluation question they feed. No ranking or recommendation is made here; row 15 scores them.

| Candidate | Capability evidence | Install/footprint evidence | Licence evidence | Facts |
|-----------|--------------------|---------------------------|------------------|-------|
| FFmpeg mp4 muxer (already on host) | Fragmentation triggers F-02..F-05; per-track fragments F-17; discontinuity signalling F-16; recoverability mode F-21; growing-file claim F-20 with local truncation observation F-23 | Present at `/opt/homebrew/bin/ffmpeg`, v9.0.2 (F-01) | LGPL base, GPL when optional parts used; this build is GPL (F-88, F-91) | F-01..F-24 |
| FFmpeg RTSP listen mode | Server side implemented in the demuxer (F-26, F-29), client push side implemented in the muxer (F-30), per-session SDP renegotiation (F-32, F-33) | No extra install (F-01) | As above | F-26..F-36 |
| FFmpeg runtime switching | `astreamselect` + `map` command (F-37, F-38); CLI trigger is media-time scheduled via `asendcmd` (F-39, F-40); `concat` is sequential with parameter-equality and silence-padding rules (F-42, F-43) | No extra install | As above | F-37..F-46 |
| GStreamer Rust `isobmff` | `isofmp4mux` element facts including rank, caps, single documented property (F-68); built by default option `auto` (F-69) | Bundled into the single Homebrew `gstreamer` 1.28.7 formula (F-64..F-66); not installed on this host (F-63); no Debian/Fedora/Arch/Alpine/AUR package found (F-73, F-74) | Framework LGPL; Rust plugin set licence not collected (gap G-4) | F-63..F-74 |
| GStreamer `input-selector` | Per-pad `active` / `running-time` / `always-ok` control surface, request pads (F-70) | In plugin `coreelements`, part of the same formula (F-66, F-70) | LGPL core | F-70 |
| GStreamer `rtspsrc` / `qtdemux` | Plugin and rank identified (F-71) | Same formula | good/core LGPL | F-71 |
| MediaMTX | RTSP/TCP handshake always TCP (F-35), path+permission model (F-79), fMP4 recording with 1 s parts (F-80) | Single executable, Linux/Windows/macOS (F-77); Homebrew `mediamtx` 1.21.1 (F-76) | MIT (F-75) | F-75..F-80 |
| ONVIF clients | Node: `onvif` (agsh) feature set incl. WS-Discovery, GetProfiles, GetStreamUri, time sync and `SetSystemDateAndTimeExtended` (F-81, F-82); Rust: `oxvif` discovery/device/time (F-84); stale options identified (F-83, F-86) | n/a (library choice) | MIT for the two leading candidates; MPL-2.0 for `gst-plugin-onvif` | F-81..F-87 |
| Verifier-side box inspection | `ffprobe` packet `pos`/`size` (F-54) but no box dump (F-55); Bento4 `mp4dump` (F-56); GPAC `MP4Box` (F-57) | Neither Bento4 nor GPAC installed here (`MP4Box not found`, F-63) | Bento4 GPL-or-commercial; GPAC LGPL-2.1+-or-commercial (F-95) | F-54..F-57 |

### Regulatory & Compliance (Dim 5)

| Item | What public sources say | Facts |
|------|------------------------|-------|
| Container standard | ISO/IEC 14496-12, latest edition cited as 2026; the `default-base-is-moof` mechanism FFmpeg relies on is stated by FFmpeg to be new in the 2012 edition | F-97, F-98 |
| Partial-content hashing of BMFF | C2PA §18.5.1 byte-range hashing with exclusion ranges bounded to "box, segment, object" units and never overlapping headers/length fields; §18.6 `c2pa.hash.bmff.v3` with balanced-binary Merkle tree over `mdat` boxes/fragments, per-segment hash and monotonic `sequenceNumber`; live-session-key validity rule | F-58..F-61 |
| Confidentiality vs authentication | The mp4 muxer implements CENC AES-CTR only (16-byte key, 8-byte IV); protection atoms sit in the sample tables which remain in the clear; CTR carries no authentication tag, so integrity must come from a separate hash/AEAD | F-47..F-52 |
| Forensic-guidance landscape | SWGDE publishes video-analysis, video-authentication, DVR-acquisition and ISO-BMFF frame-timing documents (titles, IDs, dates verified on the index page). PDF contents were **not** retrieved (gap G-4) | F-100 |
| "One whole file" acceptance | No public source located that addresses fragmented MP4 as a single evidentiary item; reported as a negative finding, not as advice | F-102 |
| Component licences for a distributed product | FFmpeg LGPL base / GPL when optional parts used, with the project's own compliance checklist; explicit "notably libx264" caution; GStreamer requires LGPL plugin code and rejects GPL code inside plugin modules while tolerating LGPL plugins that call GPL libraries; Homebrew's GStreamer is configured `-Dgpl=enabled` with x264/x265/ffmpeg deps | F-88..F-96 |

---

## Local Command Output Evidence

All commands were run read-only against the installed tools, or against synthetic media generated in the OS temporary directory (`$TMPDIR/kilo/fmp4probe/`). No repository file was created, modified or read as input by any media command.

### E-1 Tool presence and build identity

```text
$ which ffmpeg ffprobe gst-launch-1.0 gst-inspect-1.0 MP4Box mediainct
/opt/homebrew/bin/ffmpeg
/opt/homebrew/bin/ffprobe
gst-launch-1.0 not found
gst-inspect-1.0 not found
MP4Box not found
mediainct not found

$ ffmpeg -version | head -5
ffmpeg version 9.0.2 Copyright (c) 2000-2026 the FFmpeg developers
built with Apple clang version 21.0.0 (clang-2100.3.34.2)
configuration: --prefix=/opt/homebrew/Cellar/ffmpeg/9.0.2 --enable-shared --enable-pthreads
  --enable-version3 --cc=clang --host-cflags= --host-ldflags= --enable-ffplay --enable-gpl
  --enable-libsvtav1 --enable-libopus --enable-libx264 --enable-libmp3lame --enable-libdav1d
  --enable-libvmaf --enable-libvpx --enable-libx265 --enable-openssl --enable-videotoolbox
  --enable-audiotoolbox --enable-neon
libavutil      61.  1.102 / 61.  1.102
libavcodec     63.  1.102 / 63.  1.102
```

### E-2 `ffmpeg -h muxer=mp4` (abridged to the options relevant to this row)

```text
Muxer mp4 [MP4 (MPEG-4 Part 14)]:
    Common extensions: mp4.   Mime type: video/mp4.
    Default video codec: h264.   Default audio codec: aac.
mov/mp4/tgp/psp/tg2/ipod/ismv/f4v muxer AVOptions:
  -brand             <string>     E.......... Override major brand
  -encryption_key    <binary>     E.......... The media encryption key (hex)
  -encryption_kid    <binary>     E.......... The media encryption key identifier (hex)
  -encryption_scheme <string>     E.......... Configures the encryption scheme, allowed values are none, cenc-aes-ctr
  -frag_duration     <int>        E.......... Maximum fragment duration (from 0 to INT_MAX) (default 0)
  -frag_interleave   <int>        E.......... Interleave samples within fragments (…) (default 0)
  -frag_size         <int>        E.......... Maximum fragment size (from 0 to INT_MAX) (default 0)
  -fragment_index    <int>        E.......... Fragment number of the next fragment (from 1 to INT_MAX) (default 1)
  -movflags          <flags>      E.......... MOV muxer flags (default 0)
     cmaf              E.......... Write CMAF compatible fragmented MP4
     dash              E.......... Write DASH compatible fragmented MP4
     default_base_moof E.......... Set the default-base-is-moof flag in tfhd atoms
     delay_moov        E.......... Delay writing the initial moov until the first fragment is cut, or until the first fragment flush
     empty_moov        E.......... Make the initial moov atom empty
     faststart         E.......... Run a second pass to put the index (moov atom) at the beginning of the file
     frag_custom       E.......... Flush fragments on caller requests
     frag_discont      E.......... Signal that the next fragment is discontinuous from earlier ones
     frag_every_frame  E.......... Fragment at every frame
     frag_keyframe     E.......... Fragment at video keyframes
     global_sidx       E.......... Write a global sidx index at the start of the file
     hybrid_fragmented E.......... For recoverability, write a fragmented file that is converted to non-fragmented at the end.
     negative_cts_offsets E..... Use negative CTS offsets (reducing the need for edit lists)
     omit_tfhd_offset  E.......... Omit the base data offset in tfhd atoms
     separate_moof     E.......... Write separate moof/mdat atoms for each track
     skip_sidx         E.......... Skip writing of sidx atom
     skip_trailer      E.......... Skip writing the mfra/tfra/mfro trailer for fragmented files
  -moov_size         <int>        E.......... maximum moov size so it can be placed at the begin (from 0 to INT_MAX) (default 0)
  -min_frag_duration <int>        E.......... Minimum fragment duration (from 0 to INT_MAX) (default 0)
  -write_prft        <int>        E.......... Write producer reference time box with specified time source (from 0 to 2) (default 0)
     pts        2      E..........
     wallclock  1      E..........
```

Note: no `frag_start_number`, no `default_prft`, no `frag_type` appears in this output (F-05, F-14, F-15).

### E-2b RTSP demuxer/muxer and `astreamselect` help

```text
$ ffmpeg -h demuxer=rtsp
Demuxer rtsp [RTSP input]:
  -rtsp_transport    <flags>      ED......... set RTSP transport protocols
     udp / tcp / udp_multicast / http / https
  -rtsp_flags        <flags>      .D......... set RTSP flags
     filter_src   .D......... only receive packets from the negotiated peer IP
     listen       .D......... wait for incoming connections
     prefer_tcp   ED......... try RTP via TCP first, if available
  -listen_timeout    <int>        .D......... set maximum timeout (in seconds) to wait for incoming
                                 connections (-1 is infinite, imply flag listen) (default -1)
  -min_port          <int>        ED......... set minimum local UDP port (default 5000)
  -max_port          <int>        ED......... set maximum local UDP port (default 65000)
  -user_agent        <string>     .D......... override User-Agent header (default "Lavf63.1.102")

$ ffmpeg -h muxer=rtsp
Muxer rtsp [RTSP output]:
  -rtpflags, -rtsp_transport (udp|tcp), -min_port, -max_port, -buffer_size,
  -pkt_size <int> (default 1472), TLS options
  # no rtsp_flags / no listen option on the output side

$ ffmpeg -h filter=astreamselect
Filter astreamselect
  Select audio streams
    Inputs:  dynamic (depending on the options)
    Outputs: dynamic (depending on the options)
(a)streamselect AVOptions:
   inputs  <int>    ..FVA...... number of input streams (from 2 to INT_MAX) (default 2)
   map     <string> ..FVA....T. input indexes to remap to outputs
```

### E-3 `ffmpeg -h full` fragment-numbering survey (14,000 lines)

```text
$ ffmpeg -h full | grep -n -iE "frag_start|start_number|frag_type|write_prft|default_prft"
3234:  -frag_type         <int>   E.......... set type of interval for fragments (from 0 to 3) (default none)   # under "dash muxer AVOptions"
3378:  -start_number      <int64> E.......... set first number in the sequence (from 0 to I64_MAX) (default 0)
3439:  -start_number      <int>   E.......... set first number in the sequence (from 0 to INT_MAX) (default 1)
3991:  -segment_start_number <int> E.......... set the sequence number of the first segment (default 0)
(no match for default_prft; no match for frag_start_number)
```

### E-4 `ffprobe` capability check

```text
$ ffprobe -h full | grep -in "box"
697:AudioToolbox AVOptions:
1995:h264_videotoolbox AVOptions:
1997:hevc_videotoolbox AVOptions:
1999:prores_videotoolbox AVOptions:
# no ISO-BMFF box-dump option exists

$ ffprobe -help | grep show_
-show_packets, -show_frames, -show_streams, -show_format, -show_entries,
-show_data_hash, -show_programs, -show_chapters, …
```

### E-5 Synthetic fragmented file probe (byte positions, AAC frame arithmetic)

Generation command (run in `$TMPDIR/kilo/fmp4probe/`):

```text
ffmpeg -y -f lavfi -i "testsrc=size=128x96:rate=25:duration=4" \
       -f lavfi -i "sine=frequency=440:sample_rate=48000:duration=4" \
       -c:v libx264 -preset ultrafast -g 50 -pix_fmt yuv420p \
       -c:a aac -ar 48000 -b:a 64k \
       -movflags "+empty_moov+default_base_moof+frag_keyframe" -frag_duration 1000000 a.mp4
# result: 73342 bytes, frame=100, Lsize=72KiB, time=00:00:04.00
```

Packet byte positions (video stream, first packets):

```json
{ "codec_type": "video", "stream_index": 0, "pts": 0,    "dts": 0,    "duration": 786,
  "duration_time": "0.000000", "size": "3372", "pos": "1825", "flags": "K__" }
{ "codec_type": "video", "stream_index": 0, "pts": 786,  "dts": 786,  "duration": 512,
  "duration_time": "0.040000", "size": "106",  "pos": "5197", "flags": "___" }
```

Audio stream (AAC frame size at 48 kHz):

```text
$ ffprobe -select_streams a -show_packets -of default=nw=1 a.mp4
codec_type=audio   stream_index=1   pts=0   pts_time=0.000000   dts=0
duration=1024   duration_time=0.021333   size=188   pos=12633   flags=K__
codec_type=audio stream_index=1 pts=1024 pts_time=0.021333 dts=1024
duration=1024   duration_time=0.021333   size=235   pos=12821

$ ffprobe -select_streams a -show_entries stream=codec_name,profile,sample_rate,channels,time_base a.mp4
codec_name=aac
profile=LC
sample_rate=48000
channels=1
time_base=1/48000
```

Arithmetic: 1024 samples / 48000 Hz = 0.0213333 s = **21.33 ms** per AAC frame (confirms the row-8 bound figure).

### E-6 Truncation behaviour of a fragmented file

```text
$ python3 -c "…keep first 60 % of a.mp4 → trunc.mp4…"
orig=73342 keep=44005  wrote 44005 bytes

$ ffprobe -v warning -show_entries format=duration,size,nb_streams -of default=nw=1 trunc.mp4
nb_streams=2
duration=3.021406
size=44005
exit=0

$ ffprobe -v error -show_entries stream=index,codec_name -of csv=p=0 trunc.mp4
0,h264
1,aac
exit=0
```

Full file duration was 4.00 s; the 60 %-truncated file reports 3.02 s and still enumerates both tracks (F-23).

---

## Online Resources Consulted

| Resource | URL | Relevance | Last checked |
|----------|-----|-----------|--------------|
| FFmpeg formats manual (mp4/dash/segment muxers) | https://ffmpeg.org/ffmpeg-formats.html | High | 2026-10-07 |
| FFmpeg filters manual (`streamselect`/`astreamselect`, `sendcmd`/`asendcmd`, `concat`) | https://ffmpeg.org/ffmpeg-filters.html | High | 2026-10-07 |
| FFmpeg invocation manual | https://ffmpeg.org/ffmpeg.html | Medium | 2026-10-07 |
| FFmpeg licence/legal page | https://ffmpeg.org/legal.html | High | 2026-10-07 |
| FFmpeg `movenc.c` (mp4 muxer source) | https://raw.githubusercontent.com/FFmpeg/FFmpeg/master/libavformat/movenc.c | High | 2026-10-07 |
| FFmpeg `movenccenc.c` / `movenccenc.h` / `movenc.h` | https://raw.githubusercontent.com/FFmpeg/FFmpeg/master/libavformat/movenccenc.c (+ `.h`, `movenc.h`) | High | 2026-10-07 |
| FFmpeg `libavutil/aes_ctr.h` | https://raw.githubusercontent.com/FFmpeg/FFmpeg/master/libavutil/aes_ctr.h | High | 2026-10-07 |
| FFmpeg `rtspdec.c` / `rtspenc.c` | https://raw.githubusercontent.com/FFmpeg/FFmpeg/master/libavformat/rtspdec.c (+ `rtspenc.c`) | High | 2026-10-07 |
| GStreamer licensing FAQ | https://gstreamer.freedesktop.org/documentation/frequently-asked-questions/licensing.html | High | 2026-10-07 |
| GStreamer `isofmp4mux` element docs | https://gstreamer.freedesktop.org/documentation/isobmff/isofmp4mux.html?notgi=true | High | 2026-10-07 |
| GStreamer `input-selector` element docs | https://gstreamer.freedesktop.org/documentation/coreelements/input-selector.html?notgi=true | High | 2026-10-07 |
| GStreamer `rtspsrc` / `qtdemux` element docs | https://gstreamer.freedesktop.org/documentation/rtsp/rtspsrc.html?notgi=true , …/isomp4/qtdemux.html?notgi=true | High | 2026-10-07 |
| gst-plugins-rs README (plugin inventory) | https://gitlab.freedesktop.org/gstreamer/gst-plugins-rs/-/raw/main/README.md | High | 2026-10-07 |
| gst-plugins-rs `meson_options.txt` / `meson.build` | https://gitlab.freedesktop.org/gstreamer/gst-plugins-rs/-/raw/main/meson_options.txt (+ `meson.build`) | High | 2026-10-07 |
| Homebrew `gstreamer` formula source | https://raw.githubusercontent.com/Homebrew/homebrew-core/HEAD/Formula/g/gstreamer.rb | High | 2026-10-07 |
| Homebrew formula API (`gstreamer`, `mediamtx`, negative probes) | https://formulae.brew.sh/api/formula/gstreamer.json , …/mediamtx.json | High | 2026-10-07 |
| MediaMTX README | https://raw.githubusercontent.com/bluenviron/mediamtx/main/README.md | High | 2026-10-07 |
| MediaMTX default configuration | https://raw.githubusercontent.com/bluenviron/mediamtx/main/mediamtx.yml | High | 2026-10-07 |
| MediaMTX LICENSE | https://raw.githubusercontent.com/bluenviron/mediamtx/main/LICENSE | Medium | 2026-10-07 |
| npm registry search + package documents (`onvif`) | https://registry.npmjs.org/-/v1/search?text=onvif&size=20 , https://registry.npmjs.org/onvif , …/@2bad%2fonvif , …/ts-onvif , …/node-onvif | High | 2026-10-07 |
| agsh/onvif README | https://raw.githubusercontent.com/agsh/onvif/master/README.md | High | 2026-10-07 |
| crates.io search + crate/version documents (`onvif`) | https://crates.io/api/v1/crates?q=onvif&per_page=25 , …/crates/oxvif/versions , …/crates/gst-plugin-onvif/versions , …/crates/onvif-cam-rs/versions , …/crates/onvif-device-rs/versions | High | 2026-10-07 |
| oxvif repository + README | https://api.github.com/repos/smiti1642/oxvif , https://raw.githubusercontent.com/smiti1642/oxvif/master/README.md | High | 2026-10-07 |
| C2PA specification §18.5-18.6 (data hash, BMFF hash) | https://c2pa.org/specifications/specifications/2.3/specs/C2PA_Specification.html | High | 2026-10-07 |
| Bento4 documentation index and `mp4dump` tool page | https://www.bento4.com/documentation/ , https://www.bento4.com/documentation/mp4dump/ , https://www.bento4.com/about/ | High | 2026-10-07 |
| GPAC README (licence statement) and GitHub licence endpoint | https://raw.githubusercontent.com/gpac/gpac/master/README.md , https://api.github.com/repos/gpac/gpac/license | Medium | 2026-10-07 |
| SWGDE video committee document index | https://www.swgde.org/documents/published-by-committee/video/ | High (titles/dates only; PDFs not retrieved) | 2026-10-07 |
| Wikipedia: ISO base media file format | https://en.wikipedia.org/wiki/ISO_base_media_file_format | Medium (secondary) | 2026-10-07 |
| Wikipedia: Advanced Audio Coding (block size) | https://en.wikipedia.org/wiki/Advanced_Audio_Coding | Medium (secondary; primary is ISO/IEC 14496-3) | 2026-10-07 |
| Debian / Fedora / Arch / Alpine / AUR package searches | see query log Q-38..Q-52 | Medium (negative results) | 2026-10-07 |

---

## Query Log

Every outbound request sent by this row, in order. **Project identifiers appearing in any query: 0.** No repository path, file name, decision ID, customer name, product name or domain of the project was transmitted; no repository content was pasted or uploaded. Media probes ran locally only.

Naming note: queries use neutral technical terms ("fragmented mp4", "isobmff", "onvif", "gstreamer", "homebrew formula"). Where a search needed a subject, the subject was the technology, never the appliance being designed.

| # | Tool / site | Query or URL requested (verbatim) | Result |
|---|-------------|-----------------------------------|--------|
| Q-01 | webfetch | `https://html.duckduckgo.com/html/?q=ffmpeg+astreamselect+filter+commands+activestreams+switch+input+at+runtime` | timeout, no data |
| Q-02 | webfetch | `https://html.duckduckgo.com/html/?q=gst-plugins-rs+isofmp4mux+homebrew+fragmented+mp4` | timeout, no data |
| Q-03 | webfetch | `https://formulae.brew.sh/formula/gst-plugins-rs` | timeout, superseded by Q-06/Q-08 |
| Q-04 | webfetch | `https://gstreamer.freedesktop.org/documentation/isomp4/isofmp4mux.html` | 404 (wrong plugin name; corrected at Q-13) |
| Q-05 | curl | `https://gstreamer.freedesktop.org/documentation/rslav1/index.html` | 404 |
| Q-06 | curl | `https://formulae.brew.sh/api/formula/gst-plugins-rs.json` | 404 |
| Q-07 | curl | `https://formulae.brew.sh/api/formula/{gstreamer,gst-plugins-base,gst-plugins-good,gst-plugins-bad,gst-plugins-rs,gst-libav}.json` | 200 for `gstreamer`, 404 for the five plugin names |
| Q-08 | curl | `https://raw.githubusercontent.com/Homebrew/homebrew-core/HEAD/Formula/g/gstreamer.rb` | 200 |
| Q-09 | curl | `https://gitlab.freedesktop.org/gstreamer/gst-plugins-rs/-/raw/main/README.md` | 200 |
| Q-10 | curl | `https://gitlab.freedesktop.org/gstreamer/gst-plugins-rs/-/raw/main/meson.options` | 404 |
| Q-11 | curl | `https://gitlab.freedesktop.org/gstreamer/gst-plugins-rs/-/raw/main/src/isomp4/mod.rs` | 404 |
| Q-12 | curl | `https://gstreamer.freedesktop.org/documentation/{playback/input-selector,rtspclient/rtspsrc,isomp4/qtdemux,isobmff/isofmp4mux,isobmff/index}.html?notgi=true` | mixed; `isomp4/qtdemux`, `isobmff/*` 200 |
| Q-13 | curl | `https://gstreamer.freedesktop.org/documentation/{coreelements/input-selector,rtsp/rtspsrc,rtsp/index,net/clocksync}.html?notgi=true` | 200 except `net/clocksync` 404 |
| Q-14 | curl | `https://gstreamer.freedesktop.org/documentation/isobmff/isofmp4mux.html?notgi=true` | 200 |
| Q-15 | curl | `https://ffmpeg.org/ffmpeg-filters.html` | 200 |
| Q-16 | curl | `https://ffmpeg.org/ffmpeg-formats.html` | 200 |
| Q-17 | curl | `https://ffmpeg.org/ffmpeg.html` | 200 |
| Q-18 | curl | `https://raw.githubusercontent.com/bluenviron/mediamtx/main/README.md` | 200 |
| Q-19 | curl | `https://raw.githubusercontent.com/bluenviron/mediamtx/main/LICENSE` | 200 |
| Q-20 | curl | `https://formulae.brew.sh/api/formula/mediamtx.json` | 200 |
| Q-21 | curl | `https://raw.githubusercontent.com/bluenviron/mediamtx/main/mediamtx.yml` | 200 |
| Q-22 | curl | `https://registry.npmjs.org/-/v1/search?text=onvif&size=20` | 200 |
| Q-23 | curl | `https://crates.io/api/v1/crates?q=onvif&per_page=25` | 200 |
| Q-24 | curl | `https://crates.io/api/v1/crates/{oxvif,onvif-cam-rs,gst-plugin-onvif,onvif-device-rs}` | 200 |
| Q-25 | curl | `https://registry.npmjs.org/{onvif,@2bad%2fonvif,ts-onvif,node-onvif}` | 200 |
| Q-26 | curl | `https://crates.io/api/v1/crates/{oxvif,onvif-cam-rs,gst-plugin-onvif,onvif-device-rs}/versions` | 200 |
| Q-27 | curl | `https://raw.githubusercontent.com/agsh/onvif/master/README.md` | 200 |
| Q-28 | curl | `https://api.github.com/repos/smiti1642/oxvif` | 200 |
| Q-29 | curl | `https://raw.githubusercontent.com/smiti1642/oxvif/main/README.md` | 404 (branch is `master`) |
| Q-30 | curl | `https://ffmpeg.org/legal.html` | 200 |
| Q-31 | curl | `https://raw.githubusercontent.com/FFmpeg/FFmpeg/master/libavformat/movenc.c` | 200 |
| Q-32 | curl | `https://api.github.com/repos/FFmpeg/FFmpeg/contents/libavformat?ref=master` | 200 |
| Q-33 | curl | `https://raw.githubusercontent.com/FFmpeg/FFmpeg/master/libavformat/movenccenc.h` | 200 |
| Q-34 | curl | `https://raw.githubusercontent.com/FFmpeg/FFmpeg/master/libavformat/movenccenc.c` | 200 |
| Q-35 | curl | `https://raw.githubusercontent.com/FFmpeg/FFmpeg/master/libavformat/movenc.h` | 200 |
| Q-36 | curl | `https://raw.githubusercontent.com/FFmpeg/FFmpeg/master/libavutil/aes_ctr.h` | 200 |
| Q-37 | curl | `https://gstreamer.freedesktop.org/documentation/{frequently_asked_questions/licensing_gstreamer_plugins.html,license/,documentation/plugin-development/advanced/licensing.html,frequently_asked_questions/index.html}` | 404 ×4 (corrected at Q-40/Q-41) |
| Q-38 | curl | `https://gitlab.freedesktop.org/gstreamer/gstreamer/-/raw/main/subprojects/gst-docs/README.md` | 200 |
| Q-39 | curl | `https://gitlab.freedesktop.org/api/v4/projects/gstreamer%2Fgstreamer/repository/tree?path=subprojects/gst-docs/documentation/frequently_asked_questions` | non-list response, discarded |
| Q-40 | curl | `https://gstreamer.freedesktop.org/documentation/frequently-asked-questions/index.html` | 200 |
| Q-41 | curl | `https://gstreamer.freedesktop.org/documentation/frequently-asked-questions/licensing.html` | 200 |
| Q-42 | curl | `https://lite.duckduckgo.com/lite/?q=gstreamer+licensing+LGPL+GPL+plugins+documentation` | connection timeout, no data |
| Q-43 | curl | `https://packages.debian.org/search?keywords=gstreamer+plugins+rs&searchon=names&suite=all&section=all` | 200, no name matches |
| Q-44 | curl | `https://packages.fedoraproject.org/api/v1/package/gstreamer1-plugins-rs` | 404 |
| Q-45 | curl | `https://archlinux.org/packages/search/json/?name=gst-plugin-plugins-rs` | 200, empty |
| Q-46 | curl | `https://archlinux.org/packages/search/json/?q=gst-plugins-rs` | 200, empty |
| Q-47 | curl | `https://src.fedoraproject.org/api/0/rpms/gstreamer1-plugins-rs` | empty object |
| Q-48 | curl | `https://packages.debian.org/trixie/gstreamer1.0-plugins-rs` | "No such package" |
| Q-49 | curl | `https://packages.debian.org/trixie/gstreamer1.28-plugins-rs` | "No such package" |
| Q-50 | curl | `https://launchpad.net/1/~ubuntu-branches/ubuntu/devel/gst-plugin-rs/devel` | timeout |
| Q-51 | curl | `https://launchpad.net/ubuntu/+source/gst-plugin-rs` | timeout |
| Q-52 | curl | `https://sources.debian.org/api/src/{gst-plugin-rs,gstreamer1.0-plugins-rs}/` ; `https://packages.debian.org/search?searchon=names&keywords=plugins-rs` ; `https://tracker.debian.org/pkg/gst-plugin-rs` ; `https://pkgs.alpinelinux.org/packages?name=gst+plugin+isobmff&branch=edge` ; `https://aur.archlinux.org/rpc?v=5&type=search&arg=gst-plugins-rs` ; `https://aur.archlinux.org/rpc?v=5&type=search&arg=rust-gst-plugins-rs` ; `https://src.fedoraproject.org/rpms/gstreamer1-plugins-rs` | all negative (404 / empty / no match) |
| Q-53 | curl | `https://raw.githubusercontent.com/gpac/gpac/master/doc/mp4box-doc.txt` | 404 |
| Q-54 | curl | `https://raw.githubusercontent.com/awkv/bento4/master/README.md` | 404 |
| Q-55 | curl | `https://www.bento4.com/documentation/` | 200 |
| Q-56 | curl | `https://mpeg.chiariglione.org/standards/mpeg-4/iso-base-media-file-format` | connection timeout |
| Q-57 | curl | `https://www.bento4.com/developers/mp4dump/` ; `https://www.bento4.com/licensing/` | 404 ×2 (corrected at Q-58/Q-60) |
| Q-58 | curl | `https://www.bento4.com/documentation/mp4dump/` | 200 |
| Q-59 | curl | `https://raw.githubusercontent.com/axiomatic-systems/Bento4/master/LICENSE` and `LICENSE.md` | empty responses |
| Q-60 | curl | `https://api.github.com/repos/axiomatic-systems/Bento4/license` ; `https://api.github.com/repos/gpac/gpac/license` ; `https://github.com/gpac/gpac/wiki/MP4Box` ; `https://raw.githubusercontent.com/gpac/gpac/master/README.md` ; `https://www.bento4.com/about/` | 200 (Bento4 licence endpoint empty; others returned data) |
| Q-61 | curl | `https://www.rfc-editor.org/rfc/rfc9559.html` | 200 — turned out to be the Matroska RFC, **not** a hash-URI specification; not used as a citation |
| Q-62 | curl | `https://c2pa.org/specifications/specifications/2.3/specs/C2PA_Specification.html` | 200 |
| Q-63 | curl | `https://www.iso.org/standard/74483.html` | 403 Cloudflare challenge — ISO catalogue not reachable |
| Q-64 | curl | `https://www.swgde.org/documents/` ; `https://www.swgde.org/documents/published-by-committee/video/` | 200 |
| Q-65 | curl | `https://developer.mozilla.org/en-US/docs/Web/API/Media_Source_Extensions_API/Transcoding_and_remuxing_for_web` | 404 |
| Q-66 | curl | `https://en.wikipedia.org/wiki/ISO_base_media_file_format` | 200 |
| Q-67 | curl | `https://en.wikipedia.org/wiki/Advanced_Audio_Coding` | 200 |
| Q-68 | curl | `https://gitlab.freedesktop.org/gstreamer/gst-plugins-rs/-/raw/main/meson.build` ; `…/meson_options.txt` ; `…/Cargo.toml` | 200, 200, 200 |

Log assurance: 68 log entries recorded, comprising **105 URL requests** (80 written out explicitly plus 25 further requests inside grouped entries that list several endpoints of the same site on one line). Every one is a technology-documentation, package-registry or standards URL. Reused content from these fetches appears above with the URL attached. Project names, repository paths, project file names, decision IDs, customer names and product domains appear in **zero** of them; no repository content was uploaded or pasted into any request.

**Totals:** 102 facts (F-01..F-102), each with a URL citation or quoted local command output; 6 local evidence blocks (E-1..E-6); 11 open gaps (G-1..G-11).

---

## Collection Log

| Timestamp (local) | Action | Details |
|--------|--------|---------|
| 13:44 | Read | `identification/02_structured.md` (row 3 Verification column, rows 7-15, 31, 32), `identification/01_translated.md` (External Research Scope, C-SAFE) |
| 13:45 | Probed | Tool presence (`which`), `ffmpeg -version` |
| 13:45 | Captured | `ffmpeg -h muxer=mp4`, `-h demuxer=rtsp`, `-h protocol=rtsp`, `-h muxer=rtsp`, `-h filter=astreamselect`, `-h muxer=segment`, `-h full` (saved to temp for grep) |
| 13:46 | Generated | Synthetic 4 s h264+aac fragmented MP4 in `$TMPDIR/kilo/fmp4probe/` |
| 13:47 | Probed | `ffprobe -show_packets` JSON (pos/size), audio stream params, atom-debug attempt (no atom log emitted) |
| 13:48 | Fetched | Homebrew formula API (gstreamer + 5 negatives), Homebrew `gstreamer.rb` source |
| 13:49 | Fetched | gst-plugins-rs README, meson files; GStreamer element doc pages (`isofmp4mux`, `input-selector`, `rtspsrc`, `qtdemux`) |
| 13:50 | Fetched | FFmpeg `ffmpeg-filters.html`, `ffmpeg-formats.html`, `ffmpeg.html`; extracted `astreamselect`, `sendcmd`, `concat`, mp4-muxer sections |
| 13:51 | Probed | AAC packet duration → 1024 / 0.021333 s at 48 kHz |
| 13:52 | Fetched | MediaMTX README, LICENSE, formula API, `mediamtx.yml` |
| 13:53 | Fetched | npm search + 4 package documents; crates.io search + 4 crate documents + 4 version documents; agsh/onvif README; oxvif repo + README |
| 13:55 | Fetched | FFmpeg `legal.html`; `movenc.c`, `movenccenc.{c,h}`, `movenc.h`, `aes_ctr.h` |
| 13:57 | Fetched | GStreamer licensing FAQ (after 4 wrong-path probes) |
| 13:58 | Probed | Truncated-file `ffprobe` behaviour |
| 13:59 | Fetched | Bento4 documentation index + `mp4dump` page + About; GPAC README + licence endpoint + wiki page |
| 14:00 | Fetched | C2PA specification (data hash, BMFF hash, schema) |
| 14:01 | Probed | Debian/Fedora/Arch/Alpine/AUR packaging (all negative); ISO catalogue (blocked); SWGDE video index |
| 14:02 | Fetched | Wikipedia ISO-BMFF and AAC articles |
| 14:05 | Wrote | This artifact + `delegation_progress/data-collector-local__row3.md` |

---

## Gaps / Needs More Data

| # | Gap | Who should close it | Why it matters |
|---|-----|---------------------|----------------|
| G-1 | Whether the FFmpeg RTSP **listening demuxer** accepts a second push session after the first `TEARDOWN` without restarting the ingest process. Source reading shows the per-connection state machine starts at `IDLE` and nothing is persisted (F-32/F-33), but accept-after-close behaviour was not traced and was deliberately not executed in this row | Row 7 (spike S1) | Decides whether a crash-resilient ingest loop must restart both processes or only the pusher |
| G-2 | Effect of `empty_moov` disabling automatic bitstream filtering (F-24) on a **codec-copy** pipeline fed by an RTSP H.264 source | Row 7 | A copy-path that silently produces a non-playable track is the highest-risk unknown in S1 |
| G-3 | Empirical fragment-boundary behaviour at 1-2 s targets: whether `frag_duration` cuts on a keyframe boundary for a fixed-GOP synthetic source, and the resulting per-fragment byte sizes | Rows 7, 9 | Determines the fragment granularity the hash chain and checkpoints can rely on |
| G-4 | Player/browser conformance for a **still-growing** fMP4 beyond FFmpeg's own claim (F-20/F-23): no authoritative statement was collected about MSE init-segment requirements or QuickTime-class players rejecting fragmented files. MDN path tried returned 404 (Q-65) | Rows 7, 32 (spec) and M8 playback | Playback of the live file and of a truncated sealed file is an acceptance criterion |
| G-5 | Content of the SWGDE PDFs listed in F-100 (no `pdftotext`/PDF library on this host; only titles, IDs and dates verified on the index page) | Row 32 (evidence-package spec) or row 28 | Needed if the manifest-v2 chain-of-custody section must cite recognised guidance |
| G-6 | ISO/IEC 14496-12 catalogue page could not be fetched (Cloudflare 403, Q-63); edition and status rest on a secondary source (F-97) | Row 32 / OD-21 memo | The normative claim "a fragmented file is one conforming file" should cite the standard, not a wiki |
| G-7 | Licence of the GStreamer **Rust** plugin set (`gst-plugins-rs`) was not collected; the Homebrew formula's aggregate licence covers core/base/good/bad/ugly only (F-92) | Rows 13, 15, DOC-05 | Engine pick and third-party notices both depend on it |
| G-8 | No ONVIF library has a published conformance/certification statement (F-87); maintenance status is date-based only | Row 31 and class-C C-1 | Device-interoperability risk sits with whichever library is picked |
| G-9 | `default_prft` and `frag_start_number` were named in the collection brief but do not exist in FFmpeg 9.0.2 (F-14, F-15). Their origin (older FFmpeg, GPAC, or another tool) was not established | Row 31 (spec wording) | Prevents a spec that references non-existent options |
| G-10 | Distro packaging for `gst-plugins-rs` came back negative across five ecosystems (F-73). Search coverage was keyword-based and may be incomplete (e.g. differently-named source packages, Flathub, Nix) | Rows 14, 15 | Affects the x86 Linux portability score of the GStreamer option |
| G-11 | No public source addresses fragmented MP4 as "one whole file" for evidentiary purposes (F-102). This row reports the negative only; it is not legal advice and must not be recorded as a clearance | Gate item OD-21 (user decision) | R-4's fallback ("segments + lossless concat") hinges on this answer |

---

*Generated: 2026-10-07 14:05*
*Last Updated: 2026-10-07 14:05*
