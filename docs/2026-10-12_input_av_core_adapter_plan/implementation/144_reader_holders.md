---
task_id: 2026-10-12_input_av_core_adapter_plan
row: 144
milestone: M3 / AD-03
date: 2026-10-13
agent: coder-execution
tier: T3
requirement: AD-03 points 1 (wiring, importer list, no reason passed) and 4 (device refusals before the reveal), with AD-02 for the stored address
status: complete
---

# Row 144: the holders of the credential reader

Paths are relative to `/Users/gsp-budi/Documents/DEMS`. `CC` = `apps/core-server/src/modules/capture-config`.

## What was built

| File | Change | Description |
|---|---|---|
| `CC/credential-holders.ts` | new | THE WIRING: `wireCaptureCredentialHolders(dependencies)` builds the handout, takes `CAMERA_ADAPTER` and `CONNECTION_TEST` once each and returns the frozen pair `{ cameraAdapter, connectionTest }`. The handout is dropped. It reads the stored facts of a device with one constant statement, one bind parameter (`READ_CAPTURE_CREDENTIAL_DEVICE`: `kind`, `adapter_kind`, `address` of `capture_devices`). Imported by no production source |
| `CC/credential-reader.ts` | modify | The device gate `admit`, between the form check and the unit: two new dependencies (`device`, `storedAddress`), two new codes, the types `CaptureCredentialDevice`, `StoredCameraAddressDecision`, `StoredAddressRefusal`. Nothing of the unit, the commit or the opening was changed |
| `CC/__tests__/credential-reader.test.ts` | extend | 8 new cases in two blocks (the gate; the wiring); the rig gets the two dependencies, by default a production camera and the REAL rule |
| `CC/__tests__/credential-reader.db.test.ts` | extend | the readers now come from the wiring; the two seeded cameras are set to the production kind on the clone; 4 new cases |
| `CC/__tests__/static.test.ts` | extend | R-3 list: one entry (the wiring); new rules R-5 and R-6 with a positive control; "the stub is not an opener" |

`CC/index.ts`, `routes.ts`, `capture-session/index.ts`, every file under `src/capture/` and the capture static-rule lists were not edited.

## The gate (AD-03 (4), AD-02)

Order inside `read`: (1) reason and form of the request, as row 45; (1b) `admit`; (2) the unit; (3) the commit; (4) the opening.

| Stored state | Code | Reveal statements | Audit entries | Error-log codes |
|---|---|---|---|---|
| not registered; kind not `CAMERA`; adapter kind outside the closed set or not of the PRODUCTION class (`sourceClassOf`); the stored facts cannot be read | `CAPTURE_CREDENTIAL_DEVICE_REFUSED` | 0 | 0 | 1 |
| address absent or empty | `CAPTURE_CREDENTIAL_ADDRESS_REFUSED`, `context.refusal: STORED_ADDRESS_ABSENT` | 0 | 0 | 1 |
| address not `host` or `host:port` (a scheme, a user part, a path, a blank) | the same code, `STORED_ADDRESS_MALFORMED` | 0 | 0 | 1 |
| the destination rule refuses | the same code, `context.refusal` = the rule's own code (`LOOPBACK`, `HOST_NAME`, `PUBLIC_ADDRESS`, `OTHER_INTERFACE_SUBNET`, `OUTSIDE_CAMERA_SUBNET`, `PORT_NOT_LISTED`, ...) | 0 | 0 | 1 |
| the rule throws, answers nothing, or answers anything but `allowed: true`; a refusal that is not a code | the same code, `STORED_ADDRESS_RULE_FAILED` | 0 | 0 | 1 |
| a production camera at an allowed address | - (served) | 1 | 1 | 0 |

The gate applies to all three methods of both holders. A refusal is an error-log entry and no audit entry: the reveal function was not called (row 45's rule is "every CALL is audited").

## The holders (AD-03 (1))

| Rule (`CC/__tests__/static.test.ts`) | Statement | Today |
|---|---|---|
| R-3 | the production importers of the reader equal the list | 1 file: `CC/credential-holders.ts` |
| R-5 | no holder passes a reason: the three reason texts are written by the reader, the audit writer's set and its fixture only | 3 files; the wiring: 0 |
| R-6 | the wiring is the one file that takes a reader, twice; its production importers equal `CAPTURE_CREDENTIAL_HOLDERS_IMPORTERS`; the module index does not hand it on; its one import is the reader; one `$1` | importers: 0 (no boot path builds the readers) |
| stub | no file under `src/capture/` imports the reader, the wiring or the reveal module | 0 |

At run time: no method has a reason parameter (lengths 1, 1, 2; a type test); a reason passed anyway is not heard (through the wiring too); the pair and each reader are frozen.

## Checks (this Mac; no device, no network, no real credential)

| Check | Command (in `apps/core-server`) | Result |
|---|---|---|
| Unit and static | `npx vitest run --project unit --maxWorkers=2` on `credential-reader.test.ts`, `static.test.ts` | run 1: `Test Files 2 passed (2)`, `Tests 31 passed (31)` |
| Database | `/usr/bin/lockf -k -t 1800 ../../.locks/db-migrate.lock npx vitest run --project db --maxWorkers=2 src/modules/capture-config/__tests__/credential-reader.db.test.ts` (sandbox off) | run 1: 14 passed, 1 failed (below); run 2: `Test Files 1 passed (1)`, `Tests 15 passed (15)`; clones `dems_test_local_*`, `0 remain` |
| Tree-wide static rules and the module's routes | the same runner on 13 files: `test/static/imports`, `credentials`, `logging`, `log-calls`, `scan-coverage`, `test-support-imports`, `audit-protection`, `search-path`; the static tests of `capture`, `capture/adapters`, `capture-config`; `credential-reader.test.ts`; `routes.test.ts` | `Test Files 13 passed (13)`, `Tests 181 passed (181)` |
| Typecheck | `npx tsc --noEmit` | exit 0 |
| Lint | `npx oxlint` on the two source and three test files | exit 0 |

The one failure of database run 1 was a check of this row, not of the code: it counted calls of the reveal function in `pg_stat_user_functions`, and this server keeps no function statistics, so the counter read 0 after a good read. The CONTROL case showed it. The counter was removed; "the statement was not sent" is held on doubles (0 units, 0 statements) and on PostgreSQL by 0 audit rows of any type and an unopened store.

Verification cell of the row:

| Item | Where | Result |
|---|---|---|
| static rule: importers of the reader equal the stated list | static R-3 | `[row144] credential-reader importers: src/modules/capture-config/credential-holders.ts` |
| no holder passes a reason | static R-5; unit "the pair is frozen ..." and "each holder writes its own reasons through the wiring" | 3 writer files; a passed reason is not heard |
| a refused device gives 0 reveal entries | unit "a device that is not a registered camera ..." (9 stored states and a failed read, each on 3 methods), "a stored address ..." (18 addresses, 11 of them through the real rule), "a rule that throws ..."; DB "a device that is not a camera of a production kind", "a production camera whose STORED address fails ..." | 0 units, 0 statements, 0 entries, 0 openings; on PostgreSQL trail +0, store not asked |

Beyond the cell: a read from INSIDE a unit of work (row 45's blocking rule, there "by reading, not by a test"): DB case, `CAPTURE_CREDENTIAL_REVEAL_FAILED`, error-log `causeCode: PIPELINE_REENTRANT`, 0 credentials, 0 entries.

## AD-03, point by point (after this row)

| Point | State |
|---|---|
| 1 | done: closed importer list with its one entry, the wiring, bound readers, no reason passed. The two callers of the wiring are rows 85 and 50, each by a decision (R-6) |
| 2 | row 45, unchanged; row 145 keeps its own check |
| 3 | row 145 |
| 4 | done in the reader, for both holders |
| 5 | rows 50 and 146 |
| 6 | rows 147 and 21 |

## Doubles and what stays unproven

- Doubles: the unit test's unit runner, opener, error log and stored facts. The destination rule is the REAL one in both test files, bound to hand-written host facts (camera interface 192.168.50.0/24, office interface 10.20.0.0/24). On PostgreSQL the stored facts are the clone's rows, set by the owner.
- Unproven here: no production composition calls the wiring (rows 85, 50); the host facts of a real host (`DestinationContext` has no production reader yet); that the adapter then dials exactly the address the gate judged (row 143, and `9A/H` checks of the hardware package for a real camera network).

## DRIVER DECISIONS (for the controller to confirm)

1. **The destination rule is a dependency of the reader (`storedAddress`), not an import.** `src/capture/destination-rule.ts` is inside a closed unit and not in `EXPOSED`; a module cannot name it. The composition inside the capture unit binds it. Reversible: one list entry and one import.
2. **A wiring file of its own, `CC/credential-holders.ts`, inside the module**, and a second pinned list for who may call it (R-6, empty). The alternative, wiring inside the future composition file, would have put the importer of the reader under `src/capture/`, which rule R-3 forbids.
3. **The gate applies to the connection test too** (W-6: the stored credential goes to the stored address only, under AD-02).
4. **A refusal of the gate writes an error-log entry and no audit entry**: the reveal function was not called, and no audit type exists for it. The error log names the rule's refusal code, never the address.
5. **Stored facts that cannot be read are `DEVICE_REFUSED`**, not a new code.
6. **The stored address is split into host and port by the reader** (`host` or `host:port`, the two forms adoption stores); anything else is refused without asking the rule.
7. **The database test builds its readers through the wiring** and sets `adapter_kind` / `address` of the two seeded cameras as the owner on the clone; row 45's cases keep their expectations.
8. **The new file was written with the Write tool**; every edit of an existing file used the Edit tool.

## Requests left in `file_requests.md`

Four lines, none blocking for this row: how rows 85 and 50 obtain the pair (two list entries, the dependencies); what rows 46, 47, 50 must know (outside a unit, the two new codes); the rule as a dependency, for the controller and row 143; no line asked of the capture static lists.

---
*Generated: 2026-10-13*
