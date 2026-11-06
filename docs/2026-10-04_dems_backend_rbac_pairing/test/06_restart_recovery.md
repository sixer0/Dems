---
task_id: 2026-10-04_dems_backend_rbac_pairing
task_slug: dems_backend_rbac_pairing
blueprint_row: 75
plan_row: W53
title: Acceptance test, restart and recovery (SC2; AC-B-04, AC-B-05, AC-B-06; SR-17)
date: 2026-10-04
agent: test-expert (tier R)
source_plan: /Users/gsp-budi/Documents/DEMS/docs/2026-10-04_dems_backend_rbac_pairing/masterplan/02_plan.md
source_spec: masterplan/01_specs.md rev 2.2 (§5 ID-8, ID-10, SR-11, SR-17; §8.6; §16.1 AC-B-04 to AC-B-06); masterplan/03_database_contract.md rev 2.2 (§3.3, §9.6); gateway_check/01_gate_report.md (rules M9, M10, M12, M15, M16)
evidence_tier: 2
status: complete
---

# W53: acceptance test "restart and recovery"

All times are WIB (UTC+7) on 2026-10-04. Commands ran from `/Users/gsp-budi/Documents/DEMS`.
Database commands ran with the per-command sandbox bypass (P10). Quoted runner output is unchanged
except that blank lines and the sandbox's certificate warning lines are left out. Instants of the
manual server clock are written as seconds after the seed instant, 2026-10-01 10:00:00 WIB
(`+36.35 s`).

**No password, token, cookie value, credential hash or pairing code appears in this document or
in its assets.** A cookie, a session token, a device credential and a pairing code are taken from
an answer by the test and handed on; none is printed, compared in an assertion or put into a test
name. The 32-digit values of section 4 are content checksums of whole tables, in the form the
reset row's log already prints them; the 64-digit value of section 7 is the head of a test
database's audit chain. A search of every asset for a session token, a device credential, a
biometric token, a cookie pair, a bearer value and the demo password found 0 lines (17:42).

## 1. Result

| Question of the row | Answer | Where |
|---|---|---|
| The file passes under `test:db` | **Yes: 1 file, 16 tests, exit 0** (17:32:16; 5.81 s); 0 databases left with the run prefix | section 9.1 |
| AC-B-04: per-table checksums of contract §9.6 equal before and after a restart that follows a policy change, a sealed session, a role change and a paired device | **Yes, for all 30 tables of schema `public`, in twelve restarts on five databases.** After a restart with a tablet connected at the stop, 24 tables are equal and 6 hold what the start itself wrote (each named, and the untouched part of each compared); after every other restart 29 are equal and `core_state` alone moved (the epoch) | sections 4, 5 |
| AC-B-05: a session in RECORDING at the stop is in FAULT afterwards; `recoverSession` ends in an INCOMPLETE history entry with the recovery rows | **Yes.** `FAULT_RAISED` with no actor at the last committed instant; the recorded size is that instant's, not the stop's; `SYSTEM_BOOT`, `RECOVERY_STARTED` (the caller), `FAULT_CLEARED`, then `SESSION_INCOMPLETE`, `RECOVERY_COMPLETED`; evidence RECORDED, never sealed | section 6.1 |
| AC-B-06: the same for FINALIZING | **Yes**, with the stop placed DURING the recovery as well: the next process completes it | section 6.2 |
| SR-17: sessions survive a restart; ended sessions keep their end reason | **Yes.** The SUPERVISOR session of the first process answers in four later processes without a sign-in; a signed-out session stays ended with `SIGNED_OUT`; the idle and the absolute limit still end sessions on the server clock, the absolute one 8 hours after the issue in the FIRST process | section 5.4 |
| The epoch is the previous plus 1 at every start | **Yes**, in the engine, in `core_state` and in the `x-dems-epoch` header: 1, 2, 3, 4, 5 in the journey | section 5 |
| The audit chain verifies over all stored rows and continues without a gap | **Yes**, checked after every restart over every stored row, and through `GET /api/v1/audit/chain` (view and stored) | sections 5.3, 7 |
| Can the test fail? | **Yes: 11 of 11 mutations of the test's INPUT turn it red**; none changes production code or a file of the tree | section 10 |
| Defects found | **None on a clock that moves forward.** Two findings in a start whose clock is BEHIND the stored state (a case the row does not name): a session cannot be ended (500), and an audit row is stamped before its predecessor | section 11 |

## 2. What was written

| Path | What |
|---|---|
| `apps/core-server/test/acceptance/restart.test.ts` | The one test file of the row: 1,372 lines, 16 tests in four `describe` blocks; SHA-256 `24124795…1237d52f`, last written 17:24:28 |
| `docs/…/test/06_restart_recovery.md` | This document |
| `docs/…/test/assets/06_*` | Eleven evidence files (section 14) |
| `docs/…/delegation_progress/test_expert_step_75.md` | The progress file |

Nothing else in the tree was written: no production file, no test of another row, no
configuration. The file name is the row's: the `db` project of `vitest.config.ts` takes
`test/acceptance/**/*.test.ts` (`vitest.config.ts:15-19`), and `vitest list` confirms it
(`[db] test/acceptance/restart.test.ts`; the `unit` project lists nothing under the folder), so
the root gate stays database-free.

## 3. What was tested, and how

### 3.1 What a restart is in this test

What it is in production, without the listener (the row binds no port):

1. `app.close()`: the engine's last unit (`engine.stop()` through its `preClose` hook), the
   pipeline, the runtime pool.
2. The test asks PostgreSQL until it lists no backend of `dems_app` on the clone
   (`pg_stat_activity WHERE datname = current_database()`; finding F63: the driver's `pool.end()`
   resolves before the server has removed the backend; the question is keyed by the test's own
   database). A poll with a cap of 30 s; in every restart of the final run the first question was
   answered 0.
3. A NEW app from `buildApp` on the SAME database, booted through `app.readiness.boot()`: the boot
   checks, the stored grants, then the engine's `start('boot')`.

### 3.2 What is real, and the two things that are the test's

Every request is `app.inject` through stages 2 to 7 and the modules' own handlers. No stage is
replaced, no seam but the clock: the device registry behind `deviceResolver`, the engine host and
the realtime seam `publish` are the server's own (the helpers `engineApp` and `sessionsApp` of the
engine and sessions rows replace `publish` with a recorder, so this file builds its app itself).
The callers are the three seeded operators, signed in through `POST /api/v1/auth/sign-in`, and
tablets that redeemed a code the server issued.

The test's own: the server clock (a manual clock behind the seam `clock`) and the engine's timer
(the engine row's `manualTimer`, set before the boot: rule M9). No test waits; the one real wait is
the poll of step 2. Per-test cap 120 s, per-hook cap 180 s (`vi.setConfig`).

`app.engine.setTabletLink('CONNECTED')` is called once per database before a recording, as the
realtime channel does when a paired device's socket is accepted (sessions row, finding F-13).

### 3.3 What is compared

| Layer | How |
|---|---|
| The tables | The content checksum of contract §9.6 of EVERY table the catalog lists in schema `public` (30), read as `dems_owner` (SELECT only) from the stopped database and again after the start. 26 by the seed row's `tableChecksums`; 4 added in this file by the contract's recipe (`operator_credentials` by its key; `auth_sessions`, `biometric_tokens`, `health_snapshots` as the row image without `id`, ordered by `issued_at, token_hash` or `at, cause`). A table neither knows is still compared (rows in image order), so a table a later migration adds cannot be left out silently |
| What a start may write | Per kind of start, the exact list of tables that differ, each with its reason (section 4.2). For each such table the part a start must NOT touch is compared as a checksum of its own: `audit_log` and `events` up to the stored head, `core_state` without `epoch` and `updated_at`, the counters the start did not take, `hardware_snapshot` without the three columns of the tablet link |
| The stop | The tables read while the server still runs (engine idle, pipeline drained) and after the close: a stop may write the hardware snapshot and nothing else |
| What the server serves | 13 read operations (GETs), each validated against the contract, compared body by body before the stop and after the start; `serverTime` is the one member left out |
| The chain | After every restart: the stored rows of before the stop are unchanged, the first row of the start links to the last row before the stop, gap-free sequence, the head row is the newest row, the shared `verifyAuditChain` over ALL stored rows |
| The last committed instant | Read by the test from the stopped database (the greatest of the snapshot's `written_at`, the session's `updated_at`, the newest audit row and event), not taken from the engine |

### 3.4 Helpers of other rows that this file imports

| From | Used |
|---|---|
| `test/helpers/db` (W11) | `useTestDatabase({ template: 'seed' })`, `db.another(…)`, `TestDatabase` |
| `src/db/seed/__tests__/support` (W20) | `tableChecksums` (the contract's checksum, 26 tables), `withoutNegativeZeros` |
| `src/db/fixtures/__tests__/template-hook.bulk` (W25) | `BULK_TEMPLATE_NOW` |
| `src/core/__tests__/support` (W21) | `readTrail`, `readHead`, `verifyTrail`, `linkProblems`, `sleep` |
| `src/engine`, `src/engine/__tests__/support` (W26) | `engineControl`, `HEALTH_SNAPSHOT_INTERVAL_MS`; `manualTimer`, `FIXED_NOW`, `storedSlices` |
| `src/modules/identity/__tests__/support` (W24) | `webSignIn`, `cookieValue`, `deviceSignIn`, `get`, `webPost`, the three paths |
| `src/modules/pairing/__tests__/support` (W32) | `portalPost`, `redeem`, `devicePost`, `deviceGet`, `wrongCodeFor`, `revokeUrl`, `expectContract`, the paths. `pairDevice` itself is not called: its parameter is the pairing row's own app object; the two calls it is made of are |
| `src/modules/admin/__tests__/support` (W33) | `USERS`, `roleUrl` |
| `src/modules/sessions/__tests__/support` (W34) | `seeded`, `sessionInput`, `on`, the paths |
| `src/plugins/config/__tests__/test-config` (W08) | `unitTestConfig`, `captureLog` |

**The checksum helper.** No helper for all 30 tables is exported in a usable form:
`tableChecksums` leaves out the four tables a comparison of two seeds cannot hold, and the reset
row's `digestAll` is another digest (SHA-256 in image order), not the contract's. The file
therefore imports `tableChecksums` and adds the smallest piece itself, `checksumOf` (one
statement, the contract's expression with a row image, an order and a filter), used for the four
tables and for the untouched parts.

## 4. AC-B-04: the per-table checksums

### 4.1 Restart 1 of the journey (a tablet was connected at the stop), run of 17:32:22

Stop at `+36.35 s`, start at `+126.35 s`; epoch 1 to 2. 30 tables: 24 equal, 6 moved.

| Table | Rows | Checksum, stopped | Checksum, started | |
|---|---|---|---|---|
| `active_session` | 1 -> 1 | `3153194459a06894714198b82f6ce59c` | `3153194459a06894714198b82f6ce59c` | equal |
| `alerts` | 0 -> 0 | `d41d8cd98f00b204e9800998ecf8427e` | `d41d8cd98f00b204e9800998ecf8427e` | equal |
| `audit_chain_head` | 1 -> 1 | `642c80dd36eca75ed656aef2241fe36a` | `44941f301c9c766bfe8e5ba7bec4e0be` | **moved**: follows the newest audit row |
| `audit_chain_history` | 0 -> 0 | `d41d8cd98f00b204e9800998ecf8427e` | `d41d8cd98f00b204e9800998ecf8427e` | equal |
| `audit_log` | 108 -> 109 | `31700aeeaa0a0b65794cc3a61669fe4e` | `95c3fb7c4be354d3b2b36fc041e4f951` | **moved**: the row the start wrote, `TABLET_LINK_CHANGED` |
| `auth_sessions` | 5 -> 5 | `348f5c62971bc8da8fc6a4692ea56118` | `348f5c62971bc8da8fc6a4692ea56118` | equal |
| `biometric_tokens` | 0 -> 0 | `d41d8cd98f00b204e9800998ecf8427e` | `d41d8cd98f00b204e9800998ecf8427e` | equal |
| `console_settings` | 1 -> 1 | `e989d47d1011537769ee1753b4ac3e47` | `e989d47d1011537769ee1753b4ac3e47` | equal |
| `core_device` | 1 -> 1 | `ff0be292ec82bd2813a400e538383575` | `ff0be292ec82bd2813a400e538383575` | equal |
| `core_state` | 1 -> 1 | `dcc468cf8574f947229fad5bf2cb170d` | `66020c6624d7eea82d350017c2f258a3` | **moved**: the epoch (stored plus 1, D14); `updated_at` is the start instant |
| `device_credentials` | 1 -> 1 | `8e067b9094f170dd487bd7c0669a9d94` | `8e067b9094f170dd487bd7c0669a9d94` | equal |
| `engine_counters` | 5 -> 5 | `41772014bf149bac098d91fd3c8d5f71` | `64dbd931d995212ddc6fb4126d144171` | **moved**: the counter `event` |
| `events` | 81 -> 82 | `7ccd888aa9d97cdf26f0ea036a3e82c7` | `86803d99e767027b0dbdd69aa8795fe9` | **moved**: the event of that row, `TABLET_DISCONNECTED` |
| `evidence_custody` | 32 -> 32 | `f5db8d4dbb2600d14d6658d8ef489492` | `f5db8d4dbb2600d14d6658d8ef489492` | equal |
| `evidence_items` | 14 -> 14 | `bffd72da765ee59d2875b9c20b480f77` | `bffd72da765ee59d2875b9c20b480f77` | equal |
| `evidence_tracks` | 56 -> 56 | `6fbfd802cf6797d8e10f16062e3641ff` | `6fbfd802cf6797d8e10f16062e3641ff` | equal |
| `exports` | 1 -> 1 | `ca81ca43795f4aa758f2e06b5a96ed0f` | `ca81ca43795f4aa758f2e06b5a96ed0f` | equal |
| `hardware_snapshot` | 1 -> 1 | `fb2669dca97dbd334d7d7f2a856808e2` | `2e596e1cc99bce218d51332ff164a6de` | **moved**: the tablet link is OFFLINE after a start (`tablet_link`, the tablet's entry in `other_devices`), `written_at` |
| `health_snapshots` | 0 -> 0 | `d41d8cd98f00b204e9800998ecf8427e` | `d41d8cd98f00b204e9800998ecf8427e` | equal |
| `operator_credentials` | 3 -> 3 | `725fa6225fe8641e210309d832b1b061` | `725fa6225fe8641e210309d832b1b061` | equal |
| `operators` | 3 -> 3 | `7ce82d747adc7f03dd9e1376cb764d1c` | `7ce82d747adc7f03dd9e1376cb764d1c` | equal |
| `paired_devices` | 1 -> 1 | `9e41db18ccac9e2eb7c60c8fc36e29da` | `9e41db18ccac9e2eb7c60c8fc36e29da` | equal |
| `pairing_codes` | 2 -> 2 | `a20811758882acaecdc1934f6166d380` | `a20811758882acaecdc1934f6166d380` | equal |
| `permissions` | 12 -> 12 | `b6847b52dba810eeb88a6ec2beed7d7d` | `b6847b52dba810eeb88a6ec2beed7d7d` | equal |
| `registry_counters` | 2 -> 2 | `639cd43435f0715f9604d86854882677` | `639cd43435f0715f9604d86854882677` | equal |
| `role_permissions` | 18 -> 18 | `4535b3b8d2890c9d0e2adbd5c8c38df9` | `4535b3b8d2890c9d0e2adbd5c8c38df9` | equal |
| `roles` | 3 -> 3 | `fa441157a1c8628f2f997b22a6ea34de` | `fa441157a1c8628f2f997b22a6ea34de` | equal |
| `schema_meta` | 1 -> 1 | `58befb268168a15ab0a1f0537c49d6a9` | `58befb268168a15ab0a1f0537c49d6a9` | equal |
| `session_history` | 14 -> 14 | `f544128f47982bdad1a4e39727b74824` | `f544128f47982bdad1a4e39727b74824` | equal |
| `storage_policy` | 1 -> 1 | `e89bc8b895b88bc7adc2a7ba6d779e8c` | `e89bc8b895b88bc7adc2a7ba6d779e8c` | equal |

`d41d8cd9…` is the checksum of an empty table. The checksums of `auth_sessions`,
`operator_credentials`, `device_credentials` and `pairing_codes` differ from run to run (random
tokens and salts); within a run they are equal across the restart. The same table for each of the
other eleven restarts is in `assets/06_row_command_verbose.log`.

### 4.2 Which tables a start may write, and the part of each that must stay

Asserted as an EXACT list per kind of start: a table that moves and is not on its list fails the
test, and so does a listed table that does not move.

| Kind of start | Tables that differ | Reason | The untouched part, compared as its own checksum |
|---|---|---|---|
| EPOCH (nothing in flight, no tablet connected) | `core_state` | The epoch: stored plus 1 at every start (D14); `updated_at` | `core_state` without `epoch`, `updated_at` |
| LINK (a tablet was connected at the stop) | the above, and `audit_log`, `audit_chain_head`, `events`, `engine_counters`, `hardware_snapshot` | The truthful `TABLET_LINK_CHANGED` row (spec §8.6 "Recomputed") with its event `TABLET_DISCONNECTED` | `audit_log` and `events` up to the stored head; every counter but `event`; `hardware_snapshot` without `tablet_link`, `other_devices`, `written_at` |
| FAULT (a session in flight, a tablet connected) | the above, and `active_session`, `alerts`, `health_snapshots` | The restart fault: `FAULT_RAISED`, the session in FAULT, a critical alert, one health snapshot row | `audit_log` and `events` up to the stored head; every counter but `event` and `item`; `health_snapshots` before the start. The fault's own rows are asserted by the test of each case |

Legitimately moved, by name (the brief's list): `core_state.epoch` (every start); the hardware
snapshot's write instant (a start that writes the snapshot: LINK and FAULT); the audit rows a
start itself writes, with their head row, events and counters; a health snapshot row (the fault
raise; later one per 60 s of a running engine). Not moved by any start of this file:
`auth_sessions` (the activity column moves only where a request moved it before the stop; decision
note of the demo-control row, F-6).

### 4.3 The twelve restarts of the final run

| Database | Restart | Stop -> start | Epoch | Kind | Equal / moved | The start wrote |
|---|---|---|---|---|---|---|
| journey | 1 | `+36.35 s` -> `+126.35 s` | 1 -> 2 | LINK | 24 / 6 | `109 TABLET_LINK_CHANGED` (no actor, `+126.35 s`) |
| journey | 2 | `+126.35 s` -> `+216.35 s` | 2 -> 3 | EPOCH | 29 / 1 | nothing |
| journey | 3 (straight after 2) | `+216.35 s` -> `+306.35 s` | 3 -> 4 | EPOCH | 29 / 1 | nothing |
| journey | 4 (a session in CREATE) | `+306.35 s` -> `+396.35 s` | 4 -> 5 | EPOCH | 29 / 1 | nothing |
| recording | RECORDING at the stop | `+17.45 s` -> `+107.45 s` | 1 -> 2 | FAULT | 21 / 9 | `93 FAULT_RAISED` (no actor, `+17.00 s`), `94 TABLET_LINK_CHANGED` (`+107.45 s`) |
| recording | FAULT at the stop | `+112.45 s` -> `+202.45 s` | 2 -> 3 | EPOCH | 29 / 1 | nothing |
| recording | after the recovery | `+206.45 s` -> `+296.45 s` | 3 -> 4 | EPOCH | 29 / 1 | nothing |
| finalizing | FINALIZING at the stop | `+19.95 s` -> `+109.95 s` | 1 -> 2 | FAULT | 21 / 9 | `94 FAULT_RAISED` (no actor, `+19.80 s`), `95 TABLET_LINK_CHANGED` (`+109.95 s`) |
| finalizing | RECOVERY at the stop | `+110.95 s` -> `+200.95 s` | 2 -> 3 | EPOCH | 29 / 1 | nothing |
| armed | ARMED at the stop | `+5.00 s` -> `+95.00 s` | 1 -> 2 | FAULT | 21 / 9 | `89 FAULT_RAISED` (no actor, `+5.00 s`), `90 TABLET_LINK_CHANGED` (`+95.00 s`) |
| long history | 1 | `+3.35 s` -> `+93.35 s` | 67 -> 68 | EPOCH | 29 / 1 | nothing |
| long history | 2 | `+95.70 s` -> `+185.70 s` | 68 -> 69 | EPOCH | 29 / 1 | nothing |

The control test of section 8 restarts once more, on a sixth database, outside this comparison.
In every one of the twelve the stop itself wrote nothing: the tables read while the server ran and
after the close were equal.

## 5. The journey (AC-B-04, SR-17): five processes on one clone of the seed

### 5.1 Before the first stop (process 1, epoch 1)

| Step | Through | Result |
|---|---|---|
| Three sign-ins on the web console; a fourth session signed out again | operations 2, 5 | SUPERVISOR `OPR-002`, INVESTIGATOR `OPR-001`, TECHNICIAN `OPR-003`; one session ended `SIGNED_OUT` |
| The storage policy | 55 `setStoragePolicy` by the SUPERVISOR | 200 `{ CASE_CLOSURE, 3650, false }`, which the seed does not hold |
| A paired tablet | 15, 18 | `DEV-0001`; the INVESTIGATOR signs in on it (a bearer session) |
| A second code left ACTIVE, one wrong attempt on it | 15, 18 | 401 `INVALID_CODE` |
| The role of another operator | 12 `assignUserRole`: `OPR-003` to INVESTIGATOR | 200; that operator's next request: role INVESTIGATOR, and 403 `NOT_PERMITTED` on the policy it could change a moment before |
| A session to SEALED evidence | 24, 25, 34 (from the tablet), 35, 26, then the engine | `SES-20261001-0024` sealed as `EV-20261001-0014`; 41 `verifyEvidence` 200 `ok: true`; 37 acknowledged |

### 5.2 What the second process serves (restart 1)

With the SUPERVISOR's cookie of before the stop; nobody signs in on this process.

| Asked by the row | Answer after the start |
|---|---|
| The policy | `getStorageDetail`: `{ CASE_CLOSURE, 3650, false }` |
| The paired device, listed, PAIRED | `listPairedDevices`: one device, `Interview tablet 01`, PAIRED, `online: false`, code issued by `OPR-002`, signed-in operator `OPR-001` |
| The active pairing code (spec §8.6 "Restored") | `getPairingCodeStatus`: the same code ID and expiry, `attemptsRemaining` one less than allowed: the count is stored |
| The changed role, in that operator's NEXT request | `listUsers`: `OPR-003` INVESTIGATOR, `roleChangedAt` the instant of the change; `getAuthSession` with `OPR-003`'s own cookie of before the stop: role INVESTIGATOR and exactly the permissions of that role |
| The sealed evidence, listed | `listEvidence`: newest item `EV-…-0014`, SEALED, `sealedAt` set; `getEvidence` equals the item of before the stop, member by member |
| ... and verifies | `verifyEvidence` in the second process: 200 `ok: true`, four tracks, each computed hash equal to the hash sealed in the first process, manifest and signature ok |
| The session history | `listSessionHistory`: newest entry the session, SEALED, 10,000 ms, its evidence ID |
| Every other read | 9 of the 13 read operations answer the same body as before the stop; the four that show the trail (`listAuditRows`, `listEvents`, `verifyAuditChain`, `getSecurityStatus`) show the rows of before the stop unchanged plus the one row and the one event of the start |
| Reading changes nothing | The tables after the 13 reads are the tables right after the start |

After restarts 2, 3 and 4 all 13 read operations answer exactly what they answered before the
stop.

### 5.3 The audit sequence across each restart of the journey

```
[w53] across restart 1: last row before the stop 108 SUMMARY_ACKNOWLEDGED (OPR-001, +35.00 s); the start wrote 109 TABLET_LINK_CHANGED (no actor, +126.35 s); first row of the next command 110 EVIDENCE_VERIFIED (OPR-002, +126.35 s)
[w53] across restarts 2 and 3: last row before the second stop 111 PAIRING_SUCCESS (no actor, +126.35 s); the two starts wrote nothing; first row of the next command 112 ACCESS_DENIED (OPR-003, +306.35 s)
[w53] restart 4: stop at +306.35 s (last committed instant +306.35 s), start at +396.35 s; epoch 4 -> 5; no backend of dems_app left after 0 poll(s), 0 ms; last row before the stop: 114 DEVICE_REVOKED (OPR-002, +306.35 s); rows the start wrote: none
```

Each row links to its predecessor by `prevHash` (asserted row by row at the three seams, and by
`linkProblems` and the shared `verifyAuditChain` over all rows after every restart).
`GET /api/v1/audit/chain` in the second process: `view` ok and `stored` ok, both through row 109,
with the head the audit list reports.

### 5.4 What else the journey shows

| Point | Evidence |
|---|---|
| Two restarts in a row (restarts 2 and 3: the third process only reads) | Stable twice: `core_state` alone moves each time; the stopped database is the same table by table but for the epoch; the epoch of the fourth process is the second's plus 2 |
| The first commands after three restarts | `ACCESS_DENIED` (the guard, role INVESTIGATOR) on the hash of the last row the second process wrote; `createSession` by `OPR-003` with itself as the investigator: 201, so the guard (permissions read from PostgreSQL) and the engine's rehydrated `operators` (ENG-3) both hold the changed role; the session number is the first session's plus 1 |
| Counters | The device counter: the code of before the first stop pairs `DEV-0002` in the second process |
| A session in CREATE at a stop (restart 4) | The same state after the start, no fault (spec §8.6, first line of the table) |
| A revoked tablet (revoked in the fourth process) | In the fifth: listed REVOKED with its reason; its credential answers 403 `DEVICE_REVOKED` with the guard's one row; the paired tablet's credential and the operator's session on it still resolve |
| SR-17, a command with the old session | `touchSession` in the second process: 200, `x-dems-epoch` 2; the one table that moves is `auth_sessions`, and of it only that session's `last_seen_at` |
| SR-17, an ended session | The signed-out cookie answers 401 in the second process; its row keeps `ended_at` and `SIGNED_OUT` |
| SR-17, the limits after four restarts (process 5) | Idle: the INVESTIGATOR's web session, idle since `+35.00 s`, answers 200 one millisecond before `+935.00 s` and 401 at it, with `AUTH_EXPIRED` (`reason: IDLE`) and `IDLE_EXPIRED` stored. Absolute: the SUPERVISOR's session, touched 47 times ten minutes apart, answers 200 one millisecond before `+28800.00 s` and 401 at it, with `AUTH_EXPIRED` (`reason: ABSOLUTE`): 8 hours after its issue in the FIRST process |
| No activity for the time the server was down | After 61 s of the fifth process: no audit row, event or health snapshot is stamped inside any of the four stops; one `INTERVAL` health snapshot, 60 s after THIS start; the snapshot's write instant is this process's |
| At the end | The chain verifies over the rows of five processes; the tables hold the engine's committed state; epochs 1 to 5; no error line in any of the five logs |

## 6. A session in flight at the stop (AC-B-05, AC-B-06; spec §8.6)

Each on a clone of its own: the tablet connected, a session created by the INVESTIGATOR and
armed. The recording runs 10 s, gets a marker and runs 2.45 s more, so that a stop falls between
two seconds of the clock.

### 6.1 RECORDING at the stop

```
[w53] RECORDING at the stop: recording from +5.00 s, stop at +17.45 s, last committed instant +17.00 s; after the start at +107.45 s: FAULT at +17.00 s, 27333333 bytes = recordingBytes(12000 ms), not 233358333; elapsedMs as served 102450 (SIM-GAP-W34-1); after a second restart at +202.45 s: FAULT, the same instant and size, no row
[w53] RECORDING at the stop, recovery: recoverSession 202 RECOVERY: SYSTEM_BOOT (no actor), RECOVERY_STARTED (OPR-002), FAULT_CLEARED (no actor); then SESSION_INCOMPLETE (no actor), RECOVERY_COMPLETED (no actor); history INCOMPLETE 12000 ms 27333333 bytes; evidence EV-20261001-0014 RECORDED, never sealed, 4 tracks; epoch of the fourth process 4
```

| Asserted | Value |
|---|---|
| The rows the start wrote | Exactly `FAULT_RAISED` (no actor, at the last committed instant, CRITICAL, `kind: POWER_FAIL`, `fromState: RECORDING`), then `TABLET_LINK_CHANGED` (no actor, at the start instant) |
| The last committed instant | Read from the stopped database; at or before the stop and less than 1 s before it (a recording is written once a second) |
| What the operator sees (cookie of before the stop) | `getCurrentSession`: FAULT, `fault.at` the last committed instant, no evidence ID |
| The recorded size does not include the stop | `bytesWritten` served and `bytes_written` stored both equal `recordingBytes(last committed − started)`; the difference to the size at the start instant is at least `recordingBytes(90 s)` |
| The fault's other rows | One alert (`POWER_FAIL`, CRITICAL, active, at the last committed instant); one health snapshot (`FAULT_RAISED`, `POWER_FAIL`, session FAULT); no evidence item yet |
| A second restart while in FAULT | The start writes nothing; the same fault instant and size (spec §8.6: "FAULT: nothing; the fault stays") |
| `recoverSession` (operation 33) by the SUPERVISOR, third process | 202 `{ state: RECOVERY }`, `x-dems-epoch` 3; rows exactly `SYSTEM_BOOT` (no actor), `RECOVERY_STARTED` (`OPR-002`), `FAULT_CLEARED` (no actor), at the server clock; 4 s later exactly `SESSION_INCOMPLETE`, `RECOVERY_COMPLETED` (no actor); no open session |
| History | Newest entry INCOMPLETE, `faultKind: POWER_FAIL`, `endedAt` the last committed instant, `durationMs` 12,000, `sizeBytes` that of the last committed instant |
| Evidence | One item, **RECORDED, `sealedAt` null**, 12,000 ms, four tracks, the marker, the custody chain ending in `SESSION_INCOMPLETE` |
| A third restart | The INCOMPLETE entry and the RECORDED item are what the fourth process serves (13 reads equal) |

### 6.2 FINALIZING at the stop, and a stop during the recovery

```
[w53] FINALIZING at the stop: recording +5.00 s to +17.45 s, stop at +19.95 s, last committed instant +19.80 s; after the start at +109.95 s: FAULT at +19.80 s, elapsedMs 12450, 28358333 bytes; recoverSession 202: SYSTEM_BOOT (no actor), RECOVERY_STARTED (OPR-002), FAULT_CLEARED (no actor); stop in RECOVERY at +110.95 s, start at +200.95 s; first tick: 99 SESSION_INCOMPLETE (no actor, +112.95 s), 100 RECOVERY_COMPLETED (no actor, +112.95 s) (the deadline +112.95 s lies inside the stop); history INCOMPLETE 12450 ms; evidence EV-20261001-0014 RECORDED, never sealed
```

| Asserted | Value |
|---|---|
| Before the stop | FINALIZING one second deep, not sealed; no evidence item stored |
| The rows the start wrote | `FAULT_RAISED` (no actor, last committed instant, `fromState: FINALIZING`), `TABLET_LINK_CHANGED` |
| The session after the start | FAULT; `stoppedAt` the instant the recording was stopped; `elapsedMs` and `bytesWritten` those of the stopped recording (12,450 ms), unchanged by the stop of the server; still no evidence item |
| `recoverSession` | 202 RECOVERY and the three rows, as in 6.1 |
| A stop one second into the recovery (spec §8.6: "RECOVERY: the timed transition fires at its scheduled time at the first tick") | The start writes nothing (29 tables equal); the session is in RECOVERY; the FIRST tick writes `SESSION_INCOMPLETE`, `RECOVERY_COMPLETED` (no actor), stamped at the stored deadline (finding W53-F3) |
| History and evidence | INCOMPLETE, 12,450 ms, `endedAt` the instant the recording was stopped; the item RECORDED, never sealed, four tracks |

### 6.3 ARMED at the stop: the "none" case of the evidence

No recording had started. After the start: FAULT (`fromState: ARMED`), `startedAt` null, 0 bytes.
`recoverSession`, the five rows; the history entry is INCOMPLETE with `startedAt` null, 0 ms and
**no evidence ID; no evidence item exists** (the table and `listEvidence`). Spec §8.6: "a RECORDED
(never sealed) evidence item if a recording had started".

## 7. A Core with a long history (the bulk fixture)

A clone of `tpl_bulk`: 5,000 audit rows (the engine's view holds 1,000), 3,649 events, 25 discarded
chains in the lineage, 300 sessions, 83 biometric tokens.

```
[w53] long history: 5003 audit rows stored, 1000 in the engine's view, 25 discarded chains in the lineage; epochs 67 -> 69; the command between the restarts wrote row 5003 on the hash of row 5002
```

Two restarts with a command between them (`setStoragePolicy` in the rehydrated process): every
table stable twice (29 of 30 equal each time), all 13 reads equal twice, the row of the command is
the stored head plus 1 on the stored hash, `verifyAuditChain` answers `view` ok over 1,000 rows and
`stored` ok through row 5,003 with the same head, `lineageTotal` equals the stored 25, and the
tables hold the engine's committed state.

## 8. The control: the comparison is not blind

On a clone of its own: after the stop, one row is changed as `dems_owner`
(`storage_policy.retention_days + 1`). The comparison reports exactly `core_state` and
`storage_policy` as moved, and the started server serves the changed value through
`getStorageDetail`: what it serves is what PostgreSQL holds, not what a process remembered.

## 9. Verification

### 9.1 The row command (17:32:16; `assets/06_row_command.log`)

`DEMS_TEST_STEP=75 npm run test:db -w @dems/core-server -- test/acceptance`

```
> vitest run --project db test/acceptance
 RUN  v5.0.3 /Users/gsp-budi/Documents/DEMS/apps/core-server
[test:db] PostgreSQL 18.4 on 127.0.0.1:4432; helper role dems_owner, code under test dems_app; run prefix dems_test_step_75_tmdp9sg8_
[test:db] stale sweep: dropped 0; kept 6 of younger runs, 0 of live runs, 0 unrecognised; 0 failed
[test:db] template dems_test_step_75_tmdp9sg8_tpl_schema: built in 77 ms (create 28 ms, hook 47 ms)
[test:db] template dems_test_step_75_tmdp9sg8_tpl_seed: built in 124 ms (create 44 ms, hook 80 ms)
[test:db] bulk fixture: every minimum of the 30 tables is met; audit head seq 5000, hash 26e251887c667e1e...; digest e58f1ae233811851...; build 135 ms, write 1078 ms, total 1216 ms
 Test Files  1 passed (1)
      Tests  16 passed (16)
   Start at  17:32:16
   Duration  5.81s (tests 85%, transform 9%, import 5%)
[test:db] forced drops that needed a retry: 0
[test:db] teardown: dropped 3 database(s) in 88 ms; 0 remain with the run prefix dems_test_step_75_tmdp9sg8_
```

(The 32 lines of the bulk fixture's own table are left out here; they are in the asset.) The verbose
run of 17:32:22 with every printed line of the tests: `assets/06_row_command_verbose.log`
(16 pass marks, exit 0).

### 9.2 The 16 tests

| # | Block | Test | Requirement |
|--:|---|---|---|
| 1 | journey | the journey before the first stop | set-up of AC-B-04 |
| 2 | journey | restart 1 (the tablet was connected): every table equal except what the start writes; the epoch | AC-B-04, SC2 |
| 3 | journey | what the restarted server serves through the routes | AC-B-04, SC2 |
| 4 | journey | SR-17: the session of before the stop works without a sign-in; a signed-out session stays ended | SR-17 |
| 5 | journey | the first commands of the restarted process: the evidence verifies; the chain goes on; the code pairs a second tablet | AC-B-04, §8.6 "Restored" |
| 6 | journey | restarts 2 and 3, one straight after the other | AC-B-04 twice in a row |
| 7 | journey | the first commands after three restarts: the chain, the role, the tablets, a revocation | AC-B-04, ENG-3 |
| 8 | journey | restart 4, with a session in CREATE; a revoked tablet stays revoked | AC-B-04, §8.6 line "CREATE" |
| 9 | journey | no activity is invented for the time the server was down | §8.6 "Not generated" |
| 10 | journey | SR-17: the idle and the absolute limit still apply | SR-17, SR-11 |
| 11 | journey | at the end: the chain, the tables, the logs | SC2 |
| 12 | in flight | AC-B-05: RECORDING at the stop | AC-B-05 |
| 13 | in flight | AC-B-06: FINALIZING at the stop, then a stop during the recovery | AC-B-06, §8.6 line "RECOVERY" |
| 14 | in flight | ARMED at the stop: no evidence item | §8.6 |
| 15 | control | a row changed in the stopped database is reported and served | the instrument |
| 16 | long history | two restarts on the bulk fixture | AC-B-04 on volume |

### 9.3 Typecheck and lint

| Time | Command | Result |
|---|---|---|
| 17:24:31 | `npm run typecheck -w @dems/core-server` | exit 0 |
| 17:24:31 | `npm run lint -w @dems/core-server` | exit 0; one warning, in a file of another row: `src/db/fixtures/__tests__/audit-details.test.ts:34:3` (an unused import). None in this row's file |
| 17:15:27 | the same two, before the last refinement of the file | exit 0, exit 0, no warning |

Section 13 has the runs at the end of the row.

### 9.4 The whole `db` project

`DEMS_TEST_STEP=75 npm run test:db -w @dems/core-server -- --maxWorkers=2`, with the test file in
its final state. Section 13 has the result.

## 10. Can the test fail? Mutations of the test's INPUT

No production file and no file of the tree was changed (rule M15). The harness is the one of the
identity and administration rows: a Vitest configuration in the temp directory that is the
workspace's own configuration plus one load-time transform, here of THIS row's test file
(`assets/06_mutation_harness.vitest.config.mjs.txt`, `06_mutation_harness.run.sh.txt`,
`06_mutations.json`). Each mutation changes what the test does to the system or to its database:
a row changed as `dems_owner` between the stop and the start, a step left out, another cookie, a
longer stop.

Run of 17:32:36 to 17:33:52 (`assets/06_mutations.log`); SHA-256 of the test file before and after:
`24124795…1237d52f`.

| ID | Mutation of the input | Result | First failing assertion |
|---|---|---|---|
| — | none (the file through the harness) | 16 of 16 pass | — |
| M1 | a row is changed in the stopped database (`storage_policy.retention_days − 1`) | 14 fail | `restart 1: the tables that differ after the start`: `storage_policy` is in the list |
| M3 | the stored epoch is changed in the stopped database (`+ 5`) | 14 fail | `restart 1: the epoch of the new process: expected 7 to be 2` |
| M7 | the last-seen instant of every session is changed in the stopped database | 14 fail | `the tables that differ after the start`: `auth_sessions` is in the list |
| M10 | the role of `OPR-003` is set back in the stopped database | 10 fail | `restart 1: the tables that differ after the start`: `operators` is in the list |
| M9 | the SUPERVISOR changes the policy again after the reads were taken | 2 fail | what the restarted server serves: the answer differs from the one before the stop |
| M5 | the cookie presented after the restart is the signed-out one | 1 fails | `getAuthSession: expected 401 to be 200` |
| M6 | the server is down 16 minutes, not 90 seconds (past the idle limit) | 14 fail | `getAuthSession: expected 401 to be 200` |
| M4 | RECORDING: the recording is stopped and sealed before the stop, so nothing is in flight | 1 fails | `RECORDING at the stop: the tables that differ after the start` (no fault was raised) |
| M2a | RECORDING: the `recoverSession` call is left out | 1 fails | `expected 'FAULT' to be 'RECOVERY'` |
| M2b | ARMED: the `recoverSession` call and the three assertions before the history entry are left out | 1 fails | the INCOMPLETE assertion: the newest history entry is the seeded `SES-20261001-0023`, not the session |
| M8 | FINALIZING: the tablet reconnects during the recovery, so the link is CONNECTED at the second stop | 1 fails | `RECOVERY at the stop: the tables that differ after the start`: the start wrote a row |

**11 of 11 detected.** Every run left 0 databases with its prefix.

## 11. Findings

Severity is this row's proposal; the controller rules.

| ID | Severity | Finding |
|---|---|---|
| W53-F1 | **Medium (security)** | **After a start whose server clock is behind the issue instant of an open session, nothing can end that session: every operation that tries answers 500 and changes nothing.** `signOut` 500 (the session keeps answering 200); `disableUser` 500 (the operator stays enabled, the session open); `revokeDevice` 500 (the device stays PAIRED, the operator's session on it keeps working); `signIn` that presents the open session (rotation, ID-6) 500. Cause: the end is stamped with the server clock, and `auth_sessions_times_check` (`ended_at >= issued_at`) refuses it: SQLSTATE 23514 at `src/modules/identity/session-store.ts:205`, `:219`, `:223`; no audit row is stored. It lasts until the clock has passed the issue instant; the same session's idle limit is put off by as much. The identity row's finding F-14 predicted the CHECK from reading it and expected 503; measured, it is 500, on four operations of three modules |
| W53-F2 | **Medium (audit trail)** | **After such a start, a row of a server-native module is stamped BEFORE its predecessor, while a row of a hosted action in the same process is stamped at the instant the engine holds.** The engine holds its own clock at the last committed instant (`ENGINE_CLOCK_BEHIND`, engine row choice 9); `app.clock`, which the identity, pairing, administration and guard rows stamp with, is not held. Measured: rows 89, 90, 91 at `+600 s`, `+490 s`, `+610 s`. The hash chain verifies; `at` is not non-decreasing in sequence order, which the core row states as a property (`implementation/21_core_services.md` §"Monotonic `at`": "the clock never moves backwards"). Spec ENG-14 says the same of the clock; it holds within a process, not across a start |
| W53-F3 | Low (by the specification) | **A recovery that was under way at a stop is completed with rows stamped at the stored deadline, an instant at which the server was down** (section 6.2: stop `+110.95 s`, start `+200.95 s`, rows at `+112.95 s`). Spec §8.6 asks for exactly that ("fires at its scheduled time at the first tick") and in the same table says that no activity is invented for the time the server was down. And the instant depends on something unrelated: when the start itself writes a row first (a tablet was connected at that stop), the same two rows are stamped at the start instant, because a row is never stamped before its predecessor (mutation M8; exploration run of 16:56) |
| W53-F4 | Info | AC-B-05 names four recovery rows; the server writes five: `FAULT_CLEARED` too, as the table of spec §8.6 lists them. The test asserts the five, in order, with their actors |
| W53-F5 | Info (known: `SIM-GAP-W34-1`, decision D94 DN-5) | `elapsedMs` of a session faulted while RECORDING counts the stop: 102,450 ms served for a recording of 12,000 ms (section 6.1). Printed, not asserted. A session faulted in FINALIZING has a stop instant and is served right (12,450 ms) |
| W53-F6 | Info | One restart fault carries three instants: the audit row and the alert the last committed instant; the health snapshot row and `active_session.updated_at` the start instant. Consistent with the specification (the snapshot is taken when the server is up) |
| W53-F7 | Info | A clean stop wrote nothing in all twelve stops of the final run: between two seconds of the clock the engine holds no unwritten change. The restart fault of a recording is therefore stamped up to one second before the stop (450 ms and 150 ms here). By design (decision D28 D-1) |
| W53-F8 | Noise (P11) | One red in the whole `db` run of 17:25, in the helper row's file, a 5 s time-out; green alone at 17:29 (section 13) |
| W53-F9 | Noise (P11) | One lint warning in a file of the bulk fixture's follow-up (section 9.3) |

No `CONTRACT-GAP`, `SCHEMA-GAP` or `SIM-GAP` of this row's own.

### 11.1 Minimal reproduction of W53-F1 and W53-F2

`assets/06_repro_clock_behind.ts.txt` (56 lines; it prints, it asserts nothing about the
findings), appended to the test file at load time by the scratch configuration, so that it uses
the file's helpers and no file of the tree changes:

```
W53_APPEND=<the file> DEMS_TEST_STEP=75 npm exec -w @dems/core-server -- vitest run \
  --config <scratch>/harness.vitest.config.mjs --project db test/acceptance -t "repro W53-F1"
```

The steps, on a clone of the seed, every request through `app.inject`:

1. Boot at the seed instant; move the clock 10 minutes; sign in the three operators on the web
   console; pair a tablet and sign the INVESTIGATOR in on it; 10 s later close the app.
2. Start a new app on the same database with its clock **two minutes before the stop** (110 s
   before those sign-ins).
3. `POST /api/v1/auth/sign-out` (INVESTIGATOR); `POST /api/v1/admin/users/OPR-003/disable`
   (SUPERVISOR); `POST /api/v1/pairing/devices/DEV-0001/revoke` (SUPERVISOR);
   `POST /api/v1/auth/sign-in` with the SUPERVISOR's cookie attached.
4. A new sign-in of `OPR-003`, then `setStoragePolicy` by the SUPERVISOR.

Run of 17:31:51 (`assets/06_repro_clock_behind.log`):

```
[repro] sessions issued at +600.00 s, stop at +610.00 s, start at +490.00 s; warning of the engine: 1 x ENGINE_CLOCK_BEHIND
[repro] F1 signOut: 500 INTERNAL_ERROR; log: "unexpected error while handling a request", SQLSTATE 23514, at endSession (src/modules/identity/session-store.ts:205); the session afterwards: getAuthSession 200
[repro] F1 disableUser: 500 INTERNAL_ERROR; log: "unexpected error while handling a request", SQLSTATE 23514, at endSessionsOfOperator (src/modules/identity/session-store.ts:219); the operator afterwards: enabled true, getAuthSession 200
[repro] F1 revokeDevice: 500 INTERNAL_ERROR; log: "unexpected error while handling a request", SQLSTATE 23514, at endSessionsOfDevice (src/modules/identity/session-store.ts:223); the device afterwards: PAIRED, its operator session: getCurrentSession 200
[repro] F1 signIn that presents the open session (rotation, ID-6): 500; log: "unexpected error while handling a request", SQLSTATE 23514, at endSession (src/modules/identity/session-store.ts:205)
[repro] F1 rows stored by the four requests: none
[repro] F2 a new sign-in 200, then setStoragePolicy 200: 89 AUTH_SUCCESS (OPR-001, +600.00 s), 90 AUTH_SUCCESS (OPR-003, +490.00 s), 91 STORAGE_POLICY_CHANGED (OPR-002, +610.00 s)
[repro] F2 rows stamped before their predecessor: 90 AUTH_SUCCESS (OPR-003, +490.00 s); the chain: {"ok":true,"checked":91,"head":"ac6b8227e9ef99a6565d279349b7f829f656b790e4c702a3e0398bab30224b60"}
[repro] F1 signOut once the clock is past the stop instant: 204
```

**When it can happen.** Only across a start: within a process the clock never moves backwards
(ENG-14). The wall clock must have been set back between the stop and the start by more than the
time since the session was issued plus the time the server was down: a correction of a clock that
ran ahead, a restored machine image, a clock battery. On the one demo computer that is unlikely;
on a Core appliance it is an ordinary time fault. **Not established:** whether a real backward
step of the host's clock reaches the server as it does here through the seam `clock` (hypothesis:
yes, `app.clock` is the wall clock; not run).

**What would close both** (not this row's to do): at a start, hold the SERVER clock at or above
the last committed instant, as the engine already holds its own, so that every writer of the
process stamps from one time base. A narrower cure for F1 alone is to stamp the end of a session
with the later of the clock and its issue instant.

## 12. What this test does NOT cover

| Not covered | Why, and where it is or could be covered |
|---|---|
| A kill without a clean stop (the process dies, `app.close()` never runs) | The engine row's `restart.db.test.ts` proves the engine half (the fault is stamped at the last write the tables hold). Not repeated through the routes |
| A PostgreSQL restart, or a database that goes away under a running server | Only W89 stops the instance (P15). The connection-loss path is the core row's (`connection-lost.db.test.ts`) |
| A listening server on a port: SIGINT or SIGTERM in `index.ts`, sockets closed with 1001, the snapshot every operator socket gets in the new epoch (RT-7), the two sweepers (they run only while the server listens) | This row binds no port (P18). The gate W58, the realtime row W42 and the end-to-end rows |
| A real device socket setting the tablet link | `app.engine.setTabletLink` is called by the test, as the channel will |
| PRECHECK and STOPPING at the stop | The same rule as ARMED, RECORDING and FINALIZING in the engine (`FAULTABLE_STATES`); not run here |
| A diagnostics run or a software update in flight at the stop; an alert acknowledged; console settings changed | Their modules (system, alerts) were in flight during this row. Their tables are in every checksum comparison, unchanged |
| An active demo fault at the stop (`AUDIT_TAMPER` is cleared at a start, spec §12.3); a restart around a demo reset | The demo-control row; the engine row's reset test |
| Biometric tokens through their routes | The biometric row was in flight. `biometric_tokens` is compared in every restart: empty in the journey, 83 rows in the long-history test |
| The lockout, throttle and denial-budget counters, which are fresh after a start (SR-25) | Accepted residual R-10; not asserted |
| A start with the server clock behind the stored state | Not in the suite: findings W53-F1 and W53-F2 need a ruling first. The reproduction is an asset |
| A request that is in flight at the moment of the stop | Every request of the test has been answered before the close |
| Two processes on one database | The specification gives each instance its own (P14) |

## 13. End of the row: whole project, typecheck, lint, cleanup

The test file was last written at 17:24:28 (SHA-256 `24124795…1237d52f`); every run below is of
that state.

| Time | Command | Result |
|---|---|---|
| 17:25:18 to 17:28:34 | `DEMS_TEST_STEP=75 npm run test:db -w @dems/core-server -- --maxWorkers=2` | **Exit 1: 108 files, 107 passed, 1 failed; 1,541 tests, 1,539 passed, 1 failed, 1 skipped**; 195.75 s; 0 databases left. The one failure is in a file of the test helper's row (W11): `test/helpers/db/__tests__/templates.db.test.ts` > "a template build that fails leaves nothing behind" > "a template nobody plugged a hook in for is "not available", with the file to add": `Error: Test timed out in 5000ms.` The 1-minute load average was 7.76 at the start (`assets/06_whole_db_1725.log`) |
| 17:29:05 | that file alone | 12 of 12 pass, 3.82 s (load average 8.39): noise by P11 (finding W53-F8) |
| 17:35:49 to 17:37:31 | the whole `db` project again | **Exit 0: 108 files passed; 1,541 tests, 1,540 passed, 1 skipped**; 101.27 s; 0 forced drops retried; 0 databases left (`assets/06_whole_db_1735.log`). The skipped test is not this row's: its file has no skipped, focused or pending test |
| 17:39:35 | `npm run typecheck -w @dems/core-server` | exit 0 |
| 17:39:40 | `npm run lint -w @dems/core-server` | exit 0, no warning (the warning of 17:24 in the other row's file is gone) |

End state at 17:39:48 (the scratch script `assets/06_end_state.mts.txt`, as `dems_owner`, names
and counts only):

```
session: role=dems_owner server=18.4 port=4432 postmaster started 2026-10-04 07:14:26.046351+07
databases with this row's prefix (dems_test_step_75_*): 0
test databases of all rows at this moment: 6
project databases: dems_demo, dems_lane_1, dems_lane_2, dems_lane_3
sessions on this row's databases still open: 0
```

| Check | Result |
|---|---|
| PostgreSQL | `.locks/postgres.pid` is 19121; process 19121 is the project's `postgres`, started 07:14:26. This row never stopped, started or configured it |
| Databases | Only clones the helper made under the prefix `dems_test_step_75_`; none remains. `dems_demo` and the lanes were never named. Port 5432 was never used; nothing connected as `dems_admin` |
| Ports | None bound: every request is `app.inject` |
| Processes | Every command ran in the foreground and ended, except the second whole run, which ran in the background and ended with exit 0 at 17:37:31 |
| The tree | New: `apps/core-server/test/acceptance/restart.test.ts` and the documents of this row. Nothing else written |
| Scratch files | The harness, the reproduction and the logs lived in the temp directory; the ones that are evidence are copied into `test/assets/`, the folder is removed |

## 14. Assets (`docs/…/test/assets/`)

| File | What |
|---|---|
| `06_row_command.log` | The row command, 17:32:16 |
| `06_row_command_verbose.log` | The same with the verbose reporter, 17:32:22: every table of every restart, every printed line |
| `06_mutations.json`, `06_mutation_harness.vitest.config.mjs.txt`, `06_mutation_harness.run.sh.txt` | The eleven mutations of the test's input and the scratch harness |
| `06_mutations.log` | The mutation run of 17:32:36 |
| `06_repro_clock_behind.ts.txt`, `06_repro_clock_behind.log` | The reproduction of W53-F1 and W53-F2 and its run of 17:31:51 |
| `06_whole_db_1725.log`, `06_whole_db_1735.log` | The whole `db` project, 17:25:18 (one time-out in the helper row's file) and 17:35:49 (exit 0) |
| `06_end_state.mts.txt` | The scratch script that lists what is left in the instance (names and counts, as `dems_owner`) |

## 15. Requirement to test

| Requirement | Statement | Tests (section 9.2) | Result |
|---|---|---|---|
| SC2 | "state survives a restart" (the other clauses of SC2, start command, migrations, seed, are other rows') | 2, 3, 5, 6, 7, 8, 11, 16 | Pass |
| AC-B-04 | After a policy change, a sealed session, a role change and a paired device, every stored entity of §3.3 is equal before and after; checksums per table | 2 (the comparison), 3 (through the routes), 5, 6, 7, 8 (repeated), 15 (the control), 16 (volume) | Pass: 30 of 30 tables compared in every restart; what differs is what the start wrote, named |
| AC-B-05 | RECORDING at stop: FAULT after the restart with a `FAULT_RAISED` row; `recoverSession` leads to an INCOMPLETE history entry and a RECORDED evidence item, with `SYSTEM_BOOT`, `RECOVERY_STARTED`, `SESSION_INCOMPLETE`, `RECOVERY_COMPLETED` rows | 12 | Pass (five rows: W53-F4) |
| AC-B-06 | The same for FINALIZING | 13 | Pass |
| SR-17 | Sessions survive a server restart; ended sessions keep their end reason | 4, 10; and 3, 6, 7, 8, 12, 13, 16, which all call with cookies of before a stop | Pass |
| Spec §8.6 "Restored" | Operators, grants, sessions, paired devices and credentials, an ACTIVE pairing code with its expiry and attempt count, the audit chain, events, the active session, history, evidence, policy, counters, the lineage | 3, 5, 7, 8, 16 | Pass for what the routes of the landed modules show; section 12 for the rest |
| Spec §8.6 "Fresh": the epoch | The stored epoch plus 1 at every start (D14) | every restart (the helper), 4 (the header), 11 | Pass |
| Spec §8.6 "Recomputed": the tablet link | OFFLINE after a start, with the truthful row when it was CONNECTED | 2 | Pass |
| Spec §8.6 "Not generated" | No activity for the time the server was down | 9, 12 (the size) | Pass; W53-F3 for a recovery deadline |
| Spec §8.6, the table of states | none or SEALED: 2, 6; CREATE: 8; ARMED: 14; RECORDING: 12; FINALIZING: 13; FAULT: 12; RECOVERY: 13 | | Pass; PRECHECK and STOPPING not run |

## 16. Test ledger (P24)

| Project | Before this row (the brief's baseline, 16:34) | This row | Whole run of 17:25 |
|---|---|---|---|
| `db` | 105 files, 1,513 tests | **+1 file, +16 tests**: `test/acceptance/restart.test.ts` | 108 files, 1,541 tests at 17:25 and at 17:35 (the other 2 files and 12 tests are other rows') |
| `unit` | 134 files, 3,503 tests | none: the file is in the `db` project only | not run by this row |

## 17. Deviations from the row text

| ID | Deviation | Reason |
|---|---|---|
| DV-1 | The journey has four restarts, not two | Restart 1 with a connected tablet (the start writes a row); restarts 2 and 3 straight after each other with only reads between (the row's "two in a row"); restart 4 after commands of a rehydrated process and with a session in CREATE |
| DV-2 | Three tests more than the row names: ARMED at the stop, the long history, the control | The "none" case of the evidence (the brief: "read it, do not assume"); the ring smaller than the table; the question "can it fail" as a permanent test |
| DV-3 | `pairDevice` is not called; `portalPost` and `redeem`, which it is made of, are | Its parameter is the pairing row's `PairingApp` |
| DV-4 | The file builds its app itself instead of `engineApp` or `sessionsApp` | Those replace the seam `publish`; the brief asks that nothing be replaced |
| DV-5 | The checksum of four tables and of the "untouched parts" is this file's own statement | No exported helper covers them (section 3.4) |
| DV-6 | Between 16:53 and 17:10 the row's file held exploration drafts (what moves at a start, what the rows are); the acceptance test replaced them at 17:10 | The row's own write path; no other file was written |
| DV-7 | `masterplan/02_plan.md`, `status_tasks.md`, `implementation/99_implementation_report.md` and `test/01_test_report.md` were not written | Parallel run: the controller writes the shared files (P8). This document and the progress file are the row's report |
| DV-8 | Process notes: several read-only commands at the start began with `cd` into the workspace root itself, and one read-only search of this row's own log copies (17:34) began with `cd` into the scratch folder under the temp directory. No command changed into a subfolder of the workspace | — |

## 18. Decisions for the controller

| ID | Question | This row's proposal |
|---|---|---|
| DN-1 | W53-F1, W53-F2: a start with the clock behind the stored state | Rule on the severity and route it to the owner of the core clock and of the identity module: one time base per process, held at or above the last committed instant at a start (section 11.1). Until then a recorded residual: on one demo computer the precondition is unlikely. Whether the reproduction becomes a test of that fix row is the controller's call; it is ready as an asset |
| DN-2 | W53-F3: the completion rows of a recovery that was under way at a stop | Accept as specified, or have a timed transition whose deadline lies inside a stop stamped at the start instant. Today the instant depends on whether the start wrote a row first |
| DN-3 | W53-F4: AC-B-05 names four rows, §8.6 five | Correct the wording of AC-B-05 at the close-out; the test asserts the five |
| DN-4 | The exact lists of section 4.2 are assertions of this file | Accept. A later row that makes a start write something else (the realtime channel setting the link at a stop, a new table) changes `moversOf` in this file by design; it is the place where "what may move at a start" is written down |
| DN-5 | DV-1, DV-2: more restarts and three more tests than the row text | Accept |
| DN-6 | For the gate W58 and the clean-state row W90 | A restart with a tablet connected at the stop adds one `TABLET_LINK_CHANGED` row and one event; a restart with a session in flight adds `FAULT_RAISED`, an alert and a health snapshot; every other restart changes `core_state` only |
| DN-7 | The time-out of `test/helpers/db/__tests__/templates.db.test.ts` in a two-worker whole run (W53-F8) | The helper row's owner: the test waits for the clone lock with Vitest's default of 5 s while another file builds `tpl_bulk` under that lock (about 3 s at that load). A cap as in the other database files would end it |

---
*Generated: 2026-10-04 17:41 WIB*
