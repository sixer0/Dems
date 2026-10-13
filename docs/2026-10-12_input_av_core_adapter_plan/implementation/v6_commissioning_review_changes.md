---
task_id: 2026-10-12_input_av_core_adapter_plan
task_slug: input_av_core_adapter_plan
date: 2026-10-13
agent: coder-execution (agent V6, track D)
row: V6
type: contract and Core changes for the cautions of the commissioning security review (row 119), S-01's contract member, the verdict line of row P1
narrative_tier: 1
source: verification/119_commissioning_security.md (R119-03, -04, -06, -07, -08, -09); decisions C90, C94, C95 (S-01), C97; the request lines of rows B2 and P1
status: needs-review
---

# Row V6: the commissioning review's changes, contract first

## 0. Frame

| Question | Answer |
|---|---|
| What | Eight items of the brief: R119-03, R119-04, R119-06, R119-07, R119-08, R119-09, S-01 (item 7), the verdict line of `hostProfileNotAsked` (item 8) |
| Why | Decision C94 routes the cautions to this row; gate G-2 of the review (R119-03, R119-04) stands before the first set-IP run on hardware |
| Who | Agent V6, single writer of `packages/shared` hot files and of the count pins in this wave |
| Where | `packages/shared`, `apps/core-server` (three folders of `modules/capture-config`, the devices status branch, the receiver's command function), `apps/core-web`, `apps/mobile` (two readers) |
| How | Contract, then Core, then readers; each item checked before the next (section 5) |
| Status | needs-review: three driver decisions to confirm (section 6) and five things not built (section 7) |

Everything was closed on doubles on this Mac. No `ip`, `ping` or `arping` ran, no camera, no helper, no real address. The stand-in programs of the database tests are shell scripts in a temporary directory.

## 1. Members, verbatim

| Item | Member | Where |
|---|---|---|
| 1 | `FactoryCameraDeviceCount = { ONE, MORE_THAN_ONE, NOT_KNOWN }` | `packages/shared/src/api/capture-commissioning.ts` |
| 1 | `FactoryCamera.deviceCount` (in the place of `conflict`, which is REMOVED); `FactoryCamera.endpointCount` now `number | null` | same |
| 1 | `CAMERA_NETWORK_SCAN_MAX_AGE_MS = 600_000`; reason `CAMERA_SCAN_TOO_OLD` | same |
| 1, 2 | `CameraNetworkJob.deviceCount`, `CameraNetworkJob.scannedMac` | same |
| 2 | `CameraNetworkSetRequest.scannedMac` (REQUIRED, `CAPTURE_MAC_ADDRESS_PATTERN`); reason `CAMERA_HARDWARE_ADDRESS_NOT_BOUND` | same |
| 3 | `CAMERA_NETWORK_FREE_ADDRESS_ATTEMPTS = 2` (contract); `CAMERA_NETWORK_FREE_ADDRESS_SPACING_MS = 1_000`, `CAMERA_NETWORK_FREE_ADDRESS_TOTAL_MS = 8_000` (Core) | contract; `camera-network/service.ts` |
| 4 | `INSTALLATION_ACCEPTANCE_STEP_IDS` (27 ids `9A/H-01` to `9A/H-27`, the frame's run order), `INSTALLATION_ACCEPTANCE_STEP_LIST_VERSION = 1`, `INSTALLATION_ACCEPTANCE_STEP_TITLES`, `INSTALLATION_ACCEPTANCE_CHECK_ID_PATTERN`, `InstallationAcceptanceStepResult = { PASS, FAIL, NOT_RUN }`, step keys `id`, `result`, `detail` | `packages/shared/src/api/installation-acceptance.ts` |
| 4 | `InstallationAcceptanceLegacyStepSchema` (`id`, `passed`, `detail`: answer only), `isInstallationAcceptanceStepList`, Core `details.reason: INSTALLATION_STEPS_NOT_THE_LIST` (422) | same; `installation-acceptance/service.ts` |
| 5 | reason `INSTALLATION_CLOCK_BEHIND_RECORD` (409, operation 110); `isClockBehindViolation` | contract; `installation-acceptance/store.ts` |
| 7 | `CameraStreamFactSchemas.resolution` and `.codec` nullable; `CameraStatus.resolution`, `.codec`, `ApiVideoTrack.resolution`, `.codec` nullable; i18n `common.devices.cameraFormatNotStated` = "Not stated" | `state-slices.ts`, `sim/types.ts`, `sim/api.ts`, `i18n/en/common.ts` |
| 8 | `VERIFY_NOTICE.HOST_PROFILE_NOT_ASKED`, `hostProfileNotAskedReport(platform)`, `HOST_PROFILE_NOT_ASKED_PLATFORM`; `ReceiverVerifyResult.hostProfileNotAsked?` | `evidence-verify/types.ts`, `verify.ts`; `evidence-export/receiver-verify.ts`, `receiver-cli.ts` |
| audit | optional detail key `deviceCount` of `CAMERA_NETWORK_SET` | `apps/core-server/src/core/audit-details.ts` |

## 2. What each item does, and why in that form

### (1) R119-03: the scan states what it knows

**Form chosen: a closed three-state member IN THE PLACE of the boolean, under a new name.** `conflict` is removed and `deviceCount` added. Reason: with an ADDED member beside a kept boolean, a client of the first contract goes on reading `conflict: false` for a count nobody made - the false assurance the review found. With the boolean re-meant (nullable, or three-valued under the old name) the same reader takes null for "no conflict". With the member gone, the reader finds no `conflict`; the shared client's strict schema refuses the answer. `endpointCount` is null when the probe did not count: null is not one.

The Core (`factory-scan/service.ts`): `endpointCountOf` answers null for a member left out and for anything that is no whole number from 1 (it answered 1 before); `deviceCountOf` maps null to `NOT_KNOWN`. The production probe leaves the member out, so a production scan answers `NOT_KNOWN` for every device. `lastScanOf` now answers `{ deviceCount, mac, scannedAt }`.

The set-IP job (`camera-network/service.ts`, `prepare`): a `switch` over the three states. `MORE_THAN_ONE` and anything that is none of the three refuse (`CAMERA_ADDRESS_CONFLICT`). `ONE` and `NOT_KNOWN` go on, and `NOT_KNOWN` goes on only because of item 2. The scan's age is held to 10 minutes on the Core's clock; a clock that went back is "too old". The job's answer and both audit entries carry `deviceCount`.

The screen: the row of a `NOT_KNOWN` device reads "Number of devices at this address: not known - connect one factory-address camera at a time." An answer the console does not understand is drawn as "not known" too.

### (2) R119-04: the hardware address the technician saw is bound to the job

`scannedMac` is required in the strict form. Three places hold the job to it, each before the next:

1. before a job exists: the last scan's row must have shown exactly that address (`409 CAMERA_HARDWARE_ADDRESS_NOT_BOUND`; a row without one cannot be started);
2. in the job, after the neighbour table is read and BEFORE the typed account is used: `neighbourMac !== scannedMac` ends the job `MAC_MISMATCH`. Measured on the fake ONVIF stub: 0 requests of the set-network file;
3. in the injected hook `admitHwAddress`: the device's own statement must equal `scannedMac` AND `neighbourMac`, or no set request is made.

`camera/onvif-network.ts` was not edited: the hook is an option the module passes.

### (3) R119-06: "free" after one echo

`taken()` asks the host's observation twice, 1 s apart, inside 8 s in all. One "taken" is taken at once; two "silent" in a row is free; a thrown observation, a bound that ran out and a clock that went back refuse (`COMMISSIONING_NOT_AVAILABLE`, one persisted failure). The fixed row `/usr/bin/ping -n -q -c 1 -W 1 <a.b.c.d>` is unchanged: the database test shows it started twice, word for word.

### (4) R119-07: the step list comes from the contract

The list is the 27 check ids of the frame's result record. A request names every id exactly once with a result of `PASS`, `FAIL`, `NOT_RUN`; a `FAIL` or `NOT_RUN` needs a note. Refused: an unknown id, a missing id, a repeated id, an empty list, the member `passed`. The Core holds the steps to the same schema again past the route (`422 INSTALLATION_STEPS_NOT_THE_LIST`, judged before the idle lock). `passedCount` of the audit entry counts `PASS`.

A record stored before the list is still read and revoked: the ANSWER schema is a union of the new step and the legacy step. A request cannot carry the legacy form.

A shared test reads the frame's recording sheet (section 9.2) and holds the contract's list equal to it, in its order.

The web form reads the contract's list and titles. Each check has two ticks ("passed", "Not run") and a note; neither tick is `FAIL`. An untouched form cannot be sent.

### (5) R119-08: a clock behind the record

Operation 110: the table's answer 23514 by `installation_acceptances_revoked_at_check` is `409 INVALID_STATE`, `details.reason: INSTALLATION_CLOCK_BEHIND_RECORD`, `details` holds `reason` only. Nothing is persisted as a defect; one log line at warning level. Every other CHECK stays a 500.

### (6) R119-09

Lies wholly in `camera/onvif-network.ts`. Request line written for agent B1; nothing edited.

### (7) S-01

On the controller's word after row B2 landed. Both members nullable in the one object that feeds the `cameras` slice and the track status. `withCameraStreamFacts` answers three nulls for a track without a statement. Five web readers and two mobile readers print "Not stated". The simulator's dataset states all three for every camera, so its screens read as before.

### (8) The verdict line

`verifyPackageV2` raises the notice `HOST_PROFILE_NOT_ASKED` when the manifest it read carries `hostProfileNotAsked`. The Core's operation 41 hands the notices on unchanged. The receiver's command prints the same line before its verdict, from a sealed manifest it relied on (X-05 passed). It fails nothing. A package without the member gets no line, no notice and no result member: measured in the same test.

`cli/verify-export.ts` was not changed: it is the process entry, and the lines are made in `src/evidence-export/receiver-cli.ts`.

## 3. Counts and pins

| Count | Before | After |
|---|---|---|
| Operations | 110 (39 GET, 71 POST) | 110 (39 GET, 71 POST) |
| Audit types | 82 | 82 |
| Actions | 51 | 51 |
| Schema | not touched | not touched |

No count pin moved. Value pins restated, each by its own content: commissioning reasons 13 to 15; acceptance reasons 6 to 7; `VERIFY_NOTICE` 4 to 5 codes; detail keys of `CAMERA_NETWORK_SET` 11 to 12; the folder's function list of `installation-acceptance` 10 to 11.

`packages/shared/openapi/openapi.json` was written by `npm run openapi:gen` (the repository's generator): 110 operations, 1,708,747 bytes. The first attempt failed inside the command sandbox (tsx could not open its pipe) and wrote nothing; the generator was then run outside it. A second run after the last test fix wrote the same bytes.

## 4. The simulator

Aligned with the Core: its scan answers `endpointCount: null`, `deviceCount: NOT_KNOWN`; operations 106 and 109 hold the body to the same schemas (a body without `scannedMac`, or without the closed step list, is 422) and then answer their stated refusal. Its answers stay synthetic.

## 5. Checks

| Check | Command | Result |
|---|---|---|
| Shared, targeted (41 files) | `npx vitest run test/api-*.test.ts test/openapi.test.ts test/sim-api*.test.ts test/sim-capture*.test.ts test/evidence-*.test.ts test/i18n*.test.ts test/client-*.test.ts test/schemas.test.ts test/live-source-bindings.test.ts --maxWorkers=2` | first run `3 failed, 1379 passed (1382)`: three pins of this row's own changes; after their restatement the seven affected files: `Test Files 7 passed (7)`, `Tests 259 passed (259)` |
| Core unit, the touched folders | `npx vitest run --project unit src/modules/capture-config src/modules/devices src/core/__tests__/writers.test.ts src/evidence-export src/evidence-verify test/static/cli.test.ts src/plugins/permission-guard --maxWorkers=2` | `Test Files 44 passed (44)`, `Tests 1044 passed (1044)` |
| Core database, the acceptance pair and the folders | `lockf .locks/db-migrate.lock npx vitest run --project db test/acceptance/contract.test.ts test/acceptance/rbac-matrix.test.ts src/modules/capture-config src/modules/devices --maxWorkers=2` | first run `6 failed, 253 passed (259)` in two files; second run of those two files `Test Files 2 passed (2)`, `Tests 59 passed (59)`, 0 databases remain |
| Composition, the row 111b case | `... --project db src/__tests__/capture-composition.db.test.ts -t "row 111b"` | `1 passed, 14 skipped (15)` |
| Web, targeted | `npx vitest run src/features/commissioning src/features/devices src/features/dashboard src/features/session-monitor src/test/live-api-reference-document.test.tsx --maxWorkers=2` | `Test Files 32 passed (32)`, `Tests 516 passed (516)` |
| Mobile, the two readers' folders | `npx jest src/features/session-live src/features/devices --maxWorkers=2` | `Test Suites: 36 passed`, `Tests: 406 passed` |
| Typecheck | `tsc --noEmit` in shared, core-server, mobile, mock-core; `tsc -b` in core-web | 0 errors in each |
| Lint | `oxlint` in the four workspaces | warnings only; the one in a line of this row was removed |

Reds met on the way, with their cause:

- The six database failures of the first run were two causes. One was mine: the acceptance double stamped its scan with the wall clock while the Core's clock is manual (`CAMERA_SCAN_TOO_OLD`), with two cascades. The other was a flake already in row 117's test: `stored()` orders by `accepted_at, id`, two rows shared the instant, and "the last row" depended on a random id. That assertion now finds its row by id.
- The static rule of the `installation-acceptance` folder ("no SELECT statement exists in the folder") failed against a guarded INSERT written for operation 109. The statement was taken out again (section 6, D-3).

Not run: any full suite; the composition database file as a whole (one case of it); the hardware checks.

## 6. Driver decisions, for the controller to confirm

| # | Decision | Reason |
|---|---|---|
| D-1 | `conflict` is REMOVED and `deviceCount` added, not a nullable or an added flag | section 2 (1) |
| D-2 | The step list is the 27 checks only; `PREP-nn` and `HI-nn` are not in it | 51 steps do not fit the table's bound of 32, which this row may not change; the frame's result record has a line per check only |
| D-3 | Operation 109 has no clock-behind answer; only operation 110 | the table has no rule for it and the folder's static rule forbids a statement that reads; request line written |
| D-4 | Files outside the first claims line were edited: `core/audit-details.ts` (one optional key) with its pin; four lines of `src/__tests__/capture-composition.db.test.ts`; `evidence-export/receiver-verify.ts` and `receiver-cli.ts` for item 8 | each is the smallest place the item could be built; all are in the closing claims line |
| D-5 | A scan older than 10 minutes refuses a job (`CAMERA_SCAN_TOO_OLD`) | the review's condition 3 of item (a); the number is this row's |
| D-6 | The notice of item 8 is raised from the manifest the verifier read, also when another check fails | the brief: "when a manifest carries it"; the receiver's line needs X-05 passed |

## 7. Not built

| What | Why | Where it goes |
|---|---|---|
| The count itself (SR-13) | not this row; gate G-3 of the review | a new row after the controller's ruling |
| `INCOMPLETE` read as "not known" by ONE observation | inside `capture/fence/production-parts.ts`, not this row's | request line |
| The record storing the list's version; steps the Core judges itself | needs a column; a schema step | request line |
| The `cameras` slice of the state stream on a real Core still holds the simulator's initial facts | no writer of the Core puts stream facts into the slice (row B2's open point) | request line |
| R119-09 | another agent's file | request line |

Unproven until the hardware package: that two observations 2 s apart see the kernel's entry at `FAILED` (`9A/H-14`); two cameras on one address (`9A/H-15`); every reading of `ip` and `ping` on a host (`9A/H-13`, `9A/H-14`).

## 8. Edit-only statement

Every existing file was changed with the Edit tool. No scripted replace, no shell append, no generated rewrite - but `openapi.json`, written by the repository's own generator. New files with Write: this record and `delegation_progress/row_v6.md`.

---
*Generated: 2026-10-13*
*Last Updated: 2026-10-13*
