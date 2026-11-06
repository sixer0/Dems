---
task_id: 2026-10-12_input_av_core_adapter_plan
task_slug: input_av_core_adapter_plan
date: 2026-10-13
agent: coder-execution
blueprint_row: 128
milestone: M7
work_package: WP-27
type: record of the scripts of the hardware acceptance test package, host group (chapter 2)
narrative_tier: 3
source_plan: identification/03_implementation_blueprint.md (row 128, profile line 439)
source_analysis: scripts/hardware-acceptance/HW-ACCEPTANCE-1-FRAME.md, -2-HOST-HELPER-AUDIO.md; implementation/124, 125; scripts/host/ (row 77); scripts/host/netalias/ (row 104); test/006, test/007; verification/05_security_branch_b.md (BR-10); delegation_progress/file_ownership.md (lines 145, 146)
status: complete
last_updated: 2026-10-13 05:40 (host clock)
---

# Row 128: hardware acceptance scripts, host group - record

**NOTHING HERE IS PROVEN ON A HOST.** The collectors were written on the development Mac and have run only there, against recording doubles of their tools and canned inputs. They are the instrument of the hardware package; they have no result. No `sudo`, no interface, no device, no service and no database of this Mac was touched; no port was bound (the probe and its pusher were doubles in the test).

## 1. What was built (all new, under `scripts/hardware-acceptance/`)

| File | Lines | Content |
|---|--:|---|
| `hw-collect-lib.sh` | 917 | the shared part: closed option forms, the Ubuntu 24.04 guard, the closed list of reading tools (`hw_reader_allowed`), the mask every printed line passes, the one output file per invocation, `--dry` |
| `collect-h27.sh` | 56 | `9A/H-27.6`: processes, listeners on 8000 / 8554 / 9997, the account `dems` |
| `collect-h01.sh` | 579 | `9A/H-01.2` `--profile` (HOST-01 to HOST-42), `.10` `--announce` (builds and runs the E-11b probe), `.11` `--series` |
| `collect-h02.sh` | 103 | `9A/H-02.2` `--before`, `.4` `--after --at 10|60 --before-file` |
| `collect-h24.sh` | 43 | `9A/H-24.1` `--tools` |
| `collect-h03.sh` | 61 | `9A/H-03.1` `--disk`, `.3` `--level` |
| `collect-h04.sh` | 55 | `9A/H-04.5` (four `--boot-log`) |
| `collect-h16.sh` | 82 | `9A/H-16.3` `--process`, `.6` `--after-refusal` |
| `collect-h05.sh` | 115 | `9A/H-05.1` `--installed`, `.5` `--journal`, `.7` `--core` |
| `collect-h25.sh` | 48 | `9A/H-25.1` `--tool`, `.3` `--state` |
| `collect-h06.sh` | 71 | `9A/H-06.2/.3/.4/.5/.7` `--state`, `.9` `--audit` |
| `collect-h07.sh` | 73 | `9A/H-07.1` `--host`, `.7` `--audit` |
| `collect-h08.sh` | 118 | `9A/H-08.2` `--config`, `.6` `--session S1`, `.7` `--first-second S1` |
| `e11b-announce-probe/probe.c` | 166 | the E-11b probe source, byte for byte the appendix of `test/007` (SHA-256 `6ed2cbda...bf1b`, the hash that record states; equal to `.cache/e11b-probe/probe.c`) |
| `e11b-announce-probe/README.md` | - | build line for the host, the run without an agent, the BR-10 readings with the Mac figures beside them, the seven E-11 near misses of `test/006`, with an Indonesian summary |
| `test_hw_common.sh`, `test_hw_collectors_host.sh` | 172, 749 | the test of the group (section 3) |

Checks covered: all 12 of chapter 2 (`9A/H-27`, `H-01`, `H-02`, `H-24`, `H-03`, `H-04`, `H-16`, `H-05`, `H-25`, `H-06`, `H-07`, `H-08`); every `SCRIPT` step of the chapter has its mode, 23 modes in all.

## 2. How the rules of the row are kept

| Rule | How | Evidence |
|---|---|---|
| Collect and print only | a reading tool starts only through `hw_read`, which refuses every tool and verb outside a closed list (`ss -H`, `ps -o`, `getent`, `findmnt`, `stat -c`, `namei -l`, `sha256sum`, `systemctl is-active/is-enabled/show/list-unit-files`, `dpkg -s/-S/-l`, `ip ... show`, `sysctl -n`, `timedatectl show`, `npm ... run db:status`, the count-only scan, the pinned `ffmpeg` decoding into nothing) | test part 5: every recorded start matches the list; part 1: changing verbs in the scripts 0 |
| No sudo | a reading that needs it is printed as a `USER` line and its output is handed over as a file (`--sudo-reads`, `--core-log`, `--journal-file`, `--audit-file`, `--boot-log`, `--alsa-config`) | part 1: commands that call `sudo`: 0 |
| Writes only into the passed folder | one file `h<NN>-run<k>[-mode][-session][-<at>s].txt`, never overwritten (a repeat takes `--run`) | part 6: package checksums equal, cwd / home / tmp empty |
| No secret | no option takes a password, key or token; the environment of the Core is never read (the USER hands over a count); every printed line passes the mask: locator credentials, tokens, stream addresses, named values and authorization lines become a marker and are counted; non-loopback addresses become their kind; hardware addresses a marker; the given account, interface and folders become the profile's placeholders | planted password and locator absent from every output; the product's `count-only.mjs` over the evidence folder: TOTAL 0 |
| Output | check identifier, step, the criterion quoted from the chapter, observations, "NOT A VERDICT" | `std` assertions per run |
| Exit code | 0 collected, 5 collected with a reading missing, 2 refused value, 3 not Ubuntu 24.04. None means passed | asserted |
| Dry mode | `--dry` (alias `--print-only`): starts no program (not even `awk`), reads and writes nothing; the only mode off Ubuntu | part 2, 23 runs on a path without any text tool |
| Verification cell: "each script has a dry mode; commands that type a credential, call sudo or change an address in the scripts: 0" | met | parts 1 and 2 |

## 3. Test on this Mac

`bash scripts/hardware-acceptance/test_hw_collectors_host.sh` (one run after the last change):

```
RESULT: 637 passed, 0 failed (host group; nothing here is proven on a host)
SKIPPED shellcheck is not installed on this machine: not run
```

Doubles: every reading tool is a script that records its name and arguments and prints canned text; `/etc/os-release`, `/proc`, `/run/dems-core-netalias`, `/etc/passwd` are canned files under a seam folder (`HWA_TEST_DIR`; an output taken this way carries the line `TEST DOUBLES IN USE`). For `--announce` the compiler double writes a probe double that prints the probe output of `test/007`; the pusher is a double. Also checked once, outside the test: the carried `probe.c` compiles on this Mac with the host build line (exit 0) and prints its usage; it was not run against a listener.

One defect the test found and that was fixed: the first mask marker held a colon, so a masked database locator still matched the scan's `database-locator` form; the marker is now `[masked-...]`.  A second one, found by the test of row 129: the mask replaced the number in the count lines of the scan itself (`camera-credential: 0`); those lines are now left as they are. Both tests were run again after it: 637 passed, 0 failed.

Unproven, all of it for the hardware package: every command on Ubuntu (option spellings of `ss`, `ps`, `namei`, `findmnt`, `dpkg`, the layout of `/proc/asound`), the build of the probe with the host's compiler, the `mpeg4` pusher, the field names of log lines of parts that were not built.

## 4. What the scripts assume about order (defect list for row 181; no chapter was changed)

1. `collect-h01.sh --profile` needs the five values of the profile and is run after step `.1`; it defers HOST-08, -36, -39, -40, -42 to `9A/H-16` / `H-17` as chapter 2 says, and leaves 12 sudo items "to judge" by the USER. The chapter's "one word per item, met or not met" is therefore four words here (met, not met, to judge, deferred): criterion 1 must say who turns "to judge" into a word.
2. `--announce` needs only HOST-12. It listens on 18563, outside 8554 to 8564, because the loopback rule of HOST-25 keeps the administrator's account off those ports. It pushes with the built-in `mpeg4` encoder: frame defect (3) is closed for the probe only. **`make e2e` (step `.9`) still has no pusher on the host** (its fixtures need `libx264`), so `--series` may have nothing to read.
3. `--series` selects the permanent cases by words in their names; rows 142 / 178 fix the names. It needs the USER to save the output of step `.9` to a file and to append `exit $?`.
4. `collect-h02.sh --after` does not wait: the USER times 10 s and 60 s. It needs the file of `--before`.
5. `collect-h16.sh --process` needs the Core's process id and its journal saved to a file; `--after-refusal` runs `npm --prefix <install-dir> run db:status`, which must be allowed to this account (who may read the database settings on the host is not stated: frame open point 2).
6. `collect-h05.sh --installed` compares the installed hashes with `scripts/host/netalias/` of the product tree; chapter 4 (not written when this row ran) governs. The request form of `9A/H-05.3` stays the chapter's.
7. Audit readings (`H-06.9`, `H-07.7`) need the audit list as a text file, one entry per line. **No chapter says how the USER obtains it** (the product's export answers with an export id).
8. `collect-h08.sh --config` and `--first-second` need copies the USER makes with sudo (the run directory and the media store are owner-only); chapter 2 does not name that step. B-7 is not in the frame (defect 6 of the controller's list).
9. Chapter 2 uses `--dry`; the brief's `--print-only` is accepted as an alias.

## 5. Driver decisions (to confirm)

| # | Decision |
|---|---|
| D-1 | Collectors refuse to run as root and never call sudo; privileged readings are handed over as files |
| D-2 | Exit code 5 for "collected with a reading missing", beside 0 |
| D-3 | The profile word is met / not met only where the profile states an exact text; otherwise "to judge" |
| D-4 | The probe's default pusher is the pinned ffmpeg with `mpeg4` on port 18563 |
| D-5 | The mask goes beyond the scan's needles (addresses by kind, hardware addresses, named values, placeholders for given values) |
| D-6 | A test seam `HWA_TEST_DIR`, marked in every output it produces |
| D-7 | `probe.c` is carried unedited (its comment still says "git-ignored") so that its hash stays the record's |
| D-8 | File options are named `--journal-file` and `--audit-file`, because `--journal` and `--audit` are modes of the chapter |
| D-9 | One shared test file `test_hw_common.sh` beyond the first claims line (claimed in a second line) |

## 6. Requests

None in `file_requests.md`.

---
*Generated: 2026-10-13 05:40 (host clock)*
