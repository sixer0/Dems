#!/usr/bin/env python3
"""Task 4 blueprint row 176 (WP-11b; BR-05 of verification/05_security_branch_b.md): a client that completes the
RTSP handshake through RECORD with the parameter sets in its description, sends NO media and closes must end THAT
camera's ingest as a fault - not the worker. Test code only.

It is the verification of ONE row, run by hand; the permanent case in the worker's own series is rows 142 / 178
(they may take it from here). Every run is one worker session of e11_listener_path.py (imported, not edited: two
cameras, two FIFO microphones, the FFmpeg pusher); the handshake-then-close client is `raw_client` of
e11b_announced_path.py (imported, not edited: case A of test/007).

    # repository root, command sandbox off (binds two loopback ports, reads ps / lsof); `make proof` first
    M3_PORTS=8559,8561 /usr/bin/lockf -k -t 1800 .locks/heavy-host.lock \
        python3 apps/capture-worker/test-fixtures/row176_camera_end.py all
    ... row176_camera_end.py close [--runs 3] | hold | setupfail | writefault | summary

Cases
  close       camera 1 gets the handshake-then-close client on its RIGHT address, camera 2 a normal push at the
              same moment. Required: the worker stays up and ends 0 at STOP; no CRASH frame, no
              OUTPUT_SETUP_FAILED; camera 1: no `ingest_connected`, 0 bytes, ONE log line INGEST_NO_PICTURE_SIZE
              and ONE frame CAPTURE_FAULT for its device; camera 2: its file is complete, decodes without an
              error, and holds the session audio.
  hold        the same client on camera 2, but it HOLDS the connection past the ingest window + 10 s before it
              closes: the camera is given up once (INGEST_OPEN_STUCK) and the late end adds no second frame.
  setupfail   THE FATAL PATH THAT STAYS: a build made by this script whose muxer is handed an option it does not
              know (so open_output fails for streams that HAVE media and a picture size), both cameras pushed
              normally: the worker must still end 70 with OUTPUT_SETUP_FAILED.
  writefault  the existing proof build `capture-worker-writefault` (the write of fragment 3 of camera 1 fails),
              both cameras pushed normally: a failure of the writer must still end the worker (exit 70).

Addresses are synthetic and of this script only; none is printed. A result holds the counts of every path text of
its run in what the worker wrote (log and standard output): 0 is required.
Everything a run writes lands under .cache/row176-camera-end/ (git-ignored), the build of `setupfail` too."""
import json, os, subprocess, sys, time

sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
OUT = os.path.join(REPO, ".cache", "row176-camera-end")
os.environ.setdefault("M3_PORTS", "8559,8561")
os.environ["E11_OUT"] = OUT
sys.path.insert(0, HERE)
import e11_listener_path as E                            # read-only reuse: session, pusher (imported FIRST: it fixes the output folder)
import e11b_announced_path as B                          # read-only reuse: raw_client and the description of case A
H = E.H

E.RIGHT = ("g176/Vt4mQ8xLr2Nc7Kd9", "g176/Zb3hJ6wYp1Fs5Ue0")   # the plan's two addresses of every session of this script
CODE = "INGEST_NO_PICTURE_SIZE"
FRAMES, GOP, FPS = E.FRAMES, E.GOP, E.FPS                # 200 frames at 25 per second, one keyframe a second
COMPLETE_FRAMES = FRAMES - GOP                           # what a complete file of this push holds (test/007: 175 of 200)
WRITEFAULT = os.path.join(H.BUILD, "capture-worker-writefault")
SETUPFAIL = os.path.join(OUT, "bin", "capture-worker-row176-setupfail")
APP = os.path.join(REPO, "apps", "capture-worker")
SRC = ["src/capture_worker.c", "src/ipc.c", "src/sink.c", "src/ingest.c", "src/audio.c", "src/anchor.c", "src/micwatch.c", "src/announce.c"]   # the Makefile's SRC
LIBS_PC = ["libavformat", "libavcodec", "libavfilter", "libswresample", "libavutil"]


def build_setupfail():
    """The worker with the Makefile's flags and ONE proof switch: the muxer is handed an option no muxer knows, so
    avformat_write_header leaves it over and open_output answers AVERROR_OPTION_NOT_FOUND - for every camera,
    whatever it delivered. The binary says -PROOF in HELLO and lives under .cache/ only."""
    os.makedirs(os.path.dirname(SETUPFAIL), exist_ok=True)
    cflags = subprocess.run(["pkg-config", "--cflags"] + LIBS_PC, capture_output=True, text=True, check=True).stdout.split()
    libs = subprocess.run(["pkg-config", "--libs"] + LIBS_PC, capture_output=True, text=True, check=True).stdout.split()
    cmd = ["clang", "-std=c11", "-O2", "-g", "-Wall", "-Wextra", "-Werror"] + cflags + ['-DDEMS_PROOF_MUX_EXTRA="row176_no_such_option=1"', "-o", SETUPFAIL] + SRC + libs + ["-lm", "-lpthread"]
    r = subprocess.run(cmd, cwd=APP, capture_output=True, text=True)
    if r.returncode:
        sys.exit("the setupfail build failed:\n%s" % r.stderr[-2000:])


def media_facts(path):
    """What the file holds: video frames read, audio packets read, and whether the whole file decodes without an error."""
    out = {"bytes": os.path.getsize(path) if os.path.exists(path) else 0}
    if not out["bytes"]:
        return out
    for key, sel in (("video", "v:0"), ("audio", "a:0")):
        r = H.sh([E.FP, "-v", "error", "-count_packets", "-count_frames", "-select_streams", sel, "-show_entries", "stream=codec_name,nb_read_frames,nb_read_packets,sample_rate,channels", "-of", "json", path])
        try:
            st = json.loads(r.stdout)["streams"]
            out[key] = st[0] if st else None
        except (ValueError, KeyError):
            out[key] = None
        out[key + "_probe_stderr"] = r.stderr.strip()[:200]
    d = H.sh([E.FF, "-hide_banner", "-nostdin", "-v", "error", "-i", path, "-f", "null", "-"])
    out["decode_rc"], out["decode_stderr"] = d.returncode, d.stderr.strip()[:300]
    return out


def count(stream, key):
    try:
        return int((stream or {}).get(key) or 0)
    except (TypeError, ValueError):
        return 0


def run(name, kind, test_index, make_test, binary=None, listen_s=E.LISTEN_S):
    """One session. `make_test(ctx, port, right)` acts on the camera under test (None: both cameras get a normal
    push); the control push to the other camera is started first, in the same moment."""
    port, right = H.PORTS[test_index], E.RIGHT[test_index]
    cport, cright = H.PORTS[1 - test_index], E.RIGHT[1 - test_index]
    release = H.WORKER
    if binary:
        H.WORKER = binary

    def script(ctx):
        c = E.Push(ctx["d"], "control", cport, cright, ctx["t0"])
        if make_test:
            t = make_test(ctx, port, right)
        else:
            p = E.Push(ctx["d"], "test", port, right, ctx["t0"])
            p.wait()
            f = p.facts()
            t = {"pusher": "ffmpeg", "rc": f["rc"], "requests_sent_with_status": f["requests_sent_with_status"]}
        c.wait()
        return {"observation": "ROW176", "case": kind, "port_under_test": port, "test_push": t, "control": c.facts(), "paths_used": [right, cright],
                "worker_alive_when_script_ended": ctx["worker"].p.poll() is None}

    try:
        r = E.session(name, script, listen_s=listen_s)
    finally:
        H.WORKER = release
    d = os.path.join(OUT, "runs", name)
    log = H.worker_log(d)
    plan_dev = {port: "CAM-0%d" % (test_index + 1), cport: "CAM-0%d" % (2 - test_index)}
    media = {p: media_facts(os.path.join(d, "media", r["files"][str(p)]["file"])) for p in (port, cport)}
    r["media"] = {str(p): m for p, m in media.items()}
    msgs = lambda m, p=None: [l for l in log if l.get("message") == m and (p is None or l.get("port") == p)]
    ic = lambda p: sum(1 for c in r["worker_ingest_connected"] if c["port"] == p)
    warnings = [f for f in r["worker_frames_other"] if f.get("type") == "WARNING"]
    summary = {l.get("cam"): l for l in log if l.get("message") == "camera_summary"}
    exit_line = next((l for l in log if l.get("message") == "worker_exit"), {})
    side = lambda p: {"port": p, "device": plan_dev[p], "ingest_connected": ic(p), "bytes": media[p]["bytes"], "video_frames": count(media[p].get("video"), "nb_read_frames"),
                      "audio_packets": count(media[p].get("audio"), "nb_read_packets"), "audio_codec": (media[p].get("audio") or {}).get("codec_name"), "decode_rc": media[p].get("decode_rc"),
                      "decode_stderr": media[p].get("decode_stderr"), "code_lines": len(msgs(CODE, p)), "code_lines_already_given_up": sum(1 for l in msgs(CODE, p) if l.get("already_given_up")),
                      "stuck_lines": len(msgs("INGEST_OPEN_STUCK", p)), "fault_frames": [[f.get("code"), f.get("reason"), f.get("state")] for f in warnings if f.get("subject") == plan_dev[p]]}
    f = r["facts"] = {"test": side(port), "control": side(cport), "worker_rc": r.get("worker_rc"), "stop_ack": r.get("stop_ack"), "worker_alive_when_script_ended": r.get("worker_alive_when_script_ended"),
                      "worker_exit_code": exit_line.get("code"), "crash_frames": [f.get("code") for f in r["worker_frames_other"] if f.get("type") == "CRASH"],
                      "output_setup_failed_lines": len(msgs("OUTPUT_SETUP_FAILED")), "hello_version": (r.get("hello") or {}).get("workerVersion") or (r.get("hello") or {}).get("version"),
                      "statuses": [x[-1] for x in r["test_push"].get("requests_sent_with_status", [])],
                      "control_summary": {k: (summary.get(2 - test_index) or {}).get(k) for k in ("video_packets", "audio_packets", "fragments", "durable_fragments", "bytes")},
                      "path_text_occurrences": sum(r["path_text_in_worker_output"].values()), "leftovers": len(r["leftovers"]["processes"]) + len(r["leftovers"]["listeners"])}
    t, c = f["test"], f["control"]
    # The audio of a complete file spans at least the video it holds: 1,024 samples a packet at 48,000 a second.
    audio_s, video_s = c["audio_packets"] * 1024 / 48000.0, c["video_frames"] / float(FPS)
    f["control_audio_s"], f["control_video_s"] = round(audio_s, 2), round(video_s, 2)
    crit = {"no_path_text_in_worker_output": f["path_text_occurrences"] == 0, "no_leftover": f["leftovers"] == 0}
    if kind in ("close", "hold"):
        crit.update({
            "handshake_200_through_record": f["statuses"] == [200, 200, 200, 200],
            "worker_alive_after_the_client_closed": f["worker_alive_when_script_ended"] is True,
            "stop_acknowledged_and_exit_0": f["stop_ack"] is True and f["worker_rc"] == 0,
            "no_crash_frame_no_output_setup_failed": not f["crash_frames"] and f["output_setup_failed_lines"] == 0,
            "camera_under_test_no_connect_0_bytes": t["ingest_connected"] == 0 and t["bytes"] == 0,
            # Row 182: the frame names the cause. `close`: no picture. `hold`: the camera was given up first (its one frame), and the late end says nothing more.
            "camera_under_test_one_fault_frame": t["fault_frames"] == [["CAPTURE_FAULT", "CAMERA_NO_PICTURE" if kind == "close" else "CAMERA_NOT_CONNECTED", "ACTIVE"]],
            "control_connected_no_fault": c["ingest_connected"] == 1 and c["code_lines"] == 0 and not [x for x in c["fault_frames"] if x[1] in ("CAMERA_NOT_CONNECTED", "CAMERA_NO_PICTURE", "CAMERA_CLOCK_OUT_OF_BOUND")],
            "control_file_complete": c["video_frames"] >= COMPLETE_FRAMES and f["control_summary"]["fragments"] == f["control_summary"]["durable_fragments"] and f["control_summary"]["bytes"] == c["bytes"] > 0,
            "control_file_decodes": c["decode_rc"] == 0 and not c["decode_stderr"],
            "control_file_holds_the_audio": c["audio_codec"] == "aac" and audio_s >= video_s,
        })
        if kind == "close":
            crit["named_code_once"] = t["code_lines"] == 1 and t["code_lines_already_given_up"] == 0 and t["stuck_lines"] == 0
        else:
            crit["given_up_once_then_named_without_a_second_frame"] = t["stuck_lines"] == 1 and t["code_lines"] == 1 and t["code_lines_already_given_up"] == 1
    else:
        crit.update({
            "proof_build_says_so": str(f["hello_version"]).endswith("-PROOF"),
            "worker_exit_70": f["worker_rc"] == 70,
            "crash_frame": len(f["crash_frames"]) == 1 and f["crash_frames"][0] == f["worker_exit_code"],
            "not_this_rows_code": t["code_lines"] == 0 and c["code_lines"] == 0,
        })
        if kind == "setupfail":
            crit["exit_code_is_output_setup_failed"] = f["worker_exit_code"] == "OUTPUT_SETUP_FAILED" and f["output_setup_failed_lines"] >= 1
        else:
            crit["exit_code_is_a_writer_or_mux_failure"] = str(f["worker_exit_code"]).startswith(("WRITER_", "VIDEO_MUX_WRITE_FAILED", "AUDIO_"))
    r["criteria"], r["verdict"] = crit, "PASS" if all(crit.values()) else "FAIL"
    json.dump(r, open(os.path.join(d, "result.json"), "w"), indent=1)
    return r


def client(hold_s):
    n_requests, sdp, _ = B.CASES["record_close"]            # OPTIONS ANNOUNCE SETUP RECORD, description WITH parameter sets, no media
    return lambda ctx, port, right: B.raw_client(ctx, port, right, n_requests, sdp, hold_s)


def todo(what, runs):
    out = []
    if what in ("close", "all"):
        out += [(lambda n=n: run("close_camera_1_r%d" % n, "close", 0, client(0.3))) for n in range(1, runs + 1)]
    if what in ("hold", "all"):
        # The session's ingest window is 12 s; a camera still opening 10 s after it is given up (22 s after START).
        out.append(lambda: run("hold_camera_2_past_the_window", "hold", 1, client(E.LISTEN_S + 10 + 4)))
    if what in ("setupfail", "all"):
        build_setupfail()
        out.append(lambda: run("output_setup_failure_with_media", "setupfail", 0, None, binary=SETUPFAIL))
    if what in ("writefault", "all"):
        if not os.path.exists(WRITEFAULT):
            sys.exit("no proof build: make -C apps/capture-worker proof")
        out.append(lambda: run("writer_failure_with_media", "writefault", 0, None, binary=WRITEFAULT))
    return out


def line(r):
    f = r["facts"]
    side = lambda x: "port %d ic=%d bytes=%d v=%d a=%d decode_rc=%s code=%d stuck=%d frames=%s" % (
        x["port"], x["ingest_connected"], x["bytes"], x["video_frames"], x["audio_packets"], x["decode_rc"], x["code_lines"], x["stuck_lines"], [y[1] for y in x["fault_frames"]])
    return "%-34s %-10s test[%s statuses=%s] control[%s audio_s=%s video_s=%s] worker rc=%s exit_code=%r crash=%s alive_at_script_end=%s path_text=%d leftover=%d | %s%s" % (
        r["run"], r["case"], side(f["test"]), f["statuses"], side(f["control"]), f["control_audio_s"], f["control_video_s"], f["worker_rc"], f["worker_exit_code"], f["crash_frames"],
        f["worker_alive_when_script_ended"], f["path_text_occurrences"], f["leftovers"], r["verdict"], "" if r["verdict"] == "PASS" else " failed: %s" % sorted(k for k, v in r["criteria"].items() if not v))


def summary():
    root, rows = os.path.join(OUT, "runs"), []
    for n in sorted(os.listdir(root)) if os.path.isdir(root) else []:
        p = os.path.join(root, n, "result.json")
        if os.path.exists(p):
            rows.append(json.load(open(p)))
    rows = [r for r in rows if "verdict" in r]
    lines = [line(r) for r in rows]
    tail = "ROW176 CAMERA END: %d run(s), %d PASS, %d FAIL" % (len(rows), sum(r["verdict"] == "PASS" for r in rows), sum(r["verdict"] != "PASS" for r in rows))
    open(os.path.join(OUT, "summary.txt"), "w").write("\n".join(lines + [tail]) + "\n")
    print("\n".join(lines + [tail]))
    return all(r["verdict"] == "PASS" for r in rows) and bool(rows)


def main(argv):
    what = argv[0] if argv else "summary"
    runs = int(argv[argv.index("--runs") + 1]) if "--runs" in argv else 3
    jobs = todo(what, runs)
    if not jobs and what != "summary":
        sys.exit("usage: row176_camera_end.py all | close [--runs N] | hold | setupfail | writefault | summary")
    for f in jobs:
        print(line(f()), flush=True)
        time.sleep(1.5)
    if jobs:
        print("---- summary of every recorded run", flush=True)
    sys.exit(0 if summary() else 1)


if __name__ == "__main__":
    main(sys.argv[1:])
