---
task_id: 2026-10-12_input_av_core_adapter_plan
task_slug: input_av_core_adapter_plan
date: 2026-10-12
agent: security-review
type: security check of one design addendum, before it is built (no code exists yet)
narrative_tier: 1
source: masterplan/04_design_addendum.md (status "proposed", last updated 2026-10-12 21:57 WIB)
baseline: commit cf2f8008 (working tree: only this task folder is untracked)
verdict: CAUTION
fail_count: 0
caution_count: 14
status: complete
---

# Security check of the design addendum (P12-B1, P12-B2, F03, F05, F08, F10/F11)

## 1. Verdict

**Overall: CAUTION. FAIL: 0. The autonomous work does not stop.** Every weakness found is closed by a requirement that fits a work package the addendum already names. Fourteen requirements (AD-01 to AD-14) must be carried into the implementation blueprint; four of them are gates.

| # | Item | Verdict | Why, in one line | Requirements |
|---|---|---|---|---|
| 1 | Section 1, P12-B1: unassigned slot, first production boot | **CAUTION** | The state enumeration holds (re-derived, section 3.1). Two readers of the six columns are not in the addendum's change list, one of which stops the very boot the design promises; one stated fact about who can write a loopback production row is wrong | AD-02, AD-04, AD-08, AD-10, AD-13 |
| 2 | Section 2, P12-B2: credential reader, reveal and audit, relay | **CAUTION** | The shape is right (reveal and audit in one unit, plaintext only after it). The reader has no closed list of holders, the injected value is a plain serialisable object, and nothing limits a dump of the Core process | AD-03, AD-09 |
| 3 | Section 5, F10/F11: decision rule of E-11 | **CAUTION** | Each branch is sufficient for RC-1 and S13-05 **if the observation is true**. The rule is not safe against a false REFUSED (branch A) or a false READABLE (branch B), and one cell of the table has no branch | AD-01 (gate), AD-14 |
| 4 | Sections 3, 4, 7: parallel opens, microphone registration, minted profile code | **CAUTION** | No free device text reaches a sealed manifest **if** the codec comes from a closed set decided in the Core. The addendum takes it from "what the relay's probe reports". USB descriptor text reaches a helper argument by the "live listing" rule | AD-06, AD-07, AD-11 |
| 5 | Section 9: requirements table | **CAUTION** | Every S13-nn and RC-n has a home. Nine have an acceptance check that would not detect a violation, or lost a clause | AD-05, AD-12 |

Gates: **AD-01** before WP-03a starts (it is part of RC-1's gate). **AD-02** and **AD-08** before the lift (WP-13c). **AD-04** before WP-13a closes.

What would turn a CAUTION into a FAIL: choosing branch A of E-11 without AD-01; lifting class C without AD-02.

## 2. Ranked requirements

| Rank | Id | Sev. | Package | Requirement, one line |
|---|---|---|---|---|
| 1 | AD-01 | High, gate | WP-01; WP-14 (container); WP-06b | E-11 selects branch A only on a controlled, repeated, near-miss-tested refusal; E-11b must show the value read follows the client; the undefined cell is decided; the result is repeated on the Linux build and kept as a regression test |
| 2 | AD-02 | High, gate | WP-06b, WP-13b, WP-13c | The production camera adapter holds the stored address to the target rule of S13-11 at every open; loopback is refused by default; the permissive rule exists only under `test/` |
| 3 | AD-03 | High | WP-06a, WP-02, WP-06b | The credential reader: closed list of holders, reason fixed per holder, returns only after the commit, audit row carries the session; the injected value cannot be serialised outside one function |
| 4 | AD-04 | High, gate | WP-13a | The reader inventory of the six columns includes `store.ts:85-108` and `rows.ts:782-804`; no reader or writer works by position; the boot step `capture.config` passes on an all-unassigned selector |
| 5 | AD-05 | Medium | WP-06b, WP-03a, WP-11b | RC-1, RC-2, RC-3 and RC-6 get back the clauses and checks the table dropped |
| 6 | AD-06 | Medium | WP-05, WP-24 | The minted profile code: codec from a closed set decided by the Core's own parse, bounded integers, pattern-checked before any store; the probe report is a bounded, schema-checked frame |
| 7 | AD-07 | Medium | WP-07a, WP-07c, WP-08 | USB descriptor text: character rule at the adapter before any store; the helper's device argument is built from integers only |
| 8 | AD-08 | Medium, gate | WP-13c, WP-13b | The full-session test adds no seam, flag or key to `src/`; the two boot-check mounts stay as they are, held by a static rule |
| 9 | AD-09 | Medium | WP-14, WP-20, WP-02 | Core process: no core file, no diagnostic report, no heap snapshot switch; a relay stopped at its bound is killed and reaped |
| 10 | AD-10 | Medium | WP-13a | `unassign`: one audit row per cleared slot, refused in every session state but SEALED, never combined with an assignment of the same slot, "exactly four" pinned |
| 11 | AD-11 | Low | WP-06b | The 30 s window is a constant of the operation, never a setting; one reveal per camera per attempt under parallel opens |
| 12 | AD-12 | Low | blueprint, section 9.4 | S13-02, S13-04 (d), S13-12 (b), S13-14 (e), S13-16: a check each, not a pointer |
| 13 | AD-13 | Low | WP-27 | First boot, step (b): on a loopback listener, before the host joins the room network |
| 14 | AD-14 | Medium, only in branch C | the review 5.4 already orders | The worker that pulls takes over RC-6's confinement as far as a file-writing process can; the review states what cannot be carried |

## 0. Frame (5W1H), method, limits

| Question | Answer |
|---|---|
| **What** | A rating, PASS / CAUTION / FAIL, of five parts of `masterplan/04_design_addendum.md`, each against the code it refers to. |
| **Why** | Decision C13 (`decisions/decisions.md:40`): P12-B1 touches the neighbourhood of the capture fence, so the addendum is security-checked before the implementation blueprint adopts it; a FAIL stops the work for the user. C14 (`:41`) adopts it "subject to its security check". |
| **Who** | Reviewer: security-review agent. Next reader: task-architect (implementation blueprint). Decision owner for a FAIL: the user (none raised). |
| **When** | 2026-10-12, 22:05 WIB, after the addendum, before the blueprint. Line numbers are of commit `cf2f8008`. |
| **Where** | `apps/core-server/src` (`CS`), `apps/capture-worker/src` (`WRK`), `packages/shared/src` (`SHARED`), read-only. |
| **How** | Reading and text search. Nothing was built, started, bound to a port, connected to a database or sent to a network. Nothing under `apps/input-av/data/` and no `.env` was opened. No source file and no plan document was changed. The Graft graph was not queried (it refreshes itself before a query, which writes outside this folder). |

**Read in full:** `CS/capture/fence/boot.ts`, `sources.ts`, `operation.ts`, `statements.ts`; `CS/modules/capture-config/plan.ts`, `routes.ts`, `store.ts`, `slices.ts`, `boot.ts`, `fencing.ts`; `CS/capture/adapters/credential.ts`; `CS/transcription/credential-reveal.ts`; `CS/db/migrations/0005_capture_privileges.sql`. **In part:** `CS/capture/adapters/registry.ts:20-136`, `kinds.ts:40-76`; `CS/capture/boot/checks.ts:20-40,320-429`, `boot/index.ts:150-233`; `CS/capture/index.ts:255-335`; `CS/capture/fence/index.ts:318-335,395-430`, `development-discovery.ts:55-75`, `fake-profile.ts:33-42`; `CS/capture-session/index.ts:585-654,1040-1159`; `CS/db/schema/capture.ts:40-196`, `db/mapping/rows.ts:760-804,880-963`, `from-rows.ts:40-75,140-162`, `db/reset/kept-tables.ts:1-110`, `0009_capture_sources_privileges.sql`; `CS/credential-store/index.ts:95-120,225-250`; `CS/core/audit-details.ts:229-240,285-330`; `CS/db/schema/audit.ts:37-50`; `CS/sealing-host/session-reader.ts:225-275`; `CS/capture/adapters/local/process-door.ts:1-110`; `CS/capture/adapters/__tests__/static.test.ts:100-130`; `CS/modules/capture-discovery/connect/service.ts:245-275`; `CS/test-configuration.ts:1-30`; `SHARED/sim/capture-config.ts:75-91,150-250`, `session-machine.ts:132-134,745-770`; `SHARED/api/devices.ts:120-175,455-480`, `state-slices.ts:1107-1117`; `WRK/ingest.c:78-95,136-158,482-490`, `capture_worker.c:104-128`.

**Not opened, so not rated:** the web console and the mobile client; `CS/capture/supervisor.ts` beyond one search hit; the worker beyond the lines above; the credential store's envelope and key files.

**Hypotheses.** A statement about how libavformat behaves is the reviewer's knowledge of that library, not a line read or a run here. Each is marked HYPOTHESIS (HX-n) with what settles it. Requirements are written to hold either way.

## 3. Item 1: P12-B1, the unassigned slot. CAUTION

### 3.1 (a) The state enumeration, re-derived

Derived independently from the code, not from the addendum's table. A slot is U, D or P; four slots give 81 selectors; three operations give 243 states. The fence reads class only (`boot.ts:146-153`), so they fall into the same seven classes the addendum names. The outcomes agree with its table in all 21 cells:

| Line of defence | What it does with U | Evidence |
|---|---|---|
| Fence statement | A NULL slot yields no row: the JOIN on `d.id = s.device_id` drops it. Not a crash, not a development source | `statements.ts:22-27` |
| Fence decision | Reads only assigned rows; empty list passes in both real operations | `boot.ts:146-155` |
| Session start, first line | `selector.cameras.length !== 2` or a missing role is `SELECTOR_SHAPE`, thrown before any registry call | `plan.ts:121-126` |
| Session start, inside the unit | The refusal is thrown inside the unit that would persist `RECORDING`; the unit rolls back; the worker is started only after the commit | `capture-session/index.ts:617-628,646-653` |
| Source builder | Trusts nothing: four slots, an opener behind each, one class, the operation's class | `sources.ts:96-113,121-129` |
| Read-back | The four written rows are read back and held to the operation again | `capture-session/index.ts:635-637` |

States the addendum's table does not list, each checked:

| State | Outcome | Evidence | Safe? |
|---|---|---|---|
| S-1: a NULL slot reaches `assertRecordable` as a line with no device (if WP-13a maps it to a line rather than to an absent line) | `byDevice.get` finds nothing: `DEVICE_UNKNOWN`, turned into `409` | `registry.ts:68-72,121-125`; `plan.ts:140-142` | yes, either mapping |
| S-2: a session is open with a snapshot of four D sources, the selector row is changed behind the Core's back to all U or all P, the Core restarts `REAL_PRODUCTION` | The fence passes (it reads the row, not the snapshot); the start uses the snapshot (`session.captureConfig ?? state.captureConfig`); the production registry holds no D device: refused | `capture-session/index.ts:617`; `registry.ts:80`; `sources.ts:126-128` | yes, by the second and third line |
| S-3: the selector table holds no row | The fence passes; the engine refuses the boot ("must hold exactly one") | `from-rows.ts:59-65,157` | yes, unchanged |
| S-4: a video slot with a device and no profile | Must be refused by the new CHECK; the three existing CHECKs evaluate to NULL and pass, as the addendum says | `capture.ts:145-152` | yes, with the new CHECK |
| S-5: three slots P, the STANDBY microphone U | Refused `SELECTOR_SHAPE`, although a missing standby is tolerated later in the same start | `plan.ts:124`; `capture-session/index.ts:1047` | yes today; pinned by AD-10 |
| **S-6: four slots of a production KIND, one of them a row whose address is loopback** | Boots and records as `PRODUCTION` once the openers exist | section 3.4 | **no: AD-02** |

**Answer to (a).** No state lets a development-kind source record in `REAL_PRODUCTION`, a production-kind source in `REAL_DEVELOPMENT`, or a session mix classes; no session start dereferences a NULL slot in the real path. The proof is about adapter KIND. It says nothing about whether a row of a production kind is a production device: that is S-6.

Unverified by this review, as by the addendum: the simulator's start action. `audioSourceAtStart` falls back by position when a role is absent (`SHARED/sim/session-machine.ts:759-761`). In a real operation it runs before the refusal of `plan.ts:124` inside the same unit, so a throw there is a `500` in place of a `409` and still no recording. It belongs to WP-13a's first step.

### 3.2 (b) Readers of the six columns that assume NOT NULL

Once the columns are nullable the TypeScript compiler flags every reader that goes through the typed row (`CaptureConfigRow`, `capture.ts:192`). It does not flag raw SQL with a hand-written parse. Those are the ones to list by hand.

| # | Reader or writer | Assumption | With a NULL today | In the addendum's change list (1.4)? |
|---|---|---|---|---|
| 1 | `CS/modules/capture-config/store.ts:46-53,85-108` (`READ_CAPTURE_STATE`, `recordOf`) | `text()` throws on anything that is not a string | `CAPTURE_ROW_INVALID`; the boot step `capture.config` stops the start (`boot.ts:66-71`, mounted at `index.ts:128-140`) | **No.** The file is listed as opened (addendum section 13) and not as changed. As written, a production Core with an unassigned slot does **not** boot. Fails closed |
| 2 | `CS/db/mapping/rows.ts:782-804` (`captureConfigToRow`, the WRITER) | Two cameras by position (`:784`); a role found, else **the line at position 0 or 1** (`:785-786`) | `ROW_SHAPE`, the unit fails | **Not by line.** 1.4 #2 says "both directions" and cites the read side only. The positional fallback is the risk: kept after a rewrite, a lone `VIDEO-02` line is written into the `VIDEO-01` columns, and a lone STANDBY microphone becomes PRIMARY |
| 3 | `rows.ts:906-931`, `:957-959` | A device behind every slot | `ROW_SHAPE` at rehydration | yes |
| 4 | `CS/modules/capture-config/slices.ts:31-40,97-123` | The record type is six strings | throws | yes |
| 5 | `CS/capture/fence/statements.ts:22-27` | none: a JOIN | no row | yes (unchanged, correct) |
| 6 | `CS/capture/fence/fake-profile.ts:33-42` | Both video slots named and different | The UPDATE matches no row: a generated source's profile is not corrected when the other slot is empty | no. Harmless, development capture only |
| 7 | `CS/db/mapping/changes.ts:69` | Column list of the write-through | compares NULL as a value | no. Check with #2 |
| 8 | `CS/db/reset/kept-tables.ts:85` | none: carries the row image as text | A NULL survives a reset. The seed then re-adds the five built-in device rows | no. Harmless: they are unlisted and unassignable in production (`sources.ts:166-174`) |
| 9 | `SHARED/sim/capture-config.ts:163-165,193-194,209-212,75-84` (the hosted action `setCaptureConfig`) | A slot line exists for every track and input | "the selector has no such video track": **a slot, once unassigned, cannot be assigned again** | named as NOT VERIFIED (1.4 #4, #5). Verified here: it must be rewritten, not adjusted |
| 10 | Slice readers that take two lines or a role for granted: `plan.ts:121-126` (the refusal); `capture-session/index.ts:952,1052,1183,1196,1249`; `capture-notices/precheck.ts:171-173`; `sealing-host/session-reader.ts:418`; `modules/devices/status.ts:128,167-205` (falls back to `mics[0]`); `modules/capture-inputs/routes.ts:121`; `modules/sessions/routes.ts:442`; `engine/capture-session.ts:106-107`; `SHARED/sim/session-machine.ts:755-761,931`, `selector-in-force.ts:140`, `capture-telemetry.ts:124,170-171`, `capture-notices.ts:241-248,397-427`, `api.ts:347,814,1492,1591` | varies | none is a class bypass: the class is decided from `session_capture_sources`, never from a slice | partly (1.4 #5, #6) |

No missed reader is a bypass of the fence. Reader 1 is a crash that contradicts the design's own acceptance test; writer 2 is a way to move a device into a slot the operator did not choose.

**Requirement AD-04 (WP-13a, gate for its close).**
1. The change list of WP-13a names `store.ts:46-53,85-108` and `rows.ts:782-804`, and the hosted action of row 9 as a rewrite.
2. No reader or writer of the selector works by position: a camera line is found by `trackId`, a microphone line by `role`; the fallbacks of `rows.ts:785-786`, `status.ts:205` and `session-machine.ts:760-761` are removed or answer "absent". A test writes a selector with only `VIDEO-02` and only a STANDBY microphone and reads the row back: `video_01_*` and `mic_primary_id` are NULL.
3. Acceptance, added to the test "the remedy is executable": the boot of the all-unassigned clone in `REAL_PRODUCTION` passes the step `capture.config` by name, not only the fence.
4. The inventory is a test, not a list in a document: a search for the six column names and the six row members over `apps/core-server/src` and `packages/shared/src` equals a stated file list, so that a later reader is seen.

### 3.3 (c) Who may call `unassign`, what it can degrade, what is audited

| Question | Finding | Evidence |
|---|---|---|
| Role | `CAPTURE_CONFIG`: SUPERVISOR and TECHNICIAN | `SHARED/api/devices.ts:470`; `SHARED/sim/vocabulary.ts:40-42` |
| Client kind | Operation 78 has no web-console condition today; `unassign` inherits that. The mobile client of a TECHNICIAN may call it | `devices.ts:463-480` (no access condition beside the permission) |
| A running or sealing session | Refused: the lock is "a session that is not SEALED", read inside the same engine unit as the write; units run one at a time | `SHARED/sim/session-machine.ts:132-134`; `routes.ts:244-252`; `SHARED/sim/capture-config.ts:153-155` |
| The session's own sources | Not affected: an open session records from its snapshot | `capture-session/index.ts:617` |
| Denial of recording | A TECHNICIAN can empty the selector between sessions; no session starts until it is filled. The same role can assign an unreachable device today. Audited | accepted |
| Audit | `CAPTURE_CONFIG_CHANGED` with `from` set and `to` absent expresses a cleared slot inside today's key list; `to` is optional | `audit-details.ts:229-240` |
| A refused edit while locked | Writes no audit row at all, by rule SEC35-19 | `routes.ts:30-31,249-250` |

**Requirement AD-10 (WP-13a).** (1) One audit row per cleared slot, with the track or input and `from`; clearing an empty slot writes none and changes nothing. (2) A table test: `unassign` is refused `409 CAPTURE_CONFIG_LOCKED` in every session state except none and SEALED, the sealing states included. (3) A body that unassigns and assigns the same slot is `422`. (4) `SELECTOR_SHAPE` stays "exactly four": the 21-state table test includes S-5 of section 3.1. (5) The blueprint states the client kinds of operation 78 as a decision; if `unassign` is to be web-console only, that is the existing `WEB_CONSOLE_SESSION` condition (`CS/plugins/permission-guard/denial.ts:46-47`), not a new mechanism.

### 3.4 (d) The doubles under `REAL_PRODUCTION`: can a real installation reach that path?

**Flags and environment: no.** The operation is decided by four configuration members and nothing else (`operation.ts:71-81`). The two production refusals the test must satisfy are test seams of the boot-check mount (`CS/capture/boot/index.ts:103,109,224-225`), and the product's one mount call passes neither (`CS/capture/index.ts:316-324`: `timers` and `sinks` only). A seam or stage can be replaced only on an app built from a marked test configuration, which nothing in `src/` can make (`CS/test-configuration.ts:1-30`). So the development-key refusal (`checks.ts:408`) and the demonstration-password refusal (`checks.ts:411-416`) bite in every real boot today.

That holds only while WP-13b and WP-13c add nothing to those mount calls. The addendum's static rule covers the registry builder ("without a seam argument", 1.6 #2). It does not cover the two boot-check seams, which is where a full-session test is most tempted to inject (the addendum's own NOT VERIFIED note names `checks.ts:334`).

**Requirement AD-08 (WP-13c, with WP-13b; gate for the lift).** (1) The full-session test passes the real boot checks by real means: a signing key without the development mark, made by test support under `apps/core-server/test/`, and fixture operators whose passwords are not the demonstration one. It injects neither `signingKeyIsDevelopment` nor `demoPasswordOperators`. (2) A static rule holds `mountCaptureBootChecks` and `mountCaptureFence` in `src/` to today's argument members, and `src/` to no importer of the test key maker. (3) No configuration key, environment variable or command-line word is added for the test. (4) The sealed package of the test, which reads `PRODUCTION`, is made in a temporary directory, never against `dems_demo`, and removed with it (already the addendum's rule; kept as a check: the directory does not exist after the test).

**The loopback rule: the addendum's fact is wrong, and the gap is real.** Addendum 1.6 #3 says a production row with a loopback address "can be written only by the database owner ... (`dems_app` has no UPDATE on `adapter_kind`)". The runtime role holds:

- table-level INSERT on `capture_devices` (`0005_capture_privileges.sql:27-31`), and `adapter_kind` is written at INSERT. Only its UPDATE is revoked (`0009_capture_sources_privileges.sql:21`);
- UPDATE on `address` (`0005:38-39`);
- UPDATE on the six selector columns (`0005:35-37`).

So whoever holds the runtime role's database credential can insert an `ONVIF_RTSP` row at `127.0.0.1`, or move an adopted camera's address there, and assign it, without the owner role and without the operating-system account of the Core. The fence classes by kind: the selector is "all P" and the Core records a local process as a production camera. The only loopback rule in the code is on a search candidate (`connect/service.ts:249,266-268`), and it reads `^127\.` only. The planned adapter would dial whatever address the row holds. This is finding SEC35-40 ("any local process ... is recorded, and the Core signs a manifest whose every source reads PRODUCTION") arriving by the pull side.

It is not a FAIL: nothing is built, the actor needs the database credential, and one requirement closes it.

**Requirement AD-02 (WP-06b for the rule, WP-13b for the seam, WP-13c for the check; gate for the lift).**
1. The production camera adapter applies the one target function of S13-11 to the **stored** address at every `openSource`, every connection test of an adopted camera and every presence read, before the credential reader is called. Loopback (all of `127.0.0.0/8`, `::1`, names that resolve to them), unspecified, link-local, multicast, and any address of the host itself are refused by a named code; no reveal happens for a refused address.
2. The permissive rule the full-session test needs is a value defined under `apps/core-server/test/`, handed in through the builder's `deps`; `src/` holds no such value (the static rule of 1.6 #2 covers it once "seam argument" includes this member).
3. Check: a clone with an `ONVIF_RTSP` row at `127.0.0.1`, assigned, on a Core built without the test value: session start `409`, 0 reveal entries, 0 relay starts.
4. Erratum to addendum 1.6 #3: the sentence about the database owner is replaced by the three grants above.

### 3.5 Other points of section 1

- **1.4 #7** (an adapter that states an opener is refused unless its class is the operation's): supported. It closes a real hole that opens at the lift (`registry.ts:79-82`, `kinds.ts:72-76`).
- **OBS-1** (a stored production camera is assignable in `SIMULATED`, `routes.ts:194-195`): accepted as harmless. The result is a selector both real operations refuse.
- **First boot, step (b).** It runs a `SIMULATED` Core on the future production database while operators still have the published password. **Requirement AD-13 (WP-27):** the step is done on a loopback listener before the host is connected to the room network, and the procedure says that no session is started in it.

## 4. Item 2: P12-B2, the read path of the stored credential. CAUTION

### 4.1 What holds

| Point | Finding | Evidence |
|---|---|---|
| The reveal function | Returns the user name and the sealed envelope, never a plaintext. EXECUTE: `dems_app` only, PUBLIC revoked. One device per call, bind parameter | `0005:61-75` |
| Opening the envelope | Needs the credential store's key, bound to purpose, device and key reference; a reference of another purpose is refused | `credential-store/index.ts:238-247` |
| Order chosen | Reveal and audit in one unit; the envelope is opened **after** it. So a plaintext can exist only when its audit entry is committed | addendum 2.3, step 2 |
| The other direction | An entry without a credential is possible (the store fails to open after the commit). It over-reports, which is the safe direction | by construction |
| Reconnect | No reveal when the relay re-opens by itself; a new relay is a new reveal. Each loss is its own audited fault (WP-06c), so reconnects are not hidden by the absence of reveal entries; two authentication refusals end the relay | addendum 2.4 |
| Set-IP job | Never calls the reader (C1, C7) | addendum 2.5 |

### 4.2 Weaknesses

**W-1. The reader has no closed list of holders.** The addendum counts callers of the reveal function (1) and of `credentialAtInjection` (1). The reader itself, the one object that returns a live credential, has one rule only: the commissioning files do not import it. It sits in a `deps` bag beside timers and a clock (addendum 6.4, WP-13b), and it already has two consumers, the adapter and the connection test of an adopted camera (addendum 2.3, occasions table). Its `reason` is a parameter, so any holder can label a reveal `SESSION_OPEN`. The audit detail accepts any code as reason (`audit-details.ts:300-304`: `reason: code(REQUIRED)`).

**W-2. The injected value is a plain object.** `credentialAtInjection` returns a frozen object with enumerable `username` and `secret` (`credential.ts:108-125`). A `SealedCredential` prints as a mark (`:37-51`); this object does not. The addendum hands it "as one member of the start message" to the door, and "the door serialises the message whole". The static rule looks for a file that NAMES `.username` or `.secret` (`static.test.ts:115-119`); `JSON.stringify(message)`, a logger given the object, or an error that carries it as its cause read both members and name neither. The rule is blind to exactly the operation the design adds.

**W-3. "Returns after the unit" is not yet "returns after the commit".** The test of 2.6 fails the audit append. It does not fail the commit. A reader that returns between append and commit hands out a credential whose entry may never exist.

**W-4. A reveal for a session cannot be tied to the session.** The detail keys are the device and the reason. The addendum's own invariant, "more than 2 + restarts is a finding", can then be checked by time proximity only. The audit row has a `session_id` column (`db/schema/audit.ts:45`); using it needs no vocabulary change.

**W-5. Memory and dumps of the Core.** The addendum is honest that nothing is erased (CR-3). A JavaScript string of the serialised message cannot be overwritten; only a Buffer can. And nothing in the repository limits a core file, a diagnostic report or a heap snapshot of the Core process (search for `LimitCORE`, `RLIMIT_CORE`, `setrlimit`, `report-on-fatalerror`, `heapsnapshot` in `apps/core-server/src`, `apps/capture-worker/src`, `scripts`: 0 hits). S13-02 (c) protects the relay; the Core holds the same secret at every session start, and the store's key always.

**W-6. A new use of a stored credential.** "Connection test of an adopted camera when the operator types no credential" sends the stored credential on an operator's request. The operator never sees it, and each use is an entry with an actor. It must go to the stored address only, under AD-02's rule, and count against the same lock-out and spacing bounds as operations 95 and 96.

**Requirement AD-03 (WP-06a for 1 to 5, WP-02 and WP-06b for 6).**
1. Static rule: the importers of the reader module are a closed list (the wiring file that builds it; nothing else imports it, holders receive it as a parameter). The holders are two, each given a reader **bound to its reason**: the adapter's can say `SESSION_OPEN` and `RELAY_RESTART`, the connection test's `CONNECTION_TEST`. Neither takes a reason from its caller. The audit detail's `reason` becomes a closed set of those three.
2. The reader returns a credential only after the unit's commit is acknowledged. Tests: audit append fails: 0 credentials, 0 entries (the addendum's); **commit fails: 0 credentials, 0 entries**; the store fails to open after the commit: 0 credentials, 1 entry, 1 error-log code.
3. A reveal for a session writes the session into the audit row's `session_id`. Check: per sealed test session, reveal entries with that session equal the cameras of its plan plus relay restarts.
4. The reader refuses a device that is not a camera of a production kind, and (AD-02) a device whose stored address fails the target rule, before the reveal.
5. W-6: the stored-credential connection test uses the stored address, the existing single-flight and spacing bounds and the lock-out guard; a test shows the fourth refused attempt is not sent.
6. The start message is turned into bytes by **one function in `credential.ts`**, which returns a Buffer the door writes and then zero-fills; no string of it is made. The injection result prints as the mark: `JSON.stringify`, `util.inspect`, `String()` and an `Error` whose cause holds it give 0 occurrences of a fixture secret (a test, beside E-12). The door's errors carry a code and no member of the message.

**Requirement AD-09 (WP-14 and WP-20; WP-02 for point 3).** (1) Host profile: the Core's service unit sets the core-file limit to 0 and is started without a diagnostic-report or heap-snapshot switch; a boot check in `REAL_PRODUCTION` names a core-file limit above 0. (2) The same check for the relay is observed, not assumed: in the container build the relay's limits are read from the process table during a run (this gives S13-02 (c) a track-D check; today only `9A/H-01` covers it). (3) A relay stopped at the 25 s bound, or left by an aborted open, is killed and reaped; E-7's count "0 surviving children" includes that case.

## 5. Item 3: the decision rule of E-11. CAUTION

### 5.1 Is each branch sufficient?

| Branch | For RC-1 and S13-05 | Condition |
|---|---|---|
| A (library refuses a foreign path; random 128-bit path) | Sufficient | The refusal is a comparison of the whole path by the pinned library, on the build that runs in production, and RC-2 holds for every place the path can be written |
| B (the worker compares before it probes) | Sufficient | The value compared is the one the client announced, read before `ingest_connected` and before a byte reaches a file |
| C (the worker pulls; no listener) | Sufficient by construction for SA-2; RC-1 to RC-5 fall away | The changed worker is reviewed before the lift, as 5.4 already orders. See AD-14 |

### 5.2 Is the rule safe against choosing A on a false positive? No.

- **F-1. REFUSED has no control.** O-1 is "to another path than the plan's ... no `ingest_connected`, 0 bytes", 2 runs. A pusher that failed for its own reason (started before the listener, a transport the listener refuses, a rejected description) gives the same record. Nothing in the rule requires the same pusher to succeed on the right path in the same run, or the refusal to be seen as an RTSP status rather than a timeout.
- **F-2. One wrong path is not "any other path".** A comparison by prefix, by last component, without case, or one that ignores a query or a suffix the library adds, refuses a path that is plainly different and accepts a near miss. The secret only helps if the comparison is exact.
- **F-3. HX-1 (HYPOTHESIS).** The reviewer's knowledge of libavformat's RTSP listen mode: on a request whose address differs from the listener's it writes a warning that names both paths, and on the announce request it adopts the client's address. That is row 13's HS-3 and it predicts O-1 ACCEPTED. If it is right, a REFUSED result is a harness fault by definition. It also bears on RC-2: the library can write the expected path. The worker's callback drops everything below error level and withholds a message that contains `://` (`WRK/ingest.c:152-158`); an error-level message that names a bare path is written with its text.
- **F-4. One cell has no branch.** E-11b runs "if O-1 is ACCEPTED". With O-1 REFUSED and O-2 ACCEPTED the rule says "not A" and has no E-11b result to choose between B and C. Branch B's remedy (compare the path) does nothing for that cell: the second client used the right path, so it holds the secret. That cell is an SA-3 matter. Two runs that disagree, and a run that is inconclusive, have no row either.
- **F-5. READABLE can be false.** The public context of a listening input carries the address the worker itself passed in. A probe that prints it "reads a path" that always equals the plan's. E-11b as written does not require the value to change with the client.
- **F-6. The observation is of this Mac's build.** Branch A rests on library behaviour alone; the production host is Ubuntu 24.04 with its own build of the pinned version (the addendum's HA-13 expects the distribution to package another one). E-11 is not repeated there, and after the experiment nothing keeps watching.
- **F-7. Guesses.** With one push per listener per session a timing attack on the comparison has one try per session; no requirement. If WP-11 lets a listener accept again, the comparison of WP-11b must be constant-time.

**Requirement AD-01 (WP-01 for 1 to 5, a gate before WP-03a; WP-14's container for 6; WP-06b or WP-11b for 7).**
1. **Control.** Every REFUSED observation is paired, in the same run and with the same pusher and timing, with an ACCEPTED push to the right path. A run without its control is INCONCLUSIVE.
2. **Near misses.** O-1 is run for: a path that differs from the right one in its last character only; a strict prefix; the right path with one more component; another letter case; a trailing slash; a query string; the percent-encoded form of one character. Branch A needs REFUSED for all, 3 runs each.
3. **Kind of refusal.** REFUSED means the pusher received an RTSP error status to its request and the worker wrote no `ingest_connected` and no byte. A timeout or a refused connection is INCONCLUSIVE.
4. **Decision table completed.** INCONCLUSIVE or disagreeing runs: not A. O-1 REFUSED with O-2 ACCEPTED: branch A's secret plus the rule that a second connect report on a port is a capture fault under SA-3, or branch C; the blueprint states which, and E-11b is run in every case where either observation is ACCEPTED.
5. **E-11b.** READABLE means: for a push to a wrong path the probe program prints a value that equals the wrong path and differs from the address the listener was opened with. Anything else is NOT READABLE.
6. **Build.** The observations that select the branch are repeated in the Ubuntu 24.04 container against the pinned library, and are a line of the hardware package. Until then a selection of A is provisional and the lift (L-2) waits for it.
7. **Kept.** In branch A or B the test "a push to a near-miss path with a live session's secret in force: no `ingest_connected`, 0 bytes in any file" is a permanent test of the worker's suite, so that a library change cannot pass unseen.

**Requirement AD-14 (branch C only).** The review 5.4 orders states, for the worker that pulls: which parts of RC-6 it keeps (TCP only, no datagram socket, no listener, dials only the host of its locator, gives up the right to gain privileges), which it cannot keep because it writes the evidence files, and what stands in their place. "RC-1 to RC-5 fall away" must not be read as "RC-6 falls away".

Residual of O-3 (a wrong-path push consumes the listener): accepted as the addendum records it. It is a detected loss of one camera for one session, bounded by RC-5.

## 6. Item 4: sections 3, 4 and 7. CAUTION

### 6.1 Section 3: parallel opens, 30 s window

No security objection to the parallel open: it mirrors the microphones (`capture-session/index.ts:1105-1112`). Three points:

- The window is how long the loopback listener waits for a push; 30 s doubles that time. Under branches A and B it is guarded by the secret and RC-5. Today the value is a frozen constant with no configuration key (`CS/capture/worker-arguments.ts:33-39`), and the worker accepts up to 600 s (`PROTO:397`).
- Two opens in one turn mean two reveals in flight; each must be one reveal with one entry (AD-03).
- A relay stopped at the bound still holds the credential until it has ended (AD-09 (3)).

**Requirement AD-11 (WP-06b).** The production window is a constant chosen by the operation in code; no environment variable, configuration key or operation changes it. Test: two cameras opened in the same turn give exactly 2 reveal entries, also when one open is aborted.

### 6.2 Section 4.2: microphone registration

| Point | Finding |
|---|---|
| Permission | `CAPTURE_CONFIG`, web console, idle, `REAL_PRODUCTION` only: the permission of camera adoption. Consistent with U10 (the commissioning permission is for network changes). PASS |
| Audit | The search under the existing `CAPTURE_DISCOVERY_SEARCHED` with a third scope; the registration under a new type with no device text. PASS. The scope list is a closed set (`audit-details.ts:321`), so the third value is a vocabulary change for WP-23a although the addendum counts none |
| The body | Card id, device index, input number; everything else re-read by the Core. PASS |
| Device text | The product name is "bounded, control characters stripped" for the answer of the search. The registration then stores product and USB id "from that listing": into `capture_devices.model` (bounded to 120 characters and nothing else, `capture.ts:75-76`) and into `source_facts`, which a sealed package carries. The rule is stated for the screen, not for the store |
| **Helper arguments** | "The adapter enumerates, matches the stored row to a live card, and builds the arguments from the live listing." The rule it keeps says no value read from the **database** reaches an argument. A live listing is text the USB device chose (its product string, and a card id the kernel derives from it). That is a worse origin than the database, and the kept rule does not see it |

**Requirement AD-07 (WP-07a for 1 to 3, WP-07c for 4, WP-08 for 2).**
1. Every string taken from a card listing passes one function before it leaves the adapter, for the screen and for the store alike: printable ASCII only, a stated length, no control, bidirectional or zero-width character; the USB id is held to four hexadecimal digits, a colon, four hexadecimal digits; the card id to the kernel's own form. A string that fails is replaced by a fixed word, never passed on. This is S13-12 (b), extended by name to WP-07a and WP-07c.
2. The helper's device argument is built by a table function from two integers (card index, device index). No descriptor string and no card id forms any part of an argument. The amendment of static rule G-R12 (addendum 8.3) says so in its text.
3. The card search is single-flight and spaced like the camera search; it starts a process on every call.
4. The match of a stored row to a live card uses the USB id and the port path where the system offers one; a card with the same product on another port is `CARD_CHANGED`, a new audit entry, and not a silent match.

### 6.3 Section 7: the profile code minted from the stream

The decision is sound: the sealed rule (`session-reader.ts:261-266`) stays unedited, which keeps "sealing unchanged".

**Can a camera choose text that reaches a sealed manifest or a log?** The code is `<codec>_<picture><rate>` (`session-reader.ts:246-250`). `streamProfileOf` takes `codec` as a string and adds it unchecked. On the sealing side that string comes from the Core's own reading of the file's sample entry, a closed set (`session-reader.ts:268-273`). The addendum mints the code "from the codec, the picture size and the parameter-set bytes **the relay's probe mode reports**". If that codec is a name the relay passes on (a library codec name, or the encoding name of the stream description, which the camera writes), camera-chosen text enters the code. The selector's column is held to the code pattern (`capture.ts:145`), which bounds the damage to 64 upper-case characters; `capture_devices.profiles` is checked for being an array and nothing more (`capture.ts:78`). From there the value reaches the device slice, the audit detail of a selector change (`from`, `to`) and the session's snapshot.

Width and height are numbers; a negative or non-finite one fails the pattern and is refused. No finding there, once they are bounded.

One loss the addendum's rule accepts and should state: for HEVC the code has no rate, so a later change of frame rate on an HEVC camera raises no notice (`session-reader.ts:264-265`). It follows from the sealed rule, not from the addendum.

**Requirement AD-06 (WP-05; WP-24 for 4).**
1. The codec of a minted code is one of a closed set, decided by the Core's own parse of the parameter-set bytes with the function the seal uses. No string from the relay, the stream description or an ONVIF answer is ever a part of the code.
2. Width and height are integers inside stated bounds; the assembled code is held to the profile pattern before it is stored or shown; a failure is a code, and the test is not passed.
3. The probe report of the relay is a frame of fixed shape and bounded size, checked by a schema as the worker's frames are; the parameter-set bytes have a stated maximum.
4. Each element of `capture_devices.profiles` is held to the code pattern, in code at the write and by a CHECK in schema set A.
5. Check: a fixture camera whose description names a codec with lower-case letters, markup characters and 300 characters: the minted code is of the closed set or the test fails by name; 0 occurrences of the fixture text in the log sink, the audit table and the device rows.

## 7. Item 5: the requirements table of section 9. CAUTION

Every S13-01 to S13-17 and RC-1 to RC-6 has a line and a package. The count claim (61 identifiers, 0 without a home) is confirmed for section 9.4. The question was whether each acceptance check would detect a violation. Nine would not, or lost a clause of the first review:

| Id | What the first review required | What the table's check is | Diluted how |
|---|---|---|---|
| **RC-1** | A wrong-path push never reaches `ingest_connected`; 0 bytes | "E-11 recorded; branch selected" | A process step. It detects nothing after the experiment (AD-01 (7)) |
| **RC-2** | Not in a log line, an audit detail, a row, an **error text** or a **file**; a **static test** and a runtime search | "128 bits; 0 hits in logs, audit and tables" | The static test, the error texts and the files are gone. The files matter: the worker's own log file, the boot-probe log, the session facts file, the relay's two outputs (see F-3) |
| **RC-3** | Nothing of that track is sealed as that camera | "5.3, SA-3; both orders" | The fault is checked, not the seal. Under SA-3 the foreign bytes are already in the camera file when the fault is raised |
| **RC-6** | Dials only the host of its locator; opens no file after start (static check); gives up privileges and file-system access before the first camera byte | "0 listening, 0 datagram; directory 0700, pipes 0600" | Three clauses have no check. The first is the important one: HX-2 (HYPOTHESIS), the RTSP client follows a redirect and control addresses to another host, and would take the credential there |
| S13-02 | Seven points (a) to (g) | "the seven points of 2.5" | A pointer. (a), (b), (c) and (e) have no observable check in track D; (c) is covered on the real host only |
| S13-04 (d) | A refused RTSP authentication counts against the guard | carried by WP-05, no check | No check |
| S13-12 (b) | Every device string bounded and held to a character rule before it leaves the adapter | "device text reaches no log, audit detail or error" | The store and the screen are not checked; the new sources of device text (USB descriptor, stream description) are outside its packages (AD-06, AD-07) |
| S13-14 (e) | Whether the release packager can reach `apps/input-av` | absent | Dropped |
| S13-16 | Six points | "each ... has a line in the named package" | A pointer |

**Requirement AD-05 (WP-06b for RC-2 and RC-3, WP-03a for RC-6, WP-11b in branch B).**
1. RC-2: a static test that the ingest address is built in one function and reaches the plan frame and the start message only; a runtime search for the secret of a test session in the log sink, the persistent error log, the audit table, the session tables, **the worker's log file, the boot-probe log, the facts file and the relay's outputs**, in a good run and in a run with a foreign wrong-path push: 0 hits. If the worker's log file shows a hit, the worker's callback changes and "unchanged worker" no longer holds.
2. RC-3: after the SA-3 fault, in both orders, the session's package, if one is sealed, holds 0 fragments and no manifest entry for that track, and the fault's audit entry exists.
3. RC-6: the fixture camera answers with a redirect to a second loopback port, and with a description whose control address names another host: connections and credential-bearing requests received there: 0. A static check that the relay's source opens no file after start. In the container, the relay's "no new privileges" state is read from the process table.

**Requirement AD-12 (blueprint, section 9.4).** S13-02: one check per point (a) to (g), with (c) by AD-09 (2). S13-04 (d): the fixture refuses the RTSP credential twice; the guard's count for that host rises by 2 and a third attempt is not sent. S13-12 (b): AD-06 (5) and AD-07 (1) are its checks. S13-14 (e): the first package that touches `scripts/release/` reports whether the packager can reach `apps/input-av`. S13-16: its six points as six lines with a check each.

Not diluted, confirmed against the first review: S13-01, S13-03, S13-05 (as a gate), S13-08, S13-09, S13-10, S13-11, S13-13, S13-15, S13-17, RC-4, RC-5.

## 8. Hypotheses of this review

| Id | Statement | Settled by |
|---|---|---|
| HX-1 | libavformat's RTSP listen mode does not refuse a foreign path: it warns, names both paths, and adopts the client's address on the announce request | E-11 with AD-01 (1) to (3) |
| HX-2 | The RTSP client follows a redirect and control addresses to another host and takes the account with it | AD-05 (3) |
| HX-3 | An error-level library message can name a bare path, which the worker's callback would write | AD-05 (1), the run with a foreign push |

## 9. Assumptions, gaps, alternatives

- **Assumption.** The three verification documents of rows 11 to 13 are accurate where this review did not re-open a line. The grants were read from migrations 0005 and 0009 only; a later migration that changes them was searched for by name (`capture_devices`, `adapter_kind` in 0008 and 0009) and not found, but migrations 0010 to 0014 were not read in full.
- **Gap.** The clients were not opened: whether a client crashes on a selector with fewer than two lines is not rated (the addendum's WP-13a measures it first).
- **Gap.** The audit writer's path from outside an engine unit (a reveal entry written while a session start runs in the background) was not traced; AD-03 (2) is written as an outcome so that it holds for whichever unit is used.
- **Alternative considered for AD-02:** a database CHECK that refuses a loopback address on a production kind. Not recommended as the only measure: the host's own addresses and names cannot be expressed in a CHECK, and the rule belongs with the target function of S13-11. It can be added as a backstop in schema set A.
- **Alternative considered for item 1:** rating the SIMULATED first-boot route (step (b)) as a FAIL because it runs a simulated Core on the production database. Not taken: the two production refusals still stand between that database and a production boot, and AD-13 bounds the exposure.

---
*Generated: 2026-10-12 22:05 WIB*
*Last Updated: 2026-10-12 22:05 WIB*
