---
task: 2026-10-12_input_av_core_adapter_plan
row: 111b
milestone: M10 / WP-22b (the named remainder of row 111; decisions C78, C87)
agent: coder-execution (driver)
date: 2026-10-13
tier: T3
status: needs-review - inputs (a) the neighbour table and (b) "does this address answer" are built, handed in and green on stand-in programs; input (c) the scan's endpoint count / conflict flag is NOT built (it needs a second named amendment and a file that is not this row's - the exact entry is filed); one named amendment (SR-12) is proposed and built under; UNPROVEN ON LINUX AND ON A CAMERA
closes_requirements: C78 / C87 "NOT BUILT" for the neighbour table and "does it answer" (on doubles); the scan's `mac` (request line `row 107`, point 2); S13-11 at the two programs (the one rule before every program); S13-12 (b) at the two programs (no text of a program or a device in a log, an audit entry or an error)
---

# Row 111b - the production inputs of the commissioning functions

Paths are relative to `/Users/gsp-budi/Documents/DEMS`. `CS` = `apps/core-server`.

**Plain statement.** No `ip`, `ping`, `arping` or other network command ran, in any test or by hand. Every program a test started is a STAND-IN: a shell script the test wrote into an operating-system temporary directory and removed. Neither real program exists at its path on this Mac (`ls /usr/sbin/ip /usr/bin/ping`: "No such file or directory", measured). No camera, no network device and no helper was contacted; the only thing dialled is the fake ONVIF stub on 127.0.0.1. The instance on ports 4423 / 5178 was not touched. Nothing here is proven on Linux.

## 1. The program rows (verbatim)

| Row | Program and arguments | What it does |
|---|---|---|
| neighbour | `/usr/sbin/ip -4 neigh show to <a.b.c.d>` | reads the kernel's neighbour table for ONE address; sends nothing, changes nothing |
| echo | `/usr/bin/ping -n -q -c 1 -W 1 <a.b.c.d>` | ONE echo request, one second of waiting, no name lookup (`-n`) |

Both live in the helper table `CS/src/capture/adapters/local/mic-helper-args.ts` (`LINUX_NEIGHBOUR_PROGRAM`, `linuxNeighbourArguments`, `LINUX_ECHO_PROGRAM`, `linuxEchoArguments`, `COMMISSIONING_HELPER_TABLE`), the file that holds the card listing row of record 085c. Each is started through the PRODUCTION door with an empty environment and no start message.

**The one data argument, and how the table admits it.** Every argument is a literal of its row except the LAST: the address. It is made by ONE table function, `commissioningAddressArgument`, the way the address helper's request line is made (`host-alias/protocol.ts`: "from four integers 0 to 255 ... and from nothing else"): the text handed in is read as one strict dotted quad (no leading zero, at most 15 characters), held to 10.0.0.0/8, 172.16.0.0/12 or 192.168.0.0/16 and to a host part of 1 to 254, and the argument is WRITTEN AGAIN from the four numbers. It is never the caller's text; it cannot start with a dash or carry a separator, a prefix, a port or a name. This is the form SR-4 (3) took for the Linux device argument ("made by one table function from two integers"). It is nevertheless a NEW PLACE of G-R12 - a network address that is not the loopback listener becomes an argument - so it is put as **proposed named amendment SR-12** (section 7).

**No interface is an argument.** The request line proposed `... dev <interface>` and `-I <interface>`; the interface name comes from the database, and the brief names the address as the only data argument. So the reader of the neighbour row COMPARES the interface the kernel prints with the stored one (an entry of another interface is left aside), and the echo leaves by the route the kernel chooses for an address the rule admitted from a camera-interface source (stated limit, section 9).

## 2. Why the echo row and not the duplicate-address tool (DRIVER DECISION D-1)

`scripts/host/HOST-PROFILE-UBUNTU-24.04.md`: HOST-18 installs `iputils-arping` (`/usr/bin/arping`) and `iproute2`; HOST-38 sets `NoNewPrivileges=yes` and HOST-39 an EMPTY capability bounding set for the Core's unit; HOST-40 gives the Core the groups `audio` and the helper's, no other. The duplicate-address tool opens a packet socket, which needs a capability the unit cannot hold or gain. The profile grants the Core nothing for it, and S13-09 chose exactly that. So the Core's "does this address answer" is:

1. the echo row once. Exit code 0: an echo came back - **true**, the table is not asked;
2. exit code 1 (no echo): the neighbour row. The kernel asked the address question to send the echo, so the table now says whether a device answered it. LEARNT: **true** (a device that answers the address question but not the echo is still "in use"); ABSENT: **false**;
3. every other end of either program: thrown - "not known" is never "free".

The address-level duplicate check stays where it is: in the root helper, at every `add`. Whether the echo program may open its socket as the service user inside the unit is NOT stated by the profile (request line, section 8).

### 2a. After the container finding (`test/079_linux_container_checks.md`, the controller's message during this row) - THIS SUPERSEDES steps 1 and 2 above and the sentence "the echo program's text is not read" of section 4

The finding: Ubuntu 24.04 carries two different `arping` programs, and `arping -D` on an interface that cannot ask ENDS WITH 0 - an exit code proves nothing. Applied here, although neither row is that tool:

- **(1) Which program.** The Core names NO `arping` path at all. Its two programs are `/usr/sbin/ip` (package `iproute2`, HOST-18) and `/usr/bin/ping` (package `iputils-ping`, named by no item of the profile - request line). HOST-18 is already unambiguous for the helper's tool (`iputils-arping`, the other package absent).
- **(2) The echo row is judged by what it STATES, in a strict form, and the statement must agree with the exit code** (`echoReadingOf`, pure): at most 1,024 characters and 8 lines; exactly one line `--- <the address given> ping statistics ---`; exactly one summary line `1 packets transmitted, <0|1> received, [+1 errors, ]<100|0>% packet loss, time <n>ms` whose loss agrees with its count. Exit code 0 with nothing stated, with other words, or with "0 received"; exit code 1 with nothing stated or with "1 received"; the statistics of another address: `OUTPUT_MALFORMED`, thrown.
- **"Free" needs evidence.** After a stated "none back" the answer is `false` ONLY when the neighbour table holds an entry of that address on the camera interface in the state `FAILED` or `INCOMPLETE` (reader kind `SILENT`: the host ASKED there and nobody answered). NO entry at all (kind `ABSENT`: a port that cannot ask, another route) is thrown, reason `NOT_OBSERVED`.
- **Unknown refuses.** Every thrown reason reaches the job as `409 COMMISSIONING_NOT_AVAILABLE` for a typed new address (no job, no audit entry, nothing sent) and as "skip is not allowed, refuse" in the search for the next free address (the job's own rule, record 111 section 3: "not known is not free").

The summary form is written from the documented output of the iputils program, NOT read on a host: if the real text differs, every job is refused (fail closed) and `9A/H-13` shows it.

## 3. What was built

| Item | Where | What |
|---|---|---|
| The two rows and the address function | `CS/src/capture/adapters/local/mic-helper-args.ts` (appended section) | section 1 |
| The reader of the neighbour row | `CS/src/capture/fence/production-parts.ts`, `neighbourReadingOf` (pure) | section 4 |
| The runner's end | the same file, `endOfCommissioningRow` | the program's input is ended at once; it is killed at its bound (neighbour 1,500 ms, echo 2,500 ms: together under the job's 5,000 ms per question) or when the caller's signal fires, and the wait ends THEN |
| The observations of the host | the same file, `hostCommissioningInputsOf(parts)` | `{ job: { neighbour, answers }, scan: { mac } }` on `linux`; **null on any other platform** (nothing is made, nothing is ever started). BEFORE any program: the address goes through `decideDestination` (purpose `SET_IP` for the job, `COMMISSIONING_SCAN` for the scan) on the facts the host states NOW, and the argument is made from the address THE RULE RETURNED; the stored interface must be of the form of a name. A refusal starts nothing |
| The failure vocabulary | the same file, `CommissioningInputError` / `CommissioningInputFailure` | a code (`COMMISSIONING_INPUT_FAILED`), a reason of a closed set of eight, a fixed sentence: no address, no output, no cause |
| The hand-over | `CS/src/capture-composition.ts`, `mountHostAliasOf` | `const observed = input.commissioningInputs ?? hostCommissioningInputsOf({ platform: input.platform, timers, network, cameraInterface: () => stored.storedInterface() });` then `mac: observed.scan.mac` into the scan's parts and `inputs: observed.job` into the job's (both left out when `observed` is null). One optional seam member `commissioningInputs` on `ProductionCaptureInput`, a test's (as `cardPrograms`, `aliasTransport`, `aliasInterfaceFile`); the entry statement is unchanged |
| The scan takes a program's answer | `CS/src/modules/capture-config/factory-scan/service.ts` | the optional port `mac` may answer a promise and gets the address's own signal; it is asked ONCE, after the probe answered, in what is left of that address's 2,000 ms; what it throws, another form, or no answer before the signal is "not known" (null) |
| A test seam of the scan's door | `CS/src/modules/capture-config/factory-scan/index.ts` | `replaceForTest({ probe })`: the test's probe in the place of the handed-in one, every other part kept - so a test scans with the composition's rule, alias port and neighbour table while nothing is dialled |
| One comment | `CS/src/modules/capture-config/camera-network/service.ts` | the paragraph above `CameraNetworkInputs` no longer says "not built" |

NOT the runner of SR-11. Record 106c and decision C82 give that runner ONE use (the interface file); its rule's words admit no second. These programs go through the production door, as the card listing row does; the SR-11 rule and its nine-mutation control are untouched and green.

On a Linux production Core with a configured network the job and the scan are therefore no longer refused for missing inputs: the job's refusal 2 ("parts without the host's observations") cannot occur there. On macOS it still does, by name (`409 COMMISSIONING_NOT_AVAILABLE`), and nothing is run.

## 4. The strict form of the neighbour row

Bounds: at most 1,024 characters and 8 lines (more: unknown); the door's own 64 KiB before that. ONE line form, after runs of blanks are made one: `<address> dev <interface> [lladdr <six lower-case pairs>] [router] <STATE>`.

| Answer | When |
|---|---|
| LEARNT, the six pairs in upper case | exactly ONE entry of the asked address on the stored interface, state `REACHABLE`, `STALE`, `DELAY` or `PROBE`, with a unicast hardware address that is not all zero |
| SILENT (null for the job's `neighbour` and the scan; the ONLY "free" of `answers`) | one entry of the stored interface in the state `FAILED` or `INCOMPLETE` |
| ABSENT (null for `neighbour` and the scan; THROWN `NOT_OBSERVED` by `answers`) | no line; only entries of other interfaces |
| UNKNOWN (thrown, `OUTPUT_MALFORMED`) | a line of any other form; another address; a word after the state; `PERMANENT`, `NOARP`, `NONE` or any state not listed (an entry set by hand is not "learnt"); a learnt state without an address; a hardware address of another form, all zero, or a group address; two entries on the stored interface; an interface that is no name |

The echo program's text IS read, by the strict form of section 2a. Exit code other than 0 of the neighbour program, other than 0 / 1 of the echo program, an end by a signal: `ENDED_UNEXPECTEDLY`. The closed set of reasons has nine words (`NOT_OBSERVED` added).

## 5. Files

| File | Change |
|---|---|
| `CS/src/capture/adapters/local/mic-helper-args.ts` | one appended section (the two rows, the address function, the table object) |
| `CS/src/capture/fence/production-parts.ts` | one import line; one section after the card enumerator |
| `CS/src/capture-composition.ts` | two import names; the seam member; the statement `observed` and the two members in the two `provide` calls; one header paragraph |
| `CS/src/modules/capture-config/factory-scan/service.ts`, `index.ts` | the port's type and its asking; the `probe` member of `replaceForTest` |
| `CS/src/modules/capture-config/camera-network/service.ts` | one comment |
| `CS/src/capture/__tests__/static.test.ts` | one import line; ONE new case `row 111b` with its planted controls; one name in the list of seam members the entry never hands in. 70 -> 71 cases; no existing pin moved |
| `CS/src/__tests__/capture-composition.test.ts` | imports; one block of 8 cases (53 -> 61) |
| `CS/src/__tests__/capture-composition.db.test.ts` | imports; an optional third parameter of the block's `call`; one case |
| `CS/src/modules/capture-config/camera-network/__tests__/routes.db.test.ts` | imports; one case (6 -> 7) |
| `CS/src/modules/capture-config/factory-scan/__tests__/routes.db.test.ts` | imports; one case (8 -> 9) |

Not edited: `fence/boot-key.ts`, `fence/index.ts` (it re-exports the parts file whole), `src/index.ts`, `capture/boot/*`, `capture/host-alias/*`, `packages/shared`, `apps/core-web`, `scripts/host/*`.

## 6. Checks (2026-10-13, in `CS`, `--maxWorkers=2`, each ONE run; process, port and PostgreSQL runs with the command sandbox off; stub runs under `.locks/heavy-host.lock`, database runs under `.locks/db-migrate.lock` on throw-away databases)

| Check | Command | Result |
|---|---|---|
| Unit: the rows, the reader, the runner over stand-ins | `npx vitest run --project unit src/__tests__/capture-composition.test.ts` | `Test Files 1 passed (1)`, `Tests 61 passed (61)` |
| The capture static file | `npx vitest run --project unit src/capture/__tests__/static.test.ts` | `Test Files 1 passed (1)`, `Tests 71 passed (71)` |
| Every static rule file under `src` (28) | `find src -name static.test.ts \| xargs npx vitest run --project unit` | `Test Files 28 passed (28)`, `Tests 567 passed (567)` |
| `test/static`, the capture-config module, the composition, the fence, the table tests | `... test/static src/modules/capture-config src/__tests__/capture-composition.test.ts src/capture/fence/__tests__/fence.test.ts <two table tests> src/capture/adapters/__tests__/real.test.ts` | `Test Files 35 passed (35)`, `Tests 772 passed (772)` |
| After the last source edit (a comment): `src/modules/capture-config test/static src/capture/__tests__/static.test.ts` | the same form | `Test Files 31 passed (31)`, `Tests 604 passed (604)` |
| Database: the scan's own file and the composition on booted production Cores | `npx vitest run --project db src/modules/capture-config/factory-scan src/__tests__/capture-composition.db.test.ts` | `Test Files 2 passed (2)`, `Tests 24 passed (24)`; `0 remain` |
| Database: the job on the stub | `npx vitest run --project db src/modules/capture-config/camera-network` | `Test Files 1 passed (1)`, `Tests 7 passed (7)`; `0 remain` |
| Typecheck | `npx tsc --noEmit -p .` | exit 0 (last run after the last edit) |
| Lint | `npx oxlint <the changed files>` | exit 0 |

**SECOND RUNS, after the change of section 2a (a product change, not a red):** composition unit `Tests 62 passed (62)`; `src/__tests__/capture-composition.test.ts src/capture/__tests__/static.test.ts src/modules/capture-config test/static` `Test Files 32 passed (32)`, `Tests 666 passed (666)`; the 28 static files `567 passed`; the three database files together (job on the stub, scan, composition) `Test Files 3 passed (3)`, `Tests 31 passed (31)`, `0 remain`; typecheck 0; lint 0. The counts of the first table are of the first runs (composition unit 61).

Cases added for the finding: the pure reader of the echo row (4 accepted texts, 19 unknown); unit `DOES IT ANSWER` - exit code 0 with nothing stated, with other words, with "none back" stated; exit code 1 with nothing stated, with an echo stated, with another address's statistics (each `OUTPUT_MALFORMED`); "none back" with no entry, or only another interface's (`NOT_OBSERVED`); job database case - a typed new address for which the echo stand-in ends with 0 and states nothing, and one with no entry of the table: each `409 COMMISSIONING_NOT_AVAILABLE`, 0 requests at the stub, no audit entry.

The brief's list of output forms, by case:

| Asked | Where |
|---|---|
| present | unit "PRESENT" (the stand-in was started with exactly `5 / -4 / neigh / show / to / 192.168.50.21` and none of the server's environment; a factory address only with its alias address on the port); database: scan `mac`, job `neighbourMac` = `authenticatedMac` = `confirmedMac` |
| absent | unit "ABSENT" (nothing, `FAILED`, `INCOMPLETE`, another interface); job: the next free address is taken because no echo came and nothing was learnt |
| malformed | unit reader case (33 texts and 5 interface names, each UNKNOWN), unit "UNKNOWN is thrown"; scan database case (a device's words after the state: `mac` null, the words nowhere) |
| oversized | 60 lines (above the reader's bound) and 70,000 bytes (the door's bound): `OUTPUT_TOO_LONG` |
| a hung program, bounded | `exec /bin/sleep 30` with a bound of 300 ms: `TIMED_OUT` in under 5 s, for each row; the caller's signal: `STOPPED` |
| not there / the door's refusal / another exit code / ended by a signal | `NOT_STARTED`, `NOT_STARTED`, `ENDED_UNEXPECTEDLY`, `ENDED_UNEXPECTEDLY` |
| "does it answer" | echo: yes, the table not asked; no echo + learnt: yes; no echo + absent: no; exit 2, not there, hung, table unreadable: thrown. Job database case: `409 CAMERA_NEW_ADDRESS_IN_USE` with 0 requests at the stub; "not known": `409 COMMISSIONING_NOT_AVAILABLE`, no audit entry |
| the rule before a program | 10 refused addresses, the alias address itself, 3 unreadable fact sources, 6 unknown interfaces - each with a door that fails the test if it is ever asked |
| the platform seam | `darwin`, `win32`, `freebsd`, empty: null, the door never asked; on a booted production Core composed as `darwin`: scan `mac` null, job `409 COMMISSIONING_NOT_AVAILABLE`, no stand-in started |
| no free text in a log, audit entry or error | the error object searched for the canary, the address, the path and the row's words; the scan's log lines, persisted failures and audit rows searched for the hardware address, the canary and the addresses; the job's typed account searched for (count only) in the programs' arguments and environment too: 0 |

## 7. The named amendment (to confirm), and the one this row did NOT take

- **SR-12, proposed, BUILT UNDER** - the exact entry is the first `row 111b` line of `delegation_progress/file_requests.md` (one computed argument, the address, last in each of the two rows, made from four integers by the one table function; the one caller hands in what the destination rule returned; `linux` only; no interface in a row). Pinned by the static case `row 111b` with controls: an interface, a second argument, a text, a prefix, a public and a loopback address, another verb, a door call fed the caller's text, a `target` that is not the rule's answer, a program handed in by a product file.
- **SR-13, NOT TAKEN** - input (c) below.

## 8. NOT BUILT: (c) the scan's endpoint count / conflict flag - the exact remainder

The source the request line names is a WS-Discovery probe from an alias address: a second call in `capture/adapters/camera/ws-discovery.ts` (not this row's file) under an amendment of G-R9 and G-R13 (not this row's to write). The exact entry is the second `row 111b` request line. A finding the ruling needs, my reasoning and NOT measured: a UNICAST probe follows the one neighbour entry the host holds for the address, so of two cameras on one factory address only one receives it; the count must come from the MULTICAST probe sent from the alias address (which the reference used, specs F-4.1 row 8) with the answers grouped by address, or from an address-level tool only the root helper could run.

Until then, on a production Core: `endpointCount` 1 and `conflict` false for every device; the job's refusal `CAMERA_ADDRESS_CONFLICT` has no production input; vendor, model, name and `registeredDeviceId` stay null; a device that answers the echo but not ONVIF is not listed by the scan (the JOB tells the two apart: `ONVIF_NOT_ENABLED` against `CAMERA_UNREACHABLE`, now with a real input). What limits the harm of two cameras on one address today: nothing is set unless the hardware address the device reports equals the neighbour table's, and the job completes only when the SAME hardware address is learnt at the new address.

## 9. Host-profile requests and stated limits (third `row 111b` request line; nothing under `scripts/host/` was changed)

1. `/usr/bin/ping` is named by no item of the profile; whether the service user may send an echo inside the unit (HOST-38, HOST-39) is unstated. HYPOTHESIS, not read on a host: Ubuntu 24.04 opens the unprivileged echo socket to every group. If not, the echo program ends with exit code 2, the Core reads "not known" and refuses every job - fail closed.
2. `/usr/sbin/ip`: `iproute2` is installed by HOST-18 without a stated path (the helper names the same one).
3. The duplicate-address tool is not started by the Core and cannot be (section 2).
4. The boot's program checks do not ask whether the two programs exist.
5. The echo leaves by the kernel's route: no interface is an argument.

## 10. DRIVER DECISIONS (for the controller to confirm)

| # | Decision | Reason / alternative |
|---|---|---|
| D-1 | "Does it answer" = one echo, then the neighbour table; not the duplicate-address tool | section 2: the profile grants the Core no packet socket. Alternative: a third verb of the root helper - a decision |
| D-2 | No interface in any row; the reader compares the printed interface with the stored one | "the ONLY data argument" (the brief); a name of the database never reaches a program |
| D-3 | The destination rule is asked AGAIN inside the fence, before every program, on the facts of that moment | "an address that passed the rule" is then true at the one caller of the door, whatever calls it; costs one pure call |
| D-4 | A hardware address counts in the states `REACHABLE`, `STALE`, `DELAY`, `PROBE` only; `PERMANENT` and every other state is "unknown" | "the MAC the host has LEARNT"; an entry set by hand is not learnt. Consequence, safe direction: an address a device left moments ago can read "in use" for a few seconds |
| D-9 | "Free" requires the host's own `FAILED` / `INCOMPLETE` entry; no entry is "not known" (section 2a) | the container finding, applied to these rows. Cost, to measure in `9A/H-14`: if the kernel has already dropped the entry when the table is read, a free address is refused - the safe direction |
| D-5 | "Not known" of `neighbour` is THROWN (the job counts an input failure and sets nothing); only ABSENT is null | a failed program is not "no device" in the log |
| D-6 | The seam `commissioningInputs` on `ProductionCaptureInput` | as C82 (3) accepted for the three earlier seams; the static control names it as a member the entry never hands in |
| D-7 | `replaceForTest({ probe })` on the scan's control | the only way to scan with the composition's own parts while nothing is dialled |
| D-8 | The rows live in `mic-helper-args.ts` | the brief names that file; the card listing row is there. A file of its own would be the cleaner home - a rename is not this row's |

## 11. The doubles, and what stays unproven

| Double | What it is |
|---|---|
| the two programs | `#!/bin/sh` scripts in a temporary directory that record their arguments and environment and print a fixture, started by the REAL production door (only the core-file limit of the test process is answered as 0) |
| the host's facts | hand-written tables of interfaces; the alias double puts an address on the camera port |
| the camera | the fake ONVIF stub on 127.0.0.1 (job database case); a probe of the test (scan cases) |

| Unproven | Check |
|---|---|
| `/usr/sbin/ip` at that path, its line form and exit code for a present, a failed and an absent entry, as the service user inside the unit | `9A/H-13`, `9A/H-14` |
| `/usr/bin/ping` at that path, its exit codes 0 / 1 / 2, and that it may send from inside the unit (HOST-38, HOST-39) | `9A/H-13`, `9A/H-14` |
| The echo and the address question really leave by the camera port, also for a factory address through the alias | `9A/H-13`, `9A/H-14` |
| The neighbour table holds the camera's hardware address after the unauthenticated poll, before and after the set (a real camera reboots) | `9A/H-14` |
| A device that answers the address question but not the echo is found "in use" | `9A/H-14` |
| Two cameras on one factory address: flagged and not changed (input (c) is not built) | `9A/H-15` |
| The real helper around a job and a scan with these inputs | `9A/H-05`, `9A/H-06` |

## 12. Rules kept

Edit tool only for every existing file; this record and `delegation_progress/row_111b.md` with Write. No scripted replace, no shell append. The claims line was the first write. Each of the static file, the composing file and the three test files was re-read at the place of its edit immediately before it. No commit, no stage. No full suite; each targeted run once. Throw-away databases under `.locks/db-migrate.lock`, "0 remain" each time; the stub's ports under `.locks/heavy-host.lock`, per run. `apps/input-av/data/` not opened; no `.env` read. The two fence files of agent V5 were not touched.

---
*Generated: 2026-10-13*
