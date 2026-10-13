#!/usr/bin/env python3
"""Task 4 blueprint row 143b: THE SOURCE ADDRESS of the relay's camera leg, on this Mac's loopback. Test code only.

    a counting double / the test camera (rtsp_test_camera.py)  <-  build/capture-relay, started as the door starts it

What is under test (apps/capture-worker/src/relay/relay.h, "THE SOURCE ADDRESS"): the start message states the
address of this host the connection to the camera must leave from (`source`). The relay gives it to its one socket
BEFORE it connects. An address this host does not hold cannot be given: the relay ends with CAMERA_UNREACHABLE and
NOTHING reaches the camera - no connection, no request. Record mode must state the address; a text that is not the
strict dotted form is an invalid start message.

    # repository root, command sandbox off (loopback ports 8565 of the test camera and 8566 of the counting double);
    # `make -C apps/capture-worker` first. One lock hold:
    /usr/bin/lockf -k -t 1800 .locks/heavy-host.lock python3 -B apps/capture-worker/test-fixtures/row143b_source_bind.py all
    ... row143b_source_bind.py all | summary

Cases (no worker is started: every case ends before a push, or is a probe)
  probe_from_loopback            source 127.0.0.1, the test camera: the probe reports (exit 0); the camera was asked.
                                 AND (review 060b 7.4 (2), row T2) a second probe whose source is ANOTHER address of
                                 this host (127.0.0.2 on Linux, an interface's address on macOS), to the counting
                                 double on 127.0.0.1: the double must see the connection come FROM that address. A
                                 socket that was never given an address arrives from 127.0.0.1, so this half fails
                                 with the bind of the dial removed. A host with no second address FAILS the case
                                 (never skipped): the first half alone proves nothing about the bind
  probe_without_a_source        CONTROL: no source stated (a camera that is not stored yet): the probe reports too
  probe_from_an_address_not_held source 192.0.2.1 (a documentation address this host does not hold), the counting
                                 double: CAMERA_UNREACHABLE, 0 connections, 0 requests at the double
  record_from_an_address_not_held  the same in record mode
  record_from_loopback_is_seen   CONTROL of the two above: the SAME double, the same message with source 127.0.0.1:
                                 the double counts a connection and a DESCRIBE (it answers 404: LOCATOR_NOT_FOUND).
                                 So only the source address made the difference, and the double does count
  record_without_a_source        START_MESSAGE_INVALID, 0 connections
  record_source_<form>           eight texts that are no source address: START_MESSAGE_INVALID, 0 connections

WHAT LOOPBACK CANNOT SHOW (stated in the record of the row): on one network an unbound socket and a bound one have
the same address, so a case that CONNECTS from 127.0.0.1 does not tell them apart (the second half of
probe_from_loopback, since row T2, connects from ANOTHER address of this host and does) - the proof that the address is given before the
connection is the refusal above, the unit check of the one dial (test/relay_unit_test.c, `source_dial`: also after a
leg was given up and opened again) and the static pins of relay-check.sh. That the address of a SECOND interface is
the one a camera sees, and that the re-open of a running relay is refused when the host lost the address, need a
host with two networks: hardware.

The account is the test camera's own synthetic constant (imported, never written here). No value of the account,
the locator or the ingest address is printed or stored. Everything a run writes lands under
.cache/row143b-source-bind/ (git-ignored)."""
import json, os, re, socket, subprocess, sys, threading, time

sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
OUT = os.path.join(REPO, ".cache", "row143b-source-bind")
os.environ.setdefault("M3_PORTS", "8559,8561")
os.environ["E11_OUT"] = OUT
sys.path.insert(0, HERE)
import row041_relay as R                                 # read-only reuse: the relay as the door starts it, the camera start
import rtsp_test_camera as CAM                           # read-only: the synthetic account constants

H = R.H
DOUBLE_PORT = 8566                                       # decision C33: a test-camera double binds 8565-8574
NOT_HELD = "192.0.2.1"                                   # TEST-NET-1 (RFC 5737): never an address of a host
CODES = {"STOPPED": 0, "START_MESSAGE_INVALID": 10, "CAMERA_UNREACHABLE": 20, "LOCATOR_NOT_FOUND": 24}
INGEST = "rtsp://127.0.0.1:8559/S-ROW143B/video-01/Zr143bSourceRunElem9x"
NOT_SOURCES = {"any_address": "0.0.0.0", "a_name": "localhost", "leading_zeros": "127.000.000.001", "with_a_port": "127.0.0.1:0", "multicast": "224.0.0.1",
               "broadcast": "255.255.255.255", "a_number": 2130706433, "empty": ""}


def probe_message(locator, user, secret, attempt=1, **more):
    m = {"type": "start", "mode": "probe", "attempt": attempt}
    m.update(more)
    m["access"] = {"locator": locator, "username": user, "secret": secret}
    return (json.dumps(m, separators=(",", ":"), ensure_ascii=False) + "\n").encode("utf-8")


class CountingDouble:
    """Listens on loopback and counts: connections taken, requests read. Every request is answered 404."""

    def __init__(self, port):
        self.connections, self.requests, self.peers = 0, [], []
        self.srv = socket.socket()
        self.srv.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        self.srv.bind(("127.0.0.1", port))
        self.srv.listen(4)
        self.srv.settimeout(0.2)
        self.stop = False
        self.thread = threading.Thread(target=self._serve, daemon=True)
        self.thread.start()

    def _serve(self):
        while not self.stop:
            try:
                c, peer = self.srv.accept()
            except OSError:
                continue
            self.connections += 1
            self.peers.append(peer[0])
            c.settimeout(2)
            buf = b""
            try:
                while not self.stop:
                    while b"\r\n\r\n" not in buf:
                        got = c.recv(4096)
                        if not got:
                            raise OSError()
                        buf += got
                    head, buf = buf.split(b"\r\n\r\n", 1)
                    lines = head.decode("latin1").split("\r\n")
                    cseq = next((l.split(":", 1)[1].strip() for l in lines if l.lower().startswith("cseq")), "0")
                    self.requests.append(lines[0].split(" ")[0])
                    c.sendall(("RTSP/1.0 404 Not Found\r\nCSeq: %s\r\n\r\n" % cseq).encode("latin1"))
            except OSError:
                pass
            finally:
                c.close()

    def close(self):
        self.stop = True
        self.thread.join(3)
        self.srv.close()


def relay_end(d, message, wait=12):
    relay = R.Relay(d, message)
    rc = relay.wait(wait)
    relay.close_input()
    exit_line = next((l for l in relay.lines() if l.get("relay") == "exit"), {})
    return relay, rc, exit_line


def texts(relay):
    probe = {"secret": CAM.ACCOUNT_PASSWORD, "account": CAM.ACCOUNT_USER, "element": "Zr143bSourceRunElem9x", "not_held": NOT_HELD}
    return R.occurrences(probe, relay.out, relay.err)


def finish(name, d, r, crit):
    r["leftovers"] = len(H.leftovers()["processes"])
    crit["no_leftover"] = r["leftovers"] == 0
    r["run"], r["criteria"], r["verdict"] = name, crit, "PASS" if all(crit.values()) else "FAIL"
    json.dump(r, open(os.path.join(d, "result.json"), "w"), indent=1, default=str)
    return r


def double_run(name, message, expect_code, connections, requests):
    """One relay against the counting double: the code it ends with, and what the double saw."""
    d = os.path.join(OUT, "runs", name)
    os.makedirs(d, exist_ok=True)
    double = CountingDouble(DOUBLE_PORT)
    try:
        relay, rc, exit_line = relay_end(d, message)
        time.sleep(0.3)                                  # what was sent has arrived by now
    finally:
        double.close()
    r = {"relay_rc": rc, "relay_code": exit_line.get("code"), "seconds": relay.took, "stdout_bytes": len(relay.out), "double_connections": double.connections,
         "double_requests": list(double.requests), "double_peers": sorted(set(double.peers)), "texts_in_relay_output": texts(relay)}
    crit = {"relay_exit_is_the_named_code": rc == CODES[expect_code] and exit_line.get("code") == expect_code, "nothing_on_standard_output": len(relay.out) == 0,
            "every_line_is_fixed_shape": all("not_json" not in l for l in relay.lines()), "no_text_of_the_message_in_the_output": sum(r["texts_in_relay_output"].values()) == 0,
            "connections_at_the_double": double.connections == connections, "requests_at_the_double": double.requests == requests}
    return finish(name, d, r, crit)


def second_address():
    """Review 060b section 7.4 (2), row T2. An IPv4 address of THIS host that is not 127.0.0.1 and that a socket can
    be given: 127.0.0.2 where the whole loopback network is the host's (Linux), else the first address of an
    interface in the system's own listing. Nothing is sent to find it (a listing is read, a socket is given the
    address and closed). None when the host holds no other address."""
    found = ["127.0.0.2"]
    for command in (["/sbin/ifconfig"], ["ip", "-4", "-o", "addr"]):
        try:
            listing = subprocess.run(command, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, timeout=5).stdout.decode("ascii", "replace")
        except (OSError, subprocess.TimeoutExpired):
            continue
        found += re.findall(r"\binet (?:addr:)?(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b", listing)
    for address in found:
        if address == R.SOURCE or not 1 <= int(address.split(".")[0]) <= 223:
            continue
        s = socket.socket()
        try:
            s.bind((address, 0))
            return address
        except OSError:
            continue
        finally:
            s.close()
    return None


def seen_from(d, source):
    """One probe that states `source`, against the counting double on loopback: the address the double saw the
    connection come FROM. The double is on 127.0.0.1, so a socket that was never given an address arrives from
    127.0.0.1 - only a socket that was given `source` before it connected arrives from `source`. Nothing leaves
    this host: both ends are its own addresses."""
    os.makedirs(d, exist_ok=True)
    double = CountingDouble(DOUBLE_PORT)
    try:
        relay, rc, exit_line = relay_end(d, probe_message("rtsp://127.0.0.1:%d/media/video1" % DOUBLE_PORT, CAM.ACCOUNT_USER, CAM.ACCOUNT_PASSWORD, attempt=8, source=source))
        time.sleep(0.3)                                  # what was sent has arrived by now
    finally:
        double.close()
    return {"relay_rc": rc, "relay_code": exit_line.get("code"), "connections": double.connections, "requests": list(double.requests),
            "peers_are_the_source": [p == source for p in double.peers], "peers_are_loopback": [p == R.SOURCE for p in double.peers],
            "texts_in_relay_error_output": R.occurrences({"secret": CAM.ACCOUNT_PASSWORD, "account": CAM.ACCOUNT_USER}, relay.err)}


def camera_run(name, source, bound=False):
    """One probe of the test camera, with or without a source address. `bound` (case probe_from_loopback): a second
    probe, from an address of this host that is NOT loopback's 127.0.0.1, must be SEEN to come from that address."""
    d = os.path.join(OUT, "runs", name)
    os.makedirs(d, exist_ok=True)
    cam, log, path = R.camera_start(d, "h264", "sdp")
    try:
        locator = "rtsp://127.0.0.1:%d%s" % (R.CAMERA_PORT, path)
        more = {} if source is None else {"source": source}
        relay, rc, exit_line = relay_end(d, probe_message(locator, CAM.ACCOUNT_USER, CAM.ACCOUNT_PASSWORD, attempt=7, **more), wait=20)
    finally:
        seen = R.camera_end(cam, log)
    out = relay.out.decode("utf-8", "replace")
    try:
        report = json.loads(out) if out.endswith("\n") and out.count("\n") == 1 else {}
    except ValueError:
        report = {}
    methods = [m for m, _, _ in seen["requests"]]
    r = {"relay_rc": rc, "relay_code": exit_line.get("code"), "seconds": relay.took, "report_keys": sorted(report.keys()), "camera_requests": seen["requests"], "texts_in_relay_error_output": R.occurrences(
        {"secret": CAM.ACCOUNT_PASSWORD, "account": CAM.ACCOUNT_USER}, relay.err)}
    crit = {"relay_exit_is_STOPPED": rc == 0 and exit_line.get("code") == "STOPPED", "one_probe_line_with_its_attempt": report.get("report") == "probe" and report.get("attempt") == 7,
            "the_camera_was_asked": all(m in methods for m in ("DESCRIBE", "SETUP", "PLAY")), "every_line_is_fixed_shape": all("not_json" not in l for l in relay.lines()),
            "no_text_of_the_account_in_the_error_output": sum(r["texts_in_relay_error_output"].values()) == 0}
    if bound:
        # Review 060b 7.4 (2): everything above passes with the bind of the dial REMOVED (one network: the same
        # address either way). This half does not: a host without a second address FAILS it - it is never skipped.
        other = second_address()
        leg = seen_from(os.path.join(d, "second-address"), other) if other else {}
        r["second_address"] = {"found": other is not None, "is_loopback_network": bool(other and other.startswith("127.")), "leg": leg}
        crit["a_second_address_of_this_host_exists"] = other is not None
        crit["from_the_second_address_the_double_saw_ONE_connection_from_THAT_address_and_none_from_127_0_0_1"] = (
            leg.get("connections") == 1 and leg.get("peers_are_the_source") == [True] and leg.get("peers_are_loopback") == [False])
        crit["that_probe_asked_the_double_and_ended_with_its_404"] = leg.get("requests") == ["DESCRIBE"] and leg.get("relay_rc") == CODES["LOCATOR_NOT_FOUND"] and leg.get("relay_code") == "LOCATOR_NOT_FOUND"
        crit["no_text_of_the_account_in_the_error_output_of_that_probe"] = bool(leg) and sum(leg["texts_in_relay_error_output"].values()) == 0
    return finish(name, d, r, crit)


def todo():
    u, s = CAM.ACCOUNT_USER, CAM.ACCOUNT_PASSWORD
    at_double = "rtsp://127.0.0.1:%d/media/video1" % DOUBLE_PORT
    runs = [lambda: camera_run("probe_from_loopback", R.SOURCE, bound=True),
            lambda: camera_run("probe_without_a_source", None),
            lambda: double_run("probe_from_an_address_not_held", probe_message(at_double, u, s, source=NOT_HELD), "CAMERA_UNREACHABLE", 0, []),
            lambda: double_run("record_from_an_address_not_held", R.start_message(INGEST, at_double, u, s, source=NOT_HELD), "CAMERA_UNREACHABLE", 0, []),
            lambda: double_run("record_from_loopback_is_seen", R.start_message(INGEST, at_double, u, s), "LOCATOR_NOT_FOUND", 1, ["DESCRIBE"]),
            lambda: double_run("record_without_a_source", R.start_message(INGEST, at_double, u, s, source=None), "START_MESSAGE_INVALID", 0, [])]
    for k, v in NOT_SOURCES.items():
        runs.append(lambda k=k, v=v: double_run("record_source_%s" % k, R.start_message(INGEST, at_double, u, s, source=v), "START_MESSAGE_INVALID", 0, []))
    return runs


def summary():
    rows = []
    base = os.path.join(OUT, "runs")
    for name in sorted(os.listdir(base)) if os.path.isdir(base) else []:
        path = os.path.join(base, name, "result.json")
        if os.path.exists(path):
            rows.append(json.load(open(path)))
    passed = sum(1 for r in rows if r.get("verdict") == "PASS")
    for r in rows:
        print("%-4s %-40s rc=%-3s code=%-22s %s" % (r.get("verdict"), r.get("run"), r.get("relay_rc"), r.get("relay_code"),
                                                 "double: %d connection(s), %d request(s)" % (r["double_connections"], len(r["double_requests"])) if "double_connections" in r
                                                 else "camera: %d request(s)" % len(r.get("camera_requests", []))))
        for k, v in sorted(r.get("criteria", {}).items()):
            if not v:
                print("       FAILED: %s" % k)
    print("row143b_source_bind: %d of %d runs PASS" % (passed, len(rows)))
    return passed == len(rows) and len(rows) > 0


def main(argv):
    what = argv[0] if argv else "all"
    if what not in ("all", "summary"):
        sys.exit("usage: row143b_source_bind.py all | summary")
    if what == "all":
        if not os.path.exists(R.RELAY):
            sys.exit("row143b_source_bind: build/capture-relay is missing (make -C apps/capture-worker)")
        for run in todo():
            run()
    sys.exit(0 if summary() else 1)


if __name__ == "__main__":
    main(sys.argv[1:])
