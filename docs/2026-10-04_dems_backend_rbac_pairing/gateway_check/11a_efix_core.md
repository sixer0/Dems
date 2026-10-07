---
task_id: 2026-10-04_dems_backend_rbac_pairing
row: E-fix FX-C (core + shared engine)
date: 2026-10-06
agent: coder-execution
status: complete
rulings: D201 R1 (custody actor), R4 (Paired Devices live)
defects: E2E-W1-1 = E2E-T-3 (High), E2E-S-2 (Medium), E2E-T-5 (Low)
narrative_tier: 2
---

# 11a — E-fix FX-C: custody actor, live Paired Devices, note label by role

Three defects from the end-to-end round, fixed in the shared session engine (`packages/shared/src/sim`),
the shared English copy (`i18n/en/session.ts`, `common.ts`), the Core server (`apps/core-server`), and
one title line in each session timeline (web, mobile). Every fix has tests that fail on the old code and
pass now (§1.4, §2.4, §3.4 hold the mutation runs). The live stack was not touched: no server, Vite,
Metro, emulator or browser was stopped, started or driven, and no live database (`dems_demo`,
`dems_lane_1/2/3`) was opened. The database tests ran only on the repository's own `dems_test_*`
helper clones on 127.0.0.1:4432 (outside the command sandbox, which refuses local TCP with EPERM).

**What the controller must do before the restart:** nothing extra. No migration, no schema version, no
contract revision, no OpenAPI change (the regenerated `openapi.json` is byte-identical to the one before
this row, sha256 `f6fa3762…a2efd83`). Restarting the four Core servers picks up the fix.

---

## 1. E2E-W1-1 / E2E-T-3 (High, ruling R1) — the custody named the creator, not who stopped

### 1.1 Root cause

`packages/shared/src/sim/session-machine.ts:840-841` (before this row) built the sealed item's custody
with `actorId: session.createdBy` for **both** `RECORDING_STARTED` and `RECORDING_STOPPED`, and
`finishIncomplete` (line 1021 before) did the same for the INCOMPLETE item's `RECORDING_STARTED`. The
transitions themselves were right: `startRecordingTransition` and `stopRecordingTransition` write the
acting operator (`requireSessionOperator`) into their audit rows. So a SUPERVISOR's stop of an
INVESTIGATOR's session gave audit `RECORDING_STOPPED actorId OPR-002` and custody `OPR-001` — two server
records disagreeing (E2E-T-3), the second of them sealed evidence.

### 1.2 The change

`session-machine.ts:841` adds `recordingActor(state, session, 'START' | 'STOP')`: the actor of the
session's **own audit row of that transition** (`RECORDING_STARTED` / `RECORDING_STOPPED` with the same
`sessionId`), newest first; the creator only when that row has left the 1,000-row audit ring. The
custody uses it at `:870`, `:871` (seal) and `:1051` (INCOMPLETE item). Automatic paths follow their audit
rows as the brief asked: `SESSION_INCOMPLETE` stays `actorId: null` exactly as its audit row (no actor);
a fault, a storage stop or a revoke never produces a `RECORDING_STOPPED` (they go through `enterFault`),
and the demo scenarios stop through `stopRecordingTransition` with their own operator, so their custody
equals their audit row too.

**Why not a member on the session (deviation from the brief's suggested mechanism, recorded as decision
FXC-1).** I first implemented `startedBy` / `stoppedBy` on `ActiveSession` (plus the replicated schema and
OpenAPI). The Core then failed 22 unit tests: the Core stores the session as the columns of
`active_session`, and its lossless invariant refuses a member without a column —
`src/db/mapping/__tests__/round-trip.test.ts:50` (`fromRows(toRows(state))` must `toStrictEqual` the
durable slices) and `to-rows.test.ts:80` ("the slice session reaches the rows: a state that differs only
there maps to other rows"). A column means migration 0004 + schema version 2 + a revision of the database
contract `masterplan/03_database_contract.md` (its counts "302 columns; 25 foreign keys" are asserted by
`test/db/contract-inventory.test.ts:41-56`) + `db:migrate` on the four live databases before the restart
(boot check B-3 refuses otherwise). The contract document is outside this row's paths, so I reverted the
member, the schema and the OpenAPI (all three byte-identical to before) and took the audit row as the
source. That is what ruling R1 asks ("the stop is attributed to the operator who stopped", "follow the
audit row"), and the audit is already durable on the Core: `audit_log` is append-only and a reload (boot,
reset, resync) restores its newest 1,000 rows into the engine's ring.

**Persistence through the Core (checked by reading, and by the full db suite).** The custody list is
computed by the engine at the seal and stored row by row (`src/db/mapping/rows.ts:438-452`,
`evidence_custody.actor_id = entry.actorId`); nothing else of the Core writes `RECORDING_*` custody. A
process start faults a STOPPING or FINALIZING session to INCOMPLETE (`engine/rehydrate.ts:300-326`, plan
row W26 §7), so a sealed `RECORDING_STOPPED` is always written by the engine that saw the stop or by one
that reloaded its audit row; a reset or resync reload keeps the ring.

**Clients (checked by reading, no change needed):** web `apps/core-web/src/features/evidence/integrity-tab.tsx:309,324`
renders `row.item.custody` with `nameOf(entry.actorId)`; mobile
`apps/mobile/src/features/evidence/integrity-tab.tsx:401` renders `entry.actorId` through `operatorNames`.
Both show whatever actor the record holds.

Diff (net, against the rollback copies): `session-machine.ts` +57 −7 (shared with defect 3),
`types.ts` doc only for this defect.

### 1.3 Tests added

`packages/shared/test/session-custody-actor.test.ts` (8 tests), the first describe block:

| Test | Proves |
|---|---|
| INVESTIGATOR starts, SUPERVISOR stops | custody `RECORDING_STARTED OPR-001`, `RECORDING_STOPPED OPR-002`, `SEALED null`; custody actor = audit actor for both; the session shape gains no member |
| SUPERVISOR starts an INVESTIGATOR's session | `RECORDING_STARTED OPR-002` (start actor can differ from creator) |
| one operator throughout | unchanged for the usual session |
| `recordingActor` lookup | own row, newest first; another session's rows never taken; a `null` actor followed as is; creator only when the session's rows left the ring |
| fault, recovery, INCOMPLETE | `RECORDING_STARTED OPR-002`, `SESSION_INCOMPLETE null` = its audit row |

```
$ cd packages/shared && npx vitest run test/session-custody-actor.test.ts --maxWorkers=2
 Test Files  1 passed (1)
      Tests  8 passed (8)
```

### 1.4 Mutation (copies under `.cache/FX-C/mut`, tree untouched; the copies were deleted after)

```
baseline copy: exit 0; Tests  8 passed (8)
M1a custody STOP actor back to createdBy (the defect): KILLED (Tests  2 failed | 6 passed (8))
    × an INVESTIGATOR starts, a SUPERVISOR stops: RECORDING_STOPPED names the SUPERVISOR, as the audit row does
M1b custody START actor back to createdBy (seal): KILLED (Tests  1 failed | 7 passed (8))
M1c INCOMPLETE item START actor back to createdBy: KILLED (Tests  1 failed | 7 passed (8))
M1d audit lookup ignores the session id: KILLED (Tests  1 failed | 7 passed (8))
```

M1a is the old code of `:840-841`: the defect is reproduced by the first test before the fix.

### 1.5 Residual risk

- **Start actor after a long recording.** If more than 1,000 audit rows were written since the start
  (about 2 h of recording at one integrity row per 8 s, sooner on a busy Core) and the session was
  started by someone other than its creator, the `RECORDING_STARTED` entry falls back to the creator, as
  before the fix. The stop is never affected (sealed 5-9 s after its row). Closing this fully needs the
  session columns `started_by` / `stopped_by` — a database contract revision (proposed as FXC-1 follow-up).
- **Already-sealed items keep the old attribution** (immutable, not rewritten): list in §5.

---

## 2. E2E-S-2 (Medium, ruling R4; RESIDUAL-W70-1 family) — Paired Devices did not update live

### 2.1 Root cause

The registry (operation 19) computes `online` from the presence counter and `signedInOperatorId` at read
time (`modules/pairing/store.ts:400-412`); the web refetches it only on `admin.changed DEVICES`. Nothing
published that for the four transitions:

- `realtime/hub.ts:219-224` (`depart`) and `:697-700` (`admit`): a device socket changed the presence
  counter and the tablet link, and published nothing to the portal;
- `modules/identity/sign-in.ts:238-242` (password sign-in), `biometric/sign-in.ts:235-238` (biometric
  sign-in), `sessions.ts` `signOutSession`, `publishExpired`, `endForOperator`, `endBiometricSessions`:
  only `session.ended` (to the session's own sockets), never anything for the device's list.

### 2.2 The change

- `realtime/publication.ts:49` — a new publication kind `{ kind: 'device.session', deviceIds }` (the seam
  allows new kinds); device IDs only, no secret.
- `modules/identity/sessions.ts:154` — `publishDeviceSessions(app, unit, sessions)`: after the commit,
  one `device.session` with the distinct device IDs of the sessions that have one (console sessions
  publish nothing; a unit that rolls back publishes nothing). Called by the password sign-in
  (`sign-in.ts:244`), the biometric sign-in (`biometric/sign-in.ts:239`), the sign-out (`sessions.ts:335`),
  every expiry (`publishExpired`, `:211`: the sweeper and the resolve/touch paths), `endForOperator`
  (`:286`, a disabled user) and `endBiometricSessions` (`:298`, a reused token). Not by `endForDevice`:
  its callers (revoke, unpair) already publish `admin.changed DEVICES` at once.
- `realtime/hub.ts` — `devicesChanged()` (`:455`) is armed by a device socket's admission (`:741`), its
  departure (`:235`) and `device.session` (`:504-505`). `flushDevicesChange` (`:466`), called by the pace
  step (`:783`, every 250 ms), sends ONE `admin.changed DEVICES` through the existing `onAdminChanged`
  (same receivers: OPERATOR sockets holding `PAIRING_MANAGE`) once `devicesChangedDebounceMs` has passed
  without another change, and never later than `tabletLinkDebounceMs` (5 s) after the first change of the
  run. An immediate `admin.changed DEVICES` (revoke, unpair, redeem, rotate) clears what waited (`:473`), so
  a revoke is still one message. The shutdown clears it (`:814`).
- `realtime/limits.ts:96,121,140` — `DEVICES_CHANGED_DEBOUNCE_MS = 1_000` and the limit member
  (exported from `realtime/index.ts`).

**The web already refetches (checked by reading, no web change):** `apps/core-web/src/runtime/query-bridge.ts:52-55,131-132`
invalidates `['core','paired-devices']` and `['core','pairing-code']` on `admin.changed DEVICES`; the
Paired Devices panel (`features/paired-devices/devices-panel.tsx`) and the Devices drawer summary
(`features/devices/device-drawer.tsx:377-378`) read that same query key. Their doc comments still describe
RESIDUAL-W70-1 as open (`devices-panel.tsx:31-35`, `device-drawer.tsx:364-367`): stale comments for FX-W,
not a behaviour problem (the tablet-link refetch they describe stays harmless).

### 2.3 Tests added and adjusted

| File | Kind | What |
|---|---|---|
| `apps/core-server/src/realtime/__tests__/hub.devices-changed.test.ts` (new, 10) | unit, manual clock | admission → 1 message at 1 s, not at 750 ms, only to the PAIRING_MANAGE holder; departure → 1; sign-in + socket 400 ms later → 1; sign-out (close + `device.session`) → 1; two transitions 3 s apart → 2; device flapping every 500 ms for 20 s → 4 messages, gaps ≥ 5 s; revoke (`device.revoked` + immediate `admin.changed`) → 1; web/anonymous sockets → 0; after shutdown → 0 |
| `apps/core-server/src/modules/identity/__tests__/device-session.db.test.ts` (new, 5) | db | publications of device sign-in (web: none), sign-out (web: `session.ended` only), sweeper (device once for 2 sessions), `endForOperator` (none on rollback), `endBiometricSessions` (yes), `endForDevice` (none of its own) |
| `apps/core-server/test/acceptance/devices-live.test.ts` (new, 6) | acceptance, real listener and real sockets | the four transitions of one paired device, each counted: exactly 1 `admin.changed DEVICES` to the supervisor's portal after the debounce, 0 before it and 0 in the 5 s after, 0 to an investigator's console and to the device's sockets; the registry read after each shows the new `online` / `signedInOperatorId` |
| `sessions.db.test.ts`, `biometric/__tests__/engine.db.test.ts`, `enrolment.db.test.ts`, `secrets.db.test.ts`, `pairing/__tests__/secrets.db.test.ts` | db, adjusted | exact publication lists now include `device.session` where a device session begins or ends; the secret scans accept its keys `['deviceIds','kind']` and check every ID is `DEV-NNNN` |

```
$ npx vitest run --project db src/modules/pairing/__tests__/secrets.db.test.ts test/acceptance/devices-live.test.ts \
    src/modules/identity/__tests__/device-session.db.test.ts --maxWorkers=2 --reporter=verbose
[fx-c] admin.changed DEVICES per transition: device socket admitted 1; sign-in + session socket 1; sign-out 1; device socket departed 1
 Test Files  3 passed (3)
      Tests  22 passed (22)
```

### 2.4 Mutation and the pre-fix run

The acceptance test against a copy of the Core with the seven pre-fix files restored from the rollback
copies (the defect as the E2E round saw it):

```
pre-fix exit 1
   × 1. the device's socket is admitted: ONE hint, and the registry says online
   × 2. the operator signs in on the device and the app opens its session socket at once: ONE hint, the Operator column fills
   × 3. the operator signs out on the device (its session socket is closed with 4401): ONE hint, the Operator column empties
   × 4. the device's socket departs: ONE hint, and the registry says offline
   AssertionError: expected { portal: +0, console: +0 } to deeply equal { portal: 1, console: +0 }
```

Mutations (copies; for the db file the copy links the tree's `test/helpers`, so no credential file was
copied or written):

```
baseline copy: exit 0; Tests  10 passed (10)
M2a no hint on a device socket admission: KILLED (2 failed)
M2b no hint on a device socket departure: KILLED (1 failed)
M2c device.session ignored by the hub: KILLED (1 failed)
M2d no debounce (sent at once): KILLED (6 failed)
M2e no 5 s cap (trailing debounce only): KILLED (1 failed: no flood)
M2f an immediate DEVICES hint does not clear the wait: KILLED (7 failed)
baseline copy (db): exit 0; Tests  5 passed (5)
M2g publishDeviceSessions publishes nothing: KILLED (5 failed)
M2h the password sign-in does not publish: KILLED (1 failed)
```

### 2.5 Residual risk

- The update arrives 1 s after the last change (at most 5 s during a burst), not instantly: by design (R4
  "debounced"). The re-test should wait about 1.5 s after a sign-in before reading the Operator column.
- An idle device session that passes its 15-minute limit drops out of `signedInOperatorId` at read time;
  the hint comes when the sweeper (every 5 s on a listening server) ends it, so up to 5 s + 1 s late.
- Out of scope, same family: RESIDUAL-W77-1 (Users & Roles active sessions after a sign-in or sign-out
  elsewhere) still has no `admin.changed USERS`; R4 names DEVICES only.

---

## 3. E2E-T-5 (Low) — a supervisor's note was labelled "Investigator note"

### 3.1 Root cause

- `session-machine.ts:1103` (before): `addNoteTransition` wrote the timeline item with the fixed label
  `'Investigator note'` and params `{ noteId, length }` (no author or role), and the fixed audit/event
  message `'Investigator note added'`.
- `i18n/en/session.ts:215` (before): `timeline.kind.NOTE: 'Investigator Note Added'`, the row title on the
  web (`components/composed/session-timeline.tsx:198`) and on the tablet
  (`features/session-live/session-live-screen.tsx:150`), whoever wrote the note. Hence the tablet's
  "Investigator Note Added · Investigator note · <text>" for OPR-002.
- `i18n/en/common.ts:372,452`: the audit-type and event-type labels `NOTE_ADDED: 'Investigator note added'`.

The note RECORD already names its author (`SessionNote.authorId`), so no record shape changed.

### 3.2 The change

- `session-machine.ts:1145,1159`: the author's role at the time of writing (`findOperatorById(...).role`)
  goes into the timeline item's params as `authorRole` (params is the open flat record `details()`: no
  contract or OpenAPI change; persisted inside the `timeline` JSONB, which round-trips). Label and
  English messages by role through `noteLabel` (`:1122`): "Supervisor note" / "Investigator note" /
  "Technician note"; "Note" when the author is unknown.
- `views.ts:330,342`: `timelineTitleKey(event)` (typed key union) → `session.timeline.noteBy.<ROLE>` for a
  NOTE with `authorRole`, else `session.timeline.kind.<KIND>`.
- `i18n/en/session.ts:216,230`: `kind.NOTE` becomes neutral "Note Added" (older items without a role);
  new `noteBy`: "Supervisor Note Added", "Investigator Note Added", "Technician Note Added".
  `common.ts:372,452`: `NOTE_ADDED` → "Note added".
- The two label lines only: web `session-timeline.tsx:199` `t(timelineTitleKey(event))`; mobile
  `session-live-screen.tsx:151` `t(timelineTitleKey(events.find((event) => event.id === item.id) ?? item))`
  (the mobile row model drops params, so the line reads the source event), plus the import on each.
- `types.ts`: the params doc names `authorRole`.

The web "Session note" drawer title ("Investigator note", `i18n/en/session.ts:166`) was left as it is: not
in the finding; noted for the re-test.

### 3.3 Tests

`session-custody-actor.test.ts`, describe "E2E-T-5" (3 tests): an investigator's then a supervisor's note
→ labels `['Investigator note','Supervisor note']`, params `authorRole` `['INVESTIGATOR','SUPERVISOR']`,
title keys `noteBy.INVESTIGATOR` / `noteBy.SUPERVISOR`, the English titles, authors kept on the records,
audit rows `[OPR-001,'Investigator note added']`, `[OPR-002,'Supervisor note added']`; items without a
role (or an unknown role, or another kind) keep their kind title, `kind.NOTE` is "Note Added", the
type labels are "Note added"; `noteLabel` for each role. Targeted client tests still pass (web
`session-timeline.test.tsx`, `live-session-monitor-actions.test.tsx`, `live-strict-mode-starts.test.tsx`:
33 passed; mobile `session-live.math.test.ts`, `use-core-link-read-only.test.tsx`: 33 passed).

### 3.4 Mutation

```
M3a note item without authorRole: KILLED (Tests  1 failed | 7 passed (8))
M3b note label fixed to "Investigator note" (the defect): KILLED (Tests  1 failed | 7 passed (8))
M3c title key ignores the role: KILLED (Tests  1 failed | 7 passed (8))
```

### 3.5 Residual risk

- No rendering test in the web or mobile suites asserts the role title (those apps belong to FX-W and
  FX-M2; I could edit only the label lines). The line is covered by the shared key function's tests and
  by both apps' typecheck; the re-test round should look at the tablet timeline and the web Session
  Monitor with a supervisor's note.
- Notes written before this row (e.g. lane 2 NOTE-000010) have no `authorRole`: they now read "Note Added"
  (neutral) instead of "Investigator Note Added".

---

## 4. Ledger of suites run (final code)

| Suite | Command | Result |
|---|---|---|
| shared, new file | `npx vitest run test/session-custody-actor.test.ts --maxWorkers=2` | 8 passed |
| shared, whole package | `cd packages/shared && npx vitest run --maxWorkers=2` | 70 files, 1848 tests passed |
| OpenAPI drift | `node --import tsx scripts/gen-openapi.ts --check` | up to date; file byte-identical to before (sha256 `f6fa3762…`) |
| shared typecheck / lint | `npm run typecheck -w @dems/shared`, `npm run lint -w @dems/shared` | exit 0 / exit 0 |
| core unit suite | `cd apps/core-server && npx vitest run --project unit --maxWorkers=2` | 155 files, 3926 tests passed |
| core db suite (whole project, helper clones) | `npx vitest run --project db --maxWorkers=2` | 124 files, 1751 tests passed (196 s; teardown dropped its 8 clones, 0 left) |
| core typecheck / lint | `npm run typecheck -w @dems/core-server`, `npm run lint -w @dems/core-server` | exit 0 / exit 0 |
| web typecheck / lint | `npm run typecheck -w @dems/core-web`, `npm run lint -w @dems/core-web` | exit 0 / exit 0 |
| web targeted tests | `npx vitest run src/components/composed/__tests__/session-timeline.test.tsx src/test/live-session-monitor-actions.test.tsx src/test/live-strict-mode-starts.test.tsx --maxWorkers=2` | 3 files, 33 passed |
| mobile typecheck / lint | `npm run typecheck -w @dems/mobile`, `npm run lint -w @dems/mobile` | exit 0 / exit 0 (0 errors; 2 warnings in `features/rbac/role-gate-r2.test.tsx`, another row's file) |
| mobile targeted tests | `npx jest src/features/session-live/session-live.math.test.ts src/runtime/use-core-link-read-only.test.tsx --maxWorkers=2` | 2 suites, 33 passed |
| mutation, shared | `fxc_mutate.py shared` (copies) | 7/7 killed |
| mutation, hub | `fxc_mutate.py core` (copies) | 6/6 killed |
| mutation, identity (db) | `fxc_mutate.py coredb` (copies, helper clones) | 2/2 killed |
| pre-fix acceptance | acceptance file on a copy with the pre-fix files | 5 of 6 fail (0 hints per transition) |

An earlier full db run (before the last test adjustments) had 1 failure, `pairing/__tests__/secrets.db.test.ts`
(its publication-kind list); adjusted and re-run green (§2.3). Host load stayed under 14 except one
reading of 14.31 during the final db run; no new work was started until it fell.

## 5. Existing evidence items with the old custody attribution

Sealed items are immutable and were NOT rewritten. From the E2E reports and the server logs of this run
(`.cache/manual/lane{1,2,3}-server.log`, `main-server.log`: who created, started and stopped each session),
these items carry a `RECORDING_STOPPED` custody actor that differs from the operator who stopped (their
`RECORDING_STARTED` entries are right: the creator started each of them):

| Database | Session | Evidence | Started by | Stopped by (audit) | Custody `RECORDING_STOPPED` says | Source |
|---|---|---|---|---|---|---|
| dems_lane_3 | demo scenario session | EV-20261006-0014 | OPR-001 (scenario) | OPR-002, audit 236 | OPR-001 | 07a M14, E2E-W1-1; lane3 log 10:23:20 stop by OPR-002 |
| dems_lane_2 | SES-20261006-0025 | EV-20261006-0015 | OPR-001 | OPR-002, audit #170 | OPR-001 | 07d B6/B8, E2E-T-3; lane2 log 10:41:32 |
| dems_lane_2 | SES-20261006-0026 | EV-20261006-0016 | OPR-001 | OPR-002 | OPR-001 (by the old rule) | 07d §152 (R2); lane2 log 10:54:01 start OPR-001, 10:54:41 stop OPR-002 |
| dems_lane_1 | SES-20261006-0031 | EV-20261006-0019 | OPR-002 | OPR-001, audit #388 | OPR-002 (by the old rule) | 07c B1/B2 run 1; lane1 log 10:22:42 / 10:26:40 |
| dems_lane_1 | SES-20261006-0032 | EV-20261006-0020 | OPR-001 | OPR-002, audit #399 | OPR-001 (by the old rule) | 07c B3a/B3b; lane1 log 10:28:20 / 10:28:55 |
| dems_lane_1 | SES-20261006-0033 | EV-20261006-0021 (session→evidence mapping inferred from 07c §150 "EV-…0018 to 0021") | OPR-002 | OPR-001, audit #410 | OPR-002 (by the old rule) | 07c B1/B2 run 2; lane1 log 10:31:47 / 10:32:59 |

`dems_demo` (`main-server.log`): both recordings of the window (09:59, 10:13) were created, started and
stopped by OPR-001, so EV-20261006-0014 and -0015 of `dems_demo` are right. The seeded dataset and the
bulk fixture write custody and audit with one actor and are not affected. The logs cover only this run of
each server; to list every affected item on a database the controller can run this read-only query
(not run by this row: live databases are out of bounds):

```sql
SELECT e.id AS evidence_id, e.session_id, c.action, c.actor_id AS custody_actor, a.actor_id AS audit_actor
FROM evidence_items e
JOIN evidence_custody c ON c.evidence_id = e.id AND c.action IN ('RECORDING_STARTED', 'RECORDING_STOPPED')
JOIN LATERAL (
  SELECT x.actor_id FROM audit_log x
  WHERE x.session_id = e.session_id AND x.type = c.action
  ORDER BY x.seq DESC LIMIT 1
) a ON true
WHERE c.actor_id IS DISTINCT FROM a.actor_id
ORDER BY e.id, c.seq;
```

## 6. Decisions for the controller

| ID | Decision | Why |
|---|---|---|
| FXC-1 | The custody's start/stop actor comes from the session's own audit row, not from new `startedBy`/`stoppedBy` session members. Follow-up (MAJOR, not done): columns `active_session.started_by/stopped_by` with a database contract revision, migration 0004, schema version 2, and `db:migrate` of the four live databases, if the start actor of >2 h sessions started by a non-creator must be exact | the Core's lossless round trip (MR-1) refuses an unstored session member; a column is a contract revision outside FX-C's paths |
| FXC-2 | New publication kind `device.session`; one debounced `admin.changed DEVICES` (1 s quiet, 5 s cap) for device socket admission/departure, device sign-in/sign-out/expiry/disable/token reuse; an immediate DEVICES hint clears the wait | R4; "no flood"; a sign-in and its socket are one change |
| FXC-3 | Note label by the author's role at the time of writing, carried in the timeline item's params (`authorRole`); neutral fallback "Note Added"; type labels "Note added" | E2E-T-5; the note record already names its author; no contract change |

## 7. Files

Created: `packages/shared/test/session-custody-actor.test.ts`,
`apps/core-server/src/realtime/__tests__/hub.devices-changed.test.ts`,
`apps/core-server/src/modules/identity/__tests__/device-session.db.test.ts`,
`apps/core-server/test/acceptance/devices-live.test.ts`, this report,
`delegation_progress/fx_c_core.md`.

Updated: `packages/shared/src/sim/session-machine.ts`, `sim/types.ts`, `sim/views.ts`,
`i18n/en/session.ts`, `i18n/en/common.ts`; `apps/core-server/src/realtime/hub.ts`, `limits.ts`,
`publication.ts`, `index.ts`; `src/modules/identity/sessions.ts`, `sign-in.ts`, `biometric/sign-in.ts`;
tests `identity/__tests__/sessions.db.test.ts`, `biometric/__tests__/engine.db.test.ts`,
`enrolment.db.test.ts`, `secrets.db.test.ts`, `pairing/__tests__/secrets.db.test.ts`;
`apps/core-web/src/components/composed/session-timeline.tsx` (import + 1 line);
`apps/mobile/src/features/session-live/session-live-screen.tsx` (import + 1 line).

Rewritten to identical bytes (no net change): `packages/shared/src/api/state-slices.ts`,
`packages/shared/openapi/openapi.json`.

Rollback copies of every file before its first edit: `.cache/rollback/FX-C/` with `SHA256SUMS`
(`apps/core-server/src/realtime/index.ts` copied from `git show HEAD:` after its one-line edit; the
working tree equalled HEAD before it, noted in the list).
