#!/usr/bin/env python3
"""Capture end-to-end harness: the REAL capture worker on the NM-14 fixtures (blueprint rows 58
and 60; checks M3-WI-1, M3-AV-1, M3-AV-2 (a)/(b), M3-RTSP-BIND-1, M3-KC-1 file half, M3-KC-3, the
H-4 regression, continuity AU2-05, the long-GOP camera, the mux-flag evaluation of row 58 part P4).
Test code only. It binds two loopback ports of 8554-8564 (default 127.0.0.1:8555 and :8557; set
M3_PORTS=8559,8561 to use another pair; the D60 `plan4` check takes two further free ports of the
same range for its four-camera plan), so it needs the sandbox off.

    make -C apps/capture-worker e2e                        THE documented entry point (test/e2e.py):
                                                           the whole series, one aggregate exit code
    python3 apps/capture-worker/test/m3worker.py build     the worker, its proof builds, the fixtures
    python3 apps/capture-worker/test/m3worker.py <case> <run name> [options]      one check

Sources: two fake cameras (`test-fixtures/fake_cam.c`, a separate process each with its own clock,
RTSP push over TCP) and the fake mics of `test-fixtures/fake_mic.c` (ONE separate process with its
own clock reads and, with --ppm, its own sample clock; capture spec W-5). The analysers are
`test-fixtures/av_analyse.py`. Nothing is read from the docs tree or from git history.
This script is the supervisor's stand-in for the worker-level cases: it speaks
@dems/capture-protocol on the worker's standard streams, with an EMPTY environment. The cases that
need the real supervisor go through `apps/core-server/test/support/capture-session-driver.ts`
(sub-command `sup`).

Everything a run writes lands under .cache/m3worker/ (git-ignored): 0 media in git (OD-25).
Every check prints one JSON result with "verdict" and, where the case names them, "criteria"
(one PASS/FAIL each). A negative control must FAIL and is run with --expect-fail, which turns its
failure into exit 0 and its success into exit 1; with --must-fail-on a,b it must fail on exactly
those criteria (plus any named by --may-fail-on): a control that fails for another reason is an
error, not a pass.

Leftovers are judged on the processes THIS run started (their process groups and descendants),
never on program names host-wide (pair-58 re-check R-7): another harness on the same host is not
ours, and ours cannot hide behind it.
"""
import argparse, hashlib, json, os, shutil, signal, socket, struct, subprocess, sys, threading, time
from fractions import Fraction

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
APP = os.path.join(REPO, "apps", "capture-worker")
BUILD = os.path.join(APP, "build")
FIX = os.path.join(APP, "test-fixtures")                 # NM-14: the fixture set (capture spec A.8)
RUNS = os.environ.get("M3_RUNS") or os.path.join(REPO, ".cache", "m3worker", "runs")
WORKER = os.path.join(BUILD, "capture-worker")
VARIANTS = {"worker": WORKER, "negctl": os.path.join(BUILD, "capture-worker-negctl"), "delaymoov": os.path.join(BUILD, "capture-worker-delaymoov"),
            "skeleton": os.path.join(BUILD, "capture-worker-skeleton111"), "norefusal": os.path.join(BUILD, "capture-worker-norefusal"), "nocomp": os.path.join(BUILD, "capture-worker-nocomp")}
CAM, MIC = os.path.join(BUILD, "fake_cam"), os.path.join(BUILD, "fake_mic")
# Audit row 152b (N-31; D135): the proof build `intervalskew` (the interval record of a switch one chunk late) is gone with the switch.
# Fix pass F-M3 (review 16): the clock floor judged but not acted on (R63-12), and no fragment size bound (R63-02).
# Both are PROOF builds: they say so in HELLO and are driven by THIS script only - the supervisor refuses them.
VARIANTS.update({"nofloor": os.path.join(BUILD, "capture-worker-nofloor"), "nobound": os.path.join(BUILD, "capture-worker-nobound")})
if os.environ.get("M3_WORKER_BEFORE"):          # a worker built from an EARLIER tree, outside this one: the red run of a new check
    VARIANTS["before"] = os.environ["M3_WORKER_BEFORE"]
DRIVER = os.path.join(REPO, "apps", "core-server", "test", "support", "capture-session-driver.ts")
PORT_MIN, PORT_MAX = 8554, 8564                      # CAPTURE_MEDIA_PORT_MIN/MAX: every fixture and worker listener (SEC35-23)
RESERVED_PORTS = (8554, 8556, 8558)                  # the Android emulators' gRPC endpoints on this host: never touched
PORTS = tuple(int(x) for x in os.environ.get("M3_PORTS", "8555,8557").split(","))
# D60 (2026-11-04): two to four ports (the plan may carry up to four cameras); the series still runs on a pair.
if not 2 <= len(PORTS) <= 4 or len(set(PORTS)) != len(PORTS) or any(p < PORT_MIN or p > PORT_MAX or p in RESERVED_PORTS for p in PORTS):
    sys.exit("M3_PORTS must name two to four different ports of %d-%d other than %r" % (PORT_MIN, PORT_MAX, RESERVED_PORTS))
# Ports of other systems on this host that no process of a run may ever hold or reach (the SMART WMS stack and the
# DEMS dev servers): checked on every socket snapshot.
FOREIGN_PORTS = frozenset((5173, 5174, 5175, 5176, 5177, 5178, 8000, 5432, 4421, 4422, 4423, 4432, 8081))
V = 6                           # CAPTURE_PROTOCOL_VERSION (row 59: 3 since the checkpoint content; row 71: 4 since the microphone rows; task 4 row N3: 5 since the sample account; W3 rows 144/151: 6 since the paired channel - camera rows of 7 members)
FPS, FRAME_US, SR = 50, 20000, 48000
REGRESSION_MS, PRODUCT_MS = 2.0, 40.0      # two different tolerances (AU2-04): never merged
PRIMING = 1024
ROW58_RECORD_KINDS = ("FIRST_VIDEO_SAMPLE", "FIRST_DURABLE_FRAGMENT")     # once per camera (row 58); row 59 adds FRAGMENT_CHECKPOINT and KEYFRAME_INTERVAL
CASES = {  # per camera: (injected offset ms, drift ppm); flash/beep events per camera
    "zero": {"cams": [(0, 0.0), (0, 0.0)], "events": 3},
    "pm80": {"cams": [(80, 0.0), (-80, 0.0)], "events": 3},
    "drift": {"cams": [(0, 200.0), (0, -200.0)], "events": 8},
    "long": {"cams": [(0, 0.0), (0, 0.0)], "events": 8},
}

sys.dont_write_bytecode = True      # no cache file is left beside the fixtures
sys.path.insert(0, FIX)
import av_analyse as P111       # the NM-14 analysers (vendored and corrected row-111 code): box walk, packets, onsets, flashes
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
    """Listeners on the two media ports of this run, whoever owns them (the "ports busy" check before a start)."""
    txt = sh(["lsof", "-nP", "-iTCP", "-sTCP:LISTEN"]).stdout
    return [l for l in txt.splitlines() if any(l.rstrip().endswith(":%d (LISTEN)" % p) for p in PORTS)]


PORT_WAIT_S = float(os.environ.get("M3_PORT_WAIT_S", "90"))


def port_holders(rows):
    """The lsof rows of the listeners, each with the command line of its process: WHO holds the port (integration
    pass E2: `node 62736` alone did not say that it was a test worker of another suite)."""
    out = []
    for l in rows:
        parts = l.split()
        cmd = sh(["ps", "-o", "command=", "-p", parts[1]]).stdout.strip() if len(parts) > 1 and parts[1].isdigit() else ""
        out.append("%s  <- %s" % (" ".join(parts), cmd[:240] or "?"))
    return out


def ports_free_or_exit():
    """The guard before a check starts anything: nobody listens on the two media ports of this run. This process has
    started nothing yet, so a listener is NOT of this check: a fixture of another suite on the shared range 8554-8564
    (the fake ONVIF stub of the core-server unit tests takes its two TCP ports from the TOP of the range and holds them
    for seconds) or what an earlier check left. It is waited for, up to M3_PORT_WAIT_S (default 90 s), and NAMED on
    standard error either way; a port still held after that ends the check without a verdict, as before. Nothing is
    hidden by the wait: every check judges its own leftovers (`no_leftover`), and the runner looks at both ports again
    after the series."""
    rows = tcp_listeners()
    if not rows:
        return
    t0, first = time.monotonic(), port_holders(rows)
    while rows and time.monotonic() - t0 < PORT_WAIT_S:
        time.sleep(0.5)
        rows = tcp_listeners()
    if rows:
        sys.exit("ports busy before start: %r (waited %.0f s; first seen: %r)" % (port_holders(rows), time.monotonic() - t0, first))
    sys.stderr.write("ports were busy for %.1f s before start, free now; the holder was not of this check: %r\n" % (time.monotonic() - t0, first))


# Every process this run started, and the pids a process of ours started on our behalf (the worker the
# supervisor launched). Leftovers and socket snapshots are taken over THESE, never over program names.
OWN, OWN_EXTRA_PIDS = [], set()


def spawn(args, **kw):
    """Popen in a process group of its own, remembered as ours."""
    kw.setdefault("start_new_session", True)
    p = subprocess.Popen(args, **kw)
    OWN.append(p)
    return p


def own_processes():
    """Live processes that are ours: in a process group we created, a pid we were told about, or a descendant of either."""
    rows = []
    for line in sh(["ps", "-axo", "pid=,ppid=,pgid=,stat=,command="]).stdout.splitlines():
        parts = line.split(None, 4)
        if len(parts) == 5 and not parts[3].startswith("Z"):
            rows.append((int(parts[0]), int(parts[1]), int(parts[2]), parts[4]))
    groups = {p.pid for p in OWN}
    mine = {pid for pid, _, pgid, _ in rows if pgid in groups or pid in groups or pid in OWN_EXTRA_PIDS}
    grew = True
    while grew:
        more = {pid for pid, ppid, _, _ in rows if ppid in mine and pid not in mine}
        grew = bool(more)
        mine |= more
    mine.discard(os.getpid())
    return [(pid, cmd) for pid, _, _, cmd in rows if pid in mine]


def endpoints(row):
    """(host, port) of both ends of one lsof row: 'TCP 127.0.0.1:8555->127.0.0.1:53211 (ESTABLISHED)' or 'UDP *:5000'."""
    parts = row.split()
    name = parts[8] if len(parts) > 8 else ""
    out = []
    for end in name.split("->"):
        host, _, port = end.rpartition(":")
        out.append((host, port))
    return out


def judge_sockets(rows):
    udp = [l for l in rows if " UDP " in l]
    off = [l for l in rows if any(h != "127.0.0.1" for h, _ in endpoints(l))]
    foreign = [l for l in rows if any(p.isdigit() and int(p) in FOREIGN_PORTS for _, p in endpoints(l))]
    listen = sorted({"%s:%s" % e for l in rows if "(LISTEN)" in l for e in endpoints(l)})
    return {"rows": rows, "udp": udp, "not_loopback": off, "foreign_ports": foreign, "listeners": listen}


def sockets_of(pid):
    """Every internet socket of one process, TCP and UDP (M3-RTSP-BIND-1 as widened by erratum PE-111-03).
    Loopback means BOTH ends of a connection are 127.0.0.1, not that the text occurs in the row."""
    return judge_sockets([l for l in sh(["lsof", "-nP", "-a", "-p", str(pid), "-i"]).stdout.splitlines()[1:] if l.strip()])


def own_sockets():
    """Every internet socket of every live process of this run (worker, fixtures, supervisor driver): the
    listener snapshot of the row - 127.0.0.1 only, inside 8554-8564, no port of another system."""
    pids = [pid for pid, _ in own_processes()]
    if not pids:
        return judge_sockets([])
    s = judge_sockets([l for l in sh(["lsof", "-nP", "-a", "-p", ",".join(str(p) for p in pids), "-i"]).stdout.splitlines()[1:] if l.strip()])
    s["processes"] = len(pids)
    s["listeners_outside_range"] = [l for l in s["listeners"] if not (l.rpartition(":")[2].isdigit() and PORT_MIN <= int(l.rpartition(":")[2]) <= PORT_MAX)]
    return s


def sockets_clean(s, udp_allowed=False):
    return not s["not_loopback"] and not s["foreign_ports"] and not s.get("listeners_outside_range") and (udp_allowed or not s["udp"])


def leftovers():
    """What this run left behind: its own processes still alive and the listeners they hold. A process of
    another run on this host (same program names, other ports) is not ours and is not reported (R-7)."""
    procs = own_processes()
    pids = {pid for pid, _ in procs}
    held = []
    for l in sh(["lsof", "-nP", "-iTCP", "-sTCP:LISTEN"]).stdout.splitlines()[1:]:
        parts = l.split()
        if len(parts) > 1 and parts[1].isdigit() and int(parts[1]) in pids:
            held.append(l.strip())
    return {"processes": ["%d %s" % (pid, cmd[:150]) for pid, cmd in procs], "listeners": held}


class Crit(dict):
    """Named criteria of one check: v("name", condition). The verdict is their conjunction, and a negative
    control states WHICH of them it must fail on."""

    def __call__(self, name, cond):
        self[name] = bool(cond) and self.get(name, True)
        return bool(cond)

    @property
    def ok(self):
        return all(self.values())


ARGS = None     # the parsed command line (for --must-fail-on / --may-fail-on)


def finish(result, ok, expect_fail=False, d=None, crit=None):
    if crit is not None:
        ok = bool(ok) and crit.ok
        result["criteria"] = {k: ("PASS" if v else "FAIL") for k, v in crit.items()}
        result["failed_criteria"] = sorted(k for k, v in crit.items() if not v)
    result["verdict"] = "PASS" if ok else "FAIL"
    must = [x for x in (getattr(ARGS, "must_fail_on", None) or "").split(",") if x]
    may = [x for x in (getattr(ARGS, "may_fail_on", None) or "").split(",") if x]
    good = ok != expect_fail
    if expect_fail:
        result["negative_control"] = "failed as required" if not ok else "DID NOT FAIL - the control is broken"
        if must and not ok:
            failed = set(result.get("failed_criteria", []))
            if not set(must) <= failed or not failed <= set(must) | set(may):
                result["negative_control"] = "FAILED FOR ANOTHER REASON - expected exactly %r (optionally %r), failed on %r" % (sorted(must), sorted(may), sorted(failed))
                good = False
            else:
                result["negative_control"] = "failed as required, on %s" % ", ".join(sorted(failed))
    elif must:
        sys.exit("--must-fail-on needs --expect-fail")
    if d:
        json.dump(result, open(os.path.join(d, "result.json"), "w"), indent=1)
    print(json.dumps(result, indent=1))
    sys.exit(0 if good else 1)


# ------------------------------------------------------------------------------------------ build
def cmd_build(_):
    os.makedirs(BUILD, exist_ok=True)
    # Everything is built by the Makefile from sources in this folder tree: the worker (with its static rules and
    # unit checks), the proof builds, and the NM-14 fixtures incl. the vendored row-111 skeleton (the binary the
    # widened bind check must FAIL on). No file of the docs tree and no commit is read (pair-58 F-14).
    subprocess.run(["make", "-C", APP, "all", "proof", "fixtures"], check=True)
    print(json.dumps({"built": sorted(n for n in os.listdir(BUILD) if not n.endswith(".dSYM"))}))


# ------------------------------------------------------------------------------------------ the worker under test
class Worker:
    """One worker process driven over its standard streams, with an EMPTY environment (protocol rule)."""

    def __init__(self, d, binary=WORKER, heartbeat_ms=500, listen_timeout_s=12, manifest=True, extra=()):
        self.d, self.frames, self.raw, self.lock = d, [], [], threading.Lock()
        args = [binary, "--log", os.path.join(d, "worker.jsonl"), "--heartbeat-ms", str(heartbeat_ms), "--listen-timeout-s", str(listen_timeout_s)] + list(extra)   # extra: named settings (row 71)
        if manifest:
            args += ["--audio-manifest", os.path.join(d, "manifest.jsonl")]
        self.t_spawn = time.monotonic()
        self.p = spawn(args, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, env={})
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


def make_plan(d, sid, cams=2, mics=4, tap=None, names=None, mic_out=True):       # D61 (2026-11-04): FOUR numbered channels by default; protocol 6 (row 151): 0..4 lines, each with its OWN audio file (`mic_out=False` builds the refused protocol-5 row). D60 (2026-11-04): up to NCAM=4 camera entries
    os.makedirs(os.path.join(d, "media"), exist_ok=True)
    names = tuple(names or ["cam%d" % (i + 1) for i in range(cams)])      # the ingest path of camera i (default: cam1..cam4)
    ports = list(PORTS) + [p for p in range(PORT_MIN + 1, PORT_MAX + 1) if p not in PORTS and p not in RESERVED_PORTS]   # a 4-camera plan takes four distinct ports
    fifos = []
    for i in range(mics):
        p = os.path.join(d, "mic%d.pcm" % (i + 1))
        if not os.path.exists(p):
            os.mkfifo(p, 0o600)
        fifos.append(p)
    return {
        "cameras": [{"deviceId": "CAM-0%d" % (i + 1), "trackId": "VIDEO-0%d" % (i + 1), "profile": None, "ingestUrl": "rtsp://127.0.0.1:%d/%s" % (ports[i], names[i]),
                     "outputPath": os.path.join(d, "media", "VIDEO-0%d.mp4" % (i + 1)),
                     # Protocol 6 (D5 N-12, D30 K-3; rows 144/151): the camera's paired channel (VIDEO-0N -> MIC-0N) and, when the
                     # plan holds no row of it, why not - the plan builder states NOT_ASSIGNED for a channel it leaves out.
                     "micChannel": "MIC-0%d" % (i + 1), "micMissing": None if i < mics else "NOT_ASSIGNED"} for i in range(cams)],
        # D61 (2026-11-04): the microphone row is keyed by its numbered CHANNEL (was the two-role lane's `role`);
        # `outputPath` is the channel's own audio file - REQUIRED since protocol 6 (N-13, row 151).
        "mics": [dict({"deviceId": "MIC-0%d" % (i + 1), "channel": "MIC-0%d" % (i + 1), "input": {"kind": "PCM_FIFO", "path": fifos[i]}},
                      **({"outputPath": os.path.join(d, "media", "MIC-0%d.m4a" % (i + 1))} if mic_out else {})) for i in range(mics)],
        "activeMic": "MIC-01",      # D61: the transcribed channel of AUDIO-01 (was the failover pair's start role, "PRIMARY")
        "pcmTapPath": tap,
        "constants": {"fragmentTargetMs": 2000, "minFragDurationMs": 2000, "gopFrames": 50, "meterRateHz": 20, "audioSampleRateHz": 48000, "audioChannels": 1},
    }


def build_truth(case_name, lead_us=5_000_000, frames_override=None, gop=FPS):
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
    return {"case": case_name, "epoch_us": c0, "frames": frames, "gop": gop, "cams": cams, "beeps": sorted(beeps)}


def mic_out_args(plan):
    """--out<k> for EVERY microphone line of the plan (D61, 2026-11-04: four numbered channels; was out1/out2)."""
    return sum([["--out%d" % (i + 1), m["input"]["path"]] for i, m in enumerate(plan["mics"])], [])


def beep_on_args(plan):
    """THE BEEPS OF A PAIR (audit row 152b; D5 pairs, row 152, D135): camera N's file carries its pair's channel MIC-0N,
    so the flash-to-beep check of camera N needs the beeps on channel N. The reference beeps go on every channel that
    is the pair of a camera of the plan (fake_mic.c `--beep-on`; same onsets, one manifest). Until row 152 every camera
    file carried channel 1 (or the switched channel 2), and channel 1 alone carried the beeps."""
    chans = [c["micChannel"][-1] for c in plan["cameras"] if not c.get("micMissing") and any(m["channel"] == c["micChannel"] for m in plan["mics"])]
    return ["--beep-on", ",".join(sorted(set(chans)))] if chans else []


# Audit row W3F (D142; ENV-W3TW-1 option (a)): THE CAMERA OF A RUN. `c` (the default) is the C camera build/fake_cam: it
# pushes through libavformat and needs an H.264 encoder in the FFmpeg it links, which the ruled /opt/dems/ffmpeg-9.0.2 lacks
# (`FAKE_CAM FATAL libx264 missing`). `sr` is the program camera test-fixtures/fake_cam_sr.py: the same picture, flashes and
# GOP, encoded with the test ffmpeg CAMERA_FFMPEG (D131), with true sender reports. e2e.py sets M3_CAMERA for every check:
# `sr` only for the D5 cases that accept it (av1_zero_tap and the checks on its files, m5_tap_one_interval,
# n3_gapped_measured), `c` for every other check. A claimed epoch becomes the `sr` camera's wall-clock offset (the same
# report pairs as the C camera's at 0 ppm); a drifting media clock under libavformat's linear reports, and extra C-camera
# arguments (--noise), have no `sr` counterpart: such a case refuses to run with `sr` instead of measuring something else.
CAMERA_KIND = os.environ.get("M3_CAMERA") or "c"
if CAMERA_KIND not in ("c", "sr"):
    sys.exit("M3_CAMERA must be c or sr, not %r" % CAMERA_KIND)


def camera_kind_check(truth):
    """Called before any source starts: a case the `sr` camera cannot stand in for stops here, not mid-run."""
    if CAMERA_KIND == "sr" and (any(c["drift_ppm"] for c in truth["cams"]) or truth.get("cam_extra")):
        sys.exit("M3_CAMERA=sr: case %r needs the C camera (drift %r ppm, extra %r): ENV-W3TW-1, BLOCKED-ENV on a host without libx264"
                 % (truth.get("case"), [c["drift_ppm"] for c in truth["cams"]], list(truth.get("cam_extra", ()))))


def camera_spawn(d, truth, c, pc):
    """ONE camera of the plan (`pc`) for the camera truth `c`, of this run's CAMERA_KIND; its stderr is cam<N>.err."""
    err = open(os.path.join(d, "cam%d.err" % c["cam"]), "w")
    if CAMERA_KIND == "sr":
        return spawn([sys.executable, "-B", CAM_SR, "--url", pc["ingestUrl"], "--epoch-us", str(truth["epoch_us"]), "--work", d, "--frames", str(c["frames"]),
                      "--flash-first", str(c["flash_first"]), "--flash-every", str(c["flash_every"]), "--gop", str(truth.get("gop", FPS)),
                      "--clock-offset-ms", repr((c["claimed_epoch_us"] - truth["epoch_us"]) / 1000.0)],
                     stdin=subprocess.DEVNULL, stderr=err, env=dict(os.environ, DEMS_FFMPEG=CAMERA_FFMPEG or ""))
    return spawn([CAM, "--url", pc["ingestUrl"], "--epoch-us", str(truth["epoch_us"]), "--claimed-epoch-us", str(c["claimed_epoch_us"]),
                  "--drift-ppm", str(c["drift_ppm"]), "--frames", str(c["frames"]), "--flash-first", str(c["flash_first"]), "--flash-every", str(c["flash_every"]),
                  "--gop", str(truth.get("gop", FPS))] + list(truth.get("cam_extra", ())),
                 stdin=subprocess.DEVNULL, stderr=err)


def start_sources(d, truth, plan, procs, mic_seconds, mic_extra=()):
    """The fake mics first (they define T0), then the cameras. Each is a process of its own."""
    camera_kind_check(truth)
    mic = spawn([MIC] + mic_out_args(plan) +
                ["--manifest", os.path.join(d, "mic.jsonl"), "--seconds", "%.3f" % mic_seconds, "--beep-at-us", ",".join(str(b) for b in truth["beeps"])] + beep_on_args(plan) + list(mic_extra),
                stdin=subprocess.DEVNULL, stderr=open(os.path.join(d, "mic.err"), "w"))
    procs.append(mic)
    cps = []
    for c, pc in zip(truth["cams"], plan["cameras"]):
        cp = camera_spawn(d, truth, c, pc)                   # audit row W3F: the C camera, or with M3_CAMERA=sr the program camera
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


def apkt_hashes(d):
    """The diagnostic manifest of the run: the sha256 of every encoder packet, per encoder (`enc` = the channel number,
    0 = the silent track; row 152), and the `end` line."""
    rows = [json.loads(l) for l in open(os.path.join(d, "manifest.jsonl"))]
    by = {}
    for r in rows:
        if r["type"] == "apkt":
            by.setdefault(r["enc"], []).append(r["sha256"])
    end = [r for r in rows if r["type"] == "end"]
    return by, (end[0] if end else None)


def packet_hashes(path):
    return [x["data_hash"].split(":")[-1].lower() for x in P111.probe_packets(path, "a:0")]


def h4(d, paths):
    """THE PAIRS (row 152, DF-06; AC-4.7; replaces the row-111 "one encoder's packets in every file"). For every camera
    file VIDEO-0N: its audio packets are, byte for byte and in order, the LEADING packets of its own channel file
    MIC-0N.m4a (the same encoder's packets, cloned) and of that encoder's manifest lines (`enc` N) - or, when the run
    has no MIC-0N.m4a, of the silent encoder's (`enc` 0). The camera file holds at least 90 % of them (it may close a
    little before the channel file). No camera file equals ANOTHER channel's packets (the pairing bites). The worker's
    encoder count is one per channel file, plus one when a camera's track is silent. A camera file whose audio was
    encoded once more (h4neg) fails."""
    by, end = apkt_hashes(d)
    media = os.path.join(d, "media")
    chan = {n: packet_hashes(os.path.join(media, "MIC-0%d.m4a" % n)) for n in range(1, 5) if os.path.exists(os.path.join(media, "MIC-0%d.m4a" % n))}
    res, ok, silent_used = {"channel_files": sorted(chan), "cameras": {}}, bool(paths), False
    for p in paths:
        n = int(os.path.basename(p)[7])                         # VIDEO-0N[...].mp4
        cam = packet_hashes(p)
        src = chan.get(n)
        enc = n if src is not None else 0
        silent_used |= src is None
        ref = src if src is not None else by.get(0, [])
        man = by.get(enc, [])
        r = {"pair_source": "MIC-0%d.m4a" % n if src is not None else "silent (enc 0)", "camera_audio_packets": len(cam), "source_packets": len(ref), "manifest_packets": len(man),
             "leading_packets_equal": len(cam) > 0 and cam == ref[:len(cam)],
             "manifest_equals_source": len(ref) > 0 and ref == man[:len(ref)] and (src is None or len(man) == len(ref)),
             "covers_90pct": len(ref) > 0 and len(cam) >= 0.9 * len(ref),
             "equals_another_channel": sorted(k for k, h in chan.items() if k != n and len(cam) > 0 and cam == h[:len(cam)]),
             "distinct_payloads": len(set(cam))}
        r["holds"] = r["leading_packets_equal"] and r["manifest_equals_source"] and r["covers_90pct"] and not r["equals_another_channel"]
        res["cameras"][os.path.basename(p)] = r
        ok &= r["holds"]
    res["worker_encoders"] = end["encoders"] if end else None
    res["expected_encoders"] = len(chan) + (1 if silent_used else 0)
    ok &= res["worker_encoders"] == res["expected_encoders"]
    return ok, res


def av_offsets(d, truth, paths, bound_ms=REGRESSION_MS, keep=None, allow_stray=False, assume_drift_ppm=None):
    """Flash-to-beep offset per camera file, sample-exact, paired by identity (test-fixtures/av_analyse.py).
    The truth comes from the case definition and the mic process's own manifest in `d`, never from the worker.
    Returns (regression bound holds, product bound holds, detail): two verdicts, never merged (AU2-04)."""
    mic, beeps = P111.mic_truth(os.path.join(d, "mic.jsonl"))
    return P111.av_offsets(paths, truth, mic, beeps, bound_ms=bound_ms, keep=keep, gop=truth.get("gop", FPS), allow_stray=allow_stray, assume_drift_ppm=assume_drift_ppm)


def slope_matches(truth, rav):
    """M3-AV-2 (b): the fitted slope of a drifting camera is the INJECTED one (never 'near 0'), within what the
    2 ms regression bound allows over the span of its events."""
    out, ok = {}, True
    for c in truth["cams"]:
        r = rav.get("cam%d" % c["cam"], {})
        ev = r.get("events") or []
        if len(ev) < 3:
            ok = False
            continue
        span = ev[-1]["flash_s"] - ev[0]["flash_s"]
        tol = REGRESSION_MS / span * 1000.0
        good = abs(r["fitted_slope_ppm"] - c["drift_ppm"]) <= tol
        out["cam%d" % c["cam"]] = {"injected_ppm": c["drift_ppm"], "fitted_ppm": r["fitted_slope_ppm"], "tolerance_ppm": round(tol, 1), "span_s": round(span, 2), "holds": good}
        ok &= good
    return ok, out


def gop_report(d, truth, paths):
    """What the camera's GOP is IN THE FILE (keyframe distances, video samples per fragment) and what the worker
    said about it. A fixture check: the writer's rule for a long GOP is row 59's (OP-GOP)."""
    want = truth.get("gop", FPS)
    files, ok = {}, True
    for p in paths:
        k = P111.keyframe_intervals(p)
        frag = [b["tracks"].get(1, {}).get("samples", 0) for b in boxes(p)["boxes"] if b["type"] == "moof"]
        good = len(k["intervals"]) >= 1 and all(i == want for i in k["intervals"])
        files[os.path.basename(p)] = {"keyframes": k["keyframes"], "keyframe_intervals_frames": sorted(set(k["intervals"])), "video_samples_per_fragment": frag,
                                      "longest_fragment_s": round(max(frag) / FPS, 2) if frag else None, "equals_camera_gop": good}
        ok &= good
    log = worker_log(d)
    # Any line of the worker's log, any WARNING frame code, that names the keyframe distance it OBSERVED (the plan's own
    # gopFrames, echoed at the start, is not an observation).
    words = ("keyframe", "key_frame", "gop", "keyint")
    said = [l for l in log if any(w in str(l.get("message", "")).lower() or any(w in k.lower() for k in l) for w in words)]
    return ok, {"camera_gop_frames": want, "camera_gop_s": want / FPS, "plan_gop_frames": 50, "files": files,
                "worker_log_lines_about_keyframe_interval": [l.get("message") for l in said],
                "worker_reports_observed_keyframe_interval": bool(said)}


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
    sid = "S-M3W-%s" % a.name.upper().replace("_", "-")[-40:].strip("-")
    ports_free_or_exit()
    plan = make_plan(d, sid, tap=os.path.join(d, "tap.s16") if getattr(a, "tap", False) else None)
    json.dump(truth, open(os.path.join(d, "truth.json"), "w"), indent=1)
    procs, info = [], {"sessionId": sid}
    w = Worker(d, binary, extra=getattr(a, "worker_args", ()))
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
        # The listener snapshot (SEC35-23): both ingest listeners are up before any source exists.
        t_l = time.monotonic()
        while len(tcp_listeners()) < 2 and time.monotonic() - t_l < 5:
            time.sleep(0.05)
        info["own_sockets_listening"] = own_sockets()
        mic_seconds = (truth["epoch_us"] / 1e6 - time.time()) + max(c["frames"] for c in truth["cams"]) / FPS + stop_after_last_cam + 6
        mic, cps = start_sources(d, truth, plan, procs, mic_seconds, mic_extra)

        def snapshot():                                      # every socket of every process of this run, one second into the streams
            time.sleep(max(0.0, truth["epoch_us"] / 1e6 - time.time()) + 1.0)
            info["own_sockets_mid_session"] = own_sockets()
        snap = threading.Thread(target=snapshot, daemon=True)
        snap.start()
        if after_start:
            after_start(w, plan, sid, info, cps, truth)
        rc = {}
        for i, cp in enumerate(cps):
            rc["cam%d" % (i + 1)] = cp.wait(timeout=120)
        time.sleep(stop_after_last_cam)
        snap.join(timeout=30)
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
    truth = build_truth(a.case, gop=a.gop)
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
        # Audit row 152b (N-31; D135): the operator's switch (`--switch`) is retired - camera N's audio is its pair's
        # channel for the whole session; the proto check holds that the command is no command of the protocol any more.

    mic_extra = ("--deliver-late-us", str(a.mic_late_us)) if a.mic_late_us else ()
    w, plan, info, _ = run_session(a, d, binary, truth, after_start=mid, mic_extra=mic_extra)
    frame_stats(w, info)
    info.update(marks)
    res = {"check": "M3-WI-1 / M3-AV-1 / M3-AV-2 session", "run": a.name, "case": a.case, "variant": a.variant, "camera_gop_frames": a.gop, "mic_deliver_late_us": a.mic_late_us, "info": info}
    paths = [c["outputPath"] for c in plan["cameras"]]
    v = Crit()
    v("sources_and_worker_exit_0", info.get("rc") == {"cam1": 0, "cam2": 0, "worker": 0})
    v("both_files_exist", all(os.path.exists(p) for p in paths))
    if v.ok:
        pl = [playable(p) for p in paths]
        res["files"] = {os.path.basename(p): r for p, (_, r) in zip(paths, pl)}
        v("files_playable", all(o for o, _ in pl))
        # (a) both files exist and GROW during the session, sampled before STOP.
        rows = [r for r in info["size_samples"] if r[1] is not None and r[2] is not None]
        grew = [len(set(r[i] for r in rows)) for i in (1, 2)]
        res["growth"] = {"samples_with_both_files": len(rows), "distinct_sizes_per_file": grew, "first": rows[:1], "last_before_stop": rows[-1:], "final": sizes(plan)}
        res["fragments"] = {os.path.basename(p): [[b["tracks"].get(1, {}).get("samples", 0), b["tracks"].get(2, {}).get("samples", 0)] for b in boxes(p)["boxes"] if b["type"] == "moof"] for p in paths}
        v("files_grow_during_session", len(rows) >= 4 and min(grew) >= 3)
        o4, r4 = h4(d, paths)
        res["h4_one_encoder_both_files"] = r4
        v("h4_one_encoder_both_files", o4)
        # M3-AV-1 / M3-AV-2: the regression bound and the product bound are two assertions (AU2-04).
        reg, prod, rav = av_offsets(d, truth, paths)
        res["av_offsets"] = rav
        v("av_regression_2ms", reg)
        v("av_product_40ms", prod)
        if any(c["drift_ppm"] for c in truth["cams"]):
            osl, res["drift_slope"] = slope_matches(truth, rav)
            v("drift_slope_is_the_injected_one", osl)
        ogop, res["gop"] = gop_report(d, truth, paths)
        v("file_keyframe_interval_equals_camera_gop", ogop)
        res["first_video_packets"] = {os.path.basename(p): first_video(p) for p in paths}
        res["video_started_log"] = [{"source": l["source"], "first_pts": l["first_pts"]} for l in worker_log(d) if l["message"] == "video_started"]
        mic, _ = mic_manifest(d)
        t0 = [l for l in worker_log(d) if l["message"] == "audio_started"][0]["t0_real_us"]
        res["t0"] = {"mic_e0_real_us": mic["e0_real_us"], "worker_t0_real_us": t0, "t0_error_us": t0 - mic["e0_real_us"]}
        recs = info["records"]
        kinds = sorted((r["record"]["kind"], r["record"]["deviceId"]) for r in recs if r["record"]["kind"] in ROW58_RECORD_KINDS)   # row 71: a record of the session has no deviceId
        # Row 59: the writer's checkpoints and the keyframe-interval record travel in the same sequence; the four
        # once-only records of row 58 are still exactly these four, and the sequence has no gap.
        kinds = [k for k in kinds if k[0] in ROW58_RECORD_KINDS]
        res["records_ok"] = [r["seq"] for r in recs] == list(range(1, len(recs) + 1)) and kinds == [("FIRST_DURABLE_FRAGMENT", "CAM-01"), ("FIRST_DURABLE_FRAGMENT", "CAM-02"), ("FIRST_VIDEO_SAMPLE", "CAM-01"), ("FIRST_VIDEO_SAMPLE", "CAM-02")]
        # The record states the TRUE first video pts: what the worker logged, and (under the pinned flags) NOT what the file shows.
        logged = sorted(l["first_pts"] for l in worker_log(d) if l["message"] == "video_started")
        res["first_video_sample_records"] = sorted((r["record"]["deviceId"], r["record"]["pts"], r["record"]["timescale"]) for r in recs if r["record"]["kind"] == "FIRST_VIDEO_SAMPLE")
        res["records_ok"] &= sorted(x[1] for x in res["first_video_sample_records"]) == logged
        v("records", res["records_ok"])
        writer_criteria(v, res, d, paths, recs, truth)        # row 59: chains, checkpoints, tail validation, observed keyframe interval
        v("frames_clean", info["first_frame_is_hello"] and not info["lines_that_are_no_frame"] and not info["crash"] and info["heartbeats"]["counter_strictly_growing"])
        v("worker_sockets_tcp_loopback_only", sockets_clean(info["sockets_before_stop"]))
        # The listener snapshot of the row: worker AND fixtures, one second into the streams.
        own = info.get("own_sockets_mid_session")
        v("fixture_and_worker_sockets_loopback_only", bool(own) and sockets_clean(own) and bool(own["rows"]) and all(any(("127.0.0.1", str(p)) in endpoints(l) for l in own["rows"]) for p in PORTS))
        lis = info.get("own_sockets_listening")
        v("listeners_are_the_two_loopback_ports", bool(lis) and sockets_clean(lis) and lis["listeners"] == sorted("127.0.0.1:%d" % p for p in PORTS))
        # D5 pairs (row 152b): the one interval record of the start names MIC-01 from sample 0, and no other exists.
        iv = [r["record"] for r in recs if r["record"]["kind"] == "AUDIO_SOURCE_INTERVAL"]
        res["intervals"] = iv
        v("one_start_interval_mic01", [(r["index"], r["deviceId"], r["reason"], r["fromSample"]) for r in iv] == [(1, "MIC-01", "SESSION_START", 0)])
        if getattr(a, "tap", False):
            tap = os.path.join(d, "tap.s16")
            x, a0, _ = P111.audio_pcm(paths[0])
            res["tap"] = {"bytes": os.path.getsize(tap), "samples": os.path.getsize(tap) // 2, "decoded_samples": len(x), "decoded_minus_tap": len(x) - os.path.getsize(tap) // 2, "audio_first_pts": a0}
    v("no_leftover", not info["leftovers"]["processes"] and not info["leftovers"]["listeners"])
    finish(res, True, a.expect_fail, d, v)


# ------------------------------------------------------------------------------------------ re-judging a finished run (controls)
def finished(a):
    d = rundir(a.name)
    plan_paths = [os.path.join(d, "media", "VIDEO-0%d.mp4" % i) for i in (1, 2)]
    return d, json.load(open(os.path.join(d, "truth.json"))), plan_paths


def cmd_avcheck(a):
    """The AV judgement of a finished session, again, against a truth the caller changes. With
    --assume-drift-ppm 0 a +-200 ppm run is judged as if no drift had been injected: the expectation the spec
    says this fixture can never meet (capture spec F). It must FAIL the regression bound and stay inside the
    product bound - the control of M3-AV-2 (b) that shows the analyser sees the slope."""
    d, truth, paths = finished(a)
    v = Crit()
    if a.assume_inject_ms is not None:
        # The files are judged against ANOTHER injected offset than the cameras had (integration pass E2): a +-80 ms
        # session judged as "0, 0" is 80 ms off on both cameras and must FAIL both bounds. On a session recorded
        # THROUGH THE SUPERVISOR this is the control that its AV judgement can fail (a proof build of the worker can
        # no longer be started there: the supervisor refuses it at HELLO).
        assumed = [float(x) for x in a.assume_inject_ms.split(",")]
        if len(assumed) != len(truth["cams"]):
            sys.exit("--assume-inject-ms needs one value per camera (%d)" % len(truth["cams"]))
        for c, ms in zip(truth["cams"], assumed):
            for e in c["events"]:
                e["truth_offset_us"] += int(round((ms - c["inject_ms"]) * 1000))
            c["inject_ms"] = ms
    reg, prod, rav = av_offsets(d, truth, paths, assume_drift_ppm=a.assume_drift_ppm)
    v("av_regression_2ms", reg)
    v("av_product_40ms", prod)
    finish({"check": "AV judgement of a finished run", "run": a.name, "assume_drift_ppm": a.assume_drift_ppm, "assume_inject_ms": a.assume_inject_ms, "av_offsets": rav}, True, a.expect_fail, None, v)


def cmd_gopcheck(a):
    """The keyframe-interval check of a finished session against another GOP than its camera had: a GOP-50 run
    judged as GOP 250 must FAIL (the control of the long-GOP fixture check)."""
    d, truth, paths = finished(a)
    truth["gop"] = a.gop
    v = Crit()
    ok, rep_ = gop_report(d, truth, paths)
    v("file_keyframe_interval_equals_camera_gop", ok)
    finish({"check": "keyframe interval of a finished run", "run": a.name, "gop": rep_}, True, a.expect_fail, None, v)


def cmd_continuity(a):
    """AU2-05 on the files of a finished session whose mics ran on the host clock, PER PAIR (audit row 152b; D5 pairs,
    D135): VIDEO-0N carries its own channel MIC-0N for the whole session. Per camera file: decoded sample count against
    the encoder's input count, spacing and position of the reference beeps (on every paired channel: fake_mic.c
    --beep-on) against the mic manifest, and - for the file whose channel carries a reference tone (MIC-02, 880 Hz) - the
    phase of that tone over its whole run. Judged on decoded samples; the packet grid is printed and never judged.
    (Until row 152b the tone was judged only inside the window of an operator's switch to the standby.)
       --control cut      1,000 samples removed between two beeps (of the decoded samples, in memory): must FAIL
       --control toneslip 100 samples removed inside the tone's run of the file that carries it and 100 repeated later
                          in it: count, spacing and position still hold - only the tone's phase can see it: must FAIL on
                          `tone`"""
    d, truth, paths = finished(a)
    mic, beeps = P111.mic_truth(os.path.join(d, "mic.jsonl"))
    end = [json.loads(l) for l in open(os.path.join(d, "manifest.jsonl")) if '"end"' in l]
    samples_in = [r for r in end if r["type"] == "end"][0]["samples_in"]
    v, res = Crit(), {"check": "continuity (AU2-05), per pair", "run": a.name, "control": a.control, "files": {}}
    for p in paths:
        n = int(os.path.basename(p)[7])                       # VIDEO-0N.mp4: its pair is MIC-0N
        tone = n == 2                                         # fake_mic.c: channel 2 is the 880 Hz reference tone (av_analyse TONE_HZ)
        x, _, _ = P111.audio_pcm(p)
        if a.control == "cut":
            on = P111.onsets(x)
            at = (on[1] + on[2]) // 2
            x = x[:at] + x[at + 1000:]
        elif a.control == "toneslip" and tone:
            t = P111.tone_phase(x)
            third = (t["last_sample"] - t["first_sample"]) // 3
            c1, c2 = t["first_sample"] + third, t["first_sample"] + 2 * third
            x = x[:c1] + x[c1 + 100:c2] + x[c2 - 100:c2] + x[c2:]          # 100 lost, 100 repeated: the length is unchanged
        ok, r = P111.continuity(x, mic, beeps, samples_in, expect_tone=tone)
        r["pair"] = "VIDEO-0%d <- MIC-0%d" % (n, n)
        r["packet_grid_deltas_not_judged"] = P111.packet_grid(p)
        res["files"][os.path.basename(p)] = r
        for k, val in r["criteria"].items():
            v(k, val == "PASS")
    v("the_tone_file_was_judged", any(int(os.path.basename(p)[7]) == 2 for p in paths))
    finish(res, True, a.expect_fail, None, v)


def cmd_selfcheck(a):
    """The harness's own leftover check, measured (R-7). (1) A fixture this run started and left running IS
    reported, and is gone from the report after its kill. (2) The same program started outside this run's
    registry (as another harness on this host would) is NOT reported while it runs."""
    d = rundir(a.name, fresh=True)
    v, res = Crit(), {"check": "leftover scope (R-7)", "run": a.name}
    fifo = os.path.join(d, "blocked.pcm")
    os.mkfifo(fifo, 0o600)
    args = [MIC, "--out1", fifo, "--manifest", os.path.join(d, "mic.jsonl"), "--seconds", "30"]
    os.mkfifo(fifo + ".foreign", 0o600)
    foreign = subprocess.Popen([MIC, "--out1", fifo + ".foreign", "--manifest", os.path.join(d, "foreign.jsonl"), "--seconds", "30"],
                               stdin=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True)       # NOT registered: another run's process
    time.sleep(0.3)
    try:
        res["with_only_a_foreign_fake_mic"] = leftovers()
        v("foreign_process_is_not_ours", foreign.poll() is None and not res["with_only_a_foreign_fake_mic"]["processes"])
        mine = spawn(args, stdin=subprocess.DEVNULL, stderr=subprocess.DEVNULL)          # blocks opening the pipe: nobody reads it
        time.sleep(0.5)
        res["with_our_fake_mic_alive"] = leftovers()
        v("own_live_process_is_reported", mine.poll() is None and len(res["with_our_fake_mic_alive"]["processes"]) == 1 and str(mine.pid) in res["with_our_fake_mic_alive"]["processes"][0])
        killall([mine])
        time.sleep(0.3)
        res["after_kill"] = leftovers()
        v("gone_after_kill", not res["after_kill"]["processes"] and foreign.poll() is None)
    finally:
        killall([foreign])
    finish(res, True, a.expect_fail, d, v)


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
                              ("mic input is a regular file", lambda p: p["mics"][0]["input"].update(path=os.path.join(d, "worker.jsonl"))),
                              # Protocol 6 (row 151): the camera row of a protocol-5 Core (five members) is refused by shape.
                              ("camera row of protocol 5", lambda p: [p["cameras"][0].pop(k) for k in ("micChannel", "micMissing")])):
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
        ok &= all(v[0] is False for v in bad.values()) and bad["44.1 kHz"][1] == "PLAN_UNSUPPORTED" and bad["mic input is a regular file"][1] == "MIC_INPUT_NOT_FIFO" and bad["port 9000"][1] == "PLAN_INVALID" and bad["camera row of protocol 5"][1] == "PLAN_INVALID"
        # 3. START is taken from the frame (nothing of the session is an argument), a second START is refused.
        _, f1 = w.ack(w.command(sid, "START", attempt=1, plan=plan))
        _, f2 = w.ack(w.command(sid, "START", attempt=2, plan=plan))
        argv = sh(["ps", "-o", "command=", "-p", str(w.p.pid)]).stdout.strip()
        res["start"] = [f1, f2]
        res["argv_names_no_session"] = sid not in argv and "rtsp" not in argv and "media" not in argv
        ok &= f1["ok"] is True and f2 == {"v": V, "type": "ACK", "correlationId": f2["correlationId"], "ok": False, "code": "SESSION_ALREADY_SERVED"} and res["argv_names_no_session"]
        # 4. The listeners are up on loopback only.
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
                        # Audit row 152b (N-31; D135, D136): the operator's switch is retired - the protocol has no such command.
                        ("retired switch command", json.dumps({"v": V, "sessionId": "S", "correlationId": "c", "type": "SWITCH_AUDIO_SOURCE", "to": "STANDBY"})),
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


# ------------------------------------------------------------------ four-camera plan (D60, 2026-11-04)
def cmd_plan4(a):
    """D60 (2026-11-04): the worker takes a plan of FOUR camera entries - one listener, one file and one
    ingest thread each - and refuses a doubled device that is not the dual-lens case. No media is pushed:
    the check is the plan shape, the four listeners and the clean end at the close of standard input."""
    d = rundir(a.name, fresh=True)
    res, ok = {"check": "D60 four-camera plan", "run": a.name}, True
    sid = "S-M3W-PLAN4"
    ports_free_or_exit()
    # Two further free ports of the media range beside the pair of this run (the plan's four ingests).
    extra = []
    for p in (8563, 8564, 8562, 8561, 8560, 8559):
        if p in PORTS or p in RESERVED_PORTS or p in FOREIGN_PORTS:
            continue
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        try:
            s.bind(("127.0.0.1", p))
            extra.append(p)
        except OSError:
            pass
        finally:
            s.close()
        if len(extra) == 2:
            break
    if len(extra) != 2:
        sys.exit("plan4: no two further free ports of %d-%d" % (PORT_MIN, PORT_MAX))
    allp = list(PORTS) + sorted(extra)
    names = ("cam1", "cam2", "cam3", "cam4")

    def plan4(cams=None, mics=4):      # D61 (2026-11-04): FOUR microphone lines; protocol 6 (row 151): each camera names its pair (make_plan)
        p = make_plan(d, sid, cams=4, mics=mics, names=names)
        for c, port, nm in zip(p["cameras"], allp, names):
            c.update(ingestUrl="rtsp://127.0.0.1:%d/%s" % (port, nm))
        return p

    # 1. The four-entry plan is taken: ACK ok, FOUR listeners up, the log names the four ports, no file yet.
    w = Worker(d, heartbeat_ms=200, manifest=False)
    try:
        w.wait(lambda f: f.get("type") == "HELLO", 5, "HELLO")
        plan = plan4()
        _, f = w.ack(w.command(sid, "START", attempt=1, plan=plan))
        res["start_ack"] = f
        listening = []
        t = time.monotonic()
        while time.monotonic() - t < 5:
            txt = sh(["lsof", "-nP", "-iTCP", "-sTCP:LISTEN"]).stdout
            listening = [p for p in allp if any(l.rstrip().endswith(":%d (LISTEN)" % p) for l in txt.splitlines())]
            if len(listening) == 4:
                break
            time.sleep(0.05)
        starting = [l for l in worker_log(d) if l["message"] == "session_starting"]
        res["listeners"] = sorted(listening)
        res["session_starting"] = starting[0] if starting else None
        ok &= f["ok"] is True and sorted(listening) == sorted(allp) and bool(starting) and starting[0].get("cameras") == 4 \
            and starting[0].get("ports") == allp and not any(os.path.exists(c["outputPath"]) for c in plan["cameras"])
        # CONTROL: a two-entry plan of the same shape is still taken (backward compatibility of the ruling).
        w2 = Worker(rundir(a.name + "/two"), manifest=False)
        try:
            w2.wait(lambda f2: f2.get("type") == "HELLO", 5, "HELLO")
            _, f2 = w2.ack(w2.command(sid, "START", attempt=1, plan=make_plan(d, sid, cams=2, names=names)))
            res["control_two_camera_ack"] = f2
            ok &= f2["ok"] is True
        finally:
            w2.kill()
        # 2. Refusals of the widened reader: doubled track, doubled port, one device twice with ONE profile,
        #    and a fifth entry (the compiled cap). The dual-lens case - one device on two tracks with DISTINCT
        #    profiles - is the accepted exception (OD-05, D60).
        bad = {}
        for label, change in (
                ("doubled track", lambda p: p["cameras"][2].update(trackId="VIDEO-02")),
                ("doubled port", lambda p: p["cameras"][3].update(ingestUrl=p["cameras"][0]["ingestUrl"])),
                ("device twice one profile", lambda p: p["cameras"][2].update(deviceId="CAM-02", profile=None)),
                ("five cameras", lambda p: p["cameras"].append(dict(p["cameras"][0], trackId="VIDEO-05", deviceId="CAM-05",
                                                                    ingestUrl="rtsp://127.0.0.1:%d/cam5" % next(x for x in range(PORT_MIN + 1, PORT_MAX + 1) if x not in allp and x not in RESERVED_PORTS),
                                                                    outputPath=os.path.join(d, "media", "VIDEO-05.mp4"))))):
            wb = Worker(rundir(a.name + "/bad"), manifest=False)
            try:
                wb.wait(lambda f3: f3.get("type") == "HELLO", 5, "HELLO")
                p2 = plan4()
                change(p2)
                _, f3 = wb.ack(wb.command(sid, "START", attempt=1, plan=p2))
                bad[label] = [f3["ok"], f3.get("code")]
            finally:
                wb.kill()
        dual = {}
        for label, change in (
                ("dual-lens distinct profiles", lambda p: (p["cameras"][1].update(deviceId="CAM-01", profile="tele"),
                                                           p["cameras"][1].update(outputPath=os.path.join(d, "media", "VIDEO-02.mp4")))),
                ("four distinct devices", lambda p: None)):
            wb = Worker(rundir(a.name + "/ok"), manifest=False)
            try:
                wb.wait(lambda f3: f3.get("type") == "HELLO", 5, "HELLO")
                p2 = plan4()
                if change:
                    change(p2)
                _, f3 = wb.ack(wb.command(sid, "START", attempt=1, plan=p2))
                dual[label] = [f3["ok"], f3.get("code")]
            finally:
                wb.kill()
        res["refused_plans"], res["accepted_plans"] = bad, dual
        ok &= all(v == [False, "PLAN_INVALID"] for v in bad.values()) and all(v[0] is True for v in dual.values())
        # 3. The end of standard input ends the four-listener session clean and leaves no file (nothing was pushed).
        w.p.stdin.close()
        res["exit_after_input_ended"] = rc = w.exit(15)
        ok &= rc == 0 and not w.not_frames() and not any(os.path.exists(c["outputPath"]) for c in plan["cameras"])
    finally:
        w.kill()
    time.sleep(0.3)
    res["leftovers"] = leftovers()
    ok &= not res["leftovers"]["processes"] and not res["leftovers"]["listeners"]
    finish(res, ok, a.expect_fail, d)


# ------------------------------------------------------------------ four-channel audio plan (D61, 2026-11-04)
def cmd_plan4mics(a):
    """D61 (2026-11-04): the worker takes a plan of FOUR numbered microphone channels - all recorded at once,
    one file and one encoder per channel that names an outputPath - and refuses a doubled channel, a doubled
    device, THREE lines, FIVE lines and the old role member. The fake mics drive the four pipes; no camera is
    pushed (the session ends with the close of standard input, far before the no-camera bound)."""
    d = rundir(a.name, fresh=True)
    res, ok = {"check": "D61 four-channel audio plan", "run": a.name}, True
    sid = "S-M3W-PLAN4M"
    ports_free_or_exit()
    # 1. The four-channel plan is taken: ACK ok, FOUR encoders (row 152: one per channel, each also feeding its pair's camera), the
    #    four channel files land, TELEMETRY carries one level per channel, and the end is clean.
    plan = make_plan(d, sid, mic_out=True)
    procs = []
    w = Worker(d, heartbeat_ms=200, manifest=False)
    try:
        w.wait(lambda f: f.get("type") == "HELLO", 5, "HELLO")
        _, f = w.ack(w.command(sid, "START", attempt=1, plan=plan))
        res["start_ack"] = f
        ok &= f["ok"] is True
        mic = spawn([MIC] + mic_out_args(plan) + ["--manifest", os.path.join(d, "mic.jsonl"), "--seconds", "12"],
                    stdin=subprocess.DEVNULL, stderr=open(os.path.join(d, "mic.err"), "w"))
        procs.append(mic)
        started, starting = [], []
        t = time.monotonic()
        while time.monotonic() - t < 15:
            logs = worker_log(d)
            started = [l for l in logs if l["message"] == "audio_started"]
            starting = [l for l in logs if l["message"] == "session_starting"]
            if started:
                break
            time.sleep(0.1)
        files = [m["outputPath"] for m in plan["mics"]]
        t = time.monotonic()
        while time.monotonic() - t < 15 and not all(os.path.exists(p) and os.path.getsize(p) > 0 for p in files):
            time.sleep(0.2)
        tel = [fr for _, fr in w.of("TELEMETRY") if fr.get("levels")]
        levels = tel[-1]["levels"] if tel else []
        res["audio_started"] = started[0] if started else None
        res["session_starting_mics"] = starting[0].get("mics") if starting else None
        res["channel_files"] = {os.path.basename(p): (os.path.getsize(p) if os.path.exists(p) else None) for p in files}
        res["telemetry_levels"] = [(lv.get("deviceId"), lv.get("role")) for lv in levels]
        ok &= bool(started) and started[0].get("encoders") == 4 and bool(starting) and starting[0].get("mics") == 4 \
            and all(os.path.exists(p) and os.path.getsize(p) > 0 for p in files) \
            and [lv.get("deviceId") for lv in levels] == ["MIC-01", "MIC-02", "MIC-03", "MIC-04"] \
            and [lv.get("role") for lv in levels] == ["PRIMARY", "STANDBY", "STANDBY", "STANDBY"]     # the legacy two-role lane's words (D61)
        w.p.stdin.close()
        res["exit_after_input_ended"] = rc = w.exit(20)
        ok &= rc == 0 and not w.not_frames()
    finally:
        killall(procs)
        w.kill()
    # 2. Refusals of the channel-keyed reader: doubled channel, doubled device, FIVE lines, and the old role member.
    #    Protocol 6 (row 151; D30 K-3): THREE lines are a plan when the line left out is the paired channel of no camera
    #    (part 2b) - refused is a line left out that a camera names without a reason, and a reason beside a line that is
    #    there. A line without its own file (the protocol-5 form) and a camera row of the protocol-5 form (5 members) or
    #    with a foreign / duplicate channel or a bad micMissing are refused too. Each is PLAN_INVALID at the START.
    bad = {}
    for label, change in (
            ("doubled channel", lambda p: p["mics"][2].update(channel="MIC-01")),
            ("doubled device", lambda p: p["mics"][1].update(deviceId="MIC-01")),
            ("paired line left out without a reason", lambda p: p["mics"].pop(1)),
            ("a reason beside the paired line", lambda p: p["cameras"][1].update(micMissing="NOT_OPENED")),
            ("a line without its own file", lambda p: p["mics"][2].pop("outputPath")),
            ("camera row of protocol 5", lambda p: [c.pop(k) for c in p["cameras"] for k in ("micChannel", "micMissing")]),
            ("camera row without micMissing", lambda p: p["cameras"][0].pop("micMissing")),
            ("foreign channel", lambda p: p["cameras"][0].update(micChannel="MIC-03")),
            ("duplicate channel", lambda p: p["cameras"][1].update(micChannel="MIC-01")),
            ("bad micMissing word", lambda p: (p["mics"].pop(1), p["cameras"][1].update(micMissing="LOST"))),
            ("micMissing not a word", lambda p: (p["mics"].pop(1), p["cameras"][1].update(micMissing=0))),
            ("five mics", lambda p: p["mics"].append(dict(p["mics"][3], deviceId="MIC-09",
                                                          input=dict(p["mics"][3]["input"], path=os.path.join(d, "mic9.pcm")),
                                                          outputPath=os.path.join(d, "media", "MIC-09.m4a")))),
            ("old role member", lambda p: (p["mics"][0].update(role="PRIMARY"), p["mics"][0].pop("channel")))):
        wb = Worker(rundir(a.name + "/bad"), manifest=False)
        try:
            wb.wait(lambda f3: f3.get("type") == "HELLO", 5, "HELLO")
            p2 = make_plan(d, sid, mic_out=True)
            change(p2)
            _, f3 = wb.ack(wb.command(sid, "START", attempt=1, plan=p2))
            bad[label] = [f3["ok"], f3.get("code")]
        finally:
            wb.kill()
    res["refused_plans"] = bad
    ok &= all(v == [False, "PLAN_INVALID"] for v in bad.values())
    # 2b. CONTROLS of protocol 6 (row 151; D30 K-3): each differs from a refusal of 2 by the member it tests and is TAKEN -
    #     a channel of no camera left out (THREE lines), a paired line left out WITH its reason (both words). A fresh folder
    #     per plan (part 1's channel files are evidence: OUTPUT_EXISTS would hide the verdict).
    good = {}
    for label, change in (
            ("three lines, MIC-04 of no camera", lambda p: p["mics"].pop(3)),
            ("paired line left out, NOT_OPENED", lambda p: (p["mics"].pop(1), p["cameras"][1].update(micMissing="NOT_OPENED"))),
            ("paired line left out, NOT_ASSIGNED", lambda p: (p["mics"].pop(1), p["cameras"][1].update(micMissing="NOT_ASSIGNED")))):
        dg = rundir(a.name + "/good", fresh=True)
        wb = Worker(dg, manifest=False)
        try:
            wb.wait(lambda f3: f3.get("type") == "HELLO", 5, "HELLO")
            p2 = make_plan(dg, sid)
            change(p2)
            _, f3 = wb.ack(wb.command(sid, "START", attempt=1, plan=p2))
            good[label] = [f3["ok"], f3.get("code")]
        finally:
            wb.kill()
    res["accepted_plans"] = good
    ok &= all(v[0] is True for v in good.values())
    # 3. CONTROL of the never-overwrite rule on the new files: the SAME plan again is OUTPUT_EXISTS (the four
    #    channel files of part 1 are evidence; a restarted worker never writes into them).
    wb = Worker(rundir(a.name + "/replay"), manifest=False)
    try:
        wb.wait(lambda f4: f4.get("type") == "HELLO", 5, "HELLO")
        _, f4 = wb.ack(wb.command(sid, "START", attempt=1, plan=make_plan(d, sid, mic_out=True)))
        res["output_exists_replay"] = [f4["ok"], f4.get("code")]
        ok &= f4["ok"] is False and f4.get("code") == "OUTPUT_EXISTS"
    finally:
        wb.kill()
    time.sleep(0.3)
    res["leftovers"] = leftovers()
    ok &= not res["leftovers"]["processes"] and not res["leftovers"]["listeners"]
    finish(res, ok, a.expect_fail, d)


# ------------------------------------------------------------------------------------------ the pairs (row 152, DF-06)
# The cameras of this case push video with the camera fixture that encodes through the ffmpeg PROGRAM
# (test-fixtures/fake_cam_sr.py): the ruled FFmpeg of the worker (/opt/dems/ffmpeg-9.0.2) has no H.264 encoder, so the
# CAMERA side alone uses the test ffmpeg (D131, extending D69 ENV-2). The worker under test stays built and run
# against the ruled FFmpeg; nothing of the camera's ffmpeg reaches it but RTSP over loopback.
CAMERA_FFMPEG = os.environ.get("M3_CAMERA_FFMPEG") or next((p for p in (os.path.expanduser("~/.hermes/tools/ffmpeg-9.0.1-linux-x64/bin/ffmpeg"),) if os.path.exists(p)), None) \
    or os.environ.get("DEMS_FFMPEG") or shutil.which("ffmpeg")
PAIR_TONES = {1: 1000.0, 2: 880.0, 3: 660.0, 4: 440.0}     # fake_mic.c: channel 1 its 1 kHz beeps (over quiet noise), 2-4 steady tones
PAIRS_MODES = {
    # AC-4.7: four cameras, four channels - each VIDEO-0N carries MIC-0N's packets, four encoders, the tap from channel 1.
    "4x4": {"leave_out": None, "tap": True},
    # D30 K-3: MIC-02 did not open - VIDEO-02 carries a SILENT track, no MIC-02 file, MIC-03/04 still paired.
    "missing2": {"leave_out": 2, "tap": True},
    # R151-1 lifted (D131): no MIC-01 row - accepted, no tap, no interval record, VIDEO-01 silent.
    "nomic1": {"leave_out": 1, "tap": False},
}


def decoded_f32(path):
    raw = subprocess.run([FF, "-v", "error", "-i", path, "-map", "0:a:0", "-ac", "1", "-ar", "48000", "-f", "f32le", "-"], capture_output=True, check=True).stdout
    return struct.unpack("<%df" % (len(raw) // 4), raw[: len(raw) // 4 * 4])


def tone_power(x, freq):
    """Goertzel power of one frequency over the whole signal (no numpy on the host)."""
    import math
    k = 2.0 * math.cos(2.0 * math.pi * freq / SR)
    s1 = s2 = 0.0
    for v in x:
        s0 = v + k * s1 - s2
        s2, s1 = s1, s0
    return s1 * s1 + s2 * s2 - k * s1 * s2


def dominant_tone(path):
    x = decoded_f32(path)
    pw = {f: tone_power(x, f) for f in PAIR_TONES.values()}
    best = max(pw, key=pw.get)
    rest = max([v for f, v in pw.items() if f != best] or [0.0])
    return {"samples": len(x), "peak_abs": round(max((abs(v) for v in x), default=0.0), 6), "dominant_hz": best, "margin": round(pw[best] / rest, 1) if rest > 0 else None}


def durations(path):
    j = json.loads(P111.out([FP, "-v", "error", "-show_entries", "stream=codec_type,codec_name,sample_rate,channels,duration:format=duration", "-of", "json", path]))
    return {"format_s": float(j["format"]["duration"]), "streams": [(s["codec_type"], s["codec_name"], s.get("sample_rate"), s.get("channels"), s.get("duration")) for s in j["streams"]]}


def cmd_pairs(a):
    """ROW 152 (D5 pairs, DF-06; AC-4.7; D30 K-3; R151-1 / D131). Four fake cameras (VIDEO-01..04) and the fake mics on
    the channels the mode keeps; the session runs ~10 s and stops. Judged on the FILES (ffprobe / decode) and the frames:
      worker_and_sources_exit_0     the worker and every camera exit 0, no CRASH, every line a frame
      encoders_one_per_channel_file `audio_started.encoders` = channel files + 1 when a track is silent (4 in each mode)
      camera_files_shape            every VIDEO-0N: one aac 48 kHz mono stream and one h264 stream, decodable
      channel_files_exist_as_planned  MIC-0N.m4a exists exactly for the channels of the plan
      pairs_packet_equality         h4(): VIDEO-0N audio = the leading packets of MIC-0N (or of the silent encoder)
      tone_per_file                 the dominant tone of MIC-0N and of VIDEO-0N's audio is channel N's (fake_mic.c)
      silent_track                  a camera whose channel is missing has an audio track whose decoded samples are 0
      channel_checkpoints           every channel file: FRAGMENT_CHECKPOINT by the MIC's device ID, keyframe false,
                                    index 1..n without gap, last prefixSha256 = sha256 of the whole file; none for an
                                    absent channel; telemetry `fragments` lists cameras only (D132)
      interval_records              MIC-01 in the plan: one SESSION_START interval naming MIC-01 + AUDIO_TIMELINE_END;
                                    no MIC-01: neither (the record names a device or is not written)
      tap                           tap in the plan: a file with samples; no MIC-01: no tap file"""
    global make_plan, start_sources
    mode = PAIRS_MODES[a.mode]
    d = rundir(a.name, fresh=True)
    truth = build_truth("zero")
    for k in (2, 3):                                        # two more cameras (the CASES are two-camera): same clock, own flashes
        c = dict(truth["cams"][k - 2], cam=k + 1, flash_first=truth["cams"][k - 2]["flash_first"] + 50)
        c["events"] = []
        truth["cams"].append(c)
    gone = mode["leave_out"]
    plain_plan, plain_sources = make_plan, start_sources

    def plan_of(d_, sid, tap=None, **_):
        p = plain_plan(d_, sid, cams=4, mics=4, tap=os.path.join(d_, "tap.s16") if mode["tap"] else None)
        if gone:
            p["mics"] = [m for m in p["mics"] if m["channel"] != "MIC-0%d" % gone]
            p["cameras"][gone - 1]["micMissing"] = "NOT_OPENED"
        return p

    def sources(d_, truth_, plan, procs, mic_seconds, mic_extra=()):
        outs = sum([["--out%s" % m["channel"][-1], m["input"]["path"]] for m in plan["mics"]], [])
        if "--out1" not in outs:                            # fake_mic.c always writes channel 1: into a plain file nobody reads
            stray = os.path.join(d_, "unplanned_mic1.f32")
            open(stray, "wb").close()
            outs = ["--out1", stray] + outs
        mic = spawn([MIC] + outs + ["--manifest", os.path.join(d_, "mic.jsonl"), "--seconds", "%.3f" % mic_seconds,
                                    "--beep-at-us", ",".join(str(b) for b in truth_["beeps"])], stdin=subprocess.DEVNULL, stderr=open(os.path.join(d_, "mic.err"), "w"))
        procs.append(mic)
        cps = []
        env = dict(os.environ, DEMS_FFMPEG=CAMERA_FFMPEG or "")
        for c, pc in zip(truth_["cams"], plan["cameras"]):
            cp = spawn([sys.executable, "-B", CAM_SR, "--url", pc["ingestUrl"], "--epoch-us", str(truth_["epoch_us"]), "--work", d_, "--frames", str(c["frames"]),
                        "--flash-first", str(c["flash_first"]), "--flash-every", str(c["flash_every"])],
                       stdin=subprocess.DEVNULL, stderr=open(os.path.join(d_, "cam%d.err" % c["cam"]), "w"), env=env)
            procs.append(cp)
            cps.append(cp)
        return mic, cps

    make_plan, start_sources = plan_of, sources
    try:
        w, plan, info, _ = run_session(a, d, VARIANTS[a.variant], truth)
    finally:
        make_plan, start_sources = plain_plan, plain_sources
    frame_stats(w, info)
    res = {"check": "row 152 pairs (%s)" % a.mode, "run": a.name, "mode": a.mode, "camera_ffmpeg": CAMERA_FFMPEG, "start_ack": info.get("start_ack"), "rc": info.get("rc")}
    v = Crit()
    rc = info.get("rc") or {}
    v("worker_and_sources_exit_0", rc.get("worker") == 0 and all(rc.get("cam%d" % i) == 0 for i in range(1, 5)) and not info.get("crash") and not info.get("lines_that_are_no_frame"))
    log = worker_log(d)
    started = [l for l in log if l["message"] == "audio_started"]
    planned = sorted(int(m["channel"][-1]) for m in plan["mics"])
    res["audio_started_encoders"] = started[0]["encoders"] if started else None
    res["camera_audio_source_log"] = [{k: l.get(k) for k in ("cam", "track", "mic_channel", "source", "mic_missing")} for l in log if l["message"] == "camera_audio_source"]
    v("encoders_one_per_channel_file", res["audio_started_encoders"] == len(planned) + (1 if gone else 0) == 4)
    cams = [c["outputPath"] for c in plan["cameras"]]
    media = os.path.join(d, "media")
    shapes = {}
    for p in cams:
        if os.path.exists(p):
            okp, rep = playable(p)
            shapes[os.path.basename(p)] = {"playable": okp, "streams": rep["streams"], "durations": durations(p)}
        else:
            shapes[os.path.basename(p)] = None
    res["camera_files"] = shapes
    v("camera_files_shape", all(x and x["playable"] and sorted(s[:4] for s in x["streams"]) == [("audio", "aac", "48000", 1), ("video", "h264", None, None)] for x in shapes.values()))
    have = sorted(n for n in range(1, 5) if os.path.exists(os.path.join(media, "MIC-0%d.m4a" % n)))
    res["channel_files"] = {"MIC-0%d.m4a" % n: durations(os.path.join(media, "MIC-0%d.m4a" % n)) for n in have}
    v("channel_files_exist_as_planned", have == planned)
    if v.ok:
        o4, res["pairs"] = h4(d, cams)
        v("pairs_packet_equality", o4)
        tones = {}
        for n in range(1, 5):
            if n in have:
                tones["MIC-0%d.m4a" % n] = dominant_tone(os.path.join(media, "MIC-0%d.m4a" % n))
            tones["VIDEO-0%d.mp4" % n] = dominant_tone(cams[n - 1])
        res["tones"] = tones
        # Audit row W3F (F-W3TW-M1, D142): the pair number of a key is its last digit before the extension, for both
        # VIDEO-0N.mp4 and MIC-0N.m4a (k[7] was that digit only for VIDEO-0N; for MIC-0N.m4a it is 'm').
        pair_no = lambda k: int(k.split(".")[0][-1])
        v("tone_per_file", all(tones[k]["dominant_hz"] == PAIR_TONES[pair_no(k)] and (tones[k]["margin"] or 0) >= 10 for k in tones if not (k.startswith("VIDEO") and pair_no(k) == gone)))
        if gone:
            sil = tones["VIDEO-0%d.mp4" % gone]
            v("silent_track", sil["samples"] > SR * 5 and sil["peak_abs"] == 0.0 and res["pairs"]["cameras"]["VIDEO-0%d.mp4" % gone]["pair_source"].startswith("silent"))
    recs = info.get("records") or []
    cps_ok, cps_res = True, {}
    for m in plan["mics"]:
        cp = checkpoints_of(recs, m["deviceId"])
        path = m["outputPath"]
        whole = hashlib.sha256(open(path, "rb").read()).hexdigest() if os.path.exists(path) else None
        r = {"count": len(cp), "indices_gapless": [c["index"] for c in cp] == list(range(1, len(cp) + 1)), "keyframe_false": all(c["keyframe"] is False for c in cp),
             "last_prefix_is_the_file": bool(cp) and cp[-1]["prefixSha256"] == whole, "last_end_is_the_size": bool(cp) and cp[-1]["start"] + cp[-1]["len"] == os.path.getsize(path)}
        cps_res[m["deviceId"]] = r
        cps_ok &= r["count"] >= 2 and r["indices_gapless"] and r["keyframe_false"] and r["last_prefix_is_the_file"] and r["last_end_is_the_size"]
    if gone:
        cps_res["MIC-0%d (absent)" % gone] = {"count": len(checkpoints_of(recs, "MIC-0%d" % gone))}
        cps_ok &= cps_res["MIC-0%d (absent)" % gone]["count"] == 0
    cam_ids = {c["deviceId"] for c in plan["cameras"]}
    tel_devices = sorted({e["deviceId"] for _, f in w.of("TELEMETRY") for e in f.get("fragments", [])})
    cps_res["telemetry_fragments_devices"] = tel_devices
    cps_res["camera_checkpoints"] = {c: len(checkpoints_of(recs, c)) for c in sorted(cam_ids)}
    cps_ok &= set(tel_devices) <= cam_ids and all(n > 0 for n in cps_res["camera_checkpoints"].values())
    res["checkpoints"] = cps_res
    v("channel_checkpoints", cps_ok)
    iv = [r["record"] for r in recs if r["record"]["kind"] == "AUDIO_SOURCE_INTERVAL"]
    te = [r["record"] for r in recs if r["record"]["kind"] == "AUDIO_TIMELINE_END"]
    res["intervals"] = {"records": iv, "timeline_end": te}
    if gone == 1:
        v("interval_records", not iv and not te and any(l["message"] == "no_interval_without_channel_row" for l in log))
    else:
        v("interval_records", len(iv) == 1 and iv[0]["deviceId"] == "MIC-01" and iv[0]["reason"] == "SESSION_START" and len(te) == 1)
    tap = os.path.join(d, "tap.s16")
    res["tap_bytes"] = os.path.getsize(tap) if os.path.exists(tap) else None
    v("tap", (res["tap_bytes"] or 0) > SR if mode["tap"] else res["tap_bytes"] is None)
    v("no_leftover", not info["leftovers"]["processes"] and not info["leftovers"]["listeners"])
    finish(res, True, a.expect_fail, d, v)


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
        ok &= {"v": V, "type": "WARNING", "sessionId": info["sessionId"], "code": "CAPTURE_FAULT", "reason": "CAMERA_STREAM_ENDED", "state": "ACTIVE", "subject": "CAM-02"} in info["warnings"]
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

    sid = "S-M3W-%s" % a.name.upper().replace("_", "-")[-40:].strip("-")
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
    ports_free_or_exit()
    procs, res, snaps = [], {"check": "M3-RTSP-BIND-1 (worker sockets, TCP and UDP)", "run": a.name, "variant": a.variant}, []
    sid = "S-M3W-UDP"
    plan = make_plan(d, sid)
    w = None
    try:
        if a.variant == "skeleton":
            sk = spawn([VARIANTS["skeleton"], "--cam1", plan["cameras"][0]["ingestUrl"], "--out1", plan["cameras"][0]["outputPath"], "--cam2", plan["cameras"][1]["ingestUrl"],
                        "--out2", plan["cameras"][1]["outputPath"], "--duration", "8", "--listen-timeout", "10"], stdin=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
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
            mic = spawn([MIC] + mic_out_args(plan) + ["--manifest", os.path.join(d, "mic.jsonl"), "--seconds", "14"],
                        stdin=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            procs.append(mic)
        push = lambda url, transport: spawn([FF, "-hide_banner", "-loglevel", "error", "-re", "-f", "lavfi", "-i", "testsrc=size=320x240:rate=25", "-t", "7", "-c:v", "libx264", "-preset", "ultrafast",
                                                        "-tune", "zerolatency", "-g", "25", "-bf", "0", "-f", "rtsp", "-rtsp_transport", transport, url],
                                                       stdin=subprocess.DEVNULL, stderr=open(os.path.join(d, "push_%s.err" % transport), "w"))
        udp_client = push(plan["cameras"][0]["ingestUrl"], "udp")
        tcp_client = push(plan["cameras"][1]["ingestUrl"], "tcp")
        procs += [udp_client, tcp_client]
        # Snapshots every 100 ms while the UDP client is (or tries to be) connected.
        stimulus = []
        for i in range(40):
            time.sleep(0.1)
            snaps.append(["t+%.1fs udp_client_running=%s" % ((i + 1) / 10, udp_client.poll() is None), sockets_of(pid)])
            if udp_client.poll() is None:                     # the hostile client's own sockets: reported, not judged (it is the stimulus, not a fixture listener)
                stimulus += sockets_of(udp_client.pid)["rows"]
        res["stimulus_client_sockets_not_judged"] = sorted(set(" ".join(r.split()[7:]) for r in stimulus))
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
    foreign = sorted(set(r for _, s in snaps for r in s["foreign_ports"]))
    every = sorted(set(" ".join(r.split()[-2:]) for _, s in snaps for r in s["rows"]))
    res["snapshots"] = len(snaps)
    res["sockets_seen"] = every
    res["udp_sockets"] = udp_rows
    res["sockets_not_on_loopback"] = off
    res["sockets_on_foreign_ports"] = foreign
    v = Crit()
    v("no_udp_socket", not udp_rows)
    v("every_socket_on_loopback", not off and not foreign)
    v("snapshots_taken_with_the_listener_up", len(snaps) >= 40 and any("127.0.0.1:%d" % PORTS[0] in e for e in every))
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
        v("stuck_ingest_ends_in_crash_exit_70", res["worker_rc"] == 70 and [(c["code"], c["exitCode"]) for c in res["crash"]] == [("INGEST_THREAD_STUCK", 70)])
        v("healthy_camera_recorded_whole", bool(res["camera2_playable"]) and res["camera2_playable"]["playable"] and res["camera2_playable"]["decoded_frames"]["video"] >= 150)
        v("log_bounded", res["log_bytes"] < 2 * 1024 * 1024 and res["log_suppressed_lines"] > 1000)
    elif w:
        p2 = plan["cameras"][1]["outputPath"]
        res["camera1_file_exists"] = os.path.exists(plan["cameras"][0]["outputPath"])
        res["camera2_playable"] = playable(p2)[1] if os.path.exists(p2) else None
        res["refusal_logged"] = [l["message"] for l in worker_log(d) if l["message"] in ("INGEST_OPEN_REFUSED", "INGEST_OPEN_STUCK")]
        res["libav_error_lines_before_the_refusal"] = sum(1 for l in worker_log(d) if l["message"] == "LIBAV_MESSAGE")
        # The refused camera is reported as a fault, records nothing, and the other camera is not disturbed.
        v("refused_camera_is_a_fault_and_worker_exits_0", res["worker_rc"] == 0 and {"v": V, "type": "WARNING", "sessionId": sid, "code": "CAPTURE_FAULT", "reason": "CAMERA_NOT_CONNECTED", "state": "ACTIVE", "subject": "CAM-01"} in res["warnings"])
        v("refused_camera_has_no_file", not res["camera1_file_exists"] and res["refusal_logged"] == ["INGEST_OPEN_REFUSED"])
        v("other_camera_recorded", bool(res["camera2_playable"]) and res["camera2_playable"]["playable"])
    time.sleep(0.3)
    res["leftovers"] = leftovers()
    v("no_leftover", not res["leftovers"]["processes"] and not res["leftovers"]["listeners"])
    finish(res, True, a.expect_fail, d, v)


# ------------------------------------------------------------------------------------------ fix round 1: mics (F-4), no camera (D72(k))
def rms_per_second(path):
    x, a0, _ = P111.audio_pcm(path)
    out = []
    for s0 in range(0, len(x) - SR + 1, SR):
        seg = x[s0:s0 + SR]
        out.append(round((sum(v * v for v in seg) / SR) ** 0.5, 5))
    return out


MIC_MODES = {  # mode: (fake_mic arguments, bound in ms, why that bound)
    "slow": (("--ppm", "-2000"), 5.0, "D58-14: an extreme clock (2,000 ppm slow); measured about 2 ms"),
    "p100": (("--ppm", "100"), REGRESSION_MS, "an ordinary crystal, 100 ppm fast: the ordinary 2 ms regression bound (pair-58 re-check R.3)"),
    "m100": (("--ppm", "-100"), REGRESSION_MS, "an ordinary crystal, 100 ppm slow: the ordinary 2 ms regression bound"),
    "gap": (("--stop-at", "12", "--resume-at", "17"), 15.0, "D58-14: after a return the mic is re-placed by arrival, one 10 ms chunk coarse"),
}


def cmd_mic(a):
    """The fake mic on its OWN sample clock, and the mic that stops and returns (33 s sessions).
       mode slow: both mics 2,000 ppm SLOW. Audible to the end, every beep within 5 ms of its truth.
       mode p100 / m100: both mics 100 ppm fast / slow - the realistic case - within the ordinary 2 ms regression bound.
       mode gap : the mic process delivers nothing from second 12 to second 17 (its own time) and then goes on.
                  Silence in between, sound again after second 17, and the beeps after the return within 15 ms.
    The product bound (+-40 ms) is a separate assertion in every mode."""
    extra, bound, why = MIC_MODES[a.mode]
    d = rundir(a.name, fresh=True)
    truth = build_truth("long")
    w, plan, info, _ = run_session(a, d, VARIANTS[a.variant], truth, mic_extra=extra)
    frame_stats(w, info)
    res = {"check": "mic on its own sample clock / mic that stops and returns (%s)" % a.mode, "run": a.name, "mode": a.mode, "variant": a.variant, "bound_ms": bound, "bound_reason": why, "info": info}
    paths = [c["outputPath"] for c in plan["cameras"]]
    v = Crit()
    v("worker_exit_0_and_files", info.get("rc", {}).get("worker") == 0 and all(os.path.exists(p) for p in paths))
    if v.ok:
        mic, _ = mic_manifest(d)
        e0 = mic["e0_real_us"]
        rms = rms_per_second(paths[0])
        res["rms_per_second"] = rms
        res["mic_summary"] = [{k: l[k] for k in ("mic", "received", "missing", "dropped", "restarts", "last_ppm")} for l in worker_log(d) if l["message"] == "mic_summary"]
        tel = [f for _, f in w.of("TELEMETRY")]
        nulls = sum(1 for f in tel if any(lv["role"] == "PRIMARY" and lv["dbfs"] is None for lv in f["levels"]))
        res["telemetry_frames_with_primary_null"] = nulls
        if a.mode != "gap":
            reg, prod, rav = av_offsets(d, truth, paths, bound_ms=bound)
            res["av_offsets"] = rav
            v("av_within_mic_bound_%gms" % bound, reg)
            v("av_product_40ms", prod)
            # Audible for the whole session: no second of the file is silent (the quiet noise alone is about 0.0058 RMS).
            res["silent_seconds"] = [i for i, x in enumerate(rms[:-1]) if x < 0.003]
            v("audible_every_second", not res["silent_seconds"] and len(rms) >= 30)
            v("no_telemetry_frame_without_signal", nulls == 0)
        else:
            t_of = lambda e: (e["beep_at_us"] - e0) / 1e6                     # the beep's instant in the mic's own seconds
            reg, prod, rav = av_offsets(d, truth, paths, bound_ms=bound, keep=lambda e: t_of(e) < 11.5 or t_of(e) > 18.0, allow_stray=True)
            res["av_offsets"] = rav
            res["events_judged"] = sum(len(c.get("events", [])) for c in rav.values())
            res["events_after_return"] = sum(1 for c in truth["cams"] for e in c["events"] if t_of(e) > 18.0)
            # file second i covers mic seconds i..i+1 (file time 0 = T0 - 21 ms): 13..15 are inside the gap, 18.. after the return.
            res["rms_in_gap"], res["rms_after_return"] = rms[13:16], rms[18:24]
            v("av_within_mic_bound_%gms" % bound, reg and res["events_after_return"] >= 3)
            v("av_product_40ms", prod)
            v("silent_in_the_gap", max(rms[13:16]) < 0.0005)
            v("heard_again_after_the_return", min(rms[18:24]) > 0.003 and min(rms[2:11]) > 0.003)
            v("no_signal_reported_then_restarted", nulls >= 60 and any(s["restarts"] >= 1 for s in res["mic_summary"]))     # 5 s of NO SIGNAL at 20 Hz, then heard again
    v("no_leftover", not info["leftovers"]["processes"] and not info["leftovers"]["listeners"])
    finish(res, True, a.expect_fail, d, v)


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
        mic = spawn([MIC] + mic_out_args(plan) + ["--manifest", os.path.join(d, "mic.jsonl"), "--seconds", "20",
                     "--beep-at-us", ",".join(str(b) for b in truth["beeps"])], stdin=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        procs.append(mic)
        if a.mode == "one":
            c = truth["cams"][0]
            cam = spawn([CAM, "--url", plan["cameras"][0]["ingestUrl"], "--epoch-us", str(truth["epoch_us"]), "--claimed-epoch-us", str(c["claimed_epoch_us"]), "--drift-ppm", "0",
                         "--frames", str(c["frames"]), "--flash-first", str(c["flash_first"]), "--flash-every", str(c["flash_every"])], stdin=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
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
        self.p = spawn(["npx", "tsx", DRIVER, cfg], cwd=REPO, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=open(os.path.join(d, "driver.err"), "w"))
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
        st = self.all("status")[-1]["status"]
        if st.get("workerPid"):
            OWN_EXTRA_PIDS.add(st["workerPid"])              # the worker the supervisor started for us: ours for the leftover check
        return st

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
        drv.wait(lambda e: len([x for x in drv.all("record") if x.get("sessionId") == sid and x["record"]["kind"] == "FIRST_DURABLE_FRAGMENT"]) == 2, 60, "both durable records of " + sid)   # row 59: by kind (checkpoints share the sequence)
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
                     and the respawned worker records playable files.
       mode refuse : rows 61 / 71b on the REAL binaries (integration pass E2): a PROOF build of the worker (--variant
                     negctl: the forbidden mux option) is refused by the production supervisor at its HELLO with
                     CAPTURE_WORKER_PROOF_BUILD - never started, never retried, nothing recorded, no listener and no
                     worker process left while the supervisor lives. With the release worker (--variant worker) the
                     start is accepted: the control, which must FAIL on `refused_with_proof_build_code`."""
    d = rundir(a.name, fresh=True)
    ports_free_or_exit()
    procs, res, ok, v, early = [], {"check": "supervisor + real worker (%s)" % a.mode, "run": a.name}, True, Crit(), False
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
            reg, prod, rav = av_offsets(d, truth, paths)
            res["h4_one_encoder_both_files"], res["av_offsets"] = r4, rav
            recs = drv.all("record")
            res["records"] = [[e["seq"], e["record"]["kind"], e["record"].get("deviceId")] for e in recs]
            v("av_regression_2ms", reg)
            v("av_product_40ms", prod)
            v("files_growth_h4_records", all(o for o, _ in pl) and min(grew) >= 3 and o4 and [r[0] for r in res["records"]] == list(range(1, len(res["records"]) + 1)) and sorted(r[1] for r in res["records"] if r[1] in ROW58_RECORD_KINDS) == ["FIRST_DURABLE_FRAGMENT"] * 2 + ["FIRST_VIDEO_SAMPLE"] * 2)
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
            reg2, prod2, rav = av_offsets(d + "/s2", truth2, out2["plan_outputs"])
            res["session2_av_offsets"] = rav
            ok &= all(o for o, _ in pl2) and reg2 and prod2 and out2["worker_pid"] != out1["worker_pid"] and set(out2["plan_outputs"]).isdisjoint(out1["plan_outputs"])
            recs2 = [e for e in drv.all("record") if e["sessionId"] == "S-M3SUP-KC1-B"]
            ok &= [e["seq"] for e in recs2] == list(range(1, len(recs2) + 1)) and len([e for e in recs2 if e["record"]["kind"] in ROW58_RECORD_KINDS]) == 4   # row 59: a new worker counts from 1 again, without a gap
        elif a.mode == "kc3":
            truth = build_truth("zero", lead_us=9_000_000)
            json.dump(truth, open(os.path.join(d, "truth.json"), "w"), indent=1)
            plan, out = sup_session(drv, d, "S-M3SUP-KC3", truth, procs, kill_at="before")
            res["session"] = out
            if out.get("not_restarted"):
                res["worker_down"] = [[e["down"]["code"], e["down"]["signal"], e["restartInMs"]] for e in drv.all("workerDown")]
                v("restarted_after_a_kill_before_any_fragment", False)
                early = True
            if not early:
                downs = [e for e in drv.all("workerDown")]
                res["worker_down"] = [[e["down"]["code"], e["down"]["signal"], e["restartInMs"]] for e in downs]
                pl = [playable(p) for p in out["plan_outputs"]]
                res["files"] = {os.path.basename(p): r for p, (_, r) in zip(out["plan_outputs"], pl)}
                reg, prod, rav = av_offsets(d, truth, out["plan_outputs"])
                res["av_offsets"] = rav
                v("restarted_after_a_kill_before_any_fragment", out["attempt_after_kill"] == 2 and out["respawned_pid"] != out["worker_pid"] and len(downs) == 1 and downs[0]["restartInMs"] == drv.all("booted")[0]["limits"]["backoffBaseMs"])
                v("respawned_worker_records", all(o for o, _ in pl) and reg and prod)
        elif a.mode == "nocam":
            # D72(k) through the supervisor: no camera connects -> the session does not stay "recording" with nothing durable.
            plan = make_plan(d, "S-M3SUP-NOCAM")
            drv.say(cmd="start", sessionId="S-M3SUP-NOCAM", plan=plan)
            drv.wait(lambda e: e.get("event") == "started", 15, "started")
            mic = spawn([MIC] + mic_out_args(plan) + ["--manifest", os.path.join(d, "mic.jsonl"), "--seconds", "20"],
                        stdin=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
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
        elif a.mode == "refuse":
            sid = "S-M3SUP-REFUSE"
            plan = make_plan(d, sid)
            json.dump(plan, open(os.path.join(d, "plan.json"), "w"), indent=1)
            drv.say(cmd="start", sessionId=sid, plan=plan)
            e = drv.wait(lambda e: e.get("event") in ("started", "startFailed") and e.get("sessionId") == sid, 15, "the answer to the start of " + sid)
            res["start_answer"] = {k: e.get(k) for k in ("event", "error", "code", "detail")}
            downs = drv.all("workerDown")
            res["worker_down"] = [[x["down"]["code"], x["down"]["detail"], x["restartInMs"]] for x in downs]
            v("refused_with_proof_build_code", e["event"] == "startFailed" and e.get("code") == "CAPTURE_FAULT" and e.get("detail") == "CAPTURE_WORKER_PROOF_BUILD"
              and res["worker_down"] == [["CAPTURE_WORKER_PROOF_BUILD", "PROOF_BUILD", None]])
            if e["event"] == "started":
                # The worker was accepted (the control runs the release build): the session is ended, nothing else is judged.
                res["status_after_start"] = drv.status()
                mic = spawn([MIC] + mic_out_args(plan) + ["--manifest", os.path.join(d, "mic.jsonl"), "--seconds", "20"],
                            stdin=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                procs.append(mic)
                drv.say(cmd="stop", sessionId=sid, reason="CRASH")
                drv.wait(lambda e: e.get("event") == "stopped" and e.get("sessionId") == sid, 30, "stopped " + sid)
            else:
                time.sleep(3.0)                                # every back-off there could be: nothing may start
                st = drv.status()
                res["status_3s_after_the_refusal"] = st
                launched = drv.all("timing")
                alive = [(pid, cmd[:150]) for pid, cmd in own_processes() if cmd.split()[:1] == [cfg["command"]]]
                res["worker_launches"], res["worker_processes_alive"] = len(launched), alive
                v("not_retried_idle_worker_gone", st["phase"] == "IDLE" and st.get("workerPid") is None and len(launched) == 1 and len(drv.all("workerDown")) == 1 and not alive
                  and not [x for x in drv.all("phase") if x.get("phase") in ("RECORDING", "RESTARTING")])
                # While the supervisor process is still alive: nobody listens on the media ports, and no process of this run listens at all.
                socks = own_sockets()
                res["sockets_while_the_supervisor_lives"] = {"media_port_listeners": tcp_listeners(), "own_listeners": socks["listeners"], "own_processes": socks.get("processes", 0)}
                v("no_listener_after_the_refusal", not tcp_listeners() and not socks["listeners"] and socks.get("processes", 0) >= 1)
                media = sorted(os.listdir(os.path.join(d, "media")))
                log = worker_log(d)
                res["media_folder"], res["worker_log_messages"] = media, [l.get("message") for l in log]
                v("nothing_recorded", not media and not drv.all("record") and bool(log) and not [l for l in log if l.get("message") != "worker_starting"])     # the worker never got a START: its log is its first line
        res["timing"] = [e for e in drv.all("timing")]
        res["supervisor_reports"] = [e for e in drv.all("report")]
        v("mode_checks", ok)
        v("no_supervisor_report", not res["supervisor_reports"])
    finally:
        drv.close()
        killall(procs)
    time.sleep(0.3)
    res["leftovers"] = leftovers()
    v("no_leftover", not res["leftovers"]["processes"] and not res["leftovers"]["listeners"])
    finish(res, True, a.expect_fail, d, v)


# ------------------------------------------------------------------------------------------ row 62: cameras with hand-written sender reports
# M3-AV-2 case (c) and the camera-clock telemetry (capture spec A.8 (2), F; pair-58 navigator B R-2, F-6; D85).
# Added by blueprint row 62; nothing above is changed. The camera is `test-fixtures/fake_cam_sr.py`: it writes
# its RTCP sender reports itself, so a report can pair a TRUE wall clock with a DRIFTING media clock.
CAM_SR = os.path.join(FIX, "fake_cam_sr.py")
if os.environ.get("M3_WORKER_PROPOSED"):            # a worker built OUTSIDE the tree from a proposed change: --variant proposed
    VARIANTS["proposed"] = os.environ["M3_WORKER_PROPOSED"]
CASES["long20"] = {"cams": [(0, 0.0), (0, 0.0)], "events": 20}      # 81 s: long enough for the slew limit to move the video by 30 ms
NEAR_BOUND_MS, CLOCK_SANITY_MS = 30.0, 2000.0    # what the checks hold the worker to (anchor.h: CLOCK_NEAR_BOUND_MS; the sanity bound is the row-62 request)
SR_MODES = {     # per camera: the arguments of the fixture; `base` = the case of CASES that gives the events and the beeps
    # (c) +-200 ppm on the MEDIA clock, the wall clock true: the reports express the drift, the file shows none.
    "drift": {"base": "drift", "cams": [{"drift-ppm": 200.0}, {"drift-ppm": -200.0}]},
    # R-2: a correct clock behind a steady 35 ms encode-and-network delay is NOT "near the bound".
    "delay": {"base": "long", "cams": [{"delay-ms": 35.0}, {"delay-ms": 35.0}]},
    # R-2: the same delay, and camera 1's wall clock steps by 100 ms eight seconds in. The worker follows a changed
    # clock by at most 500 us per second (the slew limit), and the lag is measured against where it PLACES the video:
    # the placement is 30 ms from the baseline 60 s after the step, so the flag is due from second 68 on (81 s run).
    "step": {"base": "long20", "cams": [{"delay-ms": 35.0, "clock-step-ms": 100.0, "clock-step-at-s": 8.0}, {"delay-ms": 35.0}]},
    # F-6: camera 1's wall clock is 10 s ahead from the start: beyond any delay, so it is given up, not recorded at a wrong time.
    "offset": {"base": "long", "cams": [{"clock-offset-ms": 10000.0}, {}]},
    # Fix pass F-M3, review R63-12 / carried question 4: THE WIRING OF THE CLOCK FLOOR IN THE INGEST. Camera 1's wall
    # clock is 1.5 s BEHIND: inside the 2 s gross-error bound, so it is anchored - at its own clock, 1.5 s away from
    # the truth - and the offset is REPORTED (TELEMETRY clocks[].lagMs, the worker's `camera_clock_floor` line); it is
    # NOT corrected. Camera 2's is 3 s behind: the fixture connects seconds before it sends, so the allowance of the
    # anchoring hides the offset and the camera IS anchored; the floor - the smallest lag of every packet, judged
    # without allowance one second into the stream - gives it up by name. The proof build `nofloor` keeps it.
    "behind": {"base": "long", "cams": [{"clock-offset-ms": -1500.0}, {"clock-offset-ms": -3000.0}]},
    # Fix pass F-M3, review R63-11: camera 1 repeats ONE RTP timestamp (frame 120 carries the time of frame 119).
    # The monotonic guard moves that sample; the worker now SAYS so (`video_timestamp_moved`, `retimed` of the summary).
    "retime": {"base": "long", "cams": [{"repeat-ts-at": 120}, {}]},
}


def playable_own_timebase(path):
    """`playable`, with the decode run at the FILE's time base. A camera whose media clock drifts is placed by its
    true time, so its frames are not exactly 20 ms apart; `playable` decodes at the nominal 1/50 s grid, where two
    such frames can land on one tick (ffmpeg then reports a non-increasing dts of ITS OWN output, not of the file).
    The file's own timestamps are checked here to be strictly increasing."""
    _, rep = playable(path)
    dec = sh([FF, "-v", "error", "-xerror", "-i", path, "-map", "0", "-fps_mode", "passthrough", "-enc_time_base:v", "1:90000", "-f", "null", "-"])
    dts = [int(p["dts"]) for p in P111.probe_packets(path, "v:0")]
    rising = all(y > x for x, y in zip(dts, dts[1:]))
    shape = sorted((s[0], s[1]) for s in rep["streams"]) == [("audio", "aac"), ("video", "h264")]
    ok = dec.returncode == 0 and dec.stderr.strip() == "" and rising and shape and rep["tiles_exactly"] and rep["decoded_frames"].get("video", 0) > 0 and rep["decoded_frames"].get("audio", 0) > 0
    return ok, dict(rep, playable=ok, decode_at_file_timebase_rc=dec.returncode, video_dts_strictly_increasing=rising, playable_at_nominal_grid=rep["playable"])


def cmd_srcam(a):
    """mode drift : M3-AV-2 (c). Flash-to-beep offset 0 within the 2 ms regression bound on every event and a fitted
                    slope near 0, although both media clocks drift by 200 ppm. With --sr linear the same cameras send
                    reports WITHOUT rate information (what libavformat's writer sends): the control, which must fail.
       mode delay : nearBound stays false for a correct clock behind a steady 35 ms delay; lagMs reports the delay.
       mode step  : nearBound becomes true for the camera whose clock stepped by 60 ms, and only for that one.
       mode offset: a camera whose wall clock is 10 s off is given up with CAMERA_CLOCK_OUT_OF_BOUND and leaves no
                    video at a wrong time; the other camera records, the worker exits 0.
       mode behind: (R63-12) a camera 1.5 s behind is anchored and its offset reported; one 3 s behind is given up by
                    the clock FLOOR (not at anchoring: its allowance hid the offset). Control: --variant nofloor.
       mode retime: (R63-11) a repeated RTP timestamp is moved by the monotonic guard, and that is counted and logged."""
    global start_sources
    binary = VARIANTS[a.variant]
    d = rundir(a.name, fresh=True)
    mode = SR_MODES[a.mode]
    truth = build_truth(mode["base"])
    for c, extra in zip(truth["cams"], mode["cams"]):
        c["sr"] = dict(extra, sr=a.sr)
        c["drift_ppm"] = extra.get("drift-ppm", 0.0)
        for e in c["events"]:
            e["truth_offset_us"] = 0        # the wall clock of the reports is true: the file must show no offset at any event
    truth["case"] = "srcam-%s" % a.mode

    def sources(d_, truth_, plan, procs, mic_seconds, mic_extra=()):
        mic = spawn([MIC] + mic_out_args(plan) + ["--manifest", os.path.join(d_, "mic.jsonl"),
                     "--seconds", "%.3f" % mic_seconds, "--beep-at-us", ",".join(str(b) for b in truth_["beeps"])] + beep_on_args(plan) + list(mic_extra),
                    stdin=subprocess.DEVNULL, stderr=open(os.path.join(d_, "mic.err"), "w"))
        procs.append(mic)
        cps = []
        for c, pc in zip(truth_["cams"], plan["cameras"]):
            args = [sys.executable, "-B", CAM_SR, "--url", pc["ingestUrl"], "--epoch-us", str(truth_["epoch_us"]), "--work", d_, "--frames", str(c["frames"]),
                    "--flash-first", str(c["flash_first"]), "--flash-every", str(c["flash_every"])]
            for k, val in c["sr"].items():
                args += ["--" + k, str(val)]
            cp = spawn(args, stdin=subprocess.DEVNULL, stderr=open(os.path.join(d_, "cam%d.err" % c["cam"]), "w"))
            procs.append(cp)
            cps.append(cp)
        return mic, cps

    plain, start_sources = start_sources, sources         # run_session starts the sources through this name
    try:
        mono_epoch = time.monotonic() + (truth["epoch_us"] / 1e6 - time.time())
        w, plan, info, _ = run_session(a, d, binary, truth)
    finally:
        start_sources = plain
    frame_stats(w, info)
    res = {"check": "row 62: camera with hand-written sender reports (%s, reports %s)" % (a.mode, a.sr), "run": a.name, "mode": a.mode, "sr": a.sr, "variant": a.variant, "info": info}
    paths = [c["outputPath"] for c in plan["cameras"]]
    log = worker_log(d)
    tel = [(t - mono_epoch, f) for t, f in w.of("TELEMETRY")]
    clocks = {}                                           # deviceId -> [(seconds after the epoch, lagMs, nearBound)]
    for t, f in tel:
        for c in f.get("clocks", []):
            clocks.setdefault(c["deviceId"], []).append((round(t, 2), c["lagMs"], c["nearBound"]))
    res["clocks"] = {k: {"frames": len(rows), "near_bound_true_frames": sum(1 for r in rows if r[2]), "first_true_at_s": next((r[0] for r in rows if r[2]), None),
                         "lag_ms_first_last": [rows[0][1], rows[-1][1]] if rows else None} for k, rows in clocks.items()}
    # Per second after the epoch: [second, last lagMs of that second, nearBound true in it] - the evidence behind the flags.
    res["clock_series"] = {k: [[s, [r[1] for r in rows if int(r[0]) == s][-1], any(r[2] for r in rows if int(r[0]) == s)] for s in sorted({int(r[0]) for r in rows})] for k, rows in clocks.items()}
    stream_end = max(c["frames"] for c in truth["cams"]) / FPS      # after the cameras' last frame the telemetry says nothing about a clock
    res["anchored"] = [{"source": l["source"], "mode": l.get("mode"), "shift_us": l.get("shift_us")} for l in log if l["message"] == "video_anchored"]
    v = Crit()
    rc = info.get("rc") or {}
    v("worker_exit_0", rc.get("worker") == 0 and not info["crash"])
    v("frames_clean", info["first_frame_is_hello"] and not info["lines_that_are_no_frame"])
    v("worker_sockets_tcp_loopback_only", sockets_clean(info["sockets_before_stop"]))

    def near(dev, lo=None, hi=None):
        return [r for r in clocks.get(dev, []) if (lo is None or r[0] >= lo) and (hi is None or r[0] < hi)]

    if a.mode in ("drift", "delay"):
        v("sources_exit_0", rc.get("cam1") == 0 and rc.get("cam2") == 0)
        pl = [playable_own_timebase(p) if os.path.exists(p) else (False, None) for p in paths]
        res["files"] = {os.path.basename(p): r for p, (_, r) in zip(paths, pl)}
        v("both_files_playable", all(o for o, _ in pl))
        v("anchored_on_the_sender_reports", sorted((x["source"].rpartition(".")[2], x["mode"]) for x in res["anchored"]) == [("ingest1", "prft"), ("ingest2", "prft")])
        if v.ok:
            reg, prod, rav = av_offsets(d, truth, paths)
            res["av_offsets"] = rav
            v("av_regression_2ms", reg)
            v("av_product_40ms", prod)
    if a.mode == "drift" and "av_offsets" in res:
        slopes, near0 = {}, True
        for c in truth["cams"]:
            r = res["av_offsets"].get("cam%d" % c["cam"], {})
            ev = r.get("events") or []
            span = ev[-1]["flash_s"] - ev[0]["flash_s"] if len(ev) >= 3 else 0
            tol = REGRESSION_MS / span * 1000.0 if span else 0.0
            good = span > 0 and abs(r["fitted_slope_ppm"]) <= tol
            slopes["cam%d" % c["cam"]] = {"media_clock_drift_ppm": c["drift_ppm"], "fitted_ppm": r.get("fitted_slope_ppm"), "tolerance_ppm": round(tol, 1), "span_s": round(span, 2), "near_zero": good}
            near0 &= good
        res["drift_slope"] = slopes
        v("drift_slope_near_zero", near0)
    if a.mode == "delay":
        # While the cameras stream. The delay is a LOWER bound of the lag: the receiver hands a frame over when the next
        # one arrives (one frame, 20 ms, more) - measured 55 ms for a 35 ms delay. Not vacuous: without the delay it is ~20.
        last = {dev: near(dev, 5, stream_end - 1)[-1][1] for dev in clocks if near(dev, 5, stream_end - 1)}
        res["lag_while_streaming_ms"] = last
        v("lag_reports_the_delay", sorted(last) == ["CAM-01", "CAM-02"] and all(35.0 <= x <= 35.0 + 20.0 + 10.0 for x in last.values()))
        v("near_bound_false_with_a_steady_delay", sorted(clocks) == ["CAM-01", "CAM-02"] and not any(r[2] for rows in clocks.values() for r in rows))
    if a.mode == "step":
        # Step at second 8; the placement has moved 26 ms at second 60 and 30 ms at second 68.
        v("near_bound_false_before_the_step", len(near("CAM-01", 3, 8)) > 20 and not any(r[2] for r in near("CAM-01", None, 60)))
        v("near_bound_true_after_a_clock_step", len(near("CAM-01", 74, stream_end - 1)) > 20 and all(r[2] for r in near("CAM-01", 74, stream_end - 1)))
        v("near_bound_false_for_the_steady_camera", len(near("CAM-02", None, stream_end - 1)) > 100 and not any(r[2] for r in near("CAM-02", None, stream_end - 1)))
    if a.mode == "behind":
        floor = {str(l.get("source")).rpartition(".")[2]: l for l in log if l.get("rule") == "floor"}      # the judgement of the floor, one line per camera
        res["clock_floor"] = {k: {"message": l["message"], "lag_ms": l.get("lag_ms"), "bound_ms": l.get("bound_ms"), "packets": l.get("packets")} for k, l in floor.items()}
        res["warnings"] = sorted((x["code"], x["reason"], x["subject"]) for x in info["warnings"])
        res["given_up"] = [str(l.get("source")).rpartition(".")[2] for l in log if l["message"] == "CAMERA_CLOCK_OUT_OF_BOUND"]
        lag1 = [r[1] for r in near("CAM-01", 5, stream_end - 1)]
        res["lag_of_the_camera_1_5_s_behind_ms"] = {"frames": len(lag1), "min": min(lag1) if lag1 else None, "max": max(lag1) if lag1 else None}
        # 1.5 s behind: ANCHORED (it records), the floor judged it sane, and the offset is in the telemetry and in the log.
        v("camera_1500ms_behind_is_anchored_and_records", any(x["source"].endswith("ingest1") for x in res["anchored"]) and "ingest1" not in res["given_up"]
          and os.path.exists(paths[0]) and len(P111.probe_packets(paths[0], "v:0")) > 100 and not any(w_[2] == "CAM-01" and w_[1] != "CAMERA_STREAM_ENDED" for w_ in res["warnings"]))
        v("its_offset_is_reported_not_corrected", len(lag1) > 20 and all(1500.0 <= x <= 1500.0 + 100.0 for x in lag1)
          and floor.get("ingest1", {}).get("message") == "camera_clock_floor" and 1500.0 <= float(floor["ingest1"].get("lag_ms", 0)) <= 1600.0)
        # 3 s behind: given up BY THE FLOOR (the line of the floor's judgement says out of bound), by name, once.
        v("camera_3000ms_behind_is_given_up_by_the_clock_floor", floor.get("ingest2", {}).get("message") == "camera_clock_out_of_bound" and 3000.0 <= float(floor["ingest2"].get("lag_ms", 0)) <= 3200.0
          and res["given_up"] == ["ingest2"] and ("CAPTURE_FAULT", "CAMERA_CLOCK_OUT_OF_BOUND", "CAM-02") in res["warnings"])
        # What review note R63-16 says and this check MEASURES (not a criterion): the video of the given-up camera that was placed before the floor judged it.
        res["video_packets_of_the_given_up_camera"] = len(P111.probe_packets(paths[1], "v:0")) if os.path.exists(paths[1]) else 0
        v("the_given_up_camera_was_anchored_first", any(x["source"].endswith("ingest2") for x in res["anchored"]))       # else the floor was never asked: the allowance did not hide the offset
    if a.mode == "retime":
        moved = [l for l in log if l["message"] == "video_timestamp_moved"]
        summary = {l.get("cam"): l.get("retimed") for l in log if l["message"] == "camera_summary"}
        res["video_timestamp_moved"] = [{k: l.get(k) for k in ("source", "dts_in", "dts", "pts_in", "pts", "video_packets")} for l in moved]
        res["retimed"] = summary
        v("sources_exit_0", rc.get("cam1") == 0 and rc.get("cam2") == 0)
        v("a_moved_timestamp_is_logged_once_with_its_numbers", len(moved) == 1 and str(moved[0].get("source")).endswith("ingest1") and moved[0].get("dts", 0) > moved[0].get("dts_in", 1 << 62))
        v("the_summary_counts_the_moved_samples", summary.get(1) == 1)
        v("CONTROL_the_camera_with_plain_timestamps_counts_none", summary.get(2) == 0)
        dts = [int(p["dts"]) for p in P111.probe_packets(paths[0], "v:0")] if os.path.exists(paths[0]) else []
        v("the_file_time_never_goes_backwards", len(dts) > 100 and all(y > x for x, y in zip(dts, dts[1:])))
    if a.mode == "offset":
        given_up = [l for l in log if l["message"] == "CAMERA_CLOCK_OUT_OF_BOUND"]
        res["given_up"] = given_up
        res["warnings"] = sorted((x["code"], x["subject"]) for x in info["warnings"])
        v("camera_with_a_wrong_clock_is_given_up", [str(l.get("source")).rpartition(".")[2] for l in given_up] == ["ingest1"] and ("CAPTURE_FAULT", "CAM-01") in res["warnings"])
        video1 = len(P111.probe_packets(paths[0], "v:0")) if os.path.exists(paths[0]) else 0
        res["video_packets_of_the_wrong_clock_camera"] = video1
        v("no_video_recorded_at_a_wrong_time", video1 == 0)
        ok2 = os.path.exists(paths[1]) and playable_own_timebase(paths[1])[0]
        v("the_other_camera_records", ok2)
        if ok2:
            reg, prod, rav = av_offsets(d, dict(truth, cams=truth["cams"][1:]), paths[1:])
            res["av_offsets"] = rav
            v("av_regression_2ms", reg)
    v("no_leftover", not info["leftovers"]["processes"] and not info["leftovers"]["listeners"])
    finish(res, True, a.expect_fail, d, v)


# ------------------------------------------------------------------------------------------ row 59: the fMP4 writer
# Chains, checkpoints, tail validation, failed write, observed keyframe interval (checks M3-WI-1 "running hash ==
# closed-file re-hash, checkpoints contiguous", M3-KC-2, M3-KC-4, M3-MG-1; capture spec A.5, C.1-C.5). Added by
# blueprint row 59. In the code above it changed only: V (protocol 3), and the four places that held the record
# sequence to exactly [1, 2, 3, 4] (checkpoints now travel in the same sequence); `cmd_session` got one call.
TAILCHECK = os.path.join(HERE, "tail_check.ts")              # the Core's validateCameraFile on one file (the product function)
REPLAY = os.path.join(BUILD, "writer_replay")
VARIANTS.update({"writefault": os.path.join(BUILD, "capture-worker-writefault"), "writefault-notrunc": os.path.join(BUILD, "capture-worker-writefault-notrunc")})
GENESIS = hashlib.sha256(b"").digest()
GOP_TOLERANCE = 0.05                                         # the worker's GOP_TOLERANCE_PERMILLE


def checkpoints_of(records, device):
    """The FRAGMENT_CHECKPOINT records of one camera, in the order they arrived (frames or supervisor events)."""
    return [r["record"] for r in records if r["record"]["kind"] == "FRAGMENT_CHECKPOINT" and r["record"].get("deviceId") == device]


def rehash(path):
    """THIS HARNESS'S OWN re-derivation from the closed file (hashlib, the box walk of boxes()): per fragment its
    byte range, digest, chain and running prefix - nothing of the worker and nothing of the Core is used."""
    data = open(path, "rb").read()
    bw = boxes(path)
    out, chain, bx = [], GENESIS, bw["boxes"]
    for j, b in enumerate(bx):
        if b["type"] != "moof" or j + 1 >= len(bx) or bx[j + 1]["type"] != "mdat":
            continue
        s, e = b["offset"], bx[j + 1]["offset"] + bx[j + 1]["size"]
        frag = hashlib.sha256(data[s:e]).digest()
        chain = hashlib.sha256(chain + frag).digest()
        out.append({"index": len(out) + 1, "start": s, "len": e - s, "fragSha256": frag.hex(), "chainSha256": chain.hex(), "prefixSha256": hashlib.sha256(data[:e]).hexdigest(),
                    "video_samples": b["tracks"].get(1, {}).get("samples", 0), "moof_size": b["size"]})
    init = next((b["offset"] for b in bx if b["type"] == "moof"), len(data))
    return {"fragments": out, "init_bytes": init, "bytes": len(data), "tiles_exactly": bw["tiles_exactly"], "whole_file_sha256": hashlib.sha256(data).hexdigest(),
            "only_fragments_after_init": [b["type"] for b in bx if b["offset"] >= init] == ["moof", "mdat"] * len(out)}


def tail_check(path, records=None):
    """The Core's tail validation (apps/core-server/src/capture/fragments.ts) on one file, through its test tool."""
    cmd = ["npx", "tsx", TAILCHECK, path]
    if records is not None:
        rp = path + ".records.json"
        json.dump(records, open(rp, "w"))
        cmd += ["--records", rp]
    p = sh(cmd, cwd=REPO)
    if records is not None:
        os.remove(rp)
    try:
        return json.loads(p.stdout.strip().splitlines()[-1])
    except (ValueError, IndexError):
        return {"ok": False, "flags": ["TOOL_FAILED"], "error": (p.stderr or p.stdout)[-400:]}


SAME = ("index", "start", "len", "fragSha256", "chainSha256", "prefixSha256")
SEAL_MAX_FRAGMENT_BYTES = 64 * 1024 * 1024           # SEALING_MAX_FRAGMENT_BYTES = VERIFY_MAX_OPEN_FRAGMENT_BYTES: what the worker runs with by default


def writer_criteria(v, res, d, paths, records, truth, log=None):
    """What every recorded session must show of the writer (M3-WI-1): the checkpoints the worker gave ARE the closed
    file re-hashed by this harness, they are contiguous, the Core's tail validation agrees, and the keyframe
    interval the worker observed is the camera's."""
    out = {}
    log = worker_log(d) if log is None else log
    gop_ms = truth.get("gop", FPS) * 1000.0 / FPS
    for i, p in enumerate(paths):
        dev, name = "CAM-0%d" % (i + 1), os.path.basename(p)
        cps, own = checkpoints_of(records, dev), rehash(p)
        tc = tail_check(p, cps)
        first = [r for r in records if r["record"]["kind"] == "FIRST_DURABLE_FRAGMENT" and r["record"]["deviceId"] == dev]
        first_cp = [r for r in records if r["record"]["kind"] == "FRAGMENT_CHECKPOINT" and r["record"]["deviceId"] == dev][:1]
        kf = [r["record"] for r in records if r["record"]["kind"] == "KEYFRAME_INTERVAL" and r["record"]["deviceId"] == dev]
        said_above = any(l.get("message") == "keyframe_interval_above_bound" and l.get("cam") == i + 1 for l in log)
        out[name] = {"checkpoints": len(cps), "fragments_in_file": len(own["fragments"]), "init_bytes": own["init_bytes"], "bytes": own["bytes"], "last_chain": cps[-1]["chainSha256"] if cps else None,
                     "tail_validation": {k: tc.get(k) for k in ("ok", "flags", "state", "durableLength", "comparison", "partNames", "walkMs", "error") if k in tc}, "keyframe_interval": kf,
                     "camera_gop_ms": gop_ms, "warned_above_bound_in_log": said_above}
        v("checkpoints_contiguous", bool(cps) and [c["index"] for c in cps] == list(range(1, len(cps) + 1)) and cps[0]["start"] == own["init_bytes"]
          and all(b["start"] == a_["start"] + a_["len"] for a_, b in zip(cps, cps[1:])))
        v("running_hash_equals_closed_file_rehash", len(cps) == len(own["fragments"]) > 0 and all(c[k] == o[k] for c, o in zip(cps, own["fragments"]) for k in SAME)
          and cps[-1]["prefixSha256"] == own["whole_file_sha256"] and cps[-1]["start"] + cps[-1]["len"] == own["bytes"] and own["tiles_exactly"] and own["only_fragments_after_init"])
        v("plaintext_chain_equals_stored_chain_without_cipher", all(c["plaintextSha256"] == c["fragSha256"] and c["plaintextChainSha256"] == c["chainSha256"] and c["keyId"] is None and c["gcmIv"] is None and c["gcmTag"] is None for c in cps))
        v("tail_validation_clean_and_matches_records", tc.get("ok") is True and tc.get("flags") == [] and (tc.get("comparison") or {}).get("verdict") == "MATCH" and tc["comparison"]["matched"] == len(cps) and not tc.get("partNames"))
        # Two implementations (the worker's C, the Core's TypeScript) read the same media time and keyframe flag out of every moof.
        v("media_time_equals_the_file_walk", len(tc.get("fragments", [])) == len(cps) > 0 and all(f["media"] == {"mediaStartMs": c["mediaStartMs"], "mediaDurationMs": c["mediaDurationMs"], "keyframe": c["keyframe"]} for f, c in zip(tc["fragments"], cps))
          and all(c["keyframe"] == (o["video_samples"] > 0) for c, o in zip(cps, own["fragments"])))
        v("first_durable_fragment_is_the_first_checkpoint", len(first) == 1 and len(first_cp) == 1 and bool(cps) and first[0]["record"]["bytes"] == cps[0]["start"] + cps[0]["len"] and first_cp[0]["seq"] > first[0]["seq"])     # before it; a record of the other camera may lie between the two
        # Fix pass F-M3: every durable fragment is inside the bound of the seal (R63-02), and the first durable fragment states the sync level it got (R63-09).
        v("every_durable_fragment_inside_the_seal_bound", all(c["len"] <= SEAL_MAX_FRAGMENT_BYTES for c in cps))
        v("first_durable_fragment_states_its_sync_level", len(first) == 1 and first[0]["record"].get("syncLevel") in ("F_FULLFSYNC", "FSYNC"))
        out[name]["sync_level"] = first[0]["record"].get("syncLevel") if first else None
        v("durable_instants_grow", all(b["durableAt"] >= a_["durableAt"] for a_, b in zip(cps, cps[1:])) and all(abs(c["durableAt"] / 1000.0 - time.time()) < 3600 for c in cps))
        v("keyframe_interval_reported", len(kf) == 1 and kf[0]["boundMs"] == 2000 and kf[0]["intervals"] >= 1 and abs(kf[0]["observedMs"] - gop_ms) <= GOP_TOLERANCE * gop_ms
          and kf[0]["aboveBound"] == (gop_ms > 2000 * (1 + GOP_TOLERANCE)) and said_above == kf[0]["aboveBound"])
    res["writer"] = out


def run_until(a, d, binary, truth, ready, hold_s):
    """A worker-level session that is ended by SIGKILL: sources started, `ready(worker)` awaited, `hold_s` slept, kill.
    Returns (worker, plan, info): info carries the kill instant and how long the harness needed to know the tail."""
    sid = "S-M3W-%s" % a.name.upper().replace("_", "-")[-40:].strip("-")
    ports_free_or_exit()
    plan = make_plan(d, sid)
    json.dump(truth, open(os.path.join(d, "truth.json"), "w"), indent=1)
    procs, info = [], {"sessionId": sid}
    paths = [c["outputPath"] for c in plan["cameras"]]
    w = Worker(d, binary)
    procs.append(w.p)
    try:
        w.wait(lambda f: f.get("type") == "HELLO", 5, "HELLO")
        _, ackf = w.ack(w.command(sid, "START", attempt=1, plan=plan))
        assert ackf["ok"], ackf
        t_l = time.monotonic()
        while len(tcp_listeners()) < 2 and time.monotonic() - t_l < 5:
            time.sleep(0.05)
        start_sources(d, truth, plan, procs, (truth["epoch_us"] / 1e6 - time.time()) + max(c["frames"] for c in truth["cams"]) / FPS + 8)
        end = time.monotonic() + 60
        while not ready(w) and time.monotonic() < end and w.p.poll() is None:
            time.sleep(0.01)
        info["ready"] = bool(ready(w))
        time.sleep(hold_s)
        info["worker_alive_at_kill"] = w.p.poll() is None
        info["kill_wall_us"] = time.time_ns() // 1000
        t_kill = time.monotonic()
        os.kill(w.p.pid, signal.SIGKILL)
        w.p.wait()
        tails = [boxes(p) if os.path.exists(p) else None for p in paths]          # the S1 monitor's step: the tail of each file, known
        info["truncation_detected_ms"] = round((time.monotonic() - t_kill) * 1000, 3)
        info["tails_at_detection"] = [None if t is None else {"tiles_exactly": t["tiles_exactly"], "moofs": t["kinds"].count("moof"), "last_two": t["kinds"][-2:]} for t in tails]
        time.sleep(0.4)                                       # the frames that were in the pipe are read
    finally:
        killall(procs)
    time.sleep(0.3)
    frame_stats(w, info)
    info["leftovers"] = leftovers()
    return w, plan, info


def enough_checkpoints(n):
    """Both cameras have `n` checkpoints of fragments WITH VIDEO (before a camera's first keyframe its file gets
    audio-only fragments from the stall cut: they are checkpoints too, and no video is durable yet)."""
    def ready(w):
        recs = [f for _, f in w.of("RECORD")]
        return all(len([c for c in checkpoints_of(recs, dev) if c["keyframe"]]) >= n for dev in ("CAM-01", "CAM-02"))
    return ready


def killed_file(v, p, cps, label):
    """A file a SIGKILL left: it ends on a fragment boundary, every checkpoint that arrived equals the bytes, and what
    the file holds beyond them is whole fragments (written, not yet reported). Returns (own re-hash, Core verdict)."""
    own, tc = rehash(p), tail_check(p, cps)
    v("killed_files_end_on_a_fragment_boundary", own["tiles_exactly"] and own["only_fragments_after_init"] and tc.get("state") == "CLEAN")
    cmpn = tc.get("comparison") or {}
    v("no_torn_fragment_and_records_match_the_file", set(tc.get("flags", ["?"])) <= {"FRAGMENTS_BEYOND_RECORDS"} and cmpn.get("matched") == len(cps) and cmpn.get("missing") == 0 and cmpn.get("firstMismatch") is None
      and len(own["fragments"]) >= len(cps) and all(c[k] == o[k] for c, o in zip(cps, own["fragments"]) for k in SAME))
    end = cps[-1]["start"] + cps[-1]["len"] if cps else 0
    v("durable_prefix_rehashes_to_the_recorded_prefix", bool(cps) and sha_prefix(p, end) == cps[-1]["prefixSha256"])
    return own, {"file": label, "bytes": own["bytes"], "fragments_in_file": len(own["fragments"]), "checkpoints_received": len(cps), "whole_fragments_beyond_records": len(own["fragments"]) - len(cps),
                 "tail_validation": {k: tc.get(k) for k in ("ok", "flags", "state", "durableLength", "comparison", "walkMs", "error") if k in tc}}


def cmd_kc2(a):
    """M3-KC-2: the worker is killed with SIGKILL in the middle of a recording.
       (1) the truncation is known within 20 ms of the kill (the harness's own box walk of both tails, as S1's monitor did);
       (2) both files end on a fragment boundary, every checkpoint that arrived equals the bytes, the durable prefix
           re-hashes to the recorded prefix (no torn fragment enters custody);
       (3) THE CUT INSIDE AN MDAT: a copy of file 1 cut 37 bytes into the payload of its last recorded fragment is
           ACCEPTED by ffprobe and by the decoder (exit 0), and FLAGGED by the Core's tail validation (TORN_TAIL: the
           declared size exceeds the bytes present); the drop-fragment rule (cut the copy at the durable length)
           gives a clean file that hashes to the prefix recorded for the fragment before;
       (4) a `.part` hard link beside a camera file is a second NAME of it, not a second file (pair-58 R-5).
       --control nocut: (3) on a copy that is NOT cut - the validation must not flag it: the check must FAIL there."""
    d = rundir(a.name, fresh=True)
    truth = build_truth("zero", frames_override=(900, 900))
    w, plan, info = run_until(a, d, VARIANTS[a.variant], truth, enough_checkpoints(3), 0.35)
    recs = info["records"]
    paths = [c["outputPath"] for c in plan["cameras"]]
    res, v = {"check": "M3-KC-2 worker SIGKILL mid-write + RECOVERY tail validation", "run": a.name, "control": a.control, "info": info, "files": {}}, Crit()
    v("killed_while_recording", info["ready"] and info["worker_alive_at_kill"] and all(os.path.exists(p) for p in paths))
    if v.ok:
        v("truncation_detected_within_20ms", info["truncation_detected_ms"] <= 20.0 and all(t is not None for t in info["tails_at_detection"]))
        owns = []
        for i, p in enumerate(paths):
            own, rep_ = killed_file(v, p, checkpoints_of(recs, "CAM-0%d" % (i + 1)), os.path.basename(p))
            owns.append(own)
            res["files"][os.path.basename(p)] = rep_
        # (3) the cut inside the mdat of the last RECORDED fragment of file 1
        cps = checkpoints_of(recs, "CAM-01")
        last, frag = cps[-1], owns[0]["fragments"][len(cps) - 1]
        cutdir = os.path.join(d, "cut")
        os.makedirs(cutdir, exist_ok=True)
        cut = os.path.join(cutdir, "VIDEO-01.mp4")
        data = open(paths[0], "rb").read()
        cut_at = last["start"] + frag["moof_size"] + 8 + 37
        open(cut, "wb").write(data if a.control == "nocut" else data[:cut_at])
        probe = sh([FP, "-v", "error", "-show_entries", "format=duration", "-of", "json", cut])
        dec = sh([FF, "-v", "error", "-i", cut, "-map", "0", "-f", "null", "-"])
        tc = tail_check(cut, cps)
        tail = tc.get("tail") or {}
        res["cut"] = {"cut_at_byte": None if a.control == "nocut" else cut_at, "fragment": last["index"], "bytes": os.path.getsize(cut), "ffprobe_rc": probe.returncode,
                      "ffprobe_duration_s": (json.loads(probe.stdout or "{}").get("format") or {}).get("duration"), "decoder_rc": dec.returncode, "decoder_error_lines": len(dec.stderr.strip().splitlines()),
                      "tail_validation": {k: tc.get(k) for k in ("ok", "flags", "state", "durableLength", "tail", "comparison", "walkMs", "error") if k in tc}}
        v("ffprobe_and_decoder_accept_the_cut_file", probe.returncode == 0 and dec.returncode == 0)
        v("tail_validation_flags_the_cut", tc.get("state") == "TORN_TAIL" and tail.get("reason") == "DECLARED_SIZE_EXCEEDS_BYTES_PRESENT" and tail.get("boxType") == "mdat" and tc.get("durableLength") == last["start"]
          and tail.get("start") == last["start"] and tail.get("bytesPresent") == cut_at - last["start"] and "TORN_TAIL" in tc.get("flags", []) and "FILE_SHORTER_THAN_RECORDS" in tc.get("flags", []))
        # The drop-fragment rule on the copy: [durable length, end) is dropped; what is left is the prefix recorded for the fragment before.
        os.truncate(cut, tc.get("durableLength") or 0)
        after = tail_check(cut, cps[:-1])
        res["cut"]["after_drop"] = {"bytes": os.path.getsize(cut), "state": after.get("state"), "flags": after.get("flags"), "sha256": sha_prefix(cut, os.path.getsize(cut)), "recorded_prefix_of_the_fragment_before": cps[-2]["prefixSha256"]}
        v("drop_fragment_rule_recovers_the_previous_prefix", after.get("ok") is True and res["cut"]["after_drop"]["sha256"] == cps[-2]["prefixSha256"] and os.path.getsize(cut) == last["start"])
        # (4) the names a killed worker can leave beside a camera file
        pdir = os.path.join(d, "parts")
        os.makedirs(pdir, exist_ok=True)
        cam = os.path.join(pdir, "VIDEO-01.mp4")
        open(cam, "wb").write(data)
        os.link(cam, cam + ".4711.part")                      # a kill between link() and unlink(): the SAME file under its temporary name
        open(cam + ".4712.part", "wb").write(data[:cps[0]["start"] + cps[0]["len"]])      # a kill before link(): a file of its own
        names = tail_check(cam, cps[:len(owns[0]["fragments"])]).get("partNames")
        res["part_names"] = names
        v("part_name_is_a_second_name_not_a_second_file", names == [{"name": "VIDEO-01.mp4.4711.part", "kind": "SECOND_NAME_OF_CAMERA_FILE", "nameMayBeRemoved": True},
                                                                   {"name": "VIDEO-01.mp4.4712.part", "kind": "ORPHAN_OF_A_DEAD_WORKER", "nameMayBeRemoved": False}] and os.stat(cam).st_nlink == 2)
        shutil.rmtree(cutdir)
        shutil.rmtree(pdir)
    v("no_leftover", not info["leftovers"]["processes"] and not info["leftovers"]["listeners"])
    finish(res, True, a.expect_fail, d, v)


def cmd_kc4(a):
    """M3-KC-4: a camera with a long GOP (--gop 250: a keyframe every 5 s) and a worker that is killed in the middle
    of a GOP. The loss is bounded by ONE FRAGMENT - on stream copy the smallest whole number of camera GOPs that
    reaches the 2 s fragment minimum: one GOP for this camera - and it is REPORTED: the warning of the capture
    channel before the kill, and the record that names the interval, which covers the loss that then happened.
    With --gop 50 (a camera inside the bound) nothing is warned and the record says so: the control must FAIL on
    exactly the two 'reported' criteria."""
    d = rundir(a.name, fresh=True)
    truth = build_truth("long", gop=a.gop)
    gop_s = a.gop / FPS
    # Killed half a GOP after BOTH the first video fragment was durable and the worker said what interval it observed
    # (a long-GOP camera: at its second keyframe; a camera inside the bound: after three intervals).
    video, said = enough_checkpoints(1), lambda w_: len([f for _, f in w_.of("RECORD") if f["record"]["kind"] == "KEYFRAME_INTERVAL"]) == 2
    w, plan, info = run_until(a, d, VARIANTS[a.variant], truth, lambda w_: video(w_) and said(w_), gop_s / 2.0)
    recs, log = info["records"], worker_log(d)
    paths = [c["outputPath"] for c in plan["cameras"]]
    res, v = {"check": "M3-KC-4 long-GOP crash loss: bounded by one fragment and reported", "run": a.name, "camera_gop_frames": a.gop, "camera_gop_s": gop_s, "info": info, "files": {}}, Crit()
    v("killed_while_recording", info["ready"] and info["worker_alive_at_kill"] and all(os.path.exists(p) for p in paths))
    if v.ok:
        t0 = [l for l in log if l["message"] == "audio_started"][0]["t0_real_us"]
        fragment_gops = max(1, -(-2000 // int(gop_s * 1000)))            # whole GOPs per fragment: ceil(2 s / GOP)
        for i, p in enumerate(paths):
            dev, cam = "CAM-0%d" % (i + 1), truth["cams"][i]
            own, rep_ = killed_file(v, p, checkpoints_of(recs, dev), os.path.basename(p))
            fvs = [r["record"] for r in recs if r["record"]["kind"] == "FIRST_VIDEO_SAMPLE" and r["record"]["deviceId"] == dev][0]
            first_frame = round((t0 + fvs["pts"] * 1e6 / fvs["timescale"] - cam["claimed_epoch_us"]) / FRAME_US)       # the camera frame the file starts with
            sent = min(cam["frames"], (info["kill_wall_us"] - truth["epoch_us"]) // FRAME_US + 1)                      # frames the camera had pushed when the worker died
            durable = sum(f["video_samples"] for f in own["fragments"])
            loss_s = (sent - first_frame - durable) / FPS
            kf = [r["record"] for r in recs if r["record"]["kind"] == "KEYFRAME_INTERVAL" and r["record"]["deviceId"] == dev]
            warned = [f for f in info["warnings"] if f["code"] == "CAPTURE_FAULT" and f["state"] == "ACTIVE" and f["subject"] == dev]
            lines = [l["message"] for l in log if l.get("cam") == i + 1 and str(l.get("message", "")).startswith("keyframe_interval")]
            rep_.update({"first_camera_frame_in_file": first_frame, "camera_frames_pushed_at_kill": sent, "video_frames_durable": durable, "video_lost_s": round(loss_s, 3), "lost_more_than_the_2s_target": loss_s > 2.0,
                         "keyframe_interval_record": kf, "capture_fault_warnings_before_kill": len(warned), "log_lines": lines})
            res["files"][os.path.basename(p)] = rep_
            v("file_starts_on_a_camera_keyframe", first_frame >= 0 and first_frame % a.gop == 0 and durable > 0 and durable % a.gop == 0)
            v("loss_bounded_by_one_fragment", 0 < loss_s <= fragment_gops * gop_s + 0.3)
            v("gop_warning_raised_before_the_kill", len(warned) == 1 and "keyframe_interval_above_bound" in lines)
            v("keyframe_interval_record_names_the_camera_gop", len(kf) == 1 and kf[0]["aboveBound"] is True and kf[0]["complete"] is True and kf[0]["boundMs"] == 2000 and abs(kf[0]["observedMs"] - gop_s * 1000) <= GOP_TOLERANCE * gop_s * 1000)
            # What the Core can state from the record alone: the loss window of this file is ceil(target / observed) GOPs.
            stated_ms = (-(-2000 // max(1, kf[0]["observedMs"])) * kf[0]["observedMs"]) if kf else 0
            rep_["loss_window_stated_from_the_record_ms"] = stated_ms
            v("reported_interval_covers_the_loss", bool(kf) and loss_s * 1000 <= stated_ms * (1 + GOP_TOLERANCE) + 300)
    v("no_leftover", not info["leftovers"]["processes"] and not info["leftovers"]["listeners"])
    finish(res, True, a.expect_fail, d, v)


def cmd_writefault(a):
    """A write that comes back SHORT and then fails (the proof build `writefault`: fragment 3 of camera 1, half of
    it reaches the file, then ENOSPC). The worker must leave file 1 AT ITS LAST GOOD LENGTH (the end of fragment 2),
    give no checkpoint for the failed fragment, close the other camera's file whole, and exit 70 with CRASH.
    With --variant writefault-notrunc (the same fault, the truncation switched off) the torn tail stays and the
    Core's tail validation FLAGS the file: that run must FAIL on exactly the two criteria of the truncation."""
    d = rundir(a.name, fresh=True)
    truth = build_truth("zero", frames_override=(450, 450))
    w, plan, info, _ = run_session(a, d, VARIANTS[a.variant], truth)
    frame_stats(w, info) if w.of("HEARTBEAT") else None
    recs, log = info.get("records", []), worker_log(d)
    paths = [c["outputPath"] for c in plan["cameras"]]
    res, v = {"check": "failed / short write: the file goes back to its last good length", "run": a.name, "variant": a.variant, "info": info, "files": {}}, Crit()
    crash = [f for _, f in w.of("CRASH")]
    res["worker_rc"], res["crash"] = info.get("rc", {}).get("worker"), crash
    v("worker_exits_70_with_crash", res["worker_rc"] == 70 and len(crash) == 1 and crash[0]["exitCode"] == 70)
    v("both_files_exist", all(os.path.exists(p) for p in paths))
    if v["both_files_exist"]:
        cps1, cps2 = checkpoints_of(recs, "CAM-01"), checkpoints_of(recs, "CAM-02")
        own1, tc1, tc2 = rehash(paths[0]), tail_check(paths[0], cps1), tail_check(paths[1], cps2)
        good = cps1[-1]["start"] + cps1[-1]["len"] if cps1 else -1
        said = [l for l in log if l.get("message") == "WRITER_WRITE_FAILED"]
        res["files"] = {"VIDEO-01.mp4": {"bytes": own1["bytes"], "last_good_length_by_the_checkpoints": good, "checkpoints": [c["index"] for c in cps1], "whole_fragments_in_file": len(own1["fragments"]), "tiles_exactly": own1["tiles_exactly"],
                                         "tail_validation": {k: tc1.get(k) for k in ("ok", "flags", "state", "durableLength", "tail", "comparison") if k in tc1}},
                        "VIDEO-02.mp4": {"checkpoints": len(cps2), "tail_validation": {k: tc2.get(k) for k in ("ok", "flags", "state", "comparison") if k in tc2}}}
        res["log_line_of_the_failed_write"] = said
        v("no_checkpoint_for_the_failed_fragment", [c["index"] for c in cps1] == [1, 2])
        v("file1_is_at_its_last_good_length", own1["bytes"] == good and sha_prefix(paths[0], own1["bytes"]) == (cps1[-1]["prefixSha256"] if cps1 else None))
        v("tail_validation_clean", tc1.get("ok") is True and tc1.get("flags") == [] and (tc1.get("comparison") or {}).get("verdict") == "MATCH")
        v("log_names_the_failed_write", len(said) == 1 and said[0].get("cam") == 1 and said[0].get("last_good_bytes") == good and said[0].get("durable_fragments") == 2)
        v("other_camera_closed_whole", tc2.get("ok") is True and (tc2.get("comparison") or {}).get("verdict") == "MATCH" and len(cps2) >= 2 and playable(paths[1])[0])
        v("durable_prefix_of_file1_plays", own1["bytes"] != good or playable(paths[0])[0])
    v("no_leftover", not info["leftovers"]["processes"] and not info["leftovers"]["listeners"])
    finish(res, True, a.expect_fail, d, v)


def moof_fields(path):
    bw = boxes(path)["boxes"]
    return [{"size": b["size"], "tracks": b["tracks"]} for b in bw if b["type"] == "moof"], [b["size"] for b in bw if b["type"] == "mdat"]


def cmd_replay(a):
    """Chain equality (the S1 pattern), on the files of a FINISHED session. The bytes of each recorded file are pushed
    through the fMP4 writer a second time (build/writer_replay): the checkpoints must be the worker's own records of
    the live run, value for value (everything but the wall clock of the sync), and the new file byte-identical. The
    chain therefore covers the stored bytes and nothing else.
       --control flip   one byte inside fragment 3 is changed before the replay: must FAIL (the chain differs from 3 on).
       --other RUN      also says where the files of ANOTHER live run of the same fixture differ (reported, not judged:
                        two live runs do not produce the same bytes)."""
    d, truth, paths = finished(a)
    recs = json.load(open(os.path.join(d, "result.json")))["info"]["records"]
    out = os.path.join(d, "replay")
    shutil.rmtree(out, ignore_errors=True)
    os.makedirs(out)
    res, v = {"check": "chain equality: the same bytes through the writer again", "run": a.name, "control": a.control, "files": {}}, Crit()
    keys = SAME + ("plaintextSha256", "plaintextChainSha256", "mediaStartMs", "mediaDurationMs", "keyframe")
    for i, p in enumerate(paths):
        cps, src = checkpoints_of(recs, "CAM-0%d" % (i + 1)), p
        if a.control == "flip":
            data = bytearray(open(p, "rb").read())
            data[cps[2]["start"] + cps[2]["len"] - 100] ^= 1
            src = os.path.join(out, "flipped%d.mp4" % (i + 1))
            open(src, "wb").write(data)
        again = os.path.join(out, "VIDEO-0%d.mp4" % (i + 1))
        r = sh([REPLAY, src, again])
        rows = [json.loads(l) for l in r.stdout.splitlines() if l.startswith("{")]
        differ = [c["index"] for c, n in zip(cps, rows) if any(c[k] != n[k] for k in keys)]
        same_bytes = os.path.exists(again) and sha_prefix(again, os.path.getsize(again)) == sha_prefix(p, os.path.getsize(p))
        res["files"][os.path.basename(p)] = {"replay_rc": r.returncode, "live_checkpoints": len(cps), "replayed_checkpoints": len(rows), "fragments_that_differ": differ, "byte_identical": same_bytes,
                                             "live_last_chain": cps[-1]["chainSha256"] if cps else None, "replayed_last_chain": rows[-1]["chainSha256"] if rows else None}
        v("replay_gives_the_same_checkpoints", r.returncode == 0 and len(rows) == len(cps) > 0 and not differ)
        v("replayed_file_is_byte_identical", same_bytes)
    if a.other:
        # "sibling": the other run of the same check in a two-run series (..._r1 <-> ..._r2), if it has been made.
        other = (a.name[:-1] + ("2" if a.name.endswith("1") else "1")) if a.other == "sibling" and a.name[-3:] in ("_r1", "_r2") else a.other
        d2 = os.path.join(RUNS, other)
        cmp_ = {}
        for i in (1, 2):
            p1, p2 = os.path.join(d, "media", "VIDEO-0%d.mp4" % i), os.path.join(d2, "media", "VIDEO-0%d.mp4" % i)
            if not os.path.exists(p2):
                continue
            r1, r2 = rehash(p1), rehash(p2)
            (m1, x1), (m2, x2) = moof_fields(p1), moof_fields(p2)
            n = min(len(r1["fragments"]), len(r2["fragments"]))
            cmp_["VIDEO-0%d.mp4" % i] = {
                "init_segment_identical": sha_prefix(p1, r1["init_bytes"]) == sha_prefix(p2, r2["init_bytes"]) and r1["init_bytes"] == r2["init_bytes"], "fragments": [len(r1["fragments"]), len(r2["fragments"])],
                "fragments_with_the_same_digest": sum(1 for k in range(n) if r1["fragments"][k]["fragSha256"] == r2["fragments"][k]["fragSha256"]),
                "fragments_with_the_same_video_decode_time": sum(1 for k in range(n) if m1[k]["tracks"].get(1, {}).get("tfdt") == m2[k]["tracks"].get(1, {}).get("tfdt")),
                "fragments_with_the_same_sample_counts": sum(1 for k in range(n) if {t: s["samples"] for t, s in m1[k]["tracks"].items()} == {t: s["samples"] for t, s in m2[k]["tracks"].items()}),
                "fragments_with_the_same_mdat_size": sum(1 for k in range(n) if x1[k] == x2[k]), "last_chain": [r1["fragments"][-1]["chainSha256"], r2["fragments"][-1]["chainSha256"]]}
        res["two_live_runs_not_judged"] = {"other_run": other, "files": cmp_}
    shutil.rmtree(out, ignore_errors=True)
    finish(res, True, a.expect_fail, None, v)


MEDIA_IN_STATUS = r"\.(mp4|m4a|m4s|mov|mkv|aac|wav|pcm|s16|h264|264|part)$"


def cmd_fragbound(a):
    """Fix pass F-M3, review R63-02 (ruling D179): NO FRAGMENT THE WORKER MAKES DURABLE IS ABOVE THE BOUND OF THE SEAL.
    A generated source with an OVERSIZED group of pictures (pseudo-random pictures, a keyframe every 5 s: several
    megabytes per GOP) through the built worker, started with a bound of --bound bytes (the product passes 64 MiB;
    the rule is the same at any number, and 2 MiB is reached within one GOP of this source):
      - every durable fragment (every checkpoint, and every moof+mdat of the closed file) is inside the bound;
      - the source IS oversized: fragments were closed at the bound - they are the ones whose video does not start on
        a keyframe, and each says so (`keyframe: false`), as the Core's own box walk reads it from the file;
      - no sample is lost: every video frame the worker took is in the file, one frame apart, and the file decodes;
      - the chain is whole: checkpoints contiguous, the running hash is the closed file re-hashed, tail validation clean;
      - the warning FRAGMENT_SIZE_BOUND_REACHED is raised once per camera, about that camera.
    NEGATIVE CONTROL: --variant nobound (the proof build with the rule off): fragments above the bound are written."""
    binary = VARIANTS[a.variant]
    d = rundir(a.name, fresh=True)
    truth = build_truth("long", gop=250)
    truth["cam_extra"] = ["--noise", "1"]
    a.worker_args = ("--max-fragment-bytes", str(a.bound))
    w, plan, info, _ = run_session(a, d, binary, truth)
    frame_stats(w, info)
    paths = [c["outputPath"] for c in plan["cameras"]]
    log, records = worker_log(d), [f for _, f in w.of("RECORD")]
    res = {"check": "review R63-02: the fragment size bound (bound %d bytes, source GOP 250 frames of noise)" % a.bound, "run": a.name, "variant": a.variant, "bound_bytes": a.bound, "info": info}
    v, rc = Crit(), info.get("rc") or {}
    v("worker_exit_0", rc.get("worker") == 0 and not info["crash"])
    v("sources_exit_0", rc.get("cam1") == 0 and rc.get("cam2") == 0)
    v("frames_clean", info["first_frame_is_hello"] and not info["lines_that_are_no_frame"])
    summary = {l.get("cam"): l for l in log if l["message"] == "camera_summary"}
    warned = sorted((x["code"], x["reason"], x["state"], x["subject"]) for x in info["warnings"] if x["reason"] == "FRAGMENT_SIZE_BOUND_REACHED")
    res["warnings"], out = warned, {}
    for i, p in enumerate(paths):
        dev, name = "CAM-0%d" % (i + 1), os.path.basename(p)
        if not os.path.exists(p):
            v("camera_file_exists", False)
            continue
        cps, own = checkpoints_of(records, dev), rehash(p)
        tc = tail_check(p, cps)
        video = P111.probe_packets(p, "v:0")
        dts = [int(x["dts"]) for x in video]
        step = sorted(y - x for x, y in zip(dts, dts[1:]))
        cut = [c for c, o in zip(cps, own["fragments"]) if o["video_samples"] > 0 and not c["keyframe"]]
        camera_gops = len(video) / 250.0                     # the camera sends a keyframe every 250 frames
        gop_bytes = int(own["bytes"] / camera_gops) if camera_gops else 0       # the bytes of ONE camera GOP in this file (video and its share of audio)
        aligned = [c for c, o in zip(cps, own["fragments"]) if o["video_samples"] > 0 and c["keyframe"]]
        ok_play, rep_play = playable_own_timebase(p)
        out[name] = {"checkpoints": len(cps), "fragments_in_file": len(own["fragments"]), "largest_fragment_bytes": max([o["len"] for o in own["fragments"]] or [0]), "largest_checkpoint_bytes": max([c["len"] for c in cps] or [0]),
                     "fragments_closed_at_the_bound": len(cut), "fragments_that_start_on_a_keyframe": len(aligned), "bytes_of_one_camera_gop": gop_bytes, "camera_gops": round(camera_gops, 2),
                     "worker_realign_cuts": (summary.get(i + 1) or {}).get("realign_cuts"), "video_packets_in_file": len(video), "worker_video_packets": (summary.get(i + 1) or {}).get("video_packets"),
                     "worker_size_bound_cuts": (summary.get(i + 1) or {}).get("size_bound_cuts"), "frame_step_ticks_min_max": [step[0], step[-1]] if step else None,
                     "tail_validation": {k: tc.get(k) for k in ("ok", "flags", "state", "comparison", "error") if k in tc}, "decode": {k: rep_play.get(k) for k in ("playable", "decode_at_file_timebase_rc", "video_dts_strictly_increasing")} if rep_play else None}
        v("every_durable_fragment_inside_the_bound", bool(cps) and all(c["len"] <= a.bound for c in cps) and all(o["len"] <= a.bound for o in own["fragments"]))
        v("the_source_gop_is_above_the_bound", gop_bytes > 2 * a.bound)                                   # else the check says nothing
        # After a cut at the bound the next keyframe begins a fragment again: every whole camera GOP of the file starts one.
        v("every_camera_gop_starts_a_fragment_again", len(aligned) >= int(camera_gops))
        v("fragments_were_closed_at_the_bound_and_say_so", len(cut) >= 1 and (summary.get(i + 1) or {}).get("size_bound_cuts", 0) >= 1
          and len(tc.get("fragments", [])) == len(cps) and all(f["media"]["keyframe"] == c["keyframe"] for f, c in zip(tc["fragments"], cps)))
        # Every frame the worker took is in the file, one frame after the other. The FIRST step is the held first frame
        # (spec C.4: the first sample is held from file time 0), not a gap: it is left out.
        later = sorted(y - x for x, y in zip(dts[1:], dts[2:]))
        v("no_sample_lost", len(video) > 300 and len(video) == (summary.get(i + 1) or {}).get("video_packets") and bool(later) and later[0] == later[-1] == 90000 // FPS and ok_play)
        v("checkpoints_contiguous", bool(cps) and [c["index"] for c in cps] == list(range(1, len(cps) + 1)) and cps[0]["start"] == own["init_bytes"] and all(b["start"] == a_["start"] + a_["len"] for a_, b in zip(cps, cps[1:])))
        v("running_hash_equals_closed_file_rehash", len(cps) == len(own["fragments"]) > 0 and all(c[k] == o[k] for c, o in zip(cps, own["fragments"]) for k in SAME)
          and cps[-1]["prefixSha256"] == own["whole_file_sha256"] and own["tiles_exactly"] and own["only_fragments_after_init"])
        v("tail_validation_clean_and_matches_records", tc.get("ok") is True and tc.get("flags") == [] and (tc.get("comparison") or {}).get("verdict") == "MATCH" and tc["comparison"]["matched"] == len(cps))
        v("size_bound_warning_once_per_camera", warned.count(("CAPTURE_FAULT", "FRAGMENT_SIZE_BOUND_REACHED", "ACTIVE", dev)) == 1)
    res["files"] = out
    # The cameras RECORD to their last frame: nothing but the two advisories, and the end of each stream when its camera leaves.
    v("no_warning_but_the_two_advisories_and_the_stream_end", all(x["reason"] in ("FRAGMENT_SIZE_BOUND_REACHED", "KEYFRAME_INTERVAL_ABOVE_BOUND", "CAMERA_STREAM_ENDED") for x in info["warnings"]))
    v("no_leftover", not info["leftovers"]["processes"] and not info["leftovers"]["listeners"])
    finish(res, True, a.expect_fail, d, v)


def media_lines(porcelain):
    import re
    return [l for l in porcelain.splitlines() if re.search(MEDIA_IN_STATUS, l.strip().strip('"'), re.I)]


def cmd_mg1(a):
    """M3-MG-1: 0 media in git after the capture sessions of this series. `git status --porcelain` (untracked files
    included) names no media file, and everything a run writes lies under a git-ignored folder. The pattern has its
    control inside the check: the same search over a status text that names a camera file must find it."""
    res, v = {"check": "M3-MG-1 0 media in git", "run": a.name}, Crit()
    st = sh(["git", "status", "--porcelain", "--untracked-files=all"], cwd=REPO)
    found = media_lines(st.stdout)
    ignored = {p: sh(["git", "check-ignore", "-q", p], cwd=REPO).returncode == 0 for p in (RUNS, BUILD, os.path.join(REPO, ".cache", "m3worker", "e2e"))}
    runs = [n for n in os.listdir(RUNS)] if os.path.isdir(RUNS) else []
    on_disk = sum(1 for n in runs for _r, _d, fs in os.walk(os.path.join(RUNS, n)) for f in fs if f.endswith(".mp4"))
    res.update({"status_lines": len(st.stdout.splitlines()), "media_lines_in_status": found, "git_ignored": {os.path.relpath(p, REPO): ok for p, ok in ignored.items()}, "runs_on_disk": len(runs), "camera_files_under_the_runs_folder": on_disk})
    v("git_status_ran", st.returncode == 0)
    v("no_media_file_in_git_status", not found)
    v("every_run_folder_is_git_ignored", all(ignored.values()) and os.path.realpath(RUNS).startswith(os.path.realpath(os.path.join(REPO, ".cache")) + os.sep))
    v("camera_files_exist_where_they_are_ignored", on_disk > 0)          # the series DID record: an empty disk would prove nothing
    planted = "?? apps/capture-worker/test/VIDEO-01.mp4\n M apps/capture-worker/src/sink.c\n?? docs/x/VIDEO-02.mp4.4711.part\n"
    v("control_the_search_finds_a_planted_media_line", [l.split()[-1] for l in media_lines(planted)] == ["apps/capture-worker/test/VIDEO-01.mp4", "docs/x/VIDEO-02.mp4.4711.part"])
    finish(res, True, a.expect_fail, None, v)


def m5(name):
    """A check of test/m5mic.py (row 71), handed this module: its Worker, its sessions, its analysers."""
    def run(a):
        sys.path.insert(0, HERE)
        import m5mic
        getattr(m5mic, name)(a, sys.modules[__name__])
    return run


def n3(name):
    """A check of test/n3gapped.py (task 4 row N3: the gapped microphone kind, protocol version 5), handed this module."""
    def run(a):
        sys.path.insert(0, HERE)
        import n3gapped
        getattr(n3gapped, name)(a, sys.modules[__name__])
    return run


def main():
    ap = argparse.ArgumentParser()
    sp = ap.add_subparsers(dest="cmd", required=True)
    sp.add_parser("build").set_defaults(fn=cmd_build)

    def case(name, fn, **extra):
        p = sp.add_parser(name)
        p.add_argument("name")
        p.add_argument("--variant", choices=list(VARIANTS), default="worker")
        p.add_argument("--expect-fail", action="store_true")
        p.add_argument("--must-fail-on", default="", help="with --expect-fail: the criteria the control must fail on, exactly (comma-separated)")
        p.add_argument("--may-fail-on", default="", help="with --must-fail-on: criteria that may fail as well")
        for k, v in extra.items():
            p.add_argument("--" + k, **v)
        p.set_defaults(fn=fn)

    case("session", cmd_session, case={"choices": list(CASES), "default": "zero"}, tap={"action": "store_true"}, stall={"action": "store_true"},
         gop={"type": int, "default": FPS, "help": "the fake cameras' GOP in frames (250 = the long-GOP camera, a keyframe every 5 s)"},
         **{"mic-late-us": {"type": int, "default": 0, "help": "the fake mics hand every chunk over this late (a device latency the worker cannot know)"}})
    case("avcheck", cmd_avcheck, **{"assume-drift-ppm": {"type": float, "default": None},
                                    "assume-inject-ms": {"default": None, "help": "judge against these injected offsets, one per camera (e.g. 0,0): the control of a supervisor session"}})
    case("gopcheck", cmd_gopcheck, gop={"type": int, "required": True})
    case("continuity", cmd_continuity, control={"choices": ["cut", "toneslip"], "default": None})
    case("selfcheck", cmd_selfcheck)
    case("h4neg", cmd_h4neg)
    case("proto", cmd_proto)
    case("plan4", cmd_plan4)          # D60 (2026-11-04): the four-camera plan of the widened reader
    case("plan4mics", cmd_plan4mics)  # D61 (2026-11-04): the four-channel audio plan, one file and encoder each
    case("pairs", cmd_pairs, mode={"choices": list(PAIRS_MODES), "required": True})   # row 152 (D5 pairs, DF-06): AC-4.7, silent track, no MIC-01
    case("camstop", cmd_camstop)
    case("fatal", cmd_fatal, mode={"choices": ["rmdir", "planted", "exists", "clean"], "required": True})
    case("udp", cmd_udp)
    case("shape", cmd_shape)
    case("mic", cmd_mic, mode={"choices": list(MIC_MODES), "required": True})
    case("nocam", cmd_nocam, mode={"choices": ["none", "one"], "required": True})
    case("sup", cmd_sup, mode={"choices": ["run", "kc1", "kc3", "nocam", "refuse"], "required": True}, case={"choices": list(CASES), "default": "zero"},
         limits={"default": "{}", "help": "overrides of CAPTURE_IPC_DEFAULTS as JSON (negative controls: '{\"maxRestarts\":0}')"})
    # Row 62: cameras with hand-written sender reports (M3-AV-2 (c); nearBound; the camera clock sanity bound).
    case("srcam", cmd_srcam, mode={"choices": list(SR_MODES), "required": True},
         sr={"choices": ["true", "linear"], "default": "true", "help": "linear: reports without rate information (the control of mode drift)"})
    # Row 59: the fMP4 writer (M3-KC-2, M3-KC-4, failed write, chain equality, M3-MG-1).
    case("kc2", cmd_kc2, control={"choices": ["nocut"], "default": None})
    case("kc4", cmd_kc4, gop={"type": int, "default": 250})
    case("writefault", cmd_writefault)
    case("replay", cmd_replay, control={"choices": ["flip"], "default": None}, other={"default": None})
    case("mg1", cmd_mg1)
    # Fix pass F-M3 (review R63-02): the fragment size bound on an oversized GOP; control: --variant nobound.
    case("fragbound", cmd_fragbound, bound={"type": int, "default": 2 * 1024 * 1024, "help": "the bound the worker is started with, in bytes (the product passes 64 MiB)"})
    # Row 71 (worker half): the interval record, the tap and the warnings (test/m5mic.py). Audit row 152b (N-31; D135): the
    # operator's switch is retired - m5switch became m5tap (D5 pairs: one start interval, the tap is channel 1 for the
    # whole session); m5gap and m5bound judged the switch itself and are gone.
    case("m5tap", m5("cmd_tap"))
    case("m5tapjudge", m5("cmd_tapjudge"), channel={"type": int, "default": 1, "help": "the channel the tap must carry (the control judges it as channel 2)"})
    case("m5warn", m5("cmd_warn"))
    case("m5rate", m5("cmd_rate"), ppm={"type": int, "default": -8000})
    # Task 4 row N3 (protocol version 5): the gapped microphone kind on the stand-in of the macOS path (test/n3gapped.py).
    case("n3gap", n3("cmd_gap"), mode={"choices": ["measured", "whole", "late4", "trim", "stop3", "nan", "runs1025", "killbefore", "killbetween", "killafter"], "required": True})
    case("n3judge", n3("cmd_judge"), control={"choices": ["dropone"], "default": None})
    global ARGS
    a = ARGS = ap.parse_args()
    a.fn(a)


if __name__ == "__main__":
    main()
