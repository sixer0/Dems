---
task_id: 2026-10-07_dems_real_capture_sealing
blueprint_row: 3
agent: data-collector-local
class: A
milestone: M0
tier: 2
status: done
date: 2026-10-07
artifact: docs/2026-10-07_dems_real_capture_sealing/research/02_collection.md
baseline_head: 2a4f4ea063d1a7c72d3fb70d4951fa63029e57a8
facts_collected: 102
external_url_requests: 105
query_log_entries: 68
project_identifiers_in_queries: 0
gaps_open: 11
---

# Row 3 progress — capture / media-stack fact collection (external generic queries + local `ffmpeg -h`)

## Status

**DONE.** Artifact written to `research/02_collection.md` (579 lines). Facts only, no design judgement, no engine recommendation, no code or configuration change. All ten collection items from the row-3 brief were covered; each produced at least one cited fact, and two items returned documented negative findings that are reported as such rather than filled with inference.

## Acceptance criteria check (row 3 Verification column)

| Criterion | Result | Evidence in the artifact |
|---|---|---|
| Every fact cites a URL or local `ffmpeg -h` output | PASS | Fact table has a mandatory "Citation" column; 102/102 rows populated. Local-only citations are labelled E-1..E-6 and the quoted output is reproduced verbatim in "Local Command Output Evidence" |
| Query log lists every query with 0 project names, paths or identifiers | PASS | "Query Log" section, 68 entries / 105 URL requests, each with tool, verbatim query or URL and outcome. Count of project identifiers transmitted: 0 (see "Red-line compliance" below) |
| Tier 2 research artifact under `research/` | PASS | `research/02_collection.md`, front matter `agent: data-collector`, `blueprint_row: 3`, `tier: 2` |
| Generic queries only (C-SAFE red line) | PASS | See red-line compliance |
| No repository source edits, no installs, no media in git | PASS | Only two files written, both inside this task folder; media probes wrote to `$TMPDIR/kilo/fmp4probe/` outside the repository; `git status --porcelain` shows no media file and no source file touched by this row |

## Numbers the controller needs

| Item | Value |
|---|---|
| Facts collected with citation | 102 (F-01..F-102, contiguous, grouped into 10 topic groups) |
| Confidence split | H (primary source or local command output) = 79; M (vendor page / registry metadata / derived) = 22; mixed H/M = 1 (F-34, RTSP port conventions: FFmpeg help plus MediaMTX config); L = 0 |
| Local evidence blocks | 6 (E-1 tool identity, E-2 muxer/demuxer/filter help, E-3 `-h full` numbering survey, E-4 ffprobe capability, E-5 packet positions + AAC arithmetic, E-6 truncation probe) |
| External URL requests | 105 across 68 logged entries; 4 endpoints unreachable (ISO catalogue 403, MPEG site timeout, Launchpad timeouts, DuckDuckGo timeouts) |
| Open gaps | 11 (G-1..G-11), each assigned to a named later row |
| Files written by this row | 2 (the artifact and this progress note) |

## Red-line compliance

- Every outbound request was a technology-documentation, package-registry or standards URL. Subjects used: `ffmpeg`, `movflags`, `astreamselect`, `gst-plugins-rs`, `isofmp4mux`, `homebrew formula`, `mediamtx`, `onvif`, `gstreamer licensing`, `bento4 mp4dump`, `gpac`, `c2pa bmff hash`, `swgde video`, `ISO base media file format`, `advanced audio coding`.
- Zero occurrences of a project name, product name, repository path, project file name, decision ID, customer name or internal domain in any query string, request body or uploaded content. Nothing from the repository, the design book or any recording was sent anywhere.
- Media generation used only synthetic lavfi sources (`testsrc`, `sine`) written to the OS temp directory, never to the repository or `docs/`.
- No network listener was opened, no port bound, no process started or stopped, no install performed, no sudo used. SMART WMS ports were never contacted.

## Findings that change downstream rows (facts, not recommendations)

| Fact | Row affected | What it changes |
|---|---|---|
| F-05 / F-14 / F-15 — `frag_type`, `default_prft` and `frag_start_number` are **not** options of the FFmpeg 9.0.2 mp4 muxer (`frag_type` is dash-muxer only; numbering is `-fragment_index`; `default_prft` does not exist in this build) | 31, 32 | The capture-architecture wording must not name these as mp4-muxer knobs; the real set is F-02..F-19 |
| F-07 — `empty_moov` works but is absent from the HTML manual's movflags list | 7, 31 | Row 7 must rely on `ffmpeg -h muxer=mp4`, not on the manual, and the spec should quote the help text |
| F-24 — `empty_moov` disables automatic bitstream filtering | 7, 31 | Copy-codec ingest path needs explicit verification in S1 (gap G-2) |
| F-26 / F-30 / F-31 — RTSP listen mode is input-side only; the push side is an ordinary RTSP client sending `ANNOUNCE`+`RECORD` | 7, 9 | Confirms the intended two-process topology exists in FFmpeg itself; still a hypothesis until measured |
| F-39 / F-40 / F-41 — CLI filter commands are media-time scheduled via `asendcmd`, not externally triggerable | 8, 31 | An operator-initiated switch cannot be expressed with the documented CLI mechanism alone; row 8 must measure what is achievable before row 31 specifies it |
| F-44 — AAC frame at 48 kHz measured as `duration=1024`, `duration_time=0.021333` | 8 | The 21.3 ms discontinuity floor in row 8's acceptance criterion is arithmetically confirmed; F-45/F-46 record the 960/128-sample variants as caveats |
| F-47 / F-52 — mp4 muxer offers CENC AES-CTR only, no AEAD | 31, 32 | Any per-fragment authentication must live outside the muxer (F-53) |
| F-54 / F-55 — `ffprobe` gives packet `pos`/`size` but has no box-tree dump | 7, 32 | Per-fragment byte ranges need either packet grouping or Bento4/GPAC (F-56/F-57, both GPL-or-commercial / LGPL-or-commercial per F-95) |
| F-58..F-61 — C2PA defines per-segment hashing plus a Merkle tree over `mdat` boxes with monotonic `sequenceNumber`s | 31, 32 | A published precedent exists for the fragment-chain shape; cite rather than invent |
| F-64..F-69 — Homebrew ships one `gstreamer` formula that bundles gst-plugins-rs with `isobmff` defaulting to `auto` | 13, 14, 15 | The install row needs one formula, not six; verification is `gst-inspect-1.0 isofmp4mux` |
| F-73 / F-74 — no Debian/Fedora/Arch/Alpine/AUR package found for gst-plugins-rs | 14, 15, 31 | Linux x86 portability of the GStreamer option rests on a source build |
| F-75..F-80 — MediaMTX is MIT, bottled at 1.21.1, single executable, RTSP handshake always TCP, records fMP4 with 1 s parts | 9, 14, 31 | Pull-mode fixtures are installable without licence risk; 1 s parts are an industry precedent for the fragment target |
| F-81..F-86 — ONVIF candidates: npm `onvif` 0.8.3 MIT (active), Rust `oxvif` 0.17.0 MIT (active); `node-onvif`/`onvif-cam-rs` stale; `onvif-device-rs` is a server, not a client | 31, C-1 | Narrows the library shortlist on factual grounds; conformance claims remain unverified (G-8) |
| F-88..F-92 — this host's FFmpeg is a GPL build (`--enable-gpl --enable-libx264 --enable-libx265`); Homebrew GStreamer is declared LGPL but built `-Dgpl=enabled` with x264/x265/ffmpeg deps | 15, 31, DOC-05 | Both candidate engines as currently installed are GPL-configured; an LGPL-only posture requires a different build, which is a fact row 15 must weigh |
| F-97..F-102 — ISO/IEC 14496-12 edition cited as 2026 (secondary source); SWGDE publishes ISO-BMFF video guidance; C2PA treats a fragmented MP4 as one asset made of hashable parts; **no public source addresses "one whole file" evidentiary status** | 32, OD-21 memo | The OD-21 decision package can carry these as landscape facts only; this row makes no legal claim |

## Issues & decisions log (for the controller to fold into shared trackers)

| # | Item | Type | Note |
|---|------|------|------|
| P-1 | OD-21 evidence question cannot be closed from public sources | Input to gate | F-102 is a documented negative. The gate should present it as "no external authority found", not as clearance or as a blocker |
| P-2 | OD-03 encryption wording needs the CTR-vs-GCM distinction | Input to gate | F-47..F-53 give the factual basis: CENC is confidentiality-only; authentication must be separate. Option (a) "per-fragment AES-256-GCM" is not a muxer feature in FFmpeg |
| P-3 | RF-6's "both hashes" default is technically coherent | Confirmation | F-62 records that stored-bytes and plaintext hashes are different objects under CENC, so recording both is meaningful |
| P-4 | Spike guard rails were respected and are sufficient | Process | No port was bound by this row; ports 8554-8564 remain untouched for row 2's probe and row 7's use |
| P-5 | DOC-05 licence register gains nine entries from this row | Hand-off | FFmpeg (LGPL base / GPL when optional parts used), this host's FFmpeg build (GPL), GStreamer core/plugins rule, Homebrew GStreamer (LGPL declared, GPL-configured), MediaMTX (MIT), Bento4 (GPL or commercial), GPAC (LGPL-2.1+ or commercial), npm `onvif` (MIT), Rust `oxvif` (MIT), `gst-plugin-onvif` (MPL-2.0). Gap G-7: gst-plugins-rs own licence not yet collected |
| P-6 | Two brief-named options do not exist in the installed FFmpeg | Correction surface | If any earlier document (impact map, proposals) assumed `frag_start_number`, `frag_type` on mp4, or `default_prft`, row 6 errata handling should note it |

## Verification of this row's own claims

| Claim | How it was verified |
|---|---|
| 102 facts, all cited | Row count of the fact table = 102 (IDs F-01 to F-102, no gap); every row has a non-empty Citation cell. Confidence tallies counted from that column: 79 H + 22 M + 1 mixed = 102 |
| Query log complete | 68 log entries enumerated from the actual tool calls made during this session; each entry lists tool, verbatim query/URL and HTTP outcome, including the failures and dead ends |
| 0 project identifiers sent | Every logged query inspected against the forbidden list (project name, product name, repo path, project file name, decision ID, customer name, internal domain): no match. Queries name technologies only |
| No repository or media side effects | Only two files written, both under `docs/2026-10-07_dems_real_capture_sealing/`; media written under `$TMPDIR/kilo/fmp4probe/`; `git status --porcelain` shows 4 entries, none created by this row except its own two documents, and none is a media file |
| Local outputs quoted, not paraphrased | E-1..E-6 reproduce command text and raw output; the AAC figure 0.021333 s and the truncated-file duration 3.021406 s are copied from `ffprobe` output |
| Source line numbers are real | `movenc.c`, `movenccenc.c/.h`, `movenc.h`, `aes_ctr.h`, `rtspdec.c`, `rtspenc.c` were fetched from the project's official mirror and grepped; cited line numbers come from those fetched files |

## What a later row must close

1. **Row 7 (S1)** — G-1 (accept-after-teardown), G-2 (auto-BSF effect on copy path), G-3 (fragment boundary behaviour at 1-2 s). These are the three facts this row could not obtain without executing a pipeline.
2. **Row 8 (S2)** — G-3 equivalent for switching: whether an operator-triggered switch is achievable through the CLI at all (F-39..F-41), and the realised discontinuity against the 21.33 ms floor.
3. **Rows 13/14** — G-7 (gst-plugins-rs licence) and G-10 (confirm the negative distro-packaging result with a wider search before row 15 scores portability).
4. **Row 31** — G-9 (do not spec non-existent muxer options) and the encryption/hash placement consequences of F-47..F-53, F-58..F-62.
5. **Row 32 / OD-21 memo** — G-4 (player conformance for a growing or truncated fMP4), G-5 (SWGDE PDF contents), G-6 (normative ISO citation via an accessible route).
6. **Row 31 / class-C C-1** — G-8 (ONVIF library conformance evidence beyond release dates).

---
*Generated: 2026-10-07 14:08*
*Last Updated: 2026-10-07 14:08*
