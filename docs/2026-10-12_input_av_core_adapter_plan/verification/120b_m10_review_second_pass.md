---
task_id: 2026-10-12_input_av_core_adapter_plan
task_slug: input_av_core_adapter_plan
date: 2026-10-14
agent: senior-code-reviewer
blueprint_row: 120b
milestone: M10
type: SECOND PASS of the code review of phases 8 and 10 (rows 94 to 118 and 194 to 198) AS COMMITTED - exactly what the first pass (row 120) did not read
narrative_tier: 1
baseline: branch task4/input-av-core-port, head 1fbeada7, read from an export of that commit (`git archive`), never from the working tree
verdict_this_pass: APPROVED WITH COMMENTS (0 new blocking findings)
verdict_m10_both_passes: CHANGES REQUESTED stands until B-1 is re-checked (row H4); then APPROVED WITH COMMENTS
blocking_findings: 1 across both passes (B-1 of row 120, unchanged); 0 new
follow_ups_this_pass: 11 (S2-01 to S2-11): 2 medium, 9 low
tests_surviving_a_mutation_this_pass: 9 tests under 6 mutations, all BY READING (nothing was run)
status: needs-review (lists A, B and C are read as section 8 says; four named parts of phases 8 and 10 were read by NO pass: section 9)
---

# Row 120b: second pass of the code review of phases 8 and 10

## 1. Verdict

**This pass: APPROVED WITH COMMENTS. New BLOCKING findings: 0. Follow-ups: 11. Blocking findings
across both passes: 1 (B-1 of row 120, a TEST file, in row H4's hands and not yet re-checked).**

Nothing read here lets a caller do what the design forbids. The four things the brief asked to be
traced hold in the committed code, each with a test that would go red without it:

| Question of the brief | Answer | Held by |
|---|---|---|
| Re-address: one audit entry per confirmed change | Yes: one `append` inside the unit (`CS/modules/capture-discovery/readdress.ts:297`) | `readdress.db.test.ts` ("CONFIRMED": the entries after the head are exactly one) |
| Row and slice change together | Yes: the engine door writes the slice and, by `flush`, the column in the caller's unit (`CS/engine/host.ts:804-824`) | `readdress-door.db.test.ts` ("TOGETHER", "OR NOT AT ALL": tables byte-equal after a failed unit) |
| Refused while a session is open | Yes, three times: route (`readdress-route.ts:246`), before the unit (`readdress.ts:246`), inside it (`:280`) | unit test `sessionOpensInUnit`; database test "LOCKED" |
| Never automatic | Yes: a private symbol brand with ONE maker, whose callers are a closed list of one file | `readdress.test.ts:204-220`; static rule 6 (`static.test.ts:213`, with planted controls) |
| Commissioning permission on every operation of the group | Yes: nine routes, each `routeOfOperation(...)` of a registry entry that carries `CAPTURE_COMMISSION_ACCESS` (permission and `WEB_CONSOLE_SESSION`); the role matrix is `editable: false` | four database tests: 403 for INVESTIGATOR and SUPERVISOR, 403 `WEB_CONSOLE_ONLY` for the technician on a tablet, one `ACCESS_DENIED` row each |
| A reader sees a NEW value before a commit that rolls back | No. The value is handed over by `unit.afterCommit` only (`network/service.ts:221`), and the pipeline runs those tasks after `commit()` returned true (`CS/core/pipeline.ts:199`) | **no test** - see T-1, the worst survivor of this pass |
| A reader sees a STALE value after a commit | **Yes, in three cases** - finding S2-01 | - |

The two medium findings are S2-01 (the reader of the network facts has no way back to the stored
row) and S2-02 (the "stored port list" of the destination rule has no production source: only
port 80 can ever be dialled). Both fail closed.

## 0. Frame (5W1H), method, limits

| Question | Answer |
|---|---|
| **What** | (A) product code the first pass skipped: the network configuration operations, the USES of the destination rule by phases 8 and 10, the re-address chain end to end, the commissioning permission, the typed-address probe, the alias client, caller, protocol and store; (B) the bodies of the Core-side tests of those rows; (C) the web files the first pass skipped and the re-address dialog; then the closing statement for M10 |
| **Why** | Decision C114: the first pass was PARTIAL and said so; gate M10 (row 121) needs "0 blocking, or each routed and re-checked" for what was not read |
| **Who** | senior-code-reviewer, read-only on source. Affected: the controller (row 121), the owners named per finding |
| **When** | 2026-10-14 09:03 WIB, head 1fbeada7 |
| **Where** | `/Users/gsp-budi/Documents/DEMS`. `CS/` = `apps/core-server/src/`, `SH/` = `packages/shared/src/`, `WEB/` = `apps/core-web/src/` |
| **How** | `git archive 1fbeada7` of the four source trees into the session scratchpad, then file reads and text searches there; `git show 1fbeada7:` for three files outside the export. Each claim with file:line of that commit. **Nothing was run**: no suite, no database, no port, no container. Graft was not queried (it refreshes its graph before a query; the brief is read-only): use counts come from `grep -rn` over the export, named where used |

**Limits.** Every "survives" in section 6 is BY READING: no mutant was planted. Test files were
read with long lines cut at about 200 characters, so the far end of some assertions was not seen.
Nothing is proven on Linux. The in-flight edits named in the brief were not looked at.

## 2. Findings of this pass

Severity is this review's. None is blocking.

| # | Sev. | Finding | Where | Why it matters | Row | Smallest fix |
|---|---|---|---|---|---|---|
| **S2-01** | Medium | **The reader of the network facts has no way back to the stored row.** It holds `interfaceName` and `cameraSubnet` in memory, loaded once at boot and replaced only by `afterCommit` of operation 102. Three cases leave it STALE after a commit: (a) a `COMMIT` whose answer is lost is thrown as `COMMIT_FAILED`, the tasks never run, the row may be stored; (b) the no-change path returns before `committed` (60e E-09); (c) a demo reset empties the table and does not tell the reader (row 108's own request line, not traced here) | `CS/modules/capture-config/network/index.ts:162, 176, 217-221`; `service.ts:195-203, 221`; `CS/core/unit-of-work.ts:396-401`; `CS/core/pipeline.ts:199`; `delegation_progress/file_requests.md:311` | Operation 101 answers from the DATABASE, the destination rule and the alias caller's file-against-row check (`storedInterface()`, `index.ts:176`) judge on MEMORY. After (a) the screen shows the new interface while every `add` answers `INTERFACE_FILE_DIFFERS_FROM_ROW` and every address of the new subnet is refused, until a restart; the retry of the same body is a `REVISION_CONFLICT`, and the corrected retry that changes nothing takes path (b). Fails closed; a field failure with no way out but a restart. The engine marks itself `suspect` on a failed commit (`engine/host.ts:629`) and reloads; this reader does not | 108 | In `changeNetworkConfig`, hand the row READ in the unit to the reader whenever the unit ends without a write of its own (no change, revision conflict): a row read before any write of the unit is a committed row. One case each. This closes E-09 as well |
| **S2-02** | Medium, a ruling | **"The port from the short stored list" (S13-11 point 3) has no stored list.** `allowedPorts` is a member of the rule's context that no production file sets (`grep -rn allowedPorts CS/`, tests left out: the rule's own three lines). `networkFactsOf` builds the context without it, so the list is always `[80]` | `CS/capture/destination-rule.ts:167, 326-327, 371`; `network/facts.ts:155-160`; `network/store.ts:22-29` (six settings, no port) | A camera whose ONVIF service is on another port is listed by a search with `host:port`, and its re-address is `422` for ever (`readdress.ts:261-272`: the port goes to the rule, `PORT_NOT_LISTED`). By the rule's text the same holds at every open of a stored `host:port` address; that path (`stored-address.ts`) was NOT traced here. Whether the bench cameras answer on 80 is not known to this review. Security review 119 rated the point PASS on the function, not on its source | 95, 108 | A ruling: either the procedure and the settings screen say "ONVIF on port 80 only", or a seventh setting with the rule's own bound of 8. Until then `readdress.test.ts:193` (the 8080 case) asserts on a context production cannot make |
| **S2-03** | Low | **Point 4 of the rule is dead code, and exists three times.** `scanSizeRefusal`, `spacingAllowance`, `DestinationSpacing`, `DESTINATION_MIN_INTERVAL_MS`, `SCAN_MAX_STORED_ADDRESSES`, `SCAN_MAX_TYPED_ADDRESSES` have no product caller (`grep -rn` over `CS/`: the rule file and its test). The scan has its own gate, the typed probe its own arithmetic, the scan's size is the contract's limit | `destination-rule.ts:113-137, 454-484`; `factory-scan/service.ts:292-315, 562`; `modules/capture-discovery/search.ts:322-329` | The header says "Four callers, one function, the same refusals" (`:6`); for point 4 the function is called by nobody. Three tests hold code no request reaches (T-4). The F-3 family of the first pass | 95, 96, 107 | Delete the six exports with their cases, or make the gate and the search call `spacingAllowance` |
| **S2-04** | Low | The configured gateway has no production source either: `gatewayAddress` is read by the rule and set by nobody | `destination-rule.ts:391, 430-434, 441` | "Not the gateway's" (S13-11, set-IP) holds for the gateway the REQUEST names only. A live gateway is still caught by "does it answer" | 95, 111 | Say so in the header, or drop the member |
| **S2-05** | Low | `READDRESS_ADDRESS_TAKEN` compares stored TEXT (`entry.host === target.address`): `a.b.c.d` and `a.b.c.d:8080` are two addresses to it. And the door's seam takes an instant (`at`) that nothing stores | `readdress.ts:173, 285, 288`; `readdress-route.ts:215-217` | Moot while S2-02 stands (only port-less addresses pass the rule); live the day a port list exists | 97, 197 | Compare `storedHostLiteral` of both; drop `at` |
| **S2-06** | Low | The re-address dialog: (a) the confirming button is enabled while the registered address is "unknown" (the operator confirms one of two addresses); (b) after an unanswered request the same press is offered again, and when the first one was stored the answer reads "The camera already has this address" with "nothing was changed" appended | `WEB/features/devices/camera-readdress-dialog.tsx:64-68, 99, 143-145, 175`; `camera-readdress.ts:158-160` | (b) tells the operator the opposite of what happened. One audit entry all the same | 198 | Disable the button while `registered === null`; after an attempt of kind `OTHER`, word `READDRESS_ADDRESS_UNCHANGED` as "the address is stored" |
| **S2-07** | Low | A helper refusal reaches the technician as a code word: the contract's sentence plus `cause: HELPER_INTERFACE_DOWN`; the alias panel prints `removeError` the same way. `HELPER_REFUSAL_KINDS` (F-12) is still read by no screen | `WEB/features/commissioning/refusal.ts:24-27`; `index.tsx:671-679` (the alias panel's `removeError` alert) | R119b-03 item 1 is half met: the code is exact now, the sentence ("the camera cable is not connected") is not there | 112, 113 | Five sentences for 38, 46, 47, 48, 55 |
| **S2-08** | Low | Stale statements, new places (the F-15 family) | `SH/api/capture-discovery.ts:1140` ("no Core route exists yet ... no dialog"); `readdress.test.ts:11`; `network/__tests__/routes.db.test.ts:20`; `factory-scan/__tests__/service.test.ts:5, 13` and `routes.db.test.ts:19`; `camera-network/__tests__/service.test.ts:256` and `routes.db.test.ts:223` ("THE PRODUCT AS COMPOSED TODAY: ... without the observations of the host" - composed since row 111b, `capture-composition.ts:722-725`); `WEB/features/commissioning/model.ts:160`, `refusal.ts:9, 19` ("thirteen reasons": fifteen) | A reader is told a state that is over | 96, 107, 108, 111, 112, 194 | The text pass of F-15 |
| **S2-09** | Low | Test hygiene, by reading: (a) `freeFakeOnvifPorts()` picks ports and releases them; the "moved" ports are bound later in the test, with no reservation; (b) one sleep stands for an event: `setTimeout(150)` then `settled === false` is all that holds "the second INSERT waits" (`installation-acceptance/__tests__/routes.db.test.ts:390`) - an INSERT that is merely slow passes; (c) a real-time bound of 200 ms with an upper limit of +1,500 ms (`__tests__/host-alias-socket.test.ts:194`); (d) `settle()` is twenty turns of the event loop (`lifecycle.test.ts:67-69`). No fixed port, no `listen(` on a number, was found in any file read | as cited | (a) and (c) are the kind that turn red on a loaded host - decision C105 records six failures that passed on a re-run | 107, 111, 105, 117 | (b): assert on `pg_locks` or on the order of the two commits; (a): bind the moved ports at `start` and hold them |
| **S2-10** | Low | The node-owner check of the socket client is not tested alone, and cannot be on this Mac: folder and node always have one owner, so "the folder speaks first" (the test says so) | `CS/host-alias-socket.ts:122`; `__tests__/host-alias-socket.test.ts:329-337` | T-3. The check that matters on an installation is the one no test reaches | 105 | One line in hardware check `9A/H-05`: a socket of another owner in a root-owned folder is refused |
| **S2-11** | Low | The typed-address control hands an allowed decision on after checking only that `destination` is an object; its four members are trusted | `CS/modules/capture-discovery/typed-address.ts:73` | Today the one rule handed in is the fence's binding, and the adapter asks again whether the source is held (`ws-discovery.ts:191`). A second defence that is thinner than its comment | 96 | Check the four members as the scan and the job do (`factory-scan/service.ts:425`) |

## 3. The six parts of list A, each answered

**(1) The network configuration operations.** Sound. Compare-and-set on `revision` in the
statement itself, `ON CONFLICT DO NOTHING` for the first row, the session asked before the unit
and inside it, one audit entry of setting NAMES. The write-time forms are asked of the rule itself
(`facts.ts:167-185`), not restated. Finding: S2-01. Note: `judge` holds two checks the route's
schema already makes (the list's length, a factory address the rule does not class as private);
neither has a case in the service test, both are a second line and not a hole.

**(2) The destination rule's uses.** `viaAlias` is read consistently in the four places that use
it: the scan plans a direct target only when `viaAlias === false` and an alias target only when
the rule names THAT alias as the source (`factory-scan/service.ts:463, 472, 619, 652`); the job
does the same and judges again on the host's facts after the helper said "in place"
(`camera-network/service.ts:628, 634, 870, 962`). `TYPED_PROBE` and `STORED_CAMERA` are not in
`ALIAS_PURPOSES` (`destination-rule.ts:104`): a typed or stored address can never be reached from
an alias, and `destination-rule.test.ts` says so for every purpose. Each binder turns a reader that
throws or answers nothing into the facts of an unknown host (`production-parts.ts:65-75, 90-100,
604-615`). Findings: S2-02, S2-03, S2-04.

**(3) The re-address chain.** As section 1. The production camera adapter reads
`capture_devices.address` at every open (`capture-composition.ts:197`), so a confirmed change is
what the next open uses; the database test asserts that statement's answer. Findings: S2-05, S2-06.

**(4) The commissioning permission.** The group is NINE operations: 101 to 107, 109, 110.
Operation 108 is the test of a registered camera (row 146) and operation 100 the re-address; both
are `CAPTURE_CONFIG` on a web console session BY CONTRACT (`SH/api/capture-discovery.ts:593,
1284`), so a SUPERVISOR reaches them - the database test uses exactly that. No operation of the
nine is reachable with another permission: each route takes its access from the registry entry
(`routeOfOperation`, `plugins/permission-guard/index.ts:210-220`), and `WEB_CONSOLE_SESSION`
refuses every session bound to a device (`decision.ts:232-248`). `apps/mobile/src` names none of
the eleven paths (`grep`: no line). The in-app simulator asks the same three things in the same
order (`SH/sim/api.ts:1323`, read by that line only).

**(5) The typed-address probe.** Refused until a rule is handed in, once per app
(`typed-address.ts:57-63`); the web-console condition is asked in the handler before the rule
(`capture-discovery/routes.ts:128-131`); a refusal is one sentence without the rule's word. Finding:
S2-11.

**(6) The alias client, caller, protocol and store.** No new defect. Open end E-12 (a) of pass
60e is ANSWERED: a helper call is bounded at 35 s by the transport (`host-alias-socket.ts:71,
150`); the preflight and the two journal units around it have no bound of their own, and the job's
own `bounded` does not cover them - so a job can outlast its stated time by up to two calls. The
`note=already-absent` of F-1 is in the helper's journal line only (`dems-core-netalias:804`), not
in the answer the Core parses. `store.ts:80` is a seventh address pattern for F-3.

## 4. The web files (list C)

**The typed credential as code** was judged by the first pass on `set-ip.tsx`; this pass adds the
model: the body is the argument of one call and of nothing else (`set-ip-model.ts:74-80`,
`startCameraNetworkJob`), a failure keeps status and codes and the presenter's envelope, never the
request (`model.ts:93-100`, `liveFailure`), and the panel's error boundary keeps one flag, not the
error (`parts.tsx:73-76`).

**The acceptance form against the contract.** The step list is the contract's
(`ACCEPTANCE_STEP_IDS`, drawn with the id of the hardware package and the contract's title); per
check a "passed" box, a "not run" box and a one-line note. The Core records an acceptance with
FAILED and NOT-RUN checks (`service.test.ts`: 25 of 27 passed is stored; driver decision DD-2 of
row 116), and the screen then says "in force" beside "25 of 27". That is as ruled; the gate should
know that "accepted" does not mean "every check passed". There is no read (decision C80): after a
reload the page cannot say whether an acceptance is in force, and says so.

**What an operator is told on a refusal.**

| Refusal | Words |
|---|---|
| The fifteen commissioning reasons, the seven acceptance reasons, the six re-address reasons | the CONTRACT's sentence, never the answer's text |
| A helper refusal behind `HOST_ALIAS_FAILED` / `HOST_ALIAS_REMOVE_FAILED` | the sentence and a code word (S2-07) |
| A session is open, a stale revision, the role, a body not accepted | the console's own sentence each |
| Set-IP: not available, address not allowed, lock-out guard, spacing | a sentence of its own each; "not available" says both causes |
| An outage, a time-out, a 5xx | the shared presenter, else one record of codes |

The console's own sentences live in `i18n-web.ts`, which this pass did NOT read: the table is
about which sentence is chosen, not about its wording.

## 5. Notes, no row asked

- N-1. Operation 100 writes `permission: CAPTURE_CONFIG` into its audit entry as a literal
  (`readdress.ts:295`), not from the registry entry. Equal today.
- N-2. `changeNetworkConfig` does not ask the commissioning turn (60e E-08): unchanged, no owner.
- N-3. The walker of the contract (`test/acceptance/contract.test.ts:1273-1474`) runs operations
  103, 105 and 106 on doubles put in through `replaceForTest`: it proves the route, the status and
  the answer's shape, not the function. It says so.

## 6. Tests that would survive a mutation, named (this pass: BY READING)

| # | Test (file:line) | Mutation | Why it survives |
|---|---|---|---|
| **T-1** | `network/__tests__/service.test.ts:478` "a unit that rolls back (the audit writer fails) ... hands NOTHING to the reader" and `routes.db.test.ts:347` "a unit that fails AFTER its statement ran rolls back as a whole" | `unit.afterCommit(() => seams.committed(after))` becomes `seams.committed(after)` (`network/service.ts:221`) | **The worst of this pass.** Both failures are injected BEFORE that line (the audit writer, the update), so the call is never reached either way. No case has a unit whose WORK resolves and whose COMMIT fails. The property the file header promises - "never for a unit that rolled back" - is held by no test; no static pin of the line was found under `capture-config` |
| T-3 | `__tests__/host-alias-socket.test.ts:329` "the node or its folder is not the trusted owner's" | `node.uid !== trustedOwnerUid` removed (`host-alias-socket.ts:122`) | the folder's check answers first (S2-10) |
| T-4 | `capture/__tests__/destination-rule.test.ts:308`, `:321`, `:327` (point 4: size and spacings) | the spacing of the scan or of the typed probe removed or inverted where the PRODUCT holds it (`factory-scan/service.ts:292-315`, `search.ts:324-329`) | the three test functions no product file calls (S2-03). The scan's own spacing has its own case; the typed probe's (`search.test.ts`) was not read |
| T-5 | `capture-discovery/__tests__/readdress.test.ts:193` "a candidate whose service address names a port" | - (asserts on its own fixture) | the case passes on `allowedPorts: [80, 8080]`, a context no production code can build (S2-02) |
| T-6 | `camera-network/__tests__/service.test.ts:271` "THE AGE OF THE SCAN: one millisecond older than the bound" | `scanAge > MAX` becomes `>=` (`camera-network/service.ts:644`) | no case stands exactly at the bound |
| T-7 | `capture/host-alias/__tests__/lifecycle.test.ts:284` "a removal the helper answers NOT_MARKED ... the row is closed" | the reason the row is closed with on that path changed | the case asserts the two entry types and "no open row", not the reason (the neighbour of F-9) |

Counted: 9 tests (2 + 1 + 3 + 1 + 1 + 1), 6 mutations. With the first pass: 20 named tests (8
measured there, 12 by reading).

What was asked and found sound: every negative control read is negative (each refused-role,
refused-address and "0 requests at the stub" table has a positive case beside it in the same
block); the caller test compares the 41 codes with the helper's delivered FILE, not with a copy
(`caller.test.ts:174-187`: R119b-03 is closed in the committed code).

## 7. What was done well

- The re-address is proven where it matters: the database test reads the very statement the camera
  adapter runs at an open, checks the credential rows by checksum, and counts connections and
  datagrams to show that nothing was sent.
- The engine-door test asserts "or not at all" on table checksums and on the identity of the state
  object, and carries a static rule with planted controls for "who writes a device address".
- The set-IP tests search for what was typed by COUNT in everything written, the process
  environment and the arguments of the stand-in programs included.
- Refusal tables state the order ("before the unit", "inside it") and assert the count of units.

## 8. Read in full / in part / not read - BOTH passes together

| | Files |
|---|---|
| **Read in full by pass 1 (row 120)** | the helper, its two unit files, `make_test_copy.py`, its suite (as committed); `CS/host-alias-socket.ts`; `CS/capture/host-alias/protocol.ts`, `caller.ts`, `lifecycle.ts`, `journal.ts`, `store.ts`, `facts.ts`, `index.ts`; migrations 0017, 0018, 0019, 0021, 0022, 0024, 0026, 0028; `installation-acceptance/service.ts`; `WEB/features/commissioning/acceptance-model.ts` |
| **Read in full by pass 2 (this row)** | PRODUCT: `network/store.ts`, `service.ts`, `routes.ts`, `index.ts`, `facts.ts`; `capture/destination-rule.ts`; `capture-discovery/readdress.ts`, `readdress-route.ts`, `typed-address.ts`; `host-alias-socket.ts`, `host-alias/protocol.ts` (but its table `:22-63`), `store.ts`; WEB: `commissioning/index.tsx` (from `:40`), `model.ts`, `set-ip-model.ts`, `refusal.ts`, `report.ts`, `parts.tsx`, `acceptance.tsx`, `devices/camera-readdress.ts`, `camera-readdress-dialog.tsx`. TESTS (long lines cut): `network/__tests__/service.test.ts`, `routes.db.test.ts`; `factory-scan/__tests__/service.test.ts`; `camera-network/__tests__/service.test.ts`; `capture/host-alias/__tests__/caller.test.ts`, `lifecycle.test.ts`; `__tests__/host-alias-socket.test.ts`; `capture-config/host-alias/__tests__/service.test.ts`; `capture-discovery/__tests__/readdress.test.ts` |
| **Read in part by pass 2** | `host-alias/caller.ts` (`:1-60, 100-135, 195-496`); `capture/fence/production-parts.ts` (`:40-250, 590-680`); the `viaAlias` lines of the scan and the job; `capture-discovery/routes.ts` (`:18-34, 64-76, 112-150`), `search.ts` (`:318-340` and the typed lines); `engine/internal-actions.ts` (`:70-100`), `engine/host.ts` (`:740-845`), `core/unit-of-work.ts` (`:370-440`), `core/pipeline.ts` (`:142-207`); `SH/sim/capture-registry.ts` (`:170-250`), `SH/api/capture-discovery.ts` (`:1135-1292`), the access lines of the two contract files, `SH/sim/auth.ts` (`:60-90`); `plugins/permission-guard/index.ts` (`:210-238`) and `decision.ts` (by search). TESTS: `lifecycle.db.test.ts` (from `:40`), `readdress.db.test.ts` (header and from the first helper), `readdress-door.db.test.ts` (from `:60`), `destination-rule.test.ts` (all but its imports and about twenty lines of the set-IP block), `factory-scan/__tests__/routes.db.test.ts` and `camera-network/__tests__/routes.db.test.ts` (headers and from their `beforeAll`), `installation-acceptance/__tests__/service.test.ts` (`:203-640`, completing pass 1's ranges but for `:1-57`), its `routes.db.test.ts` (**assertion lines only**), `test/acceptance/contract.test.ts` (`:1228-1520`), `capture-discovery/__tests__/static.test.ts` (rule 6, by search) |
| **Read by pass 60e or by review 119, not by 120 or 120b** | `camera-network/service.ts`, `index.ts`, `routes.ts`, `store.ts`; `factory-scan/service.ts`, `index.ts`, `routes.ts`; `capture-config/host-alias/index.ts`, `routes.ts`; `adapters/camera/onvif-network.ts`, `stored-address.ts`; `capture-composition.ts` (`:330-834`) - for exits, refusal paths and the security rating, not for duplication or tests |
| **Read by NO pass** | section 9 |

## 9. What of phases 8 and 10 was read by NO pass

1. **`CS/__tests__/capture-composition.db.test.ts` and `capture-composition.test.ts`.** The only
   place where operations 104 and 105 meet a REAL lifecycle on a booted production Core (block
   "row 106b"), and where the one reader is handed to its three takers (`capture-composition.ts:
   822-828`). Everything else for 104 / 105 runs on a double of the lifecycle.
2. **24 of the 28 implementation records** (095 to 118, 194 to 198, h2, v6, v6b but for 099, 114,
   d2, d3 in part). No statement of either pass was checked against what a row CLAIMED it built.
3. **The schema's own tests and typed side**: `set10` to `set14.db.test.ts`, `db/schema/*.ts`, the
   snapshots; and the shared-package tests of the two contract files.
4. **The rest of the web tests and the words**: `commissioning.test.tsx` outside pass 1's ranges
   (about 1,100 of 1,436 lines), `set-ip.tsx:61-139, 401-624`, the tests of the re-address dialog,
   and `i18n-web.ts` - the console's own refusal sentences.

Also unread by any pass, smaller: the role-matrix acceptance test for operations 100 to 110;
`capture-config/__tests__/routes.test.ts` and `rbac-boot-equality.test.ts`; `capture-config/
index.ts` (the mount and its boot order); `SH/sim/api.ts` for the simulator's commissioning
answers; `stream-probe.ts` as changed; the 21 captured tool outputs; the helper's suite as row H4
leaves it.

## 10. Closing statement for milestone M10, across both passes

**The blocking finding.** B-1 (row 120): the helper's own suite is red on a host up for less than
31 minutes, and in that window its stale-mark cases pass with the age rule removed. Row H4 is
changing the test file now (`git status`: `scripts/host/netalias/test_dems_core_netalias.py`
modified, uncommitted). It is ROUTED and NOT RE-CHECKED; this pass does not judge it. Until its
re-check is on record - the suite once on a young and once on an old host, and the age mutant RED -
"R119-02 closed" and the statement of row 119b stay conditional (C114).

**The follow-ups of row 120.**

| State | Items |
|---|---|
| Closed | F-9, by ruling (C114: stands as stated). No follow-up is closed by a committed row: the head is still 1fbeada7 |
| Open, with an owner | F-1 (row H5, with R119b-01, after the hardware chapters; the hash moves), F-2 (row H4), F-4 (row D4 after N2; the two comments "corrected now" are not in a commit), F-6 (the reset's row: C114 says "already queued" and names none - seven request lines ask it, `file_requests.md:41, 229, 235, 291, 301, 383, 473`) |
| Open, WITHOUT an owner | F-3, F-5, F-7, F-8, F-10, F-11, F-12, F-13, F-14, F-15 (ten) |

**Other open items that touch M10.** Of pass 60e, with no owner named in C113: E-08, E-09 (S2-01
closes it), E-10, E-11, E-12 (b) (E-12 (a) is answered in section 3), E-13, E-17. Of reviews 119
and 119b: gate G-3 (the endpoint count, amendment SR-13, not built: one factory-address camera at
a time, bench only), R119b-02 and `9A/H-06` (the kernel lifetime, hypothesis H-S), R119-10 and
R119-12 with row HC. Of this pass: S2-01 to S2-11, no owner yet.

**Recommendation to gate M10 (row 121).** M10 MAY CLOSE, on ONE condition and with a named list.

- The condition: row H4's re-check of B-1 is recorded as passed. Without it the gate's cell
  "blocking findings 0, or each routed and re-checked" is not met.
- Named open items the gate should carry by id: F-1, F-4, F-6 (owners above); S2-01 and S2-02 (the
  two medium findings of this pass: an owner for S2-01, a RULING for S2-02 before the first camera
  that is not on port 80); G-3 / SR-13 before a real installation; the ten follow-ups without an
  owner as one text-and-cleanup row; T-1 as a test to add with S2-01.
- What the gate must say it did not have: the four parts of section 9, first among them the one
  test file that joins operations 104 / 105 to a real lifecycle; and that no survivor of this pass
  was measured.

Not recommended: closing M10 as "reviewed in full". Two passes read the product code of the
commissioning functions line by line or through passes 60e and 119; they did not read the records,
the schema tests or most of the web tests.

## 11. Assumptions, gaps, alternatives

- **Assumption:** the engine runs one unit at a time, so `afterCommit` tasks of two changes run in
  commit order. Not traced; if two units could commit out of order the reader could end on the
  older row (a fourth case of S2-01).
- **Gap:** S2-01 (a) rests on reading `COMMIT_FAILED` as "the outcome may be unknown"
  (`unit-of-work.ts:396-401`), as E-06 of pass 60e did. Not reproduced.
- **Gap:** S2-02's sentence about every OPEN of a stored `host:port` address is from the rule's
  text; `stored-address.ts` and the adoption path were not read by this pass.
- **Gap:** the survivors are by reading. T-1 is the one worth planting first: it is one line.
- **Alternative considered for S2-01: blocking.** Not taken: it needs a lost answer to a commit, it
  fails closed, and a restart heals it. It is the first thing a field technician would meet after
  a database hiccup, so it should have an owner before the hardware run.
- **Alternative considered for S2-02: blocking.** Not taken: nothing is dialled that should not be.
  It is a limit nobody has ruled on, which is why it is a ruling and not a fix.
- **Alternative considered for the verdict: CHANGES REQUESTED of its own.** Not taken: this pass
  found no blocking item. The M10 verdict stays what B-1 makes it.

## 12. Verification cell of row 120b, checked

| Cell | Result |
|---|---|
| The verdict and the count of blocking findings first | section 1 and the header: 0 new, 1 across both passes |
| Findings with file:line, why, the row, the smallest fix | section 2: eleven |
| The named list of tests that would survive a mutation | section 6: 9 tests, 6 mutations, by reading |
| The table read in full / in part / not read for BOTH passes | section 8, and section 9 for "no pass" |
| The closing statement for M10 | section 10 |
| No source file, tracking file or `decisions.md` written | this file and `delegation_progress/row_120b.md` only; the export lies in the session scratchpad, outside the repository |

---
*Generated: 2026-10-14 09:03 WIB*
*Last Updated: 2026-10-14 09:03 WIB*
