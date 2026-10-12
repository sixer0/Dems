#!/usr/bin/env python3
"""The TEST CAMERA, base (task 4 blueprint row 39, work package WP-03b).

A DOUBLE of an IP camera for the relay rows and the session rows: an RTSP SERVER on loopback that a
client CONNECTS TO AND PULLS FROM (OPTIONS, DESCRIBE, SETUP, PLAY, TEARDOWN; RTP over the RTSP
connection, "interleaved"). The other fixtures of this folder go the opposite way: `fake_cam.c` and
`fake_cam_sr.py` PUSH into a listener (ANNOUNCE, RECORD).

What it is modelled on (research/01_explore_input_av.md: the cameras of the bench): H.264 or H.265,
1920x1080, 25 pictures a second, a keyframe every second, no B-frames, RTSP over TCP, Digest
authentication (RFC 2617, MD5, no `qop`), a sender report every second.

The four base modes: `--codec h264|hevc` times `--param-sets sdp|inband`.
    sdp      the parameter sets (H.264: SPS, PPS; HEVC: VPS, SPS, PPS) are in the description
             (`sprop-*` of the `a=fmtp` line) and NOWHERE in the stream;
    inband   the description names the codec only; the parameter sets come with every keyframe.
How the in-band HEVC case is made (test/01_hevc_experiment.md found that the RTSP writer of FFmpeg
cannot be told to leave the parameter sets out of its description): this program writes the
description itself, from an Annex B elementary stream the installed `ffmpeg` program encoded once
(x264 / x265 with repeated headers), so both forms are exact by construction and are counted.

Rules it holds, each refused before a socket exists:
    - it binds 127.0.0.1 and nothing else (there is no option for another address);
    - it never binds a port of 8554 to 8564 (the capture worker's ingest range), nor one of the
      development ports of this host (4400 to 4432, 5173, 8081); port 0 asks the system for a free one;
    - UDP transport is refused (461): it opens no datagram socket.

THE ONE SYNTHETIC ACCOUNT of the test camera is the constant below. It is a placeholder made for this
double, used nowhere else, and it is never written to a log, an event line or an error text: events
state the authentication CLASS of a request (none, digest_ok, digest_refused, basic, other) and counts.
Tests import the constants from this file instead of repeating them.

Output: one JSON object per line on standard output (`ready` first, with the port; `request`,
`stream_start`, `stream_end`, `exit` with the counters), the same lines appended to `--event-log`.
It ends on SIGTERM / SIGINT, after `--max-seconds`, or when its standard input closes
(`--exit-on-stdin-eof`: a harness that dies takes the camera with it). No listener is left.

Later rows extend this file (they are NOT built here): row 40 a Basic-only challenge, a delay before
the first keyframe, a drop and a resume in mid group, an account with special characters; row 152 a
redirect and hostile descriptions. Python standard library and the installed ffmpeg only.

    python3 apps/capture-worker/test-fixtures/rtsp_test_camera.py --port 8565 --codec hevc --param-sets inband
"""
import argparse
import base64
import errno
import hashlib
import hmac
import json
import os
import re
import secrets
import select
import shutil
import signal
import socket
import struct
import subprocess
import sys
import threading
import time
import traceback

# ---------------------------------------------------------------------------------------------------------------------
# THE synthetic account (one place; a placeholder of this double, never a real credential, never logged).
ACCOUNT_USER = "testcam"
ACCOUNT_PASSWORD = "synthetic-camera-pass-39f1c7"
REALM = "DEMS test camera"
# ---------------------------------------------------------------------------------------------------------------------

BIND_HOST = "127.0.0.1"  # the only address; no option changes it
REFUSED_PORTS = (
    (8554, 8564, "the capture worker's ingest range"),
    (4400, 4432, "the Core, lane and database ports of this host"),
    (5173, 5173, "the web console's development server"),
    (8081, 8081, "the mobile bundler"),
)
DEFAULT_PATH = "/media/video1"
TRACK = "trackID=0"
PAYLOAD_TYPE = 96
CLOCK = 90000
MTU = 1400
NTP_EPOCH_S = 2208988800
FF = os.environ.get("DEMS_FFMPEG") or shutil.which("ffmpeg") or "/opt/homebrew/bin/ffmpeg"
REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", ".."))
DEFAULT_CACHE = os.path.join(REPO_ROOT, ".cache", "rtsp-test-camera")

EXIT_USAGE, EXIT_ENCODE, EXIT_BIND = 2, 3, 4


def port_refusal(port):
    """Why this port is refused, or None. Checked before any socket is made."""
    if port == 0:
        return None
    if not 1024 <= port <= 65535:
        return "port %d is outside 1024 to 65535" % port
    for low, high, what in REFUSED_PORTS:
        if low <= port <= high:
            return "port %d is refused: %d to %d is %s" % (port, low, high, what)
    return None


# ---------------------------------------------------------------------------------------------------------------------
# The picture: encoded once by the ffmpeg program, read back as access units.

class Codec:
    def __init__(self, name):
        self.name = name
        if name == "h264":
            self.rtp_name, self.suffix, self.set_types = "H264", "h264", (7, 8)
        else:
            self.rtp_name, self.suffix, self.set_types = "H265", "hevc", (32, 33, 34)

    def nal_type(self, nal):
        return nal[0] & 0x1F if self.name == "h264" else (nal[0] >> 1) & 0x3F

    def is_vcl(self, t):
        return 1 <= t <= 5 if self.name == "h264" else t <= 31

    def is_key(self, t):
        return t == 5 if self.name == "h264" else 16 <= t <= 21

    def opens_unit(self, t):
        """A non-picture unit that belongs to the NEXT picture when it follows picture data."""
        return t in (6, 7, 8, 9, 14, 15) if self.name == "h264" else t in (32, 33, 34, 35, 39)

    def first_slice(self, nal):
        if self.name == "h264":
            return len(nal) > 1 and bool(nal[1] & 0x80)  # first_mb_in_slice = 0
        return len(nal) > 2 and bool(nal[2] & 0x80)  # first_slice_segment_in_pic_flag


def encode_clip(codec, width, height, fps, gop, frames, cache):
    """The clip as an Annex B elementary stream with the parameter sets before every keyframe. Made once per shape."""
    os.makedirs(cache, exist_ok=True)
    path = os.path.join(cache, "clip_%s_%dx%d_%dfps_gop%d_%df.%s" % (codec.name, width, height, fps, gop, frames, codec.suffix))
    if os.path.isfile(path) and os.path.getsize(path) > 0:
        return path
    cmd = [FF, "-v", "error", "-nostdin", "-y", "-f", "lavfi", "-i", "testsrc2=size=%dx%d:rate=%d" % (width, height, fps),
           "-frames:v", str(frames), "-an", "-pix_fmt", "yuv420p", "-bf", "0", "-g", str(gop)]
    if codec.name == "h264":
        cmd += ["-c:v", "libx264", "-preset", "ultrafast", "-x264-params",
                "scenecut=0:keyint=%d:min-keyint=%d:bframes=0:aud=0:repeat-headers=1" % (gop, gop), "-f", "h264"]
    else:
        cmd += ["-c:v", "libx265", "-preset", "ultrafast", "-x265-params",
                "scenecut=0:keyint=%d:min-keyint=%d:bframes=0:repeat-headers=1:info=0:log-level=warning" % (gop, gop), "-f", "hevc"]
    part = "%s.%d.part" % (path, os.getpid())
    done = subprocess.run(cmd + [part], stdin=subprocess.DEVNULL, capture_output=True, text=True)
    if done.returncode != 0 or not os.path.isfile(part) or os.path.getsize(part) == 0:
        try:
            os.unlink(part)
        except OSError:
            pass
        raise RuntimeError("the ffmpeg program could not encode the clip (rc %d): %s" % (done.returncode, done.stderr.strip()[-300:]))
    os.replace(part, path)
    return path


class Clip:
    """Access units of the clip; each is a list of NAL units (without start codes)."""

    def __init__(self, codec, path, frames, gop):
        self.codec = codec
        with open(path, "rb") as handle:
            data = handle.read()
        marks = [m for m in re.finditer(b"\x00\x00\x01", data)]
        nals = []
        for i, mark in enumerate(marks):
            end = marks[i + 1].start() if i + 1 < len(marks) else len(data)
            nal = data[mark.end():end].rstrip(b"\x00")
            if nal:
                nals.append(nal)
        self.units, self.sets = [], {}
        unit, has_picture = [], False
        for nal in nals:
            t = codec.nal_type(nal)
            if t in codec.set_types and t not in self.sets:
                self.sets[t] = nal
            if codec.is_vcl(t):
                if has_picture and codec.first_slice(nal):
                    self.units.append(unit)
                    unit = []
                has_picture = True
            elif has_picture and codec.opens_unit(t):
                self.units.append(unit)
                unit, has_picture = [], False
            unit.append(nal)
        if unit and has_picture:
            self.units.append(unit)
        self.keys = [any(codec.is_key(codec.nal_type(n)) for n in u) for u in self.units]
        if len(self.units) != frames:
            raise RuntimeError("the clip holds %d pictures, %d were asked for" % (len(self.units), frames))
        if any(t not in self.sets for t in codec.set_types):
            raise RuntimeError("the clip holds no complete parameter sets")
        for i, unit in enumerate(self.units):
            if self.keys[i] != (i % gop == 0):
                raise RuntimeError("picture %d: keyframe %s, expected %s" % (i, self.keys[i], i % gop == 0))
            if self.keys[i]:
                present = {codec.nal_type(n) for n in unit}
                if any(t not in present for t in codec.set_types):
                    raise RuntimeError("keyframe %d does not carry every parameter set" % i)

    def unit(self, index, with_sets):
        nals = self.units[index % len(self.units)]
        if with_sets:
            return nals
        return [n for n in nals if self.codec.nal_type(n) not in self.codec.set_types]


def fmtp_line(codec, clip, param_sets):
    """The `a=fmtp` line of the description, or None when the description states nothing but the codec."""
    b64 = lambda nal: base64.b64encode(nal).decode("ascii")
    if codec.name == "h264":
        if param_sets == "inband":
            return "a=fmtp:%d packetization-mode=1" % PAYLOAD_TYPE
        sps, pps = clip.sets[7], clip.sets[8]
        return "a=fmtp:%d packetization-mode=1; profile-level-id=%s; sprop-parameter-sets=%s,%s" % (
            PAYLOAD_TYPE, sps[1:4].hex().upper(), b64(sps), b64(pps))
    if param_sets == "inband":
        return None
    return "a=fmtp:%d sprop-vps=%s; sprop-sps=%s; sprop-pps=%s" % (
        PAYLOAD_TYPE, b64(clip.sets[32]), b64(clip.sets[33]), b64(clip.sets[34]))


def rtp_payloads(codec, nal):
    """One NAL unit as RTP payloads: a single unit, or fragments (RFC 6184 FU-A, RFC 7798 FU)."""
    if len(nal) <= MTU:
        return [nal]
    out = []
    if codec.name == "h264":
        indicator, kind, body = bytes([(nal[0] & 0xE0) | 28]), nal[0] & 0x1F, nal[1:]
    else:
        indicator, kind, body = bytes([(nal[0] & 0x81) | (49 << 1), nal[1]]), (nal[0] >> 1) & 0x3F, nal[2:]
    step = MTU - len(indicator) - 1
    for at in range(0, len(body), step):
        flags = (0x80 if at == 0 else 0) | (0x40 if at + step >= len(body) else 0)
        out.append(indicator + bytes([flags | kind]) + body[at:at + step])
    return out


# ---------------------------------------------------------------------------------------------------------------------
# Events and counters (never a header value, never an account).

class Journal:
    def __init__(self, path):
        self.lock = threading.Lock()
        self.file = open(path, "a", encoding="utf-8") if path else None
        self.counters = {}

    def count(self, name, by=1):
        with self.lock:
            self.counters[name] = self.counters.get(name, 0) + by

    def emit(self, event, **fields):
        line = {"t": time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime()) + ".%03dZ" % (time.time_ns() // 1000000 % 1000),
                "source": "rtsp-test-camera", "event": event}
        line.update(fields)
        text = json.dumps(line, separators=(",", ":"))
        with self.lock:
            try:
                sys.stdout.write(text + "\n")
                sys.stdout.flush()
            except (OSError, ValueError):
                pass  # the reader of standard output is gone; the event log below still has the line
            if self.file:
                self.file.write(text + "\n")
                self.file.flush()

    def error(self, where, exc):
        """A failure of the double itself: type and place only (a message could repeat request text)."""
        frame = traceback.extract_tb(exc.__traceback__)[-1] if exc.__traceback__ else None
        self.count("errors")
        self.emit("error", level="error", where=where, error_type=type(exc).__name__,
                  at="%s:%d" % (os.path.basename(frame.filename), frame.lineno) if frame else None,
                  errno=getattr(exc, "errno", None))


# ---------------------------------------------------------------------------------------------------------------------
# The RTSP dialogue.

class Closed(Exception):
    pass


class Connection:
    HEAD_LIMIT = 16384

    def __init__(self, camera, sock, number):
        self.camera, self.sock, self.number = camera, sock, number
        self.buffer = b""
        self.send_lock = threading.Lock()
        self.gone = threading.Event()
        self.nonce = None
        self.session = None
        self.channels = None
        self.streamer = None

    # -- bytes in
    def fill(self):
        while True:
            if self.gone.is_set() or self.camera.stop.is_set():
                raise Closed()
            ready, _, _ = select.select([self.sock], [], [], 0.5)
            if ready:
                break
        data = self.sock.recv(65536)
        if not data:
            raise Closed()
        self.buffer += data

    def request(self):
        """The next request; interleaved frames from the client (receiver reports) are skipped."""
        while True:
            self.buffer = self.buffer.lstrip(b"\r\n")
            if not self.buffer:
                self.fill()
                continue
            if self.buffer[0] == 0x24:
                while len(self.buffer) < 4:
                    self.fill()
                size = struct.unpack(">H", self.buffer[2:4])[0]
                while len(self.buffer) < 4 + size:
                    self.fill()
                self.buffer = self.buffer[4 + size:]
                continue
            end = self.buffer.find(b"\r\n\r\n")
            if end < 0:
                if len(self.buffer) > self.HEAD_LIMIT:
                    raise ValueError("request head too long")
                self.fill()
                continue
            head, self.buffer = self.buffer[:end].decode("latin-1"), self.buffer[end + 4:]
            lines = head.split("\r\n")
            parts = lines[0].split(" ")
            if len(parts) != 3 or not parts[2].startswith("RTSP/"):
                raise ValueError("not an RTSP request line")
            headers = {}
            for line in lines[1:]:
                name, sep, value = line.partition(":")
                if sep:
                    headers[name.strip().lower()] = value.strip()
            length = int(headers.get("content-length", "0") or "0")
            if not 0 <= length <= self.HEAD_LIMIT:
                raise ValueError("request body too long")
            while len(self.buffer) < length:
                self.fill()
            self.buffer = self.buffer[length:]
            return parts[0], parts[1], headers

    # -- bytes out
    def send(self, data):
        with self.send_lock:
            self.sock.sendall(data)

    def reply(self, cseq, status, reason, headers=(), body=b""):
        lines = ["RTSP/1.0 %d %s" % (status, reason), "CSeq: %s" % cseq, "Server: DEMS-test-camera"]
        lines += list(headers)
        if body:
            lines.append("Content-Length: %d" % len(body))
        self.send(("\r\n".join(lines) + "\r\n\r\n").encode("latin-1") + body)

    # -- authentication: Digest only (RFC 2617, MD5, no qop)
    def challenge(self):
        self.nonce = secrets.token_hex(16)
        self.camera.journal.count("challenges_sent")
        return 'WWW-Authenticate: Digest realm="%s", nonce="%s"' % (REALM, self.nonce)

    def auth_class(self, method, headers):
        value = headers.get("authorization")
        if not value:
            return "none"
        scheme, _, rest = value.partition(" ")
        if scheme.lower() == "basic":
            return "basic"
        if scheme.lower() != "digest":
            return "other"
        given = {m.group(1).lower(): (m.group(2) if m.group(2) is not None else m.group(3))
                 for m in re.finditer(r'(\w+)\s*=\s*(?:"([^"]*)"|([^,\s]+))', rest)}
        md5 = lambda text: hashlib.md5(text.encode("utf-8")).hexdigest()
        expected = md5("%s:%s:%s" % (
            md5("%s:%s:%s" % (ACCOUNT_USER, REALM, ACCOUNT_PASSWORD)), self.nonce or "", md5("%s:%s" % (method, given.get("uri", "")))))
        good = (self.nonce is not None
                and hmac.compare_digest(given.get("username", ""), ACCOUNT_USER)
                and given.get("realm") == REALM
                and given.get("nonce") == self.nonce
                and hmac.compare_digest(given.get("response", "").lower(), expected))
        return "digest_ok" if good else "digest_refused"

    # -- one request
    def handle(self, method, uri, headers):
        camera, journal = self.camera, self.camera.journal
        cseq = headers.get("cseq", "0")
        auth = self.auth_class(method, headers)
        journal.count("requests")
        journal.count("auth_" + auth)
        status = self.answer(method, uri, headers, cseq, auth)
        journal.emit("request", conn=self.number, method=method if method in camera.METHODS else "OTHER", auth=auth, status=status)
        return method != "TEARDOWN" or status != 200

    def answer(self, method, uri, headers, cseq, auth):
        camera = self.camera
        if method not in camera.METHODS:
            self.reply(cseq, 405, "Method Not Allowed", ["Allow: " + ", ".join(camera.METHODS)])
            return 405
        if method == "OPTIONS":  # answered without an account, as common cameras do
            self.reply(cseq, 200, "OK", ["Public: " + ", ".join(camera.METHODS)])
            return 200
        if auth != "digest_ok":
            self.reply(cseq, 401, "Unauthorized", [self.challenge()])
            return 401
        path = re.sub(r"^rtsp://[^/]*", "", uri).split("?", 1)[0].rstrip("/")
        base = "rtsp://%s:%d%s/" % (BIND_HOST, camera.port, camera.path)
        if method == "SETUP":
            if path != camera.path + "/" + TRACK:
                self.reply(cseq, 404, "Not Found")
                return 404
            found = re.search(r"interleaved=(\d+)-(\d+)", headers.get("transport", ""))
            if "RTP/AVP/TCP" not in headers.get("transport", "") or not found:
                self.reply(cseq, 461, "Unsupported Transport")  # no datagram socket, ever
                return 461
            self.channels = (int(found.group(1)) & 0xFF, int(found.group(2)) & 0xFF)
            self.session = self.session or secrets.token_hex(8)
            self.reply(cseq, 200, "OK", [
                "Transport: RTP/AVP/TCP;unicast;interleaved=%d-%d;ssrc=%08X" % (self.channels[0], self.channels[1], camera.ssrc),
                "Session: %s;timeout=60" % self.session])
            return 200
        if path != camera.path:
            self.reply(cseq, 404, "Not Found")
            return 404
        if method == "DESCRIBE":
            body = camera.description().encode("ascii")
            self.reply(cseq, 200, "OK", ["Content-Base: " + base, "Content-Type: application/sdp"], body)
            return 200
        if self.session is None or headers.get("session", "").split(";")[0] != self.session:
            self.reply(cseq, 454, "Session Not Found")
            return 454
        if method == "PLAY":
            if self.streamer is None:
                first_seq, first_ts = secrets.randbelow(0x8000), secrets.randbelow(0x40000000)
                self.reply(cseq, 200, "OK", ["Session: " + self.session, "Range: npt=0.000-",
                                             "RTP-Info: url=%s%s;seq=%d;rtptime=%d" % (base, TRACK, first_seq, first_ts)])
                self.streamer = threading.Thread(target=self.stream, args=(first_seq, first_ts), daemon=True)
                self.streamer.start()
            else:
                self.reply(cseq, 200, "OK", ["Session: " + self.session])
            return 200
        self.reply(cseq, 200, "OK", ["Session: " + self.session])  # GET_PARAMETER (keep-alive), TEARDOWN
        return 200

    # -- the pictures, at their time
    def stream(self, seq, first_ts):
        camera, journal, codec = self.camera, self.camera.journal, self.camera.codec
        rtp_channel, rtcp_channel = self.channels
        per_frame = CLOCK // camera.fps
        with_sets = camera.param_sets == "inband"
        sent = packets = octets = set_nals = keyframes = 0
        reason = "frames_complete"
        started, wall0 = time.monotonic(), time.time()
        journal.count("streams_started")
        journal.emit("stream_start", conn=self.number)
        try:
            while camera.frames == 0 or sent < camera.frames:
                wait = started + sent / camera.fps - time.monotonic()
                if wait > 0 and (self.gone.wait(wait) or camera.stop.is_set()):
                    reason = "stopped"
                    break
                if self.gone.is_set() or camera.stop.is_set():
                    reason = "stopped"
                    break
                ts = (first_ts + sent * per_frame) & 0xFFFFFFFF
                out = bytearray()
                if sent % camera.fps == 0:  # a sender report every second, the first before the first picture
                    ntp = wall0 + sent / camera.fps + NTP_EPOCH_S
                    report = struct.pack(">BBHIIIIII", 0x80, 200, 6, camera.ssrc, int(ntp) & 0xFFFFFFFF,
                                         int((ntp % 1) * (1 << 32)) & 0xFFFFFFFF, ts, packets & 0xFFFFFFFF, octets & 0xFFFFFFFF)
                    out += struct.pack(">BBH", 0x24, rtcp_channel, len(report)) + report
                nals = camera.clip.unit(sent, with_sets)
                payloads = [p for nal in nals for p in rtp_payloads(codec, nal)]
                for i, payload in enumerate(payloads):
                    marker = 0x80 if i == len(payloads) - 1 else 0
                    header = struct.pack(">BBHII", 0x80, marker | PAYLOAD_TYPE, seq & 0xFFFF, ts, camera.ssrc)
                    out += struct.pack(">BBH", 0x24, rtp_channel, 12 + len(payload)) + header + payload
                    seq += 1
                    octets += len(payload)
                packets += len(payloads)
                self.send(bytes(out))
                set_nals += sum(1 for n in nals if codec.nal_type(n) in codec.set_types)
                keyframes += 1 if camera.clip.keys[sent % len(camera.clip.units)] else 0
                sent += 1
        except OSError as exc:
            reason = "client_gone" if exc.errno in (errno.EPIPE, errno.ECONNRESET, errno.EBADF, errno.ENOTCONN) else "send_failed"
            if reason == "send_failed":
                journal.error("stream", exc)
        except Exception as exc:  # a fault of the double: named, the connection ends
            reason = "fault"
            journal.error("stream", exc)
        journal.count("frames_sent", sent)
        journal.count("parameter_set_nals_sent", set_nals)
        journal.emit("stream_end", conn=self.number, reason=reason, frames_sent=sent, keyframes_sent=keyframes,
                     rtp_packets=packets, parameter_set_nals_sent=set_nals)
        if reason != "stopped":  # the stream is over: the camera ends the connection, the client sees its end
            self.close()

    def close(self):
        self.gone.set()
        try:
            self.sock.shutdown(socket.SHUT_RDWR)
        except OSError:
            pass

    def run(self):
        journal = self.camera.journal
        try:
            while self.handle(*self.request()):
                pass
        except Closed:
            pass
        except (OSError, ValueError) as exc:
            if isinstance(exc, ValueError):
                journal.count("malformed_requests")
                journal.emit("request", conn=self.number, method="MALFORMED", auth="none", status=0)
            elif exc.errno not in (errno.EPIPE, errno.ECONNRESET, errno.EBADF, errno.ENOTCONN):
                journal.error("connection", exc)
        except Exception as exc:
            journal.error("connection", exc)
        finally:
            self.close()
            if self.streamer is not None:
                self.streamer.join(timeout=5)
            try:
                self.sock.close()
            except OSError:
                pass
            journal.emit("connection_closed", conn=self.number)


class Camera:
    METHODS = ("OPTIONS", "DESCRIBE", "SETUP", "PLAY", "GET_PARAMETER", "TEARDOWN")

    def __init__(self, args, clip, journal):
        self.codec, self.clip, self.journal = clip.codec, clip, journal
        self.param_sets, self.path = args.param_sets, args.path
        self.width, self.height, self.fps, self.gop, self.frames = args.width, args.height, args.fps, args.gop, args.frames
        self.ssrc = secrets.randbits(32)
        self.stop = threading.Event()
        self.connections = []
        self.listener = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.listener.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        self.listener.bind((BIND_HOST, args.port))  # the ONE bind of this program
        self.listener.listen(8)
        self.listener.settimeout(0.5)
        self.port = self.listener.getsockname()[1]

    def description(self):
        lines = ["v=0", "o=- %d 1 IN IP4 %s" % (self.ssrc, BIND_HOST), "s=DEMS test camera", "c=IN IP4 0.0.0.0", "t=0 0",
                 "a=control:*", "a=range:npt=0-", "m=video 0 RTP/AVP %d" % PAYLOAD_TYPE,
                 "a=rtpmap:%d %s/%d" % (PAYLOAD_TYPE, self.codec.rtp_name, CLOCK)]
        fmtp = fmtp_line(self.codec, self.clip, self.param_sets)
        if fmtp:
            lines.append(fmtp)
        lines += ["a=framerate:%d" % self.fps, "a=control:" + TRACK]
        return "\r\n".join(lines) + "\r\n"

    def serve(self, deadline):
        number = 0
        while not self.stop.is_set():
            if time.monotonic() >= deadline:
                self.journal.emit("deadline", level="warn")
                break
            try:
                sock, peer = self.listener.accept()
            except socket.timeout:
                continue
            except OSError as exc:
                if not self.stop.is_set():
                    self.journal.error("accept", exc)
                break
            if peer[0] != BIND_HOST:
                sock.close()
                continue
            number += 1
            sock.setblocking(True)
            sock.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_SNDTIMEO, struct.pack("ll", 15, 0))
            connection = Connection(self, sock, number)
            self.connections.append(connection)
            self.journal.count("connections")
            threading.Thread(target=connection.run, daemon=True).start()
        self.stop.set()
        self.listener.close()
        for connection in self.connections:
            connection.close()
        for connection in self.connections:
            if connection.streamer is not None:
                connection.streamer.join(timeout=5)


def main():
    parser = argparse.ArgumentParser(description="DEMS pull-side RTSP test camera (loopback only)")
    parser.add_argument("--port", type=int, required=True, help="loopback port; 0 = a free one (stated in the ready line)")
    parser.add_argument("--codec", choices=("h264", "hevc"), default="h264")
    parser.add_argument("--param-sets", choices=("sdp", "inband"), default="sdp")
    parser.add_argument("--path", default=DEFAULT_PATH, help="the stream path a client must name")
    parser.add_argument("--width", type=int, default=1920)
    parser.add_argument("--height", type=int, default=1080)
    parser.add_argument("--fps", type=int, default=25)
    parser.add_argument("--gop", type=int, default=25, help="pictures per keyframe interval")
    parser.add_argument("--clip-frames", type=int, default=250, help="length of the encoded clip; it repeats (a multiple of --gop)")
    parser.add_argument("--frames", type=int, default=0, help="pictures sent per PLAY, then the camera ends the connection; 0 = until stopped")
    parser.add_argument("--max-seconds", type=int, default=900, help="the camera ends itself after this time")
    parser.add_argument("--cache", default=DEFAULT_CACHE, help="folder of the encoded clips (git-ignored)")
    parser.add_argument("--event-log", default=None, help="append the event lines to this file")
    parser.add_argument("--exit-on-stdin-eof", action="store_true", help="end when standard input closes")
    args = parser.parse_args()

    def refuse(text):
        sys.stderr.write("RTSP_TEST_CAMERA REFUSED %s\n" % text)
        sys.exit(EXIT_USAGE)

    reason = port_refusal(args.port)
    if reason:
        refuse(reason)
    if not re.fullmatch(r"(/[A-Za-z0-9._~-]+)+", args.path):
        refuse("the stream path must be /name[/name...] of letters, digits and . _ ~ -")
    if not (16 <= args.width <= 3840 and 16 <= args.height <= 2160 and args.width % 2 == 0 and args.height % 2 == 0):
        refuse("picture size out of range")
    if not (1 <= args.fps <= 60 and CLOCK % args.fps == 0):
        refuse("the rate must divide 90000 and be 1 to 60")
    if not (1 <= args.gop <= 600 and args.gop <= args.clip_frames <= 3000 and args.clip_frames % args.gop == 0):
        refuse("--clip-frames must be a multiple of --gop, at most 3000")
    if args.frames < 0 or not 1 <= args.max_seconds <= 86400:
        refuse("--frames or --max-seconds out of range")

    journal = Journal(args.event_log)
    codec = Codec(args.codec)
    try:
        clip = Clip(codec, encode_clip(codec, args.width, args.height, args.fps, args.gop, args.clip_frames, args.cache),
                    args.clip_frames, args.gop)
    except (RuntimeError, OSError) as exc:
        journal.error("clip", exc)
        sys.stderr.write("RTSP_TEST_CAMERA FATAL clip: %s\n" % exc)
        sys.exit(EXIT_ENCODE)
    try:
        camera = Camera(args, clip, journal)
    except OSError as exc:
        journal.error("bind", exc)
        sys.stderr.write("RTSP_TEST_CAMERA FATAL bind %s:%d: errno %s\n" % (BIND_HOST, args.port, exc.errno))
        sys.exit(EXIT_BIND)

    for number in (signal.SIGTERM, signal.SIGINT):
        signal.signal(number, lambda *_: camera.stop.set())
    if args.exit_on_stdin_eof:
        def watch():
            try:
                while sys.stdin.buffer.read(4096):
                    pass
            except (OSError, ValueError):
                pass
            camera.stop.set()
        threading.Thread(target=watch, daemon=True).start()

    journal.emit("ready", pid=os.getpid(), host=BIND_HOST, port=camera.port, path=camera.path, codec=codec.name,
                 param_sets=args.param_sets, width=args.width, height=args.height, fps=args.fps, gop=args.gop,
                 clip_frames=args.clip_frames, frames_per_play=args.frames, authentication="digest", transport="tcp-interleaved")
    camera.serve(time.monotonic() + args.max_seconds)
    journal.emit("exit", counters=dict(sorted(journal.counters.items())))
    return 0


if __name__ == "__main__":
    sys.exit(main())
