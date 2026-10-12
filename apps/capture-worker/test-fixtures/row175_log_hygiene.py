#!/usr/bin/env python3
"""Task 4 blueprint row 175 (WP-11b; BR-04 of verification/05_security_branch_b.md): the targeted checks of the
LOG HYGIENE of the worker's gate on the announced address. Test code only; the permanent test in the worker's own
series is rows 142 and 178 (they may take the cases from here).

What BR-04 asks, and where it is shown:
  (1) no log level is set, nothing above level 16 is written   `scan`: 0 lines of the library above level 16 in
                                                               any worker log; the build itself refuses the call
                                                               (src/worker.h; `make unit` cannot show a refused build)
  (2) no address and no path in the log, a frame or an error   `scan`: 0 occurrences of any path text of a run - the
                                                               whole path, each long element of it, each near-miss
                                                               path - in every worker log of row58_gate.py and of this
                                                               script; `repeat` counts the same texts in the worker's
                                                               standard output (its frames) as well
  (3) two refusal codes, told apart                            INGEST_ANNOUNCE_NOT_MATCHED for a differing line (the
                                                               cases near / foreign of row58_gate.py) and a REPEATED
                                                               line (`repeat`, here: on the wire, which row 58 had in
                                                               its unit check only); INGEST_ANNOUNCE_NOT_SEEN for "no
                                                               line" (the case unseen of row58_gate.py, proof build)

    # repository root, command sandbox off (binds two loopback ports, reads ps / lsof); `make proof` first
    M3_PORTS=8559,8561 /usr/bin/lockf -k -t 1800 .locks/heavy-host.lock python3 apps/capture-worker/test-fixtures/row58_gate.py all
    M3_PORTS=8559,8561 /usr/bin/lockf -k -t 1800 .locks/heavy-host.lock python3 apps/capture-worker/test-fixtures/row175_log_hygiene.py repeat
    python3 apps/capture-worker/test-fixtures/row175_log_hygiene.py scan          # reads files only: no lock, no port

Cases
  repeat   a raw client on ONE camera's port announces the RIGHT address and then announces again before SETUP -
           once the same address, once another one - while the other camera of the session gets its own push: the
           camera under test is refused with INGEST_ANNOUNCE_NOT_MATCHED (never the other code), 0 bytes, no
           `ingest_connected`; the control records.
  scan     every run directory of .cache/row58-gate and .cache/row175-log-hygiene that has a result: the counts above.

Addresses are synthetic and of the scripts only. Nothing here prints an address or a path: `scan` prints counts.
Everything this script writes lands under .cache/row175-log-hygiene/ (git-ignored)."""
import json, os, sys, time

sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
OUT = os.path.join(REPO, ".cache", "row175-log-hygiene")
ROW58_OUT = os.path.join(REPO, ".cache", "row58-gate")
os.environ.setdefault("M3_PORTS", "8559,8561")
sys.path.insert(0, HERE)
import row58_gate as G                                   # read-only reuse: run(), the raw client, the handshake, the two codes
E, H = G.E, G.H
G.OUT = E.OUT = OUT                                      # this script's runs land in its own folder, not in row 58's
E.RIGHT = ("g175/Vt5cN8xQe3Lm7Rp2", "g175/Zb9wK4hDu6Sj1Ty0")  # the plan's two addresses of every session of this script

ELEMENT_CHARS = 8                                        # src/announce.h, ANNOUNCE_PATH_ELEMENT_CHARS
MATCHED, SEEN = G.GATE_CODE, G.UNSEEN_CODE


def elements(path):
    return [e for e in path.split("/") if len(e) >= ELEMENT_CHARS]


def texts_of(paths):
    """Every text a path could leave behind: itself and each of its long elements."""
    out = set()
    for p in paths:
        out.add(p)
        out.update(elements(p))
    return sorted(out)


def raw_repeat(second_of):
    def make(ctx, port, right, cport, cright):
        address = E.url(port, right)
        second = second_of(port, right)
        h = G.handshake(address)
        announce_again = ("ANNOUNCE", second, h[1][2], h[1][3])
        used = [right, cright] + ([second.split("/", 3)[3]] if second != address else [])
        return G.raw_requests(port, [h[0], h[1], announce_again, h[2], h[3]]), texts_of(used)
    return make


def todo(what):
    out = []
    if what in ("repeat", "all"):
        out.append(lambda: G.run("repeat_same_address_camera_1", "repeat:same", 0, raw_repeat(lambda port, right: E.url(port, right)), "refused"))
        out.append(lambda: G.run("repeat_other_address_camera_2", "repeat:other", 1, raw_repeat(lambda port, right: E.url(port, "g175/Nq2rF6yPa8Wd3Xk5")), "refused"))
    return out


def scan():
    rows, fail = [], 0
    for root in (ROW58_OUT, OUT):
        runs = os.path.join(root, "runs")
        for name in sorted(os.listdir(runs)) if os.path.isdir(runs) else []:
            d = os.path.join(runs, name)
            if not os.path.exists(os.path.join(d, "result.json")) or not os.path.exists(os.path.join(d, "worker.jsonl")):
                continue
            r = json.load(open(os.path.join(d, "result.json")))
            raw = open(os.path.join(d, "worker.jsonl"), errors="replace").read()
            log = [json.loads(l) for l in raw.splitlines() if l.strip()]
            texts = texts_of(list(r.get("paths_used", [])) + list(r.get("right_paths", {}).values()))
            case = str(r.get("case", ""))
            n_matched, n_seen = sum(l.get("message") == MATCHED for l in log), sum(l.get("message") == SEEN for l in log)
            frames = json.dumps(r.get("worker_frames_other", []))          # row 182: the frames the worker wrote (warnings, a crash), searched for the same texts
            row = {"run": name, "of": os.path.basename(root), "case": case, "texts_searched": len(texts), "path_text_in_log": sum(raw.count(t) for t in texts) + sum(frames.count(t) for t in texts) + frames.count("://"),
                   "path_text_in_log_and_stdout_as_recorded": sum(r.get("path_text_in_worker_output", {}).values()), "address_marks_in_log": raw.count("://"),
                   "library_lines": sum(l.get("message") == "LIBAV_MESSAGE" for l in log), "library_lines_above_level_16": sum(l.get("message") == "LIBAV_MESSAGE" and int(l.get("av_level", 0)) > 16 for l in log),
                   "library_lines_withheld": sum(l.get("message") == "LIBAV_MESSAGE" and "withheld" in str(l.get("text", "")) for l in log), "not_matched": int(n_matched), "not_seen": int(n_seen)}
            want = (0, 2) if case == "unseen" else (0, 0) if case == "right" else (1, 0) if case.startswith(("near", "foreign", "repeat")) else None
            crit = {"no_path_text": row["path_text_in_log"] == 0 and row["path_text_in_log_and_stdout_as_recorded"] == 0, "no_address_mark": row["address_marks_in_log"] == 0,
                    "nothing_above_level_16": row["library_lines_above_level_16"] == 0, "texts_were_searched": row["texts_searched"] >= 2}
            if want is not None:
                crit["the_code_of_its_case_and_never_the_other"] = (row["not_matched"], row["not_seen"]) == want
            row["criteria"], row["verdict"] = crit, "PASS" if all(crit.values()) else "FAIL"
            fail += row["verdict"] != "PASS"
            rows.append(row)
    os.makedirs(OUT, exist_ok=True)
    lines = ["%-34s %-12s %-30s texts=%d path_text_log=%d path_text_log+stdout=%d '://'=%d libav_lines=%d above16=%d withheld=%d NOT_MATCHED=%d NOT_SEEN=%d | %s%s" % (
        w["run"], w["of"], w["case"], w["texts_searched"], w["path_text_in_log"], w["path_text_in_log_and_stdout_as_recorded"], w["address_marks_in_log"], w["library_lines"], w["library_lines_above_level_16"],
        w["library_lines_withheld"], w["not_matched"], w["not_seen"], w["verdict"], "" if w["verdict"] == "PASS" else " failed: %s" % sorted(k for k, v in w["criteria"].items() if not v)) for w in rows]
    cases = lambda prefix: [w for w in rows if w["case"].startswith(prefix)]
    both = {"differing_line_runs_with_NOT_MATCHED": sum(w["not_matched"] >= 1 for w in cases("near") + cases("foreign")), "repeated_line_runs_with_NOT_MATCHED": sum(w["not_matched"] >= 1 for w in cases("repeat")),
            "no_line_runs_with_NOT_SEEN": sum(w["not_seen"] >= 1 for w in cases("unseen"))}
    seen_both = both["differing_line_runs_with_NOT_MATCHED"] >= 1 and both["repeated_line_runs_with_NOT_MATCHED"] >= 1 and both["no_line_runs_with_NOT_SEEN"] >= 1
    tail = "ROW175 LOG HYGIENE: %d run(s) scanned, %d PASS, %d FAIL; path text in any worker log: %d; library lines above level 16: %d; %s; both codes seen, each in its case: %s" % (
        len(rows), len(rows) - fail, fail, sum(w["path_text_in_log"] + w["path_text_in_log_and_stdout_as_recorded"] for w in rows), sum(w["library_lines_above_level_16"] for w in rows), json.dumps(both, sort_keys=True), "yes" if seen_both else "NO")
    json.dump({"rows": rows, "codes": both}, open(os.path.join(OUT, "scan.json"), "w"), indent=1)
    open(os.path.join(OUT, "scan.txt"), "w").write("\n".join(lines + [tail]) + "\n")
    print("\n".join(lines + [tail]))
    return bool(rows) and not fail and seen_both


def main(argv):
    what = argv[0] if argv else "scan"
    if what == "scan":
        sys.exit(0 if scan() else 1)
    runs = todo(what)
    if not runs:
        sys.exit("usage: row175_log_hygiene.py repeat | scan")
    ok = True
    for f in runs:
        r = f()
        ok = ok and r["verdict"] == "PASS"
        print(G.line(r), flush=True)
        time.sleep(1.5)
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main(sys.argv[1:])
