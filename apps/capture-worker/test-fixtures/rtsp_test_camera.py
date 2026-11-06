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

Later rows extend this file (they are NOT built here): row 152 a redirect and hostile descriptions.
Python standard library and the installed ffmpeg only.

    python3 apps/capture-worker/test-fixtures/rtsp_test_camera.py --port 8565 --codec hevc --param-sets inband

THE FAULT MODES (row 40). Every one is an opt-in switch; without them the camera is the base camera of
row 39, line for line of its output.
    --challenge digest|basic|both   `basic`: every request that needs an account gets 401 with a Basic
                                    challenge ONLY and nothing is ever granted (security item S13-01: a
                                    client that answers it has put the password on the wire; the camera
                                    COUNTS such requests, `auth_basic`, and how many of them carried this
                                    camera's account, `auth_basic_account_match`; it never keeps a value).
                                    `both`: a Basic and a Digest challenge together; only Digest is granted.
    --first-keyframe-delay-ms N     the first keyframe of every PLAY comes N ms late. Until then
    --first-keyframe-fill inter|none    `inter`: pictures that are not keyframes, at the picture rate, with
                                    no parameter set among them (a camera joined in mid group);
                                    `none`: nothing at all. `--frames` counts from the first keyframe on.
    --drop-after-frames N           the camera ends the connection after N pictures of a PLAY, with no
    --drop-count C  --drop-style fin|reset    warning (`fin`: orderly close; `reset`: a reset). The NEXT
                                    PLAY, on a new connection, goes on with the very next picture of the
                                    clip, so it does NOT begin on a keyframe (plan review F10 a). The first
                                    C streams that reach N pictures are dropped (default 1); every k x N
                                    must fall inside a group, or the switch is refused.
    --account plain|special         `special`: the camera's account is the second constant below, whose
                                    two values hold `@ / %` and a space, the password a `:` as well.

THE HOSTILE MODES (row 186; security review 06, finding H-2: "the time bounds are not bounds"). ONE opt-in
switch, `--adversary`, default `none` (then nothing below exists: the camera is the camera of rows 39 and 40).
A camera, or whoever answers at its address, that tries to HOLD its client:
    trickle-answer    every answer is sent ONE BYTE every `--adversary-interval-ms` (99): no read of the client
                      ever waits long, and no answer is ever whole inside its bound
    flood-answer      DESCRIBE is never answered: interleaved frames (empty ones and ones of another channel)
                      are sent instead, as fast as the connection takes them
    slow-answers      every answer comes `--adversary-delay-ms` (4500) late: each inside a 5 s bound, their sum not
    trickle-stream    after `--adversary-after-frames` pictures of a PLAY: one more video packet, one byte at a time
    flood-stream      after those pictures: frames of another channel and empty frames of the video channel only
    flood-foreign     after those pictures: whole RTP packets on the video channel with ANOTHER payload type
    flood-unmarked    after those pictures: video units of ONE time stamp and never the mark (a picture that
                      never ends: what a client collects must stay bounded)
The camera states `hostile_start` (an event line) when the mode begins and counts `hostile_bytes_sent`.

THE REDIRECT AND THE HOSTILE DESCRIPTIONS (row 152; security items S13-01 "never another host", AD-05, AD-06).
Opt-in switches; without them nothing below exists. A camera, or whoever answers at its address, that tries to
SEND ITS CLIENT SOMEWHERE ELSE, or to put its own text into what the client keeps:
    --second-port N                 a SECOND loopback listener of this camera (127.0.0.1, the same port rule, not
                                    the first port). It serves the same camera. Whoever arrives there FOLLOWED a
                                    redirect or a foreign control address: the camera counts the connections
                                    (`second_port_connections`), the requests (`second_port_requests`) and the
                                    requests that carried an Authorization header (`second_port_authorized`).
    --redirect first|authenticated  DESCRIBE on the first port is answered `302` with a Location on the second
                                    port. `first`: at once, before any challenge. `authenticated`: the challenge
                                    first, then the 302 to the DESCRIBE that carried the right Digest answer (the
                                    client now holds an answer it could carry along). Needs --second-port.
    --sdp-control other-port|other-host    the media control address of the description is an ABSOLUTE locator
                                    of another place: `other-port` the second port of this camera (needs
                                    --second-port); `other-host` the address 127.0.0.2 with this camera's port -
                                    a host of the loopback net this program never binds, and never a name (no
                                    look-up can leave this machine).
    --sdp-codec lower|hostile       the codec name of the description (`a=rtpmap`): `lower` the real name in
                                    lower-case letters; `hostile` a name of exactly 300 characters that begins
                                    with the lower-case name and holds markup characters (< > & " ' and a
                                    script tag). The stream itself stays the real codec.
The counters `redirects_sent`, `foreign_control_descriptions` and `hostile_codec_descriptions` say how often each
answer was given. No event line carries a locator or the hostile text: counts and codes only.
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
# The same placeholder with the characters a locator cannot carry unescaped (row 40, `--account special`; review F10 c).
# The user name holds no colon: the user part of a locator is split at its first colon, so a colon there is
# not expressible to any client that takes the account from a locator. The password holds one, and a literal
# "%40" that a client decoding twice would turn into another character.
SPECIAL_ACCOUNT_USER = "test cam@bench/a%1"
SPECIAL_ACCOUNT_PASSWORD = "synthetic p@ss:w/rd%40 40f2"
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

# Row 152: the place a hostile description names instead of this camera, and the hostile codec name.
OTHER_HOST = "127.0.0.2"  # the loopback net, an address this program never binds; never a name
HOSTILE_CODEC_LENGTH = 300
HOSTILE_CODEC_MARKUP = "<script>alert(1)</script>&\"'<b>"


def hostile_codec_name(real_name):
    """Exactly 300 characters: the real name in lower-case letters, markup characters, lower-case letters to the end."""
    head = real_name.lower() + HOSTILE_CODEC_MARKUP
    return head + "x" * (HOSTILE_CODEC_LENGTH - len(head))


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
        self.reset_on_close = False  # row 40, `--drop-style reset`: the socket is closed without an orderly end
        self.hostile_started = False  # row 186: the `hostile_start` event is stated once per connection
        self.local_port = sock.getsockname()[1]
        self.on_second_port = camera.second_port != 0 and self.local_port == camera.second_port  # row 152

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
        data = ("\r\n".join(lines) + "\r\n\r\n").encode("latin-1") + body
        hostile = self.camera.hostile  # row 186; "none" unless the switch was given
        if hostile == "slow-answers":
            self.hostile_begins()
            if self.gone.wait(self.camera.hostile_delay_ms / 1000.0) or self.camera.stop.is_set():
                raise Closed()
        if hostile == "trickle-answer":
            self.hostile_begins()
            sent = 0
            try:
                for at in range(len(data)):
                    if self.gone.wait(self.camera.hostile_interval_ms / 1000.0) or self.camera.stop.is_set():
                        raise Closed()
                    self.send(data[at:at + 1])
                    sent += 1
            finally:
                self.camera.journal.count("hostile_bytes_sent", sent)
            return
        self.send(data)

    # -- row 186: the hostile modes (each reached only when `--adversary` names it)
    def hostile_begins(self):
        if not self.hostile_started:
            self.hostile_started = True
            self.camera.journal.count("hostile_starts")
            self.camera.journal.emit("hostile_start", conn=self.number, mode=self.camera.hostile)

    def hostile_flood(self, chunks):
        """Sends what `chunks()` yields for as long as the client takes it; the bytes are counted."""
        self.hostile_begins()
        sent = 0
        try:
            while not (self.gone.is_set() or self.camera.stop.is_set()):
                data = chunks()
                self.send(data)
                sent += len(data)
        finally:
            self.camera.journal.count("hostile_bytes_sent", sent)

    def hostile_stream(self, seq, ts):
        """After the pictures of `--adversary-after-frames`: the stream mode of `--adversary`, until the client is gone."""
        camera, codec, mode = self.camera, self.camera.codec, self.camera.hostile
        rtp_channel = self.channels[0]
        other = (rtp_channel + 6) & 0xFF
        frame = lambda channel, payload: struct.pack(">BBH", 0x24, channel, len(payload)) + payload
        state = {"seq": seq}

        def packet(payload_type, marker, payload):
            header = struct.pack(">BBHII", 0x80, (0x80 if marker else 0) | payload_type, state["seq"] & 0xFFFF, ts, camera.ssrc)
            state["seq"] += 1
            return frame(rtp_channel, header + payload)

        if mode == "trickle-stream":
            self.hostile_begins()
            data = packet(PAYLOAD_TYPE, True, camera.clip.unit(camera.inter_index(0), False)[0][:1200])
            sent = 0
            try:
                for at in range(len(data)):
                    if self.gone.wait(camera.hostile_interval_ms / 1000.0) or camera.stop.is_set():
                        break
                    self.send(data[at:at + 1])
                    sent += 1
            finally:
                camera.journal.count("hostile_bytes_sent", sent)
            return
        if mode == "flood-stream":
            block = (frame(other, b"") + frame(rtp_channel, b"") + frame(other, b"\x00" * 8)) * 2048
            self.hostile_flood(lambda: block)
        elif mode == "flood-foreign":
            self.hostile_flood(lambda: b"".join(packet(PAYLOAD_TYPE + 1, True, b"\x41" + b"\xAB" * 31) for _ in range(512)))
        else:  # flood-unmarked: whole units that are not keyframes, one time stamp, never the mark
            unit = (b"\x41" if codec.name == "h264" else b"\x02\x01") + b"\xAB" * 1300
            self.hostile_flood(lambda: b"".join(packet(PAYLOAD_TYPE, False, unit) for _ in range(32)))

    # -- authentication: Digest only (RFC 2617, MD5, no qop)
    def challenge(self):
        """The challenge header lines of a 401 (one line; two in `--challenge both`, the Basic one first)."""
        self.camera.journal.count("challenges_sent")
        mode = self.camera.challenge_mode
        lines = []
        if mode != "digest":  # row 40: a Basic challenge (S13-01); in `basic` mode it is the only one
            self.camera.journal.count("basic_challenges_sent")
            lines.append('WWW-Authenticate: Basic realm="%s"' % REALM)
        if mode != "basic":
            self.nonce = secrets.token_hex(16)
            lines.append('WWW-Authenticate: Digest realm="%s", nonce="%s"' % (REALM, self.nonce))
        return lines

    def basic_carries_account(self, rest):
        """Whether a Basic header holds exactly this camera's account. Used for a COUNT; nothing of it is kept."""
        try:
            given = base64.b64decode(rest.strip(), validate=True)
        except ValueError:
            return False
        return hmac.compare_digest(given, ("%s:%s" % (self.camera.user, self.camera.password)).encode("utf-8"))

    def auth_class(self, method, headers):
        value = headers.get("authorization")
        if not value:
            return "none"
        scheme, _, rest = value.partition(" ")
        if scheme.lower() == "basic":
            if self.basic_carries_account(rest):
                self.camera.journal.count("auth_basic_account_match")
            return "basic"
        if scheme.lower() != "digest":
            return "other"
        given = {m.group(1).lower(): (m.group(2) if m.group(2) is not None else m.group(3))
                 for m in re.finditer(r'(\w+)\s*=\s*(?:"([^"]*)"|([^,\s]+))', rest)}
        md5 = lambda text: hashlib.md5(text.encode("utf-8")).hexdigest()
        expected = md5("%s:%s:%s" % (
            md5("%s:%s:%s" % (self.camera.user, REALM, self.camera.password)), self.nonce or "", md5("%s:%s" % (method, given.get("uri", "")))))
        good = (self.nonce is not None
                and hmac.compare_digest(given.get("username", "").encode("utf-8"), self.camera.user.encode("utf-8"))
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
        if self.on_second_port:  # row 152: whoever is here followed a redirect or a foreign control address
            journal.count("second_port_requests")
            if "authorization" in headers:
                journal.count("second_port_authorized")
        status = self.answer(method, uri, headers, cseq, auth)
        journal.emit("request", conn=self.number, method=method if method in camera.METHODS else "OTHER", auth=auth, status=status)
        return method != "TEARDOWN" or status != 200

    def answer(self, method, uri, headers, cseq, auth):
        camera = self.camera
        if method not in camera.METHODS:
            self.reply(cseq, 405, "Method Not Allowed", ["Allow: " + ", ".join(camera.METHODS)])
            return 405
        if camera.hostile == "flood-answer" and method == "DESCRIBE":  # row 186: frames in the place of the answer
            block = (struct.pack(">BBH", 0x24, 0, 0) + struct.pack(">BBH", 0x24, 7, 4) + b"\x00" * 4) * 4096
            self.hostile_flood(lambda: block)
            return 0
        if method == "OPTIONS":  # answered without an account, as common cameras do
            self.reply(cseq, 200, "OK", ["Public: " + ", ".join(camera.METHODS)])
            return 200
        # Row 152: the redirect, on the first port only (the second port serves the camera to whoever followed).
        redirecting = camera.redirect != "none" and method == "DESCRIBE" and not self.on_second_port
        if redirecting and (camera.redirect == "first" or auth == "digest_ok"):
            camera.journal.count("redirects_sent")
            self.reply(cseq, 302, "Moved Temporarily", ["Location: rtsp://%s:%d%s" % (BIND_HOST, camera.second_port, camera.path)])
            return 302
        if auth != "digest_ok":
            self.reply(cseq, 401, "Unauthorized", self.challenge())
            return 401
        path = re.sub(r"^rtsp://[^/]*", "", uri).split("?", 1)[0].rstrip("/")
        base = "rtsp://%s:%d%s/" % (BIND_HOST, self.local_port, camera.path)
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
            if camera.sdp_control != "track":  # row 152
                camera.journal.count("foreign_control_descriptions")
            if camera.sdp_codec == "hostile":
                camera.journal.count("hostile_codec_descriptions")
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
        # Row 40. `origin`: the clip picture this PLAY begins with (0, or where a dropped stream ended).
        # `held`: picture slots the first keyframe is held back by; `lead`: how many of them are sent as
        # pictures that are not keyframes (`inter`), the rest of the time being silence (`none`).
        origin = camera.position
        held = -(-camera.first_keyframe_delay_ms * camera.fps // 1000)
        lead = held if camera.first_keyframe_fill == "inter" else 0
        fault_fields = camera.fault_fields(origin)
        journal.count("streams_started")
        journal.emit("stream_start", conn=self.number, **fault_fields)
        try:
            while camera.frames == 0 or sent < lead + camera.frames:
                slot = sent if sent < lead else sent - lead + held  # the place of this picture on the time axis
                wait = started + slot / camera.fps - time.monotonic()
                if wait > 0 and (self.gone.wait(wait) or camera.stop.is_set()):
                    reason = "stopped"
                    break
                if self.gone.is_set() or camera.stop.is_set():
                    reason = "stopped"
                    break
                if camera.drop_after and sent - lead == camera.drop_after and camera.claim_drop(origin + sent - lead):
                    reason = "fault_drop"  # in mid group, with no TEARDOWN and no warning
                    self.reset_on_close = camera.drop_style == "reset"
                    break
                ts = (first_ts + slot * per_frame) & 0xFFFFFFFF
                if camera.hostile in camera.HOSTILE_STREAM and sent - lead == camera.hostile_after:  # row 186
                    reason = "hostile"
                    self.hostile_stream(seq, ts)
                    break
                out = bytearray()
                if slot % camera.fps == 0 or sent == 0:  # a sender report every second, the first before the first picture
                    ntp = wall0 + slot / camera.fps + NTP_EPOCH_S
                    report = struct.pack(">BBHIIIIII", 0x80, 200, 6, camera.ssrc, int(ntp) & 0xFFFFFFFF,
                                         int((ntp % 1) * (1 << 32)) & 0xFFFFFFFF, ts, packets & 0xFFFFFFFF, octets & 0xFFFFFFFF)
                    out += struct.pack(">BBH", 0x24, rtcp_channel, len(report)) + report
                if sent < lead:  # before the first keyframe: a picture that is not one, and no parameter set
                    index = camera.inter_index(sent)
                    nals = camera.clip.unit(index, False)
                else:
                    index = origin + sent - lead
                    nals = camera.clip.unit(index, with_sets)
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
                keyframes += 1 if camera.clip.keys[index % len(camera.clip.units)] else 0
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
        if fault_fields:
            fault_fields = dict(fault_fields, pre_keyframe_frames_sent=min(sent, lead))
            journal.count("pre_keyframe_frames_sent", min(sent, lead))
            if reason == "fault_drop":
                journal.count("streams_dropped")
                fault_fields.update(next_index=camera.position, drop_style=camera.drop_style)
        journal.emit("stream_end", conn=self.number, reason=reason, frames_sent=sent, keyframes_sent=keyframes,
                     rtp_packets=packets, parameter_set_nals_sent=set_nals, **fault_fields)
        if reason != "stopped":  # the stream is over: the camera ends the connection, the client sees its end
            self.close()

    def close(self):
        self.gone.set()
        if self.reset_on_close:  # row 40: no orderly end; `run` closes the socket, which sends the reset
            try:
                self.sock.setsockopt(socket.SOL_SOCKET, socket.SO_LINGER, struct.pack("ii", 1, 0))
            except OSError:
                pass
            return
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
    HOSTILE_STREAM = ("trickle-stream", "flood-stream", "flood-foreign", "flood-unmarked")  # row 186
    HOSTILE = ("none", "trickle-answer", "flood-answer", "slow-answers") + HOSTILE_STREAM

    def __init__(self, args, clip, journal):
        # Row 186, the hostile modes; "none" unless `--adversary` was given.
        self.hostile, self.hostile_after = args.hostile, args.hostile_after_frames
        self.hostile_interval_ms, self.hostile_delay_ms = args.hostile_interval_ms, args.hostile_delay_ms
        self.codec, self.clip, self.journal = clip.codec, clip, journal
        self.param_sets, self.path = args.param_sets, args.path
        self.width, self.height, self.fps, self.gop, self.frames = args.width, args.height, args.fps, args.gop, args.frames
        self.ssrc = secrets.randbits(32)
        # Row 40, the fault modes; each is off unless its switch was given.
        self.challenge_mode = args.challenge
        special = args.account == "special"
        self.user = SPECIAL_ACCOUNT_USER if special else ACCOUNT_USER
        self.password = SPECIAL_ACCOUNT_PASSWORD if special else ACCOUNT_PASSWORD
        self.first_keyframe_delay_ms, self.first_keyframe_fill = args.first_keyframe_delay_ms, args.first_keyframe_fill
        self.drop_after, self.drop_style = args.drop_after_frames, args.drop_style
        self.drops_left = args.drop_count if args.drop_after_frames else 0
        self.position = 0  # the clip picture the next PLAY begins with; moved only by a drop
        self.fault_lock = threading.Lock()
        self.stop = threading.Event()
        self.connections = []
        # Row 152: the redirect and the hostile descriptions; off unless their switches were given.
        self.redirect, self.sdp_control, self.sdp_codec = args.redirect, args.sdp_control, args.sdp_codec
        self.second_port = 0
        self.second_listener = None
        self.listener = None
        try:
            # The first port, then (row 152, `--second-port`) the second: both through the one bind below.
            for port in [args.port] + ([args.second_port] if args.second_port else []):
                listener = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                listener.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
                listener.bind((BIND_HOST, port))  # the ONE bind of this program
                listener.listen(8)
                listener.settimeout(0.5)
                if self.listener is None:
                    self.listener = listener
                else:
                    self.second_listener = listener
        except OSError:
            if self.listener is not None:  # the second port could not be taken: no listener is left
                self.listener.close()
            raise
        self.port = self.listener.getsockname()[1]
        if self.second_listener is not None:
            self.second_port = self.second_listener.getsockname()[1]

    # -- row 40: the stream faults
    def fault_fields(self, origin):
        """What a stream event states about the stream faults; empty (no extra member) when none is switched on."""
        if not self.first_keyframe_delay_ms and not self.drop_after:
            return {}
        return {"first_index": origin, "first_index_is_keyframe": origin % self.gop == 0,
                "first_keyframe_delay_ms": self.first_keyframe_delay_ms}

    def inter_index(self, count):
        """The clip picture sent as the `count`-th picture before the first keyframe: never a keyframe."""
        return 1 + count % (self.gop - 1)

    def claim_drop(self, next_index):
        """True when this stream is one of the streams to drop; the next PLAY then begins with `next_index`."""
        with self.fault_lock:
            if self.drops_left <= 0:
                return False
            self.drops_left -= 1
            self.position = next_index
            return True

    def description(self):
        # Row 152: the codec name and the media control address as the switches say; the base camera's otherwise.
        codec_name = {"real": self.codec.rtp_name, "lower": self.codec.rtp_name.lower(), "hostile": hostile_codec_name(self.codec.rtp_name)}[self.sdp_codec]
        control = {"track": TRACK,
                   "other-port": "rtsp://%s:%d%s/%s" % (BIND_HOST, self.second_port, self.path, TRACK),
                   "other-host": "rtsp://%s:%d%s/%s" % (OTHER_HOST, self.port, self.path, TRACK)}[self.sdp_control]
        lines = ["v=0", "o=- %d 1 IN IP4 %s" % (self.ssrc, BIND_HOST), "s=DEMS test camera", "c=IN IP4 0.0.0.0", "t=0 0",
                 "a=control:*", "a=range:npt=0-", "m=video 0 RTP/AVP %d" % PAYLOAD_TYPE,
                 "a=rtpmap:%d %s/%d" % (PAYLOAD_TYPE, codec_name, CLOCK)]
        fmtp = fmtp_line(self.codec, self.clip, self.param_sets)
        if fmtp:
            lines.append(fmtp)
        lines += ["a=framerate:%d" % self.fps, "a=control:" + control]
        return "\r\n".join(lines) + "\r\n"

    def serve(self, deadline):
        number = 0
        while not self.stop.is_set():
            if time.monotonic() >= deadline:
                self.journal.emit("deadline", level="warn")
                break
            try:
                if self.second_listener is None:
                    sock, peer = self.listener.accept()
                else:  # row 152: whichever of the two listeners has a caller
                    waiting, _, _ = select.select([self.listener, self.second_listener], [], [], 0.5)
                    if not waiting:
                        continue
                    sock, peer = waiting[0].accept()
                    if waiting[0] is self.second_listener:
                        self.journal.count("second_port_connections")
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
        if self.second_listener is not None:
            self.second_listener.close()
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
    faults = parser.add_argument_group("fault modes (row 40); each is off by default")
    faults.add_argument("--challenge", choices=("digest", "basic", "both"), default="digest",
                        help="basic: a Basic challenge only, nothing is ever granted; both: Basic and Digest offered, Digest granted")
    faults.add_argument("--first-keyframe-delay-ms", type=int, default=0, help="the first keyframe of every PLAY comes this late")
    faults.add_argument("--first-keyframe-fill", choices=("inter", "none"), default="inter",
                        help="what is sent before the delayed keyframe: pictures that are not keyframes, or nothing")
    faults.add_argument("--drop-after-frames", type=int, default=0,
                        help="end the connection after this many pictures of a PLAY; the next PLAY goes on with the next picture")
    faults.add_argument("--drop-count", type=int, default=1, help="how many streams are dropped (with --drop-after-frames)")
    faults.add_argument("--drop-style", choices=("fin", "reset"), default="fin", help="how the dropped connection ends")
    faults.add_argument("--account", choices=("plain", "special"), default="plain",
                        help="special: the account whose values hold @ / %% and a space (the password a colon too)")
    hostile = parser.add_argument_group("hostile modes (row 186); off by default")
    # The names begin with `--adversary`, not `--host...`: no option of this camera may be a longer spelling of
    # `--host` (the bind rule of rtsp_test_camera_check.py asks that `--host` is an option this program does not know).
    hostile.add_argument("--adversary", dest="hostile", choices=Camera.HOSTILE, default="none",
                         help="a camera that tries to hold its client: answers in single bytes, frames in the place of an answer, late answers, "
                              "or after --adversary-after-frames pictures a trickle or a flood of what a client drops")
    hostile.add_argument("--adversary-after-frames", dest="hostile_after_frames", type=int, default=0, help="pictures of a PLAY before a stream mode of --adversary begins")
    hostile.add_argument("--adversary-interval-ms", dest="hostile_interval_ms", type=int, default=99, help="the pause between two bytes of a trickle")
    hostile.add_argument("--adversary-delay-ms", dest="hostile_delay_ms", type=int, default=4500, help="how late every answer of slow-answers comes")
    elsewhere = parser.add_argument_group("the redirect and the hostile descriptions (row 152); off by default")
    elsewhere.add_argument("--second-port", type=int, default=0, help="a second loopback listener of this camera: whoever arrives there followed a redirect or a foreign control address")
    elsewhere.add_argument("--redirect", choices=("none", "first", "authenticated"), default="none",
                           help="DESCRIBE is answered 302 to the second port: at once, or after the right Digest answer")
    elsewhere.add_argument("--sdp-control", choices=("track", "other-port", "other-host"), default="track",
                           help="the media control address of the description: this camera's track, the second port, or the address 127.0.0.2")
    elsewhere.add_argument("--sdp-codec", choices=("real", "lower", "hostile"), default="real",
                           help="the codec name of the description: the real one, lower-case, or 300 characters with markup")
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
    if not 0 <= args.first_keyframe_delay_ms <= 120000:
        refuse("--first-keyframe-delay-ms must be 0 to 120000")
    if args.first_keyframe_delay_ms and args.first_keyframe_fill == "inter" and args.gop < 2:
        refuse("--first-keyframe-fill inter needs a group of at least 2 pictures")
    if args.drop_after_frames < 0 or not 1 <= args.drop_count <= 100:
        refuse("--drop-after-frames or --drop-count out of range")
    if any(k * args.drop_after_frames % args.gop == 0 for k in range(1, args.drop_count + 1)) and args.drop_after_frames:
        refuse("every drop must fall inside a group: k x --drop-after-frames must not be a multiple of --gop")
    if args.hostile_after_frames < 0 or not 1 <= args.hostile_interval_ms <= 10000 or not 1 <= args.hostile_delay_ms <= 60000:
        refuse("--adversary-after-frames, --adversary-interval-ms or --adversary-delay-ms out of range")
    # Row 152: the second port is held to the same rule as the first, before any socket.
    if args.second_port:
        if not 1 <= args.second_port <= 65535 or args.second_port == args.port or port_refusal(args.second_port):
            refuse("--second-port: " + (port_refusal(args.second_port) or "a loopback port of its own, 1 to 65535, not the first port"))
    elif args.redirect != "none" or args.sdp_control == "other-port":
        refuse("--redirect and --sdp-control other-port need --second-port")

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

    # The `ready` line of the base camera is unchanged; a camera with a fault switch adds ONE member, `faults`.
    fault_state = {}
    if args.challenge != "digest":
        fault_state["challenge"] = args.challenge
    if args.first_keyframe_delay_ms:
        fault_state.update(first_keyframe_delay_ms=args.first_keyframe_delay_ms, first_keyframe_fill=args.first_keyframe_fill)
    if args.drop_after_frames:
        fault_state.update(drop_after_frames=args.drop_after_frames, drop_count=args.drop_count, drop_style=args.drop_style)
    if args.account != "plain":
        fault_state["account"] = args.account
    if args.hostile != "none":  # row 186
        fault_state.update(hostile=args.hostile, hostile_after_frames=args.hostile_after_frames)
    if args.second_port:  # row 152
        fault_state["second_port"] = camera.second_port
    if args.redirect != "none":
        fault_state["redirect"] = args.redirect
    if args.sdp_control != "track":
        fault_state["sdp_control"] = args.sdp_control
    if args.sdp_codec != "real":
        fault_state["sdp_codec"] = args.sdp_codec
    journal.emit("ready", pid=os.getpid(), host=BIND_HOST, port=camera.port, path=camera.path, codec=codec.name,
                 param_sets=args.param_sets, width=args.width, height=args.height, fps=args.fps, gop=args.gop,
                 clip_frames=args.clip_frames, frames_per_play=args.frames,
                 authentication={"digest": "digest", "basic": "basic", "both": "basic+digest"}[args.challenge], transport="tcp-interleaved",
                 **({"faults": fault_state} if fault_state else {}))
    camera.serve(time.monotonic() + args.max_seconds)
    journal.emit("exit", counters=dict(sorted(journal.counters.items())))
    return 0


if __name__ == "__main__":
    sys.exit(main())
