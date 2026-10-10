"""The worker-side checks of the microphone rows (blueprint row 71, worker half "71a"; capture spec
E, E.1; errata AU2-05, AU2-07; decisions D84 R-1, R-2, D85 R-3, OD-11). Run through m3worker.py,
which hands this module itself (`M`): its Worker, its sessions, its fixtures and its analysers.

    python3 apps/capture-worker/test/m3worker.py m5switch <run>            the operator's switch (a session, about 20 s)
    python3 apps/capture-worker/test/m3worker.py m5gap <run of m5switch>   M5-GAP-1 on that session's files
    python3 apps/capture-worker/test/m3worker.py m5bound <run of m5switch> the switch bound, judged again
    python3 apps/capture-worker/test/m3worker.py m5warn <run>              silence / disconnect warnings, never a switch
    python3 apps/capture-worker/test/m3worker.py m5rate <run> --ppm -8000  the rate controller at its limit (D85)

A check that starts the worker binds two loopback ports of 8554-8564 and is timing-sensitive: run
it outside the command sandbox under the heavy-host lock,
    /usr/bin/lockf -k -t 1800 .locks/heavy-host.lock python3 apps/capture-worker/test/m3worker.py m5switch NAME
or through the e2e target (`make -C apps/capture-worker e2e E2E_ARGS="--only m5_ --runs 1"`).

WHAT IS JUDGED ON WHAT. The interval record of a switch is held against the PRE-ENCODE PCM tap
(sample n of the tap is sample n of the encoder's input): the first sample of the standby's tone
in the tap is the record's `fromSample`, within the 6 samples a zero crossing of the tone can hide.
Gaplessness (M5-GAP-1) is judged on DECODED samples - their count against the encoder's input, the
reference beeps against the microphone's own manifest, the standby tone's phase - and never on the
packet grid, which is printed beside the verdict and reads the same for a file with samples removed.
"""
import json, math, os, struct, subprocess, sys, time

TONE_DETECT = 1000          # |s16| above this is the standby tone (0.1 = 3,277) or a beep; the primary's noise stays below 400
BOUNDARY_TOLERANCE = 6      # samples: an 880 Hz tone at 0.1 is below TONE_DETECT for at most 5.4 samples around a zero crossing
SEARCH = 2400               # 50 ms on each side of the sample the record names
DECODED_TOLERANCE = 256     # samples: the edge of the tone in DECODED audio (the codec smears a hard cut)
SWITCH_BOUND_US = 21333     # CAPTURE_SWITCH_BOUND_US: one 1,024-sample frame at 48 kHz (spec E)
LATENCY_MS, QUANTUM_MS = 40.0, 10.0   # audio.c LATENCY_US, QUANTUM: a quantum is consumed 40 ms after it was captured


def frames_check(M, w, d):
    """Every line the worker wrote, through the product decoder of @dems/capture-protocol."""
    path = os.path.join(d, "stdout_lines.txt")
    with w.lock:
        open(path, "w").write("\n".join(w.raw) + "\n")
    p = M.sh(["npx", "tsx", os.path.join(M.HERE, "frames_check.ts"), path], cwd=M.REPO)
    try:
        return json.loads(p.stdout.strip().splitlines()[-1])
    except (ValueError, IndexError):
        return {"lines": -1, "decoded": 0, "refused": [{"violation": "TOOL_FAILED", "text": (p.stderr or p.stdout)[-400:]}], "recordSequenceGapless": False}


def tap_samples(d):
    raw = open(os.path.join(d, "tap.s16"), "rb").read()
    return struct.unpack("<%dh" % (len(raw) // 2), raw)


def intervals_of(records):
    return [r["record"] for r in records if r["record"]["kind"] == "AUDIO_SOURCE_INTERVAL"]


def tone_edges(x, lo, hi):
    """(first, last + 1) of the samples above TONE_DETECT inside x[lo:hi], or (None, None)."""
    loud = [i for i in range(max(0, lo), min(len(x), hi)) if abs(x[i]) > TONE_DETECT]
    return (loud[0], loud[-1] + 1) if loud else (None, None)


# ------------------------------------------------------------------------------------------ the switch
def cmd_switch(a, M):
    """One session on the NM-14 fixtures with the PCM tap: to the standby 2.6 s after the cameras' epoch, back 0.5 s
    later, and a third command to the source that already feeds the track. Criteria:
      switch_acknowledged              three ACK ok; the worker exits 0, both cameras recorded
      interval_records_complete        exactly three AUDIO_SOURCE_INTERVAL records - the start (MIC-01, PRIMARY, sample 0),
                                       MIC-02 / STANDBY, MIC-01 / PRIMARY - index 1, 2, 3; each switch names its command;
                                       the command that changed nothing wrote none; AUDIO_TIMELINE_END counts 3 and the
                                       encoder's input
      record_precedes_its_ack          the record of a switch is on the wire before the ACK of its command
      never_switched_without_a_command every interval beyond the start names a command this harness sent
      switch_applied_within_the_bound  appliedDelayUs (worker-measured: command read -> selector switched) <= 21,333 us
      switch_at_a_chunk_boundary       fromSample is a multiple of 480
      interval_record_is_the_tap_boundary   in the pre-encode tap the standby's tone begins at the record's fromSample
                                       and ends at the next record's, within 6 samples (the mutation check: the proof
                                       build `intervalskew` reports one chunk late and must FAIL exactly here)
      boundary_in_capture_time         the capture instant of the boundary (capturedAtMs) lies between one latency plus
                                       one chunk before the command was sent and the bound after it
      every_frame_decodes              every output line is a version-4 message of the product decoder; records 1, 2, 3 ...
    """
    binary = M.VARIANTS[a.variant]
    d = M.rundir(a.name, fresh=True)
    truth = M.build_truth("zero")
    a.tap = True
    marks = {"switches": []}

    def mid(w, plan, sid, info, cps, truth_):
        time.sleep(max(0.0, truth_["epoch_us"] / 1e6 - time.time()) + 2.6)
        for to, pause in (("STANDBY", 0.5), ("PRIMARY", 0.5), ("PRIMARY", 0.0)):
            wall, t = time.time(), time.monotonic()
            c = w.command(sid, "SWITCH_AUDIO_SOURCE", to=to)
            t2, f = w.ack(c)
            marks["switches"].append({"to": to, "correlationId": c, "sent_at_ms": round(wall * 1000, 3), "ack": f, "ack_round_trip_ms": round((t2 - t) * 1000, 2)})
            time.sleep(pause)

    w, plan, info, _ = M.run_session(a, d, binary, truth, after_start=mid)
    M.frame_stats(w, info)
    info.update(marks)
    res = {"check": "M5 switch: bound, interval records, never automatic (row 71a)", "run": a.name, "variant": a.variant, "info": info}
    paths = [c["outputPath"] for c in plan["cameras"]]
    v = M.Crit()
    sw = marks["switches"]
    v("switch_acknowledged", info.get("rc") == {"cam1": 0, "cam2": 0, "worker": 0} and len(sw) == 3 and all(s["ack"]["ok"] is True for s in sw) and all(os.path.exists(p) for p in paths) and not info["crash"])
    recs = info.get("records", [])
    iv = intervals_of(recs)
    end = [r["record"] for r in recs if r["record"]["kind"] == "AUDIO_TIMELINE_END"]
    manifest_end = [json.loads(l) for l in open(os.path.join(d, "manifest.jsonl")) if '"end"' in l]
    samples_in = manifest_end[0]["samples_in"] if manifest_end else None
    res["intervals"], res["timeline_end"], res["encoder_input_samples"] = iv, end, samples_in
    shape = [(r["index"], r["deviceId"], r["role"], r["reason"]) for r in iv]
    ok_shape = shape == [(1, "MIC-01", "PRIMARY", "SESSION_START"), (2, "MIC-02", "STANDBY", "OPERATOR_SWITCH"), (3, "MIC-01", "PRIMARY", "OPERATOR_SWITCH")]
    v("interval_records_complete", ok_shape and len(sw) == 3 and iv[0]["fromSample"] == 0 and iv[0]["correlationId"] is None and iv[0]["appliedDelayUs"] is None
      and [r["correlationId"] for r in iv[1:]] == [sw[0]["correlationId"], sw[1]["correlationId"]] and 0 < iv[1]["fromSample"] < iv[2]["fromSample"]
      and len(end) == 1 and end[0]["intervals"] == 3 and end[0]["samples"] == samples_in and end[0]["sampleRateHz"] == 48000 and iv[2]["fromSample"] < end[0]["samples"])
    sent = {s["correlationId"] for s in sw}
    v("never_switched_without_a_command", bool(iv) and all(r["correlationId"] in sent for r in iv[1:]) and sum(1 for r in iv if r["reason"] == "SESSION_START") == 1
      and sum(1 for l in M.worker_log(d) if l["message"] == "selector_switched") == len(iv) - 1)
    with w.lock:
        order = [f for _, f in w.frames if f]
    def at(pred):
        hit = [i for i, f in enumerate(order) if pred(f)]
        return hit[0] if hit else None
    before = []
    for r, s in zip(iv[1:], sw):
        i_rec = at(lambda f: f.get("type") == "RECORD" and f["record"].get("correlationId") == s["correlationId"])
        i_ack = at(lambda f: f.get("type") == "ACK" and f.get("correlationId") == s["correlationId"])
        before.append(i_rec is not None and i_ack is not None and i_rec < i_ack)
    v("record_precedes_its_ack", len(before) == 2 and all(before))
    judge_bound(v, res, iv, sw, SWITCH_BOUND_US)
    v("switch_at_a_chunk_boundary", len(iv) == 3 and all(r["fromSample"] % 480 == 0 for r in iv))
    if v.ok or len(iv) == 3:
        x = tap_samples(d)
        b1, b2 = iv[1]["fromSample"], iv[2]["fromSample"]
        # The tone window, found WITHOUT the record's exact value: everything above the detection level between
        # 50 ms before the first named sample and 50 ms after the second (no beep of the primary lies there).
        first, last = tone_edges(x, b1 - SEARCH, b2 + SEARCH)
        quiet_before = max((abs(s) for s in x[max(0, b1 - SEARCH):max(0, (first or b1) - 1)]), default=0)
        res["tap"] = {"samples": len(x), "tone_first_sample": first, "tone_end_sample": last, "record_from_samples": [b1, b2],
                      "error_samples": [None if first is None else first - b1, None if last is None else last - b2],
                      "tolerance_samples": BOUNDARY_TOLERANCE, "loudest_before_the_tone_s16": quiet_before, "tap_equals_encoder_input": len(x) == samples_in}
        v("interval_record_is_the_tap_boundary", first is not None and abs(first - b1) <= BOUNDARY_TOLERANCE and abs(last - b2) <= BOUNDARY_TOLERANCE and len(x) == samples_in)
        # Capture time: sample n was captured at T0 + n / 48000. A quantum is consumed LATENCY (40 ms) after it was
        # captured, so the boundary lies up to one latency plus one chunk BEFORE the command, never later than the bound.
        cap = [round(r["capturedAtMs"] - s["sent_at_ms"], 2) for r, s in zip(iv[1:], sw)]
        res["boundary_capture_time_minus_command_ms"] = cap
        v("boundary_in_capture_time", len(cap) == 2 and all(-(LATENCY_MS + QUANTUM_MS + 15.0) <= c <= SWITCH_BOUND_US / 1000.0 for c in cap))
    fc = frames_check(M, w, d)
    res["frames_check"] = fc
    v("every_frame_decodes", fc.get("lines", 0) > 0 and fc.get("decoded") == fc.get("lines") and fc.get("recordSequenceGapless") is True and not info["lines_that_are_no_frame"])
    # Carried finding (a) of the row: what the worker says of the video before the first written sample (reported, judged for its shape only).
    res["first_video_sample_records"] = [r["record"] for r in recs if r["record"]["kind"] == "FIRST_VIDEO_SAMPLE"]
    v("no_leftover", not info["leftovers"]["processes"] and not info["leftovers"]["listeners"])
    M.finish(res, True, a.expect_fail, d, v)


def judge_bound(v, res, iv, sw, bound_us):
    delays = [r["appliedDelayUs"] for r in iv[1:]]
    res["switch_bound"] = {"applied_delay_us": delays, "bound_us": bound_us, "ack_round_trip_ms_not_judged": [s["ack_round_trip_ms"] for s in sw]}
    v("switch_applied_within_the_bound", len(delays) == 2 and all(isinstance(x, int) and 0 <= x <= bound_us for x in delays))


def cmd_bound(a, M):
    """The switch bound of a finished m5switch run, judged again against --bound-us (default 21,333). The control
    judges it against 1 us and must FAIL: the criterion reads the worker's number, not a constant."""
    d = M.rundir(a.name)
    info = json.load(open(os.path.join(d, "result.json")))["info"]
    v, res = M.Crit(), {"check": "M5 switch bound, judged again", "run": a.name, "bound_us": a.bound_us}
    judge_bound(v, res, intervals_of(info["records"]), info["switches"], a.bound_us)
    M.finish(res, True, a.expect_fail, None, v)


# ------------------------------------------------------------------------------------------ M5-GAP-1
def tone_window(x, expect_from, expect_to):
    """The run of the standby's tone in DECODED samples: first and last + 1 of the 1 ms blocks whose RMS is above half
    the tone's (0.035; the primary's noise is 0.006), looked for from 100 ms before to 100 ms after the expected window."""
    lo, hi, block = max(0, expect_from - 4800), min(len(x), expect_to + 4800), 48
    loud = []
    for s0 in range(lo, hi - block + 1, block):
        if math.sqrt(sum(s * s for s in x[s0:s0 + block]) / block) > 0.035:
            loud.append(s0)
    # The reference beeps of the primary are louder than the tone: only the blocks that join the expected window count.
    run = [s0 for s0 in loud if expect_from - 4800 <= s0 <= expect_to + 4800]
    return (run[0], run[-1] + block) if run else (None, None)


def cmd_gap(a, M):
    """M5-GAP-1 (test strategy; erratum AU2-05): the switch-gap analyser on the files of a finished m5switch session.
    The S2 acceptance set - exactly one audio stream, strictly rising packet times - and what replaced S2's blind
    packet-grid metric: decoded sample count against the encoder's input, the primary's reference beeps against the
    microphone's own manifest (spacing and position), the standby tone's phase, and the tone's window against the
    interval records. The packet grid is printed and never judged.
       --control cut1000   1,000 decoded samples removed AT the switch (in memory): must FAIL on spacing, position and
                           the tone window. The packet grid of the same file still reads {1024}."""
    P = M.P111
    d, truth, paths = M.finished(a)
    info = json.load(open(os.path.join(d, "result.json")))["info"]
    iv = intervals_of(info["records"])
    mic, beeps = P.mic_truth(os.path.join(d, "mic.jsonl"))
    samples_in = [json.loads(l) for l in open(os.path.join(d, "manifest.jsonl")) if '"end"' in l][0]["samples_in"]
    v, res = M.Crit(), {"check": "M5-GAP-1 gap analyser (AU2-05)", "run": a.name, "control": a.control, "intervals": iv, "files": {}}
    if len(iv) != 3:
        v("intervals_present", False)
        M.finish(res, True, a.expect_fail, None, v)
    b1, b2 = iv[1]["fromSample"] + M.PRIMING, iv[2]["fromSample"] + M.PRIMING      # where the decoded audio holds the two boundaries
    for p in paths:
        st = [s for s in P.streams(p) if s["codec_type"] == "audio"]
        pts = [int(k["pts"]) for k in P.probe_packets(p, "a:0")]
        x, _, _ = P.audio_pcm(p)
        want_from, want_to = b1, b2
        if a.control == "cut1000":
            x = x[:b1] + x[b1 + 1000:]              # the negative vector of AU2-05, placed at the switch itself
        ok, r = P.continuity(x, mic, beeps, samples_in, expect_tone=True)
        first, last = tone_window(x, want_from, want_to)
        r["one_audio_stream"], r["packet_pts_strictly_rising"] = len(st) == 1, all(y > z for z, y in zip(pts, pts[1:]))
        r["tone_window_decoded"] = [first, last]
        r["tone_window_expected"] = [want_from, want_to]
        r["tone_window_error_samples"] = [None if first is None else first - want_from, None if last is None else last - want_to]
        r["packet_grid_deltas_not_judged"] = P.packet_grid(p)
        res["files"][os.path.basename(p)] = r
        for k, val in r["criteria"].items():
            v(k, val == "PASS")
        v("one_audio_stream_rising_pts", r["one_audio_stream"] and r["packet_pts_strictly_rising"])
        v("tone_window_is_the_interval", first is not None and abs(first - want_from) <= DECODED_TOLERANCE and abs(last - want_to) <= DECODED_TOLERANCE)
    M.finish(res, True, a.expect_fail, None, v)


# ------------------------------------------------------------------------------------------ warnings, never a switch
SILENCE_MS, DISCONNECT_MS = 3000, 2000
PLAN1 = "tone:2,zero:4.5,tone:2,quiet:4.5,tone:60"          # MIC-01 (PRIMARY, feeds the track): silent twice (zeros, then -60 dBFS)
PLAN2 = "tone:3,none:3.5,tone:2,none:1.5,tone:60"           # MIC-02 (STANDBY): away 3.5 s (a disconnect), then 1.5 s (inside the debounce)


def cmd_warn(a, M):
    """A session whose microphones follow a script (test/m5_mic.c), with the silence duration set to 3 s through the
    named setting (the 10 s default is proven on the raiser's own clock: M5-WARN-1, test/micwatch_test.c):
      MIC-01, which FEEDS the track: sound 2 s, digital silence 4.5 s, sound 2 s, -60 dBFS 4.5 s, sound.
      MIC-02, the standby: sound 3 s, NOTHING for 3.5 s, sound 2 s, nothing for 1.5 s, sound.
    Criteria:
      warnings_are_exactly_the_scripted_ones  MIC-01: MIC_SILENT / MIC_LEVEL_BELOW_THRESHOLD ACTIVE, CLEARED, ACTIVE, CLEARED
                                              MIC-02: CAPTURE_FAULT / MIC_DISCONNECTED ACTIVE, CLEARED - and nothing for the 1.5 s gap
      subject_is_a_device_id_never_null       every WARNING names MIC-01 or MIC-02 (or a camera): no null, no role
      raised_after_its_duration               each ACTIVE arrives its duration after the script's instant (+0 .. +0.45 s)
      cleared_when_it_ends                    each CLEARED arrives within 0.45 s of the script's instant
      never_switched                          one AUDIO_SOURCE_INTERVAL (the start, MIC-01), no selector command in the log,
                                              and the tap is silent while MIC-01 is silent although MIC-02 sounds
      every_frame_decodes                     every output line decodes as a version-4 message
    """
    binary = M.VARIANTS[a.variant]
    d = M.rundir(a.name, fresh=True)
    truth = M.build_truth("zero")
    a.tap = True
    a.worker_args = ("--mic-silence-ms", str(SILENCE_MS), "--mic-disconnect-ms", str(DISCONNECT_MS))
    clock = {"wall_minus_mono": time.time() - time.monotonic()}
    fixture_sources = M.start_sources

    def scripted_sources(d_, truth_, plan, procs, mic_seconds, mic_extra=()):
        mic = M.spawn([os.path.join(M.BUILD, "m5_mic"), "--out1", plan["mics"][0]["input"]["path"], "--out2", plan["mics"][1]["input"]["path"], "--manifest", os.path.join(d_, "mic.jsonl"),
                       "--plan1", PLAN1, "--plan2", PLAN2, "--seconds", "%.3f" % mic_seconds], stdin=subprocess.DEVNULL, stderr=open(os.path.join(d_, "mic.err"), "w"))
        procs.append(mic)
        # The cameras are the NM-14 fake cameras, started exactly as m3worker.start_sources starts them.
        cps = []
        for c, pc in zip(truth_["cams"], plan["cameras"]):
            cp = M.spawn([M.CAM, "--url", pc["ingestUrl"], "--epoch-us", str(truth_["epoch_us"]), "--claimed-epoch-us", str(c["claimed_epoch_us"]), "--drift-ppm", str(c["drift_ppm"]),
                          "--frames", str(c["frames"]), "--flash-first", str(c["flash_first"]), "--flash-every", str(c["flash_every"]), "--gop", str(truth_.get("gop", M.FPS))],
                         stdin=subprocess.DEVNULL, stderr=open(os.path.join(d_, "cam%d.err" % c["cam"]), "w"))
            procs.append(cp)
            cps.append(cp)
        return mic, cps

    M.start_sources = scripted_sources
    try:
        w, plan, info, _ = M.run_session(a, d, binary, truth)
    finally:
        M.start_sources = fixture_sources
    M.frame_stats(w, info)
    res = {"check": "M5 warnings: silent and disconnected microphones by device ID, never a switch (row 71a)", "run": a.name, "variant": a.variant,
           "settings": {"micSilenceDurationMs": SILENCE_MS, "micDisconnectDebounceMs": DISCONNECT_MS, "micSilenceDbfs": -50}, "info": info}
    v = M.Crit()
    v("worker_exit_0", info.get("rc", {}).get("worker") == 0 and not info["crash"])
    rows = [json.loads(l) for l in open(os.path.join(d, "mic.jsonl"))]
    e0 = [r for r in rows if r["type"] == "mic"][0]["e0_real_us"] / 1e6
    seg = {m: [r for r in rows if r["type"] == "segment" and r["mic"] == m] for m in (1, 2)}
    t_of = lambda m, i: e0 + seg[m][i]["from_sample"] / 48000.0           # wall clock of the start of segment i of microphone m
    with w.lock:
        warn = [(t + clock["wall_minus_mono"], f) for t, f in w.frames if f and f.get("type") == "WARNING"]
    got = [(f["subject"], f["code"], f["reason"], f["state"]) for _, f in warn]
    res["warnings"] = [dict(f, at_s_after_mic_start=round(t - e0, 3)) for t, f in warn]
    want1 = [("MIC-01", "MIC_SILENT", "MIC_LEVEL_BELOW_THRESHOLD", s) for s in ("ACTIVE", "CLEARED", "ACTIVE", "CLEARED")]
    want2 = [("MIC-02", "CAPTURE_FAULT", "MIC_DISCONNECTED", s) for s in ("ACTIVE", "CLEARED")]
    v("warnings_are_exactly_the_scripted_ones", [g for g in got if g[0] == "MIC-01"] == want1 and [g for g in got if g[0] == "MIC-02"] == want2 and len([g for g in got if g[0].startswith("MIC-")]) == 6)   # the fake cameras end before the stop: their own warnings are not this check's
    v("subject_is_a_device_id_never_null", bool(warn) and all(f.get("subject") in ("MIC-01", "MIC-02", "CAM-01", "CAM-02") and f.get("reason") for _, f in warn))
    # When each must arrive: the script's instant + the duration for a raise, the script's instant for a clear.
    due = {("MIC-01", 0): t_of(1, 1) + SILENCE_MS / 1000.0, ("MIC-01", 1): t_of(1, 2), ("MIC-01", 2): t_of(1, 3) + SILENCE_MS / 1000.0, ("MIC-01", 3): t_of(1, 4),
           ("MIC-02", 0): t_of(2, 1) + DISCONNECT_MS / 1000.0, ("MIC-02", 1): t_of(2, 2)}
    seen, late = {}, []
    for t, f in warn:
        if not str(f.get("subject", "")).startswith("MIC-"):
            continue
        k = (f["subject"], seen.setdefault(f["subject"], 0))
        seen[f["subject"]] += 1
        if k in due:
            late.append({"subject": k[0], "nth": k[1], "state": f["state"], "late_s": round(t - due[k], 3)})
    res["lateness"] = late
    v("raised_after_its_duration", len(late) == 6 and all(0.0 <= x["late_s"] <= 0.45 for x in late if x["state"] == "ACTIVE"))
    v("cleared_when_it_ends", len(late) == 6 and all(0.0 <= x["late_s"] <= 0.45 for x in late if x["state"] == "CLEARED"))
    iv = intervals_of(info.get("records", []))
    log = M.worker_log(d)
    t0 = [l for l in log if l["message"] == "audio_started"]
    x = tap_samples(d) if os.path.exists(os.path.join(d, "tap.s16")) else ()
    silent_ok = False
    if t0 and x:
        # MIC-01 is silent from its second 2 to 6.5 while MIC-02 sounds until its second 3: the tap between 2.3 s and
        # 2.9 s of the microphones' time holds NO tone if (and only if) the track still carries MIC-01.
        shift = int(round((e0 - t0[0]["t0_real_us"] / 1e6) * 48000))            # the microphone's sample 0 in tap samples
        window = x[shift + int(2.3 * 48000):shift + int(2.9 * 48000)]
        before = x[shift + int(0.5 * 48000):shift + int(1.5 * 48000)]
        res["tap_while_the_active_microphone_is_silent"] = {"peak_s16": max((abs(s) for s in window), default=None), "peak_s16_while_it_sounds": max((abs(s) for s in before), default=None), "samples": len(window)}
        silent_ok = len(window) > 20000 and max(abs(s) for s in window) < 100 and max((abs(s) for s in before), default=0) > 3000
    res["intervals"] = iv
    v("never_switched", [(r["index"], r["deviceId"], r["reason"]) for r in iv] == [(1, "MIC-01", "SESSION_START")] and not [l for l in log if l["message"] == "selector_switched"] and silent_ok)
    fc = frames_check(M, w, d)
    res["frames_check"] = fc
    v("every_frame_decodes", fc.get("lines", 0) > 0 and fc.get("decoded") == fc.get("lines") and fc.get("recordSequenceGapless") is True)
    v("no_leftover", not info["leftovers"]["processes"] and not info["leftovers"]["listeners"])
    M.finish(res, True, a.expect_fail, d, v)


# ------------------------------------------------------------------------------------------ the rate controller at its limit (D85 R-3)
def cmd_rate(a, M):
    """Both fake microphones on a sample clock --ppm off the host's (default 8,000 ppm slow: beyond the +-5,000 the
    controller absorbs). Criteria:
      rate_limit_warning_raised_and_named   CAPTURE_FAULT / MIC_RATE_AT_LIMIT, ACTIVE, for MIC-01 and for MIC-02, by device ID
      telemetry_states_the_rate             a telemetry level of each microphone reads ratePpm at +-5,000, with its deviceId
      worker_keeps_recording                the worker exits 0 and both files exist (a warning, not a stop)
    With --ppm -2000 (inside the range) no such warning may exist: the control, which must FAIL on the first criterion."""
    d = M.rundir(a.name, fresh=True)
    truth = M.build_truth("zero")
    w, plan, info, _ = M.run_session(a, d, M.VARIANTS[a.variant], truth, mic_extra=("--ppm", str(a.ppm)))
    M.frame_stats(w, info)
    res = {"check": "M5 microphone rate controller at its limit is reported (D85 R-3; row 71a)", "run": a.name, "mic_ppm": a.ppm, "info": info}
    v = M.Crit()
    warn = [f for f in info.get("warnings", []) if f.get("reason") == "MIC_RATE_AT_LIMIT"]
    res["rate_warnings"] = warn
    v("rate_limit_warning_raised_and_named", sorted((f["subject"], f["code"], f["state"]) for f in warn if f["state"] == "ACTIVE") == [("MIC-01", "CAPTURE_FAULT", "ACTIVE"), ("MIC-02", "CAPTURE_FAULT", "ACTIVE")])
    tel = [f for _, f in w.of("TELEMETRY")]
    peak = {}
    for f in tel:
        for lv in f["levels"]:
            if lv.get("ratePpm") is not None:
                peak[lv.get("deviceId")] = max(peak.get(lv.get("deviceId"), 0.0), abs(lv["ratePpm"]))
    res["largest_rate_ppm_in_telemetry"] = peak
    want_peak = 5000.0 if abs(a.ppm) >= 5000 else None
    v("telemetry_states_the_rate", set(peak) == {"MIC-01", "MIC-02"} and (want_peak is None or all(abs(p - want_peak) < 0.5 for p in peak.values())))
    v("worker_keeps_recording", info.get("rc", {}).get("worker") == 0 and all(os.path.exists(c["outputPath"]) for c in plan["cameras"]) and not info["crash"])
    res["mic_summary"] = [{k: l[k] for k in ("mic", "received", "missing", "dropped", "restarts", "last_ppm")} for l in M.worker_log(d) if l["message"] == "mic_summary"]
    fc = frames_check(M, w, d)
    res["frames_check"] = fc
    v("every_frame_decodes", fc.get("lines", 0) > 0 and fc.get("decoded") == fc.get("lines"))
    v("no_leftover", not info["leftovers"]["processes"] and not info["leftovers"]["listeners"])
    M.finish(res, True, a.expect_fail, d, v)
