#!/usr/bin/env python3
"""Task 4 blueprint row 159 (AD-12; S13-02 points (a), (b), (d)): RELAY HYGIENE OBSERVED on a running relay.
Test code only; an OBSERVATION: nothing of the product is changed or built.

The engine is row 44's (row044_e12_search.py, imported unchanged: the stand-in of the Core with the real
production door, the sampler, the counting). This file adds the ends and the starts row 44 does not run, and the
hygiene summary over the runs of BOTH rows.

  (a) codes and counters only        every line of standard error is one JSON object whose values are numbers or
                                     one word; standard output holds report lines of the fixed shape or nothing
  (b) outputs inside their bound     bytes and longest line of both streams per case, against the relay's report
                                     bound (RELAY_REPORT_MAX 6400) and the door's copy bound (64 KiB)
  (d) the start message never echoed occurrences of the run's texts in both streams and in the door's error: 0;
                                     a start write that FAILS (a relay that ends before it read, a message larger
                                     than a pipe) raises an error that names no part of the message
  and, asked by the brief: the descriptors the relay holds (lsof), a careless parent's descriptors, the file-size
  limit seen as an empty file, what `ps` shows, the exit code and the word of every end.

Cases of this file (the others are row 44's):
  end_by_order            record, then the order to stop                                   exit 0  STOPPED
  end_worker_killed       the worker is killed under the push                              exit 41 INGEST_LOST
  end_camera_never_back   the camera ends for good after the push stood: 6 tries, 62 s     exit 20 CAMERA_UNREACHABLE
  flood_answer            a camera that floods its answer                                  a named refusal
  usage_argument          the door hands the relay an argument                             exit 2  USAGE
  failed_start_write      an argument AND a start message larger than a pipe               the door's error
  door_core_limit         a parent whose core-file limit is not 0                          the door starts nothing
  stderr_on_a_file        standard error is a regular file (direct start, not the door)    the file stays empty
  careless_parent         a parent that hands on two more descriptors (direct start)       what the relay holds

    # repository root, command sandbox off; one run per lock hold
    /usr/bin/lockf -k -t 1800 .locks/heavy-host.lock python3 -B apps/capture-worker/test-fixtures/row159_relay_hygiene.py run <case> <n>
    python3 -B apps/capture-worker/test-fixtures/row159_relay_hygiene.py cases | summary | hygiene

COUNT-ONLY, as row 44. Everything a run writes lands under .cache/row159-hygiene/ (git-ignored)."""
import json, os, resource, secrets, signal, subprocess, sys, threading, time

sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
OUT = os.path.join(REPO, ".cache", "row159-hygiene")
ROW44_OUT = os.path.join(REPO, ".cache", "row044-e12")
os.environ["ROW44_OUT"] = OUT
sys.path.insert(0, HERE)
import row044_e12_search as S                            # read-only reuse: the engine
H, R = S.H, S.R

RUN_BOUND_S = 240                                        # a run of this file never holds the host's lock for longer (I-9a)
REPORT_MAX = 6400                                        # RELAY_REPORT_MAX of src/relay/relay.h
DOOR_CAP = 64 * 1024                                     # PRODUCTION_OUTPUT_CAP_BYTES of the production door


class DirectRelay:
    """The relay started by THIS script (no argument, empty environment), for the two cases the door cannot make:
    standard error on a regular file, and a parent that hands on more descriptors. Same members as S.DoorRelay."""

    def __init__(self, d, locator, user, secret, ingest, err_file=False, leak=False):
        self.d, self.out, self.err, self.door_out, self.chunks = d, b"", b"", b"", []
        self.started, self.threw, self.core_limit, self.ended = None, None, None, None
        self.spawned = {"by": "this script, not the door", "argument_count": 0, "environment_keys": 0}
        self.err_path = os.path.join(d, "relay.stderr.file") if err_file else None
        self.leaked = []
        if leak:
            self.leaked = [os.open(os.path.join(d, "careless.regular"), os.O_CREAT | os.O_RDWR, 0o600), os.pipe()[0]]
        self.parent = H.spawn([S.RELAY], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=open(self.err_path, "wb") if err_file else subprocess.PIPE, env={},
                              close_fds=True, pass_fds=tuple(self.leaked), preexec_fn=lambda: resource.setrlimit(resource.RLIMIT_CORE, (0, resource.getrlimit(resource.RLIMIT_CORE)[1])))
        self.pid = self.parent.pid
        self.readers = [threading.Thread(target=self._read, args=(n,), daemon=True) for n in (("out",) if err_file else ("out", "err"))]
        for t in self.readers:
            t.start()
        self.parent.stdin.write(R.start_message(ingest, locator, user, secret, attempt=S.ATTEMPT))
        self.parent.stdin.flush()
        threading.Thread(target=self._wait, daemon=True).start()

    def _read(self, name):
        stream = self.parent.stdout if name == "out" else self.parent.stderr
        for chunk in iter(lambda: stream.read1(65536), b""):
            setattr(self, name, getattr(self, name) + chunk)
            self.chunks.append((time.monotonic(), name, len(chunk)))

    def _wait(self):
        rc = self.parent.wait()
        for t in self.readers:
            t.join(3)
        self.ended = {"exitCode": rc if rc >= 0 else None, "signal": None if rc >= 0 else signal.Signals(-rc).name, "spawnFailed": False, "diagnostics": "", "output": "", "t": time.monotonic()}

    until, saw, wait_ended = S.DoorRelay.until, S.DoorRelay.saw, S.DoorRelay.wait_ended

    def wait_pid(self, timeout=0):
        return True

    def say(self, word):
        try:
            if word == "end":
                self.parent.stdin.close()
            elif word == "kill":
                self.parent.kill()
        except OSError:
            pass

    def finish(self):
        forced = self.ended is None
        if forced:
            self.parent.kill()
            self.wait_ended(5)
        return forced


def direct(**kw):
    def make(locator, user, real, ingest):
        return {"mode": "record", "secret": real, "start": lambda d: DirectRelay(d, locator, user, real, ingest, **kw)}
    return make


def big_message(locator, user, real, ingest):
    """A start message larger than a pipe, for a relay that ends before it reads (it was handed an argument)."""
    big = "ROW159BIG" + secrets.token_urlsafe(18) + "x" * 300000
    return {"mode": "record", "secret": big, "start": lambda d: S.DoorRelay(d, "record", locator, user, big, ingest, args=["not-an-option"]),
            "texts": {"secret_first_33_characters": big[:33], "real_secret": real}}


def act_worker_killed(ctx, relay, o):
    seen = relay.saw(b'"report":"push_established"', 20) is not None
    time.sleep(2.0)
    t = time.monotonic()
    ctx["worker"].kill()
    relay.wait_ended(10)
    return {"lines_seen": {"push_established": seen}, "ms_from_the_killed_worker_to_the_end": None if relay.ended is None else round((relay.ended["t"] - t) * 1000)}


def act_camera_never_back(ctx, relay, o):
    seen = relay.saw(b'"report":"push_established"', 20) is not None
    time.sleep(2.0)
    try:
        o["cam"].stdin.close()                           # --exit-on-stdin-eof: the camera ends, nothing listens at its address afterwards
    except OSError:
        pass
    lost = relay.saw(b'"report":"camera_lost"', 20)
    relay.wait_ended(90)
    return {"lines_seen": {"push_established": seen, "camera_lost": lost is not None},
            "seconds_from_the_loss_line_to_the_end": None if lost is None or relay.ended is None else round(relay.ended["t"] - lost, 2)}


def act_file(ctx, relay, o):
    relay.wait_ended(15)
    return {"bytes_in_the_file_standard_error_pointed_at": os.path.getsize(relay.err_path)}


def act_careless(ctx, relay, o):
    # CONTROL: a program that closes nothing, started the same way with the same two descriptors, read by the same tool.
    c = H.spawn(["/bin/sleep", "20"], stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, env={}, close_fds=True, pass_fds=tuple(relay.leaked))
    time.sleep(3.0)                                      # the open is under way (a late keyframe): the sampler reads the descriptors
    rows = [l.split(None, 8) for l in H.sh(["lsof", "-nP", "-p", str(c.pid)]).stdout.splitlines()[1:]]
    control = sorted("%s:%s" % (r[3].rstrip("urw"), r[4]) for r in rows if len(r) > 4 and r[3].rstrip("urw").isdigit() and int(r[3].rstrip("urw")) > 2)
    c.kill()
    c.wait()
    relay.control_descriptors = control
    relay.say("end")
    relay.wait_ended(10)
    for fd in relay.leaked:
        os.close(fd)
    return {"descriptors_the_parent_handed_on_beyond_the_three": len(relay.leaked), "control_program_holds_them": relay.control_descriptors}


def door_error(code):
    return lambda res: res["relay"]["door_start"]["ok"] is False and res["relay"]["door_start"]["error_code"] == code


CASES = {
    "end_by_order": (S.with_worker, dict(camera_extra=(), make=S.door(), act=S.act_stop_after(3.0), expect=S.code_is(0))),
    "end_worker_killed": (S.with_worker, dict(camera_extra=(), make=S.door(), act=act_worker_killed, expect=S.code_is(41))),
    "end_camera_never_back": (S.with_worker, dict(camera_extra=(), make=S.door(), act=act_camera_never_back, expect=S.code_is(20))),
    "flood_answer": (S.without_worker, dict(camera_extra=("--adversary", "flood-answer"), make=S.door(), act=S.act_wait, expect=lambda res: res["relay"]["exit_code"] not in (0, None))),
    "usage_argument": (S.without_worker, dict(camera_extra=(), make=S.door(args=["not-an-option"]), act=S.act_wait, expect=S.code_is(2), camera=False)),
    "failed_start_write": (S.without_worker, dict(camera_extra=(), make=big_message, act=S.act_wait, expect=lambda res: res["relay"]["door_start"]["ok"] is False, camera=False)),
    "door_core_limit": (S.without_worker, dict(camera_extra=(), make=S.door(core_limit=None), act=S.act_wait, expect=door_error("PRODUCTION_CORE_FILE_LIMIT_NOT_ZERO"), camera=False)),
    "stderr_on_a_file": (S.without_worker, dict(camera_extra=(), make=direct(err_file=True), act=act_file, expect=lambda res: res["extra"]["bytes_in_the_file_standard_error_pointed_at"] == 0 and res["relay"]["exit_code"] == 20, camera=False)),
    "careless_parent": (S.without_worker, dict(camera_extra=S.LATE_KEYFRAME, make=direct(leak=True), act=act_careless, expect=lambda res: res["relay"]["exit_code"] == 0 and len(res["extra"]["control_program_holds_them"]) == 2)),
}


def exit_counter(r, member):
    """A counter of the relay's exit line, read from the kept copy of its standard error."""
    for base in (ROW44_OUT, OUT):
        p = os.path.join(base, "runs", r["run"], "relay.stderr")
        if os.path.exists(p) and json.load(open(os.path.join(base, "runs", r["run"], "result.json"))).get("utc") == r.get("utc"):
            for l in reversed(open(p, errors="replace").read().splitlines()):
                try:
                    o = json.loads(l)
                except ValueError:
                    continue
                if isinstance(o, dict) and o.get("relay") == "exit":
                    return o.get(member)
    return "-"


def hygiene():
    """One line per case over the runs of both rows: the end, the outputs, the descriptors."""
    rows = []
    for base in (ROW44_OUT, OUT):
        runs = os.path.join(base, "runs")
        for name in sorted(os.listdir(runs)) if os.path.isdir(runs) else []:
            p = os.path.join(runs, name, "result.json")
            if os.path.exists(p):
                r = json.load(open(p))
                if "places" in r:
                    rows.append(r)
    cases = []
    for r in rows:
        if r["case"] not in cases:
            cases.append(r["case"])
    print("| case | runs | end (code word / signal) | word the relay wrote | stdout bytes max, longest line | stderr bytes max, longest line | lines not of the fixed shape | library_errors | texts in both streams + door error | descriptors seen (samples) | beyond streams and sockets |")
    print("|---|---|---|---|---|---|---|---|---|---|---|")
    worst_out = worst_err = bad = found = 0
    for c in cases:
        rs = [r for r in rows if r["case"] == c]
        rel = [r["relay"] for r in rs]
        ends = sorted({"%s %s" % (x["exit_code"], x["exit_word_of_the_code"]) if x["signal"] is None and x["exit_code"] is not None else (x["signal"] or "not observable (no parent)") for x in rel})
        words = sorted({str(x["exit_word_the_relay_wrote"]) for x in rel})
        shape = sum(x["stdout"]["lines_not_of_the_fixed_shape"] + x["stderr"]["lines_not_of_the_fixed_shape"] for x in rel)
        texts = sum(r["places"].get(k, {}).get("occurrences", 0) for r in rs for k in ("relay stdout", "relay stderr", "door copies", "door error"))
        pics, others = {}, {}
        for r in rs:
            for k, v in r["observed"]["descriptor_pictures"].items():
                pics[k] = pics.get(k, 0) + v
            for k, v in r["observed"].get("descriptors_beyond_the_standard_streams_and_network_sockets", {}).items():
                others[k] = others.get(k, 0) + v
        lib = sorted({str(exit_counter(r, "library_errors")) for r in rs})
        so, se = max(x["stdout_bytes"] for x in rel), max(x["stderr_bytes"] for x in rel)
        worst_out, worst_err, bad, found = max(worst_out, so), max(worst_err, se), bad + shape, found + texts
        print("| %s | %d | %s | %s | %d, %d | %d, %d | %d | %s | %d | %s | %s |" % (
            c, len(rs), "; ".join(ends), ", ".join(words), so, max(x["stdout"]["longest_line"] for x in rel), se, max(x["stderr"]["longest_line"] for x in rel), shape, ", ".join(lib), texts,
            "; ".join("%s (%d)" % kv for kv in sorted(pics.items())) or "none sampled", "; ".join("%s (%d)" % kv for kv in sorted(others.items())) or "none"))
    print("ROW159 HYGIENE: %d run(s) of %d case(s); lines not of the fixed shape: %d; texts of a start message in the relay's streams or a door error: %d; most bytes on standard output %d (report bound %d), on standard error %d (door copy bound %d)" % (
        len(rows), len(cases), bad, found, worst_out, REPORT_MAX, worst_err, DOOR_CAP))


if __name__ == "__main__":
    if sys.argv[1:2] == ["hygiene"]:
        hygiene()
    else:
        # Integration pass I-9a: the overall bound of ONE run, stated here and enforced by the engine (its alarm, and its
        # watchdog thread 20 s later): the longest case of this file is `end_camera_never_back` (6 tries, 62 s).
        S.main(sys.argv[1:], CASES, "ROW159 HYGIENE", bound_s=RUN_BOUND_S)
