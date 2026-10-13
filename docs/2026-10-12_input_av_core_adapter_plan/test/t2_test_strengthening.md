---
task_id: 2026-10-12_input_av_core_adapter_plan
row: T2
date: 2026-10-13
agent: test-expert (T2, track D)
tier: T2
source: verification/060b_m3_review_second_pass.md (section 7.4, S-07, S-08, S-09), decisions/decisions.md C95
status: complete - items 1 to 5 strengthened and shown red on a mutant; item 6 measured, not fixed
---

# Row T2 - tests that passed with the feature removed, made to fail

Tree: branch `task4/input-av-core-port`, head `0f5d2a8e`, plus the uncommitted working tree. NO product source was
changed. Every mutation was made on a scratch copy (C) or in memory by a transform of a scratch vitest configuration
(TypeScript); no product file was written at any moment. Existing files were changed with the Edit tool only.

Scratch folder of every script and output named below: the session scratchpad, `.../scratchpad/t2/` (not in the repository).

## 0. Summary

| # | Item | Result | Mutation of the product (scratch) | Red |
|---|---|---|---|---|
| 1 | `relay_unit_test.c`, "the socket's own end is the source address" | done | the `bind` line of `dial` removed | `7 of 989 checks FAILED`, the named check among them |
| 2 | `row143b_source_bind.py`, case `probe_from_loopback` | done | a relay built without the `bind` line | `FAIL probe_from_loopback`, one criterion: the double saw the connection from 127.0.0.1 |
| 3a | `onvif-session.test.ts`, "the address this host holds ... (control)" | done | `localAddress: sourceAddress, family: 4` dropped from the connection options | that case red (`3 failed`); with only `family: 4` dropped: that case ALONE red |
| 3b | same file, the 3,000-level body | done | the clock read's refusal named `NO_ANSWER`; the depth bound of the reply guard removed | that case red in both |
| 4 | `relay-check.sh --selftest` (S-07) | done | each of the 82 rule statements deleted in turn from a scratch copy of the script | before: 35 of 82 deletions left the selftest green; after: 0 of 82 |
| 5 | flake `service.test.ts:382-383` (S-08) | done | (the OLD random form put back for one loop) | old form: red in the 2,000-repeat loop; fixed form: 0 failures in 2,000 |
| 6 | `row58_gate.py` twenty times (S-09) | measured | none | `INGEST_OPEN_STUCK`: 0 of 240 sessions; two runs 11 of 12, each with ANOTHER cause |

## 1. `apps/capture-worker/test/relay_unit_test.c` (review 7.4 (1), note M-08)

**What was wrong.** The check read the socket's own end after a refused connect. On loopback a socket that was never
given an address has the same own end, so the check passed with the bind of `dial` removed.

**What it asks now.** The test program defines `bind` and `connect` itself. The calls of `relay_rtsp.c` (linked into the
test program) arrive there, are written down - how many, on which socket, with which address and port, how many binds
stood when the connect was asked - and are passed to the system's own function (`dlsym(RTLD_NEXT, ...)`), whose answer
is returned unchanged. The relay itself is not built from this file. Checks, 982 -> 989:

- the named check now also requires: ONE bind of the camera socket with `127.0.0.1` and port 0, made BEFORE the ONE connect of the same socket; a second check states it by itself; a third repeats it after `relay_camera_drop` and a new open;
- an address this host does not hold (twice, the second after a re-open): ONE bind with `192.0.2.1`, port 0, and connect called 0 times (this answers M-08: the count of connects asked, not the kernel's memory);
- CONTROL of the counters: a probe that states no source address: 1 connect, 0 binds.

**Mutations (scratch copies of `src/relay/relay_rtsp.c`, script `unit_mutants.sh` / `unit_nobind.sh`).**

| Mutant | Diff of the scratch copy | Result |
|---|---|---|
| none (release flags) | - | `rc=0`, `relay_unit_test: 989 checks passed` |
| none (address and undefined-behaviour sanitizer) | - | `rc=0`, `989 checks passed` |
| bind removed | `320d319 < if (bind(c->fd, ...)) return RELAY_CAMERA_UNREACHABLE;` | `rc=1`, `7 of 989 checks FAILED`: lines 1519, 1520, 1527, 1528, 1539 (the named check), 1540, 1544 |
| bind block moved below the connect | block of lines 315-321 after line 322 | `rc=1`, `7 of 989 checks FAILED` (the same seven) |
| a second bind | one more `bind` before the pinned one | `rc=1`, `5 of 989 checks FAILED` (1520, 1528, 1539, 1540, 1544) |
| a port of its own | `from.sin_port = htons(8574)` | `rc=1`, `5 of 989 checks FAILED` (the same five) |
| the address given in probe mode only | `if (c->start->source[0] && c->start->mode == RELAY_MODE_PROBE)` | `rc=1`, `7 of 989 checks FAILED` |

**Revert.** Nothing to revert: the four files of `src/relay/` are byte-identical to the copy taken at 16:25 before any
mutation (`cmp`, all four "identical"); `relay_rtsp.c` was last written at 11:55.

**Green in the tree.** `make -C apps/capture-worker` under the heavy-host lock: `make rc=0`;
`relay_unit_test: 989 checks passed; the 34 named malformed-input cases of review 06: 34 of 34 pass` (release and
sanitizer build); the three negative controls of the Makefile `fails as required`; `relay_fuzz` six entries `no failure`.

**Not proven.** The Linux build of the test: `RTLD_NEXT` needs `_GNU_SOURCE` (defined under `__linux__` only) and, on a
glibc older than 2.34, `-ldl`. Built here on macOS only. One line in `file_requests.md` for row 193. A mutant that
binds the HOST of the locator instead of the source is not told apart here (both are 127.0.0.1): `relay-check.sh` pins that line.

## 2. `apps/capture-worker/test-fixtures/row143b_source_bind.py`, case `probe_from_loopback` (review 7.4 (2))

**What was wrong.** A probe from 127.0.0.1 to a camera on 127.0.0.1: the same address with or without the bind.

**What it asks now.** The case keeps its first half and adds a second: a probe whose source is ANOTHER address of this
host (127.0.0.2 where the loopback network is the host's - Linux; else the first address of an interface, read from the
system's listing - on this Mac an interface address), sent to the counting double on 127.0.0.1. The double must see ONE
connection FROM that address and none from 127.0.0.1; the relay ends with the double's 404 (`LOCATOR_NOT_FOUND`). Both
ends are this host's own addresses: nothing leaves the host, and nothing is sent to find the address.

DRIVER DECISION (for the controller to confirm): a host with no second address FAILS the case
(`a_second_address_of_this_host_exists`), it is not skipped - the first half alone proves nothing about the bind.

**Mutation.** A relay built in a scratch copy of the worker folder without the bind line (`relaymut/`,
`make build/capture-relay`; note: the import net of `relay-check.sh` passes that binary - the static rules are what refuse the source). Driver `row143b_driver.py`, output under scratch, each run under the heavy-host lock.

| Relay | Result |
|---|---|
| bind removed | `FAIL probe_from_loopback rc=0 code=STOPPED`; `peers_are_the_source: [False]`, `peers_are_loopback: [True]`; the ONE failed criterion: `from_the_second_address_the_double_saw_ONE_connection_from_THAT_address_and_none_from_127_0_0_1`. Every criterion the case had before stayed `ok` - the review's point, measured |
| unmutated scratch build | `PASS probe_from_loopback`; `peers_are_the_source: [True]`, `peers_are_loopback: [False]` |

**Green in the tree** (the product binary, under the lock): `row143b_source_bind: 14 of 14 runs PASS`, rc 0.

**Not proven.** That a CAMERA on a second network sees that address (hardware, as before).

## 3. `apps/core-server/src/capture/adapters/camera/__tests__/onvif-session.test.ts` (review 7.4 (3), (5); note M-10)

Edited after agent B1's row file said `complete` (16:57); B1's appended block and every other case are untouched.

**3a, "the address this host holds ... (control)".** It asserted "it answered", which is true without the source
address. It now records every connection an HTTP agent makes during the three calls (the agent's own
`createConnection` wrapped on the prototype and put back in `finally`; the connection is made as always) and requires:
one connection for each request the stub saw, EVERY one asked with `localAddress` = the address handed in, `family` 4
and the stub's port. Control of the record: the same read without a source address states no local address.

**3b, the 3,000-level body.** It accepted either of two outcomes and any reason. It now requires `UNREACHABLE` with
`NOT_ONVIF`, `reads` = the clock read alone, ONE request at the device, no credential sent, empty profile lists. Two
controls: a small shallow body without a clock is named the same; the SAME 3,000 elements side by side end as
`BYTE_CAP` - so the nested body was refused for its depth before its length was reached.

**Mutations** (in memory: `vitest.t2.config.mjs` replaces one text of the product file as the test imports it and
records the hit; `core_mutants.sh`). The unmutated run through the same configuration: `Tests 62 passed (62)`.

| Mutant | Text replaced | Result |
|---|---|---|
| source address dropped | `{ ...connectionOptions, localAddress: sourceAddress, family: 4 }` -> `connectionOptions` | `3 failed, 59 passed`: 3a and the two "not held" cases |
| family dropped | `, family: 4 }` -> ` }` | `1 failed, 61 passed`: 3a ALONE |
| wrong name | `... return NOT_ONVIF;` (clock read) -> `return NO_ANSWER;` | `4 failed`: 3b, the redirect case, two cases of B1 (the old 3b accepted it) |
| the test goes on after a failed clock read | that line removed | `1 failed`: 3b ALONE |
| no depth bound in the reply guard | `if (depth > bounds.maxDepth) return OnvifReplyRefusal.TOO_DEEP;` removed | `1 failed`: 3b (`reason: BYTE_CAP`); the guard's own test also red (`TOO_DEEP: one element more nested than the bound`) |

**Revert.** None needed: `onvif-session.ts` last written 16:33 and `onvif-reply-guard.ts` 16:47, both by B1, before this
item began (16:58).

**Green in the tree.** `Test Files 1 passed (1)`, `Tests 62 passed (62)` (second run; the first was red in this row's own
new control, whose expectation was wrong: 3,000 flat elements exceed the clock cap).

**Limit.** 3b tells "depth refused" from "not refused" only through the byte cap of the clock read (16 KiB): if that cap
is ever raised above 21,000 bytes the second control must be re-stated. The guard's own test holds the depth bound by itself.

## 4. `apps/capture-worker/relay-check.sh --selftest` (S-07)

**Measured before** (`rule_mutants.py`: each statement of `rules()` deleted in turn from a scratch copy, `--selftest` run):
`rule statements: 82, held by the selftest: 47, NOT held: 35`. The review named 18; the other 17 are rules whose
violation a sibling of the same tag also refuses (lines 32, 33, 34, 37, 38, 59, 65, 94, 95, 99, 100, 101, 110, 114, 127, 128, 135 of the script as it was).

**Change.** A third list in the selftest, 35 controls, one per rule, each matched by the rule's OWN MESSAGE
(`grep -F ": <tag>: <message>"`), with the staleness check of the other lists. Kind `P` appends a line, kind `M` changes
a pinned line. For bind-before-connect: the block that gives the source address is moved below the connect with every
pinned line still present - only the order rule can refuse it. No rule line of `rules()` was changed.

**Measured after:** `rule statements: 82, held by the selftest: 82, NOT held: 0` (the script under test had the hash
of the tree's file, `53fb87a1...`). The selftest: 94 lines `refused as required` (59 before), 35 of them `by its own rule`, rc 0.

**Green in the tree.** `relay-check.sh src/relay` rc 0; `--selftest` rc 0 inside `make` (rc 0).

**Limit.** A new rule added without its control is not caught by the script itself; the comment says so, and the outside
harness is what shows it. The harness is not in the repository (scratch); making it a `make` target is a decision for the worker's row.

## 5. The flake at `connect/__tests__/service.test.ts` (S-08)

**Cause, confirmed by measurement.** `mixed` was the secret between two runs of 20 random bytes;
`holdsClearSecret(mixed, secret + 'x')` is rightly true when the first random byte after the secret is `x`: 1 in 256.

**Fix.** The byte after the secret is stated (`y`), the other 39 stay random; the three expectations are unchanged. Added:
the former chance case on purpose - with `x` after the secret the longer text IS found, and `secret + 'y'` is not.
Nothing the test proved is weakened; one more branch is now asserted.

**Loop.** `vitest run ... -t "a sealer that hands the frame back in clear" --repeats 1999` = 2,000 executions in one process.

| Form | Result |
|---|---|
| old random form, put back for the loop only | red twice (`× ... (repeat x1999)`, `expected [ true, true, false ] to deeply equal [ true, false, false ]`); 6 failing repeats counted in the second loop (the first loop's output was cut at 10 lines, not counted) |
| fixed form | `Tests 1 passed`: **0 failures in 2,000** |

Whole file afterwards: `Tests 30 passed (30)`.

## 6. `INGEST_OPEN_STUCK` (S-09) - measured, NOT fixed

`row58_gate.py all`, twenty times, each under the heavy-host lock (taken per run), 16:34 to 17:15 local; 240 worker sessions.

| Runs | Result |
|---|---|
| 18 of 20 | 12 of 12 PASS |
| `INGEST_OPEN_STUCK` | **0 of 240 sessions** (0 of 20 runs) |
| run 12 (1-minute load 15.2 before) | 11 of 12: `near_last_character` - the CONTROL camera `INGEST_OPEN_FAILED`, worker rc 70. The fixture's own line: port 8561 was held for 1.2 s by a vitest worker (`node ... vitest`) |
| run 15 (load 12.4) | 11 of 12: `foreign_line_on_camera_1` - only `no_leftover` failed (2 of the run's own processes still alive at the check); recording and gate correct. The process names were not kept (the next run overwrote `result.json`) |

1-minute load before each run, in order: 22.7, 16.7, 11.1, 9.6, 10.4, 10.8, 15.0, 10.8, 21.3, 7.7, 16.4, 15.2, 11.7,
14.2, 12.4, 9.2, 9.4, 9.3, 9.5, 11.9. Load at the start of a single session: 8.3 to 26.7. Run time 100 to 200 s.

What this says about the hypothesis: at loads of 8 to 27 on this 10-core host the 22-second bound was never passed, so
this sample neither confirms nor refutes it - it was not reproduced. Part of the load was this row's own (the rule
harness, three shell jobs, ran during runs 1 to 20).

**A second cause of an "N-1 of N", found and owned.** The vitest worker of run 12 was THIS agent's: runs of
`onvif-session.test.ts` at 16:59 to 17:01 without the heavy-host lock. That unit test starts the odd ONVIF device,
whose port list is `8561, 8560, 8559, 8557, 8555` (`apps/core-server/test/support/onvif-odd-device.ts:23`) - the
worker's ingest listeners. Any run of that unit file (it is in the unit project; the full suite runs it) while a worker
fixture opens its listeners can do the same. Its mark is `INGEST_OPEN_FAILED` with worker rc 70, not
`INGEST_OPEN_STUCK`. One line in `file_requests.md`; not changed here (not this row's file).

## 7. Checks

| Command | Result |
|---|---|
| `lockf ... make -C apps/capture-worker` | rc 0 |
| `sh check.sh src`, `sh check.sh --selftest`, `sh relay-check.sh src/relay` | rc 0, 0, 0 |
| `lockf ... row143b_source_bind.py all` | `14 of 14 runs PASS`, rc 0 |
| `vitest ... onvif-session.test.ts` | `62 passed (62)` |
| `vitest ... connect/__tests__/service.test.ts` | `30 passed (30)` |
| static set of core-server (`test/static` and every `static*.test.ts` under `src`) | `Test Files 45 passed (45)`, `Tests 778 passed (778)` |
| `tsc --noEmit` (core-server) | rc 2, 3 errors, none in this row's files: `installation-acceptance/__tests__/routes.db.test.ts:380`, `.../service.test.ts:62` (twice) - another row's in-flight files |
| `oxlint` on the two TypeScript test files | rc 0 |

Binaries of `apps/capture-worker/build`, SHA-256 (first 12) before -> after `make`: `relay_unit_test` ed4eda41b6a4 ->
b52c45150a50; `relay_unit_test_san` c6dd0851f5a8 -> 9828790463fa; `relay_fuzz` 576abe739005 -> 8fef47140ae7;
`capture-relay-san` 47ea50accd74 -> c6ce984423ee; `capture-relay` f70f5d9d6a62 -> c375c92ff355 (re-linked because
`relay-check.sh` is one of its prerequisites; its four sources are unchanged); `capture-worker` 84c8ecebe016 and
`capture-guard` 4f1e7a9ce9dc unchanged.

## 8. Files

Changed (Edit tool only): `apps/capture-worker/test/relay_unit_test.c`, `apps/capture-worker/test-fixtures/row143b_source_bind.py`,
`apps/capture-worker/relay-check.sh` (selftest only), `apps/core-server/src/capture/adapters/camera/__tests__/onvif-session.test.ts`,
`apps/core-server/src/modules/capture-discovery/connect/__tests__/service.test.ts`; one line each in `file_claims.md`, `file_requests.md`.
New: this record, `delegation_progress/row_t2.md`. No product file written; nothing committed.

## 9. Assumptions and gaps

- The tree's product files carry other rows' uncommitted work, so `git diff --stat` of them against the head is not empty; what is shown instead is that this row wrote none of them (byte comparison for `src/relay/`, write times for the two TypeScript files).
- Claim line said "the check at about :1488 ONLY" for the unit test; the interposed `bind` / `connect`, two checks beside the "not held" ones and the control were needed to make it fail, all inside `source_dial`.
- The runs of `onvif-session.test.ts` were not under the heavy-host lock (section 6).

---
*Generated: 2026-10-13 17:40*
