---
task_id: 2026-10-07_dems_real_capture_sealing
row: 15
agent: data-analyst
milestone: M1
class: A/B
tier: 1
status: complete
last_updated: 2026-10-07 17:45
---

# Row 15 — media-engine pick memo (progress)

## Status

complete. Deliverable `research/12_spike_s3_media_engine_pick.md` written.

This is the RF-1 desk memo (`identification/02_structured.md:118`): the GStreamer install was deferred
(D12 item (d), `decisions/decisions.md:21`), so row 14 did not run and GStreamer is scored "not evaluated on
host" from documented facts, not a benchmark.

## Inputs read

| # | Input | Used for |
|---|---|---|
| 1 | `decisions/decisions.md` D10c (line 18), D12 (line 21) | the decisive libavfilter finding; the install deferral and its consequences |
| 2 | `identification/02_structured.md` row 15 (line 195), row 31 (line 211), row 38 (line 218), RF-1 (line 118), OD-03/OD-21 | acceptance criteria, spec consequences, gate dependencies |
| 3 | `research/06_spike_s1_fmp4_running_hash.md` (S1) | fragment control, hash tap, crash behaviour, supervisor rule, fsync/trailer/granularity findings SP-1..SP-8 |
| 4 | `research/07_spike_s2_mic_switch_timeline.md` (S2) | gapless switch via libavfilter API; CLI operator channel absence; trigger matrix |
| 5 | `research/08_spike_s4_av_sync_fixture.md` (S4) | AV-sync criterion and common-mode skew |
| 6 | `research/02_collection.md` | F-47/F-52/F-53 (no muxer AEAD), F-58..F-60 (C2PA), F-63..F-74 (GStreamer), F-90..F-94 (licence) |
| 7 | `initialization/01_env_check.md` §3 | FFmpeg 9.0.2 real muxer option text |
| 8 | `initialization/03_gstreamer_install.md` | row-13 deferral evidence: dry-run footprint, licence note, `isobmff=auto` caveat, x86 portability |

## Output

| File | Content |
|---|---|
| `research/12_spike_s3_media_engine_pick.md` | Decision statement; 12-criterion scoring matrix for both engines; recommendation with conditions; R1..R9 residual risk; 9 consequences for row 31; explicit self-gate |

## Counts verified

| Item | Expected | Found |
|---|---|---|
| Named criteria | >= 7 (row 15) | 12 |
| FFmpeg criteria with an explicit cell value | >= 7 | 11 (+1 N/A to pick) |
| GStreamer criteria with an explicit cell value | >= 7 | 11 (+1 N/A to pick) |
| GStreamer cells `Not evaluated on host` | evidence-dependent | 8 |
| GStreamer cells with external evidence | evidence-dependent | 3 (licence, footprint, x86 portability) + 4 also cited inside `Not evaluated` cells |
| GStreamer benchmark numbers invented | 0 | 0 |
| Residual risks named with a milestone | required | 9 (R1..R9) |
| Row-31 consequences listed | required | 9 |

## Notes / issues

- No `masterplan/02_plan.md` contribution: row 15 is a decision memo, not an implementation plan; row 37 owns
  the plan and row 40 produces M2-M9 implementation rows. Recorded in the memo header.
- GStreamer is marked `Not evaluated on host` in 8 of 12 cells; the 3 `Weak (external evidence)` cells cite only
  F-64..F-74, D12 and the row-13 record, never a measured figure.
- The memo explicitly keeps the GStreamer comparison open as a D12 re-evaluation path (rows 13 -> 14 ->
  refresh this memo before row 38) rather than closing it.
- No file outside the task folder was edited; spikes were not run and nothing was installed.

---
*Generated: 2026-10-07 17:45*
