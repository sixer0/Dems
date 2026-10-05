---
task_id: 2026-10-04_dems_backend_rbac_pairing
task_slug: dems_backend_rbac_pairing
blueprint_row: 71
plan_row: W49
title: Acceptance test, two-client shared state with resync (SC3; AC-B-44 to AC-B-47)
date: 2026-10-04
agent: test-expert (tier R)
source_plan: /Users/gsp-budi/Documents/DEMS/docs/2026-10-04_dems_backend_rbac_pairing/masterplan/02_plan.md
source_spec: masterplan/01_specs.md rev 2.2 (§6.8, §9.1 to §9.5, §12.4, §16.6); gateway_check/01_gate_report.md (rules M9, M10, M12, M15, M16); implementation/26, 32, 34, 42, 43, 44
evidence_tier: 2
status: complete
---

# W49: acceptance test "two-client shared state with resync"

All times are WIB (UTC+7) on 2026-10-04. Commands ran from `/Users/gsp-budi/Documents/DEMS`, never
from a subfolder. Every run that connects to PostgreSQL or binds a port ran with the per-command
sandbox bypass (P10). Quoted runner output is unchanged except that blank lines are left out.
A position of the Core state is written `epoch/revision` (`1/53`).

**No cookie value, session token, device credential, pairing code or password appears in this
document or in its assets.** The test takes each from an answer and hands it on; it prints
positions, digests, counts, statuses, message types, slice names and operator IDs. A search of
the eleven assets for a session token, a device credential, a biometric token, a bearer value and
a cookie pair found 0 files (19:20).

## 1. Result

| Question of the row | Answer | Where |
|---|---|---|
| The file passes under `test:db` | **Yes: 1 file, 6 tests, exit 0** (19:14:49, and with every test name at 19:15:00); 0 databases left with the run prefix. The file ran green 18 times alone between 18:52 and 19:24, and three times inside the whole project | section 12 |
| Client B equals client A after start, marker and stop | **Yes, for both kinds of B** (a second web console; a paired tablet). After each of 9 steps of the session the Live store of A, the Live store of B and a second replica built from each client's frames equal `app.engine.state()` in all 28 slices at the engine's position | section 4 |
| After a dropped socket B equals a fresh snapshot | **Yes.** B's socket was destroyed (from the server side in (i), by cutting the network in (ii)) while A ran two commands. B reconnected by its own backoff, was sent a snapshot that holds both commands, and equals a third client C that joined at that moment, the snapshot C was sent, and the engine. An explicit `resync` of B gives the same | sections 6, 7 |
| Every message validates against the union | **Yes: 2,934 frames on 26 sockets** over the four server-driven tests (1,395 and 1,471 in the two scenarios), of eight kinds, 0 refused by `WsServerMessageSchema`; revisions gap-free on every socket | section 9 |
| A store at revision N shows the command's effect | **Yes, for all 18 commands.** The sender's Live store showed the effect in the turn its action settled; a replica built from the frames alone shows it at exactly the position the answer named and not at the position before the command; the delta that holds the effect was never later than N | section 5 |
| Nobody is sent what is not theirs | **Yes.** The anonymous socket of each scenario received `hello` and 45 / 53 heartbeats with `sessionState: null` and nothing else; no `auth`, `authLockout`, `pairing`, `clock` or `audio` in any snapshot or delta; A never received C's `session.updated`, B's `session.ended` or a list hint | section 8 |
| A new epoch with real sockets | **Yes, twice:** the engine stopped and started again (`start('resync')`), and a REAL demo reset through `POST /api/v1/demo/reset` on a clone of this file. Both clients were sent a snapshot of the new epoch without asking and continued equal; the operator whose role the seed put back was told `session.updated` | section 10 |
| Can it fail | **Yes.** The deltas of one command withheld from B: the equality assertion is red until B meets the gap and resyncs. A frame with an unknown member: the validation assertion is red. Four more controls of the other checks | section 11 |
| Typecheck and lint | exit 0 and exit 0, no warning (19:14:29, 19:14:21) | section 12.3 |
| The whole `db` project | Three runs, each exit 1 with failures ONLY in other rows' files, every one named | section 12.4 |
| Nothing left | 19:24:22: 0 databases with the prefix `dems_test_step_71_`; no listener and no process of this row; `.locks/postgres.pid` 19121 | section 21 |
| Findings | No departure from the contract in what SC3 and AC-B-44 to AC-B-47 ask. Two Low findings beside them (the union does not refuse an unknown member of a `heartbeat`; after a demo reset the snapshot says the Core link is CONNECTED until the next pace step), two Info | section 13 |

## 2. What was written

| File | Lines | Holds |
|---|--:|---|
| `apps/core-server/test/acceptance/shared-state.test.ts` | 884 | The 6 tests. SHA-256 `bf629ad2…65a2160`, last written 19:14 |
| `apps/core-server/test/acceptance/shared-state.support.ts` | 1,217 | Not a test file: the stage (the booted server with a real listener), the two platform stand-ins with their recorders, the Live clients, the TCP relay, the second replica, the checks of frames. SHA-256 `887a3c9b…2a62a0e34`, last written 19:05 |
| `docs/…/test/05_shared_state_realtime.md` | | This document |
| `docs/…/test/assets/05_*` | | Eleven assets (section 18) |
| `docs/…/delegation_progress/test_expert_step_71.md` | | The progress file |

No production file, no other row's test, no configuration and nothing in `packages/shared` was
written. `apps/core-server/` is untracked at `4b708c8`, so both files are new untracked files.

## 3. What was tested, why it matters, how

### 3.1 Why it matters

SC3 is the sentence the whole backend task exists for: the web console and the tablet stop being
two simulators and become two views of one Core. Every earlier row proved a part (the engine
publishes one change per unit, the channel sends each socket every revision, the Live source
applies them). This test is the first that asks the question as a user would: two operators on
two clients, one acts, does the other see exactly the same thing, and does a client that fell off
the network come back to exactly the same thing? "Exactly" is asked literally: 28 slices compared
by content, at a named revision.

### 3.2 What is real, and what is the test's

| Part | What it is |
|---|---|
| The server | The real app factory on a clone of the seed template, connected as `dems_app`, every request stage as the server has it, the engine BOOTED (`app.readiness.boot()`), a real listener on `127.0.0.1` at an ephemeral port (port 0). Built through the identity row's neutral support (`test/support/identity.ts` `identityApp`); the stage of the demo-reset test is built by the app factory directly with the demo flag on (`openDemoStage`) |
| Client A | The SHARED Live source (`createLiveSim` of `@dems/shared/live/source`) with the typed client (`createCoreClient`) and the Live socket client (`createLiveSocketClient`, imported by file: decision D111 DN-7), unchanged, on a browser stand-in: a web console origin, the cookie the sign-in set, the INVESTIGATOR (`OPR-001`) |
| Client B | The same three parts for ANOTHER operator, the SUPERVISOR (`OPR-002`): in scenario (i) on a second browser stand-in, in scenario (ii) on a tablet stand-in (no `Origin` and one bearer value on REST; the instance's own origin and the bearer value on the upgrade, as measured in decision D69), on a device that was paired through the real pairing routes. In (ii) its socket is also what brings up the Core link |
| Client C | A third Live source, the TECHNICIAN (`OPR-003`), opened only after B is back: the "fresh client". Its session was signed in beforehand through the sign-in route, so that opening it changes nothing on the Core |
| The transports | Node's own `fetch` and `WebSocket`, injected into the clients. Every socket a client opens is behind a recorder of the test that keeps every frame |
| The commands | Real requests through the real session routes, sent by the Live source's actions: `createSession`, `beginPrecheck`, `startRecording`, `addMarker`, `stopRecording`, `acknowledgeSummary` |
| The Core link | A recording needs a real socket of a paired device (finding F69). In (i) a third device, paired through the routes, holds one bare DEVICE socket; in (ii) the tablet B itself |
| The test's own | The server clock (a manual clock, starting 2031-01-01T00:00:00Z) and the timers of the engine and of the channel (manual): the engine ticks and the channel beats and paces when the test says so. And a TCP relay on `127.0.0.1` port 0 between B and the Core: the network of B, which the test can cut and hold down |

### 3.3 How equality is asked

Never by counting how many deltas a step produced (the engine fix round that is in flight may
change that). After each step the test (`compare` in the test file):

1. calls the channel's pace step and waits for the engine and for any link call of the channel;
2. sends one heartbeat and waits until it arrived on the socket of every client that is compared
   (frames keep their order, so everything sent before it has arrived);
3. reads the engine's position and `app.engine.state()`;
4. asks, per client, three things at that position (`replicaProblems` in the support file): the
   position of its socket client; its Live store, slice by slice; and a SECOND replica, slice by
   slice, that the test builds from the frames that client was handed, by the rule of spec §9.3
   alone and with no code of the Live source (`createShadow`);
5. asks that the engine's position did not move meanwhile, and that the newest heartbeat of every
   compared client carries the state of the Core's session.

A slice is compared in a canonical form (JSON with the members of every object in name order):
the order of an object's members is not part of a slice. The digest printed per step is the first
12 hexadecimal digits of the SHA-256 over the 28 canonical slices.

One client may be named "patient": a Live source holds the state of a NEW socket back until the
Core confirmed its session with one request (`implementation/44_live_source.md` §18.2). For a
reconnected B and for the fresh C the test therefore waits, with a cap, until the store shows the
position, and prints how many turns of the event loop that took (0 to 4).

### 3.4 Time, and every real wait with its bound

The engine and the channel run on the manual clock: `drive(ms)` advances it 50 ms at a time,
fires the engine's timer, and calls the channel's pace step every 250 ms and its heartbeat every
1,000 ms of that clock. The clients run on the platform's real clock and timers, as in an app.

| Real wait | Cap | Measured (eleven runs with test names, 18:52 to 19:15) |
|---|--:|---|
| A socket event or an answered request (`until`: a poll per turn of the event loop; it sends a heartbeat every 400 ms of waiting, so that no link goes stale) | 15,000 ms | 0 to 4 turns, under 5 ms |
| B's own reconnect after the drop, scenario (i): the first delay of its backoff, 500 ms plus up to 250 ms of jitter | 30,000 ms | synced 524 to 750 ms after the drop |
| The tablet's first reconnect attempt being refused, scenario (ii) | 30,000 ms | 544 to 752 ms after the cut |
| B's own reconnect, scenario (ii): the second delay, 1,000 ms plus jitter | 30,000 ms | synced 1,653 to 1,986 ms after the cut |
| The answer of the demo reset | 90,000 ms | 273 to 1,402 ms |
| A stage's close before the test fires the channel's close deadline itself | 3,000 ms | never needed |

The file's limits are caps: `testTimeout` 120 s, `hookTimeout` 180 s (a clone waits for the clone
lock, which runs of other rows may hold).

### 3.5 Helpers of other rows that this file imports (read-only)

| Import | From |
|---|---|
| `useTestDatabase` (template `seed`; `DEMS_TEST_STEP=71`) and `db.another` for an untouched clone per test | `test/helpers/db` |
| `identityApp`, `signInOnWeb`, `webPost`, `WEB_ORIGIN`, `OWN_ORIGIN`, `CLOCK_START` | `test/support/identity.ts` |
| `pairDevice` | `test/support/pairing.ts` |
| `manualTimer` | `test/support/engine.ts` |
| `captureLog`, `unitTestConfig`, `credentialLeaks` | `test/support/config.ts` |
| `roleUrl` | `test/support/admin.ts` |
| `maintenancePool`, `resetApplicationName` | `test/support/reset.ts` |
| `testRoutine`, `useRoutine`, `RESET` (the demo-reset test only) | `src/modules/demo/__tests__/support.ts` (the reset row's test support; finding W49-F4) |
| `engineControl`, `realtimeControl`, `identityControl`, `pairingControl`, `buildApp` | Production indexes (`src/engine`, `src/realtime`, `src/modules/identity`, `src/modules/pairing`, `src/app`) |

The channel row's own test support (`src/realtime/__tests__/support.ts`) is not imported: the
stage is built on the neutral support alone.

## 4. The scenario, step by step: the revision and the digests

Run of 19:15:00 (`assets/05_row_command_verbose.log`). "Answer" is the status and the position in
`x-dems-epoch` / `x-dems-revision` of the command's answer; "Effect in delta" is the first
revision at which a replica built from A's frames shows the effect; "Engine" is the position at
which the three replicas were compared. The digests are equal in every run (the server clock is
manual, so the content is the same): the positions and digests of all 45 comparisons of a run
were the same in each of the eleven runs whose output was kept (18:52 to 19:15).

### 4.1 Scenario (i): B is a second web console

| # | Step | Answer (status, epoch/revision) | Effect in delta | Engine at the comparison | Digest A | Digest B | Digest C | Digest engine |
|--:|---|---|--:|---|---|---|---|---|
| 1 | A and B took the snapshot | no command |  | 1/7 | 3e8be8f0c514 | 3e8be8f0c514 |  | 3e8be8f0c514 |
| 2 | createSession | 201, 1/8 | 8 | 1/8 | 83fb347bb1ca | 83fb347bb1ca |  | 83fb347bb1ca |
| 3 | beginPrecheck | 202, 1/9 | 9 | 1/9 | 3c62fb8978f9 | 3c62fb8978f9 |  | 3c62fb8978f9 |
| 4 | the pre-check ran (5 s of the engine) | no command |  | 1/21 | edd7504f0df7 | edd7504f0df7 |  | edd7504f0df7 |
| 5 | startRecording | 200, 1/22 | 22 | 1/22 | 98534699f110 | 98534699f110 |  | 98534699f110 |
| 6 | recording (2 s of the engine) | no command |  | 1/24 | 28f61c828954 | 28f61c828954 |  | 28f61c828954 |
| 7 | addMarker | 204, 1/25 | 25 | 1/25 | 7ab082be1c15 | 7ab082be1c15 |  | 7ab082be1c15 |
| 8 | stopRecording | 202, 1/26 | 26 | 1/26 | 908852d4a30f | 908852d4a30f |  | 908852d4a30f |
| 9 | finalised and sealed (20 s of the engine) | no command |  | 1/53 | 26f6392b2953 | 26f6392b2953 |  | 26f6392b2953 |
| 10 | acknowledgeSummary (B is away) | 204, 1/54 | 54 | 1/54 | 5c6bef7db381 | away |  | 5c6bef7db381 |
| 11 | createSession, the second (B is away) | 201, 1/55 | 55 | 1/55 | 73284d64af2d | away |  | 73284d64af2d |
| 12 | B is back (waited 4 turn(s) for B) | no command |  | 1/55 | 73284d64af2d | 73284d64af2d |  | 73284d64af2d |
| 13 | a fresh client C joined: B = C = engine (waited 0 turn(s) for C) | no command |  | 1/55 | 73284d64af2d | 73284d64af2d | 73284d64af2d | 73284d64af2d |
| 14 | B asked for a resync: B = C = engine | no command |  | 1/55 | 73284d64af2d | 73284d64af2d | 73284d64af2d | 73284d64af2d |
| 15 | C's role changed: A = B = C = engine | no command |  | 1/57 | 1c6b9803852f | 1c6b9803852f | 1c6b9803852f | 1c6b9803852f |
| 16 | B signed out: A = C = engine | no command |  | 1/58 | 76e239aab744 | away | 76e239aab744 | 76e239aab744 |

### 4.2 Scenario (ii): B is a paired tablet

| # | Step | Answer (status, epoch/revision) | Effect in delta | Engine at the comparison | Digest A | Digest B | Digest C | Digest engine |
|--:|---|---|--:|---|---|---|---|---|
| 1 | A and B took the snapshot | no command |  | 1/7 | 3337b7c87bec | 3337b7c87bec |  | 3337b7c87bec |
| 2 | createSession | 201, 1/8 | 8 | 1/8 | 42b5da4fb065 | 42b5da4fb065 |  | 42b5da4fb065 |
| 3 | beginPrecheck | 202, 1/9 | 9 | 1/9 | feca665fc844 | feca665fc844 |  | feca665fc844 |
| 4 | the pre-check ran (5 s of the engine) | no command |  | 1/21 | 800a500b4089 | 800a500b4089 |  | 800a500b4089 |
| 5 | startRecording | 200, 1/22 | 22 | 1/22 | 64d1e0b7cbec | 64d1e0b7cbec |  | 64d1e0b7cbec |
| 6 | recording (2 s of the engine) | no command |  | 1/24 | 1822eaf621f5 | 1822eaf621f5 |  | 1822eaf621f5 |
| 7 | addMarker | 204, 1/25 | 25 | 1/25 | 28d72795a5f7 | 28d72795a5f7 |  | 28d72795a5f7 |
| 8 | stopRecording | 202, 1/26 | 26 | 1/26 | 758faba699d2 | 758faba699d2 |  | 758faba699d2 |
| 9 | finalised and sealed (20 s of the engine) | no command |  | 1/53 | 1325faf3df09 | 1325faf3df09 |  | 1325faf3df09 |
| 10 | acknowledgeSummary (B is away) | 204, 1/54 | 54 | 1/54 | fbfadda9afd7 | away |  | fbfadda9afd7 |
| 11 | the Core link went OFFLINE (B is away) | no command |  | 1/59 | 810541d97378 | away |  | 810541d97378 |
| 12 | createSession, the second (B is away) | 201, 1/60 | 60 | 1/60 | 367e4143d8a0 | away |  | 367e4143d8a0 |
| 13 | B is back (waited 2 turn(s) for B) | no command |  | 1/61 | cc6b2052c623 | cc6b2052c623 |  | cc6b2052c623 |
| 14 | a fresh client C joined: B = C = engine (waited 0 turn(s) for C) | no command |  | 1/61 | cc6b2052c623 | cc6b2052c623 | cc6b2052c623 | cc6b2052c623 |
| 15 | B asked for a resync: B = C = engine | no command |  | 1/61 | cc6b2052c623 | cc6b2052c623 | cc6b2052c623 | cc6b2052c623 |
| 16 | C's role changed: A = B = C = engine | no command |  | 1/63 | 677a5d73c1b2 | 677a5d73c1b2 | 677a5d73c1b2 | 677a5d73c1b2 |
| 17 | B signed out: A = C = engine | no command |  | 1/64 | 3849031d53a1 | away | 3849031d53a1 | 3849031d53a1 |

In both scenarios the engine's position after a command was the position the answer named, and
each command produced one revision. That is an observation of these runs; the test asserts
neither (it asserts that the engine is at or beyond the answer's revision).

After `startRecording` B's store shows RECORDING; after `stopRecording` it shows the stop reason;
after the 20 s of the engine it shows SEALED. During the 27 s of the engine clock both operator
clients received 540 meter frames each; none of them is a slice of a replica.

## 5. Read-your-writes (AC-B-47, RT-5)

Asked of every command, by `command` in the test file:

| What is asked | How |
|---|---|
| The effect is not there before | The sender's Live store, and a replica built from each client's frames at the position before the command, do not show it |
| The sender shows it when its action settles | A `then` of the Live result runs inside the settlement (the turn in which the store took the answer's revision): the effect is in the sender's store there |
| A store at revision N shows it | The replica built from the frames of the sender, and of every other client, at EXACTLY the position the answer named shows the effect |
| The delta that holds it is at most N (RT-5) | The first revision after the command at which the sender's replica shows the effect is found and printed |
| The other client was sent the deltas (AC-B-44) | B's socket holds a `delta` of every revision the command produced |

The effects: `createSession` the case number of the open session; `beginPrecheck` the state
PRECHECK; `startRecording` RECORDING; `addMarker` the marker count 1; `stopRecording` the stop
reason; `acknowledgeSummary` `lastSealedAcknowledged`; the second `createSession` its case number.
18 commands went through this check (7 in each scenario, 2 around the engine restart, 2 around the
demo reset). For every one the effect was in the delta of exactly the revision the answer named.

## 6. The drop and the resync: the timeline

Real time is counted from the drop; positions are the Core's.

### 6.1 Scenario (i): the server destroys the stream of B's socket

How: the relay stops accepting new connections of B, then the SERVER destroys the stream of the
one open socket it accepted from B (`ws.terminate()` on the server's side of that socket, found
by the remote port of its connection). No close frame, no `session.ended`.

| Real time | Event | Core |
|--:|---|---|
| 0 | The server destroys B's stream. B's runtime reports close 1006, not clean; the hub forgets the socket | B at 1/53 |
| +1 ms | B's link is OFFLINE; its store keeps what it held | |
| | A: `acknowledgeSummary`, answered 204 with 1/54. A's store, A's replica and the engine equal | 1/54 |
| | A: `createSession` (the second), answered 201 with 1/55. Equal | 1/55 |
| | B is behind in 5 slices: `meta`, `session`, `lastSealedAcknowledged`, `events`, `audit`; its position is still 1/53 | |
| +19 ms | The relay accepts again. Nobody tells B | |
| +524 ms | B's socket client reconnected by its own backoff: socket #3, `hello` (OPERATOR), ONE `snapshot` at 1/55, no delta replayed. `RESYNCED` with cause `RECONNECT` | |
| | B's Live source asks `GET /api/v1/auth/session` once (200) before it shows the new socket's state | |
| +548 ms | B's store equals the engine (4 turns after the socket was synced). A = B = engine, digest `73284d64af2d` | 1/55 |

### 6.2 Scenario (ii): the network between the tablet and the Core is cut

How: the relay destroys every TCP connection of the tablet, both legs (its socket and its idle
HTTP connections: 3), and refuses new ones. The server sees the connection end without a close
frame; so does the tablet (close 1006, not clean).

| Real time | Event | Core |
|--:|---|---|
| 0 | The cut. The hub forgets B's socket; it was the only socket of a paired device | B at 1/53 |
| +1 ms | B's link is OFFLINE | |
| | A: `acknowledgeSummary`, answered 204 with 1/54 | 1/54 |
| | 5.25 s of the SERVER clock pass (driven): the Core link goes OFFLINE (spec §6.8), and A sees it: `tabletLink.state` OFFLINE in A's store, equal to the engine | 1/59 |
| +544 ms | The tablet's first reconnect attempt reaches the relay and is refused. Its socket client waits for the second delay of its backoff | |
| | A: `createSession` (the second), answered 201 with 1/60 | 1/60 |
| | B is behind in 11 slices: `meta`, `tabletLink`, `session`, `lastSealedAcknowledged`, `storage`, `time`, `network`, `health`, `otherDevices`, `events`, `audit` | |
| +562 ms | The relay accepts again | |
| +1,729 ms | B's second attempt: socket #4, `hello` (OPERATOR, bound to the device), ONE `snapshot` at 1/60. The device is back, so the server sets the Core link CONNECTED: one delta, to A and to B | 1/61 |
| | One `GET /api/v1/auth/session` (200) | |
| +1,760 ms | A = B = engine, digest `cc6b2052c623`; the Core link CONNECTED | 1/61 |

In both scenarios the hub's counter of snapshots it had to send because a socket was out of
position (`healed`) is 0, and no socket was closed as a slow consumer or by a cap.

## 7. A fresh client, and an explicit resync

| Step | (i) | (ii) |
|---|---|---|
| C, the third operator's console, is opened at that moment and takes its snapshot | at 1/55 | at 1/61 |
| What B held at the position of C's snapshot (the replica from B's frames) against the snapshot AS IT WAS SENT to C | 28 of 28 slices equal | 28 of 28 |
| B's Live store against C's Live store, and A, B, C against the engine | equal, digest `73284d64af2d` | equal, digest `cc6b2052c623` |
| B asks for a resync (`requestResync()` of its Live socket client): one `resync` sent, `RESYNCING` then `RESYNCED` with cause `REQUESTED`, one more `snapshot` | answered at 1/55 | answered at 1/61 |
| A = B = C = engine after it | equal, the same digest | equal, the same digest |

So B ends equal to a fresh client by all three ways the protocol has: the snapshot of a reconnect
(sections 6 and 7), an explicit `resync` (this section), and a `resync` after a gap (section 11).

## 8. What nobody may be sent that is not theirs

The message kinds each owner of a socket received, with counts (run of 19:15:00):

| Owner | Sockets (principal of each `hello`) | (i) | (ii) |
|---|---|---|---|
| The anonymous socket (a web console origin, no credential), open for the whole scenario | 1 (ANONYMOUS) | `hello` 1, `heartbeat` 45 | `hello` 1, `heartbeat` 53 |
| A, the INVESTIGATOR | 2 (ANONYMOUS, then OPERATOR) | `hello` 2, `heartbeat` 46, `snapshot` 1, `delta` 55, `meters` 540 | `hello` 2, `heartbeat` 54, `snapshot` 1, `delta` 61, `meters` 645 |
| B, the SUPERVISOR | (i) 4: ANONYMOUS, OPERATOR, OPERATOR (after the drop), ANONYMOUS (after its sign-out). (ii) 5: DEVICE, OPERATOR, one refused attempt, OPERATOR, DEVICE | `hello` 4, `heartbeat` 44, `snapshot` 3, `delta` 52, `meters` 540, `session.ended` 1, `admin.changed` 4 | `hello` 4, `heartbeat` 44, `snapshot` 3, `delta` 50, `meters` 540, `session.ended` 1, `admin.changed` 1 |
| The device that only holds the Core link, (i) | 1 (DEVICE) | `hello` 1, `heartbeat` 45 | |
| C, the TECHNICIAN whose role is changed | 1 (OPERATOR) | `hello` 1, `heartbeat` 5, `snapshot` 1, `delta` 3, `session.updated` 1 | the same |

What the test asserts on it:

| Rule | Assertion | Result |
|---|---|---|
| An anonymous socket receives `hello` and `heartbeat` and nothing else, whatever happens on the Core (spec §9.2; AC-B-42) | The kinds of the anonymous socket are exactly those two; every one of its heartbeats has `sessionState: null`, while at every comparison the newest heartbeat of each operator's socket carries the state of the Core's session (asserted equal to the engine's) | holds |
| A DEVICE socket is sent no state | The link device's kinds are exactly `hello`, `heartbeat`; the tablet's two DEVICE sockets in (ii) likewise | holds |
| The slices the channel never publishes (spec §3.2, §9.5) | The slice names of every `snapshot` and of every `delta` op of every socket, read from the frames as they arrived: `auth`, `authLockout`, `pairing`, `clock` and `audio` are in none; the snapshots hold exactly the 28 replicated names | holds |
| Another operator's session events | C's role is changed by the portal's administrator: `session.updated` arrives at C once and names `OPR-003`; A and B never receive a `session.updated`. B signs out: `session.ended` (`SIGNED_OUT`) is on B's socket once; A and C never receive a `session.ended` | holds |
| A list hint only for a holder of the permission | The pairing of the link device in (i) and the role change publish `admin.changed`: B (USER_ADMIN, PAIRING_MANAGE) receives 4 and 1; A, with an open OPERATOR socket at that time, and C receive none | holds |
| By principal and topic, from the contract (`canReceiveRealtimeMessage`, `hello.topics`) | `forbiddenContent`: no socket was sent a message its principal is never sent, or of a topic its `hello` did not give it; no meter frame without a `subscribe`; a `heartbeat` has exactly the eight members of the contract | 0 lines |
| Nothing that looks like a credential in any frame (spec §9.5) or in the server's log (SR-49) | `credentialLeaks` over the text of every frame and over the captured log of each stage | 0 |

## 9. Every message validates; revisions are gap-free (AC-B-46)

The recorder of every socket parses each frame with `WsServerMessageSchema` when it arrives,
whether or not a client still listens (`inspect`). `frameProblems` over ALL sockets of a stage:

| Test | Sockets | Frames | Bytes | Refused by the union | Out of sequence | Forbidden |
|---|--:|--:|--:|--:|--:|--:|
| Scenario (i) | 9 | 1,395 | 3,334,091 | 0 | 0 | 0 |
| Scenario (ii) | 9 | 1,471 | 3,556,808 | 0 | 0 | 0 |
| New epoch (engine restart) | 4 | 27 | 506,875 | 0 | 0 | 0 |
| New epoch (demo reset) | 4 | 41 | 506,832 | 0 | 0 | 0 |

Eight of the nine kinds of the union were received: `hello`, `heartbeat`, `snapshot`, `delta`,
`meters`, `session.updated`, `session.ended`, `admin.changed`. Not `device.revoked`, which no
step of this test causes.

Gap-free, asked twice: on what the SERVER sent on each socket (`sequenceProblems`: the first
state message is a snapshot; every delta is the previous revision plus 1 in the same epoch; a
snapshot never goes back), and on what each CLIENT was handed (the second replica records every
delta that does not continue its position: none, outside the test that withholds deltas on
purpose). The clients' own counters agree: no frame refused (`invalid` 0) and no delta dropped
(`deltasDropped` 0) by any Live socket client; no report of level `error` from any Live source;
no answer that the typed client reported as not the contract's.

## 10. A new epoch with real sockets (RT-7)

### 10.1 The engine stops and starts again

`app.engine.stop()`, then `app.engine.start('resync')`, under the same listener: what a reload
does to the engine, with no reset of the database.

| Step | Result |
|---|---|
| A and B took the snapshot; A creates a session (201, 1/3) | A = B = engine at 1/3 |
| The engine stops | Both sockets stay open and keep their heartbeat (2 operator sockets in the hub; decision D111 DN-4) |
| The engine starts in mode `resync` | Epoch 2. On both sockets the first state message of the new epoch is a `snapshot` at 2/0, not asked for: no `resync` was sent, the counters of both socket clients say `resyncs: 0, reconnects: 0` |
| A = B = engine at 2/0, digest `91f746c2bbc4`; the session A created is still there | equal |
| A: `beginPrecheck` in the new epoch, answered 202 with 2/1; B was sent the delta 2/1 | A = B = engine at 2/1 |

### 10.2 A real demo reset through the demo route

The existing support was enough: `testRoutine` and `useRoutine` of the reset row put the REAL
reset routine behind the module with the seam that accepts a database of this run; the stage is
this file's own (`openDemoStage`: the app factory with `demoControls: true`, not registered with
the helper, because a reset closes what the helper holds on the database). The database that is
reset is a clone the helper made for this test (`…_f0N_w49r`); the routine's staging and previous
copies carry the same run prefix. `dems_demo` and the lanes are not named anywhere.

| Step | Result |
|---|---|
| B (SUPERVISOR) changes A's role to TECHNICIAN through `live.client.call('assignUserRole', …)` | 200. A receives `session.updated` (`OPR-001`, TECHNICIAN); B does not. A = B = engine at 1/4 |
| B creates a session (201, 1/5) | A = B = engine at 1/5 |
| B's browser sends `POST /api/v1/demo/reset` | 200 `{ epoch: 2 }` after 963 ms (273 to 1,402 ms over eleven runs); both sockets stay open through it |
| RT-7 | On both sockets the first state message of epoch 2 is a `snapshot` at 2/0, not asked for (`resyncs: 0, reconnects: 0`) |
| Spec §12.4, the operator whose role the seed put back | A receives a second `session.updated` (`OPR-001`, INVESTIGATOR); B receives none; both are still signed in (the sessions are kept) |
| The Core is at the seed state | No open session in either store; `operators` shows `OPR-001` as INVESTIGATOR in both |
| A = B = engine | equal at 2/1, digest `cbb0c75a7e93` |
| A, an investigator again, creates a session (201, 2/2); B sees it in state CREATE | A = B = engine at 2/2 |

The line the test prints about what followed the snapshot is the evidence of finding W49-F2:

```
[w49] demo reset: the Core link: CONNECTED in the snapshot of the new epoch, OFFLINE at 2/1 (recomputed from the open sockets at the channel's pace step)
[w49] demo reset: the reset was answered 200 after 963 ms; epoch 1 → 2; A was told session.updated twice (TECHNICIAN, then INVESTIGATOR), B never; A's socket since: snapshot 2/0; delta 2/1 (replace meta, append events [TABLET_DISCONNECTED], append audit [TABLET_LINK_CHANGED], replace tabletLink, replace otherDevices)
```

## 11. Can the assertions fail?

Shown by changes of the test's INPUT only; no production file and no file of the tree was changed
(M15).

| # | Change of the input | Assertion | Outcome |
|--:|---|---|---|
| 1 | A filter in B's socket wrapper withholds every `delta` of A's next command from B's client (the frames are recorded, not delivered) | The equality assertion (`replicaProblems`, and `compare` as the scenarios call it) | **RED**: `B: its socket client is at 1/2, the engine at 1/3`; `B: slices of its store that differ from app.engine.state() at 1/3: meta, session, events, audit`; `B: the frames it was handed end at 1/2, the engine at 1/3`. No line for A. `compare` rejects |
| 1b | The filter is taken away and A runs one more command | The same assertion | **GREEN**: the next delta (1/4) does not continue what B holds (1/2); B's socket client reports `RESYNCING` then `RESYNCED` with cause `GAP`, sends one `resync`, is answered with a snapshot at 1/4. B's socket was sent: `snapshot 1/2, delta 1/3 (withheld), delta 1/4, snapshot 1/4`. What the SERVER sent stayed gap-free |
| 2 | The test hands A's client a list hint with one member more: `{ type: 'admin.changed', v: 1, resource: 'USERS', rows: [] }` | The validation assertion (`frameProblems`) | **RED**: `A #2 frame 4 (admin.changed): admin.changed: unrecognized_keys [rows] at (the message)`. The frames the server sent are all still valid. The shared socket client dropped the frame (`invalid: 1`) and handed nothing on |
| 3 | A `heartbeat` with an unknown member | The union ACCEPTS it (finding W49-F1); the test's own rule (`forbiddenContent`: exactly the eight members) | **RED**: `A #2 frame 5 (heartbeat): members clients, extra, intervalMs, seq, serverTime, sessionState, type, uptimeMs, v` |
| 4 | A `delta` whose op names the slice `auth` | `frameProblems` | **RED**: refused by the union; A's position and store did not move |
| 5 | A frame that holds a value of the form of a session token | `forbiddenContent` | **RED**: `A #2 frame 7 (admin.changed): holds what looks like a credential (token)`; the line names the kind, not the value |
| 6 | A's real frames with its first delta taken out | `sequenceProblems` | **RED**: `A #2 frame 5 (delta) 1/3: does not continue 1/1` |
| 7 | That delta put on the ANONYMOUS socket A held before its sign-in | `forbiddenContent` | **RED**: `A #1 frame 2 (delta): never sent to a socket of principal ANONYMOUS`; `… the socket was not given the topic state` |

Each of the five assertions every scenario ends with (equality, validation, sequence, what a
principal may be sent, what a frame may hold) has been seen red.

## 12. Verification

### 12.1 The row command (`assets/05_row_command.log`)

```
## 2026-10-04 19:14:49 WIB $ DEMS_TEST_STEP=71 npm run test:db -w @dems/core-server -- test/acceptance/shared-state.test.ts
> vitest run --project db test/acceptance/shared-state.test.ts
[test:db] PostgreSQL 18.4 on 127.0.0.1:4432; helper role dems_owner, code under test dems_app; run prefix dems_test_step_71_tmdu0pb5_
[test:db] stale sweep: dropped 0; kept 0 of younger runs, 0 of live runs, 0 unrecognised; 0 failed
[test:db] template dems_test_step_71_tmdu0pb5_tpl_schema: built in 179 ms (create 54 ms, hook 119 ms)
[test:db] template dems_test_step_71_tmdu0pb5_tpl_seed: built in 305 ms (create 99 ms, hook 205 ms)
 Test Files  1 passed (1)
      Tests  6 passed (6)
   Start at  19:14:49
   Duration  10.45s (tests 74%, transform 18%, import 8%)
[test:db] forced drops that needed a retry: 0
[test:db] teardown: dropped 2 database(s) in 116 ms; 0 remain with the run prefix dems_test_step_71_tmdu0pb5_
exit=0
## ended 19:15:00
```

The default reporter does not print what a passing test writes to the console (finding W49-F3).
The lines quoted in this document are in the run with test names
(`assets/05_row_command_verbose.log`, 19:15:00 to 19:15:09, `--reporter=verbose`, exit 0, 6
passed, 0 databases remain).

### 12.2 The six tests (19:15:00)

| Test | Result | Time |
|---|---|--:|
| SC3, AC-B-44 to AC-B-47: two clients on one Core, (i) web + web > equal after every step; B dropped, back and equal to a fresh client; an explicit resync; every frame valid | pass | 1,139 ms |
| SC3, AC-B-44 to AC-B-47: two clients on one Core, (ii) web + tablet > the same | pass | 2,469 ms |
| RT-7, a new epoch under the same listener > the engine stops and starts again: both clients are sent a snapshot of the new epoch without asking, and continue equal | pass | 343 ms |
| RT-7 … > a real demo reset through the demo route: the snapshot of the new epoch and the session.updated of the operator whose role the seed put back arrive, and both clients continue equal | pass | 1,297 ms |
| can the assertions fail? > the deltas of one command withheld on their way to B: the equality assertion is red; B meets the gap at the next delta, resyncs, and it is green | pass | 305 ms |
| can the assertions fail? > frames the test makes itself: a member the contract does not name, a slice that never travels, a value like a credential; each assertion about frames is red, and the client drops them | pass | 212 ms |

Duration of the file over eleven runs with test names (18:52 to 19:15, load average 3 to 15):
scenario (i) 1,078 to 2,101 ms; scenario (ii) 2,285 to 3,221 ms (about 1.7 s of it is the tablet's
two reconnect delays); the engine restart 163 to 548 ms; the demo reset 458 to 1,838 ms; the two
"can it fail" tests 161 to 399 ms and 103 to 321 ms. The runner's total for the file, with the
build of the two templates: 6.3 to 14.0 s.

### 12.3 Typecheck, lint, the static guards (`assets/05_typecheck.log`, `05_lint.log`, `05_static_guards.log`)

```
## 2026-10-04 19:14:29 WIB $ npm run typecheck -w @dems/core-server
> tsc --noEmit
exit=0
## 2026-10-04 19:14:21 WIB $ npm run lint -w @dems/core-server
> oxlint
exit=0
## 2026-10-04 19:14:22 WIB $ npm run test -w @dems/core-server -- --maxWorkers=2 test/static
 Test Files  9 passed (9)
      Tests  112 passed (112)
exit=0
```

Lint printed no warning. The static guards of the `unit` project read the whole tree, so they
were run with the two new files in it.

### 12.4 The whole `db` project (`--maxWorkers=2`), and what was not this row's (P11)

Three runs. In each one the failures are in files of other rows; `shared-state.test.ts` is among
the passed files of each.

| Start to end | Load average | Files | Tests | Exit | Failures, all outside this row's file |
|---|---|---|---|--:|---|
| 18:59:16 to 19:01:19 (`assets/05_whole_db_1859.log`) | 2.9 to 7.3 | 114: 111 passed, 3 failed | 1,671: 1,668 passed, 3 failed | 1 | (1) `test/acceptance/pairing-lifecycle.test.ts:1288`, "AC-B-82 … the PASSWORD session of the same operator on the same device stays open, and so does its socket": `expected false to be true`. The pairing-lifecycle row's file (W48) against the realtime fix round, which gave a device a cap of two sockets at 18:55 (`src/realtime/limits.ts` `REALTIME_MAX_PER_DEVICE`). (2) `src/realtime/__tests__/upgrade.db.test.ts:556`, "AC-B-85 … the 17th connection of any kind is closed with 1013": `expected 9 to be 16`. The realtime row's own test against its own fix round, in flight. (3) `src/modules/demo/__tests__/reset-failures.db.test.ts:391`, "finding F-5 … RUN through a failed reset": `expected [ …(87) ] to have a length of 86 but got 87`. The demo row's test of finding F73 against the engine fix round (`src/engine/host.ts`, `rehydrate.ts` changed at 18:54) |
| 19:07:35 to 19:11:11 (`assets/05_whole_db_1907.log`) | 15.3 to 14.0 | 115: 109 passed, 6 failed | 1,684: 1,678 passed, 6 failed | 1 | (1) `src/realtime/__tests__/upgrade.db.test.ts`, "CPS1-5: the cap of one principal, over real sockets": `Test timed out in 5000ms`. A new test of the realtime fix round, under a load average of 15. (2) `reset-failures.db.test.ts:391`, as above. (3) to (6) Four files of `src/modules/identity/biometric/__tests__/` (`failure`, `secrets`, `sequence`, `sign-in`): expectations about the row of a refused biometric sign-in and the steps of its unit (`OTHER_DEVICE`, 13 steps against 11), a round on the biometric module in flight (its test file did not compile at 19:14:10, below) |
| 19:15:33 to 19:18:48 (`assets/05_whole_db_1915.log`) | about 10 | 115: 112 passed, 3 failed | 1,691: 1,688 passed, 3 failed | 1 | (1) `reset-failures.db.test.ts:391`, as above. (2) `src/modules/identity/biometric/__tests__/failure.db.test.ts`, "AC-B-83 … \"live or last used\" …": the row of a refused sign-in differs from the expected one. (3) `src/modules/identity/biometric/__tests__/secrets.db.test.ts`, "the journey itself …": `OTHER_DEVICE` expected among the reasons. Both of the round on the biometric module, in flight. The two files of the realtime row and the pairing-lifecycle file passed in this run |

The second and third runs were made because the tree was moving under the first (P11: re-run and
record both). After the second run one statement of this row's file changed, at 19:14: the text
of one printed line of the demo-reset test (the types of the appended rows). The third run is on
the final file.

Other noise, with the time:

| Time | Command | What | Whose |
|---|---|---|---|
| 18:57:13 to 18:57:56 (three runs) | `typecheck` | exit 2: `src/realtime/admission.ts(154,31)` TS2339 `sessionId` | The realtime fix round, in flight; exit 0 at 18:58:37 |
| 19:03:40, 19:06:53 | `lint` | exit 0 with one warning in `src/realtime/__tests__/hub.principal-cap.test.ts:34:13` | The realtime fix round; gone at 19:14:21 |
| 19:14:10 (`assets/05_typecheck_1914_noise.log`) | `typecheck` | exit 2: `src/modules/identity/biometric/__tests__/sign-in.db.test.ts(440,81)` TS2304 `rateLimited` | A round on the biometric module, in flight; exit 0 at 19:14:29 |

### 12.5 Every run of this row's file

| Time | Result |
|---|---|
| 18:47:34 | Did not run: inside the command sandbox the helper cannot reach PostgreSQL (`POSTGRES_UNREACHABLE`, EPERM), as P10 says; it failed, it did not skip |
| 18:47:41 | exit 1: 3 of 5 passed. Both scenarios were red at ONE assertion of the test itself: it expected C to have received meter frames, and the engine does not tick after C joins. Every assertion about the Core before it had passed. The expectation was wrong and was corrected; nothing else was changed to make a test pass |
| 18:52:23 to 19:15:00 | 17 runs of the file alone, all six tests in each: **17 green, exit 0 each**, at 18:52:23, 18:52:42, 18:54:53, 18:55:01, 18:55:10, 18:58:47, 19:01:44, 19:01:56, 19:04:03, 19:06:06, 19:07:03, 19:07:17, 19:12:54, 19:13:06, 19:13:21, and the two of section 12.1 (19:14:49, 19:15:00). Between them the test changed: five assertions that had counted deltas were re-worded so that they hold whatever number of deltas a step produces, as the brief asks (18:53 to 18:57; green in both forms); the heartbeat's session state was added at 19:03, the four further controls of section 11 at 19:05, one printed line at 19:14. No assertion was changed to turn a red run green, except the one wrong expectation of 18:47:41 |
| 18:59, 19:07, 19:15 | Inside the whole project: green |
| 19:23:51 | Once more, alone, after this document was written: exit 0, 6 passed, 10.11 s, 0 databases remain. 18 green runs alone in all |

Between those runs the realtime channel and the engine changed under the test (a cap per
principal, a guard of the handshake, the engine's start). The file stayed green on every state of
the tree it ran on.

## 13. Findings

In what SC3 and AC-B-44 to AC-B-47 ask, **no side departs from the contract**: the server sends
every operator socket every revision once and in order, a reconnect and a `resync` are answered
with a snapshot of the present state, the answer of a command names the revision that holds its
effect, and the shared Live source, typed client and Live socket client hold exactly the
engine's state at every position that was compared. Beside that:

| ID | Severity | Departing side | Finding |
|---|---|---|---|
| W49-F1 | Low | The contract (`packages/shared`) | **The union does not refuse an unknown member of a `heartbeat`.** `HeartbeatSchema` is `z.object` (`packages/shared/src/api/realtime-messages.ts:74`), the other eight members of `WsServerMessageSchema` are `z.strictObject`. So "every message validates against the contract's union" (AC-B-46) cannot show that a heartbeat carries nothing undeclared, and heartbeats are the one message an ANONYMOUS and a DEVICE socket receive every second (spec §9.5). The file says so about itself ("every NEW member is a strict object", lines 32 to 36): it is a known limit of the contract, not a slip, but AC-B-46 reads as if the union covered it. The SERVER sends no such member: this test read the member names of every heartbeat it recorded (341 in the two scenarios) and found exactly the eight. The shared socket client accepts such a heartbeat and drops the member silently |
| W49-F2 | Low | The server (engine reload in mode `reset`, with the channel) | **After a demo reset, the snapshot of the new epoch says the Core link is CONNECTED although no paired device has a socket; one pace step later (up to 250 ms) a delta sets it OFFLINE and appends a `TABLET_LINK_CHANGED` row and a `TABLET_DISCONNECTED` event.** Spec §6.8: the link is CONNECTED while a paired device has an open socket "and OFFLINE otherwise"; spec §12.4: after a reset the link is "recomputed from the open sockets". It is recomputed, one step late: the reset rebuilds the seed (whose link is CONNECTED), the engine's reload in mode `reset` does not apply the rule of a process start (`src/engine/rehydrate.ts:290-291` runs for `boot` only; `host.ts:191`), and the channel compares at its next pace step (`src/realtime/tablet-link.ts:21-27`). Effect: for one pace step every client shows a connected tablet that is not there, and every reset on a Core without a tablet writes, as the first row after `SCENARIO_LOADED`, a disconnect that did not happen then. The two clients are equal throughout (they are told the same), so SC3 holds |
| W49-F3 | Info | The test runner's default reporter | The lines a passing test prints (`console.info`) are not shown by the default reporter of Vitest 5: the row command prints only the totals. The evidence lines of this row (positions, digests, counts) need `--reporter=verbose`. A gate that re-runs the row command and wants to see them must add it |
| W49-F4 | Info | Test support | What this test needed of two rows is still in their `__tests__` folders, not in the neutral `test/support/`: the reset row's `testRoutine` and `useRoutine` (`src/modules/demo/__tests__/support.ts`, imported here) and the channel row's stage with a real listener (`src/realtime/__tests__/support.ts`, not imported: this file builds its own on the neutral support). Three files now build a booted server with a real listener (the channel row's support, the pairing-lifecycle test through it, this row's support) |

### 13.1 Minimal reproduction of W49-F1

```ts
import { WsServerMessageSchema } from '@dems/shared/api';
const beat = { type: 'heartbeat', v: 1, seq: 0, serverTime: '2031-01-01T00:00:00.000Z', uptimeMs: 0, intervalMs: 1000, clients: 1, sessionState: null };
WsServerMessageSchema.safeParse({ ...beat, extra: 'x' }).success;                                              // true
WsServerMessageSchema.safeParse({ type: 'admin.changed', v: 1, resource: 'USERS', extra: 'x' }).success;      // false: unrecognized_keys
```

In the test: "can the assertions fail? > frames the test makes itself …", the two lines it prints
(section 11, rows 2 and 3). What would close it: a strict heartbeat member in the union the Core
server's clients validate with (the bytes mock-core sends do not change: strictness refuses only
unknown members), in the contract close-out row W83; or a sentence in AC-B-46 that the member
names of a heartbeat are checked apart.

### 13.2 Minimal reproduction of W49-F2

A Core with the demo flag on and NO socket of a paired device; one operator socket open;
`POST /api/v1/demo/reset` by a holder of `DEMO_CONTROL`. Read the operator socket:

```
snapshot 2/0     state.tabletLink.state = "CONNECTED"
delta 2/1        replace meta, append events [TABLET_DISCONNECTED], append audit [TABLET_LINK_CHANGED], replace tabletLink, replace otherDevices
```

In the test: "RT-7 … > a real demo reset through the demo route …" prints both lines (section
10.2); it asserts only what the specification says at the end (the link is OFFLINE after the
pace step) and pins neither the snapshot's value nor the extra row. What would close it: the
reload after a reset takes the link from the channel's presence before it publishes the start
(or the reset's resume sets it inside the same unit), so that the snapshot of the new epoch is
already true and no row is written for a change that did not happen. For the owner of the engine
or of the demo-control module; not blocking.

## 14. What this test does NOT cover

| Not covered | Where it belongs |
|---|---|
| A browser: the real cookie jar, the real `Origin` of a page, the Vite proxy in front of `/api/v1` and `/ws`, React rendering the store | The web runtime row W50 and the end-to-end rows (W94 to W96); AC-B-51 |
| A phone or a tablet: React Native's socket and its headers, the app's secure store, the emulator through `adb reverse` | The mobile runtime rows W51, W56, W57 and the end-to-end rows |
| A listening server on a fixed port (4420 or a lane) started by the entry point, with the SYSTEM timers: the engine's 50 ms timer, the channel's heartbeat, pace step and ping in real time | W58, W95, W98. Here the clock and the three timers are the test's |
| More than two operator clients acting, and commands of two clients racing each other | AC-B-49 (the sessions row); the third client here only reads |
| A process restart with clients connected (close 1001, the clients' reconnect into the boot) | W53 covers the restart without sockets; W58 and W95 the whole |
| `loadScenario`, and a reset that FAILS (the new epoch of decision D101) with real sockets | The demo-control row's own tests, on the seam `app.publish` |
| `device.revoked`, `TOKEN_REUSE`, the expiry of a session, a disabled user: the ends of a socket | The channel row's `control.db.test.ts`; the pairing-lifecycle test W48 |
| The send policy: meter frames at the wire rate, a slow consumer, the caps (AC-B-48, AC-B-85), the cap per principal that the fix round added during this row | The channel row's tests. This scenario stays far below every cap (at most one socket per web session and two per device at a time) |
| The ring limits: more than 1,000 audit rows or 500 events in a replica, so that an `append` drops rows off the front | Not reached here (about 150 audit rows); the Live source's own tests and the bulk-fixture tests |
| The reconnect backoff beyond its second step, and a `resync` that comes sooner than 2 s after the last (decision D111 DN-2) | The Live socket client's own tests; the channel row's `hub.lifetime.test.ts` |
| Every command but the six of the session's lifecycle (evidence, devices, storage, network, system) as a source of deltas | The module rows; the replication rule is the same for every slice, and 11 to 12 of the 28 slices changed in these scenarios |
| Clock drift between a client and the Core | The server clock here is ahead of the clients' (2031); `implementation/44_live_source.md` §17.5 |

## 15. Requirement to test

| Requirement | Asked by | Result |
|---|---|---|
| SC3: both clients take their data from the backend; an action on one is visible on the other | Both scenarios: 16 and 17 comparisons of A, B (and C) with `app.engine.state()`, slice by slice; B's store shows the session A created, the recording A started, the stop and its reason, SEALED; in (ii) A's store shows the Core link going OFFLINE when the tablet falls off and CONNECTED when it is back | pass |
| AC-B-44: A starts a session; B receives the deltas; after start, marker and stop B's state equals A's | `command`: B's socket holds a delta of every revision each command produced; `compare` after create, pre-check, start, marker, stop and the seal | pass |
| AC-B-45: after a dropped socket B reconnects and its state equals a fresh client's snapshot | The drop of sections 6.1 and 6.2; B against the snapshot as it was sent to C, B's store against C's store, both against the engine | pass |
| AC-B-46: every message validates against the union; revisions are gap-free within an epoch | `frameProblems` and `sequenceProblems` over all sockets of each stage; the clients' own counters; section 9 | pass |
| AC-B-47: for a command answered with revision N, a store that has applied revision N shows its effect | `command`, for 18 commands; section 5 | pass |
| RT-1: after `hello` an OPERATOR socket receives one snapshot | `sequenceProblems` (the first state message of every operator socket is a snapshot) | pass |
| RT-2, RT-3: deltas are the previous revision plus 1; `replace` and `append` | The second replica, which applies them by that rule alone, equals the engine at every comparison | pass |
| RT-5: the delta that holds a command's effect is at most N | Section 5: it was N for all 18 | pass |
| RT-6: a gap or a reconnect ends with a snapshot; no delta is replayed; a resynchronised client equals a fresh one | Sections 6, 7 and 11 (by reconnect, by an explicit `resync`, by a gap) | pass |
| RT-7: a new epoch; every OPERATOR socket gets a new snapshot | Section 10 (the engine restart; a real demo reset) | pass |
| Spec §9.2: what each principal receives | Section 8 | pass |
| Spec §9.5, SR-49: what never appears in a message or in the log | Section 8, the last two rows | pass |
| Spec §12.4: an operator whose role changes back receives `session.updated`; sessions are kept | Section 10.2 | pass |
| Spec §6.8: the Core link follows the sockets of paired devices | Scenario (ii): OFFLINE 5 s after the cut, CONNECTED at the tablet's return; and finding W49-F2 | pass, with the finding |
| Rule 7 of the brief: the test can fail | Section 11 | shown |

## 16. Time limits and duration

`vi.setConfig({ testTimeout: 120_000, hookTimeout: 180_000 })` at the top of the file: caps, not
waits. The longest test took 3.2 s, the file 6.3 to 14.0 s as the runner reports it. No test
waits for the server: its clock is the test's. The real waits and their bounds are in section
3.4.

## 17. Deviations from the row text and the brief

| ID | Deviation | Reason |
|---|---|---|
| DV-1 | The template is named `seed` in the code (`useTestDatabase({ template: 'seed' })`); rule M9 writes `tpl_seed` | `seed` is the helper's key of the template whose database is `…_tpl_seed` |
| DV-2 | B is the SUPERVISOR in both scenarios; the fresh client C is the TECHNICIAN, signed in beforehand through the sign-in route | "Another operator" is all the brief asks. A session that exists already makes "a client that takes a fresh snapshot at that moment" exact: opening C changes nothing on the Core |
| DV-3 | B reaches the Core through a TCP relay of the test (a second listener on `127.0.0.1` port 0 per scenario) | It is what makes the drop deterministic: B cannot come back while A runs its two commands. In (i) the drop itself is the server's; the relay only holds B out. In (ii) the relay IS the network that is cut |
| DV-4 | In (ii) the test also waits (bounded) until the tablet's first reconnect attempt was refused, and drives 5.25 s of the server clock while B is away | A network that is down outlasts the first retry; and the tablet is the device that holds the Core link, so its absence is itself a state change the other client must see |
| DV-5 | One import from a row's `__tests__` folder: `testRoutine`, `useRoutine`, `RESET` of the reset row | The brief names the reset row's test support as the way to the real routine; finding W49-F4 |
| DV-6 | Three whole `db` runs, not one | The tree moved under the first (P11); the third is on the final file |
| DV-7 | `masterplan/02_plan.md`, `status_tasks.md`, `implementation/99_implementation_report.md` and `test/01_test_report.md` were not written | Parallel run: shared files are the controller's (P8); this document and the progress file are the row's |
| DV-8 | The first run of the file was made inside the command sandbox and could not reach PostgreSQL | The session's sandbox rule asks for a failure before a bypass; every later database run used the bypass, as P10 says |

## 18. Assets (`docs/2026-10-04_dems_backend_rbac_pairing/test/assets/`)

| File | Holds |
|---|---|
| `05_row_command.log` | The row command, 19:14:49, exit 0 |
| `05_row_command_verbose.log` | The same with `--reporter=verbose`, 19:15:00: every test name and every `[w49]` line (positions, digests, counts, the timelines) |
| `05_typecheck.log`, `05_lint.log`, `05_static_guards.log` | 19:14:29, 19:14:21, 19:14:22: exit 0 each |
| `05_typecheck_1914_noise.log` | The typecheck of 19:14:10 that failed in another row's file |
| `05_whole_db_1859.log`, `05_whole_db_1907.log`, `05_whole_db_1915.log` | The three whole `db` runs |
| `05_end_state.txt`, `05_end_state.mts.txt` | What was left at the end, and the read-only script that asked PostgreSQL |

## 19. Test ledger (P24)

Workspace `@dems/core-server`; no other workspace was touched.

| Project | This row's addition |
|---|---|
| `db` | +1 file, +6 tests: `test/acceptance/shared-state.test.ts` |
| `unit` | Nothing: the test file is not in it, and `shared-state.support.ts` is no test file |

Whole `db` project as this row saw it: 114 files / 1,671 tests at 18:59, 115 / 1,684 at 19:07
(the other rows in flight added the rest since the baseline of 108 files / 1,541 tests at 17:48).

## 20. Decisions for the controller

| ID | Question | Recommendation |
|---|---|---|
| DN-1 | W49-F1: the union and the heartbeat | Give it to the contract close-out row W83: a strict heartbeat member in the union of the Core server, or one sentence in AC-B-46. Until then the member names of a heartbeat are checked by this test |
| DN-2 | W49-F2: the Core link in the snapshot after a reset | Give it to the owner of the engine (fix round B2) or of the demo-control module; Low, not blocking. If it is accepted as specified ("recomputed"), record that every reset on a Core without a tablet writes one `TABLET_LINK_CHANGED` row |
| DN-3 | W49-F4: the reset row's `testRoutine` / `useRoutine` and a stage with a real listener in `test/support/` | For the helper-test follow-up that is in flight, or after the gate; this file then needs two import lines changed |
| DN-4 | The gate's re-run of this row | `DEMS_TEST_STEP=71 npm run test:db -w @dems/core-server -- test/acceptance/shared-state.test.ts --reporter=verbose` shows the lines; without the reporter option only the totals |
| DN-5 | The realtime fix round that landed during this row (a cap of four sockets per web session and two per device; a guard of the handshake) | Nothing to do for this file: it ran green before, during and after. The pairing-lifecycle file (W48) and the channel row's own cap test were red against it at 18:59 and 19:07 |

## 21. End state and cleanup (`assets/05_end_state.txt`)

```
## 2026-10-04 19:24:22 WIB end state of blueprint row 71 (W49), after the last run of this row (the row command of 19:23:51, ended 19:24:02)
session: role=dems_owner database=postgres server=18.4 port=4432 postmaster started 2026-10-04 07:14:26.046351+07
databases with this row's prefix (dems_test_step_71_*): 0
test databases of all rows at this moment: 11
project databases: dems_demo, dems_lane_1, dems_lane_2, dems_lane_3
sessions on this row's databases still open: 0
## .locks/postgres.pid: 19121
## process 19121: 19121 Sun Oct  4 07:14:26 2026     /Users/gsp-budi/Documents/DEMS/node_modules/@embedded-postgres/darwin-arm64/native/bin/postgres -D /Users
## listeners on loopback held by node or postgres processes (lsof -nP -iTCP -sTCP:LISTEN), with the process that holds each:
postgres 19121 127.0.0.1:4432 :: Sun Oct  4 07:14:26 2026     /Users/gsp-budi/Documents/DEMS/node_modules/@embedded-postgres/darwin-arm64/native/bin/postgres -D /Users/gsp-budi/Documents/DEMS/.data/postgres -c listen_addres
## test runners of this row still alive (pgrep -f 'shared-state'): 0
## files of this row in the tree:
-rw-r--r--@ 1 gsp-budi  staff  55139 Oct  4 19:05 /Users/gsp-budi/Documents/DEMS/apps/core-server/test/acceptance/shared-state.support.ts
-rw-r--r--@ 1 gsp-budi  staff  61247 Oct  4 19:14 /Users/gsp-budi/Documents/DEMS/apps/core-server/test/acceptance/shared-state.test.ts
bf629ad229c281a4c2d9830f10b48fd084406f1273fd26c0d807a7dec65a2160  /Users/gsp-budi/Documents/DEMS/apps/core-server/test/acceptance/shared-state.test.ts
887a3c9b7c5fdf57120232b182e66de3be6cc54793b4ecb3d7d610f2a62a0e34  /Users/gsp-budi/Documents/DEMS/apps/core-server/test/acceptance/shared-state.support.ts
     884 /Users/gsp-budi/Documents/DEMS/apps/core-server/test/acceptance/shared-state.test.ts
    1217 /Users/gsp-budi/Documents/DEMS/apps/core-server/test/acceptance/shared-state.support.ts
    2101 total
```

Every run's teardown line says `0 remain with the run prefix`. Every listener of this row was on
`127.0.0.1` at port 0 (the app's, and one relay per scenario) and is closed inside the test that
opened it: each test ends with `expect(await stage.close()).toEqual(NOTHING_LEFT)`, which asks
that no listener of the stage listens, that its ports refuse a connection, that every socket a
client opened and every socket the server accepted is closed, and that the hub knew no socket
when the clients had stopped. No port of the plan's table was bound. No process was started
besides the test runners, which ended; none was stopped by hand. PostgreSQL was neither stopped
nor started. Scratch files (logs, the table generator, the end-state script) are outside the
repository, in the session's scratchpad under `w49/`.

## 22. Rollback (R-NEW; not executed)

`apps/core-server/` is untracked at `4b708c8`, and both files are new:

```
rm apps/core-server/test/acceptance/shared-state.test.ts apps/core-server/test/acceptance/shared-state.support.ts
```

Nothing else refers to them: no production file, no configuration (the `db` project takes
`test/acceptance/**/*.test.ts` by its glob), no other test. The `db` project then has one file
and six tests fewer. This document, its assets (`test/assets/05_*`) and the progress file are the
record and stay.
