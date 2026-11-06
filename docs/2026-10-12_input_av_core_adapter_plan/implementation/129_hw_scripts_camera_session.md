---
task_id: 2026-10-12_input_av_core_adapter_plan
task_slug: input_av_core_adapter_plan
date: 2026-10-13
agent: coder-execution
blueprint_row: 129
milestone: M7
work_package: WP-27
type: record of the scripts of the hardware acceptance test package, camera and session group (chapter 3), with the record writer
narrative_tier: 3
source_plan: identification/03_implementation_blueprint.md (row 129, profile line 440)
source_analysis: scripts/hardware-acceptance/HW-ACCEPTANCE-1-FRAME.md (section 9.1), -3-NETWORK-CAMERAS-SESSION.md; implementation/126; implementation/128_hw_scripts_host.md (the shared library and its rules); scripts/secret-scan/count-only.mjs
status: complete
last_updated: 2026-10-13 06:20 (host clock)
---

# Row 129: hardware acceptance scripts, camera and session group - record

**NOTHING HERE IS PROVEN ON A HOST.** The collectors and the record writer have run only on the development Mac, against recording doubles and canned logs. No camera, no network, no session and no database was touched; no port was bound. They are the instrument of the hardware package.

## 1. What was built (all new, under `scripts/hardware-acceptance/`)

| File | Check and step | Reads |
|---|---|---|
| `collect-h12.sh` | `9A/H-12.5` | search entries of the audit list; candidate counts of the Core log |
| `collect-h13.sh` | `9A/H-13.4` `--state`, `.6` `--audit` | addresses and marks after the scan; scan / added / removed entries; count-only scan |
| `collect-h15.sh` | `9A/H-15.4` | `CAMERA_NETWORK_SET` entries; addresses on the camera port |
| `collect-h14.sh` | `9A/H-14.4` `--state`, `.5` `--audit` | addresses, marks, neighbour entry "yes / no" (the hardware address comes in a file and is never printed); count-only scan over log, error log, audit details |
| `collect-h10.sh` | `9A/H-10.6` `--camera <label>` | outcome and milliseconds of the test; per profile code, codec, size and three yes-or-no token facts; audit counts; count-only scan |
| `collect-h23.sh` | `9A/H-23.3` `--after-test`, `.4` `--after-session S1` | outcome; video packets per camera; count-only scan over every named place |
| `collect-h17.sh` | `9A/H-17.5` `--live`, `.10` `--sealed S1` | processes with owner kind, listeners, capability lines; after the seal: operation, sync level, notices, tracks, reveals, count-only scan |
| `collect-h21.sh` | `9A/H-21.1` | milliseconds from the worker's session start to each connect report |
| `collect-h09.sh` | `9A/H-09.1` `--live` / `--session S1`, `.2` `--file S1` | connect line, `INGEST_NO_EXTRADATA`, the three counters, clock offset; codec, sample entry, frames, decode errors of a file |
| `collect-h26.sh` | `9A/H-26.1` | count of `STREAM_PROFILE_DIFFERS`; codes per camera |
| `collect-h18.sh` | `9A/H-18.1` and `9A/H-19.5` | the time in the track of the sharpest rise of the audio level around a clap (numbers only) |
| `collect-h22.sh` | `9A/H-22.5` | time to connect, warnings and audit entries for the absent camera, tracks |
| `collect-h11.sh` | `9A/H-11.5` | faults raised and cleared, attempts, gap in the track, decode errors, reveals |
| `collect-h19.sh` | `9A/H-19.1` `--before`, `.6` `--session S4` | free space, clock state; length, faults, re-timed packets |
| `record-line.sh` | chapter 1, section 9.1 | writes one line per call into `result-record.txt` of the evidence folder; `--list` prints the 27 checks in the order of the run |
| `test_hw_collectors_camera.sh` | - | the test of the group |

Checks covered: 14 of the 15 of chapter 3 (`9A/H-12`, `H-13`, `H-15`, `H-14`, `H-10`, `H-23`, `H-17`, `H-21`, `H-09`, `H-26`, `H-18`, `H-22`, `H-11`, `H-19`), 21 modes. **`9A/H-20` has no collector: chapter 3 gives it no `SCRIPT` step** (its four steps are OPER's). Missing collectors of chapter 3: none.

## 2. The rules of the row

The rules and their mechanics are those of the shared library (record of row 128, section 2). In addition for this group:

| Rule | How |
|---|---|
| Camera passwords are never arguments | no option of any script takes a password, a key or a token (static test); an unknown option such as `--password` is refused with exit code 2 |
| No packet capture | no capture tool is on the closed list of readers; doubles of `tcpdump` and `tshark` recorded 0 starts |
| A search for a secret is the product's count-only scan | `hw_secret_scan` starts `node <install-dir>/scripts/secret-scan/count-only.mjs <files>` and prints its numbers; a hit is stated as "a security finding", by count |
| Wrappers of product operations only read | the only product commands started are `count-only.mjs` and (row 128) `npm run db:status`. **No collector signs in to the Core**: what only the signed-in console shows (state, sources, verification items, the audit list) is read by OPER or handed over as a file |
| No token, address or account in the output | fields of a log line are printed only when the value is a number or a short code; a locator, an address or a long text prints as "[... not printed]"; the planted token, password, locator and hardware address of the test occur in no output |
| The record writer emits one line per check | 27 calls give 27 lines, each check once, nine fields each; result exactly `PASS`, `FAIL` or `NOT RUN`; a `FAIL` or `NOT RUN` needs a note; a line is never edited (a repeat takes the next run); a field with an address, a hardware address, a locator, a named password or a character outside a closed set is refused. It starts no program and decides nothing: the result is the USER's |
| Verification cell: "each script has a dry mode; commands that type a credential, call sudo or change a camera in the scripts: 0; the record writer emits one line per check" | met (test parts 1, 2 and 6) |

## 3. Test on this Mac

`bash scripts/hardware-acceptance/test_hw_collectors_camera.sh` (after the last change; the host test was run again because the shared library changed):

```
RESULT: 535 passed, 0 failed (camera and session group, record writer; nothing here is proven on a host)
RESULT: 637 passed, 0 failed (host group; nothing here is proven on a host)
SKIPPED shellcheck is not installed on this machine: not run
```

Doubles: as in row 128; the pinned `ffmpeg` and `ffprobe` are doubles that print canned level blocks, packet times and stream entries; the Core log, the worker log and the audit list are hand-written lines. The worker log lines have the form the worker writes today (`session_starting`, `ingest_connected`, `camera_summary`, `worker_exit`); **the Core log lines for the camera path are invented for the test** (section 4, point 1).

## 4. What the scripts assume (defect list for row 181 and the dry run of row 130; no chapter was changed)

1. **Log contract.** The camera path, the commissioning functions and the session notices had no stated log codes when chapter 3 and these collectors were written. The collectors look for `CAMERA_CONNECTION_TESTED`, `CAMERA_PROFILE_LISTED` (with `tokenOutsideCodeForm`, `tokenDigitsOnly`, `listed`), `CAMERA_CLOCK_OFFSET` (`offsetMs`), `CAPTURE_FAULT` (`reason`, `state`), `SESSION_SEALED`, relay attempt codes. Each prints a "confirm" line and "(absent)" where the product logs otherwise. The three token facts of `9A/H-10.6` exist only if the product logs them as yes-or-no facts; a script may not print a token to derive them.
2. **The audit list as a file.** Seven collectors count audit entries from `--audit-file`. No chapter says how the USER gets the list as text (same point as row 128).
3. **Privileged copies.** `--track` (`H-09.2`, `H-18.1`, `H-11.5`, `H-08.7`) needs a camera or audio file this account can read: from an export of the session or a copy the USER makes with sudo. Chapter 3 leaves this open (its point C); the steps do not name the copy.
4. **Order inside a check.** `collect-h18.sh` needs two clock readings, the clap and the start click (`9A/H-17.2` notes the second); it maps them to the track assuming the track starts at the click. The true start of a track is later by the time to connect (`9A/H-21`): **a constant error of that size enters the search window, not the result** (the window is 5 s each way; a connect time above 5 s moves the clap out of it). Row 181 should let the step give the track's own start.
5. `collect-h21.sh` and `-h22.sh` count from the worker's `session_starting`, not from the operator's start request; the chapter's figure includes the Core's part.
6. `collect-h17.sh --live`, `-h09.sh --live`, `-h21.sh`, `-h08.sh --session` are all run "while S1 records" (5 minutes): the USER needs the Core's process id and a saved journal ready before the start.
7. `collect-h14.sh --state` needs the hardware address in a file; step `.4` does not say where the collector gets it.
8. The host port texts stay the chapters' (8554 to 8564); the worker listeners of this Mac's tests (8559 to 8564) and the test-camera doubles (8565 to 8574) are not used by any script.

## 5. Driver decisions (to confirm)

| # | Decision |
|---|---|
| D-1 | No collector authenticates to the Core's API; console-only facts are OPER's readings |
| D-2 | No `collect-h20.sh`, because the chapter names none |
| D-3 | `record-line.sh` writes `result-record.txt` in the evidence folder, the evidence field as `<file> (<role>)`, and refuses rather than masks a forbidden value |
| D-4 | `record-line.sh` is guarded like a collector (Ubuntu 24.04, not root; `--dry` anywhere) |
| D-5 | The clap instant is the largest rise of the peak level between blocks of 480 samples |
| D-6 | A gap in a track is a distance above 1 s between two video packets |
| D-7 | The mask leaves the count lines of the scan itself unmasked |

## 6. Requests

None in `file_requests.md`.

---
*Generated: 2026-10-13 06:20 (host clock)*
