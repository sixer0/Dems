#!/usr/bin/env python3
"""Task 4 blueprint row 44 (WP-03d, experiment E-12 extended; S13-02 (g); AD-09 (3)): THE SEARCH FOR THE FIXTURE
SECRET around a running capture relay. Test code only; an OBSERVATION: nothing of the product is changed or built.

    test camera (rtsp_test_camera.py)  ->  build/capture-relay, started by a stand-in of the Core
    (row044_door_parent.mts: the Core's own relay start and its production door, imported unchanged)
    ->  the release capture worker with a live session (cases marked W)

WHAT IS SEARCHED FOR (the texts of one run, held in this process and written nowhere): the camera's synthetic
account and password (imported from the test camera; the special-character account in its case; the wrong password
in its case), the stream locator and its path, the session's ingest address and its last element, the control
camera's last element, the hostile codec text in its case. Each text also in its JSON-escaped and its
percent-encoded form.

WHERE (a "place"), sampled about four times a second for the whole run where it is a process:
  relay args / relay env          `ps -o args= -ww` and `ps eww -o command=` of the relay
  core args / core env            the same of the stand-in of the Core (the relay's parent)
  worker args / worker env        the same of the capture worker
  relay stdout                    every byte the relay wrote there (its report lines), read beside the door
  relay stderr                    every byte the relay wrote there
  door copies                     the bounded copies the door hands the Core (`diagnostics`, `output`), `onOutput`
  door error                      what a refusal of the door shows in every printed form
  core stderr                     the standard error of the stand-in
  worker frames                   every line the worker wrote on its standard output
  worker log                      worker.jsonl
  worker files                    every other file the worker wrote (manifest, media)
  temporary files                 files that appeared during the run in /tmp, /private/var/tmp, the user's temporary
                                  folder and /cores (two levels deep, at most 8 MB each)
  relay open files                regular files and folders held by a descriptor of the relay (lsof)
The guard is not in the relay's chain (the adapter starts the relay itself: relay-start.ts `command: start.program`).

A CONTROL runs beside every case: a sleeping process with a planted text as an argument and another one in its
environment, read by the same sampler. A run whose control is not found proves nothing and says so.

    # repository root, command sandbox off (loopback 8559, 8561 worker; 8565 camera; ps, lsof); one run per lock hold
    /usr/bin/lockf -k -t 1800 .locks/heavy-host.lock python3 -B apps/capture-worker/test-fixtures/row044_e12_search.py run <case> <n>
    python3 -B apps/capture-worker/test-fixtures/row044_e12_search.py cases | summary

COUNT-ONLY: a result holds counts of occurrences per place and the number of samples, never a matched text.
Everything a run writes lands under .cache/row044-e12/ (git-ignored)."""
import base64, hashlib, json, os, re, resource, secrets, signal, subprocess, sys, threading, time, urllib.parse

sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", "..", ".."))

# ------------------------------------------------------------------------------------------------ the observed parent
if len(sys.argv) > 1 and sys.argv[1] == "_standin":
    # A parent whose relay writes into pipes that the OBSERVER holds: when this process is killed, what the relay
    # still writes can be read. It starts the relay as the door does (no argument, empty environment, a pipe as
    # standard input that only this process holds) and hands the start message on, byte for byte.
    out_fd, err_fd, relay = int(sys.argv[2]), int(sys.argv[3]), sys.argv[4]
    message = sys.stdin.buffer.readline()
    p = subprocess.Popen([relay], stdin=subprocess.PIPE, stdout=out_fd, stderr=err_fd, env={}, close_fds=True)
    os.close(out_fd)
    os.close(err_fd)
    p.stdin.write(message)
    p.stdin.flush()
    message = None
    sys.stdout.write("%d\n" % p.pid)
    sys.stdout.flush()
    while True:
        signal.pause()

OUT = os.environ.get("ROW44_OUT") or os.path.join(REPO, ".cache", "row044-e12")
os.environ.setdefault("M3_PORTS", "8559,8561")
os.environ["E11_OUT"] = OUT
sys.path.insert(0, HERE)
import e11_listener_path as E                            # read-only reuse: the worker session, the control pusher
import row041_relay as R                                 # read-only reuse: the camera start, the ingest names, the codes
import rtsp_test_camera as CAM                           # read-only: the synthetic accounts, the hostile codec text
H = E.H
R.OUT = OUT

PARENT = os.path.join(HERE, "row044_door_parent.mts")
RELAY, WORKER = R.RELAY, H.WORKER
DEAD_PORT = 8574                                         # nothing listens here (decision C33: the camera range)
ATTEMPT = 7
CODE_NAMES = {0: "STOPPED", 2: "USAGE", 10: "START_MESSAGE_INVALID", 11: "START_MESSAGE_TIMEOUT", 20: "CAMERA_UNREACHABLE", 21: "CAMERA_PROTOCOL", 22: "AUTH_SCHEME_NOT_ALLOWED",
              23: "AUTH_REFUSED", 24: "LOCATOR_NOT_FOUND", 25: "REDIRECT_REFUSED", 26: "CONTROL_ADDRESS_REFUSED", 27: "DESCRIPTION_INVALID", 28: "CODEC_NOT_SUPPORTED",
              31: "CAMERA_STALLED", 32: "CAMERA_LOST", 40: "INGEST_REFUSED", 41: "INGEST_LOST", 43: "REPORT_NOT_WRITTEN"}
WORD = re.compile(r"^[A-Za-z0-9_]{1,48}$")
TEMP_PLACES = ["/tmp", "/private/var/tmp", "/cores"]
try:
    TEMP_PLACES.append(os.confstr("CS_DARWIN_USER_TEMP_DIR").rstrip("/"))
except (ValueError, OSError):
    pass


def sha(path):
    try:
        return hashlib.sha256(open(path, "rb").read()).hexdigest()
    except OSError:
        return None


def binaries():
    """The hashes of the binaries observed, at the start of a run. Missing or changed against the first run of this
    folder: wait, retry once, then go on and SAY which build was observed."""
    os.makedirs(OUT, exist_ok=True)
    book = os.path.join(OUT, "hashes.json")
    first = json.load(open(book)) if os.path.exists(book) else None
    now = {"capture-relay": sha(RELAY), "capture-worker": sha(WORKER)}
    note = "as first seen"
    if None in now.values() or (first and now != first):
        time.sleep(45)
        again = {"capture-relay": sha(RELAY), "capture-worker": sha(WORKER)}
        note = "MISSING after one wait" if None in again.values() else ("CHANGED against the first run of this folder" if first and again != first else "stable after one wait")
        now = again
    if first is None and None not in now.values():
        json.dump(now, open(book, "w"))
    return {"sha256": now, "note": note}


# ------------------------------------------------------------------------------------------------ the texts, the counting
class Texts:
    """The texts of one run. `count` gives occurrences per NAME; no method gives a text back."""

    def __init__(self, **named):
        self._forms = {}
        for name, value in named.items():
            if value:
                forms = {value, json.dumps(value)[1:-1], json.dumps(value, ensure_ascii=False)[1:-1], urllib.parse.quote(value, safe=""), urllib.parse.quote(value, safe="/:")}
                self._forms[name] = sorted(forms)
        self.names = sorted(self._forms)

    def count(self, *blobs):
        whole = b"\n".join(b if isinstance(b, bytes) else str(b).encode("utf-8", "replace") for b in blobs if b)
        out = {}
        for name, forms in self._forms.items():
            # a longer form that contains a shorter one is not counted twice: the largest count of any form
            out[name] = max(whole.count(f.encode("utf-8")) for f in forms)
        return out

    def total(self, *blobs):
        return sum(self.count(*blobs).values())


def texts_of(ingest, locator, user, secret, **more):
    t = {"secret": secret, "account": user, "locator": locator, "locator_path": re.sub(r"^rtsp://[^/]*", "", locator)}
    if ingest:
        t.update(ingest=ingest, ingest_element=ingest.rsplit("/", 1)[1])
    t.update(more)
    return Texts(**t)


class Place(dict):
    """occurrences and samples of one place."""

    def add(self, name, occurrences, samples=1):
        cur = self.setdefault(name, {"occurrences": 0, "samples": 0})
        cur["occurrences"] += occurrences
        cur["samples"] += samples


# ------------------------------------------------------------------------------------------------ the sampler
class Sampler:
    """Reads `ps` (arguments; arguments and environment) of every watched process and `lsof` of the relay, until ended."""

    def __init__(self, texts, places, every=0.2):
        self.texts, self.places, self.every = texts, places, every
        self.pids, self.stop, self.lock = {}, threading.Event(), threading.Lock()
        self.fd_pictures, self.peers, self.regular, self.max_sockets, self.lsof_samples = {}, {}, 0, 0, 0
        self.listening, self.words, self.env_seen, self.others = 0, {}, {}, {}
        self.control_texts = {"arg": "ROW44CONTROLARG" + secrets.token_hex(8), "env": "ROW44CONTROLENV" + secrets.token_hex(8)}
        self.control_found = {"args": 0, "env": 0, "samples": 0}
        self.control = H.spawn([sys.executable, "-c", "import time; time.sleep(600)", self.control_texts["arg"]], env={"ROW44_CONTROL": self.control_texts["env"]},
                               stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        self.thread = threading.Thread(target=self._run, daemon=True)
        self.thread.start()

    def watch(self, role, pid):
        if pid:
            self.pids[role] = int(pid)
            self.once()                                      # at once: a relay of a refusal lives for milliseconds

    def _run(self):
        while not self.stop.is_set():
            t = time.monotonic()
            self.once()
            self.stop.wait(max(0.02, self.every - (time.monotonic() - t)))

    def once(self):
        with self.lock:
            self._once()

    def _once(self):
        for role, pid in sorted(self.pids.items(), key=lambda kv: kv[0] != "relay"):
            args = H.sh(["ps", "-o", "args=", "-ww", "-p", str(pid)]).stdout
            both = H.sh(["ps", "eww", "-o", "command=", "-p", str(pid)]).stdout
            if args.strip():
                self.places.add("%s args" % role, self.texts.total(args))
                self.words[role] = max(self.words.get(role, 0), len(args.split()))
            if both.strip():
                self.places.add("%s env" % role, self.texts.total(both))
                self.env_seen[role] = max(self.env_seen.get(role, 0), len(both.split()) - len(args.split()))
        c = str(self.control.pid)
        a, b = H.sh(["ps", "-o", "args=", "-ww", "-p", c]).stdout, H.sh(["ps", "eww", "-o", "command=", "-p", c]).stdout
        self.control_found["samples"] += 1
        self.control_found["args"] += a.count(self.control_texts["arg"])
        self.control_found["env"] += b.count(self.control_texts["env"])
        pid = self.pids.get("relay")
        if pid:
            rows = [l.split(None, 8) for l in H.sh(["lsof", "-nP", "-p", str(pid)]).stdout.splitlines()[1:]]
            rows = [r for r in rows if len(r) >= 5 and r[1] == str(pid)]
            if rows:
                self.lsof_samples += 1
                fds = [r for r in rows if re.match(r"^\d+", r[3])]
                picture = " ".join(sorted("%s:%s" % (re.match(r"^\d+", r[3]).group(0), r[4]) for r in fds))
                self.fd_pictures[picture] = self.fd_pictures.get(picture, 0) + 1
                socks = [r for r in fds if r[4] in ("IPv4", "IPv6")]     # the door's three pipes are local socket pairs (type unix): in the picture, not here
                self.max_sockets = max(self.max_sockets, len(socks))
                for r in fds:                                # anything that is neither a standard stream nor a network socket: its type and lsof's name
                    if r[4] not in ("IPv4", "IPv6") and int(re.match(r"^\d+", r[3]).group(0)) > 2:
                        what = "%s %s" % (r[4], re.sub(r"\d+", "N", r[8] if len(r) > 8 else "?"))
                        self.others[what] = self.others.get(what, 0) + 1
                held = [r for r in fds if r[4] in ("REG", "DIR")]
                self.regular += len(held)
                for r in socks:
                    name = r[8] if len(r) > 8 else "?"
                    if "LISTEN" in name:
                        self.listening += 1
                    peer = name.split("->")[-1].split(" ")[0] if "->" in name else "not-connected"
                    self.peers[peer] = self.peers.get(peer, 0) + 1
                self.places.add("relay open files", len(held))

    def end(self):
        self.stop.set()
        self.thread.join(5)
        try:
            os.killpg(self.control.pid, signal.SIGKILL)
        except (ProcessLookupError, PermissionError):
            pass
        self.control.wait()
        return {"descriptor_pictures": self.fd_pictures, "descriptors_beyond_the_standard_streams_and_network_sockets": self.others, "socket_peers": self.peers, "most_sockets_in_a_sample": self.max_sockets, "listening_sockets_seen": self.listening,
                "regular_files_or_folders_held": self.regular, "lsof_samples": self.lsof_samples, "argument_words": self.words, "environment_words_shown": self.env_seen,
                "control": dict(self.control_found, works=self.control_found["args"] > 0 and self.control_found["env"] > 0)}


# ------------------------------------------------------------------------------------------------ the relay behind the Core's door
class DoorRelay:
    """One relay started by the stand-in of the Core (the real door). `parent` is the Node process."""

    def __init__(self, d, mode, locator, user, secret, ingest="", attempt=ATTEMPT, args=None, core_limit=0):
        self.d, self.t0 = d, time.monotonic()
        self.out, self.err, self.door_out = b"", b"", b""
        self.events, self.chunks, self.ended, self.pid = [], [], None, None
        self.started, self.spawned, self.threw, self.bound_event, self.core_limit = None, None, None, None, None

        def limits():
            hard = resource.getrlimit(resource.RLIMIT_CORE)[1]
            resource.setrlimit(resource.RLIMIT_CORE, (core_limit if core_limit is not None else hard, hard))

        self.parent_err = os.path.join(d, "core-stand-in.err")
        self.parent = H.spawn(["node", "--import", "tsx", PARENT], cwd=REPO, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=open(self.parent_err, "ab"), preexec_fn=limits)
        cfg = {"program": RELAY, "mode": mode, "locator": locator, "username": user, "secret": secret, "ingest": ingest, "attempt": attempt}
        if args:
            cfg["args"] = list(args)
        self.reader = threading.Thread(target=self._read, daemon=True)
        self.reader.start()
        self.parent.stdin.write((json.dumps(cfg) + "\n").encode())
        self.parent.stdin.flush()

    def _read(self):
        for line in self.parent.stdout:
            try:
                e = json.loads(line)
            except ValueError:
                continue
            t, ev = time.monotonic(), e.get("ev")
            if ev in ("out", "err", "door_out"):
                data = base64.b64decode(e["b"])
                setattr(self, ev, getattr(self, ev) + data)
                self.chunks.append((t, ev, len(data)))
            elif ev == "pid":
                self.pid = e.get("pid")
            elif ev == "spawned":
                self.spawned = {k: v for k, v in e.items() if k != "ev"}
            elif ev == "started":
                self.started = e
            elif ev == "threw":
                self.threw = e
            elif ev == "bound":
                self.bound_event = (t, e.get("alive"))
            elif ev == "core_file_limit":
                self.core_limit = e.get("soft")
            elif ev == "ended":
                e["t"] = t
                self.ended = e
            self.events.append((t, ev))

    def say(self, word):
        try:
            self.parent.stdin.write((word + "\n").encode())
            self.parent.stdin.flush()
        except OSError:
            pass

    def until(self, test, timeout):
        end = time.monotonic() + timeout
        while time.monotonic() < end:
            if test():
                return time.monotonic()
            time.sleep(0.005)
        return None

    def saw(self, text, timeout, stream="out"):
        return self.until(lambda: text in getattr(self, stream), timeout)

    def wait_pid(self, timeout=20):
        return self.until(lambda: self.pid is not None or self.ended is not None, timeout)

    def wait_ended(self, timeout):
        return self.until(lambda: self.ended is not None, timeout)

    def finish(self):
        """The stand-in ends; a relay still there is killed by it (and said)."""
        forced = self.ended is None
        if forced and self.parent.poll() is None:
            self.say("kill")
            self.wait_ended(5)
        self.say("quit")
        try:
            self.parent.wait(timeout=5)
        except subprocess.TimeoutExpired:
            os.killpg(self.parent.pid, signal.SIGKILL)
            self.parent.wait()
        self.reader.join(3)
        return forced


def alive(pid):
    if not pid:
        return False
    r = H.sh(["ps", "-o", "stat=", "-p", str(pid)]).stdout.strip()
    return bool(r) and not r.startswith("Z")


def relays_alive():
    """Every live process of this host whose program is OUR relay binary (by its absolute path)."""
    rows = H.sh(["ps", "-axo", "pid=,stat=,command="]).stdout.splitlines()
    return [int(l.split(None, 2)[0]) for l in rows if len(l.split(None, 2)) == 3 and not l.split(None, 2)[1].startswith("Z") and l.split(None, 2)[2].strip().split(" ")[0] == RELAY]


def stderr_shape(err):
    """S13-02 (a): codes and counters only. Every line a JSON object whose values are numbers, booleans or one word."""
    lines = [l for l in err.decode("utf-8", "replace").split("\n") if l]
    bad, keys, events, exit_line = 0, set(), [], {}
    for l in lines:
        try:
            o = json.loads(l)
        except ValueError:
            bad += 1
            continue
        if not isinstance(o, dict) or not all((isinstance(v, (int, bool)) and not isinstance(v, float)) or (isinstance(v, str) and WORD.match(v)) for v in o.values()):
            bad += 1
            continue
        keys |= set(o)
        events.append(o.get("relay"))
        if o.get("relay") == "exit":
            exit_line = o
    return {"lines": len(lines), "lines_not_of_the_fixed_shape": bad, "longest_line": max([len(l) for l in lines] or [0]), "events": events, "exit_line": exit_line, "members": sorted(keys)}


def stdout_shape(out):
    text = out.decode("utf-8", "replace")
    lines = [l for l in text.split("\n") if l]
    reports, bad = [], 0
    for l in lines:
        try:
            o = json.loads(l)
            ok = isinstance(o, dict) and all(isinstance(v, (int, bool)) or (isinstance(v, str) and re.match(r"^[A-Za-z0-9_]{0,4096}$", v)) for v in o.values())
        except ValueError:
            ok, o = False, {}
        bad += 0 if ok else 1
        reports.append(o.get("report") if ok else "?")
    return {"lines": len(lines), "lines_not_of_the_fixed_shape": bad, "longest_line": max([len(l) for l in lines] or [0]), "reports": reports, "ends_with_line_feed": text == "" or text.endswith("\n")}


def temp_listing():
    seen = {}
    for top in TEMP_PLACES:
        if not os.path.isdir(top):
            continue
        for root, dirs, files in os.walk(top):
            depth = root[len(top):].count(os.sep)
            if depth >= 2:
                dirs[:] = []
            for f in files:
                p = os.path.join(root, f)
                try:
                    s = os.lstat(p)
                    seen[p] = (s.st_mtime, s.st_size)
                except OSError:
                    pass
    return seen


def temp_scan(before, texts, places):
    after = temp_listing()
    new = [p for p, (m, s) in after.items() if (p not in before or before[p] != (m, s)) and s <= 8 * 1024 * 1024]
    read = 0
    for p in new:
        try:
            if os.path.isfile(p) and not os.path.islink(p):
                data = open(p, "rb").read()
                read += 1
                places.add("temporary files", texts.total(data))
        except OSError:
            pass
    if not read:
        places.add("temporary files", 0, 0)
    cores = [p for p in after if p.startswith("/cores/") and p not in before]
    return {"files_new_or_changed": len(new), "files_read": read, "core_files_new": len(cores)}


def files_scan(d, texts, places, product, harness_note):
    """Every file of the run folder: the worker's and the stand-in's are places; the doubles' own files are counted apart."""
    apart = {}
    for root, _, files in os.walk(d):
        for f in files:
            p = os.path.join(root, f)
            rel = os.path.relpath(p, d)
            if os.path.islink(p) or not os.path.isfile(p):   # the harness' microphone inputs are named pipes: never opened
                continue
            data = open(p, "rb").read()
            n = texts.total(data)
            place = product(rel)
            if place:
                places.add(place, n)
            else:
                apart[rel] = n
    harness_note.update(apart)


def product_place(rel):
    if rel == "worker.jsonl":
        return "worker log"
    if rel == "core-stand-in.err":
        return "core stderr"
    if rel in ("relay.stdout", "relay.stderr"):
        return None                                      # counted from memory as their own places; kept for the count-only scan
    if rel.startswith("media" + os.sep) or rel in ("manifest.jsonl",) or rel.endswith((".mp4", ".m4a", ".part")):
        return "worker files"
    return None


def needle_scan(d):
    """The repository's count-only scan (scripts/secret-scan) over the run folder: counts per needle and file names."""
    r = H.sh(["node", os.path.join(REPO, "scripts", "secret-scan", "count-only.mjs"), d], cwd=REPO)
    hits = {}
    for l in (r.stdout + r.stderr).splitlines():
        m = re.search(r"([a-z-]+): (\d+)", l)
        if m and int(m.group(2)):
            hits[l.strip()[:200]] = int(m.group(2))
    return {"exit": r.returncode, "lines_with_a_count_above_0": hits}


# ------------------------------------------------------------------------------------------------ one run
def collect(d, relay, texts, places, sampler_facts, extra, before, worker_raw=None, t_kill=None):
    """Everything of one run into its result. Counts only."""
    places.add("relay stdout", texts.total(relay.out))
    places.add("relay stderr", texts.total(relay.err))
    ended = relay.ended or {}
    diag, outp = base64.b64decode(ended.get("diagnostics") or ""), base64.b64decode(ended.get("output") or "")
    places.add("door copies", texts.total(diag, outp, relay.door_out), 3)
    err_text = ((relay.started or {}).get("all_text") or "") + ((relay.threw or {}).get("all_text") or "")
    places.add("door error", texts.total(err_text), 1 if err_text else 0)
    if worker_raw is not None:
        places.add("worker frames", texts.total("\n".join(worker_raw)), len(worker_raw))
    open(os.path.join(d, "relay.stdout"), "wb").write(relay.out)
    open(os.path.join(d, "relay.stderr"), "wb").write(relay.err)
    harness = {}
    files_scan(d, texts, places, product_place, harness)
    temp = temp_scan(before, texts, places)
    shape_err, shape_out = stderr_shape(relay.err), stdout_shape(relay.out)
    late = None
    if t_kill is not None:
        late = {"bytes_on_standard_output_after_the_kill": sum(n for t, ev, n in relay.chunks if ev == "out" and t > t_kill),
                "bytes_on_standard_error_after_the_kill": sum(n for t, ev, n in relay.chunks if ev == "err" and t > t_kill)}
    code = ended.get("exitCode")
    res = {
        "places": places,
        "occurrences_total": sum(v["occurrences"] for v in places.values()),
        "texts_searched": texts.names,
        "relay": {"exit_code": code, "signal": ended.get("signal"), "exit_word_of_the_code": CODE_NAMES.get(code), "exit_word_the_relay_wrote": shape_err["exit_line"].get("code"),
                  "exit_line_members": sorted(shape_err["exit_line"]), "spawn_failed": ended.get("spawnFailed"),
                  "stdout_bytes": len(relay.out), "stderr_bytes": len(relay.err), "door_diagnostics_bytes": len(diag), "door_output_bytes": len(outp),
                  "stdout": shape_out, "stderr": {k: v for k, v in shape_err.items() if k != "exit_line"},
                  "door_start": {"ok": (relay.started or {}).get("ok"), "error_name": (relay.started or {}).get("name"), "error_code": (relay.started or {}).get("code"),
                                 "error_has_cause": (relay.started or {}).get("has_cause"), "error_own_members": (relay.started or {}).get("own_members")},
                  "door_spawn_call": relay.spawned, "core_file_limit_the_door_read": relay.core_limit},
        "observed": sampler_facts, "temporary": temp, "files_of_the_doubles_counted_apart": harness, "late": late, "extra": extra,
    }
    return res


def finish(name, case, n, res, t0, hashes, d):
    time.sleep(0.4)
    res["relays_alive_after"] = len(relays_alive())
    res["leftovers"] = H.leftovers()
    for pid, _ in H.own_processes():                         # reported above as left; nothing this run started stays
        try:
            os.kill(pid, signal.SIGKILL)
        except (ProcessLookupError, PermissionError):
            pass
    res["count_only_scan"] = needle_scan(d)
    res.update(run=name, case=case, n=n, seconds=round(time.monotonic() - t0, 1), binaries=hashes, utc=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), load=os.getloadavg()[0])
    ok = res["occurrences_total"] == 0 and res["observed"]["control"]["works"] and res["relays_alive_after"] == 0 and not res["leftovers"]["processes"] and not res["leftovers"]["listeners"]
    res["verdict"] = "PASS" if ok and res.get("as_expected", True) else ("FINDING" if res["occurrences_total"] else "FAIL")
    json.dump(res, open(os.path.join(d, "result.json"), "w"), indent=1, default=str)
    print(line(res))
    return res


def with_worker(case, n, camera_extra, make, act, expect, account="plain", codec="h264", sets="sdp", wrong_ingest=False, listen_s=None):
    """One worker session: camera 1 through the relay behind the door, camera 2 the control pusher."""
    name = "%s_%d" % (case, n)
    hashes, t0 = binaries(), time.monotonic()
    E.RIGHT = R.ingest_names()
    port, cport = H.PORTS
    ingest = E.url(port, E.RIGHT[0])
    given = E.url(port, E.RIGHT[0].rsplit("/", 1)[0] + "/" + secrets.token_urlsafe(16)) if wrong_ingest else ingest
    user, secret = (CAM.SPECIAL_ACCOUNT_USER, CAM.SPECIAL_ACCOUNT_PASSWORD) if account == "special" else (CAM.ACCOUNT_USER, CAM.ACCOUNT_PASSWORD)
    keep = {}
    before = temp_listing()

    def script(ctx):
        d = ctx["d"]
        cam, log, path = R.camera_start(d, codec, sets, 0, tuple(camera_extra) + (("--account", "special") if account == "special" else ()))
        ctx["procs"].append(cam)
        locator = "rtsp://127.0.0.1:%d%s" % (R.CAMERA_PORT, path)
        more = {"control_element": E.RIGHT[1].rsplit("/", 1)[1], "right_ingest_element": E.RIGHT[0].rsplit("/", 1)[1]}
        spec = make(locator, user, secret, given)
        more.update(spec.pop("texts", {}))
        texts = texts_of(given, locator, user, spec.get("secret", secret), **more)
        places = Place()
        sampler = Sampler(texts, places)
        sampler.watch("worker", ctx["worker"].p.pid)
        control = E.Push(d, "control", cport, E.RIGHT[1], ctx["t0"], frames=R.FRAMES)
        relay = spec["start"](d)
        ctx["procs"].append(relay.parent)
        if hasattr(relay, "extra_procs"):
            ctx["procs"].extend(relay.extra_procs)
        sampler.watch("core", relay.parent.pid)
        relay.wait_pid()
        sampler.watch("relay", relay.pid)
        extra = act(ctx, relay, {"cam": cam, "camera_log": log, "sampler": sampler, "port": port}) or {}
        relay.wait_ended(25)
        extra["relay_had_to_be_killed_by_the_run"] = relay.finish()
        control.wait()
        time.sleep(0.5)
        keep.update(texts=texts, places=places, relay=relay, sampler=sampler.end(), extra=extra, camera=R.camera_end(cam, log), worker=ctx["worker"])
        return {"case": case, "observation": "ROW41", "port_under_test": port, "control": {"port": cport, "path": "", "rc": control.rc, "rtsp_error_statuses": []}, "paths_used": []}

    kw = {"listen_s": listen_s} if listen_s else {}
    r = E.session(name, script, **kw)
    d = os.path.join(OUT, "runs", name)
    for f in ("control.log", "result.json"):                 # the control pusher's FFmpeg trace and the harness' result hold the control's address
        if os.path.exists(os.path.join(d, f)):
            os.remove(os.path.join(d, f))
    w = keep["worker"]
    with w.lock:
        raw = list(w.raw)
    res = collect(d, keep["relay"], keep["texts"], keep["places"], keep["sampler"], keep["extra"], before, worker_raw=raw, t_kill=keep["extra"].get("t_kill"))
    log = H.worker_log(d)
    res["worker"] = {"rc": r.get("worker_rc"), "ingest_connected_port1": sum(1 for c in r["worker_ingest_connected"] if c["port"] == port), "file_bytes": r["files"][str(port)]["bytes"],
                     "gate_refusals": sum(1 for l in log if str(l.get("message", "")).startswith("INGEST_ANNOUNCE")), "frames_lines": len(raw), "log_lines": len(log),
                     "control_recorded": r["files"][str(cport)]["bytes"] > 0}
    res["camera"] = {"requests_by_authentication_class": keep["camera"]["requests_by_authentication_class"], "counters": keep["camera"]["counters"]}
    res["as_expected"] = bool(expect(res))
    return finish(name, case, n, res, t0, hashes, d)


def without_worker(case, n, camera_extra, make, act, expect, account="plain", camera=True, codec="h264", sets="sdp"):
    name = "%s_%d" % (case, n)
    hashes, t0 = binaries(), time.monotonic()
    d = os.path.join(OUT, "runs", name)
    if os.path.isdir(d):
        import shutil
        shutil.rmtree(d)
    os.makedirs(d)
    user, secret = (CAM.SPECIAL_ACCOUNT_USER, CAM.SPECIAL_ACCOUNT_PASSWORD) if account == "special" else (CAM.ACCOUNT_USER, CAM.ACCOUNT_PASSWORD)
    ingest = E.url(H.PORTS[0], R.ingest_names()[0])          # nobody listens there in these runs
    before = temp_listing()
    procs, cam, log, camfacts = [], None, None, {}
    try:
        if camera:
            cam, log, path = R.camera_start(d, codec, sets, 0, tuple(camera_extra) + (("--account", "special") if account == "special" else ()))
            procs.append(cam)
            locator = "rtsp://127.0.0.1:%d%s" % (R.CAMERA_PORT, path)
        else:
            locator = "rtsp://127.0.0.1:%d%s" % (DEAD_PORT, CAM.DEFAULT_PATH)
        spec = make(locator, user, secret, ingest)
        texts = texts_of(ingest if spec.get("mode", "record") == "record" else "", locator, user, spec.get("secret", secret), **spec.pop("texts", {}))
        places = Place()
        sampler = Sampler(texts, places)
        relay = spec["start"](d)
        procs.append(relay.parent)
        sampler.watch("core", relay.parent.pid)
        relay.wait_pid()
        sampler.watch("relay", relay.pid)
        extra = act({"d": d, "procs": procs}, relay, {"cam": cam, "camera_log": log, "sampler": sampler}) or {}
        relay.wait_ended(40)
        extra["relay_had_to_be_killed_by_the_run"] = relay.finish()
        time.sleep(0.3)
        facts = sampler.end()
        if cam:
            camfacts = R.camera_end(cam, log)
    finally:
        H.killall(procs)
        H.killall(H.OWN)
    res = collect(d, relay, texts, places, facts, extra, before, t_kill=extra.get("t_kill"))
    res["camera"] = {"requests_by_authentication_class": camfacts.get("requests_by_authentication_class"), "counters": camfacts.get("counters")}
    res["as_expected"] = bool(expect(res))
    return finish(name, case, n, res, t0, hashes, d)


# ------------------------------------------------------------------------------------------------ the cases
def door(mode="record", secret=None, args=None, core_limit=0):
    def make(locator, user, real, ingest):
        s = secret or real
        spec = {"mode": mode, "secret": s, "start": lambda d: DoorRelay(d, mode, locator, user, s, ingest if mode == "record" else "", args=args, core_limit=core_limit)}
        if secret:
            spec["texts"] = {"real_secret": real}
        return spec
    return make


def code_is(*codes):
    return lambda res: res["relay"]["exit_code"] in codes and res["relay"]["signal"] is None


DROP = ("--drop-after-frames", "60", "--drop-count", "1", "--drop-style", "fin", "--first-keyframe-delay-ms", "400", "--first-keyframe-fill", "inter")
SLOW = ("--adversary", "slow-answers", "--adversary-delay-ms", "1200")      # a refusal that takes seconds: the relay can be sampled while it holds the account
LATE_KEYFRAME = ("--first-keyframe-delay-ms", "45000", "--first-keyframe-fill", "inter")


def act_reopen(ctx, relay, o):
    seen = {"push_established": relay.saw(b'"report":"push_established"', 20) is not None, "camera_lost": relay.saw(b'"report":"camera_lost"', 30) is not None,
            "camera_reopened": relay.saw(b'"report":"camera_reopened"', 30) is not None}
    time.sleep(2.0)
    relay.say("end")
    return {"lines_seen": seen}


def act_stop_after(seconds):
    def act(ctx, relay, o):
        seen = relay.saw(b'"report":"push_established"', 20) is not None
        time.sleep(seconds)
        relay.say("end")
        return {"lines_seen": {"push_established": seen}}
    return act


def act_wait(ctx, relay, o):
    return {}


def act_parent_killed(ctx, relay, o):
    """The parent is killed while the relay WAITS between a loss and its first try (2 s)."""
    est = relay.saw(b'"report":"push_established"', 20)
    lost = relay.saw(b'"report":"camera_lost"', 30)
    time.sleep(0.7)
    requests_before = sum(1 for _ in open(o["camera_log"])) if os.path.exists(o["camera_log"]) else -1
    in_wait = alive(relay.pid)
    t_kill = time.monotonic()
    os.kill(relay.parent.pid, signal.SIGKILL)
    gone = relay.until(lambda: not alive(relay.pid), 10)
    time.sleep(6.5)                                          # past the moments of the first two tries (2 s, 4 s after the loss)
    requests_after = sum(1 for _ in open(o["camera_log"])) if os.path.exists(o["camera_log"]) else -1
    relay.ended = relay.ended or {"exitCode": None, "signal": None, "spawnFailed": False, "diagnostics": "", "output": "", "t": gone}
    return {"lines_seen": {"push_established": est is not None, "camera_lost": lost is not None}, "relay_alive_in_the_wait_before_the_kill": in_wait, "t_kill": t_kill,
            "ms_from_the_kill_to_no_relay": None if gone is None else round((gone - t_kill) * 1000), "seconds_from_the_loss_line_to_the_kill": None if lost is None else round(t_kill - lost, 2),
            "camera_journal_lines_added_after_the_kill": requests_after - requests_before, "relay_alive_6_s_later": alive(relay.pid)}


class ObservedRelay:
    """A relay whose parent is a small process of this script and whose two output pipes THIS process holds:
    what the relay writes after its parent was killed is read here. Same members as DoorRelay."""

    def __init__(self, d, locator, user, secret, ingest):
        self.d, self.out, self.err, self.door_out, self.chunks = d, b"", b"", b"", []
        self.started, self.threw, self.spawned, self.core_limit, self.ended = None, None, {"by": "the observed stand-in, not the door"}, None, None
        out_r, out_w = os.pipe()
        err_r, err_w = os.pipe()
        self.parent_err = os.path.join(d, "core-stand-in.err")
        self.parent = H.spawn([sys.executable, "-B", os.path.abspath(__file__), "_standin", str(out_w), str(err_w), RELAY], stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                              stderr=open(self.parent_err, "ab"), pass_fds=(out_w, err_w), preexec_fn=lambda: resource.setrlimit(resource.RLIMIT_CORE, (0, resource.getrlimit(resource.RLIMIT_CORE)[1])))
        os.close(out_w)
        os.close(err_w)
        self.eof = {"out": None, "err": None}
        self.readers = [threading.Thread(target=self._read, args=(n, fd), daemon=True) for n, fd in (("out", out_r), ("err", err_r))]
        for t in self.readers:
            t.start()
        self.parent.stdin.write(R.start_message(ingest, locator, user, secret, attempt=ATTEMPT))
        self.parent.stdin.flush()
        self.pid = int(self.parent.stdout.readline().decode().strip() or 0)

    def _read(self, name, fd):
        while True:
            data = os.read(fd, 65536)
            if not data:
                break
            setattr(self, name, getattr(self, name) + data)
            self.chunks.append((time.monotonic(), name, len(data)))
        self.eof[name] = time.monotonic()
        os.close(fd)

    until, saw = DoorRelay.until, DoorRelay.saw

    def wait_pid(self, timeout=0):
        return True

    def wait_ended(self, timeout):
        return self.until(lambda: self.eof["out"] and self.eof["err"], timeout)

    def say(self, word):
        pass

    def finish(self):
        forced = False
        if self.parent.poll() is None:
            os.killpg(self.parent.pid, signal.SIGKILL)
            forced = True
        self.parent.wait()
        for t in self.readers:
            t.join(3)
        return forced and alive(self.pid)


def observed(mode="record"):
    def make(locator, user, real, ingest):
        return {"mode": "record", "secret": real, "start": lambda d: ObservedRelay(d, locator, user, real, ingest)}
    return make


def act_parent_killed_observed(ctx, relay, o):
    r = act_parent_killed(ctx, relay, o)
    relay.wait_ended(5)
    r["both_output_pipes_reached_their_end"] = bool(relay.eof["out"] and relay.eof["err"])
    r["ms_from_the_kill_to_the_end_of_both_pipes"] = None if not r["both_output_pipes_reached_their_end"] else round((max(relay.eof["out"], relay.eof["err"]) - r["t_kill"]) * 1000)
    return r


def act_bound(ms):
    def act(ctx, relay, o):
        relay.say("bound %d" % ms)
        t0 = time.monotonic()
        relay.until(lambda: relay.bound_event is not None or relay.ended is not None, ms / 1000 + 5)
        at = relay.bound_event
        relay.wait_ended(5)
        return {"relay_alive_when_the_bound_fired": None if at is None else at[1], "seconds_to_the_bound": None if at is None else round(at[0] - t0, 2),
                "ms_from_the_kill_to_the_end": None if at is None or relay.ended is None else round((relay.ended["t"] - at[0]) * 1000), "t_kill": None if at is None else at[0],
                "push_established_before_the_bound": b"push_established" in relay.out}
    return act


def act_abort(after_s):
    def act(ctx, relay, o):
        time.sleep(after_s)
        was = alive(relay.pid)
        t = time.monotonic()
        relay.say("kill")
        relay.wait_ended(5)
        return {"relay_alive_before_the_kill": was, "t_kill": t, "ms_from_the_kill_to_the_end": None if relay.ended is None else round((relay.ended["t"] - t) * 1000),
                "push_established_before_the_kill": b"push_established" in relay.out}
    return act


def killed(res):
    return res["relay"]["signal"] == "SIGKILL" and res["relay"]["exit_code"] is None


def parent_killed_ok(res):
    x = res["extra"]
    return bool(x["relay_alive_in_the_wait_before_the_kill"] and x["ms_from_the_kill_to_no_relay"] is not None and not x["relay_alive_6_s_later"] and x["camera_journal_lines_added_after_the_kill"] == 0)


def reports(*names):
    return lambda res: res["relay"]["stdout"]["reports"] == list(names) and res["relay"]["exit_code"] == 0


CASES = {
    # name: (runner, keyword arguments)
    "record_reopen": (with_worker, dict(camera_extra=DROP, make=door(), act=act_reopen, expect=reports("push_established", "camera_lost", "camera_reopened"))),
    "record_special_account": (with_worker, dict(camera_extra=(), make=door(), act=act_stop_after(3.0), expect=reports("push_established"), account="special", codec="hevc", sets="inband")),
    "probe": (without_worker, dict(camera_extra=("--first-keyframe-delay-ms", "2500", "--first-keyframe-fill", "inter"), make=door("probe"), act=act_wait, expect=reports("probe"))),
    "probe_special_account": (without_worker, dict(camera_extra=(), make=door("probe"), act=act_wait, expect=reports("probe"), account="special")),
    "probe_wrong_password": (without_worker, dict(camera_extra=SLOW, make=door("probe", secret=R.WRONG), act=act_wait, expect=code_is(23))),
    "wrong_password": (with_worker, dict(camera_extra=SLOW, make=door(secret=R.WRONG), act=act_wait, expect=code_is(23))),
    "basic_only": (with_worker, dict(camera_extra=("--challenge", "basic") + SLOW, make=door(), act=act_wait, expect=code_is(22))),
    "hostile_description": (with_worker, dict(camera_extra=("--sdp-codec", "hostile") + SLOW, make=lambda l, u, s, i: dict(door()(l, u, s, i), texts={"hostile_codec_text": CAM.hostile_codec_name("H264"), "hostile_markup": CAM.HOSTILE_CODEC_MARKUP}),
                                              act=act_wait, expect=code_is(27, 28))),
    "wrong_path_push": (with_worker, dict(camera_extra=(), make=door(), act=act_wait, expect=code_is(40), wrong_ingest=True)),
    "unreachable": (without_worker, dict(camera_extra=(), make=door(), act=act_wait, expect=code_is(20), camera=False)),
    "parent_killed_in_retry_wait": (with_worker, dict(camera_extra=DROP, make=door(), act=act_parent_killed, expect=parent_killed_ok)),
    "parent_killed_observed": (with_worker, dict(camera_extra=DROP, make=observed(), act=act_parent_killed_observed, expect=parent_killed_ok)),
    "stopped_at_the_25_s_bound": (without_worker, dict(camera_extra=LATE_KEYFRAME, make=door(), act=act_bound(25000), expect=lambda res: killed(res) and res["extra"]["relay_alive_when_the_bound_fired"] is True)),
    "aborted_open": (without_worker, dict(camera_extra=LATE_KEYFRAME, make=door(), act=act_abort(1.5), expect=lambda res: killed(res) and res["extra"]["relay_alive_before_the_kill"])),
}


def line(r):
    p = r["places"]
    worst = sorted((k for k, v in p.items() if v["occurrences"]), key=str)
    rel = r["relay"]
    return "%-7s %-34s exit %s%s  occurrences %d in %d places (%d samples)%s  control %s  relays left %d  %ss" % (
        r["verdict"], r["run"], rel["exit_code"], "/" + rel["signal"] if rel["signal"] else "", r["occurrences_total"], len(p), sum(v["samples"] for v in p.values()),
        "  IN: " + ", ".join(worst) if worst else "", "ok" if r["observed"]["control"]["works"] else "NOT FOUND", r["relays_alive_after"], r["seconds"])


def results(cases=None):
    rows = []
    base = os.path.join(OUT, "runs")
    for name in sorted(os.listdir(base)) if os.path.isdir(base) else []:
        p = os.path.join(base, name, "result.json")
        if os.path.exists(p):
            r = json.load(open(p))
            if "places" in r and (cases is None or r.get("case") in cases):
                rows.append(r)
    return rows


def summary(cases=None, title="ROW44 E-12"):
    rows = results(cases)
    order = [c for c in (cases or CASES) if any(r["case"] == c for r in rows)]
    places = sorted({k for r in rows for k in r["places"]})
    print("occurrences / samples, summed over the runs of a case (runs in brackets)")
    print("| place | " + " | ".join("%s (%d)" % (c, sum(r["case"] == c for r in rows)) for c in order) + " |")
    print("|---|" + "---|" * len(order))
    for pl in places:
        cells = []
        for c in order:
            rs = [r["places"][pl] for r in rows if r["case"] == c and pl in r["places"]]
            cells.append("%d / %d" % (sum(x["occurrences"] for x in rs), sum(x["samples"] for x in rs)) if rs else "-")
        print("| %s | %s |" % (pl, " | ".join(cells)))
    for r in rows:
        print(line(r))
    print("%s: %d run(s), %d PASS, %d FAIL, %d FINDING; occurrences in all places of all runs: %d; relays left: %d; controls found: %d of %d" % (
        title, len(rows), sum(r["verdict"] == "PASS" for r in rows), sum(r["verdict"] == "FAIL" for r in rows), sum(r["verdict"] == "FINDING" for r in rows),
        sum(r["occurrences_total"] for r in rows), sum(r["relays_alive_after"] for r in rows), sum(r["observed"]["control"]["works"] for r in rows), len(rows)))
    return rows


RUN_BOUND_S = 300                                        # ONE run never holds the host's lock for longer: five minutes
RUN_BOUND_GRACE_S = 20                                   # then the watchdog thread ends the process, whatever the main thread does


def run_bound_s(asked=None):
    """The overall bound of ONE run in seconds (integration pass I-9a): RUN_BOUND_S, or LESS when the caller or the
    variable ROW44_RUN_BOUND_S asks for less. Never more: a value that is no whole number of at least 1 is ignored."""
    wanted = [RUN_BOUND_S]
    for value in (asked, os.environ.get("ROW44_RUN_BOUND_S")):
        try:
            if value is not None and int(value) >= 1:
                wanted.append(int(value))
        except ValueError:
            pass
    return min(wanted)


def main(argv, cases=CASES, title="ROW44 E-12", bound_s=None):
    if len(argv) >= 3 and argv[0] == "run" and argv[1] in cases:
        resource.setrlimit(resource.RLIMIT_CORE, (0, resource.getrlimit(resource.RLIMIT_CORE)[1]))
        runner, kw = cases[argv[1]]
        bound = run_bound_s(bound_s)

        def too_long(*_):                                    # a run never holds the host's lock for more than its bound
            H.killall(H.OWN)
            for pid, _ in H.own_processes():
                try:
                    os.kill(pid, signal.SIGKILL)
                except (ProcessLookupError, PermissionError):
                    pass
            sys.stderr.write("NO VERDICT: the run was ended after %d s\n" % bound)
            os._exit(3)

        def hard_stop():                                     # integration pass I-9a: the alarm's handler runs in the main thread only, and its own
            # cleanup can wait (one run held the lock for six minutes). This thread waits for neither: it ends the process. The
            # stand-in of the Core ends its relay when this process's pipe closes, and has a life bound of its own.
            sys.stderr.write("NO VERDICT: the run was ended by its watchdog after %d s\n" % (bound + RUN_BOUND_GRACE_S))
            os._exit(3)

        signal.signal(signal.SIGALRM, too_long)
        signal.alarm(bound)
        watchdog = threading.Timer(bound + RUN_BOUND_GRACE_S, hard_stop)
        watchdog.daemon = True
        watchdog.start()
        r = runner(argv[1], int(argv[2]), **kw)
        sys.exit(0 if r["verdict"] == "PASS" else 1)
    if argv[:1] == ["cases"]:
        print("\n".join(cases))
        return
    if argv[:1] == ["summary"]:
        rows = summary(list(cases), title)
        sys.exit(0 if rows and all(r["verdict"] == "PASS" for r in rows) else 1)
    sys.exit("usage: %s run <case> <n> | cases | summary" % os.path.basename(sys.argv[0]))


if __name__ == "__main__":
    main(sys.argv[1:])
