# Delegation progress — AU-2 (spikes + STT independent audit)

| Field | Value |
|---|---|
| Agent | verifier (Claude Code controller audit, D16 item 2) |
| Date | 2026-10-08 |
| Status | needs-review (audit complete; 2 High findings need a blueprint revision before the second approval gate) |
| Main artifact | `verification/21_audit_spikes_stt.md` |
| Media | `/Users/gsp-budi/Documents/DEMS/.cache/spikes/au2/` (git-ignored, 1.5 MB after cleanup) |

## Files created

- `docs/2026-10-07_dems_real_capture_sealing/verification/21_audit_spikes_stt.md`
- `docs/2026-10-07_dems_real_capture_sealing/delegation_progress/au2_spikes_stt.md`
- `.cache/spikes/au2/**` (scripts, JSON results, small evidence media; git-ignored)

## Files NOT touched

`status_tasks.md`, `delegation_progress_report.md`, `masterplan/02_plan.md` (shared; parallel run), every tracked source file, and Kilo's producer media under `.cache/spikes/{s1,s2,s4,stt-check,*_gate}`.

## Verdicts

- S1: CONFIRMED (own tail-hash tap; `3c80f46e…c14c05` reproduced byte-exact with Kilo's commands)
- S2: mechanism CONFIRMED live (own push-mode harness, external SIGUSR1 trigger, 0 dropped/inserted samples); the "0.001 ms" metric is INVALID (blind to a 20.8 ms sample drop)
- S4: pass/fail CONFIRMED; "-1.333 ms pipeline skew" is an analyser artefact (true 0.00 ms; Kilo's files measure +0.021 / 80.021 ms sample-exact)
- STT functional: CONFIRMED (own fixture 6/6; Kilo's fixture byte-identical JSON); runs on `Device(gpu, 0)`
- STT conformity: PARTIALLY CONFORMANT (CPU path paper-only; rev 2 drops its install; whisper.cpp Homebrew install upgrades openssl@3 → ffmpeg/omlx dependents)
- GStreamer D12: CONFIRMED (1 + 62 + 11)

## Findings

AU2-01 High, AU2-02 High, AU2-03 Medium, AU2-04 Medium, AU2-05 Medium, AU2-06 Medium, AU2-08 Medium, AU2-07 Low, AU2-09 Low, AU2-10 Low, AU2-11 Low — details and proposed revisions in the main artifact §6.

## State changes on the host (all reverted / logged)

- oMLX: DOWN → UP 05:26:48 (PID 25196) → DOWN 05:27:21 via the user's `start.sh`/`stop.sh`; 2 serialised requests; key never printed; previous log backed up to `.cache/spikes/au2/stt/prev_omlx-serve.log.bak` (start.sh truncates it).
- Port 8554: two loopback RTSP sessions, free before and after.
- Homebrew: dry-runs only (`gstreamer`, `whisper-cpp`), auto-update disabled; installed formulae 66 before = 66 after.
