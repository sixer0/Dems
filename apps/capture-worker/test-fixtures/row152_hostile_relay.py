#!/usr/bin/env python3
"""Task 4 blueprint row 152 (AD-05, AD-06; security item S13-01 "never another host"): THE CAPTURE RELAY AGAINST THE
TEST CAMERA'S REDIRECT AND HOSTILE DESCRIPTIONS. Test code only.

The double is the test camera with the switches of row 152 (rtsp_test_camera.py: `--second-port`, `--redirect`,
`--sdp-control`, `--sdp-codec`). The relay is the EXISTING build/capture-relay, started as the Core's production
door starts it (row041_relay.py, imported unchanged: no shell, an empty environment, no argument, one compact line
on standard input, which stays open). No worker runs: every case must end BEFORE the relay has anything to push.

    # repository root, command sandbox off (loopback ports 8565 and 8568 of the camera; ps and lsof);
    # the relay is NOT built here
    /usr/bin/lockf -k -t 1800 .locks/heavy-host.lock \
        python3 -B apps/capture-worker/test-fixtures/row152_hostile_relay.py all
    ... row152_hostile_relay.py redirect | control | codec | plain | summary

Cases (each on h264 with the sets in the description and on hevc with the sets in band)
  redirect  the camera answers DESCRIBE with 302 to its second port, at once and after the Digest answer:
            exit REDIRECT_REFUSED; connections on the second port: 0
  control   the description's media control address is an absolute locator of the camera's second port, and of
            the address 127.0.0.2: exit CONTROL_ADDRESS_REFUSED; no SETUP reached the camera on either port
  codec     the description names a codec of 300 characters with markup: the relay ends with a named refusal
            before any SETUP, and none of that text is in anything it wrote. The lower-case name is run as an
            OBSERVATION (codec names are case-insensitive in a description): what the relay does is recorded
  plain     CONTROL of the harness: the same camera without a hostile switch. The relay gets past the description
            (the camera sees SETUP) and ends at the ingest, where nothing listens

A case the relay does NOT refuse is a FINDING: its verdict is FINDING, the exact case is in its result, and this
script changes nothing of the relay. The account is the test camera's own synthetic constant (imported, never
written here); a result holds COUNTS of the account, the locator, the ingest address and the hostile text in what
the relay wrote (0 is required). Everything a run writes lands under .cache/row152-hostile-relay/ (git-ignored)."""
import json, os, sys, time

sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
OUT = os.path.join(REPO, ".cache", "row152-hostile-relay")
os.environ.setdefault("M3_PORTS", "8559,8561")
os.environ["E11_OUT"] = OUT
sys.path.insert(0, HERE)
import e11_listener_path as E                            # read-only reuse: the harness (its folder is OUT: imported first)
import row041_relay as R                                 # read-only reuse: the relay as the door starts it, the camera start
import rtsp_test_camera as CAM                           # read-only: the synthetic account constants, the hostile constants
H = E.H

SECOND_PORT = 8568                                       # decision C33: the test camera binds 8565-8574
INGEST = "rtsp://127.0.0.1:8559/S-ROW152/video-01/Zr152HostileRunElem9x"   # nothing listens there in these runs
CODES = dict(R.CODES, CAMERA_PROTOCOL=21, DESCRIPTION_INVALID=27, CODEC_NOT_SUPPORTED=28, INGEST_REFUSED=40)
NAME_OF = {number: name for name, number in CODES.items()}
CODECS = (("h264", "sdp"), ("hevc", "inband"))


def run(name, kind, codec, sets, switches, expect, second=True, observation=False):
    """One relay against one camera. `expect`: the exit codes that are a refusal of this case."""
    d = os.path.join(OUT, "runs", name)
    os.makedirs(d, exist_ok=True)
    extra = (["--second-port", str(SECOND_PORT)] if second else []) + list(switches)
    cam, log, path = R.camera_start(d, codec, sets, frames=50, extra=extra)
    locator = "rtsp://127.0.0.1:%d%s" % (R.CAMERA_PORT, path)
    user, secret = CAM.ACCOUNT_USER, CAM.ACCOUNT_PASSWORD
    try:
        relay = R.Relay(d, R.start_message(INGEST, locator, user, secret))
        rc = relay.wait(25)
        relay.close_input()
    finally:
        camera = R.camera_end(cam, log)
    lines = relay.lines()
    exit_line = next((l for l in lines if l.get("relay") == "exit"), {})
    counters = camera["counters"]
    methods = [m for m, _, _ in camera["requests"]]
    texts = dict(R.texts_of(INGEST, locator, user, secret), markup=CAM.HOSTILE_CODEC_MARKUP, script="<script>", other_host=CAM.OTHER_HOST,
                 second_locator="127.0.0.1:%d" % SECOND_PORT, long_name=CAM.hostile_codec_name(CAM.Codec(codec).rtp_name)[-40:])
    found = R.occurrences(texts, relay.out, relay.err)
    longest = max([len(l) for l in relay.err.decode("utf-8", "replace").splitlines()] + [0])
    r = {"run": name, "case": kind, "codec": codec, "param_sets": sets, "camera_switches": " ".join(extra), "relay_rc": rc, "relay_code": exit_line.get("code"),
         "seconds": relay.took, "stdout_bytes": len(relay.out), "stderr_lines": len(lines), "longest_stderr_line": longest, "texts_in_relay_output": found,
         "camera_requests": camera["requests"], "camera_counters": counters, "camera_rc": camera["rc"], "leftovers": len(H.leftovers()["processes"])}
    refused = rc in [CODES[c] for c in expect] and exit_line.get("code") in expect
    crit = {"every_line_is_fixed_shape": all("not_json" not in l for l in lines), "no_text_of_the_message_or_of_the_camera_in_the_output": sum(found.values()) == 0,
            "relay_ended_inside_the_wait": rc != "timeout", "camera_ended_cleanly": camera["rc"] == 0 and counters.get("errors", 0) == 0, "no_leftover": r["leftovers"] == 0}
    if kind == "plain":
        crit["relay_got_past_the_description"] = "SETUP" in methods
        crit["relay_ended_at_the_ingest_or_the_camera_end"] = exit_line.get("code") in ("INGEST_REFUSED", "INGEST_LOST", "CAMERA_LOST")
    else:
        hostile = {"second_port_connections_0": counters.get("second_port_connections", 0) == 0, "no_setup_reached_the_camera": "SETUP" not in methods,
                   "no_play_reached_the_camera": "PLAY" not in methods, "no_stream_started": counters.get("streams_started", 0) == 0}
        if not observation:
            hostile["relay_exit_is_a_named_refusal_of_the_case"] = refused
            crit.update(hostile)
        else:
            r["observation"] = dict(hostile, refused_by_name=refused)
        if kind == "redirect":
            crit["the_camera_sent_the_redirect"] = counters.get("redirects_sent", 0) >= 1
            crit["digest_answers_the_camera_received"] = counters.get("auth_digest_ok", 0) == (0 if "first" in switches else 1)
        if kind == "control":
            crit["the_camera_sent_the_foreign_description"] = counters.get("foreign_control_descriptions", 0) >= 1
        if kind == "codec" and not observation:
            crit["the_camera_sent_the_hostile_description"] = counters.get("hostile_codec_descriptions", 0) >= 1
            crit["no_line_of_the_relay_is_longer_than_300"] = longest < CAM.HOSTILE_CODEC_LENGTH
    r["criteria"] = crit
    # A hostile case the relay did not refuse is a FINDING, not a failure of this harness.
    not_refused = kind != "plain" and not observation and not all(crit.get(k, True) for k in ("relay_exit_is_a_named_refusal_of_the_case", "second_port_connections_0", "no_setup_reached_the_camera", "no_play_reached_the_camera", "no_stream_started"))
    r["verdict"] = "FINDING" if not_refused else ("PASS" if all(crit.values()) else "FAIL")
    json.dump(r, open(os.path.join(d, "result.json"), "w"), indent=1, default=str)
    return r


def todo(what):
    out = []
    for codec, sets in CODECS:
        tag = "%s_%s" % (codec, sets)
        if what in ("plain", "all"):
            out.append(lambda c=codec, s=sets, t=tag: run("plain_control_" + t, "plain", c, s, [], [], second=False))
        if what in ("redirect", "all"):
            out.append(lambda c=codec, s=sets, t=tag: run("redirect_first_" + t, "redirect", c, s, ["--redirect", "first"], ["REDIRECT_REFUSED"]))
            out.append(lambda c=codec, s=sets, t=tag: run("redirect_authenticated_" + t, "redirect", c, s, ["--redirect", "authenticated"], ["REDIRECT_REFUSED"]))
        if what in ("control", "all"):
            out.append(lambda c=codec, s=sets, t=tag: run("control_other_port_" + t, "control", c, s, ["--sdp-control", "other-port"], ["CONTROL_ADDRESS_REFUSED"]))
            out.append(lambda c=codec, s=sets, t=tag: run("control_other_host_" + t, "control", c, s, ["--sdp-control", "other-host"], ["CONTROL_ADDRESS_REFUSED"], second=False))
        if what in ("codec", "all"):
            out.append(lambda c=codec, s=sets, t=tag: run("codec_hostile_300_" + t, "codec", c, s, ["--sdp-codec", "hostile"], ["CODEC_NOT_SUPPORTED", "DESCRIPTION_INVALID", "CAMERA_PROTOCOL"], second=False))
            out.append(lambda c=codec, s=sets, t=tag: run("codec_lower_case_" + t, "codec", c, s, ["--sdp-codec", "lower"], ["CODEC_NOT_SUPPORTED", "DESCRIPTION_INVALID"], second=False, observation=True))
    return out


def line(r):
    failed = "" if r["verdict"] == "PASS" else " not held: %s" % sorted(k for k, v in r["criteria"].items() if not v)
    c = r["camera_counters"]
    return "%-40s relay rc=%s code=%s in %ss stdout=%d | camera requests=%s second_port=%s redirects=%s streams=%s | texts=%d leftover=%d | %s%s" % (
        r["run"], r["relay_rc"], r["relay_code"], r["seconds"], r["stdout_bytes"], ",".join(m for m, _, _ in r["camera_requests"]) or "-",
        c.get("second_port_connections", 0), c.get("redirects_sent", 0), c.get("streams_started", 0), sum(r["texts_in_relay_output"].values()), r["leftovers"], r["verdict"], failed)


def summary():
    root, rows = os.path.join(OUT, "runs"), []
    for n in sorted(os.listdir(root)) if os.path.isdir(root) else []:
        p = os.path.join(root, n, "result.json")
        if os.path.exists(p):
            rows.append(json.load(open(p)))
    rows = [r for r in rows if "verdict" in r]
    lines = [line(r) for r in rows]
    count = lambda verdict: sum(r["verdict"] == verdict for r in rows)
    tail = "ROW152 HOSTILE RELAY: %d run(s), %d PASS, %d FINDING, %d FAIL" % (len(rows), count("PASS"), count("FINDING"), count("FAIL"))
    open(os.path.join(OUT, "summary.txt"), "w").write("\n".join(lines + [tail]) + "\n")
    print("\n".join(lines + [tail]))
    return all(r["verdict"] == "PASS" for r in rows) and bool(rows)


def main(argv):
    what = argv[0] if argv else "summary"
    if not os.path.exists(R.RELAY):
        sys.exit("no relay binary in build/: this script does not build one")
    runs = todo(what)
    if not runs and what != "summary":
        sys.exit("usage: row152_hostile_relay.py all | redirect | control | codec | plain | summary")
    for f in runs:
        print(line(f()), flush=True)
        time.sleep(0.5)
    if runs:
        print("---- summary of every recorded run", flush=True)
    sys.exit(0 if summary() else 1)


if __name__ == "__main__":
    main(sys.argv[1:])
