#!/usr/bin/env python3
"""Task 4 blueprint row 43 (WP-03c): the relay's RE-OPEN of the camera leg inside a session. Test code only.

    test camera (rtsp_test_camera.py)  ->  build/capture-relay  ->  the release capture worker with a live session

What is under test (apps/capture-worker/src/relay/relay.h, "THE RE-OPEN"): once the push to the worker stands, the
end of the camera leg does not end the relay. It keeps its ONE connection to the worker, opens the camera again by
the retry rule (2, 2, 4, 8, 16, 30 s), forwards nothing before the parameter sets and a keyframe of the new leg,
says each loss and each re-open in one line of standard output (with the attempt, never an address), counts
refused answers (the second ends it) and ends with a named code when its tries are used up.

    # repository root, command sandbox off (loopback ports 8559, 8561 of the worker and 8565 of the camera);
    # `make -C apps/capture-worker` first. One lock hold per case:
    M3_PORTS=8559,8561 /usr/bin/lockf -k -t 1800 .locks/heavy-host.lock \
        python3 -B apps/capture-worker/test-fixtures/row043_reopen.py drop
    ... row043_reopen.py drop | back | refused | gone | control | all | summary

Cases (every one is ONE worker session; the worker's other camera is pushed by the FFmpeg pusher and must record)
  drop     the camera ends the connection after 60 pictures, in the MIDDLE of a group (its `--drop-after-frames`),
           and on the next connection sends 10 pictures of ANOTHER group that are no keyframes, then goes on in
           mid group where it stopped (25 pictures before the next keyframe). Orderly end and reset; H.264 and HEVC;
           parameter sets in the description and in the stream; once and twice in one session. Required: ONE file,
           one connect report of the worker, 0 decode errors, EVERY picture of the file is a picture the camera
           encoded (the MD5 of each decoded picture is one of the clip's - experiment E-10 found 30 of 30 wrong
           pictures and no message when a resume in mid group is written as it comes), the pictures before the
           next keyframe held back and counted, the lines `camera_lost` and `camera_reopened` with the attempt,
           and the gap as ONE step in time inside the track.
  back     the camera goes away (its process ends) and another one answers at the address 5 s later: the relay's
           tries at 2 s and 4 s find nobody, a later one opens.
  refused  after the loss the address answers with ANOTHER account (the stored one is refused): the relay ends
           with AUTH_REFUSED after exactly 2 refused answers, and no request with an answer arrives after them.
           Also: the stream path is gone (LOCATOR_NOT_FOUND after one answer), and a camera that now challenges
           Basic only (AUTH_SCHEME_NOT_ALLOWED, 0 requests with an answer).
  gone     the camera never comes back: 6 tries, 62 s of waits, then the relay ends with CAMERA_UNREACHABLE.
  control  NEGATIVE CONTROL: a relay built from a copy of the sources in which the gate after a re-open opens at
           ANY picture. The `drop` case must then FAIL, on the criteria that say the pictures are the camera's.

The account is the test camera's own synthetic constant (imported). No value of the account, the locator or the
ingest address is printed or stored. Everything a run writes lands under .cache/row043-reopen/ (git-ignored)."""
import json, os, re, shutil, subprocess, sys, time

sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
OUT = os.path.join(REPO, ".cache", "row043-reopen")
os.environ.setdefault("M3_PORTS", "8559,8561")
os.environ["E11_OUT"] = OUT
sys.path.insert(0, HERE)
import e11_listener_path as E                            # read-only reuse: the worker session (its folder is OUT: imported first)
import row041_relay as R                                 # read-only reuse: the relay as the door starts it, the session run
import rtsp_test_camera as CAM                           # read-only: the synthetic accounts, the clip
H = E.H

R.OUT = OUT
R.CODES.update({"AUTH_SCHEME_NOT_ALLOWED": 22, "AUTH_REFUSED": 23, "LOCATOR_NOT_FOUND": 24, "CAMERA_UNREACHABLE": 20})
ATTEMPT = 7                                              # the attempt of the start message: every line must say it
DROP_AFTER = 60                                          # pictures of a PLAY before the camera drops: 10 into the third group
GOP = 25
LEAD = 10                                                # pictures of another group before the first keyframe of every PLAY (drop cases)
SRC =os.path.join(REPO, "apps", "capture-worker", "src", "relay")
CONTROL_BIN = os.path.join(OUT, "bin", "capture-relay-nogate")

_made = R.start_message
R.start_message = lambda ingest, locator, user, secret, **more: _made(ingest, locator, user, secret, attempt=ATTEMPT)

LAST = {}
_camera_start = R.camera_start


def camera_start(d, codec="h264", sets="sdp", frames=R.FRAMES, extra=()):
    """Row 41's camera, remembered: a case ends it and puts another one at its address."""
    p, log, path = _camera_start(d, codec, sets, frames, extra)
    LAST.update(p=p, log=log, path=path, d=d)
    return p, log, path


R.camera_start = camera_start


def first_camera_ends():
    p = LAST["p"]
    try:
        p.stdin.close()                                  # --exit-on-stdin-eof: the camera ends, its connections with it
    except OSError:
        pass
    p.wait(timeout=8)
    return time.monotonic()


def second_camera(extra=(), codec="h264", sets="sdp"):
    """Another camera process at the SAME address (the first one ended)."""
    log = os.path.join(LAST["d"], "camera2.jsonl")
    p = H.spawn([sys.executable, "-B", R.CAMERA, "--port", str(R.CAMERA_PORT), "--codec", codec, "--param-sets", sets, "--frames", "0",
                 "--event-log", log, "--exit-on-stdin-eof", "--max-seconds", "150"] + list(extra), stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
    ready = json.loads(p.stdout.readline().decode() or "{}")
    if ready.get("event") != "ready":
        raise RuntimeError("the second test camera did not start")
    import threading
    threading.Thread(target=p.stdout.read, daemon=True).start()
    return p, log


def requests_of(log):
    """The requests a camera received so far: [method, authentication class, status]."""
    if not os.path.exists(log):
        return []
    out = []
    for l in open(log):
        try:
            e = json.loads(l)
        except ValueError:
            continue
        if e.get("event") == "request":
            out.append([e.get("method"), e.get("auth"), e.get("status")])
    return out


def reports_of(text):
    out = []
    for l in text.splitlines():
        try:
            out.append(json.loads(l))
        except ValueError:
            out.append({"report": "not_json"})
    return out


_reference = {}


def reference_md5(codec):
    """The MD5 of every picture of the camera's clip, decoded by the installed FFmpeg: what 'a picture the camera
    encoded' is measured against."""
    if codec not in _reference:
        clip = CAM.encode_clip(CAM.Codec(codec), 1920, 1080, 25, GOP, 250, CAM.DEFAULT_CACHE)
        r = H.sh([E.FF, "-v", "error", "-nostdin", "-i", clip, "-f", "framemd5", "-"])
        _reference[codec] = {l.rsplit(",", 1)[1].strip() for l in r.stdout.splitlines() if l and not l.startswith("#")}
    return _reference[codec]


def file_pictures(path, codec):
    """The decoded pictures of the worker's file: how many, and how many are NOT pictures of the clip."""
    r = H.sh([E.FF, "-v", "error", "-nostdin", "-i", path, "-map", "0:v", "-f", "framemd5", "-"])
    got = [l.rsplit(",", 1)[1].strip() for l in r.stdout.splitlines() if l and not l.startswith("#")]
    ref = reference_md5(codec)
    return {"decoded": len(got), "not_of_the_clip": sum(1 for m in got if m not in ref), "reference_pictures": len(ref), "decode_rc": r.returncode}


def time_steps(path):
    """Steps of more than 1 s between two pictures of the file's video track (seconds). The step after the FIRST
    picture is not counted: every file of this worker has its first picture at 0 and its second where the stream
    really stood (2.6 s here; the same in the file of the control camera and in the files of row 41's runs)."""
    r = H.sh([os.path.join(os.path.dirname(E.FF), "ffprobe"), "-v", "error", "-select_streams", "v", "-show_entries", "packet=pts_time", "-of", "csv=p=0", path])
    pts = sorted(float(x) for x in r.stdout.split() if re.fullmatch(r"-?\d+(\.\d+)?", x))[1:]
    return [round(b - a, 3) for a, b in zip(pts, pts[1:]) if b - a > 1.0]


def reference_order(codec):
    """The MD5 of the clip's pictures IN ORDER (index = the picture's number in the clip, a keyframe every GOP)."""
    key = codec + "/order"
    if key not in _reference:
        clip = CAM.encode_clip(CAM.Codec(codec), 1920, 1080, 25, GOP, 250, CAM.DEFAULT_CACHE)
        r = H.sh([E.FF, "-v", "error", "-nostdin", "-i", clip, "-f", "framemd5", "-"])
        _reference[key] = [l.rsplit(",", 1)[1].strip() for l in r.stdout.splitlines() if l and not l.startswith("#")]
    return _reference[key]


def after_the_gaps(path, codec):
    """THE PROOF OF THE GATE (experiment E-10: a resume in mid group decodes without a message and shows wrong
    pictures, so '0 decode errors' cannot see it). For every gap of the file's video track:
      sync      is the first sample after the gap a sync sample of the container (H.264: an IDR; HEVC: an IRAP picture)?
      compared  the decoded pictures after the gap, picture by picture, against the clip's pictures in order: the
                first one must be the clip's keyframe number k * GOP, and each one after it the next of the clip,
                up to the next gap or the end of the file (at least one full group)."""
    probe = H.sh([os.path.join(os.path.dirname(E.FF), "ffprobe"), "-v", "error", "-select_streams", "v", "-show_entries", "packet=pts_time,flags", "-of", "csv=p=0", path])
    packets = sorted((float(p[0]), p[1]) for p in (l.split(",") for l in probe.stdout.split()) if len(p) >= 2 and re.fullmatch(r"-?\d+(\.\d+)?", p[0]))
    starts = [i for i in range(2, len(packets)) if packets[i][0] - packets[i - 1][0] > 1.0]         # index 1 is the worker's own first step
    dec = H.sh([E.FF, "-v", "error", "-nostdin", "-i", path, "-map", "0:v", "-f", "framemd5", "-"])
    got = [l.rsplit(",", 1)[1].strip() for l in dec.stdout.splitlines() if l and not l.startswith("#")]
    ref = reference_order(codec)
    out = []
    for n, i in enumerate(starts):
        end = starts[n + 1] if n + 1 < len(starts) else len(packets)
        first = ref.index(got[i]) if i < len(got) and got[i] in ref else -1
        same = 0
        while first >= 0 and i + same < min(end, len(got)) and got[i + same] == ref[(first + same) % len(ref)]:
            same += 1
        out.append({"sample": i, "sync": "K" in packets[i][1], "first_is_clip_picture": first, "pictures_after_the_gap": end - i, "equal_in_order": same})
    return {"packets": len(packets), "decoded": len(got), "distinct_reference_pictures": len(set(ref)), "gaps": out}


def common(r, fx, kinds):
    """What every case states about the relay's lines and the worker's side."""
    reports = reports_of(r["relay"]["stdout_text"])
    path1 = os.path.join(OUT, "runs", r["run"], "media", "VIDEO-01.mp4")
    r["facts_row43"] = f = {"reports": reports, "steps_s": time_steps(path1) if fx["file_bytes"] else [],
                            "pictures": file_pictures(path1, fx["file_codec"] or "h264") if fx["file_bytes"] else {},
                            "after_the_gaps": after_the_gaps(path1, fx["file_codec"] or "h264") if fx["file_bytes"] else {"gaps": []},
                            "worker_keyframe_interval_warnings": sum(1 for w in r["worker_frames_other"] if "KEYFRAME_INTERVAL" in json.dumps(w))}
    crit = {
        "report_lines_are_the_expected_ones_in_order": [x.get("report") for x in reports] == kinds,
        "every_line_says_the_attempt": bool(reports) and all(x.get("attempt") == ATTEMPT and x.get("v") == 1 for x in reports),
        "losses_are_numbered_from_1": [x.get("loss") for x in reports if x.get("report") == "camera_lost"] == list(range(1, kinds.count("camera_lost") + 1)),
        "one_push_for_all_legs_no_gate_refusal": fx["ingest_connected_port1"] == 1 and fx["worker_gate_refusals"] == 0,
        "file_holds_every_forwarded_picture": fx["file_frames"] > 0 and fx["file_frames"] == fx["relay_pictures"] - fx["worker_dropped"],
        "zero_decode_errors": fx["decode_error_lines"] == 0,
        "every_picture_in_the_file_is_one_the_camera_encoded": f["pictures"].get("decoded") == fx["file_frames"] and f["pictures"].get("not_of_the_clip") == 0 and f["pictures"].get("reference_pictures", 0) >= 240,
        "worker_clean_exit": fx["worker_rc"] == 0,
    }
    gaps, reopens = f["after_the_gaps"]["gaps"], kinds.count("camera_reopened")
    if reopens:
        # The coordinator's correction (test/014 verdict): keyframe-first, and picture by picture against the source.
        crit["one_gap_in_the_file_per_reopen"] = len(gaps) == reopens and f["after_the_gaps"].get("decoded") == f["after_the_gaps"].get("packets") and f["after_the_gaps"].get("distinct_reference_pictures") == 250
        crit["first_sample_after_every_gap_is_a_sync_sample"] = bool(gaps) and all(g["sync"] for g in gaps)
        crit["first_picture_after_every_gap_is_a_keyframe_of_the_clip"] = bool(gaps) and all(g["first_is_clip_picture"] >= 0 and g["first_is_clip_picture"] % GOP == 0 for g in gaps)
        crit["every_picture_after_every_gap_equals_the_clips_in_order_for_a_full_group_or_more"] = bool(gaps) and all(g["equal_in_order"] == g["pictures_after_the_gap"] and g["equal_in_order"] > GOP for g in gaps)
    return crit, reports, f


def expect_drop(losses, held):
    kinds = ["push_established"] + ["camera_lost", "camera_reopened"] * losses

    def check(r, fx):
        crit, reports, f = common(r, fx, kinds)
        lost = [x for x in reports if x.get("report") == "camera_lost"]
        back = [x for x in reports if x.get("report") == "camera_reopened"]
        starts = [e for e in r["camera_events"] if e.get("event") == "stream_start"]
        crit.update({
            "relay_stopped_on_the_order": fx["relay_rc"] == 0 and fx["relay_code"] == "STOPPED",
            "each_loss_is_the_ended_connection_and_is_opened_at_the_first_try": [x.get("cause") for x in lost] == [32] * losses and [x.get("tries") for x in back] == [1] * losses,
            "camera_was_opened_again_in_the_middle_of_a_group": len(starts) == losses + 1 and all(s.get("first_index_is_keyframe") is False for s in starts[1:]),
            "pictures_before_the_next_keyframe_are_held_back_and_counted": [x.get("held_back") for x in back] == held and fx["relay_held_back"] == LEAD + sum(held),
            "gap_is_the_first_wait_of_the_retry_rule": all(2000 <= x.get("gap_ms", 0) <= 5000 for x in back),
            "the_gap_is_one_step_in_time_inside_the_track": len(f["steps_s"]) == losses and all(x["gap_ms"] / 1000 - 0.2 <= s <= x["gap_ms"] / 1000 + 0.7 for x, s in zip(back, f["steps_s"])),
        })
        return crit
    return check


def act_drop(losses):
    def act(ctx, relay):
        seen = {}
        for k in range(1, losses + 1):
            seen["lost_%d" % k] = relay.saw(('"report":"camera_lost","v":1,"attempt":%d,"loss":%d,' % (ATTEMPT, k)).encode(), 30)
            seen["reopened_%d" % k] = relay.saw(('"report":"camera_reopened","v":1,"attempt":%d,"loss":%d,' % (ATTEMPT, k)).encode(), 30)
        time.sleep(3.0)                                  # pictures after the last re-open
        relay.close_input()
        relay.wait(10)
        return {"lines_seen": {k: v is not None for k, v in seen.items()}}
    return act


def run(name, codec, sets, camera_extra, act, expect, kind="ends"):
    keep = {}

    def expecting(r, fx):
        log = os.path.join(OUT, "runs", name, "camera.jsonl")
        r["camera_events"] = [json.loads(l) for l in open(log)] if os.path.exists(log) else []
        c = expect(r, fx)
        r["camera_events"] = [{k: v for k, v in e.items() if k in ("event", "reason", "frames_sent", "first_index", "first_index_is_keyframe", "next_index")} for e in r["camera_events"] if e.get("event") in ("stream_start", "stream_end")]
        keep["crit"] = c
        return c

    r = R.session_run(name, kind, codec, sets, camera_extra=camera_extra, frames=0, act=act, expect=expecting)
    r["case"] = "row43"
    r["relay_binary"] = os.path.basename(R.RELAY)
    json.dump(r, open(os.path.join(OUT, "runs", name, "result.json"), "w"), indent=1, default=str)
    return r


def drop_case(name, codec, sets, style, losses=1, held=(LEAD + 15,)):
    # Every PLAY of this camera begins with LEAD pictures that are no keyframes and belong to ANOTHER group of the
    # clip (its `--first-keyframe-fill inter`), then goes on in mid group where the dropped stream ended. Written as
    # they come, the pictures after the gap lean on pictures the file does not hold: they decode to pictures the
    # camera never encoded, without a message (E-10) - which is what the negative control must show.
    extra = ("--drop-after-frames", str(DROP_AFTER), "--drop-count", str(losses), "--drop-style", style, "--first-keyframe-delay-ms", str(LEAD * 40), "--first-keyframe-fill", "inter")
    return run(name, codec, sets, extra, act_drop(losses), expect_drop(losses, list(held)))


# ---------------------------------------------------------------------------------------------------------- the camera goes away
def act_back(ctx, relay):
    time.sleep(2.0)
    ended = first_camera_ends()
    lost = relay.saw(b'"report":"camera_lost"', 10)
    time.sleep(max(0.0, ended + 5.0 - time.monotonic()))
    p2, log2 = second_camera()
    ctx["procs"].append(p2)
    back = relay.saw(b'"report":"camera_reopened"', 30)
    time.sleep(3.0)
    relay.close_input()
    relay.wait(10)
    cam2 = R.camera_end(p2, log2)
    return {"loss_seen": lost is not None, "reopen_seen": back is not None, "second_camera_requests": cam2["requests"], "second_camera_frames_sent": cam2["counters"].get("frames_sent")}


def expect_back(r, fx):
    crit, reports, f = common(r, fx, ["push_established", "camera_lost", "camera_reopened"])
    back = next((x for x in reports if x.get("report") == "camera_reopened"), {})
    crit.update({
        "relay_stopped_on_the_order": fx["relay_rc"] == 0 and fx["relay_code"] == "STOPPED",
        "tries_at_2_s_and_4_s_found_nobody_a_later_one_opened": back.get("tries") in (3, 4) and 8000 <= back.get("gap_ms", 0) <= 19000,
        "a_camera_that_begins_on_a_keyframe_has_nothing_held_back": back.get("held_back") == 0,
        "the_gap_is_one_step_in_time_inside_the_track": len(f["steps_s"]) == 1 and back.get("gap_ms", 0) / 1000 - 0.2 <= f["steps_s"][0] <= back.get("gap_ms", 0) / 1000 + 0.7,
        "the_second_camera_was_asked_before_it_was_answered": [q[1] for q in r["extra"]["second_camera_requests"][:2]] == ["none", "digest_ok"],
    })
    return crit


# ---------------------------------------------------------------------------------------------------------- the address refuses
def act_other(camera_extra, hold_s=3.0):
    def act(ctx, relay):
        time.sleep(2.0)
        ended = first_camera_ends()
        p2, log2 = second_camera(camera_extra)
        ctx["procs"].append(p2)
        lost = relay.saw(b'"report":"camera_lost"', 10)
        relay.wait(40)
        gone = time.monotonic()
        at_exit = requests_of(log2)
        time.sleep(hold_s)                               # nothing more may arrive once the relay is gone
        later = requests_of(log2)
        R.camera_end(p2, log2)
        return {"loss_seen": lost is not None, "seconds_from_the_loss_to_the_exit": round(gone - (lost or ended), 2), "second_camera_requests_at_exit": at_exit, "second_camera_requests_later": later}
    return act


def expect_ended(code, requests, most_seconds):
    def check(r, fx):
        crit, reports, f = common(r, fx, ["push_established", "camera_lost"])
        at_exit, later = r["extra"]["second_camera_requests_at_exit"], r["extra"]["second_camera_requests_later"]
        carried = [q for q in later if q[1] != "none"]
        crit.update({
            "relay_exit_is_the_named_code": fx["relay_rc"] == R.CODES[code] and fx["relay_code"] == code,
            "requests_at_the_second_camera_are_exactly_the_expected_ones": [q[:2] + [q[2]] for q in later] == requests,
            "requests_carrying_an_answer": len(carried) == sum(1 for q in requests if q[1] != "none") and not any(q[1] in ("basic", "other") for q in later),
            "no_request_after_the_relay_ended": at_exit == later,
            "ended_inside_its_bound": r["extra"]["seconds_from_the_loss_to_the_exit"] <= most_seconds,
        })
        return crit
    return check


def act_gone(ctx, relay):
    time.sleep(2.0)
    first_camera_ends()
    lost = relay.saw(b'"report":"camera_lost"', 10)
    relay.wait(85)
    return {"loss_seen": lost is not None, "seconds_from_the_loss_to_the_exit": round(time.monotonic() - lost, 2) if lost else None}


def expect_gone(r, fx):
    crit, reports, f = common(r, fx, ["push_established", "camera_lost"])
    s = r["extra"]["seconds_from_the_loss_to_the_exit"]
    crit.update({
        "relay_exit_is_the_code_of_its_last_try": fx["relay_rc"] == 20 and fx["relay_code"] == "CAMERA_UNREACHABLE",
        "six_tries_62_s_of_waits_then_the_end": s is not None and 62.0 <= s <= 66.0,
    })
    return crit


def gone_case():
    frames = E.FRAMES
    E.FRAMES = 2200                                      # the microphones of the session last 200 s (the default session is 41 s)
    try:
        return run("gone_camera_never_comes_back", "h264", "sdp", (), act_gone, expect_gone)
    finally:
        E.FRAMES = frames


# ---------------------------------------------------------------------------------------------------------- the negative control
def build_control():
    """A relay from a COPY of the sources (the tree is not changed) whose gate after a re-open opens at any picture."""
    work = os.path.join(OUT, "control-src")
    shutil.rmtree(work, ignore_errors=True)
    os.makedirs(work)
    os.makedirs(os.path.dirname(CONTROL_BIN), exist_ok=True)
    for n in os.listdir(SRC):
        shutil.copy(os.path.join(SRC, n), os.path.join(work, n))
    path = os.path.join(work, "relay.c")
    text = open(path).read()
    gate = "if (picture.keyframe && ((push.open && !again.pending) || relay_sets_complete(description.codec, sets))) {"
    if text.count(gate) != 1:
        sys.exit("the control is stale: the gate line of relay.c is not the one this script changes")
    open(path, "w").write(text.replace(gate, "if ((picture.keyframe || again.pending) && ((push.open && !again.pending) || relay_sets_complete(description.codec, sets))) {"))
    pc = ["libavformat", "libavcodec", "libavutil"]
    cflags = H.sh(["pkg-config", "--cflags"] + pc).stdout.split()
    libs = H.sh(["pkg-config", "--libs"] + pc).stdout.split()
    cc = H.sh([os.environ.get("CC", "clang"), "-std=c11", "-D_DEFAULT_SOURCE", "-O2", "-g", "-Wall", "-Wextra", "-Werror"] + cflags + ["-o", CONTROL_BIN] + [os.path.join(work, n) for n in ("relay.c", "relay_rtsp.c", "relay_core.c")] + libs)
    if cc.returncode != 0:
        sys.exit("the control relay did not build: %s" % cc.stderr[-400:])


MUST_FAIL = ["every_picture_in_the_file_is_one_the_camera_encoded", "pictures_before_the_next_keyframe_are_held_back_and_counted", "first_sample_after_every_gap_is_a_sync_sample",
             "first_picture_after_every_gap_is_a_keyframe_of_the_clip", "every_picture_after_every_gap_equals_the_clips_in_order_for_a_full_group_or_more"]


def control_case():
    build_control()
    release = R.RELAY
    R.RELAY = CONTROL_BIN
    try:
        r = drop_case("neg_no_gate_after_the_reopen", "h264", "sdp", "fin")
    finally:
        R.RELAY = release
    failed = sorted(k for k, v in r["criteria"].items() if not v)
    r["negative_control"] = {"must_fail_on": MUST_FAIL, "failed_on": failed, "judged_verdict": r["verdict"]}
    r["verdict"] = "PASS" if r["verdict"] == "FAIL" and all(k in failed for k in MUST_FAIL) else "FAIL"
    json.dump(r, open(os.path.join(OUT, "runs", r["run"], "result.json"), "w"), indent=1, default=str)
    return r


def todo(what):
    out = []
    if what in ("drop", "all"):
        out.append(lambda: drop_case("drop_fin_h264_sets_in_description", "h264", "sdp", "fin"))
        out.append(lambda: drop_case("drop_reset_hevc_sets_in_stream", "hevc", "inband", "reset"))
        out.append(lambda: drop_case("drop_reset_h264_sets_in_stream", "h264", "inband", "reset"))
        out.append(lambda: drop_case("drop_fin_hevc_sets_in_description", "hevc", "sdp", "fin"))
        out.append(lambda: drop_case("drop_twice_h264_sets_in_stream", "h264", "inband", "fin", losses=2, held=(LEAD + 15, LEAD + 5)))
    if what in ("back", "all"):
        out.append(lambda: run("back_camera_away_5_s_then_another_at_the_address", "h264", "sdp", (), act_back, expect_back))
    if what in ("refused", "all"):
        out.append(lambda: run("refused_the_address_answers_with_another_account", "h264", "sdp", (), act_other(("--account", "special")),
                               expect_ended("AUTH_REFUSED", [["DESCRIBE", "none", 401], ["DESCRIBE", "digest_refused", 401]] * 2, 16.0)))
        out.append(lambda: run("refused_the_stream_path_is_gone", "h264", "sdp", (), act_other(("--path", "/media/another")),
                               expect_ended("LOCATOR_NOT_FOUND", [["DESCRIBE", "none", 401], ["DESCRIBE", "digest_ok", 404]], 8.0)))
        out.append(lambda: run("refused_the_address_challenges_basic_only", "h264", "sdp", (), act_other(("--challenge", "basic")),
                               expect_ended("AUTH_SCHEME_NOT_ALLOWED", [["DESCRIBE", "none", 401]], 8.0)))
    if what in ("gone", "all"):
        out.append(gone_case)
    if what in ("control", "all"):
        out.append(control_case)
    return out


def line(r):
    failed = "" if r["verdict"] == "PASS" else " failed: %s" % sorted(k for k, v in r["criteria"].items() if not v)
    f, x = r["facts"], r.get("facts_row43", {})
    control = " | NEGATIVE CONTROL judged %s, failed on %s" % (r["negative_control"]["judged_verdict"], r["negative_control"]["failed_on"]) if "negative_control" in r else ""
    return ("%-50s relay rc=%s code=%s pictures=%s held_back=%s | reports=%s | worker ic=%s gate_refusals=%s rc=%s | file %s frames=%s decode_errors=%s pictures=%s steps_s=%s | %s%s%s") % (
        r["run"], f["relay_rc"], f["relay_code"], f["relay_pictures"], f["relay_held_back"], json.dumps([{k: v for k, v in q.items() if k not in ("v",)} for q in x.get("reports", [])], separators=(",", ":")),
        f["ingest_connected_port1"], f["worker_gate_refusals"], f["worker_rc"], f["file_codec"], f["file_frames"], f["decode_error_lines"], json.dumps(x.get("pictures", {}), separators=(",", ":")), json.dumps([x.get("steps_s"), x.get("after_the_gaps", {}).get("gaps")], separators=(",", ":")),
        r["verdict"], failed, control)


def summary():
    root, rows = os.path.join(OUT, "runs"), []
    for n in sorted(os.listdir(root)) if os.path.isdir(root) else []:
        p = os.path.join(root, n, "result.json")
        if os.path.exists(p):
            rows.append(json.load(open(p)))
    rows = [r for r in rows if "verdict" in r and "facts" in r]
    lines = [line(r) for r in rows]
    tail = "ROW43 REOPEN: %d run(s), %d PASS, %d FAIL (a negative control passes when it FAILS on its named criteria)" % (len(rows), sum(r["verdict"] == "PASS" for r in rows), sum(r["verdict"] != "PASS" for r in rows))
    open(os.path.join(OUT, "summary.txt"), "w").write("\n".join(lines + [tail]) + "\n")
    print("\n".join(lines + [tail]))
    return all(r["verdict"] == "PASS" for r in rows) and bool(rows)


def main(argv):
    what = argv[0] if argv else "summary"
    if not os.path.exists(R.RELAY):
        sys.exit("no relay: make -C apps/capture-worker")
    runs = todo(what)
    if not runs and what != "summary":
        sys.exit("usage: row043_reopen.py drop | back | refused | gone | control | all | summary")
    for f in runs:
        print(line(f()), flush=True)
        time.sleep(1.0)
    if runs:
        print("---- summary of every recorded run", flush=True)
    sys.exit(0 if summary() else 1)


if __name__ == "__main__":
    main(sys.argv[1:])
