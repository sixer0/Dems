---
task_id: 2026-10-12_input_av_core_adapter_plan
row: 53
date: 2026-10-13
agent: coder-execution (batch 8, agent T2)
tier: T3
work_package: WP-10b
requirement: P12-F08 rows 5 and 6 (server half); AD-06 (1), (2) on the status surface; C36
status: needs-review - the three reads that name a camera state the stream facts; the REPLICATED slice `cameras` does not yet (it needs a door of the engine, whose files are another agent's in this batch)
---

# Row 53: the server states a camera from the stored stream facts

Paths are under `apps/core-server/`.

## 1. Statement

On a Core in a real capture operation, `resolution`, `fps` and `codec` of a video track are the stored statement of the stream in its selector slot: an HEVC camera is stated `HEVC` with `fps: null`; an H.264 camera as before (`1080p`, `25`, `H.264`). This holds for operations 44 (`cameras`), 46 (`tracks`) and 47 (`cameras`). The slice `cameras` that a client receives over the realtime channel is NOT changed by this row.

## 2. The ownership area (the profile says "UNKNOWN - executor declares")

Measured: the server has no producer of the three members. `state.cameras` is the simulator's seeded slice (`packages/shared/src/sim/initial-state.ts:297-314`: `1080p`, `25`, `H.264`); `modules/devices/status.ts` copies them into the answers. Nothing reads `capture_device_streams`. Declared and claimed: `modules/devices/status.ts`, `index.ts`, `source-facts.ts` (one function), the folder's tests.

## 3. Change set

| File | State | What |
|---|---|---|
| `src/modules/devices/status.ts` | changed | `cameraStreamFactsOf(profile)`; `withCameraStreamFacts(cameras, slots)`; an optional last parameter `streamFacts` on `videoTracksOf`, `videoStatusOf`, `deviceHealthOf`, `deviceInventoryOf` (default false: every existing caller answers as before) |
| `src/modules/devices/index.ts` | changed | the routes of operations 44, 46, 47 hand the flag in; export lines |
| `src/modules/devices/source-facts.ts` | changed, one function | `inRealCaptureOperation(app)`: the operation is asked of `captureOperationOf` (static rule G-R16: no file compares the capture mode itself), in the folder's one reader of the fence (static rule M8) |
| `src/modules/devices/__tests__/status.test.ts` | changed | 6 new cases |
| `src/modules/devices/__tests__/routes.test.ts`, `support.ts` | changed | 1 new case through the routes of a real and of a SIMULATED Core; `unitApp` takes an optional configuration |

## 4. How the facts are read

The code of a video slot (`captureConfig.cameras[].profile`) is the key of the camera's stream row (`capture_device_streams.profile`). It was minted from the stream by the seal's own function (rows 50, 51) and is held to the code pattern at every write. Reading it back is that function's inverse, so no table is read:

| Code | `resolution` | `fps` | `codec` |
|---|---|---|---|
| `HEVC_1080P` | `1080p` | null | `HEVC` |
| `H264_1080P25` | `1080p` | 25 | `H.264` |
| `H264_1080P` (the stream states no rate, or one with no whole-number name) | `1080p` | null | `H.264` |
| `HEVC_2560X1920P` | `2560x1920` | null | `HEVC` |
| `MAIN`, `profile_1`, `OTHER_1080P25`, a 16:9 code that names its width, a side outside 100 to 9999, a rate above 240 | nothing: the track keeps the slice's own members | | |

The stored row's `codec`, `width` and `height` say the same as the code; the rate exists only in the code (the table has no rate column). A reader of the table was therefore not built.

## 5. Checks (this Mac; 2026-10-13)

| Check | Command (in `apps/core-server`) | Result |
|---|---|---|
| The pure mapping and the routes | `npx vitest run --project unit --maxWorkers=2 src/modules/devices src/capture/__tests__/static.test.ts test/static` | the folder's own unit files passed first (`Tests 136 passed`, then the route file `Tests 35 passed`). The static rules then failed twice on the route's way of asking for the operation: rule G-R16 (it compared the capture mode itself; seen in the run of 80 files of row 50's record), then rule M8 of this folder (the route file imported the fence). Last run: `Test Files 21 passed (21)`, `Tests 357 passed (357)` |
| The folder on PostgreSQL (real and simulated Cores) | `npx vitest run --project db --maxWorkers=2 src/modules/devices/__tests__` (both locks, sandbox off) | `Test Files 4 passed (4)`, `Tests 50 passed (50)`, one run |
| Typecheck | `npx tsc --noEmit -p .` | no output |

**The row's verification cell.**

| Cell statement | Evidence |
|---|---|
| an HEVC fixture camera is stated HEVC with no rate | `status.test.ts`, block "row 53": slot code `HEVC_1080P` gives `['1080p', null, 'HEVC']` on operations 44, 46 and 47, each valid against the contract's schemas; `routes.test.ts`: the same through the routes of a Core in real capture |
| an H.264 one as before | the seeded state answers member for member what it answered without the flag; `deviceInventoryOf` returns the SAME slice object |

Further cases: for ten pictures and rates the code made by `streamProfileOf` is read back to the expected facts (a rate of 30000 / 1001 reads 30; a rate with no whole-number name reads null); 21 texts that are no stream statement say nothing and none of their text is repeated; a track whose slot is not assigned keeps the slice's members and names no source; a SIMULATED Core answers the slice whatever the slot says (the parity with the simulator's own handler holds).

## 6. Not built

| What | Why | Where it goes |
|---|---|---|
| the replicated slice `cameras` with the stream facts (what rows 54 and 55 read over the realtime channel) | it needs a fact door of the engine beside `applyCaptureSourceFacts`; `engine/host.ts` is agent G's in this batch | request line: the door's body is one line around `withCameraStreamFacts`, which returns the same array when nothing differs |
| a fixture CAMERA end to end (a real stream, adopted, assigned, then read) | the adoption of a minted code is on a door double in the database file of row 51; the real relay is row 50's file | the facts are joined by code: `HEVC_1080P` minted in row 50, stored in row 51, read here |

## 7. Driver decisions (for the controller to confirm)

1. **The facts are read from the stored code, not from the stream table.** It needs no asynchronous read in three synchronous answers, and the code is the only place the rate is stored.
2. **Real capture operations only.** A SIMULATED Core answers its slice, so the server stays equal to the in-app simulator on the same state.
3. **A code that is no stream statement says nothing.** The track then states the slice's seeded members. For a production camera this cannot happen once row 187 refuses a slot without the camera's own profile; for a development source whose slot holds `H264_1080P25` the answer is what it was.
4. **A side outside 100 to 9999 or a rate above 240 cannot be carried by the contract's schema** (row 52's bounds): such a code says nothing rather than a value the schema refuses.

## 8. Doubles, and what stays unproven

The double is the committed state of the seed with other codes on its slots. Unproven: a real camera's code on a real Core through a session; what the screens show for a null rate (rows 54, 55); the slice over the realtime channel. Hardware `9A/H-17`.

## 9. Requests

One line in `delegation_progress/file_requests.md`: the engine door for the slice.

---
*Generated: 2026-10-13*
