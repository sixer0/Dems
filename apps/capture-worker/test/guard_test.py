#!/usr/bin/env python3
"""The checks of the CAPTURE GUARD (task 4 blueprint row 23, WP-02): src/guard/guard.c -> build/capture-guard.

    make -C apps/capture-worker guard         (part of `make`; builds the guard and the double first)
    python3 test/guard_test.py all | static | imports | run      (from apps/capture-worker)

No port, no worker, no relay, no FFmpeg: the child is a DOUBLE (test/guard_double.c) that, like the FFmpeg
helper of experiment E-7, never ends because its standard input ended. Three parts, each with its controls:

  static   rules over the guard's source with the comments removed: it never reads, never writes or prints,
           starts no shell and searches no path, reads no environment variable, opens nothing; ONE execve with
           the argument vector and the environment as they came; the core-file limit; the Linux seam.
           Controls: one planted line per rule, each must be refused by ITS rule; the untouched source passes.
  imports  the same on the linked binary (`nm -u`): no function that reads, writes, prints, opens, reads the
           environment or starts a shell is imported. Control: a program that reads is refused.
  run      the behaviour, measured on this host (the numbers are in the last line):
             the child gets the argument vector and the environment unchanged, and a core-file limit of 0;
             a start message written to the guard's standard input arrives at the child byte for byte and the
               guard wrote nothing (it has no output of its own: both streams are the child's);
             the child is gone within the bound after the guard's input ended (20 runs; no orphan after them);
               control: nothing done - the child stays;
             bytes that wait unread in the input are not its end;
             the same through a socket pair (what Node gives a child as standard input);
             the guard's parent killed with SIGKILL (a wrapper this script starts) while the input stays OPEN:
               the child is gone within the bound; and with the input held by the wrapper;
               control: the same wrapper starts the double WITHOUT the guard - the double survives (E-7);
             the child's exit is passed on (0, 7, 255; 128 + 9 for a child that was killed);
             a child that ignores SIGTERM is killed after the bound;
             SIGTERM to the guard ends the child;
             the refusals: no program, a relative program, an input that is no pipe, a program that is none.

NOT shown here: Linux. The parent-death signal (the `__linux__` seam of guard.c) is not compiled on macOS; it
is hardware check 9A/H-02 / row 79. A SIGKILL of the guard ITSELF on macOS leaves the child (stated in guard.c).
Everything a run writes lands under build/guard-test/ (git-ignored)."""
import os, re, resource, signal, socket, subprocess, sys, time

sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
BUILD = os.path.join(APP, "build")
GUARD = os.path.join(BUILD, "capture-guard")
DOUBLE = os.path.join(BUILD, "guard_double")
SOURCE = os.path.join(APP, "src", "guard", "guard.c")
WORK = os.path.join(BUILD, "guard-test")

INPUT_BOUND_S = 0.5             # from the end of the input, or of the parent, to "the child is gone"
TERM_BOUND_S = 2.0              # GUARD_TERM_BOUND_MS of guard.c
RUNS = 20

FAILED, CHECKS = [], [0]


def check(what, ok, detail=""):
    CHECKS[0] += 1
    if not ok:
        FAILED.append(what)
        print("guard_test: FAILED: %s%s" % (what, (" (%s)" % detail) if detail else ""), flush=True)
    return ok


# ---------------------------------------------------------------- static rules
RULES = [
    ("READ", r"\b(read|pread|readv|recv|recvfrom|recvmsg|fread|fgets|getline|getdelim|getc|fgetc|getchar|scanf|fscanf|splice|sendfile)\s*\(", "the guard reads (it must never read its input: the start message is the child's)"),
    ("WRITE", r"\b(write|pwrite|writev|send|sendto|sendmsg|printf|fprintf|dprintf|vfprintf|puts|fputs|putchar|putc|perror|fwrite|syslog)\s*\(|\bstd(out|err)\b", "the guard writes or prints (it has no output of its own)"),
    ("SHELL", r"\b(system|popen|execvp|execvpe|execlp|execl|execle|execv|posix_spawn|posix_spawnp|wordexp|fexecve)\s*\(|/bin/|\"sh\"|\"-c\"", "a shell, a search path or another way to start a program"),
    ("ENV", r"\b(getenv|secure_getenv|setenv|putenv|unsetenv|clearenv)\s*\(|\benviron\s*(\[|=|\+)", "the guard reads or changes the environment (it hands it on as given)"),
    ("OPEN", r"\b(open|openat|fopen|freopen|creat|socket|connect|dup|dup2|pipe|mkstemp|opendir|dlopen)\s*\(", "the guard opens something"),
    ("ARGV", r"argv\s*\[\s*[02-9]|argv\s*\[\s*1\s*\]\s*\[\s*[1-9]|\bstr(cpy|cat|tok|dup|ncpy)\s*\(|\bsn?printf\s*\(|\bmemcpy\s*\(", "a word of the argument vector is read, split, joined or copied"),
]
PINNED = [
    ("EXEC", "execve(argv[1], argv + 1, environ);", "ONE execve, of argv[1] with the vector and the environment as they came"),
    ("EXEC", "fork()", "ONE fork: one child"),
    ("CORE", "if (setrlimit(RLIMIT_CORE, &none) || getrlimit(RLIMIT_CORE, &now) || now.rlim_cur != 0 || now.rlim_max != 0) return GUARD_HYGIENE_FAILED;", "the core-file limit is set to 0 and read back before anything is started"),
    ("USAGE", "if (argc < 2 || argv[1][0] != '/') return GUARD_USAGE;", "a program that is not an absolute path is refused"),
    ("INPUT", "if (fstat(STDIN_FILENO, &input) || !(S_ISFIFO(input.st_mode) || S_ISSOCK(input.st_mode))) return GUARD_INPUT_NOT_A_PIPE;", "an input that is no pipe and no socket is refused"),
    ("WATCH", "if (g_told || getppid() != parent || input_ended()) break;", "the three reasons to end the child: told, parent gone, input ended"),
    ("REAP", "child_ended(child, &status, 1);", "the child is waited for after the SIGKILL"),
    ("LINUX", "if (prctl(PR_SET_PDEATHSIG, SIGKILL, 0, 0, 0) || getppid() != self) _exit(GUARD_NOT_EXECUTED);", "the parent-death signal of the Linux seam"),
]
PLANTED = [
    ("READ", "static long planted(char *b) { return read(STDIN_FILENO, b, 1); }"),
    ("READ", "static long planted(char *b) { return recv(0, b, 1, MSG_PEEK); }"),
    ("WRITE", "static void planted(const char *b) { write(2, b, 1); }"),
    ("WRITE", "static void planted(const char *b) { fprintf(stderr, \"%s\", b); }"),
    ("SHELL", "static int planted(char **v) { return execvp(v[1], v + 1); }"),
    ("SHELL", "static int planted(const char *c) { return system(c); }"),
    ("SHELL", "static const char *planted = \"/bin/sh\";"),
    ("ENV", "static const char *planted(void) { return getenv(\"PATH\"); }"),
    ("ENV", "static void planted(void) { environ[0] = 0; }"),
    ("OPEN", "static int planted(const char *p) { return open(p, 0); }"),
    ("ARGV", "static int planted(char **argv) { return argv[2][0] == '-'; }"),
    ("EXEC", "static int planted(char **argv) { return execve(argv[1], argv + 1, environ); }"),
    ("EXEC", "static int planted(void) { return fork(); }"),
]
MUTATED = [
    ("EXEC", "execve(argv[1], argv + 1, environ);", "execve(argv[1], argv + 2, environ);", "the argument vector handed on without its first word"),
    ("EXEC", "execve(argv[1], argv + 1, environ);", "execve(argv[1], argv + 1, NULL);", "the environment not handed on"),
    ("CORE", "now.rlim_cur != 0 || now.rlim_max != 0) return GUARD_HYGIENE_FAILED;", "0) return GUARD_HYGIENE_FAILED;", "the core-file limit not read back"),
    ("WATCH", "getppid() != parent || ", "", "the parent is no longer watched"),
    ("WATCH", " || input_ended()", "", "the input is no longer watched"),
    ("REAP", "    child_ended(child, &status, 1);\n", "", "the killed child is not waited for"),
    ("LINUX", "prctl(PR_SET_PDEATHSIG, SIGKILL, 0, 0, 0) || ", "", "the Linux seam without the parent-death signal"),
]


def static_rules(text):
    """The violations of the guard's source, as (tag, sentence). Comments are not code: they are removed first."""
    code = re.sub(r"/\*.*?\*/", " ", text, flags=re.S)
    out = []
    for tag, pattern, sentence in RULES:
        for m in re.finditer(pattern, code):
            out.append((tag, "%s: `%s`" % (sentence, m.group(0).strip())))
    for tag, line, sentence in PINNED:
        n = code.count(line)
        if n != 1:
            out.append((tag, "%s: expected exactly 1 occurrence, found %d" % (sentence, n)))
    linux = re.search(r"#ifdef __linux__\n(.*?)#else", code[code.find("if (child == 0)"):], flags=re.S)
    if not linux or "PR_SET_PDEATHSIG" not in linux.group(1) or code.count("PR_SET_PDEATHSIG") != 1:
        out.append(("LINUX", "the parent-death signal is not inside the `__linux__` seam of the child"))
    if len(re.findall(r"^#if", code, flags=re.M)) != 2:
        out.append(("LINUX", "a compile-time switch besides the two `__linux__` ones (the include and the seam)"))
    return out


def static_part():
    text = open(SOURCE).read()
    found = static_rules(text)
    check("static: the guard's source keeps every rule", not found, "; ".join("%s %s" % f for f in found))
    for tag, line in PLANTED:
        found = static_rules(text + line + "\n")
        check("static control: a planted line is refused by rule %s: %s" % (tag, line), any(t == tag for t, _ in found), "found %s" % sorted({t for t, _ in found}))
    for tag, old, new, what in MUTATED:
        changed = text.replace(old, new)
        if not check("static control is not stale: %s" % what, changed != text):
            continue
        found = static_rules(changed)
        check("static control: refused by rule %s: %s" % (tag, what), any(t == tag for t, _ in found), "found %s" % sorted({t for t, _ in found}))
    code = "/* read(0, b, 1); system(c); getenv(x); */\n"
    check("static control: the forbidden texts inside a comment are not code", static_rules(text + code) == [])
    print("guard_test: static rules OK over src/guard/guard.c; %d planted lines and %d mutations refused, each by its rule" % (len(PLANTED), len(MUTATED)), flush=True)


# ---------------------------------------------------------------- the import net
FORBIDDEN_IMPORTS = set("""read pread readv recv recvfrom recvmsg fread fgets getline getdelim getc fgetc getchar scanf fscanf
write pwrite writev send sendto sendmsg printf fprintf dprintf vfprintf puts fputs putchar putc perror fwrite syslog
system popen execvp execlp execl execle execv posix_spawn posix_spawnp wordexp fexecve dlopen
getenv secure_getenv setenv putenv unsetenv clearenv
open openat fopen freopen creat socket connect dup dup2 pipe mkstemp opendir""".split())
REQUIRED_IMPORTS = {"execve", "fork", "waitpid", "kill", "poll", "ioctl", "setrlimit", "getrlimit", "getppid", "fstat", "sigaction"}


def imports_of(binary):
    out = subprocess.run(["nm", "-u", binary], capture_output=True, text=True).stdout
    names = set()
    for line in out.splitlines():
        word = line.split()[-1] if line.split() else ""
        word = re.sub(r"[$@].*", "", word)
        names.add(word[1:] if word.startswith("_") and sys.platform == "darwin" else word)
    return names


def imports_part():
    names = imports_of(GUARD)
    bad = sorted(names & FORBIDDEN_IMPORTS)
    check("imports: the guard imports no function that reads, writes, prints, opens, reads the environment or starts a shell", not bad, "imports %s" % bad)
    check("imports: the binary is the guard (it imports what the guard is made of)", REQUIRED_IMPORTS <= {n.replace("fstat64", "fstat") for n in names}, "missing %s" % sorted(REQUIRED_IMPORTS - names))
    check("imports: stack protector in the binary", any("stack_chk_fail" in n for n in names))
    os.makedirs(WORK, exist_ok=True)
    src, exe = os.path.join(WORK, "reads.c"), os.path.join(WORK, "reads")
    open(src, "w").write("#include <unistd.h>\nint main(void) { char b; return (int)read(0, &b, 1); }\n")
    built = subprocess.run([os.environ.get("CC", "clang"), "-o", exe, src], capture_output=True).returncode == 0
    check("imports control: the program of the control compiles", built)
    if built:
        check("imports control: a program that reads its input is refused by the import net", "read" in (imports_of(exe) & FORBIDDEN_IMPORTS))
    print("guard_test: import net OK over build/capture-guard (%d imported names, none forbidden); a program that reads is refused" % len(names), flush=True)


# ---------------------------------------------------------------- behaviour
def gone(pid):
    try:
        os.kill(pid, 0)
    except ProcessLookupError:
        return True
    except PermissionError:
        return False
    return False


def wait_gone(pid, bound):
    t0 = time.monotonic()
    while time.monotonic() - t0 < bound:
        if gone(pid):
            return time.monotonic() - t0
        time.sleep(0.002)
    return None


def read_report(path, bound=3.0):
    t0 = time.monotonic()
    while not os.path.exists(path):
        if time.monotonic() - t0 > bound:
            return None
        time.sleep(0.002)
    r = {"arg": [], "env": []}
    for line in open(path).read().splitlines():
        word, _, rest = line.partition(" ")
        if word in ("arg", "env"):
            r[word].append(bytes.fromhex(rest))
        elif word == "pid":
            r["pid"] = int(rest)
        elif word == "core":
            r["core"] = tuple(int(x) for x in rest.split())
        elif word == "line":
            r["line"] = (int(rest.split()[0]), rest.split()[1])
    return r


def fnv(data):
    h = 1469598103934665603
    for b in data:
        h = ((h ^ b) * 1099511628211) & 0xFFFFFFFFFFFFFFFF
    return "%016x" % h


COUNTER = [0]


def report_path(name):
    COUNTER[0] += 1
    p = os.path.join(WORK, "%03d_%s.report" % (COUNTER[0], name))
    for q in (p, p + ".tmp"):
        if os.path.exists(q):
            os.remove(q)
    return p


def start(name, mode, extra=(), env=None, stdin=subprocess.PIPE, preexec=None):
    rep = report_path(name)
    p = subprocess.Popen([GUARD, DOUBLE, mode, rep] + list(extra), stdin=stdin, stdout=subprocess.PIPE, stderr=subprocess.PIPE, env=env if env is not None else {}, close_fds=True, preexec_fn=preexec)
    return p, rep


def finish(p, bound=5.0):
    """The guard's exit code and everything it (that is: its child) wrote to the two streams. The guard is waited
    for FIRST, with its input untouched: closing the input here would be a trigger of its own."""
    try:
        p.wait(timeout=bound)
        out, err = p.communicate(timeout=bound)
    except subprocess.TimeoutExpired:
        p.kill()
        out, err = p.communicate()
        return None, out, err
    return p.returncode, out, err


def end_by_input(p, r):
    t0 = time.monotonic()
    p.stdin.close()
    t = wait_gone(r["pid"], 5.0)
    p.stdin = None
    rc, out, err = finish(p)
    return t, rc, out, err, time.monotonic() - t0


def run_part():
    os.makedirs(WORK, exist_ok=True)
    facts = {}
    survivors = []

    # (1) argument vector, environment, core-file limit
    words = ["plain", "two words", "", "$HOME", "a;b|c&d>e", "quote\"'`", "--opt=val ue", "back\\slash", "*", "café", "-", "--"]
    env = {"ALSA_CONFIG_PATH": "/nonexistent/dems/asound.conf", "DEMS_GUARD_TEST": "a b=c $HOME ;"}
    hard = resource.getrlimit(resource.RLIMIT_CORE)[1]
    raised = hard != 0

    def raise_core():
        if raised:
            resource.setrlimit(resource.RLIMIT_CORE, (hard if hard != resource.RLIM_INFINITY and hard < (1 << 20) else (1 << 20), hard))

    p, rep = start("vector", "stay", words, env, preexec=raise_core)
    r = read_report(rep)
    if check("(1) the child started and reported", r is not None):
        check("(1) the argument vector arrives unchanged, word for word", r["arg"] == [x.encode() for x in [DOUBLE, "stay", rep] + words], repr(r["arg"]))
        check("(1) the environment arrives as given: the same entries, nothing added, nothing removed", sorted(r["env"]) == sorted(("%s=%s" % kv).encode() for kv in env.items()), repr(r["env"]))
        check("(1) the child's core-file limit is 0 (soft and hard)%s" % (" although the guard was started with a soft limit above 0" if raised else " (this shell's hard limit is 0 already: the guard's own setting is not told apart here)"), r["core"] == (0, 0), repr(r.get("core")))
        t, rc, out, err, _ = end_by_input(p, r)
        check("(1) ended by the end of the input", t is not None and rc == 128 + signal.SIGTERM, "t=%s rc=%s" % (t, rc))
        survivors.append(r["pid"])
    else:
        p.kill()
    facts["core_limit_raised_before_the_guard"] = raised

    # (2) the start message: to the child byte for byte, through a pipe and through a socket pair; the guard writes nothing
    message = ('{"type":"start","mode":"record","ingest":"rtsp://127.0.0.1:8559/' + "g23" + "/" + "Qx7" * 7 + '","access":{"locator":"rtsp://192.0.2.7/media","username":"dems-' + "double" + '","secret":"' + "pw-" + "Zk4" * 9 + '"}}\n').encode()
    for kind in ("pipe", "socket"):
        if kind == "pipe":
            p, rep = start("message_pipe", "readline", env={})
            p.stdin.write(message)
            p.stdin.flush()
            closer = None
        else:
            ours, theirs = socket.socketpair()
            p, rep = start("message_socket", "readline", env={}, stdin=theirs.fileno())
            theirs.close()
            ours.sendall(message)
            closer = ours
        r = read_report(rep)
        if not check("(2) %s: the child reported after it read its line" % kind, r is not None and "line" in r):
            p.kill()
            continue
        check("(2) %s: the child read the start message byte for byte (%d bytes, the same hash)" % (kind, len(message)), r["line"] == (len(message), fnv(message)), repr(r["line"]))
        time.sleep(0.3)
        check("(2) %s: with the message taken and the input open the child and the guard stay" % kind, not gone(r["pid"]) and p.poll() is None)
        if closer:
            t0 = time.monotonic()
            closer.close()
            t = wait_gone(r["pid"], 5.0)
            rc, out, err = finish(p)
            facts["socket_input_end_ms"] = round((t or 9) * 1000, 1)
        else:
            t, rc, out, err, _ = end_by_input(p, r)
        check("(2) %s: the child is gone within %.1f s of the end of the input" % (kind, INPUT_BOUND_S), t is not None and t <= INPUT_BOUND_S and rc == 128 + signal.SIGTERM, "t=%s rc=%s" % (t, rc))
        check("(2) %s: the guard wrote nothing: 0 bytes on standard output and standard error, 0 occurrences of the message" % kind, out == b"" and err == b"" and message not in out + err and message[:-1] not in out + err, "%d + %d bytes" % (len(out), len(err)))
        survivors.append(r["pid"])

    # (3) the input ends: 20 runs, measured; then no orphan
    times, guards = [], []
    for i in range(RUNS):
        p, rep = start("input_end_%02d" % i, "stay")
        r = read_report(rep)
        if r is None:
            check("(3) run %d: the child started" % i, False)
            p.kill()
            continue
        t, rc, out, err, whole = end_by_input(p, r)
        ok = t is not None and t <= INPUT_BOUND_S and rc == 128 + signal.SIGTERM
        if not ok:
            check("(3) run %d: child gone within %.1f s of the end of the input, its end passed on" % (i, INPUT_BOUND_S), False, "t=%s rc=%s" % (t, rc))
        if t is not None:
            times.append(t)
        survivors.append(r["pid"])
        guards.append(p.pid)
    check("(3) %d runs: the child was gone within %.1f s of the end of the guard's input in every one (slowest %.0f ms)" % (RUNS, INPUT_BOUND_S, max(times or [9]) * 1000), len(times) == RUNS and max(times) <= INPUT_BOUND_S)
    facts["input_end_ms_max"], facts["input_end_ms_min"] = round(max(times or [9]) * 1000, 1), round(min(times or [9]) * 1000, 1)
    p, rep = start("control_nothing_done", "stay")
    r = read_report(rep)
    time.sleep(1.0)
    check("(3) control: with nothing done the child and the guard are still there after 1 s (an end above is the trigger's doing)", r is not None and not gone(r["pid"]) and p.poll() is None)
    if r:
        end_by_input(p, r)
        survivors.append(r["pid"])

    # (4) bytes that wait unread are not the end of the input
    p, rep = start("unread_bytes", "stay")
    r = read_report(rep)
    if check("(4) the child started", r is not None):
        p.stdin.write(b"x" * 100 + b"\n")
        p.stdin.flush()
        time.sleep(0.5)
        check("(4) 101 bytes wait unread in the input for 0.5 s: the child and the guard stay", not gone(r["pid"]) and p.poll() is None)
        t, rc, out, err, _ = end_by_input(p, r)
        check("(4) then the input ends: the child is gone within the bound", t is not None and t <= INPUT_BOUND_S and rc == 128 + signal.SIGTERM, "t=%s rc=%s" % (t, rc))
        survivors.append(r["pid"])

    # (5) the guard's PARENT is killed (SIGKILL of a wrapper)
    parent_times = []
    for holder in ("test", "test", "test", "wrapper", "wrapper", "wrapper"):
        rep = report_path("parent_killed_%s" % holder)
        rfd, wfd = os.pipe()
        w = subprocess.Popen([sys.executable, "-B", os.path.abspath(__file__), "wrapper", holder, GUARD, DOUBLE, "stay", rep], stdin=rfd, stdout=subprocess.PIPE, env={}, close_fds=True)
        os.close(rfd)
        guard_pid = int(w.stdout.readline().decode().strip() or 0)
        r = read_report(rep)
        if not check("(5) %s holds the input: the guard and its child started under the wrapper" % holder, r is not None and guard_pid > 0):
            w.kill()
            os.close(wfd)
            continue
        t0 = time.monotonic()
        w.kill()                                         # SIGKILL: the wrapper has no chance to tell anybody
        t = wait_gone(r["pid"], 5.0)
        w.wait()
        tg = wait_gone(guard_pid, 2.0)
        check("(5) %s holds the input: after a SIGKILL of the guard's parent the child is gone within %.1f s, and the guard too" % (holder, INPUT_BOUND_S), t is not None and t <= INPUT_BOUND_S and tg is not None, "child %s guard %s" % (t, tg))
        if t is not None:
            parent_times.append(t)
        os.close(wfd)                                    # with `test` the input was OPEN the whole time: only the parent watch can have ended the child
        survivors += [r["pid"], guard_pid]
    facts["parent_killed_ms_max"] = round(max(parent_times or [9]) * 1000, 1)
    rep = report_path("control_no_guard")
    rfd, wfd = os.pipe()
    w = subprocess.Popen([sys.executable, "-B", os.path.abspath(__file__), "wrapper", "test", DOUBLE, "stay", rep], stdin=rfd, stdout=subprocess.PIPE, env={}, close_fds=True)
    os.close(rfd)
    w.stdout.readline()
    r = read_report(rep)
    if check("(5) control: the double started under the wrapper WITHOUT a guard", r is not None):
        w.kill()
        w.wait()
        time.sleep(1.0)
        check("(5) control: without the guard the double SURVIVES the SIGKILL of its parent (1 s later it is still there): the check can find a survivor", not gone(r["pid"]))
        os.close(wfd)
        time.sleep(0.3)
        check("(5) control: and it survives the end of its input as well (the helper of E-7)", not gone(r["pid"]))
        os.kill(r["pid"], signal.SIGKILL)
        wait_gone(r["pid"], 2.0)
        survivors.append(r["pid"])
    else:
        w.kill()
        os.close(wfd)

    # (6) the child's exit is passed on
    for mode, want in (("exit:0", 0), ("exit:7", 7), ("exit:255", 255), ("selfkill", 128 + signal.SIGKILL)):
        p, rep = start("exit_%s" % mode.replace(":", ""), mode)
        rc, out, err = finish(p)
        check("(6) a child that ends by itself (%s) with the input open: the guard's exit is %d" % (mode, want), rc == want, "rc=%s" % rc)

    # (7) a child that ignores SIGTERM
    p, rep = start("ignores_term", "ignoreterm")
    r = read_report(rep)
    if check("(7) the child started", r is not None):
        t, rc, out, err, _ = end_by_input(p, r)
        check("(7) a child that ignores SIGTERM is killed after the bound of %.1f s (not before it, and within 0.7 s after it), reaped, its end passed on as 128 + 9" % TERM_BOUND_S,
              t is not None and TERM_BOUND_S - 0.1 <= t <= TERM_BOUND_S + 0.7 and rc == 128 + signal.SIGKILL, "t=%s rc=%s" % (t, rc))
        facts["ignoring_child_killed_after_ms"] = round((t or 9) * 1000, 1)
        survivors.append(r["pid"])

    # (8) SIGTERM to the guard
    p, rep = start("guard_told", "stay")
    r = read_report(rep)
    if check("(8) the child started", r is not None):
        p.send_signal(signal.SIGTERM)
        t = wait_gone(r["pid"], 5.0)
        rc, out, err = finish(p)
        check("(8) SIGTERM to the guard: the child is gone within the bound and its end is passed on", t is not None and t <= INPUT_BOUND_S and rc == 128 + signal.SIGTERM, "t=%s rc=%s" % (t, rc))
        survivors.append(r["pid"])

    # (9) the refusals: nothing is started
    def refused(name, argv, want, stdin=subprocess.PIPE):
        rep = report_path(name)
        argv = [a.replace("@REPORT@", rep) for a in argv]
        p = subprocess.Popen([GUARD] + argv, stdin=stdin, stdout=subprocess.PIPE, stderr=subprocess.PIPE, env={}, close_fds=True)
        rc, out, err = finish(p)
        time.sleep(0.05)
        check("(9) %s: exit %d, nothing written, no child" % (name, want), rc == want and out == b"" and err == b"" and not os.path.exists(rep), "rc=%s" % rc)

    refused("no_program", [], 120)
    refused("relative_program", [os.path.relpath(DOUBLE), "stay", "@REPORT@"], 120)
    refused("program_by_name", ["guard_double", "stay", "@REPORT@"], 120)
    refused("input_is_no_pipe", [DOUBLE, "stay", "@REPORT@"], 122, stdin=subprocess.DEVNULL)
    refused("program_that_is_none", ["/nonexistent/dems/helper", "stay", "@REPORT@"], 126)

    # no orphan, no zombie: every child and every guard of this run is gone
    time.sleep(0.1)
    left = sorted({pid for pid in survivors + guards if not gone(pid)})
    check("no process of the %d runs is left (children and guards): 0 orphans" % (len(survivors) + len(guards)), not left, "left %s" % left)
    facts["orphans"] = len(left)
    return facts


def wrapper(argv):
    """A parent for the guard that the test kills. `test`: the guard's input is this process's own (the test holds its
    other end); `wrapper`: this process holds it. Prints the started process's ID and waits for ever."""
    holder, cmd = argv[0], argv[1:]
    child = subprocess.Popen(cmd, stdin=(0 if holder == "test" else subprocess.PIPE), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, env={}, close_fds=True)
    sys.stdout.write("%d\n" % child.pid)
    sys.stdout.flush()
    while True:
        time.sleep(60)


def main(argv):
    what = argv[0] if argv else "all"
    if what == "wrapper":
        wrapper(argv[1:])
    if what not in ("all", "static", "imports", "run"):
        sys.exit("usage: guard_test.py all | static | imports | run")
    facts = {}
    if what in ("all", "static"):
        static_part()
    if what in ("all", "imports"):
        imports_part()
    if what in ("all", "run"):
        facts = run_part()
    if FAILED:
        print("guard_test: %d of %d checks FAILED" % (len(FAILED), CHECKS[0]))
        sys.exit(1)
    tail = ""
    if facts:
        tail = " (child gone after the guard's input ended: %.0f to %.0f ms over %d runs, bound %d ms; after a SIGKILL of the guard's parent: at most %.0f ms over 6 runs; a child that ignores SIGTERM: killed after %.0f ms; orphans: %d)" % (
            facts["input_end_ms_min"], facts["input_end_ms_max"], RUNS, INPUT_BOUND_S * 1000, facts["parent_killed_ms_max"], facts.get("ignoring_child_killed_after_ms", -1), facts["orphans"])
    print("guard_test: all %d checks hold%s" % (CHECKS[0], tail))


if __name__ == "__main__":
    main(sys.argv[1:])
