---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
date: 2026-10-07
agent: data-analyst
blueprint_row: 15
milestone: M1
class: A/B
tier: 1
artifact_type: engine pick memo (S3 substitute — RF-1 desk memo)
status: complete
verdict: FFmpeg selected; GStreamer not evaluated on host (row 13 deferred, row 14 not run)
confidence: HIGH for the FFmpeg pick; HIGH that GStreamer is unevaluated; MEDIUM on the weight of external evidence
source_translated_task: /Users/gsp-budi/Documents/DEMS/docs/2026-10-07_dems_real_capture_sealing/identification/01_translated.md
source_structured_task: /Users/gsp-budi/Documents/DEMS/docs/2026-10-07_dems_real_capture_sealing/identification/02_structured.md
inputs_read:
  - decisions/decisions.md (D10c line 18; D12 line 21; D4 line 8)
  - identification/02_structured.md row 15 (line 195), row 31 (line 211), row 38 (line 218), RF-1 (line 118)
  - research/06_spike_s1_fmp4_running_hash.md (S1)
  - research/07_spike_s2_mic_switch_timeline.md (S2)
  - research/08_spike_s4_av_sync_fixture.md (S4)
  - research/02_collection.md (F-01..F-102: F-47, F-52, F-53, F-58..F-60, F-63..F-74, F-90..F-94)
  - initialization/01_env_check.md §3 (FFmpeg 9.0.2 option text)
  - initialization/03_gstreamer_install.md (row 13 deferral evidence)
last_updated: 2026-10-07 17:45
---

# Media-engine pick memo — FFmpeg vs GStreamer (row 15, M1)

> **ERRATUM (RV-SPEC, 2026-10-08; audit AU-2 `verification/21_audit_spikes_stt.md` §2-§3, findings
> AU2-03/AU2-05/AU2-07; decision D18). The memo's scores and the FFmpeg pick stand; three cited
> figures are corrected.**
>
> | Where (this file; `:n` = line numbers before this note was inserted) | As recorded | Correct reading |
> |---|---|---|
> | §1 mic-switch row (`:43`), §2 criterion 2 (`:71`), §5 item 3 (`:154`) | realised boundary "+21.333 ms = 1 AAC frame" as the bound | that figure is a property of S2's 1024-sample **pull** loop; a push-mode worker switches at the next input chunk (≤ 10 ms in AU-2). Bound = one worker input quantum + IPC latency; the command must run on the filtering thread. The switch is a hard cut that clicks audibly (16-24x the normal sample step) |
> | §1 (`:43`), §2 criterion 2 (`:71`) | "file gap 0.001 ms" | the packet-grid metric is blind (reads 0.0000 ms on a copy with 20.8 ms of samples removed); gaplessness is confirmed instead by AU-2 at sample level (0 inserted / 0 dropped samples in 4 switches) |
> | §2 criterion 8 (`:77`) | "−1.333 ms aligned … 78.667 ms injected … direct controls 0.0/80.0 ms exactly" | sample-exact: **0.00 ms** aligned (+0.021 ms = one sample), **80.021 ms** injected; the −1.333 / 78.667 ms values are 10 ms analysis-window artefacts. Score "Strong" unchanged |
>
> The live-switch verdict (D10(c): libavfilter API, not the CLI) is **confirmed** by AU-2.


Read as the RF-1 desk memo (`identification/02_structured.md:118`): the GStreamer install was deferred
(`decisions/decisions.md:21`, D12 item (d)), so row 14 did not run and this memo scores GStreamer from
documented facts plus the row-13 footprint evidence, **not** from a host benchmark. No benchmark number for
GStreamer is invented anywhere in this file.

---

## 1. Decision statement

| Item | Decision | Grounding |
|---|---|---|
| Engine for M3 (capture worker) | **FFmpeg 9.0.2** (already installed, `F-01`) | S1 fMP4 + running-hash path PASS 5/5 (`research/06_spike_s1_fmp4_running_hash.md:22-28`); S2 operator switch PASS 12/12 (`research/07_spike_s2_mic_switch_timeline.md:30`); S4 AV sync PASS 9/9 (`research/08_spike_s4_av_sync_fixture.md:25-29`) |
| Engine for M7 (sealing path) | **FFmpeg** for the container copy; the per-fragment integrity/encryption layer is **engine-independent** | S1 SP-7: the hash chain is re-derivable with `dd`/`head`/`shasum`/`xxd` and has no FFmpeg dependency (`research/06_spike_s1_fmp4_running_hash.md:375`); F-47/F-52/F-53 show no muxer AEAD on either engine |
| Mic-switch mechanism | **Embedded libavfilter API** (`avfilter_graph_send_command` on a named `astreamselect`), **not** the bare CLI | S2 run 3: realised boundary exactly +21.333 ms = 1 AAC frame; file gap 0.001 ms (`research/07_spike_s2_mic_switch_timeline.md:44,98-109`); D10c (`decisions/decisions.md:18`) |
| GStreamer comparison | **Open, non-blocking** — re-evaluate only if the 11-upgrade install is later approved | D12: rows 13 -> 14 re-run and this memo refreshed before row 38 (`decisions/decisions.md:21`); RF-1 (`identification/02_structured.md:118`) |
| Parts that remain open | Fragment quantum (SP-4), fsync policy (SP-2), skip_trailer (SP-3), sprop-less SDP guard (SP-6), restart-per-session supervisor (SP-5) — all row-31 design decisions, not engine-pick questions | `research/06_spike_s1_fmp4_running_hash.md:369-376` |
| Parts that are engine-independent by design | Per-fragment AES-256-GCM, manifest v2, `Signer`, RECOVERY, hash chain, one-fragment tamper check | F-47/F-52/F-53; S1 SP-7; row 15 brief item 3 |

### Why FFmpeg, stated against the four decision inputs

| # | Input | Evidence | Effect on the pick |
|---|---|---|---|
| a | S1: RTSP-listen ingest exits on `TEARDOWN` and refuses a re-push; the supervisor must restart the ingest process per session | `research/06_spike_s1_fmp4_running_hash.md:174-190` (G-1), `:373` (SP-5) | A **supervisor rule**, not an engine failure. It is measured, understood, and cheap to encode; it does not favour a different engine, and GStreamer's `rtspsrc` lifecycle is **unmeasured** (F-71 external only) |
| b | S2: the operator-triggered switch now works **in-process** via the libavfilter API | `research/07_spike_s2_mic_switch_timeline.md:44,98-109`; D10c (`decisions/decisions.md:18`) | Removes the last stated reason GStreamer was needed for R-3. FFmpeg CLI-alone fails the operator-trigger test (`research/07_spike_s2_mic_switch_timeline.md:24,41-42,146`), so the worker is embedded-API, not CLI |
| c | The mp4 muxer cannot do per-fragment AEAD (CENC AES-CTR only); per-fragment GCM lives outside it regardless of engine | F-47 (`research/02_collection.md:101`), F-52 (`:106`), F-53 (`:107`) | Removes AEAD as an engine differentiator. The integrity layer is a wrapper over stored fragment bytes (OD-03 option (a), `identification/02_structured.md:310`) |
| d | The pick must survive the x86 Linux Core device | F-73/F-74 (`research/02_collection.md:137-138`); `initialization/03_gstreamer_install.md:183-190` | FFmpeg is ubiquitous and packaged on Linux; the GStreamer Rust plugin set has **no** Debian/Fedora/Arch/Alpine/AUR package and must be built from source |

**Conclusion:** build M3/M7 on FFmpeg. GStreamer is neither required nor disproven — it is **unevaluated on this host**, and the evidence that exists about obtaining it (footprint, licence, Linux packaging) is unfavourable for this phase.

---

## 2. Scoring matrix

Score scheme: **Strong / Adequate / Weak / Not evaluated on host**. Every GStreamer cell that has no live
evidence is marked `Not evaluated on host`; where a cited fact from `research/02_collection.md` or the row-13
record covers it, the cell is marked `Weak` or `Not evaluated on host` with the tag `(external evidence)`.
No GStreamer timing, throughput, gap, hash or crash figure is stated anywhere — none was measured.

| # | Criterion | FFmpeg score | FFmpeg evidence (row artifact / fact) | GStreamer score | GStreamer evidence / why not scored |
|---|---|---|---|---|---|
| 1 | Fragment control (fMP4: `frag_duration`/`frag_size`/`fragment_index` vs `isofmp4mux`) | **Strong** | `frag_duration`, `frag_size`, `fragment_index`, `min_frag_duration` confirmed on this build (`initialization/01_env_check.md:74`; F-02..F-05, F-15); measured 8 fragments / 33-45 KB, keyframe variant 4 x ~2 s (`research/06_spike_s1_fmp4_running_hash.md:123-138,306-335`) | Not evaluated on host (external evidence) | `isofmp4mux` exists (F-67/F-68, `research/02_collection.md:131-132`) but its element page documents **only** `offset-to-zero` (F-68) and the plugin is built under meson `isobmff=auto`, i.e. it can be skipped silently (F-69, `:133`). Row 14 not run |
| 2 | Gapless switch (operator-triggered) | **Strong** | libavfilter API run 3: realised boundary +21.333 ms (1 frame), file gap 0.001 ms, placement error 0.58 ms (`research/07_spike_s2_mic_switch_timeline.md:98-109,118-124`); CLI-alone = FAIL (`:24,146`) | Not evaluated on host (external evidence) | `input-selector` facts only (per-pad `active`/`running-time`/`always-ok`, F-70, `research/02_collection.md:134`); `input-selector` + `rtspsrc` lifecycle untested. S2 §6.5 names exactly what row 14 would have to measure (`research/07_spike_s2_mic_switch_timeline.md:149`) |
| 3 | Hash tap (per-fragment extraction points) | **Strong** | S1 SP-7: per-fragment stored-byte SHA-256 + digest chain + running prefix, independently re-derivable with `dd`/`head`/`shasum`/`xxd` (`research/06_spike_s1_fmp4_running_hash.md:112-116,375`); `moof.sequence_number` maps to C2PA `sequenceNumber` (F-60, `research/02_collection.md:119`) | Not evaluated on host | No isobmff hash/box-tap evidence collected; no GStreamer prototype ran (row 14 not run, D12) |
| 4 | Crash behaviour (SIGKILL mid-write) | **Strong** | Real `kill -9`: truncation detected 10.0 / 15.0 ms, durable prefix re-hash equality `4b41c9ca…a5f`, corrupt fragment identified (seq 7 @ 251,168) (`research/06_spike_s1_fmp4_running_hash.md:209-266`); synthetic mid-`mdat` tail path `:250-266` | Not evaluated on host | No GStreamer crash run exists; no durable-prefix evidence |
| 5 | Licence (distribution posture) | **Weak** | Installed build is GPL: `--enable-gpl --enable-libx264 --enable-libx265` (F-91, `research/02_collection.md:170`); FFmpeg legal page warns explicitly about libx264 (F-90, `:169`) — a distribution question for DOC-05, not a defect of the engine | **Weak** (external evidence) | Homebrew formula declares LGPL but builds `-Dgpl=enabled` with `x264`, `x265`, `ffmpeg` (F-92, `research/02_collection.md:171`); GStreamer licensing rules F-93/F-94 (`:172-173`); the **Rust plugin licence is still gap G-7** (`:570`); row 13 records the same (`initialization/03_gstreamer_install.md:156-167`) |
| 6 | Install footprint (host cost) | **Strong** | FFmpeg 9.0.2 already present at `/opt/homebrew/bin/ffmpeg` (F-01, `research/02_collection.md:40`; `initialization/01_env_check.md:67`); zero new formulae; 498 GiB free (`initialization/01_env_check.md:83`) | **Weak** (external evidence) | Deferred: 1 formula + **62 new dependencies + 11 forced upgrades** of shared libraries whose dependents include omlx, ffmpeg 9.0.2, openjdk@17 and the kilo runtime (D12, `decisions/decisions.md:21`; `initialization/03_gstreamer_install.md:76-130`); uninstall cannot revert the 11 upgrades (`initialization/03_gstreamer_install.md:169-181`) |
| 7 | x86 Linux portability (Core device) | **Strong** | FFmpeg is the ubiquitous packaged build; the S1/S2/S4 path uses only libav* + standard codecs; the `empty_moov`/auto-BSF note is a *host* guard, not a portability block (S1 G-2, `research/06_spike_s1_fmp4_running_hash.md:192-207`; F-01) | **Weak** (external evidence) | No Debian/Fedora/Arch/Alpine/AUR package for `gst-plugins-rs` (F-73, `research/02_collection.md:137`); on Linux the Rust plugins must be built from source (meson + cargo-c, F-74, `:138`); search coverage caveat G-10 (`:573`); row 13 §9 draws the same conclusion (`initialization/03_gstreamer_install.md:183-190`) |
| 8 | AV sync | **Strong** | S4 through the S1 pipeline: -1.333 ms aligned (within ±40 ms), 78.667 ms injected flagged, direct controls 0.0/80.0 ms exactly, stable across 3 runs (`research/08_spike_s4_av_sync_fixture.md:25-31,106-117`) | Not evaluated on host | No GStreamer AV measurement; S4 is an FFmpeg-pipeline artifact only |
| 9 | Ingest lifecycle / supervision | **Adequate** | Single-session listener: exits 0 on client `TEARDOWN`, a re-push gets `Connection refused`; resolved by restarting ingest per session (`research/06_spike_s1_fmp4_running_hash.md:174-190,373`) | Not evaluated on host (external evidence) | `rtspsrc` is a **pull** source (F-71, `research/02_collection.md:135`), a different lifecycle from the listen-mode ingest; no behaviour measured or documented for the DEMS topology |
| 10 | Growth / streaming observability | **Strong** | `ffprobe` exits 0 mid-write (size 173,101 B while writer alive), file grows from the first box write; `-flush_packets 1` required (`research/06_spike_s1_fmp4_running_hash.md:80-82,146-161`; `research/08_spike_s4_av_sync_fixture.md:133-147`) | Not evaluated on host | No GStreamer growing-file / live-read evidence |
| 11 | Maintenance & observability | **Adequate** | `ffprobe`/`ffmpeg` ubiquitous; the hash tap needs no re-mux (S1 SP-7); but the CLI has **no** operator command channel, so the worker must embed the libavfilter API (S2 §1 channels 3-5, `research/07_spike_s2_mic_switch_timeline.md:41-44`) | Not evaluated on host (external evidence) | Element documentation is sparse (F-68 exposes one property); Rust plugin licence/maintenance still gap G-7 (`research/02_collection.md:570`) |
| 12 | Authenticated integrity seam (per-fragment GCM) | Engine-independent (N/A to the pick) | No muxer AEAD on FFmpeg either: `-encryption_scheme` allows only `none`/`cenc-aes-ctr` (F-47, `research/02_collection.md:101`); CTR carries no tag (F-52, `:106`); GCM must wrap stored bytes outside the muxer (F-53, `:107`) | Engine-independent (N/A to the pick) | Same reasoning: the muxer choice does not change where per-fragment GCM lives. OD-03 option (a) is satisfied by an engine-agnostic wrapper |

### 2.1 Criterion count (self-gate support)

| Engine | Criteria with an explicit cell value | Breakdown |
|---|---|---|
| FFmpeg | **11 / 12** | Strong: 1, 2, 3, 4, 6, 7, 8, 10; Adequate: 9, 11; Weak: 5; N/A to pick: 12 |
| GStreamer | **11 / 12** | Weak (external evidence): 5, 6, 7; Not evaluated on host (8, of which 4 also carry external evidence): 1, 2, 4, 8, 9, 10, 11; N/A to pick: 12 |

Both engines are scored on **12 named criteria**, well beyond the row-15 minimum of 7
(`identification/02_structured.md:195`).

---

## 3. Recommendation with conditions

### 3.1 Build on now (M3 / M7)

| Build | Mechanism | Evidence |
|---|---|---|
| Capture worker | Embedded **libavfilter** process (C or a thin FFI binding), not a shelled-out `ffmpeg` CLI | S2 run 3 (`research/07_spike_s2_mic_switch_timeline.md:98-109`); D10c |
| Mic selector | Named `astreamselect` instance; toggle via `avfilter_graph_send_command(...,"map",...)` | S2 §1 channel 6, §6.1 (`research/07_spike_s2_mic_switch_timeline.md:44,145`) |
| fMP4 writer | `movflags +empty_moov+default_base_moof`, `-flush_packets 1`; `-listen_timeout 60`; URL without trailing slash; per-source `duration=` | S1 §2-§3 (`research/06_spike_s1_fmp4_running_hash.md:48-105`; SP-1) |
| Fragment quantum | `movflags +frag_keyframe` + `min_frag_duration` so fragments cut on the GOP grid (independently decodable, per-fragment AEAD/tamper) | S1 SP-4, G-3 (`research/06_spike_s1_fmp4_running_hash.md:306-335,372`) |
| Hash chain | Per-fragment stored-byte SHA-256 + digest chain + running prefix, recorded with byte offsets and declared sizes | S1 SP-7, §3.1 (`research/06_spike_s1_fmp4_running_hash.md:112-116,375`) |
| Supervisor | One session = one ingest process + one output file; restart listener **and** output context per session | S1 G-1/SP-5 (`research/06_spike_s1_fmp4_running_hash.md:174-190,373`); S4 S4-5 (`research/08_spike_s4_av_sync_fixture.md:173`) |

### 3.2 Re-evaluate only if the GStreamer install is later approved (D12 path)

| Trigger | Action | Gate effect |
|---|---|---|
| The 11 forced upgrades are approved | Re-run row 13 to completion (install + `gst-inspect-1.0 isofmp4mux` + `gst-inspect-1.0 input-selector`), then row 14 prototypes S1 + S2 on GStreamer, then refresh this memo | Row 38's M1 gate may proceed on rows 7/8/9/12/15 without rows 13/14 (`decisions/decisions.md:21`); the refresh must land before row 38 if rows 13/14 complete |
| Install stays deferred/declined | Keep this memo as the pick; row 14 records SKIPPED-by-deferral citing row 13 | No further action |

The GStreamer comparison is a **nice-to-have**, not a dependency: D10c removed the R-3 requirement it once served.

### 3.3 Engine-independent by design (unaffected by the pick)

| Component | Why it is engine-independent | Evidence |
|---|---|---|
| Per-fragment AES-256-GCM | No muxer on either engine offers AEAD; it wraps stored fragment bytes | F-47/F-52/F-53 (`research/02_collection.md:101,106,107`) |
| Manifest v2 | Records byte ranges + `moof.sequence_number` + interval data; produced by the worker, not the muxer | S1 SP-7; S2 §6.3 (`research/07_spike_s2_mic_switch_timeline.md:147`); F-60 |
| `Signer` interface | OD-04 software Ed25519 behind an interface, TPM later | `identification/02_structured.md:311` |
| RECOVERY / interrupted-seal | Operates on the durable prefix + manifest, not on the encoder | S1 §5.4 (`research/06_spike_s1_fmp4_running_hash.md:239-248`) |

---

## 4. Residual risk statement (row 15 second gate item)

Each risk names the milestone that carries it.

| # | Risk this pick leaves | Why it is still open | Carried by |
|---|---|---|---|
| R1 | **sprop-less camera SDP / disabled auto-BSF** | S1 G-2 proved the copy path healthy only because the synthetic SDP carried `sprop-parameter-sets`; a real SDP with in-band SPS/PPS only could yield a header-less file (`research/06_spike_s1_fmp4_running_hash.md:192-207`, SP-6) | M3 (real `CameraAdapter`, C-2) |
| R2 | **Per-session RTSP restart** | The listen ingest is single-session by design; a supervisor restart loop is required, and any resume semantics beyond "one file per session" are unproven (`research/06_spike_s1_fmp4_running_hash.md:174-190,373`) | M3 (supervisor/IPC) |
| R3 | **No AEAD in the muxer** | Per-fragment GCM must be built outside both muxers; the muxer's CENC is CTR-only and unauthenticated (F-47/F-52) | M3 (writer), M7 (one-fragment tamper check) |
| R4 | **GStreamer never benchmarked on this host** | Row 13 deferred, row 14 not run; the comparison rests on documented facts and footprint evidence (`decisions/decisions.md:21`) | M1 gate (row 38) if approved; otherwise DOC/decision note |
| R5 | **GPL build of the installed FFmpeg feeds distribution questions** | F-91 build has `--enable-gpl --enable-libx264 --enable-libx265`; the legal page warns on libx264 (F-90) | DOC-05 / M9 (licences) |
| R6 | **Flush is not fsync** | `-flush_packets 1` makes bytes visible to other processes but does not survive OS/power loss; no fsync policy chosen yet (S1 SP-2, `research/06_spike_s1_fmp4_running_hash.md:370`) | M3/M7; OS-level test is class-C pre-handover |
| R7 | **Fragment cuts mid-GOP under plain `frag_duration`** | Fragments would not be independently decodable, weakening per-fragment AEAD/tamper; the fix (keyframe fragmenting) makes GOP the quantum (S1 G-3/SP-4) | M3 (writer constants), M7 |
| R8 | **x86 Linux Core behaviour of the embedded API path is unmeasured** | S1/S2/S4 ran on arm64 macOS; libavfilter exists on Linux but no Core-device run was possible | M9 class-C (C-7 benchmark) |
| R9 | **Legal acceptance of fMP4 as "one whole file"** | Not a technical risk; OD-21 default keeps a lossless-concat fallback designed | M1/M3 (OD-21) |

---

## 5. Consequences for row 31 (capture architecture spec)

The spec (`identification/02_structured.md:211`) must state, because of this pick:

| # | Spec item row 31 must carry | Source |
|---|---|---|
| 1 | **Engine seam**: the capture worker depends on an engine interface; FFmpeg is the selected implementation behind it, so a future engine swap (or a GStreamer re-evaluation) does not rewrite the worker | This memo §1, §3.2; D12 |
| 2 | **Restart-per-session supervisor rule**: one recording session = one ingest process + one output file; restart listener and output context, not just the pusher | S1 G-1/SP-5 (`research/06_spike_s1_fmp4_running_hash.md:174-190,373`) |
| 3 | **Selector mechanism**: named `astreamselect` + `avfilter_graph_send_command("map")`; worst-case trigger-to-boundary bound of 1 AAC frame (21.333 ms) | S2 §6.1/§6.4 (`research/07_spike_s2_mic_switch_timeline.md:145,148`) |
| 4 | **Fragment-quantum decision (SP-4)**: state the exact pairing of fragment target, encoder GOP (`-g`) and `min_frag_duration` as contract constants; keyframe-aligned fragments for per-fragment AEAD | S1 SP-4, G-3 (`research/06_spike_s1_fmp4_running_hash.md:306-335,372`) |
| 5 | **fsync-vs-flush distinction (SP-2)**: `-flush_packets 1` is a userspace flush; specify an explicit per-fragment fsync policy and record byte offsets + declared sizes so crash detection does not depend on the writer | S1 SP-2 (`research/06_spike_s1_fmp4_running_hash.md:370`) |
| 6 | Command-shape traps (SP-1): explicit `-listen_timeout`, no trailing slash, per-source `duration=`, `-flush_packets 1` | S1 §2 (`research/06_spike_s1_fmp4_running_hash.md:48-82`) |
| 7 | Trailer decision (SP-3): prefer `movflags +skip_trailer` for pure append-only camera bytes (the sealing step computes its own index) | S1 SP-3 (`research/06_spike_s1_fmp4_running_hash.md:371`) |
| 8 | Extradata presence check at ingest start (SP-6): fail loudly on a sprop-less SDP rather than write a header-less file | S1 SP-6 (`research/06_spike_s1_fmp4_running_hash.md:374`) |
| 9 | Anchor interval data capture-side in the media-pts domain, not from operator wall-clock arithmetic | S2 §6.3 (`research/07_spike_s2_mic_switch_timeline.md:147`) |

---

## Self-gate

| Gate item (row 15) | Result | Evidence |
|---|---|---|
| Matrix scores both engines on >= 7 named criteria | **PASS — 12 criteria** (FFmpeg 11 evaluated + 1 N/A to pick; GStreamer 11 cells + 1 N/A to pick) | §2, §2.1 |
| Every score cites a row artifact or fact ID | **PASS** | Every cell in §2 carries an S1/S2/S4 line reference, an F-xx, a D-xx or an `initialization/` line |
| Residual risk stated | **PASS — R1..R9**, each with its carrying milestone | §4 |
| GStreamer marked Not evaluated where evidence is absent | **PASS** | 8 cells `Not evaluated on host`; 3 cells `Weak (external evidence)` sourced only from F-64..F-74 / D12 / row 13 |
| No benchmark number invented for GStreamer | **PASS** | No GStreamer timing, gap, hash, size or crash figure appears anywhere in this memo |

---

*Generated: 2026-10-07 17:45*
*Last Updated: 2026-10-07 17:45*
