---
task_id: 2026-10-12_input_av_core_adapter_plan
row: 85d
milestone: M6 / WP-13b, member (g) of row 85c; decision C63 (g)
date: 2026-10-13
agent: coder-execution (driver of rows 143c and 85d, wave 10, track D)
tier: T3
requirement: C63 (g) (a device adopted or registered on a RUNNING production Core is served without a restart once row 88 has lifted); C36; AD-02 (1); rows 200 (card identity), 143 / 143b (stored address and its source)
status: complete up to the door; nothing switched before the lift (row 88's list in section 5)
---

# Row 85d: `admitDevice` on the two built production adapters

Paths are relative to `/Users/gsp-budi/Documents/DEMS`. `AD` = `apps/core-server/src/capture/adapters`.

## 1. Statement

Row 85c built the admission of a later device in the fence's builder up to a member neither built adapter had. Both have it now:

| Adapter | Member | What an admission does | What it does NOT do |
|---|---|---|---|
| `AD/camera/onvif-relay.ts` (production camera) | `admitDevice(entry)`, `admittedDevices()` | adds the camera's registry id to the `served` set and keeps the frozen entry | reads no stored fact, reveals no credential, judges no address, dials nothing, starts nothing |
| `AD/audio/usb-audio-production.ts` (production microphone) | `admitDevice(entry)`, `admittedDevices()` | adds the entry to the served list (`served`, `enumerate`) of THE SAME adapter: one configuration writer, one allocation per card | lists no card, writes no configuration, makes no pipe, starts no program |

"The same validated entry form as at construction": after the admission the device is served by the unchanged paths of the first list, which read the STORE at every use -

- camera: at every open the stored stream facts, the judgement of the STORED address by the destination rule and its source address (rows 143, 143b), one reveal, the locator read and the relay from that source;
- microphone: at every open, pre-check and listing the STORED row and a fresh card listing, the card found by serial, else by port (row 200).

So nothing of the device is trusted at the admission and nothing of it is cached: an address or a card identity that changes after the admission is judged at the next open, as for any device.

### Refusals (a `CaptureAdapterError`, nothing changed; every refusal stands before the one change)

| Entry | Code |
|---|---|
| no object, no text id | `CAPTURE_DEVICE_UNKNOWN` |
| another device class, or an id not of the class's form (`CAM-NN` / `MIC-NN`); a label that is no text; capabilities that are not the class's (camera: `VIDEO`, optionally `PULL`; microphone: exactly `AUDIO`); a microphone with a media profile | `CAPTURE_DEVICE_CLASS_MISMATCH` |
| an entry that STATES another adapter kind (a descriptor) | `CAPTURE_ADAPTER_KIND_NOT_ALLOWED` |
| an entry that STATES another source class | `DEVELOPMENT_SOURCE_NOT_ALLOWED` |
| camera: a profile list not of the stored form (codes, at most 16, no repeat) | `CAPTURE_PROFILE_UNKNOWN` |
| a device that is served already (first list or admitted) | nothing happens: idempotent; a live relay or an open pipe of it stays |

An entry carries no adapter kind and no source class (`CaptureDeviceEntry`); the builder has checked the STORED row's kind before it calls the door (`fence/index.ts:503`). The adapter refuses what the entry form can say (the class, the id's class) and, when a descriptor is handed in, a kind or class that is not its own.

## 2. Wiring: no edit of the composition or the fence

`buildProductionRegistryOf` finds the member BY NAME (`lateDoorOf`, `fence/index.ts:484-487`), hands it the entry of the stored row and registers a one-entry view `{ ...adapter, devices: [entry] }`. Both adapters work through that view (tests: the view opens the later device). `src/capture-composition.ts`, `fence/production-parts.ts` and `fence/index.ts` were NOT edited for this row. `onAdmission` is an input of the builder; its sink is row 88's (request line).

## 3. Before the lift

Unchanged, and asserted by new cases beside the existing ones: a registry refuses the built adapter AND its one-entry view (`CAPTURE_ADAPTER_INVALID` in production; the microphone kind `CAPTURE_ADAPTER_KIND_NOT_ALLOWED` in development); the boot still calls `buildProductionRegistry`; rule A-9 is green (no production source names a built adapter file); `real.test.ts`, the row-85 static case and `fence.test.ts` pass unedited.

## 4. Change set and checks

| File | What |
|---|---|
| `AD/camera/onvif-relay.ts` | interface members, `CAMERA_ID`, `ADMITTED_PROFILES_MAX`, `admittedLater`, `admitDevice`, two members of the answer, one import name |
| `AD/audio/usb-audio-production.ts` | interface members, `admittedLater`, `servedDevices`, `served` and `enumerate` read it, `admitDevice`, two members of the answer, one import name |
| `AD/camera/__tests__/onvif-relay.test.ts` | 6 cases (`row 85d`) |
| `AD/audio/__tests__/usb-audio-production.test.ts` | 6 cases (`row 85d`) |
| `AD/__tests__/static.test.ts` | rule A-11: the member's name in exactly the two built adapters and in the fence's lookup; in each, the last refusal before the one change; no await and no dependency call in the door |

| Check (2026-10-13) | Result |
|---|---|
| The two adapter files (heavy-host lock: the microphone file starts stand-in processes) | run 1: `Tests 1 failed, 85 passed (86)` - my new case expected the production code for the development registry; run 2 of that file: `Tests 45 passed (45)`; `onvif-relay.test.ts` passed in run 1 |
| Static files and touched units (`adapters/__tests__/static`, `real`, `capture/__tests__/static`, `fence.test`, composition, mic-loss, camera watch, stream probe, connect service, discovery static, adopted test, module, `test/static`) | `Test Files 1 failed, 27 passed (28)`, `Tests 1 failed, 570 passed (571)`. The one red is NOT this row's: `test/static/search-path.test.ts:94` lists `src/capture/host-alias/facts.ts`, `journal.ts`, `store.ts` (the alias row in flight, agent A1) |
| Typecheck | 0 errors in this row's files. 8 errors in three files of rows in flight: `src/capture/host-alias/journal.ts` (3), `src/modules/capture-config/__tests__/adopted-camera-test.db.test.ts` (1) and `src/modules/capture-discovery/__tests__/adopted-test.test.ts` (4) - the last two follow a change of `adopted-test.ts` by another writer of this wave. At the end of row 143c the same command answered `rc=0` |
| oxlint on the changed sources; secret scan | no finding; `onvif-session.test.ts` counts 3 as it does at HEAD (unchanged by this row) |

Doubles: the camera rig (fake door, spy reader and locator, stream facts for any id); the microphone rig (fixture card listing, the store as a map the test adds a row to AFTER the build, a scripted production door). No relay, no worker, no test camera, no card.

| Unproven | Check |
|---|---|
| the admission through `buildProductionRegistryOf` with the REAL built adapters registered (the registry refuses them before the lift) | row 88 |
| an adopted camera recorded without a restart; a registered microphone opened without one, on a Linux host with a card | row 88's scenario; `9A/H-07`, `H-08`, `H-09` |
| the watches for a later device (section 5 (d), (e)) | row 88 |

## 5. What row 88 switches (added to row 85c's list)

1. The boot step: `buildProductionRegistryOf({ ..., reader, onAdmission })`; `reader` must work after the boot.
2. `onAdmission` to a sink that logs and persists (`FAILED` carries a code word).
3. The registry takes the built kinds (opener list): until then the view of a later device is refused as the adapter itself is.
4. A later CAMERA is not watched by anybody: start `cameraWatch.watch(deviceId)` on `ADMITTED`.
5. A later MICROPHONE and the loss watch: `createMicLossWatch` takes `devices` at its build; `mic-loss.ts` was not edited here.

## 6. DRIVER DECISIONS

1. The door is synchronous and keeps the id only (the shape `LateDeviceAdapter` of row 85c); the stored facts are validated where they always were, at each use. A check of the stored address AT the admission would be a second, earlier answer that the next open could contradict.
2. `devices` of each adapter stays the first list; later devices are `admittedDevices()`. The registry's view carries the later entry, so no registered descriptor changes under the registry.
3. Capabilities are held to the class (a camera entry of the existing tests states `VIDEO, PULL`; the fence makes `VIDEO`).
4. No `forgetDevice`: not asked for; a removed device cannot be opened because the registry no longer lists it (request line, information).
5. `mic-loss.ts` (claimed "unless a closing line says otherwise"): NOT touched.

## 7. Requests left

Two lines beginning `row 85d` in `delegation_progress/file_requests.md`: row 88 (the list above); the registry / fence owner (the order "adapter first, registry second").

---
*Generated: 2026-10-13*
