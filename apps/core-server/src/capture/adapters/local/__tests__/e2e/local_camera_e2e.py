#!/usr/bin/env python3
"""Local camera helper through the REAL capture worker (blueprint row 134; capture spec A.6.4, J H-17).

  av   M4-LOCAL-AV-1  the helper's product argument list, with ONLY the avfoundation input section
                      swapped for a generated picture (FFmpeg lavfi, 1280x720 nv12 at 30 fps, one
                      white frame every 3 s), pushed into the unchanged worker, twice (two cameras:
                      one case per camera). The beeps come from the row-60 fake microphone. Judged
                      by the row-60 sample-exact analyser against a truth this script takes from
                      the GENERATOR (see "truth" below), never from the worker.
                      Also taken in every run: the socket snapshot of each helper (M4-LOCAL-WORKER-1).
  cam  M4-LOCAL-CAM-1 the same list with the real device, 10 s. USER-ATTENDED ONLY: it opens this
                      Mac's camera, macOS may ask for permission, and only the user answers. It
                      refuses to run unless DEMS_USER_ATTENDED=1. Numeric results only; the media
                      stays under git-ignored .data/ and is opened by no viewing tool.
                      THE BOUND IS REAL (pass C2, D119): the seconds are counted from the FIRST
                      RECORDED FRAME; the helper is asked to stop half a second before the bound and
                      is killed AT the bound; the audio of the session is started only when the
                      helper has connected, so the file is not longer than the camera's part by more
                      than about a second at each end. Printed, as numbers: what was recorded of the
                      camera, the file's length, how long the camera was open, and the start-up
                      intervals (`camera_run_numbers.py`).
                      `--source generated` runs the SAME steps with the generated picture in place of
                      the device (no camera, no permission; an agent may run it): the proof that the
                      bound holds. `--open-delay-s` gives the generated helper the device's start-up
                      shape; `--overrun-s` is the negative control of the bound (generated only).

Truth. The picture is generated inside the helper process, so this script cannot choose the
instant of a flash. Instead a side branch of the SAME filter graph writes, for every frame, the
wall clock at which the frame left the generator (`setpts=RTCTIME` + `metadata=print` into a
file; the main branch is untouched and gets its timestamps from the helper's own options). The
script reads the first frames, predicts when the flash frames will be generated, and schedules
each beep at (predicted flash + injected offset). After the run the truth of an event is
    beep instant (the microphone's own manifest)  -  generation instant of the flash frame (side log)
which is the injected offset to within the prediction error (reported), and exact as a truth.

This file edits nothing of the row-60 harness: it imports `apps/capture-worker/test/m3worker.py`
read-only for the worker driver, the plan, the socket helpers and the analysers.
Run with the sandbox off, under the heavy-host lock, on ports of 8559-8564:
  /usr/bin/lockf -k -t 1800 .locks/heavy-host.lock python3 <this file> av <name> --case pm80
"""
import argparse, json, os, signal, subprocess, sys, time

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, *[".."] * 8))
ALLOWED_PORTS = (8559, 8560, 8561, 8562, 8563, 8564)
FPS, PERIOD, FIRST_A, FIRST_B, EVENTS = 30, 90, 270, 315, 4          # a flash every 3 s; camera B half a period later
CASES = {"zero": (0, 0), "pm80": (80, -80)}
CLOCK_PARTS = {  # what a negative control takes out of the product list
    "wallclock": ["-use_wallclock_as_timestamps", "1"],
    "copyts": ["-copyts"],
    "offset": ["-output_ts_offset", None],
    "realtime": ["-start_time_realtime", None],
    "timing": ["-fps_mode", "passthrough", "-enc_time_base", "1/90000"],
    "fps_mode": ["-fps_mode", "passthrough"],
    "enc_time_base": ["-enc_time_base", "1/90000"],
}


def parse():
    p = argparse.ArgumentParser()
    p.add_argument("mode", choices=("av", "cam"))
    p.add_argument("name")
    p.add_argument("--case", choices=sorted(CASES), default="pm80")
    p.add_argument("--encoder", choices=("VIDEOTOOLBOX", "X264"), default="VIDEOTOOLBOX")
    p.add_argument("--ports", default="8559,8561")
    p.add_argument("--without", default="", help="comma list of %s: options removed from the product list (negative control)" % ",".join(CLOCK_PARTS))
    p.add_argument("--seconds", type=float, default=10.0, help="cam: how long the device is recorded, from the first recorded frame (at most 10)")
    p.add_argument("--source", choices=("device", "generated"), default="device", help="cam: the real camera (user-attended) or the generated picture (no device)")
    p.add_argument("--open-delay-s", type=float, default=0.0, help="cam, generated only: the helper pushes nothing for this long after its start (the shape of a device that opens slowly)")
    p.add_argument("--overrun-s", type=float, default=0.0, help="cam, generated only: stop this much AFTER the bound (negative control of the bound)")
    p.add_argument("--expect-fail", action="store_true")
    p.add_argument("--must-fail-on", default="")
    p.add_argument("--may-fail-on", default="")
    return p.parse_args()


A = parse()
ports = tuple(int(x) for x in A.ports.split(","))
if len(ports) != 2 or any(x not in ALLOWED_PORTS for x in ports):
    sys.exit("--ports must name two ports of %r" % (ALLOWED_PORTS,))
os.environ["M3_PORTS"] = A.ports
if A.mode == "cam":
    if A.seconds > 10 or A.seconds < 2:
        sys.exit("refused: a local-device test recording is 2 to 10 s")
    if A.source == "device":
        if os.environ.get("DEMS_USER_ATTENDED") != "1":
            sys.exit("refused: `cam` opens this Mac's camera. It is run by the user only (DEMS_USER_ATTENDED=1), never by an agent.")
        if A.open_delay_s or A.overrun_s:
            sys.exit("refused: --open-delay-s and --overrun-s are for the generated source only")
        os.environ["M3_RUNS"] = os.path.join(REPO, ".data", "capture-local", "runs")     # local-device media: only under git-ignored .data/
sys.dont_write_bytecode = True
sys.path.insert(0, os.path.join(REPO, "apps", "capture-worker", "test"))
import m3worker as H                                                              # noqa: E402  (read-only use)
sys.path.insert(0, HERE)
import camera_run_numbers as N                                                    # noqa: E402  (numbers of a run, from the worker's log)

H.ARGS = A
FF = os.environ.get("DEMS_CAPTURE_HELPER_FFMPEG") or "/opt/homebrew/bin/ffmpeg"


def product_lists(start_ms, urls):
    """The argument lists of the product table, printed by the table's own module."""
    r = subprocess.run(["node", "--import", "tsx", os.path.join(HERE, "print-camera-args.ts"), A.encoder, str(start_ms)] + urls, cwd=REPO, capture_output=True, text=True)
    if r.returncode != 0:
        sys.exit("the argument table could not be printed: %s" % r.stderr[-600:])
    return json.loads(r.stdout.strip().splitlines()[-1])


def without(args, parts):
    out = list(args)
    for name in parts:
        seq = CLOCK_PARTS[name]
        for i in range(len(out) - len(seq) + 1):
            if all(s is None or out[i + j] == s for j, s in enumerate(seq)) and out[i] == seq[0]:
                del out[i:i + len(seq)]
                break
        else:
            sys.exit("--without %s: not in the product list" % name)
    return out


def generated_input(first, side_log):
    graph = ("color=c=black:s=1280x720:r=%d,realtime,"
             "drawbox=x=0:y=0:w=iw:h=ih:color=white:t=fill:enable='between(n,%d,%d)*eq(mod(n-%d,%d),0)',"
             "format=nv12,settb=1/1000000,split[out0][side];"
             "[side]setpts=RTCTIME,metadata=mode=add:key=w:value=1,metadata=mode=print:file=%s:direct=1,nullsink") % (
                 FPS, first, first + PERIOD * (EVENTS - 1), first, PERIOD, side_log)
    return ["-f", "lavfi", "-use_wallclock_as_timestamps", "1", "-i", graph]


def side_frames(path):
    """{frame number: generation instant in microseconds} from the generator's side log."""
    out = {}
    if os.path.exists(path):
        for line in open(path, errors="replace"):
            if line.startswith("frame:"):
                f = line.split()
                try:
                    out[int(f[0].split(":")[1])] = int(f[1].split(":")[1])
                except (IndexError, ValueError):
                    pass
    return out


def helper_sockets(pid, port):
    rows = [l for l in H.sh(["lsof", "-nP", "-a", "-p", str(pid), "-i"]).stdout.splitlines()[1:] if l.strip()]
    tcp = [l for l in rows if " TCP " in l]
    ends = [H.endpoints(l) for l in tcp]
    return {"rows": len(rows), "listening": len([l for l in rows if "(LISTEN)" in l]), "udp": len([l for l in rows if " UDP " in l]), "tcp": len(tcp),
            "tcp_all_loopback": all(h == "127.0.0.1" for e in ends for h, _ in e), "tcp_to_plan_port": len([e for e in ends if len(e) == 2 and e[1][1] == str(port)])}


def decodes(path):
    """Playable, for a source whose frames carry the time they were READ (not a fixed grid): every stream
    decodes without one error line WITH THE FILE'S TIMESTAMPS PASSED THROUGH, the boxes tile the file, both
    streams hold frames. The row-60 `playable()` is reported beside it and not judged here: its decode
    pass lets the null muxer re-time the video onto a fixed frame grid, and two frames read less than a
    frame period apart then collide on that grid (a warning of the check's own output, not of the file)."""
    ok60, p = H.playable(path)
    dec = H.sh([H.FF, "-v", "error", "-xerror", "-i", path, "-map", "0", "-fps_mode", "passthrough", "-enc_time_base", "demux", "-f", "null", "-"])
    pts = [int(x) for x in H.P111.out([H.FP, "-v", "error", "-select_streams", "v:0", "-show_entries", "packet=pts", "-of", "csv=p=0", path]).decode().split()]
    deltas = sorted((b - a) / 90.0 for a, b in zip(pts[1:], pts[2:]))          # after the first frame (the start-up gap is reported apart)
    shape = sorted((s[0], s[1]) for s in p["streams"]) == [("audio", "aac"), ("video", "h264")]
    ok = dec.returncode == 0 and dec.stderr.strip() == "" and shape and p["decoded_frames"].get("video", 0) > 0 and p["decoded_frames"].get("audio", 0) > 0 and p["tiles_exactly"] and all(d > 0 for d in deltas)
    return ok, {"bytes": p["bytes"], "decoded_frames": p["decoded_frames"], "decode_error_lines_timestamps_passed_through": len([l for l in dec.stderr.splitlines() if l.strip()]),
                "tiles_exactly": p["tiles_exactly"], "video_timestamps_strictly_increasing": all(d > 0 for d in deltas),
                "video_frame_interval_ms_min_median_max": [round(deltas[0], 2), round(deltas[len(deltas) // 2], 2), round(deltas[-1], 2)] if deltas else None,
                "gap_after_first_frame_ms": round((pts[1] - pts[0]) / 90.0, 1) if len(pts) > 1 else None,
                "row60_playable_fixed_grid_check": ok60, "row60_decode_error_lines": p["decode_error_lines"], "playable": ok}


def stop_helpers(helpers):
    rc = []
    for p in helpers:
        if p.poll() is None:
            p.send_signal(signal.SIGTERM)                       # FFmpeg ends the RTSP session with TEARDOWN (HL-8)
    for p in helpers:
        try:
            rc.append(p.wait(timeout=3))
        except subprocess.TimeoutExpired:
            p.kill()
            rc.append("killed after 3 s")
    return rc


def start_worker(d, sid, cams, listen_timeout_s=15):
    plan = H.make_plan(d, sid, cams=cams)
    plan["constants"]["gopFrames"] = FPS
    w = H.Worker(d, H.WORKER, listen_timeout_s=listen_timeout_s)
    w.wait(lambda f: f.get("type") == "HELLO", 5, "HELLO")
    ack = w.ack(w.command(sid, "START", attempt=1, plan=plan))[1]
    if not ack["ok"]:
        sys.exit("the worker refused the plan: %r" % ack)
    t = time.monotonic()
    while len(H.tcp_listeners()) < cams and time.monotonic() - t < 5:
        time.sleep(0.05)
    return w, plan


def stop_worker(w, sid):
    if w.p.poll() is None:
        try:
            w.ack(w.command(sid, "STOP", reason="STOPPED"))
        except (RuntimeError, BrokenPipeError):
            pass
    return w.exit(20)


def worker_said(d, w):
    log = H.worker_log(d)
    return {"no_camera_wall_clock_lines": len([l for l in log if l.get("message") == "no_camera_wall_clock" or l.get("code") == "no_camera_wall_clock" or "no_camera_wall_clock" in json.dumps(l)]),
            "warnings": [f.get("code") for _, f in w.of("WARNING")], "crash": [f.get("code") for _, f in w.of("CRASH")]}


# ------------------------------------------------------------------------------------------ M4-LOCAL-AV-1
def cmd_av():
    d = H.rundir(A.name, fresh=True)
    sid = "S-L134-%s" % A.name.upper().replace("_", "-")[-36:].strip("-")
    if H.tcp_listeners():
        sys.exit("ports busy before start: %r" % H.tcp_listeners())
    v, info, procs = H.Crit(), {"load_1m": round(os.getloadavg()[0], 2), "check": "M4-LOCAL-AV-1", "case": A.case, "encoder": A.encoder, "without": A.without or None, "ports": list(ports)}, []
    w, plan = start_worker(d, sid, 2)
    procs.append(w.p)
    helpers, logs = [], [os.path.join(d, "gen%d.txt" % (i + 1)) for i in range(2)]
    try:
        start_ms = time.time_ns() // 1_000_000                                   # S: the wall clock at the start of the helpers
        lists = product_lists(start_ms, [c["ingestUrl"] for c in plan["cameras"]])
        q, n_in = lists["quietLength"], lists["deviceInputLength"]
        argvs = []
        for i, product in enumerate(lists["push"]):
            tail = product[q + n_in:]                                            # everything after the input section: the product's, untouched
            argv = product[:q] + generated_input((FIRST_A, FIRST_B)[i], logs[i]) + tail
            argvs.append(without(argv, [x for x in A.without.split(",") if x]))
        info["product_tail"] = lists["push"][0][q + n_in:-1] + ["<ingestUrl>"]
        info["s_ms_age_at_spawn"] = time.time_ns() // 1_000_000 - int(lists["push"][0][lists["push"][0].index("-start_time_realtime") + 1]) // 1000
        for i, argv in enumerate(argvs):
            helpers.append(H.spawn([FF] + argv, stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=open(os.path.join(d, "helper%d.err" % (i + 1)), "w"), env={}))
        procs.extend(helpers)
        # The first frames of each generator: where its frame grid sits on the wall clock.
        t = time.monotonic()
        grids = [{}, {}]
        while time.monotonic() - t < 8 and any(len(g) < 45 for g in grids):
            time.sleep(0.1)
            grids = [side_frames(p) for p in logs]
        if any(len(g) < 45 for g in grids):
            v("generators_run", False)
            raise RuntimeError("a generator produced no frames: %r" % [len(g) for g in grids])
        beeps, plan_events = [], []
        for i, g in enumerate(grids):
            n0 = max(g)
            first = (FIRST_A, FIRST_B)[i]
            evs = []
            for j in range(EVENTS):
                k = first + PERIOD * j
                predicted = g[n0] + (k - n0) * 1_000_000 // FPS
                at = predicted + CASES[A.case][i] * 1000
                evs.append({"frame": k, "predicted_flash_us": predicted, "beep_at_us": at})
                beeps.append(at)
            plan_events.append(evs)
        beeps.sort()
        info["beep_spacing_min_ms"] = round(min(b - a for a, b in zip(beeps, beeps[1:])) / 1000, 1)
        if not v("events_far_enough_apart", info["beep_spacing_min_ms"] >= 600):
            raise RuntimeError("the two cameras' events are closer than 600 ms: rerun")
        lead = (beeps[0] - time.time_ns() // 1000) / 1e6
        if not v("beeps_scheduled_ahead", lead > 2.5):
            raise RuntimeError("the first beep is only %.2f s ahead" % lead)
        mic_seconds = (beeps[-1] - time.time_ns() // 1000) / 1e6 + 4.0
        mic = H.spawn([H.MIC, "--out1", plan["mics"][0]["input"]["path"], "--out2", plan["mics"][1]["input"]["path"], "--manifest", os.path.join(d, "mic.jsonl"),
                       "--seconds", "%.3f" % mic_seconds, "--beep-at-us", ",".join(str(b) for b in beeps)], stdin=subprocess.DEVNULL, stderr=open(os.path.join(d, "mic.err"), "w"))
        procs.append(mic)
        time.sleep(max(0.0, lead - 1.0))
        info["helper_sockets"] = [helper_sockets(p.pid, ports[i]) for i, p in enumerate(helpers)]     # mid-session, both pushing
        info["worker_sockets_clean"] = H.sockets_clean(H.own_sockets())
        time.sleep(max(0.0, (beeps[-1] - time.time_ns() // 1000) / 1e6) + 2.0)
        info["helpers_alive_at_stop"] = [p.poll() is None for p in helpers]
        info["helper_rc"] = stop_helpers(helpers)
        time.sleep(1.0)
        info["worker_rc"] = stop_worker(w, sid)
    except RuntimeError as e:
        info["error"] = str(e)
    finally:
        H.killall(procs)
    time.sleep(0.3)
    info["leftovers"] = H.leftovers()
    info["helper_diagnostic_lines"] = [len([l for l in open(os.path.join(d, "helper%d.err" % (i + 1)), errors="replace") if l.strip()]) if os.path.exists(os.path.join(d, "helper%d.err" % (i + 1))) else None for i in range(2)]
    info["worker"] = worker_said(d, w)
    paths = [c["outputPath"] for c in plan["cameras"]]
    if "error" not in info:
        # Truth from the generator's side log and the microphone's manifest.
        grids = [side_frames(p) for p in logs]
        cams, pred = [], []
        for i, evs in enumerate(plan_events):
            rows = []
            for e in evs:
                made = grids[i].get(e["frame"])
                if made is None:
                    continue
                rows.append({"frame": e["frame"], "beep_at_us": e["beep_at_us"], "truth_offset_us": e["beep_at_us"] - made})
                pred.append(abs(made - e["predicted_flash_us"]) / 1000.0)
            cams.append({"cam": i + 1, "port": ports[i], "inject_ms": CASES[A.case][i], "drift_ppm": 0.0, "events": rows, "frames": max(grids[i]) + 1 if grids[i] else 0})
        truth = {"case": A.case, "gop": FPS, "cams": cams}
        json.dump(truth, open(os.path.join(d, "truth.json"), "w"), indent=1)
        info["flash_prediction_error_ms_max"] = round(max(pred), 3) if pred else None
        v("every_flash_frame_was_generated", all(len(c["events"]) == EVENTS for c in cams))
        v("worker_reports_no_missing_wall_clock", info["worker"]["no_camera_wall_clock_lines"] == 0 and not info["worker"]["crash"])
        v("helpers_ran_until_stopped", all(info.get("helpers_alive_at_stop", [False])))
        s = info.get("helper_sockets", [])
        v("helper_no_listening_socket", len(s) == 2 and all(x["listening"] == 0 for x in s))
        v("helper_no_datagram_socket", len(s) == 2 and all(x["udp"] == 0 for x in s))
        v("helper_one_tcp_connection_to_loopback_plan_port", len(s) == 2 and all(x["tcp"] == 1 and x["rows"] == 1 and x["tcp_all_loopback"] and x["tcp_to_plan_port"] == 1 for x in s))
        v("worker_sockets_loopback_only", info.get("worker_sockets_clean") is True)
        v("no_leftover_process", not info["leftovers"]["processes"] and not info["leftovers"]["listeners"])
        files_ok = all(os.path.exists(p) and os.path.getsize(p) > 0 for p in paths)
        if v("both_files_written", files_ok):
            play = [decodes(p) for p in paths]
            info["files"] = [x[1] for x in play]
            v("both_files_playable", all(x[0] for x in play))
            try:
                reg, prod, detail = H.av_offsets(d, truth, paths)
            except AssertionError as e:
                reg, prod, detail = False, False, {"error": "the analyser refused the file: %s" % (e,)}
            info["av"] = {k: ({kk: vv for kk, vv in x.items() if kk in ("inject_ms", "events_judged", "mean_offset_ms", "max_abs_error_vs_truth_ms", "sign_correct", "regression_bound", "product_bound_40ms", "error", "flashes_in_file", "events_expected", "video_frames")} |
                              ({"events": [{"frame": r["frame"], "offset_ms": r["offset_ms"], "truth_ms": r["truth_ms"], "error_ms": r["error_ms"]} for r in x.get("events", [])]})) if isinstance(x, dict) else x for k, x in detail.items()}
            v("regression_bound_2ms", reg)
            v("product_bound_40ms", prod)
            ki = [H.P111.keyframe_intervals(p) for p in paths]
            info["keyframe_intervals_frames"] = [sorted(set(k["intervals"])) for k in ki]
            v("keyframe_interval_at_most_2s", all(k["intervals"] and max(k["intervals"]) <= 2 * FPS for k in ki))
        else:
            v("regression_bound_2ms", False)
            v("product_bound_40ms", False)
    H.finish(info, "error" not in info, expect_fail=A.expect_fail, d=d, crit=v)


# ------------------------------------------------------------------------------------------ M4-LOCAL-CAM-1 (user-attended)
STOP_LEAD_S = 0.5            # the helper is ASKED to stop this long before the bound ...
BOUND_MARGIN_S = 0.25        # ... is killed AT the bound, and is judged gone within this margin after it
FILE_MARGIN_S = 2.0          # the file may be this much longer than the bound (audio before the first recorded frame and after the stop)
OPEN_WAIT_S = 60             # the device open may wait for the user's answer to the macOS question


def now_us():
    return time.time_ns() // 1000


def sleep_until_us(at_us):
    while True:
        left = (at_us - now_us()) / 1e6
        if left <= 0:
            return
        time.sleep(min(left, 0.05))


def stop_at_bound(helper, bound_us):
    """SIGTERM half a second before the bound (FFmpeg ends the RTSP session with TEARDOWN, HL-8), SIGKILL AT the bound.
    Returns (exit status, how it ended, the wall clock at which the helper was gone)."""
    sleep_until_us(bound_us - int(STOP_LEAD_S * 1e6))
    how = "ended by itself"
    if helper.poll() is None:
        helper.send_signal(signal.SIGTERM)
        how = "SIGTERM"
    while helper.poll() is None and now_us() < bound_us:
        time.sleep(0.005)
    if helper.poll() is None:
        helper.kill()
        how = "SIGKILL at the bound"
    rc = helper.wait()
    return rc, how, now_us()


def progress_numbers(path):
    """The helper's progress report (the signal of the product's no-frame bound): how many blocks, the last frame count."""
    blocks, last = 0, None
    if os.path.exists(path):
        for line in open(path, errors="replace"):
            if line.startswith("progress="):
                blocks += 1
            elif line.startswith("frame="):
                try:
                    last = int(line.split("=", 1)[1])
                except ValueError:
                    pass
    return {"blocks": blocks, "last_frame_count": last}


def cmd_cam():
    generated = A.source == "generated"
    d = H.rundir(A.name, fresh=generated)
    if not generated and os.path.exists(os.path.join(d, "media")):
        sys.exit("refused: %s exists already. Nothing is overwritten or deleted; choose another name." % d)
    sid = "S-L134-%s" % A.name.upper().replace("_", "-")[-36:].strip("-")
    if H.tcp_listeners():
        sys.exit("ports busy before start: %r" % H.tcp_listeners())
    v, info, procs = H.Crit(), {"check": "M4-LOCAL-CAM-1", "source": A.source, "encoder": A.encoder, "ports": list(ports), "seconds": A.seconds}, []
    lists = product_lists(time.time_ns() // 1_000_000, ["rtsp://127.0.0.1:%d/cam1" % ports[0]])
    if not generated:
        # The exact-name rule, on the list (listing opens no device).
        listed = subprocess.run([FF] + lists["list"], capture_output=True, text=True, env={}).stderr
        video, section = [], None
        for line in listed.splitlines():
            if line.rstrip().endswith("AVFoundation video devices:"):
                section = "v"
            elif line.rstrip().endswith("AVFoundation audio devices:"):
                section = "a"
            elif section == "v" and "] [" in line:
                video.append(line.split("] ", 2)[2] if line.count("] ") >= 2 else "")
        name = lists["deviceName"]
        info["video_devices_listed"] = len(video)
        if not v("exactly_one_entry_equals_the_name", video.count(name) == 1 and len([x for x in video if x.startswith(name)]) == 1):
            info["named_error"] = "DEVICE_NOT_FOUND"
            H.finish(info, False, d=d, crit=v)
    w, plan = start_worker(d, sid, 1, listen_timeout_s=OPEN_WAIT_S + 15)      # the user may need time to answer the macOS question
    procs.append(w.p)
    first_frame_us = spawn_us = gone_us = None
    try:
        start_ms = time.time_ns() // 1_000_000
        product = product_lists(start_ms, [plan["cameras"][0]["ingestUrl"]])
        argv = product["push"][0]
        if generated:
            q, n_in = product["quietLength"], product["deviceInputLength"]
            argv = argv[:q] + generated_input(FIRST_A, os.path.join(d, "gen1.txt")) + argv[q + n_in:]     # everything after the input section: the product's
        spawn_us = now_us()
        if generated and A.open_delay_s > 0:
            time.sleep(A.open_delay_s)                              # a device that needs this long to open: nothing is pushed meanwhile
        helper = H.spawn([FF] + argv, stdin=subprocess.DEVNULL, stdout=open(os.path.join(d, "helper1.progress"), "w"), stderr=open(os.path.join(d, "helper1.err"), "w"), env={})
        procs.append(helper)
        # 1. Until the helper holds its connection to the worker (the device is open and a frame is on its way). Nothing is recorded yet:
        #    the session's audio, and with it file time 0, starts only now, so the file does not begin seconds before the camera does.
        t, told, connected = time.monotonic(), False, False
        while time.monotonic() - t < OPEN_WAIT_S and helper.poll() is None:
            if helper_sockets(helper.pid, ports[0])["tcp_to_plan_port"] == 1:
                connected = True
                break
            if not told and time.monotonic() - t > 8:
                told = True
                print("no frame from the camera after 8 s. If no macOS question is visible, the app that started this command is not being asked: stop with Ctrl-C and run it from the Terminal app.", file=sys.stderr, flush=True)
            time.sleep(0.05)
        info["helper_alive_after_open"] = helper.poll() is None
        info["helper_connected_after_ms"] = round((now_us() - spawn_us) / 1000.0, 1) if connected else None
        if connected:
            mic = H.spawn([H.MIC, "--out1", plan["mics"][0]["input"]["path"], "--out2", plan["mics"][1]["input"]["path"], "--manifest", os.path.join(d, "mic.jsonl"), "--seconds", "%.3f" % (A.seconds + 30)],
                          stdin=subprocess.DEVNULL, stderr=open(os.path.join(d, "mic.err"), "w"))
            procs.append(mic)
            # 2. Until the first frame is IN the file: the worker says so in its log, with the frame's own time.
            t = time.monotonic()
            while time.monotonic() - t < 10 and helper.poll() is None and first_frame_us is None:
                first_frame_us = N.startup_numbers(H.worker_log(d))["first_recorded_frame_us"]
                time.sleep(0.02)
        if first_frame_us is not None:
            # 3. The bound, counted from that frame. One socket snapshot on the way (it takes a moment and must not move the stop).
            bound_us = first_frame_us + int((A.seconds + (A.overrun_s if generated else 0.0)) * 1e6)
            if now_us() < bound_us - int(2.5e6):
                time.sleep(1.0)
                info["helper_sockets"] = helper_sockets(helper.pid, ports[0])
            rc, how, gone_us = stop_at_bound(helper, bound_us)
            info["helper_rc"], info["helper_stop"] = [rc], how
        else:
            info["helper_rc"] = stop_helpers([helper])
            info["helper_stop"] = "no first frame: stopped"
        time.sleep(0.2)
        info["worker_rc"] = stop_worker(w, sid)
    finally:
        H.killall(procs)
    time.sleep(0.3)
    info["leftovers"] = H.leftovers()
    err = open(os.path.join(d, "helper1.err"), errors="replace").read()
    # Counts only: the text stays in the run folder under .data/ for the pattern work of H-18.
    info["helper_diagnostic_lines"] = len([l for l in err.splitlines() if l.strip()])
    info["helper_progress"] = progress_numbers(os.path.join(d, "helper1.progress"))
    info["worker"] = worker_said(d, w)
    numbers = N.startup_numbers(H.worker_log(d), spawn_us, gone_us)
    info["start_up"] = {k: numbers[k] for k in ("helper_spawn_to_first_frame_stamp_ms", "first_frame_stamp_to_first_recorded_frame_ms", "audio_before_first_recorded_frame_ms",
                                                "audio_before_first_frame_stamp_ms", "frames_before_the_first_recorded_one", "dropped", "video_packets_written")}
    path = plan["cameras"][0]["outputPath"]
    v("helper_opened_the_device_and_pushed", info.get("helper_alive_after_open") is True and bool(w.of("RECORD")))
    s = info.get("helper_sockets")
    v("helper_holds_only_one_loopback_tcp_connection", bool(s) and s["listening"] == 0 and s["udp"] == 0 and s["tcp"] == 1 and s["rows"] == 1 and s["tcp_all_loopback"] and s["tcp_to_plan_port"] == 1)
    v("worker_reports_no_missing_wall_clock", info["worker"]["no_camera_wall_clock_lines"] == 0)
    v("no_leftover_process", not info["leftovers"]["processes"] and not info["leftovers"]["listeners"])
    v("helper_progress_reported_frames", (info["helper_progress"]["last_frame_count"] or 0) > 0)
    dur = None
    if v("file_written", os.path.exists(path) and os.path.getsize(path) > 0):
        ok, p = decodes(path)
        v("file_playable", ok)
        info["file_checks"] = {k: p[k] for k in p if k not in ("bytes", "decoded_frames")}
        info["first_frame_gap"] = N.decompose_gap(p.get("gap_after_first_frame_ms"), numbers)
        ki = H.P111.keyframe_intervals(path)
        dur = json.loads(H.P111.out([H.FP, "-v", "error", "-show_entries", "format=duration", "-of", "json", path]))["format"].get("duration")
        info["file"] = {"path": os.path.relpath(path, REPO), "bytes": p["bytes"], "duration_s": dur, "decoded_frames": p["decoded_frames"], "keyframes": ki["keyframes"],
                        "keyframe_intervals_frames": sorted(set(ki["intervals"])), "sha256": H.sh(["shasum", "-a", "256", path]).stdout.split()[0]}
        v("keyframe_interval_at_most_2s", bool(ki["intervals"]) and max(ki["intervals"]) <= 2 * FPS)
    # The promise of the step, on the true numbers: what was recorded of the camera, and the file's length.
    info["recording"] = dict(N.bound_verdict(numbers, A.seconds, dur, BOUND_MARGIN_S, FILE_MARGIN_S), camera_open_s_upper_bound=numbers["camera_open_s_upper_bound"])
    v("recording_at_most_10s_plus_margin", info["recording"]["pass"])
    info["note"] = "numeric results only; the media under .data/ is opened by no viewing tool and deleted only on the user's instruction"
    H.finish(info, True, expect_fail=A.expect_fail, d=d, crit=v)


(cmd_av if A.mode == "av" else cmd_cam)()
