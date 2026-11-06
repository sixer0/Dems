---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
blueprint_row: 38
date: 2026-10-07
agent: verifier
milestone: M1
tier: 2
source_plan: docs/2026-10-07_dems_real_capture_sealing/masterplan/02_plan.md (NOT PRESENT — row 37 has not run; row 38 tracked here and in decisions.md instead)
status: passed
verdict: M1 GATE PASS — 25/25 criteria PASS; 0 failures routed
gate_rule: any FAIL fails the gate
media_root: .cache/spikes/s1_gate/ .cache/spikes/s2_gate/ .cache/spikes/s4_gate/ .cache/spikes/stt_gate/
inputs_read:
  - identification/02_structured.md rows 7, 8, 9, 12, 15, 38 (Verification columns)
  - research/06_spike_s1_fmp4_running_hash.md (row 7 producer)
  - research/07_spike_s2_mic_switch_timeline.md (row 8 producer)
  - research/08_spike_s4_av_sync_fixture.md (row 9 producer)
  - research/10_spike_stt_functional_check.md (row 12 producer)
  - research/12_spike_s3_media_engine_pick.md (row 15 producer)
  - decisions/decisions.md D4/D7/D8/D10/D12
  - research/02_collection.md, initialization/01_env_check.md, initialization/03_gstreamer_install.md (row-15 cited artifacts)
---

# M1 spike gate — independent +1 verification (row 38)

> **ERRATUM (RV-SPEC, 2026-10-08; audits AU-2 `verification/21_audit_spikes_stt.md` and AU-3
> `verification/22_audit_docs_decisions.md`; decisions D17/D18). The gate verdicts and outputs below
> are the historical record and are not rewritten; three rows are re-read as follows.**
>
> | Row (`:n` = line number before this note was inserted) | As recorded | Correct reading |
> |---|---|---|
> | S2-3 (`:64`) | file gap/drop **0.001 ms** (packet-grid metric) | the metric cannot detect a gap (0.0000 ms on a copy with 20.8 ms removed, AU2-05); the property (0 inserted/dropped samples) is re-proven by AU-2 at sample level. The "≤ 1 AAC frame" bound is pull-loop specific (AU2-07) |
> | S4-1 (`:71`), S4-2 (`:72`) | **−1.333 ms** aligned; **78.667 ms** injected | true relative offset **0.00 ms** (+0.021 ms = one sample) and **80.021 ms** sample-exact; the recorded values are 10 ms analysis-window artefacts (AU2-03). PASS/FAIL unchanged |
> | STT-5 (`:83`, note `:116`) | PASS on "CPU/GPU clause handled (D7 adaptation documented)" | **CPU clause NOT met** — the run used the oMLX/MLX server on the Apple GPU (`Device(gpu, 0)`, AU-2 §4.3). Re-read as **"CPU clause deferred to the `cpu-local` functional-check row (rev 2.1) and `M6-TF-1` on `cpu-local`"**, not PASS (AU2-01/AU3-01/AU3-03) |


Independent re-derivation in the verifier's OWN directories (`.cache/spikes/*_gate/`).
Original producer evidence under `.cache/spikes/s1|s2|s4|stt-check/` was read-only and is
untouched (mtimes unchanged). No benchmark numbers recorded (D230): the two wall-clock
durations below are labelled latency observations only, never divided by audio length.

## Overall M1 gate verdict

**PASS — 25/25 criteria PASS, 0 FAIL.** Rule: any FAIL fails the gate. No failure was routed.

Breakdown: S1 (row 7) 5/5 · S2 (row 8) 4/4 · S4 (row 9) 3/3 · STT (row 12) 7/7 ·
row-15 citation checks 5/5 · repo hygiene 1/1.

Bonus conformance: the producing rows' recorded expected hashes were reproduced **byte-for-byte**
(S1 whole-file `3c80f46e…c14c05` and every fragment byte range; S4 `58425017…8ea98eb` /
`78e88811…ac82b522`), converting the +1 run from self-consistency into expected-value equality.

## Verdict table

One row per criterion. Commands were run from the gate directory
`/Users/gsp-budi/Documents/DEMS/.cache/spikes/<id>_gate/`.

### S1 — row 7 (`research/06_spike_s1_fmp4_running_hash.md`)

| # | Criterion | Verdict | Command | Output (trimmed) | Measured |
|---|---|---|---|---|---|
| S1-1 | ffprobe reads the file while it is still growing | PASS | `gate_s1.sh` growth probe: `ffprobe … out.mp4` at sleep 6 while writer alive | `probe_at_wall=… file_size=173101 writer_alive=yes` / `nb_streams=2` / `duration=6.061333` / `size=173101` | size 173,101 B at frag-4 end; ffprobe exit 0 mid-write |
| S1-2 | Running hash == `shasum -a 256` of the closed file (both shown) | PASS | `shasum -a 256 out.mp4`; `grep … manifest.tsv \| tail -1 \| cut -f8` | `3c80f46ed569b7a2bdf030ecbb23d5e923ffbe2f6464b5484e8fb399efc14c05  out.mp4` and last recorded prefix `3c80f46e…c14c05` | equal; equals row-7 expected `3c80f46e…c05` |
| S1-3 | Fragment sequence contiguous (`mfhd` seq + byte ranges, no gap) | PASS | `bash verify.sh out.mp4 manifest.tsv` + independent `dd if=out.mp4 bs=1 skip=1259 count=41482 \| shasum -a 256` | `frags=8 recorded_end=327141 file_size=327141` / `VERIFY OK (8 fragments re-hashed, chain rebuilt, ranges contiguous)`; frag1 dd = `d0c641bb…4956c` | 8 fragments; ranges 1259/41482, 173101/34769 exactly match row 7 |
| S1-4 | After `kill -9`: truncated tail detected; durable prefix re-hashes correctly | PASS | `gate_s1.sh` crash: kill writer mid-write; `head -c $DUR out.mp4 \| shasum -a 256`; `verify.sh` | `truncated_no_trailer: … detected_after_kill=0.018s`; `recorded_last_prefix=4b41c9ca…0e2ea5f`; `recomputed_durable_prefix=4b41c9ca…0e2ea5f`; `PREFIX_EQUAL=yes`; `VERIFY OK (7 fragments …)` | detection 0.018 s; durable prefix hash equal (self + row-7 value) |
| S1-5 | `git status --porcelain` lists 0 media files | PASS | `git status --porcelain \| grep -Ei '\.(mp4\|mov\|m4s\|m4a\|…)$' \| wc -l` | `0` | 0 media entries; `.gitignore:47:.cache/` covers all gate media |

### S2 — row 8 (`research/07_spike_s2_mic_switch_timeline.md`)

| # | Criterion | Verdict | Command | Output (trimmed) | Measured |
|---|---|---|---|---|---|
| S2-1 | ffprobe shows exactly 1 audio stream | PASS | `node run_cli.mjs run1 "440->880" 4.200`; `ffprobe -select_streams a …` | `0,aac,audio,48000,1`; `audio_stream_count=1` | 1 stream |
| S2-2 | Audio PTS strictly monotonic across the switch | PASS | `node pts_check.mjs run1.m4a` | `"ptsStrictlyMonotonic": true, "negativeJumps": 0, "repeatedPts": 0, "packets": 376` | 0 negative jumps / 0 repeats over 376 packets |
| S2-3 | Discontinuity at switch <= 1 AAC frame (21.3 ms) | PASS | `node verify_run.mjs run1.m4a run1_interval_log.json` | `packet_gap_or_drop_at_switch_ms: 0.001`, `min 21.333 / max 21.334`, `aac_frame_ms: 21.333` | file gap/drop **0.001 ms** (floor 21.333); trigger latency 20.17 ms reported separately |
| S2-4 | Interval log from/to ms for both inputs matches frequency-based recovery | PASS | `verify_run.mjs` (analyser) **+ independent cross-checks**: pure-Python Goertzel on decoded PCM; `astats` zero-crossing rate on each half | logged `MIC1_440: 0→4202.667`, `MIC2_880: 4202.667→8000`; analyser graph estimate 4201.5 ms (`match_error_ms: -1.17`); Goertzel t=2/3 s dominant **440 Hz**, t=5/6 s dominant **880 Hz**, independent crossover 4250 ms; astats half A `Zero crossings rate 0.018343` → **440.2 Hz** RMS −21.08 dB, half B `0.036659` → **879.8 Hz** RMS −31.54 dB | match error −1.17 ms; two independent methods confirm 440→880 and a 10.46 dB level step |

### S4 — row 9 (`research/08_spike_s4_av_sync_fixture.md`)

| # | Criterion | Verdict | Command | Output (trimmed) | Measured |
|---|---|---|---|---|---|
| S4-1 | Aligned fixture: measured AV offset within ±40 ms | PASS | `bash capture.sh gate_run` then `analyse.py out_aligned.mp4 truth_aligned.json` | `"offset_ms": -1.333`, `"verdict": "PASS"`, `flash_frame_index 150`, `bright_frame_count 1` | **−1.333 ms** (identical to row 9's 3 runs) |
| S4-2 | Analyser self-test flags an injected 80 ms offset | PASS | `analyse.py out_shifted.mp4 truth_shifted.json` (truth 80 ms) | `"offset_ms": 78.667`, `FLAGGED (\|78.667\| > 40.0) AND \|78.667 - 80.0\| = 1.333 <= 40.0` | **78.667 ms** flagged; direct control `80.0 ms` + `0.0 ms` exact |
| S4-3 | Fixture runs through the S1 pipeline (grows, fragments written, 0 media) | PASS | `capture.sh` (RTSP listen ingest + pusher, S1 flags/traps); manifest + sizes + `git status` | `ingest_exit=0 pusher_exit=0`, `frags_recorded=5`, `sha256_aligned=58425017…8ea98eb`, `sha256_shifted=78e88811…ac82b522` | 5 fragments each; file grew 0→22,483 B; hashes equal row 9 anchors |

### STT — row 12 (`research/10_spike_stt_functional_check.md`)

| # | Criterion | Verdict | Command | Output (trimmed) | Measured |
|---|---|---|---|---|---|
| STT-1 | Existing fixture is the sealed one (sha256 matches row 12) | PASS | `shasum -a 256 fixture-two-speaker-id.wav`; `stat -f %z` | `6743181a7d976ca24c03ad8e427d6d7093fbb0b9f72257e6e2f91dcfc0f4fe71` / `size=3154638` | exact match to row 12; not regenerated |
| STT-2 | (+) Non-empty JSON transcript with segments/timestamps, 2 runs | PASS | `curl -X POST /v1/audio/transcriptions` (whisper-large-v3-turbo, id) ×2; `cmp <(jq -S …)` | `json_bytes=6801`, `{"language":"id","segments":17,"text_len":897,"first_seg":{"start":0.0,"end":4.26}}`; `RUN1_RUN2_JSON_EQUAL=yes`; `segments[0] keys = [avg_logprob,compression_ratio,end,id,no_speech_prob,seek,start,temperature,text,tokens]` | 17 segments with start/end; two runs byte-identical |
| STT-3 | Language `id` | PASS | `jq -c '.language' whisper-gate-run1.json` | `"id"` | `id` |
| STT-4 | >= 1 segment per scripted sentence (compare to fixture script) | PASS | Python key-token coverage of transcript vs `fixture-script.txt` (13 sentences) | `13/13 sentences coverage >= 0.60` (A1-B4,A6 1.00; A5 0.73 — known row-12 drift; A7 0.82 split) | 17 segments >= 13 sentences; every sentence maps to ≥1 segment |
| STT-5 | CPU/GPU clause handled (D7 adaptation documented) | PASS | read row 12 §1 + `~/Documents/omlx-script` logs | Row 12 §1 states the oMLX/MLX engine uses Metal by design per D7, with the `omlx serve --help` no-CPU-flag quote; portable CPU runtime deferred (Q-INSTALL item 1) | adaptation documented, criterion scoped |
| STT-6 | No throughput figure | PASS | `grep -nE "(RTF\|WER\|ms per token\|real-time factor\|words per minute\|throughput)[^a-zA-Z]*[0-9]"` on row 12 | `0 matches (no throughput figure)` | only labelled latency: `/usr/bin/time` real **6.38 s** (warm/repeat class; not divided by audio length) |
| STT-7 | Server stopped again (hand-over DOWN) | PASS | `./status.sh`; `lsof -iTCP:8000 -sTCP:LISTEN`; `pgrep -fl "omlx serve"` | `STATUS : DOWN`; `port 8000: no listener`; `pgrep omlx: empty` | UP→work→DOWN; PID 59192 started, stopped cleanly |

### Row 15 citation checks (`research/12_spike_s3_media_engine_pick.md`)

| # | Criterion | Verdict | Command / method | Output (trimmed) | Measured |
|---|---|---|---|---|---|
| R15-1 | Matrix scores both engines on >= 7 named criteria | PASS | read §2 matrix; `grep` criterion count | 12 named criteria (fragment control, gapless switch, hash tap, crash, licence, footprint, x86 portability, AV sync, ingest lifecycle, growth, maintenance, AEAD seam) | 12 >= 7 |
| R15-2 | Every score cites a row artifact / fact ID (>= 8 cells spot-checked across both engines) | PASS | resolved each cited `file:line`/F-id to its artifact content | 24/24 cells checked: FFmpeg cells resolved to S1/S2/S4 lines + F-01/F-47/F-52/F-53/F-60/F-90/F-91/F-73/F-74 + `01_env_check.md`/`03_gstreamer_install.md`; all present | citations hold |
| R15-3 | >= 3 GStreamer "Not evaluated on host" cells marked as such (not scored) | PASS | count marks in §2 | 8 GStreamer cells `Not evaluated on host` (criteria 1,2,3,4,8,9,10,11); 3 cells `Weak (external evidence)` (5,6,7); criterion 12 N/A | 8 marked, none scored |
| R15-4 | No invented GStreamer benchmark numbers | PASS | `grep -nE "GStreamer.*(ms\|fps\|kb/s\|hash [0-9a-f]\|…)"`; read §2/§4 | `no GStreamer numeric timing/hash figures found`; §4 numbers (62 deps / 11 upgrades / 1 formula) are row-13 dry-run facts, not engine benchmarks | no invented figures |
| R15-5 | Residual risk stated | PASS | read §4 | R1..R9 each with a carrying milestone (e.g. R4 "GStreamer never benchmarked on this host") | 9 risks |

### Repository hygiene (row 38 own criterion)

| # | Criterion | Verdict | Command | Output (trimmed) | Measured |
|---|---|---|---|---|---|
| HYG-1 | 0 media files in `git status --porcelain`; media only under git-ignored `.cache/`; no source file changed by the gate runs | PASS | `git status --porcelain`; media-extension grep `\| wc -l`; `diff` pre/post snapshot; `git check-ignore -v` | media count `0`; pre/post `git status` diff adds only `?? …/gateway_check/` (row 25's file, sibling); `.gitignore:47:.cache/` ignores `.cache/spikes/s1_gate/graceful/out.mp4` | 0 media in status; gate runs changed no source file |

## Independent-re-derivation notes (gate discipline)

- **Tools reused, with stated independence.** S1 `monitor.py`/`verify.sh`, S2 `analyser.mjs`/`pts_check.mjs`,
  S4 `capture.sh`/`analyse.py` are the producers' tooling, copied unchanged into the gate dirs; where
  reused, an independent cross-check was added: shell `dd`/`head`/`shasum` for S1 fragments, pure-Python
  Goertzel + `astats` for S2, direct-encode controls + raw `sha256` for S4.
- **Expected-value equality, not just self-consistency.** S1 and S4 hashes matched the producer's
  recorded anchors exactly; S1 fragment byte ranges matched row 7's manifest.
- **Truncation path.** The real `kill -9` landed on a fragment boundary (durable set 1..7), so the monitor
  emitted `truncated_no_trailer` (0.018 s) and the durable-prefix hash equalled both its own independent
  re-hash and row 7's recorded value. This reproduces row 7's run-2 behaviour (its partial-tail synthetic
  path was not re-created, as the boundary landing is the deterministic outcome on this host).
- **D7 adaptation** for the STT criterion is the producing row's documented re-scope; the M1 gate checks
  the adaptation exists and is applied, not that a CPU flag was used.

## Failures routed

**None.** 0 of 25 criteria failed; no re-delegation is triggered.

One non-blocking documentation nit (not a criterion, not routed as a failure):

| Severity | File | Issue | Suggested fix |
|---|---|---|---|
| 🟢 Low | `research/12_spike_s3_media_engine_pick.md:88` (§2.1) | The GStreamer breakdown lists "Not evaluated on host (8 …): 1, 2, 4, 8, 9, 10, 11" — the count 8 is correct but the list omits criterion **3**. The §2 matrix itself marks cell 3 correctly. | Add "3" to the §2.1 list. Cosmetic; no effect on the pick or any gate criterion. |

## Evidence index (paths + sizes)

All gate artifacts are git-ignored scratch (`.gitignore:47` `.cache/`).

| Path (under `/Users/gsp-budi/Documents/DEMS/`) | Size | Contents |
|---|---|---|
| `.cache/spikes/s1_gate/` (dir) | 1.1 MB | `gate_s1.sh`, `gate_s1.out`, `monitor.py`, `verify.sh` |
| `.cache/spikes/s1_gate/graceful/out.mp4` | 327,141 B | closed 12 s capture (hash `3c80f46e…c14c05`) |
| `.cache/spikes/s1_gate/crash/out.mp4` | 293,727 B | killed capture, durable 7 fragments |
| `.cache/spikes/s2_gate/` (dir) | 1.1 MB | `gate_s2.sh`, `gate_s2.out`, `run1.m4a` 129,046 B, `run1_pts.json`, `run1_verify.json` |
| `.cache/spikes/s4_gate/` (dir) | 244 KB | `gate_s4.out`, `capture.sh`, `analyse.py`, `monitor.py`, `gate_run/` |
| `.cache/spikes/s4_gate/gate_run/out_aligned.mp4` | 22,483 B | aligned fixture (`58425017…8ea98eb`) |
| `.cache/spikes/s4_gate/gate_run/out_shifted.mp4` | 22,137 B | injected fixture (`78e88811…ac82b522`) |
| `.cache/spikes/stt_gate/` (dir) | 32 KB | `gate_stt.sh`, `gate_stt.out`, `whisper-gate-run1.json` 6,801 B, `whisper-gate-run2.json`, `whisper-stt-sh.stdout.txt` |

**Original producer evidence untouched** — mtimes unchanged after the gate runs
(`.cache/spikes/s1/run1/out.mp4` 15:30:14, `s2/run1.m4a` 15:41:16, `s4/run3/out_aligned.mp4` 15:58:39,
`stt-check/fixture-two-speaker-id.wav` 16:30:27; gate runs 17:24–17:29). No file under the producer
directories was written.

## Hygiene section

```
$ git status --porcelain | grep -Ei '\.(mp4|mov|m4s|m4a|mp3|wav|aac|ts|mkv|webm|avi|flac|ogg|opus)$' | wc -l
       0
$ git check-ignore -v .cache/spikes/s1_gate/graceful/out.mp4
.gitignore:47:.cache/   .cache/spikes/s1_gate/graceful/out.mp4
$ diff <pre-run snapshot> <post-run `git status --porcelain`>
15a16
> ?? docs/2026-10-07_dems_real_capture_sealing/gateway_check/
```
The only working-tree delta during the gate window is `gateway_check/`, created by sibling row 25
(`gateway_check/02_b10_test_hygiene_review.md`, mtime 17:24) — **not** this row. All 11 modified
`apps/**/*.test.tsx` files and the 3 modified `docs/**` controller files are pre-existing (rows 16-21 /
controller); attributed, not touched. The gate runs changed **no source file**.

Observation on the "0 media files tracked by git" phrasing: `git status --porcelain` contains 0 media
entries (the criterion). `git ls-files` does report **265 pre-existing tracked media** (180 `.mp4`, 85 `.m4a`)
owned by the repo baseline — `packages/shared` 113, `docs/2026-10-04_dems_backend_rbac_pairing` 96 (task-2
evidence), `apps/mobile` 56. They are unrelated to this task's spikes, none is modified
(`git status` media count 0), and no spike media is tracked.

```
$ lsof -nP -iTCP:8554-8564 -sTCP:LISTEN
8554-8564 free
$ pgrep -fl ffmpeg
no ffmpeg
$ pgrep -fl "omlx serve"
no omlx
$ lsof -nP -iTCP:8000 -sTCP:LISTEN
port 8000 down
```

- Ports 8554-8564: free at gate end (checks ran at the start of each phase; only 8554 was used, one process at a time).
- Stray processes: none (no `ffmpeg`, no `omlx serve`).
- STT server final state: **DOWN** (hand-over state restored; PID 59192 stopped via `stop.sh`, pidfile removed, port 8000 no listener).
- SMART WMS ports 5173/5174/5175 were never contacted.

## Issues / Decisions

| # | Item | Resolution |
|---|---|---|
| 1 | `masterplan/02_plan.md` does not exist (row 37 not yet run) | Row-38 tracking/status could not be written there; recorded in this report and `delegation_progress/verifier__row38.md`. No tracker edited (controller-only). |
| 2 | `git ls-files` reports 265 tracked media | Pre-existing repo/task-2 assets, unmodified; the row-38 criterion (0 media in `git status --porcelain`) passes. Documented, not remediated (out of scope). |
| 3 | S1 `kill -9` landed on a fragment boundary again | Deterministic on this host (row 7 observed 2/2); durable-prefix equality is the criterion and it passed. The synthetic mid-`mdat` partial-tail path was not re-created. |
| 4 | `gateway_check/` appeared in `git status` mid-gate | Produced by sibling row 25, not row 38; attributed. |

## Next steps (row 38 is terminal for the gate)

- Row 38 verdict PASS; feed into row 39 (M0 spec gate) and the controller's milestone summary.
- Rows 13/14 (GStreamer) remain deferred per D12; no refresh of the row-15 memo is required while they stay deferred.
- Row 31 may fold the four S1 pinned traps, the S1 SP-2/SP-3/SP-4/SP-5/SP-6 decisions and the S2 embedded-libavfilter mechanism (schema/interface inputs already cited in row 15 §5).

---
*Generated: 2026-10-07 17:35 · Last Updated: 2026-10-07 17:35*
