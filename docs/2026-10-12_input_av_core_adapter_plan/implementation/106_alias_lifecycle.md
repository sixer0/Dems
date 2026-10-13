---
task: 2026-10-12_input_av_core_adapter_plan
row: 106
milestone: M10 / WP-19b
agent: coder-execution (wave 11, agent A1)
date: 2026-10-13
tier: T3
status: needs-review - the lifecycle is built and tested on doubles and on throw-away databases; NOT built: the routes of operations 104 / 105 and the mount in the composition (section 8); ONE vocabulary gap pinned (section 5); three driver decisions (section 10); UNPROVEN ON LINUX
closes_requirements: S13-10 (b) and (c) on doubles (with the gap of section 5); the Core half of "one alias at a time" (S13-08 (3), C19); refusal while a session is open. S13-10 (a) is NOT the Core's (section 4)
---

# Row 106 - the alias lifecycle

## 1. THE INTERFACE ROWS 107 AND 111 GET (published early; names are final unless section 1 says otherwise later)

Import from the folder's barrel, inside the capture unit: `apps/core-server/src/capture/host-alias` (`index.ts`).

```ts
import { type HostAliasLifecycle, type HostAliasActor } from '<...>/capture/host-alias';

// ONE object per app, made by the composition (not by a job). A job is HANDED it.
interface HostAliasLifecycle {
  /** The alias in place, or null. A plain read of the one open row; no helper call. (Operation 104.) */
  state(): Promise<HostAliasRecord | null>;

  /** Adds the ONE temporary address. Refused while a session is open and while another alias is open. */
  acquire(request: {
    readonly address: unknown;                                  // the alias address, dotted quad WITHOUT prefix (the target's /24 with the configured alias host); judged here, never trusted
    readonly minutes: unknown;                                  // 5..480, the configured alias lifetime
    readonly reason: 'FACTORY_SCAN' | 'SET_CAMERA_ADDRESS';
    readonly actor: HostAliasActor;                             // the technician of the operation
  }): Promise<HostAliasAcquired>;

  /** Removes the alias in place. A job calls it in its `finally` with 'JOB_DONE'; operation 105 with 'MANUAL'. */
  release(request: {
    readonly removeReason: 'JOB_DONE' | 'MANUAL';
    readonly actor: HostAliasActor | null;                      // null: the system
  }): Promise<HostAliasReleased>;

  /** The boot sweep, the shutdown removal: called by the composition's hooks, never by a job. */
  boot(): Promise<HostAliasSweepReport>;
  shutdown(): Promise<HostAliasReleased>;
}

interface HostAliasActor { readonly operatorId: string; readonly deviceId: string | null; readonly operationId: string; readonly permission: string }

interface HostAliasRecord { readonly aliasId: string; readonly address: string /* no prefix */; readonly reason: 'FACTORY_SCAN' | 'SET_CAMERA_ADDRESS'; readonly addedAt: number; readonly expiresAt: number; readonly removeError: string | null }

type HostAliasAcquired =
  | { readonly ok: true; readonly alias: HostAliasRecord }
  | { readonly ok: false; readonly refusal: string /* a CODE of a closed set: SESSION_OPEN, ALIAS_ALREADY_OPEN, SHUTTING_DOWN, RESULT_NOT_RECORDED, or a refusal of row 105's caller */; readonly stillInPlace: boolean };

type HostAliasReleased =
  | { readonly ok: true; readonly removed: boolean /* false: none was in place */ }
  | { readonly ok: false; readonly refusal: string /* a CODE */; readonly stillInPlace: boolean };

// Operation 104 without a lifecycle object: the same plain read.
function readHostAliasState(host: { read: HostAliasHost['read'] }): Promise<HostAliasRecord | null>;
```

AS BUILT (13:20 WIB): the shape above is what the barrel exports, unchanged since it was published, plus `readHostAliasState`. Row 107 (agent A2) declared a port of its own in the caller's shape (`alias.add({ address, minutes, subject })` / `alias.remove(...)` answering `{ refusal, effect }`); the five-line adapter from that port to `acquire` / `release` is item (4) of the composition request in `file_requests.md`.

The shape of a job (rows 107, 111):

```ts
const got = await aliases.acquire({ address, minutes, reason: 'FACTORY_SCAN', actor });
if (!got.ok) return refuse(got.refusal);            // nothing to clean: the lifecycle already tried to remove a possibly-added address
try {
  /* probe from got.alias.address */
} finally {
  await aliases.release({ removeReason: 'JOB_DONE', actor });   // never throws; a failure leaves the row open with its code and a retry armed
}
```

Rules a job can rely on: neither call throws; each action that reaches the helper writes exactly one intent and one result audit entry (the job writes NONE of the `HOST_ALIAS_*` types itself); an action refused before the helper writes nothing; calls are serialised inside the lifecycle (a second `acquire` waits, then is refused `ALIAS_ALREADY_OPEN`).

**Plain statement.** The helper is a DOUBLE in every test: a transport function that answers from a script. No `ip`, `arping`, `sudo` or other network command ran; no host address was read or changed; no socket was opened by this row; no real device was contacted. Nothing here is proven on Linux (section 9).

## 2. What was built (all under `apps/core-server/src/capture/host-alias/`)

| File | Kind | Content |
|---|---|---|
| `store.ts` | new; imports nothing | The five constant statements of `host_network_aliases` with bind parameters (read open rows; open a row `ON CONFLICT DO NOTHING RETURNING id`; date the expiry; close; note a removal code) and `createHostAliasStore()`. The connection is handed in. No DELETE; what an alias IS is never updated (the grants of migration 0018) |
| `journal.ts` | new | `createHostAliasJournal({ host, store, interfaceName })`: row 105's `HostAliasJournal`. One unit of work for the intent, one for the result; the ports `HostAliasHost` / `HostAliasUnit` (clock, session state, read, unit of work with audit, report) |
| `facts.ts` | new | `hostAliasFactsReaderOf({ network, storedInterface, fileInterface })` (row 105's `facts`, on the reader `captureNetworkFacts(app)` of C64); `aliasAddressesHeld`, `aliasCandidatesOfConfiguration` (the sweep's candidates) |
| `lifecycle.ts` | new | `createHostAliasLifecycle(deps)`: `state`, `acquire`, `release`, `boot`, `shutdown`; the queue, the timer, the retry; `readHostAliasState` |
| `index.ts` | export lines added | the barrel |
| `__tests__/lifecycle.test.ts` | new, 42 cases | section 6 |
| `__tests__/lifecycle.db.test.ts` | new, 7 cases | section 6 |
| `__tests__/caller.test.ts` | ONE expectation | the import list of `index.ts`, by its delta |

The capture area's rules hold without an entry: no file-system, process, socket or driver import; no global timer (`CaptureTimers` is handed in); no system time (the host's clock); no log call (`host.report`, codes and counts).

## 3. The journal: the stored row and the two entries

| Action | Intent - ONE unit of work, COMMITTED before the line is sent | Result - one unit of work |
|---|---|---|
| ADD | the row is OPENED (`removed_at` NULL, `expires_at` = now + minutes); `HOST_ALIAS_REQUESTED { action: ADD, address, reason, minutes, aliasId, operationId, permission }` | `DONE`: `expires_at` dated from the answer; `HOST_ALIAS_ADDED`. `NOT_DONE`: `HOST_ALIAS_ADD_FAILED { failureReason: the Core's refusal code }`, the row closed. `UNKNOWN`: `HOST_ALIAS_ADD_FAILED`, the row STAYS OPEN |
| REMOVE | `HOST_ALIAS_REQUESTED { action: REMOVE, address, removeReason, aliasId? }` | gone (helper `OK`, or `NOT_MARKED` = nothing of ours is there): the row closed, `HOST_ALIAS_REMOVED`. Else: `remove_error` = the code, the row stays open, `HOST_ALIAS_REMOVE_FAILED` |

- An open row means "possibly in place", never "certainly in place". A Core that dies between intent and result of an `add` leaves the intent entry AND the open row: the next boot sweeps it.
- The intent of an `add` refuses inside its unit, and then nothing is sent: a session open in the state the unit sees (`SESSION_OPEN`); another open row (`ALIAS_ALREADY_OPEN`, by the table's index `host_network_aliases_one_open_key`).
- An entry holds the row id, one IPv4 literal, closed codes and the minutes. The interface name is in the row and nowhere in the chain (asserted on the real trail).

## 4. The lifecycle

| When | What |
|---|---|
| end of a job | `release({ removeReason: 'JOB_DONE' })` in the job's `finally` |
| the technician | `release({ removeReason: 'MANUAL' })` (operation 105) |
| end of lifetime | a timer at the stored `expires_at` asks the helper to remove, `EXPIRED`, no operator |
| shutdown | `shutdown()`: no further `acquire`, the timer dropped, the open row removed; a failure leaves the row for the next boot |
| boot | `boot()`: the sweep, section 5 |
| a removal fails | the row stays open with the code; a retry every 60 s, at most 5; then `HOST_ALIAS_REMOVAL_GIVEN_UP` is reported and the kernel lifetime and the next boot remain |

- **`effect: UNKNOWN` = possibly in place.** After an `add` whose effect is not known (or whose result entry could not be written) the row stays open and a removal is attempted AT ONCE, with its own intent and result; `acquire` answers `ok: false` with `stillInPlace` = whether that removal failed too.
- **A session is open:** `acquire` and the technician's removal are refused and write 0 rows, 0 entries, 0 lines (checked before, and again inside the intent's unit).
- **One at a time:** actions are queued inside the lifecycle; an `add` while a row is open is `ALIAS_ALREADY_OPEN` before anything is sent.
- **S13-10 (a) is not this timer.** The finding puts the removal "by root at the moment of adding ... never by the Core's memory", and only if H-S fails at `9A/H-06`. The Core's timer is a second line: it closes the row and clears the mark when the lifetime ends. The guarantee stays the kernel lifetime the helper sets, and the helper's own change if H-S fails.

## 5. The boot sweep: how it learns the marks, and the residual

**The helper cannot list.** Its verbs are `add` and `del` through the socket and `check` for root on the command line (`scripts/host/netalias/dems-core-netalias`, read only: `parse_request`, `main`). The Core does not read the helper's folder. So the sweep asks `del` for:

1. **every open row** (with `aliasId`): closed with `BOOT_SWEEP`;
2. **every private address the camera interface holds NOW outside the camera subnet** - the Core's own reading of the interface table (the `alias: true` entries of `captureNetworkFacts(app)`), no new read. A marked address that is in place on the stored interface is in this list;
3. **every address the stored configuration can produce** (the /24 of each factory address with the alias host), when the composition hands that list in.

A `del` of an address the helper did not mark changes nothing (`NOT_MARKED`), so asking is safe. A helper that cannot be reached (this Mac: `NOT_AVAILABLE_ON_THIS_PLATFORM`) is asked nothing and nothing is written.

**RESIDUAL.** A marked address that is in no row, not on the interface the Core's row names, and not derivable from the configuration - in practice: a TYPED address whose row was lost (a database reset or restore; the direct call of S13-08's risk) while the interface file and the row disagree - is not swept. What bounds it: the helper's kernel lifetime (at most 480 minutes; H-S, `9A/H-06`), `MAX_MARKED = 1`, and the next `add` answering `HELPER_ALIAS_LIMIT_REACHED`, which the lifecycle reports as `HOST_ALIAS_UNRECORDED_MARK_SUSPECTED`. Unproven: that Node's interface table lists a secondary address on Linux (`9A/H-06`).

**VOCABULARY GAP, pinned.** A row-less removal writes its intent (`HOST_ALIAS_REQUESTED`, `removeReason: BOOT_SWEEP`, no `aliasId` - "swept with a `BOOT_SWEEP` entry"). Its RESULT has no row id, and `aliasId` is REQUIRED on `HOST_ALIAS_REMOVED` and `HOST_ALIAS_REMOVE_FAILED`: the audit writer refuses it, the intent stands alone, `resultRecorded: false` is in the sweep report and `HOST_ALIAS_RESULT_NOT_RECORDED` is reported. Pinned by literal in the last database case; request: two words in `core/audit-details.ts`.

## 6. Checks (2026-10-13, in `apps/core-server`, `--maxWorkers=2`)

| Check | Command | Result |
|---|---|---|
| Unit: the lifecycle and the caller | `npx vitest run --project unit --maxWorkers=2 src/capture/host-alias/__tests__/lifecycle.test.ts src/capture/host-alias/__tests__/caller.test.ts` | run 1: `Test Files 2 passed (2)`, `Tests 64 passed (64)` (42 new + 22). Run again after two later edits of the code (the reworded messages; `readHostAliasState`): the same line |
| Database, throw-away clones under `.locks/db-migrate.lock`, sandbox off | `npx vitest run --project db --maxWorkers=2 src/capture/host-alias/__tests__/lifecycle.db.test.ts` | run 1: `Tests 1 failed / 6 passed (7)` - the failure in MY new test (it told rows apart by order on a clock that stands still). Run 2: `Test Files 1 passed (1)`, `Tests 7 passed (7)`, `0 remain`. Run 3, after the messages were reworded: the same line |
| Static rule files and the folder | `npx vitest run --project unit --maxWorkers=2 src/capture/__tests__/static.test.ts src/capture/adapters/__tests__/static.test.ts test/static src/__tests__/host-alias-socket.test.ts src/capture/host-alias` | run 1: `Tests 3 failed / 351 passed (354)`; ONE was mine: `test/static/search-path.test.ts:94` listed `facts.ts`, `journal.ts`, `store.ts` (the word that rule keeps out of every string; reworded "alias address"). Run 2: `Test Files 2 failed / 19 passed (21)`, `Tests 3 failed / 351 passed (354)` - none in a file of this row: `search-path.test.ts:94` and the SR-2 case of the capture static file name `src/modules/capture-config/factory-scan/service.ts` (agent A2, in flight); the P25 case `:738` names `src/index.ts` (its editor, in flight) |
| Typecheck | `npx tsc --noEmit` | exit 2 with ONE line, not this row's: `src/modules/capture-config/factory-scan/__tests__/routes.db.test.ts(331,18)` TS2554 (agent A2, in flight); 0 lines in a file of this row (exit 0 at 13:12, before that file appeared) |
| Lint | `npx oxlint src/capture/host-alias` | exit 0 |

What the cases cover, against the brief:

| Asked | Where |
|---|---|
| one intent and one result entry per action, the intent committed before the line | unit: the event order `commit intent, line, commit result`; database: the real trail of each action |
| removal at the end of a job, at shutdown, at boot | unit blocks 1, 4, 5; database cases 2 and 6 |
| a crash between intent and result | unit and database: the exchange never answers and the lifecycle is dropped; the trail holds the intent alone and the row is open; a NEW lifecycle's `boot()` sends `del`, writes the `BOOT_SWEEP` pair, closes the row |
| a marked address without a row | unit (with a writer that admits the result) and database (the pinned gap) |
| an open row is closed after a restart | unit, also when the helper answers `NOT_MARKED` |
| the lifetime timer | unit: armed with the minutes, fired by hand, `EXPIRED`, no operator |
| `UNKNOWN` is possibly in place | unit: four ways to be unknown, each followed by a recorded removal; and the removal failing too (row open, `stillInPlace: true`, never recorded absent) |
| refusal while a session is open, writes 0 | unit (before, inside the unit, with an alias in place) and database (trail length, row count, lines unchanged) |
| one alias at a time | unit (sequential, concurrent, by the table alone) and database (the real index: the unit is rolled back) |
| nothing of an answer or of the host in an entry | unit: a planted text in the transport's answer and errors; database: no interface name in the trail |

## 7. Deferrals

ENDED by this row: none. The named deferrals of operations 104 and 105 (`contract.test.ts`, `rbac-matrix.test.ts`) STAND and still name row 106 (section 8).

## 8. NOT BUILT - the exact remainder

| Not built | Why | What exists for it |
|---|---|---|
| The route of operation 104 `getHostAlias` | It IS a plain read of the journal, but a route is a file of a module (the capture area registers none), its mount is one line in `modules/capture-config/index.ts` (agent A2 is editing it for row 107), and it moves the routed-count pins of two acceptance files | `readHostAliasState({ read })`; the mapping in the request |
| The route of operation 105 `removeHostAlias` | the same, and it needs the mounted lifecycle | `release({ removeReason: 'MANUAL', actor })`; the mapping of each refusal in the request |
| The mount: one lifecycle per app, `boot()` before the listener, `shutdown()` before the capture shutdown | `capture-composition.ts` and `src/index.ts` are another agent's in this wave | the exact lines in the request; the host binding is `hostOf(app)` of the database test, word for word |
| The three sources the mount needs (`storedInterface`, `fileInterface`, `configuredCandidates`) | the network folder and the host runner are not this row's | the request names each |
| `T-47` in the kept set of a demo reset | row 99's open request; with this row an alias a reset forgets is still swept if it is on the stored interface (section 5, source 2) | - |

## 9. Unproven without the host

| Unproven | Check |
|---|---|
| Every call through the real socket; a real `del` of a marked address at boot, at shutdown, at the end of a job | `9A/H-05`, `9A/H-06` |
| H-S (the kernel removes the address with the Core killed); the Core's timer against a real lifetime | `9A/H-06` (E-13) |
| The interface table of Node on Linux lists the secondary address, so that source 2 of the sweep sees a marked address | `9A/H-06` |
| A Core killed between intent and result on a real host: the next boot's `del` and the helper's journal line reconcile with the two audit entries | `9A/H-06` |

## 10. DRIVER DECISIONS (for the controller to confirm)

| # | Decision | Reason / alternative |
|---|---|---|
| D-1 | With a session open, `acquire` and the technician's removal are refused; the SYSTEM's removals (end of job, end of lifetime, shutdown, boot) are NOT | The cell says "every action is refused"; the brief says "refusal of an ADD". Taking the address away is the safe direction (record 105 D-5, C53 (4)); a refused boot sweep would leave an address on the evidence host. One constant, `REFUSED_WHILE_A_SESSION_IS_OPEN`, flips it |
| D-2 | The shutdown removal is recorded `JOB_DONE` | the closed set has no value for it; request for a ruling |
| D-3 | The row of an `add` that certainly added nothing is closed `JOB_DONE`, `removed_by` NULL | the row is opened WITH the intent so that a crash leaves a durable marker and the table enforces "one at a time" before the line is sent; the alternative (a row only after `DONE`) loses a typed address on a crash. `HOST_ALIAS_ADD_FAILED` beside it says what happened |
| D-4 | `HELPER_NOT_MARKED` on a removal closes the row and writes `HOST_ALIAS_REMOVED` with the reason asked | record 105: "nothing of ours is there (close the row)" |
| D-5 | A row-less candidate the helper did not mark is recorded `HOST_ALIAS_REMOVE_FAILED` with `failureReason: HELPER_NOT_MARKED`, severity INFO | every line sent has a result; the vocabulary has no "nothing was there" |
| D-6 | The retry of a failed removal: 60 s, 5 times, then reported | bounded audit noise (2 entries per attempt) |
| D-7 | The sweep's second source is the interface table the Core already reads, not the helper's folder | the brief forbids the folder; the helper cannot list |

## 11. Rules kept

Edit tool only for every existing file (`index.ts`, `caller.test.ts`, `file_claims.md`, `file_requests.md`, and this record after its first writing); new files with Write. Two edits used the tool's `replace_all` on one literal in a file this row created. No commit, no stage. No full suite. Database tests on throw-away clones under `.locks/db-migrate.lock`, each dropped (`0 remain`). No port bound, no process started, no heavy-host lock needed. `scripts/host/netalias/` read only. `apps/input-av/data/` not opened; no `.env` read; the instance on ports 4423 / 5178 not touched.

---
*Generated: 2026-10-13 13:25 WIB*
