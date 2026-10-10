#!/usr/bin/env python3
"""The capture end-to-end target (blueprint row 60; pair-58 F-14, D72(l)):

    make -C apps/capture-worker e2e            (from the repository root; needs loopback binding: sandbox OFF)

ONE entry point, ONE aggregate exit code. It builds the worker, its proof builds and the NM-14
fixtures, then runs the whole series of `m3worker.py` checks - every check twice, every negative
control twice - and exits

    0   only when EVERY verdict is the expected one: each check PASS, each negative control FAIL
        (and failed on the criteria it is meant to fail on);
    1   when any single verdict is not the expected one, a check crashed, timed out, printed no
        result, or left a process or a listener behind;
    2   when the series could not run at all (build failed, no two free ports in 8554-8564);
    75  when the heavy-host lock could not be taken within 30 minutes (nothing was run).

It is NOT part of `npm test`: it needs ports, FFmpeg and real time (about 35 minutes on an idle
host), and its timing checks are noise under the parallel JS suites. Run it at a gate, and again
after any FFmpeg upgrade (the transport refusal, the mux flags and the fixtures depend on
libavformat's behaviour: `make -C apps/capture-worker versions`).

    make -C apps/capture-worker e2e E2E_ARGS="--list"                      the series, nothing run
    make -C apps/capture-worker e2e E2E_ARGS="--only 'av1_|neg_av' "       a subset (regular expression on the names)
    make -C apps/capture-worker e2e E2E_ARGS="--ports 8559,8561"           another port pair
    make -C apps/capture-worker e2e E2E_ARGS="--runs 1"                    one run of each instead of two
    make -C apps/capture-worker e2e E2E_ARGS="--tag B --only 'x|y' --on-tag A"   re-run some checks of series A as series B
    python3 apps/capture-worker/test/e2e.py --prove-aggregate <series dir> flips every recorded verdict in turn and
                                                                           requires a non-zero aggregate each time
    ... --flip NAME                 treat the verdict of that one check as its opposite (a simulated regression)
    ... --append 'NAME=--variant negctl'   run that one check with more arguments (a REAL regression in a scratch run)

THE HEAVY-HOST LOCK. The series is a heavy job. The runner takes the shared lock of this host,
`.locks/heavy-host.lock` at the repository root, for its whole life: it re-starts itself under
`/usr/bin/lockf -k -t 1800 .locks/heavy-host.lock` (waits up to 30 minutes; exit 75 when the lock
could not be had). The STT / diarization engine runs take the same lock, so the two never overlap.
Opt out ONLY when the caller already holds the lock (a nested call): `E2E_NO_LOCK=1` (as a make
variable: make -C apps/capture-worker e2e E2E_NO_LOCK=1). --list and --prove-aggregate run
nothing and take no lock. A single harness check by hand is wrapped the same way:
    /usr/bin/lockf -k -t 1800 .locks/heavy-host.lock python3 apps/capture-worker/test/m3worker.py ...

Besides the lock, before each timing-sensitive check the runner waits while the host is busy (1-minute load above
--max-load, default 8, or a `whisper-cli` / `omlx` process alive), up to --load-wait seconds, and
writes the load at the start of every check into the summary. Results, one folder per series:
.cache/m3worker/e2e/<tag>/ (git-ignored): `<check>.out`, `summary.txt`, `summary.json`.
"""
import argparse, json, os, re, socket, subprocess, sys, time

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
APP = os.path.join(REPO, "apps", "capture-worker")
HARNESS = os.path.join(HERE, "m3worker.py")
HEAVY_LOCK = os.path.join(REPO, ".locks", "heavy-host.lock")       # one heavy job on this host at a time (all rows)
LOCK_WAIT_S = 1800
PORT_CANDIDATES = (8555, 8557, 8559, 8560, 8561, 8562, 8563, 8564)      # 8554 / 8556 / 8558: the Android emulators'
AV = "av_regression_2ms,av_product_40ms"


def series(runs):
    """(name, expected verdict, timing-sensitive, argv after the run name is put in). `{r}` = the run number.
    A check on a FINISHED run names that run instead of taking a name of its own (`@<check>`)."""
    S = []

    def add(name, argv, expect="PASS", sensitive=True, on=None, kind="harness"):
        S.append({"name": name, "argv": argv, "expect": expect, "sensitive": sensitive, "on": on, "kind": kind})

    add("static_rules", ["check", "selftest"], sensitive=False, kind="make")
    for r in range(1, runs + 1):
        add("unit_r%d" % r, ["unit"], sensitive=False, kind="make")
        add("harness_leftover_scope_r%d" % r, ["selfcheck"], sensitive=False)
        add("proto_r%d" % r, ["proto"])
        # M3-AV-1: 0 / +80 / -80 ms through the worker, incl. across a mic switch; M3-AV-2 (a): the same +-80 on
        # separate-process cameras with their own clocks; (b): +-200 ppm keeps the injected slope.
        add("av1_zero_switch_tap_r%d" % r, ["session", "--case", "zero", "--switch", "--tap"])
        add("av1_av2a_pm80_r%d" % r, ["session", "--case", "pm80"])
        add("av2b_drift_200ppm_r%d" % r, ["session", "--case", "drift"])
        # M3-AV-2 (c), row 62: +-200 ppm on the media clock, expressed in hand-written sender reports -> slope near 0.
        add("av2c_srdrift_200ppm_r%d" % r, ["srcam", "--mode", "drift"])
        add("continuity_r%d" % r, ["continuity"], sensitive=False, on="av1_zero_switch_tap_r%d" % r)
        add("wi1_camstop_r%d" % r, ["camstop"])
        add("wi1_fatal_rmdir_r%d" % r, ["fatal", "--mode", "rmdir"])
        add("optc_planted_r%d" % r, ["fatal", "--mode", "planted"])
        add("optc_exists_r%d" % r, ["fatal", "--mode", "exists"])
        add("fatal_clean_control_r%d" % r, ["fatal", "--mode", "clean"])
        add("bind_udp_r%d" % r, ["udp"])                                   # M3-RTSP-BIND-1
        add("sup_av2_pm80_r%d" % r, ["sup", "--mode", "run", "--case", "pm80"])
        add("kc1_r%d" % r, ["sup", "--mode", "kc1"])
        add("kc3_r%d" % r, ["sup", "--mode", "kc3"])
        add("mic_2000ppm_slow_r%d" % r, ["mic", "--mode", "slow"])
        add("mic_100ppm_fast_r%d" % r, ["mic", "--mode", "p100"])
        add("mic_100ppm_slow_r%d" % r, ["mic", "--mode", "m100"])
        add("mic_stop_and_return_r%d" % r, ["mic", "--mode", "gap"])
        add("longgop_250_r%d" % r, ["session", "--case", "long", "--gop", "250"])
        add("nocam_none_r%d" % r, ["nocam", "--mode", "none"])
        add("nocam_one_r%d" % r, ["nocam", "--mode", "one"])
        add("sup_nocam_r%d" % r, ["sup", "--mode", "nocam"])
        add("f2_norefusal_r%d" % r, ["udp", "--variant", "norefusal"])
        # Row 59, the fMP4 writer: M3-KC-2 (SIGKILL mid-write, tail validation flags a cut that ffprobe accepts), M3-KC-4
        # (long-GOP loss bounded by one fragment and reported), a write that comes back short, chain equality (the same
        # bytes through the writer again). Every recorded session above also carries the writer's criteria (M3-WI-1:
        # running hash == closed-file re-hash, checkpoints contiguous, the Core's tail validation, observed keyframe interval).
        add("kc2_sigkill_tail_validation_r%d" % r, ["kc2"])
        add("kc4_longgop_loss_reported_r%d" % r, ["kc4", "--gop", "250"])
        add("writer_short_write_truncates_r%d" % r, ["writefault", "--variant", "writefault"])
        add("chain_replay_same_bytes_r%d" % r, ["replay", "--other", "sibling"], sensitive=False, on="av1_zero_switch_tap_r%d" % r)
        # ---- negative controls: each must FAIL, on the criteria named
        add("neg_kc2_file_not_cut_r%d" % r, ["kc2", "--control", "nocut", "--expect-fail", "--must-fail-on", "tail_validation_flags_the_cut,drop_fragment_rule_recovers_the_previous_prefix"], "FAIL")
        add("neg_kc4_camera_inside_the_bound_r%d" % r, ["kc4", "--gop", "50", "--expect-fail", "--must-fail-on", "gop_warning_raised_before_the_kill,keyframe_interval_record_names_the_camera_gop"], "FAIL")
        add("neg_writer_no_truncation_r%d" % r, ["writefault", "--variant", "writefault-notrunc", "--expect-fail", "--must-fail-on", "file1_is_at_its_last_good_length,tail_validation_clean"], "FAIL")
        add("neg_chain_replay_one_byte_changed_r%d" % r, ["replay", "--control", "flip", "--expect-fail", "--must-fail-on", "replay_gives_the_same_checkpoints,replayed_file_is_byte_identical"], "FAIL", False, on="av1_zero_switch_tap_r%d" % r)
        add("neg_h4_reencoded_r%d" % r, ["h4neg"], "FAIL", False, on="av1_zero_switch_tap_r%d" % r)
        add("neg_av_forbidden_mux_option_r%d" % r, ["session", "--case", "pm80", "--variant", "negctl", "--expect-fail", "--must-fail-on", AV], "FAIL")
        add("neg_av_mic_latency_5ms_r%d" % r, ["session", "--case", "zero", "--mic-late-us", "5000", "--expect-fail", "--must-fail-on", "av_regression_2ms"], "FAIL")
        add("neg_av2b_drift_judged_as_none_r%d" % r, ["avcheck", "--assume-drift-ppm", "0", "--expect-fail", "--must-fail-on", "av_regression_2ms"], "FAIL", False, on="av2b_drift_200ppm_r%d" % r)
        add("neg_av2c_reports_without_rate_r%d" % r, ["srcam", "--mode", "drift", "--sr", "linear", "--expect-fail", "--must-fail-on", "av_regression_2ms,drift_slope_near_zero"], "FAIL")
        # Row 62: the WANTED behaviour of the camera-clock telemetry (pair-58 navigator B R-2 and F-6; D85). The change is
        # in the worker's sources: row 62's proposed change, applied by row 59 (the owner of the sources) on the
        # coordinator's mediated request. The three are therefore in their plain form: expected PASS.
        add("want_r2_near_bound_steady_delay_r%d" % r, ["srcam", "--mode", "delay"])
        add("want_r2_near_bound_clock_step_r%d" % r, ["srcam", "--mode", "step"])
        add("want_f6_camera_clock_sanity_bound_r%d" % r, ["srcam", "--mode", "offset"])
        add("neg_bind_skeleton_r%d" % r, ["udp", "--variant", "skeleton", "--expect-fail", "--must-fail-on", "no_udp_socket,every_socket_on_loopback"], "FAIL")
        # Integration pass E2. The control `neg_sup_forbidden_mux_option` ran the proof build `negctl` THROUGH THE
        # SUPERVISOR and expected its AV criteria to fail. Since rows 61 / 71b the production supervisor refuses a
        # proof build at its HELLO (CAPTURE_WORKER_PROOF_BUILD), by design and without a switch: that control cannot
        # run any more. In its place, three checks that are each true of the product as it is:
        #   sup_refuses_proof_build            the same binary through the supervisor: refused with that code, not
        #                                      retried, nothing recorded, no listener and no worker left (expected PASS);
        #   neg_sup_release_worker_is_accepted its control: the release worker is NOT refused (must FAIL on that criterion);
        #   neg_sup_av_judged_as_no_offset     the AV judgement of the session recorded through the supervisor
        #                                      (sup_av2_pm80) can fail: judged against "no offset injected" it is 80 ms off.
        # That the forbidden mux option itself breaks AV is proven on the direct driver (neg_av_forbidden_mux_option,
        # above) and refused in the product build by the static rules (`make check`).
        add("sup_refuses_proof_build_r%d" % r, ["sup", "--mode", "refuse", "--variant", "negctl"])
        add("neg_sup_release_worker_is_accepted_r%d" % r, ["sup", "--mode", "refuse", "--expect-fail", "--must-fail-on", "refused_with_proof_build_code"], "FAIL")
        add("neg_sup_av_judged_as_no_offset_r%d" % r, ["avcheck", "--assume-inject-ms", "0,0", "--expect-fail", "--must-fail-on", AV], "FAIL", False, on="sup_av2_pm80_r%d" % r)
        add("neg_mic_no_compensation_r%d" % r, ["mic", "--mode", "slow", "--variant", "nocomp", "--expect-fail", "--must-fail-on", "av_within_mic_bound_5ms", "--may-fail-on", "av_product_40ms"], "FAIL")
        add("neg_kc3_no_restart_allowed_r%d" % r, ["sup", "--mode", "kc3", "--limits", '{"maxRestarts":0}', "--expect-fail", "--must-fail-on", "restarted_after_a_kill_before_any_fragment"], "FAIL")
        add("neg_continuity_cut_r%d" % r, ["continuity", "--control", "cut", "--expect-fail", "--must-fail-on", "spacing,position", "--may-fail-on", "count"], "FAIL", False, on="av1_zero_switch_tap_r%d" % r)
        add("neg_continuity_toneslip_r%d" % r, ["continuity", "--control", "toneslip", "--expect-fail", "--must-fail-on", "tone"], "FAIL", False, on="av1_zero_switch_tap_r%d" % r)
        add("neg_gop50_judged_as_250_r%d" % r, ["gopcheck", "--gop", "250", "--expect-fail", "--must-fail-on", "file_keyframe_interval_equals_camera_gop"], "FAIL", False, on="av1_zero_switch_tap_r%d" % r)
    # ---- the mux-flag evaluation of row 58 part P4, kept as a regression (once)
    add("p4_delay_pm80", ["session", "--case", "pm80", "--variant", "delaymoov"])
    add("p4_shape_pinned", ["shape"], sensitive=False, on="av1_av2a_pm80_r1")
    add("p4_shape_delay", ["shape"], sensitive=False, on="p4_delay_pm80")
    add("p4_stall_pinned", ["session", "--case", "pm80", "--stall"])
    add("neg_p4_stall_delay_moov", ["session", "--case", "pm80", "--stall", "--variant", "delaymoov", "--expect-fail", "--must-fail-on", AV], "FAIL")
    # Row 71 (worker half), once each (decision D122): the operator's switch - its bound, its interval records against
    # the pre-encode tap, never a switch nobody commanded; the gap analyser M5-GAP-1 with its must-FAIL vector (1,000
    # samples removed AT the switch); the mutation of the interval record; silence / disconnect / rate-limit warnings
    # by device ID that never switch (the raiser itself, M5-WARN-1, is in `make unit`: test/micwatch_test.c).
    add("m5_switch_bound_intervals", ["m5switch"])
    add("m5_gap_analyser", ["m5gap"], sensitive=False, on="m5_switch_bound_intervals")
    add("neg_m5_gap_1000_removed_at_the_switch", ["m5gap", "--control", "cut1000", "--expect-fail", "--must-fail-on", "spacing,position,tone_window_is_the_interval", "--may-fail-on", "count"], "FAIL", False, on="m5_switch_bound_intervals")
    add("neg_m5_switch_bound_judged_at_1us", ["m5bound", "--bound-us", "1", "--expect-fail", "--must-fail-on", "switch_applied_within_the_bound"], "FAIL", False, on="m5_switch_bound_intervals")
    add("neg_m5_interval_record_skewed", ["m5switch", "--variant", "intervalskew", "--expect-fail", "--must-fail-on", "interval_record_is_the_tap_boundary"], "FAIL")
    add("m5_warn_silent_disconnect_never_switch", ["m5warn"])
    add("m5_rate_limit_reported", ["m5rate", "--ppm", "-8000"])
    add("neg_m5_rate_inside_the_range", ["m5rate", "--ppm", "-2000", "--expect-fail", "--must-fail-on", "rate_limit_warning_raised_and_named"], "FAIL")
    # Row 59, M3-MG-1: after every capture session of the series, 0 media in git (its control is inside the check).
    add("mg1_no_media_in_git", ["mg1"], sensitive=False)
    # Row 62: only with M3_WORKER_PROPOSED=<a worker built OUTSIDE the tree from a proposed change> - the same four
    # cases on that binary, all expected to PASS. Never part of the plain series.
    if os.environ.get("M3_WORKER_PROPOSED"):
        for r in range(1, runs + 1):
            for mode in ("drift", "delay", "step", "offset"):
                add("proposed_srcam_%s_r%d" % (mode, r), ["srcam", "--mode", mode, "--variant", "proposed"])
    return S


def busy():
    load = os.getloadavg()[0]
    # By the NAME OF THE PROGRAM (or of the script an interpreter runs), never by a command line that merely
    # mentions it: a shell that is itself waiting for `whisper-cli` to end is not a heavy process.
    heavy = set()
    for line in subprocess.run(["ps", "-axo", "command="], capture_output=True, text=True).stdout.splitlines():
        for word in line.split()[:2]:
            name = os.path.basename(word)
            if name == "whisper-cli" or name.startswith("omlx"):
                heavy.add(name)
    return load, sorted(heavy)


def wait_for_quiet(max_load, max_wait):
    t0 = time.monotonic()
    while True:
        load, heavy = busy()
        if (load <= max_load and not heavy) or time.monotonic() - t0 >= max_wait:
            return round(load, 2), heavy, round(time.monotonic() - t0)
        time.sleep(15)


def port_free(port):
    lis = subprocess.run(["lsof", "-nP", "-iTCP:%d" % port, "-sTCP:LISTEN"], capture_output=True, text=True).stdout.strip()
    if lis:
        return False
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        s.bind(("127.0.0.1", port))
        return True
    except OSError:
        return False
    finally:
        s.close()


def last_json(text):
    """The result object a check printed last (it starts a line with '{' and runs to the end of the output)."""
    for m in reversed(list(re.finditer(r"^\{", text, re.M))):
        try:
            return json.loads(text[m.start():])
        except ValueError:
            continue
    return None


def numbers(r):
    """The few numbers of a result worth a line in the summary."""
    if not r:
        return ""
    out = []
    for key in ("av_offsets", "session2_av_offsets"):
        for cam, c in (r.get(key) or {}).items():
            if "error" in c:
                out.append("%s: %s" % (cam, c["error"]))
            else:
                out.append("%s mean %+.4f ms, max err %.4f ms (bound %g: %s; product 40: %s)%s" % (
                    cam, c["mean_offset_ms"], c["max_abs_error_vs_truth_ms"], c["bound_ms"], c["regression_bound"], c["product_bound_40ms"],
                    ", slope %+.2f ppm of %+g" % (c["fitted_slope_ppm"], c["inject_drift_ppm"]) if c.get("inject_drift_ppm") else ""))
    if r.get("t0"):
        out.append("T0 error %d us" % r["t0"]["t0_error_us"])
    if "udp_sockets" in r:
        out.append("%d snapshots, UDP %s, off loopback %d, seen %s" % (r.get("snapshots", 0), [" ".join(x.split()[-2:]) for x in r["udp_sockets"]], len(r["sockets_not_on_loopback"]), r.get("sockets_seen")))
    own, lis = (r.get("info") or {}).get("own_sockets_mid_session"), (r.get("info") or {}).get("own_sockets_listening")
    if own and lis:
        out.append("listeners before the sources %s; mid-session %d sockets of %d own processes, off loopback %d, UDP %d, foreign ports %d" % (
            lis["listeners"], len(own["rows"]), own.get("processes", 0), len(own["not_loopback"]) + len(lis["not_loopback"]), len(own["udp"]) + len(lis["udp"]), len(own["foreign_ports"]) + len(lis["foreign_ports"])))
    if r.get("gop"):
        g = r["gop"]
        out.append("camera GOP %d: keyframe intervals %s, longest fragment %s s, worker reports the interval: %s" % (
            g["camera_gop_frames"], {k: f["keyframe_intervals_frames"] for k, f in g["files"].items()}, max((f["longest_fragment_s"] or 0) for f in g["files"].values()), g["worker_reports_observed_keyframe_interval"]))
    for name, f in (r.get("files") or {}).items():
        if isinstance(f, dict) and "criteria" in f:
            out.append("%s: decoded-input %s, spacing err %s, position err %s%s" % (name, f["decoded_minus_input"], f["spacing_error_samples"], f["position_error_samples"],
                                                                                 ", tone %s" % f["standby_tone"] if "standby_tone" in f else ""))
    if "mic_summary" in r:
        out.append("mic %s; silent seconds %s; null-level frames %s" % ([(m["mic"], m["last_ppm"], m["restarts"]) for m in r["mic_summary"]], r.get("silent_seconds"), r.get("telemetry_frames_with_primary_null")))
    if r.get("failed_criteria"):
        out.append("failed on: %s" % ", ".join(r["failed_criteria"]))
    return "; ".join(out)


def judge(c):
    """Is the verdict of one check the expected one? A negative control passes ONLY as a FAIL verdict that the
    harness itself accepted (exit 0 under --expect-fail); a crash or a timeout is never 'failed as required'."""
    if c["kind"] == "make":
        return c["rc"] == 0
    if c.get("verdict") not in ("PASS", "FAIL"):
        return False
    if c["expect"] == "PASS":
        return c["verdict"] == "PASS" and c["rc"] == 0
    return c["verdict"] == "FAIL" and c["rc"] == 0 and str(c.get("negative_control", "")).startswith("failed as required")


def aggregate(checks):
    return 0 if checks and all(judge(c) for c in checks) else 1


def flipped(c):
    """The same check with the opposite verdict, as the harness would have reported it."""
    d = dict(c)
    if c["kind"] == "make":
        d["rc"] = 0 if c["rc"] else 2
        return d
    d["verdict"] = "FAIL" if c.get("verdict") == "PASS" else "PASS"
    d["rc"] = 1                                                    # a PASS under --expect-fail and a FAIL without it both exit 1
    if c["expect"] == "FAIL":
        d["negative_control"] = "DID NOT FAIL - the control is broken"
    return d


def prove(directory):
    checks = json.load(open(os.path.join(directory, "summary.json")))["checks"]
    base = aggregate(checks)
    bad = [c["name"] for i, c in enumerate(checks) if aggregate(checks[:i] + [flipped(c)] + checks[i + 1:]) == 0]
    print("recorded series: %d checks, aggregate %d" % (len(checks), base))
    print("each of the %d verdicts flipped in turn: %d flips leave the aggregate at 0%s" % (len(checks), len(bad), (" -> " + ", ".join(bad)) if bad else ""))
    return 0 if base == 0 and not bad else 1


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--list", action="store_true")
    ap.add_argument("--only", default=None, help="regular expression on the check names")
    ap.add_argument("--runs", type=int, default=2)
    ap.add_argument("--ports", default=None, help="two ports of 8554-8564, e.g. 8559,8561 (default: the first two free ones)")
    ap.add_argument("--tag", default=None, help="name of the series folder and prefix of its runs (default: a timestamp)")
    ap.add_argument("--on-tag", default=None, help="with --only: a check on the files of a FINISHED run that is not selected here reads the run of that earlier series")
    ap.add_argument("--max-load", type=float, default=8.0)
    ap.add_argument("--load-wait", type=int, default=900, help="seconds to wait for a quiet host before a timing-sensitive check")
    ap.add_argument("--timeout", type=int, default=420, help="seconds per check")
    ap.add_argument("--no-build", action="store_true")
    ap.add_argument("--flip", default=None, help="treat the verdict of this ONE check as its opposite")
    ap.add_argument("--append", action="append", default=[], help="NAME=ARGS: more arguments for one check (a real regression in a scratch run)")
    ap.add_argument("--prove-aggregate", default=None, metavar="DIR")
    a = ap.parse_args()
    if a.prove_aggregate:
        sys.exit(prove(a.prove_aggregate))

    S = series(a.runs)
    extra = dict(x.split("=", 1) for x in a.append)
    known = {c["name"] for c in S}
    for name in list(extra) + ([a.flip] if a.flip else []):
        if name not in known:
            sys.exit("no check named %r (see --list)" % name)
    if a.only:
        S = [c for c in S if re.search(a.only, c["name"])]
    if a.list:
        for c in S:
            print("%-40s expect %-4s %s%s" % (c["name"], c["expect"], " ".join(c["argv"]), ("   [on the files of %s]" % c["on"]) if c["on"] else ""))
        print("%d checks" % len(S))
        return
    if not S:
        sys.exit("no check selected")

    # One heavy job at a time on this host: re-start under the shared lock unless the caller holds it already.
    if os.environ.get("E2E_NO_LOCK") == "1":
        lock_state = "NOT taken here (E2E_NO_LOCK=1: the caller says it holds it)"
    elif os.environ.get("DEMS_HEAVY_HOST_LOCK_HELD") == str(os.getppid()):
        lock_state = "held (%s)" % os.path.relpath(HEAVY_LOCK, REPO)
    else:
        os.makedirs(os.path.dirname(HEAVY_LOCK), exist_ok=True)
        print("e2e: waiting for %s (up to %d s)" % (os.path.relpath(HEAVY_LOCK, REPO), LOCK_WAIT_S), flush=True)
        os.environ["DEMS_HEAVY_HOST_LOCK_HELD"] = str(os.getpid())          # lockf keeps this pid and runs the series as its child
        os.execv("/usr/bin/lockf", ["lockf", "-k", "-t", str(LOCK_WAIT_S), HEAVY_LOCK, sys.executable, os.path.abspath(__file__)] + sys.argv[1:])
    tag = a.tag or time.strftime("%m%d%H%M")
    out_dir = os.path.join(REPO, ".cache", "m3worker", "e2e", tag)
    os.makedirs(out_dir, exist_ok=True)
    if a.ports:
        ports = [int(x) for x in a.ports.split(",")]
    else:
        ports = [p for p in PORT_CANDIDATES if port_free(p)][:2]
    if len(ports) != 2 or not all(port_free(p) for p in ports):
        print("e2e: no two free ports in 8554-8564 (asked %r); nothing was run" % (a.ports or "auto"))
        sys.exit(2)
    env = dict(os.environ, M3_PORTS="%d,%d" % tuple(ports))
    print("e2e: series %s, %d checks, ports 127.0.0.1:%d and :%d, results in %s; heavy-host lock %s" % (tag, len(S), ports[0], ports[1], os.path.relpath(out_dir, REPO), lock_state), flush=True)

    if not a.no_build:
        b = subprocess.run([sys.executable, HARNESS, "build"], capture_output=True, text=True, env=env)
        open(os.path.join(out_dir, "build.out"), "w").write(b.stdout + b.stderr)
        if b.returncode != 0:
            print("e2e: BUILD FAILED (see build.out); nothing was run\n" + (b.stdout + b.stderr)[-1500:])
            sys.exit(2)
    versions = subprocess.run(["make", "-C", APP, "versions"], capture_output=True, text=True).stdout.split()

    checks, t_series, selected = [], time.monotonic(), {c["name"] for c in S}
    for c in S:
        c = dict(c)
        # A re-run of some checks (--only): a check that reads a finished run which is not part of this selection
        # takes the run of the series named by --on-tag (it is written into the summary as `on_run`).
        run_name = "e2e_%s_%s" % (a.on_tag if (c["on"] and a.on_tag and c["on"] not in selected) else tag, c["on"] or c["name"])
        if c["on"]:
            c["on_run"] = run_name
        if c["kind"] == "make":
            cmd = ["make", "-C", APP] + c["argv"]
        else:
            cmd = [sys.executable, HARNESS, c["argv"][0], run_name] + c["argv"][1:] + (extra[c["name"]].split() if c["name"] in extra else [])
        c["load_at_start"], c["heavy_at_start"], c["waited_s"] = wait_for_quiet(a.max_load, a.load_wait) if c["sensitive"] else (round(os.getloadavg()[0], 2), [], 0)
        t = time.monotonic()
        try:
            p = subprocess.run(cmd, capture_output=True, text=True, env=env, timeout=a.timeout, cwd=REPO)
            c["rc"], text = p.returncode, p.stdout + ("\n--- stderr ---\n" + p.stderr if p.stderr.strip() else "")
            res = last_json(p.stdout) if c["kind"] != "make" else None
        except subprocess.TimeoutExpired as e:
            c["rc"], text, res = "timeout", (e.stdout or b"").decode("utf-8", "replace") if isinstance(e.stdout, bytes) else (e.stdout or ""), None
        open(os.path.join(out_dir, c["name"] + ".out"), "w").write(text)
        waited = re.search(r"^ports were busy for .*$", text, re.M)        # the harness waited for a listener that was not its own
        if waited:
            c["ports_waited"] = waited.group(0)[:400]
        c["seconds"] = round(time.monotonic() - t, 1)
        c["command"] = " ".join(cmd[1:] if c["kind"] != "make" else cmd).replace(REPO + "/", "")
        if res:
            c["verdict"], c["negative_control"], c["failed_criteria"], c["numbers"] = res.get("verdict"), res.get("negative_control"), res.get("failed_criteria"), numbers(res)
        elif c["kind"] == "make":
            c["verdict"] = "PASS" if c["rc"] == 0 else "FAIL"
            c["numbers"] = " | ".join(l.strip() for l in text.splitlines() if re.search(r"anchor_test|sink_kill_test|static rules OK|selftest", l))[:600]
        else:
            c["verdict"], c["numbers"] = "NO-RESULT", text.strip().splitlines()[-1][:300] if text.strip() else ""
        if a.flip == c["name"]:
            c.update(flipped(c), flipped_by_the_runner=True)
        c["as_expected"] = judge(c)
        checks.append(c)
        print("%-40s expect %-4s got %-9s rc %-7s %s  load %5.2f%s  %5.1f s%s" % (
            c["name"], c["expect"], c["verdict"], c["rc"], "ok        " if c["as_expected"] else "UNEXPECTED", c["load_at_start"],
            " (waited %d s)" % c["waited_s"] if c["waited_s"] else "", c["seconds"], "  [verdict flipped by --flip]" if c.get("flipped_by_the_runner") else ""), flush=True)

    # Hygiene of the series as a whole: nothing listens on our two ports any more.
    left = [p for p in ports if not port_free(p)]
    code = aggregate(checks)
    if left:
        code = 1
    unexpected = [c["name"] for c in checks if not c["as_expected"]]
    loads = [c["load_at_start"] for c in checks if c["sensitive"]]
    summary = {"tag": tag, "ports": ports, "ffmpeg_libraries": versions, "checks": checks, "unexpected": unexpected, "ports_still_listening": left, "exit_code": code, "heavy_host_lock": lock_state,
               "seconds": round(time.monotonic() - t_series), "load_at_start_min_max": [min(loads), max(loads)] if loads else None}
    json.dump(summary, open(os.path.join(out_dir, "summary.json"), "w"), indent=1)
    lines = ["capture e2e series %s   ports %s   libav %s   heavy-host lock %s" % (tag, ports, " ".join(versions[:5]), lock_state), ""]
    for c in checks:
        lines.append("%-40s expect %-4s got %-9s rc %-7s %-10s load %5.2f  %5.1f s" % (c["name"], c["expect"], c["verdict"], c["rc"], "ok" if c["as_expected"] else "UNEXPECTED", c["load_at_start"], c["seconds"]))
        if c.get("negative_control"):
            lines.append("      control: %s" % c["negative_control"])
        if c.get("numbers"):
            lines.append("      %s" % c["numbers"])
        if c.get("ports_waited"):
            lines.append("      NOTE %s" % c["ports_waited"])
    n_neg = sum(1 for c in checks if c["expect"] == "FAIL")
    lines += ["", "%d checks (%d expected PASS, %d negative controls expected FAIL): %d as expected, %d unexpected%s" % (
        len(checks), len(checks) - n_neg, n_neg, len(checks) - len(unexpected), len(unexpected), (": " + ", ".join(unexpected)) if unexpected else ""),
        "ports still listening after the series: %s" % (left or "none"),
        "load at the start of the timing-sensitive checks: %s .. %s" % (min(loads), max(loads)) if loads else "no timing-sensitive check",
        "AGGREGATE EXIT CODE %d" % code]
    open(os.path.join(out_dir, "summary.txt"), "w").write("\n".join(lines) + "\n")
    print("\n".join(lines[-4:]), flush=True)
    sys.exit(code)


if __name__ == "__main__":
    main()
