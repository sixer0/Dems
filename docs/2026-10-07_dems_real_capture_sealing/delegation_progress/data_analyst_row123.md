---
task_id: 2026-10-07_dems_real_capture_sealing
agent: data-analyst
blueprint_row: 123
date: 2026-10-09
status: needs-review (the artifact is complete; four points need the controller, one of them the user — section 8)
tier: 3 (working record of a Tier 1 edit)
file_edited: masterplan/05_capture_architecture_spec.md (844 -> 1423 lines)
last_updated: 2026-10-09 14:40
---

# Row 123 — capture architecture delta for R-9..R-11 in `masterplan/05_capture_architecture_spec.md`

## 1. What was done

One spec file edited: `masterplan/05_capture_architecture_spec.md`. This record is the only other
file written. No code, no blueprint, no tracker, no decision file, no errata file, no other spec.
No package installed, no port bound, no camera or microphone opened, nothing sent to this network.

Baseline: `git diff --stat HEAD -- masterplan/05_capture_architecture_spec.md` printed nothing
before the first edit (14:22), so `git diff HEAD` on that file is exactly this row's change:
`1 file changed, 582 insertions(+), 3 deletions(-)`. A pre-edit copy is in the session scratch
directory (`05_spec_before_row123.md`).

Sources read: `identification/02_structured.md` rev 2.3 rows 61, 65, 96, 123, 129-136, 139, 140,
142, DP-11..DP-13, Q-GOP; `decisions/decisions.md` D72-D80; `masterplan/01_specs.md` §B.2 (R-9,
R-10, R-11, B.2.6, B.2.7), C-N4, C-N13..C-N15; `delegation_progress/data_analyst_row120.md`;
`delegation_progress/pair_58_navigator_a.md` A-3; `implementation/20_m3_worker_engine.md` §0, §3.5,
§5, §8, fix round 1; `masterplan/11_audit_errata.md` §5 (convention only); `report/report.md:72`;
`research/02_collection.md` F-81..F-87. Code read (read-only):
`packages/capture-protocol/src/index.ts`, `apps/capture-worker/src/ingest.c`,
`apps/capture-worker/src/capture_worker.c`, `apps/capture-worker/test/fake_mic.c`,
`apps/capture-worker/test/m3worker.py`, `implementation/evidence/59_m3proof/fake_cam.c`,
`apps/core-server/src/config.ts`, `apps/core-server/src/capture/ipc.ts`,
`apps/core-server/src/capture/index.ts`, `apps/core-server/src/capture/__tests__/static.test.ts`,
`apps/core-server/src/modules/capture-config/fencing.ts`.

## 2. What was added (line numbers after the edit, from `grep -n`)

| Mark | Lines | Section | Content |
|---|---|---|---|
| PE-123-15 | 31, 1423 | front matter, footer | range and date |
| PE-123-01 | 60 | §0 | decision-inputs row for D72(k), D73-D78, D80 |
| PE-123-02 | 115-173 | §A.1.1 | adapters live in the Core process (correction of three "Target" cells); adapter kind and source class; registry rules RG-1..RG-5; the four development slots |
| PE-123-03 | 175-229 | §A.1.2 | the development flag joined to row 61's one definition; two keys; ten-row combination table; "production configuration" defined |
| (summary) | 404-422 | §A.6.0 | interface members added; class boundary after the delta |
| PE-123-04 | 424-494 | §A.6.1 | probe-only WS-Discovery: 12 verified protocol facts, message flow, decisions DS-1..DS-15, failure modes |
| PE-123-05 | 496-545 | §A.6.1a | dependency decision: package named, 8 observations in its source, 3 options, recommendation, licence entries, effect on row 131 |
| PE-123-06 | 547-594 | §A.6.2 | the seven-step sequence; five outcomes defined by observation; rules CT-1..CT-7; the RTSP-client gap |
| PE-123-07 | 596-625 | §A.6.3 | credential in memory CR-1..CR-7; what the recording process receives; the class C-2 gap |
| PE-123-08 | 627-693 | §A.6.4 | `LOCAL_DEVICE` camera helper: alternatives, exact pipeline, element table, fake camera of slot 2, lifecycle HL-1..HL-14 |
| PE-123-09 | 695-732 | §A.6.5 | session-start rule, who raises what, the "connecting cameras" point |
| PE-123-10 | 765-814 | §A.7.1 | mic helper, fake mic of slot 2, rules ML-1..ML-8 |
| PE-123-11 | 853-872 | §A.8.1 | what the fake ONVIF stub must do, ST-1..ST-5 |
| PE-123-12 | 1235-1268 | §G.1 | SEC35-23 exception stated once; rules G-R9..G-R15, G-R4 and G-R6 extended |
| PE-123-13 | 1339-1354 | §I | planned P25 edits 15-18 (two config keys); note on the stale status of edits 7-10 |
| PE-123-14 | 1371-1372, 1376-1386 | §J | H-7 split into H-7a / H-7b; H-11..H-21 added |
| PE-123-15 | 1406 | Self-gate | one row |

## 3. Probes run on this Mac (read-only) and their output

No device was opened, no port was bound, nothing was sent on the network.

**P-1 — device names** (`ffmpeg -hide_banner -f avfoundation -list_devices true -i ""`).
Inside the command sandbox:

```text
[AVFoundation indev @ ...] AVFoundation video devices:
[AVFoundation indev @ ...] AVFoundation audio devices:
[in#0 @ ...] Error opening input: Input/output error
```

(0 and 0 devices — the sandbox hides them.) Outside the sandbox, through the permission gate:

```text
[AVFoundation indev @ ...] AVFoundation video devices:
[AVFoundation indev @ ...] [0] MacBook Air Camera
[AVFoundation indev @ ...] [1] MacBook Air Desk View Camera
[AVFoundation indev @ ...] [2] Capture screen 0
[AVFoundation indev @ ...] [3] Capture screen 1
[AVFoundation indev @ ...] AVFoundation audio devices:
[AVFoundation indev @ ...] [0] MacBook Air Microphone
[in#0 @ ...] Error opening input: Input/output error
```

The final error is expected: the input name is empty; listing opens no device.

**P-2 — encoders** (`ffmpeg -hide_banner -encoders | grep -E 'videotoolbox|libx264|libopenh264'`):

```text
 V....D libx264              libx264 H.264 / AVC / MPEG-4 AVC / MPEG-4 part 10 (codec h264)
 V....D libx264rgb           libx264 H.264 / AVC / MPEG-4 AVC / MPEG-4 part 10 RGB (codec h264)
 V....D h264_videotoolbox    VideoToolbox H.264 Encoder (codec h264)
 V....D hevc_videotoolbox    VideoToolbox H.265 Encoder (codec hevc)
 V....D prores_videotoolbox  VideoToolbox ProRes Encoder (codec prores)
```

`ffmpeg -version`: `ffmpeg version 9.0.2`, `/opt/homebrew/bin/ffmpeg`, configuration includes
`--enable-libx264 --enable-videotoolbox --enable-audiotoolbox`.

**P-3 — avfoundation input options** (`ffmpeg -hide_banner -h demuxer=avfoundation`):
`-list_devices`, `-video_device_index`, `-audio_device_index`, `-pixel_format` (default yuv420p),
`-framerate` (default "ntsc"), `-video_size`, `-capture_cursor`, `-capture_mouse_clicks`,
`-capture_raw_data`, `-drop_late_frames` (default true). There is no audio buffer-size option.

**P-4 — options the helper lines rely on** (`ffmpeg -hide_banner -h full | grep ...`,
`-h encoder=h264_videotoolbox`, `-h muxer=rtsp`):

```text
  -g                 <int>        E..V....... set the group of picture (GOP) size (default 12)
  -bf                <int>        E..V....... set maximum number of B-frames between non-B-frames (default 0)
  -start_time_realtime <int64>    E.......... wall-clock time when stream begins (PTS==0) (default I64_MIN)
  -use_wallclock_as_timestamps <boolean> .D.. use wallclock as timestamps (default false)
  -flush_packets     <int>        E.......... enable flushing of the I/O context after each packet
  -output_ts_offset  <duration>   E.......... set output timestamp offset (default 0)
-copyts             copy timestamps
h264_videotoolbox: -profile (baseline..high), -realtime <boolean>, -allow_sw, -require_sw, -prio_speed, ...; pixel formats videotoolbox_vld nv12 yuv420p
RTSP muxer: -rtsp_transport (udp | tcp), -rtpflags ... skip_rtcp "Don't send RTCP sender reports", -min_port / -max_port (default 5000 / 65000)
```

**P-5 — RTSP server binary.** `find . -iname '*mediamtx*'` (repository, `.cache/` included): 0
files; `which mediamtx`: not found; `research/06_spike_s1_fmp4_running_hash.md` has no line
mentioning it (it is named only in `research/01`, `02`, `03` as a Q-INSTALL item). Not needed: the
worker is the listener, sources push (spec §A.6.4).

**P-6 — interface name classes** (`ifconfig -l`, names only, no addresses): 5 `en`, 6 `utun`, 1
each of `lo`, `awdl`, `llw`, `bridge`, `gif`, `stf`, `anpi`, `ap`, `nan`. Used only to justify an
interface rule by address properties instead of by name (DS-4).

**P-7 — the worker's ingest direction** (`grep` in `apps/capture-worker/src/ingest.c`): `:281`
`rtsp_flags=listen`, `:282` explicit `listen_timeout`, `:304` `INGEST_NO_EXTRADATA`, `:335-340` the
wall clock of a packet comes from its PRFT side data, `:88-94` an ended ingest sends the warning
`CAPTURE_FAULT` with the camera's device ID. `capture_worker.c:40` listen timeout 15 s by default.

**External text read (generic sources; nothing about this project or network was sent).**

| Source | What was taken | How |
|---|---|---|
| OASIS WS-Discovery 1.1, `docs.oasis-open.org/ws-dd/discovery/1.1/os/wsdd-discovery-1.1-spec-os.html` | port, addresses, ProbeMatch outline, `RelatesTo`, unicast answer, `APP_MAX_DELAY`, `MATCH_TIMEOUT`, zero-or-more matches from a proxy, §8.1 security | fetched; first 100,000 of 113,399 characters read (the part not read is after §8.1) |
| ONVIF Core Specification 26.06, `www.onvif.org/specs/2606/ONVIF-Core-Spec-v2606.pdf` (131 pages) | §5.9.4.3 access classes and Table 7, §6, §7.1-§7.3.6, §8.1.2, §8.3.1, §8.3.6 | downloaded, text extracted with `pypdf`, sections read from the text |
| npm registry document `registry.npmjs.org/onvif/latest` | version 0.8.3, MIT, dependency `xml2js ^0.6.2`, `engines.node >=14.0`, 20 files, 283,576 bytes, provenance attestation, maintainers | fetched |
| Package files `unpkg.com/onvif@0.8.3/lib/{discovery.js,cam.js,utils.js}`, `LICENSE` | the eight observations O-1..O-8 | downloaded into a scratch directory and **read, not executed**; `discovery.js` SHA-256 `9370a67738ab87d2a3fe68300782236ce7294e795b99156b649b61922827f6a5` |

What the specifications changed in the earlier assumptions (`01_specs.md` B.2.0):

- A-2 ("a ProbeMatch carries ... scopes with vendor / model / name") — **partly wrong**: ONVIF Core
  26.06 Table 8 has the categories Profile, Location, Hardware, Name, MacAddress, SerialNumber and
  requires at least one fixed profile, hardware and name entry. There is no vendor category.
- A-3 ("most cameras refuse `GetDeviceInformation` without an account") — **confirmed for the
  default access policy**: access class `READ_SYSTEM`, not granted to an anonymous user (§8.3.1,
  Table 7).
- New: version 26.06 requires `tds:Device` in `Types` and does not contain the string
  `NetworkVideoTransmitter` at all — the type the `onvif` package (and most examples) probe for.

Not verified, labelled hypothesis in the spec: H-11..H-21 (§J), and the ONVIF Media access classes
of `GetProfiles` / `GetStreamUri` (inside H-7b).

## 4. Proof that §A.2, §A.4 and §B.2 are unchanged

All hunk headers of `git diff -U0 HEAD -- masterplan/05_capture_architecture_spec.md` (12 hunks):

```
@@ -31 +31 @@
@@ -59,0 +60 @@
@@ -113,0 +115,116 @@
@@ -286,0 +404,330 @@
@@ -317,0 +765,51 @@
@@ -354,0 +853,19 @@
@@ -717,0 +1235,33 @@
@@ -788,0 +1339,16 @@
@@ -805 +1371,2 @@
@@ -808,0 +1376,11 @@
@@ -827,0 +1406 @@
@@ -844 +1423 @@
```

Old line ranges of the three sections (from the pre-edit file): §A.2 = 114-150, §A.4 = 185-220,
§B.2 = 399-484. Old-side positions of the hunks: 31, 59, 113, 286, 317, 354, 717, 788, 805, 808,
827, 844 — none inside 114-150, 185-220 or 399-484. The hunk `-113,0` is an insertion after old
line 113, the blank line that closes §A.1; the heading of §A.2 follows the inserted text (new line
231).

Second proof, by content (script output; each section cut from its heading to the next heading,
SHA-256 of the text, first 16 hex digits):

```
### A.2 old lines 114-150 new lines 231-267 sha256/16 old 988c35c03eea20c1 new 988c35c03eea20c1 IDENTICAL
### A.4 old lines 185-220 new lines 302-337 sha256/16 old 8ce7c5486a015b29 new 8ce7c5486a015b29 IDENTICAL
### B.2 old lines 399-484 new lines 916-1001 sha256/16 old 522eda10ab68e3fc new 522eda10ab68e3fc IDENTICAL
```

No cross-reference was added inside those three sections. The delta refers **to** them (W-1, W-6,
the bind rule) from outside.

Row verification "§A.1, §A.6, §A.7 and §G each carry a dated delta citing D73-D76": headings at
lines 115 (§A.1.1: D73, D74, D75, D76), 404 (§A.6.0: D73, D74, D75, D76), 765 (§A.7.1: D73, D74,
D75, D76) and 1235 (§G.1: D73, D74, D75, D76), each "Delta 2026-10-09 (row 123)".

Other self-checks: forbidden-muxer grep of the spec's self-gate still returns 0 lines; no emoji;
15 distinct marks PE-123-01..PE-123-15.

## 5. Rationale in short (the full text is in the spec)

| Topic | Decision | Main reason |
|---|---|---|
| Where adapters run | Core process, not the worker | the worker is a C program that listens and reads pipes; W-1; D80(11); "worker unchanged" |
| Discovery socket | one `udp4` socket per search, in one pinned Core file; IPv4 only; bound to the one eligible interface, wildcard only when several interfaces must be covered; TTL 1 | C-N13 literally ("one socket per search"); "never bind beyond what is needed" |
| Probes | two typed probes (`tds:Device`, `dn:NetworkVideoTransmitter`), each sent twice, window 3,000 ms | V-8; `APP_MAX_DELAY` 500 ms |
| Acceptance | `RelatesTo` must match; on-link source; size and count caps | an answer is an unauthenticated claim (WS-Discovery §8.1) |
| Anti-steering | service address used only if its host equals the datagram's source address; otherwise listed, not connectable | D80(11) |
| Dependency | own probe over `node:dgram` + the `onvif` package for the authenticated test only | the package's discovery cannot meet four bounds and can be crashed by one datagram (O-8) |
| Connection test | reads only, pinned call list, digest only, address pinned, no `SETUP` / `PLAY`, 15 s budget | D75, D76; class C boundary |
| Credential | one call's lifetime, `Buffer` zeroed, stated limit for strings; never argv / env / log / URL | D80(7); SEC35-04 |
| Local camera | the FFmpeg program **pushes** RTSP/TCP into the worker's listen ingest; no server, no MediaMTX, no bound port | how row 58 built the ingest |
| Wall clock | wall-clock stamping + `-copyts` + matching `-output_ts_offset` / `-start_time_realtime` | otherwise a constant AV error equal to the start-up delay (H-17) |
| Local mic | the FFmpeg program writes 48 kHz mono float into the row-58 named pipe | the only transport the unchanged worker has |
| Flag | one boolean read inside row 61's one function; three operations; rows 6-10 refused at boot | D72(l); R-11 AC-1 |
| Session start | worker and supervisor already do it; the notifier is new (row 139); adapters raise nothing | D72(k); R-10 AC-3, AC-6 |

## 6. Erratum rows for `masterplan/11_audit_errata.md` (not edited here; for the controller to place)

Columns as in its §5.1. Line numbers are after the edit.

| ID | spec file:line (after the edit) | old text (abridged) | new text | source file:line | decision |
|---|---|---|---|---|---|
| **PE-123-01** | `masterplan/05_capture_architecture_spec.md:60` (§0) | (no row for the new scope) | decision-inputs row: probe-only discovery owned by the Core, credential-gated connectivity, `LOCAL_DEVICE` in front of the unchanged worker, development flag, D72(k) notification | `decisions/decisions.md:85-93` | D72(k), D73-D78, D80 |
| **PE-123-02** | `:115-173` (§A.1.1) | Target `apps/capture-worker/src/adapters/`; no adapter kind | adapters are Core-process code under `apps/core-server/src/capture/adapters/`; `CaptureAdapterKind`, `CaptureSourceClass`; registry rules RG-1..RG-5; development slots | `implementation/20_m3_worker_engine.md` §0; `packages/capture-protocol/src/index.ts:264-265` | D73, D74, D76, D80(9), D80(11) |
| **PE-123-03** | `:175-229` (§A.1.2) | (no development flag) | keys `DEMS_CAPTURE_DEV_SOURCES`, `DEMS_CAPTURE_HELPER_FFMPEG`; `CaptureOperation` = `SIMULATED` / `REAL_PRODUCTION` / `REAL_DEVELOPMENT`; ten-row table; "production configuration" defined | `delegation_progress/pair_58_navigator_a.md:40`; `apps/core-server/src/modules/capture-config/fencing.ts:55-57`; `apps/core-server/src/config.ts:41-45` | D72(l), D73 |
| **PE-123-04** | `:424-494` (§A.6.1) | `discover(): Promise<CameraDescriptor[]>`, real implementation class C | probe-only WS-Discovery: V-1..V-12, message flow, DS-1..DS-15 | WS-Discovery 1.1 §3.1.1, §3.1.3, §5.3, §8.1; ONVIF Core 26.06 §7.1-§7.3.3, §8.3.1 | D74 (1), D75, D76 (1), D80(1), D80(11) |
| **PE-123-05** | `:496-545` (§A.6.1a) | "Q-INSTALL item 6 permits an ONVIF npm" (no package named) | `onvif` 0.8.3 (MIT) named; O-1..O-8; own probe over `node:dgram` for discovery, the package for the connection test only; licence entries for row 96 | `report/report.md:72`; `identification/02_structured.md:606`; `research/02_collection.md:155-157`; package source 0.8.3 `lib/discovery.js`, `lib/cam.js:94`, `:106`, `:121-123` | D4 (Q-INSTALL), D80(1) |
| **PE-123-06** | `:547-594` (§A.6.2) | (no connect sequence) | seven steps; `testConnection` outcomes `UNREACHABLE` / `AUTHENTICATION_FAILED` / `WRONG_PROFILE` / `NOT_H264` / `REACHABLE` by observation; CT-1..CT-7 | `masterplan/01_specs.md:291-297` | D76, D80(4), D80(7), D80(11) |
| **PE-123-07** | `:596-625` (§A.6.3) | "the credential is injected only at the worker spawn point" | CR-1..CR-7; credential as separate fields on standard input of the process that opens the RTSP session; as built no such process exists for a real camera (class C-2 gap) | `packages/capture-protocol/src/index.ts:245`, `:264-265` | D76, D80(7); SEC35-04 |
| **PE-123-08** | `:627-693` (§A.6.4) | (no local-device kind) | camera helper = FFmpeg program pushing RTSP/TCP to the worker's listen ingest; exact argument line; GOP 30 frames at 30 fps; wall-clock options; fake camera of slot 2; HL-1..HL-14 | `apps/capture-worker/src/ingest.c:281`, `:304`, `:335-340`; `apps/capture-worker/test/m3worker.py:777`; probes P-1..P-5 | D73, D74, D80(11) |
| **PE-123-09** | `:695-732` (§A.6.5) | (no session-start rule in this spec) | 0 / 1 / 2 cameras table; who raises what; "connecting cameras" until the first durable fragment | `implementation/20_m3_worker_engine.md` fix round 1; `packages/capture-protocol/src/index.ts:142`; `apps/capture-worker/src/ingest.c:88-94` | D72(g), D72(h), D72(i), D72(k), D80(6), D80(8) |
| **PE-123-10** | `:765-814` (§A.7.1) | `open(inputId): Promise<AudioStreamHandle>` (handle undefined) | handle names the `PCM_FIFO` transport; mic helper line; fake mic of slot 2; ML-1..ML-8 | `packages/capture-protocol/src/index.ts:137`, `:165-172`; `apps/capture-worker/test/fake_mic.c:1-18` | D73, D74, D80(5), D80(11) |
| **PE-123-11** | `:853-872` (§A.8.1) | "`fake-onvif-stub`" (one word) | ST-1..ST-5: unicast probe answers, hostile answers, device service with fixture account, RTSP `DESCRIBE`-only responder, request log | `masterplan/01_specs.md:289`, `:300` | D74 (1), D76 |
| **PE-123-12** | `:1235-1268` (§G.1) | G-R1..G-R8 | SEC35-23 exception stated; G-R9 (`node:dgram` one file), G-R10 (`node:net` one file, no `SETUP` / `PLAY`), G-R11 (`onvif` one file, pinned calls), G-R12 (helpers through `ipc.ts`), G-R13 (`discover` call sites), G-R14 (no credential literal, no fake substitution), G-R15 (flag read once); G-R4 and G-R6 extended | `apps/core-server/src/capture/__tests__/static.test.ts:38`, `:128`, `:134` | D73-D76, D80; SEC35-23, SEC35-25 |
| **PE-123-13** | `:1339-1354` (§I) | "P25 edit count: 14" | planned edits 15-18 in `config.ts` (two capture config keys, OD-14 category 3); 18 planned; no edit of `app.ts` / `index.ts` | `apps/core-server/src/config.ts:41-45` | D73, D72(l); OD-14 |
| **PE-123-14** | `:1371-1372`, `:1376-1386` (§J) | H-7 "ONVIF discovery / profile listing / NTP set work against the target camera ... class C-1" | H-7a (unauthenticated discovery, scheduled) and H-7b (authenticated actions, class C); H-11..H-21 | — | D75, D76, D80(1) |
| **PE-123-15** | `:31`, `:1406`, `:1423` | front matter, self-gate, footer | range PE-123-01..PE-123-15 named; self-gate row | — | D80 |

## 7. Hand-over list

| Row | What it must take from this delta |
|---|---|
| 61 | §A.1.2: the development flag is one more input of the ONE capture-mode function; refusals 6-10; row 5 of the table is row 61's own decision; path check for `DEMS_CAPTURE_HELPER_FFMPEG`; guard-family count gains G-R9..G-R15 |
| 122 | Stored spelling and column of the adapter kind (`ONVIF_RTSP`, `USB_AUDIO`, `SNMP_POE`, `FAKE`, `LOCAL_DEVICE`); source class is derived, not stored; candidate matching key = endpoint reference (`onvif_uuid`), MAC scope as a secondary hint only; candidates are never rows; the boot check of §A.1.2 reads the kinds of **assigned** devices |
| 125 | Candidate row fields available without a request (DS-10): name hint, hardware hint, address, `connectable` + reason; **no vendor field can be promised** (V-9); three "search could not run" states distinct from "nothing found" (DS-13); five outcomes with reason codes; "connecting cameras" instead of a recording indicator until the first durable fragment (§A.6.5); first-run permission is asked at pre-check (HL-12) |
| 126 | Review: the wildcard bind when several interfaces are eligible (DS-4); `RelatesTo` + on-link filter (DS-8); anti-steering (DS-9, CT-3); the unvalidated camera certificate (CT-6); digest-only rule (CT-1, H-21); O-8 as the reason the package's discovery is not used; the string-zeroing limit (CR-3); rate constants (DS-11, CT-5); the helper argument rule (G-R12); H-13 (a silent multicast drop reads as an empty network) |
| 127 | Checks to name: socket snapshot 0 / 1 / 0; hostile-datagram set ST-2 (Core survives each); 0 requests before refusal for each precondition; request log = CT-1 list only; stub fails on `SETUP` / `PLAY`; boot-refusal test per row 6-10; helper snapshot = 0 listeners; `git diff apps/capture-worker/src` = 0 lines; H-17 step 1 (generated picture, shift near 0) and step 2 (clap, user present); observed keyframe interval <= 2 s; named-error unit tests with a stub helper |
| 131 | Own probe in `adapters/camera/ws-discovery.ts` (the only `node:dgram` importer); two probes x two sends, 3,000 ms, TTL 1, IPv4, interface rule DS-4; acceptance DS-8; candidate fields DS-10; counts-only logging DS-12; installs `onvif` 0.8.3 and `xml2js` (exact pins, sole lockfile writer) but **does not use the package's `Discovery`**; **does not read device information over TCP** (D80(1) overrides the row's own sentence); hostile-datagram test before the real-LAN check; the real-LAN check runs outside the sandbox through the permission gate and reports "not run" when no probe left the interface (H-13) |
| 134 | Helper = the FFmpeg program with the argument line of §A.6.4; first check H-17 step 1 **without the camera**; then H-15, H-16 with the camera; device checks outside the sandbox (HL-13); record the real refusal text only if the user denies (H-18); fallback = the small native helper if H-17 fails |
| 135 | Mic helper line of §A.7.1; pipe by `/usr/bin/mkfifo -m 600` through the process door; H-20 |
| 136 | Kinds, source class, RG-1..RG-5; keys and P25 edits 15-18; fake camera and fake microphone of slot 2 are the same program with generated inputs; process door variant in `ipc.ts` with captured standard error; G-R12, G-R14, G-R15 |
| 142 | `onvif-session.ts` as the only importer of `onvif` with the pinned call list, `autoconnect: false`, `preserveAddress: true`, explicit timeouts; `rtsp-describe.ts` as the only `node:net` importer (or the controller's ruling on the gap, section 8 item 2); outcomes and CT-1..CT-7; credential rules CR-1..CR-7; stub modes ST-3, ST-4; H-21 |

Also touched, not in the requested list: row 60 (the stub of §A.8.1), row 65 (the adapters live in
the Core; `AudioStreamHandle` shape), row 66 (plan builder: the four slots, ports from 8554-8564,
`PCM_FIFO` paths), row 71 (calls `openSource` / `open` after `app.capture.start`, closes every
handle on every exit path; "connecting cameras"), row 96 (licence entries of §A.6.1a), row 139
(the notifier of §A.6.5).

## 8. For the controller

| # | Point | Kind |
|--:|---|---|
| 1 | **Dependency recommendation:** own WS-Discovery probe over `node:dgram` (one pinned file, about 200 lines, `xml2js` for parsing) + the pre-approved ONVIF package `onvif` 0.8.3 (MIT) for the authenticated connection test only. The package's own discovery is rejected on evidence read in its source (O-2, O-4, O-6, O-8). O-8 — one datagram with two `ProbeMatch` children raises an uncaught exception — was found **by inspection, not by running it**; row 131 can confirm it on the stub in a throw-away process. This is a hand-built piece under the ready-made-frameworks rule and is recorded as the decision that rule asks for | decision to record |
| 2 | **RTSP `DESCRIBE` needs a small hand-written TCP client** (about 150 lines, `node:net`, one pinned file): `ffprobe` would put the credential in the argument list and no RTSP package is pre-approved. Alternative: codec check from the ONVIF answer only (weaker). Not decided silently — the spec writes the client and names the alternative | **needs a ruling** |
| 3 | **Blueprint row 131's text** still says "plus reading the responders' unauthenticated device information" — D80(1) forbids the TCP read; only the scopes in the answer are read. A one-clause correction for the task-architect (MINOR) | routing |
| 4 | **Class C-2 gap:** as built, nothing can record a real camera — the plan has only a loopback listen address and the worker never dials out. A pull input kind (protocol + worker change) or a pull relay that takes the credential on standard input is needed; no row builds it. Not needed for R-9..R-11 | blueprint gap (class C) |
| 5 | **Helper pipeline:** FFmpeg 9.0.2 command-line program as all four development sources (local camera, local microphone, fake camera, fake microphone); pushes into the unchanged worker; binds nothing. The audio/video alignment of the local path rests on hypothesis H-17 (three timestamp options combined); it is testable without the camera, and the fallback is a small native helper | decision to record; risk |
| 6 | **Mixed configurations are refused** (RG-3, table rows 7 and 8): a session is all production sources or all development sources. D80(9) says the mark is per source class; it does not say whether one session may hold both. The spec chose "no" | **needs a ruling** (could be put to the user with the next summary) |
| 7 | **For the user:** (a) the macOS permission prompt will appear at the first pre-check in development mode and names the application that started the Core (H-19); (b) the final AV check of the local path (a hand clap in front of the camera) needs the user present; (c) device checks of rows 134 / 135 / 140 and the real-LAN probe of row 131 must run outside the agents' command sandbox, which hides the devices (P-1) and blocks LAN traffic | user action later |
| 8 | Stale line in spec §I: edits 7-10 are still listed "not landed" while row 58's report says they landed (`20_m3_worker_engine.md` §5.1). Not this row's edit; noted inside the §I delta | errata owner |
| 9 | `01_specs.md` B.2.0 assumption A-2 names "vendor" among the announced fields; the ONVIF Core text has no such scope category (section 3). The acceptance criterion R-9 AC-2 already says "where the device announces them", so no requirement changes; rows 121 / 125 should not promise a vendor column | note |

## 9. Not done, by instruction

- `masterplan/11_audit_errata.md` not edited (section 6 holds the rows).
- No other spec, no blueprint, no decision file, no tracker, no code edited.
- No implementation plan written (`masterplan/02_plan.md` is not in this row's output).
- The camera and the microphone were not opened; no port was bound; no datagram was sent; no
  package was installed; the downloaded package source was read, not executed.
