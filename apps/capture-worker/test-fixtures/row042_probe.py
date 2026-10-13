#!/usr/bin/env python3
"""Task 4 blueprint row 42 (WP-03c; AD-06 (3), S13-01, S13-06): the capture relay's PROBE MODE and its report
"push established", at the adapter level. Test code only.

    probe    test camera (rtsp_test_camera.py, Digest)  ->  build/capture-relay in probe mode  ->  ONE line on
             standard output, then exit 0. No worker: a probe is given no ingest address and pushes nothing.
    record   test camera -> the relay in record mode with an attempt -> the capture worker with a live session:
             the line "push established" with that attempt, and what stands on standard output when the worker's
             gate does not take the push.

The relay is started as the Core's production door starts it (row041_relay.py, imported unchanged apart from its
folder: no shell, an EMPTY environment, no argument, three pipes, one compact line on standard input).

    # repository root, command sandbox off (loopback 8565 and 8567 of the doubles; 8559, 8561 of the worker for
    # `record`); `make -C apps/capture-worker` and `make -C apps/capture-worker proof` first
    M3_PORTS=8559,8561 /usr/bin/lockf -k -t 1800 .locks/heavy-host.lock \
        python3 -B apps/capture-worker/test-fixtures/row042_probe.py probe
    ... row042_probe.py refused | start | record | all | summary

Cases
  probe    h264 and hevc, each with the parameter sets in the description and in the stream; a camera that offers
           Basic AND Digest. Exit 0; standard output is ONE line of the fixed shape: the codec, 1920x1080, the rate
           the description states (25), where the sets stood, and the parameter-set bytes - which are compared,
           byte for byte, with the sets of the clip the camera sends (read by the camera's own reader, not by the
           relay). No push was opened, the camera got a TEARDOWN, no request of the Basic scheme arrived.
  refused  a camera that challenges Basic only, 2 runs: exit AUTH_SCHEME_NOT_ALLOWED, standard output empty,
           requests with ANY Authorization header at the camera: 0. A wrong password: AUTH_REFUSED, no line.
           A camera whose first keyframe comes late and the order to stop 1 s into the wait: exit 0 and NO line
           (exit 0 without a line means "stopped before the answer", never "probed").
  start    start messages of probe mode that are not the contract (an ingest address, attempt 0, an attempt as
           text): START_MESSAGE_INVALID. A description whose codec name is 300 characters of markup in lower
           case (AD-06 (5), the relay's part): CODEC_NOT_SUPPORTED, no line, 0 occurrences of that text.
  record   with the release worker: the line `push_established` carries the attempt of the start message and
           the worker reports the connect (both halves of the pairing exist). A relay that announces a near
           miss of the plan's address: the worker's gate refuses, exit INGEST_REFUSED and NOTHING on standard
           output. The proof worker whose gate sees no line: the worker answers the record request and then
           refuses - the relay did report (the limit of "established": S13-06 (i) without (ii)), the worker's
           frame says CAMERA_ANNOUNCE_NOT_SEEN and nothing is recorded.

No value of the account, the locator or an ingest address is printed or stored: a result holds COUNTS of those
texts in what the relay wrote (0 is required). Everything lands under .cache/row042-probe/ (git-ignored)."""
import json, os, re, sys, time

sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
OUT = os.path.join(REPO, ".cache", "row042-probe")
os.environ.setdefault("M3_PORTS", "8559,8561")
os.environ["E11_OUT"] = OUT
sys.path.insert(0, HERE)
import e11_listener_path as E                            # read-only reuse: the worker session (its folder is OUT: imported first)
import row041_relay as R                                 # read-only reuse: the relay as the door starts it, the doubles
import rtsp_test_camera as CAM                           # read-only: the synthetic account, the clip reader
H = E.H
R.OUT = OUT
R.CODES.update({"CODEC_NOT_SUPPORTED": 28, "INGEST_REFUSED": 40, "REPORT_NOT_WRITTEN": 43})
UNSEEN = os.path.join(H.BUILD, "capture-worker-noannounce")
REPORT_MAX = 6400                                        # RELAY_REPORT_MAX of src/relay/relay.h
SHAPE = set('{}":,_0123456789abcdefghijklmnopqrstuvwxyzHEVC')
PROBE_KEYS = ["report", "v", "attempt", "codec", "width", "height", "rate_milli", "sets_in_description", "sets_in_stream", "vps", "sps", "pps"]


def probe_message(locator, user, secret, attempt=None, **more):
    m = {"type": "start", "mode": "probe"}
    if attempt is not None:
        m["attempt"] = attempt
    m["access"] = {"locator": locator, "username": user, "secret": secret}
    m.update(more)
    return (json.dumps(m, separators=(",", ":"), ensure_ascii=False) + "\n").encode("utf-8")


def clip_sets(codec):
    """The parameter sets of the clip the camera sends, read by the camera's own reader (the truth of a probe)."""
    c = CAM.Codec(codec)
    clip = CAM.Clip(c, CAM.encode_clip(c, 1920, 1080, 25, 25, 250, CAM.DEFAULT_CACHE), 250, 25)
    return {name: clip.sets[t].hex() for name, t in zip(("sps", "pps") if codec == "h264" else ("vps", "sps", "pps"), c.set_types)}


def probe_run(name, codec="h264", sets="sdp", camera_extra=(), attempt=None, secret=None, expect_code="STOPPED", expect_line=True, act=None, basic_requests_expected=0):
    d = os.path.join(OUT, "runs", name)
    os.makedirs(d, exist_ok=True)
    for f in os.listdir(d):
        os.remove(os.path.join(d, f))
    cam, log, path = R.camera_start(d, codec, sets, 0, camera_extra)
    locator = "rtsp://127.0.0.1:%d%s" % (R.CAMERA_PORT, path)
    user, secret = CAM.ACCOUNT_USER, secret or CAM.ACCOUNT_PASSWORD
    texts = {"secret": secret, "account": user, "locator": locator, "locator_path": path}
    t0 = time.monotonic()
    relay = R.Relay(d, probe_message(locator, user, secret, attempt))
    extra = act(relay) if act else {}
    rc = relay.wait(20)
    seconds = round(time.monotonic() - t0, 2)
    relay.close_input()
    camera = R.camera_end(cam, log)
    H.killall([cam, relay.p])
    lines = relay.lines()
    exit_line = next((l for l in lines if l.get("relay") == "exit"), {})
    out = relay.out.decode("utf-8", "replace")
    r = {"run": name, "case": "probe", "relay_rc": rc, "relay_code": exit_line.get("code"), "seconds": seconds, "stdout_bytes": len(relay.out), "stdout_lines": out.count("\n"),
         "relay_events": [l.get("relay") for l in lines], "pictures_pushed": exit_line.get("pictures"), "texts_in_relay_output": R.occurrences(texts, relay.out, relay.err),
         "camera_requests": camera["requests"], "camera_requests_by_authentication_class": camera["requests_by_authentication_class"], "camera_frames_sent": camera["counters"].get("frames_sent"),
         "leftovers": len(H.leftovers()["processes"]), "extra": extra}
    cls = camera["requests_by_authentication_class"]
    crit = {"relay_exit_is_the_named_code": rc == R.CODES[expect_code] and exit_line.get("code") == expect_code,
            "every_line_of_standard_error_is_fixed_shape": all("not_json" not in l for l in lines),
            "no_text_of_the_message_in_any_output": sum(r["texts_in_relay_output"].values()) == 0,
            "no_basic_request_at_the_camera": cls.get("basic", 0) == basic_requests_expected and camera["counters"].get("auth_basic", 0) == basic_requests_expected,
            "no_push_was_opened": "push_open" not in r["relay_events"] and exit_line.get("pictures") == 0,
            "no_leftover": r["leftovers"] == 0}
    if expect_line:
        report = None
        try:
            report = json.loads(out)
        except ValueError:
            pass
        truth = clip_sets(codec)
        r["report"] = {k: (v if k not in ("vps", "sps", "pps") else "%d bytes" % (len(v) // 2)) for k, v in (report or {}).items()}
        crit["standard_output_is_one_line_of_the_fixed_shape"] = (out.count("\n") == 1 and out.endswith("}\n") and out.startswith('{"report":"probe",') and len(relay.out) <= REPORT_MAX
                                                                  and set(out[:-1]) <= SHAPE and report is not None and list(report) == PROBE_KEYS)
        if report:
            crit["codec_is_the_cameras_as_a_word_of_the_relay"] = report["codec"] == {"h264": "H264", "hevc": "HEVC"}[codec]
            crit["picture_size_1920x1080"] = (report["width"], report["height"]) == (1920, 1080)
            crit["rate_is_the_one_the_description_states"] = report["rate_milli"] == 25000
            crit["attempt_is_the_start_messages"] = report["attempt"] == (attempt or 0) and report["v"] == 1
            crit["where_the_sets_stood"] = (report["sets_in_description"], report["sets_in_stream"]) == ((True, False) if sets == "sdp" else (False, True))
            crit["parameter_set_bytes_are_the_clips"] = {k: report[k] for k in ("vps", "sps", "pps") if report[k]} == truth
        crit["probe_reported_then_ended"] = r["relay_events"][-2:] == ["probe_reported", "exit"]
        crit["camera_got_a_teardown"] = any(m == "TEARDOWN" for m, _, _ in camera["requests"])
        crit["every_request_after_the_challenge_answered_with_digest"] = cls.get("digest_ok", 0) >= 3 and set(cls) <= {"none", "digest_ok"}
    else:
        crit["nothing_on_standard_output"] = len(relay.out) == 0
        crit["no_probe_was_reported"] = "probe_reported" not in r["relay_events"]
    crit.update(extra.get("criteria", {}))
    r["criteria"], r["verdict"] = crit, "PASS" if all(crit.values()) else "FAIL"
    json.dump(r, open(os.path.join(d, "result.json"), "w"), indent=1, default=str)
    return r


def act_stop_while_waiting(relay):
    time.sleep(1.0)
    t = time.monotonic()
    relay.close_input()
    relay.wait(10)
    took = round(time.monotonic() - t, 2)
    return {"seconds_from_closed_input_to_exit": took, "criteria": {"ended_within_1_s_of_the_order_to_stop": took <= 1.0}}


def hostile_occurrences(hostile, lines):
    """Row T3 (X-04): how often the hostile codec name, and four pieces of it, stand in the VALUES of relay lines."""
    pieces = {"whole": hostile, "name": "h264-evil", "markup": "<b>", "entity": "&amp;", "quote_tail": "name'"}
    values = "\n".join(str(v) for l in lines for v in l.values())
    return {k: values.count(v) for k, v in pieces.items()}


def start_cases():
    u, s = CAM.ACCOUNT_USER, CAM.ACCOUNT_PASSWORD
    dead = "rtsp://127.0.0.1:%d/media/video1" % R.DEAD_PORT
    spare = "rtsp://127.0.0.1:%d/media/video1" % R.SPARE_PORT
    ingest = "rtsp://127.0.0.1:8559/S-ROW42/video-01/Zr41StartRunElement9x"
    bad = {
        "probe_with_an_ingest_address": probe_message(dead, u, s, ingest=ingest),
        "probe_with_attempt_0": probe_message(dead, u, s, attempt=0),
        "probe_with_the_attempt_as_text": probe_message(dead, u, s, attempt="3"),
        "probe_with_a_negative_attempt": probe_message(dead, u, s, attempt=-1),
        "probe_with_an_attempt_beyond_the_bound": probe_message(dead, u, s, attempt=1000000000),
        "record_with_a_fractional_attempt": R.start_message(ingest, dead, u, s, attempt=1.5),
    }
    runs = [lambda k=k, m=m: R.start_run("start_invalid_%s" % k, m, "START_MESSAGE_INVALID") for k, m in bad.items()]
    runs.append(lambda: R.start_run("start_probe_camera_not_there", probe_message(dead, u, s, attempt=2), "CAMERA_UNREACHABLE"))
    hostile = "<b>" + "h264-evil&amp;\"name'" * 15 + "</b>"                  # lower case, markup, 300 characters
    sdp = "v=0\r\no=- 0 0 IN IP4 127.0.0.1\r\ns=%s\r\nt=0 0\r\nm=video 0 RTP/AVP 96\r\na=rtpmap:96 %s/90000\r\na=framerate:%s\r\na=control:track1\r\n" % (hostile, hostile, hostile)
    answer = lambda method, cseq: "RTSP/1.0 200 OK\r\nCSeq: %s\r\nContent-Type: application/sdp\r\nContent-Length: %d\r\n\r\n%s" % (cseq, len(sdp), sdp)

    def hostile_run():
        r = R.start_run("start_probe_description_with_a_hostile_codec_name", probe_message(spare, u, s, attempt=4), "CODEC_NOT_SUPPORTED", raw=answer)
        d = os.path.join(OUT, "runs", r["run"])
        # start_run kept only counts of the account's texts; the hostile text is searched in the line shapes it kept
        r["criteria"]["hostile_text_length_300"] = len(hostile) >= 300
        r["criteria"]["no_line_of_the_relay_holds_a_text"] = all(set(l) <= {"relay", "code", "rc", "pictures", "held_back", "gaps", "other_payloads", "forms_not_taken", "answers_with_digest", "challenges", "keepalives", "library_errors"} for l in r["lines"])
        # Row T3 (review 060c X-04; survivor 15 of its section 6). The docstring says "0 occurrences of that text"; what
        # was checked above is the KEYS of each line - a relay that wrote the camera's text as the VALUE of a known key
        # (`{"relay":"<the text>"}`) passed. Now the text and four of its pieces are COUNTED in every value of every
        # line the relay wrote (as it parsed: unescaped); standard output is empty by `nothing_on_standard_output`, and a
        # line that is no JSON fails `every_line_is_fixed_shape`. Counts only are stored, never the text.
        r["hostile_text_in_relay_values"] = hostile_occurrences(hostile, r["lines"])
        r["criteria"]["no_piece_of_the_hostile_text_in_any_value_of_a_relay_line"] = sum(r["hostile_text_in_relay_values"].values()) == 0
        # CONTROL of that count, in the run itself: the same search over one planted line of the SAME KEYS finds every piece.
        planted = hostile_occurrences(hostile, [{"relay": "exit", "code": hostile, "rc": 28}])
        r["criteria"]["control_the_same_search_finds_every_piece_in_a_planted_value"] = all(n >= 1 for n in planted.values()) and len(planted) == 5
        # The double DID serve that description: the relay asked for it (else the run proved nothing about the text).
        r["criteria"]["the_double_was_asked_for_the_description"] = any(m == "DESCRIBE" for m, _ in r["double_requests"])
        r["verdict"] = "PASS" if all(r["criteria"].values()) else "FAIL"
        json.dump(r, open(os.path.join(d, "result.json"), "w"), indent=1, default=str)
        return r
    runs.append(hostile_run)
    return runs


def record_run(name, attempt, wrong_ingest=False, worker=None):
    """One worker session through R.session_run with the start message changed: an attempt, or a near miss of the
    plan's address as the address the relay announces."""
    made, release = R.start_message, H.WORKER
    kept = {}

    def message(ingest, locator, user, secret, **more):
        kept["element"] = ingest.rsplit("/", 1)[1]
        if wrong_ingest:
            ingest = ingest[:-1] + ("A" if ingest[-1] != "A" else "B")       # the last character of the plan's address changed
        return made(ingest, locator, user, secret, attempt=attempt)

    def expect(r, fx):
        text = r["relay"]["stdout_text"]
        frames = sorted([w.get("subject"), w.get("reason")] for w in r["worker_frames_other"] if w.get("type") == "WARNING" and str(w.get("reason", "")).startswith("CAMERA_ANNOUNCE_"))
        r["facts_row42"] = {"standard_output": text if kept.get("element", "?") not in text else "(withheld)", "announce_frames": frames}
        if wrong_ingest:
            return {"relay_exit_is_INGEST_REFUSED": fx["relay_rc"] == 40 and fx["relay_code"] == "INGEST_REFUSED", "nothing_on_standard_output": text == "",
                    "worker_gate_refused_it": fx["ingest_connected_port1"] == 0 and fx["file_bytes"] == 0 and frames == [["CAM-01", "CAMERA_ANNOUNCE_NOT_MATCHED"]]}
        if worker:
            return {"relay_reported_established_with_its_attempt": text == '{"report":"push_established","v":1,"attempt":%d}\n' % attempt,
                    "then_the_worker_refused_and_the_relay_lost_the_ingest": fx["relay_rc"] == 41 and fx["relay_code"] == "INGEST_LOST",
                    "worker_says_no_line_was_seen_and_records_nothing": fx["ingest_connected_port1"] == 0 and fx["file_bytes"] == 0 and ["CAM-01", "CAMERA_ANNOUNCE_NOT_SEEN"] in frames}
        c = R.recorded("h264")(r, fx)
        # Row 43: when the camera's stream ended the relay said that loss in a second line, with the same attempt (C37).
        c["standard_output_is_the_established_line_with_its_attempt"] = text == ('{"report":"push_established","v":1,"attempt":%d}\n' % attempt
                                                                                 + '{"report":"camera_lost","v":1,"attempt":%d,"loss":1,"cause":32}\n' % attempt)
        c["both_halves_of_the_pairing_exist"] = fx["ingest_connected_port1"] == 1 and "push_open" in [l.get("relay") for l in r["relay"]["lines"]]
        return c

    R.start_message = message
    if worker:
        H.WORKER = worker
    try:
        return R.session_run(name, "worker_gone" if worker else ("record" if not wrong_ingest else "refused"), "h264", "sdp", expect=expect)
    finally:
        R.start_message, H.WORKER = made, release


def todo(what):
    out = []
    if what in ("probe", "all"):
        n = 10
        for codec in ("h264", "hevc"):
            for sets in ("sdp", "inband"):
                n += 1
                out.append(lambda c=codec, s=sets, n=n: probe_run("probe_%s_%s" % (c, s), c, s, attempt=n))
        out.append(lambda: probe_run("probe_no_attempt_stated", "h264", "sdp"))
        out.append(lambda: probe_run("probe_basic_and_digest_offered", "h264", "sdp", camera_extra=("--challenge", "both"), attempt=21))
    if what in ("refused", "all"):
        for k in (1, 2):
            out.append(lambda k=k: probe_run("probe_basic_only_run_%d" % k, camera_extra=("--challenge", "basic"), attempt=30 + k, expect_code="AUTH_SCHEME_NOT_ALLOWED", expect_line=False))
        out.append(lambda: probe_run("probe_wrong_password", secret=R.WRONG, attempt=33, expect_code="AUTH_REFUSED", expect_line=False))
        out.append(lambda: probe_run("probe_stopped_before_the_keyframe", camera_extra=("--first-keyframe-delay-ms", "6000", "--first-keyframe-fill", "none"), attempt=34, expect_code="STOPPED", expect_line=False, act=act_stop_while_waiting))
    if what in ("start", "all"):
        out += start_cases()
    if what in ("record", "all"):
        out.append(lambda: record_run("record_established_with_attempt_7", 7))
        out.append(lambda: record_run("record_near_miss_announced_nothing_reported", 8, wrong_ingest=True))
        if not os.path.exists(UNSEEN):
            sys.exit("no proof build: make -C apps/capture-worker proof")
        out.append(lambda: record_run("record_established_then_refused_by_a_gate_that_saw_no_line", 9, worker=UNSEEN))
    return out


def line(r):
    failed = "" if r["verdict"] == "PASS" else " failed: %s" % sorted(k for k, v in r["criteria"].items() if not v)
    if r.get("case") == "probe":
        return "%-58s relay rc=%s code=%s in %ss stdout=%d bytes %d line(s) report=%s camera_requests=%s | %s%s" % (
            r["run"], r["relay_rc"], r["relay_code"], r["seconds"], r["stdout_bytes"], r["stdout_lines"], json.dumps(r.get("report"), separators=(",", ":")), r["camera_requests_by_authentication_class"], r["verdict"], failed)
    if "facts" not in r:
        return "%-58s relay rc=%s code=%s in %ss stdout=%d double_requests=%d | %s%s" % (r["run"], r["relay_rc"], r["relay_code"], r["seconds"], r["stdout_bytes"], len(r["double_requests"]), r["verdict"], failed)
    f = r["facts"]
    return "%-58s relay rc=%s code=%s pictures=%s stdout=%s | worker ic=%s gate_frames=%s file frames=%s rc=%s | %s%s" % (
        r["run"], f["relay_rc"], f["relay_code"], f["relay_pictures"], json.dumps(r.get("facts_row42", {}).get("standard_output")), f["ingest_connected_port1"],
        r.get("facts_row42", {}).get("announce_frames"), f["file_frames"], f["worker_rc"], r["verdict"], failed)


def summary():
    root, rows = os.path.join(OUT, "runs"), []
    for n in sorted(os.listdir(root)) if os.path.isdir(root) else []:
        p = os.path.join(root, n, "result.json")
        if os.path.exists(p):
            rows.append(json.load(open(p)))
    rows = [r for r in rows if "verdict" in r]
    lines = [line(r) for r in rows]
    probes = [r for r in rows if r.get("case") == "probe"]
    basic = sum(r["camera_requests_by_authentication_class"].get("basic", 0) for r in probes)
    tail = "ROW42 PROBE: %d run(s), %d PASS, %d FAIL; probe runs %d, requests of the Basic scheme received by the camera in them: %d" % (
        len(rows), sum(r["verdict"] == "PASS" for r in rows), sum(r["verdict"] != "PASS" for r in rows), len(probes), basic)
    open(os.path.join(OUT, "summary.txt"), "w").write("\n".join(lines + [tail]) + "\n")
    print("\n".join(lines + [tail]))
    return all(r["verdict"] == "PASS" for r in rows) and bool(rows) and basic == 0


def main(argv):
    what = argv[0] if argv else "summary"
    if not os.path.exists(R.RELAY):
        sys.exit("no relay: make -C apps/capture-worker")
    runs = todo(what)
    if not runs and what != "summary":
        sys.exit("usage: row042_probe.py all | probe | refused | start | record | summary")
    for f in runs:
        print(line(f()), flush=True)
        time.sleep(1.0)
    if runs:
        print("---- summary of every recorded run", flush=True)
    sys.exit(0 if summary() else 1)


if __name__ == "__main__":
    main(sys.argv[1:])
