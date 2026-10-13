#!/usr/bin/env python3
"""THE PERMANENT TEST OF THE WORKER'S ANNOUNCE GATE (task 4 blueprint row 142; AD-01; BR-09 of
verification/05_security_branch_b.md, the refusal cases - the concurrency and leak cases are row 178).

It is part of the worker's own series: test/e2e.py runs every case below as a named check, each printing ONE
JSON result with `verdict` and `criteria` in the series' own form (test/m3worker.py `finish`), and each negative
control with --expect-fail --must-fail-on. By hand, one check:

    # repository root, command sandbox off (two loopback ports, ps / lsof); `make -C apps/capture-worker`,
    # `make -C apps/capture-worker proof` and `make -C apps/capture-worker fixtures` first
    M3_PORTS=8559,8561 /usr/bin/lockf -k -t 1800 .locks/heavy-host.lock \
        python3 -B apps/capture-worker/test-fixtures/br09_gate.py near my_run --kind trailing_slash

Every check is ONE worker session with a live plan: two cameras, each with a session-shaped address whose last
element is 128 random bits (made new for every run, as apps/core-server/src/capture/ingest-address.ts makes it).
The camera under test gets the case; THE OTHER CAMERA OF THE SAME SESSION is pushed to its right address at the
same moment and must record: the right-path control in the same run.

  right                 both cameras pushed to their own addresses at the same instant: both record (each open is
                        bound to its own announce line, on its own thread; the right path is accepted)
  near --kind K         a push to one of the SEVEN near-miss addresses of AD-01 (2) (last_character, strict_prefix,
                        one_more_component, letter_case, trailing_slash, query_string, percent_encoded_character):
                        no `ingest_connected`, 0 bytes in its file, the log code INGEST_ANNOUNCE_NOT_MATCHED once and
                        the FRAME member CAMERA_ANNOUNCE_NOT_MATCHED for that camera (row 182), never the other member
      --push-right      THE CONTROL: the same check with the push sent to the RIGHT address - it must FAIL on the
                        refusal criteria (the right path records: the criteria can fail)
  foreign --camera N    a raw client announces the OTHER camera's whole address on camera N's port while that other
                        camera gets its own push: refused - the line of one camera never opens the other
  absent                "the announce line absent": the proof build capture-worker-noannounce (its log callback sees
                        nothing) - both right-address pushes are refused, INGEST_ANNOUNCE_NOT_SEEN in the log,
                        CAMERA_ANNOUNCE_NOT_SEEN in the frames, 0 bytes, the session ends without a camera
      --release         THE CONTROL: the same judgement on the release worker - it must FAIL (both record)
  second --address A    a second ANNOUNCE on the wire, A = same (the right address twice) or other (another address
                        second): refused with the NOT_MATCHED code and member, never the other
      --address none    THE CONTROL: the same raw client with ONE announce of the right address, judged the same
                        way - it must FAIL on the gate's criteria (the gate passes it; with no media it ends as
                        CAMERA_NO_PICTURE, which is not a refusal of the gate)
  oracle                a raw client on a wrong path (OPTIONS, then ANNOUNCE): every byte the worker answers it with
                        is searched for the session's address, its path and its secret element: 0 occurrences
                        (inside the check: the same search finds the element in a text that holds it)

THE CONCURRENCY AND LEAK CASES (row 178; BR-09 second half; hypothesis HB-1 of verification/05):
  assign --camera N     the two cameras pushed at the same instant, camera N to a WRONG path (another 128-bit
                        element, not a near miss) and the other to its right one - N = 1 and N = 2 are the two
                        assignments: in both the right camera records and the wrong one does not, refused by the
                        gate with its own member. (Each open is bound to its own line: HB-1.)
      --push-right      THE CONTROL: both to their right paths, judged the same way - it must FAIL
  method --method M     a raw client on a WRONG path whose first request is M, for EVERY RTSP method (OPTIONS,
                        DESCRIBE, ANNOUNCE, SETUP, PLAY, PAUSE, RECORD, TEARDOWN, GET_PARAMETER, SET_PARAMETER,
                        REDIRECT), followed by the rest of a push to that wrong path. Every byte the worker answers
                        with is kept and searched for the session's addresses, paths and secret elements: 0. The
                        camera is refused - by the gate, or by the library before the gate when the method ends
                        the open (which of the two is in `ingest_codes`) - and the other camera records.
  case_a --camera N     the "case-A" client of row 176 (OPTIONS ANNOUNCE SETUP RECORD with parameter sets, NO
                        media, closed) on the RIGHT path of camera N: the gate passes it, that camera ends as its
                        own fault (log code INGEST_NO_PICTURE_SIZE, frame member CAMERA_NO_PICTURE), the worker
                        does not crash, and THE OTHER CAMERA'S FILE IS COMPLETE and decodes.
      --with-media      THE CONTROL: camera N pushed normally, judged the same way - it must FAIL

In EVERY check: 0 occurrences of any path text of the run (each whole path, each element of 8 characters or more)
in the worker's log, its standard output and its frames; no process and no listener left.

The sessions are run by test-fixtures/row58_gate.py and row175_log_hygiene.py (imported, not edited: their
`run`, the raw client, the handshake), with this script's folder and addresses. Nothing here prints an address:
a result holds counts. Everything lands under .cache/m3worker/br09/ (git-ignored)."""
import argparse, json, os, secrets, socket, sys, time

sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
OUT = os.path.join(REPO, ".cache", "m3worker", "br09")
os.environ.setdefault("M3_PORTS", "8559,8561")
os.environ["E11_OUT"] = OUT
sys.path.insert(0, HERE)
import row58_gate as G                                   # read-only reuse: run(), the raw client, the handshake, the two codes
import row175_log_hygiene as L                           # read-only reuse: the second-announce client, the texts a path can leave
E, H = G.E, G.H
G.OUT = E.OUT = L.OUT = OUT                              # every run of this script lands in its own folder

KINDS = [k for k, _ in E.near_misses("a/bcdefghijkl")]
NOT_MATCHED, NOT_SEEN, NO_PICTURE = "CAMERA_ANNOUNCE_NOT_MATCHED", "CAMERA_ANNOUNCE_NOT_SEEN", "CAMERA_NO_PICTURE"
# Row 178: every method of RTSP 1.0 (RFC 2326, section 10) - what a client on a wrong path can try first.
METHODS = ("OPTIONS", "DESCRIBE", "ANNOUNCE", "SETUP", "PLAY", "PAUSE", "RECORD", "TEARDOWN", "GET_PARAMETER", "SET_PARAMETER", "REDIRECT")
GOP = 25                                                 # the control pusher's keyframe distance: a complete file holds G.FRAMES - GOP pictures


def first_request(method, address):
    """One request of `method` to `address`, in the form a client of that method would send it."""
    sdp_head = "Content-Type: application/sdp\r\nContent-Length: %d\r\n" % len(E.SDP)
    if method in ("ANNOUNCE", "SET_PARAMETER"):
        return (method, address, sdp_head if method == "ANNOUNCE" else "Content-Type: text/parameters\r\nContent-Length: %d\r\n" % len(E.SDP), E.SDP)
    if method == "SETUP":
        return (method, address + "/streamid=0", "Transport: RTP/AVP/TCP;unicast;interleaved=0-1;mode=record\r\n", "")
    if method in ("PLAY", "RECORD"):
        return (method, address, "Range: npt=0.000-\r\n", "")
    if method == "DESCRIBE":
        return (method, address, "Accept: application/sdp\r\n", "")
    if method == "REDIRECT":
        return (method, address, "Location: %s\r\n" % address, "")
    return (method, address, "", "")


def decodes(path):
    """Lines the installed FFmpeg writes at level error while it decodes the file's video; -1: it did not run to the end."""
    r = H.sh([E.FF, "-v", "error", "-nostdin", "-i", path, "-map", "0:v", "-f", "null", "-"])
    return len([l for l in r.stderr.splitlines() if l.strip()]) if r.returncode == 0 else -1


def live_addresses():
    """Two session-shaped paths, new for every run: <session>/<track>/<128 bits, URL-safe base64>. Session and track
    are shorter than 8 characters, so the one long element of a path is its secret."""
    return tuple("sB09/v%d/%s" % (i + 1, secrets.token_urlsafe(16)) for i in range(2))


def raw_all_bytes(port, requests):
    """A raw client that keeps EVERY byte the listener answers with (row58's raw client keeps the status only)."""
    got, sent = b"", []
    try:
        s = socket.create_connection(("127.0.0.1", port), timeout=3)
    except OSError as e:
        return {"pusher": "raw", "port": port, "connect_error": str(e), "requests_sent_with_status": [], "rtsp_error_statuses": [], "rc": None}, got
    try:
        s.settimeout(3)
        for i, (method, target, head, body) in enumerate(requests):
            try:
                s.sendall(("%s %s RTSP/1.0\r\nCSeq: %d\r\nUser-Agent: br09-raw\r\n%s\r\n%s" % (method, target, i + 1, head, body)).encode())
            except OSError:
                sent.append([method, None])
                break
            data = b""
            try:
                while b"\r\n\r\n" not in data:
                    chunk = s.recv(4096)
                    if not chunk:
                        break
                    data += chunk
            except OSError:
                pass
            got += data
            status = data.decode("latin1").split("\r\n")[0] if data else None
            sent.append([method, int(status.split()[1]) if status and status.startswith("RTSP/1.0 ") and status.split()[1].isdigit() else None])
            if not data:
                break
        try:                                             # whatever the listener still says before it closes
            s.settimeout(1.0)
            while True:
                chunk = s.recv(4096)
                if not chunk:
                    break
                got += chunk
        except OSError:
            pass
    finally:
        s.close()
    return {"pusher": "raw", "port": port, "requests_sent_with_status": sent, "rtsp_error_statuses": [c for _, c in sent if c and c >= 400], "rc": None}, got


def judge(r, v, test_index, member, gate_refuses=True, skip=()):
    """The criteria every refused case shares, on top of row58's own (`r["criteria"]`): the frame member of the
    camera under test, and the search of everything the worker wrote for every text a path of the run can leave.
    `skip` (row 178): criteria of row58's that do not apply to the case, each replaced by one the case names."""
    f = r["facts"]
    for name, ok in r["criteria"].items():
        if name not in skip:
            v(name, ok)
    cam = "CAM-0%d" % (test_index + 1)
    if gate_refuses:
        v("refusal_frame_names_the_camera_and_its_member_only", f["refusal_frames"] == [[cam, member]])
    d = os.path.join(OUT, "runs", r["run"])
    raw = open(os.path.join(d, "worker.jsonl"), errors="replace").read()
    frames = json.dumps(r.get("worker_frames_other", []))
    texts = L.texts_of(list(r.get("paths_used", [])) + list(r.get("right_paths", {}).values()))
    found = sum(raw.count(t) for t in texts) + sum(frames.count(t) for t in texts) + sum(r.get("path_text_in_worker_output", {}).values())
    v("no_path_text_in_log_output_or_frames", found == 0 and len(texts) >= 4 and raw.count("://") == 0 and frames.count("://") == 0)
    return {"texts_searched": len(texts), "path_text_occurrences": found}


def result_of(r, extra=None):
    """What a check prints: facts and counts, never an address."""
    f = r["facts"]
    out = {"check": "BR-09 %s" % r["case"], "run": r["run"], "worker": os.path.basename(r.get("worker", "")), "test": f["test"], "control": f["control"], "worker_rc": f["worker_rc"],
           "worker_exit_code": f["worker_exit_code"], "ingest_codes": f["ingest_codes"], "refusal_frames": f["refusal_frames"], "leftovers": f["leftovers"],
           "statuses_the_client_read": [c for _, c in r["test_push"]["requests_sent_with_status"]]}
    out.update(extra or {})
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("case", choices=("right", "near", "foreign", "absent", "second", "oracle", "assign", "method", "case_a"))
    ap.add_argument("name")
    ap.add_argument("--method", choices=METHODS, default=METHODS[0])
    ap.add_argument("--with-media", action="store_true")
    ap.add_argument("--kind", choices=KINDS, default=KINDS[0])
    ap.add_argument("--push-right", action="store_true")
    ap.add_argument("--camera", type=int, choices=(1, 2), default=1)
    ap.add_argument("--release", action="store_true")
    ap.add_argument("--address", choices=("same", "other", "none"), default="same")
    ap.add_argument("--expect-fail", action="store_true")
    ap.add_argument("--must-fail-on", default=None)
    ap.add_argument("--may-fail-on", default=None)
    a = ap.parse_args()
    H.ARGS = a                                           # the harness's `finish` reads --must-fail-on / --may-fail-on there
    E.RIGHT = live_addresses()
    v, d = H.Crit(), os.path.join(OUT, "runs", a.name)
    extra = {}

    if a.case == "right":
        r = G.run(a.name, "right", 0, G.ffmpeg_to(lambda right: right), "recorded")
        extra = judge(r, v, 0, None, gate_refuses=False)
        v("no_refusal_frame_at_all", r["facts"]["refusal_frames"] == [])
        v("both_cameras_recorded_at_the_same_time", r["facts"]["test"]["ingest_connected"] == 1 and r["facts"]["control"]["ingest_connected"] == 1 and min(r["facts"]["test"]["frames"], r["facts"]["control"]["frames"]) >= G.FRAMES // 2)
    elif a.case == "near":
        k = KINDS.index(a.kind)
        index = k % 2                                    # the camera under test alternates over the seven kinds
        path_of = (lambda right: right) if a.push_right else (lambda right: E.near_misses(right)[k][1])
        r = G.run(a.name, "near:" + a.kind, index, G.ffmpeg_to(path_of), "refused")
        extra = judge(r, v, index, NOT_MATCHED)
        extra["near_miss"] = a.kind if not a.push_right else "none: the right address (control)"
    elif a.case == "foreign":
        r = G.run(a.name, "foreign", a.camera - 1, G.raw_foreign, "refused")
        extra = judge(r, v, a.camera - 1, NOT_MATCHED)
    elif a.case == "absent":
        binary = H.WORKER if a.release else G.UNSEEN
        if not os.path.exists(binary):
            sys.exit("no proof build: make -C apps/capture-worker proof")
        r = G.run(a.name, "unseen", 0, G.ffmpeg_to(lambda right: right), "refused", binary=binary)
        extra = judge(r, v, 0, NOT_SEEN, gate_refuses=False)
        v("frames_say_no_line_was_seen_for_both_cameras", r["facts"]["refusal_frames"] == [["CAM-01", NOT_SEEN], ["CAM-02", NOT_SEEN]])
    elif a.case == "second":
        index = 0 if a.address != "other" else 1
        if a.address == "none":
            make = lambda ctx, port, right, cport, cright: (G.raw_requests(port, G.handshake(E.url(port, right))), [])
        else:
            other = "sB09/v9/%s" % secrets.token_urlsafe(16)
            make = L.raw_repeat((lambda port, right: E.url(port, right)) if a.address == "same" else (lambda port, right: E.url(port, other)))
        r = G.run(a.name, "repeat:" + a.address, index, make, "refused")
        extra = judge(r, v, index, NOT_MATCHED)
        extra["announces_sent"] = sum(1 for m, _ in r["test_push"]["requests_sent_with_status"] if m == "ANNOUNCE")
        v("the_second_announce_got_no_answer", a.address != "none" and [c for m, c in r["test_push"]["requests_sent_with_status"] if m == "ANNOUNCE"] == [200, None])
    elif a.case == "assign":
        # Row 178: right and wrong at the same instant, in the assignment `--camera` names (the wrong one).
        index = a.camera - 1
        wrong = "sB09/v%d/%s" % (index + 1, secrets.token_urlsafe(16))      # this camera's own track, another 128-bit element
        r = G.run(a.name, "assign:wrong_on_camera_%d" % a.camera, index, G.ffmpeg_to((lambda right: right) if a.push_right else (lambda right: wrong)), "refused")
        extra = judge(r, v, index, NOT_MATCHED)
        other = os.path.join(d, "media", "VIDEO-0%d.mp4" % (2 - index))
        extra["right_camera_file"] = {"frames": r["facts"]["control"]["frames"], "decode_error_lines": decodes(other) if r["facts"]["control"]["bytes"] else None}
        extra["wrong_path_on"] = "camera %d" % a.camera if not a.push_right else "none: both right (control)"
        v("the_right_camera_recorded_a_whole_file_that_decodes", r["facts"]["control"]["ingest_connected"] == 1 and r["facts"]["control"]["frames"] >= G.FRAMES - 2 * GOP and extra["right_camera_file"]["decode_error_lines"] == 0)
        v("the_wrong_camera_recorded_nothing_and_only_it_was_refused", r["facts"]["test"]["bytes"] == 0 and r["facts"]["control"]["gate_code_lines"] == 0)
    elif a.case == "method":
        # Row 178: a wrong-path client whose first request is `--method`; every byte it is answered with is searched.
        kept = {}
        index = METHODS.index(a.method) % 2              # the camera under test alternates over the methods

        def make(ctx, port, right, cport, cright):
            wrong = "sB09/v%d/%s" % (index + 1, secrets.token_urlsafe(16))
            address = E.url(port, wrong)
            requests = [first_request(a.method, address)] + [q for q in G.handshake(address) if q[0] != a.method]
            facts, got = raw_all_bytes(port, requests)
            texts = L.texts_of([right, cright]) + [E.url(port, right), E.url(cport, cright)]
            kept.update(bytes=len(got), found=sum(got.count(t.encode()) for t in texts), texts=len(texts), order=[q[0] for q in requests],
                        control_of_the_search=sum((got + E.url(port, right).encode()).count(t.encode()) for t in texts))
            return facts, [wrong]

        r = G.run(a.name, "noannounce", index, make, "refused")             # row58's criterion "refused by the gate OR by the library"
        r["case"] = "method:" + a.method
        # Row58's "no 200 to SETUP or RECORD" speaks of a push that announced first; here the question is the same
        # AFTER the wrong announce, wherever the method under test stood.
        extra = judge(r, v, index, NOT_MATCHED, gate_refuses=False, skip=("no_rtsp_ok_after_the_announce",))
        sent = r["test_push"]["requests_sent_with_status"]
        at = next((i for i, (m, _) in enumerate(sent) if m == "ANNOUNCE"), len(sent))
        extra.update(method=a.method, requests_in_order=kept.get("order"), bytes_the_wrong_path_client_received=kept.get("bytes"), occurrences_of_the_session_address_in_them=kept.get("found"))
        v("the_method_under_test_was_sent_first", bool(sent) and sent[0][0] == a.method)
        v("no_rtsp_ok_to_setup_or_record_after_the_wrong_announce", not any(m in ("SETUP", "RECORD") and c == 200 for m, c in sent[at + 1:]))
        v("no_secret_in_the_bytes_a_wrong_path_client_received", kept.get("found") == 0 and (kept.get("texts") or 0) >= 4)
        v("the_search_finds_the_secret_where_it_is", (kept.get("control_of_the_search") or 0) >= 2)
    elif a.case == "case_a":
        # Row 178: row 176's client (announce, set-up, record, NO media, closed) on the RIGHT path of camera N.
        index = a.camera - 1
        cam = "CAM-0%d" % (index + 1)
        make = G.ffmpeg_to(lambda right: right) if a.with_media else (lambda ctx, port, right, cport, cright: (G.raw_requests(port, G.handshake(E.url(port, right))), []))
        r = G.run(a.name, "case_a", index, make, "refused")
        extra = judge(r, v, index, None, gate_refuses=False, skip=("no_rtsp_ok_after_the_announce", "refused_by_the_gate_code"))
        f = r["facts"]
        other = os.path.join(d, "media", "VIDEO-0%d.mp4" % (2 - index))
        no_picture = sorted([w.get("subject"), w.get("reason")] for w in r["worker_frames_other"] if w.get("type") == "WARNING" and w.get("reason") == NO_PICTURE)
        extra.update(case_a_on="camera %d" % a.camera if not a.with_media else "none: a push with media (control)", no_picture_frames=no_picture,
                     other_camera_file={"frames": f["control"]["frames"], "decode_error_lines": decodes(other) if f["control"]["bytes"] else None},
                     crash_frames=sum(1 for w in r["worker_frames_other"] if w.get("type") == "CRASH"))
        v("the_gate_passed_the_right_address", f["test"]["gate_code_lines"] == 0 and f["refusal_frames"] == [] and (a.with_media or [c for _, c in r["test_push"]["requests_sent_with_status"]] == [200, 200, 200, 200]))
        v("that_camera_ended_as_its_own_fault_with_its_code_and_member", "ingest%d:INGEST_NO_PICTURE_SIZE" % (index + 1) in f["ingest_codes"] and no_picture == [[cam, NO_PICTURE]])
        v("the_worker_did_not_crash", f["worker_rc"] == 0 and extra["crash_frames"] == 0)
        v("the_other_cameras_file_is_complete_and_decodes", f["control"]["ingest_connected"] == 1 and f["control"]["frames"] >= G.FRAMES - 2 * GOP and extra["other_camera_file"]["decode_error_lines"] == 0)
    else:
        kept = {}

        def make(ctx, port, right, cport, cright):
            wrong = E.near_misses(right)[0][1]
            address = E.url(port, wrong)
            h = G.handshake(address)
            facts, got = raw_all_bytes(port, [h[0], h[1]])
            texts = L.texts_of([right, cright]) + [E.url(port, right), E.url(cport, cright)]
            kept.update(bytes=len(got), found=sum(got.count(t.encode()) for t in texts), texts=len(texts),
                        control_of_the_search=sum((got + E.url(port, right).encode()).count(t.encode()) for t in texts))
            return facts, [wrong]

        r = G.run(a.name, "oracle", 0, make, "refused")
        extra = judge(r, v, 0, NOT_MATCHED)
        extra["bytes_the_wrong_path_client_received"] = kept.get("bytes")
        extra["occurrences_of_the_session_address_in_them"] = kept.get("found")
        v("the_client_received_answers", (kept.get("bytes") or 0) > 0)
        v("no_secret_in_the_bytes_a_wrong_path_client_received", kept.get("found") == 0 and (kept.get("texts") or 0) >= 4)
        v("the_search_finds_the_secret_where_it_is", (kept.get("control_of_the_search") or 0) >= 2)
    H.finish(result_of(r, extra), True, a.expect_fail, d, v)


if __name__ == "__main__":
    main()
