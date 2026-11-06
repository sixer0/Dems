---
task_id: 2026-10-07_dems_real_capture_sealing
blueprint_row: 8
agent: coder-execution
class: A
milestone: M1
tier: 2
status: done
date: 2026-10-07
artifact: docs/2026-10-07_dems_real_capture_sealing/research/07_spike_s2_mic_switch_timeline.md
spike_workspace: /Users/gsp-budi/Documents/DEMS/.cache/spikes/s2/
runs: 3 (2 + 1 verification)
acceptance: 12/12 PASS
measured_discontinuity_ms: {file_gap_drop: 0.000, placement_error: [1.17, 0.28, 0.58], trigger_latency: [2.667, 20.667, 21.333]}
aac_frame_ms: 21.333
repository_source_edits: 0
media_files_tracked_by_git: 0
---

# Row 8 progress — Spike S2: one AAC track with a manual near-gapless mic switch

## Status

**DONE — 12/12 PASS.** Two CLI runs (`asendcmd`+`astreamselect`, pre-commanded switches 4.200 s 440->880 and 3.350 s 880->440, `-re` paced, 8 s each) plus one verification run (true operator trigger: `avfilter_graph_send_command` mid-recording through a 194-line libavfilter harness, `switch` injected at wall +5303 ms, realised boundary exactly +1 frame). Every acceptance number, the mechanism matrix (7 channels probed, 2 negative results kept as findings) and the interval-log <-> analyser cross-check are in `research/07_spike_s2_mic_switch_timeline.md`.

## Row-8 acceptance verdicts (verification column)

| Criterion | run1 | run2 | run3 |
|---|---|---|---|
| exactly 1 audio stream | PASS | PASS | PASS |
| PTS strictly monotonic (0 neg jumps, 0 repeats / 376 packets) | PASS | PASS | PASS |
| discontinuity <= 1 AAC frame | PASS (gap 0.001 ms) | PASS (0.001 ms) | PASS (0.001 ms) |
| interval log from_ms/to_ms both inputs, matches analyser | PASS (err 1.17 ms) | PASS (0.28 ms) | PASS (0.58 ms) |

## Verdicts that change downstream rows

| Finding | Row affected | What it changes |
|---|---|---|
| The bare `ffmpeg` CLI has NO operator-triggerable switch channel on this host (asendcmd file parsed at init only — proven by `live_test.m4a` with 0 transitions; `zmq`/`azmq` absent from buildconf) | 31 | Mic-switch architecture must be an embedded libavfilter worker (or a non-CLI driver), not CLI + `asendcmd` |
| `astreamselect` + runtime `map` command works gap-free: 0 ms sample gap/drop, boundary error <= 1.2 ms vs capture record, trigger latency <= 1 frame (21.333 ms) | 31, 32 | Sets the measurable R-3 bound and the manifest interval shape (`from_ms`/`to_ms` in media-pts domain, capture-side raw per-frame manifest proven by run3) |
| Human-operated switching during recording IS achievable on this FFmpeg 9.0.2 via `avfilter_graph_send_command` — GStreamer is no longer *required* for this requirement | 14, 15 | Row 14 becomes a comparison prototype (must report the same 4-criterion table + GAP-event behaviour); row 15 scores FFmpeg-CLI-operator = FAIL, FFmpeg-API = PASS, with citations to this file |
| Paced-encode domain rule: with `-ignore_editlist 1`, file content sits 1 AAC frame after raw graph pts (anchored by run3's dual record); unpaced burst showed 0 offset | 38 | Verifier must re-anchor the domain rule via an API run, not CLI arithmetic (L-2 in the artifact) |
| Brief's "row 3 G-39..G-41" read as facts F-39..F-41 (row 3 gap table is G-1..G-11) | — | Noted in the artifact's decision log |

## Red-line compliance

Synthetic lavfi sines only; all media and tools under `.cache/spikes/s2/` (git-ignored; `git status --porcelain` shows 0 media files and 0 source edits); no ports bound or touched; no emulators; no sudo; no installs; repository untouched apart from the two documents this contract allows.

## Files written by this row

2: `research/07_spike_s2_mic_switch_timeline.md` and this progress note.

## Next steps

Row 9 (S4) consumes row 7's pipeline; row 15 (engine pick) and row 31 (capture architecture spec) consume this artifact; row 38 re-verifies with L-1/L-2 handling.
