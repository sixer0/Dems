#!/usr/bin/env python3
"""Task 4 blueprint row 10 (WP-01, experiment E-10 extended; design addendum 5.1, review finding F10 (a)): what does
the capture worker AS IT IS BUILT do with a camera push that PAUSES and RESUMES with a time jump, and with a resumed
push that does not begin on a keyframe at the camera side? Test code only. It records FACTS per run; it decides
nothing (row 14 writes the verdict and the consequence for WP-11).

Nothing is built: build/capture-worker and build/fake_mic are started as they are, through the session of
e11_listener_path.py (imported, not edited: two cameras, two FIFO microphones). The pusher is THIS file's own
sub-command `push`: a hand-written RTSP client (the packet and report writers of fake_cam_sr.py, imported, not edited)
that CONNECTS to 127.0.0.1 only and opens no receiving socket of its own. EVERY run has its control: the other
camera of the same session gets the same clip from the same pusher without a pause, at the same moment.

    # repository root, command sandbox off (binds two loopback ports, reads ps / lsof)
    M3_PORTS=8559,8561 /usr/bin/lockf -k -t 1800 .locks/heavy-host.lock \
        python3 apps/capture-worker/test-fixtures/row010_resumed_push.py <case> [--runs 3]
    ... row010_resumed_push.py clip | summary

Cases (the clip: 320x240, 50 pictures a second, a keyframe every 50 pictures, no B-frames, moving test picture)
  ONE CONNECTION: pictures 0-149, a pause without a byte, then the push goes on, on the same connection
  key       pause 6 s, timestamps jump by 6 s, the push resumes ON a keyframe (picture 200)      [the control of nonkey]
  nonkey    pause 6 s, timestamps jump by 6 s, the push resumes in the MIDDLE of a group (picture 170)
  back      pause 6 s, timestamps restart 2 s BEFORE the last one sent, resumes at picture 170
  far       pause 6 s, timestamps jump by 600 s, resumes at picture 170
  long      pause 20 s, timestamps jump by 20 s, resumes at picture 170
  TWO CONNECTIONS: pictures 0-149, the connection ENDS, 3 s later a second connection to the SAME address
  teardown  the first connection ends with TEARDOWN; the second resumes at picture 170, timestamps 3 s on
  close     the first connection is closed without TEARDOWN; the same second connection

Addresses are synthetic and of this script only; none is printed. Everything a run writes lands under
.cache/row010-resumed-push/ (git-ignored): 0 media in the tracked tree."""
import argparse, hashlib, json, os, socket, subprocess, sys, threading, time

sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
OUT = os.path.join(REPO, ".cache", "row010-resumed-push")
os.environ.setdefault("M3_PORTS", "8559,8561")
os.environ["E11_OUT"] = OUT
sys.path.insert(0, HERE)
import fake_cam_sr as S                                  # read-only reuse: access_units, rtp_packets, sender_report, framed

FPS, FRAME_US, RTP_PER_FRAME, GOP = S.FPS, S.FRAME_US, S.RTP_PER_FRAME, 50
CLIP_FRAMES, FIRST_END = 1450, 150                       # the clip; the first part of every push under test is pictures 0-149
TEST_END = 400                                           # the push under test ends before picture 400
CLIP = os.path.join(OUT, "clip", "row010_clip.h264")
LISTEN_S = 30                                            # the production ingest window (row 47): every connection of a run is inside it
CASES = {  # pause_s, jump_s (timestamp of the first resumed picture minus the one that would have followed), resume_at, reconnect
    "key": dict(pause_s=6.0, jump_s=6.0, resume_at=200, reconnect=None),
    "nonkey": dict(pause_s=6.0, jump_s=6.0, resume_at=170, reconnect=None),
    "back": dict(pause_s=6.0, jump_s=-2.0, resume_at=170, reconnect=None),
    "far": dict(pause_s=6.0, jump_s=600.0, resume_at=170, reconnect=None),
    "long": dict(pause_s=20.0, jump_s=20.0, resume_at=170, reconnect=None),
    "teardown": dict(pause_s=3.0, jump_s=3.0, resume_at=170, reconnect="teardown"),
    "close": dict(pause_s=3.0, jump_s=3.0, resume_at=170, reconnect="close"),
}


# ------------------------------------------------------------------------------------------ the pusher (sub-command `push`)
def real_us():
    return time.time_ns() // 1000


def request(sock, state, method, url, headers=(), body=b""):
    """One RTSP request on an open connection. Returns the status read back (None: closed without an answer)."""
    state["cseq"] += 1
    lines = ["%s %s RTSP/1.0" % (method, url), "CSeq: %d" % state["cseq"], "User-Agent: dems-row010-push"] + list(headers)
    if state.get("session"):
        lines.append("Session: %s" % state["session"])
    if body:
        lines.append("Content-Length: %d" % len(body))
    sock.sendall(("\r\n".join(lines) + "\r\n\r\n").encode() + body)
    buf = b""
    while b"\r\n\r\n" not in buf:
        more = sock.recv(4096)
        if not more:
            return None
        buf += more
    text = buf.partition(b"\r\n\r\n")[0].decode("latin-1")
    for line in text.splitlines()[1:]:
        name, _, value = line.partition(":")
        if name.strip().lower() == "session":
            state["session"] = value.strip().split(";")[0]
    first = text.splitlines()[0] if text else ""
    return int(first.split()[1]) if first.startswith("RTSP/1.0 ") else None


def connect(url, sdp, tries, facts):
    """A connection with the handshake of a push (ANNOUNCE, SETUP, RECORD). Every attempt is recorded; None when no
    attempt reached a 200 to RECORD."""
    port = int(url[len("rtsp://127.0.0.1:"):].split("/")[0])
    for n in range(tries):
        a = {"attempt": n + 1, "at_real_us": real_us(), "requests": []}
        facts["attempts"].append(a)
        try:
            sock = socket.create_connection(("127.0.0.1", port), timeout=5)
        except OSError as e:
            a["connect_error"] = "%s: %s" % (e.__class__.__name__, e)
            time.sleep(0.3)
            continue
        sock.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
        state = {"cseq": 0}
        try:
            ok = True
            for method, target, headers, body in (("ANNOUNCE", url, ["Content-Type: application/sdp"], sdp),
                                                  ("SETUP", url + "/streamid=0", ["Transport: RTP/AVP/TCP;unicast;interleaved=0-1;mode=record"], b""),
                                                  ("RECORD", url, ["Range: npt=0.000-"], b"")):
                status = request(sock, state, method, target, headers, body)
                a["requests"].append([method, status])
                if status != 200:
                    ok = False
                    break
        except OSError as e:
            a["handshake_error"] = "%s: %s" % (e.__class__.__name__, e)
            ok = False
        if ok:
            return sock, state
        sock.close()
        time.sleep(0.3)
    return None, None


def teardown(sock, state, url):
    try:                                                  # the answer is not waited for: the receiver ends the session on it
        sock.sendall(("TEARDOWN %s RTSP/1.0\r\nCSeq: %d\r\nSession: %s\r\n\r\n" % (url, state["cseq"] + 1, state.get("session") or "")).encode())
        sock.shutdown(socket.SHUT_WR)
        sock.settimeout(2)
        while sock.recv(4096):
            pass
    except OSError:
        pass
    sock.close()


def cmd_push(a):
    if not a.url.startswith("rtsp://127.0.0.1:"):
        sys.exit("the URL must be rtsp://127.0.0.1:<port>/<name>")
    sps, pps, pictures = S.access_units(a.clip, CLIP_FRAMES)
    import base64
    sdp = "\r\n".join([
        "v=0", "o=- 0 0 IN IP4 127.0.0.1", "s=DEMS row 10 resume pusher", "c=IN IP4 127.0.0.1", "t=0 0",
        "m=video 0 RTP/AVP %d" % S.PT, "a=rtpmap:%d H264/90000" % S.PT,
        "a=fmtp:%d packetization-mode=1; sprop-parameter-sets=%s,%s; profile-level-id=%s" % (S.PT, base64.b64encode(sps).decode(), base64.b64encode(pps).decode(), sps[1:4].hex().upper()),
        "a=control:%s" % (a.url + "/streamid=0"), ""]).encode()
    facts = {"tag": a.tag, "pid": os.getpid(), "plan": {k: getattr(a, k) for k in ("first_end", "resume_at", "end_at", "pause_s", "jump_s", "reconnect")},
             "attempts": [], "parts": [], "send_errors": []}

    def out():
        json.dump(facts, open(a.facts, "w"), indent=1)

    def send_part(sock, k_from, k_to, t0_us, ts_of, seq, counters, name):
        """Pictures k_from..k_to-1, one every 20 ms from t0_us; a sender report before the first one and before every
        25th after it, stating the true time of the picture that follows. Returns the next sequence number."""
        part = {"part": name, "from": k_from, "to": k_to, "first_is_keyframe": pictures[k_from][0] & 31 == 5, "first_ts": ts_of(k_from), "started_real_us": None, "sent": 0, "max_late_us": 0}
        facts["parts"].append(part)
        for n, k in enumerate(range(k_from, k_to)):
            due = t0_us + n * FRAME_US
            wait = due - real_us()
            if wait > 0:
                time.sleep(wait / 1e6)
            else:
                part["max_late_us"] = max(part["max_late_us"], -wait)
            if part["started_real_us"] is None:
                part["started_real_us"] = real_us()
            ts, buf = ts_of(k), b""
            if n % 25 == 0:
                buf += S.framed(1, S.sender_report(due, ts, counters[0], counters[1]))
            picture = pictures[k]
            for unit in ([sps, pps] if picture[0] & 31 == 5 else []) + [picture]:
                for packet in S.rtp_packets(unit, seq, ts):
                    if unit is not picture:               # only the last packet of the picture keeps the marker
                        packet = packet[:1] + bytes([packet[1] & 0x7F]) + packet[2:]
                    buf += S.framed(0, packet)
                    seq += 1
                    counters[0] += 1
                    counters[1] += len(packet) - 12
            try:
                sock.sendall(buf)
            except OSError as e:
                facts["send_errors"].append({"part": name, "picture": k, "error": "%s: %s" % (e.__class__.__name__, e)})
                part["ended_real_us"], part["last_ts"] = real_us(), ts
                return None
            part["sent"] += 1
        part["ended_real_us"], part["last_ts"] = real_us(), ts_of(k_to - 1)
        return seq

    base = 90000
    sock, state = connect(a.url, sdp, 50, facts)
    if sock is None:
        facts["result"] = "FIRST_CONNECTION_NOT_ESTABLISHED"
        out()
        sys.exit(1)
    sys.stderr.write("ROW010_PUSH CONNECTED pid=%d tag=%s\n" % (os.getpid(), a.tag))
    counters = [0, 0]
    t0 = real_us() + 100000
    seq = send_part(sock, 0, a.first_end, t0, lambda k: base + k * RTP_PER_FRAME, 1, counters, "first")
    if a.resume_at < 0:                                   # the control: no pause, one part
        if seq is not None:
            teardown(sock, state, a.url)
        facts["result"] = "DONE" if seq is not None else "SEND_FAILED"
        out()
        sys.exit(0 if seq is not None else 1)
    # The pause. The first picture after it carries the timestamp the next picture would have had, plus the jump.
    t1 = t0 + a.first_end * FRAME_US + int(a.pause_s * 1e6)
    shift = int(round(a.jump_s * 90000)) - (a.resume_at - a.first_end) * RTP_PER_FRAME
    ts2 = lambda k: base + k * RTP_PER_FRAME + shift
    facts["first_ts_after"] = ts2(a.resume_at)
    facts["last_ts_before"] = base + (a.first_end - 1) * RTP_PER_FRAME
    if a.reconnect in ("teardown", "close") and seq is not None:
        facts["first_connection_ended_by"], facts["first_connection_ended_real_us"] = a.reconnect, real_us()
        if a.reconnect == "teardown":
            teardown(sock, state, a.url)
        else:
            sock.close()
        wait = t1 - 600000 - real_us()                    # the second handshake begins 0.6 s before the resumed picture is due
        if wait > 0:
            time.sleep(wait / 1e6)
        first = len(facts["attempts"])
        facts["second_connection_from_real_us"] = real_us()
        sock, state = connect(a.url, sdp, 10, facts)
        facts["second_connection_attempts"] = len(facts["attempts"]) - first
        facts["second_connection_established"] = sock is not None
        if sock is None:
            facts["result"] = "SECOND_CONNECTION_NOT_ESTABLISHED"
            out()
            sys.exit(0)
        seq, counters = 1, [0, 0]
        t1 = max(t1, real_us() + 50000)
    if seq is not None:
        seq = send_part(sock, a.resume_at, a.end_at, t1, ts2, seq, counters, "resumed")
    if seq is not None:
        teardown(sock, state, a.url)
    facts["result"] = "DONE" if seq is not None else "SEND_FAILED"
    out()
    sys.stderr.write("ROW010_PUSH %s\n" % facts["result"])


# ------------------------------------------------------------------------------------------ the clip and its reference
def sh(cmd, **kw):
    return subprocess.run(cmd, capture_output=True, text=True, stdin=subprocess.DEVNULL, **kw)


def framemd5(path, sel=None):
    """One MD5 per decoded picture, in output order, and what the decoder said at level error."""
    r = sh([S.FF, "-hide_banner", "-nostdin", "-v", "error", "-i", path] + (["-map", sel] if sel else []) + ["-an", "-fps_mode", "passthrough", "-f", "framemd5", "-"])
    rows = [l.split(",")[-1].strip() for l in r.stdout.splitlines() if l and not l.startswith("#")]
    return rows, r.returncode, [l for l in r.stderr.splitlines() if l.strip()]


def cmd_clip(_=None):
    """The clip of every push (encoded once, by the installed ffmpeg program) and the MD5 of each of its pictures."""
    os.makedirs(os.path.dirname(CLIP), exist_ok=True)
    ref = CLIP + ".framemd5.json"
    if not (os.path.exists(CLIP) and os.path.exists(ref)):
        cmd = [S.FF, "-hide_banner", "-nostdin", "-v", "error", "-y", "-f", "lavfi", "-i", "testsrc2=size=320x240:rate=%d" % FPS, "-frames:v", str(CLIP_FRAMES), "-pix_fmt", "yuv420p",
               "-c:v", "libx264", "-preset", "ultrafast", "-tune", "zerolatency", "-threads", "1",
               "-x264-params", "scenecut=0:keyint=%d:min-keyint=%d:sliced-threads=0:slices=1:bframes=0:aud=0" % (GOP, GOP), "-bsf:v", "h264_mp4toannexb", "-f", "h264", CLIP]
        r = sh(cmd)
        if r.returncode:
            sys.exit("the clip was not encoded: %s" % r.stderr[-400:])
        md5, rc, err = framemd5(CLIP)
        if rc or err or len(md5) != CLIP_FRAMES or len(set(md5)) != CLIP_FRAMES:
            sys.exit("the reference decode of the clip is not %d different pictures without an error: %d, %d distinct, rc %s, %r" % (CLIP_FRAMES, len(md5), len(set(md5)), rc, err[:3]))
        json.dump({"command": " ".join(cmd), "frames": CLIP_FRAMES, "md5": md5}, open(ref, "w"))
    _, _, pictures = S.access_units(CLIP, CLIP_FRAMES)
    keys = [k for k, p in enumerate(pictures) if p[0] & 31 == 5]
    info = {"clip": os.path.relpath(CLIP, REPO), "bytes": os.path.getsize(CLIP), "sha256": hashlib.sha256(open(CLIP, "rb").read()).hexdigest(), "pictures": len(pictures),
            "keyframes_every_50": keys == list(range(0, CLIP_FRAMES, GOP)), "largest_picture_bytes": max(len(p) for p in pictures), "smallest_picture_bytes": min(len(p) for p in pictures)}
    return json.load(open(ref))["md5"], info


# ------------------------------------------------------------------------------------------ one run
def packets(path, sel):
    r = sh([E.FP, "-v", "error", "-select_streams", sel, "-show_entries", "packet=pts,dts,duration,flags,size", "-of", "json", path])
    try:
        return json.loads(r.stdout).get("packets", [])
    except ValueError:
        return []


def timebase(path, sel):
    r = sh([E.FP, "-v", "error", "-select_streams", sel, "-show_entries", "stream=time_base,codec_name,nb_frames", "-of", "json", path])
    try:
        st = json.loads(r.stdout)["streams"][0]
        return int(st["time_base"].split("/")[1]), st.get("codec_name")
    except (ValueError, KeyError, IndexError):
        return 0, None


def file_facts(path, sent, ref_md5, first_end, resume_at):
    """What one camera file holds. `sent`: the clip pictures the pusher sent, in order."""
    f = {"exists": os.path.exists(path), "bytes": os.path.getsize(path) if os.path.exists(path) else 0}
    if not f["bytes"]:
        return f
    f["sha256"] = hashlib.sha256(open(path, "rb").read()).hexdigest()
    bw = H.boxes(path)
    moofs = [b for b in bw["boxes"] if b["type"] == "moof"]
    f["boxes"] = {"tiles_exactly": bw["tiles_exactly"], "moof": len(moofs), "video_samples_per_fragment": [b["tracks"].get(1, {}).get("samples", 0) for b in moofs],
                  "audio_samples_per_fragment": [b["tracks"].get(2, {}).get("samples", 0) for b in moofs]}
    den, codec = timebase(path, "v:0")
    vp = packets(path, "v:0")
    pts = [int(p["pts"]) for p in vp]
    f["video"] = {"codec": codec, "packets": len(vp), "time_base_den": den, "keyframe_flags": sum(1 for p in vp if "K" in p.get("flags", ""))}
    if len(pts) > 1 and den:
        deltas = [b - a for a, b in zip(pts, pts[1:])]
        big = max(range(len(deltas)), key=lambda i: deltas[i])
        f["video"].update({"first_pts_s": round(pts[0] / den, 3), "last_pts_s": round(pts[-1] / den, 3), "largest_step_s": round(deltas[big] / den, 3), "largest_step_before_packet": big + 1,
                           "steps_above_60ms": sum(1 for d in deltas if d > den * 0.06), "steps_not_forward": sum(1 for d in deltas if d <= 0),
                           "steps_below_10ms": sum(1 for d in deltas if 0 < d < den * 0.01), "packet_after_largest_step_is_keyframe": "K" in vp[big + 1].get("flags", "")})
    aden, acodec = timebase(path, "a:0")
    ap = packets(path, "a:0")
    apts = [int(p["pts"]) for p in ap]
    f["audio"] = {"codec": acodec, "packets": len(ap)}
    if len(apts) > 1 and aden:
        ad = [b - a for a, b in zip(apts, apts[1:])]
        f["audio"].update({"first_pts_s": round(apts[0] / aden, 3), "last_pts_s": round(apts[-1] / aden, 3), "steps_not_1024": sum(1 for d in ad if d != 1024)})
    # The decode, three ways: every message of level error; the exit code when the first error ends it; the pictures.
    d = sh([E.FF, "-hide_banner", "-nostdin", "-v", "error", "-i", path, "-f", "null", "-"])
    x = sh([E.FF, "-hide_banner", "-nostdin", "-v", "error", "-xerror", "-err_detect", "explode", "-i", path, "-f", "null", "-"])
    w = sh([E.FF, "-hide_banner", "-nostdin", "-v", "warning", "-i", path, "-map", "0:v:0", "-f", "null", "-"])
    lines = [l for l in d.stderr.splitlines() if l.strip()]
    f["decode"] = {"rc": d.returncode, "error_lines": len(lines), "first_error_lines": [l[:160] for l in lines[:4]], "rc_strict": x.returncode,
                   "strict_first_line": (x.stderr.strip().splitlines() or [""])[0][:160], "video_warning_lines": len([l for l in w.stderr.splitlines() if l.strip()]),
                   "first_video_warning_lines": [l[:160] for l in w.stderr.splitlines() if l.strip()][:4]}
    md5, rc, err = framemd5(path, "0:v:0")
    pic = {"decoded": len(md5), "framemd5_rc": rc, "framemd5_error_lines": len(err)}
    # Which clip picture is each decoded picture? The file begins on a keyframe of the clip; from there the pictures
    # the pusher sent follow in order. A decoded picture is INTACT when its MD5 is the one of the clip picture at
    # its place.
    start = next((i for i, k in enumerate(sent) if md5 and ref_md5[k] == md5[0]), None)
    pic["first_picture_is_clip_picture"] = sent[start] if start is not None else None
    if start is not None:
        expect = sent[start:]
        pic["pictures_sent_from_there"] = len(expect)
        next_key = ((resume_at + GOP - 1) // GOP) * GOP if resume_at >= 0 else None
        classes = {"before_the_pause": [0, 0], "resumed_before_next_keyframe": [0, 0], "from_next_keyframe_on": [0, 0]}
        for got, k in zip(md5, expect):
            c = "before_the_pause" if resume_at < 0 or k < first_end else ("resumed_before_next_keyframe" if k < next_key else "from_next_keyframe_on")
            classes[c][0 if got == ref_md5[k] else 1] += 1
        pic["intact_damaged"] = classes
        pic["damaged_total"] = sum(v[1] for v in classes.values())
        pic["decoded_minus_sent"] = len(md5) - len(expect)
    f["pictures"] = pic
    return f


class Listeners(threading.Thread):
    """Who listens on the two media ports while the session runs (sampled; lsof)."""

    def __init__(self, t0):
        super().__init__(daemon=True)
        self.t0, self.rows, self.on = t0, [], True

    def run(self):
        while self.on:
            ports = sorted({p for l in H.tcp_listeners() for p in H.PORTS if l.rstrip().endswith(":%d (LISTEN)" % p)})
            self.rows.append([round(time.monotonic() - self.t0, 2), ports])
            time.sleep(0.4)


def run(case, n):
    c = CASES[case]
    ref_md5, clip = cmd_clip()
    ti = (n - 1) % 2                                       # the camera under test alternates
    port, right, cport, cright = H.PORTS[ti], E.RIGHT[ti], H.PORTS[1 - ti], E.RIGHT[1 - ti]
    name = "%s_r%d" % (case, n)
    keep = {}

    def script(ctx):
        d = ctx["d"]
        keep["worker"] = ctx["worker"]
        lis = Listeners(ctx["t0"])
        lis.start()
        me = [sys.executable, os.path.abspath(__file__), "push", "--clip", CLIP]
        control_end = min(CLIP_FRAMES, int((FIRST_END + (TEST_END - c["resume_at"])) + c["pause_s"] * FPS) + 50)      # the control outlasts the push under test by 1 s
        cp = H.spawn(me + ["--url", E.url(cport, cright), "--tag", "control", "--facts", os.path.join(d, "control.json"), "--first-end", str(control_end), "--resume-at", "-1"],
                     stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=open(os.path.join(d, "control.err"), "w"))
        tp = H.spawn(me + ["--url", E.url(port, right), "--tag", "test", "--facts", os.path.join(d, "test.json"), "--first-end", str(FIRST_END), "--resume-at", str(c["resume_at"]),
                           "--end-at", str(TEST_END), "--pause-s", str(c["pause_s"]), "--jump-s", str(c["jump_s"])] + (["--reconnect", c["reconnect"]] if c["reconnect"] else []),
                     stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=open(os.path.join(d, "test.err"), "w"))
        started = time.monotonic() - ctx["t0"]
        rc = {}
        for tag, p in (("test", tp), ("control", cp)):
            try:
                rc[tag] = p.wait(timeout=90)
            except subprocess.TimeoutExpired:
                rc[tag] = "timeout"
        keep["pushers_ended_s"] = round(time.monotonic() - ctx["t0"], 2)
        keep["worker_alive_when_pushers_ended"] = ctx["worker"].p.poll() is None
        time.sleep(1.0)
        lis.on = False
        keep["listeners"] = lis.rows
        return {"observation": "ROW10", "case": case, "plan_of_case": c, "port_under_test": port, "paths_used": [right, cright], "pushers_started_s_after_start_ack": round(started, 2),
                "pusher_rc": rc, "control": {"port": cport, "path": cright, "rc": rc["control"], "rtsp_error_statuses": []}}

    r = E.session(name, script, listen_s=LISTEN_S)
    d = os.path.join(OUT, "runs", name)
    load = lambda tag: json.load(open(os.path.join(d, tag + ".json"))) if os.path.exists(os.path.join(d, tag + ".json")) else {}
    test, control = load("test"), load("control")
    log = H.worker_log(d)
    w = keep.get("worker")
    with w.lock:
        frames = [(t, f) for t, f in w.frames if f]
    records = [f for _, f in frames if f.get("type") == "RECORD"]
    dev = {port: "CAM-0%d" % (ti + 1), cport: "CAM-0%d" % (2 - ti)}
    src = {port: "ingest%d" % (ti + 1), cport: "ingest%d" % (2 - ti)}
    sent_test = [k for p in test.get("parts", []) for k in range(p["from"], p["from"] + p["sent"])]
    sent_control = [k for p in control.get("parts", []) for k in range(p["from"], p["from"] + p["sent"])]
    media = lambda p: os.path.join(d, "media", r["files"][str(p)]["file"])
    files = {port: file_facts(media(port), sent_test, ref_md5, FIRST_END, c["resume_at"]), cport: file_facts(media(cport), sent_control, ref_md5, FIRST_END, -1)}
    for p in (port, cport):
        if files[p]["bytes"]:
            tc = H.tail_check(media(p), H.checkpoints_of(records, dev[p]))
            fr = tc.get("fragments") or []
            vs = files[p]["boxes"]["video_samples_per_fragment"]
            with_video = [x for x, n_video in zip(fr, vs) if n_video] if len(fr) == len(vs) else []
            starts = [(x.get("media") or {}).get("mediaStartMs") for x in fr]
            files[p]["video_fragments"] = {"count": len(with_video), "starting_on_keyframe": sum(1 for x in with_video if (x.get("media") or {}).get("keyframe")),
                                           "fragment_starts_earlier_than_the_one_before": sum(1 for a, b in zip(starts, starts[1:]) if a is not None and b is not None and b < a)}
            files[p]["core_reader"] = {"ok": tc.get("ok"), "flags": tc.get("flags"), "state": tc.get("state"), "durable_equals_file": tc.get("durableLength") == tc.get("fileLength"), "tail": tc.get("tail"),
                                       "fragments": len(fr), "fragments_with_media_time": sum(1 for x in fr if x.get("media")), "fragments_starting_on_keyframe": sum(1 for x in fr if (x.get("media") or {}).get("keyframe")),
                                       "fragment_media": [[(x.get("media") or {}).get("mediaStartMs"), (x.get("media") or {}).get("mediaDurationMs"), (x.get("media") or {}).get("keyframe")] for x in fr],
                                       "comparison": tc.get("comparison"), "error": tc.get("error")}
    strip = lambda l: {k: v for k, v in l.items() if k not in ("t", "ts", "mono_us")}
    of = lambda p: [l for l in log if str(l.get("source", "")).endswith(src[p]) or l.get("port") == p or l.get("cam") == int(src[p][-1])]
    side = lambda p: {"port": p, "device": dev[p], "ingest_connected": sum(1 for l in log if l.get("message") == "ingest_connected" and l.get("port") == p),
                      "log_messages": [l.get("message") for l in of(p)],
                      "warn_error_lines": [strip(l) for l in of(p) if l.get("level") in ("warn", "error")],
                      "video_timestamp_moved": [strip(l) for l in of(p) if l.get("message") == "video_timestamp_moved"],
                      "camera_summary": next((strip(l) for l in log if l.get("message") == "camera_summary" and l.get("cam") == int(src[p][-1])), None),
                      "warning_frames": [[f.get("code"), f.get("reason"), f.get("state")] for _, f in frames if f.get("type") == "WARNING" and f.get("subject") == dev[p]],
                      "record_kinds": {k: sum(1 for x in records if x["record"].get("deviceId") == dev[p] and x["record"]["kind"] == k) for k in sorted({x["record"]["kind"] for x in records if x["record"].get("deviceId") == dev[p]})},
                      "keyframe_interval_records": [x["record"] for x in records if x["record"].get("deviceId") == dev[p] and x["record"]["kind"] == "KEYFRAME_INTERVAL"],
                      "file": files[p]}
    exit_line = next((l for l in log if l.get("message") == "worker_exit"), {})
    t0_real = next((l.get("t0_real_us") for l in log if l.get("message") == "audio_started"), None)
    r["row10"] = {"case": case, "plan": c, "clip": clip, "worker_sha256": hashlib.sha256(open(H.WORKER, "rb").read()).hexdigest(), "hello_version": (r.get("hello") or {}).get("workerVersion") or (r.get("hello") or {}).get("version"),
                  "test": side(port), "control": side(cport), "test_pusher": test, "control_pusher": control, "listeners_sampled": keep.get("listeners"),
                  "pushers_ended_s": keep.get("pushers_ended_s"), "worker_alive_when_pushers_ended": keep.get("worker_alive_when_pushers_ended"),
                  "worker_rc": r.get("worker_rc"), "stop_ack": r.get("stop_ack"), "worker_exit_code": exit_line.get("code"), "crash_frames": [f.get("code") for _, f in frames if f.get("type") == "CRASH"],
                  "session_warning_frames": [[f.get("code"), f.get("reason"), f.get("state"), f.get("subject")] for _, f in frames if f.get("type") == "WARNING"],
                  "audio_t0_real_us": t0_real, "path_text_occurrences": sum(r["path_text_in_worker_output"].values()), "leftovers": len(r["leftovers"]["processes"]) + len(r["leftovers"]["listeners"])}
    # When did the listener of the port under test stop listening, against the pusher's own times (seconds after the START acknowledgement)?
    lis = keep.get("listeners") or []
    last = max((t for t, ports in lis if port in ports), default=None)
    r["row10"]["port_under_test_last_seen_listening_s"] = last
    r["row10"]["port_under_test_listening_samples"] = [sum(1 for _, ports in lis if port in ports), len(lis)]
    json.dump(r, open(os.path.join(d, "result.json"), "w"), indent=1)
    return r


def line(r):
    x = r["row10"]
    t, c, tp = x["test"], x["control"], x["test_pusher"]

    def f(s):
        fl = s["file"]
        if not fl.get("bytes"):
            return "port %d ic=%d bytes=0" % (s["port"], s["ingest_connected"])
        v, pic, dec, core = fl["video"], fl["pictures"], fl["decode"], fl.get("core_reader", {})
        return ("port %d ic=%d bytes=%d moof=%d vpk=%d key=%d step_max=%ss before_pk=%s(key=%s) steps>60ms=%s not_fwd=%s <10ms=%s apk=%d a_not1024=%s decode[rc=%s err=%d strict_rc=%s warn=%d] "
                "pictures[decoded=%d first=%s intact/damaged=%s] core[ok=%s state=%s flags=%s frag=%s keyfrag=%s cmp=%s] video_frag=%s warn_frames=%s moved=%d retimed=%s") % (
            s["port"], s["ingest_connected"], fl["bytes"], fl["boxes"]["moof"], v["packets"], v["keyframe_flags"], v.get("largest_step_s"), v.get("largest_step_before_packet"), v.get("packet_after_largest_step_is_keyframe"),
            v.get("steps_above_60ms"), v.get("steps_not_forward"), v.get("steps_below_10ms"), fl["audio"]["packets"], fl["audio"].get("steps_not_1024"), dec["rc"], dec["error_lines"], dec["rc_strict"], dec["video_warning_lines"],
            pic["decoded"], pic.get("first_picture_is_clip_picture"), json.dumps(pic.get("intact_damaged")), core.get("ok"), core.get("state"), core.get("flags"), core.get("fragments"), core.get("fragments_starting_on_keyframe"),
            (core.get("comparison") or {}).get("verdict"), json.dumps(fl.get("video_fragments")), [y[1] for y in s["warning_frames"]], len(s["video_timestamp_moved"]), (s["camera_summary"] or {}).get("retimed"))
    second = ""
    if x["plan"]["reconnect"]:
        att = tp.get("attempts", [])[1:]
        second = " second_connection[established=%s attempts=%d errors=%s statuses=%s]" % (tp.get("second_connection_established"), len(att), sorted({(a.get("connect_error") or a.get("handshake_error") or "").split(":")[0] for a in att}),
                                                                                           [a.get("requests") for a in att if a.get("requests")][:2])
    return "%-14s test[%s] pusher[result=%s parts=%s send_errors=%d]%s listen_last_s=%s control[%s] worker rc=%s exit=%r crash=%s alive_at_pushers_end=%s path_text=%d leftover=%d" % (
        r["run"], f(t), tp.get("result"), [[p["part"], p["from"], p["sent"]] for p in tp.get("parts", [])], len(tp.get("send_errors", [])), second, x["port_under_test_last_seen_listening_s"], f(c),
        x["worker_rc"], x["worker_exit_code"], x["crash_frames"], x["worker_alive_when_pushers_ended"], x["path_text_occurrences"], x["leftovers"])


def summary():
    root, rows = os.path.join(OUT, "runs"), []
    for n in sorted(os.listdir(root)) if os.path.isdir(root) else []:
        p = os.path.join(root, n, "result.json")
        if os.path.exists(p):
            r = json.load(open(p))
            if "row10" in r:
                rows.append(r)
    lines = [line(r) for r in rows]
    open(os.path.join(OUT, "summary.txt"), "w").write("\n".join(lines) + "\nROW10 RESUMED PUSH: %d run(s) recorded\n" % len(rows))
    print("\n".join(lines))
    print("ROW10 RESUMED PUSH: %d run(s) recorded" % len(rows))


def main(argv):
    if argv and argv[0] == "push":
        ap = argparse.ArgumentParser()
        ap.add_argument("--url", required=True)
        ap.add_argument("--clip", required=True)
        ap.add_argument("--tag", required=True)
        ap.add_argument("--facts", required=True)
        ap.add_argument("--first-end", type=int, default=FIRST_END)
        ap.add_argument("--resume-at", type=int, default=-1, help="-1: no pause, one part (the control)")
        ap.add_argument("--end-at", type=int, default=TEST_END)
        ap.add_argument("--pause-s", type=float, default=0.0)
        ap.add_argument("--jump-s", type=float, default=0.0)
        ap.add_argument("--reconnect", choices=["teardown", "close"], default=None)
        return cmd_push(ap.parse_args(argv[1:]))
    global E, H
    import e11_listener_path as E_                       # read-only reuse: the session of two cameras and two microphones
    E, H = E_, E_.H
    E.RIGHT = ("g10/Nf4tW8qLc2Vr7Kd3", "g10/Yb6hJ1zXp9Fs5Ue2")   # the plan's two addresses of every session of this script
    what = argv[0] if argv else "summary"
    runs = int(argv[argv.index("--runs") + 1]) if "--runs" in argv else 3
    if what == "clip":
        print(json.dumps(cmd_clip()[1], indent=1))
        return
    if what not in CASES and what != "summary":
        sys.exit("usage: row010_resumed_push.py %s | clip | summary [--runs N]" % " | ".join(CASES))
    if what in CASES:
        for n in range(1, runs + 1):
            print(line(run(what, n)), flush=True)
            time.sleep(1.5)
        print("---- summary of every recorded run", flush=True)
    summary()


if __name__ == "__main__":
    main(sys.argv[1:])
