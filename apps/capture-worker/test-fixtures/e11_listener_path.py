#!/usr/bin/env python3
"""Experiment E-11 (blueprint row 6, security requirement AD-01 (1)-(3)): what does the RTSP listener of the
RELEASE capture worker do with a push that is not the one the plan names?

Test code only. It starts build/capture-worker as it is (nothing is built, no worker source is read at run
time) through the classes of test/m3worker.py (imported, not edited), with FFmpeg command-line encoders as
the pushers and build/fake_mic as the microphones. It records FACTS per run and classifies each run by the
letter of AD-01; it selects no branch.

    # repository root, command sandbox off (it binds two loopback ports and reads ps / lsof)
    M3_PORTS=8559,8561 /usr/bin/lockf -k -t 1800 .locks/heavy-host.lock \
        python3 apps/capture-worker/test-fixtures/e11_listener_path.py all
    ... e11_listener_path.py o1 [--runs 3] | o2 | o3 | o3s | o1s | smoke | summary

Observations
  O-1   a push to ANOTHER path than the plan's, before any other client, for seven near-miss paths
  O-2   a second client on the RIGHT path after the first one is connected
  O-3   the RIGHT path after a wrong-path push on the same listener
  O-3s  (supplementary, not in the row) the RIGHT path after a client that only sent OPTIONS to a wrong
        path and went away
  O-1s  (supplementary, not in the row) the RTSP handshake alone, by a raw client, to the trailing-slash near
        miss: OPTIONS, ANNOUNCE, SETUP, RECORD, then the connection is closed. `single` asks for the track as
        <path>/streamid=0, `double` as <path>//streamid=0 (what the FFmpeg client sends for a path that ends in
        a slash). No media is sent, so this can show a status, never an `ingest_connected`.

The control (AD-01 (1)): in EVERY run the other camera of the same worker session is pushed by the same
pusher command, at the same moment, to its RIGHT path. A listener serves one client by design, so the control
cannot use the listener under test; the camera under test alternates between the two listeners from run to run.

Everything a run writes lands under .cache/e11-listener-path/ (git-ignored): 0 media in the tracked tree."""
import json, os, re, shutil, socket, subprocess, sys, time

sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
os.environ.setdefault("M3_PORTS", "8559,8561")
sys.path.insert(0, os.path.join(REPO, "apps", "capture-worker", "test"))
import m3worker as H                                   # read-only reuse of the harness

OUT = os.environ.get("E11_OUT") or os.path.join(REPO, ".cache", "e11-listener-path")
FF, FP = H.FF, H.FP
FPS, FRAMES, GOP, SIZE = 25, 200, 25, "320x240"        # 8 s per push
LISTEN_S = 12                                           # the harness default of the worker's listen timeout
O3_LISTEN_S = 30                                        # O-3: wide, so that the push that follows is inside the window
# The plan's paths: two components, mixed case, in the worker's grammar (src/capture_worker.c, parse_listen_url).
RIGHT = ("e11/Kq7xR2mV9tLc4Zp1", "e11/Wd5nH8bJ3yGs6Tf0")


def near_misses(right):
    """The seven near-miss paths of AD-01 (2), derived from the right path of the listener under test."""
    last = "2" if right[-1] != "2" else "3"
    head, tail = right.split("/", 1)
    return [
        ("last_character", right[:-1] + last),
        ("strict_prefix", right[:-8]),
        ("one_more_component", right + "/x"),
        ("letter_case", right.lower() if right.lower() != right else right.upper()),
        ("trailing_slash", right + "/"),
        ("query_string", right + "?x=1"),
        ("percent_encoded_character", "%s/%%%02X%s" % (head, ord(tail[0]), tail[1:])),
    ]


def url(port, path):
    return "rtsp://127.0.0.1:%d/%s" % (port, path)


def ff_cmd(u, frames=FRAMES):
    return [FF, "-hide_banner", "-nostdin", "-loglevel", "trace", "-re", "-f", "lavfi", "-i", "testsrc2=size=%s:rate=%d" % (SIZE, FPS),
            "-frames:v", str(frames), "-an", "-pix_fmt", "yuv420p", "-g", str(GOP), "-bf", "0",
            "-c:v", "libx264", "-preset", "ultrafast", "-tune", "zerolatency", "-x264-params", "scenecut=0:keyint=%d:min-keyint=%d" % (GOP, GOP),
            "-f", "rtsp", "-rtsp_transport", "tcp", u]


class Push:
    """One FFmpeg pusher: its command, its log (level trace: every request it sent and every reply line it read)."""

    def __init__(self, d, tag, port, path, t0, frames=FRAMES):
        self.tag, self.port, self.path, self.url = tag, port, path, url(port, path)
        self.log = os.path.join(d, "%s.log" % tag)
        self.cmd = ff_cmd(self.url, frames)
        self.started_s = round(time.monotonic() - t0, 2)
        self.p = H.spawn(self.cmd, stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=open(self.log, "w"))
        self.rc = None

    def wait(self, timeout=45):
        try:
            self.rc = self.p.wait(timeout=timeout)
        except subprocess.TimeoutExpired:
            self.rc = "timeout"
        return self.rc

    def facts(self):
        return dict(tag=self.tag, pusher="ffmpeg", port=self.port, path=self.path, url=self.url, started_s_after_start_ack=self.started_s,
                    rc=self.rc, command=" ".join(self.cmd), **rtsp_exchange(self.log))


RE_REPLY = re.compile(r"line='(RTSP/1\.0 (\d{3})[^']*)'")
RE_REQ = re.compile(r"^(OPTIONS|ANNOUNCE|SETUP|RECORD|TEARDOWN|DESCRIBE|PLAY|PAUSE|GET_PARAMETER|SET_PARAMETER) (\S+) RTSP/1\.0\s*$")


def rtsp_exchange(log):
    """From the pusher's own trace log: the request lines it sent ('Sending:' blocks) and the status lines it
    read back, in order, and every line that names a failure."""
    sent, got, errors, after_sending = [], [], [], False
    for l in open(log, errors="replace"):
        s = l.rstrip("\n")
        if s.rstrip().endswith("Sending:"):
            after_sending = True
            continue
        if after_sending:
            m = RE_REQ.match(s.strip())
            if m:
                sent.append([m.group(1), m.group(2)])
            after_sending = False
            continue
        m = RE_REPLY.search(s)
        if m:
            got.append([int(m.group(2)), m.group(1)])
            continue
        low = s.lower()
        if ("refused" in low or "failed" in low or "error opening" in low or "broken pipe" in low or "reset by peer" in low or "error writing" in low or "server returned" in low) and len(errors) < 12:
            errors.append(s.strip()[:300])
    pairs = [[m, u, got[i][0] if i < len(got) else None] for i, (m, u) in enumerate(sent)]
    return {"requests_sent_with_status": pairs, "status_lines_read": [g[1] for g in got],
            "rtsp_error_statuses": [g[0] for g in got if g[0] >= 400],
            "tcp_connection_refused": any("connection refused" in e.lower() for e in errors) and not sent,
            "failure_lines": errors, "log_bytes": os.path.getsize(log)}


def raw_options(port, path, hold_s=0.3):
    """Supplementary client of O-3s: one TCP connection, ONE request (OPTIONS to the given path), the reply is
    read, the connection is closed. It never announces a stream."""
    out = {"pusher": "raw-options", "port": port, "path": path, "url": url(port, path)}
    req = "OPTIONS %s RTSP/1.0\r\nCSeq: 1\r\nUser-Agent: e11-raw\r\n\r\n" % url(port, path)
    try:
        s = socket.create_connection(("127.0.0.1", port), timeout=3)
    except OSError as e:
        out["connect_error"] = str(e)
        return out
    try:
        s.sendall(req.encode())
        s.settimeout(3)
        try:
            data = s.recv(4096)
        except OSError as e:
            data, out["read_error"] = b"", str(e)
        out["reply"] = data.decode("latin1").split("\r\n\r\n")[0].split("\r\n")
        out["status_line"] = out["reply"][0] if data else None
        time.sleep(hold_s)
    finally:
        s.close()
    return out


SDP = "\r\n".join(["v=0", "o=- 0 0 IN IP4 127.0.0.1", "s=No Name", "c=IN IP4 127.0.0.1", "t=0 0", "a=tool:libavformat 63.1.102", "m=video 0 RTP/AVP 96",
                   "a=rtpmap:96 H264/90000", "a=fmtp:96 packetization-mode=1; sprop-parameter-sets=Z0LADdoFB+wEQAAAAwBAAAAMo8UKqA==,aM4PyA==; profile-level-id=42C00D",
                   "a=control:streamid=0", ""])       # the description the FFmpeg pusher of this script announces (copied from its log)


def raw_handshake(port, path, track_url):
    """Supplementary client of O-1s: the four requests of a push, no media. Returns each request with the status
    line read back (None = the listener closed the connection without an answer)."""
    u = url(port, path)
    reqs = [("OPTIONS", u, "", ""), ("ANNOUNCE", u, "Content-Type: application/sdp\r\nContent-Length: %d\r\n" % len(SDP), SDP),
            ("SETUP", track_url, "Transport: RTP/AVP/TCP;unicast;interleaved=0-1;mode=record\r\n", ""), ("RECORD", u, "Range: npt=0.000-\r\n", "")]
    out = {"pusher": "raw-handshake", "port": port, "path": path, "url": u, "requests_sent_with_status": [], "status_lines_read": []}
    try:
        s = socket.create_connection(("127.0.0.1", port), timeout=3)
    except OSError as e:
        out["connect_error"] = str(e)
        return out
    session_id = None
    try:
        s.settimeout(3)
        for i, (m, target, head, body) in enumerate(reqs):
            if m == "RECORD" and session_id:                 # a push names the session the SETUP answer gave it
                head += "Session: %s\r\n" % session_id
            s.sendall(("%s %s RTSP/1.0\r\nCSeq: %d\r\nUser-Agent: e11-raw\r\n%s\r\n%s" % (m, target, i + 1, head, body)).encode())
            data = b""
            try:
                while b"\r\n\r\n" not in data:
                    chunk = s.recv(4096)
                    if not chunk:
                        break
                    data += chunk
            except OSError as e:
                out["read_error"] = "%s: %s" % (m, e)
            status = data.decode("latin1").split("\r\n")[0] if data else None
            for h in data.decode("latin1").split("\r\n")[1:]:
                if h.lower().startswith("session:"):
                    session_id = h.split(":", 1)[1].strip().split(";")[0]
            out["requests_sent_with_status"].append([m, target, int(status.split()[1]) if status and status.startswith("RTSP/1.0 ") else None])
            if status:
                out["status_lines_read"].append(status)
            else:
                break
        time.sleep(0.3)
    finally:
        s.close()
    out["rtsp_error_statuses"] = [x[2] for x in out["requests_sent_with_status"] if x[2] and x[2] >= 400]
    out["record_named_the_session"] = bool(session_id)
    return out


def ingest_connected(d):
    return [l for l in H.worker_log(d) if l.get("message") == "ingest_connected"]


def wait_connected(d, port, timeout):
    end = time.monotonic() + timeout
    while time.monotonic() < end:
        try:
            if any(l.get("port") == port for l in ingest_connected(d)):
                return True
        except ValueError:                                # a line caught half written
            pass
        time.sleep(0.1)
    return False


def file_facts(path):
    if not os.path.exists(path):
        return {"exists": False, "bytes": 0}
    out = {"exists": True, "bytes": os.path.getsize(path)}
    if out["bytes"]:
        r = H.sh([FP, "-v", "error", "-count_frames", "-select_streams", "v:0", "-show_entries", "stream=codec_name,width,height,nb_read_frames", "-of", "json", path])
        try:
            st = json.loads(r.stdout)["streams"]
            out["video"] = st[0] if st else None
        except (ValueError, KeyError):
            out["video"] = "ffprobe: %s" % r.stderr.strip()[:200]
    return out


def session(name, script, listen_s=LISTEN_S):
    """One worker session with two cameras and two microphones. `script(ctx)` starts the pushers and returns
    the facts of the observation; what the worker did is collected here."""
    d = os.path.join(OUT, "runs", name)
    if os.path.isdir(d):
        shutil.rmtree(d)
    os.makedirs(d)
    H.ports_free_or_exit()
    sid = "S-E11-%s" % name.upper().replace("_", "-")
    plan = H.make_plan(d, sid, names=RIGHT)
    res = {"run": name, "sessionId": sid, "ports": list(H.PORTS), "right_paths": {str(p): r for p, r in zip(H.PORTS, RIGHT)},
           "worker": H.WORKER, "listen_timeout_s": listen_s, "load_at_start": os.getloadavg(), "utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}
    procs = []
    w = H.Worker(d, H.WORKER, listen_timeout_s=listen_s)
    procs.append(w.p)
    try:
        _, hello = w.wait(lambda f: f.get("type") == "HELLO", 5, "HELLO")
        res["hello"] = hello
        _, ack = w.ack(w.command(sid, "START", attempt=1, plan=plan))
        t0 = time.monotonic()
        res["start_ack_ok"] = ack["ok"]
        if ack["ok"]:
            while len(H.tcp_listeners()) < 2 and time.monotonic() - t0 < 5:
                time.sleep(0.05)
            res["listeners_before_pushers"] = H.own_sockets()["listeners"]
            mic = H.spawn([H.MIC, "--out1", plan["mics"][0]["input"]["path"], "--out2", plan["mics"][1]["input"]["path"],
                           "--manifest", os.path.join(d, "mic.jsonl"), "--seconds", "%.3f" % (FRAMES / FPS * 2 + 25)],
                          stdin=subprocess.DEVNULL, stderr=open(os.path.join(d, "mic.err"), "w"))
            procs.append(mic)
            time.sleep(1.5)                                 # the audio timeline (T0) exists before the first video packet
            ctx = {"d": d, "t0": t0, "procs": procs, "worker": w}
            res.update(script(ctx))
            time.sleep(1.5)
            if w.p.poll() is None:
                try:
                    res["stop_ack"] = w.ack(w.command(sid, "STOP", reason="STOPPED"))[1].get("ok")
                except (RuntimeError, BrokenPipeError) as e:
                    res["stop_ack"] = "none: %s" % e
            res["worker_rc"] = w.exit(20)
    finally:
        H.killall(procs)
        H.killall(H.OWN)
    time.sleep(0.3)
    res["leftovers"] = H.leftovers()
    log = H.worker_log(d)
    res["worker_ingest_connected"] = [{"source": l.get("source"), "port": l.get("port"), "codec": l.get("codec"), "width": l.get("width")} for l in log if l.get("message") == "ingest_connected"]
    res["worker_log_ingest_lines"] = [{k: v for k, v in l.items() if k not in ("t", "ts", "mono_us")} for l in log
                                      if str(l.get("source", "")).startswith(("ingest", "libav")) and l.get("message") not in ("camera_clock_floor",)][:40]
    res["worker_log_warn_error"] = [{k: v for k, v in l.items() if k not in ("t", "ts", "mono_us")} for l in log if l.get("level") in ("warn", "error")][:40]
    with w.lock:
        frames = [f for _, f in w.frames if f]
    res["worker_frames_other"] = [f for f in frames if f.get("type") not in ("HEARTBEAT", "TELEMETRY", "HELLO", "ACK", "RECORD")][:20]
    res["files"] = {str(H.PORTS[i]): dict(file=os.path.basename(c["outputPath"]), **file_facts(c["outputPath"])) for i, c in enumerate(plan["cameras"])}
    # RC-2 side fact: is any path text of this run in what the worker wrote (its log, its standard output)?
    texts = open(os.path.join(d, "worker.jsonl"), errors="replace").read() + "\n".join(w.raw)
    res["path_text_in_worker_output"] = {p: texts.count(p) for p in sorted(set(res.get("paths_used", [])))}
    classify(res)
    json.dump(res, open(os.path.join(d, "result.json"), "w"), indent=1)
    return res


def accepted(res, port):
    """ACCEPTED on a listener = the worker logged `ingest_connected` for that port AND its file holds bytes."""
    return any(c["port"] == port for c in res["worker_ingest_connected"]), res["files"][str(port)]["bytes"]


def classify(res):
    """By the letter of AD-01 (1)-(3). REFUSED: the pusher read an RTSP error status, the worker wrote no
    `ingest_connected` for the port and 0 bytes, and the control of the run was accepted. A run without an
    accepted control is INCONCLUSIVE whatever else it shows; so is a refusal seen only as a timeout or as a
    refused TCP connection."""
    cport = res["control"]["port"]
    cc, cb = accepted(res, cport)
    res["control_result"] = {"path": res["control"]["path"], "ingest_connected": cc, "bytes": cb, "rc": res["control"]["rc"],
                             "rtsp_error_statuses": res["control"]["rtsp_error_statuses"], "accepted": bool(cc and cb > 0)}
    ctl = res["control_result"]["accepted"]
    obs = res["observation"]
    tport = res["port_under_test"]
    tc, tb = accepted(res, tport)
    res["port_under_test_result"] = {"ingest_connected_lines": sum(1 for c in res["worker_ingest_connected"] if c["port"] == tport), "bytes": tb}
    why = []
    if obs == "O-1":
        t = res["test_push"]
        if not ctl:
            out, why = "INCONCLUSIVE", ["the control was not accepted"]
        elif tc and tb > 0:
            out = "ACCEPTED"
        elif t["rtsp_error_statuses"] and not tc and tb == 0:
            out = "REFUSED"
        else:
            out, why = "INCONCLUSIVE", ["neither `ingest_connected` with bytes nor an RTSP error status with 0 bytes"]
        res["outcome"] = out
    elif obs == "O-1s":
        st = res["test_push"]["requests_sent_with_status"]
        ended = [m for m, _, code in st if code != 200]
        if not ctl:
            out, why = "INCONCLUSIVE", ["the control was not accepted"]
        else:
            out = "HANDSHAKE_200_THROUGH_RECORD" if len(st) == 4 and not ended else "HANDSHAKE_ENDED_AT_%s" % (ended[0] if ended else "?")
        why = why + ["supplementary: no media was sent"]
        res["outcome"] = out
    elif obs == "O-2":
        s = res["second_push"]
        n = res["port_under_test_result"]["ingest_connected_lines"]
        if not ctl or not res.get("first_connected_before_second"):
            out, why = "INCONCLUSIVE", ["the control was not accepted" if not ctl else "the first client was not connected when the second started"]
        elif n >= 2 or s["rc"] == 0:
            out = "ACCEPTED"
        elif s["rtsp_error_statuses"] and n == 1:
            out = "REFUSED"
        else:
            out = "INCONCLUSIVE"
            why = ["the second client read no RTSP status: %s" % ("its TCP connection was refused" if s["tcp_connection_refused"] else "rc %r" % s["rc"]),
                   "AD-01 (3) counts a refused connection as INCONCLUSIVE"]
        res["outcome"] = out
    elif obs in ("O-3", "O-3s"):
        f, r = res["first_client"], res["right_push"]
        res["first_client_was"] = f.get("was")
        if not ctl:
            out, why = "INCONCLUSIVE", ["the control was not accepted"]
        elif r["rc"] == 0 and tb > 0 and tc and f.get("was") != "ACCEPTED":
            out = "CONNECTS"
        elif r["tcp_connection_refused"] or r["rc"] not in (0, None):
            out = "LISTENER_CONSUMED"
        else:
            out = "INCONCLUSIVE"
        if obs == "O-3" and f.get("was") != "REFUSED":
            why.append("precondition of O-3 not met: the wrong-path push before it was %s, not refused" % f.get("was"))
        res["outcome"] = out
    res["outcome_notes"] = why


def both(ctx, test_port, test_path, tag="test"):
    """The push under test and its control, started together: same command, only the address differs."""
    cport = [p for p in H.PORTS if p != test_port][0]
    t = Push(ctx["d"], tag, test_port, test_path, ctx["t0"])
    c = Push(ctx["d"], "control", cport, RIGHT[H.PORTS.index(cport)], ctx["t0"])
    return t, c


def run_o1(kind_index, run_no):
    ti = (run_no - 1) % 2                                   # the listener under test alternates
    port, right = H.PORTS[ti], RIGHT[ti]
    kind, wrong = near_misses(right)[kind_index]

    def script(ctx):
        t, c = both(ctx, port, wrong)
        t.wait(); c.wait()
        return {"observation": "O-1", "near_miss": kind, "port_under_test": port, "right_path_of_port": right,
                "test_push": t.facts(), "control": c.facts(), "paths_used": [wrong, right, c.path]}
    return session("o1_%s_r%d" % (kind, run_no), script)


def run_o2(run_no):
    ti = (run_no - 1) % 2
    port, right = H.PORTS[ti], RIGHT[ti]

    def script(ctx):
        first, c = both(ctx, port, right, tag="first")
        conn = wait_connected(ctx["d"], port, 10)
        second = Push(ctx["d"], "second", port, right, ctx["t0"])
        second.wait(); first.wait(); c.wait()
        return {"observation": "O-2", "port_under_test": port, "right_path_of_port": right, "first_connected_before_second": conn,
                "first_push": first.facts(), "second_push": second.facts(), "control": c.facts(), "paths_used": [right, c.path]}
    return session("o2_r%d" % run_no, script)


def run_o3(run_no, supplementary=False):
    ti = (run_no - 1) % 2
    port, right = H.PORTS[ti], RIGHT[ti]
    wrong = near_misses(right)[0][1]

    def script(ctx):
        cport = [p for p in H.PORTS if p != port][0]
        if supplementary:
            c = Push(ctx["d"], "control", cport, RIGHT[H.PORTS.index(cport)], ctx["t0"])
            f = raw_options(port, wrong)
            f["started_s_after_start_ack"] = round(time.monotonic() - ctx["t0"], 2)
            f["was"] = "OPTIONS_ONLY_THEN_CLOSED"
            time.sleep(0.5)
        else:
            t, c = both(ctx, port, wrong, tag="wrong_first")
            # The wrong-path push is short of a full push only if the listener turns it away; otherwise it runs out.
            t.wait()
            f = t.facts()
            conn = any(l.get("port") == port for l in ingest_connected(ctx["d"]))
            f["was"] = "ACCEPTED" if conn else ("REFUSED" if f["rtsp_error_statuses"] else "NEITHER")
        r = Push(ctx["d"], "right_after", port, right, ctx["t0"])
        r.wait(); c.wait()
        return {"observation": "O-3s" if supplementary else "O-3", "port_under_test": port, "right_path_of_port": right, "first_client": f,
                "right_push": r.facts(), "control": c.facts(), "paths_used": [wrong, right, c.path],
                "right_push_inside_listen_window": r.started_s < O3_LISTEN_S}
    return session("%s_r%d" % ("o3s" if supplementary else "o3", run_no), script, listen_s=O3_LISTEN_S)


def run_o1s(run_no, form):
    ti = (run_no - 1) % 2
    port, right = H.PORTS[ti], RIGHT[ti]
    wrong = right + "/"

    def script(ctx):
        cport = [p for p in H.PORTS if p != port][0]
        c = Push(ctx["d"], "control", cport, RIGHT[H.PORTS.index(cport)], ctx["t0"])
        t = raw_handshake(port, wrong, url(port, wrong) + ("/" if form == "double" else "") + "streamid=0")
        t["started_s_after_start_ack"] = round(time.monotonic() - ctx["t0"], 2)
        c.wait()
        return {"observation": "O-1s", "near_miss": "trailing_slash", "setup_track_form": form, "port_under_test": port, "right_path_of_port": right,
                "test_push": t, "control": c.facts(), "paths_used": [wrong, right, c.path]}
    return session("o1s_%s_r%d" % (form, run_no), script)


def line(r):
    obs = r["observation"]
    if obs == "O-1s":
        t = r["test_push"]
        what = "raw handshake, track %-6s  path=%s statuses=%s" % (r["setup_track_form"], t["path"], [[x[0], x[2]] for x in t["requests_sent_with_status"]])
    elif obs == "O-1":
        t = r["test_push"]
        what = "%-26s path=%s statuses=%s rc=%s" % (r["near_miss"], t["path"], [x[2] for x in t["requests_sent_with_status"]], t["rc"])
    elif obs == "O-2":
        s = r["second_push"]
        what = "second client path=%s statuses=%s tcp_refused=%s rc=%s" % (s["path"], [x[2] for x in s["requests_sent_with_status"]], s["tcp_connection_refused"], s["rc"])
    else:
        f, s = r["first_client"], r["right_push"]
        what = "first=%s(%s) then right path=%s statuses=%s tcp_refused=%s rc=%s" % (f["path"], f.get("was"), s["path"], [x[2] for x in s["requests_sent_with_status"]], s["tcp_connection_refused"], s["rc"])
    c = r["control_result"]
    return "%-34s %-4s port %d  %s | ingest_connected=%d bytes=%d | control %s (ingest_connected=%s bytes=%d rc=%s) | %s%s" % (
        r["run"], obs, r["port_under_test"], what, r["port_under_test_result"]["ingest_connected_lines"], r["port_under_test_result"]["bytes"],
        "ACCEPTED" if c["accepted"] else "NOT ACCEPTED", c["ingest_connected"], c["bytes"], c["rc"], r["outcome"], (" [" + "; ".join(r["outcome_notes"]) + "]") if r["outcome_notes"] else "")


def summary():
    root = os.path.join(OUT, "runs")
    rows = []
    for n in sorted(os.listdir(root)) if os.path.isdir(root) else []:
        p = os.path.join(root, n, "result.json")
        if os.path.exists(p):
            rows.append(json.load(open(p)))
    lines = [line(r) for r in rows]
    counts = {}
    for r in rows:
        k = "%s%s%s" % (r["observation"], (" " + r["near_miss"]) if r.get("near_miss") else "", (" track=" + r["setup_track_form"]) if r.get("setup_track_form") else "")
        counts.setdefault(k, {}).setdefault(r["outcome"], 0)
        counts[k][r["outcome"]] += 1
    json.dump({"runs": len(rows), "counts": counts, "leftover_runs": [r["run"] for r in rows if r["leftovers"]["processes"] or r["leftovers"]["listeners"]]},
              open(os.path.join(OUT, "summary.json"), "w"), indent=1)
    with open(os.path.join(OUT, "summary.txt"), "w") as f:
        f.write("\n".join(lines) + "\n\n" + json.dumps(counts, indent=1) + "\n")
    print("\n".join(lines))
    print(json.dumps(counts, indent=1))


def main(argv):
    what = argv[0] if argv else "summary"
    runs = int(argv[argv.index("--runs") + 1]) if "--runs" in argv else 3
    todo = []
    if what == "smoke":
        todo = [lambda: run_o1(0, 1)]
    if what in ("o1", "all"):
        todo += [(lambda k=k, n=n: run_o1(k, n)) for k in range(7) for n in range(1, runs + 1)]
    if what in ("o2", "all"):
        todo += [(lambda n=n: run_o2(n)) for n in range(1, runs + 1)]
    if what in ("o3", "all"):
        todo += [(lambda n=n: run_o3(n)) for n in range(1, runs + 1)]
    if what in ("o3s", "all"):
        todo += [(lambda n=n: run_o3(n, supplementary=True)) for n in range(1, runs + 1)]
    if what == "o1s":
        todo += [(lambda n=n: run_o1s(n, "single")) for n in range(1, runs + 1)] + [(lambda n=n: run_o1s(n, "double")) for n in range(1, runs + 1)]
    if not todo and what != "summary":
        sys.exit("usage: e11_listener_path.py all | o1 | o2 | o3 | o3s | o1s | smoke | summary [--runs N]")
    for f in todo:
        r = f()
        print(line(r), flush=True)
        time.sleep(1.5)
    if todo:
        print("---- summary of every recorded run", flush=True)
    summary()


if __name__ == "__main__":
    main(sys.argv[1:])
