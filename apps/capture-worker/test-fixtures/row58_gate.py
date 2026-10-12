#!/usr/bin/env python3
"""Task 4 blueprint row 58 (WP-11b; BR-01, BR-02, BR-03 of verification/05_security_branch_b.md): the targeted
checks of the worker's positive-match gate on the announced address. Test code only.

It is the verification of ONE row, run by hand; the permanent test in the worker's own series is rows 142 and
178 (they may take the cases from here). Every run is one worker session of e11_listener_path.py (imported, not
edited: two cameras, two FIFO microphones, the FFmpeg pusher), and EVERY run has its control: the other camera
of the same session pushed by the same command, at the same moment, to its right address.

    # repository root, command sandbox off (binds two loopback ports, reads ps / lsof); `make proof` first
    M3_PORTS=8559,8561 /usr/bin/lockf -k -t 1800 .locks/heavy-host.lock \
        python3 apps/capture-worker/test-fixtures/row58_gate.py all
    ... row58_gate.py right | near | foreign | noannounce | unseen | summary

Cases
  right       both cameras pushed to their right addresses at the same instant: both record (each open is bound
              to its own line, on its own thread).
  near        the seven near-miss addresses of AD-01 (2), one session each, the camera under test alternating:
              no `ingest_connected` for that port, 0 bytes, the gate's code in the worker's log; the control records.
  foreign     a raw client connects to ONE camera's port and announces the OTHER camera's whole address while
              that other camera receives its own push at the same instant (both assignments): the line of one
              camera never lets the other pass.
  noannounce  a raw client that never sends ANNOUNCE (OPTIONS, RECORD): refused - on this library by libavformat
              itself (the open fails), so this case shows no recording, not the gate's own "no line" branch.
  unseen      the proof build `capture-worker-noannounce` (its log callback sees nothing: "the library no longer
              says the line"): both right-address pushes are refused, nothing is recorded. Its control is the
              case `right` on the release build.

Addresses are synthetic and of this script only. No address is printed by `line()`; a result file holds the
counts of every path text of its run in what the worker wrote (log and standard output): 0 is required.
Everything a run writes lands under .cache/row58-gate/ (git-ignored)."""
import json, os, socket, sys, time

sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
OUT = os.path.join(REPO, ".cache", "row58-gate")
os.environ.setdefault("M3_PORTS", "8559,8561")
os.environ["E11_OUT"] = OUT
sys.path.insert(0, HERE)
import e11_listener_path as E                            # read-only reuse: session, pusher, near misses, classification inputs
H = E.H

E.RIGHT = ("g58/Rm3xT7qLw2Vn9Kd4", "g58/Hc6pJ1zYb8Fs5Ue0")   # the plan's two addresses of every session of this script
FRAMES = 100                                             # 4 s per push
GATE_CODE = "INGEST_ANNOUNCE_NOT_MATCHED"                # a differing or repeated line (every refusal of the release build here)
UNSEEN_CODE = "INGEST_ANNOUNCE_NOT_SEEN"                 # row 175, BR-04 (3): no line at all - the proof build of the case `unseen`
UNSEEN = os.path.join(H.BUILD, "capture-worker-noannounce")


def raw_requests(port, requests, hold_s=0.3):
    """A raw RTSP client on 127.0.0.1:<port>: the given requests in order, no media. Returns each method with the
    status read back (None: the listener closed the connection without an answer)."""
    out = {"pusher": "raw", "port": port, "requests_sent_with_status": [], "rtsp_error_statuses": [], "rc": None}
    try:
        s = socket.create_connection(("127.0.0.1", port), timeout=3)
    except OSError as e:
        out["connect_error"] = str(e)
        return out
    session_id = None
    try:
        s.settimeout(3)
        for i, (method, target, head, body) in enumerate(requests):
            if method == "RECORD" and session_id:
                head += "Session: %s\r\n" % session_id
            try:
                s.sendall(("%s %s RTSP/1.0\r\nCSeq: %d\r\nUser-Agent: row58-raw\r\n%s\r\n%s" % (method, target, i + 1, head, body)).encode())
            except OSError as e:
                out["write_error"] = "%s: %s" % (method, e.__class__.__name__)
                out["requests_sent_with_status"].append([method, None])
                break
            data = b""
            try:
                while b"\r\n\r\n" not in data:
                    chunk = s.recv(4096)
                    if not chunk:
                        break
                    data += chunk
            except OSError as e:
                out["read_error"] = "%s: %s" % (method, e.__class__.__name__)
            text = data.decode("latin1")
            status = text.split("\r\n")[0] if data else None
            for h in text.split("\r\n")[1:]:
                if h.lower().startswith("session:"):
                    session_id = h.split(":", 1)[1].strip().split(";")[0]
            code = int(status.split()[1]) if status and status.startswith("RTSP/1.0 ") else None
            out["requests_sent_with_status"].append([method, code])
            if not status:
                break
        time.sleep(hold_s)
    finally:
        s.close()
    out["rtsp_error_statuses"] = [c for _, c in out["requests_sent_with_status"] if c and c >= 400]
    return out


def handshake(address):
    return [("OPTIONS", address, "", ""), ("ANNOUNCE", address, "Content-Type: application/sdp\r\nContent-Length: %d\r\n" % len(E.SDP), E.SDP),
            ("SETUP", address + "/streamid=0", "Transport: RTP/AVP/TCP;unicast;interleaved=0-1;mode=record\r\n", ""), ("RECORD", address, "Range: npt=0.000-\r\n", "")]


def push_facts(p):
    f = p.facts()
    return {"pusher": "ffmpeg", "port": f["port"], "path": f["path"], "rc": f["rc"], "rtsp_error_statuses": f["rtsp_error_statuses"],
            "requests_sent_with_status": [[m, code] for m, _, code in f["requests_sent_with_status"]], "tcp_connection_refused": f["tcp_connection_refused"]}


def run(name, kind, test_index, make_test, expect, binary=None):
    """One session. `make_test(ctx, port, right, other_port, other_right)` acts on the camera under test and returns
    its facts and the path texts it used; the control push to the other camera is started first, in the same moment.
    `expect`: "refused" or "recorded" for the camera under test; the control must record unless `binary` is the
    proof build, where it must be refused as well."""
    port, right = H.PORTS[test_index], E.RIGHT[test_index]
    cport, cright = H.PORTS[1 - test_index], E.RIGHT[1 - test_index]
    release = H.WORKER
    if binary:
        H.WORKER = binary

    def script(ctx):
        c = E.Push(ctx["d"], "control", cport, cright, ctx["t0"], frames=FRAMES)
        t, used = make_test(ctx, port, right, cport, cright)
        c.wait()
        return {"observation": "ROW58", "case": kind, "port_under_test": port, "test_push": t, "control": push_facts(c), "paths_used": sorted(set(used + [right, cright]))}

    try:
        r = E.session(name, script)
    finally:
        H.WORKER = release
    log = H.worker_log(os.path.join(OUT, "runs", name))
    code, other_code = (UNSEEN_CODE, GATE_CODE) if binary else (GATE_CODE, UNSEEN_CODE)     # row 175: each case has ITS code, never the other
    gate = [l.get("port") for l in log if l.get("message") == code]
    frames = lambda p: int(((r["files"][str(p)].get("video") or {}) if isinstance(r["files"][str(p)].get("video"), dict) else {}).get("nb_read_frames") or 0)
    ic = lambda p: sum(1 for c in r["worker_ingest_connected"] if c["port"] == p)
    r["facts"] = {"test": {"port": port, "ingest_connected": ic(port), "bytes": r["files"][str(port)]["bytes"], "frames": frames(port), "gate_code_lines": gate.count(port)},
                  "control": {"port": cport, "ingest_connected": ic(cport), "bytes": r["files"][str(cport)]["bytes"], "frames": frames(cport), "gate_code_lines": gate.count(cport)},
                  "worker_rc": r.get("worker_rc"), "worker_exit_code": next((l.get("code") for l in log if l.get("message") == "worker_exit"), None),
                  "ingest_codes": sorted({"%s:%s" % (l.get("source", "").replace("capture-worker.", ""), l.get("message")) for l in log if str(l.get("source", "")).startswith("capture-worker.ingest") and l.get("level") in ("warn", "error")}),
                  "path_text_occurrences": sum(r["path_text_in_worker_output"].values()), "leftovers": len(r["leftovers"]["processes"]) + len(r["leftovers"]["listeners"])}
    f = r["facts"]
    refused = lambda x: x["ingest_connected"] == 0 and x["bytes"] == 0
    recorded = lambda x: x["ingest_connected"] == 1 and x["bytes"] > 0 and x["frames"] >= FRAMES // 2 and x["gate_code_lines"] == 0
    f["gate_code"], f["other_gate_code_lines"] = code, sum(1 for l in log if l.get("message") == other_code)
    crit = {"no_path_text_in_worker_output": f["path_text_occurrences"] == 0, "no_leftover": f["leftovers"] == 0, "never_the_other_gate_code": f["other_gate_code_lines"] == 0}
    if binary:
        crit["both_cameras_refused_0_bytes"] = refused(f["test"]) and refused(f["control"])
        crit["gate_code_for_both"] = f["test"]["gate_code_lines"] == 1 and f["control"]["gate_code_lines"] == 1
        crit["session_ended_without_a_camera"] = f["worker_rc"] == 70 and f["worker_exit_code"] == "NO_CAMERA_CONNECTED"
    else:
        crit["control_recorded"] = recorded(f["control"])
        crit["worker_clean_exit"] = f["worker_rc"] == 0
        if expect == "recorded":
            crit["camera_under_test_recorded"] = recorded(f["test"])
        else:
            crit["no_ingest_connected_and_0_bytes"] = refused(f["test"])
            crit["no_rtsp_ok_after_the_announce"] = not any(m in ("SETUP", "RECORD") and code == 200 for m, code in r["test_push"]["requests_sent_with_status"])
            if kind == "noannounce":
                # Seen on libavformat 63.1.102 (first run of this case, 2026-10-13): the library itself ends an open whose
                # client sends RECORD without ANNOUNCE - the open FAILS, so the gate is never reached. Either end is a
                # refusal; which one it was is in `ingest_codes`. The gate's own "no line" branch is the case `unseen`.
                crit["refused_by_the_gate_or_by_the_library"] = f["test"]["gate_code_lines"] == 1 or "ingest%d:INGEST_OPEN_FAILED" % (test_index + 1) in f["ingest_codes"]
            else:
                crit["refused_by_the_gate_code"] = f["test"]["gate_code_lines"] == 1
    r["criteria"], r["verdict"] = crit, "PASS" if all(crit.values()) else "FAIL"
    json.dump(r, open(os.path.join(OUT, "runs", name, "result.json"), "w"), indent=1)
    return r


def ffmpeg_to(path_of):
    def make(ctx, port, right, cport, cright):
        path = path_of(right)
        p = E.Push(ctx["d"], "test", port, path, ctx["t0"], frames=FRAMES)
        p.wait()
        return push_facts(p), [path]
    return make


def raw_foreign(ctx, port, right, cport, cright):
    return raw_requests(port, handshake(E.url(cport, cright))), []            # the OTHER camera's address, sent to THIS camera's port


def raw_noannounce(ctx, port, right, cport, cright):
    address = E.url(port, right)
    return raw_requests(port, [("OPTIONS", address, "", ""), ("RECORD", address, "Range: npt=0.000-\r\n", "")]), []


def todo(what):
    out = []
    if what in ("right", "all"):
        out.append(lambda: run("right_both_at_once", "right", 0, ffmpeg_to(lambda right: right), "recorded"))
    if what in ("near", "all"):
        for k in range(7):
            kind = E.near_misses(E.RIGHT[0])[k][0]
            out.append(lambda k=k, kind=kind: run("near_%s" % kind, "near:" + kind, k % 2, ffmpeg_to(lambda right, k=k: E.near_misses(right)[k][1]), "refused"))
    if what in ("foreign", "all"):
        out += [(lambda i=i: run("foreign_line_on_camera_%d" % (i + 1), "foreign", i, raw_foreign, "refused")) for i in (0, 1)]
    if what in ("noannounce", "all"):
        out.append(lambda: run("no_announce_request", "noannounce", 0, raw_noannounce, "refused"))
    if what in ("unseen", "all"):
        if not os.path.exists(UNSEEN):
            sys.exit("no proof build: make -C apps/capture-worker proof")
        out.append(lambda: run("line_unseen_proof_build", "unseen", 0, ffmpeg_to(lambda right: right), "refused", binary=UNSEEN))
    return out


def line(r):
    f = r["facts"]
    side = lambda x: "port %d ic=%d bytes=%d frames=%d gate=%d" % (x["port"], x["ingest_connected"], x["bytes"], x["frames"], x["gate_code_lines"])
    return "%-34s %-30s test[%s statuses=%s] control[%s] worker rc=%s codes=%s path_text=%d leftover=%d | %s%s" % (
        r["run"], r["case"], side(f["test"]), [code for _, code in r["test_push"]["requests_sent_with_status"]], side(f["control"]), f["worker_rc"], f["ingest_codes"],
        f["path_text_occurrences"], f["leftovers"], r["verdict"], "" if r["verdict"] == "PASS" else " failed: %s" % sorted(k for k, v in r["criteria"].items() if not v))


def summary():
    root, rows = os.path.join(OUT, "runs"), []
    for n in sorted(os.listdir(root)) if os.path.isdir(root) else []:
        p = os.path.join(root, n, "result.json")
        if os.path.exists(p):
            rows.append(json.load(open(p)))
    rows = [r for r in rows if "verdict" in r]
    lines = [line(r) for r in rows]
    tail = "ROW58 GATE: %d run(s), %d PASS, %d FAIL" % (len(rows), sum(r["verdict"] == "PASS" for r in rows), sum(r["verdict"] != "PASS" for r in rows))
    open(os.path.join(OUT, "summary.txt"), "w").write("\n".join(lines + [tail]) + "\n")
    print("\n".join(lines + [tail]))
    return all(r["verdict"] == "PASS" for r in rows) and bool(rows)


def main(argv):
    what = argv[0] if argv else "summary"
    runs = todo(what)
    if not runs and what != "summary":
        sys.exit("usage: row58_gate.py all | right | near | foreign | noannounce | unseen | summary")
    for f in runs:
        print(line(f()), flush=True)
        time.sleep(1.5)
    if runs:
        print("---- summary of every recorded run", flush=True)
    sys.exit(0 if summary() else 1)


if __name__ == "__main__":
    main(sys.argv[1:])
