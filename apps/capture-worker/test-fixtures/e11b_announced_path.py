#!/usr/bin/env python3
"""Step E-11b (blueprint row 7, security requirement AD-01 (5)) and the characterisation of the side observation
of row 6 (a completed RTSP handshake without media ended the whole worker).

Test code only. Nothing of the worker is built or edited. Two parts:

  probe   runs the probe program .cache/e11b-probe/probe (source probe.c beside it, compiled by hand with the
          flags of the worker's Makefile against the library the worker links) as an RTSP listener on ONE
          loopback port, and pushes to it with the FFmpeg pusher of e11_listener_path.py: the right path and
          the near-miss paths of AD-01 (2). `observe`: what the public interface shows, and when. `refuse`:
          the probe ends its own open when the value it read differs from its own path.
  exit    one release-worker session per run (the session of e11_listener_path.py, unchanged), a raw client on
          the listener under test, the FFmpeg control push on the other listener. Cases: how far the client
          goes (through RECORD, through SETUP only), whether its description carries the parameter sets,
          whether it closes or holds the connection, wrong path or right path.

    # repository root, command sandbox off (binds loopback ports, reads ps / lsof)
    M3_PORTS=8559,8561 /usr/bin/lockf -k -t 1800 .locks/heavy-host.lock \
        python3 apps/capture-worker/test-fixtures/e11b_announced_path.py probe | exit | all [--runs 3]
    python3 apps/capture-worker/test-fixtures/e11b_announced_path.py summary

Everything a run writes lands under .cache/e11b-probe/ (git-ignored)."""
import json, os, re, shutil, socket, subprocess, sys, time

sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
ROOT = os.path.join(REPO, ".cache", "e11b-probe")
os.environ.setdefault("M3_PORTS", "8559,8561")
os.environ["E11_OUT"] = os.path.join(ROOT, "worker")    # the sessions of this script never touch row 6's output
sys.path.insert(0, HERE)
import e11_listener_path as E                            # read-only reuse (pusher, session, near misses)
H = E.H

PROBE = os.path.join(ROOT, "probe")
PROBE_PORT = 8563
PROBE_RIGHT = "e11b/Hs3kP9wQ2nVb7Xc5"


def listening(port):
    return [l for l in H.sh(["lsof", "-nP", "-iTCP:%d" % port, "-sTCP:LISTEN"]).stdout.splitlines()[1:] if l.strip()]


# ------------------------------------------------------------------------------------------------ part 1: the probe
def run_probe(name, mode, pushed, needle):
    d = os.path.join(ROOT, "probe-runs", name)
    if os.path.isdir(d):
        shutil.rmtree(d)
    os.makedirs(d)
    if listening(PROBE_PORT):
        sys.exit("port %d busy before start: %r" % (PROBE_PORT, listening(PROBE_PORT)))
    out = os.path.join(d, "probe.out")
    cmd = [PROBE, str(PROBE_PORT), PROBE_RIGHT, mode, "12", needle]
    p = H.spawn(cmd, stdin=subprocess.DEVNULL, stdout=open(out, "w"), stderr=subprocess.STDOUT)
    res = {"run": name, "mode": mode, "listener_url": E.url(PROBE_PORT, PROBE_RIGHT), "pushed_path": pushed, "probe_command": " ".join(cmd),
           "utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "load_at_start": os.getloadavg()}
    try:
        t0 = time.monotonic()
        while not listening(PROBE_PORT) and time.monotonic() - t0 < 5:
            time.sleep(0.05)
        res["listener_before_push"] = [" ".join(l.split()[-2:]) for l in listening(PROBE_PORT)]
        push = E.Push(d, "push", PROBE_PORT, pushed, t0, frames=100)
        push.wait(30)
        try:
            res["probe_rc"] = p.wait(timeout=20)
        except subprocess.TimeoutExpired:
            res["probe_rc"] = "timeout"
        res["push"] = push.facts()
    finally:
        H.killall(H.OWN)
    time.sleep(0.3)
    res["listener_left"] = listening(PROBE_PORT)
    text = open(out, errors="replace").read()
    lines = text.splitlines()
    res["probe_lines"] = {k: [l for l in lines if l.startswith(k)] for k in ("READ ", "READ_LINE", "REFUSE", "OPEN", "BEFORE_PROBE", "PROBED", "SCAN", "FIELD", "IO_OPEN", "RESULT")}
    res["log_messages_naming_pushed_path"] = [l for l in lines if l.startswith("LOG") and pushed in l]
    res["log_messages_naming_listener_path_only"] = sum(1 for l in lines if l.startswith("LOG") and PROBE_RIGHT in l and (pushed == PROBE_RIGHT or pushed not in l))
    m = re.search(r"^RESULT .*?open=(\S+) read_during_open=(\S+) announced_path=(\S+) listener_path=(\S+) equal=(-?\d+) packets=(\d+) request_line_path=(\S+) request_line_equal=(-?\d+)", text, re.M)
    res["result"] = dict(zip(("open", "read_during_open", "announced_path", "listener_path", "equal", "packets", "request_line_path", "request_line_equal"), m.groups())) if m else None
    r = res["result"] or {}
    # AD-01 (5): READABLE only if, for a push to a wrong path, the program prints a value equal to that wrong
    # path and different from the address the listener was opened with.
    res["value_equals_pushed_path"] = r.get("announced_path") == "/" + pushed
    res["request_line_equals_pushed_path"] = r.get("request_line_path") == "/" + pushed
    res["value_differs_from_listener"] = r.get("announced_path") not in (None, "(none)") and r.get("announced_path") != "/" + PROBE_RIGHT
    res["scan_hits_outside_log"] = sum(int(x) for l in res["probe_lines"]["SCAN"] for x in re.findall(r"(?:options_holding_needle|metadata_holding_needle|url_holds_needle)=(\d+)", l))
    json.dump(res, open(os.path.join(d, "result.json"), "w"), indent=1)
    return res


def probe_line(r):
    x, p = r["result"] or {}, r["push"]
    return "%-34s %-7s pushed=/%-28s update_msg=%-30s equals_pushed=%-5s differs_from_listener=%-5s | request_line=%-30s equals_pushed=%-5s | open=%-6s packets=%-2s other_places=%d | pusher statuses=%s rc=%s" % (
        r["run"], r["mode"], r["pushed_path"], x.get("announced_path"), r["value_equals_pushed_path"], r["value_differs_from_listener"], x.get("request_line_path"), r.get("request_line_equals_pushed_path"), x.get("open"), x.get("packets"),
        r["scan_hits_outside_log"], [[a[0], a[2]] for a in p["requests_sent_with_status"]], p["rc"])


def probe_todo(runs):
    wrong = E.near_misses(PROBE_RIGHT)
    last = wrong[0][1]
    needle = lambda path: path.split("/", 1)[1].rstrip("/") or path     # the path's own second component, searched for outside the log
    todo = [("observe_right_r%d" % n, "observe", PROBE_RIGHT, "Hs3kP9wQ2nVb7Xc5") for n in range(1, runs + 1)]
    todo += [("observe_wrong_last_character_r%d" % n, "observe", last, needle(last)) for n in range(1, runs + 1)]
    todo += [("observe_wrong_%s_r1" % kind, "observe", path, needle(path)) for kind, path in wrong[1:]]
    todo += [("refuse_wrong_last_character_r%d" % n, "refuse", last, needle(last)) for n in range(1, runs + 1)]
    todo += [("refuse_right_r%d" % n, "refuse", PROBE_RIGHT, "Hs3kP9wQ2nVb7Xc5") for n in range(1, runs + 1)]
    return [(lambda a=a: run_probe(*a)) for a in todo]


# ------------------------------------------------------------------------- part 2: which client ends the worker
SDP_NO_SPROP = E.SDP.replace(" sprop-parameter-sets=Z0LADdoFB+wEQAAAAwBAAAAMo8UKqA==,aM4PyA==;", "")
CASES = {                 # name: (requests sent, description, seconds the connection is held open after the last answer)
    "record_close": (4, E.SDP, 0.3),            # row 6's client: OPTIONS ANNOUNCE SETUP RECORD, then closed
    "record_hold": (4, E.SDP, 16.0),            # the same, connection kept open without a byte of media
    "record_close_nosprop": (4, SDP_NO_SPROP, 0.3),   # the description carries no parameter sets
    "setup_close": (3, E.SDP, 0.3),             # the client stops after SETUP
}


def raw_client(ctx, port, path, n_requests, sdp, hold_s):
    """A raw RTSP client: the first n of OPTIONS, ANNOUNCE, SETUP, RECORD, no media; the connection is held
    hold_s and closed. While it holds, the worker process is watched: the instant it exits is recorded."""
    u = E.url(port, path)
    reqs = [("OPTIONS", u, "", ""), ("ANNOUNCE", u, "Content-Type: application/sdp\r\nContent-Length: %d\r\n" % len(sdp), sdp),
            ("SETUP", u + "/streamid=0", "Transport: RTP/AVP/TCP;unicast;interleaved=0-1;mode=record\r\n", ""), ("RECORD", u, "Range: npt=0.000-\r\n", "")][:n_requests]
    w, t0 = ctx["worker"], ctx["t0"]
    out = {"pusher": "raw-client", "port": port, "path": path, "url": u, "requests_sent_with_status": [], "status_lines_read": [], "held_open_s": hold_s,
           "started_s_after_start_ack": round(time.monotonic() - t0, 2)}
    s = socket.create_connection(("127.0.0.1", port), timeout=3)
    session_id = None
    try:
        s.settimeout(3)
        for i, (m, target, head, body) in enumerate(reqs):
            if m == "RECORD" and session_id:
                head += "Session: %s\r\n" % session_id
            s.sendall(("%s %s RTSP/1.0\r\nCSeq: %d\r\nUser-Agent: e11b-raw\r\n%s\r\n%s" % (m, target, i + 1, head, body)).encode())
            data = b""
            try:
                while b"\r\n\r\n" not in data:
                    chunk = s.recv(4096)
                    if not chunk:
                        break
                    data += chunk
            except OSError as e:
                out["read_error"] = "%s: %s" % (m, e)
            text = data.decode("latin1")
            status = text.split("\r\n")[0] if data else None
            for h in text.split("\r\n")[1:]:
                if h.lower().startswith("session:"):
                    session_id = h.split(":", 1)[1].strip().split(";")[0]
            out["requests_sent_with_status"].append([m, target, int(status.split()[1]) if status and status.startswith("RTSP/1.0 ") else None])
            if not status:
                break
            out["status_lines_read"].append(status)
        out["last_answer_s"] = round(time.monotonic() - t0, 2)
        end = time.monotonic() + hold_s
        while time.monotonic() < end:
            if w.p.poll() is not None and "worker_exit_seen_s" not in out:
                out["worker_exit_seen_s"], out["worker_exit_seen_while"] = round(time.monotonic() - t0, 2), "connection open"
            time.sleep(0.05)
    finally:
        s.close()
    out["closed_s"] = round(time.monotonic() - t0, 2)
    end = time.monotonic() + 4
    while time.monotonic() < end and "worker_exit_seen_s" not in out:
        if w.p.poll() is not None:
            out["worker_exit_seen_s"], out["worker_exit_seen_while"] = round(time.monotonic() - t0, 2), "after the close"
        time.sleep(0.05)
    out["rtsp_error_statuses"] = [x[2] for x in out["requests_sent_with_status"] if x[2] and x[2] >= 400]
    return out


def run_exit(case, which, run_no):
    n_requests, sdp, hold_s = CASES[case]
    ti = (run_no - 1) % 2
    port, right = H.PORTS[ti], E.RIGHT[ti]
    path = right if which == "right" else E.near_misses(right)[0][1]
    name = "exit_%s_%s_r%d" % (case, which, run_no)

    def script(ctx):
        cport = [p for p in H.PORTS if p != port][0]
        c = E.Push(ctx["d"], "control", cport, E.RIGHT[H.PORTS.index(cport)], ctx["t0"])
        t = raw_client(ctx, port, path, n_requests, sdp, hold_s)
        c.wait()
        return {"observation": "EXIT", "case": case, "path_kind": which, "port_under_test": port, "right_path_of_port": right,
                "test_push": t, "control": c.facts(), "paths_used": [path, right, c.path],
                "worker_alive_when_script_ended": ctx["worker"].p.poll() is None}

    r = E.session(name, script)
    d = os.path.join(E.OUT, "runs", name)
    log = H.worker_log(d)
    r["worker_log_last_lines"] = [{k: v for k, v in l.items() if k not in ("t", "ts", "mono_us")} for l in log[-8:]]
    r["worker_exit_line"] = next(({k: v for k, v in l.items() if k not in ("t", "ts", "mono_us")} for l in log if l.get("message") == "worker_exit"), None)
    r["worker_log_of_port_under_test"] = [{k: v for k, v in l.items() if k not in ("t", "ts", "mono_us")} for l in log
                                          if l.get("source") in ("ingest%d" % (ti + 1), "libav", "ingest") and l.get("message") != "camera_clock_floor"][:20]
    r["outcome"] = "WORKER_EXIT_%s" % r.get("worker_rc")
    json.dump(r, open(os.path.join(d, "result.json"), "w"), indent=1)
    return r


def exit_line(r):
    t, c = r["test_push"], r["control_result"]
    msgs = [l.get("message") for l in r["worker_log_of_port_under_test"] if l.get("level") in ("warn", "error")]
    return "%-40s port %d path=%-5s statuses=%s | worker rc=%s exit_seen=%s (%s) stop_ack=%s alive_at_script_end=%s | ingest_connected(test port)=%d | control ic=%s bytes=%d rc=%s | %s" % (
        r["run"], r["port_under_test"], r["path_kind"], [[x[0], x[2]] for x in t["requests_sent_with_status"]], r.get("worker_rc"), t.get("worker_exit_seen_s"), t.get("worker_exit_seen_while", "-"),
        r.get("stop_ack"), r.get("worker_alive_when_script_ended"), r["port_under_test_result"]["ingest_connected_lines"], c["ingest_connected"], c["bytes"], c["rc"], msgs)


def exit_todo(runs):
    order = [("record_close", "wrong"), ("record_close", "right"), ("record_hold", "wrong"), ("record_hold", "right"),
             ("record_close_nosprop", "wrong"), ("record_close_nosprop", "right"), ("setup_close", "wrong"), ("setup_close", "right")]
    return [(lambda a=a, n=n: run_exit(a[0], a[1], n)) for a in order for n in range(1, runs + 1)]


def summary():
    lines = []
    for sub, fmt in (("probe-runs", probe_line), (os.path.join("worker", "runs"), exit_line)):
        root = os.path.join(ROOT, sub)
        for n in sorted(os.listdir(root)) if os.path.isdir(root) else []:
            p = os.path.join(root, n, "result.json")
            if os.path.exists(p):
                lines.append(fmt(json.load(open(p))))
    open(os.path.join(ROOT, "summary.txt"), "w").write("\n".join(lines) + "\n")
    print("\n".join(lines))


def main(argv):
    what = argv[0] if argv else "summary"
    runs = int(argv[argv.index("--runs") + 1]) if "--runs" in argv else 3
    todo = []
    if what in ("probe", "all"):
        if not os.path.exists(PROBE):
            sys.exit("no probe binary: compile .cache/e11b-probe/probe.c first (the record of row 7 has the command)")
        todo += [(f, probe_line) for f in probe_todo(runs)]
    if what in ("exit", "all"):
        todo += [(f, exit_line) for f in exit_todo(runs)]
    if not todo and what != "summary":
        sys.exit("usage: e11b_announced_path.py probe | exit | all | summary [--runs N]")
    for f, fmt in todo:
        r = f()
        print(fmt(r), flush=True)
        time.sleep(1.5)
    if todo:
        print("---- summary of every recorded run", flush=True)
    summary()


if __name__ == "__main__":
    main(sys.argv[1:])
