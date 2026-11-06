---
task_id: 2026-10-12_input_av_core_adapter_plan
task_slug: v4_fourth_contract_step
date: 2026-10-13
agent: coder-execution (agent V4, track D)
source: decisions/decisions.md C80 (with C62, C67, C71 C-6, C72 F-04, C73, C74, C75, C76 item 8, C77)
status: complete (two points returned for a ruling, section 9)
tier: 1
---

# Row V4 - the fourth contract-and-vocabulary step

Abbreviations: `SH` = `packages/shared`, `CS` = `apps/core-server`, `WEB` = `apps/core-web`.

## 1. What this step is

One agent, two change sets in order (decision C80). V4a (vocabulary and texts) was finished and
checked before V4b (signed forms) was started. No schema change was made or needed: the schema
stands at `[11, 'dbc-12']`. The counts did not move: **110 operations (39 GET / 71 POST), 82 audit
types, 51 actions**. `SH/openapi/openapi.json` was regenerated ONCE, at the very end, with the
repository's generator (`node --import tsx scripts/gen-openapi.ts` in `SH`).

Edit-only rule: every existing file was changed with the Edit tool, after reading it, by small
additive edits. No scripted replace, no shell append, no rewrite. The one generated file is
`openapi.json` (the repository's own generator). Two new files: this record and `row_v4.md`.

## 2. Result per item

| Item | Result | Where |
|---|---|---|
| (1) `SYSTEM_BOOT` details rule admitting null; the writer enforces the forms and the fixed severity | done | `CS/src/core/audit-details.ts`, `audit-writer.ts` |
| (2) `aliasId` optional on `HOST_ALIAS_REMOVED` / `HOST_ALIAS_REMOVE_FAILED` | done; request line to 106b | `CS/src/core/audit-details.ts` |
| (3) outcome of a stored-credential test can state "no camera was asked"; operation 108 in SIMULATED aligned | done; request line to 146c | `SH/src/api/capture-discovery.ts`, `SH/src/sim/api.ts`, `CS/src/core/audit-details.ts` |
| (4) the four slot sentences in `common.captureSlotRefusal`, the web's copies removed | done (one source; the web keeps two members BY REFERENCE - section 5) | `SH/src/i18n/en/common.ts`, `WEB/src/i18n-web.ts`, `WEB/src/features/devices/slot-refusal.ts` |
| (5) description corrections of operations 108 and 103 | done | `SH/src/api/capture-discovery.ts`, `capture-commissioning.ts` |
| (6) signed manifest member for audio absent across a worker restart | done as an OPTIONAL member - the manifest's first (section 6; DRIVER DECISION D-5) | `SH/src/evidence-package/manifest.ts`, `build.ts` |
| (7) `VERIFY_NOTICE.SIGNED_BY_COMPROMISED_KEY`, wording, receiver-side state | done as member, report lines, wording and result TYPE; the receiver's INPUT and verdict rule are NOT built (section 9, point 1) | `SH/src/evidence-verify/types.ts`, `SH/src/api/evidence.ts`, `SH/src/i18n/en/evidence.ts` |

Neither V4b item changes what an existing sealed package verifies as (sections 6 and 7 say how
that was held), so neither was stopped.

## 3. Item (1) - `SYSTEM_BOOT`

**The finding** (row 201; C71 C-6; C72 F-04; C76 item 8): `SYSTEM_BOOT` is one of the simulator's
types and has no closed details list, so `checkAllowList` returned at once and ANY writer could put
any value under `signingKeyId` / `signingCertificateSha256`. Only the fence's own writer
(`systemBootDetailsOf`) held the two values to a form. And the bare forms of
`SYSTEM_BOOT_SIGNING_DETAIL_RULES` refuse JSON null, which a real boot without a readable
certificate writes for both (SX-15; rows 201, 209).

**Built.**
- `audit-details.ts`: `SERVER_AUDIT_OPEN_DETAIL_RULES` with one entry, `SYSTEM_BOOT`, and
  `openDetailRulesOf(type)`. An OPEN rule: named members are held to a form, every other key stays
  free. Each of the two members is "of its form, OR null" (`orNull` over the existing rule); absent
  is accepted as before. `detailRulesOf('SYSTEM_BOOT')` still answers undefined - the type did NOT
  become a closed list, because the shared code and many tests write it with their own keys.
- `audit-writer.ts`: `checkTypeRules(type, severity, details)`, called in TWO places so that no
  writer is outside it: `auditInputOf` (every native entry) and `checkAuditRow` (every row before
  it is stored - native and PREPARED, the engine's path). It applies the open rule and the fixed
  severity of `SERVER_AUDIT_FIXED_SEVERITY` (today `OPERATOR_PASSWORD_SET` = WARNING): a row of such
  a type with another severity, or with none (which would be INFO), is refused
  `AUDIT_SEVERITY_INVALID`. A malformed signing member is refused `AUDIT_DETAIL_VALUE_INVALID`; the
  message names the type, the key and the form, never the value. No new error code.
- The duplicate table in `CS/src/capture/fence/boot-key.ts` STAYS and was not edited; its equality
  test (`fence.test.ts`, "row 209: the two forms are the ones row 201 stated") passes unchanged,
  because `SYSTEM_BOOT_SIGNING_DETAIL_RULES` itself still refuses null - the null-admitting rule is
  a second object built over it.

**Every existing writer of `SYSTEM_BOOT`** (found by `grep -rn SYSTEM_BOOT` over `CS/src`,
`CS/test`, `SH/src`):

| Writer | Path | Result |
|---|---|---|
| the fence, the one product writer of a real boot | `CS/src/capture/fence/index.ts:717` | passes: pair of the forms or the null pair (`fence.test.ts`, `fence.db.test.ts`) |
| the shared code: power-fail recovery, update reboot, the seed | `SH/src/sim/session-machine.ts:1819`, `maintenance.ts:410`, `dataset.ts:834,839`; `CS/src/db/fixtures/operations.ts:388` | pass: none carries either member; prepared rows go through `checkAuditRow` |
| tests that use the type as a plain row (`details: {}` or a key of their own) | `CS/src/core/__tests__/{core-plugin,pipeline,audit-chain.db,boot-checks.db,connection-lost,connection-lost.db,unit-guard.db,search-path.db,unit-statement,unit-of-work.db,writers}.test.ts`, `modules/stt-config/__tests__/routes.test.ts:1000`, `db/store/__tests__/write-through.db.test.ts:283`, `test/db/fixtures.ts:504` | pass: no member of the two |
| the row-201 case of `writers.test.ts`, the half pair `{ captureOperation, signingKeyId }` | `CS/src/core/__tests__/writers.test.ts` | passes, by decision D-1 below |

No writer had to be listed as failing.

## 4. Items (2), (3), (5) - vocabulary and texts

**(2)** `aliasId: rowUuid(OPTIONAL)` on the two removal results. `address` and `removeReason` stay
required; `HOST_ALIAS_ADDED` keeps `aliasId` required. The pinned gap test of row 106
(`CS/src/capture/host-alias/__tests__/lifecycle.db.test.ts`, 106b's folder) was NOT edited: it was
red on the change in my first database run (`:266`, the only failure of that file) and green in my
closing run, 106b having turned it. Request line written.

**(3) the outcome entry.** `CaptureConnectionOutcome` already holds `UNREACHABLE`, so the type could
always SAY unreachable; what it could not say is that NO CAMERA WAS ASKED (the reader was reached
and nothing was stored, the store could not be read, or the adapter refused before a request) - the
half record C75 (1) refuses. Added, both OPTIONAL, to the list of
`CAPTURE_DEVICE_CONNECTION_TESTED`:
- `unreachableReason`: closed, `CaptureDeviceTestUnreachableReason` = `CREDENTIAL_NOT_READ`,
  `NOT_SENT`. AUDIT ONLY - the operation's answer has no such member and its own `reason` keeps its
  one code. The shared builder drops it for any outcome but `UNREACHABLE`.
- `usableProfileCount`: a whole number 0..16 (`CAPTURE_DEVICE_TEST_AUDIT_PROFILES_MAX`), the count
  row 146b asked for. The type's pattern admits a count (sibling lists hold counts; a count
  discloses no device text). The builder states none when no camera was asked.
The WRITER of both is row 146c (`adopted-test.ts`), not this row: request line with the exact call.

**(3) operation 108 in SIMULATED.** The in-app simulator answered a synthetic `200 REACHABLE`; a
Core in simulated capture answers `503 NOT_READY`, `DISCOVERY_NOT_READY`. The simulator now answers
the same refusal, in the Core's order (role, web console, idle lock, then "not ready" BEFORE the
device is looked up - so an unknown id gets the 503 too), with the Core's sentence, now the shared
constant `CAPTURE_DEVICE_TEST_NOT_READY_SENTENCE`. Consequences, each by its delta:
- responses `200` and `404` of the registry entry are marked `services: CORE_SERVER_ONLY`;
- `CaptureDeviceConnectionTest` leaves the OFFLINE document (offline components 70 -> 69);
- Core-server-only statuses 36 -> 38;
- the comparison "the simulator produces exactly the documented offline statuses" (`openapi.test.ts`)
  gained ONE named entry: an envelope-level status is documented on no operation (the registry test
  keeps that for 405, 413, 429, 500, 503), so the simulator's 503 of operation 108 is named there
  and must be produced.

**(5) texts.** Operation 108: the header no longer says "no Core route exists yet"; the refusals
are split into "before the credential is read" and "after the reader was called" (the reader audits
every call: `409 CREDENTIAL_REQUIRED` and `503 CREDENTIAL_STORE_NOT_READY` have one
`CAPTURE_CREDENTIAL_REVEALED` row); the simulated Core's 503 and the simulator's answer are stated.
Operation 103: the scan takes every temporary address away before it answers and `alias` states
what is still in place (null as a rule - C78 DD-3 as 106b built it); the one 409 that comes after
addresses were asked (`HOST_ALIAS_FAILED` for a later /24); the `HOST_ALIAS_*` rows are the
lifecycle's, per /24.
**AHEAD OF THE PRODUCT, stated:** the description of 108 says the outcome row is written with
`unreachableReason` for the two no-camera cases. Until row 146c lands, the Core writes no such row.

## 5. Item (4) - the slot sentences

The four sentences moved word for word into `common.captureSlotRefusal` (now six reasons), with the
two nouns their `{{source}}` placeholder stands for in a sibling group `common.captureSlotSource`.
The web's literal copies are removed. `WEB/src/i18n-web.ts` still has `web.captureSlotRefusal.source`
and `.reason`, but they are the shared strings BY REFERENCE (`en.common...`), not text: the selector
panel (`capture-selector-panel.tsx:71`) asks for a sentence that names its source under those keys,
and that file was not among the files my brief named. `slot-refusal.ts` now asks the table with the
source noun first. One source of wording exists; the alias ends with three lines of the panel
(request line).

## 6. Item (6) - the signed manifest member

**What the brief assumed and what the code holds.** The brief said to follow the pattern of the most
recent OPTIONAL manifest member. There is none: `manifest.ts` is strict and its header says "no
optional member". Fields 121-128 were each added as a REQUIRED key. A required key here would make
every package sealed before this step fail V-01 - exactly what an evidence form may not do.

**Built** (DRIVER DECISION D-5): `audio.absentOnRestart`, the manifest's ONE optional member.
- Shape: an array of at least one strict record
  `{ earlierAttempt >= 1, laterAttempt > earlierAttempt, absentAtLeastMs: 0..86400000 | null, absentAtMostMs: 0..86400000 | null }`,
  one per restart, in order. null = that bound was not measured. The bound equals the audit type's
  (`CAPTURE_AUDIO_ABSENT_MAX_MS`; held equal by `CS/src/core/__tests__/writers.test.ts`).
- Absent = "this manifest states no restart gap". An EMPTY list is refused, so "none" has one form
  and one digest. The builder drops `undefined` (it has no canonical form).
- Signed: the member is inside the canonical body. The two exclusions of the digest are unchanged.
- `MANIFEST_V2_FIELDS` stays 128 / 119. The four fields are numbered 129-132 in a NEW list,
  `MANIFEST_V2_OPTIONAL_FIELDS`, because the existing tests define the first list as "every member
  a manifest must have".
- The verifier needs no edit: V-01 is the schema. Its acceptance is tested.

**How "an existing package verifies as before" was held** (`SH/test/evidence-package.test.ts`, the
new block): the example manifest has no such key, parses to itself, serialises to the same bytes,
keeps its digest and its V-01 verdict; a builder call that hands `undefined` seals the SAME manifest
as one that leaves the key out. Beside that, with no test edited: the shared verifier suites and the
Core's `evidence-verify`, `sealing`, `sealing-host`, `evidence-export` and signer unit tests - 76
files, 1556 tests - pass unchanged. The simulator's manifests are unchanged (v1 demo packages and
the example: no member).

**What stays true and is NOT fixed by the member:** a verifier that predates V4 refuses a manifest
that CARRIES the member (strict schema). Only a session that had a restart carries it. The
`timeline` of a restarted session still spans the session (row 191b's first remainder).

## 7. Item (7) - `SIGNED_BY_COMPROMISED_KEY`

- `VERIFY_NOTICE.SIGNED_BY_COMPROMISED_KEY` (the fourth member).
- `SIGNED_BY_COMPROMISED_KEY_REPORT`: three lines. Two are character for character the strings the
  Core sends since row 227 (compared by a script against `CS/src/evidence-verify/index.ts`: equal,
  209 and 121 characters, inside the contract's 256). The third, `COMPROMISED_KEY_NO_RECORD`, is the
  line of a receiver's verifier: it states the state and NO verdict.
- `VerifiedSigningKeyMark` (`NOT_ESTABLISHED`, `NOT_MARKED`, `COMPROMISED`) and the OPTIONAL result
  member `PackageVerifyResult.signature.compromisedKey`. Absent in every result of `verifyPackageV2`
  today (it is told of no marked key), so no existing result changes; a test pins the key list of
  `signature`.
- The description of `notices[].code` of operation 41 names the code and says that this notice,
  unlike the others, is not "fails nothing".
- Client wording: `evidence.verifyV2Key.compromisedKey.{title, storedDigest, notStoredDigest, noRecord}`.
- Web / mobile: no exhaustive mapping names `VerifyNoticeCode` (both draw the Core's `report` line),
  so NO client line was needed and none was written. Both typecheck; web 37 files / 647 tests and
  mobile 53 suites / 654 tests pass.

## 8. Pins

**Count pins of operations, audit types and actions: 0 moved** - the three counts did not change.

Value pins moved by their delta, in 8 files:

| File | Pin | Delta |
|---|---|---|
| `SH/test/api-capture-discovery.test.ts` | offline statuses of operation 108 | `[200,401,403,404,409]` -> `[401,403,409]` |
| `SH/test/api-openapi-scope.test.ts` | offline components | 70 -> 69 (`CaptureDeviceConnectionTest` out) |
| `SH/test/openapi.test.ts` | offline schema names; Core-server-only statuses; flow 18 | -1 name; 36 -> 38; 200 / 404 -> 503 |
| `SH/test/api-registry.test.ts` | Core-only successes by name | + `testCaptureDeviceConnection 200` |
| `SH/test/sim-capture-discovery.test.ts` | the simulator's answer of 108 | 200 / 404 -> 503 |
| `SH/test/i18n.test.ts` | keys of `common.captureSlotRefusal` | 2 -> 6 |
| `CS/src/core/__tests__/writers.test.ts` | required keys of the two removal results; keys of `CAPTURE_DEVICE_CONNECTION_TESTED` | -1 each; 8 -> 10 |
| `WEB/src/features/devices/__tests__/selector-microphones.test.tsx` | the sentences read from the shared tree | source of the literal |

New cases extend existing files (driver rule 7): `writers.test.ts` (+3 cases),
`api-capture-discovery.test.ts` (+1), `i18n.test.ts` (+1), `evidence-package.test.ts` (+1 block of
5), `evidence-verify.test.ts` (+1 block of 4).

## 9. Returned for a ruling - not built, on purpose

1. **The receiver's verifier is told of no marked key.** The state TYPE landed; its SOURCE did not:
   `VerifyExpectations` has no `compromisedCertificateSha256`, and `verifyPackageV2` sets no
   `compromisedKey` and raises no notice. Adding the input means ruling a receiver's verdict first
   (it has no database of the Core to anchor "the stored digest passes"). Every possible answer
   changes what a package verifies as for that receiver. Row 230.
2. **`SOURCE_SIGNED_BY_COMPROMISED_KEY` and the export input were NOT added** (the controller's note
   during the step). The code is no one-line member of a closed list this row touches:
   `failureReason` of operation 87 is an open code set described in a sentence, and the closed list
   is the export unit's. Row 230.
3. **Description requests that I read only after the one regeneration, not served:** 106b's points
   (2) and (3) on operation 105 and on `audit.also` of 103 / 105 (the second is a registry change),
   and row 117's three text points on operations 109 / 110. One later description step.

## 10. Driver decisions (for the controller to confirm)

| # | Decision | Why the conservative way |
|---|---|---|
| D-1 | The writer holds each signing member to its form; "both or neither" stays the fence's rule | an existing accepted case (the row-201 case of `writers.test.ts`) writes half a pair; refusing it would change what a writer other than the fence may do beyond what the findings name |
| D-2 | `SYSTEM_BOOT` gets NO fixed severity | the shared code writes it INFO and, after a power failure, WARNING; "the fixed severity" of F-04 is the table's (`OPERATOR_PASSWORD_SET`), which the writer now enforces for every type in it |
| D-3 | The fixed severity is refused when not stated, not filled in | the writer never alters an entry; the one product writer states it |
| D-4 | "No camera was asked" is a closed reason beside `UNREACHABLE`, not a sixth outcome | the outcome set is the operation's answer too; a sixth value would change the API schema of operations 95 and 108 |
| D-5 | The manifest member is OPTIONAL although the file's rule is "no optional member" | the only form that leaves every sealed package verifying as before; reasoned at `MANIFEST_V2_OPTIONAL_FIELDS` |
| D-6 | The web keeps two members by reference instead of an edit of the selector panel | the brief named two web files and their test; the panel is a third |
| D-7 | The example of operation 103's answer keeps `alias: EXAMPLE_ALIAS` | a valid answer (a removal that was not confirmed); changing example values was not asked |
| D-8 | The simulator's 503 is named in the test as an envelope-level answer rather than documented on the operation | the registry rule "no operation documents 503" stands |

## 11. Checks

V4a, before V4b was started (the two drift cases waited for the one regeneration):

| Check | Command | Result |
|---|---|---|
| Shared suite | `npx vitest run --maxWorkers=2` in `SH` | runs 1 and 2 listed the pins (8 red, then 3); run 3 `Tests 2 failed, 2868 passed (2870)` - the two "committed openapi.json byte for byte" cases |
| Core unit: writer, fence, fixtures, password command, adopted test, host-alias | `npx vitest run --project unit --maxWorkers=2 src/core/__tests__/writers.test.ts src/capture/fence/__tests__/fence.test.ts src/db/fixtures/__tests__/audit-details.test.ts test/cli/operator-set-password.test.ts src/modules/capture-discovery/__tests__/adopted-test.test.ts src/core/__tests__/core-plugin.test.ts src/core/__tests__/pipeline.test.ts src/modules/devices/__tests__/routes.test.ts src/capture/host-alias` | `Test Files 10 passed (10)`, `Tests 538 passed (538)`, first run |
| Acceptance pair and writer database files, throw-away databases, `.locks/db-migrate.lock`, sandbox off | `npx vitest run --project db --maxWorkers=2 test/acceptance/contract.test.ts test/acceptance/rbac-matrix.test.ts` + 7 writer files | `Tests 7 failed, 218 passed (225)`, `0 remain`: 6 in the acceptance pair on the routes of operations 104 / 105 (106b's, landed before their pins) and 1 the pinned gap test (item 2). None in a file of this row |
| Web | `npx vitest run --maxWorkers=2` on the selector test and the three reference files | `Test Files 4 passed (4)`, `Tests 180 passed (180)` |
| Typecheck | `SH`, `CS`, `WEB`, `apps/mobile`, `apps/mock-core`, `apps/transcriber` | exit 0, six of six |

V4b and the closing runs, after the one regeneration:

| Check | Command | Result |
|---|---|---|
| Shared suite | `npx vitest run --maxWorkers=2` in `SH` | `Test Files 105 passed (105)`, `Tests 2879 passed (2879)` |
| Core unit: evidence, sealing, export, signer, writer, pins | `npx vitest run --project unit --maxWorkers=2 src/evidence-verify src/sealing src/sealing-host src/evidence-export src/capture/signer ...` (the list of row 116 added) | `Test Files 76 passed (76)`, `Tests 1556 passed (1556)` |
| Core `src/core` after the last test edit | `npx vitest run --project unit --maxWorkers=2 src/core src/capture/fence/__tests__/fence.test.ts src/db/fixtures/__tests__/audit-details.test.ts` | `Test Files 10 passed (10)`, `Tests 420 passed (420)` |
| Acceptance pair, the matrix, two walkers and the writer database files | `npx vitest run --project db --maxWorkers=2` on 12 files | `Test Files 12 passed (12)`, `Tests 259 passed (259)`, `0 remain` |
| Web | `npx vitest run --maxWorkers=2 src/features/devices src/features/commissioning src/features/evidence` + the reference files; then `src/test` | `Test Files 37 passed (37)`, `Tests 647 passed (647)`; `Test Files 83 passed (83)`, `Tests 1332 passed (1332)` |
| Mobile | `npx jest --maxWorkers=2 src/features/evidence src/features/capture-selector` | `Test Suites: 53 passed`, `Tests: 654 passed` |
| Typecheck | the six workspaces | exit 0, six of six (one run between showed 3 errors in `CS/src/evidence-export/host.ts:279`, a file of row 227b mid-edit; gone in the closing run) |

Not run: any full suite (driver rule 7); the adopted-camera database test with the real relay (heavy
host; no file of it changed); any real device.

## 12. Request lines written (`delegation_progress/file_requests.md`, each beginning `row V4`)

| To | Subject |
|---|---|
| 106b | the gap test of row 106 can be turned into a passing case |
| 146c | the writer of the "no camera was asked" outcome entry, the count, the shared sentence |
| 191c | the exact manifest member and how the seal writes it |
| the owner of the web selector panel | three lines that end the alias |
| row 227's owner and the client rows | bind the Core's constants to the shared ones; draw the notice as a state of the key |
| the controller and row 230 | the two points of section 9 |
| the controller | the description requests not served |

## 13. Stale text seen in files that are not this row's (not edited)

- `CS/src/capture/fence/boot-key.ts:26-36` still says the audit writer accepts any member of
  `SYSTEM_BOOT` and that the export line of the core index does not carry the rules' name.
- `CS/src/modules/capture-discovery/adopted-test.ts:61-62` and `adopted-test-route.ts:45-47`
  (146c's): "NO outcome entry ... a sixth is not invented"; "It does NOT answer the in-app
  simulator's synthetic 200".
- `CS/src/evidence-verify/index.ts:110-113`: "the SHARED vocabulary does not hold this member yet".

---
*Generated: 2026-10-13 14:30*
