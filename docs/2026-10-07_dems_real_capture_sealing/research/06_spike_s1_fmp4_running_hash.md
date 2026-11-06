---
task_id: 2026-10-07_dems_real_capture_sealing
blueprint_row: 7
date: 2026-10-07
agent: coder-execution
milestone: M1
class: A
tier: 2
status: complete
verdict: 5/5 acceptance criteria PASS; gaps G-1, G-2, G-3 answered
media_root: /Users/gsp-budi/Documents/DEMS/.cache/spikes/s1/
inputs_read:
  - identification/02_structured.md row 7 + "Spike guard rails" (line 176)
  - initialization/01_env_check.md §3 (FFmpeg 9.0.2 option text)
  - research/02_collection.md F-05, F-07, F-14, F-15, F-24, F-26, F-29, F-30, F-47, F-58..F-61, gaps G-1..G-3, E-5, E-6
---

# Spike S1 — fragmented MP4 with a running SHA-256 chain survives growth and a mid-write crash

## 0. Verdict summary

| # | Acceptance criterion (row 7 Verification column) | Verdict | Primary evidence |
|---|---|---|---|
| 1 | ffprobe reads the file while it is still growing (probe output + size at that instant) | **PASS** | §4.3 (run 1: size 173,101 B, duration 6.061 s, writer alive) and §6.2 (run 3: size 128,218 B, duration 4.544 s, writer alive) |
| 2 | Running hash = `shasum -a 256` of the closed file when no truncation occurred (both values shown) | **PASS** | §4.4/§6.3: recorded last prefix `3c80f46e…c05` == whole-file `3c80f46e…c05` in run 1 and run 3 |
| 3 | Fragment sequence contiguous (`fragment_index` / `traf` order), manifest lists every fragment in order with no gap | **PASS** | `mfhd` sequence_number 1..8 contiguous, `traf`/`tfhd` order `[1,2]` in every fragment; byte ranges gapless — `verify.sh` output in §4.4, §5.4, §6.3 |
| 4 | After SIGKILL: truncated tail detected (size mismatch / moof parse error), durable prefix re-hashes to the recorded prefix hash, corrupt last fragment identified | **PASS** | Real kill: detection in 10–15 ms via missing-trailer/EOF path (§5.2, §5.3); partial-tail path (`size_mismatch_declared_gt_present`, corrupt fragment = seq 7 @ byte 251168) verified on a mid-mdat truncated copy (§5.5) |
| 5 | `git status --porcelain` lists 0 media files | **PASS** | §7 |

Gap answers: **G-1** — the RTSP listen demuxer does **not** survive the first `TEARDOWN`; it exits 0 and a second push gets `Connection refused` (§4.5). **G-2** — `empty_moov`'s auto-BSF disablement is real (exact log line in §4.6) but the codec-copy path needs **no bitstream filter**: the SDP `sprop-parameter-sets` extradata plus movenc's internal AVCC conversion produced a fully decodable file (§4.6). **G-3** — `frag_duration` cuts on the duration boundary **mid-GOP** (fragments 2..N start on a non-keyframe); the `frag_keyframe + min_frag_duration` variant cuts keyframe-aligned at the 2.0 s GOP (§6.5).

Run ledger (blueprint: 2 runs + 1 verification run):

| Run | Purpose | Result |
|---|---|---|
| run 1 (`run1_graceful.sh`) | graceful capture, growth probe, hash equality, G-1, G-2 | PASS (after 4 pipeline fixes, §2) |
| run 2 (`run2_crash.sh`) | SIGKILL mid-write crash | PASS; one extra iteration logged (`run2_boundarykill`, §5.6) plus a synthetic partial-tail detector test (§5.5) |
| run 3 (`run3_verify.sh`) | independent verification run + `verify.sh` + G-3 analysis + keyframe variant (`run3b`) | PASS, byte-identical to run 1 (§6.6) |

## 1. Scope, guard-rail compliance

- Synthetic sources only: lavfi `testsrc` + `sine` (§3 commands). No real devices, no emulators.
- All media and scratch under `/Users/gsp-budi/Documents/DEMS/.cache/spikes/s1/` only (`.gitignore:47` `.cache/` — `git check-ignore -v .cache/spikes/s1/run1/out.mp4` confirms, §7).
- **0 repository source edits** (git status shows only `docs/` artifacts, §7).
- Ports: only 8554 used; `lsof -nP -iTCP:8554-8564 -sTCP:LISTEN` re-checked (empty) immediately before each bind, and again inside every run script. SMART WMS ports 5173/5174/5175 were never contacted.
- No sudo, no installs, no external services. No 1-2 h loops: longest capture 12 s, total spike wall time ~15 min.

## 2. Pipeline as built — four FFmpeg 9.0.2 traps found and fixed (fix history)

The candidate command shape from F-31 (`-rtsp_flags listen -i rtsp://127.0.0.1:8554/`) **does not run as written on this host**. Four defects were diagnosed with exact errors; all four must be pinned in the capture architecture spec (row 31).

### 2.1 `-listen_timeout` default -1 breaks the internal TCP listener

First attempt, `ffmpeg -rtsp_flags listen -i rtsp://127.0.0.1:8554/ …` — error text quoted from the driver transcript of that attempt (the scratch `run1/ingest.log` was overwritten by the later successful run; the reproduction below regenerates it deterministically):

```text
[tcp @ …] Value -1000.000000 for parameter 'listen_timeout' out of range [-1 - 2.14748e+09]
[in#0 @ …] Unable to open RTSP for listening
Error opening input files: Result too large
```

The demuxer default `-1` (infinite) is scaled by 1000 for the inner tcp context (-1000) and rejected. **Fix: pass an explicit finite `-listen_timeout 60`** (seconds). Used in every subsequent command.

### 2.2 Trailing slash in the RTSP URL breaks server-side track matching

With the listener fixed, `SETUP` failed on trace level (ad-hoc diagnostic `ffmpeg -loglevel trace … -i rtsp://127.0.0.1:8554/ …`, transcript excerpt; scratch log since overwritten, reproducible by adding the trailing slash back):

```text
Parsing[40]: ANNOUNCE rtsp://127.0.0.1:8554/ RTSP/1.0
Parsing[48]: SETUP rtsp://127.0.0.1:8554//streamid=0 RTSP/1.0
[in#0 @ …] Unable to find requested track
```

rtspenc joins `base + "/" + "streamid=N"`; a base URL ending in `/` yields a double slash that the listen demuxer's prefix match against the SDP `a=control:streamid=0` rejects. **Fix: bind and push `rtsp://127.0.0.1:8554` without any trailing slash** (and no stream path, which the FFmpeg pair handles the same way).

### 2.3 A `-t` before the first `-i` binds only to that input — lavfi sources must carry `duration=`

A smoke probe with `-re -t 4 -f lavfi -i testsrc… -f lavfi -i sine…` stopped video at 4 s but left `sine` infinite: the listener ran to `time=04:23:25`, `audio:124263KiB` (130 MB file) at `speed=270x` before manual teardown (figures quoted from that smoke transcript; the scratch file was deleted). **Fix: put the duration inside each lavfi source (`testsrc=…:duration=12`, `sine=…:duration=12`) and a `-t 12` as an output option as the guard.**

### 2.4 Output buffering hides growth — `-flush_packets 1` is required

Without it, fragmented output stayed invisible on disk for the whole session: the file appeared only at writer close (first smoke: every fragment "closed" in one 80 ms poll after exit). This silently invalidates criterion 1 and weakens criterion 4 (nothing on disk mid-write = nothing ffprobe or the hash tap can see). **Fix: add `-flush_packets 1`** (`ffmpeg -h full`: `-flush_packets <int> E… enable flushing of the I/O context after each packet (default -1)`). With it, bytes land per box-write during growth — but flush granularity is box-level (probe sizes always equaled fragment ends, §4.3), and flush is not fsync (page cache; see finding SP-2 in §8).

## 3. Final commands (exact, as executed from `/Users/gsp-budi/Documents/DEMS/.cache/spikes/s1/`)

Listener / ingest (RTSP server side, the writer):

```text
ffmpeg -hide_banner -loglevel info \
  -rtsp_flags listen -listen_timeout 60 -rtsp_transport tcp \
  -i rtsp://127.0.0.1:8554 \
  -c copy -f mp4 -movflags +empty_moov+default_base_moof \
  -frag_duration 1500000 -fragment_index 1 -flush_packets 1 out.mp4
```

Pusher (RTSP client, second FFmpeg process; synthetic lavfi over TCP):

```text
ffmpeg -hide_banner -loglevel info -re \
  -f lavfi -i "testsrc=size=320x240:rate=25:duration=12" \
  -f lavfi -i "sine=frequency=440:sample_rate=48000:duration=12" \
  -c:v libx264 -preset ultrafast -tune zerolatency -g 50 -pix_fmt yuv420p \
  -c:a aac -ar 48000 -b:a 64k \
  -t 12 -rtsp_transport tcp -f rtsp rtsp://127.0.0.1:8554
```

Hash tap: `python3 monitor.py out.mp4 <writer_pid> manifest.jsonl manifest.tsv ingest.exit 80 120`
Verifier: `bash verify.sh out.mp4 manifest.tsv`

Scripts (full text): `run1_graceful.sh`, `run2_crash.sh`, `run3_verify.sh`, `monitor.py`, `verify.sh` — all in `/Users/gsp-budi/Documents/DEMS/.cache/spikes/s1/`.

### 3.1 Hash definitions (as implemented and verified)

- `frag_sha_n` = SHA-256 over the fragment's **stored bytes** `[start, start+len)` of the final file (moof box + its mdat box(es), inclusive) — recomputable independently: `dd if=out.mp4 bs=1 skip=$start count=$len | shasum -a 256`.
- Chain over digests: `chain_0 = SHA-256("") = e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`, `chain_n = SHA-256(chain_{n-1}_raw32 || frag_sha_n_raw32)` — recomputable with shell only: `printf '%s%s' "$prev" "$frag" | xxd -r -p | shasum -a 256` (implemented in `verify.sh`).
- Running prefix: `prefix_n = SHA-256(file bytes [0, end of record n))` — recomputable: `head -c $end out.mp4 | shasum -a 256`. The graceful-close trailer record (the `mfra` box) makes `prefix_final == shasum -a 256 out.mp4`; a pure append-only file (no trailer) can instead use `movflags +skip_trailer` (F-19) — decision for row 31 (finding SP-3).
- Fragment identity: `mfhd.sequence_number` (the `-fragment_index` counter F-15) and the ordered `traf/tfhd track_ID` list are parsed out of every moof and recorded per row.

## 4. Run 1 — graceful capture

Driver: `bash run1_graceful.sh` (12 s session, port precheck `8554-8564: no listeners (free)`, `t_start=1791361802.343`).

### 4.1 Manifest (fragment chain, all 8 fragments + trailer)

From `/Users/gsp-budi/Documents/DEMS/.cache/spikes/s1/run1/manifest.tsv` (tab-separated: kind, seq, tracks, start, len, frag_sha256, chain_sha256, prefix_sha256, closed_by, wall) — full text printed by the run, excerpted per fragment:

| seq | tracks | start | len | frag_sha256 (first 12) | chain (first 12) | prefix (first 12) | closed_by | wall delta to next |
|---|---|---|---|---|---|---|---|---|
| ftyp+moov | — | 0 | 28+1231 | c1e9f682… / 4a3ac3e0… | — | c1e9f682… / bd88e988… | complete | — |
| 1 | 1,2 | 1259 | 41482 | d0c641bb099f… | 345a077d1e9f… | d3159a3caa30… | next_box:moof | +1.584 s |
| 2 | 1,2 | 42741 | 43192 | 71099987bb11… | a04b5134f718… | 9b43206d4b46… | next_box:moof | +1.501 s |
| 3 | 1,2 | 85933 | 42285 | fe5f2b501d13… | 8f27615bf11e… | 5768d11ab89f… | next_box:moof | +1.588 s |
| 4 | 1,2 | 128218 | 44883 | 04ca221969a3… | 717b04acaafd… | d71df6e32d5f… | next_box:moof | +1.340 s |
| 5 | 1,2 | 173101 | 34769 | 04fb9dd9e22f… | 33cc2dcc5991… | 89d0d438733a… | next_box:moof | +1.586 s |
| 6 | 1,2 | 207870 | 43298 | b0c5c27932ac… | 846e1bc6cd4e… | 33edc6060282… | next_box:moof | +1.322 s |
| 7 | 1,2 | 251168 | 42559 | dba3eea83f00… | c78ee82582d3… | 4b41c9ca3841… | next_box:moof | +0.000 s (exit batch) |
| 8 | 1,2 | 293727 | 33038 | c7de7032df14… | 2a4a0649bfea… | f41f46451694… | next_box:mfra | — |
| trailer mfra | — | 326765 | 376 | 27b34fa93dc9… | d1f4f0cf17e6… | 3c80f46ed569… | complete_box | — |

Full 64-hex values are in the manifest files; `frag 1` exact: sha `d0c641bb099ff1f15e4e2e71f320ee55be512cb27766c8f1dfd8fd6feee4956c`, chain `345a077d1e9f5cced71a63d7ba09478f9069edf690a7cff21efb654d69384a69` (§4.2 shows these recomputed by `dd|shasum`/`verify.sh`).

### 4.2 Independent recomputation (criterion 3 mechanics)

`bash verify.sh out.mp4 manifest.tsv` (run 3 quotes full output; same file content in run 1): every fragment range re-hashed with `dd|shasum -a 256`, chain rebuilt with `xxd -r -p | shasum -a 256`, prefix with `head -c … | shasum -a 256`, range/sequence contiguity asserted → `VERIFY OK`.

### 4.3 Growth probe while the writer was alive (criterion 1)

`run1/growth_probe.txt` (ffprobe + `stat -f %z` at the same instant; writer alive confirmed by `kill -0`):

```text
probe_at_wall=1791361809.681 file_size=173101 writer_alive=yes
nb_streams=2
format_name=mov,mp4,m4a,3gp,3g2,mj2
duration=6.061333
size=173101
bit_rate=228465
0,h264,Constrained Baseline,6.061333
1,aac,LC,6.058667
```

The probed size (173,101) equals exactly the end of fragment 4 — direct evidence that flush granularity is box-level (finding SP-2). Duration 6.06 s read from a 12 s session that had produced 4.5 s of closed fragments plus in-flight bytes; ffprobe exits 0 mid-write.

### 4.4 Closed-file equality (criterion 2, run 1)

```text
$ shasum -a 256 out.mp4
3c80f46ed569b7a2bdf030ecbb23d5e923ffbe2f6464b5484e8fb399efc14c05  out.mp4
last recorded prefix (manifest.tsv trailer row, field 8)
3c80f46ed569b7a2bdf030ecbb23d5e923ffbe2f6464b5484e8fb399efc14c05
```

Final file size 327,141 B (12 s capture), `ingest exit: 0`, `pusher1 exit: 0`.

### 4.5 G-1 — accept-after-teardown of the RTSP listener

`run1/ingest.log` tail after the pusher's `TEARDOWN`:

```text
[in#0/rtsp @ 0x7a09010000] Failed reading RTSP data: End of file
Exiting with exit code 0
```

The driver then attempted a second push against the same port (the listener had already exited; `run1/pusher2.log`):

```text
[tcp @ …] Connection to tcp://127.0.0.1:8554?timeout=0 failed: Connection refused
[out#0/rtsp @ …] Could not write header (incorrect codec parameters ?): Connection refused
```

(pusher2 exit 195.) **Answer to G-1: the FFmpeg listen-mode ingest does NOT keep listening after a session `TEARDOWN` — it exits 0 on input EOF. A restarted listener DOES accept a fresh push (runs 2, 3 and 3b each bound 8554 again after a prior session and completed normally). The crash-resilient ingest loop must therefore restart the ingest process (and its output context) per session; restarting only the pusher is not sufficient.** F-32/F-33 source reading predicted per-session renegotiation; the surviving question was process survival — it does not survive.

### 4.6 G-2 — codec copy with `empty_moov` and auto-BSF disabled

Run 1 ingest ran with `-loglevel debug` (`run1/ingest.log`):

```text
[in#0 @ 0x7a09010000] Extradata set to 0x7a08c0d340 (size: 34)
[mp4 @ 0x7a09013480] Empty MOOV enabled; disabling automatic bitstream filtering
```

(F-24's exact string is present; exactly 1 occurrence.) Despite the disabled auto-BSF, the H.264 copy path is healthy:

- The RTSP SDP carried `a=fmtp:96 packetization-mode=1; sprop-parameter-sets=Z0LACtoINsBE…` → decoder extradata (avcC, 34 B) existed before the muxer opened; the `sine` → AAC path got AudioSpecificConfig the same way.
- mdat payload check (`run1/out.mp4` == `run3/out.mp4` byte-identical; walk output persisted at `run1/nal_layout_check.txt`): the first stored video AU starts at byte 2027 (matches `ffprobe` packet `pos=2027 size=6871`) and is a 4-byte-big-endian-length-prefixed NAL chain — first NAL `len=603 type=6` (AUD, `0x06`), then three `type=5` IDR slices (1819/1293/3140 B), then `type=1` slices; **no Annex-B start codes in payloads** (samples are MP4/AVCC-format). The `00000001` byte patterns found near fragment starts all lie inside moof box structure (e.g. bytes 1279/1303/1338 ∈ moof range [1259, 2019)), not in media data.
- Full decode: `ffmpeg -hide_banner -v error -i out.mp4 -f null -` → exit 0, 0 error lines (`run1` and identically `run3/decode_check.txt`, empty, exit 0).

**Answer to G-2: no workaround was needed on this host with FFmpeg 9.0.2** — movenc converts Annex-B RTP AUs to AVCC internally and the SDP `sprop` extradata satisfies the sample description without the auto-BSF. Residual risk (not measurable without a real camera): an SDP without `sprop-parameter-sets` (in-band SPS/PPS only) would leave empty extradata with auto-BSF disabled — row 31 should keep an explicit `extract_extradata` fallback or an extradata presence check at ingest start (gap §9.3).

## 5. Run 2 — SIGKILL mid-write

Driver: `bash run2_crash.sh`. Port precheck free. Writer killed with `kill -9` when the trigger condition (file size >= last closed fragment end + 1,500 B) fired — by then the next fragment was already fully flushed, see §5.3.

### 5.1 Kill point

```text
killed writer at size=293727, last closed frag end=251168 (mid-fragment kill),
closed_frags_before_kill=6 at 1791361976.483
```

### 5.2 Truncation detection and timing

```text
truncated_no_trailer: wall=1791361976.493 detected_after_kill=0.010s
```

### 5.3 What the crash left behind

File size 293,727 B == exactly the end of fragment 7 (`frag 7 … 251168 42559`, closed `writer_exit`). Two facts explain this (both measured): fragment bytes are flushed box-atomically (moof then mdat), and the driver kills between writes at the polling resolution — so a process-level kill lands the file on a fragment boundary in 2/2 attempts. The corrupt fragment for run 2 is therefore the **8th** (never started: no moof bytes present); the durable set is fragments 1..7. ffprobe on the truncated file:

```text
nb_streams=2
format_name=mov,mp4,m4a,3gp,3g2,mj2
duration=10.621333
size=293727
0,h264,10.621333
1,aac,10.602667
```

### 5.4 Durable prefix re-hash (criterion 4 core)

```text
durable_len=293727 recorded_last_prefix=4b41c9ca38419c2f54763a51dbe8b439f9398c1e55c12920555b5baa40e2ea5f
head -c 293727 out.mp4 | shasum -a 256   -> 4b41c9ca38419c2f54763a51dbe8b439f9398c1e55c12920555b5baa40e2ea5f
shasum -a 256 durable.mp4                -> 4b41c9ca38419c2f54763a51dbe8b439f9398c1e55c12920555b5baa40e2ea5f
PREFIX_EQUAL=yes
```

`verify.sh out.mp4 manifest.tsv` → `VERIFY OK (7 fragments re-hashed, chain rebuilt, ranges contiguous)`; final chain after the 7 durable fragments `c78ee82582d360a3da8cb49e1a2bd36a0eafc38b1e63b65f4e0ca4f6f0c52e8e` equals run 1's chain at fragment 7 (§4.1) — independent confirmation that the durable chain state survived the kill unchanged.

### 5.5 Partial-tail path — synthetic mid-mdat truncation (`run2/synth/`)

Real kills could not land inside an mdat (§5.3 explanation), so the partial-tail detection path was exercised deterministically: `cp run1/out.mp4 mid.mp4; dd` to 256,168 B (cutting through fragment 7's mdat), then `monitor.py trunc.mp4 <dead pid>`:

```json
{"event": "tail_incomplete", "reason": "size_mismatch_declared_gt_present",
 "tail_box_type": "mdat", "declared_len": 41795, "bytes_present": 4236,
 "declared_end": 293727, "tail_start": 251168, "open_frag_seq": 7,
 "head16_hex": "0000a3436d64617400000006419b607a",
 "durable_frags": 6, "durable_len": 251932,
 "last_chain": "846e1bc6cd4effe3eb4fb6adf1b32bdeae46eb5c9151376701afc2eb547d9233"}
{"event": "corrupt_fragment_identified", "seq": 7, "start": 251168}
```

- The mdat header (`0000a343 'mdat'` = declared 41,795 B) versus 4,236 B present is the size-mismatch signature; a truncated header (<8 B) or a size field <8 would instead report `partial_box_header` / `invalid_box_size_below_8` (both implemented in `monitor.py`).
- **Corrupt fragment to drop: seq 7 starting at byte 251,168 — drop range [251168, EOF).** The declared_end 293,727 matches run 1's fragment-7 end exactly, proving the drop recovers the intended durable boundary.
- Durable prefix at 251,168 B: `head -c 251168 trunc.mp4 | shasum -a 256` = `33edc6060282f903f2b2e01c3ce67b36871c053c340b098b0a4a994d135942d9` — identical to run 1's live-recorded fragment-6 prefix (`§4.1` row 6) and to run 2's independent byte position. `verify.sh trunc.mp4 m.tsv` → `TRUNCATED: recorded end=251168 … VERIFY OK (6 fragments …)`.

### 5.6 Iteration note — `run2_boundarykill/`

The first crash attempt killed exactly when the 6th fragment closed (before new bytes appeared): same durable outcome (7 frags, prefix `4b41c9ca…`, detection 15.0 ms: `detected_after_kill=0.015s`), kept at `/Users/gsp-budi/Documents/DEMS/.cache/spikes/s1/run2_boundarykill/` as a second independent SIGKILL sample.

## 6. Run 3 — independent verification run

Driver: `bash run3_verify.sh`. Fresh processes, fresh file, same commands.

### 6.1 Fragment manifest

8 fragments, identical ranges/sizes to run 1 (§4.1); full `manifest.tsv` printed by the driver.

### 6.2 Growth probe (mid-write ffprobe)

```text
probe_at_wall=1791362080.662 file_size=128218 writer_alive=yes
nb_streams=2
format_name=mov,mp4,m4a,3gp,3g2,mj2
duration=4.544000
size=128218
bit_rate=225735
```

### 6.3 Verifier + whole-file equality (criterion 2 re-confirmed)

```text
$ bash verify.sh out.mp4 manifest.tsv
frags=8 recorded_end=327141 file_size=327141
COMPLETE: recorded end equals target length; whole-range shasum=3c80f46ed569b7a2bdf030ecbb23d5e923ffbe2f6464b5484e8fb399efc14c05
final_chain=d1f4f0cf17e6e0ddd621c45856e860dfe19933a9369a201d105ac453a6b54c1b
VERIFY OK (8 fragments re-hashed, chain rebuilt, ranges contiguous)

$ shasum -a 256 out.mp4
3c80f46ed569b7a2bdf030ecbb23d5e923ffbe2f6464b5484e8fb399efc14c05  out.mp4
```

Decode: `ffmpeg -v error -i out.mp4 -f null -` → `decode_exit=0`, `run3/decode_check.txt` empty.

### 6.4 G-3 analysis (run 3, keyframe alignment table)

`run3/g3_alignment.txt`, produced by mapping `ffprobe -show_packets -show_entries packet=pos,size,flags -of json` positions into the manifest byte ranges (the corrected `run3_verify.sh` block; note: `-of csv` emits fields in canonical order — size before pos — which is a trap to record for row 38; JSON output disambiguates):

```text
seq 1 [1259,42741)   len=41482 inter_arrival_s=—      first_pkt=2027  first_is_K=True  K_cnt=1 pkts=37
seq 2 [42741,85933)  len=43192 inter_arrival_s=1.584  first_pkt=43513 first_is_K=False K_cnt=1 pkts=38
seq 3 [85933,128218) len=42285 inter_arrival_s=1.503  first_pkt=86705 first_is_K=False K_cnt=1 pkts=38
seq 4 [128218,173101) len=44883 inter_arrival_s=1.592 first_pkt=128990 first_is_K=False K_cnt=1 pkts=38
seq 5 [173101,207870) len=34769 inter_arrival_s=1.421 first_pkt=173721 first_is_K=False K_cnt=0 pkts=38
seq 6 [207870,251168) len=43298 inter_arrival_s=1.516 first_pkt=208642 first_is_K=False K_cnt=1 pkts=38
seq 7 [251168,293727) len=42559 inter_arrival_s=1.331 first_pkt=251940 first_is_K=False K_cnt=1 pkts=38
seq 8 [293727,326765) len=33038 inter_arrival_s=0.001 first_pkt=294295 first_is_K=False K_cnt=0 pkts=35
keyframe_positions=[2027, 51040, 101973, 152457, 214958, 266042]
```

**G-3 answer: with `-frag_duration 1500000` alone the muxer cuts on the duration boundary regardless of keyframes.** Keyframes stay on the 2.0 s encoder GOP grid (`-g 50 @ 25 fps` → byte offsets 2027, 51040, 101973, 152457, 214958, 266042 ≈ every 50 KB); fragment starts 2..8 land mid-GOP on non-keyframe packets (38 packets ≈ 1.52 s each), and fragments 5 and 8 contain **no keyframe at all**. Per-fragment byte sizes 33–45 KB; inter-arrival 1.33–1.59 s wall.

### 6.5 Variant — `frag_keyframe + min_frag_duration 1000000` (`run3b`)

```text
seq=1 start=1259  len=53372 closedby=next_box:moof   interval —
seq=2 start=54631 len=54787 closedby=next_box:moof   interval 1.934
seq=3 start=109418 len=54413 closedby=next_box:moof  interval 1.835
seq=4 start=163831 len=52439 closedby=next_box:mfra  interval 0.0
```

Alignment check on the variant (`run3b/g3_alignment.txt`): every fragment starts on a keyframe (`first_is_K=True`, `K_cnt=1`) and contains exactly 50 video packets = 2.0 s — cuts align to the keyframe grid (`pkts=50` per fragment in all four).

Cuts align to the 2.0 s keyframe grid (four ~2 s fragments in an 8 s push), fragments ~52–55 KB, each self-delimiting at a keyframe. This is the knob row 31 should pick if every fragment must be independently decodable (per-fragment playback of sealed evidence, per-fragment AEAD under OD-03 option (a), "tampering one fragment fails exactly that fragment" in M7).

### 6.6 Cross-run determinism (bonus M1-gate property)

Runs 1 and 3 (identical synthetic stream and settings) produced byte-identical files: both 327,141 B, both whole-file hash `3c80f46e…c05`; fragment byte ranges equal in all three capture runs (§§5.4, 6.3). Chain values therefore match across runs — the +1 run of row 38 can assert **expected chain equality against row 7's recorded manifest**, not merely self-consistency.

## 7. Git hygiene (criterion 5)

```text
$ cd /Users/gsp-budi/Documents/DEMS && git status --porcelain | grep -Ei '\.(mp4|mov|m4s|ts|mpa|aac|…)$' | wc -l
       0
$ git check-ignore -v .cache/spikes/s1/run1/out.mp4
.gitignore:47:.cache/	.cache/spikes/s1/run1/out.mp4
```

`git status --porcelain` lists only `docs/` task artifacts (pre-existing + this row's two files). Media inventory (all under `.cache/spikes/s1/`): `run1/out.mp4` 327,141 B; `run2/out.mp4` 293,727 B; `run2/durable.mp4` 293,727 B (copy); `run2/synth/trunc.mp4` 256,168 B; `run2_boundarykill/out.mp4` 293,727 B; `run3/out.mp4` 327,141 B; `run3b/out-keyframe.mp4` 216,494 B. Total <2 MB.

## 8. Measurements summary

| Metric | Value | Source |
|---|---|---|
| Fragments per 12 s graceful capture | 8 (`-frag_duration 1.5 s`) | `run1/manifest.tsv` |
| Per-fragment stored bytes | 33,038–44,883 B (mean 40,688 B over the 8 fragments); variant 52,439–54,787 B @ 2.0 s | §4.1, §6.5 |
| Whole closed file | 327,141 B, hash `3c80f46e…c14c05`, 2 streams, ~221–228 kb/s | §4.4, §4.3 |
| Fragment close cadence during growth | 1.33–1.59 s per fragment wall arrival | §6.4 |
| Running hash == whole-file shasum | `3c80f46e…c05` == `3c80f46e…c05` (runs 1, 3) | §4.4, §6.3 |
| Time to detect truncation after `kill -9` | 10.0 ms (run 2), 15.0 ms (run 2_boundarykill); detector poll period 80 ms | §5.2, §5.6 |
| Durable prefix re-hash match after crash | `4b41c9ca…a5f` (head -c == recorded) | §5.4 |
| Partial-tail signature | mdat declared 41,795 B vs 4,236 B present, corrupt seq 7 @ 251,168 | §5.5 |
| ffprobe on truncated file | exit 0, 2 streams, duration 10.62 s | §5.3 |
| Determinism | runs 1 == 3 byte-identical; frags 1..7 equal across runs 1, 2, 3 | §6.6, §5.4 |

## 9. Findings that change the capture-architecture spec (input to row 31)

- **SP-1 (command shape).** The working ingest/push shape is in §3; row 31 must pin all four traps of §2 (explicit `-listen_timeout`, no trailing slash, per-source `duration=`, `-flush_packets 1`) — none is in the FFmpeg documentation prose and each silently breaks a naive reading of F-31.
- **SP-2 (durability semantics).** `-flush_packets 1` makes bytes visible per box write to *other processes on the same OS*, but it is a userspace flush, not `fsync`: nothing in this spike survives an OS/power loss (out of scope for kill -9 tests). The fMP4 writer design needs an explicit per-fragment fsync policy (candidate: `fcntl F_FULLFSYNC`/`F_BARRIERFSYNC` after each fragment hash record), and the hash chain should record byte offsets + declared sizes so crash detection does not depend on the writer.
- **SP-3 (what the "whole-file hash" means for fMP4).** A graceful-close file contains an `mfra` trailer appended after the last fragment (376 B here). The running prefix equals `shasum of the closed file` only when the trailer is included as a final manifest record. Either (a) hash the trailer as an end-of-stream record (this spike's approach), or (b) add `movflags +skip_trailer` (F-19) for pure append-only bytes — row 31 should choose (b) for the camera file, since the sealing step computes its own index anyway.
- **SP-4 (fragment granularity decision).** With plain `frag_duration` fragments cut mid-GOP and are not independently decodable (§6.4). If per-fragment evidence access or per-fragment AEAD (OD-03 (a)) is required, use the `frag_keyframe + min_frag_duration` pattern and accept 2.0 s granularity bound to the encoder GOP, i.e. **GOP length becomes the fragment quantum** — set `-g` so that GOP lands in the 1–2 s band, or drive `min_frag_duration` + GOP jointly. Row 31 must state the exact pairing (frag target, GOP, min_frag_duration) as contract constants.
- **SP-5 (supervisor shape, G-1).** The RTSP listen ingest is single-session: it exits on client TEARDOWN (and on any input EOF). The capture supervisor must treat "one recording session = one ingest process + one output file"; resume-after-worker-crash means restart listener + restart pusher (class-C camera re-ANNOUNCE semantics) — a restart loop around the pusher alone is provably insufficient.
- **SP-6 (copy path BSF risk, G-2).** SDP `sprop` extradata + movenc internal AVCC conversion make the copy path work with auto-BSF disabled; the guard rail row 31 should keep is an **extradata presence check at ingest start** (fail loudly, don't write a header-less file) because a camera SDP without sprop would meet F-24's disabled-BSF condition for the first time.
- **SP-7 (hash-tap architecture).** The chain design (byte-range fragment hashes + digest chain + running prefix, all independently re-derivable with `dd`/`head`/`shasum`/`xxd`) verifies crash-forensics requirements of M7 ("one-fragment tamper expectation", row 32) without any FFmpeg re-mux dependency. The manifest's `start/len` per fragment is sufficient for a byte-level tamper locator; adding per-fragment `moof.sequence_number` (recorded here) gives the container-level sequence number C2PA's `sequenceNumber` concept (F-60) maps onto.
- **SP-8 (cross-run determinism).** Fully synthetic input + fixed encoder settings give byte-identical captures across runs on this host — the M1 gate (+1 run, row 38) can compare against stored hashes instead of only self-consistency. Any real camera feed loses this property (timestamps/noise); row 38 should re-derive chains, not whole-file equality, when inputs are not replayable.

## 10. Gaps left open (input to row 38 and class-C)

| # | Left open | Why not here |
|---|---|---|
| 1 | Multi-hour fragment counts (sequence-number growth, file size behavior ~8 GB/h plan, monitor performance) | guard rail: no 1–2 h loops in this row |
| 2 | OS-level crash durability (fsync/power loss) | kill -9 only proves process death; needs disk-cycle or power test (class-C/pre-handover) |
| 3 | Camera SDP variants: no `sprop`, H.265, different `fmtp`, UDP transport | synthetic push always emits sprop; real-camera ingest is class-C (C-2) |
| 4 | Writer stall / RTSP TCP backpressure jitter under host load | host-load flakes (known B11/P-12) would perturb the 1.33–1.59 s cadence; M3 worker integration re-tests under supervision |
| 5 | `delay_moov` / `skip_trailer` / `separate_moof` flag variants | measured the plain pair only; SP-3 flags the choice for row 31, row 38 may re-verify after the decision |
| 6 | `-fragment_index` resumption across ingest restarts (single continuous file) | F-15's option exists, but G-1 shows the process exits per session; "one file per session" makes this moot unless row 31 chooses append-and-renumber |

## 11. Artifacts

| Path (under `/Users/gsp-budi/Documents/DEMS/.cache/spikes/s1/`) | Role |
|---|---|
| `monitor.py` | live box parser + per-fragment SHA-256 + chain + running prefix + truncation detector |
| `verify.sh` | independent re-derivation (dd/shasum/xxd only) — the required verifier script |
| `run1_graceful.sh`, `run2_crash.sh`, `run3_verify.sh` | the three formal runs |
| `run1/` | out.mp4 327,141 B, manifest.jsonl, manifest.tsv, ingest.log (debug), pusher.log, pusher2.log, growth_probe.txt, g1_result.txt, nal_layout_check.txt |
| `run2/` | out.mp4 293,727 B (killed), durable.mp4, manifest.*, kill_epoch.txt, detect.txt, ffprobe_trunc.txt, tail_hexdump.txt |
| `run2/synth/` | trunc.mp4 256,168 B (mid-mdat), manifest.* with tail_incomplete + corrupt_fragment events |
| `run2_boundarykill/` | second real-SIGKILL sample (15.0 ms detection) |
| `run3/` | out.mp4 327,141 B (== run 1 byte-for-byte), manifests, chain_verify.txt, g3_alignment.txt, vpackets.csv, vpackets_fixed.csv, decode_check.txt |
| `run3b/` | frag_keyframe variant capture, out-keyframe.mp4 216,494 B, manifests, vpackets.csv, g3_alignment.txt |

---
*Generated: 2026-10-07 16:40 · Last Updated: 2026-10-07*
