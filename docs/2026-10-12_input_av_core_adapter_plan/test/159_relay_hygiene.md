---
task_id: 2026-10-12_input_av_core_adapter_plan
row: 159
milestone: M3
date: 2026-10-13
agent: test-expert (batch 9, agent R8)
tier: T2
requirement: AD-12 (one check per point of S13-02): points (a), (b), (d); the brief's list: descriptors, limits, what `ps` shows, the exit code and word of every end
status: complete on this Mac's doubles, with ONE observation for the controller (section 5: a third descriptor on macOS) and two things this platform cannot show (section 7). No product file was changed, nothing was built
---

# Row 159: relay hygiene observed on a running relay - S13-02 (a), (b), (d)

Paths are relative to `/Users/gsp-budi/Documents/DEMS`. Runs: this Mac (arm64), loopback only, command sandbox off, the heavy-host lock taken per run, 2026-10-13 03:59 to 04:17 UTC. The engine is row 44's (`test/044_e12_credential_search.md`, section 2: the relay behind the real production door in a stand-in of the Core, the raw streams read beside the door, counts only). This record reads the 42 runs of row 44 and 27 runs of its own: **69 runs of 23 cases, 3 runs each.**

Binaries observed, hashed at the start of every run, the same in all 69: `build/capture-relay` sha256 `815725e3b054c52616916c792d79ccbbc283dc14ba064f44c51065d7ac444837`; `build/capture-worker` sha256 `fe6bda4e4cf4fb79a726165392e7d7b80c89e42e5af76a739c8a664a7b2a00ba`.

Result lines of the fixture, verbatim:

```
ROW159 HYGIENE: 27 run(s), 27 PASS, 0 FAIL, 0 FINDING; occurrences in all places of all runs: 0; relays left: 0; controls found: 27 of 27
ROW159 HYGIENE: 69 run(s) of 23 case(s); lines not of the fixed shape: 0; texts of a start message in the relay's streams or a door error: 0; most bytes on standard output 233 (report bound 6400), on standard error 991 (door copy bound 65536)
```

## 1. The three points

| Point of S13-02 | What was observed | Result |
|---|---|---|
| (a) codes and counters only, never library text, never a stream description | every line the relay wrote on standard error in 69 runs was parsed: one JSON object, every value a whole number or ONE word of letters, digits and underscores. The members that occurred, all runs: `relay`, `code`, `rc`, `pictures`, `held_back`, `gaps`, `challenges`, `answers_with_digest`, `forms_not_taken`, `keepalives`, `other_payloads`, `library_errors`. Standard output: report lines of the fixed shape or nothing | lines not of the fixed shape: **0**. Library text: **0**. The counter `library_errors` read 0 in every exit line. In the failure runs (wrong password, unreachable camera, hostile description - 3 runs each, and Basic only, a flooded answer, a refused push) the hostile codec text and its markup were searched in both streams: 0 |
| (b) both outputs inside their bound | bytes per stream and the longest line, per case (section 2) | standard output: at most 233 bytes (the probe line, 232 characters) against the relay's report bound of 6,400; standard error: at most 991 bytes, longest line 205, against the door's copy bound of 65,536. A camera that floods its answer (`--adversary flood-answer`): 0 bytes on standard output, 197 on standard error, exit 31. The door's copies equalled the raw streams in length in 54 of the 54 door runs whose parent lived to the end (nothing was cut, nothing was blanked); the 3 runs with a killed parent have no copy |
| (d) the start message is never echoed; a failed write names no part of it | the run's texts (password, account, locator, its path, the ingest address, its last element) searched in both raw streams and the door's three copies, 69 runs; the door's error in every printed form (message, stack, text form, JSON of all own members, deep inspection, cause) in the runs where the door refused | occurrences: **0**. A start write that FAILED (the relay was handed an argument and ended with `USAGE` before it read; the message was made larger than a pipe, 300 KB): the door's error is `ProductionDoorError`, code `PRODUCTION_START_MESSAGE_NOT_TAKEN`, own members `code`, `message`, `name`, `stack`, no cause; occurrences of the password, of its first 33 characters, of the account, the locator and the ingest address in it: 0 in 3 of 3 runs |

## 2. Every end: the exit code, the word, the outputs (3 runs per case)

| Case | End | Word the relay wrote in its exit line | Standard output: most bytes, longest line | Standard error: most bytes, longest line | Lines not of the fixed shape | Texts in the streams and the door's error |
|---|---|---|---|---|---|---|
| the order to stop (record) | 0 | `STOPPED` | 48, 47 | 583, 198 | 0 | 0 |
| the order to stop after a loss and a re-open | 0 | `STOPPED` | 206, 94 | 991, 202 | 0 | 0 |
| record, special-character account, then the order to stop | 0 | `STOPPED` | 48, 47 | 583, 198 | 0 | 0 |
| probe (and probe with the special account) | 0 | `STOPPED` | 233, 232 | 589, 199 | 0 | 0 |
| an argument handed to the relay | 2 | `USAGE` | 0, 0 | 187, 186 | 0 | 0 |
| unreachable camera | 20 | `CAMERA_UNREACHABLE` | 0, 0 | 201, 200 | 0 | 0 |
| the camera never back after the push stood (6 tries) | 20, 62.14 / 62.17 / 62.15 s after the loss line | `CAMERA_UNREACHABLE` | 111, 62 | 797, 201 | 0 | 0 |
| Basic only | 22 | `AUTH_SCHEME_NOT_ALLOWED` | 0, 0 | 206, 205 | 0 | 0 |
| wrong password (record and probe) | 23 | `AUTH_REFUSED` | 0, 0 | 195, 194 | 0 | 0 |
| hostile description | 28 | `CODEC_NOT_SUPPORTED` | 0, 0 | 202, 201 | 0 | 0 |
| a flooded answer | 31 | `CAMERA_STALLED` | 0, 0 | 197, 196 | 0 | 0 |
| a wrong-path push refused by the worker's gate | 40 | `INGEST_REFUSED` | 0, 0 | 396, 198 | 0 | 0 |
| the worker killed under the push | 41, 40 / 4 / 19 ms after the kill | `INGEST_LOST` | 48, 47 | 588, 198 | 0 | 0 |
| killed at the 25 s bound; an aborted open | signal `SIGKILL`, no code | none (killed) | 0, 0 | 199, 198 | 0 | 0 |
| the parent killed in a retry wait, through the door | not observable (no parent left) | not observable | 111, 62 (before the kill) | 597, 202 (before the kill) | 0 | 0 |
| the same, the observer holds the pipes | code not observable | `STOPPED` (191 bytes after the kill) | 111, 62 | 788, 202 | 0 | 0 |
| the door refuses the start (its own core-file limit is not 0) | no process | - | 0, 0 | 0, 0 | 0 | 0 |

In every case with a code, the word in the relay's exit line is the name of the exit code in `src/relay/relay.h`. The codes not run here (10, 11, 21, 24 to 27, 29, 30, 32, 33, 42, 43, 70) are rows 41, 42, 152 and 186.

## 3. What `ps` shows (every process sample of 69 runs)

| Process | Arguments | Environment | Occurrences of the run's texts |
|---|---|---|---|
| the relay | 1 word: the program path | 0 words | 0 in 2,039 readings of each (all cases, the next line included) |
| the relay handed an argument (two cases) | 2 words | 0 words | 0 |
| the worker | 9 words: its switches and two paths of the run folder | 0 words | 0 in 2,058 readings of each |
| the relay's parent (the stand-in of the Core; in 9 runs a parent of the fixture) | 4 words (the stand-in) | its shell's, 71 or 72 words | 0 in 2,300 readings of each |

The control (a planted text as an argument, another in the environment of a sleeping process) was found by the same two `ps` calls in every sample of 69 of 69 runs.

## 4. The limits

| Limit | Observed | How |
|---|---|---|
| the door starts nothing when the server's core-file limit is not 0 | 3 of 3: `PRODUCTION_CORE_FILE_LIMIT_NOT_ZERO`, no process, the door read `Infinity`; in the 57 other door runs it read `0` and the relay inherited that | the stand-in started with a soft limit equal to its hard limit |
| file-size limit 0 in the relay (row 153) | standard error pointed at a regular FILE, the camera unreachable: exit 20 as through a pipe, the file holds **0 bytes** in 3 of 3 runs (through a pipe the same end writes 201 bytes) | direct start by the fixture: the door only makes pipes |
| regular files or folders held by a descriptor of the relay | 0 in 2,018 `lsof` samples | section 5 |
| the relay's core-file limit and file-size limit as NUMBERS | **not observable on macOS**: no tool reads the limits of another process without root | row 141 (`/proc/<pid>/limits`), `9A/H-01`, `9A/H-24` |

## 5. The descriptors (2,018 `lsof` samples of the relay)

| When | Descriptors held | Samples |
|---|---|---|
| the camera leg open, no push yet | 0, 1, 2 (the door's three pipes: local socket pairs, `unix`, in Node; `PIPE` from the Python parents) and 3 = TCP to `127.0.0.1:8565` | 726 |
| the push stands | 0, 1, 2; 3 = the camera; 5 = TCP to `127.0.0.1:8559`; **and 4 = type `systm`, lsof name `com.apple.netsrc`** | 319 |
| the push stands, the camera leg closed (a retry wait) | 0, 1, 2; 5 = the push; 4 = the same `systm` descriptor | 966 |
| a sample taken while the process ended | none listed | 7 |

Network sockets: never more than 2; peers only the locator's port and the ingest port given; listening sockets seen: 0; a socket that was not connected: 0. Regular files or folders: 0.

**OBSERVATION for the controller (not a secret finding).** "Only its standard streams and its two sockets" does not hold on macOS: from the moment the push connection is opened until the relay ends, a sixth descriptor exists, of type `systm`, named `com.apple.netsrc` - in 1,285 of 1,285 samples with a standing push, in every one of the 21 runs that pushed. By its name it is a control socket to the kernel; it has no file and no network peer. It appears with the push leg and never with the camera leg alone (726 samples), which the relay dials itself. HYPOTHESIS, not verified here: the system library opens it for source-address selection when the media library looks up the push address. The relay's own socket rule (row 153) evidently does not count it. It is a property of this platform's library, not of the relay's code; on Linux no such descriptor is expected. It is left to row 141 to read `/proc/<pid>/fd` in the container (request filed); if one more descriptor exists there too, the rule "two sockets" of RC-6 needs its wording.

**A careless parent.** The relay was started by a parent that hands on two more descriptors (a regular file opened for writing and a pipe). A control program that closes nothing, started the same way, holds both (`lsof`: one `REG`, one `PIPE` above descriptor 2, in 3 of 3 runs). The relay holds neither: 48 of 48 samples show 0, 1, 2 and the camera socket only. The relay closes what it did not ask for.

## 6. Commands (repository root, command sandbox off)

```sh
/usr/bin/lockf -k -t 1800 .locks/heavy-host.lock \
    python3 -B apps/capture-worker/test-fixtures/row159_relay_hygiene.py run <case> <n>      # one run per lock hold

for n in 1 2 3; do for c in $(python3 -B apps/capture-worker/test-fixtures/row159_relay_hygiene.py cases); do
  /usr/bin/lockf -k -t 1800 .locks/heavy-host.lock \
      python3 -B apps/capture-worker/test-fixtures/row159_relay_hygiene.py run $c $n >> .cache/row159-hygiene/batch.log 2>&1
done; done

python3 -B apps/capture-worker/test-fixtures/row159_relay_hygiene.py summary     # occurrences per place of this row's 27 runs
python3 -B apps/capture-worker/test-fixtures/row159_relay_hygiene.py hygiene     # sections 2 and 5, over the runs of rows 44 and 159
```

Cases of this file: `end_by_order`, `end_worker_killed`, `end_camera_never_back`, `flood_answer`, `usage_argument`, `failed_start_write`, `door_core_limit`, `stderr_on_a_file`, `careless_parent`. The other 14 are row 44's. Results: `.cache/row159-hygiene/runs/<case>_<n>/result.json` (counts only), git-ignored.

Six of the nine cases were run once before the 27 while the fixture was written (all passed; overwritten). The 27 are the first full series; none was repeated.

## 7. Unproven here, and where it goes

| What | Goes to |
|---|---|
| The relay's limits as numbers; "not dumpable" and "no new privileges" (S13-02 (c), AD-09 (2)) | row 141, `9A/H-01`, `9A/H-24` |
| The descriptor list on Linux (section 5) | row 141 |
| An output LARGER than the door's 64 KiB copy bound: no case made the relay write more than 991 bytes, so the cut itself was not exercised with the real relay | row 21's unit test of the door (a double that writes more); nothing in the relay writes without a bound (row 186) |
| A start write that fails because the relay never reads (it stays alive with a full pipe): the real relay always reads or ends | row 21's unit test (`never-read` double, `PRODUCTION_START_MESSAGE_TIMEOUT`) |
| Library text of the Ubuntu library version (another libavformat build may log where this one does not) | row 141 |
| A real camera's answers | `9A/H-10` to `H-12`, `H-23` |

## 8. Driver decisions (for the controller to confirm)

1. **Points (a), (b), (d) are read over the runs of row 44 as well** (one engine, one series): the row's "three failure runs" are wrong password, unreachable camera and hostile description, 3 runs each, plus six more ends.
2. **The `systm` descriptor is reported as an observation, not as a red**: the product was not changed and no rule was edited.
3. **The failed write was forced with an argument and a 300 KB password**: with a message of the real size the write succeeds before the relay has ended, and no error exists to be read.
4. **Two cases start the relay without the door** (a file as standard error, a careless parent): the door cannot make either.

## 9. Files

New, test code only: `apps/capture-worker/test-fixtures/row159_relay_hygiene.py` (imports row 44's engine). Docs: this record, `delegation_progress/row_159.md`. The Edit-only rule was kept: no existing file of the repository was changed except one line each in `delegation_progress/file_claims.md` and `file_requests.md`, with the Edit tool. Nothing was committed, staged or stashed; no process and no listener of the runs is left.

---
*Generated: 2026-10-13*
