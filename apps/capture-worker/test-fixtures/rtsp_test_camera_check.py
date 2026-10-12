#!/usr/bin/env python3
"""The reference-client check of the test camera (task 4 blueprint row 39, its verification cell).

For each of the four base modes (h264 / hevc times sdp / inband), `--runs` times, against a fresh camera:
  a  an unauthenticated DESCRIBE gets 401 with a Digest challenge and no Basic one (own RTSP client);
  b  a DESCRIBE with a wrong password gets 401 with a Digest challenge (own client), and `ffprobe` with
     the wrong password ends with an error and reads no stream;
  c  the description states the codec and carries the parameter sets exactly when the mode says so;
  d  the stream holds parameter-set units exactly when the mode says so (own client: 30 pictures read
     over the RTSP connection, unit types counted from the RTP payloads);
  e  `ffprobe -rtsp_transport tcp -count_frames` with the right account reads the stated codec, picture
     size and rate, exactly the pictures the camera was told to send, with 0 error lines;
  f  while it runs the camera listens on 127.0.0.1:<port> and nowhere else; after it nothing listens.
Once: the ports the camera must refuse are refused before any socket (exit code 2, nothing listening),
and there is no option that names another address.

Run from the repository root, command sandbox off, under the heavy-host lock:
    /usr/bin/lockf -k -t 1800 .locks/heavy-host.lock \
      python3 apps/capture-worker/test-fixtures/rtsp_test_camera_check.py --port 8565
Results and logs: .cache/rtsp-test-camera/check/<stamp>/ (git-ignored). The account of the camera is
replaced by a mark in everything this script writes or prints. Exit 0 only when every check holds.
"""
import argparse
import hashlib
import json
import os
import re
import shutil
import signal
import socket
import struct
import subprocess
import sys
import time

sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import rtsp_test_camera as cam  # noqa: E402  (the account constants and the port rule live there)

CAMERA = os.path.join(HERE, "rtsp_test_camera.py")
FFPROBE = os.environ.get("DEMS_FFPROBE") or shutil.which("ffprobe") or "/opt/homebrew/bin/ffprobe"
MODES = [("h264", "sdp"), ("h264", "inband"), ("hevc", "sdp"), ("hevc", "inband")]
WRONG_PASSWORD = "not-the-password"


def redact(text):
    """The account leaves every text this check keeps: the whole user part of a locator, then each value on its own."""
    text = re.sub(r"(rtsps?://)[^\s/@]*@", r"\1<account>@", text)
    return text.replace(cam.ACCOUNT_PASSWORD, "<password>").replace(WRONG_PASSWORD, "<wrong>").replace(cam.ACCOUNT_USER + ":", "<account>:")


def locator(port, path, password):
    return "rtsp://" + cam.ACCOUNT_USER + ":" + password + "@" + "127.0.0.1:%d%s" % (port, path)


def listeners_of(pid):
    out = subprocess.run(["lsof", "-nP", "-a", "-p", str(pid), "-i"], capture_output=True, text=True).stdout
    return sorted(line.split()[-2] + " " + line.split()[-1] for line in out.splitlines()[1:] if "(LISTEN)" in line or "UDP" in line)


def listening_on(port):
    out = subprocess.run(["lsof", "-nP", "-iTCP:%d" % port, "-sTCP:LISTEN"], capture_output=True, text=True).stdout
    return [line.split()[0] + " " + line.split()[1] for line in out.splitlines()[1:]]


class Client:
    """A small RTSP client of this check (not libavformat): it shows what the camera really answers."""

    def __init__(self, port, path):
        self.sock = socket.create_connection(("127.0.0.1", port), timeout=10)
        self.uri = "rtsp://127.0.0.1:%d%s" % (port, path)
        self.cseq, self.buffer, self.session = 0, b"", None

    def close(self):
        self.sock.close()

    def more(self):
        data = self.sock.recv(65536)
        if not data:
            raise EOFError("the camera closed the connection")
        self.buffer += data

    def ask(self, method, uri=None, extra=(), password=None, challenge=None):
        uri = uri or self.uri
        self.cseq += 1
        lines = ["%s %s RTSP/1.0" % (method, uri), "CSeq: %d" % self.cseq, "User-Agent: dems-row39-check"] + list(extra)
        if self.session:
            lines.append("Session: " + self.session)
        if password is not None:
            md5 = lambda text: hashlib.md5(text.encode()).hexdigest()
            response = md5("%s:%s:%s" % (md5("%s:%s:%s" % (cam.ACCOUNT_USER, challenge["realm"], password)), challenge["nonce"],
                                         md5("%s:%s" % (method, uri))))
            lines.append('Authorization: Digest username="%s", realm="%s", nonce="%s", uri="%s", response="%s"' % (
                cam.ACCOUNT_USER, challenge["realm"], challenge["nonce"], uri, response))
        self.sock.sendall(("\r\n".join(lines) + "\r\n\r\n").encode())
        while True:  # packets may precede an answer once the stream runs
            while len(self.buffer) < 4:
                self.more()
            if self.buffer[0] != 0x24:
                break
            size = struct.unpack(">H", self.buffer[2:4])[0]
            while len(self.buffer) < 4 + size:
                self.more()
            self.buffer = self.buffer[4 + size:]
        while b"\r\n\r\n" not in self.buffer:
            self.more()
        head, self.buffer = self.buffer.split(b"\r\n\r\n", 1)
        lines = head.decode("latin-1").split("\r\n")
        headers = {}
        for line in lines[1:]:
            name, _, value = line.partition(":")
            headers.setdefault(name.strip().lower(), []).append(value.strip())
        length = int(headers.get("content-length", ["0"])[0])
        while len(self.buffer) < length:
            self.more()
        body, self.buffer = self.buffer[:length].decode("latin-1"), self.buffer[length:]
        if "session" in headers:
            self.session = headers["session"][0].split(";")[0]
        return int(lines[0].split(" ")[1]), headers, body

    def packets(self, pictures):
        """RTP payloads of channel 0 until `pictures` marker bits were seen."""
        out, seen = [], 0
        while seen < pictures:
            while len(self.buffer) < 4:
                self.more()
            if self.buffer[0] != 0x24:
                raise ValueError("no interleaved frame where one was expected")
            channel, size = self.buffer[1], struct.unpack(">H", self.buffer[2:4])[0]
            while len(self.buffer) < 4 + size:
                self.more()
            packet, self.buffer = self.buffer[4:4 + size], self.buffer[4 + size:]
            if channel == 0:
                out.append(packet[12:])
                seen += 1 if packet[1] & 0x80 else 0
        return out


def challenge_of(headers):
    """What the 401 offers: the schemes, and realm and nonce of the Digest one."""
    offers = headers.get("www-authenticate", [])
    schemes = sorted({o.split(" ", 1)[0].lower() for o in offers})
    digest = next((o for o in offers if o.lower().startswith("digest ")), "")
    fields = dict(re.findall(r'(\w+)="([^"]*)"', digest))
    return schemes, fields


def unit_types(codec, payloads):
    """NAL unit types in the stream, counted once per unit (a fragmented unit by its first fragment)."""
    counts = {}
    for p in payloads:
        if codec == "h264":
            t = p[0] & 0x1F
            if t == 28:
                if not p[1] & 0x80:
                    continue
                t = p[1] & 0x1F
        else:
            t = (p[0] >> 1) & 0x3F
            if t == 49:
                if not p[2] & 0x80:
                    continue
                t = p[2] & 0x3F
        counts[t] = counts.get(t, 0) + 1
    return counts


def start_camera(port, codec, sets, frames, size, log):
    width, height = size
    proc = subprocess.Popen(
        [sys.executable, "-B", CAMERA, "--port", str(port), "--codec", codec, "--param-sets", sets, "--frames", str(frames),
         "--width", str(width), "--height", str(height), "--max-seconds", "120", "--exit-on-stdin-eof", "--event-log", log],
        stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    line = proc.stdout.readline()
    ready = json.loads(line) if line.strip() else {}
    if ready.get("event") != "ready":
        proc.kill()
        raise RuntimeError("the camera did not become ready: rc %s, %s" % (proc.wait(), redact(proc.stderr.read()[-300:])))
    return proc, ready


def stop_camera(proc):
    proc.send_signal(signal.SIGTERM)
    try:
        out, _ = proc.communicate(timeout=15)
    except subprocess.TimeoutExpired:
        proc.kill()
        out, _ = proc.communicate()
    events = [json.loads(l) for l in out.splitlines() if l.strip().startswith("{")]
    return proc.returncode, next((e for e in events if e["event"] == "exit"), {}).get("counters", {})


def one_run(port, codec, sets, frames, size, folder):
    set_types = (7, 8) if codec == "h264" else (32, 33, 34)
    key_types = (5,) if codec == "h264" else tuple(range(16, 22))
    checks, facts = {}, {}
    proc, ready = start_camera(port, codec, sets, frames, size, os.path.join(folder, "camera_events.jsonl"))
    try:
        path = ready["path"]
        facts["listeners_while_running"] = listeners_of(proc.pid)
        checks["f_listens_on_loopback_port_only"] = facts["listeners_while_running"] == ["127.0.0.1:%d (LISTEN)" % port]

        # a  no account
        client = Client(port, path)
        status, _, _ = client.ask("OPTIONS")
        checks["options_answers_200"] = status == 200
        status, headers, _ = client.ask("DESCRIBE", extra=["Accept: application/sdp"])
        schemes, fields = challenge_of(headers)
        facts["unauthenticated"] = {"status": status, "schemes_offered": schemes, "realm": fields.get("realm"), "nonce_length": len(fields.get("nonce", ""))}
        checks["a_unauthenticated_gets_digest_challenge"] = status == 401 and schemes == ["digest"] and bool(fields.get("nonce"))
        # b  wrong password, own client
        status, headers, _ = client.ask("DESCRIBE", extra=["Accept: application/sdp"], password=WRONG_PASSWORD, challenge=fields)
        schemes2, fields2 = challenge_of(headers)
        facts["wrong_password"] = {"status": status, "schemes_offered": schemes2, "new_nonce": fields2.get("nonce") != fields.get("nonce")}
        checks["b_wrong_password_gets_digest_challenge"] = status == 401 and schemes2 == ["digest"] and bool(fields2.get("nonce"))
        # c  right password: the description
        status, headers, sdp = client.ask("DESCRIBE", extra=["Accept: application/sdp"], password=cam.ACCOUNT_PASSWORD, challenge=fields2)
        rtpmap = re.search(r"a=rtpmap:96 (\S+)", sdp)
        sprops = sorted(set(re.findall(r"(sprop-[a-z-]+)=", sdp)))
        want = [] if sets == "inband" else (["sprop-parameter-sets"] if codec == "h264" else ["sprop-pps", "sprop-sps", "sprop-vps"])
        facts["description"] = {"status": status, "rtpmap": rtpmap.group(1) if rtpmap else None, "sprop_fields": sprops,
                                "has_fmtp": "a=fmtp:" in sdp, "bytes": len(sdp)}
        checks["c_description_states_codec"] = status == 200 and bool(rtpmap) and rtpmap.group(1) == ("H264/90000" if codec == "h264" else "H265/90000")
        checks["c_description_parameter_sets_as_mode"] = sprops == want
        # d  the stream itself
        base = headers.get("content-base", [client.uri + "/"])[0]
        status_udp, _, _ = client.ask("SETUP", uri=base + "trackID=0", extra=["Transport: RTP/AVP;unicast;client_port=50000-50001"],
                                      password=cam.ACCOUNT_PASSWORD, challenge=fields2)
        checks["udp_transport_refused_461"] = status_udp == 461
        status, _, _ = client.ask("SETUP", uri=base + "trackID=0", extra=["Transport: RTP/AVP/TCP;unicast;interleaved=0-1"],
                                  password=cam.ACCOUNT_PASSWORD, challenge=fields2)
        status_play, _, _ = client.ask("PLAY", uri=base, extra=["Range: npt=0.000-"], password=cam.ACCOUNT_PASSWORD, challenge=fields2)
        counts = unit_types(codec, client.packets(30)) if status == 200 and status_play == 200 else {}
        client.ask("TEARDOWN", uri=base, password=cam.ACCOUNT_PASSWORD, challenge=fields2)
        client.close()
        keyframes = sum(counts.get(t, 0) for t in key_types)
        facts["stream_30_pictures"] = {"setup": status, "play": status_play, "keyframe_units": keyframes,
                                       "parameter_set_units": {str(t): counts.get(t, 0) for t in set_types},
                                       "unit_types": {str(t): n for t, n in sorted(counts.items())}}
        if sets == "inband":
            checks["d_stream_parameter_sets_as_mode"] = keyframes >= 2 and all(counts.get(t, 0) >= 2 for t in set_types)
        else:
            checks["d_stream_parameter_sets_as_mode"] = keyframes >= 2 and all(counts.get(t, 0) == 0 for t in set_types)

        # b  wrong password, reference client
        bad = subprocess.run([FFPROBE, "-v", "error", "-rtsp_transport", "tcp", "-show_entries", "stream=codec_name", "-of", "json",
                              locator(port, path, WRONG_PASSWORD)], stdin=subprocess.DEVNULL, capture_output=True, text=True, timeout=60)
        facts["ffprobe_wrong_password"] = {"rc": bad.returncode, "says_401": "401" in bad.stderr, "streams": len((json.loads(bad.stdout or "{}")).get("streams", []))}
        checks["b_ffprobe_wrong_password_refused"] = bad.returncode != 0 and "401" in bad.stderr and facts["ffprobe_wrong_password"]["streams"] == 0
        # e  right account, reference client: every picture decoded
        good = subprocess.run([FFPROBE, "-v", "error", "-rtsp_transport", "tcp", "-count_frames", "-select_streams", "v:0",
                               "-show_entries", "stream=codec_name,profile,width,height,pix_fmt,r_frame_rate,nb_read_frames", "-of", "json",
                               locator(port, path, cam.ACCOUNT_PASSWORD)], stdin=subprocess.DEVNULL, capture_output=True, text=True, timeout=180)
        with open(os.path.join(folder, "ffprobe_stderr.txt"), "w") as handle:
            handle.write(redact(bad.stderr) + "\n---- right account ----\n" + redact(good.stderr))
        stream = (json.loads(good.stdout or "{}").get("streams") or [{}])[0]
        errors = [l for l in good.stderr.splitlines() if l.strip()]
        facts["ffprobe"] = {"rc": good.returncode, "stream": stream, "error_lines": len(errors)}
        checks["e_codec"] = stream.get("codec_name") == codec
        checks["e_picture_size"] = (stream.get("width"), stream.get("height")) == size
        checks["e_rate_25"] = stream.get("r_frame_rate") == "25/1"
        checks["e_frames_as_sent"] = stream.get("nb_read_frames") == str(frames)
        checks["e_zero_error_lines"] = good.returncode == 0 and len(errors) == 0
    finally:
        rc, counters = stop_camera(proc)
    facts["camera"] = {"rc": rc, "counters": counters}
    checks["camera_ended_cleanly"] = rc == 0 and counters.get("errors", 0) == 0
    checks["camera_saw_no_basic_request"] = counters.get("auth_basic", 0) == 0
    facts["listening_after"] = listening_on(port)
    checks["f_no_listener_left"] = facts["listening_after"] == []
    return checks, facts


def refusals(folder):
    """The bind rule, without a socket: refused ports end with code 2 and nothing listens."""
    rows = []
    for port in (8554, 8556, 8558, 8559, 8561, 8564, 4400, 4432, 5173, 8081, 80):
        done = subprocess.run([sys.executable, "-B", CAMERA, "--port", str(port), "--cache", folder], stdin=subprocess.DEVNULL,
                              capture_output=True, text=True, timeout=30)
        rows.append({"port": port, "rc": done.returncode, "said_refused": "REFUSED" in done.stderr, "stdout_bytes": len(done.stdout)})
    other = subprocess.run([sys.executable, "-B", CAMERA, "--port", "0", "--host", "0.0.0.0"], stdin=subprocess.DEVNULL, capture_output=True, text=True, timeout=30)
    source = open(CAMERA, encoding="utf-8").read()
    return {
        "ports": rows,
        "every_refused_port_rc_2": all(r["rc"] == 2 and r["said_refused"] and r["stdout_bytes"] == 0 for r in rows),
        "no_address_option": other.returncode == 2 and "unrecognized arguments" in other.stderr,
        "bind_calls_in_source": len(re.findall(r"\.bind\(", source)),
        "datagram_sockets_in_source": source.count("SOCK_DGRAM"),
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8565)
    parser.add_argument("--runs", type=int, default=3)
    parser.add_argument("--frames", type=int, default=125)
    parser.add_argument("--size", default="1920x1080")
    parser.add_argument("--out", default=os.path.join(cam.DEFAULT_CACHE, "check", time.strftime("%Y%m%dT%H%M%SZ", time.gmtime())))
    args = parser.parse_args()
    if cam.port_refusal(args.port) or args.port == 0:
        sys.exit("the check needs a port the camera accepts")
    size = tuple(int(v) for v in args.size.split("x"))
    os.makedirs(args.out, exist_ok=True)
    if listening_on(args.port):
        sys.exit("port %d is in use: nothing was started" % args.port)

    result = {"started": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "port": args.port, "frames": args.frames, "size": args.size,
              "refusals": refusals(args.out), "runs": []}
    rule = result["refusals"]
    ok = rule["every_refused_port_rc_2"] and rule["no_address_option"] and rule["bind_calls_in_source"] == 1 and rule["datagram_sockets_in_source"] == 0
    print("BIND RULE refused_ports=%d all_rc_2=%s no_address_option=%s bind_calls=%d datagram_sockets=%d" % (
        len(rule["ports"]), rule["every_refused_port_rc_2"], rule["no_address_option"], rule["bind_calls_in_source"], rule["datagram_sockets_in_source"]))
    for codec, sets in MODES:
        for run in range(1, args.runs + 1):
            folder = os.path.join(args.out, "%s_%s_run%d" % (codec, sets, run))
            os.makedirs(folder, exist_ok=True)
            try:
                checks, facts = one_run(args.port, codec, sets, args.frames, size, folder)
            except Exception as exc:  # the run is a failure with its place; the series goes on
                checks, facts = {"run_completed": False}, {"error_type": type(exc).__name__, "error": redact(str(exc))[:300]}
            failed = sorted(name for name, good in checks.items() if not good)
            ok = ok and not failed
            result["runs"].append({"codec": codec, "param_sets": sets, "run": run, "pass": not failed, "failed": failed, "checks": checks, "facts": facts})
            probe = facts.get("ffprobe", {}).get("stream", {})
            print("%s %-4s %-6s run %d  ffprobe %s %sx%s %s frames %s/%d errors %s  sdp %s  stream sets %s  401 %s/%s  %s" % (
                "PASS" if not failed else "FAIL", codec, sets, run, probe.get("codec_name"), probe.get("width"), probe.get("height"),
                probe.get("r_frame_rate"), probe.get("nb_read_frames"), args.frames, facts.get("ffprobe", {}).get("error_lines"),
                ",".join(facts.get("description", {}).get("sprop_fields", [])) or "none",
                facts.get("stream_30_pictures", {}).get("parameter_set_units"),
                facts.get("unauthenticated", {}).get("schemes_offered"), facts.get("wrong_password", {}).get("schemes_offered"),
                "" if not failed else "failed: " + ",".join(failed)))
            sys.stdout.flush()
    result["listening_at_end"] = listening_on(args.port)
    result["pass"] = ok and result["listening_at_end"] == []
    with open(os.path.join(args.out, "result.json"), "w") as handle:
        handle.write(redact(json.dumps(result, indent=1)))
    print("RESULT %s  runs %d  passed %d  listener_left %s  %s" % (
        "PASS" if result["pass"] else "FAIL", len(result["runs"]), sum(1 for r in result["runs"] if r["pass"]), result["listening_at_end"],
        os.path.relpath(os.path.join(args.out, "result.json"), cam.REPO_ROOT)))
    return 0 if result["pass"] else 1


if __name__ == "__main__":
    sys.exit(main())
