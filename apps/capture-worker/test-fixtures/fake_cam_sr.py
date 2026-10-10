#!/usr/bin/env python3
"""NM-14 fake camera with HAND-WRITTEN sender reports (blueprint row 62; capture spec A.8 (2) and F,
errata PE-111-01 / PE-111-05; test strategy M3-AV-2 case (c)).

Why a second fake camera. `fake_cam.c` pushes through libavformat, whose RTP writer derives the RTP
timestamp of every sender report linearly from the host time: its reports carry NO rate information,
so a drifting camera cannot be told from a steady one by them. This program writes the RTSP dialogue,
the RTP packets and the RTCP sender reports itself, so the pair (wall clock, media clock) of each
report is exactly what the camera model says.

Camera model (integer microseconds; CLOCK_REALTIME of this host is "true time"):
    frame k leaves the sensor at TRUE time     true_k  = epoch + k * 20000 * (1 + drift_ppm * 1e-6)
    its RTP timestamp (the MEDIA clock) is     rtp_k   = base + k * 1800          (90 kHz, 50 fps)
    the camera's WALL clock reads, at true t,  wall(t) = t + clock_offset (+ clock_step from step_at on)
A sender report is sent before every `--sr-every` frames, for the frame that follows it:
    --sr true     NTP = wall(true_k),              RTP = rtp_k   the wall clock is paired with the DRIFTING
                                                                 media clock: the reports express the drift
    --sr linear   NTP = wall(epoch) + k * 20000,   RTP = rtp_k   what libavformat's writer does: no rate
                                                                 information (the negative control)
`--delay-ms` hands every frame to the network that much later than it left the sensor (a steady encode
and network delay); the reports still state the sensor time.

Video: the same picture as fake_cam.c (320x240, 50 fps, luma 16, exactly one white frame at
flash_first + j * flash_every, no B-frames, one slice per frame), encoded once before the stream
starts with the ffmpeg program into the run folder, then sent frame by frame at its true time.

It CONNECTS to an RTSP receiver on 127.0.0.1 over TCP (interleaved RTP, S1 section 3 shape), ends with
TEARDOWN, opens no receiving socket of its own and refuses any URL that is not
rtsp://127.0.0.1:<port>/... (SEC35-23). Python standard library and the installed ffmpeg only.
"""
import argparse, base64, os, shutil, socket, struct, subprocess, sys, time

FPS, FRAME_US, RTP_PER_FRAME, NTP_EPOCH_S = 50, 20000, 1800, 2208988800
FF = os.environ.get("DEMS_FFMPEG") or shutil.which("ffmpeg") or "/opt/homebrew/bin/ffmpeg"
MTU, SSRC, PT = 1400, 0x62C0FFEE, 96


def die(code, text):
    sys.stderr.write("FAKE_CAM_SR FATAL %s\n" % text)
    sys.exit(code)


def real_us():
    return time.time_ns() // 1000


def encode(path, frames, flash_first, flash_every, gop):
    """The whole stream as H.264 Annex B, one slice per frame, parameter sets once at the head."""
    flash = "gte(n\\,%d)*eq(mod(n-%d\\,%d)\\,0)" % (flash_first, flash_first, flash_every)
    cmd = [FF, "-v", "error", "-y", "-f", "lavfi", "-i", "color=c=black:s=320x240:r=%d" % FPS, "-frames:v", str(frames),
           "-vf", "drawbox=x=0:y=0:w=iw:h=ih:color=white:t=fill:enable='%s',format=yuv420p" % flash,
           "-c:v", "libx264", "-preset", "ultrafast", "-tune", "zerolatency", "-threads", "1",
           "-x264-params", "scenecut=0:keyint=%d:min-keyint=%d:sliced-threads=0:slices=1:bframes=0:aud=0" % (gop, gop),
           "-bsf:v", "h264_mp4toannexb", "-f", "h264", path]
    r = subprocess.run(cmd, stdin=subprocess.DEVNULL, capture_output=True, text=True)
    if r.returncode != 0:
        die(1, "encode: %s" % r.stderr.strip()[-300:])


def access_units(path, frames):
    """([non-VCL NAL units before the first picture], [the ONE picture NAL unit of each frame])."""
    data = open(path, "rb").read()
    nals, i, n = [], 0, len(data)
    starts = []
    while True:
        j = data.find(b"\x00\x00\x01", i)
        if j < 0:
            break
        starts.append(j)
        i = j + 3
    for a, b in zip(starts, starts[1:] + [n]):
        nal = data[a + 3:b].rstrip(b"\x00") if b < n else data[a + 3:b]
        if nal:
            nals.append(nal)
    sps = [x for x in nals if x[0] & 31 == 7]
    pps = [x for x in nals if x[0] & 31 == 8]
    pictures = [x for x in nals if x[0] & 31 in (1, 5)]
    if not sps or not pps or len(pictures) != frames:
        die(1, "the encoded stream has %d picture units for %d frames (one slice per frame is required), %d SPS, %d PPS" % (len(pictures), frames, len(sps), len(pps)))
    return sps[0], pps[0], pictures


def rtp_packets(nal, seq, ts):
    """One NAL unit as RTP: a single-NAL packet, or FU-A fragments (RFC 6184); the marker closes the frame."""
    def head(marker, s):
        return struct.pack("!BBHII", 0x80, (0x80 if marker else 0) | PT, s & 0xFFFF, ts & 0xFFFFFFFF, SSRC)
    if len(nal) <= MTU:
        return [head(True, seq) + nal]
    out, body, first = [], nal[1:], True
    while body:
        part, body = body[:MTU - 2], body[MTU - 2:]
        fu = bytes([(nal[0] & 0xE0) | 28, (0x80 if first else 0) | (0x40 if not body else 0) | (nal[0] & 31)])
        out.append(head(not body, seq + len(out)) + fu + part)
        first = False
    return out


def sender_report(ntp_us, rtp_ts, packets, octets):
    sec, frac = divmod(ntp_us, 1000000)
    return struct.pack("!BBHIIIIII", 0x80, 200, 6, SSRC, (sec + NTP_EPOCH_S) & 0xFFFFFFFF, (frac << 32) // 1000000, rtp_ts & 0xFFFFFFFF, packets & 0xFFFFFFFF, octets & 0xFFFFFFFF)


def framed(channel, packet):
    return b"$" + bytes([channel]) + struct.pack("!H", len(packet)) + packet


class Rtsp:
    def __init__(self, host, port):
        self.sock, self.cseq, self.session, self.buf = socket.create_connection((host, port), timeout=5), 0, None, b""
        self.sock.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)

    def request(self, method, url, headers=(), body=b""):
        self.cseq += 1
        lines = ["%s %s RTSP/1.0" % (method, url), "CSeq: %d" % self.cseq, "User-Agent: dems-fake-cam-sr"] + list(headers)
        if self.session:
            lines.append("Session: %s" % self.session)
        if body:
            lines.append("Content-Length: %d" % len(body))
        self.sock.sendall(("\r\n".join(lines) + "\r\n\r\n").encode() + body)
        while b"\r\n\r\n" not in self.buf:
            more = self.sock.recv(4096)
            if not more:
                die(1, "%s: the receiver closed the connection" % method)
            self.buf += more
        reply, _, self.buf = self.buf.partition(b"\r\n\r\n")
        text = reply.decode("latin-1")
        if not text.startswith("RTSP/1.0 200"):
            die(1, "%s refused: %s" % (method, text.splitlines()[0] if text else "no answer"))
        for line in text.splitlines()[1:]:
            name, _, value = line.partition(":")
            if name.strip().lower() == "session":
                self.session = value.strip().split(";")[0]
        return text


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", required=True)
    ap.add_argument("--epoch-us", type=int, required=True)
    ap.add_argument("--work", required=True, help="folder for the encoded stream (the run folder)")
    ap.add_argument("--frames", type=int, default=500)
    ap.add_argument("--flash-first", type=int, default=100)
    ap.add_argument("--flash-every", type=int, default=100)
    ap.add_argument("--gop", type=int, default=FPS)
    ap.add_argument("--drift-ppm", type=float, default=0.0, help="the media clock runs this much fast against true time")
    ap.add_argument("--sr", choices=["true", "linear"], default="true")
    ap.add_argument("--sr-every", type=int, default=25, help="a sender report before every N frames")
    ap.add_argument("--clock-offset-ms", type=float, default=0.0, help="the camera's wall clock is this far ahead of true time")
    ap.add_argument("--clock-step-ms", type=float, default=0.0, help="the wall clock steps by this much ...")
    ap.add_argument("--clock-step-at-s", type=float, default=0.0, help="... this many seconds after the epoch")
    ap.add_argument("--delay-ms", type=float, default=0.0, help="every frame reaches the network this long after it left the sensor")
    ap.add_argument("--repeat-ts-at", type=int, default=0, help="frame N carries the RTP timestamp of frame N-1 (a camera that repeats a timestamp; review R63-11)")
    a = ap.parse_args()
    if not a.url.startswith("rtsp://127.0.0.1:"):
        die(2, "the URL must be rtsp://127.0.0.1:<port>/<name>")
    port = int(a.url[len("rtsp://127.0.0.1:"):].split("/")[0])

    name = "fake_cam_sr_%d.h264" % port
    encode(os.path.join(a.work, name), a.frames, a.flash_first, a.flash_every, a.gop)
    sps, pps, pictures = access_units(os.path.join(a.work, name), a.frames)

    track = a.url + "/streamid=0"
    sdp = "\r\n".join([
        "v=0", "o=- 0 0 IN IP4 127.0.0.1", "s=DEMS fake camera with hand-written sender reports", "c=IN IP4 127.0.0.1", "t=0 0",
        "m=video 0 RTP/AVP %d" % PT, "a=rtpmap:%d H264/90000" % PT,
        "a=fmtp:%d packetization-mode=1; sprop-parameter-sets=%s,%s; profile-level-id=%s" % (PT, base64.b64encode(sps).decode(), base64.b64encode(pps).decode(), sps[1:4].hex().upper()),
        "a=control:%s" % track, ""]).encode()

    rtsp = None
    for _ in range(50):                                   # wait for the receiver
        try:
            rtsp = Rtsp("127.0.0.1", port)
            break
        except OSError:
            time.sleep(0.1)
    if rtsp is None:
        die(1, "no receiver on 127.0.0.1:%d" % port)
    rtsp.request("ANNOUNCE", a.url, ["Content-Type: application/sdp"], sdp)
    rtsp.request("SETUP", track, ["Transport: RTP/AVP/TCP;unicast;interleaved=0-1;mode=record"])
    rtsp.request("RECORD", a.url, ["Range: npt=0.000-"])
    sys.stderr.write("FAKE_CAM_SR CONNECTED pid=%d lead_ms=%d sr=%s drift_ppm=%g\n" % (os.getpid(), (a.epoch_us - real_us()) // 1000, a.sr, a.drift_ppm))
    if real_us() > a.epoch_us:
        die(3, "connected after the epoch (host too slow); rerun")

    rate = 1.0 + a.drift_ppm * 1e-6
    offset_us, step_us, step_at_us, delay_us = int(a.clock_offset_ms * 1000), int(a.clock_step_ms * 1000), a.epoch_us + int(a.clock_step_at_s * 1e6), int(a.delay_ms * 1000)

    def wall(true_us):
        return true_us + offset_us + (step_us if step_us and true_us >= step_at_us else 0)

    base, seq, sent_packets, sent_octets, max_late, reports = 90000, 1, 0, 0, 0, 0
    for k, picture in enumerate(pictures):
        true_k = a.epoch_us + int(k * FRAME_US * rate + 0.5)
        ts = base + (k - 1 if a.repeat_ts_at and k == a.repeat_ts_at else k) * RTP_PER_FRAME
        wait = true_k + delay_us - real_us()
        if wait > 0:
            time.sleep(wait / 1e6)
        elif -wait > max_late:
            max_late = -wait
        out = b""
        if k % a.sr_every == 0:
            ntp = wall(true_k) if a.sr == "true" else wall(a.epoch_us) + k * FRAME_US
            out += framed(1, sender_report(ntp, ts, sent_packets, sent_octets))
            reports += 1
        units = ([sps, pps] if picture[0] & 31 == 5 else []) + [picture]
        for unit in units:
            for packet in rtp_packets(unit, seq, ts):
                # Only the last packet of the frame keeps the marker.
                if unit is not picture:
                    packet = packet[:1] + bytes([packet[1] & 0x7F]) + packet[2:]
                out += framed(0, packet)
                seq += 1
                sent_packets += 1
                sent_octets += len(packet) - 12
        try:
            rtsp.sock.sendall(out)
        except OSError as e:
            die(1, "send failed at frame %d: %s" % (k, e))
    try:                                                  # the answer is not waited for: libavformat's receiver ends the session on it (and answers 501)
        rtsp.sock.sendall(("TEARDOWN %s RTSP/1.0\r\nCSeq: %d\r\nSession: %s\r\n\r\n" % (a.url, rtsp.cseq + 1, rtsp.session or "")).encode())
        rtsp.sock.shutdown(socket.SHUT_WR)
        rtsp.sock.settimeout(2)
        while rtsp.sock.recv(4096):
            pass
    except OSError:
        pass                                              # a receiver that ended first has nothing left to tear down
    sys.stderr.write("FAKE_CAM_SR DONE frames=%d reports=%d max_late_us=%d\n" % (len(pictures), reports, max_late))


if __name__ == "__main__":
    main()
