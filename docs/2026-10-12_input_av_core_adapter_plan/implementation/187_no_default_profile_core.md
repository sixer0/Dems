---
task_slug: input_av_core_adapter_plan
row: 187
milestone: M2 / WP-13a
date: 2026-10-13
agent: coder-execution (batch 8, agent K/P/N)
status: complete (no new shared member was needed; the registry that serves a production camera is a double until the lift)
tier: T3
requirement: controller ruling C36 (1); design addendum 7, AD-06; corrects driver decision 4 of row 29
---

# Row 187 - in the Core no default profile stands in for a production camera

Paths are relative to `/Users/gsp-budi/Documents/DEMS`. `CC` = `apps/core-server/src/modules/capture-config`.

## 1. What was built

| File | Change |
|---|---|
| `CC/routes.ts` | `CaptureProfileRefusal` (two reason words of the module); `cameraLinesOf`, `isProductionCamera`, `assertOwnProfile`; in `edit`: one read of the stored profile lists BEFORE the unit (only for an edit that assigns a production camera on a Core in real capture) and the refusal INSIDE the unit, after the registry's own refusals and before `scope.command(... 'setCaptureConfig' ...)`. Header table and one paragraph. One import member (`CaptureAdapterKind`) |
| `CC/store.ts` | additive: `READ_CAMERA_PROFILES` (`SELECT d.id, d.profiles FROM public.capture_devices d WHERE d.kind = 'CAMERA'`) and `readCameraProfiles(reader)`; a list that is no list of texts states nothing (fail closed) |
| `CC/__tests__/capture-config.db.test.ts` | one new block of 3 cases at the end of the row-29 block (its fixtures are reused) |
| `CC/__tests__/static.test.ts` | rule R-7, 3 cases - THE HOME OF THE STATIC TEST (declared in `file_claims.md`) |

Not touched: `packages/shared` (the constant is still exported and used by the simulator's hosted action), `slices.ts`, `plan.ts`, `index.ts`, the schema, the adapters.

## 2. The rule

For every camera line of operation 78 and for operation 79, when a device registry is provided (a real capture operation) and the committed registry slice says the device's adapter is `ONVIF_RTSP`:

| Profile in force after the edit | Answer |
|---|---|
| none: the slot is empty and the edit names no profile | `422 INVALID_INPUT`, `details.reason: CAMERA_PROFILE_NOT_STATED` |
| one that is no element of `capture_devices.profiles` of that device (the line's own, or the one a held slot keeps) | `422 INVALID_INPUT`, `details.reason: CAMERA_PROFILE_NOT_OF_DEVICE` |
| an element of the device's stored list | the hosted action runs as before; the code is stored as given |

`details` also carry `deviceId` and `trackId`. A refusal changes nothing: the unit is left before the action - no state, no `CAPTURE_CONFIG_CHANGED` row, the slot as it was. The registry's own refusals (source class, not served, class mismatch, locked) are asked first and keep their reasons.

**The operations in which the refusal applies (the cell asks the executor to state them against C36 (1)):** 78 `updateCaptureConfig` (its camera lines) and 79 `setCaptureCameraSource` (it names no profile, so into an empty slot it is always refused for a production camera; into a held slot the kept profile is held to the device's list). Operation 80 and every microphone line assign no camera. Not applied in `SIMULATED` (no registry is provided: the simulator's hosted action keeps its default, C36 (1) first half), nor to a development, fake or built-in camera (another adapter kind, or none in the slice). In `REAL_DEVELOPMENT` a production camera is refused by the registry before this rule (`PRODUCTION_SOURCE_NOT_ALLOWED`), as today.

## 3. The constant

`CAPTURE_CONFIG_EMPTY_SLOT_PROFILE` stays in `packages/shared/src/sim/capture-config.ts` (definition and one use by the hosted action). Rule R-7: the code of every file under `apps/core-server/src`, production and test, comments removed, holds 0 occurrences of the name; a planted import, re-export and use are each found; a comment that names it is not counted (`routes.ts` explains the rule in its header).

## 4. Driver decisions (for the controller to confirm)

| # | Decision | Reason |
|---|---|---|
| DD-1 | The named code is a `details.reason` under the contract's `INVALID_INPUT`, two words of the module | every refusal of an assignment is answered that way (`CaptureAssignmentRefusal`); no member of `packages/shared` was needed, so the row does not return needs-review for it |
| DD-2 | A HELD slot is under the rule too: the profile it keeps must be the device's own | C36 (1): "no default may stand in for it". A slot that held another camera keeps that camera's profile (or the seed's `H264_1080P25`); storing it for a production camera is the same substitution |
| DD-3 | The rule is asked AFTER the registry (`assertAssignable`) | a device the running operation does not serve keeps its own reason; the profile is a question about a device that may be assigned at all |
| DD-4 | The stored list is read on the pool before the unit, as the microphone transports are (`withRegisteredTransports`), not inside it | the unit's scope offers no read of a table that is no replicated slice; an adoption that changed the list between the read and the unit can only make the rule stricter or the refusal late by one edit. A production camera the read did not hold is refused (fail closed) |
| DD-5 | "Production-kind" is read from the committed slice member `adapter` (`ONVIF_RTSP`) | it is what the durable mapping publishes for a registered device; a built-in carries none and is never production |
| DD-6 | The static test lives in the module's own `__tests__/static.test.ts` | the cell left its home to the executor; the capture static list is agent SC's |

## 5. Evidence

| Check | Command | Result |
|---|---|---|
| The module's unit tests (8 files; the static rule among them), first run | from `apps/core-server`: `npx vitest run --project unit --maxWorkers=2 src/modules/capture-config` | `Test Files 8 passed (8)`, `Tests 119 passed (119)` |
| The module's database tests (3 files), throw-away databases under the lock, sandbox off, first run | from the repository root: `/usr/bin/lockf -k -t 1800 .locks/db-migrate.lock sh -c 'cd apps/core-server && npx vitest run --project db --maxWorkers=2 src/modules/capture-config'` | `Test Files 3 passed (3)`, `Tests 65 passed (65)`; 0 databases remain |
| The Simulated and generated-source selector tests, unchanged: fence unit + the search | `npx vitest run --project unit --maxWorkers=2 src/capture/fence src/modules/capture-discovery/__tests__/search.test.ts` | `Test Files 5 passed (5)`, `Tests 177 passed (177)` |
| The same on PostgreSQL: the fence and a development session | the lock command with `src/capture/fence/__tests__/fence.db.test.ts src/capture/fence/__tests__/development-session.db.test.ts` | `Test Files 2 passed (2)`, `Tests 47 passed (47)` |
| Typecheck | `npx tsc --noEmit` in `apps/core-server` | no output (0 errors) |
| Lint | `npx oxlint src/modules/capture-config` | no output |

Verification cell, clause by clause:

1. "on a clone database both refused forms answer the named code with 0 audit rows and the slot still NULL" - case 1 of block 5: no profile through operation 78 and through operation 79 (`CAMERA_PROFILE_NOT_STATED`), three foreign profiles (`CAMERA_PROFILE_NOT_OF_DEVICE`, the default's own code `H264_1080P25` among them); afterwards the stored row is six NULLs, the count of `CAPTURE_CONFIG_CHANGED` rows is unchanged, and `H264_1080P25` is nowhere in the row.
2. "while the device's own code is stored as given" - the same case: `HEVC_2160P25_MAIN` answers 200, the row holds `video_01_profile = HEVC_2160P25_MAIN`, one row more.
3. "static test: importers of the constant under `apps/core-server/src` are 0 and the test fails on a planted import" - R-7, three cases.
4. "the Simulated and the generated-source selector tests show 0 changed results" - every existing case of the module, of the fence and of the development session passes unedited; the SIMULATED control of block 5 shows the same production row assigned without a profile and stored with the simulator's default, by both operations.

## 6. The double, and what stays unproven

| Double | What it is |
|---|---|
| The device registry of the REAL_PRODUCTION case | provided through the module's seam before the boot: it serves the fixture's one production camera and hands every other question to the Core's own registry. A production Core of this phase serves no production camera (class C), so without it the edit is refused "not served" before the rule |
| The camera's stored profile list | written by the owner into the clone (`["HEVC_2160P25_MAIN"]`); the adoption that mints it is rows 50 / 51 |

| Unproven | Proven by |
|---|---|
| That the registry of a lifted production Core admits an adopted camera so that the rule is reached in the product | rows 85, 88 |
| That the codes row 51 mints into `capture_devices.profiles` are the codes a client offers for a production camera (neither client's camera command sends a profile today, so a production camera can only be assigned once a client does) | rows 50 / 51 and the client rows of the selector (request line) |
| A sentence of the two reasons for the operator | the i18n writer (request line) |
