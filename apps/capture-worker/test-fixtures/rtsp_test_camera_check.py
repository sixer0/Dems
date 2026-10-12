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

`--suite faults` (row 40; the base suite above stays the default) checks the camera's fault switches
instead, `--runs` times each, on h264 with the sets in the description and on hevc with the sets in band:
  basic        `--challenge basic`: a 401 offers Basic and nothing else, also to a Digest answer made with
               the right password; nothing is granted; a Basic request is COUNTED (own client with a value
               that is not the account, then `ffprobe` with the account) and no value is in the event log;
  both         `--challenge both`: Basic and Digest are offered, Digest is granted, a Basic request is not;
  delay_inter  `--first-keyframe-delay-ms`: before the delay only pictures that are no keyframes and no
  delay_none   parameter set (or nothing at all), and what came does not decode; then the full stream;
  drop_fin     `--drop-after-frames`: the connection ends after exactly that many pictures, inside a group;
  drop_reset   a new connection is served from the very next picture of the clip (compared byte for byte),
               which is not a keyframe; `ffprobe` reads both connections;
  special      `--account special`: Digest with the account that holds @ : / % and a space (own client, and
               `ffprobe` with the percent-encoded locator); the plain account is refused.
"""
import argparse
import base64
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
import urllib.parse

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
    for value in (cam.SPECIAL_ACCOUNT_PASSWORD, cam.SPECIAL_ACCOUNT_USER):  # row 40: the second account, plain and escaped
        text = text.replace(value, "<special>").replace(urllib.parse.quote(value, safe=""), "<special>")
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

    def ask(self, method, uri=None, extra=(), password=None, challenge=None, user=None):
        uri = uri or self.uri
        user = cam.ACCOUNT_USER if user is None else user
        self.cseq += 1
        lines = ["%s %s RTSP/1.0" % (method, uri), "CSeq: %d" % self.cseq, "User-Agent: dems-row39-check"] + list(extra)
        if self.session:
            lines.append("Session: " + self.session)
        if password is not None:
            md5 = lambda text: hashlib.md5(text.encode()).hexdigest()
            response = md5("%s:%s:%s" % (md5("%s:%s:%s" % (user, challenge["realm"], password)), challenge["nonce"],
                                         md5("%s:%s" % (method, uri))))
            lines.append('Authorization: Digest username="%s", realm="%s", nonce="%s", uri="%s", response="%s"' % (
                user, challenge["realm"], challenge["nonce"], uri, response))
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

    def pictures(self, codec, limit=0):
        """Whole pictures of channel 0, each `(arrival, [NAL units])` with fragments joined, until `limit` of them
        (0: until the connection ends). Returns them and how the connection ended: None, `fin`, `reset`, `timeout`."""
        out, nals, ended = [], [], None
        while not limit or len(out) < limit:
            try:
                while len(self.buffer) < 4:
                    self.more()
                if self.buffer[0] != 0x24:
                    raise ValueError("no interleaved frame where one was expected")
                channel, size = self.buffer[1], struct.unpack(">H", self.buffer[2:4])[0]
                while len(self.buffer) < 4 + size:
                    self.more()
            except EOFError:
                ended = "fin"
                break
            except ConnectionResetError:
                ended = "reset"
                break
            except socket.timeout:
                ended = "timeout"
                break
            packet, self.buffer = self.buffer[4:4 + size], self.buffer[4 + size:]
            if channel != 0:
                continue
            p = packet[12:]
            if codec == "h264" and p[0] & 0x1F == 28:
                if p[1] & 0x80:
                    nals.append(bytearray([(p[0] & 0xE0) | (p[1] & 0x1F)]))
                nals[-1] += p[2:]
            elif codec != "h264" and (p[0] >> 1) & 0x3F == 49:
                if p[2] & 0x80:
                    nals.append(bytearray([(p[0] & 0x81) | ((p[2] & 0x3F) << 1), p[1]]))
                nals[-1] += p[3:]
            else:
                nals.append(bytearray(p))
            if packet[1] & 0x80:
                out.append((time.monotonic(), [bytes(n) for n in nals]))
                nals = []
        return out, ended


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


def start_camera(port, codec, sets, frames, size, log, switches=()):
    width, height = size
    proc = subprocess.Popen(
        [sys.executable, "-B", CAMERA, "--port", str(port), "--codec", codec, "--param-sets", sets, "--frames", str(frames),
         "--width", str(width), "--height", str(height), "--max-seconds", "120", "--exit-on-stdin-eof", "--event-log", log] + list(switches),
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


# ---------------------------------------------------------------------------------------------------------------------
# Row 40: the fault switches (`--suite faults`).

FAULT_MODES = ("basic", "both", "delay_inter", "delay_none", "drop_fin", "drop_reset", "special")
FAULT_CODECS = [("h264", "sdp"), ("hevc", "inband")]
DELAY_MS, DROP_AFTER, GOP = 2000, 37, 25
PROBE_VALUE = "probe-user:probe-value"  # what the own client puts into a Basic header: NOT the camera's account
_CLIPS = {}


def reference_clip(codec, size):
    """The clip the camera sends, read by the camera's own reader: the pictures to compare the wire with."""
    if codec not in _CLIPS:
        kind = cam.Codec(codec)
        _CLIPS[codec] = cam.Clip(kind, cam.encode_clip(kind, size[0], size[1], 25, GOP, 250, cam.DEFAULT_CACHE), 250, GOP)
    return _CLIPS[codec]


def locator_for(port, path, user, password):
    """The locator a client is given: both values percent-encoded, every character outside A-Z a-z 0-9 - . _ ~ escaped."""
    escaped = lambda value: urllib.parse.quote(value, safe="")
    return "rtsp://" + escaped(user) + ":" + escaped(password) + "@" + "127.0.0.1:%d%s" % (port, path)


def probe(target, note, folder, timeout=120):
    """The reference client: `ffprobe` decodes and counts every picture of a locator or of a file."""
    done = subprocess.run([FFPROBE, "-v", "error"] + (["-rtsp_transport", "tcp"] if target.startswith("rtsp://") else []) +
                          ["-count_frames", "-select_streams", "v:0", "-show_entries", "stream=codec_name,width,height,r_frame_rate,nb_read_frames",
                           "-of", "json", target], stdin=subprocess.DEVNULL, capture_output=True, text=True, timeout=timeout)
    with open(os.path.join(folder, "ffprobe_stderr.txt"), "a") as handle:
        handle.write("---- %s ----\n%s\n" % (note, redact(done.stderr)))
    try:
        streams = json.loads(done.stdout or "{}").get("streams") or []
    except ValueError:
        streams = []
    stream = streams[0] if streams else {}
    frames = str(stream.get("nb_read_frames"))
    return {"rc": done.returncode, "streams": len(streams), "codec": stream.get("codec_name"), "frames": int(frames) if frames.isdigit() else None,
            "error_lines": len([l for l in done.stderr.splitlines() if l.strip()]), "says_401": "401" in done.stderr}


def open_stream(client, user, password):
    """DESCRIBE (the challenge, then with the account), SETUP, PLAY. The statuses, the description, the time of the PLAY answer."""
    status, headers, _ = client.ask("DESCRIBE", extra=["Accept: application/sdp"])
    _, fields = challenge_of(headers)
    if not fields.get("nonce"):
        return {"describe": status}, "", None
    account = {"user": user, "password": password, "challenge": fields}
    status, headers, sdp = client.ask("DESCRIBE", extra=["Accept: application/sdp"], **account)
    if status != 200:
        return {"describe": status}, "", None
    base = headers.get("content-base", [client.uri + "/"])[0]
    setup, _, _ = client.ask("SETUP", uri=base + "trackID=0", extra=["Transport: RTP/AVP/TCP;unicast;interleaved=0-1"], **account)
    play, _, _ = client.ask("PLAY", uri=base, extra=["Range: npt=0.000-"], **account)
    return {"describe": status, "setup": setup, "play": play}, sdp, time.monotonic()


def picture_kind(codec, nals):
    """(holds a keyframe unit, number of parameter-set units) of one picture."""
    types = [n[0] & 0x1F if codec == "h264" else (n[0] >> 1) & 0x3F for n in nals]
    if codec == "h264":
        return any(t == 5 for t in types), sum(1 for t in types if t in (7, 8))
    return any(16 <= t <= 21 for t in types), sum(1 for t in types if t in (32, 33, 34))


def description_sets(sdp):
    """The parameter sets a description carries, as NAL units (empty when it carries none)."""
    out = []
    for field in re.findall(r"sprop-[a-z-]+=([A-Za-z0-9+/=,]+)", sdp):
        out += [base64.b64decode(part) for part in field.split(",") if part]
    return out


def one_fault_run(mode, port, codec, sets, size, folder):
    checks, facts, cameras = {}, {}, []
    log = os.path.join(folder, "camera_events.jsonl")
    special = mode == "special"
    user = cam.SPECIAL_ACCOUNT_USER if special else cam.ACCOUNT_USER
    password = cam.SPECIAL_ACCOUNT_PASSWORD if special else cam.ACCOUNT_PASSWORD
    frames = 75 if mode.startswith("drop") else 50
    switches = {"basic": ["--challenge", "basic"], "both": ["--challenge", "both"],
                "delay_inter": ["--first-keyframe-delay-ms", str(DELAY_MS)],
                "delay_none": ["--first-keyframe-delay-ms", str(DELAY_MS), "--first-keyframe-fill", "none"],
                "drop_fin": ["--drop-after-frames", str(DROP_AFTER)],
                "drop_reset": ["--drop-after-frames", str(DROP_AFTER), "--drop-style", "reset"],
                "special": ["--account", "special"]}[mode]
    facts["switches"] = " ".join(switches)
    with_sets = sets == "inband"
    good = locator_for(port, cam.DEFAULT_PATH, user, password)

    def camera(action):
        """One fresh camera with the switches of the mode; it is stopped whatever `action` does."""
        proc, ready = start_camera(port, codec, sets, frames, size, log, switches)
        try:
            facts.setdefault("ready_faults", ready.get("faults"))
            facts.setdefault("listeners_while_running", listeners_of(proc.pid))
            action(ready["path"])
        finally:
            rc, counters = stop_camera(proc)
            cameras.append({"rc": rc, "counters": counters})

    def challenge_run(path):
        only_basic = mode == "basic"
        want = ["basic"] if only_basic else ["basic", "digest"]
        client = Client(port, path)
        status, _, _ = client.ask("OPTIONS")
        checks["options_answers_200"] = status == 200
        status, headers, _ = client.ask("DESCRIBE", extra=["Accept: application/sdp"])
        schemes, fields = challenge_of(headers)
        facts["unauthenticated"] = {"status": status, "schemes_offered": schemes, "challenge_lines": len(headers.get("www-authenticate", []))}
        checks["challenge_offers_exactly_" + "_and_".join(want)] = status == 401 and schemes == want
        # a Basic request with a value that is not the account: refused, and counted
        status, headers, _ = client.ask("DESCRIBE", extra=["Accept: application/sdp",
                                                             "Authorization: Basic " + base64.b64encode(PROBE_VALUE.encode()).decode()])
        facts["basic_request"] = {"status": status, "schemes_offered": challenge_of(headers)[0]}
        checks["basic_request_is_refused"] = status == 401 and challenge_of(headers)[0] == want
        if only_basic:  # a Digest answer made with the RIGHT password, to a nonce the camera never gave: still Basic only
            status, headers, _ = client.ask("DESCRIBE", extra=["Accept: application/sdp"], password=password,
                                            challenge={"realm": cam.REALM, "nonce": "0" * 32})
            facts["digest_answer"] = {"status": status, "schemes_offered": challenge_of(headers)[0]}
            checks["digest_answer_gets_basic_challenge_only"] = status == 401 and challenge_of(headers)[0] == ["basic"]
            client.close()
            seen = probe(good, "right account, Basic-only camera", folder)
            facts["ffprobe"] = seen
            checks["reference_client_reads_no_stream"] = seen["rc"] != 0 and seen["streams"] == 0
        else:
            client.close()
            client = Client(port, path)
            statuses, _, _ = open_stream(client, user, password)
            got, _ = client.pictures(codec, 30) if statuses.get("play") == 200 else ([], None)
            client.close()
            facts["digest_stream"] = {"statuses": statuses, "pictures": len(got)}
            checks["digest_is_granted"] = statuses.get("play") == 200 and len(got) == 30
            seen = probe(good, "right account, Basic and Digest offered", folder)
            facts["ffprobe"] = seen
            checks["reference_client_reads_stream"] = seen["rc"] == 0 and seen["codec"] == codec and seen["frames"] == frames

    def delay_run(path):
        clip = reference_clip(codec, size)
        client = Client(port, path)
        statuses, sdp, t_play = open_stream(client, user, password)
        got, ended = client.pictures(codec) if statuses.get("play") == 200 else ([], None)
        client.close()
        kinds = [picture_kind(codec, nals) for _, nals in got]
        first = next((i for i, kind in enumerate(kinds) if kind[0]), None)
        before = got[:first] if first is not None else got
        after = got[first:] if first is not None else []
        lead = DELAY_MS * 25 // 1000 if mode == "delay_inter" else 0
        seconds = round(got[first][0] - t_play, 3) if first is not None else None
        facts["stream"] = {"statuses": statuses, "pictures_before_first_keyframe": len(before), "keyframes_before": sum(1 for k in kinds[:len(before)] if k[0]),
                           "parameter_sets_before": sum(k[1] for k in kinds[:len(before)]), "first_keyframe_after_play_s": seconds,
                           "pictures_from_first_keyframe": len(after), "keyframes_after": sum(1 for k in kinds[len(before):] if k[0]), "ended": ended}
        checks["before_the_delay_no_keyframe_and_no_parameter_set"] = (first is not None and len(before) == lead
                                                                       and facts["stream"]["parameter_sets_before"] == 0)
        checks["first_keyframe_not_before_the_delay"] = seconds is not None and DELAY_MS / 1000 - 0.1 <= seconds <= DELAY_MS / 1000 + 1.0
        checks["full_stream_after_the_delay"] = (len(after) == frames and facts["stream"]["keyframes_after"] == frames // GOP
                                                 and [nals for _, nals in after] == [clip.unit(i, with_sets) for i in range(frames)])
        if lead:  # what came before the keyframe, with the sets of the description in front: does a decoder make a picture of it?
            name = os.path.join(folder, "before_first_keyframe." + ("h264" if codec == "h264" else "hevc"))
            with open(name, "wb") as handle:
                for nal in description_sets(sdp) + [n for _, nals in before for n in nals]:
                    handle.write(b"\x00\x00\x00\x01" + nal)
            decoded = probe(name, "the pictures before the first keyframe, as a file", folder)
            facts["decode_of_pictures_before"] = decoded
            checks["pictures_before_the_delay_do_not_decode"] = not decoded["frames"]
        seen = probe(good, "right account, delayed first keyframe", folder)
        facts["ffprobe"] = seen
        checks["reference_client_reads_the_full_stream"] = seen["rc"] == 0 and seen["codec"] == codec and seen["frames"] == frames

    def drop_own(path):
        clip = reference_clip(codec, size)
        style = "reset" if mode == "drop_reset" else "fin"
        client = Client(port, path)
        statuses, _, _ = open_stream(client, user, password)
        got, ended = client.pictures(codec) if statuses.get("play") == 200 else ([], None)
        client.close()
        units = [nals for _, nals in got]
        facts["first_connection"] = {"statuses": statuses, "pictures": len(got), "ended": ended,
                                     "pictures_since_last_keyframe": len(got) - max([i for i, n in enumerate(units) if picture_kind(codec, n)[0]] or [0])}
        if style == "fin":
            checks["connection_ends_after_the_stated_pictures"] = len(got) == DROP_AFTER and ended == "fin"
        else:  # a reset may take the last pictures the client had not read yet
            checks["connection_ends_after_the_stated_pictures"] = 0 < len(got) <= DROP_AFTER and ended == "reset"
        checks["what_came_is_the_clip_from_its_start"] = units == [clip.unit(i, with_sets) for i in range(len(got))]
        checks["it_ends_inside_a_group"] = DROP_AFTER % GOP != 0 and 0 < facts["first_connection"]["pictures_since_last_keyframe"] < GOP
        client = Client(port, path)
        statuses, _, _ = open_stream(client, user, password)
        got, ended = client.pictures(codec) if statuses.get("play") == 200 else ([], None)
        client.close()
        units = [nals for _, nals in got]
        kinds = [picture_kind(codec, n) for n in units]
        first = next((i for i, kind in enumerate(kinds) if kind[0]), None)
        facts["second_connection"] = {"statuses": statuses, "pictures": len(got), "ended": ended, "first_picture_is_keyframe": bool(kinds and kinds[0][0]),
                                      "pictures_before_first_keyframe": first, "parameter_sets_before_first_keyframe": sum(k[1] for k in kinds[:first or 0])}
        checks["new_connection_is_served"] = statuses.get("play") == 200 and len(got) == frames and ended == "fin"
        checks["it_goes_on_with_the_next_picture_of_the_clip"] = units == [clip.unit(DROP_AFTER + i, with_sets) for i in range(len(got))] and bool(got)
        checks["it_does_not_begin_on_a_keyframe"] = (bool(kinds) and not kinds[0][0] and first == GOP - DROP_AFTER % GOP
                                                     and facts["second_connection"]["parameter_sets_before_first_keyframe"] == 0)

    def drop_reference(path):
        one = probe(good, "first connection, dropped in mid group", folder)
        two = probe(good, "second connection, resumed in mid group", folder)
        facts["ffprobe_first_connection"], facts["ffprobe_second_connection"] = one, two
        if mode == "drop_fin":
            checks["reference_client_reads_the_pictures_before_the_drop"] = one["codec"] == codec and one["frames"] == DROP_AFTER
        else:
            checks["reference_client_reads_the_pictures_before_the_drop"] = one["codec"] == codec and one["frames"] is not None and 0 < one["frames"] <= DROP_AFTER
        # a decoder begins with the first keyframe of the resumed stream: the pictures before it are not counted
        checks["reference_client_reads_the_resumed_stream"] = (two["rc"] == 0 and two["codec"] == codec
                                                               and two["frames"] == frames - (GOP - DROP_AFTER % GOP))

    def special_run(path):
        client = Client(port, path)
        status, headers, _ = client.ask("DESCRIBE", extra=["Accept: application/sdp"])
        schemes, fields = challenge_of(headers)
        status_plain, _, _ = client.ask("DESCRIBE", extra=["Accept: application/sdp"], password=cam.ACCOUNT_PASSWORD, challenge=fields)
        client.close()
        facts["unauthenticated"] = {"status": status, "schemes_offered": schemes}
        facts["plain_account"] = {"status": status_plain}
        checks["challenge_is_digest_only"] = status == 401 and schemes == ["digest"]
        checks["plain_account_is_refused"] = status_plain == 401
        client = Client(port, path)
        statuses, _, _ = open_stream(client, user, password)
        got, _ = client.pictures(codec, 30) if statuses.get("play") == 200 else ([], None)
        client.close()
        facts["special_account"] = {"statuses": statuses, "pictures": len(got)}
        checks["special_account_authenticates_with_digest"] = statuses == {"describe": 200, "setup": 200, "play": 200} and len(got) == 30
        wrong = probe(locator_for(port, path, user, WRONG_PASSWORD), "special user, wrong password", folder)
        seen = probe(good, "special account, percent-encoded locator", folder)
        facts["ffprobe_wrong_password"], facts["ffprobe"] = wrong, seen
        checks["reference_client_wrong_password_refused"] = wrong["rc"] != 0 and wrong["says_401"] and wrong["streams"] == 0
        checks["reference_client_authenticates_and_reads_every_picture"] = (seen["rc"] == 0 and seen["codec"] == codec
                                                                             and seen["frames"] == frames and seen["error_lines"] == 0)

    if mode in ("basic", "both"):
        camera(challenge_run)
    elif mode.startswith("delay"):
        camera(delay_run)
    elif mode.startswith("drop"):
        camera(drop_own)
        camera(drop_reference)
    else:
        camera(special_run)

    counters = cameras[0]["counters"]
    facts["cameras"] = cameras
    checks["listens_on_loopback_port_only"] = facts.get("listeners_while_running") == ["127.0.0.1:%d (LISTEN)" % port]
    checks["cameras_ended_cleanly"] = all(c["rc"] == 0 and c["counters"].get("errors", 0) == 0 for c in cameras)
    if mode == "basic":
        facts["basic_requests_counted"] = counters.get("auth_basic", 0)
        facts["basic_requests_of_reference_client"] = counters.get("auth_basic", 0) - 1
        facts["basic_requests_carrying_the_account"] = counters.get("auth_basic_account_match", 0)
        checks["basic_request_is_counted"] = counters.get("auth_basic", 0) >= 1
        checks["nothing_was_granted"] = counters.get("auth_digest_ok", 0) == 0 and counters.get("streams_started", 0) == 0
        checks["every_challenge_was_basic_only"] = counters.get("basic_challenges_sent", 0) == counters.get("challenges_sent", -1) > 0
    elif mode == "both":
        facts["basic_requests_of_reference_client"] = counters.get("auth_basic", 0) - 1
        checks["basic_request_is_counted"] = counters.get("auth_basic", 0) >= 1
    else:
        checks["cameras_saw_no_basic_request"] = all(c["counters"].get("auth_basic", 0) == 0 for c in cameras)
    if mode.startswith("drop"):
        checks["one_stream_dropped_per_camera"] = all(c["counters"].get("streams_dropped", 0) == 1 for c in cameras)
    # the event log states classes and counts: no value of an account, plain, escaped or encoded, and not the probe value
    text = open(log, encoding="utf-8").read()
    needles = [password, urllib.parse.quote(password, safe=""), base64.b64encode(("%s:%s" % (user, password)).encode()).decode(),
               base64.b64encode(PROBE_VALUE.encode()).decode(), PROBE_VALUE] + ([user, urllib.parse.quote(user, safe="")] if special else [])
    facts["account_values_in_event_log"] = sum(text.count(needle) for needle in needles)
    checks["event_log_holds_no_account_value"] = facts["account_values_in_event_log"] == 0 and len(text) > 0
    facts["listening_after"] = listening_on(port)
    checks["no_listener_left"] = facts["listening_after"] == []
    return checks, facts


def fault_suite(args, size):
    modes = [m for m in args.modes.split(",") if m]
    if any(m not in FAULT_MODES for m in modes):
        sys.exit("--modes: one or more of " + ",".join(FAULT_MODES))
    result = {"started": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "suite": "faults", "port": args.port, "size": args.size, "runs": []}
    ok = True
    for mode in modes:
        for codec, sets in FAULT_CODECS:
            for run in range(1, args.runs + 1):
                folder = os.path.join(args.out, "%s_%s_%s_run%d" % (mode, codec, sets, run))
                os.makedirs(folder, exist_ok=True)
                try:
                    checks, facts = one_fault_run(mode, args.port, codec, sets, size, folder)
                except Exception as exc:  # the run is a failure with its place; the series goes on
                    checks, facts = {"run_completed": False}, {"error_type": type(exc).__name__, "error": redact(str(exc))[:300]}
                failed = sorted(name for name, good in checks.items() if not good)
                ok = ok and not failed
                result["runs"].append({"mode": mode, "codec": codec, "param_sets": sets, "run": run, "pass": not failed, "failed": failed,
                                       "checks": checks, "facts": facts})
                brief = {key: facts[key] for key in ("unauthenticated", "basic_requests_counted", "basic_requests_of_reference_client",
                                                     "basic_requests_carrying_the_account", "stream", "first_connection", "second_connection",
                                                     "special_account") if key in facts}
                for key in ("ffprobe", "ffprobe_first_connection", "ffprobe_second_connection", "decode_of_pictures_before"):
                    if key in facts:
                        brief[key] = "rc %s frames %s errors %s" % (facts[key]["rc"], facts[key]["frames"], facts[key]["error_lines"])
                print("%s %-11s %-4s %-6s run %d  checks %d/%d  %s%s" % (
                    "PASS" if not failed else "FAIL", mode, codec, sets, run, len(checks) - len(failed), len(checks),
                    redact(json.dumps(brief, separators=(",", ":"))), "" if not failed else "  failed: " + ",".join(failed)))
                sys.stdout.flush()
    result["listening_at_end"] = listening_on(args.port)
    result["pass"] = ok and result["listening_at_end"] == [] and bool(result["runs"])
    with open(os.path.join(args.out, "result.json"), "w") as handle:
        handle.write(redact(json.dumps(result, indent=1)))
    print("RESULT %s  suite faults  runs %d  passed %d  listener_left %s  %s" % (
        "PASS" if result["pass"] else "FAIL", len(result["runs"]), sum(1 for r in result["runs"] if r["pass"]), result["listening_at_end"],
        os.path.relpath(os.path.join(args.out, "result.json"), cam.REPO_ROOT)))
    return 0 if result["pass"] else 1


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--suite", choices=("base", "faults"), default="base", help="base: the four modes of row 39; faults: the switches of row 40")
    parser.add_argument("--modes", default=",".join(FAULT_MODES), help="with --suite faults: the fault modes to run")
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
    if args.suite == "faults":
        return fault_suite(args, size)

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
