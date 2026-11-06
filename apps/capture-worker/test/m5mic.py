"""The worker-side checks of the microphone rows (blueprint row 71, worker half "71a"; capture spec
E, E.1; errata AU2-05, AU2-07; decisions D84 R-1, R-2, D85 R-3, OD-11). Run through m3worker.py,
which hands this module itself (`M`): its Worker, its sessions, its fixtures and its analysers.

    python3 apps/capture-worker/test/m3worker.py m5tap <run>               the start interval and the tap (a session, about 20 s)
    python3 apps/capture-worker/test/m3worker.py m5tapjudge <run of m5tap> [--channel 2]   the tap of that session, judged again
    python3 apps/capture-worker/test/m3worker.py m5warn <run>              silence / disconnect warnings, never a switch
    python3 apps/capture-worker/test/m3worker.py m5rate <run> --ppm -8000  the rate controller at its limit (D85)

A check that starts the worker binds two loopback ports of 8554-8564 and is timing-sensitive: run
it outside the command sandbox under the heavy-host lock,
    /usr/bin/lockf -k -t 1800 .locks/heavy-host.lock python3 apps/capture-worker/test/m3worker.py m5tap NAME
or through the e2e target (`make -C apps/capture-worker e2e E2E_ARGS="--only m5_ --runs 1"`).

WHAT IS JUDGED ON WHAT (audit row 152b; N-31, D5 pairs; D135, D136). The operator's switch is RETIRED: operation 81 is
refused at the Core, the protocol and the supervisor have no such command, and the worker ends on such a line (the proto
check of m3worker.py). Camera N's file carries its pair's channel MIC-0N (row 152), and the selector lane feeds only the
PCM tap, on MIC-01, for the whole session. So the one interval record of a session is the start's (MIC-01 from sample 0),
and the PRE-ENCODE PCM tap (sample n of the tap is sample n of the timeline) carries channel 1 from its first sample to
its last. What the switch checks judged - its bound, its records against the tap, the gap AT a switch (M5-GAP-1), the
skewed-record proof build - judged the removed switch and is gone with it; the gaplessness of every pair's file is
judged by `continuity` of m3worker.py (per pair, with its two controls).
"""
import json, math, os, struct, subprocess, sys, time

# The reference signal of each channel of test-fixtures/fake_mic.c: channel 1 is quiet noise with the 1 kHz beeps, 2..4
# a steady tone at 0.1. The tap is judged by which of the three tones it holds (none for channel 1).
CHANNEL_TONE_HZ = {2: 880.0, 3: 660.0, 4: 440.0}
TONE_WIN = 600              # samples per window: 11 whole cycles of 880 Hz, 8.25 of 660 Hz, 5.5 of 440 Hz (amplitude read per window)
TONE_PRESENT = 0.05         # amplitude (of 1.0) at or above which a window holds a channel's tone (the tones are at 0.1)
TONE_HOLDS = 0.9            # the share of windows (beeps left out) that must hold the tone of the channel the tap carries


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


def tone_amplitude(x, start, freq):
    """The amplitude of `freq` in x[start:start + TONE_WIN] (x: s16 samples), as a fraction of full scale."""
    w = 2 * math.pi * freq / 48000
    c = sn = 0.0
    for n in range(start, start + TONE_WIN):
        c += x[n] * math.cos(w * n)
        sn += x[n] * math.sin(w * n)
    return 2 * math.hypot(c, sn) / TONE_WIN / 32768.0


def judge_tap(x, channel):
    """Which channel the tap carries, window by window (beeps left out: a window whose peak is above 0.3 holds one).
    Channel 1: no window holds any of the tones of 2..4. Channel k >= 2: at least TONE_HOLDS of the windows hold tone k
    and none holds another channel's tone. Returns (holds, detail)."""
    wins = [s0 for s0 in range(0, len(x) - TONE_WIN + 1, TONE_WIN) if max(abs(v) for v in x[s0:s0 + TONE_WIN]) <= 0.3 * 32768]
    held = {k: sum(1 for s0 in wins if tone_amplitude(x, s0, hz) >= TONE_PRESENT) for k, hz in CHANNEL_TONE_HZ.items()}
    if channel == 1:
        ok = bool(wins) and all(n == 0 for n in held.values())
    else:
        ok = bool(wins) and held.get(channel, 0) >= TONE_HOLDS * len(wins) and all(n == 0 for k, n in held.items() if k != channel)
    return ok, {"judged_as_channel": channel, "windows_judged": len(wins), "windows_holding_the_tone_of_channel": held, "tone_present_at": TONE_PRESENT, "share_required": TONE_HOLDS}


# ------------------------------------------------------------------------------------------ the start interval and the tap (row 152b)
def cmd_tap(a, M):
    """One session on the NM-14 fixtures with the PCM tap (D5 pairs; audit row 152b replaces the switch check of row 71).
    Criteria:
      worker_and_cameras_exit_0       the worker exits 0, both cameras recorded, no CRASH
      one_start_interval              exactly ONE AUDIO_SOURCE_INTERVAL: index 1, MIC-01, PRIMARY, SESSION_START, sample 0,
                                      no correlation ID, no applied delay; AUDIO_TIMELINE_END counts 1 interval and the
                                      timeline's samples (the manifest's `samples_in`)
      never_switched                  no OPERATOR_SWITCH record and no `selector_switched` line in the worker's log
      tap_is_the_timeline             the tap holds exactly the timeline's samples (sample n of the tap is sample n of it)
      tap_carries_channel_1           the tap holds channel 1 for the whole session: none of the tones of channels 2..4 in
                                      any window (fake_mic.c: channel 2 is 880 Hz at 0.1 and carries the beeps too); its
                                      control is m5tapjudge --channel 2 on the same run, which must FAIL here
      every_frame_decodes             every output line is a version-6 message of the product decoder; records gapless
    """
    binary = M.VARIANTS[a.variant]
    d = M.rundir(a.name, fresh=True)
    truth = M.build_truth("zero")
    a.tap = True
    w, plan, info, _ = M.run_session(a, d, binary, truth)
    M.frame_stats(w, info)
    res = {"check": "M5 the start interval and the tap: no switch, channel 1 throughout (row 71a; audit row 152b, D5 pairs)", "run": a.name, "variant": a.variant, "info": info}
    paths = [c["outputPath"] for c in plan["cameras"]]
    v = M.Crit()
    v("worker_and_cameras_exit_0", info.get("rc") == {"cam1": 0, "cam2": 0, "worker": 0} and all(os.path.exists(p) for p in paths) and not info["crash"])
    recs = info.get("records", [])
    iv = intervals_of(recs)
    end = [r["record"] for r in recs if r["record"]["kind"] == "AUDIO_TIMELINE_END"]
    manifest_end = [json.loads(l) for l in open(os.path.join(d, "manifest.jsonl")) if '"end"' in l]
    samples_in = manifest_end[0]["samples_in"] if manifest_end else None
    res["intervals"], res["timeline_end"], res["encoder_input_samples"] = iv, end, samples_in
    v("one_start_interval", [(r["index"], r["deviceId"], r["role"], r["reason"], r["fromSample"], r["correlationId"], r["appliedDelayUs"]) for r in iv] == [(1, "MIC-01", "PRIMARY", "SESSION_START", 0, None, None)]
      and len(end) == 1 and end[0]["intervals"] == 1 and end[0]["samples"] == samples_in and end[0]["sampleRateHz"] == 48000)
    v("never_switched", not [r for r in iv if r["reason"] != "SESSION_START"] and not [l for l in M.worker_log(d) if l.get("message") == "selector_switched"])
    x = tap_samples(d) if os.path.exists(os.path.join(d, "tap.s16")) else ()
    res["tap_samples"] = len(x)
    v("tap_is_the_timeline", bool(x) and len(x) == samples_in)
    ok, res["tap"] = judge_tap(x, 1) if x else (False, None)
    v("tap_carries_channel_1", ok)
    fc = frames_check(M, w, d)
    res["frames_check"] = fc
    v("every_frame_decodes", fc.get("lines", 0) > 0 and fc.get("decoded") == fc.get("lines") and fc.get("recordSequenceGapless") is True and not info["lines_that_are_no_frame"])
    res["first_video_sample_records"] = [r["record"] for r in recs if r["record"]["kind"] == "FIRST_VIDEO_SAMPLE"]
    v("no_leftover", not info["leftovers"]["processes"] and not info["leftovers"]["listeners"])
    M.finish(res, True, a.expect_fail, d, v)


def cmd_tapjudge(a, M):
    """The tap of a finished m5tap run, judged again as channel --channel (default 1). The control judges it as channel 2
    and must FAIL on `tap_carries_channel_2`: the criterion reads the tap's samples, not the plan."""
    d = M.rundir(a.name)
    v, res = M.Crit(), {"check": "M5 the tap of a finished run, judged again", "run": a.name, "channel": a.channel}
    x = tap_samples(d)
    ok, res["tap"] = judge_tap(x, a.channel)
    v("tap_carries_channel_%d" % a.channel, ok)
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
        mic = M.spawn([os.path.join(M.BUILD, "m5_mic")] + M.mic_out_args(plan) + ["--manifest", os.path.join(d_, "mic.jsonl"),   # D61 (2026-11-04): all FOUR channels are fed
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
