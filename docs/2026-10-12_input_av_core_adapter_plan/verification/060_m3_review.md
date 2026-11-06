---
task_id: 2026-10-12_input_av_core_adapter_plan
row: 60
milestone: M3 (plan phase 3: rows 38 to 58, 142, 174 to 179, 182, 186, 188; extended to 143, 143b, 143c, 146, 146b, 146c, 153, 154, 85d)
date: 2026-10-13
agent: senior-code-reviewer
tier: T1
reviewed: branch task4/input-av-core-port, head 0f5d2a8e, plus the uncommitted working tree
status: complete, with the coverage limits of section 2 (a large part of the scope was NOT read)
---

# Row 60 - code review of phase 3 (M3) of track D

## 1. Verdict

**PASS WITH FOLLOW-UPS. Blocking findings for the M3 gate: 0** - in what was read (section 2 states what was not).

Follow-ups: **12** (F3-01 to F3-12). Notes: **16** (N-01 to N-16). M2 follow-ups: 3 closed, 5 still open (section 6).

Three follow-ups must be closed, or ruled, BEFORE THE LIFT (row 88), although none blocks M3 (the production camera adapter is still registered nowhere: `apps/core-server/src/capture/adapters/real.ts:59` loads the class-C stubs):

1. **F3-01** - the Core does not read the relay's `camera_lost` / `camera_reopened` lines: a camera loss inside a session is invisible to the Core until the relay gives up.
2. **F3-02 / F3-03** - two static pins of the capture list are green by the FORM row 143b gave its code. By ruling C60 (1) ("a rule that is green because its pattern does not see ... is not met") the gate should not cite them as met until each has its named entry.
3. **F3-06** - the refusal that says "the camera network of this Core is not set up" is given only when that is NOT the cause.

No memory-safety flaw, integer wrap, unbounded copy or credential output was found in one full reading of the relay's three C files. That is one reader and one pass, as the security review 06 said of its own.

## 2. Frame, method, limits (5W1H)

| | |
|---|---|
| What | Code review: duplication, maintainability, error paths, test honesty, reference integrity, dependency impact. Not a security review (06 exists) and not a design review |
| Why | Blueprint row 60, gate "blocking findings 0, or each routed and re-checked" |
| Who is affected | the controller (gate M3, rows 86 and 88), the owners of the rows named per finding |
| When | 2026-10-13, working tree as found (545 changed or untracked paths) |
| How | Read-only. `Read` of files, text searches, `git diff` / `git show` of single paths. **No test, build, typecheck or suite was run.** The Graft graph exists (`graft/`) and was not queried: every finding rests on a file read or a text search, cited |

**Read in full:** `apps/capture-worker/src/relay/relay.c`, `relay_rtsp.c`, `relay_core.c`, `relay.h:60-379`, `src/announce.c`, `src/guard/guard.c`; `apps/core-server/src/capture/adapters/camera/onvif-relay.ts`, `relay-start.ts`, `stream-probe.ts`, `camera-watch.ts`, `stored-address.ts`; `src/capture-session/ingest-pairing.ts`; `src/modules/capture-discovery/adopted-test.ts`, `adopted-test-route.ts`; `verification/035_m2_review.md`, `verification/06_security_relay_client.md`.

**Read in part:** `src/ingest.c:100-240, 555-620`; `onvif-session.ts:508-560, 822-887`; `connect/service.ts:340-424, 546-560`; `adoption.ts:60-141`; `readdress.ts:204-241, 260-272`; `fence/production-parts.ts:50-102` and its outline; `capture-session/index.ts:94-101, 1222-1247, 1916-1962`; `capture/__tests__/static.test.ts:380-436, 600-640`; `adapters/__tests__/static.test.ts:510-669`; `relay-check.sh` (lines matching RC-6 / S13-11 / bind); `Makefile` (relay lines); `masterplan/04_design_addendum.md:194-298`; decisions C34-C40, C55-C60, C63, C65, C70, C75, C89 (their rows only); request lines `row 43` and `row 143b` of `file_requests.md`; the working-tree diff of `adapters/__tests__/real.test.ts`.

**NOT READ (stated plainly):**

- Documents: design addendum section 1 and 2.1-2.2; `verification/04_security_addendum.md` and `05_security_branch_b.md` (searched only); `test/059_worker_reverification.md`; `test/141_container_e11_relay_state.md` (its summary in C89 only); the implementation records of the rows in scope - searched by pattern for declared edit methods and re-stated expectations, read in sections only for 043, 052, 054, 146b; about 30 records not read.
- Worker: `test/relay_unit_test.c` (1,525 lines), `test/relay_fuzz.c` beyond its entry list, `relay_fuzz_controls.sh`, every fixture under `test-fixtures/` except the case list of `row143b_source_bind.py`, `rtsp_test_camera.py`, `check.sh`, `test/static/pinned_calls.py`, `planted.tsv`, `e2e.py`, `src/announce.h` beyond its declarations, the rest of `ingest.c`.
- Core: `onvif-network.ts`, the rest of `onvif-session.ts`, `connect/index.ts`, `connect/limits.ts`, `connect/statements.ts`, `capture-discovery/index.ts`, `readdress-route.ts`, `capture-composition.ts`, `destination-rule.ts`, the capture-config statements that store stream rows, the rest of `production-parts.ts`.
- Shared, web, mobile: the camera facts were checked by text search only (one finding, F3-07); no slice schema and no reader was read.
- Tests: no test file was read whole. Case titles of `adopted-test.test.ts`, three fragments elsewhere.
- The three commits were not walked with `git show --stat`; the review read the tree, not the history.

A defect inside what was not read is not excluded. The controller may want a second pass on `onvif-network.ts`, `readdress-route.ts`, the fixtures and the unit tests.

## 3. Follow-ups

| ID | File:line | Finding, and why it matters | Row | Smallest fix |
|---|---|---|---|---|
| **F3-01** | `CS/capture/adapters/camera/relay-start.ts:142, 154-159`; `onvif-relay.ts:545`; written at `WRK/src/relay/relay.c:403, 504` | The relay writes `camera_lost` and `camera_reopened` on standard output (row 43). The Core's reader knows ONE form (`PUSH_ESTABLISHED_LINE`); both lines are counted as `rejected` and dropped, and `rejected()` has no reader under `src/`. So while a relay re-opens its camera (6 tries, 62 s of waits plus up to 20 s per open) the Core raises nothing: the watch hears only `relayEnded`. The worker has no notice for a silent push either (search of `ingest.c`: the stall only cuts the fragment). Presence turns `ABSENT` but raises no fault by design (`camera-watch.ts:37-39`). An evidence recording can miss a camera for more than a minute with no operator notice. Declared by row 43 (`implementation/043:59`; request line `row 43`), still open at head | 43 (relay), 46 (reader) | Two more fixed forms in `createRelayReportReader` and two kinds in `RelayReportKind`; the adapter tells the watch (`relayEnded`-like raise on lost, `pushEstablished`-like clear on reopened), with the C37 attempt rule. Before row 88 |
| **F3-02** | `CS/capture/adapters/camera/stored-address.ts:98, 121-124, 135-136`; rule at `CS/capture/__tests__/static.test.ts:406-407` | SR-2 (2) is green by form. The pattern `\b(?:sourceAddress\|viaAlias)\s*:\s*(?!string\b\|boolean\b)` has a defect (the `\s*` backtracks, so `sourceAddress: string` matches) AND a blind spot (a shorthand member is not seen). Row 143b therefore wrote a mapped type `SourceNamed<Value>` and two shorthand objects that DO build `{ allowed: true, sourceAddress }` outside the rule's file. **The code is right** (it hands the rule's own value on, unchanged, held to the strict form); **the rule must change**: as written it both refuses honest code and cannot see a composed answer `{ sourceAddress, viaAlias }` | 143b | A named entry (next SR number): the pattern of request line `row 143b` (1) `:(?!\s*(?:string\|boolean)\b)`, plus a shorthand form in the same pattern, plus `stored-address.ts` named as the one hand-on site with its two places pinned. Then `SourceNamed` goes back to a plain member |
| **F3-03** | `CS/capture/adapters/camera/onvif-session.ts:833, 839, 865`; pin at `CS/capture/__tests__/static.test.ts:617` | The time reader's `read` has TWO signatures only because the pin holds the two-parameter line. The unbound form stays callable; no production caller uses it (the watch's seam requires the address, `camera-watch.ts:102`). "A time read of a stored camera without a source" is therefore unused, not impossible. **The code's intent is right; the rule must change** | 143b | Named entry (extend SR-5): the pin becomes the three-parameter signature; delete the two-parameter overload |
| **F3-04** | `WRK/relay-check.sh:42-57`; `WRK/src/relay/relay_rtsp.c:304-321` | RC-6 changed from "binds nothing" to "exactly one bind, line pinned" (tag S13-11). **The code is right** (S13-11 point 2 needs the bind before the connect, at every re-open; one dial, `listen` / `accept` still refused in source and import net) **and the change has its named entry: C65.** What is missing is the text of the rule itself: `verification/04_security_addendum.md:293, 303` and `masterplan/04_design_addendum.md:636` still state RC-6 without it, and request line `row 143b` (318) asked a security reviewer to confirm | 143b; row 86 | One erratum line where RC-6 is defined, citing C65; row 86 confirms. No code change |
| **F3-05** | `CS/modules/capture-discovery/adopted-test.ts:253-255`; `connect/service.ts:365-367`; against `stored-address.ts:132-137` and its claim at `:87-88` | Four callers judge a stored camera; two (`onvif-relay.ts:514`, `camera-watch.ts:379`) take the source through `storedCameraSourceOf`, two re-write its body by hand ("admitted and null -> `STORED_ADDRESS_SOURCE_ABSENT`"). The file's statement "every dial of a stored camera takes its source there" is false for 2 of 4, and rule A-10 (d) pins both forms (`adapters/__tests__/static.test.ts:622-623, 630-631`). Same behaviour today; two places to keep equal | 143b, 143c | `storedCameraSourceOf(judged)` in both; two pins of A-10 (d) move |
| **F3-06** | `connect/service.ts:363` against `:369`; `adopted-test.ts:256-258`; `adopted-test-route.ts:32-35` | Refusal that misleads (C70). With the rule bound and NO network configuration the rule answers `NOT_CONFIGURED` and the client gets `409 CANDIDATE_NOT_TESTABLE`, "This device cannot be tested." The sentence "the camera network of this Core is not set up" exists (`service.ts:363`) but is said only when the composition handed in no rule - which is not that state. The operator is told the DEVICE is at fault for a state of the Core that operation 102 fixes. The log carries the rule's code; the client does not | 143c, 146b | Where `judged.refusal === 'NOT_CONFIGURED'`: answer the existing `503 NOT_READY / DISCOVERY_NOT_READY` with that sentence (two places, two expectations, e.g. `adopted-test.test.ts:678`). C70 accepted the 409: this needs the controller's word, or the reason member of the next contract step |
| **F3-07** | `apps/core-web/src/features/session-new/devices-step.tsx:466` | The pre-start preview tile states `resolution: '1080p', fps: 25` for every camera, whatever its stream. Every other web reader uses the camera's facts (`dashboard/devices-panel.tsx:324`, `devices/camera-tile.tsx:57-63`). With the bench cameras (HEVC, other sizes) the operator reads a false format on the screen that precedes the start. Declared by row 54 (`implementation/054:59`, D-4), open at head | 54 | Read `camera.resolution` / `camera.fps` as `devices-panel.tsx:324` does |
| **F3-08** | `CS/capture/adapters/camera/stream-probe.ts:367-397`; `onvif-relay.ts:184-210`; `boot/program-checks.ts:89` | The relay's exit codes are written in four TypeScript tables. ONE is held to `relay.h` by a test (`onvif-relay.test.ts:688-693`). `PROBE_EXIT` and `RELAY_OWN_EXIT` are not (no mention of `relay.h` in `stream-probe.test.ts`). A new code (request line `row 143b` (320) proposes 34) would turn the adapter's test red and reach the probe silently as `EXIT_CODE_UNKNOWN` | 50 | One exported code-to-word table in `relay-start.ts`; the two files map words; the header test once |
| **F3-09** | `relay-start.ts:163-183` = `stream-probe.ts:206-226`; `onvif-relay.ts:384-391` = `stream-probe.ts:416-423` | Exact duplication: the bounded line reader (21 lines) and `endedWithin` (8 lines) | 50 | `createBoundedLineReader(maxBytes, onLine)` and `endedWithin` exported once from `relay-start.ts` |
| **F3-10** | `CS/modules/capture-discovery/readdress.ts:225-229`, `:207-215`; `connect/service.ts:551-559` | (a) `ruleRefusalOf` is a second, LOOSER reader of the stored-address rule's answer: it takes `allowed === true` without the check that the admitted address is the one asked (`stored-address.ts:201-203`). No effect today (the rule rebuilds the same address, and every later dial is judged strictly); two readers that already differ. (b) `readdressTargetOf` and `addressOf` are the same function; both turn a service address that does not parse into "no port", silently | row not identified (its record was not read) | (a) `judgeStoredCamera` for the decision; (b) one exported function |
| **F3-11** | `packages/shared/src/sim/capture-config.ts:132`; `CS/capture-session/index.ts:98-99, 1234-1235`; `onvif-relay.ts:340`; `ingest-pairing.ts:152`; `packages/capture-protocol/src/index.ts:603, 675` | "One camera on both tracks with two profiles" is admitted by the selector, announced by the session unit's header and BUILT in the adapter (relays keyed by device and profile; test at `onvif-relay.test.ts:344`). The worker protocol refuses such a plan ("a camera is named twice"), and the pairing, the telemetry and the fault key are per device. So that keying serves a state that cannot record, and a camera with two lenses (`lens` 1 to 4 is stored per stream) cannot fill both tracks. By reading, not run. The protocol rule is older than phase 3; phase 3 built on both sides of it | 46, 48 | A ruling: state the limit (and refuse the selector state on a real Core, so no start meets `PLAN_INVALID`), or carry the track in plan, telemetry and pairing. Until then delete nothing |
| **F3-12** | `WRK/src/relay/relay_rtsp.c:422-426` | HYPOTHESIS, hardware only. A keep-alive refused with `stale=true` renews the challenge and is NOT sent again; the next one leaves a full period later. The period is half the camera's session time (`:373`), so the first accepted keep-alive can arrive AT the session time. A second stale refusal in a row is `AUTH_REFUSED` (`:423`), and the second of the relay's life ends it (`relay.h:271`). A camera that renews its nonce faster than the keep-alive period would lose its recording. Experiment: the test camera with a nonce life below the period | 186 | After a stale renewal let the next turn send at once (one assignment to `last_keepalive_us`); name it for the hardware package |

`CS` = `apps/core-server/src`, `WRK` = `apps/capture-worker`.

## 4. The seven questions of the brief

### 4.1 The C code: bounds, overflow, return values, early exits, signals, credentials

Traced to its bound, each sound: the JSON string reader (`relay_core.c:86-140`, `n + k >= cap` before every write); the start message (key and word 16 bytes, source 16, closed member sets, `:238-303`); the challenge (name 31, value 512, each parameter once, `:349-404`); base64 sets (2,047 characters into 1,027 bytes, more than 1,024 refused, `:543-555`); the description (96 lines, 16 types, control 1,024, refused beyond, `:622-694`); the head (8,192, no 0 byte, one Content-Length of at most 6 digits, `:1054-1119`); frames (16-bit length against a 256 KiB buffer with a static assertion, `relay_rtsp.c:40`); RTP header, aggregation and fragments (`relay_core.c:921-1016`); the picture (8 MiB, doubling cannot wrap, `:867-880`).

**Siblings of the overflow the fuzz build found (`Transport: interleaved=`, a library conversion on camera text):** none left. Every number read from the camera or the Core is now digit-counted before it is used: `channel_of` (3), `number_of` (9 and 6), `timeout=` (6, `:1093`), payload types (4, `:649`), `port_of` (5), `rate_of` (4 and 3), `attempt_of` (9), `source_ok` (3). The one `strtol` left reads the Core's ingest address and is range-checked (`:150-151`). No `atoi`, `sscanf` or `strtoul` in the three files.

Early exits: every failure of `dial` leaves the descriptor in the structure and both callers close it (`relay.c:415`, `:548`); a failed re-init of the collector frees nothing twice (`relay_core.c:823-827` sets the pointer to 0). Credentials: the line, the password, the request text, the header value and the hash contexts are overwritten on every path read (`relay.c:185, 456, 549-550`; `relay_rtsp.c:255-256, 287`; `relay_core.c:426-430`); the one writer of each stream prints fixed words and numbers. Signals: `sigaction` without restart, one `sig_atomic_t` flag, read in the loops. Remaining small points are notes N-01 to N-06 and follow-up F3-12.

### 4.2 Edit-only breaches and whole-file rewrites

- **The ninth (row 85, `adapters/__tests__/real.test.ts`, C55).** The file at head held ONE case: SIMULATED and REAL_DEVELOPMENT refused, two assertions each (instance, code `CAPTURE_REAL_ADAPTERS_REFUSED`). In the tree that case is kept with both assertions for both operations and widened (the loader now takes the bundle; five missing-bundle forms refused with `CAPTURE_ADAPTER_INVALID`; `calls` empty). **Nothing was lost.** Two comment lines went ("it never calls it for the operation that loads") - correctly, the statement is no longer true. The tree now shows +165 / -5: later rows moved pins in it (C63 (f)).
- The first seven were covered by the M2 review. The eighth (C49) is documents: not read.
- **Batches 6 to 8.** A pattern search of the in-scope records found these declared departures and no other: row 52's exact-match replace in `packages/shared/src/api/core-api.ts` (M2 review: clean); pass I-7b's three replaces in `fence.db.test.ts` (M2 review: clean); rows 44 / 159, one replace on the agent's own new fixture (C59; a new file has no baseline to diff - not checked). Rows 46, 49, 143b, 143c, 146, 146b, 186 and passes I-3, I-6, I-7 each state "Edit tool only". **An undeclared scripted edit cannot be seen from a diff; none was looked for.**

### 4.3 Test honesty

- **"Exactly one" became two (rows 146b, 146c).** A behaviour change by decision (C58 -> C75: the outcome entry), not a loosening: the re-stated cases assert MORE (order of the two entries, exact keys, `guardTripped` on the second; `implementation/146b` section 3). The case "no credential is stored" stayed at 1 in 146b and became 2 in 146c, by C75 (1). Accepted.
- **Would pass with the feature removed:** none found in what was read. One caveat (N-11): the positive run of the source bind uses 127.0.0.1 to a loopback camera, where a bound and an unbound socket look the same; what fails without the bind is the run from 192.0.2.1 and the pinned line. The record says so; the real proof is 9A/H-09.
- **Asserting on their own fixtures:** not checked (`rtsp_test_camera_check.py` and the fixtures were not read).
- The exit-code test reads `relay.h` itself (good); it covers one of four tables (F3-08).
- Many rules are held by exact source lines with their indentation (A-10 (c), (d); `relay-check.sh:48-57`). They are tripwires beside behaviour tests, each with a planted control; every refactor of section 3 moves pins by delta.

### 4.4 Duplication

| Subject | Finding |
|---|---|
| The three dial sites (open, watch, test) and the candidate test | F3-05: one function, used by two of four |
| `stored-address.ts`, the fence binders, the typed-probe rule | `storedCameraAddressRuleOf` and `typedProbeRuleOf` hold the same nine-line "read the facts, tell when it threw" body (`fence/production-parts.ts:64-78`, `:89-102`): N-13. The source-address form is written twice on purpose (C: `relay_core.c:205-220`; Core: `stored-address.ts:113`), each naming the other |
| Readers of the rule's answer | F3-10 (a) |
| Relay interface in the Core | F3-08, F3-09 |
| Small restatements | N-08 (the code-word pattern, six places), N-14 (codec set and stream bounds in `adoption.ts`) |

### 4.5 Rules green by form

| Rule | Code or rule? | Named entry |
|---|---|---|
| RC-6 (relay): "binds nothing" -> "one bind, pinned" | the code is right; the rule changed | exists: C65. Missing: the erratum where RC-6 is defined (F3-04) |
| SR-2 (2) (capture static list) | the code is right; the rule is defective and blind | missing (F3-02) |
| G-R10 / G-R11 facade pin of the time reader | the intent is right; the rule forces a dead overload | missing (F3-03) |

### 4.6 Error paths and refusal codes

- F3-06 (the misleading 409).
- `stream-probe.ts:453, 465` drops the door's refusal code of a relay that did not start (`NOT_STARTED` only); `onvif-relay.ts:552` keeps it as the reason: N-09.
- Swallowing by design, each stated in place and bounded to a sink or listener: `onvif-relay.ts:376-380, 579-583`, `stream-probe.ts:408-412`, `camera-watch.ts:286-297`. Accepted.
- `camera-watch.ts:467`: a reader that refused before any request is told as `CLOCK_NOT_ANSWERED`: N-07.

### 4.7 Dead code, unused exports, seams for a test (AD-08)

- `relay_camera_socket` (`relay.h:376`, `relay_rtsp.c:108`): callers are `test/relay_unit_test.c` only, yet it is declared outside `RELAY_TEST_HOOKS`: N-06.
- `RelayCounters.packets`, `.bytes`, `.frames_dropped` and `RelayAnswer.other_challenges`, `.rtcp_channel`: written, read by tests only: N-06.
- `OnvifRelayCameraAdapter.counts()`, `admittedDevices()` (`onvif-relay.ts:291, 309`) and `RelayReportReader.rejected()` (`relay-start.ts:132`): a text search of `src/` and `cli/` finds no caller outside tests: N-15.
- The two-parameter `read` overload: F3-03.
- `camera-watch.ts:395, 458, 466`: branches that cannot be taken: N-07.

## 5. Notes

| ID | File:line | Note |
|---|---|---|
| N-01 | `relay_rtsp.c:141, 145` | `READY` is an alias of `RELAY_INTERNAL`: a sentinel that is also a real code. A value of its own outside the enum's exit codes is safer |
| N-02 | `relay_rtsp.c:313`; `relay.c:311` | `fcntl(F_GETFL)` inside the `F_SETFL` is not checked; `av_dict_set` is not checked (if it failed the push would not be held to TCP; the relay's own socket rule at `relay.c:493` is the backstop) |
| N-03 | `relay.c:155-156, 193-194` | Review 06 L-6 stands: two loops over `getdtablesize()`, the second at every re-open |
| N-04 | `relay.c:176-178` | The start-message deadline is looked at only when a wait timed out. The sender is the Core and the line is at most 8,192 bytes |
| N-05 | `relay_rtsp.c:422-426` | An answer to a keep-alive that is neither 200 nor 401 (for example 454) is dropped without a count |
| N-06 | see 4.7 | Test-only function in the production header; counters and members no line prints |
| N-07 | `camera-watch.ts:266-267, 395, 458, 466, 467` | A doc comment separated from its type by row 143's constant; three branches that cannot be taken; one misnamed refusal |
| N-08 | `onvif-relay.ts:162, 335`; `stream-probe.ts:98`; `camera-watch.ts:428`; `adopted-test.ts:197`; `adoption.ts:93` | The code-word pattern `^[A-Z][A-Z0-9_]{0,63}$` six times (`stored-address.ts:101` with 47) |
| N-09 | `stream-probe.ts:453, 465` | See 4.6 |
| N-10 | `relay_rtsp.c:451`; `relay.h:210` | "A key that fits no challenge" works because `DIGEST_HASH_NONE` is 0 and a parsed challenge is never 0. An unstated tie to an enum value: one static assertion |
| N-11 | `test-fixtures/row143b_source_bind.py:18-25` | See 4.3 |
| N-12 | `test/relay_fuzz.c:32` | The fuzz build is the row's own random mutator; the libFuzzer mode was not built or run on this Mac |
| N-13 | `fence/production-parts.ts:64-78, 89-102` | See 4.4 |
| N-14 | `adoption.ts:93-97, 110-123, 130` | Restates the codec set and the stream bounds of `stream-probe.ts:89, 94`; `assertAdoptedProfiles` runs twice per adoption |
| N-15 | see 4.7 | Three members with no product caller |
| N-16 | `relay.c:336`; `relay_core.c:761-765` | A camera whose stamps step more than 10 s ahead ends the relay with `STREAM_INVALID`, which is never retried: that camera is lost for the session. By the fix of review M-3; whether a real camera does this at a clock correction is a hardware question |

## 6. The M2 follow-ups (F-01 to F-08 of `verification/035_m2_review.md`)

| ID | State at head | Evidence |
|---|---|---|
| F-01 | **open** | `packages/shared/src/sim/session-machine.ts:506, 840` still read `isOwnCaptureCoreState` |
| F-02 | **open** | `packages/shared/src/live/source/neutral-state.ts:49` unchanged |
| F-03 | **open** (to row 88, C50) | `CS/capture/fence/__tests__/fence.test.ts:1119` still computed from `OPENER_CAPABLE_KINDS` |
| F-04 | **open** | `apps/core-server/test/db/set7.db.test.ts:210` still `.catch(() => undefined)` |
| F-05 | closed by entry | SR-5, recorded in C48. Row 143b then added a second signature under the same pin: F3-03 |
| F-06 | closed by entry | C48 |
| F-07 | closed at the entry (C55), by its record; here only seen that `src/index.ts:123` calls `provideHost`. The members are still optional in type and one comment still says "ABSENT: no host check runs" (`CS/capture/boot/checks.ts:434-437, 443`; `CS/capture/types.ts:391`) | as cited |
| F-08 | **open** until the lift | not re-checked |

Phase 3 closed three (two by decision text, one by row 85) and left five.

## 7. What was done well

- Every number the relay reads from outside is digit-counted before use; the relay's two pure readers were moved out of the socket code so that the unit and fuzz builds reach them.
- One dial, one writer per output, one place where the password is used: the structure makes the security rules checkable.
- The Core side keeps no address and no credential in any slot (`onvif-relay.ts:319-328`), and every refusal is a code with a fixed sentence.
- Rows 43, 54 and 143b declared their own open ends in their records and request lines; F3-01, F3-02, F3-03 and F3-07 were found there first.
- The re-stated audit expectations of rows 146b / 146c strengthen, with the list of what changed written out.

## 8. Assumptions and gaps

- Line numbers are of the working tree at the time of the review.
- F3-11 and F3-12 are by reading; F3-12 is a hypothesis with its experiment named.
- "No caller" statements (N-15, F3-03) rest on text searches of `apps/core-server/src` and `cli`; a call by a computed name would not be seen.
- No file other than this one and `delegation_progress/row_060.md` was written.

---
*Generated: 2026-10-13 16:10*
