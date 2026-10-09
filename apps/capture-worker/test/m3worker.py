#!/usr/bin/env python3
"""Row 58 harness: the REAL capture worker on fake devices (blueprint row 58; checks M3-WI-1,
M3-KC-1 file half, M3-RTSP-BIND-1 worker half, the row-111 H-4 / H-10 regressions, the mux-flag
evaluation of part P4). Test code only. Run from the repository root, sandbox off (it binds
127.0.0.1:8555 and 127.0.0.1:8557):

    python3 apps/capture-worker/test/m3worker.py build
    python3 apps/capture-worker/test/m3worker.py <case> <run name> [options]

Sources: two fake cameras (the row-111 `fake_cam`, a separate process each, RTSP push over TCP) and
the fake mics of `fake_mic.c` (ONE separate process with its own clock reads; capture spec W-5).
This script is the supervisor's stand-in for the worker-level cases: it speaks
@dems/capture-protocol on the worker's standard streams, with an EMPTY environment. The cases that
need the real supervisor go through `apps/core-server/test/support/capture-session-driver.ts`
(sub-command `sup`).

Everything a run writes lands under .cache/m3worker/ (git-ignored): 0 media in git (OD-25).
Every check prints one JSON result with "verdict"; a negative control must FAIL and is run with
--expect-fail, which turns its failure into exit 0 and its success into exit 1.
"""
import argparse, hashlib, json, os, shutil, signal, struct, subprocess, sys, threading, time
from fractions import Fraction

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
APP = os.path.join(REPO, "apps", "capture-worker")
BUILD = os.path.join(APP, "build")
EVID = os.path.join(REPO, "docs", "2026-10-07_dems_real_capture_sealing", "implementation", "evidence", "59_m3proof")
RUNS = os.path.join(REPO, ".cache", "m3worker", "runs")
WORKER = os.path.join(BUILD, "capture-worker")
VARIANTS = {"worker": WORKER, "negctl": os.path.join(BUILD, "capture-worker-negctl"), "delaymoov": os.path.join(BUILD, "capture-worker-delaymoov"),
            "skeleton": os.path.join(BUILD, "capture-worker-skeleton111"), "norefusal": os.path.join(BUILD, "capture-worker-norefusal"), "nocomp": os.path.join(BUILD, "capture-worker-nocomp")}
CAM, MIC = os.path.join(BUILD, "fake_cam"), os.path.join(BUILD, "fake_mic")
DRIVER = os.path.join(REPO, "apps", "core-server", "test", "support", "capture-session-driver.ts")
PORTS = (8555, 8557)            # 8554 / 8556 / 8558 belong to the Android emulators: never touched
V = 2                           # CAPTURE_PROTOCOL_VERSION
FPS, FRAME_US, SR = 50, 20000, 48000
REGRESSION_MS, PRODUCT_MS = 2.0, 40.0      # two different tolerances (AU2-04): never merged
PRIMING = 1024
CASES = {  # per camera: (injected offset ms, drift ppm); flash/beep events per camera
    "zero": {"cams": [(0, 0.0), (0, 0.0)], "events": 3},
    "pm80": {"cams": [(80, 0.0), (-80, 0.0)], "events": 3},
    "drift": {"cams": [(0, 200.0), (0, -200.0)], "events": 8},
    "long": {"cams": [(0, 0.0), (0, 0.0)], "events": 8},
}

sys.dont_write_bytecode = True      # the analysers are imported from the docs tree: no cache file is left there
sys.path.insert(0, EVID)
import m3proof as P111          # the row-111 analysers (committed evidence copy): box walk, packets, onsets, flashes
FF, FP = P111.FF, P111.FP


def sh(cmd, **kw):
    return subprocess.run(cmd, capture_output=True, text=True, **kw)


def rundir(name, fresh=False):
    d = os.path.join(RUNS, name)
    if fresh and os.path.isdir(d):
        shutil.rmtree(d)
    os.makedirs(d, exist_ok=True)
    return d


def tcp_listeners():
    txt = sh(["lsof", "-nP", "-iTCP", "-sTCP:LISTEN"]).stdout
    return [l for l in txt.splitlines() if any(l.rstrip().endswith(":%d (LISTEN)" % p) for p in PORTS)]


def sockets_of(pid):
    """Every internet socket of one process, TCP and UDP (M3-RTSP-BIND-1 as widened by erratum PE-111-03)."""
    rows = [l for l in sh(["lsof", "-nP", "-a", "-p", str(pid), "-i"]).stdout.splitlines()[1:] if l.strip()]
    udp = [l for l in rows if " UDP " in l]
    off = [l for l in rows if "127.0.0.1:" not in l]
    return {"rows": rows, "udp": udp, "not_loopback": off}


def leftovers():
    """Processes of this harness that are still alive, by the NAME OF THE PROGRAM (a shell or an editor whose
    command line merely mentions one of the names is not one of them), and listeners on the two media ports."""
    ours = {os.path.basename(v) for v in VARIANTS.values()} | {"fake_cam", "fake_mic"}
    found = []
    for line in sh(["ps", "-axo", "pid=,args="]).stdout.splitlines():
        parts = line.split()
        if len(parts) < 2:
            continue
        program = os.path.basename(parts[1])
        if program in ours or (program in ("node", "tsx") and "capture-session-driver.ts" in line):
            found.append(line.strip()[:160])
    return {"processes": found, "listeners": tcp_listeners()}


def finish(result, ok, expect_fail=False, d=None):
    result["verdict"] = "PASS" if ok else "FAIL"
    if expect_fail:
        result["negative_control"] = "failed as required" if not ok else "DID NOT FAIL - the control is broken"
    if d:
        json.dump(result, open(os.path.join(d, "result.json"), "w"), indent=1)
    print(json.dumps(result, indent=1))
    sys.exit(0 if (ok != expect_fail) else 1)


# ------------------------------------------------------------------------------------------ build
def cmd_build(_):
    os.makedirs(BUILD, exist_ok=True)
    subprocess.run(["make", "-C", APP], check=True)
    subprocess.run(["make", "-C", APP, "proof"], check=True)
    av = subprocess.run(["pkg-config", "--cflags", "--libs", "libavformat", "libavcodec", "libavutil"], capture_output=True, text=True, check=True).stdout.split()
    subprocess.run(["clang", "-O2", "-Wall", "-Wextra", "-o", CAM, os.path.join(EVID, "fake_cam.c")] + av + ["-lm"], check=True)
    subprocess.run(["clang", "-std=c11", "-O2", "-Wall", "-Wextra", "-Werror", "-o", MIC, os.path.join(HERE, "fake_mic.c"), "-lm"], check=True)
    # The row-111 skeleton as committed at 101ce62: the binary the widened bind check must FAIL on.
    src = subprocess.run(["git", "-C", REPO, "show", "101ce62:apps/capture-worker/src/capture_worker.c"], capture_output=True, text=True, check=True).stdout
    skel = os.path.join(BUILD, "skeleton111.c")
    open(skel, "w").write(src)
    avf = subprocess.run(["pkg-config", "--cflags", "--libs", "libavformat", "libavcodec", "libavfilter", "libavutil"], capture_output=True, text=True, check=True).stdout.split()
    subprocess.run(["clang", "-std=c11", "-O2", "-o", VARIANTS["skeleton"], skel] + avf + ["-lm", "-lpthread"], check=True)
    print(json.dumps({"built": sorted(os.listdir(BUILD))}))


# ------------------------------------------------------------------------------------------ the worker under test
class Worker:
    """One worker process driven over its standard streams, with an EMPTY environment (protocol rule)."""

    def __init__(self, d, binary=WORKER, heartbeat_ms=500, listen_timeout_s=12, manifest=True):
        self.d, self.frames, self.raw, self.lock = d, [], [], threading.Lock()
        args = [binary, "--log", os.path.join(d, "worker.jsonl"), "--heartbeat-ms", str(heartbeat_ms), "--listen-timeout-s", str(listen_timeout_s)]
        if manifest:
            args += ["--audio-manifest", os.path.join(d, "manifest.jsonl")]
        self.t_spawn = time.monotonic()
        self.p = subprocess.Popen(args, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, env={}, start_new_session=True)
        self.seq = 0
        threading.Thread(target=self._read, daemon=True).start()

    def _read(self):
        for line in self.p.stdout:
            t = time.monotonic()
            text = line.decode("utf-8", "replace").rstrip("\n")
            try:
                f = json.loads(text)
            except ValueError:
                f = None
            with self.lock:
                self.raw.append(text)
                self.frames.append((t, f))

    def send(self, obj):
        self.p.stdin.write((json.dumps(obj) + "\n").encode())
        self.p.stdin.flush()

    def command(self, sid, type_, **more):
        self.seq += 1
        corr = "cap:%s:1:%d" % (sid, self.seq)
        self.send({"v": V, "sessionId": sid, "correlationId": corr, "type": type_, **more})
        return corr

    def of(self, type_):
        with self.lock:
            return [(t, f) for t, f in self.frames if f and f.get("type") == type_]

    def wait(self, pred, timeout, what):
        end = time.monotonic() + timeout
        while time.monotonic() < end:
            with self.lock:
                hit = [(t, f) for t, f in self.frames if f and pred(f)]
            if hit:
                return hit[0]
            if self.p.poll() is not None:
                time.sleep(0.2)
                with self.lock:
                    hit = [(t, f) for t, f in self.frames if f and pred(f)]
                if hit:
                    return hit[0]
                raise RuntimeError("worker exited (rc %s) while waiting for %s" % (self.p.returncode, what))
            time.sleep(0.01)
        raise RuntimeError("timeout waiting for %s" % what)

    def ack(self, corr, timeout=5):
        return self.wait(lambda f: f.get("type") == "ACK" and f.get("correlationId") == corr, timeout, "ACK " + corr)

    def exit(self, timeout=20):
        try:
            return self.p.wait(timeout=timeout)
        except subprocess.TimeoutExpired:
            return None

    def kill(self):
        if self.p.poll() is None:
            try:
                os.killpg(self.p.pid, signal.SIGKILL)
            except (ProcessLookupError, PermissionError):     # gone already (macOS answers EPERM for a group of zombies)
                pass
            self.p.wait()

    def not_frames(self):
        with self.lock:
            return [r for r, (_, f) in zip(self.raw, self.frames) if f is None or f.get("v") != V or "type" not in f]


def make_plan(d, sid, cams=2, mics=2, tap=None, names=("cam1", "cam2")):
    os.makedirs(os.path.join(d, "media"), exist_ok=True)
    fifos = []
    for i in range(mics):
        p = os.path.join(d, "mic%d.pcm" % (i + 1))
        if not os.path.exists(p):
            os.mkfifo(p, 0o600)
        fifos.append(p)
    return {
        "cameras": [{"deviceId": "CAM-0%d" % (i + 1), "trackId": "VIDEO-0%d" % (i + 1), "profile": None, "ingestUrl": "rtsp://127.0.0.1:%d/%s" % (PORTS[i], names[i]),
                     "outputPath": os.path.join(d, "media", "VIDEO-0%d.mp4" % (i + 1))} for i in range(cams)],
        "mics": [{"deviceId": "MIC-0%d" % (i + 1), "role": ("PRIMARY", "STANDBY")[i], "input": {"kind": "PCM_FIFO", "path": fifos[i]}} for i in range(mics)],
        "activeMic": "PRIMARY",
        "pcmTapPath": tap,
        "constants": {"fragmentTargetMs": 2000, "minFragDurationMs": 2000, "gopFrames": 50, "meterRateHz": 20, "audioSampleRateHz": 48000, "audioChannels": 1},
    }


def build_truth(case_name, lead_us=5_000_000, frames_override=None):
    case = CASES[case_name]
    ev = case["events"]
    frames = 200 + 200 * (ev - 1) + 50
    c0 = (time.time_ns() // 1_000_000) * 1000 + lead_us       # whole ms: rtpenc rounds the SR origin to ms
    cams, beeps = [], []
    for i, (inj_ms, ppm) in enumerate(case["cams"]):
        first = 100 + 100 * i
        evs = []
        for j in range(ev):
            k = first + 200 * j
            true_us = c0 + int(k * (1000000.0 / FPS) * (1.0 + ppm * 1e-6) + 0.5)      # same formula as fake_cam.c
            evs.append({"frame": k, "beep_at_us": true_us, "truth_offset_us": inj_ms * 1000 + (true_us - c0 - k * FRAME_US)})
            beeps.append(true_us)
        n = frames if not frames_override else frames_override[i]
        cams.append({"cam": i + 1, "port": PORTS[i], "inject_ms": inj_ms, "drift_ppm": ppm, "flash_first": first, "flash_every": 200,
                     "claimed_epoch_us": c0 - inj_ms * 1000, "events": [e for e in evs if e["frame"] < n], "frames": n})
    return {"case": case_name, "epoch_us": c0, "frames": frames, "cams": cams, "beeps": sorted(beeps)}


def start_sources(d, truth, plan, procs, mic_seconds, mic_extra=()):
    """The fake mics first (they define T0), then the cameras. Each is a process of its own."""
    mic = subprocess.Popen([MIC, "--out1", plan["mics"][0]["input"]["path"]] + (["--out2", plan["mics"][1]["input"]["path"]] if len(plan["mics"]) > 1 else []) +
                           ["--manifest", os.path.join(d, "mic.jsonl"), "--seconds", "%.3f" % mic_seconds, "--beep-at-us", ",".join(str(b) for b in truth["beeps"])] + list(mic_extra),
                           stdin=subprocess.DEVNULL, stderr=open(os.path.join(d, "mic.err"), "w"), start_new_session=True)
    procs.append(mic)
    cps = []
    for c, pc in zip(truth["cams"], plan["cameras"]):
        cp = subprocess.Popen([CAM, "--url", pc["ingestUrl"], "--epoch-us", str(truth["epoch_us"]), "--claimed-epoch-us", str(c["claimed_epoch_us"]),
                               "--drift-ppm", str(c["drift_ppm"]), "--frames", str(c["frames"]), "--flash-first", str(c["flash_first"]), "--flash-every", str(c["flash_every"])],
                              stdin=subprocess.DEVNULL, stderr=open(os.path.join(d, "cam%d.err" % c["cam"]), "w"), start_new_session=True)
        procs.append(cp)
        cps.append(cp)
    return mic, cps


def killall(procs):
    for p in procs:                                           # by process group, one pid at a time
        if p.poll() is None:
            try:
                os.killpg(p.pid, signal.SIGKILL)
            except (ProcessLookupError, PermissionError):     # gone already (macOS answers EPERM for a group of zombies)
                pass
            p.wait()


def sizes(plan):
    return [os.path.getsize(c["outputPath"]) if os.path.exists(c["outputPath"]) else None for c in plan["cameras"]]


class Sampler(threading.Thread):
    """File sizes on the disk WHILE the session records (M3-WI-1 (a): sampled, not only at close)."""

    def __init__(self, plan, period=0.5):
        super().__init__(daemon=True)
        self.plan, self.period, self.rows, self.on, self.t0 = plan, period, [], True, time.monotonic()

    def run(self):
        while self.on:
            self.rows.append([round(time.monotonic() - self.t0, 2)] + sizes(self.plan))
            time.sleep(self.period)


# ------------------------------------------------------------------------------------------ analysis
def boxes(path):
    """Top-level boxes with offsets, and per moof the sample count of each track (traf/trun)."""
    out, size, pos = [], os.path.getsize(path), 0
    with open(path, "rb") as f:
        data = f.read()
    while pos + 8 <= size:
        n, t = struct.unpack(">I4s", data[pos:pos + 8])
        if n == 1:
            n = struct.unpack(">Q", data[pos + 8:pos + 16])[0]
        if n < 8 or pos + n > size:
            break
        row = {"type": t.decode("latin1"), "offset": pos, "size": n}
        if t == b"moof":
            row["tracks"] = {}
            q, end = pos + 8, pos + n
            while q + 8 <= end:
                m, u = struct.unpack(">I4s", data[q:q + 8])
                if u == b"traf":
                    r, tend, tid, cnt, dur, base = q + 8, q + m, None, 0, None, None
                    while r + 8 <= tend:
                        k, w = struct.unpack(">I4s", data[r:r + 8])
                        if w == b"tfhd":
                            tid = struct.unpack(">I", data[r + 12:r + 16])[0]
                        elif w == b"tfdt":
                            ver = data[r + 8]
                            base = struct.unpack(">Q", data[r + 12:r + 20])[0] if ver == 1 else struct.unpack(">I", data[r + 12:r + 16])[0]
                        elif w == b"trun":
                            cnt += struct.unpack(">I", data[r + 12:r + 16])[0]
                        r += k
                    row["tracks"][tid] = {"samples": cnt, "tfdt": base}
                q += m
        out.append(row)
        pos += n
    return {"boxes": out, "tiles_exactly": pos == size, "kinds": [b["type"] for b in out]}


def playable(path):
    st = P111.streams(path)
    dec = sh([FF, "-v", "error", "-xerror", "-i", path, "-map", "0", "-f", "null", "-"])
    cnt = json.loads(P111.out([FP, "-v", "error", "-count_frames", "-show_entries", "stream=codec_type,nb_read_frames", "-of", "json", path]))["streams"]
    frames = {s["codec_type"]: int(s["nb_read_frames"]) for s in cnt}
    bw = boxes(path)
    shape = sorted((s["codec_type"], s["codec_name"]) for s in st) == [("audio", "aac"), ("video", "h264")]
    ok = dec.returncode == 0 and dec.stderr.strip() == "" and shape and frames.get("video", 0) > 0 and frames.get("audio", 0) > 0 and bw["tiles_exactly"] and bw["kinds"].count("moof") > 0
    return ok, {"bytes": os.path.getsize(path), "streams": [(s["codec_type"], s["codec_name"], s.get("sample_rate"), s.get("channels")) for s in st], "decoded_frames": frames,
                "decode_rc": dec.returncode, "decode_error_lines": len([l for l in dec.stderr.splitlines() if l.strip()]),
                "top_level": {k: bw["kinds"].count(k) for k in sorted(set(bw["kinds"]))}, "first_boxes": bw["kinds"][:4], "tiles_exactly": bw["tiles_exactly"], "playable": ok}


def h4(d, paths):
    """The row-111 packet-equality assertion, kept as a regression: ONE encoder's packets, byte for byte, in every file."""
    rows = [json.loads(l) for l in open(os.path.join(d, "manifest.jsonl"))]
    apk = [r for r in rows if r["type"] == "apkt"]
    end = [r for r in rows if r["type"] == "end"]
    lists = [P111.probe_packets(p, "a:0") for p in paths]
    key = lambda x: (x["pts"], x["dts"], x["duration"], x["size"], x["data_hash"])
    A, B = lists[0], lists[-1]
    mism = [i for i in range(min(len(A), len(B))) if key(A[i]) != key(B[i])]
    vs = [sum(1 for i in range(min(len(L), len(apk))) if L[i]["data_hash"].split(":")[-1].lower() != apk[i]["sha256"]) for L in lists]
    distinct = len(set(x["data_hash"] for x in A))
    res = {"audio_packets": [len(L) for L in lists], "encoder_packets_in_manifest": len(apk), "packets_differing_between_files": len(mism),
           "payload_mismatches_vs_encoder": vs, "distinct_payloads_in_file1": distinct, "worker_encoders": end[0]["encoders"] if end else None}
    ok = len(A) == len(B) == len(apk) > 0 and not mism and vs == [0] * len(lists) and res["worker_encoders"] == 1 and distinct > len(A) * 0.9      # nearly every packet is unique: the equality bites on every one (pair-111 N-9)
    return ok, res


def av_offsets(d, truth, paths, exclude_first_video_sample=True, bound_ms=REGRESSION_MS, keep=None):
    """Flash-to-beep offset per camera file, sample-exact (row-111 method). The truth comes from the
    case definition and the mic process's own manifest, never from the worker."""
    res, ok = {}, True
    for c, p in zip(truth["cams"], paths):
        flashes, nframes, bright = P111.video_flashes(p)
        x, a0, _ = P111.audio_pcm(p)
        on = [Fraction(a0 + i, SR) for i in P111.onsets(x)]
        rows = []
        if len(flashes) != len(c["events"]) or not on:
            res["cam%d" % c["cam"]] = {"error": "flash/beep count", "flashes": len(flashes), "events": len(c["events"]), "beeps": len(on)}
            ok = False
            continue
        for f, e in zip(flashes, c["events"]):
            if keep and not keep(e):
                continue
            b = min(on, key=lambda t: abs(t - f))
            off, tr = float((b - f) * 1000), e["truth_offset_us"] / 1000.0
            rows.append({"frame": e["frame"], "flash_s": round(float(f), 6), "beep_s": round(float(b), 6), "offset_ms": round(off, 4), "truth_ms": round(tr, 4), "error_ms": round(off - tr, 4)})
        n = len(rows)
        mx, my = sum(r["flash_s"] for r in rows) / n, sum(r["offset_ms"] for r in rows) / n
        sxx = sum((r["flash_s"] - mx) ** 2 for r in rows)
        slope = sum((r["flash_s"] - mx) * (r["offset_ms"] - my) for r in rows) / sxx * 1000 if sxx else 0.0
        max_err = max(abs(r["error_ms"]) for r in rows)
        sign_ok = c["inject_ms"] == 0 or (my > 0) == (c["inject_ms"] > 0)
        reg = max_err <= bound_ms and sign_ok
        ok &= reg
        res["cam%d" % c["cam"]] = {"inject_ms": c["inject_ms"], "inject_drift_ppm": c["drift_ppm"], "events": rows, "mean_offset_ms": round(my, 4), "fitted_slope_ppm": round(slope, 2),
                                  "max_abs_error_vs_truth_ms": round(max_err, 4), "bound_ms": bound_ms, "regression_bound_2ms": "PASS" if reg else "FAIL",
                                  "product_bound_40ms": "WITHIN" if max(abs(r["error_ms"]) for r in rows) <= PRODUCT_MS else "EXCEEDED",
                                  "first_video_sample_excluded": exclude_first_video_sample, "flash_frame_indexes": bright}
    return ok, res


def first_video(path):
    pk = json.loads(P111.out([FP, "-v", "error", "-select_streams", "v:0", "-show_entries", "packet=pts,dts,duration", "-read_intervals", "%+#3", "-of", "json", path]))["packets"]
    return [(int(p["pts"]), int(p["dts"]), int(p["duration"])) for p in pk]


def mic_manifest(d):
    rows = [json.loads(l) for l in open(os.path.join(d, "mic.jsonl"))]
    return [r for r in rows if r["type"] == "mic"][0], [r for r in rows if r["type"] == "beep"]


def worker_log(d):
    p = os.path.join(d, "worker.jsonl")
    return [json.loads(l) for l in open(p)] if os.path.exists(p) else []


# ------------------------------------------------------------------------------------------ session (M3-WI-1, H-4, H-10)
def run_session(a, d, binary, truth, after_start=None, mic_extra=(), stop_after_last_cam=1.5):
    sid = "S-M3W-%s" % a.name.upper().replace("_", "-")[:40]
    if tcp_listeners():
        sys.exit("ports busy before start: %r" % tcp_listeners())
    plan = make_plan(d, sid, tap=os.path.join(d, "tap.s16") if getattr(a, "tap", False) else None)
    json.dump(truth, open(os.path.join(d, "truth.json"), "w"), indent=1)
    procs, info = [], {"sessionId": sid}
    w = Worker(d, binary)
    procs.append(w.p)
    try:
        t_hello, hello = w.wait(lambda f: f.get("type") == "HELLO", 5, "HELLO")
        info["hello_ms"] = round((t_hello - w.t_spawn) * 1000, 2)
        info["hello"] = hello
        info["first_frame_is_hello"] = w.frames[0][1] is not None and w.frames[0][1].get("type") == "HELLO"
        t_cmd = time.monotonic()
        corr = w.command(sid, "START", attempt=1, plan=plan)
        t_ack, ackf = w.ack(corr)
        info["start_ack_ms"] = round((t_ack - t_cmd) * 1000, 2)
        info["start_ack"] = ackf
        if not ackf["ok"]:
            return w, plan, info, procs
        sampler = Sampler(plan)
        sampler.start()
        mic_seconds = (truth["epoch_us"] / 1e6 - time.time()) + max(c["frames"] for c in truth["cams"]) / FPS + stop_after_last_cam + 6
        mic, cps = start_sources(d, truth, plan, procs, mic_seconds, mic_extra)
        if after_start:
            after_start(w, plan, sid, info, cps, truth)
        rc = {}
        for i, cp in enumerate(cps):
            rc["cam%d" % (i + 1)] = cp.wait(timeout=120)
        time.sleep(stop_after_last_cam)
        info["sockets_before_stop"] = sockets_of(w.p.pid)
        sampler.on = False
        t_stop = time.monotonic()
        if w.p.poll() is None:
            try:
                w.ack(w.command(sid, "STOP", reason="STOPPED"))
            except (RuntimeError, BrokenPipeError):
                pass                                          # the worker ended by itself (the fatal-error cases)
        rc["worker"] = w.exit(20)
        info["stop_to_exit_ms"] = round((time.monotonic() - t_stop) * 1000, 2)
        info["rc"] = rc
        info["size_samples"] = sampler.rows
    finally:
        killall(procs)
    time.sleep(0.3)
    info["leftovers"] = leftovers()
    return w, plan, info, procs


def frame_stats(w, info):
    hb = w.of("HEARTBEAT")
    gaps = [round((b[0] - a[0]) * 1000, 2) for a, b in zip(hb, hb[1:])]
    counters = [f["counter"] for _, f in hb]
    tel = w.of("TELEMETRY")
    info["heartbeats"] = {"count": len(hb), "counter_strictly_growing": all(y == x + 1 for x, y in zip(counters, counters[1:])),
                          "interval_ms_min_median_max": [min(gaps), sorted(gaps)[len(gaps) // 2], max(gaps)] if gaps else None}
    if len(tel) > 1:
        span = tel[-1][0] - tel[0][0]
        info["telemetry"] = {"frames": len(tel), "rate_hz": round((len(tel) - 1) / span, 2) if span > 0 else None, "last": tel[-1][1]}
    info["records"] = [f for _, f in w.of("RECORD")]
    info["warnings"] = [f for _, f in w.of("WARNING")]
    info["crash"] = [f for _, f in w.of("CRASH")]
    info["lines_that_are_no_frame"] = w.not_frames()


def cmd_session(a):
    binary = VARIANTS[a.variant]
    d = rundir(a.name, fresh=True)
    truth = build_truth(a.case)
    marks = {}

    def mid(w, plan, sid, info, cps, truth_):
        if a.stall:
            # Both cameras freeze 0.6 s after their first frame, before their first usable keyframe, for 4 s
            # (the process is stopped; its frames come late, with their true camera times). The worker must cut
            # audio-only fragments meanwhile (W-3) and still place the late video correctly.
            time.sleep(max(0.0, truth_["epoch_us"] / 1e6 - time.time()) + 0.6)
            for cp in cps:
                os.kill(cp.pid, signal.SIGSTOP)
            marks["stalled_at_s"] = round(time.monotonic() - w.t_spawn, 2)
            time.sleep(4.0)
            for cp in cps:
                os.kill(cp.pid, signal.SIGCONT)
        if a.switch:
            # The operator's switch to the standby mic and back, in the gap between two beeps.
            time.sleep(max(0.0, truth_["epoch_us"] / 1e6 - time.time()) + 2.6)
            for to in ("STANDBY", "PRIMARY"):
                t = time.monotonic()
                c = w.command(sid, "SWITCH_AUDIO_SOURCE", to=to)
                t2, f = w.ack(c)
                marks.setdefault("switch_ack_ms", []).append([to, f["ok"], round((t2 - t) * 1000, 2)])
                time.sleep(0.5)

    w, plan, info, _ = run_session(a, d, binary, truth, after_start=mid)
    frame_stats(w, info)
    info.update(marks)
    res = {"check": "M3-WI-1 session", "run": a.name, "case": a.case, "variant": a.variant, "info": info}
    paths = [c["outputPath"] for c in plan["cameras"]]
    ok = info.get("rc") == {"cam1": 0, "cam2": 0, "worker": 0} and all(os.path.exists(p) for p in paths)
    if ok:
        pl = [playable(p) for p in paths]
        res["files"] = {os.path.basename(p): r for p, (_, r) in zip(paths, pl)}
        ok &= all(o for o, _ in pl)
        # (a) both files exist and GROW during the session, sampled before STOP.
        rows = [r for r in info["size_samples"] if r[1] is not None and r[2] is not None]
        grew = [len(set(r[i] for r in rows)) for i in (1, 2)]
        res["growth"] = {"samples_with_both_files": len(rows), "distinct_sizes_per_file": grew, "first": rows[:1], "last_before_stop": rows[-1:], "final": sizes(plan)}
        res["fragments"] = {os.path.basename(p): [[b["tracks"].get(1, {}).get("samples", 0), b["tracks"].get(2, {}).get("samples", 0)] for b in boxes(p)["boxes"] if b["type"] == "moof"] for p in paths}
        ok &= len(rows) >= 4 and min(grew) >= 3
        o4, r4 = h4(d, paths)
        res["h4_one_encoder_both_files"] = r4
        ok &= o4
        oav, rav = av_offsets(d, truth, paths)
        res["av_offsets"] = rav
        ok &= oav
        res["first_video_packets"] = {os.path.basename(p): first_video(p) for p in paths}
        res["video_started_log"] = [{"source": l["source"], "first_pts": l["first_pts"]} for l in worker_log(d) if l["message"] == "video_started"]
        mic, _ = mic_manifest(d)
        t0 = [l for l in worker_log(d) if l["message"] == "audio_started"][0]["t0_real_us"]
        res["t0"] = {"mic_e0_real_us": mic["e0_real_us"], "worker_t0_real_us": t0, "t0_error_us": t0 - mic["e0_real_us"]}
        recs = info["records"]
        kinds = sorted((r["record"]["kind"], r["record"]["deviceId"]) for r in recs)
        res["records_ok"] = [r["seq"] for r in recs] == [1, 2, 3, 4] and kinds == [("FIRST_DURABLE_FRAGMENT", "CAM-01"), ("FIRST_DURABLE_FRAGMENT", "CAM-02"), ("FIRST_VIDEO_SAMPLE", "CAM-01"), ("FIRST_VIDEO_SAMPLE", "CAM-02")]
        # The record states the TRUE first video pts: what the worker logged, and (under the pinned flags) NOT what the file shows.
        logged = sorted(l["first_pts"] for l in worker_log(d) if l["message"] == "video_started")
        res["first_video_sample_records"] = sorted((r["record"]["deviceId"], r["record"]["pts"], r["record"]["timescale"]) for r in recs if r["record"]["kind"] == "FIRST_VIDEO_SAMPLE")
        res["records_ok"] &= sorted(x[1] for x in res["first_video_sample_records"]) == logged
        ok &= res["records_ok"] and info["first_frame_is_hello"] and not info["lines_that_are_no_frame"] and not info["crash"] and info["heartbeats"]["counter_strictly_growing"]
        ok &= not info["sockets_before_stop"]["udp"] and not info["sockets_before_stop"]["not_loopback"]
        if a.switch:
            ok &= all(m[1] for m in marks.get("switch_ack_ms", [])) and len(marks.get("switch_ack_ms", [])) == 2
        if getattr(a, "tap", False):
            tap = os.path.join(d, "tap.s16")
            x, a0, _ = P111.audio_pcm(paths[0])
            res["tap"] = {"bytes": os.path.getsize(tap), "samples": os.path.getsize(tap) // 2, "decoded_samples": len(x), "decoded_minus_tap": len(x) - os.path.getsize(tap) // 2, "audio_first_pts": a0}
    ok &= not info["leftovers"]["processes"] and not info["leftovers"]["listeners"]
    finish(res, ok, a.expect_fail, d)


# ------------------------------------------------------------------------------------------ H-4 negative control
def cmd_h4neg(a):
    """The packet-equality check on a run whose second file had its audio encoded a second time: must FAIL."""
    d = rundir(a.name)
    src = [os.path.join(d, "media", "VIDEO-0%d.mp4" % i) for i in (1, 2)]
    re = os.path.join(d, "media", "VIDEO-02.reencoded.mp4")
    subprocess.run([FF, "-v", "error", "-y", "-i", src[1], "-map", "0", "-c:v", "copy", "-c:a", "aac", "-b:a", "96k", "-movflags", "+frag_keyframe+empty_moov+default_base_moof", re], check=True)
    ok, res = h4(d, [src[0], re])
    finish({"check": "H-4 negative control (second file re-encoded)", "run": a.name, "h4": res}, ok, True)


# ------------------------------------------------------------------------------------------ protocol (nine-point gap list)
def cmd_proto(a):
    d = rundir(a.name, fresh=True)
    res, ok = {"check": "worker protocol", "run": a.name}, True
    sid = "S-M3W-PROTO"

    # 1. HELLO first, heartbeats that only grow, at the asked interval, with an empty environment.
    w = Worker(d, heartbeat_ms=100, manifest=False)
    try:
        w.wait(lambda f: f.get("type") == "HELLO", 5, "HELLO")
        time.sleep(1.2)
        hb = [f["counter"] for _, f in w.of("HEARTBEAT")]
        first = w.frames[0][1]
        res["hello"] = first
        res["heartbeats_in_1_2_s_at_100ms"] = len(hb)
        ok &= first == {"v": V, "type": "HELLO", "protocolVersion": V, "workerVersion": first.get("workerVersion")} and 9 <= len(hb) <= 14 and hb == list(range(1, len(hb) + 1))
        # 2. A plan the protocol refuses: a port outside 8554-8564, a wildcard host, a trailing slash, an unknown member.
        plan = make_plan(d, sid)
        bad = {}
        for label, change in (("port 9000", lambda p: p["cameras"][0].update(ingestUrl="rtsp://127.0.0.1:9000/cam1")),
                              ("every interface", lambda p: p["cameras"][0].update(ingestUrl="rtsp://0.0.0.0:8555/cam1")),
                              ("trailing slash", lambda p: p["cameras"][0].update(ingestUrl="rtsp://127.0.0.1:8555/cam1/")),
                              ("credentials", lambda p: p["cameras"][0].update(ingestUrl="rtsp://u:p@127.0.0.1:8555/cam1")),
                              ("unknown member", lambda p: p.update(password="x")),
                              ("44.1 kHz", lambda p: p["constants"].update(audioSampleRateHz=44100)),
                              ("relative output", lambda p: p["cameras"][0].update(outputPath="media/x.mp4")),
                              ("mic input is a regular file", lambda p: p["mics"][0]["input"].update(path=os.path.join(d, "worker.jsonl")))):
            wb = Worker(rundir(a.name + "/bad"), manifest=False)
            try:
                wb.wait(lambda f: f.get("type") == "HELLO", 5, "HELLO")
                p2 = json.loads(json.dumps(plan))
                change(p2)
                _, f = wb.ack(wb.command(sid, "START", attempt=1, plan=p2))
                bad[label] = [f["ok"], f.get("code")]
            finally:
                wb.kill()
        res["refused_plans"] = bad
        ok &= all(v[0] is False for v in bad.values()) and bad["44.1 kHz"][1] == "PLAN_UNSUPPORTED" and bad["mic input is a regular file"][1] == "MIC_INPUT_NOT_FIFO" and bad["port 9000"][1] == "PLAN_INVALID"
        # 3. START is taken from the frame (nothing of the session is an argument), a second START is refused.
        _, f1 = w.ack(w.command(sid, "START", attempt=1, plan=plan))
        _, f2 = w.ack(w.command(sid, "START", attempt=2, plan=plan))
        argv = sh(["ps", "-o", "command=", "-p", str(w.p.pid)]).stdout.strip()
        res["start"] = [f1, f2]
        res["argv_names_no_session"] = sid not in argv and "rtsp" not in argv and "media" not in argv
        ok &= f1["ok"] is True and f2 == {"v": V, "type": "ACK", "correlationId": f2["correlationId"], "ok": False, "code": "SESSION_ALREADY_SERVED"} and res["argv_names_no_session"]
        # 4. The listeners are up on loopback only; a switch to a role the plan holds is acknowledged.
        t = time.monotonic()
        while len(tcp_listeners()) < 2 and time.monotonic() - t < 5:
            time.sleep(0.05)
        res["listeners"] = tcp_listeners()
        res["sockets"] = sockets_of(w.p.pid)
        ok &= len(res["listeners"]) == 2 and not res["sockets"]["udp"] and not res["sockets"]["not_loopback"]
        # 5. The end of standard input ends the worker (no orphan), with a clean code: nothing was recorded.
        w.p.stdin.close()
        rc = w.exit(15)
        res["exit_after_input_ended"] = rc
        ok &= rc == 0 and not w.not_frames() and not os.path.exists(plan["cameras"][0]["outputPath"])
    finally:
        w.kill()
    # CONTROL for 5: with its input open the worker keeps running.
    w2 = Worker(rundir(a.name + "/open"), manifest=False)
    try:
        w2.wait(lambda f: f.get("type") == "HELLO", 5, "HELLO")
        time.sleep(1.5)
        res["control_input_open_still_running"] = w2.p.poll() is None
        ok &= res["control_input_open_still_running"]
    finally:
        w2.kill()
    # 6. A line that is no command of the protocol ends the worker with CRASH and a non-zero code.
    viol = {}
    for label, line in (("not json", "switch 1"), ("unknown type", json.dumps({"v": V, "sessionId": "S", "correlationId": "c", "type": "PING"})),
                        ("another version", json.dumps({"v": 1, "sessionId": "S", "correlationId": "c", "type": "STOP", "reason": "STOPPED"})),
                        ("too long", "x" * (4 * 65536 + 10))):
        w3 = Worker(rundir(a.name + "/viol"), manifest=False)
        try:
            w3.wait(lambda f: f.get("type") == "HELLO", 5, "HELLO")
            w3.p.stdin.write((line + "\n").encode())
            w3.p.stdin.flush()
            rc = w3.exit(10)
            crash = [f for _, f in w3.of("CRASH")]
            viol[label] = [rc, crash[0]["code"] if crash else None, crash[0]["exitCode"] if crash else None]
        finally:
            w3.kill()
    res["protocol_violations"] = viol
    ok &= all(v == [64, "PROTOCOL_VIOLATION", 64] for v in viol.values())
    # 7. SIGTERM before any session: a clean exit.
    w4 = Worker(rundir(a.name + "/term"), manifest=False)
    try:
        w4.wait(lambda f: f.get("type") == "HELLO", 5, "HELLO")
        os.kill(w4.p.pid, signal.SIGTERM)
        res["exit_after_sigterm"] = w4.exit(10)
        ok &= res["exit_after_sigterm"] == 0
    finally:
        w4.kill()
    time.sleep(0.3)
    res["leftovers"] = leftovers()
    ok &= not res["leftovers"]["processes"] and not res["leftovers"]["listeners"]
    finish(res, ok, a.expect_fail, d)


# ------------------------------------------------------------------------------------------ camera stops (W-3)
def cmd_camstop(a):
    d = rundir(a.name, fresh=True)
    truth = build_truth("zero", frames_override=(650, 220))          # camera 2 ends after 4.4 s, camera 1 after 13 s
    w, plan, info, _ = run_session(a, d, VARIANTS[a.variant], truth)
    frame_stats(w, info)
    res = {"check": "M3-WI-1 (b) a camera stops, the audio of its file keeps landing on disk", "run": a.name, "variant": a.variant, "info": info}
    p2 = plan["cameras"][1]["outputPath"]
    ok = info.get("rc", {}).get("worker") == 0 and os.path.exists(p2)
    if ok:
        cam2_end = None
        log = worker_log(d)
        for l in log:
            if l["message"] == "INGEST_ENDED" and l["source"].endswith("ingest2"):
                cam2_end = l["ts_us"]
        t_first = [l for l in log if l["message"] == "worker_starting"][0]["ts_us"]
        rows = info["size_samples"]
        # Sizes of file 2 in the samples taken AFTER camera 2 ended, before STOP.
        spawn_wall = t_first / 1e6
        after = [r for r in rows if r[2] is not None and cam2_end and (spawn_wall + r[0]) > cam2_end / 1e6 + 0.5]
        bw = boxes(p2)
        moofs = [b for b in bw["boxes"] if b["type"] == "moof"]
        audio_per_moof = [b["tracks"].get(2, {}).get("samples", 0) for b in moofs]
        video_per_moof = [b["tracks"].get(1, {}).get("samples", 0) for b in moofs]
        okp, pl = playable(p2)
        res["file2"] = pl
        res["after_camera2_ended"] = {"samples": len(after), "distinct_sizes": len(set(r[2] for r in after)), "sizes": [r[2] for r in after]}
        res["fragments_file2"] = {"moofs": len(moofs), "audio_samples_per_moof": audio_per_moof, "video_samples_per_moof": video_per_moof,
                                  "longest_audio_run_s": round(max(audio_per_moof) * 1024 / SR, 3), "audio_only_fragments": sum(1 for v in video_per_moof if v == 0)}
        res["warnings"] = info["warnings"]
        ok &= okp and len(after) >= 6 and res["after_camera2_ended"]["distinct_sizes"] >= 3
        # After the camera's last video, no fragment holds more audio than the stall bound plus one cut interval
        # (the first fragment of a file also carries the audio from T0 to the camera's first GOP: it is not judged here).
        tail = [n for n, v in zip(audio_per_moof, video_per_moof) if v == 0]
        res["fragments_file2"]["longest_audio_only_run_s"] = round(max(tail) * 1024 / SR, 3) if tail else None
        ok &= bool(tail) and max(tail) * 1024 / SR <= 4.5 and len(tail) >= 2
        ok &= {"v": V, "type": "WARNING", "sessionId": info["sessionId"], "code": "CAPTURE_FAULT", "state": "ACTIVE", "subject": "CAM-02"} in info["warnings"]
        ok &= not info["crash"] and not info["lines_that_are_no_frame"]
    ok &= not info["leftovers"]["processes"] and not info["leftovers"]["listeners"]
    finish(res, ok, a.expect_fail, d)


# ------------------------------------------------------------------------------------------ fatal error (W-4) and option C (file truth)
def cmd_fatal(a):
    """mode rmdir : the output directory vanishes after START -> the first fragment cannot be created -> CRASH, exit 70.
       mode planted: a file appears at an output path after START -> never overwritten -> CRASH, exit 70, bytes untouched.
       mode exists : the file is there BEFORE START -> START refused with OUTPUT_EXISTS, bytes untouched.
       mode clean  : CONTROL - the same session without any of it stops with exit 0 and no CRASH."""
    d = rundir(a.name, fresh=True)
    truth = build_truth("zero", frames_override=(300, 300))
    marker = b"EVIDENCE-OF-AN-EARLIER-WORKER\n" * 4
    digest = hashlib.sha256(marker).hexdigest()
    state = {}

    def mid(w, plan, sid, info, cps, truth_):
        media = os.path.dirname(plan["cameras"][0]["outputPath"])
        if a.mode == "rmdir":
            os.rmdir(media)                                   # empty: no file exists before the first fragment
            state["dir_removed"] = not os.path.exists(media)
        elif a.mode == "planted":
            open(plan["cameras"][0]["outputPath"], "wb").write(marker)

    sid = "S-M3W-%s" % a.name.upper().replace("_", "-")[:40]
    if a.mode == "exists":
        plan0 = make_plan(d, sid)
        open(plan0["cameras"][0]["outputPath"], "wb").write(marker)
    w, plan, info, procs = run_session(a, d, WORKER, truth, after_start=None if a.mode in ("exists", "clean") else mid)
    if a.mode == "exists":
        killall(procs)
        w.kill()
    frame_stats(w, info) if w.of("HEARTBEAT") else None
    res = {"check": "M3-WI-1 (c) fatal error exits non-zero / option C never overwrites", "run": a.name, "mode": a.mode, "info": info, "state": state}
    p1 = plan["cameras"][0]["outputPath"]
    crash = [f for _, f in w.of("CRASH")]
    rc = info.get("rc", {}).get("worker", w.p.returncode)
    res["worker_rc"], res["crash"] = rc, crash
    if a.mode == "rmdir":
        ok = rc == 70 and len(crash) == 1 and crash[0]["exitCode"] == 70 and crash[0]["code"] in ("VIDEO_MUX_WRITE_FAILED", "AUDIO_MUX_WRITE_FAILED", "STALL_CUT_FAILED") and not os.path.exists(p1)
    elif a.mode == "planted":
        now = hashlib.sha256(open(p1, "rb").read()).hexdigest()
        res["planted_file_sha256_before_after"] = [digest, now]
        ok = rc == 70 and len(crash) == 1 and now == digest and os.path.exists(plan["cameras"][1]["outputPath"])
    elif a.mode == "exists":
        now = hashlib.sha256(open(p1, "rb").read()).hexdigest()
        res["existing_file_sha256_before_after"] = [digest, now]
        ok = info["start_ack"]["ok"] is False and info["start_ack"].get("code") == "OUTPUT_EXISTS" and now == digest and not os.path.exists(plan["cameras"][1]["outputPath"])
    else:
        ok = rc == 0 and not crash and os.path.exists(p1)
    time.sleep(0.3)
    res["leftovers"] = leftovers()
    ok &= not res["leftovers"]["processes"] and not res["leftovers"]["listeners"]
    finish(res, ok, a.expect_fail, d)


# ------------------------------------------------------------------------------------------ M3-RTSP-BIND-1 (worker half)
def cmd_udp(a):
    """A client that asks for RTP over UDP on camera 1, a normal TCP camera on camera 2. The snapshot of EVERY
    socket of the worker is taken while the UDP client is connected. PASS = no UDP socket, every socket on 127.0.0.1.
    With --variant skeleton the row-111 binary is measured the same way and must FAIL (the negative control)."""
    d = rundir(a.name, fresh=True)
    if tcp_listeners():
        sys.exit("ports busy before start: %r" % tcp_listeners())
    procs, res, snaps = [], {"check": "M3-RTSP-BIND-1 (worker sockets, TCP and UDP)", "run": a.name, "variant": a.variant}, []
    sid = "S-M3W-UDP"
    plan = make_plan(d, sid)
    w = None
    try:
        if a.variant == "skeleton":
            sk = subprocess.Popen([VARIANTS["skeleton"], "--cam1", plan["cameras"][0]["ingestUrl"], "--out1", plan["cameras"][0]["outputPath"], "--cam2", plan["cameras"][1]["ingestUrl"],
                                   "--out2", plan["cameras"][1]["outputPath"], "--duration", "8", "--listen-timeout", "10"], stdin=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True)
            procs.append(sk)
            pid = sk.pid
        else:
            w = Worker(d, VARIANTS[a.variant])
            procs.append(w.p)
            w.wait(lambda f: f.get("type") == "HELLO", 5, "HELLO")
            _, f = w.ack(w.command(sid, "START", attempt=1, plan=plan))
            assert f["ok"], f
            pid = w.p.pid
        t = time.monotonic()
        while len(tcp_listeners()) < 2 and time.monotonic() - t < 5:
            time.sleep(0.05)
        snaps.append(["listening", sockets_of(pid)])
        mic = None
        if w:
            mic = subprocess.Popen([MIC, "--out1", plan["mics"][0]["input"]["path"], "--out2", plan["mics"][1]["input"]["path"], "--manifest", os.path.join(d, "mic.jsonl"), "--seconds", "14"],
                                   stdin=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True)
            procs.append(mic)
        push = lambda url, transport: subprocess.Popen([FF, "-hide_banner", "-loglevel", "error", "-re", "-f", "lavfi", "-i", "testsrc=size=320x240:rate=25", "-t", "7", "-c:v", "libx264", "-preset", "ultrafast",
                                                        "-tune", "zerolatency", "-g", "25", "-bf", "0", "-f", "rtsp", "-rtsp_transport", transport, url],
                                                       stdin=subprocess.DEVNULL, stderr=open(os.path.join(d, "push_%s.err" % transport), "w"), start_new_session=True)
        udp_client = push(plan["cameras"][0]["ingestUrl"], "udp")
        tcp_client = push(plan["cameras"][1]["ingestUrl"], "tcp")
        procs += [udp_client, tcp_client]
        # Snapshots every 100 ms while the UDP client is (or tries to be) connected.
        for i in range(40):
            time.sleep(0.1)
            snaps.append(["t+%.1fs udp_client_running=%s" % ((i + 1) / 10, udp_client.poll() is None), sockets_of(pid)])
        try:
            res["udp_client_rc"] = udp_client.wait(timeout=30 if a.variant != "norefusal" else 4)
        except subprocess.TimeoutExpired:                     # a worker that does not refuse leaves the client waiting
            killall([udp_client])
            res["udp_client_rc"] = "killed (never answered)"
        res["tcp_client_rc"] = tcp_client.wait(timeout=30)
        if w:
            time.sleep(0.5)
            w.ack(w.command(sid, "STOP", reason="STOPPED"))
            res["worker_rc"] = w.exit(25)
            frame_stats(w, res)
        else:
            res["worker_rc"] = procs[0].wait(timeout=30)
    finally:
        killall(procs)
    udp_rows = sorted(set(r for _, s in snaps for r in s["udp"]))
    off = sorted(set(r for _, s in snaps for r in s["not_loopback"]))
    every = sorted(set(" ".join(r.split()[-2:]) for _, s in snaps for r in s["rows"]))
    res["snapshots"] = len(snaps)
    res["sockets_seen"] = every
    res["udp_sockets"] = udp_rows
    res["sockets_not_on_loopback"] = off
    ok = not udp_rows and not off and len(snaps) >= 40 and any("127.0.0.1:%d" % PORTS[0] in e for e in every)
    if w and a.variant == "norefusal":
        # F-2: a worker that does NOT recognise the refusal (what a reworded or different libav would give). Sockets
        # still fail closed (checked above); the damage must stay bounded: the log is rate-limited, the healthy camera
        # records to the STOP and its file is closed whole, and the worker leaves with CRASH instead of hanging.
        p2 = plan["cameras"][1]["outputPath"]
        log = os.path.join(d, "worker.jsonl")
        res["log_bytes"] = os.path.getsize(log)
        res["log_lines"] = sum(1 for _ in open(log))
        res["log_suppressed_lines"] = sum(l.get("lines", 0) for l in worker_log(d) if l["message"] == "log_lines_suppressed")
        res["camera2_playable"] = playable(p2)[1] if os.path.exists(p2) else None
        res["camera2_fragments_in_last_telemetry_vs_file"] = [res["telemetry"]["last"]["fragments"][-1]["count"], res["camera2_playable"]["top_level"].get("moof") if res["camera2_playable"] else None]
        ok &= res["worker_rc"] == 70 and [(c["code"], c["exitCode"]) for c in res["crash"]] == [("INGEST_THREAD_STUCK", 70)]
        ok &= bool(res["camera2_playable"]) and res["camera2_playable"]["playable"] and res["camera2_playable"]["decoded_frames"]["video"] >= 150
        ok &= res["log_bytes"] < 2 * 1024 * 1024 and res["log_suppressed_lines"] > 1000
    elif w:
        p2 = plan["cameras"][1]["outputPath"]
        res["camera1_file_exists"] = os.path.exists(plan["cameras"][0]["outputPath"])
        res["camera2_playable"] = playable(p2)[1] if os.path.exists(p2) else None
        res["refusal_logged"] = [l["message"] for l in worker_log(d) if l["message"] in ("INGEST_TRANSPORT_REFUSED", "INGEST_OPEN_STUCK")]
        # The refused camera is reported as a fault, records nothing, and the other camera is not disturbed.
        ok &= res["worker_rc"] == 0 and {"v": V, "type": "WARNING", "sessionId": sid, "code": "CAPTURE_FAULT", "state": "ACTIVE", "subject": "CAM-01"} in res["warnings"]
        ok &= not res["camera1_file_exists"] and bool(res["camera2_playable"]) and res["camera2_playable"]["playable"] and res["refusal_logged"] == ["INGEST_TRANSPORT_REFUSED"]
    time.sleep(0.3)
    res["leftovers"] = leftovers()
    ok &= not res["leftovers"]["processes"] and not res["leftovers"]["listeners"]
    finish(res, ok, a.expect_fail, d)


# ------------------------------------------------------------------------------------------ fix round 1: mics (F-4), no camera (D72(k))
def rms_per_second(path):
    x, a0, _ = P111.audio_pcm(path)
    out = []
    for s0 in range(0, len(x) - SR + 1, SR):
        seg = x[s0:s0 + SR]
        out.append(round((sum(v * v for v in seg) / SR) ** 0.5, 5))
    return out


def cmd_mic(a):
    """mode slow: both mics run 2,000 ppm SLOW for a 33 s session. They must stay audible to the end, and every beep
                  must sit within MIC_SLOW_BOUND_MS of its truth (the resampler follows the mic's clock; the product bound is +-40 ms).
       mode gap : the mic process delivers nothing from second 12 to second 17 (its own time) and then goes on.
                  Silence in between, sound again after second 17, and the beeps after the return within MIC_RETURN_BOUND_MS."""
    MIC_SLOW_BOUND_MS, MIC_RETURN_BOUND_MS = 5.0, 15.0
    d = rundir(a.name, fresh=True)
    truth = build_truth("long")
    extra = ("--ppm", "-2000") if a.mode == "slow" else ("--stop-at", "12", "--resume-at", "17")
    w, plan, info, _ = run_session(a, d, VARIANTS[a.variant], truth, mic_extra=extra)
    frame_stats(w, info)
    res = {"check": "F-4 mic on its own clock / mic that stops and returns (%s)" % a.mode, "run": a.name, "info": info}
    paths = [c["outputPath"] for c in plan["cameras"]]
    ok = info.get("rc", {}).get("worker") == 0 and all(os.path.exists(p) for p in paths)
    if ok:
        mic, _ = mic_manifest(d)
        e0 = mic["e0_real_us"]
        rms = rms_per_second(paths[0])
        res["rms_per_second"] = rms
        res["mic_summary"] = [{k: l[k] for k in ("mic", "received", "missing", "dropped", "restarts", "last_ppm")} for l in worker_log(d) if l["message"] == "mic_summary"]
        tel = [f for _, f in w.of("TELEMETRY")]
        nulls = sum(1 for f in tel if any(lv["role"] == "PRIMARY" and lv["dbfs"] is None for lv in f["levels"]))
        res["telemetry_frames_with_primary_null"] = nulls
        if a.mode == "slow":
            oav, rav = av_offsets(d, truth, paths, bound_ms=MIC_SLOW_BOUND_MS)
            res["av_offsets"], res["bound_ms"] = rav, MIC_SLOW_BOUND_MS
            # Audible for the whole session: no second of the file is silent (the quiet noise alone is about 0.0058 RMS).
            res["silent_seconds"] = [i for i, v in enumerate(rms[:-1]) if v < 0.003]
            ok &= oav and not res["silent_seconds"] and len(rms) >= 30 and nulls == 0
        else:
            t_of = lambda e: (e["beep_at_us"] - e0) / 1e6                     # the beep's instant in the mic's own seconds
            oav, rav = av_offsets(d, truth, paths, bound_ms=MIC_RETURN_BOUND_MS, keep=lambda e: t_of(e) < 11.5 or t_of(e) > 18.0)
            res["av_offsets"], res["bound_ms"] = rav, MIC_RETURN_BOUND_MS
            after = [r for c in rav.values() for r in c.get("events", []) if True]
            res["events_judged"] = sum(len(c.get("events", [])) for c in rav.values())
            res["events_after_return"] = sum(1 for c in truth["cams"] for e in c["events"] if t_of(e) > 18.0)
            # file second i covers mic seconds i..i+1 (file time 0 = T0 - 21 ms): 13..15 are inside the gap, 18.. after the return.
            res["rms_in_gap"], res["rms_after_return"] = rms[13:16], rms[18:24]
            ok &= oav and res["events_after_return"] >= 3 and max(rms[13:16]) < 0.0005 and min(rms[18:24]) > 0.003 and min(rms[2:11]) > 0.003
            ok &= nulls >= 60 and any(s["restarts"] >= 1 for s in res["mic_summary"])     # 5 s of NO SIGNAL at 20 Hz, then heard again
    ok &= not info["leftovers"]["processes"] and not info["leftovers"]["listeners"]
    finish(res, ok, a.expect_fail, d)


def cmd_nocam(a):
    """mode none: no camera ever connects (listen timeout 4 s). The worker must not run audio-only: CRASH NO_CAMERA_CONNECTED,
                  exit 70, no file at any output path, within the ingest window.
       mode one : only camera 1 connects. A valid degraded session: its file records, CAPTURE_FAULT for CAM-02, exit 0."""
    d = rundir(a.name, fresh=True)
    sid = "S-M3W-NOCAM"
    plan = make_plan(d, sid)
    procs, res = [], {"check": "D72(k) no camera connects (%s)" % a.mode, "run": a.name}
    w = Worker(d, WORKER, listen_timeout_s=4)
    procs.append(w.p)
    try:
        w.wait(lambda f: f.get("type") == "HELLO", 5, "HELLO")
        t0 = time.monotonic()
        _, f = w.ack(w.command(sid, "START", attempt=1, plan=plan))
        assert f["ok"], f
        truth = build_truth("zero", lead_us=2_000_000, frames_override=(450, 450))
        mic = subprocess.Popen([MIC, "--out1", plan["mics"][0]["input"]["path"], "--out2", plan["mics"][1]["input"]["path"], "--manifest", os.path.join(d, "mic.jsonl"), "--seconds", "20",
                                "--beep-at-us", ",".join(str(b) for b in truth["beeps"])], stdin=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True)
        procs.append(mic)
        if a.mode == "one":
            c = truth["cams"][0]
            cam = subprocess.Popen([CAM, "--url", plan["cameras"][0]["ingestUrl"], "--epoch-us", str(truth["epoch_us"]), "--claimed-epoch-us", str(c["claimed_epoch_us"]), "--drift-ppm", "0",
                                    "--frames", str(c["frames"]), "--flash-first", str(c["flash_first"]), "--flash-every", str(c["flash_every"])], stdin=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True)
            procs.append(cam)
            cam.wait(timeout=60)
            time.sleep(1.0)
            w.ack(w.command(sid, "STOP", reason="STOPPED"))
        rc = w.exit(25)
        res["worker_rc"], res["seconds_from_start_to_exit"] = rc, round(time.monotonic() - t0, 2)
    finally:
        killall(procs)
    frame_stats(w, res)
    exists = [os.path.exists(c["outputPath"]) for c in plan["cameras"]]
    res["files_exist"] = exists
    res["part_files"] = [n for n in os.listdir(os.path.join(d, "media")) if n.endswith(".part")]
    warned = sorted(x["subject"] for x in res["warnings"])
    if a.mode == "none":
        ok = rc == 70 and [(c["code"], c["exitCode"]) for c in res["crash"]] == [("NO_CAMERA_CONNECTED", 70)] and exists == [False, False] and warned == ["CAM-01", "CAM-02"] and res["seconds_from_start_to_exit"] < 4 + 5
    else:
        okp, pl = playable(plan["cameras"][0]["outputPath"]) if exists[0] else (False, None)
        res["file1"] = pl
        ok = rc == 0 and not res["crash"] and exists == [True, False] and okp and warned == ["CAM-01", "CAM-02"]     # camera 1's own end is reported too
    ok &= not res["part_files"] and not res["lines_that_are_no_frame"]
    time.sleep(0.3)
    res["leftovers"] = leftovers()
    ok &= not res["leftovers"]["processes"] and not res["leftovers"]["listeners"]
    finish(res, ok, a.expect_fail, d)


# ------------------------------------------------------------------------------------------ part P4: mux flags
def sha_prefix(path, n):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        h.update(f.read(n))
    return h.hexdigest()


def cmd_shape(a):
    """The S1 expectations on the files of a finished run: (c1) file shape, (c2) running hash == closed-file
    re-hash at every fragment end, (c3) tail validation (a cut inside the last mdat is found by the box walk and
    NOT by ffprobe/decoder), plus the first video sample and what the sizes were during the session."""
    d = rundir(a.name)
    info = json.load(open(os.path.join(d, "result.json")))
    res, ok = {"check": "S1 file shape / running hash / tail validation", "run": a.name}, True
    for i in (1, 2):
        p = os.path.join(d, "media", "VIDEO-0%d.mp4" % i)
        bw = boxes(p)
        kinds = bw["kinds"]
        init = [b for b in bw["boxes"] if b["type"] in ("ftyp", "moov")]
        frags = [(b["offset"], bw["boxes"][j + 1]["offset"] + bw["boxes"][j + 1]["size"]) for j, b in enumerate(bw["boxes"]) if b["type"] == "moof"]
        # c2: the chain an append-only writer would have computed fragment by fragment equals the re-hash of the closed file.
        chain, running, mism = hashlib.sha256(b"").digest(), hashlib.sha256(), 0
        data = open(p, "rb").read()
        pos = 0
        for s, e in frags:
            running.update(data[pos:e])
            pos = e
            chain = hashlib.sha256(chain + hashlib.sha256(data[s:e]).digest()).digest()
            if running.hexdigest() != sha_prefix(p, e):
                mism += 1
        whole = hashlib.sha256(data).hexdigest()
        # c3: cut inside the last mdat.
        cut = os.path.join(d, "media", "cut%d.mp4" % i)
        last_moof = [b for b in bw["boxes"] if b["type"] == "moof"][-1]
        open(cut, "wb").write(data[:last_moof["offset"] + last_moof["size"] + 8 + 37])
        cb = boxes(cut)
        probe = sh([FP, "-v", "error", "-show_entries", "format=duration", "-of", "json", cut])
        dec = sh([FF, "-v", "error", "-i", cut, "-map", "0", "-f", "null", "-"])
        trak = sh([FP, "-v", "error", "-show_entries", "stream=codec_type,start_time,start_pts,duration_ts,nb_frames", "-of", "json", p])
        elst = data.count(b"elst")
        res["VIDEO-0%d" % i] = {
            "top_level_sequence_head": kinds[:6], "init_bytes": sum(b["size"] for b in init), "fragments": len(frags), "mfra": kinds.count("mfra"), "edit_list_boxes": elst,
            "tiles_exactly": bw["tiles_exactly"], "ends_on_fragment_boundary": bool(frags) and frags[-1][1] == len(data),
            "running_hash_mismatches": mism, "running_hash_final_equals_whole_file": running.hexdigest() == whole, "chain_sha256": chain.hex(),
            "tail_cut": {"box_walk_tiles_exactly": cb["tiles_exactly"], "ffprobe_rc": probe.returncode, "decoder_rc": dec.returncode, "decoder_error_lines": len(dec.stderr.strip().splitlines())},
            "first_video_packets_pts_dts_duration": first_video(p), "streams": json.loads(trak.stdout)["streams"],
        }
        os.remove(cut)
        r = res["VIDEO-0%d" % i]
        ok &= r["tiles_exactly"] and r["ends_on_fragment_boundary"] and r["running_hash_mismatches"] == 0 and r["running_hash_final_equals_whole_file"] and r["tail_cut"]["box_walk_tiles_exactly"] is False
    rows = info["info"]["size_samples"]
    res["sizes_during_session"] = {"first_sample_with_a_file": next((r for r in rows if r[1] is not None), None), "samples_without_file": sum(1 for r in rows if r[1] is None), "samples": len(rows)}
    res["video_started_log"] = info.get("video_started_log")
    finish(res, ok, a.expect_fail)


# ------------------------------------------------------------------------------------------ supervisor end to end (part P6)
class Driver:
    """The REAL capture supervisor (createCaptureSupervisor + the process launcher of ipc.ts) in a tsx process."""

    def __init__(self, d, config):
        self.events, self.lock = [], threading.Lock()
        cfg = os.path.join(d, "driver.json")
        json.dump(config, open(cfg, "w"), indent=1)
        self.p = subprocess.Popen(["npx", "tsx", DRIVER, cfg], cwd=REPO, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=open(os.path.join(d, "driver.err"), "w"), start_new_session=True)
        threading.Thread(target=self._read, daemon=True).start()

    def _read(self):
        for line in self.p.stdout:
            try:
                e = json.loads(line)
            except ValueError:
                continue
            e["_t"] = time.monotonic()
            with self.lock:
                self.events.append(e)

    def say(self, **cmd):
        self.p.stdin.write((json.dumps(cmd) + "\n").encode())
        self.p.stdin.flush()

    def all(self, kind=None):
        with self.lock:
            return [e for e in self.events if kind is None or e.get("event") == kind]

    def wait(self, pred, timeout, what):
        end = time.monotonic() + timeout
        while time.monotonic() < end:
            hit = [e for e in self.all() if pred(e)]
            if hit:
                return hit[0]
            if self.p.poll() is not None:
                raise RuntimeError("driver exited (rc %s) while waiting for %s" % (self.p.returncode, what))
            time.sleep(0.02)
        raise RuntimeError("timeout waiting for %s; last events: %r" % (what, self.all()[-5:]))

    def status(self):
        n = len(self.all("status"))
        self.say(cmd="status")
        self.wait(lambda e: len(self.all("status")) > n, 5, "status")
        return self.all("status")[-1]["status"]

    def close(self):
        if self.p.poll() is None:
            try:
                self.say(cmd="exit")
                self.p.wait(timeout=20)
            except Exception:
                pass
        if self.p.poll() is None:
            try:
                os.killpg(self.p.pid, signal.SIGKILL)
            except (ProcessLookupError, PermissionError):     # gone already (macOS answers EPERM for a group of zombies)
                pass
            self.p.wait()


def sup_session(drv, d, sid, truth, procs, seconds_after=1.5, kill_at=None, frames_cap=None):
    """One session through the supervisor. kill_at: 'before' = SIGKILL the worker right after RECORDING, before any
    source starts (no fragment can exist); 'after' = after the first durable record."""
    plan = make_plan(d, sid)
    json.dump(plan, open(os.path.join(d, "plan.json"), "w"), indent=1)
    out = {"sessionId": sid, "plan_outputs": [c["outputPath"] for c in plan["cameras"]]}
    t = time.monotonic()
    drv.say(cmd="start", sessionId=sid, plan=plan)
    drv.wait(lambda e: e.get("event") == "started" and e.get("sessionId") == sid, 15, "started " + sid)
    out["start_ms"] = round((time.monotonic() - t) * 1000, 1)
    st = drv.status()
    out["worker_pid"] = st["workerPid"]
    if kill_at == "before":
        os.kill(st["workerPid"], signal.SIGKILL)
        drv.wait(lambda e: e.get("event") == "phase" and e.get("sessionId") == sid and e.get("phase") in ("RECORDING", "FAULTED") and e.get("previous") in ("RESTARTING", "RECORDING") and e is not None and e["_t"] > t, 15, "restart of " + sid)
        if drv.status()["phase"] == "FAULTED":               # the control with no restart allowed
            out["not_restarted"] = True
            drv.say(cmd="stop", sessionId=sid, reason="CRASH")
            drv.wait(lambda e: e.get("event") == "stopped" and e.get("sessionId") == sid, 30, "stopped " + sid)
            return plan, out
        st2 = drv.status()
        out["respawned_pid"] = st2["workerPid"]
        out["attempt_after_kill"] = st2["attempt"]
    sampler = Sampler(plan)
    sampler.start()
    mic_seconds = (truth["epoch_us"] / 1e6 - time.time()) + max(c["frames"] for c in truth["cams"]) / FPS + seconds_after + 6
    mic, cps = start_sources(d, truth, plan, procs, mic_seconds)
    if kill_at == "after":
        drv.wait(lambda e: e.get("event") == "record" and e.get("sessionId") == sid and e.get("seq") == 4, 60, "both durable records of " + sid)
        time.sleep(2.5)
        pid = drv.status()["workerPid"]
        out["sizes_before_kill"] = sizes(plan)
        os.kill(pid, signal.SIGKILL)
        drv.wait(lambda e: e.get("event") == "phase" and e.get("sessionId") == sid and e.get("phase") == "FAULTED", 15, "FAULTED " + sid)
        time.sleep(3.0)                                    # every back-off there could be: nothing may start
        out["status_after_kill"] = drv.status()
        out["sizes_3s_after_kill"] = sizes(plan)
        killall([mic] + cps)
    else:
        for cp in cps:
            cp.wait(timeout=120)
        time.sleep(seconds_after)
    sampler.on = False
    out["size_samples"] = sampler.rows
    t = time.monotonic()
    drv.say(cmd="stop", sessionId=sid, reason="STOPPED" if kill_at != "after" else "CRASH")
    drv.wait(lambda e: e.get("event") == "stopped" and e.get("sessionId") == sid, 30, "stopped " + sid)
    out["stop_ms"] = round((time.monotonic() - t) * 1000, 1)
    killall([mic] + cps)
    return plan, out


def cmd_sup(a):
    """mode run    : M3-WI-1 through the real supervisor: two files from one encoder, growing, records, telemetry.
       mode kc1    : M3-KC-1 file half: a session whose worker is killed after its durable record ends FAULTED with no
                     respawn (option C), its files keep their durable prefix untouched, and the NEXT session on the same
                     supervisor gets a new process and a fresh playable file.
       mode kc3    : M3-KC-3 on the real worker: killed BEFORE any fragment -> respawned with back-off, same paths,
                     and the respawned worker records playable files."""
    d = rundir(a.name, fresh=True)
    if tcp_listeners():
        sys.exit("ports busy before start: %r" % tcp_listeners())
    procs, res, ok = [], {"check": "supervisor + real worker (%s)" % a.mode, "run": a.name}, True
    cfg = {"command": VARIANTS[a.variant], "args": ["--log", os.path.join(d, "worker.jsonl"), "--audio-manifest", os.path.join(d, "manifest.jsonl")] + (["--listen-timeout-s", "4"] if a.mode == "nocam" else []),
           "limits": json.loads(a.limits)}
    drv = Driver(d, cfg)
    procs.append(drv.p)
    try:
        drv.wait(lambda e: e.get("event") == "booted", 30, "driver booted")
        if a.mode == "run":
            truth = build_truth(a.case)
            json.dump(truth, open(os.path.join(d, "truth.json"), "w"), indent=1)
            plan, out = sup_session(drv, d, "S-M3SUP-RUN", truth, procs)
            res["session"] = out
            paths = out["plan_outputs"]
            pl = [playable(p) for p in paths]
            res["files"] = {os.path.basename(p): r for p, (_, r) in zip(paths, pl)}
            rows = [r for r in out["size_samples"] if r[1] is not None and r[2] is not None]
            grew = [len(set(r[i] for r in rows)) for i in (1, 2)]
            res["growth"] = {"samples_with_both_files": len(rows), "distinct_sizes_per_file": grew}
            o4, r4 = h4(d, paths)
            oav, rav = av_offsets(d, truth, paths)
            res["h4_one_encoder_both_files"], res["av_offsets"] = r4, rav
            recs = drv.all("record")
            res["records"] = [[e["seq"], e["record"]["kind"], e["record"]["deviceId"]] for e in recs]
            ok &= all(o for o, _ in pl) and min(grew) >= 3 and o4 and oav and [r[0] for r in res["records"]] == [1, 2, 3, 4] and sorted(r[1] for r in res["records"]) == ["FIRST_DURABLE_FRAGMENT"] * 2 + ["FIRST_VIDEO_SAMPLE"] * 2
        elif a.mode == "kc1":
            truth1 = build_truth("zero", frames_override=(600, 600))
            os.makedirs(d + "/s1", exist_ok=True)
            plan1, out1 = sup_session(drv, d + "/s1", "S-M3SUP-KC1-A", truth1, procs, kill_at="after")
            res["session1_killed_after_durable_record"] = out1
            st = out1["status_after_kill"]
            pl1 = [playable(p) for p in out1["plan_outputs"]]
            res["session1_files"] = {os.path.basename(p): r for p, (_, r) in zip(out1["plan_outputs"], pl1)}
            downs = [e for e in drv.all("workerDown") if e["sessionId"] == "S-M3SUP-KC1-A"]
            faults = [e for e in drv.all("warning") if e["sessionId"] == "S-M3SUP-KC1-A" and e["source"] == "supervisor"]
            res["session1_worker_down"] = [[e["down"]["code"], e["down"]["signal"], e["restartInMs"]] for e in downs]
            ok &= st["phase"] == "FAULTED" and st["durable"] is True and st["attempt"] == 1 and st["workerPid"] is None and len(downs) == 1 and downs[0]["restartInMs"] is None and len(faults) == 1
            # The durable prefix: untouched after the kill, fragment-aligned, playable.
            ok &= out1["sizes_before_kill"] == out1["sizes_3s_after_kill"] == sizes(plan1) and all(o for o, _ in pl1)
            truth2 = build_truth("zero")
            json.dump(truth2, open(os.path.join(d, "truth.json"), "w"), indent=1)
            os.makedirs(d + "/s2", exist_ok=True)
            # The second worker's manifest must not be the first one's: a fresh pair of diagnostic files.
            plan2, out2 = sup_session(drv, d + "/s2", "S-M3SUP-KC1-B", truth2, procs)
            res["session2_next_session"] = out2
            pl2 = [playable(p) for p in out2["plan_outputs"]]
            res["session2_files"] = {os.path.basename(p): r for p, (_, r) in zip(out2["plan_outputs"], pl2)}
            oav, rav = av_offsets(d, truth2, out2["plan_outputs"])
            res["session2_av_offsets"] = rav
            ok &= all(o for o, _ in pl2) and oav and out2["worker_pid"] != out1["worker_pid"] and set(out2["plan_outputs"]).isdisjoint(out1["plan_outputs"])
            recs2 = [e for e in drv.all("record") if e["sessionId"] == "S-M3SUP-KC1-B"]
            ok &= [e["seq"] for e in recs2] == [1, 2, 3, 4]
        elif a.mode == "kc3":
            truth = build_truth("zero", lead_us=9_000_000)
            json.dump(truth, open(os.path.join(d, "truth.json"), "w"), indent=1)
            plan, out = sup_session(drv, d, "S-M3SUP-KC3", truth, procs, kill_at="before")
            res["session"] = out
            if out.get("not_restarted"):
                res["worker_down"] = [[e["down"]["code"], e["down"]["signal"], e["restartInMs"]] for e in drv.all("workerDown")]
                finish(res, False, a.expect_fail, d)
            downs = [e for e in drv.all("workerDown")]
            res["worker_down"] = [[e["down"]["code"], e["down"]["signal"], e["restartInMs"]] for e in downs]
            pl = [playable(p) for p in out["plan_outputs"]]
            res["files"] = {os.path.basename(p): r for p, (_, r) in zip(out["plan_outputs"], pl)}
            oav, rav = av_offsets(d, truth, out["plan_outputs"])
            res["av_offsets"] = rav
            ok &= out["attempt_after_kill"] == 2 and out["respawned_pid"] != out["worker_pid"] and len(downs) == 1 and downs[0]["restartInMs"] == drv.all("booted")[0]["limits"]["backoffBaseMs"]
            ok &= all(o for o, _ in pl) and oav
        elif a.mode == "nocam":
            # D72(k) through the supervisor: no camera connects -> the session does not stay "recording" with nothing durable.
            plan = make_plan(d, "S-M3SUP-NOCAM")
            drv.say(cmd="start", sessionId="S-M3SUP-NOCAM", plan=plan)
            drv.wait(lambda e: e.get("event") == "started", 15, "started")
            mic = subprocess.Popen([MIC, "--out1", plan["mics"][0]["input"]["path"], "--out2", plan["mics"][1]["input"]["path"], "--manifest", os.path.join(d, "mic.jsonl"), "--seconds", "20"],
                                   stdin=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True)
            procs.append(mic)
            t = time.monotonic()
            drv.wait(lambda e: e.get("event") == "phase" and e.get("phase") == "FAULTED", 20, "FAULTED")
            res["seconds_to_faulted"] = round(time.monotonic() - t, 2)
            time.sleep(3.0)
            st = drv.status()
            downs = drv.all("workerDown")
            res["status"] = {k: st[k] for k in ("phase", "attempt", "durable", "workerPid")}
            res["worker_down"] = [[e["down"]["code"], e["down"]["detail"], e["down"]["exitCode"], e["restartInMs"]] for e in downs]
            res["warnings"] = [[e["code"], e["state"], e["subject"], e["source"]] for e in drv.all("warning")]
            res["files_exist"] = [os.path.exists(c["outputPath"]) for c in plan["cameras"]]
            drv.say(cmd="stop", sessionId="S-M3SUP-NOCAM", reason="CRASH")
            drv.wait(lambda e: e.get("event") == "stopped", 20, "stopped")
            ok &= res["status"] == {"phase": "FAULTED", "attempt": 1, "durable": False, "workerPid": None} and res["files_exist"] == [False, False]
            ok &= len(downs) == 1 and res["worker_down"][0][1] == "NO_CAMERA_CONNECTED" and res["worker_down"][0][3] is None
            ok &= sorted(w[2] or "" for w in res["warnings"]) == ["", "CAM-01", "CAM-02"] and res["seconds_to_faulted"] < 12
        res["timing"] = [e for e in drv.all("timing")]
        res["supervisor_reports"] = [e for e in drv.all("report")]
        ok &= not res["supervisor_reports"]
    finally:
        drv.close()
        killall(procs)
    time.sleep(0.3)
    res["leftovers"] = leftovers()
    ok &= not res["leftovers"]["processes"] and not res["leftovers"]["listeners"]
    finish(res, ok, a.expect_fail, d)


def main():
    ap = argparse.ArgumentParser()
    sp = ap.add_subparsers(dest="cmd", required=True)
    sp.add_parser("build").set_defaults(fn=cmd_build)

    def case(name, fn, **extra):
        p = sp.add_parser(name)
        p.add_argument("name")
        p.add_argument("--variant", choices=list(VARIANTS), default="worker")
        p.add_argument("--expect-fail", action="store_true")
        for k, v in extra.items():
            p.add_argument("--" + k, **v)
        p.set_defaults(fn=fn)

    case("session", cmd_session, case={"choices": list(CASES), "default": "zero"}, switch={"action": "store_true"}, tap={"action": "store_true"}, stall={"action": "store_true"})
    case("h4neg", cmd_h4neg)
    case("proto", cmd_proto)
    case("camstop", cmd_camstop)
    case("fatal", cmd_fatal, mode={"choices": ["rmdir", "planted", "exists", "clean"], "required": True})
    case("udp", cmd_udp)
    case("shape", cmd_shape)
    case("mic", cmd_mic, mode={"choices": ["slow", "gap"], "required": True})
    case("nocam", cmd_nocam, mode={"choices": ["none", "one"], "required": True})
    case("sup", cmd_sup, mode={"choices": ["run", "kc1", "kc3", "nocam"], "required": True}, case={"choices": list(CASES), "default": "zero"},
         limits={"default": "{}", "help": "overrides of CAPTURE_IPC_DEFAULTS as JSON (negative controls: '{\"maxRestarts\":0}')"})
    a = ap.parse_args()
    a.fn(a)


if __name__ == "__main__":
    main()
