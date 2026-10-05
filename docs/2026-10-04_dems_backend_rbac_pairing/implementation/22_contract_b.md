---
task_id: 2026-10-04_dems_backend_rbac_pairing
task_slug: dems_backend_rbac_pairing
date: 2026-10-04
agent: coder-execution
blueprint_row: 44
plan_row: W22 (wave B3; contract-owner slot, third holder, P17)
source_plan: /docs/2026-10-04_dems_backend_rbac_pairing/masterplan/02_plan.md
evidence_tier: 3 (mechanical output: statement plus command output)
status: complete (every verification command of the row exits 0; one finding, SIM-GAP-1, needs a ruling: section 10, F-1)
---

# 22 Contract B (blueprint step 44, plan row W22)

Row, verbatim: [W22] Contract B: the 28 slice schemas and the realtime message union (the heartbeat
member stays); `TOKEN_REUSE` is a value of `session.ended.reason`. Writes: the contract paths of
step 41 (`packages/shared/src/api/**`, `packages/shared/openapi/**`,
`packages/shared/scripts/gen-openapi.ts`,
`packages/shared/test/{openapi,schemas,sim-api-validation}.test.ts`,
`packages/shared/test/api-*.test.ts`). Slot: contract owner. Implements AC-B-46 (schema side).
Rollback R-PRE.

**Result: the row is done and its gate is green.** The contract now holds one schema for each of
the 28 replicated slices, the wire form of the streamed `audio` slice, and the union of the nine
messages the Core server sends on `/ws`, with the existing `heartbeat` as one unchanged member, plus
the three client messages. Every slice schema accepts, unchanged, the real simulator's slice, and
its type is the simulator's type, proven at compile time in both directions.

| Field | Value |
|---|---|
| Slice schemas | **28**, one per replicated slice of [SP:§3.2], in state order; plus `AudioSlice` (streamed in `meters`, not one of the 28) and `ReplicatedState` (the `state` of a snapshot: exactly the 28) |
| Message union | **9** server messages (`hello`, `heartbeat`, `snapshot`, `delta`, `meters`, `session.updated`, `session.ended`, `device.revoked`, `admin.changed`) and **3** client messages (`subscribe`, `unsubscribe`, `resync`) |
| `TOKEN_REUSE` | A value of `session.ended.reason`; the six values of [SP:§9.4] and no other |
| The heartbeat member | `Heartbeat` and `HeartbeatSchema`: byte-equal to `acaff20` (section 6.1) |
| The ten existing operations, the offline scope, the committed `openapi.json` | Untouched. `openapi.json`: same bytes as contract A left (sha256 `3d62fa66…21f6b3`) |
| Registry | 37 operations (unchanged); 98 named schemas (50 of contract A, then 37 of the state, then 11 of the socket) |
| Existing assertions edited | **One**: `packages/shared/test/api-registry.test.ts:345` and `:359` as contract A left them (section 9.1) |
| Tests added | **173** in two new files; 40 of 40 single changes detected (section 9) |
| `npm run test -w @dems/shared -- --maxWorkers=2` | exit 0: **977 passed** in 46 files |
| `gen-openapi.ts --check` | exit 0 |
| Typecheck: shared, core-web, mobile, core-server, mock-core | exit 0 (core-server on its second run, P11: section 8) |
| Lint: shared, core-web, mobile | exit 0 |
| `npm run test -w @dems/core-web -- --maxWorkers=2` | exit 0: 438 passed, `scalar-config.test.ts` unchanged |
| Finding that needs a ruling | F-1: the engine can cut a text in the middle of a surrogate pair, so well-formed input leaves ill-formed text in an audit row (section 10) |

Evidence files, all under `implementation/assets/`: `22_gate.log` (the final run),
`22_mutations.log` and `22_mutate.py` (the 40 single changes), `22_changes_to_existing_files.diff`
(what this row changed in files that existed), `22_realtime_tag_all_scope.md` (the generated text
of section 6.3), `22_finding_f1_reproduction.ts` and `22_finding_f1_output.txt` (finding F-1).

Sources are cited as [SP:§n] for `masterplan/01_specs.md`, [CS:…] for
`masterplan/04_client_integration_spec.md`, [PL:…] for `masterplan/02_plan.md`.

---

## 1. Which 28 slices, and why

The simulator's state has 33 slices (`packages/shared/src/sim/types.ts:849-884`). [SP:§3.2] marks
28 of them "Replicated" and says how the other five reach a client; [SP:§7.18] asks for "28 slice
schemas, one per replicated slice of section 3.2". **The specification's list and its count agree**:
33 minus the five below is 28. Nothing had to be reconciled.

| Not replicated | Class in [SP:§3.2] | How a client gets it | Why it is never sent as a slice |
|---|---|---|---|
| `clock` | E | Built on the client from `serverTime` (in `hello` and in every `heartbeat`) | It changes every 100 ms; the client runs its own offset clock [CS:§2.3] |
| `auth` | S (auth sessions) | Per connection, from `AuthSessionInfo` and the control messages | The engine's own `auth` slice is only the actor scope of one command (ENG-2); a session is the caller's own, never another client's |
| `authLockout` | M | Per console, synthesised from `SignInStatus` | "Another console's lockout state" never appears in a message [SP:§9.5] |
| `pairing` | S (devices, pairing codes) | Per device, from `PairingRedeemed` and `DeviceRegistration` | Server-native; the engine's slice is not used; the paired-device list is REST-only behind `PAIRING_MANAGE` [SP:§9.5] |
| `audio` | X (streamed only) | `meters` frames, 20 Hz, after `subscribe` | Never stored, never part of a snapshot |

The contract states this as data: `STATE_SLICE_DELIVERY` classifies all 33 slices (`replicated`,
`streamed`, `client`). A compile-time proof in the test holds its keys equal to `keyof SimState`, so
a 34th slice does not compile until someone classifies it.

The simulator persists 30 of the 33 slices (`SNAPSHOT_KEYS`). The two that persist and do not
replicate are `authLockout` and `pairing`; a test states that relation.

---

## 2. The slice schemas

File: `packages/shared/src/api/state-slices.ts` (new, 904 lines). Each schema is exported, and
`REPLICATED_SLICE_SCHEMAS` maps the slice name to it. The component name is the slice name with a
capital first letter plus `Slice` (`stateSliceSchemaName`).

"Class" is the class of [SP:§3.2]: S stored, SN engine-held and written to the hardware snapshot
row, E engine-held, M server memory, X streamed only. "Strict" means that a member the schema does
not name is refused at that level and at every level below it.

| # | Slice | Schema (component) | Class | Reaches a client as | Strict | Members excluded, and why |
|--:|---|---|---|---|:-:|---|
| 1 | `meta` | `MetaSlice` | S (counters), E (seed, epoch) | replicated | yes | none |
| 2 | `clock` | none | E | built by the client | — | the whole slice (section 1) |
| 3 | `device` | `DeviceSlice` | S | replicated | yes | none |
| 4 | `operators` | `OperatorsSlice` | S | replicated | yes | **Everything but identity and role**: `enabled`, a password hash or salt, `lastSignInAt`, `roleChangedAt`, a session list or count are refused [SP:§3.2 row 4, §9.5]. Seven members stay: `id`, `username`, `rank`, `name`, `displayName`, `initials`, `role` |
| 5 | `auth` | none | S | built by the client | — | the whole slice |
| 6 | `authLockout` | none | M | built by the client | — | the whole slice |
| 7 | `pairing` | none | S | built by the client | — | the whole slice |
| 8 | `tabletLink` | `TabletLinkSlice` | SN | replicated | yes | none |
| 9 | `session` | `SessionSlice` (`ActiveSession` or null) | S | replicated | yes | none |
| 10 | `lastSealedSessionId` | `LastSealedSessionIdSlice` | S | replicated | scalar | none |
| 11 | `lastSealedAcknowledged` | `LastSealedAcknowledgedSlice` | S | replicated | scalar | none |
| 12 | `sessionHistory` | `SessionHistorySlice` (list of `SessionHistoryEntry`) | S | replicated | yes | none |
| 13 | `activeCameraId` | `ActiveCameraIdSlice` | SN | replicated | scalar | none |
| 14 | `cameras` | `CamerasSlice` | SN | replicated | yes | none |
| 15 | `mics` | `MicsSlice` | SN | replicated | yes | none |
| 16 | `audio` | `AudioSlice` | X | `meters` frames only | yes | not in a snapshot, not in a delta |
| 17 | `storage` | `StorageSlice` | SN | replicated | yes | none |
| 18 | `storagePolicy` | `StoragePolicySlice` | S | replicated | yes | none |
| 19 | `time` | `TimeSlice` | SN | replicated | yes | none |
| 20 | `network` | `NetworkSlice` | SN | replicated | yes | none |
| 21 | `security` | `SecuritySlice` | SN | replicated | yes | none. Its `keys` are records of the simulated keys (identifier, algorithm, fingerprint, expiry), never key material; the simulator has none |
| 22 | `services` | `ServicesSlice` | SN | replicated | yes | none |
| 23 | `health` | `HealthSlice` | SN | replicated | yes | none |
| 24 | `otherDevices` | `OtherDevicesSlice` | SN | replicated | yes | none |
| 25 | `ports` | `PortsSlice` | SN | replicated | yes | none |
| 26 | `evidence` | `EvidenceSlice` (list of `EvidenceItem`) | S | replicated | yes | none |
| 27 | `events` | `EventsSlice` (list of `SimEvent`) | S, ring of 500 | replicated ring, then appends | yes; `params` is an open flat map | none by shape; a writer never puts a secret in `params` (SR-54) |
| 28 | `alerts` | `AlertsSlice` (list of `SimAlert`) | S | replicated | yes; `params` open | none |
| 29 | `audit` | `AuditSlice` (rows of `AuditRow`) | S, ring of 1,000 | replicated ring, then appends | yes; `details` is an open flat map | none by shape; `details` never holds a password, a token, a code, a credential or a typed username (SR-54) |
| 30 | `faults` | `FaultsSlice` | SN | replicated | yes | none |
| 31 | `diagnostics` | `DiagnosticsSlice` (a run or null) | SN | replicated | yes; `params` open | none |
| 32 | `update` | `UpdateSlice` | SN | replicated | yes | none |
| 33 | `settings` | `SettingsSlice` | S | replicated | yes | none |

Rules the schemas follow, and the choice behind each:

| Rule | Detail | Source or choice |
|---|---|---|
| The wire form is the simulator's JSON | A schema accepts the slice the shared simulator holds, unchanged. The type of each schema is the simulator's type | API-6; row rule 2 |
| Strict objects everywhere | The specification is silent on unknown members of a slice (API-4 and SR-64 speak of request bodies). Every object of every slice is strict, not only the security-relevant ones: a member that is not in the contract is refused, never dropped | Choice of this row (DN-1). Reason: [SP:§9.5] holds for audit rows and events too, and with strict objects the only places that can hold an undeclared value are the open maps |
| Open maps | `details` and `params` are the simulator's `Details`: any key; a string, a number, a boolean or null as value; nothing nested | `sim/types.ts:68-69` |
| Time | Epoch milliseconds, an integer that is not negative | API-5 |
| Numbers | Counters, sequence numbers, byte sizes and durations are integers that are not negative. Rates, percentages, temperatures, levels and offsets are plain numbers. An audio level is between -90 and 0 dBFS | The simulator's own computations (`recordingBytes`, `trackSize`, `clampDbfs` round or clamp) |
| Identifiers | Session IDs, evidence IDs and operator IDs have their pattern; a hash is 64 lower-case hexadecimal digits (`SHA256_HEX_PATTERN`, new in `patterns.ts`) | `patterns.ts`; `sim/events.ts` |
| Text | Taken as the engine holds it. **The text rule API-13 is not applied to a slice** | Choice of this row (DN-2), because of finding F-1 |

Element schemas that more than one component uses, or that a list read of contract C returns one
by one, are named components too: `ActiveSession`, `SessionNote`, `SessionHistoryEntry`,
`EvidenceItem`, `SimEvent`, `SimAlert`, `AuditRow`.

Two helpers: `REPLICATED_SLICE_NAMES` (the 28 names in state order) and
`pickReplicatedState(state)`, which returns the 28 slices of a state by reference and leaves the
other five behind. It is what builds `snapshot.state` from the engine's state.

Measured on the real simulator at the fixed instant (2026-10-01 10:00:00 WIB):

| | Idle state | Recording scenario |
|---|--:|--:|
| The 28 slices as JSON | 119,557 bytes | 194,670 bytes |
| Largest slices | `audit` 35,740; `evidence` 21,176; `health` 19,499; `events` 12,173 | `audit` 99,600; `evidence` 21,176; `health` 19,499; `events` 16,546 |
| Parse of a whole snapshot with the union | | 0.87 ms |

Input for GS-11 (the size of 1 Hz `replace` deltas): `health` is 19.5 kB because it carries two
series of 120 points; `session` 6.9 kB, `time` 6.4 kB, `network` 6.4 kB, `storage` 5.9 kB.

---

## 3. The realtime message union

File: `packages/shared/src/api/realtime-messages.ts` (42 lines at the start, 585 now). The export
names `WsServerMessageSchema` and `WsServerMessage` are kept and widened: the file's own comment at
`acaff20` called the union the place where "the feature phase adds members" (DN-8).

### 3.1 Server to client

Every message carries `type` and `v: 1`. "Who may receive it" is the principal of the connection
[SP:§9.2]; the contract states it as `REALTIME_SERVER_MESSAGES` and `canReceiveRealtimeMessage`.

| `type` | Members besides `type` and `v` | Topic | Who may receive it | Component |
|---|---|---|---|---|
| `hello` | `connectionId`, `epoch`, `principal`, `reason?`, `topics`, `serverTime`, `heartbeatIntervalMs` | none | ANONYMOUS, DEVICE, OPERATOR: every connection, first | `RealtimeHello` |
| `heartbeat` | `seq`, `serverTime`, `uptimeMs`, `intervalMs`, `clients`, `sessionState` (unchanged) | heartbeat | ANONYMOUS, DEVICE, OPERATOR; `sessionState` is null unless OPERATOR | `Heartbeat` |
| `snapshot` | `epoch`, `revision`, `serverTime`, `state` | state | OPERATOR | `RealtimeSnapshot` |
| `delta` | `epoch`, `revision`, `serverTime`, `ops` | state | OPERATOR | `RealtimeDelta` |
| `meters` | `at`, `seq`, `audio` | meters | OPERATOR that subscribed | `RealtimeMeters` |
| `session.updated` | `operator` (`id`, `role`), `permissions`, `reason` | control | OPERATOR: the sockets of the operator's sessions | `RealtimeSessionUpdated` |
| `session.ended` | `reason` | control | OPERATOR: the sockets of the session, then close 4401 | `RealtimeSessionEnded` |
| `device.revoked` | `reason` | control | DEVICE and OPERATOR: the sockets of the device, then close 4403 | `RealtimeDeviceRevoked` |
| `admin.changed` | `resource` | admin | OPERATOR holding `USER_ADMIN` (`USERS`) or `PAIRING_MANAGE` (`DEVICES`, `PAIRING_CODE`) | `RealtimeAdminChanged` |

A test compares the member names of each component with this table, which is the table of
[SP:§9.4], so a member more or less fails.

Value sets:

| Member | Values | Note |
|---|---|---|
| `hello.principal` | `ANONYMOUS`, `DEVICE`, `OPERATOR` | [SP:§9.2] |
| `hello.topics` | A list from `heartbeat`, `control`, `state`, `meters`, `admin` | The schema enforces [SP:§9.2]: `heartbeat` is always present, no topic twice, and none outside the principal's set. ANONYMOUS: `heartbeat` only (SR-40). DEVICE: `heartbeat`, `control`. OPERATOR: any of the five |
| `hello.reason` | `SESSION_INVALID`, `DEVICE_REVOKED` | Only with ANONYMOUS (enforced). The specification names the first and says "the reason" for a bearer value the server does not accept; the second is this row's choice (DN-4) |
| `hello.connectionId` | 1 to 64 letters, digits or hyphens | A UUID fits; no underscore, so no bearer value fits (DN-4) |
| `hello.heartbeatIntervalMs` | 1000 | The existing constant |
| `session.updated.reason` | `ROLE_CHANGED` | [SP:§4.7] |
| `session.ended.reason` | `SIGNED_OUT`, `IDLE_EXPIRED`, `ABSOLUTE_EXPIRED`, `ROTATED`, `USER_DISABLED`, **`TOKEN_REUSE`** | Exactly [SP:§9.4]. The stored end reasons `DEVICE_REVOKED` and `DEVICE_UNPAIRED` [SP:§5.4] are not values here: those sockets get `device.revoked` and close 4403 |
| `device.revoked.reason` | `REVOKED`, `UNPAIRED` | [SP:§9.4] |
| `admin.changed.resource` | `USERS`, `DEVICES`, `PAIRING_CODE` | `ADMIN_RESOURCE_PERMISSION` maps each to its permission |

Time: `heartbeat.serverTime` stays an ISO-8601 string, as mock-core writes it. Every new member
that is a time is epoch milliseconds (API-5). A client that learns its clock offset from `hello`
and from `heartbeat` reads both forms (noted for W30 and W44).

### 3.2 State: snapshot and delta

| Item | Contract | Source |
|---|---|---|
| `snapshot.state` | `ReplicatedState`: exactly the 28 slices; a 29th member is refused | RT-1 |
| `delta.ops` | At least one operation, applied in order | RT-3; DN-6 |
| `replace` | `{ op: "replace", slice, value }`: one whole slice. `slice` is one of the 28 names and `value` must be that slice | RT-3; member names are this row's (DN-3) |
| `append` to `audit` | `{ op: "append", slice: "audit", rows, head, total, dropped }`: at least one `AuditRow`, and the slice's other three members after the append | RT-3, [CS:CL-14] |
| `append` to `events` | `{ op: "append", slice: "events", rows }`: at least one `SimEvent` | RT-3 |
| `epoch`, `revision` | Integers that are not negative. Gap-free revisions are a property of the sequence, not of one message | RT-2 |
| `meters` | No revision; `seq` may have gaps (a skipped frame) | RT-8 |

A test drives a real headless engine through a whole session (sign-in, create, pre-check, record,
marker, note, a fault, stop, seal: 630 ticks), builds the delta of every step as a server would
(a slice whose reference changed is replaced; new audit rows and events are appended), parses each
with the union, applies it to a replica, and compares the replica with the engine after every step.
The replica's audit ring, built from appends only, still verifies with the shared chain check. This
shows that the members of the two operations are enough to rebuild the state.

### 3.3 Client to server

| `type` | Members | Allowed for | Effect |
|---|---|---|---|
| `subscribe` | `topic: "meters"` | OPERATOR | The server starts the `meters` frames |
| `unsubscribe` | `topic: "meters"` | OPERATOR | The server stops them |
| `resync` | none | OPERATOR | The server answers with a new `snapshot`; at most one in 2 s |

`WsClientMessageSchema` refuses anything else. A client message carries no `v` (DN-5) and has no
member for a credential (SR-38).

### 3.4 Close codes and constants

`RealtimeCloseCode` and `REALTIME_CLOSE_CODES`: 1001, 1008, 1013, 4401, 4403, 4408, with their
cause and the client's reaction as [SP:§9.4] states them.

New constants in `constants.ts` (additive): `REALTIME_RESYNC_MIN_INTERVAL_MS` 2,000,
`REALTIME_CLIENT_MESSAGE_MAX_BYTES` 65,536 (RT-P4), `REALTIME_CLIENT_MESSAGE_LIMIT` 30 in 10 s
(RT-P5). The server's own limits (connection caps, send buffers, the ping, delta pacing, the meter
rate) are not in the contract.

### 3.5 Examples

File: `packages/shared/src/api/realtime-examples.ts` (new). `REALTIME_SERVER_EXAMPLES` has 22
examples for the eight messages other than `snapshot` (six for `hello`, one for each of the six
`session.ended` reasons); `REALTIME_CLIENT_EXAMPLES` has three. A snapshot has no literal: it holds
a whole state, which only the simulator defines. `realtimeSnapshotExample(state)` wraps a state the
caller built, and the tests build it from `createIdleState`. No example holds a secret, and none
could: no message has a member for one.

---

## 4. What a slice or a message can never carry

[SP:§9.5] lists what never appears in a realtime message. The contract makes each item impossible
by shape, and the tests try each one:

| Rule | How the contract enforces it | Test (file `packages/shared/test/`) |
|---|---|---|
| No password, session token, cookie value, device credential, biometric token, pairing code, QR payload, hash or salt in any message | Every new message is a strict object whose members are numbers, booleans, closed value sets or identifiers with a pattern | `api-realtime.test.ts`: twelve secret-named members are added to every server example (252 refusals: 21 examples that are not a heartbeat) and to every client example (36); `session.ended` and `device.revoked` with a token, a device ID, a session ID or a `details` member; a token as a `reason` |
| The same for a slice | Strict objects at every level | `api-state-slices.test.ts`: an unknown member in each of 57 objects of the 28 slices of a rich real state; eleven secret-named members in each of them (627 refusals) |
| A snapshot holds the 28 slices and no other | `ReplicatedStateSchema` is strict | A snapshot state with `clock`, `auth`, `authLockout`, `pairing` or `audio` is refused; the whole `SimState` is refused; a state without one of the 28 is refused |
| No delta can replace a slice that is not replicated | `replace` is a union over the 28 names | `replace` of each of the five is refused |
| An operator is identity and role only: no `enabled` flag, no session list | `ReplicatedOperatorSchema` is the `Operator` schema made strict | Nine members (`enabled`, `passwordHash`, `passwordSalt`, `password`, `lastSignInAt`, `roleChangedAt`, `activeSessions`, `sessions`, `biometricToken`) are each refused in the slice and in a snapshot state; four of them also in a `snapshot` message and in a `replace` |
| `session.updated` names the operator by ID and role, not the operator | `operator` is a strict object of two members | `username`, `enabled`, `passwordHash`, `sessions`, `activeSessions`, `displayName` are refused |
| The paired-device list is REST-only; `admin.changed` carries only the name of the list | One member, a value set | `devices`, `users`, `rows`, `items`, `device`, `code`, `codeId`, `qrPayload` are refused |
| Another console's lockout state | `authLockout` is not replicated | See the snapshot rule |
| An unauthenticated connection receives `hello` and `heartbeat` only (SR-40) | `hello.topics` must fit the principal; `canReceiveRealtimeMessage` | ANONYMOUS with `state`, `control`, `meters` or `admin` is refused; the receive table for the three principals |
| Authentication only at the upgrade; a token in a message authenticates nothing (SR-38) | No client message has a member for a credential; an unknown type is not a message | `{ type: "auth", token }` and a token member on each of the three are refused |
| `hello` cannot leak a bearer value through its one free identifier | `connectionId` has no underscore | The three bearer placeholders and the QR placeholder are refused as `connectionId` |
| No example holds a secret | Examples are plain data | Every string and member name of the 25 examples is scanned for bearer forms, six-digit codes, the QR prefix, the published demo password and the published demo pairing code |

The one member that is not strict is the released `heartbeat`: it is in strip mode, as at `acaff20`,
so an unknown member parses and is dropped from the result. A test states that and checks that the
result does not hold the member. Making it strict would change the released member (F-5).

Two limits of what a schema can do, stated so that nobody relies on more:

- The open maps (`details`, `params`) accept any flat value under any key. That a writer never
  puts a secret there is SR-54, enforced by the writers and by the log and audit scans of the
  acceptance rows, not by this contract.
- Free text is free: a schema cannot tell a note from a pasted token. The contract adds no
  value-based filter on text. A filter would let an operator make the state unreadable for every
  client by typing a string of the right form.

---

## 5. Compile-time proofs

In `packages/shared/test/api-state-slices.test.ts` and `api-realtime.test.ts`; `npm run typecheck
-w @dems/shared` checks them.

| Proof | Says |
|---|---|
| `everySliceIsTheSimulators` (28 members) | The type of each slice schema and `SimState[slice]` are assignable to each other |
| `everySliceHasTheSimulatorsMembers` (28 members) | Both have the same member names at every depth, optional ones included |
| `stateIsThe28Slices` | `ReplicatedState` is `Pick<SimState, the 28 names>` |
| `audioIsTheSlice`, `audioHasTheSimulatorsMembers` | `AudioSlice` is `SimState['audio']` |
| `deliveryCoversTheState`, `unreplicatedAreTheOtherFive` | `STATE_SLICE_DELIVERY` classifies every slice of `SimState`; the unreplicated ones are exactly the five |
| Seven element proofs | `ReplicatedOperator` is `SimOperator`; `ActiveSession`, `SessionNote`, `SessionHistoryEntry`, `EvidenceItem`, `SimEvent`, `SimAlert`, `AuditRow` are the simulator's |
| `everyReplaceCarriesItsSlice` (28 members) | The `value` of `replace` for a slice is `SimState[slice]` |
| `nineServerMessages`, `threeClientMessages`, `heartbeatMemberIsTheInterface`, `tokenReuseIsAReason`, `snapshotStateIsThe28Slices`, `metersCarryTheAudioSlice` | The union has exactly the nine types; the heartbeat member is the existing interface; and so on |

The second proof exists because of a weakness found here (F-2): mutual assignability does not see
an optional member that one side lacks. The first mutation run showed it; the member-name proof
closes it (mutations M10, M39 and M40 are now caught by the type check).

---

## 6. The registry and the OpenAPI documents

### 6.1 The heartbeat member and the offline scope are unchanged

```
$ cmp <lines 4-20 of acaff20:realtime-messages.ts> <the Heartbeat interface now>
Heartbeat interface: 17 lines, byte-equal to acaff20
$ cmp <lines 25-34 of acaff20:realtime-messages.ts> <HeartbeatSchema now>
HeartbeatSchema: 10 lines, byte-equal to acaff20

$ shasum -a 256 packages/shared/openapi/openapi.json
3d62fa662ad85295c1e207d2670673afd68229db935daa0659da6f8e3a21f6b3      (the value 19_contract_a.md §7.3 records)

$ node --import tsx packages/shared/scripts/gen-openapi.ts --check
packages/shared/openapi/openapi.json is up to date (offline (committed): 10 operations; all: 37 operations)
exit=0
```

`git hash-object` of `openapi.json`, `gen-openapi.ts`, `openapi.test.ts`, `schemas.test.ts` and
`sim-api-validation.test.ts` equals the values saved before the first edit
(`.cache/rollback/W22.pre.hashes`): this row did not write them.

The tests of contract A that pin the offline document to `acaff20` pass unchanged: the `Heartbeat`
component hash, the hash of the tag list (which holds the Realtime description), and the 18
component names (`api-openapi-scope.test.ts`, `openapi.test.ts`).

One behaviour of existing code changes, and only on a Core-server socket: the heartbeat client
parses with the union, so a `hello` is no longer reported as a schema mismatch; it is ignored, as
any message that is not a heartbeat. `heartbeat-client.test.ts` passes unchanged, and a new test
feeds the client a `hello`, a heartbeat and an unknown message (F-6).

### 6.2 Components

`CORE_API_SCHEMAS` gains 48 entries after the 50 of contract A: the 37 of `STATE_SCHEMAS` (28
slices, `AudioSlice`, `ReplicatedState`, seven element schemas) and the 11 of `REALTIME_SCHEMAS`
(eight messages, `RealtimeDeltaOp`, `RealtimeServerMessage`, `RealtimeClientMessage`). The offline
document holds none of them; the `all` scope holds all 98. No operation refers to a slice yet: the
reads of [SP:§7.8-7.15] will (API-6), which is contract C.

### 6.3 The socket in the `all` scope: how it is documented

OpenAPI cannot describe a socket, so the existing practice is kept: the Realtime tag describes it.

- **Offline scope:** the text is byte-equal to `acaff20` (mock-core's heartbeat, one example).
- **`all` scope:** the same text, then a section "Core server" that this row adds
  (`coreServerRealtimeDescription` in `openapi.ts`): who a connection is; what each principal
  receives; the table of the nine server messages with topic, members, model and recipients; the
  three client messages; state replication; time; close codes; what never appears in a message; and
  ten JSON examples. The tables are generated from the catalogue of `realtime-messages.ts` and the
  examples are those of `realtime-examples.ts`, so the text cannot name a message the union does not
  have. A test parses every JSON block with the union.
- **It names no host.** The pin of contract A, "the only host of the `all` scope is
  `127.0.0.1:4400`", still holds; the server entry of the Core server comes with contract C.

The generated text is `implementation/assets/22_realtime_tag_all_scope.md`. The `all` document is
486,616 bytes with 98 components (not committed; contract C commits it). Building a document takes
about 5 to 6 ms in either scope (average of five builds: 6.3 ms offline, 4.6 ms `all`).

---

## 7. Files written

Changed (7; `assets/22_changes_to_existing_files.diff`: 630 lines added, 8 removed):

| File | Change |
|---|---|
| `packages/shared/src/api/realtime-messages.ts` | The union, the client messages, value sets, close codes, the catalogue. The heartbeat interface and schema are untouched |
| `packages/shared/src/api/core-api.ts` | `...STATE_SCHEMAS, ...REALTIME_SCHEMAS` appended to `CORE_API_SCHEMAS`; two imports; two comments |
| `packages/shared/src/api/openapi.ts` | The Core server section of the Realtime tag, in the `all` scope only |
| `packages/shared/src/api/constants.ts` | Three realtime constants (additive) |
| `packages/shared/src/api/patterns.ts` | `SHA256_HEX_PATTERN` (additive) |
| `packages/shared/src/api/index.ts` | Two export lines |
| `packages/shared/test/api-registry.test.ts` | One assertion, by design (section 9.1) |

New (4): `packages/shared/src/api/state-slices.ts`, `packages/shared/src/api/realtime-examples.ts`,
`packages/shared/test/api-state-slices.test.ts`, `packages/shared/test/api-realtime.test.ts`.

Outside the code: this document, `delegation_progress/coder_execution_step_44.md`, seven files under
`implementation/assets/22_*`, and `.cache/rollback/W22.*` and `.cache/W22/` (git-ignored).

Not written: `openapi.json`, `gen-openapi.ts`, the three pinned shared tests, the other six `api-*`
tests, anything under `packages/shared/src/sim/`, `src/client/`, `src/live/`, `src/realtime/`, any
i18n file, any `package.json`, anything in `apps/`.

```
$ git diff acaff20 --stat -- packages/shared/src/sim apps/mock-core release
 packages/shared/src/sim/auth.ts       |  5 +++++
 packages/shared/src/sim/vocabulary.ts | 27 +++++++++++++++++++++++++++
 2 files changed, 32 insertions(+)                      (both are step 38's)
```

---

## 8. Verification

### 8.1 State at the start (08:48 WIB, before the first edit)

```
$ npm run typecheck -w @dems/shared
test/client-types.test.ts(123,46): error TS2344: Type '{ code: string; message: string; }' does not satisfy the constraint ...
exit=2
$ npm run test -w @dems/shared -- --maxWorkers=2
 FAIL  test/client-core.test.ts > AC-C-01: every registry operation is callable > calls each operation and returns every documented example ...
Error: no example for signOut 204
 ❯ test/client-core.test.ts:118:22
 Test Files  1 failed | 43 passed (44)
      Tests  1 failed | 784 passed (785)
exit=1
$ node --import tsx packages/shared/scripts/gen-openapi.ts --check
packages/shared/openapi/openapi.json is up to date (offline (committed): 10 operations; all: 37 operations)
exit=0
```

Exactly the two known failures of the typed-client row, in its two files. Their owner saved both
files at 08:51; from then on both commands were green apart from this row's own work in progress.

### 8.2 Final run on the finished tree (09:29:31 to 09:31:42 WIB; full output: `assets/22_gate.log`)

```
$ npm run test -w @dems/shared -- --maxWorkers=2
 Test Files  46 passed (46)
      Tests  977 passed (977)
exit=0

$ node --import tsx packages/shared/scripts/gen-openapi.ts --check
packages/shared/openapi/openapi.json is up to date (offline (committed): 10 operations; all: 37 operations)
exit=0

$ npm run typecheck -w @dems/shared          exit=0
$ npm run lint -w @dems/shared               exit=0
$ npm run typecheck -w @dems/core-web        exit=0
$ npm run typecheck -w @dems/mobile          exit=0
$ npm run typecheck -w @dems/core-server     exit=2 (first run), exit=0 (second run, 09:30:57)
$ npm run typecheck -w @dems/mock-core       exit=0
$ npm run lint -w @dems/core-web             exit=0
$ npm run lint -w @dems/mobile               exit=0

$ npm run test -w @dems/core-web -- --maxWorkers=2
 Test Files  39 passed (39)
      Tests  438 passed (438)
exit=0

$ git diff --stat acaff20 -- apps/core-web/src/test/scalar-config.test.ts   (prints nothing when unchanged)
(end)

Not gates of this row, run because both workspaces import @dems/shared/api:
$ npm run test -w @dems/mobile -- --maxWorkers=2
Test Suites: 72 passed, 72 total
Tests:       833 passed, 833 total
exit=0
$ npm run test -w @dems/core-server -- --maxWorkers=2
 exit=1 (09:31: 1 failed, 960 passed, 18 skipped, in two files), then
 Test Files  31 passed (31)
      Tests  979 passed (979)       (third run, after the owner saved the two files)
```

### 8.3 The two runs that were red, and whose they were (P11)

| Run | What failed | Whose file | Evidence that it is not this row's | Later run |
|---|---|---|---|---|
| `typecheck -w @dems/core-server`, 09:30 | `test/db/catalog.db.test.ts(198,21)` TS2352, a cast of `ContractTable[]` | The migration row (blueprint step 39, W17), in flight; it saved the file at 09:30 | The file imports nothing from `@dems/shared`; the error is about a database test type | exit 0 at 09:30:57 |
| `test -w @dems/core-server`, 09:31 | `log-capture.test.ts:89` got 403 where 200 and 400 were expected; `readiness.test.ts:253` expected a stub message naming "plan row W23" | Tests of the scaffold that the request-guard row (blueprint step 45, W23) was changing at that moment | The 403 comes from the Origin guard W23 registers; neither file uses a slice schema or a realtime message | 31 files, 979 passed |

The mock-core suite was not run (P5). Root `npm run typecheck` was not run as one command; the five
workspace commands above are its parts.

### 8.4 The row's verification items

| Item | Result |
|---|---|
| The shared tests exit 0 | Yes: 977 of 977 |
| `gen-openapi.ts --check` exits 0 | Yes |
| Each of the 28 slice schemas accepts the matching slice of `createIdleState` at the fixed instant | Yes: 28 tests, one per slice, each "accepted unchanged" |
| ... and of the recording scenario | Yes: 28 tests |
| The union accepts one example of every message of [SP:§9.4] and the existing heartbeat | Yes: 23 example tests (22 examples and a snapshot of the real idle state), and the mock-core heartbeat |
| `npm run typecheck -w @dems/shared` exit 0 at the end | Yes |
| `npm run lint -w @dems/shared` exit 0 | Yes |
| Typecheck of core-web, mobile and core-server exit 0 | Yes (core-server on its second run, section 8.3) |
| Web tests 438 passed, `scalar-config.test.ts` unchanged | Yes |
| Nothing from this row under `src/sim`, `apps/mock-core`, `release` | Yes |

---

## 9. Tests

### 9.1 Existing assertions edited (one)

| File and lines as contract A left them | Before | After (now lines 347 and 360-370) | Why |
|---|---|---|---|
| `packages/shared/test/api-registry.test.ts:345` (title) and `:359` | Title "every schema name exists, and every schema is used by an operation or by another schema"; `expect(Object.keys(CORE_API_SCHEMAS)).toHaveLength(50)` | Title "... by an operation, by another schema or by the socket"; the 37 names of `STATE_SCHEMAS` and the 11 of `REALTIME_SCHEMAS` count as used; the registry has 50 + 37 + 11 entries; the entries after the first 50 are exactly those 48, in order | By design ([SP:§7.18] lists the slice schemas and the realtime messages among the new schemas; [PL:CO-3] "after W22 the same 37 plus the slice schemas and the message union"). The old statement stays true for the first 50, which the new last line pins |

Every other assertion of the three pinned files and of the six `api-*` files of contract A is
unchanged and passes.

### 9.2 Tests added (173)

| File | Tests | Subject |
|---|--:|---|
| `test/api-state-slices.test.ts` (new) | 99 | The classification of the 33 slices; the 28 names against [SP:§3.2]; component names. **Each of the 28 schemas against `createIdleState` at the fixed instant and against the recording scenario** (56 tests), the 28 together as a snapshot state, and `audio`. Every scenario; four journeys of a headless engine (below). Strictness at every level; the snapshot state without and with each of the five other slices; secret-named members; the open maps; the operators slice (nine refused members); values (time, value sets, identifiers, hashes, levels); text (F-1); the two OpenAPI documents |
| `test/api-realtime.test.ts` (new) | 74 | The heartbeat member unchanged, and the released heartbeat client on a socket with new messages. The nine members against the table of [SP:§9.4]; 23 examples parsed with the union and with their own schema. `hello` and the principal rules. The control and admin messages. `replace` of each of the 28 slices; deltas of a real engine applied to a replica; `append`; epoch and revision. The three client messages. What no message can carry (eight tests). Constants and close codes. The Realtime tag of both documents |

The journeys beyond the two required states (no fixture; a headless engine with a manual clock):

| Journey | Samples | What it reaches |
|---|--:|---|
| A session from create to seal, then evidence and maintenance | 35 | Session states CREATE, PRECHECK, ARMED, RECORDING, STOPPING, FINALIZING, SEALED; 11 of the 12 fault kinds active (the twelfth, POWER_FAIL, is the next journey's); tampered evidence that fails verification; export, archive, audit and log export; storage LOW and FULL; diagnostics running and done; device commands; a software update to PASS; an altered audit row; settings; a demo reset |
| A power failure during a recording | 4 | FAULT, RECOVERY, an incomplete session |
| A pre-check that warns and one that blocks | 4 | `reasonCode`, `params`, acknowledged warnings |
| Every scenario, built and after 90 s | 8 | `idle`, `recording`, `finalizing`, `fault-demo` |

Every slice of every sample is parsed and compared with what went in: 51 states, 1,428 slice
parses, no refusal and no change.

### 9.3 Can the tests fail? (40 single changes; `assets/22_mutations.log`)

Each change was made to one source file on an isolated copy of the package under `.cache/W22/mut`
(not on the tree, so no other row saw it), the type check and the twelve contract test files were
run there, and the file was restored. **40 of 40 were detected.**

| Group | Changes |
|---|---|
| Slices (17) | The operator not strict; the snapshot state not strict; a slice missing from the 28; a time as any number; an event row not strict; **free text refusing ill-formed text**; a hash as any string; a member with the wrong type; an optional member made required; an optional member forgotten; an audio level without bounds; an open map taking nested values; `pairing` classified as replicated; the session input not strict; any actor in an audit row; an optional member the simulator does not have; a nested optional member forgotten |
| Messages (20) | `TOKEN_REUSE` removed; `session.ended` not strict; `device.revoked` not strict; `hello` without the topic rule; without the reason rule; a connection ID with an underscore; the heartbeat time as epoch milliseconds; `admin.changed` out of the union; a client subscribing to any topic; an append without rows; `device.revoked` not sent to a DEVICE; a snapshot to an ANONYMOUS connection; a wrong close code; the wrong permission for the users list; `session.updated` with an open operator; an empty delta; the audit append without its head; a client message with `v`; ANONYMOUS given the state topic; resync every second |
| Documents and examples (3) | The Core server text in the offline document; an example with a bearer-shaped connection ID; an example whose permissions are not the role's |

Two were caught by the type check alone: an optional member made required, and an optional member
the simulator does not have. A forgotten optional member is caught by the type check as well as by
the journey tests since the member-name proof was added; in the first run only the tests caught it
(F-2).

### 9.4 Test ledger (P24)

| Workspace | Before this row | After | Note |
|---|---|---|---|
| `@dems/shared` | 785 in 44 files: 784 passed, 1 failed (08:48, before the first edit; the failure is the typed-client row's) | **977 passed in 46 files** | +173 tests and +2 files are this row's (`api-state-slices.test.ts` 99, `api-realtime.test.ts` 74). +19 tests arrived at 08:51, when the typed-client row saved `client-core.test.ts` (63 tests at contract A's gate, 81 now) and `client-types.test.ts`: 804 in 44 files before this row's first test file |
| `@dems/core-web` | 438 in 39 | 438 passed in 39 | no change |
| `@dems/mobile` | 833 in 72 suites | 833 passed in 72 | no change |
| `@dems/core-server` (unit) | not this row's | 979 passed in 31 at its last run | no file of this row; other rows are adding tests |

Expected shared total = 785 + 19 + 173 = 977. Failed = 0.

---

## 10. Findings, deviations and decisions for the controller (P22)

### Findings

**F-1 (needs a ruling). The engine can cut a text in the middle of a surrogate pair, so well-formed
input leaves ill-formed UTF-16 in the state, in one case inside a hashed audit row.** Found while
deciding whether a slice should carry the text rule API-13. Logged as **SIM-GAP-1** (P12; the first
simulator gap of this task, so the number is a proposal for the controller).

| Where the engine cuts | Input that passes the contract | What the state then holds |
|---|---|---|
| `packages/shared/src/sim/session-machine.ts:1102`: the timeline entry of a note longer than 140 code units is `body.slice(0, 139)` plus an ellipsis | A note whose code units 139 and 140 are one surrogate pair (any character outside the basic plane, an emoji for example) | `session.timeline[].detail` ends with an unpaired high surrogate |
| `packages/shared/src/sim/evidence-actions.ts:158` and `:275`: an export destination is `destination.trim().slice(0, 120)` (evidence, audit and log export) | A destination whose code units 120 and 121 are one pair. `EvidenceExportRequest` accepts it: the input is well-formed | `audit.rows[].details.destination` and `evidence[].custody[].detail` end with an unpaired high surrogate |

Reproduction with the real simulator (`assets/22_finding_f1_reproduction.ts`, output in
`22_finding_f1_output.txt`):

```
note: 168 code units, well-formed: true
ill-formed strings after addNote: [ 'state.session.timeline[28].detail' ]
destination: 130 code units, well-formed: true
EvidenceExportRequest accepts it (API-13 holds for the input): true
exportEvidence: {"ok":true,"status":202,"exportId":"EXP-000032"}
ill-formed strings after exportEvidence: [ 'state.evidence[3].custody[3].detail', 'state.audit.rows[222].details.destination' ]
UTF-8 of an unpaired high surrogate: efbfbd (U+FFFD: the stored text would differ from the hashed text)
```

Why it matters. API-13 exists so that an audit row is stored exactly as it was hashed
([SP:API-13]; [DB:§13.1]). It guards the input. The second cut makes ill-formed text after the
guard, in `details` of an `EVIDENCE_EXPORTED` or `AUDIT_EXPORTED` row, which is part of the hashed
body. A caller needs `EVIDENCE_EXPORT` or `AUDIT_EXPORT` (a Supervisor) for that, and `SESSION_NOTE`
for the note. What PostgreSQL does with such a row was **not run here** (this row has no database);
by the analysis the text rule rests on, the stored text would hold U+FFFD and no longer match the
chain hash, or the write would fail.

What this row did about it: nothing in the simulator and nothing in the ten existing operations
(neither is this row's). The slice schemas take text as the engine holds it (DN-2), so the state
stays readable for every client whatever the engine made of an input.

Options for the ruling:

| Option | Where | Effect |
|---|---|---|
| A. Cut on a code-point boundary | `packages/shared/src/sim/` (three expressions in two files; no planned writer, so a controller-scheduled slot) | Closes it at the cause, in both modes |
| B. Guard the input | Contract C: the `destination` of the two new exports is cut or bounded on a code-point boundary at 120 code units before the engine sees it, and `addSessionNote.text` refuses a pair at code units 139 and 140. The existing `EvidenceExportRequest` would need the same `overwrite` (its JSON Schema would not change) | No simulator change; the note rule is odd for a user |
| C. Accept for the demo | — | A Supervisor's export destination could then leave a stored audit row that does not match its hash; the acceptance rows would have to know |

**F-2. Mutual assignability does not see a missing optional member.** The proof form contract A
uses (`Exact<A, B>`: each type assignable to the other) is true for `{ a: X }` and
`{ a: X; b?: Y }`. A slice schema that forgot an optional member passed the type check; only the
journey tests caught it (first mutation run, M10). This row adds a second proof that compares the
member names at every depth. Contract A's four proofs were checked the same way on the isolated
copy: their member names are equal, so nothing is wrong there. `FaultTarget`, whose six members are
all optional, was the one that could have hidden a gap.

**F-3. A parsed slice has the schema's member order, not the engine's.** zod builds its result in
the order the schema declares. For `session` and `diagnostics` that differs from the order the
simulator writes. The content is equal (deep equality in every test); a comparison of serialised
text is not. The audit hash is not affected: the canonical form sorts the keys, and a test verifies
the chain on the parsed slice.

**F-4. Two forms of time on one socket.** `heartbeat.serverTime` is an ISO-8601 string (unchanged);
`hello.serverTime` and every other new time is epoch milliseconds. [CS:§2.3] has the client learn
its offset from both, so the socket client and the Live source must read both forms.

**F-5. The heartbeat is the one member that is not strict.** It stays in strip mode, as released.
Every other member refuses an unknown member. A server that builds its heartbeat from typed fields
sends none.

**F-6. The widened union changes one behaviour of the released heartbeat client**, on a Core-server
socket only: a message that is not a heartbeat is ignored and no longer reported as a schema
mismatch. Against mock-core nothing changes.

**F-7. Six reasons on the wire, eight in the database.** `session.ended.reason` has the six values
of [SP:§9.4]. A session ended by a revoke or an unpair is stored with `DEVICE_REVOKED` or
`DEVICE_UNPAIRED` [SP:§5.4], and its sockets get `device.revoked` and close 4403, not
`session.ended`. The realtime row must not send a stored reason as it is.

**F-8. The simulator does not check a fault kind at run time.** `inject` with a value outside
`FaultKind` raises an alert whose `severity` is undefined (seen through a typing mistake in a
scratch script, not in a test). In Live mode `DemoFaultRequest` refuses such a kind before the
engine runs, and the `alerts` schema would refuse the state. No action needed; noted for the demo
module row.

**F-9. Sizes.** A snapshot of the recording scenario is 194,670 bytes; half of it is the audit ring
(section 2). A 1 Hz `replace` of `health` is 19.5 kB. Input for GS-11.

### Deviations from the plan

| ID | Deviation | Why |
|---|---|---|
| DR-1 | The registry gained 48 named schemas, not 28: the 28 slices, `AudioSlice`, `ReplicatedState`, seven element schemas, and 11 for the socket | A snapshot, a delta and `meters` need them; the element schemas are what contract C's list reads return, and naming them keeps the document from repeating them |
| DR-2 | The socket is documented in the `all` scope (the Realtime tag), which the row made optional | [SP:§7.19] lists "the `/ws` description" among the assertions that change with this contract; the offline text is untouched (section 6.3) |
| DR-3 | Three constants and one pattern were added | Both sides of the socket need the three numbers; the hash pattern is used by 9 members |
| DR-4 | `implementation/99_implementation_report.md`, `masterplan/02_plan.md` and `status_tasks.md` were not written | The parallel-run contract of this delegation (P8) |
| DR-5 | The mutation runs changed files on a copy under `.cache/W22/mut`, not on the tree | So that a row running at the same time never type-checks a mutated contract |
| DR-6 | The slices do not carry the text rule API-13, although its wording is "every string schema of the registry" | F-1; DN-2 |

### Decisions needed

| ID | Decision | This row's choice |
|---|---|---|
| DN-0 | **F-1 (SIM-GAP-1): who makes the cuts safe** (options A, B, C). No writer of `packages/shared/src/sim/` is planned, so option A needs a controller-scheduled slot | Not this row. Recommended: A. It does not block the rows that consume this contract |
| DN-1 | Strictness of slices and messages; the specification is silent | Strict at every level, for all 28 slices and every new message; the heartbeat stays as released |
| DN-2 | Text of a slice | Taken as the engine holds it, without API-13. One line (`text()` in `state-slices.ts`) switches the rule on once F-1 is closed; mutation M06 shows the tests notice |
| DN-3 | Member names of a delta operation, which the specification does not give | `op` (`replace` or `append`), `slice`, `value`; for an append `rows`, and for `audit` also `head`, `total`, `dropped` |
| DN-4 | `hello`: the values of `reason` (`SESSION_INVALID`, `DEVICE_REVOKED`); `reason` only with ANONYMOUS; `topics` must fit the principal; `connectionId` is 1 to 64 letters, digits or hyphens | As stated. One reason for every credential the server does not accept, so the answer does not tell an unknown value from an expired one |
| DN-5 | Client messages carry no `v` | The table of [SP:§9.4] gives `v: 1` for server messages only. Adding an optional `v` later is additive |
| DN-6 | A delta has at least one operation; an append at least one row | An empty delta would spend a revision on nothing |
| DN-7 | Component names: `<Name>Slice` for the 28 slices (`AuditSlice`, not the simulator's `AuditLogSlice`; `StoragePolicySlice`), `Realtime*` for the messages | One rule, `stateSliceSchemaName` |
| DN-8 | `WsServerMessageSchema` and `WsServerMessage` keep their names and are widened | The file called the union the extension point; a second union would leave two definitions |

---

## 11. Open points for contract C and the other rows

| For | Point |
|---|---|
| W27 (C) | The reads of [SP:§7.8-7.15] return slices (API-6). The components exist: wrap them, for example `getDeviceInventory` as an object of `device`, `cameras`, `mics`, `otherDevices`, `ports`, `activeCameraId`, `tabletLink` built from `REPLICATED_SLICE_SCHEMAS`. The list reads return `SessionHistoryEntry`, `EvidenceItem`, `AuditRow`, `SimEvent`, `SimAlert`. `setStoragePolicy` takes a partial `StoragePolicySliceSchema`, `updateSettings` a partial `SettingsSliceSchema` |
| W27 | These schemas are strict. A REST answer that returns a slice is then strict too: the typed client reports an unknown member as `CONTRACT_VIOLATION` |
| W27 | F-1, if the ruling is option B |
| W27 | The Realtime tag of the `all` scope names no host. When the server `127.0.0.1:4420` is added, the first paragraph (mock-core's) and the new section can name both sockets; the pin "what contract C still owes this scope" changes then |
| W27 | The simulator's `ChainVerifyResult`, `EvidenceVerifyResult` and `StoragePolicy` request are not written here; they belong to the operations that return them |
| W83 | `DemoStatus.activeFaults` (contract A) restates the items of the `faults` slice; it can refer to `FaultsSliceSchema` now |
| W83 | The member-name proof (F-2) can replace `Exact` in `api-schemas.test.ts` |
| W42 (realtime channel) | Import `WsServerMessageSchema`, `WsClientMessageSchema`, `pickReplicatedState`, `REPLICATED_SLICE_NAMES`, `canReceiveRealtimeMessage`, `canSendRealtimeMessage`, `RealtimeCloseCode`, `REALTIME_PRINCIPAL_TOPICS`, `ADMIN_RESOURCE_PERMISSION`, the three constants. F-4, F-7. A parsed message has the schema's member order (F-3) |
| W30 (socket client) | The union; `REALTIME_RESYNC_MIN_INTERVAL_MS`; the close codes; F-4. A `snapshot` or `delta` the schema refuses is "invalid, dropped and reported" by [CS:CL-10] |
| W31 (fake transport) | `REALTIME_SERVER_EXAMPLES`, `REALTIME_CLIENT_EXAMPLES`, `realtimeSnapshotExample(pickReplicatedState(state))` |
| W44 (Live source) | `STATE_SLICE_DELIVERY` says where each of the 33 slices comes from. The test `applyDelta` in `api-realtime.test.ts` is a reference for the two rings |
| W26 (engine host) | `operators` on the wire is strict: the mirror of the operators table into the engine must hold the seven members and no other (ENG-3) |

---

## 12. Rollback (R-PRE)

Pre-image, saved before the first edit: `.cache/rollback/W22.pre.patch` (76,172 bytes; it holds
contract A's changes, so the rollback restores contract A's state). `git diff` does not show
untracked files, and contract A's ten new modules and six tests are untracked, so the pre-image also
has `.cache/rollback/W22.pre.untracked.tar` and `W22.pre.hashes` (`git hash-object` of every file).
Post-image: `W22.post.patch`, `W22.post.untracked.tar`.

```
git checkout acaff20 -- packages/shared/src/api packages/shared/openapi packages/shared/scripts/gen-openapi.ts \
  packages/shared/test/openapi.test.ts packages/shared/test/schemas.test.ts packages/shared/test/sim-api-validation.test.ts
git apply --include='packages/shared/src/api/*' --include='packages/shared/openapi/*' \
  --include='packages/shared/scripts/gen-openapi.ts' --include='packages/shared/test/openapi.test.ts' \
  --include='packages/shared/test/schemas.test.ts' --include='packages/shared/test/sim-api-validation.test.ts' \
  .cache/rollback/W22.pre.patch
rm packages/shared/src/api/state-slices.ts packages/shared/src/api/realtime-examples.ts
rm packages/shared/test/api-state-slices.test.ts packages/shared/test/api-realtime.test.ts
tar -xf .cache/rollback/W22.pre.untracked.tar        # restores api-registry.test.ts as contract A left it
```

The `--include` list is needed because the pre-image was taken over the whole of
`packages/shared/test`, as the row's instruction words it, so it also holds other rows' test files
(`auth.test.ts`, `i18n-vocabulary-sync.test.ts`), which a rollback of this row must not touch.

The recipe was run in a scratch directory outside the repository (an archive of `acaff20`, then the
three steps): the result equals the saved pre-image, 30 files, each with the `git hash-object`
value recorded before the first edit.

After a rollback the registry has 50 schemas again and the union one member.

---

## 13. Not done here

The 38 operations of areas 4 to 12; the committed document of the `all` scope; the server's
realtime channel, the socket client, the fake transport and the Live source; any change of the
simulator (F-1); any i18n text.

*Written 2026-10-04 09:40 WIB.*
