"""THE GAPPED MICROPHONE KIND (task 4 row N3; protocol version 5; design 06 sections 7.2, 7.2a, 8.2, 9.2; decisions
C107, C110 (2), (5), C119 (1); review addendum SM-29, SM-30, SM-31, SM-33). Run through m3worker.py, which hands this
module itself (`M`): its Worker, its sessions, its fixtures.

    python3 apps/capture-worker/test/m3worker.py n3gap <run> --mode measured     one session on the stand-in (about 25 s)
    python3 apps/capture-worker/test/m3worker.py n3judge <run of n3gap> [--control dropone]   the same files judged again

A check that starts the worker binds two loopback ports of 8559-8564 and is timing-sensitive: run it outside the command
sandbox under the heavy-host lock, or through the e2e target (`make -C apps/capture-worker e2e E2E_ARGS="--only n3_"`).

THE STAND-IN (test/gapped_mic.c) writes packets of 512 samples on its own clock and LEAVES OUT whole packets by a known
rule (`--skip-every 10`: the measured pattern of row MM3, about one packet in ten). Its samples are a MARKER that is never
zero, so the worker's PCM tap - sample n of the tap is sample n of the encoder's input - tells by itself which samples the
worker inserted (exact zeros) and which device sample every other one is. Every count of the worker is held against what
the TAP and the STAND-IN say, never against the worker's own other numbers:

  account_identity_to_the_sample   the closing MIC_SAMPLE_ACCOUNT of every gapped microphone: received - discarded -
                                   buffered + inserted = timeline = AUDIO_TIMELINE_END.samples = the tap's length; and so
                                   does every periodic account (at its own timeline sample)
  received_is_what_the_writer_wrote  receivedSamples = the samples the stand-in wrote (it ends before the worker stops)
  tap_zeros_are_the_inserted_ones  the exact zeros of the tap where a gapped microphone fed = the sum of fedInsertedSamples;
                                   the positions it fed = the sum of fedSamples
  tap_runs_are_the_listed_runs     the maximal zero runs of the tap there = the sum of fedRuns; the runs of 4,800 or more
                                   = the AUDIO_INSERTED_RUN records (index, fromSample, samples, the microphone that fed
                                   at the first sample) - the first 1,024 - and the rest = runsNotListed, runsNotListedSamples
  copy_is_exact                    every other tap sample of MIC-01 is a sample the stand-in wrote, in order; the ones the
                                   tap does not hold are exactly the discarded ones, the ones taken while MIC-02 fed and
                                   the non-finite ones (no resampler: value for value)
  no_stretch_no_rate_controller    ratePpm null in every level of a gapped microphone, no MIC_RATE_AT_LIMIT for it, no
                                   `mic_clock` line of the rate controller for it in the worker's log
  telemetry_states_the_account     every level of every TELEMETRY carries the four members; the list is never sent empty
                                   (so it fits); inserted and nonZero never go back
  every_frame_decodes              every output line is a version-5 message of the product decoder; records gapless
and, per mode, what that mode is for (see MODES). The displacement of a marker against its capture instant (design 06
section 7.2 point 4) is MEASURED and stated beside the verdict, and judged against the product bound of +-40 ms.
"""
import bisect, json, math, os, signal, struct, subprocess, sys, time

SR, Q = 48000, 480
RUN_MIN, RUNS_MAX, PERIOD = 4800, 1024, 2_880_000
G, F = "PCM_FIFO_GAPPED", "PCM_FIFO"
PRODUCT_BOUND_MS = 40.0                 # av_analyse.PRODUCT_MS: the bound of the offset between sound and picture
LONG_ID = "MIC-" + "L" * 121 + "-01"    # 128 characters: the longest device ID of the protocol (telemetry and record must fit)
LONG_ID2 = "MIC-" + "L" * 121 + "-02"
# D61 (2026-11-04): the plan carries FOUR channels - one longest ID each (the level list must hold four of them).
LONG_IDS = ["MIC-" + "L" * 121 + "-0%d" % (i + 1) for i in range(4)]

# kinds: the microphone input kinds, CYCLED over the plan's FOUR rows (D61, 2026-11-04; was the pair). args: the stand-in's pattern (seconds of its own clock). frames: the cameras' length
# (50 per second, after a 5 s lead). outlive: the writer runs until the worker is gone (a whole pipe to the end).
MODES = {
    # Audit row 152b (N-31; D135): the operator's switch is retired - the measured pattern runs on channel 1 for the whole
    # session (the tap's input is fixed at START; camera N's file carries its pair's channel, row 152).
    "measured": {"kinds": (G, G), "args": ["--skip-every", "10"], "frames": 750,
                 "what": "the measured pattern, every microphone gapped, the tap on MIC-01 for the whole session (no switch: D5 pairs)"},
    "whole": {"kinds": (G, F), "args": ["--skip-every", "0"], "frames": 650, "outlive": True,
              "what": "a whole pipe on a gapped PRIMARY beside a PCM_FIFO STANDBY: nothing inserted, nothing discarded but the rest"},
    "late4": {"kinds": (G, G), "args": ["--skip-every", "10", "--start1-after", "4"], "frames": 650,
              "what": "the PRIMARY's writer starts 4 s late: the track opens on a listed run from sample 0"},
    "trim": {"kinds": (G, G), "args": ["--skip-every", "10", "--start1-after", "0.2"], "frames": 650,
             "what": "the STANDBY began before sample 0: its trim is discarded and counted"},
    "stop3": {"kinds": (G, G), "args": ["--skip-every", "10", "--stop-at", "8", "--resume-at", "11"], "frames": 750,
              "what": "the writer stops for 3 s: one listed run, and the re-placement after it counted"},
    "nan": {"kinds": (G, G), "args": ["--skip-every", "10", "--nan-at", "336100"], "frames": 650, "long_ids": True,
            "what": "a sample that is not a number; device IDs of 128 characters (the level list and the record fit)"},
    "runs1025": {"kinds": (G, G), "args": ["--cycles", "1025", "--cycle-from", "2", "--on-ms", "30", "--off-ms", "160"], "frames": 9900,
                 "what": "1,025 stops of 160 ms: 1,024 runs listed, the rest counted with their sum; periodic accounts"},
    "killbefore": {"kinds": (G, G), "args": ["--skip-every", "10"], "frames": 650, "kill": "before",
                   "what": "the worker killed before its first account: no account, nothing that does not decode"},
    "killbetween": {"kinds": (G, G), "args": ["--skip-every", "10"], "frames": 3500, "kill": "between",
                    "what": "the worker killed between two accounts: the periodic one at 2,880,000 stands, reconciled"},
    "killafter": {"kinds": (G, G), "args": ["--skip-every", "10"], "frames": 650, "kill": "after",
                  "what": "the worker killed right after its closing account: the account is on the wire, whole"},
}


def plan_with(M, mode):
    original = M.make_plan

    def make_plan(d, sid, *args, **kw):
        plan = original(d, sid, *args, **kw)
        for i, mic in enumerate(plan["mics"]):
            mic["input"]["kind"] = mode["kinds"][i % len(mode["kinds"])]      # D61: cycled over the four rows
            if mode.get("long_ids"):
                mic["deviceId"] = LONG_IDS[i]
        return plan
    return original, make_plan


def sources_with(M, mode, d):
    def start_sources(d_, truth, plan, procs, mic_seconds, mic_extra=()):
        # The stand-in ends 1 s before the cameras (so that every sample it wrote is read: received = written), unless
        # the mode lets it outlive the worker (a whole pipe to the end).
        cams_end_s = truth["epoch_us"] / 1e6 - time.time() + max(c["frames"] for c in truth["cams"]) / M.FPS
        seconds = cams_end_s + 30 if mode.get("outlive") else cams_end_s - 1.0
        M.camera_kind_check(truth)                          # audit row W3F (D142): M3_CAMERA=sr stands in for the C camera, or stops here
        mic = M.spawn([os.path.join(M.BUILD, "gapped_mic")] + M.mic_out_args(plan) +      # D61 (2026-11-04): all FOUR channels are fed
                      ["--manifest", os.path.join(d_, "gapped.jsonl"), "--seconds", "%.3f" % seconds] + list(mode["args"]),
                      stdin=subprocess.DEVNULL, stderr=open(os.path.join(d_, "mic.err"), "w"))
        procs.append(mic)
        cps = []
        for c, pc in zip(truth["cams"], plan["cameras"]):
            cp = M.camera_spawn(d_, truth, c, pc)            # audit row W3F: m3worker's camera of the run (C camera, or M3_CAMERA=sr)
            procs.append(cp)
            cps.append(cp)
        return mic, cps
    return start_sources


def during(mode, marks):
    """What the harness does while the session runs: kills, and waiting out a long session (the harness waits for a camera
    at most 120 s). Audit row 152b: no switch any more (the command is retired with operation 81)."""
    def mid(w, plan, sid, info, cps, truth):
        epoch = truth["epoch_us"] / 1e6
        cams_end = epoch + max(c["frames"] for c in truth["cams"]) / 50.0
        kill = mode.get("kill")
        if kill == "before":
            time.sleep(max(0.0, epoch + 3.0 - time.time()))
            os.kill(w.p.pid, signal.SIGKILL)
            marks["killed"] = "before the first account"
        elif kill == "between":
            t, f = w.wait(lambda f: f.get("type") == "RECORD" and f["record"].get("kind") == "MIC_SAMPLE_ACCOUNT", 110, "the first periodic account")
            time.sleep(3.0)
            os.kill(w.p.pid, signal.SIGKILL)
            marks["killed"] = "3 s after the first periodic account"
        elif kill == "after":
            for cp in cps:
                cp.wait(timeout=120)
            time.sleep(1.0)
            w.command(sid, "STOP", reason="STOPPED")
            try:
                w.wait(lambda f: f.get("type") == "RECORD" and f["record"].get("kind") == "MIC_SAMPLE_ACCOUNT" and f["record"].get("closing") is True, 10, "the closing account")
            except RuntimeError as e:
                marks["closing_wait"] = str(e)
            if w.p.poll() is None:
                os.kill(w.p.pid, signal.SIGKILL)
                marks["killed"] = "at the closing account"
            else:
                marks["killed"] = "not needed: the worker had ended"
        if cams_end - time.time() > 100:
            time.sleep(max(0.0, cams_end - 60 - time.time()))
    return mid


# ------------------------------------------------------------------------------------------ the session
def cmd_gap(a, M):
    mode = MODES[a.mode]
    d = M.rundir(a.name, fresh=True)
    truth = M.build_truth("zero", frames_override=(mode["frames"], mode["frames"]))
    a.tap = True
    marks = {"mode": a.mode, "what": mode["what"]}
    original_plan, M.make_plan = plan_with(M, mode)
    original_sources, M.start_sources = M.start_sources, sources_with(M, mode, d)
    try:
        w, plan, info, _ = M.run_session(a, d, M.VARIANTS[a.variant], truth, after_start=during(mode, marks))
    finally:
        M.make_plan, M.start_sources = original_plan, original_sources
    M.frame_stats(w, info)
    sys.path.insert(0, M.HERE)
    import m5mic
    fc = m5mic.frames_check(M, w, d)
    with w.lock:
        tel = [f for _, f in w.frames if f and f.get("type") == "TELEMETRY"]
    json.dump({"plan": plan, "marks": marks, "records": info.get("records", []), "warnings": info.get("warnings", []), "telemetry": [f["levels"] for f in tel],
               "frames_check": fc, "rc": info.get("rc"), "crash": info.get("crash"), "leftovers": info.get("leftovers"), "not_frames": info.get("lines_that_are_no_frame")},
              open(os.path.join(d, "session.json"), "w"))
    judge(a, M, d)


def cmd_judge(a, M):
    """The files of a finished n3gap run, judged again (--control dropone: one tap sample removed in memory, which every
    reconciliation with the tap must refuse)."""
    judge(a, M, M.rundir(a.name))


# ------------------------------------------------------------------------------------------ the judge
def tap_of(d):
    raw = open(os.path.join(d, "tap.s16"), "rb").read()
    return list(struct.unpack("<%dh" % (len(raw) // 2), raw))


def judge(a, M, run_dir):
    s = json.load(open(os.path.join(run_dir, "session.json")))
    d = None if getattr(a, "control", None) else run_dir          # a control never overwrites the run's own result.json
    mode = MODES[s["marks"]["mode"]]
    v = M.Crit()
    res = {"check": "N3 gapped microphone kind (protocol version 5): " + mode["what"], "run": a.name, "mode": s["marks"]["mode"], "control": getattr(a, "control", None), "marks": s["marks"]}
    plan = s["plan"]
    ids = [m["deviceId"] for m in plan["mics"]]
    gapped = [m["input"]["kind"] == G for m in plan["mics"]]
    recs = [r["record"] for r in s["records"]]
    acc = [r for r in recs if r["kind"] == "MIC_SAMPLE_ACCOUNT"]
    runs = [r for r in recs if r["kind"] == "AUDIO_INSERTED_RUN"]
    iv = [r for r in recs if r["kind"] == "AUDIO_SOURCE_INTERVAL"]
    end = [r for r in recs if r["kind"] == "AUDIO_TIMELINE_END"]
    closing = {r["deviceId"]: r for r in acc if r["closing"]}
    periodic = [r for r in acc if not r["closing"]]
    mic_rows = [json.loads(l) for l in open(os.path.join(run_dir, "gapped.jsonl"))]
    writer = [r for r in mic_rows if r["type"] == "mic"][0]
    wend = ([r for r in mic_rows if r["type"] == "end"] or [None])[0]
    log = M.worker_log(run_dir)
    t0 = [l for l in log if l["message"] == "audio_started"]
    res["records_of_the_account"] = {"accounts": acc, "runs_listed": len(runs), "first_runs": runs[:3], "last_runs": runs[-2:]}
    res["writer"] = {k: (wend or {}).get(k) for k in ("written", "packets", "left_out")}
    e0 = writer["e0_real_us"]                                  # the stand-in's clock: device sample j was captured at e0 + j / 48000
    T0 = t0[0]["t0_real_us"] if t0 else None                   # the worker's: track sample p is placed at T0 + p / 48000

    # --- every frame decodes, records gapless; nothing left
    fc = s["frames_check"]
    res["frames_check"] = {k: fc.get(k) for k in ("lines", "decoded", "refused", "records", "recordSequenceGapless", "protocolVersion")}
    v("every_frame_decodes", fc.get("lines", 0) > 0 and fc.get("decoded") == fc.get("lines") and fc.get("recordSequenceGapless") is True and fc.get("protocolVersion") == 6 and not s["not_frames"])
    v("no_leftover", not s["leftovers"]["processes"] and not s["leftovers"]["listeners"])

    # --- telemetry: the four members in every level, the list never empty, never going back; ratePpm null when gapped
    present = len(plan["mics"])
    lv = s["telemetry"]
    members_ok = bool(lv) and all(len(levels) == present and all(all(k in e for k in ("timelineSamples", "receivedSamples", "insertedSamples", "nonZero")) for e in levels) for levels in lv)
    mono = True
    for i, dev in enumerate(ids):
        seq = [e for levels in lv for e in levels if e["deviceId"] == dev]
        mono &= all(b["insertedSamples"] >= x["insertedSamples"] and b["timelineSamples"] >= x["timelineSamples"] and (b["nonZero"] or not x["nonZero"]) for x, b in zip(seq, seq[1:]))
    v("telemetry_states_the_account", members_ok and mono)
    rate_gapped = [e["ratePpm"] for levels in lv for e in levels for i, dev in enumerate(ids) if gapped[i] and e["deviceId"] == dev]
    rate_fifo = [e["ratePpm"] for levels in lv for e in levels for i, dev in enumerate(ids) if not gapped[i] and e["deviceId"] == dev]
    clock_lines = [l for l in log if l["message"] == "mic_clock" and gapped[l["mic"] - 1]]
    rate_warn = [w for w in s["warnings"] if w.get("reason") == "MIC_RATE_AT_LIMIT" and w.get("subject") in [x for x, g in zip(ids, gapped) if g]]
    res["no_stretch"] = {"gapped_levels": len(rate_gapped), "gapped_ratePpm_not_null": sum(1 for r in rate_gapped if r is not None), "mic_clock_lines_of_a_gapped_mic": len(clock_lines),
                         "rate_limit_warnings_of_a_gapped_mic": len(rate_warn), "pcm_fifo_levels_with_a_rate": sum(1 for r in rate_fifo if r is not None)}
    v("no_stretch_no_rate_controller", rate_gapped and all(r is None for r in rate_gapped) and not clock_lines and not rate_warn)

    if mode.get("kill") == "before":
        v("killed_before_its_first_account", not acc and not runs and not end)
        res["verdict_note"] = "no account was due: none was written, and nothing written fails to decode"
        return M.finish(res, True, a.expect_fail, d, v)

    # --- the identity, at every account (periodic ones at their own sample)
    def adds_up(r):
        return r["timelineSamples"] == r["receivedSamples"] - r["discardedSamples"] - r["bufferedSamples"] + r["insertedSamples"]
    v("account_identity_to_the_sample", bool(acc) and all(adds_up(r) for r in acc) and all(r["timelineSamples"] % PERIOD == 0 for r in periodic))
    if mode.get("kill") == "between":
        per = {dev: [r for r in periodic if r["deviceId"] == dev] for dev, g in zip(ids, gapped) if g}
        v("killed_between_two_accounts", not closing and not end and all(len(x) == 1 and x[0]["timelineSamples"] == PERIOD for x in per.values()))
        res["periodic_accounts"] = per
        return M.finish(res, True, a.expect_fail, d, v)

    x = tap_of(run_dir)
    if getattr(a, "control", None) == "dropone":
        k = len(x) // 2
        x = x[:k] + x[k + 1:]                                  # the negative vector: one sample less on the track
        res["control_note"] = "one tap sample removed at %d (in memory)" % k
    n_end = end[0]["samples"] if end else None
    v("account_closes_on_the_timeline_end", len(end) == 1 and all(dev in closing for dev, g in zip(ids, gapped) if g)
      and all(r["timelineSamples"] == n_end and r["bufferedSamples"] == 0 and r["openRunFromSample"] is None for r in closing.values()) and len(x) == n_end)
    if mode.get("kill") == "after":
        res["worker_rc"] = s["rc"]
    # --- received = what the stand-in wrote
    if not mode.get("outlive"):
        v("received_is_what_the_writer_wrote", wend is not None and all(closing[dev]["receivedSamples"] == wend["written"][i] for i, dev in enumerate(ids) if gapped[i] and dev in closing))

    # --- the track from the tap: who fed each position, the zeros, the runs
    if not iv or n_end is None:
        v("tap_zeros_are_the_inserted_ones", False)
        return M.finish(res, True, a.expect_fail, d, v)
    bounds = [(r["fromSample"], ids.index(r["deviceId"])) for r in iv] + [(n_end, None)]
    nan_at = writer.get("nan_at", -1)
    nan_pos = set()
    if nan_at >= 0:
        before, after = ((nan_at - 1) % 30000) + 1, ((nan_at + 1) % 30000) + 1
        nan_pos = {p for p in range(1, len(x) - 1) if x[p] == 0 and (x[p - 1] == before or x[p + 1] == after)}
        res["nan_positions_in_the_tap"] = sorted(nan_pos)
    fed_pos, zeros, zruns = 0, 0, []
    cur = None
    for (lo, who), (hi, _) in zip(bounds, bounds[1:]):
        for p in range(lo, min(hi, len(x))):
            if gapped[who] and x[p] == 0 and p not in nan_pos:
                zeros += 1
                if cur is None:
                    cur = [p, 0, who]
                cur[1] += 1
            else:
                if cur is not None:
                    zruns.append(cur)
                cur = None
            fed_pos += gapped[who]
        if not gapped[who] and cur is not None:              # a PCM_FIFO microphone feeding ends a run
            zruns.append(cur)
            cur = None
    if cur is not None:
        zruns.append(cur)
    sums = {k: sum(r[k] for r in closing.values()) for k in ("fedSamples", "fedInsertedSamples", "fedRuns", "listedRuns", "runsNotListed", "runsNotListedSamples")}
    long_runs = [r for r in zruns if r[1] >= RUN_MIN]
    res["tap"] = {"samples": len(x), "gapped_fed_positions": fed_pos, "zeros_there": zeros, "zero_runs": len(zruns), "runs_of_4800_or_more": len(long_runs),
                  "longest_run": max((r[1] for r in zruns), default=0), "sums_of_the_closing_accounts": sums}
    v("tap_zeros_are_the_inserted_ones", zeros == sums["fedInsertedSamples"] and fed_pos == sums["fedSamples"])
    listed = [(r["index"], r["fromSample"], r["samples"], r["deviceId"]) for r in runs]
    want = [(k + 1, r[0], r[1], ids[r[2]]) for k, r in enumerate(long_runs[:RUNS_MAX])]
    rest = long_runs[RUNS_MAX:]
    v("tap_runs_are_the_listed_runs", len(zruns) == sums["fedRuns"] and listed == want and sums["listedRuns"] == len(want)
      and sums["runsNotListed"] == len(rest) and sums["runsNotListedSamples"] == sum(r[1] for r in rest))
    if listed != want:
        res["runs_mismatch"] = {"listed_first": listed[:5], "tap_first": want[:5]}

    # --- the copy is exact: MIC-01's tap samples are written samples, in order; what is missing is accounted for
    if wend is not None and gapped[0] and ids[0] in closing:
        spans = wend["spans1"]
        starts = [sp[0] for sp in spans]
        js, disp, last, ordered, inside = [], [], None, True, True
        for (lo, who), (hi, _) in zip(bounds, bounds[1:]):
            if who != 0:
                continue
            # The marker repeats every 30,000 samples: it is placed anew at the start of every interval MIC-01 feeds (while
            # MIC-02 fed, more than 30,000 of MIC-01's samples may have passed), near where the track's clock puts it.
            prev = None
            for p in range(lo, min(hi, len(x))):
                val = x[p]
                if val <= 0:
                    continue
                m = val - 1
                # Where the track's clock puts this sample's device index: the offset (j - p) of the sample before it
                # (a stop of the writer moves the device index and the track together: the zeros fill the track), or,
                # for the first sample of an interval, the two clocks.
                guess = p + (prev[0] - prev[1] if prev else ((T0 - e0) * SR / 1e6 if T0 else 0))
                j = m + 30000 * round((guess - m) / 30000)
                k = bisect.bisect_right(starts, j) - 1
                inside &= k >= 0 and j < spans[k][0] + spans[k][1]
                ordered &= last is None or j > last
                prev, last = (j, p), j
                js.append(j)
                if T0:
                    disp.append(((T0 + p * 1e6 / SR) - (e0 + j * 1e6 / SR)) / 1000.0)
        c = closing[ids[0]]
        taken = c["timelineSamples"] - c["insertedSamples"]                           # MIC-01's samples taken into quanta
        taken_not_fed = taken - (c["fedSamples"] - c["fedInsertedSamples"])             # ... while MIC-02 fed
        written = wend["written"][0]
        res["copy"] = {"tap_samples_of_mic1": len(js), "written": written, "discarded": c["discardedSamples"], "taken_while_mic2_fed": taken_not_fed,
                       "non_finite": c["nonFiniteSamples"], "in_order": ordered, "every_one_written": inside}
        v("copy_is_exact", ordered and inside and len(js) + c["discardedSamples"] + taken_not_fed + c["nonFiniteSamples"] == written)
        if disp:
            steady = disp[len(disp) // 20:]
            q = sorted(steady)
            res["displacement_ms"] = {"what": "(T0 + p/48000) - (e0 + j/48000): where the track puts MIC-01's device sample j against its capture instant",
                                      "samples": len(steady), "min": round(q[0], 3), "p05": round(q[len(q) // 20], 3), "median": round(q[len(q) // 2], 3),
                                      "p95": round(q[len(q) * 19 // 20], 3), "max": round(q[-1], 3), "product_bound_ms": PRODUCT_BOUND_MS,
                                      "within_the_bound": max(abs(q[0]), abs(q[-1])) <= PRODUCT_BOUND_MS}

    # --- per mode
    m = s["marks"]["mode"]
    if m == "measured":
        wrote_until = (e0 + (wend["packets"] * 512 / SR) * 1e6 - T0) * SR / 1e6 if wend and T0 else 0
        v("ordinary_running_lists_no_run", not [r for r in runs if r["fromSample"] + r["samples"] < wrote_until - Q])
        # D5 pairs (row 152b): the one interval of the session is the start's, MIC-01 from sample 0; nothing moved the tap.
        v("one_start_interval_mic01", [(r["reason"], r["deviceId"], r["fromSample"]) for r in iv] == [("SESSION_START", ids[0], 0)])
        res["writer_ended_at_timeline_sample"] = round(wrote_until)
    if m == "whole":
        c = closing.get(ids[0], {})
        v("whole_pipe_nothing_inserted", c.get("insertedSamples") == 0 and all(e["insertedSamples"] == 0 for levels in lv for e in levels if e["deviceId"] == ids[0]))
        v("whole_pipe_nothing_discarded_but_the_rest", 0 <= c.get("discardedSamples", -1) <= 1920 + Q + 512)
        v("pcm_fifo_beside_it_unchanged", ids[1] not in closing and not [r for r in runs if r["deviceId"] == ids[1]] and any(r is not None for r in rate_fifo))
    if m == "late4":
        v("track_opens_on_a_listed_run_from_sample_0", bool(runs) and runs[0]["fromSample"] == 0 and runs[0]["deviceId"] == ids[0] and runs[0]["samples"] >= 3 * SR)
        v("the_replacement_is_counted", closing.get(ids[0], {}).get("discardedSamples", 0) > 0)
    if m == "trim":
        v("the_trim_before_sample_0_is_counted", closing.get(ids[1], {}).get("discardedSamples", 0) >= int(0.15 * SR))
    if m == "stop3":
        wrote_until = (e0 + (wend["packets"] * 512 / SR) * 1e6 - T0) * SR / 1e6 if wend and T0 else 0
        inside = [r for r in runs if r["fromSample"] + r["samples"] < wrote_until - Q]
        v("one_run_for_the_stop", len(inside) == 1 and int(2.8 * SR) <= inside[0]["samples"] <= int(3.1 * SR))
    if m == "nan":
        v("the_non_finite_sample_is_counted", closing.get(ids[0], {}).get("nonFiniteSamples") == 1 and len(nan_pos) == 1)
        v("long_ids_fit", all(len(levels) == 2 for levels in lv) and len(ids[0]) == 128)
    if m == "runs1025":
        v("the_bound_of_1024_listed_runs", len(runs) == RUNS_MAX and sums["listedRuns"] == RUNS_MAX and sums["runsNotListed"] >= 1 and [r["index"] for r in runs] == list(range(1, RUNS_MAX + 1)))
        v("periodic_accounts_reconcile", len(periodic) >= 2 * 3 and all(adds_up(r) for r in periodic))
    if m == "killafter":
        v("the_closing_account_is_on_the_wire", all(dev in closing for dev, g in zip(ids, gapped) if g))
    M.finish(res, True, a.expect_fail, d, v)
