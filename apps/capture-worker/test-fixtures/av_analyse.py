#!/usr/bin/env python3
"""NM-14 analysers (blueprint row 60; capture spec A.8, F; errata AU2-03, AU2-04, AU2-05, PE-111-05).

Vendored from the row-111 proof harness (docs evidence `59_m3proof/m3proof.py`) so that the capture
end-to-end target depends on nothing under `docs/` (pair-58 F-14), and corrected where the two pair
reviews found a weakness:

  * SAMPLE-EXACT onsets (AU2-03): an audio onset is the first decoded sample above a threshold, a
    flash is a decoded frame's pts. No analysis window enters an anchor.
  * Pairing by IDENTITY, not by nearness (pair-111 N-13). A beep is found from the mic process's
    own manifest (where that beep must sit in the decoded audio), a flash is the n-th flash of its
    camera. Flash n and beep n of one camera are then one event, however far apart the file puts
    them: an error of seconds is reported as seconds, never as the distance to a neighbour's beep.
  * Two bounds, two verdicts (AU2-04): `regression` (2 ms on this deterministic fixture) and
    `product` (+-40 ms) are computed and returned apart; a caller never folds them into one.
  * Continuity by DECODED SAMPLES (AU2-05): the count of decoded samples against the encoder's
    input count, the spacing of the reference beeps against the mic manifest, and the phase of the
    standby's reference tone. The packet grid is reported beside it and never judged: it reads
    the same for a file with samples missing.

Every function here measures a file; none of them knows what the worker believes. Tools: the
installed ffmpeg / ffprobe (FFmpeg 9.0.2 on this host), two passes per file. No third-party module.
"""
import json, math, os, shutil, struct, subprocess
from fractions import Fraction

FF = os.environ.get("DEMS_FFMPEG") or shutil.which("ffmpeg") or "/opt/homebrew/bin/ffmpeg"
FP = os.environ.get("DEMS_FFPROBE") or shutil.which("ffprobe") or "/opt/homebrew/bin/ffprobe"
SR = 48000
PRIMING = 1024                       # AAC priming samples presented at the head of every file (pinned flags, PE-111-06)
REGRESSION_MS, PRODUCT_MS = 2.0, 40.0
PAIR_WINDOW = SR // 4                # a beep is looked for within +-0.25 s of where its own mic says it is
TONE_HZ, TONE_AMP, TONE_WIN = 880.0, 0.1, 600          # the standby's reference tone; 600 samples = 11 whole cycles


def out(cmd, **kw):
    return subprocess.run(cmd, capture_output=True, check=True, **kw).stdout


def probe_packets(path, sel):
    j = json.loads(out([FP, "-v", "error", "-select_streams", sel, "-show_entries",
                        "packet=pts,dts,duration,size,flags,data_hash", "-show_data_hash", "sha256", "-of", "json", path]))
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
    """Decoded AUDIO-01 as float32 with the exact pts of sample 0 (in samples). Asserts contiguity of the frames."""
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
    """(pts of every white frame as a Fraction of a second, decoded frame count, indexes of the white frames)."""
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


def keyframe_intervals(path):
    """Distances, in video packets, between the keyframes of a file (the camera's GOP as the file holds it)."""
    pk = probe_packets(path, "v:0")
    keys = [i for i, p in enumerate(pk) if "K" in p.get("flags", "")]
    return {"video_packets": len(pk), "keyframes": len(keys), "intervals": [b - a for a, b in zip(keys, keys[1:])]}


# ------------------------------------------------------------------------------------------ beeps by identity
def mic_truth(mic_manifest_path):
    """The mic process's own statement: (the 'mic' line, the 'beep' lines). Nothing of the worker is in it."""
    rows = [json.loads(l) for l in open(mic_manifest_path)]
    return [r for r in rows if r["type"] == "mic"][0], [r for r in rows if r["type"] == "beep"]


def beep_audible(mic, beep):
    """Did the mic deliver the onset of this beep at all (it is away between stop_at and resume_at)?"""
    if beep["onset_sample"] < 0:
        return False
    t = beep["onset_sample"] / SR                              # the mic's own seconds
    stop, resume = mic.get("stop_at", -1), mic.get("resume_at", -1)
    return not (stop >= 0 and t >= stop and (resume < 0 or t < resume))


def expected_position(mic, beep):
    """Where the decoded audio must hold this beep's first sample if nothing was lost or shifted: the mic's
    own sample index, brought to the host's rate, plus the priming the muxer presents."""
    return beep["onset_sample"] / (1.0 + mic.get("ppm", 0.0) * 1e-6) + PRIMING


def find_beeps(x, mic, beeps):
    """Every manifest beep -> the ONE decoded onset within PAIR_WINDOW of its own expected position.
    Returns (by_at_us, problems). A beep with no onset, with two, or an onset that belongs to no beep
    is a problem: the caller fails on it instead of pairing with whatever is nearest."""
    on = onsets(x)
    used, by_at, problems = set(), {}, []
    for b in beeps:
        if not beep_audible(mic, b):
            continue
        want = expected_position(mic, b)
        hit = [i for i in on if abs(i - want) <= PAIR_WINDOW]
        if len(hit) != 1:
            problems.append({"beep": b["index"], "expected_sample": round(want, 1), "onsets_in_window": hit})
            continue
        used.add(hit[0])
        by_at[b["at_us"]] = {"index": b["index"], "sample": hit[0], "expected_sample": want, "position_error_samples": round(hit[0] - want, 2)}
    stray = [i for i in on if i not in used]
    return by_at, problems, stray


def av_offsets(paths, truth, mic, beeps, bound_ms=REGRESSION_MS, keep=None, gop=50, allow_stray=False, assume_drift_ppm=None):
    """Flash-to-beep offset of every event of every camera file against the injected truth.

    truth: the case definition the harness wrote BEFORE the run (per camera: events with frame, beep_at_us,
    truth_offset_us). mic / beeps: the mic process's manifest. Returns (regression_ok, product_ok, detail):
    the two bounds are separate verdicts (AU2-04). `assume_drift_ppm` replaces the injected drift in the
    truth (the control "expect no drift" that a drifting file must fail)."""
    res, reg_all, prod_all = {}, True, True
    for c, p in zip(truth["cams"], paths):
        name = "cam%d" % c["cam"]
        flashes, nframes, bright = video_flashes(p)
        x, a0, _ = audio_pcm(p)
        found, problems, stray = find_beeps(x, mic, beeps)
        # The head of a camera file is dropped up to its first usable keyframe (spec C.4): the events of the
        # first GOP are not in the file. Their number follows from the fixture, not from the worker.
        events = list(c["events"])
        not_recorded = [e for e in events if e["frame"] < gop]
        events = events[len(not_recorded):]
        if len(flashes) != len(events) or problems or (stray and not allow_stray):
            res[name] = {"error": "events do not match the file", "flashes_in_file": len(flashes), "events_expected": len(events), "events_in_first_gop": len(not_recorded),
                         "beep_problems": problems, "stray_onsets": stray[:8]}
            reg_all = prod_all = False
            continue
        rows = []
        for f, e in zip(flashes, events):
            if keep and not keep(e):
                continue
            b = found.get(e["beep_at_us"])
            if b is None:
                continue                                       # the mic was away for this beep (stop and return): not judged
            beep_s = Fraction(a0 + b["sample"], SR)
            off = float((beep_s - f) * 1000)
            tr = e["truth_offset_us"] / 1000.0
            if assume_drift_ppm is not None:
                tr = c["inject_ms"] + e["frame"] * 20.0 * assume_drift_ppm * 1e-6
            rows.append({"frame": e["frame"], "flash_s": round(float(f), 6), "beep_s": round(float(beep_s), 6), "offset_ms": round(off, 4), "truth_ms": round(tr, 4),
                         "error_ms": round(off - tr, 4), "beep_position_error_samples": b["position_error_samples"]})
        if not rows:
            res[name] = {"error": "no event left to judge"}
            reg_all = prod_all = False
            continue
        n = len(rows)
        mx, my = sum(r["flash_s"] for r in rows) / n, sum(r["offset_ms"] for r in rows) / n
        sxx = sum((r["flash_s"] - mx) ** 2 for r in rows)
        slope = sum((r["flash_s"] - mx) * (r["offset_ms"] - my) for r in rows) / sxx * 1000 if sxx else 0.0
        max_err = max(abs(r["error_ms"]) for r in rows)
        sign_ok = c["inject_ms"] == 0 or (my > 0) == (c["inject_ms"] > 0)
        reg = max_err <= bound_ms and sign_ok
        prod = max_err <= PRODUCT_MS and sign_ok
        reg_all &= reg
        prod_all &= prod
        res[name] = {"inject_ms": c["inject_ms"], "inject_drift_ppm": c["drift_ppm"], "events": rows, "events_judged": n, "events_in_first_gop_not_recorded": len(not_recorded),
                     "mean_offset_ms": round(my, 4), "fitted_slope_ppm": round(slope, 2), "max_abs_error_vs_truth_ms": round(max_err, 4), "sign_correct": sign_ok,
                     "bound_ms": bound_ms, "regression_bound": "PASS" if reg else "FAIL", "product_bound_40ms": "PASS" if prod else "FAIL",
                     "pairing": "by identity: beep from the mic manifest, flash by its order in the file", "first_video_sample_excluded": True,
                     "video_frames": nframes, "flash_frame_indexes": bright, "stray_onsets": len(stray)}
    return reg_all, prod_all, res


# ------------------------------------------------------------------------------------------ continuity (AU2-05)
def tone_phase(x, start=0, end=None):
    """The standby's reference tone inside x[start:end]: the longest run of windows that hold the tone, and how
    far the tone's phase moves inside it. A sample lost or inserted inside the run turns the phase (100
    samples = 1.83 cycles); a clean run stays within a few hundredths of a radian."""
    end = len(x) if end is None else end
    w = 2 * math.pi * TONE_HZ / SR
    wins = []
    for s0 in range(start, end - TONE_WIN + 1, TONE_WIN):
        c = s = e = 0.0
        for n in range(s0, s0 + TONE_WIN):
            v = x[n]
            c += v * math.cos(w * n)
            s += v * math.sin(w * n)
            e += v * v
        amp = 2 * math.hypot(c, s) / TONE_WIN
        rms = math.sqrt(e / TONE_WIN)
        pure = abs(rms - amp / math.sqrt(2)) < 0.01                # nothing but the tone in the window
        wins.append((s0, amp, math.atan2(c, s), TONE_AMP * 0.8 <= amp <= TONE_AMP * 1.2 and pure))
    best, cur = [], []
    for wv in wins + [(0, 0, 0, False)]:
        if wv[3]:
            cur.append(wv)
        else:
            if len(cur) > len(best):
                best = cur
            cur = []
    run = best[1:-1]                                              # the windows that hold a switch are left out
    if len(run) < 10:
        return {"tone_windows": len(run), "error": "no run of the reference tone long enough"}
    ref = run[0][2]
    dev = [abs((p - ref + math.pi) % (2 * math.pi) - math.pi) for _, _, p, _ in run]
    return {"tone_windows": len(run), "first_sample": run[0][0], "last_sample": run[-1][0] + TONE_WIN, "seconds": round(len(run) * TONE_WIN / SR, 3),
            "max_phase_deviation_rad": round(max(dev), 4), "mean_amplitude": round(sum(a for _, a, _, _ in run) / len(run), 4)}


def continuity(x, mic, beeps, encoder_input_samples, expect_tone=False, position_tolerance=48, tone_tolerance_rad=0.2):
    """AU2-05 on decoded samples x of one file. Criteria (each a separate verdict):
      count    decoded samples - encoder input samples is the priming plus the padding of the last frame
               (1,024 .. 2,048). Its resolution is one AAC frame: alone it cannot see a loss smaller than its slack;
      spacing  the distance between consecutive reference beeps equals the mic manifest's, within 2 samples;
      position every beep sits at its manifest sample + priming, within `position_tolerance` samples;
      tone     (with a switch to the standby) the 880 Hz reference tone keeps its phase over its whole run."""
    found, problems, stray = find_beeps(x, mic, beeps)
    order = sorted(found.values(), key=lambda b: b["index"])
    want = {b["index"]: b["onset_sample"] for b in beeps}
    spacing = [(b["sample"] - a["sample"]) - (want[b["index"]] - want[a["index"]]) for a, b in zip(order, order[1:])]
    extra = len(x) - encoder_input_samples
    crit = {"count": PRIMING <= extra <= 2 * PRIMING,
            "spacing": not problems and not stray and len(order) >= 2 and all(abs(e) <= 2 for e in spacing),
            "position": not problems and bool(order) and all(abs(b["position_error_samples"]) <= position_tolerance for b in order)}
    r = {"decoded_samples": len(x), "encoder_input_samples": encoder_input_samples, "decoded_minus_input": extra, "beeps_found": len(order),
         "beeps_audible_in_manifest": sum(1 for b in beeps if beep_audible(mic, b)), "beep_problems": problems, "stray_onsets": stray[:8],
         "spacing_error_samples": spacing, "position_error_samples": [b["position_error_samples"] for b in order]}
    if expect_tone:
        r["standby_tone"] = tone_phase(x)
        crit["tone"] = "error" not in r["standby_tone"] and r["standby_tone"]["max_phase_deviation_rad"] <= tone_tolerance_rad
    r["criteria"] = {k: ("PASS" if v else "FAIL") for k, v in crit.items()}
    return all(crit.values()), r


def packet_grid(path):
    """The metric AU2-05 rejected, reported so that nobody reads a verdict into it: the set of distances
    between consecutive audio packet pts. It is {1024} for a file with samples cut out of it, too."""
    pk = probe_packets(path, "a:0")
    return sorted({int(pk[i + 1]["pts"]) - int(pk[i]["pts"]) for i in range(len(pk) - 1)})
