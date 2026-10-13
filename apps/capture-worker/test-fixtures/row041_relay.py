#!/usr/bin/env python3
"""Task 4 blueprint row 41 (WP-03a): the adapter-level run of the capture relay, record mode. Test code only.

    test camera (rtsp_test_camera.py, a pull-side double with Digest)  ->  build/capture-relay  ->  the release
    capture worker with a live session, whose plan holds a session-shaped ingest address (session, track, a
    last element of 22 URL-safe characters: the form of apps/core-server/src/capture/ingest-address.ts)

Every session run has its control: the worker's other camera is pushed by the FFmpeg pusher of
e11_listener_path.py at the same time and must record. The relay is started the way the Core's production door
starts it (apps/core-server/src/capture/adapters/production-door.ts): no shell, an EMPTY environment, no
argument, three pipes, ONE compact JSON line on standard input, which then stays open.

    # repository root, command sandbox off (loopback ports 8559, 8561 of the worker and 8565 of the camera,
    # ps and lsof); `make -C apps/capture-worker` first
    M3_PORTS=8559,8561 /usr/bin/lockf -k -t 1800 .locks/heavy-host.lock \
        python3 -B apps/capture-worker/test-fixtures/row041_relay.py all
    ... row041_relay.py record | basic | wrong | ends | start | summary

Cases
  record   h264 and hevc, each with the parameter sets in the description and in the stream; a camera that offers
           Basic AND Digest; the account with the awkward characters. The worker records, the file holds every
           picture the relay forwarded, it decodes with 0 errors, its codec is the camera's. During the run: the
           relay's arguments and environment hold nothing of the session; its sockets are two connected stream
           sockets, none listening, no datagram.
  basic    a camera that challenges Basic only, 2 runs: exit AUTH_SCHEME_NOT_ALLOWED; requests with an
           Authorization header the camera received: 0 (of any scheme); nothing recorded.
  wrong    a wrong password: exit AUTH_REFUSED after ONE refused Digest answer; nothing recorded.
  ends     the relay ends when its standard input closes (exit 0, the worker's file is closed cleanly), and when
           the worker goes away (exit INGEST_LOST); no process is left.
  start    the start message and the start itself, without a worker: an argument, a message that is not the
           contract (ten forms), no message inside the bound, a camera that is not there, another host in the
           description's control address, a redirect, and a camera that challenges Digest first and Basic once
           it holds the answer (one Digest answer left, never a Basic one).

The account is the test camera's own synthetic constant (imported, never written here). No value of the account,
the locator or the ingest address is printed or stored by this script: a result holds counts of those texts in
what the relay wrote, in its argument list and in its environment (0 is required). Everything a run writes lands
under .cache/row041-relay/ (git-ignored)."""
import json, os, re, secrets, signal, socket, subprocess, sys, threading, time

sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
OUT = os.path.join(REPO, ".cache", "row041-relay")
os.environ.setdefault("M3_PORTS", "8559,8561")
os.environ["E11_OUT"] = OUT
sys.path.insert(0, HERE)
import e11_listener_path as E                            # read-only reuse: the worker session, the control pusher
import rtsp_test_camera as CAM                           # read-only: the synthetic account constants
H = E.H

RELAY = os.path.join(H.BUILD, "capture-relay")
CAMERA = os.path.join(HERE, "rtsp_test_camera.py")
CAMERA_PORT = 8565                                       # decision C33: the test camera binds 8565-8574
SPARE_PORT = 8567                                        # raw doubles of this script (a redirect, a foreign control address)
DEAD_PORT = 8574                                         # nothing listens here
FRAMES = 150                                             # 6 s of the camera's clip per record run
WRONG = "not-the-synthetic-password"
CODES = {"STOPPED": 0, "USAGE": 2, "START_MESSAGE_INVALID": 10, "START_MESSAGE_TIMEOUT": 11, "CAMERA_UNREACHABLE": 20, "AUTH_SCHEME_NOT_ALLOWED": 22, "AUTH_REFUSED": 23,
         "REDIRECT_REFUSED": 25, "CONTROL_ADDRESS_REFUSED": 26, "CAMERA_LOST": 32, "INGEST_LOST": 41}
# Row 43: the ends of the camera leg that the relay opens again once the push stands (the cause of a loss line), and
# everything standard output may hold in record mode: "push established", then per loss one line and at most one re-open.
LOSS_CAUSE = {"CAMERA_STALLED": 31, "CAMERA_LOST": 32}
REPORT_LINES = (r'\{"report":"push_established","v":1,"attempt":\d+\}\n'
                r'(\{"report":"camera_lost","v":1,"attempt":\d+,"loss":\d+,"cause":\d+\}\n(\{"report":"camera_reopened","v":1,"attempt":\d+,"loss":\d+,"tries":\d,"held_back":\d+,"gap_ms":\d+\}\n)?)*')


# Row 143b: the source address a record message must state (relay.h "THE SOURCE ADDRESS"). Every double of this Mac
# is on loopback, so the address of this host the camera leg leaves from is loopback too.
SOURCE = "127.0.0.1"


def start_message(ingest, locator, user, secret, **more):
    """The door's bytes: `startMessageBytes` writes the members in order, compact, one line feed last.
    Row 143b: `source` is stated (SOURCE); `source=<text>` states another one, `source=None` states none."""
    m = {"type": "start", "mode": "record", "ingest": ingest, "source": SOURCE, "access": {"locator": locator, "username": user, "secret": secret}}
    m.update(more)
    if m.get("source") is None:
        del m["source"]
    return (json.dumps(m, separators=(",", ":"), ensure_ascii=False) + "\n").encode("utf-8")


class Relay:
    """One relay process, started as the production door starts it."""

    def __init__(self, d, message, args=(), tag="relay"):
        self.d, self.tag, self.t0 = d, tag, time.monotonic()
        self.p = H.spawn([RELAY] + list(args), stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, env={}, close_fds=True)
        self.out, self.err, self.rc, self.took = b"", b"", None, None
        self.readers = [threading.Thread(target=self._read, args=(n,), daemon=True) for n in ("out", "err")]
        for t in self.readers:
            t.start()
        if message is not None:
            try:
                self.p.stdin.write(message)
                self.p.stdin.flush()
            except OSError:
                pass

    def _read(self, name):
        # Row 43: read as it comes (the relay now says a loss while it runs, and a run acts on that line).
        stream = self.p.stdout if name == "out" else self.p.stderr
        for chunk in iter(lambda: stream.read1(65536), b""):
            setattr(self, name, getattr(self, name) + chunk)

    def saw(self, text, timeout, stream="out"):
        """Row 43: the monotonic time at which `text` stood in what the relay wrote so far, or None after `timeout`."""
        end = time.monotonic() + timeout
        while time.monotonic() < end:
            if text in getattr(self, stream):
                return time.monotonic()
            time.sleep(0.005)
        return None

    def close_input(self):
        try:
            self.p.stdin.close()
        except OSError:
            pass

    def wait(self, timeout):
        try:
            self.rc = self.p.wait(timeout=timeout)
            self.took = round(time.monotonic() - self.t0, 2)
        except subprocess.TimeoutExpired:
            self.rc = "timeout"
            os.killpg(self.p.pid, signal.SIGKILL)
            self.p.wait()
        for t in self.readers:
            t.join(3)
        return self.rc

    def lines(self):
        out = []
        for l in self.err.decode("utf-8", "replace").splitlines():
            try:
                out.append(json.loads(l))
            except ValueError:
                out.append({"not_json": len(l)})
        return out

    def snapshot(self):
        """While it runs: what a process listing shows of it, and its sockets."""
        pid = str(self.p.pid)
        args = H.sh(["ps", "-o", "args=", "-ww", "-p", pid]).stdout
        env = H.sh(["ps", "eww", "-o", "command=", "-p", pid]).stdout            # the arguments followed by the environment
        rows = [l.split() for l in H.sh(["lsof", "-nP", "-a", "-p", pid, "-i"]).stdout.splitlines()[1:]]
        socks = [{"type": r[7] if len(r) > 7 else "?", "name": r[8] if len(r) > 8 else "?", "state": r[9] if len(r) > 9 else ""} for r in rows]
        return {"args_text": args, "env_text": env, "sockets": socks}


def camera_start(d, codec="h264", sets="sdp", frames=FRAMES, extra=()):
    log = os.path.join(d, "camera.jsonl")
    p = H.spawn([sys.executable, "-B", CAMERA, "--port", str(CAMERA_PORT), "--codec", codec, "--param-sets", sets, "--frames", str(frames),
                 "--event-log", log, "--exit-on-stdin-eof", "--max-seconds", "120"] + list(extra), stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
    ready = json.loads(p.stdout.readline().decode() or "{}")
    if ready.get("event") != "ready":
        raise RuntimeError("the test camera did not start")
    threading.Thread(target=p.stdout.read, daemon=True).start()
    return p, log, ready["path"]


def camera_end(p, log):
    try:
        p.stdin.close()
    except OSError:
        pass
    try:
        p.wait(timeout=8)
    except subprocess.TimeoutExpired:
        os.killpg(p.pid, signal.SIGKILL)
        p.wait()
    events = [json.loads(l) for l in open(log)] if os.path.exists(log) else []
    counters = next((e.get("counters", {}) for e in reversed(events) if e.get("event") == "exit"), {})
    auth = {}
    for e in events:
        if e.get("event") == "request":
            auth[e.get("auth", "?")] = auth.get(e.get("auth", "?"), 0) + 1
    return {"rc": p.returncode, "counters": counters, "requests_by_authentication_class": auth, "requests": [[e.get("method"), e.get("auth"), e.get("status")] for e in events if e.get("event") == "request"]}


def texts_of(ingest, locator, user, secret):
    """The texts that must be nowhere: the password, the account, the stream path, the session's last element."""
    return {"secret": secret, "account": user, "locator": locator, "locator_path": re.sub(r"^rtsp://[^/]*", "", locator), "ingest": ingest, "ingest_element": ingest.rsplit("/", 1)[1]}


def occurrences(texts, *blobs):
    whole = "\n".join(b.decode("utf-8", "replace") if isinstance(b, bytes) else b for b in blobs)
    return {k: whole.count(v) for k, v in texts.items() if v}


def decode_errors(path):
    r = H.sh([E.FF, "-v", "error", "-nostdin", "-i", path, "-map", "0:v", "-f", "null", "-"])
    return len([l for l in r.stderr.splitlines() if l.strip()]) if r.returncode == 0 else -1


def listing_shows_an_environment():
    """Row T3 (review 060c X-07): does the process listing `Relay.snapshot` reads display an environment on this host?
    A control process with ONE marker variable; True when the marker is in the `ps eww` listing and not in the argument
    list. The control is a program that is not the system's (this Python), as the relay is: on macOS 27 the listing
    shows NO environment for a program of the system (`/bin/sleep` with a marker: its arguments and nothing else)."""
    marker = "ROW_T3_MARKER_" + secrets.token_hex(8)
    p = subprocess.Popen([sys.executable, "-c", "import time; time.sleep(20)"], stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                         env={"ROW_T3_CONTROL": marker}, close_fds=True)
    try:
        time.sleep(0.3)
        pid = str(p.pid)
        args = H.sh(["ps", "-o", "args=", "-ww", "-p", pid]).stdout
        env = H.sh(["ps", "eww", "-o", "command=", "-p", pid]).stdout
        return marker in env and marker not in args
    finally:
        p.kill()
        p.wait()


def ingest_names():
    """Two session-shaped paths: <session>/<track>/<128 bits, URL-safe base64>."""
    return tuple("S-ROW41/video-0%d/%s" % (i + 1, secrets.token_urlsafe(16)) for i in range(2))


def session_run(name, kind, codec="h264", sets="sdp", camera_extra=(), frames=FRAMES, secret=None, user=None, act=None, expect=None):
    """One worker session: camera 1 through the relay, camera 2 the control pusher."""
    E.RIGHT = ingest_names()
    port, cport = H.PORTS
    ingest = E.url(port, E.RIGHT[0])
    user = user or CAM.ACCOUNT_USER
    secret = secret or CAM.ACCOUNT_PASSWORD
    keep = {}

    def script(ctx):
        d = ctx["d"]
        # Row T3 (review 060c X-01): WHEN each part of this script started, in seconds after the worker's START ack.
        # The order is camera double, control push, relay - all inside the worker's listen window (12 s) and its
        # give-up bound (listen window + 10 s). Measured, not changed: the record of row T3 has the numbers.
        after = lambda: round(time.monotonic() - ctx["t0"], 2)
        timeline = {"script_called": after(), "load_1m": round(os.getloadavg()[0], 1)}
        cam, log, path = camera_start(d, codec, sets, frames, camera_extra)
        timeline["camera_ready"] = after()
        ctx["procs"].append(cam)
        locator = "rtsp://127.0.0.1:%d%s" % (CAMERA_PORT, path)
        texts = texts_of(ingest, locator, user, secret)
        control = E.Push(d, "control", cport, E.RIGHT[1], ctx["t0"], frames=FRAMES)
        timeline["control_push_started"] = after()
        relay = Relay(d, start_message(ingest, locator, user, secret))
        timeline["relay_started"] = after()
        ctx["procs"].append(relay.p)
        snap = None
        if kind in ("record", "ends"):
            timeline["worker_connected"] = after() if E.wait_connected(d, port, 10) else None
            time.sleep(1.0)
            snap = relay.snapshot()
        extra = act(ctx, relay) if act else (act_stop_at_the_loss(ctx, relay) if kind == "record" else {})
        rc = relay.wait(20)
        control.wait()
        facts = {"rc": rc, "seconds": relay.took, "stdout_bytes": len(relay.out), "stdout_text": relay.out.decode("utf-8", "replace"), "lines": relay.lines(),
                 "texts_in_relay_output": occurrences(texts, relay.out, relay.err)}
        if snap:
            facts["texts_in_argument_list"] = occurrences(texts, snap["args_text"])
            facts["texts_in_arguments_and_environment"] = occurrences(texts, snap["env_text"])
            facts["argument_words"] = len(snap["args_text"].split())
            facts["environment_shown"] = snap["env_text"].strip() != snap["args_text"].strip()
            facts["listing_shows_an_environment"] = listing_shows_an_environment()     # row T3 (X-07): the control of the line above
            facts["sockets"] = snap["sockets"]
        keep.update(texts=texts, camera=camera_end(cam, log))
        return {"case": kind, "relay": facts, "camera": keep["camera"], "observation": "ROW41", "port_under_test": port, "timeline_s_after_start_ack": timeline,
                "control": {"port": cport, "path": "", "rc": control.rc, "rtsp_error_statuses": []}, "extra": extra, "paths_used": list(E.RIGHT)}

    r = E.session(name, script)
    d = os.path.join(OUT, "runs", name)
    # The control pusher's own trace holds the control's synthetic address (it is FFmpeg at level trace): not kept.
    if os.path.exists(os.path.join(d, "control.log")):
        os.remove(os.path.join(d, "control.log"))
    log = H.worker_log(d)
    f1, f2 = r["files"][str(port)], r["files"][str(cport)]
    summary = {l.get("cam"): l for l in log if l.get("message") == "camera_summary"}
    video = f1.get("video") if isinstance(f1.get("video"), dict) else {}
    exit_line = next((l for l in r["relay"]["lines"] if l.get("relay") == "exit"), {})
    path1 = os.path.join(d, "media", "VIDEO-01.mp4")
    r["facts"] = fx = {
        "relay_rc": r["relay"]["rc"], "relay_code": exit_line.get("code"), "relay_pictures": exit_line.get("pictures"), "relay_held_back": exit_line.get("held_back"),
        "relay_gaps": exit_line.get("gaps"), "library_errors": exit_line.get("library_errors"), "answers_with_digest": exit_line.get("answers_with_digest"),
        "camera_frames_sent": r["camera"]["counters"].get("frames_sent"), "camera_requests": r["camera"]["requests_by_authentication_class"],
        "ingest_connected_port1": sum(1 for c in r["worker_ingest_connected"] if c["port"] == port), "worker_codec": next((c["codec"] for c in r["worker_ingest_connected"] if c["port"] == port), None),
        "file_bytes": f1["bytes"], "file_codec": video.get("codec_name"), "file_frames": int(video.get("nb_read_frames") or 0), "file_size": "%sx%s" % (video.get("width"), video.get("height")),
        "worker_video_packets": (summary.get(1) or {}).get("video_packets"),
        "worker_dropped": sum(int((summary.get(1) or {}).get(k) or 0) for k in ("dropped_no_pts", "dropped_prearm", "dropped_prestart", "dropped_unanchored")),
        "decode_error_lines": decode_errors(path1) if f1["bytes"] else None,
        "control_recorded": f2["bytes"] > 0 and sum(1 for c in r["worker_ingest_connected"] if c["port"] == cport) == 1,
        "worker_rc": r.get("worker_rc"), "leftovers": len(r["leftovers"]["processes"]) + len(r["leftovers"]["listeners"]),
        "worker_gate_refusals": sum(1 for l in log if str(l.get("message", "")).startswith("INGEST_ANNOUNCE")),
        "session_texts_in_worker_output": sum(r["path_text_in_worker_output"].values()),
    }
    rel = r["relay"]
    # Row 42: standard output is the ONE report line "push established" when the push was opened, and nothing otherwise
    # (the attempt is 0 when the start message states none; row042_probe.py runs with one and asserts its number).
    # Row 43: after it, one line per loss of the camera and one per re-open (REPORT_LINES), and nothing else.
    established = REPORT_LINES if any(l.get("relay") == "push_open" for l in rel["lines"]) else ""
    fx["relay_losses"] = [int(c) for c in re.findall(r'"report":"camera_lost","v":1,"attempt":\d+,"loss":\d+,"cause":(\d+)\}', rel["stdout_text"])]
    crit = {"standard_output_is_the_report_lines_of_the_contract_or_nothing": re.fullmatch(established, rel["stdout_text"]) is not None, "every_relay_line_is_fixed_shape": all("not_json" not in l for l in rel["lines"]),
            "no_session_text_in_relay_output": sum(rel["texts_in_relay_output"].values()) == 0, "no_leftover": fx["leftovers"] == 0}
    if kind != "worker_gone":
        crit["control_recorded"] = fx["control_recorded"]
    crit.update(expect(r, fx))
    r["criteria"], r["verdict"] = crit, "PASS" if all(crit.values()) else "FAIL"
    for k in ("texts",):
        keep.pop(k, None)
    r.pop("paths_used", None)
    r.pop("right_paths", None)
    r.pop("path_text_in_worker_output", None)
    json.dump(r, open(os.path.join(d, "result.json"), "w"), indent=1, default=str)
    return r


def recorded(codec, expect_code="CAMERA_LOST", min_pictures=FRAMES - 30):
    """`expect_code` CAMERA_LOST or CAMERA_STALLED (row 43): the camera leg ended after the push was opened. The relay
    then does NOT end with that code: it says the loss in one line (the code's number is its cause) and the run
    stops it by the order to stop, so it ends with STOPPED and exactly that one loss said."""
    ended = "STOPPED" if expect_code in LOSS_CAUSE else expect_code

    def check(r, fx):
        rel = r["relay"]
        socks = rel.get("sockets") or []
        return {
            "relay_exit_is_the_named_code": fx["relay_rc"] == CODES[ended] and fx["relay_code"] == ended and (expect_code not in LOSS_CAUSE or fx["relay_losses"] == [LOSS_CAUSE[expect_code]]),
            "worker_connected_once_no_gate_refusal": fx["ingest_connected_port1"] == 1 and fx["worker_gate_refusals"] == 0,
            "codec_is_the_cameras": fx["file_codec"] == codec and fx["worker_codec"] == codec,
            "pictures_forwarded": (fx["relay_pictures"] or 0) >= min_pictures and fx["relay_gaps"] == 0,
            "file_holds_every_forwarded_picture": fx["file_frames"] == fx["relay_pictures"] - fx["worker_dropped"] and fx["file_frames"] == fx["worker_video_packets"],
            "nothing_lost_between_camera_and_file": expect_code != "CAMERA_LOST" or fx["file_frames"] + fx["worker_dropped"] + (fx["relay_held_back"] or 0) == fx["camera_frames_sent"],
            "zero_decode_errors": fx["decode_error_lines"] == 0,
            "no_basic_request_at_the_camera": fx["camera_requests"].get("basic", 0) == 0 and r["camera"]["counters"].get("auth_basic", 0) == 0,
            "no_argument_and_nothing_of_the_session_in_ps": rel.get("argument_words") == 1 and sum(rel["texts_in_argument_list"].values()) == 0 and sum(rel["texts_in_arguments_and_environment"].values()) == 0,
            # Row T3 (review 060c X-07; survivor 17): the environment half of the line above read a listing that never
            # differs from the argument list (the relay's environment is empty), and nothing showed that this `ps`
            # displays an environment at all. The control process's marker variable must be in the same listing, and
            # the relay's listing must be its arguments and NOTHING else.
            "the_listing_shows_an_environment_and_the_relay_has_none": rel.get("listing_shows_an_environment") is True and rel.get("environment_shown") is False,
            "sockets_two_connected_streams_no_listener_no_datagram": len(socks) == 2 and all(s["type"] == "TCP" and "LISTEN" not in s["state"] and "->" in s["name"] for s in socks),
            "worker_clean_exit": fx["worker_rc"] == 0,
        }
    return check


def refused(code, digest_answers):
    def check(r, fx):
        cam = r["camera"]["requests_by_authentication_class"]
        carried = sum(v for k, v in cam.items() if k != "none")
        return {"relay_exit_is_the_named_code": fx["relay_rc"] == CODES[code] and fx["relay_code"] == code,
                "requests_carrying_an_answer_at_the_camera": carried == digest_answers and cam.get("basic", 0) == 0 and fx["answers_with_digest"] == digest_answers,
                "nothing_recorded": fx["ingest_connected_port1"] == 0 and fx["file_bytes"] == 0 and fx["relay_pictures"] == 0,
                "worker_clean_exit": fx["worker_rc"] == 0}
    return check


def act_stop_at_the_loss(ctx, relay):
    """Row 43: the camera ended its stream after the push was opened. The relay says the loss in one line and would
    open the camera again 2 s later; the run ends here, by the order to stop, before that."""
    seen = relay.saw(b'"report":"camera_lost"', 25)
    relay.close_input()
    return {"loss_line_seen": seen is not None}


def act_close_input(ctx, relay):
    time.sleep(3.0)
    t = time.monotonic()
    relay.close_input()
    relay.wait(10)
    return {"seconds_from_closed_input_to_exit": round(time.monotonic() - t, 2)}


def act_kill_worker(ctx, relay):
    time.sleep(3.0)
    t = time.monotonic()
    ctx["worker"].kill()
    relay.wait(10)
    return {"seconds_from_killed_worker_to_exit": round(time.monotonic() - t, 2)}


# ---------------------------------------------------------------------------------------------------------- without a worker
def raw_camera(port, answer):
    """A one-connection double: every request gets `answer(method, cseq)`; returns the list of (method, has Authorization)."""
    seen = []
    srv = socket.socket()
    srv.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    srv.bind(("127.0.0.1", port))
    srv.listen(4)
    srv.settimeout(8)

    def serve():
        try:
            while True:
                c, _ = srv.accept()
                c.settimeout(3)
                buf = b""
                try:
                    while True:
                        while b"\r\n\r\n" not in buf:
                            got = c.recv(4096)
                            if not got:
                                raise OSError()
                            buf += got
                        head, buf = buf.split(b"\r\n\r\n", 1)
                        lines = head.decode("latin1").split("\r\n")
                        cseq = next((l.split(":", 1)[1].strip() for l in lines if l.lower().startswith("cseq")), "0")
                        seen.append((lines[0].split(" ")[0], next((l.split(":", 1)[1].strip().split(" ")[0].lower() for l in lines if l.lower().startswith("authorization")), "")))
                        c.sendall(answer(lines[0].split(" ")[0], cseq).encode("latin1"))
                except OSError:
                    pass
                finally:
                    c.close()
        except OSError:
            pass

    t = threading.Thread(target=serve, daemon=True)
    t.start()
    return srv, seen


def start_run(name, message, expect_code, args=(), raw=None, wait=9, hold_input=True, digest_answers=0):
    d = os.path.join(OUT, "runs", name)
    os.makedirs(d, exist_ok=True)
    srv, seen = (None, [])
    if raw:
        srv, seen = raw_camera(SPARE_PORT, raw)
    relay = Relay(d, message, args=args)
    if not hold_input:
        relay.close_input()
    rc = relay.wait(wait)
    relay.close_input()
    if srv:
        srv.close()
    exit_line = next((l for l in relay.lines() if l.get("relay") == "exit"), {})
    probe = {"secret": CAM.ACCOUNT_PASSWORD, "account": CAM.ACCOUNT_USER, "element": "Zr41StartRunElement9x"}
    r = {"run": name, "case": "start", "relay_rc": rc, "relay_code": exit_line.get("code"), "seconds": relay.took, "stdout_bytes": len(relay.out),
         "lines": relay.lines(), "texts_in_relay_output": occurrences(probe, relay.out, relay.err), "double_requests": [[m, a] for m, a in seen],
         "leftovers": len(H.leftovers()["processes"])}
    crit = {"relay_exit_is_the_named_code": rc == CODES[expect_code] and exit_line.get("code") == expect_code, "nothing_on_standard_output": len(relay.out) == 0,
            "every_line_is_fixed_shape": all("not_json" not in l for l in relay.lines()), "no_text_of_the_message_in_the_output": sum(r["texts_in_relay_output"].values()) == 0,
            "requests_with_an_authorization_header": [a for _, a in seen if a] == ["digest"] * digest_answers, "no_leftover": r["leftovers"] == 0}
    r["criteria"], r["verdict"] = crit, "PASS" if all(crit.values()) else "FAIL"
    json.dump(r, open(os.path.join(d, "result.json"), "w"), indent=1, default=str)
    return r


def start_cases():
    ingest = "rtsp://127.0.0.1:8559/S-ROW41/video-01/Zr41StartRunElement9x"
    dead = "rtsp://127.0.0.1:%d/media/video1" % DEAD_PORT
    spare = "rtsp://127.0.0.1:%d/media/video1" % SPARE_PORT
    u, s = CAM.ACCOUNT_USER, CAM.ACCOUNT_PASSWORD
    good = start_message(ingest, dead, u, s)
    bad = {
        "unknown_member": start_message(ingest, dead, u, s, slot=1),
        "user_part_in_locator": start_message(ingest, ("rtsp:/" + "/%s:%s@127.0.0.1:%d/media/video1") % (u, s, DEAD_PORT), u, s),
        "host_name_in_locator": start_message(ingest, "rtsp://camera.example/media/video1", u, s),
        "other_scheme": start_message(ingest, "http://127.0.0.1:%d/media/video1" % DEAD_PORT, u, s),
        "ingest_not_loopback": start_message("rtsp://192.0.2.7:8559/S-ROW41/video-01/Zr41StartRunElement9x", dead, u, s),
        "ingest_port_outside_range": start_message("rtsp://127.0.0.1:8570/S-ROW41/video-01/Zr41StartRunElement9x", dead, u, s),
        "ingest_with_query": start_message(ingest + "?x=1", dead, u, s),
        "probe_mode_is_row_42": good.replace(b'"mode":"record"', b'"mode":"probe"'),
        "two_lines": good + good,
        "no_line_feed_then_end": good[:-1],
    }
    runs = [lambda: start_run("start_argument_refused", good, "USAGE", args=("--ingest", ingest))]
    for k, m in bad.items():
        runs.append(lambda k=k, m=m: start_run("start_invalid_%s" % k, m, "START_MESSAGE_INVALID", hold_input=(k != "no_line_feed_then_end")))
    runs.append(lambda: start_run("start_no_message_in_the_bound", None, "START_MESSAGE_TIMEOUT"))
    runs.append(lambda: start_run("start_camera_not_there", good, "CAMERA_UNREACHABLE"))
    runs.append(lambda: start_run("start_input_closed_before_message", None, "START_MESSAGE_INVALID", hold_input=False))
    redirect = lambda method, cseq: "RTSP/1.0 302 Moved\r\nCSeq: %s\r\nLocation: rtsp://127.0.0.1:%d/media/video1\r\n\r\n" % (cseq, DEAD_PORT)
    runs.append(lambda: start_run("start_redirect_not_followed", start_message(ingest, spare, u, s), "REDIRECT_REFUSED", raw=redirect))
    sdp = "v=0\r\no=- 0 0 IN IP4 127.0.0.1\r\ns=x\r\nt=0 0\r\nm=video 0 RTP/AVP 96\r\na=rtpmap:96 H264/90000\r\na=control:rtsp://192.0.2.9:554/media/video1/track1\r\n"
    foreign = lambda method, cseq: "RTSP/1.0 200 OK\r\nCSeq: %s\r\nContent-Type: application/sdp\r\nContent-Length: %d\r\n\r\n%s" % (cseq, len(sdp), sdp)
    runs.append(lambda: start_run("start_control_address_of_another_host", start_message(ingest, spare, u, s), "CONTROL_ADDRESS_REFUSED", raw=foreign))
    # A camera that challenges Digest and, once it holds the answer, challenges Basic: the answer was a Digest one,
    # the refusal ends the relay, and no request of the Basic scheme ever leaves (the relay has no code that makes one).
    state = {"n": 0}

    def switching(method, cseq):
        state["n"] += 1
        scheme = 'Digest realm="row41 double", nonce="5f1c0a9e77b24d3c8a6e2b1d0c9f8e7a"' if state["n"] == 1 else 'Basic realm="row41 double"'
        return "RTSP/1.0 401 Unauthorized\r\nCSeq: %s\r\nWWW-Authenticate: %s\r\n\r\n" % (cseq, scheme)
    runs.append(lambda: start_run("start_digest_then_basic_on_the_second_request", start_message(ingest, spare, u, s), "AUTH_REFUSED", raw=switching, digest_answers=1))
    return runs


def todo(what):
    out = []
    if what in ("record", "all"):
        for codec in ("h264", "hevc"):
            for sets in ("sdp", "inband"):
                out.append(lambda c=codec, s=sets: session_run("record_%s_%s" % (c, s), "record", c, s, expect=recorded(c)))
        out.append(lambda: session_run("record_basic_and_digest_offered", "record", "h264", "sdp", camera_extra=("--challenge", "both"), expect=recorded("h264")))
        out.append(lambda: session_run("record_account_with_awkward_characters", "record", "hevc", "inband", camera_extra=("--account", "special"),
                                       user=CAM.SPECIAL_ACCOUNT_USER, secret=CAM.SPECIAL_ACCOUNT_PASSWORD, expect=recorded("hevc")))
    if what in ("basic", "all"):
        for n in (1, 2):
            out.append(lambda n=n: session_run("basic_only_run_%d" % n, "refused", camera_extra=("--challenge", "basic"), expect=refused("AUTH_SCHEME_NOT_ALLOWED", 0)))
    if what in ("wrong", "all"):
        out.append(lambda: session_run("wrong_password", "refused", secret=WRONG, expect=refused("AUTH_REFUSED", 1)))
    if what in ("ends", "all"):
        def stopped(r, fx):
            c = recorded("h264", "STOPPED", min_pictures=50)(r, fx)
            c["ended_within_2_s_of_the_closed_input"] = r["extra"]["seconds_from_closed_input_to_exit"] <= 2.0
            return c

        def gone(r, fx):
            return {"relay_exit_is_the_named_code": fx["relay_rc"] == CODES["INGEST_LOST"] and fx["relay_code"] == "INGEST_LOST",
                    "ended_within_2_s_of_the_killed_worker": r["extra"]["seconds_from_killed_worker_to_exit"] <= 2.0}
        out.append(lambda: session_run("ends_when_standard_input_closes", "ends", frames=0, act=act_close_input, expect=stopped))
        out.append(lambda: session_run("ends_when_the_worker_goes_away", "worker_gone", frames=0, act=act_kill_worker, expect=gone))
    if what in ("start", "all"):
        out += start_cases()
    return out


def line(r):
    failed = "" if r["verdict"] == "PASS" else " failed: %s" % sorted(k for k, v in r["criteria"].items() if not v)
    if "facts" not in r:
        return "%-44s relay rc=%s code=%s in %ss stdout=%d double_requests=%d | %s%s" % (r["run"], r["relay_rc"], r["relay_code"], r["seconds"], r["stdout_bytes"], len(r["double_requests"]), r["verdict"], failed)
    f = r["facts"]
    return ("%-44s relay rc=%s code=%s pictures=%s held_back=%s gaps=%s lib_errors=%s | camera sent=%s requests=%s | worker ic=%s codec=%s gate_refusals=%s dropped=%s rc=%s | "
            "file %s %s frames=%s bytes=%s decode_errors=%s | control=%s leftover=%s | %s%s") % (
        r["run"], f["relay_rc"], f["relay_code"], f["relay_pictures"], f["relay_held_back"], f["relay_gaps"], f["library_errors"], f["camera_frames_sent"], f["camera_requests"],
        f["ingest_connected_port1"], f["worker_codec"], f["worker_gate_refusals"], f["worker_dropped"], f["worker_rc"], f["file_codec"], f["file_size"], f["file_frames"], f["file_bytes"],
        f["decode_error_lines"], f["control_recorded"], f["leftovers"], r["verdict"], failed)


def summary():
    root, rows = os.path.join(OUT, "runs"), []
    for n in sorted(os.listdir(root)) if os.path.isdir(root) else []:
        p = os.path.join(root, n, "result.json")
        if os.path.exists(p):
            rows.append(json.load(open(p)))
    rows = [r for r in rows if "verdict" in r]
    lines = [line(r) for r in rows]
    tail = "ROW41 RELAY: %d run(s), %d PASS, %d FAIL" % (len(rows), sum(r["verdict"] == "PASS" for r in rows), sum(r["verdict"] != "PASS" for r in rows))
    open(os.path.join(OUT, "summary.txt"), "w").write("\n".join(lines + [tail]) + "\n")
    print("\n".join(lines + [tail]))
    return all(r["verdict"] == "PASS" for r in rows) and bool(rows)


def main(argv):
    what = argv[0] if argv else "summary"
    if not os.path.exists(RELAY):
        sys.exit("no relay: make -C apps/capture-worker")
    runs = todo(what)
    if not runs and what != "summary":
        sys.exit("usage: row041_relay.py all | record | basic | wrong | ends | start | summary")
    for f in runs:
        print(line(f()), flush=True)
        time.sleep(1.0)
    if runs:
        print("---- summary of every recorded run", flush=True)
    sys.exit(0 if summary() else 1)


if __name__ == "__main__":
    main(sys.argv[1:])
