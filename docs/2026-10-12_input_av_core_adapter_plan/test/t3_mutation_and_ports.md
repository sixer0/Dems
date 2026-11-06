---
task_id: 2026-10-12_input_av_core_adapter_plan
row: T3
date: 2026-10-13
agent: test-expert (T3, track D)
tier: T2
source: verification/060c_m3_review_third_pass.md (sections 3 to 6: T-01, T-02, X-01, the eighteen survivors), decisions/decisions.md C61 (4), C95, C98, C100 (2)
status: complete - 18 of 18 survivors red on a mutant; ports and locks done; X-01 does not hold (measured, nothing changed in the order); the header parse measured, the bound exists and is now held by a test
---

# Row T3 - the survivors of review 60c made red, a port per test, X-01, the `WWW-Authenticate` parse

Tree: branch `task4/input-av-core-port`, head `0f5d2a8e`, plus the uncommitted working tree. **No product source was
changed**: the one exception the brief allowed (a length check in `onvif-session.ts`) was not needed - the check exists
(section 4). Existing files were changed with the Edit tool only; new files with Write. Nothing was committed.

Scratch of every script, mutant and output named below: `.cache/task4-t3/` (git-ignored).

## 0. Method

- **A mutant of a TypeScript file is made IN MEMORY**: `.cache/task4-t3/vitest.mut.config.mjs` is the Core's own vitest
  configuration plus one transform that replaces ONE text of a module as the test imports it, refuses to run when the
  text is not there, and writes a line for every module it changed ("hits"). No file of the repository is written, so
  there is nothing to revert; the proof is the write time of each product file (section 6).
- **Where the survivor is a broken instrument** (a search that always answers 0, a camera that left no counters, a
  listing that shows no environment) the mutant is of the TEST's instrument, by the same transform, and is named as such.
- **A mutant of the relay** is a stand-in program or a patched start in a scratch driver; the relay's C source was not
  mutated and nothing under `apps/capture-worker/build` was rebuilt (binaries unchanged by this row).
- Green afterwards: every changed file ran unmutated after its last edit (section 5).

## 1. The eighteen survivors (review 60c section 6)

`CS` = `apps/core-server/src`, `WRK` = `apps/capture-worker`. "Red" = the result line of the mutant run; "hits" = the
transform's own count of replaced texts. Every mutant run is in `.cache/task4-t3/mutant_<label>.log` / `out_<label>.log`.

| # | Survivor | What the test asks now | Mutation (in memory unless said) | Red |
|---|---|---|---|---|
| 1 | `onvif-network.test.ts`, the source bind | (a) on the wire: a rule that names source 192.0.2.1 -> `NO_ANSWER`, 0 requests at the stub, control from 127.0.0.1 `SET`; (a) as asked: every connection reaches the agent's maker with the rule's source, family 4, the rule's host and port (control: another source is recorded as that one) | `onvif-network.ts`: `, localAddress: destination.sourceAddress, family: 4 }` -> ` }` | `2 failed, 24 passed (26)`: both (a) cases |
| | | | `, family: 4 }` removed | `1 failed, 25 passed`: "(a) as asked" alone |
| 2 | same file, the connection limit | (b) a connection that is never established (the agent's real maker is handed a host name and a resolver that never answers): ONE timer of `connectMs` (1,234 of this call) is asked; nothing ends the call before; firing it ends it `NO_ANSWER`. (b) other side: one timer per request, each cancelled | `if (socket.connecting === true) socket.destroy();` removed | `1 failed`: (b) |
| | | | `timers.after(limits.connectMs,` -> `limits.requestMs` | `2 failed`: both (b) cases |
| | | | the timer not asked of the seam | `2 failed`: both (b) cases |
| | | | `socket.once('connect', established);` removed | **survives, 26 passed - an EQUIVALENT mutant**: the same `established` runs at `close`, and a timer that fires on an established socket does nothing. Left, with this reason |
| | (the request limit, T-02 (b) second half) | (c) a device that accepts, takes the request and never answers: `NO_ANSWER` after `requestMs` (400 ms of this call), between 350 ms and 4 s, ONE request | `timeout: limits.requestMs,` removed | `1 failed`: (c), 4,005 ms |
| | (the reply guard of row B1, T-02 (c)) | row B1's block exists (five cases, after the review). Added (d): a refused shape of 12 KiB at the gateway step - the reboot is NEVER SENT (control: a fault there IS followed by the reboot). By behaviour, not by the clock | `guardOnvifReplies(` replaced by a function that does nothing | `4 failed`: B1's three (35 s each: the stall is back) and (d) |
| 3 | `adopted-camera-test.db.test.ts`, the leak sweep's control | the sweep is ONE function over places read anew (log sink, reader's error log, audit trail, registry rows - new -, answers, notes, relay arguments). Real run first: 0 in all seven. Then the account's secret is planted THROUGH THE PRODUCT'S SINKS - a line of the app's logger, an error-log entry, the message of an audit entry written through the app's pipeline, a column of a registry row, an answer, a note, an argument list - and the same sweep must answer 1 in each | of the test's search: `occurrencesIn` answers 0 always | `1 failed, 15 passed (16)`: `expected { log: +0, ... } to deeply equal { log: 1, errorLog: 1, audit: 1, ... }` |
| 4 | `camera-adapter-open.db.test.ts`, the same | the same, six places | the same | `1 failed, 11 passed (12)` |
| 5 | `connect.db.test.ts:713` "every stored profile element ..." | NEW case beside it: as `dems_app`, the same lists written into a registry row in a rolled-back unit - the nine refused by `capture_devices_profiles_code_check` (23514, by name), the four taken, a non-list by `capture_devices_profiles_check`; the row is as it was | the CHECK of migration 0022 dropped on the throw-away clone (`ALTER TABLE ... DROP CONSTRAINT`, injected at the head of the case) | `1 failed, 1 passed`: the new case (`["profile_1"]: expected 'answered' ...`). The OLD case stays green on the mutant - the review's point, measured |
| 6 | `stream-test.db.test.ts:245` HEVC "... the statement of the recorded file" | the code was pinned exactly already (`['HEVC_1080P']`). The comparison with the recorded file is a CASE OF ITS OWN ("row 51: ..."), per codec: made when the file is there, skipped BY NAME when it is not, a failure when it is not there and `DEMS_REQUIRE_RECORDED_FILES=1` | of the test: the folder of the recorded files named as one that is not on this host | without the flag: the two cases are skipped by name (`13 skipped`: 11 by the run's filter, these 2 by name); with the flag: `2 failed`: `the file row 46's T-2 recorded is on this host: expected false to be true` |
| 7 | `:280` H.264 "... the statement of the recorded file" | the ONE code `H264_1080P25` (the test camera's 25 pictures a second), not `H264_1080P` followed by any digits; and the case of 6 | `stream-probe.ts`: `frameRate: codec === 'H264' ? statement.declaredRate(report.sps) : null` -> `frameRate: null` | `2 failed, 11 passed (13)`: `expected [ 'H264_1080P' ] to deeply equal [ 'H264_1080P25' ]`, and the row-51 case of h264 |
| 8 | `:362` "a codec name in lower case" | ONE answer: `REACHABLE`, `['HEVC_1080P']`, codec HEVC, relay exit 0, four Digest exchanges at the camera | `stream-probe.ts`: HEVC refused by a code word (`codec === null \|\| codec === 'HEVC'`) | `2 failed`: this case (`expected { outcome: 'NOT_H264' ...`) and the HEVC case |
| 9 | `:373` "... the other port never visited" | `end()` of the camera THROWS without its exit line and its counters; the three `second_port_*` names are 0 in counters that were written; each camera did make the answer that pointed at the other port (`foreign_control_descriptions`, `redirects_sent` = 1) | of the test's camera: killed before it writes its exit line (`child.stdin.end()` -> `child.kill('SIGKILL')`) | `16 failed, 4 passed (20)` over this file and the next: `the test camera "sdp-control-other-port" left no exit line with its counters: nothing it did not do is proven` |
| 10 | `minted-code.db.test.ts:350` "... never authorized" | the same `end()`; the same two "the temptation was there" counts | the same | in the 16 of row 9 |
| 11 | every `auth_basic ?? 0` of the four database files | the same `end()` in all four copies | the same, the other two files (three cases by filter) | `3 failed`: cameras "passed", "sink-h264", "basic-only" |
| 12 | `connect.db.test.ts:518` "a credential row that cannot be written ..." | the registrar DID return (flag), and the unit ended by `23514` of `capture_device_credentials_nonce_check`, by name | `adoption.ts`: `writeAdoptedCameraStreams` throws `XX000` first (the registrar fails earlier, for another reason) | `1 failed`: `expected false to be true` |
| 13 | `connect/__tests__/service.test.ts:237` "control: a flow that falls back ..." | calls only the product, in ONE world: no credential -> 422 and 0 contacts; then the body's credential -> ONE contact that carries exactly it | `connect/service.ts`: the `CREDENTIAL_REQUIRED` refusal of `permitFor` removed (the product goes on without a credential) | `2 failed, 3 passed`: this control and the case above it (`expected a refusal, got an answer`) |
| 14 | `adopted-camera-test.db.test.ts`, the function-level cases | the tester wrapper of `bounds()` hands the FOURTH argument on and keeps it; the passed case expects `127.0.0.1`; NEW wire case: a stored-address rule that names source 192.0.2.1 -> 0 requests at the ONVIF device, 0 relays, `UNREACHABLE`, entries `[reveal, outcome]` | `adopted-test.ts`: `tester.test(camera, sealed, deadline.signal, sourceAddress)` without the last argument | `2 failed, 14 skipped (16)`: `expected undefined to be '127.0.0.1'`, `... '192.0.2.1'` |
| 15 | `WRK/test-fixtures/row042_probe.py`, the hostile-codec run | the hostile name and four pieces of it are COUNTED in every value of every relay line (0 required); a control in the run (the same count over a planted line finds all five); the double was asked for the description | a STAND-IN relay (`x04_standin_relay.py`) that writes the codec name as the value of a known key, then the right exit line | every criterion the run had before: true. New: `no_piece_of_the_hostile_text_in_any_value_of_a_relay_line: False` (counts 1 / 15 / 1 / 15 / 15), `VERDICT: FAIL` |
| 16 | `row186_bounds.py`, `the_listener_took_no_connection` (a literal `True`) | replaced: after the relay is gone the listener's queue is read once - ONE connection, whose first word is the request that was never answered (`DESCRIBE`) | scratch driver: the listener stands on another port, so the relay never reaches it | the old literal: still `True`. New criterion `False` (queue 0); the run FAILs (also by its exit code) |
| 17 | `row041_relay.py`, the environment half; `camera-adapter-open.db.test.ts:558, 571` | a CONTROL process with one marker variable, read by the same listing: the marker must be shown; and the relay's listing must be its arguments and nothing else | fixture: the control made with a program of the system (`/bin/sleep`) | `verdict FAIL`: `the_listing_shows_an_environment_and_the_relay_has_none: False` |
| | | | fixture: the relay started with one variable that holds the session's ingest address | `verdict FAIL`: both the old and the new criterion `False` (2 occurrences) |
| | | | database test: the listing asked without `e` (`['ww', ...]`) | `1 failed`: `expected { inEnvironmentListing: false ... }` |
| | | | product, `relay-start.ts`: `env: { DEMS_ROW_T3_LEAK: start.locator }` | `1 failed` - by an EARLIER guard: the production door refuses a non-empty environment (`the relay of this camera could not be started`). The listing half is not reached by one product mutation; the fixture's mutant above reaches it |
| 18 | `rtsp_test_camera_check.py`, base suite with `--runs 0` | `and bool(result["runs"])`, as the two later suites | (the file before the edit is the mutant) | before: `RESULT PASS runs 0`, rc 0. After: `RESULT FAIL runs 0`, rc 1; `--runs 1`: `RESULT PASS runs 4 passed 4` |

**Count: 18 of 18 red on a mutant. Left: 0 of the eighteen.** Three qualifications, none hidden above:
row 6 is red only with the flag set (without it the case is skipped by name - visible, no longer silent); one mutant of
row 2 is equivalent and survives; rows 8 and 15 were not shown on a mutated RELAY (C source untouched): 8 on the Core's
side of the same judgement, 15 on a stand-in.

**A FINDING made on the way (row 17).** On this Mac (macOS 27.0.1) `ps eww` shows NO environment for a program of the
system: `/bin/sleep` started with one marker variable lists as `/bin/sleep 5` and nothing else. It does show the
environment of a program that is not the system's (Node, Python, and the relay: the fixture's leak mutant was seen).
The reviewer's doubt was therefore right for one class of program; the controls use a program of the relay's class.

Not in the eighteen, NOT done (the review's "weaker, noted and not counted" and its other follow-ups): `camera-watch.test.ts:578`,
`stored-address.test.ts:125`, `br09_gate.py:212`, `onvif-relay.test.ts:643, 710`; T-07 beyond the lock helper (the four
copies of `startCamera` / `lineReader` stand; T-04 was fixed in each), T-10, T-11, T-12; X-02, X-03, X-05, X-08; notes
N-01 to N-09. Reason: outside the fixed list of this row.

## 2. T-01: a port per test, and the lock

### The port table (after this row)

| Kind | Port | The ONE test file of the Core that names it |
|---|---|---|
| scripted ONVIF device, fixed list | 8555 | `modules/capture-config/__tests__/adopted-camera-test.db.test.ts` |
| | 8557 | `modules/capture-config/__tests__/camera-adapter-open.db.test.ts` |
| | 8575 (NEW on the list) | `modules/capture-discovery/connect/__tests__/stream-test.db.test.ts` (was 8557) |
| | 8576 (NEW on the list) | `modules/capture-discovery/connect/__tests__/minted-code.db.test.ts` (was 8557) |
| scripted ONVIF device, no fixed port | a port the system hands out (>= 32768) | `capture/adapters/camera/__tests__/onvif-session.test.ts` (was the first free of 8561, 8560, 8559, 8557, 8555) |
| test camera (8565-8574, C33) | 8565, 8566 | `stream-test.db.test.ts` |
| | 8567, 8568 | `minted-code.db.test.ts` (was 8565, 8566) |
| | 8569 | `adopted-camera-test.db.test.ts` (was 8565) |
| | 8570 | `camera-adapter-open.db.test.ts` (was 8565) |
| worker's range, under the lock only | 8559, 8561 (worker of `row046_adapter_listener.py`), 8563 (the file's sink) | `camera-adapter-open.db.test.ts` |

`ODD_DEVICE_PORTS` of `test/support/onvif-odd-device.ts` is `[8555, 8557, 8575, 8576]`: **8559, 8560 and 8561 are off
it** (the worker's listeners; the cause of T2's `INGEST_OPEN_FAILED`). `freeOddDevicePort()` asks the system for a port;
`createOddOnvifDevice` takes a port of the list or one the system handed out. `onvif-network.test.ts` binds only ports
the system chooses (its stub, row B1's listener, this row's listener).

**Proof that none is used twice** (search of `apps/core-server/src` and `test`, each number against the port constants):
`8555: adopted-camera-test` / `8557: camera-adapter-open` / `8559, 8561, 8563: camera-adapter-open` / `8560: (none)` /
`8565, 8566: stream-test` / `8567, 8568: minted-code` / `8569: adopted-camera-test` / `8570: camera-adapter-open` /
`8571-8574: (none)` / `8575: stream-test` / `8576: minted-code`. One file per number. (The worker's Python fixtures
use 8565, 8567, 8572, 8574 and the worker's listeners; they run under the heavy-host lock, as every case below does.)

### The lock

New `apps/core-server/test/support/heavy-host-lock.ts`: the helper of pass I-9a, moved out of
`camera-adapter-open.db.test.ts`, one copy. `itUnderHeavyHostLock(name, body, timeout)` runs a case under
`.locks/heavy-host.lock` and adds the wait (900 s) to the case's own timeout; `takeHeavyHostLock()` for a block; a run
started under the lock is not asked again; a second take in the same process joins the first; the holder ends when the
test process ends. **Every case that starts the test camera or the relay now takes it**: 10 of `stream-test`, 4 of
`minted-code`, 5 of `adopted-camera-test`, and in `camera-adapter-open` the three worker cases (as before) plus the
whole sink block from its `beforeAll` to its `afterAll`. The cases that need "nothing listens on the camera's port"
(`stream-test` "no camera at the stream address", `adopted-camera-test` "UNREACHABLE AFTER THE REVEAL") hold it too.
The RUN line of each header says: database lock outside, the cases take the heavy-host lock themselves.

### The run together

`.cache/task4-t3/dbrun.sh`: the four files and `connect.db.test.ts` in ONE vitest run, `--project db --maxWorkers=2`,
under `.locks/db-migrate.lock` only, three times after the last edit of a test body:

| Run | Result | `EADDRINUSE` lines | Load (1 m) |
|---|---|---|---|
| 1 | `Test Files 5 passed (5)`, `Tests 73 passed (73)`, 56 s | 0 | 5.96 |
| 2 | `Test Files 5 passed (5)`, `Tests 73 passed (73)`, 55 s | 0 | 6.08 |
| 3 | `Test Files 5 passed (5)`, `Tests 73 passed (73)`, 54 s | 0 | 5.16 |

(Two earlier runs of the same five while the row was built: 70 of 73 with three reds of this row's own new assertions,
then 73 of 73; `EADDRINUSE` 0 in both.) Not shown: a run of these beside ANOTHER session's worker fixture - no other
session held the lock for long while these ran; the lock's own behaviour is `lockf`'s.

## 3. X-01: is the camera double started inside the relay's give-up window?

**From the code.** `e11_listener_path.py:session` sends START, waits for the listeners, starts the microphones, sleeps
1.5 s and calls the script. `row041_relay.py:session_run` then starts, in this order: the camera double (and waits for
its `ready` line), the control push, the relay - `row043_reopen.py`, `row042_probe.py record` and `row186_bounds.py
session` go through the same function. So the review's reading of the ORDER is right for these: the camera double's
start is spent inside the window, before the control push. `row58_gate.py` is NOT of this kind: its script starts the
control push FIRST and has no camera double at all. The worker's bounds (`src/capture_worker.c:444`,
`src/ingest.c:545`): a camera whose open is still WAITING `listen timeout + 10 s` after START is given up
(`INGEST_OPEN_STUCK`); the harness's listen timeout is 12 s, so 22 s. A listener nobody reached ends at 12 s by another code.

**Measured** (`camera_start_time.py`, loopback 8571 under the lock, load 4.8; and three record sessions with the
timeline this row added to the fixture's result, load 6.3 to 6.6):

| What | Seconds |
|---|---|
| camera start to `ready`, clip in the cache (h264 / hevc, 5 runs each) | 0.05 - 0.07 / 0.04 - 0.05 |
| the same with an EMPTY cache (one FFmpeg encode; 3 runs each) | h264 0.30 - 0.32; hevc 1.89 - 1.96 |
| after the START ack: script called / camera ready / control push started / relay started / worker connected | 1.60 - 1.62 / 1.66 - 1.68 / 1.66 - 1.69 / 1.66 - 1.69 / 2.90 - 2.93 |

**Verdict: X-01 DOES NOT HOLD as a cause.** The camera double costs 0.05 s of a 12 s window (the clips have stood in
the cache since 01:10 on 2026-10-13); with an empty cache 1.9 s at most at load 5. To pass even the 12 s window the
encode would have to be five times slower - and that end is not `INGEST_OPEN_STUCK` but the listen timeout's own code.
`INGEST_OPEN_STUCK` needs a peer that DID connect and an open that then hangs for 10 s more; a late camera double does
not make that. **The fixture's start order was not changed and the ten runs the brief ties to a change were not made.**
What stays in the fixture is the instrument: every session result of `row041_relay.py` now holds
`timeline_s_after_start_ack` and the load, so the next `INGEST_OPEN_STUCK` comes with its own timeline. Row T2's
tally (0 of 240) and this measurement leave the code unexplained; S-09 (the bound against a real-time pusher) is the
hypothesis that remains.

## 4. The `WWW-Authenticate` parse (decision C100 (2))

**How the package is reached** (read: `onvif@0.8.3`, `lib/cam.js:308-345, 412-421`, `lib/utils.js:129-162`;
`onvif-session.ts:296-300, 627-636`): Node's HTTP parser - `res.headers['www-authenticate']` -
`getDigestHeaders(res.rawHeaders)` - the client's `digestAuth`, which the session file REPLACES by a wrapper that keeps
only the challenges `digestChallengeAllowed` admits and hands those to the package's `Cam.prototype.digestAuth` ->
`_parseChallenge` -> `splitArgs` and one regular expression per part. `onvif-network.ts:246-250, 433-441` is the same.

**The limit of the header**: Node's parser lets through a response head of at most `http.maxHeaderSize` = **16,384
bytes** (Node v26.8.2; status line and every header together; no start flag of the Core raises it). One header value
can therefore be about 16,000 characters.

**Measured** (`.cache/task4-t3/header_parse.cjs`: the package's own functions, called as the wrapper calls them, and
the package alone; best of 7; results in `header_parse.json`):

| Shape | 2,048 chars | 16,000 chars (package alone) | Exponent 2,048 -> 16,000 |
|---|---|---|---|
| many commas | 0.024 ms | 0.10 ms | 0.69 |
| many quotes | 0.019 ms | 0.09 ms | 0.76 |
| a long unterminated quoted string | 0.020 ms | 0.11 ms | 0.85 |
| repeated `nonce=` | 0.029 ms | 0.19 ms | 0.92 |
| repeated scheme words | 0.018 ms | 0.10 ms | 0.84 |
| `algorithm` words / `algorithm` then spaces (the session file's own expression) | 0.017 - 0.018 ms | 0.10 ms | 0.80 - 0.85 |
| a name without `=` | 0.020 ms | 0.12 ms | 0.86 |
| **a run of spaces, then a quoted value with a tail** (`a=<spaces>"x"y`) | **0.86 ms** | **53.8 ms** | **2.00** |

**The curve in one line:** linear for the five shapes of the brief; QUADRATIC for one shape the package's part
expression walks back over (`^\s*?([a-zA-Z0-9]+)="?([^"]*)"?\s*?$`), 53.8 ms at the largest admissible header - above
the 50 ms mark - **in the package alone**.

**As the product calls it, it does not bite**: `digestChallengeAllowed` refuses a challenge above 2,048 characters
BEFORE the package sees it (both files). Worst measured through that filter: 0.86 ms for one header, 1.01 ms for a head
full of seven such headers (the package stops at the first part that does not match: a slow part is always a failing
one, so one per exchange). The expression of the filter itself is linear on the shapes tried.

**So no bound was added - and the bound that exists was held by NO test**: with ` || challenge.length > 2_048`
deleted, `onvif-session.test.ts` passed 62 of 62 and `onvif-network.test.ts` 19 of 19. One case in each file now holds
it: 2,049 characters -> `SCHEME_NOT_ALLOWED`, 0 requests carried the credential, the package's `digestAuth` not
reached (counted on its prototype); 2,048 is answered (control: one request with `Digest`, refused); the quadratic
shape at 16,000 characters is refused the same way in under 2 s. Mutant (the bound deleted): `1 failed, 62 passed (63)`
and `1 failed, 25 passed (26)`, that case in each. No failing-then-skipped reproducer was written: there is no open
finding to hold - the reproducer is the passing case.

Not measured: a real camera's challenge (its length is unknown here; 2,048 is far above the examples in the package's
own comments, about 150 characters). A device whose challenge is longer is refused as `SCHEME_NOT_ALLOWED`: a named
item for the hardware chapters, with the reply caps of C100 (1).

## 5. Checks (after the last edit)

| Command | Result |
|---|---|
| `vitest --project unit` `src/capture/adapters/camera` `src/modules/capture-discovery` `test/support` | `Test Files 25 passed (25)`, `Tests 565 passed (565)` |
| of these: `onvif-network.test.ts` / `onvif-session.test.ts` / `connect/__tests__/service.test.ts` | 26 passed / 63 passed / 30 passed |
| the five database files together, three times (section 2) | `73 passed (73)` x 3, `EADDRINUSE` 0 |
| `adopted-camera-test` + `camera-adapter-open` once more after a lint fix in their last case | `Test Files 2 passed (2)`, `Tests 28 passed (28)` |
| static set (`test/static` and every `static*.test.ts` under `src`) | `Test Files 45 passed (45)`, `Tests 778 passed (778)` |
| `tsc --noEmit -p apps/core-server` | rc 0, 0 errors |
| `oxlint` on the ten changed or new TypeScript files | rc 0, 0 warnings (two of this row's own were fixed) |
| `sh check.sh src`, `sh check.sh --selftest`, `sh relay-check.sh src/relay` (from `apps/capture-worker`) | rc 0, 0, 0 |
| `row042_probe.py start` (under the lock) | the hostile-codec run `PASS`; summary `21 run(s), 21 PASS, 0 FAIL`, rc 0 |
| `row186_bounds.py session` (under the lock; it uses row 41's session run and `recorded`) | 3 session runs PASS with the new criterion; summary `23 run(s), 23 PASS, 0 FAIL`, rc 0 |
| `row041_relay.py`, one record session three times (scratch driver, the fixture's own function) | 3 PASS |
| `rtsp_test_camera_check.py --runs 1` / `--runs 0` | `RESULT PASS runs 4 passed 4` / `RESULT FAIL`, rc 1 |

Not run: `npm test`, `npm run test:db`, `make` of the worker, `row041_relay.py all`, `row043_reopen.py` (it goes
through the same `session_run`; its cases are minutes long and were left to the controller's suite).

## 6. Files

Changed (Edit tool only):
`apps/core-server/src/capture/adapters/camera/__tests__/onvif-network.test.ts` (one block appended, one import),
`.../onvif-session.test.ts` (one block appended),
`src/modules/capture-discovery/connect/__tests__/stream-test.db.test.ts`, `minted-code.db.test.ts`, `connect.db.test.ts`, `service.test.ts` (the one control),
`src/modules/capture-config/__tests__/adopted-camera-test.db.test.ts`, `camera-adapter-open.db.test.ts`,
`test/support/onvif-odd-device.ts` (the port list, `freeOddDevicePort`);
`apps/capture-worker/test-fixtures/row042_probe.py`, `row186_bounds.py`, `rtsp_test_camera_check.py`, `row041_relay.py`
(the environment control, its criterion, and the timeline facts - NOT the start order); one line each in
`file_claims.md` and `file_requests.md`.
New: `apps/core-server/test/support/heavy-host-lock.ts`, this record, `delegation_progress/row_t3.md`; scratch under `.cache/task4-t3/`.

**No product file was written by this row.** Last write of each product file a mutant named, against this row's start
(17:40): `onvif-session.ts` 16:33, `onvif-reply-guard.ts` 16:47, `stream-probe.ts` 12:45, `relay-start.ts` 16:13,
`adopted-test.ts` 14:35, `adoption.ts` 09:12, `connect/service.ts` 16:16, `src/relay/*.c` 11:55-11:56;
`onvif-network.ts` 17:55 - by agent V6b (row R119-09), who also appended one case to `onvif-network.test.ts` at 17:57
while this row worked in that file: both sets of edits stand, the file runs 26 of 26.

## 7. Assumptions, limits, driver decisions

- DRIVER DECISION: the sink block of `camera-adapter-open` holds the heavy-host lock for the whole block (its camera
  and its sink stand for all of it), cases that start nothing included (its duration was not measured by itself; the
  whole file runs in under 40 s). The other files take it per case.
- DRIVER DECISION: the recorded-file comparison is skipped by name, not failed, on a host without the file (a fresh
  host runs the database suite in an order that may put it before the file's writer); the flag makes it a failure. The
  gate's run should set `DEMS_REQUIRE_RECORDED_FILES=1` after `camera-adapter-open.db.test.ts` has run once.
- DRIVER DECISION: the unit file `onvif-session.test.ts` takes no lock: it binds only ports the system hands out now.
- The planted controls of rows 3 and 4 write the test camera's synthetic secret into the in-memory log, an in-memory
  error log and a throw-away clone, in the file's LAST case; nothing of it reaches a file of the repository.
- `row041_relay.py` was claimed for its start order only; what was edited there instead is additive (three criteria
  and facts). `row043_reopen.py` and `row58_gate.py` were read and not edited.
- Loads during this row: 3.2 to 6.8 (1 minute). No timing margin of T-10 / X-02 / X-03 was exercised under high load.

---
*Generated: 2026-10-13 18:40*
