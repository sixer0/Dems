---
task_id: 2026-10-12_input_av_core_adapter_plan
blueprint_row: 88
milestone: M6
package: WP-13c
date: 2026-10-14
agent: coder-execution (driver, wave 12, track D)
narrative_tier: 3
status: complete (needs the controller's gate; NOT committed)
decisions: AM-1, C127, C128, C135, C137, C139, C140, C142, C144
---

# Row 88: the class-C lift, stage 1, one change set

Tree: `task4/input-av-core-port`, head `cb06d42c` + uncommitted work of N13 / N11a (not mine) and W6 (core-web). Edit tool only on existing files; one new file: this record and `delegation_progress/row_088.md`. Nothing committed. No device, no camera, no network probe; doubles only. Paths below are under `apps/core-server/` unless rooted.

## 1. The change set

| # | Change | Where |
|---|---|---|
| 1 | Opener list = `FAKE, LOCAL_DEVICE, ONVIF_RTSP, USB_AUDIO` | `src/capture/adapters/registry.ts` `OPENER_CAPABLE_KINDS` |
| 2 | Registration: an adapter that STATES an opener (any seam - a switch too) is refused `CAPTURE_ADAPTER_INVALID` unless its kind is listed (`SNMP_POE` refused) AND its source class is the operation's (addendum 1.4 #7) | `registry.ts` `register()` (`statesOpener`) |
| 3 | Loader builds the BUILT adapters: camera `camera/onvif-relay.ts`; microphone `audio/usb-audio-production.ts` when the bundle carries one, else `audio/usb-audio.ts` (no opener); switch `poe/snmp-poe.ts`. `ProductionAdapterDependencies` typed (no type parameters); `audio` must be stated (bundle or null) | `src/capture/adapters/real.ts` |
| 4 | Fence door `provideProductionParts` (once, REAL_PRODUCTION only, before the boot step) + `wireProductionRegistry`: microphone deps on `linux` only (and only with helper + guard configured; adds `configWriter` = `createAlsaConfigWriter(runDir)`, `runDir`); camera watch built and ATTACHED first; builder called with `{ operation, executor, reader, dependencies, load, audioCards, checkCamera, locked, onAdmission }` (load = ONE dynamic import of the loader); adapter `relayReports` attached to the hub, watch subscribed, heartbeat per stored camera, `watch.watch` on an ADMITTED later camera; mic loss watch (linux) with `devices` read live, `identifyRegisteredCard`, `isRegisteredAudioInput`, `held = built.openSources()`; malformed profiles said once; all closed at shutdown. No parts handed in: the empty registry (`CAPTURE_PRODUCTION_PARTS_NOT_PROVIDED`) | `src/capture/fence/index.ts`; `productionCameraTimeReaderOf` in `fence/production-parts.ts` |
| 5 | Composition hands the parts through the door (member 11); `AttachedCameraWatch.captureEnded`; E-03: listens to the session's `STOPPED` / `INTERRUPTED` / `FAILED_START` and calls `captureEnded()` | `src/capture-composition.ts` (ports `provideProductionParts`, `onCaptureEnd`) |
| 6 | Rule A-1 rewritten (class-C list = `audio/usb-audio`, `poe/snmp-poe`; camera stub RETIRED, imported by no file; loader importers = its test + the fence by type import and ONE dynamic import); A-9 rewritten (loader names the two built adapters; fence names `mic-loss` and the card match) | `src/capture/adapters/__tests__/static.test.ts` |
| 7 | Code-comment errata (stage 1): E-A2; registry, types, errors, kinds; the four "REGISTERED NOWHERE" headers; the two stubs; composition header; fence admission doc | `credential.ts:12-15`, `registry.ts`, `types.ts:9-22`, `errors.ts`, `kinds.ts:67-71`, `camera/onvif-relay.ts`, `camera/camera-watch.ts`, `audio/mic-loss.ts`, `audio/usb-audio-production.ts`, `camera/onvif-rtsp.ts`, `audio/usb-audio.ts`, `capture-composition.ts`, `fence/index.ts` |
| 8 | SR-10 "PROVISIONAL" -> "CONFIRMED (row 86 answer (5); C94, C127)" (C-9) | `src/credential-store/__tests__/static.test.ts:30,99` |
| 9 | 558: `fence/production-parts.ts` binds the shared `CAPTURE_INTERFACE_NAME_PATTERN`; `boot/program-checks.ts:131` stays equal text (its pin "imports types only" refused the import - seen RED; reverted; comment added) | as named |

Not touched: `usb-audio-macos.ts`, `macos-launch-gate.ts` (N10), `fence/boot.ts`, `fence/operation.ts`, `boot/checks.ts`, `boot/index.ts`, `fence/sources.ts`, `adapters/index.ts`, `connect/*`, packages, worker, migrations (git diff: none).

## 2. The 21 pins (specification 6.3), row by row

| # | Pin | End state | Evidence |
|---|---|---|---|
| 1 | The list | edited: four kinds | `registry.test.ts` "D86 C-5 as amended by AM-1" |
| 2 | Refusal at registration | follows + guard for `SNMP_POE` (any seam) | same case; `real.test.ts` refusals; mutants M1/M2 |
| 3 | Re-export `index.ts:108` | no change | `git diff` empty |
| 4 | Operation recordable `sources.ts:86` | follows without an edit | `sources.ts` unchanged; `fence.test.ts` all-production set = 4 PRODUCTION rows in REAL_PRODUCTION |
| 5 | No opener, no row `sources.ts:107` | follows | `fence.test.ts`: one microphone without opener -> "no opener exists for this source kind" |
| 6 | Stub camera `onvif-rtsp.ts` | replaced in the loader by `onvif-relay.ts`; file retired, named by no file | A-1 RETIRED check + control; request line (deletion) |
| 7 | Stub microphone `usb-audio.ts` | replaced by `usb-audio-production.ts` on `linux`; KEPT as the no-opener adapter elsewhere (DRIVER DECISION D-1, C135) | `real.test.ts` darwin proof |
| 8 | Search-only `onvif-discovery.ts:41` | kept (`hasOpener: false`, line 44) | unchanged |
| 9 | Production registry empty | wired: boot step -> `wireProductionRegistry` -> builder -> loader | capture static "row 85 / row 88" case; `capture-composition.db.test.ts` 15/15 |
| 10 | Test: the list | rewritten to four | `registry.test.ts` |
| 11 | Test: every listed kind DEVELOPMENT | removed; "listed production kinds are exactly ONVIF_RTSP, USB_AUDIO" | same |
| 12 | Test: production cannot state an opener | rewritten: one with opener registers + records; one without stays unrecordable | same |
| 13 | Static class-C files | rewritten: camera stub left the list (retired); `poe/snmp-poe` stays; `audio/usb-audio` stays (D-1) | adapters static A-1 |
| 14 | Loader fences / `real.test.ts` | kept; the fence is the second permitted importer (types + one dynamic import inside `wireProductionRegistry`) | A-1 cases + control |
| 15 | Injection point | exactly one caller, `relay-start.ts:110` (row 46's form) | adapters static A-2 green |
| 16 | Test: fence | rewritten for REAL_PRODUCTION, kept for REAL_DEVELOPMENT; 21-state table follows | `fence.test.ts` (mixed plan case; 85c (g) case) |
| 17 | Test: plan builder | rewritten: four with opener = a plan; darwin-like set refused `NO_OPENER` MIC-01 | `plan.test.ts` 11/11 |
| 18 | Test: no listener without an opener | kept (registry states none) + TWIN with openers: passes the class gate, held by C34 `RELAY_REPORTS_NOT_WIRED`, 0 workers | `session-capture.db.test.ts` 97/97 |
| 19 | Tests unchanged (camera-helper:532, fakes:206, ws-discovery:402-410) | no change, green | before/after set; adapters run |
| 20 | DB pairing check | no change, no migration | `recording.ts` diff empty |
| 21 | Comments and documents | code-comment errata done (section 1 #7); README limits untouched (stage 2) | section 1 |

Result: 21 of 21 in their end state (row 7 and 13 with D-1).

## 3. Verification (run 2026-10-14, this host)

| Check | Result |
|---|---|
| Core `tsc --noEmit` | 0 errors (after N11a's protocol edits were in the tree) |
| `oxlint` on the changed areas | rc 0; 11 warnings, none in a changed line |
| REAL_DEVELOPMENT unit set (12 files) before / after | 289/289 -> 293/293; 284 names identical and passed; 5 renamed + 4 added are production-only cases (real.test, registry production case) - 0 changed development results |
| REAL_DEVELOPMENT db set (fence.db, development-session.db, session-capture.db) before / after | 150/150 -> 151/151 (+ the twin); every before-name identical and passed. Protocol state: before = N13 working tree before N11a; after = with N11a's Core edits |
| capture-composition.db | 15/15 (real app, real composition, the door used) |
| Static sets + capture/adapters + boot + fence + composition (heavy-host lock, sandbox off) | 1791 passed, 2 red: program-checks pin (mine, 558 reverted -> green), `mic-helper.generated.test.ts` leftovers (not mine, request line) |
| Refusals 2 of 2 | `SNMP_POE` with an opener refused (registry.test, real.test); `ONVIF_RTSP` with an opener in a development registry refused (registry.test, real.test, onvif-relay.test, composition test) |
| darwin proof | `wireProductionRegistry` platform `darwin`: openerKinds `[ONVIF_RTSP]`, `MIC-11` `SOURCE_KIND_NOT_RECORDABLE`, four-slot admission refused; no loss watch |
| linux proof | platform `linux`, doubles (stand-in relay program path, stand-in helper/guard paths, door that throws if called): four-slot REAL_PRODUCTION admission (`assertRecordableSelector` -> `buildSessionCaptureSources` -> `assertSessionSourcesOfOperation`) ADMITTED; watches attached camera-then-mic; reports attached once; 2 heartbeats asked; door never called |

Mutations (each RED, then reverted, final run green): M1 class rule off -> 2 red; M2 `statesOpener` -> `hasOpenerOf` -> 2 red; M4 microphone opener on every platform -> darwin proof red; M5 `onCaptureEnd` not calling `captureEnded` -> 2 E-03 cases red; 558 import into program-checks -> its pin red.

Unproven (hardware package): a real relay / camera / sound card through the lifted path (9A/H-01, H-07, H-08, H-16, H-17); the full session sealed from four production sources is row 89.

## 4. Tick list of `decisions/087_lift_texts.md` section 1.3

- [x] P-1 row 86 ran, CAUTION, FAIL 0; cautions routed (C127). Texts follow it (87b, C128).
- [x] P-2 kill matrix 35/35 (C123).
- [x] P-3 SR-10, SR-11 CONFIRMED (086 answer (5), C94); the PROVISIONAL comments updated (section 1 #8).
- [x] P-4 items (1)-(11) answered in 086 section 4.
- [x] P-5 AM-1 recorded as text (C128, `decisions.md:172`); in force from this commit.
- [x] P-6 re-read on the final list (32 files to `0031`): grants unchanged (see request line; text 4 holds).
- [x] P-7 row 200 remainder: closed in code by row 85b - the session's closed key list `MIC_SOURCE_FACT_KEYS` holds `usbSerial` and `usbPort` (`fence/__tests__/fence.test.ts:1113-1114`), and the adapter states both (`usb-audio-production.ts` `sourceFacts`). Not re-run on a real card (9A/H-07).
- [x] P-8 Linux closed (row 79b); darwin = AM-1 (3)(h) with C135, proven (section 3).
- [x] P-9 this row's cell: 21 pins, 0 changed development results, 2 refusals (sections 2, 3).
- [x] P-10 U24 in force; no device contacted by this row.

Also applied: E-A2 at `credential.ts:12-15` (verbatim corrected text); text 4 - true of the tree, its target is a masterplan file this row may not write (request line, D-3).

## 5. Review 086 section 6

Must not start without: (1) AM-1 recorded - yes (C128); (2) rows 141, 59 (35/35), 157 and 086 CAUTION - yes; (3) B1 committed - yes (C144); (4) one writer: N7 / V7 / D1 landed (C131, C126, C144) - yes; (5) darwin: no macOS adapter registered - yes (`usb-audio-macos.ts` untouched; linux adapter only; darwin no-opener proof); (6) S-04 fixed before `onvif_ports` - yes (C137).
Must include: (1) list + class rule + `SNMP_POE` - done; (2) `admitDevice` before the registry with reader, `onAdmission`, opener list, both watches (C70) - done (`buildProductionRegistryOf` takes the door first, `fence/index.ts` `admitLater`; wiring section 1 #4); (3) E-03 - done; `lost()` is read by no product file (stated in `capture-composition.ts`); watch attached before the registry; (4) E-02 - maker recorded: `modules/capture-discovery/connect/index.ts:276` ALWAYS states `candidateSource` (`required: true` + rule in production); the `?` of `service.ts:264` stays (not my file; static pin `adapters/__tests__/static.test.ts:738`); (5) ticks: E-05 done (`onvif-session.ts:640-641`); E-01/Q-01 built by V7/V7c/V7d (C126, C141, C143); F3-06 op 108 outcomes named `PROFILES_STORED` / `STREAM_PROFILE_DIFFERS` (`adopted-test.ts:246,408`), the not-testable sentence `:257` is wording -> tidy rows; S-06 closed by row S06 (C136); (6) E-A2 + text 4 + P-6 - done / routed; (7) C-9 - done; (8) P-9 - done. 8 of 8 + 6 of 6.

## 6. Driver decisions

| # | Decision | Why |
|---|---|---|
| D-1 | `audio/usb-audio.ts` stays as the no-opener `USB_AUDIO` adapter of every non-`linux` host (not deleted, stays on the class-C list) | C135: darwin fail-closed by "no opener"; a microphone stays listed and assignable; N10 replaces that branch |
| D-2 | `camera/onvif-rtsp.ts` kept, retired, imported by nothing | red line: no deletion unasked; request line |
| D-3 | Text 4 not written into `04_design_addendum.md` | driver rules forbid masterplan writes; request line |
| D-4 | linux with helper or guard unset: no microphone opener + warn/persist, boot continues | "refuse a null" read as "build no opener"; request line for a ruling |
| D-5 | No parts handed in: empty registry + one warn line (no persist) | test apps boot REAL_PRODUCTION without a composition; the entry always composes |
| D-6 | Registration refusal code for the class rule = `CAPTURE_ADAPTER_INVALID` | the existing code of an adapter's own false claim |
| D-7 | No microphone loss watch where there is no microphone opener | nothing can record there; avoids a listing every 5 s on darwin |
