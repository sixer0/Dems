---
task_id: 2026-10-07_dems_real_capture_sealing
blueprint_row: 9
agent: coder-execution
class: A
milestone: M1
tier: 2
status: done
date: 2026-10-07
artifact: docs/2026-10-07_dems_real_capture_sealing/research/08_spike_s4_av_sync_fixture.md
spike_workspace: /Users/gsp-budi/Documents/DEMS/.cache/spikes/s4/
runs: 3 (2 + 1 verification)
acceptance: 9/9 PASS (3 criteria x 3 runs)
measured_offsets_ms: {aligned: [-1.333, -1.333, -1.333], injected_80: [78.667, 78.667, 78.667], direct_control: [0.0, 80.0]}
tolerance_ms: 40
repository_source_edits_by_this_row: 0
media_files_tracked_by_git: 0
---

# Row 9 progress — Spike S4: AV-sync flash+beep fixture + offset analyser through the S1 pipeline

## Status

**DONE — 9/9 PASS.** Synthetic flash (one white `drawbox` frame @ 50 fps, grid-aligned t=3.000, frame idx 150) + beep (1 kHz `aevalsrc` burst at sample 144000/147840) fixtures with truth-by-construction; an independent offset analyser (signalstats YAVG first-bright + 10 ms astats peak windows first-non-silent, relative offset only); 80 ms injected at content level. Both fixtures were captured through the **exact S1 pipeline** (RTSP listen ingest, `-listen_timeout 60`, no trailing slash, per-source `duration=`, `-flush_packets 1`, `empty_moov+default_base_moof`, `frag_duration 1500000`) in 2 runs + 1 verification run, plus direct-encode controls in run 3. Full method, algorithms, re-run commands, per-run evidence and NM-14 seed spec: `research/08_spike_s4_av_sync_fixture.md`.

## Row-9 acceptance verdicts (Verification column)

| Criterion | run 1 | run 2 | run 3 |
|---|---|---|---|
| aligned offset within ±40 ms | PASS (-1.333) | PASS (-1.333) | PASS (-1.333) |
| self-test flags injected 80 ms (band 40..120, err ≤ 40) | PASS (78.667, err 1.333) | PASS (78.667, err 1.333) | PASS (78.667, err 1.333) |
| S1 pipeline evidence (frags written, file grows mid-write) + 0 media in git | PASS (5 frags, 0→22,483 B) | PASS | PASS (control 0.0/80.0 exact) |

## Verdicts that change downstream rows

| Finding | Row affected | What it changes |
|---|---|---|
| The RTSP-listen copy path adds a ~20–21.3 ms **common-mode** lead-in to both tracks (extra leading video frame, audio +602 windows) but only −1.333 ms **relative** skew, stable across runs | 31, 38, NM-14 | AV-sync checks must assert relative flash-to-beep offset, never absolute stream start times; M3/M4 fixtures inherit this skew as expected background |
| Tolerance is tied to frame grid: 50 fps → 20 ms frames; an 80 ms injection = 4 frames; injections ≤ 40 ms are undetectable by construction at this fps | 31, 36 | Threshold contracts must quote (fps, window, tolerance) together; row 38 should add the −80 ms (audio-early) variant — one parameter |
| Byte-determinism of the pipeline capture holds for the S4 source too (runs 1-3 identical SHA-256) | 38 | Row 38 can anchor on hashes + expected offsets, not just self-consistency |
| One listener per session (G-1 reconfirmed operationally): 2 fixtures required 2 fresh ingest processes | 31 | Capture supervisor: one RTSP session per recording file |

## Guard-rail notes

- All writes under `.cache/spikes/s4/` (git-ignored); 8 media files, 181,097 B; no repository source edits by this row; ports prechecked free every session (8554 used); SMART WMS ports untouched; no sudo/installs; ~12 min total runtime.
- Concurrent tree change observed at close: `M apps/core-web/src/test/live-paired-devices-issue.test.tsx` belongs to row 20 (B10-d) — flagged for the controller, not touched by this row.
- Cosmetic erratum: run-1 `truth_*.json` construction label printed the beep end instead of the flash end (string bug only, measurements unaffected; emitter fixed before run 2). Doc §6.

## Next step

Row 38 (M1 spike gate) re-runs `capture.sh` + `analyse.py` per §3/§7 of the artifact; expected aligned −1.333 ms / injected 78.667 ms.
