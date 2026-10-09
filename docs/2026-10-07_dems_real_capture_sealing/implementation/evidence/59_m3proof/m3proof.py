#!/usr/bin/env python3
"""Row 111 proof harness (throw-away): H-4 and H-10 against apps/capture-worker/build/capture-worker.

  m3proof.py build                                   compile bin/fake_cam
  m3proof.py run  <name> --case zero|pm80|drift [--two-encoders SKEW]
  m3proof.py h4   <name> [--expect-fail]             audio packets byte-identical + playable
  m3proof.py h10  <name>                             per-file flash/beep offsets vs truth
  m3proof.py gap  <name> [--negative]                sample-level gap check (AU2-05)

Every check exits 0 on PASS and 1 on FAIL; with --expect-fail the meaning is inverted (a negative
control that does NOT fail is an error). All listeners are the worker's, on 127.0.0.1 only.
Ports 8555 and 8557: 8554/8556/8558 are held by the Android emulators' gRPC endpoints on this Mac.
"""
import argparse, hashlib, json, os, signal, struct, subprocess, sys, time
from fractions import Fraction

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
WORKER = os.path.join(REPO, "apps", "capture-worker", "build", "capture-worker")
CAM = os.path.join(HERE, "bin", "fake_cam")
FF, FP = "/opt/homebrew/bin/ffmpeg", "/opt/homebrew/bin/ffprobe"
PORTS = (8555, 8557)
FPS, FRAME_US, SR = 50, 20000, 48000
REGRESSION_MS, PRODUCT_MS = 2.0, 40.0          # two different tolerances (AU2-04) - never merged
CASES = {  # per camera: (injected offset ms, drift ppm); events per camera
    "zero":  {"cams": [(0, 0.0), (0, 0.0)], "events": 3},
    "pm80":  {"cams": [(80, 0.0), (-80, 0.0)], "events": 3},
    "drift": {"cams": [(0, 200.0), (0, -200.0)], "events": 8},
}


def out(cmd, **kw):
    return subprocess.run(cmd, capture_output=True, check=True, **kw).stdout


def listeners():
    txt = subprocess.run(["lsof", "-nP", "-iTCP", "-sTCP:LISTEN"], capture_output=True, text=True).stdout
    return [l for l in txt.splitlines() if any((":%d " % p) in l or l.rstrip().endswith(":%d (LISTEN)" % p) for p in PORTS)]


def rundir(name):
    return os.path.join(HERE, "runs", name)


# ------------------------------------------------------------------------------------------ build
def cmd_build(_):
    os.makedirs(os.path.join(HERE, "bin"), exist_ok=True)
    flags = subprocess.run(["pkg-config", "--cflags", "--libs", "libavformat", "libavcodec", "libavutil"],
                           capture_output=True, text=True, check=True).stdout.split()
    subprocess.run(["clang", "-O2", "-Wall", "-Wextra", "-o", CAM, os.path.join(HERE, "fake_cam.c")] + flags + ["-lm"], check=True)
    print("built", CAM)


# ------------------------------------------------------------------------------------------ run
def cmd_run(a):
    case = CASES[a.case]
    d = rundir(a.name)
    os.makedirs(d, exist_ok=True)
    for f in os.listdir(d):
        os.remove(os.path.join(d, f)) if os.path.isfile(os.path.join(d, f)) else None
    if listeners():
        sys.exit("ports busy before start: %r" % listeners())
    ev = case["events"]
    frames = 200 + 200 * (ev - 1) + 50                      # cam2's last flash + 1 s
    lead_us = 6_000_000
    c0 = (time.time_ns() // 1_000_000) * 1000 + lead_us     # whole ms: rtpenc rounds the SR origin to ms
    cams, beeps = [], []
    for i, (inj_ms, ppm) in enumerate(case["cams"]):
        first = 100 + 100 * i                                # cam1: 2 s, 6 s, ...  cam2: 4 s, 8 s, ...
        evs = []
        for j in range(ev):
            k = first + 200 * j
            true_us = c0 + int(k * (1000000.0 / FPS) * (1.0 + ppm * 1e-6) + 0.5)   # same formula as fake_cam.c
            evs.append({"frame": k, "beep_at_us": true_us,
                        "truth_offset_us": inj_ms * 1000 + (true_us - c0 - k * FRAME_US)})
            beeps.append(true_us)
        cams.append({"cam": i + 1, "port": PORTS[i], "inject_ms": inj_ms, "drift_ppm": ppm, "flash_first": first,
                     "flash_every": 200, "claimed_epoch_us": c0 - inj_ms * 1000, "events": evs})
    truth = {"case": a.case, "epoch_us": c0, "frames": frames, "cams": cams, "two_encoders": a.two_encoders}
    json.dump(truth, open(os.path.join(d, "truth.json"), "w"), indent=1)

    duration = lead_us / 1e6 + frames / FPS + 1.5
    wcmd = [WORKER, "--cam1", "rtsp://127.0.0.1:%d/cam1" % PORTS[0], "--out1", os.path.join(d, "cam1.mp4"),
            "--cam2", "rtsp://127.0.0.1:%d/cam2" % PORTS[1], "--out2", os.path.join(d, "cam2.mp4"),
            "--duration", "%.3f" % duration, "--listen-timeout", "10",
            "--log", os.path.join(d, "worker.jsonl"), "--audio-manifest", os.path.join(d, "manifest.jsonl"),
            "--beep-at-us", ",".join(str(b) for b in sorted(beeps))]
    if a.two_encoders is not None:
        wcmd += ["--proof-two-encoders", str(a.two_encoders)]
    procs = []
    rc = {}
    try:
        w = subprocess.Popen(wcmd, stdin=subprocess.DEVNULL, stderr=open(os.path.join(d, "worker.err"), "w"), start_new_session=True)
        procs.append(w)
        t = time.time()
        while len(listeners()) < 2:
            if time.time() - t > 4 or w.poll() is not None:
                sys.exit("worker did not listen on both ports: %r" % listeners())
            time.sleep(0.1)
        lis = listeners()
        bad = [l for l in lis if "127.0.0.1:" not in l]
        json.dump({"listeners": lis, "non_loopback": bad}, open(os.path.join(d, "bind_check.json"), "w"), indent=1)
        if bad:
            sys.exit("listener outside loopback: %r" % bad)
        cps = []
        for c in cams:
            cp = subprocess.Popen([CAM, "--url", "rtsp://127.0.0.1:%d/cam%d" % (c["port"], c["cam"]),
                                   "--epoch-us", str(c0), "--claimed-epoch-us", str(c["claimed_epoch_us"]),
                                   "--drift-ppm", str(c["drift_ppm"]), "--frames", str(frames),
                                   "--flash-first", str(c["flash_first"]), "--flash-every", str(c["flash_every"])],
                                  stdin=subprocess.DEVNULL, stderr=open(os.path.join(d, "cam%d.err" % c["cam"]), "w"), start_new_session=True)
            procs.append(cp)
            cps.append(cp)
        for i, cp in enumerate(cps):
            rc["cam%d" % (i + 1)] = cp.wait(timeout=duration + 30)
        rc["worker"] = w.wait(timeout=duration + 30)
    finally:
        for p in procs:                                   # kill by process group, one pid at a time
            if p.poll() is None:
                try:
                    os.killpg(p.pid, signal.SIGKILL)
                except ProcessLookupError:
                    pass
                p.wait()
    time.sleep(0.3)
    left = listeners()
    print(json.dumps({"run": a.name, "case": a.case, "rc": rc, "listeners_after": left,
                      "sizes": {f: os.path.getsize(os.path.join(d, f)) for f in ("cam1.mp4", "cam2.mp4") if os.path.exists(os.path.join(d, f))}}))
    if left or any(v != 0 for v in rc.values()) or len(rc) != 3:
        sys.exit(1)


# ------------------------------------------------------------------------------------------ helpers
def probe_packets(path, sel):
    j = json.loads(out([FP, "-v", "error", "-select_streams", sel, "-show_entries",
                        "packet=pts,dts,duration,size,data_hash", "-show_data_hash", "sha256", "-of", "json", path]))
    return j["packets"]


def streams(path):
    return json.loads(out([FP, "-v", "error", "-show_entries",
                           "stream=index,codec_type,codec_name,profile,sample_rate,channels,time_base,width,height", "-of", "json", path]))["streams"]


def box_walk(path):
    """Top-level ISO-BMFF boxes; ok only when the boxes tile the file exactly (AU2-08: a truncated mdat is silent to the decoder)."""
    size, pos, kinds = os.path.getsize(path), 0, {}
    with open(path, "rb") as f:
        while pos + 8 <= size:
            f.seek(pos)
            n, t = struct.unpack(">I4s", f.read(8))
            if n == 1:
                n = struct.unpack(">Q", f.read(8))[0]
            if n < 8:
                break
            kinds[t.decode("latin1")] = kinds.get(t.decode("latin1"), 0) + 1
            pos += n
    return {"tiles_exactly": pos == size, "boxes": kinds}


def audio_pcm(path):
    """Decoded AUDIO-01 as float32 with the exact pts of sample 0 (in samples). Asserts contiguity."""
    st = [s for s in streams(path) if s["codec_type"] == "audio"]
    assert len(st) == 1 and st[0]["time_base"] == "1/48000", st
    fr = json.loads(out([FP, "-v", "error", "-select_streams", "a:0", "-show_entries", "frame=pts,nb_samples", "-of", "json", path]))["frames"]
    pts = [int(f["pts"]) for f in fr]
    nb = [int(f["nb_samples"]) for f in fr]
    for i in range(1, len(fr)):
        assert pts[i] == pts[i - 1] + nb[i - 1], ("audio frames not contiguous", i, pts[i - 1], nb[i - 1], pts[i])
    raw = out([FF, "-v", "error", "-i", path, "-map", "0:a:0", "-f", "f32le", "-"])
    x = struct.unpack("<%df" % (len(raw) // 4), raw)
    assert len(x) == sum(nb), ("raw sample count != sum(nb_samples)", len(x), sum(nb))
    return x, pts[0], len(fr)


def onsets(x, thr=0.25, quiet=2400):
    """Sample-resolution onsets: |x| > thr with the preceding 50 ms entirely below thr. No windows."""
    res, last_loud = [], -10 ** 9
    for i, v in enumerate(x):
        if v > thr or v < -thr:
            if i - last_loud > quiet:
                res.append(i)
            last_loud = i
    return res


def video_flashes(path):
    st = [s for s in streams(path) if s["codec_type"] == "video"]
    assert len(st) == 1, st
    tb = Fraction(st[0]["time_base"])
    pts = [int(f["pts"]) for f in json.loads(out([FP, "-v", "error", "-select_streams", "v:0", "-show_entries", "frame=pts", "-of", "json", path]))["frames"]]
    raw = out([FF, "-v", "error", "-i", path, "-map", "0:v:0", "-vf", "scale=16:16,format=gray", "-fps_mode", "passthrough", "-f", "rawvideo", "-"])
    assert len(raw) == 256 * len(pts), ("decoded frames != frame pts count", len(raw) // 256, len(pts))
    bright = [i for i in range(len(pts)) if sum(raw[i * 256:(i + 1) * 256]) / 256 > 128]
    for a, b in zip(bright, bright[1:]):
        assert b - a > 1, ("flash wider than one frame", a, b)
    return [pts[i] * tb for i in bright], len(pts), bright


def manifest(d):
    rows = [json.loads(l) for l in open(os.path.join(d, "manifest.jsonl"))]
    return ([r for r in rows if r["type"] == "apkt"], [r for r in rows if r["type"] == "beep"], [r for r in rows if r["type"] == "end"][0])


def finish(result, ok, expect_fail):
    result["verdict"] = "PASS" if ok else "FAIL"
    if expect_fail:
        result["negative_control"] = "failed as required" if not ok else "DID NOT FAIL - control is broken"
    print(json.dumps(result, indent=1))
    sys.exit(0 if (ok != expect_fail) else 1)


# ------------------------------------------------------------------------------------------ H-4
def cmd_h4(a):
    d = rundir(a.name)
    apk, _, end = manifest(d)
    res = {"check": "H-4", "run": a.name, "worker_encoders": end["encoders"], "files": {}}
    lists, ok = [], True
    for n in ("cam1.mp4", "cam2.mp4"):
        p = os.path.join(d, n)
        pk = probe_packets(p, "a:0")
        vp = probe_packets(p, "v:0")
        lists.append(pk)
        st = streams(p)
        dec = subprocess.run([FF, "-v", "error", "-xerror", "-i", p, "-map", "0", "-f", "null", "-"], capture_output=True, text=True)
        cnt = json.loads(out([FP, "-v", "error", "-count_frames", "-show_entries", "stream=codec_type,nb_read_frames", "-of", "json", p]))["streams"]
        frames = {s["codec_type"]: int(s["nb_read_frames"]) for s in cnt}
        sh = out([FF, "-v", "error", "-i", p, "-map", "0:a:0", "-c", "copy", "-f", "streamhash", "-hash", "sha256", "-"]).decode().strip()
        bw = box_walk(p)
        playable = (dec.returncode == 0 and dec.stderr.strip() == "" and frames.get("video", 0) == len(vp) > 0
                    and frames.get("audio", 0) == len(pk) > 0 and bw["tiles_exactly"] and bw["boxes"].get("moof", 0) > 0)
        shape = sorted((s["codec_type"], s["codec_name"]) for s in st) == [("audio", "aac"), ("video", "h264")]
        ok &= playable and shape
        res["files"][n] = {"bytes": os.path.getsize(p), "streams": [(s["codec_type"], s["codec_name"], s.get("profile"), s.get("sample_rate"), s.get("channels")) for s in st],
                           "audio_packets": len(pk), "audio_payload_bytes": sum(int(x["size"]) for x in pk),
                           "audio_digest_of_packet_hashes": hashlib.sha256("".join(x["data_hash"] for x in pk).encode()).hexdigest(),
                           "audio_streamhash": sh, "video_packets": len(vp), "decoded_frames": frames,
                           "decode_rc": dec.returncode, "decode_error_lines": len([l for l in dec.stderr.splitlines() if l.strip()]),
                           "box_walk": bw, "playable": playable}
    A, B = lists
    key = lambda x: (x["pts"], x["dts"], x["duration"], x["size"], x["data_hash"])
    mism = [i for i in range(min(len(A), len(B))) if key(A[i]) != key(B[i])]
    payload_mism = [i for i in range(min(len(A), len(B))) if A[i]["data_hash"] != B[i]["data_hash"]]
    enc0 = [r for r in apk if r["enc"] == 0]
    vs_enc = [sum(1 for i in range(min(len(L), len(enc0))) if L[i]["data_hash"].split(":")[-1].lower() != enc0[i]["sha256"]) for L in lists]
    res["cross_file"] = {"count_equal": len(A) == len(B), "packets_differing_any_field": len(mism), "packets_differing_payload": len(payload_mism),
                         "first_difference": mism[0] if mism else None}
    res["vs_encoder_manifest"] = {"encoder0_packets": len(enc0), "cam1_payload_mismatches": vs_enc[0], "cam2_payload_mismatches": vs_enc[1],
                                  "counts_equal": len(enc0) == len(A) == len(B)}
    identical = len(A) == len(B) > 0 and not mism and res["files"]["cam1.mp4"]["audio_streamhash"] == res["files"]["cam2.mp4"]["audio_streamhash"]
    one_encoder = end["encoders"] == 1 and vs_enc == [0, 0] and len(enc0) == len(A)
    res["audio_byte_identical"] = identical
    res["both_files_carry_encoder0_packets"] = one_encoder
    finish(res, ok and identical and one_encoder, a.expect_fail)


# ------------------------------------------------------------------------------------------ H-10
def cmd_h10(a):
    d = rundir(a.name)
    truth = json.load(open(os.path.join(d, "truth.json")))
    res = {"check": "H-10", "run": a.name, "case": truth["case"], "regression_bound_ms": REGRESSION_MS, "product_bound_ms": PRODUCT_MS, "files": {}}
    ok = True
    for c in truth["cams"]:
        p = os.path.join(d, "cam%d.mp4" % c["cam"])
        flashes, nframes, bright = video_flashes(p)
        x, a0, _ = audio_pcm(p)
        on = [Fraction(a0 + i, SR) for i in onsets(x)]
        rows = []
        assert len(flashes) == len(c["events"]), ("flash count", len(flashes), len(c["events"]))
        for f, e in zip(flashes, c["events"]):
            b = min(on, key=lambda t: abs(t - f))
            off = float((b - f) * 1000)
            tr = e["truth_offset_us"] / 1000.0
            rows.append({"frame": e["frame"], "flash_s": round(float(f), 6), "beep_s": round(float(b), 6),
                         "offset_ms": round(off, 4), "truth_ms": round(tr, 4), "error_ms": round(off - tr, 4)})
        n = len(rows)
        mx, my = sum(r["flash_s"] for r in rows) / n, sum(r["offset_ms"] for r in rows) / n
        sxx = sum((r["flash_s"] - mx) ** 2 for r in rows)
        slope_ppm = sum((r["flash_s"] - mx) * (r["offset_ms"] - my) for r in rows) / sxx * 1000 if sxx else 0.0
        max_err = max(abs(r["error_ms"]) for r in rows)
        max_abs = max(abs(r["offset_ms"]) for r in rows)
        sign_ok = c["inject_ms"] == 0 or (my > 0) == (c["inject_ms"] > 0)
        reg = max_err <= REGRESSION_MS and sign_ok
        ok &= reg
        res["files"]["cam%d.mp4" % c["cam"]] = {
            "inject_ms": c["inject_ms"], "inject_drift_ppm": c["drift_ppm"], "video_frames": nframes, "flash_frame_indexes": bright,
            "beeps_in_audio": len(on), "events": rows, "mean_offset_ms": round(my, 4), "measured_drift_ppm": round(slope_ppm, 2),
            "drift_over_run_ms": round(rows[-1]["offset_ms"] - rows[0]["offset_ms"], 4),
            "max_abs_error_vs_truth_ms": round(max_err, 4), "sign_correct": sign_ok,
            "regression_bound": "PASS" if reg else "FAIL",
            "max_abs_offset_ms": round(max_abs, 4), "product_bound": "WITHIN" if max_abs <= PRODUCT_MS else "EXCEEDED",
            "uncorrected_offset_exceeds_regression_bound": max_abs > REGRESSION_MS}
    finish(res, ok, False)


# ------------------------------------------------------------------------------------------ gap check (AU2-05)
def gap_eval(x, beeps, samples_in):
    on = onsets(x)
    want = [b["onset_sample"] for b in beeps if b["onset_sample"] >= 0]
    spacing_err = [(on[i + 1] - on[i]) - (want[i + 1] - want[i]) for i in range(min(len(on), len(want)) - 1)]
    extra = len(x) - samples_in
    r = {"decoded_samples": len(x), "encoder_input_samples": samples_in, "decoded_minus_input": extra,
         "count_check_alone": "PASS" if 0 <= extra <= 2048 else "FAIL", "beeps_decoded": len(on), "beeps_manifest": len(want),
         "spacing_error_samples": spacing_err, "abs_position_error_samples": [on[i] - want[i] for i in range(min(len(on), len(want)))]}
    r["spacing_check"] = "PASS" if len(on) == len(want) and all(abs(e) <= 2 for e in spacing_err) else "FAIL"
    return r, r["count_check_alone"] == "PASS" and r["spacing_check"] == "PASS"


def cmd_gap(a):
    d = rundir(a.name)
    _, beeps, end = manifest(d)
    res = {"check": "gap (AU2-05)", "run": a.name, "files": {}}
    ok = True
    if not a.negative:
        for n in ("cam1.mp4", "cam2.mp4"):
            x, _, _ = audio_pcm(os.path.join(d, n))
            r, g = gap_eval(x, beeps, end["samples_in"])
            res["files"][n] = r
            ok &= g
        finish(res, ok, False)
    # negative control: the same audio re-encoded with and without 1,000 samples cut between beeps 2 and 3
    x, _, _ = audio_pcm(os.path.join(d, "cam1.mp4"))
    on = onsets(x)
    cut = (on[1] + on[2]) // 2
    variants = {"gapctl_intact.m4a": x, "gapneg_minus1000.m4a": x[:cut] + x[cut + 1000:]}
    verdicts = {}
    for n, y in variants.items():
        p = os.path.join(d, n)
        subprocess.run([FF, "-v", "error", "-y", "-f", "f32le", "-ar", "48000", "-ac", "1", "-i", "-", "-c:a", "aac", "-b:a", "96k", p],
                       input=struct.pack("<%df" % len(y), *y), check=True)
        z, _, _ = audio_pcm(p)
        r, g = gap_eval(z, beeps, end["samples_in"] + 1024)      # second-generation copy: one more priming frame
        pk = probe_packets(p, "a:0")
        deltas = sorted({int(pk[i + 1]["pts"]) - int(pk[i]["pts"]) for i in range(len(pk) - 1)})
        r["packet_grid_deltas"] = deltas                          # the blind metric AU2-05 rejected
        res["files"][n] = r
        verdicts[n] = g
    res["cut_at_decoded_sample"] = cut
    ok = verdicts["gapctl_intact.m4a"] and not verdicts["gapneg_minus1000.m4a"]
    res["negative_control"] = "intact copy passes, cut copy fails" if ok else "CONTROL BROKEN: %r" % verdicts
    res["verdict"] = "PASS" if ok else "FAIL"
    print(json.dumps(res, indent=1))
    sys.exit(0 if ok else 1)


def main():
    ap = argparse.ArgumentParser()
    sp = ap.add_subparsers(dest="cmd", required=True)
    sp.add_parser("build").set_defaults(fn=cmd_build)
    r = sp.add_parser("run"); r.add_argument("name"); r.add_argument("--case", choices=list(CASES), required=True)
    r.add_argument("--two-encoders", type=int, default=None); r.set_defaults(fn=cmd_run)
    h = sp.add_parser("h4"); h.add_argument("name"); h.add_argument("--expect-fail", action="store_true"); h.set_defaults(fn=cmd_h4)
    t = sp.add_parser("h10"); t.add_argument("name"); t.set_defaults(fn=cmd_h10)
    g = sp.add_parser("gap"); g.add_argument("name"); g.add_argument("--negative", action="store_true"); g.set_defaults(fn=cmd_gap)
    a = ap.parse_args()
    a.fn(a)


if __name__ == "__main__":
    main()
