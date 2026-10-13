#!/usr/bin/env python3
"""
ROW 46, T-2: THE LISTENER SIDE of the production camera adapter's adapter-level test (task 4 blueprint row 46;
design addendum 6.3: "T-2 adapter level: the real relay, the real release worker driven by its own harness").

WHAT IT IS. ONE session of the release worker, started by the worker's own harness (e11_listener_path.py and
test/m3worker.py, imported READ-ONLY, as row041_relay.py does): two camera listeners, two FIFO microphones.
Camera 1 is NOT pushed by this script. Whoever started this script - the Core's test
apps/core-server/src/modules/capture-config/__tests__/camera-adapter-open.db.test.ts - opens it through the
production camera adapter, which starts the real relay. Camera 2 is the FFmpeg control pusher of the harness: the control
that the worker of this run takes a push at all.

WHY A SCRIPT OF ITS OWN. The harness is Python and the adapter is the Core's; this file is the seam between
them and nothing else. It starts no relay and no camera, and it holds no account.

THE DIALOGUE, one JSON line each way (standard input and output; standard error is not used):
  out  {"event":"listening","ingest":"<address of camera 1>","port":<n>}   the worker listens; the address is the
                                                                              one of the plan, built by the harness
  in   {"cmd":"wait_connected","timeout":<seconds>}                         did the worker report camera 1?
  out  {"event":"connected","ok":true|false}
  in   {"cmd":"finish"}                                                       end the session and judge it
  out  {"event":"result", ...}                                                counts only (below)
The ingest address leaves this process on its standard output only (a pipe to the test): it is no argument, no
environment variable and no file of this script. The run folder holds the worker's log; the control pusher's
own trace log (it holds the control's address) is removed at the end, as row041_relay.py does.

THE RESULT holds numbers and codec words, never an address: whether the worker reported camera 1 connected and
how often, the codec word it stated, the file's codec, picture size, picture count and decode-error lines, the
worker's refusals of an announce (its gate), how often any element of the two ingest paths stands in what the
worker wrote, leftover processes and listeners, the worker's exit code, and whether the control was recorded.

Run by the test, under the heavy-host lock, loopback only, command sandbox off:
  M3_PORTS=8559,8561 E11_OUT=<repository>/.cache/row046-camera-adapter python3 -B row046_adapter_listener.py <name>
"""
import json, os, secrets, sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
os.environ.setdefault("M3_PORTS", "8559,8561")
os.environ.setdefault("E11_OUT", os.path.join(REPO, ".cache", "row046-camera-adapter"))
sys.path.insert(0, HERE)
import e11_listener_path as E                            # read-only reuse: the worker session, the control pusher
import row041_relay as R                                 # read-only reuse: the decode check

H = E.H
FRAMES = 150                                             # the control's length; the test camera is the test's


def say(**line):
    sys.stdout.write(json.dumps(line) + "\n")
    sys.stdout.flush()


def ask():
    raw = sys.stdin.readline()
    if not raw:
        return {"cmd": "finish", "input_ended": True}
    try:
        return json.loads(raw)
    except ValueError:
        return {"cmd": "unknown"}


def main(argv):
    if len(argv) != 2 or not argv[1].replace("_", "").isalnum():
        sys.exit("usage: row046_adapter_listener.py <run name of letters, digits and underscores>")
    name = argv[1]
    session_word = "SES-20261013-%s" % name.upper().replace("_", "-")[:24]
    E.RIGHT = tuple("%s/video-0%d/%s" % (session_word, i + 1, secrets.token_urlsafe(16)) for i in range(2))
    port, cport = H.PORTS
    ingest = E.url(port, E.RIGHT[0])

    def script(ctx):
        d = ctx["d"]
        control = E.Push(d, "control", cport, E.RIGHT[1], ctx["t0"], frames=FRAMES)
        say(event="listening", ingest=ingest, port=port)
        while True:
            line = ask()
            if line.get("cmd") == "wait_connected":
                say(event="connected", ok=bool(E.wait_connected(d, port, float(line.get("timeout", 10)))))
            elif line.get("cmd") == "finish":
                break
        control.wait()
        return {"observation": "ROW46", "port_under_test": port, "paths_used": list(E.RIGHT),
                "control": {"port": cport, "path": "", "rc": control.rc, "rtsp_error_statuses": []}}

    r = E.session(name, script)
    d = os.path.join(E.OUT, "runs", name)
    trace = os.path.join(d, "control.log")
    if os.path.exists(trace):
        os.remove(trace)
    log = H.worker_log(d)
    f1, f2 = r["files"][str(port)], r["files"][str(cport)]
    video = f1.get("video") if isinstance(f1.get("video"), dict) else {}
    connected = [c for c in r["worker_ingest_connected"] if c["port"] == port]
    path1 = os.path.join(d, "media", "VIDEO-01.mp4")
    elements = [e for p in E.RIGHT for e in (p, p.rsplit("/", 1)[1])]
    written = open(os.path.join(d, "worker.jsonl"), errors="replace").read()
    result = {
        "event": "result",
        "ingest_connected": len(connected),
        "worker_codec": connected[0]["codec"] if connected else None,
        "file_bytes": f1["bytes"],
        "file_codec": video.get("codec_name"),
        "file_frames": int(video.get("nb_read_frames") or 0),
        "file_size": "%sx%s" % (video.get("width"), video.get("height")),
        "decode_error_lines": R.decode_errors(path1) if f1["bytes"] else None,
        "gate_refusals": sum(1 for l in log if str(l.get("message", "")).startswith("INGEST_ANNOUNCE")),
        "ingest_elements_in_worker_output": sum(written.count(e) for e in elements) + sum(r.get("path_text_in_worker_output", {}).values()),
        "control_recorded": f2["bytes"] > 0 and sum(1 for c in r["worker_ingest_connected"] if c["port"] == cport) == 1,
        "worker_rc": r.get("worker_rc"),
        "leftovers": len(r["leftovers"]["processes"]) + len(r["leftovers"]["listeners"]),
        "run_folder": os.path.relpath(d, REPO),
    }
    # The facts file of the harness names the two paths of the run: it is not kept.
    kept = os.path.join(d, "result.json")
    if os.path.exists(kept):
        os.remove(kept)
    say(**result)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
