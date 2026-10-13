#!/usr/bin/env python3
"""Task 4 blueprint row 153 (AD-05, RC-6): the relay's CONFINEMENT, observed from outside. Test code only.

The static half is relay-check.sh (rules RC-6: the one connect is addressed with the locator's host and port, every
request with an address held to them, the socket rule asked at every leg, the limits before the first byte). This
script is the run that OBSERVES: while a relay records, loses its camera and opens it again, its sockets and its
open files are read from the system's tables several times a second.

    # repository root, command sandbox off (loopback 8559, 8561 worker; 8565 camera; 8568 the camera's second port);
    M3_PORTS=8559,8561 /usr/bin/lockf -k -t 1800 .locks/heavy-host.lock \
        python3 -B apps/capture-worker/test-fixtures/row153_confinement.py all
    ... row153_confinement.py observe | elsewhere | file | control | summary

Cases
  observe    one session with a dropped and re-opened camera leg. In EVERY sample: only TCP sockets, each connected
             (none listening, no datagram), each to the camera's host and port or to the loopback ingest port it was
             given; never more than two; no regular file or folder held by a descriptor. Over the run: the push
             socket is ONE connection from first to last (the same local port), the camera side is two (two legs),
             and during the wait between them the push is the only socket.
  elsewhere  after the loss the address answers with a camera that sends its client somewhere else: a redirect
             (given to the request that carried the right answer), a control address on another port, a control
             address on another host. The relay ends with REDIRECT_REFUSED / CONTROL_ADDRESS_REFUSED; connections
             and requests received at the other port: 0; no sample shows a socket to another place.
  file       the relay cannot make a regular file grow: started with its standard error on a FILE, it ends with its
             code and the file holds 0 bytes (through a pipe the same start says its exit line).
  control    NEGATIVE CONTROL of the observation: a client that connects to the camera AND to the camera's second
             port is judged by the same rule and must be found to break it.

Doubles: the test camera, the release worker. The Linux confinement (seccomp filter, unit hardening, what the
process table says about "no new privileges") is not observable here: row 141 / the host profile.
Everything a run writes lands under .cache/row153-confinement/ (git-ignored)."""
import json, os, re, socket, subprocess, sys, threading, time

sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
OUT = os.path.join(REPO, ".cache", "row153-confinement")
os.environ.setdefault("M3_PORTS", "8559,8561")
os.environ["E11_OUT"] = OUT
sys.path.insert(0, HERE)
import e11_listener_path as E                            # read-only reuse; its folder is OUT (imported first)
import row041_relay as R
import row043_reopen as G                                # read-only reuse: the second camera, the drop case's switches
H = E.H

R.OUT = G.OUT = OUT
os.environ["E11_OUT"] = OUT
R.CODES.update({"REDIRECT_REFUSED": 25, "CONTROL_ADDRESS_REFUSED": 26, "START_MESSAGE_INVALID": 10})
SECOND_PORT = 8568                                       # the camera's second listener (decision C33: 8565-8574)
CAMERA, INGEST = "127.0.0.1:%d" % R.CAMERA_PORT, "127.0.0.1:%d" % H.PORTS[0]


class Sampler:
    """Reads the sockets and the open files of one process from the system's tables until told to stop."""

    def __init__(self, pid, every=0.15):
        self.pid, self.every, self.samples, self.stop = str(pid), every, [], threading.Event()
        self.t = threading.Thread(target=self._run, daemon=True)
        self.t.start()

    def _run(self):
        while not self.stop.is_set():
            self.samples.append(sample(self.pid))
            self.stop.wait(self.every)

    def end(self):
        self.stop.set()
        self.t.join(5)
        return [s for s in self.samples if s["alive"]]


def sample(pid):
    net = H.sh(["lsof", "-nP", "-a", "-p", pid, "-i"]).stdout.splitlines()[1:]
    rows = [l.split() for l in net]
    socks = [{"type": r[7] if len(r) > 7 else "?", "name": r[8] if len(r) > 8 else "?", "state": r[9] if len(r) > 9 else ""} for r in rows]
    files = [l.split() for l in H.sh(["lsof", "-nP", "-p", pid]).stdout.splitlines()[1:]]
    held = [r for r in files if len(r) > 4 and re.fullmatch(r"\d+[a-zA-Z]*", r[3]) and r[4] in ("REG", "DIR")]
    return {"at": time.monotonic(), "alive": bool(files), "sockets": socks, "files_by_descriptor": len(held)}


def judged(samples, allowed=(CAMERA, INGEST)):
    """THE RULE, applied to every sample. Returns the facts and the list of what breaks it."""
    broken, pushes, cameras, most = [], set(), set(), 0
    alone = both = False
    for s in samples:
        most = max(most, len(s["sockets"]))
        peers = []
        for k in s["sockets"]:
            local, _, peer = k["name"].partition("->")
            if k["type"] != "TCP":
                broken.append("a socket that is not TCP")
            elif "LISTEN" in k["state"] or not peer:
                broken.append("a socket that listens or is not connected")
            elif peer not in allowed:
                broken.append("a socket to another place")
            else:
                peers.append(peer)
                (pushes if peer == INGEST else cameras).add(local)
        if s["files_by_descriptor"]:
            broken.append("a regular file or a folder held by a descriptor")
        alone = alone or peers == [INGEST]
        both = both or sorted(peers) == sorted([CAMERA, INGEST])
    return {"samples": len(samples), "most_sockets_in_a_sample": most, "push_connections": len(pushes), "camera_connections": len(cameras),
            "a_sample_with_the_push_alone": alone, "a_sample_with_both_legs": both, "broken": sorted(set(broken))}


def observed(inner):
    """Wraps an act of row 43's fixture: the sampler runs for the whole of it."""
    def act(ctx, relay):
        s = Sampler(relay.p.pid)
        extra = inner(ctx, relay)
        extra["observation"] = judged(s.end())
        return extra
    return act


def expect_observe(r, fx):
    o = r["extra"]["observation"]
    reports = G.reports_of(r["relay"]["stdout_text"])
    return {
        "relay_stopped_on_the_order_after_one_reopen": fx["relay_rc"] == 0 and [x.get("report") for x in reports] == ["push_established", "camera_lost", "camera_reopened"],
        "enough_samples": o["samples"] >= 20,              # one reading of the system's tables takes a quarter of a second here
        "nothing_breaks_the_rule_in_any_sample": o["broken"] == [],
        "never_more_than_two_sockets": o["most_sockets_in_a_sample"] == 2,
        "the_push_is_one_connection_from_first_to_last": o["push_connections"] == 1,
        "the_camera_side_is_two_connections_one_per_leg": o["camera_connections"] == 2,
        "during_the_wait_the_push_is_the_only_socket": o["a_sample_with_the_push_alone"] and o["a_sample_with_both_legs"],
        "worker_took_one_push": fx["ingest_connected_port1"] == 1 and fx["worker_gate_refusals"] == 0,
        "worker_clean_exit": fx["worker_rc"] == 0,
    }


def act_elsewhere(camera_extra):
    def act(ctx, relay):
        time.sleep(2.0)
        G.first_camera_ends()
        p2, log2 = G.second_camera(camera_extra)
        ctx["procs"].append(p2)
        lost = relay.saw(b'"report":"camera_lost"', 10)
        relay.wait(30)
        time.sleep(2.0)                                  # nothing may arrive at the other port once the relay is gone
        cam2 = R.camera_end(p2, log2)
        return {"loss_seen": lost is not None, "second_camera_requests": cam2["requests"], "second_camera_counters": {k: v for k, v in cam2["counters"].items() if k.startswith(("second_port", "redirects", "foreign", "connections"))}}
    return observed(act)


def expect_elsewhere(code, requests, counter):
    def check(r, fx):
        o, c = r["extra"]["observation"], r["extra"]["second_camera_counters"]
        return {
            "relay_exit_is_the_named_code": fx["relay_rc"] == R.CODES[code] and fx["relay_code"] == code,
            "the_camera_did_send_its_client_elsewhere": c.get(counter, 0) == 1,
            "requests_at_the_camera_are_exactly_the_expected_ones": r["extra"]["second_camera_requests"] == requests,
            "connections_and_requests_at_the_other_port": c.get("second_port_connections", 0) == 0 and c.get("second_port_requests", 0) == 0 and c.get("second_port_authorized", 0) == 0,
            "no_sample_shows_a_socket_to_another_place": o["broken"] == [] and o["samples"] >= 10 and o["most_sockets_in_a_sample"] <= 2,
            "worker_clean_exit": fx["worker_rc"] == 0,
        }
    return check


def run(name, act, expect, camera_extra=()):
    r = R.session_run(name, "ends", "h264", "sdp", camera_extra=camera_extra, frames=0, act=act, expect=expect)
    r["case"] = "row153"
    json.dump(r, open(os.path.join(OUT, "runs", name, "result.json"), "w"), indent=1, default=str)
    return r


def plain(name, criteria, facts):
    d = os.path.join(OUT, "runs", name)
    os.makedirs(d, exist_ok=True)
    r = {"run": name, "case": "row153", "plain": facts, "criteria": criteria, "verdict": "PASS" if all(criteria.values()) else "FAIL"}
    json.dump(r, open(os.path.join(d, "result.json"), "w"), indent=1, default=str)
    return r


def file_case():
    """Standard error on a regular file: the relay's exit line cannot be written into it (RLIMIT_FSIZE 0)."""
    d = os.path.join(OUT, "runs", "file_cannot_grow")
    os.makedirs(d, exist_ok=True)
    path = os.path.join(d, "stderr.file")
    bad = b'{"type":"start"}\n'
    with open(path, "wb") as f:
        p = H.spawn([R.RELAY], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=f, env={}, close_fds=True)
        p.communicate(bad, timeout=10)
    piped = H.spawn([R.RELAY], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, env={}, close_fds=True)
    _, err = piped.communicate(bad, timeout=10)
    facts = {"rc_with_a_file": p.returncode, "file_bytes": os.path.getsize(path), "rc_with_a_pipe": piped.returncode, "pipe_bytes": len(err)}
    return plain("file_cannot_grow", {"ends_with_its_code_both_times": p.returncode == 10 and piped.returncode == 10,
                                      "the_file_holds_0_bytes": facts["file_bytes"] == 0, "the_pipe_got_the_exit_line": b'"relay":"exit"' in err}, facts)


def control_case():
    """A client that goes to the camera AND to the camera's second port, judged by the rule of this script."""
    d = os.path.join(OUT, "runs", "neg_a_client_with_a_socket_to_another_place")
    os.makedirs(d, exist_ok=True)
    cam = H.spawn([sys.executable, "-B", R.CAMERA, "--port", str(R.CAMERA_PORT), "--second-port", str(SECOND_PORT), "--frames", "0", "--exit-on-stdin-eof", "--max-seconds", "30"],
                  stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
    cam.stdout.readline()
    code = "import socket,time\na=socket.create_connection(('127.0.0.1',%d))\nb=socket.create_connection(('127.0.0.1',%d))\nl=socket.socket();l.bind(('127.0.0.1',0));l.listen(1)\ntime.sleep(4)\n" % (R.CAMERA_PORT, SECOND_PORT)
    client = H.spawn([sys.executable, "-c", code], stdin=subprocess.DEVNULL)
    time.sleep(1.0)
    s = Sampler(client.pid)
    time.sleep(1.5)
    o = judged(s.end())
    client.kill(); client.wait()
    R.camera_end(cam, os.path.join(d, "none.jsonl"))
    must = ["a socket that listens or is not connected", "a socket to another place"]
    r = plain("neg_a_client_with_a_socket_to_another_place", {"the_rule_finds_the_other_place_and_the_listener": all(m in o["broken"] for m in must) and o["samples"] >= 5}, o)
    r["negative_control"] = {"must_be_found": must, "found": o["broken"]}
    json.dump(r, open(os.path.join(d, "result.json"), "w"), indent=1, default=str)
    return r


def todo(what):
    out = []
    drop = ("--drop-after-frames", str(G.DROP_AFTER), "--drop-count", "1", "--drop-style", "reset")
    if what in ("observe", "all"):
        out.append(lambda: run("observe_sockets_and_files_over_a_reopen", observed(G.act_drop(1)), expect_observe, drop))
    if what in ("elsewhere", "all"):
        second = ("--second-port", str(SECOND_PORT))
        out.append(lambda: run("elsewhere_redirect_after_the_right_answer", act_elsewhere(second + ("--redirect", "authenticated")),
                               expect_elsewhere("REDIRECT_REFUSED", [["DESCRIBE", "none", 401], ["DESCRIBE", "digest_ok", 302]], "redirects_sent")))
        out.append(lambda: run("elsewhere_control_address_on_another_port", act_elsewhere(second + ("--sdp-control", "other-port")),
                               expect_elsewhere("CONTROL_ADDRESS_REFUSED", [["DESCRIBE", "none", 401], ["DESCRIBE", "digest_ok", 200]], "foreign_control_descriptions")))
        out.append(lambda: run("elsewhere_control_address_on_another_host", act_elsewhere(("--sdp-control", "other-host")),
                               expect_elsewhere("CONTROL_ADDRESS_REFUSED", [["DESCRIBE", "none", 401], ["DESCRIBE", "digest_ok", 200]], "foreign_control_descriptions")))
    if what in ("file", "all"):
        out.append(file_case)
    if what in ("control", "all"):
        out.append(control_case)
    return out


def line(r):
    failed = "" if r["verdict"] == "PASS" else " failed: %s" % sorted(k for k, v in r["criteria"].items() if not v)
    if "plain" in r:
        return "%-46s %s | %s%s" % (r["run"], json.dumps(r["plain"], separators=(",", ":")), r["verdict"], failed)
    f, x = r["facts"], r["extra"]
    return "%-46s relay rc=%s code=%s | observation=%s | second camera: requests=%s counters=%s | worker ic=%s rc=%s | %s%s" % (
        r["run"], f["relay_rc"], f["relay_code"], json.dumps(x.get("observation"), separators=(",", ":")), json.dumps(x.get("second_camera_requests"), separators=(",", ":")),
        json.dumps(x.get("second_camera_counters"), separators=(",", ":")), f["ingest_connected_port1"], f["worker_rc"], r["verdict"], failed)


def summary():
    root, rows = os.path.join(OUT, "runs"), []
    for n in sorted(os.listdir(root)) if os.path.isdir(root) else []:
        p = os.path.join(root, n, "result.json")
        if os.path.exists(p):
            rows.append(json.load(open(p)))
    rows = [r for r in rows if "verdict" in r and r.get("case") == "row153"]
    lines = [line(r) for r in rows]
    tail = "ROW153 CONFINEMENT: %d run(s), %d PASS, %d FAIL" % (len(rows), sum(r["verdict"] == "PASS" for r in rows), sum(r["verdict"] != "PASS" for r in rows))
    open(os.path.join(OUT, "summary.txt"), "w").write("\n".join(lines + [tail]) + "\n")
    print("\n".join(lines + [tail]))
    return all(r["verdict"] == "PASS" for r in rows) and bool(rows)


def main(argv):
    what = argv[0] if argv else "summary"
    if not os.path.exists(R.RELAY):
        sys.exit("no relay: make -C apps/capture-worker")
    runs = todo(what)
    if not runs and what != "summary":
        sys.exit("usage: row153_confinement.py observe | elsewhere | file | control | all | summary")
    for f in runs:
        print(line(f()), flush=True)
        time.sleep(1.0)
    if runs:
        print("---- summary of every recorded run", flush=True)
    sys.exit(0 if summary() else 1)


if __name__ == "__main__":
    main(sys.argv[1:])
