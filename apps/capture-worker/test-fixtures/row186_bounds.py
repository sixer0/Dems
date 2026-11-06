#!/usr/bin/env python3
"""Task 4 row 186 (security review verification/06_security_relay_client.md, finding H-2): THE TIME BOUNDS OF THE
CAPTURE RELAY, MEASURED. Test code only.

A camera, or whoever answers at its address, must not be able to hold the relay, to spin it for ever, or to make
it deaf to the order to stop. The double is the test camera with its `--adversary` switch (rtsp_test_camera.py):
answers in single bytes, frames in the place of an answer, late answers, and after PLAY a trickle or a flood of
what a client drops. The relay is started as the Core's production door starts it (no shell, an empty
environment, no argument, one compact line on standard input, which stays open).

    # repository root, command sandbox off (loopback ports 8559, 8561 of the worker, 8565 and 8572 of the doubles);
    # `make -C apps/capture-worker` first
    M3_PORTS=8559,8561 /usr/bin/lockf -k -t 1800 .locks/heavy-host.lock \
        python3 -B apps/capture-worker/test-fixtures/row186_bounds.py all
    ... row186_bounds.py open | playing | stop | keyframe | memory | session | summary
    ROW186_RELAY=apps/capture-worker/build/capture-relay-san ... row186_bounds.py all     # the sanitizer build

What is measured, each from an event the CAMERA states (`hostile_start`, `stream_start`), not from the start of
the relay's process, to the moment the relay's process is gone:
  open      one answer in single bytes; frames in the place of the answer (5 s for one answer: CAMERA_STALLED);
            every answer 4.5 s late (15 s for DESCRIBE, SETUP and PLAY together: CAMERA_STALLED); a peer that
            takes the connection and never says a word (5 s: CAMERA_STALLED). NOT measured: the 5 s of the
            connect itself - loopback of this Mac refuses at once what it does not take (hardware package)
  playing   a video packet in single bytes; a flood of empty frames and frames of another channel; a flood of
            RTP packets of another payload type; silence (5 s without a complete picture: CAMERA_STALLED)
  keyframe  pictures at 25 a second and never a keyframe (60 s: KEYFRAME_TIMEOUT)
  memory    a flood of video units of one time stamp without a mark: STREAM_INVALID at the bound of a picture,
            and the most memory the relay's process ever held
  stop      standard input closed, and SIGTERM, 1 s into a flood and into a trickle, before and after PLAY:
            exit 0, and how long it took
  session   with the release worker and a live session: 100 pictures recorded, then the flood. The relay ends
            with CAMERA_STALLED, or stops on the order (closed input, SIGTERM), and the worker's file holds every
            picture that was forwarded and decodes without an error

The account is the test camera's own synthetic constant (imported, never written here); no value of the account,
the locator or the ingest address is printed or stored: a result holds COUNTS of those texts in what the relay
wrote (0 is required). Everything a run writes lands under .cache/row186-bounds/ (git-ignored)."""
import json, os, re, signal, socket, subprocess, sys, threading, time

sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
OUT = os.path.join(REPO, ".cache", "row186-bounds" + ("-san" if "san" in os.path.basename(os.environ.get("ROW186_RELAY", "")) else ""))
os.environ.setdefault("M3_PORTS", "8559,8561")
os.environ["E11_OUT"] = OUT
sys.path.insert(0, HERE)
import e11_listener_path as E                            # read-only reuse: the worker session (its folder is OUT: imported first)
import row041_relay as R                                 # read-only reuse: the relay as the door starts it, the session run
import rtsp_test_camera as CAM                           # read-only: the synthetic account constants
H = E.H
R.OUT = OUT                                              # the session runs of this script land in its own folder
if os.environ.get("ROW186_RELAY"):
    R.RELAY = os.path.abspath(os.environ["ROW186_RELAY"])
SANITIZED = "san" in os.path.basename(R.RELAY)

CODES = {"STOPPED": 0, "CAMERA_UNREACHABLE": 20, "CAMERA_STALLED": 31, "KEYFRAME_TIMEOUT": 30, "STREAM_INVALID": 33}
R.CODES.update(CODES)
BACKLOG_PORT = 8572                                      # a listener that never takes a connection (decision C33: 8565-8574)
INGEST = "rtsp://127.0.0.1:8559/S-ROW186/video-01/" + "Zr186BoundRunElem9x"     # nobody listens there in the runs without a worker
SLACK = 0.6 if SANITIZED else 0.45                       # how far past its bound a run may end: a 100 ms wait slice, TEARDOWN, the exit
STOP_BOUND = 0.6                                         # the order to stop, before a push is open: 0.1 s to see it + 0.5 s TEARDOWN
STOP_BOUND_PUSHING = 2.6                                 # with a push open: + 2 s for the push's own TEARDOWN


class Relay(R.Relay):
    """The relay of row 41's harness, waited for with wait4: the exact moment it is gone, and what it used."""

    def wait(self, timeout):
        if self.rc is not None:
            return self.rc
        end = time.monotonic() + timeout
        while True:
            pid, status, usage = os.wait4(self.p.pid, os.WNOHANG)
            if pid:
                self.gone_at = time.monotonic()
                self.rc = os.waitstatus_to_exitcode(status)
                self.p.returncode = self.rc
                self.cpu_s = round(usage.ru_utime + usage.ru_stime, 3)
                self.peak_bytes = usage.ru_maxrss if sys.platform == "darwin" else usage.ru_maxrss * 1024
                break
            if time.monotonic() > end:
                os.killpg(self.p.pid, signal.SIGKILL)
                os.wait4(self.p.pid, 0)
                self.gone_at, self.rc, self.cpu_s, self.peak_bytes = time.monotonic(), "timeout", None, None
                self.p.returncode = -9
                break
            time.sleep(0.002)
        self.took = round(self.gone_at - self.t0, 3)
        for t in self.readers:
            t.join(3)
        return self.rc

    def lines(self):
        """The sanitizer build says two lines of its own at its start, because the door's environment is empty (no
        PATH: "No external symbolizers found" and its hint). Those two, and only those, are not lines of the relay;
        a REPORT of a sanitizer is never taken out (it fails the shape criterion and `no_sanitizer_report`)."""
        if SANITIZED:
            kept = [l for l in self.err.decode("utf-8", "replace").splitlines()
                    if not re.match(r"^==\d+==(WARN: No external symbolizers found\.|HINT: Is PATH set\?)", l)]
            self.err = ("\n".join(kept) + ("\n" if kept else "")).encode("utf-8")
        return super().lines()

    def sanitizer_reports(self):
        text = self.err.decode("utf-8", "replace")
        return sum(text.count(mark) for mark in ("ERROR: AddressSanitizer", "runtime error:", "SUMMARY: "))


R.Relay = Relay


class Camera:
    """The test camera; the moment each of its event lines was READ here is kept (monotonic clock of this script)."""

    def __init__(self, d, extra=(), codec="h264", sets="sdp", frames=0):
        self.log = os.path.join(d, "camera.jsonl")
        self.p = H.spawn([sys.executable, "-B", R.CAMERA, "--port", str(R.CAMERA_PORT), "--codec", codec, "--param-sets", sets, "--frames", str(frames),
                          "--event-log", self.log, "--exit-on-stdin-eof", "--max-seconds", "150"] + list(extra), stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
        ready = json.loads(self.p.stdout.readline().decode() or "{}")
        if ready.get("event") != "ready":
            raise RuntimeError("the test camera did not start")
        self.path, self.at, self.seen = ready["path"], {}, threading.Condition()
        threading.Thread(target=self._read, daemon=True).start()

    def _read(self):
        for raw in self.p.stdout:
            now = time.monotonic()
            try:
                event = json.loads(raw.decode()).get("event")
            except ValueError:
                continue
            with self.seen:
                self.at.setdefault(event, now)
                self.seen.notify_all()

    def when(self, event, timeout):
        with self.seen:
            self.seen.wait_for(lambda: event in self.at, timeout)
            return self.at.get(event)

    def end(self):
        return R.camera_end(self.p, self.log)


LAST_CAMERA = {}


def camera_start(d, codec="h264", sets="sdp", frames=R.FRAMES, extra=()):
    """The signature of row 41's `camera_start`, for its session run: the camera of this script, remembered."""
    c = Camera(d, extra, codec, sets, frames)
    LAST_CAMERA["camera"] = c
    return c.p, c.log, c.path


R.camera_start = camera_start


def backlog_listener():
    """A loopback listener whose program never takes a connection and never says a word: the system completes the
    connection, the request is never answered. (A connection that never COMPLETES cannot be made on loopback of
    this Mac: with the queue full the system refuses at once - measured, 400 attempts. The connect bound itself
    is therefore not measured here; it goes to the hardware package.)"""
    srv = socket.socket()
    srv.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    srv.bind(("127.0.0.1", BACKLOG_PORT))
    srv.listen(4)
    return srv, [], True


def queue_of(srv):
    """Row T3 (review 060c X-06; survivor 16 of its section 6). The criterion `the_listener_took_no_connection` was the
    literal True that `backlog_listener` returns: nothing calls `accept` during a run, so it could never fail - and it
    did not show that the relay ever reached this listener. AFTER the relay is gone, the queue is read once: how many
    connections the system had completed for a program that never took one, and the first word each had sent (the
    request that was never answered). Returns (connections, [first word of each])."""
    srv.setblocking(False)
    first = []
    while True:
        try:
            c, _ = srv.accept()
        except OSError:
            break
        c.setblocking(False)
        try:
            got = c.recv(4096)
        except OSError:
            got = b""
        first.append(got.split(b" ")[0].decode("latin1", "replace")[:16] if got else "")
        c.close()
    return len(first), first


def bound_run(name, kind, expect_code, extra=(), bound=None, base="hostile_start", act=None, limit=None, wait=30, peak_most=None, backlog=False, slack=SLACK):
    """One relay against one camera, no worker. `bound`: seconds from the camera's event `base` to the relay being gone."""
    d = os.path.join(OUT, "runs", name)
    os.makedirs(d, exist_ok=True)
    srv = held = cam = None
    full = True
    if backlog:
        srv, held, full = backlog_listener()
        locator, base_at = "rtsp://127.0.0.1:%d/media/video1" % BACKLOG_PORT, None
    else:
        cam = Camera(d, extra)
        locator = "rtsp://127.0.0.1:%d%s" % (R.CAMERA_PORT, cam.path)
    texts = R.texts_of(INGEST, locator, CAM.ACCOUNT_USER, CAM.ACCOUNT_PASSWORD)
    relay = Relay(d, R.start_message(INGEST, locator, CAM.ACCOUNT_USER, CAM.ACCOUNT_PASSWORD))
    base_at = cam.when(base, 12) if cam else relay.t0
    acted_at = act(relay, base_at) if act else None
    rc = relay.wait(wait)
    relay.close_input()
    camera = cam.end() if cam else {"counters": {}, "requests": []}
    queued, first_words = queue_of(srv) if srv else (None, [])            # row T3 (X-06): read once, after the relay is gone
    for s in (held or []) + ([srv] if srv else []):
        s.close()
    exit_line = next((l for l in relay.lines() if l.get("relay") == "exit"), {})
    from_base = round(relay.gone_at - base_at, 3) if base_at else None
    from_act = round(relay.gone_at - acted_at, 3) if acted_at else None
    r = {"run": name, "case": kind, "relay_binary": os.path.basename(R.RELAY), "relay_rc": rc, "relay_code": exit_line.get("code"), "seconds_from_start_of_process": relay.took,
         "base_event": base if cam else "start of the relay's process", "seconds_from_base_to_gone": from_base, "bound_seconds": bound, "seconds_from_the_order_to_gone": from_act,
         "relay_cpu_seconds": relay.cpu_s, "relay_peak_bytes": relay.peak_bytes, "stdout_bytes": len(relay.out), "lines": relay.lines(),
         "texts_in_relay_output": R.occurrences(texts, relay.out, relay.err), "camera_counters": camera["counters"], "camera_requests": camera["requests"],
         "hostile_megabytes_sent": round(camera["counters"].get("hostile_bytes_sent", 0) / 1e6, 2), "leftovers": len(H.leftovers()["processes"]), "queue_was_full": full}
    crit = {"relay_exit_is_the_named_code": rc == CODES[expect_code] and exit_line.get("code") == expect_code, "nothing_on_standard_output": len(relay.out) == 0,
            "every_line_is_fixed_shape": all("not_json" not in l for l in relay.lines()), "no_text_of_the_message_in_the_output": sum(r["texts_in_relay_output"].values()) == 0,
            "no_basic_request_at_the_camera": camera["counters"].get("auth_basic", 0) == 0, "no_leftover": r["leftovers"] == 0,
            "no_sanitizer_report": relay.sanitizer_reports() == 0}
    if bound is not None:
        crit["ended_at_its_bound_not_before_and_not_later"] = from_base is not None and bound - 0.1 <= from_base <= bound + slack
    if limit is not None:
        crit["gone_inside_the_stated_bound_after_the_order"] = from_act is not None and from_act <= limit
    if peak_most is not None:
        crit["memory_stayed_bounded"] = relay.peak_bytes is not None and relay.peak_bytes <= peak_most
    if backlog:
        # Row T3 (X-06): not the literal True it was. The relay DID reach this listener - ONE connection stood in its
        # queue, with a request in it - and the program never took it during the run, so that request was never answered.
        r["listener_queue"] = {"connections": queued, "first_words": first_words}
        crit["the_relay_made_ONE_connection_to_the_listener_and_its_request_was_never_answered"] = queued == 1 and first_words[0] in ("OPTIONS", "DESCRIBE")
    r["criteria"], r["verdict"] = crit, "PASS" if all(crit.values()) else "FAIL"
    json.dump(r, open(os.path.join(d, "result.json"), "w"), indent=1, default=str)
    return r


def order(how, after):
    """The order to stop, `after` seconds after the camera's event: standard input closed, or SIGTERM."""
    def act(relay, base_at):
        time.sleep(max(0.0, (base_at or time.monotonic()) + after - time.monotonic()))
        at = time.monotonic()
        if how == "input":
            relay.close_input()
        else:
            os.kill(relay.p.pid, signal.SIGTERM)
        return at
    return act


def session_case(name, how):
    """With the worker and a live session: 100 pictures are recorded, then the camera floods."""
    seen = {}

    def act(ctx, relay):
        cam = LAST_CAMERA["camera"]
        base_at = cam.when("hostile_start", 15)
        acted_at = order(how, 1.0)(relay, base_at) if how else None
        # Row 43: with the push open a stalled camera no longer ENDS the relay. At its bound the relay says the loss
        # (one line of standard output, cause 31) and would open the camera again 2 s later. The bound is measured
        # at that line; the run then stops the relay by the order to stop, before the re-open.
        lost_at = None if how else relay.saw(b'"report":"camera_lost"', 15)
        if not how:
            relay.close_input()
        relay.wait(15)
        measured_at = relay.gone_at if how else lost_at
        seen.update(from_base=round(measured_at - base_at, 3) if base_at and measured_at else None, from_act=round(relay.gone_at - acted_at, 3) if acted_at else None,
                    cpu=relay.cpu_s, peak=relay.peak_bytes, reports=relay.sanitizer_reports())
        return {"seconds_from_the_flood_to_gone": seen["from_base"], "seconds_from_the_order_to_gone": seen["from_act"], "relay_cpu_seconds": relay.cpu_s, "relay_peak_bytes": relay.peak_bytes}

    def expect(r, fx):
        c = R.recorded("h264", "STOPPED" if how else "CAMERA_STALLED", min_pictures=95)(r, fx)
        c["every_picture_before_the_flood_was_forwarded"] = fx["relay_pictures"] == 100 and fx["relay_held_back"] == 0
        c["no_sanitizer_report"] = seen.get("reports") == 0
        if how:
            c["gone_inside_the_stated_bound_after_the_order"] = seen.get("from_act") is not None and seen["from_act"] <= STOP_BOUND_PUSHING
        else:
            c["ended_at_its_bound_not_before_and_not_later"] = seen.get("from_base") is not None and 5.0 - 0.1 <= seen["from_base"] <= 5.0 + SLACK + 2.0
        return c

    r = R.session_run(name, "ends", "h264", "sdp", camera_extra=("--adversary", "flood-stream", "--adversary-after-frames", "100"), frames=0, act=act, expect=expect)
    r["case"] = "session"
    r["relay_binary"] = os.path.basename(R.RELAY)
    json.dump(r, open(os.path.join(OUT, "runs", name, "result.json"), "w"), indent=1, default=str)
    return r


def todo(what):
    out = []
    hostile = lambda mode, *more: ("--adversary", mode) + more
    if what in ("open", "all"):
        out.append(lambda: bound_run("open_answer_in_single_bytes", "open", "CAMERA_STALLED", hostile("trickle-answer"), bound=5.0))
        out.append(lambda: bound_run("open_frames_in_the_place_of_the_answer", "open", "CAMERA_STALLED", hostile("flood-answer"), bound=5.0))
        out.append(lambda: bound_run("open_every_answer_late_but_inside_its_own_bound", "open", "CAMERA_STALLED", hostile("slow-answers"), bound=15.0))
        # Measured from the start of the relay's process (there is no camera to state an event): its own start is in the number.
        out.append(lambda: bound_run("open_peer_that_never_says_a_word", "open", "CAMERA_STALLED", bound=5.0, backlog=True, slack=SLACK + 1.0))
    if what in ("playing", "all"):
        out.append(lambda: bound_run("playing_video_packet_in_single_bytes", "playing", "CAMERA_STALLED", hostile("trickle-stream"), bound=5.0))
        out.append(lambda: bound_run("playing_flood_of_empty_and_other_channel_frames", "playing", "CAMERA_STALLED", hostile("flood-stream"), bound=5.0))
        out.append(lambda: bound_run("playing_flood_of_packets_of_another_payload_type", "playing", "CAMERA_STALLED", hostile("flood-foreign"), bound=5.0))
        out.append(lambda: bound_run("playing_silence", "playing", "CAMERA_STALLED", ("--first-keyframe-delay-ms", "20000", "--first-keyframe-fill", "none"), bound=5.0, base="stream_start"))
    if what in ("memory", "all"):
        out.append(lambda: bound_run("memory_picture_that_never_ends", "memory", "STREAM_INVALID", hostile("flood-unmarked"), limit=None, peak_most=(160 if SANITIZED else 96) * 1024 * 1024))
    if what in ("stop", "all"):
        for mode in ("flood-answer", "trickle-answer", "flood-stream", "flood-foreign", "trickle-stream"):
            for how in ("input", "sigterm"):
                out.append(lambda mode=mode, how=how: bound_run("stop_%s_during_%s" % (how, mode.replace("-", "_")), "stop", "STOPPED", hostile(mode), act=order(how, 1.0), limit=STOP_BOUND))
    if what in ("keyframe", "all"):
        out.append(lambda: bound_run("keyframe_pictures_and_never_a_keyframe", "keyframe", "KEYFRAME_TIMEOUT", ("--first-keyframe-delay-ms", "75000", "--first-keyframe-fill", "inter"),
                                     bound=60.0, base="stream_start", wait=80))
    if what in ("session", "all"):
        out.append(lambda: session_case("session_flood_after_100_pictures", None))
        out.append(lambda: session_case("session_input_closed_during_the_flood", "input"))
        out.append(lambda: session_case("session_sigterm_during_the_flood", "sigterm"))
    return out


def line(r):
    failed = "" if r["verdict"] == "PASS" else " failed: %s" % sorted(k for k, v in r["criteria"].items() if not v)
    if "facts" in r:
        f, x = r["facts"], r.get("extra", {})
        return "%-50s relay rc=%s code=%s pictures=%s | from the flood to gone %ss, from the order to gone %ss, cpu %ss | file frames=%s decode_errors=%s control=%s leftover=%s | %s%s" % (
            r["run"], f["relay_rc"], f["relay_code"], f["relay_pictures"], x.get("seconds_from_the_flood_to_gone"), x.get("seconds_from_the_order_to_gone"), x.get("relay_cpu_seconds"),
            f["file_frames"], f["decode_error_lines"], f["control_recorded"], f["leftovers"], r["verdict"], failed)
    return "%-50s relay rc=%s code=%s | bound %ss: gone %ss after %s | after the order: %ss | cpu %ss peak %s MiB | camera sent %s MB hostile | %s%s" % (
        r["run"], r["relay_rc"], r["relay_code"], r["bound_seconds"], r["seconds_from_base_to_gone"], r["base_event"], r["seconds_from_the_order_to_gone"], r["relay_cpu_seconds"],
        round(r["relay_peak_bytes"] / 1048576, 1) if r["relay_peak_bytes"] else None, r["hostile_megabytes_sent"], r["verdict"], failed)


def summary():
    root, rows = os.path.join(OUT, "runs"), []
    for n in sorted(os.listdir(root)) if os.path.isdir(root) else []:
        p = os.path.join(root, n, "result.json")
        if os.path.exists(p):
            rows.append(json.load(open(p)))
    rows = [r for r in rows if "verdict" in r]
    lines = [line(r) for r in rows]
    tail = "ROW186 BOUNDS (%s): %d run(s), %d PASS, %d FAIL" % (os.path.basename(R.RELAY), len(rows), sum(r["verdict"] == "PASS" for r in rows), sum(r["verdict"] != "PASS" for r in rows))
    open(os.path.join(OUT, "summary.txt"), "w").write("\n".join(lines + [tail]) + "\n")
    print("\n".join(lines + [tail]))
    return all(r["verdict"] == "PASS" for r in rows) and bool(rows)


def main(argv):
    what = argv[0] if argv else "summary"
    if not os.path.exists(R.RELAY):
        sys.exit("no relay: make -C apps/capture-worker")
    runs = todo(what)
    if not runs and what != "summary":
        sys.exit("usage: row186_bounds.py all | open | playing | memory | stop | keyframe | session | summary")
    for f in runs:
        print(line(f()), flush=True)
        time.sleep(1.0)
    if runs:
        print("---- summary of every recorded run", flush=True)
    sys.exit(0 if summary() else 1)


if __name__ == "__main__":
    main(sys.argv[1:])
