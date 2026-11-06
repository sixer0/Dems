---
task_slug: input_av_core_adapter_plan
row: 196
milestone: M8 / WP-12
date: 2026-10-13
agent: coder-execution (wave 10, agent N2)
tier: T3
status: complete
---

# Row 196 - the engine door of a re-address

Paths are relative to `/Users/gsp-budi/Documents/DEMS`. `CS` = `apps/core-server`.

## 1. What was built

The engine function that runs row 195's INTERNAL action `readdressCaptureDevice` inside the CALLER's unit, on the model of the microphone door of rows 185 / 190 (`registerCaptureMicrophoneIn`).

| File | State | What |
|---|---|---|
| `CS/src/engine/internal-actions.ts` | MOD | `readdressCaptureDeviceIn(unit, { deviceId, address })`; one member of `InternalActions` (`readdressCaptureDevice`); one type import |
| `CS/src/engine/host.ts` | MOD | `readdressCaptureDeviceInScope`: the steps of the camera's registration door (`syncNative`, `checkHead`, the action, `flush`, the entry read back); ONE binding line in `engineUnitOf`; one type import |
| `CS/src/engine/index.ts` | MOD | the export |
| `CS/src/engine/__tests__/readdress-door.db.test.ts` | NEW | 3 database cases, 2 static cases |

How it works. `app.engine.run(label, work)` opens the unit; `readdressCaptureDeviceIn(scope, change)` runs the action on the unit's pending state and `flush` writes the change through the unit's transaction by the engine's typed writer (`db/mapping/changes.ts`, `diffCapture`): for an adopted camera an UPDATE of exactly the changed column (`address`, a member of `RUNTIME_UPDATABLE_COLUMNS.captureDevices`), for a built-in camera the whole-row UPSERT. The slice `captureDevices` is published when the unit commits and only then. The door holds NO statement.

The seam it serves: `DeviceReaddresser` of `CS/src/modules/capture-discovery/readdress.ts` hands `{ deviceId, address, at }`; the door takes the first two (row 195's DD-4: no member of slice 30 holds a time). Row 197 binds it.

What the door does NOT do, by design (each is the caller's, row 97): no permission check, no destination rule, no audit row, no idle lock, no "another device holds it" check. It stores the address as given - a test stores `127.0.0.1` through it and says so.

## 2. Checks (2026-10-13; database runs: sandbox off, `/usr/bin/lockf -k -t 1800 .locks/db-migrate.lock`, throw-away clones of the seed)

| Check | Command (in `CS`) | Result |
|---|---|---|
| The door on PostgreSQL, run 1 | `npx vitest run --project db --maxWorkers=2 src/engine/__tests__/readdress-door.db.test.ts` | `Tests 1 failed | 4 passed (5)`: a red in THIS row's own new test (it compared the whole stored state with the engine's by list order; the read-back lists an adopted camera by id, the engine lists it last - a fact of the tables, true before this row) |
| The door on PostgreSQL, run 2 (the comparison by id) | same | `Test Files 1 passed (1)`, `Tests 5 passed (5)`; `0 remain with the run prefix` |
| Engine pins and layer rules | `npx vitest run --project unit --maxWorkers=2 src/engine/__tests__/hosted-actions.test.ts src/engine/__tests__/static.test.ts test/static/imports.test.ts` | `Test Files 3 passed (3)`, `Tests 55 passed (55)` |
| Lint | `npx oxlint src/engine/internal-actions.ts src/engine/host.ts src/engine/__tests__/readdress-door.db.test.ts` | exit 0 |
| Typecheck | `npx tsc --noEmit -p .` | 0 errors in the files of this row; the errors shown at that moment were in files other agents were editing (see row 197's record for the final run) |

The verification cell, case by case:

| Cell | Evidence (`readdress-door.db.test.ts`) |
|---|---|
| on a clone database, after the door ran in a unit, the device row and the slice hold the new address | case "TOGETHER": for an adopted camera (`CAM-03`, registered through `registerCaptureDeviceIn`) and for the built-in `CAM-01` (with a port): the door's answer, the slice and `capture_devices.address` are one text; inside the unit the pending state holds it while the committed state does not; the stored registry equals the engine's; every other member of the device, every other device (same object), `captureConfig`, `session` and every other column of every registry row are unchanged; the audit entry the caller appended in the same unit is the ONE new row and the chain verifies; one publication, revision + 1 |
| a unit that fails after the door leaves both at the old address | case "OR NOT AT ALL": the unit throws after the door AND after its audit entry; the engine holds the very state object it held, the row holds the old address, the audit head and the checksum of every table are equal, nothing was published; the next unit re-addresses |
| a search for statements that write a device address outside the engine folder finds 0 new ones | static case: the production statements on `capture_devices` under `src` and `cli` are in three files (`capture/fence/statements.ts`, `modules/capture-discovery/adoption.ts`, `modules/capture-inputs/audio-cards/registrar.ts`), none names `address`; the two door files hold no statement; CONTROL: a planted UPDATE and a planted INSERT of the column are found, an `address` in a WHERE, a comment and another table are not |

Also held: six refused inputs (a microphone, an unknown id, an empty text, a URL, `user:password@`, a blank) reject with the mapped `ApiFailure` `INVALID_INPUT`, the state object and every table unchanged; the address the camera already holds writes no column (the same slice object, an equal row); a scope the host did not build answers `ENGINE_ACTION_NOT_HOSTED`.

## 3. Pins

None moved. No operation, no audit type, no action was added (the action is row 195's; its count pins were moved there). `InternalActions` is not pinned by count.

## 4. Driver decisions (for the controller to confirm)

| # | Decision | Why |
|---|---|---|
| DD-1 | A NEW test file, not an extension | no engine test file holds an in-unit INTERNAL door (the camera's and the microphone's are proven in their modules' files); the door is the engine's and its proof needs no module |
| DD-2 | The static search stands in that file, as two cases that read sources | the engine's `static.test.ts` is not in this row's area; the cell asks for the search |
| DD-3 | The door resolves with the registry entry (`CaptureDeviceStatus`), as its two siblings do | the seam returns nothing; row 197 drops it |
| DD-4 | No log line of the door carries the address | the registration doors log the unit and the action only |

## 5. The double, and what stays unproven

The real app factory on a clone of the seed as `dems_app`, a SIMULATED Core; the addresses are texts in a table. No process, no port, no device. Unproven here: the operation that calls the door (row 197); a real camera that moved (`9A/H-12`).

Existing files were edited with the Edit tool only (one exception of this agent, outside the code, is stated in row 197's record: the claims line).

---
*Generated: 2026-10-13*
