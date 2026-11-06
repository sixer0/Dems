#!/usr/bin/env python3
"""The start-up and length NUMBERS of one camera run, from the worker's own log (integration pass C2;
decisions D118, D119; check M4-LOCAL-CAM-1).

Read here: `worker.jsonl` only - timestamps and counters the worker wrote. No media file is opened,
by this module or by anything it calls.

  python3 camera_run_numbers.py analyse <worker.jsonl> [--gap-ms <gap_after_first_frame_ms>] [--helper-spawn-us <n>] [--helper-gone-us <n>] [--seconds <n>]

WHAT THE NUMBERS ARE (all on the host's wall clock, microseconds, as the worker logs them):
  t0                      `audio_started.t0_real_us`: file time 0 of the session (the audio's first sample).
  first_frame_stamp       t0 + `video_anchored.shift_us`: the wall clock the helper stamped on the first frame
                          the worker could place (the helper stamps a frame when it reads it from the device).
  first_recorded_frame    t0 + `video_started.first_pts` / time base: the first frame that is IN the file. The
                          worker starts a file on a keyframe, so the frames before it are counted, not written
                          (`dropped_no_pts` + `dropped_prestart` of `camera_summary`).
  ingest_ended            `INGEST_ENDED.ts_us`: the helper's stream ended (its TEARDOWN or its death).

`gap_after_first_frame_ms` of the attended script is NOT a pause of the device. Under the pinned mux
flags the first video sample is held from the START of the file (capture spec C.4; `ingest.c`, the
comment at `video_started`), and the file starts at the audio's priming packet (-1024 samples). So
    gap = (first_recorded_frame - t0) + priming + (interval between the first two frames).
`decompose_gap` returns the last term as the residual: a value near one frame period means the whole
gap is "audio ran this long before the camera's first recorded frame".
"""
import json
import sys

PRIMING_SAMPLES, AUDIO_RATE = 1024, 48000
PRIMING_MS = PRIMING_SAMPLES * 1000.0 / AUDIO_RATE


def read_log(path):
    out = []
    with open(path, errors="replace") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                out.append(json.loads(line))
            except ValueError:
                pass
    return out


def first(log, message):
    for entry in log:
        if entry.get("message") == message:
            return entry
    return None


def r1(value):
    return None if value is None else round(value, 1)


def startup_numbers(log, helper_spawn_us=None, helper_gone_us=None):
    """Numbers only. Every member is None when the line it comes from is not in the log."""
    audio, anchored, started = first(log, "audio_started"), first(log, "video_anchored"), first(log, "video_started")
    connected, ended, summary = first(log, "ingest_connected"), first(log, "INGEST_ENDED"), first(log, "camera_summary")
    t0 = audio.get("t0_real_us") if audio else None
    stamp = t0 + anchored["shift_us"] if t0 is not None and anchored else None
    recorded = t0 + started["first_pts"] * 1_000_000 // started["time_base_den"] if t0 is not None and started else None
    ended_us = ended.get("ts_us") if ended else None
    gone = helper_gone_us if helper_gone_us is not None else ended_us
    ms = lambda a, b: None if a is None or b is None else (a - b) / 1000.0
    dropped = None if summary is None else {k: summary.get(k) for k in ("dropped_no_pts", "dropped_prearm", "dropped_prestart", "dropped_unanchored")}
    return {
        "t0_real_us": t0,
        "first_frame_stamp_us": stamp,
        "first_recorded_frame_us": recorded,
        "ingest_connected_us": connected.get("ts_us") if connected else None,
        "ingest_ended_us": ended_us,
        "helper_spawn_us": helper_spawn_us,
        "helper_gone_us": helper_gone_us,
        # The four intervals the next attended run decides the start-up question with.
        "helper_spawn_to_first_frame_stamp_ms": r1(ms(stamp, helper_spawn_us)),
        "first_frame_stamp_to_first_recorded_frame_ms": r1(ms(recorded, stamp)),
        "audio_before_first_recorded_frame_ms": r1(ms(recorded, t0)),
        "audio_before_first_frame_stamp_ms": r1(ms(stamp, t0)),
        "frames_before_the_first_recorded_one": None if dropped is None else sum(v or 0 for v in dropped.values()),
        "dropped": dropped,
        "video_packets_written": summary.get("video_packets") if summary else (ended.get("video_packets") if ended else None),
        # No frame is taken after the helper is gone: an upper bound of what was recorded of the camera.
        "camera_recorded_s_upper_bound": None if recorded is None or gone is None else round((gone - recorded) / 1e6, 3),
        "camera_open_s_upper_bound": None if helper_spawn_us is None or gone is None else round((gone - helper_spawn_us) / 1e6, 3),
    }


def decompose_gap(gap_ms, numbers):
    """gap = audio lead + priming + one frame interval; the residual is that interval."""
    lead = numbers.get("audio_before_first_recorded_frame_ms")
    if gap_ms is None or lead is None:
        return None
    return {"gap_after_first_frame_ms": gap_ms, "audio_before_first_recorded_frame_ms": lead, "audio_priming_ms": round(PRIMING_MS, 1),
            "residual_ms_one_frame_interval_expected": round(gap_ms - lead - PRIMING_MS, 1)}


def bound_verdict(numbers, seconds, file_duration_s=None, margin_s=0.25, file_margin_s=2.0):
    """The promise of the attended step: at most `seconds` of the camera in the file, and a file not much longer."""
    recorded = numbers.get("camera_recorded_s_upper_bound")
    video_ok = recorded is not None and recorded <= seconds + margin_s
    file_ok = file_duration_s is None or float(file_duration_s) <= seconds + file_margin_s
    return {"camera_recorded_s_upper_bound": recorded, "bound_s": seconds, "margin_s": margin_s, "file_duration_s": None if file_duration_s is None else round(float(file_duration_s), 3),
            "file_bound_s": seconds + file_margin_s, "camera_within_bound": video_ok, "file_within_bound": file_ok, "pass": video_ok and file_ok}


# Row 60's playable check lets the null muxer re-time video onto the nominal frame grid: two frames
# closer than half a frame period (16.67 ms at 30 frames per second) land on one tick.
CLOSE_PAIR_MS = 1000.0 / 30 / 2
NOT_APPLICABLE = "not applicable - variable-rate development source"


def fixed_grid_report(ok60, error_lines, deltas_ms, variable_rate):
    """How row 60's fixed-grid check is REPORTED for a camera run (decision D136 (3); row 140).

    A LOCAL_DEVICE camera is a variable-rate development source (`fixedGrid` is built and OFF by
    ruling): its frames carry the time they were read, so the fixed-grid check does not apply to it.
    It is then reported as not applicable, with the count of close frame pairs (intervals under
    16.67 ms) - the number the check's own error lines follow (pass D3: 95 lines = 95 pairs). The
    raw result of the check stays in the report beside it; nothing is hidden and nothing is judged.
    For a fixed-rate source (the generated picture without jitter, the `--grid` candidate, every
    production class) the check applies and its result is reported as it is: it is NOT weakened."""
    close = len([d for d in deltas_ms if d < CLOSE_PAIR_MS])
    report = {"close_frame_pairs_under_16_67_ms": close, "close_pair_threshold_ms": round(CLOSE_PAIR_MS, 2), "row60_decode_error_lines": error_lines}
    if variable_rate:
        report.update({"row60_fixed_grid_check": NOT_APPLICABLE, "row60_fixed_grid_check_applies": False, "row60_fixed_grid_check_raw_result": ok60})
    else:
        report.update({"row60_fixed_grid_check": "pass" if ok60 else "fail", "row60_fixed_grid_check_applies": True, "row60_fixed_grid_check_raw_result": ok60})
    return report


def main(argv):
    if len(argv) >= 6 and argv[1] == "fixed-grid":
        # fixed-grid <variable|fixed> <ok60: 0|1> <error lines> <interval ms>...
        print(json.dumps(fixed_grid_report(argv[3] == "1", int(argv[4]), [float(x) for x in argv[5:]], argv[2] == "variable")))
        return
    if len(argv) < 3 or argv[1] != "analyse":
        sys.exit(__doc__)
    opts = {"--gap-ms": None, "--helper-spawn-us": None, "--helper-gone-us": None, "--seconds": None, "--file-duration-s": None}
    rest = argv[3:]
    for i in range(0, len(rest) - 1, 2):
        if rest[i] not in opts:
            sys.exit("unknown option %s" % rest[i])
        opts[rest[i]] = float(rest[i + 1])
    as_int = lambda v: None if v is None else int(v)
    numbers = startup_numbers(read_log(argv[2]), as_int(opts["--helper-spawn-us"]), as_int(opts["--helper-gone-us"]))
    out = {"numbers": numbers, "gap": decompose_gap(opts["--gap-ms"], numbers)}
    if opts["--seconds"] is not None:
        out["bound"] = bound_verdict(numbers, opts["--seconds"], opts["--file-duration-s"])
    print(json.dumps(out))


if __name__ == "__main__":
    main(sys.argv)
