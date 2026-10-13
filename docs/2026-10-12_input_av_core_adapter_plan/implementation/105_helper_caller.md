---
task: 2026-10-12_input_av_core_adapter_plan
row: 105
milestone: M10 / WP-19b
agent: coder-execution (batch 9, agent R7)
date: 2026-10-13
tier: T3
status: needs-review - built and tested on doubles; ONE ruling open (the intent entry has no audit type, section 7); UNPROVEN ON LINUX
closes_requirements: the Core half of S13-09 / C19 (decisions/103 PF-3, PF-4; effects (a), (b), (c), (e) of its row 105 line); DR-4 (the Core's guard, on handed facts); F-07 (the refusal by name, on handed facts); S13-10 (c) as an ORDER (intent awaited before the line, result after) - not yet as audit entries
---

# Row 105 - the Core's one caller of the address helper, behind a platform seam

**Plain statement.** The real helper is not on this Mac and was never started. No `ip`, `arping`, `sudo` or other network command ran; no host address was read or changed; no real device was contacted. Everything was closed on two doubles: a transport function that answers from a script, and a recording local-socket server of the test in a temporary folder that speaks the helper's line protocol. **Nothing here is proven on Linux** (section 8).

## 1. What was built

| File | Kind | Content |
|---|---|---|
| `apps/core-server/src/capture/host-alias/protocol.ts` | new, pure (imports nothing) | The helper's table of 36 answers (`HELPER_CODES`, a copy of the delivered file's `CODES`; a test reads the delivered file and compares); the request lines made from four integers and one integer of minutes (`addRequestLine`, `delRequestLine`); the strict address and minutes checks (`aliasQuadOf`: one dotted quad without leading zeros, RFC 1918, host part 1 to 254; `aliasMinutesOf`: an integer 5 to 480 of type number); the answer parser (`helperAnswerOf`: byte for byte one pair of the table, at most 64 bytes, else null) |
| `apps/core-server/src/capture/host-alias/caller.ts` | new, in the capture area; imports two TYPES of the destination rule and the protocol file | `createHostAliasCaller({ transport, journal, facts })` with `add` and `remove`; the wrong-network guard (`wrongNetworkRefusal`, DR-4); the interface file against the stored row (`interfaceAgreementRefusal`, F-07); the mapping of every helper code and every transport word to a named Core refusal (`judgeExchange`); the intent and result order; one call in flight. No socket, no file system, no process, no timer, no clock, no log call |
| `apps/core-server/src/capture/host-alias/index.ts` | new | the folder's barrel, for use inside the capture unit (rows 106, 107, 111). `capture/index.ts` was not edited |
| `apps/core-server/src/host-alias-socket.ts` | new, a file of NO unit (beside `config.ts`) | The one local-socket client (`createLocalSocketTransport`) and THE PLATFORM SEAM (`hostAliasSocketTransportOf({ platform, socketPath })`) |
| `apps/core-server/src/config.ts` | 9 added lines in 5 places | the key `DEMS_CAPTURE_ALIAS_SOCKET` -> `captureAliasSocketPath` |
| `apps/core-server/src/plugins/config/load-config.ts` | 3 edits | the key read from the environment under `parseCapturePath` |
| `apps/core-server/src/capture/host-alias/__tests__/caller.test.ts` | new, 22 cases | section 5 |
| `apps/core-server/src/__tests__/host-alias-socket.test.ts` | new, 18 cases, with the recording double | section 5 |
| `apps/core-server/src/plugins/config/__tests__/load-config.test.ts` | 1 new case | the key |

Nothing of the product calls the seam or the caller yet (a static case holds that): the composition belongs to rows 106 and 107.

## 2. The call

Order of an `add`; each step refuses by a fixed word and stops:

| # | Step | Refusal(s) | Entries written | Line sent |
|---|---|---|---|---|
| 1 | minutes | `MINUTES_OUT_OF_RANGE` | 0 | no |
| 2 | address | `ADDRESS_MALFORMED`, `ADDRESS_NOT_PRIVATE`, `HOST_PART_OUT_OF_RANGE` | 0 | no |
| 3 | one call in flight | `CALL_IN_PROGRESS` | 0 | no |
| 4 | the host's facts, through the reader handed in | `HOST_FACTS_UNREADABLE` | 0 | no |
| 5 | interface file against the stored row (F-07) | `NETWORK_NOT_CONFIGURED`, `INTERFACE_ROW_UNREADABLE`, `INTERFACE_FILE_UNREADABLE`, **`INTERFACE_FILE_DIFFERS_FROM_ROW`** (the name row 81's boot check uses) | 0 | no |
| 6 | wrong-network guard (DR-4) | **`OTHER_INTERFACE_HOLDS_SUBNET`** (the helper's own overlap test: under the shorter prefix, so a wider or narrower network over the /24 also refuses), `HOST_HOLDS_ADDRESS`, `CAMERA_INTERFACE_HOLDS_SUBNET` | 0 | no |
| 7 | the transport's check before dialling | `NOT_AVAILABLE_ON_THIS_PLATFORM`, `HELPER_NOT_CONFIGURED`, `HELPER_NOT_INSTALLED`, `HELPER_SOCKET_UNSAFE` | 0 | no |
| 8 | INTENT entry (awaited) | `INTENT_NOT_RECORDED`: nothing is sent | 1 intent | no |
| 9 | the one line; the answer under the bound | section 3 | - | yes |
| 10 | RESULT entry (awaited), for every way step 9 ends | flag `resultRecorded: false` when it cannot be written | 1 result | - |

A `remove` runs steps 2, 3, 7 to 10. An outcome is `{ action, refusal | null, effect, address, attempted, helperCode, resultRecorded }`: words of closed sets, the helper's number and the address rebuilt from its four numbers. No interface name, no path and no text of an answer is in it.

`effect` says what the outcome means for the address: `DONE`, `NOT_DONE` (certainly nothing changed), `UNKNOWN` (the helper may have acted: no answer read, an answer not of the table, or the helper's `ADD_FAILED`, `DEL_FAILED`, `INTERNAL` - record 104, decision D-12).

## 3. Every helper code and every transport word

- **Helper, 36 of 36:** `0 OK` -> no refusal, `DONE`. Each of the other 35 -> its own Core name `HELPER_<NAME>` (for example `41 ALIAS_LIMIT_REACHED` -> `HELPER_ALIAS_LIMIT_REACHED`, `14 REQUEST_MALFORMED` -> `HELPER_REQUEST_MALFORMED`, `35 STATE_DIR_UNSAFE` -> `HELPER_STATE_DIR_UNSAFE`), with its number in `helperCode` and a kind in `HELPER_REFUSAL_KINDS`: `REQUEST` (13 codes: 10, 13 to 16, 20 to 27 - the helper refused a line the Core built, a defect of the Core), `INSTALLATION` (10: 11, 12, 30 to 37), `HOST_STATE` (6: 40 to 45), `TOOL` (6: 50 to 54, 60); 35 in all, and a test asserts that the table's keys are exactly the 35 names.
- **Transport, 14 words:** not this platform; not configured; path not plain; socket absent; not a socket; owner or mode; folder unsafe; line not of the grammar; connect refused / not permitted / failed; timed out; connection lost; answer too long. Each has one Core refusal; the last three are `UNKNOWN`.
- **Anything else** (an answer that is not exactly a pair of the table, a transport that throws or hands back another value): `HELPER_ANSWER_NOT_UNDERSTOOD`, `CALLER_DEFECT` or `HELPER_UNREACHABLE`, effect `UNKNOWN`, with its result entry.

## 4. The client and the seam (`src/host-alias-socket.ts`)

- `exchange(line)`: refuses a line that is not of the helper's grammar (nothing sent); runs the checks below; connects with the PATH and nothing else; writes the one line; reads at most 64 bytes until the helper closes; one time bound for the whole call, `HOST_ALIAS_CALL_BOUND_MS = 35 000` (the unit ends an instance after 30 s); destroys the connection on every way out; never throws.
- Before it dials, by what a client can check: the path is absolute and plain (no empty, `.` or `..` part, no NUL, at most 100 bytes, at least a folder and a name); the folder is a real folder of the trusted owner and not writable by group or others; the node is a socket (a link is not followed), owned by the trusted owner, mode exactly 0660. The folder rule is what makes the check hold until the connection: nobody but the owner can put another node at that name.
- **The seam:** `hostAliasSocketTransportOf({ platform, socketPath })`. Any platform but `linux`: `NOT_AVAILABLE_ON_THIS_PLATFORM`, whatever is configured, nothing touched (this Mac). Linux without a path: `NOT_CONFIGURED`. Linux with a path: the client with trusted owner root (a constant). The seam is the platform's (AD-08): no test value is in `src/`; the tests reach the mechanism below it with the test's own user as owner, and one test calls the seam itself as "linux" against the double and is refused, because the double is not root's.

## 5. Tests and checks

| Check | Command (in `apps/core-server`) | Result |
|---|---|---|
| The three targeted files, run 1 | `npx vitest run --project unit --maxWorkers=2 src/capture/host-alias/__tests__/caller.test.ts src/__tests__/host-alias-socket.test.ts src/plugins/config/__tests__/load-config.test.ts` (command sandbox off: the double binds a local socket path) | `Tests 2 failed / 87 passed (89)`: both failures in my own new tests (a static pattern that took a pattern's own method for a process start; the double's count of connections closed by the client) |
| The same, run 2, after the two test fixes | same | `Test Files 3 passed (3)`, `Tests 89 passed (89)` |
| Static rules after the change | `npx vitest run --project unit --maxWorkers=2 src/capture/__tests__/static.test.ts src/capture/adapters/__tests__/static.test.ts test/static` | `Test Files 1 failed / 17 passed (18)`, `Tests 2 failed / 263 passed (265)`. The capture static file and all of `test/static` PASS with the new files and the new key. The 2 failures are not row 105's: `src/capture/adapters/__tests__/static.test.ts:539` and `:550` (rule A-10 (b), (c)) name `src/modules/capture-discovery/adopted-test.ts` - agent R3's rows in flight (owner of that list) |
| Typecheck | `npx tsc --noEmit` | errors only in `src/modules/capture-inputs/audio-cards/__tests__/routes.db.test.ts` (agent R4, in flight: 20 or more lines in the first run, 1 in a second look a minute later); 0 in a file of this row |
| Lint | `npx oxlint` on the new files, `config.ts`, `plugins/config` | no finding |
| The STATE_DIR hypothesis | a probe outside the repository (session scratchpad) that drives row 104's own bench: the helper's test copy, `check`, marks folder removed, then made | `result=STATE_DIR_UNSAFE code=35`, tool calls `[]`; then `result=OK code=0`; `Ran 1 test ... OK` |

What the cases cover, against the brief's list:

| Asked | Where |
|---|---|
| every helper code mapped | 36 x 2 on the scripted transport; 36 x 2 again end to end through the real client and the recording double (72 connections, the double received exactly `add 192.168.1.253/24 30` / `del 192.168.1.253/24` each time) |
| 1 intent and 1 result entry per action | every one of those 144 actions; order `preflight, intent, exchange, result` asserted; 0 entries for every refusal before the call |
| a target subnet held by another interface is refused | 6 forms of the other network (same /24, an address in it, /16 over it, /25 and /32 inside it, the default) -> `OTHER_INTERFACE_HOLDS_SUBNET`, nothing recorded, nothing sent, not even the check before dialling |
| a mismatch of file and row is refused by name | `INTERFACE_FILE_DIFFERS_FROM_ROW`; 12 pairs of the agreement table; no interface name in the outcome |
| a helper that hangs | silent, and answering without closing: `TIMED_OUT` inside the bound (200 ms in the test), the Core closes the connection; through the caller `HELPER_TIMED_OUT`, `UNKNOWN`, 2 entries |
| socket absent / not a socket / wrong owner or mode | absent node, absent folder; a file, a folder, a LINK to the real socket; 8 modes other than 0660; another trusted owner; 5 folder modes writable by group or others; 11 unsafe paths - the double counted 0 connections in each |
| a malformed or oversized answer | 28 texts in the parser and the caller; 10 through the socket (control bytes, a NUL, non-ASCII bytes, two lines, a wrong number for a name); 65 bytes, 4 096 bytes and an endless stream -> `ANSWER_TOO_LONG` and the Core stops reading; 64 bytes are handed on and judged |
| nothing from an answer reaches a log unsanitised | the files hold no log call (static case); outcomes and entries are serialised in the tests and searched for the planted text (an interface name, a home path, a password-like word, an escape sequence): 0 |
| no real `ip` or network command | static cases: no process module, no start call and no host program named in the four files; one connection call, `createConnection({ path: socketPath })`; one importer of the stream-socket module in the server's production sources |

## 6. The two decisions left open for this row

**(a) Where the client lives (C17 / C19): the kept rule is RESPECTED, not amended; SR-1 is not extended.** The rules' text: G-R2 and G-R10 forbid a socket module "under `capture/`"; G-R1 forbids it in the host units (`modules`, `engine`, `plugins`, `core`); C19 itself names the two ways - "respected (client outside it) or amended by a named SR row". The client is therefore `src/host-alias-socket.ts`, a file of no unit beside `config.ts` (a new top folder would have been an unlisted unit of `test/static/imports.test.ts`), and its transport is handed into the capture area, where the caller is - row 80's shape. No static list was edited by this row and none needs an entry to be green. Because "outside both scans" must not mean "seen by nobody", the file is pinned by this row's own test (one importer of the module in production sources, one connection call by path, one caller of the mechanism with root as owner), and a NAMED entry is requested from the controller so that the decision has a row (proposed SR-6; optional pin in `test/static/network.test.ts`).

**(b) The configuration key: ONE key, `DEMS_CAPTURE_ALIAS_SOCKET` -> `config.captureAliasSocketPath`**, under the path rule of the other capture keys (`parseCapturePath`: absolute, no NUL, null when unset; a relative value stops the boot with `CAPTURE_PATH_NOT_ABSOLUTE`, the value never in the message). `decisions/103` D-2 recommended a constant, "because a configurable path lets configuration point the Core at another socket". The cell and the brief ask for the key; the concern is met in the client instead: a path is dialled only if root owns the socket and its folder (section 4). The config pin of the capture static file was moved by row 85 (its writer) while this row ran. One difference remains and is requested: the boot check of row 80 asks the constant path, the client dials the configured one.

## 7. Not built, and why

| Not built | Why | Who |
|---|---|---|
| **The binding of intent and result to the audit chain and to `host_network_aliases`** | The vocabulary has three alias types, all results; no type can be written BEFORE the call and a refused `add` has none. The caller is built behind a journal port and proven on a recording journal (the ORDER and the COUNT of S13-10 (c)); the entries themselves need two types (request filed: `HOST_ALIAS_REQUESTED`, `HOST_ALIAS_ADD_FAILED`) | controller's ruling, then row 106 |
| The real reader of the host's facts (interfaces and their subnets, the interface file's one name, the stored row) | The guard and the agreement are judged on facts HANDED IN; reading them needs the operating system's interface list and a file read, neither admitted under `capture/` | rows 106 / 107 with the composition (row 81's `INTERFACE_FILE_COMMAND` already reads the file through the host runner; row 108 reads the row) |
| The composition (who calls the seam, where the caller is mounted) | no operation exists yet (row 102 in flight) | rows 106, 107 |
| The alias lifecycle, the boot sweep, refusal while a session is open, the timer of S13-10 (a) | row 106 | row 106 |
| `CONNECT_REFUSED` and `CONNECT_NOT_PERMITTED` exercised on a real node | a stale socket node and a foreign group cannot be made by one unprivileged user with Node's server; the mapping is three lines of the error handler | `9A/H-05` |

## 8. Unproven without the host

| Unproven | Check |
|---|---|
| The whole call through the real socket unit as the service user: the node's owner, group and mode as the service manager creates them pass the client's check; the helper reads the line and closes after its answer | `9A/H-05` |
| A node whose OWNER differs from its folder's (on this Mac one user owns both; only "not the trusted owner at all" and the modes are exercised) | `9A/H-05` |
| The 35 s bound against a real conflict probe and a real `ip`; an `add` that times out at the Core and completes in the helper | `9A/H-06` |
| The helper answers a Core that runs with `NoNewPrivileges=yes` and no capability | `9A/H-06` (V-4 of `decisions/103`) |
| The marks folder exists at the first request through the socket (the unit creates it before the helper starts) | `9A/H-05` |
| The Core's reading of the host's interfaces is right, so that the guard sees what the helper sees | `9A/H-06`, `9A/H-13` |

## 9. The STATE_DIR hypothesis: CONFIRMED on the double

`check` answers `35 STATE_DIR_UNSAFE` while the marks folder does not exist, and `0 OK` once it does (section 5, last row). By the source: `check` runs `installation()`, which calls `marked_addresses()`, which refuses a missing folder; the helper never creates it; only `RuntimeDirectory=dems-core-netalias/marks` of the service unit does, at the start of an instance, and `/run` is emptied at reboot. So: (1) through the socket the Core should never see 35 for this reason (unit file as read; unproven on Linux); if it does, it is `HELPER_STATE_DIR_UNSAFE`, kind `INSTALLATION`; (2) root's `check` during installation reads 35 on a correct installation until one connection was made, and again after every reboot - a line for the procedure (request filed); (3) row 106's boot sweep is such a first connection.

## 10. What row 106 gets, and what it needs

```ts
import { createHostAliasCaller, type HostAliasJournal, type HostAliasFacts, type HostAliasTransport, type HostAliasOutcome } from './host-alias';

const caller = createHostAliasCaller<Subject, Token>({ transport, journal, facts });
await caller.add({ address, minutes, subject });   // -> HostAliasOutcome
await caller.remove({ address, subject });          // -> HostAliasOutcome
```

- `transport`: `hostAliasSocketTransportOf({ platform, socketPath: config.captureAliasSocketPath })` of `src/host-alias-socket.ts`, made by the composition OUTSIDE the capture area and handed in (the port is satisfied by structure; no import in either direction).
- `journal`: row 106 writes it. `intent(entry)` is awaited before the line and returns a token (the row id); `result(entry)` is awaited after with `entry.outcome`. `subject` is passed through unread (operator, reason, job).
- `facts`: row 106 or 107 writes the reader (`HostAliasFacts`: `storedInterface`, `fileInterface`, and the three network members of the destination rule's context).
- Rules it must hold: `effect === 'UNKNOWN'` is "possibly in place" (remove it; never record it as absent); `HELPER_NOT_MARKED` on a removal means nothing of ours is there (close the row); `HELPER_ALIAS_LIMIT_REACHED` means one alias exists already; `CALL_IN_PROGRESS` is a refusal, not a queue; `attempted === true && resultRecorded === false` must be reported (the intent stands alone); an action refused before the call wrote nothing.
- It still needs: the audit types of section 7; a way to LIST the marks folder for "every marked address with or without a row" (a file-system read: a named static entry, or a question through the host runner); the refusal while a session is open; removal at shutdown and at start. The timer S13-10 (a) only if H-S fails at `9A/H-06` - then the helper changes, not this caller.

## 11. DRIVER DECISIONS (for the controller to confirm)

| # | Decision | Reason / alternative |
|---|---|---|
| D-1 | The client is a file of no unit, `src/host-alias-socket.ts`; pinned by this row's own test; a named entry requested | section 6 (a) |
| D-2 | A key, not the constant `decisions/103` D-2 recommended; the client refuses any socket root did not make | section 6 (b) |
| D-3 | The mechanism under the seam takes the trusted owner as an argument; the seam is its one caller in the product and passes root | The tests need a socket their own user owns. Alternative: a build-step copy as row 104 does for the helper |
| D-4 | A refusal before the call writes NO entry; intent and result wrap a call that is about to be made | S13-10 (c): "before the helper is called ... and after". The refused attempt is the operation's to audit |
| D-5 | A removal is not held back by the guard or by a disagreement of file and row | Taking an address away is the safe direction; the helper removes only what it marked |
| D-6 | No intent, no call (`INTENT_NOT_RECORDED`); a result that cannot be written is flagged, the outcome stands | fail closed before the act, never hide an act after it |
| D-7 | One call in flight, a second is refused | the socket unit admits one connection |
| D-8 | The bound is 35 s for the whole call; an answer is complete only when the helper has closed | the unit's 30 s; PF-4 "one line ..., then the connection is closed" |
| D-9 | `ADD_FAILED`, `DEL_FAILED`, `INTERNAL`, a time-out, a lost connection, an unreadable answer: effect `UNKNOWN` | record 104 D-12 |
| D-10 | The Core's own address check is the helper's bound 2 with host part 1 to 254; a second strict parser stands in `protocol.ts` | the destination rule exports no parser; the two patterns are the same |
| D-11 | No database and no audit write in this row (the profile's `db` token is not used) | section 7, first line |

## 12. Rules kept

Edit tool only for every existing file (`config.ts`, `load-config.ts`, `load-config.test.ts`, `file_claims.md`, `file_requests.md`); new files with Write. No commit, no stage. No full suite; targeted files, `--maxWorkers=2`, a second run only after a failure (in my own new tests). No port bound (a local socket path in a temporary folder, removed after each case), no process started by the product code, no heavy-host lock needed, no database. `apps/input-av/data/` not opened; no `.env` read. `scripts/host/netalias/` read and its test bench driven from the scratchpad, nothing written there.

---
*Generated: 2026-10-13 11:05 WIB*
