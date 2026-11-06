---
task_id: 2026-10-07_dems_real_capture_sealing
row: 65
date: 2026-10-09
agent: coder-execution
status: needs-review
---

# Row 65 — adapter layer (M4-W1), Tier 3

Status: **needs-review** (one clause of the row is stated, not built: the worker-side lateness bound; and `store.ts` was edited before decision D95 moved it to row 129). Everything else is done and checked.

## 1. What exists

All under `apps/core-server/src/capture/adapters/` (Core process; nothing loaded by the worker):

| File | Content |
|---|---|
| `kinds.ts` | five adapter kinds (TODO row 129: hold to `capture_devices.adapter_kind`), `sourceClassOf` (the one derivation), `CaptureOperation` (TODO row 61: result of the one function), `registrableKindsOf` (RG-1) |
| `types.ts` | `CameraAdapter`, `PoeController`, `AudioInputAdapter`, `CaptureDeviceRegistry`, candidate / connection-test / handle shapes (C3 §2.6 values) |
| `registry.ts` | registry with RG-1..RG-4, OD-10 lock, `openerKinds()`, `assertRecordable()` (`SOURCE_KIND_NOT_RECORDABLE`), `assertAssignable()`; `OPENER_CAPABLE_KINDS = FAKE, LOCAL_DEVICE` |
| `credential.ts` | `SealedCredential`, `credentialFreeLocator`, `streamLocator`, `credentialAtInjection` (the one injection point), `blankCredentialLocators` |
| `mic-transport.ts` | statement of the `PCM_FIFO` transport: +-5,000 ppm followed; beyond it lateness bounded by the worker buffer (2,000 ms as built; 100 ms asked by D85 R-3); `micPipePath` |
| `commands.ts` | seam of each device command, typed by the keys of the contract table `DEVICE_COMMAND_OPERATIONS` (E-12) |
| `errors.ts` | `CaptureAdapterError`: code + registry ID, fixed texts, never an input value |
| `fake/{camera,audio,poe,index}.ts` | in-memory fakes, `createFakeRegistry()` (two cameras, or dual lens), built from the seed's device list |
| `camera/onvif-rtsp.ts`, `audio/usb-audio.ts`, `poe/snmp-poe.ts`, `real.ts` | class-C interface-complete stubs behind one dynamic loader that refuses every operation but `REAL_PRODUCTION` |

Tests: `adapters/__tests__/{fakes,registry,credential,static,real}.test.ts` (unit), `device-upsert.db.test.ts` (db).
Other edits: `src/capture/__tests__/static.test.ts` (the pinned file list of the capture folder now excludes `adapters/`, which is pinned in the layer's own static test); `src/db/store/store.ts` (see §4).

## 2. Check results (2026-10-09)

| Check | Result | Negative control |
|---|---|---|
| `M4-FAKE-1` | pass — `fakes.test.ts` 8/8: three contracts, two cameras, dual lens, five test outcomes | six broken adapters are each found by the same contract functions |
| `M4-SEL-W` (registry half only) | pass — `registry.test.ts` 11/11: registered device of the right class and source class assignable incl. an adopted `CAM-03`; candidate ID, unknown ID, wrong class, wrong source class, locked config refused | same adapters accepted where the rule allows them |
| `M4-SEL-W` (browser, audit row, slice) | **not run** — needs a lane Core and agent-browser; lane stack is down (D92(c)) and ports 5173-5175 / 8000 are barred; the selector operations are row 66's | — |
| Real adapters never load in tests | pass — `static.test.ts` A-1 | planted import in `test/support/` on the real tree: rule red (`test/support/zz-row65-planted.ts:1 imports a class-C adapter`), file removed; plus 5 planted in-memory cases |
| Credential never in log / error log / audit / error / result (SEC35-04) | pass — `credential.test.ts` 6/6, canary pair through results, fake call records, registry, 7 errors, real app logger at `trace`, persistent error log, audit detail rules of all `CAPTURE_*` types | plain value through the same logger and error log is found; the injection result holds it by design |
| Locator with a credential composed only at injection | pass — static A-2: only `credential.ts` reads `.secret` / `.username`; no user-part composition in `src/capture/**`; `credentialAtInjection` has 0 product callers (class C-2) | planted read and composition found |
| Upsert keeps `mac`, `onvif_uuid`, `profiles`, `last_seen_at` | pass — `device-upsert.db.test.ts` 2/2 as `dems_app` on a throw-away database, under the migrate lock | run before the fix: red (`mac: null, onvif_uuid: null, profiles: [], last_seen_at: null`) |
| `M4-MT-12` upsert half | `kind`, `adapter_kind` not in the SET list (row 129's comment and pin; unchanged by this row) | row 129 |
| Typecheck / lint core-server | exit 0 / exit 0 | — |
| `vitest --project unit src/capture test/static src/db/store` | 354 passed, 1 failed: `test/static/imports.test.ts` "the one unit that is not closed" lists `src/credential-store` — **not this row's** (row 84's new folder) | — |
| `write-through.db.test.ts` after the store change | 9/9 | — |

## 3. Decisions for the controller

| # | Decision | Why |
|---|---|---|
| D65-1 | Device class is the slice's `CAMERA / MIC / POE`, not the spec sketch's `AUDIO` | one vocabulary with `capture_devices.kind` (C3 §2.6) |
| D65-2 | `testConnection` takes a `SealedCredential`, not the plain pair | the object prints a fixed mark in every serialiser; rows 142 seal at the route edge and read through `usingCredential` |
| D65-3 | The injection point yields locator + two separate members; a user-part locator is composed nowhere | spec §A.6.3 (newer than the §A.6 table) |
| D65-4 | "Has an opener" = `hasOpener` on the adapter; the registry aggregates (`openerKinds`, `assertRecordable`) and refuses a production kind that claims one | D86 C-5; landing class C-2 / C-4 means adding the kind to `OPENER_CAPABLE_KINDS` |
| D65-5 | The layer is not registered in the app (no seam, no P25 edit); rows 66 / 71 build the registry from row 61's operation | scope fence |
| D65-6 | Class-C fence = static rule + run-time refusal before a dynamic import; the barrel does not export `real.ts` | no environment read is allowed under `src/capture/**` (G-R8) |
| D65-7 | `E-12`: the Core's `DEVICE_COMMAND_OF_OPERATION` was already contract-derived; this row adds only the seam per command, typed by the contract keys, and a test holding both to the table | no second list |
| D65-8 | Exact pin of the adapter file list: rows 131, 142 add their files to `adapters/__tests__/static.test.ts` | project style |

## 4. Open

1. **Lateness bound beyond +-5,000 ppm is NOT built.** It is a change of `apps/capture-worker/src/audio.c` (`FIFO_CAP (SR * 2)`), row 60's tree, and its harness uses the barred media ports. The transport states the bound that holds (2,000 ms) and the target (100 ms); the pin test goes red when the worker changes. Request filed in `delegation_progress/file_requests.md`.
2. **`db/store/store.ts` edited before D95 reached this row:** the four lines `mac: row.mac,`, `onvifUuid: row.onvifUuid,`, `profiles: row.profiles,`, `lastSeenAt: row.lastSeenAt,` removed from the `onConflictDoUpdate` SET list of `insertInto`, and a five-line comment added in their place. Nothing else. Not touched again; row 129 owns it.
3. Spec §A.1.1 names `adapters/local-device/`; the ownership map names `adapters/local/` (row 134). Comments in `types.ts` / `index.ts` use the spec's name.
4. `rows.ts` still documents the four columns as "read back as the empty forms": true for the mapping, no longer written on update (row 129's file).
